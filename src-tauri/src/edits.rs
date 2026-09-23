//! How many times a function has actually changed, and when.
//!
//! This is Churn, and it is the third instrument to try to be. The first two are worth
//! stating because the reason each failed is the reason this one is shaped as it is.
//!
//! # What came before
//!
//! **`churn.rs` counts commits in a window, per FILE.** That is the right quantity and the
//! wrong resolution: every function in a file carried its file's number, so the ring that
//! holds the findings was a solid block per file — which is what `blame.rs` was written to
//! fix.
//!
//! **`blame.rs` counts distinct commits still alive in a range.** Per-function, and cheap:
//! 22ms a file. What it measures is not frequency. Blame keeps ONE commit per line, so a
//! function whose same ten lines were rewritten forty times reports the handful of commits
//! that happen to have survived — measured on this repo's own `CLAUDE.md`, two ranges with
//! 47 real edits apiece report 2. The reading is real (how many hands are layered in the
//! code in front of you) and it is not the hotspot question. `docs/notes/time.md` argues
//! this at length.
//!
//! It was never chosen over the timeline. `blame.rs` landed four days before `history.rs`
//! existed, and the commit that introduced the timeline scoped itself to the replay in its
//! own title — *"but not a colour"*. Nobody went back.
//!
//! # What this counts
//!
//! The timeline's walk re-parses every version of every changed file and diffs its functions
//! **by body hash** — see `history::Recorder`. So `HistoryCommit::set` is exactly "the
//! functions this commit changed", including a rewrite that changed no line count, which is
//! the edit blame cannot see at all. Counting across the walk is the frequency the lens has
//! always meant.
//!
//! # Timestamps, never counts
//!
//! A count is only true at the instant it was taken, because the window MOVES: ninety days
//! from WHEN. `churn.rs` learned this on `oldest_ts` — "a stored age is only true at the
//! instant it was taken; a stored timestamp is true forever" — and it is why this stores the
//! DATES of the edits rather than a tally of them. Every window a reader can ask for falls
//! out of the same stored dates with no second walk, which is what makes 30/60/90/180 a
//! control rather than four traces.
//!
//! Bucketed by DAY, which is exactly as fine as the question gets: a window is a number of
//! days, so two commits on the same afternoon are never on opposite sides of one. That is what
//! keeps the store small without capping anything — a directory the whole repo commits through
//! holds one entry per day it was touched, where a ring of individual commits would hold one
//! per commit and a capped ring would quietly report the last sixteen of four hundred.
//!
//! **A cap was the first design and it was wrong for containers.** Sixteen stamps is ample for
//! a function — the scale saturates at eight — and it turned godot's root directory, which 783
//! commits touched in ninety days, into a confident `16`. A tally that silently reports a
//! smaller number than the truth is the exact failure this app is built to refuse, and it took
//! a real repo to show it: every unit test passed.

use crate::history::HistoryScan;
use std::collections::{HashMap, HashSet};

/// The ladder a repo old enough to fill it offers, in days.
///
/// **90 is the middle and the default**, which is what Churn has always meant here — see
/// `churn::CHURN_WINDOW_DAYS`, whose reasoning this inherits: the audience is people whose
/// repos grew ten thousand lines last month, and a year-long window calls all of it stable.
/// The others are around it rather than past it: 30 is "this sprint", 180 is the longest
/// window still short enough that a busy file and a settled one look different.
const LADDER: [u32; 4] = [30, 60, 90, 180];

/// Which rung a repo answers with when nobody has chosen.
pub const DEFAULT_WINDOW: usize = 2;

/// The longest window anybody is offered, however old the repo.
///
/// **The cap is the half of this that is NOT proportional, and it is deliberate.** Age
/// normalizes to the whole life of the repo and argues for it: old means old *for this
/// codebase*. Churn cannot borrow that, because churn means *lately* — half of kibana's life
/// is six and a half years, and a six-year window is precisely the one `CHURN_WINDOW_DAYS`
/// says calls a whole repo stable. So: proportional at the young end, capped at the old one.
pub const CAP_DAYS: u32 = LADDER[LADDER.len() - 1];

/// The four windows this repo can actually answer, given how long it has existed.
///
/// **A fixed ladder goes inert on exactly the repos this app is for.** Measured: sanity is 27
/// days old and returns the identical 271 commits at 30, 60, 90 and 180 days — four choices,
/// one answer, a control that does nothing. krapow is 109 days old and dormant, and three of
/// the four rungs paint an empty map. Meanwhile godot, ladybird and kibana, all past eight
/// years, spread across the ladder exactly as intended.
///
/// So the ladder scales to a repo that cannot fill it, and the same argument `ageSpanOf` makes
/// applies word for word: in a project three weeks old, the last week IS a horizon, and a
/// scale that refuses to say so is answering a question about some other repo.
///
/// What it costs is that a window is no longer the same window everywhere, so a reading here
/// and a reading in an older repo are not comparable. Age already paid that, knowingly, and
/// said why: cross-repo comparison was never something this app offered.
///
/// The labels stay in DAYS either way, which is what keeps this sayable — a wedge says "14
/// commits in 14d", never "in the last 10% of the project".
pub fn windows_for(span_days: u32) -> [u32; 4] {
    if span_days >= CAP_DAYS {
        return LADDER;
    }
    // The same SHAPE as the ladder, squeezed into the life the repo has. A floor of one day,
    // because a rung of zero days is a window nothing can fall inside and would draw the repo
    // as untouched.
    let span = span_days.max(1);
    let mut out = [0u32; 4];
    for (i, rung) in LADDER.iter().enumerate() {
        out[i] = ((span as u64 * *rung as u64) / CAP_DAYS as u64).max(1) as u32;
    }
    // The top rung is the repo's whole life rather than a rounding of it: it is the widest
    // horizon there is here, and reporting it as 26 days on a 27-day repo would leave a day of
    // history that no window on the control can reach.
    out[3] = span;
    out
}

