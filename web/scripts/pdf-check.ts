/**
 * What a report's PDF has to get right to open at all.
 *
 * `lib/pdf.ts` is written by hand, and the failure it is exposed to is invisible until somebody
 * double-clicks the file: a PDF is read by SEEKING, so an object offset that is one byte out
 * misplaces that object and every one after it, and a viewer either repairs the file quietly or
 * refuses it. Neither is something the window can see. So this checks the arithmetic the way a
 * reader would use it — follow `startxref`, follow every entry, and find the object it names.
 *
 * Run it with `just pdf-check`. Bundled and run like `rim-check`; when poppler's `pdfinfo` is on
 * the machine it is asked too, because a parser we did not write is the better witness.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pdfString, writePdf, type PdfPage } from '../src/lib/pdf'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) {
    console.log(`  ok   ${what}`)
    return
  }
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/** A real 3×2 JPEG, so the image stream is the shape a canvas hands over and `pdfinfo` has
 *  something genuine to open. */
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAA6ADAAQAAAABAAAAAgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAgADAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A9K0XUL+S3umkuZWIvr8ZLseBdSgDr2AwK1/tt5/z3k/76Nc5oX/Htd/9f+of+lctbVegfVS3P//Z',
  ),
  (c) => c.charCodeAt(0),
)

const page = (title?: string): PdfPage => ({
  jpeg: JPEG,
  width: 3,
  height: 2,
  pageWidth: 612,
  pageHeight: 408,
  title,
})

/** Latin-1 so a byte is a character and an offset into the string is an offset into the file. */
const latin = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('')

/** Every structural claim a reader leans on, asked of one file. */
function structure(label: string, bytes: Uint8Array, pages: number, marks: number) {
  const s = latin(bytes)
  console.log(label)
  check('starts with a header', s.startsWith('%PDF-1.4\n'))
  check('ends with %%EOF', s.endsWith('%%EOF\n'))

  const sx = /startxref\n(\d+)\n%%EOF\n$/.exec(s)
  check('has a startxref', sx !== null)
  if (!sx) return
  const xref = Number(sx[1])
  check('startxref lands on the table', s.startsWith('xref\n', xref), s.slice(xref, xref + 12))

  const head = /^xref\n0 (\d+)\n/.exec(s.slice(xref))
  check('the table says how many objects', head !== null)
  if (!head) return
  const size = Number(head[1])
  const table = xref + head[0].length
  check('entry 0 is the free head', s.slice(table, table + 20) === '0000000000 65535 f \n')
  let landed = 0
  for (let n = 1; n < size; n++) {
    const entry = s.slice(table + n * 20, table + (n + 1) * 20)
    const m = /^(\d{10}) 00000 n \n$/.exec(entry)
    if (m && s.startsWith(`${n} 0 obj\n`, Number(m[1]))) landed += 1
    else check(`entry ${n} lands on object ${n}`, false, entry)
  }
  check(`all ${size - 1} entries land on their objects`, landed === size - 1)
  check('the trailer size matches the table', s.includes(`/Size ${size} `))

  const count = /\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/.exec(s)
  check(`the page tree counts ${pages}`, Number(count?.[1]) === pages, count?.[1])
  check(`there are ${pages} pages`, (s.match(/\/Type \/Page /g) ?? []).length === pages)

  // Every stream's /Length has to be its real length: a reader takes the number and skips.
  const streams = [...s.matchAll(/\/Length (\d+) >>\nstream\n/g)]
  const honest = streams.every((m) => {
    const start = m.index! + m[0].length
    return s.startsWith('\nendstream', start + Number(m[1]))
  })
  check(`all ${streams.length} stream lengths are honest`, honest)

  const outline = /\/Type \/Outlines .*\/Count (\d+)/.exec(s)
  if (marks === 0) check('no outline when nothing has a title', outline === null)
  else check(`the outline counts ${marks}`, Number(outline?.[1]) === marks, outline?.[1])

  const info = spawnInfo(bytes)
  if (info === null) console.log('  --   pdfinfo not installed, skipped')
  else check(`pdfinfo reads ${pages} pages`, /Pages:\s+(\d+)/.exec(info)?.[1] === String(pages), info)
}

function spawnInfo(bytes: Uint8Array): string | null {
  const dir = mkdtempSync(join(tmpdir(), 'pdf-check-'))
  const path = join(dir, 'out.pdf')
  writeFileSync(path, bytes)
  try {
    // `-isvalid` is not portable across poppler versions; a non-zero exit or a syntax warning on
    // stderr is what a broken table produces, so both are folded into the answer.
    return execFileSync('pdfinfo', [path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    const err = e as { code?: string; stderr?: string; stdout?: string }
    if (err.code === 'ENOENT') return null
    return `${err.stdout ?? ''}${err.stderr ?? ''}`
  }
}

const when = new Date(Date.UTC(2026, 8, 10, 12, 0, 0))

structure(
  'three pages, bookmarked',
  writePdf([page('Contents'), page('Complexity'), page('Findings')], { title: 'a/b', created: when }),
  3,
  3,
)
structure('one page, no bookmark', writePdf([page()], { title: 'x', created: when }), 1, 0)
structure(
  'bookmarks on some pages only',
  writePdf([page('Contents'), page(), page('Findings (continued)')], { title: 'x', created: when }),
  3,
  2,
)

console.log('strings')
check('plain ASCII stays literal', pdfString('ceph/ceph') === '(ceph/ceph)')
check('parentheses and backslashes are escaped', pdfString('a(b)\\c') === '(a\\(b\\)\\\\c)')
check('anything else is UTF-16BE with a BOM', pdfString('René') === '<FEFF00520065006E00E9>')

let threw = false
try {
  writePdf([], { title: 'x', created: when })
} catch {
  threw = true
}
check('refuses an empty document', threw)

if (failed > 0) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
