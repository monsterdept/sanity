//! The repo replayed commit by commit: what the map looked like on its way here.
//!
//! The sunburst normally answers "what is this code like now". This answers "how did it
//! get like that" — the same rings, grown one commit at a time. Two rules shape
//! everything below, and both are the same rule the rest of the app follows: **say only
//! what the evidence supports, and pay for it once.**
//!
//! **Surprise is not replayed.** A function's temperature is a reading taken against the
//! code as it is now; stamping it onto the same function's 2019 body would be the map
//! claiming a measurement nobody took. So the history frames carry structure and dates
//! and nothing else, and what colors them is recency — how long, *as of the frame's own
//! date*, since anyone touched this. That is a fact about the commit stream, which is the
//! only thing this module actually reads.
//!
//! **Only changed files are re-parsed.** The obvious implementation checks out each
//! commit and scans the tree, which is a full scan per frame — minutes for a repo the
//! live map draws in a second. Instead the walk carries the parsed state forward and
//! re-parses exactly the files each commit touched, so the total work is the number of
//! file *versions* in the window (448 on this repo, against 44 whole trees) rather than
//! commits × files. One `git log`, one long-lived `git cat-file --batch`, and no
//! checkouts — the working tree is never touched, so this is safe to run while somebody
//! is editing.

use crate::model::Lang;
use crate::parse;
use crate::scan::Progress;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::time::{Duration, Instant};

/// Commits replayed, most recent first. Everything older becomes the opening frame.
///
/// How many commits a replay covers by default: **all of them**.
///
/// It was 400, then 5,000, and both were the same mistake at different sizes. 400 was
/// chosen against the scrub bar — at a thousand frames a pixel is four commits — which
/// traded away the thing the feature is for: a repo whose first 584 commits are folded into
/// frame one opens with its directory structure already built, so the story starts in the
/// middle and the map appears to have sprung up on day one. 5,000 only moved the number at
/// which that happens, and every repo old enough to be interesting hits it: ceph is 163,916
/// commits, so 97% of its life was the opening frame.
///
/// **What makes the whole log affordable is that nobody pays for it twice.** [`read_cached`]
/// pays the first replay once per repo and every later one costs the commits since. What it
/// does not make affordable is the FIRST one on a very large repo — at the ~17ms a commit
/// measured on tonepoet, ceph's log is on the order of an hour and a cache to match. That is
/// a real cost and it is the user's to spend: `just history --limit` and the `limit`
/// argument on the command both still bound it, and a bounded run still reports `truncated`
/// rather than quietly starting in the middle.
///
/// Deliberately unbounded. `churn.rs` used to cap its walk at five thousand commits, and this
/// was written to say why a story cannot take that cap: counting a 90-day window can drop the
/// oldest commits because they change nothing, while the beginning of a story IS the oldest
/// commits. That cap has since gone for a related reason — a capped total is a longer window
/// with no label on it — so churn walks whole now too, and the two agree by accident of
/// arriving at the same answer separately.
pub const ALL_COMMITS: usize = usize::MAX;

/// Blobs above this are the same vendored bundles and generated clients `scan` refuses,
/// caught here by size for the same reason: at a megabyte apiece they would dominate the
/// picture by area while saying nothing.
const MAX_BLOB_BYTES: u64 = 1_000_000;

/// A single line this long means minified or generated output — the same test `scan`
/// applies, and it has to be the same test.
///
/// Without it the timeline and the live map disagree about what the repo even contains:
/// this repo commits a bundled mascot placeholder whose 161 "functions" the scan refuses
/// and the replay happily drew, so history's HEAD held 769 functions against the map's
/// 472 and the largest wedge in the story was a file the map does not show.
const MINIFIED_LINE_BYTES: usize = 2_000;

/// Path segments holding somebody else's code. Kept in step with `scan::VENDORED` by
/// hand — history has no `.gitignore` walker to lean on, because the question here is
/// what was *committed*, and a vendored directory is committed on purpose.
const VENDORED: &[&str] = &["vendor", "vendored", "third_party", "thirdparty", "node_modules"];

/// One function, identified across its whole life.
///
/// Interned once and referred to by index everywhere else, because the same function
/// appears in every frame from the commit that introduced it onwards — spelling out its
/// path and name each time is most of the payload for none of the meaning.
///
/// Identity is `(path, owner, name, ord)` — the same shape as `assessment::key_of`, and
/// for the same reason: one file holds a dozen `parse`s, and a bare name collapses them
/// into a single wedge that flickers as the twins come and go.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFunc {
    /// Index into [`HistoryScan::paths`].
    pub path: u32,
    pub name: String,
    pub owner: Option<String>,
    /// Which of its file's same-named twins this is, by position — 1 for the first.
    ///
    /// Carried rather than left implicit in the intern key so a stored timeline can be
    /// RESUMED: continuing a replay means diffing new file versions against the old ones,
    /// which needs each function's identity back, and identity here is
    /// `(path, owner, name, ord)`. Without this the cache could only ever be all-or-
    /// nothing, and a single new commit would cost a whole re-parse.
    pub ord: u32,
}

/// One function's identity as a string — the key the walk diffs on.
///
/// Derived from the parts rather than stored beside them: two spellings of one identity
/// is the shape of every bug this file is careful about, and the one that would go wrong
/// here is silent (a resumed walk diffing against keys nobody can see).
fn key_of(path: &str, f: &HistoryFunc) -> String {
    let owner = f.owner.clone().unwrap_or_default();
    format!("{path}#{owner}::{}#{}", f.name, f.ord)
}

/// One commit, as the difference it made to the picture.
///
/// A delta rather than a snapshot. Snapshots are the obvious encoding and they are
/// quadratic in disguise: four hundred frames of a two-thousand-function repo is eight
/// hundred thousand entries on the wire to describe a few thousand actual changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryCommit {
    pub sha: String,
    pub short: String,
    /// Author date, seconds since the epoch. The frame's "now" — every age shown while
    /// this frame is up is measured from here, never from today.
    pub ts: i64,
    pub author: String,
    pub subject: String,
    /// Functions this commit introduced or resized, as `(func index, lines)`.
    pub set: Vec<(u32, u32)>,
    /// Functions this commit removed.
    pub del: Vec<u32>,
    /// Files this commit touched, as indices into `paths`.
    ///
    /// Not derivable from `set`/`del`: a commit can rewrite a function's body without
    /// changing its line count, which is a real edit that moves nothing. Without this the
    /// glow would skip exactly the commits that only changed what the code *says*.
    pub files: Vec<u32>,
}

/// A repo's history, ready to replay.
///
/// `Default` is the empty timeline — a repo with no commits traced yet, which the viewer's
/// door returns rather than refusing: a story nobody has walked is a story with no frames,
/// and the window already draws that honestly.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryScan {
    /// Repo-relative, forward-slashed. Referred to by index from everywhere else.
    pub paths: Vec<String>,
    /// Each path's language label, parallel to `paths`.
    pub langs: Vec<String>,
    pub funcs: Vec<HistoryFunc>,
    /// The state before the first frame — everything the truncated commits built.
    pub base: Vec<(u32, u32)>,
    /// When that state was reached, so the opening frame's ages have a "now" of their
    /// own rather than inheriting today's.
    pub base_ts: i64,
    pub commits: Vec<HistoryCommit>,
    /// The commit the last frame is. What lets a stored timeline be carried forward
    /// instead of recomputed — and what makes a rebase detectable rather than silently
    /// appended to.
    #[serde(default)]
    pub head: String,
    /// Commits before the window, folded into `base`. Counted out loud: a timeline that
    /// quietly starts in the middle reads as the whole life of the repo.
    pub truncated: usize,
}

/// Language for a repo path, or `None` if this is not a file the parser reads.
fn lang_of(path: &str) -> Option<Lang> {
    if path.split('/').any(|c| VENDORED.contains(&c)) {
        return None;
    }
    let ext = path.rsplit_once('.')?.1;
    Lang::from_extension(ext)
}

/// A long-lived `git cat-file --batch`.
///
/// One process for the whole walk. The alternative — `git show` per blob — is the same
/// mistake `churn` is written up against: a few thousand process spawns to read a few
/// thousand small files, which costs more than the parsing does.
///
/// Strictly request/response, one blob at a time. That is what makes it deadlock-free
/// without a writer thread: each request is a single short line and each response is read
/// to its end before the next request goes out, so neither pipe can fill.
struct Blobs {
    child: Child,
    /// An `Option` only so `Drop` can close it. `cat-file --batch` exits when its stdin
    /// reaches EOF, and killing it while the handle is still open leaves a process that
    /// is waiting for a request nobody will send.
    stdin: Option<ChildStdin>,
    stdout: BufReader<ChildStdout>,
}

