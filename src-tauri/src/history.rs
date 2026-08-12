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
//! and nothing else, and what colours them is recency — how long, *as of the frame's own
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
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};

/// Commits replayed, most recent first. Everything older becomes the opening frame.
///
/// A **backstop**, not a window anybody should hit. It was 400, chosen against the scrub
/// bar — at a thousand frames a pixel is four commits — and that traded away the thing
/// the feature is for: a repo whose first 584 commits are folded into frame one opens
/// with its directory structure already built, so the story starts in the middle and the
/// map appears to have sprung up on day one. Addressing a commit is the log's job, and
/// the log addresses all of them; only the bar was ever short.
///
/// What makes the whole log affordable is [`read_cached`] — the first replay is paid once
/// per repo and every later one costs the commits since. Matching `churn::MAX_COMMITS`
/// for the same reason it does: past this the oldest commits change nothing anybody is
/// looking at, and the payload starts to be the point.
///
/// What is dropped is never dropped silently — `truncated` is reported and the UI says
/// so, the same rule `excluded` follows in the scan.
pub const MAX_COMMITS: usize = 5000;

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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
    if path
        .split('/')
        .any(|c| VENDORED.contains(&c))
    {
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
            let slot = seen
                .entry((f.owner.clone(), f.name.clone()))
                .and_modify(|n| *n += 1)
                .or_insert(1);
            let ord = *slot;
            let owned = f.owner.clone().unwrap_or_default();
            let key = format!("{path}#{owned}::{}#{ord}", f.name);
            FuncAt { key, loc: f.loc(), ord, name: f.name, owner: f.owner }
        })
        .collect()
}

/// One entry of a commit's `--raw` diff: the blob to read and where it lands.
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
enum CommitRange {
    /// The most recent N, oldest first.
    Last(usize),
    /// Everything after this sha — what a resumed replay needs.
    Since(String),
}

/// The commit stream, oldest first, and how many were left off the front.
///
/// `--max-count` is applied *before* `--reverse`, so `Last` is the tail of history read
/// forwards, which is what the replay needs. Merges are excluded for the same reason
/// `churn` excludes them: a merge commit's diff attributes every line of the branch to
/// the moment it landed, which would make a whole subtree flare at once for work done
/// over weeks.
fn commits(repo: &Path, range: CommitRange) -> (Vec<RawCommit>, usize) {
    let total = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-list", "--no-merges", "--count", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.trim().parse::<usize>().ok())
        .unwrap_or(0);

    let selector = match &range {
        CommitRange::Last(limit) => format!("--max-count={limit}"),
        CommitRange::Since(sha) => format!("{sha}..HEAD"),
    };
    let out = Command::new("git")
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
        .output();
    let Ok(out) = out else {
        return (Vec::new(), 0);
    };
    let text = String::from_utf8_lossy(&out.stdout);

    let mut list: Vec<RawCommit> = Vec::new();
    for line in text.lines() {
        if let Some(head) = line.strip_prefix('\u{1}') {
            let mut f = head.split('\u{1f}');
            let (Some(sha), Some(ts), Some(author), Some(subject)) =
                (f.next(), f.next(), f.next(), f.next())
            else {
                continue;
            };
            list.push(RawCommit {
                sha: sha.to_string(),
                ts: ts.parse().unwrap_or(0),
                author: author.to_string(),
                subject: subject.to_string(),
                changes: Vec::new(),
            });
        } else if let Some(change) = parse_raw(line) {
            if let Some(c) = list.last_mut() {
                c.changes.push(change);
            }
        }
    }
    let dropped = match range {
        CommitRange::Last(limit) => total.saturating_sub(limit),
        CommitRange::Since(_) => 0,
    };
    (list, dropped)
}

/// Every source blob in one commit's tree — the opening state, when history is longer
/// than the window.
fn tree_of(repo: &Path, sha: &str) -> Vec<(String, String)> {
    let Ok(out) = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["ls-tree", "-r", sha])
        .output()
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

