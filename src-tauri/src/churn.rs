//! Git history: the stability axis.
//!
//! Surprise alone can't tell a subtle algorithm from an incomprehensible mess — both are
//! unpredictable. Age and churn are what separate them, and without this module the
//! quadrants collapse and every finding reads "this code is weird" with no advice
//! attached.
//!
//! Everything here comes from **one** `git log` pass. The obvious implementation asks
//! git per file, which on a repo with a few thousand files means a few thousand process
//! spawns and turns a two-second scan into a two-minute one. Measured on ceph: the whole
//! walk is `git rev-list --count HEAD -- src/mon` nine hundred times over, and that one
//! query alone costs 0.94s.
//!
//! # Two counts out of one walk, and they are different questions
//!
//! `recent_commits` is the churn axis: commits inside a 90-day window, which is a RATE.
//! `total_commits` is how many commits have ever touched this path, which is a SIZE — the
//! figure a header wants when it says what a thing is made of. Neither substitutes for the
//! other: a file rewritten forty times in 2019 and untouched since is huge and settled, and
//! a window cannot say the first half while a total cannot say the second.
//!
//! **The total is why the walk is no longer capped.** It read the newest 5,000 commits, on
//! the argument that older ones change neither the window nor the age ranking. That was true
//! of both things it then computed and is false of a total, which a cap turns into a longer
//! window with no label on it. It was quietly false of age too: a file untouched for 5,000
//! commits had no entry at all, so it reported the same `None` as a file git has never heard
//! of, and the panel said "no history" over code with twenty years of it.
//!
//! The full walk measured 4.0s on ceph (163,916 commits, 603k path lines) against 29.4s for
//! the blame pass on a fraction of that repo, and 0.02s on this one. It is not free and it is
//! not the expensive part of a scan.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Command;

/// Commits within this many days count as churn. Deliberately short: the audience is
/// people whose repos grew ten thousand lines last month, and a year-long window would
/// call all of it stable.
const CHURN_WINDOW_DAYS: f32 = 90.0;

/// Commits in the window at which a file counts as fully churning.
///
/// An **absolute** anchor, not a percentile of the repo's own files. Normalizing against
/// the repo sounds more adaptive and is a trap: a single generated artefact — a
/// lockfile, a changelog, a vendored client — racks up hundreds of commits, becomes the
/// denominator, and squashes every hand-written file to nearly zero churn, which is
/// precisely backwards. With a fixed anchor the pathological file simply saturates at
/// 1.0, which is both true and harmless to everything else. Roughly a commit a week over
/// the quarter, which is a file someone is actively working on.
pub const CHURN_SATURATION: f32 = 8.0;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct FileHistory {
    /// Commits in the window touching this file.
    ///
    /// The one field here a stored walk cannot simply keep: the window MOVES, so a bank
    /// taken last month describes a quarter that has since ended. [`Bank::refresh`] recounts
    /// it from a `--since` walk, which is bounded by ninety days of activity rather than by
    /// the age of the repo.
    pub recent_commits: u32,
    /// Commits touching this file in the whole history — see the module docs for why this
    /// is not the same question as `recent_commits` and cannot be derived from it.
    pub total_commits: u32,
    /// Author time of the oldest commit we saw touching it, epoch seconds.
    ///
    /// **Absolute, where this used to be days-since-now, and that is what makes a walk
    /// bankable.** A stored age is only true at the instant it was taken; a stored timestamp
    /// is true forever, and the days-since falls out of it whenever somebody asks.
    pub oldest_ts: i64,
    /// Author time of the newest, epoch seconds.
    pub newest_ts: i64,
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

#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct History {
    /// Commits per author, kept so a delta walk can be MERGED into a stored one — the
    /// ranking below is derived from this and cannot be added up on its own.
    by_author: HashMap<String, u32>,
    /// When this was read, epoch seconds. Every `days` an accessor reports is measured from
    /// here — see [`FileHistory::oldest_ts`].
    now: i64,
    files: HashMap<String, FileHistory>,
    /// Everyone who has ever committed here, most commits first.
    ///
    /// **A repo-wide, all-time ordering, because a person's colour has to be one colour.**
    /// The Blame lens used to rank authors by how many lines they hold in whatever is on
    /// screen, which is a fine answer to "who owns this directory" and a terrible identity: it
    /// changed when you drilled, and during a replay it changed as the story ran, so the map
    /// spent its time animating its own ranking. Ranked once over the whole log, a person's
    /// slot is the same in every frame, in every subtree, and on the live map — see
    /// `authorRank` in the window.
    ///
    /// Commits rather than lines, because this walk counts commits and a second pass over
    /// `git log --numstat` to weigh them would cost more than the ordering is worth. What the
    /// order decides is only who gets the better-separated end of the palette.
    authors: Vec<String>,
}

