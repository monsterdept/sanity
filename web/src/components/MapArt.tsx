import { useMemo, type Dispatch, type Ref, type SetStateAction } from 'react'
import { trapOf, unreadable, type Node } from '../lib/api'
import { clsx } from '../lib/cn'
import {
  colorFor,
  flashPaint,
  histogramsFor,
  REPLAY,
  type Paint,
  type Slice,
  type Views,
  type ColorMode,
  paintsFromReadings,
} from '../lib/colorMode'
import { CHROME_INK, inkBy, lightnessBy, lightnessOf, type Resolve } from '../lib/ink'
import { arcPath, layout, tileFunctions, type Wedge } from '../lib/sunburst'
import { RINGS_DEFAULT } from '../lib/rings'
import { SPACING_DEFAULT, type Spacing } from '../lib/spacing'
import { rimRuns as runsOf } from '../lib/rim'
import { FileZoom, cellsOf, fanOf } from './FileZoom'
import { arcOf, lerpSector, place, type Arc, type Sector } from '../lib/fan'
import {
  extentOf,
  geoOf,
  lerpGeo,
  viewBoxOf,
  viewFor,
  type Exiting,
  type Geo,
  type View,
} from '../lib/zoom'
import { RollupDots, dotsId, ROLLUP_TEXTURE_PX } from './RollupDots'
import { WedgeLabel } from './WedgeLabel'
import { fitLabel, type Measure } from '../lib/label'
import { WEIGHT } from '../lib/labelStyle'
import { StaleHatch } from './StaleHatch'
import { HubCircles } from './HubCircles'
import { CIRCLES, type CirclesLook } from '../lib/hub'

/**
 * The map's picture, drawn from what it is handed and from nothing else.
 *
 * **One markup, two callers.** `Sunburst` is the window: it measures its pane, runs the level
 * change and the chase, follows the pointer and folds, and hands the result to `MapSvg` as a
 * frame. A report draws the same element with no window at all — `mapMarkup`, through
 * `react-dom/server`, in Node or inside the webview beside the live map — from `MapArt`, which
 * is `MapSvg` at rest. The two cannot drift apart, because there is no second copy of the
 * picture for them to drift from.
 *
 * So nothing in this file reads the page: no effect, no ref standing in for state, no layout
 * measurement, no animation frame. What the window reads for it — the canvas a name is
 * measured in, the stylesheet a name's ink is picked against, the shape of the pane — arrives
 * as a prop, and is never set on a module, because the window and an export can be drawing
 * at the same moment in one webview.
 *
 * The hub's circles (`HubCircles`) move themselves from effects. A
 * static render runs none, so what it draws is their first frame, which is their rest.
 */
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

/** Where the rings start and stop, in user units.
 *
 *  `R_INNER` is the hub at a ring width of 100% — see `Spacing['width']`, which moves it, and
 *  `rIn`, which is the number everything downstream of the layout actually reads. The rim is
 *  fixed: the view is fitted to what is drawn, so only the RATIO between these two is visible,
 *  and holding one end still is what keeps every threshold stated against `R_OUTER` true. */
export const R_INNER = 62
export const R_OUTER = 340

/** Gap between one ring level and the next.
 *
 *  Directories, files and functions are three different KINDS of thing and were drawn as
 *  one continuous mass of arcs. Hue cannot carry the distinction — hue is the reading —
 *  so it falls to geometry: a visible gutter between levels, and a frame of the file's
 *  own color around the functions it holds.
 *
 *  **The same gutter for every kind, where a file used to keep 40% of one.** The argument for
 *  the difference was that a gutter separates a thing from what is drawn beyond it, and past a
 *  file there is nothing: its functions are tiled INSIDE its own band, not in the ring outside.
 *  True, and it is not what the gutter turned out to be doing. Inside one ring the two kinds
 *  sit side by side, so unequal outer radii do not read as "these face different things" —
 *  they read as a rim that does not follow its own arc, which is a rendering fault. The eye
 *  reads the ring's edge as one line before it reads any wedge on it. A file loses about a
 *  unit and a half of band for this, which is a patch or so of tiling capacity. */
const RING_GAP = 3

/* The reader scales this — see `Spacing['ring']`. What the slider moves is a multiple of it;
   the number here is still what the map means by "a gutter", and 100% is this. */

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
export const FUNC_RIM = 7

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
export const FUNC_RIM_MAX_SHARE = 0.2

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

/** How wide a folded directory's handle is, in real screen pixels.
 *
 *  Big enough to see and to click — this is the only way back to what was folded, short of
 *  `unfold all` — and small enough that nobody reads it as a share. Under about ten it is
 *  indistinguishable from the ring's own cuts, which would put the record of a fold in the
 *  same visual class as a gap between two wedges. */
const FOLD_HANDLE_PX = 13

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

/* Scaled by the reader as one multiplier over all three — see `Spacing['slice']`. The RATIO
   is the argument above and a slider cannot flatten it. */

/** The hairline between two segments of a directory's rim, in screen pixels.
 *
 *  Thinner than any of the CUTs above, because those separate THINGS and this separates
 *  values inside one thing — a gap wide enough to read as structure would turn a
 *  distribution into a row of little wedges. Wide enough that two adjacent bands of a ramp
 *  do not read as one band that changes. */
const SLICE_CUT = 0.6

/** How big a pointing dot is, in screen pixels — see `dots`.
 *
 *  Sized against the rim it sits in (`DIR_RIM_PX`), a little smaller so it reads as a mark
 *  ON the band rather than a piece of one. Under about two it disappears against the
 *  structure; much over four and a row of them closes into a rim, which is the encoding
 *  this deliberately is not. */
const DOT_PX = 3.2

/** A wedge the map has to point at, and enough of its geometry to point at its SUBTREE.
 *
 *  The path is the wedge itself, for the outline. The angles and inner radius are what a
 *  DIRECTORY's spotlight is cut from — see `SECTOR` — which is why `kind` rides along: it
 *  is the one thing that decides which of the two shapes the hole takes, and reading it off
 *  the node at the mask would mean resolving an id back to a node for want of one field. */
type Mark = { d: string; a0: number; a1: number; r0: number; kind: string; width: number }

/** How far out a DIRECTORY's spotlight reaches: past the rim, whatever the rim is.
 *
 *  A directory's descendants are the same angular slice at a larger radius, so cutting the
 *  hole at its own band left it lit with everything inside it dimmed — exactly backwards,
 *  since you select a directory to look at what is in it. Overshooting the rings costs
 *  nothing: past them the veil is the ground drawn over the ground.
 *
 *  **It is a directory's rule and was applied to all three, which lit most of a quadrant.**
 *  The property above is true of a directory and false of the other two, because the other
 *  two already CONTAIN what they hold: a file's functions are tiled inside its own band
 *  (`tileFunctions`), and a function has no descendants at all. Cut outward, a selected
 *  function opened a fan from its own radius to infinity and lit every unrelated wedge that
 *  happened to share its angles — on ceph, two entire neighbouring files, with the one patch
 *  the user had clicked indistinguishable inside it. So the hole is the node's OWN path for
 *  a file or a function, and this sector only for a directory. */
const SECTOR = 1e4

/** How far everything that is not selected falls back, as a veil of the ground over it.
 *
 *  High enough that the selection is the only thing at full strength — which is the whole
 *  mechanism — and short of hiding the picture, because the answer to "where is it" is
 *  useless without "what is it near". At 0.62 the rings are still readable as shape and
 *  colour underneath; the selected wedge is simply the one that has not been touched. */
export const DIM = 0.62

/** How wide a directory's reading is drawn on its own rim, in pixels.
 *
 *  A directory's colour is never a reading OF the directory — there is no such thing to
 *  read. It is a roll-up of what is inside: a hot share under Surprise, a dominant
 *  language, a mean age. Filling the plate says "this thing is blue", which is a sentence
 *  about the directory; a band on the edge it shares with its children says "the contents
 *  of this thing are blue", which is the sentence the number actually supports. The plate
 *  underneath goes back to being what it is, structure.
 *
 *  It also gets the inner rings out of the way of the leaves. `HEAT_BY_KIND` was damping
 *  directories under Surprise for exactly this reason — the level that dominates by area
 *  was shouting a roll-up over the level whose number means what the legend says — and a
 *  band is the same restraint applied to AREA rather than to opacity, which is where the
 *  problem always was. The damping stays: it is about how loudly a roll-up speaks, and a
 *  loud thin band is still available.
 *
 *  Stated in pixels and converted through `unitsPerPx`, like every other threshold here,
 *  so a 4000px export draws the same band a 1000px pane does rather than a scaled one. */
const DIR_RIM_PX = 4.5

/** How far the band sits inside the plate, in pixels — clear of the outer edge and of
 *  both angular ends.
 *
 *  Flush against the rim it read as the wedge's own border, which is the sentence one
 *  level up: a directory outlined in blue is a blue directory again. Floated inside its
 *  plate with ground visible all the way round, it reads as something the plate is
 *  CARRYING — a mark on a surface rather than an edge of it — and the surface stays
 *  structure. It is also what keeps two stacked rings' bands from meeting across the cut
 *  and reading as one continuous ring of their own. */
const DIR_RIM_INSET_PX = 3

/* Switchable off, and OFF is the default — see `SPACING_DEFAULT`, which carries why the
   argument above stopped deciding it: the paragraph was written when the band was a few pixels
   of one colour, and a distribution a fifth of the ring deep reads as a bar on the plate
   without needing ground around it to say so. A switch rather than a width, because the margin
   has three readers and a partial frame is a band that overhangs its plate. */

/** The thinnest wedge worth drawing here, in radians.
 *
 *  The composition is drawn at a fixed radius in arbitrary units and the viewBox scales
 *  it to the pane, so the pixel width of a given angle is `R_OUTER × angle × scale`.
 *  Inverting that for one pixel is the whole of this. The nominal extent is used rather
 *  than the measured viewBox on purpose: the viewBox is derived from what was drawn, and
 *  feeding it back into what to draw is a loop. The rings always span `R_INNER..R_OUTER`
 *  whatever the repo, so the nominal is right to within the margins anyway. */
