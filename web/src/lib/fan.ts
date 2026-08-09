import { rOf, vOf } from './sunburst'
import { extentOf } from './zoom'

/**
 * Opening one file's wedge into a fan.
 *
 * The file view was a rectangular treemap, unrolled out of the wedge. It read well and it
 * was the wrong shape: the app is one geometry, which is the whole argument that killed
 * `FileStack`, and a rectangle was a second one arriving by a different door. Everything
 * awkward about that version came from the same root — the destination was not a sector,
 * so the motion had to leave polar, which meant blending positions rather than curvature
 * and left the arcs sliding instead of straightening.
 *
 * A file now opens into a big sector on its own bearing, with the hub as its core. Two
 * problems stop existing rather than being solved.
 *
 * **There is no morph.** Source and destination are both annular sectors, so the movement
 * is `arcPath` over an interpolated `(θ, v)` box — the same thing `zoom.ts` already does
 * to every wedge. No sampled polygons, no projection, no path grammar that changes
 * partway.
 *
 * **The tiling can be laid out where it will be READ.** Both boxes are rectangles in
 * `(θ, v)`, so the map between them is affine there: a tiling squarified for the fan,
 * pulled back to the wedge, is still a valid tiling of the wedge, and so is every frame in
 * between. That is what makes it safe to squarify against the shape the reader actually
 * looks at instead of against the sliver it came from. Between a sector and a RECTANGLE
 * that was not true, which is why the previous version had to tile in the source and wear
 * the distortion at rest.
 */

/** A wedge as the rectangle it really is: angles as themselves, radii as `v = r²/2`. */
export interface Sector {
  a0: number
  a1: number
  v0: number
  v1: number
}

export const sectorOf = (a0: number, a1: number, r0: number, r1: number): Sector => ({
  a0,
  a1,
  v0: vOf(r0),
  v1: vOf(r1),
})

/** The polar box a sector describes, ready for `arcPath`. */
export interface Arc {
  a0: number
  a1: number
  r0: number
  r1: number
}

export const arcOf = (s: Sector): Arc => ({
  a0: s.a0,
  a1: s.a1,
  r0: rOf(s.v0),
  r1: rOf(s.v1),
})

/** The fan's rim, in the ring's own user units.
 *
 *  Nominal, and it cancels — see the note on shape below. It is here so the fan is built in
 *  the same units as everything else, not because its value decides anything. */
export const RIM = 340

/** How wide a fan may open, and how much of its radius the core keeps.
 *
 *  **The total radius is not a free choice — it is not a choice at all.** The viewBox is
 *  fitted to what is drawn, so `RIM` cancels: double it and the fit halves the scale, and
 *  the same number of pixels comes out. What decides how many functions can be drawn is the
 *  SHAPE — the span, and the core's share of the radius — because capacity is the sector's
 *  area in real pixels over `MIN_PATCH_PX`, and shape is the only part of that the fit does
 *  not normalise away.
 *
 *  So the span is measured rather than picked: `fanFor` tries the range and keeps whichever
 *  puts the most area on screen once the pane has had its say. The BOUNDS are the design
 *  decision the measurement cannot make — area rises all the way to a full circle, and a
 *  full circle is not a fan. Past about 150° the core stops reading as a core and the
 *  picture stops saying "one wedge, opened".
 */
const MIN_SPAN = (55 * Math.PI) / 180
const MAX_SPAN = (150 * Math.PI) / 180

/** The core's share of the radius.
 *
 *  Every unit of it is area the functions do not get — the core costs `share²` of the disc
 *  — and it has one job: be the way back, and hold the file's name. Sized for that rather
 *  than inherited from the ring, where the hub also has to be the target for a whole level
 *  and sits at 62 of 340. */
const CORE_SHARE = 0.16

/** Candidate spans, in degrees. Coarse on purpose: the area curve is flat near its peak, so
 *  a finer search would choose between shapes nobody can tell apart while making the span
 *  jitter as a window is dragged. */
const STEP = 5

const deg = (r: number) => (r * 180) / Math.PI

/**
 * Where a file opens when there is no wedge to open OUT of.
 *
 * Keeping the bearing answers "where am I" from the picture — but only when there was a
 * picture. Three routes into a file have none: a restored session, a project opened
 * straight into a file, and History, where the rings are rebuilt from a different tree
 * and the file's wedge in the LIVE map is not a wedge this composition ever drew.
 *
 * That case was written down and then not handled — `fileFrom` said "drawn where it lands
 * rather than flown in from a wedge that was never there" and set null, which every
 * consumer read as "draw nothing". The result was a file view holding only its own hub,
 * with the viewBox fitted to a 58-unit disc and blowing it up to fill the pane: the whole
 * file, present in the tree and counted under the transport, drawn as an empty circle.
 *
 * Straight up, because with no wedge to inherit from there is nothing to be faithful to,
 * and up is the one bearing that is not a claim about where you came from.
 */