impl Blobs {
    fn open(repo: &Path) -> Option<Blobs> {
        let mut child = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(["cat-file", "--batch"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()?;
        let stdin = child.stdin.take()?;
        let stdout = BufReader::new(child.stdout.take()?);
        Some(Blobs { child, stdin: Some(stdin), stdout })
    }

    /// The text of one blob, or `None` if it is missing, binary, or too big to be code.
    fn read(&mut self, sha: &str) -> Option<String> {
        let pipe = self.stdin.as_mut()?;
        writeln!(pipe, "{sha}").ok()?;
        pipe.flush().ok()?;

        let mut header = String::new();
        self.stdout.read_line(&mut header).ok()?;
        let mut parts = header.trim_end().split(' ');
        let _oid = parts.next()?;
        let kind = parts.next()?;
        if kind != "blob" {
            // "missing" and the like come back as a two-word line with no payload, so
            // there is nothing to drain — returning here keeps the stream in step.
            return None;
        }
        let size: u64 = parts.next()?.parse().ok()?;

        // The payload is always drained, even when it is unwanted. Leaving it in the pipe
        // desynchronises every later read by exactly one blob, which does not fail — it
        // silently attributes one file's functions to another.
        let mut buf = vec![0u8; size as usize + 1];
        self.stdout.read_exact(&mut buf).ok()?;
        if size > MAX_BLOB_BYTES {
            return None;
        }
        buf.pop();
        String::from_utf8(buf).ok()
    }
}

impl Drop for Blobs {
    fn drop(&mut self) {
        // Closing stdin is what tells `cat-file --batch` to exit; without it the wait
        // below blocks forever on a process that is still waiting for a request.
        self.stdin.take();
        let _ = self.child.wait();
    }
}

/// One function in one version of one file.
#[derive(Debug, Clone)]
struct FuncAt {
    /// Identity across commits — `path#owner::name#ord`.
    key: String,
    name: String,
    owner: Option<String>,
    /// Position among its file's same-named twins, from 1.
    ord: u32,
    loc: u32,
    /// This version's signature and body, hashed, so the next commit can tell whether this
    /// function CHANGED or merely sat in a file that did.
    ///
    /// `None` only after [`Replayer::resume`], which rebuilds the live state from stored
    /// frames and has no source text to hash. An unknown hash compares unequal, so the
    /// first appended commit re-reports the files it touches in full — one commit per file
    /// per resume, and never a wrong live state.
    ///
    /// Not persisted. It answers a question about two ADJACENT versions, and both of them
    /// are in hand whenever it is asked.
    hash: Option<u64>,
}

/// One file's functions at one moment, in file order.
type FileState = Vec<FuncAt>;

/// Interns `(path, owner, name, ord)` into a dense index space.
#[derive(Default)]
struct Funcs {
    index: BTreeMap<String, u32>,
    list: Vec<HistoryFunc>,
}

impl Funcs {
    fn intern(&mut self, path_idx: u32, f: &FuncAt) -> u32 {
        if let Some(i) = self.index.get(&f.key) {
            return *i;
        }
        let i = self.list.len() as u32;
        self.list.push(HistoryFunc {
            path: path_idx,
            name: f.name.clone(),
            owner: f.owner.clone(),
            ord: f.ord,
        });
        self.index.insert(f.key.clone(), i);
        i
    }
}

/// Parse one file version into its functions, keyed for identity across commits.
///
/// `ord` disambiguates same-named siblings by position, exactly as `assessment::key_of`
/// does. Without it a file's twelve `parse`s are one wedge, and the twelfth one's
/// arrival looks like the first one changing size.
fn functions_of(path: &str, lang: Lang, src: &str) -> FileState {
    let mut seen: BTreeMap<(Option<String>, String), u32> = BTreeMap::new();
    parse::parse_functions(lang, src)
        .into_iter()
        .map(|f| {
            let slot =
                seen.entry((f.owner.clone(), f.name.clone())).and_modify(|n| *n += 1).or_insert(1);
            let ord = *slot;
            let owned = f.owner.clone().unwrap_or_default();
            let key = format!("{path}#{owned}::{}#{ord}", f.name);
            // Signature AND body, verbatim. Not `reading_hash`'s whitespace-collapsing
            // hash: that one asks whether a READING is still valid, where a reflow changes
            // nothing; this one asks whether this commit touched this function, and a
            // commit that reformatted it did.
            let mut h = std::collections::hash_map::DefaultHasher::new();
            std::hash::Hash::hash(&f.signature, &mut h);
            std::hash::Hash::hash(&f.body, &mut h);
            let hash = Some(std::hash::Hasher::finish(&h));
            FuncAt { key, loc: f.loc(), ord, name: f.name, owner: f.owner, hash }
        })
        .collect()
}

/// One entry of a commit's `--raw` diff: the blob to read and where it lands.
#[derive(Clone)]
struct Change {
    path: String,
    /// The new blob, or `None` when the path was deleted.
    sha: Option<String>,
    /// The path this content moved off, for a rename.
    from: Option<String>,
}

/// Split a `--raw` line into the change it describes.
///
/// `:100644 100644 <src> <dst> <status>\t<path>[\t<path2>]`. Paths git considers unusual
/// arrive C-quoted; those are passed through as-is rather than unescaped, which is wrong
/// for the file's *name* and right for everything that matters here — the same string is
/// used for both sides of every comparison, so a file with a quoted name is consistently
/// itself.
fn parse_raw(line: &str) -> Option<Change> {
    let rest = line.strip_prefix(':')?;
    let (meta, paths) = rest.split_once('\t')?;
    let mut fields = meta.split_whitespace();
    let _src_mode = fields.next()?;
    let _dst_mode = fields.next()?;
    let _src_sha = fields.next()?;
    let dst_sha = fields.next()?;
    let status = fields.next()?;

    let mut names = paths.split('\t');
    let first = names.next()?.to_string();
    // `first()?`, not `[0]`. Every other field here is pulled with `?` and this one
    // indexed, so a `--raw` line with an empty status panicked the replay rather than
    // skipping a change it could not read.
    match *status.as_bytes().first()? {
        b'D' => Some(Change { path: first, sha: None, from: None }),
        b'R' | b'C' => {
            let to = names.next()?.to_string();
            Some(Change {
                path: to,
                sha: Some(dst_sha.to_string()),
                // A copy leaves the source in place; only a rename removes it.
                from: (status.starts_with('R')).then_some(first),
            })
        }
        _ => Some(Change { path: first, sha: Some(dst_sha.to_string()), from: None }),
    }
}

/// A commit's header line and the changes under it.
struct RawCommit {
    sha: String,
    ts: i64,
    author: String,
    subject: String,
    changes: Vec<Change>,
}

/// Which commits to read.
///
/// One variant, and it used to have two. `Since(sha)` was how a resumed walk asked for what
/// it had not done — and "everything not reachable from that commit" is only "everything
/// after it" on a history with no branches. See `log_shas`: a resumed walk carries a
/// POSITION now, and asks for those commits by name.
enum CommitRange {
    /// The most recent N, oldest first.
    Last(usize),
}

/// The commit stream, oldest first, and how many were left off the front.
///
/// `--max-count` is applied *before* `--reverse`, so `Last` is the tail of history read
/// forwards, which is what the replay needs. Merges are excluded for the same reason
/// `churn` excludes them: a merge commit's diff attributes every line of the branch to
/// the moment it landed, which would make a whole subtree flare at once for work done
/// over weeks.
/// The diffs of exactly these commits, in the order given.
///
/// `--no-walk` so git reports the named commits rather than their ancestry, which is the
/// whole point: the caller has already decided what to apply and in what order — see
/// `log_shas`. Chunked because a command line is not unbounded and a repo can gain thousands
/// of commits between opens.
fn commits_named(repo: &Path, shas: &[String]) -> Vec<RawCommit> {
    let mut out: Vec<RawCommit> = Vec::new();
    for chunk in shas.chunks(2000) {
        let mut cmd = Command::new("git");
        cmd.arg("-C").arg(repo).args([
            "log",
            "--no-walk",
            "--raw",
            "--find-renames",
            "--format=%x01%H%x1f%ct%x1f%an%x1f%s",
        ]);
        cmd.args(chunk);
        let Ok(o) = cmd.output() else { return Vec::new() };
        let text = String::from_utf8_lossy(&o.stdout);
        let mut got = parse_commits(&text);
        // `--no-walk` reports them newest first whatever order they were named in, so the
        // caller's order is restored here rather than trusted from git.
        got.sort_by_key(|c| chunk.iter().position(|s| *s == c.sha).unwrap_or(usize::MAX));
        out.append(&mut got);
    }
    out
}

/// The commit stream, read a line at a time as git produces it.
///
/// **Streamed rather than collected, and the reason is the wait rather than the memory.**
/// This used to be `Command::output()`, which hands back the whole log at once: on the Linux
/// kernel that is 400MB and about a minute and a half during which the phase line says
/// `reading the log` and can say nothing else, because there is no denominator until the
/// command returns. It was reported as a hang, which is what a two-minute silence is.
///
/// **`--reverse` was suspected and is innocent** — worth recording, because the obvious fix
/// is to drop it and reverse in memory. Measured on a 112,385-commit repo: git emits the
/// first commit at 3.5s and then streams steadily to 35.8s. The ordering pass is a few
/// seconds of walking the commit graph, not a buffer of the whole diff. So the order the
/// walk wants is also the order git is happy to produce, and 90% of the wait is reportable.
///
/// Keeping it also makes a cancelled read COHERENT rather than wasted. Oldest-first means a
/// partial read is a complete prefix of the story — exactly what a bounded window already is
/// — so stopping halfway leaves a shorter timeline rather than a broken one. Reading
/// newest-first would have made the same interruption a hole in the middle.
fn commits(
    repo: &Path,
    range: CommitRange,
    progress: &dyn Fn(Progress),
    // **Passed rather than read off the global, so stopping can be TESTED.** `CANCELLED` is
    // one flag for the whole process and `cargo test` runs in threads: a test that set it to
    // prove this loop honours it stopped every other walk running beside it, which is how
    // this parameter came to exist. `read` hands over `cancelled` and nothing else does.
    stop: &dyn Fn() -> bool,
) -> (Vec<RawCommit>, usize) {
    // **Counted BESIDE the log, not before it.** `rev-list --count` is a full revwalk — 19
    // seconds on the Linux kernel — and it was the first thing this did, so the phase that
    // has no number was also the phase nothing could report. It only ever produces the
    // denominator, and the numerator does not need it to start arriving: the log is spawned
    // immediately and the count lands in an atomic that the ticks pick up when it does.
    // Until then the row shows the phase, which is what it shows for any uncountable step.
    let counted = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
    let counting = {
        let counted = counted.clone();
        let repo = repo.to_path_buf();
        std::thread::spawn(move || {
            let n = Command::new("git")
                .arg("-C")
                .arg(&repo)
                .args(["rev-list", "--no-merges", "--count", "HEAD"])
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .and_then(|s| s.trim().parse::<usize>().ok())
                .unwrap_or(0);
            counted.store(n, std::sync::atomic::Ordering::Relaxed);
        })
    };

    let CommitRange::Last(limit) = range;
    let selector = match limit {
        // Unbounded asks for no bound at all rather than for an enormous one: `git log`
        // parses `--max-count` into a signed int, so a `usize::MAX` written out is not a
        // very large window, it is an error.
        ALL_COMMITS => "HEAD".to_string(),
        n => format!("--max-count={n}"),
    };
    progress(Progress::phase("reading the log"));

    let spawned = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args([
            "log",
            "--no-merges",
            "--reverse",
            // Without this the repo's first commit has no diff at all, so every function
            // in it would appear to arrive with the second.
            "--root",
            "--raw",
            "--find-renames",
            "--format=%x01%H%x1f%ct%x1f%an%x1f%s",
            &selector,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    let Ok(mut child) = spawned else {
        return (Vec::new(), 0);
    };
    let Some(out) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return (Vec::new(), 0);
    };

    let mut list: Vec<RawCommit> = Vec::new();
    let mut reader = BufReader::with_capacity(1 << 20, out);
    // One buffer for the whole log rather than a `String` per line: the kernel's log is
    // eight million lines, and allocating per line is most of what the old lossy copy cost.
    let mut buf: Vec<u8> = Vec::with_capacity(256);
    loop {
        buf.clear();
        match reader.read_until(b'\n', &mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        let line = String::from_utf8_lossy(&buf);
        if absorb(&mut list, line.trim_end_matches(['\n', '\r'])) {
            // Checked and reported per COMMIT, not per line: a commit is the unit being
            // counted, changes outnumber commits several to one, and breaking between two of
            // a commit's own diff lines would leave a half-read commit at the end of the list.
            if stop() {
                break;
            }
            // **A bounded window already knows its denominator**, so it never waits for the
            // count: `--max-count=n` cannot produce more than n. Only an unbounded one has to
            // ask, and until the answer lands this is zero — which the row reads as "no
            // denominator yet" and renders as the phase name, the same as any uncountable
            // step.
            let expected = match limit {
                ALL_COMMITS => counted.load(std::sync::atomic::Ordering::Relaxed),
                n => n,
            };
            progress(Progress::counting("reading the log", "read", list.len(), expected));
        }
    }
    // **Killed rather than left to finish.** Dropping the pipe would eventually stop git with
    // a broken pipe, but not before it had computed however much output fits in the OS
    // buffer, and on a cancelled kernel trace that is a process still doing minutes of diff
    // work for nobody. `wait` reaps it; neither call can usefully fail.
    let _ = child.kill();
    let _ = child.wait();
    // Long finished by now on any repo where it mattered; joined so the count is final before
    // it decides how much of the story was left off the front.
    let _ = counting.join();
    let total = counted.load(std::sync::atomic::Ordering::Relaxed);

    (list, total.saturating_sub(limit))
}

/// One `--raw` log into commits and their changes.
fn parse_commits(text: &str) -> Vec<RawCommit> {
    let mut list: Vec<RawCommit> = Vec::new();
    for line in text.lines() {
        absorb(&mut list, line);
    }
    list
}

/// One line of a `--raw` log into `list`, and whether it began a new commit.
///
/// Split out of `parse_commits` so the streaming reader and the batched one cannot drift:
/// they are the same format, and the only difference is where the lines come from.
fn absorb(list: &mut Vec<RawCommit>, line: &str) -> bool {
    if let Some(head) = line.strip_prefix('\u{1}') {
        let mut f = head.split('\u{1f}');
        let (Some(sha), Some(ts), Some(author), Some(subject)) =
            (f.next(), f.next(), f.next(), f.next())
        else {
            return false;
        };
        list.push(RawCommit {
            sha: sha.to_string(),
            ts: ts.parse().unwrap_or(0),
            author: author.to_string(),
            subject: subject.to_string(),
            changes: Vec::new(),
        });
        return true;
    }
    if let Some(change) = parse_raw(line) {
        if let Some(c) = list.last_mut() {
            c.changes.push(change);
        }
    }
    false
}

/// Every source blob in one commit's tree — the opening state, when history is longer
/// than the window.
fn tree_of(repo: &Path, sha: &str) -> Vec<(String, String)> {
    let Ok(out) = Command::new("git").arg("-C").arg(repo).args(["ls-tree", "-r", sha]).output()
    else {
        return Vec::new();
    };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter_map(|line| {
            let (meta, path) = line.split_once('\t')?;
            let mut f = meta.split_whitespace();
            let _mode = f.next()?;
            if f.next()? != "blob" {
                return None;
            }
            let blob = f.next()?.to_string();
            lang_of(path).map(|_| (path.to_string(), blob))
        })
        .collect()
}

/// Every file version a window of commits touches, by `(path, blob)`.
type Parsed = std::collections::HashMap<(String, String), FileState>;

/// How many commits are read ahead and parsed as one batch.
///
/// **A frame is a commit; a BATCH is not.** Conflating the two cost the walk most of the
/// machine: a commit touches about three files, so parsing per commit handed `rayon` a
/// three-element loop — which on ten cores is a serial loop with scheduling overhead — and
/// the walk ran at roughly one core for its whole length. Bucketing frames fixed that by
/// accident and broke addressability, which is a worse trade; this fixes it on purpose and
/// changes nothing about what a frame is.
///
/// Five hundred commits is about fifteen hundred file versions in flight: enough to fill
/// every core, small enough that the blobs are megabytes rather than gigabytes, and it keeps
/// the progress line moving — a window is applied commit by commit after it is parsed.
const WINDOW: usize = 500;

/// Read and parse every file version a slice of commits touches, in one pass.
///
/// Deduplicated by `(path, blob)`: a file reverted inside the window, or two commits landing
/// the same content, is read once. The blob text is dropped as soon as it is parsed, so what
/// this holds is function lists rather than sources.
fn prefetch(blobs: &mut Blobs, log: &[RawCommit], progress: &dyn Fn(Progress)) -> Parsed {
    let mut want: Vec<(String, String)> = Vec::new();
    let mut seen: std::collections::HashSet<(String, String)> = std::collections::HashSet::new();
    for c in log {
        for ch in &c.changes {
            let Some(sha) = ch.sha.clone() else { continue };
            if lang_of(&ch.path).is_none() {
                continue;
            }
            let key = (ch.path.clone(), sha);
            if seen.insert(key.clone()) {
                want.push(key);
            }
        }
    }
    let keys = want.clone();
    parse_batch(blobs, want, progress)
        .into_iter()
        .zip(keys)
        .map(|((_, state), (path, sha))| ((path, sha), state))
        .collect()
}

/// How many files are parsed between two progress reports.
///
/// **A window is one `par_iter` and that made it one silent step.** A window is five hundred
/// commits, about fifteen hundred file versions, and the walk only ticks once a window has
/// been parsed and is being applied — so on a repo where parsing a window takes a while, the
/// row sat on the last commit of the PREVIOUS window with nothing to say. Chunking costs a
/// barrier every hundred and twenty-eight files, which is nothing against fifteen hundred
/// tree-sitter parses, and buys a line that moves.
const PARSE_CHUNK: usize = 128;

/// The trace's own thread pool.
///
/// **Rayon has one global pool, no priorities, and a scan fills it.** A scan submits a
/// `par_iter` over every file in the repo; a trace's window submits fifteen hundred parses
/// into the same queue and waits behind however much of the scan is already in flight. That
/// is not slowness, it is starvation — the trace stops reporting entirely for as long as the
/// scan holds the workers, which is exactly what "seems stalled" looks like.
///
/// A pool of its own makes the two compete for CPU rather than for a queue, which the OS
/// scheduler arbitrates and rayon's single queue does not. Sized to the machine rather than
/// to half of it: a trace running alone is the common case and should have the whole
/// machine, and the overlap costs 2x oversubscription of CPU-bound work, which the scheduler
/// handles by giving each about half. Rayon's idle workers sleep, so the second pool costs
/// nothing when no trace is running.
///
/// Falls back to the global pool if one cannot be built — a trace that shares a queue is
/// worse than a trace, and much better than no trace.
fn pool() -> Option<&'static rayon::ThreadPool> {
    static POOL: std::sync::OnceLock<Option<rayon::ThreadPool>> = std::sync::OnceLock::new();
    POOL.get_or_init(|| {
        rayon::ThreadPoolBuilder::new().thread_name(|i| format!("trace-{i}")).build().ok()
    })
    .as_ref()
}

/// Run a parallel job on the trace's pool, or on the global one if there isn't one.
fn on_pool<T: Send>(work: impl FnOnce() -> T + Send) -> T {
    match pool() {
        Some(p) => p.install(work),
        None => work(),
    }
}

/// Read a batch of blobs, then parse them in parallel.
///
/// The split is the whole point: reading is one sequential conversation with a single git
/// process, and parsing is the expensive part and embarrassingly parallel. Interleaving
/// them would serialise the tree-sitter work behind the pipe.
fn parse_batch(
    blobs: &mut Blobs,
    want: Vec<(String, String)>,
    progress: &dyn Fn(Progress),
) -> Vec<(String, FileState)> {
    // A refused blob still comes back, as an EMPTY state rather than as nothing at all.
    // Dropping it would leave the file's last good functions in the live state with no
    // commit able to remove them — a file that turns into a generated bundle would keep
    // its old wedges for the rest of the timeline.
    let total = want.len();
    let mut sources: Vec<(String, Option<(Lang, String)>)> = Vec::with_capacity(total);
    for (n, (path, sha)) in want.into_iter().enumerate() {
        let Some(lang) = lang_of(&path) else { continue };
        let src = blobs.read(&sha).filter(|src| {
            // Refused here rather than at the git layer: minification is a property
            // of the bytes, and the only way to know is to have read them.
            !src.lines().any(|l| l.len() > MINIFIED_LINE_BYTES)
        });
        sources.push((path, src.map(|s| (lang, s))));
        if n % PARSE_CHUNK == 0 {
            progress(Progress::counting("reading files", "files", n, total * 2));
        }
    }

    // **Chunked, so the line moves, and on the trace's own pool, so it moves at all.** See
    // `PARSE_CHUNK` and `pool`. The two halves are counted as one job of `2 * total` because
    // they are one wait as far as anybody watching is concerned: reading the blobs out of git
    // is the first half of it and parsing them is the second.
    let mut out: Vec<(String, FileState)> = Vec::with_capacity(sources.len());
    for (i, chunk) in sources.chunks_mut(PARSE_CHUNK).enumerate() {
        progress(Progress::counting("parsing files", "files", total + i * PARSE_CHUNK, total * 2));
        let done: Vec<(String, FileState)> = on_pool(|| {
            chunk
                .par_iter_mut()
                .map(|(path, src)| {
                    let state = src
                        .take()
                        .map(|(lang, text)| functions_of(path, lang, &text))
                        .unwrap_or_default();
                    (std::mem::take(path), state)
                })
                .collect()
        });
        out.extend(done);
    }
    out
}

/// The walk, in a form that can be stopped and resumed.
///
/// Split out of `read` for one reason: **a repo you are working in gains commits, and
/// re-parsing its whole history for each one is the difference between a feature and a
/// wait.** Everything needed to continue a replay lives here, and all of it can be rebuilt
/// from a stored `HistoryScan` — which is what makes the cache an extension rather than a
/// second copy of the same walk.
struct Replayer {
    paths: BTreeMap<String, u32>,
    funcs: Funcs,
    /// Live parse state, carried forward across commits. This is what makes the walk
    /// linear in file *versions* rather than in commits × files.
    state: BTreeMap<String, FileState>,
    out: HistoryScan,
}

impl Replayer {
    fn empty() -> Replayer {
        Replayer {
            paths: BTreeMap::new(),
            funcs: Funcs::default(),
            state: BTreeMap::new(),
            out: HistoryScan {
                paths: Vec::new(),
                langs: Vec::new(),
                funcs: Vec::new(),
                base: Vec::new(),
                base_ts: 0,
                head: String::new(),
                commits: Vec::new(),
                truncated: 0,
            },
        }
    }

    /// Rebuild a replayer from a scan it produced earlier.
    ///
    /// The parse state is *derived* rather than stored, by folding the frames the same
    /// way the frontend does. That is deliberate: a stored copy of the state would be a
    /// second description of the same thing, free to disagree with the frames, and the
    /// disagreement would be invisible — new commits would diff against a state nobody
    /// could see. Folding means the resumed walk and a fresh one start from the same
    /// place by construction.
    fn resume(scan: HistoryScan) -> Replayer {
        let mut r = Replayer::empty();
        for (i, p) in scan.paths.iter().enumerate() {
            r.paths.insert(p.clone(), i as u32);
        }
        for (i, f) in scan.funcs.iter().enumerate() {
            r.funcs.index.insert(key_of(&scan.paths[f.path as usize], f), i as u32);
        }
        r.funcs.list = scan.funcs.clone();

        let mut live: BTreeMap<u32, u32> = scan.base.iter().copied().collect();
        for c in &scan.commits {
            for (f, loc) in &c.set {
                live.insert(*f, *loc);
            }
            for f in &c.del {
                live.remove(f);
            }
        }
        for (fi, loc) in live {
            let def = &scan.funcs[fi as usize];
            let path = scan.paths[def.path as usize].clone();
            let at = FuncAt {
                key: key_of(&path, def),
                name: def.name.clone(),
                owner: def.owner.clone(),
                ord: def.ord,
                loc,
                // Nothing to hash: a resumed state is folded from frames, not parsed. See
                // `FuncAt::hash`.
                hash: None,
            };
            r.state.entry(path).or_default().push(at);
        }
        r.out = scan;
        r
    }

    fn path_idx(&mut self, p: &str) -> u32 {
        if let Some(i) = self.paths.get(p) {
            return *i;
        }
        let i = self.out.paths.len() as u32;
        self.out.paths.push(p.to_string());
        self.out.langs.push(lang_of(p).map(|l| l.label().to_string()).unwrap_or_default());
        self.paths.insert(p.to_string(), i);
        i
    }

    /// Parse a whole tree into the opening state — everything the commits before the
    /// window built.
    fn seed(
        &mut self,
        blobs: &mut Blobs,
        tree: Vec<(String, String)>,
        progress: &dyn Fn(Progress),
    ) {
        for (path, state_of) in parse_batch(blobs, tree, progress) {
            let pi = self.path_idx(&path);
            for f in &state_of {
                let fi = self.funcs.intern(pi, f);
                self.out.base.push((fi, f.loc));
            }
            self.state.insert(path, state_of);
        }
    }

    /// Apply one commit, appending its frame.
    fn apply(&mut self, blobs: &mut Blobs, commit: &RawCommit, ready: &Parsed) {
        let mut frame = HistoryCommit {
            sha: commit.sha.clone(),
            short: commit.sha.chars().take(7).collect(),
            ts: commit.ts,
            author: commit.author.clone(),
            subject: commit.subject.clone(),
            set: Vec::new(),
            del: Vec::new(),
            files: Vec::new(),
        };

        // Renames and deletions first: both retire a path, and a rename's *arrival* is
        // handled as an ordinary write of the new path below.
        let mut retired: Vec<String> = Vec::new();
        for c in &commit.changes {
            if c.sha.is_none() {
                retired.push(c.path.clone());
            }
            if let Some(from) = &c.from {
                retired.push(from.clone());
            }
        }
        for path in retired {
            let Some(gone) = self.state.remove(&path) else { continue };
            let pi = self.path_idx(&path);
            frame.files.push(pi);
            for f in gone {
                if let Some(fi) = self.funcs.index.get(&f.key) {
                    frame.del.push(*fi);
                }
            }
        }

        // Taken from the window's batch, and parsed here only if it is somehow missing —
        // see `prefetch`. The fallback exists so a bug in the batching is a slow frame
        // rather than a silently empty one.
        let mut missing: Vec<(String, String)> = Vec::new();
        let mut states: Vec<(String, FileState)> = Vec::new();
        for c in &commit.changes {
            let Some(sha) = c.sha.clone() else { continue };
            if lang_of(&c.path).is_none() {
                continue;
            }
            match ready.get(&(c.path.clone(), sha.clone())) {
                Some(state) => states.push((c.path.clone(), state.clone())),
                None => missing.push((c.path.clone(), sha)),
            }
        }
        // Whatever the window's prefetch did not cover: a handful of blobs per commit, so
        // there is nothing here worth reporting and a tick per commit would fight the walk's
        // own count for the same line.
        states.extend(parse_batch(blobs, missing, &|_| {}));

        for (path, next) in states {
            let pi = self.path_idx(&path);
            frame.files.push(pi);
            let prev = self.state.get(&path).cloned().unwrap_or_default();
            let was: BTreeMap<&str, &FuncAt> = prev.iter().map(|f| (f.key.as_str(), f)).collect();
            for f in &next {
                let fi = self.funcs.intern(pi, f);
                // **Only what this commit actually changed.** A commit arrives as a set of
                // changed FILES, and the whole file is re-parsed to diff it — so the
                // obvious thing, and what this did, is to emit every function the new parse
                // found. That makes `set` mean "every function in every file this commit
                // touched", which is a different and much larger claim: on a real repo it
                // lit whole files at once and there was no such thing on screen as a commit
                // that changed part of a file. Nobody spotted it while `set` only drove
                // wedge SIZES, because a function that did not change reports the size it
                // already had.
                //
                // Comparing hashes is what makes the distinction available at all: the file
                // changed, and which of its functions did is not derivable from that.
                // Compared by KEY rather than by position, or inserting one function at the
                // top of a file would report every function below it as rewritten.
                if was.get(f.key.as_str()).is_none_or(|old| old.hash != f.hash) {
                    frame.set.push((fi, f.loc));
                }
            }
            for f in &prev {
                if !next.iter().any(|n| n.key == f.key) {
                    if let Some(fi) = self.funcs.index.get(&f.key) {
                        frame.del.push(*fi);
                    }
                }
            }
            self.state.insert(path, next);
        }

        frame.files.sort_unstable();
        frame.files.dedup();
        self.out.head = commit.sha.clone();
        self.out.commits.push(frame);
    }

    /// Fold the oldest frames into the opening state until the window fits `limit`.
    ///
    /// The same operation truncation already performs, applied to frames that have
    /// already been computed — which is why a resumed walk never re-parses anything. What
    /// is lost is exactly what a pre-window function is supposed to lose: its dates. A
    /// folded function makes no claim about when it was last touched, and `frameTree`
    /// leaves it uncolored rather than dating it to the edge of the window.
    fn fold(&mut self, limit: usize) {
        if self.out.commits.len() <= limit {
            return;
        }
        let extra = self.out.commits.len() - limit;
        let mut base: BTreeMap<u32, u32> = self.out.base.iter().copied().collect();
        for c in self.out.commits.drain(..extra) {
            for (f, loc) in c.set {
                base.insert(f, loc);
            }
            for f in c.del {
                base.remove(&f);
            }
            self.out.base_ts = c.ts;
        }
        self.out.base = base.into_iter().collect();
        self.out.truncated += extra;
    }

    fn finish(mut self) -> HistoryScan {
        self.out.funcs = self.funcs.list;
        self.out
    }

    /// The timeline as it stands, without ending the walk.
    ///
    /// A copy rather than a borrow, because what it is for is being written to disk while
    /// the walk carries on. `head` already names the last commit applied — `apply` sets it
    /// every time — which is the whole reason a half-finished timeline is a legal one: it
    /// is indistinguishable from a complete timeline of an older HEAD, and that is a shape
    /// this module already knows how to carry forward.
    fn snapshot(&self) -> HistoryScan {
        let mut out = self.out.clone();
        out.funcs = self.funcs.list.clone();
        out
    }
}

/// The share of a walk that may be spent writing checkpoints, as a divisor: one part
/// writing to twenty parts working.
///
/// **Fixing an interval was the wrong shape, because the cost is not fixed.** A checkpoint
/// costs one serialization of the timeline so far, and that grows as the walk goes: ceph's
/// first 6,393 commits are 8.9MB and serialize in tens of milliseconds, while the finished
/// 122,792 would be ~170MB and closer to a second. So any single number is wrong at one end
/// — 120s wasted almost nothing and risked two minutes of work, and 10s would have been
/// free early and spent a tenth of the last hour writing.
///
/// Timing the write and waiting twenty times as long bounds the overhead at about 5%
/// wherever the walk is, which is the property actually worth holding fixed. Small repos
/// sit at the floor and large ones stretch toward the ceiling on their own.
const CHECKPOINT_BUDGET: u32 = 20;

/// Never more often than this, however cheap the write is. Below it the interval is
/// measuring scheduler noise rather than anything about the walk.
const CHECKPOINT_MIN: Duration = Duration::from_secs(5);

/// Never rarer than this, however expensive the write is — the ceiling is what a person is
/// willing to lose, and past a minute the answer stops being "it resumed" in any useful
/// sense.
const CHECKPOINT_MAX: Duration = Duration::from_secs(60);

/// Set to stop the walk in progress. See [`cancel`].
static CANCELLED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Stop the replay that is running, wherever it has got to.
///
/// **Stopping is not throwing away.** The walk breaks out of its loop, its caller writes what
/// it holds to the cache exactly as a completed one would, and what comes back is a timeline
/// of everything replayed so far — which is a legal timeline of an older HEAD, the same shape
/// a checkpoint has. So a cancelled replay is scrubbable up to where it stopped, and asking
/// for History again later resumes from there rather than starting over.
pub fn cancel() {
    CANCELLED.store(true, std::sync::atomic::Ordering::Relaxed);
}

fn cancelled() -> bool {
    CANCELLED.load(std::sync::atomic::Ordering::Relaxed)
}

/// Leaves a resumable timeline behind, often enough to matter and rarely enough to be free.
struct Checkpoint {
    at: Instant,
    every: Duration,
}

impl Checkpoint {
    fn new() -> Self {
        Self { at: Instant::now(), every: CHECKPOINT_MIN }
    }

    /// Write, if one is due. `snapshot` is called only when it is — building one copies the
    /// whole timeline, which is precisely the cost this is rationing.
    fn maybe(&mut self, repo: &Path, limit: usize, snapshot: impl FnOnce() -> HistoryScan) {
        if self.at.elapsed() < self.every {
            return;
        }
        let started = Instant::now();
        save_cache(repo, limit, &snapshot());
        self.every = (started.elapsed() * CHECKPOINT_BUDGET).clamp(CHECKPOINT_MIN, CHECKPOINT_MAX);
        // Timed from AFTER the write: the interval rations working time, and starting the
        // clock before it would charge the walk for the write twice.
        self.at = Instant::now();
    }
}

/// Replay `repo`'s history into frames the sunburst can draw.
///
/// Never fails: a directory with no git history is a perfectly reasonable thing to open,
/// it simply has no story to tell, and an empty timeline says so honestly.
///
/// **It checkpoints, and that stopped being optional when the window became the whole
/// repo.** How often is not a constant — see [`Checkpoint`], which times its own writes and
/// keeps them to a twentieth of the walk. The cache used to be written once, at the end, which is the right shape for a
/// walk that takes a minute: nothing is lost that git cannot produce again, and a
/// half-written timeline is a file nobody asked for. At 5,000 commits that was true. At
/// 122,792 — ceph, unbounded — a walk is the better part of an hour, and quitting the app
/// threw away all of it.
///
/// **A partial timeline needs no new concept, which is why this is four lines.** `head`
/// names the last commit applied, so what lands on disk is exactly a COMPLETE timeline of
/// an older HEAD — and carrying one of those forward is what [`extend`] already does, down
/// to the ancestry check that refuses a rewritten history. A resumed walk replays only what
/// it had not reached.
///
/// Time, not commits, because the thing being bounded is how much work a person can lose.
/// Two minutes says that in the unit they would say it in, and it costs a repo whose whole
/// replay is shorter than that exactly nothing.
pub fn read(repo: &Path, limit: usize, progress: &dyn Fn(Progress)) -> HistoryScan {
    // A hundred thousand commits of `git log --raw` is several seconds, and until it lands
    // there is no denominator to report.
    let (log, truncated) = commits(repo, CommitRange::Last(limit), progress, &cancelled);
    let mut r = Replayer::empty();
    r.out.base_ts = log.first().map(|c| c.ts).unwrap_or(0);
    r.out.truncated = truncated;
    if log.is_empty() {
        return r.finish();
    }
    let Some(mut blobs) = Blobs::open(repo) else {
        return r.finish();
    };

    let total = log.len() + 1;
    // **Named and united, because the log now counts too.** Both phases report a fraction of
    // the same commits and they are not the same fraction — one is bytes off a pipe, the
    // other is minutes of parsing per thousand — so the row has to be able to say which it
    // is watching. It said `12k / 112k traced` during a read that had traced nothing.
    let walked = |n: usize| Progress::counting("replaying", "traced", n, total);
    progress(walked(0));

    // The opening state: everything the truncated commits built, parsed once from the tree
    // of the commit *before* the window. Skipped entirely when the window covers the whole
    // repo, which is where the timeline should start empty.
    if truncated > 0 {
        let tree = tree_of(repo, &format!("{}^", log[0].sha));
        r.seed(&mut blobs, tree, progress);
    }
    progress(walked(1));

    let mut checkpoint = Checkpoint::new();
    // A window's file versions are read and parsed together, then its commits are applied
    // one at a time — see `WINDOW`. Frames stay per commit; only the parsing is batched.
    'walk: for (w, window) in log.chunks(WINDOW).enumerate() {
        let ready = prefetch(&mut blobs, window, progress);
        for (n, commit) in window.iter().enumerate() {
            if cancelled() {
                break 'walk;
            }
            r.apply(&mut blobs, commit, &ready);
            progress(walked(w * WINDOW + n + 2));
            checkpoint.maybe(repo, limit, || r.snapshot());
        }
    }
    r.finish()
}

/// Replay `repo`, reusing whatever the last replay of it left behind.
///
/// Three outcomes, in the order they are worth having:
///
/// - **Nothing moved.** The cached scan is returned as it stands. A commit's diff is
///   immutable, so a stored frame cannot go stale the way a score can — this is not a
///   cache that has to be right about the present, it is a record of what already
///   happened.
/// - **The repo gained commits.** Only those are parsed, appended, and the overflow folded
///   into the opening state. On a repo you are working in this is the normal case, and it
///   is the difference between a minute and a moment.
/// - **Anything else** — a rebase, a different window, a format change — is a full replay.
///   Cheaper to redo than to reason about.
///
/// A failed read or write is never fatal: the cache is an accelerant, and the answer is
/// computable without it. That is exactly the property `reports.rs` did NOT have, and why
/// a second home for readings was a bug where a second copy of a timeline is not — this
/// one holds nothing that cannot be recomputed from git.
pub fn read_cached(repo: &Path, limit: usize, progress: &dyn Fn(Progress)) -> HistoryScan {
    // Named before it is counted. Reading ceph's stored timeline is seconds of serde before
    // a single frame is applied, and the row said `starting…` for all of it.
    progress(Progress::phase("reading the stored trace"));
    // Cleared here rather than by whoever cancelled: a flag that outlives its walk truncates
    // the NEXT one, and `warm` calls this on every project that comes on screen.
    CANCELLED.store(false, std::sync::atomic::Ordering::Relaxed);
    // **One place decides, and "nothing to do" is not "cannot be carried".**
    //
    // This used to ask `git rev-parse HEAD` and return the cached timeline when the stored
    // head matched. It almost never does: the walk skips merges, so its last commit is the
    // newest NON-MERGE one, and on a merge-heavy repo that is not HEAD. Every open therefore
    // decided the timeline was stale, asked `extend` to carry it forward, was told there was
    // nothing ahead — and read that as "cannot be carried", falling through to a full replay
    // of a hundred and twenty thousand commits. Every time the project was opened. It is why
    // ceph's map was slow to load whatever had been traced, and why a finished trace still
    // advertised ninety-four thousand commits to trace after a restart.
    if let Some(cached) = load_cache(repo, limit) {
        match extend(repo, cached, limit, progress) {
            Carry::Same(scan) => {
                progress(Progress::at(1, 1));
                return scan;
            }
            Carry::Grew(scan) => {
                save_cache(repo, limit, &scan);
                return scan;
            }
            Carry::Refused => {}
        }
    }
    let scan = read(repo, limit, progress);
    bank(repo, limit, &scan);
    // The held copy describes a story this walk has just replaced.
    unload();
    scan
}

/// Throw away this repo's timeline, so the next trace walks it from nothing.
///
/// **The only way to make a trace do work it thinks it has already done.** A walk is
/// resumable and idempotent by design — it asks what has changed since the stored head and
/// appends — which is what makes an hour-long trace survivable and also means "trace it
/// again" is otherwise a no-op. What it cannot notice is that the PARSER moved, or that a
/// timeline was written by a build whose bugs are now fixed: those change what the same
/// commits mean, and nothing in the cache is wrong enough to fail a check.
pub fn forget(repo: &Path, limit: usize) {
    unload();
    if let Some(p) = cache_path(repo, limit) {
        let _ = std::fs::remove_file(&p);
    }
    if let Some(p) = meta_path(repo, limit) {
        let _ = std::fs::remove_file(&p);
    }
}

/// The timeline this repo already has, without walking a single commit.
///
/// **Looking at a trace and taking one are different acts, and only one of them costs an
/// hour.** `read_cached` conflates them by design — it is what you call when you want the
/// timeline to be CURRENT — so opening History on a repo with a partial trace resumed the
/// walk, and the window that meant to show a picture started an hour of parsing instead.
/// This is the viewer's door: whatever was banked, exactly as banked, or nothing.
pub fn stored(repo: &Path, limit: usize) -> Option<HistoryScan> {
    load_cache(repo, limit)
}

/// What became of a stored timeline when it was asked to catch up.
enum Carry {
    /// Already current — the walk has nothing left to apply. The commonest outcome by far,
    /// and the one that used to be indistinguishable from failure.
    Same(HistoryScan),
    /// Carried forward. Worth writing back.
    Grew(HistoryScan),
    /// Cannot be carried: short, or describing a history that has been rewritten. The answer
    /// is a full replay, which is the expensive thing this enum exists to stop happening by
    /// accident.
    Refused,
}

impl Carry {
    /// The timeline this carried forward to, for a test that has just added a commit and
    /// expects it to land. Panics on anything else, because "it refused" and "there was
    /// nothing to do" are both failures of that expectation and should read as such.
    #[cfg(test)]
    fn grew(self) -> HistoryScan {
        match self {
            Carry::Grew(scan) => scan,
            Carry::Same(_) => panic!("nothing to extend — the new commit was not seen"),
            Carry::Refused => panic!("refused to extend"),
        }
    }
}

/// Carry a cached scan forward, or say why not.
fn extend(repo: &Path, cached: HistoryScan, limit: usize, progress: &dyn Fn(Progress)) -> Carry {
    if cached.head.is_empty() || !is_ancestor(repo, &cached.head) {
        // A rebase, an amend, or a checkout of another branch. The stored frames describe
        // commits that are no longer on the path to HEAD, and appending to them would
        // produce a timeline that never happened.
        return Carry::Refused;
    }
    // **Where the stored timeline stops, as a POSITION in the walk's own order.**
    //
    // Verified rather than assumed: the frame count says where it should be and the sha at
    // that position says whether it is. They disagree when the timeline is short — a build
    // that dropped commits, a walk that resumed wrongly — and when history has been rewritten
    // under it, and the answer to both is the same: walk it again rather than append to
    // something that does not describe this repo.
    progress(Progress::phase("reading the log"));
    // **Stopped here means keep the timeline, not rebuild it.** `Refused` sends the caller to
    // a full replay, which a person who has just pressed Cancel is not asking for — and that
    // replay would itself be cancelled, leaving an empty walk where a good timeline used to
    // be. `Same` is the honest answer: nothing was added, nothing was lost.
    let Some(shas) = log_shas(repo, progress, &cancelled) else {
        return Carry::Same(cached);
    };
    let at = cached.commits.len() + cached.truncated;
    if shas.len() < at || at == 0 || shas.get(at - 1) != Some(&cached.head) {
        return Carry::Refused;
    }
    let ahead: Vec<String> = shas[at..].to_vec();
    // Already current. The commonest outcome: a repo nobody has committed to since the last
    // look, which is every open of a repo you are not actively writing.
    if ahead.is_empty() {
        return Carry::Same(cached);
    }
    // Past this the append is doing the whole window's work with none of its clarity.
    if ahead.len() > limit {
        return Carry::Refused;
    }
    let log = commits_named(repo, &ahead);
    if log.is_empty() {
        return Carry::Refused;
    }
    let Some(mut blobs) = Blobs::open(repo) else { return Carry::Refused };
    // **Counted from the beginning of the story, not from where this run picked it up.**
    // Reporting `n / log.len()` describes the WORK, and what a person watching a resumed
    // walk needs is where the walk IS: a run that recovered 6,393 of ceph's commits and
    // reported `1 / 116,400` was indistinguishable on screen from one that had thrown them
    // away and started again — which is exactly the question checkpointing exists to
    // answer, made unanswerable by the progress line.
    let banked = at;
    let mut checkpoint = Checkpoint::new();
    let mut r = Replayer::resume(cached);
    let total = banked + log.len();
    'walk: for (w, window) in log.chunks(WINDOW).enumerate() {
        let ready = prefetch(&mut blobs, window, progress);
        for (n, commit) in window.iter().enumerate() {
            if cancelled() {
                break 'walk;
            }
            r.apply(&mut blobs, commit, &ready);
            progress(Progress::counting("replaying", "traced", banked + w * WINDOW + n + 1, total));
            checkpoint.maybe(repo, limit, || r.snapshot());
        }
    }
    r.fold(limit);
    Carry::Grew(r.finish())
}

/// Which repos are being traced right now, and how far each has got.
///
/// **A walk is owned by the process doing it, not by the window that asked.** "One walk at a
/// time" and the progress line both lived in React state — `busyKey` and a `replay` object —
/// so a webview reload dropped every trace of a run that carried on underneath: the row went
/// back to offering `Trace`, and pressing it would have started a second walk over the same
/// repo. Two walks do not each take half the time; they take twice, neither finishes, and the
/// progress events (which carry no repo) count into one bar. That guard cannot live in a
/// window — a reload, a second window and `sanity serve` all get past it — so it lives here,
/// beside the thing it guards, in the process that is doing the work.
///
/// Keyed by the repo path a caller asked about, because that is what the caller has.
static TRACING: std::sync::Mutex<Option<HashMap<PathBuf, Progress>>> = std::sync::Mutex::new(None);

/// What a repo's walk has reached, or `None` when nothing is walking it.
///
/// Read on every project poll, so it takes the lock briefly and copies. A poisoned lock is
/// recovered from rather than honoured, on the same rule `agentapi::lock` follows: this map
/// holds a progress number, and refusing to answer forever because one thread panicked while
/// updating one would make the sidebar permanently wrong about work that is still running.
pub fn tracing(repo: &Path) -> Option<Progress> {
    let map = TRACING.lock().unwrap_or_else(|e| e.into_inner());
    map.as_ref()?.get(repo).cloned()
}

/// Claim a repo for a walk, or find out somebody else has it.
///
/// The claim is released by dropping the guard, which happens on the normal path, on a
/// cancel, and on a panic — the reason it is a guard rather than a pair of calls. A walk that
/// died leaving its claim behind would make the row say "tracing" forever and refuse every
/// retry, which is worse than the bug this replaces.
pub struct Tracing(PathBuf);

impl Tracing {
    /// `None` when this repo is already being walked. The caller must not start a second.
    pub fn claim(repo: &Path) -> Option<Tracing> {
        let mut map = TRACING.lock().unwrap_or_else(|e| e.into_inner());
        let map = map.get_or_insert_with(HashMap::new);
        if map.contains_key(repo) {
            return None;
        }
        map.insert(repo.to_path_buf(), Progress::phase("starting…"));
        Some(Tracing(repo.to_path_buf()))
    }

