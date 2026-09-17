import type { FindingItem } from '../findings'
import { paintsFromReadings, type ColorMode } from '../colorMode'
import type { LensKey } from '../lensKey'
import { flatKey, type FlatKey } from '../movie'
import { apply, VPath, type Matrix } from '../vector/surface'
import { drawSvg, parseSvg, type El } from '../vector/svg'
import { pill, type Sheet } from './sheet'
import type { MapRender, Report } from './types'
import { BADGE_R, FIGURE_PX, MIN_LABEL_PT, U } from './units'

/**
 * A figure's furniture and the figure: its key, the map's own markup drawn at a size, and the
 * shade and badges that mark findings on it.
 */

/* ── The key ──────────────────────────────────────────────────────────── */

export interface KeyItem {
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

export function keyHeight(sheet: Sheet, key: LensKey | null, extra: KeyItem[], width: number): number {
  const k = keyItems(key, extra)
  return (k.ramp ? 13 * U : 0) + keyRows(sheet, k.items, width).length * 13 * U
}

/** The key, centred on `cx` within `width`. Returns where it ends. */
export function drawKey(
  sheet: Sheet,
  key: LensKey | null,
  extra: KeyItem[],
  top: number,
  cx: number,
  width: number,
  /** `left` starts every row at `cx` instead of centring it there. */
  align: 'center' | 'left' = 'center',
): number {
  const { ramp, items } = keyItems(key, extra)
  let y = top
  if (ramp) {
    drawRamp(sheet, ramp, y, cx, width, align)
    y += 13 * U
  }
  for (const row of keyRows(sheet, items, width)) {
    const x0 = align === 'left' ? cx : cx - row.w / 2
    const base = y + 9 * U
    for (const { it, x } of row.items) drawKeyItem(sheet, it, x0 + x, base)
    y += 13 * U
  }
  return y
}

function drawRamp(sheet: Sheet, ramp: NonNullable<FlatKey['ramp']>, y: number, cx: number, width: number, align: 'center' | 'left') {
  const c = sheet.c
  const inks = sheet.inks
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
    c.fillStyle = f || inks.muted
    c.fillRect(x + i * step, base - h + 1 * U, step, h)
  })
  sheet.text(hi, x + bar + 8 * U, base, { size: 8, color: inks.muted })
}

