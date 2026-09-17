import { lazy, Suspense, useRef, useState, useMemo, useEffect } from 'react'
import type { Node, Scan } from './lib/api'
import { pruneExcluded } from './lib/api'
import { CommitLog } from './components/CommitLog'
import { HistoryBar } from './components/HistoryBar'
import { Crumbs } from './components/Crumbs'
import { Find } from './components/Find'
import { Findings } from './components/Findings'
import { TopRow } from './components/shell/TopRow'
import { LensBar } from './components/shell/LensBar'
import { BigFolderDialog, BigHistoryDialog, CliLinkDialog } from './components/shell/Dialogs'
import { ageSpanOf, type ColorMode } from './lib/colorMode'
import { dismissSplash } from './lib/splash'
import { mark, marked } from './lib/stopwatch'
import { Detail } from './components/Detail'
import { SideBar } from './components/SideBar'
import { LensHelp } from './components/LensHelp'
import { CIRCLES } from './lib/hub'
import { ReadDialog } from './components/ReadDialog'
import { MapPane } from './components/MapPane'
import { CodeOverlay } from './components/CodeOverlay'
import { findById } from './lib/tree'
import { useCliInstall, useFaceRev, useNoDevMenu, useTheme } from './hooks/useWindowChrome'
import { useReadingLeases, useReadings, useReadingsPoll } from './hooks/useReadings'
import { useLensChoices, useLensViews, useLocks, useRanks } from './hooks/useLens'
import { useProjects } from './hooks/useProjects'
import { useScanStream } from './hooks/useScanStream'
import { useAddProject } from './hooks/useAddProject'
import { useHistory, useHistoryScope, useMovieSource } from './hooks/useHistory'
import { useTraceChain } from './hooks/useTraceChain'
import { useRingFetch, useRingGraft } from './hooks/useRings'
import { useLensKeys } from './hooks/useLensKeys'
import { useRemote } from './hooks/useRemote'
import { useReport } from './hooks/useReport'
import { useNavigation } from './hooks/useNavigation'
import { useAwaiting } from './hooks/useAwaiting'
import { useFindings } from './hooks/useFindings'

/** The report dialog, loaded when it is opened. **It carries the PDF renderer** — HarfBuzz and its
 *  wasm, React's static renderer, the map's markup path — none of which the window needs to open, and
 *  a failure in any of it must never hold the window on its splash screen, which it once did. */
const ReportDialog = lazy(() => import('./components/ReportDialog').then((m) => ({ default: m.ReportDialog })))

