//! The launch: every project the index knows, rescanned in the background.
//!
//! The sidebar fills in from the index before any scan starts, the project the window was on
//! goes first, and a click on a queued row jumps it to the front of its lane. Two lanes, so a
//! small repo never waits behind a large one. A repo whose scan would be over budget is not
//! scanned unasked; it is listed with its price. History is traced only as far as the budget
//! allows, and never banked over a deeper trace somebody already paid for.

use super::depth::{banks_over, trace_within_budget};
use super::{load_reports, lock, Project, Shared};
use crate::scan::Scan;
use std::path::{Path, PathBuf};
use std::time::Instant;

/// The window's shape stream, shared by the restore's lanes rather than owned by one.
///
/// `Arc<dyn …>` and not a generic: two lanes run the same code over the same emitters, and a
/// type parameter would only mean two copies of [`drain`] that cannot share them.
type ShapeSink = std::sync::Arc<dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync>;
/// The window's progress stream, on the same terms as [`ShapeSink`].
type TickSink = std::sync::Arc<dyn Fn(&str, &crate::scan::Progress) + Send + Sync>;

/// Work one lane of the restore: restore each project in it, the one the window is waiting on
/// first, until the lane is empty.
///
/// Split out of [`restore`] so two lanes can run it — see `BIG_REPO_FILES`. Everything it
/// touches is per project or behind the state lock, so two of these are independent: the
/// scan caches are per repo, the progress is keyed by project, and the only shared thing is
/// `wanted`, which `claim_next` consumes only when this lane can serve it.
///
/// **It never touches `active`.** `restore` names where the window is going before either lane
/// starts, and corrects it once after both have finished if that repo never arrived. A lane
/// naming it again as the project landed was a third decision, minutes late on a big repo, and
/// it overrode whatever somebody had clicked in the meantime.
fn drain(
    mut queue: Vec<crate::reports::KnownProject>,
    state: &Shared,
    on_shape: &(dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync),
    on_tick: &(dyn Fn(&str, &crate::scan::Progress) + Send + Sync),
) {
    while !queue.is_empty() {
        // Whoever the window is waiting on goes next, if this lane holds them.
        let known = queue.remove(claim_next(&mut lock(state).wanted, &queue));
        restore_one(&known, state, on_shape, on_tick);
    }
}

/// Bring one known project back: draw its cached map, price its scan, scan it, land it.
///
/// Every way this can stop short takes the project off the pending list, because a row that
/// cannot be scanned must stop claiming to be moments away from appearing. In order: a repo
/// that is no longer there is settled; a cached map is published for the window to draw while
/// the scan runs; a scan over budget with nothing cached is declined and listed with its price;
/// a scan that fails is settled; and one that succeeds becomes the project, unless an open
/// landed it first — see [`AppState::land_restored`](super::AppState::land_restored).
fn restore_one(
    known: &crate::reports::KnownProject,
    state: &Shared,
    on_shape: &(dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync),
    on_tick: &(dyn Fn(&str, &crate::scan::Progress) + Send + Sync),
) {
    let path = PathBuf::from(&known.repo);
    // Off the list whatever happens below — a row that cannot be scanned must stop
    // claiming to be moments away from appearing. It stays in the index, so it
    // comes back next launch if the volume does; it just isn't pending any more.
    if !path.is_dir() {
        lock(state).settle(&known.key);
        return;
    }
    // The map first, and without asking whether it is still true — see
    // `treecache::stale`. Proving it costs a walk of the whole repo, and the scan below
    // does that anyway and replaces this if the answer is no.
    if let Some(drawn) = crate::treecache::stale(&path) {
        lock(state).shallow.insert(known.key.clone(), drawn);
    }
    let on_progress = restore_progress(known.key.clone(), state, on_tick);
    if let Some(priced) = declined_at_launch(known, &path) {
        let mut s = lock(state);
        s.awaiting.insert(known.key.clone(), priced);
        s.settle(&known.key);
        return;
    }
    let Some((scan, scans)) = scan_unasked(known, &path, &on_progress, on_shape) else {
        lock(state).settle(&known.key);
        return;
    };
    let project = project_at_launch(known, path, scan, &scans, &on_progress);
    lock(state).land_restored(&known.key, project);
}

