use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkTargetState {
    schema_version: String,
    work_root: String,
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

fn state_path(rack_root: &Path) -> PathBuf {
    rack_root.join(".rack").join("work-target.json")
}

#[tauri::command]
pub(crate) fn read_work_target(rack_root: String) -> Result<Option<String>, String> {
    let rack_root = canonical_rack_root(rack_root)?;
    let path = state_path(&rack_root);
    if !path.exists() {
        return Ok(None);
    }

    let metadata = fs::symlink_metadata(&path)
        .map_err(|error| format!("Could not inspect Rack work-project state: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Rack work-project state is not an ordinary file.".to_string());
    }

    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Rack work-project state: {error}"))?;
    let state: WorkTargetState = serde_json::from_str(&content)
        .map_err(|error| format!("Rack work-project state is invalid JSON: {error}"))?;
    if state.schema_version != "0.1" {
        return Err("Rack work-project state uses an unsupported version.".to_string());
    }

    let work_root = match PathBuf::from(&state.work_root).canonicalize() {
        Ok(path) if path.is_dir() => path,
        _ => return Ok(None),
    };
    Ok(Some(work_root.to_string_lossy().to_string()))
}

#[tauri::command]
pub(crate) fn set_work_target(
    rack_root: String,
    work_root: String,
) -> Result<String, String> {
    let rack_root = canonical_rack_root(rack_root)?;
    let work_root = canonical_work_root(work_root)?;
    let path = state_path(&rack_root);
    let parent = path
        .parent()
        .ok_or_else(|| "Rack work-project state has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not prepare Rack local metadata: {error}"))?;

    if path.exists() {
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Could not inspect Rack work-project state: {error}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err("Rack work-project state is not an ordinary file.".to_string());
        }
    }

    let state = WorkTargetState {
        schema_version: "0.1".to_string(),
        work_root: work_root.to_string_lossy().to_string(),
    };
    let content = serde_json::to_vec_pretty(&state)
        .map_err(|error| format!("Could not encode Rack work-project state: {error}"))?;
    let temporary = parent.join(format!(".work-target-{}.tmp", std::process::id()));
    fs::write(&temporary, content)
        .map_err(|error| format!("Could not prepare Rack work-project state: {error}"))?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not replace Rack work-project state: {error}"))?;
    }
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not finish Rack work-project state: {error}"))?;

    Ok(work_root.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn fixture() -> (PathBuf, PathBuf) {
        let base = std::env::temp_dir().join(format!(
            "rack-work-target-{}-{}",
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

    #[test]
    fn local_work_target_round_trips() {
        let (rack, work) = fixture();
        let selected =
            set_work_target(rack.to_string_lossy().to_string(), work.to_string_lossy().to_string())
                .unwrap();
        let read = read_work_target(rack.to_string_lossy().to_string())
            .unwrap()
            .unwrap();
        assert_eq!(PathBuf::from(selected), PathBuf::from(read));
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }

    #[test]
    fn missing_remembered_work_target_does_not_become_current() {
        let (rack, work) = fixture();
        set_work_target(rack.to_string_lossy().to_string(), work.to_string_lossy().to_string())
            .unwrap();
        fs::remove_dir_all(&work).unwrap();
        assert_eq!(
            read_work_target(rack.to_string_lossy().to_string()).unwrap(),
            None
        );
        let _ = fs::remove_dir_all(rack.parent().unwrap());
    }
}
