import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  decideFinding,
  deleteRule,
  projectDecisions,
  projectReport,
  resetRule,
  saveRule,
  undecideFinding,
  type Decision,
  type FindingGroup,
  type Grammar,
  type RuleView,
  type Verdict,
} from '../lib/api'

/** What the findings panel and the hub's badge show, and every write that changes it. */
export function useFindings({
  activeKey,
  treeRev,
  assessed,
  historyOn,
}: {
  activeKey: string | null
  treeRev: number
  /** The active project's reading count — see the effect below for why it is asked on. */
  assessed: number | undefined
  historyOn: boolean
}) {
  const [findingsOpen, setFindingsOpen] = useState(false)
  /** Which tab the panel was last asked to open on. `n` counts the asks, so asking for the tab
   *  it was already asked for still switches back to it after the reader has moved off. */
  const [findingsAsk, setFindingsAsk] = useState<{ view: 'findings' | 'rules'; n: number } | null>(null)
  const [findingGroups, setFindingGroups] = useState<FindingGroup[] | null>(null)
  const [archive, setArchive] = useState<Decision[] | null>(null)
  /** Bumped after a dismissal lands, to re-ask for both halves.
   *
   *  **Re-asked rather than patched in place.** Setting a finding aside changes the list, the
   *  archive, every group's marginal count and the number in the hub — and a local edit
   *  that got any one of those wrong would leave the panel disagreeing with `.sanity/`, which
   *  is the failure this store is most careful about. One extra walk of a tree that is
   *  already in memory is the cheaper mistake. */
  const [archiveAt, setArchiveAt] = useState(0)
  const [rules, setRules] = useState<RuleView[] | null>(null)
  /** Every field and operator a clause may name, with this repo's numbers. Null until asked.
   *
   *  **Asked once per project, not on every scan.** The field LIST is a property of the
   *  binary; only the distributions move, and a picker that re-fetched on every landed
   *  reading would be re-fetching a constant to keep a tooltip current. */
  const [grammar, setGrammar] = useState<Grammar | null>(null)

  /** Ask the backend what is worth looking at here — findings, rules and grammar at once.
   *
   *  **One call, because it is one answer.** These were three effects on three commands, and
   *  each command built the whole fact set for itself: three walks of the tree, under one
   *  lock, which on kibana is 540,000 records to answer three questions about one repo. They
   *  are also the same measurement seen three ways — the counts in the grid, the tiles in the
   *  list and the number in the hub — so three fetches were three chances for them to
   *  describe different states of the repo.
   *
   *  **Asked when the ANSWER could have changed, never on the tree's identity.** It was keyed
   *  on `tree`, and the object behind that is rebuilt every time a ring arrives or a reading
   *  lands — `treeRev`'s own doc says so: *a new object for the same repo several times a
   *  minute*. One project sitting still produced eighty reports in a burst, each of them
   *  taking the projects lock, cloning the whole answer and serialising it across the bridge
   *  to say what the last one said.
   *
   *  So it asks on the three scalars that mean a different answer: the tree ARRIVING
   *  (`treeRev`, which is a repo changing rather than a repo being decorated), how many
   *  readings have landed (a tier 2 rule is dark until the first one and different after each),
   *  and `archiveAt`, which the window bumps whenever it writes a rule or a decision.
   *
   *  Answers are dropped if the project moved on while one was in flight, or the dot on one
   *  repo would be reporting another's.
   *
   *  Not asked at all during a replay: the panel refuses that state, and a badge over a frame
   *  would be pointing at findings about a repo that is not the one on screen. */
  useEffect(() => {
    if (!activeKey || historyOn) {
      setFindingGroups(null)
      setRules(null)
      setGrammar(null)
      return
    }
    let live = true
    void projectReport(activeKey)
      .then((r) => {
        if (!live) return
        setFindingGroups(r.groups)
        setRules(r.rules)
        setGrammar(r.grammar)
      })
      .catch(() => {
        if (!live) return
        setFindingGroups(null)
        setRules(null)
        setGrammar(null)
      })
    return () => {
      live = false
    }
  }, [activeKey, treeRev, assessed, historyOn, archiveAt])

  useEffect(() => {
    if (!activeKey) {
      setArchive(null)
      return
    }
    let live = true
    void projectDecisions(activeKey)
      .then((a) => {
        if (live) setArchive(a)
      })
      .catch(() => {
        if (live) setArchive(null)
      })
    return () => {
      live = false
    }
  }, [activeKey, archiveAt])

  /** File a decision, then re-ask. **The refresh is inside the `then`**: a write that failed
   *  must not leave the panel showing a finding as dealt with, which is exactly what an
   *  optimistic update would do. */
  const decide = useCallback(
    (key: string, rule: string, verdict: Verdict, reason: string) => {
      if (!activeKey) return
      void decideFinding(activeKey, key, rule, verdict, reason)
        .then(() => setArchiveAt((n) => n + 1))
        .catch(() => {})
    },
    [activeKey],
  )

  const undecide = useCallback(
    (key: string, rule: string) => {
      if (!activeKey) return
      void undecideFinding(activeKey, key, rule)
        .then(() => setArchiveAt((n) => n + 1))
        .catch(() => {})
    },
    [activeKey],
  )

  /** Write one rule back, then re-ask everything that depends on it.
   *
   *  **The refresh is inside the `then`, and the rejection is passed on rather than
   *  swallowed.** `apply_edit` refuses a rule that is not a rule — a clause true of
   *  everything, a token the rule cannot fill — with a sentence meant to be read; catching it
   *  here would close the form on a save that never happened.
   *
   *  `archiveAt` is what both the rules grid and the findings list watch, so one bump is the
   *  whole invalidation: a changed rule is a different answer on the next ask, by
   *  construction rather than by anything remembering to expire. */
  const writeRule = useCallback(
    (rule: Parameters<typeof saveRule>[1]) => {
      if (!activeKey) return Promise.reject(new Error('no project'))
      return saveRule(activeKey, rule).then(() => {
        setArchiveAt((n) => n + 1)
      })
    },
    [activeKey],
  )

  const removeRule = useCallback(
    (id: string) => {
      if (!activeKey) return Promise.reject(new Error('no project'))
      return deleteRule(activeKey, id).then(() => {
        setArchiveAt((n) => n + 1)
      })
    },
    [activeKey],
  )

  const restoreRule = useCallback(
    (id: string) => {
      if (!activeKey) return Promise.reject(new Error('no project'))
      return resetRule(activeKey, id).then(() => {
        setArchiveAt((n) => n + 1)
      })
    },
    [activeKey],
  )

  /** How many rules are actually asking something here — the number at six o'clock on the
   *  dial, and the denominator the count at twelve is missing without it.
   *
   *  Silenced rules are not counted: the grid lists them so they can be found again, but a
   *  rule that has been turned off did not contribute to the number beside it. */
  const liveRules = useMemo(() => rules?.filter((r) => r.on).length ?? 0, [rules])

  /** How long the worklist is: distinct things to look at, not findings.
   *
   *  **Counted the way the panel counts them, because it is the same number.** A function
   *  three rules flagged is one tile and has to be one on the badge too — a bubble saying 90
   *  over a list of 60 is the map and the key disagreeing about one repo, which is the
   *  failure this surface keeps legislating against.
   *
   *  Already the undismissed count: the backend drops archived findings before it ranks or
   *  counts anything, so this is what goes down when somebody deals with one. A blocked rule
   *  contributes nothing — it found nothing because it could not RUN, and counting that as
   *  zero is the same sentence as a clean bill. */
  const findingTotal = findingGroups
    ? new Set(findingGroups.filter((g) => !g.blocked).flatMap((g) => g.hits.map((l) => l.key))).size
    : 0

  /** Open the findings panel on one of its tabs — the dial's two halves each open their own. */
  const openFindings = useCallback((view: 'findings' | 'rules' = 'findings') => {
    setFindingsAsk((a) => ({ view, n: (a?.n ?? 0) + 1 }))
    setFindingsOpen(true)
  }, [])

  /** What the hub's badge says, and what a click on it opens — see `Sunburst`'s `findings`.
   *
   *  **Memoised because it reaches the sunburst**, which is a few thousand arcs: a fresh object
   *  per render would redraw the whole map to carry three numbers that did not change. */
  const findingsForMap = useMemo(
    () => ({ count: findingTotal, rules: liveRules, onOpen: openFindings }),
    [findingTotal, liveRules, openFindings],
  )

  return {
    findingsOpen,
    setFindingsOpen,
    findingsAsk,
    findingGroups,
    archive,
    rules,
    grammar,
    decide,
    undecide,
    writeRule,
    removeRule,
    restoreRule,
    findingsForMap,
  }
}
