use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::{Component, Path, PathBuf},
};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceFile {
    path: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectSnapshot {
    root: String,
    manifest: SourceFile,
    modules: Vec<SourceFile>,
    profiles: Vec<SourceFile>,
}

fn relative_path(root: &Path, path: &Path) -> Result<String, String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|error| format!("Could not make a relative path: {error}"))?;

    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn collect_files(
    root: &Path,
    directory: &Path,
    extension: &str,
) -> Result<Vec<SourceFile>, String> {
    if !directory.exists() {
        return Ok(Vec::new());
    }

    let mut output = Vec::new();
    let entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not read {}: {error}", directory.display()))?;

    for entry in entries {
        let entry = entry.map_err(|error| format!("Could not read a folder entry: {error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Could not inspect {}: {error}", path.display()))?;

        if file_type.is_symlink() {
            continue;
        }

        if file_type.is_dir() {
            output.extend(collect_files(root, &path, extension)?);
        } else if file_type.is_file()
            && path.extension().and_then(|value| value.to_str()) == Some(extension)
        {
            output.push(SourceFile {
                path: relative_path(root, &path)?,
                content: fs::read_to_string(&path)
                    .map_err(|error| format!("Could not read {}: {error}", path.display()))?,
            });
        }
    }

    output.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(output)
}

fn project_snapshot(root: &Path) -> Result<ProjectSnapshot, String> {
    if !root.is_dir() {
        return Err("The selected path is not a folder.".to_string());
    }

    let manifest_path = root.join("rack.yaml");
    if !manifest_path.is_file() {
        return Err("This folder does not contain rack.yaml.".to_string());
    }

    Ok(ProjectSnapshot {
        root: root.to_string_lossy().to_string(),
        manifest: SourceFile {
            path: "rack.yaml".to_string(),
            content: fs::read_to_string(&manifest_path)
                .map_err(|error| format!("Could not read rack.yaml: {error}"))?,
        },
        modules: collect_files(root, &root.join("modules"), "md")?,
        profiles: collect_files(root, &root.join("profiles"), "yaml")?,
    })
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if value.trim().is_empty() || path.is_absolute() {
        return Err("Rack file paths must be non-empty and relative.".to_string());
    }

    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(format!("Rack file path is not safe: {value}"));
        }
    }

    Ok(path.to_path_buf())
}

fn safe_folder_name(value: &str) -> bool {
    let mut characters = value.chars();
    matches!(characters.next(), Some(first) if first.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
        })
}

fn editable_project_file(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = safe_relative_path(relative_path)?;
    let allowed = relative == Path::new("rack.yaml")
        || relative.starts_with("modules")
        || relative.starts_with("profiles");
    if !allowed {
        return Err("Only Rack manifests, instructions and Set-ups can be edited here.".to_string());
    }

    let requested = root.join(relative);
    let metadata = fs::symlink_metadata(&requested)
        .map_err(|error| format!("Could not inspect the source file: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Rack will only edit ordinary project files.".to_string());
    }

    let canonical = requested
        .canonicalize()
        .map_err(|error| format!("Could not open the source file: {error}"))?;
    if !canonical.starts_with(root) {
        return Err("The source file resolves outside the Rack folder.".to_string());
    }

    Ok(canonical)
}

#[tauri::command]
fn read_rack_project(path: String) -> Result<ProjectSnapshot, String> {
    let root = PathBuf::from(path)
        .canonicalize()
        .map_err(|error| format!("Could not open that folder: {error}"))?;
    project_snapshot(&root)
}

#[tauri::command]
fn create_rack_project(
    parent_path: String,
    folder_name: String,
    files: Vec<SourceFile>,
) -> Result<ProjectSnapshot, String> {
    let parent = PathBuf::from(parent_path)
        .canonicalize()
        .map_err(|error| format!("Could not open the chosen folder: {error}"))?;

    if !parent.is_dir() {
        return Err("The chosen location is not a folder.".to_string());
    }
    if !safe_folder_name(&folder_name) {
        return Err("Rack folder names must begin with a lower-case letter and contain only lower-case letters, numbers and hyphens.".to_string());
    }
    if files.is_empty() || !files.iter().any(|file| file.path == "rack.yaml") {
        return Err("A Rack project must include rack.yaml.".to_string());
    }

    let final_root = parent.join(&folder_name);
    if final_root.exists() {
        return Err(format!(
            "{} already exists. Choose another Rack name or location.",
            final_root.display()
        ));
    }

    let staging = parent.join(format!(
        ".rack-create-{}-{}",
        folder_name,
        std::process::id()
    ));
    if staging.exists() {
        return Err("A previous Rack creation attempt is still present. Remove it before trying again.".to_string());
    }

    fs::create_dir(&staging)
        .map_err(|error| format!("Could not prepare the Rack folder: {error}"))?;

    let result = (|| -> Result<(), String> {
        let mut seen = HashSet::new();
        for file in &files {
            let relative = safe_relative_path(&file.path)?;
            if !seen.insert(relative.clone()) {
                return Err(format!("Rack file appears more than once: {}", file.path));
            }

            let destination = staging.join(relative);
            if let Some(directory) = destination.parent() {
                fs::create_dir_all(directory).map_err(|error| {
                    format!("Could not create {}: {error}", directory.display())
                })?;
            }
            fs::write(&destination, file.content.as_bytes()).map_err(|error| {
                format!("Could not write {}: {error}", destination.display())
            })?;
        }
        Ok(())
    })();

    if let Err(error) = result {
        let _ = fs::remove_dir_all(&staging);
        return Err(error);
    }

    if let Err(error) = fs::rename(&staging, &final_root) {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("Could not finish creating the Rack: {error}"));
    }

    project_snapshot(&final_root)
}

