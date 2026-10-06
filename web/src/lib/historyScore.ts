import { GRADE_DOCUMENTED, GRADE_SURPRISE, churnSaturation } from './api'
import type { AgentReport, ChurnWindows, Grade, Node, Score } from './api'
import { KIND_ORDER, tangleRamp } from './colorMode'
import {
  CHURN_MEMORY,
  NO_AT,
  NO_COG,
  NO_GRADE,
  NO_TS,
  daysBetween,
  type Frame,
} from './historyFrame'

/**
 * What a frame says about one node, in the shape the map already reads: a function's `Score`
 * and reading out of the frame's packed arrays, a container's rolled up from its children, and
 * the flash-only score a roll-up stand-in carries.
 *
 * Every one of these writes into a pooled object when there is one, and writes every field it
 * owns — including to null — because a pooled score otherwise keeps the last frame's answer.
 */

/**
 * Was this event inside the step the playhead just took?
 *
 * **A flash covers what happened SINCE THE LAST FRAME, and every earlier version of this was
 * a guess at that.** The window used to be a share of the timeline — 3%, then 1.2% — reasoned
 * from playback: past `MAX_FPS` the clock skips commits, so a fixed count meant something
 * different at every speed and on every repo. What a share does not survive is somebody
 * STEPPING: on a 5,000-commit repo 1.2% is sixty commits, so scrubbing one at a time lit
 * everything sixty deep and the map read as though one commit had touched a third of the repo.
 *
 * The step is the honest window and it needs no calibration: during playback it is however
 * many commits this frame advanced, and while stepping it is one commit — the one you are
 * looking at.
 */
export function inStep(at: number, since: number, index: number): boolean {
  return at > since && at <= index
}

/** One grade out of a packed reading — see `assessment::packed`. `undefined` is absent. */
const GRADES: (Grade | undefined)[] = [undefined, 'none', 'some', 'most', 'full']
function gradeAt(packed: number, shift: number): Grade | undefined {
  return GRADES[(packed >> shift) & 7]
}

/** A body's kind out of `HistoryFunc.kind` — see `history::place`. The kind order is
 *  `KIND_ORDER`, which `Cols::kind` already uses; the evidence rides in the low two bits. */
const HOW = ['contract', 'reader', 'convention', 'parsed'] as const
const UNPLACED = 255
export function placeOf(packed: number | undefined): Node['codeKind'] {
  if (packed === undefined || packed === UNPLACED) return null
  const kind = KIND_ORDER[packed >> 2]
  return kind ? { kind, how: HOW[packed & 3] } : null
}

/** Where a body's lines land in its file's per-kind totals: its kind, or the slot past the
 *  last one for a body nothing placed. */
export const KIND_SLOTS = KIND_ORDER.length + 1
export function kindSlot(packed: number | undefined): number {
  const k = packed === undefined || packed === UNPLACED ? -1 : packed >> 2
  return k >= 0 && k < KIND_ORDER.length ? k : KIND_ORDER.length
}

/** The reading this frame holds for a function, in the shape the map already reads.
 *
 *  **A synthesised report, not a stored one.** What crosses the wire is four answers packed
 *  into two bytes; what `colorFor` asks for is `legibleOf(node.agent)` and `trapOf`, which
 *  want an object. Building that object here rather than widening the wire keeps the timeline
 *  small — a real `AgentReport` carries the prose, the provenance and the model, which is a
 *  megabyte a shard and every version of it.
 *
 *  The dated flags are false because the packing already applied them: `packed` drops a
 *  superseded axis at the Rust end, so an absent grade here means "not asked, or asked under
 *  a question that has since moved", and both draw the same way — unread.
 *
 *  Mutated in place like everything else in a frame. See the pooling note above.
 */
export function readingInto(into: AgentReport | null, packed: number): AgentReport {
  const r = into ?? ({ legibleDated: false, trapDated: false } as AgentReport)
  r.predicted = gradeAt(packed, 0)
  r.documented = gradeAt(packed, 3)
  r.legible = gradeAt(packed, 6)
  r.trap = ((packed >> 9) & 1) === 1
  // Three states — see `assessment::packed`. A story banked before these bits existed reads
  // 0 for every reading, which is "never asked", and `undefined` is how this report says
  // that everywhere else. It marks nothing rather than asserting that nothing is derivable.
  const derivable = (packed >> 10) & 3
  r.derivable = derivable === 0 ? undefined : derivable === 2
  return r
}

