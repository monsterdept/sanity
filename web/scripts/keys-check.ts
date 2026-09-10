/**
 * Every key, in every state.
 *
 * The lens digits stopped answering when Tab was added to the shortcut handler, and reading
 * the handler did not say why — a keyboard map is a pile of early returns whose ORDER is the
 * behaviour. So the decision moved to `lib/keys.ts` and this presses it.
 *
 * Run it with `just keys-check`.
 */
import { actOf, LENS_KEYS, type Act, type Where } from '../src/lib/keys'
import { FAMILIES, MODE_LABEL, type ColorMode } from '../src/lib/colorMode'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) return console.log(`  ok   ${what}`)
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/** Nothing in the way: no field focused, no pane, no replay, nothing locked. */
const idle: Where = { typing: false, finding: false, covered: false }
const cmd = (key: string) => ({ key, meta: true, alt: false, ctrl: false, shift: false })
const tab = { key: 'Tab', meta: false, alt: false, ctrl: false, shift: false }
const lens = (a: Act) => (a && a.do === 'lens' ? a.mode : a?.do)

console.log('the lens digits answer, and answer with the right lens')
{
  const modes = Object.keys(MODE_LABEL) as ColorMode[]
  LENS_KEYS.forEach((k, i) => {
    check(
      `⌘${k} selects ${modes[i]}`,
      lens(actOf(cmd(k), idle)) === modes[i],
      lens(actOf(cmd(k), idle)),
    )
  })
  // The regression, stated as the thing that was reported: using the finder must not cost
  // the digits. Tab opens the pane, and the pane being open is a state the digits pass
  // through untouched.
  const open: Where = { ...idle, finding: true }
  check('⌘` still works with the find pane open', lens(actOf(cmd('`'), open)) === 'tangle')
  check('⌘- still works with the find pane open', lens(actOf(cmd('-'), open)) === 'docs')
  const typed: Where = { ...idle, typing: true }
  check('⌘` still works with a field focused', lens(actOf(cmd('`'), typed)) === 'tangle')
}

console.log('Tab opens the finder, and only where Tab is free')
{
  check('Tab opens it', actOf(tab, idle)?.do === 'find')
  check('inside a field it stays Tab', actOf(tab, { ...idle, typing: true }) === null)
  check('with the pane open it stays Tab', actOf(tab, { ...idle, finding: true }) === null)
  check('under another panel it stays Tab', actOf(tab, { ...idle, covered: true }) === null)
  check('Shift-Tab is never ours', actOf({ ...tab, shift: true }, idle) === null)
  check('⌘-Tab is never ours', actOf({ ...tab, meta: true }, idle) === null)
  check('and Tab still opens it during a replay', actOf(tab, idle)?.do === 'find')
}

console.log('the two keys that are not lenses')
{
  check('⌘f finds', actOf(cmd('f'), idle)?.do === 'find')
  check('⌘f finds whatever else is up', actOf(cmd('f'), { ...idle, finding: false })?.do === 'find')
  // **The button is disabled under Findings and the help, so the key is too.** A control live
  // on the keyboard and dead in the chrome is the same lie as the reverse — this file's own
  // rule, applied the way round it had not been yet.
  check('⌘f is refused under another panel', actOf(cmd('f'), { ...idle, covered: true }) === null)
  check(
    'but the digits are not — the map behind a panel is still yours to recolour',
    lens(actOf(cmd('`'), { ...idle, covered: true })) === 'tangle',
  )
  check('⌘+ toggles history', actOf(cmd('+'), idle)?.do === 'history')
  // `+` is Shift-`=`, so a handler that refuses Shift never sees it — and the way back out
  // of a replay has to work from inside one.
  check('⌘+ toggles it back', actOf({ ...cmd('='), shift: true }, idle)?.do === 'history')
  // **And a BARE `⌘=` is the twelfth lens, not a second spelling of History.** It answered to
  // both until there were twelve lenses and only eleven digits — see `HISTORY_NEEDS_SHIFT`.
  // The risk this pins is the ordering: the History branch runs before the Shift guard, so an
  // `=` that forgot to check Shift would swallow the last lens and nothing would say so.
  check('a bare ⌘= is a lens, not history', actOf(cmd('='), idle)?.do === 'lens')
}

console.log('the keyboard does what the strip does, and never less')
{
  // The reported bug. The switcher lets you click into a locked lens — "a locked lens is
  // still a place you can stand" — and the keyboard used to refuse, so on a repo with no
  // readings ⌘1 was dead while clicking Surprise worked. A shortcut that is live in one place
  // and dead in the other is a shortcut that lies.
  //
  // **The lens that CAN have nothing in it is the one to press.** Complexity took the first
  // row — it is the one lens that paints a repo nobody has read — and is rarely the locked
  // one, so pressing the first key here would quietly stop testing what this was written for.
  // Surprise is the one to reach, and it is ⌘9 now that Assessment closes the menu.
  check('⌘9 reaches a lens with nothing in it', lens(actOf(cmd('9'), idle)) === 'surprise')
  check('⌘7 reaches one during a replay', lens(actOf(cmd('7'), idle)) === 'age')
  check('an unrelated ⌘ key is not ours', actOf(cmd('k'), idle) === null)
  check('a bare digit is a character', actOf({ ...cmd('1'), meta: false }, idle) === null)
  check('a bare backtick is a character', actOf({ ...cmd('`'), meta: false }, idle) === null)
  check('⌥⌘1 is not ours', actOf({ ...cmd('1'), alt: true }, idle) === null)
  // The row is thirteen keys for thirteen lenses, so the last one is reachable — Traps, which
  // closes Assessment now.
  check('⌘= reaches the last lens', lens(actOf(cmd('='), idle)) === 'traps')
}

console.log('the menu is four families, in the order the keys count')
{
  // `FAMILIES` draws the dividers and `MODE_LABEL` numbers the keys. A lens moved in one and not
  // the other draws a divider through the middle of a family, and nothing on screen calls that
  // wrong — the map still looks like a map.
  const modes = Object.keys(MODE_LABEL) as ColorMode[]
  const flat = FAMILIES.flatMap((f) => f.modes)
  check('the families hold every lens once, in menu order', flat.join() === modes.join(), flat)
}

console.log('stepping, because the digits ran out')
{
  // **The twelfth lens has no digit and `shortcut()` correctly refuses to invent one**, so
  // without stepping it is unreachable from the keyboard — and inserting a lens anywhere but
  // the end moves every digit after it, which is what putting Complexity FIRST does to all
  // eleven. Stepping is the shape that survives a thirteenth lens and a fourteenth.
  const step = (k: string) => {
    const a = actOf(cmd(k), idle)
    return a && a.do === 'step' ? a.by : null
  }
  check('⌘] is the next lens', step(']') === 1)
  check('⌘[ is the previous one', step('[') === -1)
  // They take Cmd like every other shortcut here, or a bare bracket stops being a character.
  check('a bare bracket is a character', actOf({ ...cmd(']'), meta: false }, idle) === null)
  check('⇧⌘] is not ours', actOf({ ...cmd(']'), shift: true }, idle) === null)
  // Typing in a field is the one place every Cmd shortcut still answers — see `Where` — so
  // the brackets have to behave like the digits do rather than like Tab.
  check('⌘] answers with a field focused', step(']') === 1)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nkeys: every shortcut answers, and using the finder costs none of them')
