import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Mirrors `model.rs`. Kept hand-written rather than generated: the shapes are small,
 *  and the comments explaining what each number *means* are the part worth having. */
export type NodeKind = 'dir' | 'file' | 'func'
export type Provenance = 'none' | 'source' | 'history' | 'human'

export interface Score {
  /** 0..1 — how unpredictable the body is given its name and signature. */
  surprise: number
  /** 0..1 — how much of that surprise the attached docs actually account for. */
  documented: number
  churn: number
  ageDays: number | null
  lastTouchedDays: number | null
  /** Raw commits in the 90-day window — the fact behind `churn`. */
  commits: number
  provenance: Provenance
  /** Fraction of this node's ANALYZED lines sitting in hot code. What a
   *  directory or file wedge is colored by — see `wedgeHeat`. */
  hotShare: number
  source: 'proxy' | 'model' | 'agent'
  /** Share of this node's lines a model actually looked at. 0 means uncolored. */
  analyzedShare: number
  /** 1 when the frame under the playhead is the commit this first appeared in, decaying to
   *  0 across the flash window, and null the rest of the time.
   *
   *  **Replay only, and the only thing a replay colours** — the scan never sets it, and a
   *  live map has no use for it. Everything else in a frame is drawn at the ground: a
   *  replay has no reading to show, and every attempt to derive one from the commit stream
   *  said less than grey did. See the note on `history.ts` for what was tried. */
  appeared?: number | null
  /** The same shape for a plain edit: 1 on the commit that touched this, decaying to 0.
   *
   *  Two events and two colours, because they are not the same news and a single ramp
   *  covering both said "something happened around here" about everything. An arrival is
   *  loud and rare; an edit is quiet and constant, and drawn far dimmer for exactly that
   *  reason. Every arrival is also an edit — the brighter one wins where they are drawn.
   *
   *  Functions only. See the note beside the container roll-up in `history.ts`. */
  edited?: number | null
}

export interface Hotspot {
  /** The real tokens, with a little surrounding context. */
  text: string
  /** What the model would have written instead, most likely first. */
  expected: string[]
  /** Surprisal in bits — how badly the expectation missed. */
  bits: number
}

export interface Node {
  id: string
  name: string
  kind: NodeKind
  path: string
  loc: number
  line: number | null
  /** Last line, for functions — what lets the code view map a source line to its chunk. */
  endLine: number | null
  lang: string | null
  /** Set on a FILE node a `.sanityignore` matched. Its functions are still parsed and
   *  still drawn — what they are not is queued, or in the denominator. Inherited by the
   *  subtree the way `collect_tasks` inherits it: the flag lives on the file, and the
   *  functions under it are out of scope with it. */
  excluded: boolean
  /** Who last committed to this file. */
  lastAuthor: string | null
  /** The comment attached to this node: a function's own doc, or a FILE's module header.
   *
   *  Already on the wire — `Node::doc` has been serialised all along — and dropped here,
   *  so the browser had a file's header and could not show it. It is what the Docs lens
   *  grades on a file and what the pane prints under HEADER. */
  doc: string | null
  score: Score | null
  /** Hash of this function's body — what a committed reading is checked against. */
  body: string | null
  hotspots: Hotspot[]
  /** Set when an agent assessed this function over MCP. */
  agent?: AgentReport
  /** The reading in `agent` was made against a different body than the one here.
   *  It is kept, and shown, but it no longer colors the wedge — see
   *  `applyAgentReports`. */
  agentStale?: boolean
  /** The score before an agent's reading overwrote it.
   *
   *  Kept because reports are folded into the tree that already has earlier reports in
   *  it, so by the time a reading goes stale the proxy number it replaced is gone and
   *  there is nothing to fall back to. Today a rescan happens to supply a fresh tree
   *  first, which hides it — but that is a coincidence of ordering, not a guarantee, and
   *  the failure it hides is a wedge keeping an expired color. */
  proxyScore?: Score
  /** How many functions this FILE holds, when the tree arrived without them — see
   *  `fileFunctions`. Zero on a file whose functions are present, where `children` is the
   *  answer, and zero on everything that is not a file. */
  funcs: number
  /** How many functions this node stands in for, on the synthetic wedge a band draws when
   *  it runs out of room. Undefined on everything else, which is what makes it the test
   *  for "this is a collection wearing a function's `kind`" — see `showsShare`. */
  rest?: number
  children: Node[]
}

/**
 * Does this wedge report a SHARE rather than a temperature?
 *
 * The two are on one color ramp and are not comparable, so which one a wedge is showing
 * has to be decided in exactly one place. It used to be decided as `kind === 'func'` in
 * four, and the overflow aggregate — a stand-in for hundreds of functions, drawn at the
 * size of a container — fell on the function side of it. So the only large objects on the
 * screen painting a temperature were the roll-ups, every real container sat near the cold
 * end of a share scale, and the map read hot exactly where it was least entitled to: that
 * pool holds what is left after the hottest members were drawn separately, so its
 * temperature is bounded by the coldest wedge beside it and says more about where the
 * truncation fell than about the code.
 */
/**
 * The tree with everything `.sanityignore` set aside taken out of it.
 *
 * **Ignored means ignored.** An excluded file used to be drawn and merely left out of the
 * queue and the denominator, on the argument that an exclusion nobody can see is how a map
 * claims completeness over a subset. The counting half of that argument survives — Rust walks
 * its own tree, which still holds them, and every place either number appears still says
 * `functions` and `excluded` together. What does not survive is the drawing: somebody who has
 * written a file saying "this is not my code" is not asking for it to be the largest wedge on
 * screen.
 *
 * Sizes are recomputed on the way out. A directory's `loc` came from Rust with its excluded
 * children counted in, and a parent whose children no longer fill it lays out as a ring with a
 * gap in it — the arcs are drawn from the sizes, not from the shape.
 *
 * Files, never functions: exclusion is a property of a path, and it is inherited. A function
 * carries its file's flag, so testing it per node would be testing the same fact twice.
 */
export function pruneExcluded(node: Node): Node {
  if (node.kind === 'func') return node
  const children = node.children.filter((c) => !c.excluded).map(pruneExcluded)
  const loc =
    node.kind === 'file' ? node.loc : children.reduce((t, c) => t + c.loc, 0)
  return { ...node, children, loc }
}

export function showsShare(node: Node): boolean {
  return node.kind !== 'func' || node.rest !== undefined
}

export interface ScanStats {
  filesScanned: number
  filesSkipped: number
  functions: number
  /** No git history, so age and churn are absent and any read of WHY something is
   *  surprising is half a verdict.
   *
   *  Nothing in the window says so any more. It used to be a banner, and the banner was
   *  the problem: it explained the four quadrants to somebody who has never been shown
   *  them, in the vocabulary of the enum — "the stability axis is off", "a crown jewel or
   *  a mess". A caveat that has to teach two concepts before it can be understood is not a
   *  caveat, and rewriting it plainly only made it a longer thing to skip. The lenses it
   *  affects are the honest place to say it, if anywhere does: Age and Churn have nothing
   *  to draw on such a repo and can say so where the question is actually being asked.
   *
   *  Kept on the wire because `just scan` still reports it, where the reader is us. */
  withoutHistory: boolean
  /** Commits reachable from HEAD. 0 when there is no history — the header reads that as
   *  "say nothing" rather than as a repo with no commits. */
  commits: number
  model: string
}

