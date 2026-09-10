import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Markdown, CopyButton } from './Prose'
import { CodeBlock } from './CodeBlock'
import { CommitCard } from './CommitCard'
import { PAPER } from '../lib/ink'
import { FAMILY } from '../lib/labelStyle'
import {
  TANGLE_EDGES,
  VIEWS_DEFAULT,
  slotColor,
  tangleBandOf,
  type ColorMode,
  type TangleRead,
  type Views,
} from '../lib/colorMode'
import {
  DOC_GAP,
  DOC_WORDS,
  GRADE_SURPRISE,
  HEAT_WORDS,
  LEGIBLE_WORDS,
  functionForks,
  functionHistory,
  functionLinks,
  functionSources,
  heatColor,
  legibleOf,
  trapOf,
  type AgentReport,
  type Forks,
  type FuncRef,
  type Grade,
  type Node,
  type LineHistory,
  type Ramp,
  type Related,
  type Snippet,
} from '../lib/api'

/**
 * The half of the panel that answers the question the map is currently asking.
 *
 * **The pane used to have one subject whatever lens was on.** Expected and Found are the
 * Surprise reading, and they were printed under Callers, under Blame, under Clones — so
 * pressing a tab changed every wedge on screen and nothing at all in the pane beside them.
 * Worse, the lens with the most to say was the one saying least: `14×` under Callers is a
 * number you cannot act on, and *which fourteen* had no answer anywhere in the app.
 *
 * So the pane splits. Everything above this — the name, the path, the counts, the
 * provenance footer — qualifies EVERY lens and never moves; this is the one section that
 * follows the tabs. Two rules hold across all of them, and they are the map's own:
 *
 * - **An absent measurement is stated, never hidden.** A lens with nothing to say says why —
 *   "this language's calls have never been parsed" is a different fact from "nothing calls
 *   this", and the second is a finding. Every section here has to keep them apart, the same
 *   way `colorMode` keeps gray apart from the bright end of a ramp.
 * - **A stale or dated reading does not colour anything here either.** It is shown as
 *   history, marked, and left out of every count — which is what `applyAgentReports` does to
 *   the wedge and `legibleOf` does to the breakdown.
 */
export function LensPane({
  node,
  mode,
  repoKey,
  replaying,
  siblings,
  ranks,
  views,
  tangleBands,
  tangleOver,
  onJump,
  onOpen,
}: {
  node: Node
  mode: ColorMode
  /** Which project to ask about. The neighbour and history lookups are per repo and are
   *  routed by key rather than by "whatever is active", on the same rule the MCP endpoints
   *  follow: two panes of two repos must not answer each other's questions. */
  repoKey: string | null
  /** Is the map showing a past commit rather than the working tree? See `replaying` in
   *  `App` — the request, and a frame to show it in. */
  replaying?: boolean
  /** The functions of the file this one lives in, when the window is holding them. What the
   *  Traps section lists — a trap is rarely alone, and the nearest other one is the most
   *  likely thing you want next. */
  siblings?: Node[]
  /** Category → color slot, so an author's bar here is the colour their wedges are wearing
   *  on the map. The panel is describing the picture; a bar in the chrome's accent would be
   *  a second encoding of a fact the ring is already colouring. */
  ranks?: Map<string, number>
  /** Which reading each two-reading lens is on — see `Views`. Complexity's decides which of
   *  its two bars the section headlines, because they are two different questions. */
  views?: Views
  /** What a normal cognitive score is for a body of each size in this repo — see
   *  `tangle::Bands`. */
  tangleBands?: (number | null)[]
  /** What each band's median was measured over — see `Stats.tangleOver`. */
  tangleOver?: ([number, number] | null)[]
  /** Show the function at this position. Undefined where the window cannot navigate, which
   *  makes every row below plain text rather than a promise it cannot keep. */
  onJump?: (path: string, line: number) => void
  /** Open this node in the code view. The "open in full" button on a code box calls it — see
   *  `CodeBlock.onOpen`, where the case for a file over a modal is made. */
  onOpen?: (n: Node) => void
}) {
  const r = node.agent
  const stale = node.agentStale === true
  // **A replayed wedge is a body from another commit, and nothing here is about it.**
  // Every section on this pane reads the working tree — a reading taken against today's
  // code, a doc parsed out of today's file, a blame of today's lines — and a frame node is a
  // function as it stood in 2019. Printing any of it would be the panel doing what the lens
  // switcher is greyed out to prevent: a measurement nobody took, stamped on a body that is
  // not there. The switcher says so by being disabled; this says so in words, because a
  // pane that simply reported "not read" would read as a fact about the code.
  if (replaying) {
    return (
      <Block label="Replaying">
        <Absent>
          The map is showing a past commit. Everything this pane measures — the reading, the docs,
          the wiring, the blame — is about the code as it is now, so there is nothing here that
          would be true of this frame. Leave History to see it.
        </Absent>
      </Block>
    )
  }
  // **A container gets a section only where it has something of its OWN to say.** Its pane is
  // `Summary`, which already breaks the subtree down under every lens and lists what is in
  // each band — so a legibility section here printed the word LEGIBILITY twice a hundred
  // pixels apart, once as a caveat and once as the breakdown it was standing in front of, and
  // the wiring roll-up said "1 of 4 are called by nothing" directly above a bucket list saying
  // the same thing with the names attached. What a FILE has that its breakdown does not is its
  // own reading, its own header, its own trap and its own lines: those four, and nothing else.
  if (node.kind !== 'func') {
    // **Churn and Age are function views and stay on functions.** They were let through
    // because a file can be blamed whole, which is true and is not the point: the timeline
    // and the calendar are about one body's history, and a file's is already broken down by
    // `Summary` under both lenses — by band, with its members listed. A container was getting
    // a picture of itself directly above a better breakdown of its parts.
    // **Complexity is not among them, and a file DOES have a number of its own.** It is the
    // sum under it, which is what `Summary` is already breaking down by band with the members
    // listed — and the section below is a list of decision points in ONE body. A file's would
    // be every fork in every function it holds, which is the breakdown again, longer.
    const own: ColorMode[] = ['surprise', 'docs', 'traps', 'blame']
    // **The exception is a key rather than a reading**, which is why it is here and not in
    // the list above. A container has no legibility grade and never will, but the breakdown
    // it is standing over is bucketed by four words nothing on screen defines — see
    // `LegibleKey`. Explaining a scale is not the same as claiming a measurement under it.
    if (mode === 'legible') return <LegibleKey />
    if (!own.includes(mode)) return null
  }
  switch (mode) {
    case 'surprise':
      return <SurpriseSection node={node} />
    case 'legible':
      return <LegibleSection report={r} stale={stale} />
    case 'docs':
      return (
        <DocsSection
          node={node}
          report={r}
          stale={stale}
          derived={views?.derivable ?? VIEWS_DEFAULT.derivable}
        />
      )
    case 'traps':
      return <TrapsSection node={node} repoKey={repoKey} siblings={siblings} onJump={onJump} />
    case 'callers':
    case 'reach':
    case 'clones':
      return <WiringSection node={node} mode={mode} repoKey={repoKey} onJump={onJump} />
    case 'language':
      return <LanguageSection node={node} />
    case 'blame':
    case 'churn':
    case 'age':
      return <HistorySection node={node} mode={mode} repoKey={repoKey} ranks={ranks} />
    case 'tangle':
      return (
        <TangleSection
          node={node}
          onOpen={onOpen}
          repoKey={repoKey}
          read={views?.tangle ?? 'weighted'}
          bands={tangleBands}
          over={tangleOver}
        />
      )
  }
}

/* ---------------------------------------------------------------- shared parts */

/** A section of the pane, under the same full-bleed rule every other one takes.
 *
 *  Full-bleed (`-mx-4`) and re-padded so the rule reaches both edges of the pane exactly as
 *  the contents list's does — a rule that stops short of the edge reads as a box
 *  somebody forgot to finish. */
