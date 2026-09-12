import { useCallback, useRef } from 'react'
import { modeToken, rampOf, type ColorMode } from '../lib/colorMode'
import type { Gaze } from '../lib/eyeGaze'
import type { CirclesLook } from '../lib/hub'
import { useHubGaze } from './useHubGaze'

/**
 * Two discs for the hub, one of the things `lib/hub.ts` lets the middle hold. A dark disc, and a
 * light one floating on it, after the fondant dot on a Sprinkles cupcake. They wear the two
 * colours the map on screen is mostly painted in, the darker outside, so the middle echoes the
 * picture around it rather than a key to it.
 *
 * **The inner disc looks where the eye would, at a fraction of the eye's travel.** It runs the
 * same engine (`useHubGaze`), so it drifts toward the pointer and the flashing wedges and glances
 * off on its own. It does not blink, because a disc has no lids. How far it goes is a control
 * (`CirclesLook`): 0.025 of the hub could not be seen.
 *
 * **Floating is a shadow that holds still while the dot moves over it.** It is a flat circle, not
 * an SVG filter, so a report or a movie that copies the map carries it with nothing to rasterize.
 * It is centred, not dropped below the dot. See `CirclesLook` for why.
 *
 * Drawn in SVG inside the map, like the eye and the wheel, and moved by writing an attribute a
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

const f = (n: number) => n.toFixed(2)

export function HubCircles({
  r,
  mode,
  gaze,
  look,
  depth,
  colors,
}: {
  r: number
  mode: ColorMode
  /** The creature's gaze targets, x right and **y up** — see `gaze` in `Sunburst` — or null. */
  gaze: Array<{ x: number; y: number }> | null
  look: CirclesLook
  /** How many levels below the repo root the map is. The dot shrinks with it — see `step`. */
  depth: number
  /** The two colours with the most area on the map, darker first — see `hubDiscs` in
   *  `Sunburst`. Null when the map shows fewer than two, and the lens's own ramp stands in. */
  colors: { outer: string; inner: string } | null
}) {
  const group = useRef<SVGGElement>(null)
  const dot = useRef<SVGCircleElement>(null)
  const shade = useRef<SVGCircleElement>(null)
  const { travel, step } = look
  const target = Math.pow(1 - step, depth)
  // Eased in the frame loop rather than jumped, so a level change grows or shrinks it. Starts
  // at the target, so the first frame does not grow it from nothing.
  const scale = useRef<{ s: number; at: number } | null>(null)
  const draw = useCallback(
    (g: Gaze) => {
      const now = performance.now()
      const was = scale.current ?? { s: target, at: now }
      const s = was.s + (target - was.s) * (1 - Math.exp(-(now - was.at) / SCALE_TAU_MS))
      scale.current = { s, at: now }
      dot.current?.setAttribute(
        'transform',
        `translate(${f(g.x * travel * r)} ${f(g.y * travel * r)}) scale(${s.toFixed(4)})`,
      )
      // The shadow takes the dot's size but not its position.
      shade.current?.setAttribute('transform', `scale(${s.toFixed(4)})`)
    },
    [r, travel, target],
  )
  useHubGaze(group, gaze, draw)

  const c = colors ?? discColors(mode)
  return (
    <g ref={group} className="pointer-events-none">
      <circle cy={OUTER_DROP * r} r={OUTER * r} fill="black" fillOpacity={OUTER_SHADOW} />
      <circle r={OUTER * r} fill={c.outer} />
      <circle ref={shade} r={look.shadow * r} fill={look.color} fillOpacity={look.alpha} />
      <circle ref={dot} r={INNER * r} fill={c.inner} />
    </g>
  )
}
