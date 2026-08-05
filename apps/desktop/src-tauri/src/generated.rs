use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPromptBuild {
    artifact_content: Option<String>,
    manifest_content: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedBuildInstallResult {
    directory: String,
    backup_directory: Option<String>,
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

fn safe_profile_id(value: &str) -> bool {
    let mut characters = value.chars();
    matches!(characters.next(), Some(first) if first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn prompt_directory(root: &Path, profile_id: &str) -> Result<PathBuf, String> {
    if !safe_profile_id(profile_id) {
        return Err("The Set-up ID is not safe for a generated folder.".to_string());
    }
    Ok(root
        .join(".rack")
        .join("generated")
        .join("prompt")
        .join(profile_id))
}

fn read_optional_file(path: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_file() {
                return Err(format!(
                    "Generated path is not an ordinary file: {}",
                    path.display()
                ));
            }
            fs::read_to_string(path)
                .map(Some)
                .map_err(|error| format!("Could not read {}: {error}", path.display()))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not inspect {}: {error}", path.display())),
    }
}

#[tauri::command]
pub fn read_generated_prompt_build(
    root: String,
    profile_id: String,
) -> Result<InstalledPromptBuild, String> {
    let canonical_root = canonical_rack_root(root)?;
    let directory = prompt_directory(&canonical_root, &profile_id)?;

    Ok(InstalledPromptBuild {
        artifact_content: read_optional_file(&directory.join("system-prompt.md"))?,
        manifest_content: read_optional_file(&directory.join("build.json"))?,
    })
}

#[tauri::command]
pub fn install_generated_prompt_build(
    root: String,
    profile_id: String,
    files: Vec<GeneratedFile>,
) -> Result<GeneratedBuildInstallResult, String> {
    let canonical_root = canonical_rack_root(root)?;
    let final_directory = prompt_directory(&canonical_root, &profile_id)?;
    let generated_root = final_directory
        .parent()
        .ok_or_else(|| "Generated prompt folder has no parent.".to_string())?;

    let allowed: HashSet<&str> = ["system-prompt.md", "build.json"].into_iter().collect();
    let supplied: HashSet<&str> = files.iter().map(|file| file.path.as_str()).collect();
    if supplied != allowed || files.len() != allowed.len() {
        return Err(
            "A managed prompt build must contain system-prompt.md and build.json exactly once."
                .to_string(),
        );
    }

    fs::create_dir_all(generated_root)
        .map_err(|error| format!("Could not create the generated folder: {error}"))?;
    let staging = generated_root.join(format!(
        ".{profile_id}.tmp-{}",
        std::process::id()
    ));
    if staging.exists() {
        fs::remove_dir_all(&staging)
            .map_err(|error| format!("Could not clear the staging folder: {error}"))?;
    }
    fs::create_dir(&staging)
        .map_err(|error| format!("Could not prepare the generated build: {error}"))?;

    let result = (|| -> Result<GeneratedBuildInstallResult, String> {
        for file in &files {
            fs::write(staging.join(&file.path), file.content.as_bytes()).map_err(|error| {
                format!("Could not write generated file {}: {error}", file.path)
            })?;
        }

        let mut retained_backup: Option<PathBuf> = None;
        if final_directory.exists() {
            let metadata = fs::symlink_metadata(&final_directory)
                .map_err(|error| format!("Could not inspect the generated folder: {error}"))?;
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err(
                    "The generated destination is not an ordinary folder. Rack will not replace it."
                        .to_string(),
                );
            }

            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|error| format!("Could not create a backup timestamp: {error}"))?
                .as_millis();
            let backup = canonical_root
                .join(".rack")
                .join("backups")
                .join("prompt")
                .join(&profile_id)
                .join(format!("{timestamp}-{}", std::process::id()));
            if let Some(parent) = backup.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("Could not prepare the backup folder: {error}"))?;
            }
            fs::rename(&final_directory, &backup)
                .map_err(|error| format!("Could not retain the previous build: {error}"))?;
            retained_backup = Some(backup);
        }

        if let Err(error) = fs::rename(&staging, &final_directory) {
            if let Some(backup) = &retained_backup {
                let _ = fs::rename(backup, &final_directory);
            }
            return Err(format!("Could not finish installing the generated build: {error}"));
        }

        Ok(GeneratedBuildInstallResult {
            directory: final_directory.to_string_lossy().to_string(),
            backup_directory: retained_backup
                .map(|value| value.to_string_lossy().to_string()),
        })
    })();

    if result.is_err() {
        let _ = fs::remove_dir_all(&staging);
    }
    result
}
