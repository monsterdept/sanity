import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  agentActivity,
  agentReports,
  listProjects,
  projectScan,
  selectProject,
  applyAgentReports,
  applyScores,
  readIntoRing,
  fileFunctions,
  pruneExcluded,
  countPending,
  type Added,
  type AgentReport,
  estimateTrace,
  explainTrace,
  stopTrace,
  setExplainTrace,
  type TraceCost,
  cliStatus,
  type CliState,
  forgetProject,
  resetProject,
  harnesses,
  installCli,
  onInstallCli,
  onOpenProject,
  pickProject,
  repoRemote,
  scanRepo,
  onSetTheme,
  syncThemeMenu,
  onScanScore,
  onScanProgress,
  openCodeWindow,
  type Hit,
  type Node,
  type Progress,
  type AgentActivity,
  type ProjectSummary,
  type Scan,
  type Upgrade,
} from './lib/api'
import {
  frameTree,
  headSizes,
  historyLangs,
  onHistoryProgress,
  scanHistory,
  traceProject,
  warmHistory,
} from './lib/history'
import {
  Deltas,
  Funcs,
  baseWatermark,
  historyScoped,
  historyTables,
  type Tables,
} from './lib/timeline'
import { Sunburst } from './components/Sunburst'
import type { MovieKey, Staged } from './lib/movie'
import { forgetMonster } from './lib/monster'
import { onScanShape, shapeTree, type ShapeFile } from './lib/shape'
import type { MascotState } from './components/MascotFigure'
import { CommitLog } from './components/CommitLog'
import { HistoryBar } from './components/HistoryBar'
import { Crumbs } from './components/Crumbs'
import { Find } from './components/Find'
import { TopRow } from './components/shell/TopRow'
import { rampStop } from './lib/api'
import {
  legendFor,
  MODE_LABEL,
  paintsFromReadings,
  paintsFromWiring,
  NAMED,
  RAMP_ENDS,
  rampOf,
  rankCategories,
  capRanks,
  REPLAY,
  slotColor,
  replayNote,
  ageSpanOf,
  type ColorMode,
} from './lib/colorMode'
import { actOf } from './lib/keys'
import { dismissSplash } from './lib/splash'
import { mark, marked } from './lib/stopwatch'
import { loadTheme, saveTheme, watchSystemTheme, type Theme } from './lib/theme'
import { CodeView } from './components/CodeView'
import { ColorLegend, Lock, ModeSwitcher, type Locked } from './components/ColorKey'
import { Detail } from './components/Detail'
import { SideBar } from './components/SideBar'
// The pill's own answer to "what does pressing Trace do next" — see `chaseTrace`,
// which walks the column rather than re-deriving the ladder from `trace_depth`.
import { phasesOf } from './components/Phases'
import { Overlay } from './components/Overlay'
import { HelpButton, LensHelp } from './components/LensHelp'
import { BandWidth, ColorCount, RingCount } from './components/Rings'
import { loadRings, saveRings } from './lib/rings'
import { isCapped, loadCap, saveCap, type Capped } from './lib/palette'
import { ReadDialog } from './components/ReadDialog'

/** Files that have to have arrived before the assembling map is drawn — see `shapeRoot`. */
const SHAPE_FLOOR = 24

/** How long a wedge stays lit after the scan touched it — see `live`.
 *
 *  One full cycle of `wedge-reading`, which is what draws it. Shorter and a wedge is
 *  yanked off screen mid-pulse, which reads as flicker rather than as a sweep; much longer
 *  and the outer ring is uniformly lit and says nothing about where the work is. */
const LIVE_MS = 1400

/** Handlers the assembling map has no use for: it is a picture of a scan in progress, and
 *  there is nothing under a wedge to select, drill into or clear yet. */
const noop = () => {}

/** Do two project lists say the same thing?
 *
 *  Field by field rather than by identity, because the poll that produces them allocates a
 *  new array of new objects every time regardless — identity can only ever say "different".
 *  Everything the sidebar draws is compared; anything not compared here is something the
 *  sidebar must not be showing. */
/** The wave, as far as anything on screen is concerned.
 *
 * **Its absence from the comparison froze the whole agent panel.** A run starting, a reader
 * spawning, `live` counting down to zero — none of it touches `assessed` or any other field
 * compared here, so the poll judged the list unchanged, kept the previous objects, and the
 * panel went on describing a run that had already finished. That is both halves of "it takes
 * a second to say WORKING" and "it takes forever to stop": the readers were long dead and
 * the numbers on screen were from whenever a reading last landed.
 *
 * Compared field by field rather than by identity, because the poll builds a fresh object
 * every tick — comparing references would be the same as not comparing at all, which is the
 * mistake `activeProject` already taught this file once. */
function sameRun(a: ProjectSummary['run'], b: ProjectSummary['run']): boolean {
  if (!a || !b) return a === b
  return (
    a.running === b.running &&
    a.stopping === b.stopping &&
    a.live === b.live &&
    a.spawned === b.spawned &&
    a.finished === b.finished &&
    a.failed === b.failed &&
    a.readers === b.readers &&
    a.ended === b.ended
  )
}

/** Two id lists, in order. Absent counts as empty — see the call site. */
function sameIds(a?: string[], b?: string[]): boolean {
  const x = a ?? []
  const y = b ?? []
  return x.length === y.length && x.every((id, i) => id === y[i])
}

/** Two progress reports, or two absences. `null` and a report are never the same thing: that
 *  transition is a trace starting or ending, which is the moment the row has to redraw. */
function sameProgress(a?: Progress | null, b?: Progress | null): boolean {
  if (!a || !b) return !a && !b
  return a.done === b.done && a.total === b.total && a.phase === b.phase && a.unit === b.unit
}

/** Where a trace has got to, as one string.
 *
 *  `chaseTrace`'s only test for "did that step accomplish anything". Every way a step can end
 *  without finishing its phase — the user pressed Stop, the walk hit a rewritten history, a
 *  blame pass banked short — comes back as this being unchanged, and one press must never turn
 *  into a loop that keeps restarting a pass somebody just stopped. Cheaper and more honest than
 *  asking each phase how it ended: a phase that made no progress has nothing to chain to,
 *  whatever the reason was. */
function traceSig(p: ProjectSummary): string {
  return `${p.trace_depth}|${p.resolved}/${p.resolvable}|${p.replayed}/${p.commits}`
}

/** Fields whose equality is more than identity. Everything else compares with `Object.is`.
 *
 *  **A short list of exceptions, not a long list of inclusions**, and the difference is the
 *  whole point — see [`sameProjects`]. */
const DEEPLY: {
  [K in keyof ProjectSummary]?: (a: ProjectSummary[K], b: ProjectSummary[K]) => boolean
} = {
  reading: sameIds,
  run: sameRun,
  tracing: sameProgress,
  tracing_history: sameProgress,
  trace_cost: sameCost,
  scan_cost: sameCost,
  banked_models: (a, b) =>
    sameIds(
      a?.map((m) => `${m.model}:${m.readings}`),
      b?.map((m) => `${m.model}:${m.readings}`),
    ),
  // **The reading ticker, and it is `seq` alone by design.** Every entry is append-only and
  // stamped with a monotonic sequence, so the last one having the same number means nothing
  // behind it moved either. Comparing the whole array would be several hundred string
  // comparisons twice a second to learn what one integer already says.
  //
  // It carries its own weight here for a reason the old hand-written conjunction shows: this
  // field was not in it at ALL, and under a rule that compares whatever it finds, an
  // array freshly allocated by every poll is never equal to itself. That is not a missing
  // update, it is the opposite — the list would read as changed on every tick and re-render
  // every row forever, which during a replay is the periodic stutter `history.rs` is written
  // against. An exceptions list only works if the exceptions are actually all there.
  events: (a, b) =>
    (a?.length ?? 0) === (b?.length ?? 0) &&
    (a?.[a.length - 1]?.seq ?? -1) === (b?.[b.length - 1]?.seq ?? -1),
}

/** The two cost estimates, which are small flat objects and freshly allocated every poll. */
function sameCost(
  a?: { seconds: number; cold: boolean; fits: boolean } | null,
  b?: { seconds: number; cold: boolean; fits: boolean } | null,
): boolean {
  if (!a || !b) return !a && !b
  const n = (v: unknown) => (typeof v === 'number' ? v : null)
  return (
    a.seconds === b.seconds &&
    a.cold === b.cold &&
    a.fits === b.fits &&
    // `commits` on a trace cost, `files` on a scan cost — the one field that differs between
    // them, read structurally rather than by naming both.
    n((a as { commits?: number }).commits) === n((b as { commits?: number }).commits) &&
    n((a as { files?: number }).files) === n((b as { files?: number }).files)
  )
}

/** Has the project list actually changed?
 *
 *  The poll runs every 1.5s and `listProjects` allocates fresh objects each time, so storing
 *  the answer unconditionally re-renders every row — and during a replay that rebuilt several
 *  thousand arcs on a fixed period, which is the periodic stutter `history.rs` warns about.
 *  So the list is compared before it is stored.
 *
 *  **Every field this forgets is a number frozen on screen, and it forgot seven.** This was a
 *  hand-written conjunction of the fields somebody thought mattered, and it has now been wrong
 *  three times in the same way — twice recorded in its own comments, and once more for the
 *  whole of the trace: `tracing_history`, `trace_depth`, `trace_cost`, `resolved`, `resolvable`,
 *  `behind` and `scan_cost` were all absent, so a running trace fetched a fresh counter every
 *  tick, this said "same", the array was dropped, and the row showed the estimate it had been
 *  offered before anybody pressed anything. The pill stayed pressed for the same reason: it
 *  clears on the project object changing, and the project object never changed.
 *
 *  So it is not a list of fields any more. It walks whatever the row HAS and compares each key,
 *  which inverts the failure: a field added to `ProjectSummary` and forgotten here is now
 *  compared by default — at worst an extra re-render — where before it was silently ignored and
 *  froze on screen. Only the fields that need more than `Object.is` are named, in [`DEEPLY`],
 *  and those are the ones with a shape somebody would notice writing.
 *
 *  Keys from BOTH sides, because a backend that predates a field omits it: comparing only `a`'s
 *  keys would miss the tick where it first appears. */
function sameProjects(a: ProjectSummary[], b: ProjectSummary[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => {
    const q = b[i]
    if (!q) return false
    const keys = new Set([...Object.keys(p), ...Object.keys(q)]) as Set<keyof ProjectSummary>
    for (const k of keys) {
      const deep = DEEPLY[k] as ((x: unknown, y: unknown) => boolean) | undefined
      if (deep ? !deep(p[k], q[k]) : !Object.is(p[k], q[k])) return false
    }
    return true
  })
}

/** Find a node by id so the drill-in stack survives a rescan — the user's position in the
 *  tree shouldn't reset just because they re-ran the scan. */
function findById(node: Node, id: string): Node | null {
  if (node.id === id) return node
  for (const c of node.children) {
    const hit = findById(c, id)
    if (hit) return hit
  }
  return null
}

/** The node one level up from `id`, or null at the root.
 *
 *  "Up" has to mean the tree's parent, not the previous stack entry. Drilling is a JUMP
 *  — double-clicking a file three rings out pushes a single entry — so popping the stack
 *  undoes the whole jump and lands you back at the top, however deep you had gone. */
/** A cheap fingerprint of a poll's readings, for deciding whether anything actually moved.
 *
 *  **The readings poll runs every two seconds and fetches all of them** — 16,925 on tonepoet
 *  — so whatever consumes it has to be able to say "same as last time" without rebuilding
 *  anything. Storing them unconditionally would re-graft every function ring on a fixed
 *  period, which is precisely the periodic stutter a replay makes visible.
 *
 *  Covers what can CHANGE a wedge: which readings exist, the body each was taken against, and
 *  the grades. Deliberately not `found` or `note` — they are paragraphs, and hashing a
 *  megabyte of prose twice a second to learn nothing is the cost this exists to avoid. A
 *  reading whose prose changed but whose grades did not paints identically.
 *
 *  FNV-1a, which is what `assessment` uses on the Rust side for the same kind of job. */