/** A function's score as of one frame, written into `into` when there is one to reuse.
 *
 *  Every field it cannot honestly fill is left at the value that means "no claim":
 *  surprise stays 0 with `analyzedShare` 0, which is exactly what `isAnalyzed` refuses to
 *  color. */
export function scoreInto(
  into: Score | null,
  frame: Frame,
  f: number,
  since: number,
  /** The frame's packed reading, or `NO_GRADE` — never `undefined`. A dense store has no
   *  hole to hand out. */
  packed: number,
  /** This repo's churn windows, in days — see `ChurnView`. The frame answers all four, for
   *  the reason the live map does: which one is being looked at is a live choice, and a
   *  replay that answered only the current one would have to refold on every press. */
  windows: ChurnWindows,
  /** This repo's size-band medians — see `Tables.tangleBands`. One set for the whole replay,
   *  which is what makes the last frame paint the live map's colours. */
  bands: (number | null)[] | undefined,
): Score {
  const touched = frame.touched[f]
  const at = frame.bornAt[f]
  const edit = frame.editedAt[f]
  const born = frame.born[f]
  // Counted at read time, not carried: the window moves with the playhead, so a touch
  // that counted last frame may have aged out of this one.
  const base = f * CHURN_MEMORY
  const len = frame.hitLen[f]
  const commits: ChurnWindows = [0, 0, 0, 0]
  for (let i = 0; i < len; i++) {
    const age = daysBetween(frame.ts, frame.hits[base + i])
    for (let w = 0; w < 4; w++) if (age <= windows[w]) commits[w]++
  }
  const s: Score = into ?? {
    surprise: 0,
    documented: 0,
    churn: [0, 0, 0, 0],
    ageDays: null,
    lastTouchedDays: null,
    commits: [0, 0, 0, 0],
    allCommits: null,
    // Filled in below from `frame.cog`, which the walk banks per function per commit. Null
    // here is the pool's starting value, not a claim — see the write below.
    tangle: null,
    cognitive: null,
    provenance: 'history',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
  }
  // Each window against its own anchor, so the colour is a rate — the same arithmetic
  // `edits::saturation_for` does on the live side, out of the same `churnSaturation`.
  s.churn = commits.map((n, w) =>
    Math.min(1, n / churnSaturation(windows[w])),
  ) as ChurnWindows
  s.ageDays = born === NO_TS ? null : daysBetween(frame.ts, born)
  s.lastTouchedDays = touched === NO_TS ? null : daysBetween(frame.ts, touched)
  s.commits = commits
  // **What the repo knew about this function at this commit.** Absent is the common case
  // early in a story and it is a finding rather than a hole — `analyzedShare` of 0 is what
  // `isAnalyzed` refuses to colour, so an unread function draws as unread and the map fills
  // in as the readings land.
  const predicted = packed === NO_GRADE ? undefined : gradeAt(packed, 0)
  const documented = packed === NO_GRADE ? undefined : gradeAt(packed, 3)
  s.surprise = predicted ? GRADE_SURPRISE[predicted] : 0
  s.documented = documented ? GRADE_DOCUMENTED[documented] : 0
  s.analyzedShare = predicted ? 1 : 0
  s.hotShare = predicted ? GRADE_SURPRISE[predicted] : 0
  // `isAnalyzed` asks a FUNCTION for its source rather than for a share, so a frame that
  // holds a reading has to say where it came from — left at `proxy` the wedge would carry a
  // grade and refuse to draw it.
  s.source = predicted ? 'agent' : 'proxy'
  // **What this body's complexity was AT this commit**, read against one set of medians for
  // the whole story. `NO_COG` is a language nobody has taught the parser, which is the same
  // absence the live map draws in the structural neutral — and it has to be written to null
  // every time, because a pooled Score otherwise keeps the last function's count.
  const cog = frame.cog[f]
  if (cog === NO_COG) {
    s.cognitive = null
    s.tangle = null
  } else {
    s.cognitive = cog
    s.tangle = tangleRamp(bands, frame.nc[f], cog)
  }
  // Written every time, including to null: these Score objects are POOLED and reused frame
  // to frame, so a field left alone keeps the last function's answer.
  s.appeared = at !== NO_AT && inStep(at, since, frame.at) ? 1 : null
  s.edited = edit !== NO_AT && inStep(edit, since, frame.at) ? 1 : null
  return s
}

