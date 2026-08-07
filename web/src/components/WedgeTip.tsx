import { isAnalyzed, type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { elide } from '../lib/text'

/** Characters that fit on one line of the tooltip, at its two type sizes.
 *
 *  Measured against the card rather than guessed: 250px less 12px of padding either side
 *  is 226px, and the monospace advance is close enough to 0.62em that 10px text seats 35
 *  and 12px text seats 30. Deliberately a little under — `truncate` is still on those
 *  lines as a backstop, and if the budget overshoots, CSS elides the tail a SECOND time
 *  and eats the end that `elide` just worked to keep. */
const FITS_SMALL = 35
const FITS_LARGE = 30

/** Files at or under a node — the count the tooltip reports.
 *
 *  Walked on demand for the one hovered node rather than precomputed for the whole
 *  tree: it runs at pointer-move rate over a single subtree, which is far cheaper than
 *  maintaining a map that most of the time nobody reads. */
function countFiles(n: Node): number {
  if (n.kind === 'file') return 1
  let total = 0
  for (const c of n.children) total += countFiles(c)
  return total
}

/**
 * What a wedge says when you point at it — shared by every geometry that draws one.
 *
 * Extracted when the treemap arrived rather than copied into it. The card is a contract
 * about what the map is willing to claim for a node: the reading is the SWATCH and never
 * a number, absence reads "not measured yet", and a stale reading says so on hover rather
 * than making you click for it. Two copies of that would drift the way the two copies of
 * the MCP schema did, and the half that drifted would be the one nobody was looking at.
 *
 * Geometry-independent by construction: it takes a node and a pointer position, and knows
 * nothing about arcs or rectangles.
 */
export function WedgeTip({
  node: n,
  x,
  y,
  box,
  mode,
  ranks,
  folded,
}: {
  node: Node
  /** Pointer position in container coordinates. */
  x: number
  y: number
  /** The pane, so the card can flip back across the pointer near an edge. */
  box: { w: number; h: number }
  mode: ColorMode
  ranks?: Map<string, number>
  /** Whether this node is folded shut, for geometries that fold. `undefined` means the
   *  geometry has no such gesture, and the card offers none — an affordance named in a
   *  view that does not have it is worse than silence. */
  folded?: boolean
}) {
  const c = colorFor(n, mode, ranks)
  const sc = n.score
  const analyzed = isAnalyzed(n)
  // The whole path, with the node's own segment picked out — showing the name and
  // then the path again repeated the last word on every hover.
  //
  // That dedup is right for directories and files, where `name` IS the last path
  // segment. It is wrong for a FUNCTION, whose name appears nowhere in its path —
  // so hovering a chunk showed the file it lives in and never once said which
  // function you were pointing at, which is the only thing the hover was for.
  // Functions get their own shape below: name first, then where to find it.
  const isFunc = n.kind === 'func'
  const parts = n.path.split('/')
  const own = parts.pop() ?? n.name
  // What is worth knowing changes with the question being asked. Under Surprise
  // that's the two terms the reading is made of; under Churn and Age it's the raw
  // counts behind the ramp; under Owner and Language the swatch's own label IS the
  // value and anything else would be padding.
  const extras: [string, string][] = []
  if (sc && analyzed && mode === 'surprise') {
    extras.push(['Documented', String(Math.round(sc.documented * 100))])
  } else if (sc && sc.ageDays !== null && mode === 'churn') {
    extras.push(['Commits (90d)', String(sc.commits)])
    extras.push(['First seen', `${Math.round(sc.ageDays)}d ago`])
  } else if (sc && sc.lastTouchedDays !== null && mode === 'age') {
    extras.push(['Last touched', `${Math.round(sc.lastTouchedDays)}d ago`])
    if (sc.ageDays !== null) extras.push(['First seen', `${Math.round(sc.ageDays)}d ago`])
  }
  const W = 250
  // Only used to decide which way to flip near an edge, so an estimate is fine —
  // but it has to track the content, or the card flips the wrong way at the bottom
  // of the window and lands under the cursor. Base covers the path row and the
  // reading row; a function adds a name line above them, and size no longer has a
  // row of its own.
  const H = 32 + extras.length * 16 + (n.kind === 'dir' ? 26 : 0) + (isFunc ? 16 : 0)
  const flipX = x + W + 18 > box.w
  const flipY = y + H + 18 > box.h
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 shadow-lg"
      style={{
        maxWidth: W,
        left: flipX ? undefined : x + 14,
        right: flipX ? box.w - x + 14 : undefined,
        top: flipY ? undefined : y + 14,
        bottom: flipY ? box.h - y + 14 : undefined,
      }}
    >
      {isFunc ? (
        // Name first, on its own line. It is the answer to the question the hover
        // asks, and burying it at the end of a wrapped path — where the path is
        // long enough to wrap in a 250px card — is the same as not showing it.
        <>
          <p className="mono mb-0.5 truncate text-[12px] font-semibold leading-snug">
            {elide(n.name, FITS_LARGE)}
          </p>
          {/* The line number is its own element and never shrinks. Folding it into
              the elided string meant it competed with the path for the same budget
              and lost — the card showed `Store.swift:` with the number cut off,
              which is worse than omitting it, because a trailing colon reads as
              truncated data rather than absent data. */}
          <p className="mono mb-1 flex text-[10px] leading-snug text-[var(--muted-foreground)]">
            <span className="min-w-0 truncate">
              {elide(n.path, FITS_SMALL - (n.line !== null ? `:${n.line}`.length : 0))}
            </span>
            {n.line !== null && <span className="shrink-0">:{n.line}</span>}
          </p>
        </>
      ) : (
        <p className="mono mb-1 truncate text-[11px] leading-snug text-[var(--muted-foreground)]">
          {/* The own segment is the identity, so it keeps whatever room it needs and
              the leading path gives way — elided from its own start, since what
              matters there is the directory immediately containing this one. */}
          {parts.length > 0 &&
            `${elide(parts.join('/'), Math.max(6, FITS_SMALL - 1 - own.length))}/`}
          <span className="font-semibold text-[var(--foreground)]">
            {elide(own, FITS_SMALL)}
          </span>
        </p>
      )}

      {/* The reading is the SWATCH — it is a colour on the map, so stating it as a
          number here would be describing the encoding rather than reading it. The
          label beside it names the value, which is what keeps identity off colour
          alone. */}
      {/* Reading and size on one row. They were stacked, which gave a two-word
          fact ("46 lines") a whole line of its own and pushed everything below it
          down — on a card this small, three single-item rows in a column read as a
          list of unrelated things rather than one description of one wedge.

          Size is deliberately the quiet half: it is the axis you already know, and
          the swatch beside it is the axis that is worth reading. */}
      <div className="mb-1 flex items-baseline gap-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-[2px]"
          style={{ background: analyzed && c ? c.fill : 'var(--unanalyzed)' }}
        />
        <span className="truncate text-[11px]">
          {analyzed && c ? c.label : 'not measured yet'}
        </span>
        {/* Never shrinks, and the label gives way instead — under Owner or Language
            the label is a category name of unbounded length, and letting it push the
            size off the row would lose the one number that is always meaningful. */}
        <span className="mono ml-auto shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {n.loc.toLocaleString()} lines
          {n.kind !== 'func' && ` · ${countFiles(n).toLocaleString()} files`}
          {/* A roll-up says how much it is standing in for, because its whole reason
              to exist is that those members are not on screen. Without it the card
              describes a wedge the reader cannot account for. */}
          {n.rest !== undefined && ` · ${n.rest.toLocaleString()} functions`}
        </span>
      </div>

      {/* Said on hover, not only on click. A hatched wedge poses a question — why
          is this one different — and making you select it to get the answer is a
          click charged for reading the map. */}
      {n.agentStale && (
        <p className="mb-1 text-[10px] leading-snug text-[var(--warning)]">
          Read before, but the code has changed since — that reading no longer colours
          this wedge.
        </p>
      )}

      {extras.length > 0 && (
        <dl className="mt-1.5 space-y-0.5 border-t border-[var(--border)] pt-1.5 text-[11px]">
          {extras.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-[var(--muted-foreground)]">{k}</dt>
              <dd className="mono tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {n.kind === 'dir' && n.children.length > 0 && folded !== undefined && (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] text-[var(--muted-foreground)]">
          {folded
            ? `${n.children.length} folded — ⌥-click to open`
            : '⌥-click to fold · double-click to drill in'}
        </p>
      )}
      {n.kind === 'dir' && n.children.length > 0 && folded === undefined && (
        <p className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[10px] text-[var(--muted-foreground)]">
          Double-click to drill in
        </p>
      )}
    </div>
  )
}
