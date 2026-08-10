import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from '../lib/cn'
import { compactCount, elide } from '../lib/text'
import {
  GRADE_SURPRISE,
  HEAT_WORDS,
  heatColor,
  summarize,
  temperature,
  type Grade,
  type Node,
} from '../lib/api'
import { bucketsFor, colorFor, type Bucket, type ColorMode } from '../lib/colorMode'

const GRADES: Grade[] = ['full', 'most', 'some', 'none']

/** What the breakdown is a breakdown OF, per mode.
 *
 *  Not `MODE_LABEL`: the switcher above the map says "Blame" because it is naming a lens,
 *  and this is naming the rows underneath it, which are authors. A heading that repeated
 *  the tab would tell the reader something they can already see. */
const BREAKDOWN_TITLE: Record<Exclude<ColorMode, 'surprise'>, string> = {
  legible: 'Legible once open',
  traps: 'Traps',
  blame: 'Authors',
  language: 'Languages',
  churn: 'Commits in 90d',
  age: 'Last touched',
}

/** Height of one row, in pixels, and it is a contract rather than a style.
 *
 *  `ListWindow` works out which rows are on screen by dividing the scroll offset by this,
 *  so a row that does not measure exactly this tall puts the window out of step with the
 *  scrollbar — slowly at first, and by whole rows near the bottom. The rows carry `h-5` to
 *  make it true. */
const ROW_H = 20

/**
 * The readings list, rendering only what is on screen.
 *
 * Windowed rather than virtualised by a library: the rows are a fixed height and the list
 * is flat, which is the one case where the arithmetic is three lines and a dependency
 * would be the more complicated answer.
 *
 * `overscan` above and below so a fast scroll does not show the seam — the browser paints
 * before React reacts to the scroll event, and without a margin that gap is a band of
 * blank rows at the leading edge.
 */
