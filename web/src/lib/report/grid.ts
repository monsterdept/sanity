import type { FindingGroup } from '../api'
import type { Entry } from './entries'
import { fitText, type Sheet } from './sheet'
import { fontOf } from './text'
import { U } from './units'

/**
 * The findings overview's grid: every finding against every rule that raised it, in bands by the
 * place it was grouped under, and balanced across the pages it needs.
 */

/** A group of findings: one place, lettered, and its entries. */
export interface Section {
  letter: string
  root: string
  kind: 'dir' | 'file'
  /** What the group is called: its path, or the repository at the root. */
  name: string
  entries: Entry[]
}

/** A band with `cont` repeats its group's name at the top of a page the group carries onto. */
export type GridRow = { band: Section; cont?: boolean } | { entry: Entry }

/** Every finding against every rule that raised it — the one place a reader sees that one body
 *  was hit by four rules at once, which the grouping by place spreads across the page. */
export interface Grid {
  cols: { id: string; title: string; count: number }[]
  /** The whole grid's width. */
  width: number
  colW: number
  labelW: number
  titleH: number
  headH: number
  rowH: number
  bandH: number
}

export function letterOf(i: number): string {
  return i < 26 ? String.fromCharCode(65 + i) : letterOf(Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26))
}

export function gridOf(sheet: Sheet, groups: FindingGroup[], sections: Section[], width: number): Grid {
  const all = sections.flatMap((s) => s.entries)
  const cols = groups
    .filter((g) => !g.blocked)
    .map((g) => ({ id: g.id, title: g.title, count: all.filter((e) => e.item.rules.some((r) => r.id === g.id)).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  const colW = Math.min(16 * U, (width * 0.5) / Math.max(1, cols.length))
  // Room for the longest rule title the catalog has. At 130pt "Load-bearing, surprising, and no
  // test found" was cut in its middle, which reads as a broken label rather than a short one.
  const titleH = Math.min(170 * U, Math.max(0, ...cols.map((c) => sheet.measure(c.title, 7))) + 6 * U)
  return {
    cols,
    width,
    colW,
    labelW: width - colW * cols.length - 8 * U,
    titleH,
    headH: titleH + 18 * U,
    rowH: 11.5 * U,
    bandH: 18 * U,
  }
}

const gridRowH = (g: Grid, r: GridRow) => ('band' in r ? g.bandH : g.rowH)

/** The grid's rows on pages, with `first` of room on the first page and `next` on each after, and
 *  no page's rows taller than `cap`. */
function pageGrid(g: Grid, sections: Section[], first: number, next: number, cap: number): GridRow[][] {
  const out: GridRow[][] = []
  let cur: GridRow[] = []
  let room = Math.min(cap, first)
  if (first < 3 * g.rowH) {
    out.push([])
    room = Math.min(cap, next)
  }
  const turn = () => {
    out.push(cur)
    cur = []
    room = Math.min(cap, next)
  }
  // **A group goes whole where a page can hold it.** Balanced row by row, sanity's deck split
  // `web/src/lib` over two slides to even them out. Only a group taller than a page is split,
  // and it names itself again at the top of the page it carries onto, or its rows read as the
  // last group's.
  for (const s of sections) {
    const rows: GridRow[] = [{ band: s }, ...s.entries.map((e): GridRow => ({ entry: e }))]
    const h = g.bandH + s.entries.length * g.rowH
    if (h <= Math.min(cap, next)) {
      if (h > room && cur.length) turn()
      cur.push(...rows)
      room -= h
      continue
    }
    for (const r of rows) {
      const rh = gridRowH(g, r)
      // A group's band never sits alone at the foot of a page.
      const need = 'band' in r ? rh + g.rowH : rh
      if (need > room && cur.length) {
        turn()
        if (!('band' in r)) {
          cur.push({ band: s, cont: true })
          room -= g.bandH
        }
      }
      cur.push(r)
      room -= rh
    }
  }
  out.push(cur)
  return out
}

/** **The grid balanced across the pages it needs**, for the reason a group's entries are: filled
 *  greedily, sanity's deck gave its last overview slide a single row. */
export function gridPages(g: Grid, sections: Section[], first: number, next: number): GridRow[][] {
  const count = pageGrid(g, sections, first, next, Infinity).length
  let lo = g.bandH + g.rowH
  let hi = Math.max(first, next)
  while (hi - lo > 2 * U) {
    const mid = (lo + hi) / 2
    if (pageGrid(g, sections, first, next, mid).length <= count) hi = mid
    else lo = mid
  }
  return pageGrid(g, sections, first, next, hi)
}

export function drawGridHead(sheet: Sheet, g: Grid, top: number, left: number): number {
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

export function drawGridRow(sheet: Sheet, g: Grid, r: GridRow, top: number, left: number): number {
  const c = sheet.c
  const inks = sheet.inks
  const x0 = left + g.labelW + 8 * U
  if ('band' in r) {
    const s = r.band
    c.fillStyle = inks.border
    c.fillRect(left, top + 3 * U, g.width, Math.max(1, 0.5 * U))
    const t = fitText(sheet, `${s.letter}  ${s.name}${r.cont ? ', continued' : ''}`, 8, g.labelW, {
      bold: true,
      mono: true,
      floor: 6,
    })
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
