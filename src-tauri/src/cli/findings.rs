//! The findings verbs: the ranked list, who calls a function, and the decisions about both.
//!
//! None of them asks the backend. A finding is the tree, the readings in `.sanity/` and the
//! rules beside them, all on disk, so each verb here builds one [`Survey`] in-process and
//! answers from it: [`findings`] lists, [`callers`] names the pairs behind a count, [`decide`]
//! files a verdict per rule, [`clear`] takes them back and [`balance`] proposes thresholds.
//! Every write is read back off the disk before it is reported.

use super::trace::{duration, rung_name, Rung};
use super::{commas, plural};

/// What is worth looking at in this repo, ranked.
///
/// **In process, like `refresh` and unlike `status`.** The read verbs ask the backend because
/// what they report is partly LIVE — what is out with readers this second — and a number that
/// stale is worse than no number. A finding is not live: it is the tree, the readings in
/// `.sanity/` and the rules beside them, all of which are on disk. Asking a daemon for it
/// would mean an endpoint, a second answer, and a repo whose findings depend on whether the
/// app happens to be open.
///
/// **One subject per entry, not one per rule**, the same merge the panel does — a function
/// three rules flagged is one thing to look at, not three. `just findings` prints the other
/// view, per rule with its calibration and its marginal contribution; that is a question about
/// the CATALOG and this is a question about the repo.
pub fn findings(path: &str, limit: usize, edits: bool, blame: bool) -> i32 {
    let Survey { path, facts, rules, traced, read, declined, .. } =
        match survey(path, Rung::of(edits, blame)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let groups = crate::findings::report(
        &facts,
        traced,
        read,
        &rules,
        &crate::findings::archive(&path),
    );
    list(&path, limit, &groups, declined)
}

/// Who calls one function, named rather than counted.
///
/// **The pairs behind the number, because a count cannot be argued with.** `callers` and
/// `dependents` are folded from the edge list [`crate::edges::wire`] builds, and a finding
/// spends them in a sentence — *a change here has to be checked against all 21*. Whether that
/// sentence is true is not something the number can answer: calls resolve by NAME and there is
/// no type checker, so the only check available is to read the callers back and see whether
/// they are the ones a person would name. See `docs/notes/wiring.md`, which is the record of
/// this going wrong twice.
///
/// **Grouped by file, with the subject's own file marked, because that split is the tell.**
/// A caller in another file is a claim that one file reaches into another, and for a body its
/// language cannot export that claim is false by construction rather than merely unlikely.
pub(super) fn callers(path: &str, key: &str) -> i32 {
    // Files, as it always was: a caller list reads no history, and pricing blame to print one
    // would be paying for a question nobody asked.
    let Survey { facts, links, .. } = match survey(path, Rung::Exactly(crate::trace::Depth::Files)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let Some(f) = facts.iter().find(|f| f.subject.key == key) else {
        eprintln!("sanity: `{key}` is not on the map.");
        eprintln!("       `sanity findings` prints the key of every finding, which is this.");
        return 1;
    };
    let s = &f.subject;
    // A file has no body and makes no calls; the question only means something about a
    // function, and answering it with an empty list would read as one nothing calls.
    let Some(line) = s.line else {
        eprintln!("sanity: `{key}` is a file, and callers are a question about a function.");
        return 1;
    };
    if links.is_empty() {
        eprintln!("sanity: this scan built no call graph, so nothing here can be answered.");
        return 1;
    }
    let Some(rel) = links.at(&s.path, line) else {
        eprintln!("sanity: no function starts at {}:{line}.", s.path);
        return 1;
    };

    println!();
    println!("{key}");
    // **Not read for calls is not "nothing calls it".** The same distinction `Related::wired`
    // is carried for: an empty list from a language nobody taught this to follow is a silence,
    // and printing it as a zero would be the instrument claiming a measurement it never took.
    if !rel.wired {
        let lang = s.lang.clone().unwrap_or_else(|| "this language".to_string());
        println!("  {lang} is not read for calls here, so no caller is claimed.");
        println!();
        return 0;
    }
    let here = rel.callers.iter().filter(|r| r.path == s.path).count();
    let away = rel.callers.len() - here;
    println!(
        "  {}, {here} in this file and {away} elsewhere",
        plural(rel.callers.len() as u64, "caller")
    );
    println!();
    let mut by_file: std::collections::BTreeMap<&str, Vec<&crate::links::Ref>> = Default::default();
    for r in &rel.callers {
        by_file.entry(r.path.as_str()).or_default().push(r);
    }
    for (file, mut refs) in by_file {
        refs.sort_by_key(|r| r.line);
        let own = if file == s.path { "  (its own file)" } else { "" };
        println!("  {file}{own}");
        for r in refs {
            let name = match &r.owner {
                Some(o) => format!("{o}::{}", r.name),
                None => r.name.clone(),
            };
            println!("    {:>5}  {name}", r.line);
        }
    }
    println!();
    0
}

/// Everything a question about this repo's findings is answered from.
///
/// **One setup, because two would be two answers.** The list and the four decision verbs ask
/// the same three things — what is in the tree, what this repo's thresholds are, and how deep
/// the trace went — and a verb that built them differently would pin a decision against
/// numbers the list never showed anybody. `commands::finding_pin` is the window's copy of the
/// same three lines, for the same reason.
struct Survey {
    path: std::path::PathBuf,
    facts: Vec<crate::findings::Facts>,
    rules: Vec<crate::findings::Rule>,
    traced: crate::findings::Traced,
    /// Whether anything here has been read. `report` needs it to tell a rule nobody can answer
    /// yet from one that is answered and silent.
    read: bool,
    /// Who calls whom, off the same scan the facts came from — see [`crate::links`]. The
    /// counts a finding quotes are folded from these edges, so a verb that shows the pairs
    /// reads them from here rather than building a second graph that could disagree.
    links: std::sync::Arc<crate::links::Links>,
    /// The rung the budget refused and what it would have cost — see [`crate::trace::affordable`].
    declined: Option<(crate::trace::Depth, f32)>,
}

/// Everything a findings verb needs, from one scan: the facts per subject, the rules for this
/// repo, how deep history was read, and the call graph those facts were folded from.
///
/// **In process — a scan of its own, not a call to the backend.** See [`findings`] for why:
/// nothing a finding says is live, so it must not depend on whether the app is open.
///
/// `rung` is how deep git is read. Named, it is scanned in; left to the budget, the tree is
/// scanned untraced first — blame is priced per file, and there are no files to price until
/// the tree exists — then deepened rung by rung to what [`crate::trace::affordable`] allows.
fn survey(path: &str, rung: Rung) -> Result<Survey, i32> {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return Err(2);
        }
    };
    let scans = crate::scancache::ScanCache::open(&path);
    // **Never blame for free.** Blame is what `budgets.md` measures at 206 seconds of a
    // 214-second cold ceph scan, and worse on a repo with 59,000 files; a verb whose first use
    // is "what is worth looking at here" cannot open with that unless it is already cached,
    // which is what the budget prices. The rung reached is carried out because `blocked` has
    // to know it: `headcount` is blame's alone, and a rule asking for it on a log-traced repo
    // must say so rather than finding nothing.
    let forced = match rung {
        Rung::Budget => None,
        Rung::Exactly(depth) => Some(depth),
    };
    // `Ordering` fidelity: every reading clause is answered from `.sanity/` or not at all —
    // see `findings::Field::Surprise`, which is `None` on an unread body rather than falling
    // back to a proxy score. Paying for the all-pairs term would buy a number nothing here
    // prints.
    let scan = match crate::scan::scan(
        &path,
        &|_| {},
        &|_| {},
        &std::sync::atomic::AtomicBool::new(false),
        &scans,
        crate::scan::Fidelity::Ordering,
        // Untraced when the budget decides, because blame is priced per file and there are no
        // files to price until the tree exists. The deepening below lands the same fields an
        // inline trace would — `a_deferred_trace_lands_exactly_where_an_inline_one_did`.
        forced.unwrap_or(crate::trace::Depth::Untraced),
    ) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("sanity: could not scan {}: {e}", path.to_string_lossy());
            return Err(1);
        }
    };
    let mut scan = scan;
    let (reached, declined) = match forced {
        Some(depth) => (depth, None),
        None => {
            let (depth, declined) = crate::trace::affordable(&path, &scan, &scans);
            let reached = crate::trace::deepen(
                &path,
                &mut scan,
                depth,
                &scans,
                &std::sync::atomic::AtomicBool::new(false),
                &|_| {},
                &|_| {},
            )
            .0;
            (reached, declined)
        }
    };
    let reports = crate::assessment::load(&path, &scan);
    // **A reading is applied here, not inside the scan.** `wire` answers from the parse and
    // the paths; what a reader said about which bodies are tests lands afterwards — see
    // `links::retest_tree`. The app does this when a reading arrives; a headless verb has to
    // do it once, on the way past, or every CLI answer is the structural half only.
    crate::links::retest_tree(&mut scan, &reports);
    let traced = crate::findings::Traced::of(&scan.stats, reached);
    let facts = crate::findings::subjects(&scan.root, &reports, traced);
    let rules = crate::findings::rules_for(&path, &facts);
    let read = !reports.is_empty();
    let links = scan.links.clone();
    Ok(Survey { path, facts, rules, traced, read, links, declined })
}

