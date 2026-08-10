import { Summary } from './Summary'
import { Bloom } from './Bloom'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { elide } from '../lib/text'
import { clsx } from '../lib/cn'
import {
  GRADE_SURPRISE,
  LEGIBLE_WORDS,
  heatColor,
  isAnalyzed,
  readingWords,
  temperature,
  paintHeat,
  wedgeHeat,
  type AgentReport,
  type Grade,
  type Node,
} from '../lib/api'


/**
 * One reading, as a dial.
 *
 * Three of these side by side, where there were four stacked bars. A bar is a length, and
 * three lengths in a column invite the eye to compare them — but these three measure
 * different things on different scales, so comparing them is exactly the reading nobody
 * should take. A dial reads as its own instrument: you take each one on its own terms,
 * which is what they are.
 *
 * Fixed 180°, and the value spelled out in the middle. The arc is for the glance — is
 * this near the top or the bottom — and the number is there because a glance at an arc is
 * not a measurement and this panel is where you come when the map was not enough.
 */
function Gauge({
  label,
  value,
  hint,
  unread,
  word,
}: {
  label: string
  value: number
  hint: string
  /** No value to show — draw the track and say so, rather than a needle at zero, which
   *  claims a reading of nought where there is no reading at all. */
  unread?: boolean
  /** Say it in words instead of digits, for a reading that has four steps and no more.
   *
   *  The arc stays: it is the glance, and it wants the uneven spacing that makes `cold`
   *  and `warm` sit close together. It is the printed number that was the problem —
   *  `62` reads as a measurement to one part in a hundred, and four wedges at `30` look
   *  like four measurements agreeing rather than one grade repeated. */
  word?: string | null
}) {
  const R = 40
  const LEN = Math.PI * R
  const v = Math.max(0, Math.min(1, value))
  const arc = `M ${50 - R} 50 A ${R} ${R} 0 0 1 ${50 + R} 50`
  return (
    <div className="flex min-w-0 flex-col items-center" title={hint}>
      <svg viewBox="0 0 100 58" className="w-full overflow-visible">
        <path d={arc} fill="none" stroke="var(--secondary)" strokeWidth={7} strokeLinecap="round" />
        {!unread && (
          <path
            d={arc}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={7}
            // Butt at zero: a round cap on an empty arc draws a dot, which reads as a
            // small value rather than none.
            strokeLinecap={v > 0.01 ? 'round' : 'butt'}
            strokeDasharray={`${LEN * v} ${LEN}`}
          />
        )}
        <text
          x={50}
          y={48}
          textAnchor="middle"
          className="mono"
          fontSize={word ? 15 : 22}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {unread ? '—' : (word ?? Math.round(v * 100))}
        </text>
      </svg>
      <span className="mt-0.5 cursor-help text-center text-[9.5px] font-semibold uppercase leading-tight tracking-wide text-[var(--muted-foreground)]">
        {label}
      </span>
    </div>
  )
}

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
            className="mono rounded bg-[var(--secondary)] px-1 py-px text-[0.92em]"
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

const KIND_LABEL: Record<Node['kind'], string> = {
  dir: 'directory',
  file: 'file',
  func: 'function',
}

/** What the list ranks by, per mode — the same quantity the ring is coloured by. */
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
  // colour is surprise, width is lines, the invariant side by side — but it made Surprise
  // and Language render an identical column, so the mode you were in stopped being
  // legible from the list. Every other mode reports its own quantity; this one may as
  // well too, and the swatch is a colour you have to decode where a number is not.
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
    return 'Not read yet — the colour is the offline proxy, which measurably tracks file length more than surprise.'
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
 * shape recognisable between scans; this list is for reading, and the thing worth reading
 * first is the thing nobody predicted. Unread rows sink to the bottom rather than sorting
 * as cold — grey means "not looked at", which is not the same as "fine".
 */
