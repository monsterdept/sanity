/**
 * The two atoms every dialog in here is built out of: a labelled block and a chip you pick.
 *
 * Shared rather than restated, because they were briefly restated — the Export dialog began
 * as a copy of the Read dialog's pair, and a copy is how two dialogs in one window end up
 * with different border radii on the same control.
 */

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      {children}
    </div>
  )
}

export function Choice({
  on,
  onClick,
  label,
  note,
  disabled,
}: {
  on: boolean
  onClick: () => void
  label: string
  /** A parenthetical after the label — "default", "not installed", "standard". */
  note?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-40"
      style={{
        borderColor: on ? 'var(--accent)' : 'var(--border)',
        background: on ? 'var(--accent)' : 'transparent',
        color: on ? 'var(--accent-foreground)' : 'inherit',
      }}
    >
      {label}
      {note && <span className="ml-1.5 opacity-70">({note})</span>}
    </button>
  )
}
