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
import { ageOf, bucketsFor, colorFor, VIEWS_DEFAULT, type Views, type Bucket, type ColorMode } from '../lib/colorMode'
import { Counts } from './Counts'

/** The order every breakdown in this app reads in: the LOUD end first.
 *
 *  It was `full` first — the calm end, matching the direction each ramp's own legend runs.
 *  That is a defensible order for a list on its own and it stopped being one when the same
 *  breakdown got drawn on the map: a container's rim is this bar curved onto the wedge it
 *  describes, so the two have to run the same way, and on a rim the order is a DIRECTION
 *  somebody compares between wedges rather than a list they read top to bottom.
 *
 *  Loud-first is the end that wins, and Churn and Age were already there — busiest first,
 *  most recent first — because it is the end anybody opens a lens to find. Every other
 *  breakdown now follows them rather than the other way round: the finding leads, and the
 *  quiet end trails off toward the absence rows, which are last whatever the sort. */
const GRADES: Grade[] = ['none', 'some', 'most', 'full']

/** What the breakdown is a breakdown OF, per mode.
 *
 *  Not `MODE_LABEL`: the switcher above the map says "Blame" because it is naming a lens,
 *  and this is naming the rows underneath it, which are authors. A heading that repeated
 *  the tab would tell the reader something they can already see. */
const BREAKDOWN_TITLE: Record<Exclude<ColorMode, 'surprise'>, string> = {
  legible: 'Legibility',
  docs: 'Documentation',
  // What the rows are, not what the lens is called. "Tested and untested" was the first
  // heading and it asserted the thing this cannot know: a call graph reports what it FOUND,
  // and a repo's shell suite is invisible to it entirely.
  testing: 'What tests were found to reach',
  traps: 'Traps',
  callers: 'Callers',
  reach: 'What it calls',
  clones: 'Clones',
  blame: 'Authors',
  language: 'Languages',
  // Not 'Commits in 90d': what is listed under it are functions, bucketed by the commits
  // their lines trace back to. The 90-day window is the FILE's quantity, and it has its own
  // section in the pane — see `blame.rs`.
  // Filled in by `breakdownTitle`: the rows are banded in one of two vocabularies and the
  // heading has to name the one they are actually in. The entry stays so the exhaustive map
  // still fails when a lens is added.
  tangle: 'Complexity',
  churn: 'Commits behind these lines',
  // Age reads two dates and the heading has to say which one is under it — see `AgeView`.
  // Filled in by `breakdownTitle`, because a `Record` cannot hold a value that depends on a
  // control; the entry stays so the exhaustive map still fails when a lens is added.
  age: 'Newest line',
}

/** The heading, with the one lens whose rows depend on a reading resolved. */
function breakdownTitle(mode: ColorMode, views: Views): string {
  if (mode === 'surprise') return 'Surprise'
  if (mode === 'age') return views.age.read === 'oldest' ? 'Oldest line' : 'Newest line'
  // **The only thing on screen that names the bar, and it has to stay.** The rows are degrees
  // now — `very high` down to `low` — which is what lets one set of words serve both readings,
  // and the cost of that is that the words no longer say which scale they are a position on.
  // Weighted grades a body against the others its size in this repo; raw counts against 15.
  // See `TANGLE_BANDS`.
  if (mode === 'tangle') return views.tangle === 'raw' ? 'Complexity' : 'Complexity for its size'
  return BREAKDOWN_TITLE[mode as Exclude<ColorMode, 'surprise'>]
}

/** Height of one row, in pixels, and it is a contract rather than a style.
 *
 *  `ListWindow` works out which rows are on screen by dividing the scroll offset by this,
 *  so a row that does not measure exactly this tall puts the window out of step with the
 *  scrollbar — slowly at first, and by whole rows near the bottom. The rows carry `h-5` to
 *  make it true. */
const ROW_H = 20

/**
 * What a row can say that the heading above it does not.
 *
 * The trailing column used to be `colorFor`'s label — the same string the mode paints the
 * wedge by — and under a list that is already grouped BY that value it is a hundred and
 * nineteen repetitions of the heading: every row under DAVID SAWYER read "David Sawyer",
 * every row under `blazing` read `blazing`, every row under `rust` read `rust`. A column
 * that restates its own header is a column of nothing.
 *
 * So each lens says the part of itself the bucket cannot. `age` and `churn` are bands, so
 * the row still has a value inside its band worth printing — and it prints only the part
 * the band leaves open: "5d ago" under `this week`, "11 in 90d" under `10+ commits`, where
 * both used to repeat the word the heading had just used.
 *
 * Everything else is a category — an author, a language, a grade, a trap — and a category
 * is the same for every row by construction. Those get LINES, which is not a restatement of
 * anything: it is the map's other axis, the one that decides how much of the picture each
 * row is, and it is the only way to tell the big function in a bucket from the small one.
 */
