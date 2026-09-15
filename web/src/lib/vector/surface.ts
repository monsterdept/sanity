import { parseColor, type Rgba, type Vars } from './color'
import { fmt, type PdfImage, type PdfPage } from './doc'
import type { Face } from './fonts'

/**
 * A drawing surface with the canvas's shape that writes vector PDF.
 *
 * **The report's layout code drew on a canvas, and it still does — just not on a raster one.**
 * `report.ts` sets type, rules, keys, tables and marks through the part of
 * `CanvasRenderingContext2D` it uses, and this implements that part over a PDF page, so the layout
 * that was tuned sheet by sheet is the layout that is written. Units are the canvas's: pixels, y
 * down, at `scale` pixels to the point.
 *
 * **Paths are transformed as they are built**, which is the canvas's rule and not PDF's: a canvas
 * applies the transform current when a point is added, where PDF applies the one current when the
 * path is painted. Each point goes to page space on the way in, and the page's own transform stays
 * the identity.
 */

export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

/** `m` after `n`: a point goes through `n` first. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]
}

/** How much a matrix scales lengths, for line widths under a transform. */
const lengthScale = (m: Matrix) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))

type Seg = { op: 'M' | 'L'; x: number; y: number } | { op: 'C'; pts: number[] } | { op: 'Z' }

/**
 * `Path2D`, kept as segments in its own coordinates. Arcs become cubic Béziers on the way in, so
 * the only operators left are move, line, curve and close.
 */
export class VPath {
  readonly segs: Seg[] = []
  private cx = 0
  private cy = 0
  private sx = 0
  private sy = 0

  constructor(d?: string) {
    if (d) parseSvgPath(d, this)
  }

  moveTo(x: number, y: number) {
    this.segs.push({ op: 'M', x, y })
    this.cx = this.sx = x
    this.cy = this.sy = y
  }

