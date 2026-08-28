import {
  CALLER_KEY,
  REACH_KEY,
  MODE_HINT,
  MODE_LABEL,
  OTHER_LABEL,
  NAMED,
  shared,
  RAMP_ENDS,
  rampOf,
  slotColor,
  type ColorMode,
  paintsFromReadings,
} from '../lib/colorMode'
import { useState } from 'react'
import { heatColor, type Ramp } from '../lib/api'

/** A padlock, for a lens with nothing in it yet.
 *
 *  **Tinted to the control that opens it.** A lock whose key is a button three inches away is
 *  only useful if you can tell WHICH button, so one that an action would open takes the
 *  accent — the colour Read and Trace are painted in — and one that nothing can open stays in
 *  the muted ink. The tooltip names the button either way; the colour is what makes the row
 *  scannable without reading eleven tooltips.
 *
 *  (Read and Trace are both `--accent` today, so the hue says "a button in the sidebar" rather
 *  than which of the two. Distinguishing them is a decision about those buttons, not this.) */
export function Lock({ keyed }: { keyed: boolean }) {
  return (
    <svg
      width="7"
      height="7"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      style={{
        color: keyed ? 'var(--accent)' : 'var(--muted-foreground)',
        opacity: keyed ? 1 : 0.7,
      }}
    >
      <rect x="2.5" y="5.5" width="7" height="5.5" rx="1.2" fill="currentColor" />
      <path
        d="M4.25 5.5V3.9a1.75 1.75 0 0 1 3.5 0v1.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** What a lens is waiting for, when it is waiting for something.
 *
 *  **A lens with nothing in it is locked rather than shown empty.** Dimmed-but-clickable was
 *  the first shape and it asked the user to find out by pressing: the tab looked available,
 *  the map went grey, and the control that would fix it was in another panel. A lock says the
 *  same thing before the click and costs nothing to read. */
export interface Locked {
  /** What would open it, in a sentence, on the tab's own tooltip. */
  why: string
  /** Is there a control that opens it? Colours the lock — see `Lock`. */
  keyed: boolean
}

/** The legend follows the mode. A heat ramp under a categorical encoding would be a
 *  lie — "owner" has no order, so showing a gradient would invent one. */
function Legend({
  mode,
  categories,
  ranks,
}: {
  mode: ColorMode
  categories: string[]
  /** Category → slot, the SAME map the wedges are painted from — see `rankCategories`.
   *
   *  **The legend used to colour by its own position in this list**, which agreed with the
   *  map only because both were built from `legendFor` in the same order. A replay broke that
   *  the moment the slot order stopped being rebuilt per frame: the map kept a person's colour
   *  through the story, the legend renumbered from whoever was present in THAT frame, and htop
   *  opened with Hisham Muhammad against a blue dot and a mauve map. Same value, two answers,
   *  and the legend is the one a reader trusts. */
  ranks?: Map<string, number>
}) {
  // **The replay's two events are keyed on the TRANSPORT, not here.** They used to sit in
  // this row behind a hairline, which was fine while a replay painted nothing else: the key
  // had two entries. With the lenses painting frames and sixteen authors named, the two
  // swatches landed in the middle of the cast — a row of people, then `new`, `changed`, then
  // more people — and cost the width of two names in a box that is already over the map.
  // They belong beside the playhead anyway: they are a fact about the commit under it rather
  // than about the encoding. See `HistoryBar`.
  if (categories.length > 0) {
    // **In slot order, not in this frame's order.** With a held rank map the two can differ —
    // a person who is second today may be the only author in the frame on screen — and a
    // legend sorted by anything else would hand the top swatch to whoever the frame happened
    // to list first.
    // **Named up to what a key can hold, coloured up to what the palette can.** The two used
    // to be one number and the palette has since gone to sixty-four: a legend that named all
    // of them would be six hundred pixels of names over the map, and a legend is a caption.
    // Everyone past it still has their own colour — the panel says whose when you click.
    // **An unranked category is `other`, never this list's own index.** The fallback here was
    // `categories.indexOf(c)`, which invents a slot the map has never heard of: the wedges take
    // their colour from `ranks` alone and paint anyone missing in the shared neutral, so a
    // legend that filled the gap from its own ordering handed the top swatch to somebody
    // rendered grey. Drilled into one of kibana's directories it named eleven people in eleven
    // colours over a picture where every one of them was neutral — the key and the map
    // disagreeing about the same wedge, with the key sounding the more authoritative.
    //
    // It bites hardest exactly where it is least expected: `stats.authors` is CAPPED, so on a
    // big repo the people past the cap have no rank at all, and on a repo still being blamed
    // nobody in an unblamed file does yet. `keyFor` has always used this constant for the movie
    // key, which is the same key one surface over.
    const unranked = Number.MAX_SAFE_INTEGER
    const named = categories
      .filter((c) => (ranks?.get(c) ?? unranked) < NAMED)
      .sort((a, b) => (ranks?.get(a) ?? unranked) - (ranks?.get(b) ?? unranked))
    /** Everyone the key does not name, split by whether the MAP is colouring them. */
    const rest = categories
      .filter((c) => (ranks?.get(c) ?? unranked) >= NAMED)
      .reduce(
        (acc, c) => {
          const r = ranks?.get(c)
          if (r === undefined) acc.neutral += 1
          else {
            acc.coloured += 1
            if (shared(r)) acc.repeats = true
          }
          return acc
        },
        { coloured: 0, neutral: 0, repeats: false },
      )
    return (
      // Wider than it was, because the palette is twice as deep. Sixteen names at ceph's
      // median of twelve characters is two per row at 300px and eight rows of key over the
      // map; at 420 it is three per row and six rows, which is a caption rather than a panel.
      <div className="flex max-w-[420px] flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
        {/* Only the slots the key can hold are named. The rest are counted below — the
            coloured ones because a caption cannot carry a hundred names, the neutral ones
            because naming them would imply they are distinguishable on screen, and they are
            not. */}
        {named.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: slotColor(ranks?.get(c) ?? unranked) }}
            />
            <span className="text-[10px] text-[var(--muted-foreground)]">{c}</span>
          </span>
        ))}
        {/* **The tail is two different things and it used to be drawn as one.**
            Past the named slots there are people the palette still colours — recycling into
            its unnamed range, see `slotColor` — and, past the ranking itself, people who
            genuinely share the neutral. One row with a neutral swatch said both were the
            second kind, which is the legend claiming a colour the map is not using: on
            kibana's root sixty-one coloured people were listed as one grey category.
            So the coloured tail is counted WITHOUT a swatch, because it has no single colour
            to show, and it says once that its shades repeat. The neutral row survives for
            what is actually neutral. */}
        {rest.coloured > 0 && (
          <span className="text-[10px] text-[var(--muted-foreground)]">
            {rest.coloured} more{rest.repeats ? ' · shades repeat' : ''}
          </span>
        )}
        {rest.neutral > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--structure)' }} />
            <span className="text-[10px] text-[var(--muted-foreground)]">
              {OTHER_LABEL} ({rest.neutral})
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

  const [lo, hi] = RAMP_ENDS[mode] ?? ['', '']
  const ramp: Ramp = rampOf(mode)
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
 * The lens, as one pulldown.
 *
 * **It was eleven segments in a track, and eleven is where a segmented control stops being
 * one.** The row was the widest thing in the window and it set the window's minimum width;
 * every lens added since has been paid for by every other control in the bar, and there were
 * two more of them waiting for room. A segmented control earns its width by showing the
 * alternatives — that is the whole reason to prefer it over a menu — and it stops earning it
 * at the point where the alternatives no longer fit beside the thing they qualify.
 *
 * What is lost is real and worth naming: the eleven are no longer readable at a glance, so
 * discovering that Traps exists now takes a click. What is bought is the room the ring count
 * and the band width now sit in, both of which change what is ON the map rather than what it
 * is coloured by — and having those visible beside the lens is worth more than having ten
 * unchosen lens names visible.
 *
 * The trigger keeps the accent, because it is still the window's statement of what colour
 * means. A fixed minimum width holds it still: `Age` and `Legibility` are five characters
 * apart, and a bar that resized as you switched lens would move everything beside it.
 */
export function ModeSwitcher({
  mode,
  onMode,
  locked = {},
}: {
  mode: ColorMode
  onMode: (m: ColorMode) => void
  /** Which lenses have nothing to show, and why — see `Locked`.
   *
   *  **It used to disable the whole control during a replay, and then dim four tabs.** Both
   *  were versions of the same evasion: the row said "not now" without saying what would
   *  change it. Decided in `App`, because the answers come from three different places — the
   *  project's readings, the repo's git, this language's wiring — and a control that went
   *  looking for them would be the fourth place that knows.
   */
  locked?: Partial<Record<ColorMode, Locked>>
}) {
  const [open, setOpen] = useState(false)
  const here = locked[mode]
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={here ? here.why : MODE_HINT[mode]}
        className="flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[11px] font-semibold transition-colors"
        style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
      >
        {/* The lock rides on the trigger when the lens you are STANDING in is the locked
            one, which is an ordinary thing to be: a lens is still a place you can stand,
            and what it has to say there is said by the map. */}
        {here && <Lock keyed={here.keyed} />}
        <span className="min-w-[62px] text-left">{MODE_LABEL[mode]}</span>
        {/* A caret, not a chevron glyph from the font: at eleven pixels the two are the same
            shape and one of them depends on what the system has installed. */}
        <svg width="7" height="4" viewBox="0 0 7 4" aria-hidden>
          <path d="M0 0 L3.5 4 L7 0 Z" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <>
          {/* The same backdrop the sidebar's context menu uses: one click anywhere closes,
              including the click that chooses something else in the bar. Without it the menu
              is dismissed only by choosing a lens, which makes opening it a commitment. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault()
              setOpen(false)
            }}
          />
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 min-w-44 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-[12px] shadow-lg"
          >
            {(Object.keys(MODE_LABEL) as ColorMode[]).map((k, i) => {
              const on = mode === k
              const lock = locked[k]
              const key = shortcut(i)
              return (
                <button
                  key={k}
                  role="option"
                  aria-selected={on}
                  // Dimmed rather than disabled, as the tabs were: a locked lens is still a
                  // place you can stand, and what it has to say there — why a replay cannot
                  // paint it — is said by the map rather than by a control refusing to be
                  // pressed.
                  onClick={() => {
                    onMode(k)
                    setOpen(false)
                  }}
                  title={lock ? lock.why : MODE_HINT[k]}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-[var(--secondary)]"
                  style={{
                    color: on ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {/* A fixed slot, so the labels line up whether or not a lens is locked —
                      the tabs hid the glyph in their own padding because a column of eleven
                      names had no room; a menu has nothing but room. */}
                  <span className="flex w-[7px] shrink-0 justify-center">
                    {lock && <Lock keyed={lock.keyed} />}
                  </span>
                  <span className="flex-1">{MODE_LABEL[k]}</span>
                  {/* On the row now rather than in the tooltip. The argument against putting
                      it on a chip was that eleven chips each carrying a dim `⌘3` is keyboard
                      documentation where the control should be — true of a row eleven wide,
                      and the opposite of true in a menu, which is exactly where somebody
                      goes to find out that the key exists. */}
                  {key && (
                    <span className="mono shrink-0 text-[10px] text-[var(--muted-foreground)]">
                      ⌘{key}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/** The key, boxed to match the switcher so the two read as a pair across the graph. */
export function ColorLegend({
  mode,
  categories,
  ranks,
  stale = 0,
  unread = 0,
}: {
  mode: ColorMode
  categories: string[]
  /** The slot map the wedges use — see `Legend`. */
  ranks?: Map<string, number>
  /** Wedges drawn with the stale hatch. Each entry only appears when there are some —
   *  a legend entry for a texture that is nowhere on screen teaches the reader to
   *  ignore the legend. */
  stale?: number
  /** Wedges drawn in the flat unanalyzed gray, having never been read. */
  unread?: number
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1.5">
      <Legend mode={mode} categories={categories} ranks={ranks} />
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
