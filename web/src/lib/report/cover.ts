import { createElement } from 'react'
// The browser build, in Node too: the Node build reaches for `util` at load — see `mapMarkup`.
import { renderToStaticMarkup } from 'react-dom/server.browser'
import { Wordmark } from '../../components/Wordmark'
import { MODE_LABEL } from '../colorMode'
import { METHODOLOGY, type Prose } from '../reportProse'
import { VPath } from '../vector/surface'
import { drawMap } from './figure'
import type { Frame, Press } from './frame'
import { drawSlices, fitText, type Sheet } from './sheet'
import {
  drawLines,
  fillSlots,
  flow,
  inlineRuns,
  pour,
  proseBlocks,
  setLines,
  trimToFit,
  type Block,
  type Line,
  type Slice,
} from './text'
import { FORM, type Form, type Report } from './types'
import { CONTINUED_TOP, DECK_GAP, lead, MARGIN, U } from './units'

/**
 * The cover, and the methodology under it: the report's first pages, a brief's cover and a deck's
 * title slide.
 */

/* ── The cover ────────────────────────────────────────────────────────── */

/** The wordmark's paths, read off the component that draws it in the window — one copy of the
 *  brand's shapes, not a second one typed out here. */
function wordmarkPaths(): string[] {
  const markup = renderToStaticMarkup(createElement(Wordmark, { height: 10 }))
  return [...markup.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1])
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

/** `note` is set under the abstract: a deck's title slide says there, once, what every map's width
 *  and colour are. */
function drawCover(sheet: Sheet, cover: Cover, paths: string[], facts: string, note = '') {
  const c = sheet.c
  const inks = sheet.inks
  const h = 24 * U
  const s = h / 125
  c.save()
  c.translate(sheet.left, cover.markTop)
  c.scale(s, s)
  c.fillStyle = inks.fg
  for (const d of paths) c.fill(new VPath(d))
  c.restore()
  sheet.text('sanity.monster', sheet.left + cover.width, cover.markTop + h, { size: 8, color: inks.muted, align: 'right' })

  sheet.text(cover.eyebrow, sheet.left, cover.eyebrowY, { size: 8, bold: true, color: inks.muted })
  // Aligned by the ink of its first glyph, as every page title is — see `Sheet.bearing`.
  const tx = sheet.left + sheet.bearing(cover.owner || cover.name, cover.titleSize, !cover.owner)
  sheet.text(cover.owner, tx, cover.titleY, { size: cover.titleSize, color: inks.muted })
  sheet.text(cover.name, tx + sheet.measure(cover.owner, cover.titleSize), cover.titleY, {
    size: cover.titleSize,
    bold: true,
  })
  const sub = fitText(sheet, cover.subtitle, 10.5, cover.width, { floor: 8 })
  sheet.text(sub.text, sheet.left, cover.subtitleY, { size: sub.size, color: inks.muted })
  const f = fitText(sheet, facts, 8.5, cover.width, { mono: true, floor: 7 })
  sheet.text(f.text, sheet.left, cover.factsY, { size: f.size, mono: true, color: inks.muted })
  sheet.rule(cover.rule1, sheet.left, cover.width)
  sheet.text('Abstract', sheet.left, cover.abstractHeadY, { size: 10.5, bold: true })
  drawLines(c, cover.abstract, sheet.left, cover.abstractTop, 10, inks)
  sheet.rule(cover.rule2, sheet.left, cover.width)
  if (note) drawLines(c, setLines(c, [{ text: note, muted: true }], cover.width, 9), sheet.left, cover.bodyTop, 9, inks)
}

