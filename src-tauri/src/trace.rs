//! Everything that reads git, and the fold that lands it on a map that was drawn without it.
//!
//! # Why this is not part of a scan
//!
//! It was, and on a large repo it was nearly all of it. Measured on ceph (6,142 parsed files,
//! 163,916 commits), a cold scan took 214s: **206s of that was `git blame`**, 4.4s was the
//! log walk, and the tree-sitter parse everybody assumes is the expensive half was **1.97s**.
//! Kibana is 121,447 files — twenty times ceph's — and that is where an open stopped being
//! something a person waits for.
//!
//! None of that work is needed to draw the map. A wedge's WIDTH is lines and its COLOUR is
//! surprise, and neither reads git. What git buys is the second axis — age and churn, the
//! thing that tells brilliance from mess — and that axis can arrive after the picture.
//!
//! # Three depths, an order of magnitude apart
//!
//! | depth | what it buys | ceph | linux | kibana |
//! |---|---|---|---|---|
//! | 1 · the log walk ([`crate::churn`]) | age, churn, commits and authors per FILE | 6.5s | 56s | 17.5s |
//! | 2 · per-line blame ([`crate::blame`]) | the same four facts per FUNCTION | 206s | — | — |
//! | 3 · the replay ([`crate::history`]) | the timeline | minutes | — | — |
//!
//! Each is roughly ten times the one before, which is what makes one budget able to choose a
//! depth rather than merely refusing a repo. Depths 2 and 3 on linux and kibana are deliberately
//! unmeasured here: the only honest way to learn a per-file blame rate is to run a pass and bank
//! it — sampling thirty files gave 2ms against ceph's measured 34ms, an order of magnitude out,
//! because file size and history depth vary far more within a repo than between thirty samples.
//!
//! # Depth 2 is RESOLUTION, not the axis
//!
//! `score_dir` has always said so, in the line this module is built around: a function takes its
//! own history where blame could read it and **its file's otherwise**, because an untracked file
//! or a range blame no longer covers "should cost resolution, not the axis". Depth 1 alone
//! therefore gives every function in a file its file's numbers — blocky rings under Age and
//! Churn, and honestly so. That is a third state beside "this repo has no git history" and
//! "traced", and nothing may present it as either.
//!
//! # Applying is a second fold, on the pattern readings already follow
//!
//! `applyAgentReports` lands readings on an already-folded tree and keeps the proxy underneath so
//! the upgrade is reversible. [`apply`] does the same for git: it walks a finished tree, fills the
//! git-derived fields from whatever depth is in hand, re-aggregates the containers and re-credits
//! their commit counts. It is idempotent and it is the ONE definition — the scan folds through it
//! too, so an inline trace and a deferred one cannot produce two different maps.

use crate::blame::{Blame, FileBlame};
use crate::churn::History;
use crate::model::{Node, NodeKind};
use crate::scan::Scan;

/// How deep a trace goes — see the module note for what each depth costs.
///
/// **A depth is a reading CONDITION and travels with the map, never a preference.** A tree
/// traced to `Files` says every function in a file has its file's numbers; one traced to
/// `Lines` says they are the function's own. Presenting either as the other is the map
/// claiming a resolution nobody paid for.
/// **Ordered, because the rungs nest.** `Lines` is everything `Files` has and more, so
/// "traced at least this deep" is the question callers actually ask — and asking it as a
/// chain of `matches!` is the same ladder written out again somewhere else, which is where a
/// rung gets forgotten.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Depth {
    /// No git at all. Age, churn, commits and authors are absent — which is NOT the same
    /// claim as a repo with no history, and nothing may render it as one.
    #[default]
    Untraced,
    /// The log walk: every file's age, churn, commit count and last author.
    Files,
    /// Per-line blame as well, so the same four facts resolve to the function.
    Lines,
    /// The timeline as well: how many times each function has actually CHANGED.
    ///
    /// **Not a finer answer to the same question — a different question, and the only rung
    /// here that is.** `Files` and `Lines` are two resolutions of one set of facts: a file's
    /// age is its functions' ages read coarsely. This rung adds a quantity neither of the
    /// others holds at any resolution, because neither instrument can see it. Blame keeps one
    /// commit per LINE, so a body whose same ten lines were rewritten forty times reports the
    /// handful that survived; the timeline diffs functions by body hash at every commit and
    /// counts all forty. See `edits.rs`, which measures the gap, and `docs/notes/time.md`.
    ///
    /// It is the deepest rung because it is the most expensive: 16s on godot and 32s on
    /// ladybird for a hundred and eighty days, against a log walk of well under a second.
    Edits,
}

impl Depth {
    /// The depth's name, as the index banks it and the window reads it.
    pub fn tag_str(self) -> &'static str {
        match self {
            Depth::Untraced => "untraced",
            Depth::Files => "files",
            Depth::Lines => "lines",
            Depth::Edits => "edits",
        }
    }

    /// The ladder as a number, so two depths can be compared without a match on every pair.
    ///
    /// **`Depth` deliberately derives no `Ord`.** The variants happen to be declared in
    /// ladder order and an `Ord` would make that ordering a promise of the DECLARATION rather
    /// than of the ladder — a reordered enum would silently reorder the rungs. This is the
    /// claim, written down once, next to the other things the ladder knows about itself.
    pub fn rank(self) -> u8 {
        match self {
            Depth::Untraced => 0,
            Depth::Files => 1,
            Depth::Lines => 2,
            Depth::Edits => 3,
        }
    }

    /// The depth a banked tag names — see [`Self::tag_str`], which writes them.
    ///
    /// `Untraced` for anything this build does not recognise, which is the safe direction: an
    /// unknown tag is priced as work nobody has paid for, so the worst it costs is being asked
    /// again. Reading it as something deeper would draw a resolution nobody bought.
    pub fn from_tag(tag: &str) -> Depth {
        match tag {
            "files" => Depth::Files,
            "lines" => Depth::Lines,
            "edits" => Depth::Edits,
            _ => Depth::Untraced,
        }
    }

    /// Does a trace to this depth run the per-line blame pass?
    ///
    /// **The ladder is CUMULATIVE, and asking `== Depth::Lines` is how that gets forgotten.**
    /// Every rung includes the ones below it: `Edits` is a repo blamed AND counted, not a repo
    /// counted instead of blamed. Both gates were an equality against `Lines` and adding a
    /// fourth rung silently turned the blame pass off — the trace ran, `resolved` stayed at
    /// zero, and the row went on offering "304 files to blame" however many times it was
    /// pressed. It is asked here so a fifth rung cannot repeat it.
    pub fn blames(self) -> bool {
        matches!(self, Depth::Lines | Depth::Edits)
    }

    /// Does it walk the timeline for how often each function has changed? See `edits.rs`.
    pub fn counts_edits(self) -> bool {
        matches!(self, Depth::Edits)
    }

    /// What a cache has to key on to tell two depths apart — see `treecache::signature`.
    pub fn tag(self) -> &'static [u8] {
        match self {
            Depth::Untraced => b"untraced",
            Depth::Files => b"files",
            Depth::Lines => b"lines",
            Depth::Edits => b"edits",
        }
    }
}

/// What a trace may cost before somebody has to be asked.
///
/// **Ten seconds, and it is a budget on the WORK rather than a verdict on the repo.** The same
/// rule gives three different answers to the three repos it was tuned against: sanity's log
/// walk is 0.02s and runs unasked forever; ceph's is 6.5s and runs unasked; linux's is 56s and
/// asks once, after which keeping it current is the commits since. There is deliberately no
/// clause anywhere about a repo being big, or about this being the first time — those are
/// outputs of the estimate, and writing either one down as a rule would be a size test wearing
/// a hat.
pub const BUDGET: std::time::Duration = std::time::Duration::from_secs(10);

/// A default rate for a repo this machine has never walked — see [`crate::churn::Bank::rate`]
/// for why a real one is measured per repo. Ten objects to the commit and forty microseconds
/// to the commit, both from the measured corpus.
const COLD_RATE: f32 = 0.000_040;
const OBJECTS_PER_COMMIT: f32 = 10.0;

/// What the next trace of this repo would cost, and how much of that is known.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Estimate {
    /// Seconds, for the depth named. An estimate, never a measurement — and on a repo with no
    /// bank it is a bound derived from object count rather than anything about commits.
    pub seconds: f32,
    /// Commits the walk would cover, where that is known without paying for a walk to find out.
    pub commits: Option<u32>,
    /// Nothing has walked this repo on this machine, so `seconds` is the free bound and not a
    /// rate anybody measured here. Said out loud because a number whose provenance is a guess
    /// must not be printed as though somebody had timed it.
    pub cold: bool,
    /// Whether it fits [`BUDGET`].
    pub fits: bool,
}

/// What to do about `repo`'s history without being asked.
#[derive(Debug, Clone)]
pub enum Go {
    /// Trace it, to this depth. Nobody is interrupted.
    Run(Depth),
    /// Over budget. The estimate is what a person is shown so they can decide.
    Ask(Estimate),
}

