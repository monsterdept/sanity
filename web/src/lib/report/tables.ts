import type { Cell, Table } from '../reportTables'
import { fitText, type Sheet } from './sheet'
import { codeRuns, drawLine, drawLines, setLines, type Line, type Run, type Slice } from './text'
import { CONTINUED_TOP, lead, U } from './units'

/**
 * A lens's tables set and drawn. `reportTables.ts` decides what is in them; this lays them out in
 * a column or across the page, runs them onto further pages with the header repeated, and never
 * splits a row.
 */

const T_SIZE = 8
const T_HEAD = 6.5
const CELL_PAD = 8 * U
const SWATCH = 7 * U
/** The share's figure, right-aligned ahead of its bar — at least this wide; see `barTextOf`. */
const BAR_TEXT = 30 * U

/** The room a bar column's figure takes: `BAR_TEXT`, or its widest figure where that is wider.
 *  **A fixed well cut the one figure that does not fit it**: a one-author Blame table printed its
 *  share as `1···%`, beside the rule that no cell is ever cut. */
function barTextOf(sheet: Sheet, table: Table): number {
  const figures = table.rows.flatMap((r) => r.filter((c) => c.bar).map((c) => sheet.measure(c.text, T_SIZE) + 8 * U))
  return Math.max(BAR_TEXT, ...figures)
}

export interface TableLayout {
  table: Table
  /** Where the table sits and how wide it is: the text width, or one essay column. */
  x: number
  width: number
  caption: Line[]
  cont: Line[]
  xs: number[]
  widths: number[]
  /** A bar column's figure well — see `barTextOf`. */
  barText: number
  heads: Line[]
  rows: { cells: Line[][]; h: number }[]
  headH: number
  note: Line[]
}

/** A run of one table's rows placed on one page. */
export interface TableSlot {
  layout: TableLayout
  from: number
  to: number
  top: number
  first: boolean
  last: boolean
}

/** One page of a lens section: the essay's columns, and the tables under or beside them. */
export interface LensPage {
  slices: Slice[]
  tables: TableSlot[]
}

/** One cell's text on one line, cut from the middle if it has to be — a path's head and tail are
 *  both worth keeping. */
function oneLine(sheet: Sheet, run: Run, width: number, size: number): Line {
  const t = fitText(sheet, run.text, size, Math.max(width, 10 * U), { bold: run.bold, mono: run.mono, floor: size })
  return setLines(sheet.c, [{ ...run, text: t.text }], Number.MAX_SAFE_INTEGER, size)[0] ?? { items: [], w: 0 }
}

/**
 * Column widths for a table set narrower than the page, sized to what the columns hold: every
 * column after the first as wide as its widest cell or header, a bar column wide enough to be a
 * bar, and the first column whatever is left. Null where that leaves the first column too narrow,
 * and the table has to go full width instead.
 *
 * **Weights are for the full width.** Set by weight in one essay column, the number columns came
 * out narrower than their numbers, and `16,021` printed as `16···3` — a number cut in its middle
 * is a different number.
 */
export function columnWidths(sheet: Sheet, table: Table, width: number): number[] | null {
  const head = (i: number) => sheet.measure(table.columns[i].label.toUpperCase(), T_HEAD, true) + CELL_PAD
  const cell = (c: Cell) => sheet.measure(c.text, T_SIZE, false, !!c.mono) + CELL_PAD + (c.swatch ? SWATCH + 4 * U : 0)
  const need = table.columns.map((_, i) => {
    const cells = table.rows.map((r) => r[i]).filter((c): c is Cell => !!c)
    if (cells.some((c) => c.bar)) return Math.max(head(i), barTextOf(sheet, table) + 40 * U)
    return Math.max(head(i), ...cells.map(cell))
  })
  const rest = need.slice(1).reduce((t, w) => t + w, 0)
  const first = width - rest
  // The first column's labels whole too: allowed down to a floor, `no clone in this repo` printed
  // as `no clone ···his repo`, which is the same cut in a label that the rule exists to refuse.
  return first >= need[0] ? [first, ...need.slice(1)] : null
}

/** Caption, continuation line and note, which a grid and a list set alike. */
function tableFrame(sheet: Sheet, table: Table, n: number, width: number) {
  return {
    caption: setLines(sheet.c, [{ text: `Table ${n}. `, bold: true }, { text: table.caption, muted: true }], width, 7.5),
    cont: setLines(sheet.c, [{ text: `Table ${n}, continued.`, bold: true }], width, 7.5),
    note: table.note ? setLines(sheet.c, [{ text: table.note, muted: true, italic: true }], width, 7.5) : [],
  }
}

