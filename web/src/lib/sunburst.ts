import { HOT, showsShare, temperature, type ChurnWindows, type Node } from './api'

export interface Wedge {
  node: Node
  depth: number
  /** Radians, clockwise from 12 o'clock. */
  a0: number
  a1: number
  /** Position among its siblings, used to stagger dots so neighbors don't collide. */
  index: number
}

export interface Layout {
  wedges: Wedge[]
  /** Wedges too thin to see, and therefore not emitted. Reported rather than dropped
   *  silently: a picture that quietly omits a thousand functions reads as "your repo is
   *  simple", which is the opposite of the truth. */
  hidden: { files: number; dirs: number }
  depth: number
}

/** Fallback thinnest wedge, used when the caller has not measured its pane yet.
 *
 *  This constant was the whole rule, and its justification was a claim about PIXELS —
 *  "below this a wedge is under a pixel at any realistic radius". But arc length is
 *  `radius × angle`, so a fixed angle is a fixed pixel width at exactly one radius: 0.0025
 *  is 1px when the outer ring is 400px across the screen. Below that it culled things that
 *  were visible; above it — a maximized window on a large display — it went on culling
 *  wedges that would have rendered two pixels wide and been perfectly clickable. The map
 *  hid the same amount of the repo however much room you gave it.
 *
 *  So it is now a default rather than the rule. `LayoutOpts.minAngle` carries the real
 *  threshold, derived from the pane, and the neighboring `MIN_SLICE` — which was always
 *  honest about being in pixels — is the model. */
const MIN_ANGLE = 0.0025

/** The most of a ring that folded handles may take between them. See the sibling loop. */
const HANDLE_MAX_SHARE = 0.5

/** How siblings are laid out around the circle. */
export interface LayoutOpts {
  /** Angle by lines (the default) or give every sibling the same room.
   *
   *  Equal angles throw away the size encoding on purpose. Proportional sizing means a
   *  three-line function is a hairline no matter how alarming it is, so the picture is
   *  loudest about the code with the most lines — which is the axis we keep proving does
   *  not matter. Equal angles make it purely a map of heat. */
  even?: boolean
  /** Thinnest wedge worth drawing, in radians, for the pane being laid out into.
   *
   *  Supplied by the caller because only the caller knows what a user unit is worth in
   *  screen pixels: the sunburst draws at a fixed radius and lets the viewBox rescale it,
   *  so one angle is a different number of pixels in every window. Omit it and the fixed
   *  default stands. */
  minAngle?: number
  /** The same threshold, asked per ring rather than once for the whole circle.
   *
   *  `minAngle` is an angle, and an angle is not a width: the arc a span subtends is
   *  `r × angle`, so one number for every depth is only right at one radius. The caller
   *  measured at the outermost, which is safe — everything inside it is culled less than
   *  it should be — but "less than it should be" is a factor of four at the innermost
   *  ring, and it grows with the number of rings drawn.
   *
   *  Asked per depth, the cut is one screen pixel everywhere, which is what `MIN_ARC_PX`
   *  always claimed to be. Falls back to `minAngle` when absent, so a caller with no radii
   *  to convert through is unchanged. */
  minAngleAt?: (depth: number) => number
  /** How much room a FOLDED directory keeps, per ring, in radians.
   *
   *  Folding is the reader saying *disregard this*, and until there was a handle the map
   *  did not disregard it — a folded directory kept every degree its lines had earned and
   *  simply stopped drawing its insides, so on kibana the subtree you wanted out of the
   *  way went on owning two thirds of the circle. That is a depth control wearing an
   *  exclusion control's label.
   *
   *  With a handle the fold gives its angle back to its siblings, and the ring is no
   *  longer proportional. That is a real suspension of this map's one claim and it is
   *  taken deliberately: the claim was already conditional — drilling re-normalizes to a
   *  subtree, sub-pixel wedges are culled, thin siblings roll up — so what the map actually
   *  promises is *within this view, angle is lines*, plus an obligation to say what is
   *  missing. A fold joins that list. It is reader-initiated, it is reversible, and the
   *  handle is left in the ring exactly where the share was, so the suspension has a mark
   *  on screen rather than living in somebody's memory of what they clicked.
   *
   *  Omit it and a folded directory keeps its proportional span, which is what folding did
   *  before this existed. */
  handleAngleAt?: (depth: number) => number
  /** Smallest function patch worth drawing, in the layout's own units SQUARED.
   *
   *  The same correction as `minAngle`, for a threshold that is now an area. `MIN_PATCH_AREA`
   *  is measured in pixels, but `tileFunctions` works in user units — which only coincide
   *  with pixels at one window size, and being an area the conversion is the square of the
   *  one `minAngle` uses. Omit it and the fixed default stands. */
  minPatchArea?: number
  /** Order siblings by temperature instead of by name.
   *
   *  Directory order is the default because it makes the picture stable between scans,
   *  which is what lets you recognize a repo's shape and spot what changed. Sorting by
   *  heat gathers everything worth reading into one contiguous arc, which is much faster
   *  to find and destroys that stability — a deliberate trade, per view. */
  byHeat?: boolean
  /** Directories the user has folded shut. Their contents are not laid out at all, so
   *  the ring budget goes to what is still open — collapsing a directory makes every
   *  remaining band thicker rather than just blanking one. Contents are not counted as
   *  `hidden`: that number means "too thin to draw", and this omission was asked for. */
  collapsed?: ReadonlySet<string>
  /** What to SORT siblings by, when it should not be their size right now.
   *
   *  Keyed by node id, and it decides order only — angles are still lines, because that is
   *  the encoding. The replay is what needs it: a frame's own sizes are the right sort for a
   *  map you are reading and the wrong one for a story, since a directory that overtakes its
   *  neighbour trades places with it mid-playback and the ring reshuffles for a reason that
   *  has nothing to do with the commit. Ordering every frame by the sizes at HEAD makes the
   *  ring you recognize at the end the ring you were watching all along.
   *
   *  A node with no entry sorts last: it does not exist at HEAD, so there is no place in
   *  today's order to give it, and the tail is the one place that cannot push anything else
   *  around as it comes and goes. */
  sortBy?: ReadonlyMap<string, number>
}

