import type { FindingGroup } from '../api'
import { blockedByNeed, groupFindings, introductions, rowsCapped, setAsideCount, type FindingItem } from '../findings'
import { drawMap, drawMarks, highlight, locate, parentOf, spotOf, userToPage, type Figure, type Mark, type Spot } from './figure'
import type { Frame, Press } from './frame'
import { drawPart, entryOf, paginateEven, partsIn, wholeEntries, type Entry, type PartSlot } from './entries'
import { drawGridHead, drawGridRow, gridOf, gridPages, letterOf, type Grid, type GridRow, type Section } from './grid'
import { drawLine, drawLines, setLines, type Line, type Run } from './text'
import { CONTINUED_TOP, DECK_GAP, HEADER_BOTTOM, lead, U } from './units'

/**
 * The findings: grouped by place, numbered in the order printed, an overview on one map with the
 * grid of what raised them, and — in a report only — each group on a map zoomed to it.
 *
 * **A deck's findings are one slide.** The grid is a list to read down, which is what a paper is
 * for; a deck that paginated it gave ceph twenty-one group slides and four of grid, and came out
 * longer than the report it summarizes. The slide keeps the map, the count and the letters —
 * what a room can take in — and the brief or the report carries the rest.
 */

/** A report's group map shrinks to keep its whole group on its page, and no further than this
 *  share of the text width. Past it the map takes the page and the entries start on the next. */
const GROUP_FIGURE_MIN = 0.4
/** How many lines a deck's findings caption may run to under its map, and the room kept for them.
 *  Fixed, for the report's reason: what a caption says is known only after its map is staged. */
const DECK_CAP_LINES = 5
const DECK_CAP_H = DECK_CAP_LINES * lead(7.5) + 8 * U
/** The room kept under a paper overview's map for its caption, and under a group's map for its. */
const OVERVIEW_CAPTION_H = 3 * lead(7.5) + 8 * U
const GROUP_CAPTION_H = 4 * lead(7.5) + 8 * U

/** What the list cannot say by being short — the panel's footer, said first. */
function findingSummary(count: number, groups: FindingGroup[]): Run[] {
  const runs: Run[] = []
  const setAside = setAsideCount(groups)
  if (count === 0) {
    runs.push({
      text:
        setAside > 0
          ? `Nothing standing. ${setAside.toLocaleString()} matches ignored.`
          : 'Nothing in this repo matches the rules.',
    })
  } else {
    runs.push(
      { text: `${count.toLocaleString()}${rowsCapped(groups) ? '+' : ''}`, bold: true },
      { text: ` finding${count === 1 ? '' : 's'}, grouped by where they are.` },
    )
    if (rowsCapped(groups)) {
      runs.push({ text: ' Some rules matched more than was sent to this report, so the count is short of what they found.', muted: true })
    }
    if (setAside > 0) runs.push({ text: ` ${setAside.toLocaleString()} matches ignored.`, muted: true })
  }
  for (const b of blockedByNeed(groups)) {
    runs.push({ text: ` ${b.rules.length} of ${groups.length} rules inactive (${b.need}).`, muted: true })
  }
  return runs
}

/** The overview laid out: the summary, the map, and the grid's pages. */
interface Overview {
  summary: Line[]
  /** Where the summary and the grid start: the margin, or a deck slide's text column. */
  left: number
  /** Whether the overview map is drawn. One group at the repo root would draw the same map twice
   *  where the groups get maps of their own; a brief and a deck draw none, so there the overview
   *  is the only map and it stays. */
  show: boolean
  x: number
  top: number
  side: number
  fig: number
  grid: Grid | null
  gridTop: number
  /** The grid's rows, page by page; empty where there is no grid. */
  rows: GridRow[][]
  /** The pages the overview takes. */
  pages: number
}

/** A group laid out, in a report: its figure number, its map's side, and its entries' pages. */
interface GroupPlan {
  section: Section
  fig: number
  side: number
  pages: PartSlot[][]
}

export interface FindingsPlan {
  /** Every finding merged, before grouping — what the summary counts. */
  count: number
  sections: Section[]
  /** Every entry, in the order printed. */
  list: Entry[]
  overview: Overview
  groups: GroupPlan[]
}

