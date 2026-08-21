//! Per-line history, so churn, age and blame mean something at the function level.
//!
//! `churn.rs` reads one `git log` pass and keys everything by file, which made three of
//! the five color lenses flat across the outer ring: every function in a file carried
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

/// Commits behind a function's lines at which it counts as fully worked over.
///
/// **Its own constant, at the same value as `churn::CHURN_SATURATION`, and the point is
/// that they can now move apart.** They are normalizers over two different quantities — a
/// rate over 90 days for a file, a count of surviving commits for a function — and one
/// constant meant that retuning the window's saturation silently moved the function axis
/// with it. Absolute rather than a percentile of the repo's own functions, for the reason
/// spelled out on `CHURN_SATURATION`: one generated file becomes the denominator and
/// squashes everything hand-written to nothing.
///
/// Eight was inherited rather than measured, so it has been measured. Share of
/// history-bearing functions at or above it:
///
/// | repo | n | median | p90 | p99 | max | ≥8 |
/// |---|---|---|---|---|---|---|
/// | krapow | 227 | 1 | 3 | 6 | 7 | 0.0% |
/// | tonepoet | 16,992 | 1 | 2 | 7 | 123 | 0.9% |
/// | sanity | 1,119 | 1 | 3 | 14 | 39 | 2.5% |
/// | VectorLand | 1,871 | 1 | 4 | 13 | 75 | 3.5% |
/// | ceph/src/mon | 2,095 | 2 | 10 | 36 | 342 | 14.3% |
///
/// A young repo puts nearly everything at one or two commits and an old one spreads; the
/// bright end stays rare and stays earned, which is what the constant is for. It is not
/// flat and it is not saturated, so there is no case here for moving it — what there was a
/// case for is being able to.
pub const TRACE_SATURATION: f32 = 8.0;

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
    /// Per-line provenance for every parsed file.
    ///
    /// `done` is called with each file as it is taken up, because this is the long phase of a
    /// scan on a large repo — one `git blame` per file, 29.4s across 2,518 C++ files — and a
    /// window with nothing to say for the length of it is what the sweeping bar was standing
    /// in for. It takes the PATH as well as counting, so the map can light the wedge; a
    /// fraction says how much is left and never where the work is.
    ///
    /// Called before the blame rather than after it, so the path names what is in flight.
    /// The count is therefore files STARTED — which for a bar with `rayon`'s width of
    /// concurrency is within a dozen of files finished, and is the honest reading of a live
    /// indicator either way.
    pub fn read(
        repo: &Path,
        paths: &[(String, u64)],
        history: &History,
        cache: &ScanCache,
        done: &(dyn Fn(&str) + Sync),
    ) -> Blame {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        let files = paths
            .par_iter()
            .map(|entry| {
                done(&entry.0);
                entry
            })
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

/// One commit that still has lines in a function, as the panel shows it.
///
/// The full identity, unlike [`Line::commit`] — that one is a 64-bit prefix because a
/// 2,000-line file holds one per line and it only ever has to be counted. This is read for one
/// function at a time, on a click, so it can afford the sha, the subject and the name.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Touch {
    /// Abbreviated to what a person pastes into `git show`.
    pub commit: String,
    pub author: String,
    /// Author time, seconds since the epoch. Formatted by the window, in the reader's own
    /// locale — a date rendered here would be rendered in the machine's.
    pub when: i64,
    /// The commit's subject line. Empty where git gave none.
    pub summary: String,
    /// How many of this range's lines still come from it.
    pub lines: u32,
}

/// One person's surviving share of a function.
#[derive(Debug, Clone, Serialize)]
pub struct Contributor {
    pub author: String,
    pub lines: u32,
}

/// Who wrote the lines that are in a function NOW, and which commits put them there.
///
/// **This is not a timeline of everybody who has touched it, and the difference matters.**
/// `git blame` reports the commit that last touched each LINE, so a function rewritten
/// wholesale reads as new and everyone whose lines were replaced is invisible. A true history
/// of a moving range is `git log -L`, which follows it through every diff and is a different
/// order of cost — see the module note, where the same trade is made for churn. What is here
/// is exactly what blame can support: the provenance of the code as it stands.
#[derive(Debug, Clone, Serialize)]
pub struct RangeDetail {
    /// Newest first, which is the order somebody reads a history in.
    pub touches: Vec<Touch>,
    /// Most lines first.
    pub authors: Vec<Contributor>,
    /// How many lines were actually blamed. Not `end - start`: the working tree may have moved
    /// since the scan cut this range, and a share is only honest against its own denominator.
    pub lines: u32,
}

