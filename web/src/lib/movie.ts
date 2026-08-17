import { realOf } from './history'

/**
 * Frames a second in the exported file.
 *
 * The same 30 the transport tops out at, and for the same reason: past it the replay is
 * skipping commits anyway, so a higher rate would spend encoder time on frames that are
 * duplicates of the one before. It is fixed rather than offered — a person exporting a
 * replay is choosing how long it runs and how big it is, and a third control whose only
 * effect is file size is a question with no answer on screen.
 */
export const FPS = 30

/** The face every label on the map is drawn in — see `labelStyle.FAMILY`.
 *
 *  A serialized SVG rendered through an `<img>` gets no stylesheet from the document that
 *  produced it, so a font the page loaded is simply absent and the text falls back to the
 *  system stack: an export whose labels are set in a different typeface from the map it is
 *  a recording of. They are inlined instead, once per export, as data URLs inside the
 *  picture — which is also what makes each frame self-contained, and the frames are the
 *  only thing the encoder ever sees. */
const FACES = [
  { weight: 400, url: '/fonts/line-seed-jp-400-latin.woff2' },
  { weight: 700, url: '/fonts/line-seed-jp-700-latin.woff2' },
]

/** Base64 without blowing the argument limit — `apply` on a megabyte of bytes throws. */
function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(out)
}

async function faceCss(): Promise<string> {
  const faces = await Promise.all(
    FACES.map(async (f) => {
      const res = await fetch(f.url)
      if (!res.ok) return ''
      const b = base64(new Uint8Array(await res.arrayBuffer()))
      return `@font-face{font-family:'LINE Seed JP';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${b}) format('woff2');}`
    }),
  )
  return faces.join('')
}

/**
 * Every custom property the app defines, resolved to what it currently means.
 *
 * The map paints in `var(--…)` throughout — that is how one geometry serves seven lenses
 * and two themes — and a variable is a reference to a declaration in a stylesheet the
 * exported picture does not have. Resolving them at the root of the clone keeps the
 * indirection intact: nothing in the markup has to be rewritten, the values simply have
 * somewhere to come from again.
 *
 * The NAMES come from the stylesheets and the VALUES from `getComputedStyle`, rather than
 * both from either. A stylesheet holds the light theme and the dark one and cannot say
 * which is on screen; computed style knows exactly that but cannot be asked what it has
 * without a list of names to ask about.
 */
function varCss(): string {
  const names = new Set<string>()
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // A stylesheet from another origin. There are none in the bundle, and one appearing
      // is not a reason to fail an export.
      continue
    }
    for (const rule of Array.from(rules)) {
      for (const m of rule.cssText.matchAll(/(--[\w-]+)\s*:/g)) names.add(m[1])
    }
  }
  const root = getComputedStyle(document.documentElement)
  const decls: string[] = []
  for (const name of names) {
    const value = root.getPropertyValue(name).trim()
    if (value) decls.push(`${name}:${value}`)
  }
  return `svg{${decls.join(';')}}`
}

/** The document's own background, so the letterboxing round a circle is the colour the map
 *  sits on rather than black or transparent. */
export function background(): string {
  return getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#fff'
}

/** A frame of the map, rasterized.
 *
 *  The live SVG is copied rather than redrawn: an exported movie that is a second renderer's
 *  idea of the sunburst is a picture nobody has checked against the one on screen, and the
 *  two would drift the first time a wedge changed. What the encoder sees is what the window
 *  is showing, at another size. */
class Shot {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private style: string

  constructor(
    private svg: SVGSVGElement,
    private size: number,
    private bg: string,
    style: string,
  ) {
    this.style = style
    this.canvas = document.createElement('canvas')
    this.canvas.width = size
    this.canvas.height = size
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('This machine gave no 2D canvas to draw the frames on.')
    this.ctx = ctx
  }

  get target(): HTMLCanvasElement {
    return this.canvas
  }

  async draw(): Promise<void> {
    const clone = this.svg.cloneNode(true) as SVGSVGElement
    // The live element is sized by the layout it sits in; the copy is sized by the export.
    // `viewBox` travels with it, so the circle is fitted into the square the same way the
    // pane fits it — letterboxed against the background rather than stretched.
    clone.removeAttribute('class')
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(this.size))
    clone.setAttribute('height', String(this.size))
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = this.style
    clone.insertBefore(style, clone.firstChild)

