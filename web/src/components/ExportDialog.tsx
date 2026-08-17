import { useRef, useState } from 'react'
import { Choice, Field } from './Fields'
import { Overlay } from './Overlay'
import { saveMovie } from '../lib/api'
import { CANCELLED, FPS, record, type Tick } from '../lib/movie'

/**
 * How long the exported movie runs.
 *
 * The transport's own ladder — see `DURATIONS` in `HistoryBar`. Deliberately the same
 * numbers and the same labels: the person exporting has just been watching the replay at
 * one of them, and offering a second set of lengths here would mean deciding what "1m" in
 * this dialog has to do with the "1m" they pressed a moment ago. It opens on whatever the
 * transport is set to, so the default answer is the one they already gave.
 */
const LENGTHS = [180, 60, 30, 10, 3]

/**
 * The frame sizes on offer, as the edge of a square.
 *
 * Square because the map is a circle: a 16:9 file of a sunburst is two black margins
 * totalling nearly half the picture, in every frame, paid for in encode time and file size.
 * The three are a screenshot, something to present from, and something to zoom into —
 * anything finer is a control that changes only the file size, which is not a question this
 * dialog can help anybody answer.
 */
const SIZES = [
  { px: 720, label: '720', note: 'small' },
  { px: 1080, label: '1080', note: 'standard' },
  { px: 2160, label: '2160', note: 'large' },
]

function pace(total: number): string {
  return total >= 60 ? `${Math.round(total / 60)}m` : `${total}s`
}

/** What each stage is called where somebody can read it. The names are the ones the doc
 *  comment on `Tick` uses, so a report of "it sticks on rastering" points at one function. */
const STAGE: Record<Tick['stage'], string> = {
  fetch: 'fetching commits',
  fold: 'rebuilding the map',
  raster: 'rastering the frame',
  encode: 'encoding',
}

function ms(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`
}

/** How much longer, in the coarsest unit that is still true. Rounded up, because a
 *  reassuring estimate that runs out is worse than a pessimistic one. */
function lasting(seconds: number): string {
  if (seconds >= 5400) return `${Math.ceil(seconds / 3600)}h`
  if (seconds >= 90) return `${Math.ceil(seconds / 60)} min`
  return `${Math.ceil(seconds)}s`
}

/** A filename somebody will recognise a week later, out of a repo name that may have
 *  spaces, slashes or nothing in it at all. */
function suggest(name: string): string {
  const stem = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${stem || 'history'}-history.mp4`
}

/**
 * Export the replay as a movie.
 *
 * **It records the map, not the screen.** Each frame is the sunburst as the window is
 * drawing it, copied out and rasterized at the chosen size — so the dimmed backdrop this
 * dialog is sitting on, the log beside the map and the transport under it are all absent
 * from the file, and the picture is the one the replay is about.
 *
 * It is also not a realtime capture: the clock is the output's, so the movie is the length
 * it was asked for whatever the machine managed while making it. See `movie.record`.
 */
