//! Finding a name on the map.
//!
//! **This lives in the backend because the window does not hold the names.** A large repo is
//! handed a slimmed tree — [`crate::model::Node::slim`] drops every function and sends five
//! numeric columns instead — so on ceph or kibana the browser has directory and file names
//! and nothing else until a ring is fetched. The request this answers is "I need to learn
//! about the objecter but I don't know where it is", and `Objecter` is a class in ceph: the
//! one repo where a client-side search would find nothing at all. The backend's `scan.root`
//! is the full tree, always, which makes this the only place the question can be asked.
//!
//! **What it matches is the NAME, and the path only as a fallback.** Somebody typing
//! `objecter` is naming a thing, not filtering a directory listing — so a function called
//! `objecter_read` beats `src/osdc/Objecter.cc` beats `src/objecter/anything.h`, and the
//! ranking below says so in that order. Path hits are kept because a repo's filing IS how
//! people remember where things are, and dropped to the bottom because they are the weaker
//! reading of what was typed.
//!
//! **Case-insensitive, substring, no fuzz.** A fuzzy matcher was the first instinct and it
//! is the wrong tool for a name you already know: `objctr` matching `Objecter` costs, on
//! every query, a scoring pass that also matches forty things you did not mean, and the
//! failure it fixes — a typo — is one somebody corrects faster than they read the results.
//! Substring is the search everybody's editor has taught them, and it is exact about what it
//! did: every hit here CONTAINS what was typed.

use crate::model::{Node, NodeKind};

/// One place the query was found.
///
/// Carries what the window needs to fly there and nothing else. `line` is how a function is
/// pointed at — see `App`'s `jumpTo`, which resolves a `(path, line)` pair against whatever
/// tree it currently has and fetches the file's ring if it has to. A name would not do: a
/// dozen `init`s in one file are a dozen different functions and picking the first is how a
/// jump lands on the wrong twin.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct Hit {
    /// The node's id — `path` for a container, `path#name@line` for a function.
    pub id: String,
    /// The file or directory this is in, or IS. What the window flies to.
    pub path: String,
    /// What matched, or what the container is called.
    pub name: String,
    pub kind: NodeKind,
    /// Where in the file, for a function. `0` for containers.
    pub line: u32,
    /// Lines, so the list can say how big a thing it is offering.
    pub loc: u32,
    /// The language of the file this is in, so a result list can say `Rust` beside a name
    /// that appears in four languages. `None` on directories and on anything unparsed.
    pub lang: Option<String>,
}

/// How well a hit answers what was typed. Higher is better; the tiers do not overlap.
///
/// **Tiers rather than a weighted sum**, because the orderings inside and between them are
/// different questions. Between tiers it is "did you name this thing" and the answer is
/// categorical; inside a tier it is "which of these did you mean", and the only signal
/// available is size. Adding them into one number lets a 4,000-line file whose path happens
/// to contain the query outrank the function that IS the query, which is the one outcome
/// this ranking exists to prevent.
fn tier(name: &str, path: &str, needle: &str, kind: NodeKind) -> Option<u8> {
    let name_l = name.to_lowercase();
    // A file's name carries an extension and nobody types one. `Objecter.cc` is exactly what
    // was meant by `objecter`, and without this the suffix demotes every file in the repo to
    // a prefix match — which put a directory that happens to share the name above the file
    // that IS it. Containers and functions have no stem; theirs is the name.
    let stem = match kind {
        NodeKind::File => name_l.rsplit_once('.').map_or(name_l.clone(), |(s, _)| s.to_string()),
        _ => name_l.clone(),
    };
    let base = match kind {
        // A function is the most specific thing anybody can name, so an exact function name
        // outranks an exact file name. A directory is the least specific and sorts last
        // within each tier — you can always drill into one, and nobody searches for a
        // directory to learn what is in a single file.
        NodeKind::Func => 2,
        NodeKind::File => 1,
        NodeKind::Dir => 0,
    };
    if name_l == needle || stem == needle {
        return Some(30 + base);
    }
    // A prefix is how people type: three letters of a name they know. It beats a substring
    // because `read_source` for `read` is what was meant and `spread` is not.
    if name_l.starts_with(needle) {
        return Some(20 + base);
    }
    if name_l.contains(needle) {
        return Some(10 + base);
    }
    // The path, last and only if the name said nothing. Checked on the whole path rather
    // than on the parent directory, so `osdc/objecter` finds what typing either half does.
    if path.to_lowercase().contains(needle) {
        return Some(base);
    }
    None
}

/// Every place the query appears, best first, at most `limit` of them.
///
/// **Truncated after ranking, never during the walk.** Stopping at the first `limit` matches
/// would hand back whatever the tree happened to reach first, which is a directory ordering
/// nobody chose — and the exact match somebody typed would be missing because it lives in
/// `zzz/`. The walk is the cheap half anyway: it is a few hundred thousand string
/// comparisons against a tree already in memory, and it runs once per keystroke at most.
///
/// A blank or one-character query returns nothing rather than everything. One character
/// matches a third of a repo, and a list of two hundred equally-good answers is not a search
/// result — it is the map, which the user already has.
pub fn find(root: &Node, query: &str, limit: usize) -> Vec<Hit> {
    let needle = query.trim().to_lowercase();
    if needle.len() < 2 {
        return Vec::new();
    }
    let mut hits: Vec<(u8, Hit)> = Vec::new();
    walk(root, &needle, &mut hits);
    // Rank first, then size, then path — the last one only so a repo with two identical
    // answers returns them in the same order twice. An unstable tie is a list that reshuffles
    // while somebody is reaching for the second row.
    hits.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then(b.1.loc.cmp(&a.1.loc))
            .then(a.1.path.cmp(&b.1.path))
            .then(a.1.line.cmp(&b.1.line))
    });
    hits.truncate(limit);
    hits.into_iter().map(|(_, h)| h).collect()
}

