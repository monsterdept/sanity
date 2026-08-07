import { HOT, showsShare, temperature, type Node } from './api'

export interface Wedge {
  node: Node
  depth: number
  /** Radians, clockwise from 12 o'clock. */
  a0: number
  a1: number
  /** Position among its siblings, used to stagger dots so neighbours don't collide. */
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
 *  were visible; above it — a maximised window on a large display — it went on culling
 *  wedges that would have rendered two pixels wide and been perfectly clickable. The map
 *  hid the same amount of the repo however much room you gave it.
 *
 *  So it is now a default rather than the rule. `LayoutOpts.minAngle` carries the real
 *  threshold, derived from the pane, and the neighbouring `MIN_SLICE` — which was always
 *  honest about being in pixels — is the model. */
const MIN_ANGLE = 0.0025

/**
 * Partition the tree into rings, angles proportional to lines.
 *
 * Children are laid out in the order the backend produced them, which is directory
 * order — deliberately not sorted by size or heat. A ring that reorders itself between
 * two scans destroys the one thing that makes a second visit useful: recognising the
 * shape you saw last time and spotting what changed.
 */
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
  /** Thinnest radial slice worth drawing, in the layout's own units.
   *
   *  The same correction as `minAngle`, in the other axis. `MIN_SLICE` is documented in
   *  pixels and measured in pixels, but `stackFunctions` is handed radii in user units —
   *  which only coincide with pixels at one window size. Omit it and the fixed default
   *  stands. */
  minSlice?: number
  /** Order siblings by temperature instead of by name.
   *
   *  Directory order is the default because it makes the picture stable between scans,
   *  which is what lets you recognise a repo's shape and spot what changed. Sorting by
   *  heat gathers everything worth reading into one contiguous arc, which is much faster
   *  to find and destroys that stability — a deliberate trade, per view. */
  byHeat?: boolean
  /** Directories the user has folded shut. Their contents are not laid out at all, so
   *  the ring budget goes to what is still open — collapsing a directory makes every
   *  remaining band thicker rather than just blanking one. Contents are not counted as
   *  `hidden`: that number means "too thin to draw", and this omission was asked for. */
  collapsed?: ReadonlySet<string>
}

