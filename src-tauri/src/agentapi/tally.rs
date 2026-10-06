//! What the readings add up to, and which model and agent took them.
//!
//! The grade tables `/summary` reports — overall, per model, per batch position, and how many
//! readers held the repo's own brief — computed off the tree so a stale reading is counted
//! apart. Beside them, the questions a corpus answers about its own instrument: the one model
//! or agent it was read by, every model with its share, and what a run should ask for next.

use super::coverage::{assessed, count_files, count_funcs, count_stale, each_unit};
use super::{Grade, Project, Report};
use crate::model::NodeKind;
use crate::scan::Scan;
use serde::Serialize;
use std::collections::HashMap;

/// Every model a project's readings were taken by, commonest first.
///
/// **The disagreement itself, made visible.** [`one_model`] answers `None` for a mixed
/// corpus, on the grounds that a mixture is worth SHOWING rather than resolving to a
/// majority — and then nothing showed it. The Read dialog fell back to a bare picker, which
/// is indistinguishable from a repo nobody has ever read, so the one case the rule exists
/// for was the one case it said nothing about. This is what the dialog says instead.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ModelCount {
    pub model: String,
    pub readings: usize,
}

/// What to ASK for, to carry on the way the last reading was taken.
///
/// **`asked`, not `model`, and the difference is the whole point of keeping both.** A
/// reading records two things about its reader: what the run requested, stamped
/// server-side, and what the reader said it was. They are not interchangeable — a run asks
/// for `sonnet` and the reader reports `claude-sonnet-4.5`, which is that model's name for
/// itself and not necessarily a string its CLI accepts. Feeding the self-report back to
/// `--model` is how a wave dies on every reader at once with nothing to say beyond "three
/// waves finished without a reading landing".
///
/// So: the newest dated reading's `asked`, falling back to its `model` for readings taken
/// before `asked` existed — where the self-report is all there is, and a guess that might
/// be rejected beats no suggestion at all.
///
/// **What a mixed corpus offers instead of nothing.** With readings on several scales there
/// is no single banked model to continue, and the dialog otherwise falls back to the
/// harness's own default — which is how a repo picks up one more scale.
///
/// `None` when nothing is dated, which is every corpus banked before `when` existed. A
/// partly-dated corpus answers from the dated part: those are by definition the recent
/// ones, since the undated readings predate the field.
pub(super) fn recent_model(p: &Project) -> Option<String> {
    p.reports
        .values()
        .filter(|r| !r.when.is_empty())
        // Lexicographic, which is chronological for this format — see `now_iso`.
        .max_by(|a, b| a.when.cmp(&b.when))
        .map(|r| if r.asked.trim().is_empty() { r.model.trim() } else { r.asked.trim() })
        .filter(|m| !m.is_empty())
        .map(str::to_string)
}

/// What a run uses when nobody names a model. `None` means the harness's own default.
///
/// **One order, wherever the question is asked.** The `/check` handler resolved it one way
/// and the window's dialog another, which is how a repo picks up a second scale: press Read
/// and get the corpus's model, type `sanity check` and get whatever this laptop last
/// preferred. The corpus comes first because it travels with the repo and a stored
/// preference does not — see `recent_model` for why it reads what the last run ASKED for
/// rather than what its readers said they were.
pub fn suggested_model(p: &Project, key: &str) -> Option<String> {
    recent_model(p).or_else(|| one_model(&p.reports)).or_else(|| crate::reports::model_for(key))
}

/// The sidebar row's reading and scale numbers, for a tree and its readings with no `Project`.
///
/// **For `sanity export-data`, which renders a report with no window and no backend.** Each
/// field is the SAME function the row calls — `count_funcs`, `count_files`, `assessed`,
/// `count_stale`, `one_model`, `one_harness`, `model_tally` — so the offline report and the
/// sidebar cannot come to disagree about one repo. Field names are the row's, on the wire.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ReportSummary {
    pub functions: usize,
    pub files: usize,
    pub assessed: usize,
    pub stale: usize,
    pub banked_model: Option<String>,
    pub banked_harness: Option<String>,
    pub banked_models: Vec<ModelCount>,
    pub trace_depth: crate::trace::Depth,
}

pub fn report_summary(
    scan: &Scan,
    reports: &HashMap<String, Report>,
    trace_depth: crate::trace::Depth,
) -> ReportSummary {
    ReportSummary {
        functions: count_funcs(scan).kept,
        files: count_files(scan).kept,
        assessed: assessed(scan, reports),
        stale: count_stale(scan, reports),
        banked_model: one_model(reports),
        banked_harness: one_harness(reports),
        banked_models: model_tally(reports),
        trace_depth,
    }
}

