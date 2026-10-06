import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { trapOf, type Node } from '../lib/api'
import {
  colorFor,
  histogramsFor,
  REPLAY,
  type Slice,
  type Views,
  type ColorMode,
} from '../lib/colorMode'
import { lightnessBy, lightnessOf, type Resolve } from '../lib/ink'
import { layout, tileFunctions, type Wedge } from '../lib/sunburst'
import { type Spacing } from '../lib/spacing'
import { rimRuns as runsOf } from '../lib/rim'
import { fanOf } from './FileZoom'
import { arcOf, type Sector } from '../lib/fan'
import { extentOf, geoOf, viewFor, type Exiting, type Geo, type View } from '../lib/zoom'

/*
 * What the map is laid out FROM, before anything is drawn: the constants every picture of it is
 * measured against, the model (`buildModel`) derived from the tree and the reader's settings, the
 * box it is fitted to, and the frame a window hands the markup. `MapSvg` in `MapArt.tsx` draws
 * it; nothing here renders.
 */
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

/** Arc a file's rim needs before it is worth reserving a label band above it.
 *
 *  `MIN_KEPT` characters at `MIN_SIZE`, roughly — the shortest name this app will draw. A
 *  wedge narrower than that cannot be labeled however much room is set aside for it, so
 *  setting room aside only moves the picture. */
const RIM_MIN_ARC = 28

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
export const LABEL_GAP = 4
/** Deep enough to hold the type it exists for.
 *
 *  This is the cross-axis of every rim label, so `LINE` divides it: at 13 units the biggest
 *  a filename could be set was 7.6px, under the 8px floor, and every one of them silently
 *  failed to fit. The band and `FILE_MAX` are one decision — a band shallower than
 *  `FILE_MAX × LINE` cannot draw a name at all, and the failure looks exactly like the
 *  labels having been turned off. */
export const LABEL_BAND = 20

/** Space left around the composition, as a fraction of its own half-extent. */
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

/** The scale everything is measured at: where the rings start, and every threshold stated in
 *  pixels converted into the ring's own units. */
function scaleOf({ rings, spacing, unitsPerPx }: MapInput, memo: Memo) {
  /** Where the rings begin, at the reader's ring width — see `Spacing['width']`. The rim
   *  stays at `R_OUTER` and the hub moves, because that is the only end that can move
   *  visibly: fitting the view to the drawn extent means scaling both ends is a no-op. */
  const rIn = R_OUTER - (R_OUTER - R_INNER) * spacing.width
  /** How much smaller the hub is than the one every constant in it was written against.
   *  The disc, its circles and the badge are all sized in user units and all three have to
   *  travel with it, or a wider ring draws a picture that overflows the circle it lives in. */
  const hubK = rIn / R_INNER

  /** The mid-radius of ring `d`, from the NOMINAL band — the ring count, not the depth
   *  actually present, because the depth is read off the layout these thresholds are inputs
   *  to and feeding that back is a loop. On a tree shallower than the count the real bands
   *  are thicker and every radius larger, so both thresholds below are conservative. */
  const radiusAt = memo(() => {
    const band = (R_OUTER - rIn) / Math.max(1, rings)
    return (d: number) => rIn + band * (d - 0.5)
  }, [rings, rIn])

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
  /** The function tiling's floor, same conversion SQUARED — it is an area, so a unit that
   *  is `k` pixels makes a square unit `k²` square pixels. Getting that exponent wrong is
   *  invisible at one window size and wrong at every other, which is exactly the bug
   *  `MIN_SLICE` had before it was converted at all. */
  const minPatchArea = memo(
    () => (unitsPerPx === null ? undefined : MIN_PATCH_PX * unitsPerPx * unitsPerPx),
    [unitsPerPx],
  )
  return { rIn, hubK, minAngleAt, handleAngleAt, minPatchArea }
}