/// What a window's worth of commits saturates at.
///
/// **The anchor moves with the window, so the colour always means a RATE.** `CHURN_SATURATION`
/// is documented as "roughly a commit a week over the quarter" — a rate, said as a count
/// because the window was a constant. Now that it is not, holding the count fixed would make
/// every widening of the horizon brighten the whole map, and three of the four rungs would be
/// changing exposure rather than asking a different question. Scaled, a file somebody rewrote
/// twenty times last month cools as you widen (its rate over half a year is low) and a file
/// changed steadily holds its colour, which is the difference the control exists to show.
pub fn saturation_for(days: u32) -> f32 {
    (crate::churn::CHURN_SATURATION * days as f32 / 90.0).max(1.0)
}

/// One day's edits: the day, as whole days since the epoch, and how many landed in it.
///
/// A pair rather than a timestamp per commit, and the difference shows on containers: the root
/// of a busy repo is touched by every commit there is, and one entry per DAY bounds it at the
/// length of the walk however many commits that was.
type Day = (u32, u32);

/// Whole days since the epoch, for a timestamp. Negative times are pre-epoch and are not a
/// thing git reports; clamped rather than trusted, because a wrapped day index would sort
/// before every real one and count as ancient.
fn day_of(ts: i64) -> u32 {
    ts.max(0).div_euclid(86_400) as u32
}

/// What the timeline says about how often things change.
///
/// Keyed by [`crate::assessment::key_of`] for functions and by repo-relative path for files
/// and directories — the two keys the rest of the app already uses, so nothing here needs a
/// join table. **Never by node id**, which embeds a line number and is the rule with a body
/// count behind it.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct Edits {
    /// `key_of(path, name, ord)` → the days this function was changed on, oldest first.
    funcs: HashMap<String, Vec<Day>>,
    /// Repo-relative path → the days anything in it changed on, oldest first.
    ///
    /// Files and directories both, and the root is `""`. A commit counts **once** for a
    /// directory however many of its files it touched — the same rule `churn::flush_commit`
    /// follows, and for the same reason: summing per-file counts reports a commit that
    /// touched twelve files in one directory as twelve.
    paths: HashMap<String, Vec<Day>>,
    /// HEAD when this was walked. Empty means "never".
    pub head: String,
    /// The oldest instant this walk can speak for.
    ///
    /// **Not the oldest commit it found — the oldest it looked for.** A repo where nothing
    /// has been committed in four months has no commits in the walk and every function in it
    /// has genuinely changed zero times; reading the span off the commits would report that
    /// as an unknown. So a day-bounded walk sets this to where its bound was, and a reused
    /// full timeline sets it to its own first commit, which is older.
    ///
    /// **What it decides is one repo-level question**: whether a reader asking for 180 days
    /// is asking something this walk covers — see [`Edits::covers`]. A walk that reaches back
    /// ninety days would otherwise answer a hundred-and-eighty-day question with the ninety
    /// it has and call it the answer. The answer belongs on the lens, once, beside the button
    /// that fixes it, and never repeated on every segment.
    pub from_ts: i64,
    /// When the walk was taken. Not what any window is measured from — that is the reader's
    /// own clock — but what says how stale the walk is.
    pub taken_at: i64,
    /// Seconds per commit, measured on this repo's own walk.
    ///
    /// **Measured rather than assumed, because the spread is twentyfold.** godot walks at 9.6ms
    /// a commit, ladybird at 5.3ms and sanity at 0.4ms — same instrument, different repos,
    /// because the cost is commits × the size of the file versions each one touches. An
    /// estimate built on somebody else's rate would be wrong by that factor in the direction
    /// that matters. The twin of `churn::Bank::rate`, and it exists for the same reason.
    ///
    /// `None` until a walk has happened here.
    #[serde(default)]
    pub rate: Option<f32>,
    /// The four windows THIS repo offers, in days — see [`windows_for`].
    ///
    /// Carried rather than recomputed by every reader, because it is derived from the repo's
    /// age and the lens, the panel and the tooltip all have to name the same four numbers. Two
    /// places computing a ladder is two places to disagree about what "the middle rung" is,
    /// and the disagreement would read as a wrong count rather than as a wrong window.
    #[serde(default)]
    pub windows: [u32; 4],
}

