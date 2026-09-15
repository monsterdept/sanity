/**
 * Fitting a name into an annular sector.
 *
 * Every label in this app sits in a wedge, and a wedge has two natural axes: along its arc
 * and along its radius. The chart used exactly one of them in each place — the ring set
 * every directory on its arc, the fan set every function horizontally — so a cell shaped
 * the wrong way for its view's one axis either shrank to the floor or got dropped. A
 * narrow, deep wedge has plenty of room for `sacd-rs`; it just does not have it sideways.
 *
 * So the axis is chosen per label, and it is chosen by the cell's SHAPE:
 *
 * ```text
 *   wider than deep   →  along the arc      `convert`, `tui`, `pipeline`
 *   deeper than wide  →  along the radius   `disc`, `sacd-rs`
 * ```
 *
 * This began as "whichever yields the bigger font", which is a different question and
 * sometimes answers it wrong: a wedge can be a tall narrow slot and still take a slightly
 * larger size across its arc, and the label then sits square across a shape that is
 * plainly vertical. Aspect is what the eye is reading, so aspect is what decides — and the
 * measurement is only asked whether the choice fits.
 *
 * The width compared is the arc at the OUTER edge, not at mid-radius. A wedge spanning a
 * whole band is much wider at its rim than at its waist, and the rim is the edge that gives
 * it its shape: `convert` is a tie on its mid-arc and obviously wide at its outer one.
 *
 * Truncation is the last resort rather than the first — turning the name is free, and a
 * name you can read whole beats a bigger one with its middle missing.
 *
 * # Measured, not estimated
 *
 * Fit used a constant of 0.62em per character, which is an average over a face whose
 * characters are not average: `iiii` and `WWWW` differ by more than three times. The
 * constant therefore had to be pessimistic enough for the worst name, so every other name
 * was refused room it actually had. Here the string is measured, once, with the same face
 * the SVG will draw — and because text width is linear in font size, one measurement at a
 * reference size serves every size that string is ever asked about.
 */

import { FAMILY, MIN_SIZE, PRIMARY } from './labelStyle'
import { MONO_FAMILY } from './monoFaces'

/**
 * The face labels are measured in, and — critically — the face they are DRAWN in.
 *
 * `WedgeLabel` sets this same string on the element rather than inheriting the app's, and
 * that is the whole point of it being here. The page's stack once started with `ui-sans-serif`,
 * a keyword the canvas and the SVG renderer are each free to resolve their own
 * way; measure in one face and paint in another and every label is sized against a width
 * it does not have. That failure is invisible in a unit test — there is no canvas in node,
 * so the estimator runs instead and agrees with itself — and on screen it looks exactly
 * like a fit constant being slightly too generous, which is how it survived three rounds
 * of tightening the constants.
 *
 * So: concrete families only, no keywords, one string used by both.
 */

/** Measured at this size and scaled. Big enough that rounding in the metrics is noise. */
const REF = 100

let ctx: CanvasRenderingContext2D | null = null
const widths = new Map<string, number>()

/** Has the real face arrived? Part of the cache key, so a width measured against the
 *  fallback is never handed back once the browser has the face it will actually paint. */
const faceReady = () => {
  try {
    return document.fonts?.check(`400 ${REF}px ${PRIMARY}`) ? 'face' : 'fallback'
  } catch {
    // A browser without the API measures with whatever it has and is consistent about it,
    // which is the case this whole key exists to distinguish from.
    return 'face'
  }
}

// And drop what was measured before it landed. The key alone keeps the two answers apart;
// this stops the fallback set living for the rest of the session in a map that only grows.
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.ready.then(() => widths.clear()).catch(() => {})
}

/**
 * How wide a string is, per pixel of font size.
 *
 * Cached per string and weight, because the chart asks about the same few hundred names on
 * every frame of a transition and `measureText` is the one genuinely expensive call here.
 *
 * Falls back to a per-character estimate where there is no canvas — tests, or a browser
 * that refuses the context. Being wrong there costs a label that could have been bigger;
 * being wrong in a way that throws would cost the chart.
 */
