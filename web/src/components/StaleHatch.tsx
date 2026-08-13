/**
 * Hatching for readings whose code has moved.
 *
 * Deliberately a TEXTURE and not a color: the map has exactly one color encoding, and
 * adding a second hue for "expired" would put two scales on one surface. A hatch sits on
 * top of whatever the wedge already is and says "don't trust this", which is a different
 * kind of statement from "this is hot".
 *
 * There is a standing note against per-wedge marks — a mark on every wedge is stripes,
 * not information. That argument is the reason this one is fine: stale is rare by
 * construction, so the hatch appears on a handful of wedges and the eye goes straight to
 * them. The moment most of a repo is hatched, most of the repo genuinely has expired
 * readings, and drawing that loudly is correct.
 *
 * A component rather than a `<defs>` block in each geometry, because `url(#stale-hatch)`
 * resolves by document id: two copies would be two elements with one id, and which one a
 * fill resolved to would depend on which view happened to be mounted.
 */
export function StaleHatch() {
  return (
    <defs>
      <pattern
        id="stale-hatch"
        width={6}
        height={6}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={6} height={6} fill="none" />
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={6}
          stroke="var(--foreground)"
          strokeWidth={1.6}
          strokeOpacity={0.45}
        />
      </pattern>
    </defs>
  )
}
