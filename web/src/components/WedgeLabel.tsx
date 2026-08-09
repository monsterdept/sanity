import { arcPath, labelArc } from '../lib/sunburst'
import type { CSSProperties } from 'react'
import type { Placement } from '../lib/label'
import { FAMILY, TRACKING, WEIGHT, groundColor, useLabelStyle } from '../lib/labelStyle'

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
  const style = useLabelStyle()

  /**
   * How the glyphs are separated from whatever colour their wedge is.
   *
   * Not decoration: the wedge's fill IS the reading and it ranges the whole ramp, so one
   * foreground colour cannot sit legibly on all of it unaided. It is also what lets more
   * labels exist — the rule before this was to keep names off the light end by keeping
   * them off small wedges.
   *
   * Which treatment is a matter of taste and is settled by looking, which is what the
   * workbench is for. The halo is the historical default and reads to some eyes as
   * outlined type; `shadow` separates without an edge; `plate` is the most legible and the
   * most intrusive, because it covers the very colour the label is standing on.
   */
  const ink: CSSProperties = {
    fontFamily: FAMILY,
    letterSpacing: `${TRACKING}em`,
    ...(style.contrast === 'halo'
      ? {
          paintOrder: 'stroke' as const,
          stroke: 'var(--background)',
          strokeWidth: at.size * style.strength,
          strokeOpacity: 0.65,
          strokeLinejoin: 'round' as const,
        }
      : style.contrast === 'shadow'
        ? {
            // Three passes, and a radius several times `strength`.
            //
            // One pass at the halo's own number is invisible, which is not a bug in the
            // shadow so much as a mismatch of units: `strength` is a STROKE width for the
            // halo — solid ink, right at the glyph — and a blur radius for this, where the
            // same number spreads the same ink over an area and leaves nothing anywhere.
            // Stacking identical shadows compounds their alpha, which is what turns a wash
            // into separation while keeping the edge soft.
            // A literal colour, not `var(--background)` — see `groundColor`. Three passes,
            // because stacking identical shadows compounds their alpha, which is what turns
            // a wash into separation while keeping the edge soft.
            filter: [1.2, 2.4, 4]
              .map(
                (k) =>
                  `drop-shadow(0 0 ${(at.size * style.strength * k).toFixed(2)}px ${groundColor()})`,
              )
              .join(' '),
          }
        : {}),
  }
  const plate = style.contrast === 'plate'

  if (at.axis === 'arc') {
    return (
      <g className="pointer-events-none select-none" opacity={opacity ?? style.opacity}>
        {/* The plate follows the arc, because a rectangle behind curved text is a
            rectangle sticking out of the ring at both ends. Sized from the run's own
            angular width at this radius. */}
        {plate &&
          (() => {
            const half = (at.text.length * at.size * 0.34) / Math.max(at.r, 1)
            const mid = (at.a0 + at.a1) / 2
            return (
              <path
                d={arcPath(mid - half, mid + half, at.r - at.size * 0.62, at.r + at.size * 0.62)}
                fill="var(--background)"
                opacity={0.72}
              />
            )
          })()}
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
    <g className="pointer-events-none select-none" opacity={opacity ?? style.opacity}>
      {/* The plate, when that is the treatment. Behind the glyphs and sized off them, so
          it covers only what the name needs and not the wedge. */}
      {plate && (
        <rect
          x={-(at.text.length * at.size * 0.31)}
          y={-at.size * 0.62}
          width={at.text.length * at.size * 0.62}
          height={at.size * 1.24}
          rx={at.size * 0.28}
          fill="var(--background)"
          opacity={0.72}
          transform={`rotate(${deg.toFixed(2)}) translate(0 ${(-at.r).toFixed(2)}) rotate(${inward ? 90 : -90})`}
        />
      )}
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
