use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    fs,
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostFileInput {
    path: String,
    content: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ManagedHostFile {
    path: String,
    digest: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostInstallState {
    schema_version: String,
    host_id: String,
    profile_id: String,
    work_root: String,
    files: Vec<ManagedHostFile>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostFileInspection {
    path: String,
    status: String,
    detail: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostInstallInspection {
    host_id: String,
    profile_id: String,
    work_root: String,
    status: String,
    files: Vec<HostFileInspection>,
    can_install: bool,
    can_remove: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HostInstallResult {
    status: String,
    backup_directory: Option<String>,
    installed_paths: Vec<String>,
}

fn safe_slug(value: &str, label: &str) -> Result<(), String> {
    let mut characters = value.chars();
    let valid = matches!(characters.next(), Some(first) if first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        });
    if valid {
        Ok(())
    } else {
        Err(format!("The {label} is not safe."))
    }
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

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.trim().is_empty() || path.is_absolute() {
        return Err(format!("Host path is not safe: {value}"));
    }
    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(format!("Host path is not safe: {value}"));
        }
    }
    Ok(path.to_path_buf())
}

fn normalised(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn allowed_host_path(host_id: &str, value: &str) -> bool {
    let parts = value.split('/').collect::<Vec<_>>();
    match host_id {
        "claude-code" => {
            value == "CLAUDE.md"
                || (parts.len() == 4
                    && parts[0] == ".claude"
                    && parts[1] == "skills"
                    && !parts[2].is_empty()
                    && parts[3] == "SKILL.md"
                    && safe_slug(parts[2], "Claude skill").is_ok())
        }
        "opencode" => {
            value == "AGENTS.md"
                || (parts.len() == 3
                    && parts[0] == ".opencode"
                    && parts[1] == "commands"
                    && parts[2].ends_with(".md")
                    && safe_slug(parts[2].trim_end_matches(".md"), "OpenCode command").is_ok())
        }
        "codex" => value == "AGENTS.md",
        _ => false,
    }
}

fn validated_files(host_id: &str, files: Vec<HostFileInput>) -> Result<Vec<HostFileInput>, String> {
    match host_id {
        "claude-code" | "opencode" | "codex" => {}
        _ => return Err(format!("{host_id} does not yet support managed host installation.")),
    }

    if files.is_empty() {
        return Err("A host installation must contain at least one generated file.".to_string());
    }

    let mut seen = HashSet::new();
    for file in &files {
        let relative = safe_relative_path(&file.path)?;
        let path = normalised(&relative);
        if !allowed_host_path(host_id, &path) {
            return Err(format!(
                "{path} is not an allowed generated path for {host_id}."
            ));
        }
        if !seen.insert(path.clone()) {
            return Err(format!("Host file appears more than once: {path}"));
        }
    }

    Ok(files)
}

fn digest(content: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in content.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

fn state_path(rack_root: &Path, host_id: &str, profile_id: &str) -> PathBuf {
    rack_root
        .join(".rack")
        .join("host-installs")
        .join(host_id)
        .join(format!("{profile_id}.json"))
}

fn validate_state_paths(state: &HostInstallState) -> Result<(), String> {
    let mut seen = HashSet::new();
    for file in &state.files {
        let relative = safe_relative_path(&file.path)?;
        let path = normalised(&relative);
        if !allowed_host_path(&state.host_id, &path) || !seen.insert(path) {
            return Err("Rack host state contains an invalid managed path.".to_string());
        }
    }
    Ok(())
}

fn read_state(
    rack_root: &Path,
    work_root: &Path,
    host_id: &str,
    profile_id: &str,
) -> Result<Option<HostInstallState>, String> {
    let path = state_path(rack_root, host_id, profile_id);
    if !path.exists() {
        return Ok(None);
    }

    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Could not inspect Rack host state: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Rack host state is not an ordinary file.".to_string());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Rack host state: {error}"))?;
    let state: HostInstallState = serde_json::from_str(&content)
        .map_err(|error| format!("Rack host state is invalid JSON: {error}"))?;

    if state.schema_version != "0.1"
        || state.host_id != host_id
        || state.profile_id != profile_id
    {
        return Err("Rack host state does not match this host installation.".to_string());
    }
    if Path::new(&state.work_root) != work_root {
        return Err(
            "This Set-up already has a Rack-managed installation for this host in another work project. Remove that installation before changing the target."
                .to_string(),
        );
    }

    validate_state_paths(&state)?;
    Ok(Some(state))
}

fn ordinary_file_digest(path: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(format!(
                    "Host path is not an ordinary file: {}",
                    path.display()
                ));
            }
            let content = fs::read_to_string(path)
                .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
            Ok(Some(digest(&content)))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not inspect {}: {error}", path.display())),
    }
}

