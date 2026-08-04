import type { Node } from './api'

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

/** Below this a wedge is under a pixel at any realistic radius, and rendering it costs
 *  a DOM node to draw nothing. A large monorepo has tens of thousands of functions and
 *  the browser will not survive an arc for each. */
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
  return n.kind === 'func' ? s.surprise : s.hotShare
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
      if (span < MIN_ANGLE && child.kind !== 'func') {
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
  // A floor, so a three-line helper in a big file is still visible and clickable rather
  // than a sub-pixel line. Taken out of the proportional budget rather than added on
  // top, so the stack still exactly fills the band.
  const min = Math.min(1.4, height / fns.length)
  const weight = (f: Node) => (opts.even ? 1 : Math.max(f.loc, 1))
  const total = fns.reduce((s, f) => s + weight(f), 0)
  const free = Math.max(0, height - min * fns.length)

  const out: Slot[] = []
  let r = r0
  for (const f of fns) {
    const h = min + (free * weight(f)) / total
    out.push({ node: f, r0: r, r1: r + h })
    r += h
  }
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