export interface Scan {
  root: Node
  stats: ScanStats
}

export interface Progress {
  done: number
  total: number
  /** What is being done — see `Progress::phase` in Rust. Present whether or not there is
   *  a count, because a bar that runs several phases at very different speeds reads as a
   *  hang at each join unless the join is named. */
  phase?: string
  /** What `done` and `total` are counting, plural — see `Progress::unit` in Rust. The
   *  window must not supply this itself: it printed `functions` over a file count for
   *  every phase that has actually run since the model pass was removed. */
  unit?: string
  /** Repo-relative path this tick is about, so the map can light the wedge — see
   *  `Progress::at` in Rust. Empty for phases with no single subject. */
  at?: string
}

/** Serde renames these to snake_case on the wire; Tauri does not convert for us. */
interface WireScore {
  surprise: number
  documented: number
  churn: number
  age_days: number | null
  commits: number
  last_touched_days: number | null
  provenance: Provenance
  hot_share: number
  source: 'proxy' | 'model' | 'agent'
  analyzed_share: number
}
interface WireNode {
  id: string
  name: string
  kind: NodeKind
  path: string
  loc: number
  line?: number | null
  lang: string | null
  end_line?: number | null
  excluded?: boolean
  last_author: string | null
  doc?: string | null
  body: string | null
  score: WireScore | null
  hotspots?: Hotspot[]
  /** Absent rather than empty for a function — see the `skip_serializing_if` on `Node` in
   *  Rust. A hundred thousand `"children":[]` is megabytes of nothing. */
  children?: WireNode[]
  funcs?: number
}
interface WireScan {
  root: WireNode
  stats: {
    files_scanned: number
    files_skipped: number
    functions: number
    without_history: boolean
    commits?: number
    model: string
  }
}

function toNode(w: WireNode): Node {
  return {
    id: w.id,
    name: w.name,
    kind: w.kind,
    path: w.path,
    loc: w.loc,
    line: w.line ?? null,
    endLine: w.end_line ?? null,
    lang: w.lang ?? null,
    excluded: w.excluded ?? false,
    lastAuthor: w.last_author ?? null,
    doc: w.doc ?? null,
    body: w.body ?? null,
    score: w.score
      ? {
          surprise: w.score.surprise,
          documented: w.score.documented,
          churn: w.score.churn,
          ageDays: w.score.age_days,
          commits: w.score.commits,
          lastTouchedDays: w.score.last_touched_days,
          provenance: w.score.provenance,
          hotShare: w.score.hot_share,
          source: w.score.source,
          analyzedShare: w.score.analyzed_share,
        }
      : null,
    hotspots: w.hotspots ?? [],
    children: (w.children ?? []).map(toNode),
    funcs: w.funcs ?? 0,
  }
}

export interface AgentCall {
  seq: number
  tool: string
}

export interface AgentActivity {
  active: boolean
  tool: string
  nonce: number
  /** The last few calls, oldest first. The poll is slower than a working reader, so a
   *  single tool name would show whichever call happened to land last and lose the rest. */
  events: AgentCall[]
}

/** Is an agent driving sanity right now? Polled so the sidebar can say so — and, just as
 *  importantly, say when nothing is. */
export function agentActivity(): Promise<AgentActivity> {
  return invoke<AgentActivity>('agent_activity').catch(() => ({
    active: false,
    tool: '',
    nonce: 0,
    events: [],
  }))
}



/** Pick a repo and hand it to Sanity.
 *
 *  Resolves to the chosen path, or null if the picker was dismissed. Rejects with a
 *  sentence to show when the directory is not a single repo — see `add_project`, which
 *  refuses a folder holding several rather than scanning all of them. */
/** Ask for a folder to add.
 *
 *  **A macOS bug lives here, diagnosed and not yet worked around.** In the open panel's LIST
 *  view — the one with disclosure triangles — a double-click on a folder is consumed as
 *  "toggle disclosure": it expands the row in place instead of descending, and clears the
 *  selection doing it. The panel's confirm path then runs against that state, finds no
 *  selection, and a directories-only panel with no selection answers with the folder you are
 *  browsing. So double-clicking `wormhole` inside `~/projects` hands over `~/projects`. It is
 *  not returning the wrong choice; it is returning NO choice, and the fallback is the parent.
 *
 *  Measured, in a standalone AppKit binary with no Tauri and no `rfd`, by printing the view
 *  mode the panel persists: mode 2 (list) returns the parent, while mode 1 (icon) and mode 3
 *  (column) both return the folder that was double-clicked. Same binary, same gesture, one
 *  variable — and only the view that HAS disclosure triangles is affected, which is what
 *  makes the toggle the likely culprit. On a macOS public beta, so it may be a regression
 *  rather than long-standing behavior.
 *
 *  Deliberately not worked around here. A delegate that refused non-repos "fixed" it by
 *  making the wrong answer invalid, which is a folder filter wearing a bug fix's clothes —
 *  and it cost a filesystem probe per visible row, which made the panel lag. The honest fix
 *  is to open the panel in a mode that has no disclosure triangles, which means writing this
 *  app's `NSNavPanelFileListModeForOpenMode` default and overriding a preference the user
 *  may have set on purpose. That is a decision, not a patch, so it waits.
 *
 *  Single-click and Open returns the right folder in every mode. That is the interaction
 *  until then. */
/** A chosen folder, and whether it is a pile of other people's repos. */
export interface Added {
  path: string
  /** The key the backend will file this repo under — see `add_project`. Matching on it
   *  rather than on `path` is what makes "select the repo I just added" exact. */
  key: string
  /** Git repos directly inside it. Zero for an ordinary project. */
  holds: number
  /** The first few, so a warning can name them. */
  names: string[]
}

export async function pickProject(): Promise<Added | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ directory: true, multiple: false, title: 'Add a folder' })
  if (typeof picked !== 'string') return null
  return invoke<Added>('add_project', { path: picked })
}

/** Ask where an exported replay should go, and write it there.
 *
 *  Resolves to the path written, or `null` if the save dialog was dismissed — which is a
 *  choice rather than a failure and must not read as one.
 *
 *  The bytes travel base64: a movie is tens of megabytes and the IPC's other shape for a
 *  byte array is a JSON array of numbers, which is four characters a byte. The write itself
 *  is Rust's because this is the only path on which the app writes anything at all, and it
 *  is worth having that in one place that can check what it was handed. */
export async function saveMovie(bytes: Uint8Array, suggested: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: suggested,
    filters: [{ name: 'Movie', extensions: ['mp4'] }],
    title: 'Save the replay',
  })
  if (typeof path !== 'string') return null
  const { encoded } = await import('./movie')
  await invoke('save_movie', { path, data: encoded(bytes) })
  return path
}

/** Put `sanity` on the PATH — a symlink into /usr/local/bin or ~/.local/bin.
 *
 *  Only needed for a direct download; the Homebrew cask links it for you. Resolves to
 *  where it went and whether that directory is visible from here — which is a weaker
 *  claim than it sounds, since a GUI app's PATH is not the user's. */
export function installCli(): Promise<{ path: string; on_path: boolean }> {
  return invoke<{ path: string; on_path: boolean }>('install_cli')
}

/** Which coding agents are installed. The app's real prerequisite now that it runs the
 *  readers itself — and, unlike "configure an MCP server", something we can just look for. */
