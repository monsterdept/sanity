import { useRef, useState } from 'react'
import { Choice, Field } from './Fields'
import { Overlay } from './Overlay'
import { saveMovie } from '../lib/api'
import { CANCELLED, CODEC_NAME, FPS, mapSide, record, type Codec, type Tick } from '../lib/movie'
import type { Staged } from '../lib/movie'

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
 * The frame sizes on offer, by the height of a 16:9 frame.
 *
 * **The ladder every player and every timeline already speaks.** It was the edge of a
 * square, on the argument that a 16:9 picture of a circle is two empty margins — true, and
 * beside the point once the file became something to post: the margins hold the repo's name
 * and where the movie came from, and 1080p is what a person means when they say what size
 * they want. The four are a thumbnail, a post, something to present from and something to
 * zoom into; anything finer is a control that changes only the file size, which is not a
 * question this dialog can help anybody answer.
 */
const SIZES = [
  { h: 720, note: 'small' },
  { h: 1080, note: 'standard' },
  { h: 1440, note: 'large' },
  { h: 2160, note: 'huge' },
]

/** The frame, from the height that names it. Rounded to an even width, because encoders
 *  subsample chroma in pairs and an odd dimension is a configuration some of them refuse. */
function frameOf(h: number): { width: number; height: number } {
  return { width: Math.round((h * 16) / 9 / 2) * 2, height: h }
}

function pace(total: number): string {
  return total >= 60 ? `${Math.round(total / 60)}m` : `${total}s`
}

/** What each stage is called where somebody can read it. The names are the ones the doc
 *  comment on `Tick` uses, so a report of "it sticks on rastering" points at one function. */
const STAGE: Record<Tick['stage'], string> = {
  fetch: 'fetching commits',
  fold: 'rebuilding the map',
  raster: 'rastering the frame',
  draw: 'drawing the frame',
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
 * The grounds a movie can be written on.
 *
 * The app's own two, and the choice exists for the same reason the app has a menu item for
 * it: a recording is going into a slide, a README or a post, and which ground that wants has
 * nothing to do with which one the person making it happens to be sitting in.
 *
 * There is no `system` here. On screen that means "follow the machine", which is a live
 * relationship; a file cannot follow anything, so offering it would be offering a coin flip
 * decided by whoever renders — the window is asked what it is showing and that answer is
 * made explicit on the way in.
 */
const GROUNDS = [
  { id: 'light' as const, label: 'Light' },
  { id: 'dark' as const, label: 'Dark' },
]

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
  slug,
  scope,
  duration,
  ensure,
  dateOf,
  onStage,
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
  /** The repo as the world knows it, for the caption — see `HistoryBar`. */
  slug: string
  /** The directory the replay is scoped to, or `''`. */
  scope: string
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
  /** When a commit landed, for the timeline under the caption. Null before the window. */
  dateOf: (real: number) => number | null
  /** Dress the map for the file being written — its size and its ground — or null to give
   *  the pane back. See `Staged`. */
  onStage: (stage: Staged | null) => void
  onClose: () => void
}) {
  const [seconds, setSeconds] = useState(duration)
  /** The frame's HEIGHT — see `SIZES`. The width follows from it. */
  const [size, setSize] = useState(1080)
  /** Opens on what the window is showing — a recording of the map you are looking at is the
   *  answer that needs no thought, and the other one is one click away. */
  const [ground, setGround] = useState<'light' | 'dark'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  )
  const [phase, setPhase] = useState<'idle' | 'recording' | 'saving' | 'done'>('idle')
  const [at, setAt] = useState<Tick | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  /** What the preflight settled on, once it has — see `CODECS` in `movie.ts`. Null until
   *  then, and stated only when it is not the one everybody expects. */
  const [codec, setCodec] = useState<Codec | null>(null)
  /** A ref rather than state: `record` reads it every frame, and a closure over state would
   *  be reading the value the export started with. */
  const stop = useRef(false)
  const busy = phase === 'recording' || phase === 'saving'

  async function go() {
    stop.current = false
    setError('')
    setSaved('')
    setCodec(null)
    setAt(null)
    try {
      setPhase('recording')
      // **Staged before a single frame is read, and the map is left to settle.**
      // `record` resolves the custom properties and the background once, on its way in, so
      // the ground has to be on the map by then or the file comes out in the other one with
      // the right wedges. Two animation frames is the same wait every frame of the recording
      // makes for the same reason — see `settle` there.
      //
      // **On the map, not on the window.** This used to flip the whole app to the chosen
      // ground for the length of the export — sidebar, dialogs and menus included, in front
      // of somebody who had only asked for a file. The map paints in `var(--…)` throughout,
      // so a class on the pane is enough; see the `.light` selector in `index.css`.
      //
      // The px is the map's own side inside the frame, not the frame's — every threshold
      // that decides whether a wedge is worth drawing is a pixel size, and the pixels the
      // map gets are the square part of a 16:9 picture with a margin round it.
      onStage({ px: mapSide(size), ground })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const bytes = await record({
        frames,
        seconds,
        ...frameOf(size),
        title: slug,
        scope,
        setIndex: onIndex,
        ensure,
        dateOf,
        onProgress: setAt,
        onCodec: setCodec,
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
      // The pane goes back to being a pane: its own ground, its own density, and the commit
      // it was on. The recording drove the playhead across the whole timeline, and leaving
      // any of that behind would be the export having rearranged the view as a side effect.
      // Dropping the staged ground is all it takes to restore the window's own — including
      // `system`, which is a live relationship the export never touched and so cannot have
      // flattened.
      onStage(null)
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
            {frames.length.toLocaleString()} commit{frames.length === 1 ? '' : 's'}, as a
            16:9 MP4 of the map, captioned <span className="mono">{slug}</span>.
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
                key={s.h}
                on={size === s.h}
                disabled={busy}
                onClick={() => setSize(s.h)}
                label={`${s.h}p`}
                note={s.note}
              />
            ))}
          </div>
          {/* Stated rather than left to be discovered at the end: the frame is 16:9 with
              the map in the square part of it, and that square is the LAYOUT as well as the
              file — see `Sunburst`'s `density`. */}
          <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
            {frameOf(size).width} × {size} at {FPS} fps —{' '}
            {Math.round(seconds * FPS).toLocaleString()} frames, with the map laid out for{' '}
            {mapSide(size).toLocaleString()}px.
          </p>
        </Field>

        <Field label="Ground">
          <div className="flex flex-wrap gap-2">
            {GROUNDS.map((g) => (
              <Choice
                key={g.id}
                on={ground === g.id}
                disabled={busy}
                onClick={() => setGround(g.id)}
                label={g.label}
              />
            ))}
          </div>
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
                {ms(at.cost.raster)} · draw {ms(at.cost.draw)} · encode {ms(at.cost.encode)}
              </p>
            )}
          </div>
        )}

        {/* Only when it is NOT H.264, because the interesting case is the one that changes
            where the file plays. H.264 is what an `.mp4` is assumed to be, and saying so
            every time is a sentence nobody reads teaching nobody anything. */}
        {codec && codec !== 'avc' && (
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            Encoded as {CODEC_NAME[codec]} — H.264 does not reach {frameOf(size).width} ×{' '}
            {size} on this machine. Plays in QuickTime, Safari and the editors; not everywhere H.264 does.
          </p>
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
