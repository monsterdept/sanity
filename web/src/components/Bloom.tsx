/**
 * The empty right pane, as a scattered field of flowers.
 *
 * Two pieces of mathematics, doing the two jobs a flower has.
 *
 * # The petals: a rose curve, fattened
 *
 * The **rhodonea** `r = a·cos(kθ)` — studied by Guido Grandi in 1723, who named it for the
 * rose it draws — is the classic mathematical flower, and on its own a poor one: the petals
 * come out as thin spikes. So the radius is raised to a fractional power:
 *
 *     r(θ) = a · |cos(kθ)|^(1/P)
 *
 * `|cos|` near its zeros is small, and a fractional power pulls small numbers up much harder
 * than it pulls large ones down — so the curve lingers away from the origin between lobes and
 * the spikes inflate into petals. `P` is the plumpness dial, and it is the whole difference
 * between a star and a flower. `|cos(kθ)|` turns `2k` lobes per revolution, so `k = 2.5` gives
 * **five petals**: buttercup, wild rose, apple, flax.
 *
 * # The center: phyllotaxis
 *
 * Vogel's model of sunflower packing — seed `n` at angle `n·φ`, radius `c·√n`, where `φ` is the
 * **golden angle**, 137.507…°. The `√n` keeps density even, because area grows linearly with n;
 * the golden angle is the one rotation that never lets seeds fall into spokes, the golden ratio
 * being the irrational hardest to approximate by fractions. Any rational angle repeats and
 * leaves lanes. Sunflowers use it for exactly this reason.
 *
 * # Why six petals, and not five
 *
 * **The crystallographic restriction**: a wallpaper pattern's rotations can only be of order
 * 2, 3, 4 or 6. Five is impossible — a five-fold center cannot be repeated by translations
 * without contradicting itself, which is why no wallpaper anywhere has it and why quasicrystals
 * were such a shock. The rose had `k = 2.5`, so five petals, so it could never sit on a rotation
 * center of any of the seventeen groups. That is exactly why the scattered version felt
 * arbitrary: there was no symmetry available for it to obey, so placement was down to taste,
 * and taste with no constraint reads as randomness.
 *
 * At `k = 3` the rose has six petals and is D6 — six-fold rotation and six mirror lines — which
 * is precisely what a six-fold center wants.
 *
 * # p6m
 *
 * The richest of the seventeen: six-fold rotation, with mirrors through every center at 30°.
 * The motifs are not scattered, they are placed where the group's own machinery puts them, on a
 * **hexagonal lattice** drawn here in its rectangular cell — width `T`, height `T√3`, with
 * lattice points at the corners and one in the middle.
 *
 * | site | what sits there | why it fits |
 * |---|---|---|
 * | 6-fold centers — the lattice points | the large rose | D6 motif on a 6-fold center |
 * | 3-fold centers — triangle centroids | a smaller rose | D6 contains D3, so it obeys |
 * | 2-fold centers — edge midpoints | a leaf, along the edge | the vesica is D2 |
 *
 * Every position below is one of those three sites. Nothing is placed by eye, which is the
 * whole difference between a pattern and a sprinkle.
 *
 * # Scattered, not vined
 *
 * The flowers were briefly strung along a sine-wave stem. It tiled correctly and looked
 * wrong: a wave long enough to read as a vine is longer than the pane is wide, so the stem
 * became the subject and the blooms rode on it as passengers. A scattered field has no such
 * competition — the motif is the only thing in it, which is what lets it sit at 20% opacity
 * behind a card and still read as flowers.
 *
 * # Making it tile
 *
 * **Everything is drawn nine times.** An SVG `<pattern>` CLIPS its contents to the tile, so a
 * flower straddling an edge is cut in half rather than wrapping — which is exactly what the
 * first version did, visibly. Drawing the whole group at every offset in `{-T, 0, T}²` means
 * the part clipped off one edge is supplied by the neighbor that overlaps it. Nine copies of
 * the definition, not nine copies of the work: `<pattern>` defines its tile once and the
 * renderer repeats it.
 */

/** Radius of a petal tip, in the flower's own units. */
const A = 12
/** Half the petal count: `|cos(kθ)|` turns `2k` lobes in a full revolution.
 *
 *  3, so six petals. Not a look — a requirement. See the crystallographic restriction above:
 *  the five-petal rose this started with cannot sit on any wallpaper rotation center. */
const K = 3
/** Plumpness. 1 is Grandi's original and draws spikes; 3 is a flower; past ~5 the petals swell
 *  into each other and the outline reads as a scalloped disc. */
const P = 3

/** The golden angle in radians, `2π·(1 − 1/φ)`. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

/** Spacing of the hexagonal lattice — the distance between neighboring 6-fold centers.
 *
 *  Density is set HERE, not by the motif scales: shrinking the lattice while the flowers keep
 *  their size packs them together, where scaling the flowers up in a bigger lattice just gives
 *  bigger flowers equally far apart. */
const T = 74
/** Height of the rectangular cell that holds one hexagonal repeat: `T√3`. */
const H = T * Math.sqrt(3)

