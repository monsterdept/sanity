/**
 * How labels LOOK, as opposed to where they go.
 *
 * `label.ts` answers which axis a name takes, how big it can be and whether it fits at all
 * — geometry, decided by measurement. What the name should look like once it is there is
 * not that kind of question, and the only honest way to settle one is to look at it on
 * real data. So each of these was a live control for an evening, driven by a floating
 * workbench, until looking at it settled the question.
 *
 * **Settled decisions leave, and the last one has.** Face, weight, tracking and the size
 * floor went first; the separation treatment — halo, shadow, plate — went last, and the
 * answer was none of them. So the workbench is gone with it. A panel that keeps every knob
 * it ever had stops being a workbench and becomes a settings screen, which is this decision
 * handed to a reader who has less to go on than we do.
 */

/** The face, vendored — see the `@font-face` rules in `index.css`.
 *
 *  A concrete stack, never a keyword like `ui-sans-serif`: the canvas and the SVG renderer
 *  resolve keywords independently, and measuring in one face while drawing in another is
 *  how every label in the app came to overrun its wedge. `widthPerPx` and `WedgeLabel`
 *  both read THIS string. */
export const FAMILY = '"LINE Seed JP", system-ui, -apple-system, sans-serif'

/** One weight for all three kinds of label.
 *
 *  Structure used to be set heavier than content — 600 for a directory against 500 for a
 *  function — on the argument that a signpost and a caption are different things. At this
 *  face they are not: the ring already tells them apart by size, by position and by the
 *  plate a directory sits on, and the extra weight only made the inner rings shout. */
export const WEIGHT = 400

/** Tracking, in em. Slightly NEGATIVE: this face sets open, and a name in a wedge competes
 *  for width with the wedge rather than with the line beside it. */
export const TRACKING = -0.04

/** Smallest type worth drawing. Below this a name says only that text is there.
 *
 *  Not cosmetic — it decides how MANY labels exist, because a name that cannot reach it is
 *  not drawn at all. */
export const MIN_SIZE = 6

/** How far a label sits back from full foreground.
 *
 *  A name is a caption on a wedge, not a second reading — at 1 it competes with the fill,
 *  which is the thing actually carrying the measurement.
 *
 *  There is no separation treatment behind it. Halo, shadow and plate were all built and
 *  all looked at: the halo reads as outlined type, the plate covers the very color the
 *  label is standing on, and the shadow is a wash. Plain type on the wedge won, so what
 *  ships is nothing. */
export const OPACITY = 0.88
