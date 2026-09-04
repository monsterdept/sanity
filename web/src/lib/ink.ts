/**
 * Which of the two inks a label takes, decided by the wedge it is standing on.
 *
 * Every label in the map was `var(--foreground)` — one ink for the whole ramp. The ramp
 * spans a 6:1 range of lightness, so that cannot work at both ends and did not: in light
 * mode, Ink on `--heat-0` is 2.2:1, and a file full of hot functions had its names sunk
 * into their own wedges. Flipping the pair with the THEME does not fix it, it moves the
 * failure to the other end of the ramp — the wedge's color is the reading, and the
 * reading does not care what the app's chrome is set to.
 *
 * This is the answer the separation treatments were reaching for and is not one of them.
 * Halo, shadow and plate all tried to insert something BETWEEN the name and the fill,
 * which is why all three lost: the halo reads as outlined type, the plate covers the very
 * color the label stands on, the shadow is a wash. Choosing the ink adds nothing to the
 * picture at all — it is still plain type on the wedge, the decision `labelStyle` settled
 * — it just stops picking the wrong one of the two colors the app already has.
 *
 * There is no threshold constant here on purpose. The rule is "whichever contrasts more",
 * computed, so the palette can move without a number here quietly going stale — the same
 * argument the ramps themselves make for living in index.css.
 */

/** The pair, and they do NOT flip with the theme — see above. Paper and Ink, the two ends
 *  of the app's own scale, taken as literals because what they have to be is the thing
 *  index.css names them; a `var(--foreground)` would resolve to whichever the current
 *  theme has face up, which is precisely the bug. */
export const PAPER = '#f5f1ea'
export const INK = '#1a1a1a'

/** What a label takes when nothing said what it is standing on — the app's own chrome
 *  color, which is the right answer for anything drawn on the pane rather than on a
 *  wedge, and the safe answer for a fill this cannot read. */
export const CHROME_INK = 'var(--foreground)'

/**
 * Pick the ink for a fill named by a custom property — `--heat-3`, `--structure`,
 * `var(--cat-1)`, all accepted.
 *
 * Only property names, never a `color-mix()` or a computed fill: a mix is resolved by the
 * renderer, in oklch, and nothing exposes the result to JavaScript — which is what
 * `rampStop` exists to route around. A name that will not resolve to a plain color falls
 * back to the chrome ink rather than to a guess, on the rule the rest of this codebase
 * follows: state what you have got.
 *
 * `alpha` is the wedge's `fillOpacity`, and it is not optional detail: a directory plate
 * under Surprise is drawn at 0.6 (see `heatShare`), so what the eye receives is the stop
 * composited over the pane, not the stop. Measuring the declared color there picks the
 * ink for a color nobody is looking at — on light paper a damped `--heat-0` plate is
 * pale, and the undamped answer would set Paper on it.
 */
export function inkOn(token: string, alpha = 1): string {
  const key = `${theme()}|${token}|${alpha}`
  const hit = cache.get(key)
  if (hit) return hit
  const hex = resolve(token)
  const ground = resolve('--background')
  const y =
    hex === null ? null : alpha >= 1 || ground === null ? luminance(hex) : over(hex, ground, alpha)
  const chosen =
    y === null
      ? CHROME_INK
      : contrast(y, luminance(PAPER)) >= contrast(y, luminance(INK))
        ? PAPER
        : INK
  cache.set(key, chosen)
  return chosen
}

/** Which of paper and ink reads on a colour that is not a token.
 *
 *  **The same judgement `inkOn` makes, for a value somebody typed.** `resolve` only knows how
 *  to look up a custom property, and the badge's colour comes out of a colour picker — but
 *  which of the two chromes reads on a colour is a fact about that colour, and there must not
 *  be a second answer to it living somewhere else. Falls back to the chrome's own foreground
 *  for anything that is not a six-digit hex, which is what every other reader here does with
 *  a value it cannot parse. */
export function inkOnHex(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return CHROME_INK
  const y = luminance(hex)
  return contrast(y, luminance(PAPER)) >= contrast(y, luminance(INK)) ? PAPER : INK
}

/** Cached against the theme, which is the only thing that can change an answer. Custom
 *  properties are read off the root, so a theme swap makes every entry wrong at once. */
const cache = new Map<string, string>()
const theme = () => (typeof document === 'undefined' ? ' ' : document.documentElement.className)

/** A custom property's declared value. Only useful because the ramps and the categorical
 *  slots are plain hex in index.css; a stop declared as a `color-mix` comes back as one
 *  and lands in the fallback above rather than being silently mis-read. */
function resolve(token: string): string | null {
  if (typeof document === 'undefined') return null
  const name = token
    .replace(/^var\(\s*/, '')
    .replace(/\s*\)$/, '')
    .trim()
  if (!name.startsWith('--')) return null
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  return srgb(hex).reduce((y, c, i) => y + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

/** Luminance of `hex` painted at `alpha` over `ground`. Composited per CHANNEL, in linear
 *  light — the compositor works on colors, and averaging two luminances instead would
 *  give a different answer wherever the two differ in hue, which is everywhere here. */
function over(hex: string, ground: string, alpha: number): number {
  const [a, b] = [srgb(hex), srgb(ground)]
  return a.reduce(
    (y, c, i) => y + [0.2126, 0.7152, 0.0722][i] * (c * alpha + b[i] * (1 - alpha)),
    0,
  )
}

/** The three channels, linearised. */
function srgb(hex: string): number[] {
  return [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
}

/** WCAG contrast ratio, order-independent. */
function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