impl History {
    /// Everyone who has committed here, most commits first — see the field.
    pub fn authors(&self) -> &[String] {
        &self.authors
    }

    /// Normalized 0..1 churn for a repo-relative path. See [`CHURN_SATURATION`] for why
    /// the scale is absolute rather than relative to the repo.
    pub fn churn_of(&self, path: &str) -> f32 {
        let Some(h) = self.files.get(path) else {
            return 0.0;
        };
        (h.recent_commits as f32 / CHURN_SATURATION).clamp(0.0, 1.0)
    }

    /// Raw commits in the window. The normalized `churn_of` is what the math uses; this
    /// is what a person can act on — "changed 14 times since May" means something,
    /// "churn 100%" does not.
    pub fn commits_of(&self, path: &str) -> u32 {
        self.files.get(path).map(|h| h.recent_commits).unwrap_or(0)
    }

    /// Every commit that has ever touched this path, or `None` where git has never heard
    /// of it.
    ///
    /// `None` rather than zero, and the distinction is the whole reason this exists: an
    /// untracked file and a file nobody has touched this quarter were one answer while the
    /// walk was capped, and "no history" is a fact about the REPO where "0 commits" is a
    /// claim about the file. A directory counts a commit once however many of its files
    /// that commit touched — see [`flush_commit`].
    pub fn total_commits_of(&self, path: &str) -> Option<u32> {
        self.files.get(path).map(|h| h.total_commits)
    }

    /// Days since the most recent commit touching this file.
    pub fn last_touched_of(&self, path: &str) -> Option<f32> {
        self.files.get(path).map(|h| days_since(self.now, h.newest_ts))
    }

    /// Who last committed to this file.
    pub fn last_author_of(&self, path: &str) -> Option<String> {
        self.files.get(path).map(|h| h.last_author.clone()).filter(|a| !a.is_empty())
    }

    /// How long ago the oldest commit touching this file landed.
    ///
    /// `None` when the file has no history — untracked, or not a git repo at all. A missing
    /// age must stay missing rather than defaulting to zero, because "brand new" is a claim
    /// that moves code into the Trouble quadrant.
    pub fn age_of(&self, path: &str) -> Option<f32> {
        self.files.get(path).map(|h| days_since(self.now, h.oldest_ts))
    }

    /// Oid of the newest commit touching this path.
    ///
    /// `None` now means what it says — git has never seen this path — because the walk is
    /// no longer capped. It used to mean "not in the last 5,000 commits" as well, which
    /// `scancache` was written to tolerate: a file untouched that long cannot have its blame
    /// change without the history being rewritten, and that is detected separately and
    /// wholesale. Nothing there needs revisiting; there is simply one fewer way to be
    /// absent.
    pub fn last_commit_of(&self, path: &str) -> Option<&str> {
        self.files.get(path).map(|h| h.last_commit.as_str()).filter(|c| !c.is_empty())
    }

    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }
}

/// Read history for `repo`. Never fails: a directory that isn't a git repo is a
/// perfectly reasonable thing to scan, it just scores without the stability axis.
///
/// The whole log, which on a large repo is the expensive way to arrive here — 6.5s on ceph,
/// 17.5s on kibana, 56s on linux. [`refresh`] is the one that keeps a stored walk current
/// instead, and this is what it falls back to.
pub fn read(repo: &Path) -> History {
    match walk(repo, &[], now_secs(), &NEVER, &|_| {}) {
        Walked::Done(h) => h,
        // Unreachable with a stop flag that is never set, and answered rather than unwrapped:
        // an empty history is what every other failure here returns.
        Walked::Stopped => History::default(),
    }
}

/// A stop flag for the callers that have none. Named rather than constructed inline so the
/// three of them cannot each invent one.
static NEVER: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// How a walk ended.
///
/// **A stopped walk is not a short one, and the difference is the whole reason this is not an
/// `Option` of convenience.** A partial log folds into a perfectly well-formed `History` that
/// is simply missing the older half of the repo — every file looks younger than it is and some
/// look untracked. Banked, that is indistinguishable from a complete walk and would be served
/// as the truth until somebody rewrote history. So the incomplete case is a variant nobody can
/// unwrap by accident, and [`refresh`] refuses to bank it.
enum Walked {
    Done(History),
    Stopped,
}