fn inspect(
    rack_root: &Path,
    work_root: &Path,
    host_id: &str,
    profile_id: &str,
    files: &[HostFileInput],
) -> Result<HostInstallInspection, String> {
    let state = read_state(rack_root, work_root, host_id, profile_id)?;
    let mut desired = BTreeMap::new();
    for file in files {
        let path = normalised(&safe_relative_path(&file.path)?);
        desired.insert(path, digest(&file.content));
    }
    let managed = state
        .as_ref()
        .map(|item| {
            item.files
                .iter()
                .map(|file| (file.path.clone(), file.digest.clone()))
                .collect::<BTreeMap<_, _>>()
        })
        .unwrap_or_default();

    let mut inspections = Vec::new();
    let mut conflict = false;
    let mut changed = false;

    for (path, expected_digest) in &desired {
        let destination = work_root.join(safe_relative_path(path)?);
        let current_digest = ordinary_file_digest(&destination)?;

        match managed.get(path) {
            Some(previous_digest) => match current_digest {
                Some(current) if current != *previous_digest => {
                    conflict = true;
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "conflict".to_string(),
                        detail: "This Rack-managed file changed outside Rack. Rack will not overwrite it.".to_string(),
                    });
                }
                None => {
                    conflict = true;
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "conflict".to_string(),
                        detail: "A previously Rack-managed file is missing. Review the work project before reinstalling.".to_string(),
                    });
                }
                Some(_) if previous_digest == expected_digest => {
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "current".to_string(),
                        detail: "Installed Rack output is current.".to_string(),
                    });
                }
                Some(_) => {
                    changed = true;
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "update".to_string(),
                        detail: "Rack can update this file because the installed copy has not changed outside Rack.".to_string(),
                    });
                }
            },
            None => match current_digest {
                Some(_) => {
                    conflict = true;
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "conflict".to_string(),
                        detail: "A pre-existing work-project file already uses this path. Rack will not overwrite it.".to_string(),
                    });
                }
                None => {
                    changed = true;
                    inspections.push(HostFileInspection {
                        path: path.clone(),
                        status: "create".to_string(),
                        detail: "Rack will create this generated host file in the work project.".to_string(),
                    });
                }
            },
        }
    }

    for (path, previous_digest) in &managed {
        if desired.contains_key(path) {
            continue;
        }
        let destination = work_root.join(safe_relative_path(path)?);
        match ordinary_file_digest(&destination)? {
            Some(current) if current == *previous_digest => {
                changed = true;
                inspections.push(HostFileInspection {
                    path: path.clone(),
                    status: "remove".to_string(),
                    detail: "This older Rack-generated file is no longer part of the current host package and can be removed.".to_string(),
                });
            }
            Some(_) | None => {
                conflict = true;
                inspections.push(HostFileInspection {
                    path: path.clone(),
                    status: "conflict".to_string(),
                    detail: "An older Rack-managed path changed outside Rack, so Rack will not remove it.".to_string(),
                });
            }
        }
    }

    inspections.sort_by(|left, right| left.path.cmp(&right.path));

    let status = if conflict {
        "conflict"
    } else if state.is_none() {
        "ready"
    } else if changed {
        "update-available"
    } else {
        "current"
    };

    Ok(HostInstallInspection {
        host_id: host_id.to_string(),
        profile_id: profile_id.to_string(),
        work_root: work_root.to_string_lossy().to_string(),
        status: status.to_string(),
        files: inspections,
        can_install: !conflict && status != "current",
        can_remove: state.is_some() && !conflict,
    })
}

