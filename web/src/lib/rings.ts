/**
 * How many rings the map draws, and why that is a choice at all.
 *
 * The count was a constant for as long as there has been a sunburst here, on an argument
 * that is still right: deeper than about five and the outer annuli are hairlines, and the
 * answer to depth is to drill in, which re-roots the circle on the subtree you asked
 * about.
 *
 * **Drawing every ring and letting the reader pan and zoom was built, and thrown away.**
 * It works — the rings can be drawn to the tree's own depth, with a fixed band and a
 * camera over the top — and it is worse. A sunburst encodes size as ANGLE, and a camera
 * cannot give you more angle: a slice two degrees wide is two degrees wide magnified, at
 * which point you are reading a sliver of a circle whose shape says nothing, while
 * drilling into the same subtree makes it the whole three hundred and sixty. That is the
 * difference between a view you can move around and a view you have to re-root, and it is
 * why depth past legibility is not something a camera fixes. What the experiment did leave
 * behind is `LayoutOpts.minAngleAt`, which was correct all along and is worth more the more
 * rings there are.
 *
 * What is genuinely a judgement is where "about five" falls, because it depends on the
 * repo and the window — a flat project on a large display has room for more than a deep
 * one on a laptop — and unlike most of the numbers in this codebase the reader can see the
 * consequence of changing it immediately, in the picture, and decide. That is the whole
 * test for whether something should be a control: the reader batch size failed it, because
 * its consequences hide in a corpus months later; this passes it.
 *
 * Bounded rather than open, on the same evidence. Under three there is not enough
 * hierarchy on screen to be worth the pane; past eight every wedge in the outer band is a
 * hairline, which is the state the control exists to let somebody approach deliberately
 * rather than fall into. A number box would offer forty, and forty has been looked at.
 *
 * It is a display preference and it is stored like one — `theme.ts` is the model, down to
 * failing quietly when storage is unavailable. Not per project: the same person on the
 * same screen wants the same density whatever repo they open, and a per-repo copy is a
 * second place for it to drift.
 */

export const RINGS_DEFAULT = 5

/** The counts the switcher offers. */
export const RINGS_RANGE = [3, 4, 5, 6, 7, 8] as const

export const RINGS_MIN = RINGS_RANGE[0]
export const RINGS_MAX = RINGS_RANGE[RINGS_RANGE.length - 1]

const KEY = 'sanity.rings'

/** Clamped rather than refused: a stored value from a build with a different range is a
 *  preference somebody expressed, and the nearest count this build draws is closer to what
 *  they asked for than the default is. */
export function loadRings(): number {
  try {
    const raw = Number(localStorage.getItem(KEY))
    if (Number.isFinite(raw) && raw > 0) {
      return Math.min(RINGS_MAX, Math.max(RINGS_MIN, Math.round(raw)))
    }
  } catch {
    /* storage unavailable — the default is a fine answer */
  }
  return RINGS_DEFAULT
}

export function saveRings(n: number): void {
  try {
    localStorage.setItem(KEY, String(n))
  } catch {
    /* the preference just won't survive a restart */
  }
}
