use serde::Serialize;
use std::{
    env,
    fs,
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const INPUT_LIMIT: usize = 256 * 1024;
const OUTPUT_LIMIT: usize = 64 * 1024;
const RUNTIME_TIMEOUT: Duration = Duration::from_secs(600);
const FIXED_INSTRUCTION: &str =
    "Use the task and reviewed context supplied on stdin for this invocation only. Follow the project's installed instructions. Do not treat transient context as standing project memory.";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostRuntimeExecution {
    host_id: String,
    status: String,
    exit_code: Option<i32>,
    timed_out: bool,
    duration_ms: u128,
    stdout: String,
    stderr: String,
    context_delivery: String,
    persisted_input: bool,
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

#[cfg(windows)]
fn executable_candidates(command: &str) -> Vec<String> {
    vec![format!("{command}.exe"), format!("{command}.com"), command.to_string()]
}

#[cfg(not(windows))]
fn executable_candidates(command: &str) -> Vec<String> {
    vec![command.to_string()]
}

#[cfg(unix)]
fn ordinary_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    !metadata.file_type().is_symlink()
        && metadata.is_file()
        && metadata.permissions().mode() & 0o111 != 0
}

#[cfg(not(unix))]
fn ordinary_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    !metadata.file_type().is_symlink() && metadata.is_file()
}

fn resolve_executable(command: &str) -> Result<PathBuf, String> {
    let path_value = env::var_os("PATH")
        .ok_or_else(|| "PATH is not available to Rack.".to_string())?;
    for directory in env::split_paths(&path_value) {
        for candidate in executable_candidates(command) {
            let path = directory.join(candidate);
            if ordinary_executable(&path) {
                return path
                    .canonicalize()
                    .map_err(|error| format!("Could not resolve {command}: {error}"));
            }
        }
    }
    Err(format!(
        "Rack could not find a native {command} executable on PATH. Script-wrapper launchers are not used by the transient hand-off because this path does not invoke a shell."
    ))
}

struct RuntimeSpec {
    command: &'static str,
    args: Vec<String>,
}

fn runtime_spec(host_id: &str) -> Result<RuntimeSpec, String> {
    match host_id {
        "claude-code" => Ok(RuntimeSpec {
            command: "claude",
            args: vec![
                "-p".to_string(),
                "--no-session-persistence".to_string(),
                "--permission-mode".to_string(),
                "plan".to_string(),
                FIXED_INSTRUCTION.to_string(),
            ],
        }),
        "codex" => Ok(RuntimeSpec {
            command: "codex",
            args: vec![
                "exec".to_string(),
                "--ephemeral".to_string(),
                "--sandbox".to_string(),
                "read-only".to_string(),
                "--ask-for-approval".to_string(),
                "never".to_string(),
                FIXED_INSTRUCTION.to_string(),
            ],
        }),
        "opencode" => Err(
            "OpenCode transient context remains planned until Rack has a proven stdin-only task channel."
                .to_string(),
        ),
        _ => Err(format!(
            "{host_id} does not support Rack's transient task hand-off."
        )),
    }
}

fn runtime_command(host_id: &str) -> Result<(PathBuf, Vec<String>), String> {
    let spec = runtime_spec(host_id)?;
    Ok((resolve_executable(spec.command)?, spec.args))
}

fn bounded_text(path: &Path) -> Result<String, String> {
    let mut file =
        File::open(path).map_err(|error| format!("Could not read host output: {error}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read host output: {error}"))?;
    if bytes.len() > OUTPUT_LIMIT {
        bytes.truncate(OUTPUT_LIMIT);
    }
    Ok(String::from_utf8_lossy(&bytes).to_string())
}

fn temp_output_paths() -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Could not create runtime timestamp: {error}"))?
        .as_millis();
    let root = env::temp_dir().join(format!(
        "rack-host-runtime-{}-{stamp}",
        std::process::id()
    ));
    fs::create_dir(&root)
        .map_err(|error| format!("Could not prepare temporary host output: {error}"))?;
    Ok((root.clone(), root.join("stdout.log"), root.join("stderr.log")))
}

