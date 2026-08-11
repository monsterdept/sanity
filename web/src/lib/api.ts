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
  /** Fraction of this node's ANALYSED lines sitting in hot code. What a
   *  directory or file wedge is coloured by — see `wedgeHeat`. */
  hotShare: number
  source: 'proxy' | 'model' | 'agent'
  /** Share of this node's lines a model actually looked at. 0 means uncoloured. */
  analyzedShare: number
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
   *  It is kept, and shown, but it no longer colours the wedge — see
   *  `applyAgentReports`. */
  agentStale?: boolean
  /** The score before an agent's reading overwrote it.
   *
   *  Kept because reports are folded into the tree that already has earlier reports in
   *  it, so by the time a reading goes stale the proxy number it replaced is gone and
   *  there is nothing to fall back to. Today a rescan happens to supply a fresh tree
   *  first, which hides it — but that is a coincidence of ordering, not a guarantee, and
   *  the failure it hides is a wedge keeping an expired colour. */
  proxyScore?: Score
  /** How many functions this node stands in for, on the synthetic wedge a band draws when
   *  it runs out of room. Undefined on everything else, which is what makes it the test
   *  for "this is a collection wearing a function's `kind`" — see `showsShare`. */
  rest?: number
  children: Node[]
}

/**
 * Does this wedge report a SHARE rather than a temperature?
 *
 * The two are on one colour ramp and are not comparable, so which one a wedge is showing
 * has to be decided in exactly one place. It used to be decided as `kind === 'func'` in
 * four, and the overflow aggregate — a stand-in for hundreds of functions, drawn at the
 * size of a container — fell on the function side of it. So the only large objects on the
 * screen painting a temperature were the roll-ups, every real container sat near the cold
 * end of a share scale, and the map read hot exactly where it was least entitled to: that
 * pool holds what is left after the hottest members were drawn separately, so its
 * temperature is bounded by the coldest wedge beside it and says more about where the
 * truncation fell than about the code.
 */
export function showsShare(node: Node): boolean {
  return node.kind !== 'func' || node.rest !== undefined
}

