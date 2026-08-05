import { clsx } from '../lib/cn'
import { THEMES, THEME_LABEL, type Theme } from '../lib/theme'

/**
 * Light / dark / system.
 *
 * A three-way segmented control rather than a two-state switch, because "follow the OS"
 * is a real third answer and the default one — a switch would have to encode it as a
 * position, and no position on a switch means "neither of these".
 */
function ThemePicker({ value, onChange }: { value: Theme; onChange: (t: Theme) => void }) {
  return (
    <div className="mb-5">
      <h2 className="mb-2 text-sm font-semibold">Appearance</h2>
      <div className="inline-flex rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={clsx(
              'rounded-[calc(var(--radius-sm)-2px)] px-3 py-1 text-xs transition-colors',
              t === value
                ? 'bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]'
                : 'text-[var(--muted-foreground)]',
            )}
          >
            {THEME_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The settings panel.
 *
 * It had no way to be opened for most of its life — nothing in the app ever set
 * `showSettings`, so every control in here, including the whole model configuration, was
 * unreachable. A capability with no surface is a capability nobody has, which was already
 * written above the model section about the model itself; the panel then managed to do it
 * to the panel. The app menu is the door now, so the rule finally holds.
 *
 * The endpoint field is not an afterthought either. The common setup for anyone who
 * actually runs local models is a GPU box on the network and a modest laptop, so a
 * hardcoded 127.0.0.1 serves almost nobody in the audience.
 */
export function Settings({
  theme,
  onTheme,
  onClose,
}: {
  theme: Theme
  onTheme: (t: Theme) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 pt-20"
      onClick={onClose}
    >
      {/* Bounded and scrollable. The card had neither, so it simply grew downward from
          its 80px offset — and the moment the content got taller than the window, the
          footer buttons and everything above them went off the bottom edge with no way
          to reach them. A panel that grows without limit is a panel that silently loses
          its own controls the first time somebody adds a section to it. */}
      <div
        className="max-h-[calc(100vh-6rem)] w-[440px] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ThemePicker value={theme} onChange={onTheme} />

      </div>
    </div>
  )
}