export function widthPerPx(text: string, weight: number): number {
  // **Keyed on the FACE, which this claimed to be and was not.** `FAMILY` is a stack, so the
  // string handed to `ctx.font` is identical before and after the webfont arrives while what
  // the browser resolves it to is not — and a cache keyed only on the weight and the string
  // answers every later question with whatever face happened to be live for the first one.
  //
  // The visible failure is a `textPath` cut short: the dial sizes its arc to the advance it
  // was told, the real face is wider, and the browser clips the overflow — so `found 67`
  // painted as `ound 67`, with the leading glyph gone and nothing anywhere reporting an
  // error. Every label on the map is laid out through this, so it was never only the dial.
  const key = `${faceReady()}|${weight}|${text}`
  const hit = widths.get(key)
  if (hit !== undefined) return hit
  if (ctx === null) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
    ctx = canvas ? canvas.getContext('2d') : null
  }
  let w: number
  if (ctx) {
    ctx.font = `${weight} ${REF}px ${FAMILY}`
    // A little wider than measured. `measureText` reports the advance, which is not the
    // ink: the last glyph's right side bearing, hinting at small sizes and subpixel
    // rounding all push the painted run past it by a hair. A few per cent is cheaper than
    // a label crossing a stroke, and the whole policy here is that a name which does not
    // clearly fit is not drawn.
    w = (ctx.measureText(text).width / REF) * 1.06
  } else {
    w = text.length * 0.6
  }
  widths.set(key, w)
  return w
}

/** Line box as a multiple of font size — what one line of type actually occupies ACROSS
 *  its run, including the air it needs not to crowd the edges of its own wedge.
 *
 *  Worth doing the arithmetic, because the obvious value is much too small. Ink is not cap
 *  height: ascender to descender is about 0.95em, and the halo strokes `size × 0.22` around
 *  that, 0.11 a side. So a label drawn at `size` puts roughly `1.17 × size` of ink across
 *  its run.
 *
 *  At 1.25 that came to 94% of the wedge's width — technically inside it, and reading as a
 *  name jammed between two walls. It then climbed to 1.8 and 2.1 chasing labels that were
 *  still escaping, which they were doing for an unrelated reason: the face being measured
 *  was not the face being drawn. With that fixed the padding is doing only its own job
 *  again, and 1.7 puts the ink at about 69% of the width — comfortable, and cheap enough
 *  that a 4° wedge like `disc` can still hold a name. */
const LINE = 1.7

/** Share of a run's length a name may actually use.
 *
 *  A name sized to exactly its container's length ESCAPES it. Three things eat the
 *  difference and none of them are in the width: the halo is stroked outside the glyphs,
 *  `textPath` clips a run whose advance rounds past the path's own length — which is what
 *  ate the leading `e` of `xecute_reference_step` — and glyphs overshoot their cap height.
 *  So the fit is against nine tenths of the run and the last tenth is the margin that keeps
 *  the label inside the thing it names. */
const PAD = 0.9

/**
 * How far an arc-set name may bend, in radians of its own run.
 *
 * The axis was chosen purely by which fits BIGGER, and size is not the whole of legibility.
 * Text on an arc bends by `width / r`, so the same name at the same size is nearly straight
 * out at the rim and a horseshoe near the core — `handle_paste`, curled around the hub of an
 * open file, was picked by the size rule and unreadable. Length says nothing about this
 * because the tight case is exactly where the arc is generously long.
 *
 * So the arc option is also capped at the size that keeps its bend under this, which lets
 * the radial option win near the core WITHOUT a special case: an arc run that would curl
 * simply stops being the bigger of the two.
 *
 * **How much bend is too much depends on the picture, so the caller says.** In the RING a
 * curved label is not a compromise, it is the convention — the curve is what says the name
 * belongs to that band, and `convert` and `disc` set straight across their own rings read
 * as labels lying on top of the chart rather than in it. In the FAN there is no ring to
 * follow: the cells are a treemap that happens to be drawn in polar coordinates, and a
 * name curving through one is just distortion, which is how `handle_paste` ended up curled
 * around the hub.
 *
 * One threshold could not serve both — at 0.45 the ring's inner directories flipped to
 * radial, at 0.7 the fan's near-core cells curled — because the two are not the same
 * question wearing different numbers.
 */
const DEFAULT_BEND = 0.9

/** Real characters a truncated name must keep to be worth drawing.
 *
 *  The ring was producing `d…to…`, `s…` and `pr…`, which cost ink and say nothing — a
 *  reader learns less from them than from an empty wedge, because an empty wedge at least
 *  does not look like it answered.
 *
 *  Set at five to begin with, which the fan disproved on the first look: `cur…nu`, `mis…ir`
 *  and `dir…ee` all clear five and are still two fragments of a word you have to hover to
 *  learn. Eight is where a stub starts carrying a whole morpheme at each end. */