export interface ModelChoice {
  /** What goes on the command line. */
  id: string
  /** What the harness calls it. Equal to `id` where there is nothing better. */
  label: string
  /** The harness's own default. Shown, never auto-selected. */
  default: boolean
}

export interface HarnessInfo {
  id: string
  installed: boolean
  /** Models the harness names for itself. Empty is a real answer — the app server may not
   *  answer, or the agent may not be installed — and the picker degrades to a text field. */
  models: ModelChoice[]
  /** True when `models` is the agent's own catalog rather than aliases we wrote down.
   *
   *  Only Claude Code is false: it publishes nothing a program can read, so its four
   *  entries name families and a full version has to be typed. The other three enumerate
   *  real ids, where a text field would only let somebody type one that gets rejected at
   *  spawn time. */
  enumerated: boolean
}

/** Cumulative lines the queue will have handed out, one entry per ten functions.
 *
 *  Why a lookup and not a multiplication: a partial run reads the functions the queue picks,
 *  in the order it picks them, and those are not average-sized. Apportioning by count would
 *  make the lines figure a restatement of the function count, and the two bars in the Read
 *  dialog would paint identically. Empty when the project is unknown or fully read. */
export function readCurve(key: string): Promise<number[]> {
  return invoke<number[]>('read_curve', { key }).catch(() => [])
}

/** Take a project out of the sidebar. Not a delete: the repo and its committed readings
 *  are untouched, and re-adding it restores everything it knew. */
/** Remember that this project is the one being looked at, so a restart comes back to it. */
export function selectProject(key: string): Promise<void> {
  return invoke<void>('select_project', { key })
}

/** Put the sidebar in this order and remember it — see `reorder_projects`. */
export function reorderProjects(keys: string[]): Promise<void> {
  return invoke<void>('reorder_projects', { keys })
}

export function forgetProject(key: string): Promise<void> {
  return invoke<void>('forget_project', { key })
}

export function harnesses(): Promise<HarnessInfo[]> {
  return invoke<HarnessInfo[]>('harnesses').catch(() => [])
}

/** Record who reads a project. Once per project — see `ProjectSummary.harness`. */
export function setReader(
  key: string,
  harness: string | null,
  model: string | null,
): Promise<void> {
  return invoke<void>('set_reader', { key, harness, model })
}

/** Start a wave. Resolves to the backend's own answer, including its refusals — a missing
 *  agent or a run already going are sentences worth showing, not exceptions. */
export function startCheck(
  key: string,
  opts: {
    model?: string | null
    readers?: number | null
    /** How many functions each reader takes. Fewer is faster and dearer — see `Run.batch`. */
    batch?: number | null
    limit?: number | null
  } = {},
): Promise<{ ok: boolean; error?: string; hint?: string; harness?: string }> {
  return invoke('start_check', {
    key,
    model: opts.model ?? null,
    readers: opts.readers ?? null,
    batch: opts.batch ?? null,
    limit: opts.limit ?? null,
  })
}

/** Ask a wave to stop. Honored between readers, never mid-reading. */
export function stopCheck(key: string): Promise<void> {
  return invoke<void>('stop_check', { key })
}





/** How much there is to read in a project: its functions AND its files.
 *
 *  One helper because the sum is a claim, and three call sites each adding two fields is
 *  three places for it to stop agreeing. A file is queued, leased, reported and expired
 *  exactly as a function is, so a bar that divided by functions alone could fill to 100%
 *  with sixty-two file readings outstanding — the same failure as counting leased work
 *  as done. */
export function readable(p: ProjectSummary): number {
  return p.functions + p.files
}

export interface ProjectSummary {
  key: string
  name: string
  repo: string
  functions: number
  /** Files that are their own reading — see `count_files` in Rust. The coverage
   *  denominator is `functions + files`, because both are queued, reported and expired the
   *  same way; `functions` alone let the bar fill while file readings were outstanding. */
  files: number
  /** Which scan this is, counting up. Moves when the repo did — an edit, a commit, a pull.
   *
   *  The map was a photograph nobody re-took: the window fetched a tree when the ACTIVE
   *  project changed and never again, so committing left Blame reporting lines as
   *  uncommitted forever. Comparing this is how the poll knows to fetch a new one. */
  scanned: number
  /** Functions whose reading still describes them. Stale ones are NOT counted — a
   *  project cannot be finished and hold expired readings. */
  assessed: number
  /** Readings whose code has changed since. Already excluded from `assessed`. */
  stale: number
  /** Node ids out with a reader right now — the map pulses them, so a run reads as a
   *  sweep across the repo rather than as a list of names scrolling past.
   *
   *  Safe to key on node ids only because nothing here is stored: it is one frame of the
   *  poll, matched against a tree from the same process. Anything durable uses `key_of`. */
  reading: string[]
  /** Lines of code in the functions still outstanding. The size of the job in the unit the
   *  map is drawn in — a count says how many things, this says how much code. */
  unread_lines: number
  /** Commits reachable from HEAD, as the scan counted them. 0 for a repo with no history. */
  commits: number
  /** Commits already replayed and stored. `commits - replayed` is the story left to read. */
  replayed: number
  /** Which agent reads this repo. Machine-local — which CLI you have is a fact about this
   *  laptop, not about the repo. Null until somebody chooses. */
  harness: string | null
  /** Which model was chosen here, for a repo with no readings yet to say. */
  model: string | null
  /** Which model the banked readings were actually taken by, when they agree.
   *
   *  The authority, over `model`. Never mixing models in one repo is what keeps the map on
   *  one scale, and a stored preference cannot enforce that across two laptops. Null when
   *  there are no readings, or when they already disagree — and disagreement is worth
   *  showing rather than resolving. */
  banked_model: string | null
  /** Which agent the banked readings were actually taken by, when they agree.
   *
   *  The authority over `harness`, on the same grounds: the index is one laptop's
   *  preference, while this travels with the repo. Null when there are no readings or when
   *  they disagree, which is the case where choosing for somebody would be wrong. */
  banked_harness: string | null
  /** Every model this repo's readings were taken by, commonest first.
   *
   *  One entry is the ordinary case. More than one means the map is already on two scales,
   *  which `banked_model` reports only as `null` — this is the part somebody can act on. */
  banked_models: { model: string; readings: number }[]
  /** The model of the newest DATED reading, when there is one.
   *
   *  What a mixed corpus offers in place of a banked model: with several scales in the
   *  repo there is nothing to "continue", and the last one used is what somebody most
   *  likely means. Null for a corpus banked entirely before readings carried a date. */
  recent_model: string | null
  /** The wave in progress, if any. */
  run: {
    harness: string
    model: string
    readers: number
    spawned: number
    finished: number
    failed: number
    running: boolean
    /** Asked to stop, readers not yet dead. Reported by the backend rather than held by
     *  whichever window clicked, so a terminal tailing the same run sees it too. */
    stopping: boolean
    /** Reader processes still alive. Counts down while stopping. */
    live: number
    ended: string | null
    /** What failed readers said on the way out, deduped and capped. Empty when nothing
     *  failed, or when the readers were killed on purpose. */
    failures?: string[]
  } | null
  /** The last few functions out and back, oldest first.
   *
   *  Sanity can say what is being read RIGHT NOW, which it could not while an agent
   *  session was the only party that knew. In memory and bounded: the record is
   *  `.sanity/`, and a second store the user cannot see is the mirror that made deleting
   *  the visible one appear to do nothing. */
  events: {
    seq: number
    stage: 'out' | 'read'
    name: string
    path: string
    predicted?: 'full' | 'most' | 'some' | 'none'
  }[]
  touched: number
  /** An agent has called about this project in the last minute. Per project, so two
   *  sessions working two repos both report as working. */
  working: boolean
  /** Known from the index but not yet rescanned on startup, so `functions` and `assessed`
   *  are zero because nothing has counted them — not because the repo is empty. The row
   *  shows its name and holds its place; the counts wait. */
  loading: boolean
  /** How far the pending rescan has got. Both zero means it is still walking the repo and
   *  has no denominator yet — a real state, not zero percent. */
  read_done: number
  read_total: number
  /** What the scan is doing — see `Progress.phase`. */
  read_phase?: string
  /** What `read_done` and `read_total` are counting — see `Progress.unit`. */
  read_unit?: string
}