/** A score carrying an event and nothing else.
 *
 *  Every other field a `Score` has is a measurement, and a stand-in is a count of things the
 *  picture has no room for — it has no age, no churn and no reading of its own, so they stay
 *  at the values that mean "no claim". A score with nothing in it but the event is why
 *  `aggregate` has to skip these nodes: rolled into their parent they would dilute its real
 *  numbers with zeroes. */
export function flashOnly(birth: boolean, edit: boolean): Score | null {
  if (!birth && !edit) return null
  return {
    surprise: 0,
    documented: 0,
    churn: [0, 0, 0, 0],
    ageDays: null,
    lastTouchedDays: null,
    commits: [0, 0, 0, 0],
    allCommits: null,
    tangle: null,
    cognitive: null,
    provenance: 'history',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
    appeared: birth ? 1 : null,
    edited: edit ? 1 : null,
  }
}

/** Roll child lines and dates up a container, the same way `Node::aggregate` does in
 *  Rust: LOC-weighted, oldest child for age, newest for last-touched. Written here rather
 *  than reused because the Rust one runs inside the scan and this tree never goes near
 *  it. */
export function aggregate(node: Node, appearedOf: (id: string) => number | null): void {
  if (node.children.length === 0) return
  for (const c of node.children) aggregate(c, appearedOf)
  node.loc = node.children.reduce((s, c) => s + c.loc, 0)

  // Is there an event anywhere under here — see `Node.birthBelow`. Rolled up in the same
  // walk because it is the same walk: a second pass over a repo the size of ceph, thirty
  // times a second, to answer two booleans is the kind of timer this module already has a
  // rule about. Descendant-or-self on the children, so a file that was BORN is carried by
  // the directory above it even though a container's own flash never rolls up as colour.
  let birthBelow = false
  let touchBelow = false
  for (const c of node.children) {
    birthBelow = birthBelow || c.birthBelow === true || c.score?.appeared != null
    touchBelow = touchBelow || c.touchBelow === true || c.score?.edited != null
  }
  node.birthBelow = birthBelow
  node.touchBelow = touchBelow

  let w = 0
  const churn: ChurnWindows = [0, 0, 0, 0]
  let age: number | null = null
  let touched: number | null = null
  const commits: ChurnWindows = [0, 0, 0, 0]
  // **Two reading roll-ups, because two lenses ask a container for a number rather than
  // walking it.** Legibility and Docs answer a directory by walking its children for their
  // grades, which a frame's nodes now carry; Surprise asks the container itself, via
  // `hotShare`, and `isAnalyzed` gates on `analyzedShare`. Both are LOC-weighted, the same
  // way the live scan rolls them up in Rust — a directory half of whose lines nobody has
  // read is half analysed, not unanalysed.
  let hot = 0
  let readLines = 0
  // **Complexity rolls up two different ways and neither is the churn one.** The count is
  // SUMMED — a container's cognitive score is how many decisions are inside it, and a mean
  // would report a directory of two hundred simple functions as simple in a way that hides
  // how much there is to read. The ramp position is a LOC-weighted mean over the measured
  // children only: `tw` is not `w`, because a file holding one Rust function and one in a
  // language with no branch table is half measured, and averaging the untaught half in as
  // zero would report it as half as tangled as it is.
  //
  // Both copied from `Node::aggregate` in `model.rs`, which is the live map's answer. The
  // rule is that the end of a replay is the live map, so the two have to agree.
  let tangle: [number, number] = [0, 0]
  let tw = 0
  let cognitive: number | null = null
  for (const c of node.children) {
    const s = c.score
    if (!s) continue
    // The fold's stand-in carries a flash and nothing else — see where it is built. Its
    // zeroes are not measurements and must not be averaged in; its LINES already reach
    // this file through `node.loc` above, which is what keeps a file the size it is
    // whatever its inside looks like.
    if (c.rest !== undefined) continue
    hot += (s.hotShare ?? 0) * c.loc
    readLines += (s.analyzedShare ?? 0) * c.loc
    const cw = Math.max(c.loc, 1)
    w += cw
    for (let i = 0; i < 4; i++) {
      churn[i] += s.churn[i] * cw
      // The MAX rather than a sum, per window, exactly as it was for the one: a commit that
      // touched twelve files in this directory is one commit for it, and summing the children
      // would report twelve. The largest child's count is the honest floor a frame can offer
      // without the distinct set, which only the walk still holds.
      commits[i] = Math.max(commits[i], s.commits[i])
    }
    if (s.tangle) {
      tw += cw
      tangle[0] += s.tangle[0] * cw
      tangle[1] += s.tangle[1] * cw
    }
    if (s.cognitive !== null && s.cognitive !== undefined) {
      cognitive = (cognitive ?? 0) + s.cognitive
    }
    if (s.ageDays !== null) age = age === null ? s.ageDays : Math.max(age, s.ageDays)
    if (s.lastTouchedDays !== null)
      touched = touched === null ? s.lastTouchedDays : Math.min(touched, s.lastTouchedDays)
  }
  // **Cleared, not left.** A pooled container arrives holding last frame's score, and a
  // container whose children carry none this frame would otherwise keep it — a number six
  // hundred commits stale, reading as current. `reuse` nulls it and this is the other half:
  // the path that declines to write one has to say so.
  if (w === 0) {
    node.score = null
    return
  }
  // **Written field by field into whatever is already there.** A `Score` is thirteen fields
  // and there is one per container per frame; on a repo of sixty thousand files that is the
  // same allocation storm the nodes themselves were, one layer down. Building a fresh object
  // and copying it over the old one is worse than either — it allocates AND copies, which is
  // what the first version of this did.
  const s = node.score ?? {
    surprise: 0,
    documented: 0,
    churn: [0, 0, 0, 0] as ChurnWindows,
    allCommits: null,
    ageDays: null,
    lastTouchedDays: null,
    commits: [0, 0, 0, 0] as ChurnWindows,
    tangle: null,
    cognitive: null,
    provenance: 'history',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
    appeared: null,
    edited: null,
  }
  s.churn = churn.map((c) => c / w) as ChurnWindows
  // A replay has none. The timeline holds which commits touched what, so this is
  // derivable — but it would be a count as of the FRAME, and every other number here is
  // already that. Left absent rather than filled with today's answer about a past commit.
  s.allCommits = null
  s.ageDays = age
  s.lastTouchedDays = touched
  s.commits = commits
  s.hotShare = node.loc > 0 ? hot / node.loc : 0
  s.analyzedShare = node.loc > 0 ? readLines / node.loc : 0
  // Null rather than zero where nothing under here could be counted, or a directory of
  // Elixir would draw as the least complex thing in the repo.
  s.tangle = tw > 0 ? [tangle[0] / tw, tangle[1] / tw] : null
  s.cognitive = cognitive
  // **Never rolled up.** A container flashes on its OWN arrival and on nothing else, so
  // this is filled from the frame's own record of when this path first existed — see
  // `enter`. Rolled up from the children it meant that adding one function lit its file,
  // its directory and every directory out to the rim, which reads as a large commit and
  // was a one-line one.
  s.appeared = appearedOf(node.id)
  // **Containers never show the quiet flash at all**, on the same argument one step
  // further. An arrival is a fact a file has of its own — it did not exist and now it
  // does. Being EDITED is not: the only way to give a directory one is to inherit it from
  // whatever changed inside, which is the roll-up, and at the dim end it would light half
  // the map on every commit for no information. A touch is drawn where it happened.
  s.edited = null
  node.score = s
}