/// Fold one edit into a path's or a function's days.
///
/// **Merged onto the last entry, never searched for.** The walk runs `--reverse`, so commits
/// arrive oldest first and every edit either extends the newest day or opens the next one —
/// which is what makes recording an edit O(1) on a container that every commit touches.
fn remember(into: &mut HashMap<String, Vec<Day>>, key: String, ts: i64) {
    let day = day_of(ts);
    let days = into.entry(key).or_default();
    match days.last_mut() {
        Some(last) if last.0 == day => last.1 += 1,
        // Out of order, which a `--reverse` walk does not produce and a merged timeline could:
        // find the day rather than opening a duplicate, because two entries for one day would
        // both be counted and the total would still be right — but `covers` and every future
        // merge would then be reading a list that is no longer one entry per day.
        Some(last) if last.0 > day => match days.iter_mut().find(|d| d.0 == day) {
            Some(d) => d.1 += 1,
            None => {
                days.push((day, 1));
                days.sort_unstable();
            }
        },
        _ => days.push((day, 1)),
    }
}

/// How many edits fall inside the last `days` days, counting back from `now`.
///
/// Whole days, and the boundary is stated rather than left to arithmetic: a window of 90 is
/// the ninety day-buckets ending with the one `now` is in. A commit at any hour of the
/// ninetieth day is inside it and one at any hour of the ninety-first is not, which is what
/// somebody means by "the last ninety days" and is why the store is bucketed this way.
///
/// **Checked against git rather than reasoned about.** On godot this counts 775 commits at the
/// repo root over ninety days where `git rev-list --since='90 days ago'` says 783; the eight
/// are the part-day at the far end, and `--since` the exact instant this window opens returns
/// 775 too. The days are UTC, so the cut is at UTC midnight rather than the reader's — which
/// moves a handful of commits across a boundary that a colour ramp cannot resolve, and is not
/// worth carrying a timezone through a cache to fix.
fn within(days_seen: &[Day], now: i64, days: u32) -> u32 {
    let cutoff = day_of(now) as i64 - days as i64;
    days_seen.iter().filter(|(d, _)| (*d as i64) > cutoff).map(|(_, n)| n).sum()
}

impl Edits {
    /// Count a walked timeline. `now` is the clock every window is measured back from.
    ///
    /// **Every commit in the scan, and the caller decides how far back that goes.** The walk
    /// is bounded by the top of this repo's ladder where this is driving it, and by nothing
    /// at all where a
    /// full timeline already existed and is being reused — counting a longer story costs one
    /// pass and can only make `from_ts` older, which is a strictly better answer.
    /// `head` is the repo's HEAD, which is what the store is keyed on.
    ///
    /// **Not `scan.head`, and the distinction has already cost this codebase a bug.** The walk
    /// skips merges, so a timeline's last commit is the newest NON-merge one and on a
    /// merge-heavy repo that is never `rev-parse HEAD`. Keying a store on it means the store
    /// never matches, which does not fail — it silently re-walks, every time, forever.
    /// `history::read_cached` carries the same paragraph about the same mistake. This one was
    /// caught by a real repo reporting an eighteen-second walk and a sixteen-second "cache".
    pub fn count(
        scan: &HistoryScan,
        now: i64,
        from_ts: i64,
        head: String,
        windows: [u32; 4],
    ) -> Edits {
        let mut out = Edits { head, from_ts, taken_at: now, windows, ..Edits::default() };
        for c in &scan.commits {
            for (fi, _) in &c.set {
                let Some(f) = scan.funcs.get(*fi as usize) else { continue };
                let Some(path) = scan.paths.get(f.path as usize) else { continue };
                // `ord` is one-based in the timeline and zero-based in a reading key. The
                // arithmetic is not decorative: off by one and every second same-named
                // function in a file is counted under the first one's key.
                let key = crate::assessment::key_of(path, &f.name, f.ord.saturating_sub(1) as usize);
                remember(&mut out.funcs, key, c.ts);
            }
            // The FILES this commit touched, not the files its changed functions are in: a
            // commit can rewrite a body without changing a line count, and `files` is the
            // field that survives that — see `HistoryCommit::files`.
            let mut dirs: HashSet<&str> = HashSet::new();
            for pi in &c.files {
                let Some(path) = scan.paths.get(*pi as usize) else { continue };
                remember(&mut out.paths, path.clone(), c.ts);
                let mut cut = 0;
                while let Some(i) = path[cut..].find('/') {
                    cut += i;
                    dirs.insert(&path[..cut]);
                    cut += 1;
                }
            }
            // The repo root is a directory too, and it is the one an ancestor walk always
            // misses — the loop above cuts at each `/`, so `src/a.rs` credits `src` and
            // nothing above it. `churn::flush_commit` had to learn this separately.
            let owned: Vec<String> = dirs.into_iter().map(str::to_string).collect();
            for d in owned {
                remember(&mut out.paths, d, c.ts);
            }
            remember(&mut out.paths, String::new(), c.ts);
        }
        out
    }

