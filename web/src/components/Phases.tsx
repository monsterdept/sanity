import { useEffect, useMemo, useState } from 'react'
import type { ProjectSummary } from '../lib/api'
import { Sprig } from './Sprig'

/** The three things Sanity does to a repo — scan, trace, read — as three pills.
 *
 *  **The button IS the gauge.** One pill per phase, fixed width, three across: its background
 *  fills with progress, its label says what pressing it does and what that costs, and a phase
 *  with nothing left to do stops being a button and becomes a flat marker.
 *
 *  Two shapes were tried and thrown away before this one, and both failed the same way. Prose
 *  lines with a button at the end (`106k commits to trace  [Trace]`) read well for one project
 *  and not at all down a list: the numbers sit at different offsets, and the lines appear and
 *  disappear as phases complete, so no glance answers "which of these is done". Dials fixed
 *  that half — the state became scannable while the buttons stayed behind a hover, so the row
 *  that most needed acting on was the one that looked most inert, and the numbers under the
 *  rings (`89 files`, `127`) had lost the nouns that made them mean anything.
 *
 *  Unifying the two fixes both. Nothing is hidden, because the button and the state are one
 *  object. Nothing is prose, because the label is a verb and a price. And the count of
 *  pressable things on screen is exactly the amount of work outstanding, which is a better
 *  signal at a glance than any amount of shading: a finished project has no buttons at all.
 *
 *  Progress is a horizontal FILL rather than an arc, because length is what the eye compares
 *  at this size — three 24px rings at 60%, 100% and 100% all read as "a ring with some colour
 *  in it". */

/** What one phase is, resolved from a project row.
 *
 *  The three phases answer the same questions in different units — seconds for a scan and a
 *  trace because they cost your machine, functions for a read because it costs tokens — so
 *  turning them into one shape here is what lets the row below be a loop rather than three
 *  special cases. */
/** What pressing a pill does.
 *
 *  Named here rather than inferred by the caller from a verb and a column, because the branch
 *  that decided the label is the only one that knows which act it was offering: `Trace` means
 *  the commit log on an untraced repo and per-line blame on a traced one, and a row working
 *  that out a second time from `trace_depth` is two implementations of one answer with the
 *  unwatched one free to go wrong. */
export type PhaseAction =
  | 'scan'
  | 'trace'
  | 'replay'
  | 'read'
  | 'stop-scan'
  | 'stop-trace'
  | 'stop-replay'
  | 'stop-read'

interface Phase {
  key: 'scan' | 'trace' | 'read'
  /** 0..1. How much of this phase the map holds. */
  fill: number
  /** The verb, when there is something to press. Absent means this pill is a marker. */
  verb?: string
  /** What pressing it does — see [`PhaseAction`]. */
  act?: PhaseAction

  /** Nothing to press: the phase's own word with a tick after it.
   *
   *  **The word, not just the tick.** It was `✓ scanned` first, which did not fit sixty pixels;
   *  then a bare tick, on the argument that the column already says which phase this is. Three
   *  ticks in a row is a project that is finished and cannot say what it finished — you have to
   *  know the column order to read it, which is a thing to learn rather than a thing to see.
   *  The verb fits when the past tense does not: `Scan ✓`, not `✓ scanned`. */
  done?: string
  /** A marker that is NOT done — what is outstanding, on a phase that cannot be acted on
   *  right now. Drawn without a tick, because a tick means finished. */
  label?: string
  /** The question does not apply here — no git history, or nothing scanned to trace yet. */
  na?: boolean
  /** Full, but describing a repo that has moved since — drawn hatched. */
  stale?: boolean
  /** What this phase says when it is the one being asked about — the line under the pills.
   *
   *  **The only prose here, and there is exactly one of it.** The price used to sit beside the
   *  verb, and a pill is sixty pixels: `Trace 5,249 files` clipped to `Trace 5,…`, and
   *  shortening it to `Trace 5.2k` bought the fit by throwing the noun away. So it moved to the
   *  line below, which has the width to be a sentence and shows one phase at a time.
   *
   *  Each phase also carried a `title` for a native tooltip, which meant hovering produced this
   *  line AND a bubble saying nearly the same thing a few pixels lower — landing on top of the
   *  line it was duplicating. One surface, one sentence. */
  note?: string
}

