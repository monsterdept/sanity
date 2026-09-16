/**
 * What a map drawn without a window is allowed to be.
 *
 * A report is moving to a renderer that draws the map's SVG with no window at all —
 * `mapMarkup`, through `react-dom/server` — and translates it to vector PDF. Every way that can
 * go wrong is quiet: a viewBox left at the element's initial value crops the picture to a
 * corner, a mark placed from a spot the markup does not have points at nothing, and a label
 * measured against a canvas that is not there lays out against a guess. None of it throws and
 * all of it looks like a map.
 *
 * So the rules are pinned here, on a small synthetic tree: functions, a few readings (one of
 * them expired), a file opened as the root. No repo, no window, no framework — one bundle of one
 * file, the shape `rim-check` and `identity-check` take.
 *
 * Set `MAP_OUT` to a directory and each picture is written there as a standalone `.svg`, with
 * the light theme's tokens inlined so it can be looked at.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readInto, type AgentReport, type Node, type Score } from '../src/lib/api'
import { rankCategories, type ColorMode } from '../src/lib/colorMode'
import { sectorOf, type Sector } from '../src/lib/fan'

/** `mapMarkup`'s return, restated. */
interface Spot {
  d: string
  a0: number
  a1: number
  r0: number
  r1: number
}
interface MapMarkup {
  markup: string
  viewBox: [number, number, number, number]
  spots: Map<string, Spot>
}

/**
 * **Required, not imported.** `mapMarkup` reaches `MapArt.tsx`, and this project's tsconfig has
 * no JSX: an `import` would pull every component into the scripts' type-check and fail it
 * there. esbuild bundles a literal `require` exactly as it bundles an import, and the app's own
 * tsconfig checks the module.
 */
// **And `React` is put where the components will look for it.** Run the way `just` runs every
// check — `esbuild` with no JSX flag, from a directory whose tsconfig names no JSX mode — a `.tsx`
// compiles to `React.createElement` against a free `React`, which the app's own build (the
// automatic runtime) never needs and so never imports. The bundle's `require` is lazy, so this
// lands before the first component module runs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
;(globalThis as { React?: unknown }).React = require('react')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { mapMarkup } = require('../src/lib/mapMarkup') as {
  mapMarkup: (props: Record<string, unknown>) => MapMarkup
}

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) {
    console.log(`  ok   ${what}`)
    return
  }
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/* ── The tree ─────────────────────────────────────────────────────────── */

const score = (over: Partial<Score> = {}): Score => ({
  surprise: 0.5,
  documented: 0.5,
  churn: [0, 0, 0, 0],
  ageDays: 40,
  lastTouchedDays: 12,
  commits: [1, 1, 2, 3],
  allCommits: null,
  provenance: 'human',
  tangle: [0.3, 0.3],
  cognitive: 3,
  hotShare: 0,
  source: 'proxy',
  analyzedShare: 0,
  ...over,
})

/** Every field `Node` declares, so nothing downstream meets an `undefined` a real tree would
 *  never hand it. */
const base = (id: string, name: string, kind: Node['kind'], path: string, loc: number): Node => ({
  id,
  name,
  kind,
  path,
  loc,
  line: kind === 'func' ? 1 : null,
  endLine: kind === 'func' ? loc : null,
  lang: null,
  excluded: false,
  bytes: kind === 'dir' ? null : loc * 30,
  lastAuthor: null,
  mainAuthor: null,
  headcount: null,
  doc: null,
  signature: null,
  owner: null,
  score: score(),
  body: null,
  hotspots: [],
  callers: null,
  dependents: null,
  underTest: null,
  codeKind: null,
  tested: null,
  calls: null,
  incident: null,
  away: null,
  resolvable: null,
  orphans: null,
  sinks: null,
  cloneGroup: null,
  cloneSize: null,
  comparable: null,
  copied: null,
  funcs: 0,
  children: [],
})

let seed = 7
/** Deterministic, so every run draws the same picture. */
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return seed / 2147483647
}

const LANG: Record<string, string> = { rs: 'Rust', ts: 'TypeScript', py: 'Python' }

