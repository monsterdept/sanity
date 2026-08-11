//! Git history: the stability axis.
//!
//! Surprise alone can't tell a subtle algorithm from an incomprehensible mess — both are
//! unpredictable. Age and churn are what separate them, and without this module the
//! quadrants collapse and every finding reads "this code is weird" with no advice
//! attached.
//!
//! Everything here comes from **one** `git log` pass. The obvious implementation asks
//! git per file, which on a repo with a few thousand files means a few thousand process
//! spawns and turns a two-second scan into a two-minute one.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;

/// Commits within this many days count as churn. Deliberately short: the audience is
/// people whose repos grew ten thousand lines last month, and a year-long window would
/// call all of it stable.
const CHURN_WINDOW_DAYS: f32 = 90.0;

/// Cap on how far back we read. Full history on a large repo is the slowest thing in the
/// scan and the oldest commits change neither the churn window nor, in practice, the age
/// ranking — anything older than this is "old" for every purpose the UI has.
const MAX_COMMITS: usize = 5000;

/// Commits in the window at which a file counts as fully churning.
///
/// An **absolute** anchor, not a percentile of the repo's own files. Normalising against
/// the repo sounds more adaptive and is a trap: a single generated artefact — a
/// lockfile, a changelog, a vendored client — racks up hundreds of commits, becomes the
/// denominator, and squashes every hand-written file to nearly zero churn, which is
/// precisely backwards. With a fixed anchor the pathological file simply saturates at
/// 1.0, which is both true and harmless to everything else. Roughly a commit a week over
/// the quarter, which is a file someone is actively working on.
pub const CHURN_SATURATION: f32 = 8.0;

#[derive(Debug, Clone, Default)]
pub struct FileHistory {
    /// Commits in the window touching this file.
    pub recent_commits: u32,
    /// Days since the oldest commit we saw touching it.
    pub age_days: f32,
    /// Days since the newest.
    pub last_touched_days: f32,
    /// Oid of the newest commit touching this file.
    ///
    /// Collected here rather than asked for separately because this walk already knows it:
    /// `scancache` needs it to tell an unchanged file's blame from one that was reverted
    /// and reapplied — same bytes, same hash, different provenance — and a `git log` per
    /// file to find it out would cost more than the blame the cache exists to skip.
    pub last_commit: String,
    /// Who made that newest commit.
    ///
    /// This used to say blame would be more accurate but "costs a process per file". It
    /// does cost one, and that turned out to be 22ms — so `blame.rs` now reads per-line
    /// provenance for every file in parallel and functions carry their own author, age
    /// and churn. What is left here is the FILE-level answer, still used for files and
    /// directories and as the fallback wherever blame could not read a range.
    pub last_author: String,
}

#[derive(Debug, Default)]
pub struct History {
    files: HashMap<String, FileHistory>,
}

impl History {
    /// Normalised 0..1 churn for a repo-relative path. See [`CHURN_SATURATION`] for why
    /// the scale is absolute rather than relative to the repo.
    pub fn churn_of(&self, path: &str) -> f32 {
        let Some(h) = self.files.get(path) else {
            return 0.0;
        };
        (h.recent_commits as f32 / CHURN_SATURATION).clamp(0.0, 1.0)
    }

    /// Raw commits in the window. The normalised `churn_of` is what the maths uses; this
    /// is what a person can act on — "changed 14 times since May" means something,
    /// "churn 100%" does not.
    pub fn commits_of(&self, path: &str) -> u32 {
        self.files.get(path).map(|h| h.recent_commits).unwrap_or(0)
    }

    /// Days since the most recent commit touching this file.
    pub fn last_touched_of(&self, path: &str) -> Option<f32> {
        self.files.get(path).map(|h| h.last_touched_days)
    }

    /// Who last committed to this file.
    pub fn last_author_of(&self, path: &str) -> Option<String> {
        self.files
            .get(path)
            .map(|h| h.last_author.clone())
            .filter(|a| !a.is_empty())
    }

    /// How long ago the oldest commit touching this file landed.
    ///
    /// `None` when the file has no history — untracked, or not a git repo at all. A missing
    /// age must stay missing rather than defaulting to zero, because "brand new" is a claim
    /// that moves code into the Trouble quadrant.
    pub fn age_of(&self, path: &str) -> Option<f32> {
        self.files.get(path).map(|h| h.age_days)
    }