export interface ScanStats {
  filesScanned: number
  filesSkipped: number
  functions: number
  /** No git history: the stability axis is missing, so every quadrant is half a
   *  verdict. The UI has to say so rather than quietly showing a confident label. */
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
  line: number | null
  lang: string | null
  end_line: number | null
  excluded?: boolean
  last_author: string | null
  doc?: string | null
  body: string | null
  score: WireScore | null
  hotspots?: Hotspot[]
  children: WireNode[]
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
    line: w.line,
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
    children: w.children.map(toNode),
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

export interface McpCommand {
  command: string
  args: string[]
  json: string
}

export interface McpClient {
  id: string
  name: string
  path: string
  /** The client keeps a config here — a decent proxy for "installed". */
  present: boolean
  registered: boolean
  /** The entry launches THIS binary, not a copy that has since moved. */
  current: boolean
  writable: boolean
}

export function mcpCommand(): Promise<McpCommand | null> {
  return invoke<McpCommand>('mcp_command').catch(() => null)
}

export function mcpClients(): Promise<McpClient[]> {
  return invoke<McpClient[]>('mcp_clients').catch(() => [])
}

export function mcpConnect(id: string): Promise<string> {
  return invoke<string>('mcp_connect', { id })
}

export function mcpDisconnect(id: string): Promise<string> {
  return invoke<string>('mcp_disconnect', { id })
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
  /** The reader says something here will bite whoever edits it next. */
  trap?: boolean
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
 *  swatches from an even 0/⅓/⅔/1 would show four colours the map never uses. */
export const GRADE_SURPRISE: Record<Grade, number> = { full: 0.08, most: 0.3, some: 0.62, none: 0.92 }
const GRADE_DOCUMENTED: Record<Grade, number> = { full: 0.95, most: 0.7, some: 0.35, none: 0 }

/** The same four steps as the GAP they leave — what the Docs lens paints.
 *
 *  Not `1 - GRADE_DOCUMENTED`, though it is nearly that: a ramp input is a position on a
 *  scale and wants the ends pinned, so `none` is 1 rather than 0.95's complement. The
 *  direction is the point — see the `--docs-*` ramp. Bright is what needs writing. */
export const DOC_GAP: Record<Grade, number> = { full: 0.05, most: 0.3, some: 0.65, none: 1 }

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
 *  apart: here it is code that holds nothing its neighbours have not already taught you,
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
 * transparent. Nothing was mis-coloured; the vocabulary was arguing with the colour. These
 * are structural — how tangled it was to get through — and carry no brightness at all.
 *
 * `nuanced` was briefly shared with `HEAT_WORDS`, which read as the two scales making the
 * same finding. They are not: surprise's second rung is code that holds nothing its
 * neighbours have not already taught you, and this one is a body with one wrinkle to go back
 * for. Surprise's is `typical` now, and the word belongs here.
 *
 * Display only. `.sanity/` records the GRADE a reader sent — `legible: full` — so renaming
 * these can never invalidate a committed corpus, and the store never has to know which lens
 * is asking. Worth knowing when reading old readings: the QUESTION behind the grade changed
 * when these words did. It used to be "how clear is it on its own terms", which defined no
 * rung but the top one and produced 84.5% `full` across two repos; it now asks what the
 * reader actually did — one pass, a second look, jumping around, or never being sure. Grades
 * banked before that answer a softer question.
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
 *  there is an estimate. A stale reading is null too — it has already stopped colouring
 *  the wedge, and a word is a colour in text. */
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
      // A reading whose code has changed does NOT colour the wedge. It described a body
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
 * The two things on the map that a colour ramp cannot explain: hatched wedges and
 * uncoloured ones.
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
 * colour, and a count that quietly included them would let the panel read as finished
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
        if (n.agent?.legible) {
          s.legible[n.agent.legible]++
          s.legibleRead++
        }
        if (n.agent?.trap) s.traps++
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
 * The LOC-weighted mean and the analysed-lines-only hot share are both load-bearing;
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
      // last-touched date, and went grey in Age mode. The most-read directory in the repo
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

export function onScanProgress(cb: (p: Progress) => void): () => void {
  const un = listen<Progress>('scan-progress', (e) => cb(e.payload))
  return () => void un.then((f) => f())
}

/** The app menu's View → Appearance items. Rust owns the checkmarks, this owns the
 *  preference and its persistence — neither keeps a copy of the other's state. */
export function onSetTheme(cb: (theme: string) => void): () => void {
  const un = listen<string>('set-theme', (e) => cb(e.payload))
  return () => void un.then((f) => f())
}

/** The app menu's File → Open Project… (⌘O). */
export function onOpenProject(cb: () => void): () => void {
  const un = listen('open-project', () => cb())
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
// disagree about what a colour means.

/** What the wedge is coloured by.
 *
 *  Just the surprise now. Documentation reaches the instrument rather than the
 *  arithmetic — the model gets the comment stack in its prompt, and an agent reads the
 *  docs before it predicts — so a well-documented function is cold because the reader
 *  was not surprised, not because a multiplier discounted a surprise it still reported.
 *  Keeping it as a function because this is THE number the colour means, and it has
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
 * Raw counts, not normalised scores: "changed 14 times since May" is something a person
 * can check and act on; "churn 100%" is a percentage of a saturation constant they have
 * never heard of.
 */

/**
 * What a wedge is actually coloured by, which depends on what the wedge IS.
 *
 * A function shows its own temperature. A file, a directory, or an overflow roll-up shows
 * the *share* of its lines that are hot — because averaging temperature over hundreds of
 * functions converges on the repo mean, and every inner ring, which is most of the picture
 * by area, comes out the same lukewarm colour. That was the first screenshot.
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
 * is the same grey. That is the same failure a flat histogram is for the proxy: the scale
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
 * prints, and this is applied only where a colour is produced. And `0` maps to `0`, so a
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
 *  "9% hot" is the measurement and this is where it lands on the colour bar. */
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
 * numbers don't support. Grey is not a gap in the picture; it is the picture telling you
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
 * The stop a mixed ramp colour is NEAREST to, as a bare custom-property name.
 *
 * For anyone who has to know how dark the fill actually came out — `inkOn` does, to pick
 * a label colour. A `color-mix()` string is not something JavaScript can read back: the
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