export interface ProjectList {
  active: string | null
  projects: ProjectSummary[]
}

/** What sanity is holding, and which one the window should show. Polled, because an
 *  agent can open a project at any moment and the window is meant to just follow. */
export function listProjects(): Promise<ProjectList> {
  return invoke<ProjectList>('projects')
}

/** The text of one file in the open repo. Rust checks the path stays inside the repo —
 *  see `read_source`. */
export function readSource(repo: string, relPath: string): Promise<string> {
  return invoke<string>('read_source', { repo, relPath })
}

/** Open one file's code view in a window of its own. */
export function openCodeWindow(repo: string, relPath: string): Promise<void> {
  return invoke('open_code_window', { repo, relPath })
}

/** One file's functions — the ring inside its wedge. See `Node.funcs` and `file_functions`.
 *
 *  Asked for per file rather than sent with the tree: a repo's worth of them is 75MB on
 *  ceph, almost none of it drawable, and it cost five seconds of parsing before anything
 *  appeared. */
export async function fileFunctions(key: string, path: string): Promise<Node[]> {
  const wire = await invoke<WireNode[]>('file_functions', { key, path })
  return wire.map(toNode)
}

export async function projectScan(key: string): Promise<Scan | null> {
  const w = await invoke<WireScan | null>('project_scan', { key })
  return w ? toScan(w) : null
}

/** Four-step ordinal from the agent — see `Grade` in agentapi.rs for why it isn't a
 *  0-100. */
export type Grade = 'full' | 'most' | 'some' | 'none'

export interface AgentReport {
  id: string
  /** What the agent predicted BEFORE reading the body. */
  expected: string
  found: string
  /** Superseded by `predicted`; still present on reports banked before the grades. */
  surprised: boolean
  /** How much of the body the prediction covered. */
  predicted?: Grade
  /** How well the docs it was handed cover what the code does. */
  documented?: Grade
  /** Whether those docs say anything the code didn't already. */
  derivable?: boolean
  /** How clear the body was once open — the second axis. Absent on readings banked before
   *  the field existed; absent is "no opinion", never a grade. */
  legible?: Grade
  /** This grade answers a question that has since been rewritten — see `Report::spec`.
   *
   *  Decided in Rust and sent as a boolean, deliberately. Which spec changed the meaning of
   *  which axis is a judgement, and mirroring the constants here would put it in two places
   *  — the copy nobody is looking at being the one that goes wrong. The browser's whole job
   *  is to paint what it is told.
   *
   *  Treated exactly like `agentStale`: the grade is kept and shown as history, but it does
   *  not color a wedge and does not count in a dial. A number whose question has moved is
   *  a term claiming confidence it has not got. */
  legibleDated?: boolean
  /** The reader says something here will bite whoever edits it next. */
  trap?: boolean
  /** This answer was given under an earlier version of the trap question — see
   *  `legibleDated`, which this follows in every respect. Two flags and not one, because
   *  the two axes moved at different specs and a reading can be current on one and
   *  superseded on the other. */
  trapDated?: boolean
  note: string
  /** Was the reader seeing this file for the first time? Self-declared. */
  cold: boolean
  /** Hash of the body this reading was made against. Empty on readings banked before
   *  the committed store existed — those are taken at their word rather than shown as
   *  expired, which would present every migrated reading as broken. */
  body?: string
  /** Which model made the reading, as it reported itself. Absent on readings banked
   *  before the field existed — the panel falls back rather than inventing one. */
  model?: string
  /** Git identity of whoever ran the reading, and the commit it was made at. Shown as
   *  provenance; nothing keys off either. */
  by?: string
  at?: string
}

/**
 * Has the code moved out from under this reading?
 *
 * Mirrors `assessment::is_stale`. The reading itself is still true about the code it was
 * made against — it just isn't about *this* code any more, and the panel says so rather
 * than deleting it.
 */
export function isReportStale(r: AgentReport, node: Node): boolean {
  if (!r.body || !node.body) return false
  return r.body !== node.body
}

/** Mirrors `Grade::surprise` and `Grade::documented` in Rust. Duplicated rather than
 *  sent over the wire because the mapping is a claim about the metric, and it should be
 *  reviewable in the two places the metric is computed. */
/** Exported so the summary can paint a grade with the ramp the map paints it with. The
 *  spacing is deliberately uneven — see `HEAT_WORDS` — so a panel that re-derived its own
 *  swatches from an even 0/⅓/⅔/1 would show four colors the map never uses. */
export const GRADE_SURPRISE: Record<Grade, number> = { full: 0.08, most: 0.3, some: 0.62, none: 0.92 }
const GRADE_DOCUMENTED: Record<Grade, number> = { full: 0.95, most: 0.7, some: 0.35, none: 0 }

/** The same four steps as the GAP they leave — what the Docs lens paints.
 *
 *  Not `1 - GRADE_DOCUMENTED`, though it is nearly that: a ramp input is a position on a
 *  scale and wants the ends pinned, so `none` is 1 rather than 0.95's complement. The
 *  direction is the point — see the `--docs-*` ramp. Bright is what needs writing. */
export const DOC_GAP: Record<Grade, number> = { full: 0.05, most: 0.3, some: 0.65, none: 1 }

/**
 * A reading's legibility grade, or undefined if it has none THAT STILL MEANS ANYTHING.
 *
 * One accessor, because a grade whose question has moved is not a grade any more and every
 * consumer has to agree about that — the lens, the breakdown, the dial and the spread. When
 * `legible` was read straight off the report in four places, a bump to the ask would have
 * been honored wherever somebody remembered and ignored everywhere else, which is worse
 * than not bumping: the map would disagree with the panel beside it about the same wedge.
 *
 * A dated grade is kept on the report and shown as history — see `legibleDated`. What it
 * does not do is color, count, or bucket.
 */
export function legibleOf(r: AgentReport | undefined): Grade | undefined {
  if (!r || r.legibleDated) return undefined
  return r.legible
}

/**
 * Whether this reading reports a trap under TODAY's question — see `legibleOf`, which this
 * is the twin of, for why an accessor and not a field read.
 *
 * The four places that ask are the lens, the pulse on the patch, the panel's own banner and
 * the tally in the summary. When they read `r.trap` directly, a bump to the ask was honored
 * wherever somebody remembered, which is worse than not bumping: the map would flag a wedge
 * the panel beside it describes as ungraded.
 *
 * The reader's answer is kept and shown as history. What it no longer does is color, pulse
 * or count.
 */
