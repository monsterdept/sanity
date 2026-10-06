//! The sidebar's rows: [`ProjectList`], built from the index and whatever is held.
//!
//! The index is the list; live state only decides how much a row can say. A loaded project
//! reports its counts, its run and the leases being read; one declined for cost, one the
//! restore has not reached, and one a reset left behind all know a name and a path and
//! nothing else, and say so with zeroes that are marked as unmeasured. The window polls this
//! every second, which is also how a rescan reaches the picture.

use super::coverage::{assessed, count_files, count_funcs, count_stale, unread_lines, Counts};
use super::queue::LEASE;
use super::tally::{model_tally, one_harness, one_model, recent_model};
use super::{lock, AppState, Event, ModelCount, Shared};
use serde::Serialize;
use std::collections::HashMap;
use std::time::Duration;

/// What the window needs to know about what is on offer.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ProjectList {
    pub active: Option<String>,
    pub projects: Vec<ProjectSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSummary {
    pub key: String,
    pub name: String,
    pub repo: String,
    pub functions: usize,
    /// Files that are their own reading — see [`count_files`]. Beside `functions` rather
    /// than folded into it, because the two are different things to say: "631 functions"
    /// is what the repo IS, and `functions + files` is how much there is to read. The
    /// sidebar divides by the sum; the header still names them separately.
    pub files: usize,
    /// Bumped whenever a scan lands — see `Project::scanned`.
    ///
    /// The window polls this list already, so a rescan reaches the picture without a second
    /// channel: the poll notices the number moved and refetches the tree. A Tauri event would
    /// be faster and would exist only in the windowed build, leaving `sanity serve` unable to
    /// do the one thing this is for.
    pub scanned: u64,
    /// Functions `.sanityignore` set aside. Shown beside `functions`, never folded into
    /// it — the sidebar's `81/377` is a claim about coverage, and a denominator that
    /// silently shrank is the same lie as a reading that outlived its code.
    pub excluded: usize,
    /// What the walk saw and did not scan — see [`crate::scan::Unscanned`].
    ///
    /// **`None` is "nobody has looked", not "nothing was dropped".** The rows for a project
    /// that has not been scanned zero every other count on the stated ground that a guess
    /// would be read as a measurement; an empty `Unscanned` is worse than a guess, because
    /// an empty list of gaps is a confident claim that there are none. So the absence is
    /// carried in the type rather than spelled as emptiness.
    pub unscanned: Option<crate::scan::Unscanned>,
    /// Functions and files too large for a reading to be taken over — see
    /// [`Node::unreadable`]. Out of the denominator like `excluded` and counted apart from
    /// it: the sidebar must not say a repo is fully read while holding work no run can
    /// reach, and it must not report a tool's limit as a choice somebody made.
    pub oversize: usize,
    /// Which agent reads this repo, as `sanity init` or the window recorded it.
    ///
    /// Machine-local — see `KnownProject::harness`. Which CLI is installed is a fact about
    /// this laptop, not about the repo.
    pub harness: Option<String>,
    /// Which model this repo is read by, as chosen here.
    pub model: Option<String>,
    /// Which model the readings already banked were taken by, when they agree.
    ///
    /// **The corpus is the authority on this, not a setting.** Never mixing models within
    /// one repo is the rule that keeps a map on one scale, and a stored preference cannot
    /// enforce it across two laptops — two people would each pick, and nothing on screen
    /// would say the wedges were measured differently. What the readings were actually
    /// taken by is a fact, it is already recorded per reading, and it survives being
    /// cloned. `None` when there are no readings, or when they already disagree — and
    /// disagreeing is itself worth showing rather than resolving.
    pub banked_model: Option<String>,
    /// The one agent this repo's readings were actually taken by — see [`one_harness`].
    /// Outranks the machine-local preference for the same reason `banked_model` does: it
    /// is a fact that travels with the repo rather than a setting on one laptop.
    pub banked_harness: Option<String>,
    /// Every model in the corpus with its share — see [`model_tally`]. One entry is the
    /// ordinary case; more than one is a repo already on two scales, and the dialog says so.
    pub banked_models: Vec<ModelCount>,
    /// The model of the newest dated reading — see [`recent_model`]. What a mixed corpus
    /// offers in place of a banked model.
    pub recent_model: Option<String>,
    /// The wave in progress, if any — see [`Run`].
    pub run: Option<serde_json::Value>,
    /// The last few functions out and back, oldest first — see [`Event`].
    pub events: Vec<Event>,
    /// Node ids currently out with a reader, so the map can show where the work is.
    ///
    /// **The panel used to list function names and this replaces them.** A list of four
    /// names in the narrowest column in the app is a progress indicator you have to read,
    /// scrolling past faster than anybody can, and it says nothing about WHERE the work is
    /// — which is the one thing this app draws. On the map the same fact is a glance: the
    /// wedges being read pulse, and a run becomes visibly a sweep across the repo.
    ///
    /// Node ids, uniquely among everything durable here, and that is safe precisely because
    /// this is not durable: it is a frame of the poll, matched against a tree from the same
    /// process and thrown away. The `key_of` rule exists because ids embed `@line` and a
    /// stored one orphans the moment somebody adds an import; nothing is stored here.
    ///
    /// Leases whose reading has already landed are dropped rather than left to expire, or a
    /// finished function would go on pulsing for the rest of its lease.
    pub reading: Vec<String>,
    /// Functions with a reading that still describes them.
    ///
    /// Stale readings are excluded rather than counted, so `assessed / functions` means
    /// "how much of this repo is currently understood" and not "how much was understood
    /// at some point". The same choice `collect_tasks` makes — a repo cannot be finished
    /// and have expired readings in it.
    pub assessed: usize,
    /// Lines of code in the functions still outstanding — see [`unread_lines`].
    pub unread_lines: usize,
    /// Commits reachable from HEAD, as the scan counted them. 0 for a repo with no history.
    ///
    /// Beside the reading numbers because the sidebar now says both: a project has a repo to
    /// READ and a story to REPLAY, they are worked separately, and a row that reports only
    /// the first leaves the second discoverable only by turning a mode on and waiting.
    pub commits: usize,
    /// Commits already replayed and stored — see [`crate::history::banked`]. The difference
    /// is what a replay has left to do.
    pub replayed: usize,
    /// Where this repo's trace has got to, when one is running — see [`crate::history::tracing`].
    ///
    /// **The window used to be the only thing that knew, which meant a reload made a running
    /// walk invisible.** The row went back to offering `Trace` over a repo with ten cores
    /// already on it, the count beside the button froze at whatever it was when the run
    /// started, and pressing it would have started a second walk. The walk is the backend's,
    /// so its progress is reported the same way `run` is: from the process doing the work, on
    /// the list the sidebar already polls, so any window — reloaded, second, or opened an hour
    /// later — sees the same thing.
    pub tracing: Option<crate::scan::Progress>,
    /// How much of this repo's history the MAP holds — see `trace::Depth`.
    ///
    /// Depth 3 is the replay above; this is the two below it. `untraced` means the wedges carry
    /// no age, churn or author at all, which is a different sentence from "this folder has no
    /// git history" and has to reach the window as one.
    pub trace_depth: crate::trace::Depth,
    /// What reading more of it would cost, when that is more than a budget will spend unasked.
    ///
    /// `None` means nothing is waiting — either it fits and has been done, or it is running.
    /// Present means the map is deliberately incomplete and somebody has to say go.
    pub trace_cost: Option<crate::trace::Estimate>,
    /// Where a running trace has got to, from the process doing it. Null when none is.
    pub tracing_history: Option<crate::scan::Progress>,
    /// Files with per-line history, and how many the trace was asked to resolve.
    ///
    /// **Both numbers, from the same place.** The row used to divide `resolved` by the file
    /// count reported beside it, and the two are counted differently — `files` is what a reader
    /// could be handed, `resolvable` is every file node the trace walked — so the fraction
    /// never reached one and the pill went on offering work that was done. Two fields that are
    /// always set together cannot drift the way two definitions of one number can.
    pub resolved: usize,
    pub resolvable: usize,
    /// The repo has moved and rescanning it is over budget — see `Project::behind`.
    pub behind: bool,
    /// What a scan of this repo would cost, when nobody has been asked yet.
    ///
    /// Present ONLY for a repo whose scan was declined: there is no tree, every count below is
    /// zero because nothing has been measured, and this is what the row offers instead. Not to
    /// be confused with `trace_cost`, which is about a repo that HAS a map.
    pub scan_cost: Option<crate::scan::Estimate>,
    pub stale: usize,
    pub touched: u64,
    /// An agent has called about this project recently. Per project, so two sessions
    /// working two repos both report as working rather than one of them winning.
    pub working: bool,
    /// Known from the index but not yet rescanned, so its counts are not measured yet.
    ///
    /// A restore rescans rather than storing trees, and a large repo takes tens of
    /// seconds — tonepoet is 34. The name and path were on disk the whole time, so a
    /// sidebar that shows nothing until the scan lands is withholding what it already
    /// knows and reading as "your projects are gone". These entries carry real names and
    /// zeroed counts, and the flag is what stops a zero being read as a measurement.
    pub loading: bool,
    /// This app is not holding a scan for the project, and nothing is on its way either.
    ///
    /// **A third state, and it has to be stated rather than inferred from the other two.**
    /// The window read "scanned" as neither declined nor loading, which is true of every row
    /// that has been scanned and also of the one a reset leaves behind — so that row ticked
    /// its Scan pill over `0 functions in 0 files`, reported `no git history here` about a
    /// repo nobody had walked, and offered to read nothing. Every count on a row like this is
    /// a zero standing for "not measured", the same as behind `loading`, and this is what
    /// stops one being read as a measurement.
    ///
    /// True for all three of the not-held cases — reset, waiting on the restore, declined for
    /// cost — because it says what the app is holding and not why. See `unloaded`, which
    /// builds the row, and `AppState::unload`, which is how a project gets here on purpose.
    #[serde(default)]
    pub unloaded: bool,
    /// How far that rescan has got, when it has started counting. Both zero means the walk
    /// is still under way and there is no denominator yet — which is a real state, not a
    /// zero-percent one, and the UI shows it as such.
    pub read_done: usize,
    pub read_total: usize,
    /// What the scan is doing — see `scan::Progress::phase`. A scan names its phases whether
    /// or not it can count them, because a bar that runs two phases end to end at very
    /// different speeds reads as a hang at the join unless the join is on screen.
    #[serde(default)]
    pub read_phase: String,
    /// What `read_done` and `read_total` are counting — see `scan::Progress::unit`.
    #[serde(default)]
    pub read_unit: String,
}

