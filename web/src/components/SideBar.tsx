import { useEffect, useState } from 'react'
import { clsx } from '../lib/cn'
import { AgentMascot } from './AgentMascot'
import { Overlay } from './Overlay'
import { SideBarHeader } from './shell/SideBarHeader'
import { readable, stopCheck, type AgentActivity, type ProjectSummary } from '../lib/api'

/**
 * Full-height left column. Its right border is the one uninterrupted vertical gutter from
 * window top to bottom; the top row does not extend across it.
 *
 * The project list is not something you curate — an agent calling `sanity_open` creates
 * an entry just by working in a repo, so this reads as a history of what has been looked
 * at. Clicking one is the manual override for going back to something no session is
 * currently driving.
 */
/** The mascot in the agent panel, and how far it has to drop to stand on the type.
 *
 *  `align-items: last baseline` puts a replaced element's BOX bottom on the baseline, and
 *  the mascot is a 3D render into a square canvas with room beneath it — so aligned
 *  honestly it floats above the line. The offset pushes the box down by that empty part
 *  so the creature's shadow lands on the baseline instead of the canvas edge.
 *
 *  Expressed as a FRACTION of the size, not a pixel count: the empty margin is part of
 *  the render, so it scales with the sprite, and a fixed pixel value silently drifts
 *  every time the size changes. Eyeballed — the sprite comes from the mascots bundle as
 *  a 3D render, so there is nothing to measure statically. */
// Sized against the LABEL, not for its own sake. Standing on the last baseline, a
// mascot taller than the two lines of type pushes the label's top down by the
// difference — at 46 that was about 10px and the text read as sagging under it. Close
// to the label's own height, the two sit level.
const MASCOT_SIZE = 40
const MASCOT_FLOOR_OFFSET = Math.round(MASCOT_SIZE * 0.2)

