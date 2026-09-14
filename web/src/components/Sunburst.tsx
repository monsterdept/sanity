import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { trapOf, type AgentCall, type Node } from '../lib/api'
import { clsx } from '../lib/cn'
import {
  colorFor,
  flashPaint,
  histogramsFor,
  REPLAY,
  type Slice,
  type Views,
  type ColorMode,
  paintsFromReadings,
} from '../lib/colorMode'
import { unreadable } from '../lib/api'
import { CHROME_INK, PAPER } from '../lib/ink'
import { arcPath, layout, tileFunctions, type Wedge } from '../lib/sunburst'
import { RINGS_DEFAULT } from '../lib/rings'
import { SPACING_DEFAULT, type Spacing } from '../lib/spacing'
import { rimRuns as runsOf } from '../lib/rim'
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
import { fitLabel, widthPerPx } from '../lib/label'
import { FAMILY, TRACKING, WEIGHT } from '../lib/labelStyle'
import { StaleHatch } from './StaleHatch'
import { WedgeTip } from './WedgeTip'
import { AgentMascot } from './AgentMascot'
import { BalanceWheel } from './BalanceWheel'
import { HubEye } from './HubEye'
import { HubCircles } from './HubCircles'
import { lightnessOf } from '../lib/ink'
import { CIRCLES, type CirclesLook, type HubCenter } from '../lib/hub'
import type { MascotState } from './MascotFigure'

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

/** `n` out of `of`, as a share, for the corner chip — or nothing when there is no `of`.
 *
 *  **Precision follows the value, because one fixed width is wrong at both ends.** Two
 *  decimals everywhere prints `92.30%`, which reads as a measurement to the hundredth that
 *  nobody took; none at all prints `0%` for fifteen thousand files, which is worse than
 *  silence because it is a confident nothing. So the digits appear where they carry the
 *  meaning and stop where they stop.
 *
 *  A share that would round away entirely is printed as `<0.01%` rather than `0.00%`: the
 *  finding at that size is that it is small, and rounding a real count to zero is the same
 *  lie the empty-tally case is. And an unknown denominator prints NOTHING — a bare count is
 *  incomplete, where a count beside a share of an unknown whole is wrong. */
/** `n` things, with its share of whatever it is a share OF.
 *
 *  The three clauses in this chip have three different denominators — files that look like
 *  source, files the map holds, directories — and the counts are not comparable across them.
 *  Naming each whole on screen was tried and is not worth its width: a percentage beside a
 *  count is enough to read, and the chip is a caveat rather than a table. */
