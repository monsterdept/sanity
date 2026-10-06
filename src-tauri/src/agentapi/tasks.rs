//! What a reader is handed before it predicts, cut from the tree.
//!
//! A [`Task`] is a function or a whole file: its name, owner, signature, docs and the
//! neighbors either side — everything a new teammate would have, and never the body. The one
//! definition of what is owed is `collect_tasks`, ranked into bands (stale, unread, dated),
//! and the queue, the counts and `verify` all read it rather than re-deriving it.

use super::queue::LEASE;
use super::Report;
use crate::model::{Lang, Node, NodeKind};
use crate::scan::Scan;
use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;

/// One unit of work: everything a reader gets *before* opening the file.
#[derive(Debug, Clone, Serialize)]
pub struct Task {
    pub id: String,
    /// Repo-relative, and there is deliberately no absolute one beside it any more.
    ///
    /// `abs_path` existed so a reader could open the file itself. Under `reveal` the
    /// source arrives from the server, so the only thing an absolute path could still do
    /// is invite the read this design removed — and a field whose sole remaining use is
    /// the forbidden one is not a convenience, it is a door. The relative path stays
    /// because it is real evidence for a prediction: `src-tauri/src/parse.rs` tells a
    /// reader something about what it is being asked to guess.
    pub path: String,
    pub line: u32,
    /// The last line of the body. Handed over so the reader opens the function and only
    /// the function: these files run to thousands of lines, and an unbounded read both
    /// costs a fortune and shows the reader the bodies of functions it is about to be
    /// asked to predict — the read-ahead the ordering exists to prevent.
    pub end_line: u32,
    pub name: String,
    /// The type, trait or class this function hangs off, when it hangs off one.
    ///
    /// The reader was told `parse`, in a file holding a dozen `parse`s, and `peers` showed
    /// it `parse` again — so it predicted one twin, read another, and reported the docs it
    /// had been given as belonging to something else. That reads as a copy-paste bug in
    /// the repo, and it is not one: it is the queue handing over a name that identifies
    /// nothing. Sent as its own field rather than spliced into `name`, because `name` is
    /// half of the key every committed reading is stored under.
    #[serde(default)]
    pub owner: Option<String>,
    /// The declaration line. Without it an overloaded name is unresolvable — the reader
    /// sees the same name twice in `peers` and has to guess which one it was handed.
    #[serde(default)]
    pub signature: String,
    /// Other functions in the same file — the context a teammate would have.
    ///
    /// Qualified by owner where there is one, for the reason above and for one the
    /// dedupe made worse: two same-named twins collapsed to a single entry, so the list
    /// actively concealed that the file held more than one.
    ///
    /// The nearest [`PEER_WINDOW`] in file order, not the whole file — see there for what
    /// the whole file was costing.
    pub peers: Vec<String>,
    /// How many siblings the window left out, so a truncated list is never mistaken for
    /// a complete one. Zero when the file fits.
    #[serde(default)]
    pub peers_omitted: usize,
    /// The documentation OF THIS THING: a function's own comment, or a file's header.
    ///
    /// Handed over BEFORE the prediction on purpose — an agentic reader reads the comments
    /// before the code, so predicting without them measures a harder question than anyone
    /// actually faces.
    ///
    /// It used to be the whole stack, the chunk's doc and then the file's, in one unlabeled
    /// array. That was fine while file headers were rare and became a defect the day they
    /// were collected for every file: two readers in one wave reported a module's header as
    /// the function's own documentation, and one of them graded it against the wrong subject.
    /// An array whose meaning depends on its length is a contract that has to be explained;
    /// two fields explain themselves.
    #[serde(default)]
    pub docs: Vec<String>,
    /// The header of the file this lives in, as CONTEXT rather than as its documentation.
    ///
    /// Empty on a file task, where the header is the subject and arrives in `docs`. Also
    /// empty when the file has none, which is common and is a finding rather than a gap.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub file_doc: String,
    pub lines: u32,
    /// Whether this task is a FILE rather than a function.
    ///
    /// A file reading asks the same three questions one level up: predict what this file is
    /// for from its name, its header and its declarations; then open it and grade whether
    /// the header covers what is actually in there, and whether that header could have been
    /// written from the code alone. It exists because nothing measured the header — it was
    /// handed to every function reader as context and judged by none of them, so a file with
    /// a superb banner and bare functions painted exactly like a file with no banner at all.
    ///
    /// A separate flag rather than a separate endpoint: the queue, the lease, the report and
    /// the store all do the same thing with it, and the one thing that differs is what the
    /// reader is being asked about. `peers` carries the declarations, `docs` carries the
    /// header, and `name` is the file's own name.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub file: bool,
    /// What to do differently, sent only with a file task.
    ///
    /// On the WIRE and only on the tasks it applies to, which is the whole argument. The
    /// alternative was a paragraph in `READER_PROMPT` explaining a kind of task most
    /// readers in a wave never receive — that text is multiplied by the function count,
    /// where this is multiplied by the file count and reaches exactly the reading that
    /// needs it. The same reasoning that put `protocol` and `next_step` in responses
    /// rather than in tool descriptions.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub ask: String,
}