function ListWindow({
  rows,
  onSelect,
  goTo,
  paint,
}: {
  rows: Node[]
  onSelect?: (n: Node) => void
  goTo: (n: Node) => void
  /** Swatch and trailing word for one row. Defaults to the reading's heat and grade, which
   *  is what the surprise panel wants; the other lenses pass their own so a row says
   *  "touched 4d ago" rather than restating a temperature the map is not currently
   *  showing. Same source as the wedge — see `colorFor`. */
  paint?: (n: Node) => { fill: string; label: string }
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState({ top: 0, h: 0 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const read = () => setView({ top: el.scrollTop, h: el.clientHeight })
    read()
    el.addEventListener('scroll', read, { passive: true })
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', read)
      ro.disconnect()
    }
  }, [])

  // Back to the top when the list becomes a different list. Keeping the offset would open
  // `blazing` scrolled to where `cold` was left, which reads as a list that starts in the
  // middle of itself.
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0
  }, [rows])

  const overscan = 8
  const first = Math.max(0, Math.floor(view.top / ROW_H) - overscan)
  const last = Math.min(rows.length, Math.ceil((view.top + view.h) / ROW_H) + overscan)
  const shown = rows.slice(first, last)

  return (
    <div
      ref={box}
      className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]"
    >
      {/* Spacers, so the scrollbar describes the whole list rather than the slice of it
          that happens to exist. */}
      <div style={{ height: first * ROW_H }} />
      {shown.map((h) => {
        const p = paint?.(h) ?? {
          fill: heatColor(temperature(h.score)),
          label: HEAT_WORDS[h.agent?.predicted ?? 'none'],
        }
        return (
          <button
            key={h.id}
            type="button"
            className="flex h-5 w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--secondary)]"
            onClick={() => onSelect?.(h)}
            onDoubleClick={() => goTo(h)}
          >
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: p.fill }} />
            <span className="mono flex-1 truncate text-[11px]">{h.name}</span>
            <span className="mono shrink-0 truncate text-[10px] text-[var(--muted-foreground)]">
              {p.label}
            </span>
          </button>
        )
      })}
      <div style={{ height: Math.max(0, (rows.length - last) * ROW_H) }} />
    </div>
  )
}

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
  picked,
  onPick,
}: {
  spread: Record<Grade, number>
  read: number
  stale: number
  unread: number
  /** Which grade the list below is showing. */
  picked: Grade | null
  onPick: (g: Grade | null) => void
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
      {/* The key is the control.
          A count is where this panel used to stop being useful: "5,841 cold" is a fact you
          can do nothing with, and a reader who wants to know WHICH has only the map, which
          cannot spell. The four grades already sit here naming the thing to ask for, so
          they ask for it — clicking one puts its readings in the list below.

          Only the grades. `expired` and `unread` keep their segments and stay inert,
          because they are not a reading that came back some way, they are the absence of
          one — and the work each of them implies is stated in Next Steps, which is where
          somebody who wants to act on them should be sent. */}
      <div className="mt-2 space-y-0.5">
        {segs.map((seg) => {
          const grade = GRADES.includes(seg.key as Grade) ? (seg.key as Grade) : null
          const on = grade !== null && grade === picked
          const row = (
            <>
              <span
                className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
                style={{ background: seg.fill }}
              />
              <span
                className={clsx(
                  'flex-1 text-[11px]',
                  on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                )}
              >
                {seg.label}
              </span>
              <span className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {seg.n}
              </span>
            </>
          )
          return grade === null ? (
            <div key={seg.key} className="flex items-baseline gap-2 px-1">
              {row}
            </div>
          ) : (
            <button
              key={seg.key}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? null : grade)}
              className={clsx(
                'flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--secondary)]',
                on && 'bg-[var(--secondary)]',
              )}
            >
              {row}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The same bar and key as `Spread`, for the modes that are not painted from readings.
 *
 * Deliberately the same shape rather than a second design: the question "what is this made
 * of, and which ones are they" is identical whether the slices are grades, authors or age
 * bands, and a panel that answered it two ways would make switching lens feel like
 * switching app. What changes per mode is the buckets, which is `bucketsFor`'s job.
 *
 * Every row is pickable here, unlike `Spread` — where `expired` and `unread` stay inert
 * because they are the absence of a reading rather than a kind of one. A bucket is always
 * a set of functions that exist and are on screen, including the "no git history" one, so
 * there is nothing to protect the reader from asking for.
 *
 * Widths are LINES, not counts, and that differs from `Spread` on purpose. `Spread` asks
 * how the readings came out, which is one vote each. These ask how much of the picture each
 * slice IS — and the picture is drawn by line count, so a bar weighted by function count
 * would disagree with the rings beside it about which author owns this repo.
 */
function Buckets({
  buckets,
  picked,
  onPick,
}: {
  buckets: Bucket[]
  picked: string | null
  onPick: (key: string | null) => void
}) {
  const total = buckets.reduce((a, b) => a + b.lines, 0)
  if (total === 0) return null

  return (
    <div className="mt-3">
      <div className="flex h-2 overflow-hidden rounded-[2px]">
        {buckets.map((b) => (
          <div
            key={b.key}
            style={{ width: `${(b.lines / total) * 100}%`, background: b.fill }}
            title={`${b.label} — ${b.nodes.length} functions, ${b.lines.toLocaleString()} lines`}
          />
        ))}
      </div>
      <div className="mt-2 space-y-0.5">
        {buckets.map((b) => {
          const on = b.key === picked
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(on ? null : b.key)}
              className={clsx(
                'flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--secondary)]',
                on && 'bg-[var(--secondary)]',
              )}
            >
              <span
                className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
                style={{ background: b.fill }}
              />
              <span
                className={clsx(
                  'flex-1 truncate text-[11px]',
                  on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
                )}
                title={b.label}
              >
                {b.label}
              </span>
              <span className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {b.nodes.length}
              </span>
            </button>
          )
        })}
      </div>
    </div>
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
  commits,
  mode,
  ranks,
  onSelect,
  onDrill,
}: {
  /** The subtree on screen. */
  node: Node
  /** What to call it — the project when at the root, the directory when drilled in. */
  title: string
  repo: string | null
  /** Commits reachable from HEAD; 0 when the scan found no history. */
  commits: number
  /** The lens the map is under. The panel describes the picture, so it has to follow —
   *  readings, expiries and "connect an agent" are answers to the surprise map and to
   *  nothing else, and under Blame they were a page of confident numbers about a quantity
   *  the rings in front of you were not showing. */
  mode: ColorMode
  /** Category → colour slot, so a row's swatch is the wedge's own colour. */
  ranks?: Map<string, number>
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  const s = summarize(node)
  const buckets = useMemo(() => bucketsFor(node, mode, ranks), [node, mode, ranks])
  // Go to it AND open the file around it: a name in this list is useless if clicking it
  // selects something off-screen. Drill first so the map moves, then select so the panel
  // fills in — the panel replacing this one is the point of the click.
  const goTo = (n: Node) => {
    onDrill?.(n)
    onSelect?.(n)
  }

  /** Which grade's readings the list is showing.
   *
   *  `null` means "not chosen", which is not the same as "none" — an unchosen panel falls
   *  back to the hottest grade that has anything in it, so opening a repo lands on the
   *  readings worth looking at rather than on an empty `full`. Held as an absence rather
   *  than initialised to that grade because the repo can change under the panel, and a
   *  remembered default would then be a choice nobody made. */
  const [picked, setPicked] = useState<Grade | null>(null)
  const shown: Grade =
    picked ?? ((['none', 'some', 'most', 'full'] as Grade[]).find((g) => s.byGrade[g].length > 0) ?? 'none')
  const list = s.byGrade[shown]

  /** The same idea one lens over: unchosen falls back to the biggest slice, so switching to
   *  Blame lands on the author who wrote most of what is on screen rather than on nothing.
   *  Held per mode — a key picked under Language means nothing under Age, and a remembered
   *  one would resolve to an empty list. */
  const [pickedBucket, setPickedBucket] = useState<string | null>(null)
  /** Show only the notes their reader marked as traps.
   *
   *  A filter rather than a paint. Traps are sparse and specific — the tier somebody would
   *  actually work through — and a map where danger and surprise are both colour cannot say
   *  which it means. */
  /** The notes list follows the lens instead of carrying its own filter.
   *
   *  It had a `traps` toggle while Surprise was the only panel showing notes. With Traps a
   *  lens of its own, the toggle and the tab were two controls for one question — so the tab
   *  is the control, and under it the list is exactly the trap notes. */
  const trapsOnly = mode === 'traps'
  useEffect(() => setPickedBucket(null), [mode])
  const bucket = buckets.find((b) => b.key === pickedBucket) ?? buckets[0] ?? null
  const shownNotes = trapsOnly ? s.notes.filter((n) => n.agent?.trap) : s.notes
  const lens = mode !== 'surprise'

  return (
    /* A column, not one long scroll.
       Three parts with three different claims on the height: what the repo IS, which is
       fixed; the readings themselves, which are as many as there are; and what to do next,
       which is a handful of lines. Scrolling the whole panel gave the list an arbitrary
       `max-h` — so it stopped mid-row with dead space under Next Steps, and on a taller
       window it would stop just as short. Only the middle one grows. */
    <div className="relative flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4">
        <h2 className="mono truncate text-sm font-semibold" title={title}>
          {title}
        </h2>
        {repo && (
          <p className="mono mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
            {elide(repo, 40)}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          {/* One shape for what a repo IS: lines, functions, commits — the same three the
              history header prints, so switching between them is not switching layouts.
              `compactCount` keeps it on one line whatever the project's size; a header that
              wraps on a big repo and not a small one is a layout tested against one repo. */}
          {compactCount(node.loc)} lines · {compactCount(s.functions)}{' '}
          {s.functions === 1 ? 'function' : 'functions'}
          {commits > 0 && <> · {compactCount(commits)} commits</>}
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
              {lens ? BREAKDOWN_TITLE[mode as Exclude<ColorMode, 'surprise'>] : 'Readings'}
            </p>
            {lens ? (
              <Buckets buckets={buckets} picked={bucket?.key ?? null} onPick={setPickedBucket} />
            ) : (
              // No legibility bar and no traps chip here any more: both are lenses of their
              // own, and a panel that also summarises the other two makes the Surprise tab a
              // dashboard rather than an answer to one question.
              <Spread
                spread={s.spread}
                read={s.read}
                stale={s.stale}
                unread={s.unread}
                picked={shown}
                onPick={setPicked}
              />
            )}
          </div>
        )}


      </div>

      {/* The one part that grows. `min-h-0` because a flex child will not shrink below its
          content without it, which is how a long list pushes its own scrollbar off the
          bottom of the pane instead of using one. */}
      <div className="flex min-h-0 flex-1 flex-col px-4">
        {/* The readings themselves. The map shows WHERE they are; this says WHICH they
            are, which is the thing you cannot read off a ring.
            It was the hot list alone, which answered one of the four questions the key
            above was already asking. Now the key chooses and this follows. */}
        {lens ? (
          bucket && bucket.nodes.length > 0 && (
            <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p
                  className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                  title={bucket.label}
                >
                  {bucket.label}
                </p>
                <p className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                  {bucket.nodes.length}
                </p>
              </div>
              {/* Painted by the same call the wedge is, so the swatch beside a name in this
                  list is the colour that name is wearing on the map. `colorFor` returns null
                  for what the mode cannot speak about, which is exactly the "no git history"
                  bucket — those take the neutral, and the label says why rather than showing
                  a blank. */}
              <ListWindow
                rows={bucket.nodes}
                onSelect={onSelect}
                goTo={goTo}
                paint={(n) => {
                  const c = colorFor(n, mode, ranks)
                  return { fill: c?.fill ?? 'var(--unanalyzed)', label: c?.label ?? '—' }
                }}
              />
            </div>
          )
        ) : (
          list.length > 0 && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                {HEAT_WORDS[shown]}
              </p>
              <p className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {list.length}
              </p>
            </div>
            {/* Scrolled, not truncated, and windowed.
                It showed twelve and then "and 37 more", which names a quantity and hides
                the thing itself — the whole reason this list exists is that the map can say
                WHERE the readings are and only a list can say WHICH. Thirty-seven behind a
                count is thirty-seven the reader cannot reach.

                Rendering them all is not the answer either. tonepoet's `cold` is 7,900
                functions, and a row is a button and three spans — thirty-two thousand DOM
                nodes, every one of which React has to build before the browser can paint.
                That was a second and a half of nothing happening after a click, which is
                the click feeling broken.

                So only what is on screen exists. A row is a fixed `h-5` for exactly this
                reason: uniform height is what lets the first visible index be arithmetic
                instead of measurement, and the two spacers hold the scrollbar at the size
                the whole list would have had. */}
            <ListWindow rows={list} onSelect={onSelect} goTo={goTo} />
          </div>
          )
        )}
      </div>

      {/* What readers actually said, in place of Next Steps.
          Next Steps restated the three counts the key above already gives — expired, unread,
          hot — as sentences. A count is not a finding, and the panel's most valuable payload
          was going somewhere else entirely: `note` is written only when a reading surprised
          its reader, so every line here is something a stranger thought worth saying out
          loud about a specific function, and until now it was visible one wedge at a time.

          Attributed, not asserted. These are claims a reader made, not conclusions the app
          reached — a reader in this repo's own last wave quoted a file it had never opened —
          so the note keeps the function's name next to it and clicking goes there to check.

          Scrollable and bounded rather than growing: it shares the pane with the readings
          list above, which is the thing you came to browse. */}
      {(!lens || mode === 'traps') && shownNotes.length > 0 && (
        <div className="flex max-h-[45%] shrink-0 flex-col border-t border-[var(--border)] px-4 pb-4 pt-3">
          <div className="mb-1.5 flex shrink-0 items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Notes
            </p>
            <div className="flex items-baseline gap-2">
              <p className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {shownNotes.length}
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto [overscroll-behavior:contain]">
            {shownNotes.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect?.(n)}
                onDoubleClick={() => goTo(n)}
                className="block w-full rounded-[var(--radius-sm)] px-1 py-0.5 text-left hover:bg-[var(--secondary)]"
              >
                <span className="mono flex items-baseline gap-1.5 text-[10.5px] text-[var(--foreground)]">
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-[2px]"
                    style={{ background: heatColor(temperature(n.score)) }}
                  />
                  <span className="truncate">{n.name}</span>
                  {/* Marked, not just sorted. The order carries the ranking, but a reader
                      scrolling past the first few needs to know which kind of thing they
                      are looking at without inferring it from position. */}
                  {n.agent?.trap && (
                    <span
                      className="shrink-0 rounded-[3px] px-1 text-[9px] font-semibold uppercase tracking-wide"
                      style={{ background: 'var(--trap)', color: 'var(--card)' }}
                      title="The reader says this will bite whoever edits it next."
                    >
                      trap
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--muted-foreground)]">
                  {n.agent?.note}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
