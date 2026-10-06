//! The counts: how much is read, stale, remaining, set aside, or too large to read.
//!
//! Every number here walks the SCAN and looks up its reading, never the other way round, so
//! a reading whose code is gone is history rather than coverage, and `.sanityignore` and the
//! read ceiling are honoured the same way the queue honours them. The release gate asks its
//! question through the same definitions ([`verify`]), and so does a CLI with no backend to
//! ask ([`offline_counts`]).

use super::tasks::collect_tasks;
use super::queue::LEASE;
use super::{Project, Report};
use crate::model::{Node, NodeKind};
use crate::scan::Scan;
use std::collections::HashMap;

/// How much work is genuinely left, and how much of it is available this second.
///
/// These are two different numbers and conflating them was a reporting bug with teeth.
/// `remaining` used to come from the lease-filtered queue, so a function currently held
/// by a reader counted as done — the tool reported `done: true` with "every function has
/// an up-to-date reading" while 34 were still out on lease and unassessed. An instrument
/// that overstates its own coverage is worse than one that measures nothing, because the
/// number looks finished.
///
/// So `remaining` ignores leases entirely: it is unread-or-stale, full stop, and it only
/// falls when a reading actually lands. `in_flight` is what leases explain, and it is the
/// difference between "keep going" and "wait".
/// `outstanding` itemises `in_flight` — which functions, and how long they have been out.
/// A bare count says readers are working; it cannot distinguish that from a wave that died
/// twenty minutes ago and left its batch to rot until the lease expires. The orchestrator
/// polling between waves is the only party that can act on the difference, and it is the
/// one already calling this.
///
/// **Ids and ages, never the task payload.** A reader that fetched a function may already
/// have opened the file, so re-delivering the body would let it "predict" code it has read
/// — recall wearing a prediction's clothes, which grades as unsurprising and turns the
/// wedge green on a reading nobody made. A dropped function is re-queued for somebody
/// else, and never handed back to whoever dropped it.
pub(super) struct WorkLeft {
    pub(super) remaining: usize,
    pub(super) in_flight: usize,
    /// Oldest lease first — that is the end worth looking at, because age is the whole
    /// signal. Ids only.
    pub(super) outstanding: Vec<(String, u64)>,
}

pub(super) fn work_left(project: &Project) -> WorkLeft {
    let none = HashMap::new();
    let mut unread = Vec::new();
    collect_tasks(
        &project.scan.root,
        &project.reports,
        &none,
        None,
        &crate::scan::declared_from_scan(&project.repo, &project.scan.root),
        &mut unread,
    );
    // A lease only counts as in flight while it covers work that is still outstanding: a
    // lease over a function whose reading has since landed explains nothing, and one past
    // LEASE has already returned to the pool.
    let mut outstanding: Vec<(String, u64)> = unread
        .iter()
        .filter_map(|(_, t)| {
            let held = project.leased.get(&t.id)?;
            let age = held.elapsed();
            (age < LEASE).then(|| (t.id.clone(), age.as_secs()))
        })
        .collect();
    outstanding.sort_by_key(|(_, age)| std::cmp::Reverse(*age));
    WorkLeft { remaining: unread.len(), in_flight: outstanding.len(), outstanding }
}

/// Every unit of work in a scan — function or file header — skipping what `.sanityignore`
/// set aside.
///
/// **Exclusion is inherited, so it cannot be tested per node.** `Node::excluded` is set on
/// the FILE a pattern matched, and its functions are out of scope with it — which is why
/// `collect_tasks` and `count_funcs` both carry the flag down as they walk. `visit` does
/// not, so anything using it counted work the queue would never hand out: `assessed` and
/// `count_stale` did, while `functions` and `remaining` did not, and on a repo with a
/// `.sanityignore` the four numbers stopped adding up. A coverage line reading `100 of 90`
/// is the visible end of it; "unread minus stale" going negative is the other.
pub(super) fn each_unit(scan: &Scan, f: &mut impl FnMut(&Node)) {
    fn walk(node: &Node, out_of_scope: bool, f: &mut impl FnMut(&Node)) {
        let out_of_scope = out_of_scope || node.excluded;
        if matches!(node.kind, NodeKind::Func | NodeKind::File) && !out_of_scope {
            f(node);
        }
        for c in &node.children {
            walk(c, out_of_scope, f);
        }
    }
    walk(&scan.root, false, f);
}