function func(path: string, name: string, loc: number): Node {
  const callers = Math.floor(rand() * 6) - 1
  const cloned = rand() < 0.15
  return {
    ...base(`${path}#${name}`, name, 'func', path, loc),
    lang: LANG[path.slice(path.lastIndexOf('.') + 1)] ?? null,
    body: `${path}#${name}-body`,
    score: score({ surprise: rand(), tangle: [rand(), rand()] }),
    callers: Math.max(0, callers),
    calls: Math.floor(rand() * 4),
    resolvable: 1,
    orphans: callers <= 0 ? 1 : 0,
    sinks: 0,
    comparable: 1,
    cloneGroup: cloned ? 1 : null,
    cloneSize: cloned ? 3 : null,
    copied: cloned ? 1 : 0,
  }
}

/** Sums a container's roll-ups off its children, the way Rust does before the window sees it. */
function contain(n: Node, kids: Node[]): Node {
  const sum = (f: (k: Node) => number | null) => kids.reduce((t, k) => t + (f(k) ?? 0), 0)
  const loc = sum((k) => k.loc)
  const read = kids.filter((k) => k.score?.source === 'agent' || (k.score?.analyzedShare ?? 0) > 0)
  return {
    ...n,
    loc,
    children: kids,
    lang: n.kind === 'file' ? kids[0]?.lang ?? null : null,
    lastAuthor: n.kind === 'file' ? (rand() < 0.5 ? 'Ada' : 'Grace') : null,
    resolvable: sum((k) => k.resolvable),
    orphans: sum((k) => k.orphans),
    comparable: sum((k) => k.comparable),
    copied: sum((k) => k.copied),
    score: score({
      hotShare: read.length > 0 ? 0.4 : 0,
      analyzedShare: read.length / Math.max(1, kids.length),
    }),
  }
}

function file(path: string, fns: [string, number][]): Node {
  const kids = fns.map(([name, loc]) => func(path, name, loc))
  return contain(base(path, path.slice(path.lastIndexOf('/') + 1), 'file', path, 0), kids)
}

function dir(path: string, kids: Node[]): Node {
  return contain(base(path, path === '' ? 'fixture' : path.slice(path.lastIndexOf('/') + 1), 'dir', path, 0), kids)
}

const reading = (id: string, body: string, over: Partial<AgentReport> = {}): AgentReport =>
  ({
    id,
    loc: 20,
    expected: 'a',
    found: 'b',
    surprised: true,
    predicted: 'none',
    documented: 'some',
    legible: 'most',
    note: '',
    cold: false,
    body,
    at: '2026-09-09T10:00:00Z',
    ...over,
  }) as unknown as AgentReport

/** Fold readings into the functions they name, rebuilding the spine above them. */
function withReadings(n: Node, byId: Map<string, AgentReport>): Node {
  if (n.kind === 'func') return byId.has(n.id) ? readInto(n, byId.get(n.id)) : n
  const kids = n.children.map((k) => withReadings(k, byId))
  return kids.every((k, i) => k === n.children[i]) ? n : contain(n, kids)
}

const names = (k: number, stem: string): [string, number][] =>
  Array.from({ length: k }, (_, i) => [`${stem}_${i}`, 20 + Math.floor(rand() * 180)])

const plain = dir('', [
  dir('src', [
    file('src/main.rs', names(7, 'handle')),
    file('src/parse.rs', names(9, 'parse')),
    dir('src/lens', [file('src/lens/color.rs', names(6, 'paint')), file('src/lens/rim.rs', names(4, 'band'))]),
  ]),
  dir('web', [
    file('web/app.ts', names(8, 'render')),
    file('web/api.ts', names(5, 'fetch')),
    file('web/tiny.ts', [['only', 12]]),
  ]),
  dir('tools', [file('tools/gen.py', names(6, 'emit'))]),
])

const tree = withReadings(
  plain,
  new Map([
    ['src/main.rs#handle_0', reading('src/main.rs#handle_0', 'src/main.rs#handle_0-body')],
    ['src/main.rs#handle_1', reading('src/main.rs#handle_1', 'src/main.rs#handle_1-body', { predicted: 'full' })],
    ['src/parse.rs#parse_2', reading('src/parse.rs#parse_2', 'src/parse.rs#parse_2-body', { trap: true })],
    // Expired: read against a body that has since moved, so it draws hatched.
    ['web/app.ts#render_0', reading('web/app.ts#render_0', 'an-older-body', { predicted: 'some' })],
  ]),
)

