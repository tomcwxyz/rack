use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
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
pub struct InstalledTargetBuild {
    artifact_contents: HashMap<String, Option<String>>,
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

fn safe_slug(value: &str, label: &str) -> Result<(), String> {
    let mut characters = value.chars();
    let valid = matches!(characters.next(), Some(first) if first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        });
    if valid {
        Ok(())
    } else {
        Err(format!("The {label} is not safe for a generated folder."))
    }
}

fn target_artifacts(target: &str) -> Result<Vec<&'static str>, String> {
    match target {
        "prompt" => Ok(vec!["system-prompt.md"]),
        "agents-md" => Ok(vec!["AGENTS.md"]),
        _ => Err(format!(
            "{target} does not yet have a desktop build adapter."
        )),
    }
}

fn target_directory(
    root: &Path,
    target: &str,
    profile_id: &str,
) -> Result<PathBuf, String> {
    safe_slug(target, "destination ID")?;
    safe_slug(profile_id, "Set-up ID")?;
    target_artifacts(target)?;
    Ok(root
        .join(".rack")
        .join("generated")
        .join(target)
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

// The command names retain their Iteration 3 prompt wording for IPC compatibility.
// Passing `target` selects the destination-neutral implementation.
#[tauri::command]
pub fn read_generated_prompt_build(
    root: String,
    profile_id: String,
    target: Option<String>,
) -> Result<InstalledTargetBuild, String> {
    let target = target.unwrap_or_else(|| "prompt".to_string());
    let canonical_root = canonical_rack_root(root)?;
    let directory = target_directory(&canonical_root, &target, &profile_id)?;
    let mut artifact_contents = HashMap::new();

    for artifact in target_artifacts(&target)? {
        artifact_contents.insert(
            artifact.to_string(),
            read_optional_file(&directory.join(artifact))?,
        );
    }

    Ok(InstalledTargetBuild {
        artifact_contents,
        manifest_content: read_optional_file(&directory.join("build.json"))?,
    })
}

#[tauri::command]
pub fn install_generated_prompt_build(
    root: String,
    profile_id: String,
    files: Vec<GeneratedFile>,
    target: Option<String>,
) -> Result<GeneratedBuildInstallResult, String> {
    let target = target.unwrap_or_else(|| "prompt".to_string());
    let canonical_root = canonical_rack_root(root)?;
    let final_directory = target_directory(&canonical_root, &target, &profile_id)?;
    let generated_root = final_directory
        .parent()
        .ok_or_else(|| "Generated destination folder has no parent.".to_string())?;

    let expected: HashSet<String> = target_artifacts(&target)?
        .into_iter()
        .map(str::to_string)
        .chain(std::iter::once("build.json".to_string()))
        .collect();
    let supplied: HashSet<String> = files.iter().map(|file| file.path.clone()).collect();
    if supplied != expected || files.len() != expected.len() {
        return Err(format!(
            "A managed {target} build contains an unexpected or duplicate file."
        ));
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
                .join(&target)
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
