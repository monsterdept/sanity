import { useEffect, useMemo, useRef, useState } from 'react'
import { heatColor, isAnalyzed, paintHeat, readSource, type Node } from '../lib/api'
import { tokenize } from '../lib/tokens'

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

/** Ramp stops read off the cascade, so the minimap can interpolate heat itself.
 *
 *  `heatColor` returns a `color-mix()` string, which is fine in CSS and not something a
 *  canvas `fillStyle` will parse. So the five stops come out of the custom properties as
 *  hex and get mixed here — same ramp, same order, arrived at differently. */
function rampStops(el: HTMLElement): Array<[number, number, number]> {
  const cs = getComputedStyle(el)
  return [0, 1, 2, 3, 4].map((i) => {
    const hex = cs.getPropertyValue(`--heat-${i}`).trim() || '#888888'
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number]
  })
}

function rampAt(stops: Array<[number, number, number]>, t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

/**
 * The whole file at a glance, with the heat on it.
 *
 * A minimap of source alone would be a scrollbar with texture. What makes it worth the
 * width here is that the heat is on it: the profile of where the thinking sits in this
 * file, visible without scrolling, and clickable to get there.
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

    const stops = rampStops(canvas)
    const ink = getComputedStyle(canvas).color
    // Fit the WHOLE file, however long. A minimap that scrolls is a second thing to
    // navigate; the point of this one is that the file's heat profile is one glance.
    const lh = Math.min(3, r.height / lines.length)
    const charW = Math.max(0.35, Math.min(1, (r.width - 6) / 110))

    for (let i = 0; i < lines.length; i++) {
      const y = i * lh
      const owner = owners.get(i + 1)
      if (owner && isAnalyzed(owner)) {
        ctx.fillStyle = rampAt(stops, paintHeat(owner))
        ctx.globalAlpha = 0.4
        ctx.fillRect(0, y, r.width, Math.max(lh, 1))
        ctx.globalAlpha = 1
      }
      const line = lines[i]
      const trimmed = line.trimStart()
      if (!trimmed) continue
      const indent = line.length - trimmed.length
      ctx.fillStyle = ink
      // Comments sit back, so the shape reads as code with prose in it rather than as
      // undifferentiated texture.
      ctx.globalAlpha = /^(\/\/|#|\*|\/\*)/.test(trimmed) ? 0.22 : 0.5
      ctx.fillRect(
        3 + indent * charW,
        y + lh * 0.15,
        Math.min(trimmed.length * charW, r.width - 6 - indent * charW),
        Math.max(lh * 0.7, 0.7),
      )
      ctx.globalAlpha = 1
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
            {lines.map((line, i) => {
              const n = i + 1
              const owner = owners.get(n)
              const analyzed = owner ? isAnalyzed(owner) : false
              const heat = owner && analyzed ? paintHeat(owner) : null
              const isSel = owner != null && selected?.id === owner.id
              const isFirst = owner != null && owner.line === n
              return (
                <tr
                  key={n}
                  data-line={n}
                  onClick={() => owner && onSelect(owner)}
                  className={owner ? 'cursor-pointer' : undefined}
                  // The reading, as a wash behind the whole chunk.
                  //
                  // Background and text are different channels, so this doesn't fight the
                  // syntax colors the way tinting the code itself would — and at a fixed
                  // 16% the ramp carries the value while the text stays at full contrast.
                  // Fixed rather than scaled by heat: fading the alpha with the reading
                  // would encode the same number twice, and the cool end would disappear
                  // instead of saying "measured, and cold".
                  style={{
                    background: isSel
                      ? 'color-mix(in oklch, var(--accent) 22%, transparent)'
                      : heat !== null
                        ? `color-mix(in oklch, ${heatColor(heat)} 16%, transparent)`
                        : undefined,
                  }}
                >
                  {/* The gutter keeps its full-strength bar. The wash behind the code is
                    deliberately too faint to compare wedge to wedge; this is the edge
                    you can actually scan down. */}
                  <td
                    className="w-[3px] p-0"
                    style={{
                      background:
                        heat !== null
                          ? heatColor(heat)
                          : owner
                            ? 'var(--unanalyzed)'
                            : 'transparent',
                    }}
                  />
                  <td className="select-none px-2 text-right align-top text-[var(--muted-foreground)] opacity-50 tabular-nums">
                    {n}
                  </td>
                  <td className="w-full whitespace-pre pr-4 align-top">
                    {tokenize(line).map((t, j) => (
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
