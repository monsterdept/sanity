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
import { MODE_LABEL, type ColorMode } from '../src/lib/colorMode'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) return console.log(`  ok   ${what}`)
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/** Nothing in the way: no field focused, no pane, no replay, nothing locked. */
const idle: Where = { typing: false, finding: false }
const cmd = (key: string) => ({ key, meta: true, alt: false, ctrl: false, shift: false })
const tab = { key: 'Tab', meta: false, alt: false, ctrl: false, shift: false }
const lens = (a: Act) => (a && a.do === 'lens' ? a.mode : a?.do)

console.log('the lens digits answer, and answer with the right lens')
{
  const modes = Object.keys(MODE_LABEL) as ColorMode[]
  LENS_KEYS.forEach((k, i) => {
    check(`⌘${k} selects ${modes[i]}`, lens(actOf(cmd(k), idle)) === modes[i], lens(actOf(cmd(k), idle)))
  })
  // The regression, stated as the thing that was reported: using the finder must not cost
  // the digits. Tab opens the pane, and the pane being open is a state the digits pass
  // through untouched.
  const open: Where = { ...idle, finding: true }
  check('⌘1 still works with the find pane open', lens(actOf(cmd('1'), open)) === 'surprise')
  check('⌘- still works with the find pane open', lens(actOf(cmd('-'), open)) === 'age')
  const typed: Where = { ...idle, typing: true }
  check('⌘1 still works with a field focused', lens(actOf(cmd('1'), typed)) === 'surprise')
}

console.log('Tab opens the finder, and only where Tab is free')
{
  check('Tab opens it', actOf(tab, idle)?.do === 'find')
  check('inside a field it stays Tab', actOf(tab, { ...idle, typing: true }) === null)
  check('with the pane open it stays Tab', actOf(tab, { ...idle, finding: true }) === null)
  check('Shift-Tab is never ours', actOf({ ...tab, shift: true }, idle) === null)
  check('⌘-Tab is never ours', actOf({ ...tab, meta: true }, idle) === null)
  check('and Tab still opens it during a replay', actOf(tab, idle)?.do === 'find')
}

console.log('the two keys that are not lenses')
{
  check('⌘f finds', actOf(cmd('f'), idle)?.do === 'find')
  check('⌘f finds whatever else is up', actOf(cmd('f'), { ...idle, finding: false })?.do === 'find')
  check('⌘+ toggles history', actOf(cmd('+'), idle)?.do === 'history')
  // `+` is Shift-`=`, so a handler that refuses Shift never sees it — and the way back out
  // of a replay has to work from inside one.
  check('⌘+ toggles it back', actOf({ ...cmd('='), shift: true }, idle)?.do === 'history')
}

console.log('the keyboard does what the strip does, and never less')
{
  // The reported bug. The switcher lets you click into a locked lens — "a locked lens is
  // still a place you can stand" — and the keyboard used to refuse, so on a repo with no
  // readings ⌘1 was dead while clicking Surprise worked. A shortcut that is live in one place
  // and dead in the other is a shortcut that lies.
  check('⌘1 reaches a lens with nothing in it', lens(actOf(cmd('1'), idle)) === 'surprise')
  check('⌘- reaches one during a replay', lens(actOf(cmd('-'), idle)) === 'age')
  check('an unrelated ⌘ key is not ours', actOf(cmd('k'), idle) === null)
  check('a bare digit is a character', actOf({ ...cmd('1'), meta: false }, idle) === null)
  check('⌥⌘1 is not ours', actOf({ ...cmd('1'), alt: true }, idle) === null)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nkeys: every shortcut answers, and using the finder costs none of them')
