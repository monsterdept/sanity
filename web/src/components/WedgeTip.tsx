import { isAnalyzed, type Node } from '../lib/api'
import {
  colorFor,
  paintsFromReadings,
  saysNothing,
  VIEWS_DEFAULT,
  type Views,
  type ColorMode,
} from '../lib/colorMode'
import { unreadable } from '../lib/api'
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
 * a number, never-read reads "not measured yet", expired reads "stale", and a stale reading
 * says so on hover rather than making you click for it. Two copies of that would drift the
 * way the two copies of
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
  views,
  folded,
  share,
  slice,
}: {
  node: Node
  /** Pointer position in container coordinates. */
  x: number
  y: number
  /** The pane, so the card can flip back across the pointer near an edge. */
  box: { w: number; h: number }
  mode: ColorMode
  ranks?: Map<string, number>
  /** How the two calibrated lenses are set, so the tooltip's swatch is the colour the wedge is wearing — see `Views`. */
  views?: Views
  /** Whether this node is folded shut, for geometries that fold. `undefined` means the
   *  geometry has no such gesture, and the card offers none — an affordance named in a
   *  view that does not have it is worse than silence. */
  folded?: boolean
  /** This node's share of the lines in the view it is drawn in, 0..1.
   *
   *  Printed only for a FOLDED directory, and that is the whole reason it is here: a fold
   *  gives the subtree's angle to its siblings, so the handle left behind is the one wedge
   *  on the map whose width says nothing about its size. The number it is no longer drawing
   *  goes here, one hover from the mark that suppressed it. Everywhere else the wedge IS
   *  the share and printing it would be the map annotating itself. */
  share?: number
  /** The segment of this container's rim the pointer is over — see `hoverSlice`.
   *
   *  **The share is of the DISTRIBUTION, not of the directory, and it now says so.** It read
   *  `% of this directory` over a denominator that was never the directory's lines: a rim
   *  counts function lines, and a file's total includes everything between its functions. The
   *  gap widened the moment roll-up stand-ins stopped being counted — in a replay most of a
   *  wedge can be folded away — so a number that was a little off became a number that was
   *  answering a different question.
   *
   *  **The rim answers before the wedge does, because it is the finer question.** A
   *  directory's rim is a distribution of what is inside it, and pointing at one band of it
   *  is asking about that band; answering with the directory's own totals would be replying
   *  to the question one level up from the one that was asked. The rest of the card still
   *  describes the directory, which is the context that makes the segment mean anything. */
  slice?: {
    label: string
    fill: string
    lines: number
    share: number
    /** How many values this segment stands for — see `rimRuns`. More than one when the
     *  picture had no room to draw them apart. */
    held: number
    /** Whether `label` names one of them. A categorical merge names none — its label is
     *  already `209 others` — so appending `+208 more` there would say the count twice and
     *  disagree with itself about which number is the members. */
    named: boolean
  } | null
}) {
  const c = colorFor(n, mode, ranks, views)
  const sc = n.score
  /** **"Not measured yet" is a fact about a READING, and most lenses are not readings.**
   *
   *  The card asked `isAnalyzed` whatever tab was on, so an unread function under Clones —
   *  a lens computed from the parse, whose wedge was right there on screen in the colour
   *  for its answer — hovered as "not measured yet". The map and its own tooltip disagreed
   *  about the same wedge, and the tooltip was the one that was wrong. Callers, Reach,
   *  Language and the three git lenses were all in the same state.
   *
   *  So the absence is asked per lens, exactly as `paintsFromReadings` is asked for the
   *  stale hatch and the legend: on a reading lens an unread wedge has nothing to say and
   *  says so, and everywhere else the paint's own label IS the answer. */
  const fromReading = paintsFromReadings(mode)
  const unread = fromReading && !isAnalyzed(n)
  /** Stale is a property of a reading too, so it marks nothing on a lens that has none. The
   *  same gate the wedge's own hatch takes. */
  const expired = fromReading && n.agentStale === true
  /** **"Not measured yet" is wrong here in the other direction.** Unread means nobody has
   *  got to this one; this wedge is past `READ_CEILING` and no run ever will, which is a
   *  different sentence and a finding rather than a gap. Asked before `unread`, because the
   *  node is genuinely unanalyzed and would otherwise take that label — which is exactly the
   *  answer eighteen readers in this corpus refused to accept before inventing a reading. */
  const tooBig = fromReading && unreadable(n)
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
  // What is worth knowing changes with the question being asked. Under Churn and Age
  // that's the raw counts behind the ramp; under Owner and Language the swatch's own
  // label IS the value and anything else would be padding.
  //
  // **Surprise adds nothing, and used to add `Documented 44`.** That was written when
  // documentation was a TERM inside the temperature — `surprise × (1 − explained)` — so
  // printing it beside the reading showed what the number was made of. It is not a term
  // any more: docs reach the instrument through the reader's prompt, and a doc that
  // explains the body lowers the surprise by being read, not by being subtracted. What
  // was left was the offline proxy's own `documented`, on a 0–100 scale, under a lens
  // that does not use it and beside a percentage that means something else entirely —
  // two numbers, two scales, one card, and the Docs tab is where the second one lives.
  const extras: [string, string][] = []
  if (sc && sc.ageDays !== null && mode === 'churn') {
    // The count for the rung the lens is set to, named by that rung's own days: the ladder is
    // the repo's (`ChurnView`), and before the timeline is walked every count is zero, which
    // would print a measurement nobody took.
    const churn = (views ?? VIEWS_DEFAULT).churn
    if (churn.measured)
      extras.push([`Commits (${churn.windows[churn.at]}d)`, String(sc.commits[churn.at])])
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
  const H =
    32 +
    extras.length * 16 +
    (n.kind === 'dir' ? 26 : 0) +
    (isFunc ? 16 : 0) -
    (saysNothing(n, mode) ? 16 : 0)
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
          <span className="font-semibold text-[var(--foreground)]">{elide(own, FITS_SMALL)}</span>
        </p>
      )}

      {/* The segment under the pointer, above the container's own reading and separated
          from it: the two are different subjects, and the whole point of the rim is that
          the fine one is available without drilling.

          A merged run says how many it stands for rather than naming one of them — see
          `rimRuns`. On a ramp it keeps the biggest member's color and adds `+N more`; on a
          categorical lens it is `other` outright, color and label both, because a band of
          two hundred people captioned with one of their names is the same overstatement the
          legend's `other` row was making until tonight. */}
      {slice && (
        <div className="mb-1.5 border-b border-[var(--border)] pb-1.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-[2px]"
              style={{ background: slice.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-snug">
              {elide(slice.label, FITS_SMALL)}
              {slice.held > 1 && slice.named && (
                <span className="font-normal text-[var(--muted-foreground)]">
                  {' '}
                  +{slice.held - 1} more
                </span>
              )}
            </span>
          </div>
          <p className="mono mt-0.5 text-[10px] leading-snug text-[var(--muted-foreground)]">
            {slice.lines.toLocaleString()} lines · {Math.round(slice.share * 100)}% of what is
            measured here
          </p>
        </div>
      )}

      {/* The reading is the SWATCH — it is a color on the map, so stating it as a
          number here would be describing the encoding rather than reading it. The
          label beside it names the value, which is what keeps identity off color
          alone. */}
      {/* The reading gets the row to itself, and size goes below it.
          They shared a line, on the argument that "46 lines" is a two-word fact that does
          not deserve one — true, and it cost the half that does. The reading is the only
          thing on this card that changes with the lens, and it is the half that has to
          EXPLAIN itself: `50% undescribed` and `12% unpredicted` are sentences, and sharing
          a row with a size that never shrinks left them elided to `50% und…`. A number
          nobody can read the units of is worse than one more line on the card. */}
      {!saysNothing(n, mode) && (
        <div className="flex items-baseline gap-1.5">
          {/* Hatched when the reading has expired, the same 45° rule the wedge and the key
            both wear. The swatch's whole job is to be the color you are pointing at, and a
            flat square beside the word `stale` described a wedge that is not on screen —
            the one on screen is hatched. Reproduced in CSS rather than reaching into the
            SVG's <defs>: it only has to look alike, but it does have to STAY alike, so the
            angle and the pitch are `#stale-hatch`'s. */}
          <span
            className="h-2.5 w-2.5 shrink-0 translate-y-px rounded-[2px]"
            style={{
              background: !unread && c ? c.fill : 'var(--unanalyzed)',
              backgroundImage: expired
                ? 'repeating-linear-gradient(45deg, var(--foreground) 0 1.2px, transparent 1.2px 4px)'
                : undefined,
            }}
          />
          {/* A stale wedge says `stale`, not `not measured yet`. Both are absences of a
            CURRENT reading and the wedge falls back to the proxy for either, but they are
            not the same absence: one has never been looked at, the other was read and the
            code moved out from under it. Saying "not measured yet" over a hatched wedge
            contradicted the sentence directly beneath it, which was explaining why the
            reading no longer counts. */}
          <span className="truncate text-[11px]">
            {expired
              ? 'stale'
              : tooBig
                ? 'too large to read'
                : unread || !c
                  ? 'not measured yet'
                  : c.label}
          </span>
        </div>
      )}
      {/* Its own line, under the reading rather than beside it — the quiet half, and the
          one that never changes with the lens. */}
      <p className="mono mb-1 truncate text-[10px] tabular-nums text-[var(--muted-foreground)]">
        {n.loc.toLocaleString()} lines
        {n.kind !== 'func' && ` · ${countFiles(n).toLocaleString()} files`}
        {/* A roll-up says how much it is standing in for, because its whole reason to
            exist is that those members are not on screen. Without it the card describes a
            wedge the reader cannot account for. */}
        {n.rest !== undefined && ` · ${n.rest.toLocaleString()} functions`}
      </p>

      {/* Said on hover, not only on click. A hatched wedge poses a question — why
          is this one different — and making you select it to get the answer is a
          click charged for reading the map. */}
      {expired && (
        <p className="mb-1 text-[10px] leading-snug text-[var(--warning)]">
          Changed since last reading
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
            ? `${n.children.length} folded${
                share !== undefined && share >= 0.005
                  ? ` · ${Math.round(share * 100)}% of this view, given back to the ring`
                  : ''
              } — ⌥-click to open`
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