/// Where a restoring scan reports its progress: the window's stream, and the sidebar's row.
///
/// The scan already counts what it is doing; the restore used to discard it and leave the
/// sidebar with nothing to say for the length of a large repo. One of these per project, so
/// the repo's size is banked once, on the first phase that can count itself.
fn restore_progress<'a>(
    progress_key: String,
    state: &Shared,
    on_tick: &'a (dyn Fn(&str, &crate::scan::Progress) + Send + Sync),
) -> impl Fn(crate::scan::Progress) + Sync + 'a {
    let progress_state = state.clone();
    // Once, on the first phase that can count itself — see `reports::note_size`.
    let sized = std::sync::atomic::AtomicBool::new(false);
    move |p: crate::scan::Progress| {
        on_tick(&progress_key, &p);
        let mut s = lock(&progress_state);
        // Under the state lock, which is what serialises it against the other lane: this
        // is a read-modify-write of one file and two of them interleaving is how an index
        // loses an entry. `persist` is safe for the same reason — it runs holding this.
        if p.total > 0 && !sized.swap(true, std::sync::atomic::Ordering::Relaxed) {
            crate::reports::note_size(&progress_key, p.total);
        }
        s.restoring_progress.insert(progress_key.clone(), p);
    }
}

/// What scanning this repo would cost, when a launch should not pay it unasked; `None` to go
/// ahead.
///
/// Declined only when the price is over budget AND no tree is cached to make it cheap.
fn declined_at_launch(
    known: &crate::reports::KnownProject,
    path: &Path,
) -> Option<crate::scan::Estimate> {
    // **Priced before a file is opened.** The count and the rate are both banked by the
    // last scan of this repo, so this costs a lookup — which is the point at a launch
    // restoring every project, where a directory walk apiece to decide would be most of
    // what the gate is meant to save. A repo nobody has scanned here is not refused: its
    // size is unknown, and refusing on an unknown would leave a row that cannot be acted
    // on. See `scan::estimate`.
    let priced = crate::scan::estimate(known.files, known.scan_ms);
    // **A cached tree makes that price wrong**, and wrong in the direction that annoys: the
    // estimate is what PARSING would cost, and a repo whose tree is already stored is not
    // going to be parsed — the scan walks, matches the signature and decodes the answer.
    // Kibana was declined at every launch on a fifteen-second estimate for a tenth of a
    // second of work. Asked only when the price says no, so a small repo never pays for the
    // question. See `treecache::warm`.
    let declined = !priced.fits
        && !crate::treecache::warm(
            path,
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        );
    declined.then_some(priced)
}

/// The scan a launch takes — the parse alone, with no git — and its cost banked for next time.
///
/// `None` when the scan fails. The scan cache comes back with the tree because the trace
/// that follows reads the same one.
fn scan_unasked(
    known: &crate::reports::KnownProject,
    path: &Path,
    on_progress: &(dyn Fn(crate::scan::Progress) + Sync),
    on_shape: &(dyn Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync),
) -> Option<(Scan, crate::scancache::ScanCache)> {
    let scans = crate::scancache::ScanCache::open(path);
    let scan_took = Instant::now();
    // **Nobody asked for this one.** A launch restores every project in the index, so it is
    // the least invited work in the app, and it draws the map without opening git at all —
    // see `trace`. What history costs is decided after, against a budget, per repo.
    let scan = crate::scan::scan(
        path,
        on_progress,
        &|files: &[crate::scan::ShapeFile]| on_shape(&known.key, files),
        &std::sync::atomic::AtomicBool::new(false),
        &scans,
        // A queue sort key, not a number anyone sees — see `scan::Fidelity`.
        crate::scan::Fidelity::Ordering,
        crate::trace::Depth::Untraced,
    )
    .ok()?;
    // Banked from the scan that just ran, so the next launch prices this repo from its own
    // measurement rather than the corpus default — see `reports::note_scan`. Written here
    // rather than beside `note_size` because a rate needs a whole scan to be a rate.
    crate::reports::note_scan(&known.key, scan.stats.files_scanned, scan_took.elapsed().as_millis() as u64);
    Some((scan, scans))
}

