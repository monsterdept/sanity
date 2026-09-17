import type { Added, TraceCost } from '../../lib/api'
import { setExplainTrace } from '../../lib/api'
import { Overlay } from '../Overlay'

/** The one thing dropping the `.git` requirement gave up: a folder holding many repos
 *  scans all of them, which is minutes of CPU and one map of unrelated code. Asked
 *  rather than refused — somebody may mean it — and asked with the count and a few
 *  names, because "39 repos (Alka, ComfyUI, ExitNoder, …)" is a different sentence
 *  from "this is a big folder". */
export function BigFolderDialog({
  bigFolder,
  setBigFolder,
  takeFolder,
}: {
  bigFolder: Added
  setBigFolder: (a: Added | null) => void
  takeFolder: (path: string, key: string) => void
}) {
  return (
    <Overlay onClose={() => setBigFolder(null)}>
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold">
          That folder holds {bigFolder.holds} repos
        </div>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          <code>{bigFolder.path}</code> contains {bigFolder.names.join(', ')}
          {bigFolder.holds > bigFolder.names.length ? ' and others' : ''}. Scanning it reads all
          of them — several minutes, and one map of unrelated code. Adding one of the repos
          inside it is usually what you want.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setBigFolder(null)}
            className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onClick={() => takeFolder(bigFolder.path, bigFolder.key)}
            className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Scan it anyway
          </button>
        </div>
      </div>
    </Overlay>
  )
}

/** **WHAT ADDING A BIG REPO IS ABOUT TO DO, before it does it.**
 *  Three processes, three costs, and only the first is unconditional: the map is
 *  parsed from the files and appears; the history is read from git and this one is
 *  over the budget, so it waits here rather than spending a minute of somebody's
 *  machine on a repo they have just pointed at; the readings cost tokens and an agent
 *  and are never automatic at any size.
 *  The numbers are this repo's own — see `estimateTrace`, which prices a repo nobody
 *  has walked from its packed object count and costs nothing. It is an estimate and it
 *  says so with a tilde: printing `17s` for an inference would be the instrument
 *  claiming a stopwatch it has not got.
 *  The checkbox hides this EXPLANATION and not the choice. A big repo added with it
 *  ticked still arrives with its history unread and its own row still says so — which
 *  is the property that makes ticking it safe, and the reason it is not phrased as
 *  "always trace". */
export function BigHistoryDialog({
  bigHistory,
  setBigHistory,
  hideExplain,
  setHideExplain,
  takeFolder,
}: {
  bigHistory: { added: Added; cost: TraceCost }
  setBigHistory: (b: { added: Added; cost: TraceCost } | null) => void
  /** Held by the caller rather than here: the box stays as it was left across openings. */
  hideExplain: boolean
  setHideExplain: (on: boolean) => void
  takeFolder: (path: string, key: string) => void
}) {
  return (
    <Overlay onClose={() => setBigHistory(null)}>
      <div
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold">This repo has a lot of history</div>
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          Sanity does three things to a repo, and they cost very different amounts.
        </p>
        <ul className="flex flex-col gap-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          <li>
            <b className="text-[var(--foreground)]">Scan</b> parses every file and draws the
            map. It happens now, and it does not read git at all.
          </li>
          <li>
            <b className="text-[var(--foreground)]">Trace</b> reads the commit log, which is
            what gives each wedge an age, a churn and an author. Here that is about{' '}
            <b className="text-[var(--foreground)]">
              {bigHistory.cost.seconds < 60
                ? `${Math.max(1, Math.round(bigHistory.cost.seconds))} seconds`
                : `${Math.round(bigHistory.cost.seconds / 60)} minutes`}
            </b>
            {bigHistory.cost.cold ? ', estimated from the size of its object store' : ''} — past
            what Sanity will spend without being asked, so the map arrives without those lenses
            and the row carries a <b className="text-[var(--foreground)]">Trace</b> button.
          </li>
          <li>
            <b className="text-[var(--foreground)]">Read</b> puts an agent over the code to
            measure how predictable it is. It costs tokens, it is always your call, and no size
            of repo changes that.
          </li>
        </ul>
        <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <input
            type="checkbox"
            checked={hideExplain}
            onChange={(e) => setHideExplain(e.target.checked)}
          />
          Don’t explain this again
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setBigHistory(null)}
            className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Written on the way through, not on the tick: cancelling leaves the
              // preference where it was, because dismissing a dialog is not answering it.
              if (hideExplain) void setExplainTrace(false).catch(() => {})
              takeFolder(bigHistory.added.path, bigHistory.added.key)
              setBigHistory(null)
            }}
            className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Add repo
          </button>
        </div>
      </div>
    </Overlay>
  )
}

/** What the menu's Install Command Line Tool… did. A menu action with no visible
 *  outcome is indistinguishable from one that did nothing — and the outcome here is
 *  not simply "worked": the link may have landed somewhere no shell looks, or lost to
 *  another install that comes first on PATH. */
export function CliLinkDialog({
  cliLink,
  setCliLink,
}: {
  cliLink: { text: string; path?: string }
  setCliLink: (c: null) => void
}) {
  return (
    <Overlay onClose={() => setCliLink(null)}>
      <div
        className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold">Command line tool</div>
        {/* Prose, with the path as code inside it. It was the whole message in
            monospace, which set a sentence like a transcript and wrapped a path across
            two lines in the middle of it. */}
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          {cliLink.text}{' '}
          {cliLink.path && <code className="text-[var(--foreground)]">{cliLink.path}</code>}
        </p>
        <div className="flex justify-end">
          <button
            onClick={() => setCliLink(null)}
            className="rounded-md bg-[var(--secondary)] px-3 py-1.5 text-xs font-semibold hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </Overlay>
  )
}
