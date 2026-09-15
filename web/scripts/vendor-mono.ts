/**
 * The monospace candidates, vendored: `just vendor-mono`.
 *
 * Fetches each face from `google/fonts` with its license, pins a variable face to 400 and 700 (and
 * any other axis to its default), subsets it to the ranges the report's faces carry, and writes
 * `public/fonts/mono/<id>-400.ttf`, `-700.ttf` and `<id>-OFL.txt`. **Temporary**: the picker in the
 * toolbar chooses one of these, and the rest go once the choice is made.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MONO_FACES } from '../src/lib/monoFaces'

const RANGES: [number, number][] = [[0x20, 0x24f], [0x2b0, 0x36f], [0x1e00, 0x1eff], [0x2000, 0x20cf], [0x2100, 0x214f], [0x2190, 0x23ff], [0x2460, 0x24ff], [0x2500, 0x25ff], [0x2600, 0x26ff], [0x2700, 0x27bf], [0xfb00, 0xfb06], [0xfffd, 0xfffd]]
const tag = (s: string) => [...s].reduce((a, c) => (a << 8) + c.charCodeAt(0), 0) >>> 0

const out = 'public/fonts/mono'
mkdirSync(out, { recursive: true })
const { instance } = await WebAssembly.instantiate(readFileSync('node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm'))
const x = instance.exports as unknown as Record<string, (...a: number[]) => number> & { memory: WebAssembly.Memory }
x._initialize?.()

async function get(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { 'User-Agent': 'sanity-vendor-mono' } })
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

function instanceOf(src: Uint8Array, weight: number, pinned: boolean): Uint8Array {
  const input = x.hb_subset_input_create_or_fail()
  const ptr = x.malloc(src.length)
  new Uint8Array(x.memory.buffer).set(src, ptr)
  const blob = x.hb_blob_create(ptr, src.length, 2, 0, 0)
  const face = x.hb_face_create(blob, 0)
  x.hb_blob_destroy(blob)
  const uni = x.hb_subset_input_unicode_set(input)
  for (const [a, b] of RANGES) for (let c = a; c <= b; c++) x.hb_set_add(uni, c)
  if (pinned) {
    x.hb_subset_input_pin_all_axes_to_default(input, face)
    if (!x.hb_subset_input_pin_axis_location(input, face, tag('wght'), weight)) throw new Error('no wght axis')
  }
  x.hb_subset_input_set_flags(input, x.hb_subset_input_get_flags(input) | 0x1)
  const res = x.hb_subset_or_fail(face, input)
  if (!res) throw new Error('subset failed')
  const rb = x.hb_face_reference_blob(res)
  const bytes = new Uint8Array(x.memory.buffer, x.hb_blob_get_data(rb, 0), x.hb_blob_get_length(rb)).slice()
  x.hb_blob_destroy(rb)
  x.hb_face_destroy(res)
  x.hb_face_destroy(face)
  x.hb_subset_input_destroy(input)
  x.free(ptr)
  return bytes
}

const base = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
for (const f of MONO_FACES) {
  const weights: [number, string][] = [[400, f.source.regular], [700, f.source.bold]]
  for (const [w, file] of weights) {
    const src = await get(`${base}/${f.source.dir}/${encodeURIComponent(file)}`)
    const bytes = instanceOf(src, w, file.includes('['))
    writeFileSync(join(out, `${f.id}-${w}.ttf`), bytes)
    console.log(`${f.id}-${w}.ttf  ${(bytes.length / 1024).toFixed(0)} KB`)
  }
  writeFileSync(join(out, `${f.id}-OFL.txt`), await get(`${base}/${f.source.dir}/OFL.txt`))
}
