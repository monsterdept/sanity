//! What the orchestrator and each reader are told, and the warnings an open carries.
//!
//! Two texts, priced differently: [`PROTOCOL`] goes to one driving session once, and
//! [`reader_prompt`] goes into every reader, so it is multiplied by the function count.
//! Beside them are the sentences a response carries rather than a schema — the transient
//! `NO_PROJECT`, the repo's own agent instructions, and a shim serving an older contract.

use std::path::Path;

/// What a reader is told when its reading has nowhere to land.
///
/// This is usually TRANSIENT and was phrased as though it were permanent. The app is
/// rebuilt and relaunched constantly during development, and a restore rescans in the
/// background — so for a second or two after every restart the server is up, answering,
/// and holding no projects. `mcp.rs` cannot absorb that the way it absorbs a refused
/// connection, and deliberately so: an HTTP response that parsed is an answer, and
/// blind-retrying a `report` the server already handled would double-bank a reading.
///
/// So the message has to do the work. Three readers hit the flat "no project open" during
/// this window; two retried on instinct and the third did not, and its reading — a
/// prediction, a read and a grade already paid for — was simply lost. A reader that cannot
/// tell "wait a moment" from "there is nothing here" will pick one, and the expensive
/// mistake is the one that discards work.
pub(super) const NO_PROJECT: &str = "No project is open for this call. If you were assessing a moment \
    ago this is TRANSIENT — the app restarts during development and takes a second or two \
    to reload its projects. Wait a moment and CALL sanity_report AGAIN with exactly the \
    same arguments, up to about five times; do NOT discard the reading you just made, and \
    do not start over. If it keeps failing, the human needs to call sanity_open, so stop \
    and say so rather than throwing the reading away.";

/// What to say about the repo's own agent instructions, if it has any.
///
/// **The condition this warns about is invisible from inside a reading.** A host that
/// injects `CLAUDE.md` into every subagent hands each reader a description of the
/// architecture it is about to predict, and the reading comes back honestly `cold` — it had
/// not opened the file — while being substantially recall. A full pass of a real repo shipped
/// with a caveats document reconstructing this from readers who happened to mention it in
/// chat, because nothing had asked them and nothing had warned the human.
///
/// Here rather than in an `inputSchema` description, on the standing rule: a description is
/// loaded once per FUNCTION and this is one sentence per RUN, addressed to the one party who
/// can act on it. A reader cannot unsee its own system prompt — by the time it calls
/// anything, the context is already built. Only the human relaunching decides this.
///
/// **It ASKS, and the first version asserted — which made it worse than saying nothing.**
/// All this function can see is whether the repo has the file. Whether a given session
/// LOADED it is invisible here, and the first draft papered over that with "each reader
/// arrives already holding a description", stated flat. The orchestrator receiving that had
/// the evidence to contradict it — its own context held no brief, because the human had
/// launched with `--setting-sources user` an hour earlier — and relayed it anyway. Noticing
/// an absence is the one thing nobody does unprompted; a tool that has just stated a fact
/// about the repo is a credible source; so a correct belief was overwritten by a wrong one.
/// It then reached the human as "CLAUDE.md WILL be injected into every reader", because the
/// hedge is the first thing lost when a warning is relayed. Anything a tool asserts arrives
/// at the person stronger than it left.
///
/// So the response states only what this process knows, and hands the rest to the party that
/// can actually see it. Asked plainly, an orchestrator answers correctly in both directions;
/// it is the same footing as `cold` and `primed`, which is the footing everything about
/// priming is on. Phrased not to lead, for the same reason.
///
/// **And it says which evidence does not count.** The next orchestrator to get this went and
/// looked: listed the repo, stat'd the file, reported its size, and concluded from its
/// existence on disk that it was holding it. That is the same error one layer down — a fact
/// about the repo answering a question about a session — and it is the obvious thing to do
/// unless told otherwise, because the file is right there and the context is not
/// inspectable in the same way. Naming the two things that prove nothing is cheaper than
/// hoping.
///
/// Absent when the repo has no such file, so a clean repo says nothing. It is a warning and
/// not a refusal: whether the priming matters is a judgement about a specific repo and a
/// specific question, and the tool's job is to make sure nobody discovers it afterwards.
pub(super) fn priming_note(repo: &Path) -> Option<String> {
    let docs = crate::assessment::agent_docs(repo);
    (!docs.is_empty()).then(|| {
        format!(
            "This repo has {docs} at its root. Sanity cannot see whether your session \
             loaded it, so CHECK YOUR OWN CONTEXT before you decide anything. Neither this \
             message nor the file being on disk is evidence about your context — the only \
             question is whether it is in your instructions. If it is not there, this \
             session was launched \
             without project instructions, your readers inherit that, and the run is clean \
             — say so in one line and carry on. If it is there, every reader arrives \
             holding a description of the code it is about to predict, `predicted` measures \
             recall, and the readings stay honestly `cold` so nothing downstream catches \
             it: tell the human before the first wave, because relaunching with `claude \
             --setting-sources user` is the remedy and only they can do it. Either way \
             every reader answers `primed` for itself, and the store records what the repo \
             held, so the run says which it was."
        )
    })
}

