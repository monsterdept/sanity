//! Copies: which functions in this repo are the same function.
//!
//! Every other lens on the map is a property of one function — how surprising it is, how
//! recently it changed, how many things call it. This is the first one that is a property of
//! a SET, and that is the whole reason it earns a place: a duplicated body is invisible to
//! every measurement taken one function at a time. It is worst under Surprise, which reads a
//! clone as cold and is right to — a copy IS predictable. Predictable code that should not
//! exist is a different finding from predictable code that should, and nothing else here can
//! tell them apart.
//!
//! Cheap, deterministic and model-free, the same as [`crate::edges`]: the shape comes off the
//! parse that already happened ([`crate::parse::shape_of`]), so it costs one hash per
//! function and is on screen the instant a repo opens.
//!
//! # What this refuses to claim
//!
//! - **Exact after normalisation, and nothing else.** Identifiers and literals are flattened,
//!   comments are dropped, so a copy-paste-and-rename is caught. A copy one statement apart
//!   is NOT, and there is no threshold to tune that would catch it. That is the trade taken
//!   deliberately: everything reported is genuinely the same shape, and nothing reported
//!   needs a judgement call to believe. A near-miss detector would be a better tool and a
//!   worse instrument.
//! - **Small bodies are excluded, not called unique.** See [`crate::parse::MIN_SHAPE_TOKENS`]
//!   — below the floor a getter matches every other getter, and the lens would be reporting
//!   the grammar. They arrive as `None`, which paints gray, on the same rule a language with
//!   no call shape does.
//! - **Families are not mixed.** A Python `main` and a Go `main` are not the same function,
//!   and a token shape crosses languages far more easily than a name does — `{ # ( # ) }` is
//!   every language's smallest wrapper. Grouping within a family is the same rule
//!   [`crate::edges`] follows and the reason it exists here is stronger.
//! - **A group is a fact, not a verdict.** Test tables, generated code, trait boilerplate and
//!   genuine duplication all land here. The map says "these fourteen are one body"; whether
//!   that is a problem is a judgement about the repo, which the tool does not have.

use std::collections::HashMap;

use crate::model::Lang;

/// Which language shapes may be compared with which.
///
/// Deliberately a copy of [`crate::edges`]'s rule rather than a call into it: the two answer
/// the same question about different evidence, and the day one of them wants a different
/// answer — a family that shares call syntax but not statement syntax, say — a shared helper
/// would make that a change to both.
fn family(lang: Lang) -> u8 {
    match lang {
        Lang::C | Lang::Cpp => 1,
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => 2,
        other => 3 + other as u8,
    }
}

/// One function's place in the copies: which group, and how big that group is.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Copy2 {
    /// The group, numbered by where its FIRST member appears in the walk. Stable for one
    /// scan and meaningless across scans — it is how the panel gathers twins, never
    /// something to store.
    pub group: u32,
    /// How many functions share this body, including this one. Always `>= 2`: a function
    /// with no twin has no group.
    pub size: u32,
}