    /// Record where the walk has got to, for anything that asks between now and the next tick.
    pub fn at(&self, p: &Progress) {
        let mut map = TRACING.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(map) = map.as_mut() {
            map.insert(self.0.clone(), p.clone());
        }
    }
}

impl Drop for Tracing {
    fn drop(&mut self) {
        let mut map = TRACING.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(map) = map.as_mut() {
            map.remove(&self.0);
        }
    }
}

/// Bring an EXISTING timeline up to date, and never build a new one.
///
/// The distinction is the whole point. A first replay is a minute of parsing on a large
/// repo, and charging every open of every project for a mode most opens never enter would
/// be the app spending the user's cores on a guess. Topping one up costs the commits
/// since it was written — a working day's worth is a second or two — so the rule is:
/// **sanity will keep a timeline you have asked for current, and will never make one you
/// have not.** `false` means there was nothing to warm, which is not a failure.
pub fn warm(repo: &Path, limit: usize) -> bool {
    let Some(path) = cache_path(repo, limit) else { return false };
    if !path.exists() {
        return false;
    }
    // **A day's commits, not an unfinished trace.** Warming exists so the repo you are
    // working in opens History instantly — the commits since you last looked, which is a
    // second or two. A timeline that stopped halfway is a different thing entirely: carrying
    // it forward is the rest of an hour-long walk, started by nothing more deliberate than
    // clicking a project, with no progress line and no way to stop it. The row says how much
    // is left and offers `Trace`; that is where a decision that size belongs.
    //
    // Answered from the sidecar and a sha list, so deciding costs no timeline read: `banked`
    // is four bytes and `log_shas` is 0.8s on a repo of 122,791 commits.
    let behind = match log_shas(repo, &|_| {}, &cancelled) {
        Some(shas) => shas.len().saturating_sub(banked(repo, limit)),
        // Somebody cancelled a trace while this was deciding. Deciding is all this does, so
        // the answer is "not now" rather than a guess.
        None => return false,
    };
    if behind > WARM_MAX {
        return false;
    }
    read_cached(repo, limit, &|_| {});
    true
}

/// How far behind a timeline may be and still be topped up on open. Past this it is
/// unfinished work rather than yesterday's commits — see [`warm`].
const WARM_MAX: usize = 2_000;

/// Every commit the walk would apply, in the order it would apply them, shas only.
///
/// **The walk's order is not an ancestry**, and confusing the two cost this module its
/// resume. `git log --reverse` lists commits oldest-first by DATE; on a branchy repo the
/// commit at position N is not the commit with N ancestors, and the set applied before it is
/// not the set reachable from it. Resuming with `<head>..HEAD` therefore asked for "commits
/// not reachable from that one" and silently dropped every commit that had been applied
/// after it but sits on a merged branch — fifteen thousand of them on ceph, a hole no later
/// open could see or fill.
///
/// A position is the honest cursor: the order is deterministic for a given HEAD, `--reverse`
/// appends new work at the END, so a stored prefix stays a prefix. 0.8s on 122,791 commits,
/// against the several seconds a `--raw` log costs — which is why this exists separately.
/// **Streamed and interruptible, for the reason the `--raw` log is** — one size down and on
/// the path that matters more. This is what a RESUME costs before it can do anything: 19
/// seconds and 56MB on the Linux kernel, and it used to be a single `output()`, so the phase
/// that says `reading the log` on a resumed trace was 19 seconds of nothing followed by
/// everything. It also runs on `warm`, which fires when a project with a partial timeline
/// comes on screen.
///
/// **`None` means the log could not be read, and that is not the same as an empty list.** A
/// short list read as data is the dangerous outcome: the position check below would find the
/// stored head missing, call it a rewritten history, and replay a repo from nothing. Callers
/// that cannot tell the two apart would trade a stopped resume for a full walk.
///
/// **A git that would not start used to answer `Some(vec![])`, which is that hazard by the
/// front door.** It read as "a repo with no commits", so a resume took the branch above,
/// declared the history rewritten, and replayed from nothing — the precise outcome the
/// paragraph above exists to prevent, reachable without anybody pressing Cancel. A failure to
/// spawn and a cancel are different events and neither is data; an empty repo is data, and it
/// still answers `Some(vec![])` because git ran and said so.
fn log_shas(
    repo: &Path,
    progress: &dyn Fn(Progress),
    stop: &dyn Fn() -> bool,
) -> Option<Vec<String>> {
    let spawned = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["log", "--no-merges", "--reverse", "--root", "--format=%H", "HEAD"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn();
    // Could not run git, or could not reach its output: no answer, rather than an empty one.
    let Ok(mut child) = spawned else { return None };
    let Some(out) = child.stdout.take() else {
        let _ = child.kill();
        let _ = child.wait();
        return None;
    };

    let mut shas: Vec<String> = Vec::new();
    let mut reader = BufReader::with_capacity(1 << 20, out);
    let mut buf = String::with_capacity(64);
    let mut gave_up = false;
    loop {
        buf.clear();
        match reader.read_line(&mut buf) {
            Ok(0) | Err(_) => break,
            Ok(_) => {}
        }
        let line = buf.trim_end();
        if line.is_empty() {
            continue;
        }
        shas.push(line.to_string());
        // No denominator, and none worth buying: the only way to know how many commits there
        // are is the same revwalk this IS, so a second one beside it would double the work to
        // narrate it. The count alone is honest — see the row, which shows a bare number when
        // there is nothing to divide it by.
        if shas.len().is_multiple_of(1024) {
            if stop() {
                gave_up = true;
                break;
            }
            progress(Progress::counting("reading the log", "read", shas.len(), 0));
        }
    }
    let _ = child.kill();
    let _ = child.wait();
    (!gave_up).then_some(shas)
}

/// Is `sha` still on the path to HEAD?
fn is_ancestor(repo: &Path, sha: &str) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["merge-base", "--is-ancestor", sha, "HEAD"])
        // A sha that is not a commit here is the ordinary answer to "was this rewritten",
        // not a fault worth printing into the app's stderr.
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Bumped when the meaning of a stored timeline changes — a different identity for
/// functions, a change to what a frame records. Without it a file written by an older
/// build is silently extended by this one, and the two halves of one timeline are
/// measuring different things.
///
/// That failure has a second cause this could not see, and it is worse here than anywhere:
/// a timeline is EXTENDED rather than rebuilt, so a parser change would append frames from
/// the new parse onto frames from the old one and produce a story that never happened —
/// functions appearing to be written on the day the grammar changed. [`Cached::parse`]
/// closes it, and it belongs in this file's rules beside `MINIFIED_LINE_BYTES` and
/// `VENDORED`, which are duplicated here for the same reason: what history refuses and how
/// history parses must move with the scan or the two disagree in silence.
///
/// Moved to 4 when a frame stopped being a commit and became a BUCKET of them — see
/// `FRAMES`. Old frames describe the same repo at a finer grain, and appending coarse ones
/// to fine ones would leave a timeline whose scrub bar means two different things at its two
/// ends.
///
/// Moved to 3 when `set` stopped meaning "every function in a file this commit touched"
/// and started meaning "the functions this commit changed" — same fields, same live state,
/// different claim. A stored timeline is EXTENDED rather than rebuilt, so without a bump an
/// old cache would keep replaying whole-file flashes for its old commits and land sparse
/// ones on the end: one timeline telling the story two ways, which is worse than the bug.
const CACHE_VERSION: u32 = 4;

#[derive(Serialize, Deserialize)]
struct Cached {
    version: u32,
    /// What the parser meant when these frames were folded — see
    /// [`crate::parse::PARSE_VERSION`]. A mismatch is a full replay, never an append.
    #[serde(default)]
    parse: u32,
    /// The window this was computed for. A different one is a different fold, so it gets
    /// its own file rather than being trimmed or extended into shape.
    limit: usize,
    scan: HistoryScan,
}

/// Where one repo's timeline is kept. Machine-local, beside the score cache — NOT in
/// `.sanity/`, which is the repo's committed assessment and holds only what cannot be
/// recomputed. Every byte here comes back from `git log`.
fn cache_path(repo: &Path, limit: usize) -> Option<PathBuf> {
    let dir = crate::reports::data_dir()?.join("timelines");
    std::fs::create_dir_all(&dir).ok()?;
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in repo.to_string_lossy().as_bytes() {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    // Named rather than numbered when unbounded — a file called `…-18446744073709551615`
    // is a number nobody can read as "the whole repo".
    let window = if limit == ALL_COMMITS { "all".to_string() } else { limit.to_string() };
    Some(dir.join(format!("{h:016x}-{window}.json")))
}

fn load_cache(repo: &Path, limit: usize) -> Option<HistoryScan> {
    let text = std::fs::read_to_string(cache_path(repo, limit)?).ok()?;
    let cached: Cached = serde_json::from_str(&text).ok()?;
    (cached.version == CACHE_VERSION
        && cached.parse == crate::parse::PARSE_VERSION
        && cached.limit == limit)
        .then_some(cached.scan)
}

/// What a timeline holds, without reading the timeline.
///
/// **A sidecar, because the answer is four bytes and the file is 170MB.** The sidebar wants
/// to say how many commits a repo has left to replay, on every poll, for every project. That
/// question is answered by `HistoryScan::commits.len()`, and reaching it through the cache
/// would mean parsing ceph's whole timeline twice a second.
///
/// Written beside the cache and never read as authority: a missing or stale one costs a
/// number in a sidebar, which is why nothing checks it against the timeline it describes.
#[derive(Serialize, Deserialize)]
struct Banked {
    head: String,
    commits: usize,
}

fn meta_path(repo: &Path, limit: usize) -> Option<PathBuf> {
    cache_path(repo, limit).map(|p| p.with_extension("meta.json"))
}

/// How many commits of `repo` have been replayed and stored. 0 when none have.
pub fn banked(repo: &Path, limit: usize) -> usize {
    meta_path(repo, limit)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<Banked>(&s).ok())
        .map(|b| b.commits)
        .unwrap_or(0)
}

/// Write a freshly walked timeline over whatever is banked — unless it walked nothing.
///
/// **A stopped walk must not erase the timeline it was resuming.** `save_cache` is
/// unconditional, and a cancel during the log read returns an empty scan, so without this the
/// act of stopping a resumed trace would write nothing over a banked hour — destroying the
/// thing the resume exists to protect. A walk that applied nothing has nothing to say, and
/// the other case it covers is a directory with no git history, which is instant to
/// recompute and has nothing worth storing.
///
/// Separate from `save_cache` because a CHECKPOINT is not this decision: it writes mid-walk,
/// on purpose, with fewer commits than the file it replaces might have had, and it is the
/// mechanism that makes resuming possible. Only the end of a full walk asks this question.
fn bank(repo: &Path, limit: usize, scan: &HistoryScan) {
    if scan.commits.is_empty() {
        return;
    }
    save_cache(repo, limit, scan);
}

fn save_cache(repo: &Path, limit: usize, scan: &HistoryScan) {
    let Some(path) = cache_path(repo, limit) else { return };
    // Nothing is reported when this fails. A reading that fails to save is an error the
    // agent must see, because the work is gone; a timeline that fails to save costs the
    // next replay some seconds and nothing else.
    if let (Some(meta), Ok(text)) = (
        meta_path(repo, limit),
        serde_json::to_string(&Banked { head: scan.head.clone(), commits: scan.commits.len() }),
    ) {
        let _ = std::fs::write(meta, text);
    }
    if let Ok(text) = serde_json::to_string(&Cached {
        version: CACHE_VERSION,
        parse: crate::parse::PARSE_VERSION,
        limit,
        scan: scan.clone(),
    }) {
        let _ = std::fs::write(path, text);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The same tripwire `scancache` and `cache` carry. See the original there.
    ///
    /// Sharper here than in either, because a timeline is EXTENDED rather than rebuilt: a
    /// field that loads as its default does not merely mislead one frame, it lets frames
    /// computed under two different meanings be appended into one story that never
    /// happened. `head` is already defaulted — that is what makes a rebase detectable — so
    /// a timeline written before it existed reads as "no head" and gets replayed whole,
    /// which is the safe direction. The next defaulted field may not have one.
    #[test]
    fn a_new_stored_timeline_field_cannot_be_added_silently() {
        let s = HistoryScan {
            paths: vec!["a.rs".into()],
            langs: vec!["Rust".into()],
            funcs: Vec::new(),
            base: Vec::new(),
            base_ts: 0,
            commits: Vec::new(),
            head: "abc".into(),
            truncated: 0,
        };
        let v: serde_json::Value = serde_json::to_value(&s).expect("HistoryScan serialises");
        let mut keys: Vec<&str> =
            v.as_object().expect("an object").keys().map(|k| k.as_str()).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            vec![
                // Wire names, not field names — this struct renames to camelCase, and the
                // wire is what a stored timeline is actually keyed by.
                "base",
                "baseTs",
                "commits",
                "funcs",
                "head",
                "langs",
                "paths",
                "truncated",
            ],
            "the stored timeline's fields changed — bump CACHE_VERSION, then update this list"
        );
    }

    #[test]
    fn raw_line_reads_a_plain_edit() {
        let c = parse_raw(":100644 100644 aaa bbb M\tsrc/main.rs").expect("parses");
        assert_eq!(c.path, "src/main.rs");
        assert_eq!(c.sha.as_deref(), Some("bbb"));
        assert!(c.from.is_none());
    }

    /// A rename has to retire the old path AND land the new one. Treating it as a plain
    /// add leaves the old file in the state map forever — the repo would grow a ghost
    /// copy of every file anybody ever moved, and the timeline's line count with it.
    #[test]
    fn raw_line_reads_a_rename_as_a_move() {
        let c = parse_raw(":100644 100644 aaa bbb R096\tsrc/old.rs\tsrc/new.rs").expect("parses");
        assert_eq!(c.path, "src/new.rs");
        assert_eq!(c.from.as_deref(), Some("src/old.rs"));
    }

    /// A copy leaves the source where it is. Retiring it would delete a file that is
    /// still in the tree.
    #[test]
    fn a_copy_does_not_retire_its_source() {
        let c = parse_raw(":100644 100644 aaa bbb C075\tsrc/a.rs\tsrc/b.rs").expect("parses");
        assert_eq!(c.path, "src/b.rs");
        assert!(c.from.is_none());
    }

    #[test]
    fn raw_line_reads_a_deletion() {
        let c = parse_raw(":100644 000000 aaa 000 D\tsrc/gone.rs").expect("parses");
        assert_eq!(c.path, "src/gone.rs");
        assert!(c.sha.is_none());
    }

    /// The same failure `same_named_functions_in_one_file_stay_apart` guards in
    /// `assessment`: a file's twins must not collapse into one identity, or the second
    /// one's arrival reads as the first one changing size.
    #[test]
    fn same_named_functions_in_one_file_stay_apart() {
        let src = "impl A { fn new() -> A { A } }\nimpl B { fn new() -> B { B } }\n";
        let state = functions_of("src/lib.rs", Lang::Rust, src);
        let keys: Vec<&str> = state.iter().map(|f| f.key.as_str()).collect();
        assert_eq!(keys.len(), 2, "both `new`s are present");
        assert_ne!(keys[0], keys[1], "and they are not the same function");
    }

    /// **A stopped walk must not overwrite the timeline it was resuming.**
    ///
    /// `read_cached` saves whatever `read` returns, and a cancel during the log read returns
    /// an empty one — so the act of stopping a resumed trace would have written nothing over
    /// a banked hour. The guard is that an empty walk is not worth caching, which is also
    /// true of the case it otherwise covers: a directory with no git history is instant to
    /// recompute and has nothing to store.
    #[test]
    fn a_cancelled_walk_does_not_erase_a_banked_timeline() {
        let dir = repo_with(4);
        let full = read_cached(dir.path(), ALL_COMMITS, &|_| {});
        assert_eq!(full.commits.len(), 4);
        assert_eq!(banked(dir.path(), ALL_COMMITS), 4, "four commits are on disk");

        // A walk that reaches nothing, exactly as a cancel during the log read produces.
        bank(dir.path(), ALL_COMMITS, &HistoryScan::default());
        assert_eq!(
            banked(dir.path(), ALL_COMMITS),
            4,
            "the banked timeline survived a walk that applied nothing"
        );
        assert_eq!(load_cache(dir.path(), ALL_COMMITS).map(|s| s.commits.len()), Some(4),);
    }

    /// **Stopping is checked, because "it can be stopped" is the claim, not the code.**
    ///
    /// The log read is the phase that used to be uninterruptible: `Command::output()` cannot
    /// be asked to stop, so a trace of a very large repo could not be abandoned until git
    /// had finished producing four hundred megabytes nobody was going to use. Streaming it
    /// makes the cancel flag reachable, and this is the assertion that it is actually
    /// reached — with the flag already set, the reader must give up at the first commit
    /// rather than draining the pipe.
    ///
    /// The prefix it keeps is deliberate and is why the break sits where it does: commits
    /// arrive oldest-first, so what a stopped read holds is a shorter STORY rather than a
    /// hole in the middle of one.
    #[test]
    fn a_cancelled_log_read_stops_at_the_first_commit() {
        let dir = repo_with(12);
        let (log, _) = commits(dir.path(), CommitRange::Last(ALL_COMMITS), &|_| {}, &|| true);
        assert_eq!(log.len(), 1, "stopped at the first commit header, not after all twelve");
    }

    /// The streamed reader and the batched one are one parser — `commits_named` still takes a
    /// whole `git log` as a string, and the day they disagree is the day a resumed walk and a
    /// fresh one produce different timelines from the same commits.
    #[test]
    fn streaming_and_batched_parsing_agree() {
        let dir = repo_with(6);
        let (streamed, _) = commits(dir.path(), CommitRange::Last(ALL_COMMITS), &|_| {}, &|| false);
        let named: Vec<String> = streamed.iter().map(|c| c.sha.clone()).collect();
        let batched = commits_named(dir.path(), &named);
        assert_eq!(streamed.len(), batched.len());
        for (a, b) in streamed.iter().zip(batched.iter()) {
            assert_eq!(a.sha, b.sha);
            assert_eq!(a.ts, b.ts);
            assert_eq!(a.subject, b.subject);
            assert_eq!(
                a.changes.iter().map(|c| &c.path).collect::<Vec<_>>(),
                b.changes.iter().map(|c| &c.path).collect::<Vec<_>>(),
            );
        }
    }

    /// A repo with `n` commits, each adding one function to `src/lib.rs`.
    fn repo_with(n: usize) -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        for i in 0..n {
            let body: String =
                (0..=i).map(|k| format!("fn f{k}() -> u32 {{\n    {k}\n}}\n")).collect();
            std::fs::write(dir.path().join("src.rs"), body).expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("commit {i}")]);
        }
        dir
    }

    /// What two timelines have to agree about. NOT the raw payload: function indices are
    /// assigned in the order the walk meets them, so a resumed walk and a fresh one can
    /// number the same repo differently and still describe it identically.
    fn shape(h: &HistoryScan) -> (Vec<String>, usize, Vec<(String, u32)>) {
        let mut live: BTreeMap<u32, u32> = h.base.iter().copied().collect();
        for c in &h.commits {
            for (f, loc) in &c.set {
                live.insert(*f, *loc);
            }
            for f in &c.del {
                live.remove(f);
            }
        }
        let mut alive: Vec<(String, u32)> = live
            .into_iter()
            .map(|(f, loc)| {
                let def = &h.funcs[f as usize];
                (key_of(&h.paths[def.path as usize], def), loc)
            })
            .collect();
        alive.sort();
        (h.commits.iter().map(|c| c.sha.clone()).collect(), h.truncated, alive)
    }

    /// A walk stopped halfway leaves a timeline that can be carried the rest of the way.
    ///
    /// **This is the whole of resuming, and the point is that it needs no new concept.** A
    /// checkpoint is [`Replayer::snapshot`] written to the cache mid-walk, and what it holds
    /// is a complete timeline of an older HEAD — the same thing on disk after a quiet
    /// afternoon as after a killed replay. So the recovery path is `extend`, which already
    /// exists, is already tested against a fresh replay, and already refuses a history that
    /// was rewritten underneath it.
    ///
    /// What this pins is the claim that makes that true: stop the walk at commit two, and
    /// what you are holding is exactly what a replay of the two-commit repo produces. If
    /// `snapshot` ever starts leaving something out, a resumed hour of parsing quietly
    /// becomes a story that never happened.
    #[test]
    fn a_walk_stopped_early_holds_what_a_shorter_walk_would_have() {
        let two = read(repo_with(2).path(), ALL_COMMITS, &|_| {});

        // The same repo with a third commit on top, walked by hand so the walk can be
        // stopped where a checkpoint would have landed.
        let dir = repo_with(3);
        let (log, _) = commits(dir.path(), CommitRange::Last(ALL_COMMITS), &|_| {}, &|| false);
        let mut blobs = Blobs::open(dir.path()).expect("a repo has blobs");
        let mut r = Replayer::empty();
        r.out.base_ts = log.first().map(|c| c.ts).unwrap_or(0);
        // Empty prefetch: `apply` falls back to parsing what it was not handed, which is
        // the path this exercises anyway.
        for commit in log.iter().take(2) {
            r.apply(&mut blobs, commit, &Parsed::new());
        }
        let parked = r.snapshot();

        assert_eq!(parked.head, log[1].sha, "a checkpoint names the last commit it applied");
        assert_eq!(parked.commits.len(), 2);
        // The functions and their sizes, not the whole shape: these are two temp repos, so
        // their commits are the same CONTENT under different shas, and comparing those
        // compares the fixture rather than the timeline.
        assert_eq!(shape(&parked).2, shape(&two).2);

        // And it carries forward to the same place a whole replay reaches.
        let resumed = extend(dir.path(), parked, ALL_COMMITS, &|_| {}).grew();
        assert_eq!(shape(&resumed), shape(&read(dir.path(), ALL_COMMITS, &|_| {})));
    }

    /// The whole point of the cache: a repo that gained a commit must not be re-parsed,
    /// and the timeline that comes out has to be the one a full replay would have
    /// produced. If these ever diverge, the app shows one story on a cold machine and a
    /// different one on a warm machine, with nothing on screen saying which.
    #[test]
    fn extending_a_cached_timeline_matches_replaying_it_whole() {
        let dir = repo_with(3);
        let cached = read(dir.path(), 10, &|_| {});
        assert_eq!(cached.commits.len(), 3);

        // One more commit, exactly as a working day produces.
        std::fs::write(dir.path().join("src.rs"), "fn only() -> u32 {\n    9\n}\n")
            .expect("writes");
        for args in [vec!["add", "-A"], vec!["commit", "-q", "-m", "four"]] {
            Command::new("git").arg("-C").arg(dir.path()).args(&args).output().expect("git runs");
        }

        let extended = extend(dir.path(), cached, 10, &|_| {}).grew();
        let fresh = read(dir.path(), 10, &|_| {});
        assert_eq!(shape(&extended), shape(&fresh));
    }

    /// The same, with the window overflowing — the case that exercises `fold`, where the
    /// resumed walk has to retire its oldest frames into the opening state and arrive at
    /// the same base a fresh walk parses out of a tree.
    #[test]
    fn extending_past_the_window_folds_to_the_same_state() {
        let dir = repo_with(3);
        let cached = read(dir.path(), 2, &|_| {});
        assert_eq!(cached.truncated, 1);

        std::fs::write(dir.path().join("src.rs"), "fn only() -> u32 {\n    9\n}\n")
            .expect("writes");
        for args in [vec!["add", "-A"], vec!["commit", "-q", "-m", "four"]] {
            Command::new("git").arg("-C").arg(dir.path()).args(&args).output().expect("git runs");
        }

        let extended = extend(dir.path(), cached, 2, &|_| {}).grew();
        let fresh = read(dir.path(), 2, &|_| {});
        assert_eq!(extended.commits.len(), 2);
        assert_eq!(shape(&extended), shape(&fresh));
    }

    /// A timeline with nothing left to apply is CURRENT, not broken.
    ///
    /// **Written because the distinction was missing and cost a repo its every open.** The
    /// walk skips merges, so its last commit is the newest non-merge one and not HEAD; the
    /// old check compared the stored head against `git rev-parse HEAD`, decided a finished
    /// timeline was stale, asked for it to be carried forward, was told "nothing ahead", and
    /// read that as "cannot carry" — replaying a hundred and twenty thousand commits on every
    /// open of the project. `Same` and `Refused` are separate outcomes for that reason.
    #[test]
    fn a_timeline_with_nothing_ahead_of_it_is_current() {
        let dir = repo_with(3);
        let cached = read(dir.path(), 10, &|_| {});
        assert!(matches!(extend(dir.path(), cached, 10, &|_| {}), Carry::Same(_)));
    }

    /// A rebase, an amend, a branch switch: the stored frames describe commits that are
    /// no longer on the way to HEAD. Appending to them would produce a timeline that
    /// never happened, so the answer is to refuse and replay.
    #[test]
    fn a_history_that_was_rewritten_is_not_extended() {
        let dir = repo_with(2);
        let mut cached = read(dir.path(), 10, &|_| {});
        cached.head = "0".repeat(40);
        assert!(matches!(extend(dir.path(), cached, 10, &|_| {}), Carry::Refused));
    }

    /// Vendored trees are somebody else's story. They are excluded here rather than by
    /// the walker `scan` uses, because git has no opinion about them — they were
    /// committed on purpose.
    #[test]
    fn vendored_paths_have_no_language() {
        assert!(lang_of("node_modules/react/index.js").is_none());
        assert!(lang_of("web/src/main.tsx").is_some());
        assert!(lang_of("README.md").is_none());
    }

    /// The claim is the guard, so it has to refuse a twin and it has to let go.
    ///
    /// **The failure it replaces was a guard that could not be enforced.** "One walk at a
    /// time" lived in the window as `busyKey`, which a reload clears while the walk carries
    /// on — so the row offered `Trace` over a repo already being walked and a press would
    /// have started a second. What matters here is the pair: a second claim is refused, and a
    /// claim that goes out of scope releases, or the first crashed walk would lock the repo
    /// out of tracing until the app restarted.
    #[test]
    fn one_walk_at_a_time_and_the_claim_lets_go() {
        let repo = std::path::Path::new("/repo/being/walked");
        let other = std::path::Path::new("/repo/next/door");
        assert!(tracing(repo).is_none(), "nothing is walking it yet");

        let claim = Tracing::claim(repo).expect("the first claim takes it");
        assert!(Tracing::claim(repo).is_none(), "the second is refused");
        assert!(
            Tracing::claim(other).is_some(),
            "another repo is another walk — the guard is per repo, not a global mutex"
        );

        // What anything asking between two ticks is told, which is the point of recording it
        // here rather than only emitting it at the window.
        claim.at(&Progress::counting("tracing", "traced", 7, 100));
        let seen = tracing(repo).expect("it reports where the walk is");
        assert_eq!((seen.done, seen.total), (7, 100));
        assert_eq!(seen.unit, "traced");

        drop(claim);
        assert!(tracing(repo).is_none(), "dropping the claim releases the repo");
        assert!(Tracing::claim(repo).is_some(), "so the next walk can take it");
    }
}