/// One `git log`, folded. `bounds` narrows it — a revision range, a `--since`, or nothing.
///
/// **Streamed rather than buffered, and that is what gives depth 1 a gauge.** It was
/// `Command::output()`, which hands back the entire log in one call: no count until it is over
/// and nothing to interrupt. On linux that is 56 seconds in which the trace pill's first
/// chamber could only be empty or full, so the control read as though one press had done
/// nothing and a second was needed. Reading the pipe in chunks costs nothing — the bytes were
/// always going to be buffered, they are merely counted on the way past — and buys both the
/// count and the stop.
///
/// The count is `\x01` bytes, which is exactly what [`parse_log`] splits on: the same
/// delimiter, so the gauge and the fold cannot disagree about how many commits went by.
fn walk(
    repo: &Path,
    bounds: &[&str],
    now: i64,
    stop: &std::sync::atomic::AtomicBool,
    tick: &dyn Fn(usize),
) -> Walked {
    let child = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args([
            "log",
            "--no-merges",
            // \x01 starts a commit, \x02 separates its fields: timestamp, author, oid.
            "--format=%x01%ct%x02%an%x02%H",
            "--name-only",
        ])
        .args(bounds)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn();

    let Ok(mut child) = child else {
        return Walked::Done(History::default());
    };
    let Some(mut out) = child.stdout.take() else {
        let _ = child.kill();
        return Walked::Done(History::default());
    };

    use std::io::Read;
    let mut text = Vec::new();
    let mut chunk = vec![0u8; 64 * 1024];
    let mut seen = 0usize;
    loop {
        if stop.load(std::sync::atomic::Ordering::Relaxed) {
            // The pipe is dropped with the child, so git gets EPIPE and exits rather than
            // filling a buffer nobody is reading. Reaped either way — a `git log` of linux
            // left unwaited is a zombie for the life of the app.
            let _ = child.kill();
            let _ = child.wait();
            return Walked::Stopped;
        }
        match out.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => {
                seen += chunk[..n].iter().filter(|b| **b == 0x01).count();
                text.extend_from_slice(&chunk[..n]);
                tick(seen);
            }
            // A read error mid-log is the same answer as a git that would not start: no
            // history, rather than a partial one presented as whole.
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return Walked::Done(History::default());
            }
        }
    }
    match child.wait() {
        Ok(status) if status.success() => {
            Walked::Done(parse_log(&String::from_utf8_lossy(&text), now))
        }
        _ => Walked::Done(History::default()),
    }
}

/// A stored walk, the commit it was taken at, and what it cost.
#[derive(Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct Bank {
    /// HEAD when this was taken. Empty means "never walked".
    pub head: String,
    pub history: History,
    /// Seconds per commit, measured on this repo's own last substantial walk.
    ///
    /// **Measured rather than assumed, because the spread is fourfold.** ceph walks at 40µs a
    /// commit and kibana at 160µs — same instrument, different repos, because the cost is
    /// commits × paths-touched and kibana's commits touch far more paths. An estimate built on
    /// somebody else's rate would be wrong by that factor in the direction that matters.
    ///
    /// `None` until a walk long enough to time has happened — see [`RATE_SAMPLE`].
    pub rate: Option<f32>,
    /// Commits inside the churn window at the last refresh, which is what the next refresh's
    /// bounded walk will cost. Its own number rather than a share of the total: a repo can be
    /// twenty years old and busy this week, or the reverse.
    pub window_commits: u32,
    /// When this walk was taken, so [`refresh`] can tell a stale window from a current one.
    ///
    /// **`Option`, and the absence is what makes this free to add.** A bank written before this
    /// field existed reads as `None`, which means "unknown" and forces a full refresh — the
    /// conservative direction, and the same behaviour every launch already had. It cannot make
    /// anything wrong, only slower, and it repairs itself on the first write. That is why it
    /// does NOT move `BANK_FORMAT`: bumping would throw away every banked walk in the app —
    /// a fresh log walk of nixpkgs and kibana apiece — to buy nothing at all.
    ///
    /// This is the safe half of the `#[serde(default)]` hazard rather than an exception to it.
    /// The rule exists because a default can read as a valid VALUE and be silently believed;
    /// `None` here is unreadable as a timestamp and every path that consults it treats it as
    /// "walk again".
    #[serde(default)]
    pub taken_at: Option<i64>,
}

/// How long a banked walk stays good while HEAD has not moved.
///
/// **A relaunch used to re-walk the churn window every time, and on a large repo that is most
/// of what an open costs.** The window is a rate over the last ninety days, so it slides with
/// wall-clock time and the walk was rerun unconditionally — measured at **2.1s over 5,599
/// commits on kibana and 12.4s over 28,593 on nixpkgs**, before the bank it produces is
/// serialized back over the 136MB it came from. Every launch, for a number that had not
/// changed.
///
/// What it is really re-deriving is which commits have aged OUT, since with HEAD unchanged
/// none have come in. Six hours of drift is a fifteen-hundredth of the window; on kibana's
/// rate that is about fifteen commits of five and a half thousand, well under a percent. It is
/// hours rather than days because the number wants to be visibly current within a working
/// session, and hours rather than minutes because a person restarting the app four times in an
/// afternoon should pay for that walk once.
const WINDOW_DRIFT: i64 = 6 * 60 * 60;

