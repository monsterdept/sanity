//! The `export-data` verb: everything the report reads for one repo, as one JSON document.
//!
//! It is what the offline PDF renderer is handed in place of a window. [`export_of`] builds it
//! the way the app builds a project — scan untraced, deepen in memory, load the readings,
//! retest, ask the findings — so every field is what the window would have been sent.

use super::commas;
use std::time::Instant;

/// Everything the report reads, for one repo, as one JSON document.
///
/// **For the offline renderer**, which draws the PDF as a Node script with no window. Every
/// field is what the window is handed for the same repo, through the same function: the tree as
/// `project_scan` serializes it (but whole — functions included, since no second fetch is
/// coming), the readings as `agent_reports` stamps them, the groups as `project_report`
/// assembles them, and the row's counts as `ProjectList` computes them.
#[derive(serde::Serialize)]
struct Export {
    version: u32,
    name: String,
    path: String,
    remote: Option<String>,
    head: Option<crate::stamp::RepoHead>,
    #[serde(rename = "traceDepth")]
    trace_depth: crate::trace::Depth,
    grammars: usize,
    scan: crate::scan::Scan,
    reports: Vec<crate::agentapi::Report>,
    groups: Vec<crate::findings::Group>,
    summary: crate::agentapi::ReportSummary,
    /// Where the offline renderer keeps its figures for this repo — a directory, beside the
    /// other machine-local caches. `None` where there is no data dir to put it in.
    #[serde(rename = "renderCache")]
    render_cache: Option<String>,
}

/// The render cache's format version, in the slot's NAME — see `reports::cache_slot`. Bump it
/// when the renderer's figures change shape, and the old slot ages out through `prune_slots`.
const RENDER_TAG: &str = "r1";

/// Build the export the way the app builds a project: scan untraced, deepen in memory.
///
/// **Untraced first, then `trace::deepen`, because that is what hits the tree cache.** The app
/// never scans at a depth — a traced signature mixes HEAD — so a scan asked for `Files` here
/// would miss the cached map every time and pay the parse on a repo the window opens in a
/// fraction of a second. Readings load AFTER the trace, as `restore` loads them, and the
/// reader's test classifications land through `links::retest_tree` before any finding is
/// asked, as `survey` does.
///
/// `depth: None` is what the app last banked for this repo, else `Files` — the depth an open
/// deepens to. A banked `untraced` is honoured: it is what the window is drawing.
fn export_of(
    path: &std::path::Path,
    depth: Option<crate::trace::Depth>,
    lap: &dyn Fn(&str),
) -> Result<Export, String> {
    let scans = crate::scancache::ScanCache::open(path);
    let mut scan = crate::scan::scan(
        path,
        &|_| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        &scans,
        crate::scan::Fidelity::Ordering,
        crate::trace::Depth::Untraced,
    )
    .map_err(|e| format!("could not scan {}: {e}", path.to_string_lossy()))?;
    lap("scan");

    let want = depth.unwrap_or_else(|| {
        crate::reports::banked_depth(path)
            .map(|tag| crate::trace::Depth::from_tag(&tag))
            .unwrap_or(crate::trace::Depth::Files)
    });
    let (reached, _, _) = crate::trace::deepen(
        path,
        &mut scan,
        want,
        &scans,
        &std::sync::atomic::AtomicBool::new(false),
        &|_| {},
        &|_| {},
    );
    lap(reached.tag_str());

    let reports = crate::assessment::load(path, &scan);
    crate::links::retest_tree(&mut scan, &reports);
    let stamped = crate::stamp::stamp_reports(&scan.root, &reports);
    lap("readings");

    let traced = crate::findings::Traced::of(&scan.stats, reached);
    let groups = crate::findings::project_report(path, &scan.root, &reports, traced).groups;
    lap("findings");

    let summary = crate::agentapi::report_summary(&scan, &reports, reached);
    let where_ = path.to_string_lossy().to_string();
    // The name the sidebar shows: the index's, where the app has met this repo, and otherwise
    // the directory's — which is what an open names a project it has never seen.
    let key = crate::agentapi::project_key(path);
    let name = crate::reports::load_index()
        .projects
        .into_iter()
        .find(|p| p.key == key)
        .map(|p| p.name)
        .unwrap_or_else(|| {
            path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| key.clone())
        });
    // A directory, made here so the renderer never has to guess the layout of the data dir.
    // The writer of a slot is the one that sweeps its siblings, as every other kind does.
    let render_cache = crate::reports::cache_slot("renders", path, RENDER_TAG)
        .filter(|dir| std::fs::create_dir_all(dir).is_ok())
        .map(|dir| {
            crate::reports::prune_slots("renders", path, RENDER_TAG);
            dir.to_string_lossy().to_string()
        });
    let export = Export {
        render_cache,
        version: 1,
        name,
        remote: crate::stamp::repo_remote(where_.clone()),
        head: crate::stamp::repo_head(where_.clone()),
        path: where_,
        trace_depth: reached,
        grammars: crate::parse::language_support().len(),
        scan,
        reports: stamped,
        groups,
        summary,
    };
    lap("git");
    Ok(export)
}

