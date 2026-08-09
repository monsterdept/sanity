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
const FORMAT_VERSION: u32 = 1;

/// Stand-in oid for "not touched inside the churn window". See the module docs.
const ANCIENT: &str = "-";

/// Write the file back after this many changed entries. A scan that is killed halfway
/// should not throw away the files it did get through, and on a cold PrusaSlicer open
/// there are 2,518 of them.
const FLUSH_EVERY: usize = 400;

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
    inner: Mutex<Stored>,
    dirty: Mutex<usize>,
    /// Blame entries are dropped on load when history was rewritten. Recorded so the
    /// current HEAD can be written back on save.
    head: String,
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
            inner: Mutex::new(Stored {
                version: FORMAT_VERSION,
                ..Default::default()
            }),
            dirty: Mutex::new(0),
            head: String::new(),
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
        let path = Self::path_for(repo);
        let head = git_head(repo);
        let mut stored = path
            .as_ref()
            .and_then(|p| std::fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str::<Stored>(&s).ok())
            .filter(|s| s.version == FORMAT_VERSION)
            .unwrap_or_else(|| Stored {
                version: FORMAT_VERSION,
                head: head.clone(),
                entries: HashMap::new(),
            });
        if !stored.head.is_empty() && !stored.head.eq(&head) && !is_ancestor(repo, &stored.head) {
            for e in stored.entries.values_mut() {
                e.blame = None;
            }
        }
        ScanCache {
            path,
            inner: Mutex::new(stored),
            dirty: Mutex::new(0),
            head,
        }
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
        if let (Some((mtime, len)), Ok(inner)) = (gate, self.inner.lock()) {
            if let Some(e) = inner.entries.get(rel_path) {
                if e.mtime == mtime && e.len == len {
                    return Look::Hit(Hit {
                        lang: e.lang,
                        funcs: e.funcs.clone(),
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
        if let Ok(inner) = self.inner.lock() {
            if let Some(e) = inner.entries.get(rel_path) {
                if e.hash == hash {
                    return Look::Hit(Hit {
                        lang: e.lang,
                        funcs: e.funcs.clone(),
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
    pub fn cached_blame(&self, rel_path: &str, hash: u64, last_commit: Option<&str>) -> Option<FileBlame> {
        let inner = self.inner.lock().ok()?;
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
        head: &str,
    ) {
        let Ok(mut inner) = self.inner.lock() else {
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
                head: head.to_string(),
                blame,
                blame_commit,
            },
        );
        drop(inner);
        self.tick();
    }

    /// Store blame for a file whose parse entry already exists. A blame with no parse entry
    /// is dropped rather than stored alone: the gate lives on the parse entry, so an
    /// orphan could never be invalidated.
    pub fn put_blame(&self, rel_path: &str, blame: Option<&FileBlame>, last_commit: Option<&str>) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        if let Some(e) = inner.entries.get_mut(rel_path) {
            e.blame = blame.cloned();
            e.blame_commit = last_commit.unwrap_or(ANCIENT).to_string();
        }
        drop(inner);
        self.tick();
    }

    /// Forget files that are no longer in the scan, so a cache cannot outgrow the repo it
    /// describes — a deleted directory would otherwise be carried forever.
    pub fn retain(&self, live: &std::collections::HashSet<String>) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.entries.retain(|k, _| live.contains(k));
        }
    }

    fn tick(&self) {
        let flush = {
            let Ok(mut d) = self.dirty.lock() else { return };
            *d += 1;
            if *d >= FLUSH_EVERY {
                *d = 0;
                true
            } else {
                false
            }
        };
        if flush {
            self.save();
        }
    }

    /// Write the cache out. Silent on failure, by the argument in the module docs.
    pub fn save(&self) {
        let Some(path) = &self.path else { return };
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        inner.head = self.head.clone();
        if let Ok(s) = serde_json::to_string(&*inner) {
            // Written via a temporary and renamed: a kill partway through a 40MB write
            // would otherwise leave truncated JSON, which parses as garbage and silently
            // costs the next open its entire cache.
            let tmp = path.with_extension("tmp");
            if std::fs::write(&tmp, s).is_ok() {
                let _ = std::fs::rename(&tmp, path);
            }
        }
    }
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
        }
    }

    /// Store a parse, then look the file up again untouched.
    fn seeded(dir: &Path, body: &str) -> (ScanCache, PathBuf) {
        let path = dir.join("a.rs");
        fs::write(&path, body).unwrap();
        let cache = ScanCache::ephemeral();
        let Look::Miss { ident, .. } = cache.look("a.rs", &path, None) else {
            panic!("an empty cache must miss");
        };
        cache.put_parse("a.rs", &ident, Lang::Rust, &[func("one")], "head");
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
