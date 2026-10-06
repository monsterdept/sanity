import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { type ChurnWindows, type Node, type Progress, type Scan } from '../lib/api'
import { VIEWS_DEFAULT, type ColorMode, type Views } from '../lib/colorMode'
import { CIRCLES } from '../lib/hub'
import { frameTree, headSizes, onHistoryProgress, scanHistory, warmHistory } from '../lib/history'
import type { MovieKey, MovieSource } from '../lib/movie'
import { Deltas, Funcs, baseWatermark, historyScoped, historyTables, type Tables } from '../lib/timeline'
import { findById } from '../lib/tree'

// ── The replay ──────────────────────────────────────────────────────────────
//
// History is a MODE, not a sixth lens. The lenses answer "what should the color mean",
// and in here that question is already settled: surprise is a reading taken against
// today's code and cannot be replayed onto a 2019 body, so a frame is colored by
// recency and the switcher is disabled rather than offered with one option that lies.
//
// The flag `historyOn` itself is held by `useStanding`, because the reading poll and the findings
// ask both stand down while it is set; everything else about the replay is here.
export function useHistory({
  historyOn,
  setHistoryOn,
  repoPath,
  activeKey,
  projectName,
  setError,
  scan,
  drilled,
}: {
  historyOn: boolean
  setHistoryOn: Dispatch<SetStateAction<boolean>>
  repoPath: string | null
  activeKey: string | null
  /** The active project's NAME, never its row — see `histRoot`'s dependencies. */
  projectName: string | undefined
  setError: Dispatch<SetStateAction<string | null>>
  scan: Scan | null
  /** Where the map is rooted, as a path — see `drilled` in `useMap`. */
  drilled: string
}) {
  const {
    history,
    setHistory,
    loaded,
    setLoaded,
    historyKey,
    setHistoryKey,
    shownHistory,
    busyKey,
    setBusyKey,
    walking,
    historyBusy,
    historyProgress,
    setHistoryProgress,
    histIndex,
    setHistIndex,
    playing,
    setPlaying,
    duration,
    setDuration,
    flashes,
    setFlashes,
  } = useReplayState(activeKey)
  useTimelineFetch({
    historyOn,
    repoPath,
    activeKey,
    historyKey,
    historyBusy,
    setError,
    setHistoryProgress,
    setLoaded,
    setHistory,
    setHistoryKey,
    setHistIndex,
  })
  const replay = useReplayWalk({
    walking,
    shownHistory,
    setBusyKey,
    setHistoryProgress,
    setHistory,
    setHistoryKey,
    setLoaded,
  })

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

  const { churnWindows, histRoot, headOrder } = useFrameTree({
    historyOn,
    history,
    historyKey,
    activeKey,
    histIndex,
    loaded,
    projectName,
    drilled,
    flashes,
    scan,
  })
  const { scrubTo, indexTo, ensureTo, dateOf } = useTransport({
    history,
    setPlaying,
    setLoaded,
    setHistIndex,
  })

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

  return {
    history,
    historyKey,
    busyKey,
    historyBusy,
    historyProgress,
    histIndex,
    playing,
    setPlaying,
    duration,
    setDuration,
    flashes,
    setFlashes,
    replay,
    churnWindows,
    histRoot,
    headOrder,
    scrubTo,
    historyEmpty,
    replaying,
    indexTo,
    ensureTo,
    dateOf,
  }
}

/** The timeline as held, as one object so a render cannot see the tables without the deltas. */
type Held = { tables: Tables; deltas: Deltas }

/** Everything the replay holds between renders: the story and how much of it has arrived, which
 *  project it belongs to, the walk writing one, and the transport's own settings. */
function useReplayState(activeKey: string | null) {
  /** The timeline's tables, and a handle on the deltas that stream in behind them.
   *
   *  Two halves because they arrive differently: the tables are one bounded fetch and the
   *  deltas are the story — see `lib/timeline.ts`. Held as one object so a render cannot see
   *  one without the other. */
  const [history, setHistory] = useState<Held | null>(null)
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
  /** **TEMPORARY** — whether a replay flashes what each commit touched. See `HistoryBar`'s
   *  own button, and `frameTree`, which is where it takes effect: with the flashes off the
   *  frame carries no event at all, so the map, the roll-up stand-ins and the escalation all
   *  go quiet together rather than three of them being switched off by hand. Off until asked
   *  for: a replay is the lens alone, moving. */
  const [flashes, setFlashes] = useState(false)
  return {
    history,
    setHistory,
    loaded,
    setLoaded,
    historyKey,
    setHistoryKey,
    shownHistory,
    busyKey,
    setBusyKey,
    walking,
    historyBusy,
    historyProgress,
    setHistoryProgress,
    histIndex,
    setHistIndex,
    playing,
    setPlaying,
    duration,
    setDuration,
    flashes,
    setFlashes,
  }
}