/// The one sentence a file reading needs that a function reading does not.
const FILE_ASK: &str = "\
This task is the FILE, not a function. Predict what the whole file is FOR — its \
responsibility and its shape — from its name, its header in `docs` (empty means it has \
none, which is itself the finding) and the declarations in `peers`, before opening it. Then read it and grade: `predicted` against what you wrote, \
`documented` for whether that header covers what is actually in here, `derivable` for \
whether the header could have been written from the code alone. Leave `legible` and `trap` \
unset — both are judgements about one body.";

/// The one extra sentence a reading needs where no toolchain says what is a test.
///
/// **Sent only to the languages that have no contract**, which is the same argument
/// [`FILE_ASK`] makes: text on the wire is multiplied by the readings it reaches, and this
/// reaches none of a Rust or Go repo's. It is one line because it is one boolean.
const TEST_ASK: &str = "Also set `test`: is this body test code — a test, a fixture, or a helper that exists to support them? Nothing in this language marks it, so judge what the body DOES rather than where it sits: a helper under a tests directory that production calls is not test code, and a fixture builder in a production file is.";

/// How many siblings a reader is shown, at most.
///
/// The list was every function in the file, and on a repo with small files nobody noticed.
/// Measured across three: this repo's median task payload is 920 characters of which 438
/// are siblings; tonepoet's is **5,213 of which 4,759** — 91% — and its p90 is 30,512
/// characters of function names handed to a reader about to read fourteen lines. A full
/// pass there would spend ~22M tokens on sibling lists, more than twice the entire tool
/// contract. It is by a distance the largest thing we control, and it was invisible until
/// `just tokens` was pointed at a repo with big files.
///
/// Twenty, centered on the function, because the value was never a census. "What else is in
/// this file" is a claim about the neighborhood, and the findings this field earns — a
/// test named for a property its neighbors show it does not have — come from the
/// functions either side. Five hundred names are not five hundred times as informative.
///
/// The remainder is reported rather than dropped: a reader handed twenty names with no
/// count would take them for the whole file, which is a different and false statement.
const PEER_WINDOW: usize = 20;

/// The functions either side of this one, and how many were left out.
///
/// Centered where it can be, and sliding to the edges where it cannot — the first function
/// in a file gets twenty below it rather than ten of nothing and ten below.
fn neighbors(names: &[String], i: usize) -> (Vec<String>, usize) {
    if names.len() <= PEER_WINDOW + 1 {
        let peers: Vec<String> =
            names.iter().enumerate().filter(|(k, _)| *k != i).map(|(_, n)| n.clone()).collect();
        return (peers, 0);
    }
    let half = PEER_WINDOW / 2;
    let start = i.saturating_sub(half).min(names.len() - PEER_WINDOW - 1);
    let peers: Vec<String> = names[start..=start + PEER_WINDOW]
        .iter()
        .enumerate()
        .filter(|(k, _)| start + k != i)
        .map(|(_, n)| n.clone())
        .collect();
    let omitted = names.len() - 1 - peers.len();
    (peers, omitted)
}

