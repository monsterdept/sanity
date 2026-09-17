import { memo } from 'react'
import { Summary } from './Summary'
import { Bloom } from './Bloom'
import { ageOf, colorFor, paintsFromReadings, VIEWS_DEFAULT, type Views, type ColorMode } from '../lib/colorMode'
import { READ_CEILING, unreadable } from '../lib/api'
import { elide } from '../lib/text'
import { FAMILY } from '../lib/labelStyle'
import { LensPane } from './LensPane'
import { Counts } from './Counts'
import { isAnalyzed, readingWords, wedgeHeat, type Node, trapOf } from '../lib/api'

/** What the list ranks by, per mode — the same quantity the ring is colored by. */
function rank(n: Node, mode: ColorMode, views: Views): number {
  const s = n.score
  if (!s) return -1
  // The gate `colorFor` uses, which moved off `ageDays` when Age started painting it — and
  // the WINDOW the map is painted at, or this list ranks by a horizon nobody is looking at.
  if (mode === 'churn')
    return s.lastTouchedDays === null ? -1 : s.churn[views.churn.at]
  // Recent is the bright end of the age ramp, so recent sorts first — under WHICHEVER date
  // the map is painted in, or the list opens on a different row from the one the eye is on.
  if (mode === 'age') {
    const d = ageOf(s, views.age.read)
    return d === null ? -1 : -d
  }
  // Both wiring lenses rank by their own bright end, so the list opens on what the map is
  // shouting about: the unreferenced first, and the most far-flung first.
  if (mode === 'callers') return n.callers == null ? -1 : 1 / (1 + n.callers)
  if (mode === 'reach') return n.calls == null ? -1 : n.calls
  // Biggest group first, so the list opens on the body somebody wrote fourteen times rather
  // than on the first pair in path order.
  if (mode === 'clones') return n.cloneSize ?? -1
  return wedgeHeat(n)
}

/** The one number worth a column, per mode. Units are carried on the value rather than
 *  in a header, because the column is eight characters wide and a header would not fit
 *  the word it needed. */
function measure(n: Node, mode: ColorMode, views: Views): string | null {
  const s = n.score
  // Blame has no number. An author is a category, not a quantity, and the row's swatch
  // already carries it — a line count beside it answers a question nobody asked here.
  if (mode === 'blame') return null
  if (mode === 'churn')
    return s && s.lastTouchedDays !== null ? `${s.commits[views.churn.at]}\u00d7` : '\u2014'
  if (mode === 'callers') return n.callers == null ? '\u2014' : `${n.callers}\u00d7`
  if (mode === 'reach') return n.calls == null ? '\u2014' : `\u2192${n.calls}`
  if (mode === 'clones') {
    if (n.comparable == null) return '\u2014'
    return n.cloneSize == null ? '1\u00d7' : `${n.cloneSize}\u00d7`
  }
  if (mode === 'age') {
    const d = s ? ageOf(s, views.age.read) : null
    if (d === null) return '\u2014'
    return d < 1 ? 'today' : `${Math.round(d)}d ago`
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
    return readingWords(n)?.predicted ?? `${Math.round(wedgeHeat(n) * 100)}\u00b0`
  }
  return n.loc.toLocaleString()
}

