//! Machine-local memo of the two per-file costs in a scan: the tree-sitter parse and
//! `git blame`.
//!
//! # Why this exists
//!
//! `open_project` rescans on every open, deliberately — staleness is decided by comparing
//! each reading's hash against the body in the CURRENT scan, so an open that reused an old
//! scan could not see that the code had moved under it. That decision is right and this
//! module does not touch it. What it changes is the cost, which was measured on
//! PrusaSlicer (2,518 C/C++ files, 849k lines) at **51.5s per open**:
//!
//! | phase | time |
//! |---|---|
//! | `Blame::read` — one `git blame --line-porcelain` per file, across 8 cores | 29.4s |
//! | parse + `score_dir` | ~21s |
//! | `churn::read` — one `git log` | 0.5s |
//!
//! Both dominant phases are *per file* and *determined by that file's content*. A file
//! nobody touched cannot have a different parse tree or different blame, so re-deriving
//! them is the same work producing the same answer. That is the argument `history.rs`
//! already makes for itself — "Only changed files are re-parsed" — applied to the path
//! that never got it.
//!
//! # Why it is machine-local, like the timeline cache and unlike `.sanity/`
//!
//! The repo holds what cannot be recomputed. This is derivable from the working tree and
//! the object database in full, it is tens of megabytes, and it changes on every edit —
//! in-repo it would be a conflicting blob on every branch and a dirty `git status` after
//! merely looking at a project. A failed write here is silent for the same reason a failed
//! timeline write is: nothing is lost that the repo cannot produce again, and the next open
//! is merely as slow as every open used to be.
//!
//! # What decides that a file is unchanged
//!
//! `(mtime, len)` is a **gate**, not the key. It is what lets the common case skip reading
//! the file at all; when it matches, the entry is trusted. When it does not, the bytes are
//! read and hashed, and a matching hash still reuses the entry — a reformat that rewrites a
//! file to identical content, or a checkout that restores an mtime, must not cost a
//! re-parse. The gate is the same idiom `resync_changed` uses in the queue path, and for
//! the same reason: **git knows what is committed, and the tree is dirty exactly when you
//! reopen.** A cache keyed on HEAD alone would serve the previous parse for the file you
//! just edited, which is the one thing this whole instrument must never do.
//!
//! # Blame needs one more thing than content
//!
//! Blame for a file depends only on the commits that touched *that file*, so an unchanged
//! file on a fast-forwarded history blames identically — a commit that does not touch a
//! file cannot appear in its blame. Content hash is therefore nearly sufficient, and it has
//! exactly one hole: revert-and-reapply returns the bytes to an old hash while the blame
//! now points at the newer commits. So the blame half also carries the oid of the last
//! commit to touch the file, which `churn::read` already knows — it walks
//! `git log --name-only` for the churn window regardless, so this costs nothing to collect.
//!
//! A file whose last touch is older than `churn::MAX_COMMITS` has no oid in that walk. It
//! is cached under [`ANCIENT`] rather than left uncacheable: a file untouched in five
//! thousand commits cannot have its blame changed by anything short of a rewritten history,
//! and a rewritten history drops the blame half wholesale (see [`ScanCache::open`]).

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::blame::FileBlame;
use crate::model::Lang;
use crate::parse::FuncDef;

/// Bumped when any cached shape changes. A cache from an older format is dropped, never
/// migrated — the same rule `cache.rs` states for scores, and for a stronger reason here:
/// a half-understood parse entry would put functions at lines they are not at, and every
/// reading taken against those lines would be a reading about nothing.
///
/// 4 because the stored `FuncDef` gained `calls`. `PARSE_VERSION` moved with it and would
/// have dropped these entries on its own; both are bumped because they answer different
/// questions — the record's SHAPE changed and so did what a parse MEANS — and declaring only
/// the one you happened to think of is how the next reader learns the wrong rule.
const FORMAT_VERSION: u32 = 5;

/// Stand-in oid for "not touched inside the churn window". See the module docs.
const ANCIENT: &str = "-";

/// Append after this many changed entries. A scan that is killed halfway should not throw
/// away the files it did get through, and on a cold PrusaSlicer open there are 2,518 of
/// them.
const FLUSH_EVERY: usize = 400;

/// Rewrite the log once it holds this many times more lines than there are live entries.
///
/// The log is append-only, so a re-scan that touches every file writes every file again and
/// the old lines are dead weight the next open has to parse past. Compacting at 2× trades
/// one full write for a file that never drifts far from the size of what it holds.
const COMPACT_RATIO: usize = 2;