/// Record what somebody decided about a finding — the CLI's copy of the three buttons.
///
/// **Every rule that raises the subject, unless one is named.** The panel merges a subject's
/// rules into one tile and writes a decision per rule behind it, and a verb that wrote only
/// the first would leave the others standing and the finding half-decided. `--rule` is for the
/// case the tile cannot express: this is fine BECAUSE it is long, but the tangle still stands.
///
/// **A rule that cannot answer cannot be decided under.** A pin records what the rule
/// MEASURED, so one taken while the churn rules are dark would be a pin full of absences that
/// matches nothing ever again. Those rules are named and refused rather than written.
pub(super) fn decide(
    path: &str,
    key: &str,
    rule: Option<&str>,
    verdict: crate::findings::Verdict,
    reason: &str,
    edits: bool,
    blame: bool,
) -> i32 {
    let Survey { path, facts, rules, traced, read, .. } =
        match survey(path, Rung::of(edits, blame)) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let Some(f) = facts.iter().find(|f| f.subject.key == key) else {
        eprintln!("sanity: `{key}` is not on the map.");
        eprintln!("       `sanity findings` prints the key of every finding, which is this.");
        return 1;
    };
    // Only rules that RAISE it, so a decision is always about something somebody was shown.
    let raising: Vec<&crate::findings::Rule> = rules
        .iter()
        .filter(|r| rule.is_none_or(|want| r.id == want))
        .filter(|r| crate::findings::matches(r, f))
        .collect();
    if raising.is_empty() {
        match rule {
            Some(id) => eprintln!("sanity: `{id}` does not raise `{key}`."),
            None => eprintln!("sanity: nothing raises `{key}` — there is no finding to decide."),
        }
        // **A rule that cannot answer is not a rule that found nothing**, and the difference is
        // the whole reason `blocked` exists. Without this line the message reads as "there is
        // no such finding" to somebody looking straight at it in the window, whose project is
        // traced where this invocation is not.
        let dark = rules.iter().filter(|r| crate::findings::blocked(r, &facts, traced, read).is_some());
        let names: Vec<&str> = dark.map(|r| r.title.as_str()).take(3).collect();
        if !names.is_empty() {
            eprintln!(
                "       {} and others cannot answer here — add --edits or --blame if the",
                names.join(", ")
            );
            eprintln!("       finding you are looking at needs history.");
        }
        return 1;
    }

    let by = crate::assessment::who(&path);
    let when = crate::assessment::now_iso();
    let mut wrote = 0usize;
    for r in &raising {
        // Blocked is the rule's own answer to "could I have measured this repo", and it is the
        // one thing that makes a pin meaningless — see the doc above.
        if let Some(b) = crate::findings::blocked(r, &facts, traced, read) {
            println!("  {} — not decided: {}", r.title, b.why);
            continue;
        }
        let d = crate::findings::Decision {
            key: key.to_string(),
            rule: r.id.clone(),
            title: r.title.clone(),
            verdict,
            pin: crate::findings::pin_of(r, f),
            reason: reason.to_string(),
            when: when.clone(),
            by: by.clone(),
        };
        if let Err(e) = crate::findings::decide(&path, d) {
            eprintln!("sanity: could not write the decision: {e}");
            return 1;
        }
        wrote += 1;
    }
    if wrote == 0 {
        return 1;
    }

    // **Read back, never trusted.** `decide` rewrites the whole archive, and an `Ok` from a
    // write is not evidence that what came back off disk says what was meant — the migration
    // that destroyed a project's readings is the reason this rule exists.
    let back = crate::findings::archive(&path);
    let filed: Vec<&crate::findings::Decision> =
        back.iter().filter(|d| d.key == key && d.verdict == verdict).collect();
    if filed.len() < wrote {
        eprintln!("sanity: wrote {wrote} decisions and read {} back — nothing is settled.", filed.len());
        return 1;
    }
    println!();
    println!("{key}");
    for d in filed {
        println!("  {} — {}", d.title, crate::findings::Verdict::word(d.verdict));
    }
    println!();
    println!("{}", verdict_note(verdict));
    0
}

