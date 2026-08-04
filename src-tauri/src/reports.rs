//! The project list, and the sizes behind the delete button.
//!
//! **No readings.** They live in `.sanity/` in the repo (`assessment.rs`) and nowhere
//! else. This file used to hold a per-project store keyed by the repo's absolute path,
//! and the code for it is gone rather than disabled: a second home for readings meant
//! deleting the visible copy silently restored an older invisible one, and no amount of
//! care at the call site fixes a design where the user cannot tell which copy they are
//! looking at. Leaving the functions here for "just in case" is how that comes back.
//!
//! What remains is genuinely disposable — which projects have been opened, and how big
//! the score cache is.

use std::path::{Path, PathBuf};

/// Everything Sanity has written on this machine, for the panel that offers to delete it.
///
/// Reported as paths and a byte count rather than a single number: "clear 400K" is not a
/// sentence anyone can consent to, and the readings in there are the one part that cannot
/// be recomputed.
pub fn data_dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join("Sanity"))
}

/// Bytes under `dir`, following no symlinks and failing quietly. Used for the size shown
/// beside the delete button.
pub fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    entries
        .flatten()
        .map(|e| match e.file_type() {
            Ok(t) if t.is_dir() => dir_size(&e.path()),
            Ok(t) if t.is_file() => e.metadata().map(|m| m.len()).unwrap_or(0),
            _ => 0,
        })
        .sum()
}


// ── The project list ───────────────────────────────────────────────────────────

/// A project sanity has seen, enough to restore it.
///
/// Only the identity is stored — the scan is not. A scan is about a second of work and
/// would be stale the moment a file changed, so it is recomputed on restore; the thing
/// worth keeping is the fact that you were ever looking at this repo, plus its
/// assessments, which cannot be recomputed at all.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct KnownProject {
    pub key: String,
    pub repo: String,
    pub name: String,
    #[serde(default)]
    pub touched: u64,
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct KnownProjects {
    #[serde(default)]
    pub projects: Vec<KnownProject>,
    #[serde(default)]
    pub active: Option<String>,
}

fn index_path() -> Option<PathBuf> {
    let dir = dirs::data_dir()?.join("Sanity");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join("projects.json"))
}

pub fn load_index() -> KnownProjects {
    index_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_index(index: &KnownProjects) {
    let Some(path) = index_path() else { return };
    let Ok(json) = serde_json::to_string_pretty(index) else {
        return;
    };
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, json).is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
}
