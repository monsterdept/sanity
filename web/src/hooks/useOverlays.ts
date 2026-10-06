import { useCallback, useState } from 'react'
import type { Added, TraceCost } from '../lib/api'
import type { CliLink } from './useWindowChrome'

/** Which overlay is up: everything summoned over the map or the window and dismissed again —
 *  the finder, the findings panel, the lens help, the code view, the Read dialog, the report,
 *  and the three dialogs that ask before something costly or one-off happens.
 *
 *  **Session state, and none of it has an input.** That is why it is held first rather than
 *  beside whatever raises it: a dialog is raised from the sidebar, the menu, the map and the
 *  keyboard, and each of those layers is handed the setter rather than owning a copy.
 *
 *  One `useState` apiece rather than a reducer. No two of them move together except the
 *  findings panel and the tab it opens on, which `openFindings` sets as one; and every
 *  consumer already takes a React setter, whose identity never changes. */
export function useOverlays() {
  /** Whether the finder is up. Session state and nothing more — a search box that
   *  remembered it was open would greet a launch with a panel over the map. */
  const [finding, setFinding] = useState(false)
  /** Whether the lens help is up — see `LensHelp`. Session state: it is a thing you read
   *  once, not a preference. */
  const [helping, setHelping] = useState(false)
  /** A function to scroll to once the code view is up.
   *
   *  Carries a nonce because the request is an EVENT, not a state: double-clicking the
   *  same function twice has to scroll back to it both times, and a bare id would look
   *  unchanged the second time and do nothing. */
  const [reveal, setReveal] = useState<{ id: string; n: number } | null>(null)
  /** The file whose code is open over the map, by node id. */
  const [codeFile, setCodeFile] = useState<string | null>(null)
  /** The Read dialog, for the project it was opened from. */
  const [readFor, setReadFor] = useState<string | null>(null)
  /** The report dialog is up — File → Export Report as PDF…. */
  const [reporting, setReporting] = useState(false)
  const [findingsOpen, setFindingsOpen] = useState(false)
  /** Which tab the findings panel was last asked to open on. `n` counts the asks, so asking for
   *  the tab it was already asked for still switches back to it after the reader has moved off. */
  const [findingsAsk, setFindingsAsk] = useState<{ view: 'findings' | 'rules'; n: number } | null>(null)
  /** Open the findings panel on one of its tabs — the dial's two halves each open their own. */
  const openFindings = useCallback((view: 'findings' | 'rules' = 'findings') => {
    setFindingsAsk((a) => ({ view, n: (a?.n ?? 0) + 1 }))
    setFindingsOpen(true)
  }, [])
  /** A chosen folder that holds several repos, waiting to be confirmed. */
  const [bigFolder, setBigFolder] = useState<Added | null>(null)
  /** A repo whose history is over the budget, and what it would cost — see the dialog. */
  const [bigHistory, setBigHistory] = useState<{ added: Added; cost: TraceCost } | null>(null)
  /** Ticked in that dialog. Written on the way out rather than on every click, so cancelling
   *  leaves the preference where it was: dismissing a dialog is not answering it. */
  const [hideExplain, setHideExplain] = useState(false)
  /** What the menu's Install Command Line Tool… reported — see `useCliInstall`. */
  const [cliLink, setCliLink] = useState<CliLink | null>(null)

  return {
    finding,
    setFinding,
    helping,
    setHelping,
    reveal,
    setReveal,
    codeFile,
    setCodeFile,
    readFor,
    setReadFor,
    reporting,
    setReporting,
    findingsOpen,
    setFindingsOpen,
    findingsAsk,
    openFindings,
    bigFolder,
    setBigFolder,
    bigHistory,
    setBigHistory,
    hideExplain,
    setHideExplain,
    cliLink,
    setCliLink,
  }
}

export type Overlays = ReturnType<typeof useOverlays>
