//! `.sanity/` — the assessment, committed to the repo it describes.
//!
//! Readings used to live in `~/Library/Application Support/Sanity/reports/<hash>.json`,
//! keyed by the absolute path of the repo *on one machine*. That made an assessment
//! private, opaque and mortal: it could not be reviewed, could not be shared, and died
//! with the laptop. Everything worth keeping about a repo was stored in the one place
//! that was not the repo.
//!
//! So the store moved into the tree, and the format changed with it. Markdown is not a
//! rendering here — it **is** the store, parsed back in on open. A second, authoritative
//! JSON file would have been easier and would immediately have disagreed with the
//! Markdown; and the readable copy would have been the one nobody trusted. One file that
//! both a human and an agent can read, and that `git diff` can show you, is the point.
//!
//! # Sharded by top-level directory
//!
//! One file per top-level directory (`.sanity/src-tauri.md`, `.sanity/web.md`), plus a
//! `README.md` index. A single file would read better, but two people assessing one repo
//! at the same time is the case this is built for, and a single file makes that a
//! conflict every time. Sharding puts their work in different files unless they are
//! genuinely reading the same area.
//!
//! Within a shard, entries are ordered by path then by line — never by when they were
//! written — so re-running an assessment rewrites the lines that changed and nothing
//! else. An append-ordered file conflicts on every concurrent write regardless of what
//! it contains.
//!
//! # Staleness is the lifecycle
//!
//! There is no "update" verb. Each entry records [`body_hash`] of the body it was read
//! against; on open, that is compared with what is in the file now. Disagreement means
//! the code moved out from under the reading, and the queue hands it back out first.
//! "Update my sanity assessment" is therefore the same protocol as making one — the
//! queue simply already knows which readings have expired.

use crate::agentapi::{Grade, Report};
use crate::model::NodeKind;
use crate::scan::Scan;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::process::Command;

/// A short content hash of a function body, for detecting that a reading has expired.
///
/// Whitespace is collapsed first. A reformat is not a change to what the code says, and
/// hashing raw text would let one `cargo fmt` invalidate every honest reading in the
/// repo — which trains people to ignore the staleness flag, the one signal here that
/// cannot be recomputed from the code.
pub fn body_hash(body: &str) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in body.split_whitespace().flat_map(|w| w.bytes()) {
        h ^= b as u64;
        h = h.wrapping_mul(0x1000_0000_01b3);
    }
    // 48 bits: short enough to sit in a line of prose without dominating it, wide enough
    // that a collision inside one function's history is not a thing that happens.
    format!("{:012x}", h & 0xffff_ffff_ffff)
}

pub fn dir(repo: &Path) -> PathBuf {
    repo.join(".sanity")
}

/// Which shard a repo-relative path belongs to.
///
/// Files at the repo root share one shard rather than getting a file each — a repo with
/// twenty loose config files should not produce twenty assessment files.
fn shard_of(path: &str) -> String {
    match path.split_once('/') {
        Some((top, _)) if !top.is_empty() => top.to_string(),
        _ => "root".to_string(),
    }
}

/// A shard name as a filename. Top-level directory names are already single path
/// segments, so this only has to defend against the odd hostile character.
fn shard_file(shard: &str) -> String {
    let safe: String = shard
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '-' })
        .collect();
    format!("{safe}.md")
}

/// The durable key for a reading: `path#name`, and `path#name#2` for the second
/// same-named function in that file, `#3` for the third, and so on.
///
/// Node ids carry `@line`, which cannot be the key — adding an import above a function
/// changes its id and orphans every reading of it.
///
/// But `path#name` alone is not unique, and assuming it was did real damage: Swift files
/// hold a dozen `init`s and Rust files hold same-named methods in different `impl`
/// blocks. Colliding keys meant the second twin overwrote the first, so it never got
/// written at all; its reading was silently dropped, its slot vanished from the totals,
/// and on reload BOTH twins were handed the surviving reading — which then compared
/// against the wrong body and reported itself STALE. On a real Swift repo that was 91
/// functions missing from the denominator and two false expiries.
///
/// The ordinal is position within the file, so it survives everything a line number
/// doesn't: edits above, reformatting, the function growing. Reordering two same-named
/// functions does swap their readings, which is the one case this cannot see — and a
/// swapped reading between two functions of the same name in the same file is a far
/// smaller error than the one it replaces.
fn key_of(path: &str, name: &str, ord: usize) -> String {
    if ord == 0 {
        format!("{path}#{name}")
    } else {
        format!("{path}#{name}#{}", ord + 1)
    }
}