/// The project a launch lands: the scanned tree traced as far as the budget allows, with its
/// readings loaded and its place in the sidebar kept.
fn project_at_launch(
    known: &crate::reports::KnownProject,
    path: PathBuf,
    mut scan: Scan,
    scans: &crate::scancache::ScanCache,
    on_progress: &(dyn Fn(crate::scan::Progress) + Sync),
) -> Project {
    let pending =
        trace_within_budget(&path, &mut scan, scans, known.trace_depth.as_deref(), on_progress);
    // **Never over what somebody already paid for** — see `banks_over`. A launch that
    // declines to restore has priced some work, not undone it.
    if banks_over(pending.depth, known.trace_depth.as_deref()) {
        crate::reports::note_trace(&known.key, pending.depth.tag_str());
    }
    let reports = load_reports(&path, &mut scan);
    // Through `Project::rescan` like every other landing, with nothing to carry: a launch
    // has no project yet. What a restore knows that a fresh one does not is the depth the
    // budget reached and where the row sat in the sidebar. Built before the lock, because
    // it stamps the file marks, which is a stat walk of the whole repo.
    let mut project = Project::rescan(None, path, known.name.clone(), scan, reports);
    project.trace = pending;
    project.touched = known.touched;
    project
}

/// Above this many files a repo gets a lane to itself — see [`restore`].
///
/// The gap it sits in is enormous, which is what makes the exact value uninteresting: this
/// repo is **77** files, tonepoet is 731, and linux is **65,757**. Nothing measured lands
/// within an order of magnitude of the line. What would make it delicate is a repo that
/// actually sits near it, and then the question to ask is not "what is the number" but "how
/// long does this repo hold a lane", because that is the property being bought.
const BIG_REPO_FILES: usize = 2_000;

/// Which project this lane takes next: the one somebody is waiting on, else the running
/// order — see [`AppState::wanted`].
///
/// **Consumed only if this lane can serve it**, which is what makes it safe with two lanes
/// drawing from the same request. A plain `take` would let the small lane swallow a request
/// for a big repo, and the click would do nothing at all.
///
/// Its own function so the choice can be tested without a thread, a temp repo and a scan. A
/// `wanted` naming something not in this queue is the normal case rather than an error: it is
/// in the other lane, already scanned, or the one in flight — and either way the queue is the
/// list of what is LEFT here.
fn claim_next(wanted: &mut Option<String>, queue: &[crate::reports::KnownProject]) -> usize {
    match wanted.as_deref().and_then(|key| queue.iter().position(|p| p.key == key)) {
        Some(at) => {
            *wanted = None;
            at
        }
        None => 0,
    }
}