fn state_for(
    work_root: &Path,
    host_id: &str,
    profile_id: &str,
    files: &[HostFileInput],
) -> Result<HostInstallState, String> {
    let mut managed = Vec::new();
    for file in files {
        managed.push(ManagedHostFile {
            path: normalised(&safe_relative_path(&file.path)?),
            digest: digest(&file.content),
        });
    }
    Ok(HostInstallState {
        schema_version: "0.1".to_string(),
        host_id: host_id.to_string(),
        profile_id: profile_id.to_string(),
        work_root: work_root.to_string_lossy().to_string(),
        files: managed,
    })
}

fn write_state_value(
    rack_root: &Path,
    state: &HostInstallState,
) -> Result<(), String> {
    let path = state_path(rack_root, &state.host_id, &state.profile_id);
    let parent = path
        .parent()
        .ok_or_else(|| "Rack host state has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not prepare Rack host state: {error}"))?;

    let content = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not encode Rack host state: {error}"))?;
    let temporary = parent.join(format!(
        ".{}-{}.tmp",
        state.profile_id,
        std::process::id()
    ));
    fs::write(&temporary, content)
        .map_err(|error| format!("Could not prepare Rack host state: {error}"))?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not replace Rack host state: {error}"))?;
    }
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not finish Rack host state: {error}"))
}

fn backup_managed_files(
    rack_root: &Path,
    work_root: &Path,
    host_id: &str,
    profile_id: &str,
    state: &HostInstallState,
) -> Result<Option<PathBuf>, String> {
    if state.files.is_empty() {
        return Ok(None);
    }
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("Could not create host backup timestamp: {error}"))?
        .as_millis();
    let backup = rack_root
        .join(".rack")
        .join("host-backups")
        .join(host_id)
        .join(profile_id)
        .join(format!("{timestamp}-{}", std::process::id()));

    for file in &state.files {
        let source = work_root.join(safe_relative_path(&file.path)?);
        if !source.exists() {
            continue;
        }
        let destination = backup.join(safe_relative_path(&file.path)?);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not prepare host backup: {error}"))?;
        }
        fs::copy(&source, &destination)
            .map_err(|error| format!("Could not back up {}: {error}", file.path))?;
    }

    Ok(Some(backup))
}

fn restore_previous(
    rack_root: &Path,
    work_root: &Path,
    previous: Option<&HostInstallState>,
    backup: Option<&Path>,
    desired: &[HostFileInput],
) {
    let previous_paths = previous
        .map(|state| {
            state
                .files
                .iter()
                .map(|file| file.path.as_str())
                .collect::<HashSet<_>>()
        })
        .unwrap_or_default();

    for file in desired {
        let Ok(relative) = safe_relative_path(&file.path) else {
            continue;
        };
        let path = normalised(&relative);
        if previous_paths.contains(path.as_str()) {
            continue;
        }
        let destination = work_root.join(relative);
        if ordinary_file_digest(&destination)
            .ok()
            .flatten()
            .is_some_and(|current| current == digest(&file.content))
        {
            let _ = fs::remove_file(destination);
        }
    }

    if let (Some(state), Some(backup)) = (previous, backup) {
        for file in &state.files {
            let source = backup.join(&file.path);
            let destination = work_root.join(&file.path);
            if !source.is_file() {
                continue;
            }
            if let Some(parent) = destination.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::copy(source, destination);
        }
        let _ = write_state_value(rack_root, state);
    } else if let Some(state) = previous {
        let _ = write_state_value(rack_root, state);
    }
}

#[tauri::command]
pub(crate) fn inspect_host_install(
    rack_root: String,
    work_root: String,
    host_id: String,
    profile_id: String,
    files: Vec<HostFileInput>,
) -> Result<HostInstallInspection, String> {
    safe_slug(&profile_id, "Set-up ID")?;
    let rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    let files = validated_files(&host_id, files)?;
    inspect(&rack_root, &work_root, &host_id, &profile_id, &files)
}

