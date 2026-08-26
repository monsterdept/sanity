import { leafPath } from './Bloom'

/** A sprig: one fine stem with leaves along it, grown from a seed and never the same twice.
 *
 *  **What fills the line under a row's pills when there is nothing to say.** That slot exists
 *  for the phase under the pointer and for whatever is running; idle and unhovered it was blank,
 *  and a reserved strip of empty tile under every settled project is the list spending its own
 *  height on nothing. A number was tried there and rejected: the repo's dimensions are true and
 *  they are also the pane's job, and a row that recites them at rest is a row that has to be
 *  read before it can be dismissed. What belongs in a slot that means "nothing to do here" is
 *  something you do not have to read.
 *
 *  **It is the wallpaper's own leaf.** `Bloom` scatters flowers across the empty right pane, and
 *  each one is a rose curve with vesica leaves around it; this borrows the leaf, which is why
 *  `leafPath` is exported from there rather than redrawn here. One garden, two beds.
 *
 *  The rose came too, for a while, as an occasional bud along the stem. It went: at a fifteenth
 *  of its size a flower is a dot with a suggestion of petals, and a dot on a line reads as a
 *  blemish rather than as a bloom. The leaves carry the reference on their own — they are the
 *  same shape at nearly the same scale as the ones in the pane — and a sprig of foliage is a
 *  quieter thing to put under a row that has nothing to say.
 *
 *  **And it is the vine `Bloom` could not have.** Its note says the flowers were briefly strung
 *  along a sine-wave stem and it looked wrong, because a wave long enough to read as a vine is
 *  longer than that pane is wide, so the stem read as a line with lumps on it. The constraint
 *  inverts in a strip a dozen pixels tall and two hundred wide: there is room for two full
 *  undulations and none at all for a scattered field, so the shape that failed the pane is the
 *  only one that fits here.
 *
 *  # Never the same twice
 *
 *  Every number below comes from one seeded generator, so a sprig is a pure function of its
 *  seed: same seed, same plant. The row seeds it from the project's key mixed with the session,
 *  which gives every project a different sprig, keeps it still under the 1.5s poll that
 *  re-renders these rows, and grows a new one next time the app opens.
 */

/** Mulberry32 — a small, fast PRNG with a period long enough for a plant.
 *
 *  Seeded rather than `Math.random` because a sprig must be stable across renders: these rows
 *  re-render twice a second under the project poll, and a plant that redrew itself each time
 *  would be a flicker in the corner of the eye on every row at once. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The drawing's own units, and none of them are the slot's.
 *
 *  **A plant does not obey a text box.** `W` is the tile edge to edge — the row's padding is
 *  cancelled where this is placed, so a stem runs off both sides the way `Bloom` lets a flower
 *  be cut by the edge of its pane rather than tucking it inside.
 *
 *  The viewBox starts ABOVE the slot and ends below it, because a leaf hung at forty degrees
 *  off a stem that is already swaying reaches eight units from the middle: at a box exactly as
 *  tall as the line, the lower leaves were sliced off square by this SVG before the tile ever
 *  got a chance to clip anything. Two units of headroom and the rest hanging into the row's
 *  bottom padding, which is what padding is for — and **no further**: every constant here is
 *  sized so the furthest leaf lands clear of the tile's own inset border, which is drawn INSIDE
 *  the padding box and which content paints over rather than being clipped by.
 *
 *  `MID` is where the stem sits INSIDE that box, and it is why the plant reads as nudged down:
 *  text sits high in its line box, so a stem on the same baseline crowds the pills above it. */
const W = 212
const TOP = -2
const VH = 20
const MID = 6.5

/** How far the stem may wander from `MID`. Small, because what swings is not the stem — it is
 *  the leaves hanging off it, and their reach is six times this. */
const SWAY = 1.6

export function Sprig({ seed }: { seed: number }) {
  const r = rng(seed)

  // Two waves rather than one: a single sine reads as a mechanical ripple, and a second at an
  // unrelated frequency and phase is enough to make the stem look like it grew rather than was
  // plotted. Frequencies are irrational multiples of each other for the same reason.
  const f1 = 1.1 + r() * 0.9
  const f2 = f1 * (2.3 + r() * 1.4)
  const a1 = SWAY * (0.55 + r() * 0.45)
  const a2 = SWAY * (0.12 + r() * 0.2)
  const p1 = r() * Math.PI * 2
  const p2 = r() * Math.PI * 2
  // A slight lean, so the plant is not pinned to the middle at both ends.
  const tilt = (r() - 0.5) * 1.4

  const y = (x: number) => {
    const t = x / W
    return MID + tilt * (t - 0.5) * 2 + a1 * Math.sin(f1 * t * Math.PI * 2 + p1) + a2 * Math.sin(f2 * t * Math.PI * 2 + p2)
  }
  /** The stem's own direction, for hanging a leaf along it. Numeric rather than differentiated
   *  by hand: the curve is a sum of sines and a lean, and one of those terms will change. */
  const slope = (x: number) => (y(Math.min(W, x + 1)) - y(Math.max(0, x - 1))) / 2

  // **Off both edges, not inside them.** A stem that starts and stops within the tile is a
  // dash; one that leaves at both ends is a length of vine the row happens to be showing, which
  // is what `Bloom` does with a flower straddling the edge of its pane — cut, never tucked in.
  const from = -4
  const to = W + 4
  const step = 3
  const stem: string[] = []
  for (let x = from; x <= to; x += step) {
    stem.push(`${stem.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y(x).toFixed(2)}`)
  }
  stem.push(`L ${to.toFixed(1)} ${y(to).toFixed(2)}`)

  // Leaves alternate sides, because a plant that puts them all on one side is falling over. The
  // gap between them is jittered so the alternation does not read as a comb.
  const leaves: { x: number; deg: number; len: number }[] = []
  let x = 2 + r() * 16
  let side = r() < 0.5 ? 1 : -1
  while (x < W - 2) {
    const along = (Math.atan2(slope(x), 1) * 180) / Math.PI
    leaves.push({
      x,
      // Off the stem by a fixed spread, and never square to it: a leaf at ninety degrees looks
      // pinned on, where forty-odd looks grown.
      deg: along + side * (34 + r() * 26),
      len: 2 + r() * 0.9,
    })
    x += 14 + r() * 16
    side = -side
  }

  return (
    <svg
      className="pointer-events-none block h-5 w-full"
      viewBox={`0 ${TOP} ${W} ${VH}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={stem.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={0.7}
        strokeLinecap="round"
        opacity={0.55}
      />
      {leaves.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x.toFixed(1)} ${y(leaf.x).toFixed(2)}) rotate(${leaf.deg.toFixed(1)})`}>
          {/* Translated along its own midrib so the leaf hangs OFF the stem rather than
              straddling it — the vesica is centred on its long axis. */}
          <g transform={`translate(${leaf.len.toFixed(2)} 0)`}>
            <path
              d={leafPath(leaf.len)}
              fill="currentColor"
              fillOpacity={0.16}
              stroke="currentColor"
              strokeWidth={0.35}
              opacity={0.7}
            />
          </g>
        </g>
      ))}
    </svg>
  )
}