    /// Whether this walk reaches far enough back to answer for `days`.
    ///
    /// A walk that covers ninety days cannot be asked about a hundred and eighty: it would
    /// answer with the ninety it has and call it the answer, which is a window silently
    /// reporting a shorter one. The lens asks before it paints.
    pub fn covers(&self, now: i64, days: u32) -> bool {
        !self.head.is_empty() && self.from_ts <= now - (days as i64) * 86_400
    }

    /// Commits that changed this function inside `days` of `now`.
    ///
    /// **Absent means zero, and that is the common case rather than an error.** A walk bounded
    /// by a hundred and eighty days holds nothing at all about a function nobody has touched
    /// in a year — which is exactly the finding, not a gap. The one thing this cannot answer
    /// is a window longer than the walk, and that is a question about the repo: [`covers`]
    /// says so once, on the lens, where the button that fixes it is.
    ///
    /// [`covers`]: Edits::covers
    pub fn func(&self, key: &str, now: i64, days: u32) -> u32 {
        self.funcs.get(key).map_or(0, |seen| within(seen, now, days))
    }

    /// The same question about a file or a directory. The root is `""`.
    pub fn path(&self, path: &str, now: i64, days: u32) -> u32 {
        self.paths.get(path).map_or(0, |seen| within(seen, now, days))
    }

    /// Whether this is a walk at all, as opposed to the empty default.
    pub fn is_empty(&self) -> bool {
        self.head.is_empty()
    }
}

/// A walk, the clock its windows are measured from, and the window being asked for.
///
/// **One value rather than three arguments, and that is the `cap` lesson from `CLAUDE.md`.**
/// These three travel together through the scan, the deferred trace and every file and
/// function under both; passed separately they are six chances for a caller to thread the walk
/// and forget the clock, and the symptom would be a window measured from whenever the walk
/// happened rather than from now — silently narrower the longer HEAD sits still.
///
/// It also stops the clock being asked for per node. `now_secs` is a syscall, and the first
/// version of this called it once per directory and once per file.
#[derive(Clone, Copy)]
pub struct At<'a> {
    pub edits: &'a Edits,
    /// Now, as the reader's clock. **Not `Edits::taken_at`** — a walk cached three weeks ago
    /// under an unmoved HEAD is still true, and asking it about ninety days from when it ran
    /// would answer about a window that has since slid.
    pub now: i64,
    /// The rungs, in days — `Edits::windows`.
    pub windows: [u32; 4],
}

impl At<'_> {
    /// **All four windows, never one.** Which rung is being looked at is the reader's live
    /// choice, and answering only the current one would put a round trip and a re-aggregation
    /// of the whole tree behind a pulldown. Counting four is four passes over a list of at
    /// most a few day-buckets.
    pub fn func(&self, path: &str, name: &str, ord: usize) -> [u32; 4] {
        let key = crate::assessment::key_of(path, name, ord);
        self.windows.map(|d| self.edits.func(&key, self.now, d))
    }

    pub fn path(&self, path: &str) -> [u32; 4] {
        self.windows.map(|d| self.edits.path(path, self.now, d))
    }

    /// Counts on the 0..1 scale the ramp paints, each against its own window's anchor — see
    /// [`saturation_for`], which is why widening the horizon re-asks the question rather than
    /// turning up the brightness.
    pub fn rates(&self, counts: [u32; 4]) -> [f32; 4] {
        let mut out = [0.0f32; 4];
        for i in 0..4 {
            out[i] = (counts[i] as f32 / saturation_for(self.windows[i])).clamp(0.0, 1.0);
        }
        out
    }
}

/// The shape of a stored count. Bumped when [`Edits`] changes.
///
/// The version is in the slot NAME, so an old file is never read as a new one — it is simply
/// never opened again. A bump costs every repo one walk, which is twenty to sixty seconds of
/// somebody's afternoon; that is cheap next to a bank of timelines and expensive next to
/// nothing, so it belongs written down rather than bumped by reflex.
///
/// 2: a count taken off a stored timeline that stopped short of HEAD was stamped with HEAD and
/// served as current — see `history::stored_current` — so no count written before it is
/// trustworthy.
const EDITS_FORMAT: u32 = 2;

fn slot(repo: &std::path::Path) -> Option<std::path::PathBuf> {
    crate::reports::cache_slot("edits", repo, &format!("f{EDITS_FORMAT}"))
}

fn config() -> bincode::config::Configuration {
    bincode::config::standard()
}

/// Whatever was counted for this repo, or nothing.
pub fn load(repo: &std::path::Path) -> Option<Edits> {
    let bytes = std::fs::read(slot(repo)?).ok()?;
    bincode::serde::decode_from_slice::<Edits, _>(&bytes, config()).ok().map(|(e, _)| e)
}

/// Store a count. A failure is never fatal — this is an accelerant, and everything in it is
/// recomputable from git.
pub fn save(repo: &std::path::Path, edits: &Edits) {
    let Some(path) = slot(repo) else { return };
    crate::reports::prune_slots("edits", repo, &format!("f{EDITS_FORMAT}"));
    if let Ok(bytes) = bincode::serde::encode_to_vec(edits, config()) {
        let _ = std::fs::write(&path, bytes);
    }
}

