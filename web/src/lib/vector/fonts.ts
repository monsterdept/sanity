import * as hb from 'harfbuzzjs'

/**
 * The faces a vector page sets its type in: measured by HarfBuzz, and subset into the file.
 *
 * **One source for both the width and the glyphs.** A canvas measured in whatever face the
 * webview had loaded and drew in whatever it fell back to — one report page came out in the
 * fallback face while its lines had been measured in the brand one. Here a string is shaped once,
 * by the same font file that is embedded, so a line's measured width is the width it prints at, in
 * a window or out of one.
 *
 * **Embedded as a subset that keeps glyph ids** (`RETAIN_GIDS`): a shaped glyph's id is the CID
 * the page writes, so nothing has to be renumbered between measuring a line and writing it.
 */

/** One face as the page knows it. */
export interface FaceFile {
  /** What a run asks for: `sans`, `sans-bold`, `mono`, `mono-bold`. */
  key: string
  /** A PostScript name for the PDF: letters, digits and hyphens. */
  name: string
  bytes: Uint8Array
}

export interface Shaped {
  gids: number[]
  /** Advances in font units, kerning applied. */
  advances: number[]
  /** Where each glyph's text starts, as UTF-16 offsets into the string. */
  clusters: number[]
  /** The whole run, in font units. */
  width: number
}

interface Tables {
  upem: number
  ascent: number
  descent: number
  capHeight: number
  bbox: [number, number, number, number]
  /** Unkerned advance per glyph id, from `hmtx`. */
  hAdvance: Uint16Array
  /** Left side bearing per glyph id, from `hmtx`. */
  lsb: Int16Array
  numGlyphs: number
}

function tables(bytes: Uint8Array): Tables {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const count = v.getUint16(4)
  const at = new Map<string, number>()
  for (let i = 0; i < count; i++) {
    const rec = 12 + 16 * i
    const tag = String.fromCharCode(bytes[rec], bytes[rec + 1], bytes[rec + 2], bytes[rec + 3])
    at.set(tag, v.getUint32(rec + 8))
  }
  const need = (t: string) => {
    const o = at.get(t)
    if (o === undefined) throw new Error(`This font has no ${t} table.`)
    return o
  }
  const head = need('head')
  const hhea = need('hhea')
  const maxp = need('maxp')
  const hmtx = need('hmtx')
  const numGlyphs = v.getUint16(maxp + 4)
  const metrics = v.getUint16(hhea + 34)
  const hAdvance = new Uint16Array(numGlyphs)
  const lsb = new Int16Array(numGlyphs)
  let last = 0
  for (let g = 0; g < numGlyphs; g++) {
    if (g < metrics) {
      last = v.getUint16(hmtx + g * 4)
      lsb[g] = v.getInt16(hmtx + g * 4 + 2)
    } else {
      lsb[g] = v.getInt16(hmtx + metrics * 4 + (g - metrics) * 2)
    }
    hAdvance[g] = last
  }
  const os2 = at.get('OS/2')
  const capHeight = os2 !== undefined && v.getUint16(os2) >= 2 ? v.getInt16(os2 + 88) : Math.round(v.getInt16(hhea + 4) * 0.7)
  return {
    upem: v.getUint16(head + 18),
    ascent: v.getInt16(hhea + 4),
    descent: v.getInt16(hhea + 6),
    capHeight,
    bbox: [v.getInt16(head + 36), v.getInt16(head + 38), v.getInt16(head + 40), v.getInt16(head + 42)],
    hAdvance,
    lsb,
    numGlyphs,
  }
}

export class Face {
  readonly key: string
  readonly name: string
  readonly bytes: Uint8Array
  readonly upem: number
  readonly ascent: number
  readonly descent: number
  readonly capHeight: number
  readonly bbox: [number, number, number, number]
  /** Every glyph a page has set, with the text it stands for — the `ToUnicode` map. */
  readonly used = new Map<number, string>()
  private readonly t: Tables
  private readonly font: hb.Font
  private readonly memo = new Map<string, Shaped>()

  constructor(file: FaceFile) {
    this.key = file.key
    this.name = file.name
    this.bytes = file.bytes
    this.t = tables(file.bytes)
    this.upem = this.t.upem
    this.ascent = this.t.ascent
    this.descent = this.t.descent
    this.capHeight = this.t.capHeight
    this.bbox = this.t.bbox
    // **The face's own bytes, copied out.** `slice` on a node `Buffer` is `subarray` — a VIEW —
    // so `.buffer` is whatever allocation it sits in, and node pools small files: a 32KB font read
    // at offset 31,768 of a 64KB pool handed HarfBuzz the pool, which starts inside some other
    // file. Every glyph came back `.notdef`, every code span in the PDFs printed as an empty box,
    // and the one face large enough to get an allocation of its own was fine — which is what hid
    // it. `new Uint8Array(bytes)` copies the contents, so the blob is the font and nothing else.
    const copy = new Uint8Array(file.bytes).buffer
    this.font = new hb.Font(new hb.Face(new hb.Blob(copy)))
  }