/** The findings laid out. Figures are numbered on from `figure`, the last lens figure's number. */
export function layoutFindings(f: Frame, items: FindingItem[], figure: number): FindingsPlan {
  const { o, sheet } = f
  const grouped = groupFindings(items, (it) => ({ path: it.finding.hit.path, kind: it.finding.hit.kind }))
  const intro = introductions(grouped.flatMap((g) => g.items))
  let counter = 0
  const sections: Section[] = grouped.map((g, i) => ({
    letter: letterOf(i),
    root: g.root,
    kind: g.kind,
    name: g.root === '' ? o.slug : g.root,
    entries: g.items.map((it) => entryOf(sheet, it, ++counter, intro)),
  }))
  const list = sections.flatMap((s) => s.entries)
  const show = list.length > 0 && (o.form !== 'report' || !(sections.length === 1 && sections[0].root === ''))
  const overview = (f.deck ? deckOverview : paperOverview)(f, items.length, sections, show, show ? ++figure : 0)
  // A brief's and a deck's findings end at the overview; only the report gives each group its
  // own map and its entries.
  const groups = o.form === 'report' ? sections.map((s) => groupPlan(f, s, ++figure)) : []
  return { count: items.length, sections, list, overview, groups }
}

/** A report's and a brief's overview: the summary, the map full width under it, and the grid. */
function paperOverview(f: Frame, count: number, sections: Section[], show: boolean, fig: number): Overview {
  const { o, sheet } = f
  const summary = setLines(sheet.c, findingSummary(count, o.groups), sheet.right - sheet.left, 9)
  const summaryH = summary.length * lead(9) + 10 * U
  const side = show ? sheet.width : 0
  const top = HEADER_BOTTOM + summaryH
  const grid = gridOf(sheet, o.groups, sections, sheet.right - sheet.left)
  const gridTop = show ? top + side + 6 * U + OVERVIEW_CAPTION_H : HEADER_BOTTOM + summaryH
  const rows = sections.some((s) => s.entries.length > 0)
    ? gridPages(grid, sections, sheet.bottom - gridTop - grid.headH, sheet.bottom - CONTINUED_TOP - grid.headH)
    : []
  return {
    summary,
    left: sheet.left,
    show,
    x: sheet.left + (sheet.width - side) / 2,
    top,
    side,
    fig,
    grid,
    gridTop,
    rows,
    pages: Math.max(1, rows.length),
  }
}

/** A deck's findings slide: the map full height on the left, and the summary and the letters
 *  beside it, above the caption at the foot of that column. */
function deckOverview(f: Frame, count: number, _sections: Section[], show: boolean, fig: number): Overview {
  const { o, sheet } = f
  const side = Math.min(sheet.width * 0.5, sheet.bottom - HEADER_BOTTOM)
  const left = show ? sheet.left + side + DECK_GAP : sheet.left
  const summary = setLines(sheet.c, findingSummary(count, o.groups), sheet.right - left, 9)
  const summaryH = summary.length * lead(9) + 10 * U
  return {
    summary,
    left,
    show,
    x: sheet.left,
    top: HEADER_BOTTOM,
    side: show ? side : 0,
    fig,
    grid: null,
    gridTop: HEADER_BOTTOM + summaryH,
    rows: [],
    pages: 1,
  }
}

/** **A group's entries start under its map only when all of them fit there.** Started there and
 *  carried on, one finding split across two pages and the second was mostly blank. So: the whole
 *  group under the full map; else under a smaller one, down to `GROUP_FIGURE_MIN`; else the map
 *  has its page to itself and the entries start on the next, balanced across the pages they need. */
function groupPlan(f: Frame, s: Section, fig: number): GroupPlan {
  const { sheet } = f
  const parts = partsIn(s.entries)
  const next = sheet.bottom - CONTINUED_TOP
  const total = parts.reduce((t, p) => t + p.h, 0)
  const side = Math.min(sheet.width, sheet.bottom - HEADER_BOTTOM - 6 * U - GROUP_CAPTION_H - total)
  if (side >= sheet.width * GROUP_FIGURE_MIN) {
    return { section: s, fig, side, pages: [parts.map((p): PartSlot => ({ e: p.e, k: p.k, cont: false }))] }
  }
  return { section: s, fig, side: sheet.width, pages: [[], ...paginateEven(wholeEntries(s.entries, parts, next), next, next)] }
}

