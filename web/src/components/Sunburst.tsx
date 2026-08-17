import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { trapOf, type AgentCall, type Node } from '../lib/api'
import { clsx } from '../lib/cn'
import { colorFor, type ColorMode, paintsFromReadings } from '../lib/colorMode'
import { CHROME_INK, inkOn } from '../lib/ink'
import { arcPath, layout, tileFunctions, type Wedge } from '../lib/sunburst'
import { FileZoom, fanOf } from './FileZoom'
import { arcOf, sectorOf, type Sector } from '../lib/fan'
import { elide } from '../lib/text'
import {
  direction,
  ease,
  enterFrom,
  exitTo,
  geoOf,
  lerpGeo,
  extentOf,
  hubGeo,
  lerpView,
  viewBoxOf,
  viewFor,
  ZOOM_MS,
  type Direction,
  type Exiting,
  type Geo,
} from '../lib/zoom'
import { RollupDots, dotsId, ROLLUP_TEXTURE_PX } from './RollupDots'
import { WedgeLabel } from './WedgeLabel'
import { fitLabel } from '../lib/label'
import { FAMILY, WEIGHT } from '../lib/labelStyle'
import { StaleHatch } from './StaleHatch'
import { WedgeTip } from './WedgeTip'
import { AgentMascot } from './AgentMascot'
import type { MascotState } from './MascotFigure'

/** Rings drawn at once. Deeper than this and the outer annuli are hairlines; the
 *  answer is to drill in, which is what clicking a directory does. */
/** A function's name inside its file's band: the same treatment the fan gives it, at the
 *  smaller scale the ring can afford. The WEIGHT is not here — it is live, in
 *  `labelStyle`, and it has to be, because `fitLabel` measures in the weight
 *  `WedgeLabel` draws in and a constant on one side of that pair is the same bug as a
 *  constant face was. */
const FUNC_MAX = 11
const FUNC_BEND = 0.45

/** A file's name never outgrows the band it hangs off — see `LABEL_BAND`, which must stay
 *  at least `FILE_MAX × LINE` deep or nothing fits in it. */
const FILE_MAX = 11

const RINGS = 5
const R_INNER = 62
const R_OUTER = 340

/** How many lit wedges the creature will look at one at a time before giving up and taking
 *  them as a region — see `gaze`. Small, because this is the number of things a glance can
 *  distinguish, not a display limit. */
const GAZE_INDIVIDUALS = 6

/** The mascot's box in the hub, in user units, and where its middle sits.
 *
 *  Centred, and large, because it is the only thing in the disc — the name and the line
 *  count both went, being answered by the crumbs and the panel. The box is a little taller
 *  than the creature, since the bundle renders into a square with room underneath, so the y
 *  is eyeballed against the rendered thing rather than derived from the geometry. Every
 *  value this has held was arrived at by looking at it.
 *
 *  **In user units, drawn in pixels.** The creature is a three.js canvas and canvases do not
 *  scale like paths, so it is not in the SVG at all — it is an HTML layer over the pane,
 *  moved and scaled to wherever the hub currently is. `HUB_MASCOT` is therefore both: the
 *  side of the box in user units AND the canvas's own pixel size at scale 1, which is what
 *  keeps it crisp at the sizes the map actually draws at. */
/** How fast a ring catches up with a shape that changed under it, as a time constant in ms.
 *
 *  **History moves the picture without changing the LEVEL, and nothing was animating that.**
 *  The zoom machinery below is keyed on the root changing identity — drill in, pop out — so
 *  a replay, which keeps the same root and hands the renderer a different tree thirty times
 *  a second, went straight to the new geometry every frame. Every commit landed as a snap.
 *
 *  Exponential rather than a keyframe, and that is the whole reason this is affordable. A
 *  keyframed tween has to be STARTED, which means noticing that a target changed, deciding
 *  how long the move should take, and being interrupted by the next commit before it lands —
 *  three problems a replay creates constantly. Easing a fraction of the remaining distance each
 *  frame has no start, no end and no state beyond where the rings are now: a target that
 *  moves again mid-flight is simply the next thing being chased. Frame-rate independent
 *  through `1 - exp(-dt/tau)`, so it eases the same on a slow machine as on a fast one.
 *
 *  Tuned against a replay rather than against a single step: at 90ms a wedge covers most of
 *  its distance inside a frame's own dwell time, so a commit still reads as an event instead
 *  of smearing into the next one. */
const MORPH_TAU_MS = 90

/** Close enough to be there, in user units and radians. Without a floor the chase never
 *  formally ends, and a re-render every frame forever is the cost of the last hundredth of a
 *  pixel. */
const MORPH_EPS = 0.02

const HUB_MASCOT = 94
const HUB_MASCOT_Y = 0

/** How much of a name the hub can hold at the smallest size it will shrink to.
 *
 *  The shrink-to-fit sizing spends a fixed ~90px of width, so `150 / length` and a 9px
 *  floor between them buy about seventeen characters; past that the size stops falling
 *  and the string simply gets longer than the disc. Kept as a character count rather than
 *  a measurement because the two numbers it has to agree with are right here beside it. */
const HUB_FITS = 17

/** Gap between one ring level and the next.
 *
 *  Directories, files and functions are three different KINDS of thing and were drawn as
 *  one continuous mass of arcs. Hue cannot carry the distinction — hue is the reading —
 *  so it falls to geometry: a visible gutter between levels, and a frame of the file's
 *  own color around the functions it holds. */
const RING_GAP = 3

/** The rim of its own color a file leaves around the functions it holds — the thing
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
 *  summarized. */
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

/** Patches a wedge must have room for before it is opened at all.
 *
 *  One is not enough: a wedge with capacity for a single patch draws its roll-up across
 *  its own area, which repaints the file in the roll-up's color and says nothing the
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
 *  problem: this codebase argues everywhere that the picture should stay recognizable
 *  between visits, and a layout that reflows continuously is not recognizable at all.
 *  Quantising also breaks the feedback loop — the viewBox is measured from what was
 *  drawn, so a threshold read off a continuously-varying size could chase its own tail.
 *  At this step a normal resize crosses no boundary and nothing moves; opening the same
 *  window on a much larger display crosses several, and more of the repo appears. */
const SIZE_STEP = 160

/** Space left around the composition, as a fraction of its own half-extent. */
/** Where a file's name hangs, just past its own rim.
 *
 *  A file is the outermost structural level, so the annulus past its edge is drawn by
 *  nothing — which makes it the one place a name can go without covering the thing it
 *  names. The gap keeps the type off the wedge's own stroke; the band is the depth the
 *  name is fitted into.
 *
 *  `extentOf` is given file wedges grown by this much, so the viewBox reserves the room
 *  rather than relying on `MARGIN` to happen to cover it — a label cropped by the fit is a
 *  label that reads as a bug. */
/** How much of its own angular width a rim name gives up, per side, so two neighbors read
 *  as two names rather than one run of letters. */
const RIM_INSET = 0.06

/** Arc a file's rim needs before it is worth reserving a label band above it.
 *
 *  `MIN_KEPT` characters at `MIN_SIZE`, roughly — the shortest name this app will draw. A
 *  wedge narrower than that cannot be labeled however much room is set aside for it, so
 *  setting room aside only moves the picture. */
const RIM_MIN_ARC = 28

export const LABEL_GAP = 4
/** Deep enough to hold the type it exists for.
 *
 *  This is the cross-axis of every rim label, so `LINE` divides it: at 13 units the biggest
 *  a filename could be set was 7.6px, under the 8px floor, and every one of them silently
 *  failed to fit. The band and `FILE_MAX` are one decision — a band shallower than
 *  `FILE_MAX × LINE` cannot draw a name at all, and the failure looks exactly like the
 *  labels having been turned off. */
export const LABEL_BAND = 20

const MARGIN = 0.05

/** Extra room at the bottom for the legend and the hidden-count chip — HTML overlays in
 *  the same box, invisible to `getBBox`, which the rings would otherwise grow behind.
 *
 *  A share of REACH, which is the trouble with it: the overlays are about 28 real pixels
 *  tall and do not care how big the composition is, so a fraction over-reserves on exactly
 *  the repos where the picture is already large. At a tenth it was pushing the whole
 *  composition up by more than the chip it was protecting — the top of the map sat against
 *  the crumbs while a third of the pane went unused below it. Three per cent is roughly the
 *  chip at a typical scale; the honest version measures the overlay and converts through
 *  `unitsPerPx`, which is worth doing if this ever needs to be exact. */
const CHROME_BOTTOM = 0.03