    const markup = new XMLSerializer().serializeToString(clone)
    // A blob URL rather than a data URL: a frame of a large repo is a megabyte of path
    // data, and percent-encoding it per frame costs more than the encode does.
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
    try {
      const img = new Image()
      img.src = url
      // **Raced against a clock, because `decode()` on an SVG image is not reliably a
      //   promise that settles.** WebKit has long-standing bugs where a picture it will
      //   not draw simply leaves the promise pending, and an export that hangs on one is
      //   indistinguishable from an export that is merely slow — the Stop button cannot
      //   reach a frame that is waiting inside here either. A frame that has not decoded
      //   in this long is not going to.
      await within(
        img.decode(),
        DECODE_LIMIT,
        `A frame took longer than ${DECODE_LIMIT / 1000}s to draw. Try a smaller resolution.`,
      )
      this.ctx.fillStyle = this.bg
      this.ctx.fillRect(0, 0, this.size, this.size)
      this.ctx.drawImage(img, 0, 0, this.size, this.size)
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/** How long one frame is given to rasterize before the export gives up on it. Generous:
 *  a large repo at 2160² is genuinely slow, and this is a hang detector rather than a
 *  performance budget. */
const DECODE_LIMIT = 20_000

/** How long the encoder is given to accept one frame. Measured at 10ms on a repo where the
 *  export then stopped dead, so this is not a budget either — it is the difference between
 *  an error somebody can act on and a dialog that sits there. */
const ENCODE_LIMIT = 30_000

/**
 * A promise, or an error naming what failed to happen.
 *
 * **Every await inside the frame loop gets one.** Both of the things this export waits on —
 * WebKit rasterizing an SVG, WebCodecs accepting a frame — are capable of simply never
 * settling, and neither the progress display nor the Stop button can reach a promise that
 * is still pending. A hang that reports itself is a bug somebody can fix; a hang that does
 * not is a feature people stop using. */
function within<T>(work: Promise<T>, limit: number, whenNot: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    work.finally(() => clearTimeout(timer)),
    new Promise<never>((_, fail) => {
      timer = setTimeout(() => fail(new Error(whenNot)), limit)
    }),
  ])
}

/** Let React commit and the browser paint before the frame is read back.
 *
 *  Two frames rather than one: the first is the one the state change is rendered into, and
 *  reading in it can catch the tree the commit is replacing. */
function settle(): Promise<void> {
  return new Promise((done) =>
    requestAnimationFrame(() => requestAnimationFrame(() => done())),
  )
}

/**
 * What the export is doing right now, and what each part of it has been costing.
 *
 * **Three stages and not one number, because the three fail differently.** An export of a
 * large repo is minutes of work, and a progress bar that only counts frames cannot tell a
 * machine that is working from one that has stopped — the first version of this said
 * `Frame 7 of 300` while ceph folded four hundred commits per frame, which reads as a hang
 * and was reported as one. Naming the stage makes a stall say what it stalled in, and the
 * per-stage averages say which of the three is worth attacking.
 */
export interface Tick {
  done: number
  total: number
  /** `fetch` is the timeline arriving from the backend, a block at a time. `fold` is the
   *  app rebuilding the map at the next commit — the same work the transport does when you
   *  scrub. `raster` is copying that picture out at export size. `encode` is the frame
   *  going to H.264. */
  stage: 'fetch' | 'fold' | 'raster' | 'encode'
  /** Mean milliseconds per stage over the frames that did work — a frame the playhead did
   *  not move for skips all but the encode, which is the point of them. */
  cost: { fetch: number; fold: number; raster: number; encode: number }
  /** Seconds left at the rate so far, or null before there is a rate. */
  left: number | null
}

export interface Recording {
  /** The commits in scope, as `HistoryBar` addresses them. */
  frames: number[]
  /** Seconds the finished movie should run for. */
  seconds: number
  /** Edge of the square frame, in pixels. */
  size: number
  /** Put a commit on screen. The caller is expected to render it synchronously enough that
   *  two animation frames later it is on the glass — see `settle`. */
  setIndex: (real: number) => void
  /** Have the timeline as far as this commit, before it is asked for.
   *
   *  **Awaited per frame rather than for the whole story up front.** The first version
   *  fetched every delta before the first frame, reasoning that a block landing mid-export
   *  would stall the playhead in the middle of the file. It buys the same guarantee — a
   *  frame is never drawn against a timeline that has not arrived — without ever holding
   *  more of the story than the export has reached, and on a repo like ceph the difference
   *  is 123,000 commits of deltas materialised before anything is drawn. */
  ensure: (index: number) => Promise<void>
  onProgress: (tick: Tick) => void
  /** Checked between stages. An export of a long repo is minutes of work and has to be
   *  abandonable without waiting for it. */
  cancelled: () => boolean
}