/// Readings whose code has changed under them.
///
/// Reported separately from "unread" everywhere it is surfaced, because they are
/// different situations for the person reading the number: unread is work never done,
/// stale is work that has quietly stopped being true.
pub(super) fn count_stale(scan: &Scan, reports: &HashMap<String, Report>) -> usize {
    let mut n = 0;
    // Files as well as functions: both are handed out, both are reported, and both expire.
    // Counting only functions left an expired FILE reading in the numerator — `assessed`
    // subtracts this from `reports.len()`, which holds every kind.
    each_unit(scan, &mut |node| {
        if let Some(r) = reports.get(&node.id) {
            if crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
                n += 1;
            }
        }
    });
    n
}

/// Things in the scan whose reading still describes them.
///
/// Counted from the SCAN, not from the reports, and that is the whole of it. `reports.len()`
/// is not this number and neither is `reports.len() - stale`, which is what it used to be:
/// `count_stale` walks the scan to find expired readings, so a reading whose function was
/// DELETED is never stale — nothing walks past it — and it sat in the total forever. A repo
/// that removed code could report `assessed` above its own function count, and this one did:
/// `/status` said 241 while `sanity_summary`, which counts differently, said 217 a minute
/// later, after an afternoon of deleting and renaming.
///
/// Walking the live side fixes both halves at once. A deleted function has no node to be
/// found from, so its orphaned reading cannot be counted; a moved one fails `is_stale`
/// against its own node. It is the same direction `save` takes for the same reason — iterate
/// what exists, look up its reading — and the same rule the queue follows: a reading whose
/// body has moved is history, not coverage. An instrument that overstates its own coverage
/// is worse than one that measures nothing.
pub(super) fn assessed(scan: &Scan, reports: &HashMap<String, Report>) -> usize {
    let mut n = 0;
    each_unit(scan, &mut |node| {
        if let Some(r) = reports.get(&node.id) {
            if !crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
                n += 1;
            }
        }
    });
    n
}

/// The counts `/status` reports, computed from a scan and a store with no `Project` around.
///
/// **For the CLI answering without a backend.** Everything here is derivable from what is
/// on disk, so refusing to answer when no daemon happens to be running made `sanity status`
/// the one verb that needed the app open to describe a repo it can read. Kept beside the
/// live definitions rather than reimplemented in `cli/status.rs`: `assessed` excluding stale, and
/// `remaining` coming from the queue rather than from subtraction, are decisions this repo
/// has made twice and would drift on a third time.
pub struct OfflineCounts {
    pub functions: usize,
    pub files: usize,
    pub excluded: usize,
    /// Units past [`READ_CEILING`] — see [`Counts::oversize`]. Its own number beside
    /// `excluded`, because a reader limit and somebody's `.sanityignore` are opposite
    /// reasons for the same absence and only one of them is anybody's decision.
    pub oversize: usize,
    pub assessed: usize,
    pub remaining: usize,
    pub stale: usize,
}

pub fn offline_counts(scan: &Scan, reports: &HashMap<String, Report>) -> OfflineCounts {
    let Counts { kept: functions, excluded, oversize } = count_funcs(scan);
    let mut unread = Vec::new();
    // Counting only, and the declarations decide nothing but the `ask` sentence a task
    // carries — which nothing here reads. Passing the default rather than reading two files
    // per call to reach the same count.
    collect_tasks(&scan.root, reports, &HashMap::new(), None, &Default::default(), &mut unread);
    OfflineCounts {
        functions,
        oversize,
        // Beside `functions`, never folded into it — see `count_files`. A file with
        // declarations is its own reading, so it is in `assessed` and in `remaining`, and a
        // denominator that leaves it out reports more read than there is to read.
        files: count_files(scan).kept,
        excluded,
        assessed: assessed(scan, reports),
        remaining: unread.len(),
        stale: count_stale(scan, reports),
    }
}

/// Why a unit stops a verification: the three bands `collect_tasks` queues, worst first.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Owed {
    /// The reading describes a body that is no longer there.
    Stale,
    /// There is no reading at all.
    Unread,
    /// The reading describes this body, but a graded question has moved since — see `SPEC`.
    Dated,
}

/// One unit a verification refused on, located well enough to annotate.
pub struct Outstanding {
    pub owed: Owed,
    pub path: String,
    pub line: u32,
    pub name: String,
}

