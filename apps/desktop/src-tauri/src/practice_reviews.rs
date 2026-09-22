use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const REVIEW_SCHEMA_VERSION: &str = "0.1";
const MAX_TEXT_LENGTH: usize = 8_000;
const MAX_REVIEWS: usize = 2_000;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeReviewRecord {
    schema_version: String,
    module_id: String,
    module_title: String,
    module_path: String,
    review_after: String,
    experiment_question: Option<String>,
    reflection: String,
    decision: String,
    reviewed_at: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PracticeReviewInput {
    module_id: String,
    module_title: String,
    module_path: String,
    review_after: String,
    experiment_question: Option<String>,
    reflection: String,
    decision: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PracticeReviewState {
    schema_version: String,
    reviews: Vec<PracticeReviewRecord>,
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

fn state_path(rack_root: &Path) -> PathBuf {
    rack_root.join(".rack").join("practice-reviews.json")
}

fn ordinary_file(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect Rack practice-review state: {error}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Err("Rack practice-review state is not an ordinary file.".to_string());
    }
    Ok(())
}

fn valid_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(index, value)| index == 4 || index == 7 || value.is_ascii_digit())
}

fn validate_text(value: &str, label: &str, required: bool) -> Result<(), String> {
    let trimmed = value.trim();
    if required && trimmed.is_empty() {
        return Err(format!("{label} cannot be empty."));
    }
    if trimmed.len() > MAX_TEXT_LENGTH {
        return Err(format!("{label} is too long for local review history."));
    }
    Ok(())
}

fn validate_input(input: &PracticeReviewInput) -> Result<(), String> {
    validate_text(&input.module_id, "Practice ID", true)?;
    validate_text(&input.module_title, "Practice title", true)?;
    validate_text(&input.module_path, "Practice path", true)?;
    validate_text(&input.reflection, "Review note", true)?;
    if !valid_date(&input.review_after) {
        return Err("Review date must use YYYY-MM-DD.".to_string());
    }
    if let Some(question) = &input.experiment_question {
        validate_text(question, "Learning question", false)?;
    }
    if !matches!(input.decision.as_str(), "keep" | "change" | "remove") {
        return Err("Review decision must be keep, change or remove.".to_string());
    }
    Ok(())
}

fn read_state(rack_root: &Path) -> Result<PracticeReviewState, String> {
    let path = state_path(rack_root);
    if !path.exists() {
        return Ok(PracticeReviewState {
            schema_version: REVIEW_SCHEMA_VERSION.to_string(),
            reviews: Vec::new(),
        });
    }

    ordinary_file(&path)?;
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Rack practice-review state: {error}"))?;
    let state: PracticeReviewState = serde_json::from_str(&content)
        .map_err(|error| format!("Rack practice-review state is invalid JSON: {error}"))?;
    if state.schema_version != REVIEW_SCHEMA_VERSION {
        return Err("Rack practice-review state uses an unsupported version.".to_string());
    }
    if state.reviews.len() > MAX_REVIEWS {
        return Err("Rack practice-review history is larger than the supported local limit.".to_string());
    }
    Ok(state)
}

fn write_state(rack_root: &Path, state: &PracticeReviewState) -> Result<(), String> {
    let path = state_path(rack_root);
    let parent = path
        .parent()
        .ok_or_else(|| "Rack practice-review state has no parent folder.".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not prepare Rack local metadata: {error}"))?;

    if path.exists() {
        ordinary_file(&path)?;
    }

    let content = serde_json::to_vec_pretty(state)
        .map_err(|error| format!("Could not encode Rack practice-review state: {error}"))?;
    let temporary = parent.join(format!(".practice-reviews-{}.tmp", std::process::id()));
    let backup = parent.join(format!(".practice-reviews-{}.bak", std::process::id()));

    fs::write(&temporary, content)
        .map_err(|error| format!("Could not prepare Rack practice-review state: {error}"))?;

    if path.exists() {
        fs::rename(&path, &backup)
            .map_err(|error| format!("Could not back up Rack practice-review state: {error}"))?;
    }

    if let Err(error) = fs::rename(&temporary, &path) {
        let _ = fs::remove_file(&temporary);
        if backup.exists() && !path.exists() {
            let _ = fs::rename(&backup, &path);
        }
        return Err(format!("Could not finish Rack practice-review state: {error}"));
    }

    if backup.exists() {
        let _ = fs::remove_file(&backup);
    }
    Ok(())
}

#[tauri::command]
pub(crate) fn read_practice_reviews(
    rack_root: String,
) -> Result<Vec<PracticeReviewRecord>, String> {
    let rack_root = canonical_rack_root(rack_root)?;
    Ok(read_state(&rack_root)?.reviews)
}

#[tauri::command]
pub(crate) fn save_practice_review(
    rack_root: String,
    review: PracticeReviewInput,
) -> Result<Vec<PracticeReviewRecord>, String> {
    validate_input(&review)?;
    let rack_root = canonical_rack_root(rack_root)?;
    let mut state = read_state(&rack_root)?;

    let reviewed_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "System clock is before the Unix epoch.".to_string())?
        .as_secs();

    state.reviews.push(PracticeReviewRecord {
        schema_version: REVIEW_SCHEMA_VERSION.to_string(),
        module_id: review.module_id.trim().to_string(),
        module_title: review.module_title.trim().to_string(),
        module_path: review.module_path.trim().to_string(),
        review_after: review.review_after,
        experiment_question: review
            .experiment_question
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        reflection: review.reflection.trim().to_string(),
        decision: review.decision,
        reviewed_at,
    });

    if state.reviews.len() > MAX_REVIEWS {
        let overflow = state.reviews.len() - MAX_REVIEWS;
        state.reviews.drain(0..overflow);
    }

    write_state(&rack_root, &state)?;
    Ok(state.reviews)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static NEXT_FIXTURE: AtomicU64 = AtomicU64::new(1);

    fn fixture() -> PathBuf {
        let rack = std::env::temp_dir().join(format!(
            "rack-practice-review-{}-{}",
            std::process::id(),
            NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&rack).unwrap();
        fs::write(rack.join("rack.yaml"), "schema_version: \"0.1\"\n").unwrap();
        rack
    }

    fn input(decision: &str) -> PracticeReviewInput {
        PracticeReviewInput {
            module_id: "practice.clear-writing".to_string(),
            module_title: "Clear writing".to_string(),
            module_path: "modules/clear-writing.md".to_string(),
            review_after: "2026-09-22".to_string(),
            experiment_question: Some("Did this make drafts clearer?".to_string()),
            reflection: "It reduced the amount of editing I needed afterwards.".to_string(),
            decision: decision.to_string(),
        }
    }

    #[test]
    fn review_history_round_trips_locally() {
        let rack = fixture();
        let saved = save_practice_review(
            rack.to_string_lossy().to_string(),
            input("keep"),
        )
        .unwrap();
        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].decision, "keep");

        let read = read_practice_reviews(rack.to_string_lossy().to_string()).unwrap();
        assert_eq!(read.len(), 1);
        assert_eq!(read[0].review_after, "2026-09-22");
        assert!(rack.join(".rack").join("practice-reviews.json").is_file());
        let _ = fs::remove_dir_all(rack);
    }

    #[test]
    fn invalid_decision_is_rejected() {
        let rack = fixture();
        let error = save_practice_review(
            rack.to_string_lossy().to_string(),
            input("auto-rewrite"),
        )
        .unwrap_err();
        assert!(error.contains("keep, change or remove"));
        assert!(!rack.join(".rack").join("practice-reviews.json").exists());
        let _ = fs::remove_dir_all(rack);
    }
}