/// How a language writes "this function, on that type".
///
/// Cosmetic, and still worth getting right: a reader shown `Tag.parse` in a Rust file has
/// been handed a small untruth about the language it is about to read, and the whole
/// exercise is asking it to notice exactly that kind of mismatch.
fn qualify(name: &str, owner: Option<&str>, lang: Option<Lang>) -> String {
    match owner {
        None => name.to_string(),
        // Ruby is deliberately not in the `::` list: there `Foo::bar` means a constant
        // lookup and `Foo#bar` is the method, so neither separator is the obvious one.
        Some(o) if matches!(lang, Some(Lang::Rust | Lang::Cpp | Lang::Php)) => {
            format!("{o}::{name}")
        }
        Some(o) => format!("{o}.{name}"),
    }
}

pub(super) fn collect_tasks(
    node: &Node,
    done: &HashMap<String, Report>,
    leased: &HashMap<String, Instant>,
    // The enclosing file's own comment, carried down so a chunk's task can hand over the
    // whole stack a reader would have rather than only the chunk's own line.
    file_doc: Option<&str>,
    // What this repo declared about its own tests — see `edges::Declarations`. Carried down
    // rather than stored on the tree: it is read from two small files and would otherwise be
    // a serialized field, and a cached tree holding a stale answer to "does this project have
    // tests" would spend a reader's question on every function of a repo that said no.
    declared: &crate::edges::Declarations,
    out: &mut Vec<(f32, Task)>,
) {
    // Past the ceiling this node yields no task, on the `Node::excluded` rule below: still
    // parsed, still drawn, never handed to a reader and never in the denominator. The
    // difference is who decided — `.sanityignore` is the human's judgement about scope, this
    // is a fact about what a reader can hold — so the two absences stay apart on the map and
    // are counted separately. Merging them would let a tool's limitation read as somebody's
    // deliberate exclusion.
    //
    // **This node only, never its subtree.** What the ceiling catches is nearly always a
    // FILE, because a file task is served whole — 856KB is the largest in the corpus against
    // a 177KB largest function — and almost every function inside such a file is perfectly
    // readable. Returning here rather than skipping one task would take a god-file's four
    // hundred functions out of the queue along with it, which is the coverage hole this
    // release is closing, dug from the other end.
    let oversize = node.unreadable();
    if node.kind == NodeKind::Func {
        if oversize {
            return;
        }
        // A reading only excuses a function while it still describes it. Once the body
        // moves, the reading is evidence about code that no longer exists and the
        // function is unread again — which is what makes "update my sanity assessment"
        // the same protocol as making one, rather than a second mode.
        //
        // **A reading can also be superseded without the code moving.** When a graded
        // question is rewritten, the answers to it stop counting — the map greys them, the
        // dials drop them — and until this existed there was no way to work that off: the
        // reading still described the body, so the function returned here and the hole was
        // permanent for anything nobody happened to edit. An expiry a person cannot act on
        // is worse than no expiry, because the app states a gap and then offers no verb.
        //
        // It re-queues for an ORDINARY reading, not for the missing answer alone. Asking a
        // reader only the expired question is the one thing `SPEC` exists to prevent — a
        // grade made by a reader that never predicted this function lands in the same column
        // as one that did, looking comparable. What this buys is a place in the queue.
        let (stale, dated) = match done.get(&node.id) {
            Some(prior) => {
                let stale = crate::assessment::is_stale(prior, node.body.as_deref(), node.bytes);
                let dated = crate::assessment::dated_axis(prior);
                if !stale && !dated {
                    return;
                }
                (stale, dated)
            }
            None => (false, false),
        };
        if leased.get(&node.id).is_some_and(|t| t.elapsed() < LEASE) {
            return;
        }
        // Stale readings outrank everything unread. Code somebody bothered to assess and
        // then changed is where an assessment goes wrong quietly — a wedge that still
        // looks cool because of a reading that expired.
        //
        // A superseded ANSWER ranks below both, and the order is the honest one: stale means
        // the reading describes code that is gone, unread means there is no reading at all,
        // and dated means there is a good reading with one answer greyed out. Three
        // situations, worst first. Bands do not overlap — dated sits at [-1, 0], unread at
        // [0, 1], stale at [2, 3] — so a run works through them in that order however
        // surprising the code is. [1, 2] is left for unread code a finding points at, which
        // only `queue` can know — see `findings_first`.
        let priority = node.score.map_or(0.5, |s| s.surprise)
            + if stale {
                2.0
            } else if dated {
                -1.0
            } else {
                0.0
            };
        out.push((
            priority,
            Task {
                id: node.id.clone(),
                path: node.path.clone(),
                line: node.line.unwrap_or(0),
                end_line: node.end_line.unwrap_or_else(|| node.line.unwrap_or(0) + node.loc),
                name: node.name.clone(),
                owner: node.owner.clone(),
                signature: node.signature.clone().unwrap_or_default(),
                peers: Vec::new(),
                peers_omitted: 0,
                docs: node
                    .doc
                    .as_deref()
                    .map(|d| d.trim().to_string())
                    .filter(|d| !d.is_empty())
                    .into_iter()
                    .collect(),
                file_doc: file_doc.unwrap_or_default().trim().to_string(),
                lines: node.loc,
                file: false,
                // Asked only where no toolchain answers. In Rust and Go the compiler and the
                // build tool already say which bodies are tests, and spending a sentence per
                // reading to be told it again buys nothing — see `Report::test`. Everywhere
                // else a reader is the only source that can see a fixture in a production
                // file, so the question rides on exactly the tasks that need it, which is the
                // argument `FILE_ASK` already makes one field up.
                ask: if crate::edges::skip_test_ask(node.lang, declared) {
                    String::new()
                } else {
                    TEST_ASK.to_string()
                },
            },
        ));
        return;
    }
    if node.kind == NodeKind::File {
        // Out of scope by the repo's own `.sanityignore`. Never queued, never counted in
        // the denominator, still parsed and still on the map — see `Node::excluded`.
        if node.excluded {
            return;
        }
        // The file itself, as its own reading. Same staleness rule as a function: a header
        // that no longer describes the declarations under it is evidence about a file that
        // no longer exists, and goes back in the queue.
        // Read and still current, or out with a reader: nothing to hand over. Written the
        // same way as the function branch above so the two cannot drift on what "done"
        // means — a stale reading is not done, it is first in line.
        let queue_file = match done.get(&node.id) {
            Some(prior) => crate::assessment::is_stale(prior, node.body.as_deref(), node.bytes),
            None => true,
        } && leased.get(&node.id).is_none_or(|t| t.elapsed() >= LEASE)
            // A file with nothing in it has no declarations to describe, so there is no
            // reading to take: the header would be graded against an empty surface.
            && !node.children.is_empty()
            // Too large to serve whole. Its functions carry on below regardless — see the
            // note at the top of this function about which half of the subtree this costs.
            && !oversize;
        if queue_file {
            let stale = done.contains_key(&node.id);
            // Below every function of its own file and above nothing: a file reading is
            // context for the functions inside it, so a reader that takes one first is
            // better placed — but the queue interleaves by file anyway, and a file task
            // that outranked real functions would put a wave of them ahead of the work.
            let priority = node.score.map_or(0.5, |s| s.hot_share) + if stale { 2.0 } else { 0.0 };
            out.push((
                priority,
                Task {
                    id: node.id.clone(),
                    path: node.path.clone(),
                    line: 1,
                    // The last line anything in it reaches. A file reading is the one task
                    // that legitimately wants the whole file, and this is the honest bound
                    // on "the whole file" that the scan actually knows.
                    end_line: node
                        .children
                        .iter()
                        .filter_map(|c| c.end_line)
                        .max()
                        .unwrap_or(node.loc),
                    name: node.name.clone(),
                    owner: None,
                    signature: String::new(),
                    // Every declaration, not a window. The window exists because a function
                    // needs its NEIGHBORS and a file's list of two hundred is mostly noise
                    // to it; a file reading is a judgement about exactly that list, so
                    // truncating it would be asking about a file while hiding part of it.
                    peers: node
                        .children
                        .iter()
                        .map(|c| qualify(&c.name, c.owner.as_deref(), c.lang))
                        .collect(),
                    peers_omitted: 0,
                    docs: node
                        .doc
                        .as_deref()
                        .map(|d| d.trim().to_string())
                        .filter(|d| !d.is_empty())
                        .into_iter()
                        .collect(),
                    file_doc: String::new(),
                    lines: node.loc,
                    file: true,
                    ask: FILE_ASK.to_string(),
                },
            ));
        }
        // Qualified by owner, and kept in FILE ORDER rather than sorted. Order is what
        // makes the window below mean something: the functions either side of this one are
        // what a person scrolling past would see, and the findings this field actually
        // produces — a test whose name promises more than its neighbors deliver — come
        // from that adjacency, not from an alphabetical census.
        let names: Vec<String> =
            node.children.iter().map(|c| qualify(&c.name, c.owner.as_deref(), c.lang)).collect();
        // AFTER the file's own task, which already carries the complete list and must not
        // have it replaced by a function's window.
        let before = out.len();
        // Which child produced which task, so each one gets its own neighborhood. Not
        // every child yields a task — read and leased ones are skipped — so the index
        // cannot be inferred from position in `out`.
        let mut from: Vec<usize> = Vec::new();
        for (i, c) in node.children.iter().enumerate() {
            let mark = out.len();
            collect_tasks(c, done, leased, node.doc.as_deref(), declared, out);
            from.extend(std::iter::repeat_n(i, out.len() - mark));
        }
        for (k, (_, t)) in out.iter_mut().skip(before).enumerate() {
            let (peers, omitted) = neighbors(&names, from[k]);
            t.peers = peers;
            t.peers_omitted = omitted;
        }
        return;
    }
    for c in &node.children {
        collect_tasks(c, done, leased, None, declared, out);
    }
}