#[tauri::command]
pub(crate) fn install_host_files(
    rack_root: String,
    work_root: String,
    host_id: String,
    profile_id: String,
    files: Vec<HostFileInput>,
    confirmed: bool,
) -> Result<HostInstallResult, String> {
    if !confirmed {
        return Err("Host installation requires explicit confirmation.".to_string());
    }
    safe_slug(&profile_id, "Set-up ID")?;
    let rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    let files = validated_files(&host_id, files)?;
    let inspection = inspect(&rack_root, &work_root, &host_id, &profile_id, &files)?;
    if !inspection.can_install {
        return Err(match inspection.status.as_str() {
            "current" => "This host installation is already current.".to_string(),
            _ => "Rack cannot install because one or more host paths conflict with existing work-project files.".to_string(),
        });
    }

    let previous = read_state(&rack_root, &work_root, &host_id, &profile_id)?;
    let backup = match previous.as_ref() {
        Some(state) => backup_managed_files(
            &rack_root,
            &work_root,
            &host_id,
            &profile_id,
            state,
        )?,
        None => None,
    };
    let mut desired_paths = HashSet::new();
    for file in &files {
        desired_paths.insert(normalised(&safe_relative_path(&file.path)?));
    }

    let mutation = (|| -> Result<Vec<String>, String> {
        if let Some(state) = &previous {
            for old in &state.files {
                if desired_paths.contains(&old.path) {
                    continue;
                }
                let destination = work_root.join(safe_relative_path(&old.path)?);
                if destination.exists() {
                    fs::remove_file(&destination).map_err(|error| {
                        format!("Could not remove old Rack host file {}: {error}", old.path)
                    })?;
                }
            }
        }

        let mut written = Vec::new();
        for file in &files {
            let relative = safe_relative_path(&file.path)?;
            let path = normalised(&relative);
            let destination = work_root.join(relative);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not prepare host folder {}: {error}", parent.display())
                })?;
            }
            let temporary = destination.with_extension(format!(
                "{}.rack-tmp-{}",
                destination
                    .extension()
                    .and_then(|value| value.to_str())
                    .unwrap_or("tmp"),
                std::process::id()
            ));
            fs::write(&temporary, file.content.as_bytes())
                .map_err(|error| format!("Could not prepare host file {path}: {error}"))?;
            if destination.exists() {
                fs::remove_file(&destination)
                    .map_err(|error| format!("Could not replace Rack host file {path}: {error}"))?;
            }
            fs::rename(&temporary, &destination)
                .map_err(|error| format!("Could not finish host file {path}: {error}"))?;
            written.push(path);
        }

        let next_state = state_for(&work_root, &host_id, &profile_id, &files)?;
        write_state_value(&rack_root, &next_state)?;
        Ok(written)
    })();

    match mutation {
        Ok(written) => Ok(HostInstallResult {
            status: "installed".to_string(),
            backup_directory: backup.map(|path| path.to_string_lossy().to_string()),
            installed_paths: written,
        }),
        Err(error) => {
            restore_previous(
                &rack_root,
                &work_root,
                previous.as_ref(),
                backup.as_deref(),
                &files,
            );
            Err(error)
        }
    }
}