function readingSignature(reports: AgentReport[]): string {
  let h = 0x811c9dc5
  for (const r of reports) {
    const part = `${r.id}|${r.at ?? ''}|${r.body ?? ''}|${r.predicted ?? ''}|${r.documented ?? ''}|${r.legible ?? ''}|${r.trap ?? ''}|${r.derivable ?? ''}|${r.legibleDated ?? ''}|${r.trapDated ?? ''}`
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  return `${reports.length}:${h >>> 0}`
}

function parentOf(node: Node, id: string): Node | null {
  for (const c of node.children) {
    if (c.id === id) return node
    const hit = parentOf(c, id)
    if (hit) return hit
  }
  return null
}

export default function App() {
  const [scan, setScan] = useState<Scan | null>(null)
  /** Ticks when a tree ARRIVES from the backend — a different project, a rescan, or none.
   *
   *  **Not the same event as `scan` changing.** Readings and streamed scores are folded INTO
   *  the tree on screen, which produces a new object for the same repo several times a
   *  minute; a tree arriving is a different repo, or the same one rebuilt. The two are
   *  indistinguishable by identity and have opposite consequences for anything cached
   *  against the tree — see the effect that drops the function rings. */
  const [treeRev, setTreeRev] = useState(0)

  /** Readings, kept so a function ring can carry them the moment it lands.
   *
   *  **A tree arrives without its functions** — see `Node::slim` — so `applyAgentReports`
   *  folds readings into a tree that has none, and the rings turn up afterwards from
   *  `fileFunctions` holding raw scan nodes. Nothing re-applied to those, so every function
   *  reading was invisible on the map while the status line reported 69.9% read. `filled` is
   *  the only place they can meet, and this is how they get there.
   *
   *  A ref plus a revision counter rather than state, on the same argument `treeRev` makes:
   *  the poll refetches every reading every two seconds, and a new Map each time would
   *  invalidate the graft's memo on a fixed period and re-lay the sunburst out for nothing.
   *  The counter moves only when `readingSignature` says something changed. */
  const readings = useRef<Map<string, AgentReport>>(new Map())
  const readingSig = useRef('')
  const [readingRev, setReadingRev] = useState(0)
  const keepReadings = useCallback((list: AgentReport[]) => {
    const sig = readingSignature(list)
    if (sig === readingSig.current) return
    readingSig.current = sig
    readings.current = new Map(list.map((r) => [r.id, r]))
    setReadingRev((n) => n + 1)
  }, [])
  const [error, setError] = useState<string | null>(null)
  /** A repo just added by hand, waiting for its scan to reach the project list.
   *
   *  Its KEY, not its path. It was the path, compared against each row's `repo` — and those
   *  two strings agree only by luck, because `project_key` canonicalizes and `repo` keeps
   *  whatever the picker handed over. When they disagreed the effect below never fired, so
   *  the repo somebody had just chosen sat in the sidebar unselected until its scan finished
   *  minutes later and the backend's own focus finally moved the window. */
  const [pendingAdd, setPendingAdd] = useState<string | null>(null)
  /** What is selected, as the NODE rather than its id.
   *
   *  It was an id, resolved against the tree on every render — which quietly cannot
   *  represent the one selection that is not in the tree. The overflow aggregate a file's
   *  band collapses into is synthesised at layout time, so `findById` returned null for
   *  it and clicking it emptied the panel instead of describing it. The id is still used
   *  first, so a rescan re-resolves the selection to the fresh node; the stored object is
   *  the fallback for anything the tree does not contain. */
  const [picked, setPicked] = useState<Node | null>(null)
  /** Whether the finder is up. Session state and nothing more — a search box that
   *  remembered it was open would greet a launch with a panel over the map. */
  const [finding, setFinding] = useState(false)
  /** Whether the lens help is up — see `LensHelp`. Session state: it is a thing you read
   *  once, not a preference. */
  const [helping, setHelping] = useState(false)
  const [stack, setStack] = useState<string[]>([])
  /** A function to scroll to once the code view is up.
   *
   *  Carries a nonce because the request is an EVENT, not a state: double-clicking the
   *  same function twice has to scroll back to it both times, and a bare id would look
   *  unchanged the second time and do nothing. */
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null)
  /** The file whose code is open over the map, by node id. */
  const [codeFile, setCodeFile] = useState<string | null>(null)
  /** The Read dialog, for the project it was opened from. */
  const [readFor, setReadFor] = useState<string | null>(null)
  // One geometry, five encodings. The sunburst was never the thing worth swapping out —
  // what changes the question is what the color MEANS, and the same rings answer five
  // different ones depending on that.
  const [mode, setMode] = useState<ColorMode>('surprise')
  /** How many rings the map draws — see `lib/rings.ts`. A display preference, so it is read
   *  from storage once and written back on every change, and it is NOT per project. */
  const [rings, setRings] = useState(loadRings)
  /** **TEMPORARY** — see `BandWidth`. Session state, not stored: the control is expected to
   *  go away once it has told us what `DIR_RIM_PX` should be. */
  const [band, setBand] = useState(0)
  /** **TEMPORARY** — whether a replay flashes what each commit touched. See `HistoryBar`'s
   *  own button, and `frameTree`, which is where it takes effect: with the flashes off the
   *  frame carries no event at all, so the map, the roll-up stand-ins and the escalation all
   *  go quiet together rather than three of them being switched off by hand. */
  const [flashes, setFlashes] = useState(true)
  const chooseRings = useCallback((n: number) => {
    setRings(n)
    saveRings(n)
  }, [])
  /** How many colors each categorical lens spends — see `lib/palette.ts`. A display
   *  preference like the ring count, read once and written back on every change, and held
   *  per lens because the two lenses are asking different questions of it.
   *
   *  Both are loaded up front rather than the current one being loaded when the lens changes:
   *  the map is redrawn by the value, so a lens switch that had to go to storage first would
   *  paint one frame under the other lens's cap. */
  const [caps, setCaps] = useState<Record<Capped, number>>(() => ({
    blame: loadCap('blame'),
    language: loadCap('language'),
  }))
  const chooseCap = useCallback(
    (m: Capped) => (n: number) => {
      setCaps((c) => ({ ...c, [m]: n }))
      saveCap(m, n)
    },
    [],
  )

  /** What each project was last looking at, so coming back to one is coming back.
   *
   *  **A lens and a drill-in are a question you were in the middle of asking.** Switching to
   *  another repo to check something and coming back used to drop you at the root under
   *  Surprise, which is fine once and infuriating on the fifth trip — the sidebar is a set of
   *  projects you move between, not a set you visit.
   *
   *  Kept in a ref rather than in state: nothing renders from the store itself, only from
   *  what a switch pushes into `mode`, `stack` and `historyOn`, and a Map in state would
   *  re-render the window every time the current view was recorded.
   *
   *  Deliberately NOT persisted. It is where you were in this session, and a lens restored
   *  across a relaunch would be a window that opens on a question you asked last week with
   *  nothing on screen saying when you asked it. */
  const views = useRef<Map<string, { mode: ColorMode; stack: string[] }>>(new Map())
  /** The live view, mirrored so a switch can bank it from a stale closure.
   *
   *  The poll that follows an agent-opened project runs on an interval and closes over
   *  whatever `mode` was when its effect was built, which is not what is on screen by the
   *  time it fires. Recording through a ref is what makes the banked view the one you were
   *  actually looking at. */
  const view = useRef({ mode: 'surprise' as ColorMode, stack: [] as string[] })
  // Open projects, in the order they were opened. The sidebar lists everything sanity
  // holds; the rail is what you have in front of you.
  // Defaults to following the system; View → Appearance overrides it. The app used to
  // follow the system with no way to override, on the argument that a toggle is a second
  // place for the preference to live — true, but it also made it impossible to look at
  // the other ground without changing the machine's, which is what you want when shooting
  // the app or checking that both palettes actually render.
  const [theme, setTheme] = useState<Theme>(loadTheme)
  useEffect(() => watchSystemTheme(theme), [theme])
  // Appearance is a menu, not a panel — see `build_menu`. Rust emits the choice; the
  // preference and its persistence stay here, and the menu's checkmarks are told what
  // they should read rather than being trusted to remember.
  useEffect(
    () =>
      onSetTheme((t) => {
        const next = t as Theme
        setTheme(next)
        saveTheme(next)
      }),
    [],
  )
  useEffect(() => {
    void syncThemeMenu(theme)
  }, [theme])
  const [agent, setAgent] = useState<AgentActivity>({
    active: false,
    tool: '',
    nonce: 0,
    events: [],
  })
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  /** Whether any MCP client is registered against THIS binary.
   *
   *  Load-bearing now that agents are the only way a project arrives: with nothing
   *  connected, no amount of waiting produces one, and the app has to say so rather than
   *  describe a sleeping agent that does not exist. Polled rather than fetched once
   *  because the fix happens in another application — the user connects Claude Code in the
   *  setup sheet, or edits a config by hand — and the window has no way to be told. */
  /** Has the project list been fetched even once?
   *
   *  The onboarding gate is shown when `projects` is empty — and it is empty for the first
   *  poll of every launch, including one with a dozen projects. So a populated app opened
   *  with "connect an agent, then ask it to study a project" on screen, addressed to
   *  somebody who did both weeks ago, and swapped it for their map a moment later. An empty
   *  list and a list not yet fetched are different states and only one of them is news. */
  const [projectsLoaded, setProjectsLoaded] = useState(false)
  /** Which project the map is actually showing.
   *
   *  A ref rather than state: the poll reads it every tick and must not be re-created to see
   *  a change, and nothing renders from it. Written by both doors into a project — the poll
   *  that follows the agent, and the sidebar click that overrules it. */
  const shown = useRef<string | null>(null)
  /** Which scan of that project the map was built from — see `ProjectSummary.scanned`.
   *
   *  Beside `shown` because the pair is one fact: WHICH tree is on screen. Split apart, the
   *  poll can hold a revision belonging to a project nobody is looking at. */
  const shownRev = useRef(0)
  // ── The replay ──────────────────────────────────────────────────────────────
  //
  // History is a MODE, not a sixth lens. The lenses answer "what should the color mean",
  // and in here that question is already settled: surprise is a reading taken against
  // today's code and cannot be replayed onto a 2019 body, so a frame is colored by
  // recency and the switcher is disabled rather than offered with one option that lies.
  const [historyOn, setHistoryOn] = useState(false)
  // Mirrored every render, so `switchTo` banks what is on screen rather than what some
  // interval's closure remembers.
  view.current = { mode, stack }

  /** Leave one project and arrive at another, carrying each one's view with it.
   *
   *  One function for all three ways the window changes project — a sidebar click, an agent
   *  opening something, and a project being forgotten — because they used to be three copies
   *  of `setStack([]); setPicked(null)` and a fourth would have been written the same way.
   *  What has to happen on a switch is now stated once.
   *
   *  **The selection is dropped and never restored.** A drill-in is a place and survives, but
   *  a picked wedge is a FUNCTION, and the tree it pointed into has been refetched — the
   *  panel would be describing a node the rings are not drawing. That is the same argument
   *  the history toggle already makes for clearing it.
   *
   *  **History is deliberately not part of the view.** It is the one mode that owns state
   *  outside this store — a timeline is several megabytes of one repo's commits, dropped on
   *  every switch because a per-project cache of them has no eviction and no owner. Restoring
   *  the MODE without the timeline is precisely the state that drop exists to prevent: the
   *  live map on screen with the lens pinned to Age and a replay's key under it, explaining
   *  itself with `new here` and `touched` while showing nothing of the kind. Re-entering is
   *  one click, and it is a click that says which repo it means.
   */
  const switchTo = useCallback((from: string | null, to: string | null) => {
    if (from) views.current.set(from, { ...view.current })
    const v = to ? views.current.get(to) : undefined
    // **A project you have not opened this session inherits the lens you are on**, rather
    // than resetting to a default. Switching repos is a change of subject, not a change of
    // question: somebody comparing two codebases under Docs wants Docs on both. Where the
    // new repo cannot answer it — no readings yet — `locks` falls back for the duration and
    // the preference survives to be restored when it can.
    setMode(v?.mode ?? view.current.mode)
    setStack(v?.stack ?? [])
    setPicked(null)
  }, [])
  /** The timeline's tables, and a handle on the deltas that stream in behind them.
   *
   *  Two halves because they arrive differently: the tables are one bounded fetch and the
   *  deltas are the story — see `lib/timeline.ts`. Held as one object so a render cannot see
   *  one without the other. */
  const [history, setHistory] = useState<{ tables: Tables; deltas: Deltas } | null>(null)
  /** How far the story has arrived. The scrub bar addresses the whole timeline; this is how
   *  much of it can be drawn right now, and it only ever grows. */
  const [loaded, setLoaded] = useState(0)
  /** Which project `history` describes. A repo's timeline is not transferable, and
   *  switching projects with a stale one loaded would replay one repo's commits over
   *  another's name. */
  const [historyKey, setHistoryKey] = useState<string | null>(null)
  /** `historyKey`, mirrored, for the same reason `walking` mirrors `busyKey`: `replay` reads it
   *  after awaiting a walk, where the closure's copy is whatever it was when the press landed.
   *
   *  Assigned during render rather than in an effect — an effect runs after paint, and a chain
   *  finishing between the two would consult a key one frame out of date. */
  const shownHistory = useRef<string | null>(null)
  shownHistory.current = historyKey
  /** The project whose replay is running, or null.
   *
   *  A boolean once, which made a replay a property of the WINDOW rather than of a repo:
   *  switching to another project left the strip counting ceph's 122,818 commits over
   *  sanity's map, and the mode button reading "Reading…" about work belonging to a repo
   *  that was no longer on screen. A replay takes long enough on a large repo that leaving
   *  it running and going to look at something else is the normal thing to do. */
  const [busyKey, setBusyKey] = useState<string | null>(null)
  /** The replay's guard, as a ref rather than as `busyKey` itself.
   *
   *  `chaseTrace` reaches the replay after awaiting a phase that can run for a minute, and a
   *  `busyKey` read out of that closure is whatever it was when the press landed. The state is
   *  what the rows render; this is what decides. */
  const walking = useRef<string | null>(null)
  /** Which projects have a trace column being walked. Keyed, and that is the point.
   *
   *  **It was one slot, and one slot is a rule about the APP where the constraint is about a
   *  project.** Two repos can be traced at once — `TraceState.stop` is per project for exactly
   *  that reason — and only the replay is one-at-a-time, which `walking` guards on its own. A
   *  single slot meant a chain on kibana, which is minutes of blame, silently swallowed the
   *  press on every other row: no error, no busy pill, nothing. A guard that refuses work has
   *  to refuse the work it was written about, or it becomes a dead button somewhere else. */
  const chasing = useRef<Set<string>>(new Set())
  /** Projects whose chain has been asked to stop. Checked between phases, so a stopped blame
   *  pass does not roll straight on into an hour of replay — a Stop means the column, not just
   *  the step. Keyed for the same reason `chasing` is: stopping one repo is not stopping all of
   *  them, and a shared flag would have quietly ended somebody else's walk. */
  const stopChase = useRef<Set<string>>(new Set())

  /** Is the project on screen the one being replayed? Everything the window says about a
   *  replay is about the repo it is drawing, never about the app. */
  const historyBusy = busyKey === activeKey
  const [historyProgress, setHistoryProgress] = useState<Progress | null>(null)
  /** The playhead. -1 is the opening state, before the first replayed commit lands. */
  const [histIndex, setHistIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  /** Seconds the whole replay should take — see `DURATIONS`. A duration rather than a
   *  rate, because a rate that suits a 46-commit repo is two minutes of shimmer on a
   *  thousand-commit one. */
  const [duration, setDuration] = useState(30)
  // The path of whatever is on screen, so changing the model can re-scan it rather than
  // making the user find the directory again.
  const lastPath = useRef<string | null>(null)

  // Follow whatever an agent opened.
  //
  // This is the inversion: the window does not ask the user which project to show, it
  // watches what the session driving it is working on and switches. Polled rather than
  // pushed because it is one small call every couple of seconds and needs no plumbing
  // between the loopback server and the webview.
  useEffect(() => {
    // What this poll last FOLLOWED, which is not what is on screen. Two different
    // questions, and answering both from one variable is what broke picking a project by
    // hand: `active` is the backend's idea of what an agent is working on and a sidebar
    // click does not move it, so comparing it against the screen made "the agent opened
    // something new" permanently true and dragged the window back on the very next tick.
    let followed: string | null = null
    const tick = () => {
      void listProjects().then(async (list) => {
        mark('projects')
        // Replaced only when it differs. The poll returns fresh objects whether or not
        // anything moved, and setting them re-rendered the whole window — including a
        // sunburst of several thousand arcs — every 1.5 seconds. During a replay that is a
        // stutter on a fixed period; the rest of the time it is just waste.
        setProjects((prev) => (sameProjects(prev, list.projects) ? prev : list.projects))
        // Marked once the list has actually been fetched, empty or not — see the state's
        // own comment. Set after `setProjects` so the two land in one render and an empty
        // repo list does not flash the gate before the loading line.
        setProjectsLoaded(true)
        const revOf = (key: string | null) => list.projects.find((p) => p.key === key)?.scanned ?? 0

        // AN AGENT OPENED SOMETHING NEW. This is the inversion, and the only case that
        // overrules what you are looking at. Compared against `followed` rather than against
        // the screen, so a sidebar click — which does not move `active` — cannot be mistaken
        // for one.
        if (list.active && list.active !== followed) {
          followed = list.active
          // Banked BEFORE `shown` is moved: it is the only thing here that still names the
          // project being left, and the view being put away is that project's.
          const leaving = shown.current
          shown.current = list.active
          shownRev.current = revOf(list.active)
          setActiveKey(list.active)
          // A different project means a different tree, so the selection goes; the lens and
          // the drill-in are this project's own and come back with it.
          switchTo(leaving, list.active)
          // Both, together. `project_scan` returns the tree as Rust scored it — proxy only —
          // so fetching it without the readings shows an assessed repo as entirely gray
          // until some later poll happens to repaint it.
          const [s, reports] = await Promise.all([
            projectScan(list.active),
            agentReports(list.active),
          ])
          mark('tree')
          if (!s) return
          setTreeRev((n) => n + 1)
          keepReadings(reports)
          setScan(reports.length > 0 ? { ...s, root: applyAgentReports(s.root, reports) } : s)
          return
        }

        // THE PROJECT ON SCREEN WAS RESCANNED — an edit, a commit, a pull; see
        // `ProjectSummary.scanned` and the watcher that moves it. The tree is refetched and
        // nothing else moves: you are watching your own repo rebuild itself, and jumping to
        // the root and dropping your selection on every save would make the feature unusable
        // exactly while it is working. Ids survive an edit now — see `assessment::key_of` —
        // so the selection re-resolves against the fresh tree.
        const here = shown.current
        if (!here) return
        // **A loading project is worth asking about.** `revOf` is 0 while a project is being
        // scanned, and a poll that skipped those never fetched the early map the backend
        // publishes from its cache — the pane waited for the whole tree to be decoded to draw
        // a picture that was ready before it started. See `AppState::shallow`.
        const rev = revOf(here)
        const loading = list.projects.find((p) => p.key === here)?.loading === true
        if (rev === shownRev.current && !(loading && !scanRef.current)) return
        shownRev.current = rev
        const [s, reports] = await Promise.all([projectScan(here), agentReports(here)])
        if (!s) return
        setTreeRev((n) => n + 1)
        keepReadings(reports)
        setScan(reports.length > 0 ? { ...s, root: applyAgentReports(s.root, reports) } : s)
      })
    }
    // **Once now, then every 1.5 seconds.** It was the interval alone, so a launch asked the
    // backend nothing for a second and a half and then drew whatever was ready. Everything
    // behind this — the cached map, read in 0.02s, published before the scan starts — was
    // arriving into a window that had not got round to asking. A poll's period is how often
    // it re-checks, never how long it waits to start.
    tick()
    const timer = setInterval(tick, 1500)
    return () => clearInterval(timer)
  }, [])

  // Agents report over MCP while the app is open, so the map has to pick their verdicts
  // up without a rescan. Polled on a slow timer: an agent takes seconds per function, so
  // this costs nothing and avoids pushing events out of the loopback server.
  //
  // Except during a replay, where it costs a great deal. The readings are fetched WHOLE —
  // 16,925 of them on tonepoet — and folded into the live tree, which is not the tree on
  // screen while history is playing. At three hundred commits a second two seconds is
  // several hundred frames, so the picture stuttered on a fixed period and the period was
  // this timer. Nothing is lost by waiting: readings are recovered on the next tick after
  // history closes, and the live map is not being looked at meanwhile.
  //
  // Activity keeps polling. That one is a few bytes, and it drives the mascot — an agent
  // that goes to sleep behind a replay should not still be reported as working.
  useEffect(() => {
    const timer = setInterval(() => {
      void agentActivity().then(setAgent)
      if (historyOn) return
      void agentReports(activeKey).then((reports) => {
        if (reports.length === 0) return
        keepReadings(reports)
        setScan((prev) => (prev ? { ...prev, root: applyAgentReports(prev.root, reports) } : prev))
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [activeKey, historyOn, keepReadings])

  // Streamed scores are batched and flushed on a timer rather than applied per event.
  // Each application re-aggregates the tree and re-renders a few thousand arcs; at the
  // rate a fast model emits, doing that per function would spend more time in React
  // than in the model.
  /** Whether a tree is on screen, for the poll — which cannot read state it is not
   *  re-created with. */
  const scanRef = useRef<Scan | null>(null)
  const pending = useRef<Map<string, Upgrade>>(new Map())
  useEffect(() => {
    const un = onScanScore((id, u) => pending.current.set(id, u))
    const timer = setInterval(() => {
      if (pending.current.size === 0) return
      const batch = pending.current
      pending.current = new Map()
      setScan((prev) => (prev ? { ...prev, root: applyScores(prev.root, batch) } : prev))
    }, 400)
    return () => {
      un()
      clearInterval(timer)
    }
  }, [])

  /** The repo's shape as the scan discovers it, so a first open draws the map assembling
   *  rather than a bar. See `lib/shape.ts`.
   *
   *  Batched on the same argument as the scores above, and it matters more here: a large
   *  repo emits a directory every few milliseconds, and rebuilding the tree per batch is
   *  cheap only because the batches are coarse.
   *
   *  **It belongs to the repo being scanned, not to the pane, and the STREAM says which.**
   *  It used to be cleared the moment ANY tree landed — the scan's own tree is the real one,
   *  and two of them on screen would be two answers to one question, which is true and was
   *  implemented against the wrong subject: clicking another project puts that project's
   *  finished tree in `scan`, so a glance at a second repo threw away the assembling map of
   *  the first, permanently, because the shape only refills from NEW events and the parse
   *  that emits them is long over by the blame phase.
   *
   *  Inferring the owner from the projects list was the next thing tried and was worse — it
   *  looked right and failed on launch, which is the case that matters. There is no "the one
   *  that is loading": a restore publishes EVERY known project as loading up front so the
   *  sidebar fills in at once, so the guess was whichever unfinished project sorted first
   *  and it changed hands each time any of them settled, discarding the map mid-draw. The
   *  key rides on the batch now (`scan::ShapeBatch`) and nothing is inferred.
   */
  const arriving = useRef<ShapeFile[]>([])
  const [shape, setShape] = useState<ShapeFile[]>([])
  /** Which repo the accumulated shape and the live wedges describe. A ref, because it is
   *  read inside the listeners and must not re-subscribe them when it changes. */
  const streaming = useRef<string | null>(null)
  /** The same value where a memo can see it. The ref is what the listeners read; this is
   *  what decides whether the assembling map belongs to the project on screen. */
  const [streamingKey, setStreamingKey] = useState<string | null>(null)
  /** Node ids the scan has touched, and when — see `live` below, which is fed from it.
   *  Declared up here because the shape listener empties it when the subject changes: the
   *  lit wedges and the map they are lit on have to change repo together. */
  const liveAt = useRef(new Map<string, number>())
  useEffect(() => {
    const un = onScanShape((project, files) => {
      if (streaming.current !== project) {
        // Another repo has started drawing itself. One map at a time: the accumulated one
        // describes a scan that is over or superseded, and merging two would put one repo's
        // directories inside another's.
        streaming.current = project
        setStreamingKey(project)
        arriving.current = []
        setShape([])
        liveAt.current.clear()
      }
      arriving.current.push(...files)
    })
    const timer = setInterval(() => {
      // **Drained BEFORE the updater, never inside it.** It used to read
      // `setShape(prev => [...prev, ...arriving.current.splice(0)])`, which is an updater
      // with a side effect — and React calls updaters TWICE under StrictMode to surface
      // exactly that. The first call drained the buffer and built the right array; the
      // second ran against the same `prev` with the buffer now empty, returned `prev`
      // unchanged, and that is the one React kept. So every flush threw away its own batch:
      // 45,272 files streamed, 24 flushes ran, and `shape` never left zero.
      //
      // It only bites in development, because the double invocation is a dev-only check —
      // which is why the assembling map worked in the installed app and vanished the moment
      // the same code ran under `just dev`, and why it read as a regression in whatever had
      // been touched most recently. The score batcher above got this right; this one did
      // not, and the two are now the same shape.
      const batch = arriving.current
      if (batch.length === 0) return
      arriving.current = []
      setShape((prev) => [...prev, ...batch])
    }, 300)
    return () => {
      un()
      clearInterval(timer)
    }
  }, [])

  /** Where the scan is, right now, as node ids to light up.
   *
   *  **A bar says how much; the map can say where.** Both long phases sweep the repo in a
   *  definite order — parse by directory, blame over the files the parse produced, so both
   *  run alphabetically — and none of that was on screen: the rings stopped moving when the
   *  parse ended and the blame pass ran for hours behind a picture that looked finished.
   *
   *  Drawn through `reading`, the channel a reader's lease already uses, because it is the
   *  same claim — this wedge is being worked on right now — and a second visual language for
   *  it would have to be told apart from the first for no gain. The two never overlap: a repo
   *  is being scanned or it is being read.
   *
   *  **Every ancestor, not just the file.** That is what makes it a tree lighting up rather
   *  than a dot moving: the file wedges twinkle as the sweep passes them while the directory
   *  they sit in stays lit for as long as the scan is inside it, so the picture says both
   *  "here" and "in here" at once.
   *
   *  Fed from the EVENT rather than the polled project row: the poll is 1.5s, which is fine
   *  for a fraction and useless for this — at ~35 files a second it would show one in fifty.
   */
  const [live, setLive] = useState<Set<string>>(new Set())
  useEffect(() => {
    const un = onScanProgress((project, p) => {
      // Only the repo whose map is on screen. Another project's scan running beside this
      // one would light nothing (its paths are not in this tree) and would keep the trail
      // alive after this scan ended, which is worse than lighting nothing.
      if (!p.at || streaming.current !== project) return
      const now = Date.now()
      for (let cut = p.at.length; cut > 0; cut = p.at.lastIndexOf('/', cut - 1)) {
        const id = p.at.slice(0, cut)
        liveAt.current.set(id, now)
        if (id.indexOf('/') === -1) break
      }
    })
    const timer = setInterval(() => {
      const cutoff = Date.now() - LIVE_MS
      const next = new Set<string>()
      for (const [id, at] of liveAt.current) {
        if (at < cutoff) liveAt.current.delete(id)
        else next.add(id)
      }
      // Same object back when the membership has not moved. The map is several thousand
      // arcs and this ticks four times a second — a fresh Set every tick would re-render
      // all of them for the entire life of the window, scan or no scan. The same trap the
      // project poll fell into with `activeProject`.
      setLive((prev) => {
        if (prev.size === next.size) {
          let same = true
          for (const id of next)
            if (!prev.has(id)) {
              same = false
              break
            }
          if (same) return prev
        }
        return next
      })
    }, 250)
    return () => {
      un()
      clearInterval(timer)
    }
  }, [])

  // File → Open used to raise a folder picker. Opening by hand is gone — a project arrives
  // only when an agent calls `sanity_open` — so the menu item now opens the one thing that
  // can still get you one. Kept rather than deleted because ⌘O is muscle memory, and a
  // shortcut that does nothing teaches people the app is broken.
  /** Fetch the project list once, now, instead of waiting for the next tick.
   *
   *  The poll runs every 1.5 seconds, which is invisible while nothing is happening and
   *  the whole story right after you press a button: `start_check` sets the run
   *  synchronously, so the backend knows immediately and the window is the only thing that
   *  does not. Pressing Read looked like pressing nothing for a second. Refetching is
   *  better than an optimistic label because what appears is the real state — including
   *  the refusals, which a fake "starting…" would paper over. */
  const refreshProjects = useCallback(() => {
    void listProjects().then((list) => {
      setProjects((prev) => (sameProjects(prev, list.projects) ? prev : list.projects))
    })
  }, [])

  // One add path for the sidebar's `+` and the empty gate's button.
  //
  // Two copies would be two chances for them to disagree about what happens when the
  // picker is dismissed or the directory is refused — and the gate is exactly where a
  // first-time user meets the refusal.
  /** Start scanning one folder. The tail of both paths in. */
  const takeFolder = useCallback((path: string, key: string) => {
    setBigFolder(null)
    setPendingAdd(key)
    void scanRepo(path).catch((e) => {
      setPendingAdd(null)
      setError(String(e))
    })
  }, [])

  const addProject = useCallback(() => {
    setError(null)
    void pickProject()
      .then((added) => {
        if (!added) return
        // **A directory of repos is asked about, not refused.** Requiring a `.git` made this
        // impossible to do by accident and impossible to do on purpose; what it was really
        // guarding is the CPU — `~/projects` here is 39 repos and half an hour of scanning.
        // So the count is put in front of somebody before it happens, once, with a way
        // through. A monorepo that vendors submodules is a repo itself and never asks.
        if (added.holds > 1) {
          setBigFolder(added)
          return
        }
        // Remembered so the new project can be selected when it shows up: the scan publishes
        // it and the poll renders it, which are two different moments — without that the repo
        // you just added appears in the list and the map stays on whatever you were looking at.
        //
        // **Priced before it is added, because the answer changes what happens next.** A repo
        // whose history is under the budget is scanned and traced without anybody being asked;
        // one over it arrives with its map drawn and its second axis missing, which is a thing
        // to say out loud rather than let somebody discover from a grey lens. The estimate is
        // free — see `trace::estimate` — so this costs nothing on the repos it does not apply
        // to. A failure to price is not a reason to block an add: fall through and let the row
        // say what it finds.
        void Promise.all([estimateTrace(added.path), explainTrace()])
          .then(([cost, explain]) => {
            if (cost.fits || !explain) {
              takeFolder(added.path, added.key)
              return
            }
            setBigHistory({ added, cost })
          })
          .catch(() => takeFolder(added.path, added.key))
      })
      .catch((e) => {
        setPendingAdd(null)
        setError(String(e))
      })
  }, [takeFolder])

  /** Take a project out of the sidebar. The repo and its readings are untouched.
   *
   *  Selection is cleared when it was the one removed, before the refetch rather than
   *  after: the poll would drop the row and leave `activeKey` naming a project that is not
   *  in the list, which renders as a window still showing a map nothing can be selected
   *  for. */
  /** Everything on screen that belongs to one project, dropped.
   *
   *  **Shared by the two verbs that stop a project being what it was.** Choosing a project
   *  resets the tree, the drill stack, the picked wedge and the two refs the poll follows;
   *  forgetting one cleared `activeKey` alone, so the sidebar went empty while the pane and
   *  the detail panel carried on showing a repo the app no longer holds — with nothing left
   *  to select to get rid of it. A reset needs the identical clearing for a different
   *  reason: the row stays, and what is on screen for it came out of caches that have just
   *  been deleted. */
  const dropView = useCallback(
    (key: string) => {
      if (activeKey !== key) return
      setActiveKey(null)
      setTreeRev((n) => n + 1)
      setScan(null)
      // Nowhere to arrive, so nothing is banked — and the departing view is DROPPED rather
      // than kept: a project can be added back under the same key, and it would return
      // wearing a drill-in from before it was forgotten, pointing into a tree nobody has
      // scanned yet.
      switchTo(null, null)
      views.current.delete(key)
      // The poll compares against these to decide whether to refetch. Left naming a
      // project that is gone, the next tick would fetch a tree for it.
      shown.current = null
      shownRev.current = 0
    },
    [activeKey, switchTo],
  )

  const forget = useCallback(
    (key: string) => {
      dropView(key)
      void forgetProject(key).then(refreshProjects)
    },
    [dropView, refreshProjects],
  )

  /** Drop everything this app derived for a repo and leave the repo alone — see
   *  `reset_project`.
   *
   *  **Not routed through `forget`,** which was the first shape and was wrong in one word:
   *  that one takes the row out of the index, so a reset would have been a remove wearing a
   *  gentler label. What the two share is the window-side clearing, which is `dropView`. */
  const reset = useCallback(
    (key: string) => {
      dropView(key)
      void resetProject(key).then(refreshProjects)
    },
    [dropView, refreshProjects],
  )

  /** WebKit's own context menu, which is Reload and Inspect Element, does not ship.
   *
   *  It is a developer menu — pressing Reload in a Tauri window throws away the scan and
   *  looks like a crash — and it appeared everywhere, including on rows where right-click
   *  now means something. Suppressed in release only: Inspect Element is how this UI gets
   *  worked on, and losing it in `just dev` would cost more than the menu does.
   *
   *  Not suppressed over text. Right-clicking a selection or a field is how somebody
   *  copies an id out of the model box or a path out of the detail panel, and taking that
   *  away to hide two developer items would be a worse trade than leaving them. */
  useEffect(() => {
    if (import.meta.env.DEV) return
    const block = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable]')) return
      if (window.getSelection()?.toString()) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])

  // ⌘O adds a repo again, matching what the item now says. It pointed at the connect
  // sheet for as long as adding by hand did not exist.
  useEffect(() => onOpenProject(() => addProject()), [addProject])

  /** A chosen folder that holds several repos, waiting to be confirmed. */
  const [bigFolder, setBigFolder] = useState<Added | null>(null)

  /** A repo whose history is over the budget, and what it would cost — see the dialog. */
  const [bigHistory, setBigHistory] = useState<{ added: Added; cost: TraceCost } | null>(null)
  /** Ticked in that dialog. Written on the way out rather than on every click, so cancelling
   *  leaves the preference where it was: dismissing a dialog is not answering it. */
  const [hideExplain, setHideExplain] = useState(false)

  /** What the menu's Install Command Line Tool… reported, if anything. Split into a
   *  sentence and a path so the path can be set as code rather than the whole message
   *  being set as a transcript. */
  const [cliLink, setCliLink] = useState<null | { text: string; path?: string }>(null)
  useEffect(
    () =>
      onInstallCli(() => {
        void installCli()
          .then(() =>
            // Asked rather than inferred from the write: a link was made, and which
            // `sanity` a shell reaches is a different question — another install can come
            // first on PATH.
            cliStatus().then((c) =>
              setCliLink(
                c.is_this_app
                  ? // No backticks. They are Markdown in a string that is rendered as HTML,
                    // so they arrive as literal punctuation — and the convention they come
                    // from is one a reader of this dialog has no reason to know.
                    {
                      text: 'Installed. The sanity command now runs this app, at',
                      path: c.resolved ?? undefined,
                    }
                  : c.resolved
                    ? {
                        text: 'Linked, but your shell still runs another build first:',
                        path: c.resolved,
                      }
                    : {
                        text: 'Linked, but no shell can find it yet — add its directory to your PATH.',
                      },
              ),
            ),
          )
          .catch((e) => setCliLink({ text: String(e) }))
      }),
    [],
  )

  const readingIds = projects.find((p) => p.key === activeKey)?.reading
  const readingKey = readingIds?.join('\u0000') ?? ''
  const readingNow = useMemo(() => {
    const ids = readingKey ? readingKey.split('\u0000') : []
    // **The containing FILE goes in too, and without it the pulse was invisible.** A
    // function wedge on a real repo is a fraction of a degree, and past the ring's budget it
    // is not drawn at all — folded into a roll-up — so a marker on it lit nothing you could
    // see and sometimes nothing that existed. A file always has its own band.
    //
    // One Set for both because a file node's id IS its path, and a function's is
    // `path#name`, so the prefix of a reading id is exactly the id of the file to light.
    // Directories deliberately stay dark: at the root they are most of the picture, and a
    // marker covering half the map says nothing about where the work is.
    return new Set(ids.flatMap((id) => [id, id.split('#')[0]]))
  }, [readingKey])

  /** Where the open project lives on disk.
   *
   *  NOT `lastPath`, which is only written when someone picks a directory by hand — a
   *  project that arrived over MCP or came back with `restore` never set it. Anything
   *  needing the repo root off that ref was therefore dead for exactly the projects the
   *  app is built around: the code view had nothing to read, and "explain this function"
   *  had nowhere to look. The active project knows its own repo; ask it. */
  const repoPath = useMemo(
    () => projects.find((p) => p.key === activeKey)?.repo ?? lastPath.current,
    [projects, activeKey],
  )

  /** The row for what is on screen — its name for the summary's header, and whether an
   *  agent is on it, which decides whether the summary offers to connect one. */
  const activeProject = useMemo(
    () => projects.find((p) => p.key === activeKey) ?? null,
    [projects, activeKey],
  )

  /** What the creature in the hub is doing.
   *
   *  The same three-rung ladder the sidebar panel used to run, and about the project on
   *  SCREEN — which is what the hub is about. It was global once ("an agent called Sanity
   *  recently, about anything"), and that was fine while an agent was the only way in and
   *  wrong for a picture of one repo: `project.working` is the backend's per-project answer
   *  and it discounts a finished run's dying calls, which is what used to leave this reading
   *  WORKING for a minute over a run that had stopped.
   *
   *  **A wave that has ended is not finished while its readers are alive.** `live` counts
   *  processes the backend has not yet reaped, so the creature stays flustered until the
   *  last one is gone rather than snapping back to work on the readers' own last calls. */
  const mascotState = useMemo<MascotState>(() => {
    const run = activeProject?.run ?? null
    const running = !!run?.running
    const winding = !!run && !running && (run.live ?? 0) > 0
    if (run?.stopping || winding) return 'stopping'
    return running || activeProject?.working ? 'working' : 'sleeping'
  }, [activeProject])
  /** Kept stable between polls, on the SEQUENCE rather than on the array.
   *
   *  `agentActivity` returns a fresh object every two seconds whether or not anything
   *  happened, and this prop reaches the sunburst — which is a few thousand arcs. A new
   *  identity per poll is a re-render of the whole map twice a minute to carry a list that
   *  did not change. The last call's `seq` is the one thing that moves when it does. */
  const lastCall = agent.events.length > 0 ? agent.events[agent.events.length - 1].seq : 0
  /** Bumped when somebody asks the sidebar for a new creature — see `remintMascot`. The
   *  blueprint itself lives in storage, per project, so this only has to say "look again". */
  const [remint, setRemint] = useState(0)
  const mascot = useMemo(
    () => ({ events: agent.events, state: mascotState, project: activeKey, remint }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastCall, mascotState, activeKey, remint],
  )

  useEffect(() => onHistoryProgress(setHistoryProgress), [])

  // Keep this repo's timeline current, if it has one. Never builds one — see
  // `history::warm`. The repo you are working in gains commits while you look at it, so
  // without this the first History of the day would re-read a stale cache's worth of new
  // work; with it, opening the replay is a file read.
  useEffect(() => {
    if (!repoPath) return
    void warmHistory(repoPath).catch(() => {})
  }, [repoPath])

  // Read on demand, and only once per project. The replay re-parses every file version
  // the window touches — seconds on a large repo — so nobody pays for it on the way to a
  // map they asked for. Turning the mode off keeps the result: scrubbing back in is then
  // instant, and the commits behind you cannot have changed.
  useEffect(() => {
    if (!historyOn || !repoPath || !activeKey) return
    // **`historyBusy`, not `busyKey`, and the difference is a project you are not looking
    // at.** This effect READS a banked timeline; it never walks one — see the note below,
    // which is emphatic that tracing belongs to the project row. So the one-walk-at-a-time
    // rule has no business here: it lives in `trace`, where the walking is. Guarding on any
    // repo being busy meant that tracing ceph for an hour silently refused to open sanity's
    // already-banked replay — the button was enabled, because that is judged per project,
    // and pressing it did nothing at all, which is the worst of the three possible answers.
    //
    // What DOES have to be excluded is the repo being walked right now: its story is still
    // being written, and reading it mid-walk would open on a timeline that grows under the
    // playhead.
    if (historyKey === activeKey || historyBusy) return
    setHistoryProgress(null)
    // **Viewing only.** Turning History on used to bring the timeline up to date, which is
    // how the top bar came to start an hour of parsing: the control that opens a view was
    // also the control that commissioned the work behind it. Tracing is `onTrace`, from the
    // project's own row, where the cost is stated next to the button.
    const path = repoPath
    const key = activeKey
    void historyTables(path)
      .then(async (tables) => {
        if (!tables) return
        // The functions page in beside the deltas that name them — see `Funcs`. The list is
        // handed straight to the fold as `tables.funcs`, one array appended to in place, so
        // nothing downstream has to know the story arrives in pieces.
        const funcs = new Funcs(path, tables.funcCount)
        tables.funcs = funcs.list
        // The opening state names functions too, and it is folded before any delta is. On a
        // repo whose window covers everything this is empty and costs one comparison.
        await funcs.ensure(baseWatermark(tables.base))
        const deltas = new Deltas(path, funcs)
        // **Opens as far as the story has arrived, which on a small repo is the end.**
        // Opening at the end was the rule and the reason still holds — the map you were
        // looking at is the last frame, so turning History on should change nothing you can
        // see. What changed is that "the end" of a hundred thousand commits is not a place
        // the window can be in one fetch. The first block lands immediately, the rest keeps
        // arriving, and the playhead sits at the newest frame that can be drawn.
        await deltas.ensure(0, setLoaded)
        setHistory({ tables, deltas })
        setHistoryKey(key)
        setLoaded(deltas.have())
        setHistIndex(Math.min(tables.commits, deltas.have()) - 1)
      })
      .catch((e) => setError(String(e)))
  }, [historyOn, repoPath, activeKey, historyKey, historyBusy])

  /** Walk this repo's commits, from the project row's `Trace`.
   *
   *  **It does not take the view.** Tracing takes an hour on a large repo and it is work
   *  asked of a project, not a place to go: pressing it used to select that project and then
   *  drop the window into History when the walk finished, so a button on one row rearranged
   *  what somebody was looking at on another. The row it was pressed on reports the progress
   *  and offers the way out, which is where a background job belongs. */
  /** Read a repo's commit log onto the map — depth 1, the ask the budget declined.
   *
   *  **Not the replay.** `trace` below walks every commit to build a timeline; this reads the
   *  log once so every wedge gains an age, a churn and an author. They share a word because
   *  they are the same instrument at two depths — see `trace.rs` — and they share nothing
   *  else: this one is seconds to a minute, and the map it lands on is already drawn.
   *
   *  The projects poll is what refreshes the row; the tree refetch is what repaints the map,
   *  and it has to be asked for here because `scanned` moving is the only signal the window
   *  gets and a trace bumps it from a call it made itself. */
  /** The replay — depth 3 — as something that can be awaited.
   *
   *  Split out of `trace` below so the chain can wait for it. Two callers, one body: the
   *  context menu's "replay from scratch" still fires and forgets, and `chaseTrace` needs to
   *  know when the walk is over before it looks at what is left. A second copy of this that
   *  happened to `await` would be two implementations of one walk, and the unwatched one is
   *  the one that forgets to clear `busyKey`.
   *
   *  Takes the repo path rather than looking it up: the chain has a freshly listed project in
   *  hand, and `projects` in a closure that has been awaiting a minute of `git log` is exactly
   *  the stale read this avoids. */
  const replay = useCallback(
    async (key: string, repo: string, fresh = false) => {
      // **One walk at a time.** A walk saturates every core it can get — the parse is
      // `rayon` over each commit's changed files — so two do not run in half the time each,
      // they run in twice the time each and neither finishes; and the progress events carry
      // no repo, so two would count into one bar.
      //
      // Nothing is said here because nothing was offered: the sidebar hides Trace on the
      // other rows while one is running. This is the guard behind that, not the message —
      // an error screen is what you show somebody who did something, and pressing a button
      // that should not have been there is something the app did.
      //
      // A ref rather than the state it mirrors, because the chain calls this after awaiting a
      // phase that can take a minute: `busyKey` read out of that closure is whatever it was
      // when the press landed.
      if (walking.current) return
      walking.current = key
      setBusyKey(key)
      // **Zero of nothing, immediately.** The row shows its trace line while `replay` is
      // non-null, and that used to arrive with the first progress event — which on a large
      // repo is after the stored timeline has been read and the log walked, several seconds
      // of a button that looked like it had missed the press. A count of `0` is honest about
      // what has been traced and honest that something has started.
      setHistoryProgress({ done: 0, total: 0, phase: 'starting…' })
      try {
        // Every commit is a frame — the log lists them and a click addresses one, so the
        // trace has no business coarsening what it stores. The slider governs how fast the
        // story is PLAYED, and the transport already skips to hold the duration it promised.
        await scanHistory(repo, true, fresh)
        // The walk returns a count, not a story. Dropping what is held makes the next
        // History open fetch the tables of the timeline this trace just wrote — and only
        // when it is the timeline on screen, since a trace of another repo has nothing to
        // do with what this window is drawing. Through the ref for the reason above.
        if (shownHistory.current === key) {
          setHistory(null)
          setHistoryKey(null)
          setLoaded(0)
        }
      } finally {
        walking.current = null
        setBusyKey(null)
      }
    },
    [],
  )

  /** Press `Trace` once and get the whole column.
   *
   *  **The three depths are one ask.** `trace.rs` reads history in three sizes — the commit
   *  log, then per-line blame, then every commit replayed into a timeline — and the pill has
   *  always been one column saying `Trace` for all three, on the argument that a button which
   *  renames itself mid-sequence reads as a new button that has appeared. That argument was
   *  right about the label and left the sequence in the same place: the same word in the same
   *  sixty pixels had to be pressed three times, with nothing on screen saying so, and the
   *  second press looked like the first one had failed.
   *
   *  So a press means the column rather than the step. It runs each phase in turn, checking
   *  the backend's own state between them and stopping the moment a step reports no progress —
   *  which is what a Stop looks like from here (see `traceSig`).
   *
   *  **The steps stay separate underneath, and that is deliberate.** Chaining lives here, in
   *  the one place three phases are drawn as one control; `trace_project` and `scan_history`
   *  are still two commands doing one depth each, because the CLI's `sanity trace` and the MCP
   *  endpoint are separate asks and must not inherit a sequence nobody typed.
   *
   *  What a press does NOT do is escape the budget: it is an explicit ask, so it runs whatever
   *  it was pointed at — and the replay on a large repo is an hour where the log walk was a
   *  minute. Every phase remains stoppable at its own granularity, the depth reached is banked
   *  either way, and the note under the pill names the phase that is running. */
  const chaseTrace = useCallback(
    (key: string) => {
      // One column at a time. A second press while this is walking is somebody asking again
      // for what is already happening, and the pill has gone busy to say so.
      // A second press on the row already walking is somebody asking again for what is
      // happening. Another row is a different question and gets its own chain.
      if (chasing.current.has(key)) return
      chasing.current.add(key)
      stopChase.current.delete(key)
      const run = async () => {
        for (;;) {
          const list = await listProjects()
          setProjects((prev) => (sameProjects(prev, list.projects) ? prev : list.projects))
          const p = list.projects.find((x) => x.key === key)
          if (!p || stopChase.current.has(key)) return
          // **`phasesOf` decides what comes next, not a second copy of the ladder here.** The
          // pill already resolves a project row into "the trace phase's outstanding action",
          // and working that out again from `trace_depth` and `resolved` is the two-answers
          // problem `PhaseAction` exists to prevent — with the unwatched copy free to go wrong.
          const act = phasesOf(p).find((ph) => ph.key === 'trace')?.act
          const before = traceSig(p)
          if (act === 'replay') {
            // **The last third, and the chain ends on it whatever happens.** There is nothing
            // after the replay to chain to, so a completed one has no next step and a
            // CANCELLED one must not be handed straight back to itself — a partial walk is
            // banked and extended, so its counter has moved and every "did that accomplish
            // anything" test would say yes. Pressing Trace again resumes it, which is the
            // explicit ask that step deserves.
            await replay(key, p.repo)
            return
          }
          if (act !== 'trace') return
          await traceProject(p.repo)
          const after = await listProjects()
          setProjects((prev) => (sameProjects(prev, after.projects) ? prev : after.projects))
          const now = after.projects.find((x) => x.key === key)
          if (!now || traceSig(now) === before) return
        }
      }
      void run()
        .catch((err) => setError(String(err)))
        .finally(() => {
          chasing.current.delete(key)
          refreshProjects()
        })
    },
    [refreshProjects, replay],
  )

  /** Replay this repo from scratch, for the row's context menu.
   *
   *  The one entry that is NOT the chain: "replay from scratch" is a deliberate re-walk of a
   *  timeline that already exists, so it names its own step rather than asking what is
   *  outstanding — which is nothing. */
  const trace = useCallback(
    (key: string, fresh = false) => {
      const repo = projects.find((p) => p.key === key)?.repo
      if (!repo) return
      void replay(key, repo, fresh).catch((e) => setError(String(e)))
    },
    [projects, replay],
  )

  // Follow a hand-added repo to the map once its scan has landed.
  //
  // Only for a repo the person just picked, never for one that merely appeared. An agent
  // opening a project in another repo must not retarget this window — that is the rule
  // `focus` follows on the backend, arrived at from the frontend side.
  useEffect(() => {
    if (!pendingAdd) return
    const arrived = projects.find((p) => p.key === pendingAdd)
    if (!arrived) return
    setPendingAdd(null)
    setActiveKey(arrived.key)
    // Through the same path as every other switch. A repo somebody has just added has no
    // banked view and lands on the defaults — but the project being LEFT has one, and this
    // was the fourth way to change project and the only one that never put it away.
    switchTo(shown.current, arrived.key)
    shown.current = arrived.key
  }, [pendingAdd, projects, switchTo])

  // A different project is a different timeline. Dropped rather than kept per project:
  // holding several megabytes of somebody else's commits against the chance they click
  // back is a cache with no eviction and no owner.
  //
  // **And the MODE goes with it, which the drop used to leave behind.** History is a view of
  // one repo's story, so carrying it across a project switch left the window in a state that
  // is neither thing: no timeline to draw, so the live map is on screen, but the lens still
  // pinned to Age with a replay's key under it — a map explaining itself with `new here` and
  // `touched` while showing nothing of the kind. Re-entering History is one click, and it is
  // a click that says which repo it means.
  useEffect(() => {
    if (historyKey && historyKey !== activeKey) {
      setHistory(null)
      setHistoryKey(null)
      setPlaying(false)
      setHistoryOn(false)
    }
  }, [activeKey, historyKey])

  /** Where the playhead stood on the previous frame, so a frame can flash what has happened
   *  since — see `inStep`. A ref rather than state: it is read while building the frame it
   *  describes, and setting state there would render the same frame twice to learn a number
   *  the render itself produced.
   *
   *  Keyed by the index it answered for, because the memo below re-runs on other
   *  dependencies too — a project rename must not collapse the step to nothing and swallow
   *  the frame's flashes. */
  const step = useRef({ index: -1, since: -1 })
  const stepFrom = (index: number): number => {
    if (step.current.index !== index) {
      // Backwards, a step has no meaning — you did not watch those commits go by. Show the
      // one commit you landed on.
      step.current = { index, since: index < step.current.index ? index - 1 : step.current.index }
    }
    return step.current.since
  }

  /** The map staged for an export: how many pixels wide the file will be, or null while the
   *  window is just a window.
   *
   *  **Staged rather than rendered aside.** The export copies what is on screen (see
   *  `movie.ts`), which is the whole reason it cannot drift from the map — so asking it for
   *  a denser picture means making the picture on screen denser for the duration. It is
   *  behind the dialog while that happens, and it goes back when the export ends. */
  const [staged, setStaged] = useState<Staged | null>(null)
  /** The pane's measured side, so a staged export knows how much denser it is than this. */
  const [paneSide, setPaneSide] = useState(0)

  /** Where the map is rooted, as a path, taken straight from the drill stack.
   *
   *  `focus` is the same answer resolved against the tree — and the tree is what this is
   *  handed to, so asking `focus` here would be a cycle. Container ids ARE their paths,
   *  which is what makes the stack usable directly; `''` is the repo. */
  const drilled = stack.length > 0 ? stack[stack.length - 1] : ''

  /** The tree for the frame under the playhead, or nothing when history is off.
   *
   *  Built fresh per frame rather than patched onto the live scan: the two hold different
   *  functions — that is the entire point of a timeline — and reusing the live tree would
   *  mean deciding what to do with every function that does not exist yet. */
  const histRoot = useMemo(
    () =>
      historyOn && history && historyKey === activeKey
        ? frameTree(
            history.tables,
            history.deltas,
            histIndex,
            activeProject?.name ?? 'repo',
            stepFrom(histIndex),
            drilled,
            staged && paneSide > 0 ? staged.px / paneSide : 1,
            flashes,
          )
        : null,
    // The NAME, not the project row. `listProjects` hands back fresh objects every poll,
    // so depending on the row rebuilt the whole frame tree on a timer — a hitch at a fixed
    // period, in the middle of a replay, for a string that had not changed.
    // `loaded` is a dependency because the frame it builds depends on how much of the story
    // has arrived: the same index folds to a fuller picture once the block holding it lands.
    [
      historyOn,
      history,
      historyKey,
      activeKey,
      histIndex,
      loaded,
      activeProject?.name,
      drilled,
      staged,
      paneSide,
    ],
  )

  /** What the replay sorts its rings by: every path's size at HEAD — see `headSizes`.
   *
   *  Undefined whenever history is off, which is what keeps the live map sorting by its own
   *  sizes: today IS today there, and a second rule for the same picture is how two views
   *  that should agree come apart. */
  const headOrder = useMemo(
    () =>
      historyOn && history && historyKey === activeKey && scan ? headSizes(scan.root) : undefined,
    [historyOn, history, historyKey, activeKey, scan],
  )

  /** What the map is drawing: the frame when history is on, the scan otherwise. Every
   *  navigation below reads this rather than `scan`, so drilling, crumbs and selection
   *  work the same in both — they are the same rings. */
  /** What the map is drawing: the frame when history is on, the scan otherwise.
   *
   *  Pruned of everything `.sanityignore` set aside — see `pruneExcluded`. Done here rather
   *  than in Rust so the counts, which walk the scan's own tree, go on counting what was set
   *  aside: the exclusion is still reported, it is just not drawn.
   *
   *  Memoised on the scan rather than computed per render: it is a walk of every node, and
   *  every navigation below reads this. */
  scanRef.current = scan
  if (scan) mark('scan')
  const drawn = useMemo(() => (scan ? pruneExcluded(scan.root) : null), [scan])

  /**
   * The functions of the files the map is drawing, fetched as it needs them.
   *
   * **A repo's worth of functions is not a thing a window can be handed.** Ceph's tree is
   * 75MB of JSON, 113,322 functions, five seconds of parsing — and the map at that size is
   * directories and files, with the layout rolling three and a half thousand files up as too
   * thin to draw before it ever reaches their insides. So the tree arrives without them (see
   * `Node::slim`) and a file's ring is asked for when there is somewhere to put it.
   *
   * Which files: the ones wide enough to show an inside, judged the way the layout judges
   * it — a share of the focused subtree — plus whatever is drilled into or open in the code
   * view. On a small repo that is every file, one round trip each, and the map fills in
   * within a frame or two of opening. On ceph it is a few dozen.
   */
  const [fns, setFns] = useState<Map<string, Node[]>>(new Map())
  /** What the MAP has asked for, held as a list so the fetch below can union it in.
   *
   *  Compared before it is stored, on the rule every poll in this file follows: the map
   *  reports on each layout, and a fresh array naming the same paths would re-run a fetch
   *  effect that walks the focused subtree, on every one of them. */
  const [wanted, setWanted] = useState<readonly string[]>([])
  const wantRings = useCallback((paths: readonly string[]) => {
    setWanted((prev) =>
      prev.length === paths.length && prev.every((p, i) => p === paths[i]) ? prev : [...paths],
    )
  }, [])
  const asked = useRef(new Set<string>())
  /** Which project the fetches above belong to, for answers that outlive the click that
   *  asked for them. */
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeKey
  useEffect(() => {
    // A different project is a different set of paths, and holding another repo's would
    // graft its functions onto a file with the same name.
    //
    // A new TREE for the same project clears them too: the first map of a launch comes from
    // the cache before the backend holds the functions to answer with (see
    // `AppState::shallow`), so those fetches come back empty. Kept, they would be a file
    // whose ring never arrives — the emptiness cached as if it were an answer.
    //
    // **`treeRev`, and emphatically not `scan`.** A tree ARRIVING is what invalidates these;
    // `scan` also changes every time readings or streamed scores are folded into the tree
    // already on screen, which is a new object describing the same files. Keyed on `scan`,
    // this fired on the 2s reading poll: a repo with any readings at all threw away every
    // function ring twice a minute, redrew without them, and re-fetched — a map at rest
    // flickering on a two-second period, which is the timer's signature and not the
    // renderer's. Measured off a screen recording: 891 functions, then 0, then 891.
    asked.current.clear()
    landed.current = new Map()
    setFns(new Map())
  }, [activeKey, treeRev])
  /** The tree with whatever rings have arrived spliced in.
   *
   *  Rebuilt when a fetch lands rather than mutated: every consumer below memoises on the
   *  tree's identity, and a mutation would leave the map, the panel and the percentiles each
   *  believing a different version of the same repo. */
  const filled = useMemo(() => {
    if (!drawn || fns.size === 0) return drawn
    // **Only the branches that changed are rebuilt.** It cloned every node it walked, so a
    // ring arriving for one file in `drivers/net/ethernet/mellanox` produced a fresh copy of
    // all of linux — tens of thousands of objects — and handed every consumer below a tree
    // whose every node was new, defeating each of their memos in turn. Returning `n` itself
    // when nothing underneath it moved keeps the untouched 99% shared by reference, which is
    // what those memos are for; identity still changes all the way up from a real graft, so
    // the rule this rests on holds — a node is a new object exactly when it means something
    // new.
    const graft = (n: Node): Node => {
      if (n.kind === 'file') {
        const got = fns.get(n.path)
        // **Readings are folded in HERE, and nothing else reaches these nodes.** The tree
        // being grafted into has already been through `applyAgentReports`, which ran when it
        // held no functions at all — so a ring spliced in raw is a ring whose readings never
        // arrive, which is how a repo reporting 69.9% read drew as entirely unread.
        // `readIntoRing` returns the same array when nothing moved, so a reading poll that
        // changed nothing does not rebuild the file.
        return got ? { ...n, children: readIntoRing(got, readings.current), funcs: 0 } : n
      }
      let moved = false
      const kids = n.children.map((c) => {
        const next = graft(c)
        if (next !== c) moved = true
        return next
      })
      return moved ? { ...n, children: kids } : n
    }
    return graft(drawn)
    // `readingRev` and not `readings`: the ref is mutated in place so its identity never
    // changes, and the counter is what says a poll brought something new — see `keepReadings`.
  }, [drawn, fns, readingRev])

  const tree = histRoot ?? filled

  /** Jump the playhead and stop. Stable across renders on purpose: `CommitLog` memoises
   *  its rows against this, and an inline arrow would rebuild every row on every frame —
   *  the exact cost that component is written to avoid.
   *
   *  **It waits for the story to reach the commit before going there.** The fold is a
   *  sequence: drawing commit ninety thousand means having applied the eighty-nine thousand
   *  before it. Clicking a row far ahead of what has arrived therefore fetches the blocks
   *  between — which is the one place this design costs a wait, and the reason `loaded` is
   *  reported: the bar can say the story is still coming rather than looking hung. */
  const scrubTo = useCallback(
    (i: number) => {
      setPlaying(false)
      const held = history
      if (held && i >= held.deltas.have()) {
        void held.deltas.ensure(i, setLoaded).then(() => {
          setLoaded(held.deltas.have())
          setHistIndex(Math.min(i, held.deltas.have() - 1))
        })
        return
      }
      setHistIndex(i)
    },
    [history],
  )

  /** History was asked for and this repo has none. Stated rather than drawn as an empty
   *  circle: a map with no wedges and no sentence reads as a bug in the tool. */
  const historyEmpty =
    historyOn && history !== null && historyKey === activeKey && history.tables.commits === 0

  /** Is the replay actually the thing on screen?
   *
   *  **Asked for is not arrived.** Opening a replay is a fetch, and on a large repo it is
   *  a fetch you can watch happen: for those few hundred milliseconds `historyOn` is true
   *  while the map is still drawing TODAY. Everything that dresses the window for a replay
   *  — the lens, the sort order, the morphing — was keyed on the request rather than on the
   *  arrival, so pressing History repainted the live map in Age's greens, and then repainted
   *  it again as the replay's first frame. Two full redraws of a picture nobody asked to see.
   *  Keyed on the frame existing, all of it happens once. */
  const replaying = historyOn && histRoot !== null

  /** The lens, replaying or not. **It used to be pinned to `age` while a replay was on
   *  screen**, and the switcher greyed with it — right about the four lenses a reading
   *  paints, and a blunt instrument for the rest, because a frame carries its own churn,
   *  age and language and could always have painted them. What a replay can and cannot
   *  show is `REPLAY`, one lens at a time; what it does about the ones it cannot is say so
   *  in the map rather than change what you are standing in. */
  /** Which lenses have nothing in them, and what would change that — see `Locked`.
   *
   *  **A lens with nothing to show is locked, not shown empty.** The first shape of this was
   *  a dimmed tab and a banner over the map; the second was the switcher greyed wholesale
   *  during a replay. Both made the user press something to find out. A lock is legible
   *  before the click, and its colour says whether a button exists that opens it.
   *
   *  Decided here because the answers come from three places — the project's readings, the
   *  repo's git history, this language's wiring — and the order matters: a replay's limits
   *  are true whatever the repo holds, so they are asked first.
   */
  const locks = useMemo(() => {
    const out: Partial<Record<ColorMode, Locked>> = {}
    for (const m of Object.keys(MODE_LABEL) as ColorMode[]) {
      if (replaying) {
        if (REPLAY[m] !== 'live') out[m] = { why: replayNote(m) ?? '', keyed: false }
        continue
      }
      if (!tree) continue
      if (paintsFromReadings(m) && (activeProject?.assessed ?? 0) === 0) {
        out[m] = {
          why: 'No readings yet. Press Read on the project to fill Surprise, Legibility, Docs and Traps.',
          keyed: true,
        }
      } else if (paintsFromWiring(m) && tree.resolvable === null) {
        out[m] = {
          why: `${MODE_LABEL[m]} needs this language's calls read off its grammar, which Sanity does not do for it. A guessed edge would be worse than a stated absence.`,
          keyed: false,
        }
      } else if (
        (m === 'blame' || m === 'churn' || m === 'age') &&
        activeProject?.trace_depth === 'untraced'
      ) {
        // **Asked BEFORE "no history", because an untraced repo also has no ages in it** and
        // the two absences are opposite claims: this one is work nobody has paid for, and the
        // one below is a fact about the folder. Reporting the second when the first is true
        // tells somebody their repo has no git in it while its log sits there unread.
        out[m] = {
          why: `${MODE_LABEL[m]} reads git, and this repo's history has not been read yet. Press Trace on the project.`,
          keyed: true,
        }
      } else if ((m === 'blame' || m === 'churn' || m === 'age') && tree.score?.ageDays === null) {
        out[m] = {
          why: `${MODE_LABEL[m]} reads git, and this folder has no history.`,
          keyed: false,
        }
      }
    }
    return out
  }, [replaying, tree, activeProject])

  /** What the map is actually painted with.
   *
   *  **The lens you chose, unless this repo cannot answer it — and choosing does not change
   *  your choice.** The fallback used to be an effect that called `setMode('language')`, which
   *  worked once and then lost the preference: open an unread project and Surprise was gone
   *  for good, so every project after it opened on Language too. Derived instead, the
   *  preference survives being unanswerable — switch to a repo with readings, or finish a
   *  pass on this one, and the lens you picked comes back on its own.
   *
   *  A staged export overrides both, for the length of a recording: the file is a copy of
   *  what is on screen, so choosing a lens there means changing the map. It goes back when
   *  the dialog closes, because `staged` does. */
  const viewMode: ColorMode = staged?.mode ?? (locks[mode] ? 'language' : mode)

  // The wedge the sunburst is currently rooted at, resolved by id every render so a
  // rescan keeps the user where they were rather than throwing them back to the top.
  const focus = useMemo(() => {
    if (!tree) return null
    let node: Node = tree
    for (const id of stack) {
      const next = findById(tree, id)
      if (!next) break
      node = next
    }
    return node
  }, [tree, stack])

  /** Open the replay, or leave it — the History button's own action.
   *
   *  A callback rather than the button's inline handler because the keyboard reaches it too,
   *  and the RULE has to travel with the action: entering needs something to show, leaving is
   *  always allowed. The button spells that as `disabled`, which the keyboard cannot see, and
   *  a control that is grayed in one place and live on the other is not disabled. */
  const toggleHistory = useCallback(() => {
    if (!focus) return
    if (!historyOn && (historyBusy || (activeProject?.replayed ?? 0) === 0)) return
    setHistoryOn((v) => !v)
    setPlaying(false)
    // Selection and drill-in survive the switch by id, but a selected FUNCTION usually will
    // not exist in the frame under the playhead — and a panel describing a function the rings
    // are not drawing is worse than an empty one.
    setPicked(null)
  }, [focus, historyOn, historyBusy, activeProject?.replayed])

  // Cmd-1..9 then Cmd-0 for the lenses, in the order they appear in the switcher, then Cmd--
  // for the eleventh. Cmd-+ toggles the replay.
  //
  // Derived from `MODE_LABEL`'s key order rather than a second list, so the digit always
  // matches the position on screen — the two cannot drift because there is only one order.
  // The cost is that reordering renumbers: the row is grouped by what paints it — readings,
  // then language, then the git-derived three in widening time windows — so the digits
  // follow meaning rather than history. See `MODE_LABEL`.
  //
  // The whole app is one geometry under seven encodings, and the question you are asking
  // changes far more often than anything else you can do here — reaching for the mouse
  // to change it costs more than the change is worth. Cmd rather than a bare digit
  // because a bare digit is a character, and one text field anywhere later would make
  // this a bug rather than a shortcut.
  //
  // **The two keys past the digits sit either side of the row for a reason.** Minus reaches
  // the lens the digits ran out before — a tenth lens takes ⌘0, and the eleventh had a
  // tooltip promising ⌘1, a key that selects the FIRST lens. Plus is the one shortcut that
  // is not a lens at all, and it is the one that has to keep working while the replay is up,
  // because it is also the way back out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // **What the press MEANS is decided in `lib/keys.ts`, and this only carries it out.**
      // It was eleven early returns in here, and adding one key to the pile silently cost the
      // lens digits — with no way to see which return had eaten them but to read the pile
      // again. The order of the guards is the behaviour, so the guards are a function now and
      // `just keys-check` presses every key in every state.
      const at = e.target as HTMLElement | null
      const act = actOf(
        { key: e.key, meta: e.metaKey, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey },
        {
          typing:
            !!at &&
            (at.isContentEditable ||
              at.tagName === 'INPUT' ||
              at.tagName === 'TEXTAREA' ||
              at.tagName === 'SELECT'),
          finding,
        },
      )
      if (!act) return
      // Every act claims its key. `⌘-` is the browser's zoom and Tab is its focus walk, so a
      // shortcut that decided to do nothing must still not let those through.
      e.preventDefault()
      if (act.do === 'find') setFinding(true)
      else if (act.do === 'history') toggleHistory()
      else setMode(act.mode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleHistory, finding])

  /** Ask for the rings the map is about to draw.
   *
   *  Runs on what is FOCUSED, not on the whole repo: drilling into a directory is exactly
   *  the gesture that makes its files wide enough to have insides, and a policy written
   *  against the root would fetch the same few dozen files whatever you were looking at.
   *
   *  `MIN_SHARE` is the layout's own threshold, one ring out: a wedge below about a
   *  quarter of a degree is not drawn, so a file below that share of its parent has no
   *  inside worth having. The code view's file is always asked for, because that one is not
   *  a wedge at all. */
  useEffect(() => {
    if (!activeKey || !focus) return
    const MIN_SHARE = 0.0025
    const want: string[] = []
    const walk = (n: Node) => {
      if (n.kind === 'file') {
        if (n.funcs > 0 && n.loc / Math.max(focus.loc, 1) >= MIN_SHARE) want.push(n.path)
        return
      }
      for (const c of n.children) walk(c)
    }
    walk(focus)
    // **And whatever the MAP says it has room for.** The share above is a stand-in for that
    // question, asked by the one party that cannot see the answer — see `onWantRings`. It
    // stays as the opening guess, because it needs no picture to have been drawn yet; what
    // it cannot do is be right about a repo of four million lines, where a quarter of a per
    // cent is ten thousand and it refuses every file there is. Unioned rather than swapped:
    // what the map can hold is the better answer only once there IS a map.
    for (const path of wanted) want.push(path)
    if (codeFile) want.push(codeFile)

    const key = activeKey
    // **`asked` means IN FLIGHT, and `fns` is the record of what arrived.** It used to mean
    // "asked for at some point", which is the same thing only while nothing is ever dropped
    // — and rings are dropped, every time a tree arrives and the clear below empties `fns`.
    // A path caught between landing and being flushed was then in neither: not in `fns`, so
    // nothing drew it, and still in `asked`, so nothing asked again. The panel sat empty
    // until something unrelated moved. Split, the same accident is self-correcting: a ring
    // that goes missing is a path that is neither held nor in flight, which is exactly the
    // condition for asking.
    //
    // **One call for the whole drill.** Rust finds these by walking the tree, so asking file
    // by file walked all of linux once per file — see `fileFunctions`.
    const fresh = want.filter((path) => !fns.has(path) && !asked.current.has(path))
    if (fresh.length === 0) return
    for (const path of fresh) asked.current.add(path)
    void fileFunctions(key, fresh)
      .then((got) => {
        for (const path of fresh) asked.current.delete(path)
        // Ignore an answer for a project nobody is looking at any more: the fetch is slow
        // enough to outlive a click on another row.
        if (activeRef.current !== key) return
        // **Parked, not applied.** Applying them as they arrive meant one rebuild of the
        // tree apiece — see `landed`.
        for (const [path, ring] of got) landed.current.set(path, ring)
      })
      .catch(() => {
        for (const path of fresh) asked.current.delete(path)
      })
    // `fns` is a dependency because it is now half the question: what has arrived decides
    // what is still worth asking for, so a flush has to re-open it.
  }, [activeKey, focus, codeFile, fns, wanted])

  /** Rings that have arrived and are waiting to be spliced in together.
   *
   *  **Drilling asks for every file in a directory at once, and each answer used to cost a
   *  rebuild of the whole repo.** `filled` walks the tree to graft, so applying sixty
   *  answers one at a time walked linux's tree sixty times, re-laid the sunburst out sixty
   *  times, and re-rendered every arc sixty times — for one drill. That is the delay, and it
   *  scales with how interesting the directory is.
   *
   *  Batched on the same argument as the streamed scores and the shape above, and drained
   *  BEFORE the updater rather than inside it: an updater with a side effect is called twice
   *  under StrictMode and the second call keeps the result — which is how the assembling map
   *  came to stay empty for a whole afternoon. */
  const landed = useRef<Map<string, Node[]>>(new Map())
  useEffect(() => {
    const timer = setInterval(() => {
      const batch = landed.current
      if (batch.size === 0) return
      landed.current = new Map()
      setFns((prev) => {
        const next = new Map(prev)
        for (const [path, got] of batch) next.set(path, got)
        return next
      })
    }, 120)
    return () => clearInterval(timer)
  }, [])

  /** What the timeline has been narrowed to: the path of whatever the rings are rooted
   *  at, and `''` at the top. Drilling into a directory asks a narrower question — "how
   *  did THIS come to be" — and a transport still addressing the whole repo answers a
   *  different one, spending most of its length on commits that change nothing on screen.
   *
   *  Read off `focus`, so the scope follows the picture rather than being a second place
   *  the user has to say where they are. */
  const scope = historyOn && focus && tree && focus.id !== tree.id ? focus.path : ''

  /** The repo's remote as `owner/name`, for the caption on an exported movie — or null
   *  where there is no remote to name.
   *
   *  Asked once per repo rather than carried on the project row: it is one `git` call, the
   *  only thing that reads it is an export, and a field on a row that is re-fetched on a
   *  poll is a value re-fetched on a poll. */
  const [remote, setRemote] = useState<string | null>(null)
  useEffect(() => {
    setRemote(null)
    if (!repoPath) return
    let live = true
    void repoRemote(repoPath).then((r) => {
      if (live) setRemote(r)
    })
    return () => {
      live = false
    }
  }, [repoPath])

  /** The commits in scope, as indices into the full timeline.
   *
   *  A view of the timeline, never a re-fold of it: `histIndex` stays a REAL commit index
   *  and the rings are always built at that commit. A commit outside the scope cannot
   *  change what is inside it, so the narrowed list is complete for what is drawn — and
   *  keeping the real index is what makes drilling in and popping back out land you on the
   *  same commit rather than somewhere proportional. */
  const [frames, setFrames] = useState<number[]>([])
  useEffect(() => {
    if (!history || !repoPath) {
      setFrames([])
      return
    }
    // Asked of the backend, which holds the story — see `history::scoped`. It was computed
    // here from every commit's file list, and that list is the one part of a frame the window
    // no longer receives.
    let live = true
    void historyScoped(repoPath, scope)
      .then((got) => {
        if (live) setFrames(got)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [history, repoPath, scope])

  const codeNode = useMemo(
    () => (tree && codeFile ? findById(tree, codeFile) : null),
    [tree, codeFile],
  )

  const selected = useMemo(
    () => (tree && picked ? (findById(tree, picked.id) ?? picked) : null),
    [tree, picked],
  )

  /** Show me inside this. Shared by the ring and by the detail panel's contents list,
   *  so the gesture means the same thing wherever it is made. */
  /** The rank lookup and the age span, memoised.
   *
   *  They were computed inline at two call sites, so every render walked the whole tree
   *  twice — and, being fresh objects, they defeated any memo on the components below.
   *  `Sunburst` renders every arc in the repo, so that is the difference between opening a
   *  dialog and rebuilding the map behind it. */
  /** **Ranked over what is on screen, not over the repo.** The eight slots go to the eight
   *  biggest categories, and which eight that is depends entirely on where you are standing:
   *  in `drivers/net/ethernet/broadcom` the repo's top eight authors are Alex Deucher and
   *  Jani Nikula and six others who have never touched it, so three colours were spent and
   *  the people who actually wrote the directory — 250 lines, 178 lines — were grey. A map
   *  that answers "who wrote this" with `other` for its own authors is not answering.
   *
   *  The cost is that an author is not promised one colour for the whole repo: drill in and
   *  the same person may take a different slot, or arrive from `other`. That is the right
   *  trade — the palette is eight slots deep against repos with thousands of authors, so a
   *  stable colour was never on offer past the top eight anyway, and what it bought was a
   *  drilled view coloured for somewhere else.
   *
   *  **A frame of a replay is not a drill, and that distinction is the memo below.** Both
   *  hand this a different tree; only one of them is a different QUESTION. */
  /** The same drill, resolved against TODAY rather than against the frame on screen.
   *
   *  A replay hands `focus` a different tree every commit, which is what `langRank` cannot
   *  be ranked over. Standing somewhere is a fact about the drill stack, so it can be asked
   *  of the live tree at any playhead; a path that does not exist at HEAD stops the walk and
   *  the ranking is the nearest live ancestor's, which is coarser and still stable. */
  const liveFocus = useMemo(() => {
    if (!filled) return null
    let node: Node = filled
    for (const id of stack) {
      const next = findById(filled, id)
      if (!next) break
      node = next
    }
    return node
  }, [filled, stack])

  /** Author → colour slot, ranked once over the whole log and used everywhere.
   *
   *  **It was two rankings, and the second one was a split brain nobody had named.** Replaying
   *  used `stats.authors`; standing still used the lines under your feet. Same people, same
   *  spelling, different slots — so opening History recoloured the entire cast, and the last
   *  frame of a story disagreed with the same repo sitting still. That is the invariant this
   *  now holds: **the end of the replay is the live map.** A story that arrives somewhere
   *  other than where you already were is not the same repo told forwards.
   *
   *  **Replaying, a person is an IDENTITY**, and three rules were tried before this that each
   *  went grey somewhere. Ranking every frame recoloured the cast as it ran. Seeding from
   *  today's ranking made the opening grey, because the people who start a repo are rarely its
   *  biggest by the end — ceph's `rgw` opened on six authors and drew `other (6)`. Assigning
   *  by arrival made the ENDING grey: the first sixteen held the palette forever and their
   *  lines are gone by 2026. All three derived identity from whatever happened to be visible.
   *  `stats.authors` is the whole repo's cast, ranked once over the whole log, so a person's
   *  place in it does not depend on the playhead — and now does not depend on the drill
   *  either.
   *
   *  **What this gives up is real and it was chosen with the cost in front of us.** Live, a
   *  person used to be a category of the picture in front of you: standing in one directory of
   *  kibana, its biggest authors are not the repo's, so a repo-wide order spends the named
   *  slots on people with nothing on screen. That argument was written when past the palette
   *  was one shared neutral, and it is why drilling recoloured. It no longer ends in grey —
   *  sixty-four colours recycling out to a thousand mean a drilled directory's people still
   *  get colours of their own, they just do not get NAMED in a legend that holds sixteen. A
   *  caption is the price now; it used to be the picture.
   *
   *  The remaining fallback is for a repo whose backend sent no cast at all — an older build,
   *  or one with no history — where ranking what is on screen is the only ranking there is.
   *  `langRank` still ranks over the drill: a language is genuinely a property of the code in
   *  front of you and there is no cast of them spanning a story, so the two lenses differ here
   *  on purpose rather than by neglect. */
  const authorRank = useMemo(() => {
    const cast = scan?.stats.authors ?? []
    if (cast.length > 0) return new Map(cast.map((name, i) => [name, i]))
    if (!liveFocus) return null
    const here = rankCategories(liveFocus, 'blame')
    return here.size > 0 ? here : null
  }, [scan, liveFocus])
  /** Language → colour slot, ranked over the VIEW but not over the FRAME.
   *
   *  **A language is a category of the picture in front of you and that is why it is ranked
   *  where you are standing** — six of them in this directory, the sixth of which matters —
   *  which is the one thing that stays different from `authorRank`. What a replay does is
   *  hand that ranking a new tree thirty times a second, so the mix shifts as the story runs
   *  and a file changes colour without changing language: the Blame lens was fixed for
   *  exactly this and Language was left animating its own legend.
   *
   *  A drill is a different question and a frame is not, so the scope is the drill and the
   *  tree is the LIVE one — the same map the ranking already had when History was pressed,
   *  which is what keeps entering a replay from recolouring anything.
   *
   *  **Today cannot rank what today has not got.** A repo that migrated off a language has
   *  no wedge at HEAD to rank it by, so its whole era would open in `other` — the mistake
   *  `authorRank` records from the other side. `historyLangs` supplies that tail, after
   *  everything the live map holds, so the live order is untouched and a vanished language
   *  still gets a colour of its own. */
  const langRank = useMemo(() => {
    if (!liveFocus) return undefined
    const m = rankCategories(liveFocus, 'language')
    const tables = historyOn && history && historyKey === activeKey ? history.tables : null
    if (tables) {
      let slot = m.size
      for (const lang of historyLangs(tables, drilled)) {
        if (!m.has(lang)) m.set(lang, slot++)
      }
    }
    return m
  }, [liveFocus, historyOn, history, historyKey, activeKey, drilled])

  const ranks = useMemo(() => {
    const at = focus ?? tree
    if (!at) return undefined
    // The fallback is the old behaviour, for a backend too old to send the list: ranking what
    // is on screen is wrong in a way somebody can see, where an empty map is not.
    //
    // **The cap is applied HERE and nowhere else.** Everything downstream — the wedges, the
    // rim, the panel's breakdown, the legend, the movie key — already agrees that a category
    // with no rank is `other`, so dropping the entries past the cap is the whole of what the
    // control has to do. See `capRanks`.
    const cap = isCapped(viewMode) ? caps[viewMode] : Infinity
    if (viewMode === 'blame' && authorRank) return capRanks(authorRank, cap)
    if (viewMode === 'language' && langRank) return capRanks(langRank, cap)
    return capRanks(rankCategories(at, viewMode), cap)
  }, [focus, tree, viewMode, authorRank, langRank, caps])
  /** The key a movie carries, for whichever lens it is being recorded in.
   *
   *  **Built here because this is the side that knows the ranking.** `movie.ts` draws it into
   *  the caption column and resolves the colours against the staged map, so what crosses is
   *  custom-property NAMES and labels — never resolved values, which would come out in the
   *  ground the window happens to be wearing rather than the one the file is written on.
   *
   *  A movie needed no key while every replay was the age ramp with two flashes; it needs one
   *  now that a recording can be any lens the replay paints, because a Blame film is sixteen
   *  colours with nothing saying whose. */
  /** The live one, so a caller holding this across frames sees the current tree.
   *
   *  **An export holds it for the length of a recording.** `record` takes the callback once
   *  and asks it again at every commit; a plain `useCallback` closes over the tree it was
   *  built with, so every frame of a twenty-minute film would carry the key of the frame the
   *  dialog opened on. The ref is what makes "ask again" mean "ask about now". */
  const keyNow = useRef<(m: ColorMode) => MovieKey | null>(() => null)
  const keyFor = useCallback(
    (m: ColorMode): MovieKey | null => {
      const at = focus ?? tree
      if (!at) return null
      const ends = RAMP_ENDS[m]
      if (ends) {
        return {
          title: MODE_LABEL[m],
          entries: [],
          more: 0,
          // The stops themselves rather than a smoothed bar: the ramp has five and the map
          // paints between them, so five swatches is the honest picture of the scale.
          ramp: {
            tokens: [0, 0.25, 0.5, 0.75, 1].map((t) => rampStop(t, rampOf(m))),
            ends,
          },
        }
      }
      const cats = legendFor(at, m)
      // Capped like the map's own ranking — a film is a recording of what was on screen, and
      // a key naming sixteen people over a picture drawing eight is the legend-disagrees-with-
      // the-map failure this file has already paid for twice.
      const cap = isCapped(m) ? caps[m] : Infinity
      const slots =
        (m === 'blame' && authorRank
          ? capRanks(authorRank, cap)
          : m === 'language' && langRank
            ? capRanks(langRank, cap)
            : capRanks(rankCategories(at, m), cap)) ?? new Map<string, number>()
      const named = cats
        .filter((c) => (slots.get(c) ?? Number.MAX_SAFE_INTEGER) < NAMED)
        .sort((a, b) => (slots.get(a) ?? 0) - (slots.get(b) ?? 0))
      return {
        title: MODE_LABEL[m],
        entries: named.map((label) => ({
          label,
          token: slotColor(slots.get(label) ?? Number.MAX_SAFE_INTEGER)
            .replace(/^var\(/, '')
            .replace(/\)$/, ''),
        })),
        more: cats.length - named.length,
        ramp: null,
      }
    },
    [focus, tree, authorRank, langRank, caps],
  )
  keyNow.current = keyFor
  /** Stable across renders, and current when called — see `keyNow`. */
  const keyLive = useCallback((m: ColorMode) => keyNow.current(m), [])

  /** The repo's own span for the age ramp. Never consulted during a replay: a frame's
   *  colour is a flare measured in commits, not a position on this scale — see
   *  `Score.recency`. */
  const ageSpan = useMemo(() => (tree ? ageSpanOf(tree) : undefined), [tree])
  /** Stable identities, because an inline lambda makes the memo below do nothing. */
  const pick = useCallback((n: Node) => setPicked(n), [])
  const clearPick = useCallback(() => setPicked(null), [])

  const drill = useCallback(
    (n: Node) => {
      // A file drills like a directory: into its own ring, where its functions get the
      // whole circle instead of a 60px band. It used to jump straight to the source, and
      // that made "show me inside this" mean two different things one level apart —
      // descend for a directory, leave the map for a file. Reading the code is still one
      // gesture away, on the function you actually want; it is just no longer the only
      // thing a file can do.
      if (n.kind === 'func' && tree) {
        // A function has no view of its own — it lives in a file. Drilling one opens that
        // file and scrolls to it.
        const file = parentOf(tree, n.id)
        if (file) {
          setCodeFile(file.id)
          setPicked(n)
          setReveal((r) => ({ id: n.id, n: (r?.n ?? 0) + 1 }))
          return
        }
        // The overflow aggregate is synthesised at layout time, so it has no parent in
        // the tree and `parentOf` finds nothing. Drilling it means "show me the functions
        // you could not draw", which is the file's own ring — reached by its path, since
        // a file node's id IS its path.
        const owner = findById(tree, n.path)
        if (owner) {
          setStack((st) => [...st, owner.id])
          setPicked(owner)
          return
        }
        return
      }
      setStack((st) => [...st, n.id])
      setPicked(n)
    },
    [tree],
  )

  /** The selected project when it is still being rescanned by the startup restore, so the
   *  pane can show its progress instead of the copy for someone who has no projects. */
  const loadingProject = useMemo(
    () => projects.find((p) => p.key === activeKey && p.loading) ?? null,
    [projects, activeKey],
  )

  /** The project the empty pane is waiting on, whether or not one has been selected yet.
   *
   *  A launch has a window between "the list has arrived" and "a tree has been built from
   *  one of them", and during it nothing was selected — so the pane fell through to the
   *  first-run card and told somebody with three projects to go and study their first. A
   *  list with anything in it is never that state; the honest answer is which project is
   *  being read. `projects[0]` because the restore takes them in order and the pane is
   *  naming a wait, not addressing a selection. */
  const awaiting = useMemo(
    () => loadingProject ?? (projects.length > 0 ? (activeProject ?? projects[0]) : null),
    [loadingProject, projects, activeProject],
  )

  const awaitingKey = awaiting?.key ?? null

  /** The assembling map, or nothing until enough of it has arrived to be worth drawing.
   *
   *  The threshold is not politeness — a sunburst of one directory is a solid disc, and
   *  watching the repo appear only works if what appears first is recognisably a repo.
   *  Below it the pane keeps the wait it already had. */
  const shapeRoot = useMemo(
    () =>
      // Only for the repo it is OF. The accumulated shape outlives the scan that produced
      // it — nothing clears it until another repo starts streaming — so without this a
      // project that arrives with no shape of its own would be handed the last one's, drawn
      // under its own name: a map of the wrong repo, and nothing on screen saying so.
      shape.length >= SHAPE_FLOOR && awaitingKey !== null && streamingKey === awaitingKey
        ? shapeTree(shape, awaiting?.name ?? 'repo')
        : null,
    // The two FIELDS, never the object: `awaiting` is rebuilt by every poll, and this
    // memo folds 45,000 files. Depending on the object would rebuild the whole tree
    // 1.5 seconds apart for the length of a scan — the same trap the frame tree fell into.
    [shape, awaitingKey, awaiting?.name, streamingKey],
  )

  /** The awaited scan's own progress, built once for both the things that show it.
   *
   *  **The map assembling is not the same news as how far along the scan is, and it stopped
   *  being enough on its own.** The pane and the assembling map were alternatives — a bar
   *  until there was a picture, then the picture and nothing else — which was right while
   *  the parse was the whole wait. It is not: the parse of linux finishes at 45k files with
   *  the rings fully drawn, and the blame pass then runs for hours behind a map that looks
   *  finished and says nothing. So they are not alternatives; the strip rides over the map.
   */
  const awaitingProgress: Progress | null = useMemo(
    () =>
      awaiting?.loading && awaiting.read_total > 0
        ? {
            done: awaiting.read_done,
            total: awaiting.read_total,
            // Carried, not dropped. Rebuilding a `Progress` from the two numbers the row
            // happened to need is how the pane came to print a count with no idea what
            // phase produced it or what it counted.
            phase: awaiting.read_phase,
            unit: awaiting.read_unit,
          }
        : null,
    [awaiting],
  )

  /** Where each directory and file sits while the map assembles, so it does not reshuffle.
   *
   *  **A ring sorted by size cannot be watched while the sizes are still arriving.** The
   *  sunburst orders siblings by lines, which is right for a finished map and wrong for one
   *  being built: every batch of files changes every directory's size, so every wedge
   *  reorders and the map jumps rather than fills.
   *
   *  First seen, first placed. A directory keeps the slot it took when it appeared and new
   *  work lands after it — the picture grows outward instead of rearranging. `sortBy` wants
   *  bigger-is-earlier, so the rank is negated. The finished tree sorts by size as it always
   *  has: one reshuffle, at the moment the real map arrives, instead of one per batch. */
  const shapeOrder = useRef(new Map<string, number>())
  useEffect(() => {
    if (shape.length === 0) shapeOrder.current = new Map()
  }, [shape.length])
  const shapeSort = useMemo(() => {
    const at = shapeOrder.current
    for (const f of shape) {
      // Every ancestor, so directories are ranked by when their first file showed up.
      for (let cut = f.path.length; cut > 0; cut = f.path.lastIndexOf('/', cut - 1)) {
        const id = f.path.slice(0, cut)
        if (!at.has(id)) at.set(id, -at.size)
        if (id.indexOf('/') === -1) break
      }
    }
    return at
  }, [shape])

  /** The splash comes down here, not after the first paint. See `lib/splash.ts`.
   *
   *  Ready means the window has something true to say. That used to be a MAP — or, with the
   *  list fetched and genuinely empty, the card telling you how to get one — and everything
   *  else was the app booting, which the wordmark covered.
   *
   *  **The wait grew a picture, and the wordmark was sitting on it.** A first scan of a large
   *  repo now names what it is reading, moves a real bar as files are parsed and blamed, and
   *  draws the map assembling out of the parse. All of that happened under the splash: six
   *  seconds of wordmark, then two of a bar, then the finished map — the two things built to
   *  describe the wait, shown for the moment after it ended.
   *
   *  So the list arriving is enough. At that point the sidebar has its projects, the pane has
   *  the project it is waiting on, and neither is a guess. */
  const booted = focus !== null || shapeRoot !== null || projectsLoaded
  useEffect(() => {
    if (booted) dismissSplash()
  }, [booted])
  // Where a launch's time actually went. See `lib/stopwatch.ts`.
  useEffect(() => {
    if (tree) marked()
  }, [tree])

  /** The ancestry of what is on screen: root first, focus last.
   *
   *  Walked up the TREE, not read off the drill stack. The stack records where you
   *  clicked, and drilling from the root straight into a nested directory puts one entry
   *  in it — so a crumb built from it read `cluster / Store` for a directory that
   *  actually lives at `Sources/ClusterCore/Store`. That is a history, and a history is
   *  not a location; the bar is supposed to answer "where am I", which only the tree
   *  knows.
   *
   *  Splitting the focused node's path string would be the other way, and it does not
   *  work: the scan collapses single-child directory chains, so the segments of a path
   *  do not all correspond to nodes. `parentOf` walks what is really there. */
  const trail = useMemo(() => {
    if (!tree || !focus) return []
    const out: Node[] = []
    let n: Node | null = focus
    while (n) {
      out.unshift(n)
      n = n.id === tree.id ? null : parentOf(tree, n.id)
    }
    return out
  }, [tree, focus])

  /** What CONTAINS the selection, root-side first and the repo itself left off.
   *
   *  Walked with `parentOf` rather than split off `node.path`, for the reason `trail` gives:
   *  the scan collapses single-child directory chains, so a path's segments are not all
   *  nodes. Splitting the string would produce crumbs that cannot be navigated to — which
   *  is the entire point of these ones.
   *
   *  Empty for anything the tree does not hold, which is the synthesised roll-up a file's
   *  band collapses into. The panel falls back to the plain path there rather than offering
   *  a route that does not exist. */
  const owners = useMemo(() => {
    if (!tree || !selected) return []
    const out: Node[] = []
    let n = parentOf(tree, selected.id)
    while (n && n.id !== tree.id) {
      out.unshift(n)
      n = parentOf(tree, n.id)
    }
    return out
  }, [tree, selected])

  /** Show the map this container, WITHOUT dropping the selection.
   *
   *  That is the one thing separating it from `goTo`, and it is the whole gesture: a
   *  function found from a list is a two-pixel sliver of a four-thousand-function ring, so
   *  the outline lands on something too small to see. Drilling to the file it lives in makes
   *  the same wedge a band — but only if the selection survives the trip, or you arrive
   *  somewhere correct with nothing marked. */
  const showIn = useCallback((n: Node) => setStack(tree && n.id === tree.id ? [] : [n.id]), [tree])

  /** Where a `→` in the panel is pointing, until the tree can answer it.
   *
   *  **A jump cannot be a single call, because the thing being jumped to may not exist yet.**
   *  The window is handed a tree with no functions in it (see `Node::slim`) and fetches each
   *  file's ring when the map has somewhere to draw it — so a caller two directories away is
   *  a name and a line, and nothing in the tree. Held as a REQUEST and resolved by the effect
   *  below, which runs again every time a ring lands: ask, wait, select. The alternative —
   *  awaiting the fetch inside the click — would have to splice the answer into the tree
   *  itself, which is `filled`'s job and would be a second grafting path to keep in step. */
  const [heading, setHeading] = useState<{ path: string; line: number } | null>(null)
  const jumpTo = useCallback((path: string, line: number) => setHeading({ path, line }), [])

  useEffect(() => {
    if (!heading || !tree || !activeKey) return
    // A file node's id IS its path — the same fact `drill` leans on for the overflow wedge.
    const file = findById(tree, heading.path)
    if (!file) {
      // Not in this tree at all: an excluded file, or a path from a scan the window has since
      // replaced. Dropped rather than left pending, or the next ring to land would resolve a
      // request nobody remembers making.
      setHeading(null)
      return
    }
    if (file.children.length === 0) {
      if (file.funcs === 0) {
        // Nothing to select inside it. The file itself is the honest landing place.
        setStack(file.id === tree.id ? [] : [file.id])
        setPicked(file)
        setHeading(null)
        return
      }
      // Ask, and come back when it lands. Through the same `asked`/`landed` pair the map's own
      // fetch uses, so a ring already in flight is not asked for twice and the answer is
      // spliced in one batch with everything else that arrives.
      if (!asked.current.has(heading.path)) {
        const path = heading.path
        asked.current.add(path)
        void fileFunctions(activeKey, [path])
          .then((got) => {
            asked.current.delete(path)
            if (activeRef.current !== activeKey) return
            for (const [p, ring] of got) landed.current.set(p, ring)
            // Nothing came back for it. Dropped rather than left pending: `asked` is cleared
            // above, so a request nobody can satisfy would otherwise sit here re-asking on
            // every tree that lands.
            if (!got.has(path)) setHeading(null)
          })
          .catch(() => {
            asked.current.delete(path)
            setHeading(null)
          })
      }
      return
    }
    // By LINE, which is what the panel had to point with: a name is not unique in a file —
    // a dozen `init`s, same-named methods in two `impl` blocks — and picking the first match
    // is how a jump lands on the wrong twin. Falling back to the file is better than landing
    // on a function nobody asked for.
    const target = file.children.find((f) => f.line === heading.line)
    setStack(file.id === tree.id ? [] : [file.id])
    setPicked(target ?? file)
    setHeading(null)
  }, [heading, tree, activeKey])

  /** Jump to any level of the ancestry. Index 0 is the root. */
  const goTo = useCallback(
    (i: number) => {
      setStack(i === 0 ? [] : [trail[i].id])
      setPicked(null)
    },
    [trail],
  )

  /** Go up exactly one level. The stack is rewritten to the parent's id rather than popped,
   *  because `focus` resolves the whole stack from the root every render — a single id is the
   *  canonical way to say "we are here". Undefined at the top, which is what hides the
   *  affordance. */
  const goUp = useMemo(() => {
    if (!tree || !focus || focus.id === tree.id) return undefined
    return () => {
      const p = parentOf(tree, focus.id)
      setStack(p && p.id !== tree.id ? [p.id] : [])
      setPicked(null)
    }
  }, [tree, focus])

  /** Take the map to a search result.
   *
   *  **Three kinds of hit, two mechanisms, and the reason is which of them may not exist in
   *  this window yet.** A container's id IS its path, so a directory or a file can be
   *  re-rooted directly. A function cannot: on a slimmed tree the window has never been sent
   *  one, so `jumpTo` is the right tool — it holds the request, asks for the file's ring, and
   *  selects the function when it lands. That machinery was built for the panel's `→` and it
   *  is exactly this problem, so this is a second caller rather than a second path.
   *
   *  A file goes through `jumpTo` too, with a line no function can have. It resolves to the
   *  file's own ring with the file selected, which is where drilling a file lands you — a
   *  search result and a click should not arrive at two different places.
   *
   *  Nothing found in the window's tree is dropped silently: the finder only offers what the
   *  backend's tree holds, and the two can differ for one moment after a rescan. Landing on
   *  the repo root would be a lie about having gone somewhere. */
  const flyTo = useCallback(
    (hit: Hit) => {
      if (!tree) return
      if (hit.kind === 'dir') {
        const dir = findById(tree, hit.path)
        if (!dir) return
        setStack(dir.id === tree.id ? [] : [dir.id])
        setPicked(dir)
        return
      }
      jumpTo(hit.path, hit.kind === 'func' ? hit.line : -1)
    },
    [tree, jumpTo],
  )

  return (
    <div className="relative flex h-full flex-col">
      {/* The chrome is ONE painted field: the gradient lives here, on the row, and the
          sidebar and the top strip are transparent windows onto it. Painted per element
          they were two gradients that happened to start at the same y — matching until
          anything moved, and separated by a border that ran the full height including
          straight through the titlebar. The content panes sit on top with their own
          surface, so the only edges left are the ones between chrome and content. */}
      <div className="shell-chrome chrome-surface flex min-h-0 flex-1">
        <SideBar
          projects={projects}
          active={activeKey}
          // The replay reports itself on its own project's row. It used to be a strip across
          // the top of the map, which is a surface belonging to whatever project is on
          // screen — so switching away left ceph's 122,818 commits counting over sanity.
          replayKey={busyKey}
          replay={historyProgress}
          // The picker reports its own refusals — a directory holding twelve repos is a
          // sentence worth reading, not a silent no-op. A dismissed dialog resolves null
          // and says nothing, because canceling is not an error.
          onRead={(key) => setReadFor(key)}
          onAdd={addProject}
          onForget={forget}
          onReset={reset}
          onRemintMascot={(key) => {
            forgetMonster(key)
            setRemint((n) => n + 1)
          }}
          onError={setError}
          // **Both pill actions are the same press.** `phasesOf` reports `replay` for the
          // column's last third and `trace` for the first two, which is right for naming what
          // a step DOES — and from the row's side all three are one word being pressed, so
          // they land on one handler that works out where the column has got to.
          onReplay={(key, fresh) => (fresh ? trace(key, true) : chaseTrace(key))}
          onTrace={chaseTrace}
          onScan={(key) => {
            // The same command the Open button uses. One construction site for a project
            // whichever door it came through — the gate lives in the restore lane and in the
            // watcher, and a press is not gated at all.
            const repo = projects.find((p) => p.key === key)?.repo
            if (repo) void scanRepo(repo).catch((err) => setError(String(err)))
          }}
          onStopTrace={(key) => {
            // The chain first: a blame pass that is asked to stop must not have the next
            // phase started for it half a second later. Stopping one step of a sequence
            // somebody set going means the sequence.
            stopChase.current.add(key)
            const repo = projects.find((p) => p.key === key)?.repo
            if (repo) void stopTrace(repo).catch((err) => setError(String(err)))
          }}
          onSelect={(key) => {
            // Selected immediately, before the tree is fetched. A project still being
            // rescanned has no tree to return, and gating the selection on one meant
            // clicking it did nothing at all — no highlight, no pane, no acknowledgement
            // that the click landed. Selection is a statement about what you are looking
            // at; it does not depend on the thing having finished loading.
            setActiveKey(key)
            // Told to the backend as well, because a restart lands on what it has recorded
            // and a click was the one way of choosing a project it never heard about — quit
            // with this one selected and the next launch opened whatever an agent or an
            // `init --show` had focused last. Fire and forget: the window is already showing
            // it, and a failed write costs one launch landing where it used to.
            void selectProject(key).catch(() => {})
            // The poll follows what is on screen, and this IS the screen changing. Both
            // halves, or the next tick sees a revision from the project you just left and
            // refetches a tree you are not looking at.
            const leaving = shown.current
            shown.current = key
            shownRev.current = projects.find((p) => p.key === key)?.scanned ?? 0
            switchTo(leaving, key)
            // Readings fetched WITH the scan, not left to the next poll: `project_scan`
            // returns the proxy-scored tree, so between the two the repo renders gray.
            void Promise.all([projectScan(key), agentReports(key)]).then(([s, reports]) => {
              if (!s) {
                // Nothing to draw yet; the poll picks it up when the rescan lands.
                setTreeRev((n) => n + 1)
                setScan(null)
                return
              }
              setTreeRev((n) => n + 1)
              keepReadings(reports)
              setScan(reports.length > 0 ? { ...s, root: applyAgentReports(s.root, reports) } : s)
            })
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopRow>
            {focus && (
              /* Full width, so the spacers have room to push into — see `Spacer`.
                 **And a drag region itself, because it covers the one that was there.**
                 `TopRow` is the handle, but Tauri drags only when the EVENT TARGET carries
                 the attribute, and this child spans the whole strip — so every pixel of it
                 that is not a control was targeting a plain div and the titlebar had no grip
                 left. That includes the `gap-2` between every control and the `px-3` at both
                 ends, which is most of the empty chrome up here. Children keep taking their
                 own clicks: a button is the target when a button is hit. */
              <div data-tauri-drag-region className="flex w-full items-center gap-2 px-3">
                {/* Disabled rather than hidden while the replay is up. The switcher is the
                  window's statement of what color means, and removing it would leave the
                  rings recolored with nothing on screen saying by what. Grayed, with the
                  reason in the tooltip, it still answers the question. */}
                {/* **Two kinds of choice, and the row is arranged by which is which.**
                    What the color MEANS goes left; what the picture IS — how much of the
                    tree, how thick a band — floats in the middle; the two doors out of it go
                    right.

                    Help leads, because it explains the control it sits before and a question
                    mark after the thing it answers reads as an afterthought. It is also the
                    one control here that is about the app rather than about this repo, which
                    is the corner of a toolbar it belongs in. */}
                <HelpButton on={helping} onOpen={() => setHelping(true)} />
                <ModeSwitcher mode={viewMode} onMode={setMode} locked={locks} />
                {/* **With the lens, because it is a lens control.** It only exists on the two
                    categorical lenses, and what it changes is what a color MEANS — eight
                    people and a gray "other", or four hundred and confetti. That is the
                    switcher's kind of statement, not the ring count's: rings and band change
                    the geometry, and this changes the encoding. */}
                {isCapped(viewMode) && (
                  <ColorCount
                    mode={viewMode}
                    cap={caps[viewMode]}
                    onCap={chooseCap(viewMode)}
                  />
                )}

                <Spacer />

                {/* **In the room the lens strip gave up.** These went to the crumb bar when
                    eleven tabs owned this row — see `ModeSwitcher`, which is one pulldown
                    now. They belong here: the lens says what the map is COLOURED by, and
                    these say how much of it is DRAWN, which is a statement about the same
                    picture from the other side. The crumb bar is about where you are standing
                    in it. Both stay live during a replay, because a frame is drawn by the
                    same layout and they mean there exactly what they mean anywhere else —
                    which is not true of the lens beside them. */}
                <RingCount rings={rings} onRings={chooseRings} />
                <BandWidth share={band} onShare={setBand} />

                <Spacer />

                {/* The two doors. History replaces the subject — the repo as it stood rather
                    than as it stands — and Find gets you somewhere inside the subject you
                    already have. Both leave the picture you were looking at, which is what
                    puts them together and after everything that shapes it. */}
                <HistoryToggle
                  on={historyOn}
                  busy={historyBusy}
                  traced={(activeProject?.replayed ?? 0) > 0}
                  onToggle={toggleHistory}
                />
                <FindButton on={finding} onOpen={() => setFinding(true)} />
              </div>
            )}
          </TopRow>
          <main className="relative flex min-w-0 flex-1 flex-col border-l border-t border-[var(--border)] bg-[var(--background)]">
            {/* Inside the content column, not spanning the window above the chrome.
              Up there it took row 0 for itself — and row 0 belongs to the overlay
              titlebar, whose traffic lights float over the webview at a fixed inset that
              each element occupying that row has to reserve for itself. The strip
              reserved nothing and pushed the sidebar header, which does, out from under
              them, so "Reading the repo…" rendered beneath the buttons. It also shoved
              the whole shell down by its own height every time a scan started. Below
              TopRow it can do neither. */}
            {tree && focus && <Crumbs trail={trail} onGo={goTo} onUp={goUp} />}

            {/* Over the map rather than in the bar. A search box parked in the chrome is a
                control you have to look at forever to use twice a day; summoned by ⌘F it
                costs nothing when it is not wanted, and it lands over the picture it is
                about to move. */}
            <Find
              open={finding}
              projectKey={activeKey}
              replaying={historyOn}
              onClose={() => setFinding(false)}
              onPick={flyTo}
            />

            {/* Mounted only while it is up, unlike `Find`, which holds an index it does not
                want to rebuild. This one is static text and its cost is its own markup. */}
            {helping && <LensHelp onClose={() => setHelping(false)} />}

            {/* `data-chart` is how the key finds the circle it has to wrap around — see
                `useMapEdge`. A marker rather than a class name because the class list here is
                layout that will change, and the key would break silently when it did. */}
            <div data-chart className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              {/* **The export's ground goes here, not on the document.** A recording is a copy
                of the map on screen, so a light file wants a light map — and putting that on
                `<html>` turned the whole app light in front of somebody who had asked for a
                file. The palettes are custom properties and custom properties inherit, so
                one class on the pane dresses everything the map paints with and nothing
                else. See `Staged`, and the `.light` selector in `index.css`. */}
              <div
                className={`relative z-10 h-full bg-[var(--background)]${staged ? ` ${staged.ground}` : ''}`}
              >
                {error ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <p className="max-w-[40ch] text-center text-sm text-[var(--destructive)]">
                      {error}
                    </p>
                  </div>
                ) : historyEmpty ? (
                  <div className="flex h-full items-center justify-center p-6">
                    <p className="max-w-[40ch] text-center text-sm text-[var(--muted-foreground)]">
                      No git history here, so there is nothing to replay. The map beside this is
                      still the repo as it stands.
                    </p>
                  </div>
                ) : focus ? (
                  // A file is no longer a different view. It used to be `FileStack`, a vertical
                  // column reached by a hard cut — the argument being that a file is a sequence
                  // and the ring is a set, which is true and was never the whole of it: the
                  // wedge ALREADY holds a treemap of the file, so what the column really did
                  // was throw away the picture you had just clicked and draw a second one. The
                  // rings now unroll that same tiling into the pane instead. See `unroll.ts`.
                  <Sunburst
                    root={focus}
                    selected={selected}
                    mode={viewMode}
                    ranks={ranks}
                    // The age ramp spans the REPO, not a fixed year — so it comes from the
                    // whole tree even when the view is drilled into one directory. Scoping it
                    // to `focus` would make a wedge change color on the way in, which is the
                    // one thing drilling must not do.
                    ageSpan={ageSpan}
                    // **Never into a replay**, and this is the creature's argument running the
                    // other way. A lease says a reader is opening THIS function right now, and
                    // the marker is keyed by path — `path` for the file, `path#name` for the
                    // function — so on a frame from 2019 it lights whatever happens to sit at
                    // that path in 2019, which is frequently a different function and sometimes
                    // one that has nothing to do with the work. That is a measurement stamped
                    // onto code nobody measured, the same sin as a stale reading keeping its
                    // colour, and it reached a person as black wedges flashing through an
                    // exported movie of a repo's first year.
                    //
                    // Keyed on `replaying` rather than `historyOn` for the reason the lens and
                    // the legend are: the request comes a few hundred milliseconds before the
                    // first frame, and until that frame exists the live map is still on screen,
                    // where the marks are about exactly the wedges they are sitting on.
                    reading={replaying ? undefined : readingNow}
                    // **Through the replay too.** It was held back on the grounds that a run is a
                    // fact about the repo as it is NOW, and a creature working away over a frame
                    // from 2019 would be the claim a replayed temperature would be. That reads
                    // the creature as a reading, and it is not one: it is the app's own pulse,
                    // and it is doing the same thing in History that it does anywhere else —
                    // being awake because somebody is here. What must not travel back in time is
                    // a MEASUREMENT, which is why the lens switcher greys out. Nothing in the
                    // creature's three states says anything about the code on screen.
                    mascot={mascot}
                    // Only the replay. A commit landing is a change the viewer asked to watch,
                    // so it should move; a rescan or a landed reading changes the live map under
                    // somebody who is reading it, and sliding the wedges there would animate a
                    // measurement arriving rather than a story advancing.
                    morph={replaying}
                    replaying={replaying}
                    density={staged?.px ?? null}
                    onSide={setPaneSide}
                    rings={rings}
                    rimShare={band}
                    onWantRings={wantRings}
                    sortBy={headOrder}
                    onSelect={pick}
                    onClear={clearPick}
                    onDrill={drill}
                    onUp={goUp}
                  />
                ) : awaiting && shapeRoot ? (
                  // The scan is still running and the map is already worth looking at. See
                  // `lib/shape.ts` — this is the same picture, drawn from what the parse has
                  // found so far, with no reading on any wedge.
                  <Sunburst
                    root={shapeRoot}
                    selected={null}
                    mode={viewMode}
                    sortBy={shapeSort}
                    // Eased, not snapped. The rings are gaining wedges several times a second
                    // and a repo that jumps on every batch reads as a glitch; the same
                    // argument the replay makes, for the same reason — see `morph`.
                    morph
                    // The same ring count the finished map will use, or the picture reorganises
                    // itself the moment the scan lands — a map that changes depth on its own is
                    // the reader's setting appearing to be ignored and then obeyed.
                    rings={rings}
                    // Where the scan has got to — see `live`. The same prop a run uses for its
                    // leases, because it is the same claim about a wedge, and the two phases
                    // never overlap.
                    reading={live}
                    mascot={mascot}
                    onSelect={noop}
                    onClear={noop}
                    onDrill={noop}
                  />
                ) : awaiting ? (
                  // There are projects, and none of them has a tree on screen yet. The empty
                  // pane's copy tells you how to open a project — advice for someone with none,
                  // addressed to someone who has three and is waiting on one. Show the wait.
                  <ProgressPane label={`Reading ${awaiting.name}…`} progress={awaitingProgress} />
                ) : !projectsLoaded ? (
                  // Not "no projects" — "not asked yet". Blank on purpose: the splash is still
                  // over this, and anything written here is a screen nobody asked for between
                  // the wordmark and the answer.
                  <div className="h-full" />
                ) : (
                  <Empty onAdd={addProject} />
                )}
              </div>

              {/* The scan, over the map it is drawing, in the legend's corner.
                It sat top centre, on the argument that a caption belongs over its picture —
                which put it on the one edge the eye is drawn to and made a temporary thing
                the most prominent element on screen. The corners are where this window
                already keeps what it says ABOUT the map: the caveat chip bottom-left, the
                legend bottom-right. A scan's progress is that kind of note, and it takes the
                legend's place because the two can never appear together — the legend needs
                `focus`, which is exactly what the assembling map does not have.
                Shown with the assembling map only. `!focus` is the same test the branch above
                makes, held here too because this element is a sibling of the branch rather
                than inside it: a strip over a FINISHED map would be describing a scan of some
                other repo, which is precisely the confusion the shape's ownership fixed. */}
              {awaitingProgress && shapeRoot && !focus && (
                <div className="absolute bottom-2 right-2 z-20">
                  <ProgressStrip progress={awaitingProgress} />
                </div>
              )}

              {/* Floated over the graph rather than stacked under it. The rings are a
                circle in a rectangle, so the corners and the top strip are dead space
                the picture never uses — putting the controls there costs the chart
                nothing and buys back a whole row of window height. */}
              {focus && focus.kind !== 'file' && (
                <div className="absolute bottom-2 right-2 z-20">
                  <ColorLegend
                    mode={viewMode}
                    // From `focus`, like the ranks it has to agree with — a legend naming
                    // eight authors the rings in front of you do not contain is annotating a
                    // picture nobody is looking at. The comment below said this before the
                    // code did: it was true of the counts and not of the categories, which
                    // came from the whole scan.
                    categories={focus ? legendFor(focus, viewMode) : []}
                    // The same map the wedges take their slots from, or the key and the
                    // picture disagree the moment the two orders diverge — which a held
                    // rank order during a replay guarantees they will.
                    ranks={ranks}
                    // Not read, only keyed on: a drill moves and resizes the disc the key is
                    // cut around, so the shape has to be measured again. See `useMapEdge`.
                    at={focus?.id}
                    // Counted from `focus`, not the whole scan: drilled into one
                    // directory, the legend has to describe the rings in front of you or
                    // it is annotating a picture nobody is looking at.
                    {...countPending(focus)}
                  />
                </div>
              )}
            </div>

            {/* Under the map, not floated over it. The legend is an annotation and can live
              in a corner; the transport is the control the whole view is about, and the
              scrub bar needs the full width or it cannot address the commits it draws. */}
            {historyOn && history && historyKey === activeKey && history.tables.commits > 0 && (
              <HistoryBar
                frames={frames}
                index={histIndex}
                // The transport addresses the whole timeline and can only DRAW what has
                // arrived. Advancing past the run asks for the next block and holds the
                // playhead where it is until it lands, which on a repo whose story fits in one
                // block never happens at all.
                onIndex={(i) => {
                  const held = history
                  if (held && i >= held.deltas.have()) {
                    void held.deltas.ensure(i, setLoaded).then(() => setLoaded(held.deltas.have()))
                    setHistIndex(Math.min(i, held.deltas.have() - 1))
                    return
                  }
                  setHistIndex(i)
                }}
                playing={playing}
                onPlaying={setPlaying}
                flashes={flashes}
                onFlashes={setFlashes}
                duration={duration}
                onDuration={setDuration}
                name={scope || (activeProject?.name ?? 'history')}
                // What an exported movie is captioned with: the repo, as the world knows it,
                // and where in it the replay is standing. Both go to the caption; `name`
                // above is the FILENAME, which wants the drilled path and not the owner.
                slug={remote ?? activeProject?.name ?? 'repo'}
                scope={scope}
                onStage={setStaged}
                mode={viewMode}
                keyFor={keyLive}
                // The whole timeline, for an export — the transport's own `onIndex` fetches
                // the block under the playhead and returns, which is right for watching and
                // useless to a recorder that must not stall mid-file.
                ensure={async (i) => {
                  const held = history
                  if (!held) return
                  await held.deltas.ensure(i, setLoaded)
                  setLoaded(held.deltas.have())
                }}
                // The commit's own date, for the timeline in an exported movie. Null before
                // the window: the opening state is everything the truncated commits built and
                // has no date it can honestly carry — the same reason those functions draw
                // uncoloured. `ensure` has already been awaited by then, so the block holding
                // it is here.
                dateOf={(i) => (i < 0 ? null : (history?.deltas.at(i)?.ts ?? null))}
              />
            )}
          </main>
        </div>

        <aside className="w-[290px] shrink-0 border-l border-[var(--border)] bg-[var(--card)]">
          {/* The log takes the panel while the replay is up. Not beside it: the panel
              answers "what am I looking at", and during a replay that answer is the
              commit, not whichever wedge the pointer last brushed. */}
          {historyOn && history && historyKey === activeKey ? (
            <CommitLog
              repoKey={activeKey}
              repoPath={repoPath}
              tables={history.tables}
              frames={frames}
              scope={scope}
              index={histIndex}
              playing={playing}
              onIndex={scrubTo}
              name={scope || (activeProject?.name ?? 'History')}
              repo={repoPath}
              loc={focus?.loc ?? 0}
              functions={activeProject?.functions ?? 0}
            />
          ) : (
            <Detail
              node={selected}
              // What the summary covers when nothing is picked: the subtree on screen, not
              // the repo, so drilling in re-counts rather than repeating a number the
              // sidebar already shows for the whole project.
              focus={focus}
              title={
                focus && tree && focus.id === tree.id
                  ? (activeProject?.name ?? focus.name)
                  : focus?.name
              }
              repo={repoPath}
              model={scan?.stats.model ?? null}
              mode={viewMode}
              ranks={ranks}
              ageSpan={ageSpan}
              onSelect={setPicked}
              onDrill={drill}
              owners={owners}
              onShowIn={showIn}
              repoKey={activeKey}
              replaying={replaying}
              onJump={jumpTo}
            />
          )}
        </aside>
      </div>

      {/* Keyed off the live list rather than a captured object: the poll replaces these
          every tick, and a dialog holding the row it was opened with would show counts
          frozen at the moment it opened. */}
      {/* The one thing dropping the `.git` requirement gave up: a folder holding many repos
          scans all of them, which is minutes of CPU and one map of unrelated code. Asked
          rather than refused — somebody may mean it — and asked with the count and a few
          names, because "39 repos (Alka, ComfyUI, ExitNoder, …)" is a different sentence
          from "this is a big folder". */}
      {bigFolder && (
        <Overlay onClose={() => setBigFolder(null)}>
          <div
            className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold">
              That folder holds {bigFolder.holds} repos
            </div>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              <code>{bigFolder.path}</code> contains {bigFolder.names.join(', ')}
              {bigFolder.holds > bigFolder.names.length ? ' and others' : ''}. Scanning it reads all
              of them — several minutes, and one map of unrelated code. Adding one of the repos
              inside it is usually what you want.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBigFolder(null)}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={() => takeFolder(bigFolder.path, bigFolder.key)}
                className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                Scan it anyway
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* **WHAT ADDING A BIG REPO IS ABOUT TO DO, before it does it.**
          Three processes, three costs, and only the first is unconditional: the map is
          parsed from the files and appears; the history is read from git and this one is
          over the budget, so it waits here rather than spending a minute of somebody's
          machine on a repo they have just pointed at; the readings cost tokens and an agent
          and are never automatic at any size.
          The numbers are this repo's own — see `estimateTrace`, which prices a repo nobody
          has walked from its packed object count and costs nothing. It is an estimate and it
          says so with a tilde: printing `17s` for an inference would be the instrument
          claiming a stopwatch it has not got.
          The checkbox hides this EXPLANATION and not the choice. A big repo added with it
          ticked still arrives with its history unread and its own row still says so — which
          is the property that makes ticking it safe, and the reason it is not phrased as
          "always trace". */}
      {bigHistory && (
        <Overlay onClose={() => setBigHistory(null)}>
          <div
            className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold">This repo has a lot of history</div>
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              Sanity does three things to a repo, and they cost very different amounts.
            </p>
            <ul className="flex flex-col gap-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
              <li>
                <b className="text-[var(--foreground)]">Scan</b> parses every file and draws the
                map. It happens now, and it does not read git at all.
              </li>
              <li>
                <b className="text-[var(--foreground)]">Trace</b> reads the commit log, which is
                what gives each wedge an age, a churn and an author. Here that is about{' '}
                <b className="text-[var(--foreground)]">
                  {bigHistory.cost.seconds < 60
                    ? `${Math.max(1, Math.round(bigHistory.cost.seconds))} seconds`
                    : `${Math.round(bigHistory.cost.seconds / 60)} minutes`}
                </b>
                {bigHistory.cost.cold ? ', estimated from the size of its object store' : ''} —
                past what Sanity will spend without being asked, so the map arrives without those
                lenses and the row carries a <b className="text-[var(--foreground)]">Trace</b>{' '}
                button.
              </li>
              <li>
                <b className="text-[var(--foreground)]">Read</b> puts an agent over the code to
                measure how predictable it is. It costs tokens, it is always your call, and no
                size of repo changes that.
              </li>
            </ul>
            <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <input
                type="checkbox"
                checked={hideExplain}
                onChange={(e) => setHideExplain(e.target.checked)}
              />
              Don’t explain this again
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBigHistory(null)}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Written on the way through, not on the tick: cancelling leaves the
                  // preference where it was, because dismissing a dialog is not answering it.
                  if (hideExplain) void setExplainTrace(false).catch(() => {})
                  takeFolder(bigHistory.added.path, bigHistory.added.key)
                  setBigHistory(null)
                }}
                className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                Add repo
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* What the menu's Install Command Line Tool… did. A menu action with no visible
          outcome is indistinguishable from one that did nothing — and the outcome here is
          not simply "worked": the link may have landed somewhere no shell looks, or lost to
          another install that comes first on PATH. */}
      {cliLink && (
        <Overlay onClose={() => setCliLink(null)}>
          <div
            className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold">Command line tool</div>
            {/* Prose, with the path as code inside it. It was the whole message in
                monospace, which set a sentence like a transcript and wrapped a path across
                two lines in the middle of it. */}
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {cliLink.text}{' '}
              {cliLink.path && <code className="text-[var(--foreground)]">{cliLink.path}</code>}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setCliLink(null)}
                className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                Done
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {readFor &&
        (() => {
          const p = projects.find((x) => x.key === readFor)
          return p ? (
            <ReadDialog project={p} onStarted={refreshProjects} onClose={() => setReadFor(null)} />
          ) : null
        })()}

      {/* The code, over the map. Modal because reading a file is a detour from the
          picture and not a new place in it — Escape and the backdrop both put it down,
          and the pop-out promotes it to a window when it stops being a detour. */}
      {codeNode && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-8 py-14"
          onClick={() => setCodeFile(null)}
          onKeyDown={(e) => e.key === 'Escape' && setCodeFile(null)}
        >
          <div
            // Capped, and inset from the window on every side. Code wants a measure, not
            // the full width of a display — and a sheet that reaches the window's edges
            // reads as a new screen rather than as something laid over the map you are
            // still in.
            className="relative h-full w-full max-w-[860px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CodeView
              file={codeNode}
              repo={repoPath}
              selected={selected}
              reveal={reveal}
              onSelect={(n) => setPicked(n)}
              onPopOut={() => {
                if (repoPath) void openCodeWindow(repoPath, codeNode.path)
                setCodeFile(null)
              }}
              onClose={() => setCodeFile(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Fraction done, and minutes left once that is worth saying.
 *
 * `pct` is always a number — 0 before there is anything to be a fraction of, which
 * `ProgressTrack` renders as its indeterminate sweep rather than as "0% done". Only `eta`
 * is withheld, and only until enough has moved under this hook's own eye, because an
 * estimate drawn from a three-item sample swings between "a minute" and "an hour" while
 * you watch it.
 *
 * This function used to carry two doc comments — the one above it belonged to the
 * progress UI as a whole and had been stranded here — and the one that was its own
 * promised nulls it does not return. A cold reader predicted `pct: number | null` from
 * that and found `: 0`.
 *
 * The wait is much shorter than it was: the proxy scans a real repo in about a second,
 * where the model pass it used to front could run for tens of minutes. The bar and ETA
 * stay because a large repo still takes long enough to wonder about, and the Stop button
 * is gone with the thing that was worth stopping.
 */
function useProgress(progress: Progress | null) {
  /**
   * **The estimate is drawn from work this hook WATCHED, never from the count it found.**
   * It used to be `elapsed / pct` measured from mount, which quietly asserts two things
   * that are not true. That the rate is constant across the whole job: parsing linux is
   * 45k files in a couple of minutes and blaming them is one `git blame --line-porcelain`
   * apiece against a history that deep, so the parse's rate was still setting the estimate
   * hours into the blame pass. And that mount time is start time: switch away from a scan
   * and back, and `elapsed` is a second against a bar already 20% along, which reports
   * `~<1 min left` on a job with four hours to go. Both produce the same failure, and it
   * is worse than showing nothing — an estimate that confident makes a bar which is
   * genuinely crawling read as a scan that has hung.
   *
   * So the mark holds a position and a time, it is reset when the phase changes, and the
   * rate is what has moved since. A remount then costs a few seconds of no estimate rather
   * than a wrong one, and a phase boundary costs the same.
   */
  const phase = progress?.phase ?? ''
  const mark = useRef({ phase, done: progress?.done ?? 0, at: Date.now() })
  if (mark.current.phase !== phase) {
    mark.current = { phase, done: progress?.done ?? 0, at: Date.now() }
  }

  const pct = progress && progress.total > 0 ? progress.done / progress.total : 0
  const moved = progress ? progress.done - mark.current.done : 0
  const watched = (Date.now() - mark.current.at) / 1000
  // Enough of a sample for the estimate not to swing wildly. Both conditions, because
  // either alone is satisfiable by a burst: a thousand cached files can land in the first
  // second, and five seconds can pass with nothing moving at all.
  const eta =
    progress && moved > 20 && watched > 5
      ? Math.round(((progress.total - progress.done) * (watched / moved)) / 60)
      : null
  return { pct, eta }
}

/** The bar itself, shared so the strip and the first-open pane are one instrument rather
 *  than two that drift. Indeterminate until there is a total to be a fraction of — see
 *  `track-sweep` in index.css for why that is not just decoration. */
function ProgressTrack({ progress, pct }: { progress: Progress | null; pct: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
      {progress ? (
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      ) : (
        <div className="track-sweep h-full rounded-full bg-[var(--accent)]" />
      )}
    </div>
  )
}

/**
 * What a running job is doing, in the job's own words.
 *
 * **Every noun here comes off the wire.** This line was the literal `Scoring N / M
 * functions`, written when the only counted phase was the model pass — which the app has
 * not run since `OllamaModel` was removed. The two phases that do run count FILES, so a
 * scan of linux announced `111029 functions` over a file count while the sidebar, holding
 * its own literal and the right one, said `111k files` an inch away. A window cannot know
 * the unit; the phase that is counting does.
 *
 * Separators because these numbers are six digits on a real repo, and `67511 / 111029` is
 * two figures nobody can read at a glance and therefore cannot tell apart when one moves.
 */
function phaseLine(p: Progress): string {
  const what = p.phase ? p.phase[0].toUpperCase() + p.phase.slice(1) : 'Working'
  if (p.total === 0) return `${what}…`
  const unit = p.unit ? ` ${p.unit}` : ''
  return `${what} ${p.done.toLocaleString()} / ${p.total.toLocaleString()}${unit}`
}

/**
 * The same wait, in one line, over a map that is already worth looking at.
 *
 * **A picture of the repo is not a report on the scan.** The assembling map replaced the
 * bar, on the reasonable argument that a repo drawing itself says more than a fraction
 * does — and it does, right up until the parse finishes. Then the rings stop moving, the
 * blame pass runs for hours behind a map that looks complete, and the only thing on screen
 * saying otherwise is a word in the sidebar. The two answer different questions and both
 * are wanted at once: what is in this repo, and how far along is the thing reading it.
 *
 * Boxed like the caveat chip in the corner of the graph, for the same reason it is: it is
 * about the picture rather than part of it.
 */
function ProgressStrip({ progress }: { progress: Progress }) {
  const { pct, eta } = useProgress(progress)
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
      <span>{phaseLine(progress)}</span>
      <div className="w-24">
        <ProgressTrack progress={progress} pct={pct} />
      </div>
      {eta !== null && <span className="mono">~{eta === 0 ? '<1' : eta} min left</span>}
    </div>
  )
}

/** The same wait, on an empty pane rather than over a map you can already read. Centered
 *  and wider because there is nothing else on the screen to be beside. */
function ProgressPane({ progress, label }: { progress: Progress | null; label?: string }) {
  const { pct, eta } = useProgress(progress)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        {progress ? phaseLine(progress) : (label ?? 'Walking the repo…')}
      </p>
      <div className="w-[min(320px,60%)]">
        <ProgressTrack progress={progress} pct={pct} />
      </div>
      {eta !== null && (
        <p className="mono text-[11px] text-[var(--muted-foreground)]">
          ~{eta === 0 ? '<1' : eta} min left
        </p>
      )}
    </div>
  )
}

/**
 * The finder, as a button.
 *
 * **⌘F is the real control and this is the one that says so.** A shortcut nobody can see is
 * a feature only its author has; the button exists so the panel is discoverable by looking,
 * and it names the key in its tooltip so the second visit is faster than the first. That is
 * the whole job — it opens exactly what the key opens, and there is deliberately no field
 * parked in the bar. A search box on the chrome is a control you have to look at forever to
 * use twice a day, and this row is the one the lens strip had to be dismantled to make room
 * in (see `ModeSwitcher`).
 *
 * A drawn magnifier rather than a glyph from the font, for the reason the switcher's caret
 * gives: at this size a system glyph is the same shape and depends on what is installed.
 *
 * Lit while the panel is up, so the button and the panel are visibly one thing rather than
 * two ways in.
 */
/** The growing gap between groups of controls in the top row.
 *
 *  **The bar is three groups pinned to three places, not eight peers in a huddle.** What the
 *  color means goes hard left, what is ON the map floats in the middle, and the two doors out
 *  of the picture go hard right — so each group has a fixed address and the eye learns where
 *  to reach rather than reading the row every time. A hairline was the first version and it
 *  separated the groups without placing them; the width the row already had was doing nothing.
 *
 *  **It carries the drag region, which is the whole reason this is a component.** `TopRow` is
 *  a Tauri drag handle and Tauri drags only when the EVENT TARGET carries the attribute — so
 *  a full-width child takes the entire titlebar out of the window's grip unless it carries the
 *  attribute too, which the toolbar's own wrapper now does. These spacers are the elastic
 *  chrome between the controls and the widest handle on the row, which is why they hold it
 *  explicitly rather than inheriting the wrapper's. */
function Spacer() {
  // **`self-stretch`, or it is a hit area with no height.** An empty span in an
  // `items-center` row is as tall as nothing at all, so the attribute was on an element that
  // occupied a sliver across the middle of the strip: the drag worked, on a few pixels,
  // which reads exactly like it not working. Stretching it to the row makes the elastic gap
  // the full-height handle it looks like.
  return <span data-tauri-drag-region aria-hidden className="min-w-4 flex-1 self-stretch" />
}

function FindButton({ on, onOpen }: { on: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Find"
      title="Find a function, file or directory  (⌘F)"
      className="flex items-center rounded-full px-2 py-[3px] transition-colors"
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {/* **Sized to the pills' LINE BOX, not to their type.** Every control beside this one
          is `text-[11px]` with `py-[3px]`, and what sets their height is the line box that
          11px of type sits in — about 16, not 11. An 11px icon with the same padding made a
          pill three pixels shorter than everything else in the row, which reads as a smaller
          button rather than as a smaller glyph. 16 is also about right optically: an icon
          has to be a little larger than cap height to carry the same weight as a word.

          Stroked rather than filled, so it holds its shape at this size and inherits the
          same `currentColor` flip the other pills use when they light up. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="6.6" cy="6.6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.9 9.9 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

/**
 * The door into the replay.
 *
 * Beside the lens switcher rather than inside it, because it is not a sixth lens. The
 * lenses answer "what should the color mean"; this one changes what the rings ARE — the
 * repo as it stood at some commit rather than as it stands now — and folding a change of
 * subject into a row of encodings would make the two look interchangeable.
 */
function HistoryToggle({
  on,
  busy,
  traced,
  onToggle,
}: {
  on: boolean
  busy: boolean
  /** Is there a trace to look at? Commits already walked and banked for this repo.
   *
   *  **This control opens a view and must never commission the work behind it.** It did
   *  both: pressing History on an untraced repo started the walk, disabled the whole nav
   *  bar and left somebody watching a button say `Reading…` for an hour. The work is asked
   *  for on the project's own row, where the number of commits it will cost is written next
   *  to the button. Here, a repo nobody has traced simply has nothing to show. */
  traced: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      // **Leaving is always allowed.** Disabling this while a trace runs locked somebody
      // into a view of a story that was still being written — the map empty, the transport
      // pointed at frames that did not exist yet, and the way out greyed. Going back to the
      // repo as it stands costs nothing and cannot fail; it is only ENTERING that needs
      // something to show.
      disabled={!on && (busy || !traced)}
      title={
        on
          ? 'Back to the repo as it stands now  (⌘+)'
          : busy
            ? 'Tracing this repo — the project row has the progress and a way to stop'
            : !traced
              ? 'No trace yet. Press Trace on the project to walk its commits.'
              : 'The repo commit by commit — colored by arrivals, not by surprise  (⌘+)'
      }
      className="flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] transition-colors"
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        fontWeight: on ? 600 : 400,
        opacity: !on && (busy || !traced) ? 0.6 : 1,
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {/* The same padlock the lens tabs wear, keyed the same way: Trace opens this one, so
          it takes the accent rather than the muted ink. A repo mid-trace is not locked — it
          is busy, which the label already says. */}
      {!on && !busy && !traced && <Lock keyed />}
      {busy ? 'Tracing…' : 'History'}
    </button>
  )
}

/**
 * The window with no projects in it — which is to say, the first run.
 *
 * What an empty window owes you is the next action, not the premise. It used to open with a
 * headline and a paragraph about what the rings mean: a pitch, on the screen of someone who
 * has already installed the thing.
 *
 * **One step, and that is the news.** This was a two-door choice, then a two-step gate:
 * connect an agent over MCP, then go into a session and say a phrase, offered on a copy
 * button because it had to arrive verbatim in another application. Both shapes were right
 * for a product where a reader had to be a subagent of somebody's chat — only an agent
 * could hold a repo, so only an agent could start anything.
 *
 * Sanity runs the readers itself now. There is nothing to configure, nothing to paste, and
 * no session to enter: add a repo, press Read. MCP is demoted to a second way of pressing a
 * button that is already on this screen, so it is a sentence at the bottom rather than
 * step one.
 *
 * **What replaced the connect step is a prerequisite that can be CHECKED.** "Configure an
 * MCP server" is a thing people get wrong silently; "have claude or codex installed" is a
 * thing this card can look for and state, which is why it does.
 *
 * **The previous version of this docstring was itself a finding.** A reader was handed a
 * description of a choice the body had stopped offering two hours earlier and graded it
 * `some`, noting it had been given a rationale the code overruled — the exact failure the
 * metric exists to expose, on the file that draws the metric's own front door. Hence the
 * care taken to rewrite this one in the same commit as the body.
 *
 * No remembered "declined" flag, deliberately. This screen only exists while there are no
 * projects, so adding one dismisses it for good; a persisted dismissal would be state that
 * can only ever go wrong, guarding a screen nobody will see again anyway.
 */
function Empty({ onAdd }: { onAdd: () => void }) {
  const [found, setFound] = useState<{ id: string; installed: boolean }[]>([])
  useEffect(() => {
    void harnesses().then(setFound)
  }, [])
  const have = found.filter((h) => h.installed).map((h) => h.id)
  const checked = found.length > 0
  /** What the CLI link attempt said: nothing yet, in flight, the result, or the error. */
  const [linking, setLinking] = useState<
    null | 'working' | string | { path: string; on_path: boolean }
  >(null)
  /** What `sanity` means in a terminal. Null until asked, so the card shows neither state
   *  rather than flashing the wrong one. */
  const [cli, setCli] = useState<CliState | null>(null)
  useEffect(() => {
    void cliStatus().then(setCli)
  }, [])

  return (
    /* Boxed. The copy needs a ground of its own: over bare pane it read as text lying on
       the desk rather than as a card asking for something. */
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-[54ch] flex-col items-center gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-8 py-9">
        <h2
          className="font-display text-[26px] font-normal leading-none text-[var(--foreground)]"
          style={{
            fontFamily: "'LINE Seed JP', ui-sans-serif, system-ui",
            letterSpacing: '-0.06em',
          }}
        >
          Read your first project
        </h2>

        {/* One step now, and that is the whole change.
            This was a two-step gate: connect an agent over MCP, then go into a session and
            say a phrase, on a copy button, because a reader had to be a subagent of
            somebody's chat and only an agent could name a repo. Sanity runs the readers
            itself now — separate processes, no repo access — so there is nothing to
            configure and nothing to paste. Add a repo and press Read.
            The prerequisite that remains is a coding agent on this machine, which is a
            thing that can be CHECKED rather than explained, so the card checks it. */}
        <div className="flex w-full max-w-[44ch] flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Add a repo and Sanity scans it. Expose more detail by using your coding agent as a fleet
            of readers, each in its own process, to rate the predictability and legibility of each
            of your files and functions.
          </p>

          <button
            onClick={onAdd}
            className="self-start rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90"
          >
            Add a repo
          </button>

          {/* Stated, not explained. A missing agent is the one thing that will stop this
              working, and it is the kind of prerequisite people get wrong silently. */}
          {checked && (
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {have.length > 0 ? (
                <>
                  Ready to read with{' '}
                  {/* The NAMES take the foreground; the separators stay muted. Joining the
                      list inside one span lit the `+` signs as brightly as the agents, so a
                      row of punctuation read as part of what was found. */}
                  {have.map((h, i) => (
                    <span key={h}>
                      {i > 0 && ' + '}
                      <span className="text-[var(--foreground)]">{h}</span>
                    </span>
                  ))}
                  .
                </>
              ) : (
                <>
                  You will need <code>claude</code> or <code>codex</code> installed and signed in —
                  Sanity reads by running one of them.
                </>
              )}
            </p>
          )}

          {/* Demoted, deliberately. It used to be step one; it is now a second way to press
              a button that is already on screen. */}
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            You can also start a read from a terminal with <code>sanity check</code>, and watch it
            there. The backend spawns the same readers, no window required.
          </p>

          {/* **The one thing a DMG cannot do for you.** Homebrew puts `sanity` on PATH with
              the cask's own `binary` stanza; a downloaded app is a bundle in /Applications
              and nothing links out of it. `install_cli` has existed the whole time and
              nothing ever called it, so the sentence above named a command a direct-download
              user did not have.
              A button rather than instructions, because the alternative is telling somebody
              to add `Sanity.app/Contents/MacOS` to their PATH — which also puts
              `sanity-scan`, `sanity-history` and two others there — or to write an alias no
              script can see. */}
          <div className="flex flex-col items-start gap-1.5">
            {cli?.is_this_app ? (
              // **A state, not a button.** Offering "Ensure CLI is on PATH" to somebody whose
              // `sanity` already runs this app invites them to fix what is not broken, and
              // the only way to learn the answer was to perform the action.
              <p className="text-xs leading-relaxed text-[var(--agent-mark)]">
                ✓ <code>sanity</code> is on your PATH
              </p>
            ) : (
              <>
                {/* Points at something else. Named rather than silently relinked: the
                    winning entry may be a Homebrew cask's, which this app did not write and
                    cannot remove, and re-linking our own directory would not change which
                    one PATH reaches first. Saying what runs is the part that helps. */}
                {cli?.on_path && cli.resolved && (
                  <p className="text-xs leading-relaxed text-[var(--warning)]">
                    <code>sanity</code> runs a different build — <code>{cli.resolved}</code>
                  </p>
                )}
                <button
                  onClick={() => {
                    setLinking('working')
                    void installCli()
                      .then((r) => {
                        setLinking(r)
                        // Re-asked rather than inferred: `install_cli` knows it wrote a
                        // link, and which `sanity` a SHELL reaches is a different question.
                        void cliStatus().then(setCli)
                      })
                      .catch((e) => setLinking(String(e)))
                  }}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)] px-3.5 py-2 text-xs font-semibold hover:opacity-90"
                >
                  {linking === 'working'
                    ? 'Linking…'
                    : cli?.on_path
                      ? 'Point sanity at this app'
                      : 'Ensure CLI is on PATH'}
                </button>
                {linking && linking !== 'working' && typeof linking === 'string' && (
                  <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    {linking}
                  </p>
                )}
                {/* Linked, and still not what a shell reaches — a different directory wins.
                    That is the one outcome somebody has to fix themselves, so it says so
                    instead of showing a tick. */}
                {linking && typeof linking !== 'string' && cli && !cli.is_this_app && (
                  <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    Linked at <code>{linking.path}</code>
                    {cli.resolved
                      ? ` — but ${cli.resolved} comes first on your PATH.`
                      : ' — add that directory to your PATH.'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