fn grade_word(g: Grade) -> &'static str {
    match g {
        Grade::Full => "full",
        Grade::Most => "most",
        Grade::Some => "some",
        Grade::None => "none",
    }
}

fn parse_grade(s: &str) -> Option<Grade> {
    match s.trim() {
        "full" => Some(Grade::Full),
        "most" => Some(Grade::Most),
        "some" => Some(Grade::Some),
        "none" => Some(Grade::None),
        _ => None,
    }
}

/// The heading verdict — for the human skimming, never parsed back.
///
/// Derived rather than stored so it cannot drift from the grade underneath it.
fn verdict(r: &Report) -> &'static str {
    match r.grades().0 {
        Grade::Full => "as expected",
        Grade::Most => "nearly",
        Grade::Some => "surprising",
        Grade::None => "unrecognisable",
    }
}

/// Flatten prose to one line.
///
/// Every field here is one sentence by design, and keeping it on one line means an entry
/// is a fixed number of lines whose boundaries a parser cannot mistake for prose. The
/// leading `- ` of the next bullet is not a delimiter you want to be guessing at.
fn flat(s: &str) -> String {
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

// ── Reading ────────────────────────────────────────────────────────────────────

/// Load the committed assessment, keyed by the node ids of the scan in front of us.
///
/// Readings whose function no longer exists are dropped rather than carried: a reading
/// of deleted code cannot be checked and would sit in the file forever claiming
/// coverage. The entry survives in git history, which is where a deleted thing belongs.
pub fn load(repo: &Path, scan: &Scan) -> HashMap<String, Report> {
    let stored = read_all(&dir(repo));
    if stored.is_empty() {
        return HashMap::new();
    }
    let mut out = HashMap::new();
    for (key, live) in live_funcs(scan) {
        if let Some(r) = stored.get(&key) {
            let mut r = r.clone();
            r.id = live.id.clone();
            out.insert(live.id, r);
        }
    }
    out
}

/// Every entry in every shard, keyed `path#name`.
fn read_all(dir: &Path) -> HashMap<String, Report> {
    let mut out = HashMap::new();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for e in entries.flatten() {
        let path = e.path();
        if path.extension().is_none_or(|x| x != "md") {
            continue;
        }
        if path.file_name().is_some_and(|n| n == "README.md") {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            parse_shard(&text, &mut out);
        }
    }
    out
}

/// Parse one shard into `path#name` → report.
///
/// Deliberately forgiving. This file is committed, so it will be hand-edited and it will
/// be merged by hand after a conflict; a parser that rejects the whole file over one
/// malformed bullet would throw away everyone else's work to punish one typo. An
/// unrecognised line is skipped, and an entry missing its `expected`/`found` is dropped
/// on its own.
fn parse_shard(text: &str, out: &mut HashMap<String, Report>) {
    let mut file = String::new();
    let mut cur: Option<(String, Report)> = None;

    // An entry is complete only when the next heading arrives, so flushing happens both
    // in the loop and after it.
    macro_rules! flush {
        () => {
            if let Some((key, r)) = cur.take() {
                if !r.expected.is_empty() || !r.found.is_empty() {
                    out.insert(key, r);
                }
            }
        };
    }

    for line in text.lines() {
        let line = line.trim_end();
        if let Some(rest) = line.strip_prefix("## ") {
            flush!();
            file = rest.trim().trim_matches('`').to_string();
            continue;
        }
        if let Some(rest) = line.strip_prefix("### ") {
            flush!();
            if file.is_empty() {
                continue;
            }
            // "`name` — verdict" or "`name` #2 — verdict". The verdict is decoration and
            // is recomputed on write; the ordinal is part of the key.
            let head = rest.split('—').next().unwrap_or(rest).trim();
            let (name_part, ord) = match head.rsplit_once(" #") {
                Some((before, n)) => match n.trim().parse::<usize>() {
                    // Printed 1-based, keyed 0-based.
                    Ok(n) if n >= 2 => (before.trim(), n - 1),
                    _ => (head, 0),
                },
                None => (head, 0),
            };
            let name = name_part.trim().trim_matches('`');
            if name.is_empty() {
                continue;
            }
            let id = key_of(&file, name, ord);
            cur = Some((
                id.clone(),
                Report { id, ..Report::blank() },
            ));
            continue;
        }
        let Some((_, r)) = cur.as_mut() else { continue };
        let Some(bullet) = line.trim_start().strip_prefix("- ") else {
            continue;
        };
        let bullet = bullet.trim();
        if let Some(v) = bullet.strip_prefix("expected:") {
            r.expected = v.trim().to_string();
        } else if let Some(v) = bullet.strip_prefix("found:") {
            r.found = v.trim().to_string();
        } else if let Some(v) = bullet.strip_prefix("note:") {
            r.note = v.trim().to_string();
        } else {
            // The two `·`-separated lines: provenance and grades. Parsed by segment
            // prefix rather than by position, so a hand-edit that reorders or drops one
            // costs that segment and nothing else.
            for seg in bullet.split('·') {
                let seg = seg.trim();
                if let Some(v) = seg.strip_prefix("read at ") {
                    r.body = v.trim().trim_matches('`').to_string();
                } else if let Some(v) = seg.strip_prefix("commit ") {
                    r.at = v.trim().trim_matches('`').to_string();
                } else if let Some(v) = seg.strip_prefix("read by ") {
                    r.model = v.trim().to_string();
                } else if let Some(v) = seg.strip_prefix("by ") {
                    r.by = v.trim().to_string();
                } else if seg == "cold reading" {
                    r.cold = true;
                } else if seg == "warm reading" {
                    r.cold = false;
                } else if let Some(v) = seg.strip_prefix("reading ") {
                    // "reading 3 of its run" — how much of this repo the reader had
                    // already seen when it made this call. Absent on everything banked
                    // before the field existed, which is a different thing from 1 and is
                    // reported as such.
                    r.position = v
                        .split_whitespace()
                        .next()
                        .and_then(|n| n.parse().ok());
                } else if let Some(v) = seg.strip_prefix("predicted:") {
                    r.predicted = parse_grade(v);
                } else if let Some(v) = seg.strip_prefix("documented:") {
                    r.documented = parse_grade(v);
                } else if let Some(v) = seg.strip_prefix("derivable:") {
                    r.derivable = v.trim() == "yes";
                }
            }
        }
    }
    flush!();
}

// ── Writing ────────────────────────────────────────────────────────────────────

/// One function as it stands in the tree right now, for ordering and staleness.
struct Live {
    /// The scan's node id, which is what the in-memory report map is keyed by.
    id: String,
    path: String,
    name: String,
    line: u32,
    /// Which same-named function in this file this is, counting from zero in line order.
    ord: usize,
    body: String,
}

/// Every function in the scan, keyed by its durable [`key_of`].
///
/// Ordinals are assigned in line order within each file, so they have to be worked out
/// over the whole file at once rather than as each node is visited.
fn live_funcs(scan: &Scan) -> BTreeMap<String, Live> {
    let mut by_file: BTreeMap<String, Vec<(u32, String, String, String)>> = BTreeMap::new();
    scan.root.visit(&mut |n| {
        if n.kind != NodeKind::Func {
            return;
        }
        by_file.entry(n.path.clone()).or_default().push((
            n.line.unwrap_or(0),
            n.name.clone(),
            n.id.clone(),
            n.body.clone().unwrap_or_default(),
        ));
    });

    let mut out = BTreeMap::new();
    for (path, mut funcs) in by_file {
        // By line, then by id, so the ordinals are a pure function of the file and two
        // scans of unchanged code never disagree about which twin is which.
        funcs.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.2.cmp(&b.2)));
        let mut seen: HashMap<String, usize> = HashMap::new();
        for (line, name, id, body) in funcs {
            let ord = seen.entry(name.clone()).or_insert(0);
            let this = *ord;
            *ord += 1;
            out.insert(
                key_of(&path, &name, this),
                Live { id, path: path.clone(), name, line, ord: this, body },
            );
        }
    }
    out
}