function rowNote(n: Node, mode: ColorMode, views: Views): string {
  const s = n.score
  if (mode === 'age') {
    const d = s ? ageOf(s, views.age.read) : null
    if (d === null) return '—'
    return d < 1 ? 'today' : `${Math.round(d)}d ago`
  }
  // Guarded on a DATE and printing `commits`, which is deliberate and reads as a mismatch
  // until you know why: `commits` is 0 both for a file nobody has touched this quarter and
  // for one git has never heard of, and only a date tells those apart. The em dash means
  // "no history"; a zero means "no commits in the window".
  //
  // A reader flagged the mismatch, I wrote a comment claiming I had fixed it, and a later
  // reader flagged the comment for asserting a property the body did not have. Both were
  // right to. The guard was correct all along; what was missing was the sentence saying so.
  // The rows are FUNCTIONS, so this is the commits their lines trace back to and not a
  // window — see `blame.rs` and `CHURN_BANDS`. It read `in 90d`, which the number is not.
  //
  // The date it guards on is `lastTouchedDays`, and it was `ageDays` until Age began painting
  // that field: the two are null together everywhere on the live map, and a replay stand-in
  // for a file that predates the window now honestly reports a null BIRTH and a real touch,
  // which under the old guard would have blanked Churn over the folded half of every frame.
  if (mode === 'churn') {
    if (!s || s.lastTouchedDays === null) return '—'
    // The window the map is painted at, named by the caller: the ladder is the repo's own and
    // a row saying `in 90d` on a project whose widest horizon is 27 days would be inventing a
    // measurement. See `churnLabel`, which both this and the wedge come out of.
    const n = s.commits[views.churn.at]
    return `${n} ${n === 1 ? 'change' : 'changes'}`
  }
  // Both wiring lenses are grouped by a value that leaves something open, so both print the
  // part the heading does not carry. Under `2–5 callers` the exact count is what the band
  // rounded off; under `most of it leaves` the fact behind the band is the two counts it came
  // from, and `7 of 9 away` never restates a heading the way a repeated percentage would.
  if (mode === 'callers') {
    if (n.callers == null) return '—'
    // Under `no in-repo caller`, what it CALLS is the useful half — and it separates the two
    // shapes of orphan that matter. A function calling nothing is an isolated stub; one
    // calling a dozen is the entry point of a whole subsystem nothing enters, which is a
    // much larger finding wearing the same color.
    if (n.callers === 0) return n.calls == null ? '—' : `calls ${n.calls}`
    return `${n.callers} callers`
  }
  if (mode === 'clones') {
    // The group's size is already the heading; what the row adds is WHERE the other copies
    // are, which is the next thing anybody asks and the reason the count alone is not enough.
    if (n.comparable == null) return '—'
    return n.cloneSize == null ? 'unique' : `1 of ${n.cloneSize}`
  }
  if (mode === 'reach') {
    if (n.calls == null) return '—'
    // Under `calls nothing here`, what CALLS it is the useful half, exactly as the count of
    // what it calls is under `no in-repo caller`. A leaf nothing calls either is dead; a leaf
    // six things call is a primitive, which is the opposite finding in the same bucket.
    if (n.calls === 0) return n.callers == null ? '—' : `${n.callers} callers`
    return `calls ${n.calls}`
  }
  return `${compactCount(n.loc)} lines`
}

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
  mode,
  rowViews,
}: {
  rows: Node[]
  onSelect?: (n: Node) => void
  goTo: (n: Node) => void
  /** The row's swatch — the same color the wedge is wearing, from `colorFor`. Defaults to
   *  the reading's heat, which is what the surprise panel wants. The trailing text is not a
   *  caller's business: it is `rowNote`, so no list can end up restating its own heading. */
  paint?: (n: Node) => { fill: string }
  /** Which lens the trailing column should answer for. */
  mode: ColorMode
  /** How the calibrated lenses are set — see `Views`. Passed rather than defaulted, so a list
   *  cannot print a date, or a window, the map is not painted in. */
  rowViews: Views
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
    <div ref={box} className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain]">
      {/* Spacers, so the scrollbar describes the whole list rather than the slice of it
          that happens to exist. */}
      <div style={{ height: first * ROW_H }} />
      {shown.map((h) => {
        const fill = paint?.(h).fill ?? heatColor(temperature(h.score))
        return (
          <button
            key={h.id}
            type="button"
            className="flex h-5 w-full items-center gap-2 rounded-[var(--radius-sm)] px-1 text-left hover:bg-[var(--secondary)]"
            onClick={() => onSelect?.(h)}
            onDoubleClick={() => goTo(h)}
          >
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: fill }} />
            <span className="mono flex-1 truncate text-[11px]">{h.name}</span>
            <span className="mono shrink-0 truncate text-[10px] text-[var(--muted-foreground)]">
              {rowNote(h, mode, rowViews)}
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
 * panel that invented its own four colors would be a second legend disagreeing with the
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
            title={`${b.label} — ${b.count.toLocaleString()} functions, ${b.lines.toLocaleString()} lines`}
          />
        ))}
      </div>
      {/* Scrolled, and bounded to a third of the pane.
          `Spread`'s key is six rows and always will be — a grade is one of four. A bucket
          list is however many authors a repo has, and flox has forty: the key alone was
          taller than the pane, so it pushed the list of the picked author's functions off
          the bottom and the row you clicked answered somewhere you could not see. The cap
          is a share of the height rather than a row count, because what has to fit is the
          list underneath, and how much room that needs is the window's business. */}
      <div className="mt-2 max-h-[33vh] space-y-0.5 overflow-y-auto [overscroll-behavior:contain]">
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
              {/* **Lines, because lines are what the list is SORTED by.** It printed
                  `count` — functions, or files on a repo whose rings have not been fetched —
                  while `sortBuckets` ordered blame by lines, so the column read 1,819 · 1,019
                  · 985 · 216 · 86 · 309: not descending, because it was never sorted by what
                  it showed. A number that does not explain its own order is worse than no
                  number.
                  Lines is the half to keep. It is what the bar above is drawn in, what a
                  wedge's width means, and the more informative of the two — "who owns 1,800
                  lines" is a fact, "who owns 1,800 functions" is a fact about how the code
                  was chopped up. The count is not lost: it is on the row's own tooltip, next
                  to the share it explains. */}
              <span
                className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]"
                title={`${b.count.toLocaleString()} ${b.count === 1 ? 'item' : 'items'} · ${b.lines.toLocaleString()} lines`}
              >
                {b.lines.toLocaleString()}
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
 * It used to be empty, on the argument that the gestures were already stated on the wedges
 * they apply to. That is still true of the gestures — and it left the panel saying nothing
 * at the one moment the question is "what am I looking at", which is exactly when you have
 * not picked a wedge yet.
 *
 * Everything here is counted off `node` — the subtree the map is currently showing — for
 * the same reason `ColorLegend` counts its hatches off `focus`: drilled two levels in,
 * repo-wide numbers annotate a picture nobody is looking at. The sidebar row remains the
 * repo-wide count, and the header names what this one covers so the two can never be
 * mistaken for each other.
 */
