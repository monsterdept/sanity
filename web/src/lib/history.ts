import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Node, Progress, Score } from './api'
import type { Deltas, Tables } from './timeline'

/**
 * The repo replayed, commit by commit.
 *
 * Mirrors `history.rs`, and carries the one rule that module exists to enforce:
 * **surprise is not replayed.** A temperature is a reading taken against the code as it
 * is today, and stamping it onto the same function's 2019 body would be the map claiming
 * a measurement nobody took. That is why history mode pins the encoding and disables the
 * lens switcher rather than offering five readings of which one would be a lie.
 *
 * **A replay is grey, and the only colour in it is a birth.** Three encodings were tried
 * here and each one failed the same way. Recency in DAYS flickers, because commit streams
 * are bursty: a quiet fortnight between two commits ages every function in the repo at
 * once, so the whole picture changes colour on a frame where one file was edited. Rescaling
 * the ramp per frame made it worse, the scale itself moving under the picture. Recency in
 * COMMITS holds still and was still noise — a fading ramp over most of the map says
 * "somewhat recently" about everything, which is not a thing anybody watching a replay is
 * asking. What they are watching for is arrival: the commit where a file, a directory or a
 * function exists that did not exist before. So that is the one event the replay paints,
 * as a flash lasting exactly as long as the step the playhead just took — see `inStep`.
 * Everything else is uncoloured, because the honest answer to "how surprising is this 2019
 * body" is that nobody has read it.
 */
export interface HistoryFunc {
  /** Index into `HistoryScan.paths`. */
  path: number
  name: string
  owner: string | null
  /** Which of its file's same-named twins this is, by position. Carried so a stored
   *  timeline can be RESUMED in Rust rather than recomputed — see `history::warm`. Not
   *  used here; present so the two shapes stay one shape. */
  ord: number
}

/** One commit, as the difference it made to the picture. Deltas, not snapshots — see
 *  `history.rs` for why the obvious encoding is quadratic in disguise. */
export interface HistoryCommit {
  sha: string
  short: string
  /** Seconds since the epoch. The frame's "now". */
  ts: number
  author: string
  subject: string
  /** `[func index, lines]` for everything this commit introduced or rewrote. */
  set: [number, number][]
  del: number[]
  /** Files touched, including ones whose functions all kept their size — the glow is the
   *  story, and a rewrite that changes no line count is still a rewrite. */
  files: number[]
}

/** What a trace produced, as a count of frames. The story itself stays in Rust — see
 *  `lib/timeline.ts`. */
export type TraceResult = number

/**
 * The timeline for `path`.
 *
 * **Two doors, and the difference is an hour.** `trace: false` — the default — hands back
 * whatever has already been walked and banked, which is a file read. `trace: true` walks
 * the commits nobody has walked yet, which is the expensive thing and belongs to the button
 * that says `Trace`, never to the one that opens the view.
 */
export function scanHistory(
  path: string,
  trace = false,
  fresh = false,
  limit?: number,
): Promise<TraceResult> {
  return invoke<TraceResult>('scan_history', { path, limit, trace, fresh })
}

/**
 * Keep an existing timeline current, and never build one.
 *
 * Called when a project comes on screen. A first replay is a minute of parsing on a large
 * repo, so nothing is built unasked; but once a repo HAS a timeline, topping it up costs
 * only the commits since — which is what makes History open instantly on the repo you are
 * actually working in, the one that gains a commit every few minutes.
 *
 * Fire-and-forget. The answer changes nothing on screen.
 */
export function warmHistory(path: string): Promise<boolean> {
  return invoke<boolean>('warm_history', { path })
}

export function onHistoryProgress(cb: (p: Progress) => void): () => void {
  const un = listen<Progress>('history-progress', (e) => cb(e.payload))
  return () => {
    void un.then((f) => f())
  }
}

/** Insert `f` into an ascending array, if it is not already there. */
function insertSorted(order: number[], f: number): void {
  let lo = 0
  let hi = order.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (order[mid] < f) lo = mid + 1
    else hi = mid
  }
  if (order[lo] !== f) order.splice(lo, 0, f)
}