/// Whether a reading still describes the code it was made against.
///
/// A reading with no hash predates this store and is taken at its word — the alternative
/// is declaring every migrated reading stale on first open, which would present a repo's
/// entire history of careful work as expired.
pub fn is_stale(report: &Report, node_body: Option<&str>) -> bool {
    match (report.body.as_str(), node_body) {
        ("", _) => false,
        (recorded, Some(now)) => recorded != now,
        (_, None) => false,
    }
}

/// One reading, tied to where its function currently sits.
struct Placed<'a> {
    line: u32,
    name: String,
    /// Which same-named function in the file this is — printed beside the name so a
    /// human reading two `init` entries can tell which one is which.
    ord: usize,
    report: &'a Report,
    /// Whether the code has moved since the reading was made.
    stale: bool,
}

/// Write the whole assessment out: one file per top-level directory, plus the index.
///
/// Rewritten in full on every report rather than appended to. A report is minutes of an
/// agent's reading and the app is far more often killed than quit, so anything deferred
/// to exit is anything lost; and a full rewrite is the only way entries stay in path
/// order, which is what keeps two people's diffs from colliding.
pub fn save(repo: &Path, scan: &Scan, reports: &HashMap<String, Report>) -> std::io::Result<()> {
    let root = dir(repo);
    std::fs::create_dir_all(&root)?;
    let live = live_funcs(scan);

    // Grouped for the file layout — shard, then source file, then position within it.
    // `BTreeMap` throughout so the output is a pure function of the readings: the same
    // set writes the same bytes, which is what lets `git diff` show only what changed.
    // Driven off the live functions, not off the reports. Walking the reports meant
    // resolving each one back to a function by name, which is exactly where twins got
    // confused; from this direction each function looks up its own reading by the key
    // that already distinguishes it, and staleness compares against its own body.
    let mut shards: BTreeMap<String, BTreeMap<String, Vec<Placed>>> = BTreeMap::new();
    for l in live.values() {
        let Some(r) = reports.get(&l.id) else { continue };
        shards
            .entry(shard_of(&l.path))
            .or_default()
            .entry(l.path.clone())
            .or_default()
            .push(Placed {
                line: l.line,
                name: l.name.clone(),
                ord: l.ord,
                report: r,
                stale: is_stale(r, Some(l.body.as_str())),
            });
    }

    let mut index = Vec::new();
    for (shard, files) in &shards {
        let mut read = 0usize;
        let mut surprising = 0usize;
        let mut stale = 0usize;
        let mut body = String::new();
        for (path, entries) in files {
            let mut entries: Vec<_> = entries.iter().collect();
            entries.sort_by(|a, b| a.line.cmp(&b.line).then_with(|| a.name.cmp(&b.name)));
            body.push_str(&format!("\n## {path}\n"));
            for e in entries {
                read += 1;
                if matches!(e.report.grades().0, Grade::Some | Grade::None) {
                    surprising += 1;
                }
                if e.stale {
                    stale += 1;
                }
                body.push_str(&render_entry(&e.name, e.ord, e.report, e.stale));
            }
        }
        // Total functions in this shard, so "12 of 400 read" is honest about the rest.
        let total = live.values().filter(|l| shard_of(&l.path) == *shard).count();
        std::fs::write(
            root.join(shard_file(shard)),
            render_shard(shard, read, total, surprising, stale, &body),
        )?;
        index.push((shard.clone(), read, total, surprising, stale));
    }

    // Shards that lost their last reading leave a file behind claiming coverage that is
    // no longer there. Cleared, not left to rot.
    if let Ok(existing) = std::fs::read_dir(&root) {
        let keep: Vec<String> = shards.keys().map(|s| shard_file(s)).collect();
        for e in existing.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.ends_with(".md") && name != "README.md" && !keep.contains(&name) {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }

    let name = repo
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "this repo".to_string());
    std::fs::write(root.join("README.md"), render_index(&name, &index))?;
    Ok(())
}

