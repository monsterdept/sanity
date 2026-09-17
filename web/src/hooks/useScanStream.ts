import { useEffect, useMemo, useRef, useState } from 'react'
import { onScanProgress } from '../lib/api'
import { onScanShape, type ShapeFile } from '../lib/shape'

/** How long a wedge stays lit after the scan touched it — see `live`.
 *
 *  One full cycle of `wedge-reading`, which is what draws it. Shorter and a wedge is
 *  yanked off screen mid-pulse, which reads as flicker rather than as a sweep; much longer
 *  and the outer ring is uniformly lit and says nothing about where the work is. */
const LIVE_MS = 1400

/** The repo's shape as the scan discovers it, so a first open draws the map assembling
 *  rather than a bar. See `lib/shape.ts`.
 *
 *  Batched rather than applied per event, and it matters here: a large repo emits a
 *  directory every few milliseconds, and rebuilding the tree per batch is cheap only
 *  because the batches are coarse.
 *
 *  **It belongs to the repo being scanned, not to the pane, and the STREAM says which.**
 *  It used to be cleared the moment ANY tree landed — the scan's own tree is the real one,
 *  and two of them on screen would be two answers to one question, which is true and was
 *  implemented against the wrong subject: clicking another project puts that project's
 *  finished tree in `scan`, so a glance at a second repo threw away the assembling map of
 *  the first, permanently, because the shape only refills from NEW events and the parse
 *  that emits them is long over by the blame phase.
 *
 *  Inferring the owner from the projects list was the next thing tried and was worse — it
 *  looked right and failed on launch, which is the case that matters. There is no "the one
 *  that is loading": a restore publishes EVERY known project as loading up front so the
 *  sidebar fills in at once, so the guess was whichever unfinished project sorted first
 *  and it changed hands each time any of them settled, discarding the map mid-draw. The
 *  key rides on the batch now (`scan::ShapeBatch`) and nothing is inferred.
 */
