import { dirOf, fileOf, lensColor, lensName, nameOf } from '../../components/findings/format'
import type { FindingItem } from '../findings'
import { fitText, type Sheet } from './sheet'
import { drawLine, drawLines, setLines, type Line } from './text'
import { lead, U } from './units'

/**
 * A finding as a report's group page lists it: its number, its address, and each rule's sentence
 * under it — set, cut into parts at its rules, and paginated.
 */

export interface Entry {
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

export function entryOf(sheet: Sheet, item: FindingItem, n: number, intro: Map<string, string>): Entry {
  const c = sheet.c
  const inks = sheet.inks
  const width = sheet.right - sheet.left - BADGE
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
        // Full ink: this is what the finding says. Only the rule's background, below, is muted.
        ...(item.says[k] ?? []).map((s) => (s.filled ? { text: s.text, bold: true } : { text: s.text })),
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

export type Part = { e: Entry; k: number; h: number }
export type PartSlot = { e: Entry; k: number; cont: boolean }

/** Every part of every entry, with its height. */
export function partsIn(entries: Entry[]): Part[] {
  return entries.flatMap((e) => Array.from({ length: partsOf(e) }, (_, k) => ({ e, k, h: partHeight(e, k) })))
}

/** Each entry as one unit where it fits in `limit`, part by part where it does not. A finding
 *  split over two pages, the second mostly blank, is only fair when it could not have gone whole. */
export function wholeEntries(entries: Entry[], parts: Part[], limit: number): Part[][] {
  return entries.flatMap((e) => {
    const mine = parts.filter((p) => p.e === e)
    return mine.reduce((t, p) => t + p.h, 0) <= limit ? [mine] : mine.map((p) => [p])
  })
}

/** `paginate`, over the shortest columns that still need no more pages. **Balanced across the
 *  pages it needs, and a finding kept whole**: filled greedily, a group of six ran 3 / 2 / 1 and
 *  its last page held one entry, and a group whose last page carried one finding under a running
 *  head printed two lines and a footer. */
export function paginateEven(units: Part[][], first: number, next: number): PartSlot[][] {
  const count = paginate(units, first, next).length
  let lo = Math.max(0, ...units.map((u) => u.reduce((t, p) => t + p.h, 0) + (u[0].k > 0 ? CONT_H : 0)))
  let hi = first
  while (hi - lo > 2 * U) {
    const mid = (lo + hi) / 2
    if (paginate(units, mid, Math.min(mid, next)).length <= count) hi = mid
    else lo = mid
  }
  return paginate(units, hi, Math.min(hi, next))
}

/** Units poured onto pages: `first` of room on the first page, `next` on each after. A unit is the
 *  parts that move together. One that opens a page partway through its entry carries the
 *  `continued` line, and pays for it. */
function paginate(units: Part[][], first: number, next: number): PartSlot[][] {
  const out: PartSlot[][] = [[]]
  let room = first
  for (const u of units) {
    const h = u.reduce((t, p) => t + p.h, 0)
    const cur = out[out.length - 1]
    const slots = u.map((p): PartSlot => ({ e: p.e, k: p.k, cont: false }))
    if (h > room && cur.length > 0) {
      slots[0].cont = u[0].k > 0
      out.push(slots)
      room = next - h - (u[0].k > 0 ? CONT_H : 0)
    } else {
      cur.push(...slots)
      room -= h
    }
  }
  return out
}

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

export function drawPart(sheet: Sheet, e: Entry, k: number, top: number, cont: boolean): number {
  const c = sheet.c
  const inks = sheet.inks
  const x = sheet.left + BADGE
  let y = top

  if (cont) {
    const t = fitText(sheet, `${e.n}  ${e.addr}, continued`, 7.5, sheet.right - x, { floor: 6 })
    sheet.text(t.text, x, y + lead(7.5) * 0.74, { size: t.size, color: inks.muted })
    y += CONT_H
  }
  if (k === 0) y = drawEntryHead(sheet, e, x, y)
  const rule = e.rules[k]
  if (rule) {
    y = drawLines(c, rule.title, x, y, SIZE.title, inks)
    y = drawLines(c, rule.says, x, y, SIZE.say, inks)
    y += 4 * U
  }
  if (k === partsOf(e) - 1) y = drawLensChips(sheet, e, x, y)
  return y - top
}

/** The numbered badge, filled where the map marks it, the address, and the rule in its lenses'
 *  colours. Returns where it ends. */
function drawEntryHead(sheet: Sheet, e: Entry, x: number, top: number): number {
  const c = sheet.c
  const inks = sheet.inks
  let y = top + 8 * U
  const r = 7 * U
  const bx = sheet.left + r
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
    c.fillStyle = lensColor(id) || inks.border
    c.fillRect(x + i * seg, y, seg, 1.6 * U)
  })
  return y + 5.6 * U
}

/** The lenses an entry's rules read, as dots and names, and the rule under the entry. */
function drawLensChips(sheet: Sheet, e: Entry, x: number, top: number): number {
  const c = sheet.c
  const inks = sheet.inks
  let cx = x
  const base = top + 8 * U
  for (const id of e.lenses) {
    c.fillStyle = lensColor(id) || inks.muted
    c.beginPath()
    c.arc(cx + 2 * U, base - 2.4 * U, 2 * U, 0, Math.PI * 2)
    c.fill()
    const label = lensName(id).toUpperCase()
    sheet.text(label, cx + 6 * U, base, { size: 6.5, bold: true, color: inks.muted })
    cx += 6 * U + sheet.measure(label, 6.5, true) + 10 * U
  }
  const y = top + 22 * U
  c.fillStyle = inks.border
  c.fillRect(sheet.left, y - 1 * U, sheet.right - sheet.left, Math.max(1, 0.5 * U))
  return y
}