/// One instrument over the current readings: which agent, which model, how many readings.
///
/// Empty strings are kept as themselves rather than folded into a neighbor. A reading with
/// no harness was taken outside a run Sanity started, and one with no model never said what
/// read it; neither can be vouched for as the same instrument as anything else.
#[derive(Debug, PartialEq, Eq)]
pub struct Instrument {
    pub harness: String,
    pub model: String,
    pub readings: usize,
}

/// What `sanity verify` rules on: every unit `sanity check` would still hand to a reader, and
/// every instrument the current readings were taken with.
///
/// **"Complete and current" is defined as "the queue is empty", not re-derived.** The queue is
/// `collect_tasks`, the one definition of what is owed — stale, unread, dated, and none of what
/// `.sanityignore` or the read ceiling take out of scope. A second definition here would be a
/// gate that passes a repo `sanity check` still has work in, or fails one it has none in.
///
/// **Current to HEAD is the body hash, not the commit stamp.** A reading records the commit it
/// was taken at, but a commit that only touched other files leaves it describing exactly the
/// code at HEAD; comparing `commit` against HEAD would fail every release cut one commit after
/// the reading pass. `is_stale` compares against the body as it stands, which is the question.
///
/// Instruments are tallied over current readings of live units only. An orphan describes code
/// that is gone, and a stale reading is already a failure of its own; counting either would
/// fail the agent check for work the other two checks already refuse.
pub struct Verification {
    pub outstanding: Vec<Outstanding>,
    pub instruments: Vec<Instrument>,
}

pub fn verify(scan: &Scan, reports: &HashMap<String, Report>) -> Verification {
    let mut queued = Vec::new();
    collect_tasks(&scan.root, reports, &HashMap::new(), None, &Default::default(), &mut queued);
    let queued: std::collections::HashSet<String> =
        queued.into_iter().map(|(_, t)| t.id).collect();
    let mut outstanding = Vec::new();
    let mut counts: HashMap<(String, String), usize> = HashMap::new();
    each_unit(scan, &mut |node| {
        let reading = reports.get(&node.id);
        let stale =
            reading.is_some_and(|r| crate::assessment::is_stale(r, node.body.as_deref(), node.bytes));
        if queued.contains(&node.id) {
            // Queued while holding a current reading can only mean a dated axis.
            let owed = match reading {
                None => Owed::Unread,
                Some(_) if stale => Owed::Stale,
                Some(_) => Owed::Dated,
            };
            let file = node.kind == NodeKind::File;
            outstanding.push(Outstanding {
                owed,
                path: node.path.clone(),
                line: if file { 1 } else { node.line.unwrap_or(1) },
                name: if file { "the file itself".into() } else { node.name.clone() },
            });
        }
        if let Some(r) = reading.filter(|_| !stale) {
            *counts.entry((r.harness.trim().to_string(), r.model.trim().to_string())).or_default() += 1;
        }
    });
    outstanding.sort_by(|a, b| a.path.cmp(&b.path).then(a.line.cmp(&b.line)));
    let mut instruments: Vec<Instrument> = counts
        .into_iter()
        .map(|((harness, model), readings)| Instrument { harness, model, readings })
        .collect();
    instruments.sort_by(|a, b| {
        b.readings.cmp(&a.readings).then_with(|| (&a.harness, &a.model).cmp(&(&b.harness, &b.model)))
    });
    Verification { outstanding, instruments }
}

/// Lines of code sitting in functions that still need reading.
///
/// **The size of the job in the unit the code is written in.** A function count answers
/// "how many things", and a token estimate answers "what will this cost", but neither says
/// how much CODE is involved — and that is the figure somebody already has a feel for,
/// because it is the one the map is drawn in. Width is lines.
///
/// Functions only. A file reading grades the file's header rather than its body, so adding
/// a file's `loc` would count every one of its functions a second time and roughly double
/// the estimate — the same double-count the `functions`/`files` split exists to avoid.
///
/// Stale readings count as outstanding, exactly as [`assessed`] excludes them: the work is
/// there to be done again.
pub(super) fn unread_lines(project: &Project) -> usize {
    let mut n = 0;
    fn walk(node: &Node, out_of_scope: bool, project: &Project, n: &mut usize) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::Func {
            if out_of_scope {
                return;
            }
            let read = project
                .reports
                .get(&node.id)
                .is_some_and(|r| !crate::assessment::is_stale(r, node.body.as_deref(), node.bytes));
            if !read {
                *n += node.loc as usize;
            }
            return;
        }
        for c in &node.children {
            walk(c, out_of_scope, project, n);
        }
    }
    walk(&project.scan.root, false, project, &mut n);
    n
}

