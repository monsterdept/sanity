import { useEffect, useMemo, useRef } from 'react'
import type { HistoryScan } from '../lib/history'

/** One row's height, in pixels, fixed rather than measured.
 *
 *  Every row is a truncated subject over a truncated meta line, so they are uniform
 *  anyway — stating it lets the playhead be positioned by arithmetic instead of by asking
 *  the DOM where a row is. That is what makes following the replay `O(1)` per frame rather
 *  than a layout query at three hundred commits a second. */
const ROW_H = 42

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
  index,
  onIndex,
  name,
}: {
  hist: HistoryScan
  index: number
  /** Must be stable across renders, or the memoised rows below rebuild anyway and the
   *  whole point of this component is lost. */
  onIndex: (i: number) => void
  name: string
}) {
  const scroller = useRef<HTMLDivElement>(null)

  // Centred, and set outright rather than animated. `scrollIntoView({ behavior: 'smooth' })`
  // queues an animation per call; asked to run one every frame it spends the whole replay
  // finishing the first few, which is exactly the lag this pane had. At thirty frames a
  // second the steps are small enough that assignment reads as motion anyway.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = Math.max(0, (index + 0.5) * ROW_H - el.clientHeight / 2)
  }, [index])

  // Built once per timeline. Nothing in here depends on the playhead — that is the whole
  // trick.
  const rows = useMemo(
    () =>
      hist.commits.map((c, i) => (
        <button
          key={c.sha}
          onClick={() => onIndex(i)}
          className="block w-full overflow-hidden border-b border-[var(--border)] px-3 text-left"
          style={{ height: ROW_H }}
        >
          <p className="truncate text-[12px] leading-tight text-[var(--foreground)]">
            {c.subject}
          </p>
          <p className="mono truncate text-[10px] leading-tight text-[var(--muted-foreground)]">
            {c.short} · {c.author} · {stamp(c.ts)}
            {/* What this commit did to the picture — the only reason the log sits beside
                the rings rather than in a terminal. Zeroes are left off: a commit that
                touched no function still touched files, and a row of "+0 −0" teaches the
                reader to stop looking at the numbers. */}
            {c.set.length > 0 && <> · +{c.set.length}</>}
            {c.del.length > 0 && <> · −{c.del.length}</>}
          </p>
        </button>
      )),
    [hist, onIndex],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2">
        <p className="truncate text-sm text-[var(--foreground)]">{name}</p>
        <p className="text-[11px] text-[var(--muted-foreground)]">
          {hist.commits.length} commits
          {hist.truncated > 0 && (
            /* Counted out loud. A timeline that quietly starts in the middle reads as the
               whole life of the repo — the same rule `excluded` follows in the scan. */
            <> · {hist.truncated} earlier ones folded into the first frame</>
          )}
        </p>
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* The list, and over it the two things that move. Both are transformed rather
            than re-laid-out, so following the playhead costs a compositor frame and no
            React work at all. */}
        <div className="relative">
          {rows}

          {/* Everything still to come, dimmed by one element. Painted over the rows, so
              it must not eat their clicks. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-[var(--card)]"
            style={{
              top: 0,
              transform: `translateY(${(index + 1) * ROW_H}px)`,
              opacity: 0.62,
            }}
          />

          {/* The playhead. An accent edge rather than a filled row: the fill would have to
              sit UNDER the text to be readable, and under the text is where the scrim is. */}
          <div
            className="pointer-events-none absolute inset-x-0"
            style={{
              height: ROW_H,
              transform: `translateY(${index * ROW_H}px)`,
              boxShadow: 'inset 3px 0 0 var(--accent)',
              background: 'color-mix(in oklch, var(--accent) 12%, transparent)',
              opacity: index < 0 ? 0 : 1,
            }}
          />
        </div>
      </div>
    </div>
  )
}