function heatOf(n: Node): number {
  const s = n.score
  if (!s) return 0
  return showsShare(n) ? s.hotShare : s.surprise
}

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
    // between two scans, so the ring you recognise stays the ring you recognise.
    // Falls back to name for equal sizes, so the order is fully determined rather than
    // left to sort stability.
    const kids = opts.byHeat
      ? [...node.children].sort((x, y) => heatOf(y) - heatOf(x))
      : [...node.children].sort((x, y) => y.loc - x.loc || x.name.localeCompare(y.name))
    const weight = (c: Node) => (opts.even ? 1 : Math.max(c.loc, 1))
    const total = kids.reduce((s, c) => s + weight(c), 0)
    let a = a0
    let idx = 0
    for (const child of kids) {
      const span = ((a1 - a0) * weight(child)) / total
      // Functions are never dropped for thinness. They render as dots, which have a
      // minimum size no matter how many share a ring — the whole reason for drawing them
      // that way. Only arcs, which genuinely vanish below a pixel, get culled.
      if (span < (opts.minAngle ?? MIN_ANGLE) && child.kind !== 'func') {
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

/** One function's radial slot inside its file's wedge. */
export interface Slot {
  node: Node
  r0: number
  r1: number
  /** How many functions this slot stands in for, when it is an overflow aggregate.
   *  Undefined on a real function. */
  rest?: number
}

/**
 * Thinnest slice worth drawing.
 *
 * The cut between two slices is a 0.6px stroke, so below about this a slice is mostly its
 * own border and what you see is the gap rather than the code. Measured, not chosen: a
 * 150-function file in a 60px band rendered 0.40px slices and read as a moiré pattern.
 */
const MIN_SLICE = 1.4

/**
 * The most of a band that may go to floors, leaving the rest to mean something.
 *
 * Capacity was `height / MIN_SLICE`, which packs the band to the brim with minimums and
 * leaves about a pixel of proportional budget for every slice to share. Everything then
 * renders at the floor again — including the aggregate, which stood for 925 lines and
 * drew the same width as its three-line neighbour. That is the original bug wearing a
 * different number: a floor is only a floor while something else decides the rest.
 *
 * Half. Fewer slices, each of which is honestly sized, beats more slices that are all
 * the same size — the second is a texture, not a measurement.
 */
const FLOOR_SHARE = 0.5

/**
 * Everything the band could not fit, as one wedge.
 *
 * A synthetic function node rather than a special case in the renderer: colour, heat,
 * hover and all five colour modes key off a `Node`, so giving the aggregate a real one
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
  // were drawn as their own wedges, so a mean of it is bounded by its coldest neighbour
  // and reports the truncation rather than the code.
  const hotLoc = read.reduce(
    (n, f) => n + (temperature(f.score) > HOT ? Math.max(f.loc, 1) : 0),
    0,
  )
  return {
    id: `${filePath}#rest`,
    // Read as "126 and more". The count is the useful half and any word after it would
    // not survive the arc this has to fit inside.
    name: `${fns.length}+`,
    kind: 'func',
    path: filePath,
    loc,
    line: null,
    endLine: null,
    lang: first.lang,
    // Not inherited from the members: the flag sits on the FILE node, and this stand-in
    // hangs under that same file, so it is out of scope exactly when its parent is.
    excluded: false,
    lastAuthor: first.lastAuthor,
    body: null,
    hotspots: [],
    // What makes this a collection rather than a function, everywhere colour is decided.
    // Carried on the node and not just on the `Slot` because `colorFor` is handed a node
    // and nothing else — a wedge cannot be coloured correctly by a fact its own node does
    // not hold.
    rest: fns.length,
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
            churn: mean((f) => f.score!.churn),
            ageDays: mean((f) => f.score!.ageDays ?? 0),
            lastTouchedDays: mean((f) => f.score!.lastTouchedDays ?? 0),
            commits: Math.round(mean((f) => f.score!.commits)),
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
 * Stack a file's functions radially inside the file's own angular wedge.
 *
 * The alternative — giving functions their own outer ring, subdivided angularly — makes
 * containment a hint rather than a fact. A dot or a sliver sits in a *different ring*
 * from its file, so which file it belongs to has to be inferred from angle, and at any
 * real function count that inference fails: siblings scatter, neighbours from adjacent
 * files interleave, and everything lands near a boundary.
 *
 * Here a function is literally inside its file. Every band spans the file's full angular
 * width and stacks outward, so there is no ambiguity to resolve.
 *
 * The trade is deliberate. Angular width no longer means "lines" for a function — band
 * thickness means "share of THIS file". Comparison becomes local: within a file you can
 * see instantly that one function is half of it. Across files it is no longer apples to
 * apples, because a narrow file's bands are thin no matter how much code they hold. That
 * is the right way round for this chart: "which file is this in" is asked constantly,
 * "is this bigger than that one three directories away" almost never.
 */
export function stackFunctions(
  children: Node[],
  r0: number,
  r1: number,
  opts: LayoutOpts = {},
): Slot[] {
  let fns = children.filter((c) => c.kind === 'func')
  if (fns.length === 0) return []
  // Match the ring's own ordering and sizing, or the stack inside a file would disagree
  // with the arcs around it.
  if (opts.byHeat) fns = [...fns].sort((x, y) => heatOf(y) - heatOf(x))

  const height = r1 - r0

  // How many slices this band can hold at a size worth drawing.
  //
  // The floor here used to be `min(1.4, height / n)`, which looks defensive and is not:
  // past about forty functions the second term wins, `min * n` consumes the whole band,
  // and the proportional budget left over is exactly zero. Every function then rendered
  // at the same sub-pixel height whatever its length — so the ring stopped meaning
  // "width is lines" and started meaning nothing, with no way to tell by looking.
  const minSlice = opts.minSlice ?? MIN_SLICE
  const capacity = Math.max(1, Math.floor((height * FLOOR_SHARE) / minSlice))

  let shown = fns
  let rest: Node[] = []
  if (fns.length > capacity) {
    // Keep the HOTTEST, not the largest. A three-line guard with an inverted comparison
    // is exactly what this map exists to surface, and dropping it for being short would
    // answer the overflow by discarding the product's central claim. Length still decides
    // how much room each kept slice gets, below.
    const rank = new Map(
      [...fns].sort((x, y) => heatOf(y) - heatOf(x)).map((f, i) => [f.id, i] as const),
    )
    const keep = capacity - 1
    shown = fns.filter((f) => (rank.get(f.id) ?? 0) < keep)
    rest = fns.filter((f) => (rank.get(f.id) ?? 0) >= keep)
  }

  // The aggregate goes at the outer edge rather than in size order. It is not a function;
  // it is the edge of what this band could show, and it reads as a boundary there.
  const slots = rest.length > 0 ? [...shown, aggregate(rest, rest[0].path)] : shown
  const last = slots.length - 1
  const min = Math.min(minSlice, height / slots.length)
  const weight = (f: Node) => (opts.even ? 1 : Math.max(f.loc, 1))
  const total = slots.reduce((s, f) => s + weight(f), 0)
  const free = Math.max(0, height - min * slots.length)

  const out: Slot[] = []
  let r = r0
  slots.forEach((f, i) => {
    const h = min + (free * weight(f)) / total
    out.push({
      node: f,
      r0: r,
      r1: r + h,
      rest: rest.length > 0 && i === last ? rest.length : undefined,
    })
    r += h
  })
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
/** Where a label's optical centre sits relative to its baseline, as a fraction of font
 *  size — and it is not the same in both directions.
 *
 *  Cap height is about 0.7em, so the arithmetic answer is half of that either way. The
 *  reversed case wants less, because on a reversed arc the DESCENDERS point outward
 *  while on a forward one they point in, so the ink is not distributed symmetrically
 *  about the baseline in the two cases. These two are eyeballed against the running app
 *  rather than derived; they are optical constants and the only honest way to set them
 *  is to look. */
const BASELINE_TO_CENTRE_FORWARD = 0.35
const BASELINE_TO_CENTRE_REVERSED = 0.28

export function labelArc(a0: number, a1: number, r: number, fontSize: number): string {
  // Normalised, because the layout starts at -π/2 and midpoints can be negative — an
  // un-normalised comparison silently stops flipping the labels that need it.
  const mid = (((a0 + a1) / 2) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)
  const upsideDown = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2

  // Text sits ON its baseline and grows away from it, so the path has to be offset by
  // half a cap height for the LETTERS to land on `r`. Which way depends on the arc's
  // direction: glyphs rise outward on a forward arc and inward on a reversed one.
  //
  // `dominant-baseline: central` is the declarative way to say this and WebKit does not
  // honour it on textPath content, so the labels drifted by an amount proportional to
  // their font size — invisible on the small deep ones, obvious on the big inner rings.
  // Geometry is not optional in the same way a style property is.
  const rr =
    r +
    (upsideDown
      ? fontSize * BASELINE_TO_CENTRE_REVERSED
      : -fontSize * BASELINE_TO_CENTRE_FORWARD)
  const x = (a: number) => (rr * Math.sin(a)).toFixed(2)
  const y = (a: number) => (-rr * Math.cos(a)).toFixed(2)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return upsideDown
    ? `M ${x(a1)} ${y(a1)} A ${rr} ${rr} 0 ${large} 0 ${x(a0)} ${y(a0)}`
    : `M ${x(a0)} ${y(a0)} A ${rr} ${rr} 0 ${large} 1 ${x(a1)} ${y(a1)}`
}
