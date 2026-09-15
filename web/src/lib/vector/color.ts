/**
 * CSS colors, resolved to the numbers a PDF paints with.
 *
 * **The theme is written for a browser, and a vector page has no browser to ask.** The window
 * resolves `var(--foreground)` and `color-mix(in oklch, …)` through `getComputedStyle`; a page
 * written without a window resolves them here, from the same stylesheet text. So this reads what
 * `index.css` actually uses — hex, `rgb()`, `oklch()`, `var()` and `color-mix()` in `srgb` or
 * `oklch` — and nothing it does not: a value it cannot read is an error, never a guess, because a
 * wrong color is not a crash.
 */

/** A color as a PDF takes it: sRGB channels and alpha, each 0–1. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

/** Custom properties by name (`--foreground`), as written, before resolution. */
export type Vars = Map<string, string>

const NAMED: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: '#00000000',
  none: '#00000000',
}

/**
 * The custom properties a stylesheet declares for the light theme: every `--name: value;` inside a
 * `:root` rule that no `[data-theme]` or media query narrows. A later declaration wins, as the
 * cascade would have it.
 */
export function rootVars(css: string): Vars {
  return varsWhere(css, (selector) => /(^|,)\s*:root\s*(,|$)/.test(selector))
}

/** The stylesheet's variables on one of the app's two grounds: `:root`, with `.dark`'s over it for
 *  a dark one — what `dark` on `<html>` does, read off the same text. A value that refers to
 *  another variable is resolved when it is read, so `.dark`'s mixes see `.dark`'s inks. */
export function groundVars(css: string, ground: 'light' | 'dark'): Vars {
  const vars = rootVars(css)
  if (ground === 'dark') {
    for (const [name, value] of varsWhere(css, (selector) => /(^|,)\s*\.dark\s*(,|$)/.test(selector))) vars.set(name, value)
  }
  return vars
}

/** A table of `--name` to `#rrggbb` over `vars`, for what asks for a token's color by name. */
export function hexOf(vars: Vars): (name: string) => string | null {
  return (name) => {
    const v = vars.get(name)
    if (v === undefined) return null
    try {
      const c = parseColor(v, vars)
      return `#${[c.r, c.g, c.b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('')}`
    } catch {
      return null
    }
  }
}