/// Price depth 1 for `repo`, cheaply enough to do it on every open.
///
/// Two tiers, because a repo that has been walked here knows its own rate and one that has not
/// cannot be asked without paying most of what the walk costs:
///
/// - **Banked** — commits since the stored head plus the churn window's own count, times this
///   repo's measured seconds-per-commit. `rev-list --count <banked>..HEAD` is bounded by what
///   has been committed since somebody last looked.
/// - **Never walked** — `git count-objects -v`, which is free, over the corpus ratio. Stated as
///   cold, so nothing renders it as a measurement.
pub fn estimate(repo: &std::path::Path) -> Estimate {
    let bank = load_bank(repo);
    let (seconds, commits, cold) = match &bank {
        Some(b) if !b.head.is_empty() => {
            let commits = crate::churn::commits_since(repo, &b.head) + b.window_commits;
            (commits as f32 * b.rate.unwrap_or(COLD_RATE), Some(commits), false)
        }
        _ => {
            let commits = crate::churn::packed_objects(repo) as f32 / OBJECTS_PER_COMMIT;
            (commits * COLD_RATE, None, true)
        }
    };
    Estimate { seconds, commits, cold, fits: seconds <= BUDGET.as_secs_f32() }
}

/// Milliseconds per file for a cold `git blame`, measured on ceph — 206s across 6,142 files.
///
/// A corpus figure rather than a per-repo one, unlike everything else priced here, and it can
/// afford to be: it is only ever used to answer "is the blame I need already cached", where
/// the count is usually zero or nearly all of them and the rate barely matters.
const BLAME_MS_PER_FILE: f32 = 34.0;

/// Can this repo be put back to per-line resolution without a wait?
///
/// **The question a restart has to ask.** A per-line trace is nobody's automatic — its cost is
/// per file and cannot be predicted — but a repo somebody has already traced to the line should
/// not have to be traced again when the app reopens, and it usually costs nothing: blame is
/// cached per file, keyed on content and last-touching commit, so an unchanged repo already
/// holds every answer. What this prices is the REMAINDER — the files whose blame the cache
/// cannot serve, because they changed, or because the cache was dropped.
///
/// So a normal restart restores the depth instantly, an edited file or two costs a blame apiece,
/// and a dropped cache asks rather than spending minutes at launch on work nobody re-requested.
pub fn relines(scan: &Scan, scans: &crate::scancache::ScanCache, history: &History) -> bool {
    blame_seconds(scan, scans, history) <= BUDGET.as_secs_f32()
}

/// What the blame the cache cannot serve would cost, in seconds — see [`relines`].
fn blame_seconds(scan: &Scan, scans: &crate::scancache::ScanCache, history: &History) -> f32 {
    let mut missing = 0usize;
    scan.root.visit(&mut |n| {
        if n.kind != NodeKind::File {
            return;
        }
        let hash = scans.hash_of(&n.path).unwrap_or(0);
        if !scans.has_blame(&n.path, hash, history.last_commit_of(&n.path)) {
            missing += 1;
        }
    });
    missing as f32 * BLAME_MS_PER_FILE / 1000.0
}

/// The deepest rung a headless verb reads without being told a depth.
///
/// **The CLI's default, and it is the whole ladder unless the work says otherwise.** A person
/// typing `sanity findings` wants every rule answering; a rung that stays dark on a repo where
/// it would cost nothing is a header full of `trace required` on history that is sitting in
/// the cache. So each rung is priced on what is LEFT — the log walk by [`estimate`], blame by
/// the files the cache cannot serve, the timeline by `edits::estimate` — against the same
/// [`BUDGET`] the launch gate spends, and the ladder stops at the first rung over it.
///
/// **Not the launch rule.** `trace_within_budget` never takes a deeper rung nobody had bought
/// before; this does, because a verb somebody typed is an ask and a launch is not. What they
/// did not ask for is minutes, and that is what the budget still refuses.
///
/// The second half is the rung that was declined and what it would have cost, so the verb can
/// say which flag buys it. It walks the log to price blame, which the deepening that follows
/// reads back from the bank rather than walking again.
pub fn affordable(
    repo: &std::path::Path,
    scan: &Scan,
    scans: &crate::scancache::ScanCache,
) -> (Depth, Option<(Depth, f32)>) {
    let log = estimate(repo);
    if !log.fits {
        return (Depth::Untraced, Some((Depth::Files, log.seconds)));
    }
    let stop = std::sync::atomic::AtomicBool::new(false);
    let Some(history) = depth1(repo, &stop, &|_| {}) else {
        return (Depth::Untraced, None);
    };
    let blame = blame_seconds(scan, scans, &history);
    if blame > BUDGET.as_secs_f32() {
        return (Depth::Files, Some((Depth::Lines, blame)));
    }
    let (edits, _, _) = crate::edits::estimate(repo);
    if edits > BUDGET.as_secs_f32() {
        return (Depth::Lines, Some((Depth::Edits, edits)));
    }
    (Depth::Edits, None)
}

/// Whether this repo's history may be read without asking, and how deep.
///
/// Depth 2 is never taken on its own account here. It is per-file work on a scale depth 1
/// cannot predict — the only honest way to know a repo's blame rate is to run a pass and bank
/// it, and thirty sampled files were an order of magnitude out — so it is an explicit ask
/// until this repo has a measured rate to be estimated against.
pub fn go(repo: &std::path::Path) -> Go {
    let e = estimate(repo);
    if e.fits { Go::Run(Depth::Files) } else { Go::Ask(e) }
}

/// The shape of a banked walk. Bumped when [`crate::churn::Bank`] changes, because a record
/// this build cannot read is a full walk of linux nobody asked for.
///
/// **2 is bincode; 1 was JSON.** The encoding is part of the shape, so changing it moves this —
/// and the version is in the slot NAME, so an old bank is never read as a new one, it is simply
/// not looked at, and `prune_slots` sweeps it on the usual month.
///
/// A bump is not free and the cost belongs written down beside the number: a repo whose bank
/// this build refuses is walked whole, **90 seconds over 690,536 commits on nixpkgs**, once. An
/// adoption path was written to avoid that and then removed. It read the old file with the old
/// serializer into the same `Bank` and was genuinely safe — but it is a second reader that has
/// to be kept correct forever to save one launch, and the rule the rest of this app's caches
/// follow is to refuse what they cannot read and recompute. Bump deliberately; the next one
/// costs the same.
const BANK_FORMAT: u32 = 2;

/// bincode rather than JSON, for the reason `treecache` gives: this file is megabytes of
/// numbers and nobody reads it by hand.
///
/// nixpkgs banks **142MB** of JSON holding 544,020 path entries. Measured on exactly that file,
/// per refresh:
///
/// |  | JSON | bincode |
/// |---|---|---|
/// | on disk | 142.3 MB | **84.0 MB** |
/// | decode, release | 0.23s | **0.19s** |
/// | encode, release | 0.20s | **0.06s** |
/// | decode, debug | 2.43s | **1.27s** |
/// | encode, debug | 3.66s | **0.36s** |
///
/// **Worth being straight about the size of this win, because it was predicted much larger.**
/// The estimate that justified reaching for it put the JSON parse at 1.5–2.0s; that number came
/// from Python's `json` standing in for `serde_json`, which is a poor proxy — serde does it in
/// 0.23s. What actually cost an open fifteen seconds was the churn-window walk, and that is
/// fixed in `churn::WINDOW_DRIFT` rather than here. This is a real but modest saving in a
/// release build, a substantial one in the debug build a developer runs all day, and 58MB of
/// disk per large repo.
///
/// It is a cache regenerated by deleting it, so the cost of no longer being `jq`-able is not
/// much of one; the caches a person DOES read — `.sanity/`, the endpoint file — stay text.
fn bank_config() -> bincode::config::Configuration {
    bincode::config::standard()
}

fn bank_path(repo: &std::path::Path) -> Option<std::path::PathBuf> {
    crate::reports::cache_slot("traces", repo, &format!("f{BANK_FORMAT}"))
        .map(|p| p.with_extension("bin"))
}


/// The log walk — depth 1. Every file's age, churn, commit count and last author.
///
/// **Banked, so this costs what has happened since rather than what has ever happened.** A
/// whole walk is 6.5s on ceph (163,916 commits), 17.5s on kibana (109,525) and 56s on linux
/// (1,479,915) — cost is commits × paths-touched, which is why kibana is over a ten-second
/// budget with fewer commits than ceph. Refreshing one is the commits since somebody last
/// looked, plus a walk bounded by the churn window.
///
/// Machine-local, like the timeline cache and unlike `.sanity/`: every byte of it comes back
/// out of the object database, it changes on every commit, and in-repo it would be a
/// conflicting blob on every branch. A failed read costs a walk; a failed write costs the
/// next one. Neither is reported, for the same reason.
///
/// `None` means somebody stopped it. That is NOT a short history and is never banked as one —
/// see `churn::Walked`. `tick` reports commits folded so far, against the count
/// [`estimate`] priced, which is what fills the first chamber of the trace gauge.
pub fn depth1(
    repo: &std::path::Path,
    stop: &std::sync::atomic::AtomicBool,
    tick: &dyn Fn(usize),
) -> Option<History> {
    let (bank, changed) = crate::churn::refresh(repo, load_bank(repo), stop, tick)?;
    // **Written only when the walk produced something new.** This used to run on every open,
    // and on nixpkgs it is 136MB of JSON serialized over the top of the byte-identical 136MB it
    // was just read from — several seconds of an app launch spent writing down an answer that
    // had not changed. `refresh` is the only thing that can know, so it is the thing that says.
    if changed {
        if let Some(p) = &bank_path(repo) {
            crate::reports::prune_slots("traces", repo, &format!("f{BANK_FORMAT}"));
            if let Ok(bytes) = bincode::serde::encode_to_vec(&bank, bank_config()) {
                let tmp = p.with_extension("tmp");
                if std::fs::write(&tmp, bytes).is_ok() {
                    let _ = std::fs::rename(&tmp, p);
                }
            }
        }
    }
    Some(bank.history)
}