/// What to say about the caller's tool contract, if anything.
///
/// **The failure this exists for produced no error at all.** `tools/list` is answered from
/// the shim's own process image, so a shim left running across a rebuild keeps offering the
/// schema it was compiled with. Two fields were added to `report`; the shim serving readers
/// had never heard of them; the readers could not send what they were not offered; and the
/// store recorded the absence as "no opinion", which is a legitimate value. Eighty readings
/// were taken before anyone noticed, and only because someone read an aggregate and saw a
/// column of zeroes.
///
/// Every part of that chain behaved correctly. The only place the mismatch was knowable was
/// here, where both halves are in one process and neither was being asked.
pub(super) fn contract_note(sent: Option<&str>) -> Option<String> {
    let mine = crate::mcp::contract_fingerprint();
    match sent {
        Some(f) if f == mine => None,
        Some(_) => Some(
            "Your MCP server is serving a DIFFERENT tool contract from this backend. It \
             was almost certainly started before the binary was rebuilt, and `tools/list` \
             is answered from its own process image — so readers are being offered an \
             older schema and will silently omit any field it does not know about. \
             Restart or reconnect the sanity MCP server before assessing; readings taken \
             now may be missing fields nobody will notice are absent."
                .to_string(),
        ),
        None => Some(
            "Your MCP server predates the contract check and may be serving an older \
             schema than this backend. If it has been running since before the last \
             rebuild, restart or reconnect it before assessing."
                .to_string(),
        ),
    }
}

/// The instruction handed back on every open.
///
/// Returned as *data* rather than left to the tool description, because the description
/// is read once when the session starts and this is read at the moment it matters. The
/// contamination problem is the whole reason: an agent that has been working in a repo
/// does not predict its functions, it recalls them, and recall scores as "not surprised"
/// on everything. That silently turns the measurement into a rubber stamp.
///
/// A subagent is the only thing that reliably fixes it — a fresh context window that
/// receives exactly what it is given and nothing else.
///
/// **One function per reader**, which is the correction this text most recently needed.
/// It used to ask for ten, and ten is a scale that widens as the reader works: `cold`
/// catches a file the reader has opened before and catches nothing about the idioms,
/// naming and vocabulary it has absorbed by its eighth prediction. Readings from one run
/// were therefore not comparable to each other, and the improvement read as code getting
/// clearer. One each is not merely cleaner — it is cheaper, because a batch re-sends every
/// earlier prediction on every turn.
pub const PROTOCOL: &str = "\
HOW TO RUN THIS — read all of it before starting.\n\n\
YOU DO NOT ASSESS ANYTHING, AND YOU DO NOT SPAWN READERS. Sanity spawns them itself, as \
separate processes that have no access to this repo and see only what they are handed. \
Your context is full of this codebase: anything you 'predicted' you would be recalling, \
which grades as predicted and quietly turns the measurement into a rubber stamp.\n\n\
  1. WHICH MODEL READS IS PART OF THE MEASUREMENT — ASK BEFORE STARTING, unless the user \
     already said. Predictability is what a competent reader could predict, so the reader IS the \
     scale: a smaller model predicts less, and its readings are not comparable with \
     the ones already banked. Propose Sonnet and say why in one line. Never mix models \
     within a repo to save money — that is one map on two scales, with nothing on screen \
     saying which wedge is which.\n\
  2. ON A LARGE REPO, ASK FIRST. `functions` plus `files` in the sanity_open response is \
     the size of the job — a file is a reading too, graded on whether its header describes \
     what is in it. If that is more than the user has agreed to spend, say so and pass \
     their cap as `limit` rather than starting and stopping.\n\
  3. Call sanity_check. It returns as soon as the wave is launched; the run continues in \
     the background and survives this session ending.\n\
  4. Poll sanity_status. `remaining` only falls when a reading lands; `in_flight` is what \
     is out with readers; `run` says how many readers Sanity has started, how many \
     finished, and how many FAILED. Readers failing while nothing lands is a broken \
     configuration, not a slow run — say so rather than waiting it out.\n\
  5. When `run.running` is false, report from sanity_summary. Do NOT reconstruct the \
     result from anything you remember, and do NOT read `.sanity/` — a session that has \
     seen the previous readings cannot honestly describe the new ones. If the run stopped \
     short, say so and say how many are left: 'done' and 'out of budget' are different \
     outcomes.\n\n\
Findings are written into the repo itself, at `.sanity/`, as Markdown a person can read. \
Tell the user they are there and that they are theirs to commit; it is not yours to commit \
for them.\n\n\
UPDATING AN EXISTING ASSESSMENT is the same call with nothing added. `stale` counts \
readings whose code has since changed, and those are handed out first.";

