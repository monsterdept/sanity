/** The findings panel's frame: its tabs, the head of each view, and the body they scroll in.
 *
 *  Also the two things the panel does to the window — measure its column and take Escape —
 *  and `worklistOf`, which turns the catalog's answer into what the panel says. What goes
 *  inside the body is the business of the view files beside this one. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Decision, FindingGroup, Grammar, RuleView } from '../../lib/api'
import {
  blockedByNeed,
  introductions,
  mergeFindings,
  rowsCapped,
  setAsideCount,
} from '../../lib/findings'
import { Tabs } from '../Tabs'
import { blankDraft, type RuleDraft } from './RuleForm'

/** How wide a tile's text column is, in pixels, or 0 before it has been measured.
 *
 *  **Measured once for the panel, not once per tile.** Every tile is the same width — the
 *  panel is a fixed column — so an observer apiece would be fifty observers answering one
 *  question. It feeds the middle-truncation of the directory, which CSS cannot do: `…` in
 *  the MIDDLE means knowing how many characters fit, and only the layout knows that.
 *
 *  Re-attached whenever the panel opens or the view changes, because the measured element is
 *  only in the findings list. */
export function useColumnWidth(open: boolean, view: string) {
  const [colW, setColW] = useState(0)
  const column = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = column.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setColW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, view])
  return { column, colW }
}

/** Escape puts it down, on the window because this panel has no field to own the keyboard
 *  with. Registered only while it is up, so it cannot swallow the key from anything else. */
export function useEscapeCloses(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
}

/** Everything the panel says about a repo's findings, derived from the catalog's answer and
 *  the decision archive. Worked out afresh on every render the panel is open for. */
export function worklistOf(groups: FindingGroup[] | null, archive: Decision[] | null) {
  /** One tile per SUBJECT, not per finding — see `mergeFindings`, which the report numbers
   *  its list from too. */
  const items = mergeFindings(groups)

  /** The tile each rule says its background under — see `introductions`. */
  const introduces = introductions(items)

  /** What could not be asked, and what has been dealt with — the two things a worklist must
   *  say out loud rather than by being short.
   *
   *  **An empty list is ambiguous and this is what disambiguates it.** Nothing here matches,
   *  nobody has read this repo, and you have already set all of it aside are three different
   *  sentences, and a bare empty list is read as the first one every time. */
  /** What has been ignored — the two verdicts that HIDE a finding.
   *
   *  **A flag is not an archive entry.** It is a commitment to do something, and the finding
   *  it was made about is still in the list where it can be acted on; filing it under
   *  "ignored" would put every piece of work somebody signed up for in the drawer of things
   *  they decided not to do. Unflagging is done on the finding, which is where it is visible.
   */
  const ignored = (archive ?? []).filter((d) => d.verdict !== 'flagged')

  /** What could not be asked, one line per REASON rather than one per rule — see
   *  `blockedByNeed`. */
  const blocked = blockedByNeed(groups)
  const setAside = setAsideCount(groups)
  /** Rows the wire did not carry — see `rowsCapped`. */
  const capped = rowsCapped(groups)
  return { items, introduces, ignored, blocked, setAside, capped }
}

/** The switch between the findings and the rules, which is also the panel's title. */
export function PanelTabs({
  view,
  setView,
  findings,
  rules,
}: {
  view: 'findings' | 'ignored' | 'rules'
  setView: (v: 'findings' | 'ignored' | 'rules') => void
  /** The findings count as the word carries it, or null while there is nothing to count. */
  findings: string | null
  rules: RuleView[] | null
}) {
  return (
    /* **The control IS the title**, the way it is on the lens sheet — see `Tabs`. A
        heading on the left and a link on the right was two pieces of chrome saying one
        thing, and the link read as an action rather than as the other half of a switch:
        `rules` looked like something that would happen to the list.

        The count rides in the word. `Findings (54)` is one thing being named, and it names
        what is ON SCREEN — it used to read `Findings (120+)` over a list of rules, which is
        a count of something you are not looking at, with a `+` reporting that the row cap
        had bitten in the view underneath. */
    <div className="flex items-center border-b border-[var(--border)] px-4 py-2.5">
      <Tabs
        className="mx-auto"
        at={view === 'ignored' ? 'findings' : view}
        onPick={setView}
        tabs={
          // The ignored drawer is not a third position: it is a place you arrive at from
          // the findings list and go back to. A tab for it would be a room that is empty
          // on most repos, sitting in the control forever.
          [
            {
              k: 'findings' as const,
              word: `Findings${findings !== null ? ` (${findings})` : ''}`,
            },
            { k: 'rules' as const, word: `Rules${rules ? ` (${rules.length})` : ''}` },
          ]
        }
      />
    </div>
  )
}

