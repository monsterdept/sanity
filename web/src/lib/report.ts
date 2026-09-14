import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Locked } from '../components/ColorKey'
import { dirOf, fileOf, lensColor, lensName, nameOf } from '../components/Findings'
import { Wordmark } from '../components/Wordmark'
import type { FindingGroup, Node, RepoHead } from './api'
import {
  FAMILIES,
  MODE_LABEL,
  paintsFromReadings,
  TANGLE_EDGES,
  type Bucket,
  type ColorMode,
  type Views,
} from './colorMode'
import {
  blockedByNeed,
  groupFindings,
  introductions,
  mergeFindings,
  rowsCapped,
  setAsideCount,
  type FindingItem,
} from './findings'
import { FAMILY } from './labelStyle'
import type { LensKey } from './lensKey'
import { mascotClock } from './mascotClock'
import {
  CANCELLED,
  drawCreature,
  faceCss,
  flatKey,
  ink,
  paint,
  rastered,
  settle,
  varCss,
  within,
  type FlatKey,
  type Staged,
} from './movie'
import { writePdf, type PdfPage } from './pdf'
import { ESSAYS, METHODOLOGY, type Prose } from './reportProse'
import { FULL_CAST, tablesFor, TOP, TRAPS_MAX, type Table, type TableLimits } from './reportTables'

/**
 * The project's analysis as a PDF, written to stand on its own as a document.
 *
 * **Laid out like a paper, because it has to be read by somebody who has never seen the app.**
 * A cover with the wordmark, an abstract and a methods section; a contents page; one section per
 * lens, each an essay in two columns with the map as a numbered figure in the first; and the
 * findings — an overview, then each group of findings on a map zoomed to where they are. The
 * prose is `reportProse.ts`, written for this and not borrowed from the in-app reference.
 *
 * **Every page is a picture, drawn on a canvas.** A vector PDF would set names in the one face the
 * app ships, a Latin subset, and a CJK author prints as boxes; HTML through the print sheet
 * paginates through a WebKit path nothing here exercises. A canvas has the system's fallback
 * fonts and rasterizes the map through the path the movie proves. The text is pixels, and that is
 * stated rather than hidden.
 *
 * **The map is the map on screen, copied — never a second renderer.** Each figure stages the pane
 * (a lens, a density, a root) and rasterizes the live SVG. What this file draws itself is
 * furniture: type, keys, the grey wash and the marks, which are cut from the drawn paths' own
 * geometry (`data-node`) rather than recomputed from the layout.
 *
 * **Everything is laid out before anything is drawn.** Footers say `n / total`, the contents page
 * names pages, and both need every page counted — so the text is set and poured into its columns,
 * the findings grouped and paginated, and only then is each figure staged and drawn. Nothing in a
 * layout depends on what a staged map turned out to hold.
 */

export type Paper = 'letter' | 'a4'

/** The paper, in points. */
export const PAPER: Record<Paper, { w: number; h: number; label: string }> = {
  letter: { w: 612, h: 792, label: 'Letter' },
  a4: { w: 595.28, h: 841.89, label: 'A4' },
}

/**
 * The three shapes the analysis is exported in.
 *
 * - **Report**, the paper: methodology, contents, every essay whole with its tables, and every
 *   group of findings on its own map.
 * - **Brief**: a cover, one page per lens holding its map and two sections of its essay
 *   (`SHORT_SECTIONS`), and the findings on one map with the grid of what raised them.
 * - **Deck**: the brief's content as 16:9 slides, the map beside the words, plus a slide for each
 *   group of findings.
 */
export type Form = 'report' | 'brief' | 'deck'

export const FORM: Record<Form, { label: string; noun: string }> = {
  report: { label: 'Report', noun: 'report' },
  brief: { label: 'Brief', noun: 'brief' },
  deck: { label: 'Deck', noun: 'deck' },
}

/** A deck's page, in points: 13.33 × 7.5 in, the 16:9 slide Keynote, PowerPoint and Slides open
 *  at. The paper choice does not apply to it. */
const DECK_PAGE = { w: 960, h: 540 }

/** The sections of a lens essay a brief and a deck keep: what the lens is, and how to read its
 *  map. Instrument, Interpretation and Limitations are the report's. */
const SHORT_SECTIONS = ['Definition', 'Reading the map']

/** Print resolution. At 240 a function patch is still a patch and 8pt type is crisp; 300 made
 *  an eighteen-page report 16MB. */
const DPI = 240
/** Canvas pixels per point. */
const U = DPI / 72
/** Outside margin, in points. */
const MARGIN = 42
/** JPEG quality for a page. */
const QUALITY = 0.85
/** How long the map has to have been still before a figure is copied from it — see `rest`. */
const QUIET_MS = 400
/** How long to wait for it at all. Past this the figure is copied from whatever is drawn. */
const REST_LIMIT = 30_000
/** A map label that would print smaller than this is left off the copy — see `pruneLabels`. */
const MIN_LABEL_PT = 4.5
/** Light pages are white paper — see `ReportDialog`'s ground. */
const PAPER_WHITE = '#ffffff'
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'
/** Between the two columns of a text page. */
const GUTTER = 18 * U
/** Where the body starts under a page header: eyebrow, title, rule, air.
 *
 *  **No subtitle.** Each head carried a line under its title — the lens's one-line hint, a
 *  sentence about the findings — which is the switcher's tooltip set in type, and on a page that
 *  opens onto a figure and an essay it said less than either. What a figure is drawn at goes in
 *  its caption, where a figure's facts belong. */
const HEADER_BOTTOM = (MARGIN + 8 + 25 + 10 + 14) * U
/** Where the body starts under a continuation header. */
const CONTINUED_TOP = (MARGIN + 8 + 25 + 9 + 14) * U
/** An essay's body size. One size: the map takes the width, so an essay always runs onto the
 *  next page, and shrinking its type bought nothing but smaller type. */
const BODY = 9
/** The share of a lens page's body the figure takes — map, caption and key. The essay gets the
 *  rest, and continues on the next page. */
const FIGURE_SHARE = 0.66
/** The most pages a lens section may take: its figure page and one more. */
const MAX_LENS_PAGES = 2

const lead = (size: number) => size * 1.45 * U

/** A brief's figure shrinks to make room for its words, and no further than this share of the
 *  text width. Past it, paragraphs go from the end — see `trimToFit`. */
const BRIEF_FIGURE_MIN = 0.45
/** A deck's text: one size for every slide, the largest in this range they all fit at. A slide is
 *  read from across a room, so the floor is well above the report's `BODY`. */
const DECK_TEXT = { max: 20, min: 11, step: 0.5 }
/** Between a deck slide's map and its words. */
const DECK_GAP = 28 * U
/** How many lines a deck's findings caption may run to under its map, and the room kept for them.
 *  Fixed, for the report's reason: what a caption says is known only after its map is staged. */
const DECK_CAP_LINES = 5
const DECK_CAP_H = DECK_CAP_LINES * lead(7.5) + 8 * U

export interface ReportTick {
  /** Pages finished. */
  done: number
  /** Pages there will be, once known; 0 before the report is laid out. */
  total: number
  /** What is being drawn, in the words the dialog prints. */
  what: string
}

/** The numbers the methodology states about this repository. */
export interface ReportStats {
  /** Lines of function bodies — the map's own width. */
  lines: number
  functions: number
  files: number
  /** Current readings, stale excluded — `ProjectSummary::assessed`. */
  assessed: number
  stale: number
  /** Files no parser could read, or null where the backend did not say. */
  unparsed: number | null
  /** Languages present, largest first. */
  languages: string[]
  /** Grammars in this build, or null before the list arrived. */
  grammars: number | null
  /** The model every banked reading agrees on, or null. */
  model: string | null
  harness: string | null
  /** Readings per model, which says whether the corpus is on one scale. */
  models: { model: string; readings: number }[]
  /** Complexity's median count per size band (`TANGLE_EDGES`), null where a band is empty. */
  tangleBands: (number | null)[]
  /** Call sites that reached a definition here and ones that did not — null from an older scan. */
  callsResolved: number | null
  callsUnresolved: number | null
  commits: number
  /** People who have committed, as ranked — capped at what the palette holds. */
  authors: number
  /** The churn windows this repo offers, in days. */
  churnWindows: number[]
  /** Days since the oldest surviving line — Age's span — or null with no tree. */
  ageSpan: number | null
}

/** One band of a lens over the whole repo, as the panel's breakdown lists it — with its function
 *  nodes, which the examples tables rank. */
export type ReportBucket = Bucket

export interface Report {
  /** The repo as the world knows it — `owner/name` where there is a remote. */
  slug: string
  /** The commit the working tree is at, or null where git would not say. */
  head: RepoHead | null
  paper: Paper
  /** Which of the three shapes to write — see `Form`. */
  form: Form
  /** Why each lens that cannot paint is locked — `App`'s `locks`. */
  locks: Partial<Record<ColorMode, Locked>>
  /** How the lenses are set — each page says which reading its figure is. */
  views: Views
  /** Which lens the findings maps are drawn in. */
  findingsLens: ColorMode
  groups: FindingGroup[]
  /** The key for a lens over what is staged — `App`'s `keyFor`. */
  keyFor: (mode: ColorMode) => LensKey | null
  /** Stale and unread counts over the whole repo, for the lenses painted from readings. */
  pending: () => { stale: number; unread: number }
  /** A lens's bands over what is staged — `bucketsFor`, which a file answers for when its
   *  functions were never sent, so the numbers are the whole repo's on a slimmed tree too. */
  bucketsFor: (mode: ColorMode) => ReportBucket[]
  /** The tree staged for the report, read when a table asks — see `reportTables.ts`. */
  treeNow: () => Node | null
  stats: ReportStats
  /** Dress the pane — see `Staged`. Always handed null again before this returns. */
  stage: (s: Staged | null) => void
  /** True when no function rings are in flight — see `rest`. */
  settled: () => boolean
  cancelled: () => boolean
  onProgress: (t: ReportTick) => void
}

/** Every lens this report will give a page, in the menu's order. */
export function lensPages(locks: Partial<Record<ColorMode, Locked>>): ColorMode[] {
  return (Object.keys(MODE_LABEL) as ColorMode[]).filter((m) => !locks[m])
}

/** Which reading a lens's figure is, in the words its control uses — or nothing, for a lens with
 *  one reading. On screen the switch sits beside the map; on paper the map is all there is. */
export function settingOf(mode: ColorMode, views: Views): string {
  switch (mode) {
    case 'age':
      return views.age.read === 'oldest' ? 'by oldest line' : 'by newest line'
    case 'blame':
      return views.blame === 'lines' ? 'by most lines' : 'by newest line'
    case 'tangle':
      return views.tangle === 'raw' ? 'raw count' : 'for its size'
    case 'churn': {
      const d = views.churn.windows[views.churn.at]
      return d === undefined ? '' : `over ${d === 1 ? '1 day' : `${d} days`}`
    }
    case 'docs':
      return views.derivable === 'full' ? 'derivable docs as full' : 'derivable docs as none'
    default:
      return ''
  }
}

/* ── Text ─────────────────────────────────────────────────────────────── */

interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  mono?: boolean
  muted?: boolean
  color?: string
}

interface Placed {
  text: string
  x: number
  w: number
  run: Run
  /** Air before the glyphs — the inside of a code span's left edge. */
  padL: number
}

interface Line {
  items: Placed[]
  w: number
}

interface Inks {
  bg: string
  fg: string
  muted: string
  border: string
  secondary: string
  accent: string
}

function fontOf(run: Run, size: number): string {
  const face = run.code || run.mono ? MONO : FAMILY
  return `${run.italic ? 'italic ' : ''}${run.bold ? 700 : 400} ${size * U}px ${face}`
}

/** Runs set into lines no wider than `width` pixels.
 *
 *  Greedy, which is what a paragraph wants; a word wider than a whole line (a long path) is
 *  broken by character rather than allowed to run off the page. A code span is padded at its two
 *  ends and nowhere else — padding every word of it spaced `DO NOT EDIT` as `DO  NOT  EDIT`. */