/// A walk shorter than this is not timed. Process startup and the first page of output are a
/// fixed cost that would read as an enormous per-commit rate on a small repo, and a small repo
/// is exactly where the estimate does not matter.
const RATE_SAMPLE: u32 = 500;

/// Bring a stored walk up to date, or take one if there is none.
///
/// **This is what makes depth 1 free after the first time, and there is deliberately no rule
/// about "the first time" anywhere in it.** Three cases, each costing what it actually costs:
///
/// - **No bank, or a rewritten history** — the full walk. `merge-base --is-ancestor` is the
///   same test `history.rs` makes before it appends to a timeline, and for the same reason: a
///   rebase means the stored commits are not the commits in front of us, and folding one into
///   the other produces a history that never happened.
/// - **HEAD has moved** — one `<banked>..HEAD` walk, absorbed. Bounded by what was committed
///   since somebody last looked.
/// - **HEAD is where it was** — nothing to absorb.
///
/// The window is recounted every time regardless, because ninety days from WHEN is the one
/// thing a stored answer cannot keep — see [`History::rewindow`].
pub fn refresh(
    repo: &Path,
    banked: Option<Bank>,
    stop: &std::sync::atomic::AtomicBool,
    tick: &dyn Fn(usize),
) -> Option<(Bank, bool)> {
    let now = now_secs();
    let head = head_of(repo);

    // **Nothing has happened and nothing has aged out worth the walk: hand it straight back.**
    // The costly half of a refresh is re-deriving a window that has not meaningfully moved —
    // see [`WINDOW_DRIFT`]. Returning `false` also spares the caller writing the bank, which on
    // nixpkgs is 136MB of JSON serialized over the top of the identical 136MB it was read from.
    if let Some(bank) = &banked {
        let fresh = bank.taken_at.is_some_and(|t| now.saturating_sub(t) < WINDOW_DRIFT);
        if !bank.head.is_empty() && bank.head == head && fresh {
            return banked.map(|b| (b, false));
        }
    }

    let window = format!("--since={CHURN_WINDOW_DAYS} days ago");
    let started = std::time::Instant::now();

    // The commits counted so far, across every walk this call makes. The estimate prices the
    // delta AND the window together (see `trace::estimate`), so the gauge has to add them up
    // the same way or its denominator is a number from a different question.
    let counted_so_far = std::sync::atomic::AtomicUsize::new(0);
    // Read at call time rather than captured, so each walk carries on from where the last one
    // finished instead of restarting the count at zero — which on a repo with a banked walk
    // would send the chamber backwards as the window pass began.
    let onward = |n: usize| tick(counted_so_far.load(std::sync::atomic::Ordering::Relaxed) + n);
    let bank_seen = |h: &History| {
        let n = h.total_commits_of("").unwrap_or(0);
        counted_so_far.fetch_add(n as usize, std::sync::atomic::Ordering::Relaxed);
        n
    };

    let (mut history, mut rate, walked) = match banked {
        Some(bank) if !bank.head.is_empty() && is_ancestor(repo, &bank.head) => {
            let mut history = bank.history;
            let mut walked = 0;
            if bank.head != head {
                let delta = match walk(
                    repo,
                    &[&format!("{}..HEAD", bank.head)],
                    now,
                    stop,
                    &onward,
                ) {
                    Walked::Done(h) => h,
                    Walked::Stopped => return None,
                };
                walked = bank_seen(&delta);
                history.absorb(delta);
            }
            (history, bank.rate, walked)
        }
        _ => {
            let whole = match walk(repo, &[], now, stop, &onward) {
                Walked::Done(h) => h,
                Walked::Stopped => return None,
            };
            let walked = bank_seen(&whole);
            (whole, None, walked)
        }
    };
    let recent = match walk(repo, &[&window], now, stop, &onward) {
        Walked::Done(h) => h,
        Walked::Stopped => return None,
    };
    let window_commits = recent.total_commits_of("").unwrap_or(0);
    history.rewindow(&recent, now);

    // Timed over everything this call walked — the delta and the window both — which is the
    // quantity the next estimate multiplies. A short walk is left untimed rather than banked
    // as a wild rate; see `RATE_SAMPLE`.
    let counted = walked + window_commits;
    if counted >= RATE_SAMPLE {
        rate = Some(started.elapsed().as_secs_f32() / counted as f32);
    }
    Some((Bank { head, history, rate, window_commits, taken_at: Some(now) }, true))
}

