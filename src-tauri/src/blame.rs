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
    /// Whose lines most of this body IS, which is a different question from who touched it
    /// last and frequently a different answer: a typo fix in a four-hundred-line function
    /// makes somebody its last toucher while they hold one line of it.
    ///
    /// **Not `owner`, and not `author`.** Blame reports who touched each line LAST, so a
    /// body rewritten wholesale reads as new and everyone whose lines were replaced is gone
    /// — not diminished, gone. This measures who holds what is STANDING, which is robust to
    /// a one-line-per-file sweep and no help at all against a reformat. See `TODO.md`.
    pub main_author: String,
    /// How many people's lines are standing here.
    ///
    /// The third reduction of the same list, and the one the findings grammar wants: a rule
    /// may not name a person — that is a rule about what a thing is CALLED — but it can
    /// count them. `headcount <= 1 and callers >= 20` is *load-bearing, and only one person
    /// has been in it*, with nobody named anywhere.
    pub headcount: u32,
}

impl FileBlame {
    /// How many people have lines standing in this file.
    ///
    /// **A file's own count, not its functions' pooled**, and the two differ in a way that is
    /// the whole point: a body one person has touched, inside a file six people work in, is a
    /// pocket somebody owns alone in shared territory — which neither number says by itself.
    /// It counts the space between functions too, which is where a file's imports and its
    /// module-level wiring live.
    pub fn headcount(&self) -> u32 {
        self.authors.iter().filter(|a| !a.is_empty()).count() as u32
    }

