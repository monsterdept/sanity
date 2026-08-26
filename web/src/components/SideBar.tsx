import { Fragment, useEffect, useRef, useState } from 'react'
import { clsx } from '../lib/cn'
import { Overlay } from './Overlay'
import { SideBarHeader } from './shell/SideBarHeader'
import { Phases } from './Phases'
import {
  reorderProjects,
  stopCheck,
  stopHistory,
  stopScan,
  type Progress,
  type ProjectSummary,
} from '../lib/api'

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
  onRemintMascot,
  onError,
  onReplay,
  onTrace,
  onScan,
  onStopTrace,
  replayKey = null,
  replay = null,
}: {
  projects: ProjectSummary[]
  active: string | null
  /** The project whose history is being replayed, and how far it has got.
   *
   *  Two values rather than a map, because there is one walk at a time — see the guard in
   *  `App`. Passed down rather than read here so the list stays a view of what it is
   *  handed. */
  replayKey?: string | null
  replay?: Progress | null
  /** Replay a project's history. Selects it and turns the mode on — a walk belongs to a
   *  repo, and watching one you are not looking at is what the strip above the map used to
   *  invite. */
  onReplay: (key: string, fresh?: boolean) => void
  /** Read a project's commit log onto the map — depth 1, and the thing the budget declined.
   *
   *  Not `onReplay`: that walks every commit to build a timeline, and this reads the log once
   *  to give the wedges an age. Two jobs, two orders of magnitude apart, and the row says
   *  which is which. */
  onTrace: (key: string) => void
  /** Scan a repo whose scan was declined for cost — see `scan::BUDGET`. */
  onScan: (key: string) => void
  /** Stop a running trace. What it read is kept. */
  onStopTrace: (key: string) => void
  onSelect: (key: string) => void
  /** Pick a repo and add it. The one way a project enters that does not involve a
   *  terminal — see the `+` below for why it exists again. */
  onAdd: () => void
  /** Open the Read dialog for a project. */
  onRead: (key: string) => void
  /** Take a project out of the list. Not a delete — see `forgetProject`. */
  onForget: (key: string) => void
  /** Throw this project's creature away; the next look at the map mints another. */
  onRemintMascot: (key: string) => void
  /** Report a refused action. The rows can fail — stopping a run, cancelling a replay — and
   *  the window owns the one place failures are said out loud. */
  onError: (message: string) => void
}) {
  /** The repo the BACKEND says it is walking, if any.
   *
   *  One at a time is enforced where the walk lives (`history::Tracing`), so this is a fact
   *  rather than this window's recollection of a button it may not have pressed. It is what
   *  hides `Trace` on the other rows — the old `replayKey` could only see runs this window
   *  had started, which is exactly the state a reload destroys. */
  const tracingKey = projects.find((p) => p.tracing)?.key ?? null

  /**
   * The list as it is being dragged: which row is moving, the arrangement so far, and the
   * slots it is moving through.
   *
   * **Pointer events, not HTML5 drag-and-drop.** The obvious implementation is `draggable`
   * with `dragover`, and in this window it does nothing at all: the webview claims drag
   * gestures for its own file-drop handling on macOS, so `dragstart` fires, no `dragover`
   * ever arrives, and the drop is swallowed — a row you can pick up, cannot aim, and cannot
   * put down. Pointer events are not intercepted, and they also make the feedback possible:
   * the list rearranges under the pointer as it crosses each row, so where it will land is
   * visible before letting go rather than after.
   *
   * `slots` is measured once, at the start. The rows are not all the same height — a repo
   * being traced grows a line — and re-measuring mid-gesture would mean the target moving
   * because the arrangement moved, which is a list chasing its own tail.
   *
   * The poll is ignored while this is set: a list that reorders itself under a moving
   * pointer is a list you cannot aim at.
   */
  const [drag, setDrag] = useState<{
    key: string
    order: string[]
    slots: { top: number; bottom: number }[]
    from: number
    /** Where the row will land: the gap BEFORE this index, `order.length` for the end.
     *
     *  **A line in the gap, and the list holds still.** Rearranging the rows as the pointer
     *  crossed them was the first attempt and it is worse than no feedback: every row moves,
     *  so the one thing you are trying to judge — where this row goes — is the thing hardest
     *  to see, and the list you are aiming at keeps changing shape underneath you. A line is
     *  the whole answer and moves nothing. */
    at: number
    moved: boolean
    /** Where the pointer is, and where inside the row it took hold.
     *
     *  **The gap is decided by where the ROW is, not by where the pointer is**, and the
     *  difference is the whole top of the list. Grab a row halfway down and the pointer sits
     *  thirty pixels below its top edge; asked about the pointer, the first gap only opens
     *  when the pointer climbs above the first row's middle — which on a two-line row means
     *  dragging up past the header, off the list, to reach a position that is visibly right
     *  there. Asked about the row's own centre, it opens when the row overlaps it, which is
     *  what the eye is already judging. */
    offset: number
    height: number
    width: number
  } | null>(null)
  const nav = useRef<HTMLElement>(null)
  /** The gesture as it actually is, mutated in place.
   *
   *  **A pointer moves faster than a sidebar can re-render.** Following it through state put
   *  every project row, the ghost and the drop line through React a hundred times a second,
   *  and the ghost arrived behind the pointer — the lag you can feel. The position is written
   *  straight to the element instead, and React is told only when something it draws
   *  differently has changed: the gap moved, or a click became a drag.
   *
   *  `drag` below is a snapshot of this for rendering. They are the same gesture; one is the
   *  truth and the other is what has been painted. */
  const live = useRef<{ y: number } | null>(null)
  const ghost = useRef<HTMLDivElement>(null)
  /** A drag just ended here. The pointer comes up over a row and the browser calls that a
   *  click, so without this, letting go of a project selects whichever one it landed on —
   *  the view jumping at the end of every arrangement. */
  const dropped = useRef(false)
  // The poll is ignored while a gesture is in progress: a list that reorders itself under a
  // moving pointer is a list you cannot aim at.
  const shown = drag
    ? (drag.order.map((k) => projects.find((p) => p.key === k)).filter(Boolean) as ProjectSummary[])
    : projects

  /** Follow the pointer while a row is held, and commit when it is let go.
   *
   *  On the window rather than on the row: a pointer moving faster than React re-renders
   *  leaves the row behind, and a gesture that ends outside the sidebar still ends. */
  useEffect(() => {
    if (!drag) return
    const move = (e: PointerEvent) => {
      setDrag((d) => {
        if (!d) return d
        // Five pixels before this is a drag at all. Below that a click on `Read` that
        // wobbles would rearrange somebody's sidebar.
        // Five pixels before this is a drag at all. Below that a click on `Read` that
        // wobbles would rearrange somebody's sidebar.
        const moved = d.moved || Math.abs(e.clientY - (d.slots[d.from].top + d.offset)) > 5
        const centre = e.clientY - d.offset + d.height / 2
        // How many rows the held one has passed the middle of. Slots are where the rows are
        // and they do not move during the gesture, so this is a fact about the two of them
        // and nothing else.
        const at = d.slots.filter((s) => centre > (s.top + s.bottom) / 2).length
        return { ...d, at, moved, y: e.clientY }
      })
    }
    const up = () => {
      setDrag((d) => {
        dropped.current = d?.moved === true
        // Told once, when the gesture is over — a drag crosses several rows and each
        // crossing is a new arrangement; writing each one would be a write per frame of
        // something nobody has finished saying. A gesture that never moved wrote nothing and
        // was a click.
        if (d?.moved) {
          const order = d.order.filter((k) => k !== d.key)
          // The gap was counted in the list as it stands, and the row leaves that list on
          // its way to the gap: everything below it shifts up by one, including the gap.
          order.splice(d.at > d.from ? d.at - 1 : d.at, 0, d.key)
          void reorderProjects(order).catch(() => {})
        }
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [drag])

  /** The project being dragged, for the ghost under the pointer. */
  const dragged = drag ? (projects.find((p) => p.key === drag.key) ?? null) : null

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
      <nav
        ref={nav}
        className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 [overscroll-behavior:contain]"
        // A drag across text selects it, and a half-highlighted sidebar reads as the app
        // having lost track of the gesture. Only while one is in progress: the names are
        // still text somebody may want to copy.
        style={drag?.moved ? { userSelect: 'none' } : undefined}
      >
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
        {shown.map((p, i) => (
          <Fragment key={p.key}>
            {drag?.moved && drag.at === i && <DropLine />}
            <ProjectItem
              key={p.key}
              dragging={drag?.moved === true && drag.key === p.key}
              onGrab={(e) => {
                if (e.button !== 0 || !nav.current) return
                const rows = [...nav.current.children].map((el) => {
                  const r = el.getBoundingClientRect()
                  return { top: r.top, bottom: r.bottom }
                })
                const mine = rows[i]
                live.current = { y: e.clientY }
                setDrag({
                  key: p.key,
                  order: shown.map((row) => row.key),
                  slots: rows,
                  from: i,
                  at: i,
                  offset: e.clientY - mine.top,
                  height: mine.bottom - mine.top,
                  width: nav.current.clientWidth - 16,
                  // Not a drag until it has moved — see the threshold in the effect. A click
                  // that jitters by a pixel is still a click, and this row's whole job is to be
                  // clicked.
                  moved: false,
                })
              }}
              project={p}
              active={p.key === active}
              // **The backend's report wins, and the window's own is the first tick only.**
              // `p.tracing` comes from the process doing the walk, so it survives a reload
              // and is visible to a second window; the local one arrives before the first
              // poll can and is what makes the press feel answered. Neither alone is right:
              // local-only was the bug (a reload hid a running walk), and backend-only would
              // put a second of nothing between the press and the first tick.
              replay={p.tracing ?? (p.key === replayKey ? replay : null)}
              // Another repo is being walked, so this one cannot start. The control is not
              // offered rather than offered and refused. Any repo the BACKEND reports as
              // tracing counts, not just the one this window started — that is the whole
              // difference between a guard and a hint.
              blocked={
                (tracingKey !== null && tracingKey !== p.key) ||
                (replayKey !== null && replayKey !== p.key)
              }
              onError={onError}
              onReplay={(fresh) => onReplay(p.key, fresh)}
              onTrace={onTrace}
              onScan={onScan}
              onStopTrace={onStopTrace}
              onRead={() => onRead(p.key)}
              onFailure={() => setFailureFor(p.key)}
              onClick={() => {
                if (dropped.current) {
                  dropped.current = false
                  return
                }
                onSelect(p.key)
              }}
              onContextMenu={(e) => {
                // Ours instead of WebKit's, which offers Reload and Inspect Element — a
                // developer menu shipped to everybody, on a row where the obvious gesture
                // means something else entirely.
                e.preventDefault()
                setMenu({ key: p.key, x: e.clientX, y: e.clientY })
              }}
            />
          </Fragment>
        ))}
        {/* The last gap has no row after it to hang off. */}
        {drag?.moved && drag.at === shown.length && <DropLine />}
      </nav>

      {/* **The row itself, under the pointer.** A line says where it will land and says
          nothing about what is moving — with five projects that is obvious and with twenty it
          is not, and a gesture whose subject is invisible is one you have to remember rather
          than watch. The real row rather than a name in a box: it is the thing being moved,
          and anything simpler would be a second, worse rendering of a row this file already
          knows how to draw.

          `pointer-events-none` or it takes the pointer from under itself and the gesture ends
          on the first move. Fixed rather than absolute, because the coordinates come from
          `getBoundingClientRect` and that is the frame they are in. */}
      {drag?.moved && dragged && (
        <div
          ref={ghost}
          className="pointer-events-none fixed left-0 top-0 z-50"
          style={{
            // Placed by `transform` from the pointer handler above, which is why this starts
            // at the origin: a `top` written through React would be a render per pointer
            // move, which is the lag this arrangement exists to remove.
            transform: `translateY(${(live.current?.y ?? 0) - drag.offset}px) scale(1.02)`,
            marginLeft: (nav.current?.getBoundingClientRect().left ?? 0) + 8,
            width: drag.width,
            opacity: 0.9,
            filter: 'drop-shadow(0 6px 16px rgb(0 0 0 / 0.35))',
          }}
        >
          <ProjectItem
            project={dragged}
            active={dragged.key === active}
            replay={dragged.key === replayKey ? replay : null}
            dragging={false}
            blocked={false}
            onGrab={() => {}}
            onError={() => {}}
            onReplay={() => {}}
            onTrace={() => {}}
            onScan={() => {}}
            onStopTrace={() => {}}
            onRead={() => {}}
            onFailure={() => {}}
            onClick={() => {}}
            onContextMenu={() => {}}
          />
        </div>
      )}

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
            {/* Throws the stored timeline away and walks the repo again. Here because it is
                the rare, expensive one: a trace is resumable and idempotent, so the ordinary
                answer to "trace this" is already on the row, and this is for the case the
                cache cannot notice — a parser that has moved, or a timeline written by a
                build whose bugs are since fixed. Nothing in it is wrong enough to fail a
                version check; it is just the wrong answer. */}
            {/* Absent while another repo is being walked, for the same reason the row's own
                Trace button is. */}
            {replayKey === null && (
              <button
                type="button"
                className="block w-full px-3 py-1 text-left hover:bg-[var(--secondary)]"
                onClick={() => {
                  onReplay(menu.key, true)
                  setMenu(null)
                }}
              >
                Re-trace history
              </button>
            )}
            {/* **Named, in the project's own menu.** It used to be six clicks on the
                creature itself — a gesture with nothing to discover it by and nothing to
                say what it did, on a decoration sitting next to a real button. A creature
                belongs to its repo, so the place to ask for another one is the repo's row.
                No confirmation: the blueprint is random, so the old one cannot be described
                in a dialog, and another is one more click. */}
            <button
              type="button"
              className="block w-full px-3 py-1 text-left hover:bg-[var(--secondary)]"
              onClick={() => {
                onRemintMascot(menu.key)
                setMenu(null)
              }}
            >
              New monster
            </button>
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
                {failing.run?.ended ?? 'No readings landed.'} Please check your agent configuration.
                Output can be found below.
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

/** Where the held row will land.
 *
 *  In the flow rather than floating over it, so the list opens by exactly the height of the
 *  line and the gap is somewhere the eye can put a row. Absolute positioning would have
 *  meant measuring the scroll container to place it, and re-measuring every time the pointer
 *  moved — arithmetic to say a thing the layout can say by existing. */
function DropLine() {
  return (
    <div
      aria-hidden
      className="h-0.5 rounded-full"
      style={{ background: 'var(--accent)', margin: '2px 0' }}
    />
  )
}

/** A row's height, for a row that is now two rows.
 *
 *  It was 28 (the sibling apps' nav height), then 40 to hold a button and a progress rule.
 *  **What forced the second level was that a project has two things to say at once**, and
 *  one line meant they took turns: mid-run the row said `3 started` and stopped saying how
 *  far along the repo was; mid-scan it said `reading…` and the whole-window strip above the
 *  map said the rest. A strip is the wrong home for it — it is one project's news rendered
 *  across a surface that belongs to whichever project you are LOOKING at, which is how a
 *  replay of ceph came to be counting over sanity's map.
 *
 *  So: the name and how the repo stands on the first line, the work outstanding and the
 *  button that acts on it on the second, and the rule along the bottom edge as before.
 *  Everything a project says is now in the one place the list already is.
 *
 *  62 is two lines of small type, the gap between them, and clearance over the rule — sized
 *  to the content rather than doubled from 40, which left a band of empty chrome under the
 *  second line. It is a MINIMUM: a repo being replayed grows a third line, and at most one
 *  repo is being replayed. */
const ROW_H = 62

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
  replay,
  onClick,
  onContextMenu,
  onRead,
  onFailure,
  onError,
  onReplay,
  onTrace,
  onScan,
  onStopTrace,
  dragging,
  blocked,
  onGrab,
}: {
  project: ProjectSummary
  active: boolean
  /** This project's history replay, while one is running. Null for every other row.
   *
   *  It arrives from the window because that is where the walk is driven from, but it
   *  belongs HERE: a replay is a fact about one repo, it takes an hour on a large one, and
   *  leaving it running while you go and look at something else is the ordinary thing to
   *  do. Rendered over the map it followed the pane instead of its subject. */
  replay: Progress | null
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  /** Open the Read dialog for this project. */
  onRead: () => void
  /** Open the transcript of the last run's failures. */
  onFailure: () => void
  /** Say something went wrong, on the window's own error line. */
  onError: (message: string) => void
  /** Walk this project's history. `fresh` throws the stored timeline away first. */
  onReplay: (fresh?: boolean) => void
  /** Read this project's commit log onto the map — see the list's own prop. */
  onTrace: (key: string) => void
  /** Scan this project, when its scan was declined for cost. */
  onScan: (key: string) => void
  /** Stop a running trace on this project. */
  onStopTrace: (key: string) => void
  /** A trace is running on another project. One walks at a time — see `trace` in `App` —
   *  and a button that reports that when pressed is a worse way of saying it than not being
   *  there. */
  blocked: boolean
  /** This row is the one being dragged. Marked rather than hidden: the row moves through the
   *  list as the pointer crosses each slot, so what it needs to say is "this is the one you
   *  are holding", not "something has left". */
  dragging: boolean
  onGrab: (e: React.PointerEvent) => void
}) {
  const [hover, setHover] = useState(false)
  /** Cancel was pressed here. The walk stops at its next commit, which is a moment on a
   *  small repo and a second or two on a large one — long enough that a button which does
   *  not acknowledge the press reads as a button that did nothing. Cleared when the replay
   *  itself goes away, which is the backend actually answering. */
  const [cancelling, setCancelling] = useState(false)
  useEffect(() => {
    if (!replay) setCancelling(false)
  }, [replay])
  /** Stop was pressed here. The backend's `stopping` is the authority — a terminal tailing
   *  the same run sees it too — and this only covers the second before the next poll carries
   *  it. Without it, pressing Stop looked like pressing nothing. */
  const [asked, setAsked] = useState(false)

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
  /** Anything at all is running on this repo — a scan, either depth of a trace, a replay, or a
   *  wave of readers.
   *
   *  **The sweep along the bottom edge and the pulsing glyph both belonged to READING**, which
   *  made them a claim about one phase rather than about the row: a scan of kibana or a replay
   *  of ceph ran for minutes with nothing on the tile saying so beyond a fill creeping inside
   *  one pill. Three phases that can each take minutes need one answer to "is this repo busy",
   *  and it is the same answer wherever the work is. */
  const working =
    reading || project.loading || !!project.tracing_history || !!project.tracing
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
  /** Big counts lose their last three digits.
   *
   *  A backlog is read as a magnitude — "about a hundred and twenty thousand" — and the
   *  exact figure costs six characters in a 220px column that also has to hold a button.
   *  Small ones keep every digit, because 64 and 6.4k are not the same kind of number: one
   *  is a session's work and the other is a decision. */

  /** LEVEL ONE, right: news the pills cannot carry.
   *
   *  **Only news.** It carried a verdict for every row — `Never read`, `93% read` — and a
   *  column of those is the same sentence in three variants, which the eye learns to skip.
   *  What earns a slot up here is a state that will not be true in five minutes.
   *
   *  **Which is now one state, because the pills took the rest.** It said `Scanning` while a
   *  scan ran, and `5 reading` while a wave did — and the pill for that phase already says
   *  `Stop`, fills with its progress, and puts the count on the line below without anybody
   *  hovering. Three marks for one fact, and the asymmetry gave it away: a trace got no chip,
   *  because the chip was written before the trace had a pill and nobody added one. The answer
   *  to "why does scanning get a label and tracing not" is that scanning should not have had
   *  one either.
   *
   *  A failure is what is left. It is not a phase — no pill is in a failed state, the run is
   *  over — and it is the way into the transcript. */  const state: { text: string; tint: string } | null = failed
    ? { text: 'Read failed', tint: 'var(--warning)' }
    : null


  /** LEVEL TWO, left: the work outstanding, which is the number a person acts on.
   *
   *  It sits under the state and beside the button that does something about it, because
   *  those two belong together: "119k unread" and `Read` are a sentence. While something is
   *  running, the same slot carries that walk's own count — the backlog is not moving and
   *  the walk is. */
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
      // **Drag to arrange.** The order is otherwise most-recently-touched, which is a good
      // default and a bad rule: the repo somebody is actually working through is not always
      // the one they opened last, and a list that rearranges itself as you use it is one you
      // have to re-read every time.
      //
      // On the row and not on a handle: there is nothing else to grab a project row by, and a
      // grip column would be four pixels of chrome in a 220px list to disambiguate a gesture
      // nothing else here uses.
      onPointerDown={onGrab}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      // **No tooltip on the TILE.** It carried the path and the reading counts, and because it
      // sat on the whole row it fired wherever the pointer was — including over the pills,
      // where the bubble landed on top of the note line and said the same numbers a second
      // time. The counts are the note's job now; the path moved onto the name, and why a run
      // ended moved onto the chip that says one did. A tooltip belongs to the thing it
      // qualifies, not to the tile that thing is in.
      className={clsx(
        'relative flex w-full cursor-pointer flex-col justify-center gap-1.5 overflow-hidden rounded-md px-2 py-2 text-left text-[13px] transition-colors',
        active ? 'shell-chrome--active' : 'shell-chrome--rest shell-chrome--hover',
      )}
      style={{
        minHeight: ROW_H,
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        // Emptied where it was, because it is being drawn under the pointer instead — see
        // the ghost in `SideBar`. Kept in the layout rather than removed: the list must not
        // resize under a gesture that is about position.
        opacity: dragging ? 0.25 : 1,
        cursor: dragging ? 'grabbing' : 'pointer',
      }}
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
          still costs nothing.
          Six pixels rather than two: at a hairline the one thing this is FOR — how far along
          a repo is — had to be looked for, and the sweep that rides in the same band had
          almost no room to read as movement. The row grew to hold a button and can spend it. */}
      {/* **The coverage rule is gone, and the pills are why.** It drew `assessed / total`
          along the bottom edge — which is exactly what the Read pill's own fill now says, in
          the column labelled with the verb it belongs to — and the scan's fraction while a
          scan ran, which is the Scan pill. One fact drawn twice in one tile is worse than a
          fact drawn once: they cannot disagree, so the second one is asking to be read as
          something else, and the obvious guess (all three phases? the replay?) is wrong.
          What stays is the sweep below, which is not a measurement at all. */}
      {/* **A sweep along the whole edge while readers are out.** The pulsing icon was the
          only sign, and an 11px glyph changing opacity is not enough to catch an eye that is
          somewhere else — which is the entire job, because the project being read is usually
          not the one on screen.
          Full width rather than along the unread remainder: at 832 of 869 the remainder is
          four pixels, and the signal would be loudest on the runs that have barely started
          and invisible on the ones about to finish. Movement across the row reads the same
          at any coverage, and it sits under the fill rather than replacing it, so "how far
          along" and "working right now" stay two separate readings. */}
      {working && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[6px] overflow-hidden"
        >
          <span
            className="reading-sweep absolute inset-y-0 w-1/4"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            }}
          />
        </span>
      )}
      {/* An icon, because tally's rows have one and their absence is most of why a
          bare list does not read as navigation. It pulses while that project has readers
          out, which is what tells you a repo is being worked on when it is not the one on
          screen. */}
      {/* LEVEL ONE — who this is, and how it stands. A name and a verdict: `Never read`,
          `93% read`, `3 reading`. Reading DOWN the column, this line alone answers "what is
          the state of my projects", which is the question the list exists for. */}
      <div className="relative flex w-full items-center gap-2">
        <span className={clsx('shrink-0 text-[11px] opacity-70', working && 'reading-pulse')}>
          ◍
        </span>
        {/* The path, on the name. Two checkouts of one repo are two rows with the same word
            in them, and this is the only thing that tells them apart. */}
        <span className="mono min-w-0 flex-1 truncate" title={project.repo}>
          {project.name}
        </span>
        {/* **The transcript is on the words that say a run failed**, rather than an `i` button
            in a row of its own — that row held the outstanding count and the Read button once,
            and after both moved into the pills it was a loose control floating over the plant.
            A chip that reports a failure and cannot be asked about it is the dead end; a chip
            that opens the transcript is the same fact and the way in. */}
        {state && (
          <span
            role={failed && open ? 'button' : undefined}
            tabIndex={failed && open ? 0 : undefined}
            onClick={
              failed && open
                ? (e) => {
                    e.stopPropagation()
                    onFailure()
                  }
                : undefined
            }
            title={
              failed && open
                ? 'What the readers said'
                : (run?.ended && !busy ? run.ended : '') ||
                  (busy && (run?.failed ?? 0) > 0 ? `${run!.failed} failed` : '') ||
                  undefined
            }
            className={clsx(
              'shrink-0 truncate text-[10px] tabular-nums',
              failed && open && 'cursor-pointer underline decoration-dotted underline-offset-2',
            )}
            style={{ color: state.tint, opacity: 0.9 }}
          >
            {state.text}
          </span>
        )}
      </div>

      {/* **THE THREE PHASES, as three pills that are their own buttons** — see `Phases`, which
          carries the whole argument for why the state and the verb are one object.
          The replay moved INTO the trace pill, where it belongs: it is depth 3 of the same
          process, and a fourth line under a row claiming to show three phases was the row
          contradicting itself — and its running progress is the pill's own last third, so it
          has no line either. */}
      <Phases
        project={project}
        replayBlocked={blocked}
        // Either kind of stop that has been pressed and not yet answered: a replay's cancel,
        // or a wave's. Both disable the pill that asked, because both take a moment — a walk
        // stops at its next commit and a reader is killed mid-call.
        stopping={cancelling || stopping}
        onAct={(action) => {
          if (action === 'scan') onScan(project.key)
          else if (action === 'trace') onTrace(project.key)
          else if (action === 'replay') onReplay()
          else if (action === 'read') onRead()
          else if (action === 'stop-scan') void stopScan().catch((err) => onError(String(err)))
          else if (action === 'stop-trace') onStopTrace(project.key)
          else if (action === 'stop-read') {
            // **Stop kills the readers rather than letting the wave finish.** They are coding
            // agents spending tokens by the minute, so a stop that means "in a few minutes" is
            // not what anybody pressing this wants — the reading in flight is lost, which is
            // the cheaper half of that trade.
            setAsked(true)
            void stopCheck(project.key).catch(() => setAsked(false))
          }
          else {
            setCancelling(true)
            void stopHistory().catch((err) => {
              setCancelling(false)
              onError(String(err))
            })
          }
        }}
      />

      {/* **The replay has no line of its own any more, not even while it runs.** Its progress
          is the last third of the trace pill's fill, its count is the note under the pills, and
          its Cancel is that pill saying `Stop` — which is the same three things this block held,
          drawn twice. The bar it had was the last piece of duplication in the tile.
          `stopping` is what a pill cannot work out for itself: the walk stops at its next
          commit, which is a second or two on a large repo, and a button that does not
          acknowledge the press reads as one that did nothing. */}

      {/* **The selected row's hairline, painted over everything above.** It is already drawn by
          `shell-chrome--active`, as an inset shadow — which lands under the row's contents, so
          the sprig's vine crossed it. Drawn again here, last, the vine passes behind the edge
          instead. One definition, in `--chrome-ring`. */}
      {active && <span aria-hidden className="shell-chrome--edge pointer-events-none absolute inset-0 rounded-md" />}
    </div>
  )
}
