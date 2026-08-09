//! Per-line history, so churn, age and blame mean something at the function level.
//!
//! `churn.rs` reads one `git log` pass and keys everything by file, which made three of
//! the five colour lenses flat across the outer ring: every function in a file carried
//! its file's churn, its file's age and its file's last author, so the ring that holds
//! the actual findings had no internal variation at all in Churn, Age or Blame. The
//! rings looked like data and were a solid block per file.
//!
//! The reason it was file-keyed is written in `FileHistory::last_author`: *"Blame would
//! be more accurate per line, but it costs a process per file."* True, and measured
//! since: `git blame --line-porcelain` runs in **22ms** on a real Swift file, 1.9s for
//! all 89 of them serially and about 0.2s across the cores rayon is already using. That
//! is a rounding error against a scan, and it buys per-function resolution on three
//! lenses.
//!
//! # What churn means here, and how that differs
//!
//! A file's churn is *commits in the last 90 days touching this file*. That cannot be
//! recovered from blame, which reports only the commit that last touched each line —
//! reconstructing a window per function needs `git log -L`, which follows a moving line
//! range through every diff and is a different order of cost.
//!
//! So a function's churn is a different quantity: **how many distinct commits are still
//! alive in it.** A body assembled from twelve commits has been worked over twelve times
//! by people whose edits survive; one written once and left alone reads as one. It is not
//! windowed, so it does not decay — and for a function that is arguably the better
//! question, since "this was rewritten repeatedly" stays true whenever it happened.
//! The UI must not present the two as the same number, which is why this is stated here
//! and in the meter's own hint.
//!
//! # What it cannot see
//!
//! Renames and moves, without `-C -M`, which costs far more than the blame itself. A
//! function moved between files reads as brand new. The file-level numbers have always
//! had this limitation; per-function resolution just makes it easier to notice.

use crate::churn::History;
use crate::scancache::ScanCache;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;

/// One source line's provenance, packed small — a 2,000-line file holds 2,000 of these
/// and a repo holds a few hundred files.
///
/// The field names are abbreviated in the serialised form because `scancache` stores one
/// of these per source line: PrusaSlicer is 849k lines, and `"commit"`/`"author"`/`"time"`
/// spelled out cost more disk than the values they label.
#[derive(Clone, Copy, Serialize, Deserialize)]
struct Line {
    /// First 16 hex digits of the commit. Enough to count distinct commits in a range
    /// without keeping a string per line; a collision would need two commits in the same
    /// function sharing a 64-bit prefix.
    #[serde(rename = "c")]
    commit: u64,
    /// Index into `FileBlame::authors`.
    #[serde(rename = "a")]
    author: u16,
    /// Author time, epoch seconds.
    #[serde(rename = "t")]
    time: i64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FileBlame {
    /// Indexed by line number minus one.
    #[serde(rename = "l")]
    lines: Vec<Line>,
    #[serde(rename = "a")]
    authors: Vec<String>,
}

/// What one function's line range says about its history.
pub struct RangeHistory {
    /// Distinct commits still alive in the range. NOT the same as `FileHistory`'s
    /// windowed count — see the module docs.
    pub commits: u32,
    pub last_touched_days: f32,
    pub age_days: f32,
    pub last_author: String,
}

impl FileBlame {
    /// Collapse the lines of one function into the four facts the map needs.
    ///
    /// Inclusive of both ends, 1-indexed, and clamped — a function's recorded end line
    /// can outrun the blame when the working tree has moved on since the scan parsed it,
    /// and reading past the end must return what is there rather than nothing.
    pub fn range(&self, start: u32, end: u32, now: i64) -> Option<RangeHistory> {
        let lo = (start.max(1) as usize) - 1;
        let hi = (end.max(start) as usize).min(self.lines.len());
        let slice = self.lines.get(lo..hi)?;
        if slice.is_empty() {
            return None;
        }
        let mut commits: HashSet<u64> = HashSet::new();
        let mut newest = slice[0];
        let mut oldest = slice[0].time;
        for l in slice {
            commits.insert(l.commit);
            if l.time > newest.time {
                newest = *l;
            }
            oldest = oldest.min(l.time);
        }
        let days = |t: i64| ((now - t).max(0) as f32) / 86_400.0;
        Some(RangeHistory {
            commits: commits.len() as u32,
            last_touched_days: days(newest.time),
            // A lower bound, not the truth: blame reports the last commit to touch each
            // line, so a function rewritten wholesale reads as young. Stated rather than
            // hidden — the alternative is `git log -L` per function.
            age_days: days(oldest),
            last_author: self
                .authors
                .get(newest.author as usize)
                .cloned()
                .unwrap_or_default(),
        })
    }
}

#[derive(Default)]
pub struct Blame {
    files: HashMap<String, FileBlame>,
    pub now: i64,
}

impl Blame {
    pub fn get(&self, path: &str) -> Option<&FileBlame> {
        self.files.get(path)
    }