fn render_entry(name: &str, ord: usize, r: &Report, stale: bool) -> String {
    let mut s = String::new();
    let tail = if stale { " — STALE" } else { "" };
    // The ordinal is only printed when there IS a twin, so the overwhelming majority of
    // entries read as a plain function name and the marker means something where it
    // appears. Parsed back as part of the key — see `key_of`.
    let nth = if ord == 0 {
        String::new()
    } else {
        format!(" #{}", ord + 1)
    };
    s.push_str(&format!("\n### `{}`{} — {}{}\n", name, nth, verdict(r), tail));

    let mut meta = Vec::new();
    if !r.body.is_empty() {
        meta.push(format!("read at `{}`", r.body));
    }
    if !r.at.is_empty() {
        meta.push(format!("commit `{}`", r.at));
    }
    if !r.model.is_empty() {
        meta.push(format!("read by {}", r.model));
    }
    if !r.by.is_empty() {
        meta.push(format!("by {}", r.by));
    }
    meta.push(if r.cold { "cold reading" } else { "warm reading" }.to_string());
    if let Some(n) = r.position {
        meta.push(format!("reading {n} of its run"));
    }
    s.push_str(&format!("- {}\n", meta.join(" · ")));

    s.push_str(&format!("- expected: {}\n", flat(&r.expected)));
    s.push_str(&format!("- found: {}\n", flat(&r.found)));

    let (predicted, documented) = r.grades();
    let doc = documented.map_or("not judged".to_string(), |g| grade_word(g).to_string());
    s.push_str(&format!(
        "- predicted: {} · documented: {} · derivable: {}\n",
        grade_word(predicted),
        doc,
        if r.derivable { "yes" } else { "no" },
    ));

    if !r.note.trim().is_empty() {
        s.push_str(&format!("- note: {}\n", flat(&r.note)));
    }
    if stale {
        s.push_str(
            "- this code has changed since it was read; the reading above may no longer\n  \
             describe it, and Sanity will offer it for re-reading first.\n",
        );
    }
    s
}

