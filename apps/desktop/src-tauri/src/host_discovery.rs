use serde::Serialize;
use std::{
    collections::HashSet,
    env,
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostDiscovery {
    id: String,
    display_name: String,
    detected: bool,
    evidence: Vec<String>,
}

#[derive(Clone, Copy)]
struct HostDefinition {
    id: &'static str,
    display_name: &'static str,
    commands: &'static [&'static str],
    home_directories: &'static [&'static str],
}

const HOSTS: &[HostDefinition] = &[
    HostDefinition {
        id: "claude-code",
        display_name: "Claude Code",
        commands: &["claude"],
        home_directories: &[".claude"],
    },
    HostDefinition {
        id: "codex",
        display_name: "Codex",
        commands: &["codex"],
        home_directories: &[".codex"],
    },
    HostDefinition {
        id: "opencode",
        display_name: "OpenCode",
        commands: &["opencode"],
        home_directories: &[".opencode", ".config/opencode"],
    },
    HostDefinition {
        id: "hermes-agent",
        display_name: "Hermes Agent",
        commands: &["hermes"],
        home_directories: &[".hermes"],
    },
    HostDefinition {
        id: "openclaw",
        display_name: "OpenClaw",
        commands: &["openclaw", "clawhub"],
        home_directories: &[".openclaw"],
    },
    HostDefinition {
        id: "copilot-cli",
        display_name: "GitHub Copilot CLI",
        commands: &["copilot"],
        home_directories: &[],
    },
    HostDefinition {
        id: "gemini-cli",
        display_name: "Gemini CLI",
        commands: &["gemini"],
        home_directories: &[],
    },
    HostDefinition {
        id: "cursor",
        display_name: "Cursor",
        commands: &["cursor"],
        home_directories: &[".cursor"],
    },
    HostDefinition {
        id: "windsurf",
        display_name: "Windsurf",
        commands: &["windsurf"],
        home_directories: &[],
    },
];

#[cfg(windows)]
fn command_candidates(command: &str) -> Vec<String> {
    let extensions = env::var("PATHEXT")
        .unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".to_string())
        .split(';')
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_ascii_lowercase())
        .collect::<Vec<_>>();

    let mut candidates = vec![command.to_string()];
    candidates.extend(
        extensions
            .into_iter()
            .map(|extension| format!("{command}{extension}")),
    );
    candidates
}

#[cfg(not(windows))]
fn command_candidates(command: &str) -> Vec<String> {
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

fn command_exists(command: &str) -> bool {
    let Some(path_value) = env::var_os("PATH") else {
        return false;
    };

    for directory in env::split_paths(&path_value) {
        for candidate in command_candidates(command) {
            if ordinary_executable(&directory.join(candidate)) {
                return true;
            }
        }
    }

    false
}

fn ordinary_home_directory(home: &Path, relative: &str) -> bool {
    let candidate = home.join(relative);
    let Ok(metadata) = fs::symlink_metadata(candidate) else {
        return false;
    };
    !metadata.file_type().is_symlink() && metadata.is_dir()
}

fn discover(home: Option<PathBuf>) -> Vec<HostDiscovery> {
    let mut output = Vec::new();

    for host in HOSTS {
        let mut evidence = Vec::new();

        for command in host.commands {
            if command_exists(command) {
                evidence.push(format!("command:{command}"));
            }
        }

        if let Some(home) = home.as_deref() {
            for directory in host.home_directories {
                if ordinary_home_directory(home, directory) {
                    evidence.push(format!("home:{directory}"));
                }
            }
        }

        evidence.sort();
        evidence.dedup();

        output.push(HostDiscovery {
            id: host.id.to_string(),
            display_name: host.display_name.to_string(),
            detected: !evidence.is_empty(),
            evidence,
        });
    }

    output.sort_by(|left, right| left.display_name.cmp(&right.display_name));
    output
}

#[tauri::command]
pub(crate) fn discover_ai_hosts() -> Vec<HostDiscovery> {
    discover(dirs::home_dir())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_registry_has_unique_ids() {
        let ids = HOSTS.iter().map(|host| host.id).collect::<HashSet<_>>();
        assert_eq!(ids.len(), HOSTS.len());
    }

    #[test]
    fn discovery_evidence_does_not_expose_absolute_paths() {
        for host in discover(None) {
            assert!(host
                .evidence
                .iter()
                .all(|item| item.starts_with("command:")));
        }
    }
}
