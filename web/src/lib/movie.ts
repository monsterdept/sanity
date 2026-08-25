import { realOf } from './history'
import { FAMILY } from './labelStyle'
import type { ColorMode } from './colorMode'
import { mascotClock } from './mascotClock'

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

/**
 * The frame's shape, as width over height.
 *
 * **16:9, and the map is a circle, so this is a deliberate purchase rather than a default.**
 * A square frame was the honest answer while the file was only ever the map: a 16:9 picture
 * of a sunburst is two empty margins totalling nearly half of every frame, paid for in
 * encode time and file size. What changed is what the file is FOR — a replay is something
 * people post, and a post wants to say which repo it is of and where it came from. So the
 * margins are not waste any more, they are where the caption lives, and the shape that
 * created them is also the one every player, timeline and social embed expects.
 */
export const ASPECT = 16 / 9

/** The signature in the corner of every exported movie.
 *
 *  **"Charted", because that is what the app did.** It did not create the repo, the history
 *  or the commits — it drew them, and a movie that says "created by" over somebody else's
 *  code claims the wrong thing in the one line that is about authorship.
 *
 *  Fixed rather than offered. It is a signature, and a signature somebody can edit is a text
 *  field in a dialog that already has three controls, answering a question nobody arrived
 *  with. */
const SIGNATURE = 'charted by sanity.monster'

/** The breathing room round the map and the caption, as a fraction of the frame's height. */
const PAD = 0.055

/**
 * Where the map is drawn inside a frame of this size, in pixels.
 *
 * **Right-aligned, not centred, and the caption gets what is left.** Centring the circle
 * would split the spare width into two margins too narrow to set a repo name in and leave
 * the composition with nothing in either. Against the right edge, the whole of the surplus
 * is one column — 0.72 of the frame's height at 16:9, which is room for a name at a size
 * that reads in a timeline thumbnail.
 */
export function mapRect(width: number, height: number) {
  const side = Math.round(height * (1 - 2 * PAD))
  return { x: Math.round(width - height * PAD - side), y: Math.round((height - side) / 2), side }
}

/**
 * How the map is dressed while a recording is being made.
 *
 * The export copies what is on screen, so anything the FILE needs that the pane is not
 * currently doing has to be done to the pane for the duration — and then undone. Both of
 * these are: `px` is the side the map lays itself out for, and `ground` is which palette it
 * paints in. It is scoped to the map rather than applied to the document, so exporting a
 * light movie from a dark window changes the map and nothing else.
 */
export interface Staged {
  px: number
  ground: 'light' | 'dark'
  /** The lens the file is being recorded in, when it is not the one on screen.
   *
   *  **The export records what is on screen, so choosing a lens means changing the map.** It
   *  already changes the ground and the density for the length of a recording, and on the
   *  same argument: a movie drawn by a second renderer nobody has checked against the first
   *  is a picture of a map that does not exist. The pane goes back when the dialog closes. */
  mode?: ColorMode
}

/** The key a movie carries, since a file has no chrome around it to put one in.
 *
 *  **A movie used to need no key.** Every replay was the age ramp with two event flashes, so
 *  the picture explained itself. Now a recording can be any lens the replay can paint — and
 *  a Blame movie is sixteen colours with nothing saying whose, which is a picture of a fact
 *  rather than the fact. Built by the window, which is the side that knows the ranking, and
 *  drawn into the caption column by `Frame.legend`.
 *
 *  Colours are custom-property NAMES rather than values: the caption is Canvas2D and resolves
 *  them against the staged map, so the key comes out in the ground the file is written on
 *  rather than the one the window happens to be wearing. */
export interface MovieKey {
  /** The lens, named as the switcher names it. */
  title: string
  /** Categorical lenses: a swatch and a name each, already in slot order. */
  entries: { label: string; token: string }[]
  /** How many the map has that this key does not name — printed as `+N more`, never elided
   *  silently, on the same rule the repo slug follows. */
  more: number
  /** Ramped lenses: the stops, cold end first, with the words for each end. */
  ramp: { tokens: string[]; ends: [string, string] } | null
}

/** The side the map is drawn at inside a frame of this height — what the sunburst lays
 *  itself out for, so a bigger file draws more of the repo rather than the same picture
 *  upscaled. See `Sunburst`'s `density`. */
export function mapSide(height: number): number {
  return mapRect(Math.round(height * ASPECT), height).side
}

/** A custom property, resolved against the element that has one. The caption is drawn in
 *  Canvas2D rather than in the SVG, so it cannot say `var(--foreground)` and have anything
 *  answer — and it must read the same ground the map is being recorded in, which during an
 *  export is staged on the pane rather than on the document. */