/** A count, short enough for a line two hundred pixels wide.
 *
 *  `k` from a thousand and `m` from a million, with one decimal in the first decade of each so
 *  `5.2k` is not rounded to the same `5k` as `5,400`. Grouped digits were the rule and read
 *  badly here: `5,249 files without per-function history` overflowed the line, and the digits
 *  it spent were precision nobody acts on — the decision is between five thousand and five
 *  hundred thousand, never between 5,249 and 5,250. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return `${n}`
}

/** FNV-1a over a project key, so a repo's plant is its own — see `Sprig`. */
function fnv(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Rolled once per window, so the garden is different every time the app opens and identical
 *  for as long as it is on screen. */
const SESSION = (Math.random() * 0xffffffff) >>> 0

/** An estimate, in the units a person waits in.
 *
 *  Rounded hard, because it is not a measurement: a rate times a count, and on a repo nobody
 *  has walked here the count itself is inferred. Two significant figures would dress a bound
 *  as a stopwatch. */
const seconds = (s: number) =>
  s < 60 ? `~${Math.max(1, Math.round(s))}s` : `~${Math.round(s / 60)}m`

/** What the three pills say about one project.
 *
 *  Every branch is a state the backend can actually be in, and the ones that look alike are
 *  not: a repo with no git history is not an untraced one, a declined scan is not a scan in
 *  progress, and a map that is behind the repo is not one that was never made. Collapsing any
 *  pair would be the row claiming something nobody measured. */
export function phasesOf(p: ProjectSummary, replayBlocked = false): Phase[] {
  // A wave is running here. `stopping` is the backend's own state, so a reload sees it too —
  // the row's local `asked` covers only the second before the next poll.
  const reading = !!p.run?.running || !!p.run?.stopping
  const total = p.functions + p.files
  const scanned = !p.scan_cost && !p.loading

  const scan: Phase = p.scan_cost
    ? {
        key: 'scan',
        fill: 0,
        verb: 'Scan',
        act: 'scan',
        // An arrow rather than a middot: these two are not a list, they are a cause and its
        // price — this many files is WHY it is that many seconds.
        note: `${
          p.scan_cost.files === null ? 'size unknown' : `${compact(p.scan_cost.files)} files`
        } → about ${seconds(p.scan_cost.seconds).slice(1)}`,
      }
    : p.loading
      ? {
          key: 'scan',
          // Genuinely partial as a WAIT, all-or-nothing as an answer: a half-parsed tree is a
          // wrong map rather than a small one, so stopping keeps the parse cache and throws
          // the tree away.
          fill: p.read_total > 0 ? p.read_done / p.read_total : 0,
          verb: 'Stop',
          act: 'stop-scan',
          // The phase alone until there is a denominator: a scan names what it is doing (a
          // walk, a `git log`, a cache read) before it can count, and `0 / 0 files` for those
          // first seconds is a fraction pretending to be a measurement.
          // The phase name only while there is no count to show. Both together overran the
          // line — `13k / 102k files · reading per-line history` — and the count is the half
          // that moves; the phase is what a scan says before it can count at all.
          note:
            p.read_total > 0
              ? `${compact(p.read_done)} / ${compact(p.read_total)} ${p.read_unit || 'files'}`
              : p.read_phase || 'queued',
        }
      : p.behind
        ? {
            key: 'scan',
            fill: 1,
            stale: true,
            verb: 'Rescan',
            act: 'scan',
            note: 'need rescan',
          }
        : {
            key: 'scan',
            fill: 1,
            done: 'Scan',
            note: `${compact(p.functions)} functions in ${compact(p.files)} files`,
          }

  const trace = traceOf(p, scanned, replayBlocked)

  const read: Phase = reading
    ? {
        // **Stop lives in the pill, like the other two.** It had a button of its own in a row
        // below, which is where every phase's controls used to be — and once the others moved
        // into their pills it was one loose control floating over the plant, in the only tile
        // slot that is supposed to be quiet. A wave has a stop, a count and a fraction, and all
        // three of those are things this pill already knows how to be.
        key: 'read',
        fill: total > 0 ? p.assessed / total : 0,
        verb: 'Stop',
        act: 'stop-read',
        note: p.run?.stopping
          ? `${p.run.live} exiting`
          : `${p.run?.live ?? 0} reading · ${compact(p.assessed)} of ${compact(total)}`,
      }
    : !scanned
    ? {
        key: 'read',
        fill: 0,
        na: true,
        note: 'scanning is required first',
      }
    : p.assessed >= total && total > 0
      ? {
          key: 'read',
          fill: 1,
          done: 'Read',
          // The same shape the other two finished notes take: what there is, not that it is
          // done — the tick says that. `none stale` is worth the words because it is the half
          // of "finished" that expires: a corpus is only current until somebody edits a body.
          note: `${compact(p.assessed)} readings · none stale`,
        }
      : {
          key: 'read',
          fill: total > 0 ? p.assessed / total : 0,
          verb: 'Read',
          act: 'read',
          // **Three disjoint numbers, never two that overlap.** It read `140 to read · 66
          // stale`, and stale readings ARE part of that 140 — `assessed` excludes them
          // everywhere — so the pair invited subtracting one from the other to find the
          // remainder. Split at the source instead: never read, and read but expired.
          note:
            p.stale > 0
              ? `${compact(total - p.assessed - p.stale)} unread · ${compact(p.stale)} stale`
              : `${compact(total - p.assessed)} to read`,
        }

  return [scan, trace, read]
}

/** The trace pill, which carries three depths in one gauge.
 *
 *  **The replay belongs here.** It had a line of its own under the grid, and that line was the
 *  clearest evidence the layout was wrong: the row claims these are the three things Sanity
 *  does, then contradicts itself with a fourth that is also git history work. It is depth 3 of
 *  the same process — the commit log, then per-line blame, then every commit replayed — so it
 *  is a third of one bar, and the verb renames itself to `Replay` on the last step because
 *  that step is a different act and costs an hour rather than a minute.
 *
 *  What does NOT move here is the running replay's own line: progress and a Cancel are a
 *  transient state with more to say than a pill can hold, and it was only ever the STANDING
 *  state that had no business being a fourth row. */
function traceOf(p: ProjectSummary, scanned: boolean, replayBlocked: boolean): Phase {
  const third = 1 / 3
  if (!scanned) {
    return {
      key: 'trace',
      fill: 0,
      na: true,
      note: 'scanning is required first',
    }
  }
  if (p.trace_cost) {
    return {
      key: 'trace',
      fill: 0,
      verb: 'Trace',
      act: 'trace',
      note: `${
        p.trace_cost.commits === null ? 'history' : `${compact(p.trace_cost.commits)} commits`
      } → about ${seconds(p.trace_cost.seconds).slice(1)}`,
    }
  }
  if (p.commits === 0) {
    // **Not the same as untraced, and never drawn as it.** No git at all is a fact about the
    // folder; untraced is work nobody has paid for. Reached only once a walk has run and found
    // nothing, which is the only way to know the difference.
    return { key: 'trace', fill: 0, na: true, note: 'no git history here' }
  }
  if (p.tracing_history) {
    const t = p.tracing_history
    return {
      key: 'trace',
      fill: third + (t.total > 0 ? (t.done / t.total) * third : 0),
      verb: 'Stop',
      act: 'stop-trace',
      note: `${compact(t.done)} / ${compact(t.total)} files blamed`,
    }
  }
  const resolved = p.resolvable > 0 ? p.resolved / p.resolvable : 0
  if (resolved < 1) {
    return {
      key: 'trace',
      fill: third + resolved * third,
      verb: 'Trace',
      act: 'trace',
      // **What depth 2 buys, in the plainest words available.** It said "still on their
      // file's numbers", which is the mechanism — every function in an unblamed file shares
      // its file's age, churn and author — and nobody who had not read `trace.rs` could tell
      // what it was offering.
      // Blame is the word the running note and the finished note both already use, and `to
      // blame` is what the other outstanding notes say — work left, not a state of absence.
      note: `${compact(p.resolvable - p.resolved)} files to blame`,
    }
  }
  const unreplayed = Math.max(0, p.commits - p.replayed)
  if (p.tracing) {
    return {
      key: 'trace',
      fill: 2 * third + (p.commits > 0 ? (p.replayed / p.commits) * third : 0),
      verb: 'Stop',
      act: 'stop-replay',
      note: `${compact(p.replayed)} / ${compact(p.commits)} commits walked`,
    }
  }
  if (unreplayed > 0) {
    return {
      key: 'trace',
      fill: 2 * third + (p.commits > 0 ? (p.replayed / p.commits) * third : 0),
      // **One word for the whole column: `Trace`.** This step used to relabel itself `Replay`,
      // on the argument that walking every commit for the first time is a different act from
      // pressing play on a built timeline — true, and beside the point at the size of a pill.
      // A button that renames itself mid-sequence reads as a NEW button that has appeared,
      // which is a question ("what is replay?") where a third press of the same verb is not.
      // What the step is and what it buys goes in the note, which is what the note is for.
      //
      // Not offered while another repo is walking — one at a time, because it saturates every
      // core it can get. Dimmed, and still saying `Trace`: showing the outstanding count in
      // place of a verb put a bare `340` in the middle column, which reads as a measurement
      // rather than as a control that is unavailable.
      verb: replayBlocked ? undefined : 'Trace',
      act: 'replay',
      label: replayBlocked ? 'Trace' : undefined,
      // The work, in the unit it is done in. `→ the timeline` named an internal noun and left
      // the reader to work out what pressing this buys; `one walk at a time` stated the policy
      // where what somebody needs is what it is waiting FOR.
      note: replayBlocked
        ? 'waiting on another operation'
        : `${compact(unreplayed)} commits to walk`,
    }
  }
  return {
    key: 'trace',
    fill: 1,
    done: 'Trace',
    // **Numbers, and not the word `read`.** It said "read to the line, every commit replayed",
    // which spends the line on a claim the tick already makes — and borrows the third phase's
    // verb to do it, so a finished trace announced itself with the word for reading. `blamed`
    // is the git term and the one the running note already uses.
    note: `${compact(p.commits)} commits · ${compact(p.resolvable)} files blamed`,
  }
}

/** One phase, as a pill that is either a control or a marker.
 *
 *  The fill is a positioned block rather than a gradient so it lands on an exact pixel column:
 *  a 57% that renders as "about half" is the arc problem again in a different shape. */
function Pill({
  phase,
  busy,
  onPress,
  onHover,
}: {
  phase: Phase
  /** Pressed, and the thing it stops has not stopped yet. */
  busy?: boolean
  onPress: () => void
  /** Entered or left. What it drives is the note under the row — one phase at a time, because
   *  three sentences at once is the prose list this layout replaced. */
  onHover: (over: boolean) => void
}) {
  const body = (
    <>
      {phase.fill > 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 rounded-[3px]"
          style={{
            width: `${Math.min(100, phase.fill * 100)}%`,
            // The map's own mark for "true when it was taken, and the code has moved" — see
            // `StaleHatch`. One vocabulary for one idea.
            background: phase.stale
              ? 'repeating-linear-gradient(135deg, var(--accent) 0 2px, transparent 2px 4px)'
              : 'var(--accent)',
            opacity: phase.verb ? 0.35 : 0.55,
          }}
        />
      )}
      {/* A verb and nothing else — every number is under the pills, where there is room for it
          to be a sentence (see `Phase::note`). A finished phase keeps its word and takes a
          tick: three bare ticks in a row is a project that cannot say what it finished, which
          you can only read by knowing the column order. */}
      <span className="relative truncate">
        {phase.done ? `${phase.done} ✓` : (phase.verb ?? phase.label)}
      </span>
    </>
  )

  if (phase.na) {
    return (
      <span
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className="flex h-[18px] items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] text-[10px] leading-none opacity-35"
      >
        —
      </span>
    )
  }
  if (!phase.verb) {
    return (
      <span
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className="relative flex h-[18px] items-center justify-center overflow-hidden rounded-[4px] px-1 text-[10px] leading-none opacity-70"
      >
        {body}
      </span>
    )
  }
  return (
    <button
      disabled={busy}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        onPress()
      }}
      className="relative flex h-[18px] items-center justify-center overflow-hidden rounded-[4px] border border-[var(--accent)] px-1 text-[10px] font-semibold leading-none hover:brightness-110 disabled:opacity-60"
    >
      {body}
    </button>
  )
}