function heatOf(n: Node): number {
  const s = n.score
  if (!s) return 0
  return showsShare(n) ? s.hotShare : s.surprise
}

/**
 * Partition the tree into rings, angles proportional to lines.
 *
 * Children are ordered biggest-first, or by heat when the caller asks — see the comment on
 * the sort itself, which carries the argument. This block used to claim the opposite, that
 * children were laid out "in the order the backend produced them, deliberately not sorted by
 * size or heat", and it was stale: it had come unstuck from whatever it once described and
 * was floating on `LayoutOpts`, where nothing could contradict it. Reattaching it to the
 * function it names put a claim above a body that disproves it four lines down, which is how
 * a reader caught it — and is the argument for keeping docs attached rather than adrift.
 */
export function layout(root: Node, maxDepth: number, opts: LayoutOpts = {}): Layout {
  const wedges: Wedge[] = []
  const hidden = { files: 0, dirs: 0 }
  let depth = 0

  const walk = (node: Node, d: number, a0: number, a1: number, index: number) => {
    if (d > 0) {
      wedges.push({ node, depth: d, a0, a1, index })
      depth = Math.max(depth, d)
    }
    if (d >= maxDepth || node.children.length === 0) return
    if (d > 0 && opts.collapsed?.has(node.id)) return

    // Biggest first, running clockwise from 9 o'clock. Size order is worth having
    // because it puts the wedge most worth reading where its label has the most room,
    // and it is stable in a way heat order is not: a file's line count barely moves
    // between two scans, so the ring you recognize stays the ring you recognize.
    // Falls back to name for equal sizes, so the order is fully determined rather than
    // left to sort stability.
    // Containers only. `sortBy` is keyed by path, and a function's id is not one — every
    // function would miss the map, come back as "not at HEAD", and the ring of functions
    // would silently resort itself by name, which is the shuffle this exists to stop.
    const size = (c: Node) =>
      opts.sortBy && c.kind !== 'func' ? (opts.sortBy.get(c.id) ?? 0) : c.loc
    const kids = opts.byHeat
      ? [...node.children].sort((x, y) => heatOf(y) - heatOf(x))
      : [...node.children].sort((x, y) => size(y) - size(x) || x.name.localeCompare(y.name))
    const weight = (c: Node) => (opts.even ? 1 : Math.max(c.loc, 1))

    // Folded directories take a fixed handle and give the rest back — see `handleAngleAt`.
    // Only directories: a file has no children to hide, and a function is not foldable at
    // all, so neither can be in the set.
    const shut = (c: Node) => c.kind === 'dir' && opts.collapsed?.has(c.id) === true
    const handle = opts.handleAngleAt?.(d + 1) ?? 0
    const folds = handle > 0 ? kids.filter(shut).length : 0
    const open = kids.filter((c) => !shut(c))
    // **Never more than half the ring, however many are folded.** Handles are a fixed size
    // and the ring is not, so twenty folded siblings on a narrow branch would spend the
    // whole span on marks for things nobody wants to see. Past the cap they share it and
    // get smaller, which is the honest failure: the marks stay, they just stop dominating.
    //
    // With NOTHING left open the cap does not apply — there is no proportional content to
    // protect, and a ring of handles crowded into half a circle with the rest blank would
    // be a picture of nothing at all.
    const each =
      folds === 0
        ? 0
        : open.length === 0
          ? (a1 - a0) / folds
          : Math.min(handle, ((a1 - a0) * HANDLE_MAX_SHARE) / folds)
    const free = a1 - a0 - each * folds
    const total = open.reduce((s, c) => s + weight(c), 0)
    let a = a0
    let idx = 0
    for (const child of kids) {
      const span = shut(child) && folds > 0 ? each : total > 0 ? (free * weight(child)) / total : 0
      // Functions are never dropped for thinness. They render as dots, which have a
      // minimum size no matter how many share a ring — the whole reason for drawing them
      // that way. Only arcs, which genuinely vanish below a pixel, get culled.
      // The child's own depth, not this node's: the threshold is about the ring the wedge
      // would be DRAWN in, and a child culled here is culled out of the ring one further
      // out than the one being walked.
      const floor = opts.minAngleAt?.(d + 1) ?? opts.minAngle ?? MIN_ANGLE
      // A handle is never culled for thinness. It is the reader's own mark — the record
      // that something was taken out of this ring — and dropping it silently would leave a
      // ring that is no longer proportional with nothing on it saying so, which is the one
      // outcome the handle exists to prevent.
      if (span < floor && child.kind !== 'func' && !shut(child)) {
        // Count the whole subtree, not just this node — otherwise the tally under-
        // reports by exactly the amount that matters on a deep tree. Files and
        // directories are counted apart so the note can name what went missing;
        // functions are not counted at all, because a function is never dropped for
        // thinness on its own and reporting them here would mix "we culled this wedge"
        // with "and everything it contained", which reads as a much bigger omission
        // than it is.
        const count = (x: Node) => {
          if (x.kind === 'file') hidden.files += 1
          else if (x.kind === 'dir') hidden.dirs += 1
          x.children.forEach(count)
        }
        count(child)
        a += span
        continue
      }
      walk(child, d + 1, a, a + span, idx++)
      a += span
    }
  }

  // Start at 9 o'clock rather than 12. Laid out biggest-first clockwise, that puts the
  // largest wedge across the TOP of the ring, where an arc-bound label runs closest to
  // horizontal and is easiest to read. Starting at 12 split the biggest wedge's label
  // across the upper-right diagonal instead.
  walk(root, 0, -Math.PI / 2, (3 * Math.PI) / 2, 0)
  return { wedges, hidden, depth }
}