function ink(from: Element, name: string): string {
  return getComputedStyle(from).getPropertyValue(name).trim()
}

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
function varCss(from: Element): string {
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
  // Resolved from the map itself rather than from `<html>`. Custom properties inherit, so
  // the map's computed style is the answer wherever the ground was actually put — and an
  // export stages its ground on the pane, so the window it is recording from does not have
  // to change colour. See the `.light` selector in `index.css`.
  const root = getComputedStyle(from)
  const decls: string[] = []
  for (const name of names) {
    const value = root.getPropertyValue(name).trim()
    if (value) decls.push(`${name}:${value}`)
  }
  return `svg{${decls.join(';')}}`
}

/** The ground the map is sitting on, so the frame round a circle is that colour rather than
 *  black or transparent. Asked of an element — the map, during a recording — because the
 *  ground may be staged on the pane rather than on the document. */
export function background(from: Element = document.documentElement): string {
  return getComputedStyle(from).getPropertyValue('--background').trim() || '#fff'
}

/** A frame of the map, rasterized.
 *
 *  The live SVG is copied rather than redrawn: an exported movie that is a second renderer's
 *  idea of the sunburst is a picture nobody has checked against the one on screen, and the
 *  two would drift the first time a wedge changed. What the encoder sees is what the window
 *  is showing, at another size. */
class Shot {
  /** What the encoder is handed: the base with the creature drawn on top of it. */
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  /** Everything that only changes when the playhead does — the map, the caption, the
   *  timeline. Rendered once per commit and blitted under every frame that stands at it.
   *
   *  **Two canvases because the two things move at different rates.** The map is
   *  re-rasterized only when the commit under the playhead changes (a minute of a forty
   *  commit repo is 1,800 frames of forty pictures), and the creature moves every frame. One
   *  canvas would mean choosing: re-raster the map thirty times a second for a picture that
   *  did not change, or step the creature forty times in a minute. */
  private base: HTMLCanvasElement
  private baseCtx: CanvasRenderingContext2D
  private style: string
  /** Where the map goes in the frame, and how big — see `mapRect`. */
  private map: { x: number; y: number; side: number }
  /** Where the playhead stands in the frame being drawn — set by `draw`. */
  private at: Playhead = { at: 0, of: 1, ts: null }

  constructor(
    private svg: SVGSVGElement,
    private w: number,
    private h: number,
    private bg: string,
    style: string,
    /** The repo as the world knows it, set in the margin the 16:9 shape opens up. */
    private title: string,
    /** The directory the replay is scoped to, or `''`. */
    private scope: string,
    /** The lens key, asked for at every rebuild. See `MovieKey`. */
    private keyOf: () => MovieKey | null,
  ) {
    this.style = style
    this.map = mapRect(w, h)
    this.canvas = document.createElement('canvas')
    this.canvas.width = w
    this.canvas.height = h
    this.base = document.createElement('canvas')
    this.base.width = w
    this.base.height = h
    const ctx = this.canvas.getContext('2d')
    const baseCtx = this.base.getContext('2d')
    if (!ctx || !baseCtx) {
      throw new Error('This machine gave no 2D canvas to draw the frames on.')
    }
    this.ctx = ctx
    this.baseCtx = baseCtx
  }

  get target(): HTMLCanvasElement {
    return this.canvas
  }

  /**
   * Rebuild the base: the map, the caption and where the playhead stands.
   *
   * `at` is the position in the commits being exported — the scoped list when the map is
   * drilled, which is the same list the transport addresses and the same story on screen.
   */
  async draw(at: Playhead): Promise<void> {
    this.at = at
    const clone = this.svg.cloneNode(true) as SVGSVGElement
    // The live element is sized by the layout it sits in; the copy is sized by the export.
    // `viewBox` travels with it, so the circle is fitted into the square the same way the
    // pane fits it — letterboxed against the background rather than stretched.
    clone.removeAttribute('class')
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(this.map.side))
    clone.setAttribute('height', String(this.map.side))
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
      this.baseCtx.fillStyle = this.bg
      this.baseCtx.fillRect(0, 0, this.w, this.h)
      this.baseCtx.drawImage(img, this.map.x, this.map.y, this.map.side, this.map.side)
      this.caption()
      this.timeline()
      this.legend()
      this.signature()
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * The creature in the hub, composited on top of the map.
   *
   * **It is not in the SVG, so a copy of the SVG does not carry it.** The mascot is a WebGL
   * canvas laid over the pane rather than a `foreignObject` inside the picture — see the hub
   * in `Sunburst` — which is right on screen, where a canvas scaled by an SVG transform
   * would be a bitmap stretched instead of a scene redrawn, and it is exactly why the middle
   * of every exported frame was an empty disc.
   *
   * Where it goes is arithmetic rather than measurement: the live element's transform is in
   * PANE pixels and the frame is another size entirely, so the position is recomputed from
   * the map's own coordinates — the viewBox the fit effect just wrote, and the hub box the
   * layer states in `data-hub-mascot`. Nothing here duplicates a number that lives there.
   *
   * Silent when there is no creature. The committed placeholder bundle draws nothing, a
   * replay of a project can be exported before the scene has built its first frame, and an
   * export that refused over a missing mascot would be an export that refused.
   */
  /**
   * One frame for the encoder: the base as it stands, with the creature on top.
   *
   * Called for every frame of the file, including the many that stand at the same commit —
   * which is the point. The creature has just been stepped by one frame of the movie's own
   * clock (see `mascotClock`), so this is where that lands.
   */
  frame(): void {
    this.ctx.drawImage(this.base, 0, 0)
    this.creature()
  }

