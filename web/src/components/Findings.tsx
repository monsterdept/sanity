/** The findings panel — what the map is telling you to do, and the rules that say so.
 *
 *  The component here holds the panel's state and composes it. The pieces live in
 *  `findings/`, one file per view and one for the frame around them. */
import { useEffect, useState } from 'react'
import type { Decision, FindingGroup, Grammar, Hit, RuleEdit, RuleView, Verdict } from '../lib/api'
import { FindingsList, type Saying } from './findings/FindingsList'
import { IgnoredList } from './findings/Ignored'
import {
  PanelBody,
  PanelTabs,
  useColumnWidth,
  useEscapeCloses,
  ViewHeader,
  worklistOf,
} from './findings/Panel'
import { useRuleDraft } from './findings/RuleForm'
import { RulesView } from './findings/RulesView'

/** What the findings panel is handed. */
interface FindingsProps {
  open: boolean
  projectKey: string | null
  /** The catalog's answer, or `null` while it is still being asked.
   *
   *  **Fetched by `App` rather than here, because the badge needs it too.** Two fetchers for
   *  one answer is two answers: a badge in the hub saying there is something to see, over a
   *  panel that has not asked yet, or worse the reverse. One owner, one number. */
  groups: FindingGroup[] | null
  /** True while a replay is up. A finding is a claim about HEAD, so this is the one state the
   *  panel cannot honestly serve — see the note it renders instead, and `Find`, which
   *  refuses for the same reason. */
  replaying: boolean
  /** Every decision made here, newest first, or `null` while it is being fetched. Flags are
   *  in it too — see `ignored`, which is what the drawer shows. */
  archive: Decision[] | null
  /** Every rule this repo runs, or `null` while it is being fetched. */
  rules: RuleView[] | null
  /** Every field and operator a clause may name, with this repo's distributions. */
  grammar: Grammar | null
  /** All three reject with the backend's own sentence rather than resolving quietly — the
   *  form shows what comes back, and stays open on a save that did not happen. */
  onSaveRule: (rule: RuleEdit) => Promise<void>
  onDeleteRule: (id: string) => Promise<void>
  onResetRule: (id: string) => Promise<void>
  /** Save the thresholds ticked in a balance, as `[rule id, value]`. */
  onApplyBalance: (thresholds: [string, number][]) => Promise<void>
  /** Remove this repo's rule changes. */
  onStock: () => Promise<void>
  onClose: () => void
  onPick: (hit: Hit) => void
  onDecide: (key: string, rule: string, verdict: Verdict, reason: string) => void
  onUndecide: (key: string, rule: string) => void
  /** The tab somebody asked the panel to open on — the dial's halves. A new object is a new
   *  ask, so it switches even to the tab it was last asked for. */
  ask?: { view: 'findings' | 'rules'; n: number } | null
}

/**
 * What the map is telling you to do.
 *
 * **The map is a good instrument for a single-lens extreme and a bad one for a
 * conjunction** — it wears one lens at a time, so "big AND surprising" or "load-bearing AND
 * unread" is a reading no amount of looking produces. That is what a finding is, and it
 * arrives as a list rather than as a thirteenth colouring because the answer to "so what"
 * is a verb and a colour has no verbs. See `docs/notes/findings.md`.
 *
 * **They are findings, not issues.** Nothing here knows that anything is wrong; it knows a
 * reader was surprised, that git has a date, that the parse counted callers. The panel says
 * look here, and says why — the word "issue" would claim a confidence nothing upstream of
 * it has got.
 *
 * **One list, one tile per thing to look at.** Grouped by rule, a function three rules
 * flagged appeared three times, and a reader counting the work saw three jobs where there is
 * one. The rules are what the tile SAYS about it instead — which is also the better sentence:
 * this is long, and knotty, and nobody could read it.
 *
 * **A rule that could not be asked is not a rule that found nothing.** Silence over unread
 * code reads as a clean bill, which is the one thing this surface must never do — so what
 * could not be asked, and what has already been ignored, are stated in the footer rather
 * than left to be inferred from a short list.
 */
export function Findings({
  open,
  projectKey,
  groups,
  replaying,
  archive,
  rules,
  grammar,
  onSaveRule,
  onDeleteRule,
  onResetRule,
  onApplyBalance,
  onStock,
  onClose,
  onPick,
  onDecide,
  onUndecide,
  ask,
}: FindingsProps) {
  /** Which of the three the panel is showing.
   *
   *  **One switch, not two booleans.** Findings, what has been ignored, and the rules that
   *  found them are three views of one thing; a pair of flags would have a fourth state that
   *  means nothing and would eventually reach it. */
  const [view, setView] = useState<'findings' | 'ignored' | 'rules'>('findings')
  useEffect(() => {
    if (ask) setView(ask.view)
  }, [ask])
  /** Which row has its reason field open, and under which verdict.
   *
   *  **A reason is asked for, and not required.** The reasons people type are the most
   *  interesting thing this feature produces, so the field opens by default — but a blank one
   *  still files, because a dismissal somebody could not be bothered to justify is better
   *  recorded than not made. */
  const [saying, setSaying] = useState<Saying>(null)
  const [reason, setReason] = useState('')
  const rd = useRuleDraft(onSaveRule, onDeleteRule, onResetRule)
  /** The balance sheet is open at the top of the rules view. */
  const [balancing, setBalancing] = useState(false)
  const { column, colW } = useColumnWidth(open, view)
  useEscapeCloses(open, onClose)

  if (!open) return null

  const choose = (hit: Hit) => {
    onPick(hit)
    onClose()
  }

  const { items, introduces, ignored, blocked, setAside, capped } = worklistOf(groups, archive)

  return (
    <>
      {/* Transparent rather than dimmed, like `Find`: the map is what these rows are about,
          and a scrim would hide the thing being pointed at. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        /* **Centred both ways.** It hung from `top-6` back when it was tall enough that the
           offset was the whole story; short, it read as a panel that had slid up. `Find` still
           hangs from the top on purpose — a search box belongs near where you typed. */
        className="absolute left-1/2 top-1/2 z-50 flex max-h-[calc(100%-9rem)] w-[min(38rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PanelTabs
          view={view}
          setView={setView}
          findings={groups && !replaying ? `${items.length}${capped ? '+' : ''}` : null}
          rules={rules}
        />
        {groups && !replaying && (
          <ViewHeader
            view={view}
            setView={setView}
            ignored={ignored.length}
            canBalance={!balancing && !!projectKey}
            onBalance={() => setBalancing(true)}
            grammar={grammar}
            rd={rd}
          />
        )}
        <PanelBody replaying={replaying} projectKey={projectKey} groups={groups} view={view}>
          {view === 'rules' ? (
            <RulesView
              projectKey={projectKey}
              rules={rules}
              archive={archive}
              grammar={grammar}
              balancing={balancing}
              setBalancing={setBalancing}
              onApplyBalance={onApplyBalance}
              onStock={onStock}
              rd={rd}
            />
          ) : view === 'ignored' ? (
            <IgnoredList ignored={ignored} onUndecide={onUndecide} />
          ) : (
            <FindingsList
              items={items}
              column={column}
              colW={colW}
              introduces={introduces}
              saying={saying}
              setSaying={setSaying}
              reason={reason}
              setReason={setReason}
              choose={choose}
              onDecide={onDecide}
              onUndecide={onUndecide}
              setAside={setAside}
              blocked={blocked}
              ruleCount={groups?.length ?? 0}
            />
          )}
        </PanelBody>
      </div>
    </>
  )
}