/// Every task the queue could hand out, with nothing read and nothing leased.
///
/// For measurement, not for handing out — `just tokens` weighs the payload a reader
/// actually receives, and building a second version of it in the tool would measure the
/// wrong thing the moment either drifted. `peers` in particular has no bound: it is every
/// function in the file, and a 400-function file sends all 400 names to every reader that
/// touches it.
pub fn all_tasks(scan: &Scan, repo: &std::path::Path) -> Vec<Task> {
    let mut out = Vec::new();
    collect_tasks(
        &scan.root,
        &HashMap::new(),
        &HashMap::new(),
        None,
        &crate::scan::declared_from_scan(repo, &scan.root),
        &mut out,
    );
    out.into_iter().map(|(_, t)| t).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::project_of;

    /// An answer that stopped answering today's question goes back in the queue, LAST.
    ///
    /// Without this a bump was an expiry nobody could work off: the reading still described
    /// the body, so `collect_tasks` returned early and the grey stayed until somebody
    /// happened to edit that function. The order matters as much as the fact — a stale
    /// reading describes code that is gone and an unread function has nothing at all, so
    /// both outrank a good reading with one answer greyed.
    #[test]
    fn a_superseded_answer_is_re_offered_after_everything_else() {
        let mut file = crate::model::Node::dir("src/a.rs", "a.rs");
        file.kind = NodeKind::File;
        file.path = "src/a.rs".into();
        let mut root = crate::model::Node::dir("", "");
        let mut done: HashMap<String, Report> = HashMap::new();
        for (i, name) in ["stale_one", "unread_one", "dated_one", "current_one"].iter().enumerate()
        {
            let mut n = crate::model::Node::dir("src/a.rs", name);
            n.kind = NodeKind::Func;
            n.id = format!("src/a.rs#{name}");
            n.path = "src/a.rs".into();
            n.line = Some(i as u32 * 10);
            n.body = Some(crate::assessment::body_hash(name));
            let mut r = Report::blank();
            r.id = n.id.clone();
            r.body = n.body.clone().unwrap_or_default();
            r.spec = crate::assessment::SPEC;
            match *name {
                // Its body moved under it.
                "stale_one" => r.body = crate::assessment::body_hash("something else entirely"),
                // A trap flagged under the question spec 3 narrowed.
                "dated_one" => {
                    r.trap = true;
                    r.note = "the bite".into();
                    r.spec = crate::assessment::TRAP_SINCE - 1;
                }
                _ => {}
            }
            if *name != "unread_one" {
                done.insert(n.id.clone(), r);
            }
            file.children.push(n);
        }
        root.children.push(file);
        let mut out = Vec::new();
        collect_tasks(&root, &done, &HashMap::new(), None, &Default::default(), &mut out);
        out.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
        // The file's own header reading is in here too and is not what this is about.
        let order: Vec<&str> =
            out.iter().filter(|(_, t)| !t.file).map(|(_, t)| t.name.as_str()).collect();
        assert_eq!(
            order,
            vec!["stale_one", "unread_one", "dated_one"],
            "worst first, and a reading that is current on every axis is not offered at all"
        );
    }

    /// Same-named twins must arrive distinguishable, and both must appear in the peers.
    ///
    /// A reader handed `udf.rs#parse`, with `parse` also in its sibling list, cannot tell
    /// which of the file's dozen `parse`s it has. It predicts one, reads another, grades
    /// itself against the mismatch, and reports the docs as belonging to something else —
    /// a copy-paste bug in the repo that is not there. The old peers list made it worse by
    /// deduping bare names, so the twins collapsed into a single entry and the list
    /// concealed exactly what the reader needed.
    #[test]
    fn same_named_methods_arrive_with_the_type_they_hang_off() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("udf.rs"),
            "impl DescriptorTag {\n    fn parse(b: &[u8]) -> u8 { b[0] }\n}\n\
             impl LogicalVolumeDescriptor {\n    fn parse(b: &[u8]) -> u16 { 1 }\n}\n",
        )
        .unwrap();
        let p = project_of(dir.path());

        let mut out = Vec::new();
        collect_tasks(
            &p.scan.root,
            &p.reports,
            &HashMap::new(),
            None,
            &crate::scan::declared_from_scan(&p.repo, &p.scan.root),
            &mut out,
        );
        let tasks: Vec<Task> = out.into_iter().map(|(_, t)| t).filter(|t| !t.file).collect();
        assert_eq!(tasks.len(), 2);

        let owners: Vec<Option<&str>> = tasks.iter().map(|t| t.owner.as_deref()).collect();
        assert!(
            owners.contains(&Some("DescriptorTag"))
                && owners.contains(&Some("LogicalVolumeDescriptor")),
            "each twin must say which type it belongs to: {owners:?}"
        );
        // Each sees the other, qualified — not a bare `parse`, and not nothing.
        for t in &tasks {
            assert_eq!(t.peers.len(), 1, "the twin must be visible: {:?}", t.peers);
            assert_eq!(t.peers_omitted, 0, "a two-function file fits in the window");
            assert!(t.peers[0].ends_with("::parse"), "unqualified peer: {:?}", t.peers);
            assert_ne!(
                t.peers[0],
                qualify(&t.name, t.owner.as_deref(), Some(Lang::Rust)),
                "a function must not be listed as its own peer"
            );
        }
    }

    /// A file is handed out as its own reading, with the header and the whole list.
    ///
    /// The header was collected and fed to every function reader as context, and judged by
    /// nobody — so a file with a careful banner over bare functions painted exactly like a
    /// file with no banner at all. This is the reading that closes that.
    #[test]
    fn a_file_is_queued_as_its_own_reading() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("gate.rs"),
            "//! The gate module.\n//! Opens and closes.\n\n             fn open() { println!(\"1\"); }\nfn shut() { println!(\"2\"); }\n",
        )
        .unwrap();
        let p = project_of(dir.path());

        let mut out = Vec::new();
        collect_tasks(
            &p.scan.root,
            &p.reports,
            &HashMap::new(),
            None,
            &crate::scan::declared_from_scan(&p.repo, &p.scan.root),
            &mut out,
        );
        let file: Vec<&Task> = out.iter().map(|(_, t)| t).filter(|t| t.file).collect();
        assert_eq!(file.len(), 1, "one file, one file reading");
        let t = file[0];

        assert_eq!(t.id, "gate.rs", "keyed by path — a function id always holds a `#`");
        assert_eq!(t.docs, vec!["The gate module.\nOpens and closes."]);
        assert_eq!(t.peers, vec!["open", "shut"], "every declaration, not a window");
        assert_eq!(t.peers_omitted, 0);
        assert!(!t.ask.is_empty(), "a file task says how its question differs");
        // The functions still come through unchanged, and say nothing about being files.
        assert_eq!(out.iter().filter(|(_, t)| !t.file).count(), 2);
    }

    /// What expires a file reading, and what must not.
    ///
    /// A file reading answers "does this banner describe what is in here". Rewriting the
    /// banner or changing the declarations makes that a different question; rewriting a
    /// body does not, and expiring on it would put every file back in the queue on every
    /// commit — which teaches people to ignore the flag.
    #[test]
    fn a_file_reading_expires_on_its_header_and_its_surface() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("gate.rs");
        let hash = |src: &str| {
            std::fs::write(&path, src).unwrap();
            let p = project_of(dir.path());
            let mut found = None;
            p.scan.root.visit(&mut |n| {
                if n.path == "gate.rs" && n.kind == crate::model::NodeKind::File {
                    found = n.body.clone();
                }
            });
            found.expect("a file carries the hash its reading is checked against")
        };

        let base = hash("//! The gate.\n\nfn open(a: u8) { println!(\"1\"); }\n");
        assert_ne!(
            base,
            hash("//! The valve.\n\nfn open(a: u8) { println!(\"1\"); }\n"),
            "a rewritten header is a different file to describe"
        );
        assert_ne!(
            base,
            hash("//! The gate.\n\nfn open(a: u16) { println!(\"1\"); }\n"),
            "a changed declaration is a different file to describe"
        );
        assert_ne!(
            base,
            hash("//! The gate.\n\nfn open(a: u8) { println!(\"1\"); }\nfn shut() {}\n"),
            "a new declaration is a different file to describe"
        );
        assert_eq!(
            base,
            hash("//! The gate.\n\nfn open(a: u8) { println!(\"changed\"); }\n"),
            "rewriting a body does not change what the header has to describe"
        );
    }

    /// A big file hands over its neighborhood, and says how much it left out.
    ///
    /// The whole-file list was 91% of tonepoet's median task payload, 30k characters at its
    /// p90. What a truncated list must never do is look complete.
    #[test]
    fn a_long_file_sends_the_neighborhood_and_counts_the_rest() {
        let names: Vec<String> = (0..100).map(|i| format!("fn_{i:02}")).collect();

        // Middle of the file: centered, and the remainder is stated rather than dropped.
        let (peers, omitted) = neighbors(&names, 50);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(!peers.contains(&"fn_50".to_string()), "never its own peer");
        assert!(peers.contains(&"fn_49".to_string()) && peers.contains(&"fn_51".to_string()));

        // First in the file: the window slides rather than half-emptying.
        let (peers, omitted) = neighbors(&names, 0);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert_eq!(omitted, 99 - PEER_WINDOW);
        assert!(peers.contains(&"fn_01".to_string()));

        // Last, likewise.
        let (peers, _) = neighbors(&names, 99);
        assert_eq!(peers.len(), PEER_WINDOW);
        assert!(peers.contains(&"fn_98".to_string()));

        // A file that fits is handed over whole, and says so with a zero.
        let small: Vec<String> = (0..5).map(|i| format!("f{i}")).collect();
        let (peers, omitted) = neighbors(&small, 2);
        assert_eq!(peers.len(), 4);
        assert_eq!(omitted, 0);
    }
}