/// What the decision just made will DO, which is the half a verdict name does not say.
fn verdict_note(v: crate::findings::Verdict) -> &'static str {
    match v {
        crate::findings::Verdict::Flagged => "Stays in the list. `sanity findings clear` takes it back.",
        crate::findings::Verdict::FineForNow => {
            "Hidden until this code changes. It comes back when the numbers behind it move."
        }
        crate::findings::Verdict::FineAlways => "Hidden whatever this code does.",
        crate::findings::Verdict::FalsePositive => {
            "Hidden until the RULE changes. The code may do as it likes; this was not true."
        }
    }
}

/// Print a balance of this repo's rules, and save it with `--apply` — see [`crate::findings::balance`].
pub(super) fn balance(path: &str, target: usize, apply: bool, stock: bool) -> i32 {
    let Survey { path, facts, rules, .. } = match survey(path, Rung::Budget) {
        Ok(s) => s,
        Err(code) => return code,
    };
    let rules = if stock { crate::findings::catalog() } else { rules };
    let b = crate::findings::balance(&rules, &facts, &crate::findings::archive(&path), target);
    println!("{}  {} findings → {} (aiming for {})\n", path.display(), b.before, b.after, b.target);
    println!("  {:<46} {:>16} {:>14} {:>12}", "rule", "threshold", "findings", "only it");
    for r in &b.rules {
        if r.hits_before == 0 {
            continue;
        }
        let bar = match r.to {
            Some(to) => format!("{} {} → {}", r.field, trim(r.from), trim(to)),
            None => format!("{} {}", r.field, trim(r.from)),
        };
        let idle = if r.only_after == 0 { "  all also raised elsewhere" } else { "" };
        println!(
            "  {:<46} {:>16} {:>6} → {:<5} {:>4} → {:<4}{idle}",
            r.title, bar, r.hits_before, r.hits_after, r.only_before, r.only_after
        );
    }
    if !apply {
        println!("\n  Nothing written. `--apply` saves these thresholds to .sanity/rules/catalog.md.");
        return 0;
    }
    let mut live = rules;
    for r in &b.rules {
        let Some(to) = r.to else { continue };
        if let Some(rule) = live.iter_mut().find(|l| l.id == r.id) {
            let at = rule.calibrated;
            rule.clauses[at].value = to;
        }
    }
    match crate::findings::save_rules(&path, &live) {
        Ok(()) => {
            println!("\n  Saved to .sanity/rules/catalog.md.");
            0
        }
        Err(e) => {
            eprintln!("sanity: could not save the rules: {e}");
            1
        }
    }
}