    /// Collapse the lines of one function into the six facts the map needs.
    ///
    /// **Three of them are reductions of one list and it is worth naming which.** Every line
    /// carries whoever touched it last; `last_author` takes the newest of those, `main_author`
    /// takes the biggest pile, and `headcount` counts the distinct names. Same slice, taken
    /// three ways — no extra pass, no `range_detail`, which shells out per function and is for
    /// one function at a time in the panel rather than for a hundred and fifty thousand.
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
        // Lines per author index. A `Vec` rather than a map: the index is already dense and
        // small — it is a position in `self.authors`, which is the file's own cast — so this
        // is a bucket per person in the FILE, not per person in the repo.
        let mut held = vec![0u32; self.authors.len()];
        for l in slice {
            commits.insert(l.commit);
            if l.time > newest.time {
                newest = *l;
            }
            oldest = oldest.min(l.time);
            if let Some(n) = held.get_mut(l.author as usize) {
                *n += 1;
            }
        }
        let headcount = held.iter().filter(|n| **n > 0).count() as u32;
        // Ties go to the earlier index, which is the order `self.authors` was built in and
        // therefore stable across runs — an arbitrary answer is fine, an answer that moves
        // between two scans of the same tree is a wedge that changes colour for no reason.
        let main = held
            .iter()
            .enumerate()
            .max_by_key(|(_, n)| **n)
            .filter(|(_, n)| **n > 0)
            .map(|(i, _)| i);
        let days = |t: i64| ((now - t).max(0) as f32) / 86_400.0;
        Some(RangeHistory {
            commits: commits.len() as u32,
            last_touched_days: days(newest.time),
            // A lower bound, not the truth: blame reports the last commit to touch each
            // line, so a function rewritten wholesale reads as young. Stated rather than
            // hidden — the alternative is `git log -L` per function.
            age_days: days(oldest),
            last_author: self.authors.get(newest.author as usize).cloned().unwrap_or_default(),
            main_author: main.and_then(|i| self.authors.get(i)).cloned().unwrap_or_default(),
            headcount,
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

    /// Fold another pass's files into this one.
    ///
    /// **What makes a blame pass publishable before it finishes.** The pass runs in chunks so
    /// the map fills in as it goes (see `trace::deepen`), and each chunk is a whole answer for
    /// the files it covers — blame is per file and independent, so absorbing one is a union and
    /// never a merge of two opinions about the same thing. `now` is the reading's own clock and
    /// is taken from whichever pass has one, so a default-constructed accumulator does not
    /// stamp every age as the epoch.
    pub fn absorb(&mut self, other: Blame) {
        if self.now == 0 {
            self.now = other.now;
        }
        self.files.extend(other.files);
    }

    /// How many people have lines standing in ONE file.
    ///
    /// **A file's own count, not its functions' pooled.** The two differ and the difference is
    /// the finding: a body one person has touched, inside a file six people work in, is a
    /// pocket somebody owns alone in shared territory — which neither count says by itself.
    ///
    /// The cast is interned per file, so this is its length: everyone with a line still
    /// standing anywhere in the file, including in the space between functions.
    pub fn file_headcount(&self, path: &str) -> Option<u32> {
        self.files.get(path).map(FileBlame::headcount)
    }

    /// How many people have lines standing anywhere in this repo.
    ///
    /// **The denominator `RangeHistory::headcount` is missing on its own.** One pair of hands
    /// on a function means something in a repo of forty people and nothing in a repo of one,
    /// and the function's own count cannot tell those apart. Same reduction one scope up: the
    /// names are already interned per file, so this is a union of the casts rather than a
    /// second pass over anything.
    ///
    /// Blame's names rather than the log's, so it counts the same thing a function's headcount
    /// counts — who holds what is STANDING. `ScanStats::authors` is the log's all-time cast,
    /// capped at `AUTHOR_SLOTS`, and is neither.
    pub fn headcount(&self) -> u32 {
        let mut seen: std::collections::HashSet<&str> = std::collections::HashSet::new();
        for f in self.files.values() {
            for a in &f.authors {
                if !a.is_empty() {
                    seen.insert(a.as_str());
                }
            }
        }
        seen.len() as u32
    }

    /// How many files this holds per-line history for.
    ///
    /// The numerator of what the map can honestly claim: a pass that was stopped, or one that
    /// hit untracked files, resolves some of a repo and not the rest — see `TraceState::
    /// resolved`, which is where that fraction is reported rather than rounded away.
    pub fn len(&self) -> usize {
        self.files.len()
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
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
        // **Checked per file, because this is the phase worth stopping.** A cold pass is 206s
        // on ceph and hours on a repo of a hundred thousand files, and what it has already
        // done is not lost when it stops: `scancache` appends every four hundred entries, so
        // a second run picks up where this one was interrupted. Stopping is therefore cheap
        // and resuming is nearly free, which is what makes starting it a reasonable thing to
        // offer somebody.
        stop: &std::sync::atomic::AtomicBool,
        done: &(dyn Fn(&str) + Sync),
    ) -> Blame {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        // The project this pass belongs to, and the whole identity the floor rule needs — one
        // repo is one claim on the slots, however many files it holds.
        let key = repo.display().to_string();
        let run = || {
            paths
                .par_iter()
                .filter(|_| !stop.load(std::sync::atomic::Ordering::Relaxed))
                .map(|entry| {
                    done(&entry.0);
                    entry
                })
                .filter_map(|(p, hash)| {
                    let want = history.last_commit_of(p);
                    // **A cached file takes no slot, because it spawns nothing.** Blame is
                    // cached per file on `(content, last commit)`, so a warm repo answers most
                    // of this pass out of the store; making those queue behind a cold repo's
                    // children would be rationing a resource they do not use.
                    if let Some(b) = cache.cached_blame(p, *hash, want) {
                        return Some((p.clone(), b));
                    }
                    let _slot = slots::shared().acquire(&key);
                    let b = blame_file(repo, p)?;
                    cache.put_blame(p, Some(&b), want);
                    Some((p.clone(), b))
                })
                .collect()
        };

        // **Its own pool, and the slots alone would not have been enough without it.** The
        // slot rule rations `git blame` CHILDREN; what starved the second repo first was the
        // WORKERS. On the shared pool a big repo's `par_iter` occupies every thread — some
        // holding slots, the rest parked waiting for one — and a second repo's tasks are then
        // never scheduled at all, so they cannot even reach the point of asking for a slot.
        // A private pool means a project can only ever exhaust its own threads.
        //
        // Sized to the shared pool rather than to this project's allowance: the threads are
        // asleep on a subprocess, so idle ones cost a stack and nothing else, and the slot rule
        // is what decides how many may actually be working. Falling back to the global pool if
        // one cannot be built keeps a thread-starved machine blaming rather than failing.
        let files = match rayon::ThreadPoolBuilder::new()
            .num_threads(rayon::current_num_threads().max(2))
            .thread_name(|i| format!("blame-{i}"))
            .build()
        {
            Ok(pool) => pool.install(run),
            Err(_) => run(),
        };
        Blame { files, now }
    }
}

/// How many `git blame` children may be in flight, and who is allowed to hold them.
///
/// # The resource here is a SUBPROCESS SLOT, not a core
///
/// Sampled mid-pass on a 8-core machine: all nine rayon workers were sitting in
/// `Command::output`, waiting on a `git blame` child, and not one was running in-process code.
/// So the pool is not compute that has to be divided — it is a count of how many children may
/// be outstanding, and a thread holding one is asleep. That is why the numbers below are
/// allowed to exceed the core count and why oversubscribing costs almost nothing.
///
/// # Why a floor per project rather than a share of the pool
///
/// A big repo used to take everything. Blaming kibana is 59,008 files at ~38ms each; press
/// Trace on a second repo and its work went to the back of the same queue, so a 90-file repo —
/// **3.4 seconds** of work — sat behind thirty-three minutes of somebody else's. Nothing on
/// screen said so, because from the row's side a starved pass and a hung one are identical.
///
/// A percentage was the obvious fix and it does not scale. A 10% reservation of nine slots is
/// ONE slot; two waiting projects share it, five waiting projects share it, so the rule that
/// rescues the second repo starves the third. And a flat 90% cap is worse still: it is
/// unconditional, so a repo running alone gives up a ninth of the machine forever to guard
/// against contention that is not happening — four minutes of that thirty-eight, every time.
///
/// So the reservation is sized by demand instead. **Every project with work outstanding is
/// guaranteed at least one slot; whoever wants the rest may have it.** With `total` slots and
/// `others` other active projects, a project may hold `total - others`, never less than one:
///
/// | active | kibana | sanity | each of three more |
/// |---|---|---|---|
/// | kibana alone | 9 | — | — |
/// | + sanity | 8 | 1 | — |
/// | + three | 5 | 1 | 1 |
///
/// Work-conserving at the top — alone means all of it — and it degrades by queueing rather
/// than by starving.
///
/// # Nothing is preempted, and it does not need to be
///
/// An incumbent over its new cap is not interrupted; it simply may not take another slot when
/// one of its own finishes. Slots turn over per FILE, so at nine slots and 38ms a slot frees
/// every four milliseconds — a newcomer waits about that long for its floor. Preempting a
/// running `git blame` would throw away work to save four milliseconds.
mod slots {
    use std::collections::{HashMap, HashSet};
    use std::sync::{Condvar, Mutex, OnceLock};

    #[derive(Default)]
    pub(super) struct State {
        /// Slots each project is holding right now.
        pub(super) holding: HashMap<String, usize>,
        /// Threads each project has parked waiting for one.
        ///
        /// **Counted, and that is what makes the floor work.** A waiter is what tells the
        /// incumbent its cap has dropped: without this, a project holding every slot computes
        /// `others = 0`, keeps its full allowance, and the newcomer waits forever on a
        /// condition that can never become true.
        pub(super) waiting: HashMap<String, usize>,
    }

    /// How many OTHER projects have a claim on the pool right now.
    ///
    /// **Holders and waiters both, and the waiters are the half that is easy to forget.** A
    /// project parked with nothing in hand is invisible to a count of holdings — so an
    /// incumbent would see an empty field, keep its whole allowance, and take back every slot
    /// it released. Whether somebody is WAITING is the only evidence that the pool is
    /// contended at the moment it matters, because a project only ever parks when the pool is
    /// full and therefore holds nothing at all.
    pub(super) fn contenders(state: &State, key: &str) -> usize {
        let mut active: HashSet<&str> = HashSet::new();
        for (k, v) in state.holding.iter() {
            if *v > 0 {
                active.insert(k.as_str());
            }
        }
        for (k, v) in state.waiting.iter() {
            if *v > 0 {
                active.insert(k.as_str());
            }
        }
        active.iter().filter(|k| **k != key).count()
    }

    pub(super) struct Slots {
        state: Mutex<State>,
        freed: Condvar,
        total: usize,
    }

    /// What one project may hold, given how many others want work.
    ///
    /// Never zero: with more projects than slots every one of them is entitled to a slot it
    /// has to queue for, which is a wait. Zero would be a deadlock.
    pub(super) fn allowance(total: usize, others: usize) -> usize {
        total.saturating_sub(others).max(1)
    }

    /// May this project take another slot right now?
    ///
    /// **Split out because it is the only part of the rule a test can pin down.** A project
    /// only ever WAITS when the pool is full, so the moment that separates the floor from no
    /// floor — an incumbent one slot short of the total, with somebody parked — cannot be
    /// staged with threads: the freed slot is a race between the two of them, and either
    /// outcome is possible whether or not the rule is there. As a function it is one line and
    /// two assertions. `acquire` calls this rather than repeating it, so what the test pins is
    /// what actually runs.
    pub(super) fn admits(total: usize, inflight: usize, mine: usize, others: usize) -> bool {
        inflight < total && mine < allowance(total, others)
    }

    impl Slots {
        pub(super) fn new(total: usize) -> Self {
            Slots { state: Mutex::new(State::default()), freed: Condvar::new(), total: total.max(1) }
        }

        /// Take a slot for `key`, waiting until the floor rule allows one.
        pub(super) fn acquire(&self, key: &str) -> Slot<'_> {
            // Poisoning protects nothing here and would cost everything: one panic under this
            // lock and every blame pass in the app would block forever. Same judgement
            // `agentapi::lock` makes.
            let mut st = self.state.lock().unwrap_or_else(|e| e.into_inner());
            *st.waiting.entry(key.to_string()).or_insert(0) += 1;
            loop {
                let inflight: usize = st.holding.values().sum();
                let others = contenders(&st, key);
                let mine = st.holding.get(key).copied().unwrap_or(0);
                if admits(self.total, inflight, mine, others) {
                    match st.waiting.get_mut(key) {
                        Some(w) if *w > 1 => *w -= 1,
                        _ => {
                            st.waiting.remove(key);
                        }
                    }
                    *st.holding.entry(key.to_string()).or_insert(0) += 1;
                    return Slot { slots: self, key: key.to_string() };
                }
                st = self.freed.wait(st).unwrap_or_else(|e| e.into_inner());
            }
        }

        /// How many threads are parked for `key`. Exists so a test can wait for a waiter to be
        /// REGISTERED rather than sleeping and hoping — the rule turns on that registration,
        /// so a test that races it proves nothing.
        #[cfg(test)]
        pub(super) fn waiting_for(&self, key: &str) -> usize {
            let st = self.state.lock().unwrap_or_else(|e| e.into_inner());
            st.waiting.get(key).copied().unwrap_or(0)
        }

        fn release(&self, key: &str) {
            {
                let mut st = self.state.lock().unwrap_or_else(|e| e.into_inner());
                match st.holding.get_mut(key) {
                    Some(h) if *h > 1 => *h -= 1,
                    _ => {
                        st.holding.remove(key);
                    }
                }
            }
            // Everyone, not one: the freed slot may only be legal for a project whose cap just
            // rose, and waking a single arbitrary waiter can wake one the rule still refuses.
            self.freed.notify_all();
        }
    }

    /// A held slot. Releases on drop, which is what makes every early return in the blame
    /// path — a git that would not run, a `?` on a parse — safe: a slot leaked once is a slot
    /// the pool never gets back.
    pub(super) struct Slot<'a> {
        slots: &'a Slots,
        key: String,
    }

