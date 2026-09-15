/**
 * A repository's report, brief or deck, written without a window.
 *
 * `just render <repo> [report|brief|deck|all]` exports the repository's data with the CLI
 * (`sanity export-data`), then this reads it and writes the PDFs. It builds every input a report
 * takes from the same functions the window uses — `locksFor`, `viewsFor`, `slotsFor`,
 * `reportLenses`, `applyAgentReports` over the complete tree — so the two cannot describe one commit
 * differently, and draws the same figures through `reportMap`.
 *
 * **Figures are cached per content, under the CLI's render slot**, so rendering a report, then a
 * brief, then a deck of one commit draws each map once. The key is the export's own bytes, not
 * the commit: a dirty tree is a different repository at the same sha.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import { applyAgentReports, pruneExcluded, toScan, type AgentReport, type FindingGroup, type RepoHead, type WireScan } from '../src/lib/api'
import { ageSpanOf, legendFor } from '../src/lib/colorMode'
import { locksFor } from '../src/lib/locks'
import { buildReport, FORM, lensPages, type Form, type MapRender, type ReportStats } from '../src/lib/report'
import { READINGS_DEFAULT, reportLenses, slotsFor, viewsFor } from '../src/lib/reportInputs'
import { REPORT_LOOK, reportMap } from '../src/lib/reportMap'
import { onPaper, rootVars } from '../src/lib/vector/color'
import { Face, subsetter } from '../src/lib/vector/fonts'
import { MONO_DEFAULT, monoFaceOf } from '../src/lib/monoFaces'

interface Export {
  version: number
  name: string
  path: string
  remote: string | null
  head: RepoHead | null
  traceDepth: string
  grammars: number
  scan: WireScan
  reports: AgentReport[]
  groups: FindingGroup[]
  summary: {
    functions: number
    files: number
    assessed: number
    stale: number
    banked_model: string | null
    banked_harness: string | null
    banked_models: { model: string; readings: number }[]
    trace_depth: string
  }
  renderCache: string | null
}

/** Bumped when a figure's markup changes shape, so a cached figure from before is not reused. */
const RENDER_VERSION = 2

function args() {
  const out = { data: '', forms: [] as Form[], dir: '.', cache: true, mono: MONO_DEFAULT }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--data') out.data = argv[++i]
    else if (a === '--out') out.dir = argv[++i]
    else if (a === '--no-cache') out.cache = false
    else if (a === '--mono') out.mono = argv[++i]
    else if (a === 'all') out.forms.push('report', 'brief', 'deck')
    else if (a in FORM) out.forms.push(a as Form)
    else throw new Error(`Not an argument this knows: ${a}`)
  }
  if (!out.data) throw new Error('Give the export with --data <file>.')
  if (!out.forms.length) out.forms.push('report')
  return out
}

const opts = args()
const raw = readFileSync(opts.data, 'utf8')
const data = JSON.parse(raw) as Export
const started = performance.now()
const ms = () => `${Math.round(performance.now() - started)}ms`

const scan = toScan(data.scan)
const tree = applyAgentReports(pruneExcluded(scan.root), data.reports)
const locks = locksFor({
  replaying: false,
  tree,
  assessed: data.summary.assessed,
  traceDepth: data.summary.trace_depth,
  tangleBands: scan.stats.tangleBands,
  churned: scan.stats.churned,
})
const views = viewsFor({
  ageSpan: ageSpanOf(tree),
  churnWindows: scan.stats.churnWindows,
  churned: scan.stats.churned,
  ...READINGS_DEFAULT,
})
const pages = lensPages(locks)
const { heroLens, findingsLens } = reportLenses(locks, 'surprise', pages)
const slots = slotsFor(scan.stats.authors)
const stats: ReportStats = {
  lines: tree.loc,
  functions: data.summary.functions,
  files: data.summary.files,
  assessed: data.summary.assessed,
  stale: data.summary.stale,
  unparsed: tree.unparsed ?? null,
  languages: legendFor(tree, 'language'),
  grammars: data.grammars,
  model: data.summary.banked_model,
  harness: data.summary.banked_harness,
  models: data.summary.banked_models,
  tangleBands: scan.stats.tangleBands,
  callsResolved: scan.stats.callsResolved ?? null,
  callsUnresolved: scan.stats.callsUnresolved ?? null,
  commits: scan.stats.commits,
  authors: scan.stats.authors.length,
  churnWindows: [...scan.stats.churnWindows],
  ageSpan: ageSpanOf(tree),
}
console.log(`read ${data.name} (${data.summary.functions.toLocaleString()} functions, depth ${data.traceDepth}) in ${ms()}`)

