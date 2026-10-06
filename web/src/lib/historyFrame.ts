import { shapeOf, type Shape } from './historyShape'
import type { Deltas, Tables } from './timeline'

/**
 * The fold: what the repo looked like after one commit, and how the window gets there.
 *
 * A `Frame` is dense typed arrays, one slot per function, path and directory, each absence a
 * sentinel. `advance` applies commits to one in place; `replay` reaches any commit by stepping
 * the last frame forward or thawing the nearest checkpoint, which this file also banks. Nothing
 * here builds a node — that is `historyBuild.ts`, which reads the frame this returns.
 */

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
export function daysBetween(now: number, then: number): number {
  return Math.max(0, (now - then) / 86_400)
}

/** Touches remembered per function. Past `CHURN_SATURATION` the churn scale is pinned, so
 *  a deeper memory costs bytes and answers nothing. */
export const CHURN_MEMORY = 16

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
export const NO_TS = 0xffffffff
export const NO_AT = -1
export const NO_GRADE = 0xffff

/** No cognitive score for this function in this frame.
 *
 *  **Not zero, which is a real and common score** — most short bodies never branch, and a
 *  band whose median is zero is the ordinary case in the smallest band. What this means is
 *  that nobody has taught the parser to count this language, which the lens draws in the
 *  structural neutral rather than at the cold end of the ramp. A `Uint32Array` because a
 *  generated file can carry more forks than a `Uint16` holds, and the sentinel has to sit
 *  outside every score that is real. */
export const NO_COG = 0xffffffff
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
export function authorName(hist: Tables, id: number): string | null {
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
export interface Frame {
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
  /** func index → lines of code in the body AT this commit — what `cog` is banded against. Set
   *  and cleared with `cog`. */
  nc: Uint32Array
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
    nc: new Uint32Array(n),
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
  for (const [f, n, nc] of hist.baseCog ?? []) {
    frame.cog[f] = n
    frame.nc[f] = nc
  }
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
      frame.nc[f] = 0
      frame.hitLen[f] = 0
    }
    for (const [f, packed] of c.read ?? []) frame.graded[f] = packed
    for (const f of c.unread ?? []) frame.graded[f] = NO_GRADE
    // No `uncog`: the only thing that withdraws a score is the function leaving, which `del`
    // above already clears. A reading can be withdrawn while its function stays — somebody
    // deletes a shard — and complexity has no such second source to lose.
    for (const [f, n, nc] of c.cog ?? []) {
      frame.cog[f] = n
      frame.nc[f] = nc
    }
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
  nc: Uint32Array
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
    nc: frame.nc.slice(),
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
    nc: cp.nc.slice(),
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
    cp.nc.byteLength +
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

export function replay(hist: Tables, deltas: Deltas, index: number): Frame {
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