/** What is drawn at that scale: the layout, and the sets and geometry read straight off it. */
function treeOf(
  { root, rings, spacing, sortBy, collapsed, selected, reading }: MapInput,
  { rIn, minAngleAt, handleAngleAt }: Scale,
  memo: Memo,
) {
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
   *  average aimed the hub's gaze, which is why it read as idle wandering — the big
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

  /** The gutter between one level and the next, at the reader's scale — see `RING_GAP`. */
  const ringGap = RING_GAP * spacing.ring

  /** Where every wedge in THIS layout belongs, by id. The renderer below reads geometry
   *  from here rather than recomputing it, so the moving picture and the settled one are
   *  the same arithmetic and cannot drift apart. */
  const target = memo(
    () => geoOf(wedges, rIn, band, () => ringGap),
    [wedges, band, ringGap, rIn],
  )
  /** Which wedges will hang a name outside themselves. */
  const fileIds = memo(() => new Set(fileWedges.map((w) => w.node.id)), [fileWedges])
  return { selTrail, wedges, hidden, pulsing, fileWedges, band, drawnDirs, ringGap, target, fileIds }
}

/** What colour it all is under this lens: every drawn directory's distribution, every structural
 *  wedge's fill, and the hub's palette read off both. */
function paintOf(
  { root, mode, ranks, views, replaying, ink }: MapInput,
  { wedges, drawnDirs }: Tree,
  memo: Memo,
) {
  /** How light a token is, looked up where this picture's colours are. */
  const lightness = (token: string) => (ink ? lightnessBy(ink, token) : lightnessOf(token))
  /** Every drawn directory's distribution under this lens — see `histogramsFor`.
   *
   *  Memoised beside `fills` and for the same reason: it is one walk of the tree, it changes
   *  only when the tree or the lens does, and it must not be redone per frame of a chase. */

  const hist = memo(
    // **A replay draws these too, and the gate is the lens rather than the mode.** It was off
    // for the whole of `morph`, on the belief that a frame carries no readings — it carries
    // four grades packed into two bytes (`historyScore.ts`), which is exactly why `REPLAY` marks
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

  /** Each structural wedge's fill and label, computed once per level rather than per
   *  frame. Only geometry changes while the ring is moving, and `colorFor` over a couple
   *  of hundred wedges sixty times a second is work with no output. */
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
  return { hist, fills, hubDiscs }
}

/** The shapes cut out of the ring: the separators, a directory's rim and the runs drawn in it, and
 *  the room a file has to tile its functions in. */
function bandsOf(
  { mode, spacing, unitsPerPx, rimShare }: MapInput,
  { minPatchArea }: Scale,
  { band }: Tree,
  { hist }: Paint,
  memo: Memo,
) {
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
  return { cuts, cutAt, rim, rimBand, rimRuns, tilingOf }
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
function dotsOf(
  { root, mode, markers, replaying }: MapInput,
  { minPatchArea }: Scale,
  { target, band }: Tree,
  { tilingOf }: Bands,
  memo: Memo,
) {
  return memo(() => {
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
}

type Scale = ReturnType<typeof scaleOf>
type Tree = ReturnType<typeof treeOf>
type Paint = ReturnType<typeof paintOf>
type Bands = ReturnType<typeof bandsOf>

/**
 * Everything the picture is laid out from, derived once.
 *
 * Memoised through `memo`, which is `useMemo` inside a component and a plain call for
 * `mapScene` — the same code either way, so what a report lays out is what the window lays
 * out. The deps are the window's own and unchanged: they are what keeps a pointer move from
 * re-running the layout.
 */
function buildModel(i: MapInput, memo: Memo) {
  const scale = scaleOf(i, memo)
  const tree = treeOf(i, scale, memo)
  const paint = paintOf(i, tree, memo)
  const bands = bandsOf(i, scale, tree, paint, memo)
  const dots = dotsOf(i, scale, tree, bands, memo)
  return { ...i, ...scale, ...tree, ...paint, ...bands, dots }
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
    // and the hub is blown up to fill the pane — a disc the size of a dinner plate,
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

export const NOWHERE: Geo = { a0: 0, a1: 0, r0: 0, r1: 0 }

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