/// One row for a project the app knows of and is not holding a scan for.
///
/// **Three lists render this same row and they were three copies of it.** A scan declined
/// for cost, a project the restore has not reached, and — the case that has no list —
/// one whose live state has been dropped by a reset. All three know a name, a path and
/// nothing else, and the whole of what separates them is whether something is happening
/// (`loading`) and whether there is a price to print (`scan_cost`), so those are what a
/// caller overrides and everything else is settled here.
///
/// Every count is zero and every reading is empty, which is the rule the counts follow
/// everywhere: the walk has not run, so there is no denominator, and a guess in one of
/// these fields is read as a measurement. The configured harness and model DO come
/// through — they are the index's own, not the scan's, and a repo does not forget who
/// reads it because nothing is loaded.
fn unloaded(known: &crate::reports::KnownProject) -> ProjectSummary {
    ProjectSummary {
        key: known.key.clone(),
        name: known.name.clone(),
        repo: known.repo.clone(),
        functions: 0,
        files: 0,
        // Not walked yet, so there is no tally — see the field.
        unscanned: None,
        // Nothing has been scanned, so there is no revision to report. The window reads a
        // change in this as "refetch"; starting at zero means the first real scan is a
        // change from it.
        scanned: 0,
        excluded: 0,
        oversize: 0,
        harness: known.harness.clone(),
        model: known.model.clone(),
        // Nothing has been read back yet, so the corpus cannot speak. Zero guesses here,
        // same as the counts above.
        banked_model: None,
        banked_harness: None,
        banked_models: Vec::new(),
        recent_model: None,
        run: None,
        events: Vec::new(),
        assessed: 0,
        unread_lines: 0,
        commits: 0,
        replayed: 0,
        tracing: None,
        // Nothing scanned, so nothing traced and no bank to price the next one from — the
        // same rule as the counts above.
        trace_depth: crate::trace::Depth::Untraced,
        trace_cost: None,
        tracing_history: None,
        resolved: 0,
        resolvable: 0,
        behind: false,
        scan_cost: None,
        reading: Vec::new(),
        stale: 0,
        touched: known.touched,
        working: false,
        loading: false,
        // What the row IS. Every zero above stands for "not measured" and this is the field
        // that says so — see `ProjectSummary::unloaded`.
        unloaded: true,
        read_done: 0,
        read_total: 0,
        read_phase: String::new(),
        read_unit: String::new(),
    }
}

