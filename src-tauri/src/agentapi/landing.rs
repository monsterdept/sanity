//! The `/report` endpoint: where a reading lands, what is refused, and what the server stamps.
//!
//! A report is turned away before anything is stored when its prose swallowed the rest of
//! its own tool call, when a trap names no hazard, when no project holds the id, or when the
//! body went out in parts the reader has not all taken. What lands is not what was sent:
//! the body hash, the prediction made before the reveal, the spec, the paging, who, when and
//! which run are stamped here, then the reading is written through to `.sanity/`.

use super::coverage::{work_left, WorkLeft};
use super::project::save_reports;
use super::protocol::NO_PROJECT;
use super::{lock, Grade, Report, Shared};
use crate::model::NodeKind;
use axum::extract::State;
use axum::Json;
use serde::Deserialize;
use std::time::Instant;

/// A reading, plus which project it belongs to.
///
/// `project` is flattened alongside the report rather than living on `Report` itself: it
/// is routing, not part of the reading, and it must not end up in `.sanity/`.
#[derive(Deserialize)]
pub struct ReportRequest {
    #[serde(default)]
    pub(super) project: Option<String>,
    #[serde(flatten)]
    pub(super) report: Report,
}

/// A trap with nothing said about it.
///
/// Its own function so it can be tested without standing up a server, and because the rule
/// is a claim about reports rather than a step in a handler: `trap` is a boolean, the panel
/// draws the NOTE as the trap, and a bare `true` is a flag on a wedge that has nothing to
/// tell whoever opens it. Two of those are in this repo's own corpus.
fn trap_without_note(r: &Report) -> bool {
    r.trap && r.note.trim().is_empty()
}

/// A text field carrying the rest of the reader's own tool call.
///
/// Seen in the wild: a reader's arguments were serialised as XML rather than JSON, and the
/// parse assigned everything from `found` onward — closing tag, remaining parameters and
/// all — into that one string. The call still arrives well-formed here, just short: the
/// grades after the swallowed field never reach the server at all.
///
/// Which would be merely ugly if a missing `predicted` were treated as missing. It is not
/// — [`Report::grades`] folds it through the pre-grade `surprised` flag, whose default is
/// `false`, so a truncated call lands as `Full`, the greenest grade on the scale. 28
/// readings across two repos went in that way and 15 of them state, in the leaked text,
/// that their reader chose `most`. A parse accident must not be able to make a repo look
/// better than it read.
///
/// So the report is refused and the reading is not banked. Repairing it here by parsing
/// the leak back out is the shape of the migration that once destroyed a project's
/// readings — and unnecessary, because the reader is still running and can simply resend.
///
/// **A leak alone is not the fault; a MISSING GRADE is.** The first version refused on the
/// leak by itself, and that cost the thing this whole tool measures. A reader hit it four
/// times on one function, could not see its own serialisation, and did the only thing that
/// ever appeared to work: it cut `found` from ~450 characters to 76 and was accepted. The
/// reading landed as a one-line stub where the paragraph it replaced was the useful part.
/// Refusing a call that carried every grade destroys a complete reading to tidy up some
/// trailing punctuation — so the tail is kept as the reader sent it, ugly and honest, and
/// only a call that actually lost a grade is turned away.
///
/// And the refusal has to say what to do. The first wording said "send it again as
/// ordinary JSON", which a model cannot act on — it does not choose its own encoding — so
/// the only lever it has left is the prose. The second wording ruled the prose out without
/// offering anything in its place, which is no better: a reader resent identical text
/// twice, was refused twice, and improvised anyway.
///
/// What actually works is ORDER — grades first, prose last, so a mangle swallows nothing
/// that matters. The schema now declares the fields that way (see `mcp.rs`, where the
/// reasoning lives), and this hint names it for the reader that hits the case regardless.
fn mangled(r: &Report) -> Option<&'static str> {
    // The grades are what the guard is protecting. `predicted` folds to `Full` when
    // absent, so its loss is the expensive one; the other two go gray, which is a smaller
    // lie but still one this build asked a reader for and did not get.
    if r.predicted.is_some() && r.documented.is_some() && r.legible.is_some() {
        return None;
    }
    // The closing tags are the reliable half: an argument value that ends by closing the
    // tag it lives in cannot be prose about code. `<parameter name=` catches the rest of
    // the payload trailing behind it.
    const LEAK: [&str; 2] = ["</parameter>", "<parameter name="];
    for (name, text) in [("expected", &r.expected), ("found", &r.found), ("note", &r.note)] {
        if LEAK.iter().any(|m| text.contains(m)) || text.contains(&format!("</{name}>")) {
            return Some(name);
        }
    }
    None
}