/* ── What the picture is drawn with ───────────────────────────────────── */

/** Proportional to length and nothing else: a check wants the same layout on every machine,
 *  not the right one for a face. Counted, so the check can tell it was the one asked. */
let measured = 0
const measure = (text: string) => {
  measured += 1
  return text.length * 0.55
}

/** A fixed light theme, for the tokens a label's ink or the hub's circles are picked against. */
const INK: Record<string, string> = {
  '--background': '#f5f1ea',
  '--foreground': '#1a1a1a',
  '--structure': '#d0c9bd',
  '--unanalyzed': '#b3aca3',
  '--clone': '#ad2cff',
  '--trap': '#ff4f95',
  ...Object.fromEntries(
    ['heat', 'legible', 'churn', 'age', 'docs', 'reach', 'callers', 'tangle'].flatMap((ramp) =>
      ['#2a2118', '#634f35', '#a9803f', '#e0b04a', '#fff1b8'].map((hex, i) => [`--${ramp}-${i}`, hex]),
    ),
  ),
  ...Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`--cat-${i}`, i % 2 ? '#3987e5' : '#e5a139'])),
}
const PAPER = '#f5f1ea'
const INKED = '#1a1a1a'

const DEFAULT_BOX = [-360, -360, 720, 720]

const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

/** The tags in the markup that carry `data-node`, with their `data-arc` and `d`. */
function tagged(markup: string): Array<{ id: string; arc: string | null; d: string | null }> {
  const out: Array<{ id: string; arc: string | null; d: string | null }> = []
  for (const tag of markup.match(/<path\b[^>]*\bdata-node="[^"]*"[^>]*>/g) ?? []) {
    const attr = (name: string) => {
      const hit = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
      return hit ? unescape(hit[1]) : null
    }
    out.push({ id: attr('data-node')!, arc: attr('data-arc'), d: attr('d') })
  }
  return out
}

/** Whether the box holds the outer edge of an arc: its corners and every quarter turn inside. */
function holds(box: [number, number, number, number], s: Spot): boolean {
  const [x, y, w, h] = box
  const eps = 1e-6
  const angles = [s.a0, s.a1]
  for (let a = Math.ceil(s.a0 / (Math.PI / 2)) * (Math.PI / 2); a <= s.a1; a += Math.PI / 2) angles.push(a)
  return angles.every((a) => {
    const px = s.r1 * Math.sin(a)
    const py = -s.r1 * Math.cos(a)
    return px >= x - eps && px <= x + w + eps && py >= y - eps && py <= y + h + eps
  })
}

/** The light theme's own tokens, for a written picture a person can open. Best effort: the check
 *  does not depend on it. */
function themeStyle(): string {
  const css = join(process.cwd(), 'src', 'index.css')
  if (!existsSync(css)) return ''
  const text = readFileSync(css, 'utf8')
  // The palette is declared per theme, on `.light` and `.dark`; the first `:root`-ish block in
  // the file is Tailwind's aliases, which name the tokens without giving them a value.
  const start = text.indexOf('\n.light {')
  if (start < 0) return ''
  const block = text.slice(start, text.indexOf('\n}', start))
  const decls = block.match(/--[\w-]+:\s*[^;]+;/g) ?? []
  return `<style>svg{${decls.join('')}}</style>`
}

const out = process.env.MAP_OUT
if (out) mkdirSync(out, { recursive: true })
const style = out ? themeStyle() : ''

function write(name: string, r: MapMarkup) {
  if (!out) return
  const svg = r.markup.replace(
    /^<svg\b/,
    `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"`,
  )
  writeFileSync(join(out, `${name}.svg`), svg.replace(/^(<svg\b[^>]*>)/, `$1${style}`))
}

/* ── The pictures ─────────────────────────────────────────────────────── */

const find = (n: Node, path: string): Node | null => {
  if (n.path === path) return n
  for (const c of n.children) {
    const hit = find(c, path)
    if (hit) return hit
  }
  return null
}

interface Case {
  name: string
  mode: ColorMode
  root?: Node
  extra?: Record<string, unknown>
  /** A file opened as the root: its cells, not a ring. */
  cells?: boolean
}

const openFile = find(tree, 'src/parse.rs')!
const from: Sector = sectorOf(0.4, 0.9, 180, 260)