// ── Serving a timeline in windows ────────────────────────────────────────────────────────
//
// **The story stays here and the window borrows pieces of it.** A timeline used to cross to
// the frontend whole, which is right up to a few thousand commits and impossible past that:
// ceph's 122,792 are ~16MB of log metadata, ~47MB of deltas and a function table besides, and
// handing all of it over froze the app for as long as it took to parse. What the window
// actually needs at any moment is small — a screenful of log rows, the deltas between where
// the playhead is and where it is going — so this holds the timeline and answers questions
// about it.
//
// One at a time. Two timelines in memory is two hundred megabytes to save somebody the second
// open of a repo they left, and the cache already makes that fast.

/// The timeline currently loaded, and which repo it belongs to.
static LOADED: std::sync::Mutex<Option<(PathBuf, HistoryScan)>> = std::sync::Mutex::new(None);

/// Everything about a timeline that is NOT per-commit: the tables the tree is built from,
/// and the counts a transport needs.
///
/// Sent once when History opens. Big on a large repo — ceph's function table is tens of
/// megabytes — but bounded by the repo rather than by its history, which is the same size the
/// live map already carries.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tables {
    pub paths: Vec<String>,
    /// Which of those paths `.sanityignore` sets aside, parallel to `paths`.
    ///
    /// **Read from the repo as it is now, applied to every version of it.** A file the person
    /// has just declared not-their-code should not be the largest wedge in a replay either,
    /// and the alternative — the ignore file as it stood at each commit — would mean a wedge
    /// appearing and vanishing because somebody edited a config, which is a story about the
    /// config rather than about the code.
    ///
    /// The trace still WALKS them: what a timeline holds is what happened, and pruning at the
    /// walk would mean re-tracing an hour of a large repo every time this file changed.
    pub excluded: Vec<bool>,
    pub langs: Vec<String>,
    /// How many functions the timeline has ever held — the extent `history_funcs` pages
    /// through.
    ///
    /// **The functions themselves are NOT here, and that is the whole point of this field.**
    /// They were: every function every version of every file ever had, in the one payload
    /// that opens a replay. On ceph that is 19.8MB of a 20.1MB response, sent before a
    /// single frame can be drawn, when the frame being drawn is the repo as it stood in
    /// 2007 and refers to almost none of them. They page in beside the deltas that
    /// reference them — see `funcs` below.
    pub func_count: usize,
    pub base: Vec<(u32, u32)>,
    pub base_ts: i64,
    pub head: String,
    pub truncated: usize,
    /// How many frames the timeline holds. The scrub bar's extent, and the count the log
    /// pages through.
    pub commits: usize,
}

