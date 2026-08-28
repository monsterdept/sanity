import { RINGS_MAX, RINGS_MIN } from '../lib/rings'

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
      className="flex items-center gap-0.5 rounded-full p-[3px]"
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
        className="rounded-full px-2 py-[3px] text-[11px] leading-none text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
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
        className="rounded-full px-2 py-[3px] text-[11px] leading-none text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:text-[var(--muted-foreground)]"
      >
        +
      </button>
    </div>
  )
}

/**
 * **TEMPORARY.** How thick the directory rim is, from what it has always been to the whole
 * ring — see `Sunburst`'s `rimShare`.
 *
 * A slider rather than a stepper, which is the opposite of the choice next to it and for the
 * opposite reason: the ring count is a small set of discrete answers somebody picks between,
 * and this is a continuous one nobody yet knows the right value of. What it is for is
 * looking — the rim became a distribution tonight and how much room a distribution wants is
 * a question about real repos, not one a constant can answer before anybody has looked.
 *
 * Deliberately unlabelled beyond `band` and a percentage, and deliberately not stored: it is
 * expected to collapse back into `DIR_RIM_PX` once it has told us what it is worth, and a
 * preference that outlives its control is worse than no preference.
 */
export function BandWidth({ share, onShare }: { share: number; onShare: (v: number) => void }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-[3px]"
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