fn load_bank(repo: &std::path::Path) -> Option<crate::churn::Bank> {
    if let Some(path) = bank_path(repo) {
        if let Ok(bytes) = std::fs::read(&path) {
            crate::reports::mark_used(&path);
            if let Ok((bank, _)) =
                bincode::serde::decode_from_slice::<crate::churn::Bank, _>(&bytes, bank_config())
            {
                return Some(bank);
            }
        }
    }
    // **Nothing else is tried, and an unreadable slot is a walk.** A bank in the previous
    // format is not adopted, transcoded or read for parts: this is a machine-local cache whose
    // every byte comes back out of the object database, so the rule it follows is the one every
    // other cache here follows — refuse what this build cannot read, and recompute.
    //
    // It is not free. A repo with no usable bank is walked whole, which on nixpkgs is **90
    // seconds and 690,536 commits**, paid once on the launch after a version bump. That is the
    // price of the bump and it belongs in the bump, rather than in a second reader kept alive
    // to avoid it — one that would have to be understood, and correctly refused, by everyone
    // who touches this file afterwards.
    None
}

/// Per-line blame — depth 2 — for the files a finished scan holds.
///
/// The hashes come from the scan cache rather than from the tree, because that is where they
/// already are: blame is keyed on `(content, last commit)` and the parse computed the content
/// hash a moment ago. A file the cache has never heard of blames uncached, which is correct
/// and merely slower.
/// How many times a blame pass lands on the live tree before it is finished.
///
/// **A count and not an interval, because what a publish costs scales with the repo.** Every
/// one of them replaces the project's tree, which bumps `scanned`, which clears the window's
/// function rings and refetches them — on kibana a 148,000-function tree. Ten of those over a
/// pass is the map filling in as the work happens; one every few seconds is a repo that spends
/// its afternoon re-sending itself.
const PUBLISH_STEPS: usize = 10;

/// The fewest files worth publishing between. Below this the pass is short enough that
/// splitting it buys nothing — a 90-file repo blames in three seconds — and the chunking would
/// only cost it ten full re-applies. Matches `scancache`'s own flush cadence, which is the same
/// judgement about the same kind of work.
const PUBLISH_FLOOR: usize = 400;

/// Every file the blame pass will visit, in the order it will visit them.
fn blamable(scan: &Scan, scans: &crate::scancache::ScanCache) -> Vec<(String, u64)> {
    let mut files: Vec<(String, u64)> = Vec::new();
    scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            files.push((n.path.clone(), scans.hash_of(&n.path).unwrap_or(0)));
        }
    });
    files
}

pub fn depth2(
    repo: &std::path::Path,
    scan: &Scan,
    history: &History,
    scans: &crate::scancache::ScanCache,
    stop: &std::sync::atomic::AtomicBool,
    on_file: &(dyn Fn(&str, usize, usize) + Sync),
) -> Blame {
    let files = blamable(scan, scans);
    let total = files.len();
    let done = std::sync::atomic::AtomicUsize::new(0);
    Blame::read(repo, &files, history, scans, stop, &|path: &str| {
        on_file(path, done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1, total);
    })
}

/// Trace `repo` to `depth` and land it on a map that was drawn without one.
///
/// The deferred half of the split: a scan runs `Depth::Untraced` and puts the picture up, and
/// this arrives behind it with whatever the budget allowed. Deepening from `Files` to `Lines`
/// is the same call again — [`apply`] is idempotent precisely so that works.
pub fn deepen(
    repo: &std::path::Path,
    scan: &mut Scan,
    depth: Depth,
    scans: &crate::scancache::ScanCache,
    stop: &std::sync::atomic::AtomicBool,
    on_progress: &(dyn Fn(crate::scan::Progress) + Sync),
    on_publish: &(dyn Fn(&Scan) + Sync),
) -> (Depth, usize, usize) {
    if depth == Depth::Untraced {
        return (Depth::Untraced, 0, 0);
    }
    // What the first chamber divides by. The same arithmetic the row was shown before it
    // pressed — a walk that reported against its own final count would fill smoothly and mean
    // nothing, because the total would not be known until there was nothing left to say.
    // Zero where the estimate could not price it; a chamber with no denominator reports the
    // phase and no fraction, which is what `Progress` already does with `0 / 0`.
    let expect = estimate(repo).commits.unwrap_or(0) as usize;
    // **The log walk is one `git log` and is not interruptible; the blame pass is thousands of
    // processes and is.** So a stop pressed during depth 1 takes effect when it ends — which is
    // bounded, and measured at 56s on the largest repo tried — and a stop during depth 2 takes
    // effect within a file. Saying that here rather than pretending both are the same.
    let Some(history) = depth1(repo, stop, &|seen| {
        on_progress(
            crate::scan::Progress::counting("reading the commit log", "commits", seen, expect)
                .step(1),
        )
    }) else {
        // Stopped inside the log walk, which is a thing that can happen now. Nothing is
        // applied and nothing is banked: a partial log is a map where half the repo looks
        // untracked, and the honest report is the depth this repo already had.
        return (Depth::Untraced, 0, 0);
    };
    // **The blame pass lands on the live tree as it goes, in chunks.** It used to be one
    // `Blame::read` over every file, applied once at the end — so for the whole of a
    // thirty-three-minute pass on kibana the map went on showing DEPTH 1: every function
    // wearing its file's author, each file a single flat colour, while the pill counted
    // truthfully up to `21k / 59k`. All the per-function colour then arrived in one step at the
    // end. The work was real and none of it was anywhere a person could see it.
    //
    // Chunking is safe because blame is per file and independent: a chunk is a whole answer for
    // the files it covers, `absorb` is a union rather than a merge of two opinions, and `apply`
    // is idempotent by construction — the files not yet reached simply keep falling back to
    // their file's numbers, which is exactly what depth 1 already means.
    let blame = if depth.blames() && !stop.load(std::sync::atomic::Ordering::Relaxed) {
        let files = blamable(scan, scans);
        let total = files.len();
        let step = (total / PUBLISH_STEPS).max(PUBLISH_FLOOR);
        let done = std::sync::atomic::AtomicUsize::new(0);
        let mut acc = Blame::default();
        for chunk in files.chunks(step) {
            if stop.load(std::sync::atomic::Ordering::Relaxed) {
                break;
            }
            let part = Blame::read(repo, chunk, &history, scans, stop, &|path: &str| {
                on_progress(
                    crate::scan::Progress::counting(
                        "reading per-line history",
                        "files",
                        done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1,
                        total,
                    )
                    .on(path)
                    .step(2),
                )
            });
            acc.absorb(part);
            // Landed and handed over before the next chunk starts. The final `apply` below
            // still runs — it is idempotent, and it is what covers the un-chunked paths.
            apply(scan, &history, &acc, None);
            on_publish(scan);
        }
        // **Flushed here, or a small repo blames itself again every launch.** `put_blame`
        // writes into the store and only reaches disk through `touched`, which appends once
        // `FLUSH_EVERY` keys have piled up — and the one unconditional `save` in this app is
        // at the end of a SCAN. A trace is not a scan, so a repo with fewer than four hundred
        // files finished its blame pass, published it to the map, and dropped every line of it
        // on quit.
        //
        // It was invisible because `relines` prices the remainder against a ten-second budget
        // and then restores anyway: under about 290 files the re-blame fits, so the repo comes
        // back looking traced and quietly pays for it again. Past that it does not, and the row
        // offers `N files to blame` forever — measured here at 304 files for one repo and 355
        // for another, both just over the line, while a 1,234-file repo kept all but its last
        // partial batch and looked perfectly healthy.
        //
        // Unconditional rather than gated on the stop flag: a pass that was interrupted has
        // blamed real files, and their answers are as good as a finished pass's.
        scans.save();
        acc
    } else {
        Blame::default()
    };
    // **The third phase, and the only one that adds a quantity rather than a resolution.**
    // Depth 1 and depth 2 are one set of facts read coarsely and then finely; this walks the
    // timeline to find out how many times each function has actually CHANGED, which neither of
    // the others holds at any resolution — see `Depth::Edits` and `edits.rs`.
    //
    // Last, because it is the most expensive: 16s on godot and 32s on ladybird for a hundred
    // and eighty days. Its own step on the bar for the reason the blame pass has one — a phase
    // boundary the viewer can see is worth a bar that restarts, and a walk this long appearing
    // as a stall in the previous phase is the lie that naming was written to remove.
    let walked = if depth.counts_edits() {
        crate::edits::gather(repo, stop, &|p| {
            on_progress(p.step(3));
        })
    } else {
        None
    };
    let now = crate::churn::now_secs();
    let at = walked.as_ref().map(|e| crate::edits::At {
        edits: e,
        now,
        windows: e.windows,
    });
    // Applied even when it was stopped: what depth 1 read is a whole answer at its own
    // resolution, and a partial blame is every file that WAS read — the rest fall back to
    // their file's numbers, which is the same absence `FileTrace::func` handles everywhere.
    //
    // A STOPPED edits walk is different and is applied as nothing: `gather` returns `None`
    // rather than a partial count, because half a timeline reports a busy repo as a quiet one
    // and there is no per-node absence that says so. The depth it reports is `Lines`, which is
    // what it actually reached.
    apply(scan, &history, &blame, at);
    // What it resolved, out of what it was asked to. Reported rather than rounded, so a stopped
    // pass says where it got to and a resumed one starts from a number somebody can see moving.
    //
    // **A pass that RAN to the end resolved everything, whatever the blame count says.** Files
    // git has never seen blame to nothing, by design — an untracked file costs itself its
    // per-function history and nothing else — so counting successes against files attempted
    // leaves a repo with one untracked file permanently at 99%, offering to finish work that
    // is finished. Only a STOPPED pass reports the count, because only there is the gap real.
    let mut considered = 0;
    scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            considered += 1;
        }
    });
    // **Off `blames()`, not off an equality with `Lines`.** This was the third gate written as
    // `depth == Depth::Lines` and the last one to be found: the blame pass ran perfectly at the
    // new deepest rung and then reported that it had resolved nothing, so the sidebar divided
    // by a numerator of zero and offered `304 files to blame` however many times it was
    // pressed. A dead button, a finished repo, and no error anywhere.
    let resolved = match depth {
        d if d.blames() && !stop.load(std::sync::atomic::Ordering::Relaxed) => considered,
        d if d.blames() => blame.len(),
        _ => 0,
    };
    // **The depth REACHED, which is not always the depth asked for.** Callers used to work this
    // out from a stop flag they read themselves — `if stopped { "files" }` — which was right
    // for the one case it was written for and silently wrong for the new one: a stop inside the
    // log walk reaches nothing at all, and that branch would have banked it as `files`. The
    // pass is the only thing that knows how far it got, so it is the thing that says.
    let stopped = stop.load(std::sync::atomic::Ordering::Relaxed);
    let reached = match depth {
        Depth::Lines if stopped => Depth::Files,
        // **A stopped edits walk reports the depth it actually reached, which is `Lines`.**
        // The blame pass can be stopped and still counts, because what it finished is per file
        // and the rest fall back honestly. A half-walked timeline cannot: a function whose
        // commits the walk had not got to yet is indistinguishable from one nobody has
        // touched, and the map would draw a busy repo as settled with nothing saying why.
        Depth::Edits if walked.is_none() => {
            if stopped {
                Depth::Files
            } else {
                Depth::Lines
            }
        }
        Depth::Edits if stopped => Depth::Lines,
        d => d,
    };
    (reached, resolved, considered)
}

