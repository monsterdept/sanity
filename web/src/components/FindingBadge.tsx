import { useId } from 'react'
import { PAPER } from '../lib/ink'
import { widthPerPx } from '../lib/label'
import { FAMILY, TRACKING, WEIGHT } from '../lib/labelStyle'
import { R_INNER } from './mapModel'

/** The badge's box in the hub, in user units, and where its middle sits.
 *
 *  Centred, and large, because it is the only thing in the disc — the name and the line
 *  count both went, being answered by the crumbs and the panel. The size is the creature's
 *  that stood here before it, kept so the badge holds its place and its scale as the hub
 *  grows and shrinks with the ring count.
 *
 *  **In user units, drawn in pixels.** The badge is HTML rather than SVG — it was a layer over
 *  the pane for the creature's WebGL canvas, which does not scale like a path, and it stayed
 *  there because type in a layer stays type. It is moved and scaled to wherever the hub
 *  currently is. `HUB_BADGE` is therefore both: the
 *  side of the box in user units AND the canvas's own pixel size at scale 1, which is what
 *  keeps it crisp at the sizes the map actually draws at. */
export const HUB_BADGE = 94
export const HUB_BADGE_Y = 0

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

/** How many findings are standing, drawn in the hub as a watch dial.
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
export function FindingBadge({
  layer,
  box,
  count,
  rules,
  onFound,
  onRules,
}: {
  /** Which side of the hub this sits on. */
  layer: number
  /** The side of the badge's box, in screen pixels. Everything here is a fraction of it, so
   *  the dial holds its proportions as the hub grows and shrinks with the ring count. */
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
    const disc = box * (R_INNER / HUB_BADGE)
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
    /** **And nothing found is not a notification either.**
     *
     *  `found 0` is worth printing — a repo where sixteen rules ran and asked their questions
     *  and nothing came back is a clean bill, and the dial is the only place that says so. It
     *  is not a thing to go and do, so it is not lit: at zero the top bar drops to the plate
     *  and the figure to the dial's own ink, which is the same sentence the bottom half has
     *  always been set in. Red for a zero would be an alarm about the absence of one. */
    const lit = count > 0
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
      [
        `${pathId}-t`,
        arc(topMid, top.half, upBase(font), true),
        font,
        lit ? PAPER : 'var(--foreground)',
      ],
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
        {bar(topMid, top.half, lit ? DIAL_COLOR : plate, lit ? DIAL_EDGE : undefined)}
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