/**
 * A table whose second column is prose, set as a list instead: the subject on its own line and
 * the sentence under it, full width.
 *
 * **A grid is for values a reader compares down a column.** Traps are a reader's own sentences,
 * four and five lines of them, and in a column they printed as paragraphs wearing a table: every
 * row a stack of wrapped text beside a path, with a rule under it. Down the page instead, the
 * name reads as a heading and the sentence gets the width it was written for.
 */
function layoutList(sheet: Sheet, table: Table, n: number, x: number, width: number): TableLayout {
  const indent = 12 * U
  const rows = table.rows.map((cells) => {
    const head = oneLine(sheet, { text: cells[0].text, mono: cells[0].mono, bold: true }, width, T_SIZE)
    const body = cells
      .slice(1)
      .filter((c) => c && c.text)
      .flatMap((c) => setLines(sheet.c, c.markup ? codeRuns(c.text, { text: c.text }) : [{ text: c.text }], width - indent, T_SIZE))
    return { cells: [[head], body], h: (1 + body.length) * lead(T_SIZE) + 6 * U }
  })
  const { caption, cont, note } = tableFrame(sheet, table, n, width)
  return {
    table,
    x,
    width,
    caption,
    cont,
    xs: [x, x + indent],
    widths: [width, width - indent],
    barText: 0,
    heads: [],
    rows,
    headH: 0,
    note,
  }
}

export function layoutTable(sheet: Sheet, table: Table, n: number, x = sheet.left, width = sheet.width): TableLayout {
  if (table.kind === 'list') return layoutList(sheet, table, n, x, width)
  const weight = table.columns.reduce((t, col) => t + col.weight, 0)
  const widths =
    (width < sheet.width ? columnWidths(sheet, table, width) : null) ??
    table.columns.map((col) => (col.weight / weight) * width)
  const xs: number[] = []
  widths.reduce((at, w) => {
    xs.push(at)
    return at + w
  }, x)
  const heads = table.columns.map((col, i) =>
    oneLine(sheet, { text: col.label.toUpperCase(), bold: true, muted: true }, widths[i] - CELL_PAD, T_HEAD),
  )
  const barText = barTextOf(sheet, table)
  const rows = table.rows.map((cells) => {
    const lines = cells.map((cell, i) => {
      const run: Run = { text: cell.text, mono: cell.mono, muted: cell.muted }
      const room = widths[i] - CELL_PAD - (cell.swatch ? SWATCH + 4 * U : 0)
      if (cell.bar) return [oneLine(sheet, run, barText - 8 * U, T_SIZE)]
      if (table.columns[i]?.wrap) {
        return setLines(sheet.c, cell.markup ? codeRuns(cell.text, run) : [run], room, T_SIZE).slice(0, 10)
      }
      return [oneLine(sheet, run, room, T_SIZE)]
    })
    return { cells: lines, h: Math.max(1, ...lines.map((l) => l.length)) * lead(T_SIZE) + 3 * U }
  })
  const { caption, cont, note } = tableFrame(sheet, table, n, width)
  return {
    table,
    x,
    width,
    caption,
    cont,
    xs,
    widths,
    barText,
    heads,
    rows,
    headH: lead(T_HEAD) + 5 * U,
    note,
  }
}

const tableCapH = (L: TableLayout, first: boolean) => (first ? L.caption.length : L.cont.length) * lead(7.5) + 4 * U
/** The note goes under the last row, so the last row is placed only where both fit: a note left
 *  out of the sum ran into the page's footer. */
const noteOf = (L: TableLayout) => (L.note.length ? 4 * U + L.note.length * lead(7.5) : 0)
/** A whole table, caption to note, set in one piece. */
export const tableHeight = (L: TableLayout) =>
  tableCapH(L, true) + L.headH + L.rows.reduce((t, r) => t + r.h, 0) + noteOf(L)

/** Where a table's rows fall, starting at `top`, with `bottom` for a page: one chunk per page it
 *  runs onto, each saying whether it opens a fresh one. */
function chunksOf(L: TableLayout, top: number, bottom: number) {
  const out: { from: number; to: number; fresh: boolean }[] = []
  const noteH = noteOf(L)
  const tail = (j: number) => (j === L.rows.length - 1 ? noteH : 0)
  let at = 0
  let first = true
  let opens = false
  while (at < L.rows.length) {
    const capH = tableCapH(L, first)
    if (top + capH + L.headH + L.rows[at].h > bottom && top > CONTINUED_TOP + 1) {
      top = CONTINUED_TOP
      opens = true
      continue
    }
    const start = at
    let yy = top + capH + L.headH
    while (at < L.rows.length && (at === start || yy + L.rows[at].h + tail(at) <= bottom)) {
      yy += L.rows[at].h
      at++
    }
    out.push({ from: start, to: at, fresh: opens })
    opens = false
    first = false
    if (at < L.rows.length) {
      top = CONTINUED_TOP
      opens = true
    }
  }
  return out
}