/** Take `f` out of an ascending array. */
function removeSorted(order: number[], f: number): void {
  let lo = 0
  let hi = order.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (order[mid] < f) lo = mid + 1
    else hi = mid
  }
  if (order[lo] === f) order.splice(lo, 1)
}

/** Days between two epoch-second stamps, never negative. */
function daysBetween(now: number, then: number): number {
  return Math.max(0, (now - then) / 86_400)
}

/** Commits inside this window count toward a frame's churn — the same 90 days
 *  `churn.rs` uses, so the number means the same thing in both views. */
const CHURN_WINDOW_DAYS = 90
/** Commits in the window at which a file counts as fully churning. Absolute, matching
 *  `churn::CHURN_SATURATION`; normalizing against the repo's own busiest file is the trap
 *  that module is written up against. */
const CHURN_SATURATION = 8
/** Touches remembered per function. Past `CHURN_SATURATION` the churn scale is pinned, so
 *  a deeper memory costs bytes and answers nothing. */
const CHURN_MEMORY = 16

/** What the repo looked like after one commit. */
interface Frame {
  /** func index → lines. */
  loc: Map<number, number>
  /** Lines live in this frame. Kept as commits land, because the alternative is a pass over
   *  every function to decide the threshold that exists to avoid a pass over every
   *  function. */
  lines: number
  /** The keys of `loc`, ascending — which is the order functions first appeared, and
   *  therefore the order a file's wedges keep for the whole replay.
   *
   *  **Kept sorted as it changes, rather than sorted per frame.** The tree builder used to
   *  copy the whole live map into an array and sort it every frame: on ceph that is ninety
   *  four thousand entries allocated and sorted thirty times a second, to answer a question
   *  whose answer changed by a handful of entries since the last frame. A commit adds and
   *  removes a few functions; splicing them into place costs a memmove and nothing else. */
  order: number[]
  /** func index → when it was last touched. */
  touched: Map<number, number>
  /** func index → the INDEX of the commit it first appeared in, for the flash.
   *
   *  Beside `born` rather than derived from it, because they answer different questions:
   *  one is a date, which is what the panel says out loud, and one is a position in the
   *  story, which is the only thing the replay draws. A date cannot be converted into a
   *  position — that is the whole reason this map exists, see `inStep`. */
  bornAt: Map<number, number>
  /** func index → when it first appeared *within the replayed window*. */
  born: Map<number, number>
  /** func index → the INDEX of the commit that last touched it, for the quieter of the two
   *  flashes. Every arrival is also a touch; which one a wedge shows is decided where they
   *  are drawn, and the brighter wins — see `colorFor`. */
  editedAt: Map<number, number>
  /** path index → how many of its functions are live, and which commit the file arrived
   *  in. A file is on screen exactly while the count is above zero — see `enter`. */
  pathLive: Map<number, number>
  pathBornAt: Map<number, number>
  /** The same pair for directories, keyed by directory path. */
  dirLive: Map<string, number>
  dirBornAt: Map<string, number>
  /** func index → when recent commits touched it, oldest first, capped.
   *
   *  Stamps rather than a running count, because a count cannot be advanced: churn is
   *  commits inside a 90-day window, and as the playhead moves forward old touches fall
   *  OUT of that window. A counter would have to be recomputed from the start every frame,
   *  which is exactly the cost `advance` exists to avoid. Capped at `CHURN_MEMORY` — the
   *  scale saturates at eight, so a longer tail changes no number anybody sees. */
  hits: Map<number, number[]>
  /** path index → who committed to it last. */
  author: Map<number, string>
  /** The frame's own "now". */
  ts: number
  /** Which commit this frame stands at; -1 is the opening state. */
  at: number
}

