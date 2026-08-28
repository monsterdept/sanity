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

use std::path::{Path, PathBuf};

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
    /// What the last scan of this repo took, in milliseconds.
    ///
    /// **Beside `files`, because the pair is a rate**, and a rate is what lets the next launch
    /// price a scan before doing any of it: this many files at this many milliseconds each.
    /// Measured rather than assumed for the reason `churn::Bank::rate` gives one field over —
    /// the spread across repos is large, and it is larger still across BUILDS, since a debug
    /// binary parses several times slower than a release one. A measured rate learns that on
    /// its own; a constant would be wrong in one of the two forever.
    ///
    /// `None` means never scanned here, and a repo with no rate is priced from the corpus
    /// default — which is stated as an estimate rather than printed as a measurement.
    #[serde(default)]
    pub scan_ms: Option<u64>,
    /// How deep this repo's history was traced, last time somebody asked — `files` or `lines`.
    ///
    /// **A depth is bought once and should not have to be bought again.** A restore scans
    /// without git and then reads as much history as a budget allows, which is depth 1; the
    /// per-line pass is nobody's automatic, so a repo somebody had traced to the line came back
    /// after a restart asking to be traced again. It is not the same as `trace::Depth` on a
    /// live project, which is what the map is holding NOW: this is what to aim for, and it is
    /// only reached if the blame it needs is already cached — see `trace::relines`.
    #[serde(default)]
    pub trace_depth: Option<String>,
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
        scan_ms: None,
        trace_depth: None,
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

/// Record what a scan of this repo cost, so the next one can be priced — see
/// [`KnownProject::scan_ms`].
///
/// Written when a scan LANDS, unlike `note_size`, which is written seconds in: a rate needs
/// the whole of a scan to be a rate, and a scan that was interrupted describes nothing. So a
/// repo whose scan never finishes keeps whatever rate it had, and a repo that has never
/// finished one is priced from the corpus default and says so.
pub fn note_scan(key: &str, files: usize, ms: u64) {
    let mut index = load_index();
    let Some(p) = index.projects.iter_mut().find(|p| p.key == key) else {
        return;
    };
    if p.files == Some(files) && p.scan_ms == Some(ms) {
        return;
    }
    p.files = Some(files);
    p.scan_ms = Some(ms);
    save_index(&index);
}

/// Remember how deep this repo's history has been read — see [`KnownProject::trace_depth`].
pub fn note_trace(key: &str, depth: &str) {
    let mut index = load_index();
    let Some(p) = index.projects.iter_mut().find(|p| p.key == key) else {
        return;
    };
    if p.trace_depth.as_deref() == Some(depth) {
        return;
    }
    p.trace_depth = Some(depth.to_string());
    save_index(&index);
}