/// Commits between `head` and HEAD, without walking their contents.
///
/// The pricing half of an estimate, and it is bounded by what has happened SINCE — `rev-list
/// --count HEAD` over a whole repo is 7.1s on linux, which is too much to spend deciding
/// whether to spend anything.
pub fn commits_since(repo: &Path, head: &str) -> u32 {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-list", "--no-merges", "--count", &format!("{head}..HEAD")])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse().ok())
        .unwrap_or(0)
}

/// How many objects this repo's packs hold, which costs nothing to ask.
///
/// **The free bound for a repo nobody has walked yet.** Objects over-count commits — by about
/// ten on code-shaped repos and by forty-five on one carrying large binaries — so a tenth of
/// them is an estimate that errs toward asking on exactly the repos where asking is right.
/// Measured at 0.00–0.05s on every repo tried, against 7.1s for counting linux's commits
/// properly, and it classified all five test repos correctly at a ten-second budget:
/// sanity 0.007s (0.02 actual), ceph 6.8s (6.5), kibana 20s (17.5), linux 47s (56).
pub fn packed_objects(repo: &Path) -> u32 {
    let out = Command::new("git").arg("-C").arg(repo).args(["count-objects", "-v"]).output();
    let Ok(out) = out else { return 0 };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .find_map(|l| l.strip_prefix("in-pack: "))
        .and_then(|n| n.trim().parse().ok())
        .unwrap_or(0)
}

fn head_of(repo: &Path) -> String {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default()
}

