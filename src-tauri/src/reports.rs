//! The project list, and the sizes behind the delete button.
//!
//! **No readings.** They live in `.sanity/` in the repo (`assessment.rs`) and nowhere
//! else. This file used to hold a per-project store keyed by the repo's absolute path,
//! and the code for it is gone rather than disabled: a second home for readings meant
//! deleting the visible copy silently restored an older invisible one, and no amount of
//! care at the call site fixes a design where the user cannot tell which copy they are
//! looking at. Leaving the functions here for "just in case" is how that comes back.
//!
//! What remains is the project list, and nothing else. There was briefly a panel that
//! itemised and deleted everything here — it existed because readings were invisible and
//! unreachable, and once they moved into the repo `rm -rf .sanity` (or `git checkout`)
//! does the same job with a diff you can read first.

use std::path::PathBuf;

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

/// Where sanity keeps its own files — the project index, the endpoint file, the score
/// cache. One resolver because there is one directory, and because the tests need to be
/// able to point it somewhere disposable.
///
/// `AppState::persist` writes the index on any `touch` or `focus`, so without a seam
/// every test that opens a project writes into the developer's real sidebar — it did,
/// leaving `/x` and `/y` in it pointing at temp dirs that no longer exist — and in CI
/// they wrote into the file another test was asserting about, which is what failed.
/// Redirecting `HOME`/`XDG_DATA_HOME` was tried and only half works: on Windows
/// `dirs::data_dir` asks the OS for the known folder and ignores the environment
/// entirely, so the Windows runner shared one index across every test regardless.
///
/// `SANITY_DATA_DIR` is a test seam, not configuration: nothing in the app, the CLI or
/// the shim sets it, and it is not documented as a knob.
pub fn data_dir() -> Option<PathBuf> {
    let dir = match std::env::var_os("SANITY_DATA_DIR") {
        Some(d) => PathBuf::from(d),
        None => dirs::data_dir()?.join("Sanity"),
    };
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir)
}

fn index_path() -> Option<PathBuf> {
    Some(data_dir()?.join("projects.json"))
}

pub fn load_index() -> KnownProjects {
    index_path()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write the index, atomically, and leave nothing behind if it fails.
///
/// Deliberately silent, and worth saying why, because the rule next door is the opposite:
/// a failed `.sanity/` write is reported and never absorbed, since that is an agent's
/// measured work and losing it quietly is the failure the whole store exists to avoid.
/// This file is not that. It is a list of which repos to reopen, recoverable by opening
/// one, and there is nobody to tell — `persist` runs on a state change with no caller
/// waiting on an answer. What a failure costs is a sidebar that forgets a project.
///
/// The temp file is cleaned up on a failed rename, which it was not: a full disk or a
/// crossed-device rename left a `projects.json.tmp` sitting beside the real index
/// forever, looking like a half-finished write nobody could date.
pub fn save_index(index: &KnownProjects) {
    let Some(path) = index_path() else { return };
    let Ok(json) = serde_json::to_string_pretty(index) else {
        return;
    };
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, json).is_ok() && std::fs::rename(&tmp, path).is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
}
