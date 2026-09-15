/**
 * The monospace faces on trial, and which one the app is set in.
 *
 * **Every monospace string in the app and its exports names one family, `Sanity Mono`**, and this
 * decides which vendored files that family loads — so trying a face is one choice, not a change to
 * every place a path or a number is set. **Temporary**: the toolbar's picker exists to choose, and
 * once a face is chosen this list becomes that face and the picker goes. No system face is ever a
 * candidate or a fallback: a system face differs by machine and cannot be embedded in a PDF.
 */

export const MONO_FAMILY = '"Sanity Mono"'

export interface MonoFace {
  id: string
  label: string
  /** Where `just vendor-mono` fetched it from in `google/fonts/ofl`. A bracketed name is variable. */
  source: { dir: string; regular: string; bold: string }
}

const variable = (id: string, label: string, dir: string, file: string): MonoFace => ({
  id,
  label,
  source: { dir, regular: file, bold: file },
})
const statics = (id: string, label: string, dir: string, regular: string, bold: string): MonoFace => ({
  id,
  label,
  source: { dir, regular, bold },
})

export const MONO_FACES: MonoFace[] = [
  statics('ibm-plex-mono', 'IBM Plex Mono', 'ibmplexmono', 'IBMPlexMono-Regular.ttf', 'IBMPlexMono-Bold.ttf'),
  variable('jetbrains-mono', 'JetBrains Mono', 'jetbrainsmono', 'JetBrainsMono[wght].ttf'),
  variable('geist-mono', 'Geist Mono', 'geistmono', 'GeistMono[wght].ttf'),
  statics('dm-mono', 'DM Mono', 'dmmono', 'DMMono-Regular.ttf', 'DMMono-Medium.ttf'),
  variable('martian-mono', 'Martian Mono', 'martianmono', 'MartianMono[wdth,wght].ttf'),
  variable('fira-code', 'Fira Code', 'firacode', 'FiraCode[wght].ttf'),
  variable('source-code-pro', 'Source Code Pro', 'sourcecodepro', 'SourceCodePro[wght].ttf'),
  variable('red-hat-mono', 'Red Hat Mono', 'redhatmono', 'RedHatMono[wght].ttf'),
  variable('spline-sans-mono', 'Spline Sans Mono', 'splinesansmono', 'SplineSansMono[wght].ttf'),
  variable('azeret-mono', 'Azeret Mono', 'azeretmono', 'AzeretMono[wght].ttf'),
  variable('m-plus-1-code', 'M PLUS 1 Code', 'mplus1code', 'MPLUS1Code[wght].ttf'),
  variable('google-sans-code', 'Google Sans Code', 'googlesanscode', 'GoogleSansCode[wght].ttf'),
  variable('reddit-mono', 'Reddit Mono', 'redditmono', 'RedditMono[wght].ttf'),
  variable('sometype-mono', 'Sometype Mono', 'sometypemono', 'SometypeMono[wght].ttf'),
  statics('intel-one-mono', 'Intel One Mono', 'intelonemono', 'IntelOneMono-Regular.ttf', 'IntelOneMono-Bold.ttf'),
  statics('space-mono', 'Space Mono', 'spacemono', 'SpaceMono-Regular.ttf', 'SpaceMono-Bold.ttf'),
]

export const MONO_DEFAULT = 'spline-sans-mono'
const KEY = 'sanity.mono'

export function monoFaceOf(id: string | null | undefined): MonoFace {
  return MONO_FACES.find((f) => f.id === id) ?? MONO_FACES.find((f) => f.id === MONO_DEFAULT)!
}

/** The face chosen in this window, or the default. */
export function chosenMono(): MonoFace {
  try {
    return monoFaceOf(localStorage.getItem(KEY))
  } catch {
    return monoFaceOf(null)
  }
}

export function chooseMono(id: string) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable — the choice lasts this window */
  }
}

/** Where a face's file is served from, for the window and for the PDF writer alike. */
export const monoUrl = (f: MonoFace, weight: 400 | 700) => `/fonts/mono/${f.id}-${weight}.ttf`

/**
 * Register `Sanity Mono` as the chosen face, before anything is measured in it. A canvas measures in
 * whatever face has loaded, so this waits for both weights: a width taken off a fallback and drawn
 * in the real face overruns.
 */
export async function installMono(): Promise<void> {
  const f = chosenMono()
  const faces = ([400, 700] as const).map(
    (w) => new FontFace('Sanity Mono', `url(${monoUrl(f, w)}) format("truetype")`, { weight: String(w), style: 'normal' }),
  )
  // `FontFaceSet` is set-like, and this TypeScript's DOM types leave its `add` out.
  for (const face of faces) (document.fonts as unknown as Set<FontFace>).add(face)
  await Promise.all(faces.map((face) => face.load())).catch(() => {})
}
