/**
 * The monospace face, vendored.
 *
 * **Every monospace string in the app and its exports names one family, `Sanity Mono`**, and this
 * is the file it loads. Azeret Mono, chosen after trying sixteen candidates behind a temporary
 * toolbar picker; the picker and the other faces are gone, and what is left is the choice.
 *
 * The files are `google/fonts/ofl/azeretmono`'s variable `AzeretMono[wght].ttf`, pinned to 400 and
 * 700 and subset to the Latin ranges the PDFs set, with the license beside them. No system face is
 * a fallback: a system face differs by machine and cannot be embedded in a PDF.
 */

export const MONO_FAMILY = '"Sanity Mono"'

/** The vendored files, and the name the PDF writer embeds them under. */
export const MONO = { id: 'azeret-mono', label: 'Azeret Mono', postscript: 'AzeretMono' } as const

export const monoUrl = (weight: 400 | 700) => `/fonts/mono/${MONO.id}-${weight}.ttf`

/**
 * Register `Sanity Mono` before anything is measured in it. A canvas measures in whatever face has
 * loaded, so this waits for both weights: a width taken off a fallback and drawn in the real face
 * overruns.
 */
export async function installMono(): Promise<void> {
  const faces = ([400, 700] as const).map(
    (w) => new FontFace('Sanity Mono', `url(${monoUrl(w)}) format("truetype")`, { weight: String(w), style: 'normal' }),
  )
  // `FontFaceSet` is set-like, and this TypeScript's DOM types leave its `add` out.
  for (const face of faces) (document.fonts as unknown as Set<FontFace>).add(face)
  await Promise.all(faces.map((face) => face.load())).catch(() => {})
}
