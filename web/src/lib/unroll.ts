import { rOf, vOf } from './sunburst'

/**
 * Unrolling a file's wedge into the pane.
 *
 * The file view used to be its own thing — a vertical stack of rows, laid out in pixels,
 * sharing no geometry with the rings it was reached from. It was reached by drilling, and
 * what you got was a hard cut to a different picture: nothing on screen said the column
 * was the wedge you had just double-clicked, so the answer to "where am I" had to come
 * from the breadcrumb rather than from the movement.
 *
 * The wedge already holds the answer. `tileFunctions` tiles a file's functions across its
 * own sector, so what the ring shows IS a treemap of the file — just a small one, wrapped
 * around a circle. Zooming it is therefore not a change of representation, it is the same
 * cells getting bigger, and that is a thing motion can carry.
 *
 * # Why the (θ, v) space is the whole trick
 *
 * `vOf` substitutes `v = r²/2`, under which an annular sector's area is `Δθ × Δv` — a
 * plain product. That is already why the tiling squarifies honestly at every radius. It
 * pays a second time here: in `(θ, v)` a wedge is a RECTANGLE, so unrolling it to a
 * rectangle on screen is a change of projection and nothing else. Every patch keeps its
 * cell for the whole animation. Nothing is re-tessellated to move, nothing is matched by
 * id, and there is no frame on which a function is in two places.
 *
 * # Why this is affordable when patches-in-flight are not
 *
 * `Sunburst` deliberately does not draw the tiling while the rings move: a repo view holds
 * several thousand patches and re-tessellating them per frame is exactly the cost the
 * transition is arranged to avoid. That rule was priced against every file at once. Here
 * the subject is ONE file — tens of functions, low hundreds at worst — so the same
 * argument does not reach: projecting one file's patches per frame is nothing, and the
 * patches are the whole point of this particular movement rather than detail that can
 * arrive at the end.
 *
 * # What it costs
 *
 * A treemap cannot say "nothing here". The stack drew a function at its real offset, so
 * two hundred lines of imports were two hundred lines of gap; here the cells close up.
 * Order survives — `tileFunctions` keeps `children` order, which is file order — but
 * proportion does not, and that was the stack's best argument. See `spanWeights` for the
 * one cheap way to give it back.
 */

/** A wedge as the rectangle it really is: angles as themselves, radii as `v`. */
export interface Sector {
  a0: number
  a1: number
  v0: number
  v1: number
}