/** The head of the list: what you are looking at, and the one thing you can do to it. */
export function ViewHeader({
  view,
  setView,
  ignored,
  canBalance,
  onBalance,
  grammar,
  rd,
}: {
  view: 'findings' | 'ignored' | 'rules'
  setView: (v: 'findings' | 'ignored' | 'rules') => void
  /** How many decisions are in the ignored drawer. */
  ignored: number
  canBalance: boolean
  onBalance: () => void
  grammar: Grammar | null
  rd: RuleDraft
}) {
  /* **A section header per view: what you are looking at, and what you can do to it.**
      The tabs above say which of the three is showing and carry the counts; this says it
      again at the head of the list, which is the line the eye lands on after pressing a
      tab — and it gives the view's one ACTION somewhere to be. `add rule` floated at the
      top of the rules list with nothing to sit against, and the way into the ignored
      drawer had a bar of its own.

      Absent while there is nothing to head: a title over an empty pane is furniture. */
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
      <span className="text-[12px] font-medium text-[var(--foreground)]">
        {view === 'rules' ? 'Rules' : view === 'ignored' ? 'Ignored' : 'Findings'}
      </span>
      {view === 'rules' ? (
        // Only when the form is not already open — the open form IS the new rule, and a
        // button that makes another one while one is being written would throw the first
        // away without saying so.
        (!rd.draft || rd.draft.id !== '') && (
          <div className="flex items-center gap-1.5">
            {canBalance && (
              <button
                type="button"
                onClick={onBalance}
                className="rounded border border-[var(--border)] px-2 py-[3px] text-[11px] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                Balance
              </button>
            )}
            <button
              type="button"
              disabled={!grammar}
              onClick={() => rd.edit(blankDraft())}
              className="rounded border border-[var(--border)] px-2 py-[3px] text-[11px] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40"
            >
              Add Rule
            </button>
          </div>
        )
      ) : ignored > 0 ? (
        // The way into the drawer, and out of it, said as the sentence it is. Absent when
        // there is nothing in there: a link to an empty room is a thing to wonder about.
        <button
          type="button"
          onClick={() => setView(view === 'ignored' ? 'findings' : 'ignored')}
          className="text-[11px] text-[var(--muted-foreground)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)] hover:decoration-current"
        >
          {view === 'ignored' ? 'back to findings' : `${ignored} ignored`}
        </button>
      ) : null}
    </div>
  )
}

/** The scrolling body of the panel, or the sentence that says why there is none.
 *
 *  **One scroller for all three views.** Switching views keeps the same element, as it did
 *  when the views were three arms of one expression, so what changes is its content. */
export function PanelBody({
  replaying,
  projectKey,
  groups,
  view,
  children,
}: {
  replaying: boolean
  projectKey: string | null
  groups: FindingGroup[] | null
  view: 'findings' | 'ignored' | 'rules'
  children: ReactNode
}) {
  if (replaying) {
    // A finding's verbs — read it, open it, go there — are all about the working tree, and
    // a frame is the repo as it stood. Rather than run the half of the catalog a frame
    // could answer, which would be silence standing in for a clean bill on the surface
    // whose whole discipline forbids that, it says which map it can speak about.
    return (
      <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
        Findings are about the repo as it stands now. Leave the replay (⌘+) to see them.
      </p>
    )
  }
  if (!projectKey) {
    return (
      <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
        Open a repo to see what is worth looking at.
      </p>
    )
  }
  if (!groups) {
    return <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">Looking…</p>
  }
  if (view === 'ignored') {
    return <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
  }
  return (
    <div /* **16px, the same inset the detail pane uses (`px-4`).** The two panes sit side by
         side on one window, and a list that framed itself differently would read as a
         different piece of software. The gap between tiles matches it rather than
         being smaller: the margin around the list and the air between its rows are the
         same measurement, so nothing is closer to its neighbour than to the edge. */
      className="min-h-0 flex-1 overflow-y-auto p-4"
    >
      {children}
    </div>
  )
}