/// What walking this repo would involve, priced without walking it.
#[derive(Debug, Clone, Default)]
pub struct Plan {
    /// Commits the walk would cover — the ones inside the widest window this repo offers.
    pub commits: usize,
    /// HEAD, which is what a stored count is keyed on. Empty means this is not a repo.
    pub head: String,
    /// The ladder — see [`windows_for`].
    pub windows: [u32; 4],
}

impl Plan {
    /// The widest window, which is what the walk has to reach back to.
    pub fn span(&self) -> u32 {
        self.windows[3]
    }
}

/// A rate for a repo nobody has walked here, seconds per commit.
///
/// The high end of the measured corpus rather than its mean: an estimate that comes in under
/// what the walk costs is one that talked somebody into a wait they did not agree to, and this
/// number's whole job is to decide whether to ask.
const COLD_RATE: f32 = 0.010;

/// What the edits walk would cost, without walking anything.
///
/// Priced separately from `trace::estimate`, which prices the log walk. They are two different
/// instruments over two different sets of commits and a single number for both would be an
/// average of things nobody runs together — the log walk is under a second where this is tens
/// of them.
pub fn estimate(repo: &std::path::Path) -> (f32, Option<u32>, bool) {
    let p = plan(repo);
    if p.head.is_empty() {
        return (0.0, None, false);
    }
    // Already walked at this HEAD and this ladder: there is nothing to spend. Not "fast" — the
    // same answer `gather` gives, which is the stored count.
    if let Some(held) = load(repo) {
        if held.head == p.head && held.windows == p.windows {
            return (0.0, Some(0), false);
        }
        if let Some(rate) = held.rate {
            return (p.commits as f32 * rate, Some(p.commits as u32), false);
        }
    }
    // Somebody has the whole story banked up to HEAD, so this is a counting pass over memory
    // rather than a walk. Not free — ceph's timeline is seconds of deserialising — but not
    // priced as a walk either, because it is not one. The same door `gather` takes: a story that
    // stops short of HEAD is walked there, and pricing it as free would skip the asking.
    if crate::history::stored_current(repo, crate::history::ALL_COMMITS)
        .is_some_and(|h| !h.commits.is_empty())
    {
        return (0.0, Some(0), false);
    }
    (p.commits as f32 * COLD_RATE, Some(p.commits as u32), true)
}

/// How many days this repo has existed, for a caller that only wants the ladder.
///
/// Split out of [`plan`] because naming the rungs is a thing the window needs before anything
/// has been walked, and it must not cost the `rev-list --count` that pricing a walk does.
pub fn span_days(repo: &std::path::Path) -> u32 {
    born_days(repo).unwrap_or(CAP_DAYS)
}

/// Days since this repo's oldest root commit, or `None` if git cannot say.
///
/// **The root commit, not `git log --reverse | head -1`.** The second walks the whole history
/// to print one line; `--max-parents=0` asks for the roots directly. A repo can have several —
/// a grafted import, two histories merged — so the oldest wins, which is the one that says how
/// long this project has existed.
fn born_days(repo: &std::path::Path) -> Option<u32> {
    let git = |args: &[&str]| -> Option<String> {
        let out = std::process::Command::new("git").arg("-C").arg(repo).args(args).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
    };
    let born = git(&["rev-list", "--max-parents=0", "HEAD"])?
        .lines()
        .filter_map(|sha| git(&["show", "-s", "--format=%ct", sha.trim()]))
        .filter_map(|ts| ts.trim().parse::<i64>().ok())
        .min()?;
    Some(((crate::churn::now_secs() - born).max(0) / 86_400) as u32)
}

/// Price the walk. Three `git` calls, all of them constant-time on any repo.
///
/// `--no-merges` throughout, matching the timeline walk: a count taken over a different set of
/// commits from the walk it is pricing is not an estimate of that walk.
pub fn plan(repo: &std::path::Path) -> Plan {
    let git = |args: &[&str]| -> Option<String> {
        let out = std::process::Command::new("git").arg("-C").arg(repo).args(args).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
    };
    let Some(head) = git(&["rev-parse", "HEAD"]).filter(|h| !h.is_empty()) else {
        return Plan::default();
    };
    // A repo git cannot date is given the full ladder: the cap is what an old repo gets, and
    // assuming a young one would narrow every window on no evidence.
    let windows = windows_for(born_days(repo).unwrap_or(CAP_DAYS));
    let commits = git(&[
        "rev-list",
        "--count",
        "--no-merges",
        &format!("--since={} days ago", windows[3]),
        "HEAD",
    ])
    .and_then(|s| s.parse().ok())
    .unwrap_or(0);
    Plan { commits, head, windows }
}

