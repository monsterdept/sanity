import { useEffect, useMemo, useRef, useState } from 'react'
import { isAnalyzed, readSource, type Node } from '../lib/api'
import { colorFor, type ColorMode, type Views } from '../lib/colorMode'
import { tokenizeAll } from '../lib/tokens'

/** One row's height, in pixels, and it is arithmetic rather than typography.
 *
 *  **The window below is computed from this**, so it cannot be a leading the browser rounds:
 *  a row measuring 17.8px against arithmetic that assumed 18 drifts a line every hundred and
 *  puts the gutter out of step with the code it is numbering. Set on both columns, in pixels,
 *  and nothing in either can wrap — code is `whitespace-pre` and a line number has no spaces.
 */
const ROW = 18

/** Rows kept in the DOM above and below the viewport.
 *
 *  Enough that a flick does not outrun the render, few enough that the layer stays small.
 *  It is also what makes most scroll events cost nothing: they land inside this. */
const OVER = 40

/** The chunk covering each 1-indexed source line, so a line can report its own heat. */
function ownerByLine(file: Node): Map<number, Node> {
  const m = new Map<number, Node>()
  for (const fn of file.children) {
    if (fn.kind !== 'func' || fn.line === null) continue
    // `endLine` is carried from the parse. Falling back to the start alone would paint a
    // single line and leave the rest of the body reading as unmeasured.
    const end = fn.endLine ?? fn.line
    for (let l = fn.line; l <= end; l++) m.set(l, fn)
  }
  return m
}

/**
 * The whole file at a glance: its shape, and where one function gives way to the next.
 *
 * **It is a map of the FILE and carries no reading.** It had the heat on it, and then briefly
 * the current lens — the argument being that a minimap of source alone is a scrollbar with
 * texture. What that actually produced was a column of saturated blocks with the file's shape
 * lost underneath, saying the same thing the gutter says two inches to its left. The reading
 * has a place; this is the other thing a reader needs, which is where they ARE.
 *
 * The code is drawn as one bar per row from its indent to its end — the indentation profile
 * is what the eye uses to recognise a place in a file, and drawing glyphs at this scale costs
 * far more and reads as noise.
 *
 * The code is drawn as one bar per line from its indent to its end — the indentation
 * profile is what the eye actually uses to recognize a place in a file, and drawing
 * glyphs at this scale costs far more and reads as noise.
 */