fn render_shard(
    shard: &str,
    read: usize,
    total: usize,
    surprising: usize,
    stale: usize,
    body: &str,
) -> String {
    let stale_note = if stale > 0 {
        format!(" · {stale} stale")
    } else {
        String::new()
    };
    format!(
        "# {shard} — sanity assessment\n\
         \n\
         {read} of {total} functions read · {surprising} surprising{stale_note}\n\
         \n\
         Each entry below is one **reading**. An agent was given a function's name,\n\
         signature, neighbouring function names and comments — never its body — and wrote\n\
         down what it expected to find. Then it opened the file. The gap between the two\n\
         is the finding.\n\
         \n\
         `read at` is a hash of the body as it was when the reading was made. When it\n\
         stops matching the code, the reading is marked STALE and goes back in the queue.\n\
         \n\
         What this is and how to add to it: [README.md](README.md)\n\
         {body}"
    )
}

fn render_index(repo: &str, shards: &[(String, usize, usize, usize, usize)]) -> String {
    let mut table = String::from("| area | read | of | surprising | stale |\n|---|---|---|---|---|\n");
    let (mut tr, mut tt, mut ts, mut tx) = (0, 0, 0, 0);
    for (shard, read, total, surprising, stale) in shards {
        table.push_str(&format!(
            "| [{}]({}) | {} | {} | {} | {} |\n",
            shard,
            shard_file(shard),
            read,
            total,
            surprising,
            stale
        ));
        tr += read;
        tt += total;
        ts += surprising;
        tx += stale;
    }
    table.push_str(&format!("| **total** | **{tr}** | **{tt}** | **{ts}** | **{tx}** |\n"));

    format!(
        "# Sanity assessment — {repo}\n\
         \n\
         A record of how well this repo reads to someone who has not read it.\n\
         \n\
         Each entry in the files below is one **reading**: an agent was shown a\n\
         function's name, signature, neighbouring function names and comments — never its\n\
         body — and wrote down what it expected to find. Then it opened the file. The gap\n\
         between the prediction and the code is the finding.\n\
         \n\
         A function nobody guessed wrong about is boilerplate. A function that caught out\n\
         a competent reader is where this repo keeps its decisions — and is worth either\n\
         a comment or a second look.\n\
         \n\
         **These files are meant to be read.** You need no software to get the value out\n\
         of them: open one and read it like notes from a code review. A human and an\n\
         agent can both work from them as they are.\n\
         \n\
         {table}\
         \n\
         ## Seeing it as a map\n\
         \n\
         Sanity draws the same repo as a sunburst — every function a wedge, width by\n\
         lines, colour by how much of it nobody saw coming. Open this repo in the app and\n\
         these readings load with it.\n\
         \n\
         ```\n\
         brew install --cask monsterdept/tap/sanity\n\
         ```\n\
         \n\
         Or download it for macOS or Windows from <https://sanity.monster>.\n\
         \n\
         ## Updating this assessment\n\
         \n\
         Readings go stale. Each one records a hash of the body it was made against, so\n\
         when the code moves out from under a reading, Sanity marks it STALE and offers\n\
         it for re-reading before anything else. Nothing here silently keeps claiming to\n\
         be current.\n\
         \n\
         With the app running and its MCP server connected (the app offers this under\n\
         Connect), ask Claude:\n\
         \n\
         > update my sanity assessment\n\
         \n\
         It re-reads what changed and what was never covered, and rewrites these files.\n\
         \n\
         **Anyone with the repo can do this.** Readings are not owned by whoever made\n\
         them: `by` on each entry is provenance you can read, not a claim on the entry.\n\
         Files are split by top-level directory and entries are ordered by position in\n\
         the file, never by when they were written, so two people assessing different\n\
         areas produce diffs that do not touch.\n\
         \n\
         ## Commit this directory\n\
         \n\
         A reading is minutes of careful work by a reader that will never see this code\n\
         fresh again. Unlike everything else Sanity shows you, it cannot be recomputed.\n"
    )
}