/// A threshold as a person would write it: no trailing zeros.
fn trim(v: f32) -> String {
    let s = format!("{v:.2}");
    s.trim_end_matches('0').trim_end_matches('.').to_string()
}

/// Take decisions back, returning the findings to the list.
///
/// **Every rule under that key by default**, for the reason the panel unflags every rule at
/// once: a subject half-decided is a tile that goes on hiding findings nobody remembers
/// deciding. No scan is needed — this is an edit to the archive, keyed by strings the archive
/// already holds, so it works on a repo whose rules no longer raise the finding at all. That
/// is the case it is most needed in.
pub(super) fn clear(path: &str, key: &str, rule: Option<&str>) -> i32 {
    let path = match std::fs::canonicalize(path) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("sanity: {path}: {e}");
            return 2;
        }
    };
    let before = crate::findings::archive(&path);
    let doomed: Vec<crate::findings::Decision> = before
        .iter()
        .filter(|d| d.key == key && rule.is_none_or(|want| d.rule == want))
        .cloned()
        .collect();
    if doomed.is_empty() {
        eprintln!("sanity: nothing is filed under `{key}`.");
        return 1;
    }
    for d in &doomed {
        if let Err(e) = crate::findings::undecide(&path, key, &d.rule) {
            eprintln!("sanity: could not rewrite the archive: {e}");
            return 1;
        }
    }
    // Read back rather than trusting the writes: this one DELETES, which is the direction
    // that cannot be undone by running it again.
    let after = crate::findings::archive(&path);
    let left = after.iter().filter(|d| d.key == key).count();
    let want = before.iter().filter(|d| d.key == key).count() - doomed.len();
    if left != want {
        eprintln!("sanity: {left} decisions still stand under `{key}`, expected {want}.");
        return 1;
    }
    println!();
    println!("{key}");
    for d in &doomed {
        println!("  {} — back in the list", d.title);
    }
    0
}

