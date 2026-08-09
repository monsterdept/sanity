import { type Node } from '../lib/api'
import { clsx } from '../lib/cn'

/**
 * Where you are, and every way back out of it.
 *
 * Every level is a link. The bar used to be one link (the project name), one inert run of
 * text (the whole rest of the path) and a word (`up`) styled like neither — three
 * renderings of three things that are all the same kind of thing, which left the only
 * navigable middle of a deep path unclickable.
 *
 * The trail is the focused node's ANCESTRY, walked up the tree — not the drill stack,
 * which records where you clicked rather than where you are. Drilling from the root
 * straight into a nested directory left one entry in that stack, and the bar read
 * `cluster / Store` for something that lives at `Sources/ClusterCore/Store`.
 *
 * A collapsed single-child chain is one node whose name still carries its slashes, and
 * they are dimmed: it is one place however many directories it names, and the separators
 * between crumbs have to stay the louder mark.
 */
export function Crumbs({
  trail,
  onGo,
  onUp,
  onLabels,
  labelsOpen,
}: {
  /** Root first, current last. */
  trail: Node[]
  onGo: (index: number) => void
  onUp?: () => void
  /** Opens the label workbench — see `LabelLab`. */
  onLabels?: () => void
  labelsOpen?: boolean
}) {
  return (
    <nav className="flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs">
      {/* `min-w-0` so the trail is what gives way when the window narrows, not the
          button — the way out must not be the thing that gets truncated. */}
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {trail.map((n, i) => {
          const last = i === trail.length - 1
          const parts = n.name.split('/')
          return (
            <li key={n.id} className="flex min-w-0 shrink-0 items-center gap-1 last:shrink">
              {i > 0 && (
                <span aria-hidden className="text-[var(--muted-foreground)] opacity-50">
                  /
                </span>
              )}
              <button
                type="button"
                // The current level is still a button, just not an offer: it keeps the
                // row's rhythm and it re-centres the view, which is what clicking where
                // you already are should do.
                onClick={() => onGo(i)}
                aria-current={last ? 'page' : undefined}
                className={clsx(
                  'mono truncate rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors',
                  last
                    ? 'font-semibold text-[var(--foreground)]'
                    : 'text-[var(--accent)] hover:bg-[var(--secondary)]',
                )}
              >
                {parts.map((part, j) => (
                  <span key={j}>
                    {/* A collapsed chain's inner slashes are dimmed: this is one node,
                        and the separators between crumbs have to stay the louder mark or
                        the two readings compete. */}
                    {j > 0 && <span className="opacity-40">/</span>}
                    {part}
                  </span>
                ))}
              </button>
            </li>
          )
        })}
      </ol>

      {onLabels && (
        <button
          type="button"
          onClick={onLabels}
          aria-pressed={labelsOpen}
          title="Label workbench"
          className={`shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-[11px] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] ${
            labelsOpen ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          }`}
        >
          Aa
        </button>
      )}

      <button
        type="button"
        onClick={onUp}
        disabled={!onUp}
        className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)] transition-colors hover:bg-[var(--secondary)] hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:bg-transparent"
      >
        ↑ Up
      </button>
    </nav>
  )
}