  private creature(): void {
    const layer = document.querySelector<HTMLElement>('[data-hub-mascot]')
    const canvas = layer?.querySelector('canvas')
    if (!layer || !canvas || canvas.width === 0 || canvas.height === 0) return
    const [hubY, box] = layer.dataset.hubMascot!.split(' ').map(Number)
    const view = (this.svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
    if (view.length !== 4 || !view.every(Number.isFinite) || view[2] <= 0) return
    // The viewBox is square and the copy is drawn into a square, so one scale serves both
    // axes — the same arithmetic the fit effect does against the pane.
    const s = this.map.side / view[2]
    const cx = this.map.x + (0 - view[0]) * s
    const cy = this.map.y + (hubY - view[1]) * s

    // **Where the canvas sits inside its layer, asked rather than assumed.** The layer is
    // the hub's box; the creature is lifted inside it by `MascotFigure`'s `lift`, a
    // per-blueprint offset that stands a creature shorter than its frame off the floor — so
    // the box's middle is not the creature's, and centring on the box alone drew it low and
    // is what the first exports came out with. The lift is a transform on the canvas, in the
    // layer's own pixels, and reading it back as a ratio of the two boxes is the one form of
    // it that survives both the pane's scale and the frame's: whatever placement the window
    // arrived at, the frame reproduces it.
    const boxRect = layer.getBoundingClientRect()
    const onGlass = canvas.getBoundingClientRect()
    if (boxRect.width <= 0 || boxRect.height <= 0) return
    const drawn = box * s * (onGlass.width / boxRect.width)
    const dx =
      ((onGlass.x + onGlass.width / 2 - (boxRect.x + boxRect.width / 2)) / boxRect.width) * box * s
    const dy =
      ((onGlass.y + onGlass.height / 2 - (boxRect.y + boxRect.height / 2)) / boxRect.height) *
      box *
      s

    // `preserveDrawingBuffer` is on in the bundle, which is what makes reading the canvas
    // back outside its own animation frame give the picture rather than a cleared buffer.
    this.ctx.drawImage(canvas, cx + dx - drawn / 2, cy + dy - drawn / 2, drawn, drawn)
  }

  /**
   * The repo's name and where the movie came from, in the margin the 16:9 shape opens up.
   *
   * **The one thing in the file that is not a recording of the window**, and it is furniture
   * rather than a second renderer: it says what is being shown and who made it, and it makes
   * no claim the map does not. The rule it must not break is the one the whole export rests
   * on — nothing here draws a wedge, a label or a reading, because a picture of the map that
   * this file composed itself would be a picture nobody has checked against the one on
   * screen.
   *
   * Shrunk to fit and only then elided, the same order the hub sizes its own name in: a
   * size computed from a string that is about to be cut is a size for a string nobody sees.
   */
  /** The column the caption lives in: everything left of the map, inset by the frame's own
   *  margin. One definition, because the name, the timeline and the signature all line up
   *  with it and a second copy is how three things stop agreeing. */
  private column(): { left: number; room: number } {
    const pad = Math.round(this.h * PAD)
    const left = pad * 2
    return { left, room: this.map.x - pad - left }
  }

  private caption(): void {
    const { left, room } = this.column()
    if (room < this.h * 0.2) return
    const c = this.baseCtx
    c.textBaseline = 'alphabetic'
    c.textAlign = 'left'

    // **The owner is set back, so the name still reads as the name.** `owner/name` is what
    // the repo is called in public and a movie of it should say so, but the whole slug at
    // one weight makes a stranger's username as loud as the project — and it is the project
    // the picture is of. Muted and at the same size: present, addressable, not shouting.
    const cut = this.title.lastIndexOf('/')
    const owner = cut > 0 ? this.title.slice(0, cut + 1) : ''
    const name = cut > 0 ? this.title.slice(cut + 1) : this.title

    const small = Math.max(11, Math.round(this.h * 0.026))
    const big = Math.round(this.h * 0.085)
    const widthOf = (text: string, px: number, weight: number) => {
      c.font = `${weight} ${px}px ${FAMILY}`
      return c.measureText(text).width
    }
    const inline = (px: number) => widthOf(owner, px, 400) + widthOf(name, px, 700)

    // **Nothing here is ever elided, and that is a rule rather than a preference.** A cut
    // repo name is a caption that names a repo which does not exist — `barstoolbluz/tonepo…`
    // is not findable, not searchable and not the project — so the type gives way instead,
    // every time. The first version cut, and it cut for a reason worth remembering: it
    // shrank until the slug fitted EXACTLY, then measured `name + '…'`, which is wider by an
    // ellipsis, and trimmed a name that had just been made to fit.
    //
    // Two layouts rather than one long shrink. Inline while the pair still reads at a size
    // worth having; past that the owner moves to a small line of its own and the name takes
    // the whole column, which buys back the width the owner was spending and keeps the
    // project — the thing the picture is of — the biggest word on the frame.
    let size = big
    const inlineFloor = Math.round(this.h * 0.05)
    while (size > inlineFloor && inline(size) > room) size -= 1
    const stacked = inline(size) > room
    if (stacked) {
      size = big
      // The floor here is the tagline's own size: past that the name is no longer a title,
      // and a repo whose name cannot be set at 26 thousandths of the frame is a repo nobody
      // was going to read at a glance anyway. It is still whole.
      while (size > small && widthOf(name, size, 700) > room) size -= 1
    }

    // **The drilled path is its own line, under the name.** It rode on the signature for a
    // while — `src/mon · created by sanity.monster` — which put the one fact about WHAT the
    // movie shows in the same breath as who made it, at the size of a credit. A replay of a
    // subtree is a different film from a replay of the repo, and the caption should say so
    // where somebody is already reading: directly beneath the thing it qualifies.
    //
    // Not elided either, and shrunk on its own — a path is only useful whole, and a deep one
    // is exactly the case where the reader needs every segment.
    let scopeSize = this.scope ? Math.max(small, Math.round(this.h * 0.036)) : 0
    if (this.scope) {
      while (scopeSize > Math.round(small * 0.8) && widthOf(this.scope, scopeSize, 400) > room) {
        scopeSize -= 1
      }
    }

    const eyebrow = stacked ? Math.round(small * 1.6) : 0
    const toScope = this.scope ? Math.round(size * 0.42) + scopeSize : 0
    // The whole assembly is centred, timeline included — measured here rather than in
    // `timeline`, because a block that centres three of its four parts sits high by the
    // height of the fourth, and the empty half of the frame is the part people notice. The
    // signature is not in it: it is furniture at the foot of the frame, not part of what the
    // block is saying.
    // **Top of the column, not the middle of it.** This margin holds three things — a title
    // with its timeline, a key, and a byline — and they were laid out as one centred block
    // with the key hung underneath, so the title drifted as the key grew and the byline sat
    // between the two things it is not. Pinned top and bottom, the middle belongs to the key
    // and it can be any height that fits there.
    const top = Math.round(this.h * PAD * 1.6)
    const base = top + eyebrow + size
    const fore = ink(this.svg, '--foreground') || '#111'
    const muted = ink(this.svg, '--muted-foreground') || fore

    if (stacked) {
      c.font = `400 ${small}px ${FAMILY}`
      c.fillStyle = muted
      c.fillText(owner, left, top + small)
    } else {
      c.font = `400 ${size}px ${FAMILY}`
      c.fillStyle = muted
      c.fillText(owner, left, base)
    }
    c.font = `700 ${size}px ${FAMILY}`
    c.fillStyle = fore
    c.fillText(name, left + (stacked ? 0 : widthOf(owner, size, 400)), base)

    if (this.scope) {
      c.font = `400 ${scopeSize}px ${FAMILY}`
      c.fillStyle = muted
      c.fillText(this.scope, left, base + toScope)
    }

    this.rule = { left, right: left + room, base: base + toScope }
  }

  /**
   * Whose instrument drew this, under the timeline.
   *
   * **Under the block rather than inside it.** It sat directly beneath the repo for a
   * while — third line of four, in the same visual group as the name and the drilled path —
   * which put an attribution in the middle of the sentence the caption is making. What the
   * block says is *this repo, this directory, this far through its history*; who charted it
   * is true, worth stating, and not part of that. Below the dates it is plainly a sign-off,
   * and it stays close enough to the rest to read as one composition — a frame-foot version
   * was tried and floated free of everything it belongs to.
   */
  /** The lens key, at the foot of the caption column.
   *
   *  **Bottom-anchored rather than stacked under the caption**, which is vertically centred
   *  and measured to the pixel: hanging a variable number of rows off it would move the
   *  repo's name every time somebody exported a different lens. The corner is where this
   *  window already keeps what it says ABOUT the map, and a file inherits that.
   *
   *  Drawn only if it fits. A key that overlaps the caption is worse than no key, and the
   *  caller has the same information one click away in the app.
   */
  private legend(): void {
    const key = this.keyOf()
    if (!key) return
    const { left, room } = this.column()
    if (room < this.h * 0.2) return
    const c = this.baseCtx
    const small = Math.max(10, Math.round(this.h * 0.022))
    const row = Math.round(small * 1.7)
    const box = Math.round(small * 0.8)
    // **Fitted to the space rather than tested against it.** The first version measured the
    // whole key and returned if it would not fit, which on a 4K frame with sixteen authors
    // meant it never drew at all: seventeen rows is fourteen hundred pixels and the caption
    // is centred in the middle of the column. A key that names ten of sixteen is a key; a key
    // that names none because it could not name all is a bug, and it looked exactly like the
    // feature being missing.
    // **Between the two pinned blocks.** The title and its timeline are at the top of the
    // column and the byline at the foot, so the key gets the middle and can be any height
    // that fits there without moving either of them.
    const big = Math.max(11, Math.round(this.h * 0.026))
    const head = this.rule
      ? this.rule.base +
        Math.round(big * 2.6) +
        Math.max(2, Math.round(this.h * 0.004)) +
        Math.round(big * 1.7) +
        Math.round(big * 2.4)
      : Math.round(this.h * PAD * 1.6)
    const foot = this.h - Math.round(this.h * PAD * 1.6) - Math.round(big * 2.2)
    const space = foot - head
    const fits = Math.max(0, Math.floor(space / row) - 1)
    if (fits < 2) return
    // **Columns, because the margin is wide and the space under the caption is not.** One
    // column fits five of sixteen authors on a 4K frame; the same key in three columns fits
    // all of them, in a margin that is a thousand pixels across and otherwise empty.
    c.font = `400 ${small}px ${FAMILY}`
    const widest = key.entries.reduce((w, e) => Math.max(w, c.measureText(e.label).width), 0)
    const colW = Math.round(box * 1.6 + widest + small * 1.4)
    const cols = key.ramp ? 1 : Math.max(1, Math.min(Math.floor(room / colW), 4))
    const capacity = fits * cols
    const shown = key.ramp ? key.entries : key.entries.slice(0, capacity)
    const more = key.more + (key.entries.length - shown.length)
    const perCol = cols > 1 ? Math.ceil((shown.length + (more > 0 ? 1 : 0)) / cols) : shown.length
    let y = head + row

    const fore = ink(this.svg, '--foreground') || '#111'
    const muted = ink(this.svg, '--muted-foreground') || fore
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
    c.font = `700 ${small}px ${FAMILY}`
    c.fillStyle = muted
    c.fillText(key.title.toUpperCase(), left, y - row)

    if (key.ramp) {
      // The stops as they are, not a smoothed gradient: the ramp has five and the map paints
      // between them, so five swatches is the honest picture of the scale.
      const w = Math.min(room, Math.round(small * 9))
      const step = w / key.ramp.tokens.length
      key.ramp.tokens.forEach((token: string, i: number) => {
        c.fillStyle = ink(this.svg, token) || muted
        c.fillRect(left + i * step, y - box, step, box)
      })
      y += row
      c.font = `400 ${small}px ${FAMILY}`
      c.fillStyle = muted
      c.fillText(key.ramp.ends[0], left, y)
      const hi = key.ramp.ends[1]
      c.textAlign = 'right'
      c.fillText(hi, left + w, y)
      c.textAlign = 'left'
      return
    }

    c.font = `400 ${small}px ${FAMILY}`
    const first = y
    shown.forEach((e, i) => {
      const col = Math.floor(i / perCol)
      const x = left + col * colW
      const ry = first + (i % perCol) * row
      c.fillStyle = ink(this.svg, e.token) || muted
      c.fillRect(x, ry - box, box, box)
      c.fillStyle = fore
      c.fillText(e.label, x + Math.round(box * 1.6), ry)
    })
    if (more > 0) {
      // In the last column, under the names it is counting — never elided into silence.
      const i = shown.length
      const col = Math.min(cols - 1, Math.floor(i / perCol))
      c.fillStyle = muted
      c.fillText(
        `+${more} more`,
        left + col * colW + Math.round(box * 1.6),
        first + (i % perCol) * row,
      )
    }
  }

  /** Whose instrument drew this, at the foot of the column.
   *
   *  **Bottom-aligned, because it is the last thing rather than the next thing.** It hung a
   *  fixed distance under the date, which made it the middle of three blocks and left the key
   *  — the part somebody reads the map with — below the byline. */
  private signature(): void {
    const { left } = this.column()
    const c = this.baseCtx
    const small = Math.max(11, Math.round(this.h * 0.026))
    const base = this.h - Math.round(this.h * PAD * 1.6)
    c.textAlign = 'left'
    c.textBaseline = 'alphabetic'
    c.font = `400 ${small}px ${FAMILY}`
    c.fillStyle = ink(this.svg, '--muted-foreground') || ink(this.svg, '--foreground') || '#111'
    c.fillText(SIGNATURE, left, base)
  }

  /** Where the caption ended, so the timeline can line up with it rather than recompute it. */
  private rule: { left: number; right: number; base: number } | null = null

  /**
   * Where in the story this frame stands: a rule with the passed part filled, the commit's
   * own date under one end and its number under the other.
   *
   * **A movie of a repo's history is unreadable without it.** The map says what changed and
   * says nothing about when — the same wedges bloom whether the frame is 2019 or last
   * Tuesday, and a viewer watching a minute of a decade has no way to tell a slow year from
   * a busy afternoon. It is the one thing a replay on screen has that the file did not: the
   * window has a scrub bar under it.
   *
   * It steps per COMMIT rather than per frame, because that is what it is measuring. The map
   * is re-rasterized only when the playhead moves (see `record`), so a bar that crept every
   * frame would be claiming a resolution the picture above it does not have.
   *
   * Dated from the commit, never interpolated. A frame before the window — the opening
   * state, everything the truncated commits built — has no date it can honestly carry, on
   * the same rule the replay colours it by: nothing before the window makes a claim about
   * its own age.
   */
  private timeline(): void {
    const r = this.rule
    if (!r) return
    const c = this.baseCtx
    const small = Math.max(11, Math.round(this.h * 0.026))
    const y = r.base + Math.round(small * 2.6)
    const thick = Math.max(2, Math.round(this.h * 0.004))
    const width = r.right - r.left
    const done = this.at.of > 1 ? Math.min(1, Math.max(0, this.at.at / (this.at.of - 1))) : 1
    const fore = ink(this.svg, '--foreground') || '#111'
    const muted = ink(this.svg, '--muted-foreground') || fore

    c.globalAlpha = 0.25
    c.fillStyle = muted
    round(c, r.left, y, width, thick)
    c.globalAlpha = 1
    c.fillStyle = ink(this.svg, '--accent') || fore
    round(c, r.left, y, Math.max(thick, width * done), thick)

    c.font = `400 ${small}px ${FAMILY}`
    c.fillStyle = muted
    c.textAlign = 'left'
    c.fillText(stamp(this.at.ts), r.left, y + thick + Math.round(small * 1.7))
    c.textAlign = 'right'
    c.fillText(
      `${(this.at.at + 1).toLocaleString()} / ${this.at.of.toLocaleString()}`,
      r.right,
      y + thick + Math.round(small * 1.7),
    )
    c.textAlign = 'left'
    // The byline is not drawn here any more: it is pinned to the foot of the column, under
    // the key rather than above it. See `signature`.
  }
}

/** Where the playhead stands in the commits being exported. */
interface Playhead {
  /** Position in the list, `-1` for the opening state that precedes it. */
  at: number
  /** How many commits the export covers. */
  of: number
  /** The commit's own date, seconds since the epoch, or null before the window. */
  ts: number | null
}

/** A rounded bar. The caps matter at this thickness: a square-ended two-pixel rule reads as
 *  a hairline crack in the ground rather than as a measure of anything. */
function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = h / 2
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
  c.fill()
}