/** An annular sector as an SVG path. Angles are clockwise from 12 o'clock. */
export function arcPath(a0: number, a1: number, r0: number, r1: number): string {
  const x = (r: number, a: number) => (r * Math.sin(a)).toFixed(2)
  const y = (r: number, a: number) => (-r * Math.cos(a)).toFixed(2)
  const large = a1 - a0 > Math.PI ? 1 : 0

  // A full circle can't be drawn as one arc — start and end coincide, so the renderer
  // draws nothing at all. The innermost ring of a single-child tree hits this.
  if (a1 - a0 >= Math.PI * 2 - 1e-9) {
    return [
      `M 0 ${-r1}`,
      `A ${r1} ${r1} 0 1 1 0 ${r1}`,
      `A ${r1} ${r1} 0 1 1 0 ${-r1}`,
      `M 0 ${-r0}`,
      `A ${r0} ${r0} 0 1 0 0 ${r0}`,
      `A ${r0} ${r0} 0 1 0 0 ${-r0}`,
      'Z',
    ].join(' ')
  }

  return [
    `M ${x(r0, a0)} ${y(r0, a0)}`,
    `L ${x(r1, a0)} ${y(r1, a0)}`,
    `A ${r1} ${r1} 0 ${large} 1 ${x(r1, a1)} ${y(r1, a1)}`,
    `L ${x(r0, a1)} ${y(r0, a1)}`,
    `A ${r0} ${r0} 0 ${large} 0 ${x(r0, a0)} ${y(r0, a0)}`,
    'Z',
  ].join(' ')
}

/**
 * One function's patch of its file's wedge.
 *
 * Both dimensions, where this used to be radius alone. A band is a fixed slice of radius
 * however many functions share it, so stacking them radially pinned a file's capacity at
 * about twenty whatever its size — `probe.rs` is 786 functions in 22,974 lines, and 766 of
 * them went into one roll-up whose color said more about where the truncation fell than
 * about the code. Angle was sitting there unused: every slice spanned the file's full
 * width, so a file 40× another file's size drew its functions 40× longer and no more
 * numerous.
 */
export interface Slot {
  node: Node
  a0: number
  a1: number
  r0: number
  r1: number
  /** How many functions this slot stands in for, when it is an overflow aggregate.
   *  Undefined on a real function.
   *
   *  Not set where the slot is built — `rowPlacement` knows nothing about roll-ups — but
   *  afterwards, on the one slot whose node is the aggregate. Both this and `node.rest`
   *  therefore mark the same patch, and callers use `node.rest` because that is the field
   *  `aggregate` writes and the only one that survives a slot being rebuilt. */
  rest?: number
}

/**
 * Smallest patch worth drawing, in square user units.
 *
 * The two-dimensional heir to `MIN_SLICE`, and it says the same thing: the cut between two
 * patches is a 0.6-unit stroke, so below a certain size a patch is mostly its own border.
 * About a 5×5 patch. Stated as an AREA because that is what a tiling actually has to
 * spend — a floor on one side alone is what let the old stack pack a band with minimums
 * and leave nothing for the proportional budget to say.
 */
const MIN_PATCH_AREA = 26