export const MIN_KEPT = 8

/** And never less than this share of the name.
 *
 *  The character floor alone was not enough, which the fan showed at once: `cur…nu` and
 *  `mis…ir` clear five characters and say nothing — they are two fragments of a word the
 *  reader still has to hover to learn. A stub is worth drawing when it NARROWS the field,
 *  and a sixth of a long identifier does not. Together the two rules mean a short name
 *  survives light clipping and a long one is either mostly there or absent. */
export const MIN_SHARE = 0.45

/**
 * Shorten from the MIDDLE.
 *
 * These are snake_case identifiers and directory paths, where the head is shared and the
 * tail is what distinguishes: `owners_across_the_languages_it_knows` against `owner_of`,
 * `build_lineage_metadata_command` against `build_file_copy_command`. Cutting the tail
 * throws away the discriminating half and leaves a label that could name several things.
 * Keeping both ends costs one glyph and answers "which one is this".
 */
export function middleTruncate(name: string, keep: number): string {
  if (keep >= name.length) return name
  if (keep < MIN_KEPT) return ''
  const head = Math.ceil(keep / 2)
  const tail = keep - head
  return name.slice(0, head) + '…' + (tail > 0 ? name.slice(name.length - tail) : '')
}

/** How wide one monospace glyph is, as a multiple of the type size.
 *
 *  **Measured in the face `.mono` declares**, once, and cached — a constant would be right for
 *  one of the vendored candidates and wrong for the rest. Monospace is what makes this one number useful at all: every glyph
 *  is this wide, so "how many characters fit" is a division rather than a search.
 *
 *  Falls back to 0.6, which is what most terminal faces measure, when there is no canvas to
 *  ask — a headless render is better off with a slightly wrong truncation than with none. */
export function monoAdvance(): number {
  if (mono !== null) return mono
  if (ctx === null) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas')
    ctx = canvas ? canvas.getContext('2d') : null
  }
  if (!ctx) return 0.6
  ctx.font = `${REF}px ${MONO_FAMILY}`
  mono = ctx.measureText('0').width / REF
  return mono
}
let mono: number | null = null

export interface Cell {
  a0: number
  a1: number
  r0: number
  r1: number
}

export interface Placement {
  /** Along the wedge's arc, or out along its radius. */
  axis: 'arc' | 'radial'
  text: string
  size: number
  /** The radius the text is centered on. */
  r: number
  /** For `arc`, the span to run along. For `radial`, the bearing to run out on. */
  a0: number
  a1: number
  /** Whether the name had to lose its middle to fit. */
  clipped: boolean
}

/** How wide a string is, per pixel of font size — `widthPerPx`'s shape.
 *
 *  **Handed in rather than set on a module, because two maps can be laid out at once.** The
 *  window measures with the canvas; a report drawn without a window measures with whatever it
 *  has, and both can run in one webview at the same moment. A measurer installed globally
 *  would make one of them lay out against the other's face. */
export type Measure = (text: string, weight: number) => number

export interface FitOpts {
  weight: number
  /** What the name is measured with. `widthPerPx` — the canvas, in the face the SVG draws in —
   *  when nobody says otherwise, which is the window. */
  measure?: Measure
  /** Largest the type may be, whatever the room. A name is a label, not a headline. */
  max: number
  /** Where along the radius the arc-run sits, as a fraction of the cell's depth. Center
   *  for a patch; near the outer edge for a name set OUTSIDE its wedge. */
  at?: number
  /** How far an arc run may curve, in radians. See `DEFAULT_BEND` — the ring wants a
   *  generous one, the fan a tight one. */
  maxBend?: number
  /** Restrict the label to one axis. Rim names take `'arc'`: the band they hang in is a
   *  thin annulus with other wedges beyond it, so a radial run leaves their territory on
   *  the first character. */
  only?: 'arc' | 'radial'
}

/**
 * The best a name can do in this cell, or nothing.
 *
 * Order matters and it is the whole policy: the full name on either axis beats a clipped
 * name on either axis. Turning a label costs the reader nothing — a wedge tells you which
 * way its own text runs — where a missing middle costs them the word.
 */