/// The worklist itself, once the survey is in hand.
fn list(
    path: &std::path::Path,
    limit: usize,
    groups: &[crate::findings::Group],
    declined: Option<(crate::trace::Depth, f32)>,
) -> i32 {
    // Merged by subject, widest first — the panel's order, from the same numbers. A flag does
    // not move a row: see `findings::live_hits`.
    #[derive(Default)]
    struct Row<'a> {
        flagged: bool,
        loc: u32,
        said: Vec<(&'a crate::findings::Group, &'a crate::findings::Finding)>,
    }
    let mut by_key: std::collections::BTreeMap<&str, Row> = Default::default();
    for g in groups.iter().filter(|g| g.blocked.is_none()) {
        for f in &g.hits {
            let row = by_key.entry(f.key.as_str()).or_default();
            row.flagged |= f.flagged;
            row.loc = f.hit.loc;
            row.said.push((g, f));
        }
    }
    let mut rows: Vec<(&str, Row)> = by_key.into_iter().collect();
    rows.sort_by(|(ak, a), (bk, b)| b.loc.cmp(&a.loc).then_with(|| ak.cmp(bk)));

    let settled: usize = groups.iter().map(|g| g.dismissed).sum();
    println!();
    print!("{}", path.to_string_lossy());
    println!(
        "  {} findings{}",
        commas(rows.len() as u64),
        if settled > 0 { format!(", {} ignored", commas(settled as u64)) } else { String::new() }
    );

    // **What could not be asked, said once and out loud.** A rule whose clause the repo has no
    // evidence for finds nothing, and a reader who is not told why reads that as a clean bill
    // — the one thing this surface must never do.
    //
    // Folded by the FIX, exactly as the window's footer folds it: seven rules each ending in
    // the same six words is one job printed seven times, and how much of the catalog one pass
    // would light up is the number with a decision in it. See `findings::Blocked`.
    //
    // **And the reason rides along, because here there is nowhere else to put it.** The panel
    // hangs `why` on the row's tooltip; a transcript has no tooltip, so a footer printing the
    // fold key alone says `trace required` on a repo whose history HAS been read — the fix
    // being a deeper rung, which is the one thing the line was supposed to name. Deduped and
    // in the order met: two rules waiting on the same rung are one sentence.
    struct Need<'a> {
        need: &'a str,
        n: usize,
        whys: Vec<&'a str>,
    }
    let mut needs: Vec<Need> = Vec::new();
    for g in groups.iter() {
        let Some(b) = &g.blocked else { continue };
        match needs.iter_mut().find(|it| it.need == b.need) {
            Some(it) => {
                it.n += 1;
                if !it.whys.contains(&b.why.as_str()) {
                    it.whys.push(b.why.as_str());
                }
            }
            None => needs.push(Need { need: b.need.as_str(), n: 1, whys: vec![b.why.as_str()] }),
        }
    }
    needs.sort_by(|a, b| b.n.cmp(&a.n).then_with(|| a.need.cmp(b.need)));
    for it in &needs {
        // Wrapped like a finding's own sentence, and hung rather than block-indented: the
        // count is what the eye comes back to, so a second line has to read as the rest of
        // this row and not as the next one.
        let line = format!(
            "{} of {} rules inactive ({}) — {}",
            it.n,
            groups.len(),
            it.need,
            it.whys.join("; ")
        );
        for (i, part) in wrap(&line, 76).iter().enumerate() {
            println!("{}{part}", if i == 0 { "  " } else { "    " });
        }
    }
    // **Which rung the budget stopped at, and the flags that pay for it.** Without this the
    // line above reads as a fact about the repo — "the timeline has not been walked" — when it
    // is a fact about this invocation, which chose not to spend the time.
    if let Some((rung, seconds)) = declined {
        println!(
            "    {} skipped: about {} against a {}s budget — `--edits --blame` reads it anyway",
            rung_name(rung),
            duration(seconds),
            crate::trace::BUDGET.as_secs()
        );
    }
    println!();

    // A rule's background on the first row it raises and not again — the window's rule, and
    // the transcript has the same repetition to avoid. Wrapped as ONE paragraph with the
    // sentence it belongs to rather than as a block under it: the two were written to be read
    // together, and a second indent turns a finding into a finding with a footnote. See
    // `findings::Rule::background`.
    let mut said_once: std::collections::HashSet<&str> = Default::default();
    for (key, row) in rows.iter().take(limit) {
        println!("  {}{}", if row.flagged { "⚑ " } else { "" }, key);
        for (g, f) in &row.said {
            println!("    {}{}", g.title, if f.stale { "  [stale]" } else { "" });
            let mut para = crate::findings::flat(&f.says);
            if !g.background.is_empty() && said_once.insert(g.id.as_str()) {
                para.push(' ');
                para.push_str(&g.background);
            }
            for line in wrap(&para, 76) {
                println!("      {line}");
            }
        }
        println!();
    }
    if rows.len() > limit {
        println!(
            "  … and {} more. `--limit` for a longer list.",
            commas((rows.len() - limit) as u64)
        );
        println!();
    }
    0
}