const cases: Case[] = [
  { name: 'surprise', mode: 'surprise' },
  { name: 'language', mode: 'language', extra: { ranks: rankCategories(tree, 'language') } },
  { name: 'callers', mode: 'callers' },
  { name: 'clones', mode: 'clones' },
  { name: 'traps', mode: 'traps' },
  { name: 'selected', mode: 'surprise', extra: { selected: find(tree, 'src/main.rs#handle_1') } },
  { name: 'file-root', mode: 'surprise', root: openFile, cells: true },
  { name: 'file-root-from-wedge', mode: 'surprise', root: openFile, cells: true, extra: { fileFrom: from, aspect: 1.6 } },
]

for (const c of cases) {
  console.log(`${c.name}`)
  const root = c.root ?? tree
  measured = 0
  let r: MapMarkup
  try {
    r = mapMarkup({ root, mode: c.mode, px: 1000, tagNodes: true, measure, ink: INK, ...c.extra })
  } catch (err) {
    check('renders', false, String(err))
    continue
  }
  check('renders', true)
  write(c.name, r)

  const { markup, viewBox, spots } = r
  check('is one map element', markup.startsWith('<svg data-sunburst=""') && markup.endsWith('</svg>'))
  check(
    'the viewBox is the computed one, not the initial default',
    viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox.some((v, i) => v !== DEFAULT_BOX[i]),
    viewBox,
  )
  check(
    'and the markup carries the same numbers',
    markup.includes(`viewBox="${viewBox.join(' ')}"`),
    /viewBox="([^"]*)"/.exec(markup)?.[1],
  )
  check('nothing prints as NaN', !markup.includes('NaN'))
  check('nothing prints as undefined', !markup.includes('undefined'))

  const tags = tagged(markup)
  check('every tagged wedge is a spot', spots.size === tags.length, [spots.size, tags.length])
  const missing = tags.filter((t) => !spots.has(t.id)).map((t) => t.id)
  check('by the same ids', missing.length === 0, missing.slice(0, 5))
  const ids = new Set(tags.map((t) => t.id))
  check('no id is tagged twice', ids.size === tags.length, tags.length - ids.size)
  const arcOff = tags.filter((t) => {
    const s = spots.get(t.id)
    return !s || t.arc !== `${s.a0} ${s.a1} ${s.r0} ${s.r1}` || t.d !== s.d
  })
  check('with the arc and the path the markup drew', arcOff.length === 0, arcOff.slice(0, 2))
  const outside = [...spots].filter(([, s]) => !holds(viewBox, s)).map(([id]) => id)
  check("the box holds every spot's outer edge", outside.length === 0, outside.slice(0, 5))

  if (c.cells) {
    check('a file root draws its cells', spots.size > 0 && tags.length === root.children.length, [
      spots.size,
      root.children.length,
    ])
    check('and no ring', !tags.some((t) => !t.id.includes('#')))
  } else {
    check('the ring draws its function patches', tags.some((t) => t.id.includes('#')))
  }

  const labels = (markup.match(/<text\b/g) ?? []).length
  check('names are drawn', labels > 0, labels)
  check('with the measurer it was handed', measured > 0, measured)
  if (c.mode === 'surprise') {
    const fills = new Set([...markup.matchAll(/<text\b[^>]*\bfill="([^"]*)"/g)].map((m) => m[1]))
    check(
      'a name on a read patch takes its ink from the table, not the document',
      fills.has(PAPER) || fills.has(INKED),
      [...fills],
    )
  }
  check('the hub draws its circles', (markup.match(/<circle\b/g) ?? []).length >= 3)
  if (c.extra?.selected) check('the selection veils the rest', markup.includes('fill-rule="evenodd"'))
  if (c.name === 'surprise') check('an expired reading is hatched', markup.includes('url(#stale-hatch)'))
  if (c.name === 'clones') check('a clone is marked on its directory', markup.includes('var(--clone)'))
  console.log(`  —    ${spots.size} spots, ${labels} names, viewBox ${viewBox.map((v) => +v.toFixed(1)).join(' ')}`)
}

if (out) console.log(`\nwrote ${cases.length} pictures to ${out}`)
console.log(failed === 0 ? 'map-check: ok' : `map-check: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
