/**
 * The wordmark that covers the boot, and the one place that decides when it comes down.
 *
 * It used to come down after the first paint, which is the wrong event: the first paint is
 * the app's SCAFFOLDING — a sidebar with no projects in it and a pane that has not asked
 * the backend anything yet. So a launch drew four screens in a second and a half — mark,
 * "Loading projects…", the copy for somebody who has never studied a project, and finally
 * the map — two of which are about the app's own startup and one of which is addressed to
 * the wrong person entirely.
 *
 * The mark stays up until the app has something to say: the map, or the first-run card when
 * there genuinely are no projects. `App` calls this when it does; nothing here decides what
 * "ready" means.
 *
 * Idempotent, because two callers race it by design — the app when it is ready, and the cap
 * in `main.tsx` when it never gets there.
 */
let gone = false

export function dismissSplash() {
  if (gone) return
  gone = true
  const splash = document.getElementById('splash')
  if (!splash) return
  // Faded rather than cut, and removed from the document afterwards so it cannot sit over
  // the app swallowing clicks if the transition never fires.
  splash.classList.add('is-gone')
  setTimeout(() => splash.remove(), 400)
}