export function trapOf(r: AgentReport | undefined): boolean {
  return !!r?.trap && !r.trapDated
}

/** The report's two grades, with two rules applied that the grades themselves do not carry.
 *
 *  A pre-grade report knew only surprised-or-not, so it maps to the ends of the scale —
 *  coarse, but inventing a middle grade for it would be making up a judgement nobody made.
 *  And **`derivable` forces `documented` to none**, whatever grade the reader gave it: a
 *  doc a model could regenerate from the body explains nothing that was not already there.
 *  That second rule lived only in an inline comment, so a reader predicting this function
 *  from the outside had no way to know the returned number is not the reported one.
 *  Mirrors `Report::grades` in Rust. */
export function reportGrades(r: AgentReport): { surprise: number; documented: number | null } {
  const predicted = r.predicted ?? (r.surprised ? 'none' : 'full')
  const documented = r.derivable ? 'none' : r.documented
  return {
    surprise: GRADE_SURPRISE[predicted],
    documented: documented ? GRADE_DOCUMENTED[documented] : null,
  }
}

/** What one reading is called on screen, cold to hot.
 *
 *  A reader's judgement has four steps and no more, so `62°` was inviting a comparison
 *  that cannot be made — four wedges reading `30°` are not four measurements that happened
 *  to agree, they are one grade. Two digits also need a legend before they mean anything,
 *  and the legend was never on screen.
 *
 *  **What the CODE was like, not how much the reader scored.** They were temperatures — cold,
 *  warm, hot, blazing — a fourth vocabulary that appeared in neither the store's bullet nor
 *  its heading, so one four-step judgement had three names and `blazing` existed only on
 *  screen. Then they were amounts of surprise, which was accurate and put `none` at the calm
 *  end of one lens and the alarming end of the next.
 *
 *  These name the thing on the map. A wedge is `predictable`, `typical`, `quirky` or
 *  `obscure` — properties of the code a person can go and look at — where "some surprise" is
 *  a property of somebody's reading of it. It also sidesteps the inversion entirely: the
 *  grade is `predicted` because that is what a reader can answer honestly about its own work,
 *  the lens is Surprise because that is what a person wants to know, and these four words
 *  belong to neither frame. Nothing has to be read backwards to be understood.
 *
 *  `nuanced` is no longer shared with `LEGIBLE_WORDS`, and the two second rungs are better
 *  apart: here it is code that holds nothing its neighbors have not already taught you,
 *  which is `typical`; there it is a body with one wrinkle to go back for, which is
 *  `nuanced`. One word for both said they were the same finding.
 *
 *  `assessment::render_entry`'s markers are the twin — `QUIRKY` and `OBSCURE` are these words
 *  shouting. If these move, those move.
 *
 *  They also carry no spacing, which is the point. `Grade.surprise` is deliberately uneven
 *  (0.08 / 0.30 / 0.62 / 0.92) because the two confident steps belong close together; a
 *  1-4 integer would have flattened that claim on screen while the constants went on
 *  asserting it underneath. Numbers stay where they are earned: on containers, which
 *  average many readings in surprise space and mean every digit they show. */
export const HEAT_WORDS: Record<Grade, string> = {
  full: 'predictable',
  most: 'typical',
  some: 'quirky',
  none: 'obscure',
}

/**
 * What reading the body was like, in words of its own.
 *
 * **Not `HEAT_WORDS`.** This reused those at first, so the panel offered rows reading "hot
 * once open" and "cold once open" — which asks the reader to know that hot means hard, a
 * mapping that exists nowhere and that surprise only gets away with because a temperature is
 * the thing it is actually measuring.
 *
 * **And not optical words either, which is what replaced them.** `crystal` and `murky` are
 * about light passing through, so they fought the ramp: clear means light gets through, and
 * the ramp puts the thing you must act on at the BRIGHT end. `murky` therefore named a bright
 * wedge with a word meaning cloudy, and `crystal` named a dark one with a word meaning
 * transparent. Nothing was mis-colored; the vocabulary was arguing with the color. These
 * are structural — how tangled it was to get through — and carry no brightness at all.
 *
 * `nuanced` was briefly shared with `HEAT_WORDS`, which read as the two scales making the
 * same finding. They are not: surprise's second rung is code that holds nothing its
 * neighbors have not already taught you, and this one is a body with one wrinkle to go back
 * for. Surprise's is `typical` now, and the word belongs here.
 *
 * Display only. `.sanity/` records the GRADE a reader sent — `legible: full` — so renaming
 * these can never invalidate a committed corpus, and the store never has to know which lens
 * is asking. Worth knowing when reading old readings: the QUESTION behind the grade changed
 * when these words did. It used to be "how clear is it on its own terms", which defined no
 * rung but the top one and produced 84.5% `full` across two repos; it now asks what the
 * reader actually did — one pass, a second look, jumping around, or never being sure. Grades
 * banked before that answer a softer question — and now say so, rather than being something
 * you had to know. See `legibleOf`.
 */
export const LEGIBLE_WORDS: Record<Grade, string> = {
  full: 'clean',
  most: 'nuanced',
  some: 'tangled',
  none: 'unclear',
}

/**
 * How well documented, in words of its own.
 *
 * Post-provenance, so a doc the reader judged derivable reads `none` here — the same rule
 * `reportGrades` applies to the number.
 *
 * `most` displays as `decent`, and that is the only place these part company with the grade
 * names. A ladder reads as a ladder — none, some, decent, full — where `most` sits oddly
 * between `some` and `full` and invites the reading "most of them" rather than "most of it".
 *
 * Display only, exactly as `LEGIBLE_WORDS` is: `.sanity/` records the GRADE a reader sent,
 * `documented: most`, so renaming these can never invalidate a committed corpus and the store
 * never has to know which words a pane is using this week.
 */
export const DOC_WORDS: Record<Grade, string> = {
  full: 'full',
  most: 'decent',
  some: 'some',
  none: 'none',
}

/** The word for a wedge a reader actually read, or null if nobody has.
 *
 *  Null for a proxy or model score on purpose: those are continuous and mean something
 *  different, and giving them one of four words would claim a reader's judgement where
 *  there is an estimate. A stale reading is null too — it has already stopped coloring
 *  the wedge, and a word is a color in text. */
export function readingWords(node: Node): { heat: string; documented: string | null } | null {
  if (node.kind !== 'func' || !node.agent || node.agentStale) return null
  const r = node.agent
  const predicted = r.predicted ?? (r.surprised ? 'none' : 'full')
  return {
    heat: HEAT_WORDS[predicted],
    documented: r.derivable ? DOC_WORDS.none : r.documented ? DOC_WORDS[r.documented] : null,
  }
}

/** What agents have reported for one project. Pass the key of the project ON SCREEN —
 *  without it the backend answers for whichever repo an agent last opened, which is not
 *  the same thing the moment there are two. */
export function agentReports(key: string | null): Promise<AgentReport[]> {
  return invoke<AgentReport[]>('agent_reports', { key })
}

/**
 * Fold agent reports into the tree.
 *
 * An agent's verdict is binary — it either predicted the body or it didn't — so it maps
 * to the ends of the scale rather than somewhere in the middle. That honesty is the
 * point: this is not a probability, it is a reader saying "this caught me out", and
 * dressing it up as 0.73 would imply a precision nobody measured.
 */