/** The opening state: everything the truncated commits built, before any frame lands. */
function opening(hist: Tables): Frame {
  const frame: Frame = {
    loc: new Map(),
    lines: 0,
    order: [],
    touched: new Map(),
    bornAt: new Map(),
    born: new Map(),
    editedAt: new Map(),
    pathLive: new Map(),
    pathBornAt: new Map(),
    dirLive: new Map(),
    dirBornAt: new Map(),
    hits: new Map(),
    author: new Map(),
    ts: hist.baseTs,
    at: -1,
  }
  for (const [f, loc] of hist.base) {
    frame.loc.set(f, loc)
    frame.lines += loc
    frame.order.push(f)
    // COUNTED, though — its file and directories are on screen from frame one, and a
    // container that is not counted here is a container that would report itself as newly
    // arrived the first time somebody adds a function to it. Counting without a birth is
    // exactly the state that says "present, with no arrival to show".
    census(frame, hist.funcs[f].path, hist)
    // Deliberately NOT marked as touched or born. Everything here predates the window, so
    // the only honest thing to say about when it was last written is that we do not know —
    // and an undated function draws uncolored rather than being dated to the start of the
    // window, which would make the opening frame flare as though somebody had just written
    // the entire repo.
  }
  return frame
}

/** Every directory a path sits in, innermost first. The repo root is not one of them: it
 *  is on screen from the first frame to the last, so it has no arrival to show. */
function dirsOf(path: string): string[] {
  const out: string[] = []
  for (let cut = path.lastIndexOf('/'); cut > 0; cut = path.lastIndexOf('/', cut - 1)) {
    out.push(path.slice(0, cut))
  }
  return out
}

/**
 * A function has arrived in `p`. Count it, and record a birth for anything that did not
 * exist a moment ago.
 *
 * **A container's birth is its own, never its contents'.** A file exists in a frame exactly
 * when something in it does, so its arrival is the 0→1 transition of that count — which is
 * a different event from a function arriving inside a file that was already there, and the
 * two used to be the same event because `appeared` rolled up. Rolled up, adding one
 * function lit its file, its directory and every directory above it, so a one-line commit
 * flashed a stripe from the middle of the map to the rim and the picture said "a lot
 * happened here" about a commit that touched one function.
 */
function enter(frame: Frame, p: number, hist: Tables, at: number): void {
  // Nothing above the function has arrived unless the FILE has: a function added to a file
  // that was already on screen changes no container's presence, and the dir counts were not
  // touched. Reading them anyway would re-birth a directory whose one file just gained a
  // second function.
  if (!census(frame, p, hist)) return
  frame.pathBornAt.set(p, at)
  // A count of exactly one, after counting this file in, means this file is the first thing
  // in that directory — so the directory arrived with it.
  for (const d of dirsOf(hist.paths[p])) {
    if (frame.dirLive.get(d) === 1) frame.dirBornAt.set(d, at)
  }
}

/** Count one function into its file and that file's directories. Returns whether the FILE
 *  was empty before, which is the only thing that makes it an arrival.
 *
 *  Split out because the opening state has to count without recording a birth: see
 *  `opening`. */
function census(frame: Frame, p: number, hist: Tables): boolean {
  const live = (frame.pathLive.get(p) ?? 0) + 1
  frame.pathLive.set(p, live)
  if (live > 1) return false
  for (const d of dirsOf(hist.paths[p])) {
    frame.dirLive.set(d, (frame.dirLive.get(d) ?? 0) + 1)
  }
  return true
}

/** A function has left `p`. The mirror of `enter`: a file that loses its last function has
 *  left the picture, and if it comes back it is an arrival again — which is the honest
 *  reading, because that is what the map shows. */
function leave(frame: Frame, p: number, hist: Tables): void {
  const live = (frame.pathLive.get(p) ?? 1) - 1
  if (live > 0) {
    frame.pathLive.set(p, live)
    return
  }
  frame.pathLive.delete(p)
  frame.pathBornAt.delete(p)
  for (const d of dirsOf(hist.paths[p])) {
    const n = (frame.dirLive.get(d) ?? 1) - 1
    if (n > 0) {
      frame.dirLive.set(d, n)
      continue
    }
    frame.dirLive.delete(d)
    frame.dirBornAt.delete(d)
  }
}

