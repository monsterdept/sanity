import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  agentReports,
  applyAgentReports,
  forgetProject,
  listProjects,
  projectScan,
  resetProject,
  scanRepo,
  selectProject,
  type AgentReport,
  type Node,
  type ProjectSummary,
  type Scan,
} from '../lib/api'
import type { ColorMode } from '../lib/colorMode'
import { sameProjects } from '../lib/sameProjects'
import { mark } from '../lib/stopwatch'

/** The projects sanity holds, which one is on screen, and every door between them — the poll
 *  that follows an agent, a sidebar click, a hand-added repo arriving, and a project being
 *  forgotten or reset.
 *
 *  **The view store lives here because every door has to use it.** A switch banks the lens and
 *  drill-in of the project being left and restores the one arriving — see `switchTo` — so the
 *  lens and drill state are handed in rather than owned. */
export function useProjects({
  mode,
  stack,
  setMode,
  setStack,
  setPicked,
  keepReadings,
  scanRef,
  setScan,
  setTreeRev,
  setError,
}: {
  mode: ColorMode
  stack: string[]
  setMode: Dispatch<SetStateAction<ColorMode>>
  setStack: Dispatch<SetStateAction<string[]>>
  setPicked: Dispatch<SetStateAction<Node | null>>
  keepReadings: (list: AgentReport[]) => { list: AgentReport[]; moved: boolean }
  /** Whether a tree is on screen, for the poll — which cannot read state it is not
   *  re-created with. */
  scanRef: RefObject<Scan | null>
  setScan: Dispatch<SetStateAction<Scan | null>>
  setTreeRev: Dispatch<SetStateAction<number>>
  setError: Dispatch<SetStateAction<string | null>>
}) {
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
  /** A repo just added by hand, waiting for its scan to reach the project list.
   *
   *  Its KEY, not its path. It was the path, compared against each row's `repo` — and those
   *  two strings agree only by luck, because `project_key` canonicalizes and `repo` keeps
   *  whatever the picker handed over. When they disagreed the effect below never fired, so
   *  the repo somebody had just chosen sat in the sidebar unselected until its scan finished
   *  minutes later and the backend's own focus finally moved the window. */
  const [pendingAdd, setPendingAdd] = useState<string | null>(null)
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
    // new repo cannot answer it — no readings yet — the lens comes over locked: a grey map
    // under the question you were already asking, with the padlock saying what would fill it.
    setMode(v?.mode ?? view.current.mode)
    setStack(v?.stack ?? [])
    setPicked(null)
  }, [])
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
          const held = keepReadings(reports).list
          setScan(held.length > 0 ? { ...s, root: applyAgentReports(s.root, held) } : s)
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
        const held = keepReadings(reports).list
        setScan(held.length > 0 ? { ...s, root: applyAgentReports(s.root, held) } : s)
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

  /** Take a project out of the sidebar. The repo and its readings are untouched.
   *
   *  Selection is cleared when it was the one removed, before the refetch rather than
   *  after: the poll would drop the row and leave `activeKey` naming a project that is not
   *  in the list, which renders as a window still showing a map nothing can be selected
   *  for. */
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

  /** A sidebar click. */
  const select = (key: string) => {
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
      const held = keepReadings(reports).list
      setScan(held.length > 0 ? { ...s, root: applyAgentReports(s.root, held) } : s)
    })
  }

  const scanKey = (key: string) => {
    // The same command the Open button uses. One construction site for a project
    // whichever door it came through — the gate lives in the restore lane and in the
    // watcher, and a press is not gated at all.
    const repo = projects.find((p) => p.key === key)?.repo
    if (repo) void scanRepo(repo).catch((err) => setError(String(err)))
  }

  return {
    projects,
    setProjects,
    activeKey,
    projectsLoaded,
    activeProject,
    repoPath,
    setPendingAdd,
    refreshProjects,
    forget,
    reset,
    select,
    scanKey,
  }
}
