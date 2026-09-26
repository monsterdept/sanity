//! What a report or an export is stamped with: which commit the repo is at, what it is
//! called in public, and each reading checked against the live tree.
//!
//! **Shared by the window and `sanity export-data`, and free of Tauri**, so a build without
//! the window compiles it. `commands.rs` wraps these for the window and adds nothing.

use std::path::PathBuf;

/// The repo's remote, as `owner/name`, or nothing.
///
/// **For the caption on an exported movie, which is the only caller and the reason the
/// answer is a slug rather than a URL.** A directory's basename is what the app calls a
/// project, and it is the wrong name to publish: half the interesting repos on a machine are
/// called `src`, `main` or the same word as somebody else's. The remote is the name the repo
/// answers to in public.
///
/// Both URL shapes, because both are what `origin` actually holds — scp-form
/// (`git@host:owner/name.git`) and a URL (`https://host/owner/name`). The last two segments
/// rather than a host-aware parse: a GitLab subgroup is deeper and still reads correctly as
/// the two names nearest the end, and nothing here needs to know which forge it is looking
/// at. `origin` first, then whatever remote there is, then nothing — a repo with no remote,
/// or no git at all, captions with its own name and the export never mentions it.
pub fn repo_remote(path: String) -> Option<String> {
    let repo = PathBuf::from(path);
    let git = |args: &[&str]| -> Option<String> {
        let out =
            std::process::Command::new("git").arg("-C").arg(&repo).args(args).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
        (!s.is_empty()).then_some(s)
    };
    let url = git(&["remote", "get-url", "origin"]).or_else(|| {
        let first = git(&["remote"])?;
        let first = first.lines().next()?.trim().to_string();
        git(&["remote", "get-url", &first])
    })?;
    slug_of(&url)
}

/// Which commit a repo's working tree is at, and whether it has moved off it.
#[derive(serde::Serialize)]
pub struct RepoHead {
    sha: String,
    /// `None` where git would not say — never read as clean.
    dirty: Option<bool>,
}

/// The commit a report describes, for its cover and its page heads.
///
/// **A report is a photograph, and a photograph of a repo needs the commit on it.** Readings
/// expire when their code moves, so a PDF that says only when it was made cannot be checked
/// against the repo a week later; the sha can. `dirty` because the map draws the working tree —
/// uncommitted lines are on it under their own name — so a report of a dirty tree is of a state
/// no commit holds, and that is worth saying rather than implying the sha is the whole story.
///
/// **`.sanity/` is not dirt.** Reading a repo writes there, so every report of a repo mid-read
/// was stamped `with uncommitted changes` for a tree whose code sat exactly at the sha. Only the
/// root's is left out: `.sanity/` has one home, and a directory elsewhere spelled like it is code.
///
/// Bare `git`, the way `repo_remote` beside it runs it: this is display, and a machine where it
/// fails gets a report with no stamp rather than a wrong one.
pub fn repo_head(path: String) -> Option<RepoHead> {
    let repo = PathBuf::from(path);
    let git = |args: &[&str]| -> Option<String> {
        let out =
            std::process::Command::new("git").arg("-C").arg(&repo).args(args).output().ok()?;
        out.status.success().then(|| String::from_utf8_lossy(&out.stdout).trim().to_string())
    };
    let sha = git(&["rev-parse", "--short=10", "HEAD"]).filter(|s| !s.is_empty())?;
    let dirty =
        git(&["status", "--porcelain", "--", ".", ":(exclude).sanity"]).map(|s| !s.is_empty());
    Some(RepoHead { sha, dirty })
}

/// `owner/name` out of a remote URL. Separate from its caller so it can be tested without a
/// repo to point at.
fn slug_of(url: &str) -> Option<String> {
    let url = url.trim().trim_end_matches('/');
    let url = url.strip_suffix(".git").unwrap_or(url);
    // scp-form has no scheme and puts the path after a colon; a URL puts it after the host.
    // Replacing the colon covers the first and leaves the second alone, since a port would
    // have to be numeric and no segment below is.
    let tail = url.rsplit(['/', ':']).take(2).collect::<Vec<_>>();
    if tail.len() < 2 {
        return None;
    }
    let (name, owner) = (tail[0], tail[1]);
    if name.is_empty() || owner.is_empty() || owner.contains("://") {
        return None;
    }
    Some(format!("{owner}/{name}"))
}

