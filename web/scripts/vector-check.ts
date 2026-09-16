/**
 * What the vector PDF writer has to get right: a file that opens, text a reader can find, fonts
 * embedded, and a page that looks like what was drawn.
 *
 * Draws one page through every part of `Surface` and the SVG translator, writes it, and asks
 * poppler — `pdfinfo`, `pdffonts`, `pdftotext` — about the result, because a parser we did not
 * write is the better witness. With `VECTOR_OUT` set, the PDF is left there to look at.
 *
 * Run with `just vector-check`.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { MONO } from '../src/lib/monoFaces'
import { rootVars } from '../src/lib/vector/color'
import { PdfDoc } from '../src/lib/vector/doc'
import { Face, subsetter } from '../src/lib/vector/fonts'
import { drawSvg, parseSvg } from '../src/lib/vector/svg'
import { Surface, VPath } from '../src/lib/vector/surface'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) console.log(`  ok   ${what}`)
  else {
    failed += 1
    console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw).slice(0, 300)}`}`)
  }
}

const font = (key: string, file: string, name: string) => new Face({ key, name, bytes: readFileSync(join('public/fonts/pdf', file)) })
const fonts = {
  sans: font('sans', 'LINESeedJP-Regular.ttf', 'LINESeedJP-Regular'),
  sansBold: font('sans-bold', 'LINESeedJP-Bold.ttf', 'LINESeedJP-Bold'),
  mono: new Face({ key: 'mono', name: `${MONO.postscript}-Regular`, bytes: readFileSync(`public/fonts/mono/${MONO.id}-400.ttf`) }),
  monoBold: new Face({ key: 'mono-bold', name: `${MONO.postscript}-Bold`, bytes: readFileSync(`public/fonts/mono/${MONO.id}-700.ttf`) }),
}
const vars = rootVars(readFileSync('src/index.css', 'utf8'))
console.log('colors')
check('the stylesheet declares --foreground', vars.has('--foreground'), [...vars.keys()].slice(0, 5))

const U = 2 // canvas pixels per point, so the check exercises the scale
const doc = new PdfDoc()
const page = doc.page(612, 792)
page.title = 'Vector check'
const c = new Surface(page, fonts, vars, U)

c.fillStyle = '#ffffff'
c.fillRect(0, 0, 612 * U, 792 * U)
c.font = `700 ${22 * U}px 'LINE Seed JP'`
c.fillStyle = 'var(--foreground)'
c.fillText('Complexity, continued', 42 * U, 80 * U)
c.font = `400 ${9 * U}px 'LINE Seed JP'`
c.fillText('Of the 60,577 function lines, 27% lie in bodies rated very high.', 42 * U, 110 * U)
c.font = `italic 400 ${9 * U}px 'LINE Seed JP'`
c.fillText('newest line', 42 * U, 126 * U)
c.font = `400 ${8 * U}px "Sanity Mono"`
c.fillText('web/src/lib/report.ts#pour', 42 * U, 142 * U)
c.textAlign = 'right'
c.fillText('15.0×', 570 * U, 142 * U)
c.textAlign = 'left'
const w = c.measureText('web/src/lib/report.ts#pour').width
check('measureText answers in canvas pixels', w > 100 * U && w < 200 * U, w / U)

// A pill, a dashed outline, a clip with blend modes: `pill`, `drawMarks` and `highlight`.
c.beginPath()
c.moveTo(60 * U, 170 * U)
c.arcTo(160 * U, 170 * U, 160 * U, 190 * U, 10 * U)
c.arcTo(160 * U, 190 * U, 60 * U, 190 * U, 10 * U)
c.arcTo(60 * U, 190 * U, 60 * U, 170 * U, 10 * U)
c.arcTo(60 * U, 170 * U, 160 * U, 170 * U, 10 * U)
c.closePath()
c.fillStyle = 'var(--accent)'
c.fill()
c.save()
c.setLineDash([3 * U, 2.4 * U])
c.strokeStyle = 'var(--foreground)'
c.lineWidth = 1.2 * U
c.strokeRect(200 * U, 165 * U, 120 * U, 30 * U)
c.restore()
c.save()
const clip = new VPath()
clip.rect(360 * U, 160 * U, 80 * U, 40 * U)
c.clip(clip)
c.globalCompositeOperation = 'multiply'
c.globalAlpha = 0.45
c.fillStyle = 'var(--accent)'
c.fillRect(340 * U, 150 * U, 200 * U, 60 * U)
c.restore()

// A map-shaped SVG: arc wedges, a hatch pattern, a label along an arc, a radial label, opacity.
const svg = parseSvg(`<svg data-sunburst="" viewBox="-360 -360 720 720">
<defs><pattern id="stale-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--foreground)" stroke-width="1.5" stroke-opacity="0.5"/></pattern></defs>
<g data-rings="">
<path d="M 0 -300 A 300 300 0 0 1 300 0 L 150 0 A 150 150 0 0 0 0 -150 Z" fill="var(--heat-4)" stroke="var(--background)" stroke-width="2"/>
<path d="M 300 0 A 300 300 0 0 1 0 300 L 0 150 A 150 150 0 0 0 150 0 Z" fill="url(#stale-hatch)"/>
<path id="arc-1" d="M -212 -212 A 300 300 0 0 1 212 -212" fill="none"/>
<text font-size="22" font-weight="400" style="font-family:'LINE Seed JP';letter-spacing:-0.04em" fill="var(--foreground)"><textPath href="#arc-1" startOffset="50%" text-anchor="middle">components</textPath></text>
<g opacity="0.8" transform="rotate(200) translate(0 -250) rotate(90)"><text text-anchor="middle" dominant-baseline="central" font-size="14" fill="#1a1a1a">parse.rs</text></g>
<circle r="80" fill="var(--card)" stroke="var(--border)"/>
<text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="700" fill="var(--foreground)">sanity</text>
</g></svg>`)
drawSvg(c, svg, { x: 106 * U, y: 240 * U, side: 400 * U, vars })

const out = await doc.write({
  title: 'vector check',
  created: new Date(Date.UTC(2026, 8, 15)),
  subset: await subsetter(readFileSync('node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm')),
  deflate: async (b) => deflateSync(b),
})
// **The arithmetic a reader seeks by**, checked the way a reader uses it: a PDF is read by
// seeking, so an offset one byte out misplaces that object and every one after it, and a viewer
// either repairs the file quietly or refuses it.
console.log('structure')
const bytes = Array.from(out, (b) => String.fromCharCode(b)).join('')
check('starts with a header', bytes.startsWith('%PDF-1.7\n'))
check('ends with %%EOF', bytes.endsWith('%%EOF\n'))
const sx = /startxref\n(\d+)\n%%EOF\n$/.exec(bytes)
check('has a startxref', sx !== null)
if (sx) {
  const xref = Number(sx[1])
  check('startxref lands on the table', bytes.startsWith('xref\n', xref), bytes.slice(xref, xref + 12))
  const head = /^xref\n0 (\d+)\n/.exec(bytes.slice(xref))
  check('the table says how many objects', head !== null)
  if (head) {
    const size = Number(head[1])
    const table = xref + head[0].length
    check('entry 0 is the free head', bytes.slice(table, table + 20) === '0000000000 65535 f \n')
    let landed = 0
    for (let n = 1; n < size; n++) {
      const entry = bytes.slice(table + n * 20, table + (n + 1) * 20)
      const m = /^(\d{10}) 00000 n \n$/.exec(entry)
      if (m && bytes.startsWith(`${n} 0 obj\n`, Number(m[1]))) landed += 1
      else check(`entry ${n} lands on object ${n}`, false, entry)
    }
    check(`all ${size - 1} entries land on their objects`, landed === size - 1)
    check('the trailer size matches the table', bytes.includes(`/Size ${size} `))
  }
}
const streams = [...bytes.matchAll(/\/Length (\d+) >>\nstream\n/g)]
check(`all ${streams.length} stream lengths are honest`, streams.length > 0 && streams.every((m) => bytes.startsWith('\nendstream', m.index! + m[0].length + Number(m[1]))))
check('the page tree counts 1', /\/Type \/Pages \/Kids \[[^\]]*\] \/Count 1 /.test(bytes))
check('the outline counts the one titled page', /\/Type \/Outlines .*\/Count 1 /.test(bytes))

const dir = process.env.VECTOR_OUT ?? mkdtempSync(join(tmpdir(), 'vector-check-'))
const path = join(dir, 'vector-check.pdf')
writeFileSync(path, out)
console.log(`file (${out.length.toLocaleString()} bytes) at ${path}`)

const run = (cmd: string, args: string[]) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    const err = e as { code?: string; stdout?: string; stderr?: string }
    if (err.code === 'ENOENT') return null
    return `ERROR ${err.stdout ?? ''}${err.stderr ?? ''}`
  }
}
const info = run('pdfinfo', [path])
if (info === null) console.log('  --   poppler not installed, skipped')
else {
  check('pdfinfo reads one page without complaint', /Pages:\s+1/.test(info) && !/Syntax (Error|Warning)/.test(info), info)
  const f = run('pdffonts', [path]) ?? ''
  check('every font is embedded as a subset', (f.match(/CID TrueType/g) ?? []).length >= 3 && !/\bno\s+no\b/.test(f), f)
  const text = run('pdftotext', [path, '-']) ?? ''
  for (const s of ['Complexity, continued', '60,577 function lines', 'web/src/lib/report.ts#pour', 'newest line', 'sanity']) {
    check(`the text layer holds "${s}"`, text.includes(s), text.slice(0, 200))
  }
}

if (failed > 0) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
