/**
 * What the middle of the map holds: two circles in the lens's colors.
 *
 * The hub is the circles, and `HubCircles` draws them.
 *
 * The hub disc stays whatever is drawn on it, and so does the layer over it: that layer carries
 * the findings count and its click, which is the map's only way into the findings panel, and the
 * double-click that goes up a level.
 */

/**
 * How the circles are drawn. Sizes are shares of the hub's radius.
 *
 * The shadow is centred under the dot's rest position and holds still. Offset below the dot, it
 * was uncovered by every glance up and hidden by every glance down, and the dot seemed to look up
 * more than down. Centred, it shows the same on every side.
 *
 * `travel` tops out where the dot's edge would reach the dark disc's: 0.34 + 0.26 = 0.6.
 *
 * `step` is how much the dot shrinks for each level drilled in, and grows back coming out: at
 * depth `d` it is drawn at `(1 − step)^d` of its size at the repo root.
 */
export interface CirclesLook {
  shadow: number
  color: string
  alpha: number
  travel: number
  step: number
  /** The whole drawing's scale, discs, shadow and travel together. 1 is the sizes in
   *  `HubCircles`; 1.6 takes the dark disc almost to the hub's rim. */
  size: number
  /** Whether the dot follows the pointer. Off, it follows only the flashing wedges and its own
   *  glances, which is the eye's idle sequence without the part that answers the mouse. */
  mouse: boolean
  /** Whether the dot moves of its own accord: idle glances, glances away from what it is
   *  looking at, and the jitter. Off, it looks only at the flashing wedges, the clicked one and
   *  the pointer (if `mouse`), and rests in the middle otherwise. */
  idle: boolean
  /** One more circle for each level drilled in: `2 + depth` of them, two at the repo root. The
   *  outer disc keeps its size and the dot keeps its `step`; the circles between are spaced
   *  geometrically, each the same fraction of the one outside it, and each wears the reading
   *  of a level drilled through, from the repo's outside to the dot's. Each drifts in
   *  proportion to how far in it sits. */
  nest: boolean
}

/** The one way they are drawn. It was a stored preference with a panel of sliders behind the
 *  hub's picker; the picker is gone and these are the values it settled on. */
export const CIRCLES: CirclesLook = {
  shadow: 0.32,
  color: '#000000',
  alpha: 0.1,
  travel: 0.075,
  step: 0.24,
  size: 1,
  mouse: false,
  idle: false,
  nest: false,
}