/// Record the agent and/or the model to read a project with.
///
/// `None` leaves a field alone rather than clearing it, so setting one does not silently
/// forget the other — the window sets both at once and the CLI sets one at a time.
///
/// **`name` and `repo` are used only when the entry is CREATED**, on the same rule `remember`
/// states: an entry that is already there is left as it is, so recording a harness cannot
/// quietly rewrite what a project is called or where it points. Nothing renames a project
/// today; if something ever does, it belongs in its own function rather than as a side effect
/// of this one, or setting a model would be a rename nobody asked for.
pub fn set_reader(key: &str, repo: &str, name: &str, harness: Option<&str>, model: Option<&str>) {
    let mut index = load_index();
    if index.projects.iter().all(|p| p.key != key) {
        index.projects.push(KnownProject {
            key: key.to_string(),
            repo: repo.to_string(),
            name: name.to_string(),
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
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
    /// Whether to explain what a scan and a trace are when somebody adds a repo big enough
    /// that its history will not be read unasked.
    ///
    /// **Machine-local, and it hides the EXPLANATION rather than the choice.** A checkbox that
    /// also granted standing permission would be a one-click blanket over the CPU spending the
    /// budget exists to gate — so with this off, a big repo still arrives with its history
    /// unread and its own row still says so. That is what makes it safe to tick.
    ///
    /// `None` is the default and means yes: somebody who has never seen the dialog has not
    /// dismissed it.
    #[serde(default)]
    pub explain_trace: Option<bool>,
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

/// How long an abandoned cache slot is kept before a live build sweeps it up.
///
/// Long, because the thing being kept is the OTHER build's answer and the only evidence
/// that build is gone is that nothing has written its slot. A release app and a dev build
/// are both in use for weeks at a time, and evicting one to save disk buys a rescan of a
/// large repo at the exact moment somebody switches back — which is the failure the slots
/// exist to close.
const KEEP_SLOTS: std::time::Duration = std::time::Duration::from_secs(30 * 24 * 60 * 60);

/// Where `kind`'s cache for `repo` lives, under `tag`.
///
/// **The tag is what stops two builds evicting each other.** Every machine-local cache here
/// is invalidated by a version — the format it is written in, the parser that produced it —
/// and the name used to say none of them, so one slot per repo was shared by every build
/// that had ever run. A release app and a dev build one `PARSE_VERSION` apart each found the
/// other's file, correctly refused it, and wrote its own over the top: alternating between
/// them cost a full parse and a full blame pass every single time, on both sides, forever.
/// Measured on ceph, that is minutes an open should not have cost.
///
/// The version therefore goes in the NAME, so a refusal costs a lookup rather than the file.
/// What a tag has to contain is exactly what the reader gates on — see the callers.
///
/// The repo path is hashed rather than escaped: it holds separators and characters that are
/// illegal in a filename on at least one platform we ship to.
pub fn cache_slot(kind: &str, repo: &Path, tag: &str) -> Option<PathBuf> {
    let dir = data_dir()?.join(kind);
    std::fs::create_dir_all(&dir).ok()?;
    Some(dir.join(format!("{:016x}-{tag}", slot_hash(repo))))
}

/// Say that this slot is still somebody's, so the OTHER build's sweep spares it.
///
/// **A build never needs this for itself** — [`prune_slots`] refuses to touch the tag it was
/// called with, whatever its age. What it cannot see is whether the neighbouring tag belongs
/// to something still in use, and there the only evidence is the file's own clock.
///
/// **Age therefore has to mean "not used", and a write is not the only use.** Every cache
/// here has a path where a hit costs nothing and writes nothing — a tree whose signature
/// still matches is read and returned, a timeline with no new commits is loaded and left
/// alone — so a repo that has stopped CHANGING stops touching its files while being opened
/// every day. Written-only, a sweep would eventually take a neighbour's cache that is
/// current, in use, and about to be rebuilt at exactly the cost these slots exist to avoid.
///
/// One `utimes` per open, silent on failure: what it protects is a rebuild, not an answer.
pub fn mark_used(path: &Path) {
    if let Ok(f) = std::fs::File::options().write(true).open(path) {
        let _ = f.set_times(std::fs::FileTimes::new().set_modified(std::time::SystemTime::now()));
    }
}

/// Drop `repo`'s slots under any tag but this one, once they are old enough to be nobody's.
///
/// **Versioned names have to be swept or they only trade one cost for another.** Every bump
/// orphans a file per repo — on ceph the tree is 36MB and the scan log hundreds — where the
/// old shared name merely overwrote. Sweeping by tag alone would undo the point of the tags,
/// because the slot that is not this build's is the one being protected; so the rule is AGE,
/// and a build still in use rewrites its own slot on every scan that changes anything.
///
/// Silent throughout, on the rule the caches themselves follow: nothing here cannot be
/// derived again, so a failed removal costs disk and never an answer.
/// Every cache this app keeps for one repo, and the kinds it keeps them under.
///
/// Written out rather than discovered from the directory listing: a kind that stops being
/// used should disappear from here deliberately, and a new one that forgets to appear is a
/// reset that quietly leaves something behind — which is the failure a reset exists to fix.
const KINDS: [&str; 4] = ["trees", "scans", "traces", "timelines"];

/// Throw away everything derived for this repo, whatever build or window wrote it.
///
/// **The escape hatch for a cache that cannot notice it is wrong.** Every one of these
/// refuses itself on a version, a signature or a content hash, which covers the honest
/// cases — a parser that moved, a file that changed. What none of them can see is a build
/// whose bugs are since fixed: the bytes match, the version matches, and the answer is
/// simply the wrong one. That is what this is for, and it is why it takes no argument
/// finer than a repo.
///
/// It matches on the repo's hash and nothing else, so it takes every TAG with it — the
/// slot this build would write, the ones its neighbours wrote, and the leftovers of a
/// `--limit` experiment. Deliberately: a reset that spared another build's slot would leave
/// the next launch of that build answering from the file this was called to destroy.
///
/// **Readings are not here and never were.** They live in `.sanity/` inside the repo, which
/// this does not touch — that is the whole reason a reset can be offered without a
/// confirmation dialog.
pub fn forget_all(repo: &Path) {
    let Some(root) = data_dir() else { return };
    let hash = format!("{:016x}", slot_hash(repo));
    for kind in KINDS {
        let Ok(entries) = std::fs::read_dir(root.join(kind)) else { continue };
        for e in entries.flatten() {
            if e.file_name().to_string_lossy().starts_with(&hash) {
                // Best effort, like every other cache write here: a file we cannot remove
                // is one the next reader refuses on its own terms, which is where this
                // started.
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}

pub fn prune_slots(kind: &str, repo: &Path, tag: &str) {
    let Some(dir) = data_dir().map(|d| d.join(kind)) else { return };
    let hash = format!("{:016x}", slot_hash(repo));
    // Every sibling of the live slot: its `.slim.bin`, its `.links.bin`, an abandoned
    // `.tmp`. And the unsuffixed names of the builds that predate tagging, which nothing
    // else will ever look at again.
    let mine = format!("{hash}-{tag}.");
    let Ok(entries) = std::fs::read_dir(&dir) else { return };
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if !name.starts_with(&hash) || name.starts_with(&mine) {
            continue;
        }
        let old = e
            .metadata()
            .and_then(|m| m.modified())
            .map(|t| t.elapsed().map(|age| age > KEEP_SLOTS).unwrap_or(false))
            .unwrap_or(false);
        if old {
            let _ = std::fs::remove_file(e.path());
        }
    }
}

/// Named for FNV-1a's shape; the multiplier is not FNV-1a's prime. The twins in `cache.rs`
/// and `scancache.rs` say the same thing, and all of them stay wrong together rather than
/// one being quietly corrected into disagreeing with the others.
fn slot_hash(repo: &Path) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in repo.to_string_lossy().as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

/// Should the add dialog explain itself? See [`KnownProjects::explain_trace`].
pub fn explain_trace() -> bool {
    load_index().explain_trace.unwrap_or(true)
}

/// Remember that somebody has read it, or wants it back.
pub fn set_explain_trace(explain: bool) {
    let mut index = load_index();
    index.explain_trace = Some(explain);
    save_index(&index);
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

#[cfg(test)]
mod tests {
    use super::*;

    /// Two builds, one repo, and neither of them touching the other's answer.
    ///
    /// The failure this closes was measured rather than imagined: an installed app and a
    /// dev build one `PARSE_VERSION` apart shared `trees/<hash>.bin` and `scans/<hash>.json`,
    /// so every switch between them re-parsed and re-blamed ceph in full — minutes, both
    /// ways, indefinitely. What the name has to carry is whatever the reader refuses on.
    #[test]
    fn one_repo_under_two_tags_is_two_files() {
        let _home = crate::agentapi::tests::data_home();
        let repo = Path::new("/somewhere/ceph");
        let a = cache_slot("trees", repo, "p4v7").expect("a slot");
        let b = cache_slot("trees", repo, "p5v7").expect("a slot");
        assert_ne!(a, b, "a build one parser along must not land on this one's file");
        assert_eq!(a.parent(), b.parent(), "and both are still this repo's cache");
        assert_ne!(
            cache_slot("trees", Path::new("/somewhere/else"), "p4v7").expect("a slot"),
            a,
            "two repos under one tag are still two files"
        );
    }

    /// The sweep takes what is old and not this build's, and nothing else.
    ///
    /// **The tag alone would be the wrong rule**, and it is worth stating as a test: the slot
    /// that is not this build's is precisely the one the tags exist to protect. Age is what
    /// separates a build somebody still uses — it rewrites its slot on every scan that
    /// changes anything — from one that is gone.
    #[test]
    fn the_sweep_spares_the_other_build_until_it_is_abandoned() {
        let _home = crate::agentapi::tests::data_home();
        let repo = Path::new("/somewhere/ceph");
        let mine = cache_slot("trees", repo, "p4v7").expect("a slot").with_extension("bin");
        let slim = mine.with_extension("slim.bin");
        let theirs = cache_slot("trees", repo, "p3v7").expect("a slot").with_extension("bin");
        // The name every build shared before tagging, which nothing will look at again.
        let untagged = mine.with_file_name(
            mine.file_name().unwrap().to_string_lossy().replace("-p4v7", ""),
        );
        let elsewhere = cache_slot("trees", Path::new("/somewhere/else"), "p3v7")
            .expect("a slot")
            .with_extension("bin");
        for p in [&mine, &slim, &theirs, &untagged, &elsewhere] {
            std::fs::write(p, "x").unwrap();
        }

        prune_slots("trees", repo, "p4v7");
        for p in [&mine, &slim, &theirs, &untagged, &elsewhere] {
            assert!(p.exists(), "nothing written today is anybody's abandoned slot: {p:?}");
        }

        // Aged past the window, which is the only thing that makes a slot sweepable.
        let old = std::time::SystemTime::now() - KEEP_SLOTS - std::time::Duration::from_secs(60);
        for p in [&mine, &slim, &theirs, &untagged, &elsewhere] {
            std::fs::File::options()
                .write(true)
                .open(p)
                .unwrap()
                .set_times(std::fs::FileTimes::new().set_modified(old))
                .unwrap();
        }
        prune_slots("trees", repo, "p4v7");

        assert!(mine.exists(), "this build's own slot is never swept, however long it sat");
        assert!(slim.exists(), "nor the files beside it under the same tag");
        assert!(!theirs.exists(), "an abandoned build's slot goes");
        assert!(!untagged.exists(), "so does the name from before there were tags");
        assert!(elsewhere.exists(), "and another repo's cache was never this sweep's business");
    }
}
