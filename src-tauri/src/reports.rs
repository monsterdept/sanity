//! Agent assessments, persisted per project.
//!
//! A report is minutes of an agent's reading. Keeping it only in memory would mean every
//! restart throws that away — and unlike a model score, it cannot be recomputed cheaply
//! or at all. Written through on each report rather than at exit, because the app being
//! killed is exactly the case worth surviving.

use crate::agentapi::Report;
use std::collections::HashMap;
use std::path::PathBuf;

fn fnv(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

fn path_for(key: &str) -> Option<PathBuf> {
    let dir = dirs::data_dir()?.join("Sanity").join("reports");
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(format!("{:016x}.json", fnv(key.as_bytes()))))
}

pub fn load(key: &str) -> HashMap<String, Report> {
    path_for(key)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(key: &str, reports: &HashMap<String, Report>) {
    let Some(path) = path_for(key) else { return };
    let Ok(json) = serde_json::to_string(reports) else {
        return;
    };
    // Temp-then-rename: a half-written file would lose every report, and the likeliest
    // moment to be interrupted is while the app is being killed.
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, json).is_ok() {
        let _ = std::fs::rename(&tmp, path);
    }
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
