//! What else is this function: who calls it, what it calls, and what it is a copy of.
//!
//! [`crate::edges`] and [`crate::clones`] both answer their questions repo-wide and then fold
//! the answer down to two or three numbers per function, because that is all a wedge can wear.
//! Numbers are the right thing on the map and the wrong thing in the panel beside it: `14×`
//! under Callers is a fact you cannot act on, and the next question — *which fourteen* — had
//! no answer anywhere in the app.
//!
//! This module is the answer to that question and nothing else. It is a LOOKUP TABLE, built
//! once beside the tree, from work the scan has already done: the edge list `wire` used to
//! discard, and the group membership `find` inverts to.
//!
//! # Why it is stored rather than recomputed
//!
//! Resolving one call needs every other file in the repo — a name is matched against a
//! repo-wide index of definitions — so "who calls this" cannot be answered from one file, or
//! from the tree, or from anything smaller than the whole parse. And the whole parse is
//! exactly what a launch off a cached tree never reads: `scancache` is 300MB on ceph and
//! 1.3GB on linux, and `treecache` exists precisely so that nobody pays for it. Rebuilding
//! this on the first click would charge that read to a person who clicked a wedge.
//!
//! So it is written beside the cached tree, under the same signature, and read back when that
//! tree is. It is machine-local and derivable in full from the repo, which is the same rule
//! the timeline cache follows and the opposite of the one `.sanity/` follows.
//!
//! # What it refuses to claim
//!
//! Everything [`crate::edges`] refuses. A name is not a target: these are the same resolved
//! edges the counts are made of, so a list is exactly as honest as the number above it and
//! never more. A function whose language has no call shape parsed is `wired: false` here —
//! never an empty list, which would read as "nothing calls this", the one finding the lens
//! exists to surface.
//!
//! It is not a graded input. Nothing here reaches a reader, `reading_hash` does not cover it,
//! no `SPEC` moved, and nothing in `.sanity/` expires because of it.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::clones::Copies;
use crate::edges::{FileView, Site, Wiring};
use crate::model::{NodeKind, Tested, Testness};

/// One function, as much of it as a row in a list needs.
///
/// Line and path rather than a node id: an id embeds `@line` and would orphan the moment
/// somebody adds an import — the same reason nothing durable is keyed on one. The window
/// resolves a row back to a wedge by `(path, line)`, which is what it is showing anyway.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ref {
    pub path: String,
    pub name: String,
    /// The type, trait or class this is defined inside. A bare name is not an identity — see
    /// [`crate::parse::FuncDef::owner`], which this carries for the same reason the peer list
    /// does.
    pub owner: Option<String>,
    pub line: u32,
    pub loc: u32,
}

/// What one function is connected to.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Related {
    /// Distinct functions in this repo that call this one, nearest first.
    pub callers: Vec<Ref>,
    /// Distinct functions this one calls.
    pub calls: Vec<Ref>,
    /// The other members of this function's clone group — never itself.
    pub clones: Vec<Ref>,
    /// Was this function's language read for calls at all? `false` means the two lists above
    /// are empty because nobody looked, which is a different fact from nothing calling it and
    /// must not be shown as the same one.
    pub wired: bool,
    /// Is this body long enough to be compared for copies — see `FuncDef::shape`. `false`
    /// means an empty `clones` says nothing.
    pub comparable: bool,
}

/// One function as this table holds it.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Entry {
    file: u32,
    name: String,
    owner: Option<String>,
    line: u32,
    loc: u32,
    wired: bool,
    comparable: bool,
}

/// Every function's neighbours, in the shape a panel asks for them.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Links {
    /// Repo-relative paths, indexed by [`Entry::file`]. Held once rather than on every entry:
    /// ceph has 113,322 functions across 14,000 files, and a path per function is the
    /// difference between a few megabytes and a few dozen.
    files: Vec<String>,
    entries: Vec<Entry>,
    /// `(file, start line)` → entry. Two functions cannot start on the same line, which is
    /// what makes this the cheap way in from a wedge.
    index: HashMap<(u32, u32), u32>,
    callers: HashMap<u32, Vec<u32>>,
    calls: HashMap<u32, Vec<u32>>,
    /// Clone group → its members. The group id is meaningless across scans — see
    /// [`crate::clones::Copy2::group`] — and is never stored anywhere durable.
    groups: Vec<Vec<u32>>,
    of_group: HashMap<u32, u32>,
}