/// Break a sentence onto lines a terminal can hold, at word boundaries.
fn wrap(text: &str, width: usize) -> Vec<String> {
    let mut out = Vec::new();
    let mut line = String::new();
    for word in text.split_whitespace() {
        if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > width {
            out.push(std::mem::take(&mut line));
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }
    if !line.is_empty() {
        out.push(line);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// **`clear` takes back every rule under a key, and proves it off the disk.**
    ///
    /// The panel unflags every rule behind a tile at once, because taking back only the first
    /// leaves the others hiding a finding nobody remembers deciding. This is the same rule on
    /// the command line, and it is the DELETING verb — the direction that running it again
    /// cannot undo — so it reads the archive back rather than trusting three `Ok`s.
    ///
    /// No scan: the archive is keyed on strings it already holds, which is what lets a
    /// decision be taken back on a repo whose rules no longer raise the finding at all.
    #[test]
    fn clearing_a_finding_takes_back_every_rule_under_it() {
        use crate::findings::{Decision, Verdict, archive, decide as file};
        let dir = tempfile::tempdir().expect("tmp");
        let repo = dir.path();
        let filed = |key: &str, rule: &str| Decision {
            key: key.into(),
            rule: rule.into(),
            title: rule.into(),
            verdict: Verdict::FineForNow,
            pin: "pin".into(),
            reason: String::new(),
            when: "2026-01-01T00:00:00Z".into(),
            by: "somebody".into(),
        };
        for r in ["giant-function", "tangled-for-size", "crowded-file"] {
            file(repo, filed("a.rs#run", r)).expect("writes");
        }
        // A second subject, which must survive every one of these.
        file(repo, filed("b.rs#other", "giant-function")).expect("writes");

        let path = repo.to_string_lossy().to_string();
        assert_eq!(clear(&path, "a.rs#run", Some("tangled-for-size")), 0, "one rule");
        let left = archive(repo);
        assert_eq!(left.iter().filter(|d| d.key == "a.rs#run").count(), 2, "the named one only");

        assert_eq!(clear(&path, "a.rs#run", None), 0, "the rest of them");
        let left = archive(repo);
        assert_eq!(left.iter().filter(|d| d.key == "a.rs#run").count(), 0);
        assert_eq!(left.len(), 1, "the other subject is untouched");

        // Nothing filed is a refusal rather than a silent success: somebody who mistypes a key
        // must not be told the decision they meant to take back is gone.
        assert_eq!(clear(&path, "a.rs#run", None), 1, "there is nothing left to clear");
    }
}
