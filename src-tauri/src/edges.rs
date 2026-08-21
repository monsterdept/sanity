//! Call edges: who calls whom, and how far the call travels.
//!
//! The scan already parses every function; what it threw away was the calls inside them.
//! This module puts them back together into two facts the sunburst had no way to state —
//! **how many other functions call this one**, and **what share of its wiring leaves its own
//! directory** — and both are deliberately cheap, deterministic and model-free. They come off
//! the parse, so they are available the instant a repo is opened: no reader, no tokens, and
//! no git. On a repo a model generated an hour ago that is the only evidence there is.
//!
//! # What this refuses to claim
//!
//! A name is not a target. tree-sitter can see that a body calls something spelled `render`;
//! it cannot see which `render`, because that needs types, imports and overload resolution —
//! three things a per-file parse does not have. Every rule below is about being honest that
//! the answer is a guess, and about which guesses are cheap enough to be worth making:
//!
//! - **A language whose call shape has never been parsed resolves nothing**, and says so.
//!   The result is `None` — the wedge paints gray — never a zero. A zero would read as
//!   "nothing calls this", which is the finding the lens exists to surface, asserted over
//!   code nobody looked at. See [`crate::parse::resolves_calls`].
//! - **Edges stay inside a language family.** A Python `main` and a Go `main` are not the
//!   same function, and joining them would wire two subsystems together through a word.
//!   The two families that are genuinely one — C with C++ headers, and the JavaScript/
//!   TypeScript/TSX trio — are the reason [`family`] exists rather than a plain `lang ==`.
//! - **Locally ambiguous is resolved; globally ambiguous is not.** Three `parse`s in one
//!   directory are three plausible targets and the neighbourhood is the evidence, so all
//!   three are credited. Thirty `get`s across a repo are a common word, so the call is
//!   dropped. That line is drawn by what the evidence supports, not by a tuned threshold.
//! - **A call that resolves to nothing is not an error and is not counted.** Most calls in
//!   any real file go to the standard library or a dependency. `unresolved` is reported so
//!   the share is visible rather than inferred.
//!
//! # What it is NOT
//!
//! Not a dependency graph anybody should draw as a node graph — 17,000 functions and a
//! force layout is a hairball, and the sunburst's angle already carries structure. These are
//! two scalars per function, meant for the same geometry everything else is painted on.
//!
//! Not an input to a reading. `reading_hash` does not cover them, no `SPEC` moved, and
//! nothing in `.sanity/` expires because of anything in this file. Handing a reader "this
//! function has fourteen callers" would make it a graded input and cost every cold
//! prediction ever taken; that trade is worth measuring before it is worth spending.

use std::collections::{HashMap, HashSet};

use crate::model::Lang;

/// Everything one function's wiring says about it.
///
/// Counts of distinct FUNCTIONS, never of call sites: a body that calls `push` forty times
/// depends on `push` once, and counting the forty would let a loop outweigh a subsystem.
#[derive(Debug, Clone, Copy, Default)]
pub struct Wire {
    /// Distinct functions in this repo that call this one. Recursion does not count.
    pub callers: u32,
    /// Distinct functions in this repo that this one calls.
    pub calls: u32,
    /// Distinct neighbours — callers and callees together, counted once each.
    pub incident: u32,
    /// Of those neighbours, how many live outside this function's own directory.
    pub away: u32,
}

impl Wire {
    /// The share of this function's wiring that leaves its own directory.
    pub fn locality_gap(&self) -> Option<f32> {
        locality_gap(Some(self.away), Some(self.incident))
    }
}