// The recipe says where `web/` is: the bundle runs from `node_modules/.cache`, two levels down.
const web = process.env.SANITY_WEB ?? resolve(import.meta.dirname ?? '.', '../..')
const fontFile = (file: string) => readFileSync(join(web, 'public/fonts/pdf', file))
// `--mono <id>` sets a candidate from `monoFaces.ts`; the default is the app's.
const monoFace = monoFaceOf(opts.mono)
const monoName = monoFace.label.replace(/[^A-Za-z0-9]/g, '')
const env = {
  fonts: {
    sans: new Face({ key: 'sans', name: 'LINESeedJP-Regular', bytes: fontFile('LINESeedJP-Regular.ttf') }),
    sansBold: new Face({ key: 'sans-bold', name: 'LINESeedJP-Bold', bytes: fontFile('LINESeedJP-Bold.ttf') }),
    mono: new Face({ key: 'mono', name: `${monoName}-Regular`, bytes: readFileSync(join(web, 'public/fonts/mono', `${monoFace.id}-400.ttf`)) }),
    monoBold: new Face({ key: 'mono-bold', name: `${monoName}-Bold`, bytes: readFileSync(join(web, 'public/fonts/mono', `${monoFace.id}-700.ttf`)) }),
  },
  vars: rootVars(readFileSync(join(web, 'src/index.css'), 'utf8')),
  subset: await subsetter(readFileSync(join(web, 'node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm'))),
  deflate: async (b: Uint8Array) => new Uint8Array(deflateSync(b)),
}

const draw = reportMap({ tree, views, slotsFor: slots, look: REPORT_LOOK, fonts: env.fonts, vars: onPaper(env.vars) })
const content = createHash('sha256').update(String(RENDER_VERSION)).update(raw).update(JSON.stringify(REPORT_LOOK)).digest('hex').slice(0, 20)
const cacheDir = opts.cache && data.renderCache ? data.renderCache : null
if (cacheDir) {
  mkdirSync(cacheDir, { recursive: true })
  // A read is a use: without this, a cache only ever read ages into the other builds' sweep.
  const now = new Date()
  utimesSync(cacheDir, now, now)
}
let drawn = 0
let reused = 0
const map = (req: { mode: string; px: number; root: string }): MapRender => {
  const file = cacheDir
    ? join(cacheDir, `${createHash('sha256').update(`${content}|${req.mode}|${req.px}|${req.root}|${JSON.stringify(views)}`).digest('hex').slice(0, 32)}.json`)
    : null
  if (file) {
    try {
      const hit = JSON.parse(readFileSync(file, 'utf8')) as { markup: string; viewBox: MapRender['viewBox']; spots: [string, MapRender['spots'] extends Map<string, infer V> ? V : never][] }
      reused += 1
      return { markup: hit.markup, viewBox: hit.viewBox, spots: new Map(hit.spots) }
    } catch {
      /* not cached yet */
    }
  }
  const made = draw(req as Parameters<typeof draw>[0])
  drawn += 1
  if (file) writeFileSync(file, JSON.stringify({ markup: made.markup, viewBox: made.viewBox, spots: [...made.spots] }))
  return made
}

mkdirSync(opts.dir, { recursive: true })
for (const form of opts.forms) {
  const bytes = await buildReport({
    slug: data.remote ?? data.name,
    head: data.head,
    form,
    locks,
    views,
    findingsLens,
    heroLens,
    groups: data.groups,
    tree,
    slotsFor: slots,
    stats,
    map,
    env,
    cancelled: () => false,
    onProgress: () => {},
  })
  const stem = (data.name || 'sanity').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const out = join(opts.dir, `${stem}-${FORM[form].noun}.pdf`)
  writeFileSync(out, bytes)
  console.log(`${form}: ${out} (${(bytes.length / 1024).toFixed(0)} KB) at ${ms()}`)
}
console.log(`figures: ${drawn} drawn, ${reused} from the cache${cacheDir ? ` in ${cacheDir}` : ''}`)
// **Exits when it is done**, once what it printed has reached the pipe. Something the render path
// loads keeps Node's event loop open with nothing left to do, so the process sat idle after writing
// its files and `just render` never returned.
process.stdout.write('', () => process.exit(0))