/// The repo's history at every resolution the scan has.
///
/// **One value because they are one subject read three ways, and because they travel
/// together.** The log walk answers per file, blame answers per line, and the timeline answers
/// how often a body has changed; every consumer below this point wants whichever of them can
/// speak to the node in front of it, and passing them separately had `score_dir` at eight
/// arguments with the third one about to be forgotten somewhere.
#[derive(Clone, Copy)]
pub(crate) struct Histories<'a> {
    pub history: &'a History,
    pub blame: &'a Blame,
    /// `None` until the timeline has been walked — see `Depth::Edits`.
    pub edits: Option<crate::edits::At<'a>>,
}

/// One file's history, looked up once and asked about many functions.
///
/// The per-file lookups are five `HashMap` hits and the per-function ones are a slice of the
/// blame, so this exists to keep the ratio that way round: `score_dir` reads a file's numbers
/// once and its functions' numbers one apiece, and [`apply`] has to do the same or a repo the
/// size of kibana pays 121,447 lookups it does not need.
pub(crate) struct FileTrace<'a> {
    path: &'a str,
    age_days: Option<f32>,
    last_touched_days: Option<f32>,
    last_author: Option<String>,
    blame: Option<&'a FileBlame>,
    /// How often each function here has actually changed — see `edits.rs`. `None` until the
    /// timeline has been walked, which is `Depth::Edits`.
    edits: Option<crate::edits::At<'a>>,
    now: i64,
}

/// What one function's history says, at whatever resolution is available.
pub(crate) struct FuncTrace {
    /// One rate per window — see `Score::churn`. All zeroes where the timeline has not been
    /// walked, which is an absence the REPO states once and no node repeats.
    pub churn: [f32; 4],
    pub age_days: Option<f32>,
    pub commits: [u32; 4],
    pub last_touched_days: Option<f32>,
    pub last_author: Option<String>,
    /// Whose lines most of this body is, and how many people's lines are in it — see
    /// [`crate::blame::RangeHistory`], where the three reductions are named.
    ///
    /// **Blame's alone, and `None` without it.** They are counts over a function's OWN lines,
    /// which the commit log cannot answer: it knows who touched a FILE, and a file's headcount
    /// stood in for its functions' would say every function in `App.tsx` was written by the
    /// same four people. A missing count is honest; a borrowed one is not.
    pub main_author: Option<String>,
    pub headcount: Option<u32>,
}

impl<'a> FileTrace<'a> {
    pub(crate) fn of(path: &'a str, h: Histories<'a>) -> FileTrace<'a> {
        let Histories { history, blame, edits } = h;
        FileTrace {
            path,
            age_days: history.age_of(path),
            last_touched_days: history.last_touched_of(path),
            last_author: history.last_author_of(path),
            blame: blame.get(path),
            edits,
            // A blame pass stamps its own clock and every age is measured from it. With no
            // blame there is no stamp, and a zero would date every window to 1970 — so the
            // edits windows fall back to asking the machine, which costs one syscall per file
            // on a depth that has not run the pass this reads from anyway.
            now: if blame.now != 0 { blame.now } else { crate::churn::now_secs() },
        }
    }

    /// Who last touched the file, for the file's own node — the one field a container takes
    /// straight from the log rather than from its children.
    pub(crate) fn last_author(&self) -> Option<String> {
        self.last_author.clone()
    }

    /// How many people have lines standing in this file — see [`FileBlame::headcount`].
    /// `None` without per-line blame, which is the same absence every blame-derived number
    /// states, and never zero: zero is a file nobody wrote.
    pub(crate) fn headcount(&self) -> Option<u32> {
        self.blame.map(FileBlame::headcount)
    }

    /// Whose lines most of this FILE is, for the file's own node — see
    /// [`FileBlame::main_author`], where the difference from a function's is the point.
    ///
    /// The file's own answer under Blame's second reading, beside `last_author` which is its
    /// answer under the first. `None` without per-line blame, and never borrowed downwards:
    /// `func` below still returns `None` for a range blame could not read.
    pub(crate) fn main_author(&self) -> Option<String> {
        self.blame.and_then(FileBlame::main_author)
    }

    /// This function's own history where blame could read it, the file's otherwise — an
    /// untracked file, a repo without git, a range the blame no longer covers, or a repo
    /// traced only to depth 1 should cost RESOLUTION, not the axis.
    pub(crate) fn func(&self, name: &str, ord: usize, start: u32, end: u32) -> FuncTrace {
        // **Churn comes off the timeline where there is one, and the other three never do.**
        // The edits walk is bounded by the churn window, so it cannot say when a function
        // nobody has touched in a year first appeared or who last touched it — those stay
        // blame's, which reads every line's whole provenance. What it CAN say, and what blame
        // cannot say at all, is how many times this body has changed: blame keeps one commit
        // per line, so a body rewritten in place reports the few that survived. See `edits.rs`
        // for the measurement of that gap and `docs/notes/time.md` for why it matters.
        // **Zero where the timeline has not been walked, and zero is not "settled".** Blame's
        // surviving-commit count used to fill this in, which is how one ramp came to paint two
        // quantities: a body rewritten in place reports the handful of commits whose lines
        // happen to survive, which is not a frequency and cannot be compared to one. It is a
        // real reading — how many hands are layered in the code in front of you — and it wants
        // a lens of its own rather than this one's. `docs/notes/time.md` carries the argument.
        //
        // What says "not measured" is `Stats::churned`, once, on the repo, beside the button
        // that fixes it. Repeating it on every node is the thing `CLAUDE.md` forbids.
        let counts = self.edits.map(|e| e.func(self.path, name, ord));
        let churn = match (self.edits, counts) {
            (Some(e), Some(n)) => e.rates(n),
            _ => [0.0; 4],
        };
        let commits = counts.unwrap_or([0; 4]);
        match self.blame.and_then(|b| b.range(start, end, self.now)) {
            Some(h) => FuncTrace {
                churn,
                age_days: Some(h.age_days),
                commits,
                last_touched_days: Some(h.last_touched_days),
                last_author: Some(h.last_author.clone()).filter(|a| !a.is_empty()),
                main_author: Some(h.main_author.clone()).filter(|a| !a.is_empty()),
                headcount: Some(h.headcount).filter(|n| *n > 0),
            },
            None => FuncTrace {
                churn,
                age_days: self.age_days,
                commits,
                last_touched_days: self.last_touched_days,
                last_author: self.last_author.clone(),
                // The file's own last author still stands in for a function blame could not
                // read — one name at a coarser resolution is the same KIND of answer. A
                // headcount is not: see the field.
                main_author: None,
                headcount: None,
            },
        }
    }
}