function setLines(c: CanvasRenderingContext2D, runs: Run[], width: number, size: number): Line[] {
  const pad = size * 0.3 * U
  type Tok = { text: string; run: Run; space: boolean; lead: boolean; tail: boolean }
  const toks: Tok[] = []
  for (const run of runs) {
    const parts = run.text.split(/(\s+)/).filter(Boolean)
    const words = parts.flatMap((p, i) => (/^\s+$/.test(p) ? [] : [i]))
    parts.forEach((p, i) => {
      const space = /^\s+$/.test(p)
      toks.push({
        text: space ? ' ' : p,
        run,
        space,
        lead: !!run.code && i === words[0],
        tail: !!run.code && i === words[words.length - 1],
      })
    })
  }

  const lines: Line[] = []
  let cur: Line = { items: [], w: 0 }
  let space: Run | null = null
  const push = () => {
    if (cur.items.length) lines.push(cur)
    cur = { items: [], w: 0 }
    space = null
  }
  for (const t of toks) {
    if (t.space) {
      if (cur.items.length) space = t.run
      continue
    }
    c.font = fontOf(t.run, size)
    let left = t.lead ? pad : 0
    const right = t.tail ? pad : 0
    let word = t.text
    let ww = c.measureText(word).width + left + right
    let sw = 0
    if (space) {
      c.font = fontOf(space, size)
      sw = c.measureText(' ').width
      c.font = fontOf(t.run, size)
    }
    if (cur.items.length && cur.w + sw + ww > width) {
      push()
      sw = 0
    }
    while (!cur.items.length && ww > width && word.length > 1) {
      let n = word.length - 1
      while (n > 1 && c.measureText(word.slice(0, n)).width + left > width) n -= 1
      const head = word.slice(0, n)
      cur.items.push({ text: head, x: 0, w: c.measureText(head).width + left, run: t.run, padL: left })
      cur.w = cur.items[0].w
      push()
      word = word.slice(n)
      left = 0
      ww = c.measureText(word).width + right
    }
    if (space && cur.items.length) {
      cur.items.push({ text: ' ', x: cur.w, w: sw, run: space, padL: 0 })
      cur.w += sw
    }
    space = null
    cur.items.push({ text: word, x: cur.w, w: ww, run: t.run, padL: left })
    cur.w += ww
  }
  push()
  return lines
}

function drawLine(
  c: CanvasRenderingContext2D,
  line: Line,
  x: number,
  baseline: number,
  size: number,
  inks: Inks,
) {
  c.textBaseline = 'alphabetic'
  c.textAlign = 'left'
  for (const it of line.items) {
    if (it.run.code) {
      c.fillStyle = inks.secondary
      c.fillRect(x + it.x, baseline - size * 0.82 * U, it.w, size * 1.08 * U)
    }
    c.font = fontOf(it.run, size)
    c.fillStyle = it.run.color ?? (it.run.muted ? inks.muted : inks.fg)
    c.fillText(it.text, x + it.x + it.padL, baseline)
  }
}

/* ── Prose: blocks, rows, columns ─────────────────────────────────────── */

type Block = { kind: 'p' | 'li' | 'h'; runs: Run[]; label?: string }

/** `*italic*`, `**bold**` and `` `code` `` out of a string — the whole of `reportProse`'s markup. */
function inlineRuns(s: string, base: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = []
  for (const part of s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)) {
    if (!part) continue
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out.push({ ...base, text: part.slice(1, -1), code: true })
    } else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      out.push({ ...base, text: part.slice(2, -2), bold: true })
    } else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      out.push({ ...base, text: part.slice(1, -1), italic: true })
    } else out.push({ ...base, text: part })
  }
  return out
}

function fillSlots(s: string, vars: Record<string, string>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

function proseBlocks(sections: Prose[], vars: Record<string, string> = {}): Block[] {
  const out: Block[] = []
  for (const sec of sections) {
    out.push({ kind: 'h', runs: [{ text: fillSlots(sec.heading, vars), bold: true }] })
    for (const raw of sec.body) {
      // A fact the repo cannot supply fills as nothing, and takes its sentence with it; a
      // paragraph that was only a fact is dropped rather than left as an empty gap.
      const s = fillSlots(raw, vars).replace(/[ \t]{2,}/g, ' ').trim()
      if (!s) continue
      const bullet = /^- ([\s\S]*)$/.exec(s)
      const numbered = /^(\d+)\. ([\s\S]*)$/.exec(s)
      if (bullet) out.push({ kind: 'li', runs: inlineRuns(bullet[1]), label: '•' })
      else if (numbered) out.push({ kind: 'li', runs: inlineRuns(numbered[2]), label: `${numbered[1]}.` })
      else out.push({ kind: 'p', runs: inlineRuns(s) })
    }
  }
  return out
}

/** One set line, placed in a column. `gap` is space ABOVE it — how a paragraph break is spelled
 *  in a flow, and dropped where the line starts a column. */
interface Row {
  line: Line
  indent: number
  lead: number
  size: number
  gap: number
  label?: string
  /** A heading: never the last line of a column. */
  keep: boolean
}

function flow(c: CanvasRenderingContext2D, blocks: Block[], width: number, size: number): Row[] {
  const rows: Row[] = []
  blocks.forEach((b, i) => {
    const s = b.kind === 'h' ? size + 0.5 : size
    const indent = b.kind === 'li' ? 12 * U : 0
    const prev = blocks[i - 1]
    const gap = !prev
      ? 0
      : b.kind === 'h'
        ? size * 1.0 * U
        : prev.kind === 'h'
          ? size * 0.2 * U
          : b.kind === 'li' && prev.kind === 'li'
            ? size * 0.25 * U
            : size * 0.55 * U
    setLines(c, b.runs, width - indent, s).forEach((line, k) => {
      rows.push({
        line,
        indent,
        lead: lead(s),
        size: s,
        gap: k === 0 ? gap : 0,
        label: k === 0 ? b.label : undefined,
        keep: b.kind === 'h',
      })
    })
  })
  return rows
}

function drawRow(c: CanvasRenderingContext2D, r: Row, x: number, top: number, inks: Inks) {
  const baseline = top + r.lead * 0.74
  if (r.label) {
    c.font = fontOf({ text: r.label }, r.size)
    c.fillStyle = inks.muted
    c.textAlign = 'right'
    c.textBaseline = 'alphabetic'
    c.fillText(r.label, x + r.indent - 4 * U, baseline)
    c.textAlign = 'left'
  }
  drawLine(c, r.line, x + r.indent, baseline, r.size, inks)
}

interface Region {
  x: number
  top: number
  bottom: number
}
type Slice = { region: Region; rows: Row[] }

/**
 * Rows poured into regions, page after page: a column, then the next, then the next page's.
 * A heading is never left at the foot of a column without its first line, and a region too
 * short for a line is skipped rather than overfilled.
 */
function pour(rows: Row[], regionsFor: (page: number) => Region[]): Slice[][] {
  const pages: Slice[][] = []
  let i = 0
  for (let p = 0; i < rows.length && p < 500; p++) {
    const page: Slice[] = []
    const regions = regionsFor(p)
    for (const region of regions) {
      if (i >= rows.length) break
      const slice: Slice = { region, rows: [] }
      let y = region.top
      while (i < rows.length) {
        const r = rows[i]
        const h = (slice.rows.length ? r.gap : 0) + r.lead
        const next = rows[i + 1]
        const hold = r.keep && next ? next.gap + next.lead : 0
        if (y + h + hold > region.bottom) break
        slice.rows.push(r)
        y += h
        i++
      }
      if (slice.rows.length) page.push(slice)
    }
    // Nothing fitted anywhere on a fresh page: a row taller than any region. Placed anyway, once,
    // so the loop always advances.
    if (page.length === 0 && regions.length) {
      page.push({ region: regions[0], rows: [rows[i]] })
      i++
    }
    pages.push(page)
  }
  return pages.length ? pages : [[]]
}

function drawSlices(sheet: Sheet, slices: Slice[]) {
  for (const s of slices) {
    let y = s.region.top
    s.rows.forEach((r, j) => {
      if (j) y += r.gap
      drawRow(sheet.c, r, s.region.x, y, sheet.inks)
      y += r.lead
    })
  }
}

/* ── The page ─────────────────────────────────────────────────────────── */

class Sheet {
  readonly canvas: HTMLCanvasElement
  readonly c: CanvasRenderingContext2D
  readonly W: number
  readonly H: number
  readonly left: number
  readonly right: number
  readonly bottom: number

  constructor(
    readonly paper: { w: number; h: number },
    readonly inks: Inks,
    /** What every page head says it is of — the repo, and the commit. */
    readonly stamp: string,
  ) {
    this.canvas = document.createElement('canvas')
    this.W = Math.round(paper.w * U)
    this.H = Math.round(paper.h * U)
    this.canvas.width = this.W
    this.canvas.height = this.H
    const c = this.canvas.getContext('2d')
    if (!c) throw new Error('This machine gave no 2D canvas to draw the pages on.')
    this.c = c
    this.left = MARGIN * U
    this.right = this.W - MARGIN * U
    this.bottom = this.H - MARGIN * U
  }

  get width(): number {
    return this.right - this.left
  }

  begin() {
    const c = this.c
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = this.inks.bg
    c.fillRect(0, 0, this.W, this.H)
  }

  text(
    s: string,
    x: number,
    y: number,
    o: { size: number; bold?: boolean; mono?: boolean; color?: string; align?: CanvasTextAlign },
  ) {
    const c = this.c
    c.font = fontOf({ text: s, bold: o.bold, mono: o.mono }, o.size)
    c.fillStyle = o.color ?? this.inks.fg
    c.textAlign = o.align ?? 'left'
    c.textBaseline = 'alphabetic'
    c.fillText(s, x, y)
    c.textAlign = 'left'
  }

  measure(s: string, size: number, bold = false, mono = false): number {
    this.c.font = fontOf({ text: s, bold, mono }, size)
    return this.c.measureText(s).width
  }

  rule(y: number, x = this.left, w = this.width) {
    this.c.fillStyle = this.inks.border
    this.c.fillRect(x, y, w, Math.max(1, 0.6 * U))
  }

  /** Eyebrow and title. The body starts at `HEADER_BOTTOM`. */
  header(eyebrow: string, title: string, mono = false) {
    let y = (MARGIN + 8) * U
    this.text(eyebrow.toUpperCase(), this.left, y, { size: 7.5, bold: true, color: this.inks.muted })
    this.text(this.stamp, this.right, y, { size: 7.5, color: this.inks.muted, align: 'right' })
    y += 25 * U
    const t = fitText(this, title, 22, this.width, { bold: true, mono, floor: 12 })
    this.text(t.text, this.left, y, { size: t.size, bold: true, mono })
    this.rule(y + 10 * U)
  }

  /** The head of a page that carries on from the one before. The body starts at `CONTINUED_TOP`. */
  continued(eyebrow: string, title: string, mono = false) {
    let y = (MARGIN + 8) * U
    this.text(eyebrow.toUpperCase(), this.left, y, { size: 7.5, bold: true, color: this.inks.muted })
    this.text(this.stamp, this.right, y, { size: 7.5, color: this.inks.muted, align: 'right' })
    y += 25 * U
    const t = fitText(this, title, 16, this.width, { bold: true, mono, floor: 9 })
    this.text(t.text, this.left, y, { size: t.size, bold: true, mono })
    this.rule(y + 9 * U)
  }

  footer(n: number, of: number) {
    const y = this.H - 22 * U
    this.text('charted by sanity.monster', this.left, y, { size: 7.5, color: this.inks.muted })
    this.text(`${n} / ${of}`, this.right, y, { size: 7.5, color: this.inks.muted, align: 'right' })
  }

  async jpeg(): Promise<Uint8Array> {
    const blob = await within(
      new Promise<Blob | null>((done) => this.canvas.toBlob(done, 'image/jpeg', QUALITY)),
      20_000,
      'A page took longer than 20s to encode.',
    )
    if (!blob) throw new Error('This machine returned no picture of the page.')
    return new Uint8Array(await blob.arrayBuffer())
  }
}

/** A string that fits `maxW`: shrunk toward `floor`, and only then cut from the middle, where a
 *  path loses the least — its head says which corner, its tail which file. */
function fitText(
  sheet: Sheet,
  s: string,
  size: number,
  maxW: number,
  o: { bold?: boolean; mono?: boolean; floor?: number } = {},
): { text: string; size: number } {
  const floor = o.floor ?? size * 0.75
  let fs = size
  while (fs > floor && sheet.measure(s, fs, o.bold, o.mono) > maxW) fs -= 0.25
  if (sheet.measure(s, fs, o.bold, o.mono) <= maxW) return { text: s, size: fs }
  const cut = (n: number) => `${s.slice(0, Math.ceil(n / 2))}…${s.slice(s.length - Math.floor(n / 2))}`
  let keep = s.length - 1
  while (keep > 2 && sheet.measure(cut(keep), fs, o.bold, o.mono) > maxW) keep -= 1
  return { text: cut(keep), size: fs }
}

/** A rounded rectangle, spelled out — `roundRect` is newer than the WebKit this has to run on. */
function pill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h, w) / 2
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

/* ── The key ──────────────────────────────────────────────────────────── */

interface KeyItem {
  label: string
  fill: string | null
  /** A texture rather than a colour — the stale hatch. */
  hatch?: boolean
  alpha?: number
}