/** User units per screen pixel, quantised, for a picture `side` pixels across. Everything
 *  below is stated in pixels and converted through this, so the two axes answer to the same
 *  rule. Null for a side nobody has measured yet. */
export function unitsPerPxFor(side: number): number | null {
  if (side <= 0) return null
  const stepped = Math.max(SIZE_STEP, Math.round(side / SIZE_STEP) * SIZE_STEP)
  const extent = 2 * R_OUTER * (1 + 2 * MARGIN)
  return extent / stepped
}

/** What a picture of the map is drawn FROM: the tree, the lens, the reader's settings, and the
 *  one number the window measures for it. Everything `buildModel` derives is a function of
 *  these. */
export interface MapInput {
  root: Node
  mode: ColorMode
  ranks?: Map<string, number>
  /** How Age is calibrated and which of its two dates it paints — see `AgeView`. */
  views?: Views
  rings: number
  rimShare: number
  spacing: Spacing
  markers: boolean
  /** User units to a screen pixel — `unitsPerPxFor`. Null until a pane has been measured,
   *  which is a state only the window can be in. */
  unitsPerPx: number | null
  sortBy?: ReadonlyMap<string, number>
  replaying: boolean
  collapsed: ReadonlySet<string>
  selected: Node | null
  reading?: Set<string>
  /** Where a colour token's value is looked up, for the hub's circles — see `Resolve`. The
   *  document, when absent. */
  ink?: Resolve
}

/** `useMemo`'s shape, so one derivation serves a component and a caller with no component. */
type Memo = <T>(make: () => T, deps: readonly unknown[]) => T
const once: Memo = (make) => make()

/**
 * Everything the picture is laid out from, derived once.
 *
 * Memoised through `memo`, which is `useMemo` inside a component and a plain call for
 * `mapScene` — the same code either way, so what a report lays out is what the window lays
 * out. The deps are the window's own and unchanged: they are what keeps a pointer move from
 * re-running the layout.
 */