/// One row of the log: what a person reads, without what the map folds.
///
/// `set` and `del` are COUNTS here, not the arrays. The row prints `+12 −3`; shipping the
/// indices to print their length is most of the 47MB this exists to avoid.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogRow {
    pub sha: String,
    pub short: String,
    pub ts: i64,
    pub author: String,
    pub subject: String,
    pub sets: usize,
    pub dels: usize,
}

/// Load `repo`'s stored timeline, or keep the one already loaded.
fn with_loaded<T>(repo: &Path, f: impl FnOnce(&HistoryScan) -> T) -> Option<T> {
    let mut held = LOADED.lock().unwrap_or_else(|e| e.into_inner());
    let fresh = !matches!(held.as_ref(), Some((at, _)) if at == repo);
    if fresh {
        *held = Some((repo.to_path_buf(), stored(repo, ALL_COMMITS)?));
    }
    held.as_ref().map(|(_, scan)| f(scan))
}

/// Drop whatever is held. Called when a trace rewrites the timeline underneath it.
pub fn unload() {
    *LOADED.lock().unwrap_or_else(|e| e.into_inner()) = None;
}

pub fn tables(repo: &Path) -> Option<Tables> {
    let scope = crate::scan::scope_of(repo);
    with_loaded(repo, |s| Tables {
        excluded: s
            .paths
            .iter()
            .map(|p| {
                scope
                    .as_ref()
                    .is_some_and(|g| g.matched_path_or_any_parents(Path::new(p), false).is_ignore())
            })
            .collect(),
        paths: s.paths.clone(),
        langs: s.langs.clone(),
        func_count: s.funcs.len(),
        base: s.base.clone(),
        base_ts: s.base_ts,
        head: s.head.clone(),
        truncated: s.truncated,
        commits: s.commits.len(),
    })
}