impl ProjectList {
    pub fn from_state(state: &AppState) -> ProjectList {
        // Read once for the whole list, not once per project: this is polled every second
        // and a the-index-per-row version would open the same file a dozen times a tick.
        let index = crate::reports::load_index();
        let harnesses: HashMap<String, String> = index
            .projects
            .iter()
            .filter_map(|k| k.harness.clone().map(|h| (k.key.clone(), h)))
            .collect();
        let models: HashMap<String, String> = index
            .projects
            .iter()
            .filter_map(|k| k.model.clone().map(|m| (k.key.clone(), m)))
            .collect();
        let mut projects: Vec<ProjectSummary> = state
            .projects
            .iter()
            .map(|(key, p)| {
                let stale = count_stale(&p.scan, &p.reports);
                let Counts { kept: functions, excluded, oversize } = count_funcs(&p.scan);
                let files = count_files(&p.scan).kept;
                ProjectSummary {
                    unscanned: Some(p.scan.stats.unscanned.clone()),
                    trace_depth: p.trace.depth,
                    trace_cost: p.trace.pending.clone(),
                    tracing_history: p.trace.running.clone(),
                    resolved: p.trace.resolved.0,
                    resolvable: p.trace.resolved.1,
                    behind: p.behind,
                    // A project with a tree has been scanned; what it would cost to do again
                    // is not a question the row asks. See the field.
                    scan_cost: None,
                    // Sixty seconds: a reader predicting, opening a
                    // file and writing a report goes quiet for tens of seconds inside one
                    // continuous batch, and a shorter window makes it flicker.
                    // And not counting this run's own death rattle. A stopped reader is
                    // killed mid-call, so its last MCP calls sit inside the window above
                    // with nothing behind them — see `Run::ended_at`. Chatter AFTER the run
                    // ended is real work (a hand-driven session on the same repo) and still
                    // counts, which is why this compares times rather than simply muting a
                    // project that has ever had a run.
                    working: p.last_agent.is_some_and(|t| {
                        t.elapsed() < Duration::from_secs(60)
                            && p.run
                                .as_ref()
                                .and_then(|r| r.ended_at)
                                .is_none_or(|end| t > end)
                    }),
                    key: key.clone(),
                    name: p.name.clone(),
                    repo: p.repo.to_string_lossy().to_string(),
                    functions,
                    files,
                    scanned: p.scanned,
                    excluded,
                    oversize,
                    harness: harnesses.get(key).cloned(),
                    model: models.get(key).cloned(),
                    banked_harness: one_harness(&p.reports),
                    banked_model: one_model(&p.reports),
                    banked_models: model_tally(&p.reports),
                    recent_model: recent_model(p),
                    run: p.run.as_ref().map(|r| serde_json::json!({
                        "from": r.from,
                        "harness": r.harness,
                        "model": r.model,
                        "readers": r.width,
                        "spawned": r.spawned,
                        "finished": r.finished,
                        "failed": r.failed,
                        "running": r.ended.is_none(),
                        // See the same field in `/status`: pressing Stop has to be visible
                        // before the readers have actually died.
                        "stopping": r.ended.is_none() && r.stop.load(std::sync::atomic::Ordering::Relaxed),
                        "live": r.live.load(std::sync::atomic::Ordering::Relaxed),
                        "ended": r.ended,
                        "failures": r.failures,
                    })),
                    events: p.events.iter().cloned().collect(),
                    // The same walk `assessed` does, and for the reason written there:
                    // `reports.len() - stale` counts readings whose function was deleted.
                    assessed: assessed(&p.scan, &p.reports),
                    unread_lines: unread_lines(p),
                    commits: p.scan.stats.commits,
                    // Read from a four-byte sidecar rather than from the timeline itself,
                    // which on a large repo is hundreds of megabytes — see `history::banked`.
                    replayed: crate::history::banked(&p.repo, crate::history::ALL_COMMITS),
                    tracing: crate::history::tracing(&p.repo),
                    reading: p
                        .leased
                        .iter()
                        .filter(|(id, at)| {
                            at.elapsed() < LEASE && !p.reports.contains_key(*id)
                        })
                        .map(|(id, _)| id.clone())
                        .collect(),
                    stale,
                    touched: p.touched,
                    loading: false,
                    // Held, with a tree behind every count above.
                    unloaded: false,
                    read_done: 0,
                    read_total: 0,
                    read_phase: String::new(),
                    read_unit: String::new(),
                }
            })
            .collect();
        // **Projects whose scan was declined for cost.** Listed from the index like the
        // restoring rows below, and for the same reason — the name and path are known and the
        // counts are not — but with `loading: false`, because nothing is happening and
        // nothing is going to until somebody says so. The estimate rides along as the only
        // number the row can honestly print.
        projects.extend(
            state
                .awaiting
                .iter()
                // Against BOTH lists, not just the loaded one. Three sources feed this vector
                // — loaded, declined, pending — and any two of them naming one key is that
                // project on screen twice. `scan_repo` clears the declined entry when a scan
                // starts, and this is the guard behind that rather than the message: a row
                // that has appeared twice is not something to explain, it is something not to
                // do.
                .filter(|(key, _)| {
                    !state.projects.contains_key(*key)
                        && !state.restoring.iter().any(|k| &k.key == *key)
                })
                .filter_map(|(key, cost)| {
                    let known =
                        crate::reports::load_index().projects.into_iter().find(|k| &k.key == key)?;
                    Some(ProjectSummary {
                        // The estimate rides along as the only number this row can honestly
                        // print, and it is the whole of what makes it a DECLINED row rather
                        // than an unloaded one. **Not loading**: a declined scan is a standing
                        // state, not a wait — the row that says "loading" forever is the
                        // failure that flag exists to prevent, wearing the opposite face.
                        scan_cost: Some(cost.clone()),
                        ..unloaded(&known)
                    })
                }),
        );
        // Projects the restore knows about but has not reached yet. Listed from the index,
        // which holds the name and path — everything the sidebar needs to show a row — and
        // nothing it does not, so the counts stay zero behind `loading` rather than being
        // guessed. Skipped once the real project lands, so a row never appears twice.
        projects.extend(
            state.restoring.iter().filter(|known| !state.projects.contains_key(&known.key)).map(
                |known| {
                    let progress = state
                        .restoring_progress
                        .get(&known.key)
                        .cloned()
                        .unwrap_or_else(|| crate::scan::Progress::at(0, 0));
                    ProjectSummary {
                        // The one thing this row has that an unloaded one does not: something
                        // is happening, and how far it has got. Both zero means the walk is
                        // under way with no denominator yet, which is a real state rather than
                        // a zero-percent one.
                        loading: true,
                        read_done: progress.done,
                        read_total: progress.total,
                        read_phase: progress.phase,
                        read_unit: progress.unit,
                        ..unloaded(known)
                    }
                },
            ),
        );
        // **Everything else the index knows, which is the list nothing else was keeping.**
        //
        // The three sources above are all live state, and a project can be in the index and
        // in none of them. Reset is how you get there on purpose: it deletes every cache and
        // calls `unload`, whose own doc says the row has to stay because the point is to scan
        // it again — and the row went anyway, because nothing listed a project the app was
        // not holding. Pressing Reset removed the project from the sidebar, which is Remove,
        // which is the other menu item.
        //
        // So the rule is that **the index is the list**, and live state only decides how much
        // a row can say. `forget` is what takes a row out, and it does it by taking the entry
        // out of the index; anything still in there is still yours. That also catches the
        // rows the restore settles without loading — a repo on a volume that is not mounted
        // stops being pending, and `drain` says so, but it does not stop being a project.
        //
        // Zeroed and not loading, like the two above it: a row that cannot say what is in the
        // repo says nothing about it, and its Scan pill is the offer to find out.
        {
            let held = |key: &str| {
                state.projects.contains_key(key)
                    || state.awaiting.contains_key(key)
                    || state.restoring.iter().any(|k| k.key == key)
            };
            projects.extend(
                index.projects.iter().filter(|known| !held(&known.key)).map(unloaded),
            );
        }
        // Most recently touched first, unless somebody has arranged the list — see
        // `KnownProjects::order`. Arranged rows come first in the order they were put in;
        // anything the arrangement has never heard of (a project added since) sorts above
        // them by recency, because a repo you just opened belongs where you will look first.
        let order = &state.order;
        projects.sort_by_key(|p| {
            let at = order.iter().position(|k| *k == p.key);
            (at.is_some(), at.unwrap_or(0), std::cmp::Reverse(p.touched))
        });
        ProjectList { active: state.active.clone(), projects }
    }
}

