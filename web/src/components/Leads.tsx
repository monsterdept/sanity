import { useEffect, useState } from 'react'
import type { Dismissal, Hit, Lead, LeadGroup, Say } from '../lib/api'
import { MODE_LABEL, modeToken, type ColorMode } from '../lib/colorMode'

/** The colour of one lens, for a swatch beside the lead it helped raise.
 *
 *  **`modeToken` and nothing else**, so a swatch is the same hue as the wedges that lens
 *  paints — a private table here would be a second vocabulary for one set of colours, which
 *  is how the legend and the map came to disagree about a language's name. `size` is the one
 *  id that is not a lens: width is how the map draws lines, and it gets the neutral. */
/** The lenses as one band, left to right in clause order.
 *
 *  Hard stops rather than a gradient: a gradient between two lens hues passes through colours
 *  that belong to OTHER lenses, and this app has twelve of them — a surprise-to-reach fade
 *  runs straight through the churn green on its way. Two lenses, two colours, one edge.
 */
function lensBand(ids: string[]): string {
  if (ids.length === 0) return 'var(--muted-foreground)'
  if (ids.length === 1) return lensColor(ids[0])
  const step = 100 / ids.length
  const stops = ids.map((id, i) => `${lensColor(id)} ${i * step}% ${(i + 1) * step}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** The same colours behind the title, faint enough to read as a label.
 *
 *  `color-mix` against the card rather than an alpha, so the wash sits on the panel's own
 *  ground in both themes instead of on whatever happens to be behind it. */
function lensWash(ids: string[]): string {
  const tint = (id: string) => `color-mix(in oklch, ${lensColor(id)} 14%, transparent)`
  if (ids.length === 0) return 'transparent'
  if (ids.length === 1) return tint(ids[0])
  const step = 100 / ids.length
  return `linear-gradient(90deg, ${ids
    .map((id, i) => `${tint(id)} ${i * step}% ${(i + 1) * step}%`)
    .join(', ')})`
}

function lensColor(id: string): string {
  // **Membership checked, not assumed.** `modeToken` walks a `Record<ColorMode, …>`, so an id
  // the frontend has never heard of comes back as `--undefined-3` — a var that resolves to
  // nothing, drawing an invisible swatch rather than failing. That is the quiet-wrong-colour
  // failure this whole app is written against, and the guard costs one lookup.
  if (id !== 'size' && id in MODE_LABEL) return `var(${modeToken(id as ColorMode)})`
  return 'var(--muted-foreground)'
}

/**
 * What the map is telling you to do.
 *
 * **The map is a good instrument for a single-lens extreme and a bad one for a
 * conjunction** — it wears one lens at a time, so "big AND surprising" or "load-bearing AND
 * unread" is a reading no amount of looking produces. That is what a lead is, and it
 * arrives as a list rather than as a thirteenth colouring because the answer to "so what"
 * is a verb and a colour has no verbs. See `docs/notes/leads.md`.
 *
 * **They are leads, not issues.** Nothing here knows that anything is wrong; it knows a
 * reader was surprised, that git has a date, that the parse counted callers. The panel says
 * look here, and says why — the word "issue" would claim a confidence nothing upstream of
 * it has got.
 *
 * **One list, one tile per thing to look at.** Grouped by rule, a function three rules
 * flagged appeared three times, and a reader counting the work saw three jobs where there is
 * one. The rules are what the tile SAYS about it instead — which is also the better sentence:
 * this is long, and knotty, and nobody could read it.
 *
 * **A rule that could not be asked is not a rule that found nothing.** Silence over unread
 * code reads as a clean bill, which is the one thing this surface must never do — so what
 * could not be asked, and what has already been set aside, are stated in the footer rather
 * than left to be inferred from a short list.
 */
export function Leads({
  open,
  projectKey,
  /** The catalog's answer, or `null` while it is still being asked.
   *
   *  **Fetched by `App` rather than here, because the badge needs it too.** Two fetchers for
   *  one answer is two answers: a dot on the mascot saying there is something to see, over a
   *  panel that has not asked yet, or worse the reverse. One owner, one number. */
  groups,
  /** True while a replay is up. A lead is a claim about HEAD, so this is the one state the
   *  panel cannot honestly serve — see the note it renders instead, and `Find`, which
   *  refuses for the same reason. */
  replaying,
  /** What has been set aside here, newest first, or `null` while it is being fetched. */
  archive,
  onClose,
  onPick,
  onDismiss,
  onRestore,
}: {
  open: boolean
  projectKey: string | null
  groups: LeadGroup[] | null
  replaying: boolean
  archive: Dismissal[] | null
  onClose: () => void
  onPick: (hit: Hit) => void
  onDismiss: (key: string, rule: string, reason: string) => void
  onRestore: (key: string, rule: string) => void
}) {
  const [showArchive, setShowArchive] = useState(false)
  /** Which row has its reason field open, as `key\u0000rule`.
   *
   *  **A reason is asked for, and not required.** The reasons people type are the most
   *  interesting thing this feature produces, so the field opens by default — but a blank one
   *  still files, because a dismissal somebody could not be bothered to justify is better
   *  recorded than not made. */
  const [saying, setSaying] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  // Escape puts it down, on the window because this panel has no field to own the keyboard
  // with. Registered only while it is up, so it cannot swallow the key from anything else.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const choose = (hit: Hit) => {
    onPick(hit)
    onClose()
  }

  /** One tile per SUBJECT, not per lead.
   *
   *  **A function that three rules flagged is one thing to look at, not three.** Grouped by
   *  rule, `App.tsx` appeared under Giant function, Tangled for its size and Hard to read —
   *  the same body, three rows, and a reader counting the work sees three jobs. Merged, the
   *  rules become what the tile SAYS about it, which is also the more useful sentence: this
   *  is long, and knotty, and nobody could read it.
   *
   *  Ranked by lines, which is the axis the whole map is already sized by. Not by how many
   *  rules fired — two rules is not twice as bad, and a count of coincidences is a severity
   *  claim the instrument cannot support. */
  const items = (() => {
    if (!groups) return []
    const by = new Map<string, { lead: Lead; rules: LeadGroup[]; says: Say[][] }>()
    for (const g of groups) {
      if (g.blocked) continue
      for (const l of g.hits) {
        const at = by.get(l.key)
        if (at) {
          at.rules.push(g)
          at.says.push(l.says)
        } else by.set(l.key, { lead: l, rules: [g], says: [l.says] })
      }
    }
    return [...by.values()].sort(
      (a, b) => b.lead.hit.loc - a.lead.hit.loc || a.lead.key.localeCompare(b.lead.key),
    )
  })()

  /** What could not be asked, and what has been dealt with — the two things a worklist must
   *  say out loud rather than by being short.
   *
   *  **An empty list is ambiguous and this is what disambiguates it.** Nothing here matches,
   *  nobody has read this repo, and you have already set all of it aside are three different
   *  sentences, and a bare empty list is read as the first one every time. */
  const blocked = groups?.filter((g) => g.blocked) ?? []
  const setAside = groups?.reduce((n, g) => n + g.dismissed, 0) ?? 0
  /** True where a group is holding back rows the wire did not carry — see `PER_GROUP`. With
   *  calibrated thresholds this should not happen; if it does, the tile count is short and
   *  says so rather than quietly under-reporting the work. */
  const capped = groups?.some((g) => g.total > g.hits.length) ?? false

  return (
    <>
      {/* Transparent rather than dimmed, like `Find`: the map is what these rows are about,
          and a scrim would hide the thing being pointed at. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute left-1/2 top-6 z-50 flex max-h-[calc(100%-4rem)] w-[min(38rem,calc(100%-3rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 border-b border-[var(--border)] px-3 py-2">
          <span className="text-[13px] font-medium text-[var(--foreground)]">Leads</span>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {/* **Was "where two lenses disagree", which most of the catalog is and two rules
                are not.** Giant function and Crowded file are single-clause on purpose — they
                are the rows anybody believes without the design explained — and a subtitle
                that overclaims on the first two tiles somebody sees is worse than one that
                promises less and delivers it. */}
            what is worth looking at, and why
          </span>
          {groups && !replaying && (
            <>
              <button
                type="button"
                onClick={() => setShowArchive((v) => !v)}
                className="ml-auto text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {showArchive ? 'leads' : `archive${archive?.length ? ` (${archive.length})` : ''}`}
              </button>
              <span className="mono text-[11px] text-[var(--muted-foreground)]">
                {items.length.toLocaleString()}
                {capped ? '+' : ''}
              </span>
            </>
          )}
        </div>

        {replaying ? (
          // A lead's verbs — read it, open it, go there — are all about the working tree, and
          // a frame is the repo as it stood. Rather than run the half of the catalog a frame
          // could answer, which would be silence standing in for a clean bill on the surface
          // whose whole discipline forbids that, it says which map it can speak about.
          <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Leads are about the repo as it stands now. Leave the replay (⌘+) to see them.
          </p>
        ) : !projectKey ? (
          <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
            Open a repo to see what is worth looking at.
          </p>
        ) : !groups ? (
          <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">Looking…</p>
        ) : showArchive ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!archive?.length ? (
              <p className="px-3 py-2 text-[11px] text-[var(--muted-foreground)]">
                Nothing set aside here yet.
              </p>
            ) : (
              archive.map((d) => (
                <div
                  key={`${d.key}\u0000${d.rule}`}
                  className="border-b border-[var(--border)] px-3 py-2 last:border-b-0"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[12px] text-[var(--foreground)]">{d.key}</span>
                    <span className="mono ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">
                      {d.rule}
                    </span>
                  </div>
                  {/* The reason is the point of the archive. A row without one still says so,
                      rather than looking like a row whose reason failed to load. */}
                  <p className="pt-0.5 text-[11px] text-[var(--muted-foreground)]">
                    {d.reason || 'no reason given'}
                  </p>
                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {d.by ? `${d.by} · ` : ''}
                      {d.when.slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRestore(d.key, d.rule)}
                      className="ml-auto text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      put back
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {items.length === 0 && (
              <p className="px-1 py-1 text-[11px] text-[var(--muted-foreground)]">
                {setAside > 0
                  ? `Nothing standing. ${setAside.toLocaleString()} set aside.`
                  : 'Nothing in this repo matches the rules.'}
              </p>
            )}
            {items.map(({ lead, rules, says }) => {
              const at = lead.key
              return (
                <div
                  key={at}
                  className="mb-1.5 overflow-hidden rounded-md border border-[var(--border)] last:mb-0"
                  style={{ background: 'color-mix(in oklch, var(--foreground) 3%, transparent)' }}
                >
                  {/* **The lenses that raised this, as the tile's own colour.**
                      A lead is a conjunction, so the title wears both hues rather than one —
                      and they are `modeToken`'s, which means the band here and the wedge on
                      the map are the same colour for the same reason.
                      Left to right in clause order, split evenly, at a strength that reads as
                      a label rather than competing with the map it is about. */}
                  <div
                    className="h-1.5 w-full"
                    style={{ background: lensBand([...new Set(rules.flatMap((r) => r.lenses))]) }}
                  />
                  <div
                    className="flex items-baseline gap-2 px-2.5 pb-1 pt-1.5"
                    style={{
                      background: lensWash([...new Set(rules.flatMap((r) => r.lenses))]),
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => choose(lead.hit)}
                      className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                      style={{ color: 'var(--foreground)' }}
                    >
                      <span className="mono w-3 shrink-0 text-[var(--muted-foreground)]">
                        {lead.hit.kind === 'func' ? 'ƒ' : lead.hit.kind === 'file' ? '·' : '/'}
                      </span>
                      <span className="shrink-0 text-[12px] font-medium">{lead.hit.name}</span>
                    </button>
                    {/* Beside the tile's own click rather than on it: one takes you there and
                        one files a decision, and those must not be the same gesture. */}
                    <button
                      type="button"
                      title="Set this aside"
                      onClick={() => {
                        setSaying(saying === at ? null : at)
                        setReason('')
                      }}
                      className="shrink-0 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      ×
                    </button>
                  </div>
                  {/* **The paragraph is the tile's reason for existing, and it is written in
                      the engine.** A row of rule names is a set of labels somebody has to
                      already know; "at 3,161 lines this is well past the 257 that counts as
                      long here" is a finding. Each rule renders its own sentence about THIS
                      subject — `leads::render`, with the subject's own numbers in it — so a
                      body three rules flagged reads as three things that are true about it.

                      Rendered there rather than here because `just leads` prints the same
                      sentences, and a second template in TypeScript is the split brain this
                      app keeps legislating against. */}
                  <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-[var(--muted-foreground)]">
                    {says.map((sentence, i) => (
                      <span key={i}>
                        {i > 0 && ' '}
                        {sentence.map((run, j) =>
                          run.filled ? (
                            // **The measurements, at the panel's own text colour and weight.**
                            // They are what somebody scans a tile for — 3,161 lines, 102
                            // callers — and the prose around them is the reason they matter.
                            // Weight rather than a colour, because every colour in this panel
                            // already means a lens.
                            <strong
                              key={j}
                              className="font-semibold"
                              style={{ color: 'var(--foreground)' }}
                            >
                              {run.text}
                            </strong>
                          ) : (
                            <span key={j}>{run.text}</span>
                          ),
                        )}
                      </span>
                    ))}
                  </p>
                  {/* The tags last: they are the provenance of the sentence above, not the
                      sentence itself. Each carries its rule's expression, so "why is this
                      here" is a hover rather than a trip to a settings page. */}
                  <div className="flex flex-wrap items-center gap-1 px-2.5 pb-2">
                    {rules.map((r) => (
                      <span
                        key={r.title}
                        title={`${r.expr} — ${r.soWhat}`}
                        className="rounded px-1.5 py-0.5 text-[10px]"
                        style={{
                          background: `color-mix(in oklch, ${lensColor(r.lenses[0] ?? 'size')} 18%, transparent)`,
                          color: 'var(--foreground)',
                        }}
                      >
                        {r.title}
                      </span>
                    ))}
                  </div>
                  {saying === at && (
                    <div className="px-2.5 pb-2 pl-7">
                      <input
                        autoFocus
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        onKeyDown={(e) => {
                          // Escape closes the field, not the panel: cancelling a reason and
                          // cancelling the list are different intentions, and the smaller one
                          // is the one being expressed.
                          if (e.key === 'Escape') {
                            e.stopPropagation()
                            setSaying(null)
                          }
                          if (e.key === 'Enter') {
                            // **Every rule that raised it**, because the tile is the thing
                            // being set aside. The store stays per-rule underneath, so a rule
                            // that flags this LATER brings it back — which is the behaviour
                            // you want and could not get from one coarse record.
                            for (const r of rules) onDismiss(lead.key, r.title, reason.trim())
                            setSaying(null)
                          }
                        }}
                        placeholder="why is this fine? (⏎ to file, blank is allowed)"
                        spellCheck={false}
                        className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-0.5 text-[11px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
                      />
                    </div>
                  )}
                </div>
              )
            })}
            {/* The footer says what the list cannot: what was dealt with, and what could not
                be asked at all. Never omitted when non-empty — a short list with a silent
                reason reads as a clean bill. */}
            {(setAside > 0 || blocked.length > 0) && (
              <div className="mt-1 border-t border-[var(--border)] px-1 pt-2 text-[10px] text-[var(--muted-foreground)]">
                {setAside > 0 && <p>{setAside.toLocaleString()} set aside.</p>}
                {blocked.map((g) => (
                  <p key={g.title}>
                    {g.title} — {g.blocked}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
