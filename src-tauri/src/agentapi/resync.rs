//! Re-cutting a file that has moved since the scan, before a range goes out.
//!
//! A scan is a photograph and the repo is not standing still: one edit puts every function
//! below it at the wrong lines, and a reader handed those lines grades a prediction against
//! whatever now sits there. The scan records what each file looked like when it was cut
//! ([`stamp_marks`]), and `resync_changed` re-cuts the ones that differ — positions,
//! signature, docs and body hash, never the node id.

use super::Project;
use crate::model::{Node, NodeKind};
use crate::scan::Scan;
use std::collections::HashMap;
use std::path::Path;

/// What the file looks like on disk right now, or nothing if it cannot be read.
fn mark_of(repo: &Path, rel_path: &str) -> Option<(std::time::SystemTime, u64)> {
    let m = std::fs::metadata(repo.join(rel_path)).ok()?;
    Some((m.modified().ok()?, m.len()))
}

/// Cut one file's functions out of it again, against the file as it is now.
///
/// Positions, signature, docs and body hash are refreshed; the node **id is left alone**.
/// Ids embed `@line` and would all move, and the reports map is keyed by id for this
/// session — re-keying it here is the shape of the migration that once destroyed a
/// project's readings. Nothing parses an id; the durable key is `key_of(path, name, ord)`,
/// which has no line in it precisely so that this is safe.
///
/// Functions that have gone are dropped. Functions that are NEW are not added: the queue
/// would have to score them, and distinctiveness is measured against every peer in the
/// file. They arrive on the next `sanity_open`, which rescans. Said plainly rather than
/// left to be discovered, because "the map is missing a function you just wrote" is a
/// reasonable thing to be confused by.
fn resync_file(root: &mut Node, repo: &Path, rel_path: &str) -> bool {
    fn find<'a>(n: &'a mut Node, path: &str) -> Option<&'a mut Node> {
        if n.kind == NodeKind::File && n.path == path {
            return Some(n);
        }
        n.children.iter_mut().find_map(|c| find(c, path))
    }
    let Some(file) = find(root, rel_path) else {
        return false;
    };
    let Some(lang) = file.lang else {
        return false;
    };
    let Ok(src) = std::fs::read_to_string(repo.join(rel_path)) else {
        return false;
    };

    // Keyed by name and ordinal — position among same-named functions, in line order.
    // The same ordinal `key_of` uses, and for the same reason: a file holds a dozen
    // `parse`s and the name alone cannot say which of them moved where.
    let defs = crate::parse::parse_functions(lang, &src);
    // Re-cut from the same bytes as the functions. The header is half of what a reading is
    // hashed against, so refreshing the bodies while leaving a stale banner on the file node
    // would make every re-hash below disagree with the one the scan takes — the readings
    // would flip to expired and back on alternate opens.
    let fresh_file_doc = crate::parse::file_doc(lang, &src);
    let mut counts: HashMap<&str, usize> = HashMap::new();
    let mut fresh: HashMap<(&str, usize), &crate::parse::FuncDef> = HashMap::new();
    for d in &defs {
        let ord = counts.entry(d.name.as_str()).or_insert(0);
        fresh.insert((d.name.as_str(), *ord), d);
        *ord += 1;
    }

    file.doc = fresh_file_doc.clone();
    // And the file's own reading hash, from the same bytes. Left behind, a file reading
    // taken before an edit would keep looking current against a surface that has changed —
    // and the scan's own hash would disagree with this one, so the reading would flip
    // between current and expired depending on which pass last touched the node.
    file.body = Some(crate::assessment::reading_hash(
        None,
        fresh_file_doc.as_deref(),
        &crate::scan::file_surface(&defs),
    ));
    let mut counts: HashMap<String, usize> = HashMap::new();
    file.children.retain_mut(|c| {
        let ord = counts.entry(c.name.clone()).or_insert(0);
        let this = *ord;
        *ord += 1;
        match fresh.get(&(c.name.as_str(), this)) {
            Some(d) => {
                c.line = Some(d.start_line);
                c.end_line = Some(d.end_line);
                c.loc = d.loc();
                c.ncloc = d.ncloc;
                c.signature = Some(d.signature.clone());
                c.doc = d.doc.clone();
                c.owner = d.owner.clone();
                // Re-hashed here so a reading taken after this points at what the reader
                // actually read. Left stale, `report` would stamp the hash of a body that
                // is already gone and the reading would look current forever.
                c.body = Some(crate::assessment::reading_hash(
                    fresh_file_doc.as_deref(),
                    d.doc.as_deref(),
                    &d.body,
                ));
                true
            }
            None => false,
        }
    });
    true
}

