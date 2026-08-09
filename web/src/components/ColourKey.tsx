import {
  MODE_HINT,
  MODE_LABEL,
  OTHER_LABEL,
  slotColor,
  type ColorMode,
} from '../lib/colorMode'
import { heatColor, type Ramp } from '../lib/api'

/** The legend follows the mode. A heat ramp under a categorical encoding would be a
 *  lie — "owner" has no order, so showing a gradient would invent one. */
function Legend({ mode, categories }: { mode: ColorMode; categories: string[] }) {
  if (categories.length > 0) {
    return (
      <div className="flex max-w-[300px] flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
        {/* Only the slots that have their own colour are named individually. Listing
            the rest would imply they are distinguishable on screen, and they are not —
            they all share the "Other" neutral. */}
        {categories.slice(0, 4).map((c, i) => (
          <span key={c} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: slotColor(i) }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{c}</span>
          </span>
        ))}
        {categories.length > 4 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--structure)' }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {OTHER_LABEL} ({categories.length - 4})
            </span>
          </span>
        )}
      </div>
    )
  }
  const ends: Record<string, [string, string]> = {
    surprise: ['clear', 'unclear'],
    churn: ['settled', 'churning'],
    age: ['old', 'recent'],
  }
  const [lo, hi] = ends[mode] ?? ['', '']
  // The swatch has to walk the SAME ramp the wedges do, now that each reading owns a
  // hue — otherwise the key under a blue map is an amber gradient.
  const ramp: Ramp = mode === 'churn' ? 'churn' : mode === 'age' ? 'age' : 'heat'
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
  /** Greyed out, but still showing which encoding is in force.
   *
   *  History mode sets this. There the colour is not a choice: a temperature is a reading
   *  taken against today's code, and four of the five lenses would be claiming a
   *  measurement of a commit nobody took it against. Hiding the control instead would
   *  leave the rings recoloured with nothing on screen saying by what. */
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
                ? 'Pinned to recency while history plays — a past commit has no surprise reading'
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
export function ColourLegend({
  mode,
  categories,
  stale = 0,
  unread = 0,
}: {
  mode: ColorMode
  categories: string[]
  /** Wedges drawn with the stale hatch. Each entry only appears when there are some —
   *  a legend entry for a texture that is nowhere on screen teaches the reader to
   *  ignore the legend. */
  stale?: number
  /** Wedges drawn in the flat unanalysed grey, having never been read. */
  unread?: number
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <Legend mode={mode} categories={categories} />
      {mode === 'surprise' && (stale > 0 || unread > 0) && (
        /* The two things the ramp above cannot explain: a wedge can be hatched, or it can
           be uncoloured. Both are absences of a reading rather than positions on the
           scale, which is exactly why they need saying — a reader who takes the grey for
           "cold" has read the map backwards.

           **Surprise only, because both are facts about READINGS and this is the one mode
           painted from them.** The map stops hatching outside this mode for the same
           reason, so the key follows it — but the grey needed the gate independently: an
           unread function still has an author, a date and a language, so in those modes it
           takes a real colour and is not grey at all. "192 unread" beside a swatch nothing
           on screen is wearing describes a picture the reader cannot find.

           Each swatch is reproduced in CSS rather than by reusing the chart's own fill:
           two lines beat threading a <defs> out of the SVG, and they only have to look
           alike, not be the same object. They do have to STAY alike, though — the grey is
           `--unanalyzed` at 0.4 because that is what `Sunburst` draws an unread wedge
           with, and a key painted in a colour the map does not use is worse than no key. */
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