pub(super) fn model_tally(reports: &HashMap<String, Report>) -> Vec<ModelCount> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for r in reports.values() {
        let m = r.model.trim();
        if !m.is_empty() {
            *counts.entry(m).or_default() += 1;
        }
    }
    let mut out: Vec<ModelCount> = counts
        .into_iter()
        .map(|(model, readings)| ModelCount { model: model.to_string(), readings })
        .collect();
    // Commonest first, then by name so a tie does not reshuffle on every poll — which the
    // frontend would read as a change and re-render for.
    out.sort_by(|a, b| b.readings.cmp(&a.readings).then_with(|| a.model.cmp(&b.model)));
    out
}

/// The one agent a project's readings were taken by, or `None` if they disagree.
///
/// Same rule as [`one_model`] below, and the same reason: two agents over one repo is worth
/// seeing rather than resolving. Used to preselect the Read dialog, where `None` correctly
/// means "do not choose for them".
///
/// Disagreement is left visible rather than resolved to a majority. A repo read by two
/// models is one map on two scales, and the answer to that is for somebody to see it, not
/// for this function to pick a winner.
pub(super) fn one_harness(reports: &HashMap<String, Report>) -> Option<String> {
    let mut seen: Option<&str> = None;
    for r in reports.values() {
        let h = r.harness.trim();
        if h.is_empty() {
            continue;
        }
        match seen {
            None => seen = Some(h),
            Some(prev) if prev == h => {}
            Some(_) => return None,
        }
    }
    seen.map(|s| s.to_string())
}

pub(super) fn one_model(reports: &HashMap<String, Report>) -> Option<String> {
    let mut seen: Option<&str> = None;
    for r in reports.values() {
        let m = r.model.trim();
        if m.is_empty() {
            continue;
        }
        match seen {
            None => seen = Some(m),
            Some(prev) if prev == m => {}
            Some(_) => return None,
        }
    }
    seen.map(|s| s.to_string())
}

/// How many readings landed on each step of the scale.
#[derive(Debug, Default, Clone, Serialize)]
pub struct GradeCounts {
    pub full: usize,
    pub most: usize,
    pub some: usize,
    pub none: usize,
    /// Readings carrying no grade at all. Only `documented` can be this — `predicted`
    /// folds a pre-grade report onto the ends of the scale, because that is what its
    /// reader actually said.
    pub ungraded: usize,
}

impl GradeCounts {
    fn add(&mut self, g: Option<Grade>) {
        match g {
            Some(Grade::Full) => self.full += 1,
            Some(Grade::Most) => self.most += 1,
            Some(Grade::Some) => self.some += 1,
            Some(Grade::None) => self.none += 1,
            None => self.ungraded += 1,
        }
    }
}

#[derive(Debug, Default, Clone, Serialize)]
pub struct Tally {
    pub readings: usize,
    pub predicted: GradeCounts,
    /// Post-provenance, via [`Report::grades`]: a doc the reader judged derivable counts
    /// as `none` here however it was graded, because that is the rule the rest of the app
    /// applies and two different "documented" numbers would be worse than one.
    pub documented: GradeCounts,
    /// How many of those docs the reader judged it could have written from the code — the
    /// share of the `documented: none` above that came from the rule rather than from
    /// missing comments.
    pub derivable: usize,
    /// The second axis: how clear the body was once the reader had opened it.
    ///
    /// Reported alongside `predicted` rather than folded into it, because the pair is the
    /// finding. Low `predicted` with high `legible` is a repo you cannot navigate but can
    /// read; both low is one you cannot work in at all; and high `legible` beside a pile of
    /// `traps` is the dangerous one — clear on the surface, mined underneath.
    ///
    /// Readings banked before this field existed carry no opinion, so they land in
    /// `ungraded` rather than defaulting to a grade nobody gave.
    pub legible: GradeCounts,
    /// Readings whose reader said something here will bite the next person to edit it.
    pub traps: usize,
    /// Readings whose reader said it had not seen that file before.
    pub cold: usize,
}