    impl Drop for Slot<'_> {
        fn drop(&mut self) {
            self.slots.release(&self.key);
        }
    }

    /// The app's slots. Sized to the pool the blame pass would have had to itself, so a repo
    /// running alone is no slower than before any of this existed.
    pub(super) fn shared() -> &'static Slots {
        static SLOTS: OnceLock<Slots> = OnceLock::new();
        SLOTS.get_or_init(|| Slots::new(rayon::current_num_threads().max(2)))
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
    /// How many of this range's lines still come from it. **Zero is a real answer** — a
    /// commit that changed these lines and whose work has since been replaced is in the
    /// history and not in the blame, and that difference is the whole distinction between
    /// the lenses that read this.
    pub lines: u32,
    /// The path these lines were under at this commit, when it is not the one asked about.
    ///
    /// **A rename is crossed by both halves of this record and was reported by neither.**
    /// `git blame` follows renames by default and spells the name out per line as
    /// `filename`, which the fold read past; `-L` names it on the `+++` side of each stanza.
    /// So the pane showed a function "here since 2007" whose 2007 commit was made against a
    /// path that no longer exists, and the only way to find that out was to open the commit
    /// and be surprised by its file list.
    pub path: Option<String>,
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
    Some(fold_porcelain(&String::from_utf8_lossy(&out.stdout), path))
}