/// The half of the protocol a reader receives, split out because it is priced differently.
///
/// Everything above goes to one orchestrator, once. This goes into every subagent, so on a
/// repo of any size it is multiplied by the function count — and `just tokens` has to be
/// able to weigh the two apart. It found this out the hard way first, by locating the
/// boundary with a string search for a heading that had just been reworded, and quietly
/// reporting the whole protocol as the reader's share. A boundary worth measuring is worth
/// making structural.
///
/// Terse on purpose. It used to restate every `sanity_report` field, which the tool schema
/// already carries — one contract, billed to each reader twice.
///
/// **The brief clause is about DISCLOSURE, not access, and that is not a softening.** A
/// `CLAUDE.md` is injected into a subagent's context by the harness before the reader does
/// anything, so "do not read it" is a rule that cannot be followed — and a rule that cannot
/// be followed is how readers learn to treat the rest of this as advisory. What a reader can
/// actually do is notice, discount, and say so.
///
/// It is here rather than nowhere because the question keeps arriving from outside: two
/// separate users' agents reported the same thing, that a repo's brief names specific
/// functions and readers then predict them from it. The measurement was defensible — a new
/// teammate reads the brief too, and documentation reaching the instrument is the whole
/// design — but "defensible" is not the same as "recorded", and the honest answer to a
/// recurring question is a field in the record rather than a paragraph in a reply.
///
/// What it costs: the reader's fixed prefix went 2,212 → 2,315 tokens, ~103 per reading, or
/// about 65k across a full pass of this repo. What it buys is the one thing the corpus could
/// not otherwise say — WHICH readings leaned on the brief — and it narrows what `predicted`
/// claims from "predictable to a new teammate" to "predictable from the handout", which is
/// the only half this tool controls.
/// What one reader is told to do, for a run that hands it `n` functions.
///
/// **A function rather than a constant, and `n` is always [`BATCH`].** It was ten in two
/// places — spelled out in words here, and in `BATCH` for sizing a wave — which is two
/// things that must agree and nothing making them. A wave sized for a batch the readers
/// were never asked to take hands out work nobody collects.
///
/// It briefly took the batch from the request, as a speed-versus-cost slider in the Read
/// dialog. That is removed: the cost curve has no knee to aim at, and the batch is a reading
/// CONDITION — recorded per reading as `position` — so varying it across one repo makes that
/// repo's corpus a mixture in the same way two models do. See the constant.
///
/// Digits, not words. "assessing EXACTLY TEN THINGS" reads better and does not survive
/// substitution — "EXACTLY SEVEN THINGS" needs a spelling table for a string that is
/// already priced per reading.
pub fn reader_prompt(n: usize) -> String {
    format!(
        "\
  You are reading a codebase you have never seen, and you are assessing EXACTLY {n} \
  THINGS, ONE AT A TIME. Repeat this {n} times: call sanity_next with no arguments and \
  it hands you exactly one — usually a function, occasionally a whole file, which carries \
  an `ask` field saying how its question differs; write what you expect its body to do \
  from the name, owner, signature, siblings and docs alone — two or three sentences, no \
  more — THEN call sanity_reveal with that prediction as `expected`, which returns the \
  source; read it and call sanity_report. Only then call sanity_next again. After the \
  last report, stop.\n\n\
  Your prediction is recorded when you ask for the source, and asking again returns the \
  same code and changes nothing. So write it before you call, and write what you actually \
  expect rather than something safe.\n\n\
  A LARGE BODY ARRIVES IN PARTS. The reply says `part N of M`; call sanity_reveal again \
  with the next `part` until you hold all of them, then report. If you cannot get them \
  all, say so to the human and take no reading — do not grade from what you have, and do \
  not go and fetch the rest another way.\n\n\
  Do not ask for more than one at a time. One handout is one function on purpose: a \
  reader given several at once has read every signature, owner and peer list in the batch \
  before it predicts the first, and it costs no less. Set `position` to 1 through {n} in \
  the order you assess them.\n\n\
  Grade `predicted` against what you WROTE, not against what you understand now: the \
  question is what the code told a stranger.\n\n\
  THE PROJECT'S OWN BRIEF IS NOT THE HANDOUT. This repo's CLAUDE.md or AGENTS.md may \
  already be in your context, and some of them explain specific functions by name. Do not \
  open one, and do not let it carry a prediction: predict from the name, owner, signature, \
  peers and docs you were given. Where you notice you knew something from the brief rather \
  than from the handout, grade on the handout alone. Report `primed` on whether THIS \
  REPO's brief was in your context at all — a personal or global instructions file is not \
  it, and whether the brief helped is not the question, since you cannot fully know.\n\n\
  Read only what sanity_reveal gives you. Do not open the repo yourself, do not spawn \
  subagents, and do NOT read the `.sanity/` directory — it holds the previous reader's \
  findings, and seeing them makes everything you say afterwards worthless. If a tool \
  errors, read the message: connection failures \
  are usually transient, so wait and retry the same call a few times rather than \
  inventing a prerequisite or running the tools as shell commands."
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A shim serving a different contract is told so; a matching one is not.
    ///
    /// The bug this guards produced no error anywhere. A shim left running across a rebuild
    /// kept serving a schema without `legible` or `trap`; the readers omitted what they were
    /// never offered; the store recorded the absence as "no opinion", which is a real value;
    /// and eighty readings landed before an aggregate of zeroes gave it away. Silence on the
    /// happy path is part of the contract too — a warning that is always present is one an
    /// orchestrator stops reading.
    #[test]
    fn a_shim_serving_a_stale_contract_is_told_to_restart() {
        let mine = crate::mcp::contract_fingerprint();
        assert!(contract_note(Some(&mine)).is_none(), "a matching contract must say nothing");

        let stale = contract_note(Some("0000000000000000")).expect("a mismatch must be reported");
        assert!(
            stale.to_lowercase().contains("restart"),
            "the warning has to say what to do: {stale}"
        );

        // A shim too old to send one at all is the same hazard wearing a different face.
        assert!(contract_note(None).is_some(), "a caller that cannot say must still be warned");
    }

    /// The priming warning asks; it must never assert that the reader is primed.
    ///
    /// **This is the whole defect it was rewritten for, so the test is about the wording.**
    /// The first version said "each reader arrives already holding a description", flat, on
    /// the strength of a file existing on disk. An orchestrator running in a session
    /// launched with `--setting-sources user` — no brief in its context, the human having
    /// taken the advice an hour earlier — relayed it to that human as fact, and it reached
    /// them stronger than it was written, because a hedge is the first thing lost in a
    /// relay. A tool cannot see a session's context and must not imply that it can; what it
    /// can do is name what it found, say what it cannot see, and hand the question to the
    /// only party able to answer it.
    ///
    /// It must still name the flag. A reader that hit an earlier flat warning elsewhere in
    /// this tool invented a prerequisite, another ran the tools as shell commands, and a
    /// third read `.sanity/` to compensate, which contaminated it. "You may be
    /// contaminated" with nothing to do about it is that failure with better manners.
    #[test]
    fn the_priming_warning_asks_rather_than_asserts() {
        let dir = tempfile::tempdir().unwrap();
        assert!(
            priming_note(dir.path()).is_none(),
            "a repo with no instructions file has nothing to warn about"
        );

        std::fs::write(dir.path().join("CLAUDE.md"), "# notes\n").unwrap();
        let note = priming_note(dir.path()).expect("a repo that has one");
        assert!(note.contains("CLAUDE.md"), "names what it found: {note}");
        assert!(note.contains("--setting-sources user"), "and what to do: {note}");
        // What it cannot see, said out loud, and the check handed over.
        assert!(note.contains("cannot see"), "admits its own blindness: {note}");
        assert!(note.contains("CHECK YOUR OWN CONTEXT"), "and delegates it: {note}");
        // The clean branch has to be reachable from the text alone, or an orchestrator that
        // IS clean has nothing to conclude and falls back to the alarming reading.
        assert!(note.contains("the run is clean"), "offers the other answer: {note}");

        // Two of them are both named — a run launched to exclude one and not the other is
        // still primed, and a warning that mentioned only the first would look satisfied.
        std::fs::write(dir.path().join("AGENTS.md"), "# notes\n").unwrap();
        let both = priming_note(dir.path()).expect("still warns");
        assert!(both.contains("CLAUDE.md, AGENTS.md"), "got: {both}");
    }
}
