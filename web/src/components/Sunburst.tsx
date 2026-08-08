import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { arcPath, labelArc, layout, tileFunctions, type Wedge } from '../lib/sunburst'
import { RollupDots } from './RollupDots'
import { StaleHatch } from './StaleHatch'
import { WedgeTip } from './WedgeTip'

/** Rings drawn at once. Deeper than this and the outer annuli are hairlines; the
 *  answer is to drill in, which is what clicking a directory does. */
const RINGS = 5
const R_INNER = 62
const R_OUTER = 340

/** Gap between one ring level and the next.
 *
 *  Directories, files and functions are three different KINDS of thing and were drawn as
 *  one continuous mass of arcs. Hue cannot carry the distinction — hue is the reading —
 *  so it falls to geometry: a visible gutter between levels, and a frame of the file's
 *  own colour around the functions it holds. */
const RING_GAP = 3

/** The rim of its own colour a file leaves around the functions it holds — the thing
 *  that says "these belong to that" with geometry instead of with a legend.
 *
 *  ONE constant, in user units, for all four edges. The azimuthal rim used to be a
 *  FRACTION of the wedge's angular span (0.06) while the radial rim was a constant, so
 *  the side rims came out as `0.06 x span x r` — scaling with both the file's width and
 *  its radius, while the arc rims stayed put. Wide files got a fat frame, narrow ones a
 *  hairline, and no file got a uniform one.
 *
 *  Radians are not a length: converting through the band's mid-radius is what makes an
 *  angular inset comparable to a radial one.
 *
 *  Widened from 3, which was enough to READ as containment and not enough to CLICK. A
 *  file's own target is exactly the rim its functions do not cover, so at three pixels
 *  selecting a file was a coin-flip against selecting whichever function you landed on.
 *  The invisible target over the ring gap helped and could not fix it: the functions sit
 *  on top, so nothing inside their bounds is reachable.
 *
 *  Bought from the function stack, which loses about eight pixels of band — three slices
 *  of capacity at five rings, 17 down to 14, before the overflow aggregate absorbs the
 *  rest. A file you can select, against a few more functions drawn rather than
 *  summarised. */
const FUNC_RIM = 7

/** Floor on how much of a narrow file's span the functions keep. Without it, converting
 *  a fixed rim to an angle eats a thin wedge entirely — the rim would be wider than the
 *  wedge and the functions inside it would invert.
 *
 *  PER SIDE, so 0.35 was leaving a narrow file 30% of its own width and doing most of
 *  the blanking the area gate was written to undo: at `tui`'s depth 1 a 1,000-line file
 *  has 3.45 units of arc, of which the rim took 2.4 and the tiling was then refused for
 *  the 1.03 that was left. At 0.2 it keeps 60% and opens; measured across that band, the
 *  floor for opening at depth 1 falls from 5,000 lines to 1,000.
 *
 *  What it costs is the rim's other job. `FUNC_RIM` was widened from 3 to 7 because a
 *  file's own click target is exactly the frame its functions do not cover, and on the
 *  narrowest files this hands some of that back — a 1,000-line file at depth 1 gets about
 *  0.55px a side. Those are the files that were drawn solid and entirely clickable
 *  before, so the trade is legibility for a target, on the wedges where the target was
 *  the only thing there. */
const FUNC_RIM_MAX_SHARE = 0.2

/** Arc a file needs at its band's mid-radius before its functions are worth drawing.
 *
 *  This used to be the whole gate, and it could be, because a radial slice spanned the
 *  file's full angular width — arc was the only dimension a slice had, so a narrow file
 *  could only ever produce a picket fence of keylines. Tiling spends both dimensions, so
 *  what is left for this constant is the narrow job it can still do honestly: a wedge
 *  thinner than about two units cannot hold a patch wide enough to see or to hit,
 *  whatever its radial extent. Capacity is `OPEN_PATCHES` below.
 *
 *  Was 5, which silenced a file of a thousand lines while its wedge had room for twenty
 *  patches. */
const MIN_STACK_ARC = 2

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
 *  At the pattern's 3.2-unit pitch, ten pixels is a 3×3 field of dots — enough to read as
 *  a texture rather than as specks. */
const ROLLUP_TEXTURE_PX = 10

/** Patches a wedge must have room for before it is opened at all.
 *
 *  One is not enough: a wedge with capacity for a single patch draws its roll-up across
 *  its own area, which repaints the file in the roll-up's colour and says nothing the
 *  file's own fill was not already saying. Four is the smallest tiling that shows a file
 *  has PARTS, which is the claim opening it makes. */
const OPEN_PATCHES = 4

/** Narrowest a wedge may be drawn, in real screen pixels.
 *
 *  The sibling of `MIN_SLICE` in the file band, and stated the same way: the cut between
 *  two wedges is a stroke, so below about a pixel what you see is the gap rather than the
 *  code. Expressed in pixels because that is the thing the eye has — the layout's own
 *  units are arbitrary and the viewBox rescales them to whatever the pane is. */