/** Any color `parseColor` reads, as a string a canvas takes; null for one it cannot. */
export function cssColor(input: string, vars: Vars): string | null {
  try {
    const c = parseColor(input, vars)
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${c.a})`
  } catch {
    return null
  }
}

function varsWhere(css: string, matches: (selector: string) => boolean): Vars {
  const vars: Vars = new Map()
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = /([^{}]+)\{([^{}]*)\}/g
  for (let m = rule.exec(text); m; m = rule.exec(text)) {
    const selector = m[1].trim()
    if (!matches(selector)) continue
    for (const decl of m[2].split(';')) {
      const at = decl.indexOf(':')
      if (at < 0) continue
      const name = decl.slice(0, at).trim()
      if (name.startsWith('--')) vars.set(name, decl.slice(at + 1).trim())
    }
  }
  return vars
}

/** The variables with the page's own ground. **A figure prints on white paper**, and the map
 *  draws its cuts, and chooses its label ink, against `--background`: the window's warm light
 *  ground printed as a gray wash. */
export function onPaper(vars: Vars, paper = '#ffffff'): Vars {
  const out = new Map(vars)
  out.set('--background', paper)
  return out
}

/** A CSS color string to channels, resolving `var()` through `vars`. Throws on anything unread. */
export function parseColor(input: string, vars: Vars = new Map(), depth = 0): Rgba {
  if (depth > 16) throw new Error(`A color refers to itself: ${input}`)
  const s = input.trim()
  const lower = s.toLowerCase()
  if (NAMED[lower]) return parseColor(NAMED[lower], vars, depth + 1)
  if (s.startsWith('#')) return hex(s)
  const fn = /^([a-z-]+)\((.*)\)$/is.exec(s)
  if (!fn) throw new Error(`Not a color this page can paint: ${input}`)
  const name = fn[1].toLowerCase()
  const body = fn[2]
  if (name === 'var') {
    const [ref, fallback] = splitTop(body, ',')
    const value = vars.get(ref.trim())
    if (value !== undefined) return parseColor(value, vars, depth + 1)
    if (fallback !== undefined) return parseColor(fallback, vars, depth + 1)
    throw new Error(`No value for ${ref.trim()}`)
  }
  if (name === 'rgb' || name === 'rgba') {
    const [ch, alpha] = channels(body)
    return { r: unit(ch[0], 255), g: unit(ch[1], 255), b: unit(ch[2], 255), a: alpha }
  }
  if (name === 'oklch') {
    const [ch, alpha] = channels(body)
    const L = ch[0].endsWith('%') ? parseFloat(ch[0]) / 100 : parseFloat(ch[0])
    const C = ch[1].endsWith('%') ? (parseFloat(ch[1]) / 100) * 0.4 : parseFloat(ch[1])
    const H = parseFloat(ch[2])
    return { ...fromOklab(oklchToOklab(L, C, Number.isFinite(H) ? H : 0)), a: alpha }
  }
  if (name === 'color-mix') return mix(body, vars, depth)
  throw new Error(`Not a color function this page can paint: ${name}()`)
}

function hex(s: string): Rgba {
  let h = s.slice(1)
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`Not a hex color: ${s}`)
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 }
}

/** Splits on `sep` where it is not inside parentheses. */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') depth--
    else if (depth === 0 && s[i] === sep) {
      out.push(s.slice(start, i))
      start = i + 1
    }
  }
  out.push(s.slice(start))
  return out
}

/** `r g b / a` or `r, g, b, a`, as strings, and the alpha as a number. */
function channels(body: string): [string[], number] {
  const [main, slash] = body.split('/')
  const parts = main.split(/[\s,]+/).filter(Boolean)
  const alphaText = slash?.trim() ?? parts[3]
  const alpha = alphaText === undefined ? 1 : alphaText.endsWith('%') ? parseFloat(alphaText) / 100 : parseFloat(alphaText)
  return [parts.slice(0, 3), alpha]
}

function unit(v: string, max: number): number {
  return v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / max
}

/* ── Oklab ─────────────────────────────────────────────────────────────── */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))

function toOklab({ r, g, b }: Rgba): [number, number, number] {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

function fromOklab([L, a, b]: [number, number, number]): Omit<Rgba, 'a'> {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return {
    r: clamp01(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp01(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp01(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  }
}

function oklchToOklab(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180
  return [L, C * Math.cos(h), C * Math.sin(h)]
}

/**
 * `color-mix(in srgb|oklch, a p%, b q%)`, by the CSS Color 5 rules: missing percentages take the
 * rest, both scale to 100, a sum under 100 lowers the alpha, and channels mix premultiplied.
 */
function mix(body: string, vars: Vars, depth: number): Rgba {
  const [space, ...rest] = splitTop(body, ',')
  const where = space.trim().toLowerCase().replace(/^in\s+/, '')
  if (where !== 'srgb' && where !== 'oklch') throw new Error(`color-mix in ${where} is not supported`)
  const items = rest.map((part) => {
    const t = part.trim()
    const pct = /\s(\d+(?:\.\d+)?)%\s*$/.exec(t)
    return { color: parseColor(pct ? t.slice(0, pct.index) : t, vars, depth + 1), p: pct ? parseFloat(pct[1]) : null }
  })
  if (items.length !== 2) throw new Error(`color-mix wants two colors: ${body}`)
  let [p1, p2] = [items[0].p, items[1].p]
  if (p1 === null && p2 === null) p1 = p2 = 50
  else if (p1 === null) p1 = 100 - p2!
  else if (p2 === null) p2 = 100 - p1
  const sum = p1 + p2!
  if (sum <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  const w1 = p1 / sum
  const w2 = p2! / sum
  const [c1, c2] = [items[0].color, items[1].color]
  const alpha = c1.a * w1 + c2.a * w2
  const scale = Math.min(1, sum / 100)
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
  if (where === 'srgb') {
    const ch = (k: 'r' | 'g' | 'b') => (c1[k] * c1.a * w1 + c2[k] * c2.a * w2) / alpha
    return { r: ch('r'), g: ch('g'), b: ch('b'), a: alpha * scale }
  }
  // oklch: L and C premultiplied, hue the shorter way round, and a transparent side's hue is
  // "missing" — it takes the other's, as `transparent` in a mix is meant to.
  const lch = (c: Rgba) => {
    const [L, a, b] = toOklab(c)
    return { L, C: Math.hypot(a, b), H: c.a === 0 ? NaN : (Math.atan2(b, a) * 180) / Math.PI }
  }
  const x = lch(c1)
  const y = lch(c2)
  const hx = Number.isNaN(x.H) ? y.H : x.H
  const hy = Number.isNaN(y.H) ? x.H : y.H
  let dh = (Number.isNaN(hy) ? 0 : hy) - (Number.isNaN(hx) ? 0 : hx)
  if (dh > 180) dh -= 360
  if (dh < -180) dh += 360
  const L = (x.L * c1.a * w1 + y.L * c2.a * w2) / alpha
  const C = (x.C * c1.a * w1 + y.C * c2.a * w2) / alpha
  const H = (Number.isNaN(hx) ? 0 : hx) + dh * w2
  return { ...fromOklab(oklchToOklab(L, C, H)), a: alpha * scale }
}