/**
 * How far a patch may be stretched above its lines to reach the floor.
 *
 * The floor is a lie in the small — a patch drawn at it says "this much code" and means
 * "at least this much" — so the question is how big a lie, and the answer has to be per
 * patch. Three: a function may be drawn up to three times its share, which is inside the
 * range the eye reads as "small" anyway, and below that it goes to the roll-up.
 *
 * The alternative, an aggregate budget of "spend at most half the wedge on floors", pins
 * the roll-up at exactly half whatever the file is. That number is a fact about the
 * budget, not about the code, and it is the same failure as a metric that saturates: it
 * looks like a measurement and reports a constant.
 */
const MAX_STRETCH = 3

/** Patches' worth of area the roll-up gets at minimum — about a 7×7 block. Enough to see
 *  without hunting and to hit without aiming, which is the whole of its job. */
const ROLLUP_PATCHES = 4

/**
 * The most of a span that may go to floors, leaving the rest to mean something.
 *
 * Capacity was `span / minimum`, which packs the run to the brim with minimums and leaves
 * about a pixel of proportional budget for every slice to share. Everything then renders
 * at the floor again — including the aggregate, which stood for 925 lines and drew the
 * same width as its three-line neighbor. That is the original bug wearing a different
 * number: a floor is only a floor while something else decides the rest.
 *
 * Half. Fewer slices, each of which is honestly sized, beats more slices that are all the
 * same size — the second is a texture, not a measurement. `tileFunctions` needs no such
 * constant: it floors an AREA and hands out area, so the budget it protects and the budget
 * it spends are the same quantity.
 */
const FLOOR_SHARE = 0.5

/**
 * Everything the band could not fit, as one wedge.
 *
 * A synthetic function node rather than a special case in the renderer: color, heat,
 * hover and all five color modes key off a `Node`, so giving the aggregate a real one
 * means none of them have to learn it exists.
 *
 * Its score is the LOC-weighted mean of the members that have actually been read. This is
 * the one place this codebase averages temperature, and it is deliberate — the standing
 * rule is that averaging *upward* flattens a whole ring to the repo mean, and this is not
 * a ring above, it is a stand-in on the same ring for siblings that could not be drawn.
 * A neutral plate was the alternative, and it would claim "nothing to see here" about
 * what might be the hottest code in the file.
 */
function aggregate(fns: Node[], filePath: string): Node {
  const loc = fns.reduce((n, f) => n + f.loc, 0)
  const read = fns.filter(
    (f) => f.score && (f.score.source === 'model' || f.score.source === 'agent'),
  )
  const w = read.reduce((n, f) => n + Math.max(f.loc, 1), 0)
  const mean = (pick: (f: Node) => number) =>
    w === 0 ? 0 : read.reduce((n, f) => n + pick(f) * Math.max(f.loc, 1), 0) / w
  const first = read[0] ?? fns[0]
  const s = first.score
  // Lines in here that a reader found hot, as a share of the lines anything read — the
  // same question `hotShare` answers for a directory, asked of the same members. It used
  // to hold `mean(surprise)`, a different quantity under this field's name; nothing read
  // it, because the wedge was `kind: 'func'` and took the temperature branch everywhere.
  // Both halves of that are the bug: this pool is what is LEFT after the hottest members
  // were drawn as their own wedges, so a mean of it is bounded by its coldest neighbor
  // and reports the truncation rather than the code.
  const hotLoc = read.reduce((n, f) => n + (temperature(f.score) > HOT ? Math.max(f.loc, 1) : 0), 0)
  return {
    // One per file per layout, so this is unique among the slots it is emitted with — but
    // it is NOT the only roll-up in the app: the replay folds its own per-file stand-in
    // (`#/folded`, see `history.ts`), and in a replay this aggregate rolls that one up too.
    // The two must keep separate id namespaces or they collide in one patch array, and a
    // duplicate React key there leaves an orphaned wedge on screen forever.
    // The `/` keeps this out of `key_of`'s reach as well as the fold's: a function named
    // `rest` would otherwise mint exactly this id — see `history.ts` for the argument.
    id: `${filePath}#/rest`,
    // Read as "126 and more". The count is the useful half and any word after it would
    // not survive the arc this has to fit inside.
    name: `${fns.length}+`,
    kind: 'func',
    path: filePath,
    // The overflow wedge is a COLLECTION wearing a function's kind, so it has no wiring of
    // its own — and it must not sum its members', because `showsShare` already routes it
    // down the container branch, which walks the real nodes underneath.
    callers: null,
    calls: null,
    incident: null,
    away: null,
    resolvable: null,
    orphans: null,
    sinks: null,
    cloneGroup: null,
    cloneSize: null,
    comparable: null,
    copied: null,
    loc,
    line: null,
    endLine: null,
    bytes: null,
    lang: first.lang,
    // Not inherited from the members: the flag sits on the FILE node, and this stand-in
    // hangs under that same file, so it is out of scope exactly when its parent is.
    excluded: false,
    // The roll-up stands in for many functions and has no comment of its own.
    doc: null,
    signature: null,
    owner: null,
    lastAuthor: first.lastAuthor,
    body: null,
    hotspots: [],
    // What makes this a collection rather than a function, everywhere color is decided.
    // Carried on the node and not just on the `Slot` because `colorFor` is handed a node
    // and nothing else — a wedge cannot be colored correctly by a fact its own node does
    // not hold.
    rest: fns.length,
    funcs: 0,
    // The members it stands for, kept rather than dropped. The detail panel lists a
    // node's children, so carrying them here is what turns "104+" from a dead end into
    // the way you actually reach the functions the band had no room to draw.
    children: fns,
    score:
      read.length === 0 || !s
        ? s
        : {
            surprise: mean((f) => f.score!.surprise),
            documented: mean((f) => f.score!.documented),
            // Per window — see `Score.churn`. A stand-in answers whichever rung the map is
            // painted at, so it has to carry all four for the same reason a real node does.
            churn: [0, 1, 2, 3].map((w) => mean((f) => f.score!.churn[w])) as ChurnWindows,
            ageDays: mean((f) => f.score!.ageDays ?? 0),
            lastTouchedDays: mean((f) => f.score!.lastTouchedDays ?? 0),
            commits: [0, 1, 2, 3].map((w) =>
              Math.round(mean((f) => f.score!.commits[w])),
            ) as ChurnWindows,
            allCommits: null,
            provenance: s.provenance,
            hotShare: w === 0 ? 0 : hotLoc / w,
            source: s.source,
            // The share of these lines anything actually read, so an aggregate that is
            // mostly unread still renders mostly unread rather than borrowing the
            // confidence of the few members that were.
            analyzedShare: loc === 0 ? 0 : Math.min(1, w / loc),
          },
  }
}