  lineTo(x: number, y: number) {
    if (!this.segs.length) return this.moveTo(x, y)
    this.segs.push({ op: 'L', x, y })
    this.cx = x
    this.cy = y
  }

  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    if (!this.segs.length) this.moveTo(x1, y1)
    this.segs.push({ op: 'C', pts: [x1, y1, x2, y2, x, y] })
    this.cx = x
    this.cy = y
  }

  quadraticCurveTo(qx: number, qy: number, x: number, y: number) {
    const { cx, cy } = this
    this.bezierCurveTo(cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y)
  }

  closePath() {
    if (!this.segs.length) return
    this.segs.push({ op: 'Z' })
    this.cx = this.sx
    this.cy = this.sy
  }

  rect(x: number, y: number, w: number, h: number) {
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w, y + h)
    this.lineTo(x, y + h)
    this.closePath()
  }

  /** The canvas's `arc`, clockwise unless `ccw`, joined to the current point by a line. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    let sweep = a1 - a0
    const full = Math.PI * 2
    if (!ccw && sweep < 0) sweep = (sweep % full) + full
    if (ccw && sweep > 0) sweep = (sweep % full) - full
    if (Math.abs(a1 - a0) >= full) sweep = ccw ? -full : full
    const sx = x + r * Math.cos(a0)
    const sy = y + r * Math.sin(a0)
    if (this.segs.length) this.lineTo(sx, sy)
    else this.moveTo(sx, sy)
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)))
    const step = sweep / n
    const k = (4 / 3) * Math.tan(step / 4)
    let a = a0
    for (let i = 0; i < n; i++) {
      const b = a + step
      const [c0, s0, c1, s1] = [Math.cos(a), Math.sin(a), Math.cos(b), Math.sin(b)]
      this.bezierCurveTo(x + r * (c0 - k * s0), y + r * (s0 + k * c0), x + r * (c1 + k * s1), y + r * (s1 - k * c1), x + r * c1, y + r * s1)
      a = b
    }
  }

  /** The canvas's `arcTo`: a line toward (x1, y1), turned by an arc of radius `r` toward (x2, y2). */
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    if (!this.segs.length) this.moveTo(x1, y1)
    const { cx: x0, cy: y0 } = this
    const v1x = x0 - x1
    const v1y = y0 - y1
    const v2x = x2 - x1
    const v2y = y2 - y1
    const l1 = Math.hypot(v1x, v1y)
    const l2 = Math.hypot(v2x, v2y)
    const cross = v1x * v2y - v1y * v2x
    if (r === 0 || l1 === 0 || l2 === 0 || Math.abs(cross) < 1e-9) return this.lineTo(x1, y1)
    const angle = Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2))))
    const t = r / Math.tan(angle / 2)
    const p1x = x1 + (v1x / l1) * t
    const p1y = y1 + (v1y / l1) * t
    const p2x = x1 + (v2x / l2) * t
    const p2y = y1 + (v2y / l2) * t
    const d = r / Math.sin(angle / 2)
    const bx = v1x / l1 + v2x / l2
    const by = v1y / l1 + v2y / l2
    const bl = Math.hypot(bx, by) || 1
    const ccx = x1 + (bx / bl) * d
    const ccy = y1 + (by / bl) * d
    this.lineTo(p1x, p1y)
    const a0 = Math.atan2(p1y - ccy, p1x - ccx)
    const a1 = Math.atan2(p2y - ccy, p2x - ccx)
    this.arc(ccx, ccy, r, a0, a1, cross > 0)
  }

  /** Another path's segments, through `m` if given. */
  addPath(p: VPath, m: Matrix = IDENTITY) {
    for (const s of p.segs) {
      if (s.op === 'Z') this.segs.push(s)
      else if (s.op === 'C') {
        const q = s.pts
        const [a, b] = apply(m, q[0], q[1])
        const [c, d] = apply(m, q[2], q[3])
        const [e, f] = apply(m, q[4], q[5])
        this.segs.push({ op: 'C', pts: [a, b, c, d, e, f] })
      } else {
        const [x, y] = apply(m, s.x, s.y)
        this.segs.push({ op: s.op, x, y })
      }
    }
  }

  /** Every segment through `m`, as a new path. */
  transformed(m: Matrix): VPath {
    const out = new VPath()
    out.addPath(this, m)
    return out
  }

  bounds(): [number, number, number, number] {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    const see = (x: number, y: number) => {
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
    }
    for (const s of this.segs) {
      if (s.op === 'C') for (let i = 0; i < 6; i += 2) see(s.pts[i], s.pts[i + 1])
      else if (s.op !== 'Z') see(s.x, s.y)
    }
    return [x0, y0, x1, y1]
  }
}

/** SVG path data into a `VPath`: every command, absolute and relative, arcs included. */
export function parseSvgPath(d: string, p: VPath) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let lastC: [number, number] | null = null
  let lastQ: [number, number] | null = null
  const num = () => parseFloat(tokens[i++])
  const more = () => i < tokens.length && !/[a-zA-Z]/.test(tokens[i])
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (C) {
      case 'M': {
        x = ox + num()
        y = oy + num()
        p.moveTo(x, y)
        sx = x
        sy = y
        cmd = rel ? 'l' : 'L'
        lastC = lastQ = null
        break
      }
      case 'L':
        x = ox + num()
        y = oy + num()
        p.lineTo(x, y)
        lastC = lastQ = null
        break
      case 'H':
        x = ox + num()
        p.lineTo(x, y)
        lastC = lastQ = null
        break
      case 'V':
        y = oy + num()
        p.lineTo(x, y)
        lastC = lastQ = null
        break
      case 'C': {
        const [x1, y1, x2, y2] = [ox + num(), oy + num(), ox + num(), oy + num()]
        x = ox + num()
        y = oy + num()
        p.bezierCurveTo(x1, y1, x2, y2, x, y)
        lastC = [x2, y2]
        lastQ = null
        break
      }
      case 'S': {
        const [x1, y1] = lastC ? [2 * x - lastC[0], 2 * y - lastC[1]] : [x, y]
        const [x2, y2] = [ox + num(), oy + num()]
        x = ox + num()
        y = oy + num()
        p.bezierCurveTo(x1, y1, x2, y2, x, y)
        lastC = [x2, y2]
        lastQ = null
        break
      }
      case 'Q': {
        const [qx, qy]: [number, number] = [ox + num(), oy + num()]
        x = ox + num()
        y = oy + num()
        p.quadraticCurveTo(qx, qy, x, y)
        lastQ = [qx, qy]
        lastC = null
        break
      }
      case 'T': {
        const qx: number = lastQ ? 2 * x - lastQ[0] : x
        const qy: number = lastQ ? 2 * y - lastQ[1] : y
        x = ox + num()
        y = oy + num()
        p.quadraticCurveTo(qx, qy, x, y)
        lastQ = [qx, qy]
        lastC = null
        break
      }
      case 'A': {
        const [rx, ry, rot, large, sweep] = [num(), num(), num(), num(), num()]
        const ex = ox + num()
        const ey = oy + num()
        svgArc(p, x, y, rx, ry, rot, large !== 0, sweep !== 0, ex, ey)
        x = ex
        y = ey
        lastC = lastQ = null
        break
      }
      case 'Z':
        p.closePath()
        x = sx
        y = sy
        lastC = lastQ = null
        break
      default:
        i++
    }
    if (C === 'Z' && more()) cmd = rel ? 'l' : 'L'
  }
}