/** A project's three phases, in the order the work happens.
 *
 *  Always visible, never behind a hover: the row that most needs acting on must not be the one
 *  that looks most inert. What keeps that from becoming a wall of buttons is that a finished
 *  phase is not one — so the pressable things on screen are exactly the work outstanding. */
export function Phases({
  project,
  replayBlocked = false,
  stopping = false,
  onAct,
}: {
  project: ProjectSummary
  /** Another repo is being replayed. One walks at a time — see `traceOf`. */
  replayBlocked?: boolean
  /** Stop was pressed here and the walk has not noticed yet. It stops at its next commit,
   *  which is a second or two on a large repo — long enough that a control which does not
   *  acknowledge the press reads as one that did nothing. */
  stopping?: boolean
  /** Do the thing the pressed pill was offering — see [`PhaseAction`]. */
  onAct: (action: PhaseAction) => void
}) {
  const phases = phasesOf(project, replayBlocked)
  /** The pill that was just pressed, until the backend says something new.
   *
   *  **Everything on this row arrives on a poll, and a poll is up to 1.5 seconds away.** Press
   *  Trace and the work starts immediately — measured at 0.35s for per-line blame on this repo —
   *  but nothing on screen could change until the next tick, so a fast phase finished before it
   *  ever looked started and a slow one looked ignored for a second and a half. Both read as a
   *  dead button, and the second one gets pressed again.
   *
   *  Cleared by any change in what the row is FOR rather than on a timer: the depth, whether
   *  something is running, the scan counter, the coverage. Whichever of those moves first is the
   *  backend acknowledging the press, and none of them can move without the press having
   *  landed. */
  const [pressed, setPressed] = useState<PhaseAction | null>(null)
  const answered = [
    project.trace_depth,
    project.tracing_history ? 1 : 0,
    project.scanned,
    project.loading ? 1 : 0,
    project.scan_cost ? 1 : 0,
    project.resolved,
    project.assessed,
  ].join('|')
  useEffect(() => setPressed(null), [answered])
  /** This project's plant. Seeded from the key so every row grows a different one, mixed with
   *  the session so it is a different one next time the app opens — and memoised, because the
   *  project poll re-renders this twice a second and a sprig that changed on each of those
   *  would be a flicker in the corner of the eye on every row at once. */
  const seed = useMemo(() => fnv(project.key) ^ SESSION, [project.key])
  const [hovered, setHovered] = useState<Phase['key'] | null>(null)
  /** What the line under the pills says.
   *
   *  **The pointer first, then whatever is moving, then nothing.** Hovering a pill is somebody
   *  asking about that phase, and it wins outright. With no pointer on the row the line carries
   *  the phase that is RUNNING — a scan's own phase names, a blame count, a replay's commits —
   *  because that is the one thing here that changes on its own. Idle and unhovered it grows a
   *  `Sprig` — one fine stem of the wallpaper's own leaves, different for every project.
   *
   *  It was blank at first, on the argument that an idle row should be quiet, and that left a
   *  reserved strip of empty tile under every settled project. The repo's dimensions were tried
   *  there next and are the better SENTENCE — the pills are all fractions, and a fraction cannot
   *  say whether `Read` means a hundred functions or two hundred thousand — but a row with
   *  nothing to do should not be asking to be read at all. A plant fills the slot without
   *  spending anybody's attention, and the dimensions are one hover away on the Scan pill.
   *
   *  The height is fixed either way, so nothing in the list moves as the pointer crosses it. */
  const note =
    phases.find((p) => p.key === hovered)?.note ?? phases.find((p) => p.verb === 'Stop')?.note
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="grid w-full grid-cols-3 gap-1">
        {phases.map((phase) => (
          <Pill
            key={phase.key}
            phase={phase}
            onPress={() => {
              if (!phase.act) return
              setPressed(phase.act)
              onAct(phase.act)
            }}
            busy={(stopping && phase.verb === 'Stop') || pressed === phase.act}
            onHover={(over) => setHovered(over ? phase.key : (h) => (h === phase.key ? null : h))}
          />
        ))}
      </div>
      {note ? (
        <span className="h-3 w-full truncate text-[10px] leading-3 tabular-nums opacity-55">
          {note}
        </span>
      ) : (
        // **Out through the row's own padding, and under its edge.** The tile pads its contents
        // by eight pixels and a plant has no business respecting that — a vine that stops short
        // of both walls is a dash. All eight are given back, so the stem runs to the tile's own
        // rounded edge and is cut by it, the way `Bloom` lets a flower be cut by the side of
        // its pane. Stopping three pixels short was tried and reads as a vine avoiding the
        // border rather than passing behind it.
        //
        // What makes "behind" true rather than a hope is `.shell-chrome--edge`: the selected
        // row's hairline is an inset shadow, which paints UNDER content, so it is drawn a
        // second time as a sibling over the top.
        //
        // The drawing is absolutely positioned so it can hang into the bottom padding without
        // the row growing: the slot stays exactly as tall as the note that takes it back, and
        // nothing moves as the pointer crosses the list.
        <span className="relative -mx-2 block h-3 w-[calc(100%+1rem)] opacity-40">
          <span className="pointer-events-none absolute inset-x-0 top-0 block">
            <Sprig seed={seed} />
          </span>
        </span>
      )}
    </div>
  )
}
