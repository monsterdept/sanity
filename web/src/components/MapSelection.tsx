import { type Node } from '../lib/api'
import { arcPath } from '../lib/sunburst'
import { type Geo } from '../lib/zoom'
import { type MapModel } from './mapModel'
import { type Tiled } from './MapPatches'

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

export interface Marks {
  selMark: Mark | null
  hoverMark: { d: string; width: number } | null
  selCoarse: (Mark & { depth: number }) | null
}

/** The marks this frame carries: the selection's outline, the pointer's, and the stand-in for a
 *  selection that is not drawn.
 *
 *  Walked over the same wedges and the same tiling the layers draw, in the order they draw
 *  them, so a mark can never outline a shape the picture does not have. */
export function marksOf(
  { root, selected, selTrail, wedges }: MapModel,
  geo: (id: string) => Geo,
  tiled: Tiled,
  hover: Node | null,
): Marks {
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

  if (root.kind !== 'file') {
    for (const w of wedges) {
      if (w.node.kind === 'func') continue
      const { a0, a1, r0, r1 } = geo(w.node.id)
      if (selected?.id === w.node.id)
        selMark = { d: arcPath(a0, a1, r0, r1), a0, a1, r0, kind: w.node.kind, width: 2 }
      else if (hover?.id === w.node.id) hoverMark = { d: arcPath(a0, a1, r0, r1), width: 1.6 }
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
    }
  }
  for (const { slots } of tiled) {
    for (const slot of slots ?? []) {
      const d = arcPath(slot.a0, slot.a1, slot.r0, slot.r1)
      if (selected?.id === slot.node.id)
        selMark = { d, a0: slot.a0, a1: slot.a1, r0: slot.r0, kind: 'func', width: 1.6 }
      else if (hover?.id === slot.node.id) hoverMark = { d, width: 1.2 }
    }
  }
  return { selMark, hoverMark, selCoarse }
}

/** The pointer's outline, the veil the selection is cut out of, and the selection's own outline
 *  — or its dashed stand-in. */
export function Selection({ marks: { selMark, hoverMark, selCoarse } }: { marks: Marks }) {
  return (
    <>
      {/* Evaluated after both wedge passes, so both marks are already set — and drawn
          after them, so no sibling's fill can eat half their width. Hover first, so a
          wedge that is somehow both keeps the heavier selection stroke on top. */}
      {hoverMark && (
        <path
          className="pointer-events-none"
          d={hoverMark.d}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={hoverMark.width}
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
              (selMark ?? selCoarse) as Mark,
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
          d={selMark.d}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={selMark.width}
        />
      )}
      {/* Only when the selection itself was not drawn — see `selCoarse`. The hole is its
          deepest drawn ancestor, so the map says "in here"; the dashes stay, because a
          container standing in for its contents must not read as the thing itself. */}
      {!selMark && selCoarse && (
        <path
          d={selCoarse.d}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.4}
          strokeDasharray="4 3"
          strokeOpacity={0.7}
          className="pointer-events-none"
        />
      )}
    </>
  )
}