/** How strongly each level carries the heat ramp.
 *
 *  Directories were zeroed here, on the argument that a directory's color is `hotShare` —
 *  what FRACTION of its lines are hot, a different quantity wearing the same ramp — and
 *  that because the inner rings dominate by area it would be the loudest thing on screen
 *  while the actual findings sat in thin bands at the edge.
 *
 *  Both halves of that have since stopped being true. The findings are no longer in thin
 *  bands: `tileFunctions` fills every file's wedge with per-function color, so the leaves
 *  now carry most of the painted area and a directory tint is no longer the loudest thing
 *  in the window. And the quantity is no longer raw — `shareRamp` calibrates it onto the
 *  ramp's own scale, which is what a share needed all along. Zeroing it was the right
 *  answer to a scale problem and the wrong place to fix it: measured across three repos,
 *  35 of 37 directories sat in the bottom fifth of the raw ramp, so even un-zeroed they
 *  would all have been the same gray. That is why turning this up alone would have looked
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
 * The damping above is about ONE quantity: a directory's surprise color is its hot share,
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

/** The cut between one wedge and its neighbor, in user units.
 *
 *  Drawn as a background-colored stroke rather than an angular pad, so the gap is a
 *  CONSTANT width at every radius. An angular pad would open up at the rim and close to
 *  nothing near the hub, which is exactly backwards — the inner rings are where wedges
 *  are already hardest to tell apart. Narrower for the finer levels so a file's rim
 *  doesn't swallow the functions inside it. */
const CUT = { dir: 2.2, file: 1.5, func: 0.35 }

