/**
 * The three geometry tweaks that are not the ring count: how a directory's band is framed,
 * how wide the cut between two neighbours is, and how wide the gutter between two levels is.
 *
 * **They are controls for the same reason the ring count is one, and no other.** `rings.ts`
 * states the test: something belongs on a control when the reader can see the consequence of
 * changing it immediately, in the picture, and decide — as against the reader batch size,
 * whose consequences hide in a corpus months later. All three of these are visible in the
 * frame they change, on the repo in front of you, and all three have a defensible default
 * that is nonetheless a judgement about how much separation a picture needs before its levels
 * read as different KINDS of thing. That judgement depends on the repo's depth and on how big
 * the window is, which is exactly the shape of thing a constant cannot settle.
 *
 * **They are scales, not lengths, and that is deliberate.** `CUT` is three numbers — 2.2 for a
 * directory, 1.5 for a file, 0.35 for a function — and the RATIO between them is argued in
 * `Sunburst`: the finer the level, the narrower its cut, or a file's rim swallows the
 * functions inside it. A slider handing out absolute widths would let a reader flatten that
 * ratio without ever being told there was one, so what moves is a multiplier over all three
 * at once and the argued proportions survive every position of it. The ring gutter is a single
 * number and could have been absolute; it is a percentage too, because two sliders side by
 * side that read in different units are two sliders somebody compares by their handles.
 *
 * Stored, and `theme.ts` is the model down to failing quietly when storage is unavailable —
 * and not per project, on `rings.ts`'s argument: the same person on the same screen wants the
 * same density whatever repo they open, and a per-repo copy is a second place for it to drift.
 * This is where they part from `rimShare`, whose control says in its own doc that it is for
 * looking rather than for deciding and is deliberately not stored.
 */

/** Every tweak in the spacing panel, in one record — see `Sunburst`, which is where each of
 *  these lands. */
export type Spacing = {
  /** Whether a directory's coloured band is floated inside its plate with ground visible all
   *  the way round it, or sits flush to the wedge's edges.
   *
   *  On is what the map drew for as long as the band was a few pixels of one colour, and
   *  `DIR_RIM_INSET_PX` carries the argument for it. It is off by default now — see
   *  `SPACING_DEFAULT`, which is where that turn is written down. */
  border: boolean
  /** Multiplier on `CUT` — the gap between one wedge and the neighbour beside it. */
  slice: number
  /** Multiplier on `RING_GAP` — the gutter between one level of the tree and the next. */
  ring: number
  /** How thick each ring is, as a multiple of the share of the radius it gets by default.
   *
   *  **What it actually moves is the hub, and it has to.** The rings run from the hub out to a
   *  fixed rim, and the view is fitted to whatever is drawn — so scaling every radius at once
   *  changes nothing at all, it just zooms back out. The one free parameter is where the rings
   *  START: thicker rings eat into the disc in the middle, thinner ones give it back. That is
   *  the real trade, and it is worth a control because the two ends are wanted by different
   *  repos — a deep tree wants every unit of radius it can have, and a shallow one has radius
   *  to spare and a creature in the middle worth looking at.
   *
   *  The hub's own contents scale with it. A fixed 94-unit creature in a disc half that wide
   *  is the same bug as a fixed label size in a shrinking circle. */
  width: number
}

/** **The frame is off by default, and that is a reversal.** `DIR_RIM_INSET_PX` argues for it
 *  and the argument still holds as far as it goes: flush against the edge, a band reads as the
 *  wedge's own outline, and an outlined directory is a directory that IS that colour — a
 *  sentence a roll-up cannot support. What has changed underneath the argument is the band. It
 *  was a few pixels carrying one colour when the inset was written, and it is now a
 *  distribution across a fifth of the ring; a stacked bar that wide reads as something the
 *  plate is carrying whether or not there is ground around it, so the frame is defending
 *  against a misreading the band's own size already prevents. Looked at side by side on ceph,
 *  what the frames actually cost is legible at a glance and what they buy is not.
 *
 *  A reader who has turned it on has `border: true` stored and keeps it. */
export const SPACING_DEFAULT: Spacing = { border: false, slice: 1, ring: 1, width: 1 }

/** How much of each ring a directory's own band takes — see `Sunburst`'s `rimShare`.
 *
 *  **A fifth, and the two ends are wrong in opposite directions.** At zero the rim is a few
 *  pixels and a container's distribution is drawn where nobody looks, with its flat mean
 *  behind: `sanity`'s `src-tauri` read as one shade of purple while the pane beside it showed
 *  2,660 / 1,693 / 3,663 / 14,727. At one the segments stop being arc LENGTHS and become
 *  areas — and area is the encoding this map already spends on lines, so a proportion silently
 *  turns into a quantity.
 *
 *  A fifth is enough to read four bands off a directory and little enough that the band is
 *  obviously a summary of the wedge rather than a measurement of its own.
 *
 *  **It had a slider while that argument was being had.** It was had, on real repos, and
 *  nothing since has wanted a different number — so it is a constant and the bar has its room
 *  back. Here rather than in `App` because it belongs with the other settled answer about how
 *  the map is drawn. */
export const BAND_SHARE = 0.2

/** How far either slider travels, as a multiple of the constant it scales.
 *
 *  Zero is a real position on both and not a degenerate one: no cut is a ring drawn as a
 *  continuous mass, which is what this map looked like before the cuts existed and is worth
 *  being able to see again. The top end is where more separation stops buying anything — past
 *  about three cuts a thin wedge is mostly its own gap, and past four gutters the outer band
 *  is a hairline for the same reason too many rings makes one. */
export const SLICE_MAX = 3
export const RING_MAX = 4

/** How far the ring width travels, and unlike the two above it is bounded at BOTH ends —
 *  because both ends run out of something real rather than merely stopping being useful.
 *  Under about 60% the rings have given away so much radius that the outer band is thinner
 *  than the labels hanging off it; over about 110% the hub has nothing left to be a hub with,
 *  and the hub is the target for going up a level as well as the creature's home. */
export const WIDTH_MIN = 0.6
export const WIDTH_MAX = 1.1