/// One file's memo. Parse and blame are stored side by side but invalidate independently:
/// an edit costs both, a rebase costs only the blame.
#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    /// Modification time, nanoseconds since the epoch. Half the gate.
    mtime: u128,
    /// Byte length. The other half — two writes in one second can share an mtime, which is
    /// the same hazard `resync_changed` guards against by pairing them.
    len: u64,
    /// FNV of the file's bytes. The actual key; the gate above only decides whether we
    /// bother to compute it.
    hash: u64,
    lang: Lang,
    funcs: Vec<FuncDef>,
    /// The module's own banner — see [`crate::parse::file_doc`]. Cached with the parse
    /// because it is derived from the same bytes by the same pass.
    #[serde(default)]
    file_doc: Option<String>,
    head: String,
    /// Absent when blame failed or was invalidated on its own. Untracked files, symlinks
    /// and non-repos are a per-file blame failure by design, and caching the absence would
    /// make a file that later gets committed keep its missing history.
    blame: Option<FileBlame>,
    /// Oid of the last commit touching this file when `blame` was taken, or [`ANCIENT`].
    blame_commit: String,
}

#[derive(Serialize, Deserialize, Default)]
struct Stored {
    version: u32,
    /// What the parser meant when these entries were written — see
    /// [`crate::parse::PARSE_VERSION`].
    ///
    /// Separate from `version` because they answer different questions and have different
    /// blast radii on the way in: `version` asks whether this file can be READ, and a
    /// mismatch means the bytes on disk are a shape nothing here understands. This asks
    /// whether what was read still MEANS what it meant, and a mismatch means the records
    /// parse perfectly and describe a repo as an older parser saw it. Folding the two into
    /// one integer would work and would lose that distinction the first time somebody had
    /// to reason about which one had fired.
    #[serde(default)]
    parse: u32,
    /// HEAD when this cache was last written, so a rewritten history can be detected.
    head: String,
    entries: HashMap<String, Entry>,
}

/// What the caller learned about a file while deciding whether the cache applies.
///
/// Returned by [`ScanCache::look`] so the caller does not stat or read twice. `Fresh`
/// carries the bytes precisely because a miss must go on to parse them.
pub enum Look {
    /// Cached and current. Nothing was read from disk.
    Hit(Hit),
    /// Not usable — here are the bytes and the identity to store the result under.
    Miss { src: String, ident: Ident },
    /// The file could not be read at all. The caller drops it, as it always did.
    Unreadable,
}

/// Everything a hit supplies in place of a parse.
pub struct Hit {
    pub lang: Lang,
    pub funcs: Vec<FuncDef>,
    pub file_doc: Option<String>,
    pub head: String,
    pub ident: Ident,
    /// `None` means blame was invalidated on its own and must be re-taken even though the
    /// parse was reusable.
    pub blame: Option<FileBlame>,
}

/// What a freshly-read file is stored under.
#[derive(Clone)]
pub struct Ident {
    pub mtime: u128,
    pub len: u64,
    pub hash: u64,
}

pub struct ScanCache {
    path: Option<PathBuf>,
    /// The parsed log, read on FIRST USE rather than on open.
    ///
    /// **A launch that needs nothing from here should not read it.** The store holds function
    /// bodies, so on a large repo it is enormous — 300MB on ceph — and every project came on
    /// screen by opening it, whether or not a single file had changed. With the finished tree
    /// cached (see `treecache`) the common launch touches no entry at all, and the biggest
    /// read in the app became the one nobody needed.
    ///
    /// `None` means unread, not empty: an ephemeral cache starts `Some(default)` and never
    /// touches the disk.
    inner: Mutex<Option<Stored>>,
    /// Keys changed since the last append, and how many lines the log holds.
    ///
    /// **This is what stopped the cache being quadratic.** `save` used to serialise the
    /// WHOLE store and rewrite the file every [`FLUSH_EVERY`] entries, so a scan of n files
    /// wrote O(n²) bytes — invisible on a repo of a few hundred, and 323MB rewritten over
    /// and over on a tree of a hundred thousand. The store holds function *bodies*, so the
    /// constant is large. Only what changed is written now.
    dirty: Mutex<Dirty>,
    /// Blame entries are dropped on load when history was rewritten. Recorded so the
    /// current HEAD can be written back on save.
    head: String,
    /// Kept for the ancestry test the deferred load performs — see `store`.
    repo: PathBuf,
}

#[derive(Default)]
struct Dirty {
    /// Entries written to the map but not yet to the log.
    keys: std::collections::HashSet<String>,
    /// Lines currently in the log, live and superseded alike — the compaction trigger.
    lines: usize,
    /// Something was REMOVED, which an append cannot express. Only a rewrite can, so this
    /// forces one at the next opportunity: without it a `retain` would be invisible on
    /// disk and the dropped files would come back on the next open.
    rewrite: bool,
}

impl ScanCache {
    /// A cache with nowhere to write.
    ///
    /// Used by the tests and by the headless scanner, where persisting across runs would
    /// make an experiment answer from a file instead of from the thing being measured —
    /// the same rule `just history` follows by running uncached by default.
    pub fn ephemeral() -> ScanCache {
        ScanCache {
            path: None,
            inner: Mutex::new(Some(Stored {
                version: FORMAT_VERSION,
                parse: crate::parse::PARSE_VERSION,
                ..Default::default()
            })),
            dirty: Mutex::new(Dirty::default()),
            head: String::new(),
            repo: PathBuf::new(),
        }
    }

