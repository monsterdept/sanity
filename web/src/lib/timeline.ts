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

export interface Tables {
  paths: string[]
  /** Which paths `.sanityignore` sets aside, parallel to `paths`. Drawn out of the frame the
   *  same way they are drawn out of the live map — see `pruneExcluded`. */
  excluded: boolean[]
  langs: string[]
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

  constructor(path: string) {
    this.path = path
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
      this.pending = historyDeltas(this.path, from, BLOCK).then((got) => {
        // A short read is the end of the story, not a failure — but it must still extend the
        // run, or `ensure` would ask for the same block forever.
        this.blocks.push(got)
        this.pending = null
        onProgress?.(this.have())
      })
      await this.pending
      // The end of the timeline. Anything past it cannot be folded because it does not exist.
      if (this.blocks[this.blocks.length - 1].length < BLOCK) return
    }
  }
}