/** The key as one list, for measuring and drawing alike, so the two cannot disagree. */
function keyItems(key: LensKey | null, extra: KeyItem[]): { ramp: FlatKey['ramp']; items: KeyItem[] } {
  const flat = flatKey(key)
  const items: KeyItem[] = [
    ...(flat && !flat.ramp ? flat.entries.map((e) => ({ label: e.label, fill: e.fill })) : []),
    ...(flat && flat.more > 0
      ? [
          {
            label: `${flat.more} more${key?.kind === 'cast' && key.repeats ? ' · shades repeat' : ''}`,
            fill: null,
          },
        ]
      : []),
    ...extra,
  ]
  return { ramp: flat?.ramp ?? null, items }
}

function keyRows(sheet: Sheet, items: KeyItem[], width: number) {
  const size = 8
  const box = 7 * U
  const gap = 12 * U
  const rows: { items: { it: KeyItem; x: number }[]; w: number }[] = []
  let cur: (typeof rows)[number] = { items: [], w: 0 }
  for (const it of items) {
    const w = (it.fill || it.hatch ? box + 4 * U : 0) + sheet.measure(it.label, size)
    if (cur.items.length && cur.w + gap + w > width) {
      rows.push(cur)
      cur = { items: [], w: 0 }
    }
    const x = cur.items.length ? cur.w + gap : 0
    cur.items.push({ it, x })
    cur.w = x + w
  }
  if (cur.items.length) rows.push(cur)
  return rows
}

function keyHeight(sheet: Sheet, key: LensKey | null, extra: KeyItem[], width: number): number {
  const k = keyItems(key, extra)
  return (k.ramp ? 13 * U : 0) + keyRows(sheet, k.items, width).length * 13 * U
}

/** The key, centred on `cx` within `width`. Returns where it ends. */
function drawKey(
  sheet: Sheet,
  from: Element,
  key: LensKey | null,
  extra: KeyItem[],
  top: number,
  cx: number,
  width: number,
  /** `left` starts every row at `cx` instead of centring it there. */
  align: 'center' | 'left' = 'center',
): number {
  const c = sheet.c
  const inks = sheet.inks
  const { ramp, items } = keyItems(key, extra)
  let y = top

  if (ramp) {
    const h = 7 * U
    const [lo, hi] = ramp.ends
    const loW = sheet.measure(lo, 8)
    const hiW = sheet.measure(hi, 8)
    const bar = Math.max(40 * U, Math.min(150 * U, width - loW - hiW - 16 * U))
    let x = align === 'left' ? cx : cx - (loW + bar + hiW + 16 * U) / 2
    const base = y + 9 * U
    sheet.text(lo, x, base, { size: 8, color: inks.muted })
    x += loW + 8 * U
    const step = bar / ramp.fills.length
    ramp.fills.forEach((f, i) => {
      c.fillStyle = paint(from, f) || inks.muted
      c.fillRect(x + i * step, base - h + 1 * U, step, h)
    })
    sheet.text(hi, x + bar + 8 * U, base, { size: 8, color: inks.muted })
    y += 13 * U
  }

  const box = 7 * U
  for (const row of keyRows(sheet, items, width)) {
    const x0 = align === 'left' ? cx : cx - row.w / 2
    const base = y + 9 * U
    for (const { it, x } of row.items) {
      let tx = x0 + x
      if (it.fill || it.hatch) {
        const by = base - box + 1 * U
        c.save()
        c.globalAlpha = it.alpha ?? 1
        c.fillStyle = it.fill ? paint(from, it.fill) || inks.muted : inks.bg
        c.fillRect(tx, by, box, box)
        c.restore()
        if (it.hatch) {
          c.save()
          c.beginPath()
          c.rect(tx, by, box, box)
          c.clip()
          c.strokeStyle = inks.fg
          c.globalAlpha = 0.55
          c.lineWidth = 0.9 * U
          for (let k = -box; k < box * 2; k += 3 * U) {
            c.beginPath()
            c.moveTo(tx + k, by + box)
            c.lineTo(tx + k + box, by)
            c.stroke()
          }
          c.restore()
          c.strokeStyle = inks.border
          c.lineWidth = 0.6 * U
          c.strokeRect(tx, by, box, box)
        }
        tx += box + 4 * U
      }
      sheet.text(it.label, tx, base, { size: 8, color: it.fill || it.hatch ? inks.fg : inks.muted })
    }
    y += 13 * U
  }
  return y
}

function pendingItems(o: Report, m: ColorMode): KeyItem[] {
  const pend = paintsFromReadings(m) ? o.pending() : { stale: 0, unread: 0 }
  return [
    ...(pend.stale > 0 ? [{ label: `${pend.stale.toLocaleString()} stale`, fill: null, hatch: true }] : []),
    ...(pend.unread > 0
      ? [{ label: `${pend.unread.toLocaleString()} unread`, fill: 'var(--unanalyzed)', alpha: 0.4 }]
      : []),
  ]
}

/* ── The map ──────────────────────────────────────────────────────────── */

function mapSvg(): SVGSVGElement {
  const svg = document.querySelector<SVGSVGElement>('svg[data-sunburst]')
  if (!svg) throw new Error('The map is not on screen to copy.')
  return svg
}

function viewBoxOf(svg: SVGSVGElement): [number, number, number, number] {
  const vb = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
  return vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0
    ? [vb[0], vb[1], vb[2], vb[3]]
    : [0, 0, 1, 1]
}

/**
 * Wait for the map to stop changing before a figure is copied from it.
 *
 * **Two things move after the pane is staged, and a copy taken during either is a wrong page.**
 * A change of root is a level change, which animates — and while it does the function patches
 * are not drawn at all. And a denser layout has room to tile files it could not before, which
 * asks the backend for their function rings, landing a batch at a time. So: still for
 * `QUIET_MS`, measured rather than assumed — the rings group turns pointer events off for exactly
 * as long as it is moving, and `settled` is the window's own account of what is in flight.
 */
async function rest(o: Report): Promise<void> {
  const start = performance.now()
  let last = start
  let quiet = 0
  for (;;) {
    await new Promise((r) => requestAnimationFrame(r))
    if (o.cancelled()) throw new Error(CANCELLED)
    const now = performance.now()
    const rings = document.querySelector<SVGGElement>('svg[data-sunburst] [data-rings]')
    const still = rings !== null && rings.style.pointerEvents !== 'none'
    quiet = still && o.settled() ? quiet + (now - last) : 0
    last = now
    if (quiet >= QUIET_MS || now - start > REST_LIMIT) break
  }
  await settle()
}

/** Where a square picture of the map puts the SVG's user space. */
function userToPage(svg: SVGSVGElement, x: number, y: number, side: number): DOMMatrix {
  const [vx, vy, vw, vh] = viewBoxOf(svg)
  // `xMidYMid meet`, the default the copy is rendered with.
  const s = side / Math.max(vw, vh)
  return new DOMMatrix([s, 0, 0, s, x + (side - vw * s) / 2 - vx * s, y + (side - vh * s) / 2 - vy * s])
}

/** Drop from the copy every label that would print below `MIN_LABEL_PT`. The window's label
 *  rules are in pixels, and a name that fits at 4pt fits and cannot be read. */
function pruneLabels(clone: SVGSVGElement, side: number) {
  const [, , vw, vh] = viewBoxOf(clone)
  const scale = side / Math.max(vw, vh)
  for (const t of Array.from(clone.querySelectorAll('text'))) {
    const fs = parseFloat(t.getAttribute('font-size') ?? '') || parseFloat(t.style.fontSize) || 0
    if (fs > 0 && (fs * scale) / U < MIN_LABEL_PT) t.remove()
  }
}

async function drawMap(
  sheet: Sheet,
  svg: SVGSVGElement,
  style: string,
  x: number,
  y: number,
  side: number,
  over?: (img: HTMLImageElement) => void,
) {
  await rastered(
    svg,
    Math.round(side),
    style,
    (img) => {
      sheet.c.drawImage(img, x, y, side, side)
      over?.(img)
    },
    'The map took longer than 20s to draw.',
    (clone) => pruneLabels(clone, side),
  )
  drawCreature(sheet.c, svg, { x, y, side })
}

/** Where one thing is on a drawn map. */
interface Spot {
  /** The path drawn for it, or for the nearest container that was drawn. */
  d: string
  /** Path space → page pixels. */
  m: DOMMatrix
  /** The middle of its arc, on the page. */
  at: { x: number; y: number }
  /** True when the thing itself was not drawn and this is what holds it. */
  coarse: boolean
}