/// Count this repo's edits, walking only if it has to.
///
/// **A full timeline is reused rather than re-walked, and that is most of what this decides.**
/// Somebody who has already traced their history has paid for a superset of this walk; asking
/// them to pay again for a shorter version of the same thing would be the app spending their
/// cores on bookkeeping. The counting pass over a stored timeline is arithmetic — no parse, no
/// `cat-file` — so reusing is faster by the whole cost of the walk.
///
/// Otherwise the walk is bounded by [`MAX_DAYS`], which is the whole reason this is
/// affordable at all: ladybird is 81,770 commits and 6,022 of them are in the last hundred and
/// eighty days, so the bounded walk is 32 seconds against many minutes for the story.
///
/// `None` means somebody stopped it, and a stopped walk is never stored — a partial count
/// reads as a repo where nothing happens.
pub fn gather(
    repo: &std::path::Path,
    stop: &std::sync::atomic::AtomicBool,
    progress: &dyn Fn(crate::scan::Progress),
) -> Option<Edits> {
    let started = std::time::Instant::now();
    let now = crate::churn::now_secs();
    let p = plan(repo);
    if p.head.is_empty() {
        return Some(Edits::default());
    }
    // Already counted, at this HEAD. The windows move but the DATES do not, so a count taken
    // last week is as true today as it was then — which is the whole reason this stores
    // timestamps rather than tallies.
    //
    // **The ladder has to match too, and it is not a constant any more.** A repo's windows are
    // derived from its age (`windows_for`), so a stored count taken when it was three weeks old
    // carries a three-week ladder; using it at three months would label a 27-day window as the
    // 90-day one. It costs a re-walk on the day a young repo's ladder widens, which is a walk
    // bounded by three months of a repo that has existed for three months.
    if let Some(held) = load(repo) {
        if held.head == p.head && held.windows == p.windows {
            return Some(held);
        }
    }
    // The span this can speak for. Where the walk is day-bounded that is the bound itself and
    // not the oldest commit it happened to find — see `Edits::from_ts`.
    let bounded = now - (p.span() as i64) * 86_400;
    let scan = match crate::history::stored_current(repo, crate::history::ALL_COMMITS) {
        // Somebody has traced the whole story, up to HEAD. Count it where it lies. A story
        // that stops short of HEAD falls through to the bounded walk, which is what this was
        // priced at — carrying it forward could be years of commits.
        Some(full) if !full.commits.is_empty() => {
            let from = full.commits.first().map(|c| c.ts).unwrap_or(bounded).min(bounded);
            let out = Edits::count(&full, now, from, p.head, p.windows);
            save(repo, &out);
            return Some(out);
        }
        _ => {
            if p.commits == 0 {
                // Nothing has been committed inside the window. That is a complete answer —
                // every function has changed zero times — and it is the one case where the
                // walk is skipped rather than run and found empty.
                let out = Edits {
                    head: p.head,
                    from_ts: bounded,
                    taken_at: now,
                    windows: p.windows,
                    ..Edits::default()
                };
                save(repo, &out);
                return Some(out);
            }
            crate::history::read(repo, p.commits, progress)
        }
    };
    if stop.load(std::sync::atomic::Ordering::Relaxed) {
        return None;
    }
    let mut out = Edits::count(&scan, now, bounded, p.head, p.windows);
    // **Timed here, where the walk actually happened.** Only this branch walks: the reuse and
    // the nothing-committed branches above return without spending, and stamping their elapsed
    // time as a rate would price the next repo's walk from a cache hit.
    //
    // Too few commits to time is left unmeasured rather than recorded as instant — a handful of
    // commits is dominated by process startup, and a rate taken from it would under-price a
    // walk of thousands by an order of magnitude and skip the asking.
    if p.commits >= RATE_SAMPLE {
        out.rate = Some(started.elapsed().as_secs_f32() / p.commits as f32);
    } else if let Some(rate) = load(repo).and_then(|h| h.rate) {
        // Carried rather than dropped: a rate this repo measured on a real walk is still the
        // best evidence there is about it, and a short top-up must not throw it away.
        out.rate = Some(rate);
    }
    save(repo, &out);
    Some(out)
}

