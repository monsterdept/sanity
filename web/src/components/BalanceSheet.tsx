/** A proposal for this repo's whole rule set, reviewed before anything is saved.
 *
 *  The backend proposes thresholds that bring the list toward a target number of findings,
 *  counted once each however many rules raise them, only ever tightening. Every change arrives
 *  ticked; saving writes the ticked ones to `catalog.md`. "Back to stock" removes this repo's
 *  rule changes instead. */
import { useEffect, useState } from 'react'
import { balanceRules, type Balance } from '../lib/api'

const button =
  'rounded border border-[var(--border)] px-2 py-[3px] text-[11px] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40'

/** A threshold as a person would write it. */
function trim(v: number): string {
  return String(Math.round(v * 100) / 100)
}

export function BalanceSheet({
  projectKey,
  onApply,
  onStock,
  onClose,
}: {
  projectKey: string
  onApply: (thresholds: [string, number][]) => Promise<void>
  onStock: () => Promise<void>
  onClose: () => void
}) {
  const [target, setTarget] = useState(20)
  const [proposal, setProposal] = useState<Balance | null>(null)
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmStock, setConfirmStock] = useState(false)

  useEffect(() => {
    let live = true
    setProposal(null)
    balanceRules(projectKey, target)
      .then((b) => {
        if (!live) return
        setProposal(b)
        setTicked(new Set(b.rules.filter((r) => r.to !== null).map((r) => r.id)))
      })
      .catch((e) => live && setError(String(e)))
    return () => {
      live = false
    }
  }, [projectKey, target])

  const shown = proposal?.rules.filter((r) => r.hitsBefore > 0) ?? []
  const changes = shown.filter((r) => r.to !== null && ticked.has(r.id))

  const save = () => {
    setBusy(true)
    onApply(changes.map((r) => [r.id, r.to as number]))
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false))
  }

  const stock = () => {
    setBusy(true)
    onStock()
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false))
  }

  return (
    <div className="mb-3 rounded-md border border-[var(--border)] px-3 py-2.5 text-[11px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
          Aim for
          <input
            className="w-[52px] rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-[3px] text-[var(--foreground)]"
            inputMode="numeric"
            value={target}
            disabled={busy}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              if (Number.isFinite(n) && n > 0) setTarget(n)
            }}
          />
          findings
        </label>
        {proposal && (
          <span className="text-[var(--foreground)]">
            {proposal.before} → {proposal.after} findings
          </span>
        )}
      </div>

      {error && <p className="mb-2 text-[var(--destructive)]">{error}</p>}

      {!proposal ? (
        <p className="text-[var(--muted-foreground)]">Weighing every rule against this repo…</p>
      ) : (
        <table className="mb-2 w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
              <th className="w-5" />
              <th className="font-normal">Rule</th>
              <th className="font-normal">Threshold</th>
              <th className="text-right font-normal">Findings</th>
              <th className="text-right font-normal">Only it</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-0.5">
                  {r.to !== null && (
                    <input
                      type="checkbox"
                      checked={ticked.has(r.id)}
                      disabled={busy}
                      onChange={() => {
                        const next = new Set(ticked)
                        if (next.has(r.id)) next.delete(r.id)
                        else next.add(r.id)
                        setTicked(next)
                      }}
                    />
                  )}
                </td>
                <td className="py-0.5 pr-2 text-[var(--foreground)]">
                  {r.title}
                  {r.onlyAfter === 0 && (
                    <span className="block text-[var(--muted-foreground)]">
                      every finding also raised by another rule
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap py-0.5 pr-2 font-mono text-[var(--muted-foreground)]">
                  {r.field} {r.op} {trim(r.from)}
                  {r.to !== null && <span className="text-[var(--foreground)]"> → {trim(r.to)}</span>}
                </td>
                <td className="whitespace-nowrap py-0.5 text-right tabular-nums">
                  {r.hitsBefore} → {r.hitsAfter}
                </td>
                <td className="whitespace-nowrap py-0.5 text-right tabular-nums">
                  {r.onlyBefore} → {r.onlyAfter}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex items-center justify-between gap-2">
        {confirmStock ? (
          <span className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
            Remove this repo's rule changes and its own rules?
            <button type="button" className={button} disabled={busy} onClick={stock}>
              Remove
            </button>
            <button type="button" className={button} disabled={busy} onClick={() => setConfirmStock(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className={button} disabled={busy} onClick={() => setConfirmStock(true)}>
            Back to stock
          </button>
        )}
        <span className="flex items-center gap-1.5">
          <button type="button" className={button} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={button} disabled={busy || changes.length === 0} onClick={save}>
            Save {changes.length} {changes.length === 1 ? 'threshold' : 'thresholds'}
          </button>
        </span>
      </div>
    </div>
  )
}