const parentOf = (p: string) => {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

function tagsOf(svg: SVGSVGElement): Map<string, SVGPathElement> {
  const tagged = new Map<string, SVGPathElement>()
  for (const el of Array.from(svg.querySelectorAll<SVGPathElement>('path[data-node]'))) {
    tagged.set(el.getAttribute('data-node')!, el)
  }
  return tagged
}

/** Find a thing among the tagged paths by any of its own ids, then up its path to the deepest
 *  drawn container — the rule the selection follows, because "in here" is an answer. */
function locate(
  own: string[],
  fallback: string,
  tagged: Map<string, SVGPathElement>,
  svg: SVGSVGElement,
  page: DOMMatrix,
): Spot | null {
  const tries = [...own]
  for (let p = fallback; p; p = parentOf(p)) if (!tries.includes(p)) tries.push(p)
  const screen = svg.getScreenCTM()
  if (!screen) return null
  const toUser = screen.inverse()
  for (const id of tries) {
    const el = tagged.get(id)
    if (!el) continue
    const ctm = el.getScreenCTM()
    const d = el.getAttribute('d')
    const arc = (el.getAttribute('data-arc') ?? '').split(' ').map(Number)
    if (!ctm || !d || arc.length !== 4 || !arc.every(Number.isFinite)) continue
    const m = page.multiply(toUser.multiply(ctm))
    const [a0, a1, r0, r1] = arc
    const am = (a0 + a1) / 2
    const rm = (r0 + r1) / 2
    const pt = m.transformPoint(new DOMPoint(rm * Math.sin(am), -rm * Math.cos(am)))
    return { d, m, at: { x: pt.x, y: pt.y }, coarse: !own.includes(id) }
  }
  return null
}

/** **By `finding.key` first, because that is what a function node's id is** — `key_of`, where a
 *  hit's id is spelled `path#name@line` and matches no function at all. */
function spotOf(item: FindingItem, tagged: Map<string, SVGPathElement>, svg: SVGSVGElement, page: DOMMatrix) {
  const h = item.finding.hit
  return locate([item.finding.key, h.id], h.kind === 'func' ? h.path : parentOf(h.path), tagged, svg, page)
}

/** The map grey, except where a marked thing is. Colour is the mark: the structure stays legible
 *  and the wedges that matter are the only colour on the figure. By compositing, never by reading
 *  pixels back, which WebKit can refuse on a canvas an SVG was drawn into. */
function greyExcept(
  sheet: Sheet,
  img: HTMLImageElement,
  spots: (Spot | null)[],
  x: number,
  y: number,
  side: number,
) {
  const c = sheet.c
  c.save()
  c.beginPath()
  c.rect(x, y, side, side)
  c.clip()
  c.globalCompositeOperation = 'saturation'
  c.fillStyle = '#808080'
  c.fillRect(x, y, side, side)
  c.globalCompositeOperation = 'source-over'
  c.globalAlpha = 0.4
  c.fillStyle = sheet.inks.bg
  c.fillRect(x, y, side, side)
  c.restore()

  const union = new Path2D()
  let any = false
  for (const s of spots) {
    if (!s) continue
    union.addPath(new Path2D(s.d), s.m)
    any = true
  }
  if (!any) return
  c.save()
  c.clip(union)
  c.drawImage(img, x, y, side, side)
  c.restore()
}

interface Mark {
  spot: Spot | null
  label: string
  dashed: boolean
}

/** Outlines and labels over a drawn map. Marks within a label's width of each other share one
 *  label (`4 · 8 · 11`), kept inside the map's square. */
function drawMarks(sheet: Sheet, marks: Mark[], x: number, y: number, side: number) {
  const c = sheet.c
  const inks = sheet.inks
  for (const mk of marks) {
    const s = mk.spot
    if (!s) continue
    const p = new Path2D()
    p.addPath(new Path2D(s.d), s.m)
    const dashed = mk.dashed || s.coarse
    c.save()
    c.strokeStyle = inks.fg
    c.lineWidth = (dashed ? 0.9 : 1.2) * U
    if (dashed) {
      c.setLineDash([3 * U, 2.4 * U])
      c.globalAlpha = 0.75
    }
    c.stroke(p)
    c.restore()
  }

  const r = 7 * U
  const clusters: { x: number; y: number; labels: string[] }[] = []
  for (const mk of marks) {
    const s = mk.spot
    if (!s) continue
    const near = clusters.find((k) => Math.hypot(k.x - s.at.x, k.y - s.at.y) < r * 2.2)
    if (near) near.labels.push(mk.label)
    else clusters.push({ x: s.at.x, y: s.at.y, labels: [mk.label] })
  }
  for (const k of clusters) {
    const label = k.labels.join(' · ')
    const w = Math.max(r * 2, sheet.measure(label, 7.5, true) + 8 * U)
    const cx = Math.min(x + side - w / 2, Math.max(x + w / 2, k.x))
    const cy = Math.min(y + side - r, Math.max(y + r, k.y))
    pill(c, cx - w / 2, cy - r, w, r * 2)
    c.fillStyle = inks.fg
    c.fill()
    c.strokeStyle = inks.bg
    c.lineWidth = 1.2 * U
    c.stroke()
    sheet.text(label, cx, cy + 2.6 * U, { size: 7.5, bold: true, color: inks.bg, align: 'center' })
  }
}

/* ── Findings: entries ────────────────────────────────────────────────── */

interface Entry {
  n: number
  /** Marked on its group's map — known only once that map is drawn, and it changes nothing about
   *  the entry's height. */
  pinned: boolean
  addr: string
  head: Line[]
  rules: { title: Line[]; says: Line[] }[]
  lenses: string[]
  item: FindingItem
}

const SIZE = { head: 9.5, title: 8.5, say: 8.5 }
const BADGE = 22 * U
/** The line an entry carries when it starts a page without its heading. */
const CONT_H = lead(7.5) + 4 * U

function entryOf(
  sheet: Sheet,
  item: FindingItem,
  n: number,
  intro: Map<string, string>,
  /** Where the entry's column starts — the margin, or a deck's text column. */
  left = sheet.left,
): Entry {
  const c = sheet.c
  const inks = sheet.inks
  const width = sheet.right - left - BADGE
  const hit = item.finding.hit
  const head = setLines(
    c,
    [
      { text: dirOf(hit.path), mono: true, muted: true },
      { text: fileOf(hit), mono: true, bold: hit.kind !== 'func' },
      { text: nameOf(hit), mono: true, bold: true },
      ...(item.flagged ? [{ text: '  flagged', bold: true, color: inks.accent }] : []),
    ].filter((r) => r.text),
    width,
    SIZE.head,
  )
  const rules = item.rules.map((r, k) => ({
    title: setLines(c, [{ text: r.title, bold: true }], width, SIZE.title),
    says: setLines(
      c,
      [
        ...(item.says[k] ?? []).map((s) => (s.filled ? { text: s.text, bold: true } : { text: s.text, muted: true })),
        ...(intro.get(r.id) === item.finding.key && r.background ? [{ text: ` ${r.background}`, muted: true }] : []),
      ],
      width,
      SIZE.say,
    ),
  }))
  return {
    n,
    pinned: false,
    addr: `${dirOf(hit.path)}${fileOf(hit)}${nameOf(hit)}`,
    head,
    rules,
    lenses: [...new Set(item.rules.flatMap((r) => r.lenses))],
    item,
  }
}

const partsOf = (e: Entry) => Math.max(1, e.rules.length)

/** An entry comes apart at its rules, so a page break can fall between two of them. Part 0 is the
 *  heading with the first rule; the last part carries the lens chips. */
function partHeight(e: Entry, k: number): number {
  let h = 0
  if (k === 0) h += 8 * U + e.head.length * lead(SIZE.head) + 7.6 * U
  const r = e.rules[k]
  if (r) h += r.title.length * lead(SIZE.title) + r.says.length * lead(SIZE.say) + 4 * U
  if (k === partsOf(e) - 1) h += 22 * U
  return h
}

function drawPart(
  sheet: Sheet,
  from: Element,
  e: Entry,
  k: number,
  top: number,
  cont: boolean,
  /** The column it was laid out for — see `entryOf`. */
  left = sheet.left,
): number {
  const c = sheet.c
  const inks = sheet.inks
  const x = left + BADGE
  let y = top

  if (cont) {
    const t = fitText(sheet, `${e.n}  ${e.addr}, continued`, 7.5, sheet.right - x, { floor: 6 })
    sheet.text(t.text, x, y + lead(7.5) * 0.74, { size: t.size, color: inks.muted })
    y += CONT_H
  }

  if (k === 0) {
    y += 8 * U
    const r = 7 * U
    const bx = left + r
    const by = y + lead(SIZE.head) * 0.5
    c.beginPath()
    c.arc(bx, by, r, 0, Math.PI * 2)
    if (e.pinned) {
      c.fillStyle = inks.fg
      c.fill()
    } else {
      c.strokeStyle = inks.muted
      c.lineWidth = 0.8 * U
      c.stroke()
    }
    sheet.text(String(e.n), bx, by + 2.6 * U, {
      size: e.n >= 100 ? 6 : 7.5,
      bold: true,
      color: e.pinned ? inks.bg : inks.muted,
      align: 'center',
    })
    for (const line of e.head) {
      drawLine(c, line, x, y + lead(SIZE.head) * 0.74, SIZE.head, inks)
      y += lead(SIZE.head)
    }
    y += 2 * U
    const w = sheet.right - x
    const seg = w / Math.max(1, e.lenses.length)
    if (e.lenses.length === 0) {
      c.fillStyle = inks.border
      c.fillRect(x, y, w, 1.6 * U)
    }
    e.lenses.forEach((id, i) => {
      c.fillStyle = paint(from, lensColor(id)) || inks.border
      c.fillRect(x + i * seg, y, seg, 1.6 * U)
    })
    y += 5.6 * U
  }

  const rule = e.rules[k]
  if (rule) {
    for (const line of rule.title) {
      drawLine(c, line, x, y + lead(SIZE.title) * 0.74, SIZE.title, inks)
      y += lead(SIZE.title)
    }
    for (const line of rule.says) {
      drawLine(c, line, x, y + lead(SIZE.say) * 0.74, SIZE.say, inks)
      y += lead(SIZE.say)
    }
    y += 4 * U
  }

  if (k === partsOf(e) - 1) {
    let cx = x
    const base = y + 8 * U
    for (const id of e.lenses) {
      c.fillStyle = paint(from, lensColor(id)) || inks.muted
      c.beginPath()
      c.arc(cx + 2 * U, base - 2.4 * U, 2 * U, 0, Math.PI * 2)
      c.fill()
      const label = lensName(id).toUpperCase()
      sheet.text(label, cx + 6 * U, base, { size: 6.5, bold: true, color: inks.muted })
      cx += 6 * U + sheet.measure(label, 6.5, true) + 10 * U
    }
    y += 22 * U
    c.fillStyle = inks.border
    c.fillRect(left, y - 1 * U, sheet.right - left, Math.max(1, 0.5 * U))
  }
  return y - top
}

/* ── Findings: groups and the grid ────────────────────────────────────── */

interface Section {
  letter: string
  root: string
  kind: 'dir' | 'file'
  entries: Entry[]
}

type PartSlot = { e: Entry; k: number; cont: boolean }
type GridRow = { band: Section } | { entry: Entry }

/** Every finding against every rule that raised it — the one place a reader sees that one body
 *  was hit by four rules at once, which the grouping by place spreads across the page. */
interface Grid {
  cols: { id: string; title: string; count: number }[]
  /** The whole grid's width — the text width, or a deck's text column. */
  width: number
  colW: number
  labelW: number
  titleH: number
  headH: number
  rowH: number
  bandH: number
  rows: GridRow[]
}

function letterOf(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : letterOf(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26))
}