/// Functions in scope, and functions `.sanityignore` set aside.
///
/// Always both, everywhere either is shown. "10,828 functions" and "10,828 functions,
/// 2,140 excluded" are the same repo and different claims, and a percentage divided by
/// the first while the queue works from the second is the instrument overstating itself
/// — the same failure as counting leased work as done.
pub(super) fn count_funcs(scan: &Scan) -> Counts {
    fn walk(node: &Node, out_of_scope: bool, c: &mut Counts) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::Func {
            // Scope is asked FIRST, so a function that is both reads as excluded. A human
            // took it out of the assessment either way, and reporting it under a heading
            // about tool limits would invite somebody to go and fix a size that nobody is
            // waiting on.
            *(if out_of_scope {
                &mut c.excluded
            } else if node.unreadable() {
                &mut c.oversize
            } else {
                &mut c.kept
            }) += 1;
            return;
        }
        for ch in &node.children {
            walk(ch, out_of_scope, c);
        }
    }
    let mut c = Counts::default();
    walk(&scan.root, false, &mut c);
    c
}

/// What a scan holds, split by whether a reading can be taken of it.
///
/// **Three numbers because there are three reasons, and a coverage figure that merges any
/// two of them is an instrument overstating itself.** `kept` is the denominator — what a run
/// can actually finish. `excluded` is somebody's `.sanityignore`. `oversize` is past
/// [`READ_CEILING`], which is a fact about readers rather than a judgement about the code,
/// and it is reported separately for exactly that reason: folded into `excluded` it would
/// read as a decision a human made, and folded into `kept` it would be a denominator no run
/// can ever reach.
#[derive(Default, Clone, Copy)]
pub(super) struct Counts {
    /// In scope and readable. The only one that belongs in a denominator.
    pub(super) kept: usize,
    /// Set aside by `.sanityignore` — see [`Node::excluded`].
    pub(super) excluded: usize,
    /// Too large for a reading to be taken over — see [`Node::unreadable`].
    pub(super) oversize: usize,
}

/// Files that are their own reading, and files `.sanityignore` set aside.
///
/// The same shape and the same rule as [`count_funcs`], for the same reason: a file is a
/// unit of work now — queued, leased, reported and expired exactly as a function is — so a
/// coverage figure that divides by functions alone is an instrument overstating itself. The
/// sidebar read `150/631` while the queue held 62 file readings nobody had taken, which is
/// a bar that can fill completely with work outstanding.
///
/// A file with no declarations is not counted, matching `collect_tasks` and `live_files`:
/// there is nothing for its header to be graded against, so it is never handed out.
pub(super) fn count_files(scan: &Scan) -> Counts {
    fn walk(node: &Node, out_of_scope: bool, c: &mut Counts) {
        let out_of_scope = out_of_scope || node.excluded;
        if node.kind == NodeKind::File {
            if !node.children.is_empty() {
                // A file task is revealed WHOLE, so the ceiling reaches files long before it
                // reaches functions — the largest function in the corpus is 177KB and the
                // file holding it is 856KB. Its functions are counted normally by
                // `count_funcs`; it is only the header reading that cannot be taken.
                *(if out_of_scope {
                    &mut c.excluded
                } else if node.unreadable() {
                    &mut c.oversize
                } else {
                    &mut c.kept
                }) += 1;
            }
            return;
        }
        for ch in &node.children {
            walk(ch, out_of_scope, c);
        }
    }
    let mut c = Counts::default();
    walk(&scan.root, false, &mut c);
    c
}

