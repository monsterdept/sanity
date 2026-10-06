//! The verbs that answer from `.sanity/` alone: `refresh` rewrites it, `verify` rules on it.
//!
//! Both run in-process and neither asks a backend. A rewrite has to be done by THIS build,
//! not by whatever daemon happens to be answering, and a release gate runs where no reader
//! should — so each one scans, loads the store, and acts on what is on disk.

use super::commas;
use super::status::read_repo;
use crate::agentapi;

/// Rewrite a repo's `.sanity/` in the CURRENT format, in place.
///
/// **This is the migration mechanism, and there will never be a migrator.** `.sanity/` is
/// Markdown that is parsed back, so a format change is not a data change: `parse_shard`
/// reads a heading as everything before the em-dash and recomputes what follows it on write,
/// so every reading survives a round trip through a renderer that has moved on. Rewriting is
/// therefore reading and writing, not translating — and a translator is precisely the thing
/// that once destroyed a project's readings by matching legacy entries on node ids that had
/// moved. **When the format changes, run this. Do not write a migration.**
///
/// The one durable rule it depends on: whatever changes, the shard must still parse under
/// the OLD reader long enough to be re-rendered by the new one. Adding a bullet or moving
/// decoration after the em-dash is free. Changing what a key is made of is not, and would be
/// the same class of change as the migration that failed — see `key_of`.
///
/// **In-process, not through the backend, and that is the whole reason it exists.** Every
/// other write verb would go through `/open`, which refreshes as a matter of course. But the
/// backend that answers may be an app somebody started this morning, from a binary that
/// renders the format you are trying to leave — and `serve` is idempotent, so a newer binary
/// politely declines to replace it. A verb whose entire job is "apply THIS build's format"
/// cannot be a formatter over a daemon of unknown vintage.
///
/// Nothing is created: `assessment::refresh` writes only files that are already there, so a
/// repo with no assessment comes back untouched and says so.
pub fn refresh(path: &str) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    if !crate::assessment::dir(&path).is_dir() {
        println!();
        println!("{} has no .sanity/ — nothing to rewrite.", path.to_string_lossy());
        println!();
        return 0;
    }
    let scans = crate::scancache::ScanCache::open(&path);
    let scan = match crate::scan::scan(
        &path,
        &|_| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        &scans,
        // Ordering, matching an open. The proxy scores decide nothing that is written here —
        // a shard holds readings, and a reading is an agent's — so paying for the all-pairs
        // term would buy a number this verb does not print.
        crate::scan::Fidelity::Ordering,
        // Untraced, on the same argument. A shard is keyed by `key_of` and hashed against the
        // doc and the body; no line of it comes from git. This verb rewrote the format and
        // waited out a full blame pass to do it.
        crate::trace::Depth::Untraced,
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("sanity: could not scan {}: {e}", path.to_string_lossy());
            return 1;
        }
    };
    let reports = crate::assessment::load(&path, &scan);
    println!();
    match crate::assessment::refresh(&path, &scan, &reports) {
        // Reported, never absorbed — the same rule `save_reports` follows. A rewrite that
        // failed halfway leaves an index and its shards disagreeing, which is the one state
        // this whole file is written to prevent.
        crate::assessment::Index::Failed(e) => {
            eprintln!("sanity: {e}");
            println!();
            1
        }
        crate::assessment::Index::Absent => {
            println!("{} has no index — nothing to rewrite.", path.to_string_lossy());
            println!();
            0
        }
        crate::assessment::Index::Current => {
            println!("{} — already current, nothing written.", path.to_string_lossy());
            println!("  {} readings", commas(reports.len() as u64));
            println!();
            0
        }
        crate::assessment::Index::Refreshed => {
            println!("{} — rewritten.", path.to_string_lossy());
            println!("  {} readings, all of them re-rendered", commas(reports.len() as u64));
            println!();
            println!("Read the diff before committing it. A format change should move headings");
            println!("and prose; a change in the BULLETS is a reading that did not survive.");
            println!();
            0
        }
    }
}

