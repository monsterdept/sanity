import {
  MODE_HINT,
  MODE_LABEL,
  OTHER_LABEL,
  SLOTS,
  slotColor,
  type ColorMode, paintsFromReadings } from '../lib/colorMode'
import { heatColor, type Ramp } from '../lib/api'

/** The legend follows the mode. A heat ramp under a categorical encoding would be a
 *  lie — "owner" has no order, so showing a gradient would invent one. */
function Legend({
  mode,
  categories,
  history = false,
}: {
  mode: ColorMode
  categories: string[]
  history?: boolean
}) {
  // A replay paints one event and nothing else, so its key has one entry. Showing the age
  // ramp here while every wedge on screen is grey would be the legend describing a lens the
  // map is not using — see `colorFor` for why a frame is uncoloured.
  if (history) {
    return (
      <div className="flex items-center gap-2.5">
        {/* Squares, like the trap key below and for the same reason: these are events a
            wedge either had or did not, not positions on a scale. Arrival leads, because
            it is the loud one and the order on the key should match the order the eye
            picks them out in. */}
        {[
          ['--birth', 'new here'],
          ['--touch', 'touched'],
        ].map(([token, word]) => (
          <span key={token} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ background: `var(${token})` }}
            />
            <span className="text-[10px] text-[var(--muted-foreground)]">{word}</span>
          </span>
        ))}
      </div>
    )
  }
  if (categories.length > 0) {
    return (
      <div className="flex max-w-[300px] flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
        {/* Only the slots that have their own color are named individually. Listing
            the rest would imply they are distinguishable on screen, and they are not —
            they all share the "Other" neutral. */}
        {categories.slice(0, SLOTS).map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: slotColor(i) }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{c}</span>
          </span>
        ))}
        {categories.length > SLOTS && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--structure)' }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {OTHER_LABEL} ({categories.length - SLOTS})
            </span>
          </span>
        )}
      </div>
    )
  }
  // Traps is not a scale, so it does not get a scale's key.
  //
  // A gradient with two ends says "these are the extremes of a continuum" — and a trap is a
  // boolean somebody either reported or did not. Shading it would invent degrees of danger
  // nobody graded, and a two-ended label would ask the reader to find the middle of a set
  // with no middle. One filled bar in the color the map is actually using, named once.
  if (mode === 'traps') {
    return (
      <div className="flex items-center gap-2">
        {/* A square, the same shape as the stale and unread swatches below it — not the
            ramp's rounded bar. A bar spans, and spanning is what a scale does; this is one
            state a wedge either has or does not. The pill said "somewhere along here" about
            a value with no along. */}
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: 'var(--trap)' }}
        />
        <span className="text-[10px] text-[var(--muted-foreground)]">trap</span>
      </div>
    )
  }

  const ends: Record<string, [string, string]> = {
    // The row words this key sits above, not a fifth vocabulary: it read
    // `clear → unclear` while the rows beneath said something else entirely, and now the
    // rows say what `.sanity/` says.
    surprise: ['predictable', 'obscure'],
    // Same direction as heat: the bright end is the one you have to do something about.
    legible: ['clean', 'unclear'],
    // Named for the ends the ramp actually paints, and the bright one is an absence: this
    // is the only lens whose input is the GAP. See the `--docs-*` ramp.
    docs: ['covered', 'undocumented'],
    churn: ['settled', 'churning'],
    age: ['old', 'recent'],
  }
  const [lo, hi] = ends[mode] ?? ['', '']
  // The swatch has to walk the SAME ramp the wedges do, now that each reading owns a
  // hue — otherwise the key under a blue map is an amber gradient.
  const ramp: Ramp =
    mode === 'churn'
      ? 'churn'
      : mode === 'age'
        ? 'age'
        : mode === 'legible'
          ? 'legible'
          : mode === 'docs'
            ? 'docs'
            : 'heat'
  // Spans the widget rather than sitting in a fixed 96px well in the middle of it. The
  // ramp is the scale for the control directly above, and a short bar floating inside a
  // wider row read as two unrelated things stacked rather than one thing explaining the
  // other.
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {lo}
      </span>
      <div className="flex h-2 w-24 overflow-hidden rounded-full">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="flex-1" style={{ background: heatColor(i / 23, ramp) }} />
        ))}
      </div>
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {hi}
      </span>
    </div>
  )
}

