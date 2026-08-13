import type { Node } from './api'
import type { Wedge } from './sunburst'

/**
 * The motion between two levels of the ring.
 *
 * The old transition remounted the art group and played one CSS keyframe on it: the new
 * picture faded in from `scale(0.86)` or `scale(1.14)`, and the old one was simply gone.
 * Four things were wrong with that, and they need four different answers.
 *
 * **Nothing left.** The outgoing view was unmounted the instant the root changed, so what
 * you actually saw was a hard cut followed by an ease-in. Wedges that are going away are
 * animated out here.
 *
 * **Nothing was continuous.** A whole-group `scale` cannot say WHICH wedge you went into —
 * the directory you clicked did not become the new ring, it just vanished along with
 * everything else. Here every wedge that exists on both sides is matched by id and moves
 * from where it was to where it belongs, which is what makes the clicked wedge visibly
 * open out into the circle.
 *
 * **Direction was guessed from a string length** (`root.path.length >= prev.length`). That
 * is right for parent/child moves by luck rather than by construction; `direction` below
 * asks the actual question, which is whether one path contains the other.
 *
 * **There was a second, un-animated scale underneath it.** The viewBox is refitted to the
 * content in a layout effect, so the user-unit-to-pixel mapping snapped on the same frame
 * the CSS transform started easing, and the two composed into a jump whose size depended
 * on the shape of the new level. Interpolating the geometry fixes that one for free: the
 * refit now runs against content that is moving, so the box tracks it continuously.
 *
 * ## Why interpolate geometry at all, when `.wedge` deliberately does not transition `d`
 *
 * Because the expensive thing is not the arcs, it is the FUNCTIONS. A repo view holds a
 * couple of hundred directory and file arcs and several thousand function patches, and it
 * was the patches that made per-frame `d` unaffordable. So the structure — the part that
 * carries the "where am I" question — is interpolated honestly, and the tiling inside the
 * files is not drawn at all while the rings are in flight. It arrives at the end, which is
 * also when it is worth reading.
 */
export interface Geo {
  a0: number
  a1: number
  r0: number
  r1: number
}

/** Where the ring is going, and which way that reads as. */
export type Direction = 'in' | 'out' | 'across'

/**
 * Whether `child` sits under `parent`, by path.
 *
 * The repo root's path is empty, which makes it a prefix of everything — so the separator
 * has to be part of the test, or `src` would count as an ancestor of `src-tauri`.
 */
function under(child: string, parent: string): boolean {
  if (parent === '') return child !== ''
  return child.startsWith(`${parent}/`)
}

/**
 * Which way the ring moved.
 *
 * `across` is a real case and not a rounding of the other two: the summary panel's hot
 * list can send you to any node in the repo, so two levels can be related by neither
 * containment. Making that a third answer means the motion can decline to claim a
 * direction rather than asserting the wrong one.
 */
export function direction(fromPath: string, toPath: string): Direction {
  if (fromPath === toPath) return 'across'
  if (under(toPath, fromPath)) return 'in'
  if (under(fromPath, toPath)) return 'out'
  return 'across'
}

/**
 * The geometry of every DRAWN wedge in a layout, by node id.
 *
 * Functions are excluded, and leaving them in was a real bug rather than waste. `layout`
 * assigns them a ring of their own one level beyond their file — that is how it sizes
 * them — but they are never drawn there: `tileFunctions` puts them INSIDE their file's
 * band. So their notional radii run a whole band past the outermost thing on screen, and
 * anything computed from this map inherits that. The extent did, so the box was fitted
 * around a ring nobody draws and the composition sat small in the middle of it.
 *
 * The size of the error is the size of a band, which is why it looked like different zoom
 * levels were differently wrong. A directory of files has one structural ring, so its band
 * is the WHOLE radius and the phantom function ring doubled the extent — `src/convert/
 * pipeline` was fitted to 617 units of a 340-unit picture and drew at about half the
 * height it had. The repo root has four structural rings, so its band is a quarter of the
 * radius and it only lost a fifth. `getBBox` never saw any of this, because it measures
 * what was painted.
 */
