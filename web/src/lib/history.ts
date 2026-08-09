import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Node, Progress, Score } from './api'

/**
 * The repo replayed, commit by commit.
 *
 * Mirrors `history.rs`, and carries the one rule that module exists to enforce:
 * **surprise is not replayed.** A temperature is a reading taken against the code as it
 * is today, and stamping it onto the same function's 2019 body would be the map claiming
 * a measurement nobody took. What colours a frame is recency — how long, as of *that
 * frame's own date*, since anyone touched this — which is a fact about the commit stream
 * and nothing else. That is why history mode pins the encoding and disables the lens
 * switcher rather than offering five readings of which one would be a lie.
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

export interface HistoryScan {
  paths: string[]
  langs: string[]
  funcs: HistoryFunc[]
  base: [number, number][]
  baseTs: number
  commits: HistoryCommit[]
  /** The commit the last frame is, for the cache's benefit. */
  head: string
  /** Commits before the window, folded into `base`. Shown, never swallowed: a timeline
   *  that quietly starts in the middle reads as the whole life of the repo. */
  truncated: number
}

export function scanHistory(path: string, limit?: number): Promise<HistoryScan> {
  return invoke<HistoryScan>('scan_history', { path, limit })
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

/** Days between two epoch-second stamps, never negative. */
function daysBetween(now: number, then: number): number {
  return Math.max(0, (now - then) / 86_400)
}

/** Commits inside this window count towards a frame's churn — the same 90 days
 *  `churn.rs` uses, so the number means the same thing in both views. */
const CHURN_WINDOW_DAYS = 90
/** Commits in the window at which a file counts as fully churning. Absolute, matching
 *  `churn::CHURN_SATURATION`; normalising against the repo's own busiest file is the trap
 *  that module is written up against. */
const CHURN_SATURATION = 8
/** Touches remembered per function. Past `CHURN_SATURATION` the churn scale is pinned, so
 *  a deeper memory costs bytes and answers nothing. */
const CHURN_MEMORY = 16

/** What the repo looked like after one commit. */
interface Frame {
  /** func index → lines. */
  loc: Map<number, number>
  /** func index → when it was last touched. */
  touched: Map<number, number>
  /** func index → when it first appeared *within the replayed window*. */
  born: Map<number, number>
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
function opening(hist: HistoryScan): Frame {
  const frame: Frame = {
    loc: new Map(),
    touched: new Map(),
    born: new Map(),
    hits: new Map(),
    author: new Map(),
    ts: hist.baseTs,
    at: -1,
  }
  for (const [f, loc] of hist.base) {
    frame.loc.set(f, loc)
    // Deliberately NOT marked as touched or born. Everything here predates the window, so
    // the only honest thing to say about when it was last written is that we do not know —
    // and an undated function draws uncoloured rather than being dated to the start of the
    // window, which would make the opening frame flare as though somebody had just written
    // the entire repo.
  }
  return frame
}

/** Apply commits `(frame.at, to]` in place. */
function advance(frame: Frame, hist: HistoryScan, to: number): void {
  for (let i = frame.at + 1; i <= to && i < hist.commits.length; i++) {
    const c = hist.commits[i]
    for (const [f, loc] of c.set) {
      frame.loc.set(f, loc)
      frame.touched.set(f, c.ts)
      if (!frame.born.has(f)) frame.born.set(f, c.ts)
      const seen = frame.hits.get(f)
      if (seen) {
        seen.push(c.ts)
        if (seen.length > CHURN_MEMORY) seen.shift()
      } else {
        frame.hits.set(f, [c.ts])
      }
    }
    for (const f of c.del) {
      frame.loc.delete(f)
      frame.touched.delete(f)
      frame.born.delete(f)
      frame.hits.delete(f)
    }
    for (const p of c.files) frame.author.set(p, c.author)
  }
  frame.at = Math.min(to, hist.commits.length - 1)
  frame.ts = hist.commits[Math.max(0, frame.at)]?.ts ?? hist.baseTs
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
let memo: { hist: HistoryScan; frame: Frame } | null = null

function replay(hist: HistoryScan, index: number): Frame {
  if (memo && memo.hist === hist && memo.frame.at <= index) {
    advance(memo.frame, hist, index)
    return memo.frame
  }
  const frame = opening(hist)
  advance(frame, hist, index)
  memo = { hist, frame }
  return frame
}

/** A function's score as of one frame, written into `into` when there is one to reuse.
 *
 *  Every field it cannot honestly fill is left at the value that means "no claim":
 *  surprise stays 0 with `analyzedShare` 0, which is exactly what `isAnalyzed` refuses to
 *  colour. */
function scoreInto(into: Score | null, frame: Frame, f: number): Score {
  const touched = frame.touched.get(f)
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
  return s
}

/** Roll child lines and dates up a container, the same way `Node::aggregate` does in
 *  Rust: LOC-weighted, oldest child for age, newest for last-touched. Written here rather
 *  than reused because the Rust one runs inside the scan and this tree never goes near
 *  it. */
function aggregate(node: Node): void {
  if (node.children.length === 0) return
  for (const c of node.children) aggregate(c)
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
    score: null,
    body: null,
    hotspots: [],
    children: [],
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
let pool: { hist: HistoryScan; nodes: Map<number, Node> } | null = null

/**
 * The tree for one frame, in exactly the shape the sunburst already draws.
 *
 * Built rather than patched onto the live scan: the two trees hold different functions —
 * that is the entire point of a timeline — and reusing the live one would mean deciding
 * what to do with every function that does not exist yet. A separate tree has no such
 * question to get wrong.
 */
export function frameTree(hist: HistoryScan, index: number, repoName: string): Node {
  const frame = replay(hist, index)
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

  // In interned order, which is the order functions first appeared — so a file's wedges
  // stay in one order for the whole replay instead of resorting themselves every frame.
  for (const [f, loc] of [...frame.loc].sort((a, b) => a[0] - b[0])) {
    const def = hist.funcs[f]
    const file = fileFor(def.path)
    let node = nodes.get(f)
    if (!node) {
      node = {
        id: `${hist.paths[def.path]}#${def.name}#${f}`,
        name: def.name,
        kind: 'func',
        path: hist.paths[def.path],
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
      }
      nodes.set(f, node)
    }
    // Only what a frame can change. Identity, path and language are properties of the
    // function, not of the moment — a pooled node that rewrote them every frame would be
    // a fresh allocation wearing a cache's clothes.
    node.loc = loc
    node.lastAuthor = frame.author.get(def.path) ?? null
    node.score = scoreInto(node.score, frame, f)
    file.children.push(node)
  }

  aggregate(root)
  return collapse(root)
}

/**
 * The commits that touched anything under `scope`, as indices into `hist.commits`.
 *
 * Drilling into a directory asks a narrower question — "how did THIS come to be" — and the
 * transport has to answer it, or the scrub bar spends most of its length on commits that
 * change nothing you can see. `''` is the whole repo and returns every commit.
 *
 * A view of the timeline, never a re-fold of it. The rings for a given commit are still
 * built from the full replay: a commit outside the scope cannot change what is inside it,
 * so filtering is safe for what is DRAWN — but folding only the scoped commits would give
 * the frame the wrong date, and the date is what the colour means here. So the scoped list
 * addresses real commits, and the frame is always the real one.
 */
export function scopedCommits(hist: HistoryScan, scope: string): number[] {
  const all = hist.commits.map((_, i) => i)
  if (!scope) return all
  // Segment-boundary match, so `web/src` does not take in `web/src-old`.
  const inScope = hist.paths.map((p) => p === scope || p.startsWith(`${scope}/`))
  return all.filter((i) => hist.commits[i].files.some((f) => inScope[f]))
}

/** Where a real commit index sits in a scoped list: the last scoped commit at or before
 *  it, or -1 for "before this scope had happened yet". */
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

