import { useEffect, useState } from 'react'
import { Overlay } from './Overlay'
import { CopyButton } from './Prose'
import { FAMILY } from '../lib/labelStyle'
import { commitDetail, type CommitDetail } from '../lib/api'

/**
 * One commit, opened.
 *
 * **Every row that names a commit was a dead end.** A sha, an author and a truncated subject
 * is what fits beside a timeline or under a wedge — and the next question a row like that
 * raises is always the same one, *what did that commit actually do*, whose answer was in a
 * terminal in another window. The rows are now openable wherever they appear: the lifespan
 * timeline, the blame list, the replay's log.
 *
 * **What it shows is the message and the file list, never a patch.** The question is what the
 * commit touched; a diff of a two-thousand-line refactor rendered into a modal is not an answer
 * to it, and this app already has a code view for reading source.
 *
 * Fetched on OPEN and not before. A log of a hundred rows would otherwise be a hundred `git
 * show`s for the one somebody clicks.
 */
export function CommitCard({
  repoKey,
  sha,
  onClose,
}: {
  repoKey: string | null
  sha: string
  onClose: () => void
}) {
  const [detail, setDetail] = useState<CommitDetail | null | 'loading'>('loading')
  useEffect(() => {
    if (!repoKey) {
      setDetail(null)
      return
    }
    let live = true
    setDetail('loading')
    commitDetail(repoKey, sha)
      .then((d) => {
        if (live) setDetail(d)
      })
      .catch(() => {
        if (live) setDetail(null)
      })
    return () => {
      live = false
    }
  }, [repoKey, sha])

  // Escape closes, the other half of the pair every dialog here has — `Overlay` takes the
  // backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const d = detail === 'loading' || detail === null ? null : detail
  return (
    <Overlay onClose={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-baseline gap-2 border-b border-[var(--border)] px-4 py-2.5">
          <span className="mono shrink-0 text-[12px] font-semibold">
            {d?.short ?? sha.slice(0, 8)}
          </span>
          <span
            className="min-w-0 flex-1 truncate text-[12px] text-[var(--muted-foreground)]"
            style={{ fontFamily: FAMILY }}
          >
            {d ? new Date(d.when * 1000).toLocaleString() : ''}
          </span>
          {/* The full sha, not the abbreviation on screen — what goes on the clipboard is what
              another tool needs, and eight characters is what a row had room for. */}
          {d && <CopyButton text={d.sha} title="Copy the full sha" />}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-[3px] px-1 text-[13px] leading-none text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {detail === 'loading' ? (
            <p className="text-[12px] text-[var(--muted-foreground)]">Reading the commit…</p>
          ) : !d ? (
            <p className="text-[12px] leading-relaxed text-[var(--muted-foreground)]">
              Git has nothing for <span className="mono">{sha}</span> in this repo. A shallow clone,
              a rewritten history, or a commit that only ever existed somewhere else.
            </p>
          ) : (
            <>
              <p className="text-[14px] font-semibold leading-snug" style={{ fontFamily: FAMILY }}>
                {d.subject}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {d.author} &lt;{d.email}&gt;
              </p>
              {d.body && (
                // The message as written, wrapped but not reflowed: commit bodies carry lists
                // and indented blocks, and a paragraph renderer would eat both.
                <pre
                  className="mt-3 whitespace-pre-wrap break-words border-l-2 border-[var(--border)] pl-3 text-[12px] leading-relaxed"
                  style={{ fontFamily: FAMILY }}
                >
                  {d.body}
                </pre>
              )}
              <div className="mt-4 border-t border-[var(--border)] pt-3">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                    {d.files.length} {d.files.length === 1 ? 'file' : 'files'}
                  </p>
                  <p className="mono text-[11px] tabular-nums text-[var(--muted-foreground)]">
                    <span style={{ color: 'var(--accent)' }}>+{d.added}</span> −{d.removed}
                  </p>
                </div>
                {d.files.length === 0 ? (
                  <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
                    No file list. `git show` reports none for a merge without being told which
                    parent to diff against, which is a choice this refuses to make for you.
                  </p>
                ) : (
                  d.files.map((f) => (
                    <div key={f.path} className="flex items-baseline gap-3 py-0.5">
                      <span className="mono min-w-0 flex-1 truncate text-[11px]" title={f.path}>
                        {f.path}
                      </span>
                      <span className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                        {f.added > 0 && <span style={{ color: 'var(--accent)' }}>+{f.added}</span>}
                        {f.added > 0 && f.removed > 0 && ' '}
                        {f.removed > 0 && <>−{f.removed}</>}
                        {f.added === 0 && f.removed === 0 && 'binary'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Overlay>
  )
}
