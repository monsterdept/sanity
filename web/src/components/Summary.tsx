import { elide } from '../lib/text'
import {
  GRADE_SURPRISE,
  HEAT_WORDS,
  heatColor,
  summarize,
  temperature,
  type Grade,
  type Node,
} from '../lib/api'

const GRADES: Grade[] = ['full', 'most', 'some', 'none']

/**
 * The spread of readings, as one bar and its key.
 *
 * Segments in grade order, cold to hot, painted from the SAME ramp as the wedges — a
 * panel that invented its own four colours would be a second legend disagreeing with the
 * first. Unread and expired are their own segments in the structural neutral, never
 * folded into `cold`: "nobody looked" and "a reader predicted it exactly" are opposite
 * findings, and stacking them together is how a map claims coverage it hasn't got.
 *
 * Widths are counts, not lines. This bar answers "how did the readings come out", which
 * is one vote per reading; weighting it by size would answer a different question that
 * the map itself already answers better.
 */
function Spread({
  spread,
  read,
  stale,
  unread,
}: {
  spread: Record<Grade, number>
  read: number
  stale: number
  unread: number
}) {
  const total = read + stale + unread
  if (total === 0) return null
  const segs = [
    ...GRADES.map((g) => ({
      key: g as string,
      n: spread[g],
      label: HEAT_WORDS[g],
      fill: heatColor(GRADE_SURPRISE[g]),
    })),
    { key: 'stale', n: stale, label: 'expired', fill: 'var(--unanalyzed)' },
    { key: 'unread', n: unread, label: 'unread', fill: 'var(--structure)' },
  ].filter((s) => s.n > 0)

  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-[2px]">
        {segs.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.n / total) * 100}%`, background: s.fill }}
            title={`${s.n} ${s.label}`}
          />
        ))}
      </div>
      <div className="mt-2 space-y-0.5">
        {segs.map((s) => (
          <div key={s.key} className="flex items-baseline gap-2">
            <span
              className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
              style={{ background: s.fill }}
            />
            <span className="flex-1 text-[11px] text-[var(--muted-foreground)]">{s.label}</span>
            <span className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
              {s.n}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** One thing to do, and the fact that makes it worth doing.
 *
 *  A row with no handler is a statement, not a button: some of what belongs in this list
 *  is something the app cannot do for you, and dressing it as clickable would promise an
 *  action that isn't there. */
function Action({
  children,
  detail,
  onClick,
}: {
  children: React.ReactNode
  detail?: string
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="text-[11px] leading-snug">{children}</span>
      {detail && (
        <span className="mt-0.5 block text-[10px] leading-snug text-[var(--muted-foreground)]">
          {detail}
        </span>
      )}
    </>
  )
  if (!onClick) {
    return <div className="rounded-[var(--radius-sm)] px-1 py-1">{body}</div>
  }
  return (
    <button
      type="button"
      className="block w-full rounded-[var(--radius-sm)] px-1 py-1 text-left hover:bg-[var(--secondary)]"
      onClick={onClick}
    >
      {body}
    </button>
  )
}

/**
 * The pane when nothing is selected: what this repo adds up to, and what to do next.
 *
 * It used to be the ants and nothing else, on the argument that the gestures were already
 * stated on the wedges they apply to. That is still true of the gestures — and it left
 * the panel saying nothing at the one moment the question is "what am I looking at", which
 * is exactly when you have not picked a wedge yet. The ants stay, underneath.
 *
 * Everything here is counted off `node` — the subtree the map is currently showing — for
 * the same reason `ColourLegend` counts its hatches off `focus`: drilled two levels in,
 * repo-wide numbers annotate a picture nobody is looking at. The sidebar row remains the
 * repo-wide count, and the header names what this one covers so the two can never be
 * mistaken for each other.
 */
export function Summary({
  node,
  title,
  repo,
  working,
  onSelect,
  onDrill,
  onConnect,
}: {
  /** The subtree on screen. */
  node: Node
  /** What to call it — the project when at the root, the directory when drilled in. */
  title: string
  repo: string | null
  /** An agent is reading this project right now. */
  working: boolean
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
  onConnect?: () => void
}) {
  const s = summarize(node)
  // Go to it AND open the file around it: a name in this list is useless if clicking it
  // selects something off-screen. Drill first so the map moves, then select so the panel
  // fills in — the panel replacing this one is the point of the click.
  const goTo = (n: Node) => {
    onDrill?.(n)
    onSelect?.(n)
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div className="px-4 pb-6 pt-4">
        <h2 className="mono truncate text-sm font-semibold" title={title}>
          {title}
        </h2>
        {repo && (
          <p className="mono mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
            {elide(repo, 40)}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          {node.loc.toLocaleString()} lines · {s.functions.toLocaleString()}{' '}
          {s.functions === 1 ? 'function' : 'functions'}
          {/* Never on its own line and never omitted: `functions` is what the readings
              below are counted against, and a denominator somebody narrowed months ago
              has to be visible beside it. */}
          {s.excluded > 0 && (
            <span title=".sanityignore set these aside: still drawn, never queued.">
              {' '}
              · {s.excluded.toLocaleString()} excluded
            </span>
          )}
        </p>

        {s.functions > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Readings
            </p>
            <Spread spread={s.spread} read={s.read} stale={s.stale} unread={s.unread} />
          </div>
        )}

        <div className="mt-4 border-t border-[var(--border)] pt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Next
          </p>

          {/* Expiries first. They are the only item here that is work already done going
              off — everything else is work not started, which keeps. */}
          {s.stale > 0 && (
            <Action
              detail="The code moved under them, so they no longer colour their wedges. A reader picks them up before anything unread."
              onClick={s.firstStale ? () => goTo(s.firstStale as Node) : undefined}
            >
              <span className="mono">{s.stale}</span>{' '}
              {s.stale === 1 ? 'reading has' : 'readings have'} expired
            </Action>
          )}

          {s.unread > 0 && (
            <Action
              detail={
                working
                  ? 'An agent is reading this project now.'
                  : 'Readings come from agents over MCP — there is no model in the app.'
              }
              onClick={working ? undefined : onConnect}
            >
              <span className="mono">{s.unread}</span>{' '}
              {s.unread === 1 ? 'function has' : 'functions have'} never been read
              {!working && <span className="text-[var(--muted-foreground)]"> — connect an agent</span>}
            </Action>
          )}

          {s.hot.length > 0 && (
            <Action
              detail={`Hottest: ${s.hot[0].name} — ${HEAT_WORDS[s.hot[0].agent?.predicted ?? 'none']}`}
              onClick={() => goTo(s.hot[0])}
            >
              <span className="mono">{s.hot.length}</span>{' '}
              {s.hot.length === 1 ? 'reading' : 'readings'} came back hot
            </Action>
          )}

          {/* Nothing to do is a finding, and it has to be stated rather than left as an
              empty box — an empty list reads as "not loaded yet". Only reachable when
              there is genuinely nothing outstanding: read everything, none expired, and
              nothing above HOT. */}
          {s.stale === 0 && s.unread === 0 && s.hot.length === 0 && (
            <Action
              detail={
                s.read === 0
                  ? 'Nothing here to read.'
                  : 'Every function has a current reading, and no reading came back hot.'
              }
            >
              Nothing outstanding
            </Action>
          )}
        </div>

        {/* The hot list itself, when there is one. The map shows WHERE they are; this
            says WHICH they are, which is the thing you cannot read off a ring. */}
        {s.hot.length > 0 && (
          <div className="mt-4 border-t border-[var(--border)] pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Hot
              </p>
              <p className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {s.hot.length}
              </p>
            </div>
            {s.hot.slice(0, 12).map((h) => (
              <button
                key={h.id}
                type="button"
                className="flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] px-1 py-0.5 text-left hover:bg-[var(--secondary)]"
                onClick={() => onSelect?.(h)}
                onDoubleClick={() => goTo(h)}
              >
                <span
                  className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
                  style={{ background: heatColor(temperature(h.score)) }}
                />
                <span className="mono flex-1 truncate text-[11px]">{h.name}</span>
                <span className="mono shrink-0 text-[10px] text-[var(--muted-foreground)]">
                  {HEAT_WORDS[h.agent?.predicted ?? 'none']}
                </span>
              </button>
            ))}
            {/* A truncated list that does not say it is truncated reads as the whole
                set — the same failure as coverage counted off a filtered queue. */}
            {s.hot.length > 12 && (
              <p className="mt-1 px-1 text-[10px] text-[var(--muted-foreground)]">
                and {s.hot.length - 12} more
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