/** **A table's last page is not a stub either.** Filled greedily, styx's 40 trap rows ran three
 *  full pages and a fourth holding four — the same fault the essays and the findings groups had.
 *  The shortest page that still needs no more pages spreads the rows evenly, and where the table
 *  fits on one page nothing moves. */
function evenChunks(L: TableLayout, top: number, bottom: number) {
  const greedy = chunksOf(L, top, bottom)
  if (greedy.length <= 1) return greedy
  let lo = CONTINUED_TOP
  let hi = bottom
  while (hi - lo > 2 * U) {
    const mid = (lo + hi) / 2
    if (chunksOf(L, top, mid).length <= greedy.length) hi = mid
    else lo = mid
  }
  return chunksOf(L, top, hi)
}

/** Tables placed after `startY` on the last page, running onto new pages with the header
 *  repeated, never splitting a row. */
export function placeTables(sheet: Sheet, pages: LensPage[], tables: TableLayout[], startY: number) {
  let page = pages[pages.length - 1]
  let y = startY
  for (const L of tables) {
    y += 16 * U
    let first = true
    for (const ch of evenChunks(L, y, sheet.bottom)) {
      if (ch.fresh) {
        page = { slices: [], tables: [] }
        pages.push(page)
        y = CONTINUED_TOP
      }
      const last = ch.to >= L.rows.length
      page.tables.push({ layout: L, from: ch.from, to: ch.to, top: y, first, last })
      let yy = y + tableCapH(L, first) + L.headH
      for (let j = ch.from; j < ch.to; j++) yy += L.rows[j].h
      y = yy + (last ? noteOf(L) : 0)
      first = false
    }
  }
}

export function drawTable(sheet: Sheet, s: TableSlot) {
  const L = s.layout
  let y = drawLines(sheet.c, s.first ? L.caption : L.cont, L.x, s.top, 7.5, sheet.inks)
  y += 4 * U
  y = L.table.kind === 'list' ? drawListRows(sheet, s, y) : drawGridRows(sheet, s, y)
  if (s.last && L.note.length) {
    y += 4 * U
    drawLines(sheet.c, L.note, L.x, y, 7.5, sheet.inks)
  }
}

function drawListRows(sheet: Sheet, s: TableSlot, top: number): number {
  const c = sheet.c
  const inks = sheet.inks
  const L = s.layout
  let y = top
  for (let r = s.from; r < s.to; r++) {
    const row = L.rows[r]
    const ry = y + lead(T_SIZE) * 0.74
    drawLine(c, row.cells[0][0], L.xs[0], ry, T_SIZE, inks)
    row.cells[1].forEach((line, k) => drawLine(c, line, L.xs[1], ry + (k + 1) * lead(T_SIZE), T_SIZE, inks))
    y += row.h
    if (r < L.rows.length - 1) {
      c.fillStyle = inks.border
      c.fillRect(L.x, y - 3 * U, L.width, Math.max(1, 0.35 * U))
    }
  }
  return y
}

function drawGridRows(sheet: Sheet, s: TableSlot, top: number): number {
  const c = sheet.c
  const inks = sheet.inks
  const L = s.layout
  let y = top
  L.heads.forEach((line, i) => {
    const x = L.table.columns[i].align === 'right' ? L.xs[i] + L.widths[i] - CELL_PAD - line.w : L.xs[i]
    drawLine(c, line, x, y + lead(T_HEAD) * 0.74, T_HEAD, inks)
  })
  y += L.headH
  sheet.rule(y - 2 * U, L.x, L.width)
  for (let r = s.from; r < s.to; r++) {
    const row = L.rows[r]
    const base = y + lead(T_SIZE) * 0.74
    row.cells.forEach((lines, i) => {
      const cell = L.table.rows[r][i]
      const right = L.table.columns[i].align === 'right'
      let x = L.xs[i]
      if (cell.swatch) {
        c.fillStyle = cell.swatch || inks.muted
        c.fillRect(x, base - SWATCH + 1 * U, SWATCH, SWATCH)
        x += SWATCH + 4 * U
      }
      if (cell.bar) {
        const room = L.widths[i] - CELL_PAD - L.barText
        c.fillStyle = cell.bar.fill || inks.muted
        c.fillRect(x + L.barText, base - 6 * U, Math.max(0.8 * U, room * Math.max(0, Math.min(1, cell.bar.share))), 5.5 * U)
      }
      lines.forEach((line, k) => {
        const lx = right
          ? L.xs[i] + L.widths[i] - CELL_PAD - line.w
          : cell.bar
            ? x + L.barText - 6 * U - line.w
            : x
        drawLine(c, line, lx, base + k * lead(T_SIZE), T_SIZE, inks)
      })
    })
    y += row.h
    c.fillStyle = inks.border
    c.fillRect(L.x, y - 1.5 * U, L.width, Math.max(1, 0.35 * U))
  }
  return y
}
