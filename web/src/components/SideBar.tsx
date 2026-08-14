import { useEffect, useState } from 'react'
import { clsx } from '../lib/cn'
import { Overlay } from './Overlay'
import { SideBarHeader } from './shell/SideBarHeader'
import { readable, stopCheck, type ProjectSummary } from '../lib/api'

/**
 * Full-height left column. Its right border is the one uninterrupted vertical gutter from
 * window top to bottom; the top row does not extend across it.
 *
 * The project list is not something you curate — an agent calling `sanity_open` creates
 * an entry just by working in a repo, so this reads as a history of what has been looked
 * at. Clicking one is the manual override for going back to something no session is
 * currently driving.
 */
export function SideBar({
  projects,
  active,
  onSelect,
  onAdd,
  onRead,
  onForget,
}: {
  projects: ProjectSummary[]
  active: string | null
  onSelect: (key: string) => void
  /** Pick a repo and add it. The one way a project enters that does not involve a
   *  terminal — see the `+` below for why it exists again. */
  onAdd: () => void
  /** Open the Read dialog for a project. */
  onRead: (key: string) => void
  /** Take a project out of the list. Not a delete — see `forgetProject`. */
  onForget: (key: string) => void
}) {
  /** The right-click menu: which project, and where the pointer was. */
  const [menu, setMenu] = useState<{ key: string; x: number; y: number } | null>(null)
  /** Whose failure transcript is open. One at a time, held here rather than per row so a
   *  sheet does not vanish when the list re-renders under it. */
  const [failureFor, setFailureFor] = useState<string | null>(null)
  const failing = projects.find((p) => p.key === failureFor) ?? null

  // **Everything about a project now happens on that project's own row.**
  //
  // There was a panel under this list holding the status word, the coverage sentence, Read
  // and Stop — and it was about the SELECTED project while the list above it was about all
  // of them. Two scopes, one column: selecting `tally` and reading a run line that belongs
  // to whichever repo you last looked at is one surface answering two questions, and it had
  // already been narrowed once for exactly that reason. Narrowing it again meant putting it
  // where the subject is named.
  //
  // What the panel was really buying was a place for the mascot, which is the one element
  // here that is not per project — it is the app's own pulse. That went to the middle of
  // the map, where there is room for it and where the eye already is.
  //
  // The row shows its controls when it is the one you are pointing at or the one selected,
  // and ALWAYS while it has readers out: a run is the case where somebody needs Stop, and
  // needing to find the row with the pointer first is the wrong moment to hide a control.

  return (
    <aside
      data-tauri-drag-region
      className="shell-chrome flex h-full select-none flex-col"
      style={{
        width: 'var(--sidebar-w)',
        color: 'var(--sidebar-foreground)',
      }}
    >
      <SideBarHeader />

      {/* A pixel between rows was right when a row was a 28px strip and its neighbours were
          the only thing separating them. Each row now ends in a six-pixel progress rule, and
          at one pixel apart two of those read as one band belonging to neither project. Six
          is enough that a rule sits under the row it measures. */}
      <nav className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 [overscroll-behavior:contain]">
        {/* The `+` is back, and the reason it went is worth keeping here because it was a
            good reason. A project used to arrive exactly one way — an agent called
            `sanity_open` in the repo it was already working in — so opening by hand was a
            dead end that got you four lenses and a gray map, which is the app with its
            reason for existing removed.
            What changed is the reader. It has no filesystem and no working directory now,
            so it cannot name a repo at all, and somebody has to: adding is the entrance
            rather than a sideshow, and every project is gray until it has been read.
            The other objection was not an argument, it was a bug — this picker once took a
            whole directory of repos and set thirty minutes of CPU on fire — and it is
            guarded in `add_project` rather than avoided by removing the button. */}
        <div className="flex items-center justify-between px-2 pb-1 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-55">
            Projects
          </span>
          <button
            onClick={onAdd}
            title="Add a repo"
            className="rounded px-1 text-[13px] leading-none opacity-55 hover:opacity-100"
          >
            +
          </button>
        </div>
        {/* Now that adding is a thing you can do from here, this says how.
            It used to name the space and stop — deliberately, because the only way in was
            an agent and repeating "say study this project" two inches under the card that
            already said it was noise. With a `+` in the header the empty state has an
            action to point at, and the terminal half is worth naming beside it because
            that is where somebody standing in a repo already is. */}
        {projects.length === 0 && (
          <div className="px-2 py-1 text-[11px] leading-snug opacity-55">
            Add a repo with <span className="font-semibold">+</span>, or run{' '}
            <code>sanity init</code> in one.
          </div>
        )}
        {projects.map((p) => (
          <ProjectItem
            key={p.key}
            project={p}
            active={p.key === active}
            onRead={() => onRead(p.key)}
            onFailure={() => setFailureFor(p.key)}
            onClick={() => onSelect(p.key)}
            onContextMenu={(e) => {
              // Ours instead of WebKit's, which offers Reload and Inspect Element — a
              // developer menu shipped to everybody, on a row where the obvious gesture
              // means something else entirely.
              e.preventDefault()
              setMenu({ key: p.key, x: e.clientX, y: e.clientY })
            }}
          />
        ))}
      </nav>

      {menu && (
        /* A backdrop, not a document listener. It closes on any click including a
           right-click elsewhere, it stops that click reaching what is underneath — nobody
           means to select a project while dismissing a menu — and it disappears with the
           menu rather than living on as a listener somebody has to remember to remove. */
        <div
          className="fixed inset-0 z-50"
          onClick={() => setMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu(null)
          }}
        >
          <div
            className="absolute min-w-40 rounded-md border border-[var(--border)] bg-[var(--card)] py-1 text-[12px] shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <button
              type="button"
              className="block w-full px-3 py-1 text-left hover:bg-[var(--secondary)]"
              onClick={() => {
                onForget(menu.key)
                setMenu(null)
              }}
            >
              Remove from list
            </button>
            {/* Said here rather than behind a confirmation. The readings are committed in
                the repo and this touches neither them nor it, so the honest thing is to
                make the action cheap and explain it, not to interrupt it with a dialog
                asking about a loss that does not happen. */}
            <p className="px-3 pb-0.5 pt-1 text-[10px] leading-snug text-[var(--muted-foreground)]">
              The repo and its readings stay where they are.
            </p>
          </div>
        </div>
      )}

      {/* **A failed run says so in one line and keeps the evidence behind an icon.** The row
          can only ever describe the symptom — every cause looks like "no readings landed",
          whether the agent is signed out or the model string was rejected — so the line stays
          short and what the readers actually said goes in a sheet you open when you want it.
          Which is once, and not while watching a run work. */}
      {failing && (
        <Overlay onClose={() => setFailureFor(null)}>
          <div
            className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="text-[15px] font-semibold">Read failed · {failing.name}</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {failing.run?.ended ?? 'No readings landed.'} Please check your agent
                configuration. Output can be found below.
              </p>
            </div>
            {/* Monospace and scrollable, because it is a transcript. Wrapped rather than
                clipped: the useful sentence is as often at the end of a long line as at
                the start of a short one. */}
            <div className="max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2">
              {(failing.run?.failures ?? []).map((f, i) => (
                <pre
                  key={i}
                  className="mono whitespace-pre-wrap break-words text-[11px] leading-relaxed"
                >
                  {f}
                </pre>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setFailureFor(null)}
                className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
              >
                Close
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </aside>
  )
}


/** A row's height. It was the sibling apps' 28, which is right for a strip holding a name
 *  and a number and tight for one that also holds a button: a 20px control in a 28px row
 *  leaves four pixels either side, so the button reads as filling the row rather than
 *  sitting in it. The type is unchanged — this is breathing room, not a bigger list.
 *
 *  It grew again with the progress rule. The rule is six pixels of the row's own height, so
 *  a row that fitted a button before now fits a button standing on a kerb — the content has
 *  to clear the band, not share it. */
const ROW_H = 40

/** One project, and everything you can do to it.
 *
 *  Matches the sibling apps' nav rows: a rounded strip inside the column's own
 *  padding, with the count that matters pushed to the right. What is new is that the right
 *  end is a slot rather than a number — the count when nothing is going on, the run when
 *  there is one, and a control beside either when this is the row you are on.
 *
 *  **A div and not a button.** Read and Stop are real buttons and a button inside a button
 *  is not a thing the platform will render; the row carries the role and the key handling
 *  instead, which is what the nesting costs.
 */
function ProjectItem({
  project,
  active,
  onClick,
  onContextMenu,
  onRead,
  onFailure,
}: {
  project: ProjectSummary
  active: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  /** Open the Read dialog for this project. */
  onRead: () => void
  /** Open the transcript of the last run's failures. */
  onFailure: () => void
}) {
  const [hover, setHover] = useState(false)
  /** Stop was pressed here. The backend's `stopping` is the authority — a terminal tailing
   *  the same run sees it too — and this only covers the second before the next poll carries
   *  it. Without it, pressing Stop looked like pressing nothing. */
  const [asked, setAsked] = useState(false)

  const total = readable(project)
  const done = total > 0 && project.assessed >= total
  const left = total - project.assessed
  const run = project.run
  const running = !!run?.running
  // **A wave that has ended is not finished while its readers are alive.** Stop marks the
  // run ended immediately — that is what makes the button feel connected — but each reader
  // is a coding agent mid-call, and they take a few seconds to die. `live` is the backend's
  // count of processes it has not yet reaped, so this covers a run that ended any way at
  // all — stopped, limited, or finished — and it clears itself.
  const winding = !!run && !running && (run.live ?? 0) > 0
  const stopping = asked || !!run?.stopping || winding
  // Anything with readers attached to it. Read must not come back while the last wave's
  // processes are still exiting, or pressing it starts a second one over the top of them.
  const busy = running || stopping
  // Readers out on THIS project, whichever one is selected. A run is a fact about a repo,
  // not about the pane you happen to be looking at.
  const reading = busy || (project.reading?.length ?? 0) > 0
  const failed = !busy && (run?.failures?.length ?? 0) > 0
  // The row's own controls. Shown for the row under the pointer and the selected one — and
  // unconditionally while a run is on, because Stop is the one control somebody goes
  // looking for in a hurry and hunting for it with the mouse first is the wrong game.
  const open = hover || active || busy

  useEffect(() => {
    if (!running) setAsked(false)
  }, [running])

  // **The run, not the backlog, while a wave is on.** "457 unread" is the answer to a
  // question nobody is asking mid-wave — it barely moves — and what somebody wants to know
  // is whether readers are actually alive and working. The backlog comes back the moment
  // the wave does not need the slot.
  //
  // Short, because this column is 220px and truncation eats the number that matters:
  // "3 readers still run…" told you nothing that "3 exiting" does not.
  const status = project.loading
    ? project.read_total > 0
      ? `${Math.round((project.read_done / project.read_total) * 100)}%`
      : 'reading…'
    : stopping
      ? `${run?.live ?? 0} exiting`
      : running
        ? // Failures are named rather than folded into "started". A misconfigured agent
          // exits instantly, so a run with nothing landing looks merely slow — this is the
          // one number that tells the two apart.
          `${run!.spawned} started`
        : failed
          ? 'Read failed'
          : open
            ? left === 0
              ? 'Fully read'
              : `${left.toLocaleString()} unread`
            : `${project.assessed}/${total}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={
        project.loading
          ? `${project.repo} · reading…`
          : `${project.repo} · ${project.assessed} of ${total} read` +
            (project.stale > 0 ? ` · ${project.stale} stale` : '') +
            // Why a run stopped, kept where the run is. "Ended" and "ended because three
            // waves in a row banked nothing" are different outcomes and only one is
            // finished. In the tooltip rather than the row: the row has one slot and the
            // live numbers have the better claim on it.
            (run?.ended && !busy ? ` · ${run.ended}` : '') +
            (busy && (run?.failed ?? 0) > 0 ? ` · ${run!.failed} failed` : '')
      }
      className={clsx(
        'relative flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] transition-colors',
        active ? 'shell-chrome--active' : 'shell-chrome--hover',
      )}
      style={{ height: ROW_H, color: active ? 'var(--foreground)' : 'var(--muted-foreground)' }}
    >
      {/* **A rule along the bottom edge, not a fill behind the row.**
          Every project's progress belongs in the list, because the list is the only surface
          here about more than one project.
          It cannot be a stacked bar, which is what put these rows on two lines and stopped
          the sidebar reading like a list. It also cannot be a background fill, which is what
          this was first: selection is a lighter block behind the row, so a partial lighter
          block behind the row is the same visual idea at a different width, and a
          half-finished project read as half-selected.
          An edge rule shares nothing with either. It is inside the row's own height, so it
          still costs nothing, and it is drawn in the mark color readings already use rather
          than the accent that means "selected".
          Six pixels rather than two: at a hairline the one thing this is FOR — how far along
          a repo is — had to be looked for, and the sweep that rides in the same band had
          almost no room to read as movement. The row grew to hold a button and can spend it. */}
      {!project.loading && total > 0 && project.assessed > 0 && (
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-[6px] rounded-full"
          style={{
            width: `${Math.min(100, (project.assessed / total) * 100)}%`,
            background: 'var(--agent-mark)',
            // Brighter while readers are out: the rule is the thing that moves during a
            // run, so it should be the thing you notice.
            opacity: reading ? 0.95 : 0.6,
            transition: 'width 400ms ease-out, opacity 200ms',
          }}
        />
      )}
      {/* **A sweep along the whole edge while readers are out.** The pulsing icon was the
          only sign, and an 11px glyph changing opacity is not enough to catch an eye that is
          somewhere else — which is the entire job, because the project being read is usually
          not the one on screen.
          Full width rather than along the unread remainder: at 832 of 869 the remainder is
          four pixels, and the signal would be loudest on the runs that have barely started
          and invisible on the ones about to finish. Movement across the row reads the same
          at any coverage, and it sits under the fill rather than replacing it, so "how far
          along" and "working right now" stay two separate readings. */}
      {reading && (
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[6px] overflow-hidden">
          <span
            className="reading-sweep absolute inset-y-0 w-1/4"
            style={{
              background:
                'linear-gradient(90deg, transparent, var(--accent), transparent)',
            }}
          />
        </span>
      )}
      {/* An icon, because tally's rows have one and their absence is most of why a
          bare list does not read as navigation. It pulses while that project has readers
          out, which is what tells you a repo is being worked on when it is not the one on
          screen. */}
      <span className={clsx('relative shrink-0 text-[11px] opacity-70', reading && 'reading-pulse')}>
        ◍
      </span>
      <span className="mono relative min-w-0 flex-1 truncate">{project.name}</span>

      {/* The right end of the row. A count of 0/0 would be a measurement and nothing has
          measured this yet — the restore is still rescanning it — so `status` says so
          instead. */}
      <span
        className="relative shrink-0 truncate text-[10px] tabular-nums"
        style={{
          color: failed
            ? 'var(--warning)'
            : busy
              ? 'var(--accent)'
              : done && !open
                ? 'var(--agent-mark)'
                : 'inherit',
          opacity: failed || busy || (done && !open) ? 1 : 0.55,
        }}
      >
        {status}
      </span>

      {/* The transcript, against the SENTENCE that names the failure rather than out at the
          row's edge — it belongs to the words it explains. */}
      {failed && open && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFailure()
          }}
          title="What the readers said"
          aria-label="What the readers said"
          className="relative shrink-0 rounded-full border border-current px-[5px] text-[10px] leading-[1.3] text-[var(--warning)] opacity-80 hover:opacity-100"
        >
          i
        </button>
      )}

      {open && !busy && !project.loading && left > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRead()
          }}
          className="relative shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
          style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          Read
        </button>
      )}
      {/* Stop kills the readers rather than letting the wave finish. They are coding agents
          spending tokens by the minute, so a "stop" that means "in a few minutes" is not
          what anybody pressing this wants — the reading in flight is lost, which is the
          cheaper half of that trade.
          Always "Stop", disabled while it happens: the slot beside it already says
          "3 exiting", and a button that relabels itself would be the same fact twice. */}
      {busy && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setAsked(true)
            void stopCheck(project.key).catch(() => setAsked(false))
          }}
          disabled={stopping}
          className="relative shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
        >
          Stop
        </button>
      )}
    </div>
  )
}
