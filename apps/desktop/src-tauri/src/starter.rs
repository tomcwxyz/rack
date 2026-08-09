use serde::Deserialize;
use std::{collections::HashSet, fs, path::PathBuf};

use super::{
    editable_project_file, project_snapshot, safe_folder_name, safe_relative_path, ProjectSnapshot,
    SourceFile,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StarterProfileChange {
    path: String,
    before: String,
    after: String,
}

fn is_safe_starter_module(path: &std::path::Path) -> bool {
    path.parent() == Some(std::path::Path::new("modules/starter"))
        && path.extension().and_then(|value| value.to_str()) == Some("md")
        && path
            .file_stem()
            .and_then(|value| value.to_str())
            .is_some_and(safe_folder_name)
}

#[tauri::command]
pub(super) fn apply_starter_import(
    root: String,
    files: Vec<SourceFile>,
    profile_change: Option<StarterProfileChange>,
) -> Result<ProjectSnapshot, String> {
    let canonical_root = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the Rack folder: {error}"))?;
    project_snapshot(&canonical_root)?;

    let rack_state = canonical_root.join(".rack");
    fs::create_dir_all(&rack_state)
        .map_err(|error| format!("Could not prepare Rack import state: {error}"))?;
    let staging = rack_state.join(format!(".starter-import-{}", std::process::id()));
    if staging.exists() {
        return Err(
            "A previous Starter import attempt is still present. Remove it before trying again."
                .to_string(),
        );
    }
    fs::create_dir(&staging)
        .map_err(|error| format!("Could not prepare the Starter import: {error}"))?;

    let mut planned = Vec::new();
    let mut seen = HashSet::new();
    let preparation = (|| -> Result<(), String> {
        for file in &files {
            let relative = safe_relative_path(&file.path)?;
            if !is_safe_starter_module(&relative) {
                return Err(format!(
                    "Starter imports can only create Markdown files directly inside modules/starter: {}",
                    file.path
                ));
            }
            if !seen.insert(relative.clone()) {
                return Err(format!("Starter file appears more than once: {}", file.path));
            }

            let destination = canonical_root.join(&relative);
            match fs::symlink_metadata(&destination) {
                Ok(_) => {
                    return Err(format!(
                        "{} now exists. Review the Rack again before importing.",
                        file.path
                    ))
                }
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!(
                        "Could not inspect {} before importing: {error}",
                        file.path
                    ))
                }
            }

            let staged = staging.join(&relative);
            if let Some(parent) = staged.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not prepare {}: {error}", file.path)
                })?;
            }
            fs::write(&staged, file.content.as_bytes())
                .map_err(|error| format!("Could not prepare {}: {error}", file.path))?;
            planned.push((staged, destination));
        }
        Ok(())
    })();

    if let Err(error) = preparation {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }

    let mut profile_paths: Option<(PathBuf, PathBuf, PathBuf)> = None;
    if let Some(change) = &profile_change {
        let relative = match safe_relative_path(&change.path) {
            Ok(value) => value,
            Err(error) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(error);
            }
        };
        if !relative.starts_with("profiles")
            || relative.extension().and_then(|value| value.to_str()) != Some("yaml")
        {
            let _ = fs::remove_dir_all(&staging);
            return Err("Starter can only update a YAML Set-up inside profiles/.".to_string());
        }

        let destination = match editable_project_file(&canonical_root, &change.path) {
            Ok(value) => value,
            Err(error) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(error);
            }
        };
        let current = match fs::read_to_string(&destination) {
            Ok(value) => value,
            Err(error) => {
                let _ = fs::remove_dir_all(&staging);
                return Err(format!("Could not re-read the Set-up before importing: {error}"));
            }
        };
        if current != change.before {
            let _ = fs::remove_dir_all(&staging);
            return Err(
                "The selected Set-up changed after the import review. Review the import again."
                    .to_string(),
            );
        }

        let staged = staging.join("profile.yaml");
        let backup = staging.join("profile.backup.yaml");
        if let Err(error) = fs::write(&staged, change.after.as_bytes()) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Could not prepare the Set-up change: {error}"));
        }
        if let Err(error) = fs::copy(&destination, &backup) {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!("Could not back up the Set-up before importing: {error}"));
        }
        profile_paths = Some((staged, destination, backup));
    }

    let mut created = Vec::new();
    let commit_result = (|| -> Result<(), String> {
        for (staged, destination) in &planned {
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    format!("Could not create {}: {error}", parent.display())
                })?;
            }
            fs::rename(staged, destination).map_err(|error| {
                format!("Could not finish importing {}: {error}", destination.display())
            })?;
            created.push(destination.clone());
        }

        if let Some((staged, destination, backup)) = &profile_paths {
            fs::remove_file(destination)
                .map_err(|error| format!("Could not replace the selected Set-up: {error}"))?;
            if let Err(error) = fs::rename(staged, destination) {
                let _ = fs::rename(backup, destination);
                return Err(format!("Could not finish updating the selected Set-up: {error}"));
            }
        }
        Ok(())
    })();

    if let Err(error) = commit_result {
        for destination in created.iter().rev() {
            let _ = fs::remove_file(destination);
        }
        if let Some((_staged, destination, backup)) = &profile_paths {
            if backup.exists() {
                let _ = fs::remove_file(destination);
                let _ = fs::rename(backup, destination);
            }
        }
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }

    let _ = fs::remove_dir_all(&staging);
    project_snapshot(&canonical_root)
}
