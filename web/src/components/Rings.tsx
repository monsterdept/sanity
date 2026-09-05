import { RINGS_MAX, RINGS_MIN } from '../lib/rings'
import {
  RING_MAX,
  SLICE_MAX,
  SPACING_DEFAULT,
  WIDTH_MAX,
  WIDTH_MIN,
  type Spacing,
} from '../lib/spacing'
import { CAPS, type AgeRead, type BlameRead, type TangleRead } from '../lib/colorMode'
import { inkOn } from '../lib/ink'
import { useState } from 'react'
import { capLabel, type Capped } from '../lib/palette'

/**
 * How tall every control in the lens row is.
 *
 * **Stated once, because it was being derived seven different ways.** Each of these set
 * `py-[3px]` and let its own contents decide the rest, so the height was whatever the line box
 * came out to: the ones carrying `leading-none` collapsed an 11px line to 11px and stood five
 * pixels shorter than their neighbours, while the segmented pairs padded twice — once on the
 * track, once on the button inside it — and stood taller. A row of buttons that do not agree
 * about their own height reads as a rendering fault, and no amount of matching `py` fixes it
 * while the contents differ: a glyph, a slider and a caret do not share a line box.
 *
 * So the height is declared and the contents are centred in it.
 */
export const CONTROL_H = 'h-[22px]'

/**
 * How many rings the map draws.
 *
 * A stepper rather than six segments, and that is a width argument rather than a taste
 * one: a segmented control naming every count is six pills for a value that is read far
 * more often than it is changed, and this sits in the crumb bar, whose whole job is to give
 * way as the window narrows. A stepper is three slots whatever the range.
 *
 * The NOUN stays on screen. `− 5 +` is a number with no unit in a bar full of other
 * numbers, and the thing it counts is the whole of what makes it meaningful; at six
 * characters `rings` costs almost nothing and answers what the control is for without a
 * tooltip. The ends disable rather than wrap — a control that jumps from eight back to
 * three reads as having been pressed by accident.
 *
 * See `lib/rings.ts` for why this is a control at all, and why its range stops where it
 * does.
 */