export function applyAgentReports(root: Node, reports: AgentReport[]): Node {
  const byId = new Map(reports.map((r) => [r.id, r]))
  const visit = (node: Node): Node => {
    if (node.children.length === 0) {
      const r = byId.get(node.id)
      if (!r || !node.score) return node
      // A reading whose code has changed does NOT color the wedge. It described a body
      // that is not there any more, and letting it keep painting is the exact failure
      // the metric refuses everywhere else — a number claiming confidence it no longer
      // has. The wedge falls back to the proxy, which is what an unread function looks
      // like, because that is what this now is. The reading is still attached, and the
      // hatch on the map plus the panel say why it went quiet.
      if (isReportStale(r, node)) {
        return {
          ...node,
          agent: r,
          agentStale: true,
          score: node.proxyScore ?? node.score,
          proxyScore: undefined,
        }
      }
      return {
        ...node,
        agent: r,
        agentStale: false,
        proxyScore: node.proxyScore ?? node.score,
        score: {
          ...node.score,
          // Both numbers from the SAME instrument. Overwriting surprise while leaving
          // `documented` behind is what produced the incoherent panel: an agent's 90
          // multiplied by a lexical heuristic's 0. If the reader graded the docs, its
          // grade wins; if it didn't, the proxy's estimate stands and `source` says so.
          ...(() => {
            const g = reportGrades(r)
            return g.documented === null
              ? { surprise: g.surprise }
              : { surprise: g.surprise, documented: g.documented }
          })(),
          source: 'agent',
          analyzedShare: 1,
        },
      }
    }
    const children = node.children.map(visit)
    const folded = children.every((c, i) => c === node.children[i])
      ? node
      : reaggregate(node, children)
    // A FILE can carry a reading of its own — see `Task.file`. It attaches, and it does
    // NOT touch the score: a file's temperature is the roll-up of what is inside it, and a
    // judgement about its header is a different measurement that must not overwrite one it
    // did not make. What reads it is the Docs lens, which asks the file about its own
    // header rather than averaging its functions, and the pane, which shows the reading.
    const own = byId.get(node.id)
    if (!own) return folded
    return { ...folded, agent: own, agentStale: isReportStale(own, node) }
  }
  return visit(root)
}

/**
 * The two things on the map that a color ramp cannot explain: hatched wedges and
 * uncolored ones.
 *
 * Counted off the tree rather than read from the project list so the legend always
 * describes the picture actually on screen — drilled into one directory, the repo-wide
 * number is annotating something nobody is looking at.
 *
 * **Scoped exactly like `summarize`, and that is the point of returning both from one
 * walk.** The panel gets its `unread` from `summarize`, which drops functions a
 * `.sanityignore` set aside; a legend that counted them would put a different number
 * beside the same word in two places on one screen, and the reader has no way to tell
 * which is lying. One definition, one traversal, no chance to drift.
 *
 * Deliberately cheap: no allocation beyond the result, no sorting. It runs on every render
 * of the legend, which includes every frame of a history replay, where `summarize`'s hot
 * and by-grade arrays would be thousands of pushes a frame.
 */
export function countPending(root: Node): { stale: number; unread: number } {
  let stale = 0
  let unread = 0
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    if (n.kind === 'func' && !outOfScope) {
      if (n.agentStale) stale++
      else if (!n.agent) unread++
    }
    for (const c of n.children) walk(c, outOfScope)
  }
  walk(root, false)
  return { stale, unread }
}

/** Temperature at which a function counts as hot. Mirrors `HOT` in `model.rs` — the
 *  number a directory's `hot_share` is a share OF, so a second copy that drifted would
 *  make the panel and the wedge it describes disagree about what "hot" means. */
export const HOT = 0.5

/**
 * What a subtree adds up to, for the panel that has no wedge to describe.
 *
 * Counted off the tree rather than taken from `ProjectSummary`, for the reason
 * `countStale` already is: drilled into one directory, a count of the whole repo is
 * annotating a picture nobody is looking at. The project row in the sidebar is the
 * repo-wide number and stays that way; this one describes what is on screen.
 *
 * `spread` counts only readings that still describe their code. Stale ones are their own
 * bucket and are NOT folded into a grade — the wedge has already stopped taking their
 * color, and a count that quietly included them would let the panel read as finished
 * while holding expired work, which is the one thing `assessed` exists to prevent.
 */
export interface RepoSummary {
  functions: number
  /** Functions a `.sanityignore` set aside. Never queued, so they can never be read —
   *  counting them as `unread` had the panel offering to connect an agent for work no
   *  reader will ever be handed, against a sidebar that already read 16925/16925.
   *  Reported beside `functions` rather than dropped: an exclusion nobody can count is
   *  how a map claims completeness over a subset somebody chose months ago. */
  excluded: number
  /** Current readings by grade — the four steps, as counts. */
  spread: Record<Grade, number>
  /** Functions holding a current reading: the sum of `spread`. */
  read: number
  /** Read once, but against a body that has since changed. */
  stale: number
  /** Never read by anybody. */
  unread: number
  /** Current readings above `HOT`, hottest first — what the map is pointing at. */
  hot: Node[]
  /** Every current reading, by the grade it came back with, hottest first within each.
   *
   *  The counts in `spread` were the whole of this and a count is where the panel stops
   *  being useful: "5,841 cold" is a fact you can do nothing with, and the reader who wants
   *  to know WHICH has only the map, which cannot spell. Node references, so the four lists
   *  together cost one pointer per function. */
  byGrade: Record<Grade, Node[]>
  /** Where to send someone who wants to deal with the expiries, or null if there are none. */
  firstStale: Node | null
  /** The second axis: how clear each body was once open.
   *
   *  Counted separately from `spread` and never merged with it. `predicted` asks whether
   *  the intent was reachable BEFORE opening; this asks what was there once it was. A repo
   *  can fail the first and pass the second — unnavigable but plain — and the gap between
   *  the two bars is the finding. Averaging them would delete exactly that. */
  legible: Record<Grade, number>
  /** Readings carrying a `legible` grade at all. The denominator for the bar above, which
   *  is NOT `read`: every reading banked before the field existed has no opinion, and a bar
   *  drawn against the wrong total would report those as a grade nobody gave. */
  legibleRead: number
  /** Readings whose reader said something there will bite the next person to edit it. */
  traps: number
  /** No `notes` list. A note is written ABOUT a function and reads as a sentence about
   *  nothing without the signature, docs and grades beside it — so it is shown on the
   *  function, in `Detail`, and nowhere a summary could stack forty of them. */
}