function buildModel(i: MapInput, memo: Memo) {
  const {
    root,
    mode,
    ranks,
    views,
    rings,
    rimShare,
    spacing,
    markers,
    unitsPerPx,
    sortBy,
    replaying,
    collapsed,
    selected,
    reading,
    ink,
  } = i
  /** How light a token is, looked up where this picture's colours are. */
  const lightness = (token: string) => (ink ? lightnessBy(ink, token) : lightnessOf(token))
  /** The thinnest wedge worth drawing, asked per ring.
   *
   *  One number for the whole circle was only ever right at one radius. An angle is not a
   *  width — the arc a span subtends is `r × angle` — so a threshold measured at `R_OUTER`
   *  and applied at every depth lets the inner rings draw wedges far under a pixel: at
   *  five rings the innermost sits at about a quarter of the outer radius, so it was
   *  keeping hairlines four times thinner than the floor claims. Wrong in the safe
   *  direction, and it gets less safe the more rings there are, which is the reason to fix
   *  it beside a control that raises them.
   *
   *  The radius is taken from the NOMINAL band — the ring count, not the depth actually
   *  present — because the depth is read off the layout this threshold is an input to, and
   *  feeding that back is a loop. On a tree shallower than the ring count the real bands
   *  are thicker and every radius larger, so the estimate is conservative; nothing on a
   *  three-ring repo is anywhere near the floor. */
  /** The mid-radius of ring `d`, from the NOMINAL band — the ring count, not the depth
   *  actually present, because the depth is read off the layout these thresholds are inputs
   *  to and feeding that back is a loop. On a tree shallower than the count the real bands
   *  are thicker and every radius larger, so both thresholds below are conservative. */
  /** Where the rings begin, at the reader's ring width — see `Spacing['width']`. The rim
   *  stays at `R_OUTER` and the hub moves, because that is the only end that can move
   *  visibly: fitting the view to the drawn extent means scaling both ends is a no-op. */
  const rIn = R_OUTER - (R_OUTER - R_INNER) * spacing.width
  /** How much smaller the hub is than the one every constant in it was written against.
   *  The disc, its name and the creature are all sized in user units and all three have to
   *  travel with it, or a wider ring draws a creature that overflows the circle it lives in. */
  const hubK = rIn / R_INNER

  const radiusAt = memo(() => {
    const band = (R_OUTER - rIn) / Math.max(1, rings)
    return (d: number) => rIn + band * (d - 0.5)
  }, [rings, rIn])

  const minAngleAt = memo(() => {
    if (unitsPerPx === null) return undefined
    const arc = MIN_ARC_PX * unitsPerPx
    return (d: number) => arc / radiusAt(d)
  }, [unitsPerPx, radiusAt])

  /** How wide a folded directory's handle is, per ring — see `LayoutOpts.handleAngleAt`.
   *  Stated in pixels for the reason every threshold here is: what makes a handle work is
   *  that it can be seen and hit, and neither is a fact about user units. */
  const handleAngleAt = memo(() => {
    if (unitsPerPx === null) return undefined
    const arc = FOLD_HANDLE_PX * unitsPerPx
    return (d: number) => arc / radiusAt(d)
  }, [unitsPerPx, radiusAt])
  /** Every container between what is drawn and what is selected, by id.
   *
   *  Only the ANCESTORS: the selection's own id is deliberately absent, so a wedge that is
   *  both drawn and selected takes the real outline below and never the stand-in. Empty
   *  when the selection is somewhere else entirely — another directory, or a synthesised
   *  roll-up that is in no tree — and an empty trail draws nothing, which is correct.
   *  Nothing on screen is better than a ring around a wedge that does not hold it. */
  const selTrail = memo(() => {
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
  const minPatchArea = memo(
    () => (unitsPerPx === null ? undefined : MIN_PATCH_PX * unitsPerPx * unitsPerPx),
    [unitsPerPx],
  )
  const { wedges, hidden } = memo(
    () => layout(root, rings, { collapsed, minAngleAt, handleAngleAt, sortBy }),
    [root, rings, collapsed, minAngleAt, handleAngleAt, sortBy],
  )
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
  const pulsing = memo(() => {
    if (!reading || reading.size === 0) return reading
    const drawn = wedges.filter((w) => reading.has(w.node.id)).map((w) => w.node.id)
    return new Set(drawn.filter((id) => !drawn.some((d) => d.startsWith(`${id}/`))))
  }, [wedges, reading])
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
  const fileWedges = memo<Wedge[]>(() => wedges.filter((w) => w.node.kind === 'file'), [wedges])
  /** Ring thickness follows the depth actually present, so a shallow project fills the
   *  canvas instead of drawing three rings and a lot of empty paper.
   *
   *  STRUCTURAL depth only. `layout` reports the max depth over every node including
   *  functions, and sizing the bands by that reserved a whole ring for a level that is
   *  not supposed to have one — functions live inside their file's band, not outside
   *  it. The visible symptom was the hierarchy shifted outward by one: a ring holding
   *  files alongside the functions of the files one level in. */
  const structDepth = memo(() => {
    let d = 0
    for (const w of wedges) if (w.node.kind !== 'func') d = Math.max(d, w.depth)
    return Math.max(d, 1)
  }, [wedges])
  const band = (R_OUTER - rIn) / structDepth
  /** Where every wedge in THIS layout belongs, by id. The renderer below reads geometry
   *  from here rather than recomputing it, so the moving picture and the settled one are
   *  the same arithmetic and cannot drift apart. */
  /** Each structural wedge's fill and label, computed once per level rather than per
   *  frame. Only geometry changes while the ring is moving, and `colorFor` over a couple
   *  of hundred wedges sixty times a second is work with no output. */
  /** Every drawn directory's distribution under this lens — see `histogramsFor`.
   *
   *  Memoised beside `fills` and for the same reason: it is one walk of the tree, it changes
   *  only when the tree or the lens does, and it must not be redone per frame of a chase. */
  /** The containers on screen, which is what a histogram is worth computing for.
   *
   *  A wedge that is not drawn cannot show a rim, and answering for it is the expensive half
   *  of the walk — see `histogramsFor`'s `want`. On kibana at five rings this is a couple of
   *  hundred ids out of seven thousand directories. */
  const drawnDirs = memo(() => {
    const ids = new Set<string>()
    for (const w of wedges) if (w.node.kind === 'dir') ids.add(w.node.id)
    return ids
  }, [wedges])

  const hist = memo(
    // **A replay draws these too, and the gate is the lens rather than the mode.** It was off
    // for the whole of `morph`, on the belief that a frame carries no readings — it carries
    // four grades packed into two bytes (`history.ts`), which is exactly why `REPLAY` marks
    // Surprise, Legibility, Docs and Traps as live. What a frame genuinely does not carry is
    // the parse-derived lenses, and those are the ones marked `cost`: bucketing them would
    // put a confident grey rim under a lens whose wedges are deliberately neutral.
    //
    // It is a walk of the subtree per frame, which is the same order as building the frame
    // tree the walk is over — the replay's roll-up (`minLoc`) folds most functions away
    // before any node exists, so this is a constant factor on a cost already being paid, not
    // a new one proportional to the repo.
    () =>
      replaying && REPLAY[mode] !== 'live'
        ? new Map<string, Slice[]>()
        : histogramsFor(root, mode, ranks, views, drawnDirs),
    [root, mode, ranks, views, replaying, drawnDirs],
  )

  const fills = memo(() => {
    const m = new Map<string, ReturnType<typeof colorFor>>()
    for (const w of wedges)
      if (w.node.kind !== 'func') m.set(w.node.id, colorFor(w.node, mode, ranks, views))
    return m
  }, [wedges, mode, ranks, views])

  /** The colours on screen, most area first, and the top two darker first, for the circles in
   *  the hub — see `HubCircles`. By stop rather than by fill, so a ramp's near neighbours count as one
   *  colour. Weighted by area: a wedge's angle times its ring's share of the disc, which grows
   *  outward. The neutrals are left out, because they are the ground and not the lens.
   *
   *  **Functions count, at their file's ring.** They are tiled inside the file's own band, not
   *  in a ring beyond it, and they cover the file's fill there. So a file with functions is
   *  counted as its functions, each at the depth the file is drawn at. */
  const hubDiscs = memo(() => {
    const neutral = new Set(['--structure', '--unanalyzed'])
    const area = new Map<string, number>()
    for (const w of wedges) {
      if (w.node.id === root.id) continue
      const func = w.node.kind === 'func'
      if (!func && w.node.kind === 'file' && w.node.children.some((c) => c.kind === 'func')) continue
      const p = func ? colorFor(w.node, mode, ranks, views) : fills.get(w.node.id)
      if (!p) continue
      const token = p.stop.replace(/^var\((--[\w-]+)\)$/, '$1')
      if (neutral.has(token)) continue
      const ring = func ? w.depth - 1 : w.depth
      area.set(token, (area.get(token) ?? 0) + (w.a1 - w.a0) * (2 * ring + 1))
    }
    const ranked = [...area].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    if (ranked.length === 0) return null
    let pair: { outer: string; inner: string } | null = null
    if (ranked.length >= 2) {
      const [a, b] = ranked
      const [dark, light] = (lightness(a) ?? 0) <= (lightness(b) ?? 0) ? [a, b] : [b, a]
      pair = { outer: `var(${dark})`, inner: `var(${light})` }
    }
    // Every colour, most area first, for the circle a level adds — see `nest` in `HubCircles`.
    return { ranked: ranked.map((t) => `var(${t})`), pair }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wedges, fills, root.id, mode, ranks, views, ink])
  /** The cut between two neighbouring wedges, at the reader's scale — `CUT` is the argued
   *  shape and this is where it is spent. The three stay in proportion because one multiplier
   *  moves all of them; see `lib/spacing.ts` for why that is not a convenience. */
  const cuts = memo(
    () => ({
      dir: CUT.dir * spacing.slice,
      file: CUT.file * spacing.slice,
      func: CUT.func * spacing.slice,
    }),
    [spacing.slice],
  )

  /** The widest cut a wedge can wear without being erased by it.
   *
   *  **A cut is paint, not layout** — a background-coloured stroke on the wedge's own path, so
   *  that the gap is a constant WIDTH at every radius rather than an angle that opens at the
   *  rim (see `CUT`). What follows from that is the thing this exists to stop: the layout
   *  hands out the same angles whatever the cut is, the stroke eats `cut / 2` inward from each
   *  edge, and so a wedge narrower than the cut is painted out of existence BY ITS OWN
   *  SEPARATOR. Not culled — it is still in the layout, still holding its angle, and still
   *  answering the mouse. An invisible wedge you can hover is worse than either a drawn one or
   *  an absent one, and it arrives silently as the cut widens.
   *
   *  Measured at the wedge's INNER edge, which is where its arc is shortest — a cut that fits
   *  at `r1` and not at `r0` still closes the bottom of the wedge.
   *
   *  Half, so a wedge keeps at least as much paint as ground. The same shape of guard the rim
   *  segments already carry one function down (`or a thin one closes up`), and it degrades the
   *  way that one does: a fat cut on a thin wedge becomes a hairline instead of a
   *  disappearance, which reads as "there is something here, and there is no room to say what"
   *  — the true sentence.
   *
   *  It does NOT make a wide cut cost the ring wedges. The count is the layout's business and
   *  the layout is upstream of every line of this; what the guard buys is that widening the
   *  gaps cannot quietly delete files from a picture whose file count did not change. */
  const cutAt = (kind: string, a0: number, a1: number, r0: number) =>
    Math.min(
      kind === 'dir' ? cuts.dir : kind === 'func' ? cuts.func : cuts.file,
      (a1 - a0) * Math.max(r0, 1) * 0.5,
    )

  /** The gutter between one level and the next, at the reader's scale — see `RING_GAP`. */
  const ringGap = RING_GAP * spacing.ring

  /** The rim band in user units, including the cut that separates it from its own plate.
   *  Capped at the ring so a very shallow tree cannot produce a band wider than the wedge
   *  it sits on. `unitsPerPx` is null until the pane has been measured; a fixed fallback
   *  is better than a directory with no reading on it for the first frame. */
  const rim = memo(() => {
    const px = unitsPerPx ?? 1
    // Zero when the reader has turned the frame off — the ground that shows all the way round
    // the band, and nothing else. `rimBand` still holds the band inside its plate by half a
    // cut, and the gap below still keeps the label off it: those are containment and legibility
    // rather than a frame, and neither is what the switch is about. See `Spacing['border']`.
    const inset = spacing.border ? DIR_RIM_INSET_PX * px : 0
    // Never more than a third of the ring: on a deep tree the bands are thin, and a
    // margin that cannot fit is a band that eats its own plate.
    const base = Math.min(DIR_RIM_PX * px, band / 3)
    // **TEMPORARY — see `rimShare`.** The rim was a fixed few pixels because it carried one
    // colour; now it carries a distribution, and how much room a distribution wants is a
    // question about looking at real repos rather than one to be answered from a constant.
    // The far end is the whole band less its own margins, at which point the plate has
    // nothing left and its label goes with it — which is part of what the control is for
    // finding out.
    const full = Math.max(base, band - inset * 2)
    return {
      width: base + (full - base) * Math.min(1, Math.max(0, rimShare)),
      inset: Math.min(inset, band / 3),
      /** The clear air between the band and the name under it, which the frame's switch does
       *  NOT turn off. A label set against the thing above it is what had `tui` riding high
       *  in its wedge with its own ring through the ascenders — a defect either way round,
       *  and not a border. */
      gap: Math.min(DIR_RIM_INSET_PX * px, band / 3),
    }
  }, [band, unitsPerPx, rimShare, spacing.border])

  /** A directory's reading on the edge it shares with its contents — see `DIR_RIM_PX`.
   *
   *  `flash` says the colour is an EVENT rather than a reading: during a replay a directory
   *  whose subtree gained or lost code in this commit has nowhere of its own to say so, so
   *  it says it here (see `escalated`). An event must win outright over a distribution and a
   *  mark, and it must do so structurally rather than because a replay happens to have the
   *  other two switched off — this rim is the only slot the flash has, and a histogram drawn
   *  over it is the commit under the playhead going unreported. */
  /** Where a directory's rim sits, in the ring's own units. */
  const rimBand = (g: Geo) => {
    // **Never zero, even with the frame off.** A `Geo` is the wedge's whole SECTOR, and the
    // plate drawn on it is not: the plate is stroked in the background colour, so half a cut
    // is eaten off each of its edges and its visible boundary sits inside the sector by that
    // much. A band laid on the raw sector therefore overhangs the plate it belongs to on
    // three sides, and — since its neighbour overhangs by the same amount from the other
    // side — the bands of two adjacent directories MEET across the cut and draw one
    // continuous ring, which is a claim about the parent rather than about either of them.
    // Turning the frame off means the band goes flush to its plate. It does not mean the
    // band stops being contained by it.
    const trim = spacing.border ? rim.inset : cuts.dir / 2
    const r1 = g.r1 - trim
    const r0 = Math.max(g.r0, r1 - rim.width)
    // The same margin on the ends, expressed as the angle that subtends it at the band's
    // own radius — so the gap is the same width all the way round, which is the rule the
    // CUTs already follow. Capped as a share of the wedge, or a thin one closes up.
    const pad = Math.min(trim / Math.max(r1, 1), (g.a1 - g.a0) * 0.3)
    return { r0, r1, a0: g.a0 + pad, a1: g.a1 - pad }
  }

  /**
   * A directory's rim, cut into the segments that get drawn.
   *
   * **One definition, two readers: the paths below and the tooltip.** The pointer has to be
   * able to say what a segment IS, and the only honest answer is the one that was drawn —
   * a second pass that re-derived the widths would eventually disagree with the picture
   * about which value the pointer is over, which is worse than saying nothing.
   *
   * Geometry only. What a segment is, what merges with what, and what a merged one is
   * allowed to claim all live in `lib/rim.ts`, where a harness can reach them.
   */
  const rimRuns = (node: Node, g: Geo) => {
    const slices = hist?.get(node.id)
    if (!slices) return null
    const band = rimBand(g)
    const floor = (MIN_ARC_PX * (unitsPerPx ?? 1)) / Math.max(band.r1, 1)
    // Whether this lens's segments are NAMES rather than points on a scale — see `runsOf`.
    const cut = runsOf(slices, band.a0, band.a1, floor, mode === 'blame' || mode === 'language')
    return cut && { ...cut, band }
  }
  const target = memo(
    () => geoOf(wedges, rIn, band, () => ringGap),
    [wedges, band, ringGap, rIn],
  )
  /** Which wedges will hang a name outside themselves. */
  const fileIds = memo(() => new Set(fileWedges.map((w) => w.node.id)), [fileWedges])

  /** Where a file's functions get tiled, or null when its wedge has no room to tile them
   *  at all. Extracted because there are two callers and they must not disagree: the
   *  patch pass draws from it, and the escalation below asks it whether a file is showing
   *  its own contents or standing in for them. */
  const tilingOf = (g: Geo) => {
    const bandStart = g.r0
    const r0 = bandStart + FUNC_RIM
    const rMid = bandStart + band / 2
    const pad = Math.min(FUNC_RIM / rMid, (g.a1 - g.a0) * FUNC_RIM_MAX_SHARE)
    const fa0 = g.a0 + pad
    const fa1 = g.a1 - pad
    const r1 = g.r1 - FUNC_RIM
    const patch = minPatchArea ?? MIN_PATCH_PX
    const sector = (fa1 - fa0) * ((r1 * r1 - r0 * r0) / 2)
    if ((fa1 - fa0) * rMid < MIN_STACK_ARC || sector < OPEN_PATCHES * patch) return null
    return { r0, r1, fa0, fa1 }
  }
  /** Where a directory's traps (or clones) lie, as angles on its own rim.
   *
   *  **A mark, and a POINTING one — not a tint and not a segment.** Traps and Clones are the
   *  two lenses with no quantity in them: a trap is a boolean a reader reported and a clone
   *  is a flashpoint, so a directory shaded by how many it holds would answer "how trapped
   *  is this region" in the visual language of the lenses that do measure something. That
   *  argument already killed a clone tint (`colorMode.ts`) and it kills a rim histogram
   *  here for the same reason.
   *
   *  What a container CAN honestly say is where. Each dot sits at the angular middle of the
   *  drawn descendant that holds the thing, so the mark is on the radial you would follow
   *  outward to find it — the directory saying *there is one of these out this way* rather
   *  than *I am n% trapped*.
   *
   *  **Positioned by the FILE, never by the function.** Functions are laid out angularly by
   *  `layout` and then drawn tiled inside their file's band, so a function's layout angle is
   *  not where its patch is — the same trap that makes labels land nowhere near the thing
   *  they name. A file's wedge IS drawn at its angle, so pointing at the file points at the
   *  right slice of the ring, and the patch itself is visible one ring out.
   *
   *  Merged when two would land within `DOT_PX` of each other: at this size two dots a pixel
   *  apart are one fat dot, and a run of them is a dotted line that reads as a rim. */
  const dots = memo(() => {
    if (mode !== 'traps' && mode !== 'clones') return null
    if (!markers) return null
    // Traps replays — a frame carries its grades — and Clones does not, which is what
    // `REPLAY` already says about both. See `hist`, which takes the same gate.
    if (replaying && REPLAY[mode] !== 'live') return null
    /** Whether one function is the thing this lens marks. */
    const hit = (n: Node) =>
      mode === 'traps'
        ? n.kind === 'func' && !!n.agent && !n.agentStale && !n.agent.trapDated && trapOf(n.agent)
        : n.kind === 'func' && n.cloneSize != null
    /** The same question about a file whose functions were never sent.
     *
     *  Clones are in the columns; traps are readings, so they ride on the file — see
     *  `Node.cols` and `Node.pending`. Without this a mark existed only where somebody had
     *  already fetched the ring holding it, which on a large repo is almost nowhere: kibana's
     *  `platform` holds 334 six-clone functions and drew not one dot, while drilling one
     *  level in made them appear. That is a mark that reports where you have BEEN. */
    const held = (n: Node) =>
      mode === 'clones'
        ? (n.cols?.clones ?? []).some((c) => c > 0)
        : // `trapOf` already refuses an answer given under an older question; what it cannot
          // see is whether the reading has expired, which only the backend can say.
          (n.pending ?? []).some((r) => !r.stale && trapOf(r))

    const at = new Map<string, number[]>()
    /**
     * Angles of the DEEPEST DRAWN things under `node` that hold one of these, and whether
     * anything under it does at all.
     *
     * The two are not the same question and that is the whole of this. An angle can only
     * come from something the layout drew; a subtree can hold a trap ten levels past the
     * outermost ring, where there is no wedge and therefore no angle. Reporting only what
     * has an angle loses the mark exactly where the map is coarsest — and inventing one is
     * worse, because the dot's entire claim is *out this way*.
     *
     * So a container that holds one but has no drawn descendant holding one falls back to
     * its OWN middle: the honest reading of that dot is "somewhere in here", which is as
     * precise as the picture can be, and it sharpens on its own as you drill in and the
     * things underneath acquire wedges of their own.
     */
    const walk = (node: Node): { angles: number[]; any: boolean } => {
      if (node.kind === 'func') return { angles: [], any: false }
      const g = target.get(node.id)
      if (node.kind === 'file') {
        const hits = node.children.length > 0 ? node.children.filter(hit) : []
        const any = node.children.length > 0 ? hits.length > 0 : held(node)
        if (!any || !g) return { angles: [], any }
        // **The function's own patch, not the file's middle.** A file is the deepest thing
        // with an angle in the LAYOUT, but it is not the deepest thing on screen: its
        // functions are tiled inside its band, each with a real angular position, and a dot
        // whose claim is *out this radial* has to point down the radial the patch is on.
        // Pointed at the file's midpoint it lands beside the thing it means, which on a wide
        // file is most of a wedge away from it.
        //
        // The same tiling the render pass draws, from the same `tilingOf`, so the dot and
        // the patch cannot disagree about where the function is.
        const tile = tilingOf(g)
        const slots = tile
          ? tileFunctions(node.children, tile.r0, tile.r1, tile.fa0, tile.fa1, { minPatchArea })
          : []
        const at = new Map(slots.map((sl) => [sl.node.id, (sl.a0 + sl.a1) / 2]))
        const angles: number[] = []
        let rolled = false
        for (const h of hits) {
          const a = at.get(h.id)
          if (a === undefined) rolled = true
          else angles.push(a)
        }
        // A function the tiling rolled up has no patch to point at, and neither has one in a
        // file too narrow to tile at all. The file's own middle stands in for those — one
        // dot however many there are, because the alternative is a stack of identical marks
        // saying nothing the first already said.
        if (rolled || angles.length === 0) angles.push((g.a0 + g.a1) / 2)
        return { angles, any }
      }
      let any = false
      const angles: number[] = []
      for (const c of node.children) {
        const sub = walk(c)
        if (sub.any) any = true
        angles.push(...sub.angles)
      }
      // Nothing underneath could be pointed AT, but something is there. This is then the
      // deepest drawn thing that holds it, so it points at itself.
      const mine = angles.length > 0 ? angles : any && g ? [(g.a0 + g.a1) / 2] : []
      if (g && mine.length > 0) at.set(node.id, mine)
      return { angles: mine, any }
    }
    walk(root)
    return at
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, mode, markers, target, band, minPatchArea, replaying])

  return {
    ...i,
    rIn,
    hubK,
    minPatchArea,
    selTrail,
    wedges,
    hidden,
    pulsing,
    fileWedges,
    fileIds,
    band,
    hist,
    fills,
    hubDiscs,
    cuts,
    ringGap,
    rim,
    target,
    dots,
    cutAt,
    rimBand,
    rimRuns,
    tilingOf,
  }
}

export type MapModel = ReturnType<typeof buildModel>

/** The model, inside a component. */
export const useMapModel = (i: MapInput): MapModel => buildModel(i, useMemo)
/** The model, for a caller with no component — see `mapScene`. */
export const mapModel = (i: MapInput): MapModel => buildModel(i, once)

/** Where the box goes for a layout at rest, and for the level a transition is heading to. */
export function viewOf({
  target,
  rootKind,
  fileFrom,
  paneAspect,
  fileIds,
  morph,
  rIn,
}: {
  target: Map<string, Geo>
  rootKind: Node['kind']
  /** The wedge an open file grew out of — see `FileZoom`'s `from`. */
  fileFrom: Sector | null
  paneAspect: number
  fileIds: ReadonlySet<string>
  morph: boolean
  rIn: number
}): View {
  {
    // An open file is fitted to the FAN it is opening into, not to a ring's extent —
    // and to where it is GOING, so the box travels with the cells instead of snapping on
    // the frame the movement ends. `extentOf` already folds the hub in, which is exactly
    // right here: the fan's core IS the hub.
    const fan = rootKind === 'file' ? fanOf(fileFrom, paneAspect) : null
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
    return viewFor(extentOf(geos, rIn), MARGIN, CHROME_BOTTOM)
  }
}

/** A frame of the map: where every structural wedge is on this frame, and what is in flight.
 *  At rest it is the layout's own geometry with nothing moving — see `restFrame`. */
export interface Frame {
  geo: (id: string) => Geo
  moving: boolean
  /** Eased progress through a level change; 1 when nothing is moving. */
  e: number
  /** The level being left, flying out — see `Sunburst`'s `leaving`. */
  leaving: Exiting[]
  /** The directory being opened, on its way into the hub. */
  coring: { node: Node; from: Geo; to: Geo } | null
  /** The file being closed, rolling back into its wedge. */
  fileLeaving: { node: Node; from: Sector } | null
}

const NOWHERE: Geo = { a0: 0, a1: 0, r0: 0, r1: 0 }

/** A frame with nothing in flight: every wedge where the layout put it. */
export function restFrame(m: MapModel): Frame {
  return {
    geo: (id) => m.target.get(id) ?? { ...NOWHERE },
    moving: false,
    e: 1,
    leaving: [],
    coring: null,
    fileLeaving: null,
  }
}

/** What the map does when it is pointed at. The window's; a picture nobody can touch has none,
 *  and a static render drops every handler anyway. */
export interface MapHandlers {
  select: (n: Node) => void
  drill: (n: Node) => void
  hover: Dispatch<SetStateAction<Node | null>>
  /** Option-click on a directory: fold it shut, or open it again. */
  fold: (id: string) => void
}

const INERT: MapHandlers = { select: () => {}, drill: () => {}, hover: () => {}, fold: () => {} }

export interface MapSvgProps {
  m: MapModel
  frame: Frame
  viewBox: string
  /** The wedge an open file grew out of — see `FileZoom`'s `from`. */
  fileFrom: Sector | null
  /** The pane's width over its height, which decides how wide a file's fan opens. */
  paneAspect: number
  hover: Node | null
  /** Put each wedge's id and arc on its path — see `Sunburst`'s `tagNodes`. */
  tagNodes: boolean
  /** What names are measured with — see `Measure`. The canvas when absent, which is the
   *  window. */
  measure?: Measure
  /** Where a name's ink is looked up — see `Resolve`. When absent, each paint's own `ink`,
   *  which `colorFor` picked against the document. */
  ink?: Resolve
  circles: CirclesLook
  /** Where the circles look. Only their effects read these; the markup does not. */
  gaze: Array<{ x: number; y: number }> | null
  selectedGaze: { x: number; y: number } | null
  onUp?: () => void
  on?: MapHandlers
  svgRef?: Ref<SVGSVGElement>
  artRef?: Ref<SVGGElement>
}

export function MapSvg({
  m,
  frame,
  viewBox,
  fileFrom,
  paneAspect,
  hover,
  tagNodes,
  measure,
  ink,
  circles,
  gaze,
  selectedGaze,
  onUp,
  on = INERT,
  svgRef,
  artRef,
}: MapSvgProps) {
  const {
    root,
    mode,
    ranks,
    views,
    spacing,
    unitsPerPx,
    replaying,
    collapsed,
    selected,
    rIn,
    minPatchArea,
    selTrail,
    wedges,
    pulsing,
    fileWedges,
    band,
    hist,
    fills,
    hubDiscs,
    cuts,
    ringGap,
    rim,
    dots,
    cutAt,
    rimBand,
    rimRuns,
    tilingOf,
  } = m
  const { geo, moving, e, leaving, coring, fileLeaving } = frame
  /** The ink a name takes on the patch it stands on — the same judgement `colorFor` made, asked
   *  of this picture's colours rather than the document's when somebody said what they are. */
  const inkOf = (c: Paint) => (ink ? inkBy(ink, c.stop) : c.ink)
  const dirRim = (node: Node, c: ReturnType<typeof colorFor>, g: Geo, fade = 1, flash = false) => {
    if (node.kind !== 'dir') return null
    const { r0, r1, a0, a1 } = rimBand(g)
    if (r1 <= r0) return null
    const opacity = fade * heatShare('dir', mode)

    /** The distribution, when this lens has one — see `histogramsFor`. */
    const cut = flash ? null : rimRuns(node, g)
    if (cut) {
      return (
        <g className="pointer-events-none">
          {cut.runs.map((s, i) => {
            return (
              <path
                key={i}
                d={arcPath(s.a0, s.a1, r0, r1)}
                fill={s.fill}
                fillOpacity={opacity}
                // A hairline of the ground between segments, on the rule the ring's own CUTs
                // follow: two values that abut with no gap read as one value that changes,
                // which is the one thing a categorical rim must not say.
                //
                // **It goes with the frame.** The reader's switch is about ground showing on a
                // directory's band, and these hairlines are ground showing on a directory's
                // band — leaving them lit while the frame around them is off is the switch
                // doing most of what it says and then stopping. What it costs is stated
                // above, and it is the reader's to spend: two segments of one ramp that abut
                // read as one segment, so an unbroken band is a distribution you can see the
                // shape of and not one you can count.
                stroke={spacing.border ? 'var(--background)' : 'none'}
                strokeWidth={SLICE_CUT * (unitsPerPx ?? 1)}
              />
            )
          })}
        </g>
      )
    }

    /** The pointing marks — see `dots`. Drawn in the rim's own band, so a lens that marks
     *  and a lens that measures put their answer in the same place on the wedge. */
    const marks = flash ? undefined : dots?.get(node.id)
    if (marks && marks.length > 0) {
      const rMid = (r0 + r1) / 2
      const px = unitsPerPx ?? 1
      const rad = (DOT_PX * px) / 2
      // Merged by proximity, in ANGLE at this radius — the same threshold in pixels means a
      // different angle on every ring, and the eye is reading pixels.
      const gap = (DOT_PX * 1.6 * px) / Math.max(rMid, 1)
      const keep: number[] = []
      for (const a of [...marks].sort((x, y) => x - y)) {
        if (a < a0 || a > a1) continue
        if (keep.length === 0 || a - keep[keep.length - 1] >= gap) keep.push(a)
      }
      return (
        <g className="pointer-events-none">
          {keep.map((a) => (
            <circle
              key={a}
              cx={rMid * Math.sin(a)}
              cy={-rMid * Math.cos(a)}
              r={rad}
              fill={mode === 'traps' ? 'var(--trap)' : 'var(--clone)'}
              fillOpacity={fade}
            />
          ))}
        </g>
      )
    }

    if (!c) return null
    return (
      <path
        className="pointer-events-none"
        d={arcPath(a0, a1, r0, r1)}
        fill={c.fill}
        fillOpacity={opacity}
      />
    )
  }
  /** A replay's events, moved to the nearest wedge that is actually drawn.
   *
   *  An event belongs to a function. On anything the size of home-assistant no function
   *  has a wedge — `minLoc` folds them away before the tree is built — and neither does
   *  its file: fifteen thousand of them are under the angle a wedge needs. So the commit
   *  under the playhead had nowhere to land, and a replay of a large repo was a grey map
   *  beside a scrolling log. Nothing was wrong with the walk; the picture simply had no
   *  surface for it.
   *
   *  The ladder is the obvious one — the function if it is drawn, else its file, else the
   *  directory that holds it — and it is decided HERE rather than rolled up in the fold,
   *  because "is it drawn" is a question about this pane at this size with this drill
   *  stack, which the fold cannot see. What makes it cheap is that culling takes whole
   *  subtrees (`layout`), so the drawn wedges are a connected top-down tree: a directory
   *  only has to look at its own children, and an event under a child that is NOT drawn is
   *  an event no descendant can be showing.
   *
   *  It is not a roll-up wearing a hat. A roll-up lights every ring out to the rim on
   *  every commit — that is why `aggregate` refuses one — and this lights exactly one
   *  wedge per event: the deepest one there is room for. */
  const escalated = new Map<string, ReturnType<typeof flashPaint>>()
  {
    const drawn = new Set(wedges.map((w) => w.node.id))
    const birthUnder = (n: Node) => n.birthBelow === true || n.score?.appeared != null
    const touchUnder = (n: Node) => n.touchBelow === true || n.score?.edited != null
    for (const w of wedges) {
      const n = w.node
      if (n.kind === 'func') continue
      let birth = false
      let touch = false
      if (n.kind === 'file') {
        // A file with room to tile shows the event on the function it happened to, which
        // is the ladder's first rung working. Only a file drawn solid stands in for its
        // own contents.
        if (tilingOf(geo(n.id)) === null) {
          birth = birthUnder(n)
          touch = touchUnder(n)
        }
      } else {
        for (const c of n.children) {
          if (drawn.has(c.id)) continue
          birth = birth || birthUnder(c)
          touch = touch || touchUnder(c)
          if (birth && touch) break
        }
      }
      // Arrival beats a touch, the same way it does in `colorFor` and for the same
      // reason: the commit that creates a function also touches it.
      if (birth || touch) escalated.set(n.id, flashPaint(birth ? 'birth' : 'touch'))
    }
  }
  /** Whether anything on this ring can carry a directory band — which is what decides
   *  where a directory's NAME sits. See `plateOf`.
   *
   *  **The three things `dirRim` will draw, asked in the same order it asks them**: a
   *  distribution, the pointing marks, or the wedge's own colour as a solid band. If none of
   *  them answers for any drawn directory then the strip above every name is empty, and a
   *  name centred below an empty strip is a name that looks like it slid.
   *
   *  **`fills` is asked for its VALUE, not for the key.** It holds an entry for every
   *  non-function wedge and the entry is often `null` — `colorFor` returning nothing is how a
   *  directory says it has no reading under this lens, and `dirRim` checks exactly that
   *  before drawing. Asking `has` made this true on every ring ever drawn, so the room was
   *  still being reserved everywhere and the whole check did nothing.
   *
   *  True during a replay whatever it finds, because the room must not come and go with the
   *  playhead — a rim that exists for one commit would move every label in the picture and
   *  put it back on the next.
   *
   *  Cheap: it walks the drawn wedges, which is hundreds, and stops at the first yes. The
   *  maps it reads are the ones already memoised for the ring. */
  const banded =
    replaying ||
    wedges.some(
      (w) =>
        w.node.kind === 'dir' &&
        ((hist.get(w.node.id)?.length ?? 0) > 0 ||
          (dots?.get(w.node.id)?.length ?? 0) > 0 ||
          fills.get(w.node.id) != null ||
          escalated.get(w.node.id) != null),
    )
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
  let selMark: Mark | null = null
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
  let selCoarse: (Mark & { depth: number }) | null = null

  /** The part of a directory's plate its band does not speak for — where the name goes.
   *
   *  **Reserved per RING, never per wedge, and never during a replay.** The room a band
   *  takes is subtracted from the top of the plate, and a name centred in what is left sits
   *  lower than the middle of its wedge — which is correct while there is a band up there
   *  and wrong when there is not: under a lens that paints no directory rim at all, `src`,
   *  `web` and `components` all sat visibly inboard with a strip of empty plate above them.
   *
   *  Two versions of this are wrong. Asking per wedge gives one directory a centred name and
   *  its neighbour a low one on the same ring, which reads as labels that slid. Asking every
   *  frame of a replay is a rim appearing for one step of the playhead and every label in the
   *  picture twitching inward and back on the commit after — the original argument for
   *  reserving unconditionally, and it still holds, so a replay keeps the room reserved
   *  whatever it is painting.
   *
   *  What is left is a property of the lens over the ring on screen: either something up
   *  there can carry a band, or nothing can. See `banded`.
   *
   *  The inset counts twice: once as the band's own margin from the edge, once again as
   *  the gap between the band and the text, so a name is not set against the thing above
   *  it. That is what had `tui` riding high in its wedge with its own ring through the
   *  ascenders. */
  const plateOf = (g: Geo): Geo =>
    banded
      ? {
          ...g,
          // The band's own trim from the wedge edge (`rimBand`), then the band, then the
          // clear air above the name. With the frame on the first two of those are the same
          // number, which is the `inset * 2` this used to read as.
          r1: Math.max(
            g.r0,
            g.r1 - (spacing.border ? rim.inset : cuts.dir / 2) - rim.width - rim.gap,
          ),
        }
      : // Nothing to make room for, so the name is centred in the whole plate — less the
        // trim the plate itself is drawn inside of, which is containment rather than a band.
        { ...g, r1: Math.max(g.r0, g.r1 - (spacing.border ? rim.inset : cuts.dir / 2)) }

  /* Absolutely positioned rather than a flex child sized in percentages. As a flex
          child the SVG's `height: 100%` has to resolve through the chart pane, and when
          it doesn't the square viewBox falls back to its intrinsic ratio and takes its
          WIDTH as its height — which at full screen made the chart taller than the pane
          and pushed the legend off the bottom. `inset-0` makes both axes definite.

          The viewBox is the measured extent of what is DRAWN, not the nominal circle the
          constants describe. A tree shallower than the ring count never reaches `R_OUTER`, and a
          ring whose outer band is sparse does not paint to its own edge — so a fixed box
          leaves a margin whose size depends on the repo, and the map sits smaller than
          the pane it was given for reasons the reader cannot see. Measured in USER units,
          which do not change when the viewBox does, so this settles in one pass rather
          than chasing itself. */
  /* `data-sunburst` is how the movie export finds the picture to record. An attribute
          rather than a ref handed up through the app: the exporter copies whatever is on
          screen at each commit, and what it must never do is hold a second idea of what the
          map is — see `movie.ts`. */
  return (
      <svg
        ref={svgRef}
        data-sunburst=""
        viewBox={viewBox}
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
          leaving.map((x) => {
            const g = lerpGeo(x.from, x.to, e)
            const c = colorFor(x.node, mode, ranks, views)
            const plate = x.node.kind === 'dir' ? null : c
            return (
              <g key={`leaving-${x.node.id}`}>
                <path
                  d={arcPath(g.a0, g.a1, g.r0, g.r1)}
                  fill={plate ? plate.fill : 'var(--structure)'}
                  fillOpacity={(1 - e) * (plate ? heatShare(x.node.kind, mode) : 1)}
                  stroke="var(--background)"
                  strokeWidth={cutAt(x.node.kind, g.a0, g.a1, g.r0)}
                />
                {dirRim(x.node, c, g, 1 - e)}
              </g>
            )
          })}
        {/* `data-rings` is how the colour key finds the circle it wraps around. This group
            is the FITTED composition — every transform that places the map on screen is on
            it — so its client rect is the drawn disc itself, at whatever size and offset the
            current view put it. See `useMapEdge`, which used to estimate this from the pane
            and now measures it. */}
        <g ref={artRef} data-rings style={moving ? { pointerEvents: 'none' } : undefined}>
          {/* The directory you opened, shrinking into the middle it is about to be.
            Inside the fitted group, because it IS the arriving level's own hub and the box
            should be drawn around where it lands. Painted before everything else so it
            passes under the hub disc: it does not need to fade out, it is covered by the
            thing it turned into, which is what "became the core" should look like. */}
          {moving &&
            coring &&
            (() => {
              const g = lerpGeo(coring.from, coring.to, e)
              const c = colorFor(coring.node, mode, ranks, views)
              return (
                <g>
                  <path
                    d={arcPath(g.a0, g.a1, g.r0, g.r1)}
                    fill="var(--structure)"
                    fillOpacity={1}
                    stroke="var(--background)"
                    strokeWidth={cutAt('dir', g.a0, g.a1, g.r0)}
                  />
                  {dirRim(coring.node, c, g)}
                </g>
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
          {moving && fileLeaving && (
            <g style={{ pointerEvents: 'none' }}>
              <FileZoom
                root={fileLeaving.node}
                // Backwards. `t` always runs 0→1 for the level arriving; what is LEAVING has
                // to read that as 1→0, or the file would unroll again on its way out.
                t={1 - e}
                from={fileLeaving.from}
                unitsPerPx={unitsPerPx}
                paneAspect={paneAspect}
                selected={null}
                mode={mode}
                ranks={ranks}
                views={views}
                minPatchArea={minPatchArea}
                onSelect={() => {}}
                onDrill={() => {}}
                onHover={() => {}}
                settled={false}
                measure={measure}
                ink={ink}
              />
            </g>
          )}
          {root.kind === 'file' && (
            <FileZoom
              root={root}
              t={e}
              from={fileFrom}
              unitsPerPx={unitsPerPx}
              paneAspect={paneAspect}
              selected={selected}
              mode={mode}
              ranks={ranks}
              views={views}
              minPatchArea={minPatchArea}
              onSelect={on.select}
              onDrill={on.drill}
              onHover={on.hover}
              tagNodes={tagNodes}
              measure={measure}
              ink={ink}
            />
          )}
          {/* Arcs first, dots after, so a dot is never buried under the ring it belongs to. */}
          {root.kind !== 'file' &&
            wedges
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
                // The wedge's own reading, or an event from below that has nowhere else to be
                // drawn — see `escalated`. Its own comes first: a directory that is flashing its
                // own arrival is already saying the loudest thing it has to say.
                const c = fills.get(w.node.id) ?? escalated.get(w.node.id) ?? null
                /** The colour came from an event rather than from a reading — see `dirRim`. */
                const flashing = !fills.has(w.node.id) && escalated.has(w.node.id)
                // A directory's reading goes on its rim, not through it — `DIR_RIM_PX`. What is
                // left here is the plate, which is structure and takes the structural neutral,
                // exactly as an unread directory always did.
                const plate = w.node.kind === 'dir' ? null : c
                // Agent verdicts and model surprisal are different instruments and must be
                // told apart at a glance. Hue is spoken for — it is the reading itself — so the
                // distinction goes on the outline.

                const isSel = selected?.id === w.node.id
                const isHover = hover?.id === w.node.id
                const foldable = w.node.kind === 'dir' && w.node.children.length > 0
                const isFolded = foldable && collapsed.has(w.node.id)
                if (isSel)
                  selMark = { d: arcPath(a0, a1, r0, r1), a0, a1, r0, kind: w.node.kind, width: 2 }
                else if (isHover) hoverMark = { d: arcPath(a0, a1, r0, r1), width: 1.6 }
                // Deepest wins: the file that holds the selection beats the directory that holds
                // the file, because a narrower answer to "where is it" is a better one.
                if (selTrail?.has(w.node.id) && (!selCoarse || w.depth > selCoarse.depth)) {
                  selCoarse = {
                    d: arcPath(a0, a1, r0, r1),
                    a0,
                    a1,
                    r0,
                    kind: w.node.kind,
                    depth: w.depth,
                    width: 1.4,
                  }
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
                        d={arcPath(a0, a1, r0 - ringGap * 0.5, r0 + band)}
                        fill="transparent"
                        onMouseEnter={() => on.hover(w.node)}
                        onMouseLeave={() => on.hover((n) => (n?.id === w.node.id ? null : n))}
                        onClick={(e) => {
                          e.stopPropagation()
                          on.select(w.node)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          on.drill(w.node)
                        }}
                      />
                    )}
                    <path
                      className="wedge"
                      data-node={tagNodes ? w.node.id : undefined}
                      data-arc={tagNodes ? `${a0} ${a1} ${r0} ${r1}` : undefined}
                      // A file occupies exactly ONE band, like a directory. Its functions are
                      // inset inside that band, so the file's own fill shows as a rim around
                      // them — the containment is drawn, not implied by adjacency.
                      d={arcPath(a0, a1, r0, r1)}
                      // Unanalyzed wedges take the neutral, not the ramp — see `isAnalyzed`.
                      // A folded directory is drawn a shade heavier than an open one, so the
                      // ring that ends at it reads as packed rather than as genuinely empty.
                      fill={
                        plate
                          ? plate.fill
                          : isFolded
                            ? 'color-mix(in oklch, var(--structure) 78%, var(--foreground))'
                            : 'var(--structure)'
                      }
                      fillOpacity={
                        isSel || isHover
                          ? 0.95
                          : plate
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
                      strokeWidth={cutAt(w.node.kind, a0, a1, r0)}
                      onMouseEnter={() => on.hover(w.node)}
                      onMouseLeave={() => on.hover((n) => (n?.id === w.node.id ? null : n))}
                      onClick={(e) => {
                        e.stopPropagation()
                        // Option-click folds a directory shut — the cheap way to get a subtree
                        // out of the picture without leaving the level you are on. On a modifier
                        // rather than a plain click so selecting still does exactly one thing,
                        // and Option rather than Command because Option-click is already the
                        // disclosure gesture on this platform; Command-click means "open
                        // elsewhere" nearly everywhere else.
                        if (e.altKey && foldable) {
                          // The window folds, and arms its chase first — see `Sunburst`'s
                          // `handlers`.
                          on.fold(w.node.id)
                          return
                        }
                        on.select(w.node)
                      }}
                      onDoubleClick={() => on.drill(w.node)}
                    ></path>
                    {/* **The handle is hatched, so it cannot be read as a small wedge.**
                        A narrow wedge says "this is a small thing", and what somebody folds
                        is usually the largest thing in the ring — so the one shape this must
                        not take is the shape everything around it has. The texture is the
                        statement; see `fold-hatch`. Deaf to the mouse so the wedge under it
                        keeps every gesture, including the ⌥-click that puts it back. */}
                    {isFolded && (
                      <path
                        d={arcPath(a0, a1, r0, r1)}
                        fill="url(#fold-hatch)"
                        pointerEvents="none"
                      />
                    )}
                    {/* The reading itself, on the edge the directory shares with its contents. */}
                    {dirRim(w.node, c, g, 1, flashing)}
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
            {(moving ? [] : fileWedges).map((w) => {
              // Inside the file's OWN band — (depth - 1) — not the one beyond it. Inset
              // on both radii so the file's fill reads as a rim on the inside and outside
              // edges too, not just the angular sides.
              // **From `geo`, not from the wedge.** The tiling used to be laid out straight
              // off the layout's own angles, which is the wedge's FINAL position — fine while
              // the only thing that moved was a level change, because patches are not drawn
              // during one. Once the rings can ease toward a shape that changed under them,
              // a file's functions laid out at the target while its wedge is still on its way
              // there are functions hanging outside their own file. One source for both.
              // Inside the file's OWN band — (depth - 1) — not the one beyond it, inset on
              // both radii so the file's fill reads as a rim on the inside and outside edges
              // too, and angularly so it frames its own functions on both sides. All of that
              // is `tilingOf`, which also answers whether there is room at all:
              //
              // Too small to say anything: draw the file solid instead. The test is AREA —
              // the arc floor that used to carry it alone was written for a radial stack,
              // where a file's whole angular width WAS one slice; tiling spends both
              // dimensions, so a wedge can be narrow and still hold plenty, and the old rule
              // was silencing files that had the room. Four patches rather than one, because
              // a wedge with room for a single patch draws its own roll-up over its own area
              // and says nothing the file's fill was not already saying. The file keeps its
              // own fill and its own hover, and drilling in still shows every function it
              // has; `layout` culls wedges below `MIN_ANGLE` on the same reasoning, and this
              // is that rule one level further in, where the wedges are not culled but their
              // CONTENTS cannot be drawn.
              //
              // **From `geo`, not from the wedge.** The tiling used to be laid out straight
              // off the layout's own angles, which is the wedge's FINAL position — fine while
              // the only thing that moved was a level change, because patches are not drawn
              // during one. Once the rings can ease toward a shape that changed under them,
              // a file's functions laid out at the target while its wedge is still on its way
              // there are functions hanging outside their own file. One source for both.
              const tile = tilingOf(geo(w.node.id))
              if (!tile) return null
              const { r0, r1, fa0, fa1 } = tile
              return tileFunctions(w.node.children, r0, r1, fa0, fa1, { minPatchArea }).map(
                (slot) => {
                  const c = colorFor(slot.node, mode, ranks, views)
                  const isSel = selected?.id === slot.node.id
                  const isHover = hover?.id === slot.node.id
                  const d = arcPath(slot.a0, slot.a1, slot.r0, slot.r1)
                  if (isSel)
                    selMark = { d, a0: slot.a0, a1: slot.a1, r0: slot.r0, kind: 'func', width: 1.6 }
                  else if (isHover) hoverMark = { d, width: 1.2 }
                  return (
                    <g key={slot.node.id}>
                      <path
                        data-node={tagNodes ? slot.node.id : undefined}
                        data-arc={
                          tagNodes ? `${slot.a0} ${slot.a1} ${slot.r0} ${slot.r1}` : undefined
                        }
                        // The pulse is a CLASS, not a prop: `opacity` animated in CSS is
                        // compositor-only, so hundreds of these cost nothing per frame — which is
                        // the bar anything decorative has to clear in this app.
                        className={clsx(
                          'wedge',
                          mode === 'traps' &&
                            trapOf(slot.node.agent) &&
                            !slot.node.agentStale &&
                            'trap-pulse',
                          // The same breath for the same reason — copies are 1–8% of a repo, which
                          // is the density where a colour alone means hunting. See `--clone`.
                          mode === 'clones' && slot.node.cloneSize != null && 'trap-pulse',
                        )}
                        d={d}
                        fill={c ? c.fill : 'var(--unanalyzed)'}
                        fillOpacity={isSel || isHover ? 1 : c ? 0.92 : 0.4}
                        // No per-wedge source mark. It existed to tell agent verdicts from
                        // model ones, but with MCP as the primary mode everything is
                        // agent-judged — a mark on every item is stripes, not information. The
                        // detail panel names the instrument for the one wedge you asked about.
                        stroke="var(--background)"
                        strokeWidth={cutAt('func', slot.a0, slot.a1, slot.r0)}
                        onMouseEnter={() => on.hover(slot.node)}
                        onMouseLeave={() =>
                          on.hover((n) => (n?.id === slot.node.id ? null : n))
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          on.select(slot.node)
                        }}
                        // Same gesture as a directory, one level further: double-clicking a
                        // function opens the file it lives in, at the function.
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          on.drill(slot.node)
                        }}
                      ></path>
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
                        <path className="pointer-events-none" d={d} fill="url(#stale-hatch)" />
                      )}
                      {/* Too large for any reading — see `unreadable`. Drawn on the same
                    lenses as the stale hatch and for the mirrored reason: it is a fact
                    about whether a READING can exist, so it belongs where readings are
                    the encoding and nowhere else. Under Blame this wedge has an author
                    like any other, and marking it there would call a fact about our own
                    limits a defect in somebody's code. */}
                      {paintsFromReadings(mode) && unreadable(slot.node) && (
                        <path className="pointer-events-none" d={d} fill="url(#unreadable-hatch)" />
                      )}
                      {/* **In a replay, NOT YET READ is drawn rather than left blank.** The
                    frames carry the readings the repo held at each commit, so under these
                    three lenses a function without one is a fact about that moment — nobody
                    had looked yet — and the whole point of folding the shards is watching
                    that hatch clear as the story runs. Traps is left out: there, an absence
                    is already drawn as the structural neutral and hatching every unread
                    wedge would cover a map whose finding is the handful that are marked. */}
                      {replaying &&
                        mode !== 'traps' &&
                        paintsFromReadings(mode) &&
                        slot.node.kind === 'func' &&
                        !slot.node.agent && (
                          <path
                            className="pointer-events-none"
                            d={d}
                            fill="url(#stale-hatch)"
                            opacity={0.5}
                          />
                        )}
                      {/* Out with a reader — the same marker the file wedges take, applied one
                    level in. Both are needed: a file reading pulses the file's band, and a
                    function reading has to pulse the patch, because the patches are drawn
                    ON TOP of their file's wedge and would otherwise hide the very mark
                    that says where the work is. */}
                      {pulsing?.has(slot.node.id) && (
                        <path
                          className="wedge-reading"
                          d={d}
                          pointerEvents="none"
                          fill="var(--foreground)"
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
                              // The patch's own middle, so the lattice is centered on it rather
                              // than on the hub. Mid-angle at mid-radius: not the true centroid
                              // of an annular sector, which sits a little outward of it, but the
                              // dots are a texture and the difference is under a tile.
                              cx={((slot.r0 + slot.r1) / 2) * Math.sin((slot.a0 + slot.a1) / 2)}
                              cy={-((slot.r0 + slot.r1) / 2) * Math.cos((slot.a0 + slot.a1) / 2)}
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
                          measure,
                        })
                        return at ? (
                          <WedgeLabel
                            id={`fn-${slot.node.id}`}
                            at={at}
                            // The patch this name is standing ON decides the ink — see `ink.ts`.
                            // An unread patch is `--unanalyzed` at 0.4, which is nearly the
                            // ground, so it keeps the chrome's own foreground.
                            fill={c ? inkOf(c) : CHROME_INK}
                            opacity={at.clipped ? 0.6 : 0.85}
                          />
                        ) : null
                      })()}
                    </g>
                  )
                },
              )
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
            // **A handle carries no name.** `fitLabel` will find room for one — a
            // thirteen-pixel stub is deep enough for a radial run at the size floor — and
            // what it produces is six-unit type over a cross-hatch, which is neither
            // readable as a name nor quiet enough to read as a mark. The corner chip names
            // the fold and the hover gives it in full; the shape's whole job here is to be
            // unmistakably not a wedge.
            .filter((w) => !(w.node.kind === 'dir' && collapsed.has(w.node.id)))
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
                ? plateOf(g)
                : {
                    a0: g.a0 + pad,
                    a1: g.a1 - pad,
                    r0: g.r1 + LABEL_GAP,
                    r1: g.r1 + LABEL_GAP + LABEL_BAND,
                  }
              const at = fitLabel(cell, w.node.name, {
                weight: WEIGHT,
                // Off the cell's OWN depth, not off `band`. The two were the same thing
                // while a directory's name had the whole ring to sit in; now the band takes
                // the top of it, and sizing to the ring would set a name too big for the
                // room actually left under it.
                max: isDir ? Math.max(11, Math.min(17, (cell.r1 - cell.r0) * 0.34)) : FILE_MAX,
                // Arc only out here. The rim band is a thin annulus and whatever lies past it
                // belongs to somebody else, so a radial run leaves this file's territory on
                // its first character.
                only: isDir ? undefined : 'arc',
                measure,
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
                  // A directory's plate is now always the structural neutral — its reading
                  // moved to the rim (`DIR_RIM_PX`) — so the ink that used to be derived
                  // from the plate's own stop is the chrome's, which is what an unread
                  // plate already took. One case where there were two.
                  //
                  // **A directory's name is set in the muted ink, not the full one.** It was
                  // `--foreground` at 0.9, which is near-black on a light plate and near-white
                  // on a dark one — the loudest thing available, spent on the label of a
                  // container. It is a name, not a reading: the wedges under it carry the
                  // measurement and the rim carries the distribution, and a heading printed
                  // at full contrast over both competes with the picture it is heading.
                  //
                  // **The ink, let through at a fraction, rather than a quieter ink.**
                  // `--muted-foreground` was tried and is the failure in the other direction:
                  // it is `#8b8279` and the plate is `#d0c9bd`, two steps apart on one warm
                  // grey ramp, so the name and its ground were nearly the same value.
                  //
                  // A fraction of the full ink composites INTO a slate instead of being one —
                  // `#5f5c55` on the light plate, `#adaaa4` on the dark — so the colour comes
                  // from the plate showing through and follows it wherever it goes, which a
                  // chosen third colour cannot. It is the same thing the rim's filenames do
                  // one alpha down, which is why the two read as one family.
                  //
                  // Directories sit a little above files because their ground is darker: the
                  // same alpha over a mid-tone plate lands quieter than over the pane.
                  fill={CHROME_INK}
                  opacity={(isDir ? 0.68 : 0.62) * (at.clipped ? 0.72 : 1)}
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
          {/* **The selection is drawn by taking everything ELSE away.**
           *
           *  It was an outline: a foreground stroke with a background halo under it, sized up
           *  from the wedge so a two-pixel function patch had a mark bigger than itself. It did
           *  not work, and the reason is that an outline competes on the same terms as the
           *  picture it is drawn over — a ring of four thousand wedges is already all edges, and
           *  one more edge somewhere in it is a thing you have to FIND. Making it heavier only
           *  made it a heavier thing to find.
           *
           *  Dimming inverts that. Nothing is added to the picture; the rest of the picture is
           *  removed, and what is left is the only thing at full strength on the screen. It
           *  cannot be missed at any wedge size, which is the property the outline never had at
           *  the size that matters — the sliver you arrive at from the panel's list.
           *
           *  A MASK rather than a redraw of the selected wedge on top of the veil. A redraw
           *  needs the wedge's fill, opacity, cut and pulse class restated in a second place,
           *  and the second copy is the one that goes wrong the next time any of them moves.
           *  Punching a hole leaves the original wedge showing through, painted once.
           *
           *  The veil sits inside the wedge group, so it dims the labels with them — a bright
           *  name on a dimmed ring is the same competition one layer up — and stops short of the
           *  hub, the legend and the tooltip, which are chrome rather than picture. */}
          {(selMark || selCoarse) && (
            /* **One path with a hole in it, not a mask.**
             *
             *  It was a full-screen rect masked by a second copy of the wedge, and a mask is a
             *  compositing operation: the renderer rasterizes its content to a luminance buffer
             *  and multiplies through it. The geometry was never approximate — the hole has
             *  always been `arcPath`, the same call the wedge itself is drawn from — but the
             *  buffer is where a two-pixel patch loses its edges, and this app renders in
             *  WKWebView, where that step is the softest.
             *
             *  We have the shape already, so the hole can be geometry the whole way down:
             *  `evenodd` over one subpath inside another leaves the inner one unfilled. Same
             *  picture, no intermediate buffer, no generated id to keep unique across the second
             *  map an export stages. */
            <path
              className="pointer-events-none"
              d={
                `M ${-1e5} ${-1e5} H ${1e5} V ${1e5} H ${-1e5} Z ` +
                /* A directory gets the SECTOR; a file and a function get their own wedge.
                 See `SECTOR` for why that is not one rule. */
                ((m) => (m.kind === 'dir' ? arcPath(m.a0, m.a1, m.r0, SECTOR) : m.d))(
                  (selMark ?? selCoarse) as unknown as Mark,
                )
              }
              fillRule="evenodd"
              fill="var(--background)"
              opacity={DIM}
            />
          )}
          {/* **And the outline comes back, because dimming alone cannot serve a two-pixel
            patch.** A function is often a sliver, and at that size a lit sliver and a veiled
            one are a few pixels of slightly different colour — the spotlight tells you which
            NEIGHBOURHOOD to look in and then leaves you hunting inside it.
            What killed the outline before was competition: a ring of four thousand wedges is
            already all edges, so one more edge was a thing to find. The veil removes exactly
            that competition, which is what makes the same mark work now. No halo under it any
            more — the dimmed picture is the halo. */}
          {selMark && (
            <path
              className="pointer-events-none"
              d={(selMark as Mark).d}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth={(selMark as Mark).width}
            />
          )}
          {/* Only when the selection itself was not drawn — see `selCoarse`. The hole is its
            deepest drawn ancestor, so the map says "in here"; the dashes stay, because a
            container standing in for its contents must not read as the thing itself. */}
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
          onDoubleClick={
            onUp
              ? (ev) => {
                  ev.stopPropagation()
                  onUp()
                }
              : undefined
          }
          style={onUp ? { cursor: 'zoom-out' } : undefined}
        >
          <circle r={rIn - 4} fill="var(--card)" stroke="var(--border)" />
          <HubCircles
            r={rIn - 4}
            mode={mode}
            gaze={gaze}
            look={circles}
            palette={hubDiscs}
            path={root.path}
            selected={selectedGaze}
            depth={root.path === '' ? 0 : root.path.split('/').length}
          />
          {onUp && <title>Double-click to go up a level</title>}        </g>
      </svg>
  )
}

/** Nothing folded, as one object, so a picture with no folds is not a new layout every time. */
const NONE: ReadonlySet<string> = new Set()

/**
 * Everything a picture of the map at rest is drawn from, stated.
 *
 * **`root` has to be complete for what it will draw.** A file the layout has room to tile needs
 * its functions in `children`: nothing here goes and gets them, and a file without them is
 * drawn solid, which is a different picture that looks like a finished one. See
 * `Report.complete`.
 *
 * The defaults are `Sunburst`'s, so a caller that says nothing draws what the window draws
 * for a reader who has touched nothing.
 */
export interface MapArtProps {
  root: Node
  mode: ColorMode
  ranks?: Map<string, number>
  views?: Views
  rings?: number
  spacing?: Spacing
  rimShare?: number
  markers?: boolean
  /** How many pixels across the picture is laid out for — `Sunburst`'s `density`. Every
   *  threshold that culls a wedge, opens a file or sizes a rim is a pixel size converted
   *  through it (`unitsPerPxFor`). */
  px: number
  sortBy?: ReadonlyMap<string, number>
  replaying?: boolean
  tagNodes?: boolean
  collapsed?: ReadonlySet<string>
  selected?: Node | null
  hover?: Node | null
  /** Width over height of what the picture sits in, which decides how wide a file's fan
   *  opens. */
  aspect?: number
  /** The wedge an open file grew out of, which keeps the fan on its bearing. */
  fileFrom?: Sector | null
  /** Node ids out with a reader. A copy has no stylesheet for the pulse, so a report passes
   *  none. */
  reading?: Set<string>
  circles?: CirclesLook
  /** What names are measured with, in width per pixel of font size — see `Measure`. */
  measure: Measure
  /** Where colour tokens are looked up, for label ink and the hub's circles: a `Resolve`, or a
   *  table of `--name` to `#rrggbb`. What the page is printed on is the caller's to say. */
  ink: Resolve | Readonly<Record<string, string>>
}

const lookupOf = (ink: MapArtProps['ink']): Resolve => {
  if (typeof ink === 'function') return ink
  const table = ink
  return (name) => table[name] ?? null
}

function inputOf(p: MapArtProps, ink: Resolve): MapInput {
  return {
    root: p.root,
    mode: p.mode,
    ranks: p.ranks,
    views: p.views,
    rings: p.rings ?? RINGS_DEFAULT,
    rimShare: p.rimShare ?? 0,
    spacing: p.spacing ?? SPACING_DEFAULT,
    markers: p.markers ?? true,
    unitsPerPx: unitsPerPxFor(p.px),
    sortBy: p.sortBy,
    replaying: p.replaying ?? false,
    collapsed: p.collapsed ?? NONE,
    selected: p.selected ?? null,
    reading: p.reading,
    ink,
  }
}

/** The box a picture at rest is fitted to. Never pinned: that is a replay's, and a replay is
 *  a window. */
const restView = (m: MapModel, p: MapArtProps): View =>
  viewOf({
    target: m.target,
    rootKind: m.root.kind,
    fileFrom: p.fileFrom ?? null,
    paneAspect: p.aspect ?? 1,
    fileIds: m.fileIds,
    morph: false,
    rIn: m.rIn,
  })

function svgPropsOf(p: MapArtProps, m: MapModel, view: View, ink: Resolve): MapSvgProps {
  return {
    m,
    frame: restFrame(m),
    viewBox: viewBoxOf(view),
    fileFrom: p.fileFrom ?? null,
    paneAspect: p.aspect ?? 1,
    hover: p.hover ?? null,
    tagNodes: p.tagNodes ?? false,
    measure: p.measure,
    ink,
    circles: p.circles ?? CIRCLES,
    gaze: null,
    selectedGaze: null,
  }
}

/** The map at rest, as a component: `MapSvg` with nothing in flight and nothing to point at. */
export function MapArt(p: MapArtProps) {
  const ink = lookupOf(p.ink)
  const m = useMapModel(inputOf(p, ink))
  return <MapSvg {...svgPropsOf(p, m, restView(m, p), ink)} />
}

/** The same picture, laid out without a component: the model, its box, and the props `MapSvg`
 *  is drawn with. `mapMarkup` renders from this rather than from `MapArt` so that what it
 *  returns beside the markup comes from the one layout the markup was drawn from. */
export function mapScene(p: MapArtProps): { m: MapModel; view: View; svg: MapSvgProps } {
  const ink = lookupOf(p.ink)
  const m = mapModel(inputOf(p, ink))
  const view = restView(m, p)
  return { m, view, svg: svgPropsOf(p, m, view, ink) }
}

/** Where one tagged wedge is: the path drawn for it, and its arc in radians and user units —
 *  exactly the `d` and `data-arc` `MapSvg` put on it. */
export interface Spot {
  d: string
  a0: number
  a1: number
  r0: number
  r1: number
}

/**
 * Every wedge a tagged picture at rest carries `data-node` on, by the same id.
 *
 * **Walked the way `MapSvg` walks it, not read back off the markup.** The ring's directories
 * and files at their layout geometry, or a file root's cells on its fan; then the function
 * patches tiled inside every file with room for them. Nothing in flight: a frame that is
 * moving tags what is on its way somewhere else, and a report never draws one.
 */
export function spotsOf(m: MapModel, fileFrom: Sector | null, paneAspect: number): Map<string, Spot> {
  const out = new Map<string, Spot>()
  const put = (id: string, g: Arc) =>
    out.set(id, { d: arcPath(g.a0, g.a1, g.r0, g.r1), a0: g.a0, a1: g.a1, r0: g.r0, r1: g.r1 })
  const at = (id: string): Geo => m.target.get(id) ?? { ...NOWHERE }
  if (m.root.kind === 'file') {
    const dest = fanOf(fileFrom, paneAspect)
    // `FileZoom`'s own arithmetic at `t = 1`, rounding included: a lerp that lands is not
    // always bit-for-bit its destination, and the path it draws is the lerp's.
    const live = fileFrom ? lerpSector(fileFrom, dest, 1) : dest
    for (const c of cellsOf(m.root, dest, m.minPatchArea)) put(c.node.id, place(c, dest, live))
  } else {
    for (const w of m.wedges) if (w.node.kind !== 'func') put(w.node.id, at(w.node.id))
  }
  for (const w of m.fileWedges) {
    const tile = m.tilingOf(at(w.node.id))
    if (!tile) continue
    const { r0, r1, fa0, fa1 } = tile
    for (const slot of tileFunctions(w.node.children, r0, r1, fa0, fa1, {
      minPatchArea: m.minPatchArea,
    }))
      put(slot.node.id, slot)
  }
  return out
}