type ReplayState = ReturnType<typeof useReplayState>

/** Bringing the story in: the walk's progress events, the timeline kept warm, and a banked
 *  timeline opened when History is asked for. Reads a timeline; never walks one. */
function useTimelineFetch({
  historyOn,
  repoPath,
  activeKey,
  historyKey,
  historyBusy,
  setError,
  setHistoryProgress,
  setLoaded,
  setHistory,
  setHistoryKey,
  setHistIndex,
}: Pick<
  ReplayState,
  | 'historyKey'
  | 'historyBusy'
  | 'setHistoryProgress'
  | 'setLoaded'
  | 'setHistory'
  | 'setHistoryKey'
  | 'setHistIndex'
> & {
  historyOn: boolean
  repoPath: string | null
  activeKey: string | null
  setError: Dispatch<SetStateAction<string | null>>
}) {
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
}

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
function useReplayWalk({
  walking,
  shownHistory,
  setBusyKey,
  setHistoryProgress,
  setHistory,
  setHistoryKey,
  setLoaded,
}: Pick<
  ReplayState,
  | 'walking'
  | 'shownHistory'
  | 'setBusyKey'
  | 'setHistoryProgress'
  | 'setHistory'
  | 'setHistoryKey'
  | 'setLoaded'
>) {
  const replay = useCallback(async (key: string, repo: string, fresh = false) => {
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
  }, [])
  return replay
}

/** The tree for the frame under the playhead, and what it is folded with and sorted by. */
function useFrameTree({
  historyOn,
  history,
  historyKey,
  activeKey,
  histIndex,
  loaded,
  projectName,
  drilled,
  flashes,
  scan,
}: Pick<ReplayState, 'history' | 'historyKey' | 'histIndex' | 'loaded' | 'flashes'> & {
  historyOn: boolean
  activeKey: string | null
  projectName: string | undefined
  drilled: string
  scan: Scan | null
}) {
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

  /** This repo's churn ladder, in days — see `ChurnView`.
   *
   *  **Above the frame tree, because a `useMemo` factory runs where it is written.** It sat
   *  beside `locks`, two hundred lines further down, and `histRoot` reads it — so entering
   *  History threw `Cannot access 'churnWindows' before initialization` on the first frame.
   *  A `const` in a component body is not hoisted and a memo is not deferred.
   *
   *  It was also stranded between `locks`'s doc comment and `locks`, which handed that
   *  paragraph to this declaration — the same way `parse_log`'s doc once belonged to
   *  `credit`. A comment adjacent to a definition is that definition's.
   *
   *  Its own memo because the replay needs it too, and a fresh array per render would refold
   *  every frame. */
  const churnWindows = useMemo<ChurnWindows>(
    () => scan?.stats.churnWindows ?? VIEWS_DEFAULT.churn.windows,
    [scan],
  )

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
            projectName ?? 'repo',
            stepFrom(histIndex),
            drilled,
            1,
            flashes,
            // **The repo's own ladder, or the frame counts a window the live map does not
            // offer.** A 27-day project's rungs are its own days; a frame fixed at ninety
            // would band its whole history as one window while the switcher beside it showed
            // four, and Churn would mean two different things depending on whether History
            // was open. That split has happened here before, over blame ranks.
            churnWindows,
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
      projectName,
      drilled,
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
  return { churnWindows, histRoot, headOrder }
}

/** Moving the playhead: a click on the log, the transport, and an export's recorder, each of
 *  which waits for the story to reach the commit in its own way. */
function useTransport({
  history,
  setPlaying,
  setLoaded,
  setHistIndex,
}: Pick<ReplayState, 'history' | 'setPlaying' | 'setLoaded' | 'setHistIndex'>) {
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

  // The transport addresses the whole timeline and can only DRAW what has
  // arrived. Advancing past the run asks for the next block and holds the
  // playhead where it is until it lands, which on a repo whose story fits in one
  // block never happens at all.
  const indexTo = (i: number) => {
    const held = history
    if (held && i >= held.deltas.have()) {
      void held.deltas.ensure(i, setLoaded).then(() => setLoaded(held.deltas.have()))
      setHistIndex(Math.min(i, held.deltas.have() - 1))
      return
    }
    setHistIndex(i)
  }
  // The whole timeline, for an export — the transport's own `onIndex` fetches
  // the block under the playhead and returns, which is right for watching and
  // useless to a recorder that must not stall mid-file.
  const ensureTo = async (i: number) => {
    const held = history
    if (!held) return
    await held.deltas.ensure(i, setLoaded)
    setLoaded(held.deltas.have())
  }
  // The commit's own date, for the timeline in an exported movie. Null before
  // the window: the opening state is everything the truncated commits built and
  // has no date it can honestly carry — the same reason those functions draw
  // uncoloured. `ensure` has already been awaited by then, so the block holding
  // it is here.
  const dateOf = (i: number) => (i < 0 ? null : (history?.deltas.at(i)?.ts ?? null))
  return { scrubTo, indexTo, ensureTo, dateOf }
}

