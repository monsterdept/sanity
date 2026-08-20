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
    /// Which coding agent `sanity check` runs readers with here, as `sanity init` set it.
    ///
    /// Machine-local rather than in `.sanity/`, and the split is the same one the score
    /// cache follows from the other side: the repo holds what cannot be recomputed and is
    /// true for everybody, while which CLI you have installed is true for this laptop.
    /// Committing it would put one person's `codex` in everybody else's checkout.
    ///
    /// `default` here is not the hazard the same annotation is on a cached record. There,
    /// absent silently meant "this repo has no file header" when it had one, and every
    /// reader was handed less than the code believed. Here absent means nothing is
    /// configured, which is exactly what it means, and the only thing downstream of it
    /// says so and stops.
    #[serde(default)]
    pub harness: Option<String>,
    /// How many files the last scan found, so a restore can tell a big repo from a small one
    /// before it opens either — see `BIG_REPO_FILES`.
    ///
    /// Last time's count, not this time's, and that is the point: the alternative is walking
    /// every repo at launch to learn a number the previous scan already computed, which is a
    /// full directory walk per project to decide an ordering question. A repo that has grown
    /// or shrunk across the boundary is misfiled for exactly one launch and corrects itself
    /// when that scan lands.
    ///
    /// `None` means "never scanned here", which is a real third answer rather than zero — and
    /// it is no longer GUESSED at. It used to be treated as small, on the sound argument that
    /// somebody who has just added a repo is watching it and must not wait behind an hour of
    /// linux. The case that argument misses is the unknown repo that is enormous: ladybird
    /// arrived unmeasured, took the small lane and held it at 7,646 files while five repos of
    /// a few hundred each queued behind the lane that exists to protect them. `restore` walks
    /// an unknown repo before laning it and banks the count here, which costs the cheapest
    /// phase of a scan and turns the assignment into a measurement.
    #[serde(default)]
    pub files: Option<usize>,
    /// Which model reads this repo, when it has no readings yet to say so.
    ///
    /// A starting point, not the authority. Once a repo holds readings, what they were
    /// actually taken by is the answer — see `ProjectSummary::banked_model` — because that
    /// is a fact that travels with the repo, while this is one laptop's preference and two
    /// people could set it differently without either of them seeing the other.
    #[serde(default)]
    pub model: Option<String>,
}

/// Which agent is configured for a project, if any.
pub fn harness_for(key: &str) -> Option<String> {
    load_index()
        .projects
        .into_iter()
        .find(|p| p.key == key)
        .and_then(|p| p.harness)
        .filter(|h| !h.is_empty())
}

/// Record the agent to read this project with, creating the entry if this is the first
/// time the repo has been named.
pub fn set_harness(key: &str, repo: &str, name: &str, harness: &str) {
    set_reader(key, repo, name, Some(harness), None)
}

/// Which model is configured for a project, if any.
pub fn model_for(key: &str) -> Option<String> {
    load_index()
        .projects
        .into_iter()
        .find(|p| p.key == key)
        .and_then(|p| p.model)
        .filter(|m| !m.is_empty())
}

/// Put a project in the index the moment it is added, before its first scan lands.
///
/// **A project used to reach disk only through `touch`, which runs when the scan RETURNS.**
/// That is fine for a repo scanned in a second and wrong for one that is not: linux takes
/// hours on its first pass, so every quit before it finished lost the project outright —
/// the row vanished, and it had to be added again, to scan again from the beginning. The
/// index is a list of repos to reopen, and a repo somebody deliberately added is on that
/// list from the moment they added it; whether its first scan has finished is a fact about
/// this session, not about whether they meant to add it.
///
/// `touched: 0` because the ordering is recency of USE and this has not been used yet — it
/// sorts last until `touch` gives it a real clock, which is the honest position for a row
/// whose scan has not landed.
///
/// Idempotent: an entry that is already there is left exactly as it is, so re-adding a
/// project cannot reset the harness and model somebody configured for it.
pub fn remember(key: &str, repo: &str, name: &str) {
    let mut index = load_index();
    if index.projects.iter().any(|p| p.key == key) {
        return;
    }
    index.projects.push(KnownProject {
        key: key.to_string(),
        repo: repo.to_string(),
        name: name.to_string(),
        touched: 0,
        files: None,
        harness: None,
        model: None,
    });
    save_index(&index);
}

/// Record how big a repo is, as soon as the walk knows — see `KnownProject::files`.
///
/// **Written seconds in rather than when the scan lands, because the scan may never land.**
/// The size was recorded by `persist`, which runs on a completed scan — so linux, at hours a
/// pass and interrupted every time, never recorded one, and the lane split that exists for
/// exactly that repo could never engage. The repo that most needs classifying was the one
/// least likely to finish. The walk produces the count in the first seconds; a quit after
/// that still leaves it behind, and the next launch knows what it is dealing with.
///
/// This is the WALKED count, an upper bound on the parsed one — 65,757 against 45,272 on
/// linux — and `persist` replaces it with the real figure when a scan does complete. The gap
/// between them is nowhere near the threshold it feeds, so neither answer changes a lane.
///
/// Silent when the project is not in the index: nothing is created here, because a size is a
/// fact ABOUT a listing rather than a reason to make one.
pub fn note_size(key: &str, files: usize) {
    let mut index = load_index();
    let Some(p) = index.projects.iter_mut().find(|p| p.key == key) else {
        return;
    };
    if p.files == Some(files) {
        return;
    }
    p.files = Some(files);
    save_index(&index);
}

/// Record the agent and/or the model to read a project with.
///
/// `None` leaves a field alone rather than clearing it, so setting one does not silently
/// forget the other — the window sets both at once and the CLI sets one at a time.
pub fn set_reader(key: &str, repo: &str, name: &str, harness: Option<&str>, model: Option<&str>) {
    let mut index = load_index();
    if index.projects.iter().all(|p| p.key != key) {
        index.projects.push(KnownProject {
            key: key.to_string(),
            repo: repo.to_string(),
            name: name.to_string(),
            touched: 0,
            files: None,
            harness: None,
            model: None,
        });
    }
    if let Some(p) = index.projects.iter_mut().find(|p| p.key == key) {
        if let Some(h) = harness {
            p.harness = Some(h.to_string());
        }
        if let Some(m) = model {
            p.model = Some(m.to_string());
        }
    }
    save_index(&index);
}

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct KnownProjects {
    #[serde(default)]
    pub projects: Vec<KnownProject>,
    #[serde(default)]
    pub active: Option<String>,
    /// The sidebar's order, as project keys, when somebody has arranged it by hand.
    ///
    /// **Machine-local, like `harness` and `model`, and for the same reason**: which repo
    /// you want at the top is a fact about the person sitting here, not about any repo.
    ///
    /// Empty means nobody has arranged anything and the list falls back to what it always
    /// was — most recently touched first, so the sidebar reads as a history. A key here that
    /// no longer names a project is ignored rather than cleaned up: forgetting a project and
    /// adding it back should not cost the arrangement around it.
    #[serde(default)]
    pub order: Vec<String>,
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