  shape(text: string): Shaped {
    const known = this.memo.get(text)
    if (known) return known
    const buf = new hb.Buffer()
    buf.addText(text)
    buf.guessSegmentProperties()
    hb.shape(this.font, buf)
    const infos = buf.getGlyphInfos()
    const pos = buf.getGlyphPositions()
    const out: Shaped = { gids: [], advances: [], clusters: [], width: 0 }
    infos.forEach((g, i) => {
      out.gids.push(g.codepoint)
      out.advances.push(pos[i].xAdvance)
      out.clusters.push(g.cluster)
      out.width += pos[i].xAdvance
    })
    this.memo.set(text, out)
    return out
  }

  /** The width of `text` at `size`, in whatever unit `size` is in. */
  measure(text: string, size: number): number {
    return (this.shape(text).width / this.upem) * size
  }

  /** True where some character has no glyph in this face. */
  lacks(text: string): boolean {
    return this.shape(text).gids.some((g) => g === 0)
  }

  /** A glyph's unkerned advance, in font units — what the PDF's `/W` array says. */
  advance(gid: number): number {
    return this.t.hAdvance[gid] ?? 0
  }

  /** The ink offset of a string's first glyph at `size` — see `Sheet.bearing`. */
  bearing(text: string, size: number): number {
    const s = this.shape(text.trimStart())
    return s.gids.length ? -(this.t.lsb[s.gids[0]] / this.upem) * size : 0
  }

  /** Record the glyphs of a shaped run as set, with the text each stands for. */
  note(text: string, s: Shaped) {
    s.gids.forEach((g, i) => {
      if (this.used.has(g)) return
      const from = s.clusters[i]
      const next = s.clusters.find((c) => c > from) ?? text.length
      this.used.set(g, text.slice(from, next))
    })
  }
}

/* ── Subsetting ────────────────────────────────────────────────────────── */

const HB_MEMORY_MODE_WRITABLE = 2
const HB_SUBSET_SETS_DROP_TABLE_TAG = 3
const HB_SUBSET_FLAGS_NO_HINTING = 0x1
const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x2

const tag = (s: string) => [...s].reduce((a, c) => (a << 8) + c.charCodeAt(0), 0) >>> 0

type SubsetExports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory }

/**
 * A subsetter over HarfBuzz's own `hb-subset`, from the wasm `harfbuzzjs` ships beside its shaper.
 * The bytes are handed in because where they live differs: a file under `node_modules` for the
 * headless renderer, an asset URL for the window.
 */
export async function subsetter(wasm: Uint8Array): Promise<(face: Face) => Uint8Array> {
  const module = await WebAssembly.compile(wasm.slice().buffer as ArrayBuffer)
  const instance = await WebAssembly.instantiate(module)
  const x = instance.exports as unknown as SubsetExports
  x._initialize?.()
  return (face: Face) => {
    const input = x.hb_subset_input_create_or_fail()
    if (!input) throw new Error('HarfBuzz could not start a subset.')
    const src = face.bytes
    const ptr = x.malloc(src.byteLength)
    new Uint8Array(x.memory.buffer).set(src, ptr)
    const blob = x.hb_blob_create(ptr, src.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0)
    const hbFace = x.hb_face_create(blob, 0)
    x.hb_blob_destroy(blob)
    try {
      const glyphs = x.hb_subset_input_glyph_set(input)
      x.hb_set_add(glyphs, 0)
      for (const g of face.used.keys()) x.hb_set_add(glyphs, g)
      // A PDF draws glyphs by id and maps them to text itself, so the shaping and naming tables
      // are dead weight in the file.
      const drop = x.hb_subset_input_set(input, HB_SUBSET_SETS_DROP_TABLE_TAG)
      for (const t of ['GSUB', 'GPOS', 'GDEF', 'BASE', 'JSTF', 'MATH', 'kern', 'DSIG', 'vhea', 'vmtx', 'VORG', 'COLR', 'CPAL', 'SVG ', 'sbix', 'CBDT', 'CBLC']) {
        x.hb_set_add(drop, tag(t))
      }
      x.hb_subset_input_set_flags(input, x.hb_subset_input_get_flags(input) | HB_SUBSET_FLAGS_RETAIN_GIDS | HB_SUBSET_FLAGS_NO_HINTING)
      const out = x.hb_subset_or_fail(hbFace, input)
      if (!out) throw new Error(`HarfBuzz could not subset ${face.name}.`)
      const outBlob = x.hb_face_reference_blob(out)
      const data = x.hb_blob_get_data(outBlob, 0)
      const len = x.hb_blob_get_length(outBlob)
      const bytes = new Uint8Array(x.memory.buffer, data, len).slice()
      x.hb_blob_destroy(outBlob)
      x.hb_face_destroy(out)
      return bytes
    } finally {
      x.hb_face_destroy(hbFace)
      x.hb_subset_input_destroy(input)
      x.free(ptr)
    }
  }
}
