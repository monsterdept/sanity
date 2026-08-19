import { useEffect, useRef, useState } from 'react'
import { ExportDialog } from './ExportDialog'
import { posOf, realOf } from '../lib/history'

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
export const MAX_FPS = 30


function pace(total: number): string {
  if (total >= 60) return `${Math.round(total / 60)}m`
  return `${total}s`
}

/**
 * The transport: play and scrub. Nothing else.
 *
 * A strip across the bottom of the map rather than something floated in a corner, because
 * unlike the legend it is not an annotation — it is the control the whole view is about,
 * and the scrub bar needs the full width or it cannot address the commits it is drawing.
 *
 * It carried a second row naming the commit under the playhead — hash, subject, ordinal,
 * date, function count. Every one of those is in the log beside it, on the row the
 * playhead is already highlighting, so the strip was a caption for a thing that captions
 * itself. Two places saying one thing is the drift this repo keeps paying for, and the
 * cheaper one to lose is the one you have to look away from the picture to read.
 */
export function HistoryBar({
  frames,
  index,
  onIndex,
  playing,
  onPlaying,
  duration,
  onDuration,
  name,
  slug,
  scope,
  ensure,
  dateOf,
  onStage,
}: {
  /** The commits in scope, as indices into `hist.commits`. Everything the transport
   *  addresses is a position in HERE; the map is still drawn at the real commit, because
   *  a subtree's state is the repo's state restricted to it, not a fold of its own
   *  commits. */
  frames: number[]
  /** The real commit index on screen. */
  index: number
  onIndex: (i: number) => void
  playing: boolean
  onPlaying: (p: boolean) => void
  /** Seconds the whole replay should take. */
  duration: number
  onDuration: (s: number) => void
  /** The repo on screen, for the exported file's name. */
  name: string
  /** The repo as the world knows it — `owner/name` where there is a remote — for an
   *  exported movie's caption. Not the filename: that wants the drilled path. */
  slug: string
  /** The directory the replay is scoped to, or `''` at the top. Named in the caption so a
   *  movie of one subtree does not read as a movie of the repo. */
  scope: string
  /** When a commit landed, for the timeline in an exported movie. */
  dateOf: (real: number) => number | null
  /** Fetch the timeline as far as a given commit — see `ExportDialog`. */
  ensure: (index: number) => Promise<void>
  /** Lay the map out for a file of this many pixels, or null to go back to the pane — see
   *  `App`'s `staged`. */
  onStage: (stage: import('../lib/movie').Staged | null) => void
}) {
  const [exporting, setExporting] = useState(false)
  const last = frames.length - 1
  /** Where the playhead sits in the SCOPED list. */
  const pos = posOf(frames, index)
  // Paced over the commits actually being shown. A drilled-in directory with forty commits
  // in a repo of a thousand should take the same thirty seconds — the button promises a
  // duration for the story on screen, and the story on screen is the narrow one.
  const rate = (last + 1) / duration

  /** The playhead as a REAL number, which the integer `index` is a rounding of.
   *
   *  Kept in a ref because at the slow end a tick advances a fraction of a commit and at
   *  the fast end it advances forty, and both come off one clock. Rounding to the index
   *  every tick would stall at the slow end, where the fraction IS the progress. */
  const cursor = useRef(pos)
  /** The last index this clock emitted, so an index arriving from anywhere else — a
   *  scrub, a click in the log — can be told apart from the clock's own output and reset
   *  the accumulator. Syncing on every change instead threw the fraction away each time
   *  the integer moved, which is a stall dressed up as a slow setting. */
  const emitted = useRef(index)
  if (index !== emitted.current) {
    cursor.current = pos
    emitted.current = index
  }

  /** Play/pause, from wherever it is asked for.
   *
   *  Playing a FINISHED timeline starts it again from the beginning. Without the rewind
   *  the clock is handed a playhead already at the end, stops itself on its first tick,
   *  and the control reads as broken rather than as finished. The button had this and the
   *  space bar did not — two spellings of one verb, and only one of them worked. */
  const toggle = () => {
    if (!playing && pos >= last) onIndex(realOf(frames, -1, index))
    onPlaying(!playing)
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
      cursor.current = Math.min(last, cursor.current + rate * dt)
      const next = Math.floor(cursor.current)
      if (next !== posOf(frames, emitted.current)) {
        const real = realOf(frames, next, emitted.current)
        emitted.current = real
        onIndex(real)
      }
      // The end is a stop, not a wrap. A timeline that loops back to nothing has thrown
      // away the one moment the viewer was watching for.
      if (next >= last) onPlaying(false)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, last, rate, frames, onIndex, onPlaying])

  /** Commits a shifted arrow covers.
   *
   *  Ten, because the thing it is for is crossing a stretch of commits you can see are not
   *  the one you want — a page of the log is about twenty rows, so this is half a screen a
   *  press. Anything larger and it is a scrub, which the bar already does better. */
  const STRIDE = 10

  // Space plays, arrows step. Bare keys rather than modified ones: there is no text field
  // in this mode, and a transport you have to reach for the mouse to nudge is a transport
  // nobody scrubs.
  //
  // Both axes, because the transport and the log are one instrument seen twice: left/right
  // is the bar's own direction, up/down is the log's, and down is FORWARD because the log
  // runs oldest at the top. Shift multiplies either.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      // The export dialog is over the map and drives the playhead itself. A space bar that
      // still started the transport would have two things moving one playhead.
      if (exporting) return
      // The scrub bar is a real range input with its own arrow-key handling. Without this
      // a press while it has focus moves the playhead twice — once natively, once here —
      // which reads as the keyboard being twitchy rather than as two handlers agreeing.
      if (e.target instanceof HTMLInputElement) return

      if (e.key === ' ') {
        e.preventDefault()
        toggle()
        return
      }
      const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0
      if (step === 0) return
      // Arrows scroll a pane by default, and the pane under this one is the log — which
      // would fight the very movement the key just asked for.
      e.preventDefault()
      onPlaying(false)
      const to = Math.max(-1, Math.min(last, pos + step * (e.shiftKey ? STRIDE : 1)))
      onIndex(realOf(frames, to, index))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [playing, index, pos, last, frames, onIndex, onPlaying, exporting])

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
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
          value={pos}
          onChange={(e) => {
            onPlaying(false)
            onIndex(realOf(frames, Number(e.target.value), index))
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

        {/* Beside the lengths rather than beside the play button, because that is what it
            is a variant of: the transport plays the story for a chosen number of seconds
            and this writes the same thing to a file. The button is an icon because the row
            it joins is five two-character labels — a word here would be wider than all of
            them together. */}
        <button
          onClick={() => {
            onPlaying(false)
            setExporting(true)
          }}
          title="Export the replay as a movie"
          aria-label="Export the replay as a movie"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" fill="none" stroke="currentColor">
            <rect x="0.9" y="2.6" width="7" height="6.8" rx="1.2" strokeWidth="1.2" />
            <path d="M8.4 6 L11.1 4.1 v3.8 z" fill="currentColor" stroke="none" />
          </svg>
        </button>
      </div>

      {exporting && (
        <ExportDialog
          frames={frames}
          index={index}
          onIndex={onIndex}
          name={name}
          slug={slug}
          scope={scope}
          duration={duration}
          ensure={ensure}
          dateOf={dateOf}
          onStage={onStage}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  )
}