/**
 * Area in the annulus, in the coordinates that make it a rectangle.
 *
 * The area of an annular sector is `Δθ × (r₁² − r₀²)/2`, so substituting `v = r²/2` turns
 * it into `Δθ × Δv` — a plain product, which means a squarified tiling laid out in
 * `(θ, v)` and mapped back through `r = √(2v)` conserves area EXACTLY. No thin-band
 * approximation, and no cheating at the inner rings where an approximation is worst.
 *
 * It also fixes something the radial stack got wrong and never said: that stack sized a
 * function by radial THICKNESS, so the same number of lines drawn near the rim covered
 * more area than near the hub. Lines were the width of a band, not the size of a patch,
 * and the eye reads area.
 */
export const vOf = (r: number) => (r * r) / 2
export const rOf = (v: number) => Math.sqrt(2 * v)

/** A sector in those coordinates: angles as themselves, radii as `v`. */
interface Sector {
  a0: number
  a1: number
  v0: number
  v1: number
}

/** Worst aspect ratio among a row of patches — measured on SCREEN, in the sector the
 *  patches will actually occupy, not in the `(θ, v)` rectangle. A cell that is square in
 *  `v` is not square once `√` has had it, and the whole point of squarifying is that the
 *  ratio being minimized is the one the eye sees. */
function worstRatio(dims: { w: number; h: number }[]): number {
  let worst = 1
  for (const d of dims) {
    if (d.w <= 0 || d.h <= 0) return Infinity
    worst = Math.max(worst, d.w / d.h, d.h / d.w)
  }
  return worst
}

/** Where a row of items would land, and how square each patch would come out.
 *
 *  `radial` means the row is a band of constant thickness spanning the sector's whole
 *  angle, with its members side by side around it; otherwise it is a wedge spanning the
 *  whole radial extent, with its members stacked outward. Rows go across the shorter
 *  screen dimension, which is what keeps patches from becoming ribbons. */
function rowPlacement(
  items: { node: Node; area: number }[],
  sec: Sector,
  radial: boolean,
): { slots: Slot[]; dims: { w: number; h: number }[]; consumed: number } {
  let total = 0
  for (const i of items) total += i.area
  const slots: Slot[] = []
  const dims: { w: number; h: number }[] = []

  if (radial) {
    const dv = total / (sec.a1 - sec.a0)
    const rIn = rOf(sec.v0)
    const rOut = rOf(sec.v0 + dv)
    let a = sec.a0
    for (const it of items) {
      const da = it.area / dv
      slots.push({ node: it.node, a0: a, a1: a + da, r0: rIn, r1: rOut })
      dims.push({ w: da * rOf(sec.v0 + dv / 2), h: rOut - rIn })
      a += da
    }
    return { slots, dims, consumed: dv }
  }

  const da = total / (sec.v1 - sec.v0)
  let v = sec.v0
  for (const it of items) {
    const dv = it.area / da
    const rIn = rOf(v)
    const rOut = rOf(v + dv)
    slots.push({ node: it.node, a0: sec.a0, a1: sec.a0 + da, r0: rIn, r1: rOut })
    dims.push({ w: da * rOf(v + dv / 2), h: rOut - rIn })
    v += dv
  }
  return { slots, dims, consumed: da }
}