/// Land one reading: `/report`, the end of predict → reveal → report.
///
/// **Refused before anything is stored** when the prose carries the rest of its own tool call
/// (`mangled`), when a trap names no hazard, when no open project holds the id, or when the
/// body was served in parts the reader has not all taken. Each refusal says `saved: false`
/// and how to send it again, because the reader is the only party that can.
///
/// **What the reader sends is not what is stored.** Every field that is a fact about the
/// reading rather than a judgement in it is stamped here and the caller's value is discarded:
/// the body from the live scan, `expected` from the prediction recorded before the reveal,
/// the spec, the paging, who and when, and the agent docs the reader was primed with. A
/// reader that could set those could grade code it never saw, or revise its prediction after
/// reading the answer.
pub(super) async fn report(
    State(state): State<Shared>,
    Json(req): Json<ReportRequest>,
) -> Json<serde_json::Value> {
    let r = req.report;
    // Before anything is stamped, stored or written: a report whose prose is carrying the
    // rest of its own tool call is a report with fields MISSING, and the missing one is
    // usually a grade. Rejected rather than repaired — the reader is still there and can
    // send it again, which is the only party that knows what it meant.
    if let Some(field) = mangled(&r) {
        // Said in the reader's own terms, because the reader is the only party that can
        // fix it and it cannot see what went wrong. The first wording sent it hunting for
        // the fault in its prose, and shortening the prose is the one "fix" that appears
        // to work — see `mangled`. Name what was lost, and rule the length out.
        //
        // Pinged as an error, because a refusal used to leave no trace anywhere: no ping,
        // no counter, nothing written. Four of them cost one reading its substance, and
        // the only record was a subagent's recollection of its own transcript, which is
        // not evidence. Same argument as a failed write — work is being lost, and the
        // human watching the window is the party who can stop it.
        {
            let mut state = lock(&state);
            state.refused += 1;
            state.ping();
        }
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": format!(
                "`{field}` arrived carrying the rest of this call, so the grades after it \
                 never reached the server. Nothing was saved."
            ),
            "hint": "Send it again for the same id, listing every grade FIRST and the \
                     prose fields last — that is what fixes it. Keep the same text in \
                     full: its length is not the problem, and shortening it or dropping \
                     `note` loses the reading for nothing.",
        }));
    }
    // A trap with no sentence says nothing anybody can act on. `trap` is a boolean and the
    // finding is the note beside it — the panel draws the note AS the trap — so a bare
    // `true` is a flag on a wedge that, opened, has nothing to tell you. Two of them are in
    // this repo's own corpus.
    //
    // Refused rather than downgraded to `trap: false`. Silently clearing it would discard a
    // reader's actual judgement to make the store tidy, and the reader is the one party that
    // can say what it meant — it is still there, and this is one field away from correct.
    // The schema cannot express "required when another field is true", so the rule lives
    // here, where it can be enforced, and is stated in `trap`'s own description so a reader
    // meets it before it answers rather than after.
    if trap_without_note(&r) {
        {
            let mut state = lock(&state);
            state.refused += 1;
            state.ping();
        }
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": "`trap` is true with no `note`, so this reading names a hazard without                       saying what it is. Nothing was saved.",
            "hint": "Send it again for the same id with `note` set to one sentence naming                      what breaks and when. If on reflection the code does not bite the next                      editor — or a comment already warns about it — send `trap: false`                      instead; that is a real answer, not a retreat.",
        }));
    }
    let mut state = lock(&state);
    // Nothing loaded is the restore window, and it must keep saying "wait, retry" — see
    // NO_PROJECT. Asked before the id is routed, because a reading arriving two seconds
    // after a restart has nowhere to land for a reason that will pass on its own.
    if state.for_client(req.project.as_deref()).is_none() {
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    }
    // Where the TASK came from, not where the caller thinks it is. See `owner_of`: the
    // shim's key is one cell shared by every subagent in a session, and a reading routed
    // by it can land in a repo whose scan has never heard of the id.
    let Some(key) = state.owner_of(&r.id, req.project.as_deref()) else {
        // The failure this replaces returned `ok: true`. The id resolved to no function,
        // so `body` was stamped empty, the report went into a map keyed by an id nothing
        // matches, and `save_reports` — which walks live functions, not reports — wrote
        // nothing. A reading was counted, celebrated and discarded, and the response said
        // `saved: true`. A reading that cannot be placed is refused out loud instead.
        state.refused += 1;
        state.ping();
        return Json(serde_json::json!({
            "ok": false,
            "saved": false,
            "error": format!(
                "No open project holds `{}`, so this reading has nowhere to land and was \
                 NOT saved.",
                r.id
            ),
            "hint": "The repo was very likely rescanned since you were handed this task — \
                     ids carry line numbers and they move. Call sanity_next for fresh \
                     work; do not re-send this reading against a different id.",
        }));
    };
    let Some(project) = state.projects.get_mut(&key) else {
        state.ping();
        return Json(serde_json::json!({ "ok": false, "error": NO_PROJECT }));
    };
    project.last_agent = Some(Instant::now());
    // A body served in parts, with parts still owed. Refused — the reader graded something
    // it never fully saw, which is the failure this whole path exists to close, and it is
    // the one form of it the server can prove rather than ask about.
    //
    // Before the lease is released, deliberately: the work stays out with this reader so it
    // can fetch what it is missing and send the same reading again. Dropping the lease would
    // put the function back in the queue and make the refusal cost a reading rather than a
    // round trip. Refused rather than downgraded, on the `trap_without_note` rule — clearing
    // a reader's grades to tidy the store is not ours to do, and there is nothing here to
    // salvage anyway: a grade from a partial body is not a weaker measurement, it is a
    // measurement of something else.
    if let Some(seen) = project.revealed.get(&r.id) {
        if !seen.whole() {
            let missing = seen.missing();
            let (parts, have) = (seen.parts, seen.seen.len());
            state.refused += 1;
            state.ping();
            return Json(serde_json::json!({
                "ok": false,
                "saved": false,
                "error": format!(
                    "This body was served in {parts} parts and you have taken {have}. \
                     Nothing was saved.",
                ),
                "hint": format!(
                    "Call sanity_reveal for the same id with `part` set to each of {missing:?}, \
                     read them, then send this reading again — your prediction is already \
                     recorded and re-reading cannot change it. Do not grade from what you \
                     have: eighteen readings in this corpus were written against bodies \
                     their readers never finished, and every one of them landed on the same \
                     flattering grade. If the rest genuinely cannot be fetched, say so to \
                     the human and stop rather than reporting.",
                ),
            }));
        }
    }
    project.leased.remove(&r.id);
    // The prediction as it stood BEFORE the body was served — see `Project::predictions`.
    // Taken here rather than accepted from the report, on the same rule as `body` and `at`
    // below: the field whose job is to be checkable cannot be self-certified.
    //
    // It falls back to what the caller sent, and that is not a loophole left open. A shim
    // built before `reveal` existed has no stored prediction to find, and refusing its
    // readings would discard work over a field it was never given the chance to record.
    // What it cannot do is OVERWRITE a stored one.
    let promised = project.predictions.remove(&r.id);
    // Cleared with the prediction, and only once the reading is past the guard above: a
    // reading that got this far held every part, so the record has done its job. Left
    // behind it would refuse the next honest re-read of the same function after a rescan.
    //
    // Taken before it is dropped, and stamped rather than accepted: this is the evidence
    // the body was received whole, and the party it is evidence against is the caller. See
    // `Report::paged`.
    let paged = project.revealed.remove(&r.id).map(|v| v.parts);

    // Provenance is stamped here, not accepted from the caller. The body hash is the
    // field a future reader checks this reading against, so it has to come from the same
    // scan the queue handed out — an agent could report a hash of whatever it liked, and
    // the one thing a staleness marker cannot be is self-certified.
    let mut r = r;
    let mut body = None;
    // Its name and path come off the same walk, for the feed. Derived from the id instead
    // they would carry the `@line` an id embeds, and would be wrong the moment somebody
    // added an import — which is the reason nothing durable is keyed on an id either.
    let mut named = None;
    project.scan.root.visit(&mut |n| {
        if n.id == r.id {
            body = n.body.clone();
            named = Some((
                match (&n.owner, n.kind == NodeKind::File) {
                    (_, true) => n.path.clone(),
                    (Some(o), _) => format!("{o}::{}", n.name),
                    (None, _) => n.name.clone(),
                },
                n.path.clone(),
            ));
        }
    });
    r.body = body.unwrap_or_default();
    if let Some(p) = promised {
        r.expected = p;
    }
    // Which question this answered — the same argument as the hash beside it. A reader
    // asked to declare its own spec could name the one that makes its grade look current,
    // and that claim is exactly what the field exists to test. This build asked, so this
    // build stamps.
    r.spec = crate::assessment::SPEC;
    // Stamped, never accepted — see `Report::paged`. A reader that could set this would be
    // certifying that it had received the body it is about to grade, which is the one claim
    // this field exists to check.
    r.paged = paged;
    // And cleared, for the same reason it is stamped rather than accepted. It is a
    // conclusion this build draws on the way out, never a claim a reader gets to make on
    // the way in — a reader that sent `legibleDated: false` would otherwise be voting on
    // whether its own grade still counts.
    r.legible_dated = false;
    r.trap_dated = false;
    r.by = crate::assessment::who(&project.repo);
    r.at = crate::assessment::head(&project.repo);
    // What this run asked for, from the run itself. A hand-driven reader belongs to no run
    // and leaves it empty, which is honest: nobody here asked for anything.
    r.asked = project.run.as_ref().map(|run| run.model.clone()).unwrap_or_default();
    r.harness = project.run.as_ref().map(|run| run.harness.clone()).unwrap_or_default();
    crate::assessment::settle_model(&mut r);
    r.when = crate::assessment::now_iso();
    // The hazard half of the priming question, on the same grounds as the hash: what the
    // repo held is a fact about the reading conditions, and a reader has no business
    // declaring it. `primed` — what was actually in its context — stays as the reader sent
    // it, because that is the half only the reader can see.
    r.agent_docs = crate::assessment::agent_docs(&project.repo);

    // Before the map takes it, while the grade is still to hand.
    if let Some((name, path)) = named {
        project.note("read", name, path, Some(&r));
    }
    // **A reading that classifies test code changes the wiring, and changes it now.** Only
    // this one field can, and only where no contract already answered, so the pass is skipped
    // entirely on a Rust or Go repo and on every reading that was never asked the question.
    // `retest_tree` re-derives from `links.bin` beside the tree; nothing is re-parsed.
    let reclassified = r.test.is_some();
    project.reports.insert(r.id.clone(), r);
    project.reads = project.reads.wrapping_add(1);
    if reclassified && crate::links::retest_tree(&mut project.scan, &project.reports) {
        // The window watches this like any other change to the tree.
        project.scanned = project.scanned.wrapping_add(1);
    }
    // Written through on every report. An assessment is minutes of an agent's work and
    // must not depend on the app exiting cleanly to survive.
    let write_error = save_reports(&project.repo, &project.scan, &project.reports).err();

    let WorkLeft { remaining, in_flight, .. } = work_left(project);
    // Where it actually landed. `/open` and `/status` have said this all along and this
    // did not, so the one endpoint that WRITES was the one that would not tell you which
    // repo it had written to. A reader worked it out from the order of magnitude of
    // `repo_assessed` and was right, which is not a diagnostic anyone should need.
    let landed_name = project.name.clone();
    let landed_repo = project.repo.to_string_lossy().into_owned();

    // Surfaced back to the agent, not just to the window. An implausibly low surprise
    // rate is the signature of a contaminated or agreeable reader, and telling the
    // caller lets it correct course rather than filling a repo with rubber stamps.
    let total = project.reports.len();
    // Counted off the grade, not the legacy flag: `some` and `none` are the two that
    // mean the reader was actually caught out.
    let surprised = project
        .reports
        .values()
        .filter(|r| matches!(r.grades().0, Grade::Some | Grade::None))
        .count();
    let warm = project.reports.values().filter(|r| !r.cold).count();
    let mut hint = String::new();
    if total >= 8 && surprised * 10 < total {
        hint = format!(
            "Across THIS WHOLE REPO — not your readings — only {surprised} of {total} were \
             not predicted. Nothing to answer for if your own reads were cold and \
             honest; it is aimed at whoever is driving. If readers are being handed files \
             they already know, or are being agreeable, the results mean nothing."
        );
    }
    // A failed write outranks any coaching about the reading itself: carrying on for
    // another two hundred functions that are also not being saved is the worst outcome
    // available, and only the agent is in a position to stop.
    if let Some(e) = &write_error {
        hint = e.clone();
    }
    // Last, once nothing else borrows the project.
    state.ping();
    Json(serde_json::json!({
        "ok": write_error.is_none(),
        "saved": write_error.is_none(),
        "error": write_error,
        "project": landed_name,
        "repo": landed_repo,
        "remaining": remaining,
        "in_flight": in_flight,
        // Named for their scope, because they were read as being about the caller. Two
        // readers in one wave stopped to query these: one saw "warm_reports: 1" after
        // three honest `cold: true` reports and wondered which of its own it had got
        // wrong; another read the hint's "only 2 of 21 surprising" as a verdict on its
        // three. Both then spent tokens explaining themselves. A number handed to one
        // reader that is really about every reader has to say so in its own name.
        "repo_assessed": total,
        "repo_surprised": surprised,
        "repo_warm_reports": warm,
        "hint": hint,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::reveal::reveal;
    use crate::agentapi::tests::{data_home, lease_kind, project_of};
    use crate::agentapi::{AppState, RevealRequest};
    use std::sync::{Arc, Mutex};

    /// A trap arrives with its sentence or it does not arrive.
    ///
    /// The boolean is not the finding. Reading back 894 readings in this repo, two functions
    /// were flagged `trap: true` with no note at all — a warning on a wedge that, opened,
    /// says nothing anybody can act on. The refusal is deliberate over the alternative of
    /// quietly storing `trap: false`: that would discard a reader's actual judgement to keep
    /// the store tidy, and the reader is the one party that knows what it meant.
    #[test]
    fn a_trap_must_say_what_it_is() {
        let mut r = Report { trap: true, ..Report::blank() };
        assert!(trap_without_note(&r), "a bare trap is not a finding");
        r.note = "   ".into();
        assert!(trap_without_note(&r), "and whitespace is not a sentence");
        r.note = "Reordering the log walk breaks the age stamp.".into();
        assert!(!trap_without_note(&r), "with the bite named, it stands");
        let clear = Report { trap: false, ..Report::blank() };
        assert!(!trap_without_note(&clear), "no trap, nothing to say");
    }

    /// A report is refused while any part of its body is still outstanding.
    ///
    /// **The half that does not depend on a reader choosing to be honest.** Eighteen
    /// readings in this corpus were graded against bodies their readers never received, and
    /// every one of them said so in a `note` nothing aggregates while grading anyway. The
    /// rule was already written down for readers; readers improvised around it. This is the
    /// server refusing on evidence it owns.
    #[tokio::test]
    async fn a_report_with_parts_outstanding_is_refused() {
        let _data = data_home();
        let dir = tempfile::tempdir().unwrap();
        // One function large enough to page, so the reader gets part 1 of several.
        let body: String = (0..3000).map(|i| format!("    let x{i} = {i};\n")).collect();
        std::fs::write(dir.path().join("a.rs"), format!("fn big() {{\n{body}}}\n")).unwrap();
        let mut state = AppState::default();
        state.projects.insert("/p".into(), project_of(dir.path()));
        state.touch("/p");
        let shared: Shared = Arc::new(Mutex::new(state));

        let task = lease_kind(&shared, "/p", false).await;
        let Json(first) = reveal(
            State(shared.clone()),
            Json(RevealRequest {
                project: Some("/p".into()),
                id: task.id.clone(),
                expected: "assigns a lot of variables".into(),
                part: None,
            }),
        )
        .await;
        assert_eq!(first["ok"], true, "{first}");
        let parts = first["parts"].as_u64().expect("a part count");
        assert!(parts > 1, "fixture did not page: {first}");
        assert!(first["next_step"].is_string(), "a paged reply must say there is more");

        let mut r = Report::blank();
        r.id = task.id.clone();
        r.found = "assigns a lot of variables".into();
        r.predicted = Some(Grade::Full);
        let Json(out) = report(
            State(shared.clone()),
            Json(ReportRequest { project: Some("/p".into()), report: r.clone() }),
        )
        .await;
        assert_eq!(out["ok"], false, "a partial reading was accepted: {out}");
        assert_eq!(out["saved"], false);

        // The lease survives the refusal, so the reader can fetch the rest and send the
        // same reading again. Dropping it would make a refusal cost a reading rather than
        // a round trip, and the function would go back in the queue for somebody else.
        for part in 2..=parts {
            let Json(more) = reveal(
                State(shared.clone()),
                Json(RevealRequest {
                    project: Some("/p".into()),
                    id: task.id.clone(),
                    expected: "a revision that must not land".into(),
                    part: Some(part as usize),
                }),
            )
            .await;
            assert_eq!(more["ok"], true, "part {part} was refused: {more}");
        }
        let Json(out) = report(
            State(shared.clone()),
            Json(ReportRequest { project: Some("/p".into()), report: r }),
        )
        .await;
        assert_eq!(out["ok"], true, "the completed reading was refused: {out}");
        // Stamped from what the server served, never from the reader — and it is what makes
        // this reading survive `is_stale`, where one without it would expire.
        let saved = lock(&shared).projects["/p"].reports[&task.id].clone();
        assert_eq!(saved.paged, Some(parts as usize), "the part count was not stamped");
        // The prediction is still the one written before any bytes went out, across every
        // one of those calls.
        assert_eq!(saved.expected, "assigns a lot of variables");
    }

    /// A truncated call is refused, and honest prose about markup is not.
    ///
    /// The grade is what is at stake: `Report::grades` folds a missing `predicted` to
    /// `Full`, so a report that lost its fields to a serialisation accident banks the
    /// greenest reading on the scale rather than failing. The second half matters as much
    /// — this repo's own readings discuss JSX, so a rule that fires on any angle bracket
    /// would refuse real work.
    #[test]
    fn a_report_carrying_its_own_tool_call_is_refused() {
        let leaked = Report {
            found: "…outside the scroll area.</found> <parameter name=\"predicted\">most".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&leaked), Some("found"));
        // What it would have banked, had it been accepted: `most` on the wire, `full` in
        // the store.
        assert_eq!(leaked.grades().0, Grade::Full);

        let trailing = Report {
            expected: "A component returning <div> with the node's name.</expected>".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&trailing), Some("expected"));

        let honest = Report {
            expected: "Renders a <p> inside <div className=\"panel\"> when unread.".into(),
            found: "Exactly that, plus a <hr> above the counts.".into(),
            note: "The `</p>` here is prose about markup, not a leak.".into(),
            ..Report::blank()
        };
        assert_eq!(mangled(&honest), None);
    }

    /// A leak with every grade behind it is a complete reading, and refusing it is how the
    /// guard cost this repo a paragraph: the reader cannot see its own serialisation, so
    /// the only lever it has is the prose, and it shortened until something was accepted.
    /// The trailing tag is kept as sent — cosmetic, in a store people read — because the
    /// alternative is parsing the leak back out, which is the shape of the migration that
    /// once destroyed a project's readings.
    #[test]
    fn a_leak_with_its_grades_intact_is_a_reading_and_is_kept() {
        let complete = Report {
            found: "…and a pinned provenance footer.</parameter>".into(),
            predicted: Some(Grade::Most),
            documented: Some(Grade::None),
            legible: Some(Grade::Most),
            ..Report::blank()
        };
        assert_eq!(mangled(&complete), None);
        // The grade the reader chose, not the `Full` a truncated call would have banked.
        assert_eq!(complete.grades().0, Grade::Most);

        // One grade short of complete is the case the guard exists for, leak and all.
        let lost_a_grade = Report { predicted: None, ..complete.clone() };
        assert_eq!(mangled(&lost_a_grade), Some("found"));
    }
}
