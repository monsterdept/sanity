/**
 * What the middle of the map holds: the monster, a balance wheel, an eye, or two circles.
 *
 * **Only the picture in the middle changes.** The hub disc stays, and so does the layer the
 * monster stands on: that layer carries the findings count and its click, which is the map's
 * only way into the findings panel, and the double-click that goes up a level. Choosing anything
 * but `monster` takes the creature out of it and leaves both of those where they were.
 *
 * Display preferences, stored like the ring count (`rings.ts`): the same person wants the same
 * middle whatever repo is open, so neither is per project.
 */

export type HubCenter = 'monster' | 'wheel' | 'eye' | 'circles'

/** Whether the toolbar shows the hub's controls: the monster/wheel/eye/circles toggle and the
 *  circles' `tune` panel. **Off, the stored choices are not read either**: a preference with no
 *  control left to change or reset it is a setting nobody can see, so the hub takes the defaults
 *  below. Flip it back and the stored ones apply again. */
export const HUB_CONTROLS = false

/** A stored `nothing`, the option `circles` replaced, is not in this list, so it loads as the
 *  default rather than as a middle that no longer exists. */
export const HUB_CENTERS: HubCenter[] = ['monster', 'wheel', 'eye', 'circles']

const KEY = 'sanity.hub'
const HZ_KEY = 'sanity.hub.wheelHz'

/**
 * How fast the balance wheel may swing, in full swings a second.
 *
 * The top is where the picture breaks, not where taste stops. At one swing a second the fastest
 * frame (60 a second) moves the wheel about 30° as it passes through the middle, and the step
 * grows with the speed. Past 60° a frame the three arms, 120° apart, alias: the eye pairs each
 * arm with its neighbour and the wheel turns backwards. 2 is 60°.
 *
 * The bottom is one swing in twenty seconds, which is most of the way to still. That makes the
 * range fiftyfold, so the slider is logarithmic (`wheelHzAt`, `wheelPosOf`): on a linear track
 * everything slower than half a swing a second would be the first sixth of it.
 */
export const WHEEL_HZ = { min: 0.05, max: 2, initial: 1 } as const

/** The speed at slider position `pos` (0–1), rounded to two significant figures so the label
 *  and the stored preference are numbers a person would say. */
export function wheelHzAt(pos: number): number {
  const hz = WHEEL_HZ.min * Math.pow(WHEEL_HZ.max / WHEEL_HZ.min, pos)
  return Math.min(WHEEL_HZ.max, Math.max(WHEEL_HZ.min, Number(hz.toPrecision(2))))
}

/** The slider position (0–1) that shows speed `hz`. */
export function wheelPosOf(hz: number): number {
  return Math.log(hz / WHEEL_HZ.min) / Math.log(WHEEL_HZ.max / WHEEL_HZ.min)
}

/**
 * The circles' three controls: the shadow the dot floats over (its radius, colour and strength)
 * and how far the dot travels. Sizes are shares of the hub's radius.
 *
 * The shadow is centred under the dot's rest position and holds still. Offset below the dot, it
 * was uncovered by every glance up and hidden by every glance down, and the dot seemed to look up
 * more than down. Centred, it shows the same on every side.
 *
 * `travel` tops out where the dot's edge would reach the dark disc's: 0.34 + 0.26 = 0.6.
 *
 * `step` is how much the dot shrinks for each level drilled in, and grows back coming out: at
 * depth `d` it is drawn at `(1 − step)^d` of its size at the repo root.
 */
export interface CirclesLook {
  shadow: number
  color: string
  alpha: number
  travel: number
  step: number
  /** The whole drawing's scale, discs, shadow and travel together. 1 is the sizes in
   *  `HubCircles`; 1.6 takes the dark disc almost to the hub's rim. */
  size: number
  /** Whether the dot follows the pointer. Off, it follows only the flashing wedges and its own
   *  glances, which is the eye's idle sequence without the part that answers the mouse. */
  mouse: boolean
  /** Whether the dot moves of its own accord: idle glances, glances away from what it is
   *  looking at, and the jitter. Off, it looks only at the flashing wedges, the clicked one and
   *  the pointer (if `mouse`), and rests in the middle otherwise. */
  idle: boolean
  /** One more circle for each level drilled in: `2 + depth` of them, two at the repo root. The
   *  outer disc keeps its size and the dot keeps its `step`; the circles between are spaced
   *  geometrically, each the same fraction of the one outside it, and blend from the outer
   *  colour to the dot's. Each drifts in proportion to how far in it sits. */
  nest: boolean
}

export const CIRCLES = {
  shadow: { min: 0.3, max: 0.6 },
  alpha: { min: 0, max: 1 },
  travel: { min: 0, max: 0.26 },
  step: { min: 0, max: 0.5 },
  size: { min: 0.5, max: 1.6 },
  initial: {
    shadow: 0.32,
    color: '#000000',
    alpha: 0.1,
    travel: 0.075,
    step: 0.24,
    size: 1,
    mouse: false,
    idle: false,
    nest: true,
  } as CirclesLook,
} as const

const CIRCLES_KEY = 'sanity.hub.circles'

export function loadCirclesLook(): CirclesLook {
  if (!HUB_CONTROLS) return CIRCLES.initial
  const clamp = (n: unknown, { min, max }: { min: number; max: number }, or: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : or
  const d = CIRCLES.initial
  try {
    const raw = JSON.parse(localStorage.getItem(CIRCLES_KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      return {
        shadow: clamp(raw.shadow, CIRCLES.shadow, d.shadow),
        color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : d.color,
        alpha: clamp(raw.alpha, CIRCLES.alpha, d.alpha),
        travel: clamp(raw.travel, CIRCLES.travel, d.travel),
        step: clamp(raw.step, CIRCLES.step, d.step),
        size: clamp(raw.size, CIRCLES.size, d.size),
        mouse: typeof raw.mouse === 'boolean' ? raw.mouse : d.mouse,
        idle: typeof raw.idle === 'boolean' ? raw.idle : d.idle,
        nest: typeof raw.nest === 'boolean' ? raw.nest : d.nest,
      }
    }
  } catch {
    /* as above */
  }
  return d
}

export function saveCirclesLook(look: CirclesLook): void {
  try {
    localStorage.setItem(CIRCLES_KEY, JSON.stringify(look))
  } catch {
    /* as above */
  }
}

export function loadHubCenter(): HubCenter {
  if (!HUB_CONTROLS) return 'circles'
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && (HUB_CENTERS as string[]).includes(raw)) return raw as HubCenter
  } catch {
    /* storage unavailable — the default is a fine answer */
  }
  return 'circles'
}

export function saveHubCenter(center: HubCenter): void {
  try {
    localStorage.setItem(KEY, center)
  } catch {
    /* the preference just won't survive a restart */
  }
}

export function loadWheelHz(): number {
  if (!HUB_CONTROLS) return WHEEL_HZ.initial
  try {
    const n = Number(localStorage.getItem(HZ_KEY))
    if (Number.isFinite(n) && n >= WHEEL_HZ.min && n <= WHEEL_HZ.max) return n
  } catch {
    /* as above */
  }
  return WHEEL_HZ.initial
}

export function saveWheelHz(hz: number): void {
  try {
    localStorage.setItem(HZ_KEY, String(hz))
  } catch {
    /* as above */
  }
}
