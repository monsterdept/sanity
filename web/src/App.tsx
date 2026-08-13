import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  agentActivity,
  agentReports,
  listProjects,
  projectScan,
  applyAgentReports,
  applyScores,
  countPending,
  forgetProject,
  harnesses,
  onOpenProject,
  pickProject,
  scanRepo,
  onSetTheme,
  syncThemeMenu,
  onScanScore,
  openCodeWindow,
  type Node,
  type Progress,
  type AgentActivity,
  type ProjectSummary,
  type Scan,
  type Upgrade,
} from './lib/api'
import {
  frameTree,
  onHistoryProgress,
  scanHistory,
  scopedCommits,
  warmHistory,
  type HistoryScan,
} from './lib/history'
import { Sunburst } from './components/Sunburst'
import { CommitLog } from './components/CommitLog'
import { HistoryBar } from './components/HistoryBar'
import { Crumbs } from './components/Crumbs'
import { TopRow } from './components/shell/TopRow'
import {
  legendFor,
  MODE_LABEL,
  rankCategories,
  ageSpanOf,
  type ColorMode,
} from './lib/colorMode'
import { populationOf } from './lib/population'
import { dismissSplash } from './lib/splash'
import { loadTheme, saveTheme, watchSystemTheme, type Theme } from './lib/theme'
import { CodeView } from './components/CodeView'
import { ColourLegend, ModeSwitcher } from './components/ColourKey'
import { Detail } from './components/Detail'
import { SideBar } from './components/SideBar'
import { ReadDialog } from './components/ReadDialog'

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