/** Apply commits `(frame.at, to]` in place. */
function advance(frame: Frame, hist: Tables, deltas: Deltas, to: number): void {
  for (let i = frame.at + 1; i <= to && i < hist.commits; i++) {
    const c = deltas.at(i)
    // Past what has been fetched. The caller waits on `Deltas.ensure` before folding, so
    // this is the end of the story rather than a gap — see `lib/timeline.ts`.
    if (!c) break
    for (const [f, loc] of c.set) {
      // Absent BEFORE this commit, which is not the same question as "has no birth on
      // record". `c.set` carries rewrites as well as arrivals, and everything in the
      // opening state arrives with no birth by design — keyed on `born` this lit up every
      // base function the first time somebody edited it, which is an arrival the replay
      // never saw and, under a flash, the loudest thing on screen.
      const arrived = !frame.loc.has(f)
      frame.lines += loc - (frame.loc.get(f) ?? 0)
      frame.loc.set(f, loc)
      frame.touched.set(f, c.ts)
      frame.editedAt.set(f, i)
      if (arrived) {
        insertSorted(frame.order, f)
        frame.born.set(f, c.ts)
        frame.bornAt.set(f, i)
        enter(frame, hist.funcs[f].path, hist, i)
      }
      const seen = frame.hits.get(f)
      if (seen) {
        seen.push(c.ts)
        if (seen.length > CHURN_MEMORY) seen.shift()
      } else {
        frame.hits.set(f, [c.ts])
      }
    }
    for (const f of c.del) {
      if (frame.loc.has(f)) {
        leave(frame, hist.funcs[f].path, hist)
        removeSorted(frame.order, f)
        frame.lines -= frame.loc.get(f) ?? 0
      }
      frame.loc.delete(f)
      frame.touched.delete(f)
      frame.born.delete(f)
      frame.bornAt.delete(f)
      frame.editedAt.delete(f)
      frame.hits.delete(f)
    }
    for (const p of c.files) frame.author.set(p, c.author)
  }
  frame.at = Math.min(to, hist.commits - 1)
  frame.ts = deltas.at(Math.max(0, frame.at))?.ts ?? hist.baseTs
}

/** The last frame computed, kept so playing forward does not re-fold the whole timeline.
 *
 *  Playback only ever moves forward, and a from-scratch fold is linear in how far along
 *  you are — measured on tonepoet it was 1.3ms at commit 98 and **26ms at commit 983**, so
 *  the replay got slower exactly as the story got interesting, and the top speed was
 *  decided by the tail. Stepping forward applies only the commits between, which is flat.
 *
 *  Module-level rather than a hook, because it is a pure accelerator: it changes no answer
 *  — `frameTree(hist, i)` returns the same tree whether or not the memo is warm — so it
 *  has no business in the render tree. Scrubbing BACKWARDS rebuilds from the opening
 *  state; undoing a commit would need the state it replaced, which is the whole timeline
 *  stored a second time and free to drift.
 */
let memo: { hist: Tables; frame: Frame } | null = null

function replay(hist: Tables, deltas: Deltas, index: number): Frame {
  if (memo && memo.hist === hist && memo.frame.at <= index) {
    advance(memo.frame, hist, deltas, index)
    return memo.frame
  }
  const frame = opening(hist)
  advance(frame, hist, deltas, index)
  memo = { hist, frame }
  return frame
}

/** Every path's size at HEAD, by node id, for ordering the rings.
 *
 *  **Read off the live scan rather than folded out of the timeline.** The replay's sort order
 *  is today's — a directory that grows past its neighbour must not swap places with it
 *  mid-playback — and "today" is exactly what the map already on screen is. Folding the whole
 *  story to learn it was affordable at a few thousand commits and is not at a hundred
 *  thousand: it meant having every delta in hand before the first frame could be drawn.
 *
 *  A path the timeline holds and HEAD does not sorts as 0, which is the honest answer: it is
 *  not there at the end, so it has no size at the end to be ordered by. */
export function headSizes(root: Node): ReadonlyMap<string, number> {
  const at = new Map<string, number>()
  const walk = (n: Node) => {
    if (n.kind !== 'func') at.set(n.id, n.loc)
    for (const c of n.children) walk(c)
  }
  walk(root)
  return at
}

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
function inStep(at: number, since: number, index: number): boolean {
  return at > since && at <= index
}

/** A function's score as of one frame, written into `into` when there is one to reuse.
 *
 *  Every field it cannot honestly fill is left at the value that means "no claim":
 *  surprise stays 0 with `analyzedShare` 0, which is exactly what `isAnalyzed` refuses to
 *  color. */
