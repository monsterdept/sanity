/**
 * Light, dark, or whatever the OS says.
 *
 * The app followed the system with no toggle, on the argument that a switch is a second
 * place for the preference to live and a second one to drift out of step with the OS.
 * That argument is sound about *storage* and wrong about *need*: taking screenshots,
 * recording a demo, or checking that both grounds actually render means changing ground
 * without changing the machine's. `system` is still the default, so the drift case only
 * exists for someone who deliberately opted into it.
 *
 * The ground is a `dark` class on `<html>` — Tailwind v4 class-based dark mode, declared
 * by `@custom-variant dark` in index.css. Not a media query, because a media query cannot
 * be overridden by a preference.
 */

export type Theme = 'light' | 'dark' | 'system'

export const THEMES: Theme[] = ['light', 'dark', 'system']

export const THEME_LABEL: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
}

const KEY = 'sanity.theme'

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch {
    /* storage unavailable — follow the system, which is the default anyway */
  }
  return 'system'
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* the preference just won't survive a restart */
  }
}

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Put the ground on the document. Exported so the entry points can call it before the
 *  first paint rather than after React mounts — see `applyStoredTheme`. */
export function applyTheme(t: Theme): void {
  const dark = t === 'system' ? prefersDark() : t === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

/**
 * Apply the stored preference immediately, at module load.
 *
 * `index.html` ships `class="dark"` so the very first frame has a ground rather than
 * flashing unstyled. That is a guess, and it is wrong for anyone in light mode — so this
 * runs as a side effect of importing the module, before React renders, instead of waiting
 * for an effect to fire after the first paint.
 */
export function applyStoredTheme(): void {
  applyTheme(loadTheme())
}

/**
 * Keep following the OS while the preference is `system`.
 *
 * Returns a teardown. Only subscribes in `system` mode: an explicit choice that quietly
 * re-followed the OS on the next sunset would not be a choice.
 */
export function watchSystemTheme(t: Theme): () => void {
  applyTheme(t)
  if (t !== 'system') return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => applyTheme('system')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