/// Blame one function's line range, on demand.
///
/// **Its own git call, not a slice of the cached `FileBlame`.** The cache packs a line down to
/// a commit prefix, an author index and a time — everything the three lenses need to COLOR a
/// wedge, and nothing a person can read: no sha to look up, no subject line. Widening that
/// record would put a subject on every line of every file in a store that is already 300MB on
/// ceph, to serve a panel that opens on one function at a time.
///
/// `-L` bounds the work to the range, so this is a fraction of the 22ms a whole file costs.
/// Inclusive of both ends, 1-indexed, exactly as [`FileBlame::range`] is.
///
/// **`end` of zero is the whole file, and that is one command rather than two on purpose.**
/// The panel asks this of a file as well as of a function — a file has no line range, it IS
/// the range — and the question is the same question at two scopes. A second endpoint for it
/// would be two implementations of one answer, with the unwatched one going wrong.
pub fn range_detail(repo: &Path, path: &str, start: u32, end: u32) -> Option<RangeDetail> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo).args(["blame", "--line-porcelain"]);
    if end > 0 {
        let start = start.max(1);
        cmd.args(["-L", &format!("{},{}", start, end.max(start))]);
    }
    let out = cmd.args(["--", path]).output().ok()?;
    if !out.status.success() {
        return None;
    }
    Some(fold_porcelain(&String::from_utf8_lossy(&out.stdout)))
}