export function summarize(root: Node): RepoSummary {
  const s: RepoSummary = {
    functions: 0,
    excluded: 0,
    spread: { full: 0, most: 0, some: 0, none: 0 },
    read: 0,
    stale: 0,
    unread: 0,
    hot: [],
    byGrade: { full: [], most: [], some: [], none: [] },
    firstStale: null,
    legible: { full: 0, most: 0, some: 0, none: 0 },
    legibleRead: 0,
    traps: 0,
  }
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    if (n.kind === 'func') {
      if (outOfScope) {
        s.excluded++
        n.children.forEach((c) => walk(c, outOfScope))
        return
      }
      s.functions++
      if (n.agentStale) {
        s.stale++
        if (!s.firstStale) s.firstStale = n
      } else if (n.agent) {
        const g = n.agent.predicted ?? (n.agent.surprised ? 'none' : 'full')
        s.spread[g]++
        s.byGrade[g].push(n)
        s.read++
        const lg = legibleOf(n.agent)
        if (lg) {
          s.legible[lg]++
          s.legibleRead++
        }
        if (trapOf(n.agent)) s.traps++
        if (temperature(n.score) > HOT) s.hot.push(n)
      } else {
        s.unread++
      }
    }
    n.children.forEach((c) => walk(c, outOfScope))
  }
  walk(root, false)
  const hottestFirst = (a: Node, b: Node) =>
    temperature(b.score) - temperature(a.score) || b.loc - a.loc
  s.hot.sort(hottestFirst)
  for (const g of Object.keys(s.byGrade) as Grade[]) s.byGrade[g].sort(hottestFirst)
  return s
}





export async function scanRepo(path: string): Promise<Scan> {
  const w = await invoke<WireScan>('scan_repo', { req: { path } })
  return toScan(w)
}

function toScan(w: WireScan): Scan {
  return {
    root: toNode(w.root),
    stats: {
      filesScanned: w.stats.files_scanned,
      filesSkipped: w.stats.files_skipped,
      functions: w.stats.functions,
      withoutHistory: w.stats.without_history,
      commits: w.stats.commits ?? 0,
      model: w.stats.model,
    },
  }
}



export interface Upgrade {
  surprise: number
  hotspots: Hotspot[]
}

/** Per-function readings as the model produces them. */
export function onScanScore(cb: (id: string, u: Upgrade) => void): () => void {
  const un = listen<{ id: string; surprise: number; hotspots: Hotspot[] }>('scan-score', (e) =>
    cb(e.payload.id, { surprise: e.payload.surprise, hotspots: e.payload.hotspots ?? [] }),
  )
  return () => void un.then((f) => f())
}

/**
 * Apply streamed scores to a tree and roll the aggregates back up.
 *
 * Mirrors `Node::aggregate` in model.rs, and has to keep mirroring it — the two are the
 * same arithmetic reached from opposite ends, and if they drift the map will disagree
 * with itself depending on whether you watched it fill in or waited for the final tree.
 * The LOC-weighted mean and the analyzed-lines-only hot share are both load-bearing;
 * see the Rust for why.
 *
 * Returns a new root; nodes on the path to a change are cloned, the rest are shared.
 */
export function applyScores(root: Node, scores: Map<string, Upgrade>): Node {
  const visit = (node: Node): Node => {
    if (node.children.length === 0) {
      const up = scores.get(node.id)
      if (up === undefined || !node.score) return node
      // Patch surprise only. Churn, age and doc coverage are properties of the code and
      // its history rather than of the instrument, so they survive the upgrade.
      return {
        ...node,
        hotspots: up.hotspots,
        score: { ...node.score, surprise: up.surprise, source: 'model', analyzedShare: 1 },
      }
    }
    const children = node.children.map(visit)
    // Nothing underneath changed — hand back the original so React can skip the subtree.
    if (children.every((c, i) => c === node.children[i])) return node
    return reaggregate(node, children)
  }
  return visit(root)
}

/**
 * Roll child scores up one level. Mirrors `Node::aggregate` in model.rs and has to keep
 * mirroring it — they are the same arithmetic reached from opposite ends, and if they
 * drift the map disagrees with itself depending on whether you watched it fill in or
 * waited for the final tree.
 */
function reaggregate(node: Node, children: Node[]): Node {
    let w = 0
    let surprise = 0
    let documented = 0
    let churn = 0
    let hot = 0
    let analyzed = 0
    let age: number | null = null
    let touched: number | null = null
    /** The strongest instrument anything under here was measured with. */
    let src: Score['source'] = 'proxy'
    for (const c of children) {
      if (!c.score) continue
      const cw = Math.max(c.loc, 1)
      w += cw
      surprise += c.score.surprise * cw
      documented += c.score.documented * cw
      churn += c.score.churn * cw
      if (c.kind === 'func') {
        if (c.score.source === 'model' || c.score.source === 'agent') {
          analyzed += cw
          if (temperature(c.score) > HOT) hot += cw
        }
      } else {
        const ca = c.score.analyzedShare * cw
        analyzed += ca
        hot += c.score.hotShare * ca
      }
      if (c.score.ageDays !== null) {
        age = age === null ? c.score.ageDays : Math.max(age, c.score.ageDays)
      }
      // ...and was last touched when the most recent thing in it was. This was hardcoded
      // `null` below, which is the same bug Rust's `aggregate` already fixed and this
      // copy never got: any subtree an agent reported on was re-aggregated here, lost its
      // last-touched date, and went gray in Age mode. The most-read directory in the repo
      // was the one that looked least measured.
      if (c.score.lastTouchedDays !== null) {
        touched = touched === null ? c.score.lastTouchedDays : Math.min(touched, c.score.lastTouchedDays)
      }
      // An aggregate is measured by the best instrument that reached anything inside it.
      // Hardcoding `proxy` made a directory built entirely from agent readings report
      // "heuristic (no model)" — the one misstatement the panel is not allowed to make,
      // in the row that exists to prevent it.
      if (c.score.source === 'agent') src = 'agent'
      else if (c.score.source === 'model' && src === 'proxy') src = 'model'
    }
    return {
      ...node,
      children,
      score:
        w > 0
          ? {
              surprise: surprise / w,
              documented: documented / w,
              churn: churn / w,
              ageDays: age,
              // Commits are NOT recomputed here: a directory has no single commit count
              // and summing children double-counts a commit that touched twelve files.
              // Rust fills it from the git log pass, which is the only place that still
              // knows the distinct set — so carry that value rather than zeroing it, or
              // every re-aggregated directory reports zero commits while its churn bar
              // sits at 72.
              commits: node.score?.commits ?? 0,
              lastTouchedDays: touched,
              provenance: 'source',
              hotShare: analyzed > 0 ? hot / analyzed : 0,
              source: src,
              analyzedShare: analyzed / w,
            }
          : node.score,
    }
}

/** Stop the replay that is running. What it reached is kept and can be resumed — see
 *  `history::cancel`. */
export function stopHistory(): Promise<void> {
  return invoke<void>('stop_history')
}

/** A tick, and the project it is about — see `scan::Tick`. */
interface Tick {
  project: string
  progress: Progress
}

export function onScanProgress(cb: (project: string, p: Progress) => void): () => void {
  const un = listen<Tick>('scan-progress', (e) => cb(e.payload.project, e.payload.progress))
  return () => void un.then((f) => f())
}

/** The app menu's View → Appearance items. Rust owns the checkmarks, this owns the
 *  preference and its persistence — neither keeps a copy of the other's state. */
export function onSetTheme(cb: (theme: string) => void): () => void {
  const un = listen<string>('set-theme', (e) => cb(e.payload))
  return () => void un.then((f) => f())
}

/** The app menu's File → Add Project… (⌘O). */
export function onOpenProject(cb: () => void): () => void {
  const un = listen('open-project', () => cb())
  return () => void un.then((f) => f())
}

/** What `sanity` means in a terminal, and whether it is THIS app. Read-only.
 *
 *  `on_path` alone is the answer that goes wrong: two installs of Sanity can both put a
 *  `sanity` on PATH — a Homebrew cask's and this app's — and the one that wins is a fact
 *  about PATH order, not about which window you are looking at. */
