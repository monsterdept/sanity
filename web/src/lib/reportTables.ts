import { DOC_WORDS, HEAT_WORDS, LEGIBLE_WORDS, type Grade, type Node } from './api'
import {
  docGrade,
  KIND_FILL,
  KIND_ORDER,
  sortBuckets,
  OTHER_KEY,
  TANGLE_EDGES,
  UNKNOWN,
  type Bucket,
  type ColorMode,
  type Views,
} from './colorMode'

/**
 * What a lens's tables in a report hold. Data only — `report.ts` sets and draws them.
 *
 * **Two per lens, and they are different kinds of claim.** Table 1 is the breakdown: lines and
 * functions per band, the same buckets the panel lists and the rims draw. It is complete on any
 * repository, because `bucketsFor` lets a file answer for functions the window was never sent.
 * Table 2 names examples, and a name needs a function node — which a slimmed tree does not have
 * for every file. So Table 2 ranks what the window holds and says, in its note, how much that is
 * whenever it is less than everything. A top ten drawn from a sample, presented as the top ten,
 * is the confident picture of a biased one that `rings.md` writes up at length.
 */

export interface Cell {
  text: string
  mono?: boolean
  muted?: boolean
  /** A colour square before the text — a band's or a category's. */
  swatch?: string
  /** A share, drawn as a bar in the band's colour after the text. */
  bar?: { share: number; fill: string }
  /** Set the text's `code` spans as code — a reader's note quotes code in backticks. */
  markup?: boolean
}

export interface Column {
  label: string
  /** Share of the table's width, relative to the other columns. */
  weight: number
  align?: 'left' | 'right'
  /** Let the cell run onto more lines rather than cutting it — for prose, like a trap's note. */
  wrap?: boolean
}

export interface Table {
  caption: string
  columns: Column[]
  rows: Cell[][]
  note?: string
}

export interface TableContext {
  root: Node | null
  buckets: Bucket[]
  views: Views
  tangleBands: (number | null)[]
  /** The lines the map draws, which a breakdown that counts fewer says it is short of. */
  mapLines: number
}

/** Rows in an examples table. Ten is a list somebody reads; a trap is listed up to `TRAPS_MAX`,
 *  because every one of them is a thing somebody has to know. */
export const TOP = 10
export const TRAPS_MAX = 40
/** Names a cast's breakdown lists before counting the rest. */
export const FULL_CAST = 12

/** How many rows the tables may spend — narrowed by `report.ts` when a lens section would
 *  otherwise run past its two pages. `examples: 0` leaves Table 2 out. */
export interface TableLimits {
  cast: number
  examples: number
}

const n = (v: number) => v.toLocaleString()
const fn = (f: Node): Cell => ({ text: `${f.path}#${f.name}`, mono: true })
const num = (v: number | null | undefined): Cell => ({ text: v == null ? '—' : n(Math.round(v)) })