/// Is `old` an ancestor of HEAD? A `false` means the history was rewritten — the same test
/// `scancache` and `history` both make before they extend anything.
fn is_ancestor(repo: &Path, old: &str) -> bool {
    Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(["merge-base", "--is-ancestor", old, "HEAD"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Days from `ts` to `now`, never negative — a commit dated in the future is a clock nobody
/// here can fix, and a negative age would read as code from next week.
fn days_since(now: i64, ts: i64) -> f32 {
    ((now - ts) as f32 / 86_400.0).max(0.0)
}

pub(crate) fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Record one commit against one path — a file or a directory.
fn credit(
    files: &mut HashMap<String, FileHistory>,
    key: &str,
    ts: i64,
    recent_from: i64,
    author: &str,
    oid: &str,
) {
    let e = files.entry(key.to_string()).or_default();
    // **`newest_ts` rather than "have I seen this before".** The walk runs newest first, so
    // the first sighting used to be the newest by construction — and that is exactly the
    // assumption a DELTA walk breaks, because it folds new commits into a record that
    // already has older ones in it. Comparing timestamps holds either way round.
    if ts > e.newest_ts {
        e.newest_ts = ts;
        e.last_author = author.to_string();
        e.last_commit = oid.to_string();
    }
    if e.oldest_ts == 0 || ts < e.oldest_ts {
        e.oldest_ts = ts;
    }
    e.total_commits += 1;
    if ts >= recent_from {
        e.recent_commits += 1;
    }
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
    recent_from: i64,
    author: &str,
    oid: &str,
    touched: &mut Vec<String>,
) {
    if ts == 0 || touched.is_empty() {
        touched.clear();
        return;
    }
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
        credit(files, path, ts, recent_from, author, oid);
    }
    for dir in dirs {
        credit(files, &dir, ts, recent_from, author, oid);
    }
    // The repo root is a directory too, and it is the one every ancestor walk misses: the
    // loop above cuts at each `/`, so `src/a.rs` credits `src` and nothing above it. Nobody
    // noticed while this only fed the churn window, because the root's wedge is the hub and
    // is painted by nothing — but the root is exactly where a lifetime total gets read, and
    // it was the one path in the tree reporting that git had never heard of it.
    credit(files, "", ts, recent_from, author, oid);
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
    let recent_from = now - (CHURN_WINDOW_DAYS as i64) * 86_400;
    let mut files: HashMap<String, FileHistory> = HashMap::new();
    let mut by_author: HashMap<String, u32> = HashMap::new();
    let mut commit_ts: i64 = 0;
    let mut author = String::new();
    let mut oid = String::new();
    let mut touched: Vec<String> = Vec::new();

    for line in text.lines() {
        if let Some(rest) = line.strip_prefix('\u{1}') {
            // A new commit starts, so the previous one is complete.
            flush_commit(&mut files, commit_ts, recent_from, &author, &oid, &mut touched);
            let (ts, rest) = rest.split_once('\u{2}').unwrap_or((rest, ""));
            // Author names contain almost anything, oids contain nothing; splitting from
            // the RIGHT keeps a name with a \x02 in it from eating the oid.
            let (who, id) = rest.rsplit_once('\u{2}').unwrap_or((rest, ""));
            commit_ts = ts.trim().parse().unwrap_or(0);
            author = who.trim().to_string();
            oid = id.trim().to_string();
            if !author.is_empty() {
                *by_author.entry(author.clone()).or_default() += 1;
            }
            continue;
        }
        let path = line.trim();
        if path.is_empty() || commit_ts == 0 {
            continue;
        }
        touched.push(path.to_string());
    }
    flush_commit(&mut files, commit_ts, recent_from, &author, &oid, &mut touched);

    let authors = rank(&by_author);
    History {
        now,
        files,
        authors,
        by_author,
    }
}

/// Most commits first; ties by name so two people with the same count cannot swap places
/// between two reads of the same repo and take each other's colour with them.
fn rank(by_author: &HashMap<String, u32>) -> Vec<String> {
    let mut authors: Vec<(&String, &u32)> = by_author.iter().collect();
    authors.sort_by(|a, b| b.1.cmp(a.1).then_with(|| a.0.cmp(b.0)));
    authors.into_iter().map(|(name, _)| name.clone()).collect()
}

impl History {
    /// Fold a later walk's commits into this one.
    ///
    /// **The half of a refresh that is genuinely incremental.** Commits are immutable, so
    /// everything but the window is a running total: what `<banked>..HEAD` says can be added
    /// to what is already here, and `credit` compares timestamps rather than trusting the
    /// walk's order precisely so that this direction works.
    fn absorb(&mut self, newer: History) {
        for (path, add) in newer.files {
            let e = self.files.entry(path).or_default();
            e.total_commits += add.total_commits;
            // **`>=`, where one walk's own crediting uses `>`.** Two commits can share a
            // second, and each rule keeps whichever is later in the LOG: inside one walk that
            // is the first sighting, because git runs newest-first; across two walks it is
            // the later walk, because a delta holds only commits descended from the bank's
            // head. Getting this backwards leaves the newer walk reporting the older commit
            // as the last one to touch a file, which `scancache` keys blame on.
            if add.newest_ts >= e.newest_ts {
                e.newest_ts = add.newest_ts;
                e.last_commit = add.last_commit;
                e.last_author = add.last_author;
            }
            if e.oldest_ts == 0 || (add.oldest_ts != 0 && add.oldest_ts < e.oldest_ts) {
                e.oldest_ts = add.oldest_ts;
            }
        }
        for (who, n) in newer.by_author {
            *self.by_author.entry(who).or_default() += n;
        }
        self.authors = rank(&self.by_author);
    }

    /// Recount the moving window from a walk bounded by it, and re-date every age.
    ///
    /// The window is the one thing a stored walk cannot keep: ninety days from WHEN. So it is
    /// counted again from a `--since` walk — bounded by ninety days of activity rather than by
    /// the age of the repo, which is what makes keeping a bank current cost the same on linux
    /// as on anything else.
    fn rewindow(&mut self, window: &History, now: i64) {
        self.now = now;
        for (path, e) in &mut self.files {
            e.recent_commits = window.files.get(path).map(|w| w.total_commits).unwrap_or(0);
        }
    }
}

#[cfg(test)]
mod tests {
    /// `refresh` with nothing watching and nothing stopping it. Every test here walks to the
    /// end, so the interrupted case is the one worth spelling out where it is exercised rather
    /// than unwrapped identically in six places.
    fn refreshed(repo: &std::path::Path, banked: Option<super::Bank>) -> super::Bank {
        super::refresh(repo, banked, &super::NEVER, &|_| {})
            .expect("a walk nobody stopped banks a result")
            .0
    }

    use super::*;

    /// A repo with `n` commits, each touching one of two files.
    fn repo(n: usize) -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        for i in 0..n {
            let name = if i % 2 == 0 { "src/a.rs" } else { "src/b.rs" };
            std::fs::create_dir_all(dir.path().join("src")).expect("mkdir");
            std::fs::write(dir.path().join(name), format!("fn f() {{ {i} }}\n")).expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }
        dir
    }

    /// Everything a refreshed walk has to agree with a whole one about.
    fn shape(h: &History) -> Vec<(String, u32, u32, i64, i64, String)> {
        let mut rows: Vec<(String, u32, u32, i64, i64, String)> = h
            .files
            .iter()
            .map(|(p, f)| {
                (
                    p.clone(),
                    f.total_commits,
                    f.recent_commits,
                    f.oldest_ts,
                    f.newest_ts,
                    f.last_commit.clone(),
                )
            })
            .collect();
        rows.sort();
        rows
    }

    /// **The claim banking rests on.** A stored walk brought up to date has to be the walk
    /// you would have taken from scratch — otherwise the cheap path is a second instrument,
    /// and the map's second axis quietly depends on when you last opened the app.
    ///
    /// This is the same property `history.rs` pins for timelines, one module over, and it
    /// fails in the same way if `credit` ever goes back to trusting the walk's newest-first
    /// order: a delta folds NEW commits into a record that already holds older ones.
    #[test]
    fn a_refreshed_walk_matches_a_whole_one() {
        let dir = repo(4);
        let banked = refreshed(dir.path(), None);
        assert!(!banked.head.is_empty(), "a repo with commits has a head");

        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        for i in 4..7 {
            std::fs::write(dir.path().join("src/a.rs"), format!("fn f() {{ {i} }}\n")).unwrap();
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }

        let extended = refreshed(dir.path(), Some(banked));
        let whole = refreshed(dir.path(), None);
        assert_eq!(shape(&extended.history), shape(&whole.history));
        assert_eq!(extended.history.authors(), whole.history.authors());
        assert_eq!(extended.head, whole.head);
        assert_eq!(
            extended.history.total_commits_of("src/a.rs"),
            Some(5),
            "two from the first four commits and three since"
        );
    }

    /// **A relaunch over an unchanged repo walks nothing at all.**
    ///
    /// This is the whole of what an open used to spend on a large project: the churn window is
    /// a rate over ninety days, so it slides with the clock, and the walk that re-derives it
    /// ran unconditionally — 2.1s over 5,599 commits on kibana, 12.4s over 28,593 on nixpkgs,
    /// every launch, plus serializing the result back over the 136MB it was read from. With
    /// HEAD unchanged no commit has come IN; all that moves is a few ageing out, and six hours
    /// of that is under a percent (see `WINDOW_DRIFT`).
    ///
    /// Asserted by the tick never firing rather than by a stopwatch: a walk that reports no
    /// commits is a walk that did not happen, and a timing assertion on a build machine is a
    /// flake waiting to be written.
    #[test]
    fn an_unchanged_repo_is_not_walked_again() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let dir = repo(4);
        let first = refreshed(dir.path(), None);
        assert!(first.taken_at.is_some(), "a fresh walk stamps when it was taken");

        let ticks = AtomicUsize::new(0);
        let (again, changed) = super::refresh(dir.path(), Some(first), &super::NEVER, &|_| {
            ticks.fetch_add(1, Ordering::Relaxed);
        })
        .expect("an unchanged repo still has a bank");
        assert_eq!(ticks.load(Ordering::Relaxed), 0, "no git ran");
        assert!(!changed, "and the caller is told not to rewrite 136MB of identical JSON");
        assert!(again.history.total_commits_of("src/a.rs").is_some(), "the history is intact");

        // A bank from before the stamp existed reads as unknown and is walked, which is the
        // conservative direction and exactly what every launch already did.
        let stale = super::Bank { taken_at: None, ..again };
        let walked = AtomicUsize::new(0);
        let (_, changed) = super::refresh(dir.path(), Some(stale), &super::NEVER, &|_| {
            walked.fetch_add(1, Ordering::Relaxed);
        })
        .expect("it walks");
        assert!(walked.load(Ordering::Relaxed) > 0, "an unstamped bank is walked again");
        assert!(changed);
    }

    /// A new commit is walked, stamp or no stamp — the shortcut is about the window sliding,
    /// never about the repo standing still.
    #[test]
    fn a_new_commit_still_refreshes_a_stamped_bank() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let dir = repo(3);
        let banked = refreshed(dir.path(), None);
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        std::fs::write(dir.path().join("src/a.rs"), "fn f() { 99 }\n").unwrap();
        git(&["add", "-A"]);
        git(&["commit", "-q", "-m", "after the bank"]);

        let ticks = AtomicUsize::new(0);
        let (bank, changed) = super::refresh(dir.path(), Some(banked), &super::NEVER, &|_| {
            ticks.fetch_add(1, Ordering::Relaxed);
        })
        .expect("it walks");
        assert!(changed, "HEAD moved, so the bank is out of date whatever its stamp says");
        assert!(ticks.load(Ordering::Relaxed) > 0);
        assert_eq!(bank.head, super::head_of(dir.path()));
    }

    /// A stopped walk banks nothing, and that is not fussiness about an edge case.
    ///
    /// A partial `git log` folds into a perfectly well-formed `History` that is simply missing
    /// the older half of the repo — every file younger than it is, some of them apparently
    /// untracked. Banked, it is indistinguishable from a complete walk and would be served as
    /// the truth until somebody rewrote history. `Walked::Stopped` exists so that case cannot
    /// be unwrapped by accident.
    #[test]
    fn a_stopped_walk_is_never_banked() {
        let dir = repo(4);
        let stop = std::sync::atomic::AtomicBool::new(true);
        assert!(
            super::refresh(dir.path(), None, &stop, &|_| {}).is_none(),
            "a walk that was stopped has no bankable answer"
        );
        // And nothing was written, so the next open still walks rather than reading a half repo.
        assert!(
            refreshed(dir.path(), None).history.total_commits_of("src/a.rs").is_some(),
            "the repo is still walkable afterwards"
        );
    }

    /// The gauge counts commits, and it counts them across every walk one refresh makes.
    ///
    /// **`refresh` walks up to three times** — a delta or the whole log, then the churn window —
    /// and the estimate the first chamber divides by prices all of them together. A tick that
    /// restarted at zero for each walk would send the chamber backwards partway through, which
    /// is the one thing a progress gauge may never do. That is what `onward` is for, and this
    /// is what fails without it.
    #[test]
    fn the_gauge_only_ever_counts_upward() {
        let dir = repo(4);
        let banked = refreshed(dir.path(), None);
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        for i in 4..7 {
            std::fs::write(dir.path().join("src/a.rs"), format!("fn f() {{ {i} }}\n")).unwrap();
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }

        let ticks = std::sync::Mutex::new(Vec::new());
        let (bank, _) = super::refresh(dir.path(), Some(banked), &super::NEVER, &|n| {
            ticks.lock().unwrap().push(n)
        })
        .expect("an uninterrupted walk banks a result");

        let ticks = ticks.into_inner().unwrap();
        assert!(!ticks.is_empty(), "a walk with commits in it reports at least once");
        assert!(
            ticks.windows(2).all(|w| w[1] >= w[0]),
            "a gauge never goes backwards: {ticks:?}"
        );
        // **The sum, and asserting it is the whole point of this test.** Monotonicity alone
        // does not catch a tick that restarts per walk, and the first version of this test
        // passed without the fix for exactly that reason: these walks are small enough to
        // deliver their entire log in one read, so a per-walk count reports once each — 3, then
        // 7 — which is increasing and wrong. What says the counts were CARRIED is the total.
        assert_eq!(
            ticks.iter().copied().max().unwrap_or(0),
            3 + bank.window_commits as usize,
            "the delta's commits and the window's are one running count, not two: {ticks:?}"
        );
    }

    /// A rewritten history is replayed, never appended to — the stored commits are not the
    /// commits in front of us, and folding one into the other produces a history that never
    /// happened.
    #[test]
    fn a_rewritten_history_is_walked_again_rather_than_extended() {
        let dir = repo(3);
        let banked = refreshed(dir.path(), None);
        let before = banked.head.clone();
        Command::new("git")
            .arg("-C")
            .arg(dir.path())
            .args(["commit", "-q", "--amend", "-m", "rewritten"])
            .output()
            .expect("git runs");

        let after = refreshed(dir.path(), Some(banked));
        assert_ne!(after.head, before, "the fixture has to actually rewrite something");
        assert_eq!(shape(&after.history), shape(&refreshed(dir.path(), None).history));
    }

    /// A directory changes when its files change — and a commit touching several files
    /// in the same directory is ONE commit for it. Summing the per-file counts, which is
    /// all the tree can do on its own, would say three here.
    #[test]
    fn a_commit_touching_three_files_counts_once_for_their_directory() {
        let now = 1_000 * DAY;
        let log = format!("\u{1}{}\u{2}Ada\nsrc/a.rs\nsrc/b.rs\nsrc/c.rs\n", now - 2 * DAY);
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

    /// A total is not a longer window, and an untracked path is not a quiet one.
    ///
    /// Both halves of this went wrong at once while the walk was capped: the count a header
    /// prints was the newest 5,000 commits' worth with nothing saying so, and a file older
    /// than that reported the same absence as a file git has never seen.
    #[test]
    fn a_total_counts_every_commit_and_an_unseen_path_has_none() {
        let now = 1_000 * DAY;
        let log = format!(
            "\u{1}{}\u{2}Ada\nsrc/a.rs\n\u{1}{}\u{2}Ada\nsrc/a.rs\n\u{1}{}\u{2}Grace\nsrc/a.rs\nsrc/b.rs\n",
            now - DAY,
            now - 300 * DAY,
            now - 900 * DAY,
        );
        let h = parse_log(&log, now);
        // One commit in the window, three in the history — the window cannot say the second
        // number and the total cannot say the first.
        assert_eq!(h.commits_of("src/a.rs"), 1);
        assert_eq!(h.total_commits_of("src/a.rs"), Some(3));
        // A directory counts a commit once however many of its files it touched.
        assert_eq!(h.total_commits_of("src"), Some(3));
        // Nothing in the window at all, and still a history.
        assert_eq!(h.commits_of("src/b.rs"), 0);
        assert_eq!(h.total_commits_of("src/b.rs"), Some(1));
        // The one path git has never heard of, which is a different answer from zero.
        assert_eq!(h.total_commits_of("src/never.rs"), None);
        // The root is a directory as much as `src` is, and it is the one the ancestor walk
        // cannot reach — every commit counts for it exactly once.
        assert_eq!(h.total_commits_of(""), Some(3));
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