/** Where the unrolled file lands, in the same user units the rings are drawn in. */
export interface Pane {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

/** A patch as `tileFunctions` hands it back — polar, because that is what it draws. */
export interface Cell {
  a0: number
  a1: number
  r0: number
  r1: number
}

export const sectorOf = (c: Cell): Sector => ({
  a0: c.a0,
  a1: c.a1,
  v0: vOf(c.r0),
  v1: vOf(c.r1),
})

/**
 * Where a point of the wedge sits when the wedge is wrapped around the hub.
 *
 * Clockwise from twelve o'clock, matching `arcPath` and `zoom.ts`. Getting this wrong is
 * not subtle — the picture mirrors — but it is worth stating once here rather than being
 * rediscovered from the sign of a cosine.
 */
const wrapped = (a: number, v: number): Point => {
  const r = rOf(v)
  return { x: r * Math.sin(a), y: -r * Math.cos(a) }
}

/** Where that same point sits once the wedge is laid flat.
 *
 *  Angle runs left to right and radius runs bottom to top, which keeps the reading the
 *  ring already had: the outer edge of the band, the side nearer the rim, stays the side
 *  further from the middle of the picture. Flipping either axis here is what makes a zoom
 *  feel like a cut — the cells arrive somewhere they were not coming from. */
const flat = (a: number, v: number, from: Sector, to: Pane): Point => {
  const u = span(from.a0, from.a1, a)
  const s = span(from.v0, from.v1, v)
  return { x: to.x + u * to.w, y: to.y + (1 - s) * to.h }
}

/** Position within a range, guarded against the degenerate one. A file whose wedge has
 *  collapsed to nothing still has to project somewhere rather than to NaN, which would
 *  take the whole path string with it. */
const span = (lo: number, hi: number, at: number) => (hi > lo ? (at - lo) / (hi - lo) : 0)

/**
 * A point of the wedge, `t` of the way from wrapped to flat.
 *
 * **The blend is linear in position, and that is a first answer rather than the final
 * one.** It is continuous, it is exactly right at both ends, and over 260ms it reads as
 * the wedge opening out. What it is not is a true unrolling: mid-flight the arc does not
 * straighten so much as slide, because a straight line between two positions is not the
 * path a bending arc takes.
 *
 * The better morph blends CURVATURE — hold arc length and drive the bend from a full turn
 * to nothing — and it cannot be a drop-in for a band of real thickness, because unrolling
 * a thick annulus preserves the angular metric and the radial one only at a single radius.
 * Choosing which radius to keep honest is a judgement about how it looks, which is a thing
 * to make on screen rather than in the abstract.
 *
 * So this function is the only place the question lives. Everything below it works in
 * terms of `at()` and does not care, which is what keeps that upgrade a one-function
 * change rather than a rewrite.
 */
export function at(a: number, v: number, t: number, from: Sector, to: Pane): Point {
  if (t <= 0) return wrapped(a, v)
  if (t >= 1) return flat(a, v, from, to)
  const w = wrapped(a, v)
  const f = flat(a, v, from, to)
  return { x: w.x + (f.x - w.x) * t, y: w.y + (f.y - w.y) * t }
}

/**
 * How many points an arc edge is sampled into.
 *
 * The two radial edges of a patch are straight at every `t` — constant angle — so they
 * need no sampling at all. The two angular edges are arcs at `t = 0` and lines at
 * `t = 1`, and a blend of sampled points is what carries them continuously between.
 *
 * Eight is chosen against the patch, not the circle: a patch's angular span is a fraction
 * of one file's wedge, so its arc is nearly flat before it starts. At `t = 0` this is
 * visually indistinguishable from the real arc, which matters because frame zero has to
 * land exactly on what the ring is already drawing or the zoom begins with a flinch.
 */
export const ARC_SAMPLES = 8

/**
 * One patch, as an SVG path, `t` of the way out.
 *
 * A closed polygon rather than an arc command, at every `t` including zero. `A` cannot
 * describe a half-unrolled edge, and swapping the path GRAMMAR partway through an
 * animation is a repaint the eye catches — so the arc is sampled from the start and the
 * only thing that changes across the transition is where the points are.
 */
export function cellPath(c: Cell, t: number, from: Sector, to: Pane): string {
  const s = sectorOf(c)
  const pts: Point[] = []
  // Outer edge, a0 → a1; then inner edge back, a1 → a0. Sampling both in opposite
  // directions is what makes the ring closed without a seam to special-case.
  for (let i = 0; i <= ARC_SAMPLES; i++) {
    const a = s.a0 + ((s.a1 - s.a0) * i) / ARC_SAMPLES
    pts.push(at(a, s.v1, t, from, to))
  }
  for (let i = ARC_SAMPLES; i >= 0; i--) {
    const a = s.a0 + ((s.a1 - s.a0) * i) / ARC_SAMPLES
    pts.push(at(a, s.v0, t, from, to))
  }
  return `${pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join('')}Z`
}

/**
 * The pane an unrolled file should fill, given the room available.
 *
 * Centred and inset rather than bled to the edges: the unrolled file is still a picture of
 * one thing, and a treemap with no margin reads as a texture that continues past the
 * window. The inset is also where the labels the ring could never fit are allowed to sit
 * outside their cells without colliding with the edge of the world.
 */
export function paneFor(w: number, h: number, inset = 0.06): Pane {
  const m = Math.min(w, h) * inset
  return { x: -w / 2 + m, y: -h / 2 + m, w: w - m * 2, h: h - m * 2 }
}

/**
 * Weights that draw the gaps between functions, for a file that is mostly not functions.
 *
 * Not wired up, and offered here because it is the answer to the one thing the vertical
 * stack did better and this cannot: position was line number there, so two hundred lines
 * of imports were two hundred lines of nothing, and a sparse file LOOKED sparse. A tiling
 * closes up; the space between one function and the next has nowhere to go.
 *
 * Weighting each function by its span to the next one — its own lines plus the dead ground
 * before the next function starts — gives that back without drawing anything new: a
 * function preceded by a long stretch of declarations simply gets a bigger cell. What it
 * trades away is that a patch's area stops being exactly `loc`, which is a real cost,
 * because "area is lines, exactly, at every radius" is a property the tiling earned and
 * says out loud.
 *
 * So this is a decision to make deliberately, on a repo where it matters, and not a
 * default to discover later.
 */
export function spanWeights(fns: { line?: number | null; loc: number }[], fileLines: number): number[] {
  return fns.map((f, i) => {
    const next = fns[i + 1]
    const start = f.line ?? 0
    const end = next?.line ?? fileLines
    return Math.max(f.loc, end - start, 1)
  })
}

/** Which edge of the pane the way back belongs on. Top or bottom, never a side.
 *
 *  The horizontal edges only, and that is a constraint rather than a simplification. A
 *  side bar has to hold its label turned on its side, which is the one piece of text in
 *  the app you would have to tilt your head for; and it eats the axis the tiling can least
 *  afford, since an unrolled file is already wider than it is tall on any normal window.
 *  Two answers also means the affordance lands in one of two places rather than four,
 *  which is the difference between somewhere you look and somewhere you hunt for. */
export type Side = 'top' | 'bottom'

/**
 * The side the hub lies on, seen from a wedge at angle `aMid`.
 *
 * Not a preference — a fact about where the thing you came from actually is. A wedge at
 * angle `a` sits at `(sin a, -cos a)` from the hub, so its vertical offset is `-cos a`:
 * positive `cos` puts the wedge ABOVE the middle, and the way back below it. A wedge
 * across the top of the ring therefore returns downward, one across the bottom returns
 * upward. Point it anywhere else and the way back leads away from where you came from,
 * which is the one thing a back affordance must not do.
 *
 * A wedge level with the hub — three or nine o'clock — has no vertical answer, and takes
 * the bottom. There is no third option to give it and the bottom is where the eye already
 * expects a bar.
 */
export function homeSide(aMid: number): Side {
  return Math.cos(aMid) >= 0 ? 'bottom' : 'top'
}

/** The strip the return bar takes, and the pane left for the tiling.
 *
 *  The bar takes its room rather than covering the cells. The hub was a disc floating over
 *  the middle of the file, which is the one place a treemap has nothing to spare — it sat
 *  on top of whatever functions happened to be central and hid them completely. An edge
 *  the tiling is inset from costs the same area and hides nothing. */
export function withBar(pane: Pane, side: Side, thickness: number): { bar: Pane; inner: Pane } {
  const t = Math.min(thickness, pane.h / 3)
  return side === 'top'
    ? {
        bar: { x: pane.x, y: pane.y, w: pane.w, h: t },
        inner: { x: pane.x, y: pane.y + t, w: pane.w, h: pane.h - t },
      }
    : {
        bar: { x: pane.x, y: pane.y + pane.h - t, w: pane.w, h: t },
        inner: { x: pane.x, y: pane.y, w: pane.w, h: pane.h - t },
      }
}