#[tauri::command]
fn read_project_file(root: String, relative_path: String) -> Result<String, String> {
    let canonical_root = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the Rack folder: {error}"))?;
    project_snapshot(&canonical_root)?;
    let source = editable_project_file(&canonical_root, &relative_path)?;
    fs::read_to_string(source).map_err(|error| format!("Could not read the source file: {error}"))
}

#[tauri::command]
fn write_project_file(
    root: String,
    relative_path: String,
    content: String,
    expected_content: String,
) -> Result<ProjectSnapshot, String> {
    let canonical_root = PathBuf::from(root)
        .canonicalize()
        .map_err(|error| format!("Could not open the Rack folder: {error}"))?;
    project_snapshot(&canonical_root)?;
    let destination = editable_project_file(&canonical_root, &relative_path)?;
    let current = fs::read_to_string(&destination)
        .map_err(|error| format!("Could not read the current source: {error}"))?;

    if current != expected_content {
        return Err("This file changed outside Rack after you opened it. Close the editor, review the newer version and try again.".to_string());
    }

    let parent = destination
        .parent()
        .ok_or_else(|| "The source file has no parent folder.".to_string())?;
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "The source filename is not valid.".to_string())?;
    let temporary = parent.join(format!(
        ".rack-edit-{file_name}-{}.tmp",
        std::process::id()
    ));
    let backup = parent.join(format!(
        ".rack-edit-{file_name}-{}.bak",
        std::process::id()
    ));

    fs::write(&temporary, content.as_bytes())
        .map_err(|error| format!("Could not prepare the changed source: {error}"))?;
    fs::copy(&destination, &backup)
        .map_err(|error| format!("Could not back up the current source: {error}"))?;

    let replace_result = (|| -> Result<(), String> {
        fs::remove_file(&destination)
            .map_err(|error| format!("Could not replace the current source: {error}"))?;
        fs::rename(&temporary, &destination)
            .map_err(|error| format!("Could not finish saving the source: {error}"))?;
        Ok(())
    })();

    if let Err(error) = replace_result {
        let _ = fs::remove_file(&temporary);
        if !destination.exists() {
            let _ = fs::rename(&backup, &destination);
        }
        return Err(error);
    }

    let _ = fs::remove_file(&backup);
    project_snapshot(&canonical_root)
}

#[tauri::command]
fn write_generated_file(path: String, content: String) -> Result<(), String> {
    let destination = PathBuf::from(path);
    let parent = destination
        .parent()
        .ok_or_else(|| "Choose a destination inside a folder.".to_string())?
        .canonicalize()
        .map_err(|error| format!("Could not open the destination folder: {error}"))?;

    if destination.exists() {
        let metadata = fs::symlink_metadata(&destination)
            .map_err(|error| format!("Could not inspect the destination: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(
                "Rack will only replace an ordinary file chosen through the save dialog."
                    .to_string(),
            );
        }
    }

    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "The destination filename is not valid.".to_string())?;
    let temporary = parent.join(format!(
        ".rack-output-{file_name}-{}.tmp",
        std::process::id()
    ));

    fs::write(&temporary, content.as_bytes())
        .map_err(|error| format!("Could not write the temporary output: {error}"))?;

    if destination.exists() {
        fs::remove_file(&destination)
            .map_err(|error| format!("Could not replace the existing output: {error}"))?;
    }

    fs::rename(&temporary, &destination).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        format!("Could not finish writing the output: {error}")
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_rack_project,
            create_rack_project,
            read_project_file,
            write_project_file,
            write_generated_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Rack");
}
