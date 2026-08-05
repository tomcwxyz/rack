use serde::Serialize;
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Serialize)]
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

#[tauri::command]
fn read_rack_project(path: String) -> Result<ProjectSnapshot, String> {
    let requested = PathBuf::from(path);
    let root = requested
        .canonicalize()
        .map_err(|error| format!("Could not open that folder: {error}"))?;

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
        modules: collect_files(&root, &root.join("modules"), "md")?,
        profiles: collect_files(&root, &root.join("profiles"), "yaml")?,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_rack_project])
        .run(tauri::generate_context!())
        .expect("error while running Rack");
}