    /// Oid of the newest commit touching this path, if it fell inside the walked window.
    ///
    /// `None` is not "never committed" — it is "not in the last `MAX_COMMITS` commits",
    /// and `scancache` treats the two the same on purpose: a file untouched for five
    /// thousand commits cannot have its blame change without the history being rewritten,
    /// which is detected separately and wholesale.
    pub fn last_commit_of(&self, path: &str) -> Option<&str> {
        self.files
            .get(path)
            .map(|h| h.last_commit.as_str())
            .filter(|c| !c.is_empty())
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }
}

/// Read history for `repo`. Never fails: a directory that isn't a git repo is a
/// perfectly reasonable thing to scan, it just scores without the stability axis.
pub fn read(repo: &Path) -> History {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args([
            "log",
            "--no-merges",
            // \x01 starts a commit, \x02 separates its fields: timestamp, author, oid.
            "--format=%x01%ct%x02%an%x02%H",
            "--name-only",
            &format!("--max-count={MAX_COMMITS}"),
        ])
        .output();

    let Ok(out) = out else {
        return History::default();
    };
    if !out.status.success() {
        return History::default();
    }
    let text = String::from_utf8_lossy(&out.stdout);
    parse_log(&text, now_secs())
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Record one commit against one path — a file or a directory.
fn credit(
    files: &mut HashMap<String, FileHistory>,
    key: &str,
    age_days: f32,
    author: &str,
    oid: &str,
) {
    let e = files.entry(key.to_string()).or_default();
    if e.recent_commits == 0 && e.age_days == 0.0 {
        // First sighting, and git walks newest first, so this is the latest commit.
        e.last_touched_days = age_days;
        e.last_author = author.to_string();
        e.last_commit = oid.to_string();
    }
    if age_days <= CHURN_WINDOW_DAYS {
        e.recent_commits += 1;
    }
    // git log walks newest → oldest, so the last timestamp we see for a path is the
    // oldest one, which is the path's age.
    e.age_days = age_days;
}

/// Apply one commit's worth of changes, crediting every ancestor DIRECTORY exactly once.
///
/// Directories change when their files change, and this is the only place the distinct
/// commit set is still known — by the time the tree exists there are only per-file
/// counts, and summing those reports a commit touching twelve files in one directory as
/// twelve. The buffer per commit is what makes "once" possible.
fn flush_commit(
    files: &mut HashMap<String, FileHistory>,
    ts: i64,
    now: i64,
    author: &str,
    oid: &str,
    touched: &mut Vec<String>,
) {
    if ts == 0 || touched.is_empty() {
        touched.clear();
        return;
    }
    let age_days = ((now - ts) as f32 / 86_400.0).max(0.0);
    let mut dirs: HashSet<String> = HashSet::new();
    for path in touched.iter() {
        let mut cut = 0;
        while let Some(i) = path[cut..].find('/') {
            cut += i;
            dirs.insert(path[..cut].to_string());
            cut += 1;
        }
    }
    for path in touched.iter() {
        credit(files, path, age_days, author, oid);
    }
    for dir in dirs {
        credit(files, &dir, age_days, author, oid);
    }
    touched.clear();
}

/// Split out from `read` so the parsing — which is where the bugs live — is testable
/// without a git repo, and against a fixed clock.
///
/// This paragraph spent some time stranded above `credit`, two functions up, where
/// `leading_doc` correctly handed it over as `credit`'s own documentation — comments
/// adjacent to a definition are that definition's, and the extractor has no way to know
/// one of them is about something else. Two cold readers reported `credit` as documented
/// by a paragraph describing this function, independently, which is exactly the failure
/// the instrument is for: a doc that has drifted from its code reads hot, and says so.
fn parse_log(text: &str, now: i64) -> History {
    let mut files: HashMap<String, FileHistory> = HashMap::new();
    let mut commit_ts: i64 = 0;
    let mut author = String::new();
    let mut oid = String::new();
    let mut touched: Vec<String> = Vec::new();

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix('\u{1}') {
            // A new commit starts, so the previous one is complete.
            flush_commit(&mut files, commit_ts, now, &author, &oid, &mut touched);
            let (ts, rest) = rest.split_once('\u{2}').unwrap_or((rest, ""));
            // Author names contain almost anything, oids contain nothing; splitting from
            // the RIGHT keeps a name with a \x02 in it from eating the oid.
            let (who, id) = rest.rsplit_once('\u{2}').unwrap_or((rest, ""));
            commit_ts = ts.trim().parse().unwrap_or(0);
            author = who.trim().to_string();
            oid = id.trim().to_string();
            continue;
        }
        let path = line.trim();
        if path.is_empty() || commit_ts == 0 {
            continue;
        }
        touched.push(path.to_string());
    }
    flush_commit(&mut files, commit_ts, now, &author, &oid, &mut touched);

    History { files }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A directory changes when its files change — and a commit touching several files
    /// in the same directory is ONE commit for it. Summing the per-file counts, which is
    /// all the tree can do on its own, would say three here.
    #[test]
    fn a_commit_touching_three_files_counts_once_for_their_directory() {
        let now = 1_000 * DAY;
        let log = format!(
            "\u{1}{}\u{2}Ada\nsrc/a.rs\nsrc/b.rs\nsrc/c.rs\n",
            now - 2 * DAY
        );
        let h = parse_log(&log, now);
        assert_eq!(h.commits_of("src/a.rs"), 1);
        assert_eq!(h.commits_of("src"), 1, "one commit, not three");
    }

    /// ...and separate commits do accumulate, including through nested directories.
    #[test]
    fn directory_commits_accumulate_and_reach_every_ancestor() {
        let now = 1_000 * DAY;
        let log = format!(
            "\u{1}{}\u{2}Ada\na/b/one.rs\n\u{1}{}\u{2}Ada\na/b/two.rs\n",
            now - 2 * DAY,
            now - 3 * DAY
        );
        let h = parse_log(&log, now);
        assert_eq!(h.commits_of("a/b/one.rs"), 1);
        assert_eq!(h.commits_of("a/b"), 2);
        assert_eq!(h.commits_of("a"), 2, "ancestors are credited too");
        // Newest first: the directory was last touched by the 2-day-old commit.
        assert_eq!(h.last_touched_of("a/b").map(|d| d.round()), Some(2.0));
    }

    const DAY: i64 = 86_400;

    #[test]
    fn oldest_commit_sets_age_and_recent_ones_set_churn() {
        let now = 1_000 * DAY;
        // Newest first, exactly as git log emits it.
        let log = format!(
            "\u{1}{}\u{2}Ada\nsrc/a.rs\n\u{1}{}\u{2}Grace\nsrc/a.rs\nsrc/b.rs\n\u{1}{}\u{2}Ada\nsrc/a.rs\n",
            now - DAY,
            now - 10 * DAY,
            now - 400 * DAY,
        );
        let h = parse_log(&log, now);
        // a.rs first appeared 400 days ago even though it was touched yesterday.
        assert_eq!(h.age_of("src/a.rs"), Some(400.0));
        assert_eq!(h.age_of("src/b.rs"), Some(10.0));
        assert_eq!(h.age_of("src/missing.rs"), None);
        // The newest commit's author, not the oldest — "who would I ask about this".
        assert_eq!(h.last_author_of("src/a.rs").as_deref(), Some("Ada"));
        assert_eq!(h.last_author_of("src/b.rs").as_deref(), Some("Grace"));
        // Two of a.rs's three commits are inside the 90-day window; the 400-day one isn't.
        assert!(h.churn_of("src/a.rs") > h.churn_of("src/b.rs"));
    }

    #[test]
    fn one_pathological_file_does_not_squash_the_rest() {
        // A generated lockfile touched 500 times must not make real source look static.
        // The absolute scale makes this structurally impossible rather than merely
        // unlikely — the lockfile saturates and affects nothing else.
        let now = 1_000 * DAY;
        let mut log = String::new();
        for i in 0..500 {
            log.push_str(&format!("\u{1}{}\u{2}Bot\nCargo.lock\n", now - (i % 80) * DAY));
        }
        for i in 0..10 {
            log.push_str(&format!("\u{1}{}\u{2}Ada\nsrc/hot.rs\n", now - (i % 80) * DAY));
        }
        let h = parse_log(&log, now);
        assert_eq!(h.churn_of("Cargo.lock"), 1.0);
        assert!(
            h.churn_of("src/hot.rs") > 0.5,
            "real source flattened to {}",
            h.churn_of("src/hot.rs")
        );
    }

    #[test]
    fn churn_saturates_rather_than_running_away() {
        let now = 1_000 * DAY;
        let log = "\u{1}".to_string() + &format!("{}\u{2}Ada\nsrc/a.rs\n", now - DAY).repeat(1);
        let h = parse_log(&log, now);
        assert!((0.0..=1.0).contains(&h.churn_of("src/a.rs")));
    }

    #[test]
    fn a_directory_that_is_not_a_repo_scores_without_history() {
        let h = read(Path::new("/definitely/not/a/repo"));
        assert!(h.is_empty());
        assert_eq!(h.churn_of("anything"), 0.0);
        assert_eq!(h.age_of("anything"), None);
    }
}