function scoreInto(into: Score | null, frame: Frame, f: number, since: number): Score {
  const touched = frame.touched.get(f)
  const at = frame.bornAt.get(f)
  const edit = frame.editedAt.get(f)
  const born = frame.born.get(f)
  // Counted at read time, not carried: the window moves with the playhead, so a touch
  // that counted last frame may have aged out of this one.
  const seen = frame.hits.get(f)
  const commits = seen ? seen.filter((t) => daysBetween(frame.ts, t) <= CHURN_WINDOW_DAYS).length : 0
  const s: Score = into ?? {
    surprise: 0,
    documented: 0,
    churn: 0,
    ageDays: null,
    lastTouchedDays: null,
    commits: 0,
    provenance: 'history',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
  }
  s.churn = Math.min(1, commits / CHURN_SATURATION)
  s.ageDays = born === undefined ? null : daysBetween(frame.ts, born)
  s.lastTouchedDays = touched === undefined ? null : daysBetween(frame.ts, touched)
  s.commits = commits
  // Written every time, including to null: these Score objects are POOLED and reused frame
  // to frame, so a field left alone keeps the last function's answer.
  s.appeared = at !== undefined && inStep(at, since, frame.at) ? 1 : null
  s.edited = edit !== undefined && inStep(edit, since, frame.at) ? 1 : null
  return s
}

/** Roll child lines and dates up a container, the same way `Node::aggregate` does in
 *  Rust: LOC-weighted, oldest child for age, newest for last-touched. Written here rather
 *  than reused because the Rust one runs inside the scan and this tree never goes near
 *  it. */
function aggregate(node: Node, appearedOf: (id: string) => number | null): void {
  if (node.children.length === 0) return
  for (const c of node.children) aggregate(c, appearedOf)
  node.loc = node.children.reduce((s, c) => s + c.loc, 0)

  let w = 0
  let churn = 0
  let age: number | null = null
  let touched: number | null = null
  let commits = 0
  for (const c of node.children) {
    const s = c.score
    if (!s) continue
    const cw = Math.max(c.loc, 1)
    w += cw
    churn += s.churn * cw
    commits = Math.max(commits, s.commits)
    if (s.ageDays !== null) age = age === null ? s.ageDays : Math.max(age, s.ageDays)
    if (s.lastTouchedDays !== null)
      touched = touched === null ? s.lastTouchedDays : Math.min(touched, s.lastTouchedDays)
  }
  if (w === 0) return
  node.score = {
    surprise: 0,
    documented: 0,
    churn: churn / w,
    ageDays: age,
    lastTouchedDays: touched,
    commits,
    provenance: 'history',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
    // **Never rolled up.** A container flashes on its OWN arrival and on nothing else, so
    // this is filled from the frame's own record of when this path first existed — see
    // `enter`. Rolled up from the children it meant that adding one function lit its file,
    // its directory and every directory out to the rim, which reads as a large commit and
    // was a one-line one.
    appeared: appearedOf(node.id),
    // **Containers never show the quiet flash at all**, on the same argument one step
    // further. An arrival is a fact a file has of its own — it did not exist and now it
    // does. Being EDITED is not: the only way to give a directory one is to inherit it from
    // whatever changed inside, which is the roll-up, and at the dim end it would light half
    // the map on every commit for no information. A touch is drawn where it happened.
    edited: null,
  }
}

/** Fold a directory that holds exactly one directory into its child, so `src/tauri/src`
 *  is one ring rather than three. The scan does this and the two pictures have to have
 *  the same shape, or scrubbing to HEAD would visibly restructure the repo. */
function collapse(node: Node): Node {
  node.children = node.children.map(collapse)
  if (node.kind === 'dir' && node.children.length === 1 && node.children[0].kind === 'dir') {
    const only = node.children[0]
    return { ...only, name: `${node.name}/${only.name}` }
  }
  return node
}

