import { heatColor, type Ramp } from '../lib/api'

/**
 * **The dial row is gone, and `Gauge` is what survived it.**
 *
 * Four half-circles — surprise, docs, churn, legibility — opened every pane, above a scroller
 * whose sections each grade the same readings and say what their grades MEAN: a ladder under
 * Surprise, a ladder under Docs, a key under Legibility, a calendar under Churn. The row was
 * the same four answers a screen earlier, printed as `2/4` with the words moved into
 * tooltips — which is the shape a measurement takes when it has nowhere to explain itself.
 *
 * What went with it: `RUNG_GOOD`/`RUNG_HOT` and their fractions, `graded`, `fileDocShare`,
 * `badShare`. The subtree shares those two computed are not lost — `colorMode`'s `undocShare`
 * and `opaqueShare` are the originals, and they are what the wedges are painted from.
 *
 * `Gauge` stays because `ReadDialog` draws one, and because a dial is the right instrument
 * for a single figure with a scale behind it. It is no longer a row.
 */

/**
 * One reading, as a dial.
 *
 * Three of these side by side, where there were four stacked bars. A bar is a length, and
 * three lengths in a column invite the eye to compare them — but these three measure
 * different things on different scales, so comparing them is exactly the reading nobody
 * should take. A dial reads as its own instrument: you take each one on its own terms,
 * which is what they are.
 *
 * Fixed 180°, and the value spelled out in the middle. The arc is for the glance — is this
 * near the top or the bottom — and the number is there because a glance at an arc is not a
 * measurement and this panel is where you come when the map was not enough.
 *
 * **Each dial wears its own lens's ramp, at its own value.** They were all `--accent`, so
 * the loudest property on the row carried nothing — the one place in this app where color
 * meant nothing at all — while four feet below, the same four readings each had a hue of
 * their own that the whole map is built on. A dial is now literally the color that wedge
 * takes when you press that tab, which makes the row a preview of the four lenses rather
 * than a chart-shaped decoration.
 *
 * Lives here rather than in `Detail` because the row is on every pane that describes a
 * subtree — the repo, a directory, a file, a function — and a component defined inside one
 * of its callers is how two panes end up with two dial rows that drift apart.
 */
export function Gauge({
  label,
  value,
  rampValue,
  hint,
  ramp,
  unread,
  word,
}: {
  label: string
  /** 0..1 — what the dial PRINTS, and how far its arc sweeps. */
  value: number
  /** 0..1 — where the ramp is sampled, when that is not the same thing.
   *
   *  Two dials count up for the good end (`Doc'd`, `Legible`) while their ramps must still
   *  paint the gap, because bright means "there is work here" on every lens and that is not
   *  a per-dial choice. Everywhere else the two are one number and this is left out. */
  rampValue?: number
  hint: string
  /** Which lens this reading belongs to. Undefined for a figure with no lens behind it. */
  ramp?: Ramp
  /** No value to show — draw the track and say so, rather than a needle at zero, which
   *  claims a reading of nought where there is no reading at all. */
  unread?: boolean
  /** Say it in words instead of digits, for a reading that has four steps and no more.
   *
   *  The arc stays: it is the glance, and it wants the uneven spacing that makes `cold`
   *  and `warm` sit close together. It is the printed number that was the problem —
   *  `62` reads as a measurement to one part in a hundred, and four wedges at `30` look
   *  like four measurements agreeing rather than one grade repeated. */
  word?: string | null
}) {
  const R = 40
  const LEN = Math.PI * R
  const v = Math.max(0, Math.min(1, value))
  const arc = `M ${50 - R} 50 A ${R} ${R} 0 0 1 ${50 + R} 50`
  // A ramp color when the reading has a lens, the chrome's accent when it does not. Sampled
  // at `rampValue` where the printed number counts the other way — see the prop.
  const c = Math.max(0, Math.min(1, rampValue ?? value))
  const fill = unread ? 'var(--secondary)' : ramp ? heatColor(c, ramp) : 'var(--accent)'
  // What the middle actually reads, worked out once so the fit below can measure it.
  const shown = unread ? '—' : (word ?? String(Math.round(v * 100)))
  return (
    <div className="flex min-w-0 flex-col items-center" title={hint}>
      <svg viewBox="0 0 100 58" className="w-full overflow-visible">
        {/* The track, quieter than it was. It used to be `--secondary` at the same weight as
            the value arc, so at 5% documented the picture was dominated by the part that is
            not the reading — a big gray horseshoe with a nub on it. Thinner and dimmer: the
            track is the scale, the arc is the answer. */}
        <path
          d={arc}
          fill="none"
          stroke="var(--border)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {!unread && (
          <path
            d={arc}
            fill="none"
            stroke={fill}
            strokeWidth={7}
            // Butt at zero: a round cap on an empty arc draws a dot, which reads as a
            // small value rather than none.
            strokeLinecap={v > 0.01 ? 'round' : 'butt'}
            strokeDasharray={`${LEN * v} ${LEN}`}
          />
        )}
        {/* One size for words and numbers — they were 15 and 22, so a row holding both, which
            is most rows, had two type sizes competing inside one instrument and the worded
            dial read as the quieter measurement. It is the same reading either way; only its
            scale differs.

            Shrunk to fit rather than clipped or truncated. The words are the ones `.sanity/`
            prints now, and `unrecognizable` is fourteen characters where `warm` was four — a
            fixed size would have run it off both ends of the arc. A name a reader cannot
            finish is worse than one set a little smaller, and this is the same fit-or-shrink
            the wedge labels make. */}
        <text
          x={50}
          y={47}
          textAnchor="middle"
          className="mono"
          fontSize={Math.min(16, 88 / Math.max(1, String(shown).length * 0.58))}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {shown}
        </text>
      </svg>
      {/* Wraps rather than overflows. At three columns every label was one short word; at
          four, `UNDOCUMENTED` is wider than its column and ran into `HOT SHARE` beside it.
          `break-words` lets the long ones take two lines, and the tracking comes off so
          they need fewer — a label that collides is worse than a label set slightly tighter
          than its neighbors. */}
      <span className="mt-0.5 w-full cursor-help break-words text-center text-[9px] font-semibold uppercase leading-tight tracking-tight text-[var(--muted-foreground)]">
        {label}
      </span>
    </div>
  )
}

