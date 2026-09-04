use serde::Serialize;
use serde_json::Value;
use std::{
    env, fs,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const CHECK_TIMEOUT: Duration = Duration::from_secs(120);
const JSON_LIMIT: u64 = 2 * 1024 * 1024;
const ENGINE_ENV: &str = "RACK_SHIP_CHECK_ENGINE_PATH";
const FALLBACK_ENGINE_ENV: &str = "SHIP_CHECK_ENGINE_PATH";
const GATES: &[&str] = &[
    "ship-check",
    "ship-check-secure-build",
    "ship-check-production-ready",
    "ship-check-cost-aware",
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShipCheckPlan {
    status: String,
    gate_id: String,
    step_id: String,
    work_root: String,
    engine_path: Option<String>,
    engine_version: Option<String>,
    display_command: String,
    fingerprint: Option<String>,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ShipCheckExecution {
    status: String,
    gate_id: String,
    step_id: String,
    work_root: String,
    engine_path: String,
    engine_version: String,
    fingerprint: String,
    provider_result: Value,
    evidence: String,
}

fn canonical_rack_root(root: String) -> Result<PathBuf, String> {
    let canonical = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the Rack folder: {error}"))?;
    if !canonical.is_dir() || !canonical.join("rack.yaml").is_file() {
        return Err("The selected Rack source folder is not a Rack project.".to_string());
    }
    Ok(canonical)
}

fn canonical_work_root(root: String) -> Result<PathBuf, String> {
    let canonical = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the work project folder: {error}"))?;
    if !canonical.is_dir() {
        return Err("The selected work project is not a folder.".to_string());
    }
    Ok(canonical)
}

fn digest(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

fn engine_filename() -> &'static str {
    if cfg!(windows) {
        "ship-check-engine.exe"
    } else {
        "ship-check-engine"
    }
}

fn development_engine_filename() -> &'static str {
    if cfg!(windows) {
        "ship-check.exe"
    } else {
        "ship-check"
    }
}

fn push_candidate(candidates: &mut Vec<PathBuf>, candidate: PathBuf) {
    if !candidates.iter().any(|existing| existing == &candidate) {
        candidates.push(candidate);
    }
}

fn engine_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for variable in [ENGINE_ENV, FALLBACK_ENGINE_ENV] {
        if let Ok(configured) = env::var(variable) {
            let configured = configured.trim();
            if !configured.is_empty() {
                push_candidate(&mut candidates, PathBuf::from(configured));
            }
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        push_candidate(&mut candidates, resource_dir.join(engine_filename()));
        push_candidate(
            &mut candidates,
            resource_dir.join("resources").join(engine_filename()),
        );
        push_candidate(
            &mut candidates,
            resource_dir.join("tools").join(engine_filename()),
        );
    }

    if let Ok(executable) = env::current_exe() {
        if let Some(parent) = executable.parent() {
            push_candidate(&mut candidates, parent.join(engine_filename()));
            push_candidate(
                &mut candidates,
                parent.join("resources").join(engine_filename()),
            );
        }
    }

    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let rack_root = manifest.join("../../..");
    push_candidate(
        &mut candidates,
        rack_root.join("dist").join(development_engine_filename()),
    );
    push_candidate(
        &mut candidates,
        rack_root
            .join("..")
            .join("Ship-check")
            .join("dist")
            .join(development_engine_filename()),
    );
    push_candidate(
        &mut candidates,
        rack_root
            .join("..")
            .join("ship-check")
            .join("dist")
            .join(development_engine_filename()),
    );

    candidates
}

fn locate_engine(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates = engine_candidates(app);
    for candidate in &candidates {
        if candidate.is_file() {
            return candidate.canonicalize().map_err(|error| {
                format!(
                    "Found Ship Check at {} but could not resolve it: {error}",
                    candidate.display()
                )
            });
        }
    }

    Err(format!(
        "Ship Check's local engine is not installed for this Rack build. Build/install Ship Check or set {ENGINE_ENV} for explicit local development."
    ))
}

fn validate_gate(gate_id: &str) -> Result<(), String> {
    if GATES.contains(&gate_id) {
        Ok(())
    } else {
        Err(format!("Rack does not trust the Ship Check gate: {gate_id}"))
    }
}

fn validate_step_id(step_id: &str) -> Result<(), String> {
    if step_id.is_empty() || step_id.len() > 200 {
        return Err("The verification step ID is invalid.".to_string());
    }
    if step_id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || "._:-".contains(character))
    {
        Ok(())
    } else {
        Err("The verification step ID contains unsupported characters.".to_string())
    }
}

fn pack_for_gate(gate_id: &str) -> Option<&'static str> {
    match gate_id {
        "ship-check-secure-build" => Some("secure-build"),
        "ship-check-production-ready" => Some("production-ready"),
        "ship-check-cost-aware" => Some("cost-aware"),
        _ => None,
    }
}

