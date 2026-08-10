import { memo, useCallback, useLayoutEffect, useRef } from 'react'
import { posOf, type HistoryCommit, type HistoryScan } from '../lib/history'
import { compactCount, elide } from '../lib/text'

/** One row's height, in pixels, fixed rather than measured.
 *
 *  Every row is a truncated subject over a truncated meta line, so they are uniform
 *  anyway — stating it lets the playhead be positioned by arithmetic instead of by asking
 *  the DOM where a row is. That is what makes following the replay `O(1)` per frame rather
 *  than a layout query at three hundred commits a second. */
const ROW_H = 42

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
}: {
  c: HistoryCommit
  real: number
  selected: boolean
  onPick: (real: number) => void
}) {
  return (
    <button
      onClick={() => onPick(real)}
      className="relative z-10 block w-full overflow-hidden border-b border-[var(--border)] px-3 text-left"
      style={{
        height: ROW_H,
        // The same fill a selected project gets in the sidebar (`.shell-chrome--active`).
        background: selected ? 'color-mix(in oklch, var(--accent) 22%, transparent)' : undefined,
        boxShadow: selected ? 'inset 4px 0 0 var(--accent)' : undefined,
      }}
    >
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
        {c.set.length > 0 && <> · +{c.set.length}</>}
        {c.del.length > 0 && <> · −{c.del.length}</>}
      </p>
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
  hist,
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
  hist: HistoryScan
  repo?: string | null
  loc: number
  functions: number
  /** The commits in scope, as indices into `hist.commits`. Drilling into a directory asks
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
  /** Set when the position changed because somebody clicked a row in HERE. */
  const fromClick = useRef(false)

  /**
   * Follow the playhead — but only when the playhead is the thing moving.
   *
   * Centring is right while playing: the frontier is arriving continuously and the reader
   * is watching, not aiming. It is wrong the moment they take hold of it. A click centred
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
   * flickering out and reappearing somewhere else rather than travelling.
   */
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    if (fromClick.current) {
      fromClick.current = false
      return
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

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
        {/* The same three lines the readings pane prints — name, path, then what the repo
            IS. The two panes are the same column under two modes, and a header that changed
            shape between them made switching feel like switching app. */}
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
          {scope && <> touching this, of {hist.commits.length}</>}
          {!scope && hist.truncated > 0 && (
            /* Counted out loud. A timeline that quietly starts in the middle reads as the
               whole life of the repo — the same rule `excluded` follows in the scan. */
            <> · {hist.truncated} earlier ones folded into the first frame</>
          )}
        </p>
      </div>

      {frames.length === 0 ? (
        /* A file that exists only because commits before the window built it. The rings
           still draw it; nothing in the replayed window ever touched it, and saying that
           is better than an empty pane that reads as a failure. */
        <p className="p-3 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
          Nothing in this window touched {scope || 'the repo'} — it was already here when
          the replay starts.
        </p>
      ) : (
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* The list, and over it the two things that move. Both are transformed rather
            than re-laid-out, so following the playhead costs a compositor frame and no
            React work at all. */}
        <div className="relative">
          {frames.map((real, i) => (
            <Row
              key={hist.commits[real].sha}
              c={hist.commits[real]}
              real={real}
              selected={i === pos}
              onPick={pick}
            />
          ))}

          {/* Everything still to come, dimmed by one element rather than by a style on
              each row. Over the rows, because dimming text means covering it — and
              therefore not eating their clicks.
              
              Sized to the rows it covers, NOT stretched to the bottom and slid down. It
              was the latter, which meant a full-height box hanging `(pos + 1)` rows past
              the end of the list — and an absolutely-positioned overhang counts towards
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
    </div>
  )
}
