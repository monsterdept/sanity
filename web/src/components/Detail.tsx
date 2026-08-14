import { useEffect, useState } from 'react'
import { Summary } from './Summary'
import { Bloom } from './Bloom'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { elide } from '../lib/text'
import { PAPER } from '../lib/ink'
import { FAMILY } from '../lib/labelStyle'
import { Dials } from './Dials'
import { FunctionRanks } from './Reading'
import type { Population } from '../lib/population'
import {
  isAnalyzed,
  readingWords,
  wedgeHeat,
  type AgentReport,
  type Grade,
  type Node,
  trapOf,
} from '../lib/api'


/**
 * The small slice of markdown an agent actually writes.
 *
 * `code`, **bold**, *italic*, and paragraph breaks — nothing else. Agents write prose
 * with backticked identifiers in it, and rendering that literally put stray backticks
 * through every report; rendering it with a full markdown library would pull in a parser
 * and a sanitiser for a paragraph of text this panel already controls the source of.
 *
 * Split on the code spans FIRST so a `*` inside an identifier can't be read as emphasis.
 */
function Markdown({ text }: { text: string }) {
  const inline = (t: string, key: string) => {
    const out: React.ReactNode[] = []
    // Code first — everything inside a span is literal.
    t.split(/(`[^`]+`)/g).forEach((chunk, i) => {
      if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 1) {
        out.push(
          <code
            key={`${key}-c${i}`}
            // A wash of whatever ink this paragraph is set in, not a fixed gray. The
            // trap note is a solid pink box with its own inherited color, and a
            // `--secondary` chip on it is a swatch of the panel's chrome sitting in the
            // middle of a sentence. Derived from `currentColor`, it is right on every
            // ground this renderer is used on without any of them being told about it.
            className="mono rounded px-1 py-px text-[0.92em]"
            style={{ background: 'color-mix(in oklch, currentColor 15%, transparent)' }}
          >
            {chunk.slice(1, -1)}
          </code>,
        )
        return
      }
      chunk.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((bit, j) => {
        const k = `${key}-${i}-${j}`
        if (bit.startsWith('**') && bit.endsWith('**') && bit.length > 3) {
          out.push(<strong key={k}>{bit.slice(2, -2)}</strong>)
        } else if (bit.startsWith('*') && bit.endsWith('*') && bit.length > 2) {
          out.push(<em key={k}>{bit.slice(1, -1)}</em>)
        } else if (bit) {
          out.push(<span key={k}>{bit}</span>)
        }
      })
    })
    return out
  }

  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((para, i) => (
          <p key={i} className={i > 0 ? 'mt-1.5' : undefined}>
            {inline(para.trim(), String(i))}
          </p>
        ))}
    </>
  )
}

/**
 * Take this paragraph somewhere else.
 *
 * A reading is written to be acted on — pasted into an issue, a commit message, a prompt —
 * and until now the only way to get one out of the panel was to select prose that has
 * `<code>` spans in it and hope the selection came out clean. What goes on the clipboard is
 * the agent's own MARKDOWN, backticks and all, not the rendered text: the destination is
 * usually another markdown box, and the round trip is lossless only if nothing renders it
 * on the way.
 *
 * **"Copied" is only said when the write resolves.** The clipboard can refuse — no secure
 * context, no permission — and a button that flashes success either way is the same lie as
 * a save that reports `Ok` without reading itself back.
 */
function CopyButton({ text, title }: { text: string; title: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1200)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      title={done ? 'Copied' : title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(text).then(
          () => setDone(true),
          () => setDone(false),
        )
      }}
      // Quiet until wanted: it sits in the corner of a box whose whole job is to be read,
      // so it takes the muted ink and comes up to full on hover. It inherits `color` on the
      // trap tab, where the ground is pink and the panel's own foreground would disappear.
      className="ml-auto shrink-0 rounded-[3px] p-0.5 opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M2.5 6.4 4.8 8.8 9.5 3.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect x="1.2" y="1.2" width="6.6" height="6.6" rx="1.2" stroke="currentColor" strokeWidth="1.1" />
          <path d="M4.2 10.8h5.4a1.2 1.2 0 0 0 1.2-1.2V4.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

/** What the list ranks by, per mode — the same quantity the ring is colored by. */
function rank(n: Node, mode: ColorMode): number {
  const s = n.score
  if (!s) return -1
  if (mode === 'churn') return s.ageDays === null ? -1 : s.churn
  // Recent is the bright end of the age ramp, so recent sorts first.
  if (mode === 'age') return s.lastTouchedDays === null ? -1 : -s.lastTouchedDays
  return wedgeHeat(n)
}

/** The one number worth a column, per mode. Units are carried on the value rather than
 *  in a header, because the column is eight characters wide and a header would not fit
 *  the word it needed. */
function measure(n: Node, mode: ColorMode): string | null {
  const s = n.score
  // Blame has no number. An author is a category, not a quantity, and the row's swatch
  // already carries it — a line count beside it answers a question nobody asked here.
  if (mode === 'blame') return null
  if (mode === 'churn') return s && s.ageDays !== null ? `${s.commits}\u00d7` : '\u2014'
  if (mode === 'age') {
    if (!s || s.lastTouchedDays === null) return '\u2014'
    return s.lastTouchedDays < 1 ? 'today' : `${Math.round(s.lastTouchedDays)}d ago`
  }
  // The reading itself, not the line count. Lines were the complement to the swatch —
  // color is surprise, width is lines, the invariant side by side — but it made Surprise
  // and Language render an identical column, so the mode you were in stopped being
  // legible from the list. Every other mode reports its own quantity; this one may as
  // well too, and the swatch is a color you have to decode where a number is not.
  if (mode === 'surprise') {
    if (!s || !isAnalyzed(n)) return '\u2014'
    // A read function says its grade; a model-scored one keeps its degrees, because that
    // number really is continuous. Four rows reading `warm` are honestly tied \u2014 where
    // four rows reading `30\u00b0` looked like four measurements that happened to agree.
    return readingWords(n)?.heat ?? `${Math.round(wedgeHeat(n) * 100)}\u00b0`
  }
  return n.loc.toLocaleString()
}

/** The reader's grade, with pre-grade readings folded to the ends of the scale — the same
 *  fold `Report::grades` does in Rust, so the two cannot disagree about an old reading. */
function grade(r: AgentReport): Grade {
  return r.predicted ?? (r.surprised ? 'none' : 'full')
}

/** Where the numbers above came from, in one sentence. */
function provenance(node: Node, model: string | null): string {
  if (!isAnalyzed(node)) {
    return 'Not read yet'
  }
  const a = node.agent
  if (node.score?.source === 'agent' && a) {
    const who = [a.model, a.by].filter(Boolean).join(' · ')
    return `Read by ${who || 'an agent over MCP'}${a.at ? ` at ${a.at}` : ''}`
  }
  if (node.score?.source === 'agent') return 'Read by an agent over MCP'
  if (node.score?.source === 'model') return `Measured by ${model ?? 'a model'}`
  return `Measured by ${model ?? 'the offline proxy'}`
}

/**
 * What is inside this wedge, as a list you can walk.
 *
 * The map answers "where is the heat" and is bad at "what is actually in here" — a
 * directory of forty files is forty arcs you have to hover one at a time, and the
 * overflow aggregate a big file collapses into had no way to be opened at all. Rows are
 * the same gestures as the ring: click selects, double-click drills in.
 *
 * Ordered by heat, not by size or name. The ring is size-ordered because that keeps its
 * shape recognizable between scans; this list is for reading, and the thing worth reading
 * first is the thing nobody predicted. Unread rows sink to the bottom rather than sorting
 * as cold — gray means "not looked at", which is not the same as "fine".
 */
function Contents({
  node,
  mode,
  ranks,
  ageSpan,
  onSelect,
  onDrill,
}: {
  node: Node
  mode: ColorMode
  ranks?: Map<string, number>
  ageSpan?: number
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  if (node.children.length === 0) return null
  // Ordered and measured by whatever the ring is currently colored by. The list was
  // always sorted by surprise and always trailed a line count, so in Churn mode it sat
  // beside a blue ring ranking things by a quantity the ring was not showing — two
  // answers to one question, in the same panel, disagreeing.
  const rows = [...node.children].sort((a, b) => {
    const seen = (n: Node) => (isAnalyzed(n) ? 1 : 0)
    return seen(b) - seen(a) || rank(b, mode) - rank(a, mode) || b.loc - a.loc
  })
  const label = node.kind === 'dir' ? 'Contents' : 'Functions'

  return (
    /* Full-bleed and re-padded, so the rule reaches both edges of the pane exactly as the
       readings pane's and the history log's do. */
    <div className="-mx-4 mt-4 border-t border-[var(--border)] px-4 pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          {label}
        </p>
        <p className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {rows.length}
        </p>
      </div>
      {rows.map((c) => (
        <button
          key={c.id}
          type="button"
          className="flex w-full items-baseline gap-2 rounded-[var(--radius-sm)] px-1 py-0.5 text-left hover:bg-[var(--secondary)]"
          onClick={() => onSelect?.(c)}
          onDoubleClick={() => onDrill?.(c)}
        >
          <span
            className="h-2 w-2 shrink-0 translate-y-px rounded-[2px]"
            style={{ background: colorFor(c, mode, ranks, ageSpan)?.fill ?? 'var(--unanalyzed)' }}
          />
          <span className="mono flex-1 truncate text-[11px]">{c.name}</span>
          {/* Never shrinks, and the name gives way — this column is the mode's own
              quantity and is the reason to be reading the list at all. */}
          {measure(c, mode) !== null && (
            <span className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
              {measure(c, mode)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Detail({
  node,
  focus,
  title,
  repo,
  commits,
  model,
  mode,
  ranks,
  ageSpan,
  onSelect,
  onDrill,
  owners,
  onShowIn,
  pop,
}: {
  node: Node | null
  /** The subtree the map is showing, for the pane with no selection to describe. */
  focus?: Node | null
  title?: string
  repo?: string | null
  commits?: number
  model: string | null
  mode: ColorMode
  ranks?: Map<string, number>
  /** The repo's age span — see `ageSpanOf`. */
  ageSpan?: number
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
  /** The containers between the repo and this node, outermost first — see `owners` in
   *  `App`. Empty for a node the tree does not hold, which is what makes the plain path
   *  below a fallback rather than dead code. */
  owners?: Node[]
  /** Show the map one of them, keeping this selection. */
  onShowIn?: (n: Node) => void
  /** The repo's own distributions, for placing a function in them. Built once per scan by
   *  `App` — a leaf pane that walked the tree on every selection would do it thousands of
   *  times for one answer that never changes. */
  pop?: Population
}) {
  if (!node) {
    // With nothing selected the pane describes the whole picture instead. The gestures
    // are still not spelled out here — every one of them is already stated on the wedge
    // it applies to, in the hover, at the moment it is useful — but "what does this repo
    // add up to, and what is left to do" has no wedge to be stated on, and this is the
    // one moment there is room for it.
    return focus ? (
      <Summary
        node={focus}
        title={title ?? focus.name}
        repo={repo ?? null}
        commits={commits ?? 0}
        // The pane describes the picture, so it has to know which picture is on screen.
        mode={mode}
        ranks={ranks}
        ageSpan={ageSpan}
        onSelect={onSelect}
        onDrill={onDrill}
      />
    ) : (
      // No scan yet — nothing to summarize, so the pane says nothing rather than showing a
      // frame full of zeroes. It is not blank, though: this is the pane's one idle state,
      // during onboarding and again while a project's first scan runs, and a column of
      // dead space beside a card of instructions reads as something failing to load.
      // Ground, not content — see `Bloom`, which is one static pattern and owns no frame.
      <div className="h-full text-[var(--foreground)] opacity-[0.2]">
        <Bloom className="h-full w-full" />
      </div>
    )
  }

  const s = node.score
  const isLeaf = node.kind === 'func'
  const analyzed = isAnalyzed(node)
  /** The same gate the header badge takes: a stale trap describes a body that has changed,
   *  so it must not color anything, here or on the map. */
  const trapped = trapOf(node.agent) && !node.agentStale

  /** The path is the way back to where the thing IS.
   *
   *  It was static text, and that left the panel able to name a function it could not take
   *  you to: arriving from a list, the wedge is a sliver in a ring of four thousand, and
   *  even outlined it is a sliver. Every segment is the container the map can be drilled
   *  to, so "I found it, now show me it" is one click at whatever level makes it big — the
   *  file, usually. The selection survives the trip; that is `showIn`.
   *
   *  Segments are the tree's NODES, not the path string's pieces, so a collapsed
   *  single-child chain reads as the one node it is (`cli/flox-config`) rather than as two
   *  crumbs one of which goes nowhere. It wraps rather than eliding, and only at
   *  separators: the reason not to wrap was a filename split across two lines, which cannot
   *  happen when the breaks are chosen.
   *
   *  The line number stays plain. It is a position in a file, not a place on the map. */
  const pathLine =
    owners && owners.length > 0 && onShowIn ? (
      <p
        className="mt-0.5 flex flex-wrap items-baseline text-[10px] text-[var(--muted-foreground)]"
        style={{ fontFamily: FAMILY }}
      >
        {owners.map((o, i) => (
          <span key={o.id} className="contents">
            {i > 0 && <span aria-hidden>/</span>}
            <button
              type="button"
              onClick={() => onShowIn(o)}
              title={`Show ${o.name} on the map`}
              className="max-w-[180px] truncate rounded-[3px] px-0.5 hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
            >
              {o.name}
            </button>
          </span>
        ))}
        {node.line !== null && <span>:{node.line}</span>}
      </p>
    ) : (
      <p
        className="mt-0.5 truncate text-[10px] text-[var(--muted-foreground)]"
        style={{ fontFamily: FAMILY }}
      >
        {elide(`${node.path}${node.line !== null ? `:${node.line}` : ''}`, 40)}
      </p>
    )

  /* A selected container is described by the SAME pane the repo is, scoped to it.
     They were two designs for one job: `Summary` for the whole project, and a dial row
     plus a `Contents` list here. But a directory IS a subtree exactly as the root is, and
     the question either pane answers is the same one — what is this made of, under the
     lens I am looking through, and which things are they. So drilling in is a change of
     SUBJECT and not of layout, which is what the header line already claimed to be.
     What a container loses is the list of its immediate children; what it gains is the
     mode's own breakdown and a list that follows it, which is what the map is colored by. */
  /* What a reader made of this container.
     No HEADER block. The file's own banner is the file's own text — one click into the
     source and it is right there at the top, in its own syntax, unwrapped and untruncated.
     Reprinting it here spends the pane's most valuable space on something the reader
     already has, and it is not what this panel is for: everywhere else, this pane shows
     what was MEASURED about a thing, not the thing. The header still reaches the reader as
     context, is still graded, and still colors the wedge under Docs — it is just not
     quoted back at you.

     A directory has no reading of its own, so it gets nothing rather than an empty frame. */
  const about =
    node.kind === 'file' && node.agent ? (
      /* Bounded and scrolled on its own. This block sits in the pane's FIXED header, above
         the breakdown and the list — so a reader that wrote three paragraphs pushed the
         legibility key and every row under it off the bottom of the window, with no
         scrollbar anywhere to say so (the header does not scroll, and the part that does
         was already below the fold). A third of the pane is enough to read a paragraph in
         and leaves the key it is qualifying on screen. */
      <div className="-mx-4 mt-4 max-h-[33vh] space-y-3 overflow-y-auto border-t border-[var(--border)] px-4 pt-3 [overscroll-behavior:contain]">
        {/* The same caveat the function pane prints, for the same reason: everything below
            describes a file whose declarations have since changed. */}
        {node.agentStale && (
          <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
            This file has changed since it was read, so the reading below no longer colors
            it.
          </p>
        )}
        <div>
          <div className="mb-0.5 flex items-center gap-2 text-[var(--muted-foreground)]">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Expected</p>
            <CopyButton text={node.agent.expected} title="Copy what the reader expected" />
          </div>
          <div className="text-xs leading-relaxed">
            <Markdown text={node.agent.expected} />
          </div>
        </div>
        <div>
          <div className="mb-0.5 flex items-center gap-2 text-[var(--muted-foreground)]">
            <p className="text-[10px] font-semibold uppercase tracking-wide">Found</p>
            <CopyButton text={node.agent.found} title="Copy what the reader found" />
          </div>
          <div className="text-xs leading-relaxed">
            <Markdown text={node.agent.found} />
          </div>
        </div>
      </div>
    ) : null

  if (!isLeaf) {
    return (
      <Summary
        node={node}
        title={node.name}
        repo={null}
        // The repo header's third figure. A directory has no commit count of its own —
        // `score.commits` is the 90-day churn window, and printing it under the same word
        // the repo line uses for all of history would have a folder read "0 commits"
        // because nobody touched it this quarter. The churn dial states that window on a
        // scale that admits what it is.
        commits={0}
        mode={mode}
        ranks={ranks}
        ageSpan={ageSpan}
        onSelect={onSelect}
        onDrill={onDrill}
        path={pathLine}
        footer={provenance(node, model)}
        about={about}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* What the panel is ABOUT stays on screen while you read down it. Which wedge
          this is, and its two numbers, are the things every row below is qualifying —
          scrolled away, the expected/found prose underneath is a paragraph about an
          unnamed function with no reading attached.

          A flex sibling of the scroller, NOT `sticky` inside it. Sticky pins against
          the scroll position but the element is still in the scrolling box, so overscroll
          rubber-banding carried the header with it — the pinned block bounced away from
          the top edge and left a gap of panel behind it. Outside the box it cannot move,
          and the bounce happens under it where it belongs. */}
      {/* `px-4 pt-4` and no bottom border, which is the readings pane's header and the
          history pane's to the pixel. The three are one column under three subjects, and the
          rule below the header belongs to the section it introduces — drawn here as well it
          put two dividers a dozen pixels apart. */}
      <div className="shrink-0 px-4 pt-4">
      {/* No bottom margin: the path's own `mt-0.5` is the whole gap, which pulls the name and
          the thing it names into one block and leaves the `mt-2` above the counts as the only
          real break in the header. Two groups, not three lines — the same spacing the repo and
          history headers get, where a name and its path were never further apart than a path
          and its totals. */}
      <div className="flex items-center gap-2">
        {/* No swatch. It was the wedge's own color repeated beside its name, and the dial
            directly under it already says that — in words, on the scale the reading actually
            has. Two encodings of one number, the smaller of which cannot be read. */}
        {/* The label face, not the monospace one — see `FAMILY`. A name is a NAME here, the
            same one the wedge is wearing three inches to the left, and setting it in the
            code face made the panel read as a listing of source rather than as a caption on
            the picture. Monospace stays where alignment is doing work: line counts, hashes,
            the code view. */}
        <h2 className="truncate text-sm font-semibold" style={{ fontFamily: FAMILY }}>
          {node.name}
        </h2>
        {/* No kind badge. `FILE` and `DIRECTORY` beside the name said what the name and
            the path under it already say — `history.rs` under `src-tauri / src` is not
            something anyone mistakes for a directory — and it took the eye first, being the
            only outlined thing in the header. The distinction it defended is real for
            FUNCTIONS, and those are told apart by what the pane holds: a function's panel
            has a reading and prose in it, a container's has a breakdown and a list. */}
        {/* In the header, not among the dials.
            A trap is the one thing here that is not a measurement on a scale — it is a
            warning about this specific function, and it was reachable only by finding the
            same function again in the notes list. Beside the name is where it is unmissable,
            and it is the same badge the list uses so the two read as one fact. */}
        {trapped && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--trap)', color: 'var(--card)' }}
            title="A reader said something here will bite whoever edits it next."
          >
            trap
          </span>
        )}
      </div>
      {pathLine}
      {/* No lines-alone line here: the count is a member of a distribution and is printed as
          one, in `FunctionRanks`, where `153` sits beside what it is long or short against. */}

      {/* The dials ride WITH the header, above the verdict rather than below it. They were
          under the verdict box, which put the panel's only measurements three paragraphs down
          and off the bottom of a short pane — the verdict is a reading OF them, so it cannot
          come first. Same row every other pane opens with; see `Dials`, and see `Reading` for
          why the leaf keeps it rather than a grade table of its own. */}
      <Dials node={node} />
      {/* The rule under the header belongs to the header, not to the dials — but it is
          drawn by `Dials`, which returns nothing for an unread function, so an unread pane
          ran its name straight into the counts while every read one had a divider there.
          Full-bleed (`-mx-4`) to match, and only when the dials are absent, or the two
          would land a dozen pixels apart. */}
      {!analyzed && <div className="-mx-4 mt-4 border-t border-[var(--border)]" />}
      <FunctionRanks node={node} pop={pop} />
      </div>

      {/* `min-h-0` because a flex child's default `min-height:auto` refuses to shrink
          below its content, which would push the pane's own height past the window and
          scroll the shell instead of this. `contain` keeps a flick at either end from
          chaining out to whatever is behind the panel. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
      {!s ? (
        <p className="text-xs text-[var(--muted-foreground)]">Not scored.</p>
      ) : !analyzed ? (
        /* Say what gray means rather than showing proxy numbers under a gray swatch —
           the numbers exist, but presenting them here is how a proxy reading gets
           mistaken for a finding. */
        /* Sent to the reader that can actually act, and no longer to a menu that does
           not exist. This said "enable a model under Model…" — a live instruction to
           use the Ollama path, which was removed endpoint and all, so the one panel a
           person reaches by clicking any gray wedge told them to do something
           impossible. Readings come from agents over MCP now, and the only thing that
           produces one here is a reader being pointed at this repo. */
        /* The same rule the reading sits under when there IS one, so the unread pane has
           the shape of the read one with the reading missing, rather than a paragraph
           left floating against the dials. */
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
          This has not yet been analyzed. Readings come from an agent working through the
          repo over MCP. Point one at this project and it will fill in.
        </p>
      ) : (
        <>

          {node.agent && (
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
              {/* No section heading. "What an agent made of it" was a label for two
                  labeled things — the rows already say who is speaking, and the heading
                  only pushed them down the panel. The warm-read caveat moves onto the
                  block it qualifies. */}
              {/* Before the reading, not after it. Everything below this is a claim
                  about a body that is no longer in the file, and a caveat printed under
                  the claim it qualifies is a caveat half the readers never reach. */}
              {node.agentStale && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--warning)] px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]">
                    Stale reading
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
                    This code has changed since it was read
                    {node.agent.at && (
                      <>
                        {' at '}
                        <span className="mono">{node.agent.at}</span>
                      </>
                    )}
                    , so it no longer colors this wedge — the number above is the offline
                    proxy again. Kept below because what a reader expected last time is
                    still worth knowing. Ask an agent to update the assessment and it will
                    re-read this one first.
                  </p>
                </div>
              )}

              {/* No card for a grade that answered a question we have since rewritten.
                  It explained, at the length of the stale block above it, a distinction the
                  panel no longer draws anywhere else: `legibleOf` returns nothing for a
                  dated grade, so the dial reads gray and the lens, the breakdown and the
                  spread have already left it out. A paragraph is the wrong weight for
                  "there is no reading here" — the gray dial says it, and this said it again
                  in six lines about the app's own history. */}

              {!node.agent.cold && (
                <p
                  className="inline-flex rounded-full border border-[var(--warning)] px-1.5 py-px text-[9px] uppercase tracking-wide text-[var(--warning)]"
                  title="The agent had already read this file, so it recalled rather than predicted."
                >
                  warm read
                </p>
              )}

              {/* Each on its own line with the label above it. Inline labels made two
                  paragraphs of prose read as one run-on — and Expected is shown even when
                  the agent got it right, because "expected X, found X" is the evidence
                  that a wedge is genuinely boring. */}
              {/* The copy button rides in the heading rather than floating over the corner
                  of the prose. Absolutely positioned it would sit on top of the first line
                  of text at exactly the width where the pane is narrowest; the heading row
                  is already there, already the full width, and already the thing that says
                  which paragraph this is. */}
              <div>
                <div className="mb-0.5 flex items-center gap-2 text-[var(--muted-foreground)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide">Expected</p>
                  <CopyButton text={node.agent.expected} title="Copy what the reader expected" />
                </div>
                <div className="text-xs leading-relaxed">
                  <Markdown text={node.agent.expected} />
                </div>
              </div>
              <div>
                <div className="mb-0.5 flex items-center gap-2 text-[var(--muted-foreground)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide">Found</p>
                  <CopyButton text={node.agent.found} title="Copy what the reader found" />
                </div>
                <div className="text-xs leading-relaxed">
                  <Markdown text={node.agent.found} />
                </div>
              </div>

              {/* Shown whenever there IS one, not only when a legacy flag says so. Both
                  this and the line below used to key off `surprised`, which agents stopped
                  sending when `predicted` replaced it — it defaults to false, so every
                  reading claimed to be unsurprising and this note, the one sentence a
                  human can act on, never rendered at all. A note exists because the reader
                  chose to write one; that is the condition. */}
              {node.agent.note && (
                /* The takeaway, marked as one. It reads as a quote of the paragraph above
                   it otherwise — the mark on the left is what says "this is the bit that
                   matters", and it is the same warning color the warm-read caveat uses so
                   the panel has one vocabulary for "pay attention here".

                   **A trap's note is pink, because the note IS the trap.** `trap` is a
                   boolean; the note is the only thing that says what will bite you, so the
                   badge in the header should not announce one and then hand you to a
                   paragraph in the same neutral gray every other reading gets.

                   The color goes on the TAB and nowhere else. Filling the box was tried and
                   it is wrong twice over: `--trap` is set to be the loudest thing on the map
                   and a ground for prose is the one job it is not for, and reversing a
                   paragraph out of it makes the note harder to read the more it matters. */
                <div className="overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)]">
                  {/* One box, one mark, and exactly one thing that changes: the tab across
                      the top goes pink. Same glyph, same word position, same border, same
                      ground, same prose — so the difference reads as this note being flagged
                      rather than as a different kind of note.

                      LABELED, because a color is not a word. The pink says "this one" and
                      the ⚠ says "careful", and neither says which of the two things this
                      panel can put in a box you are looking at; the reader would have to have
                      seen the other kind to know this is the other kind.

                      No `--warning` amber. Amber was the app's color for "pay attention"
                      before traps had one; now they do, and a second alert color beside it
                      means the panel says "careful" in two vocabularies that do not agree.
                      Paper on the pink tab, `--foreground` off it — which is Ink on the light
                      ground and follows the theme on the dark one, where a literal black
                      would vanish. Paper is a literal because the tab's ground is `--trap` in
                      both themes, which is the same argument `ink.ts` makes for its pair. */}
                  <div
                    className="flex items-center gap-1.5 px-2 py-1"
                    style={
                      trapped
                        ? { background: 'var(--trap)', color: PAPER }
                        : { color: 'var(--foreground)' }
                    }
                  >
                    <span aria-hidden className="text-[11px] leading-none">
                      ⚠
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.08em] leading-none">
                      {trapped ? 'trap' : 'note'}
                    </span>
                    <CopyButton
                      text={node.agent.note}
                      title={trapped ? 'Copy this trap' : 'Copy this note'}
                    />
                  </div>
                  <div className="px-2 pb-1.5 pt-1 text-[11px] leading-snug">
                    <Markdown text={node.agent.note} />
                  </div>
                </div>
              )}
              {/* Only when the reader actually called it, and only when it has nothing
                  else to say. `full` is "nothing in the body I missed"; anything less had
                  a gap worth leaving unclaimed. */}
              {!node.agent.note && grade(node.agent) === 'full' && (
                <p className="text-[11px] italic text-[var(--muted-foreground)]">
                  Read as expected — nothing here would trip someone up.
                </p>
              )}

            </div>
          )}

          {node.hotspots.length > 0 && (
            <div className="mt-4 border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                The evidence
              </p>
              {/* Measurement, not prose. Each row is a position where the model's
                  probability for the real token collapsed, and what it would have
                  written instead — so this cannot be confidently wrong the way a
                  generated explanation can. */}
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

          {/* The proxy caveat used to be repeated here, guarded on `!analyzed` — inside the
              branch the ternary above only reaches when `analyzed` is TRUE, so it had never
              rendered for anybody. The pinned footer states which instrument produced these
              numbers on every node, which is where that belongs: it is a fact about the whole
              panel, not a paragraph at the end of one section. Two readers found this
              independently in one pass, which is the metric doing its job. */}
        </>
      )}

      <Contents
        node={node}
        mode={mode}
        ranks={ranks}
        ageSpan={ageSpan}
        onSelect={onSelect}
        onDrill={onDrill}
      />
      </div>

      {/* Pinned to the bottom, a flex sibling of the scroller rather than the last thing
          inside it. Who produced these numbers is the one line that should not require
          scrolling past a hundred and fifty functions to reach — and a footer that moves
          with the list is not a footer, it is the end of the list. */}
      <p className="shrink-0 border-t border-[var(--border)] px-4 py-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
        {provenance(node, model)}
      </p>
    </div>
  )
}