export interface CliState {
  linked: boolean
  path: string | null
  on_path: boolean
  /** What a shell would actually run, followed through the symlink. */
  resolved: string | null
  /** Whether that is this app's binary. */
  is_this_app: boolean
}

export function cliStatus(): Promise<CliState> {
  return invoke<CliState>('cli_status').catch(() => ({
    linked: false,
    path: null,
    on_path: false,
    resolved: null,
    is_this_app: false,
  }))
}

/** The app menu's Sanity → Install Command Line Tool…. */
export function onInstallCli(cb: () => void): () => void {
  const un = listen('install-cli', () => cb())
  return () => void un.then((f) => f())
}

/** Tick the appearance item matching what we're actually using. The menu is built before
 *  the webview reads localStorage, so it would otherwise always show System. */
export function syncThemeMenu(theme: string): Promise<void> {
  return invoke<void>('sync_theme_menu', { theme }).catch(() => {})
}

// ── Derived reads of a score ────────────────────────────────────────────────────
//
// These live here, next to the types, so the sunburst and the detail panel can never
// disagree about what a color means.

/** What the wedge is colored by.
 *
 *  Just the surprise now. Documentation reaches the instrument rather than the
 *  arithmetic — the model gets the comment stack in its prompt, and an agent reads the
 *  docs before it predicts — so a well-documented function is cold because the reader
 *  was not surprised, not because a multiplier discounted a surprise it still reported.
 *  Keeping it as a function because this is THE number the color means, and it has
 *  changed definition once. */
export function temperature(s: Score | null): number {
  if (!s) return 0
  return Math.max(0, Math.min(1, s.surprise))
}



/**
 * Why *this* wedge got *that* verdict, in facts about this code.
 *
 * The panel used to print a fixed paragraph per quadrant, which read identically for
 * every function in the repo and so answered "it's trouble, but why?" with a horoscope.
 * A verdict is only useful with its reasons attached, and the reasons have to be the
 * actual numbers that produced it.
 *
 * Raw counts, not normalized scores: "changed 14 times since May" is something a person
 * can check and act on; "churn 100%" is a percentage of a saturation constant they have
 * never heard of.
 */

/**
 * What a wedge is actually colored by, which depends on what the wedge IS.
 *
 * A function shows its own temperature. A file, a directory, or an overflow roll-up shows
 * the *share* of its lines that are hot — because averaging temperature over hundreds of
 * functions converges on the repo mean, and every inner ring, which is most of the picture
 * by area, comes out the same lukewarm color. That was the first screenshot.
 *
 * The two readings stay compatible: both answer "how much of what I'm looking at needs
 * my attention", one for a single body and one for a collection.
 */
export function wedgeHeat(node: Node): number {
  if (!node.score) return 0
  return showsShare(node) ? node.score.hotShare : temperature(node.score)
}

/**
 * Where a hot SHARE sits on the ramp — the calibration, not the measurement.
 *
 * A share and a temperature both run 0..1 and are not the same scale. Real directories
 * do not use the top of theirs: measured line-weighted across tonepoet, sanity and
 * ComfyUI, 37 directories run from 0.0% to 37.8% hot with a median of 5.9%, so on the raw
 * number 35 of the 37 land in the bottom fifth of the ramp and every folder in the window
 * is the same gray. That is the same failure a flat histogram is for the proxy: the scale
 * looks like a measurement and reports a constant.
 *
 * `min(1, share/BAND)^SKEW` with the constants below puts the p10–p90 across 0.80 of the
 * ramp against 0.18 raw, and saturates exactly one directory — tonepoet's
 * `pipeline/qualification` at 37.8%, which is genuinely extreme. A tighter band scores
 * better on spread and saturates six, and a saturated top is the point where the ranking
 * stops being a ranking.
 *
 * Two properties this is not allowed to lose. It is MONOTONIC, so it changes no ordering —
 * which is why `wedgeHeat` above is left raw for sorting and for the numbers the panel
 * prints, and this is applied only where a color is produced. And `0` maps to `0`, so a
 * directory with nothing hot in it still reads as nothing hot: ComfyUI has six of those,
 * and a scale that lifted them off the floor could not say that anything was fine.
 *
 * Constants are a standing claim about real repos, like `heuristic::calibrate`'s. Re-run
 * the measurement across several before moving them.
 */
const SHARE_BAND = 0.25
const SHARE_SKEW = 0.7

export function shareRamp(share: number): number {
  return Math.pow(Math.min(1, Math.max(0, share) / SHARE_BAND), SHARE_SKEW)
}

/** What a wedge is PAINTED with: `wedgeHeat`, with a share put on the ramp's own scale.
 *  Separate from `wedgeHeat` because that one is the reported quantity — the tooltip's
 *  "9% hot" is the measurement and this is where it lands on the color bar. */
export function paintHeat(node: Node): number {
  if (!node.score) return 0
  return showsShare(node) ? shareRamp(node.score.hotShare) : temperature(node.score)
}

/**
 * Has anything actually looked at this wedge?
 *
 * Wedges the model hasn't reached render neutral rather than borrowing the offline
 * proxy's guess. That proxy is measurably close to sorting by line count — `just scan`
 * prints the baseline check that says so — so painting heat with it states a finding the
 * numbers don't support. Gray is not a gap in the picture; it is the picture telling you
 * what it has and hasn't examined, which is the honest thing for a comprehension tool to
 * be able to say about itself.
 */
export function isAnalyzed(node: Node): boolean {
  if (!node.score) return false
  return showsShare(node)
    ? node.score.analyzedShare > 0
    : node.score.source === 'model' || node.score.source === 'agent'
}

/** Which ramp a reading walks. Each is five CSS stops of a single hue, sharing one
 *  lightness profile — see index.css. */
export type Ramp = 'heat' | 'legible' | 'churn' | 'age' | 'docs'

/** Interpolate a ramp's five CSS stops. Returns a `var(...)` mix so the ramps stay
 *  defined in one place (index.css) and re-theme with the rest of the app. */
export function heatColor(t: number, ramp: Ramp = 'heat'): string {
  const { stops, i, f } = rampAt(t, ramp)
  return `color-mix(in oklch, var(${stops[i + 1]}) ${Math.round(f * 100)}%, var(${stops[i]}))`
}

/**
 * The stop a mixed ramp color is NEAREST to, as a bare custom-property name.
 *
 * For anyone who has to know how dark the fill actually came out — `inkOn` does, to pick
 * a label color. A `color-mix()` string is not something JavaScript can read back: the
 * mix happens in the renderer, in oklch, and nothing exposes the result. Rounding to the
 * nearer of the two stops sidesteps it entirely, and costs nothing worth having, because
 * the decision this feeds is a binary one and the two candidate stops sit a fifth of a
 * ramp apart — the mixes that round the "wrong" way are the ones sitting on the flip,
 * where either answer is within a few percent of the other.
 */
export function rampStop(t: number, ramp: Ramp = 'heat'): string {
  const { stops, i, f } = rampAt(t, ramp)
  return stops[f < 0.5 ? i : i + 1]
}

function rampAt(t: number, ramp: Ramp) {
  const stops = [0, 1, 2, 3, 4].map((i) => `--${ramp}-${i}`)
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return { stops, i, f: x - i }
}