function sameProjects(a: ProjectSummary[], b: ProjectSummary[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => {
    const q = b[i]
    return (
      p.key === q.key &&
      p.name === q.name &&
      p.touched === q.touched &&
      p.repo === q.repo &&
      p.assessed === q.assessed &&
      p.functions === q.functions &&
      p.files === q.files &&
      p.scanned === q.scanned &&
      p.stale === q.stale &&
      p.working === q.working &&
      p.loading === q.loading &&
      p.read_done === q.read_done &&
      p.read_total === q.read_total &&
      // The settings and the derived-from-corpus pair. They move rarely, which is exactly
      // why leaving them out is easy and wrong: choosing an agent in the Read dialog
      // changes `harness` and nothing else, so an omitted field means the dialog reopens
      // showing the value you just replaced. Every field this list forgets is a stale
      // reading of the same shape.
      p.harness === q.harness &&
      p.model === q.model &&
      p.banked_model === q.banked_model &&
      p.banked_harness === q.banked_harness &&
      p.recent_model === q.recent_model &&
      sameIds(
        p.banked_models?.map((m) => `${m.model}:${m.readings}`),
        q.banked_models?.map((m) => `${m.model}:${m.readings}`),
      ) &&
      p.unread_lines === q.unread_lines &&
      // Compared, not ignored. The map pulses these, so a change here has to reach the
      // frontend — and a field the poll drops out of the comparison is a highlight that
      // freezes on whatever was in flight the last time some OTHER number moved.
      //
      // Defaulted, because the backend answering may predate the field: `serve` is
      // idempotent, so an app somebody started this morning goes on answering a window
      // built tonight. Reading `.length` off `undefined` there would throw inside the
      // poll, which is a dead sidebar rather than a missing highlight.
      sameIds(p.reading, q.reading) &&
      sameRun(p.run, q.run)
    )
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
  const [error, setError] = useState<string | null>(null)
  /** A repo just added by hand, waiting for its scan to reach the project list. */
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
  // what changes the question is what the colour MEANS, and the same rings answer five
  // different ones depending on that.
  const [mode, setMode] = useState<ColorMode>('surprise')
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
  useEffect(() => onSetTheme((t) => {
    const next = t as Theme
    setTheme(next)
    saveTheme(next)
  }), [])
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
  // History is a MODE, not a sixth lens. The lenses answer "what should the colour mean",
  // and in here that question is already settled: surprise is a reading taken against
  // today's code and cannot be replayed onto a 2019 body, so a frame is coloured by
  // recency and the switcher is disabled rather than offered with one option that lies.
  const [historyOn, setHistoryOn] = useState(false)
  const [history, setHistory] = useState<HistoryScan | null>(null)
  /** Which project `history` describes. A repo's timeline is not transferable, and
   *  switching projects with a stale one loaded would replay one repo's commits over
   *  another's name. */
  const [historyKey, setHistoryKey] = useState<string | null>(null)
  const [historyBusy, setHistoryBusy] = useState(false)
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

  // Cmd-1..7 for the lenses, in the order they appear in the switcher.
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
      // Pinned while the replay is up, for the same reason the switcher is greyed: the
      // shortcut is the switcher, and a control that is disabled in one place and live on
      // the keyboard is not disabled.
      if (historyOn) return
      const i = Number(e.key) - 1
      const modes = Object.keys(MODE_LABEL) as ColorMode[]
      if (!Number.isInteger(i) || i < 0 || i >= modes.length) return
      e.preventDefault()
      setMode(modes[i])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOn])

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
    const timer = setInterval(() => {
      void listProjects().then(async (list) => {
        // Replaced only when it differs. The poll returns fresh objects whether or not
        // anything moved, and setting them re-rendered the whole window — including a
        // sunburst of several thousand arcs — every 1.5 seconds. During a replay that is a
        // stutter on a fixed period; the rest of the time it is just waste.
        setProjects((prev) => (sameProjects(prev, list.projects) ? prev : list.projects))
        // Marked once the list has actually been fetched, empty or not — see the state's
        // own comment. Set after `setProjects` so the two land in one render and an empty
        // repo list does not flash the gate before the loading line.
        setProjectsLoaded(true)
        const revOf = (key: string | null) =>
          list.projects.find((p) => p.key === key)?.scanned ?? 0

        // AN AGENT OPENED SOMETHING NEW. This is the inversion, and the only case that
        // overrules what you are looking at. Compared against `followed` rather than against
        // the screen, so a sidebar click — which does not move `active` — cannot be mistaken
        // for one.
        if (list.active && list.active !== followed) {
          followed = list.active
          shown.current = list.active
          shownRev.current = revOf(list.active)
          setActiveKey(list.active)
          // A different project means a different tree; a stale drill-in or selection would
          // point at nodes that no longer exist.
          setStack([])
          setPicked(null)
          // Both, together. `project_scan` returns the tree as Rust scored it — proxy only —
          // so fetching it without the readings shows an assessed repo as entirely grey
          // until some later poll happens to repaint it.
          const [s, reports] = await Promise.all([
            projectScan(list.active),
            agentReports(list.active),
          ])
          if (!s) return
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
        const rev = revOf(here)
        if (rev === shownRev.current) return
        shownRev.current = rev
        const [s, reports] = await Promise.all([projectScan(here), agentReports(here)])
        if (!s) return
        setScan(reports.length > 0 ? { ...s, root: applyAgentReports(s.root, reports) } : s)
      })
    }, 1500)
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
        setScan((prev) => (prev ? { ...prev, root: applyAgentReports(prev.root, reports) } : prev))
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [activeKey, historyOn])

  // Streamed scores are batched and flushed on a timer rather than applied per event.
  // Each application re-aggregates the tree and re-renders a few thousand arcs; at the
  // rate a fast model emits, doing that per function would spend more time in React
  // than in the model.
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
  const addProject = useCallback(() => {
    setError(null)
    void pickProject()
      .then((path) => {
        if (!path) return
        // Remembered so the new project can be selected when it shows up. The scan
        // publishes it and the poll renders it, which are two different moments — without
        // this the repo you just added appears in the list and the map stays on whatever
        // you were looking at.
        setPendingAdd(path)
        return scanRepo(path)
      })
      .catch((e) => {
        setPendingAdd(null)
        setError(String(e))
      })
  }, [])

  /** Take a project out of the sidebar. The repo and its readings are untouched.
   *
   *  Selection is cleared when it was the one removed, before the refetch rather than
   *  after: the poll would drop the row and leave `activeKey` naming a project that is not
   *  in the list, which renders as a window still showing a map nothing can be selected
   *  for. */
  const forget = useCallback(
    (key: string) => {
      if (activeKey === key) setActiveKey(null)
      void forgetProject(key).then(refreshProjects)
    },
    [activeKey, refreshProjects],
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

  /** Which of the active project's functions are out with a reader, for the map's pulse.
   *
   *  A Set, memoised on the ARRAY's contents rather than on the project object: the poll
   *  hands back a fresh object every tick, so keying this on `activeProject` would build a
   *  new Set 40 times a minute and re-render every arc under it — the exact shape of the
   *  stutter the history replay exists to warn about.
   *
   *  Empty rather than undefined when nothing is running, so the prop is always a Set and
   *  the wedge test has one branch. */
  const readingIds = projects.find((p) => p.key === activeKey)?.reading
  const readingKey = readingIds?.join('\u0000') ?? ''
  const readingNow = useMemo(() => {
    const ids = readingKey ? readingKey.split('\u0000') : []
    // **The containing FILE goes in too, and without it the pulse was invisible.** A
    // function wedge on a real repo is a fraction of a degree, and past the ring's budget
    // it is not drawn at all — folded into a roll-up — so a marker on it lit nothing you
    // could see and sometimes nothing that existed. A file always has its own band.
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
    if (historyKey === activeKey || historyBusy) return
    setHistoryBusy(true)
    setHistoryProgress(null)
    void scanHistory(repoPath)
      .then((h) => {
        setHistory(h)
        setHistoryKey(activeKey)
        // Opens at the END, not at the beginning. The map you were just looking at is the
        // last frame, so starting there means turning history on changes nothing you can
        // see until you ask it to — and pressing play then rewinds and replays, which is
        // the gesture people expect from a transport they have just revealed.
        setHistIndex(h.commits.length - 1)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setHistoryBusy(false))
  }, [historyOn, repoPath, activeKey, historyKey, historyBusy])

  // Follow a hand-added repo to the map once its scan has landed.
  //
  // Only for a repo the person just picked, never for one that merely appeared. An agent
  // opening a project in another repo must not retarget this window — that is the rule
  // `focus` follows on the backend, arrived at from the frontend side.
  useEffect(() => {
    if (!pendingAdd) return
    const arrived = projects.find((p) => p.repo === pendingAdd)
    if (!arrived) return
    setPendingAdd(null)
    setActiveKey(arrived.key)
  }, [pendingAdd, projects])

  // A different project is a different timeline. Dropped rather than kept per project:
  // holding several megabytes of somebody else's commits against the chance they click
  // back is a cache with no eviction and no owner.
  useEffect(() => {
    if (historyKey && historyKey !== activeKey) {
      setHistory(null)
      setHistoryKey(null)
      setPlaying(false)
    }
  }, [activeKey, historyKey])

  /** The tree for the frame under the playhead, or nothing when history is off.
   *
   *  Built fresh per frame rather than patched onto the live scan: the two hold different
   *  functions — that is the entire point of a timeline — and reusing the live tree would
   *  mean deciding what to do with every function that does not exist yet. */
  const histRoot = useMemo(
    () =>
      historyOn && history && historyKey === activeKey
        ? frameTree(history, histIndex, activeProject?.name ?? 'repo')
        : null,
    // The NAME, not the project row. `listProjects` hands back fresh objects every poll,
    // so depending on the row rebuilt the whole frame tree on a timer — a hitch at a fixed
    // period, in the middle of a replay, for a string that had not changed.
    [historyOn, history, historyKey, activeKey, histIndex, activeProject?.name],
  )

  /** What the map is drawing: the frame when history is on, the scan otherwise. Every
   *  navigation below reads this rather than `scan`, so drilling, crumbs and selection
   *  work the same in both — they are the same rings. */
  const tree = histRoot ?? scan?.root ?? null

  /** Jump the playhead and stop. Stable across renders on purpose: `CommitLog` memoises
   *  its rows against this, and an inline arrow would rebuild every row on every frame —
   *  the exact cost that component is written to avoid. */
  const scrubTo = useCallback((i: number) => {
    setPlaying(false)
    setHistIndex(i)
  }, [])

  /** History was asked for and this repo has none. Stated rather than drawn as an empty
   *  circle: a map with no wedges and no sentence reads as a bug in the tool. */
  const historyEmpty =
    historyOn && history !== null && historyKey === activeKey && history.commits.length === 0

  /** Pinned while history is on. See `historyOn` — the encoding is not a preference here,
   *  it is the only thing the evidence supports. */
  const viewMode: ColorMode = historyOn ? 'age' : mode

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

  /** What the timeline has been narrowed to: the path of whatever the rings are rooted
   *  at, and `''` at the top. Drilling into a directory asks a narrower question — "how
   *  did THIS come to be" — and a transport still addressing the whole repo answers a
   *  different one, spending most of its length on commits that change nothing on screen.
   *
   *  Read off `focus`, so the scope follows the picture rather than being a second place
   *  the user has to say where they are. */
  const scope = historyOn && focus && tree && focus.id !== tree.id ? focus.path : ''

  /** The commits in scope, as indices into the full timeline.
   *
   *  A view of the timeline, never a re-fold of it: `histIndex` stays a REAL commit index
   *  and the rings are always built at that commit. A commit outside the scope cannot
   *  change what is inside it, so the narrowed list is complete for what is drawn — and
   *  keeping the real index is what makes drilling in and popping back out land you on the
   *  same commit rather than somewhere proportional. */
  const frames = useMemo(
    () => (history ? scopedCommits(history, scope) : []),
    [history, scope],
  )

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
  const ranks = useMemo(() => (tree ? rankCategories(tree, viewMode) : undefined), [tree, viewMode])
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

  /** The repo's own distributions, so a selected function can be placed in them.
   *
   *  Off the whole TREE, never off `focus`: a percentile is only a fact about a fixed
   *  population, and rebuilding it per drill would mean the same function read `longer than
   *  71%` at the top and `longer than 40%` one ring in, with nothing on screen saying the
   *  scale had moved under it. Same argument as `ageSpan` directly above.
   *
   *  Memoised on the tree because it is one walk of every function and the panel it feeds
   *  re-renders on every hover. */
  const pop = useMemo(() => (tree ? populationOf(tree) : undefined), [tree])

  /** The splash comes down here, not after the first paint. See `lib/splash.ts`.
   *
   *  Ready means one of the two things the window has to say: a map, or — with the list
   *  fetched and genuinely empty — the card telling you how to get one. Everything between
   *  those is the app booting, which is what the wordmark is covering. */
  const booted = focus !== null || (projectsLoaded && projects.length === 0)
  useEffect(() => {
    if (booted) dismissSplash()
  }, [booted])

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
  const showIn = useCallback(
    (n: Node) => setStack(tree && n.id === tree.id ? [] : [n.id]),
    [tree],
  )

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
          agent={agent}
          // The picker reports its own refusals — a directory holding twelve repos is a
          // sentence worth reading, not a silent no-op. A dismissed dialog resolves null
          // and says nothing, because cancelling is not an error.
          onRead={(key) => setReadFor(key)}
          onAdd={addProject}
          onForget={forget}
          onSelect={(key) => {
            // Selected immediately, before the tree is fetched. A project still being
            // rescanned has no tree to return, and gating the selection on one meant
            // clicking it did nothing at all — no highlight, no pane, no acknowledgement
            // that the click landed. Selection is a statement about what you are looking
            // at; it does not depend on the thing having finished loading.
            setActiveKey(key)
            // The poll follows what is on screen, and this IS the screen changing. Both
            // halves, or the next tick sees a revision from the project you just left and
            // refetches a tree you are not looking at.
            shown.current = key
            shownRev.current = projects.find((p) => p.key === key)?.scanned ?? 0
            setStack([])
            setPicked(null)
            // Readings fetched WITH the scan, not left to the next poll: `project_scan`
            // returns the proxy-scored tree, so between the two the repo renders grey.
            void Promise.all([projectScan(key), agentReports(key)]).then(([s, reports]) => {
              if (!s) {
                // Nothing to draw yet; the poll picks it up when the rescan lands.
                setScan(null)
                return
              }
              setScan(reports.length > 0 ? { ...s, root: applyAgentReports(s.root, reports) } : s)
            })
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
        <TopRow>
          {focus && (
            <div className="flex items-center gap-2">
              {/* Disabled rather than hidden while the replay is up. The switcher is the
                  window's statement of what colour means, and removing it would leave the
                  rings recoloured with nothing on screen saying by what. Greyed, with the
                  reason in the tooltip, it still answers the question. */}
              <ModeSwitcher mode={viewMode} onMode={setMode} disabled={historyOn} />
              <HistoryToggle
                on={historyOn}
                busy={historyBusy}
                onToggle={() => {
                  setHistoryOn((v) => !v)
                  setPlaying(false)
                  // Selection and drill-in survive the switch by id, but a selected
                  // FUNCTION usually will not exist in the frame under the playhead — and
                  // a panel describing a function the rings are not drawing is worse than
                  // an empty one.
                  setPicked(null)
                }}
              />
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
          {historyBusy && <ProgressStrip progress={historyProgress} label="Replaying the history…" />}
          {tree && focus && <Crumbs trail={trail} onGo={goTo} onUp={goUp} />}

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <div className="relative z-10 h-full">
            {error ? (
              <div className="flex h-full items-center justify-center p-6">
                <p className="max-w-[40ch] text-center text-sm text-[var(--destructive)]">
                  {error}
                </p>
              </div>
            ) : historyEmpty ? (
              <div className="flex h-full items-center justify-center p-6">
                <p className="max-w-[40ch] text-center text-sm text-[var(--muted-foreground)]">
                  No git history here, so there is nothing to replay. The map beside this
                  is still the repo as it stands.
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
                // to `focus` would make a wedge change colour on the way in, which is the
                // one thing drilling must not do.
                ageSpan={ageSpan}
                reading={readingNow}
                onSelect={pick}
                onClear={clearPick}
                onDrill={drill}
                onUp={goUp}
              />
            ) : awaiting ? (
              // There are projects, and none of them has a tree on screen yet. The empty
              // pane's copy tells you how to open a project — advice for someone with none,
              // addressed to someone who has three and is waiting on one. Show the wait.
              <ProgressPane
                label={`Reading ${awaiting.name}…`}
                progress={
                  awaiting.read_total > 0
                    ? { done: awaiting.read_done, total: awaiting.read_total }
                    : null
                }
              />
            ) : !projectsLoaded ? (
              // Not "no projects" — "not asked yet". Blank on purpose: the splash is still
              // over this, and anything written here is a screen nobody asked for between
              // the wordmark and the answer.
              <div className="h-full" />
            ) : (
              <Empty onAdd={addProject} />
            )}
            </div>

            {/* Floated over the graph rather than stacked under it. The rings are a
                circle in a rectangle, so the corners and the top strip are dead space
                the picture never uses — putting the controls there costs the chart
                nothing and buys back a whole row of window height. */}
            {focus && focus.kind !== 'file' && (
              <div className="absolute bottom-2 right-2 z-20">
                <ColourLegend
                  mode={viewMode}
                  categories={tree ? legendFor(tree, viewMode) : []}
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
          {historyOn && history && historyKey === activeKey && history.commits.length > 0 && (
            <HistoryBar
              frames={frames}
              index={histIndex}
              onIndex={setHistIndex}
              playing={playing}
              onPlaying={setPlaying}
              duration={duration}
              onDuration={setDuration}
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
            hist={history}
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
            title={focus && tree && focus.id === tree.id ? (activeProject?.name ?? focus.name) : focus?.name}
            repo={repoPath}
            commits={scan?.stats.commits ?? 0}
            model={scan?.stats.model ?? null}
            mode={viewMode}
            ranks={ranks}
            ageSpan={ageSpan}
            onSelect={setPicked}
            onDrill={drill}
            owners={owners}
            onShowIn={showIn}
            pop={pop}
          />
          )}
        </aside>
      </div>

      {/* Keyed off the live list rather than a captured object: the poll replaces these
          every tick, and a dialog holding the row it was opened with would show counts
          frozen at the moment it opened. */}
      {readFor &&
        (() => {
          const p = projects.find((x) => x.key === readFor)
          return p ? (
            <ReadDialog
              project={p}
              onStarted={refreshProjects}
              onClose={() => setReadFor(null)}
            />
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
 * is withheld, and only until 20 items and 2% are in, because an estimate drawn from a
 * three-item sample swings between "a minute" and "an hour" while you watch it.
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
  const started = useRef(Date.now())
  useEffect(() => {
    started.current = Date.now()
  }, [])

  const pct = progress && progress.total > 0 ? progress.done / progress.total : 0
  const elapsed = (Date.now() - started.current) / 1000
  // Only once there is enough of a sample for the estimate not to swing wildly.
  const eta =
    progress && progress.done > 20 && pct > 0.02
      ? Math.round((elapsed / pct - elapsed) / 60)
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

/** The same wait, on an empty pane rather than over a map you can already read. Centred
 *  and wider because there is nothing else on the screen to be beside. */
function ProgressPane({
  progress,
  label,
}: {
  progress: Progress | null
  label?: string
}) {
  const { pct, eta } = useProgress(progress)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        {progress
          ? `Scoring ${progress.done} / ${progress.total} functions`
          : (label ?? 'Walking the repo…')}
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

function ProgressStrip({
  progress,
  label,
}: {
  progress: Progress | null
  /** What is being waited on, when it is not the scan. The bar is the same instrument
   *  either way; only the sentence over it changes. */
  label?: string
}) {
  const { pct, eta } = useProgress(progress)

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5">
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-[var(--muted-foreground)]">
        <span>
          {label ? (
            progress ? (
              <>
                {label} {progress.done} / {progress.total} commits.
              </>
            ) : (
              <>{label}</>
            )
          ) : progress ? (
            <>
              Scoring {progress.done} / {progress.total} functions.
            </>
          ) : (
            <>Reading the repo…</>
          )}
        </span>
        {eta !== null && <span className="mono shrink-0">~{eta === 0 ? '<1' : eta} min left</span>}
      </div>
      <ProgressTrack progress={progress} pct={pct} />
    </div>
  )
}

/**
 * The door into the replay.
 *
 * Beside the lens switcher rather than inside it, because it is not a sixth lens. The
 * lenses answer "what should the colour mean"; this one changes what the rings ARE — the
 * repo as it stood at some commit rather than as it stands now — and folding a change of
 * subject into a row of encodings would make the two look interchangeable.
 */
function HistoryToggle({
  on,
  busy,
  onToggle,
}: {
  on: boolean
  busy: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      title={
        on
          ? 'Back to the repo as it stands now'
          : 'Replay the repo commit by commit — coloured by recency, not by surprise'
      }
      className="rounded-full px-2.5 py-[3px] text-[11px] transition-colors"
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        fontWeight: on ? 600 : 400,
        opacity: busy ? 0.6 : 1,
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {busy ? 'Reading…' : 'History'}
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

  return (
    /* Boxed. The copy needs a ground of its own: over bare pane it read as text lying on
       the desk rather than as a card asking for something. */
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-[54ch] flex-col items-center gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-8 py-9">
        <h2
          className="font-display text-[26px] font-normal leading-none text-[var(--foreground)]"
          style={{ fontFamily: "'LINE Seed JP', ui-sans-serif, system-ui", letterSpacing: '-0.06em' }}
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
            Add a repo and Sanity reads it — running a coding agent you already have as a
            fleet of readers, each in its own process, none of them able to see the code
            except what Sanity hands over one function at a time.
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
                  <span className="text-[var(--foreground)]">{have.join(' or ')}</span>.
                </>
              ) : (
                <>
                  You will need <code>claude</code> or <code>codex</code> installed and
                  signed in — Sanity reads by running one of them.
                </>
              )}
            </p>
          )}

          {/* Demoted, deliberately. It used to be step one; it is now a second way to
              press a button that is already on screen. */}
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            You can also start a read from a terminal with <code>sanity check</code>, or by
            asking a connected chat client — see the{' '}
            <span className="text-[var(--foreground)]">⚙</span> in the panel below.
          </p>
        </div>
      </div>
    </div>
  )
}