#[tauri::command]
pub(crate) fn remove_host_install(
    rack_root: String,
    work_root: String,
    host_id: String,
    profile_id: String,
    confirmed: bool,
) -> Result<HostInstallResult, String> {
    if !confirmed {
        return Err("Removing a host installation requires explicit confirmation.".to_string());
    }
    safe_slug(&profile_id, "Set-up ID")?;
    let rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    let state = read_state(&rack_root, &work_root, &host_id, &profile_id)?
        .ok_or_else(|| "Rack has no managed installation for this host and Set-up.".to_string())?;

    for file in &state.files {
        let destination = work_root.join(safe_relative_path(&file.path)?);
        match ordinary_file_digest(&destination)? {
            Some(current) if current == file.digest => {}
            _ => {
                return Err(format!(
                    "{} changed outside Rack. Rack will not remove it automatically.",
                    file.path
                ))
            }
        }
    }

    let backup = backup_managed_files(
        &rack_root,
        &work_root,
        &host_id,
        &profile_id,
        &state,
    )?;

    let mutation = (|| -> Result<Vec<String>, String> {
        let mut removed = Vec::new();
        for file in &state.files {
            let destination = work_root.join(safe_relative_path(&file.path)?);
            fs::remove_file(&destination)
                .map_err(|error| format!("Could not remove Rack host file {}: {error}", file.path))?;
            removed.push(file.path.clone());
        }

        let state_file = state_path(&rack_root, &host_id, &profile_id);
        if state_file.exists() {
            fs::remove_file(&state_file)
                .map_err(|error| format!("Could not remove Rack host state: {error}"))?;
        }
        Ok(removed)
    })();

    match mutation {
        Ok(removed) => Ok(HostInstallResult {
            status: "removed".to_string(),
            backup_directory: backup.map(|path| path.to_string_lossy().to_string()),
            installed_paths: removed,
        }),
        Err(error) => {
            restore_previous(
                &rack_root,
                &work_root,
                Some(&state),
                backup.as_deref(),
                &[],
            );
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_root(label: &str) -> (PathBuf, PathBuf) {
        let base = std::env::temp_dir().join(format!(
            "rack-host-install-{label}-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let rack = base.join("rack");
        let work = base.join("work");
        fs::create_dir_all(&rack).unwrap();
        fs::create_dir_all(&work).unwrap();
        fs::write(rack.join("rack.yaml"), "schema_version: \"0.1\"\n").unwrap();
        (rack, work)
    }

    fn file(path: &str, content: &str) -> HostFileInput {
        HostFileInput {
            path: path.to_string(),
            content: content.to_string(),
        }
    }

    #[test]
    fn first_install_refuses_preexisting_work_project_files() {
        let (rack, work) = fixture_root("conflict");
        fs::write(work.join("CLAUDE.md"), "user instructions").unwrap();
        let inspection = inspect(
            &rack,
            &work,
            "claude-code",
            "coding",
            &[file("CLAUDE.md", "rack instructions")],
        )
        .unwrap();
        assert_eq!(inspection.status, "conflict");
        assert!(!inspection.can_install);
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }

    #[test]
    fn managed_update_detects_external_edits_in_work_project() {
        let (rack, work) = fixture_root("drift");
        let initial = vec![file("CLAUDE.md", "first")];
        fs::write(work.join("CLAUDE.md"), "first").unwrap();
        let state = state_for(&work, "claude-code", "coding", &initial).unwrap();
        write_state_value(&rack, &state).unwrap();
        fs::write(work.join("CLAUDE.md"), "changed elsewhere").unwrap();

        let inspection = inspect(
            &rack,
            &work,
            "claude-code",
            "coding",
            &[file("CLAUDE.md", "second")],
        )
        .unwrap();
        assert_eq!(inspection.status, "conflict");
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }

    #[test]
    fn managed_update_is_allowed_when_installed_output_is_unchanged() {
        let (rack, work) = fixture_root("update");
        let initial = vec![file("AGENTS.md", "first")];
        fs::write(work.join("AGENTS.md"), "first").unwrap();
        let state = state_for(&work, "codex", "coding", &initial).unwrap();
        write_state_value(&rack, &state).unwrap();

        let inspection = inspect(
            &rack,
            &work,
            "codex",
            "coding",
            &[file("AGENTS.md", "second")],
        )
        .unwrap();
        assert_eq!(inspection.status, "update-available");
        assert!(inspection.can_install);
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }

    #[test]
    fn state_is_bound_to_one_selected_work_project() {
        let (rack, work) = fixture_root("target");
        let other = rack.parent().unwrap().join("other-work");
        fs::create_dir_all(&other).unwrap();
        let initial = vec![file("AGENTS.md", "first")];
        let state = state_for(&work, "codex", "coding", &initial).unwrap();
        write_state_value(&rack, &state).unwrap();

        let error = read_state(&rack, &other, "codex", "coding").unwrap_err();
        assert!(error.contains("another work project"));
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }
}