/// How many commits a walk has to cover before its timing is worth keeping as a rate — see
/// `gather`. Below this the elapsed time is mostly `git` starting up.
const RATE_SAMPLE: usize = 200;

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    /// A repo whose one function is rewritten in place, `n` times, over the same lines.
    ///
    /// **This is the shape blame cannot see**, and it is the reason this module exists: every
    /// rewrite replaces the same body, so the finished file's per-line provenance names one
    /// commit however many times it was written. See the test below.
    fn rewritten(n: usize) -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        std::fs::create_dir_all(dir.path().join("src")).expect("mkdir");
        for i in 0..n {
            // The same three lines, saying something different each time. A rewrite that keeps
            // the line COUNT is deliberate: it is the edit `history::Recorder` catches by body
            // hash and the one a size diff would miss.
            std::fs::write(
                dir.path().join("src/a.rs"),
                format!("fn only() {{\n    let x = {i};\n}}\n"),
            )
            .expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }
        dir
    }

    fn counted(repo: &std::path::Path) -> (Edits, i64) {
        let now = crate::churn::now_secs();
        let scan = crate::history::read(repo, crate::history::ALL_COMMITS, &|_| {});
        let p = plan(repo);
        (Edits::count(&scan, now, now - (p.span() as i64) * 86_400, p.head, p.windows), now)
    }

    /// **The claim the whole module rests on.** Twelve edits to one body is twelve, and blame
    /// — asked the same question about the same lines — says two.
    ///
    /// If this ever fails in the direction of agreement, the two instruments have stopped
    /// measuring different things and one of them is redundant. It has never been redundant:
    /// measured on this repo's own `CLAUDE.md`, two ranges with 47 real edits apiece report 2
    /// surviving commits.
    #[test]
    fn a_body_rewritten_in_place_counts_every_rewrite() {
        let dir = rewritten(12);
        let (edits, now) = counted(dir.path());
        let key = crate::assessment::key_of("src/a.rs", "only", 0);
        assert_eq!(
            edits.func(&key, now, 90),
            12,
            "twelve commits changed this body, so churn is twelve"
        );

        // The same range, through the instrument this replaces. `range_detail` folds the same
        // `--line-porcelain` output `FileBlame` is built from, so this is blame's own answer
        // and not a restatement of it. Every line in the finished file came from the last
        // commit, so blame can see exactly one of the twelve.
        let seen = crate::blame::range_detail(dir.path(), "src/a.rs", 1, 3)
            .expect("the file is tracked and has lines");
        // Two: the signature and the closing brace are still the first commit's, and the one
        // line that kept changing can only remember the last commit to change it. Ten of the
        // twelve edits left nothing behind. The number is pinned rather than bounded because
        // it is the finding — a body whose every line is from one commit would read as `1`,
        // and the point is that neither answer is anywhere near twelve.
        assert_eq!(
            seen.touches.len(),
            2,
            "blame keeps one commit per LINE, so rewriting a body in place erases its own history"
        );
    }

    /// **A stored timeline is reused only while it reaches HEAD.**
    ///
    /// `gather` counts a full trace where it lies rather than re-walking, and it used to take
    /// whatever timeline was banked: one replayed a year ago stopped at a commit a year old,
    /// was stamped with today's HEAD, and answered every window with nothing — htop drew all
    /// 1,579 functions as `no commits found` with a hundred commits in the last ninety days.
    #[test]
    fn a_stale_timeline_is_not_counted_as_current() {
        let dir = rewritten(4);
        let full = crate::history::read_cached(dir.path(), crate::history::ALL_COMMITS, &|_| {});
        assert_eq!(full.commits.len(), 4, "the story is banked");

        // Two more commits the banked timeline has never seen.
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        for i in 4..6 {
            std::fs::write(dir.path().join("src/a.rs"), format!("fn only() {{\n    let x = {i};\n}}\n"))
                .expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }

        let stop = std::sync::atomic::AtomicBool::new(false);
        let edits = gather(dir.path(), &stop, &|_| {}).expect("nobody stopped it");
        let now = crate::churn::now_secs();
        let key = crate::assessment::key_of("src/a.rs", "only", 0);
        assert_eq!(edits.func(&key, now, 90), 6, "the two commits past the banked head count");
        assert_eq!(edits.path("", now, 90), 6);
    }

    /// A window is a window: an edit outside it is not counted, and the same stored dates
    /// answer every window without a second walk.
    #[test]
    fn a_narrower_window_asks_the_same_dates_a_smaller_question() {
        let dir = rewritten(4);
        let (edits, now) = counted(dir.path());
        let key = crate::assessment::key_of("src/a.rs", "only", 0);
        // Every commit was made a moment ago, so every window sees all four.
        for days in edits.windows {
            assert_eq!(edits.func(&key, now, days), 4, "{days}d");
        }
        // And a clock a year on sees none of them, off the same stored dates.
        let later = now + 400 * 86_400;
        for days in edits.windows {
            assert_eq!(edits.func(&key, later, days), 0, "{days}d, a year later");
        }
    }

    /// **The ladder is the repo's own, and a fixed one goes inert on the repos this app is
    /// for.** Measured before this changed: sanity at 27 days returned the identical 271
    /// commits at 30, 60, 90 and 180 days — four choices and one answer.
    #[test]
    fn a_young_repo_gets_a_ladder_it_can_fill() {
        // Old enough to fill the ladder: the ladder itself, unchanged.
        assert_eq!(windows_for(CAP_DAYS), LADDER);
        assert_eq!(windows_for(4_891), LADDER, "godot is thirteen years old");

        // sanity's own age when this was written. Four windows, four different horizons, the
        // widest of them the whole life of the project.
        let young = windows_for(27);
        assert_eq!(young, [4, 9, 13, 27]);
        assert!(young.windows(2).all(|w| w[0] < w[1]), "every rung is a different question");

        // krapow: dormant, and three of the four fixed rungs used to paint an empty map.
        assert_eq!(windows_for(109), [18, 36, 54, 109]);

        // A repo committed into this morning still gets four windows rather than four zeroes:
        // a rung of zero days is one nothing can fall inside, and would draw the whole map as
        // untouched on the day it was written.
        assert_eq!(windows_for(0), [1, 1, 1, 1]);
        assert_eq!(windows_for(1), [1, 1, 1, 1]);
    }

    /// The anchor moves with the window, so what the colour means is a rate.
    ///
    /// Without this, widening the horizon just brightens the map: the same twelve edits over
    /// thirty days and over a hundred and eighty are the same number against the same
    /// denominator, and three of the four rungs would be changing exposure rather than asking
    /// a different question.
    #[test]
    fn the_anchor_moves_with_the_window() {
        assert_eq!(saturation_for(90), crate::churn::CHURN_SATURATION, "the quarter is the anchor");
        assert_eq!(saturation_for(180), crate::churn::CHURN_SATURATION * 2.0);
        assert_eq!(saturation_for(30), crate::churn::CHURN_SATURATION / 3.0);
        // Never below one: on a one-day window a fraction of a commit would saturate anything
        // that moved at all, and every touched wedge would read as maximally churning.
        assert_eq!(saturation_for(1), 1.0);

        // What that buys, said as the reading: a steady file holds its colour as the horizon
        // widens, and a burst-then-quiet one cools.
        let steady_30 = 4.0 / saturation_for(30);
        let steady_180 = 24.0 / saturation_for(180);
        assert!((steady_30 - steady_180).abs() < 0.001, "two a fortnight, either way you look");
        let burst_30 = 20.0 / saturation_for(30);
        let burst_180 = 20.0 / saturation_for(180);
        assert!(burst_180 < burst_30 / 3.0, "one busy month is a quiet half-year");
    }

    /// A directory counts a commit once however many of its files that commit touched — the
    /// rule `churn::flush_commit` follows, and the one that makes a roll-up honest.
    #[test]
    fn a_directory_counts_a_commit_once() {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        std::fs::create_dir_all(dir.path().join("src")).expect("mkdir");
        for i in 0..3 {
            for f in ["a", "b", "c"] {
                std::fs::write(
                    dir.path().join(format!("src/{f}.rs")),
                    format!("fn {f}() {{\n    let x = {i};\n}}\n"),
                )
                .expect("writes");
            }
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }
        let (edits, now) = counted(dir.path());
        assert_eq!(edits.path("src/a.rs", now, 90), 3, "one file, three commits");
        assert_eq!(
            edits.path("src", now, 90),
            3,
            "three commits touching three files apiece is three, not nine"
        );
        assert_eq!(edits.path("", now, 90), 3, "and the root is a directory like any other");
    }
}

