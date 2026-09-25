import type { Face } from './fonts'

/**
 * A vector PDF, written by hand: pages of paths and real text, fonts embedded as subsets.
 *
 * **The raster writer's rule carries over: nothing here that a page does not ask for.** A page is
 * content streams of paths, fills, strokes, clips and text; a font is a TrueType subset with the
 * two tables that let a reader search and copy it (`/W` widths and a `ToUnicode` map); images are
 * the one raster a page may still carry. Offsets are counted as the bytes are written, so the
 * cross-reference table is right by construction — `just web-check vector` follows it the way a reader
 * does.
 *
 * **Text is glyph ids, not characters.** A run is shaped once by `Face` and written as the ids it
 * shaped to (`/Identity-H`, two bytes each), with the kerning HarfBuzz applied spelled out as `TJ`
 * adjustments. What a line measured is what it prints.
 */

/** Compresses a stream. zlib format, which is what `/FlateDecode` means. */
export type Deflate = (bytes: Uint8Array) => Promise<Uint8Array>

const enc = new TextEncoder()

/** A number as a content stream wants it: short, and never `1e-7`. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/** A PDF text string: literal for plain ASCII, UTF-16BE with a byte-order mark otherwise. */
export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/([\\()])/g, '\\$1')})`
  let hex = 'FEFF'
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** An image a page draws: RGB samples, with an optional alpha channel as a soft mask. */
export interface PdfImage {
  width: number
  height: number
  /** `width × height × 3` bytes. */
  rgb: Uint8Array
  /** `width × height` bytes, or nothing for an opaque image. */
  alpha?: Uint8Array
}

/** A link on a page: a rectangle in page points (origin bottom-left) and the page it goes to. */
export interface PdfLink {
  rect: [number, number, number, number]
  page: number
}

/** A tiling pattern: one cell's drawing, repeated. The map's stale and fold hatches. */
export interface PdfPattern {
  /** The cell, in pattern space. */
  bbox: [number, number, number, number]
  xstep: number
  ystep: number
  /** Pattern space → page points (origin bottom-left). */
  matrix: [number, number, number, number, number, number]
  ops: string[]
}

export class PdfPage {
  readonly ops: string[] = []
  readonly fonts = new Set<Face>()
  readonly states = new Map<string, string>()
  readonly images = new Map<string, PdfImage>()
  readonly patterns = new Map<string, PdfPattern>()
  readonly links: PdfLink[] = []
  /** What the outline says for this page, if anything. */
  title?: string

  constructor(
    readonly doc: PdfDoc,
    /** In points. */
    readonly width: number,
    readonly height: number,
  ) {}

  /** A graphics state for these entries (`/ca`, `/CA`, `/BM`), named once per page. */
  state(entries: Record<string, string>): string {
    const key = Object.entries(entries)
      .map(([k, v]) => `/${k} ${v}`)
      .join(' ')
    let name = this.states.get(key)
    if (!name) {
      name = `GS${this.states.size}`
      this.states.set(key, name)
    }
    return name
  }

  image(img: PdfImage): string {
    const name = `Im${this.images.size}`
    this.images.set(name, img)
    return name
  }

  /** A pattern, named once per distinct cell and placement. */
  pattern(p: PdfPattern): string {
    const key = JSON.stringify(p)
    for (const [name, known] of this.patterns) if (JSON.stringify(known) === key) return name
    const name = `P${this.patterns.size}`
    this.patterns.set(name, p)
    return name
  }

  /** The resource name a face is set in on every page. */
  fontName(face: Face): string {
    this.fonts.add(face)
    return this.doc.fontName(face)
  }
}

export class PdfDoc {
  readonly pages: PdfPage[] = []
  private readonly faces = new Map<Face, string>()

  page(width: number, height: number): PdfPage {
    const p = new PdfPage(this, width, height)
    this.pages.push(p)
    return p
  }

  /** A page at a known position, for a document drawn out of order — a report's contents page is
   *  drawn last, because it names every other page, and printed third. */
  pageAt(index: number, width: number, height: number): PdfPage {
    const p = new PdfPage(this, width, height)
    this.pages[index] = p
    return p
  }

  fontName(face: Face): string {
    let name = this.faces.get(face)
    if (!name) {
      name = `F${this.faces.size}`
      this.faces.set(face, name)
    }
    return name
  }

  /**
   * The file. `subset` turns a face into the TrueType bytes to embed (see `subsetter`); `deflate`
   * compresses streams, and is async because the webview's `CompressionStream` is.
   */
  async write(o: {
    title: string
    created: Date
    subset: (face: Face) => Uint8Array
    deflate: Deflate
  }): Promise<Uint8Array> {
    if (this.pages.length === 0) throw new Error('A PDF needs at least one page.')
    const bodies: (Uint8Array | string)[] = []
    /** Object numbers are 1-based; `bodies[n - 1]` is object `n`. */
    const reserve = () => {
      bodies.push('')
      return bodies.length
    }
    const set = (n: number, body: string) => {
      bodies[n - 1] = `${n} 0 obj\n${body}\nendobj\n`
    }
    const setStream = async (n: number, dict: string, data: Uint8Array, compress = true) => {
      const packed = compress ? await o.deflate(data) : data
      const head = enc.encode(`${n} 0 obj\n<< ${dict}${compress ? ' /Filter /FlateDecode' : ''} /Length ${packed.length} >>\nstream\n`)
      const tail = enc.encode('\nendstream\nendobj\n')
      const out = new Uint8Array(head.length + packed.length + tail.length)
      out.set(head, 0)
      out.set(packed, head.length)
      out.set(tail, head.length + packed.length)
      bodies[n - 1] = out
    }

    const CATALOG = reserve()
    const TREE = reserve()
    const INFO = reserve()
    const pageObjs = this.pages.map(() => reserve())

    // Fonts, once each, for whatever any page set.
    const fontObj = new Map<Face, number>()
    for (const [face] of this.faces) {
      const type0 = reserve()
      const cid = reserve()
      const desc = reserve()
      const file = reserve()
      const toUni = reserve()
      fontObj.set(face, type0)
      const k = 1000 / face.upem
      const gids = [...face.used.keys()].sort((a, b) => a - b)
      const widths = gids.map((g) => `${g} [${fmt(face.advance(g) * k)}]`).join(' ')
      const base = `${subsetTag(face)}+${face.name}`
      set(type0, `<< /Type /Font /Subtype /Type0 /BaseFont /${base} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${toUni} 0 R >>`)
      set(
        cid,
        `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${base} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /CIDToGIDMap /Identity /DW ${fmt(face.advance(0) * k)} /W [${widths}] >>`,
      )
      const [x0, y0, x1, y1] = face.bbox
      set(
        desc,
        `<< /Type /FontDescriptor /FontName /${base} /Flags 4 /FontBBox [${fmt(x0 * k)} ${fmt(y0 * k)} ${fmt(x1 * k)} ${fmt(y1 * k)}] /ItalicAngle 0 /Ascent ${fmt(face.ascent * k)} /Descent ${fmt(face.descent * k)} /CapHeight ${fmt(face.capHeight * k)} /StemV 80 /FontFile2 ${file} 0 R >>`,
      )
      const bytes = o.subset(face)
      await setStream(file, `/Length1 ${bytes.length}`, bytes)
      await setStream(toUni, '', enc.encode(toUnicode(face)))
    }

    for (let i = 0; i < this.pages.length; i++) {
      const p = this.pages[i]
      const content = reserve()
      await setStream(content, '', enc.encode(p.ops.join('\n')))
      const fonts = [...p.fonts].map((f) => `/${this.fontName(f)} ${fontObj.get(f)} 0 R`).join(' ')
      const states = [...p.states].map(([entries, name]) => `/${name} << /Type /ExtGState ${entries} >>`).join(' ')
      const images: string[] = []
      for (const [name, img] of p.images) {
        const obj = reserve()
        let smask = ''
        if (img.alpha) {
          const m = reserve()
          await setStream(m, `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8`, img.alpha)
          smask = ` /SMask ${m} 0 R`
        }
        await setStream(obj, `/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8${smask}`, img.rgb)
        images.push(`/${name} ${obj} 0 R`)
      }
      const patterns: string[] = []
      for (const [name, pat] of p.patterns) {
        const obj = reserve()
        const [a, b, c, d, e, f] = pat.matrix.map(fmt)
        await setStream(
          obj,
          `/Type /Pattern /PatternType 1 /PaintType 1 /TilingType 1 /BBox [${pat.bbox.map(fmt).join(' ')}] /XStep ${fmt(pat.xstep)} /YStep ${fmt(pat.ystep)} /Matrix [${a} ${b} ${c} ${d} ${e} ${f}] /Resources << /ExtGState << ${states} >> >>`,
          enc.encode(pat.ops.join('\n')),
        )
        patterns.push(`/${name} ${obj} 0 R`)
      }
      const annots = p.links.map((l) => {
        const a = reserve()
        const [x0, y0, x1, y1] = l.rect.map(fmt)
        set(a, `<< /Type /Annot /Subtype /Link /Rect [${x0} ${y0} ${x1} ${y1}] /Border [0 0 0] /Dest [${pageObjs[l.page]} 0 R /Fit] >>`)
        return `${a} 0 R`
      })
      set(
        pageObjs[i],
        `<< /Type /Page /Parent ${TREE} 0 R /MediaBox [0 0 ${fmt(p.width)} ${fmt(p.height)}] /Resources << /Font << ${fonts} >> /ExtGState << ${states} >> /XObject << ${images.join(' ')} >> /Pattern << ${patterns.join(' ')} >> >> /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.join(' ')}]` : ''} >>`,
      )
    }

    const marked = this.pages.map((p, i) => ({ p, i })).filter(({ p }) => p.title)
    let outline = 0
    if (marked.length) {
      outline = reserve()
      const items = marked.map(() => reserve())
      set(outline, `<< /Type /Outlines /First ${items[0]} 0 R /Last ${items[items.length - 1]} 0 R /Count ${items.length} >>`)
      marked.forEach(({ p, i }, k) => {
        const links = [k > 0 ? `/Prev ${items[k - 1]} 0 R` : '', k < items.length - 1 ? `/Next ${items[k + 1]} 0 R` : '']
          .filter(Boolean)
          .join(' ')
        set(items[k], `<< /Title ${pdfString(p.title!)} /Parent ${outline} 0 R ${links} /Dest [${pageObjs[i]} 0 R /Fit] >>`)
      })
    }

    set(CATALOG, `<< /Type /Catalog /Pages ${TREE} 0 R${outline ? ` /Outlines ${outline} 0 R /PageMode /UseOutlines` : ''} >>`)
    set(TREE, `<< /Type /Pages /Kids [${pageObjs.map((n) => `${n} 0 R`).join(' ')}] /Count ${this.pages.length} >>`)
    set(INFO, `<< /Title ${pdfString(o.title)} /Producer (sanity.monster) /CreationDate (${pdfDate(o.created)}) >>`)

    // Serialize, counting offsets as written.
    const chunks: Uint8Array[] = []
    let at = 0
    const put = (b: Uint8Array | string) => {
      const bytes = typeof b === 'string' ? enc.encode(b) : b
      chunks.push(bytes)
      at += bytes.length
    }
    put('%PDF-1.7\n')
    put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
    const offsets: number[] = []
    bodies.forEach((b, i) => {
      offsets[i] = at
      if (b === '') throw new Error(`Object ${i + 1} was reserved and never written.`)
      put(b)
    })
    const xref = at
    put(`xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`)
    for (const off of offsets) put(`${String(off).padStart(10, '0')} 00000 n \n`)
    put(`trailer\n<< /Size ${bodies.length + 1} /Root ${CATALOG} 0 R /Info ${INFO} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
    const out = new Uint8Array(at)
    let o2 = 0
    for (const c of chunks) {
      out.set(c, o2)
      o2 += c.length
    }
    return out
  }
}

/** Six capital letters naming a subset, as the spec asks of an embedded subset's `BaseFont`. */
function subsetTag(face: Face): string {
  let h = 2166136261
  for (const g of face.used.keys()) h = Math.imul(h ^ g, 16777619)
  let s = ''
  for (let i = 0; i < 6; i++) {
    s += String.fromCharCode(65 + ((h >>> (i * 5)) % 26))
  }
  return s
}

/** The CMap that turns glyph ids back into text, for search and copy. */
function toUnicode(face: Face): string {
  const entries = [...face.used].sort((a, b) => a[0] - b[0])
  const hex4 = (n: number) => n.toString(16).padStart(4, '0').toUpperCase()
  const utf16 = (s: string) => [...s].map((ch) => {
    const cp = ch.codePointAt(0)!
    if (cp < 0x10000) return hex4(cp)
    const v = cp - 0x10000
    return hex4(0xd800 + (v >> 10)) + hex4(0xdc00 + (v & 0x3ff))
  }).join('')
  const lines: string[] = []
  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100).filter(([, text]) => text.length > 0)
    if (!chunk.length) continue
    lines.push(`${chunk.length} beginbfchar`)
    for (const [gid, text] of chunk) lines.push(`<${hex4(gid)}> <${utf16(text)}>`)
    lines.push('endbfchar')
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...lines,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n')
}
