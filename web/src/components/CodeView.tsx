import { useEffect, useMemo, useRef, useState } from 'react'
import { isAnalyzed, readSource, type Node } from '../lib/api'
import { colorFor, type ColorMode, type Views } from '../lib/colorMode'
import { tokenizeAll } from '../lib/tokens'

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
  scrollTick,
  insetTop,
}: {
  lines: string[]
  owners: Map<number, Node>
  scroller: React.RefObject<HTMLDivElement | null>
  /** Bumped on every scroll, purely to force a repaint. */
  scrollTick: number
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
  }, [lines, owners, scroller, scrollTick, insetTop])

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
  // A counter rather than the scroll offset itself: the minimap only needs to know that
  // something moved, and storing the offset would re-render the whole table on every
  // scroll frame to repaint a strip 74px wide.
  const [scrollTick, setScrollTick] = useState(0)

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
    const row = box.querySelector<HTMLElement>(`[data-line="${fn.line}"]`)
    if (!row) return
    // A third of the way down rather than at the very top: a function opened flush
    // against the edge loses the signature and comment that precede it, which is most of
    // what you came to read.
    box.scrollTop = row.offsetTop - box.clientHeight / 3
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above
  }, [revealN, ready])
  const lines = useMemo(() => (src === null ? [] : src.split('\n')), [src])
  // **Tokenized as a FILE, not a line at a time.** A block comment's body lines are ordinary
  // prose, and a per-line pass reads them as code: `as`, `with` and `in` came out as keywords
  // inside English sentences, in every doc comment in this repo. See `tokenizeAll`. Memoised
  // on the source because it is a pass over the whole file and the view re-renders on scroll.
  const toks = useMemo(() => tokenizeAll(lines), [lines])

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

       `w-max min-w-full` on the table, not `w-full`: long lines have to be able to make
       it wider than the pane so it scrolls sideways, while short files still fill the
       width so row hovers span the pane. */
    <div className="absolute inset-0">
      <div
        ref={scroller}
        onScroll={() => setScrollTick((n) => n + 1)}
        className="absolute inset-y-0 left-0 right-[74px] overflow-auto"
      >
        <table className="w-max min-w-full border-collapse font-mono text-[11.5px] leading-[1.55]">
          <tbody>
            {lines.map((_line, i) => {
              const n = i + 1
              const owner = owners.get(n)
              const analyzed = owner ? isAnalyzed(owner) : false
              const paint = owner ? colorFor(owner, mode, ranks, views) : null
              const isSel = owner != null && selected?.id === owner.id
              const isFirst = owner != null && owner.line === n
              return (
                <tr
                  key={n}
                  data-line={n}
                  onClick={() => owner && onSelect(owner)}
                  className={owner ? 'cursor-pointer' : undefined}
                  // **No wash behind the code. The reading lives in the gutter.**
                  //
                  // Every measured function used to carry a tinted background — the argument
                  // was that background and text are different channels, so a wash does not
                  // fight the syntax the way tinting the code would. It does something worse:
                  // it paints two thirds of the file in one lens's colour, so a file reads as
                  // a stack of coloured blocks and the code inside them is what you have to
                  // look past. A code view is for reading code.
                  //
                  // The LINE NUMBERS carry it instead. They are a column that is already
                  // there, already ignorable, and already the thing you scan down when you
                  // are looking for a place — and nothing is written over them, so a colour
                  // there costs no legibility at all. A separate three-pixel strip beside
                  // them was tried in between and reads as an outline drawn around the code
                  // rather than as a property of it.
                  //
                  // The SELECTION gets the only mark on the row, which is what a selection
                  // should be: it was competing with a wash before, and lost.

                >
                  {/* **The line numbers are the gutter, and they wear the lens the map is
                    wearing.** It was hard-wired to Surprise, so a reader who had switched the
                    map to Complexity got a code view still coloured by something else — two
                    answers about one function, one of them unasked for. `colorFor` is the
                    same function the wedges are painted by, so this column and the minimap
                    and the ring are three views of one answer.

                    The digits take `ink`, which `colorFor` returns for exactly this: which of
                    paper and ink reads on a fill is a fact about that fill, and a number that
                    disappeared on the hot end of a ramp would be the one part of this view
                    with no fallback.

                    `--unanalyzed` where this lens has nothing to say about a body, which is
                    not the same as no body: the column is bare between functions and grey
                    inside one nobody has measured. */}
                  <td
                    // **Stuck to the left edge, because a gutter that scrolls away is not a
                    //  gutter.** The pane scrolls horizontally — code is `whitespace-pre` and
                    //  a long line is wider than the pane — and the numbers went with it, so
                    //  the one column that says where you are was the first thing off screen.
                    //
                    //  Sticky needs an OPAQUE ground of its own or the code slides underneath
                    //  it: between functions there is no lens colour to use, so it takes the
                    //  view's own background there. That is also why the padding sits on the
                    //  code cell rather than here — this cell has to be filled edge to edge.
                    className="sticky left-0 z-10 select-none pl-2.5 pr-2 text-right align-top tabular-nums"
                    style={{
                      ...(owner
                        ? paint
                          ? { background: paint.fill, color: paint.ink }
                          : { background: 'var(--unanalyzed)', color: 'var(--foreground)' }
                        : {
                            background: 'var(--code)',
                            color: 'var(--muted-foreground)',
                            opacity: 0.5,
                          }),
                      // **The selection is marked HERE, and in the foreground rather than the
                      //  accent.** It was a rule on the row, which scrolled off with
                      //  everything else; and the accent is a hue two of the lenses paint in,
                      //  so on Surprise or Complexity a plum rule against a plum fill was the
                      //  mark disappearing exactly where the reading was strongest. Ink reads
                      //  on every fill this column can take.
                      boxShadow: isSel ? 'inset 3px 0 0 var(--foreground)' : undefined,
                    }}
                  >
                    {n}
                  </td>
                  {/* **Air after the gutter.** The number column is a solid bar of the lens
                      colour now, and the code used to start against its edge — a saturated
                      block touching the first character of every line, with nothing between
                      them to say they are different things. The padding is on the code rather
                      than on the gutter so the colour still runs to the column's own edge and
                      reads as one continuous strip down the file. */}
                  <td className="w-full whitespace-pre pl-3 pr-4 align-top">
                    {toks[i].map((t, j) => (
                      <span key={j} className={t.cls}>
                        {t.text}
                      </span>
                    ))}
                    {/* Only the unmeasured case still says anything in words. A number on
                      every function was noise once the wash carries it — but "nobody has
                      looked at this" is not a temperature, and no shade of the ramp can
                      state it. */}
                    {isFirst && !analyzed && (
                      <span className="ml-3 select-none text-[10px] italic text-[var(--muted-foreground)]">
                        not measured
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Minimap
        lines={lines}
        owners={owners}
        scroller={scroller}
        scrollTick={scrollTick}
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
