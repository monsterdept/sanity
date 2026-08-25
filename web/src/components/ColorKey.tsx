import {
  CALLER_KEY,
  REACH_KEY,
  MODE_HINT,
  MODE_LABEL,
  OTHER_LABEL,
  SLOTS,
  slotColor,
  type ColorMode,
  paintsFromReadings,
  REPLAY,
  replayNote,
} from '../lib/colorMode'
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
  // **The events, and the lens as well when the lens is painting.** A replay used to key one
  // thing — arrival and edit — because the map was forced to `age` and the switcher greyed.
  // A frame carries its own churn, age and language, so the key now says both: what the
  // flashes mean, and what the colour underneath them is. A lens the replay cannot paint
  // (see `REPLAY`) leaves the wedges uncoloured, and its half of the key goes with them.
  if (history) {
    const events = [
      ['--birth', 'new'],
      ['--touch', 'changed'],
    ].map(([token, word]) => (
      // Squares, like the trap key below and for the same reason: these are events a wedge
      // either had or did not, not positions on a scale. Arrival leads, because it is the
      // loud one and the order on the key should match the order the eye picks them out in.
      <span key={token} className="flex items-center gap-1">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
          style={{ background: `var(${token})` }}
        />
        <span className="text-[10px] text-[var(--muted-foreground)]">{word}</span>
      </span>
    ))
    if (REPLAY[mode] !== 'live') return <div className="flex items-center gap-2.5">{events}</div>
    return (
      <div className="flex items-center gap-2.5">
        <Legend mode={mode} categories={categories} />
        {/* A hairline, because these are two keys for one picture rather than one key with
            six entries: above the rule is what the colour means, below it what a flash does. */}
        <span
          className="h-3 w-px shrink-0"
          style={{ background: 'color-mix(in oklch, var(--foreground) 20%, transparent)' }}
        />
        {events}
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

  // Callers is bands rather than a bar, and every band gets a swatch. A gradient would say
  // the value is continuous — a caller count is, but the PAINT is not, and a key that
  // implies four hundred shades over a picture holding four is a legend disagreeing with
  // what is beside it. The dim end is a finding as much as the bright one, which is why the
  // scale is labelled at both ends instead of only where the eye is drawn.
  if (mode === 'callers') {
    return (
      <div className="flex items-center gap-3">
        {CALLER_KEY.map(([fill, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: fill }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
          </span>
        ))}
      </div>
    )
  }

  // Reach is banded exactly as Callers is, and draws the same key for the same reason: the
  // two are a pair read down opposite sides of one edge, so anything that made them look
  // like different kinds of measurement would cost the comparison they exist for.
  // Clones is a mark and two neutrals, the shape Traps takes — see `--clone`. All three get
  // a swatch, unlike Traps where the ordinary case needs no key: here `no copy` and `too
  // small to compare` are different answers and the second is not a finding, so a reader
  // who saw only the purple could not tell a clean repo from an unmeasured one.
  if (mode === 'clones') {
    return (
      <div className="flex items-center gap-3">
        {[
          ['var(--clone)', 'a clone'],
          ['var(--structure)', 'unique'],
          ['var(--unanalyzed)', 'too small'],
        ].map(([fill, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: fill }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
          </span>
        ))}
      </div>
    )
  }

  if (mode === 'reach') {
    return (
      <div className="flex items-center gap-3">
        {REACH_KEY.map(([fill, label]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: fill }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>
          </span>
        ))}
      </div>
    )
  }

  const ends: Record<string, [string, string]> = {
    // The row words this key sits above, not a fifth vocabulary: it read
    // `clear → unclear` while the rows beneath said something else entirely, and now the
    // rows say what `.sanity/` says.
    surprise: ['mundane', 'obscure'],
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
 * The key that reaches this lens, or `null` where the shortcuts have run out.
 *
 * Nine digits, then ⌘0 for the tenth as every tab strip does, then ⌘- for the eleventh —
 * which is the position the old `(i + 1) % 10` wrapped at, so Age advertised ⌘1, a key that
 * selects Surprise. A twelfth lens gets no shortcut and says nothing about one, because a
 * tooltip naming a key that does something else is worse than a tooltip naming none. The
 * keys themselves live in `App`'s listener; this is the only place they are written down.
 */
const shortcut = (i: number) => (i < 9 ? `${i + 1}` : i === 9 ? '0' : i === 10 ? '-' : null)

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
  replaying = false,
}: {
  mode: ColorMode
  onMode: (m: ColorMode) => void
  /** A replay is on screen, so each lens answers for itself — see `REPLAY`.
   *
   *  **It used to disable the whole control.** That was right about the four lenses a
   *  reading paints and wrong about the rest: a frame knows what churn a function had in
   *  2019 and what language it was written in, and greying those out said the timeline
   *  could not answer a question it answers per frame. Nothing is disabled now; a lens the
   *  replay cannot paint is dimmed, stays clickable, and says why in the map. */
  replaying?: boolean
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
        opacity: 1,
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      {(Object.keys(MODE_LABEL) as ColorMode[]).map((k, i) => {
        const on = mode === k
        // Dimmed rather than disabled: the lens is still a place you can stand, and what it
        // has to say there — why a replay cannot paint it — is said in the map rather than
        // by a control that refuses to be pressed.
        const unpaintable = replaying && REPLAY[k] !== 'live'
        return (
          <button
            key={k}
            role="tab"
            aria-selected={on}
            onClick={() => onMode(k)}
            // The shortcut rides in the tooltip rather than on the chip. Five chips with
            // a dim "⌘3" beside each label is a row of keyboard documentation where the
            // control itself should be — discoverable once, noise every time after.
            title={
              unpaintable
                ? (replayNote(k) ?? '')
                : `${MODE_HINT[k]}${shortcut(i) ? `  (⌘${shortcut(i)})` : ''}`
            }
            className="rounded-full px-2.5 py-[3px] text-[11px] transition-colors"
            style={{
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
              fontWeight: on ? 600 : 400,
              // The selected lens keeps full weight even where the replay cannot paint it,
              // because the row still has to say which one you are standing in.
              opacity: unpaintable && !on ? 0.45 : 1,
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