/// Functions `[from, from + count)`, for a caller folding frames that refer to them.
///
/// **A PREFIX is a complete answer, which is what makes this pageable at all.** `intern`
/// appends a function the first time the walk meets it, and the walk runs oldest commit
/// first — so the functions a fold of commits `0..=n` can possibly name are exactly the
/// ones interned by commit `n`, and they sit at the front of this list. A caller that has
/// the deltas for a prefix of the story can take the highest index they mention and ask
/// for that much; nothing later can be referenced by anything it is holding.
///
/// Short reads at the end rather than an error, for the same reason `log` gives.
pub fn funcs(repo: &Path, from: usize, count: usize) -> Vec<HistoryFunc> {
    with_loaded(repo, |s| s.funcs.iter().skip(from).take(count).cloned().collect())
        .unwrap_or_default()
}

/// `count` log rows from `offset`, of the commits in `scope`.
///
/// Short reads at the end rather than an error: the caller is a scrolling list and the end of
/// a list is not a failure.
///
/// **Scoping moved here with the rest of the story.** Drilling into a directory narrows the
/// log to the commits that touched it, which is a question about every commit's file list —
/// the one part of a frame this deliberately does not send. Answering it here costs a prefix
/// test per commit and answering it there would cost the 47MB.
pub fn log(repo: &Path, offset: usize, count: usize, scope: &str) -> Vec<LogRow> {
    with_loaded(repo, |s| {
        let rows = s.commits.iter().enumerate();
        let rows: Box<dyn Iterator<Item = (usize, &HistoryCommit)>> = if scope.is_empty() {
            Box::new(rows)
        } else {
            Box::new(rows.filter(|(_, c)| touches(s, c, scope)))
        };
        rows.skip(offset)
            .take(count)
            .map(|(_, c)| c)
            .map(|c| LogRow {
                sha: c.sha.clone(),
                short: c.short.clone(),
                ts: c.ts,
                author: c.author.clone(),
                subject: c.subject.clone(),
                sets: c.set.len(),
                dels: c.del.len(),
            })
            .collect()
    })
    .unwrap_or_default()
}