/// What the far end of a line walk actually was.
///
/// **The panel had to guess this and guessed wrong in both directions.** `-L` stops where these
/// lines came from nowhere, and the footer read that as a rewrite it could not see through.
/// Neither half held up. The ordinary end is a function written into a file older than itself,
/// which is not a limit but the answer; and a rewrite does not stop the walk at all — git maps
/// the removed lines onto their predecessors and carries on, so the caveat a rewrite deserves
/// is the opposite one, that the dates can run back PAST this function into whatever text stood
/// at these lines. That belongs on the heading, where it is a fact about the instrument, and
/// this enum is only about the end.
///
/// There are two variants and there is deliberately no third: a commit that replaces lines has
/// somewhere to be followed to, so `Replaced` is not a state the walk can stop in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    /// The file itself was created there, so these lines are as old as it is and there is
    /// nothing left to say about the far end.
    Created,
    /// The lines were inserted into a file that already existed. The function is younger than
    /// its file, which is a fact rather than a limit — and it is the fact the file's own first
    /// commit is worth printing beside.
    Added,
}

/// One function's history: every commit that changed these lines, and what survives of them.
///
/// Not [`RangeHistory`], which is the same range folded down to the four numbers a WEDGE is
/// coloured by. This is the panel's record: rows a person reads, on a click.
///
/// **Three lenses, one record, because they are three questions about one history.** Blame,
/// Churn and Age were one fetch until Churn grew its own, and a second fetch is a second
/// population: `git blame` sees the commits whose lines SURVIVED, `git log -L` sees every
/// commit that changed the range, and two tabs reading two of those disagree about when a
/// function began while each is internally correct. The disagreement is invisible — nothing on
/// screen says which population a date came from — which is the failure mode this whole panel
/// is written against. So both halves are read once and JOINED here: [`LineHistory::changes`]
/// is the history, [`Touch::lines`] on each of its rows is what blame still attributes to that
/// commit, and zero is a real answer meaning the work is gone.
///
/// **The line walk is `git log -L`, which `churn.rs` refuses at scan scale for cost.** That
/// refusal is about thousands of processes over a whole repo and does not reach one range
/// somebody clicked: measured on ceph's `src/mon/Monitor.cc:100-200`, 2.2s for the walk beside
/// 0.8s for the blame this pane already paid for, and they run together.
///
/// **The range is followed, not held still.** Git rewrites it at every step, so a commit that
/// inserted twenty lines above the function moves the range rather than counting as a change to
/// it. Both halves cross file renames — blame by default, `-L` on its own — and both now say so
/// through [`Touch::path`], which is the same fact reaching the pane by the same name from
/// either side.
///
/// **What it cannot do is tell a function's history from its LINES'.** Where a body was
/// rewritten wholesale, git maps the removed lines onto the lines they replaced and keeps
/// walking, so the oldest changes can belong to code that stood here before this function did.
/// That is a property of the instrument and lives on the heading, not in a per-function footer.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineHistory {
    /// Every commit that CHANGED these lines, newest first, with what survives of each joined
    /// on. Empty for a whole-file query, which has a line range only in the sense that it is
    /// one — see [`line_history`].
    pub changes: Vec<Touch>,
    /// The commits whose lines are still here, newest first. A subset of `changes` by
    /// definition, and the one the Blame lens is about: provenance of the code as it stands.
    pub touches: Vec<Touch>,
    /// Surviving lines per author, biggest share first.
    pub authors: Vec<Contributor>,
    /// How many lines blame actually covered, which is the denominator every share here is
    /// honest against.
    pub lines: u32,
    /// What the oldest commit in the walk did to these lines. See [`Origin`].
    pub origin: Origin,
    /// The oldest commit touching this PATH at all. `None` when git has never seen the path —
    /// never a zero. Worth printing against an `added` origin, where it is the file the
    /// function was written into.
    pub file_first: Option<i64>,
    /// The worktree differs from HEAD here, so the scan's line numbers may not be HEAD's.
    ///
    /// **It is reported and never corrected.** The lines come from the scan, which read the
    /// worktree; `-L` reads HEAD. Uncommitted edits put the two out of step and the walk then
    /// follows whatever now sits at those lines — the photograph problem `Snippet::moved` also
    /// answers by saying so rather than by guessing.
    pub dirty: bool,
}