/// Fail unless every reading is present, current, and taken by one agent and model.
///
/// **A gate, and never a reader.** It runs where credentials should not be — a release job —
/// so it spawns nothing and asks no backend; it scans, loads `.sanity/`, and rules. Readings
/// are a developer's to take, against the code they are about to ship, with `sanity check`.
///
/// Three checks, each printed whether it passed or not so a green run says what it proved:
///
/// - **complete**: no unit is unread.
/// - **current**: no reading is stale against the body at HEAD, and none is dated by a `SPEC`
///   bump. A dated reading is one `sanity check` would re-queue, so a gate that passed it
///   would disagree with the verb it tells people to run.
/// - **one instrument**: every current reading names the same harness and model, and names
///   one. The model is the scale, so a repo read on two is two measurements drawn as one map.
///   `--model` and `--harness` pin which one, for a release that must be on a stated scale.
///   `--mixed` waives it: the row reads `skip` and the tally still prints, so a waived mix
///   is on screen rather than silent.
///
/// Exit 0 when all three pass, 1 when any fails, 2 when the repo cannot be scanned.
pub fn verify(path: &str, model: Option<&str>, harness: Option<&str>, mixed: bool) -> i32 {
    use crate::agentapi::Owed;
    let repo = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    // Refused before anything is counted. A directory with nothing to read passes `complete`
    // and `current` for want of anything to fail them, so the wrong path — or a repo that was
    // never read — would pass the gate whenever the instrument check is waived.
    if !crate::assessment::dir(&repo).is_dir() {
        println!();
        println!("{} has no .sanity/ — there are no readings to verify.", repo.to_string_lossy());
        println!();
        if std::env::var_os("GITHUB_ACTIONS").is_some_and(|v| v == "true") {
            println!("::error title=sanity::no .sanity/ in {}", repo.to_string_lossy());
        }
        return 1;
    }
    let Some((scan, reports)) = read_repo(&repo) else { return 2 };
    let v = agentapi::verify(&scan, &reports);
    // Annotations are GitHub's syntax, so they are written only where GitHub reads them.
    let github = std::env::var_os("GITHUB_ACTIONS").is_some_and(|v| v == "true");
    const SHOWN: usize = 20;
    const ANNOTATED: usize = 10;

    let of = |owed: Owed| v.outstanding.iter().filter(move |o| o.owed == owed);
    let unread = of(Owed::Unread).count();
    let stale = of(Owed::Stale).count();
    let dated = of(Owed::Dated).count();

    let complete = unread == 0;
    let current = stale == 0 && dated == 0;
    let unattributed = |i: &agentapi::Instrument| i.harness.is_empty() || i.model.is_empty();
    let pinned = |i: &agentapi::Instrument| {
        model.is_none_or(|m| i.model == m) && harness.is_none_or(|h| i.harness == h)
    };
    let one = v.instruments.len() == 1 && !unattributed(&v.instruments[0]) && pinned(&v.instruments[0]);

    let label = |i: &agentapi::Instrument| {
        let model = if i.model.is_empty() { "no model named" } else { &i.model };
        let harness = if i.harness.is_empty() { "no harness" } else { &i.harness };
        format!("{model} via {harness}")
    };
    let mark = |ok: bool| if ok { "pass" } else { "FAIL" };
    // Waived is not passed: the row says which, and the exit ignores it.
    let enforced = !mixed;

    println!();
    println!("{}", repo.to_string_lossy());
    println!();
    println!("  {}  complete        {}", mark(complete), if complete {
        "every unit has a reading".to_string()
    } else {
        format!("{} unread", commas(unread as u64))
    });
    println!("  {}  current         {}", mark(current), if current {
        "every reading describes the code as it stands".to_string()
    } else {
        let mut parts = Vec::new();
        if stale > 0 {
            parts.push(format!("{} stale", commas(stale as u64)));
        }
        if dated > 0 {
            parts.push(format!("{} dated by a spec change", commas(dated as u64)));
        }
        parts.join(", ")
    });
    let instrument_line = match v.instruments.as_slice() {
        [] => "no current readings".to_string(),
        [only] if mixed => format!("not required — {}", label(only)),
        many if mixed => format!("not required — {} instruments", many.len()),
        [only] if one => label(only),
        [only] if unattributed(only) => format!("{} — cannot be vouched for", label(only)),
        [only] => format!("{}, but {} was required", label(only), required(model, harness)),
        many => format!("{} instruments", many.len()),
    };
    println!(
        "  {}  one instrument  {}",
        if enforced { mark(one) } else { "skip" },
        instrument_line
    );

    if !complete || !current {
        for (owed, heading) in [
            (Owed::Stale, "Stale — the reading describes a body that has since changed"),
            (Owed::Unread, "Unread"),
            (Owed::Dated, "Dated — read under an older question"),
        ] {
            let list: Vec<_> = of(owed).collect();
            if list.is_empty() {
                continue;
            }
            println!();
            println!("{heading}:");
            for o in list.iter().take(SHOWN) {
                println!("  {}:{}  {}", o.path, o.line, o.name);
            }
            if list.len() > SHOWN {
                println!("  … and {} more", commas((list.len() - SHOWN) as u64));
            }
        }
    }
    if v.instruments.len() > 1 || (enforced && !one && !v.instruments.is_empty()) {
        println!();
        println!("Current readings by instrument:");
        for i in &v.instruments {
            println!("  {:>7}  {}", commas(i.readings as u64), label(i));
        }
    }

    if github {
        for o in v.outstanding.iter().take(ANNOTATED) {
            let why = match o.owed {
                Owed::Stale => "stale reading",
                Owed::Unread => "unread",
                Owed::Dated => "dated reading",
            };
            println!("::error file={},line={},title=sanity: {why}::{}", o.path, o.line, o.name);
        }
        if enforced && !one {
            println!("::error title=sanity: one instrument::{instrument_line}");
        }
    }

    println!();
    if complete && current && (one || !enforced) {
        0
    } else {
        println!("Take the missing readings with `sanity check`, commit .sanity/, and re-run.");
        println!();
        1
    }
}

