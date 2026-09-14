import { useCallback, useMemo, useRef } from 'react'
import { modeToken, rampOf, type ColorMode } from '../lib/colorMode'
import type { Gaze } from '../lib/eyeGaze'
import type { CirclesLook } from '../lib/hub'
import { useHubGaze } from './useHubGaze'

/**
 * Discs for the hub, one of the things `lib/hub.ts` lets the middle hold. A dark disc, and a
 * light one floating on it, after the fondant dot on a Sprinkles cupcake. They wear the two
 * colours the map on screen is mostly painted in, the darker outside, so the middle echoes the
 * picture around it rather than a key to it.
 *
 * **The inner disc looks where the eye would, at a fraction of the eye's travel.** It runs the
 * same engine (`useHubGaze`), so it drifts toward the flashing wedges, the clicked one and the
 * pointer, and glances off on its own. It does not blink, because a disc has no lids. How far it
 * goes is a control (`CirclesLook`): 0.025 of the hub could not be seen.
 *
 * **Floating is a shadow that holds still while the dot moves over it.** It is a flat circle, not
 * an SVG filter, so a report or a movie that copies the map carries it with nothing to rasterize.
 * It is centred, not dropped below the dot. See `CirclesLook` for why.
 *
 * **With `nest`, one more circle for each level drilled in: `2 + depth`.** The ends are the two
 * above, so at the repo root nothing changes. The outer disc keeps its radius and the dot keeps
 * its `step`, and the circles between are spaced geometrically between them: circle `k` of `n`
 * has radius `OUTER · (dot / OUTER)^(k / (n − 1))`, so each is the same fraction of the one
 * outside it. Their drift goes by the same `k / (n − 1)`: the dot travels the whole of `travel`
 * and each circle outside it less, which is what makes the stack read as layers. Every circle
 * inside the outer one floats on its own still shadow, sized to it as the dot's is to the dot.
 *
 * **A level's circle keeps the colour it came in with.** The stack is a history of the drill: the
 * root's two discs, then one circle per level below it, each the colour the map was mostly
 * painted in at that level, skipping the colour of the circle outside it so neighbours never
 * merge. Only the level on screen is live; the ones above it are remembered, per lens and per
 * path, so going back up takes the innermost circle away and leaves the rest as they were.
 * Recolouring the whole stack for the level on screen made every drill repaint the history.
 *
 * Drawn in SVG inside the map, like the eye and the wheel, and moved by writing attributes a
 * frame, never by rendering.
 */

/** In shares of the disc. Small enough that the findings badges above and below clear it. */
const OUTER = 0.6
const INNER = 0.34
/** How long the dot takes to settle into its size after a level change, as a time constant. */
const SCALE_TAU_MS = 180
/** The dark disc's own shadow on the card: how far it falls, and how dark it is. */
const OUTER_DROP = 0.025
const OUTER_SHADOW = 0.16

/** Lenses with no ramp: marks and categorical palettes. Each has one chrome colour (`modeToken`),
 *  so the dark disc is that colour taken toward black. */
const FLAT: ReadonlySet<ColorMode> = new Set(['traps', 'clones', 'blame', 'language', 'composition'])

/** The dark disc and the light one, as fills. A ramped lens gives both from its own ramp, a low
 *  stop and a high one, stopping short of the hot end, which belongs to the wedges. */
function discColors(mode: ColorMode): { outer: string; inner: string } {
  if (FLAT.has(mode)) {
    const token = `var(${modeToken(mode)})`
    return { outer: `color-mix(in oklch, ${token}, black 45%)`, inner: token }
  }
  const ramp = rampOf(mode)
  return { outer: `var(--${ramp}-1)`, inner: `var(--${ramp}-3)` }
}

/** Circle `k` of `n`'s radius, in shares of the disc, when the dot's is `dot`. `k = 0` is the
 *  outer disc and `k = n − 1` the dot; between them each is the same fraction of the last. */
function radiusOf(k: number, n: number, dot: number): number {
  return OUTER * Math.pow(dot / OUTER, k / (n - 1))
}

const f = (n: number) => n.toFixed(2)