    /// Load the cache for `repo`, dropping what no longer applies.
    ///
    /// Two levels of invalidation, because they have different blast radii. A format
    /// change drops everything. A **rewritten** history — the cached HEAD is not an
    /// ancestor of the current one, the test `history.rs` uses before it appends to a
    /// timeline — drops only the blame halves, because a rebase changes who touched a line
    /// without changing a single byte in the working tree, while the parse of those
    /// unchanged bytes is still perfectly good.
    pub fn open(repo: &Path) -> ScanCache {
        ScanCache {
            path: Self::path_for(repo),
            // Unread. The file is opened by `store` on the first entry anybody asks for,
            // which on a launch whose tree came from `treecache` is never.
            inner: Mutex::new(None),
            dirty: Mutex::new(Dirty { keys: Default::default(), lines: 0, rewrite: false }),
            head: git_head(repo),
            repo: repo.to_path_buf(),
        }
    }

    /// Read the file now, so the wait for it belongs to a phase that can name it.
    ///
    /// **Laziness is right; being lazy under somebody else's label is not.** `store` reads on
    /// the first entry anybody asks for, which is the first `parse_file` — and it holds the
    /// mutex while it does, so every rayon worker queues behind one thread reading the file.
    /// On a repo the size of linux that file is **1.3 GB**, and the scan sat there with the
    /// window still showing `reading the commit log`, the phase before it, which takes 1.8s.
    /// A pause two orders of magnitude longer than its own label reads as a hang, and did.
    ///
    /// Costs nothing where there is nothing to read: a repo with no cache, or one whose tree
    /// came from `treecache` and never reaches the parse, still never opens the file.
    pub fn warm(&self) {
        // `drop`, not `let _ =`: the latter drops a lock guard immediately too, but reads as
        // "ignore this value" rather than "release the lock now", and the lint that rejects
        // it is right to. Releasing is exactly what is wanted — the point of this call is
        // the load it performs on the way, not the guard it hands back.
        drop(self.store());
    }