function SunburstView({
  root,
  selected,
  onSelect,
  onDrill,
  onClear,
  reading,
  mode,
  ranks,
  ageSpan,
  onUp,
  mascot,
  morph,
  sortBy,
  density,
  onSide,
}: {
  root: Node
  selected: Node | null
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
  onClear: () => void
  mode: ColorMode
  ranks?: Map<string, number>
  /** The repo's age span — see `ageSpanOf`. Comes from the whole tree, not from `root`,
   *  so drilling into a directory does not recalibrate the colors on the way in. */
  ageSpan?: number
  /** Undefined at the top level, which is what disables the hub's go-up affordance. */
  onUp?: () => void
  /** The creature in the middle of the hub, and what it is doing.
   *
   *  **It lives here because the hub is the one part of the window that is about the whole
   *  repo.** It used to sit in a panel under the sidebar, beside a word — Sleeping, Working,
   *  Stopping — and that panel is gone: everything else in it was about ONE project and
   *  belongs on that project's row. What was left was the app's own pulse, which has no row
   *  and does not want one. The hub already names the repo and its size; the state of the
   *  thing reading it is the third fact about the same subject.
   *
   *  Absent is a legitimate value — the history replay has no run to depict — and absence
   *  draws nothing rather than a sleeping creature over a story from 2019. */
  mascot?: { events: AgentCall[]; state: MascotState }
  /** Ease the rings toward the shape they are given, instead of taking it.
   *
   *  On for the history replay, which is where a tree arrives that is neither a new level
   *  nor the same picture — see `MORPH_TAU_MS`. Off for the live map: a rescan or a landed
   *  reading changes wedges too, and sliding them under somebody who is reading the map is
   *  a different decision from smoothing a replay they asked to watch. */
  morph?: boolean
  /** Lay the map out as though the pane were this many pixels across.
   *
   *  **What "more detail" means, in one number.** Every threshold that decides whether a
   *  wedge is worth drawing is a PIXEL size converted through `unitsPerPx` — a wedge under
   *  `MIN_ARC_PX` of arc, a patch under `MIN_PATCH_PX` of area — so the picture's density is
   *  a property of how big it is being drawn, and nothing else. On screen that is the pane.
   *  For an export it is the FILE: a 4000px movie asked to reason about a 1000px pane is the
   *  same picture upscaled, four times the pixels and not one more wedge.
   *
   *  Null on screen, where the pane is the honest answer. */
  density?: number | null
  /** The pane's own measured side, for a caller that needs to know how much denser an export
   *  is than the screen it was staged from — see `frameTree`'s `density`. */
  onSide?: (px: number) => void
  /** Sort siblings by this rather than by their size in the frame being drawn — see
   *  `LayoutOpts.sortBy` and `headSizes`. The replay's answer to wedges trading places
   *  under the playhead. */
  sortBy?: ReadonlyMap<string, number>
  /** Node ids out with a reader right now. They pulse.
   *
   *  **This is where a run is legible.** The sidebar used to list the names of functions
   *  as they came back, which is a progress bar you have to read, in the narrowest column
   *  on screen, saying nothing about the part this app exists to draw. Here it is a glance:
   *  the wedges being read light up, and a wave reads as a sweep across the repo — you can
   *  see it working through a directory, and you can see it stall. */
  reading?: Set<string>
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
    // See `density`: an export lays out for the file it is writing, not for the pane it was
    // staged from, or a bigger movie is only a bigger picture of the same map.
    const side = density ?? Math.min(box.w, box.h)
    if (side <= 0) return null
    const stepped = Math.max(SIZE_STEP, Math.round(side / SIZE_STEP) * SIZE_STEP)
    const extent = 2 * R_OUTER * (1 + 2 * MARGIN)
    return extent / stepped
  }, [box.w, box.h, density])

  const minAngle = useMemo(
    () => (unitsPerPx === null ? undefined : (MIN_ARC_PX * unitsPerPx) / R_OUTER),
    [unitsPerPx],
  )
  /** Every container between what is drawn and what is selected, by id.
   *
   *  Only the ANCESTORS: the selection's own id is deliberately absent, so a wedge that is
   *  both drawn and selected takes the real outline below and never the stand-in. Empty
   *  when the selection is somewhere else entirely — another directory, or a synthesised
   *  roll-up that is in no tree — and an empty trail draws nothing, which is correct.
   *  Nothing on screen is better than a ring around a wedge that does not hold it. */
  const selTrail = useMemo(() => {
    if (!selected) return null
    const ids = new Set<string>()
    const walk = (n: Node): boolean => {
      if (n.id === selected.id) return true
      for (const c of n.children) {
        if (walk(c)) {
          ids.add(n.id)
          return true
        }
      }
      return false
    }
    walk(root)
    return ids
  }, [root, selected])
  /** The function tiling's floor, same conversion SQUARED — it is an area, so a unit that
   *  is `k` pixels makes a square unit `k²` square pixels. Getting that exponent wrong is
   *  invisible at one window size and wrong at every other, which is exactly the bug
   *  `MIN_SLICE` had before it was converted at all. */
  const minPatchArea = useMemo(
    () => (unitsPerPx === null ? undefined : MIN_PATCH_PX * unitsPerPx * unitsPerPx),
    [unitsPerPx],
  )
  /** The drawn extent, in user units. Square, so the composition does not stretch. Held
   *  on the element and in a ref rather than in state — see the fit effect. */
  const svg = useRef<SVGSVGElement>(null)
  const fitted = useRef('-360 -360 720 720')
  /** The mascot layer, moved with the hub. A ref rather than state for the same reason the
   *  viewBox is written to the element: this is updated every frame of a level change, and
   *  a second React render per frame to carry two numbers is most of what made the motion
   *  feel heavy. */
  const hubMascot = useRef<HTMLDivElement>(null)
  const hover = hoverNode ? { node: hoverNode, ...pos } : null
  /** Directories folded shut by clicking them. A view concern, so it lives here rather
   *  than in the app's drill stack — and it survives drilling, so a directory you closed
   *  stays closed when you come back past it. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const { wedges, hidden } = useMemo(
    () => layout(root, RINGS, { collapsed, minAngle, sortBy }),
    [root, collapsed, minAngle, sortBy],
  )

  /** Where the creature in the hub is looking: at whatever is happening right now.
   *
   *  **Two sources, one answer, because there are two ways this map moves on its own.** A
   *  scan lights the wedge it is reading (`reading`); a replay flashes the wedge the commit
   *  under the playhead touched (`appeared`/`edited`, see `inStep` in `history.ts`). They
   *  never overlap — one is the repo being measured, the other the repo being remembered —
   *  and both are "the action", so both aim the eyes. Anywhere else there is no action, the
   *  answer is null, and the eyes go back to following the pointer, which is the right
   *  behaviour for a map that is only moving because somebody is moving it.
   *
   *  **The mean direction, not one of them.** A scan touches a dozen wedges at once,
   *  scattered around the ring, and a commit touches a directory's worth — so picking one
   *  would twitch between neighbours several times a second. The mean points at the part of
   *  the ring the work is in, and swings across when the work moves rather than jumping.
   *
   *  `a` is clockwise from 12 o'clock, and the creature's world has **y up** where the
   *  screen has y down: the gaze target is placed in world units off the pupils (see
   *  `setGazeFocus` in the bundle), so the vertical component is NOT negated the way it
   *  would be for an SVG coordinate.
   *
   *  Rounded, so a set that gains and loses one thin wedge does not re-aim on every tick —
   *  finely enough that the motion reads as a turn rather than a series of steps, which is
   *  what the bundle's own smoothing is then free to make continuous. It recomputes as fast
   *  as its inputs move: every replay frame, and every flush of the scan's lit set.
   */
  /** Of everything being worked on, the wedges actually worth lighting.
   *
   *  **The deepest DRAWN one on each path, and nothing above it.** What arrives is a file
   *  and every directory over it, because a file too thin to draw — 37,934 of linux's are —
   *  has no wedge of its own and its directory is the only thing that can stand in for it.
   *  Lighting the whole chain instead made `drivers` and `net` blaze continuously for as
   *  long as the sweep was anywhere inside them: the loudest thing on screen, saying only
   *  "somewhere in here", while the work itself was invisible underneath. And the same
   *  average aimed the creature's eyes, which is why they read as idle wandering — the big
   *  inner rings dominate the sum and drag it to the middle.
   *
   *  So a path lights the narrowest wedge that can carry it: itself if it is drawn, its
   *  nearest drawn ancestor if not. An ancestor with a lit descendant on screen has already
   *  said what it had to say, through that descendant.
   *
   *  Function ids (`path#name`, which is what a reader's lease holds) have no descendants
   *  under this test and always survive it — the rule only ever removes a directory that
   *  something below it is already speaking for.
   */
  const pulsing = useMemo(() => {
    if (!reading || reading.size === 0) return reading
    const drawn = wedges.filter((w) => reading.has(w.node.id)).map((w) => w.node.id)
    return new Set(drawn.filter((id) => !drawn.some((d) => d.startsWith(`${id}/`))))
  }, [wedges, reading])

  const gaze = useMemo(() => {
    // Aimed at the same wedges that flash, so the eyes can be checked against the picture.
    const at: Array<{ x: number; y: number }> = []
    for (const w of wedges) {
      const s = w.node.score
      if (!pulsing?.has(w.node.id) && s?.appeared !== 1 && s?.edited !== 1) continue
      const mid = (w.a0 + w.a1) / 2
      const r = (n: number) => Math.round(n * 50) / 50
      at.push({ x: r(Math.sin(mid)), y: r(Math.cos(mid)) })
    }
    if (at.length === 0) return null
    // **A few things are looked at in turn; a crowd is looked at as a place.** Blame does
    // not run at a constant rate — it comes in bursts and then labours over three or four
    // files for seconds at a time — and through those lulls a single averaged bearing is a
    // creature staring into the middle distance. Handing the figure the individual wedges
    // lets it glance between them, which is what something watching actually does.
    //
    // Past a handful there is nothing to glance between: twenty wedges cycled one at a time
    // is a twitch, and their mean is a real answer — the region the work is in. So the
    // crowd collapses to one bearing and the eyes settle on it.
    if (at.length <= GAZE_INDIVIDUALS) return at
    let x = 0
    let y = 0
    for (const d of at) {
      x += d.x
      y += d.y
    }
    const len = Math.hypot(x, y)
    // Wedges spread evenly around the ring cancel out, and a zero vector is a direction
    // nobody can face. Looking straight ahead is the honest answer to "everywhere at once".
    if (len < 1e-3) return null
    return [{ x: Math.round((x / len) * 50) / 50, y: Math.round((y / len) * 50) / 50 }]
  }, [wedges, pulsing])

  /** Files whose functions get stacked.
   *
   *  Normally these come out of the layout, but `layout` never emits the ROOT as a
   *  wedge (only d > 0), so drilling into a file left both passes below with nothing to
   *  draw — the arcs pass filters functions out, and this pass looked for a file wedge
   *  that no longer existed. The drilled view came up blank. A root file becomes a
   *  full-circle wedge of its own; `arcPath` already special-cases the 2π span, because
   *  a full ring drawn as one arc has coincident endpoints and renders nothing. */
  /** Files in the current view, whose functions tile inside their band.
   *
   *  A root file is not among them, and does not need to be. `layout` never emits the
   *  root as a wedge, and a file that IS the root is no longer drawn as a ring at all —
   *  `FileZoom` unrolls its tiling into the pane instead, which is the same cells this
   *  pass would have drawn, projected out of the wedge they were already in. So the
   *  full-circle special case stays gone: there is no ring to be full. */
  const fileWedges = useMemo<Wedge[]>(
    () => wedges.filter((w) => w.node.kind === 'file'),
    [wedges],
  )

  /** How far through the level change we are, 0..1. `1` means nothing is moving.
   *
   *  Driven by a rAF loop rather than CSS, because what is being animated is the wedges'
   *  own geometry — see `zoom.ts` for why that is worth paying for and how it stays
   *  affordable. React re-renders per frame, which is fine at a couple of hundred arcs:
   *  the function patches, which are the thousands, are not drawn while this is running. */
  const [t, setT] = useState(1)
  /** Bumped once per level change, so the frame loop below knows a new run has begun
   *  without depending on the value that run is writing. */
  const [run, setRun] = useState(0)
  /** The run the box has been re-based for, so it re-bases once per level and not once
   *  per frame. */
  const startedRun = useRef(0)
  /** Where every wedge is RIGHT NOW, whether or not it has arrived.
   *
   *  Written every frame, which is what makes an interrupted transition start from the
   *  picture on screen instead of from wherever the last one began. Double-clicking twice
   *  quickly used to restart the keyframe from its own beginning, so the second move
   *  visibly jumped backwards before going forwards. */
  const live = useRef<Map<string, Geo>>(new Map())
  /** Where the rings are while they ease toward a shape that changed under them — see
   *  `MORPH_TAU_MS`. Empty unless the caller asked for morphing, and cleared on a level
   *  change, which owns the picture outright while it runs.
   *
   *  The entries are MUTATED rather than replaced. The chase touches every structural wedge
   *  on every frame of a replay, and handing the collector a few hundred fresh objects
   *  thirty times a second is the hitch-on-a-fixed-period this app has already paid for once,
   *  in the frame pool. */
  const soft = useRef<Map<string, Geo>>(new Map())
  /** What the chase is chasing, and whether a level change has taken the picture off it.
   *  Refs because the loop runs between renders and must not hold the frame it started on. */
  const softTarget = useRef<Map<string, Geo>>(new Map())
  const softMoving = useRef(false)
  /** Bumped by the chase to draw its next frame. Nothing reads the value. */
  const [, redraw] = useState(0)
  /** The wedges of the level being left, so they can be animated out rather than dropped.
   *  The old transition unmounted them, which is why changing level read as a hard cut
   *  with an ease-in after it rather than as one movement. */
  const leaving = useRef<Exiting[]>([])
  /** The directory being opened, on its way into the middle. Its own thing rather than an
   *  entry in `leaving`, because it is not leaving — it is arriving as the hub. */
  const coring = useRef<{ node: Node; from: Geo; to: Geo } | null>(null)
  const from = useRef<Map<string, Geo>>(new Map())
  /** The pane's shape, which is what the fan is sized against. Guarded so a pane that has
   *  not been measured yet asks for a square rather than for a division by zero. */
  const paneAspect = box.h > 0 ? box.w / box.h : 1

  /** The wedge an open file grew out of. See the level-change block below. */
  const fileFrom = useRef<Sector | null>(null)
  /** The file being closed, retracting into the wedge it came out of.
   *
   *  Its own thing rather than an entry in `leaving`, for the same reason `coring` is: it
   *  is not an arc flying outward, it is a tiling rolling back up. Without it, closing a
   *  file was the hard cut this whole approach removed in the other direction — the cells
   *  unmounted on the frame the root changed and the rings eased in over nothing.
   *
   *  It retracts into the sector it CAME from, not into wherever the file lands in the new
   *  level. In the ordinary case — going back up to the parent — those are the same wedge,
   *  because the level being returned to is the one the file was opened from. Reusing the
   *  source guarantees the first frame of the exit is exactly the picture on screen, where
   *  re-deriving it would risk a pop on a jump that reorganized the ring. */
  const fileLeaving = useRef<{ node: Node; from: Sector } | null>(null)
  const prevRoot = useRef(root)
  const dir = useRef<Direction>('across')

  /** Fit the box to the composition, after it has been drawn.
   *
   *  `getBBox` reports the union of everything rendered — arcs, labels, the hub — in user
   *  units, which are independent of the viewBox. That independence is what makes this
   *  safe to run on every layout: changing the box cannot change the measurement, so
   *  there is no loop to converge.
   *
   *  Centered on the CONTENT, not on the origin. The origin is the hub, and the hub is
   *  only the middle of the composition when the painted wedges happen to be symmetric
   *  about it — which depends entirely on the repo. Squaring about the origin fit the
   *  extent correctly and then hung it off-center: the same map sat high on one project
   *  and low on the next, by however lopsided that project's outer ring was.
   *
   *  Square, because the rings are a circle and a tight rectangular crop would scale the
   *  two axes differently through `xMidYMid` and oval them. The larger dimension decides,
   *  so nothing is cropped. */


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
  const hubName = elide(root.name, HUB_FITS)

  /** Where every wedge in THIS layout belongs, by id. The renderer below reads geometry
   *  from here rather than recomputing it, so the moving picture and the settled one are
   *  the same arithmetic and cannot drift apart. */
  /** Each structural wedge's fill and label, computed once per level rather than per
   *  frame. Only geometry changes while the ring is moving, and `colorFor` over a couple
   *  of hundred wedges sixty times a second is work with no output. */
  const fills = useMemo(() => {
    const m = new Map<string, ReturnType<typeof colorFor>>()
    for (const w of wedges) if (w.node.kind !== 'func') m.set(w.node.id, colorFor(w.node, mode, ranks, ageSpan))
    return m
  }, [wedges, mode, ranks, ageSpan])

  const target = useMemo(
    () => geoOf(wedges, R_INNER, band, (kind) => (kind === 'dir' ? RING_GAP : RING_GAP * 0.4)),
    [wedges, band],
  )

  /** The wedges of the level currently on screen, kept so the one being left can still be
   *  drawn on its way out. Declared before the check below uses it. */
  const prevWedges = useRef<Wedge[]>(wedges)

  // A level change, detected during render so the first painted frame is already the
  // first frame of the motion — an effect would show one frame of the destination first,
  // which is exactly the cut this replaces.
  if (prevRoot.current.id !== root.id) {
    dir.current = direction(prevRoot.current.path, root.path)
    // Everything starts from where it is on screen, not from where it was when the last
    // transition began. For a wedge that was not visible at all, `enterFrom` finds the
    // nearest ancestor it can have come out of.
    const was = live.current
    const start = new Map<string, Geo>()
    for (const [id, g] of target) start.set(id, was.get(id) ?? enterFrom(id, g, was))
    from.current = start
    // The wedge you clicked BECOMES the hub, and that is the one piece of this motion the
    // reader is actually following. `layout` never emits the root as a wedge, so without
    // this the directory being opened is simply absent from the new level and falls into
    // the pile below — it flew outward with the siblings it was replacing, which says the
    // opposite of what happened.
    //
    // Going the other way it is the same journey reversed: the level you are leaving was
    // the hub a moment ago, so it comes OUT of the middle rather than growing from
    // nothing at the edge.
    const hub = hubGeo(R_INNER)
    coring.current =
      dir.current === 'in' && was.has(root.id)
        ? { node: root, from: was.get(root.id) as Geo, to: hub }
        : null
    const cameFrom = prevRoot.current
    if (dir.current === 'out' && target.has(cameFrom.id)) {
      start.set(cameFrom.id, hub)
    }
    // What was on screen and is not in the new level. Rendered through the transition on
    // its way out, then dropped. The clicked wedge is excluded: it has somewhere better
    // to be.
    leaving.current = prevWedges.current
      .filter(
        (w) => !target.has(w.node.id) && was.has(w.node.id) && w.node.id !== root.id,
      )
      .map((w) => ({
        node: w.node,
        depth: w.depth,
        index: w.index,
        from: was.get(w.node.id) as Geo,
        to: exitTo(was.get(w.node.id) as Geo, dir.current, R_INNER, R_OUTER),
      }))
    // A file is a destination rather than a level: the rings do not reorganize around it,
    // its own tiling unrolls into the pane. What that needs is the one thing only this
    // moment has — where the file's wedge stood on screen just before it was opened. The
    // insets match the ones the patch renderer applies, because a source sector a few
    // units off is a first frame that jumps, which is the whole thing this avoids.
    // A file being closed: keep its cells alive through the transition, rolling back up.
    fileLeaving.current =
      prevRoot.current.kind === 'file' && root.kind !== 'file' && fileFrom.current
        ? { node: prevRoot.current, from: fileFrom.current }
        : null
    if (root.kind === 'file') {
      const g = was.get(root.id)
      if (g) {
        const rMid = (g.r0 + g.r1) / 2
        const pad = Math.min(FUNC_RIM / rMid, (g.a1 - g.a0) * FUNC_RIM_MAX_SHARE)
        fileFrom.current = sectorOf(g.a0 + pad, g.a1 - pad, g.r0 + FUNC_RIM, g.r1 - FUNC_RIM)
      } else {
        // Never on screen — a restored session, or a project opened straight into a file.
        // Nothing to come out of, so it is drawn where it lands rather than flown in from
        // a wedge that was never there.
        fileFrom.current = null
      }
    }
    prevRoot.current = root
    setT(0)
    setRun((r) => r + 1)
  }
  prevWedges.current = wedges

  /** The rAF loop, started once per level change.
   *
   *  Keyed on `run` and NOT on `t`: a dependency on the value the loop is writing tears
   *  the effect down and rebuilds it every frame, and each rebuild re-reads the clock, so
   *  the transition restarts its own duration for as long as it runs. `run` changes once,
   *  when a level change begins. */
  useEffect(() => {
    if (run === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(1)
      return
    }
    let raf = 0
    const started = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / ZOOM_MS)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run])

  /** The chase: every frame, close some of the gap between where the rings are and the shape
   *  they have been given.
   *
   *  It runs for as long as morphing is on rather than being started and stopped per change,
   *  because a replay changes the target constantly and a loop that has to be re-armed is a
   *  loop that misses the first frame of every commit. Idle it costs one pass over a few
   *  hundred structural wedges — `geoOf` skips functions, so the thousands are not in here —
   *  and, crucially, no re-render: nothing moved, nothing is drawn.
   *
   *  It defers to the level change entirely. While the keyframe runs it copies what is on
   *  screen instead of easing, so the moment the zoom lands the chase is already holding the
   *  picture and there is nothing to jump from. */
  useEffect(() => {
    if (!morph) {
      soft.current.clear()
      return
    }
    let raf = 0
    let prev = performance.now()
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      // Clamped: a backgrounded tab hands back one enormous delta, and a frame that closes
      // 100% of every gap is the snap this exists to remove, arriving all at once on return.
      const dt = Math.min(120, now - prev)
      prev = now
      const to = softTarget.current
      const at = soft.current
      if (softMoving.current) {
        for (const [id, g] of live.current) {
          const cur = at.get(id)
          if (cur) Object.assign(cur, g)
          else at.set(id, { ...g })
        }
        return
      }
      const k = 1 - Math.exp(-dt / MORPH_TAU_MS)
      let busy = false
      for (const [id, g] of to) {
        const cur = at.get(id)
        // Unseeded wedges are the renderer's business — see `geo`. Skipping them here means
        // one that appears between frames opens on the next one rather than half-open.
        if (!cur) continue
        if (
          Math.abs(cur.a0 - g.a0) < MORPH_EPS &&
          Math.abs(cur.a1 - g.a1) < MORPH_EPS &&
          Math.abs(cur.r0 - g.r0) < MORPH_EPS &&
          Math.abs(cur.r1 - g.r1) < MORPH_EPS
        ) {
          // Snapped rather than left a hundredth of a unit short: an asymptote that never
          // arrives is a re-render every frame forever.
          Object.assign(cur, g)
          continue
        }
        cur.a0 += (g.a0 - cur.a0) * k
        cur.a1 += (g.a1 - cur.a1) * k
        cur.r0 += (g.r0 - cur.r0) * k
        cur.r1 += (g.r1 - cur.r1) * k
        busy = true
      }
      // A wedge that has left the tree stops being chased. It is not animated out: what a
      // deletion looks like is the wedges beside it closing over the space, which they do,
      // because they are chasing a target that no longer leaves room for it.
      if (at.size > to.size) for (const id of at.keys()) if (!to.has(id)) at.delete(id)
      if (busy) redraw((n) => n + 1)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [morph])

  /** Whether the chase was on for the previous render, so its FIRST render can be told
   *  from its later ones. */
  const wasMorphing = useRef(false)
  // **Morphing starts from the picture on screen, not from nothing.**
  //
  // `geo` seeds a wedge the chase has never heard of at zero angular width, so it opens
  // rather than appearing — right for a file that shows up mid-replay, and catastrophic
  // for the frame morphing is switched ON, when the chase has heard of nothing and every
  // wedge on screen is therefore new. The whole map collapsed to the hub for a frame and
  // then bloomed back out: pressing History on a large repo went blank, drew the live map
  // again, and only then drew the replay — three pictures in a third of a second, none of
  // which anybody asked for.
  //
  // Primed during RENDER and not in an effect, for the same reason the level change is
  // detected here: `geo` runs before any effect, so an effect would prime a map that had
  // already been seeded at zero and the blank frame would paint anyway.
  if (morph && !wasMorphing.current) {
    soft.current.clear()
    for (const [id, g] of target) soft.current.set(id, { ...g })
  }
  wasMorphing.current = !!morph

  const moving = t < 1
  const e = ease(t)
  /** A wedge's geometry for this frame: where it belongs once nothing is moving, and on
   *  the way there while something is.
   *
   *  Three sources, in order of who owns the picture. A level change owns it outright, so
   *  the keyframe wins while it runs. Otherwise, if the caller asked for morphing, the eased
   *  position is the truth — including for a wedge nobody has seen before, which is SEEDED
   *  here at zero width so it opens rather than appearing. Seeding has to happen here and
   *  not in the loop below: a wedge drawn at its target for one frame and then rewound to
   *  nothing is a flicker, and it is the first thing a new file would do in a replay. */
  const geo = (id: string): Geo => {
    const to = target.get(id)
    if (!to) return { a0: 0, a1: 0, r0: 0, r1: 0 }
    if (moving) {
      const f = from.current.get(id)
      return f ? lerpGeo(f, to, e) : to
    }
    if (!morph) return to
    const known = soft.current.get(id)
    if (known) return known
    const mid = (to.a0 + to.a1) / 2
    const seeded = { a0: mid, a1: mid, r0: to.r0, r1: to.r1 }
    soft.current.set(id, seeded)
    return seeded
  }
  // Keep the chase pointed at what is being drawn now.
  softTarget.current = target
  softMoving.current = moving

  // Where the picture IS, recorded for whatever interrupts it. Without this an
  // interrupted transition would restart from the last run's starting positions and the
  // ring would visibly snap backwards before setting off again.
  {
    const now = new Map<string, Geo>()
    for (const id of target.keys()) now.set(id, geo(id))
    live.current = now
  }

  /** Where the box wants to be for the level being drawn, and where it was for the last
   *  one. Interpolated together with the wedges, so the zoom and the movement are one
   *  thing rather than two that happen to overlap. */
  /** Which wedges will hang a name outside themselves. */
  const fileIds = useMemo(
    () => new Set(fileWedges.map((w) => w.node.id)),
    [fileWedges],
  )
  const viewTo = useMemo(
    () => {
      // An open file is fitted to the FAN it is opening into, not to a ring's extent —
      // and to where it is GOING, so the box travels with the cells instead of snapping on
      // the frame the movement ends. `extentOf` already folds the hub in, which is exactly
      // right here: the fan's core IS the hub.
      const fan = root.kind === 'file' ? fanOf(fileFrom.current, paneAspect) : null
      // **A replay is fitted to the composition it will BECOME, not to the frame on screen.**
      // The fit is measured off what is drawn, which is right for a map somebody is reading
      // and wrong for a story: commit one is an empty repo, so the extent is the hub alone
      // and the hub is blown up to fill the pane — a creature the size of a dinner plate,
      // and then a map that pumps in and out for the next nine hundred commits as the
      // outermost ring comes and goes. Nothing in that motion is about the code; it is the
      // camera reacting to it.
      //
      // Pinned to the nominal circle instead, so the rings grow into a frame that holds
      // still and the hub stays exactly where the playhead found it. The label band is
      // included because file names hang outside their wedge and a fixed box cannot notice
      // that it has clipped one.
      if (morph && !fan) {
        const reach = R_OUTER + LABEL_GAP + LABEL_BAND
        return viewFor({ x0: -reach, x1: reach, y0: -reach, y1: reach }, MARGIN, CHROME_BOTTOM)
      }
      // File wedges are handed to the fit GROWN by the label ring they hang a name off.
      // Without it the box is fitted to the wedges alone and the outermost names sit in
      // whatever `MARGIN` happens to leave — which is a crop that depends on the repo.
      // Only files that could actually HOLD a rim name reserve the band for one.
      //
      // Growing every file wedge meant a hairline reserved 24 units of label ring it will
      // never use — invisible, because no name fits there, and the fit has no way to know
      // that the extent it is being handed is mostly empty reservation. On a composition
      // with one long thin wedge that is the whole asymmetry: the box was fitted to a
      // sliver plus a label that was never drawn.
      const grown = [...target.entries()].map(([id, g]) =>
        fileIds.has(id) && (g.a1 - g.a0) * g.r1 >= RIM_MIN_ARC
          ? { ...g, r1: g.r1 + LABEL_GAP + LABEL_BAND }
          : g,
      )
      const geos = fan ? [arcOf(fan)] : grown
      return viewFor(extentOf(geos, R_INNER), MARGIN, CHROME_BOTTOM)
    },
    [target, root.kind, root.id, paneAspect, fileIds, morph],
  )
  const viewFrom = useRef(viewTo)
  const viewNow = useRef(viewTo)
  if (startedRun.current !== run) {
    startedRun.current = run
    viewFrom.current = viewNow.current
  }
  useLayoutEffect(() => {
    const v = moving ? lerpView(viewFrom.current, viewTo, e) : viewTo
    viewNow.current = v
    const next = viewBoxOf(v)
    // Written straight to the element rather than through state. Through state this is a
    // second React render for every frame — one to move the wedges, one to resize the box
    // around them — which was most of what made the motion feel heavy. Nothing else reads
    // the attribute, and it is derived from geometry this component already has.
    if (svg.current && fitted.current !== next) {
      fitted.current = next
      svg.current.setAttribute('viewBox', next)
    }
    // The hub is the user-space origin, always — so where it lands on screen is the box's
    // own arithmetic and nothing has to be measured. The viewBox is square and the SVG is
    // fitted `xMidYMid`, so one scale serves both axes and the middle of the box is the
    // middle of the pane. Written here rather than in its own effect because it has to move
    // on the SAME frame as the wedges: a creature that arrives one frame late slides across
    // the map behind the disc it belongs to.
    const el = hubMascot.current
    if (el && box.w > 0 && box.h > 0) {
      const s = Math.min(box.w, box.h) / v.side
      const x = box.w / 2 + (0 - v.cx) * s
      const y = box.h / 2 + (HUB_MASCOT_Y - v.cy) * s
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`
      // Hidden until it has been placed. Untransformed it sits in the pane's top-left
      // corner, which is a creature in the wrong place for however long the first
      // measurement takes — and `mascot` in the deps is what re-places it after the replay
      // is switched off and the layer mounts again with no transform on it.
      el.style.visibility = 'visible'
    }
  }, [viewTo, e, moving, box.w, box.h, mascot])

  /** The highlighted wedge's outline, drawn once over everything at the end.
   *
   *  A stroke straddles its path, so half of it lies inside the neighboring wedge —
   *  and siblings are painted in walk order, so every edge shared with a LATER-drawn
   *  neighbor had its outer half covered and came out at half width. The outer arc
   *  kept its full width because the ring gap leaves it free, which is what made one
   *  edge of a hovered wedge look thinner than the rest. Collected as the wedges are
   *  built below and rendered after them, so nothing can paint over it.
   *
   *  **Two slots, because there are two marks and they are not exclusive.** There was one,
   *  and the wedges are walked once — so whichever of the selection and the pointer came
   *  LATER in the walk overwrote the other. Pointing anywhere after selecting `bin` erased
   *  `bin`'s outline, and because that slot then said `sel: false`, the "selection is not
   *  drawn" stand-in fired and dashed its PARENT: the map dropped the mark for what you
   *  chose and put a different mark on something you did not. Both are kept and both are
   *  drawn; the selection's is the heavier one and goes on top. */
  let selMark: { d: string; width: number } | null = null
  let hoverMark: { d: string; width: number } | null = null
  /** Where the selection IS, when the selection itself is not drawn.
   *
   *  Selecting from the panel's list is the case the outline alone could not serve. On the
   *  map you already know where you clicked; from a list you do not, and a function is a
   *  two-pixel patch in a ring of four thousand — worse, its file may be too thin to tile
   *  at all (`OPEN_PATCHES`), in which case there is no patch to outline and the map
   *  answers a click with nothing. Falling back to the deepest ANCESTOR that is drawn says
   *  "in here" instead of saying nothing, which is the honest answer and the one that tells
   *  you where to drill. Dashed, and never with the selected wedge's own outline, so a
   *  container standing in for its contents cannot be mistaken for the thing itself. */
  let selCoarse: { d: string; depth: number } | null = null

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
        if (r.width !== box.w || r.height !== box.h) {
          setBox({ w: r.width, h: r.height })
          onSide?.(Math.min(r.width, r.height))
        }
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
      {/* `data-sunburst` is how the movie export finds the picture to record. An attribute
          rather than a ref handed up through the app: the exporter copies whatever is on
          screen at each commit, and what it must never do is hold a second idea of what the
          map is — see `movie.ts`. */}
      <svg
        ref={svg}
        data-sunburst=""
        viewBox={fitted.current}
        className="absolute inset-0 h-full w-full"
      >
        <StaleHatch />
        {/* NOT keyed on the root any more. A key here remounted the whole group on every
            level change, which is what forced the transition to be a keyframe played over
            a picture that had already been replaced — nothing could move from an old
            position to a new one because nothing survived the change. The wedges persist
            now and `geo` moves them; see `zoom.ts`.

            Pointer events are off while it runs. Hovering a wedge that is halfway to
            somewhere else selects a thing the tooltip then describes at coordinates it no
            longer occupies, and a click landing mid-flight lands on whatever happened to
            be under the cursor. */}
        {/* The level being left, on its way out.
            Drawn first so it passes UNDER the level arriving — what you are moving toward
            should never be occluded by what you are moving away from. And OUTSIDE the
            group the viewBox is fitted to: these fly outward past the rim, so a box drawn
            round them would zoom out and back over a transition that is not about them. */}
        {moving &&
          leaving.current.map((x) => {
            const g = lerpGeo(x.from, x.to, e)
            const c = colorFor(x.node, mode, ranks, ageSpan)
            return (
              <path
                key={`leaving-${x.node.id}`}
                d={arcPath(g.a0, g.a1, g.r0, g.r1)}
                fill={c ? c.fill : 'var(--structure)'}
                fillOpacity={(1 - e) * (c ? heatShare(x.node.kind, mode) : 1)}
                stroke="var(--background)"
                strokeWidth={x.node.kind === 'dir' ? CUT.dir : CUT.file}
              />
            )
          })}
        <g ref={art} style={moving ? { pointerEvents: 'none' } : undefined}>
        {/* The directory you opened, shrinking into the middle it is about to be.
            Inside the fitted group, because it IS the arriving level's own hub and the box
            should be drawn around where it lands. Painted before everything else so it
            passes under the hub disc: it does not need to fade out, it is covered by the
            thing it turned into, which is what "became the core" should look like. */}
        {moving && coring.current && (() => {
          const g = lerpGeo(coring.current.from, coring.current.to, e)
          const c = colorFor(coring.current.node, mode, ranks, ageSpan)
          return (
            <path
              d={arcPath(g.a0, g.a1, g.r0, g.r1)}
              fill={c ? c.fill : 'var(--structure)'}
              fillOpacity={c ? heatShare(coring.current.node.kind, mode) : 1}
              stroke="var(--background)"
              strokeWidth={CUT.dir}
            />
          )
        })()}
        {/* An open file: its own tiling, unrolled out of the wedge it came from.
            It REPLACES the rings rather than joining them, because a file's contents are
            not an enclosure of further enclosures — they are the cells that were already
            inside its wedge, and there is no second level for a ring to describe. The
            `leaving` group above still runs, so the level being left flies outward around
            this as it opens. See `FileZoom`. */}
        {/* The file being closed, rolling back into its wedge. Drawn inside the fitted
            group and before the arriving rings, so the level you are returning to comes up
            over it rather than under — the reverse of `leaving`, which flies outward past
            the rim and is drawn first for the same reason. */}
        {moving && fileLeaving.current && (
          <g style={{ pointerEvents: 'none' }}>
            <FileZoom
              root={fileLeaving.current.node}
              // Backwards. `t` always runs 0→1 for the level arriving; what is LEAVING has
              // to read that as 1→0, or the file would unroll again on its way out.
              t={1 - e}
              from={fileLeaving.current.from}
              unitsPerPx={unitsPerPx}
              paneAspect={paneAspect}
              selected={null}
              mode={mode}
              ranks={ranks}
              ageSpan={ageSpan}
              minPatchArea={minPatchArea}
              onSelect={() => {}}
              onDrill={() => {}}
              onHover={() => {}}
              settled={false}
            />
          </g>
        )}
        {root.kind === 'file' && (
          <FileZoom
            root={root}
            t={e}
            from={fileFrom.current}
            unitsPerPx={unitsPerPx}
            paneAspect={paneAspect}
            selected={selected}
            mode={mode}
            ranks={ranks}
            ageSpan={ageSpan}
            minPatchArea={minPatchArea}
            onSelect={onSelect}
            onDrill={onDrill}
            onHover={setHoverNode}
          />
        )}
        {/* Arcs first, dots after, so a dot is never buried under the ring it belongs to. */}
        {root.kind !== 'file' && wedges
          .filter((w) => w.node.kind !== 'func')
          .map((w) => {
          // Directories get the full gap and a visible rule; files sit tighter to the
          // functions they contain, so the eye groups file-with-contents rather than
          // file-with-neighboring-directory.
          // Geometry comes from `geo`, which is the settled position when nothing is
          // moving and a point on the way there when something is. One source, so the
          // moving picture and the still one cannot disagree.
          const g = geo(w.node.id)
          const { a0, a1, r0, r1 } = g
          // Directories used to be hard-nulled here, and that made `HEAT_BY_KIND.dir`
          // dead code: the damping is applied as `fillOpacity` on a color, so a wedge
          // with no color at all could never be damped, only blanked. Turning that
          // constant up did nothing, which is a bad way for a policy to be stated twice.
          //
          // It also blanked directories in EVERY mode, while `heatShare` carves out an
          // explicit exception for the other four — a directory's churn, age, owner and
          // language are the same measurement over more code, so a gray inner ring there
          // is a hole rather than restraint. That exception was unreachable.
          //
          // One mechanism now: `colorFor` decides WHAT a wedge means, `heatShare` decides
          // how loudly its level says it.
          const c = fills.get(w.node.id) ?? null
          // Agent verdicts and model surprisal are different instruments and must be
          // told apart at a glance. Hue is spoken for — it is the reading itself — so the
          // distinction goes on the outline.

          const isSel = selected?.id === w.node.id
          const isHover = hover?.node.id === w.node.id
          const foldable = w.node.kind === 'dir' && w.node.children.length > 0
          const isFolded = foldable && collapsed.has(w.node.id)
          if (isSel) selMark = { d: arcPath(a0, a1, r0, r1), width: 2 }
          else if (isHover) hoverMark = { d: arcPath(a0, a1, r0, r1), width: 1.6 }
          // Deepest wins: the file that holds the selection beats the directory that holds
          // the file, because a narrower answer to "where is it" is a better one.
          if (selTrail?.has(w.node.id) && (!selCoarse || w.depth > selCoarse.depth)) {
            selCoarse = { d: arcPath(a0, a1, r0, r1), depth: w.depth }
          }
          const isReading = pulsing?.has(w.node.id) ?? false
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
                d={arcPath(a0, a1, r0 - RING_GAP * 0.5, r0 + band)}
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
              d={arcPath(a0, a1, r0, r1)}
              // Unanalyzed wedges take the neutral, not the ramp — see `isAnalyzed`.
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
              // background color, so what you see is the gap between two plates. The
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
            {/* Out with a reader: a white pulse over the wedge.
                **After the wedge, not before it.** SVG paints in document order, so the
                first version of this drew the marker and then painted the wedge's own
                opaque fill straight over it — present in the DOM, animating, and invisible
                on every frame. Its own path so the wedge's fill, opacity and stroke are
                untouched: a run must not change what the map SAYS, only show where it is
                working. `pointer-events: none` because it covers the clickable path. */}
            {isReading && (
              <path
                className="wedge-reading"
                d={arcPath(a0, a1, r0, r1)}
                fill="var(--foreground)"
                pointerEvents="none"
              />
            )}
            </g>
          )
        })}

        {/* Functions tiled INSIDE their file's wedge — see `tileFunctions`. Containment
            is structural here rather than implied, which is what a separate outer ring
            could never give, and the tiling is what lets a big file actually show what is
            in it instead of rolling most of it into one patch.

            Not drawn while the rings are in flight, and this is the trade that makes the
            whole transition affordable. A repo view holds a couple of hundred structural
            arcs and several thousand patches; re-tessellating the patches every frame is
            precisely what made per-wedge motion unaffordable and is why the old
            transition had to be one keyframe over a group. Leaving them out for 260ms
            means the moving part is the part that answers "where am I", and the detail
            resolves into place as the movement ends — which is also the moment it becomes
            worth reading. */}
        {/* Mounted once, when the rings have stopped, and faded in by CSS.
            NOT rendered per frame with an interpolated opacity, which is what this was
            first: `tileFunctions` then ran across every file on every frame of the second
            half of the transition — a few thousand patches re-tiled ten times over, which
            is precisely the cost the whole design is arranged to avoid. Opacity is the one
            thing CSS can animate here for free, so it does. */}
        <g className="patches-in" key={`patches-${root.id}`}>
        {(moving ? [] : fileWedges)
          .map((w) => {
            // Inside the file's OWN band — (depth - 1) — not the one beyond it. Inset
            // on both radii so the file's fill reads as a rim on the inside and outside
            // edges too, not just the angular sides.
            // **From `geo`, not from the wedge.** The tiling used to be laid out straight
            // off the layout's own angles, which is the wedge's FINAL position — fine while
            // the only thing that moved was a level change, because patches are not drawn
            // during one. Once the rings can ease toward a shape that changed under them,
            // a file's functions laid out at the target while its wedge is still on its way
            // there are functions hanging outside their own file. One source for both.
            const g = geo(w.node.id)
            const bandStart = g.r0
            const r0 = bandStart + FUNC_RIM
            // Inset angularly so the file's fill frames its own functions on both sides.
            // A root file spans the whole circle and has no neighbors to be told apart
            // from, so it takes no inset — an inset there would cut a wedge-shaped
            // notch out of a full ring for no reason.
            // Same rim as the arc edges, expressed as the angle that subtends it at
            // the band's mid-radius — so the frame is the same width all the way round.
            const rMid = bandStart + band / 2
            const pad = Math.min(FUNC_RIM / rMid, (g.a1 - g.a0) * FUNC_RIM_MAX_SHARE)
            const fa0 = g.a0 + pad
            const fa1 = g.a1 - pad
            const r1 = g.r1 - FUNC_RIM
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
              const c = colorFor(slot.node, mode, ranks, ageSpan)
              const isSel = selected?.id === slot.node.id
              const isHover = hover?.node.id === slot.node.id
              const d = arcPath(slot.a0, slot.a1, slot.r0, slot.r1)
              if (isSel) selMark = { d, width: 1.6 }
              else if (isHover) hoverMark = { d, width: 1.2 }
              return (
                <g key={slot.node.id}>
                <path
                  // The pulse is a CLASS, not a prop: `opacity` animated in CSS is
                  // compositor-only, so hundreds of these cost nothing per frame — which is
                  // the bar anything decorative has to clear in this app.
                  className={clsx(
                    'wedge',
                    mode === 'traps' && trapOf(slot.node.agent) && !slot.node.agentStale && 'trap-pulse',
                  )}
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
                    color — `applyAgentReports` drops a stale reading's score — so
                    without this the only sign a function was ever read would be in the
                    panel, one wedge at a time. The whole argument for a map is that you
                    can see where the problem is without clicking.

                    **Surprise only, because staleness is a fact about a READING and only
                    this mode is painted from readings.** In blame the color is an author,
                    in age a date, in language an extension — none of which expire when a
                    body changes. A hatch there marks the wedge as untrustworthy in an
                    encoding it cannot be untrustworthy in: the author of a function that
                    was edited is not in doubt. It read as damage to the layer underneath,
                    which is the same sin as a stale reading keeping its color, pointed the
                    other way. */}
                {paintsFromReadings(mode) && slot.node.agentStale && (
                  <path
                    className="pointer-events-none"
                    d={d}
                    fill="url(#stale-hatch)"
                  />
                )}
                {/* Out with a reader — the same marker the file wedges take, applied one
                    level in. Both are needed: a file reading pulses the file's band, and a
                    function reading has to pulse the patch, because the patches are drawn
                    ON TOP of their file's wedge and would otherwise hide the very mark
                    that says where the work is. */}
                {pulsing?.has(slot.node.id) && (
                  <path className="wedge-reading" d={d} pointerEvents="none" fill="var(--foreground)" />
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
                        // The patch's own middle, so the lattice is centered on it rather
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
                {/* And its name, if the patch can hold one.
                    The old rule was that functions are never labeled here, on the grounds
                    that they are laid out angularly by `layout` but DRAWN tiled inside
                    their file's band — so a name placed from the layout angle lands nowhere
                    near the patch it names. True, and it argued against the wrong thing:
                    the tiling hands back the patch's REAL geometry, which is what the fan
                    has always labeled from. Fitting to `slot` rather than to the wedge is
                    the whole difference, and a file drawn large enough has room for several.

                    The fan's tight bend, not the ring's generous one. These are treemap
                    cells that happen to sit in a band; there is no ring for a curve to
                    belong to at this scale — see `DEFAULT_BEND`. */}
                {(() => {
                  const at = fitLabel(slot, slot.node.name, {
                    weight: WEIGHT,
                    max: FUNC_MAX,
                    maxBend: FUNC_BEND,
                  })
                  return at ? (
                    <WedgeLabel
                      id={`fn-${slot.node.id}`}
                      at={at}
                      // The patch this name is standing ON decides the ink — see `ink.ts`.
                      // An unread patch is `--unanalyzed` at 0.4, which is nearly the
                      // ground, so it keeps the chrome's own foreground.
                      fill={c ? c.ink : CHROME_INK}
                      opacity={at.clipped ? 0.6 : 0.85}
                    />
                  ) : null
                })()}
                </g>
              )
            })
          })}

        </g>

        {/* Labels last, so they sit above every wedge.
            Both kinds are here — directories inside their plate, files curled just outside
            theirs — because they compete for the same ground and the one rule that decides
            them has to see both.

            Functions are not labeled from this pass. They are laid out angularly by
            `layout` but DRAWN tiled inside their file's band, so a name placed from the
            layout angle lands nowhere near the patch it names. The fan labels them, where
            they have room to be read. */}
        {(moving ? [] : wedges)
          .filter((w) => w.node.kind === 'dir' || w.node.kind === 'file')
          .map((w) => {
            // Fixed to where the wedge is THIS frame, like everything else. A label left at
            // its settled angle while its wedge travels is text sitting on a neighboring
            // directory for the length of the transition.
            const g = geo(w.node.id)
            const isDir = w.node.kind === 'dir'
            // A directory is a structural plate with nothing behind it, so its name sits in
            // the middle of it.
            //
            // A file is the opposite: its band is its own function tiling, and a name
            // printed over that is printed over the data it names. Files were therefore not
            // labeled at all. What they have instead is the one thing nothing else on the
            // ring has — a file is the outermost structural level, so the ground just past
            // its rim belongs to nobody. The name goes THERE, curled around the outside,
            // where it costs the tiling nothing.
            //
            // A rim name is confined to its OWN wedge's angular slice, inset on both
            // sides. Beyond the rim there is no plate to hold it, so the only thing
            // separating one file's name from the next is the wedge each belongs to —
            // without the inset, adjacent names run together into a single unreadable
            // band, which is what `command.rs browse.rs event_loop.rs app.rs` had become.
            // The inset is what makes the gap between two names visibly a gap.
            const pad = (g.a1 - g.a0) * RIM_INSET
            const cell = isDir
              ? g
              : {
                  a0: g.a0 + pad,
                  a1: g.a1 - pad,
                  r0: g.r1 + LABEL_GAP,
                  r1: g.r1 + LABEL_GAP + LABEL_BAND,
                }
            const at = fitLabel(cell, w.node.name, {
              weight: WEIGHT,
              max: isDir ? Math.max(11, Math.min(17, band * 0.34)) : FILE_MAX,
              // Arc only out here. The rim band is a thin annulus and whatever lies past it
              // belongs to somebody else, so a radial run leaves this file's territory on
              // its first character.
              only: isDir ? undefined : 'arc',
            })
            if (!at) return null
            return (
              // Hidden outright while the ring moves, rather than faded per frame. A name is
              // read, not glanced at, and text re-fitting its arc every frame is unreadable
              // anyway — so it would cost a `<defs>` and a textPath per wedge per frame to
              // render something nobody can use.
              <WedgeLabel
                key={`l-${w.node.id}`}
                id={`lp-${w.node.id}`}
                at={at}
                // A directory's name sits ON its plate, so the plate picks the ink — and at
                // the plate's own opacity, because under Surprise it is damped to 0.6 and
                // what the eye gets is the stop composited over the pane. An unanalyzed
                // plate is `--structure`, a near-background neutral, and takes the chrome's
                // foreground: background-on-background is why these went invisible the
                // moment the plates stopped being outlined in white.
                //
                // A FILE's name is not on anything. It hangs off the rim, past the outermost
                // ring, on ground that belongs to nobody — so the ground's own ink is the
                // right one, and it is set quieter than the structure it labels.
                fill={
                  isDir && fills.get(w.node.id)
                    ? inkOn(fills.get(w.node.id)!.stop, heatShare('dir', mode))
                    : CHROME_INK
                }
                opacity={(isDir ? 0.9 : 0.62) * (at.clipped ? 0.72 : 1)}
              />
            )
          })}

        {/* Evaluated after both wedge passes, so both marks are already set — and drawn
            after them, so no sibling's fill can eat half their width. Hover first, so a
            wedge that is somehow both keeps the heavier selection stroke on top. */}
        {hoverMark && (
          <path
            className="pointer-events-none"
            d={(hoverMark as { d: string }).d}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={(hoverMark as { width: number }).width}
          />
        )}
        {selMark && (
          <g className="pointer-events-none">
            {/* A halo under the outline, in the ground the cuts between wedges are already
                drawn in. A 1.6-unit stroke is legible on a directory and invisible on a
                function patch two pixels wide, which is the size of the thing you most often
                arrive at from the list — so the mark has to be bigger than the wedge rather
                than a border on it. Selection only: hover already tells you where it is,
                because your pointer is there. */}
            <path
              d={(selMark as { d: string }).d}
              fill="none"
              stroke="var(--background)"
              strokeWidth={(selMark as { width: number }).width + 3}
              strokeOpacity={0.85}
            />
            <path
              d={(selMark as { d: string }).d}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={(selMark as { width: number }).width}
            />
          </g>
        )}
        {/* Only when the selection itself was not drawn — see `selCoarse`. */}
        {!selMark && selCoarse && (
          <path
            d={(selCoarse as { d: string }).d}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={1.4}
            strokeDasharray="4 3"
            strokeOpacity={0.7}
            className="pointer-events-none"
          />
        )}
        </g>

        {/* The hub is the way back out: double-click it to go up a level, the mirror of
            double-clicking a wedge to go in. Grouped with its labels so the whole disc is
            the target, not just the ring under the text. The pointer only appears when
            there is somewhere to go, so it never promises a level that isn't there.

            An open file has one too, and it is this one — the fan's core is the hub, in
            the same place, at the same size. There was briefly a `HomeMark` here that
            morphed the disc into a bar at the pane's edge, which the rectangular file view
            needed because a treemap has no middle to spare. A fan does: it opens AROUND
            the core, so the affordance the rest of the app uses is simply still there and
            the special case is gone with the rectangle that required it. */}
        <g
          onDoubleClick={onUp ? (ev) => { ev.stopPropagation(); onUp() } : undefined}
          style={onUp ? { cursor: 'zoom-out' } : undefined}
        >
        <circle r={R_INNER - 4} fill="var(--card)" stroke="var(--border)" />
        {onUp && <title>Double-click to go up a level</title>}
        {/* The disc is solid throughout — it is what the directory you clicked is turning
            INTO, so it has to be there to be turned into. Its label is not: swapping the
            name on the first frame would announce the destination before the thing that is
            traveling has arrived. It fades up with the rest of the detail. */}
        <g className="patches-in" key={`hub-${root.id}`}>
        {/* Sized to the hub rather than fixed: a long repo name at a fixed size either
            overflows the circle or gets truncated to nothing useful. Shrinking to fit
            keeps the whole name, which is the one label that must always be readable.

            But shrinking stops at 9px, because below that the name is not readable either
            — so past HUB_FITS characters the size is pinned and the text runs straight out
            of the disc and across the wedges. A file view is where this bites: repo names
            are short, function-bearing test files like `dsd_reference_qualification.rs` are
            not. So the string is elided FIRST and the size computed from what will actually
            be drawn. Elided from the middle, keeping the extension, for the reason `elide`
            gives: the tail is the answer. The full name is a hover away and is already in
            the crumbs and the panel. */}
        {/* The label face, the same one every name on the map is drawn in — see `FAMILY`.
            The hub was the one name in the chart still set in the UI's system stack, which
            made the middle of the picture a different typeface from everything around it
            while naming the same kind of thing. Imported rather than restated, because the
            canvas measures in `FAMILY` and a second copy here would be a face that drifts
            out of agreement with the one the widths were computed in.

            `WEIGHT` too, for the same reason it is one constant for all three kinds of
            label: it was 600, and a semibold hub in the middle of a chart of regular-weight
            names read as emphasis rather than as the center. Size and position already say
            which one this is. */}
        {/* **The disc holds one thing, and the creature is it.**
            It held three: a name repeated verbatim in the breadcrumb an inch above and again
            in the panel's header, a line count the panel also states, and the one fact
            nothing else on screen carries — what the readers are doing. Two of those were
            already answered elsewhere on the same screen, and the middle of the map is the
            worst place to answer a question twice: it is the smallest surface here and the
            one every wedge points at.
            The name survives where the creature does not — the history replay has no run to
            depict, and a hub with neither would be a blank disc in the middle of the story. */}
        {!mascot && (
          <text
            textAnchor="middle"
            y={4}
            fontFamily={FAMILY}
            fontSize={Math.max(9, Math.min(15, 150 / Math.max(hubName.length, 5)))}
            fill="var(--foreground)"
            fontWeight={WEIGHT}
          >
            {hubName !== root.name && <title>{root.name}</title>}
            {hubName}
          </text>
        )}
        </g>
        </g>
      </svg>

      {/* The creature in the hub.
          A layer over the SVG rather than a `foreignObject` inside it: what is being placed
          is a WebGL canvas, and a canvas scaled by an SVG transform is a bitmap stretched
          rather than a picture redrawn. Positioned imperatively in the fit effect above, so
          it travels with the disc through a level change instead of jumping to the new
          middle a frame early.

          It sits at the top-left with everything in one transform, which is what lets the
          effect write a single property. `pointer-events` stay on: the six-click remint is
          the only way to get another creature, and this is now the only creature there is.

          **It carries the hub's own gesture rather than swallowing it.** The creature covers
          most of the disc, and the disc means "go up a level" — a dead patch in the middle
          of that target is worse than the one thing it costs, which is that six rapid clicks
          at a drilled-in level walk you out as well as reminting. Six clicks is a gesture
          people perform at rest, on the repo root, where there is nowhere to go up to. */}
      {mascot && (
        <div
          ref={hubMascot}
          className="absolute left-0 top-0 origin-center"
          style={{
            width: HUB_MASCOT,
            height: HUB_MASCOT,
            visibility: 'hidden',
            cursor: onUp ? 'zoom-out' : undefined,
          }}
          onDoubleClick={onUp ? (ev) => { ev.stopPropagation(); onUp() } : undefined}
        >
          <AgentMascot
            size={HUB_MASCOT}
            events={mascot.events}
            state={mascot.state}
            gaze={gaze}
          />
        </div>
      )}

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
          ageSpan={ageSpan}
          folded={hover.node.kind === 'dir' ? collapsed.has(hover.node.id) : undefined}
        />
      )}


      {(hidden.files + hidden.dirs > 0 || collapsed.size > 0) && (
        /* Never let the picture imply it showed everything.
           Two different omissions live here and they are not the same kind of thing.
           Wedges too thin to draw are the tool's doing and there is nothing to be done
           about them, so they are stated and left. A FOLDED directory is the reader's own
           doing — and it was missing from this note entirely, which is the worse of the
           two: option-clicking a subtree shut removes it from the picture with no standing
           record that it is gone, and the count of what the map is showing quietly stops
           meaning what it did. Somebody returning to a window they folded an hour ago has
           no way to tell a repo without tests from a repo whose tests they hid.

           So it says both, and the one the reader can undo carries the way to undo it.
           Boxed in the corner rather than floated under the graph: it is a caveat about
           the picture, so it reads as a note attached to it and not a caption of it. */
        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
          <span>
            {[
              collapsed.size > 0 &&
                `${collapsed.size.toLocaleString()} dir${collapsed.size === 1 ? '' : 's'} folded`,
              hidden.files > 0 &&
                `${hidden.files.toLocaleString()} file${hidden.files === 1 ? '' : 's'} too thin`,
              hidden.dirs > 0 &&
                `${hidden.dirs.toLocaleString()} dir${hidden.dirs === 1 ? '' : 's'} too thin`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          {collapsed.size > 0 && (
            <button
              type="button"
              className="rounded-[var(--radius-sm)] px-1 text-[var(--foreground)] underline decoration-dotted underline-offset-2 hover:bg-[var(--secondary)]"
              onClick={() => setCollapsed(new Set())}
            >
              unfold all
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Memoised, and the reason is the Read button.
 *
 * This component renders every arc in the repo — seventeen thousand of them on a large one
 * — so any App-level state change that reached it re-rendered the whole map. Opening a
 * dialog is such a change, and pressing Read took about a second to show anything: the
 * cost was never the dialog, it was the map being rebuilt behind it.
 *
 * Memo only pays if the props are stable, so the call site memoises `ranks` and `ageSpan`
 * and passes callbacks through `useCallback`. An inline lambda here silently undoes all of
 * this — the component still re-renders, and nothing looks wrong until somebody times a
 * click. That is the same failure mode as the poll rebuilding the frame tree because
 * `activeProject` is a fresh object every tick.
 */
export const Sunburst = memo(SunburstView)
