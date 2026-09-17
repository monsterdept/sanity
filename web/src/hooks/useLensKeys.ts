import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { MODE_LABEL, type ColorMode } from '../lib/colorMode'
import { actOf } from '../lib/keys'

// Cmd-1..9 then Cmd-0 for the lenses, in the order they appear in the switcher, then Cmd--
// for the eleventh. Cmd-+ toggles the replay.
//
// Derived from `MODE_LABEL`'s key order rather than a second list, so the digit always
// matches the position on screen — the two cannot drift because there is only one order.
// The cost is that reordering renumbers: the row is grouped by where an answer comes from —
// code shape, interconnectivity, activity, assessment — so the digits follow meaning
// rather than history. See `MODE_LABEL` and `FAMILIES`.
//
// The whole app is one geometry under seven encodings, and the question you are asking
// changes far more often than anything else you can do here — reaching for the mouse
// to change it costs more than the change is worth. Cmd rather than a bare digit
// because a bare digit is a character, and one text field anywhere later would make
// this a bug rather than a shortcut.
//
// **The two keys past the digits sit either side of the row for a reason.** Minus reaches
// the lens the digits ran out before — a tenth lens takes ⌘0, and the eleventh had a
// tooltip promising ⌘1, a key that selects the FIRST lens. Plus is the one shortcut that
// is not a lens at all, and it is the one that has to keep working while the replay is up,
// because it is also the way back out.
export function useLensKeys({
  toggleHistory,
  finding,
  findingsOpen,
  helping,
  setFinding,
  mode,
  setMode,
}: {
  toggleHistory: () => void
  finding: boolean
  findingsOpen: boolean
  helping: boolean
  setFinding: Dispatch<SetStateAction<boolean>>
  mode: ColorMode
  setMode: Dispatch<SetStateAction<ColorMode>>
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // **What the press MEANS is decided in `lib/keys.ts`, and this only carries it out.**
      // It was eleven early returns in here, and adding one key to the pile silently cost the
      // lens digits — with no way to see which return had eaten them but to read the pile
      // again. The order of the guards is the behaviour, so the guards are a function now and
      // `just keys-check` presses every key in every state.
      const at = e.target as HTMLElement | null
      const act = actOf(
        { key: e.key, meta: e.metaKey, alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey },
        {
          typing:
            !!at &&
            (at.isContentEditable ||
              at.tagName === 'INPUT' ||
              at.tagName === 'TEXTAREA' ||
              at.tagName === 'SELECT'),
          finding,
          covered: findingsOpen || helping,
        },
      )
      if (!act) return
      // Every act claims its key. `⌘-` is the browser's zoom and Tab is its focus walk, so a
      // shortcut that decided to do nothing must still not let those through.
      e.preventDefault()
      if (act.do === 'find') setFinding(true)
      else if (act.do === 'history') toggleHistory()
      else if (act.do === 'step') {
        // Wrapping, where the digits' ends disable — a stepper through a RANGE stops because
        // running past the end reads as a press that missed, and a cycle through a set does
        // not have ends. `⌘]` from the last lens landing back on the first is the shape every
        // tab cycle has.
        const all = Object.keys(MODE_LABEL) as ColorMode[]
        const at = all.indexOf(modeRef.current)
        setMode(all[(at + act.by + all.length) % all.length])
      } else setMode(act.mode)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleHistory, finding, findingsOpen, helping])

  /** The lens the step keys move FROM, read at press time.
   *
   *  A ref rather than a dependency: the listener is bound once and adding `mode` to its deps
   *  would rebind it on every lens change, which is a `removeEventListener` and an
   *  `addEventListener` per press for a value the handler only ever reads. */
  const modeRef = useRef(mode)
  modeRef.current = mode
}