/** An SVG elliptical arc as Béziers, by the endpoint-to-center conversion in SVG's appendix. */
function svgArc(p: VPath, x1: number, y1: number, rx: number, ry: number, rotDeg: number, large: boolean, sweep: boolean, x2: number, y2: number) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return p.lineTo(x2, y2)
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const phi = (rotDeg * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cos * dx + sin * dy
  const y1p = -sin * dx + cos * dy
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
  const coef = (large !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * y1p) / ry
  const cyp = (-coef * ry * x1p) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dt > 0) dt -= Math.PI * 2
  if (sweep && dt < 0) dt += Math.PI * 2
  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)))
  const step = dt / n
  const k = (4 / 3) * Math.tan(step / 4)
  const at = (t: number): [number, number, number, number] => {
    const ex = rx * Math.cos(t)
    const ey = ry * Math.sin(t)
    const tx = -rx * Math.sin(t)
    const ty = ry * Math.cos(t)
    return [cx + cos * ex - sin * ey, cy + sin * ex + cos * ey, cos * tx - sin * ty, sin * tx + cos * ty]
  }
  let t = t1
  for (let i = 0; i < n; i++) {
    const [ax, ay, adx, ady] = at(t)
    const [bx, by, bdx, bdy] = at(t + step)
    p.bezierCurveTo(ax + k * adx, ay + k * ady, bx - k * bdx, by - k * bdy, bx, by)
    t += step
  }
}

/* ── The surface ──────────────────────────────────────────────────────── */

/** The four faces a page sets in, by what a run asks for. */
export interface FontSet {
  sans: Face
  sansBold: Face
  mono: Face
  monoBold: Face
}

interface State {
  ctm: Matrix
  fill: string
  stroke: string
  lineWidth: number
  alpha: number
  blend: string
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  dash: number[]
}

const BLEND: Record<string, string> = {
  'source-over': 'Normal',
  multiply: 'Multiply',
  screen: 'Screen',
  overlay: 'Overlay',
  darken: 'Darken',
  lighten: 'Lighten',
  'color-dodge': 'ColorDodge',
  'color-burn': 'ColorBurn',
  'hard-light': 'HardLight',
  'soft-light': 'SoftLight',
  difference: 'Difference',
  exclusion: 'Exclusion',
  hue: 'Hue',
  saturation: 'Saturation',
  color: 'Color',
  luminosity: 'Luminosity',
}

/** A parsed `font` string: which face, and the size in pixels. */
export interface FontSpec {
  face: Face
  size: number
  italic: boolean
}

export class Surface {
  private s: State
  private readonly stack: State[] = []
  private path = new VPath()
  /** Page pixels → page points, y flipped. */
  private readonly device: Matrix

  constructor(
    readonly page: PdfPage,
    readonly fonts: FontSet,
    readonly vars: Vars,
    /** Canvas pixels per PDF point. */
    readonly pxPerPt: number,
  ) {
    this.device = [1 / pxPerPt, 0, 0, -1 / pxPerPt, 0, page.height]
    this.s = {
      ctm: IDENTITY,
      fill: '#000',
      stroke: '#000',
      lineWidth: 1,
      alpha: 1,
      blend: 'source-over',
      font: `400 ${10 * pxPerPt}px "LINE Seed JP"`,
      textAlign: 'left',
      textBaseline: 'alphabetic',
      dash: [],
    }
  }