/* ── Drawn ────────────────────────────────────────────────────────────── */

export async function drawOverview(f: Frame, press: Press, plan: FindingsPlan, start: number) {
  const { o, sheet } = f
  const ov = plan.overview
  let figure: Drawn | null = null
  if (ov.show) {
    press.check()
    press.tick('drawing the findings overview')
    figure = placeOverview(plan, await press.figure(o.findingsLens))
  }
  for (let p = 0; p < ov.pages; p++) {
    press.check()
    press.tick('drawing the findings overview')
    press.begin(start + p)
    let y: number
    const rows = ov.rows[p] ?? []
    if (p === 0) {
      sheet.header('Findings', 'Findings')
      drawLines(sheet.c, ov.summary, ov.left, HEADER_BOTTOM, 9, sheet.inks)
      if (figure) drawOverviewFigure(f, plan, figure)
      y = ov.gridTop
    } else {
      sheet.continued('Findings', 'Findings, continued')
      y = CONTINUED_TOP
    }
    if (rows.length && ov.grid) {
      y = drawGridHead(sheet, ov.grid, y, ov.left)
      for (const r of rows) y = drawGridRow(sheet, ov.grid, r, y, ov.left)
    } else if (f.deck && ov.show) {
      drawLetters(f, plan.sections, y, ov.left)
    }
    press.end(start + p, p === 0 ? 'Findings' : undefined)
  }
}

/** The overview's figure, and where every finding and every group falls on it. */
interface Drawn {
  fig: Figure
  spots: (Spot | null)[]
  marks: Mark[]
}

function placeOverview(plan: FindingsPlan, fig: Figure): Drawn {
  const ov = plan.overview
  const m = userToPage(fig.render.viewBox, ov.x, ov.top, ov.side)
  return {
    fig,
    spots: plan.list.map((e) => spotOf(e.item, fig.render.spots, m)),
    marks: plan.sections
      .filter((sec) => sec.root !== '')
      .map((sec) => ({ spot: locate([sec.root], parentOf(sec.root), fig.render.spots, m), label: sec.letter, dashed: true })),
  }
}

/** The overview map, its marks and its caption: under the map on paper, at the foot of the text
 *  column on a slide, where the map is full height. */
function drawOverviewFigure(f: Frame, plan: FindingsPlan, d: Drawn) {
  const { o, sheet, deck } = f
  const ov = plan.overview
  drawMap(sheet, d.fig, ov.x, ov.top, ov.side, () => highlight(sheet, d.spots, ov.x, ov.top, ov.side), sheet.inks.fg)
  drawMarks(sheet, d.marks, ov.x, ov.top, ov.side)
  const unplaced = d.spots.filter((sp) => sp === null).length
  const n = plan.sections.length
  const where =
    o.form === 'report'
      ? `Letters mark the ${n} group${n === 1 ? '' : 's'} the findings are presented in, each on its own map zoomed to that region.`
      : o.form === 'brief'
        ? `Letters mark the ${n} place${n === 1 ? '' : 's'} the findings are grouped by, which the grid lists.`
        : `Letters mark the ${n} place${n === 1 ? '' : 's'} the findings are grouped by; the brief and the report list them.`
  const text = `Every wedge holding a finding is shaded; the rest of the repository is gray. ${where}${unplaced ? ` ${unplaced} could not be placed at this size.` : ''}`
  if (deck) {
    const lines = setLines(sheet.c, [{ text, muted: true }], sheet.right - ov.left, 7.5).slice(0, DECK_CAP_LINES)
    drawLines(sheet.c, lines, ov.left, sheet.bottom - lines.length * lead(7.5), 7.5, sheet.inks)
  } else {
    const lines = setLines(sheet.c, [{ text: `Figure ${ov.fig}. `, bold: true }, { text, muted: true }], sheet.width, 7.5)
    drawLines(sheet.c, lines, sheet.left, ov.top + ov.side + 6 * U, 7.5, sheet.inks)
  }
}

/** **A deck names the letters its map is marked with.** The grid belongs to the brief and the
 *  report; what a room needs beside the badges is which place each letter is, and how much is
 *  there. Cut where the column runs out, and the remainder is counted rather than dropped in
 *  silence. */