function share(x: number, total: number): string {
  if (total <= 0) return '—'
  const p = (x / total) * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

interface Walked {
  /** Function nodes the window holds. */
  funcs: Node[]
  files: Node[]
  /** Functions the repo has that the window holds no node for — `Node.funcs` on a file whose
   *  ring never arrived. */
  unnamed: number
}

function walk(root: Node | null): Walked {
  const out: Walked = { funcs: [], files: [], unnamed: 0 }
  const go = (x: Node) => {
    if (x.excluded) return
    if (x.kind === 'func') {
      // A roll-up stands for functions rather than being one.
      if (x.rest === undefined) out.funcs.push(x)
      return
    }
    if (x.kind === 'file') {
      out.files.push(x)
      out.unnamed += x.funcs
    }
    x.children.forEach(go)
  }
  if (root) go(root)
  return out
}

/**
 * The methodology's sentence about which functions a table can name, or nothing when it can name
 * them all.
 *
 * **Said once, not under every table.** It was each table's note, and a report printed it a dozen
 * times over; it is one fact about the report rather than about any table.
 */
export function namedClause(root: Node | null): string {
  const w = walk(root)
  return w.unnamed > 0
    ? `Tables that name functions rank the ${n(w.funcs.length)} of ${n(w.funcs.length + w.unnamed)} whose names the report holds.`
    : ''
}

function ranked<T>(xs: T[], by: (t: T) => number, tie: (t: T) => number): T[] {
  return [...xs].sort((a, b) => by(b) - by(a) || tie(b) - tie(a))
}

/** The tables for one lens, in the order they are printed. Empty tables are left out. */
export function tablesFor(
  m: ColorMode,
  ctx: TableContext,
  limits: TableLimits = { cast: FULL_CAST, examples: TOP },
): Table[] {
  const w = walk(ctx.root)
  const top = Math.min(limits.examples, m === 'traps' ? TRAPS_MAX : TOP)
  return [breakdown(m, ctx, w, limits.cast), top > 0 ? examples(m, ctx, w, top) : null].filter(
    (t): t is Table => t !== null && t.rows.length > 0,
  )
}

/* ── Table 1: the breakdown ───────────────────────────────────────────── */

function breakdown(m: ColorMode, ctx: TableContext, w: Walked, castRows: number): Table | null {
  const rows = sortBuckets(
    (m === 'docs' ? functionsOnly(ctx.buckets, w, ctx.views) : ctx.buckets).filter((b) => b.lines > 0),
    m,
  )
  const total = rows.reduce((t, b) => t + b.lines, 0)
  if (total === 0) return null
  const cast = m === 'blame' || m === 'language'
  // A cast is named up to what a table reads comfortably and counted after that — the key's rule.
  const shown = cast ? rows.slice(0, castRows) : rows
  const rest = rows.slice(shown.length)
  const files = m === 'language' ? filesByLanguage(w) : null
  const what = m === 'blame' ? 'author' : m === 'language' ? 'language' : 'band'

  const columns: Column[] = [
    { label: what === 'band' ? 'Band' : what === 'author' ? 'Author' : 'Language', weight: 3.4 },
    ...(files ? [{ label: 'Files', weight: 1, align: 'right' as const }] : []),
    { label: 'Functions', weight: 1.1, align: 'right' },
    { label: 'Lines', weight: 1.1, align: 'right' },
    { label: 'Share of lines', weight: 3 },
  ]
  const body: Cell[][] = shown.map((b) => [
    { text: b.label, swatch: b.fill },
    ...(files ? [num(files.get(b.label) ?? 0)] : []),
    num(b.count),
    num(b.lines),
    { text: share(b.lines, total), bar: { share: b.lines / total, fill: b.fill } },
  ])
  if (rest.length) {
    const lines = rest.reduce((t, b) => t + b.lines, 0)
    body.push([
      { text: `${n(rest.length)} more ${what === 'author' ? 'authors' : 'languages'}`, muted: true },
      ...(files ? [num(rest.reduce((t, b) => t + (files.get(b.label) ?? 0), 0))] : []),
      num(rest.reduce((t, b) => t + b.count, 0)),
      num(lines),
      { text: share(lines, total), bar: { share: lines / total, fill: 'var(--structure)' } },
    ])
  }
  return {
    caption: `Lines of function bodies by ${what}, with the functions holding them. ${
      total < ctx.mapLines
        ? `${n(total)} of the ${n(ctx.mapLines)} lines the map draws; the rest are in no band of this lens.`
        : `${n(total)} lines in all.`
    }${m === 'docs' ? ' File headers are graded too, and are not counted here.' : ''}`,
    columns,
    rows: body,
  }
}

/**
 * Docs' buckets with the files taken out.
 *
 * **A file is a reading of its own under Docs — its header — and its lines are its functions'
 * lines**, so a breakdown of both counted every line twice: sanity's printed 119,381 lines in all
 * over a 59,804-line map, and shares adding to 101%. The table is of function bodies, so the
 * headers come out of it; the map and the panel keep them, and count by reading rather than line.
 */
function functionsOnly(buckets: Bucket[], w: Walked, views: Views): Bucket[] {
  const out = new Map(buckets.map((b) => [b.key, { ...b }]))
  for (const f of w.files) {
    const b = out.get(docGrade(f, views.derivable) ?? UNKNOWN)
    if (!b) continue
    b.lines -= f.loc
    b.count -= 1
  }
  return [...out.values()]
}

function filesByLanguage(w: Walked): Map<string, number> {
  const out = new Map<string, number>()
  for (const f of w.files) if (f.lang) out.set(f.lang, (out.get(f.lang) ?? 0) + 1)
  return out
}

/* ── Table 2: examples ────────────────────────────────────────────────── */

function examples(m: ColorMode, ctx: TableContext, w: Walked, top: number): Table | null {
  switch (m) {
    case 'tangle':
      return complexity(ctx, w, top)
    case 'composition':
      return composition(w, top)
    case 'clones':
      return clones(w, top)
    case 'callers': {
      const rows = ranked(
        w.funcs.filter((f) => (f.callers ?? 0) > 0),
        (f) => f.callers ?? 0,
        (f) => f.loc,
      ).slice(0, top)
      return {
        caption: 'The most-called functions. A test that calls a function is a caller and not a dependent.',
        columns: [
          { label: 'Function', weight: 6 },
          { label: 'Callers', weight: 1, align: 'right' },
          { label: 'Dependents', weight: 1.6, align: 'right' },
          { label: 'Lines', weight: 0.9, align: 'right' },
        ],
        rows: rows.map((f) => [fn(f), num(f.callers), num(f.dependents), num(f.loc)]),      }
    }
    case 'reach': {
      const rows = ranked(
        w.funcs.filter((f) => (f.calls ?? 0) > 0),
        (f) => f.calls ?? 0,
        (f) => f.loc,
      ).slice(0, top)
      return {
        caption: 'The functions that call the most others defined in the repository.',
        columns: [
          { label: 'Function', weight: 6.6 },
          { label: 'Calls out', weight: 1.1, align: 'right' },
          { label: 'Lines', weight: 0.9, align: 'right' },
        ],
        rows: rows.map((f) => [fn(f), num(f.calls), num(f.loc)]),      }
    }
    case 'age': {
      const newest = ctx.views.age.read !== 'oldest'
      const days = (f: Node) => (newest ? f.score?.lastTouchedDays : f.score?.ageDays) ?? null
      const rows = ranked(
        w.funcs.filter((f) => days(f) != null),
        (f) => days(f) ?? 0,
        (f) => f.loc,
      ).slice(0, top)
      return {
        caption: newest
          ? 'The functions no commit has touched for longest, by the age of their newest line.'
          : 'The functions holding the oldest surviving lines.',
        columns: [
          { label: 'Function', weight: 5.4 },
          { label: 'Newest line, days', weight: 1.4, align: 'right' },
          { label: 'Oldest line, days', weight: 1.4, align: 'right' },
          { label: 'Lines', weight: 0.9, align: 'right' },
        ],
        rows: rows.map((f) => [fn(f), num(f.score?.lastTouchedDays), num(f.score?.ageDays), num(f.loc)]),      }
    }
    case 'churn': {
      const at = ctx.views.churn.at
      const window = ctx.views.churn.windows[at]
      const count = (f: Node) => f.score?.commits?.[at] ?? 0
      const rows = ranked(
        w.funcs.filter((f) => count(f) > 0),
        count,
        (f) => f.loc,
      ).slice(0, top)
      return {
        caption: `The functions changed by the most commits in the last ${n(window ?? 0)} days.`,
        columns: [
          { label: 'Function', weight: 6.2 },
          { label: `Commits, ${n(window ?? 0)} days`, weight: 1.5, align: 'right' },
          { label: 'Lines', weight: 0.9, align: 'right' },
        ],
        rows: rows.map((f) => [fn(f), num(count(f)), num(f.loc)]),      }
    }
    case 'surprise':
      return graded(w, (f) => f.agent?.predicted, HEAT_WORDS, 'The functions a reader least predicted', 'Surprise', top)
    case 'legible':
      return graded(
        w,
        (f) => (f.agent?.legibleDated ? undefined : f.agent?.legible),
        LEGIBLE_WORDS,
        'The functions a reader found hardest to follow',
        'Legibility',
        top,
      )
    case 'docs':
      return docs(w, top)
    case 'traps':
      return traps(w, top)
    default:
      // Blame and Language: the breakdown is already the list of people and of languages.
      return null
  }
}

/** Every counted body, most complex first under the reading on screen: Table 2's order, and
 *  the order the sentences about this repository name bodies in. */
function complexityRanked(ctx: TableContext, w: Walked) {
  const weighted = ctx.views.tangle !== 'raw'
  const scored = w.funcs.flatMap((f) => {
    const cog = f.score?.cognitive
    if (cog == null || cog <= 0) return []
    const i = TANGLE_EDGES.findIndex((e) => f.loc <= e)
    const median = ctx.tangleBands[i === -1 ? TANGLE_EDGES.length : i] ?? null
    return [{ f, cog, median, ratio: median == null ? null : cog / Math.max(median, 1) }]
  })
  return ranked(
    scored,
    (r) => (weighted ? (r.ratio ?? -1) : r.cog),
    (r) => (weighted ? r.cog : r.f.loc),
  )
}

function complexity(ctx: TableContext, w: Walked, top: number): Table | null {
  const weighted = ctx.views.tangle !== 'raw'
  const rows = complexityRanked(ctx, w).slice(0, top)
  return {
    caption: weighted
      ? 'The functions that branch most for their size: decision points against the median for bodies of that length here.'
      : 'The functions with the most decision points.',
    columns: [
      { label: 'Function', weight: 5.2 },
      { label: 'Lines', weight: 0.9, align: 'right' },
      { label: 'Decision points', weight: 1.4, align: 'right' },
      { label: 'Band median', weight: 1.3, align: 'right' },
      { label: '× median', weight: 1, align: 'right' },
    ],
    rows: rows.map((r) => [
      fn(r.f),
      num(r.f.loc),
      num(r.cog),
      num(r.median),
      { text: r.ratio == null ? '—' : `${r.ratio.toFixed(1)}×` },
    ]),  }
}

/** Lines per kind in one file, from its functions where the window holds them and from the
 *  columns a file carries instead where it does not — so this table is complete either way. */
function kindsOf(file: Node): Map<string, { lines: number; count: number }> {
  const out = new Map<string, { lines: number; count: number }>()
  const add = (k: string, loc: number) => {
    const at = out.get(k) ?? { lines: 0, count: 0 }
    at.lines += loc
    at.count += 1
    out.set(k, at)
  }
  const kids = file.children.filter((c) => c.kind === 'func' && c.rest === undefined)
  if (kids.length) for (const k of kids) add(k.codeKind?.kind ?? 'unplaced', k.loc)
  else if (file.cols) {
    ;(file.cols.kind ?? []).forEach((k, i) =>
      add(k >= 0 && k < KIND_ORDER.length ? KIND_ORDER[k] : 'unplaced', file.cols?.loc[i] ?? 0),
    )
  }
  return out
}

function composition(w: Walked, top: number): Table | null {
  const others = ['test', 'generated', 'vendored', 'header'] as const
  const rows = w.files.flatMap((file) => {
    const kinds = kindsOf(file)
    return others.flatMap((kind) => {
      const at = kinds.get(kind)
      return at && at.lines > 0 ? [{ file, kind, ...at }] : []
    })
  })
  return {
    caption: 'The files holding the most lines of test, generated, vendored and header code.',
    columns: [
      { label: 'File', weight: 5.6 },
      { label: 'Kind', weight: 1.5 },
      { label: 'Functions', weight: 1.1, align: 'right' },
      { label: 'Lines', weight: 1, align: 'right' },
    ],
    rows: ranked(
      rows,
      (r) => r.lines,
      (r) => r.count,
    )
      .slice(0, top)
      .map((r) => [
        { text: r.file.path, mono: true },
        { text: r.kind, swatch: KIND_FILL[r.kind] },
        num(r.count),
        num(r.lines),
      ]),
  }
}

function clones(w: Walked, top: number): Table | null {
  const groups = new Map<number, Node[]>()
  for (const f of w.funcs) {
    if (f.cloneGroup == null) continue
    const at = groups.get(f.cloneGroup)
    if (at) at.push(f)
    else groups.set(f.cloneGroup, [f])
  }
  const rows = ranked(
    [...groups.values()],
    (g) => g[0].cloneSize ?? g.length,
    (g) => g.reduce((t, f) => t + f.loc, 0),
  ).slice(0, top)
  return {
    caption: 'The largest clone groups: functions whose bodies are identical once names and literals are set aside.',
    columns: [
      { label: 'Copies', weight: 0.9, align: 'right' },
      { label: 'Lines', weight: 0.9, align: 'right' },
      { label: 'Members', weight: 7, wrap: true },
    ],
    rows: rows.map((g) => {
      const size = g[0].cloneSize ?? g.length
      const named = [...g].sort((a, b) => b.loc - a.loc)
      const shown = named.slice(0, 3).map((f) => `${f.path}#${f.name}`)
      const more = size - shown.length
      return [
        num(size),
        num(g.reduce((t, f) => t + f.loc, 0)),
        { text: `${shown.join(', ')}${more > 0 ? ` and ${n(more)} more` : ''}`, mono: true },
      ]
    }),  }
}

/** The two informative grades of a reading axis, worst first, then widest. Stale readings are
 *  not readings of this code and are left out, as they are left off the map. */
function graded(
  w: Walked,
  gradeOf: (f: Node) => Grade | undefined,
  words: Record<Grade, string>,
  caption: string,
  label: string,
  top: number,
): Table | null {
  const order: Grade[] = ['none', 'some']
  const rows = w.funcs.flatMap((f) => {
    const g = f.agentStale ? undefined : gradeOf(f)
    return g && order.includes(g) ? [{ f, g }] : []
  })
  return {
    caption: `${caption}: graded ${words.none}, then ${words.some}.`,
    columns: [
      { label: 'Function', weight: 6.4 },
      { label: label, weight: 1.2 },
      { label: 'Lines', weight: 0.9, align: 'right' },
    ],
    rows: ranked(
      rows,
      (r) => (r.g === 'none' ? 1 : 0),
      (r) => r.f.loc,
    )
      .slice(0, top)
      .map((r) => [fn(r.f), { text: words[r.g] }, num(r.f.loc)]),  }
}

function docs(w: Walked, top: number): Table | null {
  const rows = w.funcs.flatMap((f) => {
    if (f.agentStale || !f.agent?.documented) return []
    // Derivable documentation counts as none in every score, and the table follows the score.
    const g: Grade = f.agent.derivable ? 'none' : f.agent.documented
    return g === 'none' || g === 'some' ? [{ f, g, derivable: !!f.agent.derivable }] : []
  })
  return {
    caption: `The largest functions whose documentation covers least of what they do: graded ${DOC_WORDS.none}, then ${DOC_WORDS.some}.`,
    columns: [
      { label: 'Function', weight: 6 },
      { label: 'Documentation', weight: 1.7 },
      { label: 'Lines', weight: 0.9, align: 'right' },
    ],
    rows: ranked(
      rows,
      (r) => (r.g === 'none' ? 1 : 0),
      (r) => r.f.loc,
    )
      .slice(0, top)
      .map((r) => [fn(r.f), { text: r.derivable ? `${DOC_WORDS.none} (derivable)` : DOC_WORDS[r.g] }, num(r.f.loc)]),  }
}

/**
 * One sentence about this repository for a deck's lens slide, read off Table 1's buckets.
 *
 * **A lens slide was a definition any repository could have had.** Its words said what the lens
 * is; nothing on it said what this one shows, and the space under them was empty. Each sentence
 * names the end of the lens somebody opens it for. Empty where the lens counted nothing.
 */
export function lensFact(m: ColorMode, ctx: TableContext): string {
  const w = walk(ctx.root)
  const bs = m === 'docs' ? functionsOnly(ctx.buckets, w, ctx.views) : ctx.buckets
  const total = bs.reduce((t, b) => t + b.lines, 0)
  if (total <= 0) return ''
  const sum = (pick: (b: Bucket) => boolean) => bs.filter(pick).reduce((t, b) => t + b.lines, 0)
  const pct = (x: number, of = total) => {
    const p = (x / of) * 100
    return p > 0 && p < 1 ? 'Less than 1%' : `${Math.round(p)}%`
  }
  const absent = (b: Bucket) => b.key.startsWith(' ')
  const largest = (pick: (b: Bucket) => boolean) => bs.filter(pick).sort((a, b) => b.lines - a.lines)[0]
  const graded = (words: Record<Grade, string>, what: string) => {
    const read = sum((b) => ['none', 'some', 'most', 'full'].includes(b.key))
    const hot = sum((b) => b.key === 'none' || b.key === 'some')
    return read > 0 ? `${pct(hot, read)} of the ${what} were graded ${words.some} or ${words.none}.` : ''
  }
  switch (m) {
    case 'tangle': {
      const x = sum((b) => b.label === 'very high')
      const how = ctx.views.tangle === 'raw' ? 'by raw count' : 'for their size'
      return x ? `${pct(x)} of function lines are in bodies rated very high ${how}.` : `No body here is rated very high ${how}.`
    }
    case 'composition': {
      const b = largest((b) => ['test', 'generated', 'vendored', 'header'].includes(b.key))
      return b ? `${pct(b.lines)} of function lines are ${b.label} code.` : 'Every placed function here is code.'
    }
    case 'language': {
      const named = bs.filter((b) => !absent(b))
      const b = largest((b) => !absent(b))
      return b ? `${pct(b.lines)} of function lines are ${b.label}${named.length > 1 ? `, of ${n(named.length)} languages` : ''}.` : ''
    }
    case 'clones': {
      const groups = bs.filter((b) => /^\d.*clones$/.test(b.label))
      const count = groups.reduce((t, b) => t + b.count, 0)
      const x = groups.reduce((t, b) => t + b.lines, 0)
      return count ? `${n(count)} functions have a clone here, holding ${pct(x).toLowerCase()} of function lines.` : 'No function here has a clone.'
    }
    case 'callers': {
      const x = sum((b) => b.label === 'no in-repo caller')
      return `${pct(x)} of function lines are in bodies nothing in this repository calls.`
    }
    case 'reach': {
      const x = sum((b) => b.label.startsWith('calls nothing'))
      return `${pct(x)} of function lines are in bodies that call nothing else defined here.`
    }
    case 'blame': {
      const b = largest((b) => !absent(b))
      if (!b) return ''
      return ctx.views.blame === 'lines'
        ? `${pct(b.lines)} of function lines are in bodies written mostly by ${b.label}.`
        : `${pct(b.lines)} of function lines are in bodies last changed by ${b.label}.`
    }
    case 'age': {
      const x = sum((b) => b.label === 'today' || b.label === 'this week')
      if (ctx.views.age.read === 'oldest') {
        return x ? `${pct(x)} of function lines are in bodies with no line older than a week.` : 'Every body here holds a line older than a week.'
      }
      return x ? `${pct(x)} of function lines are in bodies changed in the last week.` : 'No body here has changed in the last week.'
    }
    case 'churn': {
      const days = n(ctx.views.churn.windows[ctx.views.churn.at] ?? 0)
      const x = sum((b) => b.label === '10+ commits')
      return x
        ? `${pct(x)} of function lines are in bodies changed by ten or more commits in ${days} days.`
        : `No body here was changed by ten or more commits in ${days} days.`
    }
    case 'surprise':
      return graded(HEAT_WORDS, 'lines a reader has read')
    case 'legible':
      return graded(LEGIBLE_WORDS, 'lines a reader has read')
    case 'docs': {
      const read = sum((b) => ['none', 'some', 'most', 'full'].includes(b.key))
      const hot = sum((b) => b.key === 'none' || b.key === 'some')
      return read > 0
        ? `${pct(hot, read)} of graded function lines have documentation covering ${DOC_WORDS.some} or ${DOC_WORDS.none} of the body.`
        : ''
    }
    case 'traps': {
      const count = bs.find((b) => b.key === 'trap')?.count ?? 0
      return count ? `A reader reported ${n(count)} trap${count === 1 ? '' : 's'}.` : 'No reader has reported a trap here.'
    }
    default:
      return ''
  }
}

function traps(w: Walked, top: number): Table | null {
  const found = w.funcs.filter((f) => f.agent?.trap && !f.agent.trapDated && !f.agentStale)
  const rows = ranked(
    found,
    (f) => f.loc,
    () => 0,
  )
  const shown = rows.slice(0, top)
  const notes = rows.length > shown.length ? `${n(rows.length - shown.length)} more traps are not listed.` : ''
  return {
    caption: 'Every trap a reader reported, in the reader’s own words: what breaks, and when.',
    columns: [
      { label: 'Function', weight: 3.2, wrap: true },
      { label: 'What breaks', weight: 5.6, wrap: true },
    ],
    rows: shown.map((f) => [fn(f), { text: f.agent?.note || '—', markup: true }]),
    note: notes || undefined,
  }
}

/* ── In this repository ───────────────────────────────────────────────── */

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/**
 * What a lens's map shows in this repository: a few sentences read off the same data as its
 * tables, set on the lens page under `STORY_HEADING`.
 *
 * **The tables held the story and the prose never told it.** The page defined the lens, described
 * the instrument and stated its limits, and the one fact about this repository was a list of band
 * medians inside the Instrument paragraph. Each sentence here names something a reader can find
 * on the map beside it. Empty for a lens whose page has not been rewritten to carry one.
 */
export function lensStory(m: ColorMode, ctx: TableContext): string[] {
  if (m === 'tangle') return complexityStory(ctx)
  const w = walk(ctx.root)
  /** Table 2's first row: the extreme the Results name, so the page and its table agree. */
  const lead = (): Cell[] | undefined => examples(m, ctx, w, 1)?.rows[0]
  const total = ctx.buckets.reduce((t, b) => t + b.lines, 0)
  const said: string[] = []
  switch (m) {
    case 'composition': {
      const kinds = ctx.buckets.filter((b) => !isAbsent(b) && b.lines > 0).sort((a, b) => b.lines - a.lines)
      if (!kinds.length) break
      said.push(
        `Of the ${n(total)} function lines, ${listed(kinds.map((b) => `${shareOf(b.lines, total)} are ${b.key === 'code' ? 'code' : `${b.label} code`}`))}.`,
      )
      if (!kinds.some((b) => b.key === 'generated' || b.key === 'vendored' || b.key === 'header')) {
        said.push('No generated, vendored or header code was identified.')
      }
      const top = lead()
      if (top) {
        said.push(`The largest share of non-code lines in a single file is ${top[1].text} code in ${chip(top[0].text)} (${top[3].text} lines).`)
      }
      const unplaced = linesWhere(ctx.buckets, isAbsent)
      if (unplaced > 0) said.push(`A further ${n(unplaced)} lines are unplaced.`)
      break
    }
    case 'language': {
      const named = ctx.buckets.filter((b) => !isAbsent(b) && b.lines > 0).sort((a, b) => b.lines - a.lines)
      if (!named.length) break
      said.push(
        `The ${n(total)} function lines are written in ${n(named.length)} language${named.length === 1 ? '' : 's'}: ${listed(named.map((b) => `${b.label} (${shareOf(b.lines, total)})`))}.`,
      )
      break
    }
    case 'clones': {
      const groups = ctx.buckets.filter((b) => /^\d.*clones$/.test(b.label))
      const members = groups.reduce((t, b) => t + b.count, 0)
      const unique = ctx.buckets.filter((b) => b.key === 'unique' || b.label === 'no clone in this repo').reduce((t, b) => t + b.count, 0)
      const small = linesWhere(ctx.buckets, (b) => b.label === 'too small to compare' || isAbsent(b))
      said.push(
        members > 0
          ? `Of the ${n(members + unique)} functions large enough to compare, ${n(members)} belong to clone groups, holding ${shareOf(linesWhere(groups, () => true), total)} of function lines.`
          : `None of the ${n(unique)} functions large enough to compare belongs to a clone group.`,
      )
      const top = lead()
      if (top) said.push(`The largest group has ${top[0].text} members and ${top[1].text} lines in all.`)
      if (small > 0) {
        said.push(`Bodies below the 40-token floor, which were not compared, hold ${shareOf(small, total)} of function lines.`)
      }
      break
    }
    case 'callers':
    case 'reach': {
      const counted = ctx.buckets.filter((b) => !isAbsent(b))
      const within = counted.reduce((t, b) => t + b.lines, 0)
      if (within <= 0) break
      const callers = m === 'callers'
      const none = linesWhere(counted, (b) => (callers ? b.label === 'no in-repo caller' : b.label.startsWith('calls nothing')))
      const six = linesWhere(counted, (b) => b.label === (callers ? '6+ callers' : 'calls 6+'))
      said.push(
        callers
          ? `Of the ${n(within)} function lines in call-resolving languages, ${shareOf(none, within)} lie in bodies with no caller in this repository and ${shareOf(six, within)} in bodies with six or more.`
          : `Of the ${n(within)} function lines in call-resolving languages, ${shareOf(six, within)} lie in bodies calling six or more functions defined here and ${shareOf(none, within)} in bodies calling none.`,
      )
      const top = lead()
      if (top) {
        said.push(
          callers
            ? `The most-called function is ${chip(top[0].text)}, with ${top[1].text} callers${top[2].text !== '—' ? `, ${top[2].text} of them outside tests` : ''}.`
            : `The largest count is observed in ${chip(top[0].text)}, which calls ${top[1].text} functions defined here.`,
        )
      }
      said.push('{callsResolved}')
      const unresolved = linesWhere(ctx.buckets, isAbsent)
      if (unresolved > 0) said.push(`A further ${n(unresolved)} lines are in languages whose calls are not resolved.`)
      break
    }
    case 'blame': {
      said.push('{authorsCommits}')
      const people = ctx.buckets.filter((b) => !isAbsent(b) && b.lines > 0).sort((a, b) => b.lines - a.lines)
      const reading = ctx.views.blame === 'lines' ? 'most-lines' : 'newest-line'
      if (people[0]) {
        said.push(
          `Under the ${reading} reading, ${shareOf(people[0].lines, total)} of function lines are attributed to ${people[0].label}${people[1] ? `, and ${shareOf(people[1].lines, total)} to ${people[1].label}` : ''}.`,
        )
      }
      const uncommitted = linesWhere(ctx.buckets, (b) => b.key === ' uncommitted')
      if (uncommitted > 0) said.push(`Uncommitted work accounts for ${shareOf(uncommitted, total)} of function lines.`)
      const other = linesWhere(ctx.buckets, (b) => b.key === OTHER_KEY)
      if (other > 0) said.push(`Authors beyond the colour cap account for ${shareOf(other, total)}.`)
      break
    }
    case 'age': {
      said.push('{ageSpan}')
      const recent = linesWhere(ctx.buckets, (b) => b.label === 'today' || b.label === 'this week')
      const old = linesWhere(ctx.buckets, (b) => b.label === 'this quarter' || b.label === 'older')
      said.push(
        ctx.views.age.read === 'oldest'
          ? `Under the oldest-line reading, ${shareOf(recent, total)} of function lines lie in bodies whose oldest surviving line is under a week old and ${shareOf(old, total)} in bodies holding a line 30 days old or more.`
          : `Under the newest-line reading, ${shareOf(recent, total)} of function lines lie in bodies changed within the last week and ${shareOf(old, total)} in bodies unchanged for 30 days or more.`,
      )
      const undated = linesWhere(ctx.buckets, isAbsent)
      if (undated > 0) said.push(`A further ${n(undated)} lines have no recorded history.`)
      break
    }
    case 'churn': {
      said.push('{churnWindows}')
      const days = n(ctx.views.churn.windows[ctx.views.churn.at] ?? 0)
      const busy = linesWhere(ctx.buckets, (b) => b.label === '10+ commits')
      const still = linesWhere(ctx.buckets, (b) => b.label === 'no commits found')
      said.push(
        `Within the ${days}-day window, ${shareOf(busy, total)} of function lines lie in bodies changed by ten or more commits and ${shareOf(still, total)} in bodies with no recorded change.`,
      )
      const top = lead()
      if (top) said.push(`The most frequently changed body is ${chip(top[0].text)}, with ${top[1].text} commits in the window.`)
      break
    }
    case 'surprise':
    case 'legible':
    case 'docs': {
      const bs = m === 'docs' ? functionsOnly(ctx.buckets, w, ctx.views) : ctx.buckets
      const all = bs.reduce((t, b) => t + b.lines, 0)
      const read = linesWhere(bs, (b) => ['none', 'some', 'most', 'full'].includes(b.key))
      const none = linesWhere(bs, (b) => b.key === 'none')
      const some = linesWhere(bs, (b) => b.key === 'some')
      const words = m === 'surprise' ? HEAT_WORDS : m === 'legible' ? LEGIBLE_WORDS : DOC_WORDS
      const noun = m === 'surprise' ? 'reading' : 'grade'
      if (read > 0) {
        said.push(
          m === 'docs'
            ? `Of the ${n(read)} function lines with graded documentation, ${shareOf(none, read)} were graded *${words.none}* and ${shareOf(some, read)} *${words.some}*, with derivable documentation counted as ${ctx.views.derivable === 'full' ? '*full*' : '*none*'}.`
            : `Of the ${n(read)} function lines with a current ${noun}, ${shareOf(none, read)} were graded *${words.none}* and ${shareOf(some, read)} *${words.some}*.`,
        )
      }
      const expired = linesWhere(bs, (b) => b.key === ' expired')
      const missing = all - read
      if (missing > 0) {
        said.push(
          `No current ${noun} exists for ${shareOf(missing, all)} of function lines${expired > 0 ? `, including ${shareOf(expired, all)} whose reading has expired` : ''}.`,
        )
      }
      const top = lead()
      if (top) said.push(`The largest body graded *${top[1].text}* is ${chip(top[0].text)} (${top[2].text} lines).`)
      break
    }
    case 'traps': {
      const traps = ctx.buckets.find((b) => b.key === 'trap')?.count ?? 0
      const clear = ctx.buckets.find((b) => b.key === 'clear')?.count ?? 0
      const unread = linesWhere(ctx.buckets, isAbsent)
      said.push(
        `Readers reported ${n(traps)} trap${traps === 1 ? '' : 's'} among the ${n(traps + clear)} functions read under the current question.`,
      )
      if (unread > 0) said.push(`No current answer exists for ${shareOf(unread, total)} of function lines.`)
      const top = lead()
      if (top) said.push(`The longest body with a reported trap is ${chip(top[0].text)}.`)
      break
    }
    default:
      break
  }
  return said.length ? [said.join(' ')] : []
}

const shareOf = (x: number, of: number) => {
  if (of <= 0) return '0%'
  const p = (x / of) * 100
  return p > 0 && p < 1 ? 'less than 1%' : `${Math.round(p)}%`
}
const listed = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const isAbsent = (b: Bucket) => b.key.startsWith(' ')
const linesWhere = (bs: Bucket[], pick: (b: Bucket) => boolean) => bs.filter(pick).reduce((t, b) => t + b.lines, 0)
const chip = (s: string) => `\`${s}\``

function complexityStory(ctx: TableContext): string[] {
  const absent = (b: Bucket) => b.key.startsWith(' ')
  const counted = ctx.buckets.filter((b) => !absent(b))
  const total = counted.reduce((t, b) => t + b.lines, 0)
  const uncounted = ctx.buckets.filter(absent).reduce((t, b) => t + b.lines, 0)
  if (total <= 0) return ['No function here is in a language this instrument can count.']
  const pct = (x: number) => {
    const p = (x / total) * 100
    return p > 0 && p < 1 ? 'less than 1%' : `${Math.round(p)}%`
  }
  const inBand = (label: string) => counted.filter((b) => b.label === label).reduce((t, b) => t + b.lines, 0)
  const weighted = ctx.views.tangle !== 'raw'
  const how = weighted ? 'for their size' : 'by raw count'
  const whose = uncounted > 0 ? 'counted function lines' : 'function lines'

  // **Stated, not narrated.** Shares, medians, the extreme and where the top of the ranking falls:
  // what was measured, in the report's register. An earlier draft said short bodies here "barely
  // branch" and named "the densest", which is a story drawn from the numbers rather than the
  // numbers.
  const said: string[] = [
    `Of the ${n(total)} ${whose}, ${pct(inBand('very high'))} lie in bodies rated very high ${how} and ${pct(inBand('low'))} in bodies rated low.`,
  ]
  const top = complexityRanked(ctx, walk(ctx.root))
  const lead = top[0]
  const fnName = (f: Node) => `\`${f.path}#${f.name}\``
  if (weighted) {
    const short = ctx.tangleBands[0]
    const mid = ctx.tangleBands[2]
    if (short != null && mid != null) {
      said.push(
        `The median count is ${n(short)} decision point${short === 1 ? '' : 's'} for bodies of 1–14 lines and ${n(mid)} for bodies of 25–49 lines.`,
      )
    }
    if (lead?.ratio != null) {
      const ties = top.filter((r) => r.ratio === lead.ratio).length - 1
      said.push(
        `The highest ratio to the band median, ${(Math.round(lead.ratio * 10) / 10).toFixed(1)}, is observed in ${fnName(lead.f)} (${n(lead.cog)} decision points in ${n(lead.f.loc)} lines)${ties > 0 ? ` and shared by ${n(ties)} other bod${ties === 1 ? 'y' : 'ies'}` : ''}.`,
      )
    }
  } else if (lead) {
    said.push(`The largest count, ${n(lead.cog)} decision points, is observed in ${fnName(lead.f)} (${n(lead.f.loc)} lines).`)
  }
  const shown = top.slice(0, TOP)
  const byFile = new Map<string, number>()
  for (const r of shown) byFile.set(r.f.path, (byFile.get(r.f.path) ?? 0) + 1)
  const [file, most] = [...byFile.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
  if (most >= 3 && most < COUNT_WORDS.length) {
    said.push(`${COUNT_WORDS[most]} of the ${shown.length === TOP ? 'ten' : n(shown.length)} highest-ranked bodies are in \`${file}\`.`)
  }
  if (uncounted > 0) {
    said.push(`A further ${n(uncounted)} lines are in languages without a branch table and are excluded.`)
  }
  return [said.join(' ')]
}