/**
 * Tile a file's functions across its own wedge, in both dimensions.
 *
 * The alternative — giving functions their own outer ring, subdivided angularly — makes
 * containment a hint rather than a fact. A dot or a sliver sits in a *different ring*
 * from its file, so which file it belongs to has to be inferred from angle, and at any
 * real function count that inference fails: siblings scatter, neighbors from adjacent
 * files interleave, and everything lands near a boundary. Here a function is literally
 * inside its file, and that is not negotiable.
 *
 * What changed is that it no longer stacks. Every slice used to span the file's full
 * angular width, which spends one dimension on nothing: a file's capacity was its band's
 * radial height over a minimum slice — about twenty — however large the file was. Splitting
 * in both directions makes capacity proportional to the wedge's AREA, which is
 * proportional to the file's lines, so a big file gets room for its functions for the same
 * reason it is big.
 *
 * The reading changes with it, and for the better. Band thickness used to mean "share of
 * THIS file" and nothing across files was comparable; a patch's area is lines, exactly, at
 * every radius. The overflow roll-up survives for files that are still too small to open —
 * it is a floor on legibility, not on capacity — but it is now the exception rather than
 * what happens to every file over forty functions.
 */
export function tileFunctions(
  children: Node[],
  r0: number,
  r1: number,
  a0: number,
  a1: number,
  opts: LayoutOpts = {},
): Slot[] {
  let fns = children.filter((c) => c.kind === 'func')
  if (fns.length === 0) return []
  if (opts.byHeat) fns = [...fns].sort((x, y) => heatOf(y) - heatOf(x))

  const sector: Sector = { a0, a1, v0: vOf(r0), v1: vOf(r1) }
  // Exactly the screen area of the annular sector, by the substitution above.
  const area = (a1 - a0) * (sector.v1 - sector.v0)
  if (area <= 0) return []

  const minPatch = opts.minPatchArea ?? MIN_PATCH_AREA
  const weight = (f: Node) => (opts.even ? 1 : Math.max(f.loc, 1))
  let allWeight = 0
  for (const f of fns) allWeight += weight(f)

  /**
   * Whether THIS function clears the floor, not whether the file's average would.
   *
   * The first cut computed one capacity — `area / minPatch`, an even split — and then took
   * the hottest that many. That throws away functions the tiling had room for: probe.rs
   * came out as 106 patches and one roll-up standing for 680, and because the roll-up
   * carries their combined lines it was the largest block on the wedge. The biggest thing
   * in the picture was the thing with the least in it.
   *
   * Sizing is proportional, so a function's own share is knowable up front and the
   * question "is there room for this one" has an exact answer. Only what genuinely cannot
   * be drawn is rolled up, and the roll-up is then as small as the code it stands for.
   */
  const share = (f: Node) => (weight(f) / allWeight) * area
  // ...or it is hot. A three-line guard with an inverted comparison is exactly what this
  // map exists to surface, and dropping it for being short would answer the overflow by
  // discarding the product's central claim. It is drawn at the floor, which is the one
  // place a patch's area is allowed to overstate its lines — and it is a floor, so it
  // cannot be mistaken for a large function.
  const capacity = Math.max(1, Math.floor(area / minPatch))

  /**
   * Size decides who fits; heat spends what is left over.
   *
   * The two rules have to compose, and getting the order wrong breaks a different thing
   * each way. Heat alone — the first cut — takes the hottest N and leaves a roll-up
   * holding a share of the LINES roughly equal to its share of the count: on probe.rs, 680
   * of 786 and with them most of the wedge, so the biggest block in the picture was the one
   * with the least in it. Size alone leaves nothing drawn at all on that file, because at
   * 786 functions no single one clears the floor on its own.
   *
   * Sized first, then heat: everything that can be drawn honestly is, and because the test
   * is the same quantity that decides area, what is left over is small BY AREA as well as
   * uninteresting. Then the leftover room goes to the hottest of the remainder, at the
   * floor, which is where the standing rule about the three-line guard with the inverted
   * comparison gets its due — a short hot function is exactly what this map exists to
   * surface and must never be dropped for being short.
   */
  const fits = fns.filter((f) => share(f) >= minPatch)
  const tail = fns.filter((f) => share(f) < minPatch)
  // Room for the lifted, bounded by what will fit at all.
  const room = Math.max(0, capacity - fits.length - (tail.length > 0 ? 1 : 0))
  // Hot first, then longest. Two different jobs in one ordering.
  //
  // The hot ones are the standing rule: a short function a reader could not predict is
  // exactly what this map exists to surface, and it must never be dropped for being
  // short. They are rare by construction, so lifting them costs almost nothing.
  //
  // Then the room that is left goes to the LONGEST of what remains, not the next-hottest.
  // Sorting the whole tail by heat filled the wedge with cold three-line functions at the
  // same size as everything around them — graph paper, where a floor handed to most of
  // the members stops being a floor and becomes the size. The longest are the ones nearest
  // to clearing the floor on their own, so drawing them there overstates them least, and
  // they are the ones whose absence would put the most LINES into the roll-up.
  //
  // What bounds the lifting is how far each patch would have to be STRETCHED, not how
  // many are lifted. An aggregate cap — spend at most half the wedge on floors — pins the
  // roll-up at exactly half whatever the file is, which is a fact about the cap and not
  // about the code; a per-patch limit says the thing that is actually true, that a patch
  // may overstate its lines by up to `MAX_STRETCH` and no further. A function far below
  // that is not nearly-drawable, it is undrawable, and belongs in the roll-up.
  const order = (f: Node) => (heatOf(f) > HOT ? 1e9 : 0) + weight(f)
  const promoted = new Set(
    [...tail]
      .filter((f) => heatOf(f) > HOT || share(f) * MAX_STRETCH >= minPatch)
      .sort((x, y) => order(y) - order(x))
      .slice(0, room)
      .map((f) => f.id),
  )
  const shown = fns.filter((f) => share(f) >= minPatch || promoted.has(f.id))
  const rest = fns.filter((f) => share(f) < minPatch && !promoted.has(f.id))

  const members = rest.length > 0 ? [...shown, aggregate(rest, rest[0].path)] : shown
  const roll = members.find((f) => f.rest !== undefined)

  /**
   * What each member would take if it could have what it wants, then everything scaled to
   * fit. One pass, and it cannot produce a zero.
   *
   * Handing out the wedge in priority order — the roll-up first, then floors for the
   * lifted, then "whatever is left" in proportion — sounds right and has a hole in it: the
   * first two claims can add up to the whole wedge, and then "whatever is left" is nothing.
   * Every proportionally-sized patch got area zero and rendered as the background cut,
   * which is why the wedge came out as white slices. A remainder is not a budget.
   *
   * Wants: a function that clears the floor wants its lines; one below it wants the floor;
   * the roll-up wants its lines or four patches, whichever is more. Those overshoot the
   * wedge by exactly what the floors added, so scaling by `area / wanted` shrinks
   * everything by the same factor. Ordering survives, nothing degenerates, and the floors
   * give a little rather than the proportional patches giving everything.
   */
  const want = (f: Node) => {
    const own = (weight(f) / allWeight) * area
    if (f === roll) return Math.max(own, minPatch * ROLLUP_PATCHES)
    return Math.max(own, minPatch)
  }
  let wanted = 0
  for (const f of members) wanted += want(f)
  const scale = wanted > 0 ? area / wanted : 0
  // File order, not size order. The findings this map earns — a test named for a property
  // its neighbors show it lacks — come from adjacency, which is the same argument `peers`
  // makes for handing a reader the nearest twenty in file order. Squarifying wants items
  // largest-first to pack well; that is traded away deliberately.
  const items = members.map((f) => ({ node: f, area: want(f) * scale }))

  const out: Slot[] = []
  let sec = { ...sector }
  let queue = items
  while (queue.length > 0) {
    const rIn = rOf(sec.v0)
    const rOut = rOf(sec.v1)
    const rMid = rOf((sec.v0 + sec.v1) / 2)
    const arc = (sec.a1 - sec.a0) * rMid
    if (arc <= 0 || rOut - rIn <= 0) break
    // Rows run ACROSS the shorter side — the row spans it, and eats into the longer one —
    // which is what keeps both the patches and the leftover rectangle near square. Having
    // this backwards is not a subtle loss: in a wedge six pixels of arc by forty of radius
    // it laid rows the long way, so each row was a ribbon a fraction of a pixel wide and
    // the file rendered as white slices. `radial` means the row spans the full ANGLE, so
    // it is the right choice exactly when the angle is the short side.
    const radial = arc <= rOut - rIn

    let row: typeof queue = []
    let best = Infinity
    let placed = rowPlacement([], sec, radial)
    for (const item of queue) {
      const next = rowPlacement([...row, item], sec, radial)
      const ratio = worstRatio(next.dims)
      if (row.length > 0 && ratio > best) break
      row = [...row, item]
      best = ratio
      placed = next
    }
    out.push(...placed.slots)
    sec = radial
      ? { ...sec, v0: sec.v0 + placed.consumed }
      : { ...sec, a0: sec.a0 + placed.consumed }
    queue = queue.slice(row.length)
  }

  if (rest.length > 0 && out.length > 0) {
    // The roll-up is identified by the node it carries, not by its position — rows are
    // laid in file order and it is the last MEMBER, which is not the last patch.
    const last = out.find((s) => s.node.rest !== undefined)
    if (last) last.rest = rest.length
  }
  return out
}

