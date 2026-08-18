/**
 * Where a project's creature is kept.
 *
 * **Storage only, and deliberately no minting.** Making one needs `randomizeMascot`, which
 * lives in the neo-mascots bundle — 1.2MB with three.js, larger than the rest of the app
 * together, and loaded lazily for exactly that reason (see `AgentMascot`). A helper that
 * minted here would be imported by the sidebar, and the sidebar is on screen from the first
 * frame: the whole bundle would land in the main chunk to service a menu item nobody has
 * clicked. So this file knows how to read, write and forget a blueprint, and `MascotFigure`
 * — which has the bundle anyway, because it is drawing the creature — is the only thing that
 * makes one.
 *
 * Per PROJECT rather than per machine: one creature for the whole app is a mascot for the
 * tool, one per repo is the thing that lives in that repo. Machine-local, like the sidebar's
 * arrangement and the configured harness — it is one person's, it cannot be recomputed, and
 * committing it would put your creature in everybody else's checkout.
 */
const PREFIX = 'sanity.monster.'

/** Keyed by the project key, which is the repo's absolute path. A window with no project
 *  named yet still gets a creature; it just gets the same one every time. */
function keyFor(project: string | null | undefined): string {
  return `${PREFIX}${project ?? ''}`
}

/** This project's stored blueprint, or null if it has none — including when storage is
 *  unavailable or what is there cannot be read, which are the same thing to a caller: there
 *  is nothing to show, so make one. */
export function storedMonster(project: string | null | undefined): unknown | null {
  try {
    const saved = localStorage.getItem(keyFor(project))
    return saved ? (JSON.parse(saved) as unknown) : null
  } catch {
    return null
  }
}

/** Keep a freshly minted blueprint. Silent on failure: what is lost is that this project's
 *  creature will not outlive the window, which is not worth interrupting anybody over. */
export function saveMonster(project: string | null | undefined, config: unknown): void {
  try {
    localStorage.setItem(keyFor(project), JSON.stringify(config))
  } catch {
    /* storage unavailable */
  }
}

/**
 * Throw this project's creature away, so the next look mints another.
 *
 * **Forgetting rather than replacing, which is what lets the sidebar do this at all.** The
 * new one has to come from the bundle, and the sidebar must not import it; removing the key
 * needs nothing. `MascotFigure` finds no blueprint, mints one and saves it — the same path
 * every project takes the first time it is opened, so there is one way a creature is born
 * rather than two.
 */
export function forgetMonster(project: string): void {
  try {
    localStorage.removeItem(keyFor(project))
  } catch {
    /* storage unavailable; nothing was stored to forget */
  }
}