    /// Blame every file, in parallel, taking from `cache` whatever is still current.
    ///
    /// Failures are silent and per-file on purpose: an untracked file, a symlink, or a
    /// directory that is not a git repo at all should cost that file its per-function
    /// history and nothing else. The caller falls back to the file-level numbers, which
    /// is exactly what the map showed before this existed.
    ///
    /// A cache miss is not stored as a failure. `blame_file` returning `None` is the
    /// untracked-file case above, and writing that absence down would mean a file that
    /// gets committed tomorrow keeps its missing history until something else invalidates
    /// it — a cache is allowed to be slow, never to be wrong for longer than the thing it
    /// describes.
    pub fn read(repo: &Path, paths: &[(String, u64)], history: &History, cache: &ScanCache) -> Blame {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let files = paths
            .par_iter()
            .filter_map(|(p, hash)| {
                let want = history.last_commit_of(p);
                if let Some(b) = cache.cached_blame(p, *hash, want) {
                    return Some((p.clone(), b));
                }
                let b = blame_file(repo, p)?;
                cache.put_blame(p, Some(&b), want);
                Some((p.clone(), b))
            })
            .collect();
        Blame { files, now }
    }
}

fn blame_file(repo: &Path, path: &str) -> Option<FileBlame> {
    let out = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["blame", "--line-porcelain", "--", path])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    Some(parse_porcelain(&String::from_utf8_lossy(&out.stdout)))
}

/// Parse `git blame --line-porcelain`.
///
/// The format repeats a full header for every line: a `<sha> <orig> <final> [<n>]`
/// record, then key/value lines, then the source line prefixed with a tab. We only need
/// the sha, the author and the author time, and the final line number tells us where to
/// put them — which matters, because the header order follows the ORIGINAL file, not the
/// current one, and assuming sequential output puts a function's lines under its
/// neighbour.
fn parse_porcelain(text: &str) -> FileBlame {
    let mut lines: Vec<Line> = Vec::new();
    let mut authors: Vec<String> = Vec::new();
    let mut ids: HashMap<String, u16> = HashMap::new();

    let (mut commit, mut author, mut time, mut final_line) = (0u64, 0u16, 0i64, 0usize);
    for raw in text.lines() {
        if let Some(rest) = raw.strip_prefix("author ") {
            let name = rest.trim();
            author = *ids.entry(name.to_string()).or_insert_with(|| {
                authors.push(name.to_string());
                (authors.len() - 1) as u16
            });
        } else if let Some(rest) = raw.strip_prefix("author-time ") {
            time = rest.trim().parse().unwrap_or(0);
        } else if raw.starts_with('\t') {
            // The source line closes the record. Place it by its FINAL line number.
            if final_line > 0 {
                if lines.len() < final_line {
                    lines.resize(final_line, Line { commit: 0, author: 0, time: 0 });
                }
                lines[final_line - 1] = Line { commit, author, time };
            }
        } else {
            let mut it = raw.split(' ');
            let (Some(sha), Some(_orig), Some(fin)) = (it.next(), it.next(), it.next()) else {
                continue;
            };
            if sha.len() < 16 || !sha.as_bytes()[0].is_ascii_hexdigit() {
                continue;
            }
            let Ok(n) = fin.parse::<usize>() else { continue };
            commit = u64::from_str_radix(&sha[..16], 16).unwrap_or(0);
            final_line = n;
        }
    }
    FileBlame { lines, authors }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "\
a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 1 1 2
author Ada
author-mail <ada@example.com>
author-time 1000000
summary first
\tfn one() {
a1b2c3d4e5f60718293a4b5c6d7e8f9012345678 2 2
author Ada
author-time 1000000
\t}
ffffffffffffffff00000000000000000000000f 3 3 1
author Grace
author-mail <grace@example.com>
author-time 2000000
summary second
\tfn two() {}
";

    #[test]
    fn parses_a_commit_author_and_time_per_line() {
        let b = parse_porcelain(SAMPLE);
        assert_eq!(b.lines.len(), 3);
        assert_eq!(b.authors.len(), 2, "authors are interned, not repeated per line");

        // Lines 1-2 are one commit by Ada; line 3 is a different commit by Grace.
        let one = b.range(1, 2, 2_000_000).expect("range");
        assert_eq!(one.commits, 1);
        assert_eq!(one.last_author, "Ada");

        let both = b.range(1, 3, 2_000_000).expect("range");
        assert_eq!(both.commits, 2, "distinct commits alive in the range");
        assert_eq!(both.last_author, "Grace", "the most RECENT toucher, not the first");
        assert_eq!(both.last_touched_days, 0.0);
        assert!((both.age_days - 11.57).abs() < 0.1, "oldest line is ~11.6 days back");
    }

    /// The header order follows the original file, so a function's lines must be placed
    /// by their FINAL line number or they land under a neighbour.
    #[test]
    fn places_lines_by_their_final_number() {
        let out_of_order = "\
1111111111111111111111111111111111111111 9 3 1
author Ada
author-time 500
\tthird line
2222222222222222222222222222222222222222 1 1 1
author Grace
author-time 900
\tfirst line
";
        let b = parse_porcelain(out_of_order);
        assert_eq!(b.lines.len(), 3);
        assert_eq!(b.range(1, 1, 900).unwrap().last_author, "Grace");
        assert_eq!(b.range(3, 3, 900).unwrap().last_author, "Ada");
    }

    /// A range past the end of the blame returns what is there. The scan's idea of a
    /// file can outrun git's if the tree moved under it.
    #[test]
    fn a_range_past_the_end_is_clamped() {
        let b = parse_porcelain(SAMPLE);
        assert!(b.range(2, 999, 2_000_000).is_some());
        assert!(b.range(50, 60, 2_000_000).is_none(), "entirely past the end is nothing");
    }
}
