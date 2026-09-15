import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { type AgentCall, type Node } from '../lib/api'
import { type Views, type ColorMode } from '../lib/colorMode'
import { PAPER } from '../lib/ink'
import { type Wedge } from '../lib/sunburst'
import { RINGS_DEFAULT } from '../lib/rings'
import { SPACING_DEFAULT, type Spacing } from '../lib/spacing'
import { sectorOf, type Sector } from '../lib/fan'
import {
  direction,
  ease,
  enterFrom,
  exitTo,
  lerpGeo,
  hubGeo,
  lerpView,
  viewBoxOf,
  ZOOM_MS,
  type Direction,
  type Exiting,
  type Geo,
} from '../lib/zoom'
import { widthPerPx } from '../lib/label'
import { FAMILY, TRACKING, WEIGHT } from '../lib/labelStyle'
import { WedgeTip } from './WedgeTip'
import { AgentMascot } from './AgentMascot'
import { CIRCLES, type CirclesLook, type HubCenter } from '../lib/hub'
import type { MascotState } from './MascotFigure'
import {
  FUNC_RIM,
  FUNC_RIM_MAX_SHARE,
  MapSvg,
  R_INNER,
  R_OUTER,
  unitsPerPxFor,
  useMapModel,
  viewOf,
  type MapHandlers,
} from './MapArt'

/* The picture itself — every wedge, rim, label and the hub — is `MapSvg`, in `MapArt.tsx`, and
   so are the constants it is drawn to. What stays here is the WINDOW: the pane it measures, the
   level change and the chase it runs, the pointer, the folds, the creature over the hub and the
   corner chip. A report draws the same element with none of those, which is why they are apart. */
export { DIM, LABEL_BAND, LABEL_GAP } from './MapArt'


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
  /** The pane's own measured side, for a caller that needs to know how much denser an export
   *  is than the screen — see `frameTree`'s `density`. */
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

  /** User units per screen pixel, quantised — see `unitsPerPxFor`. */
  const unitsPerPx = useMemo(
    () => unitsPerPxFor(Math.min(box.w, box.h)),
    [box.w, box.h],
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

  /** Everything the picture is laid out from — see `MapArt`'s `buildModel`. The window's own
   *  memos, moved beside the markup they serve so a report lays out through the same ones. */
  const m = useMapModel({
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
    center,
  })
  const {
    rIn,
    hubK,
    minPatchArea,
    wedges,
    hidden,
    pulsing,
    fileWedges,
    fileIds,
    band,
    hist,
    rim,
    target,
    tilingOf,
    rimRuns,
  } = m

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

  const viewTo = useMemo(
    () =>
      viewOf({
        target,
        rootKind: root.kind,
        fileFrom: fileFrom.current,
        paneAspect,
        fileIds,
        morph: !!morph,
        rIn,
      }),
    // `fileFrom` is a ref, rewritten only by a level change, which moves `root.id`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, root.kind, root.id, paneAspect, fileIds, morph, rIn],
  )
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

  /** What the picture does when it is pointed at — the window's, handed down to `MapSvg`. */
  const handlers: MapHandlers = {
    select: onSelect,
    drill: onDrill,
    hover: setHoverNode,
    fold: (id) => {
      // Armed before the set changes, so the chase is already on for the render that carries
      // the new layout — see `folding`. A frame late and the wedges have arrived before
      // anything eases them.
      setFolding(true)
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (!next.delete(id)) next.add(id)
        return next
      })
    },
  }

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
      <MapSvg
        m={m}
        frame={{
          geo,
          moving,
          e,
          leaving: leaving.current,
          coring: coring.current,
          fileLeaving: fileLeaving.current,
        }}
        // The box as last written to the element — see the fit effect, which moves it between
        // renders. Rendering the computed view here instead would put the destination on the
        // element for the first frame of a level change and make the effect's own comparison
        // skip the frame that puts it back.
        viewBox={fitted.current}
        fileFrom={fileFrom.current}
        paneAspect={paneAspect}
        hover={hoverNode}
        tagNodes={tagNodes}
        hasMascot={!!mascot}
        wheelHz={wheelHz}
        circles={circles}
        gaze={gaze}
        selectedGaze={selectedGaze}
        onUp={onUp}
        on={handlers}
        svgRef={svg}
        artRef={art}
      />

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
