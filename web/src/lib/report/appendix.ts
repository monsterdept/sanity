import { MODE_LABEL, type ColorMode } from '../colorMode'
import { APPENDIX, ESSAYS } from '../reportProse'
import type { Frame, Press } from './frame'
import { drawSlices } from './sheet'
import { flow, inlineRuns, pourEven, proseBlocks, type Block, type Slice } from './text'
import { BODY, CONTINUED_TOP, HEADER_BOTTOM } from './units'

/** The appendix: each lens's instrument in full, where its essay moved it there (`Essay.method`).
 *  Only a report has one; a brief and a deck are already excerpts. */
export function layoutAppendix(f: Frame, modes: ColorMode[]): Slice[][] {
  const measured = f.o.form === 'report' ? modes.filter((m) => (ESSAYS[m].method ?? []).length > 0) : []
  if (!measured.length) return []
  const blocks: Block[] = [
    { kind: 'p', runs: inlineRuns(APPENDIX.intro) },
    ...measured.flatMap((m) => proseBlocks([{ heading: MODE_LABEL[m], body: ESSAYS[m].method ?? [] }], f.essayVars)),
  ]
  return pourEven(flow(f.sheet.c, blocks, f.colW, BODY), (p) => f.twoCols(p === 0 ? HEADER_BOTTOM : CONTINUED_TOP))
}

export function drawAppendix(f: Frame, press: Press, pages: Slice[][], start: number) {
  const { sheet } = f
  for (let p = 0; p < pages.length; p++) {
    press.check()
    press.tick('drawing the appendix')
    press.begin(start + p)
    if (p === 0) sheet.header('Appendix', APPENDIX.title)
    else sheet.continued('Appendix', `${APPENDIX.title}, continued`)
    drawSlices(sheet, pages[p])
    press.end(start + p, p === 0 ? 'Appendix' : undefined)
  }
}
