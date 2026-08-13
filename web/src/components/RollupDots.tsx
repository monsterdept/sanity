/** A pattern id from a file path.
 *
 *  Ids may not hold slashes or dots, and the obvious `replace(/[^a-zA-Z0-9]/g, '-')` is
 *  not injective — `a/b.rs` and `a-b.rs` both come out `a-b-rs`, and the two would share
 *  one grid, drawn at whichever of their angles React rendered second. Escaping to the
 *  character code cannot collide, because the escape is the one character it removes. */
export function dotsId(path: string): string {
  return `dots-${path.replace(/[^a-zA-Z0-9]/g, (c) => `-${c.charCodeAt(0)}-`)}`
}

/** Shorter side a roll-up needs, in real screen pixels, before it is worth texturing.
 *
 *  Measured rather than picked. Across depths and file sizes the roll-ups that read as one
 *  big function come out at 13.3, 16.4, 22.6, 25.4 and 32.2 pixels on the short side, and
 *  the ones that read as a sliver at 3.0, 6.2, 7.0, 7.4 and 7.6 — two populations either
 *  side of ten with nothing between them. That gap is not luck: a roll-up is large exactly
 *  when the code it stands for is, which is the same condition that makes it mistakable
 *  for a single large function. So the ones that need the mark can hold it, and the ones
 *  that cannot hold it do not need it.
 *
 *  At the pattern's 3.2-unit pitch, ten pixels is a 3x3 field of dots — enough to read as
 *  a texture rather than as specks.
 *
 *  Lives here rather than with the chart: it is the floor on this texture's own
 *  legibility, and both the ring and the unrolled file view have to apply the same one. */
export const ROLLUP_TEXTURE_PX = 10

/**
 * The texture that says a patch is a collection, not a function.
 *
 * The roll-up's area is honest — it is the lines of everything the wedge could not draw
 * one by one — but honest size gave it a new way to mislead: at 25 or 30 pixels a side it
 * is the largest patch in its file and it is drawn exactly like a function, so it reads
 * as one enormous cold function rather than as four hundred small ones.
 *
 * Dots rather than stripes, because the stale hatch is already 45° stripes and both marks
 * appear on the same ring. Two textures that both mean "this patch is a different kind of
 * claim" have to be told apart at a glance or neither means anything. A field of dots also
 * says the right thing on its own terms — many small things — which stripes do not.
 *
 * Painted in `--background`, the same color as the cut between two patches. So the
 * roll-up is drawn in the visual language the tiling already uses for "these are
 * separate": it reads as a patch full of separations, which is what it stands for.
 *
 * Only on roll-ups big enough to hold it — see `ROLLUP_TEXTURE_PX`. The rule the stale
 * hatch states for itself applies here too: a mark on every patch is not information.
 */
/** Half the tile, which is where the dot sits. */
const HALF = 1.6

export function RollupDots({
  id,
  angle,
  cx,
  cy,
}: {
  id: string
  angle: number
  /** The patch's own center, in user units. */
  cx: number
  cy: number
}) {
  const deg = (angle * 180) / Math.PI - 90
  const rad = (deg * Math.PI) / 180
  // Where the tile's dot lands once the lattice is turned. Subtracting it from the
  // patch's center is what puts a dot exactly there — `translate` then `rotate` means a
  // pattern-space point `p` is drawn at `T + R(θ)p`, so `T = C − R(θ)·(HALF, HALF)`.
  const dx = HALF * Math.cos(rad) - HALF * Math.sin(rad)
  const dy = HALF * Math.sin(rad) + HALF * Math.cos(rad)
  return (
    <defs>
      {/*
        Turned to the wedge it fills, which is why this takes an angle and is emitted per
        roll-up instead of once in a shared `<defs>`.

        A pattern is laid out in the user space, so one grid serves the whole chart and
        every roll-up gets the same upright rows — which read as a texture laid OVER the
        map rather than as something belonging to the patch, and are conspicuously out of
        true against a patch whose own edges are radial. Every other mark in this chart
        takes the ring's orientation; the dots were the one thing that did not.

        A rotation, not a curve: the grid is aligned to the patch's MID-angle, so the rows
        are tangent to the arc at the middle and drift from it toward the sides. Over a
        patch of thirty pixels at a radius of two hundred that is a fraction of a dot, and
        the alternative is a per-patch curved fill for a texture whose whole job is to be
        read as "many, small".
      */}
      <pattern
        id={id}
        width={HALF * 2}
        height={HALF * 2}
        patternUnits="userSpaceOnUse"
        // Turned, and then put where the patch is.
        //
        // A pattern is anchored to the user space's origin — here, the hub of the whole
        // chart — so without the translate every patch shows whichever slice of one
        // global lattice it happens to overlap. Two roll-ups the same size came out with
        // their dots in different places relative to their own edges, and neither had a
        // dot in the middle, which reads as a texture the patch was cut out of rather
        // than one belonging to it.
        //
        // Angles run clockwise from twelve o'clock, so the outward direction at `angle`
        // is (sin, −cos) — the +x axis turned by `angle − 90`.
        patternTransform={`translate(${cx - dx} ${cy - dy}) rotate(${deg})`}
      >
        {/* At the tile's center, not its corner. A pattern clips its content to the tile,
            so a dot on the corner renders as a quarter of itself. */}
        <circle cx={HALF} cy={HALF} r={0.7} fill="var(--background)" fillOpacity={0.85} />
      </pattern>
    </defs>
  )
}
