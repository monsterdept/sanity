import { useCallback, useEffect, useState } from 'react'
import { clsx } from '../lib/cn'
import { THEMES, THEME_LABEL, type Theme } from '../lib/theme'
import {
  clearStoredData,
  listOllamaModels,
  storedData,
  type ModelSettings,
  type StoredData,
} from '../lib/api'

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Delete everything Sanity has written on this machine.
 *
 * Two states rather than a modal: the button becomes its own confirmation. A separate
 * dialog for a destructive action people reach for once a year is more chrome than the
 * action deserves, and the second click lands in the same place as the first.
 *
 * What it itemises is the point. "Clear 400 KB" is not something anyone can consent to,
 * because size is not the question — recoverability is. Scores come back by rescanning.
 * Legacy readings do not come back at all, so they get their own line and their own
 * warning, and they are the reason this asks twice.
 */
function ClearData() {
  const [data, setData] = useState<StoredData | null>(null)
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    void storedData().then(setData)
  }, [])
  useEffect(refresh, [refresh])

  // Never returns null. It used to, and that made a failed `stored_data` call — an app
  // built before the command existed, a data directory that could not be read —
  // indistinguishable from the feature not being there at all. Someone looking for this
  // section has no way to tell "broken" from "you imagined it", and will go and look in
  // the code. Absence has to be statable; that rule is why `agent_activity` reports idle
  // rather than going quiet, and it applies here for the same reason.
  if (!data) {
    return (
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <h2 className="mb-1 text-sm font-semibold">Stored data</h2>
        <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
          Couldn't read the data directory. If this build predates the setting, restart
          Sanity after rebuilding.
        </p>
      </div>
    )
  }
  const readings = data.assessments.reduce((n, a) => n + a.readings, 0)
  const untracked = data.assessments.filter((a) => !a.tracked)

  return (
    <div className="mt-5 border-t border-[var(--border)] pt-4">
      <h2 className="mb-1 text-sm font-semibold">Delete all readings</h2>

      {/* Every path listed, before anything is asked. This deletes directories inside
          working trees, which is not a thing a settings panel usually does — so the one
          obligation it has is to name exactly what goes, rather than hiding it behind a
          word like "data". */}
      {data.assessments.length > 0 ? (
        <dl className="mb-3 mt-2 space-y-1 text-[11px]">
          {data.assessments.map((a) => (
            <div key={a.path}>
              <div className="flex justify-between gap-3">
                <dt className="mono truncate">{a.name}</dt>
                <dd className="mono shrink-0 tabular-nums">
                  {a.readings} {a.readings === 1 ? 'reading' : 'readings'}
                </dd>
              </div>
              <p className="mono break-all text-[10px] text-[var(--muted-foreground)]">
                {a.path}
                {/* Whether git can undo this is the only thing that decides how careful
                    to be, so it is stated per directory rather than as a general caveat. */}
                {a.tracked ? (
                  <span className="opacity-70"> · tracked, git can restore it</span>
                ) : (
                  <span className="text-[var(--warning)]"> · untracked, gone for good</span>
                )}
              </p>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mb-3 mt-1 text-[11px] text-[var(--muted-foreground)]">
          No committed assessments. Nothing to delete but the caches below.
        </p>
      )}

      <dl className="mb-3 space-y-0.5 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted-foreground)]">
        <div className="flex justify-between gap-3">
          <dt>
            Model scores <span className="opacity-70">— rebuilt by rescanning</span>
          </dt>
          <dd className="mono tabular-nums">{kb(data.scoreBytes)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Project list</dt>
          <dd className="mono tabular-nums">{data.projects}</dd>
        </div>
        {data.legacyReadingFiles > 0 && (
          <div className="flex justify-between gap-3">
            <dt>
              Old machine-local files <span className="opacity-70">— nothing reads these</span>
            </dt>
            <dd className="mono tabular-nums">{data.legacyReadingFiles}</dd>
          </div>
        )}
      </dl>

      {untracked.length > 0 && (
        <p className="mb-3 text-[11px] leading-snug text-[var(--warning)]">
          {untracked.length === 1 ? 'One assessment is' : `${untracked.length} assessments are`}{' '}
          not committed to git. Deleting {untracked.length === 1 ? 'it' : 'them'} cannot be
          undone.
        </p>
      )}

      {error && <p className="mb-2 text-[11px] text-[var(--warning)]">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          className="rounded-[var(--radius-sm)] border border-[var(--warning)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)]"
          onClick={() => {
            if (!armed) {
              setArmed(true)
              return
            }
            setError(null)
            clearStoredData()
              .then(() => {
                setArmed(false)
                refresh()
              })
              .catch((e) => setError(String(e)))
          }}
        >
          {armed
            ? `Delete ${readings} ${readings === 1 ? 'reading' : 'readings'} — click again`
            : 'Delete all readings'}
        </button>
        {armed && (
          <button
            className="px-2 py-1.5 text-xs text-[var(--muted-foreground)]"
            onClick={() => setArmed(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

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
  value,
  onChange,
  theme,
  onTheme,
  onClose,
}: {
  value: ModelSettings
  onChange: (s: ModelSettings) => void
  theme: Theme
  onTheme: (t: Theme) => void
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

        <ClearData />

        <div className="mt-4 flex justify-end gap-2">
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
