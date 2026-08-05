import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import {
  agentActivity,
  agentReports,
  listProjects,
  projectScan,
  applyAgentReports,
  applyScores,
  countStale,
  onOpenSettings,
  onScanScore,
  onScanProgress,
  openCodeWindow,
  scanRepo,
  type Node,
  type Progress,
  type AgentActivity,
  type ProjectSummary,
  type Scan,
  type Upgrade,
} from './lib/api'
import { Sunburst } from './components/Sunburst'
import { TopRow } from './components/shell/TopRow'
import {
  legendFor,
  rankCategories,
  type ColorMode,
} from './lib/colorMode'
import { loadTheme, saveTheme, watchSystemTheme, type Theme } from './lib/theme'
import { CodeView } from './components/CodeView'
import { ColourLegend, ModeSwitcher } from './components/ColourKey'
import { Detail } from './components/Detail'
import { Settings } from './components/Settings'
import { SideBar } from './components/SideBar'
import { AgentSetup } from './components/AgentSetup'

/** Find a node by id so the drill-in stack survives a rescan — the user's position in
 *  the tree shouldn't reset just because they re-ran the scan. */
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
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [stack, setStack] = useState<string[]>([])
  /** A function to scroll to once the code view is up.
   *
   *  Carries a nonce because the request is an EVENT, not a state: double-clicking the
   *  same function twice has to scroll back to it both times, and a bare id would look
   *  unchanged the second time and do nothing. */
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null)
  /** The file whose code is open over the map, by node id. */
  const [codeFile, setCodeFile] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  // One geometry, five encodings. The sunburst was never the thing worth swapping out —
  // what changes the question is what the colour MEANS, and the same rings answer five
  // different ones depending on that.
  const [mode, setMode] = useState<ColorMode>('surprise')
  // Open projects, in the order they were opened. The sidebar lists everything sanity
  // holds; the rail is what you have in front of you.
  // Defaults to following the system, and says so in Settings. It used to follow the
  // system with no way to override, on the argument that a toggle is a second place for
  // the preference to live — true, but it also made it impossible to look at the other
  // ground without changing the machine's, which is what you want when shooting the app
  // or checking that both palettes actually render.
  const [theme, setTheme] = useState<Theme>(loadTheme)
  useEffect(() => watchSystemTheme(theme), [theme])
  // The app menu is the only way in. Rust emits the event rather than reaching into this
  // state itself — see `build_menu`.
  useEffect(() => onOpenSettings(() => setShowSettings(true)), [])
  const [agent, setAgent] = useState<AgentActivity>({ active: false, tool: '', nonce: 0 })
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const nonce = useRef(0)
  // The path of whatever is on screen, so changing the model can re-scan it rather than
  // making the user find the directory again.
  const lastPath = useRef<string | null>(null)

  useEffect(() => onScanProgress(setProgress), [])

  // Follow whatever an agent opened.
  //
  // This is the inversion: the window does not ask the user which project to show, it
  // watches what the session driving it is working on and switches. Polled rather than
  // pushed because it is one small call every couple of seconds and needs no plumbing
  // between the loopback server and the webview.
  useEffect(() => {
    let showing: string | null = null
    const timer = setInterval(() => {
      void listProjects().then(async (list) => {
        setProjects(list.projects)
        if (!list.active || list.active === showing) return
        showing = list.active
        setActiveKey(list.active)
        const s = await projectScan(list.active)
        if (!s) return
        // A different project means a different tree; stale drill-in and selection would
        // point at nodes that no longer exist.
        setStack([])
        setSelectedId(null)
        setScan(s)
      })
    }, 1500)
    return () => clearInterval(timer)
  }, [])

  // Agents report over MCP while the app is open, so the map has to pick their verdicts
  // up without a rescan. Polled on a slow timer: an agent takes seconds per function, so
  // this costs nothing and avoids pushing events out of the loopback server.
  useEffect(() => {
    const timer = setInterval(() => {
      void agentActivity().then(setAgent)
      void agentReports().then((reports) => {
        if (reports.length === 0) return
        setScan((prev) => (prev ? { ...prev, root: applyAgentReports(prev.root, reports) } : prev))
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [])

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

  const run = useCallback(async (path: string) => {
    lastPath.current = path
    setBusy(true)
    setError(null)
    setProgress(null)
    try {
      // One pass. There used to be two — a fast proxy scan to draw the structure in
      // grey, then a model pass of tens of minutes to colour it in — and the whole
      // apparatus went with the model. The proxy draws the map in about a second, and
      // an agent's readings replace its guesses one function at a time.
      setScan(await scanRepo(path))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [])

  const pick = useCallback(async () => {
    const dir = await open({ directory: true, multiple: false })
    if (typeof dir === 'string') {
      setStack([])
      setSelectedId(null)
      await run(dir)
    }
  }, [run])

  // The wedge the sunburst is currently rooted at, resolved by id every render so a
  // rescan keeps the user where they were rather than throwing them back to the top.
  const focus = useMemo(() => {
    if (!scan) return null
    let node: Node = scan.root
    for (const id of stack) {
      const next = findById(scan.root, id)
      if (!next) break
      node = next
    }
    return node
  }, [scan, stack])

  const codeNode = useMemo(
    () => (scan && codeFile ? findById(scan.root, codeFile) : null),
    [scan, codeFile],
  )

  const selected = useMemo(
    () => (scan && selectedId ? findById(scan.root, selectedId) : null),
    [scan, selectedId],
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

  /** Go up exactly one level. The stack is rewritten to the parent's id rather than
   *  popped, because `focus` resolves the whole stack from the root every render — a
   *  single id is the canonical way to say "we are here". Undefined at the top, which
   *  is what hides the affordance. */
  const goUp = useMemo(() => {
    if (!scan || !focus || focus.id === scan.root.id) return undefined
    return () => {
      const p = parentOf(scan.root, focus.id)
      setStack(p && p.id !== scan.root.id ? [p.id] : [])
      setSelectedId(null)
    }
  }, [scan, focus])

  if (busy) nonce.current += 1

  return (
    <div className="relative flex h-full flex-col">
      {busy && focus && (
        <ProgressStrip progress={progress} />
      )}

      {/* Warnings sit above the picture, never inside it — a caveat rendered as a
          footnote under a chart is a caveat nobody reads. */}
      {scan?.stats.withoutHistory && (
        <p className="shrink-0 bg-[var(--secondary)] px-3 py-1.5 text-[11px] text-[var(--muted-foreground)]">
          No git history here, so the stability axis is off: Sanity can tell you what is
          surprising, but not whether it is a crown jewel or a mess.
        </p>
      )}

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
          onConnect={() => setShowAgents(true)}
          onSelect={(key) => {
            void projectScan(key).then((s) => {
              if (!s) return
              setActiveKey(key)
              setStack([])
              setSelectedId(null)
              setScan(s)
            })
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
        <TopRow>
          {focus && <ModeSwitcher mode={mode} onMode={setMode} />}
        </TopRow>
        <main className="relative flex min-w-0 flex-1 flex-col border-l border-t border-[var(--border)] bg-[var(--background)]">
          {stack.length > 0 && focus && (
            <nav className="flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs">
              <button
                onClick={() => setStack([])}
                className="text-[var(--accent)] hover:underline"
              >
                {scan?.root.name}
              </button>
              <span className="text-[var(--muted-foreground)]">/</span>
              <span className="mono truncate">{focus.path}</span>
              <button
                onClick={goUp}
                className="ml-2 text-[var(--muted-foreground)] hover:underline"
              >
                up
              </button>
            </nav>
          )}

          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            {error ? (
              <div className="flex h-full items-center justify-center p-6">
                <p className="max-w-[40ch] text-center text-sm text-[var(--destructive)]">
                  {error}
                </p>
              </div>
            ) : busy && !focus ? (
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <p className="text-sm text-[var(--muted-foreground)]">
                  {progress ? `Scoring ${progress.done} / ${progress.total} functions` : 'Walking the repo…'}
                </p>
              </div>
            ) : focus ? (
              <Sunburst
                root={focus}
                selected={selected}
                mode={mode}
                ranks={scan ? rankCategories(scan.root, mode) : undefined}
                onSelect={(n) => setSelectedId(n.id)}
                onClear={() => setSelectedId(null)}
                onDrill={(n) => {
                  // A function has no view of its own — it lives in a file. Drilling one
                  // opens that file and scrolls to it, so the gesture means the same
                  // thing at every level: show me inside this.
                  // Code opens OVER the map rather than replacing it. Drilling a
                  // directory changes what the chart is showing; opening a file is a
                  // different act — you are stepping out of the picture to read, and you
                  // want the picture still there when you step back.
                  if (n.kind === 'file') {
                    setCodeFile(n.id)
                    setSelectedId(n.id)
                    return
                  }
                  if (n.kind === 'func' && scan) {
                    const file = parentOf(scan.root, n.id)
                    if (file) {
                      setCodeFile(file.id)
                      setSelectedId(n.id)
                      setReveal((r) => ({ id: n.id, n: (r?.n ?? 0) + 1 }))
                      return
                    }
                  }
                  setStack((st) => [...st, n.id])
                  setSelectedId(n.id)
                }}
                onUp={goUp}
              />
            ) : (
              <Empty onPick={pick} />
            )}

            {/* Floated over the graph rather than stacked under it. The rings are a
                circle in a rectangle, so the corners and the top strip are dead space
                the picture never uses — putting the controls there costs the chart
                nothing and buys back a whole row of window height. */}
            {focus && focus.kind !== 'file' && (
              <div className="absolute bottom-2 right-2">
                <ColourLegend
                  mode={mode}
                  categories={scan ? legendFor(scan.root, mode) : []}
                  // Counted from `focus`, not the whole scan: drilled into one
                  // directory, the legend has to describe the rings in front of you or
                  // it is annotating a picture nobody is looking at.
                  stale={countStale(focus)}
                />
              </div>
            )}
          </div>
        </main>
        </div>

        <aside className="w-[290px] shrink-0 border-l border-[var(--border)] bg-[var(--card)]">
          <Detail node={selected} model={scan?.stats.model ?? null} />
        </aside>
      </div>

      {showAgents && <AgentSetup onClose={() => setShowAgents(false)} />}

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
              onSelect={(n) => setSelectedId(n.id)}
              onPopOut={() => {
                if (repoPath) void openCodeWindow(repoPath, codeNode.path)
                setCodeFile(null)
              }}
              onClose={() => setCodeFile(null)}
            />
          </div>
        </div>
      )}

      {showSettings && (
        <Settings
          theme={theme}
          // Applied on pick, not on Save. Choosing a ground and then having to confirm it
          // is backwards for the one setting whose result is the window you are looking
          // at — you evaluate it by seeing it.
          onTheme={(t) => {
            setTheme(t)
            saveTheme(t)
          }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

/**
 * The wait, made legible.
 *
 * Much shorter than it was — the proxy scans a real repo in about a second, where the
 * model pass it used to front could run for tens of minutes. The bar and ETA stay
 * because a large repo still takes long enough to wonder about, and the Stop button is
 * gone with the thing that was worth stopping.
 */
function ProgressStrip({ progress }: { progress: Progress | null }) {
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

  return (
    <div className="shrink-0 border-b border-[var(--border)] bg-[var(--secondary)] px-3 py-1.5">
      <div className="mb-1 flex items-baseline justify-between text-[11px] text-[var(--muted-foreground)]">
        <span>
          {progress ? (
            <>
              Scoring {progress.done} / {progress.total} functions.
            </>
          ) : (
            <>Reading the repo…</>
          )}
        </span>
        {eta !== null && <span className="mono shrink-0">~{eta === 0 ? '<1' : eta} min left</span>}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
    </div>
  )
}

function Empty({ onPick }: { onPick: () => void }) {
  return (
    /* One instruction and one alternative. This used to open with a headline and a
       paragraph explaining what the rings mean — a pitch, on the screen of someone who
       has already installed the thing, repeating what the sidebar says two inches to the
       left. What an empty window owes you is the next action, not the premise. */
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="max-w-[42ch] text-sm leading-relaxed text-[var(--muted-foreground)]">
        In a Claude Code session in your project, say{' '}
        <span className="mono text-[var(--foreground)]">study this project in sanity</span>.
        It will open here on its own and colour in as the agent reads.
      </p>
      <button onClick={onPick} className="text-xs text-[var(--accent)] hover:underline">
        or open a repo by hand
      </button>
    </div>
  )
}
