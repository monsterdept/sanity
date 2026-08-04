import { useCallback, useEffect, useState } from 'react'
import { listOllamaModels, type ModelSettings } from '../lib/api'

/**
 * Where the model gets configured.
 *
 * Sanity shipped for a while with the whole Ollama path wired and no way to switch it
 * on — the header said "heuristic (no model)" and there was nothing anywhere in the app
 * to change that. A capability with no surface is a capability nobody has.
 *
 * The endpoint field is not an afterthought either. The common setup for anyone who
 * actually runs local models is a GPU box on the network and a modest laptop, so a
 * hardcoded 127.0.0.1 serves almost nobody in the audience.
 */
export function Settings({
  value,
  onChange,
  onClose,
}: {
  value: ModelSettings
  onChange: (s: ModelSettings) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(value)
  const [models, setModels] = useState<string[] | null>(null)
  const [probing, setProbing] = useState(false)

  const probe = useCallback(async (endpoint: string) => {
    setProbing(true)
    try {
      setModels(await listOllamaModels(endpoint))
    } finally {
      setProbing(false)
    }
  }, [])

  useEffect(() => {
    void probe(draft.endpoint)
    // Deliberately on mount only. Re-probing per keystroke would fire a request at every
    // partial hostname; the Check button is the explicit trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reachable = models !== null && models.length > 0

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center bg-black/40 pt-20"
      onClick={onClose}
    >
      <div
        className="w-[440px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-sm font-semibold">Scoring model</h2>
        <p className="mb-4 text-[11px] leading-snug text-[var(--muted-foreground)]">
          Without a model Sanity scores with an offline proxy that is largely a proxy for
          file length — <span className="mono">just scan</span> prints a baseline check
          that says so. A model measures how predictable each body actually was.
        </p>

        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={draft.useOllama}
            onChange={(e) => setDraft({ ...draft, useOllama: e.target.checked })}
          />
          Use an Ollama model
        </label>

        <div className={draft.useOllama ? '' : 'pointer-events-none opacity-40'}>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Endpoint
          </label>
          <div className="mb-3 flex gap-2">
            <input
              className="mono min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
              value={draft.endpoint}
              placeholder="http://127.0.0.1:11434"
              onChange={(e) => setDraft({ ...draft, endpoint: e.target.value })}
            />
            <button
              className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-xs"
              onClick={() => void probe(draft.endpoint)}
            >
              {probing ? 'Checking…' : 'Check'}
            </button>
          </div>

          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Model
          </label>
          {reachable ? (
            <select
              className="mono mb-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            >
              {!models.includes(draft.model) && <option value={draft.model}>{draft.model}</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="mono mb-1 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs"
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            />
          )}
          <p className="mb-3 text-[11px] text-[var(--muted-foreground)]">
            {probing
              ? 'Contacting the endpoint…'
              : models === null
                ? ''
                : reachable
                  ? `${models.length} model${models.length === 1 ? '' : 's'} available. A code-specialised one scores best.`
                  : "Couldn't reach that endpoint — the scan will fall back to the proxy."}
          </p>

          {/* There is deliberately no length filter here.
              A slider that skipped short functions used to live in this spot, and it was
              the same mistake the baseline check exists to catch: sanity's whole claim is
              that size is the boring axis, and a filter on length decides what gets
              MEASURED at all. A three-line guard with an inverted comparison is exactly
              what this tool should surface. Analysis is bounded by stopping it, not by
              excluding code from it — the queue is ordered so the most promising
              functions are scored first. */}
          <p className="mb-4 text-[11px] leading-snug text-[var(--muted-foreground)]">
            Every function gets analysed, shortest included — the most promising ones
            first, so the map is useful long before the scan ends. Stop it whenever the
            picture has told you enough; everything already scored is kept.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-xs text-[var(--muted-foreground)]" onClick={onClose}>
            Cancel
          </button>
          <button
            className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)]"
            onClick={() => {
              onChange(draft)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