  /* canvas properties */
  get fillStyle() { return this.s.fill }
  set fillStyle(v: string) { this.s.fill = v }
  get strokeStyle() { return this.s.stroke }
  set strokeStyle(v: string) { this.s.stroke = v }
  get lineWidth() { return this.s.lineWidth }
  set lineWidth(v: number) { this.s.lineWidth = v }
  get globalAlpha() { return this.s.alpha }
  set globalAlpha(v: number) { this.s.alpha = v }
  get globalCompositeOperation() { return this.s.blend }
  set globalCompositeOperation(v: string) { this.s.blend = v }
  get font() { return this.s.font }
  set font(v: string) { this.s.font = v }
  get textAlign() { return this.s.textAlign }
  set textAlign(v: CanvasTextAlign) { this.s.textAlign = v }
  get textBaseline() { return this.s.textBaseline }
  set textBaseline(v: CanvasTextBaseline) { this.s.textBaseline = v }

  save() {
    this.stack.push({ ...this.s, dash: [...this.s.dash] })
    this.page.ops.push('q')
  }

  restore() {
    const prev = this.stack.pop()
    if (!prev) return
    this.s = prev
    this.page.ops.push('Q')
  }

  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.s.ctm = [a, b, c, d, e, f]
  }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) {
    this.s.ctm = multiply(this.s.ctm, [a, b, c, d, e, f])
  }
  translate(x: number, y: number) {
    this.s.ctm = multiply(this.s.ctm, [1, 0, 0, 1, x, y])
  }
  scale(x: number, y: number) {
    this.s.ctm = multiply(this.s.ctm, [x, 0, 0, y, 0, 0])
  }
  rotate(a: number) {
    const c = Math.cos(a)
    const s = Math.sin(a)
    this.s.ctm = multiply(this.s.ctm, [c, s, -s, c, 0, 0])
  }
  getTransform(): Matrix {
    return [...this.s.ctm] as Matrix
  }
  setLineDash(d: number[]) {
    this.s.dash = [...d]
  }

  /* the current path, built in page pixels */
  beginPath() {
    this.path = new VPath()
  }
  private at(x: number, y: number) {
    return apply(this.s.ctm, x, y)
  }
  moveTo(x: number, y: number) {
    this.path.moveTo(...this.at(x, y))
  }
  lineTo(x: number, y: number) {
    this.path.lineTo(...this.at(x, y))
  }
  closePath() {
    this.path.closePath()
  }
  rect(x: number, y: number, w: number, h: number) {
    const p = new VPath()
    p.rect(x, y, w, h)
    this.path.addPath(p, this.s.ctm)
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    const p = new VPath()
    p.arc(x, y, r, a0, a1, ccw)
    this.appendJoined(p)
  }
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    // Built in user space from the current point, which has to be taken back out of page space.
    const p = new VPath()
    const last = this.lastPoint()
    if (last) {
      const [ux, uy] = apply(invert(this.s.ctm), last[0], last[1])
      p.moveTo(ux, uy)
    }
    p.arcTo(x1, y1, x2, y2, r)
    this.appendJoined(p, !!last)
  }
  bezierCurveTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) {
    this.path.bezierCurveTo(...this.at(x1, y1), ...this.at(x2, y2), ...this.at(x, y))
  }

  private lastPoint(): [number, number] | null {
    for (let i = this.path.segs.length - 1; i >= 0; i--) {
      const s = this.path.segs[i]
      if (s.op === 'C') return [s.pts[4], s.pts[5]]
      if (s.op === 'M' || s.op === 'L') return [s.x, s.y]
    }
    return null
  }

  /** A sub-path joined onto the current one: its leading move becomes a line where a path exists. */
  private appendJoined(p: VPath, skipLeadingMove = false) {
    const t = p.transformed(this.s.ctm)
    t.segs.forEach((seg, i) => {
      if (i === 0 && seg.op === 'M') {
        if (skipLeadingMove) return
        if (this.path.segs.length) this.path.lineTo(seg.x, seg.y)
        else this.path.moveTo(seg.x, seg.y)
        return
      }
      this.path.segs.push(seg)
    })
  }

  /* painting */
  private emitPath(p: VPath) {
    const out: string[] = []
    const pt = (x: number, y: number) => {
      const [a, b] = apply(this.device, x, y)
      return `${fmt(a)} ${fmt(b)}`
    }
    for (const s of p.segs) {
      if (s.op === 'M') out.push(`${pt(s.x, s.y)} m`)
      else if (s.op === 'L') out.push(`${pt(s.x, s.y)} l`)
      else if (s.op === 'C') out.push(`${pt(s.pts[0], s.pts[1])} ${pt(s.pts[2], s.pts[3])} ${pt(s.pts[4], s.pts[5])} c`)
      else out.push('h')
    }
    this.page.ops.push(out.join(' '))
  }

  /** The graphics state for a paint in `color` — alpha and blend mode as a named state. */
  private paintState(color: Rgba, stroke: boolean): string {
    const a = color.a * this.s.alpha
    const gs = this.page.state({ ca: fmt(a), CA: fmt(a), BM: `/${BLEND[this.s.blend] ?? 'Normal'}` })
    const rgb = `${fmt(color.r)} ${fmt(color.g)} ${fmt(color.b)}`
    return `/${gs} gs ${rgb} ${stroke ? 'RG' : 'rg'}`
  }

  private color(v: string): Rgba {
    return parseColor(v, this.vars)
  }

  /** A pattern fill for `url(#…)` — set by the SVG translator. */
  patternFill: ((name: string) => string | null) | null = null

  fill(pathOrRule?: VPath | CanvasFillRule, rule?: CanvasFillRule) {
    const p = pathOrRule instanceof VPath ? pathOrRule.transformed(this.s.ctm) : this.path
    const r = (pathOrRule instanceof VPath ? rule : pathOrRule) ?? 'nonzero'
    const pat = /^url\(#(.+)\)$/.exec(this.s.fill)
    if (pat) {
      const name = this.patternFill?.(pat[1])
      if (!name) return
      const gs = this.page.state({ ca: fmt(this.s.alpha), CA: fmt(this.s.alpha), BM: `/${BLEND[this.s.blend] ?? 'Normal'}` })
      this.page.ops.push(`q /${gs} gs /Pattern cs /${name} scn`)
    } else {
      const c = this.color(this.s.fill)
      if (c.a * this.s.alpha <= 0) return
      this.page.ops.push(`q ${this.paintState(c, false)}`)
    }
    this.emitPath(p)
    this.page.ops.push(r === 'evenodd' ? 'f* Q' : 'f Q')
  }

  stroke(path?: VPath) {
    const p = path ? path.transformed(this.s.ctm) : this.path
    const c = this.color(this.s.stroke)
    if (c.a * this.s.alpha <= 0) return
    const k = lengthScale(this.s.ctm) / this.pxPerPt
    const dash = this.s.dash.length ? `[${this.s.dash.map((d) => fmt(d * k)).join(' ')}] 0 d` : '[] 0 d'
    this.page.ops.push(`q ${this.paintState(c, true)} ${fmt(this.s.lineWidth * k)} w ${dash}`)
    this.emitPath(p)
    this.page.ops.push('S Q')
  }

  clip(pathOrRule?: VPath | CanvasFillRule, rule?: CanvasFillRule) {
    const p = pathOrRule instanceof VPath ? pathOrRule.transformed(this.s.ctm) : this.path
    const r = (pathOrRule instanceof VPath ? rule : pathOrRule) ?? 'nonzero'
    this.emitPath(p)
    this.page.ops.push(r === 'evenodd' ? 'W* n' : 'W n')
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const p = new VPath()
    p.rect(x, y, w, h)
    this.fill(p)
  }

  strokeRect(x: number, y: number, w: number, h: number) {
    const p = new VPath()
    p.rect(x, y, w, h)
    this.stroke(p)
  }

  /* text */

  /** The face and size a canvas `font` string names. Mono where the family is `Sanity Mono`, bold at 600 and over, italic slanted — the faces have no italics of their own. */
  fontSpec(font = this.s.font): FontSpec {
    const italic = /\bitalic\b/.test(font)
    const weight = Number(/\b([1-9]00)\b/.exec(font)?.[1] ?? (/\bbold\b/.test(font) ? 700 : 400))
    const size = parseFloat(/([\d.]+)px/.exec(font)?.[1] ?? '10')
    const mono = /Sanity Mono/.test(font)
    const bold = weight >= 600
    const face = mono ? (bold ? this.fonts.monoBold : this.fonts.mono) : bold ? this.fonts.sansBold : this.fonts.sans
    return { face, size, italic }
  }

  measureText(text: string): { width: number } {
    const f = this.fontSpec()
    return { width: f.face.measure(text, f.size) }
  }

  fillText(text: string, x: number, y: number) {
    if (!text) return
    const f = this.fontSpec()
    const c = this.color(this.s.fill)
    if (c.a * this.s.alpha <= 0) return
    const w = f.face.measure(text, f.size)
    const align = this.s.textAlign
    const dx = align === 'right' || align === 'end' ? -w : align === 'center' ? -w / 2 : 0
    const dy = baselineShift(f, this.s.textBaseline)
    this.glyphs(f, text, c, multiply(this.s.ctm, [1, 0, 0, 1, x + dx, y + dy]))
  }

  /** A shaped run placed by `at` (its origin on the baseline, in canvas pixels), with the fill
   *  already resolved. The SVG translator sets text along a path through this, glyph by glyph. */
  glyphs(f: FontSpec, text: string, c: Rgba, at: Matrix, spacing = 0) {
    const shaped = f.face.shape(text)
    f.face.note(text, shaped)
    const name = this.page.fontName(f.face)
    const slant = f.italic ? f.size * Math.tan((12 * Math.PI) / 180) : 0
    // Glyph space is y up and the canvas is y down, so `d` is negative — and the slant, which
    // leans a glyph's top to the right, is positive `c`: x grows with height.
    const tm = multiply(this.device, multiply(at, [f.size, 0, slant, -f.size, 0, 0]))
    const k = 1000 / f.face.upem
    const parts: string[] = []
    let run = ''
    shaped.gids.forEach((g, i) => {
      run += g.toString(16).padStart(4, '0')
      const natural = f.face.advance(g) * k
      const wanted = shaped.advances[i] * k + (spacing / f.size) * 1000
      const adj = natural - wanted
      if (Math.abs(adj) > 0.05 && i < shaped.gids.length - 1) {
        parts.push(`<${run}>`, fmt(adj))
        run = ''
      }
    })
    if (run) parts.push(`<${run}>`)
    this.page.ops.push(
      `q ${this.paintState(c, false)} BT /${name} 1 Tf ${tm.map(fmt).join(' ')} Tm [${parts.join(' ')}] TJ ET Q`,
    )
  }

  /* images */
  drawImage(img: PdfImage, x: number, y: number, w: number, h: number) {
    const name = this.page.image(img)
    const m = multiply(this.device, multiply(this.s.ctm, [w, 0, 0, -h, x, y + h]))
    const gs = this.page.state({ ca: fmt(this.s.alpha), CA: fmt(this.s.alpha), BM: '/Normal' })
    this.page.ops.push(`q /${gs} gs ${m.map(fmt).join(' ')} cm /${name} Do Q`)
  }

  /** Canvas pixels → page points, for links and patterns placed in page space. */
  toPage(x: number, y: number): [number, number] {
    return apply(multiply(this.device, this.s.ctm), x, y)
  }

  /** The full user → page-points matrix, for a pattern's placement. */
  pageMatrix(): Matrix {
    return multiply(this.device, this.s.ctm)
  }
}

function baselineShift(f: FontSpec, baseline: CanvasTextBaseline): number {
  const em = f.size / f.face.upem
  switch (baseline) {
    case 'top':
    case 'hanging':
      return f.face.ascent * em
    case 'middle':
      return ((f.face.ascent + f.face.descent) / 2) * em
    case 'bottom':
    case 'ideographic':
      return f.face.descent * em
    default:
      return 0
  }
}