/// What each file looked like at the moment the scan cut its positions.
///
/// **Stamped at the scan, not lazily on the first resync — and that distinction was a real
/// bug.** `resync_changed` used to populate this map itself, treating a first sighting as
/// unchanged: `HashMap::insert` returns `None` for a key it has never held, and
/// `is_some_and` reads that as "not moved". So a file edited between the scan and the first
/// `sanity_next` had its POST-edit mark recorded as though it matched the PRE-edit
/// positions, and was never re-cut for the life of that project.
///
/// Three readers in one wave were handed ranges off by the length of an edit made minutes
/// earlier; one was given a function's doc comment in place of its body and graded a
/// prediction against ten lines of prose. That is the failure `resync_changed` exists to
/// prevent, arriving through its own first line. A mark belongs to the moment the positions
/// were cut, which is the scan.
pub fn stamp_marks(repo: &Path, scan: &Scan) -> HashMap<String, (std::time::SystemTime, u64)> {
    let mut out = HashMap::new();
    scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            if let Some(m) = mark_of(repo, &n.path) {
                out.insert(n.path.clone(), m);
            }
        }
    });
    out
}

/// Re-cut every file that has moved since we last looked.
///
/// Called before anything is handed out, which is the only place it can be: a range is
/// wrong from the moment the file changes, and the queue is what turns a range into a
/// reader's instruction.
///
/// **There is a file watcher now, and it does not replace this.** `watch_tick` rescans the
/// whole project when the repo moves, which re-cuts everything — but it deliberately refuses
/// to run while a reading is out with a reader, because a rescan under a lease produces a
/// report stamped against a body its reader never saw. So the one moment this matters most
/// is exactly the moment the watcher stands down, and this is what covers it: a cheap,
/// targeted re-cut on the path that is about to hand a range to somebody.
///
/// The first pass over a file only records what it looks like — the tree came straight
/// from a scan, so there is nothing to correct yet.
pub(super) fn resync_changed(project: &mut Project) -> usize {
    let repo = project.repo.clone();
    let mut seen: Vec<(String, (std::time::SystemTime, u64))> = Vec::new();
    project.scan.root.visit(&mut |n| {
        if n.kind == NodeKind::File {
            if let Some(m) = mark_of(&repo, &n.path) {
                seen.push((n.path.clone(), m));
            }
        }
    });
    let moved: Vec<String> = seen
        .into_iter()
        .filter(|(path, m)| {
            project.file_marks.insert(path.clone(), *m).is_some_and(|was| was != *m)
        })
        .map(|(path, _)| path)
        .collect();
    if moved.is_empty() {
        return 0;
    }
    for path in &moved {
        resync_file(&mut project.scan.root, &repo, path);
    }
    // Widths and roll-ups follow the lines that just changed, or the parents keep
    // describing a file that is no longer that size.
    project.scan.root.aggregate();
    moved.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agentapi::tests::project_of;
    use crate::agentapi::Report;

    /// An edit made BEFORE the first handout still has to be re-cut.
    ///
    /// The sibling test above edits after calling `resync_changed` once, which is the case
    /// that always worked — and that gap is why this shipped. `file_marks` was populated
    /// lazily by `resync_changed` itself, and its "has this moved" test is
    /// `HashMap::insert(..).is_some_and(|was| was != now)`: `insert` returns `None` for a
    /// key it has never held, so the FIRST sighting of any file recorded whatever the file
    /// looked like at that moment and reported no movement. A file edited between the scan
    /// and the first `sanity_next` therefore had its post-edit mark stored against pre-edit
    /// positions, and could never be seen to move again.
    ///
    /// Three readers in one wave hit it on the same file: two were handed ranges eight
    /// lines short, and one was given a function's doc comment where its body should have
    /// been. Marks are stamped at the scan now, so the first look has something true to
    /// compare against.
    #[test]
    fn a_file_edited_before_the_first_handout_is_still_re_cut() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "fn first() {}
fn second() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        // The edit lands before anything is handed out — no `resync_changed` has run.
        std::fs::write(
            &path,
            "// one\n// two\n// three\nfn first() {}\nfn second() { println!(\"2\"); }\n",
        )
        .unwrap();

        assert_eq!(
            resync_changed(&mut p),
            1,
            "the file moved before the first look and was not re-cut"
        );

        let mut line = None;
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func && n.name == "second" {
                line = n.line;
            }
        });
        assert_eq!(line, Some(5), "re-cut did not move `second` to its new line");
    }

    /// Deleting one of two same-named functions must not silently move a reading onto the
    /// other one.
    ///
    /// `resync_file` matches old children to fresh definitions by (name, ordinal), and an
    /// ordinal is a position — so removing the FIRST of two `go`s makes the survivor's fresh
    /// ordinal 0, which is the deleted one's old slot. A reader flagged it as a trap. What
    /// saves it is the thing that saves every positional scheme here: a reading is checked
    /// against a BODY, so one that lands on the wrong twin is expired rather than believed,
    /// and expired work goes back to the front of the queue.
    ///
    /// The exception is two twins with identical bodies, where the transfer is undetectable
    /// and also harmless — the reading describes that text either way. That is the caveat
    /// `key_of` already carries about reordering, written down here where the mechanism can
    /// be seen.
    #[test]
    fn deleting_a_twin_expires_the_survivors_reading_rather_than_moving_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "impl A { fn go(&self) -> u8 { 1 } }\nimpl B { fn go(&self) -> u16 { 22222 } }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let mut ids = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                ids.push((n.id.clone(), n.body.clone().unwrap_or_default()));
            }
        });
        assert_eq!(ids.len(), 2, "twins are separate readings");
        for (id, body) in &ids {
            p.reports.insert(
                id.clone(),
                Report { id: id.clone(), body: body.clone(), ..Report::blank() },
            );
        }

        // The FIRST twin goes. The survivor slides into its ordinal.
        std::fs::write(&path, "impl B { fn go(&self) -> u16 { 22222 } }\n").unwrap();
        resync_changed(&mut p);

        let mut left = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                let stale = p
                    .reports
                    .get(&n.id)
                    .is_some_and(|r| crate::assessment::is_stale(r, n.body.as_deref(), n.bytes));
                left.push((n.id.clone(), stale));
            }
        });
        assert_eq!(left.len(), 1, "one function left");
        assert!(
            left[0].1,
            "the reading it inherited describes the other twin's body, so it is expired — \
             not silently believed"
        );
    }

    /// A range that has moved is corrected before it is handed to anyone.
    ///
    /// The scan is a photograph; `read_source` and every reader's bounded read go to the
    /// file as it is now. Edit anything and every function below the edit is described at
    /// the wrong lines — the code view highlights the wrong extent, and a reader predicts
    /// one function, reads whatever now occupies those lines, and grades the two against
    /// each other. A reader caught it from the far end: the range it was handed for
    /// `applyAgentReports` held unrelated constants, and it said so rather than grading
    /// them. Nothing else would have.
    #[test]
    fn a_file_that_moved_is_re_cut_before_anything_is_handed_out() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(
            &path,
            "fn first() { println!(\"1\"); }\nfn second() { println!(\"2\"); }\n",
        )
        .unwrap();
        let mut p = project_of(dir.path());

        let line_of = |p: &Project, name: &str| {
            let mut found = None;
            p.scan.root.visit(&mut |n| {
                if n.kind == NodeKind::Func && n.name == name {
                    found = n.line;
                }
            });
            found.expect(name)
        };
        assert_eq!(line_of(&p, "second"), 2);
        let before = {
            let mut h = None;
            p.scan.root.visit(&mut |n| {
                if n.name == "second" {
                    h = n.body.clone();
                }
            });
            h
        };

        // First look only records what the files are — the tree came straight from a scan.
        assert_eq!(resync_changed(&mut p), 0, "nothing has moved yet");

        // Three lines land above it, and `third` is written. This is the shape of every
        // edit made while an assessment is running.
        std::fs::write(
            &path,
            "// one\n// two\n// three\nfn first() { println!(\"1\"); }\nfn second() { println!(\"2\"); }\nfn third() {}\n",
        )
        .unwrap();

        assert_eq!(resync_changed(&mut p), 1, "the file moved and was re-cut");
        assert_eq!(line_of(&p, "second"), 5, "the range follows the function");
        assert_eq!(line_of(&p, "first"), 4);

        // The body is unchanged, so the hash must be too — a reformat or an edit ELSEWHERE
        // in the file is not a reason to expire an honest reading.
        let after = {
            let mut h = None;
            p.scan.root.visit(&mut |n| {
                if n.name == "second" {
                    h = n.body.clone();
                }
            });
            h
        };
        assert_eq!(before, after, "moving a function does not expire its reading");

        // A function written since the scan is not invented here — it needs scoring
        // against every peer in the file, which is a scan's job. It arrives on reopen.
        let mut names = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                names.push(n.name.clone())
            }
        });
        assert_eq!(names, vec!["first", "second"]);
    }

    /// A function deleted under the queue is dropped, not handed out at stale lines.
    #[test]
    fn a_function_that_is_gone_stops_being_offered() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("a.rs");
        std::fs::write(&path, "fn keep() { println!(\"1\"); }\nfn go() { println!(\"2\"); }\n")
            .unwrap();
        let mut p = project_of(dir.path());
        assert_eq!(resync_changed(&mut p), 0);

        std::fs::write(&path, "fn keep() { println!(\"1\"); }\n").unwrap();
        assert_eq!(resync_changed(&mut p), 1);

        let mut names = Vec::new();
        p.scan.root.visit(&mut |n| {
            if n.kind == NodeKind::Func {
                names.push(n.name.clone())
            }
        });
        assert_eq!(names, vec!["keep"]);
    }
}
