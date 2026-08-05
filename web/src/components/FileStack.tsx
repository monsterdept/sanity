import { useEffect, useMemo, useRef, useState } from 'react'
import { type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'

/**
 * One file, top to bottom.
 *
 * The rest of the app is radial because a directory is a **set** — things inside an
 * enclosure, with no first member and no last one, which is exactly what an annulus
 * encodes. A file is a **sequence**. It has a line 1. Projecting it onto a circle put the
 * first function at 9 o'clock and asked the reader to know that clockwise meant downward,
 * a convention with nothing on screen to teach it.
 *
 * Three things this can do that the ring could not:
 *
 * - **Position is line number.** Rows are laid out at their real offset in the file, so
 *   the gaps between functions — imports, type declarations, the two hundred lines of
 *   something that is not a function — are drawn as gaps. A circle has no way to say
 *   "nothing here"; it has to close up, which is why a sparse file still read as a solid
 *   dense ring.
 * - **Names fit.** Horizontal, at full size, at the left edge where the eye starts. In
 *   the ring they were bound to an arc, shrunk to fit it, and truncated when they still
 *   did not — three of a hundred and fifty were legible.
 * - **Every target is the same width.** A wedge is widest at the rim and pinches to
 *   nothing at the hub, so a slice's clickability varied along its own length and the
 *   thin ones were unhittable near the centre.
 *
 * What it gives up is the hub-as-back-button, and the breadcrumb above already does that.
 */

/** Room given to proportion, over and above what the floors already demand.
 *
 *  Measured in screens, and RELATIVE — an absolute cap cannot work, because the floors
 *  and the gap markers are fixed costs that scale with the number of functions, not with
 *  the room available. On a 150-function file they came to 4,190px on their own, which
 *  overshot a four-screen cap before a single row had grown at all, so the search drove
 *  the scale to zero and every row rendered at the floor: a 249-line function drawn the
 *  same as a three-line one. Budgeting on top of the floor instead means the proportional
 *  part always gets its say, however many rows there are. */
const SLACK_SCREENS = 1.6

/** The most of the pane one row may take.
 *
 *  Past about here a row has stopped saying anything a shorter one would not — you can
 *  already see it is the biggest thing in the file — and every pixel it keeps is taken
 *  from the rows that are still trying to differ from each other. On a file whose largest
 *  function is sixty times its median, the floors consume most of the budget and ALL the
 *  slack lands on that one outlier: 149 rows at the floor and one at 637px, three distinct
 *  sizes in a hundred and fifty. Capping the top gives the difference back to the middle. */
const MAX_ROW_SHARE = 0.22

/** Rows thinner than this cannot hold a label or a comfortable click. Pixels — the whole
 *  layout below is in pixels, because a row's floor is a physical size and mixing it with
 *  proportional units is how the first version of this put every row at 18% of the pane,
 *  asked for eighteen screens, and squeezed them back into an unreadable overlap. */
const MIN_ROW = 18

interface Row {
  node: Node
  /** Pixels from the top of the column. */
  top: number
  height: number
}

/** A gap this many lines wide is something other than functions — imports, a type
 *  declaration, a block of constants — and worth marking. Below it, it is a blank line. */
const GAP_LINES = 12

/** What a gap is drawn as. FIXED, not proportional: a 400-line gap and a 40-line one are
 *  both "there is other code here", and letting them scale is what made the column drift
 *  until the last function sat a thousand pixels below its own line number. */
const GAP_PX = 10

/**
 * Stack the functions in file order.
 *
 * The first version placed each row at its true line offset and floored its height, which
 * cannot be done together: with a hundred functions the floors alone want more room than
 * the file does, every row gets pushed past the one above, and the drift accumulates
 * until the end of the column has nothing to do with the end of the file. Position stops
 * meaning line number, which was the entire reason for placing them that way.
 *
 * So rows are consecutive, and their HEIGHT carries the size. Where a real gap sits
 * between two functions it is marked with a fixed, small spacer — enough to say "code
 * that is not a function lives here" without letting it push anything.
 *
 * The scale is fitted: if the whole file fits the pane it is stretched to fill it, and if
 * it does not, the pane scrolls. A long file is long.
 */
function layoutRows(fns: Node[], viewport: number): { rows: Row[]; height: number } {
  if (fns.length === 0) return { rows: [], height: viewport }

  const gapBefore = fns.map((f, i) => {
    if (i === 0) return false
    const prevEnd = fns[i - 1].endLine ?? fns[i - 1].line ?? 0
    return (f.line ?? 0) - prevEnd > GAP_LINES
  })

  const build = (scale: number) => {
    const rows: Row[] = []
    let y = 0
    fns.forEach((f, i) => {
      if (gapBefore[i]) y += GAP_PX
      const height = Math.min(
        Math.max(MIN_ROW, Math.max(f.loc, 1) * scale),
        Math.max(MIN_ROW, viewport * MAX_ROW_SHARE),
      )
      rows.push({ node: f, top: y, height })
      y += height + 1
    })
    return { rows, height: y }
  }

  // Fit to the pane if the file can be made to fit at ANY scale, right down to every row
  // sitting on the floor. Binary search across the whole range because the floors make
  // height(scale) piecewise — there is no closed form once some rows are pinned and
  // others are not.
  //
  // Searching upward from a minimum was the last bug: a 24-function file that would have
  // fitted at a slightly smaller scale never got the chance, because the search could not
  // go below where it started, and a file small enough to read in one screen scrolled
  // anyway.
  let lo = 0
  let hi = viewport
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2
    if (build(mid).height <= viewport) lo = mid
    else hi = mid
  }
  if (build(lo).height <= viewport) return build(lo)

  // It does not fit, so the column scrolls and the only question is how far.
  //
  // The budget is the floors plus a fixed allowance of slack. Everything below the floor
  // is a fixed cost — a row has to be clickable whatever it contains — so the only part
  // that can carry the size encoding is what is left over, and that has to be granted
  // rather than competed for.
  const floor = build(0).height
  let flo = 0
  let fhi = viewport
  const limit = floor + viewport * SLACK_SCREENS
  for (let i = 0; i < 28; i++) {
    const mid = (flo + fhi) / 2
    if (build(mid).height <= limit) flo = mid
    else fhi = mid
  }
  return build(flo)
}

