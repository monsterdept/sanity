import { legibleOf, trapOf, type AgentReport, type Node } from './api'
import { MODE_LABEL, paintsFromReadings, paintsFromWiring, REPLAY, replayNote, type ColorMode } from './colorMode'

/** How many current readings grade each lens a reading paints.
 *
 * **A repo-wide count cannot answer a per-lens question.** ComfyUI has four hundred readings and
 * not one of them grades Legibility: its file readings do not answer that question and its older
 * function readings answered a version of it that has since been rewritten. Gated on the total,
 * the report gave Legibility a full spread — figure, key, tables, interpretation, limitations —
 * whose only true sentence was `No current grade exists for 100% of function lines`.
 *
 * Counted through the same accessors the map paints by (`legibleOf`, `trapOf`), never by reading
 * the fields here: a second copy of "does this grade count" is how a lock comes to disagree with
 * the wedges it is standing in for. */
export function gradedCounts(reports: readonly AgentReport[]): Partial<Record<ColorMode, number>> {
  const out = { surprise: 0, legible: 0, docs: 0, traps: 0 }
  for (const r of reports) {
    if (r.stale) continue
    if (r.predicted !== undefined) out.surprise += 1
    if (r.documented !== undefined) out.docs += 1
    if (legibleOf(r) !== undefined) out.legible += 1
    if (trapOf(r)) out.traps += 1
  }
  return out
}

/** Why a lens cannot paint, said two ways: on the tab, and on paper. */
export interface Locked {
  /** What would open it, in a sentence, on the tab's own tooltip. */
  why: string
  /** Why it is empty, for a document — the report's contents page. **Paper has no buttons**,
   *  so this states the absence and never says what to press: `why` printed there told the
   *  reader of a PDF to press Read. */
  paper: string
  /** Is there a control that opens it? Colours the lock — see `Lock`. */
  keyed: boolean
}

/** What decides a lock: the project's readings, the repo's git history, this language's wiring. */
export interface LockFacts {
  replaying: boolean
  tree: Node | null
  /** Current readings — `ProjectSummary.assessed`. What decides whether this repo has been read
   *  at all, which is a different question from whether a given lens has anything to paint. */
  assessed: number
  /** How many current readings grade each reading-fed lens — see `gradedCounts`. */
  graded: Partial<Record<ColorMode, number>>
  /** `ProjectSummary.trace_depth`. */
  traceDepth: string | null | undefined
  /** `ScanStats.tangleBands`. */
  tangleBands: readonly (number | null)[]
  /** `ScanStats.churned`. */
  churned: boolean
}

/**
 * Which lenses cannot paint, and why.
 *
 * **A function of the facts, not of the window**, so a report made without one locks the same
 * lenses the window would. It lived inline in `App` and read the scan's stats without depending on
 * them, so a scan that changed only its stats left a lock standing.
 *
 * The order matters: a replay's limits are true whatever the repo holds, so they are asked first.
 */
export function locksFor(f: LockFacts): Partial<Record<ColorMode, Locked>> {
  const out: Partial<Record<ColorMode, Locked>> = {}
  for (const m of Object.keys(MODE_LABEL) as ColorMode[]) {
    if (f.replaying) {
      if (REPLAY[m] !== 'live') out[m] = { why: replayNote(m) ?? '', paper: replayNote(m) ?? '', keyed: false }
      continue
    }
    const tree = f.tree
    if (!tree) continue
    if (paintsFromReadings(m) && (f.graded[m] ?? 0) === 0) {
      // Two absences, and they are not the same claim: nothing has been read here, or things have
      // been read and none of them answers this question. The second is the spec's doing — a
      // rewritten question keeps old grades as history and stops them colouring anything — and
      // telling somebody their repo is unread when four hundred readings sit in `.sanity/` is the
      // kind of confident wrong sentence this whole surface is written against.
      const none = f.assessed === 0
      out[m] = {
        why: none
          ? 'No readings yet. Press Read on the project to fill Predictability, Legibility, Docs and Traps.'
          : `Nothing here grades ${MODE_LABEL[m]} yet. Read more of this repo, or re-read what answered an earlier version of the question.`,
        // **Lens-neutral on paper, named on the tab.** The contents sets one sentence under the
        // last of a run of lenses skipped for the same reason (see `whyOf`), and a sentence
        // carrying its own lens's name can never match its neighbour's — so four lines printed
        // where two would do. The tab has room to name the lens, and a tooltip is read alone.
        paper: none
          ? 'This repository has no current readings.'
          : 'No current reading grades this here: the readings this repository holds either do not answer that question or answered an earlier version of it.',
        keyed: true,
      }
    } else if (paintsFromWiring(m) && tree.resolvable === null) {
      out[m] = {
        why: `${MODE_LABEL[m]} needs this language's calls read off its grammar, which Sanity does not do for it. A guessed edge would be worse than a stated absence.`,
        paper: 'The calls of the languages here are not read off their grammars, and a guessed edge would be worse than a stated absence.',
        keyed: false,
      }
    } else if ((m === 'blame' || m === 'churn' || m === 'age') && f.traceDepth === 'untraced') {
      // **Asked BEFORE "no history", because an untraced repo also has no ages in it** and
      // the two absences are opposite claims: this one is work nobody has paid for, and the
      // one below is a fact about the folder. Reporting the second when the first is true
      // tells somebody their repo has no git in it while its log sits there unread.
      out[m] = {
        why: `${MODE_LABEL[m]} reads git, and this repo's history has not been read yet. Press Trace on the project.`,
        paper: "This repository's git history had not been read when the report was made.",
        keyed: true,
      }
    } else if ((m === 'blame' || m === 'churn' || m === 'age') && tree.score?.ageDays === null) {
      out[m] = {
        why: `${MODE_LABEL[m]} reads git, and this folder has no history.`,
        paper: 'This folder has no git history.',
        keyed: false,
      }
    } else if (m === 'tangle' && f.tangleBands.every((b) => b === null)) {
      // **A table, not a button — so this lock is not `keyed`.** Complexity is counted off
      // the grammar, and a language nobody has written branch kinds for cannot be counted by
      // pressing anything. The same shape as the wiring lenses' lock, which says the calls
      // were never parsed: an absence in the instrument rather than work somebody owes.
      out[m] = {
        why: 'Complexity counts branches off the grammar, and none of the languages here have been taught where they fork. Nothing to press — it needs a table in the parser.',
        paper: 'None of the languages here has been taught where its code branches.',
        keyed: false,
      }
    } else if (m === 'churn' && !f.churned) {
      // **Last of the git three, because it is the narrowest claim.** The two above are
      // about the repo's history existing and having been read at all; this one is about a
      // second walk that only Churn needs. Blame keeps one commit per LINE, so a body
      // rewritten in place erases its own history and no amount of blame can say how often
      // it changed — only the timeline can, by diffing functions at every commit. See
      // `edits.rs`.
      //
      // `keyed`, because the button that fixes it is the same Trace: the ladder now has a
      // fourth rung and pressing it again takes the next one.
      out[m] = {
        why: 'Churn counts how many times each function has actually changed, which only the timeline can say — blame keeps one commit per line, so a body rewritten in place erases its own history. Press Trace on the project to walk it.',
        paper: 'The commit timeline, the only record of how often a body changed, had not been walked when the report was made.',
        keyed: true,
      }
    }
  }
  return out
}