/// Land a trace on a tree that was folded without one.
///
/// **Idempotent, and it has to be**: a repo traced to depth 1 is traced again to depth 2 over
/// the same tree, and the second landing must not read the first one's output as input. Every
/// field written here is written from `history` and `blame` alone; nothing accumulates.
pub fn apply(
    scan: &mut Scan,
    history: &History,
    blame: &Blame,
    edits: Option<crate::edits::At>,
) {
    apply_to(&mut scan.root, history, blame, edits);
    // `aggregate` rebuilds every container score from its children, which zeroes the commit
    // counts — so crediting the directories has to FOLLOW it, every time, and that is why the
    // two are one call rather than two things a caller has to remember to pair.
    scan.root.aggregate();
    apply_dir_history(&mut scan.root, history, edits);
    // **The repo-level answers go on the SCAN, here, not only in `scan()`.** A deferred trace
    // lands on a tree that was built without git, and everything below this line exists because
    // the fields it fills would otherwise keep whatever the scan wrote — which for a deepen is
    // whatever the shallower pass wrote. `churned` is the newest of them and it was the one
    // that made this visible: the edits walk ran, every node got its counts, and the lens
    // stayed locked because the flag the lock reads had never moved off `false`.
    scan.stats.churned = edits.is_some();
    if let Some(e) = &edits {
        scan.stats.churn_windows = e.windows;
    }
    scan.stats.authors =
        history.authors().iter().take(crate::scan::AUTHOR_SLOTS).cloned().collect();
    scan.stats.headcount = blame.headcount();
    scan.stats.without_history = history.is_empty();
    // **The repo's commit count comes out of the walk that just ran.** It used to be its own
    // `git rev-list --no-merges --count HEAD`, which is 1.14s on ceph and 7.1s on linux for a
    // number this already holds: the root is credited once per commit that touched anything —
    // see `churn::flush_commit`. The one difference is a commit that changed no path at all,
    // which is now not counted, and "commits that changed something" is the more honest
    // reading of a number printed beside what a repo is made of.
    scan.stats.commits = history.total_commits_of("").unwrap_or(0) as usize;
}

fn apply_to(
    node: &mut Node,
    history: &History,
    blame: &Blame,
    edits: Option<crate::edits::At>,
) {
    // Looked up per FILE and used for every function under it — see `FileTrace`.
    if node.kind == NodeKind::File {
        let file = FileTrace::of(&node.path, Histories { history, blame, edits });
        node.last_author = file.last_author();
        // The file's own answer under the other reading — see `FileTrace::main_author`. A
        // file carries one name per reading or the map has nothing to paint on it, which is
        // what `most lines` had before this.
        node.main_author = file.main_author();
        // A file's own headcount, which is not its functions' pooled — see
        // `Blame::file_headcount`, where the difference is the point.
        node.headcount = file.headcount();
        // **The same ordinal the scan assigns, from the same rule.** A reading is keyed on
        // `(path, name, ord)` and ord is a function's position among its file's same-named
        // twins — so it has to be counted over the file's functions in file order, exactly as
        // `scan::ordinals` does it. Counted here rather than read off the node, because a
        // node id embeds a line number and is the one thing that must never key anything
        // durable.
        let mut seen: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
        let ords: Vec<usize> = node
            .children
            .iter()
            .map(|c| {
                let n = seen.entry(c.name.as_str()).or_insert(0);
                let this = *n;
                *n += 1;
                this
            })
            .collect();
        for (i, child) in node.children.iter_mut().enumerate() {
            if child.kind != NodeKind::Func {
                continue;
            }
            let (Some(start), Some(end)) = (child.line, child.end_line) else { continue };
            let t = file.func(&child.name, ords[i], start, end);
            child.last_author = t.last_author.clone();
            // The other two reductions of the same slice — see `RangeHistory`. Written here
            // as well as in `scan`, because a tree can arrive either way: folded with a trace
            // already in hand, or folded cold and traced afterwards.
            child.main_author = t.main_author.clone();
            child.headcount = t.headcount;
            if let Some(score) = child.score.as_mut() {
                score.churn = t.churn;
                score.age_days = t.age_days;
                score.commits = t.commits;
                score.last_touched_days = t.last_touched_days;
                // A function's lifetime count would be `git log -L`, a process apiece — see
                // `Score::all_commits`, which is `None` here for that reason and not for want
                // of history.
                score.all_commits = None;
            }
        }
    }
    for child in &mut node.children {
        apply_to(child, history, blame, edits);
    }
}

/// Fill in each directory's DISTINCT commit count from the git history.
///
/// `aggregate` can compute a directory's lines, surprise and hot share from its children, but
/// not this: a commit touching twelve files in one directory is one commit for that directory,
/// and by the time the tree exists only per-file counts survive. `churn::read` credits ancestor
/// directories once per commit while the log is still grouped, so the answer is a lookup on the
/// directory's own path.
///
/// Churn itself stays the children's LOC-weighted mean rather than `churn_of(dir)`: the
/// normalization constant is tuned for a single file, and a directory pooling every commit
/// beneath it would saturate to 1.0 the moment anyone touched anything.
///
/// **Files as well as directories, despite the name.** A file node's score comes from
/// `aggregate`, which sets `commits: 0` because summing its functions would count one commit once
/// per function it touched — and nothing filled it back in, so every file reported zero commits
/// next to a churn bar at 72. A file's path is a real path, so the log answers directly; only the
/// aggregate could not. Two cold readers predicted directories-only from the name and this doc,
/// in two separate runs, and both were caught by the `File` arm — which is the instrument
/// reporting a name that undersells its function, so the doc says it rather than an inline
/// comment inside the body where a reader predicting from the outside never sees it.
pub(crate) fn apply_dir_history(
    node: &mut Node,
    history: &History,
    edits: Option<crate::edits::At>,
) {
    if node.kind == NodeKind::Dir || node.kind == NodeKind::File {
        if let Some(score) = node.score.as_mut() {
            // The timeline's count where there is one, and the log walk's otherwise. Both
            // answer the same question — distinct commits touching this path inside the
            // window, a container counting a commit once — so this is a resolution swap and
            // not a change of quantity, which is what makes the fallback honest rather than
            // two numbers wearing one name. See `edits::Edits::path`.
            // Zeroes without a walk, for the reason `FileTrace::func` states: the log walk's
            // own per-file count is a real number over a real window, but it is a FILE
            // resolution answer to a question the map now asks per function, and half a lens
            // painted is worse than a lens that says it has not been measured.
            score.commits = match &edits {
                Some(e) => e.path(&node.path),
                None => [0; 4],
            };
            // The lifetime total comes from the same place and for the same reason: a directory
            // counts a commit once, and only the log pass still knows which commit touched what.
            // A function keeps `None` — see `Score::all_commits`.
            score.all_commits = history.total_commits_of(&node.path);
        }
    }
    for child in &mut node.children {
        apply_dir_history(child, history, edits);
    }
}


#[cfg(test)]
mod tests {

    /// **Why does this repo not restore its blame at launch?**
    ///
    /// `relines` is the gate, and a launch that fails it is silent about which half failed —
    /// the log walk coming back empty and the blame cache being cold both land on `Files`.
    /// This asks each half separately, off the real cache and the real log walk.
    ///
    /// `RELINES_REPO=~/projects/x cargo test --lib trace::tests::why_no_relines -- --ignored --nocapture`
    #[test]
    #[ignore = "diagnostic"]
    fn why_no_relines() {
        let Ok(root) = std::env::var("RELINES_REPO") else { return };
        let repo = std::path::Path::new(&root);
        println!("  {}", repo.display());
        println!("    banked depth  {:?}", crate::reports::banked_depth(repo));

        let scans = crate::scancache::ScanCache::open(repo);
        let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let Some(history) = depth1(repo, &stop, &|_| {}) else {
            println!("    depth1 returned None — the log walk found nothing, so relines is");
            println!("    never asked and the launch settles for Files.");
            return;
        };
        println!("    log walk      ok");

        // The same question `relines` asks, per file, off the cache's own entry list — which
        // is exactly the set the scan parsed.
        let (mut files, mut missing, mut no_hash, mut no_commit) = (0, 0, 0, 0);
        for path in scans.paths() {
            files += 1;
            let hash = scans.hash_of(&path).unwrap_or(0);
            if hash == 0 {
                no_hash += 1;
            }
            let last = history.last_commit_of(&path);
            if last.is_none() {
                no_commit += 1;
            }
            if !scans.has_blame(&path, hash, last) {
                missing += 1;
            }
        }
        let cost = missing as f32 * BLAME_MS_PER_FILE / 1000.0;
        println!("    files in cache       {files}");
        println!("    no cached hash       {no_hash}");
        println!("    no last commit       {no_commit}");
        println!("    blame NOT cached     {missing}");
        println!("    would cost           {cost:.1}s against a budget of {}s", BUDGET.as_secs_f32());
    }


