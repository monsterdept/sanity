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
      {/* **Too large for a reading to be taken over it at all.**
       *
       *  A different statement from the hatch below, so a different texture: stale means a
       *  reading expired and a fresh one will replace it, this means no run will ever reach
       *  this wedge — `agentapi::READ_CEILING`. Drawn as a cross rather than a rotation of
       *  the same lines, because two hatches at two angles are read as one hatch by anyone
       *  not comparing them side by side.
       *
       *  It must not read as UNREAD either, which is what it looked like before: grey is
       *  "nobody has got to this yet", and eighteen readings in this corpus were fabricated
       *  by readers who could not accept that answer. A wedge nobody can read is a finding
       *  about the code — usually the most accreted code in the repo — and the map says so.
       */}
      <pattern id="unreadable-hatch" width={7} height={7} patternUnits="userSpaceOnUse">
        <rect width={7} height={7} fill="none" />
        <path
          d="M0 0 L7 7 M7 0 L0 7"
          stroke="var(--foreground)"
          strokeWidth={1}
          strokeOpacity={0.5}
        />
      </pattern>
      {/* **A folded directory's handle.**
       *
       *  A fold gives a subtree's angle back to its siblings, so the ring stops being
       *  proportional — and the handle is the only thing on the map that says so. It
       *  therefore has to read as a MARK rather than as a small wedge: a narrow wedge is a
       *  claim that something is small, which is the one thing that must not be said here,
       *  because what was folded is usually the biggest thing in the ring.
       *
       *  Cross-hatched rather than lined, so it cannot be mistaken for `stale-hatch` at a
       *  glance, and finer than either — this sits on a thirteen-pixel stub, where the
       *  six-pixel pitch of the others would show one stroke and read as a stripe. */}
      <pattern id="fold-hatch" width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="none" />
        <path
          d="M0 0 L4 4 M4 0 L0 4"
          stroke="var(--foreground)"
          strokeWidth={0.9}
          strokeOpacity={0.4}
        />
      </pattern>
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