/// The repo's shape by top-level directory, so an agent can propose a `.sanityignore`
/// with numbers rather than a guess.
///
/// This is the whole reason the feature can work. Nobody shipping the tool can know that
/// `comfy_api_nodes/` is generated or that `tests-unit/` is a different question — but a
/// reader looking at "tests-unit: 900 functions" can put that in front of the human, who
/// decides. Counts only, never names of functions: a directory total tells a future
/// reader nothing about anything it is going to predict.
pub(super) fn shape_of(scan: &Scan) -> Vec<serde_json::Value> {
    let mut by_dir: std::collections::BTreeMap<String, (usize, usize)> = Default::default();
    fn walk(
        node: &Node,
        out: bool,
        by_dir: &mut std::collections::BTreeMap<String, (usize, usize)>,
    ) {
        let out = out || node.excluded;
        if node.kind == NodeKind::Func {
            let top = node.path.split('/').next().unwrap_or(".").to_string();
            let e = by_dir.entry(top).or_default();
            if out {
                e.1 += 1;
            } else {
                e.0 += 1;
            }
            return;
        }
        for c in &node.children {
            walk(c, out, by_dir);
        }
    }
    walk(&scan.root, false, &mut by_dir);
    let mut rows: Vec<(String, usize, usize)> =
        by_dir.into_iter().map(|(d, (a, b))| (d, a, b)).collect();
    rows.sort_by_key(|(_, a, b)| std::cmp::Reverse(a + b));
    rows.into_iter()
        .take(15)
        .map(|(dir, kept, dropped)| {
            serde_json::json!({ "dir": dir, "functions": kept, "excluded": dropped })
        })
        .collect()
}