export function SideBar({
  projects,
  active,
  onSelect,
  agent,
  onAdd,
  onRead,
  onForget,
}: {
  projects: ProjectSummary[]
  active: string | null
  onSelect: (key: string) => void
  agent: AgentActivity
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

  // One bar per project actually being worked, not one bar for the app.
  //
  // There was a single bar, first for "the first unfinished project in the list" and then
  // for "whichever one the app calls active" — both of which answer a question nobody
  // asked once two sessions can run at once. They can now: calls route by project, so two
  // agents on two repos make independent progress, and a single bar has to pick a winner
  // and be wrong about the other.
  //
  // There is no fallback to whatever is on screen. It was there so the quiet case "still
  // said something", but the panel already says it — an asleep mascot and the word
  // sleeping — and the coverage is on the project's own row two inches above. What the
  // fallback added was a second meaning for the same bar depending on whether anything
  // was working ("being read now" against "what you clicked"), and, because it did not
  // look at completeness, a full bar under a sleeping mascot on any finished project you
  // happened to have selected. Absent, the bar means one thing and its absence means
  // nobody is reading.
  const bars = projects.filter((p) => p.working && readable(p) > 0)

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

      <nav className="mt-1 min-h-0 flex-1 space-y-px overflow-y-auto px-2 [overscroll-behavior:contain]">
        {/* The `+` is back, and the reason it went is worth keeping here because it was a
            good reason. A project used to arrive exactly one way — an agent called
            `sanity_open` in the repo it was already working in — so opening by hand was a
            dead end that got you four lenses and a grey map, which is the app with its
            reason for existing removed.
            What changed is the reader. It has no filesystem and no working directory now,
            so it cannot name a repo at all, and somebody has to: adding is the entrance
            rather than a sideshow, and every project is grey until it has been read.
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

      <AgentPanel
        project={projects.find((p) => p.key === active) ?? null}
        agent={agent}
        onRead={onRead}
        bars={bars}
      />
    </aside>
  )
}

/** One project. Matches the sibling apps' nav rows: a rounded 28px strip inside the
 *  column's own padding, with the count that matters pushed to the right. */
function ProjectItem({
  project,
  active,
  onClick,
  onContextMenu,
}: {
  project: ProjectSummary
  active: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const done = readable(project) > 0 && project.assessed >= readable(project)
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={
        project.loading
          ? `${project.repo} · reading…`
          : `${project.repo} · ${project.assessed} of ${readable(project)} read` +
            (project.stale > 0 ? ` · ${project.stale} stale` : '')
      }
      className={clsx(
        'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
        active ? 'shell-chrome--active' : 'shell-chrome--hover',
      )}
      style={{ height: 28, color: active ? 'var(--foreground)' : 'var(--muted-foreground)' }}
    >
      {/* An icon, because tally's rows have one and their absence is most of why a
          bare list does not read as navigation. */}
      <span className="shrink-0 text-[11px] opacity-70">◍</span>
      <span className="mono flex-1 truncate">{project.name}</span>
      {/* A count of 0/0 would be a measurement, and nothing has measured this yet — the
          restore is still rescanning it. Say so instead. */}
      {project.loading ? (
        <span className="shrink-0 text-[10px] tabular-nums opacity-45">
          {project.read_total > 0
            ? `${Math.round((project.read_done / project.read_total) * 100)}%`
            : 'reading…'}
        </span>
      ) : (
        <span
          className="shrink-0 text-[10px] tabular-nums"
          style={{ color: done ? 'var(--agent-mark)' : 'inherit', opacity: done ? 1 : 0.55 }}
        >
          {project.assessed}/{readable(project)}
        </span>
      )}
    </button>
  )
}

/**
 * One panel for everything happening: what Sanity is reading, and who is asking.
 *
 * **It was two, stacked, saying the same thing.** The agent panel lit up "AGENT IS
 * WORKING" whenever anything called over MCP — and once Sanity spawned its own readers,
 * they were the things calling, so it fired during every run directly beneath a strip that
 * already said so with numbers. Two indicators for one fact, and the more precise one was
 * the one without the mascot on it.
 *
 * Merged, the states are one ladder rather than two overlapping ones: reading, stopping,
 * or nothing at all. The mascot animates on the same tool calls it
 * always did — which during a run are the readers' own, which is exactly right.
 *
 * **The gear is gone with the sheet it opened.** It offered to connect a chat client, which
 * was the way in when an agent had to drive the assessment; Sanity spawns its own readers
 * now, so connecting one buys the ability to ask for a run in a conversation and nothing
 * else. A permanent control in the smallest panel on screen is too much rent for that, and
 * a settings affordance that leads to one optional integration teaches people to look there
 * for settings that do not exist. The MCP server is still there for anyone who wants it.
 */
function AgentPanel({
  project,
  agent,
  onRead,
  bars,
}: {
  project: ProjectSummary | null
  agent: AgentActivity
  onRead: (key: string) => void
  bars: ProjectSummary[]
}) {
  const run = project?.run ?? null
  const [asked, setAsked] = useState(false)
  /** The failure details sheet. Closed by default: a run that failed has already said so
   *  in one line, and the transcript is for when somebody goes looking. */
  const [showFailure, setShowFailure] = useState(false)
  // The backend's `stopping` is the authority — a terminal tailing the same run sees it
  // too — and `asked` only covers the second before the next poll carries it. Without it,
  // pressing Stop looked like pressing nothing.
  const running = !!run?.running
  // **A wave that has ended is not finished while its readers are alive.** Stop marks the
  // run ended immediately — that is what makes the button feel connected — but each reader
  // is a coding agent mid-call, and they take a few seconds to die. Those seconds used to
  // read as "Working": `running` had gone false, so the label fell through to the MCP
  // chatter rung, which was the readers' own last calls. The panel said the thing had
  // started again at exactly the moment it was shutting down.
  //
  // `live` is the backend's count of processes it has not yet reaped, so this covers a run
  // that ended any way at all — stopped, limited, or finished — and it clears itself.
  const winding = !!run && !running && (run.live ?? 0) > 0
  const stopping = asked || !!run?.stopping || winding
  // Anything with readers attached to it. The Read button must not come back while the
  // last wave's processes are still exiting, or pressing it starts a second one over the
  // top of them.
  const busy = running || stopping
  useEffect(() => {
    if (!running) setAsked(false)
  }, [running])

  const total = project ? readable(project) : 0
  const left = project ? total - project.assessed : 0
  // **Three states, and no "AGENT IS".** The prefix was two thirds of the line, on the
  // narrowest panel in the app, and it wrapped every label onto three ragged lines to
  // repeat a subject the mascot beside it already establishes. What is left is the verb.
  //
  // Five rungs collapsed to three. "Reading" and "Agent is working" were the same state
  // described twice — during a run the MCP chatter IS the run — and "Agent not connected"
  // named an optional integration with nothing on screen to act on it, so it read as a
  // fault in the quiet case, which is the ordinary one.
  // **`project.working`, not the global chatter clock.** `agent.active` is true when ANY
  // agent called Sanity recently, about any repo — fine while an agent was the only way in,
  // wrong for a panel that describes one project. It is also the looser of the two: the
  // backend's per-project answer discounts a finished run's dying calls (see `Run::ended_at`),
  // which is what left this reading WORKING for up to a minute over a run that had stopped.
  const chatter = !!project?.working
  const label = stopping ? 'Stopping' : running || chatter ? 'Working' : 'Sleeping'
  const lit = busy || chatter

  // What the top line says while a run is on: the run, not the backlog. "84 left to read"
  // is the answer to a question nobody is asking mid-wave — it barely moves, and the thing
  // somebody wants to know is whether readers are actually alive and working. The backlog
  // comes back the moment the wave does not need the line.
  const runLine = !run
    ? null
    : stopping
      ? // Short, because this line is narrow and truncation eats the number that matters:
        // "3 readers still run…" told you nothing that "3 readers exiting" does not.
        `${run.live} ${run.live === 1 ? 'reader' : 'readers'} exiting`
      : // **Not "5 readers · 15 started · 1 failed".** That is three facts in a column two
        // words wide, and the one that got truncated to "1…" was the only one that meant
        // anything was wrong. `readers` is the concurrency, which does not change during a
        // run and was chosen in the dialog a minute ago; what moves is how many have gone
        // out and how many died.
        `${run.spawned} started`

  return (
    /* Always present, never conditional. A panel that appears only while something happens
       cannot tell you it is idle — its absence is indistinguishable from the feature not
       existing. Permanent, with the mascot asleep, states the quiet case. */
    <div className="shrink-0 p-2">
      <div
        className="relative rounded-md border px-2 py-1.5"
        style={{
          borderColor: lit ? 'var(--accent)' : 'var(--sidebar-border)',
          color: lit ? 'var(--accent)' : 'inherit',
          background: lit ? 'color-mix(in oklch, var(--accent) 14%, transparent)' : 'transparent',
          transition: 'background 200ms, border-color 200ms, color 200ms',
        }}
      >
        {/* Centred, not stood on a baseline. The baseline trick existed because the label
            ran to two and three lines — "AGENT IS WORKING" — and a mascot aligned to the
            middle of a paragraph floats. One word has no paragraph to align to, so the two
            objects simply sit level, and the word takes the height that frees up.

            The mascot is nudged DOWN by half its empty margin: it is a 3D render into a
            square canvas with room beneath the creature, so centring the canvas leaves the
            creature sitting high. */}
        <div className="flex h-12 items-center gap-2.5">
          <span
            className="shrink-0"
            style={{ transform: `translateY(${MASCOT_FLOOR_OFFSET / 2}px)` }}
          >
            <AgentMascot size={MASCOT_SIZE} events={agent.events} active={lit} />
          </span>
          {/* White, not the accent the rest of the box takes. The tint, the border and the
              mascot are already saying "something is happening"; the word is the one thing
              that says WHAT, and at accent-on-accent it was the quietest element in a panel
              built around it. */}
          <span
            className="font-display min-w-0 flex-1 text-[19px] font-semibold uppercase leading-none tracking-tight"
            style={{ color: lit ? 'var(--foreground)' : 'inherit' }}
          >
            {label}
          </span>
        </div>

        {project && !project.loading && (
          <div className="mt-1 border-t border-[var(--sidebar-border)] pt-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] opacity-70">
                {busy && runLine
                  ? runLine
                  : left === 0
                    ? 'Fully read'
                    : `${left.toLocaleString()} left to read`}
                {/* Failures are named rather than folded into "started". A misconfigured
                    agent exits instantly, so a run with nothing landing looks merely slow —
                    this is the one number that tells the two apart. */}
                {busy && !stopping && (run?.failed ?? 0) > 0 && (
                  <span className="text-[var(--warning)]"> · {run!.failed} failed</span>
                )}
              </span>
              {left > 0 && !busy && (
                <button
                  onClick={() => onRead(project.key)}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  Read
                </button>
              )}
              {/* Stop kills the readers rather than letting the wave finish. They are
                  coding agents spending tokens by the minute, so a "stop" that means "in a
                  few minutes" is not what anybody pressing this wants — the reading in
                  flight is lost, which is the cheaper half of that trade. */}
              {busy && (
                /* Solid, like Read. It was a bordered ghost button, which is a fine
                   secondary control on the neutral panel it was designed against and
                   invisible on the accent tint this panel takes while a run is on — the one
                   state where it is the only thing to press. */
                <button
                  onClick={() => {
                    setAsked(true)
                    void stopCheck(project.key).catch(() => setAsked(false))
                  }}
                  disabled={stopping}
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold disabled:opacity-60"
                  style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
                >
                  {/* Always "Stop", disabled while it happens. It used to relabel itself
                      "Stopping…", which said the same word as the header two lines above
                      and turned the one button in the panel into a third narration of the
                      same fact. Disabled is what a control has to say about itself. */}
                  Stop
                </button>
              )}
            </div>

            {/* Why a run stopped, kept on screen. "Ended" and "ended because three waves in
                a row banked nothing" are different outcomes and only one is finished.
                Printed bare: `ended` is a whole sentence, and prefixing it once produced
                "Stopped — stopped".

                **A failed run says so in one line and keeps the evidence behind an icon.**
                The summary can only ever describe the symptom — every cause looks like "no
                readings landed", whether the agent is signed out or the model string was
                rejected — so the sentence stays short and what the readers actually said
                goes in a panel you open when you want it. Which is once, and not while
                watching a run work.

                The icon sits against the SENTENCE, not the panel's right edge. Right-aligned
                it landed directly under the Read button, which reads as a second control in
                that column and pairs it with the wrong thing — it belongs to the line of
                text it opens. */}
            {run && !busy && (run.failures?.length ?? 0) > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] leading-snug text-[var(--warning)]">
                <span className="min-w-0 truncate">Previous read failed.</span>
                <button
                  onClick={() => setShowFailure(true)}
                  title="What the readers said"
                  aria-label="What the readers said"
                  className="shrink-0 rounded-full border border-current px-[5px] leading-[1.3] opacity-80 hover:opacity-100"
                >
                  i
                </button>
              </div>
            )}
            {/* Not when the failure line is already up. "Previous read failed." followed by
                "Three waves in a row finished without a successful reading" is one fact
                twice, in a panel with room for neither — and the second sentence is already
                the first thing the sheet behind the icon says. */}
            {run &&
              !busy &&
              run.ended &&
              left > 0 &&
              (run.failures?.length ?? 0) === 0 && (
                <div className="mt-1 text-[10px] leading-snug opacity-55">{run.ended}</div>
              )}

          </div>
        )}

        {showFailure && (
          <Overlay onClose={() => setShowFailure(false)}>
            <div
              className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <div className="text-[15px] font-semibold">Read failed</div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {run?.ended ?? 'No readings landed.'} Please check your agent
                  configuration. Output can be found below.
                </p>
              </div>
              {/* Monospace and scrollable, because it is a transcript. Wrapped rather than
                  clipped: the useful sentence is as often at the end of a long line as at
                  the start of a short one. */}
              <div className="max-h-72 overflow-auto rounded-md border border-[var(--border)] bg-[var(--secondary)] p-2">
                {(run?.failures ?? []).map((f, i) => (
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
                  onClick={() => setShowFailure(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
                >
                  Close
                </button>
              </div>
            </div>
          </Overlay>
        )}

        {/* The bar lives here rather than on every project row: in the list it was repeated
            per row and pushed the rows to two lines each, which is what stopped the sidebar
            reading like tally's. */}
        {bars.map((p) => (
          <div key={p.key} className="mt-1.5">
            <div className="mb-1 flex items-baseline justify-between text-[10px] opacity-70">
              <span className="mono truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums">
                {p.assessed}/{readable(p)}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(1.5, (p.assessed / readable(p)) * 100)}%`,
                  background: 'var(--agent-mark)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