export function FileStack({
  root,
  selected,
  mode,
  ranks,
  onSelect,
  onDrill,
}: {
  root: Node
  selected: Node | null
  mode: ColorMode
  ranks?: Map<string, number>
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  // Measured, not assumed: rows are positioned in pixels and the scale that turns lines
  // into pixels depends on how tall this pane actually is.
  const [viewport, setViewport] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el) return
    // Ignore sub-pixel jitter: a resize handler that feeds its own input needs a reason
    // to stop, and layout rounding alone can supply an endless supply of tiny deltas.
    const ro = new ResizeObserver(([e]) =>
      setViewport((prev) => (Math.abs(e.contentRect.height - prev) > 1 ? e.contentRect.height : prev)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fns = useMemo(
    () =>
      root.children
        .filter((c) => c.kind === 'func')
        .sort((a, b) => (a.line ?? 0) - (b.line ?? 0)),
    [root],
  )
  if (fns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <p className="max-w-sm text-[13px] leading-relaxed text-[var(--muted-foreground)]">
          No functions in <span className="mono">{root.name}</span> — nothing here parses
          into chunks a reader could be asked to predict.
        </p>
      </div>
    )
  }

  const { rows, height: needed } = layoutRows(fns, viewport - 32)

  return (
    // `absolute inset-0`, not `h-full`. The parent is a flex item, so a percentage
    // height has nothing definite to resolve against and the div sized to its CONTENT
    // instead — which the observer below then reported as the viewport, which made the
    // rows taller, which made the content taller. It grew on every frame, and the file
    // changed size while you looked at it. Pinned to the parent's box it cannot.
    <div
      ref={box}
      className="absolute inset-0 overflow-y-auto px-6 py-4 [overscroll-behavior:contain]"
    >
      {/* As tall as the file needs, never shorter than the pane — a short file should fill
          the view rather than huddle at the top, and a long one should run off the bottom
          the way it runs off the bottom of an editor. */}
      <div className="relative" style={{ height: Math.max(needed, viewport - 32) }}>
        {rows.map((r) => {
          const c = colorFor(r.node, mode, ranks)
          const isSel = selected?.id === r.node.id
          return (
            <button
              key={r.node.id}
              type="button"
              className="absolute left-0 right-0 flex items-center gap-2 overflow-hidden rounded-[var(--radius-sm)] pl-3 pr-2 text-left"
              style={{
                top: r.top,
                height: r.height,
                // A TINT of the reading, not the reading at full strength.
                //
                // The fill used to be `c.fill` outright, with labels in the background
                // colour — which is what the rings do, and works there because a file
                // wedge is always near the bright end. Here a row walks the whole ramp,
                // so cold rows came out dark and their names disappeared into them. A
                // tint keeps the mass readable as colour while leaving the text on a
                // surface it can contrast with; the stripe below carries the hue at full
                // strength, where nothing has to be legible on top of it.
                background: c
                  ? `color-mix(in oklch, ${c.fill} 24%, var(--card))`
                  : 'var(--secondary)',
                borderLeft: `4px solid ${c ? c.fill : 'var(--unanalyzed)'}`,
                outline: isSel ? '2px solid var(--foreground)' : undefined,
                outlineOffset: -2,
              }}
              onClick={() => onSelect(r.node)}
              onDoubleClick={() => onDrill(r.node)}
              title={`${r.node.name} · ${r.node.loc} lines${c ? ` · ${c.label}` : ''}`}
            >
              <span className="mono shrink-0 text-[11px] font-semibold">{r.node.name}</span>
              {/* The span it occupies, not just where it starts — this view is a map of
                  the file, so the row's extent is the thing you are looking up. */}
              <span className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {r.node.line}
                {r.node.endLine !== null && `:${r.node.endLine}`}
              </span>
              <span className="mono ml-auto shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {r.node.loc.toLocaleString()} lines
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