/// Read a batch of blobs, then parse them in parallel.
///
/// The split is the whole point: reading is one sequential conversation with a single git
/// process, and parsing is the expensive part and embarrassingly parallel. Interleaving
/// them would serialise the tree-sitter work behind the pipe.
fn parse_batch(blobs: &mut Blobs, want: Vec<(String, String)>) -> Vec<(String, FileState)> {
    // A refused blob still comes back, as an EMPTY state rather than as nothing at all.
    // Dropping it would leave the file's last good functions in the live state with no
    // commit able to remove them — a file that turns into a generated bundle would keep
    // its old wedges for the rest of the timeline.
    let sources: Vec<(String, Option<(Lang, String)>)> = want
        .into_iter()
        .filter_map(|(path, sha)| {
            let lang = lang_of(&path)?;
            let src = blobs.read(&sha).filter(|src| {
                // Refused here rather than at the git layer: minification is a property
                // of the bytes, and the only way to know is to have read them.
                !src.lines().any(|l| l.len() > MINIFIED_LINE_BYTES)
            });
            Some((path, src.map(|s| (lang, s))))
        })
        .collect();
    sources
        .into_par_iter()
        .map(|(path, src)| {
            let state = src
                .map(|(lang, text)| functions_of(&path, lang, &text))
                .unwrap_or_default();
            (path, state)
        })
        .collect()
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
        self.out
            .langs
            .push(lang_of(p).map(|l| l.label().to_string()).unwrap_or_default());
        self.paths.insert(p.to_string(), i);
        i
    }

    /// Parse a whole tree into the opening state — everything the commits before the
    /// window built.
    fn seed(&mut self, blobs: &mut Blobs, tree: Vec<(String, String)>) {
        for (path, state_of) in parse_batch(blobs, tree) {
            let pi = self.path_idx(&path);
            for f in &state_of {
                let fi = self.funcs.intern(pi, f);
                self.out.base.push((fi, f.loc));
            }
            self.state.insert(path, state_of);
        }
    }

    /// Apply one commit, appending its frame.
    fn apply(&mut self, blobs: &mut Blobs, commit: &RawCommit) {
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

        let want: Vec<(String, String)> = commit
            .changes
            .iter()
            .filter_map(|c| {
                let sha = c.sha.clone()?;
                lang_of(&c.path).map(|_| (c.path.clone(), sha))
            })
            .collect();

        for (path, next) in parse_batch(blobs, want) {
            let pi = self.path_idx(&path);
            frame.files.push(pi);
            let prev = self.state.get(&path).cloned().unwrap_or_default();
            for f in &next {
                let fi = self.funcs.intern(pi, f);
                // Emitted whether or not the size changed. A frame's `set` is what the
                // commit *touched*, not only what it resized — the glow is the story, and
                // a rewrite that keeps the line count is still a rewrite.
                frame.set.push((fi, f.loc));
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
    /// leaves it uncoloured rather than dating it to the edge of the window.
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
}

/// Replay `repo`'s history into frames the sunburst can draw.
///
/// Never fails: a directory with no git history is a perfectly reasonable thing to open,
/// it simply has no story to tell, and an empty timeline says so honestly.
pub fn read(repo: &Path, limit: usize, progress: &dyn Fn(Progress)) -> HistoryScan {
    let (log, truncated) = commits(repo, CommitRange::Last(limit));
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
    progress(Progress { done: 0, total });

    // The opening state: everything the truncated commits built, parsed once from the tree
    // of the commit *before* the window. Skipped entirely when the window covers the whole
    // repo, which is where the timeline should start empty.
    if truncated > 0 {
        let tree = tree_of(repo, &format!("{}^", log[0].sha));
        r.seed(&mut blobs, tree);
    }
    progress(Progress { done: 1, total });

    for (n, commit) in log.iter().enumerate() {
        r.apply(&mut blobs, commit);
        progress(Progress { done: n + 2, total });
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
    let head = head_of(repo);
    if let Some(cached) = load_cache(repo, limit) {
        if !head.is_empty() && cached.head == head {
            progress(Progress { done: 1, total: 1 });
            return cached;
        }
        if let Some(scan) = extend(repo, cached, limit, progress) {
            save_cache(repo, limit, &scan);
            return scan;
        }
    }
    let scan = read(repo, limit, progress);
    save_cache(repo, limit, &scan);
    scan
}

/// Carry a cached scan forward to HEAD, or `None` if it cannot be carried.
fn extend(
    repo: &Path,
    cached: HistoryScan,
    limit: usize,
    progress: &dyn Fn(Progress),
) -> Option<HistoryScan> {
    if cached.head.is_empty() || !is_ancestor(repo, &cached.head) {
        // A rebase, an amend, or a checkout of another branch. The stored frames describe
        // commits that are no longer on the path to HEAD, and appending to them would
        // produce a timeline that never happened.
        return None;
    }
    let (log, _) = commits(repo, CommitRange::Since(cached.head.clone()));
    if log.is_empty() {
        return None;
    }
    // Past this the append is doing the whole window's work with none of its clarity.
    if log.len() > limit {
        return None;
    }
    let mut blobs = Blobs::open(repo)?;
    let mut r = Replayer::resume(cached);
    let total = log.len();
    for (n, commit) in log.iter().enumerate() {
        r.apply(&mut blobs, commit);
        progress(Progress { done: n + 1, total });
    }
    r.fold(limit);
    Some(r.finish())
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
    read_cached(repo, limit, &|_| {});
    true
}

fn head_of(repo: &Path) -> String {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
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
const CACHE_VERSION: u32 = 2;

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
    Some(dir.join(format!("{h:016x}-{limit}.json")))
}

fn load_cache(repo: &Path, limit: usize) -> Option<HistoryScan> {
    let text = std::fs::read_to_string(cache_path(repo, limit)?).ok()?;
    let cached: Cached = serde_json::from_str(&text).ok()?;
    (cached.version == CACHE_VERSION
        && cached.parse == crate::parse::PARSE_VERSION
        && cached.limit == limit)
        .then_some(cached.scan)
}

fn save_cache(repo: &Path, limit: usize, scan: &HistoryScan) {
    let Some(path) = cache_path(repo, limit) else { return };
    // Nothing is reported when this fails. A reading that fails to save is an error the
    // agent must see, because the work is gone; a timeline that fails to save costs the
    // next replay some seconds and nothing else.
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
                "base", "baseTs", "commits", "funcs", "head", "langs", "paths", "truncated",
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

    /// A repo with `n` commits, each adding one function to `src/lib.rs`.
    fn repo_with(n: usize) -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git")
                .arg("-C")
                .arg(dir.path())
                .args(args)
                .output()
                .expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        for i in 0..n {
            let body: String = (0..=i)
                .map(|k| format!("fn f{k}() -> u32 {{\n    {k}\n}}\n"))
                .collect();
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
        std::fs::write(dir.path().join("src.rs"), "fn only() -> u32 {\n    9\n}\n").expect("writes");
        for args in [vec!["add", "-A"], vec!["commit", "-q", "-m", "four"]] {
            Command::new("git").arg("-C").arg(dir.path()).args(&args).output().expect("git runs");
        }

        let extended = extend(dir.path(), cached, 10, &|_| {}).expect("extends");
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

        std::fs::write(dir.path().join("src.rs"), "fn only() -> u32 {\n    9\n}\n").expect("writes");
        for args in [vec!["add", "-A"], vec!["commit", "-q", "-m", "four"]] {
            Command::new("git").arg("-C").arg(dir.path()).args(&args).output().expect("git runs");
        }

        let extended = extend(dir.path(), cached, 2, &|_| {}).expect("extends");
        let fresh = read(dir.path(), 2, &|_| {});
        assert_eq!(extended.commits.len(), 2);
        assert_eq!(shape(&extended), shape(&fresh));
    }

    /// A rebase, an amend, a branch switch: the stored frames describe commits that are
    /// no longer on the way to HEAD. Appending to them would produce a timeline that
    /// never happened, so the answer is to refuse and replay.
    #[test]
    fn a_history_that_was_rewritten_is_not_extended() {
        let dir = repo_with(2);
        let mut cached = read(dir.path(), 10, &|_| {});
        cached.head = "0".repeat(40);
        assert!(extend(dir.path(), cached, 10, &|_| {}).is_none());
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
}