/**
 * The mode switcher, floated over the top of the graph.
 *
 * Separate component from the key rather than one widget: they sit at opposite ends of
 * the picture now, and a component that had to be told where each half goes would be a
 * layout argument wearing a widget's clothes.
 */
export function ModeSwitcher({
  mode,
  onMode,
  disabled = false,
}: {
  mode: ColorMode
  onMode: (m: ColorMode) => void
  /** Grayed out, but still showing which encoding is in force.
   *
   *  History mode sets this. There the color is not a choice: a temperature is a reading
   *  taken against today's code, and four of the five lenses would be claiming a
   *  measurement of a commit nobody took it against. Hiding the control instead would
   *  leave the rings recolored with nothing on screen saying by what. */
  disabled?: boolean
}) {
  return (
    // A segmented control: one recessed track, segments inside it, and the selection as
    // a raised pill. Without the track it was five words floating in the chrome — nothing
    // said they were one control, that exactly one is chosen, or that the others could be
    // clicked. The track is what carries all three, and it is inset rather than raised so
    // the bar still reads as background with something set into it.
    <div
      role="tablist"
      className="flex items-center gap-0.5 rounded-full p-[3px]"
      style={{
        opacity: disabled ? 0.55 : 1,
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      {(Object.keys(MODE_LABEL) as ColorMode[]).map((k, i) => {
        const on = mode === k
        return (
          <button
            key={k}
            role="tab"
            aria-selected={on}
            onClick={() => !disabled && onMode(k)}
            disabled={disabled}
            // The shortcut rides in the tooltip rather than on the chip. Five chips with
            // a dim "⌘3" beside each label is a row of keyboard documentation where the
            // control itself should be — discoverable once, noise every time after.
            title={
              disabled
                ? 'A trace is uncoloured — a past commit has no reading, and nothing in the commit stream stood in for one'
                : `${MODE_HINT[k]}  (⌘${i + 1})`
            }
            className="rounded-full px-2.5 py-[3px] text-[11px] transition-colors"
            style={{
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
              fontWeight: on ? 600 : 400,
              // Only the chosen one lifts. A shadow on every segment would make the
              // track read as five buttons rather than one control with a position.
              boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
            }}
          >
            {MODE_LABEL[k]}
          </button>
        )
      })}
    </div>
  )
}

/** The key, boxed to match the switcher so the two read as a pair across the graph. */
export function ColorLegend({
  mode,
  categories,
  history = false,
  stale = 0,
  unread = 0,
}: {
  mode: ColorMode
  categories: string[]
  /** Replaying. The key then describes the flash rather than the pinned lens. */
  history?: boolean
  /** Wedges drawn with the stale hatch. Each entry only appears when there are some —
   *  a legend entry for a texture that is nowhere on screen teaches the reader to
   *  ignore the legend. */
  stale?: number
  /** Wedges drawn in the flat unanalyzed gray, having never been read. */
  unread?: number
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <Legend mode={mode} categories={categories} history={history} />
      {paintsFromReadings(mode) && (stale > 0 || unread > 0) && (
        /* The two things the ramp above cannot explain: a wedge can be hatched, or it can
           be uncolored. Both are absences of a reading rather than positions on the
           scale, which is exactly why they need saying — a reader who takes the gray for
           "cold" has read the map backwards.

           **Surprise only, because both are facts about READINGS and this is the one mode
           painted from them.** The map stops hatching outside this mode for the same
           reason, so the key follows it — but the gray needed the gate independently: an
           unread function still has an author, a date and a language, so in those modes it
           takes a real color and is not gray at all. "192 unread" beside a swatch nothing
           on screen is wearing describes a picture the reader cannot find.

           Each swatch is reproduced in CSS rather than by reusing the chart's own fill:
           two lines beat threading a <defs> out of the SVG, and they only have to look
           alike, not be the same object. They do have to STAY alike, though — the gray is
           `--unanalyzed` at 0.4 because that is what `Sunburst` draws an unread wedge
           with, and a key painted in a color the map does not use is worse than no key. */
        <div className="mt-1.5 flex items-center gap-3 border-t border-[var(--border)] pt-1.5">
          {stale > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-[var(--border)]"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, var(--foreground) 0 1.2px, transparent 1.2px 4px)',
                  opacity: 0.55,
                }}
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">{stale} stale</span>
            </span>
          )}
          {unread > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px] border border-[var(--border)]"
                style={{ background: 'var(--unanalyzed)', opacity: 0.4 }}
              />
              <span className="text-[10px] text-[var(--muted-foreground)]">{unread} unread</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
