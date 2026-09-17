import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { GRADE_DOCUMENTED, GRADE_SURPRISE, churnSaturation } from './api'
import { KIND_ORDER, tangleRamp } from './colorMode'
import type {
  AgentReport,
  ChurnWindows,
  Folded,
  Grade,
  Node,
  Progress,
  Score,
  TimeRow,
  TangleRow,
} from './api'
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
  /** What this body is and how that was decided, packed `kind << 2 | how` — see `placeOf`.
   *  The kind its latest version was placed as, so the frame at HEAD reads what the live map
   *  does. */
  kind?: number
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
  /** `[func index, packed grades]` — the readings this commit wrote. See `Delta.read`. */
  read?: [number, number][]
  unread?: number[]
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
/** Read more of a repo's history onto the MAP, because the person asked.
 *
 *  Not the replay — that is `scanHistory` below, which is depth 3. This is the commit log
 *  (`files`: age, churn and authors per file) and per-line blame (`lines`: the same facts per
 *  function). Omitted means one step on from wherever this repo is. Resolves with what it
 *  actually took, in seconds, which is the only place the app learns whether its own estimate
 *  was close. */
export function traceProject(path: string, depth?: 'files' | 'lines'): Promise<number> {
  return invoke<number>('trace_project', { path, depth })
}

export function warmHistory(path: string): Promise<boolean> {
  return invoke<boolean>('warm_history', { path })
}

export function onHistoryProgress(cb: (p: Progress) => void): () => void {
  const un = listen<Progress>('history-progress', (e) => cb(e.payload))
  return () => {
    void un.then((f) => f())
  }
}

/** The two array edits `advance` used to make per function, kept only as the record of what
 *  replaced them.
 *
 *  Both are a binary search and then a splice, and the splice is O(live): on kibana that is
 *  an array of 148,000 indices, moved once per arrival. It was the right shape while a frame
 *  was one commit and is the wrong one at speed, where a frame carries the arrivals of
 *  several hundred — see the merge at the end of `advance`, which does the same work for a
 *  whole step in one linear pass. Measured: 2,000 arrivals, 18.8ms spliced against 0.5ms
 *  merged. Deleted rather than left unused; the argument is the thing worth keeping. */

/** Days between two epoch-second stamps, never negative. */
function daysBetween(now: number, then: number): number {
  return Math.max(0, (now - then) / 86_400)
}

/** Touches remembered per function. Past `CHURN_SATURATION` the churn scale is pinned, so
 *  a deeper memory costs bytes and answers nothing. */
const CHURN_MEMORY = 16

/** What a field holds when it holds nothing.
 *
 *  **`0` is a value, not an absence.** A `Map` said "no answer" by not holding the key; a
 *  dense array has to say it with a number, and every one of these fields has a natural
 *  zero that would be believed: a touch at the epoch, the reading `predicted: none`, the
 *  first commit in the story, the first author to appear. So each absence is a value the
 *  measurement cannot produce — the same rule `#[serde(default)]` is written up against in
 *  CLAUDE.md, one language over.
 *
 *  Timestamps are epoch SECONDS in a `Uint32Array`: exact, half the width of a double, and
 *  `0xffffffff` is a date no commit carries. Grades are packed into ten bits, so `0xffff`
 *  is unreachable. Commit indices and author ids are non-negative, so `-1` is free. */
const NO_TS = 0xffffffff
const NO_AT = -1
const NO_GRADE = 0xffff

/** No cognitive score for this function in this frame.
 *
 *  **Not zero, which is a real and common score** — most short bodies never branch, and a
 *  band whose median is zero is the ordinary case in the smallest band. What this means is
 *  that nobody has taught the parser to count this language, which the lens draws in the
 *  structural neutral rather than at the cold end of the ramp. A `Uint32Array` because a
 *  generated file can carry more forks than a `Uint16` holds, and the sentinel has to sit
 *  outside every score that is real. */
const NO_COG = 0xffffffff
const NO_AUTHOR = -1

/**
 * Authors, interned per timeline.
 *
 * A frame used to hold two `Map`s of strings — who last touched each file, who last touched
 * each function — and a string map is the one thing in a frame that cannot be copied with a
 * `memcpy`. Interning makes both of them `Int32Array`s into a table that is a property of
 * the timeline rather than of the frame, so every checkpoint shares one copy of the names.
 *
 * Ids are assigned in the order the fold meets them, which is deterministic for one
 * timeline folded from either end — the table is append-only and outlives any frame built
 * against it. Rebuilt when the timeline changes, at which point every frame and every
 * checkpoint built against it is discarded too; see `replay`.
 */
let interned: { hist: Tables; list: string[]; at: Map<string, number> } | null = null
function authorsOf(hist: Tables): { list: string[]; at: Map<string, number> } {
  if (interned && interned.hist === hist) return interned
  interned = { hist, list: [], at: new Map() }
  return interned
}
function authorId(hist: Tables, name: string): number {
  const table = authorsOf(hist)
  const had = table.at.get(name)
  if (had !== undefined) return had
  const id = table.list.length
  table.list.push(name)
  table.at.set(name, id)
  return id
}
function authorName(hist: Tables, id: number): string | null {
  return id < 0 ? null : (authorsOf(hist).list[id] ?? null)
}

/**
 * What the repo looked like after one commit.
 *
 * **Dense, and that is what makes a backward seek possible.** Every per-function field here
 * was a `Map` keyed by a function index that is already dense — `hist.funcCount` is known
 * the moment the tables land — and at kibana's 148,000 live functions those eight maps are
 * ~1.2M entries, 60–90MB of hash overhead before the values. That is not merely slow to
 * walk: it is too big to COPY, and a copy is what a checkpoint is. Typed arrays buy three
 * things in one move — the frame gets about tenfold smaller, a checkpoint becomes a
 * `memcpy` rather than a walk, and the fold loses the map hashing that was most of what was
 * left in it after the August 2026 pass.
 *
 * Absence is a sentinel; see `NO_TS` and its siblings for why each one is what it is.
 */