/** One swatch, hatched where it stands for stale readings, and its label, on `base`. */
function drawKeyItem(sheet: Sheet, it: KeyItem, x: number, base: number) {
  const c = sheet.c
  const inks = sheet.inks
  const box = 7 * U
  let tx = x
  if (it.fill || it.hatch) {
    const by = base - box + 1 * U
    c.save()
    c.globalAlpha = it.alpha ?? 1
    c.fillStyle = it.fill || inks.bg
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

export function pendingItems(counts: { stale: number; unread: number }, m: ColorMode): KeyItem[] {
  const pend = paintsFromReadings(m) ? counts : { stale: 0, unread: 0 }
  return [
    // **Functions, and it says so.** The essay beside it counts functions AND files, so a bare
    // "18 stale" sat next to "24 are stale" and read as a contradiction.
    ...(pend.stale > 0
      ? [{ label: `${pend.stale.toLocaleString()} stale function${pend.stale === 1 ? '' : 's'}`, fill: null, hatch: true }]
      : []),
    ...(pend.unread > 0
      ? [
          {
            label: `${pend.unread.toLocaleString()} unread function${pend.unread === 1 ? '' : 's'}`,
            fill: 'var(--unanalyzed)',
            alpha: 0.4,
          },
        ]
      : []),
  ]
}

/* ── The map ──────────────────────────────────────────────────────────── */

/** Where a square picture of the map puts its user space, `xMidYMid meet`. */
export function userToPage(vb: [number, number, number, number], x: number, y: number, side: number): Matrix {
  const [vx, vy, vw, vh] = vb
  const s = side / Math.max(vw, vh)
  return [s, 0, 0, s, x + (side - vw * s) / 2 - vx * s, y + (side - vh * s) / 2 - vy * s]
}

/** A figure's map, rendered once and parsed once, however many pages draw it. */
export interface Figure {
  render: MapRender
  svg: El
}

export type FigureOf = (mode: ColorMode, root?: string) => Promise<Figure>

/** Figures by lens and root, rendered once in a build.
 *
 *  **Every figure is laid out at one density, whatever size it prints at** (`FIGURE_PX`). A
 *  vector figure scales without being drawn again, so a report, a brief and a deck of one commit
 *  can share every figure — which `Report.map` caches on — and a label too small where a figure
 *  prints small is left off at draw time (`MIN_LABEL_PT`) rather than laid out differently. */
export function figureCache(map: Report['map']): FigureOf {
  const figures = new Map<string, Figure>()
  return async (mode, root = '') => {
    const key = `${mode}|${root}`
    const known = figures.get(key)
    if (known) return known
    const render = await map({ mode, px: FIGURE_PX, root })
    const made: Figure = { render, svg: parseSvg(render.markup) }
    figures.set(key, made)
    return made
  }
}

export function drawMap(
  sheet: Sheet,
  fig: Figure,
  x: number,
  y: number,
  side: number,
  over?: () => void,
  /** Every label set in this ink. **A findings map has no lens colour left to pick label ink
   *  against**: it is grayed and shaded, and the lens's ink choice — white on Clones' pale
   *  neutral — turned into white on light gray, which hid every name on the figure. */
  labelInk?: string,
) {
  // A label that would print under `MIN_LABEL_PT` is left off: the map's label rules are in
  // pixels, and a name that fits at 4pt fits and cannot be read.
  drawSvg(sheet.c, fig.svg, { x, y, side, vars: sheet.env.vars, labelInk, minLabel: MIN_LABEL_PT * U })
  over?.()
}

/** Where one thing is on a drawn map. */
export interface Spot {
  /** The path drawn for it, or for the nearest container that was drawn. */
  d: string
  /** Path space → page pixels. */
  m: Matrix
  /** Where its badge goes, on the page — see `locate`. */
  at: { x: number; y: number }
  /** True when the thing itself was not drawn and this is what holds it. */
  coarse: boolean
  /** Smaller than its badge both ways: the badge marks it, and an outline round it drew as brackets. */
  small: boolean
}

export const parentOf = (p: string) => {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

/** Find a thing among the drawn wedges by any of its own ids, then up its path to the deepest
 *  drawn container — the rule the selection follows, because "in here" is an answer. */
export function locate(own: string[], fallback: string, spots: MapRender['spots'], page: Matrix): Spot | null {
  const tries = [...own]
  for (let p = fallback; p; p = parentOf(p)) if (!tries.includes(p)) tries.push(p)
  for (const id of tries) {
    const sp = spots.get(id)
    if (!sp) continue
    const m = page
    const { a0, a1, r0, r1 } = sp
    const am = (a0 + a1) / 2
    const rm = (r0 + r1) / 2
    const on = (r: number, a = am) => {
      const [x, y] = apply(m, r * Math.sin(a), -r * Math.cos(a))
      return { x, y }
    }
    const inner = on(r0)
    const outer = on(r1)
    const depth = Math.hypot(outer.x - inner.x, outer.y - inner.y)
    const scale = Math.max(r1 > r0 ? depth / (r1 - r0) : 1, 1e-6)
    const span = Math.abs(a1 - a0) * rm * scale
    // **Never on the wedge's name, which the map sets in its middle.** A badge there covered the
    // name it marks: `A⑦p`, `sy⑱h`. A deep wedge takes it by its inner edge. A ring too thin to
    // clear its name that way — a directory's on the overview, where `A` sat on `src` — takes it
    // along the arc, near its start. A wedge too small for either keeps the middle, where the map
    // has no room for a name anyway.
    // A wedge between the two — deep enough for a badge by its inner edge, not deep enough to
    // clear a name that way, and too narrow to go along the arc — still takes the inner edge:
    // `F⑨s` on `Findings` was the middle, and the inner edge overlaps the name less.
    const pt =
      depth >= BADGE_R * 7
        ? on(r0 + (BADGE_R * 1.3) / scale)
        : span >= BADGE_R * 8
          ? on(rm, Math.min(a0, a1) + (BADGE_R * 2.5) / Math.max(rm * scale, 1e-6))
          : depth >= BADGE_R * 3
            ? on(r0 + (BADGE_R * 1.1) / scale)
            : on(rm)
    return {
      d: sp.d,
      m,
      at: { x: pt.x, y: pt.y },
      coarse: !own.includes(id),
      // By area: a sliver twice a badge long and half a badge deep still drew as brackets.
      small: depth * span < 8 * BADGE_R * BADGE_R,
    }
  }
  return null
}

/** **By `finding.key` first, because that is what a function node's id is** — `key_of`, where a
 *  hit's id is spelled `path#name@line` and matches no function at all. */
export function spotOf(item: FindingItem, spots: MapRender['spots'], page: Matrix) {
  const h = item.finding.hit
  return locate([item.finding.key, h.id], h.kind === 'func' ? h.path : parentOf(h.path), spots, page)
}

/** The map grey, and every wedge holding a finding shaded in one colour over it. By compositing,
 *  never by reading pixels back, which WebKit can refuse on a canvas an SVG was drawn into.
 *
 *  **One shade, whatever the lens said there.** The marked wedges used to keep their lens colour,
 *  which left a finding at the dim end of the ramp — a crowded file of plain functions — a step
 *  off the grey, and read as a second kind of finding. The shade is the mark, and the grey
 *  structure shows through it. */
export function highlight(sheet: Sheet, spots: (Spot | null)[], x: number, y: number, side: number) {
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

  const union = new VPath()
  let any = false
  for (const s of spots) {
    if (!s) continue
    union.addPath(new VPath(s.d), s.m)
    any = true
  }
  if (!any) return
  // Multiplied, then coloured, so the shade keeps the map's own lightness rather than covering it:
  // filled over at 80%, it hid the names of the very functions it marked.
  c.save()
  c.clip(union)
  c.globalCompositeOperation = 'multiply'
  c.globalAlpha = 0.45
  c.fillStyle = sheet.inks.accent
  c.fillRect(x, y, side, side)
  c.globalCompositeOperation = 'color'
  c.globalAlpha = 1
  c.fillRect(x, y, side, side)
  c.restore()
}

export interface Mark {
  spot: Spot | null
  label: string
  dashed: boolean
}

/** Outlines and labels over a drawn map. Marks within a label's width of each other share one
 *  label (`4 · 8 · 11`), kept inside the map's square. */
export function drawMarks(sheet: Sheet, marks: Mark[], x: number, y: number, side: number) {
  const c = sheet.c
  const inks = sheet.inks
  for (const mk of marks) {
    const s = mk.spot
    if (!s || s.small) continue
    const p = new VPath()
    p.addPath(new VPath(s.d), s.m)
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

  const r = BADGE_R
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