function dirNode(path: string, name: string): Node {
  return {
    id: path,
    name,
    kind: 'dir',
    path,
    loc: 0,
    line: null,
    endLine: null,
    lang: null,
    excluded: false,
    lastAuthor: null,
    // Never a doc. History replays the commit stream's structure — see the module note on
    // what a frame is allowed to claim — and a comment is a reading's input, not a fact
    // about a commit.
    doc: null,
    score: null,
    body: null,
    hotspots: [],
    children: [],
    funcs: 0,
  }
}

/** Function nodes, reused frame to frame.
 *
 *  A frame of tonepoet is seventeen thousand functions, each with a `Score`, and building
 *  them fresh thirty times a second is a million objects a second handed straight to the
 *  collector — which showed up exactly as it sounds: a smooth replay with a hitch in it on
 *  a period nobody chose. Function nodes are pooled and MUTATED instead.
 *
 *  Containers are not pooled, deliberately. The sunburst recomputes its layout when the
 *  node it is rooted at changes identity, so a stable root would freeze the map: every dir
 *  and file has to be a new object each frame for the picture to move at all. That is
 *  seven hundred allocations against seventeen thousand, which is the whole saving with
 *  none of the hazard.
 *
 *  Keyed by the timeline it belongs to, so switching projects cannot hand one repo's nodes
 *  to another's tree. */
let pool: { hist: Tables; nodes: Map<number, Node> } | null = null

/** Path string → its index, so a container can look up its own arrival by node id. Built
 *  once per timeline rather than per frame: it is a property of the scan, and a replay
 *  rebuilds this tree thirty times a second. */
let index: { hist: Tables; at: Map<string, number> } | null = null

function pathIndexOf(hist: Tables): Map<string, number> {
  if (index && index.hist === hist) return index.at
  const at = new Map<string, number>()
  hist.paths.forEach((p, i) => at.set(p, i))
  index = { hist, at }
  return at
}

/**
 * The tree for one frame, in exactly the shape the sunburst already draws.
 *
 * Built rather than patched onto the live scan: the two trees hold different functions —
 * that is the entire point of a timeline — and reusing the live one would mean deciding
 * what to do with every function that does not exist yet. A separate tree has no such
 * question to get wrong.
 */