impl Tally {
    fn add(&mut self, r: &Report) {
        let (predicted, documented) = r.grades();
        self.readings += 1;
        self.predicted.add(Some(predicted));
        self.documented.add(documented);
        self.derivable += usize::from(r.derivable);
        // A grade from a superseded question lands in `ungraded`, not in its rung. The map
        // stops coloring those wedges, and an aggregate that kept counting them would be
        // the orchestrator's copy of the answer disagreeing with the human's — the same
        // split `assessed` was fixed for, where the optimistic number was the one making
        // decisions.
        self.legible.add(r.legible.filter(|_| crate::assessment::legible_current(r.spec)));
        // Same rule as `legible` above: an answer to a superseded question is not counted.
        // It matters more here than there, because this number is the one somebody acts on
        // — an aggregate that kept counting old traps would send a maintainer looking for
        // hazards under a definition the map no longer uses.
        self.traps += usize::from(r.trap && crate::assessment::trap_current(r.spec));
        self.cold += usize::from(r.cold);
    }
}

/// Does a reader get better at this repo as it works through a batch?
///
/// The one thing the protocol could not see about itself. By its eighth function a reader
/// has learned the repo's idioms, its naming and its author's habits — so it predicts
/// better for reasons that are nothing to do with the code. That improvement is
/// indistinguishable in the output from code that is genuinely more predictable, which
/// makes it the same class of error as an invented surprise, pointed the other way.
///
/// **One bucket per position, not first-versus-later.** The collapsed version answered
/// the wrong question and hid it: a full pass of this repo at a batch of three found
/// `full` at 39.5% for position 1 against 38.4% later — flat — which reads as "no warming"
/// and is really "no warming *within three*". The concern was always about position eight
/// or nine. Three may simply be too short for a reader to learn anything, and a two-bucket
/// split cannot tell that apart from an effect that does not exist.
///
/// Per position, any run at any batch size contributes a point to the same curve for free.
/// A knee at five or six shows up as a knee; a flat line across ten is an answer.
///
/// What is known so far, and it is not much: a confounded sweep put later readings at 36%
/// `full` against 29% — the direction the warm-tail argument predicts. A cleaner run
/// reversed it. A complete pass showed neither. The one consistent signal across all three
/// is that `some` rises with position, which looks like a reader calibrating against a
/// scale it has now used rather than one learning the repo — a different mechanism, and
/// still not significant.
///
/// Settling it needs the arms interleaved in one wave so queue depth and file mix are
/// matched, and it needs a repo where a reader has less handed to it — this one gives a
/// paragraph of rationale per function, which leaves prior exposure little to add.
#[derive(Debug, Default, Clone, Serialize)]
pub struct Drift {
    /// Position → how that position's readings graded. Keyed by the reader's own count,
    /// so bucket 1 is every reader's first function whatever batch size it was running.
    pub positions: std::collections::BTreeMap<u32, GradeCounts>,
    /// Readings banked before position was recorded. Never folded into bucket 1 — an
    /// unknown position is not a claim of freshness, and counting it as one is exactly how
    /// a batched run got to look uniform in the first place.
    pub unrecorded: usize,
}

/// Everything [`summary`] reports, computed off the tree rather than off `reports`.
///
/// Walking the scan rather than the map is the same choice `save` makes: from the
/// function side each reading is checked against the body it was taken over, so a reading
/// whose code has moved is counted as stale instead of averaged in as coverage. Walking
/// the reports instead would report a distribution over a repo that no longer exists.
#[derive(Debug, Default, Serialize)]
pub struct Aggregate {
    pub total: Tally,
    pub by_model: std::collections::BTreeMap<String, Tally>,
    pub by_position: Drift,
    pub stale: usize,
    pub priming: Priming,
}

/// How much of this assessment was taken by readers holding the repo's own documentation.
///
/// Repo-wide, like everything else here, and it is the number that decides whether
/// `predicted` can be reported at all. `exposed` is what a run would rather not have; the
/// point of counting it is that a mixed corpus can be SPLIT, which prose in a caveats
/// document written afterwards cannot do.
#[derive(Debug, Default, Serialize)]
pub struct Priming {
    /// Readings whose reader declared the instructions were in its context.
    pub exposed: usize,
    /// Readings taken in a repo that HAS instructions, by a reader that did not hold them.
    pub clean: usize,
    /// Readings from a repo with no instructions file at all — nothing to be primed by,
    /// and counted apart so `clean` keeps meaning "deliberately excluded".
    pub not_applicable: usize,
}

pub(super) fn aggregate(project: &Project) -> Aggregate {
    aggregate_of(&project.scan, &project.reports)
}