/**
 * A file's functions as angular slices of a ring, for when the file IS the view.
 *
 * The radial stack above is right in the overview: a function drawn in its file's own
 * band, at its file's full angular width, is contained by construction rather than by
 * inference. But a band is a fixed ~60px of radius however many functions share it, so
 * radial subdivision has a hard ceiling — around forty — and past it the file is a moiré
 * pattern no matter how the arithmetic is arranged.
 *
 * Drilling into the file was supposed to be the escape hatch and was not: a root file
 * became one full-circle wedge and its functions were stacked into the same fixed radius,
 * so 150 functions became 150 grooves in a record. Angle is the budget that actually
 * scales — a whole circle divided 150 ways is 2.4° each, which is clickable, labellable,
 * and back to being proportional to lines.
 */
export function sliceFunctions(
  children: Node[],
  a0: number,
  a1: number,
  opts: LayoutOpts = {},
): Wedge[] {
  let fns = children.filter((c) => c.kind === 'func')
  if (fns.length === 0) return []
  if (opts.byHeat) fns = [...fns].sort((x, y) => heatOf(y) - heatOf(x))

  const span = a1 - a0
  // Same shape of guard as the radial stack, in the other axis. A full circle at this
  // floor holds well over a thousand functions, so in practice nothing overflows here —
  // but a generated file can hold anything, and the failure this replaces was exactly a
  // floor that quietly stopped floring.
  const minAngle = opts.minAngle ?? MIN_ANGLE
  const capacity = Math.max(1, Math.floor((span * FLOOR_SHARE) / minAngle))
  let shown = fns
  let rest: Node[] = []
  if (fns.length > capacity) {
    const rank = new Map(
      [...fns].sort((x, y) => heatOf(y) - heatOf(x)).map((f, i) => [f.id, i] as const),
    )
    shown = fns.filter((f) => (rank.get(f.id) ?? 0) < capacity - 1)
    rest = fns.filter((f) => (rank.get(f.id) ?? 0) >= capacity - 1)
  }

  const slices = rest.length > 0 ? [...shown, aggregate(rest, rest[0].path)] : shown
  const min = Math.min(minAngle, span / slices.length)
  const weight = (f: Node) => (opts.even ? 1 : Math.max(f.loc, 1))
  const total = slices.reduce((s, f) => s + weight(f), 0)
  const free = Math.max(0, span - min * slices.length)

  const out: Wedge[] = []
  let a = a0
  slices.forEach((f, i) => {
    const w = min + (free * weight(f)) / total
    out.push({ node: f, depth: 1, a0: a, a1: a + w, index: i })
    a += w
  })
  return out
}