export function ExportDialog({
  frames,
  index,
  onIndex,
  name,
  duration,
  ensure,
  onClose,
}: {
  /** The commits in scope, as the transport addresses them. A drilled-in directory exports
   *  its own story, for the same reason its transport plays it. */
  frames: number[]
  /** Where the playhead stands, so it can be put back when the export is done. */
  index: number
  onIndex: (i: number) => void
  /** The repo, for the suggested filename. */
  name: string
  /** What the transport is set to, which is this dialog's opening answer. */
  duration: number
  /** Have the timeline as far as a given commit.
   *
   *  The transport calls this too, but fires it and carries on — a watcher would rather see
   *  a held frame than a stall. A recording awaits it, because a frame drawn against a
   *  timeline that has not arrived is a repeat of the last one, saved into the file as
   *  though it were a commit. See `Recording.ensure` for why it is per frame and not once
   *  up front. */
  ensure: (index: number) => Promise<void>
  onClose: () => void
}) {
  const [seconds, setSeconds] = useState(duration)
  const [size, setSize] = useState(1080)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'saving' | 'done'>('idle')
  const [at, setAt] = useState<Tick | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  /** A ref rather than state: `record` reads it every frame, and a closure over state would
   *  be reading the value the export started with. */
  const stop = useRef(false)
  const busy = phase === 'recording' || phase === 'saving'

  async function go() {
    stop.current = false
    setError('')
    setSaved('')
    setAt(null)
    try {
      setPhase('recording')
      const bytes = await record({
        frames,
        seconds,
        size,
        setIndex: onIndex,
        ensure,
        onProgress: setAt,
        cancelled: () => stop.current,
      })
      setPhase('saving')
      const path = await saveMovie(bytes, suggest(name))
      // A dismissed save dialog is a choice, not a failure — back to the controls with the
      // movie's settings still on them.
      if (!path) {
        setPhase('idle')
        return
      }
      setSaved(path)
      setPhase('done')
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      setPhase('idle')
      if (why !== CANCELLED) setError(why)
    } finally {
      // Where they were before pressing Export. The recording drove the playhead across the
      // whole timeline; leaving it parked at the last commit would be the export having
      // moved the view as a side effect.
      onIndex(index)
    }
  }

  const pct = at && at.total > 0 ? Math.round((at.done / at.total) * 100) : 0

  return (
    <Overlay onClose={busy ? () => {} : onClose}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[15px] font-semibold">Export the replay</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            {frames.length.toLocaleString()} commit{frames.length === 1 ? '' : 's'}, as an MP4
            of the map alone.
          </p>
        </div>

        <Field label="Length">
          <div className="flex flex-wrap gap-2">
            {LENGTHS.map((s) => (
              <Choice
                key={s}
                on={seconds === s}
                disabled={busy}
                onClick={() => setSeconds(s)}
                label={pace(s)}
              />
            ))}
          </div>
        </Field>

        <Field label="Resolution">
          <div className="flex flex-wrap gap-2">
            {SIZES.map((s) => (
              <Choice
                key={s.px}
                on={size === s.px}
                disabled={busy}
                onClick={() => setSize(s.px)}
                label={`${s.label}²`}
                note={s.note}
              />
            ))}
          </div>
          {/* Stated rather than left to be discovered at the end: the frame is square
              because the thing being recorded is a circle. */}
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
            {size} × {size} at {FPS} fps — {Math.round(seconds * FPS).toLocaleString()} frames.
          </p>
        </Field>

        {busy && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${phase === 'saving' ? 100 : pct}%` }}
              />
            </div>
            {/* **What it is doing, not just how far it has got.** A frame counter alone
                cannot tell a machine that is working from one that has stopped: on a repo
                where one frame is four hundred commits of folding, `Frame 7 of 300` sits
                still for long enough to read as a hang. The stage moves while the count
                does not, and the three costs say which part is expensive here — which is
                also the only way to find out whether it is worth attacking. */}
            <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
              {phase === 'saving'
                ? 'Writing the file…'
                : at
                  ? `Frame ${at.done.toLocaleString()} of ${at.total.toLocaleString()} · ${STAGE[at.stage]}${at.left !== null ? ` · ${lasting(at.left)} left` : ''}`
                  : 'Starting…'}
            </p>
            {at && at.done > 0 && (
              <p className="mono mt-1 text-[10px] text-[var(--muted-foreground)]">
                fetch {ms(at.cost.fetch)} · fold {ms(at.cost.fold)} · raster{' '}
                {ms(at.cost.raster)} · encode {ms(at.cost.encode)}
              </p>
            )}
          </div>
        )}

        {saved && (
          <p className="mono break-all text-[11px] text-[var(--muted-foreground)]">{saved}</p>
        )}
        {error && <p className="text-[11px] leading-relaxed text-[var(--destructive)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (busy) stop.current = true
              else onClose()
            }}
            className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
          >
            {busy ? 'Stop' : phase === 'done' ? 'Close' : 'Cancel'}
          </button>
          <button
            disabled={busy || frames.length === 0}
            onClick={() => void go()}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Exporting…' : phase === 'done' ? 'Export again' : 'Export'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
