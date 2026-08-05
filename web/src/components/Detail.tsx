import { PartyAnts } from './PartyAnts'
import { colorFor, type ColorMode } from '../lib/colorMode'
import {
  QUADRANT_LABEL,
  verdictReasons,
  heatColor,
  quadrant,
  isAnalyzed,
  temperature,
  wedgeHeat,
  type Node,
} from '../lib/api'


/**
 * A number and a bar. The definition lives in `title`, not on screen.
 *
 * Each meter used to carry a two-line explanation of what the metric means. That is
 * documentation — useful exactly once, then permanent noise that crowded out anything
 * specific to the code being looked at.
 */
function Meter({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="mb-2.5" title={hint}>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="cursor-help text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] decoration-dotted underline-offset-2 hover:underline">
          {label}
        </span>
        <span className="mono text-xs tabular-nums">{Math.round(value * 100)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
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
    return `${Math.round(wedgeHeat(n) * 100)}\u00b0`
  }
  return n.loc.toLocaleString()
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
  model,
  mode,
  ranks,
  onSelect,
  onDrill,
}: {
  node: Node | null
  model: string | null
  mode: ColorMode
  ranks?: Map<string, number>
  onSelect?: (n: Node) => void
  onDrill?: (n: Node) => void
}) {
  if (!node) {
    // Nothing but the pane and whatever is walking across it. The gestures used to be
    // spelled out here, which put a paragraph of instructions in the one place with
    // nothing to instruct — and every one of them is already stated on the wedge it
    // applies to, in the hover, at the moment it is useful.
    return (
      <div className="relative h-full">
        <PartyAnts />
      </div>
    )
  }

  const s = node.score
  const t = temperature(s)
  const q = quadrant(s, node.loc)
  const isLeaf = node.kind === 'func'
  const analyzed = isAnalyzed(node)

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
      <div className="shrink-0 px-4 pt-4">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 shrink-0 rounded-full"
          style={{ background: analyzed ? heatColor(wedgeHeat(node)) : 'var(--unanalyzed)' }}
        />
        <h2 className="mono truncate text-sm font-semibold">{node.name}</h2>
        {/* Three ring kinds are hard to tell apart in a sunburst, and hue can't be
            borrowed to distinguish them — hue is the chart's entire message. So the
            panel states it outright. */}
        <span className="shrink-0 rounded-full border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
          {KIND_LABEL[node.kind]}
        </span>
      </div>
      <p className="mono break-all text-[11px] text-[var(--muted-foreground)]">
        {node.path}
        {node.line !== null && `:${node.line}`} · {node.loc.toLocaleString()} lines
      </p>

      {/* The two bars ride WITH the header, above the verdict rather than below it.
          They were under the verdict box, which put the panel's only two numbers
          three paragraphs down and off the bottom of a short pane — the verdict is a
          reading OF them, so it cannot come first. */}
      {s && analyzed && (
        <div className="mt-3">
          {/* ONE bar for the reading. There used to be Temperature and Surprise stacked
              on top of each other, and since temperature was surprise x (1 - explained)
              they were the same number on every wedge nothing documented — which is most
              of a repo. Two identical bars claiming to be different measurements. */}
          {isLeaf ? (
            <Meter
              label="Surprise"
              value={t}
              hint="How little of this body a reader could predict from its name, signature, neighbours and docs. This is the colour."
            />
          ) : (
            /* The LOC-weighted mean of what is inside, which is also the number the
               verdict box above speaks in ("largely predictable from its signature,
               10/100"). It was the hot share — the FRACTION of analysed lines that are
               hot — and the two were on screen together saying different things about
               the same word.

               Worth knowing: the wedge's COLOUR is still the hot share, because a mean
               temperature flattens every inner ring toward the repo average and makes
               the loudest thing on screen the thing that means least. So this meter no
               longer explains the colour, and its hint says so rather than claiming it
               does. */
            <Meter
              label="Average surprise"
              value={s.surprise}
              hint="The line-weighted mean surprise of everything inside. The wedge's colour is a different figure — the share of analysed lines that are hot."
            />
          )}
          {/* Documentation is a REPORT, not a discount. It no longer multiplies into the
              colour — the reader who graded it had the docs in hand, so a good comment
              already lowered the surprise above. Shown because "surprising and
              undocumented" and "surprising but well covered" are different situations,
              and only one of them is anyone's fault. */}
          <Meter
            label="Documented"
            value={s.documented}
            hint="How well the attached docs cover what the code actually does — graded by the reader that read both, not counted in comment lines."
          />
          {/* The second axis, as a bar rather than only as a commit count further down.
              Surprise alone cannot tell a subtle algorithm from a mess — both are
              unpredictable — and churn is what separates them, so the verdict above is
              read off THIS and the bar above it. Showing one as a bar and the other as a
              raw number buried in a list made the pair look like a headline and a
              footnote.

              Hidden without git history rather than drawn at zero: no history means no
              second axis at all, and an empty bar claims "settled" when the truth is
              "unknown". The row below already says "no history" in words. */}
          {s.ageDays !== null && (
            <Meter
              label="Churn"
              value={s.churn}
              hint="How much this code has moved lately, from commits in the last 90 days. High surprise that is settled is a crown jewel; high surprise that is churning is trouble."
            />
          )}
        </div>
      )}
      {/* The edge of the pinned block. A rule rather than a shadow: everything else
          separating rows in this panel is a rule, and one drop shadow in a panel of
          hairlines reads as a rendering mistake. */}
      <div className="mt-3 h-px bg-[var(--border)]" />
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
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
          No model has looked at this yet.
          {isLeaf
            ? ' The scan hasn’t reached it — the queue is ordered by how promising each function looks.'
            : ' Nothing inside it has been analysed yet.'}{' '}
          Enable a model under <span className="font-semibold">Model…</span> to get a
          reading here.
        </p>
      ) : (
        <>
          {q && (
            <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-3">
              <p className="mb-1.5 text-xs font-semibold">{QUADRANT_LABEL[q]}</p>
              {/* The reasons, not a fixed paragraph per quadrant. A verdict with no
                  reasons attached reads the same for every function in the repo. */}
              <ul className="space-y-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
                {verdictReasons(s, node.loc, analyzed).map((r, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden>·</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mt-3 space-y-1.5 pt-1 text-[11px]">
              {/* Commits and first-seen used to sit here. Both are stated in the verdict
                  box directly above, in prose and with the interpretation attached
                  ("changed 6x in the last 90 days, last 1d ago"), and both appear in the
                  ring's hover in the modes where they are the question. Three places for
                  one fact.

                  This row stays because nothing else says it. Which instrument produced
                  the numbers above is the one thing the panel must never leave the user
                  to guess — an agent's reading and the offline proxy's guess are not the
                  same claim, and the proxy measurably tracks file length. */}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Measured by</dt>
              {/* This node's own source, not the scan's label. A wedge upgraded by the
                  streaming model pass was reporting "heuristic (no model)" because the
                  footer read a scan-level field that describes the first pass only. */}
              {/* This node's own source. Reading the scan-level label here claimed a
                  wedge an AGENT assessed had been measured by whatever model the scan
                  was configured with — two different instruments, one label. */}
              {/* Name the reader. "an agent (MCP)" covered a frontier model and
                  something small and cheap with one label, which is the one thing this
                  row exists to tell apart — the metric is a claim about what a competent
                  reader could predict, so which reader is part of the reading. Readings
                  banked before agents reported it fall back to the old wording rather
                  than being attributed to a model nobody recorded. */}
              <dd className="mono text-right">
                {!analyzed
                  ? 'not yet analysed'
                  : s.source === 'agent'
                    ? node.agent?.model
                      ? `${node.agent.model} (MCP)`
                      : 'an agent (MCP)'
                    : (model ?? 'a model')}
              </dd>
            </div>
          </dl>

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

              {node.agent.surprised && node.agent.note && (
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
              {!node.agent.surprised && (
                <p className="text-[11px] italic text-[var(--muted-foreground)]">
                  Read as expected — nothing here would trip someone up.
                </p>
              )}

              {/* Whose reading this is. Worth showing now that assessments are committed
                  to the repo: on a shared one you are often looking at a colleague's
                  reading, and "who thought this was obvious" is the first question that
                  gets asked about a wedge you disagree with. */}
              {(node.agent.by || node.agent.at) && (
                <p className="text-[10px] text-[var(--muted-foreground)]">
                  Read by {node.agent.by || 'an unnamed reader'}
                  {node.agent.at && (
                    <>
                      {' at '}
                      <span className="mono">{node.agent.at}</span>
                    </>
                  )}
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
              than surprise. Enable a model for a reading worth acting on.
            </p>
          )}
        </>
      )}

      <Contents node={node} mode={mode} ranks={ranks} onSelect={onSelect} onDrill={onDrill} />
      </div>
    </div>
  )
}
