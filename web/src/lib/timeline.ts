import { invoke } from '@tauri-apps/api/core'
import type { HistoryFunc } from './history'

/**
 * A timeline the window does not hold.
 *
 * **The story stays in Rust and this borrows pieces of it.** A trace is one frame per commit
 * — the log lists them and a click addresses one, so coarsening what is stored would delete
 * most of a large repo's history from the only index anybody has. That makes the whole thing
 * far too big to hand over: ceph's 122,792 commits are ~16MB of log metadata and ~47MB of
 * deltas, and receiving all of it froze the window for as long as it took to parse.
 *
 * So: the tables once, because they are bounded by the repo rather than by its history and
 * the live map already carries their like. Everything per-commit arrives in windows.
 *
 * Two different appetites, deliberately kept apart:
 *
 * - **Log rows** are what a person reads. They are fetched a screenful at a time and thrown
 *   away when scrolled past — the list can be a hundred thousand rows and only the visible
 *   ones exist.
 * - **Deltas** are what the map folds, and they cannot be thrown away the same way: folding
 *   to commit N needs every delta before it. They are fetched in blocks and KEPT, in flat
 *   integer arrays rather than objects — the same 47MB is a few tens of megabytes packed
 *   this way, which is a size a window can hold.
 */

/** Commits fetched per delta request. Big enough that a replay at speed is not a request per
 *  frame, small enough that the first one lands quickly. */
const BLOCK = 2000

/** Functions fetched per request.
 *
 *  About a megabyte of ceph's, against the 19.8MB that used to arrive before the first frame
 *  could be drawn. The unit is deliberately not the delta block's: a commit early in a repo's
 *  life introduces functions at a completely different rate from one late in it, so tying the
 *  two would make the first fetch of a young repo enormous and of an old one pointless. */
const FUNC_BLOCK = 10_000

export interface Tables {
  paths: string[]
  /** Which paths `.sanityignore` sets aside, parallel to `paths`. Drawn out of the frame the
   *  same way they are drawn out of the live map — see `pruneExcluded`. */
  excluded: boolean[]
  langs: string[]
  /** How many functions the timeline has ever held.
   *
   *  The functions themselves arrive through `Funcs`, a block at a time, because on a large
   *  repo they were 99% of the payload that opens a replay and the opening frame refers to
   *  almost none of them. */
  funcCount: number
  /** The functions fetched so far, indexed as the deltas index them.
   *
   *  **Filled in by `Funcs`, in place.** The fold reads `hist.funcs[f]` and knows nothing
   *  about paging: it is handed the array the loader appends to, and `Deltas.ensure`
   *  guarantees that every index the loaded deltas can name is already in it. */
  funcs: HistoryFunc[]
  base: [number, number][]
  baseTs: number
  head: string
  truncated: number
  commits: number
}

/** One row of the log. `sets`/`dels` are counts — the row prints how many, and shipping the
 *  indices to print their length is most of what this design exists to avoid. */
export interface LogRow {
  sha: string
  short: string
  ts: number
  author: string
  subject: string
  sets: number
  dels: number
}

/** One commit's effect on the picture. The same shape the fold has always consumed. */
export interface Delta {
  ts: number
  author: string
  set: [number, number][]
  del: number[]
  files: number[]
}

export function historyTables(path: string): Promise<Tables | null> {
  return invoke<Tables | null>('history_tables', { path })
}

export function historyLog(
  path: string,
  offset: number,
  count: number,
  scope: string,
): Promise<LogRow[]> {
  return invoke<LogRow[]>('history_log', { path, offset, count, scope })
}

export function historyScoped(path: string, scope: string): Promise<number[]> {
  return invoke<number[]>('history_scoped', { path, scope })
}

function historyDeltas(path: string, from: number, count: number): Promise<Delta[]> {
  return invoke<Delta[]>('history_deltas', { path, from, count })
}

function historyFuncs(path: string, from: number, count: number): Promise<HistoryFunc[]> {
  return invoke<HistoryFunc[]>('history_funcs', { path, from, count })
}