/** A commit's date, or what to say instead. The machine's own format, the way the log beside
 *  the map does it — with the year, because a replay routinely spans several. */
function stamp(ts: number | null): string {
  if (ts === null) return 'before this history'
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
  return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
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
   *  scrub. `raster` is copying that picture out at export size. `draw` is the creature
   *  moved on one frame and laid over it. `encode` is the frame going to H.264. */
  stage: 'fetch' | 'fold' | 'raster' | 'draw' | 'encode'
  /** Mean milliseconds per stage. `fetch`, `fold` and `raster` are over the frames the
   *  playhead moved for — every other frame skips them, which is the point of them; `draw`
   *  and `encode` are over every frame, because every frame pays both. */
  cost: { fetch: number; fold: number; raster: number; draw: number; encode: number }
  /** Seconds left at the rate so far, or null before there is a rate. */
  left: number | null
}

export interface Recording {
  /** The commits in scope, as `HistoryBar` addresses them. */
  frames: number[]
  /** Seconds the finished movie should run for. */
  seconds: number
  /** The frame, in pixels. 16:9 — see `ASPECT`; the map is drawn into the square part of
   *  it and the caption into what is left. */
  width: number
  height: number
  /** The repo as the world knows it — `owner/name` where there is a remote. */
  title: string
  /** The key drawn in the caption column, asked for again at every commit — see `MovieKey`.
   *
   *  **A function rather than a value, because the key is not a constant.** On screen it is
   *  recomputed per frame: a replay's cast grows as the story runs, so the names beside the
   *  map at commit 900 are not the names at commit 40, and `+N more` moves with them. Taken
   *  once at the start, a movie would carry the key of whatever frame the export dialog
   *  happened to open on and be wrong about every other one — most visibly at the beginning,
   *  where a film of a repo's first commits would name people who had not arrived yet.
   *
   *  Called on rebuild, which is per COMMIT rather than per frame: the base canvas is only
   *  redrawn when the playhead moves to a new commit, and the key is drawn into it. */
  legend?: (() => MovieKey | null) | null
  /** The directory the replay is scoped to, or `''` for the whole repo. Set on its own line
   *  under the repo, because a movie of one subtree is a different film from a movie of the
   *  repo and the caption is where that gets said. */
  scope: string
  /** When a commit landed, in seconds since the epoch, or null where the story cannot say —
   *  the opening state stands before the window and has no date of its own. Drives the
   *  timeline under the caption. */
  dateOf: (real: number) => number | null
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
  /** Which codec the preflight settled on, as soon as it is known — see `CODECS`. The file
   *  is an `.mp4` either way, but where it will play is not the same answer, and that is the
   *  person's business rather than ours to absorb. */
  onCodec?: (codec: Codec) => void
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
function settings(quality: InstanceType<typeof import('mediabunny').Quality>, codec: Codec) {
  return { codec, quality, latencyMode: 'realtime' as const }
}

/**
 * The codecs an export will try, in the order it tries them.
 *
 * **H.264 first because it plays everywhere, H.265 because H.264 cannot reach the top of
 * the ladder.** The hardware limit is a count of SAMPLES, not a width: VideoToolbox's H.264
 * encoder stops around 8.9 million luma samples, which is fine for the 16:9 shapes the
 * number was written for — 4096 × 2304 is 9.4M and gets refused, 3840 × 2160 is 8.3M and
 * does not — and was brutal for the square frames this used to write, where it landed at
 * about 2985 a side: 2160² passed, 3072² would not have, and 4000² was 16 million samples
 * and never had a chance. Going 16:9 bought the top of the ladder back — every size on
 * offer now encodes as H.264 on this machine — and the fallback stays, because the limit is
 * the encoder's and not ours to assume about somebody else's.
 *
 * The fallback is stated rather than silent: where a file will play is the person's
 * business, and an `.mp4` that turns out to be H.265 is a different thing to hand somebody
 * than one that is not.
 */
const CODECS = ['avc', 'hevc'] as const
export type Codec = (typeof CODECS)[number]

/** What to call a codec where somebody reads it. */
export const CODEC_NAME: Record<Codec, string> = { avc: 'H.264', hevc: 'H.265' }

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
type Deps = {
  BufferTarget: typeof import('mediabunny').BufferTarget
  CanvasSource: typeof import('mediabunny').CanvasSource
  Mp4OutputFormat: typeof import('mediabunny').Mp4OutputFormat
  Output: typeof import('mediabunny').Output
}

/** Ten blank frames through one codec. Resolves if it will take them, throws if it will not
 *  — and the reason is never shown, because the caller has another codec to try. */
async function probe(
  width: number,
  height: number,
  encoding: ReturnType<typeof settings>,
  deps: Deps,
) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This machine gave no 2D canvas to draw the frames on.')
  ctx.fillStyle = background()
  ctx.fillRect(0, 0, width, height)