    /// The store, read from disk if this is the first time anybody has asked.
    ///
    /// The invalidation that used to happen in `open` happens here, unchanged and for the
    /// same reasons: a format or parser change drops everything, because entries written by
    /// a different parser are internally consistent and describe a repo nobody is looking
    /// at; a REWRITTEN history drops only the blame halves, because a rebase changes who
    /// touched a line without changing a byte in the working tree, and the parse of those
    /// unchanged bytes is still good.
    fn store(&self) -> std::sync::MutexGuard<'_, Option<Stored>> {
        let mut held = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if held.is_some() {
            return held;
        }
        let (mut stored, lines) = self
            .path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .map(|s| read_log(&s))
            .filter(|(s, _)| s.version == FORMAT_VERSION && s.parse == crate::parse::PARSE_VERSION)
            .unwrap_or_else(|| {
                (
                    Stored {
                        version: FORMAT_VERSION,
                        parse: crate::parse::PARSE_VERSION,
                        head: self.head.clone(),
                        entries: HashMap::new(),
                    },
                    0,
                )
            });
        if !stored.head.is_empty()
            && !stored.head.eq(&self.head)
            && !is_ancestor(&self.repo, &stored.head)
        {
            for e in stored.entries.values_mut() {
                e.blame = None;
            }
        }
        self.dirty.lock().unwrap_or_else(|e| e.into_inner()).lines = lines;
        *held = Some(stored);
        held
    }

    /// One file per repo. Hashed rather than escaped, because repo paths hold separators
    /// and characters that are illegal in a filename on at least one platform we ship to —
    /// the same reasoning as `cache::path_for`.
    fn path_for(repo: &Path) -> Option<PathBuf> {
        let dir = crate::reports::data_dir()?.join("scans");
        std::fs::create_dir_all(&dir).ok()?;
        let id = fnv(repo.to_string_lossy().as_bytes());
        Some(dir.join(format!("{id:016x}.json")))
    }

    /// Decide whether `path`'s memo still applies, reading the file only if it must.
    ///
    /// `last_commit` is the oid of the newest commit touching this file, or `None` when it
    /// falls outside the churn window — see the module docs for why that is cacheable
    /// rather than uncacheable.
    pub fn look(&self, rel_path: &str, path: &Path, last_commit: Option<&str>) -> Look {
        let want = last_commit.unwrap_or(ANCIENT);
        let meta = std::fs::metadata(path).ok();
        let gate = meta.as_ref().and_then(|m| {
            Some((
                m.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_nanos(),
                m.len(),
            ))
        });

        // The fast path: the gate matches, so the bytes are not read and not hashed.
        if let (Some((mtime, len)), Some(inner)) = (gate, self.store().as_ref()) {
            if let Some(e) = inner.entries.get(rel_path) {
                if e.mtime == mtime && e.len == len {
                    return Look::Hit(Hit {
                        lang: e.lang,
                        funcs: e.funcs.clone(),
                        file_doc: e.file_doc.clone(),
                        head: e.head.clone(),
                        ident: Ident { mtime, len, hash: e.hash },
                        blame: if e.blame_commit == want { e.blame.clone() } else { None },
                    });
                }
            }
        }

        let Ok(src) = std::fs::read_to_string(path) else {
            return Look::Unreadable;
        };
        let hash = fnv(src.as_bytes());
        let (mtime, len) = gate.unwrap_or((0, src.len() as u64));
        let ident = Ident { mtime, len, hash };

        // The gate missed but the content is the same — a reformat that rewrote the file
        // byte-identically, a checkout, a `touch`. Reuse, and let the save restamp the gate
        // so the next open takes the fast path.
        if let Some(inner) = self.store().as_ref() {
            if let Some(e) = inner.entries.get(rel_path) {
                if e.hash == hash {
                    return Look::Hit(Hit {
                        lang: e.lang,
                        funcs: e.funcs.clone(),
                        file_doc: e.file_doc.clone(),
                        head: e.head.clone(),
                        ident,
                        blame: if e.blame_commit == want { e.blame.clone() } else { None },
                    });
                }
            }
        }
        Look::Miss { src, ident }
    }

    /// The stored blame for a file, if it was taken against these exact bytes and this
    /// exact last-touching commit.
    ///
    /// Both conditions, not either. The hash alone misses revert-and-reapply; the oid
    /// alone misses an uncommitted edit, which is the state a repo is in precisely when
    /// somebody reopens it.
    pub fn cached_blame(
        &self,
        rel_path: &str,
        hash: u64,
        last_commit: Option<&str>,
    ) -> Option<FileBlame> {
        let held = self.store();
        let inner = held.as_ref()?;
        let e = inner.entries.get(rel_path)?;
        if e.hash != hash || e.blame_commit != last_commit.unwrap_or(ANCIENT) {
            return None;
        }
        e.blame.clone()
    }

    /// Store a freshly parsed file. Blame is filled in separately by [`Self::put_blame`],
    /// because it is taken in its own pass over a different list.
    pub fn put_parse(
        &self,
        rel_path: &str,
        ident: &Ident,
        lang: Lang,
        funcs: &[FuncDef],
        file_doc: Option<&str>,
        head: &str,
    ) {
        let mut held = self.store();
        let Some(inner) = held.as_mut() else {
            return;
        };
        let prev = inner.entries.get(rel_path);
        // Blame is carried across only when it was taken against these exact bytes.
        // Anything else and it belongs to a file that no longer exists.
        let (blame, blame_commit) = match prev {
            Some(p) if p.hash == ident.hash => (p.blame.clone(), p.blame_commit.clone()),
            _ => (None, String::new()),
        };
        inner.entries.insert(
            rel_path.to_string(),
            Entry {
                mtime: ident.mtime,
                len: ident.len,
                hash: ident.hash,
                lang,
                funcs: funcs.to_vec(),
                file_doc: file_doc.map(str::to_string),
                head: head.to_string(),
                blame,
                blame_commit,
            },
        );
        drop(held);
        self.touched(rel_path);
    }

    /// Store blame for a file whose parse entry already exists. A blame with no parse entry
    /// is dropped rather than stored alone: the gate lives on the parse entry, so an
    /// orphan could never be invalidated.
    pub fn put_blame(&self, rel_path: &str, blame: Option<&FileBlame>, last_commit: Option<&str>) {
        let mut held = self.store();
        let Some(inner) = held.as_mut() else {
            return;
        };
        if let Some(e) = inner.entries.get_mut(rel_path) {
            e.blame = blame.cloned();
            e.blame_commit = last_commit.unwrap_or(ANCIENT).to_string();
        }
        drop(held);
        self.touched(rel_path);
    }

    /// Forget files that are no longer in the scan, so a cache cannot outgrow the repo it
    /// describes — a deleted directory would otherwise be carried forever.
    pub fn retain(&self, live: &std::collections::HashSet<String>) {
        let dropped = {
            let mut held = self.store();
            let Some(inner) = held.as_mut() else { return };
            let before = inner.entries.len();
            inner.entries.retain(|k, _| live.contains(k));
            before != inner.entries.len()
        };
        // A removal cannot be appended — the log only ever says "this key now looks like
        // this". So it is recorded as owed, and the next write is a full rewrite.
        if dropped {
            if let Ok(mut d) = self.dirty.lock() {
                d.rewrite = true;
            }
        }
    }

    /// Note a changed key, and append once enough have piled up.
    fn touched(&self, key: &str) {
        let flush = {
            let Ok(mut d) = self.dirty.lock() else { return };
            d.keys.insert(key.to_string());
            d.keys.len() >= FLUSH_EVERY
        };
        if flush {
            self.save();
        }
    }

    /// Write out what has changed, compacting when the log has grown too far past the
    /// thing it describes. Silent on failure, by the argument in the module docs.
    ///
    /// **Appends by default.** The cost of a write is the size of what CHANGED, not the
    /// size of the store, which is the whole point — see [`ScanCache::dirty`].
    pub fn save(&self) {
        let Some(path) = &self.path else { return };
        let mut held = self.store();
        let Some(inner) = held.as_mut() else { return };
        let Ok(mut d) = self.dirty.lock() else { return };
        inner.head = self.head.clone();

        let stale = d.lines > inner.entries.len() * COMPACT_RATIO + FLUSH_EVERY;
        if d.rewrite || stale || d.lines == 0 {
            // Whole file, via a temporary and a rename: a kill partway through would
            // otherwise leave a truncated last line, and while the reader drops those, a
            // half-written REWRITE would lose everything before it too.
            let mut s = header_line(inner);
            for (k, e) in &inner.entries {
                s.push_str(&entry_line(k, e));
            }
            let tmp = path.with_extension("tmp");
            if std::fs::write(&tmp, s).is_ok() && std::fs::rename(&tmp, path).is_ok() {
                d.lines = inner.entries.len() + 1;
                d.rewrite = false;
                d.keys.clear();
            }
            return;
        }

        // The common path: one line per changed file, appended.
        let mut s = String::new();
        let mut n = 0;
        for k in d.keys.iter() {
            if let Some(e) = inner.entries.get(k) {
                s.push_str(&entry_line(k, e));
                n += 1;
            }
        }
        if s.is_empty() {
            d.keys.clear();
            return;
        }
        use std::io::Write;
        // `create` as well as `append`. The append path relied on the rewrite branch
        // having built the file, so deleting the cache while the process was live made
        // every later save a silent no-op — the log the appends were going to no longer
        // existed, and nothing here reads the error.
        let appended = std::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(path)
            .and_then(|mut f| f.write_all(s.as_bytes()));
        if appended.is_ok() {
            d.lines += n;
            d.keys.clear();
        }
    }
}