/// The walk, which PRUNES rather than filters.
///
/// `Node::visit` would be the obvious tool and it is the wrong one: it recurses into every
/// child, so skipping an excluded file still offers the functions inside it — and a function
/// in a file the map does not draw is a wedge the camera cannot land on. Exclusion is a
/// property of a subtree, so it has to stop the descent.
fn walk(n: &Node, needle: &str, out: &mut Vec<(u8, Hit)>) {
    if n.excluded {
        return;
    }
    if let Some(rank) = tier(&n.name, &n.path, needle, n.kind) {
        out.push((
            rank,
            Hit {
                id: n.id.clone(),
                path: n.path.clone(),
                name: n.name.clone(),
                kind: n.kind,
                line: n.line.unwrap_or(0),
                loc: n.loc,
                lang: n.lang.map(|l| l.label().to_string()),
            },
        ));
    }
    for c in &n.children {
        walk(c, needle, out);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Lang;

    fn dir(name: &str, path: &str, children: Vec<Node>) -> Node {
        let mut n = Node::dir(path, name);
        n.children = children;
        n
    }

    fn file(name: &str, path: &str, children: Vec<Node>) -> Node {
        let mut n = Node::dir(path, name);
        n.kind = NodeKind::File;
        n.lang = Some(Lang::Rust);
        n.loc = 100;
        n.children = children;
        n
    }

    fn func(name: &str, path: &str, line: u32, loc: u32) -> Node {
        let mut n = Node::dir(path, name);
        n.id = format!("{path}#{name}@{line}");
        n.kind = NodeKind::Func;
        n.line = Some(line);
        n.loc = loc;
        n.lang = Some(Lang::Rust);
        n
    }

    fn repo() -> Node {
        dir(
            "repo",
            "",
            vec![
                dir(
                    "osdc",
                    "src/osdc",
                    vec![file(
                        "Objecter.cc",
                        "src/osdc/Objecter.cc",
                        vec![func("objecter_read", "src/osdc/Objecter.cc", 40, 30)],
                    )],
                ),
                dir(
                    "objecter",
                    "src/objecter",
                    vec![file("notes.md", "src/objecter/notes.md", vec![])],
                ),
                file(
                    "other.rs",
                    "src/other.rs",
                    vec![func("Objecter", "src/other.rs", 7, 12)],
                ),
            ],
        )
    }

    /// The ranking the module docstring promises, in one assertion: the function named for
    /// the query, then the file, then the directory, then the path-only hit.
    #[test]
    fn a_named_function_beats_a_file_beats_a_directory_beats_a_path() {
        let hits = find(&repo(), "objecter", 10);
        let order: Vec<&str> = hits.iter().map(|h| h.id.as_str()).collect();
        assert_eq!(
            order,
            vec![
                "src/other.rs#Objecter@7",
                "src/osdc/Objecter.cc",
                "src/objecter",
                "src/osdc/Objecter.cc#objecter_read@40",
                "src/objecter/notes.md",
            ]
        );
    }

    /// Matching is on the name regardless of case, which is the whole reason `Objecter`
    /// answers `objecter`.
    #[test]
    fn case_is_ignored_on_both_sides() {
        assert_eq!(find(&repo(), "OBJECTER", 10).len(), 5);
        assert_eq!(find(&repo(), "objecter", 10).len(), 5);
    }

    /// A prefix beats a substring — the argument for it is `read` finding `read_source`
    /// before `spread`.
    #[test]
    fn a_prefix_outranks_a_substring() {
        let root = dir(
            "repo",
            "",
            vec![file(
                "a.rs",
                "a.rs",
                vec![
                    func("spread", "a.rs", 1, 50),
                    func("read_source", "a.rs", 9, 10),
                ],
            )],
        );
        let hits = find(&root, "read", 10);
        assert_eq!(hits[0].name, "read_source");
        assert_eq!(hits[1].name, "spread");
    }

    /// Truncation happens after the sort, so the best answer survives a `limit` of one even
    /// when the walk reaches it last.
    #[test]
    fn the_limit_keeps_the_best_hit_not_the_first_one_found() {
        let hits = find(&repo(), "objecter", 1);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].id, "src/other.rs#Objecter@7");
    }

    /// One character is the map, not a search result.
    #[test]
    fn a_query_under_two_characters_finds_nothing() {
        assert!(find(&repo(), "o", 10).is_empty());
        assert!(find(&repo(), " ", 10).is_empty());
        assert!(find(&repo(), "", 10).is_empty());
    }

    /// An excluded file is not on the map, so flying to it would land on nothing — and
    /// neither are the functions INSIDE it, which is the half `Node::visit` would have got
    /// wrong.
    #[test]
    fn excluding_a_file_excludes_the_functions_in_it() {
        let mut root = repo();
        root.children[2].excluded = true;
        let hits = find(&root, "objecter", 10);
        assert!(!hits.iter().any(|h| h.path == "src/other.rs"));
    }

    /// A file's extension is not part of what anybody types, so the stem is what an exact
    /// match is measured against. Without it every file in the repo is demoted to a prefix
    /// hit and a directory sharing the name outranks the file that IS the name.
    #[test]
    fn a_file_matches_exactly_on_its_stem() {
        let hits = find(&repo(), "objecter", 10);
        let file = hits.iter().position(|h| h.id == "src/osdc/Objecter.cc").unwrap();
        let dir = hits.iter().position(|h| h.id == "src/objecter").unwrap();
        assert!(file < dir, "Objecter.cc is a better answer than a directory called objecter");
    }
}