/// Rebuild the projects sanity had open, in the background.
///
/// Scans are recomputed rather than stored: a saved tree would be wrong the moment a file
/// changed, and rescanning costs about a second. Assessments come back from disk with the
/// project, which is the part that actually could not be recovered.
///
/// A repo that has moved or been deleted is dropped silently — a sidebar entry that opens
/// nothing is worse than one that quietly disappeared.
///
/// Nothing here calls `touch`, and nothing persists until the end. `touch` writes the
/// index, and during a restore the map it would write is the half of the list rebuilt so
/// far — so quitting mid-restore used to truncate `projects.json` to whatever had loaded,
/// losing the rest permanently. A restore reads the index; it has no business editing it
/// until it knows the whole answer.
///
/// `on_shape` streams each directory's files as they parse, so a window can draw the map
/// assembling rather than a bar — see `Node::slim` and `lib/shape.ts`. A backend with no
/// window passes a no-op: this module is the headless half and has never held an
/// `AppHandle`, which is why the emitter arrives as an argument rather than being reached
/// for.
///
/// `on_tick` is the same arrangement for progress. The restore wrote its counts into
/// `restoring_progress` and stopped there, which the sidebar polls at 1.5s — a rate that is
/// fine for a fraction and useless for `Progress::at`, where the whole point is that the
/// wedge lights up as the scan reaches it. Adding a project goes through `commands.rs` and
/// already emitted; a RELAUNCH went through here and did not, so the same repo lit up or
/// stayed dark depending on which way it had arrived.
///
/// **Both carry the project key, because the window cannot work it out.** They did not, and
/// the receiving side inferred the owner from the projects list — the one row that is
/// `loading`. There is no such row: a restore publishes EVERY known project as loading up
/// front, on purpose, so the sidebar fills in immediately. So the inferred owner was
/// whichever unfinished project sorted first, it changed hands every time any of them
/// settled, and the accumulated shape of the repo actually being scanned was thrown away
/// mid-parse. A stream that names its subject cannot be guessed wrong.
pub fn restore(
    state: Shared,
    on_shape: impl Fn(&str, &[crate::scan::ShapeFile]) + Send + Sync + 'static,
    on_tick: impl Fn(&str, &crate::scan::Progress) + Send + Sync + 'static,
) {
    let index = crate::reports::load_index();
    if index.projects.is_empty() {
        return;
    }
    // Continue the previous session's counter rather than restarting it. `touched` is
    // `clock`, and clock is per-process — which was harmless while every entry was
    // rewritten on every save and they all shared one session's numbering. Now that
    // unloaded entries keep the number they were last saved with, a counter starting at 0
    // would rank this session's projects BELOW last session's, and the sidebar reads as a
    // history in that order.
    {
        let mut s = lock(&state);
        let high = index.projects.iter().map(|p| p.touched).max().unwrap_or(0);
        s.clock = s.clock.max(high);
        // Published before the first scan starts, so the sidebar fills in immediately with
        // what the index already knows and each row firms up as its scan lands — rather
        // than staying empty for the length of the slowest repo and reading as loss.
        s.restoring = index.projects.clone();
        // The arrangement comes back with the list it arranges, or the sidebar reads as
        // recency again on every launch and a person has to drag it back every morning.
        s.order = index.order.clone();
        // **Where this launch is going, said before it gets there.** `active` used to be set
        // only when the previously-active project's own scan landed — last, on a big repo —
        // so for the length of that scan the window had nothing selected and waited on
        // whatever sat at the top of the sidebar: a launch that said "Reading sanity…" for
        // half a minute and then showed ceph.
        //
        // Naming it now is a claim about intent, not about what came back. If that repo has
        // been moved or deleted it never arrives, and the fallback after the loop replaces it
        // with the most recently touched thing that did — the same correction as before, one
        // wrong project name earlier rather than one wrong project name throughout.
        s.active = index.active.clone();
    }
    std::thread::spawn(move || {
        let on_shape: ShapeSink = std::sync::Arc::new(on_shape);
        let on_tick: TickSink = std::sync::Arc::new(on_tick);
        // **The one you are going to look at, first.** The list is restored oldest-touched
        // first so the most recent ends up on top — which is right for the sidebar and wrong
        // for the wait: scanning is sequential, so the project the window will open was
        // behind every other one, and a launch with three repos made you wait for all three
        // to see the first.
        let mut order: Vec<&crate::reports::KnownProject> = index.projects.iter().rev().collect();
        if let Some(active) = index.active.as_deref() {
            if let Some(at) = order.iter().position(|k| k.key == active) {
                let first = order.remove(at);
                order.insert(0, first);
            }
        }
        // Owned, and drained by choice rather than iterated in order — see `AppState::wanted`.
        // The arrangement above is the best guess anyone can make BEFORE the window is up;
        // once it is, somebody clicking a row is better information than any guess, and a
        // queue that cannot be reordered has no way to accept it.
        let queue: Vec<crate::reports::KnownProject> = order.into_iter().cloned().collect();

        // **Two lanes, so a small repo never waits on a large one.** A single queue meant
        // 77 files sat behind 65,757 — sanity read `queued` for the length of linux, and the
        // wait was being charged to the wrong project entirely.
        //
        // Two, and not one lane per project, because what the sequencing actually buys is
        // disk: a scan is already rayon-parallel across every core, and during the blame pass
        // its threads are blocked on `git blame` subprocesses rather than computing — so the
        // constraint was never CPU, and it is not memory either (measured at 0.36 GB with
        // linux a third of the way through). It is how many `git blame` processes are
        // competing for one disk. One big lane keeps that bounded; one small lane empties in
        // seconds and rejoins.
        // **A repo of unknown size is MEASURED before it is laned, not guessed at.**
        // `files: None` used to mean small, on the sound argument that somebody who has just
        // added a repo is watching it and must not wait behind an hour of linux. What that
        // did not cover is the unknown repo that turns out to be enormous: ladybird arrived
        // with no recorded size, took the small lane, and held it at 7,646 files while five
        // repos of a few hundred each waited behind the very lane that exists to protect
        // them. Its size was written during that scan, so the misfiling corrected itself on
        // the next launch and looked like a one-off — it is not, it is every repo's first
        // launch after being added.
        //
        // The walk is what the scan does first anyway, and it is the cheapest thing in the
        // scan: 0.01s on a 344-file repo, a couple of seconds on the kernel. Paying it here,
        // once, only for repos nobody has a number for, buys a lane assignment that is a
        // measurement instead of a hope.
        let sized: Vec<(crate::reports::KnownProject, usize)> = queue
            .into_iter()
            .map(|k| {
                let n = match k.files {
                    Some(n) => n,
                    None => {
                        let n = crate::scan::collect_files(&PathBuf::from(&k.repo)).len();
                        // Banked immediately: a launch that is quit before this repo's scan
                        // reaches its first counted tick would otherwise arrive at the next
                        // launch just as unknown, and lane just as badly.
                        crate::reports::note_size(&k.key, n);
                        n
                    }
                };
                (k, n)
            })
            .collect();
        let (big, small): (Vec<_>, Vec<_>) =
            sized.into_iter().partition(|(_, n)| *n > BIG_REPO_FILES);
        let (big, small): (Vec<_>, Vec<_>) = (
            big.into_iter().map(|(k, _)| k).collect(),
            small.into_iter().map(|(k, _)| k).collect(),
        );
        let lanes: Vec<_> = [big, small]
            .into_iter()
            .filter(|lane| !lane.is_empty())
            .map(|lane| {
                let state = state.clone();
                let on_shape = on_shape.clone();
                let on_tick = on_tick.clone();
                std::thread::spawn(move || drain(lane, &state, &*on_shape, &*on_tick))
            })
            .collect();
        // Both, before the tail below: it decides which project the window lands on and
        // writes the index, and either answer is a truncation of itself if the other lane is
        // still producing projects. A joined thread that panicked is not worth propagating —
        // the other lane's work is still good, and the fallback picks from what did arrive.
        for lane in lanes {
            let _ = lane.join();
        }

        let mut s = lock(&state);
        // Fall back to the most recently touched thing that did come back. Landing on the
        // wrong project is recoverable with a click; landing on nothing looks like the
        // restore failed.
        if s.active.as_ref().is_none_or(|k| !s.projects.contains_key(k)) {
            s.active = s.projects.iter().max_by_key(|(_, p)| p.touched).map(|(key, _)| key.clone());
        }
        // One write, now that the list is whole and cannot be a truncation of itself.
        s.persist();
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::open::open_project;
    use crate::agentapi::tests::data_home;
    use crate::agentapi::{project_key, AppState, OpenRequest, Report};
    use crate::model::NodeKind;
    use axum::extract::State;
    use axum::Json;
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex};

    /// Clicking a queued project moves it to the front of the restore.
    ///
    /// The launch order — last session's active repo, then by recency — is the best guess
    /// available before the window exists, and it is wrong the moment somebody opens a small
    /// repo sitting behind a large one. linux is hours and sanity is seconds, so a person
    /// looking at sanity was told `queued` for the length of linux.
    #[test]
    fn the_project_somebody_asked_for_is_scanned_next() {
        let q = queued(&[("/linux", None), ("/sanity", None), ("/tally", None)]);

        let mut want = Some("/sanity".to_string());
        assert_eq!(claim_next(&mut want, &q), 1, "the one asked for goes next");
        assert_eq!(want, None, "and the request is spent");

        let mut none = None;
        assert_eq!(claim_next(&mut none, &q), 0, "nobody asked: the running order stands");

        // In the other lane, already scanned, or the one in flight — either way it is not in
        // what is LEFT here, and that is ordinary rather than an error.
        let mut elsewhere = Some("/gone".to_string());
        assert_eq!(claim_next(&mut elsewhere, &q), 0, "a stale request does not stall the lane");
        assert_eq!(
            elsewhere.as_deref(),
            Some("/gone"),
            "and it is NOT consumed — the other lane still has to see it, or a click on a big \
             repo would be swallowed by the small lane and do nothing at all"
        );
    }

    /// A small repo gets its own lane rather than queueing behind a large one.
    ///
    /// 77 files sat behind 65,757: sanity read `queued` for the length of linux, which is the
    /// wait being charged to the wrong project. The size comes from the last scan, so a repo
    /// nobody has scanned here yet is unknown — and unknown goes in the small lane, because a
    /// repo somebody just added is one they are watching.
    #[test]
    fn a_big_repo_scans_in_its_own_lane() {
        let all = queued(&[
            ("/linux", Some(65_757)),
            ("/sanity", Some(77)),
            ("/fresh", None),
            ("/ceph", Some(120_000)),
        ]);
        let (big, small): (Vec<_>, Vec<_>) =
            all.into_iter().partition(|k| k.files.is_some_and(|n| n > BIG_REPO_FILES));

        let keys = |v: &[crate::reports::KnownProject]| {
            v.iter().map(|k| k.key.clone()).collect::<Vec<_>>()
        };
        assert_eq!(keys(&big), ["/linux", "/ceph"]);
        assert_eq!(keys(&small), ["/sanity", "/fresh"], "never scanned counts as small");
    }

    fn queued(of: &[(&str, Option<usize>)]) -> Vec<crate::reports::KnownProject> {
        of.iter()
            .map(|(k, files)| crate::reports::KnownProject {
                key: (*k).into(),
                repo: (*k).into(),
                name: (*k).into(),
                touched: 0,
                files: *files,
                scan_ms: None,
                trace_depth: None,
                harness: None,
                model: None,
            })
            .collect()
    }

    /// **A click during a launch outlives the restore.** `restore` names the last session's
    /// project as `active` before any lane starts; a lane used to name it again when that
    /// project's scan landed, which on a big repo is minutes later — so somebody who had
    /// clicked another row in the meantime was pulled back to the old one.
    #[test]
    fn a_restore_lane_does_not_take_the_view_back() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        let state: Shared = Arc::new(Mutex::new(AppState::default()));
        lock(&state).active = Some("somewhere-else".into());
        let known = crate::reports::KnownProject {
            key: key.clone(),
            repo: dir.path().to_string_lossy().to_string(),
            name: "t".into(),
            touched: 0,
            files: None,
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        };
        drain(vec![known], &state, &|_, _| {}, &|_, _| {});
        let s = lock(&state);
        assert!(s.projects.contains_key(&key), "the lane landed the project");
        assert_eq!(s.active.as_deref(), Some("somewhere-else"), "and left the view where it was put");
    }

    /// **A launch and an open draw the tests a reader named, as the export does.**
    ///
    /// `survey` and `export-data` load the readings and then apply them with
    /// `links::retest_tree`. The app applied them only when a reading that answered the test
    /// question LANDED — so a window restored at launch, or opened by an agent, counted a
    /// reader's test as a dependent of everything it calls, and `under_test` said nothing
    /// reached it, until the next such reading arrived. Same repo, same `.sanity/`, two answers.
    ///
    /// Both real paths, not a helper standing in for them: `drain` is the restore's lane and
    /// `open_project` is the `/open` handler. The reference is the CLI's order, spelled out,
    /// and pinned to the numbers so it cannot agree with the app by both being wrong. C++ on
    /// purpose — no contract, so the reader is the only thing that can classify anything.
    #[tokio::test]
    async fn a_restored_or_opened_project_counts_a_readers_tests_as_the_export_does() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        let repo = std::fs::canonicalize(dir.path()).unwrap();
        let git = |args: &[&str]| {
            let out = std::process::Command::new("git")
                .arg("-C")
                .arg(&repo)
                .args(["-c", "user.email=t@example.com", "-c", "user.name=t"])
                .args(args)
                .output()
                .expect("git runs");
            assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
        };
        git(&["init", "-q"]);
        std::fs::write(
            repo.join("a.cc"),
            "void helper() { int x = 1; }\nvoid covers() { helper(); }\n",
        )
        .unwrap();
        git(&["add", "."]);
        git(&["commit", "-q", "-m", "first"]);

        let helper = |s: &Scan| -> (Option<u32>, Option<bool>) {
            let mut got = (None, None);
            s.root.visit(&mut |n| {
                if n.name == "helper" && n.kind == NodeKind::Func {
                    got = (n.dependents, n.under_test);
                }
            });
            got
        };

        let mut scan = crate::scan::scan(
            &repo,
            &|_| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::scancache::ScanCache::ephemeral(),
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )
        .unwrap();
        assert_eq!(helper(&scan), (None, None), "the parse alone cannot say");

        // A reader said `covers` is a test and `helper` is not, written to `.sanity/` the way
        // `report` writes them. Both, because a body nobody classified has no `dependents` to
        // report at all — see `Links::retest`.
        let mut readings = HashMap::new();
        scan.root.visit(&mut |n| {
            if (n.name == "covers" || n.name == "helper") && n.kind == NodeKind::Func {
                readings.insert(
                    n.id.clone(),
                    Report {
                        id: n.id.clone(),
                        body: n.body.clone().unwrap_or_default(),
                        // A shard entry with neither is dropped as malformed — see `parse_shard`.
                        expected: "a thing".into(),
                        found: "another thing".into(),
                        note: "a note".into(),
                        test: Some(n.name == "covers"),
                        ..Report::blank()
                    },
                );
            }
        });
        assert_eq!(readings.len(), 2, "both functions are in the fixture");
        crate::assessment::save(&repo, &scan, &readings).unwrap();

        // What `survey` and `export-data` do: load, then retest.
        let reports = crate::assessment::load(&repo, &scan);
        crate::links::retest_tree(&mut scan, &reports);
        let want = helper(&scan);
        assert_eq!(want, (Some(0), Some(true)), "a test calls it, and nothing that is not a test does");

        let key = project_key(&repo);
        let known = crate::reports::KnownProject {
            key: key.clone(),
            repo: repo.to_string_lossy().into_owned(),
            name: "t".into(),
            touched: 1,
            files: Some(1),
            scan_ms: None,
            trace_depth: None,
            harness: None,
            model: None,
        };
        crate::reports::save_index(&crate::reports::KnownProjects {
            active: None,
            explain_trace: None,
            order: Vec::new(),
            projects: vec![known.clone()],
        });

        // A launch.
        let restored: Shared = Default::default();
        drain(vec![known], &restored, &|_, _| {}, &|_, _| {});
        assert_eq!(
            helper(&lock(&restored).projects.get(&key).expect("restored").scan),
            want,
            "the restored window disagrees with the export about who depends on `helper`"
        );

        // An open.
        let opened: Shared = Default::default();
        let out = open_project(
            State(opened.clone()),
            Json(OpenRequest { path: Some(repo.to_string_lossy().into_owned()), ..Default::default() }),
        )
        .await
        .0;
        assert_eq!(out["ok"], true, "{out}");
        assert_eq!(
            helper(&lock(&opened).projects.get(&key).expect("opened").scan),
            want,
            "the opened window disagrees with the export about who depends on `helper`"
        );
    }
}