impl Links {
    /// Re-derive what a READER changes about the wiring, from the table beside the tree.
    ///
    /// **The tree is what the parse can say; a reading is applied where readings live.** The
    /// reader tier was originally an input to `edges::wire`, which meant a landed reading
    /// changed nothing until the next scan — and while it lagged, a finding went on saying
    /// "13 call sites depend on this" with a test among the thirteen. That is the overclaim
    /// the tier exists to remove, deferred rather than avoided.
    ///
    /// Nothing here re-parses. `links.bin` is written beside the tree precisely so the edges
    /// survive a launch that never reads a file, and this is a pass over them: for every
    /// function, ask what its callers ARE and count the ones that are not tests. The same
    /// trade `treecache::redraw` already makes when a trace lands.
    ///
    /// `is_test` returns `None` for a body whose language cannot classify tests at all, and
    /// that absence propagates: a callee nobody can classify reports no `dependents` and no
    /// `under_test` rather than a zero and a `false`.
    pub fn retest(
        &self,
        is_test: impl Fn(u32) -> Option<bool>,
    ) -> HashMap<u32, (Option<u32>, Option<bool>)> {
        let mut out = HashMap::new();
        for id in 0..self.entries.len() as u32 {
            if is_test(id).is_none() {
                out.insert(id, (None, None));
                continue;
            }
            let mut dependents = 0u32;
            let mut under_test = false;
            for from in self.callers.get(&id).map(Vec::as_slice).unwrap_or_default() {
                // A caller nobody can classify counts as a dependent, which is the reading
                // `wire` has always taken: the claim is "this many things depend on it", and
                // an unclassifiable caller is still one of them.
                if is_test(*from) == Some(true) {
                    under_test = true;
                } else {
                    dependents += 1;
                }
            }
            out.insert(id, (Some(dependents), Some(under_test)));
        }
        out
    }

    /// The entry at this file and start line, which is how a tree node finds its edges.
    pub fn at_line(&self, path: &str, line: u32) -> Option<u32> {
        let file = self.files.iter().position(|f| f == path)? as u32;
        self.index.get(&(file, line)).copied()
    }

    /// This entry's durable key, for looking a reading up — see `assessment::key_of`.
    pub fn key_at(&self, id: u32, ord: usize) -> Option<String> {
        let e = self.entries.get(id as usize)?;
        Some(crate::assessment::key_of(self.files.get(e.file as usize)?, &e.name, ord))
    }

    /// Fold a scan's own working state into the table the panel reads.
    ///
    /// `files` is the same flat view [`crate::edges::wire`] and [`crate::clones::find`] were
    /// given, indexed the same way — that shared indexing is the whole reason this can be
    /// assembled without touching a file.
    pub fn build(files: &[FileView<'_>], wiring: &Wiring, copies: &Copies) -> Links {
        let mut out = Links {
            files: files.iter().map(|f| f.path.to_string()).collect(),
            ..Default::default()
        };
        // Dense ids in walk order, so a site is an index rather than a hash lookup and the
        // lists below come out in file order for free.
        let mut id_of: HashMap<Site, u32> = HashMap::new();
        for (fi, file) in files.iter().enumerate() {
            let wired = crate::parse::resolves_calls(file.lang);
            for (qi, func) in file.funcs.iter().enumerate() {
                id_of.insert((fi, qi), out.entries.len() as u32);
                out.index.insert((fi as u32, func.start_line), out.entries.len() as u32);
                out.entries.push(Entry {
                    file: fi as u32,
                    name: func.name.clone(),
                    owner: func.owner.clone(),
                    line: func.start_line,
                    loc: func.end_line.saturating_sub(func.start_line) + 1,
                    wired,
                    comparable: func.shape.is_some(),
                });
            }
        }
        for (from, to) in &wiring.edges {
            let (Some(&a), Some(&b)) = (id_of.get(from), id_of.get(to)) else { continue };
            out.calls.entry(a).or_default().push(b);
            out.callers.entry(b).or_default().push(a);
        }
        // Inverted from `Copies`, which holds the membership the other way round. Sorted by
        // id, which is walk order, so a group reads down the repo rather than in the order a
        // hash happened to iterate.
        let mut by_group: HashMap<u32, Vec<u32>> = HashMap::new();
        for (site, id) in &id_of {
            if let Some(c) = copies.at(site.0, site.1) {
                by_group.entry(c.group).or_default().push(*id);
                out.of_group.insert(*id, c.group);
            }
        }
        let top = by_group.keys().copied().max().map_or(0, |m| m as usize + 1);
        out.groups = vec![Vec::new(); top];
        for (g, mut members) in by_group {
            members.sort_unstable();
            out.groups[g as usize] = members;
        }
        out
    }

    /// Everything this table knows about the function starting at `line` of `path`.
    ///
    /// `None` where the scan holds no such function — a file that has moved since, or a line
    /// the window guessed at. The caller says so rather than drawing an empty list, which
    /// would read as a function with no neighbours.
    pub fn at(&self, path: &str, line: u32) -> Option<Related> {
        let file = self.files.iter().position(|p| p == path)? as u32;
        let id = *self.index.get(&(file, line))?;
        let me = &self.entries[id as usize];
        let refs = |ids: Option<&Vec<u32>>| -> Vec<Ref> {
            ids.map(|v| v.iter().map(|i| self.reference(*i)).collect()).unwrap_or_default()
        };
        let clones = self
            .of_group
            .get(&id)
            .and_then(|g| self.groups.get(*g as usize))
            .map(|members| {
                members.iter().filter(|m| **m != id).map(|m| self.reference(*m)).collect()
            })
            .unwrap_or_default();
        Some(Related {
            callers: refs(self.callers.get(&id)),
            calls: refs(self.calls.get(&id)),
            clones,
            wired: me.wired,
            comparable: me.comparable,
        })
    }

    fn reference(&self, id: u32) -> Ref {
        let e = &self.entries[id as usize];
        Ref {
            path: self.files[e.file as usize].clone(),
            name: e.name.clone(),
            owner: e.owner.clone(),
            line: e.line,
            loc: e.loc,
        }
    }

    /// How many functions this table holds. Zero means it was never built — a project whose
    /// tree arrived before its scan did, which is a state the panel has to be able to name.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod retest_tests {
    use super::*;
    use crate::agentapi::Report;

    /// A two-function C++ file, scanned for real so the edges are the ones `wire` produces.
    fn cpp_scan(dir: &std::path::Path) -> crate::scan::Scan {
        std::fs::write(
            dir.join("a.cc"),
            "void helper() { int x = 1; }\nvoid covers() { helper(); }\n",
        )
        .expect("write");
        let m = crate::scan::Memos::ephemeral();
        crate::scan::scan(
            dir,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &m.0, scans: &m.1 },
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Untraced,
        )
        .expect("scans")
    }

