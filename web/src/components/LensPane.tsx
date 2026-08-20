import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Markdown, CopyButton } from './Prose'
import { CodeBlock } from './CodeBlock'
import { CommitCard } from './CommitCard'
import { PAPER } from '../lib/ink'
import { FAMILY } from '../lib/labelStyle'
import { slotColor, type ColorMode } from '../lib/colorMode'
import {
  DOC_GAP,
  DOC_WORDS,
  GRADE_SURPRISE,
  HEAT_WORDS,
  LEGIBLE_WORDS,
  functionHistory,
  functionLinks,
  functionSources,
  fileCommits,
  heatColor,
  legibleOf,
  trapOf,
  type AgentReport,
  type FuncRef,
  type Grade,
  type Node,
  type RangeDetail,
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
 * So the pane splits. Everything above this — the name, the path, the dials, the ranks, the
 * provenance footer — qualifies EVERY lens and never moves; this is the one section that
 * follows the tabs. Two rules hold across all of them, and they are the map's own:
 *
 * - **An absent measurement is stated, never hidden.** A lens with nothing to say says why —
 *   "this language's calls have never been parsed" is a different fact from "nothing calls
 *   this", and the second is a finding. Every section here has to keep them apart, the same
 *   way `colorMode` keeps gray apart from the bright end of a ramp.
 * - **A stale or dated reading does not colour anything here either.** It is shown as
 *   history, marked, and left out of every count — which is what `applyAgentReports` does to
 *   the wedge and `legibleOf` does to the dial.
 */
export function LensPane({
  node,
  mode,
  repoKey,
  replaying,
  siblings,
  ranks,
  onJump,
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
  /** Show the function at this position. Undefined where the window cannot navigate, which
   *  makes every row below plain text rather than a promise it cannot keep. */
  onJump?: (path: string, line: number) => void
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
          The map is showing a past commit. Everything this pane measures — the reading, the
          docs, the wiring, the blame — is about the code as it is now, so there is nothing
          here that would be true of this frame. Leave History to see it.
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
    const own: ColorMode[] = ['surprise', 'docs', 'traps', 'blame']
    if (!own.includes(mode)) return null
  }
  switch (mode) {
    case 'surprise':
      return <SurpriseSection node={node} />
    case 'legible':
      return <LegibleSection node={node} report={r} stale={stale} />
    case 'docs':
      return <DocsSection node={node} report={r} stale={stale} />
    case 'traps':
      return (
        <TrapsSection node={node} repoKey={repoKey} siblings={siblings} onJump={onJump} />
      )
    case 'callers':
    case 'reach':
    case 'clones':
      return <WiringSection node={node} mode={mode} repoKey={repoKey} onJump={onJump} />
    case 'language':
      return <LanguageSection node={node} />
    case 'blame':
    case 'churn':
    case 'age':
      return (
        <HistorySection
          node={node}
          mode={mode}
          repoKey={repoKey}
          ranks={ranks}
        />
      )
  }
}

/* ---------------------------------------------------------------- shared parts */

/** A section of the pane, under the same full-bleed rule every other one takes.
 *
 *  Full-bleed (`-mx-4`) and re-padded so the rule reaches both edges of the pane exactly as
 *  the dials' and the contents list's do — a rule that stops short of the edge reads as a box
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
    <div className="-mx-4 mt-4 border-t border-[var(--border)] px-4 pt-3">
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
 *  **The ladder lives here and not in the dial row.** Three of them side by side read as a
 *  phrase rather than as three readings — that is why `Dials` prints `2/4` instead — but a
 *  lens section has exactly one grade in it and all the room in the world, and the rung
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
}: {
  grade: Grade | undefined
  words: Record<Grade, string>
  rungs: Record<Grade, string>
  ramp: Ramp
  /** Where each grade samples its ramp — the map's own uneven spacing, never a flat quarter
   *  each, or the panel shows four colors the map never uses. */
  at: Record<Grade, number>
  dated?: boolean
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
                background: on && !dated ? heatColor(at[g], ramp) : 'var(--secondary)',
                outline: on ? '1px solid var(--muted-foreground)' : undefined,
              }}
            />
            <span
              className={`mono w-[64px] shrink-0 text-[11px] ${
                on ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
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
      this code has changed since it was read, so what follows describes a body that is no
      longer here. It is kept as history and colors nothing.
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
          Source shown for the first {SNIPPETS} of {refs.length}. The rest say Show code.
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
          Nobody has read this yet. Readings come from an agent working through the repo over
          MCP — point one at this project and it will fill in.
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
export function Passage({
  label,
  text,
  hint,
}: {
  label: string
  text: string
  hint: string
}) {
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
        style={trapped ? { background: 'var(--trap)', color: PAPER } : { color: 'var(--foreground)' }}
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
function LegibleSection({
  node,
  report,
  stale,
}: {
  node: Node
  report?: AgentReport
  stale: boolean
}) {
  // A file's reading carries no legibility grade and never has — see `FILE_ASK`, which does
  // not ask. Saying "unread" here would be the pane inventing a gap in a corpus that is
  // complete; the axis is about a body, and a file is not one.
  if (node.kind !== 'func') {
    return (
      <Block label="Legibility">
        <Absent>
          A file is not graded for legibility — the question is what reading one BODY was like,
          and a reader is never handed a file as one. Its functions each carry their own; the
          dial above is their share.
        </Absent>
      </Block>
    )
  }
  if (!report) {
    return (
      <Block label="Legibility">
        <Absent>
          Nobody has read this yet. Legibility is graded by the reader after it opens the body,
          so it arrives with the reading and never without one.
        </Absent>
      </Block>
    )
  }
  const current = legibleOf(report)
  const dated = report.legibleDated === true
  return (
    <Block
      label="Legibility"
      aside={current && !stale ? LEGIBLE_WORDS[current] : undefined}
    >
      {stale && <StaleNote />}
      {dated && (
        <p className="mb-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
          This grade answers a question that has since been rewritten, so it no longer colors
          anything or counts anywhere. It is kept below as history. The axis refills on an
          ordinary re-read — there is no pass that asks this question on its own, because a
          reader that only ever opens the body is a different instrument.
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
          This reading carries no legibility grade — it was banked before the axis existed.
          Absent is no opinion, never a grade.
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
}: {
  node: Node
  report?: AgentReport
  stale: boolean
}) {
  const graded = report && !stale ? report.documented : undefined
  const derivable = report?.derivable === true
  return (
    <Block
      label={node.kind === 'file' ? 'File header' : 'Docs'}
      aside={graded && !derivable ? DOC_WORDS[graded] : derivable ? 'derivable' : undefined}
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
          dated={stale || derivable}
        />
      ) : (
        <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
          Ungraded — nobody has read this, so there is no judgement of whether the words below
          match the code they describe.
        </p>
      )}
      {derivable && (
        <p className="mt-2 rounded-[var(--radius-sm)] border border-[var(--warning)] px-2 py-1.5 text-[11px] leading-snug">
          <span className="font-semibold uppercase tracking-wide text-[var(--warning)]">
            Derivable
          </span>{' '}
          — the reader judged that this says nothing it could not have worked out from the code
          alone, so it counts as <span className="mono">none</span> whatever grade it was
          given. Documentation a model could regenerate from the body explains nothing that was
          not already there.
        </p>
      )}
      <div className="mt-3">
        {node.signature && (
          <pre className="mono mb-2 overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2 py-1 text-[11px] leading-snug">
            {node.signature}
          </pre>
        )}
        {node.doc ? (
          /* The comment verbatim, and NOT as markdown: a `*` down the left margin of a C
             comment is a comment marker, not emphasis, and this is the one thing on the pane
             somebody is meant to read every word of.

             In the same box the neighbour snippets take, for the same reason — a module
             header is regularly longer than the panel is tall. Unhighlighted: tokenized, a
             doc stack is one long comment, italic and muted from top to bottom. */
          <CodeBlock
            code={node.doc}
            title={node.name}
            subtitle={node.kind === 'file' ? `${node.path} — header` : node.path}
            highlight={false}
            height="max-h-[16rem]"
          />
        ) : (
          <Absent>
            Nothing is attached to this. Whatever it does, the next person has to get from the
            body — which is exactly what the reader above it had to do.
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
            The reader answered an earlier version of this question, which has since narrowed.
            A narrowing can only take answers away, so the yes it gave is expired and the axis
            is grey until this is read again — it is not a no.
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
          The scan holds no function at this position — it may have moved since. It comes back
          on the next scan.
        </Absent>
      </Block>
    )
  }

  if (mode === 'clones') {
    if (!related.comparable) {
      return (
        <Block label="Clones">
          <Absent>
            This body is too short to compare. An empty list here says nothing about whether it
            is unique — the floor is there so a repo does not report four thousand three-line
            accessors as copies of each other.
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
          This language's call shape has never been parsed, so nothing was looked for. That is
          not the same as nothing calling it — see the gray on the map.
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
          No grammar claims this extension, so nothing here was parsed. A file with no language
          has no functions to draw and no calls to resolve.
        </Absent>
      ) : (
        <>
          {node.signature && (
            <pre className="mono overflow-x-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] bg-[var(--secondary)] px-2 py-1 text-[11px] leading-snug">
              {node.signature}
            </pre>
          )}
          {gaps.length === 0 ? (
            <p className="mt-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Fully supported: functions, calls, copies and history are all measured for{' '}
              {node.lang} here.
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
  const [detail, setDetail] = useState<RangeDetail | null | 'loading'>('loading')
  const { path, line, endLine } = node
  useEffect(() => {
    if (!repoKey) {
      setDetail(null)
      return
    }
    let live = true
    setDetail('loading')
    // A file blames whole; a function blames its own range. `0` is the whole-file case rather
    // than a second command, because the two questions are the same question at two scopes.
    functionHistory(repoKey, path, line ?? 0, endLine ?? 0)
      .then((d) => {
        if (live) setDetail(d)
      })
      .catch(() => {
        if (live) setDetail(null)
      })
    return () => {
      live = false
    }
  }, [repoKey, path, line, endLine])

  const label = mode === 'blame' ? 'Last commit' : mode === 'churn' ? 'Churn' : 'Lifespan'
  /** The one sentence every section here is read under, on the heading instead of under it.
   *
   *  It was a paragraph, printed twice per pane, and it is a fact about the INSTRUMENT rather
   *  than about the function you clicked. Stated where it can be found and not where it has to
   *  be scrolled past. */
  const HINT =
    'Blame reports the commit that last touched each LINE, so this is where the code as it stands came from — not everyone who has ever worked on it. A function rewritten wholesale reads as new.'

  if (mode === 'churn') {
    return <ChurnSection node={node} repoKey={repoKey} />
  }
  if (detail === 'loading') {
    return (
      <Block label={label}>
        <Absent>Blaming…</Absent>
      </Block>
    )
  }
  if (!detail || detail.lines === 0) {
    return (
      <Block label={label}>
        <Absent>
          Git has nothing for these lines — an untracked file, a repo with no history, or a file
          that has moved since the scan. Churn and Age degrade to "no history" on the map for
          the same reason.
        </Absent>
      </Block>
    )
  }
  if (mode === 'age') {
    return <AgeSection detail={detail} hint={HINT} repoKey={repoKey} />
  }

  const newest = detail.touches[0]
  return (
    <>
      <Block label={label} hint={HINT}>
        {/* The same openable row the lifespan uses. It was its own little layout, which meant
            one of the two places a commit appears on this pane opened and the other did not. */}
        <Touch t={newest} bright repoKey={repoKey} />
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
        aside={`${detail.authors.length} ${detail.authors.length === 1 ? 'person' : 'people'}`}
      >
        {detail.authors.map((a) => (
          <div key={a.author} className="mb-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[11px]" style={{ fontFamily: FAMILY }}>
              {a.author}
            </span>
            <span className="h-[6px] w-[70px] shrink-0 overflow-hidden rounded-[2px] bg-[var(--secondary)]">
              <span
                className="block h-full rounded-[2px]"
                style={{
                  width: `${Math.max(3, (a.lines / detail.lines) * 100)}%`,
                  // Their own slot, which is the colour their wedges are wearing three inches
                  // to the left. Beyond the palette everything is `OTHER`, exactly as on the
                  // ring — an author off the end of the legend is off the end here too.
                  background: slotColor(ranks?.get(a.author) ?? Number.MAX_SAFE_INTEGER),
                }}
              />
            </span>
            <span className="mono w-[54px] shrink-0 text-right text-[10px] tabular-nums text-[var(--muted-foreground)]">
              {a.lines} / {detail.lines}
            </span>
          </div>
        ))}
      </Block>
      <Block label="Where these lines came from" hint={HINT} aside={String(detail.touches.length)}>
        {detail.touches.map((t) => (
          <Touch key={t.commit + t.when} t={t} repoKey={repoKey} />
        ))}
      </Block>
      </>
      )}
    </>
  )
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
 * **Positioned by TIME, not evenly spaced.** Even spacing would draw a function whose three
 * commits were one afternoon four years ago identically to one worked on every year since —
 * the two shapes this is here to tell apart. Newest at the top, because that is the end you
 * are standing at.
 *
 * **The bottom of the timeline is not a birthday, and it says which one it is.** Blame reports
 * the commit that last touched each LINE, so the oldest thing it can see is the oldest
 * SURVIVING line — a lower bound on age, and one a wholesale rewrite resets. The file's own
 * first commit is the honest upper bound and comes free with the scan (`churn::age_of`), so
 * both ends are shown and neither is presented as the answer.
 */
function AgeSection({
  detail,
  hint,
  repoKey,
}: {
  detail: RangeDetail
  hint: string
  repoKey: string | null
}) {
  const newest = detail.touches[0]
  const oldest = detail.touches[detail.touches.length - 1]
  const between = detail.touches.slice(1, -1)

  /** How tall the run between the ends may be, MEASURED rather than guessed.
   *
   *  It was `calc(100vh - 360px)`, and 360 is a guess at everything the pane puts above this:
   *  the name, the path, the dials, the ranks. The path wraps to two lines on a deep directory
   *  and the dials disappear on an unread function, so the guess is wrong by a row in either
   *  direction — which shows up as a scrollbar with empty pane below it, the exact thing the
   *  cap exists to avoid.
   *
   *  Asked of the element instead: its own top, against the window's bottom, less the row that
   *  has to stay under it. `useLayoutEffect` so it is set before the frame is painted rather
   *  than one frame late, which would flash a taller list and then clip it. */
  const mid = useRef<HTMLDivElement>(null)
  const [cap, setCap] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    const fit = () => {
      const el = mid.current
      if (!el) return
      // The OLDEST tag and its row, plus the pane's own bottom padding. A constant, but a
      // small one about a fixed piece of layout directly below — not a guess about a header
      // that changes shape with the node.
      const BELOW = 78
      setCap(Math.max(96, window.innerHeight - el.getBoundingClientRect().top - BELOW))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [between.length, detail.touches.length])
  return (
    <Block label="Lifespan" hint={hint} aside={`${detail.touches.length} commits`}>
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
      {detail.touches.length > 1 && <Edge label="Oldest" t={oldest} repoKey={repoKey} />}
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

type TouchRow = RangeDetail['touches'][number]

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
function Touch({
  t,
  bright,
  repoKey,
}: {
  t: TouchRow
  bright?: boolean
  repoKey: string | null
}) {
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
              numbers. */}
          <span className="mono ml-auto shrink-0 whitespace-nowrap text-[9px] tabular-nums text-[var(--muted-foreground)]">
            {t.lines} <span className="opacity-60">{t.lines === 1 ? 'line' : 'lines'}</span>
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
      </div>
      {open && <CommitCard repoKey={repoKey} sha={t.commit} onClose={() => setOpen(false)} />}
    </div>
  )
}

/** How many weeks of calendar the churn heatmap draws. */
const CHURN_WEEKS = 26
/** The window the map's churn ramp is actually measured over — see `CHURN_WINDOW_DAYS`. */
const CHURN_WINDOW_DAYS = 90

/**
 * Churn as a calendar, because churn is a rate.
 *
 * **A count cannot show you that fourteen commits were one afternoon.** `11 in 90d` is the
 * number the dial and the ramp are built on and it is genuinely ambiguous between a file
 * somebody works on every week and one that was rewritten twice in a fortnight and left alone
 * — which are opposite findings, and the second axis exists to tell brilliance from mess.
 * The shape is the answer, so the shape is what is drawn.
 *
 * **Vertical, and by FILE.** Vertical because the pane is 260px wide and a year across is
 * three pixels a week; by file because that is what the map's churn already measures (see
 * `churn.rs`), and the per-function version follows a moving line range through every diff in
 * the history. The heading says which, rather than letting the reader assume the narrower one.
 *
 * The 90-day window is drawn on it rather than described, because the dial above is measured
 * over exactly that and nothing else on screen says where it ends.
 */
function ChurnSection({ node, repoKey }: { node: Node; repoKey: string | null }) {
  const [stamps, setStamps] = useState<number[] | null | 'loading'>('loading')
  const path = node.path
  useEffect(() => {
    if (!repoKey) {
      setStamps(null)
      return
    }
    let live = true
    setStamps('loading')
    fileCommits(repoKey, path, CHURN_WEEKS * 7)
      .then((s) => {
        if (live) setStamps(s)
      })
      .catch(() => {
        if (live) setStamps(null)
      })
    return () => {
      live = false
    }
  }, [repoKey, path])

  const label = 'Churn'
  if (stamps === 'loading') {
    return (
      <Block label={label}>
        <Absent>Reading the log…</Absent>
      </Block>
    )
  }
  if (!stamps) {
    return (
      <Block label={label}>
        <Absent>
          Git has nothing for this file — untracked, or a repo with no history. Churn has no
          axis at all here, which is not the same as a file nobody has touched.
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
  const inWindow = stamps.filter((t) => (Date.now() / 1000 - t) / 86_400 <= CHURN_WINDOW_DAYS).length
  const CELL = 13
  const GAP = 3

  return (
    <Block
      label={label}
      aside={`${inWindow} in ${CHURN_WINDOW_DAYS}d`}
      hint="Commits touching this FILE, which is what the map's churn ramp measures. A function's own churn would mean following its line range through every diff in the history, which is a different order of cost."
    >
      <p className="mb-2 text-[11px] leading-snug text-[var(--muted-foreground)]">
        Commits to <span className="mono">{node.path.split('/').pop()}</span>, a week per row,
        newest at the top.
      </p>
      <div className="flex gap-2">
        {/* A calendar nobody can orient in is a texture. Two labels do it: the weekday across
            the top, and the month where the rows cross into one — the same two GitHub's
            carries, turned ninety degrees with the grid. */}
        <div className="w-[22px] shrink-0" />
        <div className="flex flex-col" style={{ gap: GAP }}>
          <div className="flex" style={{ gap: GAP }}>
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
          {Array.from({ length: CHURN_WEEKS }, (_, w) => {
            const start = weekStart - w * 7 * DAY
            let week = 0
            for (let d = 0; d < 7; d++) week += counts.get(start + d * DAY) ?? 0
            return (
              <div key={start} className="relative flex" style={{ gap: GAP }}>
                {/* The month, on the row that first falls inside it reading downward — so the
                    label marks where the month BEGINS as the eye travels back through time. */}
                {(w === CHURN_WEEKS - 1 ||
                  new Date(start).getMonth() !== new Date(start - 7 * DAY).getMonth()) && (
                  <span className="absolute right-full mr-2 whitespace-nowrap text-[8px] leading-[13px] text-[var(--muted-foreground)]">
                    {new Date(start).toLocaleDateString(undefined, { month: 'short' })}
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
                        // One ramp, sampled by the day's share of the busiest day — the same
                        // churn ramp the wedge is painted with, so a hot row here and a hot
                        // wedge out there are the same colour by construction.
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
                    only annotation restated the header while the rows themselves, which are
                    the thing being read, said nothing. A count per week is the fact the
                    picture is made of: it turns "a dark cell" into "four commits that week",
                    and blank weeks stay blank, which is what makes a busy one visible. */}
                {week > 0 && (
                  <span className="mono absolute left-full ml-2 whitespace-nowrap text-[9px] leading-[13px] tabular-nums text-[var(--muted-foreground)]">
                    {week}{' '}
                    {/* The unit, said every time it appears. A bare column of numbers beside a
                        grid of squares is a quantity of nothing in particular — the reader has
                        to infer that a row is a week and the number is its commits, and the
                        cost of not making them infer it is one dimmer word. */}
                    <span className="opacity-60">{week === 1 ? 'commit' : 'commits'}</span>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
        {stamps.length === 0
          ? `Nothing has touched this file in ${CHURN_WEEKS} weeks.`
          : `${stamps.length} ${stamps.length === 1 ? 'commit' : 'commits'} in ${CHURN_WEEKS} weeks, busiest day ${peak}.`}
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