function Minimap({
  lines,
  owners,
  scroller,
  insetTop,
}: {
  lines: string[]
  owners: Map<number, Node>
  scroller: React.RefObject<HTMLDivElement | null>
  /** Room left at the top for the window controls, which sit over this corner. Passed in
   *  rather than assumed, because the popped-out window has no controls to clear and
   *  would otherwise start its map with a strip of nothing. */
  insetTop: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const box = scroller.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    /** **Redrawn from a scroll LISTENER, with no React in the loop.**
     *
     *  This used to be triggered by a counter bumped in the pane's `onScroll`, with a comment
     *  saying a counter was chosen over the offset because storing the offset "would re-render
     *  the whole table on every scroll frame". A counter re-renders it too — any state change
     *  here does — so the table reconciled 2,690 rows of tokenized spans sixty times a second,
     *  and the pane went blank and filled in behind the scroll. What the comment describes is
     *  exactly what it was doing.
     *
     *  The canvas was already drawn imperatively; the only thing React was contributing was
     *  the re-render. Listening on the element that scrolls removes it, and `passive` says
     *  this will never fight the scroll it is watching. */
    const draw = () => {
    const r = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.round(r.width * dpr))
    canvas.height = Math.max(1, Math.round(r.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, r.width, r.height)
    if (lines.length === 0) return

    const ink = getComputedStyle(canvas).color
    // Fit the WHOLE file, however long. A minimap that scrolls is a second thing to
    // navigate; the point of this one is that the file's shape is one glance.
    const lh = Math.min(3, r.height / lines.length)
    const charW = Math.max(0.35, Math.min(1, (r.width - 6) / 110))

    /** **How many source lines share one drawn row.**
     *
     *  A big IDE has two answers to a big file. VS Code keeps the map and degrades what it
     *  draws — `renderCharacters` off swaps glyphs for colour blocks; JetBrains ships no
     *  minimap by default and gives the gutter an error STRIPE instead, only markers, never
     *  the text. Both are ways of not drawing per-line detail that no longer fits.
     *
     *  **Neither is what a map should do, and this tried both and got both wrong.** Drawing
     *  one bar per line at a third of a pixel is the barcode; dropping the bars and keeping
     *  the bands is a paint chip, which is what a 2,690-line file came out as. The failure is
     *  the same either way: per-line data rendered at sub-pixel scale, once as aliasing and
     *  once as a wall.
     *
     *  So it downsamples rather than degrading. Every drawn row is at least a pixel tall and
     *  says what the lines under it are between them: the span from the shallowest indent to
     *  the longest line, and whether a function starts in there. A short file gets one line
     *  per row and this is exactly what it always did; a long one gets the shape of the file
     *  rather than a photograph of it. */
    const step = Math.max(1, Math.ceil(1 / Math.max(lh, 0.0001)))
    const rowH = lh * step

    for (let i = 0; i < lines.length; i += step) {
      const y = (i / step) * rowH
      const upto = Math.min(i + step, lines.length)

      // The bucket, in one pass: how far the code in it reaches, and whether a function
      // begins there.
      let indent = Infinity
      let extent = 0
      let comment = 0
      let inked = 0
      let starts = false
      for (let j = i; j < upto; j++) {
        const owner = owners.get(j + 1)
        if (owner && owners.get(j) !== owner) starts = true
        const line = lines[j]
        const trimmed = line.trimStart()
        if (!trimmed) continue
        inked++
        const at = line.length - trimmed.length
        indent = Math.min(indent, at)
        extent = Math.max(extent, at + trimmed.length)
        if (/^(\/\/|#|\*|\/\*)/.test(trimmed)) comment++
      }

      if (inked > 0) {
        ctx.fillStyle = ink
        // Comments sit back, so the shape reads as code with prose in it rather than as
        // undifferentiated texture. A mixed row leans whichever way its lines do.
        ctx.globalAlpha = comment > inked / 2 ? 0.14 : 0.34
        const x = 3 + indent * charW
        ctx.fillRect(
          x,
          y + rowH * 0.18,
          Math.max(Math.min(extent * charW, r.width - 6) - indent * charW, 0.6),
          Math.max(rowH * 0.6, 0.6),
        )
        ctx.globalAlpha = 1
      }

      // Where one function gives way to the next, which is the structure a reader navigates
      // by and the one thing that survives being small.
      if (starts) {
        ctx.fillStyle = ink
        ctx.globalAlpha = 0.3
        ctx.fillRect(0, y, r.width, 0.75)
        ctx.globalAlpha = 1
      }
    }

    // What you are looking at now.
    const total = box.scrollHeight || 1
    const top = (box.scrollTop / total) * lines.length * lh
    const hgt = (box.clientHeight / total) * lines.length * lh
    ctx.fillStyle = ink
    ctx.globalAlpha = 0.12
    ctx.fillRect(0, top, r.width, hgt)
    ctx.globalAlpha = 0.35
    ctx.strokeStyle = ink
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, top + 0.5, r.width - 1, Math.max(hgt - 1, 2))
    ctx.globalAlpha = 1
    }

    draw()
    box.addEventListener('scroll', draw, { passive: true })
    return () => box.removeEventListener('scroll', draw)
  }, [lines, owners, scroller, insetTop])

  // Click or drag anywhere on it to go there, centered on the pointer like VS Code's.
  const seek = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = scroller.current
    const canvas = ref.current
    if (!box || !canvas || lines.length === 0) return
    const r = canvas.getBoundingClientRect()
    const lh = Math.min(3, r.height / lines.length)
    const line = (e.clientY - r.top) / lh
    box.scrollTop = (line / lines.length) * box.scrollHeight - box.clientHeight / 2
  }

  return (
    <canvas
      ref={ref}
      aria-hidden
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        seek(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
      style={{ top: insetTop, height: `calc(100% - ${insetTop}px)` }}
      className="absolute right-0 w-[74px] cursor-pointer border-l border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
    />
  )
}

/**
 * A file, as source, with each line's heat in the gutter.
 *
 * Drilling into a file used to draw its functions as concentric rings — a sunburst of
 * one file, where the geometry carried no information the list didn't and the angles
 * meant nothing at all. At the point where you have chosen a single file, the useful
 * view stops being a chart and becomes the code, which is the thing the whole metric is
 * a claim about.
 */
