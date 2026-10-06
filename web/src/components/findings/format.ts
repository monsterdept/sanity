/** How a finding is written down: its address, its numbers, and the colours of its lenses.
 *
 *  Pure functions and no components. The panel draws with them and so does the report —
 *  `lib/report/entries.ts` names a finding with the same `dirOf`, `fileOf` and `nameOf` the
 *  tile does, because two spellings of one address is how a PDF comes to point somewhere
 *  the window does not. */
import type { Hit } from '../../lib/api'
import { MODE_LABEL, modeToken, type ColorMode } from '../../lib/colorMode'
import { middleTruncate, monoAdvance } from '../../lib/label'

/** A threshold as a person reads it: whole where it is whole, two places where it is not.
 *
 *  A grade's bar is `0.7` and a line count's is `339`, and the same formatter has to carry
 *  both without printing `339.00` or rounding a grade to `1`. */
export function trim(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)
}

/** One count as a share of another, at the precision the number deserves.
 *
 *  **Never `0%`.** A rule with two hits out of four thousand is at 0.05%, and rounding that to
 *  a whole number prints a share of nothing over a count of two — two numbers on one row
 *  contradicting each other. Under a tenth it says `<0.1%` instead, which is the honest
 *  version of a number too small to write.
 *
 *  No decimals above ten, where they are noise: `40%` is the fact and `39.7%` is a claim
 *  about a precision this does not have, since which functions count as subjects is itself a
 *  judgement (see `not_ours`). */
export function share(n: number, of: number): string {
  const pct = (n / of) * 100
  if (n > 0 && pct < 0.1) return '<0.1%'
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`
}

/** What a lens is called, in the words the lens switcher uses.
 *
 *  `MODE_LABEL` rather than a table here, for the same reason `lensColor` defers to
 *  `modeToken`: one name per lens, in one place. */
export function lensName(id: string): string {
  return id === 'size' ? 'Size' : (MODE_LABEL[id as ColorMode] ?? id)
}

/** Where a finding lives, as one string: `src/lib/history.ts`, or `…#frameTree` for a function.
 *
 *  **`#`, not `:`.** A colon after a path already means a LINE — `just findings` prints
 *  `src/findings.rs:279`, and so does every compiler, stack trace and editor — so `findings.rs:parse`
 *  would be one syntax for two different things. `#` is what this app already uses for the
 *  same idea: `key_of` writes `path#name`, and a node id is `path#name@line`. It is the
 *  fragment convention too, which is exactly what a function inside a file is.
 *
 *  One format for both kinds, and the `#` is what says which. The glyph column it replaced
 *  said that in a symbol nobody had been taught, and spent a character's width per row on it. */
export function address(hit: Hit): string {
  return hit.kind === 'func' ? `${hit.path}#${hit.name}` : hit.path
}

/** The directory part, which is what gets truncated when the row is too narrow. */
export function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut + 1)
}

/** The directory, shortened from the middle only when a line of its own cannot hold it.
 *
 *  **Two cases, because the address takes one line or two.** If the whole of it fits, nothing
 *  is cut. If it does not, the file and its function wrap to a second line — so the directory
 *  is then alone on the first, with the WHOLE line to spend, and is cut only if it overruns
 *  that.
 *
 *  Subtracting the file and the function from the budget in every case was the first version
 *  and it is wrong in exactly the case that matters: `qa/standalone/scrub/` came out as
 *  `qa/st…rub/` on a line with four fifths of it empty, because the arithmetic was still
 *  reserving room for a file that had already moved to the line below. The layout decides
 *  which line things are on; this has to ask the same question the layout asks.
 *
 *  Where even a full line leaves too little to be worth reading, `middleTruncate` returns
 *  nothing rather than a stub — `x…e/` narrows nothing and still costs a line.
 *
 *  Falls back to the untouched path before the column has been measured: one frame of an
 *  overlong address beats a frame of nothing.
 */