export default function App() {
  const [scan, setScan] = useState<Scan | null>(null)
  /** Ticks when a tree ARRIVES from the backend — a different project, a rescan, or none.
   *
   *  **Not the same event as `scan` changing.** Readings are folded INTO
   *  the tree on screen, which produces a new object for the same repo several times a
   *  minute; a tree arriving is a different repo, or the same one rebuilt. The two are
   *  indistinguishable by identity and have opposite consequences for anything cached
   *  against the tree — see the effect that drops the function rings. */
  const [treeRev, setTreeRev] = useState(0)

  const faceRev = useFaceRev()
  const { readings, readingRev, keepReadings } = useReadings()
  const [error, setError] = useState<string | null>(null)
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
  const {
    mode,
    setMode,
    rings,
    chooseRings,
    band,
    spacing,
    markers,
    setMarkers,
    derivable,
    setDerivable,
    caps,
    chooseCap,
    ageRead,
    setAgeRead,
    blameRead,
    setBlameRead,
    churnAt,
    setChurnAt,
    tangleRead,
    setTangleRead,
  } = useLensChoices()
  useTheme()
  /** Whether the replay is up. The window's, not `useHistory`'s: the reading poll and the
   *  findings ask stand down while it is set — see `useHistory` for what History is. */
  const [historyOn, setHistoryOn] = useState(false)
  /** Whether a tree is on screen, for the poll — which cannot read state it is not
   *  re-created with. */
  const scanRef = useRef<Scan | null>(null)

  const {
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
  } = useProjects({ mode, stack, setMode, setStack, setPicked, keepReadings, scanRef, setScan, setTreeRev, setError })
  useReadingsPoll({ activeKey, historyOn, keepReadings, setScan })
  const { shape, streamingKey, live, shapeSort } = useScanStream()
  useNoDevMenu()
  const { addProject, takeFolder, bigFolder, setBigFolder, bigHistory, setBigHistory, hideExplain, setHideExplain } =
    useAddProject({ setError, setPendingAdd })
  const [cliLink, setCliLink] = useCliInstall()
  const readingNow = useReadingLeases(projects.find((p) => p.key === activeKey)?.reading)

  /** Where the map is rooted, as a path, taken straight from the drill stack.
   *
   *  `focus` is the same answer resolved against the tree — and the tree is what this is
   *  handed to, so asking `focus` here would be a cycle. Container ids ARE their paths,
   *  which is what makes the stack usable directly; `''` is the repo. */
  const drilled = stack.length > 0 ? stack[stack.length - 1] : ''

  const {
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
  } = useHistory({
    historyOn,
    setHistoryOn,
    repoPath,
    activeKey,
    projectName: activeProject?.name,
    setError,
    scan,
    drilled,
  })
  const { chaseTrace, trace, stopChain } = useTraceChain({ projects, setProjects, refreshProjects, replay, setError })

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
  const { filled, fns, wanted, wantRings, asked, landed, activeRef } = useRingGraft({
    drawn,
    readings,
    readingRev,
    activeKey,
    treeRev,
  })

  const tree = histRoot ?? filled
  /** The tree where a CALLBACK can read it.
   *
   *  A handler that closes over the tree is rebuilt every time the tree is, which during a
   *  reading pass is every time a reading lands — and a new function identity is what every
   *  memoised child reads as "your props changed". These handlers do not care WHICH tree they
   *  are given: they are read at the moment somebody clicks, and what is wanted then is
   *  whatever is on screen. Same argument `scanRef` and `activeRef` make, one level up. */
  const treeRef = useRef<Node | null>(null)
  treeRef.current = tree

  const locks = useLocks({ replaying, tree, activeProject, readings, readingRev, scan })

  /** What the map is actually painted with.
   *
   *  **The lens you chose. A locked one included.**
   *
   *  This substituted `language` for a lens the repo cannot answer, and the substitution was
   *  the last survivor of a rule this app has otherwise abandoned everywhere: the strip is
   *  click-through, the menu dims a locked row rather than disabling it, `lib/keys.ts` refuses
   *  to let the keyboard turn a digit down — all three on the ground that *a locked lens is
   *  still a place you can stand, and what it has to say there is said by the map*. It could
   *  not be, while standing on one silently put you somewhere else: ⌘2 on an unread repo
   *  selected Surprise and landed on Language, with the chip, the key and the panel all
   *  agreeing that Language was what you had asked for. A shortcut that answers with a
   *  different lens is worse than one that does nothing, because nothing about the screen
   *  afterwards says a substitution happened.
   *
   *  What a locked lens paints is an absence, which every lens here already knows how to
   *  draw: no reading is grey, an unresolved language is grey, a repo with no history is
   *  grey. Why it is grey is the LOCK's job — the padlock on the chip, and the sentence in
   *  its tooltip beside the button that opens it. That is the one place a repo-level answer
   *  belongs, and `ColorKey` has been drawing it on the trigger all along; nothing could
   *  reach that state to see it.
   *
   *  **Replaying or not.** It used to be pinned to `age` while a replay was on
   *  screen, and the switcher greyed with it — right about the four lenses a reading
   *  paints, and a blunt instrument for the rest, because a frame carries its own churn,
   *  age and language and could always have painted them. What a replay can and cannot
   *  show is `REPLAY`, one lens at a time; what it does about the ones it cannot is say so
   *  in the map rather than change what you are standing in. */
  const viewMode: ColorMode = mode

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

  const { toggleHistory, scope, frames } = useHistoryScope({
    historyOn,
    setHistoryOn,
    setPlaying,
    setPicked,
    focus,
    tree,
    historyBusy,
    replayed: activeProject?.replayed,
    history,
    repoPath,
  })
  const {
    findingsOpen,
    setFindingsOpen,
    findingsAsk,
    findingGroups,
    archive,
    rules,
    grammar,
    decide,
    undecide,
    writeRule,
    removeRule,
    restoreRule,
    saveBalance,
    toStock,
    findingsForMap,
  } = useFindings({ activeKey, treeRev, assessed: activeProject?.assessed, historyOn })
  useLensKeys({ toggleHistory, finding, findingsOpen, helping, setFinding, mode, setMode })
  useRingFetch({ activeKey, focus, codeFile, fns, wanted, asked, landed, activeRef })
  const remote = useRemote(repoPath)

  /** The repo's own span for the age ramp. Never consulted during a replay: a frame's
   *  colour is a flare measured in commits, not a position on this scale — see
   *  `Score.recency`. */
  const ageSpan = useMemo(() => (tree ? ageSpanOf(tree) : undefined), [tree])
  const { authorRank, langRank, ranks, slotsFor, keyAt } = useRanks({
    filled,
    stack,
    focus,
    tree,
    scan,
    historyOn,
    history,
    historyKey,
    activeKey,
    drilled,
    viewMode,
    caps,
    ageSpan,
    ageRead,
    blameRead,
    tangleRead,
  })
  const { reporting, setReporting, reportLangs, completeTree } = useReport({ filled, activeRef, treeRef, readings })
  const lensViews = useLensViews({ ageSpan, scan, ageRead, blameRead, tangleRead, churnAt, derivable })
  const { movieSource, setPaneSide } = useMovieSource({
    history,
    historyKey,
    activeKey,
    projectName: activeProject?.name,
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
  })
  const { codeNode, selected, pick, clearPick, drill, trail, owners, showIn, jumpTo, goTo, goUp, flyTo } =
    useNavigation({
      tree,
      focus,
      setStack,
      picked,
      setPicked,
      codeFile,
      setCodeFile,
      setReveal,
      activeKey,
      asked,
      landed,
      activeRef,
      treeRef,
    })
  const { awaiting, shapeRoot, awaitingProgress } = useAwaiting({
    projects,
    activeKey,
    activeProject,
    shape,
    streamingKey,
  })

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
          onError={setError}
          // **Both pill actions are the same press.** `phasesOf` reports `replay` for the
          // column's last third and `trace` for the first two, which is right for naming what
          // a step DOES — and from the row's side all three are one word being pressed, so
          // they land on one handler that works out where the column has got to.
          onReplay={(key, fresh) => (fresh ? trace(key, true) : chaseTrace(key))}
          onTrace={chaseTrace}
          onScan={scanKey}
          onStopTrace={stopChain}
          onSelect={select}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopRow>
            {focus && (
              <LensBar
                helping={helping}
                setHelping={setHelping}
                viewMode={viewMode}
                setMode={setMode}
                locks={locks}
                caps={caps}
                chooseCap={chooseCap}
                markers={markers}
                setMarkers={setMarkers}
                ageRead={ageRead}
                setAgeRead={setAgeRead}
                tangleRead={tangleRead}
                setTangleRead={setTangleRead}
                blameRead={blameRead}
                setBlameRead={setBlameRead}
                derivable={derivable}
                setDerivable={setDerivable}
                lensViews={lensViews}
                setChurnAt={setChurnAt}
                rings={rings}
                chooseRings={chooseRings}
                historyOn={historyOn}
                historyBusy={historyBusy}
                activeProject={activeProject}
                toggleHistory={toggleHistory}
                finding={finding}
                findingsOpen={findingsOpen}
                setFinding={setFinding}
              />
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

            {/* Beside the finder because it lands the same way — a row flies the camera
                through `flyTo`, which is the motion drilling in by hand already makes. What
                differs is who chose the destination: the finder is somebody naming a thing,
                and this is the map naming one. */}
            <Findings
              open={findingsOpen}
              ask={findingsAsk}
              projectKey={activeKey}
              groups={findingGroups}
              replaying={historyOn}
              archive={archive}
              rules={rules}
              grammar={grammar}
              onSaveRule={writeRule}
              onDeleteRule={removeRule}
              onResetRule={restoreRule}
              onApplyBalance={saveBalance}
              onStock={toStock}
              onDecide={decide}
              onUndecide={undecide}
              onClose={() => setFindingsOpen(false)}
              onPick={flyTo}
            />

            {/* Mounted only while it is up, unlike `Find`, which holds an index it does not
                want to rebuild. This one is static text and its cost is its own markup. */}
            {helping && <LensHelp onClose={() => setHelping(false)} />}
            {reporting && (
              <Suspense fallback={null}>
              <ReportDialog
                slug={remote ?? activeProject?.name ?? 'repo'}
                name={activeProject?.name ?? 'sanity'}
                repo={repoPath ?? null}
                views={lensViews}
                ready={tree !== null && activeProject !== null}
                replaying={historyOn}
                groups={findingGroups}
                locks={locks}
                mode={mode}
                stats={{
                  lines: filled?.loc ?? 0,
                  functions: activeProject?.functions ?? 0,
                  files: activeProject?.files ?? 0,
                  assessed: activeProject?.assessed ?? 0,
                  stale: activeProject?.stale ?? 0,
                  unparsed: filled?.unparsed ?? null,
                  languages: reportLangs,
                  model: activeProject?.banked_model ?? null,
                  harness: activeProject?.banked_harness ?? null,
                  models: activeProject?.banked_models ?? [],
                  tangleBands: scan?.stats.tangleBands ?? [],
                  callsResolved: scan?.stats.callsResolved ?? null,
                  callsUnresolved: scan?.stats.callsUnresolved ?? null,
                  commits: scan?.stats.commits ?? 0,
                  authors: scan?.stats.authors.length ?? 0,
                  churnWindows: [...churnWindows],
                  ageSpan: filled ? ageSpanOf(filled) : null,
                }}
                slotsFor={slotsFor}
                look={{ rings, spacing, rimShare: band, markers, circles: CIRCLES }}
                sortBy={headOrder}
                complete={completeTree}
                onClose={() => setReporting(false)}
              />
              </Suspense>
            )}

            <MapPane
              error={error}
              setError={setError}
              historyEmpty={historyEmpty}
              focus={focus}
              faceRev={faceRev}
              selected={selected}
              viewMode={viewMode}
              ranks={ranks}
              lensViews={lensViews}
              replaying={replaying}
              readingNow={readingNow}
              findingsForMap={findingsForMap}
              setPaneSide={setPaneSide}
              rings={rings}
              band={band}
              spacing={spacing}
              markers={markers}
              wantRings={wantRings}
              headOrder={headOrder}
              pick={pick}
              clearPick={clearPick}
              drill={drill}
              goUp={goUp}
              awaiting={awaiting}
              shapeRoot={shapeRoot}
              shapeSort={shapeSort}
              live={live}
              awaitingProgress={awaitingProgress}
              projectsLoaded={projectsLoaded}
              addProject={addProject}
              blameRead={blameRead}
            />

            {/* Under the map, not floated over it. The legend is an annotation and can live
              in a corner; the transport is the control the whole view is about, and the
              scrub bar needs the full width or it cannot address the commits it draws. */}
            {historyOn && history && historyKey === activeKey && history.tables.commits > 0 && (
              <HistoryBar
                frames={frames}
                index={histIndex}
                onIndex={indexTo}
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
                movie={movieSource}
                mode={viewMode}
                ensure={ensureTo}
                dateOf={dateOf}
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
              views={lensViews}
              tangleBands={scan?.stats.tangleBands}
              tangleOver={scan?.stats.tangleOver}
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

      {bigFolder && <BigFolderDialog bigFolder={bigFolder} setBigFolder={setBigFolder} takeFolder={takeFolder} />}

      {bigHistory && (
        <BigHistoryDialog
          bigHistory={bigHistory}
          setBigHistory={setBigHistory}
          hideExplain={hideExplain}
          setHideExplain={setHideExplain}
          takeFolder={takeFolder}
        />
      )}

      {cliLink && <CliLinkDialog cliLink={cliLink} setCliLink={setCliLink} />}

      {/* Keyed off the live list rather than a captured object: the poll replaces these
          every tick, and a dialog holding the row it was opened with would show counts
          frozen at the moment it opened. */}
      {readFor &&
        (() => {
          const p = projects.find((x) => x.key === readFor)
          return p ? (
            <ReadDialog project={p} onStarted={refreshProjects} onClose={() => setReadFor(null)} />
          ) : null
        })()}

      {codeNode && (
        <CodeOverlay
          codeNode={codeNode}
          repoPath={repoPath}
          selected={selected}
          reveal={reveal}
          viewMode={viewMode}
          authorRank={authorRank}
          langRank={langRank}
          lensViews={lensViews}
          setPicked={setPicked}
          setCodeFile={setCodeFile}
        />
      )}
    </div>
  )
}