function petals(): string {
  const d: string[] = []
  const steps = 240
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const r = A * Math.pow(Math.abs(Math.cos(K * th)), 1 / P)
    d.push(
      `${i === 0 ? 'M' : 'L'} ${(r * Math.cos(th)).toFixed(2)} ${(r * Math.sin(th)).toFixed(2)}`,
    )
  }
  return d.join(' ') + ' Z'
}

function seedHead(): { cx: number; cy: number; r: number }[] {
  const out = []
  for (let n = 1; n <= 13; n++) {
    const th = n * GOLDEN
    const r = A * 0.115 * Math.sqrt(n)
    out.push({ cx: r * Math.cos(th), cy: r * Math.sin(th), r: A * 0.05 })
  }
  return out
}

const PETALS = petals()
const SEEDS = seedHead()

function Flower({ s = 1 }: { s?: number }) {
  return (
    <g transform={`scale(${s})`}>
      <path
        d={PETALS}
        fill="currentColor"
        fillOpacity={0.16}
        stroke="currentColor"
        strokeWidth={0.6}
      />
      {/* The same curve at 45%. A rose scaled about the origin is exactly a rose — `r` is
          linear in `a` — so this is the outline's own shape, not a second drawing to keep in
          step with it. */}
      <g transform="scale(0.45)">
        <path d={PETALS} fill="none" stroke="currentColor" strokeWidth={1.1} />
      </g>
      {SEEDS.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="currentColor" fillOpacity={0.55} />
      ))}
    </g>
  )
}

/** A leaf: the **vesica**, the lens where two equal circles overlap, each arc through the
 *  other's center — the leaf every illuminator has drawn since the twelfth century. */
function Leaf({ s = 1 }: { s?: number }) {
  const L = 7.4
  const R = L * 1.16
  return (
    <g transform={`scale(${s})`}>
      <path
        d={`M ${-L} 0 A ${R} ${R} 0 0 1 ${L} 0 A ${R} ${R} 0 0 1 ${-L} 0 Z`}
        fill="currentColor"
        fillOpacity={0.18}
        stroke="currentColor"
        strokeWidth={0.55}
      />
      <path d={`M ${-L} 0 L ${L} 0`} stroke="currentColor" strokeWidth={0.45} opacity={0.7} />
    </g>
  )
}

/** Four motifs in a **half-drop** arrangement — the second pair offset by half a tile in both
 *  directions. It is what textiles use, and for a reason: a plain grid puts every flower on a
 *  shared horizontal, and the eye assembles those into rows and stops seeing the flower.
 *  Offsetting breaks the rows without breaking the tiling.
 *
 *  The rotations are there for the same reason. Identical copies at identical angles read as
 *  a stamp repeated; a few degrees apiece is enough to read as scattered. */
/** Lattice points — 6-fold centers. The corners and the middle of the rectangular cell. */
const SIXFOLD: [number, number][] = [
  [0, 0],
  [T, 0],
  [0, H],
  [T, H],
  [T / 2, H / 2],
]

/** Centroids of the lattice triangles — 3-fold centers. */
const THREEFOLD: [number, number][] = [
  [T / 2, H / 6],
  [T / 2, (5 * H) / 6],
  [0, H / 3],
  [0, (2 * H) / 3],
  [T, H / 3],
  [T, (2 * H) / 3],
]

/** Midpoints of lattice edges — 2-fold centers — each with the angle of the edge it bisects,
 *  because a leaf laid across the mirror rather than along it would break the group. */
const TWOFOLD: [number, number, number][] = [
  [T / 2, 0, 0],
  [T / 2, H, 0],
  [0, H / 2, 0],
  [T, H / 2, 0],
  [T / 4, H / 4, 60],
  [(3 * T) / 4, H / 4, -60],
  [T / 4, (3 * H) / 4, -60],
  [(3 * T) / 4, (3 * H) / 4, 60],
]

function Tile() {
  return (
    <g>
      {SIXFOLD.map(([x, y], i) => (
        <g key={`a${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
          <Flower s={1.45} />
        </g>
      ))}
      {THREEFOLD.map(([x, y], i) => (
        <g key={`b${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(30)`}>
          <Flower s={0.72} />
        </g>
      ))}
      {TWOFOLD.map(([x, y, a], i) => (
        <g key={`c${i}`} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a})`}>
          <Leaf s={0.62} />
        </g>
      ))}
    </g>
  )
}

const OFFSETS = [-1, 0, 1]

export function Bloom({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {/* No `patternTransform`. It carried `rotate(-6)`, on the idea that a slight tilt would
            stop the tiling reading as a grid — it does the opposite. A few degrees is not enough
            to look deliberate and is plenty to look crooked: the lattice stays perfectly regular,
            it just marches in skewed diagonals, and the eye reads a straight thing set down
            badly. Irregularity has to come from the motifs, which is what their own rotations
            are for. */}
        <pattern id="bloom" width={T} height={H} patternUnits="userSpaceOnUse">
          {OFFSETS.map((dx) =>
            OFFSETS.map((dy) => (
              <g key={`${dx},${dy}`} transform={`translate(${dx * T} ${dy * H})`}>
                <Tile />
              </g>
            )),
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bloom)" />
    </svg>
  )
}