function outOf(n: number, of: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}${share(n, of)}`
}

function share(n: number, of: number): string {
  if (of <= 0) return ''
  const p = (n / of) * 100
  if (p > 0 && p < 0.01) return ' (<0.01%)'
  return ` (${p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2)}%)`
}

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

/** How far below a curve a baseline has to sit for the glyphs on it to straddle the curve,
 *  as a fraction of the type size.
 *
 *  **The offset is in the PATH, because neither way of asking for it works.** Text on a
 *  `textPath` sets its baseline on the path and grows upward from there, so digits laid on a
 *  band's centre line ride the band's top edge with the whole thickness empty underneath.
 *  `dominant-baseline` is not honoured on a `textPath` in this engine and neither is `dy` —
 *  both were tried on screen and both drew the number exactly where it had been. So the text
 *  runs on its own arc, struck at a different radius from the band it belongs to: glyphs grow
 *  away from their baseline, and "away" is outward at the top of a circle and inward at the
 *  bottom, which is why the two offsets have opposite signs.
 *
 *  0.34 is half the cap height of this face at any size — the same figure the upright badges
 *  got from `align-items: center`, arrived at by arithmetic because a curve has no box to
 *  centre in. */
/** What the dial is painted when nobody has said otherwise.
 *
 *  The app's notify red, as a literal: the badge takes a colour rather than a token now, and
 *  a default that read a custom property would be the one value in this control that could
 *  not come back out of the picker it is set in. */
const DIAL_COLOR = '#e65546'

/** The line round the found bar.
 *
 *  **Darker than the fill, all the way round, the way a macOS badge is built.** A sheen was
 *  tried first — the lighter colour graded along the outer edge, as light falling on an
 *  enamel marking — and it is the wrong model: a notification badge is not lit from
 *  somewhere, it is a flat chip with an edge, and the edge is what lifts it off whatever it
 *  is sitting on rather than a gradient across its face.
 *
 *  It also does a job the sheen could not. The hub sits over the innermost wedges, which are
 *  whatever colour the lens is painting; a shape with no edge borrows the ground behind it,
 *  which is the failure every other badge in this file wears a ring against. */
const DIAL_EDGE = '#da4a3b'

/** The found count is set in paper, always.
 *
 *  **Not `inkOnHex`, which is what this was.** That picks whichever of paper and ink reads
 *  better on the fill, and it is the right answer for a colour nobody chose — but a dial's
 *  markings are printed in one ink, and a number that flipped to black when somebody nudged
 *  the picker a shade lighter would read as a bug in the picker. The cost is real and worth
 *  stating: pick a pale enough colour and the count goes faint. The picker is where that is
 *  visible, immediately, which is the same argument that put the picker in the bar. */

/** How square the dial's bars are: a fraction of half their thickness, where 1 is a stadium
 *  and 0 a plain sector.
 *
 *  **A slider while it was being chosen, a constant now.** Fully round read as two lozenges
 *  stuck on the dial and fully square as two cuts out of it; a third of the way is where the
 *  bar stops being either and starts being a marking. The control is gone the way the badge's
 *  shape and the spacing menu went — a bar that keeps offering a settled question costs every
 *  reader a decision they have no basis to make. */
const DIAL_CORNER = 0.35

/** The dial's proportions, all struck off the type size rather than off the box.
 *
 *  `PAD_H` is the ground before and after the digits; `PAD_V` is how much taller the bar is
 *  than the type standing in it; `LABEL` is the words' size as a fraction of the numbers'.
 *  The last of those was two constants with two floors before, and the floors bit at
 *  different sizes — so the label came out at 78% of the number where the fractions intended
 *  60%, and the intended proportion never happened at any hub this app draws. */
const DIAL_PAD_H = 0.65
const DIAL_PAD_V = 1.35
const DIAL_LABEL = 0.84
/** Ground between the markings and the dial's edge, in type sizes. */
const DIAL_INSET = 1.1
/** How much of its box the creature takes while the dial is round it. */
const DIAL_MASCOT = 0.75

const ON_CURVE = 0.34

/** A sector of an annulus with rounded corners.
 *
 *  **A filled path rather than a stroked arc with a line cap.** A cap gives two answers —
 *  round or square — and the corner radius is a setting with a middle. It also hangs half a
 *  thickness past each end of its path, so a capped bar is never the length its geometry
 *  says, which cost this badge two rounds of the number sitting off-centre and a word half
 *  under its neighbour.
 *
 *  Traversed once around the boundary: out along the leading face, back along the outer arc,
 *  in along the trailing face, forward along the inner arc. Every corner is convex, so they
 *  all take the same sweep; the inner arc runs against the outer one because a boundary
 *  walked in one direction crosses its own inside backwards. */
function sectorPath(
  cx: number,
  cy: number,
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  k: number,
): string {
  const at = (deg: number, radius: number) => {
    const a = (deg * Math.PI) / 180
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const
  }
  const deg = (px: number, radius: number) => ((px / radius) * 180) / Math.PI
  // Never more than the shape can hold: half its thickness, and half its span at the tighter
  // of its two radii. A radius larger than either draws a path that crosses itself.
  const room = Math.min((r1 - r0) / 2, ((((a1 - a0) * Math.PI) / 180) * r0) / 2)
  const c = Math.max(0, Math.min(k, room))
  if (c <= 0.01) {
    const [ax, ay] = at(a1, r1)
    const [bx, by] = at(a0, r1)
    const [dx, dy] = at(a0, r0)
    const [ex, ey] = at(a1, r0)
    return `M ${ax} ${ay} A ${r1} ${r1} 0 0 1 ${bx} ${by} L ${dx} ${dy} A ${r0} ${r0} 0 0 0 ${ex} ${ey} Z`
  }
  const ko = deg(c, r1)
  const ki = deg(c, r0)
  const P = (d: number, r: number) => at(d, r).join(' ')
  return [
    `M ${P(a1 - ko, r1)}`,
    `A ${r1} ${r1} 0 0 1 ${P(a0 + ko, r1)}`,
    `A ${c} ${c} 0 0 1 ${P(a0, r1 - c)}`,
    `L ${P(a0, r0 + c)}`,
    `A ${c} ${c} 0 0 1 ${P(a0 + ki, r0)}`,
    `A ${r0} ${r0} 0 0 0 ${P(a1 - ki, r0)}`,
    `A ${c} ${c} 0 0 1 ${P(a1, r0 + c)}`,
    `L ${P(a1, r1 - c)}`,
    `A ${c} ${c} 0 0 1 ${P(a1 - ko, r1)}`,
    'Z',
  ].join(' ')
}

/** How many findings are standing, drawn on the creature as a watch dial.
 *
 *  **One shape, chosen by looking.** Six were built and offered in the toolbar while the
 *  question was open — a disc on the shoulder, a band over the head, a curved bar with round
 *  ends and one with square ends, an aperture at three o'clock, and a plinth under the feet.
 *  The dial won and the other five are gone; what they were for is worth keeping, because
 *  each lost for a reason that still applies:
 *
 *  - the plain disc and the aperture both put the number where the creature already is, and
 *    the creature had to shrink to make room for a badge stuck on top of it;
 *  - the band over the head and the shoulder bar carry one number and there are two to say;
 *  - the plinth reads as a pedestal, which is a claim about the creature rather than about
 *    the repo.
 *
 *  The dial is the only one where the count has somewhere of its own to be — the hub is
 *  already a dark disc with a figure at its centre — and the only one with room for the
 *  second number that gives the first one a denominator.
 *
 *  `pointer-events: none`: the CLICK is the whole creature's, one level up. This is the thing
 *  being pointed at, not the target. */
function FindingBadge({
  layer,
  box,
  count,
  rules,
  onFound,
  onRules,
}: {
  /** Which side of the creature this sits on. */
  layer: number
  /** The side of the mascot's box, in screen pixels. Everything here is a fraction of it, so
   *  the dial holds its relationship to the creature as the hub grows and shrinks with the
   *  ring count. */
  box: number
  count: number
  /** How many rules are running here — the number at six o'clock, and the denominator the
   *  one at twelve is missing without it. */
  rules: number
  /** Open the findings tab, from the half of the dial at twelve. */
  onFound?: () => void
  /** Open the rules tab, from the half at six. */
  onRules?: () => void
}) {
  // `7` is a dot with a number in it and `1.2k` is a pill, rather than either being stretched
  // to the other's shape. 15,777 is a baseline, not a notification — but the archive makes
  // this drainable, so it is worth printing.
  const text = count > 999 ? `${Math.round(count / 100) / 10}k` : String(count)
  const ruleText = String(rules)
  const pathId = useId()
    /** **The dial: a count at twelve, a count at six, each named beside it.**
     *
     *  `FINDINGS 54` over the top and `16 RULES` under the bottom, with both numbers on the
     *  vertical axis where the eye already expects a dial's markings to be. The words flank
     *  them on the outside — left of the top one, right of the bottom one — so the pair reads
     *  outward from the axis in both directions and the assembly is symmetrical about it.
     *
     *  **The second number is what the first one was measured BY.** A count with no idea how
     *  many questions produced it is a number with no denominator; fifty-four findings from
     *  sixteen rules is a different fact from fifty-four out of three, and the rules grid is
     *  one click away behind the same creature. */
    /** **The type is the unit, and the bar is measured off it.** It was the other way round —
     *  a thickness struck off the box, with the type struck off the thickness — which made
     *  every padding a fraction of a fraction and left no single number meaning "how much
     *  ground round the digits". Same geometry at the defaults; the difference is that the
     *  two paddings are now the two numbers they always were. */
    const font = Math.max(8, box * 0.096)
    // Vertical padding: how much taller the bar is than the type standing in it.
    const thick = font * DIAL_PAD_V
    const cx = box / 2
    const cy = box * 0.5
    const disc = box * (R_INNER / HUB_MASCOT)
    // Clear of the disc's edge rather than against it: at nothing it read as a bar stuck to
    // the rim, and the markings are meant to sit inside that. In type sizes like everything
    // else here, so it holds its look if the dial is ever drawn bigger.
    const r = disc - thick / 2 - font * DIAL_INSET
    /** **Off the number, not off the box.** It was its own fraction of `box` with its own
     *  floor, which is two constants where there is one relationship — and the floors bit at
     *  different sizes, so the label came out at 78% of the number where the fractions
     *  intended 60%. The floor was doing the sizing, not the ratio, and the intended
     *  proportion never happened at any hub this app draws.
     *
     *  One floor, on the pair: whichever of the two is smaller is the one that has to stay
     *  legible, and holding the ratio through it keeps the label a label. */
    const capFont = font * DIAL_LABEL
    /** **One face for the whole dial** — the one every filename on the rim is set in.
     *
     *  It was two: the words in `LINE Seed JP` and the digits still in the mono face they had
     *  when the words were mono too. That is two typefaces inside one phrase, `found 49`, and
     *  it was left over rather than chosen. A dial can defend numerals of their own — mono
     *  keeps a count from changing width as it ticks — but nothing here is ticking, and the
     *  map has one voice.
     *
     *  Measured the same way as well as drawn the same way, which is the part that matters:
     *  a `0.62` advance is true of every glyph in a mono face and of none in a proportional
     *  one, so both the words and the digits are measured with `widthPerPx` against the real
     *  face — the same function the rim's own labels are laid out with. */
    const words = { found: 'found', rules: 'rules' }
    const at = (deg: number, radius = r) => {
      const a = (deg * Math.PI) / 180
      return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const
    }
    const deg = (px: number) => ((px / r) * 180) / Math.PI

    /** A bar, measured. The path is exactly the digits — the round caps hang half a
     *  thickness past each end and that overhang IS the padding. `seen` is the half-width of
     *  what is drawn, caps included, which is what the words have to clear. */
    const barOf = (txt: string) => {
      // **The bar is exactly its span.** It was a stroked arc with a round cap, which hangs
      // half a thickness past each end of its path — so the shape drawn was never the shape
      // the geometry described, and the padding had to be reasoned about twice. A filled
      // sector spans its two angles and nothing more, so `seen` is just the half-width.
      const half = deg((widthPerPx(txt, WEIGHT) * font + font * DIAL_PAD_H) / 2)
      return { half, seen: half }
    }
    /** A word, twice: the advance the path must be long enough for, and the ink you can see,
     *  which is one letter-space shorter because tracking advances after the last glyph too.
     *  Centring a `textPath` centres the advance, so the two differ by half that. */
    const wordOf = (w: string, radius: number) => {
      const path = widthPerPx(w, WEIGHT) * capFont + w.length * capFont * TRACKING
      const at_ = (px: number) => ((px / radius) * 180) / Math.PI
      return { pathHalf: at_(path / 2), inkHalf: at_((path - capFont * TRACKING) / 2) }
    }

    // Baselines. Glyphs grow away from the baseline, and "away" is outward at the top of the
    // circle and inward at the bottom — so the two offsets have opposite signs. See `ON_CURVE`.
    const upBase = (font_: number) => r - font_ * ON_CURVE
    const downBase = (font_: number) => r + font_ * ON_CURVE

    const top = barOf(text)
    const bottom = barOf(ruleText)
    /** **Every angle is struck at the radius it lives on.**
     *
     *  The two words are not on the bars' circle — one sits inside it and the other outside,
     *  because a baseline is below its type and "below" swaps sides between twelve and six.
     *  A gap converted once at the bars' radius therefore came out as two different distances
     *  on screen: the top word, on the smaller circle, ended up visibly tighter against its
     *  bar than the bottom one. The same millimetres of ground subtend a bigger angle on a
     *  smaller circle, and the conversion has to know which circle it is on. */
    /** **`FOUND`, not `FINDINGS`.**
     *
     *  Round the dial it reads `FOUND 54 … 16 RULES`, which is a sentence: sixteen rules found
     *  fifty-four things. `FINDINGS 54` was a label with a value after it while the bottom was
     *  a value with a noun after it — two grammars on one dial, which is most of why the top
     *  half felt wrong when the bottom did not.
     *
     *  Not `ALERTS`, which is the one option that would break something. Nothing here knows
     *  anything is wrong: it knows a reader was surprised, that git has a date, that the parse
     *  counted callers. The panel says findings rather than issues for exactly that reason,
     *  and a word meaning "somebody must act" on the dial would claim a confidence nothing
     *  upstream of it has got. `REVIEW` has the opposite problem — it names a workflow this is
     *  not, and code review is a thing this app sits next to. */
    const finds = wordOf(words.found, upBase(capFont))
    const named = wordOf(words.rules, downBase(capFont))
    const gapPx = capFont * 0.45
    const gapTop = ((gapPx / upBase(capFont)) * 180) / Math.PI
    const gapBottom = ((gapPx / downBase(capFont)) * 180) / Math.PI

    /** An arc as two endpoints and a sweep, in the direction its text has to be read.
     *
     *  Over the top the reader is inside the curve and the run goes clockwise — decreasing
     *  angle, sweep 1. Under the bottom they are outside it and everything inverts: the run
     *  goes counter-clockwise, sweep 0, which is still left to right on screen. */
    const arc = (mid: number, half: number, radius: number, up: boolean) => {
      const [ax, ay] = at(up ? mid + half : mid - half, radius)
      const [bx, by] = at(up ? mid - half : mid + half, radius)
      return `M ${ax} ${ay} A ${radius} ${radius} 0 0 ${up ? 1 : 0} ${bx} ${by}`
    }

    // **Both ends turn by the same amount, so the axis turns rather than the badges.** The
    // two lines are one object; rotating them apart would make the dial say there are two
    // unrelated things on it. Clockwise on screen is a decreasing angle here.
    const TOP = 90
    const BOTTOM = 270
    // The word sits outside the bar, away from the axis: left of the top one, right of the
    // bottom one — which is the larger angle in both cases.
    /** **Which of the two things is on the axis: the number, or the pair.**
     *
     *  A dial's markings sit on its axis, and there are two readings of what the marking IS.
     *  The number alone is one — twelve o'clock is where the count is, and the word hangs off
     *  it like a caption. `FOUND 54` as one object is the other, and then the axis runs
     *  through the middle of the phrase rather than through the figure.
     *
     *  Both are defensible and they look different enough to be worth a switch. The shift is
     *  computed per side, because the two words are different lengths: half the ground the
     *  word and its gap take, moved back the way the word went. */
    const shiftTop = -(gapTop + 2 * finds.inkHalf) / 2
    const shiftBottom = -(gapBottom + 2 * named.inkHalf) / 2
    const topMid = TOP + shiftTop
    const bottomMid = BOTTOM + shiftBottom
    const findsInk = topMid + top.seen + gapTop + finds.inkHalf
    const namedInk = bottomMid + bottom.seen + gapBottom + named.inkHalf
    // The ink starts at the path's leading end, so the path's own centre is half a
    // letter-space further along it — which is a smaller angle going clockwise and a larger
    // one going the other way.
    const findsMid = findsInk - (finds.pathHalf - finds.inkHalf)
    const namedMid = namedInk + (named.pathHalf - named.inkHalf)

    /** **Only one of the two numbers is a notification.**
     *
     *  The findings count is something to go and do, and it wears the app's notify red. The
     *  rules count is not: nothing is asked of anybody by "sixteen rules are running", and
     *  painting it the same colour made the dial say there were two alarms on it. It is
     *  context, and it is set the way a watch sets its subdial — printed on the plate rather
     *  than lit, in the dial's own value a few steps off the ground.
     *
     *  A `color-mix` off `--foreground` rather than a token of its own: it has to be a lift
     *  off whatever the hub is sitting on in both themes, and the two thirds of a token that
     *  would be spent saying "a bit lighter than the ground" is what the mix already says. */
    const plate = 'color-mix(in oklch, var(--foreground) 20%, transparent)'
    const k = (DIAL_CORNER * thick) / 2
    const bar = (mid: number, half: number, fill: string, line?: string) => (
      <path
        d={sectorPath(cx, cy, mid - half, mid + half, r - thick / 2, r + thick / 2, k)}
        fill={fill}
        stroke={line}
        // A hairline in the map's own units, so it stays a hairline at every zoom rather
        // than growing into a border on a big window.
        strokeWidth={line ? thick * 0.09 : undefined}
      />
    )
    /** **Each half of the dial is a door to its own tab.** The dial is drawn click-through, and
     *  these are the exceptions: a transparent band over each bar and its word, a little wider
     *  than both, that takes the click and keeps it. A double-click stops here too, so a quick
     *  pair on a count opens a tab rather than also going up a level. */
    const hit = (a0: number, a1: number, go: () => void, label: string) => (
      <path
        d={sectorPath(cx, cy, a0 - deg(font * 0.3), a1 + deg(font * 0.3), r - thick, r + thick, 0)}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'pointer' }}
        onClick={(ev) => {
          ev.stopPropagation()
          go()
        }}
        onDoubleClick={(ev) => ev.stopPropagation()}
      >
        <title>{label}</title>
      </path>
    )
    /** id, path, size, and the ink it is set in. */
    const runs: Array<[string, string, number, string]> = [
      [`${pathId}-t`, arc(topMid, top.half, upBase(font), true), font, PAPER],
      [
        `${pathId}-b`,
        arc(bottomMid, bottom.half, downBase(font), false),
        font,
        'var(--foreground)',
      ],
      [
        `${pathId}-tw`,
        arc(findsMid, finds.pathHalf, upBase(capFont), true),
        capFont,
        'var(--muted-foreground)',
      ],
      [
        `${pathId}-bw`,
        arc(namedMid, named.pathHalf, downBase(capFont), false),
        capFont,
        'var(--muted-foreground)',
      ],
    ]

    return (
      <svg
        aria-hidden
        className="absolute left-0 top-0"
        width={box}
        height={box}
        style={{ pointerEvents: 'none', overflow: 'visible', zIndex: layer }}
      >
        <defs>
          {runs.map(([id, d]) => (
            <path key={id} id={id} d={d} />
          ))}
        </defs>
        {bar(topMid, top.half, DIAL_COLOR, DIAL_EDGE)}
        {bar(bottomMid, bottom.half, plate)}
        {runs.map(([id, , size, ink]) => {
          // The two words are tracked and light; the two numbers are not. A name says what
          // the figure beside it is and then gets out of its way, which is what the spacing
          // is for — at this size letter-spacing is what makes small caps read as a label
          // rather than as shouting.
          const word = id.endsWith('w')
          return (
          <text
            key={`t-${id}`}
            className={undefined}
            textAnchor="middle"
            style={{
              fontFamily: FAMILY,
              fontSize: size,
              // The numbers a step heavier than the words beside them: same face, and the
              // count still has to win.
              fontWeight: word ? WEIGHT : 600,
              letterSpacing: size * TRACKING,
              fill: ink,
            }}
          >
            <textPath href={`#${id}`} startOffset="50%">
              {id.endsWith('-t')
                ? text
                : id.endsWith('-b')
                  ? ruleText
                  : id.endsWith('-tw')
                    ? words.found
                    : words.rules}
            </textPath>
          </text>
          )
        })}
        {onFound && hit(topMid - top.half, findsInk + finds.inkHalf, onFound, 'Open the findings')}
        {onRules && hit(bottomMid - bottom.half, namedInk + named.inkHalf, onRules, 'Open the rules')}
      </svg>
    )
}