/// `sanity export-data` — see [`export_of`]. JSON to `out` or stdout; timing to stderr.
pub(super) fn export_data(path: &str, depth: Option<crate::trace::Depth>, out: Option<&str>) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    let started = Instant::now();
    let last = std::cell::Cell::new(started);
    let lap = |what: &str| {
        let now = Instant::now();
        eprintln!("export-data: {what:<9} {:>8.2?}", now - last.get());
        last.set(now);
    };
    let export = match export_of(&path, depth, &lap) {
        Ok(x) => x,
        Err(e) => {
            eprintln!("sanity: {e}");
            return 1;
        }
    };
    let written = match out {
        Some(file) => std::fs::File::create(file).map_err(|e| format!("{file}: {e}")).and_then(|f| {
            let mut w = std::io::BufWriter::new(f);
            serde_json::to_writer(&mut w, &export).map_err(|e| e.to_string())?;
            std::io::Write::flush(&mut w).map_err(|e| e.to_string())
        }),
        None => {
            let mut w = std::io::BufWriter::new(std::io::stdout().lock());
            serde_json::to_writer(&mut w, &export)
                .map_err(|e| e.to_string())
                .and_then(|_| std::io::Write::flush(&mut w).map_err(|e| e.to_string()))
        }
    };
    if let Err(e) = written {
        eprintln!("sanity: could not write the export: {e}");
        return 1;
    }
    lap("write");
    let size = out.and_then(|f| std::fs::metadata(f).ok()).map(|m| m.len());
    eprintln!(
        "export-data: {} at depth {}, {} readings, {} groups{} in {:.2?}",
        export.name,
        export.trace_depth.tag_str(),
        export.reports.len(),
        export.groups.len(),
        size.map(|b| format!(", {} bytes", commas(b))).unwrap_or_default(),
        started.elapsed(),
    );
    0
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::data_home;
    use serde_json::Value;

    /// **The export is what the window is handed, whole.** The offline renderer has no second
    /// fetch, so a file arriving without its functions draws a map with no inner ring; a
    /// reading arriving unstamped carries `loc: 0`, which the window reads as "this function is
    /// gone" and drops. Both are silent — the PDF still looks like a PDF.
    #[test]
    fn an_export_carries_whole_files_and_stamped_readings() {
        let _home = data_home();
        let dir = tempfile::tempdir().expect("tmp");
        let repo = std::fs::canonicalize(dir.path()).expect("canonical");
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
        let gate = repo.join("gate.rs");
        let body = |shut: &str| {
            format!(
                "fn open() {{\n    println!(\"1\");\n    println!(\"one\");\n}}\n\n\
                 fn shut() {{\n    {shut}\n}}\n"
            )
        };
        git(&["init", "-q"]);
        std::fs::write(&gate, body("println!(\"2\");")).expect("writes");
        git(&["add", "."]);
        git(&["commit", "-q", "-m", "first"]);

        // Both functions read against the bodies they have now.
        let scan = crate::scan::scan(
            &repo,
            &|_| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            &crate::scancache::ScanCache::ephemeral(),
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )
        .expect("scans");
        let mut readings = std::collections::HashMap::new();
        scan.root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                readings.insert(
                    n.id.clone(),
                    crate::agentapi::Report {
                        id: n.id.clone(),
                        expected: "a thing".into(),
                        found: "another thing".into(),
                        predicted: Some(crate::agentapi::Grade::Some),
                        documented: Some(crate::agentapi::Grade::Full),
                        legible: Some(crate::agentapi::Grade::Most),
                        note: "a note".into(),
                        body: n.body.clone().unwrap_or_default(),
                        model: "sonnet".into(),
                        ..crate::agentapi::Report::blank()
                    },
                );
            }
        });
        assert_eq!(readings.len(), 2);
        crate::assessment::save(&repo, &scan, &readings).expect("saves");

        // `shut` moves under its reading; `open` does not.
        std::fs::write(&gate, body("println!(\"two\");")).expect("writes");

        let export =
            export_of(&repo, Some(crate::trace::Depth::Files), &|_| {}).expect("exports");
        let bytes = serde_json::to_vec(&export).expect("serializes");
        let v: Value = serde_json::from_slice(&bytes).expect("parses back");

        assert_eq!(v["version"], 1);
        assert_eq!(v["traceDepth"], "files");
        assert_eq!(v["path"], repo.to_string_lossy().as_ref());

        let reports = v["reports"].as_array().expect("reports");
        assert_eq!(reports.len(), 2, "{reports:?}");
        for r in reports {
            assert!(r["loc"].as_u64().unwrap_or(0) > 0, "stamped with its size: {r}");
            let shut = r["id"].as_str().unwrap_or_default().contains("#shut");
            assert_eq!(r["stale"], shut, "only the moved body is stale: {r}");
        }

        // The file carries its functions, which the window's `project_scan` does not send.
        let files = v["scan"]["root"]["children"].as_array().expect("root children");
        let file = files.iter().find(|f| f["name"] == "gate.rs").expect("gate.rs on the map");
        let funcs = file["children"].as_array().expect("functions under the file");
        assert_eq!(funcs.len(), 2);
        assert!(funcs.iter().all(|f| f["kind"] == "func"), "{funcs:?}");
        assert!(v["scan"]["stats"].get("tangle_bands").is_some(), "stats as the window reads them");

        assert_eq!(v["summary"]["functions"], 2);
        assert_eq!(v["summary"]["assessed"], 1);
        assert_eq!(v["summary"]["stale"], 1);
        assert_eq!(v["summary"]["banked_model"], "sonnet");
        assert_eq!(v["summary"]["trace_depth"], "files");
        assert!(v["groups"].is_array());
        assert!(v["grammars"].as_u64().unwrap_or(0) > 0);
        let renders = v["renderCache"].as_str().expect("a render cache under the data dir");
        assert!(std::path::Path::new(renders).is_dir(), "made as a directory: {renders}");
        let slot = std::path::Path::new(renders);
        let kind = slot.parent().and_then(|p| p.file_name()).and_then(|n| n.to_str());
        assert!(kind == Some("renders") && renders.ends_with("-r1"), "{renders}");
    }

    /// **Factoring the stamping out changed nothing it stamps.** `agent_reports` now delegates
    /// to `stamp_reports`, so the four stamped fields are pinned here against a tree: an orphan
    /// reads `loc: 0` and not stale, a moved body reads stale, and the dating follows the spec.
    #[test]
    fn stamping_marks_size_expiry_and_dating() {
        use crate::agentapi::Report;
        use crate::model::{Node, NodeKind};
        let func = |id: &str, body: &str, loc: u32| Node {
            id: id.into(),
            kind: NodeKind::Func,
            body: Some(body.into()),
            loc,
            ..Node::dir("x", "x")
        };
        let mut root = Node::dir("", "");
        root.children = vec![func("a.rs#live@1", "h1", 7), func("a.rs#moved@9", "h2", 3)];
        let mut reports = std::collections::HashMap::new();
        for (id, body, spec, trap) in [
            ("a.rs#live@1", "h1", crate::assessment::SPEC, true),
            ("a.rs#moved@9", "old", 0, true),
            ("a.rs#gone@20", "h9", 0, false),
        ] {
            reports.insert(
                id.to_string(),
                Report { id: id.into(), body: body.into(), spec, trap, ..Report::blank() },
            );
        }
        let by: std::collections::HashMap<String, Report> =
            crate::stamp::stamp_reports(&root, &reports)
                .into_iter()
                .map(|r| (r.id.clone(), r))
                .collect();
        let live = &by["a.rs#live@1"];
        assert_eq!((live.loc, live.stale, live.legible_dated, live.trap_dated), (7, false, false, false));
        let moved = &by["a.rs#moved@9"];
        assert_eq!((moved.loc, moved.stale, moved.legible_dated, moved.trap_dated), (3, true, true, true));
        let gone = &by["a.rs#gone@20"];
        assert_eq!((gone.loc, gone.stale, gone.legible_dated, gone.trap_dated), (0, false, true, false));
    }
}
