import { memo, useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { posOf } from '../lib/history'
import { historyLog, type LogRow, type Tables } from '../lib/timeline'
import { CommitCard } from './CommitCard'
import { compactCount, elide } from '../lib/text'

/** One row's height, in pixels, fixed rather than measured.
 *
 *  Every row is a truncated subject over a truncated meta line, so they are uniform
 *  anyway — stating it lets the playhead be positioned by arithmetic instead of by asking
 *  the DOM where a row is. That is what makes following the replay `O(1)` per frame rather
 *  than a layout query at three hundred commits a second. */
const ROW_H = 42

/** Rows rendered beyond the viewport, above and below.
 *
 *  Enough that a fast scroll or a playhead jump lands on rows that already exist. Two
 *  screens' worth would be safer and is not free: every row is a subscription the browser
 *  has to lay out, and the reason this list is windowed at all is that there can be five
 *  thousand of them. */
const OVERSCAN = 12

/** Rows fetched per request. A few screens' worth: small enough that scrolling fast does not
 *  queue megabytes, large enough that a steady scroll is not a request per row. */
const PAGE = 200

/** How often the list may follow the playhead, in milliseconds.
 *
 *  **A replay does not need thirty scroll positions a second.** Following per frame put the
 *  log inside the render loop twice over: setting `scrollTop` fires a scroll event, which
 *  moves the window, which re-renders the rows and re-runs the fetch that keeps them — and at
 *  sixty commits a frame the text is unreadable anyway. Six updates a second looks identical
 *  and costs a fifth as much. */
const FOLLOW_MS = 160

/** Page requests allowed in flight at once. A replay sweeping the whole log would otherwise
 *  queue one per page — six hundred on a large repo — and every one of them lands after the
 *  playhead has moved past the rows it holds. */
const INFLIGHT = 2

/**
 * One commit.
 *
 * Memoised, and that is the only thing standing between this list and the lag it used to
 * have: styling a row by its relation to the playhead makes every row's appearance a
 * function of the position, so a thousand-row log did a thousand DOM updates per frame.
 * With `memo` the elements are still recreated each frame — cheap — but exactly two rows
 * actually re-render: the one being left and the one being arrived at.
 *
 * The selection is a BACKGROUND on the row itself, the same way the sidebar fills a
 * selected project. It was tried as an overlay — a tint drawn over the list at the right
 * offset — twice, and an overlay is stuck between two bad options: above the text it must
 * stay pale enough to read through, which on this ground is invisible, and below the text
 * it depends on a stacking order with nothing to make it obvious when it is wrong. A row
 * that knows it is selected has neither problem, and the cost is a memo comparison.
 */
const Row = memo(function Row({
  c,
  real,
  selected,
  onPick,
  onOpen,
}: {
  /** Undefined until this row's page arrives. A blank row of the right height, rather than a
   *  spinner or a collapsed list: the scrollbar must not move under somebody's hand because
   *  the data they scrolled to has not landed. */
  c: LogRow | undefined
  real: number
  selected: boolean
  onPick: (real: number) => void
  /** Show this commit in full.
   *
   *  **Its own affordance, because the row already means something.** Clicking a row here
   *  jumps the playhead, which is the log's whole job — the transport and the list are one
   *  gesture. So the details take a button of their own rather than a second meaning for the
   *  same click, or a modal would open every time somebody scrubbed. */
  onOpen: (sha: string) => void
}) {
  return (
    <button
      onClick={() => onPick(real)}
      className="group relative block w-full border-b border-[var(--border)] px-4 py-1.5 text-left hover:bg-[var(--secondary)]"
      style={{ height: ROW_H, background: selected ? 'var(--secondary)' : undefined }}
    >
      {c && (
        <>
          <p
            className="truncate text-[12px] leading-tight text-[var(--foreground)]"
            style={{ fontWeight: selected ? 600 : 400 }}
          >
            {c.subject}
          </p>
          <p className="mono truncate text-[10px] leading-tight text-[var(--muted-foreground)]">
            {c.short} · {c.author} · {stamp(c.ts)}
            {/* What this commit did to the picture — the only reason the log sits beside the
                rings rather than in a terminal. Zeroes are left off: a commit that touched no
                function still touched files, and a row of "+0 −0" teaches the reader to stop
                looking at the numbers. */}
            {c.sets > 0 && <> · +{c.sets}</>}
            {c.dels > 0 && <> · −{c.dels}</>}
          </p>
          {/* The same glyph and the same weight the code tiles and the lifespan rows use — one
              mark in this app means "open this in full". Quiet at rest and up on hover: a
              permanent control at full strength on every row of a list this long is a column
              of chrome down the side of a transcript.

              A `span` with a role, not a `button`: the row IS a button — clicking it jumps the
              playhead — and a button inside a button is not something the platform renders. */}
          <span
            role="button"
            tabIndex={0}
            title="Open this commit"
            aria-label={`Open commit ${c.short}`}
            onClick={(e) => {
              e.stopPropagation()
              onOpen(c.sha)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                e.preventDefault()
                onOpen(c.sha)
              }
            }}
            className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center rounded-[4px] border border-[var(--border)] bg-[var(--card)] p-[3px] text-[var(--muted-foreground)] opacity-70 shadow-sm transition-opacity group-hover:opacity-100 hover:!text-[var(--foreground)] focus-visible:opacity-100"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M7.2 1.4h3.4v3.4M4.8 10.6H1.4V7.2M10.6 1.4 7 5M1.4 10.6 5 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </>
      )}
    </button>
  )
})

function stamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * The log beside the map: what the rings are doing, in words.
 *
 * Oldest at the top with the playhead running down, which is the opposite of every commit
 * list ever shipped — and right here, because this is not a place to look something up, it
 * is a transcript being read aloud. Newest-first would put the ending at the top and
 * scroll the frontier out of view as it advanced.
 *
 * **The rows never re-render.** They were styled per row by whether they were ahead of the
 * playhead, which makes every row's appearance a function of `index` — so a thousand-row
 * log did a thousand React updates per frame, and at speed the pane simply fell behind the
 * map it was supposed to be narrating. What moves now is two absolutely-positioned
 * elements over a static list: a cursor on the current commit, and a scrim over everything
 * still to come. Same picture, one update instead of a thousand.
 */
export function CommitLog({
  repoKey,
  repoPath,
  tables,
  frames,
  scope,
  index,
  playing,
  onIndex,
  name,
  repo,
  loc,
  functions,
}: {
  /** Which project a commit card asks about. The log fetches its own rows by PATH — the
   *  timeline is machine-local and keyed that way — but a commit is asked of the backend's
   *  project map, like every other per-repo lookup on this side. */
  repoKey: string | null
  /** Where to fetch rows from. The log is paged — see `pages` below. */
  repoPath: string | null
  tables: Tables
  repo?: string | null
  loc: number
  functions: number
  /** The commits in scope, as indices into the timeline. Drilling into a directory asks
   *  a narrower question, and a log still listing the whole repo answers a different one —
   *  most of its rows would be commits that change nothing on screen. */
  frames: number[]
  /** What the log has been narrowed to. Empty is the whole repo. */
  scope: string
  /** The real commit index on screen. */
  index: number
  /** Whether the transport is running. The log only takes the scroll position over while
   *  it is — see the effect below. */
  playing: boolean
  /** Must be stable across renders, or the memoised rows below rebuild anyway and the
   *  whole point of this component is lost. */
  onIndex: (i: number) => void
  name: string
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const pos = posOf(frames, index)

  /**
   * The rows that exist right now, by their position in `frames`.
   *
   * **Loaded and unloaded as you scroll, because a log can be a hundred thousand rows.** A
   * frame is a commit and every one of them is addressable, so the list is as long as the
   * repo's history — and holding all of it was the same mistake at a different layer as
   * shipping the whole timeline: ceph's log alone is 16MB of subjects and authors to render
   * a dozen lines of text.
   *
   * Pages of `PAGE`, keyed by page number, with everything more than a page away from the
   * viewport dropped. Nothing here is authoritative — a page that has fallen out is fetched
   * again, which is a request, not a loss.
   */
  const pages = useRef(new Map<number, LogRow[]>())
  const wanted = useRef(new Set<number>())
  /** Rows arrived. A counter rather than state holding the pages themselves: the fetch
   *  effect must not depend on what it fetches, or every arrival re-runs it. */
  const [, arrived] = useReducer((n: number) => n + 1, 0)
  /** What part of the list is on screen, in rows.
   *
   *  **Only the visible rows are rendered, because a frame is addressable and there can be
   *  thousands of them.** A trace produces every frame anybody might click — five thousand
   *  four hundred at the longest replay this transport offers — and a list that puts all of
   *  them in the DOM pays for that on every render of the pane, in a component whose entire
   *  design note above is about not doing per-row work. The rows are a fixed height, so the
   *  window is arithmetic rather than measurement.
   *
   *  Kept as one object so a scroll that changes neither number renders nothing. */
  const [view, setView] = useState({ top: 0, height: 0 })
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    setView((v) => (v.height === el.clientHeight ? v : { ...v, height: el.clientHeight }))
  })
  const first = Math.max(0, Math.floor(view.top / ROW_H) - OVERSCAN)
  const last = Math.min(
    frames.length,
    Math.ceil((view.top + Math.max(view.height, ROW_H)) / ROW_H) + OVERSCAN,
  )
  /** Set when the position changed because somebody clicked a row in HERE. */
  const fromClick = useRef(false)

  /**
   * Follow the playhead — but only when the playhead is the thing moving.
   *
   * Centring is right while playing: the frontier is arriving continuously and the reader
   * is watching, not aiming. It is wrong the moment they take hold of it. A click centered
   * the row under the cursor, which means the list scrolls out from under the pointer at
   * the instant of the click — so the row you chose lands somewhere other than where you
   * clicked, and what should read as "selected" reads as "the pane jumped". A reader
   * clicking a row can already see it; there is nothing to reveal.
   *
   * Paused and scrubbing from the bar is the third case: the playhead moves without the
   * reader touching the list, so the row is brought into view — minimally, keeping
   * whatever scroll position they had, rather than yanked to the middle.
   *
   * Set outright rather than animated throughout. `scrollIntoView({ behavior: 'smooth' })`
   * queues an animation per call; asked to run one every frame it spends the whole replay
   * finishing the first few, which is the lag this pane used to have.
   *
   * A LAYOUT effect, so the scroll lands in the same frame as the row it is following. As
   * an ordinary effect it runs after paint, which at three hundred commits a second means
   * frames where the highlight has already moved and the list has not — the highlight
   * flickering out and reappearing somewhere else rather than traveling.
   */
  const lastFollow = useRef(0)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (fromClick.current) {
      fromClick.current = false
      return
    }
    // Throttled while playing — see `FOLLOW_MS`. Not while paused: a scrub is one movement
    // somebody made and it has to land where they put it.
    if (playing) {
      const now = performance.now()
      if (now - lastFollow.current < FOLLOW_MS) return
      lastFollow.current = now
    }
    const top = pos * ROW_H
    if (playing) {
      el.scrollTop = Math.max(0, top + ROW_H / 2 - el.clientHeight / 2)
    } else if (top < el.scrollTop) {
      el.scrollTop = top
    } else if (top + ROW_H > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_H - el.clientHeight
    }
  }, [pos, playing])

  /** Fetch the pages the window is over, and forget the ones it has left.
   *
   *  Keyed on the scope as well as the range: drilling asks a different question of the same
   *  timeline, and a page of the old answer at the same offset is a page of the wrong list. */
  useEffect(() => {
    if (!repoPath) return
    const from = Math.floor(first / PAGE)
    const to = Math.floor(Math.max(first, last - 1) / PAGE)
    let live = true
    for (let p = from; p <= to; p++) {
      if (pages.current.has(p) || wanted.current.has(p)) continue
      // **Never more than a couple at once.** The alternative is what a replay does to this
      // component: the playhead sweeps the list, every frame asks for the page it has just
      // reached, and the answers arrive behind a playhead that has moved on. The rows in
      // flight are already the rows nobody is reading.
      if (wanted.current.size >= INFLIGHT) break
      wanted.current.add(p)
      void historyLog(repoPath, p * PAGE, PAGE, scope)
        .then((rows) => {
          wanted.current.delete(p)
          if (!live) return
          pages.current.set(p, rows)
          // Anything more than a page either side of the view is gone. The list is a view of
          // a story, and a view that never lets go is a copy.
          for (const held of [...pages.current.keys()]) {
            if (held < from - 1 || held > to + 1) pages.current.delete(held)
          }
          arrived()
        })
        .catch(() => wanted.current.delete(p))
    }
    return () => {
      live = false
    }
  }, [repoPath, scope, first, last])

  /** A different question means different rows. */
  useEffect(() => {
    pages.current.clear()
    wanted.current.clear()
    arrived()
  }, [scope, repoPath])

  /** Stable, so `Row`'s memo actually holds — a fresh arrow per render would re-render
   *  every row and undo the whole arrangement. */
  const pick = useCallback(
    (real: number) => {
      // Flagged before the position changes, so the scroll effect above can tell this
      // apart from the transport moving on its own and leave the scroll alone.
      fromClick.current = true
      onIndex(real)
    },
    [onIndex],
  )

  /** The commit whose card is open, or null. Stable callback for the same reason `pick` is:
   *  an arrow rebuilt per render defeats every row's memo, which is the arrangement this
   *  component exists for. */
  const [card, setCard] = useState<string | null>(null)
  const open = useCallback((sha: string) => setCard(sha), [])

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4">
        {/* The same three lines the readings pane prints — name, path, then what the repo
            IS. The two panes are the same column under two modes, and a header that changed
            shape between them made switching feel like switching app.

            Pixel-identical, not merely alike: the padding, the type and the rule below all
            come from `Summary`'s header, because the two are one column and the switch
            between them is a change of CONTENT. Anything that moves by three pixels reads
            as the pane being rebuilt. */}
        <p className="mono truncate text-sm font-semibold text-[var(--foreground)]">{name}</p>
        {repo && (
          <p className="mono mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]">
            {elide(repo, 40)}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
          {compactCount(loc)} lines · {compactCount(functions)} functions ·{' '}
          {compactCount(frames.length)} commits
          {/* Said out loud whenever the list is a subset, so a short log reads as a
              narrowed question rather than as a repo with little history. */}
          {scope && <> touching this, of {tables.commits}</>}
          {!scope && tables.truncated > 0 && (
            /* Counted out loud. A timeline that quietly starts in the middle reads as the
               whole life of the repo — the same rule `excluded` follows in the scan. */
            <> · {tables.truncated} earlier ones folded into the first frame</>
          )}
        </p>

        {/* The same rule that sits under the readings header, at the same offset — `mt-4`
            over `pt-3`, drawn here rather than as a border on the header box so the gap
            above it exists in both panes. A border hard against the last line of text put
            history's divider a dozen pixels higher than age's.

            Full-bleed (`-mx-4`) where the readings pane's is inset, because of what sits
            under each. There it introduces a heading; here it introduces a list whose rows
            carry full-width rules of their own, and an inset rule a dozen pixels above a
            full-width one reads as two different dividers rather than one list starting. */}
        <div className="-mx-4 mt-4 border-t border-[var(--border)] pt-3" />
      </div>

      {frames.length === 0 ? (
        /* A file that exists only because commits before the window built it. The rings
           still draw it; nothing in the replayed window ever touched it, and saying that
           is better than an empty pane that reads as a failure. */
        <p className="px-4 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Nothing in this window touched {scope || 'the repo'} — it was already here when
          the replay starts.
        </p>
      ) : (
      <div
        ref={scroller}
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop
          // Quantised to the row: a pixel of scroll cannot change which rows exist, and
          // re-rendering on every pixel would undo the saving this window exists for.
          setView((v) =>
            Math.floor(v.top / ROW_H) === Math.floor(top / ROW_H) ? v : { ...v, top },
          )
        }}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
        {/* The list, and over it the two things that move. Both are transformed rather
            than re-laid-out, so following the playhead costs a compositor frame and no
            React work at all. */}
        {/* Full height whatever is rendered inside it, so the scrollbar describes the whole
            log and `scrollTop` arithmetic — the playhead-following effect above, and this
            window itself — keeps meaning what it meant. */}
        <div className="relative" style={{ height: frames.length * ROW_H }}>
          <div style={{ transform: `translateY(${first * ROW_H}px)` }}>
            {frames.slice(first, last).map((real, i) => {
              const at = first + i
              return (
                <Row
                  key={real}
                  c={pages.current.get(Math.floor(at / PAGE))?.[at % PAGE]}
                  real={real}
                  selected={at === pos}
                  onPick={pick}
                  onOpen={open}
                />
              )
            })}
          </div>

          {/* Everything still to come, dimmed by one element rather than by a style on
              each row. Over the rows, because dimming text means covering it — and
              therefore not eating their clicks.
              
              Sized to the rows it covers, NOT stretched to the bottom and slid down. It
              was the latter, which meant a full-height box hanging `(pos + 1)` rows past
              the end of the list — and an absolutely-positioned overhang counts toward
              the scroll extent, so the pane grew a screenful of dead space that got longer
              the further the replay ran. Height and offset from the same arithmetic, so
              the covered region is exactly the commits still to come. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-[var(--card)]"
            style={{
              height: Math.max(0, frames.length - pos - 1) * ROW_H,
              transform: `translateY(${(pos + 1) * ROW_H}px)`,
              opacity: 0.62,
            }}
          />
        </div>
      </div>
      )}
      {card && <CommitCard repoKey={repoKey} sha={card} onClose={() => setCard(null)} />}
    </div>
  )
}
