/**
 * What the middle of the map holds: the monster, a balance wheel, an eye, or nothing.
 *
 * **Only the picture in the middle changes.** The hub disc stays, and so does the layer the
 * monster stands on: that layer carries the findings count and its click, which is the map's
 * only way into the findings panel, and the double-click that goes up a level. Choosing anything
 * but `monster` takes the creature out of it and leaves both of those where they were.
 *
 * Display preferences, stored like the ring count (`rings.ts`): the same person wants the same
 * middle whatever repo is open, so neither is per project.
 */

export type HubCenter = 'monster' | 'wheel' | 'eye' | 'nothing'

export const HUB_CENTERS: HubCenter[] = ['monster', 'wheel', 'eye', 'nothing']

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

export function loadHubCenter(): HubCenter {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw && (HUB_CENTERS as string[]).includes(raw)) return raw as HubCenter
  } catch {
    /* storage unavailable — the default is a fine answer */
  }
  return 'monster'
}

export function saveHubCenter(center: HubCenter): void {
  try {
    localStorage.setItem(KEY, center)
  } catch {
    /* the preference just won't survive a restart */
  }
}

export function loadWheelHz(): number {
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
