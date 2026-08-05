import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { isAnalyzed, type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { elide } from '../lib/text'
import { arcPath, labelArc, layout, stackFunctions, type Wedge } from '../lib/sunburst'

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
 *  wedge and the functions inside it would invert. */
const FUNC_RIM_MAX_SHARE = 0.35

/** Arc a file needs, in pixels at its band's mid-radius, before its functions are worth
 *  drawing at all.
 *
 *  The cut between stacked functions runs ALONG the arc, so it does not eat this
 *  dimension — what this number protects is legibility and a target you can hit. Five
 *  pixels of fill still reads as a band and can still be clicked; below that a file is
 *  hatching, and the hatching is mostly the `--background` stroke, which on the dark
 *  theme is darker than the plate the ring sits on.
 *
 *  Started at 8, which was cautious: it silenced files up to about 170 lines at the inner
 *  bands, and plenty of those had breakdowns worth seeing. */
const MIN_STACK_ARC = 5

/** Space left around the composition, as a fraction of its own half-extent. */
const MARGIN = 0.05

/** Extra room at the bottom for the legend and the hidden-count chip — HTML overlays in
 *  the same box, invisible to `getBBox`, which the rings would otherwise grow behind. */
const CHROME_BOTTOM = 0.1

/** How strongly each level carries the heat ramp.
 *
 *  Colour has to mean ONE thing, and for a function it means that function's
 *  surprise. A directory's colour was `hot_share` — what FRACTION of its lines are hot —
 *  which is a different quantity wearing the same ramp, and because the inner rings
 *  dominate by area it was also the loudest thing on screen while the actual findings sat
 *  in thin bands at the edge.
 *
 *  So directories are structure and carry no reading at all. Files keep a faint tint
 *  because they are the immediate container and it helps you FIND a hot file. Functions
 *  carry it fully — they are the only level where the number means what the legend says. */
const HEAT_BY_KIND: Record<string, number> = { dir: 0, file: 0.3, func: 1 }

/**
 * ...but only under Surprise.
 *
 * The rule above is about ONE quantity: a directory's surprise colour would be its hot
 * share, which is a different measurement wearing the same ramp, and letting the inner
 * rings carry it makes the loudest thing on screen the thing that means least. That
 * argument does not generalise. A directory's churn, its age, its dominant language and
 * its last author are all perfectly well-defined aggregates of exactly the quantity the
 * ramp is showing — so in those modes a grey inner ring is not restraint, it is a hole.
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
const CUT = { dir: 2.2, file: 1.5, func: 0.6 }

/** Characters that fit on one line of the tooltip, at its two type sizes.
 *
 *  Measured against the card rather than guessed: 250px less 12px of padding either side
 *  is 226px, and the monospace advance is close enough to 0.62em that 10px text seats 35
 *  and 12px text seats 30. Deliberately a little under — `truncate` is still on those
 *  lines as a backstop, and if the budget overshoots, CSS elides the tail a SECOND time
 *  and eats the end that `elide` just worked to keep. */
const FITS_SMALL = 35
const FITS_LARGE = 30

/** Files at or under a node — the count the tooltip reports.
 *
 *  Walked on demand for the one hovered node rather than precomputed for the whole
 *  tree: it runs at pointer-move rate over a single subtree, which is far cheaper than
 *  maintaining a map that most of the time nobody reads. */
function countFiles(n: Node): number {
  if (n.kind === 'file') return 1
  let total = 0
  for (const c of n.children) total += countFiles(c)
  return total
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
  /** The drawn extent, in user units. Square, so the composition does not stretch. */
  const [viewBox, setViewBox] = useState('-360 -360 720 720')
  const hover = hoverNode ? { node: hoverNode, ...pos } : null
  /** Directories folded shut by clicking them. A view concern, so it lives here rather
   *  than in the app's drill stack — and it survives drilling, so a directory you closed
   *  stays closed when you come back past it. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const { wedges, hidden } = useMemo(
    () => layout(root, RINGS, { collapsed }),
    [root, collapsed],
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
        {/* Hatching for readings whose code has moved. Deliberately a TEXTURE and not a
            colour: the map has exactly one colour encoding and adding a second hue for
            "expired" would put two scales on one ring. A hatch sits on top of whatever
            the wedge already is and says "don't trust this", which is a different kind
            of statement from "this is hot".

            There is a standing note below against per-wedge marks — a mark on every
            wedge is stripes, not information. That argument is the reason this one is
            fine: stale is rare by construction, so the hatch appears on a handful of
            wedges and the eye goes straight to them. The moment most of a repo is
            hatched, most of the repo genuinely has expired readings, and drawing that
            loudly is correct. */}
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
          // Directories stay structural in every mode: their value is an aggregate of a
          // different quantity, and painting it in the same scale as the leaves reads as
          // comparable when it is not.
          const c = w.node.kind === 'dir' ? null : colorFor(w.node, mode, ranks)
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
              // thing on screen and it sat around the one level that carries no reading
              // at all — the eye went to structure instead of to heat.
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

        {/* Functions, stacked radially INSIDE their file's wedge — see `stackFunctions`.
            Containment is structural here rather than implied, which is what a separate
            outer ring could never give. */}
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
            // Too narrow to say anything: draw the file solid instead.
            //
            // A function slice spans its file's whole angular width, so on a thin file
            // every slice is a sliver with a 0.6px cut down each side — and the cut is
            // `--background`, which on the dark theme is DARKER than the `--structure`
            // plate the ring sits on. What renders is not a stack of functions, it is a
            // picket fence of keylines, and it reads as detail while carrying none.
            //
            // The file keeps its own fill and its own hover, and drilling in still shows
            // every function it has. `layout` already culls wedges below `MIN_ANGLE` on
            // the same reasoning; this is that rule applied one level further in, where
            // the wedges are not culled but their CONTENTS cannot be drawn.
            if ((fa1 - fa0) * rMid < MIN_STACK_ARC) return null
            return stackFunctions(w.node.children, r0, r1).map((slot) => {
              const c = colorFor(slot.node, mode, ranks)
              const isSel = selected?.id === slot.node.id
              const isHover = hover?.node.id === slot.node.id
              if (isSel || isHover) {
                highlight = { d: arcPath(fa0, fa1, slot.r0, slot.r1), width: isSel ? 1.6 : 1.2 }
              }
              const d = arcPath(fa0, fa1, slot.r0, slot.r1)
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
                </g>
              )
            })
          })}

        {/* Labels last so they sit above every wedge, and only where one fits.
            Functions are excluded because they are laid out angularly by `layout` but
            DRAWN as a radial stack across their file's whole span — labelling them from
            their layout angle puts the name nowhere near the band it names. It never
            showed before because functions sit below the depth cut in a normal tree; a
            file opened as the root puts them at depth 1, right inside it. */}
        {wedges
          .filter(
            (w) =>
              // Directories label at ANY depth that has room. The old rule was a depth
              // cut standing in for "will this fit", which the arc-length test below now
              // answers directly — `src-tauri/src/bin` sat unlabelled in a wedge with
              // plenty of room purely because it was one ring too deep.
              //
              // Files keep the depth cut: their band is occupied by their own function
              // stack, so a label there is printed over the data rather than over a
              // structural plate.
              w.node.kind === 'dir' || (w.node.kind === 'file' && w.depth <= 2),
          )
          .map((w) => {
            const isDir = w.node.kind === 'dir'
            const r = R_INNER + (w.depth - 1) * band + band / 2
            // Bound to the arc, so the type can be sized against the BAND rather than
            // against the chord a straight label would have to fit inside.
            const want = isDir ? Math.max(10, Math.min(15, band * 0.3)) : 9
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
            // A FILE label that has to shrink or clip is dropped rather than drawn.
            //
            // Shrink-then-truncate is right for a directory: it sits on a structural
            // plate, nothing is behind it, and `componen…` still says which one you are
            // looking at. A file's label sits on top of its own function stack — bands
            // and cuts a pixel apart — so at 7.5px, clipped, it is texture over texture
            // and reads as neither. `citation_validation.rs` in a wedge with room for
            // nine characters tells you nothing a hover would not tell you better.
            if (!isDir && (size < 8.5 || w.node.name.length > room)) return null
            const pathId = `lp-${w.node.id}`
            return (
              <g key={`l-${w.node.id}`} className="pointer-events-none select-none">
                <defs>
                  <path id={pathId} d={labelArc(w.a0, w.a1, r, size)} />
                </defs>
                <text
                  fontSize={size}
                  // A label has to contrast with the wedge UNDER it, and those are two
                  // different surfaces. Files carry the ramp, which is bright, so the
                  // background colour reads on them. Directories are `--structure`, a
                  // near-background plate — background-on-background, which is why the
                  // directory names went invisible the moment the plates stopped being
                  // outlined in white.
                  fill={isDir ? 'var(--foreground)' : 'var(--background)'}
                  fillOpacity={isDir ? 0.8 : 1}
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
      {hover && (() => {
        const n = hover.node
        const c = colorFor(n, mode, ranks)
        const sc = n.score
        const analyzed = isAnalyzed(n)
        // The whole path, with the node's own segment picked out — showing the name and
        // then the path again repeated the last word on every hover.
        //
        // That dedup is right for directories and files, where `name` IS the last path
        // segment. It is wrong for a FUNCTION, whose name appears nowhere in its path —
        // so hovering a chunk showed the file it lives in and never once said which
        // function you were pointing at, which is the only thing the hover was for.
        // Functions get their own shape below: name first, then where to find it.
        const isFunc = n.kind === 'func'
        const parts = n.path.split('/')
        const own = parts.pop() ?? n.name
        // What is worth knowing changes with the question being asked. Under Surprise
        // that's the two terms the reading is made of; under Churn and Age it's the raw
        // counts behind the ramp; under Owner and Language the swatch's own label IS the
        // value and anything else would be padding.
        const extras: [string, string][] = []
        if (sc && analyzed && mode === 'surprise') {
          extras.push(['Documented', String(Math.round(sc.documented * 100))])
        } else if (sc && sc.ageDays !== null && mode === 'churn') {
          extras.push(['Commits (90d)', String(sc.commits)])
          extras.push(['First seen', `${Math.round(sc.ageDays)}d ago`])
        } else if (sc && sc.lastTouchedDays !== null && mode === 'age') {
          extras.push(['Last touched', `${Math.round(sc.lastTouchedDays)}d ago`])
          if (sc.ageDays !== null) extras.push(['First seen', `${Math.round(sc.ageDays)}d ago`])
        }
        const W = 250
        // Only used to decide which way to flip near an edge, so an estimate is fine —
        // but it has to track the content, or the card flips the wrong way at the bottom
        // of the window and lands under the cursor. Base covers the path row and the
        // reading row; a function adds a name line above them, and size no longer has a
        // row of its own.
        const H =
          32 + extras.length * 16 + (n.kind === 'dir' ? 26 : 0) + (isFunc ? 16 : 0)
        const flipX = hover.x + W + 18 > box.w
        const flipY = hover.y + H + 18 > box.h
        return (
          <div
            className="pointer-events-none absolute z-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg"
            style={{
              maxWidth: W,
              left: flipX ? undefined : hover.x + 14,
              right: flipX ? box.w - hover.x + 14 : undefined,
              top: flipY ? undefined : hover.y + 14,
              bottom: flipY ? box.h - hover.y + 14 : undefined,
            }}
          >
            {isFunc ? (
              // Name first, on its own line. It is the answer to the question the hover
              // asks, and burying it at the end of a wrapped path — where the path is
              // long enough to wrap in a 250px card — is the same as not showing it.
              <>
                <p className="mono mb-0.5 truncate text-[12px] font-semibold leading-snug">
                  {elide(n.name, FITS_LARGE)}
                </p>
                {/* The line number is its own element and never shrinks. Folding it into
                    the elided string meant it competed with the path for the same budget
                    and lost — the card showed `Store.swift:` with the number cut off,
                    which is worse than omitting it, because a trailing colon reads as
                    truncated data rather than absent data. */}
                <p className="mono mb-1 flex text-[10px] leading-snug text-[var(--muted-foreground)]">
                  <span className="min-w-0 truncate">
                    {elide(n.path, FITS_SMALL - (n.line !== null ? `:${n.line}`.length : 0))}
                  </span>
                  {n.line !== null && <span className="shrink-0">:{n.line}</span>}
                </p>
              </>
            ) : (
              <p className="mono mb-1 truncate text-[11px] leading-snug text-[var(--muted-foreground)]">
                {/* The own segment is the identity, so it keeps whatever room it needs and
                    the leading path gives way — elided from its own start, since what
                    matters there is the directory immediately containing this one. */}
                {parts.length > 0 &&
                  `${elide(parts.join('/'), Math.max(6, FITS_SMALL - 1 - own.length))}/`}
                <span className="font-semibold text-[var(--foreground)]">
                  {elide(own, FITS_SMALL)}
                </span>
              </p>
            )}

            {/* The reading is the SWATCH — it is a colour on the map, so stating it as a
                number here would be describing the encoding rather than reading it. The
                label beside it names the value, which is what keeps identity off colour
                alone. */}
            {/* Reading and size on one row. They were stacked, which gave a two-word
                fact ("46 lines") a whole line of its own and pushed everything below it
                down — on a card this small, three single-item rows in a column read as a
                list of unrelated things rather than one description of one wedge.

                Size is deliberately the quiet half: it is the axis you already know, and
                the swatch beside it is the axis that is worth reading. */}
            <div className="mb-1 flex items-baseline gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-[2px]"
                style={{ background: analyzed && c ? c.fill : 'var(--unanalyzed)' }}
              />
              <span className="truncate text-[11px]">
                {analyzed && c ? c.label : 'not measured yet'}
              </span>
              {/* Never shrinks, and the label gives way instead — under Owner or Language
                  the label is a category name of unbounded length, and letting it push the
                  size off the row would lose the one number that is always meaningful. */}
              <span className="mono ml-auto shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {n.loc.toLocaleString()} lines
                {n.kind !== 'func' && ` · ${countFiles(n).toLocaleString()} files`}
              </span>
            </div>

            {/* Said on hover, not only on click. A hatched wedge poses a question — why
                is this one different — and making you select it to get the answer is a
                click charged for reading the map. */}
            {n.agentStale && (
              <p className="mb-1 text-[10px] leading-snug text-[var(--warning)]">
                Read before, but the code has changed since — that reading no longer
                colours this wedge.
              </p>
            )}

            {extras.length > 0 && (
              <dl className="mt-1.5 space-y-0.5 border-t border-[var(--border)] pt-1.5 text-[11px]">
                {extras.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-[var(--muted-foreground)]">{k}</dt>
                    <dd className="mono tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}

            {n.kind === 'dir' && n.children.length > 0 && (
              <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] text-[var(--muted-foreground)]">
                {collapsed.has(n.id)
                  ? `${n.children.length} folded — ⌥-click to open`
                  : '⌥-click to fold · double-click to drill in'}
              </p>
            )}
          </div>
        )
      })()}


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
