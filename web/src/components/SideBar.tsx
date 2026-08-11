import { clsx } from '../lib/cn'
import { AgentMascot } from './AgentMascot'
import { SideBarHeader } from './shell/SideBarHeader'
import { readable, type AgentActivity, type ProjectSummary } from '../lib/api'

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
  connected,
  onConnect,
}: {
  projects: ProjectSummary[]
  active: string | null
  onSelect: (key: string) => void
  agent: AgentActivity
  /** An MCP client is registered against THIS binary. Absence is a state worth naming:
   *  with agents the only way in, nothing connected means nothing can ever arrive. */
  connected: boolean
  onConnect: () => void
}) {
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
        {/* No action in this header any more.
            A project arrives exactly one way: an agent calls `sanity_open` in the repo it
            is already working in. That is the instrument's actual shape — the session that
            knows which repo you are in decides what is on screen — and a `+` beside this
            list offered a second way in that could not do the same job. Opening by hand
            gets you four lenses and a grey map, which is the app with its reason for
            existing removed; worse, it was the door that handed a folder picker a whole
            directory of repos and set thirty minutes of CPU on fire. The list is a
            readout now, not a control. */}
        <div className="px-2 pb-1 pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-55">
            Projects
          </span>
        </div>
        {/* Says what this column is FOR, not what to go and do about it.
            The old empty note repeated the onboarding gate's own instruction — "in Claude
            Code, say study this project in sanity" — in smaller type two inches from where
            the card was already saying it. This one earns its place differently: it names
            the space so that when a project does appear here, the reader has been told in
            advance that this is where to look. That matters more than usual, because the
            agent goes silent during the scan and this column is the only thing moving. */}
        {projects.length === 0 && (
          <div className="px-2 py-1 text-[11px] leading-snug opacity-55">
            Projects will appear here when studied.
          </div>
        )}
        {projects.map((p) => (
          <ProjectItem
            key={p.key}
            project={p}
            active={p.key === active}
            onClick={() => onSelect(p.key)}
          />
        ))}
      </nav>

      {/* Always present, never conditional. A panel that appears only while an agent works
          can't tell you it is idle — its absence is indistinguishable from the app not
          having the feature. Permanent, with the mascot asleep, states the quiet case. */}
      <div className="shrink-0 p-2">
        <div
          className="relative rounded-md border px-2 py-1.5"
          style={{
            borderColor: agent.active ? 'var(--accent)' : 'var(--sidebar-border)',
            color: agent.active ? 'var(--accent)' : 'inherit',
            background: agent.active
              ? 'color-mix(in oklch, var(--accent) 14%, transparent)'
              : 'transparent',
            transition: 'background 200ms, border-color 200ms, color 200ms',
          }}
          title={
            agent.active
              ? 'An agent is reading this project over MCP right now.'
              : 'No agent has touched sanity recently.'
          }
        >
          {/* `last baseline`, not `center` or `end`.
              A replaced element's baseline is its bottom edge, so aligning the row by its
              LAST baseline stands the mascot on the underline of the final word — which
              is what "on the floor" means when the floor is a line of type. Aligning by
              box edges leaves it floating a descender's height off, and `center` drifts
              as soon as the label wraps to a different number of lines.
              Right padding clears the gear, which is positioned against the box. */}
          {/* Fixed height, assembly centred inside it — two containers doing two jobs.
              The outer row owns the vertical space and centres whatever it holds; the
              inner one stands the mascot on the label's last baseline.
              
              Split like this because deriving the box's padding from the type metrics
              was correct and unmaintainable: every change to the label size or the
              mascot moved the balance, and the compensating pixel value lived in a
              comment three lines away. Now nothing outside this row cares what size
              either of them is. */}
          {/* Clearance for the gear. Kept tight: the label is three words and the panel is
              narrow, and a wider reserve pushed "Agent is sleeping" onto three lines. */}
          <div className="flex h-12 items-center pr-8">
            <div className="flex w-full gap-2.5" style={{ alignItems: 'last baseline' }}>
              <span className="shrink-0" style={{ marginBottom: -MASCOT_FLOOR_OFFSET }}>
                <AgentMascot size={MASCOT_SIZE} events={agent.events} active={agent.active} />
              </span>
              {/* Three states, not two. "Sleeping" said of a client that was never
                  registered is the panel reporting a rest it has no evidence of — and it
                  is the exact moment somebody needs telling that the gear beside it is the
                  thing to press. Now that agents are the only way a project arrives, the
                  difference between "connected and idle" and "nothing is connected" is the
                  difference between waiting and being stuck. */}
              <span className="font-display min-w-0 flex-1 text-[14.5px] font-semibold uppercase leading-[1.4] tracking-tight">
                {!connected ? 'Agent not connected' : agent.active ? 'Agent is working' : 'Agent is sleeping'}
              </span>
            </div>
          </div>

          {/* Positioned against the BOX, not carried by the row: equal top and right
              insets is a statement about the corner it sits in, and a flex item inherits
              whatever the row's alignment happens to be instead.
              Connecting lives HERE, not in the top row — this panel is what you are
              looking at when it says sleeping and you are wondering why.

              **A gear and no word.** It was briefly labelled "⚙ Connect", on the argument
              that a `title` is not a name and the empty state points here — but the panel is
              too narrow to hold both: the chip took a third of the width and broke "Agent is
              sleeping" onto three ragged lines, which made the panel harder to read in every
              session in order to help in the first one. So the glyph carries it, given a
              proper hit target and enough contrast to read as a control rather than as
              decoration, and the empty state describes it by position instead of by name. */}
          <button
            onClick={onConnect}
            title="Connect an agent over MCP"
            aria-label="Connect an agent"
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[19px] leading-none opacity-70 hover:bg-[var(--card)] hover:opacity-100"
          >
            ⚙
          </button>

          {/* The bar lives here rather than on every project row: in the list it was
              repeated per row and pushed the rows to two lines each, which is what stopped
              the sidebar reading like tally's. It belongs to the agent panel because it
              reports on a repo being read right now, which is what this panel is about. */}
          {bars.map((p) => (
            <div key={p.key} className="mt-1.5">
              <div className="mb-1 flex items-baseline justify-between text-[10px] opacity-70">
                <span className="mono truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums">
                  {p.assessed}/{readable(p)}
                </span>
              </div>
              {/* No sentence about staleness here. It was written to explain a bar moving
                  BACKWARDS — a finished project gaining expiries drops below full, and the
                  worst reading of that is "the tool lost my work". But this strip is a
                  progress row two lines tall, and the panel says it in three other places
                  that have room to: the readings key counts them, the map hatches them, and
                  the summary lists the first one to go to. A paragraph in the smallest type
                  on screen was the fourth telling and the only one nobody asked for. */}
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
    </aside>
  )
}

/** One project. Matches the sibling apps' nav rows: a rounded 28px strip inside the
 *  column's own padding, with the count that matters pushed to the right. */
function ProjectItem({
  project,
  active,
  onClick,
}: {
  project: ProjectSummary
  active: boolean
  onClick: () => void
}) {
  const done = readable(project) > 0 && project.assessed >= readable(project)
  return (
    <button
      type="button"
      onClick={onClick}
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