/// See [`LineHistory`]. `None` when git could not answer at all — an untracked path, a repo
/// with no history — which is not the same answer as a range nothing has changed since it was
/// written.
///
/// **`end` of zero is the whole file, and it has no walk.** The blame half answers a file
/// perfectly well and the Blame lens asks it of one; the other two lenses are function views
/// and never ask. A plain `git log -- path` would look like the missing half and would not be
/// it: it does not follow renames, so its far end is a rename rather than a creation, and it
/// would disagree with the `-L` walk about the one fact this record exists to make consistent.
pub fn line_history(repo: &Path, path: &str, start: u32, end: u32) -> Option<LineHistory> {
    let git = |args: &[&str]| {
        Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
    };
    // Four independent processes and the line walk is the slow one, so they run together: the
    // click costs the slowest rather than the sum.
    let range = format!("{},{}:{path}", start.max(1), end.max(start.max(1)));
    let walked = start > 0 && end > 0;
    let (detail, walk, first, dirty) = std::thread::scope(|sc| {
        let a = sc.spawn(|| range_detail(repo, path, start, end));
        let b = sc.spawn(|| {
            walked.then(|| {
                git(&[
                    "log",
                    // Merges excluded, matching `churn::read` — a merge touches every path
                    // under it and would light a calendar up for work done weeks earlier.
                    "--no-merges",
                    "-L",
                    &range,
                    // A sentinel byte, because the patch is in this output: the stanza header
                    // has to be told from a context line that could say anything at all.
                    "--format=%x01%H%x00%an%x00%ct%x00%s",
                    "HEAD",
                ])
            })
        });
        let c = sc.spawn(|| git(&["log", "--format=%ct", "--", path]));
        let d = sc.spawn(|| {
            Command::new("git")
                .arg("-C")
                .arg(repo)
                .args(["diff", "--quiet", "HEAD", "--", path])
                .status()
                .map(|s| !s.success())
                .unwrap_or(false)
        });
        (
            a.join().ok().flatten(),
            b.join().ok().flatten().flatten(),
            c.join().ok().flatten(),
            d.join().unwrap_or(false),
        )
    });
    let detail = detail?;
    // A file has no walk, and `Created` is the honest default there rather than `Added`: it is
    // the variant that says "nothing more to report about the far end", which is exactly the
    // state of a query that never made one.
    let (mut changes, origin) =
        walk.map(|w| fold_line_log(&w, path)).unwrap_or((Vec::new(), Origin::Created));
    // **The join is by sha and the survivors are the authority on their own count.** Blame and
    // the walk abbreviate the same commit to the same eight characters, and a commit blame
    // knows about that the walk does not is the working tree: `uncommitted` has no entry in any
    // log and belongs at the top of a history all the same.
    let surviving: HashMap<&str, u32> =
        detail.touches.iter().map(|t| (t.commit.as_str(), t.lines)).collect();
    for c in &mut changes {
        c.lines = surviving.get(c.commit.as_str()).copied().unwrap_or(0);
    }
    if walked {
        if let Some(pending) = detail.touches.iter().find(|t| t.commit == "uncommitted") {
            changes.insert(0, pending.clone());
        }
    }
    // The path's own log is newest-first like everything else here, so its oldest commit is the
    // last line of it.
    let file_first = first.and_then(|s| s.lines().last().and_then(|l| l.trim().parse().ok()));
    Some(LineHistory {
        changes,
        touches: detail.touches,
        authors: detail.authors,
        lines: detail.lines,
        origin,
        file_first,
        dirty,
    })
}

/// Split a `-L` log into its commits and read the far end of it.
///
/// The stanzas carry a patch, so a commit's own header is marked with a sentinel byte rather
/// than recognised by shape. Only the OLDEST stanza decides the [`Origin`], because it is the
/// only one that says anything the dates do not: every other commit in the walk changed lines
/// that were already there.
///
/// **The path is read off the `+++` side, not the `---` side.** The far end is regularly the
/// commit that created the file, where the a-side is `/dev/null` and the only name in the diff
/// is on the b-side — read from the a-side, a rename would be missed in exactly the case that
/// produces one.
fn fold_line_log(text: &str, path: &str) -> (Vec<Touch>, Origin) {
    let mut out: Vec<Touch> = Vec::new();
    let mut created = false;
    for raw in text.lines() {
        if let Some(head) = raw.strip_prefix('\u{1}') {
            let mut f = head.split('\0');
            let (Some(sha), Some(author), Some(ct), summary) =
                (f.next(), f.next(), f.next(), f.next().unwrap_or_default())
            else {
                continue;
            };
            created = false;
            out.push(Touch {
                commit: sha[..sha.len().min(8)].to_string(),
                author: if author.is_empty() { "unknown".into() } else { author.to_string() },
                when: ct.trim().parse().unwrap_or(0),
                summary: summary.to_string(),
                // Filled by the join in `range_history`: what the walk knows is that this
                // commit changed the range, not whether any of it is left.
                lines: 0,
                path: None,
            });
        } else if let Some(last) = out.last_mut() {
            if raw.strip_prefix("--- ") == Some("/dev/null") {
                created = true;
            } else if let Some(p) = raw.strip_prefix("+++ b/").filter(|p| *p != path) {
                last.path = Some(p.to_string());
            }
        }
    }
    // `created` describes whatever stanza was parsed last, which is the oldest one.
    (out, if created { Origin::Created } else { Origin::Added })
}