// ── Provenance ─────────────────────────────────────────────────────────────────

fn git(repo: &Path, args: &[&str]) -> Option<String> {
    let out = Command::new("git").arg("-C").arg(repo).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    (!s.is_empty()).then_some(s)
}

/// The commit a reading was made at. Empty outside a git repo, which is allowed —
/// an assessment of a directory with no history is still an assessment.
pub fn head(repo: &Path) -> String {
    git(repo, &["rev-parse", "--short", "HEAD"]).unwrap_or_default()
}

/// Who made a reading, by the same identity git would put on a commit.
///
/// Recorded so a reader of the file can weigh an entry — not to partition the store.
/// Nothing anywhere keys off this.
pub fn who(repo: &Path) -> String {
    git(repo, &["config", "user.email"])
        .or_else(|| git(repo, &["config", "user.name"]))
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report(id: &str, note: &str) -> Report {
        Report {
            id: id.to_string(),
            expected: "a thing\nover two lines".to_string(),
            found: "another thing".to_string(),
            predicted: Some(Grade::Some),
            documented: Some(Grade::Full),
            derivable: false,
            note: note.to_string(),
            cold: true,
            position: Some(3),
            body: "aabbccddeeff".to_string(),
            by: "ross@rossturk.com".to_string(),
            at: "37eb765".to_string(),
            ..Report::blank()
        }
    }

    #[test]
    fn round_trips() {
        let r = report("src/a.rs#foo@12", "a note");
        let mut body = String::from("\n## src/a.rs\n");
        body.push_str(&render_entry("foo", 0, &r, false));
        let text = render_shard("src", 1, 1, 1, 0, &body);

        let mut back = HashMap::new();
        parse_shard(&text, &mut back);
        let got = back.get("src/a.rs#foo").expect("entry survived the round trip");
        assert_eq!(got.expected, "a thing over two lines");
        assert_eq!(got.found, "another thing");
        assert_eq!(got.note, "a note");
        assert_eq!(got.body, "aabbccddeeff");
        assert_eq!(got.at, "37eb765");
        assert_eq!(got.by, "ross@rossturk.com");
        assert!(got.cold);
        assert!(!got.derivable);
        assert_eq!(got.predicted, Some(Grade::Some));
        assert_eq!(got.documented, Some(Grade::Full));
        // Where the reading sat in its reader's run. `read at`, `read by` and `reading N`
        // all start "read", so this is also the check that the segment prefixes still
        // pick each other apart.
        assert_eq!(got.position, Some(3));
    }

    /// A reading banked before position existed must come back as unknown, never as 1.
    ///
    /// The distinction is the entire point of the field: an unrecorded position is not a
    /// claim that the reader was on its first function, and silently treating it as one
    /// would make a batched run look uniform — which is the state this was added to make
    /// visible.
    #[test]
    fn a_reading_without_a_position_does_not_claim_to_be_the_first() {
        let mut back = HashMap::new();
        parse_shard(
            "## src/a.rs\n\
             \n### `foo` — surprising\n\
             - read at `aabb` · by dana@example.com · cold reading\n\
             - expected: x\n\
             - found: y\n\
             - predicted: some · documented: none · derivable: no\n",
            &mut back,
        );
        assert_eq!(back["src/a.rs#foo"].position, None);
    }

    /// The key is `path#name`, never the node id: a reading must survive somebody adding
    /// an import above the function it describes.
    #[test]
    fn key_ignores_line_numbers() {
        let a = scan_of(&[("src/a.rs", "foo", 12, "body")]);
        let b = scan_of(&[("src/a.rs", "foo", 480, "body")]);
        assert_eq!(
            live_funcs(&a).keys().collect::<Vec<_>>(),
            live_funcs(&b).keys().collect::<Vec<_>>()
        );
    }

    /// Two `init`s in one Swift file used to share a key. The second overwrote the first,
    /// so one reading was dropped on write, the slot vanished from the totals, and on
    /// reload both functions were handed the survivor's reading — which then compared
    /// against the wrong body and reported itself STALE.
    #[test]
    fn same_named_functions_in_one_file_stay_apart() {
        let scan = scan_of(&[
            ("A.swift", "init", 10, "one"),
            ("A.swift", "init", 40, "two"),
            ("A.swift", "other", 70, "three"),
        ]);
        let live = live_funcs(&scan);
        assert_eq!(live.len(), 3, "no function is lost to a key collision");
        assert!(live.contains_key("A.swift#init"));
        assert!(live.contains_key("A.swift#init#2"));
        // Each twin keeps its OWN body, which is what stopped the false expiries.
        assert_eq!(live["A.swift#init"].body, body_hash("one"));
        assert_eq!(live["A.swift#init#2"].body, body_hash("two"));

        // And the ordinal survives the file round trip.
        let tmp = std::env::temp_dir().join(format!("sanity-twins-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let reports: HashMap<String, Report> = live
            .values()
            .map(|l| {
                (l.id.clone(), Report { body: l.body.clone(), ..report(&l.id, l.name.clone().as_str()) })
            })
            .collect();
        save(&tmp, &scan, &reports).unwrap();
        let back = load(&tmp, &scan);
        assert_eq!(back.len(), 3, "every reading came back to its own function");
        for l in live.values() {
            assert!(!is_stale(&back[&l.id], Some(l.body.as_str())), "{} is not stale", l.id);
        }
        let _ = std::fs::remove_dir_all(&tmp);
    }

    /// A reformat must not expire a repo's worth of honest readings.
    #[test]
    fn hash_ignores_formatting() {
        assert_eq!(
            body_hash("if x {\n    go();\n}"),
            body_hash("if x {\n        go();\n    }")
        );
        assert_ne!(body_hash("go()"), body_hash("stop()"));
    }

    #[test]
    fn stale_when_the_body_moves() {
        let r = report("src/a.rs#foo@1", "");
        assert!(!is_stale(&r, Some("aabbccddeeff")));
        assert!(is_stale(&r, Some("000000000000")));
        // A migrated reading with no recorded hash is taken at its word.
        let old = Report { body: String::new(), ..r };
        assert!(!is_stale(&old, Some("000000000000")));
    }

    /// A hand-merged file will have damage in it. One broken entry must not cost the
    /// rest of the file.
    #[test]
    fn survives_a_mangled_entry() {
        let text = "## src/a.rs\n\
                    \n### `broken` — surprising\n\
                    - read at `dead`\n\
                    \n### `intact` — nearly\n\
                    - read at `beef` · by dana@example.com · cold reading\n\
                    - expected: something\n\
                    - found: something else\n\
                    - predicted: most · documented: none · derivable: yes\n";
        let mut out = HashMap::new();
        parse_shard(text, &mut out);
        assert!(!out.contains_key("src/a.rs#broken"), "an entry with no reading is dropped");
        let ok = out.get("src/a.rs#intact").expect("its neighbour survives");
        assert_eq!(ok.predicted, Some(Grade::Most));
        assert!(ok.derivable);
    }

    /// Build a scan holding one function per named `path#name@line`.
    fn scan_of(funcs: &[(&str, &str, u32, &str)]) -> Scan {
        use crate::model::Node;
        let mut root = Node::dir("", "");
        let mut by_file: BTreeMap<String, Vec<Node>> = BTreeMap::new();
        for (path, name, line, body) in funcs {
            let mut n = Node::dir(path, name);
            n.kind = NodeKind::Func;
            n.id = format!("{path}#{name}@{line}");
            n.path = path.to_string();
            n.line = Some(*line);
            n.body = Some(body_hash(body));
            by_file.entry(path.to_string()).or_default().push(n);
        }
        for (path, kids) in by_file {
            let mut f = Node::dir(&path, &path);
            f.kind = NodeKind::File;
            f.children = kids;
            root.children.push(f);
        }
        Scan {
            root,
            stats: crate::scan::ScanStats {
                files_scanned: 0,
                files_skipped: 0,
                functions: funcs.len(),
                without_history: true,
                model: "test".into(),
            },
        }
    }

    /// The whole point, exercised end to end: write the repo's assessment, read it back,
    /// and confirm a reading survives the source moving down the file.
    #[test]
    fn writes_and_reloads_a_repo_assessment() {
        let tmp = std::env::temp_dir().join(format!("sanity-assess-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();

        let scan = scan_of(&[
            ("src-tauri/src/scan.rs", "walk", 40, "fn walk() {}"),
            ("web/src/app.jsx", "App", 9, "return <div/>"),
        ]);
        let reports: HashMap<String, Report> = scan
            .root
            .children
            .iter()
            .flat_map(|f| f.children.iter())
            .map(|n| {
                // The hash the server stamps on a report: whatever the scan says the
                // body was at the moment the reading was handed out.
                let r = Report { body: n.body.clone().unwrap_or_default(), ..report(&n.id, "surprising thing") };
                (n.id.clone(), r)
            })
            .collect();
        save(&tmp, &scan, &reports).unwrap();

        // Sharded per top-level directory, with an index that explains itself.
        assert!(tmp.join(".sanity/src-tauri.md").exists());
        assert!(tmp.join(".sanity/web.md").exists());
        let index = std::fs::read_to_string(tmp.join(".sanity/README.md")).unwrap();
        assert!(index.contains("sanity.monster"), "the index says where to get the app");
        assert!(index.contains("update my sanity assessment"), "and how to refresh it");

        // The same functions, moved down the file and one of them rewritten.
        let moved = scan_of(&[
            ("src-tauri/src/scan.rs", "walk", 118, "fn walk() {}"),
            ("web/src/app.jsx", "App", 9, "return <span/>"),
        ]);
        let back = load(&tmp, &moved);
        assert_eq!(back.len(), 2, "both readings found their functions again");
        let walk = back.get("src-tauri/src/scan.rs#walk@118").unwrap();
        assert!(!is_stale(walk, Some(&body_hash("fn walk() {}"))), "unchanged body, still current");
        let app = back.get("web/src/app.jsx#App@9").unwrap();
        assert!(is_stale(app, Some(&body_hash("return <span/>"))), "body changed, reading expired");

        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn shards_by_top_level_dir() {
        assert_eq!(shard_of("src-tauri/src/scan.rs"), "src-tauri");
        assert_eq!(shard_of("justfile"), "root");
        assert_eq!(shard_file("src-tauri"), "src-tauri.md");
    }

}