export function dirFor(hit: Hit, colW: number): string {
  const dir = dirOf(hit.path)
  if (colW <= 0) return dir
  // The tile's own padding, which the measured element sits outside of.
  const fits = Math.floor((colW - 32) / (ADDRESS_PX * monoAdvance()))
  // One line for all three: nothing is cut.
  if (dir.length + fileOf(hit).length + nameOf(hit).length <= fits) return dir
  // Two lines, and this one is the directory's alone.
  return dir.length <= fits ? dir : middleTruncate(dir, fits)
}

/** The size the address is set at, which the character count has to agree with. */
const ADDRESS_PX = 15

/** The file, with its `#` where a function follows. Never truncated.
 *
 *  Separate from the function name so the two can carry different weight: on a function finding
 *  the file is still where-it-is, and the NAME is what the tile is about. Three tiers in all —
 *  directory, file, name — each a step nearer the subject. */
export function fileOf(hit: Hit): string {
  const cut = hit.path.lastIndexOf('/')
  const base = cut === -1 ? hit.path : hit.path.slice(cut + 1)
  return hit.kind === 'func' ? `${base}#` : base
}

/** The function, where there is one. Empty on a file finding, whose title is its filename. */
export function nameOf(hit: Hit): string {
  return hit.kind === 'func' ? hit.name : ''
}

/** The lenses that raised this finding, laid across the head of its tile.
 *
 *  **The one mark left, and horizontal is why it survived.** They ran down the tile's leading
 *  edge first, as a rail — nine pixels wide, then eighteen, then twenty-seven, striped both
 *  ways at each. Down a rail four lenses are threads under seven pixels wide and read as a
 *  barcode; across the head of a tile each one gets a real span. The rail went, this stayed,
 *  and the tile got its left margin back.
 *
 *  Hard stops rather than a fade: a gradient between two lens hues passes through colours that
 *  belong to OTHER lenses, and this app has twelve — a surprise-to-reach blend runs straight
 *  through the churn green on the way. */
export function lensRule(ids: string[]): string {
  if (ids.length === 0) return 'var(--border)'
  if (ids.length === 1) return lensColor(ids[0])
  const step = 100 / ids.length
  return `linear-gradient(90deg, ${ids
    .map((id, i) => `${lensColor(id)} ${i * step}% ${(i + 1) * step}%`)
    .join(', ')})`
}

/** The colour a field's pill wears in an expression.
 *
 *  **Coloured means a lens; neutral means not one, and there is only one neutral.** `size` and
 *  `read` are both non-lenses — width is how the map draws lines rather than a colour, and an
 *  absence of readings is not a lens either — but they reached the pill by two code paths and
 *  came out slightly different shades. A difference that small reads as a distinction the
 *  reader then goes looking for, and there is none to find.
 *
 *  `--structure` was tried for `read`, on the argument that it is what every reading lens
 *  paints on an unread wedge. It is a pale warm grey meant to be a large quiet area on a map,
 *  and at pill size tinted to 16% it vanished. */
export function fieldColor(id: string | null): string {
  return id === null ? 'var(--muted-foreground)' : lensColor(id)
}

/** The colour of one lens.
 *
 *  **`modeToken` and nothing else**, so a segment here is the same hue as the wedges that lens
 *  paints — a private table would be a second vocabulary for one set of colours, which is how
 *  the legend and the map came to disagree about a language's name. `size` is the one id that
 *  is not a lens: width is how the map draws lines, and it gets the neutral. */
export function lensColor(id: string): string {
  // **Membership checked, not assumed.** `modeToken` walks a `Record<ColorMode, …>`, so an id
  // the frontend has never heard of comes back as `--undefined-3` — a var that resolves to
  // nothing, drawing an invisible swatch rather than failing. That is the quiet-wrong-colour
  // failure this whole app is written against, and the guard costs one lookup.
  if (id !== 'size' && id in MODE_LABEL) return `var(${modeToken(id as ColorMode)})`
  return 'var(--muted-foreground)'
}