/// The readings as the window receives them: each stamped against the live tree.
///
/// **Pure, and shared by `agent_reports` and `sanity export-data`**, so the offline report is
/// handed exactly what the window is — the same `loc`, the same `stale`, the same dating.
pub fn stamp_reports(
    root: &crate::model::Node,
    reports: &std::collections::HashMap<String, crate::agentapi::Report>,
) -> Vec<crate::agentapi::Report> {
    // **What the window cannot work out for itself: how big each read function is, and
    // whether the reading has expired.** Both need the live tree, which the window has only in
    // part — a large repo arrives without its functions. Built once per poll rather than per
    // report, and not at all for a repo nobody has read, which is the common case and the
    // expensive one: the walk is proportional to the repo and the reports are proportional to
    // the reading somebody has done.
    let mut live: std::collections::HashMap<&str, (Option<&str>, Option<u32>, u32)> =
        std::collections::HashMap::new();
    if !reports.is_empty() {
        root.visit(&mut |n| {
            if n.kind == crate::model::NodeKind::Func {
                live.insert(n.id.as_str(), (n.body.as_deref(), n.bytes, n.loc));
            }
        });
    }
    reports
        .values()
        .cloned()
        .map(|mut r| {
            // A reading whose function is gone reports `loc: 0` and is dropped by the window —
            // it is not stale, it is about code that no longer exists, and the two are
            // different facts.
            let found = live.get(r.id.as_str()).copied();
            r.loc = found.map(|(_, _, loc)| loc).unwrap_or(0);
            r.stale = found
                .map(|(body, bytes, _)| crate::assessment::is_stale(&r, body, bytes))
                .unwrap_or(false);
            // Stamped on the way out, never stored: `legible_dated` is a judgement THIS build
            // makes about a fact the file records, so it has to be recomputed every time the
            // constants move. Writing it into `.sanity/` would freeze one build's opinion into
            // the store and make the next bump invisible.
            r.legible_dated = !crate::assessment::legible_current(r.spec);
            // **Only a `true` expires.** Spec 3 narrowed what counts as a trap — a hazard the
            // code already warns about stopped being one — and a narrowing can only turn old
            // trues into falses, never the other way round. So a reader that looked under the
            // old question and found nothing has still found nothing under this one, and
            // greying its answer would throw away 855 clear readings in this repo alone to
            // re-ask a question whose answer cannot have changed.
            r.trap_dated = r.trap && !crate::assessment::trap_current(r.spec);
            r
        })
        .collect()
}

#[cfg(test)]
mod remote_tests {
    use super::slug_of;

    /// Every shape `origin` is actually found holding, and the two that must come back
    /// empty rather than as a half-answer — a caption is published, so an invented owner is
    /// worse than no owner.
    #[test]
    fn a_remote_url_reduces_to_owner_and_name() {
        for (url, want) in [
            ("git@github.com:barstoolbluz/tonepoet.git", Some("barstoolbluz/tonepoet")),
            ("https://github.com/barstoolbluz/tonepoet.git", Some("barstoolbluz/tonepoet")),
            ("https://github.com/barstoolbluz/tonepoet", Some("barstoolbluz/tonepoet")),
            ("ssh://git@github.com/monsterdept/sanity.git", Some("monsterdept/sanity")),
            ("https://gitlab.com/group/sub/thing.git", Some("sub/thing")),
            ("/Users/rturk/projects/sanity", Some("projects/sanity")),
            ("https://github.com/", None),
            ("sanity", None),
        ] {
            assert_eq!(slug_of(url).as_deref(), want, "{url}");
        }
    }
}
