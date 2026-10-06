/** The ignored drawer: every decision that hides a finding, with its reason and a way back.
 *
 *  Reached from the findings list rather than from a tab — see `PanelTabs`. */
import type { Decision, Verdict } from '../../lib/api'

/** A verdict as the drawer names it. */
function verdictWord(v: Verdict): string {
  return v === 'flagged'
    ? 'flagged'
    : v === 'fine-always'
      ? 'always fine'
      : v === 'false-positive'
        ? 'not true'
        : 'fine as it stood'
}

/** The ignored drawer: every decision that hides a finding, with its reason and an undo. */
export function IgnoredList({
  ignored,
  onUndecide,
}: {
  ignored: Decision[]
  onUndecide: (key: string, rule: string) => void
}) {
  if (!ignored.length) {
    return (
      <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
        Nothing ignored here yet.
      </p>
    )
  }
  return ignored.map((d) => (
    <IgnoredRow key={`${d.key}\u0000${d.rule}`} d={d} onUndecide={onUndecide} />
  ))
}

/** One decision in the drawer. */
function IgnoredRow({
  d,
  onUndecide,
}: {
  d: Decision
  onUndecide: (key: string, rule: string) => void
}) {
  return (
    <div className="border-b border-[var(--border)] px-4 py-3 last:border-b-0">
      <div className="flex items-baseline gap-2">
        <span className="truncate text-[12px] text-[var(--foreground)]">{d.key}</span>
        <span className="mono ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">
          {d.title || d.rule}
        </span>
      </div>
      {/* The reason is the point of the drawer. A row without one still says so,
          rather than looking like a row whose reason failed to load. */}
      <p className="pt-0.5 text-[11px] text-[var(--muted-foreground)]">
        {d.reason || 'no reason given'}
      </p>
      <div className="flex items-baseline gap-2 pt-0.5">
        {/* **What was decided, not just that something was.** Three verdicts land
            in one store and two of them hide a finding; a row that did not say
            which would leave somebody unable to tell a commitment from a
            dismissal. */}
        <span
          className="rounded px-1.5 py-[1px] text-[9px] uppercase"
          style={{
            letterSpacing: '0.1em',
            background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
            color: 'var(--muted-foreground)',
          }}
        >
          {verdictWord(d.verdict)}
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          {d.by ? `${d.by} · ` : ''}
          {d.when.slice(0, 10)}
        </span>
        <button
          type="button"
          onClick={() => onUndecide(d.key, d.rule)}
          className="ml-auto text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          undo
        </button>
      </div>
    </div>
  )
}