const NO_WEDGE_BEARING = 0

/**
 * Where a file's wedge opens to: same bearing, as much of the pane as its shape can hold.
 *
 * Keeping the bearing is the point. It answers "where am I" from the picture rather than
 * from the breadcrumb — the wedge you double-clicked grows in place instead of being
 * replaced by a composition that could have come from anywhere. It also means the pane is
 * used differently depending on where you clicked, and that is a cost paid deliberately: a
 * fan aimed into a corner has a worse bounding box than one aimed along an axis, and
 * correcting it would mean spinning the composition away from the thing it grew out of.
 *
 * The span is then measured for that bearing. Each candidate is fitted to the pane exactly
 * as the viewBox will fit it, and the one putting the most area on screen wins — which is
 * the same thing as "holds the most functions", since a patch has a floor in real pixels
 * and capacity is area over that floor.
 */
export function fanFor(src: Sector | null, paneAspect = 1): Sector {
  // Null is a file with no wedge behind it — see `NO_WEDGE_BEARING`.
  const mid = src ? (src.a0 + src.a1) / 2 : NO_WEDGE_BEARING
  const rim = RIM
  const core = rim * CORE_SHARE
  let best = { span: MIN_SPAN, area: -1 }
  for (let d = Math.round(deg(MIN_SPAN)); d <= Math.round(deg(MAX_SPAN)); d += STEP) {
    const span = (d * Math.PI) / 180
    const e = extentOf([{ a0: mid - span / 2, a1: mid + span / 2, r0: core, r1: rim }], core)
    const w = e.x1 - e.x0
    const h = e.y1 - e.y0
    if (w <= 0 || h <= 0) continue
    // The fit the viewBox will actually apply: scale to whichever axis binds.
    const scale = Math.min(paneAspect / w, 1 / h)
    const area = 0.5 * span * (rim * rim - core * core) * scale * scale
    if (area > best.area) best = { span, area }
  }
  return { a0: mid - best.span / 2, a1: mid + best.span / 2, v0: vOf(core), v1: vOf(rim) }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** The sector part-way between two, interpolated in `(θ, v)`.
 *
 *  In `v`, not in `r`. Area is `Δθ × Δv`, so a straight line in `v` is a straight line in
 *  area — the fan grows at an even rate rather than lurching as `√` catches up. It is also
 *  the space the cells are placed in, so one interpolation serves both and they cannot come
 *  apart. */
export function lerpSector(a: Sector, b: Sector, t: number): Sector {
  return {
    a0: lerp(a.a0, b.a0, t),
    a1: lerp(a.a1, b.a1, t),
    v0: lerp(a.v0, b.v0, t),
    v1: lerp(a.v1, b.v1, t),
  }
}

const share = (lo: number, hi: number, at: number) => (hi > lo ? (at - lo) / (hi - lo) : 0)

/**
 * A cell's place inside `live`, given where it sits inside `dest`.
 *
 * The affine map, and the whole reason this shape works. A cell holds the same fraction of
 * the box at every frame, so the tiling stays a tiling: no gaps open, no two patches
 * overlap, and nothing has to be re-tessellated to move. Laid out once against the fan,
 * carried back to the wedge by arithmetic.
 */
export function place(cell: Arc, dest: Sector, live: Sector): Arc {
  const a = (x: number) => live.a0 + share(dest.a0, dest.a1, x) * (live.a1 - live.a0)
  const v = (r: number) => live.v0 + share(dest.v0, dest.v1, vOf(r)) * (live.v1 - live.v0)
  return { a0: a(cell.a0), a1: a(cell.a1), r0: rOf(v(cell.r0)), r1: rOf(v(cell.r1)) }
}

/** The middle of an arc, in screen coordinates. Angles run clockwise from twelve o'clock,
 *  matching `arcPath`, so outward at `a` is `(sin a, −cos a)`. */
export function centre(g: Arc): { x: number; y: number; r: number; a: number } {
  const a = (g.a0 + g.a1) / 2
  const r = (g.r0 + g.r1) / 2
  return { x: r * Math.sin(a), y: -r * Math.cos(a), r, a }
}

/** Roughly how much room a patch has for a horizontal label: its arc width at mid-radius,
 *  against its radial height.
 *
 *  The cost of staying polar. A rectangle held a horizontal name across its whole width; a
 *  patch out on the fan is a trapezoid, and near the ends of the arc a sheared one. Taking
 *  the arc at MID radius is the conservative read — the inner edge is always narrower. */
export function room(g: Arc): { w: number; h: number } {
  return { w: (g.a1 - g.a0) * ((g.r0 + g.r1) / 2), h: g.r1 - g.r0 }
}
