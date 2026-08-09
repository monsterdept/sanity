import { labelArc } from '../lib/sunburst'
import type { CSSProperties } from 'react'
import type { Placement } from '../lib/label'
import { FAMILY, OPACITY, TRACKING, WEIGHT } from '../lib/labelStyle'

/**
 * A name drawn in a wedge, either way round.
 *
 * One renderer for the ring and the fan. They were two — `labelArc` plus a textPath in
 * `Sunburst`, a horizontal `<text>` in `FileZoom` — solving the same problem with different
 * answers, which is the shape of drift this repo keeps paying for. Where the label goes is
 * `fitLabel`'s business; this only draws what it decided.
 *
 * How it looks — face, weight, tracking, and how it is separated from its wedge — comes
 * from `labelStyle`, live, because those are optical questions and the only honest way to
 * settle one is to look at it.
 */
export function WedgeLabel({
  at,
  id,
  fill = 'var(--foreground)',
  opacity,
}: {
  at: Placement
  /** Unique per label — an arc-run needs a `<path>` in `<defs>` to hang its text on. */
  id: string
  fill?: string
  /** WHICH kind of label this is, not how heavy it should be.
   *
   *  Callers used to pass a weight, which meant the workbench's control moved a number
   *  nothing read — every call site overrode it. Naming the kind puts the decision in one
   *  place and leaves the caller saying the only thing it actually knows. */
  opacity?: number
}) {
  /**
   * Plain type on the wedge.
   *
   * The fill IS the reading and ranges the whole ramp, so the obvious worry is that one
   * foreground colour cannot sit on all of it. Three separations were built for that and
   * a workbench put them side by side on real repos: the halo reads as outlined type, the
   * plate covers the very colour the label is standing on, and the shadow is a wash. None
   * of them beat leaving it alone, so none of them ships and the control is gone with them.
   */
  const ink: CSSProperties = {
    fontFamily: FAMILY,
    letterSpacing: `${TRACKING}em`,
  }

  if (at.axis === 'arc') {
    return (
      <g className="pointer-events-none select-none" opacity={opacity ?? OPACITY}>
        <defs>
          <path id={id} d={labelArc(at.a0, at.a1, at.r, at.size)} />
        </defs>
        <text fontSize={at.size} fontWeight={WEIGHT} fill={fill} style={ink}>
          <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
            {at.text}
          </textPath>
        </text>
      </g>
    )
  }

  // Out along the radius.
  //
  // `rotate(A) translate(0,-r)` lands exactly on the polar point `(r, A)`: rotating (0,−r)
  // by A gives (r sin A, −r cos A), which is this chart's convention. The further quarter
  // turn points the local +x axis outward rather than tangentially, so the text runs from
  // core to rim.
  //
  // Flipped in the LEFT half. Running outward there would set the name right-to-left on
  // screen; turning it to run inward keeps every label reading left-to-right, which is the
  // same rule `labelArc` follows for the bottom half and for the same reason.
  const deg = (at.a0 * 180) / Math.PI
  const inward = Math.sin(at.a0) < 0
  return (
    <g className="pointer-events-none select-none" opacity={opacity ?? OPACITY}>
      <text
        transform={`rotate(${deg.toFixed(2)}) translate(0 ${(-at.r).toFixed(2)}) rotate(${inward ? 90 : -90})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={at.size}
        fontWeight={WEIGHT}
        fill={fill}
        style={ink}
      >
        {at.text}
      </text>
    </g>
  )
}
