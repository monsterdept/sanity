import { type Node } from '../lib/api'
import { shareBelow, type Population } from '../lib/population'

/**
 * Where one function sits among the repo's own functions.
 *
 * Two lines under the dials, and the only thing in the leaf pane a container's cannot have.
 * A directory has no length and no churn of its own — only its children's — so its pane can
 * only ever aggregate them. A function is a member of a population, and `153 lines` is long
 * or short only against the code it sits in.
 *
 * **The grades are not here; they are dials, like everywhere else.** They were ladders for a
 * while — four rungs with the reader's one lit — on the argument that an arc invents
 * continuity a four-step grade has not got. That argument is still true and it is not worth
 * what it cost: three grade words in a row read as a phrase rather than as three readings,
 * and the fixes for that (labels above them, rules between them) turned the leaf pane's
 * header into a small table competing with the dial row every OTHER pane opens with. One
 * instrument across repo, directory, file and function is worth more than a more honest
 * instrument at the leaf alone.
 *
 * What survives is the half that was genuinely new: a rank needs a population, and only a
 * function belongs to one.
 */

/** The unlit part of an instrument. `--border` is a rule color — a couple of steps off the
 *  panel's own ground, drawn to be ignored — and this rail IS the scale: without it the tick
 *  is a mark at a position with nothing behind it. */
const TRACK = 'color-mix(in oklch, var(--muted-foreground) 32%, transparent)'

/** The tick is the point; the rail is what makes it mean anything. A percentile printed on
 *  its own is a number you have to place, and placing it is the work the rail does for
 *  free. */
function Rail({ p }: { p: number }) {
  return (
    <div className="relative h-[6px] w-full rounded-[2px]" style={{ background: TRACK }}>
      <span
        className="absolute top-[-2px] h-[10px] w-[2px] rounded-[1px] bg-[var(--foreground)]"
        // Pulled back by its own width at the top end so the tick stays inside the rail it is
        // describing — a mark hanging off the end reads as off the scale.
        style={{ left: `calc(${(p * 100).toFixed(1)}% - ${p > 0.5 ? 2 : 0}px)` }}
      />
    </div>
  )
}

/** A percentile as a rank you can read in four characters. */
function ordinal(p: number): string {
  // Never 0th and never 100th: this is a rank among real functions and both extremes are held
  // by one of them.
  const n = Math.min(99, Math.max(1, Math.round(p * 100)))
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')
  return `${n}${suffix}`
}

/** The same number as a share, for the tooltip — where there is room for the sentence the
 *  ordinal is a shorthand for. */
function pct(p: number): string {
  const n = Math.round(p * 100)
  if (n <= 0) return '<1%'
  if (n >= 100) return '>99%'
  return `${n}%`
}

/** One counted fact and where it lands, on a line that never wraps. */
function Fact({
  label,
  value,
  p,
  hint,
}: {
  label: string
  value: string
  /** Where this lands in the repo's distribution, or null when there are too few to rank. */
  p: number | null
  hint: string
}) {
  return (
    <div className="flex cursor-help items-center gap-2" title={hint}>
      <span className="w-[46px] shrink-0 text-[8px] font-semibold uppercase tracking-tight text-[var(--muted-foreground)]">
        {label}
      </span>
      <span className="mono w-[66px] shrink-0 truncate text-[11px]">{value}</span>
      {p !== null ? (
        <>
          {/* The rail takes the slack: the value and the rank either side of it are fixed, so
              the scale is the one thing that can absorb a narrower pane. A tick is read down
              the column, against the row above, and that only works at one width. */}
          <span className="min-w-0 flex-1">
            <Rail p={p} />
          </span>
          <span className="mono w-[26px] shrink-0 text-right text-[10px] text-[var(--muted-foreground)]">
            {ordinal(p)}
          </span>
        </>
      ) : (
        // An absent rank and a rank of zero are different facts, so the row says which.
        <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--muted-foreground)]">
          unranked
        </span>
      )}
    </div>
  )
}

export function FunctionRanks({ node, pop }: { node: Node; pop?: Population }) {
  const s = node.score
  if (!s) return null

  const locP = pop ? shareBelow(pop.loc, node.loc) : null
  const churnP = pop && s.ageDays !== null ? shareBelow(pop.commits, s.commits) : null

  return (
    <div className="mt-3 space-y-1">
      <Fact
        label="Lines"
        value={node.loc.toLocaleString()}
        p={locP}
        hint={
          locP !== null
            ? `${node.loc} lines — longer than ${pct(locP)} of the functions in this repo.`
            : 'Too few functions in this repo to rank a length against.'
        }
      />
      <Fact
        label="Churn"
        value={s.ageDays === null ? 'no history' : `${s.commits} in 90d`}
        p={churnP}
        hint={
          s.ageDays === null
            ? 'No git history here, so there is no churn axis at all — which is not the same as a function nobody has touched.'
            : `${s.commits} commits touched this file in the last 90 days${
                churnP !== null
                  ? `, more than ${pct(churnP)} of the functions under history here`
                  : ''
              }. ${
                s.lastTouchedDays === null
                  ? ''
                  : s.lastTouchedDays < 1
                    ? 'Last touched today. '
                    : `Last touched ${Math.round(s.lastTouchedDays)} days ago. `
              }The dial above is the same fact on the scale the map is colored by.`
        }
      />
    </div>
  )
}