export function geoOf(
  wedges: Wedge[],
  rInner: number,
  band: number,
  gapOf: (kind: string) => number,
): Map<string, Geo> {
  const m = new Map<string, Geo>()
  for (const w of wedges) {
    if (w.node.kind === 'func') continue
    const r0 = rInner + (w.depth - 1) * band
    m.set(w.node.id, { a0: w.a0, a1: w.a1, r0, r1: r0 + band - gapOf(w.node.kind) })
  }
  return m
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export function lerpGeo(a: Geo, b: Geo, t: number): Geo {
  return {
    a0: lerp(a.a0, b.a0, t),
    a1: lerp(a.a1, b.a1, t),
    r0: lerp(a.r0, b.r0, t),
    r1: lerp(a.r1, b.r1, t),
  }
}

/** Everything above this node in its own path, nearest first. Ids are paths for
 *  directories and files, which is what makes this a string walk rather than a tree one. */
function ancestors(id: string): string[] {
  const out: string[] = []
  let p = id
  while (p.includes('/')) {
    p = p.slice(0, p.lastIndexOf('/'))
    out.push(p)
  }
  out.push('')
  return out
}

/**
 * Where a wedge that was not on screen should come from.
 *
 * Out of its nearest visible ancestor, which is the honest answer: a file appearing
 * because you stepped up a level was, a moment ago, inside the directory you were in, and
 * growing out of that directory's old position says so. Falling back to a point on the
 * inner edge of its own ring — rather than to nothing, or to the hub — keeps a wedge with
 * no visible ancestor from flying in from somewhere it never was.
 */
export function enterFrom(id: string, target: Geo, was: Map<string, Geo>): Geo {
  for (const a of ancestors(id)) {
    const g = was.get(a)
    if (g) return g
  }
  const mid = (target.a0 + target.a1) / 2
  return { a0: mid, a1: mid, r0: target.r0, r1: target.r0 }
}

/**
 * Where a wedge that is leaving should go.
 *
 * Drilling IN magnifies: what you are not going into passes outward and off the rim, the
 * way scenery does when you move toward something. Drilling OUT is the same motion
 * reversed — the levels you are leaving behind fall back toward the hub. `across` has no
 * story to tell, so those simply fade where they stand rather than inventing one.
 */
export function exitTo(from: Geo, dir: Direction, rInner: number, rOuter: number): Geo {
  if (dir === 'in') {
    const push = (rOuter - rInner) * 0.55
    return { ...from, r0: from.r0 + push, r1: from.r1 + push }
  }
  if (dir === 'out') {
    const pull = (from.r0 - rInner) * 0.75
    return { ...from, r0: from.r0 - pull, r1: from.r1 - pull }
  }
  return from
}

/**
 * How long the ring takes to change level, in milliseconds.
 *
 * Barely longer than the 260ms it replaced. The first attempt at this was 420ms, on the
 * argument that the eye is now being asked to FOLLOW a wedge rather than watch a fade and
 * needs longer to do it. That argument is right about what the eye is doing and wrong
 * about the number: a level change is a navigation, it happens on a double-click, and
 * anything that outlasts the gesture reads as the app thinking rather than as the map
 * moving. The motion is legible this short because it is now continuous — there is no cut
 * to cover, which is what the extra time was really paying for. 420 was tried first and
 * read as the app thinking; 300 still did once the detail stopped arriving late.
 */
export const ZOOM_MS = 260

/**
 * Ease in and out, symmetric.
 *
 * The old curve was `cubic-bezier(.2, .8, .3, 1)` — nearly all deceleration, which is
 * right for something appearing and wrong for something traveling. A wedge that starts
 * at full speed reads as having been thrown; easing both ends reads as having been moved.
 */
export function ease(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * What the detail does while the rings move: nothing.
 *
 * The tiling, the labels and the hub's name are not drawn during a level change at all.
 * The first version faded them in on an interpolated opacity over the tail of the
 * transition, which meant rendering them — and so re-running `tileFunctions` across every
 * file — on every frame of that tail. A few thousand patches re-tiled ten times over is
 * the exact cost this whole design exists to avoid, and it is why the transition felt
 * heavy even after the geometry was cheap.
 *
 * They mount when the movement ends and fade in through CSS (`.patches-in`), which costs
 * one composited property and no React work at all. The constant that used to say when
 * the fade began is gone with it: the answer is "when the ring stops".
 *
 * Kept as a note on the file rather than on the interface below it: the constant this was
 * written for is gone, and a doc comment adjacent to the next declaration is a doc comment
 * ABOUT it — to rustdoc, to an editor, and to the reader this repo hands it to.
 */

/** A wedge that is on its way out, carried through the transition with its own geometry. */
export interface Exiting {
  node: Node
  depth: number
  index: number
  from: Geo
  to: Geo
}

/** The hub disc, as a geometry a wedge can travel to. The inset matches the circle drawn
 *  at the middle of the chart, so a directory collapsing into it lands exactly on it. */
export function hubGeo(rInner: number): Geo {
  return { a0: 0, a1: Math.PI * 2, r0: 0, r1: rInner - 4 }
}

/** The drawn box: where it is centered and how wide, in user units. */
export interface View {
  cx: number
  cy: number
  side: number
}

/**
 * The extent of a set of annular sectors, computed rather than measured.
 *
 * `getBBox` was the obvious way and is the wrong one once the wedges move, for a reason
 * that only shows up in motion: it reports the extent of whatever is on screen THIS
 * frame. At the start of a drill-in every arriving wedge is still collapsed onto its
 * ancestor, so the union of them is a small lopsided shape somewhere off to one side —
 * the box centers on that, the hub is drawn at the origin, and the whole composition
 * appears to start low and slide up as the ring opens out. The measurement was honest and
 * the picture was still wrong, because a viewBox fitted to a half-finished animation is
 * fitting to something nobody asked to see.
 *
 * So the box is fitted to where the wedges are GOING, and interpolated to it. The extremes
 * of an annular sector are its four corners plus whichever axis crossings its arc contains
 * — that is the whole of it, since `x = r sin a` and `y = −r cos a` are monotonic between
 * quarter turns.
 */
export function extentOf(geos: Iterable<Geo>, hubR: number): {
  x0: number
  x1: number
  y0: number
  y1: number
} {
  // The hub is always drawn and always at the origin, so it is part of the extent — and
  // it is what keeps a sparse level from being fitted to one lonely arc.
  let x0 = -hubR
  let x1 = hubR
  let y0 = -hubR
  let y1 = hubR
  const at = (r: number, a: number) => {
    const x = r * Math.sin(a)
    const y = -r * Math.cos(a)
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  for (const g of geos) {
    if (g.r1 <= 0 || g.a1 <= g.a0) continue
    at(g.r0, g.a0)
    at(g.r0, g.a1)
    at(g.r1, g.a0)
    at(g.r1, g.a1)
    // Quarter turns inside the span, where sin and cos turn over. Walked from the first
    // multiple of π/2 at or after `a0` so a span crossing twelve o'clock is covered.
    const first = Math.ceil(g.a0 / (Math.PI / 2)) * (Math.PI / 2)
    for (let a = first; a <= g.a1; a += Math.PI / 2) at(g.r1, a)
  }
  return { x0, x1, y0, y1 }
}

/** Fit a square box around an extent, with room to breathe and more of it at the bottom
 *  where the legend and the hidden-count chip are overlaid in HTML the box cannot see. */
export function viewFor(
  e: { x0: number; x1: number; y0: number; y1: number },
  margin: number,
  chromeBottom: number,
): View {
  const reach = Math.max(e.x1 - e.x0, e.y1 - e.y0) / 2
  const m = reach * margin
  const x0 = e.x0 - m
  const x1 = e.x1 + m
  const y0 = e.y0 - m
  const y1 = e.y1 + m + reach * chromeBottom
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    side: Math.max(x1 - x0, y1 - y0),
  }
}

export function lerpView(a: View, b: View, t: number): View {
  return {
    cx: lerp(a.cx, b.cx, t),
    cy: lerp(a.cy, b.cy, t),
    side: lerp(a.side, b.side, t),
  }
}

export const viewBoxOf = (v: View) =>
  `${v.cx - v.side / 2} ${v.cy - v.side / 2} ${v.side} ${v.side}`