/// The share of a subject's wiring that leaves its own directory, or `None` when it has no
/// wiring at all.
///
/// **`None` rather than zero for an unwired function**, and the distinction is the whole lens.
/// Zero would mean "everything it touches is next door", which is the calmest thing the map
/// can say; a function connected to nothing has not earned that. It is the Reach lens's
/// subject, and Locality has nothing to report about it.
///
/// A free function rather than only a method, because the two callers hold the counts in
/// different shapes — `Wire` inside a scan, `Node` after one — and a division written out
/// twice is a division that can come to disagree about its denominator. The browser has a
/// third copy in `localityOf`, which cannot be helped and is why the counts cross the wire
/// rather than the ratio.
pub fn locality_gap(away: Option<u32>, incident: Option<u32>) -> Option<f32> {
    match (away, incident) {
        (Some(a), Some(i)) if i > 0 => Some(a as f32 / i as f32),
        _ => None,
    }
}

/// One function's address, before the tree exists.
///
/// Position in the file rather than name, because `path#name` is not unique — the same
/// reason [`crate::assessment::key_of`] takes an ordinal. Nothing durable is keyed on this;
/// it is an index into the scan that produced it and dies with it.
pub type Site = (usize, usize);

/// Which definitions a call in one language is allowed to reach.
///
/// Not `lang ==`, because two pairs of languages are genuinely one namespace and both matter.
/// **C and C++ are the case the map was missing**: a header and its implementation are the
/// canonical "these two files are the same thing" edge, and `.h` parses as C++ while `.c`
/// parses as C, so an identity comparison would sever every one of them. The JS family is
/// the same shape for a different reason — one project routinely holds `.ts`, `.tsx` and
/// `.js` and calls freely across them.
///
/// Everything else is its own family. A repo holding Python and Go has two `main`s and they
/// are not related; joining them by name would wire the two halves of the map together
/// through a coincidence of spelling.
fn family(lang: Lang) -> u8 {
    match lang {
        Lang::C | Lang::Cpp => 1,
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => 2,
        other => 3 + other as u8,
    }
}

/// A file as this module needs to see it: where it is, what it is, and what is in it.
///
/// Borrowed rather than owned so a scan can hand over what it already parsed. The caller
/// flattens its directory grouping; the grouping is rebuilt here from the paths, because a
/// directory is the unit locality is measured against and it has to be derived the same way
/// for every file whatever order they arrived in.
pub struct FileView<'a> {
    pub path: &'a str,
    pub lang: Lang,
    pub funcs: &'a [crate::parse::FuncDef],
}

/// Every function's wiring, plus what could not be resolved.
pub struct Wiring {
    per_site: HashMap<Site, Wire>,
    /// Every resolved edge, caller first. Deduplicated, recursion already dropped.
    ///
    /// **Kept rather than folded away, because two scalars cannot be clicked.** The counts
    /// below them answer "how wired is this"; the panel that opens when somebody wants to
    /// know *what* calls a function needs the pairs themselves, and rebuilding them costs
    /// the whole repo's parse — the one thing a launch off a cached tree never reads. See
    /// [`crate::links`], which is the only consumer and turns these into a form that
    /// survives the scan.
    pub edges: Vec<(Site, Site)>,
    /// Call names that reached no definition, and how many did. Reported rather than
    /// swallowed: a repo where 95% of calls go nowhere is one where the family rule or the
    /// grammar is wrong, and the only way to notice is to be told the share.
    pub resolved: u64,
    pub unresolved: u64,
    /// Functions in a language that resolves calls at all — the denominator for every share
    /// downstream, and never the function count, which includes languages nobody looked at.
    pub resolvable: u64,
}

impl Wiring {
    /// This function's wiring, or `None` when its language resolves no calls.
    pub fn at(&self, file: usize, func: usize) -> Option<Wire> {
        self.per_site.get(&(file, func)).copied()
    }
}

/// The directory a repo-relative path sits in, as the empty string at the root.
fn dir_of(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(d, _)| d)
}

/// How many definitions of one name a REPO-WIDE match may have and still resolve.
///
/// One. A call that leaves its own directory and finds two candidates has found a word, not a
/// function — and crediting both would inflate the caller count of whichever pair happens to
/// share a spelling, which is exactly the wedges a reader is most likely to be misled about.
/// Locally the opposite holds and the constant does not apply: see [`resolve`].
const GLOBAL_UNIQUE: usize = 1;