/** Thrown when the person pressed Cancel. Named so the dialog can tell it from a failure. */
export const CANCELLED = 'cancelled'

/**
 * How the frames are encoded, in one place because the preflight has to use exactly what
 * the recording will.
 *
 * **A bitrate rather than a bare quality level.** A qualitative quality prefers QUANTIZER-
 * based rate control wherever the codec allows it, which for H.264 it does; `preferBitrate`
 * takes the ordinary VBR road to the same target.
 *
 * **`latencyMode: 'realtime'`, which is not about latency here.** The other mode lets the
 * encoder reorder and look ahead, so it may swallow a run of frames before emitting
 * anything — and the source feeding it stops at four outstanding and waits for a `dequeue`
 * that a buffering encoder has no reason to send. That is a deadlock between two correct
 * components, and it is what an export looks like when it stops dead seven frames in with
 * every stage reporting single-digit milliseconds. Realtime mode emits per frame.
 */
function settings(quality: InstanceType<typeof import('mediabunny').Quality>) {
  return { codec: 'avc' as const, quality, latencyMode: 'realtime' as const }
}

/**
 * Encode a few blank frames at the chosen size before recording anything.
 *
 * **A probe that ASKS the encoder, because one that asks about it lies.**
 * `canEncodeVideo('avc', { width, height })` is `VideoEncoder.isConfigSupported` underneath,
 * and it answered yes for a configuration this machine then refused to produce a single
 * packet from. The tell was frame seven: the source blocks at four outstanding frames and
 * waits for a `dequeue` event, so an encoder that quietly stops dequeuing hangs a promise
 * that has no error path at all — there is nothing to catch and nothing to time out against
 * except a clock we hold ourselves.
 *
 * Ten frames, because the failure is at the queue threshold and four is where it starts. It
 * costs well under a second even at 2160², which is the difference between finding out now
 * and finding out a minute into a recording.
 */
async function preflight(
  size: number,
  encoding: ReturnType<typeof settings>,
  deps: {
    BufferTarget: typeof import('mediabunny').BufferTarget
    CanvasSource: typeof import('mediabunny').CanvasSource
    Mp4OutputFormat: typeof import('mediabunny').Mp4OutputFormat
    Output: typeof import('mediabunny').Output
  },
): Promise<void> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This machine gave no 2D canvas to draw the frames on.')
  ctx.fillStyle = background()
  ctx.fillRect(0, 0, size, size)

  const output = new deps.Output({
    format: new deps.Mp4OutputFormat(),
    target: new deps.BufferTarget(),
  })
  const source = new deps.CanvasSource(canvas, encoding)
  output.addVideoTrack(source, { frameRate: FPS })
  const refused = `This machine will not encode H.264 at ${size} × ${size}. Try a smaller resolution.`
  try {
    await within(output.start(), PREFLIGHT_LIMIT, refused)
    for (let f = 0; f < 10; f++) {
      await within(source.add(f / FPS, 1 / FPS), PREFLIGHT_LIMIT, refused)
    }
    await within(output.finalize(), PREFLIGHT_LIMIT, refused)
  } catch (e) {
    // Whatever it managed so far is thrown away; the point was the answer, not the file.
    // Cancelling a finalized output is not an error worth reporting over the real one.
    await output.cancel().catch(() => {})
    throw e instanceof Error ? e : new Error(refused)
  }
}

/** The whole probe is ten blank frames. Anything this side of it is a machine saying no. */
const PREFLIGHT_LIMIT = 10_000

