import { FAMILIES, MODE_LABEL, type ColorMode, type Views } from '../colorMode'
import type { LensKey } from '../lensKey'
import { keyFor } from '../reportInputs'
import { ESSAYS, STORY_HEADING, type Prose } from '../reportProse'
import { FULL_CAST, lensFact, lensStory, tablesFor, TOP, TRAPS_MAX, type Table, type TableContext, type TableLimits } from '../reportTables'
import { drawKey, drawMap, keyHeight, pendingItems, type KeyItem } from './figure'
import type { Frame, Press } from './frame'
import { drawSlices } from './sheet'
import { columnWidths, drawTable, layoutTable, placeTables, tableHeight, type LensPage } from './tables'
import {
  balance,
  colHeight,
  drawLines,
  flow,
  pour,
  proseBlocks,
  setLines,
  trimToFit,
  type Block,
  type Line,
  type Region,
  type Row,
  type Slice,
} from './text'
import type { Form, Report } from './types'
import { BODY, CONTINUED_TOP, DECK_GAP, HEADER_BOTTOM, lead, MARGIN, U } from './units'

/**
 * A section per lens: its figure, its essay and, in a report, its tables.
 *
 * The three forms place the figure and cut the words differently — a report keeps every word and
 * gives up table rows, a brief shrinks the figure, a deck shrinks the type — and all three are
 * drawn the same way, from a `LensPlan`.
 */

/** The sections of a lens essay a brief and a deck keep: what the lens is, and how to read its
 *  map. Instrument, Interpretation and Limitations are the report's. */
const SHORT_SECTIONS = ['Definition', STORY_HEADING, 'Reading the map']
/** The share of a lens page's body the figure takes — map, caption and key. The essay gets the
 *  rest, and continues on the next page. */
const FIGURE_SHARE = 0.66
/** The most pages a lens section may take: its figure page and one more. */
const MAX_LENS_PAGES = 2
/** A brief's figure shrinks to make room for its words, and no further than this share of the
 *  text width. Past it, paragraphs go from the end — see `trimToFit`. */
const BRIEF_FIGURE_MIN = 0.45
/** A deck's text: one size for every slide, the largest in this range they all fit at. A slide is
 *  read from across a room, so the floor is well above the report's `BODY`. */
const DECK_TEXT = { max: 20, min: 11, step: 0.5 }
/** A deck lens slide's text column, which the map beside it takes the rest from. */
const DECK_TEXT_W = 400 * U

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

/** Every lens this report will give a page, in the menu's order. */
export function lensPages(locks: Report['locks']): ColorMode[] {
  return (Object.keys(MODE_LABEL) as ColorMode[]).filter((m) => !locks[m])
}

/** Lenses with nothing to say here beyond one sentence, and that sentence.
 *
 *  **A lens with one value gets no page, for the reason a lens with none does not.** sanity's
 *  Blame was a page, a slide and a brief page each of one colour, with an essay about how to
 *  tell authors apart, to say one person wrote it. The sentence is the whole result, so it is
 *  what the contents page prints. */
export function lensSkips(f: Frame, modes: ColorMode[]): Map<ColorMode, string> {
  const skips = new Map<ColorMode, string>()
  if (f.full && modes.includes('blame')) {
    const absent = String.fromCharCode(0)
    const people = f.bucketsOf('blame').filter((b) => b.lines > 0 && !b.key.startsWith(absent))
    if (people.length === 1) skips.set('blame', `Every function line is attributed to one author, ${people[0].label}.`)
  }
  return skips
}

/** A lens section laid out: where its figure, key and caption go on its first page, and the text
 *  on every page. The three forms place the figure differently and draw it the same way. */