/// How a `--model`/`--harness` requirement reads back in a failure line.
fn required(model: Option<&str>, harness: Option<&str>) -> String {
    match (model, harness) {
        (Some(m), Some(h)) => format!("{m} via {h}"),
        (Some(m), None) => m.to_string(),
        (None, Some(h)) => format!("via {h}"),
        (None, None) => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::data_home;

    /// **`verify` passes exactly when `sanity check` has nothing left to do and one instrument
    /// did all of it.** Each check is broken on its own against a real scan and a store
    /// written to disk and read back, so a gate that only ever says FAIL, or only ever says
    /// pass, goes red here.
    #[test]
    fn verify_refuses_each_kind_of_gap_on_its_own() {
        use crate::agentapi::{Grade, Owed, Report};
        let _home = data_home();
        let dir = tempfile::tempdir().expect("tmp");
        let repo = std::fs::canonicalize(dir.path()).expect("canonical");
        let src = repo.join("gate.rs");
        let body = |shut: &str| {
            format!(
                "//! Opens and shuts.\n\nfn open() {{\n    println!(\"1\");\n}}\n\n\
                 fn shut() {{\n    {shut}\n}}\n\nfn idle() {{\n    println!(\"3\");\n}}\n"
            )
        };
        std::fs::write(&src, body("println!(\"2\");")).expect("writes");
        let path = repo.to_string_lossy().to_string();

        let scan = || read_repo(&repo).expect("scans").0;
        let reading = |n: &crate::model::Node, model: &str, spec: u32| Report {
            id: n.id.clone(),
            expected: "a thing".into(),
            found: "the thing".into(),
            predicted: Some(Grade::Full),
            documented: Some(Grade::None),
            legible: Some(Grade::Full),
            body: n.body.clone().unwrap_or_default(),
            model: model.into(),
            harness: "claude".into(),
            spec,
            ..Report::blank()
        };
        // Every unit read by one instrument at the current spec, except the names in `skip`.
        let read_all = |skip: &[&str], odd: Option<(&str, &str, u32)>| {
            let s = scan();
            let mut out = std::collections::HashMap::new();
            s.root.visit(&mut |n| {
                use crate::model::NodeKind::{File, Func};
                if !matches!(n.kind, Func | File) || skip.contains(&n.name.as_str()) {
                    return;
                }
                let r = match odd {
                    Some((name, model, spec)) if n.name == name => reading(n, model, spec),
                    _ => reading(n, "sonnet", crate::assessment::SPEC),
                };
                out.insert(n.id.clone(), r);
            });
            crate::assessment::save(&repo, &s, &out).expect("saves");
        };
        let owed = || {
            let (s, r) = read_repo(&repo).expect("scans");
            let v = crate::agentapi::verify(&s, &r);
            let owed: Vec<(Owed, String)> =
                v.outstanding.into_iter().map(|o| (o.owed, o.name)).collect();
            (owed, v.instruments.len())
        };

        // Nothing read: every unit unread, and there is no instrument to vouch for.
        assert_eq!(verify(&path, None, None, false), 1);

        // A directory with nothing in it owes nothing, and must still not pass.
        let empty = tempfile::tempdir().expect("tmp");
        let empty = empty.path().to_string_lossy().to_string();
        assert_eq!(verify(&empty, None, None, true), 1, "no .sanity/ is not a pass");

        read_all(&["idle"], None);
        assert_eq!(owed(), (vec![(Owed::Unread, "idle".to_string())], 1));
        assert_eq!(verify(&path, None, None, false), 1, "one unread fails");

        read_all(&[], None);
        assert_eq!(owed(), (vec![], 1));
        assert_eq!(verify(&path, None, None, false), 0, "complete, current, one instrument");
        assert_eq!(verify(&path, Some("sonnet"), Some("claude"), false), 0, "the pinned one");
        assert_eq!(verify(&path, Some("haiku"), None, false), 1, "one model, but not the required one");

        std::fs::write(&src, body("println!(\"two\");")).expect("writes");
        assert_eq!(owed(), (vec![(Owed::Stale, "shut".to_string())], 1));
        assert_eq!(verify(&path, None, None, false), 1, "a moved body fails");

        std::fs::write(&src, body("println!(\"2\");")).expect("writes");
        read_all(&[], Some(("idle", "sonnet", 0)));
        assert_eq!(owed(), (vec![(Owed::Dated, "idle".to_string())], 1));
        assert_eq!(verify(&path, None, None, false), 1, "a dated axis fails");

        read_all(&[], Some(("idle", "haiku", crate::assessment::SPEC)));
        assert_eq!(owed(), (vec![], 2));
        assert_eq!(verify(&path, None, None, false), 1, "two models fail with nothing owed");
        assert_eq!(verify(&path, None, None, true), 0, "unless a mix is allowed");

        // Allowing a mix waives the instrument and nothing else.
        read_all(&["idle"], Some(("open", "haiku", crate::assessment::SPEC)));
        assert_eq!(verify(&path, None, None, true), 1, "an unread unit still fails a mixed repo");
    }
}