/// What the walk left out, as two lists rather than a share.
///
/// **A percentage here would be the frightening number that means nothing.** Measured over
/// text files the unscanned part of a repo is routinely a third of it, and almost all of that
/// is lockfiles, Markdown, JSON and YAML — none of which has a function unit. "110 .scad files
/// not parsed" is a sentence somebody can act on; "30% unmeasured" is a verdict nobody asked
/// this tool to reach. Mechanism here, judgement from the reader, decision with the human —
/// the division `.sanityignore` already runs on.
///
/// Capped, and the remainder is COUNTED rather than dropped. `shape_of` truncates to fifteen
/// directories and says so nowhere in what it emits, which leaves a reader proposing a
/// `.sanityignore` unable to see what was withheld; this is the same hazard `peers_omitted`
/// exists to close, so the omission is a field.
pub(super) fn unscanned_of(scan: &Scan) -> serde_json::Value {
    /// Enough to show the shape of a repo's gaps without spending a reader's context on the
    /// tail of one-file extensions, which is where this list gets long and stops informing.
    const ROWS: usize = 12;
    let u = &scan.stats.unscanned;
    let unparsed: Vec<serde_json::Value> = u
        .unparsed
        .iter()
        .take(ROWS)
        .map(|k| serde_json::json!({ "ext": k.ext, "files": k.files }))
        .collect();
    serde_json::json!({
        "unparsed": unparsed,
        "unparsed_omitted": u.unparsed.len().saturating_sub(unparsed.len()),
        // Images, prose, configuration and compiled output — everything with no function
        // unit, kept out of the list above so it can answer the question it is for. Reported
        // so the filter is visible rather than felt.
        "not_code": u.not_code,
        "skipped": u
            .skipped
            .iter()
            .map(|s| serde_json::json!({ "reason": s.reason, "files": s.files }))
            .collect::<Vec<_>>(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::project_of;
    use std::time::Instant;

    /// `outstanding` has to itemise exactly what `in_flight` counts, and a lease only
    /// explains work that is still outstanding.
    ///
    /// The failure this guards is the one `work_left` was written for, one level down: a
    /// lease left behind over a function whose reading has since landed would inflate
    /// `in_flight`, and an orchestrator reading `remaining == in_flight` waits instead of
    /// spawning the wave that would finish the repo. Coverage numbers must never be
    /// derived from the lease table.
    #[test]
    fn outstanding_itemises_only_live_leases_on_unread_work() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "fn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let ids: Vec<String> = {
            let mut out = Vec::new();
            collect_tasks(
                &p.scan.root,
                &p.reports,
                &HashMap::new(),
                None,
                &crate::scan::declared_from_scan(&p.repo, &p.scan.root),
                &mut out,
            );
            // Functions only. The file itself is queued too — see `Task::file` — and this
            // test is about what a lease does to unread work, not about which kinds exist.
            out.into_iter().filter(|(_, t)| !t.file).map(|(_, t)| t.id).collect()
        };
        assert_eq!(ids.len(), 2, "fixture should offer two functions");

        // Nothing out: no leases, nothing itemised.
        assert_eq!(work_left(&p).in_flight, 0);
        assert!(work_left(&p).outstanding.is_empty());

        // One out with a reader: counted, itemised, and by its id.
        p.leased.insert(ids[0].clone(), Instant::now());
        let w = work_left(&p);
        assert_eq!(
            w.remaining, 3,
            "a lease is not a reading; remaining holds (two functions and their file)"
        );
        assert_eq!(w.in_flight, 1);
        assert_eq!(w.outstanding.len(), w.in_flight);
        assert_eq!(w.outstanding[0].0, ids[0]);

        // A lease left over a function that has since been read explains nothing. It must
        // drop out of both numbers rather than keep claiming a reader is busy on it.
        p.reports.insert(ids[0].clone(), Report { id: ids[0].clone(), ..Report::blank() });
        p.reads = p.reads.wrapping_add(1);
        let w = work_left(&p);
        assert_eq!(w.remaining, 2, "one function read; its twin and their file are left");
        assert_eq!(w.in_flight, 0, "the reading landed; the stale lease is moot");
        assert!(w.outstanding.is_empty());
    }

    /// `.sanityignore` narrows the queue and is COUNTED while it does it.
    ///
    /// The scoping half is easy and the counting half is the point. An exclusion that
    /// disappears from the totals lets a map claim completeness over a subset somebody
    /// chose months ago — the same failure as `done` counting leased work, or `assessed`
    /// counting readings whose code had moved.
    #[test]
    fn an_excluded_file_leaves_the_queue_and_stays_in_the_count() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("tests")).unwrap();
        std::fs::write(dir.path().join("keep.rs"), "fn one() { println!(\"1\"); }\n").unwrap();
        std::fs::write(
            dir.path().join("tests/drop.rs"),
            "fn two() { println!(\"2\"); }\nfn three() { println!(\"3\"); }\n",
        )
        .unwrap();

        // With no `.sanityignore`, everything is in scope. No defaults, ever — a shipped
        // default excluding tests would have deleted the best finding of a whole run.
        let p = project_of(dir.path());
        assert_eq!((count_funcs(&p.scan).kept, count_funcs(&p.scan).excluded), (3, 0));

        std::fs::write(dir.path().join(".sanityignore"), "tests/\n").unwrap();
        let p = project_of(dir.path());
        assert_eq!(
            (count_funcs(&p.scan).kept, count_funcs(&p.scan).excluded),
            (1, 2),
            "in scope and set aside are both reported, never one silently"
        );

        // The queue works from the narrowed set.
        let mut out = Vec::new();
        collect_tasks(
            &p.scan.root,
            &p.reports,
            &HashMap::new(),
            None,
            &crate::scan::declared_from_scan(&p.repo, &p.scan.root),
            &mut out,
        );
        let names: Vec<String> =
            out.into_iter().filter(|(_, t)| !t.file).map(|(_, t)| t.name).collect();
        assert_eq!(names, vec!["one"], "excluded functions are never handed out");

        // And the shape a reader would use to propose one still shows both halves, or it
        // could not have proposed anything.
        let shape = shape_of(&p.scan);
        let tests = shape.iter().find(|r| r["dir"] == "tests").expect("tests/ in the shape");
        assert_eq!(tests["excluded"], 2);
        assert_eq!(tests["functions"], 0);
    }

    /// A reading for code that is gone must not count as coverage.
    ///
    /// `assessed` was `reports.len() - stale`, and `count_stale` walks the SCAN — so a
    /// reading whose function had been deleted was never stale, because nothing walked past
    /// it, and it stayed in the numerator forever. A repo that removed code could report
    /// more assessed than it has functions. Found by the disagreement it caused: `/status`
    /// said 241 where `sanity_summary` said 217.
    #[test]
    fn a_reading_for_a_deleted_function_is_not_coverage() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gate.rs");
        std::fs::write(&path, "fn open() { println!(\"1\"); }\nfn shut() { println!(\"2\"); }\n")
            .unwrap();
        let mut p = project_of(dir.path());

        // Both read, against their own bodies.
        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 2);
        for (id, body) in &ids {
            p.reports.insert(
                id.clone(),
                Report { id: id.clone(), body: body.clone(), ..Report::blank() },
            );
        }
        assert_eq!(assessed(&p.scan, &p.reports), 2, "two live readings");

        // One function is deleted and the repo rescanned. Its reading is now about nothing.
        std::fs::write(&path, "fn open() { println!(\"1\"); }\n").unwrap();
        let rescanned = project_of(dir.path());
        p.scan = rescanned.scan;
        assert_eq!(
            assessed(&p.scan, &p.reports),
            1,
            "the survivor counts; the orphan is history, not coverage"
        );
    }
}