export function Summary({
  node,
  title,
  repo,
  mode,
  ranks,
  views,
  onSelect,
  onDrill,
  path,
  footer,
  about,
}: {
  /** The subtree on screen. */
  node: Node
  /** Where it lives, as the clickable crumbs `Detail` builds. Undefined at the root, which
   *  is not inside anything. */
  path?: React.ReactNode
  /** Which instrument produced these numbers, pinned to the bottom. */
  footer?: React.ReactNode
  /** What this container says about ITSELF — a file's header and the reading of it.
   *  Built by `Detail`, which owns the markdown renderer and the copy button. */
  about?: React.ReactNode
  /** What to call it — the project when at the root, the directory when drilled in. */
  title: string
  repo: string | null
  /** The lens the map is under. The panel describes the picture, so it has to follow —
   *  readings, expiries and "connect an agent" are answers to the surprise map and to
   *  nothing else, and under Blame they were a page of confident numbers about a quantity
   *  the rings in front of you were not showing. */
  mode: ColorMode
  /** Category → color slot, so a row's swatch is the wedge's own color. */
  ranks?: Map<string, number>
  /** How Age is calibrated and which of its two dates it paints — see `AgeView`. Threaded rather than derived from `node`,
   *  which is the drilled-into subtree and would put this panel on its own scale. */
  views?: Views
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  const s = summarize(node)
  const buckets = useMemo(
    () => bucketsFor(node, mode, ranks, views),
    [node, mode, ranks, views],
  )
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
   *  than initialized to that grade because the repo can change under the panel, and a
   *  remembered default would then be a choice nobody made. */
  const [picked, setPicked] = useState<Grade | null>(null)
  const shown: Grade =
    picked ??
    (['none', 'some', 'most', 'full'] as Grade[]).find((g) => s.byGrade[g].length > 0) ??
    'none'
  const list = s.byGrade[shown]

  /** The same idea one lens over: unchosen falls back to the biggest slice, so switching to
   *  Blame lands on the author who wrote most of what is on screen rather than on nothing.
   *  Held per mode — a key picked under Language means nothing under Age, and a remembered
   *  one would resolve to an empty list. */
  const [pickedBucket, setPickedBucket] = useState<string | null>(null)
  useEffect(() => setPickedBucket(null), [mode])
  const bucket = buckets.find((b) => b.key === pickedBucket) ?? buckets[0] ?? null
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
        <div className="flex items-center gap-2">
          <h2 className="mono truncate text-sm font-semibold" title={title}>
            {title}
          </h2>
        </div>
        {path ??
          (repo && (
            <p className="mono mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
              {elide(repo, 40)}
            </p>
          ))}
        {/* What this subtree is MADE OF, with the name above it.

            It used to ride into the dial row as that row's `lead`, so that what a thing is
            made of sat with what was measured of it. With the dials gone it belongs to the
            header, and it brings no rule of its own: the breakdown below already opens with
            one, and two rules a few pixels apart would divide a header from itself.

            The commit count comes off the node's own score now, not from the `commits` prop:
            that prop is `git rev-list --count HEAD`, which the repo has and nothing below it
            does, and one word over two different questions is what put `in 90d` on a number
            that was not. See `Counts`. */}
        <Counts node={node} functions={s.functions} excluded={s.excluded} />

        {about}

        {s.functions > 0 && (
          /* Full-bleed (`-mx-4`, re-padded with `px-4`) so the rule reaches both edges of the
             pane. Inset, it read as a rule belonging to the text column; the header above it
             is the pane's subject and the break under it separates two sections of the pane,
             which is the width the history log's own divider already had. */
          <div className="-mx-4 mt-4 border-t border-[var(--border)] px-4 pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              {/* Named for the lens, like every other tab's heading. It read `Readings`,
                  which names the CATEGORY of thing being counted rather than what is being
                  asked about them — the one heading in the pane that did not answer "which
                  lens am I looking at". */}
              {breakdownTitle(lens ? mode : 'surprise', views ?? VIEWS_DEFAULT)}
            </p>
            {lens ? (
              <Buckets buckets={buckets} picked={bucket?.key ?? null} onPick={setPickedBucket} />
            ) : (
              // No legibility bar and no traps chip here any more: both are lenses of their
              // own, and a panel that also summarizes the other two makes the Surprise tab a
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
        {lens
          ? bucket &&
            bucket.count > 0 && (
              <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p
                    className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                    title={bucket.label}
                  >
                    {bucket.label}
                  </p>
                  <p className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                    {bucket.nodes.length === bucket.count
                      ? bucket.count.toLocaleString()
                      : `${bucket.nodes.length.toLocaleString()} of ${bucket.count.toLocaleString()}`}
                  </p>
                </div>
                {/* **A bucket can hold more than it can name.** The breakdown counts every
                    function in the subtree, including those in files whose ring the window
                    has not asked for — that is the whole point of `Node.cols`. Those have a
                    value and a line count and no node to list, so the header says how many of
                    the slice this list is, and a row of nothing gets a sentence instead of
                    reading as an empty answer. Drilling in fetches them. */}
                {bucket.nodes.length === 0 && (
                  <p className="text-[11px] text-[var(--note-ink)]">
                    Counted from the scan. Drill in to list them.
                  </p>
                )}
                {/* Painted by the same call the wedge is, so the swatch beside a name in this
                  list is the color that name is wearing on the map. `colorFor` returns null
                  for what the mode cannot speak about, which is exactly the "no git history"
                  bucket — those take the neutral, and the label says why rather than showing
                  a blank. */}
                <ListWindow
                  rows={bucket.nodes}
                  onSelect={onSelect}
                  goTo={goTo}
                  mode={mode}
                  rowViews={views ?? VIEWS_DEFAULT}
                  paint={(n) => ({
                    fill: colorFor(n, mode, ranks, views)?.fill ?? 'var(--unanalyzed)',
                  })}
                />
              </div>
            )
          : list.length > 0 && (
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
                <ListWindow
                  rows={list}
                  onSelect={onSelect}
                  goTo={goTo}
                  mode={mode}
                  rowViews={views ?? VIEWS_DEFAULT}
                />
              </div>
            )}
      </div>

      {/* Pinned to the bottom, a flex sibling of the list rather than the last thing inside
          it. Who produced these numbers is the one line that should not require scrolling
          past a hundred and fifty functions to reach — and a footer that moves with the
          list is not a footer, it is the end of the list. */}
      {footer && (
        <p className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
          {footer}
        </p>
      )}

      {/* No notes list here.
          It ran every note a reader had written down the pane, and a note is written ABOUT a
          function — "the name reads as generic attrset manipulation", "any reordering
          silently changes which package wins". Stacked forty deep with only a name beside
          them, they are sentences about nothing: the reader cannot see the signature, the
          docs, the grades or the body any of them is qualifying, which is exactly the
          context the panel supplies when you have a wedge selected. The list said WHICH
          functions have something to say — and the map already says that, in the color it
          is painted, and the readings list above says it by name.

          So a note is shown where it means something: on the function it was written about,
          with the reading it belongs to. See `Detail`. */}
    </div>
  )
}