function gridOf(sheet: Sheet, groups: FindingGroup[], sections: Section[], width = sheet.width): Grid {
  const all = sections.flatMap((s) => s.entries)
  const cols = groups
    .filter((g) => !g.blocked)
    .map((g) => ({ id: g.id, title: g.title, count: all.filter((e) => e.item.rules.some((r) => r.id === g.id)).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  const colW = Math.min(16 * U, (width * 0.5) / Math.max(1, cols.length))
  const titleH = Math.min(130 * U, Math.max(0, ...cols.map((c) => sheet.measure(c.title, 7))) + 6 * U)
  return {
    cols,
    width,
    colW,
    labelW: width - colW * cols.length - 8 * U,
    titleH,
    headH: titleH + 18 * U,
    rowH: 11.5 * U,
    bandH: 18 * U,
    rows: sections.flatMap((s) => [{ band: s } as GridRow, ...s.entries.map((e) => ({ entry: e }) as GridRow)]),
  }
}

const gridRowH = (g: Grid, r: GridRow) => ('band' in r ? g.bandH : g.rowH)

function drawGridHead(sheet: Sheet, g: Grid, top: number, left = sheet.left): number {
  const c = sheet.c
  const x0 = left + g.labelW + 8 * U
  const base = top + g.titleH
  g.cols.forEach((col, i) => {
    const cx = x0 + i * g.colW + g.colW / 2
    const t = fitText(sheet, col.title, 7, g.titleH - 6 * U, { floor: 6 })
    // Rotated a quarter turn: the glyphs rise from the baseline toward the left, so the origin
    // sits a little right of centre to put the text on the column's axis.
    c.save()
    c.translate(cx + t.size * 0.35 * U, base - 2 * U)
    c.rotate(-Math.PI / 2)
    c.font = fontOf({ text: t.text }, t.size)
    c.fillStyle = sheet.inks.fg
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
    c.fillText(t.text, 0, 0)
    c.restore()
    sheet.text(String(col.count), cx, base + 11 * U, { size: 7, bold: true, color: sheet.inks.muted, align: 'center' })
  })
  sheet.text('FINDING', left, base + 11 * U, { size: 7, bold: true, color: sheet.inks.muted })
  sheet.rule(base + 15 * U, left, g.width)
  return top + g.headH
}

function drawGridRow(
  sheet: Sheet,
  g: Grid,
  r: GridRow,
  top: number,
  placeName: (s: Section) => string,
  left = sheet.left,
): number {
  const c = sheet.c
  const inks = sheet.inks
  const x0 = left + g.labelW + 8 * U
  if ('band' in r) {
    const s = r.band
    c.fillStyle = inks.border
    c.fillRect(left, top + 3 * U, g.width, Math.max(1, 0.5 * U))
    const t = fitText(sheet, `${s.letter}  ${placeName(s)}`, 8, g.labelW, { bold: true, mono: true, floor: 6 })
    sheet.text(t.text, left, top + g.bandH * 0.78, { size: t.size, bold: true, mono: true })
    return top + g.bandH
  }
  const e = r.entry
  g.cols.forEach((_, i) => {
    if (i % 2 === 0) return
    c.save()
    c.globalAlpha = 0.5
    c.fillStyle = inks.secondary
    c.fillRect(x0 + i * g.colW, top, g.colW, g.rowH)
    c.restore()
  })
  const base = top + g.rowH * 0.74
  sheet.text(String(e.n), left + 14 * U, base, { size: 7, bold: true, color: inks.muted, align: 'right' })
  const t = fitText(sheet, e.addr, 7.5, g.labelW - 20 * U, { mono: true, floor: 6 })
  sheet.text(t.text, left + 20 * U, base, { size: t.size, mono: true })
  const ids = new Set(e.item.rules.map((x) => x.id))
  g.cols.forEach((col, i) => {
    if (!ids.has(col.id)) return
    c.fillStyle = inks.fg
    c.beginPath()
    c.arc(x0 + i * g.colW + g.colW / 2, top + g.rowH / 2, 2.3 * U, 0, Math.PI * 2)
    c.fill()
  })
  return top + g.rowH
}

/** What the list cannot say by being short — the panel's footer, said first. */
function findingSummary(count: number, groups: FindingGroup[]): Run[] {
  const runs: Run[] = []
  const setAside = setAsideCount(groups)
  if (count === 0) {
    runs.push({
      text:
        setAside > 0
          ? `Nothing standing. ${setAside.toLocaleString()} ignored.`
          : 'Nothing in this repo matches the rules.',
    })
  } else {
    runs.push(
      { text: `${count.toLocaleString()}${rowsCapped(groups) ? '+' : ''}`, bold: true },
      { text: ` finding${count === 1 ? '' : 's'}, grouped by where they are.` },
    )
    if (rowsCapped(groups)) {
      runs.push({ text: ' Some rules found more than the report was sent, so the list is short.', muted: true })
    }
    if (setAside > 0) runs.push({ text: ` ${setAside.toLocaleString()} ignored.`, muted: true })
  }
  for (const b of blockedByNeed(groups)) {
    runs.push({ text: ` ${b.rules.length} of ${groups.length} rules inactive (${b.need}).`, muted: true })
  }
  return runs
}

/* ── The cover ────────────────────────────────────────────────────────── */

/** The wordmark's paths, read off the component that draws it in the window — one copy of the
 *  brand's shapes, not a second one typed out here. */
function wordmarkPaths(): string[] {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden'
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    flushSync(() => root.render(createElement(Wordmark, { height: 10 })))
    return Array.from(host.querySelectorAll('path'))
      .map((p) => p.getAttribute('d') ?? '')
      .filter(Boolean)
  } finally {
    root.unmount()
    host.remove()
  }
}

/** The slots the methodology names, filled from this repository. */
function methodVars(o: Report, findings: number): Record<string, string> {
  const s = o.stats
  const n = (v: number) => v.toLocaleString()
  const langs =
    s.languages.length > 12
      ? `${s.languages.slice(0, 12).join(', ')} and ${s.languages.length - 12} more`
      : s.languages.join(', ') || 'none'
  const locked = (Object.keys(o.locks) as ColorMode[]).map((m) => MODE_LABEL[m])
  const reader =
    s.models.length === 0
      ? 'No readings have been taken in this repository.'
      : s.model
        ? `This corpus was read by ${s.model}${s.harness ? ` via ${s.harness}` : ''}.`
        : `This corpus mixes readings from ${s.models.map((m) => `${m.model} (${n(m.readings)})`).join(', ')}, and is therefore not on one scale.`
  const window = o.views.churn.windows[o.views.churn.at]
  return {
    formNoun: FORM[o.form].noun,
    repoSlug: o.slug,
    commitClause: o.head
      ? `at commit ${o.head.sha}${o.head.dirty === true ? ', with uncommitted changes' : ''}`
      : 'as found on disk',
    functions: n(s.functions),
    files: n(s.files),
    lines: n(s.lines),
    grammarClause: s.grammars ? `${s.grammars} grammars in this build; present here: ${langs}` : `present here: ${langs}`,
    unparsed: s.unparsed == null ? 'not reported' : n(s.unparsed),
    churnWindow: window ? String(window) : '90',
    findings: n(findings),
    lockedClause: locked.length ? locked.join(', ') : 'none here',
    readerClause: reader,
    assessed: n(s.assessed),
    readable: n(s.functions + s.files),
    stale: n(s.stale),
  }
}

/** `a`, `a and b`, `a, b and c`. */
function joinList(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/* ── Tables ───────────────────────────────────────────────────────────── */

const T_SIZE = 8
const T_HEAD = 6.5
const CELL_PAD = 8 * U
const SWATCH = 7 * U
/** The share's figure, right-aligned ahead of its bar. */
const BAR_TEXT = 30 * U

interface TableLayout {
  table: Table
  caption: Line[]
  cont: Line[]
  xs: number[]
  widths: number[]
  heads: Line[]
  rows: { cells: Line[][]; h: number }[]
  headH: number
  note: Line[]
}

/** A run of one table's rows placed on one page. */
interface TableSlot {
  layout: TableLayout
  from: number
  to: number
  top: number
  first: boolean
  last: boolean
}

interface LensPage {
  slices: Slice[]
  tables: TableSlot[]
}

/** A lens section laid out: where its figure, key and caption go on its first page, and the text
 *  on every page. The three forms place the figure differently and draw it the same way. */
interface LensPlan {
  m: ColorMode
  key: LensKey | null
  extra: KeyItem[]
  caption: Line[]
  figX: number
  figSide: number
  keyTop: number
  /** The key is centred on `keyCx` within `keyW`, or starts at it — see `keyAlign`. */
  keyCx: number
  keyW: number
  /** Centred under a map on paper; left, under the words, on a slide. */
  keyAlign: 'center' | 'left'
  capTop: number
  capX: number
  pages: LensPage[]
}

/**
 * A deck's words for a lens: the first sentence of what it is and the first of how to read its map.
 *
 * **A slide is spoken to, not read.** Two whole sections at a slide's size left the words the
 * larger half of every slide and the map beside them the smaller; a deck wants the picture and a
 * line under each heading.
 */
function deckProse(m: ColorMode, vars: Record<string, string>): Prose[] {
  return ESSAYS[m].sections
    .filter((sec) => SHORT_SECTIONS.includes(sec.heading))
    .map((sec) => ({ heading: sec.heading, body: [firstSentence(fillSlots(sec.body[0] ?? '', vars))] }))
}

/** Up to the first full stop that ends a sentence: one followed by a capital or a markup mark, or
 *  the end. `0.05` and `1.15 ×` are not the ends of sentences. */
function firstSentence(s: string): string {
  const m = /^[\s\S]*?[.?!](?=\s+[A-Z*`(“"]|$)/.exec(s.trim())
  return m ? m[0] : s.trim()
}

/** Blocks with paragraphs taken off the end until `fits` holds, and a heading left with nothing
 *  under it taken too. Only a brief and a deck cut, and only whole paragraphs. */
function trimToFit(blocks: Block[], fits: (b: Block[]) => boolean): Block[] {
  let b = blocks
  while (b.length > 1 && !fits(b)) {
    b = b.slice(0, -1)
    while (b.length > 1 && b[b.length - 1].kind === 'h') b = b.slice(0, -1)
  }
  return b
}

/** One cell's text on one line, cut from the middle if it has to be — a path's head and tail are
 *  both worth keeping. */
function oneLine(sheet: Sheet, run: Run, width: number, size: number): Line {
  const t = fitText(sheet, run.text, size, Math.max(width, 10 * U), { bold: run.bold, mono: run.mono, floor: size })
  return setLines(sheet.c, [{ ...run, text: t.text }], Number.MAX_SAFE_INTEGER, size)[0] ?? { items: [], w: 0 }
}

function layoutTable(sheet: Sheet, table: Table, n: number): TableLayout {
  const weight = table.columns.reduce((t, col) => t + col.weight, 0)
  const widths = table.columns.map((col) => (col.weight / weight) * sheet.width)
  const xs: number[] = []
  widths.reduce((x, w) => {
    xs.push(x)
    return x + w
  }, sheet.left)
  const heads = table.columns.map((col, i) =>
    oneLine(sheet, { text: col.label.toUpperCase(), bold: true, muted: true }, widths[i] - CELL_PAD, T_HEAD),
  )
  const rows = table.rows.map((cells) => {
    const lines = cells.map((cell, i) => {
      const run: Run = { text: cell.text, mono: cell.mono, muted: cell.muted }
      const room = widths[i] - CELL_PAD - (cell.swatch ? SWATCH + 4 * U : 0)
      if (cell.bar) return [oneLine(sheet, run, BAR_TEXT - 8 * U, T_SIZE)]
      if (table.columns[i]?.wrap) return setLines(sheet.c, [run], room, T_SIZE).slice(0, 10)
      return [oneLine(sheet, run, room, T_SIZE)]
    })
    return { cells: lines, h: Math.max(1, ...lines.map((l) => l.length)) * lead(T_SIZE) + 3 * U }
  })
  return {
    table,
    caption: setLines(sheet.c, [{ text: `Table ${n}. `, bold: true }, { text: table.caption, muted: true }], sheet.width, 7.5),
    cont: setLines(sheet.c, [{ text: `Table ${n}, continued.`, bold: true }], sheet.width, 7.5),
    xs,
    widths,
    heads,
    rows,
    headH: lead(T_HEAD) + 5 * U,
    note: table.note ? setLines(sheet.c, [{ text: table.note, muted: true, italic: true }], sheet.width, 7.5) : [],
  }
}

const tableCapH = (L: TableLayout, first: boolean) => (first ? L.caption.length : L.cont.length) * lead(7.5) + 4 * U
const colHeight = (rows: Row[]) => rows.reduce((h, r, j) => h + (j ? r.gap : 0) + r.lead, 0)

/**
 * The essay's last page, re-poured into two columns of even height.
 *
 * **Without it the tables could never use the space they were added for.** A table goes under
 * both columns, and the last page of an essay is one full column beside a few lines — so the
 * table started below the full one and the short one's half page stayed empty. Balanced, the
 * text ends halfway down and the table takes the rest.
 */
function balance(slices: Slice[], top: number, xs: [number, number], bottom: number): Slice[] {
  const rows = slices.flatMap((s) => s.rows)
  if (rows.length < 2) return slices
  // Cut at the first row that reaches half the height, so the first column is never the shorter.
  const total = colHeight(rows)
  let acc = 0
  let cut = rows.length
  for (let i = 0; i < rows.length; i++) {
    acc += (i ? rows[i].gap : 0) + rows[i].lead
    if (acc >= total / 2) {
      cut = i + 1
      break
    }
  }
  const a = rows.slice(0, cut)
  const b = rows.slice(cut).map((r, j) => (j === 0 ? { ...r, gap: 0 } : r))
  // A heading is never the last line of a column.
  while (a.length > 1 && a[a.length - 1].keep) b.unshift({ ...a.pop()!, gap: 0 })
  if (Math.max(colHeight(a), colHeight(b)) > bottom - top) return slices
  return [
    { region: { x: xs[0], top, bottom }, rows: a },
    { region: { x: xs[1], top, bottom }, rows: b },
  ].filter((s) => s.rows.length > 0)
}

/** Tables placed after `startY` on the last page, running onto new pages with the header
 *  repeated, never splitting a row. */
function placeTables(sheet: Sheet, pages: LensPage[], tables: TableLayout[], startY: number) {
  let page = pages[pages.length - 1]
  let y = startY
  const fresh = () => {
    page = { slices: [], tables: [] }
    pages.push(page)
    y = CONTINUED_TOP
  }
  for (const L of tables) {
    y += 16 * U
    let i = 0
    let first = true
    while (i < L.rows.length) {
      const capH = tableCapH(L, first)
      if (y + capH + L.headH + L.rows[i].h > sheet.bottom && y > CONTINUED_TOP + 1) {
        fresh()
        continue
      }
      const from = i
      let yy = y + capH + L.headH
      while (i < L.rows.length && (i === from || yy + L.rows[i].h <= sheet.bottom)) {
        yy += L.rows[i].h
        i++
      }
      const last = i >= L.rows.length
      page.tables.push({ layout: L, from, to: i, top: y, first, last })
      y = yy + (last && L.note.length ? 4 * U + L.note.length * lead(7.5) : 0)
      first = false
      if (!last) fresh()
    }
  }
}

function drawTable(sheet: Sheet, from: Element, s: TableSlot) {
  const c = sheet.c
  const inks = sheet.inks
  const L = s.layout
  let y = s.top
  for (const line of s.first ? L.caption : L.cont) {
    drawLine(c, line, sheet.left, y + lead(7.5) * 0.74, 7.5, inks)
    y += lead(7.5)
  }
  y += 4 * U
  L.heads.forEach((line, i) => {
    const x = L.table.columns[i].align === 'right' ? L.xs[i] + L.widths[i] - CELL_PAD - line.w : L.xs[i]
    drawLine(c, line, x, y + lead(T_HEAD) * 0.74, T_HEAD, inks)
  })
  y += L.headH
  sheet.rule(y - 2 * U)
  for (let r = s.from; r < s.to; r++) {
    const row = L.rows[r]
    const base = y + lead(T_SIZE) * 0.74
    row.cells.forEach((lines, i) => {
      const cell = L.table.rows[r][i]
      const right = L.table.columns[i].align === 'right'
      let x = L.xs[i]
      if (cell.swatch) {
        c.fillStyle = paint(from, cell.swatch) || inks.muted
        c.fillRect(x, base - SWATCH + 1 * U, SWATCH, SWATCH)
        x += SWATCH + 4 * U
      }
      if (cell.bar) {
        const room = L.widths[i] - CELL_PAD - BAR_TEXT
        c.fillStyle = paint(from, cell.bar.fill) || inks.muted
        c.fillRect(x + BAR_TEXT, base - 6 * U, Math.max(0.8 * U, room * Math.max(0, Math.min(1, cell.bar.share))), 5.5 * U)
      }
      lines.forEach((line, k) => {
        const lx = right
          ? L.xs[i] + L.widths[i] - CELL_PAD - line.w
          : cell.bar
            ? x + BAR_TEXT - 6 * U - line.w
            : x
        drawLine(c, line, lx, base + k * lead(T_SIZE), T_SIZE, inks)
      })
    })
    y += row.h
    c.fillStyle = inks.border
    c.fillRect(sheet.left, y - 1.5 * U, sheet.width, Math.max(1, 0.35 * U))
  }
  if (s.last && L.note.length) {
    y += 4 * U
    for (const line of L.note) {
      drawLine(c, line, sheet.left, y + lead(7.5) * 0.74, 7.5, inks)
      y += lead(7.5)
    }
  }
}

/**
 * The facts an essay's tokens stand for, for this repo.
 *
 * **Each is a whole sentence or nothing.** A token with no fact behind it — a scan too old to
 * count resolved calls, a repo no one has read — fills as empty and its sentence goes with it,
 * so the essay never prints a number it does not have or a zero standing in for one.
 */
function lensVars(o: Report, readerClause: string): Record<string, string> {
  const s = o.stats
  const n = (v: number) => v.toLocaleString()
  const band = (i: number) =>
    i >= TANGLE_EDGES.length
      ? `${n(TANGLE_EDGES[TANGLE_EDGES.length - 1] + 1)} lines and over`
      : `${n(i === 0 ? 1 : TANGLE_EDGES[i - 1] + 1)}–${n(TANGLE_EDGES[i])} lines`
  const medians = s.tangleBands.flatMap((med, i) => (med == null ? [] : [`${n(med)} for bodies of ${band(i)}`]))
  const calls = (s.callsResolved ?? 0) + (s.callsUnresolved ?? 0)
  const window = o.views.churn.windows[o.views.churn.at]
  const readable = s.functions + s.files
  return {
    tangleMedians: medians.length ? `In ${o.slug} the band medians are ${joinList(medians)}.` : '',
    languageCount: s.languages.length
      ? `The function bodies of ${o.slug} are written in ${n(s.languages.length)} language${s.languages.length === 1 ? '' : 's'}.`
      : '',
    callsResolved:
      s.callsResolved != null && calls > 0
        ? `In ${o.slug}, ${n(s.callsResolved)} of ${n(calls)} call sites (${Math.round((s.callsResolved / calls) * 100)}%) resolved to a definition in the repository; the rest name code outside it or could not be matched.`
        : '',
    authorsCommits:
      s.commits > 0
        ? `${o.slug} has ${n(s.commits)} commit${s.commits === 1 ? '' : 's'} by ${n(s.authors)}${s.authors >= 64 ? ' or more' : ''} author${s.authors === 1 ? '' : 's'}.`
        : '',
    ageSpan:
      s.ageSpan != null && s.ageSpan > 0
        ? `The span of ${o.slug} is ${n(Math.round(s.ageSpan))} day${Math.round(s.ageSpan) === 1 ? '' : 's'}: its oldest surviving line is that old.`
        : '',
    churnWindows:
      s.churnWindows.length && window
        ? `The windows offered for ${o.slug} are ${joinList(s.churnWindows.map(n))} days, and the figure uses the ${n(window)}-day window.`
        : '',
    readingState:
      readable > 0
        ? `In ${o.slug}, ${n(s.assessed)} of ${n(readable)} functions and files have current readings, and ${n(s.stale)} ${s.stale === 1 ? 'is' : 'are'} stale. ${readerClause}`
        : '',
  }
}

interface Cover {
  /** `REPOSITORY REPORT`, `BRIEF` or `DECK`. */
  eyebrow: string
  /** How wide the cover's column is: the page, or a deck title slide's left column. */
  width: number
  markTop: number
  eyebrowY: number
  titleY: number
  owner: string
  name: string
  titleSize: number
  subtitle: string
  subtitleY: number
  factsY: number
  rule1: number
  abstractHeadY: number
  abstractTop: number
  abstract: Line[]
  rule2: number
  bodyTop: number
}

function coverOf(sheet: Sheet, o: Report, vars: Record<string, string>, width = sheet.width): Cover {
  const cut = o.slug.lastIndexOf('/')
  const owner = cut > 0 ? o.slug.slice(0, cut + 1) : ''
  const name = cut > 0 ? o.slug.slice(cut + 1) : o.slug
  // Shrunk, never elided: a cut repo name names a repo that does not exist.
  let titleSize = 30
  while (titleSize > 12 && sheet.measure(owner, titleSize) + sheet.measure(name, titleSize, true) > width) {
    titleSize -= 1
  }
  const when = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const markTop = (MARGIN + 4) * U
  const eyebrowY = markTop + 24 * U + 46 * U
  const titleY = eyebrowY + 36 * U
  const subtitleY = titleY + 20 * U
  const factsY = subtitleY + 16 * U
  const rule1 = factsY + 12 * U
  const abstractHeadY = rule1 + 24 * U
  const abstractTop = abstractHeadY + 6 * U
  const abstract = setLines(sheet.c, inlineRuns(fillSlots(METHODOLOGY.abstract, vars)), width, 10)
  const rule2 = abstractTop + abstract.length * lead(10) + 10 * U
  return {
    eyebrow: `REPOSITORY ${FORM[o.form].noun.toUpperCase()}`,
    width,
    markTop,
    eyebrowY,
    titleY,
    owner,
    name,
    titleSize,
    subtitle: `A repository ${FORM[o.form].noun}, ${vars.commitClause} — ${when}`,
    subtitleY,
    factsY,
    rule1,
    abstractHeadY,
    abstractTop,
    abstract,
    rule2,
    bodyTop: rule2 + 16 * U,
  }
}

function drawCover(sheet: Sheet, cover: Cover, paths: string[], facts: string) {
  const c = sheet.c
  const inks = sheet.inks
  const h = 24 * U
  const s = h / 125
  c.save()
  c.translate(sheet.left, cover.markTop)
  c.scale(s, s)
  c.fillStyle = inks.fg
  for (const d of paths) c.fill(new Path2D(d))
  c.restore()
  sheet.text('sanity.monster', sheet.left + cover.width, cover.markTop + h, { size: 8, color: inks.muted, align: 'right' })

  sheet.text(cover.eyebrow, sheet.left, cover.eyebrowY, { size: 8, bold: true, color: inks.muted })
  sheet.text(cover.owner, sheet.left, cover.titleY, { size: cover.titleSize, color: inks.muted })
  sheet.text(cover.name, sheet.left + sheet.measure(cover.owner, cover.titleSize), cover.titleY, {
    size: cover.titleSize,
    bold: true,
  })
  const sub = fitText(sheet, cover.subtitle, 10.5, cover.width, { floor: 8 })
  sheet.text(sub.text, sheet.left, cover.subtitleY, { size: sub.size, color: inks.muted })
  const f = fitText(sheet, facts, 8.5, cover.width, { mono: true, floor: 7 })
  sheet.text(f.text, sheet.left, cover.factsY, { size: f.size, mono: true, color: inks.muted })
  sheet.rule(cover.rule1, sheet.left, cover.width)
  sheet.text('Abstract', sheet.left, cover.abstractHeadY, { size: 10.5, bold: true })
  let y = cover.abstractTop
  for (const line of cover.abstract) {
    drawLine(c, line, sheet.left, y + lead(10) * 0.74, 10, inks)
    y += lead(10)
  }
  sheet.rule(cover.rule2, sheet.left, cover.width)
}

/* ── The whole report ─────────────────────────────────────────────────── */

export async function buildReport(o: Report): Promise<Uint8Array> {
  const deck = o.form === 'deck'
  const paper = deck ? DECK_PAGE : PAPER[o.paper]
  const modes = lensPages(o.locks)
  const items = mergeFindings(o.groups)
  const pages: (PdfPage | null)[] = []
  let done = 0
  let total = 0
  const tick = (what: string) => o.onProgress({ done, total, what })
  const check = () => {
    if (o.cancelled()) throw new Error(CANCELLED)
  }
  const dirt = o.head?.dirty ? ' + uncommitted' : ''
  const stamp = o.head ? `${o.slug} @ ${o.head.sha}${dirt}` : o.slug

  await Promise.all([
    document.fonts.load(`700 100px ${FAMILY}`),
    document.fonts.load(`400 100px ${FAMILY}`),
  ]).catch(() => {})
  const wordmark = wordmarkPaths()

  const stage = (mode: ColorMode, px: number, root = '') =>
    o.stage({ px, ground: 'light', mode, whole: true, root })
  // The creature holds one pose for the whole report, so every figure shows the same face.
  const clock = mascotClock()
  let driving = false
  const pose = () => {
    if (driving) clock?.step(0)
  }

  try {
    tick('staging the map')
    const contentW = (paper.w - 2 * MARGIN) * U
    const colW = (contentW - GUTTER) / 2
    /** A deck title slide's map: the whole repository, as tall as the slide's margins allow. */
    const heroSide = (paper.h - 2 * MARGIN) * U
    stage(o.findingsLens, Math.round(deck ? heroSide : contentW))
    await rest(o)
    check()
    driving = clock?.hold() ?? false

    let svg = mapSvg()
    // **Always white paper.** A report is a document, printed or read beside other documents; a
    // dark page is a screen's choice, and the window's warm light ground prints as a grey wash.
    const inks: Inks = {
      bg: PAPER_WHITE,
      fg: ink(svg, '--foreground') || '#111',
      muted: ink(svg, '--muted-foreground') || '#777',
      border: ink(svg, '--border') || '#ddd',
      secondary: ink(svg, '--secondary') || '#eee',
      accent: ink(svg, '--accent') || '#c60',
    }
    const sheet = new Sheet(paper, inks, stamp)
    // White paper is the map's ground too: its cuts are drawn in `--background`.
    const style = (await faceCss()) + varCss(svg) + `svg{--background:${PAPER_WHITE}}`
    const col2 = sheet.left + colW + GUTTER
    const twoCols = (top: number): Region[] => [
      { x: sheet.left, top, bottom: sheet.bottom },
      { x: col2, top, bottom: sheet.bottom },
    ]
    /** A deck's slides put the map on the left and the words beside it, in this column. */
    const deckText = (side: number) => sheet.left + side + DECK_GAP

    // ── Lay out: the cover, and in a report the methodology under and after it.
    tick('setting the methodology')
    const vars = methodVars(o, items.length)
    const cover = coverOf(sheet, o, vars, deck ? sheet.width - heroSide - DECK_GAP : sheet.width)
    const methodBlocks = proseBlocks(METHODOLOGY.sections, vars)
    const onCover = (b: Block[]) => pour(flow(sheet.c, b, colW, 9), () => twoCols(cover.bodyTop))
    // A report's methodology runs on past its cover. A brief's is held to the cover, which has the
    // room, and gives up paragraphs from the end rather than a page; a deck's title slide has none.
    const methodPages: Slice[][] =
      o.form === 'report'
        ? pour(flow(sheet.c, methodBlocks, colW, 9), (p) => twoCols(p === 0 ? cover.bodyTop : CONTINUED_TOP))
        : o.form === 'brief'
          ? [onCover(trimToFit(methodBlocks, (b) => onCover(b).length === 1))[0] ?? []]
          : [[]]

    // ── Lay out: a section per lens.
    tick('setting the lens essays')
    /** Each lens's figure furniture — key, caption, and the height they take under the map — set
     *  at `width`. Key, then caption, with the air above, between and below them. The caption
     *  closes the figure: it is what a reader reads after the picture and its key, the order a
     *  paper sets a figure in. */
    const headsAt = (width: number) =>
      modes.map((m, i) => {
        const key = o.keyFor(m)
        const extra = pendingItems(o, m)
        const setting = settingOf(m, o.views)
        const caption = setLines(
          sheet.c,
          [
            { text: `Figure ${i + 1}. `, bold: true },
            {
              text: `${MODE_LABEL[m]}${setting ? `, ${setting}` : ''}. Angular width is lines of code; colour is this lens.`,
              muted: true,
            },
          ],
          width,
          7.5,
        )
        const keyH = keyHeight(sheet, key, extra, width)
        const under = 6 * U + keyH + 6 * U + caption.length * lead(7.5) + 14 * U
        return { m, key, extra, caption, keyH, under }
      })
    type Head = ReturnType<typeof headsAt>[number]
    let figure = modes.length
    const planOf = (h: Head, figX: number, figSide: number, keyCx: number, keyW: number, lensPages: LensPage[]): LensPlan => {
      const keyTop = HEADER_BOTTOM + figSide + 6 * U
      return {
        m: h.m,
        key: h.key,
        extra: h.extra,
        caption: h.caption,
        figX,
        figSide,
        keyTop,
        keyCx,
        keyW,
        keyAlign: 'center',
        capTop: keyTop + h.keyH + 6 * U,
        capX: sheet.left,
        pages: lensPages,
      }
    }
    /** A brief's and a deck's essay: `SHORT_SECTIONS` of the report's. */
    const shortBlocks = (m: ColorMode) =>
      proseBlocks(
        ESSAYS[m].sections.filter((sec) => SHORT_SECTIONS.includes(sec.heading)),
        lensVars(o, vars.readerClause),
      )

    let lensPlans: LensPlan[]
    if (o.form === 'report') {
      const lensHeads = headsAt(sheet.width)
      // **Two thirds figure, one third text.** Full width left an essay one paragraph under a map
      // that took the page; a column-wide figure made the essay the page. The split is of the body
      // below the head, and the essay starts at the same height on every lens page.
      const textTop = HEADER_BOTTOM + (sheet.bottom - HEADER_BOTTOM) * FIGURE_SHARE
      // One size for every figure, so the maps compare page to page: the square the tallest caption
      // and key leave room for above the line.
      const figSide = Math.max(
        sheet.width * 0.5,
        Math.min(sheet.width, textTop - HEADER_BOTTOM - Math.max(0, ...lensHeads.map((h) => h.under))),
      )
      const figX = sheet.left + (sheet.width - figSide) / 2
      let tableNo = 0
      lensPlans = lensHeads.map((h) => {
        // Below the line, or below the key if a key ever runs past it — never over it.
        const top = Math.max(textTop, HEADER_BOTTOM + figSide + h.under)
        const blocks = proseBlocks(ESSAYS[h.m].sections, lensVars(o, vars.readerClause))
        const ctx = {
          root: o.treeNow(),
          buckets: o.bucketsFor(h.m),
          views: o.views,
          tangleBands: o.stats.tangleBands,
        }
        const essay = flow(sheet.c, blocks, colW, BODY)
        const regions = (p: number): Region[] =>
          p > 0 ? twoCols(CONTINUED_TOP) : top + 3 * lead(BODY) <= sheet.bottom ? twoCols(top) : []
        /** The section laid out with one allowance of table rows. Numbered as the tables will be if
         *  this is the attempt that is kept. */
        const attempt = (limits: TableLimits | null) => {
          const laid: LensPage[] = pour(essay, regions).map((sl) => ({ slices: sl, tables: [] }))
          const tables = limits
            ? tablesFor(h.m, ctx, limits).map((t, i) => layoutTable(sheet, t, tableNo + 1 + i))
            : []
          if (tables.length) {
            // The tables follow the essay, under its last page balanced into even columns.
            const last = laid[laid.length - 1]
            const lastTop = laid.length === 1 ? top : CONTINUED_TOP
            last.slices = balance(last.slices, lastTop, [sheet.left, col2], sheet.bottom)
            const end = last.slices.length
              ? Math.max(...last.slices.map((sl) => sl.region.top + colHeight(sl.rows)))
              : lastTop
            placeTables(sheet, laid, tables, end)
          }
          return { pages: laid, used: tables.length }
        }
        // **No lens section runs past two pages.** A section is a figure page and one more; a
        // third page is a lens that has stopped being one section in a set. What gives is the
        // tables, in order: examples rows down to three, then a cast's named rows (its count row
        // keeps the total whole), then the examples table, then the breakdown.
        //
        // **Never the type, and never the essay.** Every essay is set at `BODY`: a page whose text
        // is smaller than its neighbour's reads as a different document, and the report is one.
        // The essay is the explanation of the figure, so it is not what gets cut.
        const full: TableLimits = { cast: FULL_CAST, examples: h.m === 'traps' ? TRAPS_MAX : TOP }
        const ladder: (TableLimits | null)[] = [full]
        for (let ex = full.examples - 1; ex >= 3; ex--) ladder.push({ ...full, examples: ex })
        for (let cast = FULL_CAST - 1; cast >= 4; cast--) ladder.push({ cast, examples: 3 })
        ladder.push({ cast: 4, examples: 0 }, null)
        let chosen = attempt(ladder[0])
        for (const limits of ladder.slice(1)) {
          if (chosen.pages.length <= MAX_LENS_PAGES) break
          chosen = attempt(limits)
        }
        tableNo += chosen.used
        return planOf(h, figX, figSide, sheet.left + sheet.width / 2, sheet.width, chosen.pages)
      })
    } else if (!deck) {
      // **A brief is one page a lens, and the map is what gives.** The essay is at the report's
      // `BODY` for the report's reason, so where two sections will not fit under the figure the
      // figure shrinks — one size for every lens, so the maps still compare page to page — down
      // to `BRIEF_FIGURE_MIN` of the width. Past that, paragraphs go from the end.
      const heads = headsAt(sheet.width)
      const rows = heads.map((h) => flow(sheet.c, shortBlocks(h.m), colW, BODY))
      const onePage = (r: Row[], top: number) => pour(r, () => twoCols(top)).length === 1
      const floor = sheet.width * BRIEF_FIGURE_MIN
      let side = Math.min(sheet.width, sheet.bottom - HEADER_BOTTOM - Math.max(0, ...heads.map((h) => h.under)) - 6 * lead(BODY))
      while (side > floor && !heads.every((h, i) => onePage(rows[i], HEADER_BOTTOM + side + h.under))) side -= 6 * U
      side = Math.max(side, floor)
      lensPlans = heads.map((h) => {
        const top = HEADER_BOTTOM + side + h.under
        const blocks = trimToFit(shortBlocks(h.m), (b) => onePage(flow(sheet.c, b, colW, BODY), top))
        const slices = pour(flow(sheet.c, blocks, colW, BODY), () => twoCols(top))[0] ?? []
        return planOf(h, sheet.left + (sheet.width - side) / 2, side, sheet.left + sheet.width / 2, sheet.width, [
          { slices, tables: [] },
        ])
      })
    } else {
      // **A slide is the map, the full height of the body, and the words beside it.** Nothing sits
      // under the map to shorten it: the key and the caption go to the foot of the text column. The
      // words are a presentation's (`deckProse`), at one size for the whole deck — the largest every
      // slide fits at — for the report's reason that a slide set smaller than its neighbour reads
      // as another deck.
      const side = Math.min(sheet.width * 0.5, sheet.bottom - HEADER_BOTTOM)
      const textX = deckText(side)
      const textW = sheet.right - textX
      const heads = headsAt(textW)
      /** Where a slide's key starts, with its caption under it ending at the foot of the column. */
      const keyTopOf = (h: Head) => sheet.bottom - h.caption.length * lead(7.5) - 6 * U - h.keyH
      const regionOf = (h: Head): Region[] => [{ x: textX, top: HEADER_BOTTOM, bottom: keyTopOf(h) - 14 * U }]
      const wordsOf = (m: ColorMode) => proseBlocks(deckProse(m, lensVars(o, vars.readerClause)))
      const fits = (b: Block[], h: Head, size: number) =>
        pour(flow(sheet.c, b, textW, size), () => regionOf(h)).length === 1
      let size = DECK_TEXT.max
      while (size > DECK_TEXT.min && !heads.every((h) => fits(wordsOf(h.m), h, size))) size -= DECK_TEXT.step
      lensPlans = heads.map((h): LensPlan => {
        const blocks = trimToFit(wordsOf(h.m), (b) => fits(b, h, size))
        const slices = pour(flow(sheet.c, blocks, textW, size), () => regionOf(h))[0] ?? []
        const keyTop = keyTopOf(h)
        return {
          m: h.m,
          key: h.key,
          extra: h.extra,
          caption: h.caption,
          figX: sheet.left,
          figSide: side,
          keyTop,
          keyCx: textX,
          keyW: textW,
          keyAlign: 'left',
          capTop: keyTop + h.keyH + 6 * U,
          capX: textX,
          pages: [{ slices, tables: [] }],
        }
      })
    }

    // ── Lay out: the findings. Grouped by place; numbered in the order printed.
    tick('grouping the findings')
    const grouped = groupFindings(items, (it) => ({ path: it.finding.hit.path, kind: it.finding.hit.kind }))
    const intro = introductions(grouped.flatMap((g) => g.items))
    // A deck's findings slides: a full-height map on the left of every one, and the list or grid
    // beside it, above the caption at the foot of that column.
    const dSide = deck ? Math.min(sheet.width * 0.5, sheet.bottom - HEADER_BOTTOM) : 0
    const colBottom = deck ? sheet.bottom - DECK_CAP_H : sheet.bottom
    const textLeft = deck ? deckText(dSide) : sheet.left
    let counter = 0
    const sections: Section[] = grouped.map((g, i) => ({
      letter: letterOf(i),
      root: g.root,
      kind: g.kind,
      entries: g.items.map((it) => entryOf(sheet, it, ++counter, intro, textLeft)),
    }))
    const list = sections.flatMap((s) => s.entries)
    const placeName = (s: Section) => (s.root === '' ? o.slug : s.root)

    // One group at the repo root would draw the same map twice where the groups get maps of their
    // own; a brief draws none, so there the overview is the only map and it stays.
    const showOverview = list.length > 0 && (o.form === 'brief' || !(sections.length === 1 && sections[0].root === ''))
    const beside = deck && showOverview
    const sumLeft = beside ? textLeft : sheet.left
    const summary = setLines(sheet.c, findingSummary(items.length, o.groups), sheet.right - sumLeft, 9)
    const summaryH = summary.length * lead(9) + 10 * U
    const grid = gridOf(sheet, o.groups, sections, sheet.right - sumLeft)
    const ovCaptionH = deck ? DECK_CAP_H : 3 * lead(7.5) + 8 * U
    const ovSide = showOverview ? (deck ? dSide : sheet.width) : 0
    const ovX = deck ? sheet.left : sheet.left + (sheet.width - ovSide) / 2
    const ovTop = deck ? HEADER_BOTTOM : HEADER_BOTTOM + summaryH
    const ovFig = showOverview ? ++figure : 0
    const gridTop = beside ? HEADER_BOTTOM + summaryH : showOverview ? ovTop + ovSide + 6 * U + ovCaptionH : HEADER_BOTTOM + summaryH
    const gridPages: GridRow[][] = []
    const gridBottom = beside ? colBottom : sheet.bottom
    if (list.length) {
      let cur: GridRow[] = []
      let room = gridBottom - gridTop - grid.headH
      if (room < 3 * grid.rowH) {
        gridPages.push([])
        room = gridBottom - CONTINUED_TOP - grid.headH
      }
      for (const r of grid.rows) {
        const h = gridRowH(grid, r)
        // A group's band never sits alone at the foot of a page.
        const need = 'band' in r ? h + grid.rowH : h
        if (need > room && cur.length) {
          gridPages.push(cur)
          cur = []
          room = gridBottom - CONTINUED_TOP - grid.headH
        }
        cur.push(r)
        room -= h
      }
      gridPages.push(cur)
    }
    const ovPages = Math.max(1, gridPages.length)

    // A brief's findings end at the overview; the report and the deck give each group its own map.
    const drawn = o.form === 'brief' ? [] : sections
    const GS = deck ? dSide : sheet.width
    const gCaptionH = deck ? DECK_CAP_H : 4 * lead(7.5) + 8 * U
    const groupFig = drawn.map(() => ++figure)
    const sectionPages = drawn.map((s) => {
      const out: PartSlot[][] = [[]]
      let room = deck ? colBottom - HEADER_BOTTOM : sheet.bottom - (HEADER_BOTTOM + GS + 6 * U + gCaptionH)
      for (const e of s.entries) {
        for (let k = 0; k < partsOf(e); k++) {
          const cur = out[out.length - 1]
          const h = partHeight(e, k)
          if (h > room && (cur.length > 0 || (!deck && out.length === 1))) {
            out.push([{ e, k, cont: k > 0 }])
            room = colBottom - CONTINUED_TOP - h - (k > 0 ? CONT_H : 0)
          } else {
            cur.push({ e, k, cont: false })
            room -= h
          }
        }
      }
      return out
    })

    // ── Number every page.
    const methodCount = methodPages.length
    const contentsIndex = o.form === 'report' ? methodCount : -1
    let at = methodCount + (contentsIndex >= 0 ? 1 : 0)
    const lensStart = new Map<ColorMode, number>()
    for (const p of lensPlans) {
      lensStart.set(p.m, at)
      at += p.pages.length
    }
    const findingsStart = at
    at += ovPages
    const groupStart = new Map<string, number>()
    drawn.forEach((s, i) => {
      groupStart.set(s.letter, at)
      at += sectionPages[i].length
    })
    total = at

    const put = async (index: number, title?: string) => {
      tick(`encoding page ${index + 1}`)
      const jpeg = await sheet.jpeg()
      pages[index] = { jpeg, width: sheet.W, height: sheet.H, pageWidth: paper.w, pageHeight: paper.h, title }
      done += 1
    }

    // ── Draw: cover and methodology.
    const s = o.stats
    const facts = [
      `${s.lines.toLocaleString()} lines`,
      `${s.functions.toLocaleString()} functions in ${s.files.toLocaleString()} files`,
      s.functions + s.files > 0 ? `${s.assessed.toLocaleString()} of ${(s.functions + s.files).toLocaleString()} read` : '',
      `${total} ${deck ? 'slides' : 'pages'}`,
    ]
      .filter(Boolean)
      .join(' · ')
    for (let p = 0; p < methodPages.length; p++) {
      check()
      tick('drawing the methodology')
      sheet.begin()
      if (p === 0) {
        drawCover(sheet, cover, wordmark, facts)
        // A deck's title slide carries the whole repository beside its name, in the window's lens.
        if (deck) {
          pose()
          await drawMap(sheet, svg, style, sheet.right - heroSide, MARGIN * U, heroSide)
        }
      }
      else sheet.continued('Methodology', 'Methodology, continued')
      drawSlices(sheet, methodPages[p])
      sheet.footer(p + 1, total)
      await put(p, p === 0 ? (deck ? 'Title' : 'Abstract and methodology') : undefined)
    }

    // ── Draw: a section per lens.
    for (const plan of lensPlans) {
      check()
      tick(`staging ${MODE_LABEL[plan.m]}`)
      stage(plan.m, Math.round(plan.figSide))
      await rest(o)
      check()
      tick(`drawing ${MODE_LABEL[plan.m]}`)
      svg = mapSvg()
      const start = lensStart.get(plan.m)!
      const family = FAMILIES.find((f) => f.modes.includes(plan.m))?.label ?? ''
      for (let p = 0; p < plan.pages.length; p++) {
        sheet.begin()
        if (p === 0) {
          sheet.header(family, MODE_LABEL[plan.m])
          pose()
          await drawMap(sheet, svg, style, plan.figX, HEADER_BOTTOM, plan.figSide)
          let y = plan.capTop
          for (const line of plan.caption) {
            drawLine(sheet.c, line, plan.capX, y + lead(7.5) * 0.74, 7.5, inks)
            y += lead(7.5)
          }
          drawKey(sheet, svg, plan.key, plan.extra, plan.keyTop, plan.keyCx, plan.keyW, plan.keyAlign)
        } else {
          sheet.continued(family, `${MODE_LABEL[plan.m]}, continued`)
        }
        drawSlices(sheet, plan.pages[p].slices)
        for (const t of plan.pages[p].tables) drawTable(sheet, svg, t)
        sheet.footer(start + p + 1, total)
        await put(start + p, p === 0 ? MODE_LABEL[plan.m] : undefined)
      }
    }

    // ── Draw: the findings overview.
    let ovSpots: (Spot | null)[] = []
    let groupMarks: Mark[] = []
    if (showOverview) {
      check()
      tick('staging the findings overview')
      stage(o.findingsLens, Math.round(ovSide))
      await rest(o)
      check()
      const ovSvg = mapSvg()
      svg = ovSvg
      const tagged = tagsOf(ovSvg)
      const m = userToPage(ovSvg, ovX, ovTop, ovSide)
      ovSpots = list.map((e) => spotOf(e.item, tagged, ovSvg, m))
      groupMarks = sections
        .filter((sec) => sec.root !== '')
        .map((sec) => ({ spot: locate([sec.root], parentOf(sec.root), tagged, ovSvg, m), label: sec.letter, dashed: true }))
    }
    /** The overview map, its marks and its caption. A deck draws it on every overview slide, so the
     *  grid beside it always has the picture it indexes. */
    const drawOverview = async () => {
      pose()
      await drawMap(sheet, svg, style, ovX, ovTop, ovSide, (img) => greyExcept(sheet, img, ovSpots, ovX, ovTop, ovSide))
      drawMarks(sheet, groupMarks, ovX, ovTop, ovSide)
      const unplaced = ovSpots.filter((sp) => sp === null).length
      const n = sections.length
      const where =
        o.form === 'brief'
          ? `Letters mark the ${n} place${n === 1 ? '' : 's'} the findings are grouped by, which the grid lists.`
          : `Letters mark the ${n} group${n === 1 ? '' : 's'} the findings are presented in, each on its own map zoomed to that region.`
      const text = `${MODE_LABEL[o.findingsLens]}. Every wedge holding a finding keeps its colour; the rest of the repository is grey. ${where}${unplaced ? ` ${unplaced} could not be placed at this size.` : ''}`
      const lines = setLines(
        sheet.c,
        [{ text: `Figure ${ovFig}. `, bold: true }, { text, muted: true }],
        deck ? sheet.right - textLeft : sheet.width,
        7.5,
      )
      // Under the map on paper; at the foot of the text column on a slide, where the map is full
      // height.
      const shown = deck ? lines.slice(0, DECK_CAP_LINES) : lines
      let y = deck ? sheet.bottom - shown.length * lead(7.5) : ovTop + ovSide + 6 * U
      for (const line of shown) {
        drawLine(sheet.c, line, deck ? textLeft : sheet.left, y + lead(7.5) * 0.74, 7.5, inks)
        y += lead(7.5)
      }
    }
    for (let p = 0; p < ovPages; p++) {
      check()
      tick('drawing the findings overview')
      sheet.begin()
      let y: number
      if (p === 0) {
        sheet.header('Findings', 'Findings')
        y = HEADER_BOTTOM
        for (const line of summary) {
          drawLine(sheet.c, line, sumLeft, y + lead(9) * 0.74, 9, inks)
          y += lead(9)
        }
        if (showOverview) await drawOverview()
        y = gridTop
      } else {
        sheet.continued('Findings', 'Findings at a glance, continued')
        if (beside) await drawOverview()
        y = CONTINUED_TOP
      }
      const rows = gridPages[p] ?? []
      if (rows.length) {
        y = drawGridHead(sheet, grid, y, sumLeft)
        for (const r of rows) y = drawGridRow(sheet, grid, r, y, placeName, sumLeft)
      }
      sheet.footer(findingsStart + p + 1, total)
      await put(findingsStart + p, p === 0 ? 'Findings' : undefined)
    }

    // ── Draw: each group, on a map zoomed to it.
    for (let i = 0; i < drawn.length; i++) {
      const sec = drawn[i]
      check()
      tick(`zooming to ${placeName(sec)}`)
      stage(o.findingsLens, Math.round(GS), sec.root)
      await rest(o)
      check()
      const gSvg = mapSvg()
      svg = gSvg
      const tagged = tagsOf(gSvg)
      const gx = deck ? sheet.left : sheet.left + (sheet.width - GS) / 2
      const m = userToPage(gSvg, gx, HEADER_BOTTOM, GS)
      const spots = sec.entries.map((e) => spotOf(e.item, tagged, gSvg, m))
      sec.entries.forEach((e, k) => {
        e.pinned = spots[k] !== null
      })
      const files = new Set(sec.entries.map((e) => e.item.finding.hit.path)).size
      const where = sec.root === '' ? 'the whole repository' : sec.kind === 'file' ? 'this file' : 'this directory'
      const coarse = sec.entries.filter((_, k) => spots[k]?.coarse).map((e) => e.n)
      const lost = sec.entries.filter((_, k) => !spots[k]).map((e) => e.n)
      const text = [
        `${MODE_LABEL[o.findingsLens]}, zoomed to ${where}: ${sec.entries.length} finding${sec.entries.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}. Numbered wedges are the findings listed ${deck ? 'beside it' : 'below'}; the rest of this region is grey.`,
        coarse.length
          ? ` ${coarse.join(', ')} ${coarse.length === 1 ? 'is' : 'are'} too small to draw at this zoom and ${coarse.length === 1 ? 'is' : 'are'} marked, dashed, on what holds ${coarse.length === 1 ? 'it' : 'them'}.`
          : '',
        lost.length ? ` ${lost.join(', ')} could not be placed on this map.` : '',
      ].join('')
      const capLines = setLines(
        sheet.c,
        [{ text: `Figure ${groupFig[i]}. `, bold: true }, { text, muted: true }],
        deck ? sheet.right - textLeft : sheet.width,
        7.5,
      )
      /** The group's map, its numbered marks and its caption. A deck draws it on every slide of the
       *  group, beside the entries that carry on. */
      const drawGroup = async () => {
        pose()
        await drawMap(sheet, gSvg, style, gx, HEADER_BOTTOM, GS, (img) => greyExcept(sheet, img, spots, gx, HEADER_BOTTOM, GS))
        drawMarks(
          sheet,
          spots.map((sp, k) => ({ spot: sp, label: String(sec.entries[k].n), dashed: false })),
          gx,
          HEADER_BOTTOM,
          GS,
        )
        const shown = deck ? capLines.slice(0, DECK_CAP_LINES) : capLines
        let y = deck ? sheet.bottom - shown.length * lead(7.5) : HEADER_BOTTOM + GS + 6 * U
        for (const line of shown) {
          drawLine(sheet.c, line, deck ? textLeft : sheet.left, y + lead(7.5) * 0.74, 7.5, inks)
          y += lead(7.5)
        }
      }
      const start = groupStart.get(sec.letter)!
      const pagesHere = sectionPages[i]
      for (let p = 0; p < pagesHere.length; p++) {
        check()
        sheet.begin()
        let y: number
        if (p === 0) {
          sheet.header(`Findings · Group ${sec.letter}`, placeName(sec), sec.root !== '')
          await drawGroup()
          y = deck ? HEADER_BOTTOM : HEADER_BOTTOM + GS + 6 * U + gCaptionH
        } else {
          sheet.continued(`Findings · Group ${sec.letter}`, `${placeName(sec)}, continued`, sec.root !== '')
          if (deck) await drawGroup()
          y = CONTINUED_TOP
        }
        for (const slot of pagesHere[p]) y += drawPart(sheet, gSvg, slot.e, slot.k, y, slot.cont, textLeft)
        sheet.footer(start + p + 1, total)
        await put(start + p, p === 0 ? `Group ${sec.letter} · ${placeName(sec)}` : undefined)
      }
    }

    // ── Draw: contents, last, because it names every other page. Only a report has one.
    if (contentsIndex >= 0) {
      check()
      tick('setting the contents')
      sheet.begin()
      contents(sheet, o, lensStart, findingsStart, list.length, sections, groupStart, placeName)
      sheet.footer(contentsIndex + 1, total)
      await put(contentsIndex, 'Contents')
    }
  } finally {
    o.stage(null)
    if (driving) clock?.release()
  }

  tick('writing the PDF')
  const ready = pages.filter((p): p is PdfPage => p !== null)
  return writePdf(ready, { title: `${stamp} — sanity ${FORM[o.form].noun}`, created: new Date() })
}

function contents(
  sheet: Sheet,
  o: Report,
  lensStart: Map<ColorMode, number>,
  findingsStart: number,
  findings: number,
  sections: Section[],
  groupStart: Map<string, number>,
  placeName: (s: Section) => string,
) {
  const c = sheet.c
  const inks = sheet.inks
  sheet.header('Report', 'Contents')
  let y = HEADER_BOTTOM + 10 * U
  const size = 11

  const row = (label: string, page: string, o2: { indent?: number; mono?: boolean; muted?: boolean } = {}) => {
    const x = sheet.left + (o2.indent ?? 0)
    const pw = sheet.measure(page, size)
    const t = fitText(sheet, label, size, sheet.right - x - pw - 24 * U, { mono: o2.mono, floor: 8 })
    sheet.text(t.text, x, y, { size: t.size, mono: o2.mono, color: o2.muted ? inks.muted : inks.fg })
    if (page) {
      c.fillStyle = inks.border
      for (let dx = x + sheet.measure(t.text, t.size, false, o2.mono) + 8 * U; dx < sheet.right - pw - 8 * U; dx += 4 * U) {
        c.fillRect(dx, y - 1.5 * U, 1 * U, 1 * U)
      }
      sheet.text(page, sheet.right, y, { size })
    }
  }
  const eyebrow = (text: string) => {
    sheet.text(text.toUpperCase(), sheet.left, y, { size: 7.5, bold: true, color: inks.muted })
    y += 16 * U
  }

  row('Abstract and methodology', '1')
  y += 26 * U

  eyebrow('Lenses')
  for (const fam of FAMILIES) {
    sheet.text(fam.label, sheet.left + 10 * U, y, { size: 8.5, bold: true, color: inks.muted })
    y += 15 * U
    for (const m of fam.modes) {
      const at = lensStart.get(m)
      if (at !== undefined) {
        row(MODE_LABEL[m], String(at + 1), { indent: 20 * U })
        y += 16 * U
      } else {
        row(MODE_LABEL[m], '', { indent: 20 * U, muted: true })
        y += 12 * U
        const why = o.locks[m]?.why ?? ''
        for (const line of setLines(c, [{ text: `Not in this report. ${why}`, muted: true, italic: true }], sheet.width - 30 * U, 8)) {
          drawLine(c, line, sheet.left + 20 * U, y, 8, inks)
          y += lead(8)
        }
        y += 6 * U
      }
    }
    y += 6 * U
  }
  y += 10 * U

  eyebrow('Findings')
  row(
    `Overview — ${findings.toLocaleString()} finding${findings === 1 ? '' : 's'} in ${sections.length} group${sections.length === 1 ? '' : 's'}`,
    String(findingsStart + 1),
  )
  y += 17 * U
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    if (y + 32 * U > sheet.bottom && sections.length - i > 1) {
      sheet.text(`and ${sections.length - i} more groups`, sheet.left + 20 * U, y, { size: 9, color: inks.muted })
      break
    }
    row(`${sec.letter}  ${placeName(sec)}  (${sec.entries.length})`, String((groupStart.get(sec.letter) ?? 0) + 1), {
      indent: 20 * U,
      mono: true,
    })
    y += 16 * U
  }
}
