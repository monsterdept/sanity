import { useEffect, useRef, useState } from 'react'
import { Choice, Field } from './Fields'
import { Overlay } from './Overlay'
import type { Locked } from './ColorKey'
import { languages, repoHead, savePdf, type FindingGroup, type Node, type RepoHead } from '../lib/api'
import { MODE_LABEL, type ColorMode, type Views } from '../lib/colorMode'
import type { LensKey } from '../lib/lensKey'
import { CANCELLED, type Staged } from '../lib/movie'
import {
  buildReport,
  lensPages,
  PAPER,
  type Paper,
  type ReportBucket,
  type ReportStats,
  type ReportTick,
} from '../lib/report'

/** Letter where the paper in the drawer is Letter, A4 everywhere else. A guess from the locale,
 *  offered as the opening answer and one click from the other. */
function paperFor(locale: string): Paper {
  return /^(en-(US|CA)|es-(MX|US)|fil)\b/i.test(locale) ? 'letter' : 'a4'
}

/** A filename somebody will recognise a week later — `ExportDialog`'s rule. */
function suggest(name: string): string {
  const stem = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${stem || 'sanity'}-report.pdf`
}

/**
 * Export the project's analysis as a PDF — see `report.ts` for what goes on each page and why
 * it is drawn the way it is.
 *
 * **It says why it cannot, rather than being unavailable.** The menu item is always live; a
 * report needs a repo on screen, the map as it stands rather than a replay frame, and the
 * findings counted, and each of those is a sentence here instead of a greyed item nobody can
 * ask about.
 */
export function ReportDialog({
  slug,
  name,
  repo,
  views,
  ready,
  replaying,
  groups,
  locks,
  mode,
  keyFor,
  pending,
  bucketsFor,
  treeNow,
  stats,
  settled,
  onStage,
  onClose,
}: {
  /** The repo as the world knows it. */
  slug: string
  /** The repo's own name, for the filename. */
  name: string
  /** Where the repo is on disk, for the commit the report is stamped with. */
  repo: string | null
  /** How the lenses are set, which each page states — see `settingOf`. */
  views: Views
  /** A tree is on screen. */
  ready: boolean
  /** A replay is up — a report is of the repo as it stands. */
  replaying: boolean
  groups: FindingGroup[] | null
  locks: Partial<Record<ColorMode, Locked>>
  /** The lens the window is showing — the findings map is drawn in it where it can paint. */
  mode: ColorMode
  keyFor: (mode: ColorMode) => LensKey | null
  pending: () => { stale: number; unread: number }
  /** A lens's bands over the whole repo, for the facts in each essay — see `Report.bucketsFor`. */
  bucketsFor: (mode: ColorMode) => ReportBucket[]
  /** The tree the report stages, for the examples tables — see `Report.treeNow`. */
  treeNow: () => Node | null
  /** What the methodology states about the repo — everything but the grammar count, which is a
   *  fact about this build and is asked for here. */
  stats: Omit<ReportStats, 'grammars'>
  settled: () => boolean
  onStage: (stage: Staged | null) => void
  onClose: () => void
}) {
  const [paper, setPaper] = useState<Paper>(() => paperFor(navigator.language))
  /** The commit, once asked — `undefined` while it is being asked, `null` for no answer. */
  const [head, setHead] = useState<RepoHead | null | undefined>(undefined)
  const [phase, setPhase] = useState<'idle' | 'working' | 'saving' | 'done'>('idle')
  const [at, setAt] = useState<ReportTick | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const stop = useRef(false)
  const busy = phase === 'working' || phase === 'saving'

  /** How many grammars this build has, for the methodology — null until asked, and left out of
   *  the sentence if the list never arrives. */
  const [grammars, setGrammars] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    void languages()
      .then((l) => live && setGrammars(l.length))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // Asked when the dialog opens rather than when Export is pressed, so the dialog can say which
  // commit it is about to describe.
  useEffect(() => {
    if (!repo) {
      setHead(null)
      return
    }
    let live = true
    void repoHead(repo).then((h) => live && setHead(h))
    return () => {
      live = false
    }
  }, [repo])

  const modes = lensPages(locks)
  const skipped = (Object.keys(MODE_LABEL) as ColorMode[]).filter((m) => locks[m])
  const findingsLens = locks[mode] ? (modes[0] ?? mode) : mode
  const why = !ready
    ? 'Open a repo to export a report of it.'
    : replaying
      ? 'A report is about the repo as it stands now. Leave the replay (⌘+) to export one.'
      : groups === null
        ? 'The findings are still being counted.'
        : ''

  async function go() {
    if (!groups) return
    stop.current = false
    setError('')
    setSaved('')
    setAt(null)
    try {
      setPhase('working')
      const stamp = head !== undefined ? head : repo ? await repoHead(repo) : null
      const bytes = await buildReport({
        slug,
        head: stamp,
        paper,
        locks,
        views,
        findingsLens,
        groups,
        keyFor,
        pending,
        bucketsFor,
        treeNow,
        stats: { ...stats, grammars },
        stage: onStage,
        settled,
        cancelled: () => stop.current,
        onProgress: setAt,
      })
      setPhase('saving')
      const path = await savePdf(bytes, suggest(name))
      if (!path) {
        setPhase('idle')
        return
      }
      setSaved(path)
      setPhase('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setPhase('idle')
      if (msg !== CANCELLED) setError(msg)
    }
  }

  const pct = at && at.total > 0 ? Math.round((at.done / at.total) * 100) : 0

  return (
    <Overlay onClose={busy ? () => {} : onClose} opaque={busy}>
      <div
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[15px] font-semibold">Export a report</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            A PDF of <span className="mono">{slug}</span>
            {head && (
              <>
                {' '}
                at <span className="mono">{head.sha}</span>
                {head.dirty ? ' with uncommitted changes' : ''}
              </>
            )}
            : a contents page, a page for each of {modes.length} lens
            {modes.length === 1 ? '' : 'es'}, and the findings grouped by where they are, each
            group on a map zoomed to it.
          </p>
        </div>

        {why ? (
          <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">{why}</p>
        ) : (
          <>
            <Field label="Paper">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PAPER) as Paper[]).map((p) => (
                  <Choice
                    key={p}
                    on={paper === p}
                    disabled={busy}
                    onClick={() => setPaper(p)}
                    label={PAPER[p].label}
                  />
                ))}
              </div>
            </Field>

            {/* Said before the export rather than discovered in the file: a lens with nothing to
                show gets no page, and the contents page says why for each. */}
            {skipped.length > 0 && (
              <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                No page for {skipped.map((m) => MODE_LABEL[m]).join(', ')} — nothing to show there
                yet. The contents page says why.
              </p>
            )}

          </>
        )}

        {busy && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--secondary)]">
              <div
                className="h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${phase === 'saving' ? 100 : pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
              {phase === 'saving'
                ? 'Writing the file…'
                : at
                  ? `${at.total > 0 ? `Page ${Math.min(at.done + 1, at.total)} of ${at.total} · ` : ''}${at.what}`
                  : 'Starting…'}
            </p>
          </div>
        )}

        {saved && <p className="mono break-all text-[11px] text-[var(--muted-foreground)]">{saved}</p>}
        {error && <p className="text-[11px] leading-relaxed text-[var(--destructive)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              if (busy) stop.current = true
              else onClose()
            }}
            className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
          >
            {busy ? 'Stop' : phase === 'done' ? 'Close' : 'Cancel'}
          </button>
          <button
            disabled={busy || why !== ''}
            onClick={() => void go()}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Exporting…' : phase === 'done' ? 'Export again' : 'Export'}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