  const output = new deps.Output({
    format: new deps.Mp4OutputFormat(),
    target: new deps.BufferTarget(),
  })
  const source = new deps.CanvasSource(canvas, encoding)
  output.addVideoTrack(source, { frameRate: FPS })
  const slow = `${CODEC_NAME[encoding.codec]} did not answer at ${width} × ${height}.`
  try {
    await within(output.start(), PREFLIGHT_LIMIT, slow)
    for (let f = 0; f < 10; f++) {
      await within(source.add(f / FPS, 1 / FPS), PREFLIGHT_LIMIT, slow)
    }
    await within(output.finalize(), PREFLIGHT_LIMIT, slow)
  } finally {
    // Whatever it managed is thrown away; the point was the answer, not the file. Cancelling
    // a finalized output is not an error worth reporting over anything.
    await output.cancel().catch(() => {})
  }
}

/**
 * The first codec that will actually encode at this size.
 *
 * The refusal it reports is the app's own sentence and never the encoder's. `canEncodeVideo`
 * said yes to a 4000² H.264 configuration this machine then produced not one packet from,
 * and what reached the person was WebCodecs' own words — a paragraph about "this browser"
 * naming a profile string and a bitrate, in an app that is not a browser and had four
 * choices it could have offered instead.
 */
async function preflight(
  width: number,
  height: number,
  quality: InstanceType<typeof import('mediabunny').Quality>,
  deps: Deps,
): Promise<ReturnType<typeof settings>> {
  for (const codec of CODECS) {
    const encoding = settings(quality, codec)
    try {
      await probe(width, height, encoding, deps)
      return encoding
    } catch {
      // Its own answer is not news: the next codec exists precisely for the sizes this one
      // refuses, and only the last failure is worth a person's attention.
    }
  }
  const tried = CODECS.map((c) => CODEC_NAME[c]).join(' or ')
  throw new Error(
    `This machine will not encode ${tried} at ${width} × ${height}. Try a smaller resolution.`,
  )
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
  const { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality } =
    await import('mediabunny')

  // **Asked of the encoder, not about it, and asked of each codec in turn.** See `preflight`.
  const encoding = await preflight(
    o.width,
    o.height,
    new Quality({ quality: 'high', preferBitrate: true }),
    { BufferTarget, CanvasSource, Mp4OutputFormat, Output },
  )
  o.onCodec?.(encoding.codec)

  // **Asked for before the caption is measured, not just before it is drawn.** The face is
  // inlined into the SVG for the map's own labels, but the caption is Canvas2D, which reads
  // the document's fonts — and a face the document has not loaded yet measures and draws in
  // the fallback stack. Loading it is idempotent and the app is already using it; this is
  // the guarantee, not the fetch.
  await Promise.all([
    document.fonts.load(`700 100px ${FAMILY}`),
    document.fonts.load(`400 100px ${FAMILY}`),
  ]).catch(() => {})

  const shot = new Shot(
    svg,
    o.width,
    o.height,
    background(svg),
    (await faceCss()) + varCss(svg),
    o.title,
    o.scope,
    o.legend ?? (() => null),
  )
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(shot.target, encoding)
  output.addVideoTrack(source, { frameRate: FPS })
  await output.start()

  // **The creature comes off wall-clock time for the duration.** An export is not a realtime
  // capture, so a creature left on its own loop plays as fast as the machine renders — see
  // `mascotClock`. Held here and released in the `finally` below, whatever happens.
  const clock = mascotClock()
  const driving = clock?.hold() ?? false

  const last = o.frames.length - 1
  const total = Math.max(1, Math.round(o.seconds * FPS))
  // The playhead's own -1: the opening state, before the first commit in scope lands. A
  // replay that starts one commit in has thrown away the only frame that shows what was
  // already there.
  let shown = Number.NaN
  // Summed rather than sampled: a mean over every frame so far is steadier than the last
  // one, and the thing being estimated — how long the rest takes — is an average anyway.
  const spent = { fetch: 0, fold: 0, raster: 0, draw: 0, encode: 0 }
  let drawn = 0
  const report = (done: number, stage: Tick['stage']) => {
    const cost = {
      fetch: drawn > 0 ? spent.fetch / drawn : 0,
      fold: drawn > 0 ? spent.fold / drawn : 0,
      raster: drawn > 0 ? spent.raster / drawn : 0,
      draw: done > 0 ? spent.draw / done : 0,
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
              (cost.encode + cost.draw + (drawn / done) * (cost.fetch + cost.fold + cost.raster))) /
            1000
          : null,
    })
  }

  try {
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
        await shot.draw({ at: pos, of: o.frames.length, ts: o.dateOf(real) })
        spent.fetch += tf - t0
        spent.fold += t1 - tf
        spent.raster += performance.now() - t1
        drawn += 1
        shown = real
      }
      if (o.cancelled()) throw new Error(CANCELLED)
      // One frame of the FILE, not one frame of this machine. Stepped even on the frames the
      // map did not change for — those are most of them, and they are what the creature is
      // moving through.
      report(f, 'draw')
      const t3 = performance.now()
      if (driving) clock?.step(1000 / FPS)
      shot.frame()
      spent.draw += performance.now() - t3
      report(f, 'encode')
      const t2 = performance.now()
      await within(
        source.add(f / FPS, 1 / FPS),
        ENCODE_LIMIT,
        `The encoder stopped accepting frames at ${o.width} × ${o.height}, ${f} frames in. Try a smaller resolution.`,
      )
      spent.encode += performance.now() - t2
      report(f + 1, 'encode')
    }
  } finally {
    // Its own loop back, on every path out of here — a cancelled export must not leave a
    // frozen creature in the hub.
    if (driving) clock?.release()
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