export interface LensPlan {
  m: ColorMode
  key: LensKey | null
  extra: KeyItem[]
  caption: Line[]
  /** How wide the page head is: the page, or a slide's text column. */
  headW: number
  figX: number
  /** The figure's top: under the head on paper, rising beside it on a slide. */
  figY: number
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

/** A lens's figure furniture — key, caption, and the height they take under the map. */
interface Head {
  m: ColorMode
  key: LensKey | null
  extra: KeyItem[]
  caption: Line[]
  keyH: number
  under: number
}

/** Each lens's figure furniture set at `width`. Key, then caption, with the air above, between and
 *  below them. The caption closes the figure: it is what a reader reads after the picture and its
 *  key, the order a paper sets a figure in. */
function headsAt(f: Frame, modes: ColorMode[], width: number): Head[] {
  const { o, sheet, full } = f
  return modes.map((m, i) => {
    const key = full ? keyFor(m, full, o.views, o.slotsFor(m, full)) : null
    const extra = pendingItems(f.pending, m)
    const setting = settingOf(m, o.views)
    // **A caption carries the setting, or it carries nothing.** Under a page titled
    // Predictability it read `Figure 9. Predictability.`, which is the title again in
    // smaller type; where a lens has a setting — Age by newest line, Complexity for its
    // size — that is a fact about the figure the title does not hold. What width and color
    // are is said once, in the methodology: printed under all thirteen figures it was the
    // most repeated sentence in the report.
    //
    // A deck numbers no figures — nobody cites a slide by figure number — so a slide with
    // no setting to state gets no caption at all.
    const named = setting ? `${MODE_LABEL[m]}, ${setting}.` : ''
    const caption = setLines(
      sheet.c,
      f.deck
        ? named
          ? [{ text: named }]
          : []
        : named
          ? [{ text: `Figure ${i + 1}. `, bold: true }, { text: named }]
          : [{ text: `Figure ${i + 1}.`, bold: true }],
      width,
      7.5,
    )
    const keyH = keyHeight(sheet, key, extra, width)
    const under = 6 * U + keyH + 6 * U + caption.length * lead(7.5) + 14 * U
    return { m, key, extra, caption, keyH, under }
  })
}

/** A plan for a page: the figure centred under the head, and the key and caption under it. */
function paperPlan(f: Frame, h: Head, figSide: number, pages: LensPage[]): LensPlan {
  const { sheet } = f
  const keyTop = HEADER_BOTTOM + figSide + 6 * U
  return {
    m: h.m,
    key: h.key,
    extra: h.extra,
    caption: h.caption,
    headW: sheet.width,
    figX: sheet.left + (sheet.width - figSide) / 2,
    figY: HEADER_BOTTOM,
    figSide,
    keyTop,
    keyCx: sheet.left + sheet.width / 2,
    keyW: sheet.width,
    keyAlign: 'center',
    capTop: keyTop + h.keyH + 6 * U,
    capX: sheet.left,
    pages,
  }
}

/** A lens's table data, which its tables and its Results are both read off. */
function ctxOf(f: Frame, m: ColorMode): TableContext {
  return {
    root: f.full,
    buckets: f.bucketsOf(m),
    views: f.o.views,
    tangleBands: f.o.stats.tangleBands,
    mapLines: f.o.stats.lines,
  }
}

/** A lens's essay with its Results after the definition — see `lensStory`. */
function sectionsOf(f: Frame, m: ColorMode): Prose[] {
  const story = lensStory(m, ctxOf(f, m))
  const s = ESSAYS[m].sections
  return story.length ? [s[0], { heading: STORY_HEADING, body: story }, ...s.slice(1)] : s
}

/* ── A report: every word, and tables until the section runs past two pages ── */

function reportPlans(f: Frame, modes: ColorMode[]): LensPlan[] {
  const { sheet } = f
  const heads = headsAt(f, modes, sheet.width)
  // **Two thirds figure, one third text.** Full width left an essay one paragraph under a map
  // that took the page; a column-wide figure made the essay the page. The split is of the body
  // below the head, and the essay starts at the same height on every lens page.
  const textTop = HEADER_BOTTOM + (sheet.bottom - HEADER_BOTTOM) * FIGURE_SHARE
  // One size for every figure, so the maps compare page to page: the square the tallest caption
  // and key leave room for above the line.
  const figSide = Math.max(
    sheet.width * 0.5,
    Math.min(sheet.width, textTop - HEADER_BOTTOM - Math.max(0, ...heads.map((h) => h.under))),
  )
  let tableNo = 0
  return heads.map((h) => {
    // Below the line, or below the key if a key ever runs past it — never over it.
    const top = Math.max(textTop, HEADER_BOTTOM + figSide + h.under)
    const chosen = reportSection(f, h.m, top, tableNo)
    tableNo += chosen.used
    return paperPlan(f, h, figSide, chosen.pages)
  })
}

/** What a section's tables may spend, most first: the first allowance whose section fits is kept.
 *
 *  **No lens section runs past two pages.** A section is a figure page and one more; a third page
 *  is a lens that has stopped being one section in a set. What gives is the tables, in order:
 *  examples rows down to three, then a cast's named rows (its count row keeps the total whole),
 *  then the examples table, then the breakdown.
 *
 *  **Never the type, and never the essay.** Every essay is set at `BODY`: a page whose text is
 *  smaller than its neighbour's reads as a different document, and the report is one. The essay
 *  is the explanation of the figure, so it is not what gets cut. */
function tableLadder(m: ColorMode): (TableLimits | null)[] {
  const whole: TableLimits = { cast: FULL_CAST, examples: m === 'traps' ? TRAPS_MAX : TOP }
  const ladder: (TableLimits | null)[] = [whole]
  // **Except Traps, whose table is the finding.** Every row is a hazard somebody has to know, in
  // the reader's own words, and the limit cut two of sanity's eleven to keep an essay that says
  // the same thing on every repository. A Traps section runs as long as its traps do.
  if (m === 'traps') return ladder
  for (let ex = whole.examples - 1; ex >= 3; ex--) ladder.push({ ...whole, examples: ex })
  for (let cast = FULL_CAST - 1; cast >= 4; cast--) ladder.push({ cast, examples: 3 })
  ladder.push({ cast: 4, examples: 0 }, null)
  return ladder
}

/** A report's lens section: the essay whole from `top`, and as much of its tables as keeps it to
 *  `MAX_LENS_PAGES`. Its tables are numbered from `tableNo + 1`. */
function reportSection(f: Frame, m: ColorMode, top: number, tableNo: number) {
  const { sheet } = f
  const ctx = ctxOf(f, m)
  const essay = flow(sheet.c, proseBlocks(sectionsOf(f, m), f.essayVars), f.colW, BODY)
  const regions = (p: number): Region[] =>
    p > 0 ? f.twoCols(CONTINUED_TOP) : top + 3 * lead(BODY) <= sheet.bottom ? f.twoCols(top) : []
  /** The section laid out with one allowance of table rows. */
  const attempt = (limits: TableLimits | null) => {
    const pages: LensPage[] = pour(essay, regions).map((sl) => ({ slices: sl, tables: [] }))
    const found = limits ? tablesFor(m, ctx, limits) : []
    if (found.length) placeUnderEssay(f, pages, found, pages.length === 1 ? top : CONTINUED_TOP, tableNo)
    return { pages, used: found.length }
  }
  const ladder = tableLadder(m)
  let chosen = attempt(ladder[0])
  for (const limits of ladder.slice(1)) {
    if (chosen.pages.length <= MAX_LENS_PAGES) break
    chosen = attempt(limits)
  }
  return chosen
}

/** A section's tables after its essay, whose last page starts at `lastTop`. */
function placeUnderEssay(f: Frame, pages: LensPage[], found: Table[], lastTop: number, tableNo: number) {
  const { sheet, colW, col2 } = f
  const tables = found.map((t, i) => layoutTable(sheet, t, tableNo + 1 + i))
  const last = pages[pages.length - 1]
  const endOf = (slices: Slice[]) =>
    slices.length ? Math.max(...slices.map((sl) => sl.region.top + colHeight(sl.rows))) : lastTop
  // **The first table goes at the foot of the essay's second column, where it fits.** Both
  // set full width, one under the other, read as slapped together: the breakdown is a
  // handful of rows and a bar, a column's worth. The columns are balanced around it, and
  // whatever follows runs full width under both. Where the page cannot hold it there,
  // every table goes full width, as before.
  const side = layoutTable(sheet, found[0], tableNo + 1, col2, colW)
  // Only with a table to follow it: alone, as on Language and Blame, a table in one column
  // left the other column's half of the page empty for nothing.
  const beside = found.length > 1 && columnWidths(sheet, found[0], colW)
    ? balance(last.slices, lastTop, [sheet.left, col2], sheet.bottom, tableHeight(side) + 12 * U)
    : last.slices
  if (beside !== last.slices) {
    last.slices = beside
    const right = beside.find((sl) => sl.region.x === col2)
    const left = beside.find((sl) => sl.region.x === sheet.left)
    const sideTop = right ? right.region.top + colHeight(right.rows) + 12 * U : lastTop
    last.tables.push({ layout: side, from: 0, to: side.rows.length, top: sideTop, first: true, last: true })
    const end = Math.max(left ? endOf([left]) : lastTop, sideTop + tableHeight(side))
    placeTables(sheet, pages, tables.slice(1), end)
  } else {
    // The tables follow the essay, under its last page balanced into even columns.
    last.slices = balance(last.slices, lastTop, [sheet.left, col2], sheet.bottom)
    placeTables(sheet, pages, tables, endOf(last.slices))
  }
}

/* ── A brief: one page a lens, and the map is what gives ─────────────────── */

/** A brief's and a deck's essay: `SHORT_SECTIONS` of the report's. */
function shortBlocks(f: Frame, m: ColorMode): Block[] {
  return proseBlocks(
    sectionsOf(f, m).filter((sec) => SHORT_SECTIONS.includes(sec.heading)),
    f.essayVars,
  )
}

/** **A brief is one page a lens, and the map is what gives.** The essay is at the report's `BODY`
 *  for the report's reason, so where two sections will not fit under the figure the figure
 *  shrinks — one size for every lens, so the maps still compare page to page — down to
 *  `BRIEF_FIGURE_MIN` of the width. Past that, paragraphs go from the end. */
function briefPlans(f: Frame, modes: ColorMode[]): LensPlan[] {
  const { sheet, colW } = f
  const heads = headsAt(f, modes, sheet.width)
  const rows = heads.map((h) => flow(sheet.c, shortBlocks(f, h.m), colW, BODY))
  const onePage = (r: Row[], top: number) => pour(r, () => f.twoCols(top)).length === 1
  const floor = sheet.width * BRIEF_FIGURE_MIN
  let side = Math.min(sheet.width, sheet.bottom - HEADER_BOTTOM - Math.max(0, ...heads.map((h) => h.under)) - 6 * lead(BODY))
  while (side > floor && !heads.every((h, i) => onePage(rows[i], HEADER_BOTTOM + side + h.under))) side -= 6 * U
  side = Math.max(side, floor)
  return heads.map((h) => {
    const top = HEADER_BOTTOM + side + h.under
    const blocks = trimToFit(shortBlocks(f, h.m), (b) => onePage(flow(sheet.c, b, colW, BODY), top))
    // Balanced, as a report's last essay page is: poured, it left one full column beside
    // "the neutral." on Callers and an empty one on Reach.
    const slices = balance(pour(flow(sheet.c, blocks, colW, BODY), () => f.twoCols(top))[0] ?? [], top, [sheet.left, f.col2], sheet.bottom)
    return paperPlan(f, h, side, [{ slices, tables: [] }])
  })
}

/* ── A deck: the words beside the map, at one size for every slide ─────── */

/**
 * A deck's words for a lens: its two written lines (`Essay.deck`), and what this repository has
 * to say under them — the report's own Results, as many of its sentences as the slide holds.
 *
 * **One fact was a slide's worth of white space.** The report says three things about each lens
 * here and a slide said the first; the room the map does not take is the room these sentences
 * were written for, and `trimToFit` drops the ones that do not fit rather than any being chosen
 * in advance.
 *
 * **A slide is spoken to, not read.** Two whole sections at a slide's size left the words the
 * larger half of every slide and the map beside them the smaller. The first sentence of each was
 * tried next and made teasers — "Three states are drawn." — because an essay's first sentence
 * leans on its second.
 */
function deckProse(m: ColorMode, facts: string[]): Prose[] {
  const d = ESSAYS[m].deck
  return [
    { heading: 'Definition', body: [d.definition] },
    { heading: 'Reading the map', body: [d.reading] },
    ...(facts.length ? [{ heading: STORY_HEADING, body: facts }] : []),
  ]
}

/** **A slide is the map, the full height of the body, and the words beside it.** Nothing sits
 *  under the map to shorten it: the key and the caption go to the foot of the text column. The
 *  words are a presentation's (`deckProse`), at one size for the whole deck — the largest every
 *  slide fits at — for the report's reason that a slide set smaller than its neighbour reads as
 *  another deck.
 *
 *  **Words on the left, map on the right, and the map rises past the head.** With the map on the
 *  left it sat under a head spanning the slide, and the body's height was its limit. The head
 *  spans only the text column now, so the map takes the slide's height from margin to margin, and
 *  the commit stamp moves to the footer. */
function deckPlans(f: Frame, modes: ColorMode[]): LensPlan[] {
  const { sheet } = f
  const side = Math.min(sheet.bottom - MARGIN * U, sheet.width - DECK_TEXT_W - DECK_GAP)
  const figTop = MARGIN * U + (sheet.bottom - MARGIN * U - side) / 2
  const textX = sheet.left
  const textW = sheet.width - side - DECK_GAP
  const heads = headsAt(f, modes, textW)
  /** Where a slide's key starts, with its caption under it ending at the foot of the column. */
  const keyTopOf = (h: Head) => sheet.bottom - h.caption.length * lead(7.5) - 6 * U - h.keyH
  const regionOf = (h: Head): Region[] => [{ x: textX, top: HEADER_BOTTOM, bottom: keyTopOf(h) - 14 * U }]
  const facts = new Map(
    heads.map((h) => {
      const story = lensStory(h.m, ctxOf(f, h.m))
      const one = lensFact(h.m, ctxOf(f, h.m))
      return [h.m, story.length ? story : one ? [one] : []]
    }),
  )
  const wordsOf = (m: ColorMode) => proseBlocks(deckProse(m, facts.get(m) ?? []), f.essayVars)
  const fits = (b: Block[], h: Head, size: number) => pour(flow(sheet.c, b, textW, size), () => regionOf(h)).length === 1
  let size = DECK_TEXT.max
  while (size > DECK_TEXT.min && !heads.every((h) => fits(wordsOf(h.m), h, size))) size -= DECK_TEXT.step
  return heads.map((h): LensPlan => {
    const blocks = trimToFit(wordsOf(h.m), (b) => fits(b, h, size))
    const slices = pour(flow(sheet.c, blocks, textW, size), () => regionOf(h))[0] ?? []
    const keyTop = keyTopOf(h)
    return {
      m: h.m,
      key: h.key,
      extra: h.extra,
      caption: h.caption,
      headW: textW,
      figX: sheet.right - side,
      figY: figTop,
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

/* ── Laid out and drawn ───────────────────────────────────────────────── */

const PLANS: Record<Form, (f: Frame, modes: ColorMode[]) => LensPlan[]> = {
  report: reportPlans,
  brief: briefPlans,
  deck: deckPlans,
}

export function layoutLenses(f: Frame, modes: ColorMode[]): LensPlan[] {
  return PLANS[f.o.form](f, modes)
}

export async function drawLenses(f: Frame, press: Press, plans: LensPlan[], starts: Map<ColorMode, number>) {
  const { sheet } = f
  for (const plan of plans) {
    press.check()
    press.tick(`drawing ${MODE_LABEL[plan.m]}`)
    const fig = await press.figure(plan.m)
    press.check()
    const start = starts.get(plan.m)!
    const family = FAMILIES.find((fam) => fam.modes.includes(plan.m))?.label ?? ''
    for (let p = 0; p < plan.pages.length; p++) {
      press.begin(start + p)
      if (p === 0) {
        sheet.header(family, MODE_LABEL[plan.m], false, { width: plan.headW })
        drawMap(sheet, fig, plan.figX, plan.figY, plan.figSide)
        drawLines(sheet.c, plan.caption, plan.capX, plan.capTop, 7.5, sheet.inks)
        drawKey(sheet, plan.key, plan.extra, plan.keyTop, plan.keyCx, plan.keyW, plan.keyAlign)
      } else {
        sheet.continued(family, `${MODE_LABEL[plan.m]}, continued`)
      }
      drawSlices(sheet, plan.pages[p].slices)
      for (const t of plan.pages[p].tables) drawTable(sheet, t)
      press.end(start + p, p === 0 ? MODE_LABEL[plan.m] : undefined)
    }
  }
}