/** Where a label's optical center sits relative to its baseline, as a fraction of font
 *  size — and it is not the same in both directions.
 *
 *  Cap height is about 0.7em, so the arithmetic answer is half of that either way. The
 *  reversed case wants less, because on a reversed arc the DESCENDERS point outward
 *  while on a forward one they point in, so the ink is not distributed symmetrically
 *  about the baseline in the two cases. These two are eyeballed against the running app
 *  rather than derived; they are optical constants and the only honest way to set them
 *  is to look. */
const BASELINE_TO_CENTER_FORWARD = 0.35
const BASELINE_TO_CENTER_REVERSED = 0.28

/**
 * An arc for a label to sit ON, rather than a point to rotate a label about.
 *
 * `labelTransform` places a straight run of text tangent to the ring at the wedge's
 * midpoint, so the longer the name the further its ends drift off the band — which caps
 * how big the type can be before it leaves the wedge entirely. Text bound to a path
 * curves with the ring instead and stays inside its own arc at any length, so the type
 * can grow to fit the band rather than the chord.
 *
 * The arc is reversed for wedges in the BOTTOM half of the circle. Text on a path runs
 * along the path's own direction, so a left-to-right arc through the bottom of the ring
 * comes out upside down; drawing that span right-to-left instead keeps every label
 * readable without rotating the glyphs.
 */
export function labelArc(a0: number, a1: number, r: number, fontSize: number): string {
  // Normalized, because the layout starts at -π/2 and midpoints can be negative — an
  // un-normalized comparison silently stops flipping the labels that need it.
  const mid = ((((a0 + a1) / 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  const upsideDown = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2

  // Text sits ON its baseline and grows away from it, so the path has to be offset by
  // half a cap height for the LETTERS to land on `r`. Which way depends on the arc's
  // direction: glyphs rise outward on a forward arc and inward on a reversed one.
  //
  // `dominant-baseline: central` is the declarative way to say this and WebKit does not
  // honor it on textPath content, so the labels drifted by an amount proportional to
  // their font size — invisible on the small deep ones, obvious on the big inner rings.
  // Geometry is not optional in the same way a style property is.
  const rr =
    r +
    (upsideDown ? fontSize * BASELINE_TO_CENTER_REVERSED : -fontSize * BASELINE_TO_CENTER_FORWARD)
  const x = (a: number) => (rr * Math.sin(a)).toFixed(2)
  const y = (a: number) => (-rr * Math.cos(a)).toFixed(2)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return upsideDown
    ? `M ${x(a1)} ${y(a1)} A ${rr} ${rr} 0 ${large} 0 ${x(a0)} ${y(a0)}`
    : `M ${x(a0)} ${y(a0)} A ${rr} ${rr} 0 ${large} 1 ${x(a1)} ${y(a1)}`
}
