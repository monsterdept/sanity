import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ChurnWindows, Node, Progress } from './api'
import {
  arrivalOf,
  collapse,
  descend,
  dirNode,
  sizeDirs,
  sizeFiles,
  startBuild,
} from './historyBuild'
import { replay } from './historyFrame'
import { aggregate } from './historyScore'
import { scopeOf } from './historyShape'
import type { Deltas, Tables } from './timeline'

/**
 * The replay as the window sees it: the calls that trace a repo's history and keep its
 * timeline, the wire shapes they return, and the questions the window asks of a timeline —
 * the tree for one frame (`frameTree`), the languages it has ever held, each path's size at
 * HEAD, and where a scoped position lands.
 *
 * The machinery behind a frame lives beside this file, one job to each:
 *
 * - The fold, in `historyFrame.ts`: commits applied to a dense frame, and the checkpoints a
 *   seek thaws.
 * - The paths, in `historyShape.ts`: the directory tree and scope lookups, interned once.
 * - The scores, in `historyScore.ts`: what a frame says about one function or container.
 * - The tree, in `historyBuild.ts`: pooled nodes, built top-down, with roll-up stand-ins for
 *   what is too thin to draw.
 */

export { cost } from './historyFrame'

/**
 * One function as the replay knows it: the identity every commit's deltas index into.
 *
 * Mirrors `history.rs`, and carries the rule that module exists to enforce: **a frame
 * paints what the repo knew about itself at that commit, and nothing it did not.** Stamping
 * today's reading onto the same function's 2019 body would be the map claiming a
 * measurement nobody took. Readings still replay, because `.sanity/` is committed: a
 * commit's `read` carries the grades that existed then, and a body nobody had read yet
 * draws as unread. What cannot replay is the call graph (Clones, Callers and Reach, which
 * is `REPLAY` in `colorMode.ts`), and those lock one lens at a time rather than the whole
 * switcher. See docs/notes/history.md.
 *
 * **The commit under the playhead flashes what it created and what it touched**, for
 * exactly as long as the step the playhead just took (see `inStep`). Recency was tried as
 * a colour first and failed every way. In DAYS it flickers, because commit streams are
 * bursty: a quiet fortnight ages every function at once, so the whole picture changes
 * colour on a frame where one file was edited. Rescaling the ramp per frame made it worse,
 * the scale itself moving under the picture. In COMMITS it held still and was still noise,
 * a fading ramp saying "somewhat recently" about most of the map. Arrival is what somebody
 * watching a replay is looking for, so arrival is what flashes.
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

/** Read more of a repo's history onto the MAP, because the person asked.
 *
 *  Not the replay — that is `scanHistory` above, which is depth 3. This is the commit log
 *  (`files`: age, churn and authors per file) and per-line blame (`lines`: the same facts per
 *  function). Omitted means one step on from wherever this repo is. Resolves with what it
 *  actually took, in seconds, which is the only place the app learns whether its own estimate
 *  was close. */
export function traceProject(path: string, depth?: 'files' | 'lines'): Promise<number> {
  return invoke<number>('trace_project', { path, depth })
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

/**
 * The tree for one frame, in exactly the shape the sunburst already draws: a root named for
 * the repo, the directories and files the picture has room for, the functions thick enough to
 * be wedges, and a roll-up stand-in — carrying a tally of what it folded — wherever something
 * is too thin to draw.
 *
 * Built rather than patched onto the live scan: the two trees hold different functions —
 * that is the entire point of a timeline — and reusing the live one would mean deciding
 * what to do with every function that does not exist yet. A separate tree has no such
 * question to get wrong.
 *
 * Five phases, each a function below and each reading what the one before it wrote into a
 * `Build`: fold the timeline to the commit, size every file from its live functions
 * (`sizeFiles`), total those sizes up the directory chain (`sizeDirs`), descend from the root
 * while a subtree is worth drawing (`descend`), and score and collapse what was built.
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
  if (!flashes) since = index
  const b = startBuild(hist, frame, since, scope, density, windows)
  sizeFiles(b)
  sizeDirs(b)
  // **The root is the one allocation, and it has to be.** Every memo downstream keys on it,
  // so a stable root would hold the picture still while the data moved underneath — see the
  // pool's own note.
  const root = dirNode('', repoName)
  descend(b, 0, root)
  // Containers are keyed by path, and a file's or directory's node id IS its path — which
  // is what lets a container ask the frame directly when it arrived instead of inheriting an
  // answer from the functions inside it.
  aggregate(root, arrivalOf(b))
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