/// Fold `--line-porcelain` into per-commit and per-author totals.
///
/// **A commit's header fields appear once, on its first line, and never again.** Porcelain
/// repeats the `<sha> <orig> <final>` line for every line but only spells out `author` and
/// `summary` the first time it meets that commit — so anything that reads the fields per line
/// attributes every later line to whatever it saw last. That is why the metadata is kept by
/// sha and the count is kept by sha, rather than a single running record.
fn fold_porcelain(text: &str, path: &str) -> RangeDetail {
    #[derive(Default, Clone)]
    struct Meta {
        author: String,
        when: i64,
        summary: String,
        lines: u32,
        /// The `filename` field, which porcelain spells out per line and which is how blame
        /// says it has crossed a rename. It follows them by default; nothing here read it.
        file: String,
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
        } else if let Some(rest) = raw.strip_prefix("filename ") {
            if let Some(m) = by_commit.get_mut(&sha) {
                m.file = rest.trim().to_string();
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
            // Only when it differs: a path repeated on every row of a file nobody renamed is
            // noise the reader has to check and discard.
            path: (!m.file.is_empty() && m.file != path).then(|| m.file.clone()),
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

/// A blame with one line in it, for tests elsewhere in the crate that need a VALUE rather
/// than a reading — `scancache` has to prove it kept one across a re-parse, and the fields
/// are private so it cannot build one itself.
#[cfg(test)]
pub(crate) fn fixture(author: &str) -> FileBlame {
    FileBlame {
        lines: vec![Line { commit: 1, author: 0, time: 0 }],
        authors: vec![author.to_string()],
    }
}

#[cfg(test)]
mod slot_tests {
    use super::slots::{admits, allowance, contenders, Slots, State};
    use std::sync::Arc;

    /// **The moment the floor exists for: an incumbent one slot short of the whole pool, with
    /// somebody parked behind it.**
    ///
    /// This pair is the entire difference between the rule and no rule, and it is the reason
    /// the waiter has to be COUNTED rather than only the holders. Nine tenths of the way
    /// through a pass, a project that looks only at who is HOLDING sees nobody else, keeps its
    /// full allowance, and takes back every slot it frees — which is exactly how a 90-file repo
    /// came to wait half an hour for 3.4 seconds of work.
    #[test]
    fn the_last_free_slot_belongs_to_whoever_is_waiting() {
        // Nobody else wants anything: take it.
        assert!(admits(4, 3, 3, 0), "alone, a project may fill the pool");
        // One other project is active — holding or merely parked — so the last slot is spoken
        // for and the incumbent waits for its next one instead.
        assert!(!admits(4, 3, 3, 1), "the last slot is the waiting project's floor");
        // The rule rations rather than refuses: below its allowance it proceeds as normal.
        assert!(admits(4, 2, 2, 1));
        // And a full pool is a full pool, whatever anybody's cap says.
        assert!(!admits(4, 4, 0, 1));
    }

    /// **A project parked with nothing in hand still counts.**
    ///
    /// The other half of the rule, and the half that leaves no trace when it is missing: a
    /// waiter holds zero slots, so a contender count built from holdings alone reports an empty
    /// field to the incumbent — which then keeps its whole allowance and takes back every slot
    /// it frees. Nothing about that is visible in an end-to-end test, because a project only
    /// ever parks when the pool is full, and the freed slot is then a race either way.
    #[test]
    fn a_project_waiting_with_nothing_in_hand_is_still_a_contender() {
        let mut st = State::default();
        st.holding.insert("big".into(), 3);
        assert_eq!(contenders(&st, "big"), 0, "nobody else is asking yet");

        st.waiting.insert("small".into(), 1);
        assert_eq!(contenders(&st, "big"), 1, "a parked project is a claim on the pool");
        assert_eq!(contenders(&st, "small"), 1, "and it can see the incumbent");

        // Which is exactly what turns the incumbent's next attempt away.
        assert!(!admits(4, 3, 3, contenders(&st, "big")));

        // A counter left at zero is not a contender — entries are removed rather than zeroed,
        // but a stale zero must not ration the pool against a project that has gone.
        st.waiting.insert("small".into(), 0);
        assert_eq!(contenders(&st, "big"), 0);
    }

    /// The floor, stated as a table. Every row is a case the percentage schemes get wrong.
    #[test]
    fn every_active_project_is_owed_a_slot() {
        // Alone means all of it. A flat 90% cap would idle a slot here forever, which is a
        // ninth of a thirty-eight-minute pass spent guarding against nobody.
        assert_eq!(allowance(9, 0), 9);
        // One newcomer takes exactly its floor out of the incumbent's allowance.
        assert_eq!(allowance(9, 1), 8);
        // Four more, and each is still owed one — where a fixed 10% reservation would have
        // had the four of them sharing a single slot.
        assert_eq!(allowance(9, 4), 5);
        // More projects than slots: everyone is still owed one and they queue for it. Zero
        // here would be a project that can never run, which is a deadlock and not a wait.
        assert_eq!(allowance(4, 9), 1);
        assert_eq!(allowance(1, 1), 1);
    }

    /// The plumbing, end to end: a parked project is admitted, and everything unwinds.
    ///
    /// **It does not discriminate the rule** — see `the_last_free_slot_belongs_to_whoever_is_
    /// waiting` for that, and note that this one passes with the waiter-counting removed.
    /// What it covers is the parts that arithmetic cannot: that a waiter is registered before
    /// it parks, that a release wakes it, that a guard dropped in another thread returns its
    /// slot, and that nothing deadlocks on the way out.
    ///
    /// The bug this is written against: one repo's pass held the whole pool and a 90-file repo
    /// waited half an hour for 3.4 seconds of work. The fix is a floor, and the half of it that
    /// is easy to leave out is COUNTING THE WAITER — an incumbent that only looks at who is
    /// holding computes `others = 0`, keeps its full allowance, and takes every slot it frees
    /// straight back.
    ///
    /// Asserting that as an invariant rather than as a race is the point. "The small project
    /// eventually gets in" passes without the fix, because the two threads coin-flip for the
    /// mutex on every release and over enough cycles the small one wins. What the rule actually
    /// guarantees is stronger and is not probabilistic: with a waiter registered, the incumbent
    /// is over its cap and **blocks**.
    #[test]
    fn a_waiting_project_cannot_be_out_competed_for_a_freed_slot() {
        let slots = Arc::new(Slots::new(4));
        let mut held: Vec<_> = (0..4).map(|_| slots.acquire("big")).collect();
        assert_eq!(held.len(), 4, "alone, it may have the lot");

        // The guard borrows the pool, so each thread HOLDS its slot and is told when to let go
        // — a slot that came back over a channel would have to outlive the pool it came from.
        let (got_small, small_in) = std::sync::mpsc::channel();
        let (free_small, small_waits) = std::sync::mpsc::channel::<()>();
        let small = {
            let slots = slots.clone();
            std::thread::spawn(move || {
                let _slot = slots.acquire("small");
                got_small.send(()).expect("the test is still listening");
                small_waits.recv().ok();
            })
        };
        // Registered, not merely spawned. Sleeping here would race the very thing under test.
        while slots.waiting_for("small") == 0 {
            std::thread::yield_now();
        }

        // One file finishes. Nothing is preempted — this is the incumbent releasing normally.
        held.pop();

        let (got_big, big_again) = std::sync::mpsc::channel();
        let bigger = {
            let slots = slots.clone();
            std::thread::spawn(move || {
                let _slot = slots.acquire("big");
                got_big.send(()).expect("the test is still listening");
            })
        };

        small_in
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("the waiting project gets the freed slot");
        assert!(
            big_again.recv_timeout(std::time::Duration::from_millis(200)).is_err(),
            "the incumbent is over its cap while another project is active, so it must wait"
        );

        // Once the other project is done, the incumbent's cap goes back up and it proceeds —
        // the rule rations, it does not refuse.
        free_small.send(()).expect("small is still holding");
        small.join().expect("small finishes");
        big_again
            .recv_timeout(std::time::Duration::from_secs(5))
            .expect("with nobody else waiting, the incumbent may have it back");
        bigger.join().expect("big finishes");
        drop(held);
    }

    /// A slot survives every early return in the blame path — a git that will not run, a `?`
    /// on a parse — because it is released by `Drop`. One leaked slot is one the pool never
    /// gets back, and enough of them is a pass that stops for good.
    #[test]
    fn a_slot_is_returned_however_its_holder_leaves() {
        let slots = Slots::new(1);
        for _ in 0..3 {
            let _slot = slots.acquire("one");
            // dropped at the end of each turn; a leak would block the next acquire forever
        }
        let _finally = slots.acquire("one");
    }
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

    /// **The three reductions are three answers, and the test has to prove they differ.**
    ///
    /// The interesting case is the one that motivated the whole distinction: somebody touches
    /// one line of a body somebody else wrote, and becomes its last toucher while holding a
    /// fiftieth of it. If `last_author` and `main_author` ever agree by construction, one of
    /// them is not being computed.
    #[test]
    fn the_newest_hand_is_not_the_biggest_one() {
        // Ada holds lines 1-2, Grace holds line 3 — and Grace's is the newer commit.
        let b = parse_porcelain(SAMPLE);
        let all = b.range(1, 3, 2_000_000).expect("range");
        assert_eq!(all.last_author, "Grace", "newest line");
        assert_eq!(all.main_author, "Ada", "most lines");
        assert_eq!(all.headcount, 2);

        // And over Ada's lines alone, all three collapse to her.
        let hers = b.range(1, 2, 2_000_000).expect("range");
        assert_eq!(hers.last_author, "Ada");
        assert_eq!(hers.main_author, "Ada");
        assert_eq!(hers.headcount, 1, "one hand, which is what a rule asks about");
    }

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
        let d = super::fold_porcelain(INTERLEAVED, "a.rs");
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
        let d = super::fold_porcelain(PENDING, "a.rs");
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
    /// The line walk, against real git, for the two properties the panel rests on.
    ///
    /// **A commit that only moves the range is not a change to it**, which is the whole
    /// difference between this and the file's log — the calendar would otherwise light up for
    /// every edit anywhere above the function. **And the range crosses a rename**, which is
    /// worth pinning because `-L` refuses `--follow` and looks as though it could not.
    #[test]
    fn a_range_is_followed_across_a_rename() {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            std::process::Command::new("git")
                .arg("-C")
                .arg(dir.path())
                .args(args)
                .output()
                .expect("git runs");
        };
        let write = |name: &str, text: &str| {
            std::fs::write(dir.path().join(name), text).expect("writes");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "ada@example.com"]);
        git(&["config", "user.name", "Ada"]);
        write("one.rs", "fn f() {\n    x\n}\n");
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "the function"]);
        // Above the function: it moves the range down and changes nothing in it.
        write("one.rs", "// header\nfn f() {\n    x\n}\n");
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "a line above"]);
        git(&["mv", "one.rs", "two.rs"]);
        git(&["commit", "-q", "-m", "moved"]);
        write("two.rs", "// header\nfn f() {\n    x\n    y\n}\n");
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "a line inside"]);

        // The function is lines 2-5 of `two.rs` now.
        let c = line_history(dir.path(), "two.rs", 2, 5).expect("walks");
        assert_eq!(
            c.changes.len(),
            2,
            "the edit inside and the commit that wrote the lines — not the one above it, and \
             not the rename, which changed nothing in the range"
        );
        assert!(c.changes[0].when >= c.changes[1].when, "newest first");
        assert!(!c.dirty, "nothing is uncommitted yet");
        assert_eq!(c.origin, Origin::Created, "the walk ends at the commit that made the file");
        assert_eq!(
            c.changes.last().and_then(|t| t.path.as_deref()),
            Some("one.rs"),
            "the walk crossed a rename and says so on the row it crossed at — the panel must \
             not have to infer it from a gap between two dates"
        );

        // **A renamed file's own log stops AT the rename, and the walk does not.** `file_first`
        // is `git log -- path` without `--follow`, so here it is the rename commit — NEWER
        // than the creation the line walk reached through it. That is why the panel's "written
        // into <file>" line is gated on the file being older: on this shape it would otherwise
        // claim a function predates a file it was moved into. It reads as flaky rather than
        // wrong when every commit lands in the same second, which is how it was written.
        let first = c.file_first.expect("the path has a history");
        assert!(
            first >= c.changes[1].when,
            "the path's log cannot see past the rename that gave it this name"
        );
        assert!(
            first >= c.changes[1].when - 86_400,
            "so the pane's older-file sentence stays silent here"
        );

        // The scan reads the worktree and `-L` reads HEAD, so a difference between them is the
        // one thing that makes the answer be about other lines. It is reported, never fixed.
        write("two.rs", "// header\nfn f() {\n    x\n    y\n    z\n}\n");
        assert!(line_history(dir.path(), "two.rs", 2, 5).expect("walks").dirty);

        let whole = line_history(dir.path(), "two.rs", 0, 0).expect("a file blames");
        assert!(
            whole.changes.is_empty(),
            "a whole-file query has no line walk — the Blame lens asks it of a file and the \
             two that read `changes` are function views"
        );
        assert!(!whole.touches.is_empty(), "the blame half answers a file perfectly well");
        assert!(line_history(dir.path(), "gone.rs", 1, 2).is_none(), "a path git has never seen");
    }

    /// The far end of a walk, and the thing it turned out NOT to be.
    ///
    /// **This is what the footer was guessing at.** It read the end of the walk as a rewrite
    /// hidden behind it. Both halves were wrong, and the second half is the interesting one:
    /// git maps replaced lines onto the lines they replaced and keeps going, so a wholesale
    /// rewrite does not end a walk — it means the dates can reach back past this function into
    /// the text that stood at these lines. The end is only ever a file being created or lines
    /// being written into one that already existed, and those two want opposite sentences.
    #[test]
    fn the_far_end_of_a_walk_says_which_kind_of_end_it_is() {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            std::process::Command::new("git")
                .arg("-C")
                .arg(dir.path())
                .args(args)
                .output()
                .expect("git runs");
        };
        let commit = |name: &str, text: &str, msg: &str| {
            std::fs::write(dir.path().join(name), text).expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", msg]);
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "ada@example.com"]);
        git(&["config", "user.name", "Ada"]);
        commit("a.rs", "// header\n// header\n", "just a file");
        // Written into a file that already existed: the walk ends here and nothing is hidden
        // behind it — the function is simply younger than its file.
        commit("a.rs", "// header\n// header\nfn f() {\n    x\n}\n", "a new function");
        let added = line_history(dir.path(), "a.rs", 3, 5).expect("walks");
        assert_eq!(added.origin, Origin::Added, "an insertion into a file that was already there");
        assert!(added.changes.iter().all(|t| t.path.is_none()), "no rename was crossed");
        assert_eq!(added.changes.len(), 1, "the commit above it never touched these lines");
        assert!(
            // `<=` because a test's commits land inside one second; the panel's own test of
            // whether the bound BINDS is a day apart, in `ChurnSection`.
            added.file_first.expect("history") <= added.changes[0].when,
            "the file is at least as old as the lines, which is the case worth printing it in"
        );

        // A wholesale rewrite of the same lines. The walk goes THROUGH it: two commits, ending
        // at the file's creation, and the older of the two is about text that no longer exists.
        commit("b.rs", "// header\nfn old() {\n    was here\n}\n", "the old one");
        commit("b.rs", "// header\nfn new() {\n    is here\n}\n", "wholesale");
        // 2,3 rather than 2,4: the closing brace of the old body survives the rewrite, and a
        // test about a commit whose work is gone must not include a line of it that is not.
        let rewritten = line_history(dir.path(), "b.rs", 2, 3).expect("walks");
        assert_eq!(
            rewritten.changes.len(),
            2,
            "a rewrite does not stop the walk — git follows the removed lines to what they \
             replaced, so `Origin` has no `Replaced` variant to report"
        );
        assert_eq!(rewritten.origin, Origin::Created, "it ends at the file, not at the rewrite");
        // **The join is the point of one record.** The rewrite's lines are here and the lines
        // it replaced are not, so the same list carries both and says which is which — two
        // lenses reading two fetches could only disagree about it.
        assert!(rewritten.changes[0].lines > 0, "the newer commit still owns these lines");
        assert_eq!(
            rewritten.changes[1].lines, 0,
            "the commit it replaced changed these lines and survives in none of them"
        );
    }
}