/**
 * Record the replay as it is drawn, and return the finished MP4.
 *
 * Not a realtime capture. The replay on screen holds a DURATION by skipping commits when a
 * machine cannot draw them fast enough, which is the right answer for something being
 * watched and the wrong one for a file: the recording would be as good as the machine that
 * happened to make it. Here the clock is the output's — frame `f` is at `f / FPS` no matter
 * how long it took to draw — so the movie is the length it was asked for and every frame
 * lands, on any machine.
 *
 * The map is only re-rasterized when the commit under the playhead CHANGES. A sixty-second
 * export of a forty-commit repo is eighteen hundred frames of forty pictures, and drawing
 * each one forty-five times would be most of the export.
 */
export async function record(o: Recording): Promise<Uint8Array> {
  const svg = document.querySelector<SVGSVGElement>('svg[data-sunburst]')
  if (!svg) throw new Error('The map is not on screen to record.')

  // Imported here rather than at the top of the file: the muxer is a third of a megabyte
  // and every launch of the app would carry it for a thing most sessions never do. The
  // first export waits a moment for it; nothing else pays.
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, canEncodeVideo } =
    await import('mediabunny')

  if (!(await canEncodeVideo('avc'))) {
    throw new Error('This machine has no H.264 encoder to write an MP4 with.')
  }

  const encoding = settings(new Quality({ quality: 'high', preferBitrate: true }))

  // **Asked of the encoder, not about it.** See `preflight`.
  await preflight(o.size, encoding, { BufferTarget, CanvasSource, Mp4OutputFormat, Output })

  const shot = new Shot(svg, o.size, background(), (await faceCss()) + varCss())
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(shot.target, encoding)
  output.addVideoTrack(source, { frameRate: FPS })
  await output.start()

  const last = o.frames.length - 1
  const total = Math.max(1, Math.round(o.seconds * FPS))
  // The playhead's own -1: the opening state, before the first commit in scope lands. A
  // replay that starts one commit in has thrown away the only frame that shows what was
  // already there.
  let shown = Number.NaN
  // Summed rather than sampled: a mean over every frame so far is steadier than the last
  // one, and the thing being estimated — how long the rest takes — is an average anyway.
  const spent = { fetch: 0, fold: 0, raster: 0, encode: 0 }
  let drawn = 0
  const report = (done: number, stage: Tick['stage']) => {
    const cost = {
      fetch: drawn > 0 ? spent.fetch / drawn : 0,
      fold: drawn > 0 ? spent.fold / drawn : 0,
      raster: drawn > 0 ? spent.raster / drawn : 0,
      encode: done > 0 ? spent.encode / done : 0,
    }
    o.onProgress({
      done,
      total,
      stage,
      cost,
      // Every remaining frame pays the encode; only the ones the playhead moves for pay the
      // other two, and so far that has been `drawn` of `done`.
      left:
        done > 0
          ? ((total - done) *
              (cost.encode +
                (drawn / done) * (cost.fetch + cost.fold + cost.raster))) /
            1000
          : null,
    })
  }

  for (let f = 0; f < total; f++) {
    if (o.cancelled()) throw new Error(CANCELLED)
    const pos = Math.max(
      -1,
      Math.min(last, Math.round(-1 + (f / Math.max(1, total - 1)) * (last + 1))),
    )
    const real = realOf(o.frames, pos, -1)
    if (real !== shown) {
      report(f, 'fetch')
      const t0 = performance.now()
      await o.ensure(real)
      const tf = performance.now()
      if (o.cancelled()) throw new Error(CANCELLED)
      report(f, 'fold')
      o.setIndex(real)
      await settle()
      const t1 = performance.now()
      if (o.cancelled()) throw new Error(CANCELLED)
      report(f, 'raster')
      await shot.draw()
      spent.fetch += tf - t0
      spent.fold += t1 - tf
      spent.raster += performance.now() - t1
      drawn += 1
      shown = real
    }
    if (o.cancelled()) throw new Error(CANCELLED)
    report(f, 'encode')
    const t2 = performance.now()
    await within(
      source.add(f / FPS, 1 / FPS),
      ENCODE_LIMIT,
      `The encoder stopped accepting frames at ${o.size} × ${o.size}, ${f} frames in. Try a smaller resolution.`,
    )
    spent.encode += performance.now() - t2
    report(f + 1, 'encode')
  }

  await output.finalize()
  const buffer = output.target.buffer
  if (!buffer) throw new Error('The encoder returned no file.')
  return new Uint8Array(buffer)
}

/** Base64 for the trip across to Rust, which is where the file gets written. */
export function encoded(bytes: Uint8Array): string {
  return base64(bytes)
}
