/**
 * A PDF of whole-page pictures, written by hand.
 *
 * **Every page is one JPEG and nothing else, which is what makes the format this small.** The
 * report draws each page on a canvas — see `report.ts` for why the text is pixels rather than
 * glyphs — so what a page needs from PDF is an image XObject, a content stream that paints it
 * across the MediaBox, and the cross-reference table that says where each object starts. JPEG
 * is the one raster PDF carries without any re-encoding (`/DCTDecode` is the file's own bytes),
 * so there is no compression code here either.
 *
 * **Not a dependency, because the whole of it is this file.** A PDF library is hundreds of
 * kilobytes for fonts, vector paths and forms, none of which a page of pixels asks for; the part
 * that is easy to get wrong here — byte offsets — is exactly what `just pdf-check` pins.
 */

/** One page: its picture, and how big the paper is. */
export interface PdfPage {
  /** The page as a baseline JPEG, RGB. */
  jpeg: Uint8Array
  /** The picture's own size in pixels. */
  width: number
  height: number
  /** The paper, in PostScript points (1/72 in). The picture is stretched to it exactly, so the
   *  pixel aspect has to match or the page comes out distorted — `report.ts` sizes both from
   *  one paper. */
  pageWidth: number
  pageHeight: number
  /** What the bookmark for this page says, or nothing for a page with no bookmark. */
  title?: string
}

export interface PdfInfo {
  title: string
  /** When it was made. Taken rather than read from the clock, so the check can pin bytes. */
  created: Date
}

const enc = new TextEncoder()

/** A PDF text string. Literal where it is plain ASCII, UTF-16BE with a byte-order mark where it
 *  is not — a repo or an author name in any other script is an ordinary title, and PDFDocEncoding
 *  cannot hold it. */
export function pdfString(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return `(${s.replace(/([\\()])/g, '\\$1')})`
  let hex = 'FEFF'
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  return `<${hex}>`
}

/** `D:YYYYMMDDHHmmSSZ`, in UTC so the stamp does not need an offset spelled out. */
function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

/** Points to two places, trimmed — a MediaBox of `612.0000000001` is legal and ugly. */
function num(n: number): string {
  return String(Math.round(n * 100) / 100)
}

export function writePdf(pages: PdfPage[], info: PdfInfo): Uint8Array {
  if (pages.length === 0) throw new Error('A PDF needs at least one page.')

  // **Numbered before anything is written**, because objects refer forward: the catalog names
  // the page tree, the tree names its pages, and a page names the tree back. 1 catalog, 2 page
  // tree, 3 info, then three per page, then the outline if any page has a title.
  const CATALOG = 1
  const TREE = 2
  const INFO = 3
  const pageObj = (i: number) => 4 + i * 3
  const contentObj = (i: number) => 5 + i * 3
  const imageObj = (i: number) => 6 + i * 3
  const marked = pages.map((p, i) => ({ p, i })).filter(({ p }) => p.title)
  const OUTLINE = 4 + pages.length * 3
  const itemObj = (k: number) => OUTLINE + 1 + k
  const count = marked.length > 0 ? OUTLINE + marked.length : OUTLINE - 1

  const chunks: Uint8Array[] = []
  const offsets = new Array<number>(count + 1).fill(0)
  let at = 0
  const put = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b
    chunks.push(bytes)
    at += bytes.length
  }
  const obj = (n: number, body: string) => {
    offsets[n] = at
    put(`${n} 0 obj\n${body}\nendobj\n`)
  }
  const stream = (n: number, dict: string, data: Uint8Array) => {
    offsets[n] = at
    put(`${n} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`)
    put(data)
    put('\nendstream\nendobj\n')
  }

  // The second line is four bytes over 127, which is how a PDF says it holds binary — a transfer
  // that guesses "text" from the first bytes would otherwise be free to rewrite line endings
  // inside the JPEGs.
  put('%PDF-1.4\n')
  put(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))

  obj(
    CATALOG,
    marked.length > 0
      ? `<< /Type /Catalog /Pages ${TREE} 0 R /Outlines ${OUTLINE} 0 R /PageMode /UseOutlines >>`
      : `<< /Type /Catalog /Pages ${TREE} 0 R >>`,
  )
  obj(
    TREE,
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  )
  obj(
    INFO,
    `<< /Title ${pdfString(info.title)} /Producer (sanity.monster) /CreationDate (${pdfDate(info.created)}) >>`,
  )

  pages.forEach((p, i) => {
    const w = num(p.pageWidth)
    const h = num(p.pageHeight)
    obj(
      pageObj(i),
      `<< /Type /Page /Parent ${TREE} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>`,
    )
    stream(contentObj(i), '', enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`))
    stream(
      imageObj(i),
      `/Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      p.jpeg,
    )
  })

  if (marked.length > 0) {
    obj(
      OUTLINE,
      `<< /Type /Outlines /First ${itemObj(0)} 0 R /Last ${itemObj(marked.length - 1)} 0 R /Count ${marked.length} >>`,
    )
    marked.forEach(({ p, i }, k) => {
      const links = [
        k > 0 ? `/Prev ${itemObj(k - 1)} 0 R` : '',
        k < marked.length - 1 ? `/Next ${itemObj(k + 1)} 0 R` : '',
      ]
        .filter(Boolean)
        .join(' ')
      obj(
        itemObj(k),
        `<< /Title ${pdfString(p.title!)} /Parent ${OUTLINE} 0 R ${links} /Dest [${pageObj(i)} 0 R /Fit] >>`,
      )
    })
  }

  // Each entry is exactly twenty bytes including its two-byte end of line — the table is read by
  // seeking, not by parsing, so a nineteen-byte entry misplaces every object after it.
  const xref = at
  put(`xref\n0 ${count + 1}\n0000000000 65535 f \n`)
  for (let n = 1; n <= count; n++) put(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  put(`trailer\n<< /Size ${count + 1} /Root ${CATALOG} 0 R /Info ${INFO} 0 R >>\nstartxref\n${xref}\n%%EOF\n`)

  const out = new Uint8Array(at)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}
