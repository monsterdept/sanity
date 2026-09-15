import stylesheet from '../../index.css?raw'
import subsetWasm from 'harfbuzzjs/dist/harfbuzz-subset.wasm?url'
import type { VectorEnv } from '../report'
import { rootVars } from './color'
import { Face, subsetter } from './fonts'
import { chosenMono, monoUrl } from '../monoFaces'

/**
 * What a vector report is written with in the window: the four faces off `/fonts/pdf`, the
 * stylesheet's own custom properties, HarfBuzz's subsetter and the webview's `CompressionStream`.
 *
 * **The stylesheet as text, not as computed style.** A headless render reads `index.css` off disk
 * and resolves it with `rootVars`; asking `getComputedStyle` here would resolve against whatever
 * theme the window is in, and a report printed from a dark window would be a different report.
 * Both read the same file the same way.
 *
 * Loaded once and kept: a report, then a brief, then a deck do not fetch the faces three times.
 */
let loaded: Promise<VectorEnv> | null = null

export function windowEnv(): Promise<VectorEnv> {
  loaded ??= load()
  return loaded
}

async function load(): Promise<VectorEnv> {
  // The monospace face is whichever `Sanity Mono` is in this window — see `monoFaces.ts`.
  const choice = chosenMono()
  const ps = (label: string) => label.replace(/[^A-Za-z0-9]/g, '')
  const faceAt = async (key: string, url: string, name: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`The report's face ${url} did not load.`)
    return new Face({ key, name, bytes: new Uint8Array(await res.arrayBuffer()) })
  }
  const face = (key: string, file: string, name: string) => faceAt(key, `/fonts/pdf/${file}`, name)
  const [sans, sansBold, mono, monoBold, wasm] = await Promise.all([
    face('sans', 'LINESeedJP-Regular.ttf', 'LINESeedJP-Regular'),
    face('sans-bold', 'LINESeedJP-Bold.ttf', 'LINESeedJP-Bold'),
    faceAt('mono', monoUrl(choice, 400), `${ps(choice.label)}-Regular`),
    faceAt('mono-bold', monoUrl(choice, 700), `${ps(choice.label)}-Bold`),
    fetch(subsetWasm).then((r) => r.arrayBuffer()),
  ])
  return {
    fonts: { sans, sansBold, mono, monoBold },
    vars: rootVars(stylesheet),
    subset: await subsetter(new Uint8Array(wasm)),
    deflate: async (bytes) => {
      const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'))
      return new Uint8Array(await new Response(stream).arrayBuffer())
    },
  }
}