function drawLetters(f: Frame, sections: Section[], top: number, left: number) {
  const { sheet } = f
  const room = sheet.bottom - DECK_CAP_H - 8 * U
  let y = top
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const line = setLines(
      sheet.c,
      [
        { text: `${sec.letter}  `, bold: true },
        { text: sec.name, mono: true },
        { text: `  (${sec.entries.length})`, muted: true },
      ],
      sheet.right - left,
      9,
    )[0]
    const rest = sections.length - i
    if (y + lead(9) > room && rest > 0) {
      sheet.text(`and ${rest} more`, left, y + lead(9) * 0.74, { size: 9, color: sheet.inks.muted })
      break
    }
    if (line) drawLine(sheet.c, line, left, y + lead(9) * 0.74, 9, sheet.inks)
    y += lead(9)
  }
}

/** Each group, on a map zoomed to it, and its entries. */
export async function drawGroups(f: Frame, press: Press, plan: FindingsPlan, starts: Map<string, number>) {
  const { o, sheet } = f
  for (const g of plan.groups) {
    const sec = g.section
    press.check()
    press.tick(`zooming to ${sec.name}`)
    const fig = await press.figure(o.findingsLens, sec.root)
    press.check()
    const gx = sheet.left + (sheet.width - g.side) / 2
    const m = userToPage(fig.render.viewBox, gx, HEADER_BOTTOM, g.side)
    const spots = sec.entries.map((e) => spotOf(e.item, fig.render.spots, m))
    sec.entries.forEach((e, k) => {
      e.pinned = spots[k] !== null
    })
    const start = starts.get(sec.letter)!
    const mono = sec.root !== ''
    for (let p = 0; p < g.pages.length; p++) {
      press.check()
      press.begin(start + p)
      let y: number
      if (p === 0) {
        sheet.header(`Findings · Group ${sec.letter}`, sec.name, mono)
        drawMap(sheet, fig, gx, HEADER_BOTTOM, g.side, () => highlight(sheet, spots, gx, HEADER_BOTTOM, g.side), sheet.inks.fg)
        drawMarks(
          sheet,
          spots.map((sp, k) => ({ spot: sp, label: String(sec.entries[k].n), dashed: false })),
          gx,
          HEADER_BOTTOM,
          g.side,
        )
        drawLines(sheet.c, groupCaption(g, spots), sheet.left, HEADER_BOTTOM + g.side + 6 * U, 7.5, sheet.inks)
        y = HEADER_BOTTOM + g.side + 6 * U + GROUP_CAPTION_H
      } else {
        sheet.continued(`Findings · Group ${sec.letter}`, `${sec.name}, continued`, mono)
        y = CONTINUED_TOP
      }
      for (const slot of g.pages[p]) y += drawPart(sheet, slot.e, slot.k, y, slot.cont)
      press.end(start + p, p === 0 ? `Group ${sec.letter} · ${sec.name}` : undefined)
    }
  }

  /** Where the map is zoomed to, what it holds, and which findings it could only mark coarsely or
   *  not at all — known only once the map is drawn, which is why a caption has a fixed height. */
  function groupCaption(g: GroupPlan, spots: (Spot | null)[]): Line[] {
    const sec = g.section
    const files = new Set(sec.entries.map((e) => e.item.finding.hit.path)).size
    const where = sec.root === '' ? 'the whole repository' : sec.kind === 'file' ? 'this file' : 'this directory'
    const coarse = sec.entries.filter((_, k) => spots[k]?.coarse).map((e) => e.n)
    const lost = sec.entries.filter((_, k) => !spots[k]).map((e) => e.n)
    const text = [
      `Zoomed to ${where}: ${sec.entries.length} finding${sec.entries.length === 1 ? '' : 's'} in ${files} file${files === 1 ? '' : 's'}. Shaded, numbered wedges are the findings listed below; the rest of this region is gray.`,
      coarse.length
        ? ` ${coarse.join(', ')} ${coarse.length === 1 ? 'is' : 'are'} too small to draw at this zoom and ${coarse.length === 1 ? 'is' : 'are'} marked, dashed, on what holds ${coarse.length === 1 ? 'it' : 'them'}.`
        : '',
      lost.length ? ` ${lost.join(', ')} could not be placed on this map.` : '',
    ].join('')
    return setLines(sheet.c, [{ text: `Figure ${g.fig}. `, bold: true }, { text, muted: true }], sheet.width, 7.5)
  }
}