/// Put the sidebar in this order and remember it. Keys, oldest arrangement first.
pub fn set_order(state: &Shared, keys: Vec<String>) {
    let mut s = lock(state);
    s.order = keys;
    s.persist();
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::{data_home, project_of};
    use crate::agentapi::project_key;

    /// A project added but never scanned still survives a quit.
    ///
    /// It reached the index only through `touch`, which runs when the scan RETURNS — right
    /// for a repo scanned in a second, and a loss for one that is not. linux takes hours on
    /// its first pass, so every quit before it finished dropped the project outright: the row
    /// vanished, and it had to be added again, to scan again from the beginning. The
    /// leftovers name the shape of it — `active` and `order` still pointed at a repo that
    /// `projects` no longer listed, because those two are written from the session while the
    /// list was written from what had loaded.
    #[test]
    fn a_project_added_but_not_yet_scanned_is_in_the_index() {
        let _data = data_home();
        crate::reports::remember("/big", "/big", "big");
        let saved = crate::reports::load_index();
        assert_eq!(saved.projects.len(), 1, "an added project is on disk before its scan lands");
        assert_eq!(saved.projects[0].key, "/big");

        // Re-adding must not reset what somebody configured for it: `remember` runs on every
        // add, and an add of a project that is already there is the normal case.
        crate::reports::set_reader("/big", "/big", "big", Some("agy"), Some("sonnet"));
        crate::reports::remember("/big", "/big", "big");
        let again = crate::reports::load_index();
        assert_eq!(again.projects.len(), 1, "the same project is not doubled");
        assert_eq!(again.projects[0].harness.as_deref(), Some("agy"), "the harness survived");
        assert_eq!(again.projects[0].model.as_deref(), Some("sonnet"), "the model survived");
    }

    /// One project is one row, whichever lists it is on.
    ///
    /// **The sidebar is fed by three of them** — loaded, declined for cost, and pending a scan
    /// — and any two naming the same key put that repo on screen twice under one name. It
    /// happened the moment the third was added: pressing `Scan` on a repo whose scan was over
    /// budget starts a pending scan without clearing the declined entry, so kibana appeared
    /// beside itself.
    #[test]
    fn a_project_on_two_lists_is_still_one_row() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
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

        // **In the index, or the declined row cannot exist.** It is built from the name and
        // path on disk — a repo the index has never heard of has no row to draw — so a test
        // that skips this asserts against a list the bug cannot reach, and passes whether the
        // guard is there or not. It did.
        crate::reports::remember(&key, &known.repo, "t");

        let mut state = AppState::default();
        state.awaiting.insert(key.clone(), crate::scan::estimate(Some(90_000), Some(90_000)));
        state.restoring.push(known.clone());
        assert_eq!(
            ProjectList::from_state(&state).projects.iter().filter(|p| p.key == key).count(),
            1,
            "declined and pending is one repo in two states, not two repos"
        );

        // And once it has actually loaded, neither of the other two may add a second.
        state.projects.insert(key.clone(), project_of(dir.path()));
        assert_eq!(
            ProjectList::from_state(&state).projects.iter().filter(|p| p.key == key).count(),
            1,
            "a loaded project is listed once however it got there"
        );
    }

    /// **Remove takes the caches with the row, and it used to leave them.**
    ///
    /// Nothing points at a removed project: it is out of the index, so no launch restores it
    /// and no sweep knows what its files were for. They sat under Application Support until
    /// `sweep_slots` aged them out thirty days later — a repo taken out of the sidebar still
    /// costing what it cost while it was in it. It also crossed the two verbs against their
    /// own names, Reset deleting the data and keeping the row while Remove did the opposite.
    ///
    /// Asserted on a slot per KIND, because the deletion walks a directory apiece and a test
    /// that writes one file proves only that the first one is walked.
    #[test]
    fn removing_a_project_takes_what_was_derived_from_it() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        crate::reports::remember(&key, &dir.path().to_string_lossy(), "t");

        // One cache slot per kind, as a scan and a trace of this repo would have left.
        let slots: Vec<std::path::PathBuf> = ["trees", "scans", "traces", "timelines", "edits"]
            .iter()
            .map(|kind| {
                let at = crate::reports::cache_slot(kind, dir.path(), "p1").expect("a slot");
                std::fs::write(&at, b"derived").expect("writes");
                at
            })
            .collect();
        // And one belonging to another repo, which must survive: the deletion is by this
        // repo's hash, and a sweep of the whole directory would take the neighbour too.
        let other = tempfile::tempdir().unwrap();
        let spared = crate::reports::cache_slot("trees", other.path(), "p1").expect("a slot");
        std::fs::write(&spared, b"someone else's").expect("writes");

        let mut state = AppState::default();
        state.projects.insert(key.clone(), project_of(dir.path()));
        state.forget(&key);

        assert!(
            ProjectList::from_state(&state).projects.is_empty(),
            "Remove takes the row — that half always worked"
        );
        for at in &slots {
            assert!(!at.exists(), "{} outlived the project it was derived from", at.display());
        }
        assert!(spared.exists(), "another repo's cache was taken along with this one's");
        // The repo itself is not this app's to delete, and neither is anything in it.
        assert!(dir.path().join("a.rs").exists(), "the repo is not ours to touch");
    }

    /// **Reset is not Remove, and the difference is one row on screen.**
    ///
    /// Reset deletes every cache this app derived for a repo and calls `unload`, which drops
    /// the live project and leaves the index entry alone — its own doc says the row has to
    /// stay, because the point of a reset is to do the work again. The row went anyway: the
    /// list was built from live state alone, so a project the app was not holding was a
    /// project nobody listed, and the menu item read as a gentler-sounding Remove.
    ///
    /// Asserted on the state `reset_project` leaves behind rather than by calling it, which
    /// wants a Tauri handle: the caches are gone, the index entry stands, nothing is loaded.
    #[test]
    fn a_reset_leaves_a_row_to_scan_again() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("a.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        let key = project_key(dir.path());
        crate::reports::remember(&key, &dir.path().to_string_lossy(), "t");

        let mut state = AppState::default();
        state.projects.insert(key.clone(), project_of(dir.path()));
        state.active = Some(key.clone());
        assert_eq!(ProjectList::from_state(&state).projects.len(), 1, "loaded, and listed");

        state.unload(&key);
        let after = ProjectList::from_state(&state);
        assert_eq!(after.projects.len(), 1, "the row a reset is supposed to leave behind");
        let row = &after.projects[0];
        assert_eq!(row.key, key);
        assert_eq!(row.name, "t", "named from the index, which is what still knows it");
        // Not pending anything. A reset is a standing state — nothing is happening until
        // somebody presses Scan — and a row that says `loading` with nothing loading is the
        // failure that flag exists to prevent.
        assert!(!row.loading, "nothing is running, so nothing may claim to be");
        assert_eq!(row.functions, 0, "and it counts nothing, because it has walked nothing");
        assert_eq!(row.trace_depth, crate::trace::Depth::Untraced);
    }
}