export function useScanStream() {
  const arriving = useRef<ShapeFile[]>([])
  const [shape, setShape] = useState<ShapeFile[]>([])
  /** Which repo the accumulated shape and the live wedges describe. A ref, because it is
   *  read inside the listeners and must not re-subscribe them when it changes. */
  const streaming = useRef<string | null>(null)
  /** The same value where a memo can see it. The ref is what the listeners read; this is
   *  what decides whether the assembling map belongs to the project on screen. */
  const [streamingKey, setStreamingKey] = useState<string | null>(null)
  /** Node ids the scan has touched, and when — see `live` below, which is fed from it.
   *  Declared up here because the shape listener empties it when the subject changes: the
   *  lit wedges and the map they are lit on have to change repo together. */
  const liveAt = useRef(new Map<string, number>())
  useEffect(() => {
    const un = onScanShape((project, files) => {
      if (streaming.current !== project) {
        // Another repo has started drawing itself. One map at a time: the accumulated one
        // describes a scan that is over or superseded, and merging two would put one repo's
        // directories inside another's.
        streaming.current = project
        setStreamingKey(project)
        arriving.current = []
        setShape([])
        liveAt.current.clear()
      }
      arriving.current.push(...files)
    })
    const timer = setInterval(() => {
      // **Drained BEFORE the updater, never inside it.** It used to read
      // `setShape(prev => [...prev, ...arriving.current.splice(0)])`, which is an updater
      // with a side effect — and React calls updaters TWICE under StrictMode to surface
      // exactly that. The first call drained the buffer and built the right array; the
      // second ran against the same `prev` with the buffer now empty, returned `prev`
      // unchanged, and that is the one React kept. So every flush threw away its own batch:
      // 45,272 files streamed, 24 flushes ran, and `shape` never left zero.
      //
      // It only bites in development, because the double invocation is a dev-only check —
      // which is why the assembling map worked in the installed app and vanished the moment
      // the same code ran under `just dev`, and why it read as a regression in whatever had
      // been touched most recently. The score batcher that used to sit beside it got this
      // right; this one did not.
      const batch = arriving.current
      if (batch.length === 0) return
      arriving.current = []
      setShape((prev) => [...prev, ...batch])
    }, 300)
    return () => {
      un()
      clearInterval(timer)
    }
  }, [])

  /** Where the scan is, right now, as node ids to light up.
   *
   *  **A bar says how much; the map can say where.** Both long phases sweep the repo in a
   *  definite order — parse by directory, blame over the files the parse produced, so both
   *  run alphabetically — and none of that was on screen: the rings stopped moving when the
   *  parse ended and the blame pass ran for hours behind a picture that looked finished.
   *
   *  Drawn through `reading`, the channel a reader's lease already uses, because it is the
   *  same claim — this wedge is being worked on right now — and a second visual language for
   *  it would have to be told apart from the first for no gain. The two never overlap: a repo
   *  is being scanned or it is being read.
   *
   *  **Every ancestor, not just the file.** That is what makes it a tree lighting up rather
   *  than a dot moving: the file wedges twinkle as the sweep passes them while the directory
   *  they sit in stays lit for as long as the scan is inside it, so the picture says both
   *  "here" and "in here" at once.
   *
   *  Fed from the EVENT rather than the polled project row: the poll is 1.5s, which is fine
   *  for a fraction and useless for this — at ~35 files a second it would show one in fifty.
   */
  const [live, setLive] = useState<Set<string>>(new Set())
  useEffect(() => {
    const un = onScanProgress((project, p) => {
      // Only the repo whose map is on screen. Another project's scan running beside this
      // one would light nothing (its paths are not in this tree) and would keep the trail
      // alive after this scan ended, which is worse than lighting nothing.
      if (!p.at || streaming.current !== project) return
      const now = Date.now()
      for (let cut = p.at.length; cut > 0; cut = p.at.lastIndexOf('/', cut - 1)) {
        const id = p.at.slice(0, cut)
        liveAt.current.set(id, now)
        if (id.indexOf('/') === -1) break
      }
    })
    const timer = setInterval(() => {
      const cutoff = Date.now() - LIVE_MS
      const next = new Set<string>()
      for (const [id, at] of liveAt.current) {
        if (at < cutoff) liveAt.current.delete(id)
        else next.add(id)
      }
      // Same object back when the membership has not moved. The map is several thousand
      // arcs and this ticks four times a second — a fresh Set every tick would re-render
      // all of them for the entire life of the window, scan or no scan. The same trap the
      // project poll fell into with `activeProject`.
      setLive((prev) => {
        if (prev.size === next.size) {
          let same = true
          for (const id of next)
            if (!prev.has(id)) {
              same = false
              break
            }
          if (same) return prev
        }
        return next
      })
    }, 250)
    return () => {
      un()
      clearInterval(timer)
    }
  }, [])

  /** Where each directory and file sits while the map assembles, so it does not reshuffle.
   *
   *  **A ring sorted by size cannot be watched while the sizes are still arriving.** The
   *  sunburst orders siblings by lines, which is right for a finished map and wrong for one
   *  being built: every batch of files changes every directory's size, so every wedge
   *  reorders and the map jumps rather than fills.
   *
   *  First seen, first placed. A directory keeps the slot it took when it appeared and new
   *  work lands after it — the picture grows outward instead of rearranging. `sortBy` wants
   *  bigger-is-earlier, so the rank is negated. The finished tree sorts by size as it always
   *  has: one reshuffle, at the moment the real map arrives, instead of one per batch. */
  const shapeOrder = useRef(new Map<string, number>())
  useEffect(() => {
    if (shape.length === 0) shapeOrder.current = new Map()
  }, [shape.length])
  const shapeSort = useMemo(() => {
    const at = shapeOrder.current
    for (const f of shape) {
      // Every ancestor, so directories are ranked by when their first file showed up.
      for (let cut = f.path.length; cut > 0; cut = f.path.lastIndexOf('/', cut - 1)) {
        const id = f.path.slice(0, cut)
        if (!at.has(id)) at.set(id, -at.size)
        if (id.indexOf('/') === -1) break
      }
    }
    return at
  }, [shape])

  return { shape, streamingKey, live, shapeSort }
}