export function RingCount({ rings, onRings }: { rings: number; onRings: (n: number) => void }) {
  const step = (by: number) => () => onRings(Math.min(RINGS_MAX, Math.max(RINGS_MIN, rings + by)))
  return (
    // The lens switcher's recessed track, kept even though the two no longer sit in the same
    // bar: it is what says "one control with a position" rather than two loose buttons and a
    // number, and this row's other control is a bordered pill that says something different
    // — press this and the view moves.
    <div
      className={`flex items-center gap-0.5 rounded-full px-[3px] ${CONTROL_H}`}
      style={{
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      <button
        type="button"
        onClick={step(-1)}
        disabled={rings <= RINGS_MIN}
        title="Fewer rings — a shallower map, with more room in each band"
        className="rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
      >
        −
      </button>
      <span
        className="min-w-[52px] text-center text-[11px] tabular-nums text-[var(--muted-foreground)]"
        title="How many levels of the tree the map draws before you have to drill in. Deeper is more of the repo at once and a thinner band for each level of it."
      >
        {rings} rings
      </span>
      <button
        type="button"
        onClick={step(1)}
        disabled={rings >= RINGS_MAX}
        title="More rings — more of the tree at once, in thinner bands"
        className="rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
      >
        +
      </button>
    </div>
  )
}

/**
 * How thick the directory rim is, from what it has always been to the whole ring — see
 * `Sunburst`'s `rimShare`, which carries the argument for why a fifth is the default and why
 * the whole band is not a matter of taste: the rim reads by arc LENGTH, and filling the band
 * turns its segments into areas, which is the encoding the map already spends on lines.
 *
 * A slider rather than a stepper, which is the opposite of the choice next to it and for the
 * opposite reason: the ring count is a small set of discrete answers somebody picks between,
 * and this is a continuous one nobody yet knows the right value of. What it is for is
 * looking — the rim became a distribution tonight and how much room a distribution wants is
 * a question about real repos, not one a constant can answer before anybody has looked.
 *
 * Deliberately unlabelled beyond `band` and a percentage, and deliberately not stored: a
 * preference that outlives its control is worse than no preference. It stays a control because
 * the right value is still worth looking at on repos of different shapes — but the default is
 * now argued rather than open, so this is for looking rather than for deciding.
 */
export function BandWidth({ share, onShare }: { share: number; onShare: (v: number) => void }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2 ${CONTROL_H}`}
      style={{
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
      title="How much of each ring the directory's own band takes. Temporary, while we work out what it should be."
    >
      <span className="text-[11px] text-[var(--muted-foreground)]">band</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(share * 100)}
        onChange={(e) => onShare(Number(e.target.value) / 100)}
        className="h-1 w-16 cursor-pointer accent-[var(--accent)]"
        aria-label="Directory band thickness"
      />
      <span className="w-7 text-right text-[11px] tabular-nums text-[var(--muted-foreground)]">
        {Math.round(share * 100)}%
      </span>
    </div>
  )
}

/**
 * The three geometry tweaks that are not the ring count, behind one pill.
 *
 * **A pulldown rather than three more pills, and the bar is the argument.** This row already
 * carries the lens, whatever control the lens brings with it, the ring count, the band and two
 * doors — and its whole job, the one `RingCount` gives up a segmented control for, is to give
 * way as the window narrows. Three loose controls here would take about two hundred pixels to
 * say something a reader adjusts once and then lives with, which is the opposite trade from
 * the ring count: that one is READ at a glance and so must always be legible, and these are
 * set at a glance and then not looked at again.
 *
 * Grouped rather than merely hidden. All three answer one question — how much of the picture
 * is separation — and two of them are only meaningful against each other: a cut and a gutter
 * are both gaps, and the reason to move one is usually that the other made it look wrong. A
 * panel is where you can see both handles at once. `band` stays outside because it is not a
 * gap; it changes how much of a ring the reading OCCUPIES, which is a statement about the
 * encoding rather than about the spacing around it.
 *
 * Percentages, not units. What the sliders move are multipliers over `CUT` and `RING_GAP`,
 * whose absolute values are arguments in `Sunburst` rather than numbers anyone should be
 * typing here — see `lib/spacing.ts`. A hundred per cent is the drawn map as it has always
 * been, which is the one position a reader needs to be able to find again, and `reset` puts
 * all three back at once.
 */
export function SpacingMenu({
  spacing,
  onSpacing,
}: {
  spacing: Spacing
  onSpacing: (s: Spacing) => void
}) {
  const [open, setOpen] = useState(false)
  const set = (patch: Partial<Spacing>) => onSpacing({ ...spacing, ...patch })
  const dirty =
    spacing.border !== SPACING_DEFAULT.border ||
    spacing.slice !== SPACING_DEFAULT.slice ||
    spacing.ring !== SPACING_DEFAULT.ring ||
    spacing.width !== SPACING_DEFAULT.width
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="How much of the map is separation: the frame around a folder's colour, the gap between two things side by side, and the gap between one level and the next."
        className={`flex items-center gap-1.5 rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] ${CONTROL_H}`}
        style={{
          background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
          boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
        }}
      >
        <span>spacing</span>
        {/* A dot when any of the three is off its default, so a panel that is closed cannot
            hide the fact that the picture is not the one every note in `Sunburst` describes. */}
        {dirty && (
          <span
            aria-hidden
            className="h-1 w-1 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
        )}
        {/* The switcher's caret, drawn rather than set in the font — see `ChurnWindow`. */}
        <svg width="7" height="4" viewBox="0 0 7 4" aria-hidden>
          <path d="M0 0 L3.5 4 L7 0 Z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          {/* One click anywhere closes, the same backdrop every menu in this bar uses. It sits
              UNDER the panel, so dragging a slider inside is not a click outside it. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Spacing"
            className="absolute right-0 top-full z-50 mt-1 w-60 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-[11px] shadow-lg"
          >
            <label
              className="flex items-center justify-between gap-2"
              title="A folder's colour is drawn as a band floated inside its plate, with the ground showing all the way round it. Flush against the edge it reads as the folder's own outline instead — which says the folder is that colour, and a folder's colour is only ever a summary of what is inside it."
            >
              <span className="text-[var(--muted-foreground)]">folder borders</span>
              <button
                type="button"
                role="switch"
                aria-checked={spacing.border}
                onClick={() => set({ border: !spacing.border })}
                className="relative h-[14px] w-6 shrink-0 rounded-full transition-colors"
                style={{
                  background: spacing.border
                    ? 'var(--accent)'
                    : 'color-mix(in oklch, var(--foreground) 16%, transparent)',
                }}
              >
                <span
                  className="absolute top-[2px] h-[10px] w-[10px] rounded-full bg-white transition-all"
                  style={{ left: spacing.border ? 12 : 2 }}
                />
              </button>
            </label>
            <Slider
              label="between files"
              hint="The gap between one wedge and the one beside it. It is a constant WIDTH rather than an angle, so it stays the same all the way from the hub to the rim — see `CUT`."
              value={spacing.slice}
              max={SLICE_MAX}
              onChange={(v) => set({ slice: v })}
            />
            <Slider
              label="between rings"
              hint="The gutter between one level of the tree and the next. Folders, files and functions are three different kinds of thing drawn as one mass of arcs; this gutter is most of what says so."
              value={spacing.ring}
              max={RING_MAX}
              onChange={(v) => set({ ring: v })}
            />
            <Slider
              label="ring width"
              hint="How thick each ring is. What it spends is the disc in the middle — the rings run out to a fixed rim, so wider rings start further in and the hub gives up the room. A deep tree wants every unit of radius it can get; a shallow one has some to spare."
              value={spacing.width}
              min={WIDTH_MIN}
              max={WIDTH_MAX}
              onChange={(v) => set({ width: v })}
            />
            <button
              type="button"
              onClick={() => onSpacing(SPACING_DEFAULT)}
              disabled={!dirty}
              className="mt-2.5 w-full rounded-sm py-1 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--muted-foreground)]"
            >
              reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** One multiplier, as a labelled slider reading in per cent.
 *
 *  Local to the panel: two sliders that have to agree about their steps, their width and
 *  where their number sits are two chances to disagree, and there is exactly one caller. */
function Slider({
  label,
  hint,
  value,
  min = 0,
  max,
  onChange,
}: {
  label: string
  hint: string
  /** A multiple of the constant this scales — 1 is the map as drawn. */
  value: number
  /** Where the travel starts. Zero for the two gaps, where no gap is a real picture; the ring
   *  width has a floor instead, because both of its ends run out of something — see
   *  `WIDTH_MIN`. */
  min?: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="mt-2.5 flex items-center gap-2" title={hint}>
      <span className="w-[74px] shrink-0 text-[var(--muted-foreground)]">{label}</span>
      <input
        type="range"
        min={Math.round(min * 100)}
        max={Math.round(max * 100)}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
        aria-label={label}
      />
      <span className="w-9 shrink-0 text-right tabular-nums text-[var(--muted-foreground)]">
        {Math.round(value * 100)}%
      </span>
    </label>
  )
}

/**
 * How many colors a categorical lens spends before the rest become `other`.
 *
 * **The stepper `RingCount` is, deliberately, and for the same reason.** Both are a small set
 * of discrete answers read far more often than they are changed, both live in a bar whose job
 * is to give way as the window narrows, and a reader who has learned one has learned the
 * other. It steps through `CAPS` rather than counting, because the steps are not evenly
 * spaced — the interesting range is the low end, where the difference between eight and
 * sixteen is the difference between two readings.
 *
 * The noun stays on screen for the reason it does next door: `− 8 +` in a bar of other
 * numbers is a number with no unit, and this bar already has one of those.
 *
 * Shown only on the lenses that have categories. A cap over a ramp is a control for a
 * quantity that lens does not have, and an inert control is worse than no control — see
 * `Locked`, which is the same argument about the lens tabs themselves.
 */
export function ColorCount({
  mode,
  cap,
  onCap,
}: {
  mode: Capped
  cap: number
  onCap: (n: number) => void
}) {
  const at = CAPS.findIndex((c) => c === cap)
  // An unrecognised value sits at the top rather than off the end: `loadCap` snaps to a step,
  // so this can only happen to a value nothing wrote, and the full palette is the behaviour
  // somebody who never touched this control expects.
  const i = at === -1 ? CAPS.length - 1 : at
  const step = (by: number) => () => onCap(CAPS[Math.min(CAPS.length - 1, Math.max(0, i + by))])
  const noun = mode === 'blame' ? 'people' : 'languages'
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full px-[3px] ${CONTROL_H}`}
      style={{
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      <button
        type="button"
        onClick={step(-1)}
        disabled={i <= 0}
        title={`Fewer colors — the major ${noun}, with everybody else in one grey "other"`}
        className="rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
      >
        −
      </button>
      <span
        className="min-w-[56px] text-center text-[11px] tabular-nums text-[var(--muted-foreground)]"
        title={`How many ${noun} get a color of their own, biggest first. The rest are one "other" — so a low number is the major ${noun} against everybody else, and "all" is every one of them, which on a large repo is confetti and is meant to be.`}
      >
        {capLabel(cap)} colors
      </span>
      <button
        type="button"
        onClick={step(1)}
        disabled={i >= CAPS.length - 1}
        title={`More colors — more ${noun} told apart, and a smaller "other"`}
        className="rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
      >
        +
      </button>
    </div>
  )
}

/**
 * The one on/off control in the lens row.
 *
 * **Three of these were written separately and drifted into three shapes**: two segments for
 * Complexity, a pill with a glyph for the marks, another for Docs. They answer the same
 * question — is this qualifier on — and a row that spells one question three ways makes a
 * reader learn each of them.
 *
 * A switch rather than a segmented pair, which is what Complexity had. Two segments earn
 * their width when the alternatives are two different QUESTIONS, as Age's dates are; they
 * waste it when the second segment is the first one negated, and `weighted | raw count` was
 * that — one reading with the other as its absence.
 *
 * Each carries a glyph rather than a checkbox, so the control is a sample of what it switches
 * rather than a word about it — the words here are `markers`, `derivable`, `weighted`, none of
 * which mean anything on their own to somebody meeting the lens for the first time.
 *
 * **Styled as `HistoryToggle` and the transport's flash button are**, because it is the same
 * kind of thing and the row is read left to right: lit means on, in the accent, with the
 * weight and the shadow that go with it. These three only changed their TEXT colour, which on
 * a control that is on reads as a control that is disabled.
 *
 * The metrics come from there too. They carried `leading-none`, which collapses an 11px line
 * box to 11px where every other button in the row leaves it at the font's own 1.5 — so with
 * identical padding they came out five pixels shorter than their neighbours.
 */
export function LensToggle({
  on,
  onToggle,
  word,
  title,
  children,
}: {
  on: boolean
  onToggle: (v: boolean) => void
  word: string
  /** What it does, in the two voices it has: on it says what turning it OFF gives you. */
  title: string
  /** The glyph, which is handed `on` so it can wear the lens's own colour when lit. */
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
      title={title}
      className={`flex items-center gap-1.5 rounded-full px-2.5 text-[11px] transition-colors ${CONTROL_H}`}
      style={{
        background: on
          ? 'var(--accent)'
          : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        fontWeight: on ? 600 : 400,
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {children}
      {word}
    </button>
  )
}

/**
 * Whether a directory's rim carries the pointing marks — see `Sunburst`'s `dots`.
 *
 * **A switch rather than a stepper, because there is nothing to step through.** Its two
 * neighbours in this bar count something; this asks one yes/no question about one lens, and
 * a stepper over `on`/`off` is a control that looks like it has a range.
 *
 * It exists because a dot is opaque and a directory with a hundred of them wears a dotted
 * line across the band that is trying to show you something else. Turning them off does not
 * turn anything off on the map — the trapped function still pulses, the clone still wears
 * its colour — it drops the container's *out this way* pointer and leaves the rim to draw
 * what every other lens draws on it.
 *
 * Shown only on Traps and Clones, for the reason `ColorCount` is shown only on the
 * categorical lenses: no other lens puts a mark there, so anywhere else this is an inert
 * control, and an inert control is worse than no control.
 */
export function MarkerToggle({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <LensToggle
      on={on}
      onToggle={onToggle}
      word="markers"
      title={
        on
          ? 'Hide the marks on the folder rims. The map keeps every one of them where it actually is — this only drops the folder saying which way to look.'
          : 'Show, on each folder rim, which way to look for what this lens marks. One dot per thing found underneath, on the radial it lies out along.'
      }
    >
      {/* The control says what it does by drawing it: three dots, in the mark's own colour
          when they are on and in the muted ink when they are not. A checkbox glyph would
          need the word to carry the whole meaning, and the word here is `markers`, which
          could mean anything on a map made of colour. */}
      <svg width="17" height="5" viewBox="0 0 17 5" aria-hidden>
        {[2.5, 8.5, 14.5].map((cx) => (
          <circle
            key={cx}
            cx={cx}
            cy="2.5"
            r="2"
            fill="currentColor"
            opacity={on ? 1 : 0.45}
          />
        ))}
      </svg>
    </LensToggle>
  )
}

/**
 * The segmented track two lenses pick a reading in — see `AgeReading` and `BlameReading`.
 *
 * **One shape, because the row has already paid for the alternative.** `LensToggle` exists
 * because three on/off controls were written separately and drifted into three shapes; a
 * reading is the other kind of control in this row, and the second one was on its way to the
 * same place — Age had a track with two segments and Blame had a pill with a glyph, for what
 * is the same question asked of two lenses.
 *
 * **And it is the same question.** Both offer two readings of ONE list: Age takes the oldest
 * date in it or the newest, Blame takes the newest line's name or the biggest pile of them.
 * What either control changes is what the colour MEANS and never what is drawn, which is the
 * rule that puts both of them left of the spacer.
 *
 * Two segments rather than a switch, and `LensToggle` states the test: segments earn their
 * width when the alternatives are two different QUESTIONS, and waste it when the second is
 * the first one negated. Both of these pass it. Two segments rather than a pulldown is the
 * same test read the other way, which is the argument `ModeSwitcher` makes in reverse:
 * eleven alternatives stopped fitting beside the thing they qualify and became a menu, two
 * fit with room to spare — and showing them is the whole point, because nobody arrives at a
 * lens knowing it has two readings. A menu, or a switch wearing one word, hides the second
 * reading behind a click, and the second reading is what the lens is FOR.
 *
 * The words are the ones the map says. `tint` is the lens's own colour, so the pressed
 * segment matches the switcher's chip: this row already says what the colour means, and a
 * reading is a statement about that colour rather than a second, unrelated control.
 */
function ReadingSwitch<T extends string>({
  read,
  onRead,
  tint,
  opts,
}: {
  read: T
  onRead: (r: T) => void
  /** A custom property NAME rather than a resolved colour, because `inkOn` needs the name to
   *  work out what can be written on it. */
  tint: string
  /** `said` is what the pressed segment reads, where that differs — see `AgeReading`. */
  opts: { key: T; word: string; said?: string; title: string }[]
}) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full px-[3px] ${CONTROL_H}`}
      style={{
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      {opts.map((o) => {
        const on = read === o.key
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onRead(o.key)}
            title={o.title}
            className="rounded-full px-2 text-[11px] transition-colors"
            style={
              on
                ? { background: `var(${tint})`, color: inkOn(tint), fontWeight: 600 }
                : { color: 'var(--muted-foreground)' }
            }
          >
            {on ? (o.said ?? o.word) : o.word}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Which of Age's two dates the lens paints — see `AgeRead`.
 *
 * The words are the ones the wedges say. The pressed segment reads `oldest line` and a tooltip
 * reads `oldest line 412d ago` — the same sentence at two sizes, so the control does not have
 * to be translated into the map. See `ageLabel`, which is where both come from.
 *
 * **And they name the LINE rather than the code.** `first seen` was the first spelling and it
 * claimed what blame cannot see: per-line provenance holds the last commit to touch each line,
 * so a body rewritten wholesale reads as young and its true first appearance is gone. The
 * oldest line standing here is a fact; when this was written is not one we hold.
 */
export function AgeReading({ read, onRead }: { read: AgeRead; onRead: (r: AgeRead) => void }) {
  return (
    <ReadingSwitch
      read={read}
      onRead={onRead}
      tint="--age-4"
      opts={[
        {
          key: 'newest',
          word: 'newest',
          // **The noun rides on the chosen segment only.** Both halves carrying it reads as
          // two nouns to compare — `newest line` against `oldest line` — when what is being
          // compared is the adjective and the noun is the same in both. On the pressed one
          // it completes the sentence the wedges are saying; on the other it is a word the
          // eye has to skip to reach the choice.
          said: 'newest line',
          title:
            'Colour by the NEWEST line here — how long since a commit last touched this body. Bright is recent: where work has been happening.',
        },
        {
          key: 'oldest',
          word: 'oldest',
          said: 'oldest line',
          title:
            'Colour by the OLDEST line still standing here. Cold is code nobody has been near in a long while — a different question from what has been touched lately, and on a body rewritten last week out of lines from 2014 the two disagree by a decade. The oldest LINE, not when the code first appeared: a wholesale rewrite leaves nothing behind saying when it was written.',
        },
      ]}
    />
  )
}

/**
 * Whether a doc that says nothing the code didn't is marked — see `.derivable-pulse`.
 *
 * **A switch on the one thing the Docs ramp cannot say.** A reader who judges a comment
 * `derivable` — regenerable from the body it sits on — has that grade forced to `none`
 * (`reportGrades`), which is right: it explains nothing that was not already there, so it
 * cools no wedge. What it costs is the difference between a function nobody has documented
 * and one somebody has documented uselessly, and those want different work. The first needs
 * a sentence written. The second needs one deleted first, by whoever can tell that it is
 * safe to delete — which is more work, not less, and the map was drawing it as the same job.
 *
 * The same shape as `MarkerToggle` next door, because it is the same kind of control: a
 * yes/no about one lens, sitting beside the lens, drawing what it does rather than naming it.
 */
export function DerivableToggle({ on, onToggle }: { on: boolean; onToggle: (v: boolean) => void }) {
  return (
    <LensToggle
      on={on}
      onToggle={onToggle}
      word="derivable"
      title={
        on
          ? 'Stop marking docs that say nothing the code didn’t. They keep the undocumented colour either way — this only drops the breath that tells them apart from a function nobody has written about.'
          : 'Mark docs a reader judged derivable — regenerable from the body they sit on. They are painted as undocumented, correctly, and this is the only thing on the map that says a comment is there at all.'
      }
    >
      {/* The glyph breathes when the marking is on, on the same class the wedges take — so the
          control is a sample of the thing it switches rather than a word about it. Under
          reduced motion it settles exactly as they do, which is the whole point of that rule
          living on the class and not on the wedge. */}
      <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden className={on ? 'derivable-pulse' : undefined}>
        <rect x="0" y="0.5" width="14" height="1.6" rx="0.8" fill="currentColor" />
        <rect x="0" y="3.7" width="10" height="1.6" rx="0.8" fill="currentColor" opacity={0.75} />
        <rect x="0" y="6.9" width="12" height="1.6" rx="0.8" fill="currentColor" opacity={0.5} />
      </svg>
    </LensToggle>
  )
}

/**
 * Which horizon Churn counts inside — one of the four this repo can offer.
 *
 * **A pulldown, where its three neighbours are steppers and segments, and the reason is that
 * the rungs are not a scale.** `RingCount` steps because five rings and six rings are
 * neighbours on one axis; `AgeReading` is two segments because two alternatives fit. Four
 * windows are four different questions about the same repo, their labels are variable-width
 * because the ladder is the repo's own, and a stepper over them would invite the reading that
 * you are turning a dial up rather than asking something else.
 *
 * **The rungs are named in days and the days come from the repo.** A fixed 30/60/90/180 goes
 * inert on a young project — measured on this one at 27 days old, all four windows returned the
 * identical 271 commits — so `edits::windows_for` scales the ladder to a repo that cannot fill
 * it. What that costs is that `90d` here and `90d` in another repo are not always the same
 * choice; what it buys is four choices that do something. Age already made that trade and said
 * why: cross-repo comparison was never something this app offered.
 */
export function ChurnWindow({
  windows,
  at,
  onPick,
}: {
  /** The four rungs, in days — `Stats.churnWindows`. */
  windows: readonly number[]
  at: number
  onPick: (i: number) => void
}) {
  const [open, setOpen] = useState(false)
  const label = (d: number) => (d === 1 ? '1 day' : d < 90 ? `${d} days` : `${d}d`)
  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="How far back Churn counts. Four horizons, scaled to how long this repo has existed — a fixed ladder says the same thing four times on a young project."
        className={`flex items-center gap-1.5 rounded-full px-2 text-[11px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] ${CONTROL_H}`}
        style={{
          background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
          boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
        }}
      >
        <span className="tabular-nums">{label(windows[at] ?? 90)}</span>
        {/* The switcher's caret, drawn rather than set in the font — at this size a chevron
            glyph and a triangle are the same shape and one of them depends on what the system
            has installed. See `ModeSwitcher`. */}
        <svg width="7" height="4" viewBox="0 0 7 4" aria-hidden>
          <path d="M0 0 L3.5 4 L7 0 Z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <>
          {/* One click anywhere closes, including the click that chooses something else in the
              bar — the same backdrop the lens switcher uses, and for the same reason: without
              it, opening the menu is a commitment. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 top-full z-50 mt-1 min-w-32 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-[12px] shadow-lg"
          >
            {windows.map((d, i) => (
              <button
                key={i}
                role="option"
                aria-selected={i === at}
                onClick={() => {
                  onPick(i)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-1 text-left tabular-nums hover:bg-[var(--secondary)]"
                style={{
                  color: i === at ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: i === at ? 600 : 400,
                }}
              >
                {label(d)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Whether Complexity measures a body against the others its SIZE, or counts it flat.
 *
 * **A switch, where it was two segments reading `weighted | raw count`.** Those are not two
 * questions the way Age's two dates are: raw is what is left when the weighting is taken away,
 * and a segmented pair spends the width of both alternatives to say so. Weighted is also the
 * reading the lens exists for — a long function is naturally more complicated, and the useful
 * question is whether it is more complicated than that — so it is the default, and turning it
 * off is the deliberate act.
 *
 * The glyph is the claim: a short bar and a tall one, level with each other, which is what
 * comparing against size looks like. Unlit it is a plain count.
 */
export function TangleReading({
  read,
  onRead,
}: {
  read: TangleRead
  onRead: (r: TangleRead) => void
}) {
  const on = read === 'weighted'
  return (
    <LensToggle
      on={on}
      onToggle={(v) => onRead(v ? 'weighted' : 'raw')}
      word="weighted"
      title={
        on
          ? 'Count the decision points flat instead, against the published bar of 15 — which is what you want when triaging against a line rather than against this repo.'
          : 'Measure each body against the median of the others its length in this repo. A long function is naturally more complicated; this asks whether it is more complicated than that.'
      }
    >
      {/* Two bars of different lengths, starting level: the shape of a comparison. */}
      <svg width="13" height="9" viewBox="0 0 13 9" aria-hidden>
        {/* `currentColor` on both, because the lit pill is the accent and a lens-coloured
            glyph on it reads as a second thing rather than as part of the control. */}
        <rect x="0" y="1" width="13" height="2.6" rx="1.3" fill="currentColor" />
        <rect x="0" y="5.4" width="7" height="2.6" rx="1.3" fill="currentColor" opacity={0.7} />
      </svg>
    </LensToggle>
  )
}

/** Which of Blame's two reductions the map paints.
 *
 * **Two readings of one measurement, not two measurements** — which is the same shape Age's
 * reading has, and the reason this sits beside it in the same control: every line of a
 * function carries the name of whoever touched it LAST, and the two readings take the newest
 * of those or the biggest pile. They disagree often. A typo fix in a four-hundred-line body
 * makes somebody its last toucher while they hold one line of it.
 *
 * **It was a switch wearing the word `most lines`, and a switch is the wrong shape for it.**
 * `LensToggle` states the test — segments earn their width when the alternatives are two
 * different QUESTIONS — and this passes it as plainly as Age does: the off state was not "not
 * most lines", it was *the newest line's name*, a reading with a name of its own that a
 * control showing only the other one had nowhere to put. Half the lens was behind a word that
 * did not mention it.
 *
 * **`newest line`, not `last touched`, and both segments have to be spelled the same way.**
 * Each names the lines the name is read off — the newest one, or the biggest pile — which is
 * the whole of what separates them, and it is the spelling Age already uses for that same
 * line. `last touched` named the ACT instead, so the pair read as a date against a quantity
 * rather than as two reductions of one list. `LensHelp` says it this way too: one spelling
 * per lens, in the control and in the help.
 *
 * The noun sits on the chosen segment only — see the options below, and `AgeReading`, which
 * does the same thing for the same reason one step removed.
 *
 * Left of the spacer with the other three, on the rule they all follow: what it changes is
 * what the COLOUR MEANS, not what is drawn.
 */
export function BlameReading({
  read,
  onRead,
}: {
  read: BlameRead
  onRead: (r: BlameRead) => void
}) {
  return (
    <ReadingSwitch
      read={read}
      onRead={onRead}
      // Blame has no ramp to quote, so it takes a chrome colour of its own — see `modeToken`,
      // and the switcher's chip, which wears the same one.
      tint="--lens-blame"
      opts={[
        {
          key: 'touched',
          // **The noun rides on the chosen segment, exactly as Age's does, and it earns its
          // place there for a slightly different reason.** Age's two segments share one noun,
          // so carrying it twice would put the same word on both sides of a comparison that
          // is only ever about the adjective. These two do not share it — a line against a
          // pile of them — but the adjective is still what is being chosen between, and the
          // noun is what completes the sentence once you have chosen: `newest line` and
          // `most lines` read as the map's own words, while unpressed they get out of the way
          // of the choice.
          word: 'newest',
          said: 'newest line',
          title:
            "Colour by the NEWEST line's name — who touched each wedge most recently. A timestamp with a name on it, and what this lens has always painted.",
        },
        {
          key: 'lines',
          word: 'most',
          said: 'most lines',
          title:
            'Colour by whose lines most of each body IS. Not ownership: blame reports who touched each line last, so a body rewritten wholesale reads as new and everyone whose lines were replaced is gone.',
        },
      ]}
    />
  )
}