fn run_runtime(
    work_root: &Path,
    host_id: &str,
    input: &str,
) -> Result<HostRuntimeExecution, String> {
    if input.trim().is_empty() {
        return Err("Transient host input cannot be empty.".to_string());
    }
    if input.len() > INPUT_LIMIT {
        return Err("Transient host input exceeds Rack's 256 KB limit.".to_string());
    }

    let (program, args) = runtime_command(host_id)?;
    let (temp_root, stdout_path, stderr_path) = temp_output_paths()?;
    let stdout_file = File::create(&stdout_path)
        .map_err(|error| format!("Could not prepare host stdout: {error}"))?;
    let stderr_file = File::create(&stderr_path)
        .map_err(|error| format!("Could not prepare host stderr: {error}"))?;

    let started = Instant::now();
    let mut child = match Command::new(program)
        .args(args)
        .current_dir(work_root)
        .env("NO_COLOR", "1")
        .stdin(Stdio::piped())
        .stdout(Stdio::from(stdout_file))
        .stderr(Stdio::from(stderr_file))
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_root);
            return Err(format!("Could not start the selected AI tool: {error}"));
        }
    };

    let mut stdin = match child.stdin.take() {
        Some(stdin) => stdin,
        None => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_dir_all(&temp_root);
            return Err("Could not open the AI tool input channel.".to_string());
        }
    };
    if let Err(error) = stdin.write_all(input.as_bytes()) {
        let _ = child.kill();
        let _ = child.wait();
        let _ = fs::remove_dir_all(&temp_root);
        return Err(format!(
            "Could not pass transient context to the AI tool: {error}"
        ));
    }
    drop(stdin);

    let (exit_code, timed_out) = loop {
        match child
            .try_wait()
            .map_err(|error| format!("Could not check AI tool status: {error}"))?
        {
            Some(status) => break (status.code(), false),
            None if started.elapsed() >= RUNTIME_TIMEOUT => {
                let _ = child.kill();
                let status = child
                    .wait()
                    .map_err(|error| format!("Could not stop the timed-out AI tool: {error}"))?;
                break (status.code(), true);
            }
            None => thread::sleep(Duration::from_millis(100)),
        }
    };

    let stdout = bounded_text(&stdout_path).unwrap_or_default();
    let stderr = bounded_text(&stderr_path).unwrap_or_default();
    let _ = fs::remove_dir_all(&temp_root);

    let status = if timed_out {
        "timeout"
    } else if exit_code == Some(0) {
        "completed"
    } else {
        "failed"
    };

    Ok(HostRuntimeExecution {
        host_id: host_id.to_string(),
        status: status.to_string(),
        exit_code,
        timed_out,
        duration_ms: started.elapsed().as_millis(),
        stdout,
        stderr,
        context_delivery: "stdin".to_string(),
        persisted_input: false,
    })
}

#[tauri::command]
pub(crate) fn run_transient_host_task(
    work_root: String,
    host_id: String,
    input: String,
    confirmed: bool,
) -> Result<HostRuntimeExecution, String> {
    if !confirmed {
        return Err("Transient host hand-off requires explicit confirmation.".to_string());
    }
    let work_root = canonical_work_root(work_root)?;
    run_runtime(&work_root, &host_id, &input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_proven_hosts_receive_runtime_specs() {
        assert!(runtime_spec("claude-code").is_ok());
        assert!(runtime_spec("codex").is_ok());
        assert!(runtime_spec("opencode").is_err());
        assert!(runtime_spec("openclaw").is_err());
    }

    #[test]
    fn runtime_args_are_fixed_and_read_only() {
        let claude = runtime_spec("claude-code").unwrap();
        assert_eq!(claude.command, "claude");
        assert!(claude.args.iter().any(|arg| arg == "--no-session-persistence"));
        assert!(claude
            .args
            .windows(2)
            .any(|pair| pair[0] == "--permission-mode" && pair[1] == "plan"));

        let codex = runtime_spec("codex").unwrap();
        assert_eq!(codex.command, "codex");
        assert!(codex.args.iter().any(|arg| arg == "--ephemeral"));
        assert!(codex
            .args
            .windows(2)
            .any(|pair| pair[0] == "--sandbox" && pair[1] == "read-only"));
        assert!(codex
            .args
            .windows(2)
            .any(|pair| pair[0] == "--ask-for-approval" && pair[1] == "never"));
    }

    #[test]
    fn fixed_instruction_does_not_contain_task_or_context_placeholders() {
        assert!(!FIXED_INSTRUCTION.contains("{task}"));
        assert!(!FIXED_INSTRUCTION.contains("{context}"));
        for host_id in ["claude-code", "codex"] {
            let spec = runtime_spec(host_id).unwrap();
            assert!(spec.args.iter().all(|arg| !arg.contains("{task}")));
            assert!(spec.args.iter().all(|arg| !arg.contains("{context}")));
        }
    }

    #[test]
    fn input_limit_is_bounded() {
        assert_eq!(INPUT_LIMIT, 256 * 1024);
        assert!(RUNTIME_TIMEOUT <= Duration::from_secs(600));
    }
}