export function HubCircles({
  r,
  mode,
  gaze,
  look,
  depth,
  path,
  palette,
  selected,
}: {
  r: number
  mode: ColorMode
  /** The creature's gaze targets, x right and **y up** — see `gaze` in `Sunburst` — or null. */
  gaze: Array<{ x: number; y: number }> | null
  look: CirclesLook
  /** How many levels below the repo root the map is. The dot shrinks with it — see `step` — and
   *  with `nest` each level adds a circle. */
  depth: number
  /** The path of the level on screen, `''` at the repo root. With `nest`, what each level's
   *  colour is remembered under. */
  path: string
  /** The map's colours, most area first, and the darker-first pair of the top two — see
   *  `hubDiscs` in `Sunburst`. Null when the map shows none, and the lens's own ramp stands in. */
  palette: { ranked: string[]; pair: { outer: string; inner: string } | null } | null
  /** The clicked wedge's direction, x right and **y up**, or null — see `selectedGaze` in
   *  `Sunburst`. Looked at when nothing is flashing. */
  selected: { x: number; y: number } | null
}) {
  const group = useRef<SVGGElement>(null)
  const discs = useRef<Array<SVGCircleElement | null>>([])
  const shades = useRef<Array<SVGCircleElement | null>>([])
  /** Each level's colour as it was when that level was on screen, by lens and path: the root's
   *  pair, and one colour for every level below. */
  const remembered = useRef(new Map<string, { outer: string; inner: string } | string>())

  /** One fill per circle, outermost first. */
  const fills = useMemo(() => {
    const base = palette?.pair ?? discColors(mode)
    if (!look.nest) return [base.outer, base.inner]
    const parts = path === '' ? [] : path.split('/')
    const key = (j: number) => `${mode}|${parts.slice(0, j).join('/')}`
    const memory = remembered.current
    // The level on screen is written every time; a level above it only when it was never seen,
    // which is a jump straight past it, and then it takes what this level has to give.
    let root = memory.get(key(0))
    if (depth === 0 || typeof root !== 'object') {
      root = base
      memory.set(key(0), root)
    }
    const out = [root.outer, root.inner]
    for (let j = 1; j <= depth; j++) {
      let c = memory.get(key(j))
      if (j === depth || typeof c !== 'string') {
        const outside = out[out.length - 1]
        c = palette?.ranked.find((t) => t !== outside) ?? palette?.ranked[0] ?? base.inner
        memory.set(key(j), c)
      }
      out.push(c)
    }
    return out
  }, [palette, path, depth, mode, look.nest])

  const n = fills.length
  const { travel, step, shadow } = look
  const target = Math.pow(1 - step, depth)
  // Eased in the frame loop rather than jumped, so a level change grows or shrinks the dot, and
  // the circles between follow it. Starts at the target, so the first frame does not grow it
  // from nothing.
  const scale = useRef<{ s: number; at: number } | null>(null)
  const draw = useCallback(
    (g: Gaze) => {
      const now = performance.now()
      const was = scale.current ?? { s: target, at: now }
      const s = was.s + (target - was.s) * (1 - Math.exp(-(now - was.at) / SCALE_TAU_MS))
      scale.current = { s, at: now }
      for (let k = 1; k < n; k++) {
        const rk = radiusOf(k, n, INNER * s)
        const drift = travel * (k / (n - 1))
        const disc = discs.current[k]
        disc?.setAttribute('r', f(rk * r))
        disc?.setAttribute('transform', `translate(${f(g.x * drift * r)} ${f(g.y * drift * r)})`)
        // The shadow takes its circle's size but not its position.
        shades.current[k]?.setAttribute('r', f(rk * (shadow / INNER) * r))
      }
    },
    [r, travel, target, n, shadow],
  )
  useHubGaze(group, gaze, draw, { followMouse: look.mouse, selected, idle: look.idle })

  return (
    <g ref={group} className="pointer-events-none">
      {/* One scale for all of it, so the discs, the shadows and the travel keep their proportions. */}
      <g transform={`scale(${look.size})`}>
        <circle cy={OUTER_DROP * r} r={OUTER * r} fill="black" fillOpacity={OUTER_SHADOW} />
        <circle r={OUTER * r} fill={fills[0]} />
        {Array.from({ length: n - 1 }, (_, i) => {
          const k = i + 1
          const rk = radiusOf(k, n, INNER * target)
          return (
            <g key={k}>
              <circle
                ref={(el) => {
                  shades.current[k] = el
                }}
                r={rk * (shadow / INNER) * r}
                fill={look.color}
                fillOpacity={look.alpha}
              />
              <circle
                ref={(el) => {
                  discs.current[k] = el
                }}
                r={rk * r}
                fill={fills[k]}
              />
            </g>
          )
        })}
      </g>
    </g>
  )
}