/// Fold `--line-porcelain` into per-commit and per-author totals.
///
/// **A commit's header fields appear once, on its first line, and never again.** Porcelain
/// repeats the `<sha> <orig> <final>` line for every line but only spells out `author` and
/// `summary` the first time it meets that commit — so anything that reads the fields per line
/// attributes every later line to whatever it saw last. That is why the metadata is kept by
/// sha and the count is kept by sha, rather than a single running record.
fn fold_porcelain(text: &str) -> RangeDetail {
    #[derive(Default, Clone)]
    struct Meta {
        author: String,
        when: i64,
        summary: String,
        lines: u32,
    }
    let mut by_commit: HashMap<String, Meta> = HashMap::new();
    // Insertion order, so two commits made in the same second keep the order git listed them
    // in rather than a hash's.
    let mut order: Vec<String> = Vec::new();
    let mut sha = String::new();
    let mut total = 0u32;
    for raw in text.lines() {
        if let Some(rest) = raw.strip_prefix("author ") {
            if let Some(m) = by_commit.get_mut(&sha) {
                m.author = rest.trim().to_string();
            }
        } else if let Some(rest) = raw.strip_prefix("author-time ") {
            if let Some(m) = by_commit.get_mut(&sha) {
                m.when = rest.trim().parse().unwrap_or(0);
            }
        } else if let Some(rest) = raw.strip_prefix("summary ") {
            if let Some(m) = by_commit.get_mut(&sha) {
                m.summary = rest.trim().to_string();
            }
        } else if raw.starts_with('\t') {
            // The source line closes the record, and is the only thing worth counting: the
            // header repeats, the fields do not.
            if let Some(m) = by_commit.get_mut(&sha) {
                m.lines += 1;
                total += 1;
            }
        } else {
            let Some(first) = raw.split(' ').next() else { continue };
            if first.len() < 16 || !first.as_bytes()[0].is_ascii_hexdigit() {
                continue;
            }
            sha = first.to_string();
            if !by_commit.contains_key(&sha) {
                by_commit.insert(sha.clone(), Meta::default());
                order.push(sha.clone());
            }
        }
    }

    let mut touches: Vec<Touch> = order
        .iter()
        .filter_map(|sha| by_commit.get(sha).map(|m| (sha, m)))
        .filter(|(_, m)| m.lines > 0)
        .map(|(sha, m)| Touch {
            // A range of zeros is git's word for a line that is not committed yet. Named
            // rather than shown as a sha nobody can look up — it is the one row in this list
            // that is about the working tree instead of the history.
            commit: if sha.bytes().all(|b| b == b'0') {
                "uncommitted".into()
            } else {
                sha[..sha.len().min(8)].to_string()
            },
            author: if m.author.is_empty() { "unknown".into() } else { m.author.clone() },
            when: m.when,
            summary: m.summary.clone(),
            lines: m.lines,
        })
        .collect();
    touches.sort_by_key(|t| std::cmp::Reverse(t.when));

    let mut per_author: HashMap<String, u32> = HashMap::new();
    for t in &touches {
        *per_author.entry(t.author.clone()).or_default() += t.lines;
    }
    let mut authors: Vec<Contributor> =
        per_author.into_iter().map(|(author, lines)| Contributor { author, lines }).collect();
    // By share, then by name, so a tie does not reshuffle between two openings of the panel.
    authors.sort_by(|a, b| b.lines.cmp(&a.lines).then_with(|| a.author.cmp(&b.author)));

    RangeDetail { touches, authors, lines: total }
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
/// neighbor.
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

    /// The `-L` path against real git, because the fold above is only half of it.
    ///
    /// **A parser test cannot catch the wrong command.** Everything else here is asserted on
    /// a literal porcelain sample, which is exactly as correct as the sample — a flag that
    /// bounds the wrong range, or a git that stops emitting `summary`, produces a perfectly
    /// parsed answer about the wrong lines. This makes two commits touch two halves of one
    /// file and asks for one half.
    #[test]
    fn a_range_is_blamed_against_the_lines_it_names() {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            std::process::Command::new("git")
                .arg("-C")
                .arg(dir.path())
                .args(args)
                .output()
                .expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "ada@example.com"]);
        git(&["config", "user.name", "Ada"]);
        std::fs::write(dir.path().join("a.rs"), "one\ntwo\n").expect("writes");
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "first pair"]);
        git(&["config", "user.name", "Grace"]);
        std::fs::write(dir.path().join("a.rs"), "one\ntwo\nthree\nfour\n").expect("writes");
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "second pair"]);

        let whole = range_detail(dir.path(), "a.rs", 0, 0).expect("blames");
        assert_eq!(whole.lines, 4, "`end` of 0 is the whole file");
        assert_eq!(whole.touches.len(), 2);
        assert_eq!(whole.authors.len(), 2);

        let tail = range_detail(dir.path(), "a.rs", 3, 4).expect("blames");
        assert_eq!(tail.lines, 2, "-L bounds it to the two lines asked for");
        assert_eq!(tail.touches.len(), 1, "only the second commit reaches them");
        assert_eq!(tail.touches[0].author, "Grace");
        assert_eq!(tail.touches[0].summary, "second pair", "the subject survives the fold");
        assert_eq!(tail.authors[0].lines, 2);

        let head = range_detail(dir.path(), "a.rs", 1, 2).expect("blames");
        assert_eq!(head.touches[0].author, "Ada", "the first pair is untouched by the second");
    }

    /// Porcelain spells a commit's fields out ONCE. Read per line, every later line of the
    /// same commit is attributed to whatever author was seen last — which in `SAMPLE` would
    /// put Ada's second line under Ada anyway, so the test uses a range where the two
    /// interleave.
    #[test]
    fn a_commits_fields_are_kept_by_sha_not_by_whatever_came_last() {
        const INTERLEAVED: &str = "\
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 1 1
author Ada
author-time 1000000
summary first
\tone
bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 2 2 1
author Grace
author-time 2000000
summary second
\ttwo
aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 3 3 1
\tthree
";
        let d = super::fold_porcelain(INTERLEAVED);
        assert_eq!(d.lines, 3);
        assert_eq!(d.touches.len(), 2, "two commits, three lines");
        // Newest first.
        assert_eq!(d.touches[0].commit, "bbbbbbbb");
        assert_eq!(d.touches[0].lines, 1);
        assert_eq!(d.touches[1].commit, "aaaaaaaa");
        assert_eq!(
            d.touches[1].lines, 2,
            "the header-only third line belongs to the commit it names",
        );
        assert_eq!(d.touches[1].author, "Ada", "and keeps its own author, not Grace's");
        assert_eq!(d.touches[1].summary, "first");
        assert_eq!(d.authors[0].author, "Ada", "most surviving lines first");
        assert_eq!(d.authors[0].lines, 2);
    }

    /// A line git has no commit for is the working tree, and is named rather than shown as
    /// forty zeroes somebody could try to look up.
    #[test]
    fn an_uncommitted_line_is_named_not_shown_as_a_sha() {
        const PENDING: &str = "\
0000000000000000000000000000000000000000 1 1 1
author Not Committed Yet
author-time 3000000
summary Version of a.rs from a.rs
\tedited
";
        let d = super::fold_porcelain(PENDING);
        assert_eq!(d.touches[0].commit, "uncommitted");
    }

    /// The header order follows the original file, so a function's lines must be placed
    /// by their FINAL line number or they land under a neighbor.
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