/// Build the call graph and reduce it to two numbers per function.
///
/// Three passes, none of them clever: index every definition by name, resolve every call
/// against that index, then fold the edge list into per-function counts. The cost is
/// proportional to call sites, which is bounded by [`crate::parse::MAX_CALLS`] per function —
/// so a 17,000-function repo is about a million hash lookups, well under a second, and it
/// runs on the same parse the scan already paid for.
pub fn wire(files: &[FileView<'_>]) -> Wiring {
    // name → every definition of it, with the family and directory needed to rank candidates.
    let mut defs: HashMap<&str, Vec<(u8, &str, Site)>> = HashMap::new();
    let mut resolvable = 0u64;
    for (fi, file) in files.iter().enumerate() {
        if !crate::parse::resolves_calls(file.lang) {
            continue;
        }
        resolvable += file.funcs.len() as u64;
        let fam = family(file.lang);
        let dir = dir_of(file.path);
        for (gi, func) in file.funcs.iter().enumerate() {
            defs.entry(func.name.as_str()).or_default().push((fam, dir, (fi, gi)));
        }
    }

    let mut resolved = 0u64;
    let mut unresolved = 0u64;
    // Deduplicated: the same pair reached through two different names is one dependency.
    let mut edges: HashSet<(Site, Site)> = HashSet::new();
    for (fi, file) in files.iter().enumerate() {
        if !crate::parse::resolves_calls(file.lang) {
            continue;
        }
        let fam = family(file.lang);
        let dir = dir_of(file.path);
        for (gi, func) in file.funcs.iter().enumerate() {
            let from = (fi, gi);
            for name in &func.calls {
                let hits = resolve(&defs, name, fam, fi, dir);
                if hits.is_empty() {
                    unresolved += 1;
                    continue;
                }
                resolved += 1;
                for to in hits {
                    // Recursion is not wiring between two pieces of code, and it would put
                    // every self-referential helper one caller up the ranking for nothing.
                    if to != from {
                        edges.insert((from, to));
                    }
                }
            }
        }
    }

    // Seeded with a zero for every resolvable function, so "nothing calls this and it calls
    // nothing" is a recorded fact rather than a missing key. The `None` this module returns
    // has exactly one meaning — the language was never read — and a function that fell out of
    // the edge list must not borrow it.
    let mut per_site: HashMap<Site, Wire> = HashMap::new();
    for (fi, file) in files.iter().enumerate() {
        if crate::parse::resolves_calls(file.lang) {
            for gi in 0..file.funcs.len() {
                per_site.insert((fi, gi), Wire::default());
            }
        }
    }
    // Neighbours per function, so `incident` counts a mutual pair once rather than twice.
    let mut neighbours: HashMap<Site, HashSet<Site>> = HashMap::new();
    for (from, to) in &edges {
        if let Some(w) = per_site.get_mut(from) {
            w.calls += 1;
        }
        if let Some(w) = per_site.get_mut(to) {
            w.callers += 1;
        }
        neighbours.entry(*from).or_default().insert(*to);
        neighbours.entry(*to).or_default().insert(*from);
    }
    for (site, near) in &neighbours {
        let Some(w) = per_site.get_mut(site) else { continue };
        let home = dir_of(files[site.0].path);
        w.incident = near.len() as u32;
        w.away = near.iter().filter(|(fi, _)| dir_of(files[*fi].path) != home).count() as u32;
    }

    // Sorted, so the panel's lists come out in a stable order rather than a hash order that
    // reshuffles between two scans of an unchanged repo — the same argument `BTreeMap`
    // carries in `scan`'s directory grouping.
    let mut edges: Vec<(Site, Site)> = edges.into_iter().collect();
    edges.sort_unstable();
    Wiring { per_site, resolved, unresolved, resolvable, edges }
}

/// Which definitions a call by this name reaches, nearest tier first.
///
/// **Same file, then same directory, then the whole family** — and the tiers are not just a
/// preference order, they carry different evidence. A name matched inside the file it is
/// called from is about as certain as this method gets, and if the file defines it twice the
/// two are genuinely both plausible. Across the repo nothing local vouches for the match, so
/// only a name with exactly one definition anywhere is taken; past that it is a common word
/// (`get`, `run`, `new`) and the honest answer is that we do not know.
///
/// Returning several sites rather than picking one is deliberate. A guess would put a
/// confident edge on the map where the parse has none, and the counts this feeds are already
/// only ever read as "roughly how wired is this" — one extra candidate in a directory changes
/// a caller count by one, where a wrong pick changes two functions' wiring and looks certain.
fn resolve(
    defs: &HashMap<&str, Vec<(u8, &str, Site)>>,
    name: &str,
    fam: u8,
    file: usize,
    dir: &str,
) -> Vec<Site> {
    let Some(all) = defs.get(name) else { return Vec::new() };
    let same_family: Vec<&(u8, &str, Site)> = all.iter().filter(|(f, _, _)| *f == fam).collect();
    if same_family.is_empty() {
        return Vec::new();
    }
    let here: Vec<Site> =
        same_family.iter().filter(|(_, _, s)| s.0 == file).map(|(_, _, s)| *s).collect();
    if !here.is_empty() {
        return here;
    }
    let near: Vec<Site> =
        same_family.iter().filter(|(_, d, _)| *d == dir).map(|(_, _, s)| *s).collect();
    if !near.is_empty() {
        return near;
    }
    if same_family.len() > GLOBAL_UNIQUE {
        return Vec::new();
    }
    same_family.iter().map(|(_, _, s)| *s).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parse::FuncDef;

    fn def(name: &str, calls: &[&str]) -> FuncDef {
        FuncDef {
            name: name.into(),
            signature: format!("fn {name}()"),
            body: "{}".into(),
            doc: None,
            owner: None,
            start_line: 1,
            end_line: 2,
            shape: None,
            calls: calls.iter().map(|c| c.to_string()).collect(),
        }
    }

    /// `wire` over a fixed set of files, so a test reads as the repo it describes.
    fn wired(files: &[(&str, Lang, Vec<FuncDef>)]) -> Wiring {
        let views: Vec<FileView<'_>> =
            files.iter().map(|(p, l, f)| FileView { path: p, lang: *l, funcs: f }).collect();
        wire(&views)
    }

    #[test]
    fn a_call_becomes_a_caller() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("top", &["helper"]), def("helper", &[])])]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1);
        assert_eq!(w.at(0, 0).unwrap().calls, 1);
        assert_eq!(w.at(0, 0).unwrap().callers, 0);
    }

    /// The distinction the whole lens rests on: a language nobody has read reports NOTHING,
    /// and a function nothing calls reports ZERO. Collapsing the two would draw every
    /// repo in an unwired language as dead code.
    #[test]
    fn an_unreadable_language_is_absent_and_an_uncalled_function_is_zero() {
        let w = wired(&[
            ("a.rs", Lang::Rust, vec![def("orphan", &[])]),
            ("b.sql", Lang::Sql, vec![def("also_orphan", &[])]),
        ]);
        assert_eq!(w.at(0, 0).map(|x| x.callers), Some(0), "Rust: measured, and it is zero");
        assert_eq!(w.at(1, 0).map(|x| x.callers), None, "SQL: never looked");
        assert_eq!(w.resolvable, 1, "the denominator counts only what could be read");
    }

    /// Recursion is not two pieces of code depending on each other.
    #[test]
    fn a_function_does_not_call_itself_into_the_ranking() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("loopy", &["loopy"])])]);
        assert_eq!(w.at(0, 0).unwrap().callers, 0);
        assert_eq!(w.at(0, 0).unwrap().incident, 0);
    }

    /// A Python `main` and a Go `main` are not the same function.
    #[test]
    fn edges_do_not_cross_language_families() {
        let w = wired(&[
            ("a.py", Lang::Python, vec![def("start", &["main"])]),
            ("b.go", Lang::Go, vec![def("main", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 0);
        assert_eq!(w.unresolved, 1);
    }

    /// The header-and-implementation edge, which is the one everybody asks for — and which an
    /// identity comparison on `Lang` would sever, because `.h` parses as C++ and `.c` as C.
    #[test]
    fn a_c_file_and_a_cpp_header_are_one_family() {
        let w = wired(&[
            ("src/thing.c", Lang::C, vec![def("run", &["thing_init"])]),
            ("include/thing.h", Lang::Cpp, vec![def("thing_init", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 1);
    }

    /// Two definitions in one file are two plausible targets and the file is the evidence.
    #[test]
    fn a_locally_ambiguous_name_credits_every_candidate() {
        let mut twin_a = def("parse", &[]);
        let twin_b = def("parse", &[]);
        twin_a.owner = Some("A".into());
        let w = wired(&[("a.rs", Lang::Rust, vec![def("top", &["parse"]), twin_a, twin_b])]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1);
        assert_eq!(w.at(0, 2).unwrap().callers, 1);
    }

    /// Across the repo nothing local vouches for the match, so a shared spelling is a word.
    ///
    /// Without this the common verbs — `get`, `run`, `new` — collect a caller count in the
    /// hundreds and take over the top of every ranking the lens produces.
    #[test]
    fn a_globally_ambiguous_name_resolves_to_nothing() {
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["get"])]),
            ("b/two.rs", Lang::Rust, vec![def("get", &[])]),
            ("c/three.rs", Lang::Rust, vec![def("get", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 0);
        assert_eq!(w.at(2, 0).unwrap().callers, 0);
        assert_eq!(w.unresolved, 1);
        // The same name with ONE definition repo-wide does resolve — the rule is about
        // ambiguity, not about distance.
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["get"])]),
            ("b/two.rs", Lang::Rust, vec![def("get", &[])]),
        ]);
        assert_eq!(w.at(1, 0).unwrap().callers, 1);
    }

    /// The nearer tier wins outright rather than being merged with the wider one.
    #[test]
    fn a_local_definition_shadows_a_distant_one() {
        let w = wired(&[
            ("a/one.rs", Lang::Rust, vec![def("top", &["helper"]), def("helper", &[])]),
            ("b/two.rs", Lang::Rust, vec![def("helper", &[])]),
        ]);
        assert_eq!(w.at(0, 1).unwrap().callers, 1, "the one in the same file");
        assert_eq!(w.at(1, 0).unwrap().callers, 0, "not the one across the repo");
    }

    #[test]
    fn locality_is_the_share_of_neighbours_outside_the_directory() {
        let w = wired(&[
            ("src/a.rs", Lang::Rust, vec![def("hub", &["near", "far"])]),
            ("src/b.rs", Lang::Rust, vec![def("near", &[])]),
            ("other/c.rs", Lang::Rust, vec![def("far", &[])]),
        ]);
        assert_eq!(w.at(0, 0).unwrap().locality_gap(), Some(0.5));
        assert_eq!(w.at(1, 0).unwrap().locality_gap(), Some(0.0), "called from next door");
        assert_eq!(w.at(2, 0).unwrap().locality_gap(), Some(1.0), "called from elsewhere");
    }

    /// A function wired to nothing has no locality, and must not be handed the calm end of
    /// the ramp for it. Zero would say "everything it touches is next door"; it touches
    /// nothing, which is Reach's subject and not Locality's.
    #[test]
    fn an_unwired_function_has_no_locality_rather_than_perfect_locality() {
        let w = wired(&[("a.rs", Lang::Rust, vec![def("alone", &[])])]);
        assert_eq!(w.at(0, 0).unwrap().locality_gap(), None);
    }

    /// A mutual pair is one neighbour each, not two.
    #[test]
    fn a_mutual_pair_counts_once_from_each_side() {
        let w =
            wired(&[("a.rs", Lang::Rust, vec![def("ping", &["pong"]), def("pong", &["ping"])])]);
        assert_eq!(w.at(0, 0).unwrap().incident, 1);
        assert_eq!(w.at(0, 1).unwrap().incident, 1);
    }
}
