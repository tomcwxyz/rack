use serde::Serialize;
use serde_json::Value;
use std::{
    fs,
    fs::File,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const CHECK_TIMEOUT: Duration = Duration::from_secs(180);
const OUTPUT_LIMIT: usize = 32 * 1024;
const ALLOWED_SCRIPTS: &[(&str, &str)] = &[
    ("check", "Project checks"),
    ("lint", "Lint"),
    ("typecheck", "Type check"),
    ("type-check", "Type check"),
    ("test", "Tests"),
    ("build", "Build"),
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryCheck {
    id: String,
    label: String,
    script: String,
    display_command: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryCheckPlan {
    status: String,
    package_manager: Option<String>,
    checks: Vec<RepositoryCheck>,
    fingerprint: Option<String>,
    message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryCheckResult {
    id: String,
    label: String,
    display_command: String,
    status: String,
    exit_code: Option<i32>,
    timed_out: bool,
    duration_ms: u128,
    stdout: String,
    stderr: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryCheckExecution {
    status: String,
    fingerprint: String,
    checks: Vec<RepositoryCheckResult>,
    evidence: String,
}

fn canonical_rack_root(root: String) -> Result<PathBuf, String> {
    let canonical = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the Rack folder: {error}"))?;
    if !canonical.is_dir() || !canonical.join("rack.yaml").is_file() {
        return Err("The selected folder is not a Rack project.".to_string());
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

fn package_manager(root: &Path) -> &'static str {
    if root.join("pnpm-lock.yaml").is_file() {
        "pnpm"
    } else if root.join("yarn.lock").is_file() {
        "yarn"
    } else {
        "npm"
    }
}

fn command_for(manager: &str, script: &str) -> (String, Vec<String>, String) {
    let program = manager.to_string();
    let args = vec!["run".to_string(), script.to_string()];
    let display = format!("{manager} run {script}");
    (program, args, display)
}

fn inspect(root: &Path) -> Result<RepositoryCheckPlan, String> {
    let package_path = root.join("package.json");
    if !package_path.is_file() {
        return Ok(RepositoryCheckPlan {
            status: "unavailable".to_string(),
            package_manager: None,
            checks: Vec::new(),
            fingerprint: None,
            message:
                "Rack currently supports trusted repository checks for JavaScript/TypeScript projects with a package.json at the Rack root."
                    .to_string(),
        });
    }

    let package_content = fs::read_to_string(&package_path)
        .map_err(|error| format!("Could not read package.json: {error}"))?;
    let package: Value = serde_json::from_str(&package_content)
        .map_err(|error| format!("package.json is invalid JSON: {error}"))?;
    let scripts = package
        .get("scripts")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let manager = package_manager(root);

    let mut checks = Vec::new();
    for (script, label) in ALLOWED_SCRIPTS {
        if !scripts
            .get(*script)
            .and_then(Value::as_str)
            .is_some_and(|value| !value.trim().is_empty())
        {
            continue;
        }
        let (_, _, display_command) = command_for(manager, script);
        checks.push(RepositoryCheck {
            id: script.replace('-', "_"),
            label: (*label).to_string(),
            script: (*script).to_string(),
            display_command,
        });
    }

    if checks.is_empty() {
        return Ok(RepositoryCheckPlan {
            status: "unavailable".to_string(),
            package_manager: Some(manager.to_string()),
            checks,
            fingerprint: None,
            message:
                "Rack found package.json but none of the trusted pilot script names: check, lint, typecheck, type-check, test or build."
                    .to_string(),
        });
    }

    let signature = format!(
        "{}\n{}\n{}",
        package_content,
        manager,
        checks
            .iter()
            .map(|check| format!("{}:{}", check.id, check.script))
            .collect::<Vec<_>>()
            .join("\n")
    );

    Ok(RepositoryCheckPlan {
        status: "available".to_string(),
        package_manager: Some(manager.to_string()),
        checks,
        fingerprint: Some(digest(&signature)),
        message:
            "Rack derived these checks from recognised package.json script names. No command came from Starter or shared practice."
                .to_string(),
    })
}

fn tail_text(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("Could not read verifier output: {error}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read verifier output: {error}"))?;
    if bytes.len() > OUTPUT_LIMIT {
        bytes = bytes.split_off(bytes.len() - OUTPUT_LIMIT);
    }
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

fn run_check(
    root: &Path,
    manager: &str,
    check: &RepositoryCheck,
    log_root: &Path,
) -> RepositoryCheckResult {
    let (program, args, display_command) = command_for(manager, &check.script);
    let stdout_path = log_root.join(format!("{}-stdout.log", check.id));
    let stderr_path = log_root.join(format!("{}-stderr.log", check.id));
    let started = Instant::now();

    let stdout_file = match File::create(&stdout_path) {
        Ok(file) => file,
        Err(error) => {
            return RepositoryCheckResult {
                id: check.id.clone(),
                label: check.label.clone(),
                display_command,
                status: "error".to_string(),
                exit_code: None,
                timed_out: false,
                duration_ms: started.elapsed().as_millis(),
                stdout: String::new(),
                stderr: format!("Could not prepare verification output: {error}"),
            }
        }
    };
    let stderr_file = match File::create(&stderr_path) {
        Ok(file) => file,
        Err(error) => {
            return RepositoryCheckResult {
                id: check.id.clone(),
                label: check.label.clone(),
                display_command,
                status: "error".to_string(),
                exit_code: None,
                timed_out: false,
                duration_ms: started.elapsed().as_millis(),
                stdout: String::new(),
                stderr: format!("Could not prepare verification error output: {error}"),
            }
        }
    };

    let mut child = match Command::new(&program)
        .args(&args)
        .current_dir(root)
        .env("CI", "true")
        .env("NO_COLOR", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return RepositoryCheckResult {
                id: check.id.clone(),
                label: check.label.clone(),
                display_command,
                status: "error".to_string(),
                exit_code: None,
                timed_out: false,
                duration_ms: started.elapsed().as_millis(),
                stdout: String::new(),
                stderr: format!("Could not start the trusted repository check: {error}"),
            }
        }
    };

    let mut timed_out = false;
    let exit_code = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status.code(),
            Ok(None) if started.elapsed() < CHECK_TIMEOUT => {
                thread::sleep(Duration::from_millis(100));
            }
            Ok(None) => {
                timed_out = true;
                let _ = child.kill();
                let status = child.wait().ok();
                break status.and_then(|item| item.code());
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                break None;
            }
        }
    };

    let stdout = tail_text(&stdout_path).unwrap_or_default();
    let stderr = tail_text(&stderr_path).unwrap_or_default();
    let _ = fs::remove_file(&stdout_path);
    let _ = fs::remove_file(&stderr_path);

    let status = if timed_out {
        "timeout"
    } else if exit_code == Some(0) {
        "pass"
    } else if exit_code.is_some() {
        "fail"
    } else {
        "error"
    };

    RepositoryCheckResult {
        id: check.id.clone(),
        label: check.label.clone(),
        display_command,
        status: status.to_string(),
        exit_code,
        timed_out,
        duration_ms: started.elapsed().as_millis(),
        stdout,
        stderr,
    }
}

fn evidence_from(results: &[RepositoryCheckResult]) -> String {
    results
        .iter()
        .map(|result| {
            let mut lines = vec![
                format!("## {}", result.label),
                format!("Command: {}", result.display_command),
                format!("Status: {}", result.status),
                format!(
                    "Exit code: {}",
                    result
                        .exit_code
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "none".to_string())
                ),
            ];
            if !result.stdout.trim().is_empty() {
                lines.push("Output:".to_string());
                lines.push(result.stdout.trim().to_string());
            }
            if !result.stderr.trim().is_empty() {
                lines.push("Errors:".to_string());
                lines.push(result.stderr.trim().to_string());
            }
            lines.join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

#[tauri::command]
pub(crate) fn inspect_repository_checks(root: String) -> Result<RepositoryCheckPlan, String> {
    let root = canonical_rack_root(root)?;
    inspect(&root)
}

#[tauri::command]
pub(crate) fn run_repository_checks(
    root: String,
    fingerprint: String,
    confirmed: bool,
) -> Result<RepositoryCheckExecution, String> {
    if !confirmed {
        return Err("Running repository code requires explicit confirmation.".to_string());
    }
    let root = canonical_rack_root(root)?;
    let plan = inspect(&root)?;
    if plan.status != "available" {
        return Err(plan.message);
    }
    let current_fingerprint = plan
        .fingerprint
        .clone()
        .ok_or_else(|| "Repository checks do not have a valid fingerprint.".to_string())?;
    if current_fingerprint != fingerprint {
        return Err(
            "The repository check plan changed after review. Inspect the checks again before running them."
                .to_string(),
        );
    }
    let manager = plan
        .package_manager
        .clone()
        .ok_or_else(|| "Rack could not determine a package manager.".to_string())?;

    let log_root = root
        .join(".rack")
        .join("verification-temp")
        .join(format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| format!("Could not create verifier run ID: {error}"))?
                .as_millis()
        ));
    fs::create_dir_all(&log_root)
        .map_err(|error| format!("Could not prepare local verification: {error}"))?;

    let results = plan
        .checks
        .iter()
        .map(|check| run_check(&root, &manager, check, &log_root))
        .collect::<Vec<_>>();
    let _ = fs::remove_dir_all(&log_root);

    let status = if results.iter().all(|result| result.status == "pass") {
        "pass"
    } else if results
        .iter()
        .any(|result| result.status == "fail" || result.status == "timeout")
    {
        "fail"
    } else {
        "incomplete"
    };

    Ok(RepositoryCheckExecution {
        status: status.to_string(),
        fingerprint: current_fingerprint,
        evidence: evidence_from(&results),
        checks: results,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_root(label: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "rack-repository-checks-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("rack.yaml"), "schema_version: \"0.1\"\n").unwrap();
        root
    }

    #[test]
    fn plans_only_recognised_package_scripts() {
        let root = fixture_root("allowed");
        fs::write(
            root.join("package.json"),
            r#"{
              "scripts": {
                "check": "echo check",
                "test": "echo test",
                "deploy": "echo never-run"
              }
            }"#,
        )
        .unwrap();
        fs::write(root.join("pnpm-lock.yaml"), "lockfileVersion: '9.0'\n").unwrap();

        let plan = inspect(&root).unwrap();
        assert_eq!(plan.status, "available");
        assert_eq!(plan.package_manager.as_deref(), Some("pnpm"));
        assert_eq!(
            plan.checks
                .iter()
                .map(|check| check.script.as_str())
                .collect::<Vec<_>>(),
            vec!["check", "test"]
        );
        assert!(plan
            .checks
            .iter()
            .all(|check| !check.display_command.contains("deploy")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn plan_fingerprint_changes_when_package_scripts_change() {
        let root = fixture_root("fingerprint");
        fs::write(
            root.join("package.json"),
            r#"{"scripts":{"test":"echo one"}}"#,
        )
        .unwrap();
        let first = inspect(&root).unwrap().fingerprint.unwrap();
        fs::write(
            root.join("package.json"),
            r#"{"scripts":{"test":"echo two"}}"#,
        )
        .unwrap();
        let second = inspect(&root).unwrap().fingerprint.unwrap();
        assert_ne!(first, second);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn project_without_recognised_scripts_is_unavailable() {
        let root = fixture_root("none");
        fs::write(
            root.join("package.json"),
            r#"{"scripts":{"start":"node server.js"}}"#,
        )
        .unwrap();
        let plan = inspect(&root).unwrap();
        assert_eq!(plan.status, "unavailable");
        assert!(plan.checks.is_empty());
        let _ = fs::remove_dir_all(root);
    }
}