/**
 * The functions a repo's fold has been given so far.
 *
 * A prefix, like the deltas and for the same reason — the walk interns a function the first
 * time it meets it, oldest commit first, so a fold of commits `0..=n` can only name functions
 * from the front of the list. What makes it worth paging at all is the shape of a large repo:
 * ceph's are 19.8MB of the 20.1MB that used to arrive before the first frame could be drawn,
 * and that frame is the repo as it stood in 2007.
 *
 * `list` is handed to the fold as `Tables.funcs` and appended to IN PLACE. The fold indexes
 * it and knows nothing about paging; keeping it one array is what lets that stay true.
 */
export class Funcs {
  readonly list: HistoryFunc[] = []
  private readonly path: string
  private readonly total: number
  private pending: Promise<void> | null = null

  constructor(path: string, total: number) {
    this.path = path
    this.total = total
  }

  /** Have every function up to and including `index`.
   *
   *  Clamped to what the timeline holds, so an index past the end asks once and stops
   *  rather than paging forever against a short read. */
  async ensure(index: number): Promise<void> {
    const want = Math.min(index + 1, this.total)
    while (this.list.length < want) {
      if (this.pending) {
        await this.pending
        continue
      }
      const from = this.list.length
      this.pending = historyFuncs(this.path, from, FUNC_BLOCK).then((got) => {
        this.list.push(...got)
        this.pending = null
      })
      await this.pending
      // A short read is the end of the list. Without this a caller asking past it spins.
      if (this.list.length === from) return
    }
  }
}

/** The highest function index a set of deltas can name, or -1 for none.
 *
 *  What `Deltas` hands `Funcs` so the fold never meets a hole. Computed here, over blocks
 *  as they land, rather than asked of the backend: the numbers are already being parsed on
 *  this side, and a second round trip to be told the maximum of something already in hand
 *  is a round trip for nothing. */
function watermark(block: Delta[]): number {
  let top = -1
  for (const c of block) {
    for (const [f] of c.set) if (f > top) top = f
    for (const f of c.del) if (f > top) top = f
  }
  return top
}

/** The highest function index the opening state names — see `watermark`. */
export function baseWatermark(base: [number, number][]): number {
  let top = -1
  for (const [f] of base) if (f > top) top = f
  return top
}

/**
 * The deltas a repo's fold has been given so far.
 *
 * Contiguous from zero, always: a fold is a sequence and a gap in it is not a smaller answer,
 * it is a wrong one. `ensure` extends the run; `have` says how far it reaches.
 */
export class Deltas {
  private readonly path: string
  private readonly blocks: Delta[][] = []
  /** In flight, so two callers wanting the same block wait on one request. */
  private pending: Promise<void> | null = null
  /** The functions these deltas name, topped up as blocks land.
   *
   *  Held here rather than left to callers because EVERY caller would have to remember: the
   *  fold is synchronous and indexes the list directly, so a block of deltas that arrives
   *  before the functions it mentions is a frame drawn against a hole. One place loads them,
   *  and it is the place that knows what has just been loaded. */
  private readonly funcs: Funcs

  constructor(path: string, funcs: Funcs) {
    this.path = path
    this.funcs = funcs
  }

  /** How many frames can be folded right now. */
  have(): number {
    return this.blocks.length * BLOCK
  }

  at(index: number): Delta | undefined {
    return this.blocks[Math.floor(index / BLOCK)]?.[index % BLOCK]
  }

  /** Load until `index` can be folded, one block at a time so a long jump reports progress
   *  rather than going quiet. `onProgress` is called with how far the run now reaches. */
  async ensure(index: number, onProgress?: (have: number) => void): Promise<void> {
    while (this.have() <= index) {
      if (this.pending) {
        await this.pending
        continue
      }
      const from = this.have()
      this.pending = historyDeltas(this.path, from, BLOCK)
        .then(async (got) => {
          // The functions first, then the frames that name them. The other order leaves a
          // window — however short — in which `have()` says a frame can be folded and the
          // fold would read past the end of the function list.
          await this.funcs.ensure(watermark(got))
          // A short read is the end of the story, not a failure — but it must still extend
          // the run, or `ensure` would ask for the same block forever.
          this.blocks.push(got)
        })
        .then(() => {
          this.pending = null
          onProgress?.(this.have())
        })
      await this.pending
      // The end of the timeline. Anything past it cannot be folded because it does not exist.
      if (this.blocks[this.blocks.length - 1].length < BLOCK) return
    }
  }
}