export function CodeView({
  file,
  repo,
  selected,
  reveal,
  mode,
  ranks,
  views,
  onSelect,
  onPopOut,
  onClose,
}: {
  file: Node
  repo: string | null
  selected: Node | null
  /** Scroll to this function once the source is in. The nonce is what makes a repeat of
   *  the same request scroll again instead of looking like no change at all. */
  reveal: { id: string; n: number } | null
  /** The lens the map is wearing, so the gutter beside a body is the colour that body has
   *  on the map. It was Surprise whatever the map said, which is two answers about one
   *  function and one of them unasked for. */
  mode: ColorMode
  ranks?: Map<string, number>
  views?: Views
  onSelect: (n: Node) => void
  /** Rendered in the top-right when present — omitted in a window that IS the code view,
   *  where spawning another of itself is not an action anyone wants. */
  onPopOut?: () => void
  onClose?: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  /** Which rows are in the DOM.
   *
   *  **The one piece of scroll state that is worth a re-render.** Everything else about a
   *  scroll is handled imperatively — the minimap redraws from its own listener — but this
   *  changes what is rendered, and it changes rarely: `OVER` rows of slack above and below
   *  the viewport mean a run of small scrolls costs nothing, and a big one costs a render of
   *  sixty rows rather than three thousand. */
  const [win, setWin] = useState({ from: 0, to: 200 })
  const from = win.from
  const to = win.to

  useEffect(() => {
    let live = true
    setSrc(null)
    setError(null)
    if (!repo) {
      setError('No repo open.')
      return
    }
    readSource(repo, file.path)
      .then((t) => live && setSrc(t))
      .catch((e) => live && setError(String(e)))
    return () => {
      live = false
    }
  }, [repo, file.path])

  const owners = useMemo(() => ownerByLine(file), [file])

  // Read inside the scroll effect without being a dependency of it — see below.
  const fileRef = useRef(file)
  fileRef.current = file

  // Scroll to the requested function, and ONLY when the request itself changes.
  //
  // The dependency list is deliberately two primitives. Listing `file` looked correct
  // and was the bug: the tree is rebuilt every couple of seconds by the agent-report
  // poll, so the node arrives as a new object each time, the effect re-fires, and the
  // view snaps back to the function you drilled into however far you had scrolled away.
  // A dependency on an object identity is a dependency on how often something upstream
  // re-renders.
  //
  // `ready` is in the list because the rows do not exist until the file has been read —
  // firing on the request alone scrolls an empty table and looks like the drill did
  // nothing.
  const revealN = reveal?.n
  const ready = src !== null
  useEffect(() => {
    const box = scroller.current
    if (!box || !ready || revealN === undefined) return
    const fn = fileRef.current.children.find((c) => c.id === reveal?.id)
    if (!fn || fn.line === null) return
    // **Arithmetic, not a query.** It found the row by `data-line` and read its `offsetTop`,
    // which stopped working the moment the view started rendering only what is on screen:
    // the function being revealed is, by definition, usually not one of them. A fixed row
    // height is what makes the position knowable without the element existing — see `ROW`,
    // where that constraint is stated — and the window effect follows the scroll it sets.
    //
    // A third of the way down rather than at the very top: a function opened flush against
    // the edge loses the signature and comment that precede it, which is most of what you
    // came to read.
    box.scrollTop = (fn.line - 1) * ROW - box.clientHeight / 3
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above
  }, [revealN, ready])
  const lines = useMemo(() => (src === null ? [] : src.split('\n')), [src])
  // **Tokenized as a FILE, not a line at a time.** A block comment's body lines are ordinary
  // prose, and a per-line pass reads them as code: `as`, `with` and `in` came out as keywords
  // inside English sentences, in every doc comment in this repo. See `tokenizeAll`. Memoised
  // on the source because it is a pass over the whole file and the view re-renders on scroll.
  const toks = useMemo(() => tokenizeAll(lines), [lines])

  /** Keep the window over the viewport.
   *
   *  Listening on the element rather than through React's `onScroll`, and setting state only
   *  when the range actually moves: a scroll fires dozens of events a second and all but a
   *  few of them land inside the slack.
   *
   *  Re-run when the source changes, because a new file is a new length and the old window
   *  may be past the end of it. */
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const measure = () => {
      const first = Math.floor(box.scrollTop / ROW)
      const rows = Math.ceil(box.clientHeight / ROW)
      const next = {
        from: Math.max(0, first - OVER),
        to: Math.min(lines.length, first + rows + OVER),
      }
      setWin((was) => (was.from === next.from && was.to === next.to ? was : next))
    }
    measure()
    box.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => {
      box.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [lines.length])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="max-w-[40ch] text-center text-sm text-[var(--muted-foreground)]">{error}</p>
      </div>
    )
  }
  if (src === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-[var(--muted-foreground)]">Reading {file.name}…</p>
      </div>
    )
  }

  return (
    /* Absolutely positioned, like the sunburst's canvas and for the same reason: as a
       plain flex child with `h-full`, a table full of `whitespace-pre` lines is wider and
       taller than the pane, and with no definite size to scroll inside it GREW the pane
       instead — the code spilled out over the sidebar and the detail panel. `inset-0`
       makes both axes definite, so the overflow has somewhere to go.

       **Two columns in a flex row, and only the rows you can see.** The whole file was in
       the DOM — six thousand elements and tens of thousands of spans on a 2,690-line file —
       and WebKit rasterises a layer that big asynchronously, so blank ground scrolled in and
       the code filled in behind it. Nothing about the markup fixes that; the fix is to not
       have it. Every editor virtualises for this reason.

       The gutter was also a `position: sticky` cell per row, which is three thousand separate
       compositing decisions, and the numbers arrived in patches. One sticky element does the
       same job.

       **Rows are a fixed height and that is load-bearing.** `ROW` is set in pixels rather
       than inherited from a leading, because the window is computed from it: a row that
       measured 17.8px while the arithmetic assumed 18 would drift a line every hundred and
       put the gutter out of step with the code. Nothing in either column can wrap — code is
       `whitespace-pre` and a line number has no spaces — so a fixed height is honest.

       `w-max min-w-full`: long lines make it wider than the pane so it scrolls sideways,
       while short files still fill the width. */
    <div className="absolute inset-0">
      <div ref={scroller} className="absolute inset-y-0 left-0 right-[74px] overflow-auto">
        <div
          className="flex w-max min-w-full font-mono text-[11.5px]"
          style={{ lineHeight: `${ROW}px` }}
        >
          {/* **The gutter, in whatever lens the map is wearing.** It was hard-wired to
              Surprise, so a reader who had switched the map to Complexity got a code view
              still coloured by something else. `colorFor` is the same function the wedges are
              painted by, so this column and the ring are two views of one answer.

              The digits take `ink`, which `colorFor` returns for exactly this: which of paper
              and ink reads on a fill is a fact about that fill, and a number that disappeared
              on the hot end of a ramp would be the one part of this view with no fallback.

              `--unanalyzed` where the lens has nothing to say about a body, which is not the
              same as no body: bare between functions, grey inside one nobody has measured. */}
          <div className="sticky left-0 z-10 shrink-0 select-none bg-[var(--code)] text-right tabular-nums">
            <div style={{ height: from * ROW }} />
            {lines.slice(from, to).map((_line, k) => {
              const n = from + k + 1
              const owner = owners.get(n)
              const paint = owner ? colorFor(owner, mode, ranks, views) : null
              const isSel = owner != null && selected?.id === owner.id
              return (
                <div
                  key={n}
                  onClick={() => owner && onSelect(owner)}
                  className={`pl-2.5 pr-2 ${owner ? 'cursor-pointer' : ''}`}
                  style={{
                    height: ROW,
                    ...(owner
                      ? paint
                        ? { background: paint.fill, color: paint.ink }
                        : { background: 'var(--unanalyzed)', color: 'var(--foreground)' }
                      : { color: 'var(--muted-foreground)', opacity: 0.5 }),
                    // **The selection is marked here, in the foreground rather than the
                    //  accent.** It was a rule on the row, which scrolled off with everything
                    //  else; and the accent is a hue two lenses paint in, so on Surprise or
                    //  Complexity a plum rule against a plum fill was the mark disappearing
                    //  exactly where the reading was strongest.
                    boxShadow: isSel ? 'inset 3px 0 0 var(--foreground)' : undefined,
                  }}
                >
                  {n}
                </div>
              )
            })}
            <div style={{ height: (lines.length - to) * ROW }} />
          </div>
          {/* **Air after the gutter.** The number column is a solid bar of the lens colour and
              the code used to start against its edge — a saturated block touching the first
              character of every line. The padding is on the code so the colour still runs to
              the gutter's own edge and reads as one continuous strip down the file. */}
          <div className="whitespace-pre pl-3 pr-4">
            <div style={{ height: from * ROW }} />
            {lines.slice(from, to).map((_line, k) => {
              const i = from + k
              const n = i + 1
              const owner = owners.get(n)
              const analyzed = owner ? isAnalyzed(owner) : false
              const isFirst = owner != null && owner.line === n
              return (
                <div
                  key={n}
                  data-line={n}
                  onClick={() => owner && onSelect(owner)}
                  className={owner ? 'cursor-pointer' : undefined}
                  style={{ height: ROW }}
                >
                  {toks[i].map((t, j) => (
                    <span key={j} className={t.cls}>
                      {t.text}
                    </span>
                  ))}
                  {/* Only the unmeasured case still says anything in words. A number on every
                      function was noise once the gutter carries it — but "nobody has looked at
                      this" is not a temperature, and no shade of the ramp can state it. */}
                  {isFirst && !analyzed && (
                    <span className="ml-3 select-none text-[10px] italic text-[var(--muted-foreground)]">
                      not measured
                    </span>
                  )}
                </div>
              )
            })}
            <div style={{ height: (lines.length - to) * ROW }} />
          </div>
        </div>
      </div>
      <Minimap
        lines={lines}
        owners={owners}
        scroller={scroller}
        insetTop={onPopOut || onClose ? 30 : 0}
      />

      {/* Over the minimap's top corner, where there is never code to cover. */}
      {(onPopOut || onClose) && (
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {onPopOut && (
            <button
              onClick={onPopOut}
              title="Open in its own window"
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ⧉
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title="Close"
              className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  )
}