    /// **A reader's answer reaches the wiring without a rescan.**
    ///
    /// This is the layering the split exists for. The reader tier used to be an input to
    /// `edges::wire`, which runs inside `scan` — so a landed reading changed nothing until
    /// somebody scanned again, and while it waited a finding said "N call sites depend on
    /// this" with a test among the N. The overclaim was deferred rather than removed.
    ///
    /// C++ on purpose: no contract, and no directory convention worth trusting on a codebase
    /// of any size, so a reader is the only thing that can classify it and before the reading
    /// there is nothing to say.
    #[test]
    fn a_reading_reaches_the_wiring_without_a_rescan() {
        let dir = tempfile::tempdir().expect("tmp");
        let mut scan = cpp_scan(dir.path());
        let helper = |s: &crate::scan::Scan| -> (Option<u32>, Option<bool>) {
            let mut got = (None, None);
            s.root.visit(&mut |n| {
                if n.name == "helper" && n.kind == NodeKind::Func {
                    got = (n.dependents, n.under_test);
                }
            });
            got
        };

        assert_eq!(helper(&scan), (None, None), "no evidence, so no answer either way");

        let mut reports = HashMap::new();
        reports.insert("a.cc#covers".to_string(), Report { test: Some(true), ..Report::blank() });
        reports.insert("a.cc#helper".to_string(), Report { test: Some(false), ..Report::blank() });
        assert!(retest_tree(&mut scan, &reports), "the tree moved");
        assert_eq!(
            helper(&scan),
            (Some(0), Some(true)),
            "a test calls it, and nothing that is not a test does",
        );
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::model::Lang;
    use crate::parse::FuncDef;

    pub(crate) fn func(name: &str, line: u32, calls: &[&str], shape: Option<u64>) -> FuncDef {
        FuncDef {
            name: name.to_string(),
            signature: String::new(),
            body: String::new(),
            doc: None,
            owner: None,
            start_line: line,
            end_line: line + 4,
            calls: calls.iter().map(|c| crate::parse::Call {
                name: c.to_string(),
                via: crate::parse::Via::Free,
            })
            .collect(),
            shape,
            cognitive: None,
            in_cfg_test: false,
        }
    }

    pub(crate) fn table(files: &[(&str, Vec<FuncDef>)]) -> Links {
        let views: Vec<FileView<'_>> =
            files.iter().map(|(path, funcs)| FileView { path, lang: Lang::Rust, funcs }).collect();
        let wiring = crate::edges::wire(&views);
        let copies = crate::clones::find(&views);
        Links::build(&views, &wiring, &copies)
    }

    /// The lists are the edges the counts are made of, pointed the two ways round.
    #[test]
    fn a_caller_and_its_callee_name_each_other() {
        let links = table(&[
            ("src/a.rs", vec![func("caller", 1, &["target"], None)]),
            ("src/b.rs", vec![func("target", 1, &[], None)]),
        ]);
        let target = links.at("src/b.rs", 1).expect("the callee is in the table");
        assert_eq!(target.callers.len(), 1);
        assert_eq!(target.callers[0].name, "caller");
        assert_eq!(target.callers[0].path, "src/a.rs");
        assert!(target.calls.is_empty(), "it calls nothing itself");
        let caller = links.at("src/a.rs", 1).expect("the caller is in the table");
        assert_eq!(caller.calls.len(), 1);
        assert_eq!(caller.calls[0].name, "target");
    }

    /// A language nobody parsed for calls reports an absence, never a zero. Both lists are
    /// empty either way; `wired` is the only thing that tells the panel which emptiness it
    /// is holding.
    #[test]
    fn an_unparsed_language_is_an_absence_not_a_zero() {
        let funcs = vec![func("solo", 1, &[], None)];
        let views = vec![FileView { path: "a.sql", lang: Lang::Sql, funcs: &funcs }];
        let wiring = crate::edges::wire(&views);
        let copies = crate::clones::find(&views);
        let links = Links::build(&views, &wiring, &copies);
        let solo = links.at("a.sql", 1).expect("it is still a function");
        assert!(!solo.wired, "SQL resolves no calls, and the panel has to say so");

        let wired = table(&[("src/a.rs", vec![func("solo", 1, &[], None)])]);
        assert!(wired.at("src/a.rs", 1).expect("present").wired);
    }

    /// A group lists the OTHER members. Including itself would put a row in the panel that
    /// jumps to the function you are already looking at.
    #[test]
    fn a_clone_group_lists_the_twins_and_not_the_function_itself() {
        let links = table(&[
            ("src/a.rs", vec![func("one", 1, &[], Some(7))]),
            ("src/b.rs", vec![func("two", 1, &[], Some(7)), func("odd", 9, &[], Some(8))]),
        ]);
        let one = links.at("src/a.rs", 1).expect("present");
        assert_eq!(one.clones.len(), 1);
        assert_eq!(one.clones[0].path, "src/b.rs");
        assert!(one.comparable);
        let odd = links.at("src/b.rs", 9).expect("present");
        assert!(odd.clones.is_empty(), "a body nothing shares has no twins");
        assert!(odd.comparable, "and it was long enough to have been compared");
    }

    /// A body too short to compare reports `comparable: false`, so an empty clone list is
    /// not read as "this one is unique" — the same distinction `Node::comparable` draws.
    #[test]
    fn a_body_too_short_to_compare_says_so() {
        let links = table(&[("src/a.rs", vec![func("tiny", 1, &[], None)])]);
        assert!(!links.at("src/a.rs", 1).expect("present").comparable);
    }

    /// What the table holds for a real repo, and what it costs. Ignored: a measurement,
    /// `REPO=/path/to/repo cargo test -- --ignored --nocapture neighbours`.
    ///
    /// Prints the ten most-called functions and the biggest clone group, which is the cheapest
    /// way to see that the lists are pointing at real code rather than being well-formed and
    /// empty — the failure a unit test on a two-file fixture cannot reach.
    #[test]
    #[ignore]
    fn neighbours() {
        let repo = std::env::var("REPO").expect("REPO=/path/to/repo");
        let repo = std::path::Path::new(&repo);
        let m = crate::scan::Memos::ephemeral();
        let t = std::time::Instant::now();
        let scan = crate::scan::scan(
            repo,
            &crate::surprise::HeuristicModel,
            &|_| {},
            &|_, _: &crate::surprise::Reading| {},
            &|_| {},
            &std::sync::atomic::AtomicBool::new(false),
            crate::scan::Memos { scores: &m.0, scans: &m.1 },
            crate::scan::Fidelity::Ordering,
            crate::trace::Depth::Lines,
        )
        .expect("scans");
        let scanned = t.elapsed();
        let links = &scan.links;
        let bytes = bincode::serde::encode_to_vec(
            &**links,
            bincode::config::standard().with_variable_int_encoding(),
        )
        .expect("encodes");
        println!(
            "{} functions · scan {:.1}s · table {:.1}MB",
            links.len(),
            scanned.as_secs_f64(),
            bytes.len() as f64 / 1e6,
        );
        let mut hot: Vec<(usize, &Entry)> = links
            .entries
            .iter()
            .enumerate()
            .map(|(i, e)| (links.callers.get(&(i as u32)).map_or(0, |v| v.len()), e))
            .collect();
        let edges: usize = links.callers.values().map(Vec::len).sum();
        let called = links.callers.len();
        println!(
            "  {edges} edges · {called} functions with a caller ({:.0}%)",
            100.0 * called as f64 / links.len() as f64
        );
        hot.sort_by_key(|(n, _)| std::cmp::Reverse(*n));
        for (n, e) in hot.iter().take(10) {
            println!("  {n:>4} callers  {}  {}:{}", e.name, links.files[e.file as usize], e.line);
        }
        let biggest = links.groups.iter().max_by_key(|g| g.len());
        if let Some(g) = biggest {
            println!("  biggest clone group: {} members", g.len());
            for id in g.iter().take(4) {
                let e = &links.entries[*id as usize];
                println!("    {}  {}:{}", e.name, links.files[e.file as usize], e.line);
            }
        }
    }

    /// A line nothing starts at is an absence. The window asks by `(path, line)` off a scan
    /// that may have been taken before an edit, and the honest answer is "not here".
    #[test]
    fn a_line_no_function_starts_at_is_absent() {
        let links = table(&[("src/a.rs", vec![func("one", 1, &[], None)])]);
        assert!(links.at("src/a.rs", 40).is_none());
        assert!(links.at("src/nope.rs", 1).is_none());
    }
}

/// Apply what readers have said about test code to a tree, without re-parsing anything.
///
/// **The whole point of the split.** `edges::wire` answers from the parse and the paths;
/// this answers from the readings, which arrive continuously and long after the scan. A
/// reading that says "this body is a test" changes what depends on the bodies it CALLS, and
/// it changes them here rather than at the next scan — which is what it used to wait for,
/// and while it waited a finding went on saying "13 call sites depend on this" with a test
/// among the thirteen.
///
/// Nothing here re-parses. `links.bin` is written beside the tree precisely so the edges
/// survive a launch that reads no source, and this is one pass over them — the same trade
/// `treecache::redraw` makes when a trace lands.
///
/// Returns whether anything moved, so a caller can skip re-banking a tree already right.
pub fn retest_tree(
    scan: &mut crate::scan::Scan,
    reports: &HashMap<String, crate::agentapi::Report>,
) -> bool {
    let links = scan.links.clone();

    // Every function's entry id, what the structure already decided, and the `ord` its
    // reading is keyed under — twins share a name and a path and nothing else tells them
    // apart. See `assessment::key_of`.
    let mut structural: HashMap<u32, Option<Testness>> = HashMap::new();
    let mut said: HashMap<u32, bool> = HashMap::new();
    let mut ord: HashMap<(String, String), usize> = HashMap::new();
    scan.root.visit(&mut |n| {
        if n.kind != NodeKind::Func {
            return;
        }
        let Some(line) = n.line else { return };
        let Some(id) = links.at_line(&n.path, line) else { return };
        let seen = ord.entry((n.path.clone(), n.name.clone())).or_insert(0);
        let key = crate::assessment::key_of(&n.path, &n.name, *seen);
        *seen += 1;
        structural.insert(id, n.tested);
        // **A reader outranks a convention and never a contract.** A contract is a fact about
        // what ships; overriding it with a judgement would be the tool second-guessing the
        // compiler. See `model::Testness`.
        if matches!(n.tested.map(|t| t.how), Some(Tested::Contract)) {
            return;
        }
        if let Some(t) = reports.get(&key).and_then(|r| r.test) {
            said.insert(id, t);
        }
    });
    if said.is_empty() {
        return false;
    }

    let tally = links
        .retest(|id| said.get(&id).copied().or_else(|| structural.get(&id).and_then(|t| t.map(|t| t.is_test))));

    let mut moved = false;
    let mut ord: HashMap<(String, String), usize> = HashMap::new();
    scan.root.visit_mut(&mut |n| {
        if n.kind != NodeKind::Func {
            return;
        }
        let Some(line) = n.line else { return };
        let Some(id) = links.at_line(&n.path, line) else { return };
        let seen = ord.entry((n.path.clone(), n.name.clone())).or_insert(0);
        *seen += 1;
        if let Some(t) = said.get(&id) {
            let now = Some(Testness { is_test: *t, how: Tested::Reader });
            moved |= n.tested != now;
            n.tested = now;
        }
        if let Some((dependents, under_test)) = tally.get(&id) {
            moved |= n.dependents != *dependents || n.under_test != *under_test;
            n.dependents = *dependents;
            n.under_test = *under_test;
        }
    });
    moved
}
