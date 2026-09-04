/**
 * A sprite sheet of every printable ASCII character, at two pixels tall.
 *
 * **This is how a minimap comes to look like code rather than like a barcode.** VS Code's
 * minimap draws the real characters — `minimapCharSheet.ts` rasterises ASCII 32 to 126 once,
 * at `BASE_CHAR_WIDTH = 1` and `BASE_CHAR_HEIGHT = 2`, and `minimapCharRenderer.ts` blits each
 * glyph with per-pixel alpha into the destination, tinted by its token's colour. At one pixel
 * a character it is not readable and is not meant to be; what it is, is the SHAPE of the text,
 * with its colours, which is what the eye recognises a place in a file by. Ours drew one grey
 * bar per line from its indent to its length, which discards every character and every colour
 * before it starts, and no amount of tuning gets that back.
 *
 * **Rasterised once and sampled, rather than drawn per character.** A 3,000-line file has
 * perhaps 150,000 characters in it; asking the canvas to lay out and fill text that many times
 * per scroll frame is not a thing that finishes. Drawing 95 glyphs once into an offscreen
 * canvas and copying rectangles out of it is.
 *
 * The atlas is greyscale coverage — how much ink each pixel of each glyph has — because the
 * COLOUR comes from the token at blit time. One sheet serves every theme and every lens.
 */

/** The range VS Code uses, and for the same reason: everything outside it is either invisible
 *  or wide enough that a one-pixel cell would be a lie about it. */
const FIRST = 32
const LAST = 126
export const GLYPHS = LAST - FIRST + 1

/** One glyph's cell, in device pixels. `2 x 4` rather than VS Code's `1 x 2` base, because
 *  this map is 74px wide against their ~120 and the extra row is what keeps a lowercase
 *  letter distinguishable from a full stop. */
export const CELL_W = 2
export const CELL_H = 4

/** Coverage per pixel, `GLYPHS * CELL_W * CELL_H` bytes, or null where there is no canvas to
 *  rasterise with — a headless render gets no minimap rather than a wrong one. */
let sheet: Uint8Array | null = null
let built = false

export function glyphSheet(): Uint8Array | null {
  if (built) return sheet
  built = true
  if (typeof document === 'undefined') return null
  const scale = 8
  const c = document.createElement('canvas')
  c.width = GLYPHS * CELL_W * scale
  c.height = CELL_H * scale
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // **Drawn large and averaged down, not drawn at 2x4.** A glyph rendered directly into a
  // four-pixel box is whatever the rasteriser's hinting makes of it — usually a solid block or
  // nothing. Rendering at eight times the size and taking the mean coverage of each cell is
  // what makes an `l` lighter than an `M`, which is the entire signal at this scale.
  ctx.fillStyle = '#000'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `${CELL_H * scale * 0.82}px ui-monospace, SFMono-Regular, Menlo, monospace`
  for (let i = 0; i < GLYPHS; i++) {
    ctx.fillText(String.fromCharCode(FIRST + i), i * CELL_W * scale, CELL_H * scale * 0.8)
  }
  const px = ctx.getImageData(0, 0, c.width, c.height).data

  const out = new Uint8Array(GLYPHS * CELL_W * CELL_H)
  for (let i = 0; i < GLYPHS; i++) {
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL_W; x++) {
        let sum = 0
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const gx = (i * CELL_W + x) * scale + sx
            const gy = y * scale + sy
            // The alpha channel: the glyph was filled in opaque black on transparent, so
            // alpha IS coverage and the colour channels say nothing.
            sum += px[(gy * c.width + gx) * 4 + 3]
          }
        }
        out[(i * CELL_H + y) * CELL_W + x] = sum / (scale * scale)
      }
    }
  }
  sheet = out
  return sheet
}

/** Which cell a character uses, or `-1` for one the sheet does not hold.
 *
 *  A tab is not in the sheet and must not be: it is whitespace with a width, and blitting the
 *  unknown box for it would draw a wall down the left of every indented file. */
export function cellOf(code: number): number {
  if (code === 32 || code === 9) return -1
  return code >= FIRST && code <= LAST ? code - FIRST : LAST - FIRST
}