function Block({
  label,
  aside,
  hint,
  children,
}: {
  label: string
  aside?: React.ReactNode
  /** The caveat this section is read under, on the heading rather than in the body.
   *
   *  **A limit worth stating is not a limit worth repeating in every pane.** The resolution
   *  rule behind the wiring lists is real and someone should be able to find it — printed as
   *  a paragraph under every function it read as a warning about THIS one, which it is not,
   *  and it was the thing people stopped reading first. */
  hint?: string
  children: React.ReactNode
}) {
  return (
    // `first:` drops both the rule and the gap above the FIRST section, because the pane's
    // header now draws that line itself — see `Detail`. A section rule scrolls, and the one
    // marking the top of the scrolling area is the one that must not.
    <div className="-mx-4 mt-4 border-t border-[var(--border)] px-4 pt-3 first:mt-0 first:border-t-0">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] ${
            hint ? 'cursor-help' : ''
          }`}
          title={hint}
        >
          {label}
        </p>
        {aside !== undefined && (
          <p className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
            {aside}
          </p>
        )}
      </div>
      {children}
    </div>
  )
}

/** What this pane cannot say, and why. Never an empty frame: an absence with no sentence on
 *  it is indistinguishable from a measurement of nothing. */
function Absent({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">{children}</p>
}

/** The four rungs of a grade, with the reader's one lit and each one saying what it meant.
 *
 *  **The ladder lives here, and it is why there is no longer a dial row.** Three grades side
 *  by side read as a phrase rather than as three readings, which is what the dials were for —
 *  four arcs printing `2/4` with the words moved into their tooltips. A lens section has
 *  exactly one grade in it and all the room in the world, and the rung
 *  descriptions are the part nobody can reconstruct from a fraction. They are the reader's
 *  own wording, from the `report` schema in `mcp.rs`: a ladder that paraphrased the question
 *  would be the panel quietly asking something else. */
function Ladder({
  grade,
  words,
  rungs,
  ramp,
  at,
  dated,
  legend,
}: {
  grade: Grade | undefined
  words: Record<Grade, string>
  rungs: Record<Grade, string>
  ramp: Ramp
  /** Where each grade samples its ramp — the map's own uneven spacing, never a flat quarter
   *  each, or the panel shows four colors the map never uses. */
  at: Record<Grade, number>
  dated?: boolean
  /** No reading to point at: colour EVERY rung and light none.
   *
   *  The same four rows answer two different questions depending on whether there is a grade
   *  in front of them — "which rung did this one get" for a function, "what do these four
   *  words on the map mean" for a container, which has no grade of its own and a breakdown
   *  full of the words. One component either way, because the rung wording is the reader's
   *  and a second copy of it would drift from the schema it was lifted from. What must change
   *  is the swatches: greyed, as an ungraded ladder is, this would be a key showing none of
   *  the colours it is a key to. */
  legend?: boolean
}) {
  const order: Grade[] = ['none', 'some', 'most', 'full']
  return (
    <div className="space-y-1">
      {order.map((g) => {
        const on = g === grade
        return (
          <div key={g} className="flex items-baseline gap-2">
            <span
              className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
              style={{
                background: legend || (on && !dated) ? heatColor(at[g], ramp) : 'var(--secondary)',
                outline: on ? '1px solid var(--muted-foreground)' : undefined,
              }}
            />
            <span
              className={`mono w-[64px] shrink-0 text-[11px] ${
                on || legend ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
              }`}
            >
              {words[g]}
            </span>
            <span
              className={`min-w-0 flex-1 text-[10px] leading-snug ${
                on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)] opacity-70'
              }`}
            >
              {rungs[g]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** The caveat that belongs on top of anything derived from a reading whose code has moved.
 *  Before the claim rather than under it — a caveat printed below the thing it qualifies is a
 *  caveat half the readers never reach. */
function StaleNote() {
  return (
    <p className="mb-2 rounded-[var(--radius-sm)] border border-[var(--warning)] px-2 py-1.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
      <span className="font-semibold uppercase tracking-wide text-[var(--warning)]">Stale</span> —
      this code has changed since it was read, so what follows describes a body that is no longer
      here. It is kept as history and colors nothing.
    </p>
  )
}

/** A row for one function somewhere else in the repo.
 *
 *  **The owner rides beside the name and is never folded into it.** One file holds a dozen
 *  `parse`s, one per descriptor type, and a list of twelve identical words is a list of
 *  nothing — the same failure the reader's peer list had before `owner` was carried.
 *
 *  The whole row is the target. A `→` that is the only hit area is a four-pixel affordance at
 *  the end of a line whose text is what you were reading. */
function RefRow({
  r,
  snippet,
  repoKey,
  note,
  code = true,
  onJump,
}: {
  r: FuncRef
  /** Its source, when the section has fetched it. `undefined` is "not asked for yet" and
   *  `null` is "asked, and the file could not supply it" — the same two absences everything
   *  on this pane is written to keep apart. */
  snippet?: Snippet | null
  repoKey: string | null
  /** Something to say about this row instead of its body — the sibling's own trap, under
   *  Traps. */
  note?: string | null
  /** Does this row carry source at all? Under Traps it does not: a trap is a sentence about
   *  a hazard, and eleven lines of the body it is hiding in is not the context that makes it
   *  legible — the sentence is. */
  code?: boolean
  onJump?: (path: string, line: number) => void
}) {
  const label = r.owner ? `${r.owner}.${r.name}` : r.name
  // Fetched here only for a row past the batch — see `SNIPPETS`. The common case arrives with
  // the section in one call, and this is the tail asking for itself.
  const [late, setLate] = useState<Snippet | null | 'asking'>(null)
  const shown = snippet !== undefined ? snippet : late === 'asking' ? null : late
  // **Two lines, because one could not hold either half.** Name, path and a line count on one
  // row meant the name — the thing you are reading the list FOR — was the part that got
  // elided, down to `compi…` beside a path with room to spare. They are different kinds of
  // fact anyway: what it is, then where it is.
  const inner = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="mono min-w-0 flex-1 truncate text-[11px]">{label}</span>
        {onJump && (
          <span aria-hidden className="shrink-0 text-[10px] text-[var(--muted-foreground)]">
            →
          </span>
        )}
      </div>
      {/* No line count. It was the one number on the row and it was answering a question
          nobody asked here — how long another function is, in a list about which functions
          these are, with that function's source printed directly underneath where its length
          is visible. The line NUMBERS in the gutter are the size cue that earns its place. */}
      <div
        className="truncate text-[10px] leading-tight text-[var(--muted-foreground)]"
        style={{ fontFamily: FAMILY }}
        title={`${r.path}:${r.line}`}
      >
        {r.path}:{r.line}
      </div>
    </>
  )
  // **Header and source are ONE tile.** The head was chrome on the pane's own ground, which
  // made it indistinguishable from the panel behind it and, worse, from the section heading a
  // few pixels above — so a row read as a second heading with a code block loose underneath.
  // Bordered, clipped, and the head on its own surface: what it is, then what it says.
  const tile = code && shown
  return (
    <div
      className={`mb-2 ${
        tile ? 'overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)]' : ''
      }`}
    >
      {onJump ? (
        <button
          type="button"
          onClick={() => onJump(r.path, r.line)}
          title={`Show ${label} — ${r.path}:${r.line}`}
          className={`block w-full px-2 py-1 text-left ${
            tile ? 'tile-head' : 'rounded-[var(--radius-sm)] hover:bg-[var(--secondary)]'
          }`}
        >
          {inner}
        </button>
      ) : (
        <div className={`px-2 py-1 ${tile ? 'tile-head' : ''}`}>{inner}</div>
      )}
      {note && (
        <p className="mt-0.5 px-1 text-[11px] leading-snug text-[var(--muted-foreground)]">
          {note}
        </p>
      )}
      {!code ? null : shown ? (
        <CodeBlock
          code={shown.text}
          title={label}
          subtitle={`${r.path}:${r.line}`}
          startLine={r.line}
          flush
          caveat={
            shown.moved
              ? `${r.name} is not at the top of these lines — the file has changed since the scan, so this is probably other code. It comes back right on the next scan.`
              : shown.truncated
                ? 'Cut at 2,000 lines.'
                : undefined
          }
        />
      ) : snippet === undefined && late !== 'asking' && repoKey ? (
        // Past the batch. Asked for by hand rather than never, so the tail of a long list is
        // one click from its code instead of being quietly out of reach — the same rule the
        // coverage numbers follow about what a cap leaves out.
        <button
          type="button"
          onClick={() => {
            setLate('asking')
            void functionSources(repoKey, [
              { path: r.path, start: r.line, end: r.line + r.loc - 1, name: r.name },
            ])
              .then((got) => setLate(got[0] ?? null))
              .catch(() => setLate(null))
          }}
          className="ml-2 text-[10px] text-[var(--muted-foreground)] underline decoration-dotted underline-offset-2 hover:text-[var(--foreground)]"
        >
          Show code
        </button>
      ) : snippet === null ? (
        <p className="ml-2 text-[10px] text-[var(--muted-foreground)]">
          Its file could not be read — moved, or gone since the scan.
        </p>
      ) : null}
    </div>
  )
}

/** How many rows arrive with their source.
 *
 *  **A cap, and it is counted out loud rather than silently applied.** `new` in this repo has
 *  205 callers, and a section that fetched every body would read a hundred files to fill a
 *  pane nobody will scroll to the bottom of. Past this a row keeps its arrow and offers its
 *  code on a click — nothing is out of reach, and the note says where the batch stopped. */
const SNIPPETS = 12

/** One span, as `function_sources` takes them. `loc` is the span's own length — see
 *  `links::Entry` — so the end is derived rather than carried as a second number saying the
 *  same thing. */
function spanOf(r: FuncRef) {
  return { path: r.path, start: r.line, end: r.line + r.loc - 1, name: r.name }
}

/** One list of neighbours, with as much of their source as the batch reached.
 *
 *  The fetch lives here rather than in the row so it is ONE call for the whole list — see
 *  `functionSources`. A row that fetched itself would be a round trip apiece and would read
 *  the same file once per row that lands in it.
 */
function RefList({
  refs,
  repoKey,
  code = true,
  notes,
  onJump,
}: {
  refs: FuncRef[]
  repoKey: string | null
  code?: boolean
  /** A line per row, by index, where the row has something to say that is not its body. */
  notes?: (string | null)[]
  onJump?: (path: string, line: number) => void
}) {
  const [sources, setSources] = useState<(Snippet | null)[] | null>(null)
  // The rows themselves, as a value the effect can depend on without re-firing on every
  // render of an unchanged list.
  const key = refs.map((r) => `${r.path}:${r.line}`).join('|')
  useEffect(() => {
    if (!repoKey || refs.length === 0 || !code) {
      setSources(null)
      return
    }
    let live = true
    setSources(null)
    functionSources(repoKey, refs.slice(0, SNIPPETS).map(spanOf))
      .then((got) => {
        if (live) setSources(got)
      })
      .catch(() => {
        if (live) setSources(null)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoKey, key, code])

  return (
    <>
      {refs.map((r, i) => (
        <RefRow
          key={`${r.path}:${r.line}`}
          r={r}
          snippet={i < SNIPPETS ? (sources ? sources[i] : undefined) : undefined}
          repoKey={repoKey}
          note={notes?.[i]}
          code={code}
          onJump={onJump}
        />
      ))}
      {code && refs.length > SNIPPETS && (
        <p className="mt-1 text-[10px] leading-snug text-[var(--muted-foreground)]">
          Source shown for the first {SNIPPETS} of {refs.length}.
        </p>
      )}
    </>
  )
}

/** What "clone" means here, on the headings rather than above them.
 *
 *  It is the definition of the LENS, not a fact about the function you clicked, and printed as
 *  a paragraph it was re-read on every clone anybody opened. */
const CLONE_HINT =
  'The same body, with names and formatting normalised away. A group is a fact, not a verdict — table-driven tests and trait boilerplate live here too.'

/** The directory a repo-relative path sits in — the empty string at the root.
 *
 *  The same cut `edges::dir_of` makes in Rust, which is what makes "outside its own
 *  directory" here mean what it means there. */
function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut < 0 ? '' : path.slice(0, cut)
}

/* ------------------------------------------------------------------- surprise */

/** The rungs of `predicted`, in the reader's own words from `mcp.rs`'s report schema.
 *
 *  The grade is about the PREDICTION, not about the code — which is the one thing a person
 *  reading a wedge called `quirky` cannot work out from the word alone, and the reason the
 *  ladder earns its place under the lens the whole app is for. `HEAT_WORDS` names what the
 *  map shows (`mundane`, `typical`, `quirky`, `obscure`); these say what a reader did to
 *  earn one. Same division as Legibility's, and the same rule: lift the wording, never
 *  paraphrase it, or the panel is quietly describing a question nobody was asked. */
const PREDICT_RUNGS: Record<Grade, string> = {
  full: 'called it — nothing missed',
  most: 'broadly right, one detail that was not obvious',
  some: 'recognizable, but it does real work the prediction did not cover',
  none: 'the prediction did not describe this code',
}

/**
 * The prediction test: what a reader expected, what it found, and what it flagged.
 *
 * The pane's original and only content, now one lens's section among eleven. Expected is
 * shown even when the reader got it right — "expected X, found X" is the evidence that a
 * wedge is genuinely boring, and a panel that only prints the misses cannot say that.
 */
function SurpriseSection({ node }: { node: Node }) {
  const r = node.agent
  if (!r) {
    return (
      <Block label="Surprise">
        <Absent>
          Nobody has read this yet. Readings come from an agent working through the repo over MCP —
          point one at this project and it will fill in.
        </Absent>
      </Block>
    )
  }
  const trapped = trapOf(r) && !node.agentStale
  const predicted: Grade = r.predicted ?? (r.surprised ? 'none' : 'full')
  return (
    <Block label="Surprise" aside={node.agentStale ? undefined : HEAT_WORDS[predicted]}>
      {node.agentStale && <StaleNote />}
      <div className="space-y-3">
        {!r.cold && (
          <p
            className="inline-flex rounded-full border border-[var(--warning)] px-1.5 py-px text-[9px] uppercase tracking-wide text-[var(--warning)]"
            title="The agent had already read this file, so it recalled rather than predicted."
          >
            warm read
          </p>
        )}
        {/* Grade, then scale, then the thing itself — the order both other graded sections
            run. The word is in the header, the ladder says what it is out of, and the two
            passages below are the evidence you go to if you doubt it. */}
        <Ladder
          grade={predicted}
          words={HEAT_WORDS}
          rungs={PREDICT_RUNGS}
          ramp="heat"
          at={GRADE_SURPRISE}
          dated={node.agentStale}
        />
        {!r.predicted && (
          <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
            Banked before the grades existed, when a reading recorded only surprised-or-not — so
            this is one of the two ENDS of the scale, never a middle rung somebody chose.
          </p>
        )}
        <Passage label="Expected" text={r.expected} hint="Copy what the reader expected" />
        <Passage label="Found" text={r.found} hint="Copy what the reader found" />
        {r.note ? (
          <NoteBox note={r.note} trapped={trapped} />
        ) : (
          predicted === 'full' && (
            <p className="text-[11px] italic text-[var(--muted-foreground)]">
              Read as expected — nothing here would trip someone up.
            </p>
          )
        )}
        {node.hotspots.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              The evidence
            </p>
            {/* Measurement, not prose. Each row is a position where the model's probability
                for the real token collapsed, and what it would have written instead — so this
                cannot be confidently wrong the way a generated explanation can. */}
            {node.hotspots.map((h, i) => (
              <div key={i} className="mb-2.5">
                <pre className="mono overflow-x-auto whitespace-pre-wrap break-all rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2 py-1 text-[11px] leading-snug">
                  {h.text}
                </pre>
                {h.expected.length > 0 && (
                  <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    expected{' '}
                    {h.expected.map((e, j) => (
                      <span key={j}>
                        {j > 0 && ' or '}
                        <span className="mono text-[var(--foreground)]">{e.trim() || '␣'}</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Block>
  )
}

/** One labelled paragraph of a reader's prose, with the way to take it somewhere else.
 *
 *  The copy button rides in the heading rather than floating over the corner of the text:
 *  absolutely positioned it would sit on top of the first line at exactly the width where the
 *  pane is narrowest. What goes on the clipboard is the agent's own markdown — see
 *  `CopyButton`. */
export function Passage({ label, text, hint }: { label: string; text: string; hint: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-2 text-[var(--muted-foreground)]">
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
        <CopyButton text={text} title={hint} />
      </div>
      <div className="text-xs leading-relaxed">
        <Markdown text={text} />
      </div>
    </div>
  )
}

/**
 * The one sentence a human can act on, marked as one.
 *
 * **A trap's note is pink, because the note IS the trap.** `trap` is a boolean; the note is
 * the only thing that says what will bite you. The color goes on the TAB and nowhere else —
 * `--trap` is set to be the loudest thing on the map, and reversing a paragraph out of it
 * makes the note harder to read the more it matters.
 */
function NoteBox({ note, trapped }: { note: string; trapped: boolean }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]">
      {/* LABELED, because a color is not a word: the pink says "this one" and the ⚠ says
          "careful", and neither says which of the two kinds of box this is. */}
      <div
        className="flex items-center gap-1.5 px-2 py-1"
        style={
          trapped ? { background: 'var(--trap)', color: PAPER } : { color: 'var(--foreground)' }
        }
      >
        <span aria-hidden className="text-[11px] leading-none">
          ⚠
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] leading-none">
          {trapped ? 'trap' : 'note'}
        </span>
        <CopyButton text={note} title={trapped ? 'Copy this trap' : 'Copy this note'} />
      </div>
      <div className="px-2 pb-1.5 pt-1 text-[11px] leading-snug">
        <Markdown text={note} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ legibility */

const LEGIBLE_RUNGS: Record<Grade, string> = {
  full: 'read once, top to bottom, never went back',
  most: 'went back over one part once',
  some: 'went back more than once, or held several things at a time to follow it',
  none: 'finished it and still could not say with confidence what it does',
}

/**
 * The four words, for a container that has no grade of its own.
 *
 * **The one graded lens where a container was left with nothing.** Surprise, Docs and Traps
 * each give a file a section because a file has its own reading, its own header and its own
 * trap; legibility it has none of — the question is what reading one BODY was like, and a
 * reader is never handed a file as one (see `FILE_ASK`, which does not ask). So the pane
 * returned nothing, and the breakdown directly above it listed `clean`, `nuanced`, `tangled`
 * and `unclear` as bucket headings with no statement anywhere on screen of what any of them
 * meant. The words are the reader's, out of `mcp.rs`; nothing else in the window says so.
 *
 * **A key, not a second breakdown.** The heading says what the rows are — the scale — rather
 * than repeating LEGIBILITY, which is already the breakdown's own word directly
 * below, and which is exactly how a legibility section here read as duplication the last time
 * one existed. It counts nothing: the counts are the breakdown's job and it does them better,
 * with the members named.
 */
function LegibleKey() {
  return (
    <Block label="What the grades mean">
      <Ladder
        grade={undefined}
        words={LEGIBLE_WORDS}
        rungs={LEGIBLE_RUNGS}
        ramp="legible"
        at={GRADE_SURPRISE}
        legend
      />
      <p className="mt-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
        Graded per function by the reader after it opened the body. A file carries no grade of its
        own — the breakdown below is its functions', with each one named.
      </p>
    </Block>
  )
}

/**
 * What reading this was like, judged by what the reader actually did.
 *
 * **`found` is shown here and `expected` is not, and that division is the whole section.**
 * Surprise is the pair — the prediction against the body — and it is graded before the body is
 * open. Legibility is graded AFTER, by a reader that has the text in front of it, which is
 * the same moment `found` is written. So the prose belongs to both questions and the
 * prediction belongs to only one; printing `expected` under this tab would be asking you to
 * read the guess as evidence about the reading.
 *
 * There is no separate legibility note and there deliberately is not going to be one. A prose
 * field per axis is a per-reading token charge on every reader forever — `just tokens` before
 * anyone proposes it — and the grade plus the pass it describes is what the axis measures.
 */
function LegibleSection({ report, stale }: { report?: AgentReport; stale: boolean }) {
  if (!report) {
    return (
      <Block label="Legibility">
        <Absent>
          Nobody has read this yet. Legibility is graded by the reader after it opens the body, so
          it arrives with the reading and never without one.
        </Absent>
      </Block>
    )
  }
  const current = legibleOf(report)
  const dated = report.legibleDated === true
  return (
    <Block label="Legibility" aside={current && !stale ? LEGIBLE_WORDS[current] : undefined}>
      {stale && <StaleNote />}
      {dated && (
        <p className="mb-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
          This grade answers a question that has since been rewritten, so it no longer colors
          anything or counts anywhere. It is kept below as history. The axis refills on an ordinary
          re-read — there is no pass that asks this question on its own, because a reader that only
          ever opens the body is a different instrument.
        </p>
      )}
      <Ladder
        grade={report.legible}
        words={LEGIBLE_WORDS}
        rungs={LEGIBLE_RUNGS}
        ramp="legible"
        at={GRADE_SURPRISE}
        dated={dated || stale}
      />
      {!report.legible && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
          This reading carries no legibility grade — it was banked before the axis existed. Absent
          is no opinion, never a grade.
        </p>
      )}
      <div className="mt-3">
        <Passage
          label="What it found once open"
          text={report.found}
          hint="Copy what the reader found"
        />
      </div>
    </Block>
  )
}

/* ------------------------------------------------------------------------ docs */

const DOC_RUNGS: Record<Grade, string> = {
  full: 'covers what the code actually does',
  most: 'broadly right, one thing it does not mention',
  some: 'says something, but the code does real work it does not cover',
  none: 'no docs, or docs that do not describe this',
}

/**
 * The comment itself, beside the grade somebody gave it.
 *
 * **The text was on the wire the whole time and the panel never showed it.** `Node::doc` is
 * what reaches the reader before it predicts — it is why documenting a repo drains the map —
 * and the Docs lens colored a wedge by how well it covered the body while the pane beside it
 * printed a paragraph about surprise. So this is the one section that shows the SUBJECT rather
 * than a measurement of it: the doc, and the signature it is attached to, because a doc is
 * graded against the thing it describes and half of that is the declaration.
 *
 * The file pane shows the same thing one level up — a file's `doc` is its module header.
 */
function DocsSection({
  node,
  report,
  stale,
  derived,
}: {
  node: Node
  report?: AgentReport
  stale: boolean
  /** What the lens paints a derivable doc as — `Views.derivable`. The pane says what the map
   *  beside it is painting. */
  derived: 'none' | 'full'
}) {
  const derivable = report?.derivable === true
  const graded = report && !stale ? (derivable ? derived : report.documented) : undefined
  return (
    <Block
      label={node.kind === 'file' ? 'File header' : 'Docs'}
      aside={graded ? DOC_WORDS[graded] : undefined}
    >
      {stale && <StaleNote />}
      {/* **Grade, then scale, then the thing itself — the order Legibility already had.**
          The two graded sections had it opposite ways round: one put the ladder under its
          word and the detail last, the other buried the ladder below the doc it was grading.
          Same pane, same kind of reading, two shapes. The grade is the answer, the ladder is
          what the answer is out of, and the text is the evidence you go to if you doubt it. */}
      {report ? (
        <Ladder
          grade={graded}
          words={DOC_WORDS}
          rungs={DOC_RUNGS}
          ramp="docs"
          at={DOC_GAP}
          dated={stale}
        />
      ) : (
        <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
          Ungraded — nobody has read this, so there is no judgement of whether the words below match
          the code they describe.
        </p>
      )}
      {derivable && (
        <p className="mt-2 rounded-[var(--radius-sm)] border border-[var(--warning)] px-2 py-1.5 text-[11px] leading-snug">
          <span className="font-semibold uppercase tracking-wide text-[var(--warning)]">
            Derivable
          </span>{' '}
          — the reader judged that this says nothing it could not have worked out from the code
          alone, so the score counts it as <span className="mono">none</span> whatever grade it
          was given. The map is painting it as <span className="mono">{derived}</span>, which is
          the reading beside the lens.
        </p>
      )}
      <div className="mt-3">
        {/* **The same box the neighbour snippets take, and it was a bare `<pre>`.** A
            destructured TSX signature runs to fifty lines, and drawn as wrapping prose in
            `--secondary` it had no gutter, no dedent, no copy and no way to open it — a
            different-looking widget for the same thing one pane over. Wrapped rather than
            scrolled sideways would also fold a parameter list under its own indentation,
            which is the one thing a snippet must not do. */}
        {/* **Two code boxes stacked with nothing saying which was which.** They are the two
            halves of what a doc grade is ABOUT — the words, and the declaration they claim to
            describe — and unlabelled they read as one snippet that failed to load in the
            middle. `Block` cannot supply these: they sit inside one section, and a second
            heading rule between them would read as two sections about two functions.

            `Signature` rather than `Body`: it is `node.signature`, the declaration up to the
            opening brace, and a doc is graded against the thing it describes. Calling it the
            body would be a caption claiming code that is not on screen. */}
        {node.signature && (
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Signature
            </p>
            <CodeBlock
              code={node.signature}
              title={node.name}
              subtitle={node.path}
              startLine={node.line ?? undefined}
              height="max-h-[24rem]"
            />
          </div>
        )}
        {node.doc ? (
          <>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {/* What it is called depends on where it lives: Python and Elisp put a STRING
                inside the definition, everything else here puts a comment above it. `Doc` is
                the word both of those are, and it is the word the lens uses. */}
            Doc
          </p>
          {/* The comment verbatim, and NOT as markdown: a `*` down the left margin of a C
              comment is a comment marker, not emphasis, and this is the one thing on the pane
              somebody is meant to read every word of.

              In the same box the neighbour snippets take, for the same reason — a module
              header is regularly longer than the panel is tall. Unhighlighted: tokenized, a
              doc stack is one long comment, italic and muted from top to bottom.

              Sized against the WINDOW rather than in `rem`: this is what the pane is FOR under
              this lens, and a fixed box leaves half a large screen empty while overflowing a
              small one. The neighbour snippets stay short — they are a glance at somewhere
              else. */}
          <CodeBlock
            code={node.doc}
            title={node.name}
            subtitle={node.kind === 'file' ? `${node.path} — header` : node.path}
            highlight={false}
            height="max-h-[60vh]"
          />
          </>
        ) : (
          <Absent>
            {/* **"the reader above it" meant the MODEL, and nobody read it that way.** In this
                app a reader is the agent that took the grading pass, and on a pane whose other
                half is a paragraph of prose the obvious reading is the person reading, or the
                box further up. Two ambiguities in six words, in the one sentence somebody
                lands on when there is nothing else to look at. What is left is the fact. */}
            {node.kind === 'file' ? 'No file header.' : 'No doc comment.'} Whatever this does has
            to be worked out from the code itself.
          </Absent>
        )}
      </div>
    </Block>
  )
}

/* ----------------------------------------------------------------------- traps */

/**
 * The warning, first, and the nearest others after it.
 *
 * A trap was reachable only by scrolling past two paragraphs of prose about a prediction —
 * which is the wrong order under a lens whose entire subject is the warning. Here it is the
 * first thing, at the size of the thing it is.
 *
 * The list under it is the file's other traps, because a trap is rarely alone: the ordering
 * assumption that bit here usually has a sibling. It comes off the tree the window already
 * holds, so it costs nothing and is silently absent when the file's functions have not been
 * fetched — which is honest, since the alternative is a list that claims a file has no others
 * when nobody looked.
 */
function TrapsSection({
  node,
  repoKey,
  siblings,
  onJump,
}: {
  node: Node
  repoKey: string | null
  siblings?: Node[]
  onJump?: (path: string, line: number) => void
}) {
  const r = node.agent
  const trapped = trapOf(r) && !node.agentStale
  const others = (siblings ?? []).filter(
    (s) => s.id !== node.id && trapOf(s.agent) && !s.agentStale,
  )
  // **On a container, a trap or nothing.** The absence sentences below are worth printing
  // about a FUNCTION — unread is not an all-clear, a dated answer is not a no — because a
  // function is the unit a reader was asked about and each of those is a different state of
  // the same question. A file's reading answers the same question about the file, and a pane
  // that says "no trap reported" and then prints the file's general note has spent the whole
  // section saying there is nothing here. Under this lens, nothing here means show nothing.
  if (node.kind !== 'func' && !trapped) return null
  return (
    <>
      <Block label="Trap" aside={trapped ? 'reported' : undefined}>
        {node.agentStale && r && <StaleNote />}
        {trapped && r?.note ? (
          <NoteBox note={r.note} trapped />
        ) : !r ? (
          <Absent>
            Nobody has read this, so nothing has been asked. Unread is not an all-clear.
          </Absent>
        ) : r.trapDated ? (
          <Absent>
            The reader answered an earlier version of this question, which has since narrowed. A
            narrowing can only take answers away, so the yes it gave is expired and the axis is grey
            until this is read again — it is not a no.
          </Absent>
        ) : (
          <Absent>
            No trap reported. The reader looked and said nothing here will bite whoever edits it
            next.
          </Absent>
        )}
        {r?.note && !trapped && (
          <div className="mt-2">
            <NoteBox note={r.note} trapped={false} />
          </div>
        )}
      </Block>
      {others.length > 0 && (
        <Block label="Also in this file" aside={String(others.length)}>
          {/* **Links and the sentence, never the body.** Every other list on this pane
              carries source because seeing the code IS the answer there — which caller, what
              shape. A trap is not in its body: it is the sentence a reader wrote about what
              the body does not say, and eleven lines of the function it hides in is the least
              informative eleven lines you could show. So the note comes across and the code
              stays one click away, where the function's own pane can give it the room. */}
          <RefList
            refs={others.map((o) => ({
              path: o.path,
              name: o.name,
              owner: o.owner,
              line: o.line ?? 0,
              loc: o.loc,
            }))}
            notes={others.map((o) => o.agent?.note ?? null)}
            code={false}
            repoKey={repoKey}
            onJump={onJump}
          />
        </Block>
      )}
    </>
  )
}

/* ------------------------------------------------------- callers, reach, clones */

/**
 * Which fourteen.
 *
 * The counts these lists are made of have been on the map for a while — `14×` under Callers,
 * `→3` under Reach, `4×` under Clones — and every one of them raised a question the app could
 * not answer. These are the same resolved edges the numbers are folded from, so a list here is
 * exactly as honest as the number above it and never more: a name is not a target, and
 * [`crate::edges`] states what that costs.
 *
 * **Fetched on selection, never sent with the tree.** A repo's worth of neighbour lists is
 * megabytes of function names to answer a question about one wedge — see `links.rs` for why it
 * is stored beside the cached tree rather than rebuilt on the click.
 */
function WiringSection({
  node,
  mode,
  repoKey,
  onJump,
}: {
  node: Node
  mode: 'callers' | 'reach' | 'clones'
  repoKey: string | null
  onJump?: (path: string, line: number) => void
}) {
  const [related, setRelated] = useState<Related | null | 'loading' | 'missing'>('loading')
  const path = node.path
  // Containers never reach here — see the guard at the top of `LensPane` — and this says so
  // rather than trusting it: a container has no line, so the effect asks nothing and the
  // section reports an absence instead of listing another function's callers under its name.
  const line = node.kind === 'func' ? node.line : null
  useEffect(() => {
    if (!repoKey || line === null) {
      setRelated('missing')
      return
    }
    let live = true
    setRelated('loading')
    functionLinks(repoKey, path, line)
      .then((r) => {
        if (live) setRelated(r ?? 'missing')
      })
      .catch(() => {
        if (live) setRelated('missing')
      })
    // Cancelled on the way out rather than left to land: selections change faster than a
    // round trip, and an answer for the previous wedge arriving after the next one's would
    // list another function's callers under this one's name.
    return () => {
      live = false
    }
  }, [repoKey, path, line])

  const label = mode === 'callers' ? 'Callers' : mode === 'reach' ? 'Calls out to' : 'Clones'
  if (related === 'loading') {
    return (
      <Block label={label}>
        <Absent>Looking…</Absent>
      </Block>
    )
  }
  if (related === 'missing' || related === null) {
    return (
      <Block label={label}>
        <Absent>
          The scan holds no function at this position — it may have moved since. It comes back on
          the next scan.
        </Absent>
      </Block>
    )
  }

  if (mode === 'clones') {
    if (!related.comparable) {
      return (
        <Block label="Clones">
          <Absent>
            This body is too short to compare. An empty list here says nothing about whether it is
            unique — the floor is there so a repo does not report four thousand three-line accessors
            as copies of each other.
          </Absent>
        </Block>
      )
    }
    if (related.clones.length === 0) {
      return (
        <Block label="Clones">
          <Absent>Nothing else in this repo has this body.</Absent>
        </Block>
      )
    }
    /* **Two sections, and no paragraph explaining them.** A clone list is a COMPARISON, and
       one section holding both sides with sub-headings inside it read as a single list whose
       first row happened to be you. Two headings say the same thing structurally, which is the
       only place it does not have to be read to work.

       The prose that stood above them — same body, names and formatting normalised away, a
       group is a fact not a verdict — is the definition of the lens, not a fact about this
       function, and it was printed on every clone you looked at. The lens key and its own
       description carry that; the pane shows the pair. */
    return (
      <>
        <Block label="This function" hint={CLONE_HINT}>
          <RefList
            refs={[
              {
                path: node.path,
                name: node.name,
                owner: node.owner,
                line: node.line ?? 0,
                loc: node.loc,
              },
            ]}
            repoKey={repoKey}
          />
        </Block>
        <Block
          label={related.clones.length === 1 ? 'Clone' : 'Clones'}
          hint={CLONE_HINT}
          aside={String(related.clones.length)}
        >
          <RefList refs={related.clones} repoKey={repoKey} onJump={onJump} />
        </Block>
      </>
    )
  }

  const list = mode === 'callers' ? related.callers : related.calls
  // **Counted off the list itself, per lens.** It was `localityOf`, which is the share of ALL
  // this function's neighbours that live elsewhere — callers and callees together — printed
  // under a heading naming only one of them. A number that is not about what is on screen is
  // worse than no number, and this one is a count of the rows above it.
  const home = dirOf(node.path)
  const away = list.filter((r) => dirOf(r.path) !== home).length
  const noun = mode === 'callers' ? 'callers' : 'of the functions it calls'
  return (
    <Block
      label={label}
      aside={related.wired ? `${list.length}` : undefined}
      hint={
        mode === 'callers'
          ? 'Calls are matched by name within one language family. A name defined twice outside this directory is dropped rather than guessed at, so this list is a floor, never a ceiling.'
          : 'Calls are matched by name within one language family, and calls into libraries and dependencies are not counted — only functions defined in this repo.'
      }
    >
      {!related.wired ? (
        <Absent>
          This language's call shape has never been parsed, so nothing was looked for. That is not
          the same as nothing calling it — see the gray on the map.
        </Absent>
      ) : list.length === 0 ? (
        <Absent>
          {mode === 'callers'
            ? 'Nothing in this repo calls this. That is the finding the lens exists to make — an entry point, a trait method reached through a vtable, or dead code.'
            : 'This calls nothing else in this repo. Everything it touches is the standard library or a dependency.'}
        </Absent>
      ) : (
        <>
          <p className="mb-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
            {away === 0
              ? `Every one of them is in ${home || 'the repo root'}.`
              : `${away} of ${list.length} ${noun} ${away === 1 ? 'is' : 'are'} outside ${
                  home || 'the repo root'
                }.`}
          </p>
          <RefList refs={list} repoKey={repoKey} onJump={onJump} />
        </>
      )}
    </Block>
  )
}

/* -------------------------------------------------------------------- language */

/**
 * What it is written in, and what that decides about everything else on screen.
 *
 * **The thinnest lens, and the fix was to show the right small thing rather than more.** A
 * language name is one word and a panel of one word is padding. What is actually worth
 * knowing is what the instrument can SEE in this language: whether its calls were parsed at
 * all — which is the difference between a gray Reach wedge meaning "nothing calls this" and
 * meaning "nobody looked" — and whether the body was long enough to be compared for copies.
 * Both were reachable only from the legend, as a color.
 */
function LanguageSection({ node }: { node: Node }) {
  // `callers` is one function's own count and does NOT survive the roll-up — a file's is
  // always null — so only functions reach this and the field means what it says.
  const wired = node.callers !== null
  const comparable = node.comparable !== null && node.comparable > 0
  const historied = node.score?.ageDays !== null && node.score?.ageDays !== undefined
  // **Only what is MISSING.** This was three bullets that all said yes on a Rust function —
  // "calls are resolved", "long enough to compare", "under git history" — which is a list of
  // things that are fine, in a panel whose whole job is to point at what is not. Nobody could
  // tell what it was for, and the honest reading is that on a well-supported language there
  // is nothing to say here beyond the name.
  const gaps = [
    !wired &&
      'Calls have never been parsed for this language, so Callers and Reach paint grey here rather than zero — nobody looked.',
    !comparable &&
      'Too short to compare for copies, so the Clones lens has no opinion about it either way.',
    !historied &&
      'No git history reaches this file, so Blame, Churn and Age have no second axis to report.',
  ].filter((g): g is string => typeof g === 'string')

  return (
    <Block label="Language" aside={node.lang ?? undefined}>
      {!node.lang ? (
        <Absent>
          No grammar claims this extension, so nothing here was parsed. A file with no language has
          no functions to draw and no calls to resolve.
        </Absent>
      ) : (
        <>
          {/* The third copy of the same widget, moved for the same reason as the one in
              `DocsSection`: one component draws source in this app. */}
          {node.signature && (
            <CodeBlock
              code={node.signature}
              title={node.name}
              subtitle={node.path}
              startLine={node.line ?? undefined}
              height="max-h-[24rem]"
            />
          )}
          {gaps.length === 0 ? (
            <p className="mt-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Fully supported: functions, calls, copies and history are all measured for {node.lang}{' '}
              here.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {gaps.map((g) => (
                <p key={g} className="text-[11px] leading-snug text-[var(--muted-foreground)]">
                  {g}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </Block>
  )
}

/* ------------------------------------------------------------------ complexity */

/** How a size band is said out loud — `100–199 lines`, and `200+` for the open one.
 *
 *  From `TANGLE_EDGES` rather than written out, because the edges have moved once and a
 *  hardcoded caption would have gone on naming the old ones with nothing disagreeing. */
function bandSpan(loc: number, over?: [number, number] | null): string {
  // **The population the median was measured over, not the band's own edges.** A band too thin
  // to have an opinion borrows the one below it — see `tangle::MIN_BAND` — so in a small repo
  // the top band is measured over everything past 199, and naming its own edges would name a
  // population that was never used.
  //
  // Rendered as the group's EDGES rather than as the shortest and longest body actually seen:
  // `203–3015` is exact and reads as two arbitrary numbers, where `200+` is the rule that
  // produced them. The edges are recovered by asking which bands the extremes fall in, so this
  // stays correct however the fold lands.
  const lo = over ? over[0] : loc
  const hi = over ? over[1] : loc
  const first = tangleBandOf(lo)
  const last = tangleBandOf(hi)
  const from = first === 0 ? 1 : TANGLE_EDGES[first - 1] + 1
  return last === TANGLE_EDGES.length
    ? `(${from}+ lines)`
    : `(${from}–${TANGLE_EDGES[last]} lines)`
}

/**
 * Complexity, with its work shown.
 *
 * **The count on its own is a number somebody has to take on faith, and this pane is where
 * that stops.** Two halves, because the lens has two readings and they are answered by
 * different evidence:
 *
 * - The **comparison** answers the weighted reading — this body against the median of the
 *   other bodies its size in this repo. A ratio somebody can check against a figure they can
 *   go and count.
 * - The **sites** answer the raw one — every fork, what it cost, and why. That is the whole
 *   formula, laid out, rather than asserted in a caption.
 *
 * Both are shown under either reading. Which one is on decides which is bolder, not which
 * exists: somebody reading a `10\u00d7` wants to know where it came from, and somebody reading
 * `329` wants to know whether that is a lot for a body this size.
 *
 * The sites are fetched from the WORKING TREE, so this can disagree with the map by exactly
 * the edits made since the scan — the same trade every other section here already makes, and
 * the reason `Snippet::moved` exists one section over.
 */
function TangleSection({
  node,
  onOpen,
  repoKey,
  read,
  bands,
  over,
}: {
  node: Node
  onOpen?: (n: Node) => void
  repoKey: string | null
  read: TangleRead
  bands?: (number | null)[]
  over?: ([number, number] | null)[]
}) {
  const [forks, setForks] = useState<Forks | null | 'loading'>('loading')
  // The body fills whatever the block above it and the paragraph below it leave — see
  // `useFitToPane`, and the note beside the box for what a constant cap got wrong.
  const box = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLParagraphElement>(null)
  const { path, line } = node
  useEffect(() => {
    if (!repoKey || line == null) {
      setForks(null)
      return
    }
    let live = true
    setForks('loading')
    functionForks(repoKey, path, line)
      .then((d) => {
        if (live) setForks(d)
      })
      .catch(() => {
        if (live) setForks(null)
      })
    return () => {
      live = false
    }
  }, [repoKey, path, line])

  // **Above the early return, because a hook after one is a hook that sometimes does not
  // run.** Selecting a function in an uncounted language and then one in a counted one would
  // change the hook COUNT between renders, and React resolves that by handing the next hook
  // the previous one's state. Re-measured whenever what is above or below the box can have
  // moved: a different function is a different paragraph height, and the body arriving is
  // what gives the box a top at all.
  const cap = useFitToPane(box, foot, [forks, node.id], 120)

  const cognitive = node.score?.cognitive
  if (cognitive === null || cognitive === undefined) {
    return (
      <Block label="Complexity">
        <Absent>
          Nobody has taught the parser which nodes fork in {node.lang ?? 'this language'}, so there
          is no count here \u2014 which is not the same as a body that never branches. The lens
          paints these grey rather than cold for that reason.
        </Absent>
      </Block>
    )
  }

  const normal = bands?.[tangleBandOf(node.loc)]
  const ratio = normal == null ? null : cognitive / Math.max(normal, 1)

  // **One mark per LINE, summing that line's own charges.** A line can be charged more than
  // once — `if (a && b)` is a fork and an operator — and two marks on one row would read as
  // two lines. The explanation shown is the priciest of them, which is the one somebody is
  // asking about.
  const marks = new Map<number, { label: string; why: string }>()
  if (forks && forks !== 'loading') {
    const per = new Map<number, { cost: number; worst: number; why: string }>()
    for (const f of forks.forks) {
      const why =
        f.kind === 'chain'
          ? 'A continuation of the fork above it — one decision written twice, so it is charged flat however deep it sits.'
          : f.kind === 'logic'
            ? 'A logical operator: one more condition to hold, not one more level. Charged flat, and a run of one operator counts once.'
            : `One, plus one for each of the ${f.depth} fork${f.depth === 1 ? '' : 's'} it sits inside.`
      const had = per.get(f.line)
      if (!had) per.set(f.line, { cost: f.cost, worst: f.cost, why })
      else {
        had.cost += f.cost
        if (f.cost > had.worst) {
          had.worst = f.cost
          had.why = why
        }
      }
    }
    for (const [line, v] of per) marks.set(line, { label: `+${v.cost}`, why: v.why })
  }

  return (
    <>
      <Block label="Complexity">
        {/* **The same three rows, in words that carry their own units.** They read `this body
            329 / median, 200+ lines 32 / × normal for its size 10×` under a heading that said
            `329 decision points` — so the headline number appeared twice a hand's width apart,
            `median` was a term nobody had been given, and `32` was a bare integer of nothing in
            particular.

            Now the first row names the unit once, the second says what it is being measured
            against IN THIS REPO, and the third is the division of the two. Nothing is repeated
            and no row needs a word the pane has not defined. */}
        {/* **Raw shows the count and stops.** The reading IS the count — a threshold of 15
            is how the RAMP decides a colour, not something anybody is asking about, and a row
            reading `standard limit 15` invited exactly the question it was there to answer.
            Weighted is the opposite case: its number is a ratio, and a ratio with its two
            terms hidden is a claim rather than a measurement, so that one shows its working. */}
        {read === 'raw' ? (
          <dl className="mono grid grid-cols-[1fr_auto] gap-x-3 text-[11px] leading-snug">
            <dt>decision points</dt>
            <dd className="text-right tabular-nums">{cognitive}</dd>
          </dl>
        ) : normal == null ? (
          <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
            {cognitive} decision {cognitive === 1 ? 'point' : 'points'}. Nothing else this size
            has been counted in this repo, so there is nothing to compare it against and the
            lens is painting the count itself.
          </p>
        ) : (
          <dl className="mono grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px] leading-snug">
            <dt>decision points</dt>
            <dd className="text-right tabular-nums">{cognitive}</dd>
            <dt
              className="text-[var(--muted-foreground)]"
              title="The middle body of this size in this repo. What counts as normal is a fact about a codebase rather than about a language, so it is measured here rather than assumed."
            >
              typical for repo {bandSpan(node.loc, over?.[tangleBandOf(node.loc)])}
            </dt>
            <dd className="text-right tabular-nums text-[var(--muted-foreground)]">{normal}</dd>
            <dt className="border-t border-[var(--border)] pt-0.5">complexity factor</dt>
            <dd className="border-t border-[var(--border)] pt-0.5 text-right tabular-nums">
              {(() => {
                const r = ratio ?? 0
                return `${r < 10 ? r.toFixed(1) : Math.round(r)}×`
              })()}
            </dd>
          </dl>
        )}
      </Block>

      {/* **Its own section, because it is the only thing on this pane that is unbounded.**
          A body runs to thousands of lines, and inside one block it pushed the sentence
          explaining the formula off the bottom of the pane — the caption that makes the
          numbers beside it mean anything, reachable only by scrolling past the thing it
          explains. The body scrolls in a box of its own now and the footer sits under it,
          where it stays put however long the function is. */}
      {/* **Its own section, and the same code box every other pane uses.** It had a
          hand-rolled one — gutter, body, a mark per line — which was three-quarters of
          `CodeBlock` reimplemented beside it and looking like it, minus the dedent, the
          tokenizer, the copy button and the open-in-full modal. Three panes drawing a body
          three different ways is the shape of every "why does this look different here"
          question, so the marks moved INTO the shared component instead.

          Separate from the block above because it is the only thing on this pane that is
          unbounded: inside one block a long body pushed the sentence explaining the formula
          off the bottom of the pane — the caption that makes the numbers beside it mean
          anything, reachable only by scrolling past the thing it explains. */}
      <Block label="Body" aside={forks && forks !== 'loading' ? `${node.loc} lines` : undefined}>
        {forks === 'loading' ? (
          <p className="text-[11px] text-[var(--muted-foreground)]">Reading the body…</p>
        ) : !forks ? (
          <Absent>
            The file has changed since the scan, so the lines this was counted over are not the
            lines that are there now. It comes back on the next scan.
          </Absent>
        ) : (
          <>
            {/* **The count from the FETCH, beside the one from the scan, and only when they
                differ.** Silent agreement is the ordinary case and says nothing worth a row; a
                disagreement means somebody edited the file since the scan, and marks that do
                not sum to the figure above them read as an arithmetic bug unless this says
                otherwise. */}
            {forks.cognitive !== cognitive && (
              <p className="mb-1 text-[11px] leading-snug text-[var(--muted-foreground)]">
                The file has been edited since the scan: it holds {forks.cognitive} now, against
                the {cognitive} the map is painted with.
              </p>
            )}
            {/* **The whole body, with the charged lines lifted out of it.** A list of only the
                forks is the evidence with the context cut out — a `+3` is legible as NESTING
                only next to the lines it is nested in, and the indentation those lines carry is
                the same fact the number states.

                Taller than the neighbour snippets, because this one is the subject rather than
                a glance at somewhere else. Capped against the WINDOW rather than in `rem`: the
                pane is as tall as the app is, and a fixed box leaves half of it empty on a
                large screen and overflows a small one. */}
            {/* The caveat is drawn here rather than passed to `CodeBlock` so the measured
                box below starts BELOW it — `useFitToPane` reads the top of what it is given,
                and a note inside the component would be counted as part of the space the code
                gets and then added on top of it. */}
            {forks.truncated && (
              <p className="mb-1 text-[10px] leading-snug text-[var(--warning)]">
                Display truncated at 2,000 lines.
              </p>
            )}
            {/* **Measured, not capped at a fraction of the window.** `max-h-[60vh]` is a
                constant guess at how much room is left, and it was wrong in both directions:
                short of the pane's bottom on a tall window, past it on a short one — which
                scrolled the PANE, taking the paragraph that explains the marks with it. The
                box ends where the pane does and the footer stays put. */}
            <div ref={box}>
              <CodeBlock
                code={forks.lines.join('\n')}
                title={node.name}
                subtitle={`${node.path}:${forks.start}`}
                // The whole file, scrolled to this body — `onDrill` on a function opens the
                // file that holds it and reveals it, which is the same gesture the map's
                // double-click makes. See `CodeBlock.onOpen`.
                onOpen={onOpen && (() => onOpen(node))}
                startLine={forks.start}
                maxHeight={cap}
                marks={marks}
              />
            </div>
            <p ref={foot} className="mt-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Every fork counts as a{' '}
              <span className="font-semibold text-[var(--foreground)]">decision point</span>, plus
              one for each fork it sits inside, so nested branches count for more than flat. An{' '}
              <code>else if</code> counts as one decision point, and so does a logical operator.
            </p>
          </>
        )}
      </Block>
    </>
  )
}

/* -------------------------------------------------------- blame, churn and age */

/**
 * Three lenses, three pictures, one fetch.
 *
 * **They were one dataset in three orders, and that is not three answers.** All three read the
 * same per-line `(commit, author, time)` triple, so the pane gave each a different headline and
 * flipped which list came first — decoration standing in for a difference. On the MAP they are
 * genuinely three questions, with three ramps: who last touched it, how much it moved lately,
 * how long since anyone did. The pane now answers those three questions in the shape each one
 * wants.
 *
 * - **Blame** is a list of people, so it is a list of people.
 * - **Churn** is a rate, so it is a calendar. A count cannot show you that fourteen commits
 *   were one afternoon.
 * - **Age** is a span, so it is a timeline — the shape of a history, not a sentence about its
 *   ends.
 *
 * The blame fetch is shared because all three still rest on it; Churn adds the file's commit
 * dates, which blame cannot supply — it only knows the commits whose lines SURVIVED.
 */
function HistorySection({
  node,
  mode,
  repoKey,
  ranks,
}: {
  node: Node
  mode: 'blame' | 'churn' | 'age'
  repoKey: string | null
  ranks?: Map<string, number>
}) {
  const [history, setHistory] = useState<LineHistory | null | 'loading'>('loading')
  const { path, line, endLine } = node
  useEffect(() => {
    if (!repoKey) {
      setHistory(null)
      return
    }
    let live = true
    setHistory('loading')
    // A file blames whole; a function walks its own range. `0` is the whole-file case rather
    // than a second command, because the two questions are the same question at two scopes.
    functionHistory(repoKey, path, line ?? 0, endLine ?? 0)
      .then((d) => {
        if (live) setHistory(d)
      })
      .catch(() => {
        if (live) setHistory(null)
      })
    return () => {
      live = false
    }
  }, [repoKey, path, line, endLine])

  const label = mode === 'blame' ? 'Last commit' : mode === 'churn' ? 'Churn' : 'Lifespan'
  /** The one sentence every section here is read under, on the heading instead of under it.
   *
   *  **It names the POPULATION, because that is what told the lenses apart.** Blame can only
   *  see the commits whose lines SURVIVED; the walk behind Churn and Age sees every commit
   *  that changed the range, including the ones whose work is gone. One record carries both.
   *
   *  It was a paragraph, printed twice per pane, and it is a fact about the INSTRUMENT rather
   *  than about the function you clicked. Stated where it can be found and not where it has to
   *  be scrolled past. */
  const HINT =
    'One walk of these lines, three questions about it. Blame is what SURVIVES — the commit that last touched each line, so a body rewritten wholesale reads as new. Churn and Age are every commit that CHANGED the range, which git follows through a rewrite, so their oldest rows can belong to code that stood here before this function did.'

  if (history === 'loading') {
    return (
      <Block label={label}>
        <Absent>Reading the history…</Absent>
      </Block>
    )
  }
  if (!history || (history.lines === 0 && history.changes.length === 0)) {
    return (
      <Block label={label}>
        <Absent>
          Git has nothing for these lines — an untracked file, a repo with no history, or a file
          that has moved since the scan. Churn and Age degrade to "no history" on the map for the
          same reason.
        </Absent>
      </Block>
    )
  }
  if (mode === 'churn') {
    return <ChurnSection node={node} history={history} hint={HINT} />
  }
  if (mode === 'age') {
    return <AgeSection history={history} hint={HINT} repoKey={repoKey} />
  }

  const newest = history.touches[0]
  return (
    <>
      <Block label={label} hint={HINT}>
        {/* The same openable row the lifespan uses. It was its own little layout, which meant
            one of the two places a commit appears on this pane opened and the other did not. */}
        {newest ? (
          <Touch t={newest} bright repoKey={repoKey} />
        ) : (
          <Absent>No line of this range survives in the file as it stands.</Absent>
        )}
      </Block>
      {/* **On a file, the last commit and nothing else.** `Summary` already breaks a container
          down by author under this lens — with each author's functions listed under them — so
          these two printed a second, coarser version of it directly above the real one, and
          the pane said AUTHORS twice. A file's own contribution here is the one fact the
          breakdown has no room for: which commit touched it last. Per-line provenance stays
          on the FUNCTION, where there is no breakdown to duplicate and the lines being
          attributed are the ones on screen. */}
      {node.kind !== 'func' ? null : (
        <>
          <Block
            label="Lines by author"
            hint={HINT}
            aside={`${history.authors.length} ${history.authors.length === 1 ? 'person' : 'people'}`}
          >
            {history.authors.map((a) => (
              <div key={a.author} className="mb-1 flex items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-[11px]"
                  style={{ fontFamily: FAMILY }}
                >
                  {a.author}
                </span>
                <span className="h-[6px] w-[70px] shrink-0 overflow-hidden rounded-[2px] bg-[var(--secondary)]">
                  <span
                    className="block h-full rounded-[2px]"
                    style={{
                      width: `${Math.max(3, (a.lines / history.lines) * 100)}%`,
                      // Their own slot, which is the colour their wedges are wearing three inches
                      // to the left. Beyond the palette everything is `OTHER`, exactly as on the
                      // ring — an author off the end of the legend is off the end here too.
                      background: slotColor(ranks?.get(a.author) ?? Number.MAX_SAFE_INTEGER),
                    }}
                  />
                </span>
                <span className="mono w-[54px] shrink-0 text-right text-[10px] tabular-nums text-[var(--muted-foreground)]">
                  {a.lines} / {history.lines}
                </span>
              </div>
            ))}
          </Block>
          {/* **The surviving half, said as what it is.** These are the commits with lines still
          here, which is a subset of the history Age draws — the heading names the population
          so the two lenses cannot be read as disagreeing about a count. */}
          <Block
            label="Where these lines came from"
            hint={HINT}
            aside={`${history.touches.length} of ${history.changes.length}`}
          >
            {history.touches.map((t) => (
              <Touch key={t.commit + t.when} t={t} repoKey={repoKey} />
            ))}
          </Block>
        </>
      )}
    </>
  )
}

/** Fit a scrolling box to the pane it is in, measuring BOTH ends of the guess.
 *
 *  **The top was measured and the bottom was a constant, so half of it was still a guess.** A
 *  cap of `100vh - 360px` became "ask the element for its own top", which fixed the header —
 *  and kept a hand-written number for everything below, plus `window.innerHeight` for the
 *  bottom. Neither is the pane: the pane ends above the window by whatever chrome sits under
 *  it, and what has to stay visible below the box is a paragraph that wraps to two lines on
 *  some functions and one on others. Both showed up as the thing the cap exists to avoid — a
 *  scrollbar with empty pane beneath it.
 *
 *  So the box asks for its own top, the SCROLLING ANCESTOR for its bottom, and the element
 *  that must stay under it for its height. `useLayoutEffect` so it is set before the frame is
 *  painted rather than one frame late, which would flash a taller list and then clip it. */
/** A CSS length in pixels, or zero — `getComputedStyle` returns `""` for an unset property
 *  and `NaN` propagates silently through the arithmetic that would use it. */
function px(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function useFitToPane(
  box: React.RefObject<HTMLElement | null>,
  below: React.RefObject<HTMLElement | null>,
  deps: unknown[],
  floor = 96,
) {
  const [cap, setCap] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const fit = () => {
      const el = box.current
      if (!el) return
      // The pane, found rather than named: whichever ancestor actually scrolls is the one
      // whose bottom this box has to stop at.
      let pane: HTMLElement | null = el.parentElement
      while (pane) {
        const flow = getComputedStyle(pane).overflowY
        if (flow === 'auto' || flow === 'scroll') break
        pane = pane.parentElement
      }
      // **The pane's CONTENT bottom, not its border box.** Its bottom padding is inside the
      // scrolling area and sits below everything measured here, so counting to the outer edge
      // hands the box that padding twice and the pane overflows by exactly it. It read as the
      // header creeping up under a scrollbar that should not have existed.
      const bottom = pane
        ? pane.getBoundingClientRect().bottom - px(getComputedStyle(pane).paddingBottom)
        : window.innerHeight
      // A few pixels of air, so the last row does not sit flush against the pane's edge.
      const SLACK = 10
      // **Its margin too.** `getBoundingClientRect` is the border box and margins are outside
      // it, so a footer with `mt-2` takes eight pixels this could not see — small, and it is
      // the whole difference between a pane that scrolls and one that does not.
      const el2 = below.current
      const under = el2
        ? el2.getBoundingClientRect().height +
          px(getComputedStyle(el2).marginTop) +
          px(getComputedStyle(el2).marginBottom)
        : 0
      setCap(Math.max(floor, bottom - el.getBoundingClientRect().top - under - SLACK))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return cap
}

/**
 * How old this is, drawn as the span it is.
 *
 * **A sentence about two dates is not an age.** "Newest line landed 9 months ago; the oldest
 * has been here since 9 months ago" is two facts that need arithmetic to become the one thing
 * the lens is for, and on a function written in a single sitting it reads as a bug. A timeline
 * shows the span, the gaps in it, and where the work clustered — which is what "how old is
 * this" actually means once you look at it.
 *
 * **Newest at the top, because that is the end you are standing at.**
 *
 * **It draws the CHANGES, not the survivors, and that is the half of this that was wrong.** The
 * timeline was blame's list, so its far end was the oldest surviving LINE — a floor a rewrite
 * resets — while the calendar beside it, once Churn took its own walk, ran back to the first
 * commit that ever changed the range. Two tabs, two first dates, and nothing on either saying
 * which population it had. One record answers both now: the rows are every commit that changed
 * these lines, each carrying how much of it is still here, so a run of rows with nothing left
 * IS the rewrite the old floor could only hide.
 */
function AgeSection({
  history,
  hint,
  repoKey,
}: {
  history: LineHistory
  hint: string
  repoKey: string | null
}) {
  // `changes` and not `touches`: the survivors are a subset, and a lifespan drawn from a subset
  // ends wherever the last rewrite was.
  const rows = history.changes
  const newest = rows[0]
  const oldest = rows[rows.length - 1]
  const between = rows.slice(1, -1)

  // The run between the ends scrolls; the OLDEST row under it is what has to stay visible, so
  // it is measured rather than allowed for.
  const mid = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLDivElement>(null)
  const cap = useFitToPane(mid, foot, [between.length, rows.length])
  return (
    <Block label="Lifespan" hint={hint} aside={`${rows.length} commits`}>
      {/* **The two ends are the answer; the middle is the working.**
       *
       *  This was one time-positioned column, and both of its properties were wrong. Spacing
       *  by date left holes — a function with a burst last week and a tail from 2022 drew most
       *  of its height as blank pane, which reads as something failing to load. And the fact
       *  the lens exists to give you, when the newest line was written and when the oldest
       *  was, was two rows separated by however many commits happened to be in between, so a
       *  function with thirty of them put the two halves of one sentence a scroll apart.
       *
       *  Pinned, then, with the run between them scrolling under its own count. Both ends stay
       *  on screen at whatever length of history, which is the whole gesture. */}
      <Edge label="Newest" t={newest} bright repoKey={repoKey} />
      {/* **Scrolls only when it has to, and Oldest lands at the bottom of the pane.** A fixed
          cap clipped ten commits into a 220px box with half the pane empty underneath it,
          which is a scrollbar offered instead of the space that was already there. */}
      {between.length > 0 && (
        <div
          ref={mid}
          className="my-1 overflow-y-auto border-y border-[var(--border)] py-1"
          style={{ maxHeight: cap }}
        >
          <p className="mb-1 text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">
            {between.length} in between
          </p>
          {between.map((t) => (
            <Touch key={t.commit + t.when} t={t} repoKey={repoKey} />
          ))}
        </div>
      )}
      <div ref={foot}>
        {rows.length > 1 && <Edge label="Oldest" t={oldest} repoKey={repoKey} />}
      </div>
    </Block>
  )
}

/** One end of a lifespan, named as the end it is.
 *
 *  The tag is what makes the pair readable at a glance: two dates in a column are two dates,
 *  and a reader should not have to know that this list is sorted to know which is which. */
function Edge({
  label,
  t,
  bright,
  repoKey,
}: {
  label: string
  t: TouchRow
  bright?: boolean
  repoKey: string | null
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <Touch t={t} bright={bright} repoKey={repoKey} />
    </div>
  )
}

type TouchRow = LineHistory['changes'][number]

/** The corner control that opens something — the same glyph and the same weight the code
 *  tiles use.
 *
 *  **An affordance you have to guess at is not one.** The row was the button for a while: a
 *  whole commit row that opened a modal on click, with nothing on it saying so. Two things
 *  were wrong with that — a reader has to try it to find it, and the row is a piece of
 *  information rather than a control, so making all of it clickable means every stray click
 *  in a list opens a dialog. */
function ExpandIcon({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      // **A chip, not a bare glyph.** At 10px and 40% on the pane's own ground the mark
      // disappeared into the row it was sitting beside — two thin diagonals among a date, a
      // sha and a line count, all of which are also thin grey marks. A ground and a hairline
      // make it read as a control rather than as punctuation, which is the same shape the
      // code tiles' expand takes for the same reason.
      className="shrink-0 rounded-[4px] border border-[var(--border)] bg-[var(--secondary)] p-[3px] text-[var(--muted-foreground)] transition-colors hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]"
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M7.2 1.4h3.4v3.4M4.8 10.6H1.4V7.2M10.6 1.4 7 5M1.4 10.6 5 7"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

/** One commit, as a row with a way into it. */
function Touch({ t, bright, repoKey }: { t: TouchRow; bright?: boolean; repoKey: string | null }) {
  const [open, setOpen] = useState(false)
  // `uncommitted` is git's word for the working tree — there is nothing to show, so the row
  // offers nothing rather than a modal that would come back empty.
  const openable = repoKey !== null && /^[0-9a-f]+$/.test(t.commit)
  return (
    <div className="mb-1.5 flex items-start gap-2">
      <span
        className="mt-[4px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{
          // The newest mark takes the bright end of the ramp this lens paints with, so the
          // pane and the wedge agree about which end is which.
          background: bright ? heatColor(0.9, 'age') : 'var(--muted-foreground)',
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] leading-tight">{when(t.when)}</span>
          <span className="mono shrink-0 text-[9px] text-[var(--muted-foreground)]">
            {t.commit}
          </span>
          {/* **Labelled, because a bare number beside a date is a riddle.** It is how many of
              this function's CURRENT lines that commit still accounts for — the same figure
              the author bars divide up. The unit is dimmed so a column of them still scans as
              numbers.

              **Zero is a row that says `gone`, not one that says `0 lines`.** The history holds
              every commit that changed these lines and blame holds the ones whose work
              survives; joining them put both in one list, and the difference is the finding —
              a run of `gone` rows under a recent commit IS a rewrite, which a blame-only list
              could express only by not being there. A number would read as a measurement of
              nothing rather than as an absence. */}
          <span
            className="mono ml-auto shrink-0 whitespace-nowrap text-[9px] tabular-nums text-[var(--muted-foreground)]"
            title={
              t.lines > 0
                ? 'Lines of this range git still attributes to this commit'
                : 'This commit changed these lines and none of its work is left here'
            }
          >
            {t.lines > 0 ? (
              <>
                {t.lines} <span className="opacity-60">{t.lines === 1 ? 'line' : 'lines'}</span>
              </>
            ) : (
              <span className="opacity-60">gone</span>
            )}
          </span>
          {openable && (
            <ExpandIcon title={`Open commit ${t.commit}`} onClick={() => setOpen(true)} />
          )}
        </div>
        <p
          className="truncate text-[10px] leading-tight text-[var(--muted-foreground)]"
          style={{ fontFamily: FAMILY }}
          title={`${t.summary} — ${t.author}`}
        >
          {t.summary || '—'}
        </p>
        {/* **A crossed rename, on the row where it was crossed.** Both halves of this record
            follow renames — blame by default, `-L` on its own — and neither said so, so a row
            dated 2007 was made against a path that no longer exists and the only way to find
            out was to open the commit and be surprised by its file list. */}
        {t.path && (
          <p
            className="mono truncate text-[9px] leading-tight text-[var(--muted-foreground)] opacity-70"
            title={`These lines were in ${t.path} at this commit`}
          >
            in {t.path}
          </p>
        )}
      </div>
      {open && <CommitCard repoKey={repoKey} sha={t.commit} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** The fewest weeks worth drawing as a calendar. A function written last Tuesday has one row
 *  of history, and one row is a swatch rather than a picture. */
const MIN_CHURN_WEEKS = 6

/**
 * Churn as a calendar, because churn is a rate.
 *
 * **A count cannot show you that fourteen commits were one afternoon.** `11 in 90d` is the
 * number the ramp is built on and it is genuinely ambiguous between a function somebody works
 * on every week and one rewritten twice in a fortnight and left alone — opposite findings, and
 * the second axis exists to tell brilliance from mess. The shape is the answer, so the shape is
 * what is drawn.
 *
 * **By FUNCTION, and that is the whole of this section.** It drew the file's commits, under a
 * heading naming the file, in a pane opened on one function — so every cell was about a subject
 * the reader had not selected, and `LevelEditor.gd` read `147 in 90d` whichever of its forty
 * functions you clicked. The rows are `history.changes` now: the same commits the lifespan
 * beside it lists, counted per day instead of listed. One record, two shapes, so a calendar and
 * a timeline cannot disagree about a date.
 *
 * **The map's ramp is still the FILE's**, because that is what a scan can afford — so the
 * wedge's colour and this grid answer two different questions and the heading says which is
 * which. The 90-day window went with the file: it was the window the RAMP is measured over.
 *
 * **The whole history, scrolling, with the key and the totals pinned.** A rate needs a
 * denominator you can see: a fixed 26 weeks draws a function untouched since 2019 and one
 * written last month as the same mostly-empty grid. Empty rows are the finding here, so they
 * are drawn to the oldest commit and the weekday letters stay put while they scroll.
 *
 * Vertical because the pane is 260px wide and a year across is three pixels a week.
 */
function ChurnSection({ node, history, hint }: { node: Node; history: LineHistory; hint: string }) {
  // The grid scrolls to the pane's bottom, less the summary that has to stay under it — which
  // is measured, because that sentence is one line on most functions and three on a renamed
  // one in a dirty worktree. A constant there left a band of empty pane below the calendar.
  const grid = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLParagraphElement>(null)
  const cap = useFitToPane(grid, foot, [history], 120)

  const label = 'Churn'
  const stamps = history.changes.map((c) => c.when).filter((t) => t > 0)
  if (stamps.length === 0) {
    return (
      <Block label={label} hint={hint}>
        <Absent>
          No commit in this history changed these lines. On a tracked file that means the range is
          not in HEAD — code written since the last commit, or a scan the file has moved under.
        </Absent>
      </Block>
    )
  }

  // Days, newest first, bucketed. Local midnight rather than UTC: a calendar is read in the
  // reader's own week, and a commit made at 9pm has to land on the day they made it.
  const midnight = (ms: number) => {
    const d = new Date(ms)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  const today = midnight(Date.now())
  const DAY = 86_400_000
  const counts = new Map<number, number>()
  for (const t of stamps) {
    const day = midnight(t * 1000)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  // The grid runs whole weeks so the columns are weekdays. The top row is the week `today`
  // sits in, which means it is usually part-empty on the right — the future is not drawn.
  const dow = new Date(today).getDay()
  const weekStart = today - dow * DAY
  const peak = Math.max(1, ...counts.values())
  const oldest = stamps[stamps.length - 1]
  const oldestWeek = midnight(oldest * 1000) - new Date(midnight(oldest * 1000)).getDay() * DAY
  const weeks = Math.max(MIN_CHURN_WEEKS, Math.round((weekStart - oldestWeek) / (7 * DAY)) + 1)
  const CELL = 13
  const GAP = 3
  /** The month labels, which hang off the LEFT of each row. */
  const GUTTER = 22
  /** The seven weekday columns: the only part of this with a width of its own. */
  const GRID = 7 * CELL + 6 * GAP
  /** Room kept for the week counts, which hang off the RIGHT of each row.
   *
   *  **Centring has to include the ink that is out of flow.** Both annotations are positioned
   *  against their row rather than laid out in it, so a box drawn round the grid alone is not
   *  the shape a reader sees — centre that and the picture sits left of centre by however wide
   *  the counts are. Wide enough for three digits: a busy week on a repo like ceph reads
   *  `128 commits`. */
  const COUNTS = 78
  // **The rename comes off the oldest row, which is where Age reads it too.** Both lenses are
  // looking at one list, so the fact arrives once and is stated in whichever of them is open.
  const originPath = history.changes[history.changes.length - 1]?.path ?? null
  // **The file is worth naming only where it is older than the lines and the walk says why.**
  // On a `created` origin the two dates are one event wearing two hats — the same rule the Age
  // ceiling follows, that a bound which does not bind is a second date under the first. A day
  // of slack, because a file created and edited in one afternoon is not one to be younger than.
  const olderFile =
    history.origin === 'added' && history.fileFirst !== null && history.fileFirst < oldest - 86_400

  return (
    <Block label={label} aside={`${stamps.length} commits`} hint={hint}>
      {/* **The picture is centred; the SCROLLER is not.** Both are boxes of the same width, and
          making the scrolling one that width put its scrollbar against the picture's edge —
          floating in the middle of the pane, attached to nothing a reader can see. A scrollbar
          belongs at the edge of the thing it scrolls, which as far as anyone looking at it is
          concerned is the pane. So the scroller runs the full width and its CONTENTS take the
          centred box, which is also what keeps the key and the grid on one offset: the weekday
          letters label the columns under them, and an offset applied in two places is an offset
          that gets fixed in one. */}
      <div className="mx-auto" style={{ width: GUTTER + 8 + GRID + COUNTS }}>
        {/* The key is outside the scroller, because a key that scrolls away stops being one. */}
        <div className="flex" style={{ gap: GAP, marginLeft: GUTTER + 8 }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span
              key={i}
              className="text-center text-[8px] leading-none text-[var(--muted-foreground)]"
              style={{ width: CELL }}
            >
              {d}
            </span>
          ))}
        </div>
      </div>
      {/* The scroller wraps the month gutter as well as the grid: those labels are positioned
          against their own row and would be clipped by an overflow set on the column alone. */}
      <div ref={grid} className="mt-1 overflow-y-auto" style={{ maxHeight: cap }}>
        <div className="mx-auto" style={{ width: GUTTER + 8 + GRID + COUNTS }}>
          <div className="flex gap-2">
            {/* A calendar nobody can orient in is a texture. Two labels do it: the weekday
                across the top, and the month where the rows cross into one — the same two
                GitHub's carries, turned ninety degrees with the grid. */}
            <div className="shrink-0" style={{ width: GUTTER }} />
            <div className="flex flex-col" style={{ gap: GAP }}>
              {Array.from({ length: weeks }, (_, w) => {
                const start = weekStart - w * 7 * DAY
                let week = 0
                for (let d = 0; d < 7; d++) week += counts.get(start + d * DAY) ?? 0
                return (
                  <div key={start} className="relative flex" style={{ gap: GAP }}>
                    {/* The month, on the row that first falls inside it reading downward — so
                        the label marks where the month BEGINS as the eye travels back through
                        time. The year rides with January, because a grid this long crosses
                        several and "Mar" over a row four years back is a month of no
                        particular year. */}
                    {(w === weeks - 1 ||
                      new Date(start).getMonth() !== new Date(start - 7 * DAY).getMonth()) && (
                      <span className="absolute right-full mr-2 whitespace-nowrap text-[8px] leading-[13px] text-[var(--muted-foreground)]">
                        {new Date(start).toLocaleDateString(undefined, {
                          month: 'short',
                          ...(new Date(start).getMonth() === 0 || w === weeks - 1
                            ? { year: '2-digit' }
                            : {}),
                        })}
                      </span>
                    )}
                    {Array.from({ length: 7 }, (_, d) => {
                      const day = start + d * DAY
                      const n = counts.get(day) ?? 0
                      const future = day > today
                      return (
                        <div
                          key={day}
                          title={
                            future
                              ? undefined
                              : `${new Date(day).toLocaleDateString()} — ${n} ${n === 1 ? 'commit' : 'commits'}`
                          }
                          style={{
                            width: CELL,
                            height: CELL,
                            borderRadius: 2,
                            // One ramp, sampled by the day's share of the busiest day — the
                            // same churn ramp the wedge is painted with, so a hot row here and
                            // a hot wedge out there are the same colour by construction.
                            background: future
                              ? 'transparent'
                              : n === 0
                                ? 'var(--secondary)'
                                : heatColor(0.25 + 0.75 * (n / peak), 'churn'),
                            opacity: future ? 0 : 1,
                          }}
                        />
                      )
                    })}
                    {/* **The week's own count, on the weeks that have one.**
                        The column beside the grid held the 90-day window's bracket and total,
                        which is the number already printed in the heading — so the calendar's
                        only annotation restated the header while the rows themselves, which
                        are the thing being read, said nothing. A count per week is the fact
                        the picture is made of: it turns "a dark cell" into "four commits that
                        week", and blank weeks stay blank, which is what makes a busy one
                        visible. */}
                    {week > 0 && (
                      <span className="mono absolute left-full ml-2 whitespace-nowrap text-[9px] leading-[13px] tabular-nums text-[var(--muted-foreground)]">
                        {week}{' '}
                        {/* The unit, said every time it appears. A bare column of numbers
                            beside a grid of squares is a quantity of nothing in particular —
                            the reader has to infer that a row is a week and the number is its
                            commits, and the cost of not making them infer it is one dimmer
                            word. */}
                        <span className="opacity-60">{week === 1 ? 'commit' : 'commits'}</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {/* **The bottom of the grid is where the walk stopped, and it says what kind of stop it
          was rather than assuming the worst one.** This asserted a rewrite the instrument
          cannot see — "a floor, not a birthday" — over what is nearly always a function written
          into a file older than itself. `git log -L` ends where these lines came from nowhere,
          which is either the file being created or the lines being inserted into it, and those
          are two different sentences. The rewrite caveat is real and points the other way, so
          it lives on the heading: the walk goes THROUGH a rewrite, and the oldest rows can be
          about text that is gone. */}
      <p ref={foot} className="mt-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
        {stamps.length} {stamps.length === 1 ? 'commit' : 'commits'} since{' '}
        {new Date(oldest * 1000).toLocaleDateString()}, busiest day {peak}.
        {olderFile && (
          <>
            {' '}
            Written into {node.path.split('/').pop()}, which goes back to{' '}
            {new Date((history.fileFirst as number) * 1000).toLocaleDateString()}.
          </>
        )}
        {/* **A crossed rename is reported, because the alternative is a reader inferring it.**
            The walk names the path these lines were under when it ended; without it, a function
            that moved files reads as one whose history simply predates its file. */}
        {originPath && (
          <>
            {' '}
            These lines started out in <span className="mono">{originPath}</span>.
          </>
        )}
        {history.dirty && (
          <>
            {' '}
            <span title="The scan read the worktree; git log -L reads HEAD.">
              This file has uncommitted changes, so these lines may not be the lines the walk
              followed.
            </span>
          </>
        )}
      </p>
    </Block>
  )
}

/** A timestamp as something a person reads, in their own locale.
 *
 *  Relative up to a year because that is the range a reader is placing a commit in — "3 months
 *  ago" answers the question a date makes you do arithmetic for. Past that the date is the
 *  more useful thing, and the exact one is on the title of the row either way. */
function when(seconds: number): string {
  if (!seconds) return 'unknown'
  const days = (Date.now() / 1000 - seconds) / 86_400
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 60) return `${Math.round(days)} days ago`
  if (days < 365) return `${Math.round(days / 30)} months ago`
  return new Date(seconds * 1000).toLocaleDateString()
}