fn scan_args(work_root: &Path, gate_id: &str, step_id: &str) -> Vec<String> {
    let mut args = vec![
        "scan".to_string(),
        work_root.to_string_lossy().to_string(),
        "--format".to_string(),
        "rack".to_string(),
        "--gate".to_string(),
        gate_id.to_string(),
        "--step-id".to_string(),
        step_id.to_string(),
        "--fail-on".to_string(),
        "high".to_string(),
    ];
    if let Some(pack) = pack_for_gate(gate_id) {
        args.push("--pack".to_string());
        args.push(pack.to_string());
    }
    args
}

fn display_command(work_root: &Path, gate_id: &str, step_id: &str) -> String {
    let mut command = format!(
        "ship-check scan \"{}\" --format rack --gate {} --step-id {} --fail-on high",
        work_root.display(),
        gate_id,
        step_id
    );
    if let Some(pack) = pack_for_gate(gate_id) {
        command.push_str(&format!(" --pack {pack}"));
    }
    command
}

fn engine_version(engine: &Path) -> Result<String, String> {
    let output = Command::new(engine)
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map_err(|error| format!("Could not start the Ship Check engine: {error}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("Ship Check version check exited with {}.", output.status)
        } else {
            stderr
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn inspect(
    app: &AppHandle,
    work_root: &Path,
    gate_id: &str,
    step_id: &str,
) -> ShipCheckPlan {
    let display_command = display_command(work_root, gate_id, step_id);
    match locate_engine(app) {
        Ok(engine) => match engine_version(&engine) {
            Ok(version) => {
                let fingerprint = digest(&format!(
                    "{}\n{}\n{}\n{}\n{}",
                    engine.display(),
                    version,
                    work_root.display(),
                    gate_id,
                    step_id
                ));
                ShipCheckPlan {
                    status: "available".to_string(),
                    gate_id: gate_id.to_string(),
                    step_id: step_id.to_string(),
                    work_root: work_root.to_string_lossy().to_string(),
                    engine_path: Some(engine.to_string_lossy().to_string()),
                    engine_version: Some(version),
                    display_command,
                    fingerprint: Some(fingerprint),
                    message: "Rack found a trusted local Ship Check engine. The command is Rack-owned, read-only and uses the selected work project; no executable instruction comes from shared practice.".to_string(),
                }
            }
            Err(error) => ShipCheckPlan {
                status: "unavailable".to_string(),
                gate_id: gate_id.to_string(),
                step_id: step_id.to_string(),
                work_root: work_root.to_string_lossy().to_string(),
                engine_path: Some(engine.to_string_lossy().to_string()),
                engine_version: None,
                display_command,
                fingerprint: None,
                message: error,
            },
        },
        Err(error) => ShipCheckPlan {
            status: "unavailable".to_string(),
            gate_id: gate_id.to_string(),
            step_id: step_id.to_string(),
            work_root: work_root.to_string_lossy().to_string(),
            engine_path: None,
            engine_version: None,
            display_command,
            fingerprint: None,
            message: error,
        },
    }
}

fn read_json(path: &Path) -> Result<Value, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Could not inspect Ship Check output: {error}"))?;
    if metadata.len() > JSON_LIMIT {
        return Err("Ship Check returned more verification data than Rack will accept.".to_string());
    }
    let mut file = File::open(path)
        .map_err(|error| format!("Could not read Ship Check output: {error}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read Ship Check output: {error}"))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Ship Check returned invalid verification JSON: {error}"))
}

fn evidence_from(result: &Value) -> String {
    let outcome = result
        .get("outcome")
        .and_then(Value::as_str)
        .unwrap_or("incomplete");
    let findings = result
        .get("providerResult")
        .and_then(|value| value.get("findings"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut lines = vec![format!("Ship Check outcome: {outcome}")];
    for finding in findings.iter().take(50) {
        let severity = finding
            .get("severity")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        let title = finding
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("Untitled finding");
        lines.push(format!("- [{severity}] {title}"));
    }
    if findings.len() > 50 {
        lines.push(format!(
            "- …and {} additional Ship Check findings",
            findings.len() - 50
        ));
    }
    lines.join("\n")
}

#[tauri::command]
pub(crate) fn inspect_ship_check_verifier(
    app: AppHandle,
    rack_root: String,
    work_root: String,
    gate_id: String,
    step_id: String,
) -> Result<ShipCheckPlan, String> {
    let _rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    validate_gate(&gate_id)?;
    validate_step_id(&step_id)?;
    Ok(inspect(&app, &work_root, &gate_id, &step_id))
}

#[tauri::command]
pub(crate) fn run_ship_check_verifier(
    app: AppHandle,
    rack_root: String,
    work_root: String,
    gate_id: String,
    step_id: String,
    fingerprint: String,
    confirmed: bool,
) -> Result<ShipCheckExecution, String> {
    if !confirmed {
        return Err("Running Ship Check requires explicit confirmation.".to_string());
    }
    let rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    validate_gate(&gate_id)?;
    validate_step_id(&step_id)?;

    let plan = inspect(&app, &work_root, &gate_id, &step_id);
    if plan.status != "available" {
        return Err(plan.message);
    }
    let current_fingerprint = plan
        .fingerprint
        .clone()
        .ok_or_else(|| "Ship Check does not have a valid local fingerprint.".to_string())?;
    if current_fingerprint != fingerprint {
        return Err(
            "The Ship Check engine or verification target changed after review. Inspect the verifier again before running it."
                .to_string(),
        );
    }
    let engine = PathBuf::from(
        plan.engine_path
            .clone()
            .ok_or_else(|| "Ship Check engine path is unavailable.".to_string())?,
    );
    let version = plan
        .engine_version
        .clone()
        .ok_or_else(|| "Ship Check engine version is unavailable.".to_string())?;

    let log_root = rack_root
        .join(".rack")
        .join("verification-temp")
        .join(format!(
            "ship-check-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| format!("Could not create Ship Check run ID: {error}"))?
                .as_millis()
        ));
    fs::create_dir_all(&log_root)
        .map_err(|error| format!("Could not prepare Ship Check verification: {error}"))?;
    let stdout_path = log_root.join("stdout.json");
    let stderr_path = log_root.join("stderr.log");
    let stdout_file = File::create(&stdout_path)
        .map_err(|error| format!("Could not prepare Ship Check output: {error}"))?;
    let stderr_file = File::create(&stderr_path)
        .map_err(|error| format!("Could not prepare Ship Check error output: {error}"))?;

    let args = scan_args(&work_root, &gate_id, &step_id);
    let started = Instant::now();
    let mut child = Command::new(&engine)
        .args(&args)
        .current_dir(&work_root)
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
        .map_err(|error| format!("Could not start Ship Check: {error}"))?;

    let exit_code = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.code(),
            Ok(None) if started.elapsed() < CHECK_TIMEOUT => {
                thread::sleep(Duration::from_millis(100));
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = fs::remove_dir_all(&log_root);
                return Err("Ship Check exceeded Rack's two-minute local verifier limit.".to_string());
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                let _ = fs::remove_dir_all(&log_root);
                return Err(format!("Rack could not wait for Ship Check: {error}"));
            }
        }
    };

    let stderr = fs::read_to_string(&stderr_path).unwrap_or_default();
    if !matches!(exit_code, Some(0 | 2 | 3)) {
        let _ = fs::remove_dir_all(&log_root);
        return Err(if stderr.trim().is_empty() {
            format!("Ship Check exited unexpectedly with code {:?}.", exit_code)
        } else {
            format!("Ship Check failed: {}", stderr.trim())
        });
    }

    let result = read_json(&stdout_path)?;
    let _ = fs::remove_dir_all(&log_root);

    if result.get("schemaVersion").and_then(Value::as_str) != Some("0.1")
        || result.get("stepId").and_then(Value::as_str) != Some(step_id.as_str())
        || result.get("check").and_then(Value::as_str) != Some(gate_id.as_str())
    {
        return Err("Ship Check returned a verification result that does not match the reviewed Rack step.".to_string());
    }
    let outcome = result
        .get("outcome")
        .and_then(Value::as_str)
        .filter(|value| matches!(*value, "pass" | "fail" | "uncertain" | "incomplete"))
        .ok_or_else(|| "Ship Check returned an unsupported verification outcome.".to_string())?
        .to_string();

    match (exit_code, outcome.as_str()) {
        (Some(2), "fail") | (Some(3), "incomplete") | (Some(0), "pass" | "uncertain") => {}
        _ => {
            return Err(
                "Ship Check's process exit code did not match its structured verification outcome."
                    .to_string(),
            )
        }
    }

    Ok(ShipCheckExecution {
        status: outcome,
        gate_id,
        step_id,
        work_root: work_root.to_string_lossy().to_string(),
        engine_path: engine.to_string_lossy().to_string(),
        engine_version: version,
        fingerprint: current_fingerprint,
        evidence: evidence_from(&result),
        provider_result: result,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_registered_ship_check_gates_are_allowed() {
        assert!(validate_gate("ship-check").is_ok());
        assert!(validate_gate("ship-check-cost-aware").is_ok());
        assert!(validate_gate("arbitrary-script").is_err());
    }

    #[test]
    fn ship_check_step_ids_are_data_not_options() {
        assert!(validate_step_id("guardrail.verify:cost").is_ok());
        assert!(validate_step_id("--format").is_err());
        assert!(validate_step_id("step with spaces").is_err());
    }

    #[test]
    fn pack_specific_gate_adds_only_its_pack() {
        let root = Path::new("/tmp/project");
        let args = scan_args(root, "ship-check-cost-aware", "cost-check");
        assert!(args.windows(2).any(|pair| pair == ["--pack", "cost-aware"]));
        assert!(!args.iter().any(|value| value == "secure-build"));
    }

    #[test]
    fn general_gate_uses_ship_check_default_pack_set() {
        let root = Path::new("/tmp/project");
        let args = scan_args(root, "ship-check", "all-checks");
        assert!(!args.iter().any(|value| value == "--pack"));
    }
}