export function fitLabel(cell: Cell, name: string, opts: FitOpts): Placement | null {
  const { weight, max } = opts
  const at = opts.at ?? 0.5
  const depth = cell.r1 - cell.r0
  const r = cell.r0 + depth * at
  const arc = (cell.a1 - cell.a0) * r
  if (depth <= 0 || arc <= 0) return null

  const measure = opts.measure ?? widthPerPx
  const wpp = measure(name, weight)
  const w = Math.max(wpp, 1e-6)
  // Each axis: how big the type can be before it overruns the length, and before it
  // overruns the thickness at right angles to it.
  const alongArc = Math.min(
    depth / LINE,
    (arc * PAD) / w,
    // ...and no more bend than this picture will carry. See `DEFAULT_BEND`.
    ((opts.maxBend ?? DEFAULT_BEND) * r) / w,
    max,
  )

  /**
   * A radial name is CENTERED in its wedge, and sized so that it can be.
   *
   * Equal ground before the first letter and after the last one. Anything else reads as a
   * label that slid: `tests` and two of the three `src`s sat out near their rims with the
   * whole inner half of their wedge empty below them.
   *
   * That was the second wrong answer here, and both came from solving for the wrong thing.
   * Measuring the fit at `r0` asked whether the name could sit in the narrowest part of the
   * wedge, which for a slice against the hub is nowhere; pushing it out to where it fits
   * answered that, and put it off center. The question is neither — it is how big the type
   * can be GIVEN that it is centered.
   *
   * Centered, the run reaches `mid ± wpp·s/2`, so its inner end is the narrowest point it
   * passes and the size that just fits is the fixed point of
   * `LINE·s = Δθ·(mid − wpp·s/2)`. Solved directly.
   *
   * A wedge too narrow for that yields a size under `MIN_SIZE` and gets no label, which is
   * the right outcome and the stated policy: fit, or don't draw, and let hover answer.
   */
  const midR = (cell.r0 + cell.r1) / 2
  const span = cell.a1 - cell.a0
  const alongRadius = Math.min((span * midR) / (LINE + (span * w) / 2), (depth * PAD) / w, max)
  const rRadial = midR

  const mid = (cell.a0 + cell.a1) / 2
  const whole = (axis: 'arc' | 'radial', size: number): Placement => ({
    axis,
    text: name,
    size,
    r: axis === 'radial' ? rRadial : r,
    a0: axis === 'arc' ? cell.a0 : mid,
    a1: axis === 'arc' ? cell.a1 : mid,
    clipped: false,
  })

  // Which way the cell is SHAPED. A rim label is only ever set along its arc: the band it
  // hangs in is a thin annulus, and a radial run there would leave it immediately.
  const arcOk = opts.only !== 'radial'
  const radialOk = opts.only !== 'arc'
  const outerArc = (cell.a1 - cell.a0) * cell.r1
  const prefer: 'arc' | 'radial' = !radialOk || (arcOk && outerArc >= depth) ? 'arc' : 'radial'
  const other: 'arc' | 'radial' = prefer === 'arc' ? 'radial' : 'arc'
  const sizeOf = (axis: 'arc' | 'radial') =>
    axis === 'arc' ? (arcOk ? alongArc : -1) : radialOk ? alongRadius : -1

  // The shape's own axis first. Only if the name cannot be read that way at all does the
  // other one get a turn — which is what puts `handle_paste` upright: its cell is long
  // along the arc, but the bend cap leaves no legible size there, so radial takes it.
  if (sizeOf(prefer) >= MIN_SIZE) return whole(prefer, sizeOf(prefer))
  if (sizeOf(other) >= MIN_SIZE) return whole(other, sizeOf(other))

  // Neither orientation holds the whole name. Now — and only now — take the axis with the
  // most length at the smallest size worth reading, and cut the middle out.
  // Clipped, on the shape's own axis — the same one the whole name would have taken.
  const axis = prefer
  const length = axis === 'arc' ? arc : depth
  const across = axis === 'arc' ? depth : span * midR
  if (across / LINE < MIN_SIZE) return null

  const floor = Math.max(MIN_KEPT, Math.ceil(name.length * MIN_SHARE))
  for (let keep = name.length - 1; keep >= floor; keep--) {
    const text = middleTruncate(name, keep)
    if (!text) break
    if (measure(text, weight) * MIN_SIZE <= length * PAD) {
      return {
        axis,
        text,
        size: MIN_SIZE,
        r: axis === 'radial' ? rRadial : r,
        a0: axis === 'arc' ? cell.a0 : mid,
        a1: axis === 'arc' ? cell.a1 : mid,
        clipped: true,
      }
    }
  }
  return null
}