/** The cover's line of counts: lines, functions, readings, and how many pages there are. */
function factsOf(o: Report, total: number): string {
  const s = o.stats
  return [
    `${s.lines.toLocaleString()} lines`,
    `${s.functions.toLocaleString()} functions in ${s.files.toLocaleString()} files`,
    s.functions + s.files > 0 ? `${s.assessed.toLocaleString()} of ${(s.functions + s.files).toLocaleString()} read` : '',
    `${total} ${o.form === 'deck' ? 'slides' : 'pages'}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ── The methodology ──────────────────────────────────────────────────── */

/** What a brief's cover gives up, in order, when its methodology will not fit — see
 *  `briefMethod`. Positions in `METHODOLOGY.sections`. */
const BRIEF_GIVES: { section: number; paragraphs?: number[] }[] = [
  // 2. Instruments: the four families, every lens of which has a brief page defining it.
  { section: 1, paragraphs: [1, 2, 3, 4] },
  { section: 4 }, // 5. Reproducibility: the commit is stamped on the cover already
  { section: 0, paragraphs: [1] }, // 1. How the map is drawn, which every lens page captions
  { section: 1, paragraphs: [5] }, // 2. Instruments: where readings are kept
]

/**
 * A brief's methodology, held to its cover.
 *
 * **It gives up what the rest of the brief already says, then what a brief needs least — not what
 * comes last.** Cut from the end, it stopped after Activity and lost Assessment, and giving up
 * Findings and the instrument's disclaimers first still left no room for it: the family
 * paragraphs are the long ones, and each repeats a definition a lens page prints. Past this list
 * it does cut from the end.
 */
function briefMethod(vars: Record<string, string>, onCover: (b: Block[]) => Slice[][]): Slice[] {
  const gone = new Set<string>()
  const blocks = () =>
    proseBlocks(
      METHODOLOGY.sections
        .map((sec, i) => (gone.has(`${i}`) ? null : { ...sec, body: sec.body.filter((_, k) => !gone.has(`${i}:${k}`)) }))
        .filter((sec): sec is Prose => sec !== null && sec.body.length > 0),
      vars,
    )
  const fits = () => onCover(blocks()).length === 1
  const keysOf = (give: (typeof BRIEF_GIVES)[number]) =>
    give.paragraphs ? give.paragraphs.map((k) => `${give.section}:${k}`) : [`${give.section}`]
  for (const give of BRIEF_GIVES) {
    if (fits()) break
    for (const k of keysOf(give)) gone.add(k)
  }
  // Then back, last given first, whatever fits again: giving up a long paragraph can leave room
  // for a short one given up before it, and sanity's cover sat a dozen lines short.
  for (const give of [...BRIEF_GIVES].reverse()) {
    const keys = keysOf(give)
    if (!keys.every((k) => gone.has(k))) continue
    for (const k of keys) gone.delete(k)
    if (!fits()) for (const k of keys) gone.add(k)
  }
  return onCover(trimToFit(blocks(), (b) => onCover(b).length === 1))[0] ?? []
}

/** The methodology's pages, the first under the cover. A report's runs on past its cover. A
 *  brief's is held to the cover, which has the room, and gives up paragraphs rather than take a
 *  page; a deck's title slide has none. */
const METHOD_PAGES: Record<Form, (f: Frame, cover: Cover) => Slice[][]> = {
  report: (f, cover) =>
    pour(flow(f.sheet.c, proseBlocks(METHODOLOGY.sections, f.vars), f.colW, 9), (p) =>
      f.twoCols(p === 0 ? cover.bodyTop : CONTINUED_TOP),
    ),
  brief: (f, cover) => [briefMethod(f.vars, (b) => pour(flow(f.sheet.c, b, f.colW, 9), () => f.twoCols(cover.bodyTop)))],
  deck: () => [[]],
}

/* ── Laid out and drawn ───────────────────────────────────────────────── */

export interface Front {
  cover: Cover
  /** The cover's page and any methodology pages after it. */
  pages: Slice[][]
  /** A deck title slide's map: the whole repository, as tall as the slide's margins allow. */
  heroSide: number
}

export function layoutFront(f: Frame): Front {
  const heroSide = (f.sheet.paper.h - 2 * MARGIN) * U
  const cover = coverOf(f.sheet, f.o, f.vars, f.deck ? f.sheet.width - heroSide - DECK_GAP : f.sheet.width)
  return { cover, pages: METHOD_PAGES[f.o.form](f, cover), heroSide }
}

export async function drawFront(f: Frame, press: Press, front: Front) {
  const { o, sheet, deck } = f
  const wordmark = wordmarkPaths()
  const facts = factsOf(o, press.total)
  for (let p = 0; p < front.pages.length; p++) {
    press.check()
    press.tick('drawing the methodology')
    press.begin(p)
    if (p === 0) {
      drawCover(
        sheet,
        front.cover,
        wordmark,
        facts,
        deck
          ? `The map beside this is colored by ${MODE_LABEL[o.heroLens]}. On every map in this deck angular width is lines of code, and on a lens slide color is the lens it names.`
          : '',
      )
      // A deck's title slide carries the whole repository beside its name, in the window's lens.
      if (deck) drawMap(sheet, await press.figure(o.heroLens), sheet.right - front.heroSide, MARGIN * U, front.heroSide)
    } else sheet.continued('Methodology', 'Methodology, continued')
    drawSlices(sheet, front.pages[p])
    press.end(p, p === 0 ? (deck ? 'Title' : 'Abstract and methodology') : undefined)
  }
}