/// One JSON object per line: a header, then one per file, last mention winning.
///
/// A log rather than a document because the write pattern is "one more file is done", and
/// re-encoding the whole store to say that is what made a large tree quadratic. The cost is
/// that a reader has to apply the lines in order, and that removals need a rewrite — both
/// cheap next to serialising hundreds of megabytes on a timer.
fn header_line(s: &Stored) -> String {
    serde_json::to_string(
        &serde_json::json!({ "version": s.version, "parse": s.parse, "head": s.head }),
    )
    .unwrap_or_default()
        + "\n"
}

fn entry_line(key: &str, e: &Entry) -> String {
    serde_json::to_string(&serde_json::json!({ "k": key, "e": e })).unwrap_or_default() + "\n"
}

/// Fold a log back into a store, and say how many lines it took.
///
/// A trailing partial line is dropped rather than fatal: an append killed mid-write leaves
/// exactly that, and everything before it is still perfectly good. This is the property the
/// old format did not have — one truncated document parsed as garbage and cost the next
/// open its entire cache.
/// One cached file, as it sits on disk: a key and its entry.
#[derive(Deserialize)]
struct Row {
    k: String,
    e: Entry,
}

/// The first line, which describes the cache rather than a file.
#[derive(Deserialize)]
struct Header {
    #[serde(default)]
    version: u32,
    /// Absent is 0, which matches no real parse version and therefore drops the cache — the
    /// honest reading of a header written before the parser was versioned at all.
    #[serde(default)]
    parse: u32,
    #[serde(default)]
    head: String,
}

/// Read the log back.
///
/// **Once per line, and in parallel.** This is the first thing a scan does and on a large
/// repo it is most of what "walking the repo" was covering: ceph's cache is 300MB, and every
/// line of it was parsed into a `serde_json::Value`, cloned, and parsed a second time into an
/// `Entry` — three passes over the same bytes, on one core, before the walk had started.
///
/// A line is independent of every other line, which is what the format was chosen for (see
/// the note on appending above), so the work is `rayon`'s to spread. The header is read on
/// its own because it is the one line that is not a file.
fn read_log(text: &str) -> (Stored, usize) {
    let mut out = Stored { version: 0, parse: 0, head: String::new(), entries: HashMap::new() };
    let mut lines = text.lines().filter(|l| !l.is_empty());
    let Some(head) = lines.next() else { return (out, 0) };
    if let Ok(h) = serde_json::from_str::<Header>(head) {
        out.version = h.version;
        out.parse = h.parse;
        out.head = h.head;
    }
    let rest: Vec<&str> = lines.collect();
    let rows: Vec<Row> =
        rest.par_iter().filter_map(|l| serde_json::from_str::<Row>(l).ok()).collect();
    let read = rows.len() + 1;
    out.entries = rows.into_iter().map(|r| (r.k, r.e)).collect();
    (out, read)
}