interface Frame {
  /** func index → lines, and whether it is live at all.
   *
   *  Two arrays rather than one, because a function's line count is allowed to be zero and
   *  "not in this frame" is the question every reader of this actually asks — `advance`
   *  decides whether a `set` is an ARRIVAL by it, and an arrival is the only thing the
   *  replay paints. */
  loc: Float64Array
  live: Uint8Array
  /** Lines live in this frame. Kept as commits land, because the alternative is a pass over
   *  every function to decide the threshold that exists to avoid a pass over every
   *  function. */
  lines: number
  /** The live function indices, ascending — which is the order functions first appeared, and
   *  therefore the order a file's wedges keep for the whole replay.
   *
   *  **Kept sorted as it changes, rather than sorted per frame.** The tree builder used to
   *  copy the whole live map into an array and sort it every frame: on ceph that is ninety
   *  four thousand entries allocated and sorted thirty times a second, to answer a question
   *  whose answer changed by a handful of entries since the last frame.
   *
   *  **Rebuilt once per STEP, not per commit.** The first version spliced each arrival into
   *  place, which is right when a frame is one commit — "a commit adds and removes a few
   *  functions" — and wrong at speed, where the transport's duration makes a frame carry
   *  hundreds of them. A splice is O(live), and live is 148,000 on kibana: measured, 2,000
   *  arrivals cost 18.8ms one at a time and 0.5ms merged in a single pass. `advance` collects
   *  the step's arrivals and departures and rebuilds this once, which is the same array by a
   *  cheaper route.
   *
   *  **The one field a checkpoint does not store**, because `live` already holds it: it is
   *  the ascending list of set bits, and rebuilding it is a scan of one byte per function
   *  where storing it is a second copy free to disagree with the first. */
  order: number[]
  /** func index → when it was last touched. */
  touched: Uint32Array
  /** func index → the INDEX of the commit it first appeared in, for the flash.
   *
   *  Beside `born` rather than derived from it, because they answer different questions:
   *  one is a date, which is what the panel says out loud, and one is a position in the
   *  story, which is the only thing the replay draws. A date cannot be converted into a
   *  position — that is the whole reason this array exists, see `inStep`. */
  bornAt: Int32Array
  /** func index → when it first appeared *within the replayed window*. */
  born: Uint32Array
  /** func index → the INDEX of the commit that last touched it, for the quieter of the two
   *  flashes. Every arrival is also a touch; which one a wedge shows is decided where they
   *  are drawn, and the brighter wins — see `colorFor`. */
  editedAt: Int32Array
  /** path index → how many of its functions are live, and which commit the file arrived
   *  in. A file is on screen exactly while the count is above zero — see `enter`. */
  pathLive: Uint32Array
  pathBornAt: Int32Array
  /** path index → when a commit last touched this FILE, and the same recent-touch ring the
   *  functions keep, one row per path.
   *
   *  **A file-level answer to a question the map asks per function, and the reason is the
   *  fold.** A frame rolls every file too thin to draw into one stand-in, and a stand-in with
   *  only a line count made the rim describe whatever survived and call it the directory —
   *  ceph's `src/pybind` drawn as 100% TypeScript over 0.3% of itself. Language and author
   *  are facts about a file, so the fold could already total them; an age and a churn band are
   *  facts about a FUNCTION, and the frame had nothing at file resolution to total.
   *
   *  Now it has. Kept in the same loop that already stamps `author[p]`, from the same list of
   *  paths the commit touched, so it costs one write per file per commit. It is a COARSER
   *  answer than a drawn function's — a file's date, not each function's — and that is
   *  exactly the trade the live map already makes when a ring has not arrived. */
  pathTs: Uint32Array
  /** path index → when this FILE first appeared within the replayed window, epoch seconds.
   *
   *  **The file-level twin of `born`, and it exists for the same reason `pathTs` does — the
   *  fold.** A stand-in has to be able to answer the lens it is standing in for, and Age
   *  answers two questions now (see `AgeView`): when was this last touched, and when did it
   *  first appear. `pathTs` covers the first. Without this the second had nothing at file
   *  resolution, and a roll-up with nothing to say has to say nothing — which on a frame that
   *  folds most of the repo means the rim describes the drawn minority and calls it the
   *  directory. That failure has a name in `CLAUDE.md` and it is `src/pybind`.
   *
   *  `NO_TS` for a file in the opening state, deliberately, exactly as `pathTs` is: everything
   *  in the truncated prefix predates the window, and the honest answer to when it arrived is
   *  that this story never saw it arrive. It draws undated rather than dated to frame one. */
  pathBorn: Uint32Array
  pathHits: Uint32Array
  pathHitLen: Uint8Array
  /** The same pair for directories, keyed by the directory INDEX `Shape` interns.
   *
   *  Strings before, which cost a hash per ancestor per arrival and a `Map` copy per
   *  checkpoint. The shape of a replay's paths never changes, so a directory is an index
   *  for the same reason a path already is. */
  dirLive: Uint32Array
  dirBornAt: Int32Array
  /** func index → when recent commits touched it, oldest first, `CHURN_MEMORY` wide, with
   *  the used length beside it.
   *
   *  Stamps rather than a running count, because a count cannot be advanced: churn is
   *  commits inside a 90-day window, and as the playhead moves forward old touches fall
   *  OUT of that window. A counter would have to be recomputed from the start every frame,
   *  which is exactly the cost `advance` exists to avoid. Capped at `CHURN_MEMORY` — the
   *  scale saturates at eight, so a longer tail changes no number anybody sees.
   *
   *  One flat array of `funcCount × CHURN_MEMORY` rather than an array per function: the
   *  ring is the widest thing a frame holds, and as a map of small arrays it was also the
   *  slowest to copy. `hitLen` is the used prefix, so a full ring shifts with `copyWithin`
   *  and keeps the oldest-first order the count reads. */
  hits: Uint32Array
  hitLen: Uint8Array
  /** path index → who committed to it last, interned. */
  author: Int32Array
  /** func index → who last committed a change to THAT function, interned.
   *
   *  **The file's author was standing in for this and is a different answer.** A commit that
   *  edits one function in a file of forty makes its author the last committer of all forty,
   *  which on a shared file is wrong about thirty-nine of them. The walk already knows which
   *  functions each commit changed — that is what `set` means — so the finer answer costs one
   *  array and no extra wire.
   *
   *  Still not what the live Blame lens means: that one is per LINE, folded up from
   *  `git blame`, so a function whose body is mostly mine and whose last tweak was yours reads
   *  as mine there and as yours here. Replaying per-line authorship would mean blaming every
   *  version of every file, which is the trade `blame.rs` refuses for churn. The tab says which
   *  question it is answering. */
  funcAuthor: Int32Array
  /** func index → the reading this repo held for it AT this commit, packed.
   *
   *  **`.sanity/` is committed, so the readings are in the history like any other file.**
   *  What a frame paints under Surprise, Legibility, Docs or Traps is therefore what the repo
   *  KNEW about itself then — not today's grade stamped onto an older commit, which is the
   *  thing that is still forbidden. A function holding `NO_GRADE` has not been read yet as
   *  of this frame, which is a fact worth drawing rather than a hole: watching it fill in is
   *  the point of folding these at all. See `assessment::packed` for the layout. */
  graded: Uint16Array
  /** func index → the cognitive complexity of the body AT this commit, or `NO_COG`.
   *
   *  **Off the same parse the walk already ran**, which is what makes the Complexity lens
   *  replayable at all: the timeline finds a commit's functions by parsing the versions of
   *  the files it touched, and `parse_functions` computes this on the way past. The frame
   *  carries the count rather than the ramp position, and `Tables.tangleBands` carries the
   *  medians it is read against — one yardstick for the whole story, so a wedge changes
   *  colour when its body changes and at no other time.
   *
   *  Cleared on `del` like every other per-function field. A function that leaves and comes
   *  back is a new body, and inheriting the old score would be a number from a story that
   *  no longer runs through here. */
  cog: Uint32Array
  /** The frame's own "now". */
  ts: number
  /** Which commit this frame stands at; -1 is the opening state. */
  at: number
}

/** How many functions a frame has room for. `funcCount` is what the timeline promises and
 *  `funcs` is what has been paged in so far — the fold only ever names an index `Deltas`
 *  has guaranteed, but a frame sized under either would be a silent out-of-bounds write on
 *  a typed array, which is the one class of bug a `Map` could not have. */
function widthOf(hist: Tables): number {
  return Math.max(hist.funcCount, hist.funcs.length)
}

/** A frame holding nothing, with every field at its own absence. */
function blank(hist: Tables): Frame {
  const shape = shapeOf(hist)
  const n = widthOf(hist)
  return {
    loc: new Float64Array(n),
    live: new Uint8Array(n),
    lines: 0,
    order: [],
    touched: new Uint32Array(n).fill(NO_TS),
    born: new Uint32Array(n).fill(NO_TS),
    bornAt: new Int32Array(n).fill(NO_AT),
    editedAt: new Int32Array(n).fill(NO_AT),
    funcAuthor: new Int32Array(n).fill(NO_AUTHOR),
    graded: new Uint16Array(n).fill(NO_GRADE),
    cog: new Uint32Array(n).fill(NO_COG),
    hits: new Uint32Array(n * CHURN_MEMORY),
    hitLen: new Uint8Array(n),
    pathLive: new Uint32Array(hist.paths.length),
    pathBornAt: new Int32Array(hist.paths.length).fill(NO_AT),
    pathTs: new Uint32Array(hist.paths.length).fill(NO_TS),
    pathBorn: new Uint32Array(hist.paths.length).fill(NO_TS),
    pathHits: new Uint32Array(hist.paths.length * CHURN_MEMORY),
    pathHitLen: new Uint8Array(hist.paths.length),
    dirLive: new Uint32Array(shape.path.length),
    dirBornAt: new Int32Array(shape.path.length).fill(NO_AT),
    author: new Int32Array(hist.paths.length).fill(NO_AUTHOR),
    ts: hist.baseTs,
    at: -1,
  }
}