function SunburstView({
  root,
  // **Bumped once when the webfont lands, and read by nothing.** Every label here is placed
  // against a measured advance, and until the face arrives those measurements are the
  // fallback's. `memo` would otherwise hold the fallback geometry on screen for as long as
  // nothing else changed — which is how `found 67` stayed painted as `ound 67`.
  faceRev: _faceRev = 0,
  selected,
  onSelect,
  onDrill,
  onClear,
  reading,
  mode,
  ranks,
  views,
  onUp,
  mascot,
  morph,
  replaying = false,
  sortBy,
  density,
  onSide,
  rings = RINGS_DEFAULT,
  rimShare = 0,
  spacing = SPACING_DEFAULT,
  markers = true,
  tagNodes = false,
  center = 'monster',
  wheelHz = 1,
  circles = CIRCLES.initial,
  onWantRings,
}: {
  root: Node
  /** See the destructuring above — a redraw signal, deliberately unused. */
  faceRev?: number
  selected: Node | null
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
  onClear: () => void
  mode: ColorMode
  ranks?: Map<string, number>
  /** How Age is calibrated and which of its two dates it paints — see `AgeView`. Comes from the whole tree, not from `root`,
   *  so drilling into a directory does not recalibrate the colors on the way in. */
  views?: Views
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
  mascot?: {
    events: AgentCall[]
    state: MascotState
    project?: string | null
    remint?: number
    /** How many findings are standing — found, and not set aside. `0` draws nothing.
     *
     *  **A count is honest here because the archive makes it drainable.** Before dismissals
     *  existed the only number available was the total, and ceph's four thousand is a
     *  baseline rather than a notification; what a person can work down to nothing is worth
     *  printing. See `docs/notes/findings.md`. */
    findings?: number
    /** Open the findings panel. **On the badge, never on the creature** — the mascot's single
     *  clicks are already spoken for (six of them remint it, and the hub underneath means go
     *  up a level), so a click handler on the figure would fire on the first click of a
     *  gesture and open a panel in the middle of it. */
    onFindings?: (view?: 'findings' | 'rules') => void
    /** How many rules are running here — the second number on the `label` badge. */
    rules?: number
  }
  /** Ease the rings toward the shape they are given, instead of taking it.
   *
   *  On for the history replay, which is where a tree arrives that is neither a new level
   *  nor the same picture — see `MORPH_TAU_MS`. Off for the live map: a rescan or a landed
   *  reading changes wedges too, and sliding them under somebody who is reading the map is
   *  a different decision from smoothing a replay they asked to watch. */
  morph?: boolean
  /** A replay is on screen, so a function with no reading AT THIS COMMIT is drawn as unread
   *  rather than as nothing — see where the hatch is applied. Separate from `morph`, which
   *  happens to be true at the same times: one is about easing geometry and this is about
   *  what an absent reading means, and a prop that means two things is one that gets passed
   *  for the wrong reason later. */
  replaying?: boolean
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
  /** How many rings to draw. See `RINGS_DEFAULT`; the reader chooses, within
   *  `RINGS_RANGE`. */
  rings?: number
  /** How far the directory rim is grown toward filling its whole ring, 0..1. A fifth by
   *  default — see `App`, and the paragraph below for why the number is not a taste call.
   *
   *  Zero is what it has always been: `DIR_RIM_PX`, a few pixels on the edge a directory
   *  shares with its contents, which is too little now that the rim carries a distribution
   *  rather than a colour — a container's four bands drawn where nobody reads, with its flat
   *  mean filling the space behind them.
   *
   *  **One is worse, and for a reason that is about encoding rather than taste.** The rim is a
   *  stacked bar bent around a circle: what it says is carried by ARC LENGTH, each segment
   *  against the whole, and it is a proportion. This map's own primary encoding is already
   *  area — width is lines — so area is spoken for. Grow the rim to the whole band and its
   *  segments stop being lengths and become large two-dimensional regions, which the eye reads
   *  as area, which is the other encoding. The reading turns from *what share of this directory
   *  is knotty* into *how much knotty stuff is in here*, and nothing on screen says it changed.
   *
   *  A fifth keeps it unmistakably a bar — one dimension carrying the value — and unmistakably
   *  a summary of the wedge it sits on rather than a thing with a size of its own. */
  rimShare?: number
  /** The reader's three geometry tweaks — the frame around a directory's band, the cut
   *  between two neighbours, and the gutter between two levels. See `lib/spacing.ts` for why
   *  each of them is a control, and `DIR_RIM_INSET_PX`, `CUT` and `RING_GAP` below for what
   *  the defaults they scale are FOR — the sliders move those numbers, they do not replace
   *  the arguments for them. */
  spacing?: Spacing
  /** Whether a directory's rim carries the pointing marks — see `dots`.
   *
   *  Only Traps and Clones put anything there, and this is only ever offered on those two:
   *  a switch for marks that cannot exist is an inert control, which is the argument
   *  `ColorCount` is made of. Off, the rim falls through to what every other lens draws on
   *  it, so the picture underneath the dots is legible without them — which is the whole
   *  point of being able to turn them off, since a dot is opaque and a dense directory
   *  wears a dotted line across the band it is trying to show you.
   *
   *  It does not touch the marks on the things THEMSELVES: a trapped function still pulses
   *  and a clone still wears its colour. Those are the reading; these are the pointer to
   *  where the reading is. */
  markers?: boolean
  /** Put each wedge's node id and arc on its path, as `data-node` and `data-arc`.
   *
   *  **For a report, which has to point at wedges it did not draw.** The findings page marks
   *  where each finding is on a copy of this picture, and the one thing that knows where a node
   *  landed is the path that was drawn for it. Off otherwise: thousands of attribute strings
   *  per render for a question only an export asks. */
  tagNodes?: boolean
  /** What the hub holds — see `lib/hub.ts`. Anything but `monster` takes the creature out of
   *  its layer and keeps the layer, which carries the findings count and its click. */
  center?: HubCenter
  /** The balance wheel's speed, in full swings a second — see `WHEEL_HZ`. */
  wheelHz?: number
  /** The circles' shadow and the dot's travel — see `CirclesLook`. */
  circles?: CirclesLook
  /** Which files the map has somewhere to draw the insides of.
   *
   *  A file's ring of functions is fetched on demand, and the window decided which by a
   *  share of the focused subtree's lines — a stand-in for "is this wedge big enough to
   *  show an inside", chosen because the window cannot see the map. On a repo the size of
   *  kibana a quarter of a per cent is ten thousand lines, so it refused nearly every file
   *  in the repo and the outer band was empty however the map was drawn.
   *
   *  So the map answers it, which is where the answer has always been: these are the files
   *  whose wedge can actually hold a tiling, by the same test that draws one. Reported
   *  rather than fetched here — the ring belongs to the window's tree, and the component
   *  that draws a picture should not also be the thing that goes and gets it. */
  onWantRings?: (paths: readonly string[]) => void
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
  const hubMascot = useRef<HTMLDivElement>(null)
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
      // **Placed here as well as in the frame loop.** An observer callback runs before the
      // paint that the resize causes, so the creature moves on the same frame as the wedges;
      // waiting for the state below to come back through a render puts it one frame behind
      // for every frame of a drag, which is the hub stuttering inside a smooth map.
      place.current(width, height)
      setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
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

  const radiusAt = useMemo(() => {
    const band = (R_OUTER - rIn) / Math.max(1, rings)
    return (d: number) => rIn + band * (d - 0.5)
  }, [rings, rIn])

  const minAngleAt = useMemo(() => {
    if (unitsPerPx === null) return undefined
    const arc = MIN_ARC_PX * unitsPerPx
    return (d: number) => arc / radiusAt(d)
  }, [unitsPerPx, radiusAt])

  /** How wide a folded directory's handle is, per ring — see `LayoutOpts.handleAngleAt`.
   *  Stated in pixels for the reason every threshold here is: what makes a handle work is
   *  that it can be seen and hit, and neither is a fact about user units. */
  const handleAngleAt = useMemo(() => {
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
  const hover = hoverNode ? { node: hoverNode, ...pos } : null
  /** Directories folded shut by clicking them. A view concern, so it lives here rather
   *  than in the app's drill stack — and it survives drilling, so a directory you closed
   *  stays closed when you come back past it. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  /** Everything under the focus, at any depth — the denominator the corner chip needs.
   *
   *  Its own walk because `layout` has a different job and a different reach: that one stops
   *  at `maxDepth`, since a node past the last ring is neither drawn nor culled, so a total
   *  taken from it would omit exactly the deep tail that makes a share worth printing.
   *
   *  The root itself is not a directory of its own here: it is the thing the share is ABOUT,
   *  and counting it would make a repo with no subdirectories report one. */
  const under = useMemo(() => {
    const n = { files: 0, dirs: 0 }
    const walk = (x: Node) => {
      if (x.kind === 'file') n.files += 1
      else if (x.kind === 'dir') n.dirs += 1
      x.children.forEach(walk)
    }
    root.children.forEach(walk)
    return n
  }, [root])

  const { wedges, hidden } = useMemo(
    () => layout(root, rings, { collapsed, minAngleAt, handleAngleAt, sortBy }),
    [root, rings, collapsed, minAngleAt, handleAngleAt, sortBy],
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
  const fileWedges = useMemo<Wedge[]>(() => wedges.filter((w) => w.node.kind === 'file'), [wedges])

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
  /** A fold is being eased, which is the chase running for a reason that is not a replay.
   *
   *  Folding hands a subtree's angle to its siblings, so one ⌥-click re-proportions every
   *  wedge in the ring and everything under them. Applied instantly that is the whole map
   *  jumping — the same hard cut `zoom.ts` was written to remove from level changes, and
   *  worse here, because nothing about a fold tells you where anything went.
   *
   *  It rides the chase rather than growing a second animator: the machinery for "the shape
   *  changed under the picture, walk it there" already exists for the replay, and a fold is
   *  exactly that. What it must not do is turn on the things `morph` ALSO gates — the box is
   *  pinned to the nominal circle during a replay, and a fold has no business moving the
   *  camera. So the chase is gated on `chasing` and everything else stays on `morph`. */
  const [folding, setFolding] = useState(false)
  const chasing = !!morph || folding
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
  const band = (R_OUTER - rIn) / structDepth
  const hubName = elide(root.name, HUB_FITS)

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
  const drawnDirs = useMemo(() => {
    const ids = new Set<string>()
    for (const w of wedges) if (w.node.kind === 'dir') ids.add(w.node.id)
    return ids
  }, [wedges])

  const hist = useMemo(
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

  const fills = useMemo(() => {
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
  const hubDiscs = useMemo(() => {
    if (center !== 'circles') return null
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
      const [dark, light] = (lightnessOf(a) ?? 0) <= (lightnessOf(b) ?? 0) ? [a, b] : [b, a]
      pair = { outer: `var(${dark})`, inner: `var(${light})` }
    }
    // Every colour, most area first, for the circle a level adds — see `nest` in `HubCircles`.
    return { ranked: ranked.map((t) => `var(${t})`), pair }
  }, [center, wedges, fills, root.id, mode, ranks, views])

  /** Which way the clicked wedge is from the hub, for the circles' dot to look at — y up, like
   *  `gaze`. When the wedge itself is not drawn, the nearest drawn wedge that holds it, which
   *  is where it is on screen. Null for the level itself, which is all around the hub. */
  const selectedGaze = useMemo(() => {
    if (center !== 'circles' || !selected || selected.id === root.id) return null
    let best: (typeof wedges)[number] | null = null
    for (const w of wedges) {
      if (w.node.id === root.id) continue
      if (w.node.id === selected.id) {
        best = w
        break
      }
      const holds = w.node.path === selected.path || selected.path.startsWith(`${w.node.path}/`)
      if (holds && w.node.kind !== 'func' && (!best || w.node.path.length > best.node.path.length)) best = w
    }
    if (!best) return null
    const mid = (best.a0 + best.a1) / 2
    return { x: Math.sin(mid), y: Math.cos(mid) }
  }, [center, selected, wedges, root.id])

  /** The cut between two neighbouring wedges, at the reader's scale — `CUT` is the argued
   *  shape and this is where it is spent. The three stay in proportion because one multiplier
   *  moves all of them; see `lib/spacing.ts` for why that is not a convenience. */
  const cuts = useMemo(
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
  const rim = useMemo(() => {
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

  /** A directory's paint as a band on its outer edge — see `DIR_RIM_PX` for why a
   *  directory does not get a fill. Returns null for every other kind, so a caller can
   *  hand it whatever it is about to draw and let the rule live in one place; that is
   *  what keeps the transitions from blooming a full-plate colour for half a second on
   *  the way in and out.
   *
   *  Cut from its plate by a background stroke, the same way every other pair of surfaces
   *  here is separated, and it takes no pointer events — the plate underneath is still
   *  the thing being hovered and clicked. */
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

  const target = useMemo(
    () => geoOf(wedges, rIn, band, () => ringGap),
    [wedges, band, ringGap, rIn],
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
    const hub = hubGeo(rIn)
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
      .filter((w) => !target.has(w.node.id) && was.has(w.node.id) && w.node.id !== root.id)
      .map((w) => ({
        node: w.node,
        depth: w.depth,
        index: w.index,
        from: was.get(w.node.id) as Geo,
        to: exitTo(was.get(w.node.id) as Geo, dir.current, rIn, R_OUTER),
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
    if (!chasing) {
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
      // A fold's chase stops when it arrives; a replay's does not — see the note above on
      // why the loop is not re-armed per change. Clearing the flag unconditionally is safe
      // for both: `chasing` is an OR, so a replay goes on running on `morph` alone, and a
      // fold that happened DURING a replay would otherwise leave the flag set and the chase
      // running over the live map long after the replay ended. React bails out on an
      // unchanged value, so the common case is not a re-render.
      else setFolding(false)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [chasing, morph])

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
  //
  // **A fold seeds from the opposite side, and it has to.** Priming from `target` is right
  // when the chase turns on because the PICTURE is about to start changing — pressing
  // History, where the target is already a different tree and morphing the live map into
  // the replay's first frame would be an animation nobody asked for. A fold is the other
  // case: the target changed in the very render the chase turned on, so seeding from it
  // means the wedges are already where they are going and one ⌥-click eases nothing at all.
  // `live.current` still holds the previous frame here — it is rewritten further down this
  // render — which is exactly the picture the fold has to move away from.
  if (chasing && !wasMorphing.current) {
    soft.current.clear()
    const seed = morph ? target : live.current
    for (const [id, g] of seed) if (target.has(id)) soft.current.set(id, { ...g })
  }
  wasMorphing.current = chasing

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
    if (!chasing) return to
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
  const fileIds = useMemo(() => new Set(fileWedges.map((w) => w.node.id)), [fileWedges])

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

  /** What folding has taken out of the picture: the folded directories that are actually
   *  drawn, and the share of this view's lines they stand for.
   *
   *  **The share is the price of the handle and has to be stated somewhere.** A fold hands
   *  a subtree's angle to its siblings, so every remaining wedge is now larger than its
   *  lines have earned — and the amount they are wrong by is exactly this number. Against
   *  the VIEW's own lines rather than the repo's, because the circle is the view: drilled
   *  into `src`, "62% of what you are looking at" is the honest sentence and "8% of the
   *  repo" is an answer to a question nobody asked here.
   *
   *  Only what is drawn is counted. A directory folded and then drilled past is not
   *  suppressing anything in the ring you are looking at, and putting it in this total
   *  would attach a caveat to a picture that does not have the problem. */
  const foldedInfo = useMemo(() => {
    if (collapsed.size === 0) return null
    const shut = wedges.filter((w) => w.node.kind === 'dir' && collapsed.has(w.node.id))
    if (shut.length === 0) return null
    const loc = shut.reduce((sum, w) => sum + w.node.loc, 0)
    return {
      count: shut.length,
      name: shut.length === 1 ? shut[0].node.name : null,
      share: root.loc > 0 ? loc / root.loc : 0,
    }
  }, [wedges, collapsed, root.loc])

  /** Ask the window for the insides of every file the map could draw one for.
   *
   *  The test is `tilingOf` — the same one the render pass takes — so a file is asked about
   *  exactly when a tiling would be drawn if its functions were here, and never when it
   *  would not. See `onWantRings` for what this replaces and why the window could not have
   *  answered it.
   *
   *  Against the SETTLED geometry rather than the frame in flight, so a level change does
   *  not ask for a directory's worth of rings on its way past. Nothing is asked for twice:
   *  a file whose functions have arrived has children, which is the condition being
   *  tested, and the window keeps its own record of what is in flight.
   *
   *  `tilingOf` closes over the band and the patch floor, both of which are in the deps.
   *  Naming the function itself would fire this on every render. */
  useEffect(() => {
    if (!onWantRings) return
    const want: string[] = []
    for (const w of fileWedges) {
      const n = w.node
      if (n.funcs <= 0 || n.children.length > 0) continue
      const g = target.get(n.id)
      if (g && tilingOf(g)) want.push(n.path)
    }
    if (want.length > 0) onWantRings(want)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileWedges, target, band, minPatchArea, onWantRings])

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
  const dots = useMemo(() => {
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

  const viewTo = useMemo(() => {
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
    return viewFor(extentOf(geos, rIn), MARGIN, CHROME_BOTTOM)
  }, [target, root.kind, root.id, paneAspect, fileIds, morph, rIn])
  const viewFrom = useRef(viewTo)
  const viewNow = useRef(viewTo)
  /** Put the creature where the hub's user-space origin lands, for a pane of this size.
   *
   *  **Held in a ref so the RESIZE observer can call it too, and that is the whole point.**
   *  The pane's size reaches this component as state, so on a window drag the SVG rescaled
   *  itself natively every frame while the creature waited for a React render — one frame
   *  behind, every frame, which is a hub that stutters while everything around it is smooth.
   *  The observer runs before paint, so placing it from there puts the creature on the same
   *  frame as the box it sits in. The effect below still calls it, because the view also
   *  moves without the pane changing at all. */
  const place = useRef((w: number, h: number) => {
    void w
    void h
  })
  place.current = (w: number, h: number) => {
    const el = hubMascot.current
    if (!el || w <= 0 || h <= 0) return
    const v = viewNow.current
    const s = Math.min(w, h) / v.side
    const x = w / 2 + (0 - v.cx) * s
    const y = h / 2 + (HUB_MASCOT_Y - v.cy) * s
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`
    // Hidden until it has been placed. Untransformed it sits in the pane's top-left corner,
    // which is a creature in the wrong place for however long the first measurement takes —
    // and `mascot` in the effect's deps is what re-places it after a replay is switched off
    // and the layer mounts again with no transform on it.
    el.style.visibility = 'visible'
  }
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
    place.current(box.w, box.h)
  }, [viewTo, e, moving, box.w, box.h, mascot])

  /** Which segment of a directory's rim the pointer is over, if any.
   *
   *  **Read from the pointer rather than hit-tested by the paths, and that is a decision
   *  about the CLICK.** Giving each segment its own listeners is the obvious version and it
   *  quietly breaks the wedge underneath: a rim path that answers the mouse also swallows
   *  the click that selects the directory and the double-click that drills into it, so the
   *  four-and-a-half pixels of a directory's own reading would become the one part of it you
   *  cannot press. Every segment would then have to re-implement select, drill and fold —
   *  three behaviours in two places.
   *
   *  So the rim stays deaf and the arithmetic answers instead. The box is square and fitted
   *  `xMidYMid`, so the smaller pane dimension is the scale and the box's centre is the
   *  pane's — the same mapping the creature is placed by, one function over. Angles run
   *  clockwise from twelve, matching `arcPath`.
   *
   *  It reads `rimRuns`, which is what the paths are drawn from, so the pointer and the
   *  picture cannot disagree about which value is under it. */
  const hoverSlice = useMemo(() => {
    if (!hoverNode || hoverNode.kind !== 'dir' || moving) return null
    const g = target.get(hoverNode.id)
    if (!g || box.w <= 0 || box.h <= 0) return null
    const cut = rimRuns(hoverNode, g)
    if (!cut) return null
    const v = viewNow.current
    const scale = Math.min(box.w, box.h) / v.side
    const ux = v.cx + (pos.x - box.w / 2) / scale
    const uy = v.cy + (pos.y - box.h / 2) / scale
    const r = Math.hypot(ux, uy)
    if (r < cut.band.r0 || r > cut.band.r1) return null
    // `arcPath` places a point at `(r sin a, −r cos a)`, so this inverts it — and the result
    // is wrapped into the layout's own range rather than `[0, 2π)`, because the ring starts
    // at nine o'clock and a wedge can span the seam.
    let a = Math.atan2(ux, -uy)
    while (a < cut.band.a0 - Math.PI) a += 2 * Math.PI
    while (a > cut.band.a0 + Math.PI) a -= 2 * Math.PI
    const run = cut.runs.find((x) => a >= x.a0 && a <= x.a1)
    if (!run) return null
    return {
      label: run.label,
      fill: run.fill,
      lines: run.lines,
      share: run.lines / cut.total,
      // A merged run is several values wearing the biggest one's colour, and the card has to
      // say so or it reports a share as though one person held it. A categorical merge names
      // none of them and says so in its own label instead — see `rimRuns`.
      held: run.held,
      named: run.named,
    }
  }, [hoverNode, target, box.w, box.h, pos.x, pos.y, moving, hist, unitsPerPx, rim])

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
          constants describe. A tree shallower than the ring count never reaches `R_OUTER`, and a
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
        <g ref={art} data-rings style={moving ? { pointerEvents: 'none' } : undefined}>
          {/* The directory you opened, shrinking into the middle it is about to be.
            Inside the fitted group, because it IS the arriving level's own hub and the box
            should be drawn around where it lands. Painted before everything else so it
            passes under the hub disc: it does not need to fade out, it is covered by the
            thing it turned into, which is what "became the core" should look like. */}
          {moving &&
            coring.current &&
            (() => {
              const g = lerpGeo(coring.current.from, coring.current.to, e)
              const c = colorFor(coring.current.node, mode, ranks, views)
              return (
                <g>
                  <path
                    d={arcPath(g.a0, g.a1, g.r0, g.r1)}
                    fill="var(--structure)"
                    fillOpacity={1}
                    stroke="var(--background)"
                    strokeWidth={cutAt('dir', g.a0, g.a1, g.r0)}
                  />
                  {dirRim(coring.current.node, c, g)}
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
                views={views}
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
              views={views}
              minPatchArea={minPatchArea}
              onSelect={onSelect}
              onDrill={onDrill}
              onHover={setHoverNode}
              tagNodes={tagNodes}
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
                const isHover = hover?.node.id === w.node.id
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
                          // Armed before the set changes, so the chase is already on for the
                          // render that carries the new layout — see `folding`. A frame late
                          // and the wedges have arrived before anything eases them.
                          setFolding(true)
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
                  const isHover = hover?.node.id === slot.node.id
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
                        onMouseEnter={() => setHoverNode(slot.node)}
                        onMouseLeave={() =>
                          setHoverNode((n) => (n?.id === slot.node.id ? null : n))
                        }
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
          {/* Outside the keyed group below, so a level change does not restart its swing. */}
          {center === 'wheel' && <BalanceWheel r={rIn - 4} hz={wheelHz} />}
          {center === 'eye' && <HubEye r={rIn - 4} gaze={gaze} />}
          {center === 'circles' && (
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
          )}
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
            {center === 'monster' && !mascot && (
              <text
                textAnchor="middle"
                y={4}
                fontFamily={FAMILY}
                fontSize={hubK * Math.max(9, Math.min(15, 150 / Math.max(hubName.length, 5)))}
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
      {mascot &&
        ((): React.ReactNode => {
          return (
            <div
              ref={hubMascot}
              /* Where the creature sits in the map's OWN coordinates — its centre's y and the
             side of its box, both in user units. The movie export composites this canvas
             into its frames (it is not in the SVG, so a copy of the SVG does not carry it)
             and needs to know where: reading it off the element keeps the one geometry
             here, rather than a second copy of these two numbers in `movie.ts` that nobody
             would think to move when the hub does. */
              data-hub-mascot={`${HUB_MASCOT_Y} ${HUB_MASCOT * hubK}`}
              className="absolute left-0 top-0 origin-center"
              style={{
                width: HUB_MASCOT * hubK,
                height: HUB_MASCOT * hubK,
                visibility: 'hidden',
                cursor:
                  center === 'monster' && mascot.onFindings && mascot.findings
                    ? 'pointer'
                    : onUp
                      ? 'zoom-out'
                      : undefined,
              }}
              onDoubleClick={
                onUp
                  ? (ev) => {
                      ev.stopPropagation()
                      onUp()
                    }
                  : undefined
              }
              /** **The whole creature opens the findings, and only while it has some to show.**
               *
               *  This does sit in front of the six-click remint, which is the cost: with a bubble
               *  up, clicking the mascot opens a panel instead of counting toward a new creature.
               *  Reminting is still there on a repo with nothing standing, and the trade was
               *  asked for — the creature having something to say is the more common state and
               *  the more useful click. The disc's own "go up" is untouched, because that is a
               *  DOUBLE click and this stops the event before it reaches the ring underneath. */
              // Only the creature opens the panel on a click. Anything else in the middle leaves a
              // click to the dial's two halves, so a double-click there goes up a level.
              onClick={
                center === 'monster' && mascot.onFindings && mascot.findings
                  ? (ev) => {
                      ev.stopPropagation()
                      mascot.onFindings?.()
                    }
                  : undefined
              }
            >
              {/* **The badge shape changes the creature, not just what is drawn over it.**
                  The arc needs air above the head — at full size the band lands ON the head
                  and reads as a hat — so the creature shrinks and keeps its footing, origin
                  at the bottom of the box, which is the ground it was already standing on.
                  The plinth takes the ground shadow out of the blueprint: a soft ellipse
                  spreading from behind a solid block is two grounds, and the block is the
                  one the creature is standing on. */}
              <div
                style={{
                  /* **The dial takes a squidge of width off the creature.** It carries a line
                     of type at twelve and another at six; at full size the head reaches the
                     first and the feet reach the second.

                     Scaled about its CENTRE, which is the part that took two goes to get
                     right. Anchoring at the bottom keeps the footing where it is, which is
                     what a badge under the feet would want — but with type above AND below,
                     the creature has to stay centred between them, and scaling about the feet
                     pulled it down into the lower line. */
                  transform: `scale(${DIAL_MASCOT})`,
                  transformOrigin: '50% 50%',
                  // The badge draws over the figure, not under it.
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {center === 'monster' && (
                  <AgentMascot
                    size={HUB_MASCOT * hubK}
                    events={mascot.events}
                    state={mascot.state}
                    gaze={gaze}
                    project={mascot.project}
                    remint={mascot.remint}
                  />
                )}
              </div>
              {/* **The count, as a badge.** A cloud and a tail of dots were both tried here
                  and both lost to the plain thing: what this has to do is carry a number
                  legibly at a fifth of the creature's height, over whatever colour the
                  innermost wedges happen to be, and every bit of shape spent on saying
                  "thought" came out of the part that had to stay readable.

                  Top-right and clear of the head — it sat over the face at first, which reads
                  as a creature wearing a number rather than having one.

                  `pointer-events: none`: the CLICK is the whole creature's, one level up.
                  This is the thing being pointed at, not the target.

                  **Drawn whatever the creature is doing.** It used to be gated on `sleeping`,
                  which is not an argument anybody made — it is a condition that was written
                  and never justified, and what it did was take the count off the map for the
                  whole of a reading pass. Kibana's is minutes long; sanity's is 1,700
                  functions. For all of that the map said nothing while the panel behind it
                  said forty-nine, and silence standing in for a clean bill is the one thing
                  this surface is written never to do.

                  The count is honest during a run, and interestingly so: tier-2 rules are
                  blocked until something has been read, so the number GROWS as the readers
                  land — which is the reading pass paying off, said in the one place you are
                  already looking. */}
              {!!mascot.findings && (
                <FindingBadge
                  layer={2}
                  box={HUB_MASCOT * hubK}
                  rules={mascot.rules ?? 0}
                  count={mascot.findings}
                  onFound={mascot.onFindings ? () => mascot.onFindings?.('findings') : undefined}
                  onRules={mascot.onFindings ? () => mascot.onFindings?.('rules') : undefined}
                />
              )}
            </div>
          )
        })()}

      {/* The tooltip. Instant, because it is ours: it appears the moment a wedge is
          entered instead of waiting out the OS delay, and it can say what is actually
          worth knowing about a wedge rather than the one string `<title>` allowed.
          Flipped back across the pointer near the right or bottom edge so it is never
          clipped by the pane. */}
      {hover && (
        <WedgeTip
          node={hover.node}
          slice={hoverSlice}
          x={hover.x}
          y={hover.y}
          box={box}
          mode={mode}
          ranks={ranks}
          views={views}
          folded={hover.node.kind === 'dir' ? collapsed.has(hover.node.id) : undefined}
          // What this handle is standing in for, so the share is one hover away from the
          // mark that suppressed it rather than only in the corner.
          share={root.loc > 0 ? hover.node.loc / root.loc : undefined}
        />
      )}

      {/* Every count in the chip below is meaningless without the number it is out of.
          15,777 is 0.26% of one repo and 92.3% of another, and those are opposite findings
          wearing the same digits — which is this app's own rule about denominators nobody
          can see, applied to its own caption.

          Counted here rather than in `layout`, which cannot answer it: that walk stops at
          `maxDepth`, so anything past the last ring is neither drawn nor culled and would be
          missing from a total it computed. A share is only honest against its whole
          population. */}
      {(hidden.files + hidden.dirs > 0 || collapsed.size > 0 || (root.unparsed ?? 0) > 0) && (
        /* Never let the picture imply it showed everything.
           Two different omissions live here and they are not the same kind of thing.
           Wedges too thin to draw are the tool's doing and there is nothing to be done
           about them, so they are stated and left. Files the walk could not parse are the
           tool's doing too, and they are a heavier claim than the other two: a thin wedge is
           still counted in every total above it, where an unreadable file is in no
           denominator anywhere. A repo of 110 `.scad` files and 3 `.rb` drew three files and
           said nothing, which is the confident-looking half-verdict the no-git-history
           warning already exists to prevent, reached through a door that had no warning on
           it. From `root`, so it scopes to the drill the way `hidden` does — see
           `Node::unparsed`, which is rolled up for exactly this. A FOLDED directory is the reader's own
           doing — and it was missing from this note entirely, which is the worse of the
           two: option-clicking a subtree shut removes it from the picture with no standing
           record that it is gone, and the count of what the map is showing quietly stops
           meaning what it did. Somebody returning to a window they folded an hour ago has
           no way to tell a repo without tests from a repo whose tests they hid.

           So it says both, and the one the reader can undo carries the way to undo it.
           Boxed in the corner rather than floated under the graph: it is a caveat about
           the picture, so it reads as a note attached to it and not a caption of it. */
        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
          {/* **One clause on the first line, the rest on the second, and the reason is the
              shape of the hole it sits in.** The map is a circle in a rectangle, so the
              negative space at this corner WIDENS as it goes down — the arc curves away from
              the bottom-left as it descends. A single 450px line runs out along the widest
              part of the picture; two lines put the short clause where the room is narrow and
              everything else where the room is. The legend does the same thing on the other
              side by measuring the arc (`useMapEdge`), which is worth remembering if this
              ever needs to be exact rather than merely true.

              `CHROME_BOTTOM` is untouched: it reserves room under the COMPOSITION, and the
              second line grows into a corner the rings were never reaching. If that ever
              stops holding, the fix is the one that constant's own doc asks for — measure
              the overlay and convert through `unitsPerPx` — not a bigger fraction. */}
          <span className="flex flex-col">
            {[
              // **Named and priced, not counted.** `1 dir folded` was enough while a fold
              // only hid a subtree's insides; now it hands that subtree's angle to its
              // siblings, and a reader coming back to this window an hour later has to be
              // able to find out which ring is no longer proportional and by how much. One
              // fold names itself, because the name is what makes it findable; several are
              // a count, because a list of names in a corner chip is not read.
              foldedInfo &&
                `${
                  foldedInfo.name
                    ? `${foldedInfo.name} folded`
                    : `${foldedInfo.count.toLocaleString()} dirs folded`
                }${foldedInfo.share >= 0.005 ? ` — ${Math.round(foldedInfo.share * 100)}% of this view` : ''}`,
              // Undefined, not zero, on a replayed frame and on a scan still streaming its
              // shape: neither knows what the walk could not read, so neither says. See
              // `Node.unparsed`.
              (root.unparsed ?? 0) > 0 &&
                // Out of every file that LOOKS like source here — the ones drawn plus the
                // ones that could not be read. Not out of the drawn files alone, which would
                // put the part outside the map over a denominator that excludes it and let
                // the share run past 100%.
                //
                // A third population is in neither: files the parser opened and got nothing
                // from (`ScanStats::files_skipped`, 1,671 of ceph's 7,813) become no node, so
                // they are missing from the denominator and the share reads a few points high
                // — 16% against a true 13% there. Counting them would mean carrying that
                // number per node too, which is more machinery than three points is worth;
                // the direction of the error is stated here instead of implied.
                `${outOf(root.unparsed!, under.files + root.unparsed!, 'file')} not parsed`,
              hidden.files > 0 &&
                // Out of the drawn population only: a culled wedge is a file the map HAS and
                // did not show, so the files it could not read are not part of this question.
                `${outOf(hidden.files, under.files, 'file')} too thin`,
              hidden.dirs > 0 && `${outOf(hidden.dirs, under.dirs, 'dir')} too thin`,
            ]
              .filter((c): c is string => typeof c === 'string')
              // The first alone, then everything else together. Not a wrap: a wrap breaks
              // wherever the width runs out, which puts half of one count on each line and
              // reads as a rendering fault. The break is between clauses or it is nowhere.
              .reduce<string[]>(
                (lines, clause, i) =>
                  i === 0 ? [clause] : [lines[0], lines[1] ? `${lines[1]} · ${clause}` : clause],
                [],
              )
              .map((line) => (
                <span key={line}>{line}</span>
              ))}
          </span>
          {collapsed.size > 0 && (
            <button
              type="button"
              className="rounded-[var(--radius-sm)] px-1 text-[var(--foreground)] underline decoration-dotted underline-offset-2 hover:bg-[var(--secondary)]"
              onClick={() => {
                setFolding(true)
                setCollapsed(new Set())
              }}
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
 * Memo only pays if the props are stable, so the call site memoises `ranks` and `age`
 * and passes callbacks through `useCallback`. An inline lambda here silently undoes all of
 * this — the component still re-renders, and nothing looks wrong until somebody times a
 * click. That is the same failure mode as the poll rebuilding the frame tree because
 * `activeProject` is a fresh object every tick.
 */
export const Sunburst = memo(SunburstView)