/// A real repo, walked and counted end to end. Ignored by default — it walks a hundred and
/// eighty days of somebody else's history and takes half a minute.
///
/// `cargo test --lib edits::real -- --ignored --nocapture EDITS_REPO=<path>`
#[cfg(test)]
mod real {
    use super::*;

    #[test]
    #[ignore = "walks a real repo; set EDITS_REPO"]
    fn a_real_repo_counts_and_caches() {
        let Ok(path) = std::env::var("EDITS_REPO") else { return };
        let repo = std::path::Path::new(&path);
        let stop = std::sync::atomic::AtomicBool::new(false);
        let t0 = std::time::Instant::now();
        let first = gather(repo, &stop, &|_| {}).expect("nobody stopped it");
        let walked = t0.elapsed();
        let t1 = std::time::Instant::now();
        let again = gather(repo, &stop, &|_| {}).expect("nobody stopped it");
        let cached = t1.elapsed();
        let now = crate::churn::now_secs();
        // The repo's OWN ladder, not a fixed one — see `windows_for`. Printing 90 days on a
        // repo that has existed for 27 is how the first version of this reported a window
        // nothing on the control could ask for.
        let rungs: Vec<String> = first
            .windows
            .iter()
            .map(|d| format!("{d}d={}", first.path("", now, *d)))
            .collect();
        println!(
            "{}: walk {:.1}s, cached {:.0}ms, {} functions, {} paths, root {}",
            repo.display(),
            walked.as_secs_f32(),
            cached.as_millis(),
            first.funcs.len(),
            first.paths.len(),
            rungs.join(" "),
        );
        for d in first.windows {
            assert!(first.covers(now, d), "a repo answers every window it offers ({d}d)");
        }
        assert_eq!(first.head, again.head, "the second call answers from the store");
        assert!(cached < walked, "and answers faster than it walked");

        // The rate this repo measured, and what the next walk of it would be priced at. A walk
        // already done at this HEAD costs nothing, which is what the estimate has to say — the
        // alternative is a button offering to spend thirty seconds re-deriving a stored answer.
        let (seconds, commits, cold) = estimate(repo);
        println!("  rate {:?}s/commit, next walk {seconds:.1}s over {commits:?}, cold {cold}",
                 first.rate);
        assert!(first.rate.is_some(), "a walk this long is timed and the timing is kept");
        assert_eq!(seconds, 0.0, "nothing to walk at this HEAD");
        assert!(!cold, "and the price is measured evidence, not a bound");
    }
}