/** The opening state: everything the truncated commits built, before any frame lands. */
function opening(hist: Tables): Frame {
  const frame = blank(hist)
  const shape = shapeOf(hist)
  // The readings that came with the truncated prefix. Unlike a touch date, a reading from
  // before the window is not a claim about when anything happened — it is what the repo knew
  // at the moment the story starts, which is exactly what the opening frame should show.
  for (const [f, packed] of hist.baseRead ?? []) frame.graded[f] = packed
  // The complexity the pre-window code already had. Unlike a touch date this is not a claim
  // about when anything happened — it is a fact about the body sitting there when the story
  // opens — so it is carried rather than left absent, exactly as `baseRead` is. Dropped, the
  // oldest and usually largest part of a repo would draw as a language nobody counted.
  for (const [f, n] of hist.baseCog ?? []) frame.cog[f] = n
  for (const [f, loc] of hist.base) {
    frame.loc[f] = loc
    frame.live[f] = 1
    frame.lines += loc
    frame.order.push(f)
    // COUNTED, though — its file and directories are on screen from frame one, and a
    // container that is not counted here is a container that would report itself as newly
    // arrived the first time somebody adds a function to it. Counting without a birth is
    // exactly the state that says "present, with no arrival to show".
    census(frame, shape, hist.funcs[f].path)
    // Deliberately NOT marked as touched or born. Everything here predates the window, so
    // the only honest thing to say about when it was last written is that we do not know —
    // and an undated function draws uncolored rather than being dated to the start of the
    // window, which would make the opening frame flare as though somebody had just written
    // the entire repo.
  }
  return frame
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
function enter(frame: Frame, shape: Shape, p: number, at: number, ts: number): void {
  // Nothing above the function has arrived unless the FILE has: a function added to a file
  // that was already on screen changes no container's presence, and the dir counts were not
  // touched. Reading them anyway would re-birth a directory whose one file just gained a
  // second function.
  if (!census(frame, shape, p)) return
  frame.pathBornAt[p] = at
  // The date beside the position, for the reason `born` sits beside `bornAt`: one is what the
  // fold says out loud and the other is where the flash goes, and neither converts.
  frame.pathBorn[p] = ts
  // A count of exactly one, after counting this file in, means this file is the first thing
  // in that directory — so the directory arrived with it.
  for (const d of shape.ancestors[p]) {
    if (frame.dirLive[d] === 1) frame.dirBornAt[d] = at
  }
}

/** Count one function into its file and that file's directories. Returns whether the FILE
 *  was empty before, which is the only thing that makes it an arrival.
 *
 *  Split out because the opening state has to count without recording a birth: see
 *  `opening`. */
function census(frame: Frame, shape: Shape, p: number): boolean {
  const live = frame.pathLive[p] + 1
  frame.pathLive[p] = live
  if (live > 1) return false
  for (const d of shape.ancestors[p]) frame.dirLive[d] += 1
  return true
}

/** A function has left `p`. The mirror of `enter`: a file that loses its last function has
 *  left the picture, and if it comes back it is an arrival again — which is the honest
 *  reading, because that is what the map shows. */
function leave(frame: Frame, shape: Shape, p: number): void {
  // Floored rather than allowed to wrap. These counts are consistent by construction — a
  // departure is only ever applied to a function the frame holds — but the store is now
  // unsigned, so the one thing an inconsistency must not do is turn a zero into four
  // billion and put a directory on screen for the rest of the replay.
  const live = frame.pathLive[p] > 0 ? frame.pathLive[p] - 1 : 0
  frame.pathLive[p] = live
  if (live > 0) return
  frame.pathBornAt[p] = NO_AT
  frame.pathBorn[p] = NO_TS
  for (const d of shape.ancestors[p]) {
    const n = frame.dirLive[d] > 0 ? frame.dirLive[d] - 1 : 0
    frame.dirLive[d] = n
    if (n === 0) frame.dirBornAt[d] = NO_AT
  }
}

/** Apply commits `(frame.at, to]` in place. Returns whether every commit asked for was
 *  actually there — see the break below, and `bank`, which must not store a frame that
 *  stands somewhere other than where it says it does. */
function advance(frame: Frame, hist: Tables, deltas: Deltas, to: number): boolean {
  /** Arrivals and departures for this WHOLE step, applied to `order` once at the end.
   *
   *  **A splice is O(live), and a step at speed is hundreds of commits.** `order` is an
   *  ascending array of every function alive in the frame — 148,000 of them on kibana — so
   *  each arrival moved up to that many elements, and a frame at 5× carries the arrivals of
   *  roughly six hundred commits. Measured on an array that size: 2,000 arrivals spliced one
   *  at a time is **18.8ms**, and the same arrivals merged once is **0.5ms**.
   *
   *  Held as two sets rather than applied and undone, because a function can arrive and
   *  leave inside one step: a set that cancels its own opposite keeps the end state exactly
   *  what a commit-by-commit fold would have produced, which is the property this must not
   *  trade for speed — `frameTree` reads `order` and nothing else knows which functions are
   *  live. */
  const added = new Set<number>()
  const gone = new Set<number>()
  const shape = shapeOf(hist)
  let whole = true
  for (let i = frame.at + 1; i <= to && i < hist.commits; i++) {
    const c = deltas.at(i)
    // Past what has been fetched. The caller waits on `Deltas.ensure` before folding, so
    // this is the end of the story rather than a gap — see `lib/timeline.ts`.
    if (!c) {
      whole = false
      break
    }
    const who = authorId(hist, c.author)
    for (const [f, loc] of c.set) {
      // Absent BEFORE this commit, which is not the same question as "has no birth on
      // record". `c.set` carries rewrites as well as arrivals, and everything in the
      // opening state arrives with no birth by design — keyed on `born` this lit up every
      // base function the first time somebody edited it, which is an arrival the replay
      // never saw and, under a flash, the loudest thing on screen.
      const arrived = frame.live[f] === 0
      frame.lines += loc - frame.loc[f]
      frame.loc[f] = loc
      frame.live[f] = 1
      frame.touched[f] = c.ts
      frame.funcAuthor[f] = who
      frame.editedAt[f] = i
      if (arrived) {
        if (!gone.delete(f)) added.add(f)
        frame.born[f] = c.ts
        frame.bornAt[f] = i
        enter(frame, shape, hist.funcs[f].path, i, c.ts)
      }
      // The ring, oldest first. A full one shifts by one rather than growing — see
      // `Frame.hits`, and `CHURN_MEMORY` for why sixteen is all anybody can see.
      const base = f * CHURN_MEMORY
      let len = frame.hitLen[f]
      if (len >= CHURN_MEMORY) {
        frame.hits.copyWithin(base, base + 1, base + CHURN_MEMORY)
        len = CHURN_MEMORY - 1
      }
      frame.hits[base + len] = c.ts
      frame.hitLen[f] = len + 1
    }
    for (const f of c.del) {
      if (frame.live[f] === 1) {
        leave(frame, shape, hist.funcs[f].path)
        if (!added.delete(f)) gone.add(f)
        frame.lines -= frame.loc[f]
      }
      frame.live[f] = 0
      frame.loc[f] = 0
      frame.touched[f] = NO_TS
      frame.born[f] = NO_TS
      frame.bornAt[f] = NO_AT
      frame.editedAt[f] = NO_AT
      frame.funcAuthor[f] = NO_AUTHOR
      frame.graded[f] = NO_GRADE
      frame.cog[f] = NO_COG
      frame.hitLen[f] = 0
    }
    for (const [f, packed] of c.read ?? []) frame.graded[f] = packed
    for (const f of c.unread ?? []) frame.graded[f] = NO_GRADE
    // No `uncog`: the only thing that withdraws a score is the function leaving, which `del`
    // above already clears. A reading can be withdrawn while its function stays — somebody
    // deletes a shard — and complexity has no such second source to lose.
    for (const [f, n] of c.cog ?? []) frame.cog[f] = n
    for (const p of c.files) {
      frame.author[p] = who
      frame.pathTs[p] = c.ts
      // The same ring the functions keep, for the same reason: churn is commits inside a
      // window, and a running count cannot be advanced because old touches fall OUT of it as
      // the playhead moves. See `Frame.hits`.
      const base = p * CHURN_MEMORY
      let len = frame.pathHitLen[p]
      if (len >= CHURN_MEMORY) {
        frame.pathHits.copyWithin(base, base + 1, base + CHURN_MEMORY)
        len = CHURN_MEMORY - 1
      }
      frame.pathHits[base + len] = c.ts
      frame.pathHitLen[p] = len + 1
    }
  }
  // One pass for the whole step: drop what left, merge in what arrived. Both sides are
  // ascending — `order` by construction and the arrivals by sorting once — so this is a
  // linear merge rather than a splice apiece.
  if (added.size > 0 || gone.size > 0) {
    const fresh = [...added].sort((a, b) => a - b)
    const out: number[] = []
    let i = 0
    let j = 0
    const old = frame.order
    while (i < old.length || j < fresh.length) {
      if (i < old.length && gone.has(old[i])) {
        i++
        continue
      }
      if (j >= fresh.length) out.push(old[i++])
      else if (i >= old.length) out.push(fresh[j++])
      // Equal is not possible — an arrival is a function `frame.live` did not hold — but a
      // timeline is data and this is a merge: taking one and dropping the other keeps the
      // array a SET, which is what every reader assumes it is.
      else if (old[i] < fresh[j]) out.push(old[i++])
      else if (old[i] > fresh[j]) out.push(fresh[j++])
      else {
        out.push(old[i++])
        j++
      }
    }
    frame.order = out
  }
  frame.at = Math.min(to, hist.commits - 1)
  frame.ts = deltas.at(Math.max(0, frame.at))?.ts ?? hist.baseTs
  return whole
}

/** Commits between checkpoints.
 *
 *  A seek pays at most this many folds, at ~32µs each on a kibana-shaped timeline — tens of
 *  milliseconds, which is a drag that moves. It is a spacing rather than a schedule: a
 *  checkpoint is taken at whatever commit the playhead happens to land on once this many
 *  have passed, because a frame at speed carries hundreds of commits and stopping it on an
 *  exact multiple would mean folding twice. */
const CHECKPOINT_EVERY = 2_000
/** How many are kept, and what they may cost.
 *
 *  **Both, because either alone is wrong on some repo.** A count alone is a memory promise
 *  nobody checked: a checkpoint is ~48 bytes per function the timeline has ever held, so a
 *  dozen is a few megabytes on this repo and most of a gigabyte on something with a million
 *  functions. A budget alone gives a small repo far more checkpoints than its whole history
 *  can use. The bank takes whichever runs out first, and never fewer than two — with one you
 *  are back to folding from the opening state, which is the thing this exists to avoid. */
const CHECKPOINTS = 12
const CHECKPOINT_BUDGET = 96 * 1024 * 1024

/**
 * A frame, frozen.
 *
 * **`hits` is packed and everything else is a straight copy.** The ring is `CHURN_MEMORY`
 * wide per function and is by a distance the biggest thing a frame holds — 64 bytes against
 * the 32 the rest of the fields come to — while most functions have been touched a handful
 * of times. So a checkpoint stores exactly `hitLen[f]` stamps per function, in function
 * order, and `thaw` scatters them back. Nothing is approximated: the same stamps come back
 * in the same order, which is the whole promise a checkpoint makes.
 *
 * `order` is not stored. It is the ascending list of live functions and `live` already says
 * which those are, so a second copy could only ever disagree with the first.
 */
interface Checkpoint {
  at: number
  ts: number
  lines: number
  loc: Float64Array
  live: Uint8Array
  touched: Uint32Array
  born: Uint32Array
  bornAt: Int32Array
  editedAt: Int32Array
  funcAuthor: Int32Array
  graded: Uint16Array
  /** The complexity scores — see `Frame.cog`, and `pathTs` for what a field left out of here
   *  comes back as. */
  cog: Uint32Array
  hitLen: Uint8Array
  hits: Uint32Array
  pathLive: Uint32Array
  pathBornAt: Int32Array
  /** The file-level pair, compacted the way the function hits are — see `bank`. Carried
   *  because a checkpoint is the whole frame: a field left out here is a field that comes
   *  back EMPTY after a backward seek, and empty reads as a valid answer. That is the hazard
   *  `treecache`'s version list exists for, and it is worse here because nothing versions a
   *  checkpoint — it is simply wrong, once, in a direction nobody looks. */
  pathTs: Uint32Array
  /** The file-level birth dates — see `Frame.pathBorn`, and the paragraph above for why a
   *  frame array that is not banked comes back as a confident wrong answer. */
  pathBorn: Uint32Array
  pathHits: Uint32Array
  pathHitLen: Uint8Array
  author: Int32Array
  dirLive: Uint32Array
  dirBornAt: Int32Array
}

function freeze(frame: Frame): Checkpoint {
  const n = frame.hitLen.length
  let stamps = 0
  for (let f = 0; f < n; f++) stamps += frame.hitLen[f]
  const hits = new Uint32Array(stamps)
  let w = 0
  for (let f = 0; f < n; f++) {
    const len = frame.hitLen[f]
    if (len === 0) continue
    const base = f * CHURN_MEMORY
    for (let i = 0; i < len; i++) hits[w++] = frame.hits[base + i]
  }
  // The file ring, compacted exactly as the function ring above it is: `pathHitLen[p]` stamps
  // per path, in path order, so `thaw` can lay them back down in the same order.
  let pathTotal = 0
  for (let p = 0; p < frame.pathHitLen.length; p++) pathTotal += frame.pathHitLen[p]
  const pathHits = new Uint32Array(pathTotal)
  let pw = 0
  for (let p = 0; p < frame.pathHitLen.length; p++) {
    const len = frame.pathHitLen[p]
    if (len === 0) continue
    const base = p * CHURN_MEMORY
    for (let i = 0; i < len; i++) pathHits[pw++] = frame.pathHits[base + i]
  }
  return {
    at: frame.at,
    ts: frame.ts,
    lines: frame.lines,
    pathTs: frame.pathTs.slice(),
    pathHits,
    pathHitLen: frame.pathHitLen.slice(),
    loc: frame.loc.slice(),
    live: frame.live.slice(),
    touched: frame.touched.slice(),
    born: frame.born.slice(),
    bornAt: frame.bornAt.slice(),
    editedAt: frame.editedAt.slice(),
    funcAuthor: frame.funcAuthor.slice(),
    graded: frame.graded.slice(),
    cog: frame.cog.slice(),
    hitLen: frame.hitLen.slice(),
    hits,
    pathLive: frame.pathLive.slice(),
    pathBornAt: frame.pathBornAt.slice(),
    pathBorn: frame.pathBorn.slice(),
    author: frame.author.slice(),
    dirLive: frame.dirLive.slice(),
    dirBornAt: frame.dirBornAt.slice(),
  }
}

function thaw(cp: Checkpoint): Frame {
  const paths = cp.pathHitLen.length
  const pathHits = new Uint32Array(paths * CHURN_MEMORY)
  let pr = 0
  for (let p = 0; p < paths; p++) {
    const len = cp.pathHitLen[p]
    if (len === 0) continue
    const base = p * CHURN_MEMORY
    for (let i = 0; i < len; i++) pathHits[base + i] = cp.pathHits[pr++]
  }
  const n = cp.hitLen.length
  const hits = new Uint32Array(n * CHURN_MEMORY)
  const order: number[] = []
  let r = 0
  for (let f = 0; f < n; f++) {
    if (cp.live[f] === 1) order.push(f)
    const len = cp.hitLen[f]
    if (len === 0) continue
    const base = f * CHURN_MEMORY
    for (let i = 0; i < len; i++) hits[base + i] = cp.hits[r++]
  }
  return {
    loc: cp.loc.slice(),
    live: cp.live.slice(),
    lines: cp.lines,
    order,
    touched: cp.touched.slice(),
    born: cp.born.slice(),
    bornAt: cp.bornAt.slice(),
    editedAt: cp.editedAt.slice(),
    funcAuthor: cp.funcAuthor.slice(),
    graded: cp.graded.slice(),
    cog: cp.cog.slice(),
    hits,
    hitLen: cp.hitLen.slice(),
    pathLive: cp.pathLive.slice(),
    pathBornAt: cp.pathBornAt.slice(),
    pathBorn: cp.pathBorn.slice(),
    pathTs: cp.pathTs.slice(),
    pathHits,
    pathHitLen: cp.pathHitLen.slice(),
    dirLive: cp.dirLive.slice(),
    dirBornAt: cp.dirBornAt.slice(),
    author: cp.author.slice(),
    ts: cp.ts,
    at: cp.at,
  }
}

function weigh(cp: Checkpoint): number {
  return (
    cp.loc.byteLength +
    cp.live.byteLength +
    cp.touched.byteLength +
    cp.born.byteLength +
    cp.bornAt.byteLength +
    cp.editedAt.byteLength +
    cp.funcAuthor.byteLength +
    cp.graded.byteLength +
    cp.cog.byteLength +
    cp.hitLen.byteLength +
    cp.hits.byteLength +
    cp.pathLive.byteLength +
    cp.pathBornAt.byteLength +
    cp.pathBorn.byteLength +
    cp.author.byteLength +
    cp.dirLive.byteLength +
    cp.dirBornAt.byteLength
  )
}

/**
 * The checkpoints held for one timeline, and the memoised frame they accelerate.
 *
 * **A runtime accelerator, never a stored artefact.** These are derived from deltas the
 * window already has, so `history::CACHE_VERSION` is not involved and never should be — the
 * day one of these is written to disk is the day it becomes a second copy of the story, free
 * to drift from the one it was derived from.
 */
let bank: { hist: Tables; at: Checkpoint[]; bytes: number } | null = null

/** Keep the survivors SPREAD, rather than clustered where somebody last was.
 *
 *  Playback banks a checkpoint every couple of thousand commits as it goes, so dropping the
 *  oldest would leave a dozen of them in the last stretch of the story and nothing at all in
 *  front of the opening state — which is the seek that is slowest to begin with. The one
 *  dropped is whichever leaves the smallest hole: the interior checkpoint whose neighbours
 *  are closest together. The ends are kept, because they are the two the ordering itself
 *  cannot replace. */
function evict(kept: Checkpoint[]): void {
  if (kept.length < 3) return
  let worst = 1
  let gap = Infinity
  for (let i = 1; i < kept.length - 1; i++) {
    const span = kept[i + 1].at - kept[i - 1].at
    if (span < gap) {
      gap = span
      worst = i
    }
  }
  kept.splice(worst, 1)
}

function remember(hist: Tables, frame: Frame): void {
  if (!bank || bank.hist !== hist) bank = { hist, at: [], bytes: 0 }
  const kept = bank.at
  const last = kept.length > 0 ? kept[kept.length - 1].at : -1
  if (frame.at - last < CHECKPOINT_EVERY) return
  const cp = freeze(frame)
  const size = weigh(cp)
  kept.push(cp)
  bank.bytes += size
  while (kept.length > 2 && (kept.length > CHECKPOINTS || bank.bytes > CHECKPOINT_BUDGET)) {
    const before = kept.length
    evict(kept)
    if (kept.length === before) break
    bank.bytes = kept.reduce((s, c) => s + weigh(c), 0)
  }
}

/** The highest checkpoint at or before `index`, or nothing. */
function nearest(hist: Tables, index: number): Checkpoint | null {
  if (!bank || bank.hist !== hist) return null
  let out: Checkpoint | null = null
  for (const cp of bank.at) {
    if (cp.at <= index && (!out || cp.at > out.at)) out = cp
  }
  return out
}

/**
 * What the last fold actually cost, in commits.
 *
 * **Because a seek that thawed nothing is correct and slow**, and no comparison of two trees
 * can tell that apart from a seek that worked — which is exactly the failure checkpoints
 * exist to prevent, arriving back as a silent regression. A wall clock would say so too, and
 * says it differently on every machine; this is the same claim without a threshold anybody
 * has to tune. Read by `scripts/replay-check.ts`.
 */
export const cost = { folded: 0, thawed: 0 }

/** The last frame computed, kept so playing forward does not re-fold the whole timeline.
 *
 *  Playback only ever moves forward, and a from-scratch fold is linear in how far along
 *  you are — measured on tonepoet it was 1.3ms at commit 98 and **26ms at commit 983**, so
 *  the replay got slower exactly as the story got interesting, and the top speed was
 *  decided by the tail. Stepping forward applies only the commits between, which is flat.
 *
 *  Module-level rather than a hook, because it is a pure accelerator: it changes no answer
 *  — `frameTree(hist, i)` returns the same tree whether or not the memo is warm — so it
 *  has no business in the render tree.
 *
 *  **Scrubbing backwards is the same promise one level down.** It used to rebuild from the
 *  opening state, which on kibana is 60,000 folds and about two seconds of nothing moving;
 *  it now thaws the nearest checkpoint and folds the remainder. What it does NOT do is undo
 *  a commit: that needs the state each commit replaced, which is a second timeline the size
 *  of the first with a standing obligation to stay in step with it forever. A checkpoint is
 *  a state the fold already computed, so there is nothing to keep in step.
 */
let memo: { hist: Tables; frame: Frame } | null = null

function replay(hist: Tables, deltas: Deltas, index: number): Frame {
  if (memo && memo.hist === hist && memo.frame.at <= index) {
    cost.folded = index - memo.frame.at
    cost.thawed = -1
    if (advance(memo.frame, hist, deltas, index)) remember(hist, memo.frame)
    return memo.frame
  }
  // A timeline the bank has never seen invalidates the interned authors with it: the ids in
  // a frame are indices into that table, so the two are one store wearing two names.
  if (!bank || bank.hist !== hist) authorsOf(hist)
  const from = nearest(hist, index)
  cost.thawed = from ? from.at : -1
  cost.folded = index - (from ? from.at : -1)
  const frame = from ? thaw(from) : opening(hist)
  if (advance(frame, hist, deltas, index)) remember(hist, frame)
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

/** One grade out of a packed reading — see `assessment::packed`. `undefined` is absent. */
const GRADES: (Grade | undefined)[] = [undefined, 'none', 'some', 'most', 'full']
function gradeAt(packed: number, shift: number): Grade | undefined {
  return GRADES[(packed >> shift) & 7]
}

/** A body's kind out of `HistoryFunc.kind` — see `history::place`. The kind order is
 *  `KIND_ORDER`, which `Cols::kind` already uses; the evidence rides in the low two bits. */
const HOW = ['contract', 'reader', 'convention', 'parsed'] as const
const UNPLACED = 255
function placeOf(packed: number | undefined): Node['codeKind'] {
  if (packed === undefined || packed === UNPLACED) return null
  const kind = KIND_ORDER[packed >> 2]
  return kind ? { kind, how: HOW[packed & 3] } : null
}

/** Where a body's lines land in its file's per-kind totals: its kind, or the slot past the
 *  last one for a body nothing placed. */
const KIND_SLOTS = KIND_ORDER.length + 1
function kindSlot(packed: number | undefined): number {
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
function readingInto(into: AgentReport | null, packed: number): AgentReport {
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
function scoreInto(
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
    s.tangle = tangleRamp(bands, frame.loc[f], cog)
  }
  // Written every time, including to null: these Score objects are POOLED and reused frame
  // to frame, so a field left alone keeps the last function's answer.
  s.appeared = at !== NO_AT && inStep(at, since, frame.at) ? 1 : null
  s.edited = edit !== NO_AT && inStep(edit, since, frame.at) ? 1 : null
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

/** Fold a directory that holds exactly one directory into its child, so `src/tauri/src`
 *  is one ring rather than three. The scan does this and the two pictures have to have
 *  the same shape, or scrubbing to HEAD would visibly restructure the repo. */
function collapse(node: Node): Node {
  // In place. It was `children.map(collapse)`, which allocates an array per container per
  // frame — invisible next to the nodes themselves until those were pooled, and then the
  // largest thing left. A chain that collapses still yields a fresh node, which is right:
  // it is a different subject from either of the two it replaces, and there are few of them.
  const kids = node.children
  for (let i = 0; i < kids.length; i++) {
    const done = collapse(kids[i])
    if (done !== kids[i]) kids[i] = done
  }
  if (node.kind === 'dir' && kids.length === 1 && kids[0].kind === 'dir') {
    const only = kids[0]
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
    callers: null,
    calls: null,
    incident: null,
    away: null,
    resolvable: null,
    orphans: null,
    sinks: null,
    // A frame is a past commit and the timeline carries no wiring, so all three are the
    // absence rather than a zero — which is why Testing is a `live` lens: replayed, it says
    // it cannot be replayed instead of drawing every wedge as untested.
    dependents: null,
    underTest: null,
    tested: null,
    codeKind: null,
    cloneGroup: null,
    cloneSize: null,
    comparable: null,
    copied: null,
    loc: 0,
    line: null,
    endLine: null,
    bytes: null,
    lang: null,
    excluded: false,
    lastAuthor: null,
    mainAuthor: null,
    headcount: null,
    // Never a doc. History replays the commit stream's structure — see the module note on
    // what a frame is allowed to claim — and a comment is a reading's input, not a fact
    // about a commit.
    doc: null,
    signature: null,
    owner: null,
    score: null,
    body: null,
    hotspots: [],
    children: [],
    funcs: 0,
  }
}

/** Every node a frame draws, reused frame to frame.
 *
 *  A frame of tonepoet is seventeen thousand functions, each with a `Score`, and building
 *  them fresh thirty times a second is a million objects a second handed straight to the
 *  collector — which showed up exactly as it sounds: a smooth replay with a hitch in it on
 *  a period nobody chose. Nodes are pooled and MUTATED instead.
 *
 *  **Containers were left out of this, and the reason inverted on a large repo.** The
 *  argument was that the sunburst recomputes its layout when the node it is ROOTED at
 *  changes identity, so a stable root would freeze the map — which is exactly right about
 *  the root and does not reach its children: `layout` walks the tree afresh every time it
 *  runs, and every memo downstream keys on the root. So the root is still allocated per
 *  frame, one object, and everything under it is held here.
 *
 *  What made it worth doing is that the saving was measured on the wrong half. `minLoc`
 *  rolls a function up before a node exists, and on a 4.2M-line repo the cut is a thousand
 *  lines — so nearly every function is folded away and the frame is almost entirely
 *  containers. Sixty thousand files and their stand-ins, at about twenty-five fields each,
 *  against a pooled population of nearly nothing: measured at 117ms a frame to BUILD, where
 *  folding six hundred commits into it cost 33ms.
 *
 *  Keyed by the timeline it belongs to, so switching projects cannot hand one repo's nodes
 *  to another's tree. */
interface Pool {
  hist: Tables
  nodes: Map<number, Node>
  dirs: Map<string, Node>
  files: Map<number, Node>
  /** The per-file roll-up stand-ins — see where they are built. */
  folded: Map<number, Node>
  /** ...and the per-DIRECTORY ones, for the files a ring has no room for. */
  crowd: Map<number, Node>
}
let pool: Pool | null = null

/** A score carrying an event and nothing else.
 *
 *  Every other field a `Score` has is a measurement, and a stand-in is a count of things the
 *  picture has no room for — it has no age, no churn and no reading of its own, so they stay
 *  at the values that mean "no claim". A score with nothing in it but the event is why
 *  `aggregate` has to skip these nodes: rolled into their parent they would dilute its real
 *  numbers with zeroes. */
function flashOnly(birth: boolean, edit: boolean): Score | null {
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

/** Ready a pooled container for this frame.
 *
 *  Everything a frame DERIVES is cleared; everything that is a property of the path is left
 *  alone. `id`, `path`, `name`, `kind` and `lang` are the second kind — a file does not
 *  change its name between commits — and rewriting them every frame is the allocation this
 *  exists to avoid, wearing a different hat.
 *
 *  `score` is cleared rather than kept for `aggregate` to overwrite, because `aggregate`
 *  can decline to write one: a container whose children carry no score at all leaves it
 *  untouched, and a stale score from six hundred commits ago is the worst of both — it
 *  reads as current and describes a frame that has gone. */
function reuse(node: Node): Node {
  node.children.length = 0
  node.loc = 0
  node.score = null
  node.birthBelow = undefined
  node.touchBelow = undefined
  return node
}

/** Path string → its index, so a container can look up its own arrival by node id. Built
 *  once per timeline rather than per frame: it is a property of the scan, and a replay
 *  rebuilds this tree thirty times a second. */
let index: { hist: Tables; at: Map<string, number> } | null = null

/** The path indices under one scope — see `frameTree`'s `scope`.
 *
 *  Memoised per timeline and scope, because it is a property of the path table rather than
 *  of the frame: a replay rebuilds its tree thirty times a second and this changes only when
 *  somebody drills. A file scope matches itself; a directory matches everything beneath it,
 *  segment-wise, or `web/src` takes in `web/src-old`. */
/**
 * The directory tree of a timeline, interned once.
 *
 * **A replay's paths never change**, so the shape they make is a property of the timeline
 * and not of the frame — which is what lets a frame ask "what is under this directory"
 * without walking anything. Dirs are indices here for the same reason paths already are:
 * a frame totals lines into a dense array, and a string key would put a hash in the middle
 * of the hottest loop in the module.
 *
 * `ancestors` is innermost-first and excludes the root. It is what `advance` walks when a
 * function arrives or leaves: the string version allocated an array of paths per arrival and
 * hashed each one into a map, which is a per-commit cost for an answer that never changes.
 */
interface Shape {
  hist: Tables
  /** Dir path per index. `0` is the repo root, whose path is the empty string. */
  path: string[]
  name: string[]
  /** Child directories, and the files that sit directly inside — path indices. */
  kids: number[][]
  files: number[][]
  /** Each file path's own directory, and its whole ancestor chain. */
  owner: Int32Array
  ancestors: Int32Array[]
  /** Directory path → index, which is how a container looks its own arrival up by node id.
   *  Built here because it is built here anyway — `dirFor` needs it to intern. */
  dirAt: Map<string, number>
}

let shaped: Shape | null = null
function shapeOf(hist: Tables): Shape {
  if (shaped && shaped.hist === hist && shaped.owner.length === hist.paths.length) return shaped
  const at = new Map<string, number>([['', 0]])
  const shape: Shape = {
    hist,
    path: [''],
    name: [hist.paths.length > 0 ? '' : ''],
    kids: [[]],
    files: [[]],
    owner: new Int32Array(hist.paths.length),
    ancestors: new Array<Int32Array>(hist.paths.length),
    dirAt: at,
  }
  const dirFor = (path: string): number => {
    const had = at.get(path)
    if (had !== undefined) return had
    const cut = path.lastIndexOf('/')
    const parent = dirFor(cut === -1 ? '' : path.slice(0, cut))
    const idx = shape.path.length
    shape.path.push(path)
    shape.name.push(cut === -1 ? path : path.slice(cut + 1))
    shape.kids.push([])
    shape.files.push([])
    at.set(path, idx)
    shape.kids[parent].push(idx)
    return idx
  }
  hist.paths.forEach((p, i) => {
    const cut = p.lastIndexOf('/')
    const dir = dirFor(cut === -1 ? '' : p.slice(0, cut))
    shape.owner[i] = dir
    shape.files[dir].push(i)
    const chain: number[] = []
    for (
      let d = dir;
      d !== 0;
      d = at.get(shape.path[d].slice(0, Math.max(0, shape.path[d].lastIndexOf('/')))) ?? 0
    ) {
      chain.push(d)
      if (chain.length > 64) break
    }
    shape.ancestors[i] = Int32Array.from(chain)
  })
  shaped = shape
  return shape
}

let scoped: { hist: Tables; scope: string; at: Set<number> } | null = null
function scopeOf(hist: Tables, scope: string): Set<number> {
  if (scoped && scoped.hist === hist && scoped.scope === scope) return scoped.at
  const at = new Set<number>()
  const under = `${scope}/`
  hist.paths.forEach((p, i) => {
    if (p === scope || p.startsWith(under)) at.add(i)
  })
  scoped = { hist, scope, at }
  return at
}

/** Every language the timeline has ever held under one scope, most FILES first.
 *
 *  The tail of the language ranking — see `langRank` in `hooks/useLens.ts`. Today's map decides the
 *  order of everything still present, and this supplies only what is not: a language a repo
 *  has since migrated away from, which has no wedge at HEAD to be ranked by and would
 *  otherwise open its own era in `other`. That is the failure the blame lens already
 *  recorded from the other side, where seeding a replay from today's ranking left the
 *  opening grey.
 *
 *  By file count rather than by lines, because the path table does not carry sizes. It is
 *  only ordering the tail, where the alternative for every one of them is no colour at all.
 *
 *  Excluded paths are left out, the same way they are left out of the frame. */
export function historyLangs(hist: Tables, scope: string): string[] {
  const inScope = scope ? scopeOf(hist, scope) : null
  const files = new Map<string, number>()
  hist.langs.forEach((lang, p) => {
    if (!lang || hist.excluded[p]) return
    if (inScope && !inScope.has(p)) return
    files.set(lang, (files.get(lang) ?? 0) + 1)
  })
  return [...files.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([lang]) => lang)
}

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
  /** The directory or file the map is rooted at, repo-relative, or `''` for the whole repo.
   *
   *  **The roll-up threshold is a share of the circle, and when you drill the circle is the
   *  SUBTREE.** See `minLoc`: the cut is `lines / 4000`, which is right at the root and far
   *  too coarse anywhere else, because the lines it divides were the whole repo's while the
   *  wedges being drawn belong to one directory. Standing in ceph's `src/mon` — 44,160
   *  lines of a repo with hundreds of thousands — that meant five functions drawn and
   *  everything else rolled into `206+`, on a ring with room for hundreds. Drilling is the
   *  gesture that asks for detail and it could not deliver any.
   *
   *  Taken from the drill stack rather than from `focus`, which is resolved against the tree
   *  this builds and would be a cycle. */
  scope: string = '',
  /** How much denser the picture is than the screen it was staged from — see `Sunburst`'s
   *  own `density`, and `1` for the screen itself.
   *
   *  **The layout's thresholds are not the only ones that decide detail.** `minLoc` below
   *  rolls a function up before a node is ever built, and it is stated in LINES rather than
   *  pixels, so laying the map out for a 4000px file leaves it exactly where it was: a
   *  bigger movie of the same `206+`.
   *
   *  **Squared, because a function is drawn as a TILE and a tile is an area.** The obvious
   *  reading is that four times the width is four times the detail — true of the ring, where
   *  a wedge's share is an angle and `minAngle` falls in proportion. Functions are not on the
   *  ring: `tileFunctions` packs them inside their file's band against `MIN_PATCH_PX`, an
   *  area, which `unitsPerPx²` already scales quadratically. A supply that grew linearly
   *  would simply become the binding constraint — measured on a synthetic repo of 3,200
   *  files, a 4000px frame drew every file and not one more function than a 1000px one. */
  density: number = 1,
  /** Whether the commit under the playhead flashes what it touched.
   *
   *  **TEMPORARY, and it is a question about the story rather than about the code.** The two
   *  events are the only colour a replay adds of its own — everything else on screen is the
   *  lens — and whether they help or shout over it is a thing to look at rather than to
   *  argue about. Off, a replay is the lens alone, moving.
   *
   *  Expressed by moving `since`, which is the one thing every flash is decided against:
   *  `inStep` asks whether something happened in `(since, index]`, so a step of nothing can
   *  contain nothing. That is deliberately not a second rule — a flag consulted in four
   *  places is four places to forget, and this way the stand-ins, the escalation and the
   *  per-function scores all go quiet together because they were always reading one clock. */
  flashes: boolean = true,
  /** This repo's churn windows, in days — see `ChurnView` and `edits::windows_for`.
   *
   *  **Passed in rather than assumed, because the ladder is a fact about the repo.** A frame
   *  that counted a fixed ninety days would band a 27-day project's whole history as one
   *  window while the live map beside it offered four, and the two would disagree about what
   *  Churn means the moment History opened — the split brain `CLAUDE.md` names, which has
   *  already happened once over blame ranks. Defaulted to the full ladder for a caller that
   *  has no scan in hand, which is only the harnesses. */
  windows: ChurnWindows = [30, 60, 90, 180],
): Node {
  const frame = replay(hist, deltas, index)
  // **One yardstick for the whole replay**, so a wedge changes colour when its body changes
  // and at no other time — see `Tables.tangleBands`. Read here rather than threaded from a
  // caller: it is a property of the timeline, like the paths and the languages beside it.
  const bands = hist.tangleBands?.median
  if (!flashes) since = index
  if (!pool || pool.hist !== hist) {
    pool = {
      hist,
      nodes: new Map(),
      dirs: new Map(),
      files: new Map(),
      folded: new Map(),
      crowd: new Map(),
    }
  }
  const held: Pool = pool
  const nodes = held.nodes
  const shape = shapeOf(hist)
  const pathIndex = pathIndexOf(hist)
  // **The root is the one allocation, and it has to be.** Every memo downstream keys on it,
  // so a stable root would hold the picture still while the data moved underneath — see the
  // pool's own note.
  const root = dirNode('', repoName)

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
  const minLoc = frame.lines / (4000 * density * density)
  /** The same rule asked about what is actually being drawn — see `scope`. */
  const inScope = scope ? scopeOf(hist, scope) : null
  let scopeLines = 0
  if (inScope) {
    for (const f of frame.order) {
      if (inScope.has(hist.funcs[f].path)) scopeLines += frame.loc[f]
    }
  }
  const scopeMin = inScope && scopeLines > 0 ? scopeLines / (4000 * density * density) : minLoc

  /** Lines and count rolled up per file, for the stand-in wedges below.
   *
   *  **Dense arrays rather than maps, because a path IS an index.** These are written once
   *  per live function and read once per live file, and as maps that is a hash into a table
   *  the size of the repo — 148,000 lookups against 60,000 keys, which is the pointer chase
   *  the measurement found: sixty thousand files alone cost 10ms a frame and a hundred and
   *  forty-eight thousand functions alone cost 17ms, but together they cost 97ms. That
   *  superlinearity is not work, it is cache misses, and `hist.paths` is already a dense
   *  index that makes it go away. */
  const restLoc = new Float64Array(hist.paths.length)
  const restCount = new Uint32Array(hist.paths.length)
  /** ...and whether anything folded into that stand-in flashed on this frame.
   *
   *  Without this a replay of a large repo shows nothing at all. `minLoc` drops a function
   *  before it is ever a node, and on a repo the size of home-assistant it drops every one
   *  of them — so the commit under the playhead had nowhere to land and the map sat grey
   *  while the log scrolled past. The stand-in is what the fold left standing in for that
   *  function, so it is what carries the event. */
  const restBirth = new Uint8Array(hist.paths.length)
  const restEdit = new Uint8Array(hist.paths.length)
  /** Every live line in each file, drawn or rolled up, and the functions that earned their
   *  own node. The totals are what the top-down walk below thresholds against; the lists are
   *  what a drawn file hangs off itself. */
  const fileLoc = new Float64Array(hist.paths.length)
  // **The file's own answer to Complexity, totalled in the same pass that sizes it.** The
  // fold needs it at FILE resolution — a rolled-up directory has no functions on screen to
  // ask — and the live map computes exactly this in `Node::aggregate`: the ramp positions are
  // a LOC-weighted mean over the functions that could be counted (`fileTanW`, weighted by
  // `fileTanLoc`, which is NOT `fileLoc`), and the counts are summed.
  const fileCog = new Float64Array(hist.paths.length)
  const fileTan0 = new Float64Array(hist.paths.length)
  const fileTan1 = new Float64Array(hist.paths.length)
  const fileTanLoc = new Float64Array(hist.paths.length)
  // **Composition's answer at FILE resolution, for the same reason.** Lines by kind, one run
  // of `KIND_SLOTS` per path: Rust keeps its tests in the file they test, so a file is a mix
  // and the fold has to carry the mix rather than one kind. `restKind` is the same for the
  // thin functions a drawn file's stand-in holds.
  const fileKind = new Float64Array(hist.paths.length * KIND_SLOTS)
  const restKind = new Float64Array(hist.paths.length * KIND_SLOTS)
  const drawn = new Map<number, Node[]>()

  // In interned order — see `Frame.order`, which is kept that way as commits land rather
  // than rebuilt here.
  for (const f of frame.order) {
    const loc = frame.loc[f]
    const def = hist.funcs[f]
    // Ignored means ignored, in the replay as on the live map. The trace still holds them —
    // pruning at the walk would mean re-tracing a large repo whenever the file changed — so
    // they are dropped here, where the picture is built. See `Tables.excluded`.
    if (hist.excluded[def.path]) continue
    fileLoc[def.path] += loc
    const ks = def.path * KIND_SLOTS + kindSlot(def.kind)
    fileKind[ks] += loc
    const score = frame.cog[f]
    if (score !== NO_COG) {
      const [w0, w1] = tangleRamp(bands, loc, score)
      const cw = Math.max(loc, 1)
      fileCog[def.path] += score
      fileTan0[def.path] += w0 * cw
      fileTan1[def.path] += w1 * cw
      fileTanLoc[def.path] += cw
    }
    // Too thin to draw. Its lines still count — they reach the file wedge through the
    // stand-in below, so a file is the size it is whatever its inside looks like.
    if (loc < (inScope && inScope.has(def.path) ? scopeMin : minLoc)) {
      restLoc[def.path] += loc
      restKind[ks] += loc
      restCount[def.path] += 1
      const bornAt = frame.bornAt[f]
      const editAt = frame.editedAt[f]
      if (bornAt !== NO_AT && inStep(bornAt, since, frame.at)) restBirth[def.path] = 1
      if (editAt !== NO_AT && inStep(editAt, since, frame.at)) restEdit[def.path] = 1
      continue
    }
    let node = nodes.get(f)
    if (!node) {
      node = {
        id: `${hist.paths[def.path]}#${def.name}#${f}`,
        name: def.name,
        kind: 'func',
        path: hist.paths[def.path],
        doc: null,
        signature: null,
        owner: null,
        loc,
        line: null,
        endLine: null,
        bytes: null,
        // From the path table rather than from the file NODE, which does not exist yet: the
        // functions are collected first and the file is built around them only if the
        // picture has room for it.
        lang: hist.langs[def.path] || null,
        excluded: false,
        lastAuthor: null,
    mainAuthor: null,
    headcount: null,
        score: null,
        body: null,
        hotspots: [],
        // A replay has no wiring, and never will. Resolving calls needs every file in the
        // repo as it stood at that commit, and the walk carries parse state forward rather
        // than re-parsing the tree — so the honest answer is the one the module already
        // gives for surprise: this is a second VIEW, not a second measurement, and a lens
        // it cannot compute stays gray rather than being stamped with today's answer.
        // The switcher is disabled during a replay anyway; this is what makes that true
        // rather than merely enforced.
        callers: null,
        calls: null,
        incident: null,
        away: null,
        resolvable: null,
        orphans: null,
        sinks: null,
        // A frame is a past commit and the timeline carries no wiring, so all three are the
    // absence rather than a zero — which is why Testing is a `live` lens: replayed, it says
    // it cannot be replayed instead of drawing every wedge as untested.
    dependents: null,
    underTest: null,
    tested: null,
    // Not wiring: what the body IS, placed by the walk from its own latest version — see
    // `HistoryFunc.kind`.
    codeKind: placeOf(def.kind),
    cloneGroup: null,
        cloneSize: null,
        comparable: null,
        copied: null,
        children: [],
        funcs: 0,
      }
      nodes.set(f, node)
    }
    // Only what a frame can change. Identity, path and language are properties of the
    // function, not of the moment — a pooled node that rewrote them every frame would be
    // a fresh allocation wearing a cache's clothes.
    node.loc = loc
    // **Its own last committer, or none.** Falling back to the file's would put an author on
    // every function in a file somebody touched, which is the thing this replaced. A function
    // from the truncated prefix has no author for the same reason it has no touch date: the
    // commit that wrote it is outside the window, and the honest answer is that we do not know.
    node.lastAuthor = authorName(hist, frame.funcAuthor[f])
    const packed = frame.graded[f]
    node.score = scoreInto(node.score, frame, f, since, packed, windows, bands)
    // The reading itself, for the two lenses that read it as a report rather than as a
    // number. Cleared when this frame has none, or a pooled node keeps the last one's.
    node.agent = packed === NO_GRADE ? undefined : readingInto(node.agent ?? null, packed)
    node.agentStale = false
    const list = drawn.get(def.path)
    if (list) list.push(node)
    else drawn.set(def.path, [node])
  }

  /** Live lines and live files under each directory, and whether anything under it flashed.
   *
   *  **This is what makes the walk below top-DOWN.** The tree used to be built bottom-up
   *  from every live function, which meant a node per live file whatever the picture had
   *  room for: sixty thousand of them on kibana, to draw about two hundred wedges, with an
   *  aggregate and a collapse pass over all of it thirty times a second. Totals first, then
   *  descend only where there is something to see.
   *
   *  One add per ancestor per live file — a depth of eight on the deepest repos here — where
   *  the old shape paid a node, a score and two walks. */
  const dirLoc = new Float64Array(shape.path.length)
  const dirFiles = new Uint32Array(shape.path.length)
  const dirBirth = new Uint8Array(shape.path.length)
  const dirEdit = new Uint8Array(shape.path.length)
  for (let p = 0; p < fileLoc.length; p++) {
    const lines = fileLoc[p]
    if (lines <= 0) continue
    const born = frame.pathBornAt[p]
    const birth = restBirth[p] === 1 || (born !== NO_AT && inStep(born, since, frame.at))
    const edit = restEdit[p] === 1
    for (const a of shape.ancestors[p]) {
      dirLoc[a] += lines
      dirFiles[a] += 1
      if (birth) dirBirth[a] = 1
      if (edit) dirEdit[a] = 1
    }
  }

  /** The directories on the way to the scope, which are drawn whatever their size.
   *
   *  A drilled view resolves its own root by id against this tree, so pruning the chain that
   *  reaches it would leave the window looking for a node that is not there. The scope is
   *  also the one place a small directory is certainly worth drawing: somebody asked for it
   *  by name. */
  const forced = new Set<number>()
  if (scope) {
    for (let d = 0; d < shape.path.length; d++) {
      if (shape.path[d] === scope || scope.startsWith(`${shape.path[d]}/`)) forced.add(d)
    }
  }

  const dirNodeFor = (d: number): Node => {
    const path = shape.path[d]
    const had = held.dirs.get(path)
    if (had) return reuse(had)
    const made = dirNode(path, shape.name[d])
    held.dirs.set(path, made)
    return made
  }

  const fileNodeFor = (p: number): Node => {
    const path = hist.paths[p]
    const had = held.files.get(p)
    const made = had
      ? reuse(had)
      : {
          ...dirNode(path, path.slice(path.lastIndexOf('/') + 1)),
          kind: 'file' as const,
          lang: hist.langs[p] || null,
        }
    if (!had) held.files.set(p, made)
    // The one field a file derives from the FRAME rather than from the path — see the
    // stand-in below, which takes the same value for the same reason.
    made.lastAuthor = authorName(hist, frame.author[p])
    for (const fn of drawn.get(p) ?? []) made.children.push(fn)
    if (restLoc[p] > 0) made.children.push(standIn(p, restLoc[p], restCount[p]))
    return made
  }

  /** One stand-in per file for everything too thin to draw, in the shape the layout already
   *  makes for the same reason — see `rest` in `sunburst.ts`. It carries no children: those
   *  exist to be listed in the panel, and a frame's are a thousand objects a person cannot
   *  read while the story is running. */
  const standIn = (p: number, lines: number, count: number): Node => {
    const path = hist.paths[p]
    const kept = held.folded.get(p)
    const stand: Node =
      kept ??
      ({
        // **`#/folded`, and it must never be `#/rest`.** `tileFunctions` mints `${path}#/rest`
        // for the members IT cannot draw — and in a replay the members it is handed include
        // this stand-in, so both nodes arrived in one file's patch list under one id. React's
        // answer to a duplicate key is that children "may be duplicated and/or omitted": it
        // duplicated one, lost track of the copy, and never rendered it again. That copy is
        // the ghost — a wedge frozen at the commit it was born on, sitting outside the rings
        // while the map moves under it, cleared only by a remount.
        //
        // The `/` is the third party to that argument: a real function's id is `key_of`'s
        // `path#name`, so a file holding a function named `folded` mints this exact string
        // and neither roll-up is safe from it. No identifier in any language here can contain
        // a slash, which makes the two synthetic namespaces unreachable from the real one.
        ...dirNode(`${path}#/folded`, `${count}+`),
        kind: 'func' as const,
        path,
        lang: hist.langs[p] || null,
      } as Node)
    if (!kept) held.folded.set(p, stand)
    stand.name = `${count}+`
    stand.loc = lines
    stand.rest = count
    // **The file's own last committer, which is the resolution this node HAS.** Putting a
    // file's author on each of forty functions is wrong about thirty-nine; this is not one
    // of forty, it IS the file, standing in for everything the picture has no room to draw.
    stand.lastAuthor = authorName(hist, frame.author[p])
    stand.score = flashOnly(restBirth[p] === 1, restEdit[p] === 1)
    // Its own file's answer, in the shape a crowd's takes. It could be read off `lang` and
    // `lastAuthor` instead — this stand-in IS one file — but then `contribute` would need two
    // rules for one kind of node, and the one it reached for would depend on which sort of
    // roll-up had been built. One rule, one field.
    const t = tallyOf()
    add(t, p, lines, restKind)
    stand.folded = settle(t)
    return stand
  }

  /** And one per DIRECTORY for the files too thin to draw, which is the same rule one ring
   *  out and the whole reason a frame is now proportional to the picture.
   *
   *  Drawn as a file rather than as a directory: it holds no functions and can be descended
   *  into by nobody, which is what a file wedge with a roll-up count already means. The
   *  layout was throwing these away anyway — the "9,022 files too thin" note in the corner
   *  IS this population — so what changes is that the fold stops building them first. */
  const crowd = (
    d: number,
    lines: number,
    count: number,
    birth: boolean,
    edit: boolean,
    /** What it stands for, by value — see `Node.folded`. */
    folded: Folded,
  ): Node => {
    const path = `${shape.path[d]}#/files`
    const kept = held.crowd.get(d)
    const stand: Node =
      kept ??
      ({
        ...dirNode(path, ''),
        kind: 'file' as const,
        path: shape.path[d],
      } as Node)
    if (!kept) held.crowd.set(d, stand)
    stand.name = `${count.toLocaleString()} files`
    stand.loc = lines
    stand.rest = count
    stand.lastAuthor = null
    stand.score = flashOnly(birth, edit)
    // **The one thing it CAN say.** It has no author and no language of its own — it is a
    // hundred files — but it knows which languages and which people its lines belong to, and
    // a distribution built without that describes whatever was big enough to draw and calls
    // it the whole directory.
    stand.folded = folded
    return stand
  }

  /**
   * What a roll-up stands for, gathered as it is rolled up — see `Node.folded`.
   *
   * **Per FILE, and that is the whole reason this is affordable.** A language and an author
   * are facts about a file, so a fold that already visits every file it drops can total them
   * on the way past: the cost is one map hit per folded file, against the alternative of
   * materialising per-function columns for everything the picture is not drawing, which is
   * the work the fold exists to avoid. It is also the resolution the LIVE map uses whenever a
   * file's ring has not arrived — a file's author and its language are its own — so the two
   * pictures answer at the same grain rather than one of them guessing finer.
   */
  const tallyOf = () => ({
    lang: new Map<string, number>(),
    author: new Map<string, number>(),
    kind: new Map<string, number>(),
    time: [] as number[],
    tangle: [] as number[],
  })
  type Tally = ReturnType<typeof tallyOf>
  /** `kinds` is `fileKind` for a whole file and `restKind` for a drawn file's stand-in —
   *  the run that sums to `lines`. */
  const add = (t: Tally, p: number, lines: number, kinds: Float64Array) => {
    const kb = p * KIND_SLOTS
    for (let k = 0; k < KIND_SLOTS; k++) {
      const n = kinds[kb + k]
      if (n <= 0) continue
      const key = k < KIND_ORDER.length ? KIND_ORDER[k] : 'unplaced'
      t.kind.set(key, (t.kind.get(key) ?? 0) + n)
    }
    // Complexity first, because it is the shortest: the file's own mean and sum, or the
    // absence, in the same `TangleRow` shape `contribute` bands a drawn file by.
    const measured = fileTanLoc[p]
    const tangleRow: TangleRow = measured > 0
      ? [lines, fileTan0[p] / measured, fileTan1[p] / measured, fileCog[p]]
      : [lines, -1, -1, -1]
    t.tangle.push(...tangleRow)
    const lang = hist.langs[p]
    if (lang) t.lang.set(lang, (t.lang.get(lang) ?? 0) + lines)
    const who = authorName(hist, frame.author[p])
    // A file git has never seen is left out rather than folded into a name — the same thing
    // the live walk does with a missing author, one surface over.
    if (who) t.author.set(who, (t.author.get(who) ?? 0) + lines)
    // Counted at read time rather than carried, the same way a function's is: the window
    // moves with the playhead, so a touch that counted last frame may have aged out of this
    // one. See `Frame.pathHits`.
    const ts = frame.pathTs[p]
    const commits: ChurnWindows = [0, 0, 0, 0]
    if (ts !== NO_TS) {
      const base = p * CHURN_MEMORY
      const len = frame.pathHitLen[p]
      for (let i = 0; i < len; i++) {
        const age = daysBetween(frame.ts, frame.pathHits[base + i])
        for (let w = 0; w < 4; w++) if (age <= windows[w]) commits[w]++
      }
    }
    const born = frame.pathBorn[p]
    // **Typed as `TimeRow` rather than pushed loose, and that is the whole guard.** The reader
    // is in another file and steps by `TIME_STRIDE`; a row that is one number short does not
    // throw, it reads the next file's touch date as this one's line count and bands the frame
    // out of numbers that are all real and all in the wrong slots. Both ends are pinned to
    // this tuple, so the stride cannot move at one end only.
    const row: TimeRow = [
      ts === NO_TS ? -1 : daysBetween(frame.ts, ts),
      // `-1` is a file this story never saw ARRIVE, which is every file in the opening state:
      // undated, the same absence `pathTs` reports, and never dated to frame one. Age's second
      // reading needs it — see `AgeView`.
      born === NO_TS ? -1 : daysBetween(frame.ts, born),
      lines,
      ...commits,
    ]
    t.time.push(...row)
  }
  /** Every live file under `d`, for a directory that is being folded whole. */
  const foldDir = (t: Tally, d: number): void => {
    for (const p of shape.files[d]) {
      const lines = fileLoc[p]
      if (lines > 0) add(t, p, lines, fileKind)
    }
    for (const k of shape.kids[d]) foldDir(t, k)
  }
  const settle = (t: Tally): Folded => ({
    lang: [...t.lang.entries()],
    author: [...t.author.entries()],
    kind: [...t.kind.entries()],
    time: t.time,
    tangle: t.tangle,
  })

  /** Descend while there is something worth drawing, and roll up what there is not. */
  const walk = (d: number, into: Node): void => {
    let restLines = 0
    let restFiles = 0
    let restB = false
    let restE = false
    const rest = tallyOf()
    const cut =
      inScope && (forced.has(d) || shape.path[d].startsWith(`${scope}/`)) ? scopeMin : minLoc
    for (const k of shape.kids[d]) {
      const lines = dirLoc[k]
      if (lines <= 0) continue
      if (lines >= cut || forced.has(k)) {
        const node = dirNodeFor(k)
        into.children.push(node)
        walk(k, node)
        continue
      }
      restLines += lines
      restFiles += dirFiles[k]
      foldDir(rest, k)
      restB = restB || dirBirth[k] === 1
      restE = restE || dirEdit[k] === 1
    }
    for (const p of shape.files[d]) {
      const lines = fileLoc[p]
      if (lines <= 0) continue
      if (lines >= cut) {
        into.children.push(fileNodeFor(p))
        continue
      }
      restLines += lines
      restFiles += 1
      add(rest, p, lines, fileKind)
      const born = frame.pathBornAt[p]
      restB = restB || restBirth[p] === 1 || (born !== NO_AT && inStep(born, since, frame.at))
      restE = restE || restEdit[p] === 1
    }
    if (restLines > 0) {
      into.children.push(crowd(d, restLines, restFiles, restB, restE, settle(rest)))
    }
  }
  walk(0, root)

  // Containers are keyed by path, and a file's or directory's node id IS its path — which
  // is what lets a container ask the frame directly when it arrived instead of inheriting an
  // answer from the functions inside it.
  aggregate(root, (id) => {
    // A dir first, then a file: the two namespaces are disjoint — a node id IS its path —
    // and asking the shape rather than the frame is what lets both be dense.
    const d = shape.dirAt.get(id)
    let at = d !== undefined ? frame.dirBornAt[d] : NO_AT
    if (at === NO_AT) {
      const p = pathIndex.get(id)
      if (p !== undefined) at = frame.pathBornAt[p]
    }
    return at !== NO_AT && inStep(at, since, frame.at) ? 1 : null
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
