import { useEffect, useMemo, useRef, useState } from 'react'
import { isAnalyzed, readSource, type Node } from '../lib/api'
import { colorFor, type ColorMode, type Views } from '../lib/colorMode'
import { tokenizeAll, type Tok } from '../lib/tokens'
import { CELL_H, CELL_W, cellOf, glyphSheet } from '../lib/glyphs'
import { monoAdvance } from '../lib/label'

/** One row's height, in pixels, and it is arithmetic rather than typography.
 *
 *  **The window below is computed from this**, so it cannot be a leading the browser rounds:
 *  a row measuring 17.8px against arithmetic that assumed 18 drifts a line every hundred and
 *  puts the gutter out of step with the code it is numbering. Set on both columns, in pixels,
 *  and nothing in either can wrap — code is `whitespace-pre` and a line number has no spaces.
 */
const ROW = 18

/** The size the code is set at. Named because three things agree with it: the rows, the
 *  gutter's width and the minimap's. */
const CODE_PX = 11.5

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
  toks,
  owners,
  scroller,
  width,
  insetTop,
}: {
  lines: string[]
  /** The same tokens the code is drawn from, so the map is coloured by what the file IS
   *  rather than by a second guess at it. */
  toks: Tok[][]
  owners: Map<number, Node>
  scroller: React.RefObject<HTMLDivElement | null>
  /** How wide the map is, in CSS pixels — see `mapWidth`, which is where the number comes
   *  from and why it is not a constant. */
  width: number
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
    const sheet = glyphSheet()

    /** **Redrawn from a scroll LISTENER, with no React in the loop.**
     *
     *  This used to be triggered by a counter bumped in the pane's `onScroll`, with a comment
     *  saying a counter was chosen over the offset because storing the offset "would re-render
     *  the whole table on every scroll frame". A counter re-renders it too — any state change
     *  here does. The canvas was always drawn imperatively; React's only contribution to that
     *  loop was the re-render. */
    const draw = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(r.width * dpr))
      canvas.height = Math.max(1, Math.round(r.height * dpr))
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (lines.length === 0 || !sheet) return

      // **Device pixels throughout, because a glyph cell IS a pixel count.** Drawing this in
      // CSS units and letting the transform scale it puts a two-pixel character on a
      // fractional grid, which is the difference between text and mush.
      const W = canvas.width
      const H = canvas.height
      const rowH = CELL_H
      const cols = Math.floor(W / CELL_W)
      /** How many lines the map can hold at one row apiece. */
      const fits = Math.floor(H / rowH)

      /** **Where the map starts, which is not always line one.**
       *
       *  A file longer than the map used to be squashed to a third of a pixel a line, which
       *  is where the aliasing came from: at that size a row is not a row, it is whatever
       *  rounding does to one. VS Code's `MinimapLayout` asks whether the file fits and, when
       *  it does not, slides the map instead — `startLineNumber` derived from where the slider
       *  sits. Same here: every line that is drawn gets a whole row, and the map scrolls to
       *  keep the viewport in it.
       */
      const rows = Math.min(lines.length, fits)
      const slack = Math.max(0, lines.length - rows)
      const through = Math.max(1, box.scrollHeight - box.clientHeight)
      const at = Math.min(1, Math.max(0, box.scrollTop / through))
      const first = Math.round(slack * at)

      const ink = getComputedStyle(canvas).color
      /** A token's colour, resolved once per class. `colorFor` and the token classes answer in
       *  the cascade's vocabulary and a canvas resolves none of it, so one hidden element
       *  takes the string and the browser hands back what it computed to. */
      const probe = document.createElement('span')
      probe.style.display = 'none'
      canvas.parentElement?.appendChild(probe)
      const seen = new Map<string, [number, number, number]>()
      const rgb = (cls: string): [number, number, number] => {
        const hit = seen.get(cls)
        if (hit) return hit
        probe.className = cls
        const m = /(\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(probe).color)
        const out: [number, number, number] = m
          ? [Number(m[1]), Number(m[2]), Number(m[3])]
          : [128, 128, 128]
        seen.set(cls, out)
        return out
      }

      const img = ctx.createImageData(W, H)
      const data = img.data
      for (let row = 0; row < rows; row++) {
        const i = first + row
        const y0 = row * rowH
        let col = 0
        for (const t of toks[i] ?? []) {
          if (col >= cols) break
          const [cr, cg, cb] = t.cls === 'tok-plain' ? [0, 0, 0] : rgb(t.cls)
          const plain = t.cls === 'tok-plain'
          for (let k = 0; k < t.text.length && col < cols; k++, col++) {
            const cell = cellOf(t.text.charCodeAt(k))
            if (cell < 0) continue
            const x0 = col * CELL_W
            // **Per-pixel alpha from the sheet, the way `minimapCharRenderer` does it.** The
            // glyph's coverage is the alpha and the token's colour is the tint; a solid block
            // per character would be the `renderCharacters: false` mode, which is the one that
            // looks like ours did.
            for (let y = 0; y < CELL_H; y++) {
              for (let x = 0; x < CELL_W; x++) {
                const c = sheet[(cell * CELL_H + y) * CELL_W + x] / 255
                if (c <= 0) continue
                const o = ((y0 + y) * W + x0 + x) * 4
                const a = Math.round(c * 255)
                if (a <= data[o + 3]) continue
                if (plain) {
                  // The chrome's own ink, which is a `var()` and not worth resolving per
                  // token: plain identifiers are most of a file and they are the ground the
                  // coloured ones stand out from.
                  data[o] = 128
                  data[o + 1] = 128
                  data[o + 2] = 128
                } else {
                  data[o] = cr
                  data[o + 1] = cg
                  data[o + 2] = cb
                }
                data[o + 3] = a
              }
            }
          }
        }
      }
      probe.remove()
      ctx.putImageData(img, 0, 0)

      // Where one function gives way to the next, which is the structure a reader navigates
      // by. Drawn over the glyphs rather than under them: it is a rule, not a background.
      ctx.fillStyle = ink
      for (let row = 0; row < rows; row++) {
        const n = first + row + 1
        const owner = owners.get(n)
        if (owner && owners.get(n - 1) !== owner) {
          ctx.globalAlpha = 0.22
          ctx.fillRect(0, row * rowH, W, Math.max(1, dpr * 0.5))
        }
      }
      ctx.globalAlpha = 1

      // **The slider.** Its height is the share of the file on screen and its top is where
      // that share sits, both measured against the ROWS drawn rather than against the file —
      // on a long file the map is a window onto the file and the slider is a window onto the
      // map.
      const shown = Math.min(1, box.clientHeight / Math.max(1, box.scrollHeight))
      const top = (box.scrollTop / Math.max(1, box.scrollHeight)) * lines.length
      const y = (top - first) * rowH
      const h = Math.max(dpr * 4, shown * lines.length * rowH)
      ctx.fillStyle = ink
      ctx.globalAlpha = 0.1
      ctx.fillRect(0, y, W, h)
      ctx.globalAlpha = 0.3
      ctx.lineWidth = dpr
      ctx.strokeStyle = ink
      ctx.strokeRect(dpr / 2, y + dpr / 2, W - dpr, Math.max(h - dpr, 2))
      ctx.globalAlpha = 1
    }

    draw()
    box.addEventListener('scroll', draw, { passive: true })
    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => {
      box.removeEventListener('scroll', draw)
      ro.disconnect()
    }
  }, [lines, toks, owners, scroller, width, insetTop])

  /** **A click jumps and a drag tracks, and they are different gestures.**
   *
   *  It did both by teleporting: whatever line was under the pointer became the middle of the
   *  viewport. On a long file that means one pixel of cursor is `scrollHeight / mapHeight`
   *  pixels of scroll, so the code runs away from the hand holding it — which is exactly what
   *  it felt like.
   *
   *  VS Code moves the SLIDER one-for-one with the pointer and derives the scroll from that:
   *  `computedSliderRatio = maxSliderTop / (scrollHeight - viewportHeight)`, and a drag is
   *  `scrollTop + delta / ratio`. The slider stays under the finger; the file moves as much as
   *  it has to. A press with no movement still jumps, because that is what a press on a map
   *  means. */
  const drag = useRef<{ y: number; top: number } | null>(null)

  const ratio = () => {
    const box = scroller.current
    const canvas = ref.current
    if (!box || !canvas || lines.length === 0) return null
    const r = canvas.getBoundingClientRect()
    const rowH = CELL_H / (window.devicePixelRatio || 1)
    const rows = Math.min(lines.length, Math.floor(r.height / rowH))
    const shown = Math.min(1, box.clientHeight / Math.max(1, box.scrollHeight))
    const slider = Math.max(4, shown * lines.length * rowH)
    const travel = Math.max(1, rows * rowH - slider)
    return travel / Math.max(1, box.scrollHeight - box.clientHeight)
  }

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = scroller.current
    const canvas = ref.current
    if (!box || !canvas || lines.length === 0) return
    canvas.setPointerCapture(e.pointerId)
    const r = canvas.getBoundingClientRect()
    const rowH = CELL_H / (window.devicePixelRatio || 1)
    const rows = Math.min(lines.length, Math.floor(r.height / rowH))
    const slack = Math.max(0, lines.length - rows)
    const through = Math.max(1, box.scrollHeight - box.clientHeight)
    const first = Math.round(slack * (box.scrollTop / through))
    const line = first + (e.clientY - r.top) / rowH
    box.scrollTop = (line / lines.length) * box.scrollHeight - box.clientHeight / 2
    drag.current = { y: e.clientY, top: box.scrollTop }
  }

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = scroller.current
    const held = drag.current
    if (!box || !held) return
    const k = ratio()
    if (k === null) return
    box.scrollTop = held.top + (e.clientY - held.y) / k
  }

  const up = () => {
    drag.current = null
  }

  return (
    <canvas
      ref={ref}
      style={{ top: insetTop, height: `calc(100% - ${insetTop}px)`, width }}
      className="absolute right-0 cursor-pointer border-l border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
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
    // **As near the top as its own doc allows, and not a third of the way down.** The third
    // was defending something real — a body opened flush against the edge loses the comment
    // that explains it, which is most of what you came to read — but it spent the room whether
    // there was a comment or not, so the usual result was fifteen lines of the PREVIOUS
    // function's closing braces above the one you asked for.
    //
    // The node knows how long its own doc is, so the lead can be exactly that: the comment and
    // the signature, and nothing else. Capped at half the pane, because a doc longer than that
    // would put the signature back where it started — past the cap you get the tail of the
    // doc, which is the half nearest the code anyway. Two rows where there is no doc, which is
    // margin rather than lead.
    // **Counted off the SOURCE, not off `Node::doc`.** The stored doc is the comment's text
    // and not its delimiters, so measuring the lead from its line count left the `/**` and
    // the first sentence above the fold — the two lines that say what the thing is. The
    // tokenizer already knows which lines are comment, so walking up from the signature until
    // one is not gives the block's real top, whatever a language writes it with.
    let top = fn.line - 1
    const isComment = (i: number) =>
      i >= 0 && toks[i]?.length > 0 && toks[i].every((t) => t.cls === 'tok-comment')
    while (top > 0 && isComment(top - 1)) top--
    // One line above the comment, so the block has a margin rather than starting flush.
    // Capped at half the pane: a doc longer than that would put the signature back where it
    // started, and past the cap the tail is the half nearest the code anyway.
    const lead = Math.min(fn.line - top + 1, Math.floor(box.clientHeight / ROW / 2))
    box.scrollTop = Math.max(0, (fn.line - lead) * ROW)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see the note above
  }, [revealN, ready])
  const lines = useMemo(() => (src === null ? [] : src.split('\n')), [src])
  // **Tokenized as a FILE, not a line at a time.** A block comment's body lines are ordinary
  // prose, and a per-line pass reads them as code: `as`, `with` and `in` came out as keywords
  // inside English sentences, in every doc comment in this repo. See `tokenizeAll`. Memoised
  // on the source because it is a pass over the whole file and the view re-renders on scroll.
  const toks = useMemo(() => tokenizeAll(lines), [lines])

  /** How wide the minimap has to be to hold a line that fits the code pane.
   *
   *  **The map should say what the viewer says, at a character apiece.** It was a constant
   *  74px, which is 74 columns at two device pixels a glyph however wide the pane is — so on
   *  a wide window a line that fitted the code ran off the end of its own map, and the shape
   *  the map exists to show was cut. VS Code sizes its minimap from `minimap.maxColumn` for
   *  the same reason: the map is a picture of the text, and a picture that crops is a picture
   *  of something else.
   *
   *  Bounded at both ends. Under about fifty columns the map stops being recognisable and
   *  becomes a texture; past a fifth of the pane it stops being a margin and becomes a second
   *  document. Between those it follows the code.
   */
  const [mapW, setMapW] = useState(74)
  useEffect(() => {
    const box = scroller.current
    if (!box) return
    const measure = () => {
      const dpr = window.devicePixelRatio || 1
      // The code's own advance, from the same measurement the rim's labels are laid out with
      // — a constant here would be right on whichever machine it was written on.
      const charW = CODE_PX * monoAdvance()
      const gutter = String(Math.max(lines.length, 1)).length * charW + 18
      const cols = Math.max(1, (box.clientWidth - gutter) / charW)
      const want = Math.round((cols * CELL_W) / dpr)
      setMapW(Math.max(56, Math.min(want, Math.round(box.parentElement!.clientWidth * 0.2))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    return () => ro.disconnect()
  }, [lines.length])

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
      <div
        ref={scroller}
        className="absolute inset-y-0 left-0 overflow-auto"
        style={{ right: mapW }}
      >
        <div
          className="flex w-max min-w-full font-mono"
          style={{ fontSize: CODE_PX, lineHeight: `${ROW}px` }}
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
          {/* **Sized for the whole file, not for the rows on screen.** The width came from the
              widest number rendered, and only the visible rows are rendered — so scrolling
              from line 80 to line 120 grew the gutter a digit and shunted the code sideways
              under the reader. The file's line count is known before anything is drawn, and
              `ch` on a monospace column is exactly a digit, so the column can be the width it
              will need and stay there. */}
          <div
            className="sticky left-0 z-10 shrink-0 select-none bg-[var(--code)] text-right tabular-nums"
            style={{ minWidth: `calc(${String(lines.length).length}ch + 1.125rem)` }}
          >
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
        width={mapW}
        lines={lines}
        toks={toks}
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
