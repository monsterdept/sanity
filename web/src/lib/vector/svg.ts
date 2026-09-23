import { parseColor, type Vars } from './color'
import { fmt } from './doc'
import { IDENTITY, multiply, parseSvgPath, VPath, type Matrix, type Surface } from './surface'

/**
 * The map's SVG, drawn as vector paths and real text on a `Surface`.
 *
 * **A translation of the markup the map renders, never a second drawing of the map.** Every
 * decision about a wedge — its arc, its color, whether its label fits — was made by the map's own
 * code, and what arrives here is its output: paths, circles, lines, text, text along arcs, and the
 * stale and fold hatches as patterns. This reads exactly that set (see `docs/plans/done/offline-renderer.md`)
 * and throws on an element it does not know, because an element silently dropped is a wedge
 * silently missing.
 *
 * **Group opacity is multiplied into what the group draws** rather than composited as a group.
 * The map uses it on label groups, whose members do not overlap, where the two are the same.
 */

export interface El {
  tag: string
  attrs: Record<string, string>
  children: (El | string)[]
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function unescape(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Markup as React's `renderToStaticMarkup` writes it, into elements. Well-formed input only. */
export function parseSvg(markup: string): El {
  const root: El = { tag: '#root', attrs: {}, children: [] }
  const stack: El[] = [root]
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g
  for (let m = re.exec(markup); m; m = re.exec(markup)) {
    if (m[1]) {
      if (stack.length > 1) stack.pop()
    } else if (m[2]) {
      const attrs: Record<string, string> = {}
      const ar = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
      for (let a = ar.exec(m[3]); a; a = ar.exec(m[3])) attrs[a[1]] = unescape(a[2] ?? a[3] ?? a[4] ?? '')
      const el: El = { tag: m[2].toLowerCase(), attrs, children: [] }
      stack[stack.length - 1].children.push(el)
      if (!m[4]) stack.push(el)
    } else if (m[5] && stack.length > 1) {
      stack[stack.length - 1].children.push(unescape(m[5]))
    }
  }
  const svg = root.children.find((c): c is El => typeof c !== 'string' && c.tag === 'svg')
  if (!svg) throw new Error('The map markup holds no <svg>.')
  return svg
}

/** A `transform` attribute as one matrix. */
export function parseTransform(t: string | undefined): Matrix {
  let m: Matrix = IDENTITY
  if (!t) return m
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  for (let x = re.exec(t); x; x = re.exec(t)) {
    const n = x[2].split(/[\s,]+/).filter(Boolean).map(Number)
    let op: Matrix = IDENTITY
    switch (x[1]) {
      case 'matrix':
        op = [n[0], n[1], n[2], n[3], n[4], n[5]]
        break
      case 'translate':
        op = [1, 0, 0, 1, n[0] ?? 0, n[1] ?? 0]
        break
      case 'scale':
        op = [n[0], 0, 0, n[1] ?? n[0], 0, 0]
        break
      case 'rotate': {
        const a = ((n[0] ?? 0) * Math.PI) / 180
        const r: Matrix = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]
        op = n.length >= 3 ? multiply(multiply([1, 0, 0, 1, n[1], n[2]], r), [1, 0, 0, 1, -n[1], -n[2]]) : r
        break
      }
      case 'skewX':
        op = [1, 0, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 1, 0, 0]
        break
      case 'skewY':
        op = [1, Math.tan(((n[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]
        break
    }
    m = multiply(m, op)
  }
  return m
}

/** Presentation properties, inherited down the tree as SVG inherits them. */
interface Style {
  fill: string
  fillOpacity: number
  fillRule: CanvasFillRule
  stroke: string
  strokeOpacity: number
  strokeWidth: number
  dash: number[]
  /** Group opacity so far, multiplied down. */
  opacity: number
  fontSize: number
  fontWeight: string
  fontFamily: string
  anchor: string
  baseline: string
  letterSpacing: string
}

const DEFAULT_STYLE: Style = {
  fill: '#000',
  fillOpacity: 1,
  fillRule: 'nonzero',
  stroke: 'none',
  strokeOpacity: 1,
  strokeWidth: 1,
  dash: [],
  opacity: 1,
  fontSize: 16,
  fontWeight: '400',
  fontFamily: '"LINE Seed JP"',
  anchor: 'start',
  baseline: 'auto',
  letterSpacing: 'normal',
}

function propsOf(el: El): Record<string, string> {
  const out: Record<string, string> = { ...el.attrs }
  for (const decl of (el.attrs.style ?? '').split(';')) {
    const at = decl.indexOf(':')
    if (at > 0) out[decl.slice(0, at).trim()] = decl.slice(at + 1).trim()
  }
  return out
}

function inherit(parent: Style, el: El): Style {
  const p = propsOf(el)
  const s = { ...parent, opacity: parent.opacity * (p.opacity !== undefined ? Number(p.opacity) : 1) }
  if (p.fill !== undefined) s.fill = p.fill
  if (p['fill-opacity'] !== undefined) s.fillOpacity = Number(p['fill-opacity'])
  if (p['fill-rule'] !== undefined) s.fillRule = p['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero'
  if (p.stroke !== undefined) s.stroke = p.stroke
  if (p['stroke-opacity'] !== undefined) s.strokeOpacity = Number(p['stroke-opacity'])
  if (p['stroke-width'] !== undefined) s.strokeWidth = parseFloat(p['stroke-width'])
  if (p['stroke-dasharray'] !== undefined) s.dash = p['stroke-dasharray'] === 'none' ? [] : p['stroke-dasharray'].split(/[\s,]+/).map(Number)
  if (p['font-size'] !== undefined) s.fontSize = parseFloat(p['font-size'])
  if (p['font-weight'] !== undefined) s.fontWeight = p['font-weight']
  if (p['font-family'] !== undefined) s.fontFamily = p['font-family']
  if (p['text-anchor'] !== undefined) s.anchor = p['text-anchor']
  if (p['dominant-baseline'] !== undefined) s.baseline = p['dominant-baseline']
  if (p['letter-spacing'] !== undefined) s.letterSpacing = p['letter-spacing']
  return s
}

export interface SvgOptions {
  /** Where the SVG's viewBox goes on the surface, as a square in canvas pixels. */
  x: number
  y: number
  side: number
  vars: Vars
  /** Set every label in this ink — see `drawMap` in `report/figure.ts`. */
  labelInk?: string
  /** Leave off any label that would print smaller than this, in canvas pixels. */
  minLabel?: number
}

const SKIP = new Set(['title', 'desc', 'metadata', 'style'])
const CONTAINERS = new Set(['svg', 'g', 'a'])

export function drawSvg(surface: Surface, svg: El, o: SvgOptions) {
  const vb = (svg.attrs.viewBox ?? svg.attrs.viewbox ?? '0 0 1 1').split(/[\s,]+/).map(Number)
  const [vx, vy, vw, vh] = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 ? vb : [0, 0, 1, 1]
  const k = o.side / Math.max(vw, vh)
  const base: Matrix = [k, 0, 0, k, o.x + (o.side - vw * k) / 2 - vx * k, o.y + (o.side - vh * k) / 2 - vy * k]

  const byId = new Map<string, El>()
  const index = (el: El) => {
    if (el.attrs.id) byId.set(el.attrs.id, el)
    for (const c of el.children) if (typeof c !== 'string') index(c)
  }
  index(svg)

  surface.patternFill = (id) => {
    const pat = byId.get(id)
    if (!pat || pat.tag !== 'pattern') return null
    return patternName(surface, pat, o.vars)
  }

  const walk = (el: El, ctm: Matrix, style: Style) => {
    if (SKIP.has(el.tag) || el.tag === 'defs' || el.tag === 'pattern' || el.tag === 'clippath') return
    const s = inherit(style, el)
    const m = el.tag === 'svg' ? ctm : multiply(ctm, parseTransform(el.attrs.transform))
    if (CONTAINERS.has(el.tag)) {
      for (const c of el.children) if (typeof c !== 'string') walk(c, m, s)
      return
    }
    switch (el.tag) {
      case 'path':
        return shape(surface, new VPath(el.attrs.d ?? ''), m, s)
      case 'circle': {
        const p = new VPath()
        p.arc(num(el.attrs.cx), num(el.attrs.cy), num(el.attrs.r), 0, Math.PI * 2)
        p.closePath()
        return shape(surface, p, m, s)
      }
      case 'ellipse': {
        const p = new VPath()
        const rx = num(el.attrs.rx)
        const ry = num(el.attrs.ry)
        p.arc(0, 0, 1, 0, Math.PI * 2)
        p.closePath()
        return shape(surface, p, multiply(m, [rx, 0, 0, ry, num(el.attrs.cx), num(el.attrs.cy)]), s, Math.max(rx, ry))
      }
      case 'rect': {
        const p = new VPath()
        p.rect(num(el.attrs.x), num(el.attrs.y), num(el.attrs.width), num(el.attrs.height))
        return shape(surface, p, m, s)
      }
      case 'line': {
        const p = new VPath()
        p.moveTo(num(el.attrs.x1), num(el.attrs.y1))
        p.lineTo(num(el.attrs.x2), num(el.attrs.y2))
        return shape(surface, p, m, { ...s, fill: 'none' })
      }
      case 'text':
        return text(surface, el, m, s, byId, o)
      default:
        throw new Error(`The map drew a <${el.tag}>, which the PDF translator does not know.`)
    }
  }
  walk(svg, base, DEFAULT_STYLE)
  surface.patternFill = null
}

const num = (v: string | undefined) => (v === undefined ? 0 : parseFloat(v)) || 0

function shape(surface: Surface, p: VPath, m: Matrix, s: Style, _scale?: number) {
  surface.save()
  surface.setTransform(...m)
  if (s.fill !== 'none') {
    surface.fillStyle = s.fill
    surface.globalAlpha = s.opacity * s.fillOpacity
    surface.fill(p, s.fillRule)
  }
  if (s.stroke !== 'none' && s.strokeWidth > 0) {
    surface.strokeStyle = s.stroke
    surface.lineWidth = s.strokeWidth
    surface.globalAlpha = s.opacity * s.strokeOpacity
    surface.setLineDash(s.dash)
    surface.stroke(p)
  }
  surface.restore()
}

function fontString(s: Style): string {
  return `${s.fontWeight} ${s.fontSize}px ${s.fontFamily}`
}

function spacingOf(s: Style): number {
  const v = s.letterSpacing.trim()
  if (v === 'normal' || !v) return 0
  if (v.endsWith('em')) return parseFloat(v) * s.fontSize
  return parseFloat(v) || 0
}

function textOf(el: El): string {
  return el.children.map((c) => (typeof c === 'string' ? c : '')).join('')
}

function text(surface: Surface, el: El, m: Matrix, s: Style, byId: Map<string, El>, o: SvgOptions) {
  const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
  const along = el.children.find((c): c is El => typeof c !== 'string' && c.tag === 'textpath')
  const st = along ? inherit(s, along) : s
  if (o.minLabel !== undefined && st.fontSize * scale < o.minLabel) return
  const spec = surface.fontSpec(fontString(st))
  const color = parseColor(o.labelInk ?? st.fill, o.vars)
  const alpha = st.opacity * st.fillOpacity
  if (alpha * color.a <= 0 || st.fill === 'none') return
  const spacing = spacingOf(st)
  const shift = baseline(spec, st.baseline)

  surface.save()
  surface.globalAlpha = alpha
  if (!along) {
    const str = textOf(el).trim()
    if (!str) return surface.restore()
    const shaped = spec.face.shape(str)
    const w = (shaped.width / spec.face.upem) * spec.size + spacing * Math.max(0, shaped.gids.length - 1)
    const dx = st.anchor === 'middle' ? -w / 2 : st.anchor === 'end' ? -w : 0
    surface.glyphs(spec, str, color, multiply(m, [1, 0, 0, 1, num(el.attrs.x) + dx, num(el.attrs.y) + shift]), spacing)
    return surface.restore()
  }

  const ref = (along.attrs.href ?? along.attrs['xlink:href'] ?? '').replace(/^#/, '')
  const target = byId.get(ref)
  if (!target?.attrs.d) {
    surface.restore()
    throw new Error(`A label runs along #${ref}, which the map did not draw.`)
  }
  const str = textOf(along).trim()
  if (!str) return surface.restore()
  const route = new VPath(target.attrs.d).transformed(parseTransform(target.attrs.transform))
  const poly = flatten(route)
  const total = poly.length ? poly[poly.length - 1].s : 0
  const shaped = spec.face.shape(str)
  const em = spec.size / spec.face.upem
  const advances = shaped.advances.map((a) => a * em)
  const width = advances.reduce((t, a) => t + a, 0) + spacing * Math.max(0, advances.length - 1)
  const offAttr = along.attrs.startOffset ?? along.attrs.startoffset ?? '0'
  const offset = offAttr.endsWith('%') ? (parseFloat(offAttr) / 100) * total : parseFloat(offAttr) || 0
  let at = offset - (st.anchor === 'middle' ? width / 2 : st.anchor === 'end' ? width : 0)
  shaped.gids.forEach((_, i) => {
    const from = shaped.clusters[i]
    const next = shaped.clusters.find((c) => c > from) ?? str.length
    const piece = str.slice(from, next)
    const mid = at + advances[i] / 2
    const { x, y, angle } = pointAt(poly, mid)
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    // Glyph origin half an advance back along the tangent, then the baseline shift across it.
    const ox = x - cos * (advances[i] / 2) - sin * shift
    const oy = y - sin * (advances[i] / 2) + cos * shift
    if (piece.trim()) surface.glyphs(spec, piece, color, multiply(m, [cos, sin, -sin, cos, ox, oy]))
    at += advances[i] + spacing
  })
  surface.restore()
}

function baseline(spec: ReturnType<Surface['fontSpec']>, b: string): number {
  if (b === 'central' || b === 'middle') {
    const em = spec.size / spec.face.upem
    return (spec.face.capHeight / 2) * em
  }
  if (b === 'hanging' || b === 'text-before-edge') return (spec.face.ascent * spec.size) / spec.face.upem
  return 0
}

interface PolyPt {
  x: number
  y: number
  s: number
}

/** A path as a polyline with the distance along it at each point. */
function flatten(p: VPath): PolyPt[] {
  const out: PolyPt[] = []
  let cx = 0
  let cy = 0
  const push = (x: number, y: number) => {
    const last = out[out.length - 1]
    out.push({ x, y, s: last ? last.s + Math.hypot(x - last.x, y - last.y) : 0 })
    cx = x
    cy = y
  }
  for (const seg of p.segs) {
    if (seg.op === 'M') {
      if (out.length) break
      push(seg.x, seg.y)
    } else if (seg.op === 'L') push(seg.x, seg.y)
    else if (seg.op === 'C') {
      const [x1, y1, x2, y2, x3, y3] = seg.pts
      const x0 = cx
      const y0 = cy
      for (let t = 1; t <= 24; t++) {
        const u = t / 24
        const v = 1 - u
        push(v * v * v * x0 + 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u * x3, v * v * v * y0 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y3)
      }
    }
  }
  return out
}

function pointAt(poly: PolyPt[], s: number): { x: number; y: number; angle: number } {
  if (poly.length < 2) return { x: poly[0]?.x ?? 0, y: poly[0]?.y ?? 0, angle: 0 }
  let i = 1
  while (i < poly.length - 1 && poly[i].s < s) i++
  const a = poly[i - 1]
  const b = poly[i]
  const len = b.s - a.s || 1
  const t = (s - a.s) / len
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) }
}

/**
 * A `<pattern>` as a PDF tiling pattern, placed where the element being filled is: its cell is
 * drawn in pattern space and the pattern's matrix carries it to the page through the element's
 * transform and the pattern's own `patternTransform`.
 */
function patternName(surface: Surface, pat: El, vars: Vars): string {
  const w = num(pat.attrs.width)
  const h = num(pat.attrs.height)
  if (w <= 0 || h <= 0) throw new Error(`Pattern #${pat.attrs.id} has no size.`)
  const place = multiply(surface.pageMatrix(), multiply([1, 0, 0, 1, num(pat.attrs.x), num(pat.attrs.y)], parseTransform(pat.attrs.patternTransform)))
  const ops: string[] = []
  const draw = (el: El, m: Matrix, style: Style) => {
    const s = inherit(style, el)
    const mm = multiply(m, parseTransform(el.attrs.transform))
    if (el.tag === 'g') {
      for (const c of el.children) if (typeof c !== 'string') draw(c, mm, s)
      return
    }
    const p = new VPath()
    if (el.tag === 'line') {
      p.moveTo(num(el.attrs.x1), num(el.attrs.y1))
      p.lineTo(num(el.attrs.x2), num(el.attrs.y2))
    } else if (el.tag === 'rect') p.rect(num(el.attrs.x), num(el.attrs.y), num(el.attrs.width), num(el.attrs.height))
    else if (el.tag === 'path') parseSvgPath(el.attrs.d ?? '', p)
    else if (el.tag === 'circle') {
      p.arc(num(el.attrs.cx), num(el.attrs.cy), num(el.attrs.r), 0, Math.PI * 2)
      p.closePath()
    } else if (SKIP.has(el.tag)) return
    else throw new Error(`A pattern cell drew a <${el.tag}>, which the PDF translator does not know.`)
    const t = p.transformed(mm)
    const path = t.segs
      .map((seg) => {
        if (seg.op === 'M') return `${fmt(seg.x)} ${fmt(seg.y)} m`
        if (seg.op === 'L') return `${fmt(seg.x)} ${fmt(seg.y)} l`
        if (seg.op === 'C') return `${seg.pts.map(fmt).join(' ')} c`
        return 'h'
      })
      .join(' ')
    const paint = (color: string, alpha: number, stroke: boolean) => {
      const c = parseColor(color, vars)
      const gs = surface.page.state({ ca: fmt(c.a * alpha), CA: fmt(c.a * alpha), BM: '/Normal' })
      return `/${gs} gs ${fmt(c.r)} ${fmt(c.g)} ${fmt(c.b)} ${stroke ? 'RG' : 'rg'}`
    }
    if (s.fill !== 'none' && el.tag !== 'line') ops.push(`q ${paint(s.fill, s.opacity * s.fillOpacity, false)} ${path} f Q`)
    if (s.stroke !== 'none') ops.push(`q ${paint(s.stroke, s.opacity * s.strokeOpacity, true)} ${fmt(s.strokeWidth)} w ${path} S Q`)
  }
  for (const c of pat.children) if (typeof c !== 'string') draw(c, IDENTITY, { ...DEFAULT_STYLE, fill: 'none' })
  return surface.page.pattern({ bbox: [0, 0, w, h], xstep: w, ystep: h, matrix: place, ops })
}