/** Where the numbers above came from, in one sentence. */
function provenance(node: Node, model: string | null): string {
  // Asked before `Unread`, which would be true and would be the wrong sentence: this
  // one is not waiting its turn in a queue it will never be in. Naming the size and the
  // limit rather than just refusing, because the next question is always "how far over" and
  // the answer decides whether this is a god-function worth splitting or a generated file
  // worth a `.sanityignore` line. See `unreadable`.
  if (unreadable(node)) {
    const kb = Math.round((node.bytes ?? 0) / 1024)
    return `Too large to read — ${kb}KB, past the ${Math.round(READ_CEILING / 1024)}KB a reader is asked to hold. No reading will be taken.`
  }
  if (!isAnalyzed(node)) {
    return 'Unread'
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
 * The same sentence, in the three pieces it has to break into to stay on ONE line.
 *
 * **A footer that wraps is not a footer.** `Read by claude-sonnet-5 · ross@rossturk.com at
 * 3e9155b` runs to two lines in a 260px pane, which pushes the pane's own bottom edge around
 * as you move between functions — and it was the second line, the commit, that fell off the
 * shape of the panel.
 *
 * **The address is dropped rather than truncated.** Squeezed into what was left it came out as
 * `ross@rosstur…`, which is a string that identifies nobody: an address is useful whole or not
 * at all, and half of one reads as a rendering fault. What the line is FOR is which model
 * produced the numbers and which commit they were taken at, so those are what stays, and the
 * model name is the piece that gives way if even that will not fit.
 *
 * The address is still on the `title`, because `provenance` is unchanged and that is where the
 * whole sentence goes. Derived from it rather than written beside it: two spellings of one
 * sentence is how a tooltip and the text under it come to disagree.
 */
function provenancePieces(node: Node, model: string | null): [string, string, string] {
  const full = provenance(node, model)
  const a = node.agent
  // Only the agent sentence has parts worth separating; everything else is one short clause
  // that fits. Spaces are the container's `gap`, never literal: a trailing space inside an
  // inline element collapses, which drew `claude-sonnet-5 ·ross@…` with the gap on the wrong
  // side of the dot.
  if (node.score?.source !== 'agent' || !a?.model) return [full, '', '']
  return ['Read by', a.model, a.at ? `at ${a.at}` : '']
}

/** Who produced these numbers, on one line whatever their names are — see `provenancePieces`. */
function Provenance({ node, model }: { node: Node; model: string | null }) {
  const [lead, who, tail] = provenancePieces(node, model)
  return (
    <p
      className="flex shrink-0 items-baseline gap-1 whitespace-nowrap border-t border-[var(--border)] px-4 py-2 text-[10px] leading-snug text-[var(--muted-foreground)]"
      title={provenance(node, model)}
    >
      {/* `Read by` and the commit hold their width; the model name is the one that gives way,
          because it is the only part with no bound on its length. */}
      <span className="shrink-0">{lead}</span>
      {who && <span className="min-w-0 truncate">{who}</span>}
      {tail && <span className="shrink-0">{tail}</span>}
    </p>
  )
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
  views,
  onSelect,
  onDrill,
}: {
  node: Node
  mode: ColorMode
  ranks?: Map<string, number>
  views?: Views
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  if (node.children.length === 0) return null
  // The reading the map is painted in, or this list ranks and reports a different date from
  // the wedges it sits beside — see `AgeView`.
  const read = views ?? VIEWS_DEFAULT
  // Ordered and measured by whatever the ring is currently colored by. The list was
  // always sorted by surprise and always trailed a line count, so in Churn mode it sat
  // beside a blue ring ranking things by a quantity the ring was not showing — two
  // answers to one question, in the same panel, disagreeing.
  const rows = [...node.children].sort((a, b) => {
    const seen = (n: Node) => (isAnalyzed(n) ? 1 : 0)
    return seen(b) - seen(a) || rank(b, mode, read) - rank(a, mode, read) || b.loc - a.loc
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
            style={{ background: colorFor(c, mode, ranks, views)?.fill ?? 'var(--unanalyzed)' }}
          />
          <span className="mono flex-1 truncate text-[11px]">{c.name}</span>
          {/* Never shrinks, and the name gives way — this column is the mode's own
              quantity and is the reason to be reading the list at all. */}
          {measure(c, mode, read) !== null && (
            <span className="mono shrink-0 text-[10px] tabular-nums text-[var(--muted-foreground)]">
              {measure(c, mode, read)}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function DetailView({
  node,
  focus,
  title,
  repo,
  model,
  mode,
  ranks,
  views,
  tangleBands,
  tangleOver,
  onSelect,
  onDrill,
  owners,
  onShowIn,
  repoKey,
  replaying,
  onJump,
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
  /** How Age is calibrated and which of its two dates it paints — see `AgeView`. */
  views?: Views
  /** What a normal cognitive score is for a body of each size IN THIS REPO — see
   *  `tangle::Bands`. The Complexity section shows its work against these, and "17 is normal
   *  for a body this size here" is the half of that work a person can go and check. */
  tangleBands?: (number | null)[]
  /** What each band's median was measured over — see `Stats.tangleOver`. The Complexity
   *  section names that population, and after a fold it is not the band's own edges. */
  tangleOver?: ([number, number] | null)[]
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
  /** The containers between the repo and this node, outermost first — see `owners` in
   *  `App`. Empty for a node the tree does not hold, which is what makes the plain path
   *  below a fallback rather than dead code. */
  owners?: Node[]
  /** Show the map one of them, keeping this selection. */
  onShowIn?: (n: Node) => void
  /** Which project this node belongs to. The lens sections that fetch — neighbours, blame —
   *  are routed by key rather than by whatever is active, on the same rule the MCP endpoints
   *  follow: a pane must not be able to answer with another repo's answer. */
  repoKey?: string | null
  /** Is the map showing a past commit? The lens sections all measure the working tree, and a
   *  replayed wedge is a body from another one — see `LensPane`. */
  replaying?: boolean
  /** Show the function at this position, wherever it is. What every `→` in the lens sections
   *  spends — see `jumpTo` in `hooks/useNavigation.ts`, which has to fetch the file's ring before it can select
   *  anything inside it. */
  onJump?: (path: string, line: number) => void
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
        // The pane describes the picture, so it has to know which picture is on screen.
        mode={mode}
        ranks={ranks}
        views={views}
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
  /** The other functions in this one's file, when the window is holding them.
   *
   *  Off the tree rather than fetched: `owners` is walked from the root, so its last entry is
   *  the file, and its children are the ring the map has already asked for. Absent where the
   *  ring has not arrived, which the section that spends it treats as "nobody looked" rather
   *  than as "there are none". */
  const siblings =
    owners && owners.length > 0 && owners[owners.length - 1].kind === 'file'
      ? owners[owners.length - 1].children
      : undefined
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
        // `-ml-0.5` cancels the first crumb's own padding. Every segment is a button and
        // carries `px-0.5` so its hover background clears the text — which left the whole
        // line sitting two pixels right of the name above it and the counts below it, a
        // misalignment small enough to read as a mistake rather than as an indent.
        className="-ml-0.5 mt-0.5 flex flex-wrap items-baseline text-[10px] text-[var(--muted-foreground)]"
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
     They were two designs for one job: `Summary` for the whole project, and a row of
     dials plus a `Contents` list here. But a directory IS a subtree exactly as the root is, and
     the question either pane answers is the same one — what is this made of, under the
     lens I am looking through, and which things are they. So drilling in is a change of
     SUBJECT and not of layout, which is what the header line already claimed to be.
     What a container loses is the list of its immediate children; what it gains is the
     mode's own breakdown and a list that follows it, which is what the map is colored by. */
  /* What this file says about ITSELF, under whatever lens is on.
     It was the file's reading and only ever the file's reading — Expected and Found, printed
     under Blame and under Clones like everywhere else. A file carries most of the same
     answers a function does: its own reading, its module header, its trap, and a whole-file
     blame. So it takes the same section the leaf pane takes, scoped to it.

     No HEADER block of its own any more. It never had one — the argument was that a file's
     banner is one click away in its own syntax and this pane shows what was MEASURED rather
     than the thing. That still holds under ten lenses, and is exactly backwards under the
     eleventh: Docs grades the header against the body, and a pane that prints the grade
     without the text being graded is showing half of what the reader was handed. So the
     header appears under Docs and nowhere else, which is where it answers something.

     Bounded and scrolled on its own. This block sits in the pane's FIXED header, above the
     breakdown and the list — so a reader that wrote three paragraphs pushed the legibility
     key and every row under it off the bottom of the window, with no scrollbar anywhere to
     say so. A third of the pane is enough to read a paragraph in and leaves the key it is
     qualifying on screen.

     A directory has no reading of its own and no lines to blame, so it gets nothing rather
     than an empty frame. */
  const about =
    node.kind === 'file' ? (
      /* No rule and no top margin of its own: every `Block` inside brings both, and drawn
         here as well they landed a dozen pixels apart. */
      <div className="-mx-4 max-h-[33vh] overflow-y-auto px-4 [overscroll-behavior:contain]">
        <LensPane
          node={node}
          mode={mode}
          repoKey={repoKey ?? null}
          replaying={replaying}
          ranks={ranks}
          views={views}
          tangleBands={tangleBands}
          tangleOver={tangleOver}
          onJump={onJump}
          onOpen={onDrill}
        />
      </div>
    ) : null

  if (!isLeaf) {
    return (
      <Summary
        node={node}
        title={node.name}
        repo={null}
        mode={mode}
        ranks={ranks}
        views={views}
        onSelect={onSelect}
        onDrill={onDrill}
        path={pathLine}
        footer={paintsFromReadings(mode) ? provenance(node, model) : undefined}
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
      {/* **The rule under the header belongs to the header, because the header is the part
          that stays.** It lived on the first section instead, which is inside the scroller —
          so the moment anybody scrolled a lens with more than a pane's worth in it, the line
          between what this pane is ABOUT and what it says went up with the content and the
          two ran together. `Block` drops its own top border when it is first (`first:`), so
          there is still exactly one line there and it is now the one that cannot move. */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 pb-3 pt-4">
        {/* No bottom margin: the path's own `mt-0.5` is the whole gap, which pulls the name and
          the thing it names into one block and leaves the `mt-2` above the counts as the only
          real break in the header. Two groups, not three lines — the same spacing the repo and
          history headers get, where a name and its path were never further apart than a path
          and its totals. */}
        <div className="flex items-center gap-2">
          {/* No swatch. It was the wedge's own color repeated beside its name, and the lens
            section below already says that — in words, on the scale the reading actually
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
          {/* In the header, beside the name.
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
        {/* The same line every other pane opens with, minus the one figure a function cannot
          have — see `Counts`.

          **It replaced a rank row rather than joining one.** `FunctionRanks` printed these
          same two numbers with a percentile rail beside each — `47 lines … 85th`, `traces to
          4 commits … 90th` — on the argument that a length only means something against the
          code it sits in. True, and it bought a rail: two facts became four, in a header,
          about a function whose actual reading is one scroll below. The counts are what the
          header is for; where this one sits in the repo's distribution is a question the map
          answers by drawing it. */}
        <Counts node={node} />
      </div>

      {/* `min-h-0` because a flex child's default `min-height:auto` refuses to shrink
          below its content, which would push the pane's own height past the window and
          scroll the shell instead of this. `contain` keeps a flick at either end from
          chaining out to whatever is behind the panel. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
        {/* **One section, and it follows the tabs.** Everything above this qualifies every
          lens; this is the pane's answer to the one the map is under — see `LensPane`, which
          holds all eleven and the argument for each.

          There is no `analyzed` gate on it any more. It used to be the whole scroller, and
          the whole scroller was the surprise reading, so clicking a gray wedge under Blame
          got you "this has not yet been analyzed" — true about a reading nobody had asked
          for, and beside the point under a lens that reads git. Each section says what its
          own absence is; that is the rule they are all written to. */}
        {!s ? (
          <p className="pt-3 text-xs text-[var(--muted-foreground)]">Not scored.</p>
        ) : (
          <LensPane
            node={node}
            mode={mode}
            repoKey={repoKey ?? null}
            replaying={replaying}
            siblings={siblings}
            ranks={ranks}
            views={views}
            tangleBands={tangleBands}
            tangleOver={tangleOver}
            onJump={onJump}
            onOpen={onDrill}
          />
        )}

        <Contents
          node={node}
          mode={mode}
          ranks={ranks}
          views={views}
          onSelect={onSelect}
          onDrill={onDrill}
        />
      </div>

      {/* Pinned to the bottom, a flex sibling of the scroller rather than the last thing
          inside it. What it says depends on the lens: who produced these numbers, where the
          numbers came from a reader, and otherwise whatever the section put here — see
          `lensFooter`. A footer that moves with the list is not a footer, it is the end of
          the list. */}
      {paintsFromReadings(mode) && <Provenance node={node} model={model} />}
    </div>
  )
}

/** **Memoised, because most of what re-renders the app is not about this pane.** The window
 *  polls: the project list every 1.5 seconds, the readings every two, and during a reading
 *  pass the counters on those rows move constantly — so the app re-rendered several times a
 *  minute at rest and continuously during a read, and the panel, being the app's own child,
 *  rebuilt itself every time to draw exactly what it was already drawing. It has a scroller,
 *  a tiling of code blocks and a timeline in it; a wedge gaining a reading is a reason to
 *  redraw it and a sidebar count ticking is not. Same guard `Sunburst` takes, for the same
 *  reason — everything it is handed either is a primitive or is memoised upstream. */
export const Detail = memo(DetailView)
