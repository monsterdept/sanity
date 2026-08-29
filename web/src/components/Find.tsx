import { useCallback, useEffect, useRef, useState } from 'react'
import { searchProject, type Hit } from '../lib/api'

/**
 * Find a name, and fly the camera to it.
 *
 * **The request this answers, verbatim: "I need to learn about the objecter but I don't know
 * where it is."** That is not a filter and it is not a query — it is a person naming one
 * thing and asking to be taken there. So the panel has one field, the list is short, and
 * choosing a row moves the map rather than changing what the map shows. Nothing here
 * subsets the picture; the repo you were looking at is the repo you land in.
 *
 * **It flies rather than jumps because the ring transition already exists.** `zoom.ts`
 * matches every wedge that survives a change of level and moves it from where it was to
 * where it belongs — so re-rooting the map at a search result is, for free, the same motion
 * as drilling into it by hand, including the part that says WHICH wedge you went into. A
 * search that teleported would be the one navigation in this app that does not show its
 * work.
 *
 * **The search runs in Rust**, over the backend's whole tree, for the reason `search::find`
 * gives at length: a big repo is drawn from a slimmed tree with no function names in it at
 * all, so a browser-side search would come back empty on ceph — which is where the request
 * came from.
 */
export function Find({
  open,
  projectKey,
  /** True while a replay is up, which is the one state this cannot honestly serve — see the
   *  panel it renders instead. */
  replaying,
  onClose,
  onPick,
}: {
  open: boolean
  projectKey: string | null
  replaying: boolean
  onClose: () => void
  onPick: (hit: Hit) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)

  // Selected on open rather than cleared. The second search of a session is usually a
  // variation on the first — one letter off, or the same word in another repo — and a field
  // that empties itself makes the person type it twice. Selected means one keystroke still
  // replaces it.
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    input.current?.select()
  }, [open])

  /** **Debounced, and the delay is what makes the walk affordable.** Each query is a walk of
   *  the entire tree in the backend — cheap, but not cheap enough to run on every keystroke
   *  of a fast typist on a 148,000-function repo. 120ms is under the gap between keystrokes
   *  and over the length of one, so a word costs one search rather than nine.
   *
   *  Answers are dropped if the query moved on while one was in flight. Without that the
   *  list shows whichever request happened to finish last, which on a slow repo is the
   *  answer to a prefix of what is now in the box. */
  useEffect(() => {
    if (!open || !projectKey || replaying) return
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      return
    }
    let live = true
    const t = setTimeout(() => {
      void searchProject(projectKey, q, 40)
        .then((found) => {
          if (!live) return
          setHits(found)
          setAt(0)
        })
        .catch(() => {
          if (live) setHits([])
        })
    }, 120)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [open, projectKey, query, replaying])

  const choose = useCallback(
    (hit: Hit) => {
      onPick(hit)
      onClose()
    },
    [onPick, onClose],
  )

  /** Arrows move, Enter flies, Escape puts it down. Handled on the field rather than on the
   *  window: the panel owns the keyboard while it is up, and a window listener would fight
   *  the lens shortcuts for the same keys. */
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (hits.length === 0) return
      // Clamped rather than wrapped. A list you can fall off the bottom of and reappear at
      // the top of is one where holding the key down never tells you it has ended.
      setAt((i) => Math.min(hits.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))))
      return
    }
    if (e.key === 'Enter' && hits[at]) {
      e.preventDefault()
      choose(hits[at])
    }
  }

  // Keep the cursor visible when the arrows walk past the edge of the scroll box.
  useEffect(() => {
    list.current?.querySelector('[data-at="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [at, hits])

  if (!open) return null

  return (
    <>
      {/* Transparent, not dimmed. The map is the thing being navigated and a scrim over it
          would hide the answer to "where am I going" at the moment it is being asked. One
          click anywhere else puts the panel down, which is the only job this layer has. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute left-1/2 top-6 z-50 w-[min(30rem,calc(100%-3rem))] -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Find a function, file or directory"
          spellCheck={false}
          autoComplete="off"
          className="w-full bg-transparent px-3 py-2 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
        {replaying ? (
          // The finder answers a question about the repo as it stands, and a replay is
          // showing it as it stood. Flying to a wedge that exists today would land the
          // camera somewhere the frame on screen may not have — so it says which map it can
          // search and what would change it, the same way a locked lens does.
          <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            The finder searches the repo as it stands now. Leave the replay (⌘+) to use it.
          </p>
        ) : !projectKey ? (
          // No repo on screen, which is a different absence from "nothing matched" and has
          // to say so — otherwise the panel reports that a name is not in a repo nobody has
          // opened.
          <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Open a repo to search it.
          </p>
        ) : query.trim().length < 2 ? (
          <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Two letters or more. ↑↓ to choose, ⏎ to fly there.
          </p>
        ) : hits.length === 0 ? (
          // Says what was searched, not just that nothing was found: the honest failure here
          // is "that name is not in this repo", and a bare "no results" leaves somebody
          // wondering whether the search ran at all.
          <p className="border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Nothing in this repo is called <span className="mono">{query.trim()}</span>.
          </p>
        ) : (
          <div ref={list} className="max-h-[18rem] overflow-y-auto border-t border-[var(--border)]">
            {hits.map((h, i) => (
              <button
                key={h.id}
                type="button"
                data-at={i === at ? '1' : '0'}
                onMouseEnter={() => setAt(i)}
                onClick={() => choose(h)}
                className="flex w-full items-baseline gap-2 px-3 py-1 text-left text-[12px]"
                style={{
                  background: i === at ? 'var(--secondary)' : 'transparent',
                  color: 'var(--foreground)',
                }}
              >
                {/* What KIND of thing this is, in one character. A function is the thing
                    people search for and a directory is the thing they end up in, and the
                    two land you in different places — so the row says which before you
                    press Enter rather than after. */}
                <span className="mono w-3 shrink-0 text-[var(--muted-foreground)]">
                  {h.kind === 'func' ? 'ƒ' : h.kind === 'file' ? '·' : '/'}
                </span>
                <span className="shrink-0 font-medium">{h.name}</span>
                {/* The path is how you tell two functions with the same name apart, which is
                    the whole reason it is on the row. Truncated from the LEFT, because the
                    end of a path is the part that distinguishes it. */}
                <span
                  className="min-w-0 flex-1 truncate text-right text-[11px] text-[var(--muted-foreground)]"
                  dir="rtl"
                  title={h.path}
                >
                  {h.path}
                </span>
                <span className="mono shrink-0 text-[10px] text-[var(--muted-foreground)]">
                  {h.loc}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