/** The replay's half that has to wait for the map: the toggle, which needs something on screen
 *  to leave, and the commits in scope, which follow what the rings are rooted at. */
export function useHistoryScope({
  historyOn,
  setHistoryOn,
  setPlaying,
  setPicked,
  focus,
  tree,
  historyBusy,
  replayed,
  history,
  repoPath,
}: {
  historyOn: boolean
  setHistoryOn: Dispatch<SetStateAction<boolean>>
  setPlaying: Dispatch<SetStateAction<boolean>>
  setPicked: Dispatch<SetStateAction<Node | null>>
  focus: Node | null
  tree: Node | null
  historyBusy: boolean
  replayed: number | undefined
  history: Held | null
  repoPath: string | null
}) {
  /** Open the replay, or leave it — the History button's own action.
   *
   *  A callback rather than the button's inline handler because the keyboard reaches it too,
   *  and the RULE has to travel with the action: entering needs something to show, leaving is
   *  always allowed. The button spells that as `disabled`, which the keyboard cannot see, and
   *  a control that is grayed in one place and live on the other is not disabled. */
  const toggleHistory = useCallback(() => {
    if (!focus) return
    if (!historyOn && (historyBusy || (replayed ?? 0) === 0)) return
    setHistoryOn((v) => !v)
    setPlaying(false)
    // Selection and drill-in survive the switch by id, but a selected FUNCTION usually will
    // not exist in the frame under the playhead — and a panel describing a function the rings
    // are not drawing is worse than an empty one.
    setPicked(null)
  }, [focus, historyOn, historyBusy, replayed])

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

  return { toggleHistory, scope, frames }
}

/** Where an exported movie's maps come from, and the measurement it scales them by. */
export function useMovieSource({
  history,
  historyKey,
  activeKey,
  projectName,
  drilled,
  flashes,
  churnWindows,
  stack,
  slotsFor,
  keyAt,
  lensViews,
  rings,
  spacing,
  band,
  markers,
  headOrder,
}: {
  history: Held | null
  historyKey: string | null
  activeKey: string | null
  projectName: string | undefined
  drilled: string
  flashes: boolean
  churnWindows: ChurnWindows
  stack: string[]
  slotsFor: (m: ColorMode, at: Node) => Map<string, number>
  keyAt: (m: ColorMode, at: Node) => MovieKey | null
  lensViews: Views
  rings: number
  spacing: MovieSource['look']['spacing']
  band: number
  markers: boolean
  headOrder: ReadonlyMap<string, number> | undefined
}) {
  /** The pane's measured side, so an export knows how much denser its map is than this. */
  const [paneSide, setPaneSide] = useState(0)
  /** Where an exported movie's maps come from — see `MovieSource`. The window's replay, asked
   *  for a commit rather than moved to one, so the map on screen stays where it is. */
  const movieSource = useMemo<MovieSource | null>(() => {
    const held = history
    if (!held || historyKey !== activeKey) return null
    const repoName = projectName ?? 'repo'
    return {
      frame: (real, since, m, px) => {
        const at = frameTree(held.tables, held.deltas, real, repoName, since, drilled, paneSide > 0 ? px / paneSide : 1, flashes, churnWindows)
        let root: Node = at
        for (const id of stack) {
          const next = findById(at, id)
          if (!next) break
          root = next
        }
        const cut = root.path.lastIndexOf('/')
        const parent = root.kind !== 'file' ? null : cut < 0 ? at : (findById(at, root.path.slice(0, cut)) ?? at)
        return { root, parent, ranks: slotsFor(m, root), key: keyAt(m, root) }
      },
      views: lensViews,
      look: { rings, spacing, rimShare: band, markers, circles: CIRCLES },
      sortBy: headOrder,
    }
  }, [history, historyKey, activeKey, projectName, drilled, paneSide, flashes, churnWindows, stack, slotsFor, keyAt, lensViews, rings, spacing, band, markers, headOrder])
  return { movieSource, setPaneSide }
}
