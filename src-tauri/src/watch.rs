//! Noticing that the repo moved.
//!
//! The map is a photograph. Everything else in this app is careful about that — `resync_changed`
//! re-cuts line positions before anything is handed out, the scan cache keys on mtime and length,
//! `.sanity/` records the body each reading was taken against — but nothing ever told the app that
//! the picture it was showing had gone out of date. You committed, and Blame went on reporting
//! sixty-nine lines as "Not Committed Yet" because that was true when the scan ran.
//!
//! **A stat probe, not a filesystem watcher, and that is a decision rather than a shortcut.**
//! `notify` is available and would deliver an event in milliseconds. Three things make it the
//! worse answer here:
//!
//! - **The delivery path is already 1.5s-granular.** The window learns about projects from a
//!   poll on that period, so an event arriving instantly still waits for the next tick. Instant
//!   detection buys nothing end to end unless a push is built as well, which is a second
//!   mechanism to keep in step with the first.
//! - **The walker already decides what counts.** `ignore::WalkBuilder` is what the scan itself
//!   uses, so a probe built on it inherits `.gitignore` for free and cannot disagree with the
//!   scan about which files are the user's code. A watcher would need that filter rebuilt, and
//!   a rebuilt filter is a second opinion about `node_modules`.
//! - **Recursive watches are platform behaviour.** FSEvents coalesces and can drop under load,
//!   inotify has per-user watch limits a large repo can exhaust, and both need a debounce whose
//!   correct value differs by platform. A stat walk behaves identically everywhere and is
//!   trivially testable.
//!
//! What it costs is a walk per project per tick: no parsing, no blame, no git, one `stat` per
//! file. That is milliseconds even on a repo of several thousand files, against the seconds a
//! real scan takes — which is why the probe is what runs on the timer and the scan is what runs
//! when the probe says something changed.

use std::path::Path;
use std::time::SystemTime;

/// A cheap summary of "what the repo looks like right now".
///
/// Two numbers rather than a list of files, because nothing needs to know WHICH file moved —
/// the scan cache works that out per file when it re-runs, and it works it out from the same
/// mtime and length this hashes. All this has to answer is "is it worth re-running".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Marks {
    /// Every in-scope file's path, modified time and length, hashed together.
    pub tree: u64,
    /// `.git/HEAD` and `.git/index`, hashed the same way.
    ///
    /// Separate from the tree because git's own files are hidden and the walker skips them —
    /// deliberately, since they are not the user's code — and because a commit, a pull, a
    /// checkout or a rebase can change every line's blame, age and churn without touching a
    /// single working-tree file. That is exactly the case a person notices first and the one
    /// the app was silent about.
    pub git: u64,
}

/// FNV-1a. The same shape as the two twins in `heuristic` and `assessment`, and unlike those it
/// carries nothing durable — a fingerprint that changed meaning between versions would cost one
/// spurious rescan, not a repo's readings — so this one is free to be the real constant.
fn hash(bytes: &[u8], mut h: u64) -> u64 {
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

const SEED: u64 = 0xcbf2_9ce4_8422_2325;

fn stamp(h: u64, meta: &std::fs::Metadata) -> u64 {
    let secs = meta
        .modified()
        .ok()
        .and_then(|m| m.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_nanos() as u64);
    hash(&secs.to_le_bytes(), hash(&meta.len().to_le_bytes(), h))
}

/// What this repo looks like, cheaply.
///
/// Walked with the scan's own settings — see `scan::collect_files`, which this deliberately
/// mirrors — so a file the scan would never look at cannot trigger a scan.
///
/// **`.sanity/` is excluded, and that exclusion is load-bearing.** Every reading writes it, so a
/// probe that watched it would fire on the app's own output: during a wave of readers that is a
/// rescan every few seconds, each one re-minting node ids under the leases those readers are
/// holding. The directory is the assessment's record, not the code being assessed, and nothing
/// in it can change what a scan would produce.
pub fn probe(repo: &Path) -> Marks {
    let mut tree = SEED;
    let walk = ignore::WalkBuilder::new(repo)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .parents(true)
        .require_git(false)
        .filter_entry(|e| e.file_name() != std::ffi::OsStr::new(".sanity"))
        .build();
    // Sorted by nothing: the walk order is stable for an unchanged tree, and a reordering
    // would at worst cost one rescan. Paying for a sort on every tick to avoid that would be
    // the expensive half of this function.
    for entry in walk.filter_map(Result::ok) {
        if !entry.file_type().is_some_and(|t| t.is_file()) {
            continue;
        }
        tree = hash(entry.path().as_os_str().as_encoded_bytes(), tree);
        if let Ok(meta) = entry.metadata() {
            tree = stamp(tree, &meta);
        }
    }

    let mut git = SEED;
    for name in ["HEAD", "index"] {
        if let Ok(meta) = std::fs::metadata(repo.join(".git").join(name)) {
            git = stamp(git, &meta);
        }
    }
    Marks { tree, git }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_edit_moves_the_marks_and_an_untouched_repo_does_not() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() {}\n").unwrap();
        let first = probe(dir.path());
        assert_eq!(first, probe(dir.path()), "nothing changed, nothing to say");

        std::fs::write(dir.path().join("a.rs"), "fn one() { go() }\n").unwrap();
        assert_ne!(first.tree, probe(dir.path()).tree, "an edit is a change");

        let grown = probe(dir.path());
        std::fs::write(dir.path().join("b.rs"), "fn two() {}\n").unwrap();
        assert_ne!(grown.tree, probe(dir.path()).tree, "a new file is a change");
    }

    /// The app writes `.sanity/` on every reading. A probe that watched it would fire on its
    /// own output, and each firing would re-mint the node ids the readers in flight are holding.
    #[test]
    fn writing_the_assessment_is_not_a_change_to_the_repo() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() {}\n").unwrap();
        let before = probe(dir.path());

        std::fs::create_dir_all(dir.path().join(".sanity")).unwrap();
        std::fs::write(dir.path().join(".sanity/README.md"), "# assessment\n").unwrap();
        assert_eq!(before, probe(dir.path()), "our own record is not the code");
    }

    /// A commit changes no working-tree file and changes every line's blame, age and churn.
    #[test]
    fn a_commit_moves_the_marks_without_touching_a_file() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/main\n").unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() {}\n").unwrap();
        let before = probe(dir.path());

        std::fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/other\n").unwrap();
        let after = probe(dir.path());
        assert_eq!(before.tree, after.tree, "no file moved");
        assert_ne!(before.git, after.git, "and yet the repo did");
    }
}
