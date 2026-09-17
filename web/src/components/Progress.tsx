import { useRef } from 'react'
import type { Progress } from '../lib/api'

/**
 * Fraction done, and minutes left once that is worth saying.
 *
 * `pct` is always a number — 0 before there is anything to be a fraction of, which
 * `ProgressTrack` renders as its indeterminate sweep rather than as "0% done". Only `eta`
 * is withheld, and only until enough has moved under this hook's own eye, because an
 * estimate drawn from a three-item sample swings between "a minute" and "an hour" while
 * you watch it.
 *
 * This function used to carry two doc comments — the one above it belonged to the
 * progress UI as a whole and had been stranded here — and the one that was its own
 * promised nulls it does not return. A cold reader predicted `pct: number | null` from
 * that and found `: 0`.
 *
 * The wait is much shorter than it was: the proxy scans a real repo in about a second,
 * where the model pass it used to front could run for tens of minutes. The bar and ETA
 * stay because a large repo still takes long enough to wonder about, and the Stop button
 * is gone with the thing that was worth stopping.
 */
function useProgress(progress: Progress | null) {
  /**
   * **The estimate is drawn from work this hook WATCHED, never from the count it found.**
   * It used to be `elapsed / pct` measured from mount, which quietly asserts two things
   * that are not true. That the rate is constant across the whole job: parsing linux is
   * 45k files in a couple of minutes and blaming them is one `git blame --line-porcelain`
   * apiece against a history that deep, so the parse's rate was still setting the estimate
   * hours into the blame pass. And that mount time is start time: switch away from a scan
   * and back, and `elapsed` is a second against a bar already 20% along, which reports
   * `~<1 min left` on a job with four hours to go. Both produce the same failure, and it
   * is worse than showing nothing — an estimate that confident makes a bar which is
   * genuinely crawling read as a scan that has hung.
   *
   * So the mark holds a position and a time, it is reset when the phase changes, and the
   * rate is what has moved since. A remount then costs a few seconds of no estimate rather
   * than a wrong one, and a phase boundary costs the same.
   */
  const phase = progress?.phase ?? ''
  const mark = useRef({ phase, done: progress?.done ?? 0, at: Date.now() })
  if (mark.current.phase !== phase) {
    mark.current = { phase, done: progress?.done ?? 0, at: Date.now() }
  }

  const pct = progress && progress.total > 0 ? progress.done / progress.total : 0
  const moved = progress ? progress.done - mark.current.done : 0
  const watched = (Date.now() - mark.current.at) / 1000
  // Enough of a sample for the estimate not to swing wildly. Both conditions, because
  // either alone is satisfiable by a burst: a thousand cached files can land in the first
  // second, and five seconds can pass with nothing moving at all.
  const eta =
    progress && moved > 20 && watched > 5
      ? Math.round(((progress.total - progress.done) * (watched / moved)) / 60)
      : null
  return { pct, eta }
}

/** The bar itself, shared so the strip and the first-open pane are one instrument rather
 *  than two that drift. Indeterminate until there is a total to be a fraction of — see
 *  `track-sweep` in index.css for why that is not just decoration. */
function ProgressTrack({ progress, pct }: { progress: Progress | null; pct: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
      {progress ? (
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      ) : (
        <div className="track-sweep h-full rounded-full bg-[var(--accent)]" />
      )}
    </div>
  )
}

/**
 * What a running job is doing, in the job's own words.
 *
 * **Every noun here comes off the wire.** This line was the literal `Scoring N / M
 * functions`, written when the only counted phase was the model pass — which the app has
 * not run since `OllamaModel` was removed. The two phases that do run count FILES, so a
 * scan of linux announced `111029 functions` over a file count while the sidebar, holding
 * its own literal and the right one, said `111k files` an inch away. A window cannot know
 * the unit; the phase that is counting does.
 *
 * Separators because these numbers are six digits on a real repo, and `67511 / 111029` is
 * two figures nobody can read at a glance and therefore cannot tell apart when one moves.
 */
function phaseLine(p: Progress): string {
  const what = p.phase ? p.phase[0].toUpperCase() + p.phase.slice(1) : 'Working'
  if (p.total === 0) return `${what}…`
  const unit = p.unit ? ` ${p.unit}` : ''
  return `${what} ${p.done.toLocaleString()} / ${p.total.toLocaleString()}${unit}`
}

/**
 * The same wait, in one line, over a map that is already worth looking at.
 *
 * **A picture of the repo is not a report on the scan.** The assembling map replaced the
 * bar, on the reasonable argument that a repo drawing itself says more than a fraction
 * does — and it does, right up until the parse finishes. Then the rings stop moving, the
 * blame pass runs for hours behind a map that looks complete, and the only thing on screen
 * saying otherwise is a word in the sidebar. The two answer different questions and both
 * are wanted at once: what is in this repo, and how far along is the thing reading it.
 *
 * Boxed like the caveat chip in the corner of the graph, for the same reason it is: it is
 * about the picture rather than part of it.
 */
export function ProgressStrip({ progress }: { progress: Progress }) {
  const { pct, eta } = useProgress(progress)
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
      <span>{phaseLine(progress)}</span>
      <div className="w-24">
        <ProgressTrack progress={progress} pct={pct} />
      </div>
      {eta !== null && <span className="mono">~{eta === 0 ? '<1' : eta} min left</span>}
    </div>
  )
}

/** The same wait, on an empty pane rather than over a map you can already read. Centered
 *  and wider because there is nothing else on the screen to be beside. */
export function ProgressPane({ progress, label }: { progress: Progress | null; label?: string }) {
  const { pct, eta } = useProgress(progress)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <p className="text-sm text-[var(--muted-foreground)]">
        {progress ? phaseLine(progress) : (label ?? 'Walking the repo…')}
      </p>
      <div className="w-[min(320px,60%)]">
        <ProgressTrack progress={progress} pct={pct} />
      </div>
      {eta !== null && (
        <p className="mono text-[11px] text-[var(--muted-foreground)]">
          ~{eta === 0 ? '<1' : eta} min left
        </p>
      )}
    </div>
  )
}