export function frameTree(
  hist: Tables,
  deltas: Deltas,
  index: number,
  repoName: string,
  /** Where the playhead was on the frame BEFORE this one. Everything that happened in
   *  `(since, index]` flashes — see `inStep`. Defaults to one commit back, which is what a
   *  caller drawing a single frame means. */
  since: number = index - 1,
): Node {
  const frame = replay(hist, deltas, index)
  const root = dirNode('', repoName)
  const dirs = new Map<string, Node>([['', root]])

  const dirFor = (path: string): Node => {
    const found = dirs.get(path)
    if (found) return found
    const cut = path.lastIndexOf('/')
    const parent = dirFor(cut === -1 ? '' : path.slice(0, cut))
    const made = dirNode(path, cut === -1 ? path : path.slice(cut + 1))
    dirs.set(path, made)
    parent.children.push(made)
    return made
  }

  const files = new Map<number, Node>()
  const fileFor = (p: number): Node => {
    const found = files.get(p)
    if (found) return found
    const path = hist.paths[p]
    const cut = path.lastIndexOf('/')
    const parent = dirFor(cut === -1 ? '' : path.slice(0, cut))
    const made: Node = {
      ...dirNode(path, cut === -1 ? path : path.slice(cut + 1)),
      kind: 'file',
      lang: hist.langs[p] || null,
      lastAuthor: frame.author.get(p) ?? null,
    }
    files.set(p, made)
    parent.children.push(made)
    return made
  }

  if (!pool || pool.hist !== hist) pool = { hist, nodes: new Map() }
  const nodes = pool.nodes
  const pathIndex = pathIndexOf(hist)

  /** Lines a function needs before it gets a node of its own.
   *
   *  **The band cannot draw ninety-four thousand wedges and the frame should not build
   *  them.** Measured at ceph's size, folding one commit and building the tree cost 31.7ms
   *  a frame — the fold was 0.1 of that and the rest was this loop, an aggregate walk and a
   *  collapse walk over every live function, thirty times a second. What the layout then did
   *  with them is the tell: it drops any wedge too thin to see and rolls the remainder into
   *  a `126+` stand-in. So the cut moves here, where it saves the work instead of paying for
   *  it first.
   *
   *  A share of the frame's own lines rather than a fixed count, because the question is
   *  whether a wedge would be visible and the answer is relative to the whole circle.
   *  `frame.lines / 4000` is roughly a wedge of a twentieth of a degree.
   *
   *  A repo small enough for its functions to be drawn keeps every one of them: on anything
   *  under a few thousand functions the threshold lands below one line and nothing is
   *  rolled up. */
  const minLoc = frame.lines / 4000
  /** Lines and count rolled up per file, for the stand-in wedges below. */
  const restLoc = new Map<number, number>()
  const restCount = new Map<number, number>()

  // In interned order — see `Frame.order`, which is kept that way as commits land rather
  // than rebuilt here.
  for (const f of frame.order) {
    const loc = frame.loc.get(f) ?? 0
    const def = hist.funcs[f]
    // Ignored means ignored, in the replay as on the live map. The trace still holds them —
    // pruning at the walk would mean re-tracing a large repo whenever the file changed — so
    // they are dropped here, where the picture is built. See `Tables.excluded`.
    if (hist.excluded[def.path]) continue
    // Too thin to draw. Its lines still count — they reach the file wedge through the
    // stand-in below, so a file is the size it is whatever its inside looks like.
    if (loc < minLoc) {
      restLoc.set(def.path, (restLoc.get(def.path) ?? 0) + loc)
      restCount.set(def.path, (restCount.get(def.path) ?? 0) + 1)
      continue
    }
    const file = fileFor(def.path)
    let node = nodes.get(f)
    if (!node) {
      node = {
        id: `${hist.paths[def.path]}#${def.name}#${f}`,
        name: def.name,
        kind: 'func',
        path: hist.paths[def.path],
        doc: null,
        loc,
        line: null,
        endLine: null,
        lang: file.lang,
        excluded: false,
        lastAuthor: null,
        score: null,
        body: null,
        hotspots: [],
        children: [],
        funcs: 0,
      }
      nodes.set(f, node)
    }
    // Only what a frame can change. Identity, path and language are properties of the
    // function, not of the moment — a pooled node that rewrote them every frame would be
    // a fresh allocation wearing a cache's clothes.
    node.loc = loc
    node.lastAuthor = frame.author.get(def.path) ?? null
    node.score = scoreInto(node.score, frame, f, since)
    file.children.push(node)
  }

  // One stand-in per file for everything too thin to draw, in the shape the layout already
  // makes for the same reason — see `rest` in `sunburst.ts`. It carries no children: those
  // exist to be listed in the panel, and a frame's are a thousand objects a person cannot
  // read while the story is running.
  for (const [p, lines] of restLoc) {
    const path = hist.paths[p]
    const count = restCount.get(p) ?? 0
    fileFor(p).children.push({
      ...dirNode(`${path}#rest`, `${count}+`),
      kind: 'func',
      path,
      lang: hist.langs[p] || null,
      loc: lines,
      rest: count,
    })
  }

  // Containers are keyed by path, and a file's or directory's node id IS its path — which
  // is what lets a container ask the frame directly when it arrived instead of inheriting an
  // answer from the functions inside it.
  aggregate(root, (id) => {
    const at = frame.dirBornAt.get(id) ?? frame.pathBornAt.get(pathIndex.get(id) ?? -1)
    return at !== undefined && inStep(at, since, frame.at) ? 1 : null
  })
  return collapse(root)
}

export function posOf(frames: number[], index: number): number {
  let lo = 0
  let hi = frames.length - 1
  let out = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (frames[mid] <= index) {
      out = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return out
}

/** The real commit a scoped position addresses.
 *
 *  Position -1 is the commit BEFORE this scope's first — the moment just before the story
 *  being told starts, which for the repo as a whole is the empty opening state and for a
 *  directory is whatever the repo looked like the instant before anyone touched it. */
export function realOf(frames: number[], pos: number, fallback: number): number {
  if (frames.length === 0) return fallback
  return pos < 0 ? frames[0] - 1 : frames[Math.min(pos, frames.length - 1)]
}