fn git_head(repo: &Path) -> String {
    std::process::Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

/// Is `old` an ancestor of HEAD? A `false` here means the history was rewritten, which is
/// the same test `history.rs` makes before it appends to a cached timeline.
fn is_ancestor(repo: &Path, old: &str) -> bool {
    std::process::Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["merge-base", "--is-ancestor", old, "HEAD"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Named for FNV-1a's shape; the multiplier is not FNV-1a's prime. The twin in `cache.rs`
/// says the same thing, and both stay wrong together rather than one of them being quietly
/// corrected into disagreeing with the other.
fn fnv(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    h
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn func(name: &str) -> FuncDef {
        FuncDef {
            name: name.to_string(),
            signature: format!("fn {name}()"),
            body: "{ 1 }".into(),
            doc: None,
            owner: None,
            start_line: 1,
            end_line: 1,
            shape: None,
            calls: Vec::new(),
        }
    }

    /// A cached record's field set is pinned, so adding one cannot be silent.
    ///
    /// **If this test is failing, you added a field to `Entry` and the question it is
    /// asking is whether you bumped [`FORMAT_VERSION`].** Almost certainly you must.
    ///
    /// This is not hypothetical bookkeeping. `file_doc` was added here in "A file's header
    /// is documentation, and nothing was measuring it", with `#[serde(default)]` and no
    /// version bump — and `#[serde(default)]` is exactly the annotation that lets a stale
    /// record load as though it were current. Every entry cached before that commit went on
    /// deserialising with `file_doc: None`, so in any repo with a warm cache the readers
    /// were handed no file header at all while everything downstream believed they had one,
    /// and their `reading_hash` values were computed without it. It surfaced months later,
    /// as an unexplained mass expiry across every repo at once the moment a version bump
    /// finally dropped those caches — which is the cheapest possible symptom of a bug that
    /// had been quietly degrading the measurement the whole time.
    ///
    /// The field set is the tripwire because it is the thing that changed. A new field is
    /// free to add and free to forget; this makes it cost one deliberate look.
    #[test]
    fn a_new_cached_field_cannot_be_added_silently() {
        let e = Entry {
            mtime: 1,
            len: 2,
            hash: 3,
            lang: Lang::Rust,
            funcs: vec![func("one")],
            file_doc: Some("//! banner".into()),
            head: "abc".into(),
            blame: None,
            blame_commit: ANCIENT.into(),
        };
        let v: serde_json::Value = serde_json::to_value(&e).expect("Entry serialises");
        let mut keys: Vec<&str> =
            v.as_object().expect("an object").keys().map(|k| k.as_str()).collect();
        keys.sort_unstable();
        assert_eq!(
            keys,
            vec![
                "blame",
                "blame_commit",
                "file_doc",
                "funcs",
                "hash",
                "head",
                "lang",
                "len",
                "mtime",
            ],
            "the cached record's fields changed — bump FORMAT_VERSION, then update this list"
        );

        // **And the same pin one level down.** `file_doc` was the field that taught this
        // lesson and it went on `Entry`, so that is where the guard was put — but the record
        // this cache actually exists to hold is the function list, and a `#[serde(default)]`
        // field added to `FuncDef` loads from a stale entry exactly as silently. `shape` was
        // the first one: without a bump, every repo with a warm cache would have reported
        // zero clones, correctly according to the file it read and wrongly about the code.
        let f: serde_json::Value = serde_json::to_value(&e.funcs[0]).expect("FuncDef serialises");
        let mut fkeys: Vec<&str> =
            f.as_object().expect("an object").keys().map(|k| k.as_str()).collect();
        fkeys.sort_unstable();
        assert_eq!(
            fkeys,
            vec![
                "body",
                "calls",
                "doc",
                "end_line",
                "name",
                "owner",
                "shape",
                "signature",
                "start_line",
            ],
            "a cached function's fields changed — bump FORMAT_VERSION, then update this list"
        );
    }

    /// Store a parse, then look the file up again untouched.
    fn seeded(dir: &Path, body: &str) -> (ScanCache, PathBuf) {
        let path = dir.join("a.rs");
        fs::write(&path, body).unwrap();
        let cache = ScanCache::ephemeral();
        let Look::Miss { ident, .. } = cache.look("a.rs", &path, None) else {
            panic!("an empty cache must miss");
        };
        cache.put_parse("a.rs", &ident, Lang::Rust, &[func("one")], None, "head");
        (cache, path)
    }

    #[test]
    fn an_untouched_file_is_taken_from_the_cache() {
        let dir = tempfile::tempdir().unwrap();
        let (cache, path) = seeded(dir.path(), "fn one() {}\n");
        match cache.look("a.rs", &path, None) {
            Look::Hit(h) => assert_eq!(h.funcs[0].name, "one"),
            _ => panic!("an unchanged file must hit"),
        }
    }

    /// The claim the whole design rests on. Git only knows what is committed, and the tree
    /// is dirty exactly when somebody reopens a project — so an edited-but-uncommitted file
    /// must re-parse. Serving the previous parse here would put functions at lines they are
    /// no longer at, and every reading taken against those lines would be about nothing.
    #[test]
    fn an_uncommitted_edit_is_never_served_from_the_cache() {
        let dir = tempfile::tempdir().unwrap();
        let (cache, path) = seeded(dir.path(), "fn one() {}\n");
        fs::write(&path, "fn one() {}\nfn two() {}\n").unwrap();
        assert!(
            matches!(cache.look("a.rs", &path, None), Look::Miss { .. }),
            "an edited file must miss even though nothing was committed"
        );
    }

    /// A cache written by a different parser is dropped, not extended.
    ///
    /// **This is the one failure every other test here would pass through.** The gate, the
    /// hash and the HEAD check all answer "have these bytes changed", and the answer is
    /// correctly no — while the parser that read them has moved underneath. Mapping `.h` to
    /// C++ took one real repo from 1,682 functions to 1,724, and the app went on serving
    /// 1,682 out of a cache written an hour before, while `just scan` — uncached by design —
    /// reported the truth. Two numbers for one repo, and an orchestrator was sizing a
    /// 176-subagent run from the wrong one.
    ///
    /// A header with no `parse` at all takes the same road: absent is 0, 0 matches no real
    /// parse version, and a cache from before the parser was versioned is exactly the cache
    /// whose parse cannot be vouched for.
    #[test]
    fn a_cache_from_a_different_parser_is_not_reused() {
        let entries = |s: &str| read_log(s).0;
        let header = |v: u32, p: Option<u32>| match p {
            Some(p) => format!(r#"{{"version":{v},"parse":{p},"head":"abc"}}"#),
            None => format!(r#"{{"version":{v},"head":"abc"}}"#),
        };
        let live =
            |s: &Stored| s.version == FORMAT_VERSION && s.parse == crate::parse::PARSE_VERSION;

        assert!(
            live(&entries(&header(FORMAT_VERSION, Some(crate::parse::PARSE_VERSION)))),
            "this build's own cache is reused"
        );
        assert!(
            !live(&entries(&header(FORMAT_VERSION, Some(crate::parse::PARSE_VERSION + 1)))),
            "a newer parser's cache is not this parser's answer either — the records are \
             internally consistent and describe a repo nobody is looking at"
        );
        assert!(
            !live(&entries(&header(FORMAT_VERSION, None))),
            "and a header from before the parser was versioned is dropped, not assumed"
        );
    }

    /// The gate is `(mtime, len)` and the KEY is the content hash, so a file rewritten to
    /// identical bytes — a reformat that changed nothing, a checkout, a `touch` — still
    /// hits. Keying on the gate alone would re-parse a whole repo after any checkout.
    #[test]
    fn identical_bytes_with_a_new_mtime_still_hit() {
        let dir = tempfile::tempdir().unwrap();
        let (cache, path) = seeded(dir.path(), "fn one() {}\n");
        // Edit it and put it back, which is what a reformat-and-undo or a branch round
        // trip does: the bytes end up identical and the mtime does not. The sleep is what
        // makes "and the mtime does not" true rather than clock-resolution luck.
        fs::write(&path, "fn one() {}\nfn two() {}\n").unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        fs::write(&path, "fn one() {}\n").unwrap();
        match cache.look("a.rs", &path, None) {
            Look::Hit(h) => assert_eq!(h.funcs[0].name, "one"),
            _ => panic!("same bytes must hit however the mtime moved"),
        }
    }

    /// Blame is keyed on the content hash AND the last commit to touch the file, because
    /// content alone has exactly one hole: revert-and-reapply returns the bytes to an old
    /// hash while the blame now points at the newer commits. The parse survives that — the
    /// bytes really are the same — and only the blame half is dropped.
    #[test]
    fn a_reverted_and_reapplied_file_keeps_its_parse_and_loses_its_blame() {
        let dir = tempfile::tempdir().unwrap();
        let (cache, path) = seeded(dir.path(), "fn one() {}\n");
        cache.put_blame("a.rs", None, Some("aaa"));
        // Same bytes, but the newest commit touching them is a different one now.
        match cache.look("a.rs", &path, Some("bbb")) {
            Look::Hit(h) => {
                assert_eq!(h.funcs[0].name, "one", "the parse is still good");
                assert!(h.blame.is_none(), "the blame belongs to the old commit");
            }
            _ => panic!("the content is unchanged, so the parse must still hit"),
        }
        assert!(
            cache.cached_blame("a.rs", fnv(b"fn one() {}\n"), Some("bbb")).is_none(),
            "and asking for it directly must not produce it either"
        );
    }

    /// A repo shrinks as well as grows. Without this, a cache accumulates every file of
    /// every branch anybody ever checked out, and nothing invalidates an entry nobody asks
    /// about again.
    /// A real file on disk, so the log format is exercised rather than the in-memory map.
    ///
    /// Every other test here uses `ephemeral`, which has nowhere to write — so the format
    /// had no coverage at all while it was a single JSON document, and none of these would
    /// have noticed it becoming a log.
    fn on_disk(repo: &Path, files: &[(&str, &str)]) -> ScanCache {
        let cache = ScanCache::open(repo);
        for (name, body) in files {
            let path = repo.join(name);
            fs::write(&path, body).unwrap();
            let Look::Miss { ident, .. } = cache.look(name, &path, None) else {
                panic!("an empty cache must miss");
            };
            cache.put_parse(name, &ident, Lang::Rust, &[func("one")], None, "head");
        }
        cache.save();
        cache
    }

    /// The point of the log: a write costs the size of what CHANGED.
    ///
    /// The old format re-encoded the whole store every 400 entries, so a scan of n files
    /// wrote O(n²) bytes. On a tree of a hundred thousand files holding function bodies
    /// that was 323MB rewritten over and over, which is how a mis-picked directory became
    /// minutes of pinned CPU. Counting lines is the honest test: one per file, plus a
    /// header, no matter how many times save() was called along the way.
    #[test]
    fn saving_appends_rather_than_rewriting_the_whole_store() {
        let _home = crate::agentapi::tests::data_home();
        let repo = tempfile::tempdir().unwrap();
        let cache = on_disk(repo.path(), &[("a.rs", "fn one() {}")]);
        let path = ScanCache::path_for(repo.path()).unwrap();

        // Three more files, saved one at a time — the shape a scan actually has.
        for name in ["b.rs", "c.rs", "d.rs"] {
            let p = repo.path().join(name);
            fs::write(&p, "fn one() {}").unwrap();
            let Look::Miss { ident, .. } = cache.look(name, &p, None) else { panic!("miss") };
            cache.put_parse(name, &ident, Lang::Rust, &[func("one")], None, "head");
            cache.save();
        }

        let lines = fs::read_to_string(&path).unwrap().lines().count();
        assert_eq!(lines, 5, "expected a header and one line per file, got {lines}");
        assert_eq!(
            ScanCache::open(repo.path())
                .store()
                .as_ref()
                .expect("a store is read on first use")
                .entries
                .len(),
            4
        );
    }

    /// A write killed halfway costs that one entry, not the whole cache.
    ///
    /// This is the property the single-document format could not have: a truncated JSON
    /// object parses as garbage, so an interrupted write silently cost the next open
    /// everything. A torn last line is exactly what an interrupted append leaves.
    #[test]
    fn a_torn_last_line_costs_only_its_own_entry() {
        let _home = crate::agentapi::tests::data_home();
        let repo = tempfile::tempdir().unwrap();
        on_disk(repo.path(), &[("a.rs", "fn one() {}"), ("b.rs", "fn one() {}")]);
        let path = ScanCache::path_for(repo.path()).unwrap();

        let text = fs::read_to_string(&path).unwrap();
        let torn = format!("{}{{\"k\":\"c.rs\",\"e\":{{\"mtime\":1,\"len\"", text);
        fs::write(&path, torn).unwrap();

        let back = ScanCache::open(repo.path());
        let n = back.store().as_ref().expect("a store is read on first use").entries.len();
        assert_eq!(n, 2, "a torn trailing line took the good entries with it");
    }

    /// A removal has to survive a reopen, and an append cannot express one.
    ///
    /// `retain` drops entries from the map; if that only ever appended, the dropped files
    /// would still be in the log and would walk back in on the next open — a cache that
    /// outgrows the repo it describes, which is the thing `retain` exists to prevent.
    #[test]
    fn a_dropped_file_does_not_come_back_on_the_next_open() {
        let _home = crate::agentapi::tests::data_home();
        let repo = tempfile::tempdir().unwrap();
        let cache = on_disk(repo.path(), &[("a.rs", "fn one() {}"), ("b.rs", "fn one() {}")]);

        cache.retain(&["a.rs".to_string()].into_iter().collect());
        cache.save();

        let back = ScanCache::open(repo.path());
        let held = back.store();
        let entries = held.as_ref().expect("a store is read on first use");
        assert!(entries.entries.contains_key("a.rs"));
        assert!(!entries.entries.contains_key("b.rs"), "a dropped file came back from the log");
    }

    #[test]
    fn files_no_longer_in_the_scan_are_dropped() {
        let dir = tempfile::tempdir().unwrap();
        let (cache, path) = seeded(dir.path(), "fn one() {}\n");
        cache.retain(&std::collections::HashSet::new());
        assert!(
            matches!(cache.look("a.rs", &path, None), Look::Miss { .. }),
            "a retained-away entry must be gone"
        );
    }
}