const MIN_ARC_PX = 1

/** The same floor for the function tiling inside a file's band, as an AREA in real screen
 *  pixels — about a 3.5×3.5 patch. The old radial stack floored one dimension at 1.4px
 *  while the other was the file's whole angular width, which is how a 786-function file
 *  came to have room for twenty.
 *
 *  What sets this number is the CUT, not the eye: a patch of side `s` has an interior of
 *  `(s − cut)²`, so at the old 0.6-unit cut a 3.5px patch was 64% code and 36% border,
 *  and the floor had to sit at 26px² to keep a patch from being mostly its own edge.
 *  Thinning the cut to 0.35 puts a 3.5px patch back at 78% — the same ink ratio 5.1px had
 *  before — and doubles what a wedge can hold. Measured on probe.rs's real wedge (4,625px²
 *  for 786 functions): 176 drawn at 26, 384 at 12. Move the two together or neither
 *  means what it says. */
const MIN_PATCH_PX = 12

/** How coarsely the pane's size is read when deriving that threshold.
 *
 *  Wedges winking in and out while a window edge is dragged would be worse than the
 *  problem: this codebase argues everywhere that the picture should stay recognisable
 *  between visits, and a layout that reflows continuously is not recognisable at all.
 *  Quantising also breaks the feedback loop — the viewBox is measured from what was
 *  drawn, so a threshold read off a continuously-varying size could chase its own tail.
 *  At this step a normal resize crosses no boundary and nothing moves; opening the same
 *  window on a much larger display crosses several, and more of the repo appears. */
const SIZE_STEP = 160

/** Space left around the composition, as a fraction of its own half-extent. */
const MARGIN = 0.05

/** Extra room at the bottom for the legend and the hidden-count chip — HTML overlays in
 *  the same box, invisible to `getBBox`, which the rings would otherwise grow behind. */
const CHROME_BOTTOM = 0.1

/** How strongly each level carries the heat ramp.
 *
 *  Directories were zeroed here, on the argument that a directory's colour is `hotShare` —
 *  what FRACTION of its lines are hot, a different quantity wearing the same ramp — and
 *  that because the inner rings dominate by area it would be the loudest thing on screen
 *  while the actual findings sat in thin bands at the edge.
 *
 *  Both halves of that have since stopped being true. The findings are no longer in thin
 *  bands: `tileFunctions` fills every file's wedge with per-function colour, so the leaves
 *  now carry most of the painted area and a directory tint is no longer the loudest thing
 *  in the window. And the quantity is no longer raw — `shareRamp` calibrates it onto the
 *  ramp's own scale, which is what a share needed all along. Zeroing it was the right
 *  answer to a scale problem and the wrong place to fix it: measured across three repos,
 *  35 of 37 directories sat in the bottom fifth of the raw ramp, so even un-zeroed they
 *  would all have been the same grey. That is why turning this up alone would have looked
 *  like it did nothing.
 *
 *  Still not 1. Functions are the level where the number means exactly what the legend
 *  says, and the containers are a roll-up OF those numbers; drawing all three at full
 *  strength would make the ring you can read and the ring you have to interpret shout
 *  equally loudly. */
const HEAT_BY_KIND: Record<string, number> = { dir: 0.6, file: 0.55, func: 1 }

/**
 * ...but only under Surprise.
 *
 * The damping above is about ONE quantity: a directory's surprise colour is its hot share,
 * a roll-up rather than a reading, and the ring carrying it is the one that dominates by
 * area. That argument does not generalise. A directory's churn, its age, its dominant
 * language and its last author are all perfectly well-defined aggregates of exactly the
 * quantity the ramp is showing — the same measurement over more code, not a different one
 * — so in those modes a damped inner ring is not restraint, it is a hole.
 */
function heatShare(kind: string, mode: ColorMode): number {
  if (mode === 'surprise') return HEAT_BY_KIND[kind] ?? 1
  return 1
}

/** The cut between one wedge and its neighbour, in user units.
 *
 *  Drawn as a background-coloured stroke rather than an angular pad, so the gap is a
 *  CONSTANT width at every radius. An angular pad would open up at the rim and close to
 *  nothing near the hub, which is exactly backwards — the inner rings are where wedges
 *  are already hardest to tell apart. Narrower for the finer levels so a file's rim
 *  doesn't swallow the functions inside it. */
const CUT = { dir: 2.2, file: 1.5, func: 0.35 }

/** A pattern id from a file path.
 *
 *  Ids may not hold slashes or dots, and the obvious `replace(/[^a-zA-Z0-9]/g, '-')` is
 *  not injective — `a/b.rs` and `a-b.rs` both come out `a-b-rs`, and the two would share
 *  one grid, drawn at whichever of their angles React rendered second. Escaping to the
 *  character code cannot collide, because the escape is the one character it removes. */