/// Did this commit touch anything under `scope`?
///
/// Segment-wise, or `web/src` takes in `web/src-old` — the same rule the frontend's own
/// prefix test follows, and the reason this is a function rather than a `starts_with`.
fn touches(scan: &HistoryScan, c: &HistoryCommit, scope: &str) -> bool {
    c.files.iter().any(|f| {
        let p = &scan.paths[*f as usize];
        p.starts_with(scope) && p.as_bytes().get(scope.len()) == Some(&b'/')
    })
}

/// The real frame indices in `scope`, oldest first.
///
/// Integers rather than rows: this is what the transport addresses and what the scrub bar's
/// length is, and it is the whole list — a drilled repo whose subtree was touched by ninety
/// thousand commits has a scrub bar ninety thousand long, which is the honest one.
pub fn scoped(repo: &Path, scope: &str) -> Vec<u32> {
    with_loaded(repo, |s| {
        if scope.is_empty() {
            return (0..s.commits.len() as u32).collect();
        }
        s.commits
            .iter()
            .enumerate()
            .filter(|(_, c)| touches(s, c, scope))
            .map(|(i, _)| i as u32)
            .collect()
    })
    .unwrap_or_default()
}

/// The deltas for frames `[from, from + count)`, for a caller folding forward.
pub fn deltas(repo: &Path, from: usize, count: usize) -> Vec<serde_json::Value> {
    with_loaded(repo, |s| {
        s.commits
            .iter()
            .skip(from)
            .take(count)
            .map(|c| {
                serde_json::json!({
                    "ts": c.ts,
                    "author": c.author,
                    "set": c.set,
                    "del": c.del,
                    "files": c.files,
                })
            })
            .collect()
    })
    .unwrap_or_default()
}