function Contents({
  node,
  mode,
  ranks,
  onSelect,
  onDrill,
}: {
  node: Node
  mode: ColorMode
  ranks?: Map<string, number>
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  if (node.children.length === 0) return null
  // Ordered and measured by whatever the ring is currently coloured by. The list was
  // always sorted by surprise and always trailed a line count, so in Churn mode it sat
  // beside a blue ring ranking things by a quantity the ring was not showing — two
  // answers to one question, in the same panel, disagreeing.
  const rows = [...node.children].sort((a, b) => {
    const seen = (n: Node) => (isAnalyzed(n) ? 1 : 0)
    return seen(b) - seen(a) || rank(b, mode) - rank(a, mode) || b.loc - a.loc
  })
  const label = node.kind === 'dir' ? 'Contents' : 'Functions'

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
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
            style={{ background: colorFor(c, mode, ranks)?.fill ?? 'var(--unanalyzed)' }}
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
  onSelect,
  onDrill,
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
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
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
        onSelect={onSelect}
        onDrill={onDrill}
      />
    ) : (
      // No scan yet — nothing to summarise, so the pane says nothing rather than showing a
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
  const t = temperature(s)
  const isLeaf = node.kind === 'func'
  const analyzed = isAnalyzed(node)
  // Null unless a reader actually read this one, which is what keeps the words off a
  // proxy estimate — those are continuous and mean something else.
  const words = readingWords(node)
  // Only from a reading that still describes this body. A stale grade describes code that
  // has since changed, and the panel already refuses to colour a wedge from one.
  const legibleWord =
    node.agent && !node.agentStale && node.agent.legible
      ? LEGIBLE_WORDS[node.agent.legible]
      : null

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
      <div className="shrink-0 border-b border-[var(--border)] px-4 pb-3 pt-4">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ background: analyzed ? heatColor(paintHeat(node)) : 'var(--unanalyzed)' }}
        />
        <h2 className="mono truncate text-sm font-semibold">{node.name}</h2>
        {/* Three ring kinds are hard to tell apart in a sunburst, and hue can't be
            borrowed to distinguish them — hue is the chart's entire message. So the
            panel states it outright. */}
        <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          {KIND_LABEL[node.kind]}
        </span>
        {/* In the header, not among the dials.
            A trap is the one thing here that is not a measurement on a scale — it is a
            warning about this specific function, and it was reachable only by finding the
            same function again in the notes list. Beside the name is where it is unmissable,
            and it is the same badge the list uses so the two read as one fact. */}
        {node.agent?.trap && !node.agentStale && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ background: 'var(--trap)', color: 'var(--card)' }}
            title="A reader said something here will bite whoever edits it next."
          >
            trap
          </span>
        )}
      </div>
      {/* Two lines, and the path elided rather than wrapped — the same treatment the
          ring's hover gives it. Wrapped, a deep path took three lines and split its own
          filename across two of them, and the size hid at the end of the run-on. */}
      <p className="mono truncate text-[11px] text-[var(--muted-foreground)]">
        {elide(`${node.path}${node.line !== null ? `:${node.line}` : ''}`, 40)}
      </p>
      <p className="mono text-[11px] tabular-nums text-[var(--muted-foreground)]">
        {node.loc.toLocaleString()} lines
      </p>

      {/* The two bars ride WITH the header, above the verdict rather than below it.
          They were under the verdict box, which put the panel's only two numbers
          three paragraphs down and off the bottom of a short pane — the verdict is a
          reading OF them, so it cannot come first. */}
      {s && analyzed && (
        // Three, in a row. Read is gone: `analyzedShare` is bimodal in practice — a repo
        // is assessed or it is not, so the dial read ~100 everywhere or ~0 everywhere and
        // distinguished nothing between two wedges you would want to tell apart.
        //
        // Four when a reader graded legibility. The row does not reflow on whether a repo
        // has git — see the churn dial — but it does on whether this function has been
        // read, because a fourth dial reading "—" beside three real ones is a slot
        // advertising an absence rather than a measurement, on every unread function.
        <div className={clsx('mt-3 grid gap-1', legibleWord ? 'grid-cols-4' : 'grid-cols-3')}>
          {isLeaf ? (
            <Gauge
              label="Surprise"
              value={t}
              word={words?.heat}
              hint="How little of this body a reader could predict from its name, signature, neighbours and docs. This is the colour. A reader's judgement has four steps, so it is named rather than numbered — a printed 62 would invite a comparison the scale cannot make."
            />
          ) : (
            /* The LOC-weighted mean of what is inside. It was the hot share — the
               FRACTION of analysed lines that are hot — and the two were on screen
               together saying different things about the same word.

               Worth knowing: the wedge's COLOUR is still the hot share, because a mean
               temperature flattens every inner ring toward the repo average and makes the
               loudest thing on screen the thing that means least. So this dial no longer
               explains the colour, and its hint says so rather than claiming it does. */
            <Gauge
              label="Avg surprise"
              value={s.surprise}
              hint="The line-weighted mean surprise of everything inside. The wedge's colour is a different figure — the share of analysed lines that are hot."
            />
          )}
          {/* Documentation is a REPORT, not a discount. It no longer multiplies into the
              colour — the reader who graded it had the docs in hand, so a good comment
              already lowered the surprise beside it. Shown because "surprising and
              undocumented" and "surprising but well covered" are different situations,
              and only one of them is anyone's fault. */}
          {/* Named on the same terms and for the same reason: an agent's `documented` is
              the same four steps, so 95 / 70 / 35 / 0 was the identical false precision
              one column over. The proxy's estimate is continuous and keeps its digits. */}
          <Gauge
            label="Documented"
            value={s.documented}
            word={words?.documented}
            hint="How well the attached docs cover what the code actually does — graded by the reader that read both, not counted in comment lines. A doc the reader judged derivable from the code reads none, whatever grade it gave."
          />
          {/* The second axis. Surprise alone cannot tell a subtle algorithm from a mess —
              both are unpredictable — and churn is what separates them.

              Drawn as an empty dial reading "—" without git history, not as a needle at
              zero: no history means no second axis at all, and a zero claims "settled"
              where the truth is "unknown". Keeping the slot also keeps the row at three,
              so the panel does not reflow depending on whether a repo has a .git. */}
          <Gauge
            label="Churn"
            value={s.churn}
            unread={s.ageDays === null}
            hint="How much this code has moved lately. Without git history there is no second axis, and the dial says so rather than reading zero."
          />
          {/* The other half of the reading, and the reason the pair is worth having: this
              one is graded AFTER opening the body, where `Surprise` is graded before. A
              function that reads hot here and plain there is unreachable rather than
              unreadable, which is a documentation problem and not a code one. */}
          {legibleWord && (
            <Gauge
              label="Opacity"
              value={GRADE_SURPRISE[node.agent!.legible!]}
              word={legibleWord}
              hint="How clear the body was once the reader had opened it — the second axis. Surprise asks whether the intent was reachable from outside; this asks what was there when they looked."
            />
          )}
        </div>
      )}
      </div>

      {/* `min-h-0` because a flex child's default `min-height:auto` refuses to shrink
          below its content, which would push the pane's own height past the window and
          scroll the shell instead of this. `contain` keeps a flick at either end from
          chaining out to whatever is behind the panel. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
      {!s ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          Not scored — no parseable functions underneath.
        </p>
      ) : !analyzed ? (
        /* Say what grey means rather than showing proxy numbers under a grey swatch —
           the numbers exist, but presenting them here is how a proxy reading gets
           mistaken for a finding. */
        /* Sent to the reader that can actually act, and no longer to a menu that does
           not exist. This said "enable a model under Model…" — a live instruction to
           use the Ollama path, which was removed endpoint and all, so the one panel a
           person reaches by clicking any grey wedge told them to do something
           impossible. Readings come from agents over MCP now, and the only thing that
           produces one here is a reader being pointed at this repo. */
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          Nobody has read this yet.
          {isLeaf
            ? ' The queue is ordered by how promising each function looks, and it hasn’t got here.'
            : ' Nothing inside it has been read.'}{' '}
          Readings come from an agent working through the repo over MCP — point one at
          this project and it will fill in.
        </p>
      ) : (
        <>

          {node.agent && (
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
              {/* No section heading. "What an agent made of it" was a label for two
                  labelled things — the rows already say who is speaking, and the heading
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
                    , so it no longer colours this wedge — the number above is the offline
                    proxy again. Kept below because what a reader expected last time is
                    still worth knowing. Ask an agent to update the assessment and it will
                    re-read this one first.
                  </p>
                </div>
              )}

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
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Expected
                </p>
                <div className="text-xs leading-relaxed">
                  <Markdown text={node.agent.expected} />
                </div>
              </div>
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Found
                </p>
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
                   it otherwise — the icon is what says "this is the bit that matters",
                   and it is the same warning colour the warm-read caveat uses so the
                   panel has one vocabulary for "pay attention here". */
                <div className="flex gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5">
                  <span
                    aria-hidden
                    className="mt-px shrink-0 text-[13px] leading-none text-[var(--warning)]"
                  >
                    ⚠
                  </span>
                  <div className="text-[11px] leading-snug">
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

          {/* Say plainly what the tool cannot do yet, and never misreport which
              instrument produced the numbers directly above it. */}
          {!analyzed && (
            <p className="mt-3 text-[11px] leading-snug text-[var(--muted-foreground)]">
              These come from the offline proxy, which measurably tracks file length more
              than surprise. A reader has to look at it for a number worth acting on.
            </p>
          )}
        </>
      )}

      <Contents node={node} mode={mode} ranks={ranks} onSelect={onSelect} onDrill={onDrill} />
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
