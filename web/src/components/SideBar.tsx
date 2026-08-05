import { clsx } from '../lib/cn'
import { AgentMascot } from './AgentMascot'
import { SideBarHeader } from './shell/SideBarHeader'
import type { AgentActivity, ProjectSummary } from '../lib/api'

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
  busyKey,
  onConnect,
}: {
  projects: ProjectSummary[]
  active: string | null
  onSelect: (key: string) => void
  agent: AgentActivity
  /** The project whose progress the bar should report — see `App`. */
  busyKey: string | null
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
  // Falls back to whatever is on screen when nothing is working, so the panel still says
  // something in the quiet case rather than collapsing to nothing.
  const working = projects.filter((p) => p.working && p.functions > 0)
  const bars =
    working.length > 0
      ? working
      : projects.filter((p) => p.key === busyKey && p.functions > 0)

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
        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide opacity-55">
          Projects
        </div>
        {projects.length === 0 && (
          <div className="px-2 py-1 text-[11px] leading-snug opacity-60">
            Nothing yet. In Claude Code, say <em>study this project in sanity</em>.
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
          <div className="flex h-12 items-center pr-7">
            <div className="flex w-full gap-2.5" style={{ alignItems: 'last baseline' }}>
              <span className="shrink-0" style={{ marginBottom: -MASCOT_FLOOR_OFFSET }}>
                <AgentMascot size={MASCOT_SIZE} phase={agent.tool} nonce={agent.nonce} active={agent.active} />
              </span>
              <span className="font-display min-w-0 flex-1 text-[14.5px] font-semibold uppercase leading-[1.4] tracking-tight">
                Agent is {agent.active ? 'working' : 'sleeping'}
              </span>
            </div>
          </div>

          {/* Positioned against the BOX, not carried by the row: equal top and right
              insets is a statement about the corner it sits in, and a flex item inherits
              whatever the row's alignment happens to be instead.
              Connecting lives HERE, not in the top row — this panel is what you are
              looking at when it says sleeping and you are wondering why. */}
          <button
            onClick={onConnect}
            title="Connect an agent"
            className="absolute right-2 top-2 rounded text-2xl leading-none opacity-60 hover:opacity-100"
          >
            ⚙
          </button>

          {/* The bar lives here rather than on every project row, and only while there is
              something to finish. On a completed project it is a full bar saying nothing;
              in the list it was repeated per row and pushed the rows to two lines each,
              which is what stopped the sidebar reading like tally's. */}
          {bars.map((p) => (
            <div key={p.key} className="mt-1.5">
              <div className="mb-1 flex items-baseline justify-between text-[10px] opacity-70">
                <span className="mono truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums">
                  {p.assessed}/{p.functions}
                </span>
              </div>
              {/* Why the bar moved BACKWARDS. A finished project that gains stale
                  readings drops below full, and without this the only reading of that is
                  "the tool lost my work" — which is the one thing it must never look
                  like, given the whole point of committing the assessment. */}
              {p.stale > 0 && (
                <p className="mb-1 text-[10px] opacity-70">
                  {p.stale} {p.stale === 1 ? 'reading has' : 'readings have'} gone stale —
                  the code changed under {p.stale === 1 ? 'it' : 'them'}
                </p>
              )}
              <div className="h-1 w-full overflow-hidden rounded-full bg-black/25">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.max(1.5, (p.assessed / p.functions) * 100)}%`,
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
  const done = project.functions > 0 && project.assessed >= project.functions
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        `${project.repo} · ${project.assessed} of ${project.functions} read` +
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
      <span
        className="shrink-0 text-[10px] tabular-nums"
        style={{ color: done ? 'var(--agent-mark)' : 'inherit', opacity: done ? 1 : 0.55 }}
      >
        {project.assessed}/{project.functions}
      </span>
    </button>
  )
}