/// The same, from a scan and a store, for a caller with no `Project` — see
/// [`offline_counts`], which exists for the same reason. One definition, so the CLI
/// answering without a backend cannot drift from the endpoint answering with one.
pub fn aggregate_of(scan: &Scan, reports: &HashMap<String, Report>) -> Aggregate {
    let mut agg = Aggregate::default();
    // Through `each_unit`, so `.sanityignore` is honored here as it is everywhere else —
    // the aggregate is what `sanity summary` prints, and counting readings the queue would
    // never hand out is the same overstatement one level along.
    each_unit(scan, &mut |node| {
        if node.kind != NodeKind::Func {
            return;
        }
        let Some(r) = reports.get(&node.id) else {
            return;
        };
        if crate::assessment::is_stale(r, node.body.as_deref(), node.bytes) {
            agg.stale += 1;
            return;
        }
        agg.total.add(r);
        agg.by_model
            // Attribution is self-declared and may be missing; a blank gets its own
            // bucket rather than being folded in with the models that did say.
            .entry(if r.model.is_empty() { "unattributed".into() } else { r.model.clone() })
            .or_default()
            .add(r);
        // Three buckets and not two: "no instructions in this repo" and "instructions the
        // reader was launched without" are different facts, and folding them together would
        // let a repo that never had a CLAUDE.md read as a run somebody took care over.
        if r.agent_docs.is_empty() {
            agg.priming.not_applicable += 1;
        } else if r.primed {
            agg.priming.exposed += 1;
        } else {
            agg.priming.clean += 1;
        }
        let (predicted, _) = r.grades();
        match r.position {
            Some(n) => agg.by_position.positions.entry(n).or_default().add(Some(predicted)),
            None => agg.by_position.unrecorded += 1,
        }
    });
    agg
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::project_of;

    /// The summary is the orchestrator's only honest account of its own run, so what it
    /// leaves out matters as much as what it counts.
    ///
    /// Two exclusions, both of which were bugs elsewhere first. A stale reading is history
    /// and must not be averaged in as coverage — the same rule `assessed` and
    /// `collect_tasks` follow. And a reading with no recorded position must not be counted
    /// as a first reading: an unknown position is not a claim of freshness, and treating
    /// it as one would make a batched run — the thing this field exists to expose — look
    /// uniform.
    #[test]
    fn the_summary_counts_neither_stale_readings_nor_unknown_positions_as_good_news() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("a.rs"),
            "fn one() { println!(\"1\"); }\nfn two() { println!(\"2\"); }\nfn three() { println!(\"3\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 3);

        fn reading(id: &str, body: &str, position: Option<u32>, model: &str) -> Report {
            Report {
                id: id.to_string(),
                predicted: Some(Grade::Full),
                body: body.to_string(),
                position,
                model: model.to_string(),
                ..Report::blank()
            }
        }
        let mut bank = |r: Report| {
            p.reports.insert(r.id.clone(), r);
        p.reads = p.reads.wrapping_add(1);
            p.reads = p.reads.wrapping_add(1);
        };
        bank(reading(&ids[0].0, &ids[0].1, Some(1), "haiku"));
        bank(reading(&ids[1].0, &ids[1].1, Some(7), "sonnet"));
        // Read against a body that is no longer there.
        bank(reading(&ids[2].0, "a hash from another era", Some(1), "sonnet"));

        let agg = aggregate(&p);
        assert_eq!(agg.stale, 1);
        assert_eq!(agg.total.readings, 2, "the stale reading is not coverage");
        assert_eq!(agg.total.predicted.full, 2);
        assert_eq!(agg.by_model.len(), 2);
        assert_eq!(agg.by_model["sonnet"].readings, 1, "and not in its model's tally either");

        // One bucket per position, so a curve can be read off any run at any batch size —
        // "first vs later" could not tell a flat line from an effect that starts at six.
        assert_eq!(agg.by_position.positions[&1].full, 1);
        assert_eq!(agg.by_position.positions[&7].full, 1, "position 7 is its own bucket");
        assert!(!agg.by_position.positions.contains_key(&2), "no bucket is invented");
        assert_eq!(agg.by_position.unrecorded, 0);

        // A reading from before the field existed lands in neither bucket.
        let r = reading(&ids[1].0, &ids[1].1, None, "sonnet");
        p.reports.insert(r.id.clone(), r);
        p.reads = p.reads.wrapping_add(1);
        let agg = aggregate(&p);
        assert_eq!(agg.by_position.unrecorded, 1);
        assert_eq!(agg.by_position.positions[&1].full, 1, "unknown is not position 1");
        assert!(!agg.by_position.positions.contains_key(&7), "nor is it its old bucket");
    }
}
