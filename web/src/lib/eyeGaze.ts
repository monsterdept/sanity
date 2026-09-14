/**
 * Where the hub's eye looks, and when it blinks: the creature's own rules, for an eye that has
 * no creature behind it.
 *
 * **Copied from the bundle's engine, not invented.** The eye is offered as the monster's gaze
 * without the monster. So it follows what the creature follows, in the same order, on the same
 * clocks:
 * - the flashing wedges, one at a time on `DWELL_MS`, when there is work to watch;
 * - otherwise the clicked wedge, when a caller passes one (the creature has no such rule;
 *   the hub's circles add it), with glances away on the idle cadence;
 * - otherwise the pointer, with a glance away every few seconds;
 * - otherwise, once the pointer has been still for `MOUSE_STALE_MS`, glances of its own.
 * Under all of it sits a small, constant jitter, and it blinks every two to six seconds. Every
 * number here is the bundle's default (`gazeAutoMinMs`, `blinkIntervalMin` and the rest in
 * `mascot.js`). The creature cannot simply be asked where it is looking, because in this mode
 * it is not mounted.
 *
 * Pure, with the random source passed in, so it can be stepped outside a window.
 */

/** How long the creature looks at one flashing wedge before moving to the next.
 *
 *  Long enough to read as attention rather than a twitch, short enough that a lull with three
 *  files in it still looks like something is happening. Shared with `MascotFigure`, so the eye
 *  and the creature glance between wedges on one rhythm. */
export const DWELL_MS = 900

/** Blinks: how often, how long one takes, and how far the lids close at the middle of it. */
export const BLINK = { minMs: 2000, maxMs: 6000, ms: 180, depth: 0.95 } as const

/** How long a still pointer is still worth watching. */
const MOUSE_STALE_MS = 2000
/** With nothing to watch, how long between glances of its own. */
const AUTO: Range = [1200, 4200]
/** How long it stays on a glance before its eyes move on. */
const HOLD: Range = [400, 1900]
/** While following the pointer: how often it looks away, and for how long. */
const DISTRACT_EVERY: Range = [5000, 12000]
const DISTRACT_FOR: Range = [500, 1200]
/** How fast the eyes close on a target, per 16ms. Faster when something is being watched. */
const PURSUIT = 0.15
/** The size of the constant micro-movement, as a share of the full look. */
const JITTER = 0.04

type Range = readonly [number, number]
type Rand = () => number
const within = (rand: Rand, [lo, hi]: Range) => lo + rand() * (hi - lo)

/** A direction to look, as a share of the furthest the eye can look: x right, **y down**, the
 *  screen's way. Anything longer than one is looked at as one. */
export interface Look {
  x: number
  y: number
}

export interface GazeState {
  /** Where the eye is looking now, and where it is heading. */
  x: number
  y: number
  tx: number
  ty: number
  /** Milliseconds left to stay put before moving toward the target. */
  hold: number
  /** Milliseconds until the next glance of its own. */
  auto: number
  /** Milliseconds left of a look away from the pointer, or 0 when not looking away. */
  distract: number
  /** Milliseconds of pointer-watching until the next look away. */
  nextDistract: number
  jx: number
  jy: number
  jitterIn: number
  /** Milliseconds until the next blink, and how far through the current one (−1 for none). */
  blinkIn: number
  blinkT: number
}

export interface GazeInput {
  /** The wedges being worked on, as directions — see `gaze` in `Sunburst` — or null. */
  focus: Look[] | null
  /** The direction of the wedge the reader clicked, or null. Not the creature's: the hub's
   *  circles add it. Looked at below the flashing wedges and above the pointer, with glances
   *  away on the idle cadence, so it reads as attention rather than a stare. */
  selected?: Look | null
  /** The pointer's direction from the eye, or null when there has been no pointer. */
  mouse: Look | null
  /** Milliseconds since the pointer last moved. */
  mouseAge: number
  /** Wall-clock milliseconds, which is what the dwell runs on, as the creature's does. */
  now: number
  /** Reduced motion: follow what is asked, and add nothing of its own. No glances, no jitter,
   *  no blinks. */
  still: boolean
  /** Whether it moves of its own accord: glances when there is nothing to look at, glances away
   *  from what it is looking at, and the jitter. Off, it looks only where it is asked and rests
   *  in the middle otherwise. Blinks are not part of it. Defaults to on. */
  idle?: boolean
}