/// Group every function that shares a body with another.
///
/// `files` is the same flat view [`crate::edges::wire`] takes, indexed the same way, so a
/// scan can hand over what it already has and look results up by `(file, func)`.
pub fn find(files: &[crate::edges::FileView<'_>]) -> Copies {
    // Two passes and not one: a group's SIZE is not known until every file has been seen, and
    // a function needs its size at the moment it is turned into a node.
    let mut seen: HashMap<(u8, u64), Vec<(usize, usize)>> = HashMap::new();
    for (fi, file) in files.iter().enumerate() {
        for (qi, func) in file.funcs.iter().enumerate() {
            let Some(shape) = func.shape else { continue };
            seen.entry((family(file.lang), shape)).or_default().push((fi, qi));
        }
    }

    // Numbered by first appearance in the walk rather than by hash order: a HashMap iterates
    // arbitrarily, and a group id that moved between two scans of an unchanged repo would
    // make every panel row jump for no reason a person could see.
    let mut groups: Vec<&Vec<(usize, usize)>> =
        seen.values().filter(|members| members.len() > 1).collect();
    groups.sort_by_key(|members| members[0]);

    let mut per_site = HashMap::new();
    let mut sizes = Vec::new();
    for (g, members) in groups.iter().enumerate() {
        let size = members.len() as u32;
        sizes.push(size);
        for site in members.iter() {
            per_site.insert(*site, Copy2 { group: g as u32, size });
        }
    }
    Copies { per_site, sizes }
}

/// Every function's copies, and the shape of the answer as a whole.
pub struct Copies {
    per_site: HashMap<(usize, usize), Copy2>,
    /// Every group's size, biggest-first order not guaranteed. For the headline count and for
    /// `just scan`'s histogram — a repo with one 40-way group and one with forty pairs are
    /// very different places and a single "N cloned functions" says the same thing about both.
    pub sizes: Vec<u32>,
}

impl Copies {
    /// This function's group, or `None` where it has no twin — which covers both "unique" and
    /// "too small to compare". The caller separates those with `FuncDef::shape`, because only
    /// the first is a finding.
    pub fn at(&self, file: usize, func: usize) -> Option<Copy2> {
        self.per_site.get(&(file, func)).copied()
    }

    /// How many functions are in some group.
    pub fn cloned(&self) -> usize {
        self.per_site.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::edges::FileView;
    use crate::parse::parse_functions;

    /// Long enough to clear `MIN_SHAPE_TOKENS`, and written twice with every name changed —
    /// which is the case the whole module exists for and the one a hash of the raw text
    /// would miss.
    const RUST: &str = r#"
fn alpha(input: &[u32], limit: u32) -> Vec<u32> {
    let mut out = Vec::new();
    for value in input {
        if *value > limit {
            out.push(*value * 2);
        } else {
            out.push(*value + 1);
        }
    }
    out.sort();
    out.dedup();
    out
}

fn beta(items: &[u32], ceiling: u32) -> Vec<u32> {
    let mut kept = Vec::new();
    for item in items {
        if *item > ceiling {
            kept.push(*item * 2);
        } else {
            kept.push(*item + 1);
        }
    }
    kept.sort();
    kept.dedup();
    kept
}

fn gamma(items: &[u32]) -> u32 {
    let mut total = 0;
    for item in items {
        total += *item;
        if total > 100 {
            break;
        }
    }
    total * 3 + items.len() as u32
}
"#;

    #[test]
    fn a_renamed_copy_is_the_same_shape() {
        let funcs = parse_functions(Lang::Rust, RUST);
        assert_eq!(funcs.len(), 3);
        let files = [FileView { path: "a.rs", lang: Lang::Rust, funcs: &funcs }];
        let copies = find(&files);
        let alpha = copies.at(0, 0).expect("alpha has a twin");
        let beta = copies.at(0, 1).expect("beta has a twin");
        assert_eq!(alpha.group, beta.group, "renaming every binding is still a copy");
        assert_eq!(alpha.size, 2);
        assert_eq!(copies.at(0, 2), None, "a different body is not a copy of anything");
    }

    /// The floor doing its job. Without it these two are one group, and so is every other
    /// accessor in the repo — the lens would be reporting that Rust has a `return` keyword.
    #[test]
    fn a_body_under_the_floor_is_not_compared() {
        let src = "fn a(&self) -> u32 { self.x }\nfn b(&self) -> u32 { self.y }\n";
        let funcs = parse_functions(Lang::Rust, src);
        assert_eq!(funcs.len(), 2);
        assert!(funcs.iter().all(|f| f.shape.is_none()), "under {} tokens", crate::parse::MIN_SHAPE_TOKENS);
        let files = [FileView { path: "a.rs", lang: Lang::Rust, funcs: &funcs }];
        assert_eq!(find(&files).cloned(), 0);
    }

    /// Two languages that happen to tokenise the same way are not each other's copies. The
    /// shape alphabet is tiny — braces, parens and two placeholders — so this collides far
    /// more readily than a name does.
    #[test]
    fn families_do_not_mix() {
        let rust = parse_functions(Lang::Rust, RUST);
        let ts = parse_functions(
            Lang::TypeScript,
            "function alpha(input: number[], limit: number) {\n  const out = [];\n  for (const value of input) {\n    if (value > limit) {\n      out.push(value * 2);\n    } else {\n      out.push(value + 1);\n    }\n  }\n  out.sort();\n  return out;\n}\n",
        );
        let files = [
            FileView { path: "a.rs", lang: Lang::Rust, funcs: &rust },
            FileView { path: "a.ts", lang: Lang::TypeScript, funcs: &ts },
        ];
        let copies = find(&files);
        // The two Rust twins still find each other; nothing crosses.
        assert_eq!(copies.at(0, 0).map(|c| c.size), Some(2));
        assert_eq!(copies.at(1, 0), None);
    }

    /// Group ids follow the walk, so an unchanged repo scans to the same numbering twice —
    /// a HashMap's iteration order would renumber every group on every scan.
    #[test]
    fn group_numbering_follows_the_walk() {
        let funcs = parse_functions(Lang::Rust, RUST);
        let files = [FileView { path: "a.rs", lang: Lang::Rust, funcs: &funcs }];
        for _ in 0..8 {
            assert_eq!(find(&files).at(0, 0).map(|c| c.group), Some(0));
        }
    }
}
