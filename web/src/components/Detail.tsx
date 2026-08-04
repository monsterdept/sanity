import { useEffect, useState } from 'react'
import { PartyAnts } from './PartyAnts'
import {
  explainFunction,
  QUADRANT_LABEL,
  verdictReasons,
  heatColor,
  quadrant,
  isAnalyzed,
  temperature,
  wedgeHeat,
  type ModelSettings,
  type Node,
  type Provenance,
} from '../lib/api'

const PROVENANCE_COPY: Record<Provenance, string> = {
  none: 'Nothing explains this code.',
  source: 'Explained by a comment in the source — author unknown.',
  history: 'Explained from git history.',
  human: 'Explained by you.',
}

/**
 * A number and a bar. The definition lives in `title`, not on screen.
 *
 * Each meter used to carry a two-line explanation of what the metric means. That is
 * documentation — useful exactly once, then permanent noise that crowded out anything
 * specific to the code being looked at.
 */
function Meter({ label, value, hint }: { label: string; value: number; hint: string }) {
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

export function Detail({
  node,
  model,
  repo,
  settings,
}: {
  node: Node | null
  model: string | null
  repo: string | null
  settings: ModelSettings
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
    <div className="h-full overflow-y-auto p-4">
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
      <p className="mono mb-4 break-all text-[11px] text-[var(--muted-foreground)]">
        {node.path}
        {node.line !== null && `:${node.line}`} · {node.loc.toLocaleString()} lines
      </p>

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
            /* A directory's mean temperature is a meaningless number — see
               `wedgeHeat`. Show the share, which is what its colour means. */
            <Meter
              label="Hot share"
              value={s.hotShare}
              hint="The share of these lines sitting in surprising code. This is the colour."
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

          <dl className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-[11px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Docs</dt>
              <dd className="text-right">{PROVENANCE_COPY[s.provenance]}</dd>
            </div>
            {/* Counts, not the normalised figure — see `verdictReasons`. */}
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Commits (90d)</dt>
              <dd className="mono tabular-nums">
                {s.ageDays === null ? 'no history' : s.commits}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">First seen</dt>
              <dd className="mono tabular-nums">
                {s.ageDays === null ? '—' : `${Math.round(s.ageDays)}d ago`}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">Measured by</dt>
              {/* This node's own source, not the scan's label. A wedge upgraded by the
                  streaming model pass was reporting "heuristic (no model)" because the
                  footer read a scan-level field that describes the first pass only. */}
              {/* This node's own source. Reading the scan-level label here claimed a
                  wedge an AGENT assessed had been measured by whatever model the scan
                  was configured with — two different instruments, one label. */}
              <dd className="mono text-right">
                {!analyzed
                  ? 'not yet analysed'
                  : s.source === 'agent'
                    ? 'an agent (MCP)'
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
            </div>
          )}

          {isLeaf && node.hotspots.length > 0 && repo && settings.useOllama && (
            <Explanation node={node} repo={repo} settings={settings} />
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
    </div>
  )
}

/**
 * The two-line summary, fetched when a function is selected.
 *
 * Lazy on purpose: generating prose for every function would multiply an already slow
 * scan to produce text nobody reads. One call, at the moment somebody asks.
 *
 * It sits ABOVE the raw hotspots rather than replacing them, and that ordering is the
 * point. The prose is generated and could be wrong; the hotspots are measurements and
 * cannot be. Anyone who doubts a sentence can check it against the evidence that
 * produced it, in the same panel, without leaving.
 */
function Explanation({
  node,
  repo,
  settings,
}: {
  node: Node
  repo: string
  settings: ModelSettings
}) {
  const [text, setText] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle')

  useEffect(() => {
    let live = true
    setText(null)
    setState('loading')
    explainFunction({
      repo,
      relPath: node.path,
      name: node.name,
      line: node.line ?? 0,
      hotspots: node.hotspots,
      endpoint: settings.endpoint,
      model: settings.model,
    })
      .then((t) => {
        if (!live) return
        setText(t)
        setState(t ? 'idle' : 'failed')
      })
      .catch(() => live && setState('failed'))
    // Cancelled on selection change so a slow reply can't land in the wrong panel.
    return () => {
      live = false
    }
  }, [node.id, repo, settings.endpoint, settings.model])

  if (state === 'loading') {
    return (
      <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] italic text-[var(--muted-foreground)]">
        Working out what’s surprising here…
      </p>
    )
  }
  if (!text) return null

  return (
    <div className="mt-4 border-t border-[var(--border)] pt-3">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        In short
      </p>
      <p className="whitespace-pre-line text-xs leading-relaxed">{text}</p>
    </div>
  )
}
