/**
 * What a keypress means, decided once and testable.
 *
 * **This was eleven early returns inside a `useEffect`, and it broke without anybody being
 * able to see how.** Adding Tab to it — the first bare key in an app whose every other
 * shortcut takes Cmd — was enough to make the lens digits stop answering, and the only way to
 * find out which return was eating them was to read the pile again. A keyboard map is exactly
 * the kind of thing that looks obviously correct and is not: the order of the guards IS the
 * behaviour, and nothing about reading them top to bottom tells you what a given press does.
 *
 * So the decision is a pure function of a press and the state around it, and
 * `scripts/keys-check.ts` presses every key in every state. The effect is left with one job:
 * turn an `Act` into a call.
 */

import { MODE_LABEL, type ColorMode } from './colorMode'

/** The keys the app claims, in the order the switcher lists the lenses. */
export const LENS_KEYS = [
  '`',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
  '-',
  '=',
] as const

/** Previous and next lens, which do not run out.
 *
 * **The digits did.** Nine of them, then ⌘0 for the tenth and ⌘- for the eleventh, and past
 * that `ColorKey`'s `shortcut()` returns null and says so rather than advertising a key that
 * selects something else. A twelfth lens therefore arrived with no way to reach it from the
 * keyboard at all — and worse, inserting one anywhere but the end SHIFTS every digit after it,
 * so the eleventh lens somebody had learned silently became unreachable.
 *
 * **The row now starts at the key left of `1`.** Backtick through `=` is thirteen keys for
 * twelve lenses, so every one of them is reachable again and there is a slot in hand. This
 * shifted every digit by one, which the paragraph above is emphatic about — done deliberately
 * and once, rather than discovered later by somebody whose ⌘4 had moved.
 *
 * Stepping is the shape that survives a twelfth lens and a thirteenth. The digits stay for the
 * ones that have them: a key somebody has learned is not worth taking away, and these are
 * additive. */
export const LENS_STEP: Record<string, -1 | 1> = { '[': -1, ']': 1 }

/** Only what the decision depends on. A `KeyboardEvent` would work and would also drag a DOM
 *  into the harness for four booleans and a string. */
export interface Press {
  key: string
  meta: boolean
  alt: boolean
  ctrl: boolean
  shift: boolean
}

/**
 * The world the press lands in.
 *
 * **Two things it deliberately does NOT contain: which lenses are locked, and whether a
 * replay is up.** Both used to be here, refusing the digit — on the stated ground that a
 * locked lens is not selectable in the strip either, and that the shortcut IS the switcher.
 * The first half of that stopped being true: the strip was made click-through, and says so in
 * its own comment — *a locked lens is still a place you can stand, and what it has to say
 * there is said by the map rather than by a control refusing to be pressed.* The keyboard was
 * never told, so on a repo with no readings ⌘1 was dead while clicking Surprise worked, and
 * during a replay every digit was dead while every tab was clickable.
 *
 * That is the app's own rule read backwards. A control disabled in one place and live on the
 * keyboard is not disabled — and a control LIVE in one place and dead on the keyboard is a
 * shortcut that lies. Whether a lens has anything to show is the map's answer to give, and it
 * gives it: that is what `Locked` and `replayNote` are for.
 */
export interface Where {
  /** Focus is in a field, so a bare key is a character and belongs to whoever is typing. */
  typing: boolean
  /** The find pane is up and owns its own keyboard — see `Find`. */
  finding: boolean
  /** Another panel is up over the map — Findings, or the lens help.
   *
   *  **The button is disabled in that state, so the key must be too.** This file's own rule,
   *  applied the way round it has not been yet: a control live on the keyboard and dead in the
   *  chrome is the same lie as the reverse, and ⌘F under an open Findings panel would put a
   *  search box on top of a panel that has its own Escape and its own idea of what Tab does.
   *
   *  Only Find is refused. The lens digits still answer, because changing what the map behind
   *  a panel is coloured by is a thing somebody can reasonably want and nothing about it
   *  fights the panel. */
  covered: boolean
}

export type Act =
  | { do: 'find' }
  | { do: 'history' }
  | { do: 'lens'; mode: ColorMode }
  /** Move one lens along the strip, wrapping. See `LENS_STEP`. */
  | { do: 'step'; by: -1 | 1 }
  | null

/**
 * **Tab first, because it is the only key here that does not take Cmd**, and last in effect,
 * because it hands every modified press straight on. The old shape put it first too and that
 * was right; what it got wrong was being unable to prove it.
 *
 * The rest in the order they were already in: `+` before the Shift guard, since `+` IS
 * Shift-`=` and a toggle that only works one way is a door that locks behind you; Find before
 * the replay guard, because a key that does nothing explains nothing.
 */
export function actOf(e: Press, w: Where): Act {
  if (e.key === 'Tab' && !e.meta && !e.alt && !e.ctrl && !e.shift) {
    // Inside a field, and inside the pane it opens, Tab stays Tab — the pane moves through
    // its own results with it, and a field needs it to leave. Under another panel it is the
    // browser's focus walk again, which is what an unclaimed Tab has always been.
    if (w.typing || w.finding || w.covered) return null
    return { do: 'find' }
  }
  if (!e.meta || e.alt || e.ctrl) return null
  // **History takes the SHIFTED key, and a bare `=` is the twelfth lens.**
  //
  // It answered to `⌘+` and `⌘=` alike, because `+` IS Shift-`=` and the unshifted spelling was
  // free. It stopped being free when a twelfth lens arrived and `=` was the only key left
  // sitting with the digits. `+` is what the key reports with Shift on most layouts and `=`
  // with Shift on some, so both spellings of the shifted press still mean History; the bare one
  // falls through to the lenses below.
  //
  // The ordering carries this: it runs BEFORE the Shift guard, so an `=` branch that forgot to
  // check Shift would swallow the last lens and nothing on screen would say so.
  if (e.key === '+' || (e.key === '=' && e.shift)) return { do: 'history' }
  if (e.key === 'f') return w.covered ? null : { do: 'find' }
  if (e.shift) return null
  // Before the digits, and it costs them nothing — `[` and `]` are not in `LENS_KEYS` and
  // never were. See `LENS_STEP` for why stepping exists at all.
  const step = LENS_STEP[e.key]
  if (step) return { do: 'step', by: step }
  const i = LENS_KEYS.indexOf(e.key as (typeof LENS_KEYS)[number])
  if (i === -1) return null
  const modes = Object.keys(MODE_LABEL) as ColorMode[]
  if (i >= modes.length) return null
  // Whatever the strip would do on a click — see `Where`. ⌘- is the browser's zoom, so a
  // digit is always ours whether or not the lens has anything to say.
  return { do: 'lens', mode: modes[i] }
}