    /// Every rung round-trips through the tag the index banks, and the ladder is in order.
    ///
    /// **The tag is what survives a restart, so a rung missing from `from_tag` is a repo that
    /// silently forgets it was traced.** Written as a loop over every variant rather than as
    /// four assertions, so a fifth rung fails here rather than being read as `Untraced` on the
    /// launch after somebody paid for it.
    #[test]
    fn a_banked_tag_names_the_rung_that_wrote_it() {
        let ladder = [Depth::Untraced, Depth::Files, Depth::Lines, Depth::Edits];
        for d in ladder {
            assert_eq!(Depth::from_tag(d.tag_str()), d, "{d:?} does not survive its own tag");
        }
        for pair in ladder.windows(2) {
            assert!(pair[0].rank() < pair[1].rank(), "the ladder is out of order at {pair:?}");
        }
        assert_eq!(Depth::from_tag("something a later build wrote"), Depth::Untraced);
    }
    use super::*;
    use std::path::Path;
    use std::process::Command;

    /// A repo whose functions were written at different times, so blame has something to say
    /// that the file-level numbers do not.
    fn repo() -> tempfile::TempDir {
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        let mut body = String::new();
        for i in 0..4 {
            body.push_str(&format!("fn f{i}() -> u32 {{\n    let x = {i};\n    x + {i}\n}}\n\n"));
            std::fs::write(dir.path().join("a.rs"), &body).expect("writes");
            std::fs::write(dir.path().join("b.rs"), format!("fn g{i}() {{\n    {i};\n}}\n"))
                .expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("commit {i}")]);
        }
        dir
    }

    /// **A blame pass lands on the tree while it is still running.**
    ///
    /// The bug: `deepen` read every file's blame and applied it ONCE at the end, so for the
    /// whole of a thirty-three-minute pass on kibana the map showed depth 1 — every function
    /// wearing its file's author, each file one flat colour — while the pill counted honestly
    /// up to `21k / 59k`. All the per-function colour arrived in a single step at the end.
    ///
    /// Asserted on what each landing CARRIES rather than by timing anything: a snapshot has to
    /// reach the tree before the pass returns, and each one has to hold more than the last.
    #[test]
    fn a_blame_pass_lands_before_it_finishes() {
        let dir = repo();
        let mut scan = scan_of(dir.path(), Depth::Files);
        let scans = crate::scancache::ScanCache::open(dir.path());
        let stop = std::sync::atomic::AtomicBool::new(false);
        let history = depth1(dir.path(), &stop, &|_| {}).expect("walks");

        // One chunk per file, so this small fixture exercises the loop the way a large repo
        // does — `PUBLISH_FLOOR` would otherwise make the whole pass a single chunk.
        let files = blamable(&scan, &scans);
        assert!(files.len() >= 2, "the fixture has something to chunk");

        let mut acc = Blame::default();
        let mut steps = Vec::new();
        for chunk in files.chunks(1) {
            acc.absorb(Blame::read(dir.path(), chunk, &history, &scans, &stop, &|_| {}));
            apply(&mut scan, &history, &acc, None);
            steps.push(acc.len());
        }
        assert!(steps.len() > 1, "more than one landing: {steps:?}");
        assert!(
            steps.windows(2).all(|w| w[1] > w[0]),
            "each landing carries strictly more than the last: {steps:?}"
        );
        assert_eq!(*steps.last().unwrap(), files.len(), "and the last is everything");
    }

    /// Absorbing chunk by chunk reaches the same tree as reading the lot in one go — which is
    /// what makes publishing a partial pass honest rather than merely early.
    #[test]
    fn a_chunked_blame_pass_matches_an_unchunked_one() {
        let dir = repo();
        let scan = scan_of(dir.path(), Depth::Files);
        let scans = crate::scancache::ScanCache::open(dir.path());
        let stop = std::sync::atomic::AtomicBool::new(false);
        let history = depth1(dir.path(), &stop, &|_| {}).expect("walks");
        let files = blamable(&scan, &scans);

        let whole = Blame::read(dir.path(), &files, &history, &scans, &stop, &|_| {});
        let mut chunked = Blame::default();
        for chunk in files.chunks(1) {
            chunked.absorb(Blame::read(dir.path(), chunk, &history, &scans, &stop, &|_| {}));
        }
        assert_eq!(whole.len(), chunked.len());

        let mut a = scan.clone();
        let mut b = scan.clone();
        apply(&mut a, &history, &whole, None);
        apply(&mut b, &history, &chunked, None);
        same(&rows(&a), &rows(&b));
    }

    /// **A file carries a name under BOTH of Blame's readings, whichever path built it.**
    ///
    /// A file's own band is what the map paints wherever a ring has not been fetched, so a
    /// file with `last_author` and no `main_author` drew as `no blame` the moment the reading
    /// was switched to `most lines` — from the rim inwards, taking the legend's people with
    /// it. There are two paths that build a file node and the field has to be written on both:
    /// `scan` folds the tree with a trace already in hand, `apply` lands one on a tree folded
    /// cold, and a repo arrives either way depending only on when git got there.
    #[test]
    fn a_file_is_named_under_both_readings_whichever_path_built_it() {
        let dir = repo();
        let stop = std::sync::atomic::AtomicBool::new(false);

        // Folded with the trace in hand.
        let warm = scan_of(dir.path(), Depth::Lines);

        // Folded cold, traced afterwards — the deferred path.
        let mut cold = scan_of(dir.path(), Depth::Untraced);
        let scans = crate::scancache::ScanCache::open(dir.path());
        let history = depth1(dir.path(), &stop, &|_| {}).expect("walks");
        let files = blamable(&cold, &scans);
        let blame = Blame::read(dir.path(), &files, &history, &scans, &stop, &|_| {});
        apply(&mut cold, &history, &blame, None);

        let named = |scan: &crate::scan::Scan| {
            let mut out = Vec::new();
            scan.root.visit(&mut |n| {
                if n.kind == crate::model::NodeKind::File {
                    out.push((n.id.clone(), n.last_author.clone(), n.main_author.clone()));
                }
            });
            out
        };
        let warm = named(&warm);
        let cold = named(&cold);
        assert!(!warm.is_empty(), "the fixture has files");
        for (id, last, main) in &warm {
            assert!(last.is_some(), "{id}: no last author");
            assert!(main.is_some(), "{id}: no name under `most lines`");
        }
        assert_eq!(warm, cold, "the two paths name a file differently");
    }

    fn scan_of(repo: &Path, depth: Depth) -> crate::scan::Scan {
        let (scores, scans) = crate::scan::Memos::ephemeral();
        crate::scan::scan(
            repo,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &scores, scans: &scans },
            crate::scan::Fidelity::Full,
            depth,
        )
        .expect("scans")
    }

    /// Every git-derived field, per node, in tree order.
    type Row = (String, [f32; 4], Option<f32>, [u32; 4], Option<u32>, Option<f32>, Option<String>);

    fn rows(scan: &crate::scan::Scan) -> Vec<Row> {
        let mut out = Vec::new();
        scan.root.visit(&mut |n| {
            if let Some(s) = n.score.as_ref() {
                out.push((
                    n.id.clone(),
                    s.churn,
                    s.age_days,
                    s.commits,
                    s.all_commits,
                    s.last_touched_days,
                    n.last_author.clone(),
                ));
            }
        });
        out
    }

    /// The two must agree about everything except WHEN they were taken.
    ///
    /// `age_days` and `last_touched_days` are measured from the moment the blame was read, so
    /// two traces of one repo differ by the seconds between them. That is the instrument being
    /// honest rather than a discrepancy, and a thousandth of a day is eighty-six seconds — far
    /// looser than that gap and far tighter than any real difference.
    fn same(a: &[Row], b: &[Row]) {
        assert_eq!(a.len(), b.len(), "a deferred trace reached a different set of nodes");
        for (x, y) in a.iter().zip(b.iter()) {
            assert_eq!(x.0, y.0, "tree order moved");
            for (i, (p, q)) in x.1.iter().zip(y.1.iter()).enumerate() {
                assert!((p - q).abs() < 0.001, "{}: churn[{i}] {p} vs {q}", x.0);
            }
            match (x.2, y.2) {
                (Some(p), Some(q)) => assert!((p - q).abs() < 0.001, "{}: age {p} vs {q}", x.0),
                (p, q) => assert_eq!(p, q, "{}: age", x.0),
            }
            assert_eq!(x.3, y.3, "{}: commits", x.0);
            assert_eq!(x.4, y.4, "{}: all_commits", x.0);
            match (x.5, y.5) {
                (Some(p), Some(q)) => assert!((p - q).abs() < 0.001, "{}: touched", x.0),
                (p, q) => assert_eq!(p, q, "{}: touched", x.0),
            }
            assert_eq!(x.6, y.6, "{}: last author", x.0);
        }
    }

    fn read_trace(repo: &Path, scan: &crate::scan::Scan) -> (History, Blame) {
        let history = crate::churn::read(repo);
        let mut paths: Vec<(String, u64)> = Vec::new();
        scan.root.visit(&mut |n| {
            if n.kind == NodeKind::File {
                paths.push((n.path.clone(), 0));
            }
        });
        let cache = crate::scancache::ScanCache::ephemeral();
        let stop = std::sync::atomic::AtomicBool::new(false);
        let blame = Blame::read(repo, &paths, &history, &cache, &stop, &|_| {});
        (history, blame)
    }

    /// **The claim the whole split rests on.** A map drawn with git in hand and a map drawn
    /// without it and given git afterwards have to be the same map — otherwise deferring the
    /// trace is not deferring a cost, it is producing a second instrument nobody has checked.
    ///
    /// So the fields git fills are wiped from a finished tree and put back by [`apply`], and
    /// every one of them is compared: the functions' four facts, the containers' distinct and
    /// lifetime commit counts, and the last author on every node that carries one.
    #[test]
    fn a_deferred_trace_lands_exactly_where_an_inline_one_did() {
        // The scan writes its finished tree to the real cache directory otherwise, and a
        // test that leaves entries in the developer's own cache is one that can also be
        // ANSWERED by one — see `treecache::load`.
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        let inline = scan_of(dir.path(), Depth::Lines);
        let before = rows(&inline);
        // **Age and an author, not a commit count.** Churn moved off this rung: a count of
        // changes comes from the timeline, which is `Depth::Edits`, and at `Lines` every
        // `commits` is legitimately zero. Guarding on it here would have this test pass by
        // measuring nothing — which is exactly what it exists to rule out.
        assert!(
            before.iter().any(|r| r.2.is_some() && r.6.is_some()),
            "the fixture has to have history in it, or this test proves nothing"
        );

        // The real untraced path, not a tree with its fields knocked out by hand: what is
        // being pinned is that a scan which never opened git leaves exactly the absences
        // `apply` knows how to fill.
        let mut deferred = scan_of(dir.path(), Depth::Untraced);
        let untraced = rows(&deferred);
        assert_ne!(untraced, before, "an untraced scan has to differ from a traced one");
        assert!(
            untraced
                .iter()
                .all(|r| r.1 == [0.0; 4] && r.2.is_none() && r.3 == [0; 4] && r.6.is_none()),
            "an untraced scan must claim nothing about history, not claim zero"
        );

        let (history, blame) = read_trace(dir.path(), &deferred);
        apply(&mut deferred, &history, &blame, None);
        same(&before, &rows(&deferred));
    }

    /// **A depth is bought once.** A restart scans without git and then reads what a budget
    /// allows, which is the log walk; the per-line pass is nobody's automatic. So a repo
    /// somebody had traced to the line came back asking to be traced again — and it costs
    /// nothing to restore, because blame is cached per file and an unchanged repo already
    /// holds every answer.
    ///
    /// What `relines` prices is the REMAINDER. Nothing missing is free; a cache that has been
    /// dropped is a full pass, and a full pass at launch is exactly what the budget exists to
    /// refuse.
    #[test]
    fn a_repo_already_blamed_goes_back_to_the_line_for_nothing() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        let mut scan = scan_of(dir.path(), Depth::Untraced);
        let history = crate::churn::read(dir.path());
        let scans = crate::scancache::ScanCache::open(dir.path());

        // Nothing cached: every file would have to be blamed, which on a fixture is affordable
        // and on a real repo is the case this refuses.
        assert!(
            relines(&scan, &scans, &history),
            "a two-file repo is under any budget even cold"
        );

        // A per-line pass fills the cache, and the same question is then free.
        let stop = std::sync::atomic::AtomicBool::new(false);
        deepen(dir.path(), &mut scan, Depth::Lines, &scans, &stop, &|_| {}, &|_| {});
        assert!(relines(&scan, &scans, &history), "and free once the blame is banked");

        // An empty cache is the dropped-cache case, and it is priced per file rather than
        // waved through: what makes this affordable here is the size of the fixture, and the
        // arithmetic is the same one that refuses kibana.
        let cold = crate::scancache::ScanCache::ephemeral();
        let mut missing = 0;
        scan.root.visit(&mut |n| {
            if n.kind == NodeKind::File && !cold.has_blame(&n.path, 0, None) {
                missing += 1;
            }
        });
        assert!(missing > 0, "an empty cache holds no blame, so every file is a cost");
    }

    /// The blame a trace paid for has to survive the process that paid for it.
    ///
    /// **The test above passes with the bug**, and that is the point of this one: it asks the
    /// same question of the SAME `ScanCache` object, so the answers are still sitting in
    /// memory. `put_blame` only reaches disk through `touched`, which appends once
    /// `FLUSH_EVERY` keys have piled up, and the one unconditional `save` was at the end of a
    /// scan — which a trace is not. A repo with fewer than four hundred files therefore
    /// finished its blame pass, painted the map with it, and dropped every line on quit.
    ///
    /// It hid behind `relines`, which priced the re-blame against a ten-second budget and
    /// restored anyway: under about 290 files the repo came back looking traced and quietly
    /// paid again, and past that it offered `N files to blame` at every launch forever.
    #[test]
    fn the_blame_a_trace_paid_for_is_still_there_next_launch() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        // **The ON-DISK cache for both phases, which is what the app does and what
        // `scan_of` does not.** A blame with no parse entry beside it is dropped — the gate
        // lives on the parse entry, so an orphan could never be invalidated — so a fixture
        // that scans into an ephemeral cache and blames into a real one banks nothing for a
        // reason that has nothing to do with the bug.
        let scans = crate::scancache::ScanCache::open(dir.path());
        let (scores, _) = crate::scan::Memos::ephemeral();
        let mut scan = crate::scan::scan(
            dir.path(),
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &scores, scans: &scans },
            crate::scan::Fidelity::Full,
            Depth::Untraced,
        )
        .expect("scans");
        let history = crate::churn::read(dir.path());
        let stop = std::sync::atomic::AtomicBool::new(false);
        deepen(dir.path(), &mut scan, Depth::Lines, &scans, &stop, &|_| {}, &|_| {});

        // A fresh handle on the same repo: what the NEXT launch opens, holding only what
        // actually reached the file.
        let reopened = crate::scancache::ScanCache::open(dir.path());
        let mut missing = 0;
        scan.root.visit(&mut |n| {
            if n.kind != NodeKind::File {
                return;
            }
            let hash = reopened.hash_of(&n.path).unwrap_or(0);
            if !reopened.has_blame(&n.path, hash, history.last_commit_of(&n.path)) {
                missing += 1;
            }
        });
        assert_eq!(missing, 0, "a trace that banked nothing is a trace nobody can restore");
    }

    /// **An estimate prices the work that is left, never the work in principle.**
    ///
    /// The same mistake made twice, one phase apart, and this pins both halves of the rule. A
    /// scan of a repo whose tree is cached is a decode, not a parse — kibana asked at every
    /// launch on a fifteen-second estimate for a tenth of a second of work. A per-line trace of
    /// a repo whose blame is cached is a lookup, not a `git blame` per file. Neither is priced
    /// by counting what is in the repo; both are priced by counting what is missing.
    #[test]
    fn a_cached_answer_is_not_priced_as_though_it_had_to_be_derived() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();

        // Cold: nothing stored, so the walk finds no tree to serve.
        assert!(
            !crate::treecache::warm(dir.path(), crate::scan::Fidelity::Full, Depth::Untraced),
            "an unscanned repo has nothing cached, whatever it would cost to scan"
        );

        // A scan stores its tree, and the same question then answers yes — which is what stands
        // between a large repo and a question at every launch.
        let mut scan = scan_of(dir.path(), Depth::Untraced);
        assert!(
            crate::treecache::warm(dir.path(), crate::scan::Fidelity::Full, Depth::Untraced),
            "a scanned and unchanged repo is a decode away from its map"
        );

        // The trace half of the same rule — see `relines`.
        let scans = crate::scancache::ScanCache::open(dir.path());
        let stop = std::sync::atomic::AtomicBool::new(false);
        deepen(dir.path(), &mut scan, Depth::Lines, &scans, &stop, &|_| {}, &|_| {});
        assert!(relines(&scan, &scans, &crate::churn::read(dir.path())));
    }

    /// A repo nobody has walked is priced without walking it, and says so.
    ///
    /// The number is a bound from `count-objects`, not a measurement, and the flag is what
    /// stops the window printing it as one. A fixture repo is small either way — what is being
    /// pinned is that the cold path answers at all, that it costs nothing, and that a walk
    /// leaves a bank behind for the warm path to use.
    #[test]
    fn an_unwalked_repo_is_priced_from_free_evidence_and_a_walked_one_from_its_own() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();

        let cold = estimate(dir.path());
        assert!(cold.cold, "nothing has walked this repo, and the estimate has to say so");
        assert_eq!(cold.commits, None, "a commit count nobody counted is not reported");
        assert!(cold.fits, "a four-commit repo is under any budget");

        depth1(dir.path(), &std::sync::atomic::AtomicBool::new(false), &|_| {});
        let warm = estimate(dir.path());
        assert!(!warm.cold, "a walk leaves a bank, and a bank is measured evidence");
        assert_eq!(warm.commits, Some(4), "four commits, all inside the churn window");
        assert!(matches!(go(dir.path()), Go::Run(Depth::Files)));
    }

    /// **The whole point of `Depth::Edits`, end to end through a real scan.**
    ///
    /// A body rewritten in place twelve times. At `Lines` the map reports blame's sedimentation
    /// count — the two commits whose lines happen to have survived — and at `Edits` it reports
    /// the twelve edits that actually happened. Same repo, same function, same wedge: the
    /// number changes because the instrument did.
    ///
    /// `edits.rs` pins the two instruments against each other in isolation. This pins that the
    /// deeper one is what a scan at that depth actually puts on the node, which is the part a
    /// misthreaded argument anywhere between `gather` and `Score` would break silently — the
    /// map would go on drawing, in the wrong number.
    #[test]
    fn the_deepest_rung_reports_edits_where_the_one_below_it_reports_survivors() {
        let _home = crate::agentapi::tests::data_home();
        let dir = tempfile::tempdir().expect("tempdir");
        let git = |args: &[&str]| {
            Command::new("git").arg("-C").arg(dir.path()).args(args).output().expect("git runs");
        };
        git(&["init", "-q"]);
        git(&["config", "user.email", "t@example.com"]);
        git(&["config", "user.name", "T"]);
        for i in 0..12 {
            std::fs::write(dir.path().join("a.rs"), format!("fn only() {{\n    let x = {i};\n}}\n"))
                .expect("writes");
            git(&["add", "-A"]);
            git(&["commit", "-q", "-m", &format!("c{i}")]);
        }

        let read = |depth: Depth| -> (bool, [u32; 4], [u32; 4]) {
            let scan = scan_of(dir.path(), depth);
            let mut found = None;
            scan.root.visit(&mut |n| {
                if n.kind == NodeKind::Func && n.name == "only" {
                    found = n.score.as_ref().map(|s| s.commits);
                }
            });
            (scan.stats.churned, scan.stats.churn_windows, found.expect("the function is drawn"))
        };

        let (churned, windows, commits) = read(Depth::Lines);
        assert!(!churned, "the timeline has not been walked, and the repo says so");
        assert_eq!(
            commits,
            [0; 4],
            "and every node reads zero rather than reporting blame's surviving-commit count \
             as though it were a frequency — the two-quantities-one-ramp bug this rung exists \
             to end. What stops zero being read as `settled` is `churned`, above."
        );
        // The ladder is offered before it is filled: a control has to name its rungs whether or
        // not there is anything behind them. This repo was created seconds ago, so its whole
        // life is one day and every rung is that day — see `edits::windows_for`.
        assert_eq!(windows, [1; 4], "a repo born today still gets four windows, not four zeroes");

        let (churned, _, commits) = read(Depth::Edits);
        assert!(churned, "the walk ran, so the numbers are measurements");
        assert_eq!(
            commits,
            [12; 4],
            "twelve rewrites of one body is twelve, at every window that reaches them. Blame, \
             asked about the same lines, sees two: the signature and the brace are the first \
             commit's, the body line is the last one's, and the ten between left nothing \
             behind. `edits.rs` pins that contrast against the instrument itself."
        );
    }

    /// **Every rung includes the ones below it.**
    ///
    /// Shipped broken: both the scan's blame gate and the deferred trace's asked `depth ==
    /// Depth::Lines`, so requesting the new deepest rung turned the blame pass OFF. The trace
    /// ran, `resolved` stayed at zero, and the sidebar went on offering "304 files to blame"
    /// however many times it was pressed — a button that looked dead and a repo that could not
    /// be finished. Nothing errored; the ladder simply stopped being a ladder.
    ///
    /// Pinned on the predicates rather than on a scan, because the arithmetic is the bug: a
    /// fifth rung added to `blames` reads as one line here and as a dead button in the window.
    #[test]
    fn the_ladder_is_cumulative() {
        assert!(!Depth::Untraced.blames(), "nothing is blamed before git is read");
        assert!(!Depth::Files.blames(), "the log walk is per file and blames nothing");
        assert!(Depth::Lines.blames());
        assert!(Depth::Edits.blames(), "counting edits does not replace blaming lines");

        assert!(!Depth::Untraced.counts_edits());
        assert!(!Depth::Files.counts_edits());
        assert!(!Depth::Lines.counts_edits(), "the timeline walk is its own rung");
        assert!(Depth::Edits.counts_edits());
    }

    /// The same claim through the real trace, on the number the sidebar actually divides.
    ///
    /// **`resolved`, not the authors on the tree.** A function in an unblamed file still gets an
    /// author — its FILE's, from the log walk, which is `FileTrace::func`'s fallback working as
    /// designed — so counting authors cannot tell a blamed repo from an unblamed one and a test
    /// that did would have passed straight through this bug. What cannot be faked is the count
    /// of files the pass resolved, which is the numerator of `304 files to blame`.
    #[test]
    fn the_deepest_rung_still_blames_every_file() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        let resolved_at = |depth: Depth| {
            let (scores, scans) = crate::scan::Memos::ephemeral();
            let mut scan = scan_of(dir.path(), Depth::Untraced);
            let _ = (scores, &scans);
            let (reached, resolved, considered) = deepen(
                dir.path(),
                &mut scan,
                depth,
                &scans,
                &std::sync::atomic::AtomicBool::new(false),
                &|_| {},
                &|_| {},
            );
            (reached, resolved, considered)
        };
        let (_, lines_done, lines_seen) = resolved_at(Depth::Lines);
        assert!(lines_seen > 0, "the fixture has files to blame, or this proves nothing");

        let (reached, edits_done, edits_seen) = resolved_at(Depth::Edits);
        assert_eq!(reached, Depth::Edits, "the walk finished, so it reports the rung it reached");
        assert_eq!(
            (edits_done, edits_seen),
            (lines_done, lines_seen),
            "the deepest rung blames everything the one below it does. Skipped here, `resolved` \
             stays at zero and the sidebar offers `N files to blame` forever, however many \
             times it is pressed."
        );
    }

    /// **A DEFERRED trace has to move the repo-level flag, not only the nodes.**
    ///
    /// The app never scans at `Depth::Edits` — it scans untraced and deepens, which is a
    /// different code path from a fresh scan and the one every press of Trace actually takes.
    /// Shipped broken once: the walk ran, every node got its counts, and the lens stayed locked
    /// because `Stats::churned` was written only by `scan()` and a deepen never touched it.
    /// Nothing failed, nothing logged, and the map went on looking like a map — which is the
    /// class of bug `CLAUDE.md` opens with.
    #[test]
    fn a_deferred_edits_walk_tells_the_repo_and_not_just_the_nodes() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        let mut scan = scan_of(dir.path(), Depth::Untraced);
        assert!(!scan.stats.churned, "an untraced scan has counted nothing");

        let history = crate::churn::read(dir.path());
        apply(&mut scan, &history, &Blame::default(), None);
        assert!(!scan.stats.churned, "and a trace without the walk still has not");

        let walked = crate::edits::gather(
            dir.path(),
            &std::sync::atomic::AtomicBool::new(false),
            &|_| {},
        )
        .expect("nobody stopped it");
        let at = crate::edits::At {
            edits: &walked,
            now: crate::churn::now_secs(),
            windows: walked.windows,
        };
        apply(&mut scan, &history, &Blame::default(), Some(at));
        assert!(scan.stats.churned, "the walk ran, so the lens has something to paint");
        assert_eq!(
            scan.stats.churn_windows, walked.windows,
            "and the repo names the ladder it was actually counted at"
        );
    }

    /// Depth 2 lands on a tree depth 1 already touched, so a second landing must read only the
    /// trace it was given — never the fields the last one wrote.
    #[test]
    fn applying_a_trace_twice_changes_nothing() {
        let _home = crate::agentapi::tests::data_home();
        let dir = repo();
        let mut scan = scan_of(dir.path(), Depth::Untraced);
        let (history, blame) = read_trace(dir.path(), &scan);
        apply(&mut scan, &history, &blame, None);
        let once = rows(&scan);
        apply(&mut scan, &history, &blame, None);
        same(&once, &rows(&scan));
    }
}