export interface Gaze {
  /** Where to look, within the unit circle. */
  x: number
  y: number
  /** How far closed the lids are, 0 open to `BLINK.depth`. */
  closed: number
}

function randomLook(rand: Rand, least: number): Look {
  const a = rand() * 2 * Math.PI
  const m = least + rand() * (1 - least)
  return { x: Math.cos(a) * m, y: Math.sin(a) * m }
}

export function startGaze(rand: Rand = Math.random): GazeState {
  return {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    hold: 0,
    auto: 300 + rand() * 700,
    distract: 0,
    nextDistract: within(rand, DISTRACT_EVERY),
    jx: 0,
    jy: 0,
    jitterIn: 0,
    blinkIn: within(rand, [BLINK.minMs, BLINK.maxMs]),
    blinkT: -1,
  }
}

/** Advance the eye `dt` milliseconds. */
export function stepGaze(
  s: GazeState,
  dt: number,
  input: GazeInput,
  rand: Rand = Math.random,
): { state: GazeState; gaze: Gaze } {
  const n = { ...s }
  let watching = false
  const wander = !input.still && input.idle !== false

  if (input.focus && input.focus.length > 0) {
    const f = input.focus[Math.floor(input.now / DWELL_MS) % input.focus.length]
    n.tx = f.x
    n.ty = f.y
    n.distract = 0
    n.hold = 0
    watching = true
  } else if (input.selected) {
    // The clicked wedge, glanced away from as the idle sequence glances: every `AUTO`, for
    // `HOLD`, and back.
    if (n.distract > 0) {
      n.distract -= dt
      if (n.distract <= 0) n.nextDistract = within(rand, AUTO)
    } else {
      n.nextDistract -= dt
      if (wander && n.nextDistract <= 0) {
        n.distract = within(rand, HOLD)
        const l = randomLook(rand, 0.3)
        n.tx = l.x
        n.ty = l.y
      } else {
        n.tx = input.selected.x
        n.ty = input.selected.y
        n.hold = 0
        watching = true
      }
    }
    n.auto = 300 + rand() * 700
  } else if (input.mouse && input.mouseAge < MOUSE_STALE_MS) {
    if (n.distract > 0) {
      n.distract -= dt
      if (n.distract <= 0) n.nextDistract = within(rand, DISTRACT_EVERY)
    } else {
      n.nextDistract -= dt
      if (wander && n.nextDistract <= 0) {
        n.distract = within(rand, DISTRACT_FOR)
        const l = randomLook(rand, 0.4)
        n.tx = l.x
        n.ty = l.y
      } else {
        n.tx = input.mouse.x
        n.ty = input.mouse.y
        n.hold = 0
        watching = true
      }
    }
    // A pointer that goes still is followed by a glance of its own soon after, not at once.
    n.auto = 300 + rand() * 700
  } else if (!wander) {
    n.tx = 0
    n.ty = 0
    n.hold = 0
  } else {
    n.auto -= dt
    if (n.auto <= 0) {
      const l = randomLook(rand, 0.3)
      n.tx = l.x
      n.ty = l.y
      n.hold = within(rand, HOLD)
      n.auto = within(rand, AUTO)
    }
  }

  if (!wander) {
    n.jx = 0
    n.jy = 0
  } else {
    n.jitterIn -= dt
    if (n.jitterIn <= 0) {
      n.jx = (rand() - 0.5) * 2 * JITTER
      n.jy = (rand() - 0.5) * 2 * JITTER
      n.jitterIn = 40 + rand() * 120
    }
  }

  if (n.hold > 0) {
    n.hold -= dt
  } else {
    const rate = watching ? PURSUIT * 1.2 : PURSUIT * 0.8
    const k = 1 - Math.pow(1 - rate, dt / 16)
    n.x += (n.tx - n.x) * k
    n.y += (n.ty - n.y) * k
  }

  if (n.blinkT >= 0) {
    n.blinkT += dt / BLINK.ms
    if (n.blinkT >= 1) n.blinkT = -1
  } else if (!input.still) {
    n.blinkIn -= dt
    if (n.blinkIn <= 0) {
      n.blinkT = 0
      n.blinkIn = within(rand, [BLINK.minMs, BLINK.maxMs])
    }
  }

  let x = n.x + n.jx
  let y = n.y + n.jy
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  const closed = n.blinkT >= 0 ? Math.sin(n.blinkT * Math.PI) * BLINK.depth : 0
  return { state: n, gaze: { x, y, closed } }
}
