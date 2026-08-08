import { useEffect, useRef } from 'react'
import type { HistoryScan } from '../lib/history'

/**
 * How long the whole replay takes, in seconds.
 *
 * A DURATION, not a rate. It was a rate — 1× to 8× commits per second — and a rate cannot
 * be right for two repos at once: eight a second finishes this repo in six seconds and
 * tonepoet in two minutes, so the same button meant "a glance" on one project and "go and
 * make coffee" on the next. The reader is never actually choosing commits per second; they
 * are choosing how long they are prepared to watch. So that is what the control sets, and
 * the label says it in the unit it means.
 *
 * The slow end is deliberately slow: on a small repo the point is to watch one commit
 * land. The fast end is a flip-through of any repo at all — at 5,000 commits it is a
 * thousand a second, which is why the clock below steps by however many commits a frame is
 * worth rather than trying to draw them all.
 */
const DURATIONS = [180, 60, 30, 10, 3]

/** Commits per second the renderer will actually attempt.
 *
 *  Above this the transport SKIPS rather than falls behind. A frame of a large repo costs
 *  about ten milliseconds to build before React draws a thousand arcs on top of it, so a
 *  clock demanding a hundred a second would simply run late — the replay would take longer
 *  than the label promised and the promise is the whole control. Skipping keeps the
 *  duration honest, and nothing is lost by it: every frame is computed from the commit
 *  index, so a step of forty is as correct as forty steps of one. */
const MAX_FPS = 30

function pace(total: number): string {
  if (total >= 60) return `${Math.round(total / 60)}m`
  return `${total}s`
}

function stamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * The transport: play, scrub, and what you are looking at.
 *
 * A strip across the bottom of the map rather than something floated in a corner, because
 * unlike the legend it is not an annotation — it is the control the whole view is about,
 * and the scrub bar needs the full width or it cannot address the commits it is drawing.
 *
 * The position is stated three ways on purpose: as the handle, as an ordinal, and as a
 * DATE. The first two say where you are in the replay; only the date says where you are
 * in the project, and commits are not evenly spaced in time — a bar two-thirds along can
 * easily be six weeks from the end or two years.
 */
export function HistoryBar({
  hist,
  index,
  onIndex,
  playing,
  onPlaying,
  duration,
  onDuration,
  functions,
}: {
  hist: HistoryScan
  /** -1 is the opening state, before the first replayed commit lands. */
  index: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  /** Seconds the whole replay should take. */
  duration: number
  onDuration: (s: number) => void
  functions: number
}) {
  const last = hist.commits.length - 1
  const at = hist.commits[Math.max(0, index)]
  const rate = (last + 1) / duration

  /** The playhead as a REAL number, which the integer `index` is a rounding of.
   *
   *  Kept in a ref because at the slow end a tick advances a fraction of a commit and at
   *  the fast end it advances forty, and both come off one clock. Rounding to the index
   *  every tick would stall at the slow end, where the fraction IS the progress. */
  const pos = useRef(index)
  /** The last index this clock emitted, so an index arriving from anywhere else — a
   *  scrub, a click in the log — can be told apart from the clock's own output and reset
   *  the accumulator. Syncing on every change instead threw the fraction away each time
   *  the integer moved, which is a stall dressed up as a slow setting. */
  const emitted = useRef(index)
  if (index !== emitted.current) {
    pos.current = index
    emitted.current = index
  }

  // One clock, driven by elapsed TIME rather than by a fixed step per tick. A timer that
  // steps one commit per interval is only accurate while the interval is longer than a
  // frame takes to draw; past that it silently becomes "as fast as this machine can",
  // which is a different answer on every machine and never the one on the button.
  //
  // Deliberately NOT re-created per commit: an effect that depends on `index` is torn
  // down and rebuilt every frame, and each rebuild re-reads the clock, so every frame's
  // worth of render time falls outside the measurement and the replay quietly overruns
  // the duration it promised.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let then = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = (now - then) / 1000
      if (dt < 1 / MAX_FPS) return
      then = now
      pos.current = Math.min(last, pos.current + rate * dt)
      const next = Math.floor(pos.current)
      if (next !== emitted.current) {
        emitted.current = next
        onIndex(next)
      }
      // The end is a stop, not a wrap. A timeline that loops back to nothing has thrown
      // away the one moment the viewer was watching for.
      if (next >= last) onPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, last, rate, onIndex, onPlaying])

  // Space plays, arrows step. Bare keys rather than modified ones: there is no text field
  // in this mode, and a transport you have to reach for the mouse to nudge is a transport
  // nobody scrubs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === ' ') {
        e.preventDefault()
        onPlaying(!playing)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        onPlaying(false)
        onIndex(Math.min(last, index + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        onPlaying(false)
        onIndex(Math.max(-1, index - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, index, last, onIndex, onPlaying])

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            // Play from a finished timeline starts again from the beginning; anywhere
            // else it carries on. Without this the button at the end does nothing at all,
            // which reads as broken rather than as finished.
            if (index >= last) onIndex(-1)
            onPlaying(!playing)
          }}
          title={playing ? 'Pause (space)' : 'Play (space)'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-foreground)]"
        >
          {playing ? (
            <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor">
              <rect x="1" y="1" width="3" height="8" rx="0.5" />
              <rect x="6" y="1" width="3" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" className="h-3 w-3" fill="currentColor">
              <path d="M2 1 L9 5 L2 9 Z" />
            </svg>
          )}
        </button>

        <input
          type="range"
          min={-1}
          max={last}
          step={1}
          value={index}
          onChange={(e) => {
            onPlaying(false)
            onIndex(Number(e.target.value))
          }}
          className="h-1 min-w-0 flex-1 accent-[var(--accent)]"
          aria-label="commit"
        />

        <div className="flex shrink-0 items-center gap-0.5">
          {DURATIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDuration(d)}
              title={`Play the whole history in about ${pace(d)}`}
              className="mono rounded px-1.5 py-0.5 text-[10px] transition-colors"
              style={{
                background: d === duration ? 'var(--secondary)' : 'transparent',
                color: d === duration ? 'var(--foreground)' : 'var(--muted-foreground)',
              }}
            >
              {pace(d)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px] text-[var(--muted-foreground)]">
        <span className="min-w-0 truncate">
          {index < 0 ? (
            // The opening frame is a state, not a commit, and saying so is the difference
            // between "the repo started here" and "everything before this is off-screen".
            hist.truncated > 0 ? (
              <>
                before this window — {hist.truncated} earlier commits already applied
              </>
            ) : (
              <>before the first commit — an empty repo</>
            )
          ) : (
            <>
              <span className="mono text-[var(--foreground)]">{at.short}</span> {at.subject}
            </>
          )}
        </span>
        <span className="mono shrink-0">
          {index < 0 ? '—' : `${index + 1} / ${hist.commits.length}`}
          {' · '}
          {stamp(index < 0 ? hist.baseTs : at.ts)}
          {' · '}
          {functions} fn
          {/* What the duration button actually buys you from HERE. The button is a
              promise about the whole replay; scrubbed to the middle, the thing you want
              to know is how much is left of it. */}
          {playing && index < last && <> · {pace(Math.max(1, Math.round((last - index) / rate)))} left</>}
        </span>
      </div>
    </div>
  )
}
