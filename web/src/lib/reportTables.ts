import { DOC_WORDS, HEAT_WORDS, LEGIBLE_WORDS, type Grade, type Node } from './api'
import {
  KIND_FILL,
  KIND_ORDER,
  sortBuckets,
  TANGLE_EDGES,
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

function namedNote(w: Walked): string | undefined {
  return w.unnamed > 0
    ? `Names are known for ${n(w.funcs.length)} of the ${n(w.funcs.length + w.unnamed)} functions in the repository; the rows rank those.`
    : undefined
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
    ctx.buckets.filter((b) => b.lines > 0),
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
    caption: `Lines of function bodies by ${what}, with the functions holding them. ${n(total)} lines in all.`,
    columns,
    rows: body,
  }
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
          { label: 'Non-test dependents', weight: 1.6, align: 'right' },
          { label: 'Lines', weight: 0.9, align: 'right' },
        ],
        rows: rows.map((f) => [fn(f), num(f.callers), num(f.dependents), num(f.loc)]),
        note: namedNote(w),
      }
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
        rows: rows.map((f) => [fn(f), num(f.calls), num(f.loc)]),
        note: namedNote(w),
      }
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
        rows: rows.map((f) => [fn(f), num(f.score?.lastTouchedDays), num(f.score?.ageDays), num(f.loc)]),
        note: namedNote(w),
      }
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
        rows: rows.map((f) => [fn(f), num(count(f)), num(f.loc)]),
        note: namedNote(w),
      }
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

function complexity(ctx: TableContext, w: Walked, top: number): Table | null {
  const weighted = ctx.views.tangle !== 'raw'
  const scored = w.funcs.flatMap((f) => {
    const cog = f.score?.cognitive
    if (cog == null || cog <= 0) return []
    const i = TANGLE_EDGES.findIndex((e) => f.loc <= e)
    const median = ctx.tangleBands[i === -1 ? TANGLE_EDGES.length : i] ?? null
    return [{ f, cog, median, ratio: median == null ? null : cog / Math.max(median, 1) }]
  })
  const rows = ranked(
    scored,
    (r) => (weighted ? (r.ratio ?? -1) : r.cog),
    (r) => (weighted ? r.cog : r.f.loc),
  ).slice(0, top)
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
    ]),
    note: namedNote(w),
  }
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
    }),
    note: namedNote(w),
  }
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
      .map((r) => [fn(r.f), { text: words[r.g] }, num(r.f.loc)]),
    note: namedNote(w),
  }
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
      .map((r) => [fn(r.f), { text: r.derivable ? `${DOC_WORDS.none} (derivable)` : DOC_WORDS[r.g] }, num(r.f.loc)]),
    note: namedNote(w),
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
  const notes = [
    rows.length > shown.length ? `${n(rows.length - shown.length)} more traps are not listed.` : '',
    namedNote(w) ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return {
    caption: 'Every trap a reader reported, in the reader’s own words: what breaks, and when.',
    columns: [
      { label: 'Function', weight: 3.2, wrap: true },
      { label: 'What breaks', weight: 5.6, wrap: true },
    ],
    rows: shown.map((f) => [fn(f), { text: f.agent?.note || '—' }]),
    note: notes || undefined,
  }
}