function dotsId(path: string): string {
  return `dots-${path.replace(/[^a-zA-Z0-9]/g, (c) => `-${c.charCodeAt(0)}-`)}`
}

export function Sunburst({
  root,
  selected,
  onSelect,
  onDrill,
  onClear,
  mode,
  ranks,
  onUp,
}: {
  root: Node
  selected: Node | null
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
  onClear: () => void
  mode: ColorMode
  ranks?: Map<string, number>
  /** Undefined at the top level, which is what disables the hub's go-up affordance. */
  onUp?: () => void
}) {
  /** The hovered node plus where the pointer is, in container coordinates.
   *
   *  Replaces the SVG `<title>` elements this used to lean on. Those are rendered by the
   *  OS, which means a ~1s delay before anything appears and no say over what it says —
   *  the two complaints about it were the same bug. */
  const [hoverNode, setHoverNode] = useState<Node | null>(null)
  /** Pointer position, tracked separately from WHAT is hovered. Folding the two together
   *  meant a freshly entered wedge had no position yet — the tooltip appeared at the
   *  container's corner for one frame before the next mousemove corrected it. */
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [box, setBox] = useState({ w: 0, h: 0 })
  const art = useRef<SVGGElement>(null)
  const pane = useRef<HTMLDivElement>(null)
  /** The pane's size, measured rather than inferred from pointer traffic.
   *
   *  `box` was only written in `onMouseMove`, which is fine for placing a tooltip — the
   *  pointer is by definition inside — and useless for deciding a layout, because it is
   *  {0,0} until someone moves the mouse over the chart. A threshold read off that would
   *  have been the fallback on every fresh render and then silently changed the picture
   *  the first time the pointer crossed it. */
  useLayoutEffect(() => {
    const el = pane.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** The thinnest wedge worth drawing here, in radians.
   *
   *  The composition is drawn at a fixed radius in arbitrary units and the viewBox scales
   *  it to the pane, so the pixel width of a given angle is `R_OUTER × angle × scale`.
   *  Inverting that for one pixel is the whole of this. The nominal extent is used rather
   *  than the measured viewBox on purpose: the viewBox is derived from what was drawn, and
   *  feeding it back into what to draw is a loop. The rings always span `R_INNER..R_OUTER`
   *  whatever the repo, so the nominal is right to within the margins anyway. */
  /** User units per screen pixel, quantised. Everything below is stated in pixels and
   *  converted through this, so the two axes answer to the same rule. */
  const unitsPerPx = useMemo(() => {
    const side = Math.min(box.w, box.h)
    if (side <= 0) return null
    const stepped = Math.max(SIZE_STEP, Math.round(side / SIZE_STEP) * SIZE_STEP)
    const extent = 2 * R_OUTER * (1 + 2 * MARGIN)
    return extent / stepped
  }, [box.w, box.h])

  const minAngle = useMemo(
    () => (unitsPerPx === null ? undefined : (MIN_ARC_PX * unitsPerPx) / R_OUTER),
    [unitsPerPx],
  )
  /** The function tiling's floor, same conversion SQUARED — it is an area, so a unit that
   *  is `k` pixels makes a square unit `k²` square pixels. Getting that exponent wrong is
   *  invisible at one window size and wrong at every other, which is exactly the bug
   *  `MIN_SLICE` had before it was converted at all. */
  const minPatchArea = useMemo(
    () => (unitsPerPx === null ? undefined : MIN_PATCH_PX * unitsPerPx * unitsPerPx),
    [unitsPerPx],
  )
  /** The drawn extent, in user units. Square, so the composition does not stretch. */
  const [viewBox, setViewBox] = useState('-360 -360 720 720')
  const hover = hoverNode ? { node: hoverNode, ...pos } : null
  /** Directories folded shut by clicking them. A view concern, so it lives here rather
   *  than in the app's drill stack — and it survives drilling, so a directory you closed
   *  stays closed when you come back past it. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const { wedges, hidden } = useMemo(
    () => layout(root, RINGS, { collapsed, minAngle }),
    [root, collapsed, minAngle],
  )

  /** Files whose functions get stacked.
   *
   *  Normally these come out of the layout, but `layout` never emits the ROOT as a
   *  wedge (only d > 0), so drilling into a file left both passes below with nothing to
   *  draw — the arcs pass filters functions out, and this pass looked for a file wedge
   *  that no longer existed. The drilled view came up blank. A root file becomes a
   *  full-circle wedge of its own; `arcPath` already special-cases the 2π span, because
   *  a full ring drawn as one arc has coincident endpoints and renders nothing. */
  /** Files in the current view, whose functions stack inside their band.
   *
   *  A file is never the ROOT here any more — `FileStack` owns that, because a file is a
   *  sequence and this is a geometry for sets. The special case that made a root file a
   *  full-circle wedge is gone with it. */
  const fileWedges = useMemo<Wedge[]>(
    () => wedges.filter((w) => w.node.kind === 'file'),
    [wedges],
  )

  /** Drill direction, for the transition. Compared during render rather than in an
   *  effect so the animation class is right on the first frame the new root paints. */
  const prevPath = useRef(root.path)
  const drill = root.path.length >= prevPath.current.length ? 'in' : 'out'
  useEffect(() => {
    prevPath.current = root.path
  }, [root.path])

  /** Fit the box to the composition, after it has been drawn.
   *
   *  `getBBox` reports the union of everything rendered — arcs, labels, the hub — in user
   *  units, which are independent of the viewBox. That independence is what makes this
   *  safe to run on every layout: changing the box cannot change the measurement, so
   *  there is no loop to converge.
   *
   *  Centred on the CONTENT, not on the origin. The origin is the hub, and the hub is
   *  only the middle of the composition when the painted wedges happen to be symmetric
   *  about it — which depends entirely on the repo. Squaring about the origin fit the
   *  extent correctly and then hung it off-centre: the same map sat high on one project
   *  and low on the next, by however lopsided that project's outer ring was.
   *
   *  Square, because the rings are a circle and a tight rectangular crop would scale the
   *  two axes differently through `xMidYMid` and oval them. The larger dimension decides,
   *  so nothing is cropped. */
  useLayoutEffect(() => {
    // The GROUP, not the svg.
    //
    // `getBBox` unions an element's children after their own transforms, and the art
    // sits inside a `<g>` that the drill transition scales. Measuring the svg therefore
    // measured whatever frame of that animation happened to be current — so switching
    // away and back produced a box sized to a half-finished zoom, and the map came back
    // smaller than it left. An element's own transform is excluded from its bbox, so
    // asking the animated group directly gets the geometry with the animation taken out.
    const el = art.current
    if (!el) return
    const b = el.getBBox()
    if (b.width === 0 || b.height === 0) return
    // Breathing room, as a FRACTION of the composition rather than a fixed number of
    // user units. The units are arbitrary — the viewBox rescales them to whatever the
    // pane is — so a constant inset is a different amount of visible space on every
    // repo, and at +4 it was none: the rings ran to the edge and out of it.
    const reach = Math.max(b.width, b.height) / 2
    const m = reach * MARGIN
    // And more at the bottom, because the legend and the hidden-count chip live there.
    // They are HTML overlaid on the same box, so `getBBox` cannot see them and the rings
    // will happily grow underneath — where a circle's edge sweeps closest to the corners
    // and a wedge becomes unclickable behind a caption.
    const x0 = b.x - m
    const x1 = b.x + b.width + m
    const y0 = b.y - m
    const y1 = b.y + b.height + m + reach * CHROME_BOTTOM
    const side = Math.max(x1 - x0, y1 - y0)
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const next = `${cx - side / 2} ${cy - side / 2} ${side} ${side}`
    setViewBox((prev) => (prev === next ? prev : next))
  }, [wedges, fileWedges, collapsed, mode, root])

  /** Ring thickness follows the depth actually present, so a shallow project fills the
   *  canvas instead of drawing three rings and a lot of empty paper.
   *
   *  STRUCTURAL depth only. `layout` reports the max depth over every node including
   *  functions, and sizing the bands by that reserved a whole ring for a level that is
   *  not supposed to have one — functions live inside their file's band, not outside
   *  it. The visible symptom was the hierarchy shifted outward by one: a ring holding
   *  files alongside the functions of the files one level in. */
  const structDepth = useMemo(() => {
    let d = 0
    for (const w of wedges) if (w.node.kind !== 'func') d = Math.max(d, w.depth)
    return Math.max(d, 1)
  }, [wedges])
  const band = (R_OUTER - R_INNER) / structDepth

  /** The highlighted wedge's outline, drawn once over everything at the end.
   *
   *  A stroke straddles its path, so half of it lies inside the neighbouring wedge —
   *  and siblings are painted in walk order, so every edge shared with a LATER-drawn
   *  neighbour had its outer half covered and came out at half width. The outer arc
   *  kept its full width because the ring gap leaves it free, which is what made one
   *  edge of a hovered wedge look thinner than the rest. Collected as the wedges are
   *  built below and rendered after them, so nothing can paint over it. */
  let highlight: { d: string; width: number } | null = null

  return (
    // Clicking the empty space around the chart clears the selection. Without it the
    // only way to put the panel down is to select something else, so a detail view you
    // are done with has to be replaced rather than dismissed.
    <div
      ref={pane}
      className="relative h-full min-h-0 w-full overflow-hidden"
      onClick={onClear}
      // Tracked on the container rather than per wedge: one listener instead of
      // thousands, and the tooltip keeps following the pointer as it crosses between
      // wedges. Leaving the container is the only reliable "nothing is hovered" signal
      // once the per-wedge leave handlers are gone.
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        if (r.width !== box.w || r.height !== box.h) setBox({ w: r.width, h: r.height })
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseLeave={() => setHoverNode(null)}
    >
      {/* Absolutely positioned rather than a flex child sized in percentages. As a flex
          child the SVG's `height: 100%` has to resolve through the chart pane, and when
          it doesn't the square viewBox falls back to its intrinsic ratio and takes its
          WIDTH as its height — which at full screen made the chart taller than the pane
          and pushed the legend off the bottom. `inset-0` makes both axes definite.

          The viewBox is the measured extent of what is DRAWN, not the nominal circle the
          constants describe. A tree shallower than `RINGS` never reaches `R_OUTER`, and a
          ring whose outer band is sparse does not paint to its own edge — so a fixed box
          leaves a margin whose size depends on the repo, and the map sits smaller than
          the pane it was given for reasons the reader cannot see. Measured in USER units,
          which do not change when the viewBox does, so this settles in one pass rather
          than chasing itself. */}
      <svg viewBox={viewBox} className="absolute inset-0 h-full w-full">
        <StaleHatch />
        {/* Keyed on the root so changing level remounts the group and replays the
            transition. Drilling in grows into place, drilling out shrinks into it, which
            is what makes the two directions distinguishable rather than just a fade. */}
        <g ref={art} key={root.id} className={drill === 'in' ? 'drill-in' : 'drill-out'}>
        {/* Arcs first, dots after, so a dot is never buried under the ring it belongs to. */}
        {wedges
          .filter((w) => w.node.kind !== 'func')
          .map((w) => {
          // Directories get the full gap and a visible rule; files sit tighter to the
          // functions they contain, so the eye groups file-with-contents rather than
          // file-with-neighbouring-directory.
          const gap = w.node.kind === 'dir' ? RING_GAP : RING_GAP * 0.4
          const r0 = R_INNER + (w.depth - 1) * band
          const r1 = r0 + band - gap
          // Directories used to be hard-nulled here, and that made `HEAT_BY_KIND.dir`
          // dead code: the damping is applied as `fillOpacity` on a colour, so a wedge
          // with no colour at all could never be damped, only blanked. Turning that
          // constant up did nothing, which is a bad way for a policy to be stated twice.
          //
          // It also blanked directories in EVERY mode, while `heatShare` carves out an
          // explicit exception for the other four — a directory's churn, age, owner and
          // language are the same measurement over more code, so a grey inner ring there
          // is a hole rather than restraint. That exception was unreachable.
          //
          // One mechanism now: `colorFor` decides WHAT a wedge means, `heatShare` decides
          // how loudly its level says it.
          const c = colorFor(w.node, mode, ranks)
          // Agent verdicts and model surprisal are different instruments and must be
          // told apart at a glance. Hue is spoken for — it is the reading itself — so the
          // distinction goes on the outline.

          const isSel = selected?.id === w.node.id
          const isHover = hover?.node.id === w.node.id
          const foldable = w.node.kind === 'dir' && w.node.children.length > 0
          const isFolded = foldable && collapsed.has(w.node.id)
          if (isSel || isHover) {
            highlight = { d: arcPath(w.a0, w.a1, r0, r1), width: isSel ? 2 : 1.6 }
          }
          return (
            <g key={w.node.id}>
            {/* An invisible target, wider than the thing it selects.
                A file's own visible area is the rim its functions do not cover — about
                three pixels, which is a coin-flip to hit and the reason selecting a file
                meant several tries. This spans the whole band plus half the gutter on
                either side, drawn UNDER the functions so they still take their own
                clicks. Nothing about the picture changes; only the part of it that
                answers the mouse. */}
            {w.node.kind === 'file' && (
              <path
                d={arcPath(w.a0, w.a1, r0 - RING_GAP * 0.5, r0 + band)}
                fill="transparent"
                onMouseEnter={() => setHoverNode(w.node)}
                onMouseLeave={() => setHoverNode((n) => (n?.id === w.node.id ? null : n))}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(w.node)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  onDrill(w.node)
                }}
              />
            )}
            <path
              className="wedge"
              // A file occupies exactly ONE band, like a directory. Its functions are
              // inset inside that band, so the file's own fill shows as a rim around
              // them — the containment is drawn, not implied by adjacency.
              d={arcPath(w.a0, w.a1, r0, r1)}
              // Unanalysed wedges take the neutral, not the ramp — see `isAnalyzed`.
              // A folded directory is drawn a shade heavier than an open one, so the
              // ring that ends at it reads as packed rather than as genuinely empty.
              fill={
                c
                  ? c.fill
                  : isFolded
                    ? 'color-mix(in oklch, var(--structure) 78%, var(--foreground))'
                    : 'var(--structure)'
              }
              fillOpacity={
                isSel || isHover
                  ? 0.95
                  : c
                    ? heatShare(w.node.kind, mode)
                    : w.node.kind === 'dir'
                      ? 1
                      : 0.5
              }
              // Directories, files and functions are three different kinds of thing and
              // used to be drawn identically, which made the rings read as one
              // undifferentiated mass. Stroke carries the distinction rather than hue,
              // because hue is spoken for — it is the entire message of the chart.
              // Hover gets the same outline treatment as selection, one step quieter:
              // brightening the fill alone was ambiguous on a ring of already-bright
              // wedges, so the thing under the cursor now states its own boundary.
              //
              // Everything else is separated by a CUT, not a line: the stroke is the
              // background colour, so what you see is the gap between two plates. The
              // drawn foreground outline directories used to carry was the brightest
              // thing on screen, and it sat around the level whose reading is the
              // quietest — the eye went to structure instead of to heat.
              stroke="var(--background)"
              strokeWidth={w.node.kind === 'dir' ? CUT.dir : CUT.file}
              onMouseEnter={() => setHoverNode(w.node)}
              onMouseLeave={() => setHoverNode((n) => (n?.id === w.node.id ? null : n))}
              onClick={(e) => {
                e.stopPropagation()
                // Option-click folds a directory shut — the cheap way to get a subtree
                // out of the picture without leaving the level you are on. On a modifier
                // rather than a plain click so selecting still does exactly one thing,
                // and Option rather than Command because Option-click is already the
                // disclosure gesture on this platform; Command-click means "open
                // elsewhere" nearly everywhere else.
                if (e.altKey && foldable) {
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    if (!next.delete(w.node.id)) next.add(w.node.id)
                    return next
                  })
                  return
                }
                onSelect(w.node)
              }}
              onDoubleClick={() => onDrill(w.node)}
            >
            </path>
            </g>
          )
        })}

        {/* Functions tiled INSIDE their file's wedge — see `tileFunctions`. Containment
            is structural here rather than implied, which is what a separate outer ring
            could never give, and the tiling is what lets a big file actually show what is
            in it instead of rolling most of it into one patch. */}
        {fileWedges
          .map((w) => {
            // Inside the file's OWN band — (depth - 1) — not the one beyond it. Inset
            // on both radii so the file's fill reads as a rim on the inside and outside
            // edges too, not just the angular sides.
            const bandStart = R_INNER + (w.depth - 1) * band
            const r0 = bandStart + FUNC_RIM
            // Inset angularly so the file's fill frames its own functions on both sides.
            // A root file spans the whole circle and has no neighbours to be told apart
            // from, so it takes no inset — an inset there would cut a wedge-shaped
            // notch out of a full ring for no reason.
            // Same rim as the arc edges, expressed as the angle that subtends it at
            // the band's mid-radius — so the frame is the same width all the way round.
            const rMid = bandStart + band / 2
            const pad = Math.min(FUNC_RIM / rMid, (w.a1 - w.a0) * FUNC_RIM_MAX_SHARE)
            const fa0 = w.a0 + pad
            const fa1 = w.a1 - pad
            const r1 = bandStart + band - RING_GAP * 0.4 - FUNC_RIM
            // Too small to say anything: draw the file solid instead.
            //
            // The test is AREA now, and the arc floor that used to carry it alone is down
            // to the width one patch needs. That gate was written for a radial stack,
            // where a file's whole angular width WAS one slice, so arc was the only
            // dimension a slice had and 5 units of it was the honest floor. Tiling spends
            // both, so a wedge can be narrow and still hold plenty — and the old rule was
            // silencing files that had the room. Worked through on `tui` at depth 1: a
            // 1,000-line file gets 0.0384 rad, which is 3.45 units of arc and blanked,
            // while its wedge is ~260px² and holds about twenty patches. Every file under
            // roughly 1,450 lines at that depth was being told it had nothing to show.
            //
            // Four patches rather than one, because a wedge with room for a single patch
            // draws its own roll-up over its own area and says nothing the file's fill was
            // not already saying.
            //
            // The file keeps its own fill and its own hover, and drilling in still shows
            // every function it has. `layout` already culls wedges below `MIN_ANGLE` on
            // the same reasoning; this is that rule applied one level further in, where
            // the wedges are not culled but their CONTENTS cannot be drawn.
            const patch = minPatchArea ?? MIN_PATCH_PX
            const sector = (fa1 - fa0) * ((r1 * r1 - r0 * r0) / 2)
            if ((fa1 - fa0) * rMid < MIN_STACK_ARC || sector < OPEN_PATCHES * patch) {
              return null
            }
            return tileFunctions(w.node.children, r0, r1, fa0, fa1, { minPatchArea }).map((slot) => {
              const c = colorFor(slot.node, mode, ranks)
              const isSel = selected?.id === slot.node.id
              const isHover = hover?.node.id === slot.node.id
              const d = arcPath(slot.a0, slot.a1, slot.r0, slot.r1)
              if (isSel || isHover) {
                highlight = { d, width: isSel ? 1.6 : 1.2 }
              }
              return (
                <g key={slot.node.id}>
                <path
                  className="wedge"
                  d={d}
                  fill={c ? c.fill : 'var(--unanalyzed)'}
                  fillOpacity={isSel || isHover ? 1 : c ? 0.92 : 0.4}
                  // No per-wedge source mark. It existed to tell agent verdicts from
                  // model ones, but with MCP as the primary mode everything is
                  // agent-judged — a mark on every item is stripes, not information. The
                  // detail panel names the instrument for the one wedge you asked about.
                  stroke="var(--background)"
                  strokeWidth={CUT.func}
                  onMouseEnter={() => setHoverNode(slot.node)}
                  onMouseLeave={() => setHoverNode((n) => (n?.id === slot.node.id ? null : n))}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect(slot.node)
                  }}
                  // Same gesture as a directory, one level further: double-clicking a
                  // function opens the file it lives in, at the function.
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    onDrill(slot.node)
                  }}
                >
                </path>
                {/* Drawn over the wedge, deaf to the mouse so the wedge underneath keeps
                    every gesture. The wedge itself has already fallen back to the proxy
                    colour — `applyAgentReports` drops a stale reading's score — so
                    without this the only sign a function was ever read would be in the
                    panel, one wedge at a time. The whole argument for a map is that you
                    can see where the problem is without clicking. */}
                {slot.node.agentStale && (
                  <path
                    className="pointer-events-none"
                    d={d}
                    fill="url(#stale-hatch)"
                  />
                )}
                {/* A roll-up is drawn like a function and is the largest patch in its
                    file, so at any real size it reads as one enormous cold function
                    rather than as the hundreds it stands for. The dots say otherwise —
                    see `RollupDots`.

                    Only when there is room for the texture to BE one, and the threshold
                    costs nothing: a roll-up is large exactly when its members carry a lot
                    of lines, which is the same condition that makes it mistakable. The
                    ones below the cut measure three to eight pixels on the short side and
                    nobody was going to read those as one big function anyway. Measured
                    across depths and file sizes, the two populations fall either side of
                    ten pixels with nothing in between. */}
                {slot.node.rest !== undefined &&
                  unitsPerPx !== null &&
                  Math.min(
                    (slot.a1 - slot.a0) * ((slot.r0 + slot.r1) / 2),
                    slot.r1 - slot.r0,
                  ) /
                    unitsPerPx >=
                    ROLLUP_TEXTURE_PX && (
                    <>
                      {/* Keyed on the FILE, not the roll-up's own node. The aggregate is
                          synthetic and its id is minted from the path, so it is stable per
                          file and there is exactly one roll-up in a file's wedge. */}
                      <RollupDots
                        id={dotsId(w.node.path)}
                        angle={(slot.a0 + slot.a1) / 2}
                        // The patch's own middle, so the lattice is centred on it rather
                        // than on the hub. Mid-angle at mid-radius: not the true centroid
                        // of an annular sector, which sits a little outward of it, but the
                        // dots are a texture and the difference is under a tile.
                        cx={
                          ((slot.r0 + slot.r1) / 2) * Math.sin((slot.a0 + slot.a1) / 2)
                        }
                        cy={
                          -((slot.r0 + slot.r1) / 2) * Math.cos((slot.a0 + slot.a1) / 2)
                        }
                      />
                      <path
                        className="pointer-events-none"
                        d={d}
                        fill={`url(#${dotsId(w.node.path)})`}
                      />
                    </>
                  )}
                </g>
              )
            })
          })}

        {/* Labels last so they sit above every wedge, and only where one fits. Only
            directories are labelled — see the filter.
            Functions are excluded because they are laid out angularly by `layout` but
            DRAWN as a radial stack across their file's whole span — labelling them from
            their layout angle puts the name nowhere near the band it names. It never
            showed before because functions sit below the depth cut in a normal tree; a
            file opened as the root puts them at depth 1, right inside it. */}
        {wedges
          .filter(
            (w) =>
              // Directories only, at ANY depth that has room. The old rule was a depth
              // cut standing in for "will this fit", which the arc-length test below now
              // answers directly — `src-tauri/src/bin` sat unlabelled in a wedge with
              // plenty of room purely because it was one ring too deep.
              //
              // Files are never labelled. A directory's band is a structural plate with
              // nothing behind it; a file's band is its own function stack, so the label
              // is printed over the data it names. Worse, a shallow file's wedge is
              // usually narrow and steep, and a name set on that arc runs near-vertical —
              // `sql_query.rs` reading bottom-to-top across its own bands costs the
              // legibility of the stack to say what one hover says better.
              w.node.kind === 'dir',
          )
          .map((w) => {
            const r = R_INNER + (w.depth - 1) * band + band / 2
            // Bound to the arc, so the type can be sized against the BAND rather than
            // against the chord a straight label would have to fit inside.
            const want = Math.max(10, Math.min(15, band * 0.3))
            // Fit by SHRINKING first and truncating only as a last resort. A name that
            // overruns its wedge is worse than a slightly smaller one, and clipping
            // "components" to "componen…" loses the word for the sake of one type size.
            // 0.62em is about the average advance of this face at weight 600.
            const arc = (w.a1 - w.a0) * r
            const advance = 0.62
            const size = Math.max(
              7.5,
              Math.min(want, arc / Math.max(w.node.name.length * advance, 1)),
            )
            const room = Math.floor(arc / (size * advance))
            const name =
              w.node.name.length > room ? w.node.name.slice(0, Math.max(1, room - 1)) + '…' : w.node.name
            if (room < 2) return null
            const pathId = `lp-${w.node.id}`
            return (
              <g key={`l-${w.node.id}`} className="pointer-events-none select-none">
                <defs>
                  <path id={pathId} d={labelArc(w.a0, w.a1, r, size)} />
                </defs>
                <text
                  fontSize={size}
                  // Directories are `--structure`, a near-background plate, so the label
                  // takes the foreground — background-on-background is why the directory
                  // names went invisible the moment the plates stopped being outlined in
                  // white.
                  fill="var(--foreground)"
                  fillOpacity={0.8}
                  style={{ fontWeight: 600 }}
                >
                  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
                    {name}
                  </textPath>
                </text>
              </g>
            )
          })}

        {/* Evaluated after both wedge passes, so `highlight` is already set — and drawn
            after them, so no sibling's fill can eat half its width. */}
        {highlight && (
          <path
            d={(highlight as { d: string }).d}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={(highlight as { width: number }).width}
            className="pointer-events-none"
          />
        )}
        </g>

        {/* The hub is the way back out: double-click it to go up a level, the mirror of
            double-clicking a wedge to go in. Grouped with its labels so the whole disc is
            the target, not just the ring under the text. The pointer only appears when
            there is somewhere to go, so it never promises a level that isn't there. */}
        <g
          onDoubleClick={onUp ? (e) => { e.stopPropagation(); onUp() } : undefined}
          style={onUp ? { cursor: 'zoom-out' } : undefined}
        >
        <circle r={R_INNER - 4} fill="var(--card)" stroke="var(--border)" />
        {onUp && <title>Double-click to go up a level</title>}
        {/* Sized to the hub rather than fixed: a long repo name at a fixed size either
            overflows the circle or gets truncated to nothing useful. Shrinking to fit
            keeps the whole name, which is the one label that must always be readable. */}
        <text
          textAnchor="middle"
          y={-4}
          fontSize={Math.max(9, Math.min(15, 150 / Math.max(root.name.length, 5)))}
          fill="var(--foreground)"
          fontWeight={600}
        >
          {root.name}
        </text>
        <text textAnchor="middle" y={13} fontSize={9.5} fill="var(--muted-foreground)">
          {root.loc.toLocaleString()} lines
        </text>
        </g>
      </svg>

      {/* The tooltip. Instant, because it is ours: it appears the moment a wedge is
          entered instead of waiting out the OS delay, and it can say what is actually
          worth knowing about a wedge rather than the one string `<title>` allowed.
          Flipped back across the pointer near the right or bottom edge so it is never
          clipped by the pane. */}
      {hover && (
        <WedgeTip
          node={hover.node}
          x={hover.x}
          y={hover.y}
          box={box}
          mode={mode}
          ranks={ranks}
          folded={hover.node.kind === 'dir' ? collapsed.has(hover.node.id) : undefined}
        />
      )}


      {hidden.files + hidden.dirs > 0 && (
        /* Never let the picture imply it showed everything. This only counts whole
           directories or files too narrow to be an arc, which is a rare and honest
           omission — and it names WHICH, because "4 not shown" leaves the reader to
           guess whether they lost a stray file or a quarter of the repo. Boxed in the
           corner rather than floated under the graph: it is a caveat about the picture,
           so it reads as a note attached to it and not as a caption of it. */
        <p className="absolute bottom-2 left-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
          {[
            hidden.files > 0 && `${hidden.files.toLocaleString()} file${hidden.files === 1 ? '' : 's'}`,
            hidden.dirs > 0 && `${hidden.dirs.toLocaleString()} dir${hidden.dirs === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ')}{' '}
          not shown
        </p>
      )}
    </div>
  )
}
