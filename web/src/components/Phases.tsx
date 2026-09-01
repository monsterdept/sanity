import { useEffect, useMemo, useState } from 'react'
import { clsx } from '../lib/cn'
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
  'scan' | 'trace' | 'replay' | 'read' | 'stop-scan' | 'stop-trace' | 'stop-replay' | 'stop-read'

interface Phase {
  key: 'scan' | 'trace' | 'read'
  /** The gauge: one value per CHAMBER, each 0..1. How much of this phase the map holds.
   *
   *  **Chambers rather than one bar, because the trace is three depths and they are not three
   *  equal amounts of work.** `trace.rs`'s own table is 6.5s / 206s / minutes on ceph — a
   *  1:10:100 ladder — so a single fill sitting at a third was claiming a third of the wait was
   *  behind you when about one percent of it was. Worse, it was the only value anybody ever
   *  saw: the log walk had no counter at all and the blame pass finishes in 0.35s on an
   *  ordinary repo, so the bar's whole vocabulary in practice was 0, a third, and full.
   *
   *  A chamber is a STEP. Three of them cannot be read as a proportion of anything, so nobody
   *  has to be told that the first is cheap; and the divider positions are the same on every
   *  row, which is what keeps a list of projects comparable at a glance. Weighting them by
   *  measured seconds was the alternative and it fails on exactly that: the dividers would move
   *  per repo, and on ceph the first chamber would be two percent wide, so pressing Trace would
   *  look like it had done nothing.
   *
   *  Scan and Read are one chamber, which draws exactly as the single bar always did. */
  fill: number[]
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
        fill: [0],
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
          fill: [p.read_total > 0 ? p.read_done / p.read_total : 0],
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
            fill: [1],
            stale: true,
            verb: 'Rescan',
            act: 'scan',
            note: 'need rescan',
          }
        : {
            key: 'scan',
            fill: [1],
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
        fill: [total > 0 ? p.assessed / total : 0],
        verb: 'Stop',
        act: 'stop-read',
        note: p.run?.stopping
          ? `${p.run.live} exiting`
          : `${p.run?.live ?? 0} reading · ${compact(p.assessed)} of ${compact(total)}`,
      }
    : !scanned
      ? {
          key: 'read',
          fill: [0],
          na: true,
          note: 'scanning is required first',
        }
      : p.assessed >= total && total > 0
        ? {
            key: 'read',
            fill: [1],
            done: 'Read',
            // The same shape the other two finished notes take: what there is, not that it is
            // done — the tick says that. `none stale` is worth the words because it is the half
            // of "finished" that expires: a corpus is only current until somebody edits a body.
            note: `${compact(p.assessed)} readings · none stale`,
          }
        : {
            key: 'read',
            fill: [total > 0 ? p.assessed / total : 0],
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

/** The trace pill, which carries three depths in three chambers.
 *
 *  **The replay belongs here.** It had a line of its own under the grid, and that line was the
 *  clearest evidence the layout was wrong: the row claims these are the three things Sanity
 *  does, then contradicts itself with a fourth that is also git history work. It is depth 3 of
 *  the same process — the commit log, then per-line blame, then every commit replayed — so it
 *  is the last chamber of this gauge, under the same verb as the other two.
 *
 *  **Every chamber can now move, and until recently only one of them could.** The blame pass
 *  and the replay have always reported a fraction; the log walk reported nothing at all,
 *  because it was one buffered `git log` with no counter in it and nothing to interrupt. So
 *  the gauge's entire vocabulary in practice was empty, one chamber, and full — a control that
 *  jumped and then sat still, which is what made people press it again. `churn::walk` streams
 *  now and counts the commits it folds against what the estimate priced.
 *
 *  **A chamber is a step, and steps are equal here because they are not comparable.** These
 *  three are a 1:10:100 cost ladder, so no single continuous bar can be honest about both what
 *  is done and how much is left; what a reader needs from a sixty-pixel gauge is which step
 *  they are on. See `Phase::fill` for why weighting them by seconds was rejected.
 *
 *  What does NOT move here is the running replay's own line: progress and a Cancel are a
 *  transient state with more to say than a pill can hold, and it was only ever the STANDING
 *  state that had no business being a fourth row. */
function traceOf(p: ProjectSummary, scanned: boolean, replayBlocked: boolean): Phase {
  /** The three chambers, in the order the work happens: the commit log, per-line blame, the
   *  replay. Named rather than indexed, because `[1, 0.4, 0]` at four call sites below is three
   *  facts nobody can check by reading. */
  // **Four chambers, and the third one is new.** The trace ladder gained a rung: counting how
  // many times each function has actually changed, which only the timeline can say. It sits
  // after blame and before the story because it is a bounded walk — a hundred and eighty days
  // rather than the whole history — and because it is what Churn waits on, where the story is
  // what History waits on. See `trace::Depth::Edits` and `edits.rs`.
  const gauge = (log: number, blame: number, edits: number, story: number) => [
    log,
    blame,
    edits,
    story,
  ]
  const none = gauge(0, 0, 0, 0)

  if (!scanned) {
    return { key: 'trace', fill: none, na: true, note: 'scanning is required first' }
  }
  // **A phase that is RUNNING outranks every standing state, and this used to be last.**
  // `trace_cost` and `tracing_history` are not exclusive: the price comes from `trace.pending`
  // and the progress from `trace.running`, and a repo whose history was declined for cost keeps
  // its price for the whole walk it was declined for. Tested in that order, kibana answered a
  // press by going on quoting the estimate — 34 seconds of `git log` with ten cores busy and a
  // pill still offering to start. An offer is what a phase says when nothing is happening.
  // **A running trace says which chamber it is filling, and says it structurally.** The log
  // walk and the blame pass are one endpoint reporting into one field; they used to be told
  // apart by whether `resolved` had moved, which could not see the log walk at all because it
  // has no denominator until it ends. `Progress.step` is set by the pass itself — see `deepen`
  // — so the window is not matching on a phase name that somebody may reword.
  const running = p.tracing_history
  if (running) {
    const part = running.total > 0 ? running.done / running.total : 0
    // The step the pass sets on its own progress — 1 the log walk, 2 the blame pass, 3 the
    // edits walk. An older backend sends no step at all and falls to the log walk, which is
    // where a trace with no per-file count must be.
    const blaming = running.step === 2
    const counting = running.step === 3
    return {
      key: 'trace',
      fill: counting ? gauge(1, 1, part, 0) : blaming ? gauge(1, part, 0, 0) : gauge(part, 0, 0, 0),
      verb: 'Stop',
      act: 'stop-trace',
      note: counting
        ? `${compact(running.done)} / ${compact(running.total)} commits counted`
        : blaming
          ? `${compact(running.done)} / ${compact(running.total)} files blamed`
          : running.total > 0
            ? `${compact(running.done)} / ${compact(running.total)} commits read`
            : // No denominator yet: the estimate could not price this repo without walking it,
              // which is the case `Estimate::commits` is null for. A noun beats `0 / 0`.
              'reading the commit log',
    }
  }

  if (p.trace_cost) {
    return {
      key: 'trace',
      fill: none,
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
    return { key: 'trace', fill: none, na: true, note: 'no git history here' }
  }

  const blamed = p.resolvable > 0 ? p.resolved / p.resolvable : 0
  if (blamed < 1) {
    return {
      key: 'trace',
      fill: gauge(1, blamed, 0, 0),
      verb: 'Trace',
      act: 'trace',
      // **What depth 2 buys, in the plainest words available.** It said "still on their
      // file's numbers", which is the mechanism — every function in an unblamed file shares
      // its file's age, churn and author — and nobody who had not read `trace.rs` could tell
      // what it was offering.
      note: `${compact(p.resolvable - p.resolved)} files to blame`,
    }
  }

  // **The rung Churn waits on, and it is offered by name.** Until it has run, every churn count
  // in the repo is zero — blame keeps one commit per LINE, so a body rewritten in place erases
  // its own history and no amount of blaming can say how often it changed. The lens is locked
  // meanwhile rather than painting those zeroes, and this is the button that lock points at.
  //
  // The note prices it in commits rather than seconds because that is what the walk is bounded
  // by and what the row's other chambers already speak in. Nearly free where somebody has
  // already walked the whole story — `edits::gather` counts a banked timeline where it lies
  // rather than re-walking it.
  if (p.trace_depth !== 'edits') {
    return {
      key: 'trace',
      fill: gauge(1, 1, 0, 0),
      verb: 'Trace',
      act: 'trace',
      // **Short, because the row truncates and every sibling here is short.** `304 files to
      // blame`, `340 commits to walk`, `12k commits · 3k files blamed` — the line is one
      // glance wide and this one ran past it into an ellipsis, which is a note that has
      // stopped being one. Kept inside the longest that already ships — `12k commits · 3k
      // files blamed`, 29 characters — rather than trimmed to whatever fitted the sidebar it
      // was looked at in, because that width is draggable.
      //
      // No quantity, where its neighbours all have one. The number this walk is bounded by is
      // commits inside the widest window, and pricing it costs three `git` calls — on a row
      // that repolls twice a second, for every project in the list. The other chambers get
      // their numbers for free from counts the scan already holds; this one would have to buy
      // its own, which is not a trade a status line is worth. The plainest statement of what
      // pressing it buys, then, which is what the blame note beside it was rewritten to be.
      note: 'how often functions change',
    }
  }

  const told = p.commits > 0 ? p.replayed / p.commits : 0
  const unreplayed = Math.max(0, p.commits - p.replayed)
  if (p.tracing) {
    return {
      key: 'trace',
      fill: gauge(1, 1, 1, told),
      verb: 'Stop',
      act: 'stop-replay',
      note: `${compact(p.replayed)} / ${compact(p.commits)} commits walked`,
    }
  }
  if (unreplayed > 0) {
    return {
      key: 'trace',
      fill: gauge(1, 1, 1, told),
      // **One word for the whole column: `Trace`.** This step used to relabel itself `Replay`,
      // on the argument that walking every commit for the first time is a different act from
      // pressing play on a built timeline — true, and beside the point at the size of a pill.
      // A button that renames itself mid-sequence reads as a NEW button that has appeared,
      // which is a question ("what is replay?") where a third press of the same verb is not.
      //
      // Not offered while another repo is walking — one at a time, because it saturates every
      // core it can get. Dimmed, and still saying `Trace`: showing the outstanding count in
      // place of a verb put a bare `340` in the middle column, which reads as a measurement
      // rather than as a control that is unavailable.
      verb: replayBlocked ? undefined : 'Trace',
      act: 'replay',
      label: replayBlocked ? 'Trace' : undefined,
      note: replayBlocked
        ? 'waiting on another operation'
        : `${compact(unreplayed)} commits to walk`,
    }
  }
  return {
    key: 'trace',
    fill: gauge(1, 1, 1, 1),
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
 *  a 57% that renders as "about half" is the arc problem again in a different shape.
 *
 *  **Nothing here is dimmed to say what it is.** Every state below used to carry an opacity on
 *  the whole pill — 70% for a marker, 60% for a pressed one, 35% for a dash — and an opacity on
 *  the pill is an opacity on its LABEL, so the row was paying for its affordances in
 *  legibility. Measured at 10px on `--card`: the marker's word 3.92:1, a pressed one 3.61:1,
 *  the dash 2.15:1, against a bar of 4.5. The palette was never the problem — ink on the tile
 *  is 14.64:1 and ink on the marker's own 55% fill is 6.89:1 — so the fix costs no colour and
 *  moves no pixel. The channels that were already saying these things say them alone: a border
 *  says pressable, a tick says finished, a dash says the question does not arise. See
 *  `--note-ink`, which is where the one meaning worth keeping went. */
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
  // **Pressed dims the GAUGE, never the word.** Fading the whole pill was what took a busy
  // label to 3.61:1; the fill dropping away is the same "this is not yours to press right now"
  // said in the channel that has no text on it. The border stays accent — taken to `--border`
  // it reads 1.10:1 against the tile, which is not a quieter button but a marker, and the two
  // must not be confusable.
  // **A FINISHED phase is the quietest thing in the row, and it was briefly the loudest.**
  // Taking the marker's blanket opacity off to fix its contrast left a done pill drawn as a
  // solid accent block with full-strength ink on it — which in every convention on screen is
  // what a PRIMARY button looks like, sitting beside two outlined ones that were the actual
  // outstanding work. The row pointed hardest at the one pill nobody can press.
  //
  // The fix is not opacity again: a finished gauge carries no information. It is full by
  // definition and the tick already says so, so drawing it at strength spends the row's
  // loudest ink on its least informative fact. It goes faint, and the label goes to
  // `--note-ink` — 4.66:1 on Paper, 6.04:1 on Ink, measured — which leaves the accent to the
  // things somebody can act on. That is what "the pressable things on screen are exactly the
  // work outstanding" has to look like, not just what the button count says.
  //
  // A marker that is NOT done keeps the strong fill: a blocked replay is outstanding work with
  // real progress behind it, and only the border is missing because there is nothing to press.
  const ink = busy ? 0.16 : phase.done ? 0.14 : 0.35
  const body = (
    <>
      {/* **The chambers.** One per step of the phase — three for a trace, one for everything
          else, which draws exactly as the single bar always did. Inset by a pixel from the
          pill's border rather than sitting under it, so a full chamber reads as a filled
          compartment instead of as the button having changed colour. */}
      <span aria-hidden className="absolute inset-px flex">
        {phase.fill.map((part, i) => (
          <span key={i} className="relative flex-1 overflow-hidden rounded-[2px]">
            {part > 0 && (
              <span
                className="absolute inset-y-0 left-0"
                style={{
                  // A floor, because a chamber that has genuinely started must not be
                  // indistinguishable from one that has not: at sixty pixels across three
                  // chambers, the first percent of a walk is a third of a pixel and rounds
                  // away. The gauge may be coarse; it may not report started work as nothing.
                  width: `${Math.max(6, Math.min(100, part * 100))}%`,
                  // The map's own mark for "true when it was taken, and the code has moved" —
                  // see `StaleHatch`. One vocabulary for one idea.
                  background: phase.stale
                    ? 'repeating-linear-gradient(135deg, var(--accent) 0 2px, transparent 2px 4px)'
                    : 'var(--accent)',
                  opacity: ink,
                }}
              />
            )}
          </span>
        ))}
      </span>
      {/* **No dividers, deliberately.** The chambers are still how the gauge is COMPUTED — the
          three depths advance it a third each, so a trace one step in reads a third of the way
          along and the bar is honest about where the column has got to — but their boundaries
          are not drawn. Which of the three is running is a question the note line one row down
          already answers in words (`5.0k / 59k files blamed`), and answering it a second time
          in hairlines spends the pill's whole width on a fact nobody was asking a sixty-pixel
          bar for. A drawn divider also has to clear two grounds at once and only just manages
          it: against a filled chamber the accent version measured 1.07:1, which is not a faint
          line but no line at all. */}
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
        className="flex h-[18px] items-center justify-center rounded-[4px] border border-dashed border-[var(--border)] text-[10px] leading-none text-[var(--note-ink)]"
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
        className={clsx(
          'relative flex h-[18px] items-center justify-center overflow-hidden rounded-[4px] px-1 text-[10px] leading-none',
          // Finished recedes; outstanding-but-unpressable does not. See `ink` above.
          phase.done && 'text-[var(--note-ink)]',
        )}
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
      className="phase-pill relative flex h-[18px] items-center justify-center overflow-hidden rounded-[4px] border border-[var(--accent)] px-1 text-[10px] font-semibold leading-none disabled:text-[var(--note-ink)]"
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
    // Retired the moment a trace starts, so on an over-budget repo this is the FIRST thing that
    // moves — the walk's own counter is a poll behind it.
    project.trace_cost ? 1 : 0,
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
        <span className="h-3 w-full truncate text-[10px] leading-3 tabular-nums text-[var(--note-ink)]">
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
