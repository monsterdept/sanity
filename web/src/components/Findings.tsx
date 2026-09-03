import { useEffect, useState } from 'react'
import type { Decision, Hit, Finding, FindingGroup, Say, Verdict } from '../lib/api'
import { MODE_LABEL, modeToken, type ColorMode } from '../lib/colorMode'

/** The colour of one lens, for a swatch beside the finding it helped raise.
 *
 *  **`modeToken` and nothing else**, so a swatch is the same hue as the wedges that lens
 *  paints — a private table here would be a second vocabulary for one set of colours, which
 *  is how the legend and the map came to disagree about a language's name. `size` is the one
 *  id that is not a lens: width is how the map draws lines, and it gets the neutral. */
/** What a lens is called, in the words the lens switcher uses.
 *
 *  `MODE_LABEL` rather than a table here, for the same reason `lensColor` defers to
 *  `modeToken`: one name per lens, in one place. */
function lensName(id: string): string {
  return id === 'size' ? 'Size' : (MODE_LABEL[id as ColorMode] ?? id)
}

/** Where a finding lives, as one string: `src/lib/history.ts`, or `…#frameTree` for a function.
 *
 *  **`#`, not `:`.** A colon after a path already means a LINE — `just findings` prints
 *  `src/findings.rs:279`, and so does every compiler, stack trace and editor — so `findings.rs:parse`
 *  would be one syntax for two different things. `#` is what this app already uses for the
 *  same idea: `key_of` writes `path#name`, and a node id is `path#name@line`. It is the
 *  fragment convention too, which is exactly what a function inside a file is.
 *
 *  One format for both kinds, and the `#` is what says which. The glyph column it replaced
 *  said that in a symbol nobody had been taught, and spent a character's width per row on it. */
function address(hit: Hit): string {
  return hit.kind === 'func' ? `${hit.path}#${hit.name}` : hit.path
}

/** The directory part, which is what gets truncated when the row is too narrow. */
function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut + 1)
}

/** The file, with its `#` where a function follows. Never truncated.
 *
 *  Separate from the function name so the two can carry different weight: on a function finding
 *  the file is still where-it-is, and the NAME is what the tile is about. Three tiers in all —
 *  directory, file, name — each a step nearer the subject. */
function fileOf(hit: Hit): string {
  const cut = hit.path.lastIndexOf('/')
  const base = cut === -1 ? hit.path : hit.path.slice(cut + 1)
  return hit.kind === 'func' ? `${base}#` : base
}

/** The function, where there is one. Empty on a file finding, whose title is its filename. */
function nameOf(hit: Hit): string {
  return hit.kind === 'func' ? hit.name : ''
}

/** The lenses that raised this finding, laid across the head of its tile.
 *
 *  **The one mark left, and horizontal is why it survived.** They ran down the tile's leading
 *  edge first, as a rail — nine pixels wide, then eighteen, then twenty-seven, striped both
 *  ways at each. Down a rail four lenses are threads under seven pixels wide and read as a
 *  barcode; across the head of a tile each one gets a real span. The rail went, this stayed,
 *  and the tile got its left margin back.
 *
 *  Hard stops rather than a fade: a gradient between two lens hues passes through colours that
 *  belong to OTHER lenses, and this app has twelve — a surprise-to-reach blend runs straight
 *  through the churn green on the way. */
function lensRule(ids: string[]): string {
  if (ids.length === 0) return 'var(--border)'
  if (ids.length === 1) return lensColor(ids[0])
  const step = 100 / ids.length
  return `linear-gradient(90deg, ${ids
    .map((id, i) => `${lensColor(id)} ${i * step}% ${(i + 1) * step}%`)
    .join(', ')})`
}

/** The colour of one lens.
 *
 *  **`modeToken` and nothing else**, so a segment here is the same hue as the wedges that lens
 *  paints — a private table would be a second vocabulary for one set of colours, which is how
 *  the legend and the map came to disagree about a language's name. `size` is the one id that
 *  is not a lens: width is how the map draws lines, and it gets the neutral. */
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
 * unread" is a reading no amount of looking produces. That is what a finding is, and it
 * arrives as a list rather than as a thirteenth colouring because the answer to "so what"
 * is a verb and a colour has no verbs. See `docs/notes/findings.md`.
 *
 * **They are findings, not issues.** Nothing here knows that anything is wrong; it knows a
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
 * could not be asked, and what has already been ignored, are stated in the footer rather
 * than left to be inferred from a short list.
 */
export function Findings({
  open,
  projectKey,
  /** The catalog's answer, or `null` while it is still being asked.
   *
   *  **Fetched by `App` rather than here, because the badge needs it too.** Two fetchers for
   *  one answer is two answers: a dot on the mascot saying there is something to see, over a
   *  panel that has not asked yet, or worse the reverse. One owner, one number. */
  groups,
  /** True while a replay is up. A finding is a claim about HEAD, so this is the one state the
   *  panel cannot honestly serve — see the note it renders instead, and `Find`, which
   *  refuses for the same reason. */
  replaying,
  /** Every decision made here, newest first, or `null` while it is being fetched. Flags are
   *  in it too — see `ignored`, which is what the drawer shows. */
  archive,
  onClose,
  onPick,
  onDecide,
  onUndecide,
}: {
  open: boolean
  projectKey: string | null
  groups: FindingGroup[] | null
  replaying: boolean
  archive: Decision[] | null
  onClose: () => void
  onPick: (hit: Hit) => void
  onDecide: (key: string, rule: string, verdict: Verdict, reason: string) => void
  onUndecide: (key: string, rule: string) => void
}) {
  const [showArchive, setShowArchive] = useState(false)
  /** Which row has its reason field open, and under which verdict.
   *
   *  **A reason is asked for, and not required.** The reasons people type are the most
   *  interesting thing this feature produces, so the field opens by default — but a blank one
   *  still files, because a dismissal somebody could not be bothered to justify is better
   *  recorded than not made. */
  const [saying, setSaying] = useState<{ at: string; verdict: Verdict } | null>(null)
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

  /** One tile per SUBJECT, not per finding.
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
    const by = new Map<
      string,
      { finding: Finding; rules: FindingGroup[]; says: Say[][]; flagged: boolean }
    >()
    for (const g of groups) {
      if (g.blocked) continue
      for (const l of g.hits) {
        const at = by.get(l.key)
        if (at) {
          at.rules.push(g)
          at.says.push(l.says)
          // Flagged under ANY of its rules: the tile is the thing somebody committed to.
          at.flagged = at.flagged || l.flagged
        } else by.set(l.key, { finding: l, rules: [g], says: [l.says], flagged: l.flagged })
      }
    }
    // Flagged first, then widest — the same order the backend ranks each rule by, applied
    // again here because merging by subject shuffles them back together.
    return [...by.values()].sort(
      (a, b) =>
        Number(b.flagged) - Number(a.flagged) ||
        b.finding.hit.loc - a.finding.hit.loc ||
        a.finding.key.localeCompare(b.finding.key),
    )
  })()

  /** What could not be asked, and what has been dealt with — the two things a worklist must
   *  say out loud rather than by being short.
   *
   *  **An empty list is ambiguous and this is what disambiguates it.** Nothing here matches,
   *  nobody has read this repo, and you have already set all of it aside are three different
   *  sentences, and a bare empty list is read as the first one every time. */
  /** What has been ignored — the two verdicts that HIDE a finding.
   *
   *  **A flag is not an archive entry.** It is a commitment to do something, and the finding
   *  it was made about is still in the list where it can be acted on; filing it under
   *  "ignored" would put every piece of work somebody signed up for in the drawer of things
   *  they decided not to do. Unflagging is done on the finding, which is where it is visible.
   */
  const ignored = (archive ?? []).filter((d) => d.verdict !== 'flagged')

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
        /* **Centred both ways.** It hung from `top-6` back when it was tall enough that the
           offset was the whole story; short, it read as a panel that had slid up. `Find` still
           hangs from the top on purpose — a search box belongs near where you typed. */
        className="absolute left-1/2 top-1/2 z-50 flex max-h-[calc(100%-9rem)] w-[min(38rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline gap-2 border-b border-[var(--border)] px-4 py-2.5">
          {/* **The count is part of the title**, not a figure parked at the other end of the
              row: `Findings (62)` is one thing being named, where a title on the left and a
              number on the right were two rows of chrome to read. */}
          <span className="text-[13px] font-medium text-[var(--foreground)]">
            Findings{groups && !replaying ? ` (${items.length}${capped ? '+' : ''})` : ''}
          </span>
          {/* The way into the drawer, and out of it, said as the sentence it is. Absent when
              there is nothing in there: a link to an empty room is a thing to wonder about. */}
          {groups && !replaying && (showArchive || ignored.length > 0) && (
            <button
              type="button"
              onClick={() => setShowArchive((v) => !v)}
              className="ml-auto text-[11px] text-[var(--muted-foreground)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)] hover:decoration-current"
            >
              {showArchive
                ? 'back to findings'
                : `${ignored.length} finding${ignored.length === 1 ? '' : 's'} ignored`}
            </button>
          )}
        </div>

        {replaying ? (
          // A finding's verbs — read it, open it, go there — are all about the working tree, and
          // a frame is the repo as it stood. Rather than run the half of the catalog a frame
          // could answer, which would be silence standing in for a clean bill on the surface
          // whose whole discipline forbids that, it says which map it can speak about.
          <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
            Findings are about the repo as it stands now. Leave the replay (⌘+) to see them.
          </p>
        ) : !projectKey ? (
          <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
            Open a repo to see what is worth looking at.
          </p>
        ) : !groups ? (
          <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">Looking…</p>
        ) : showArchive ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!ignored.length ? (
              <p className="px-4 py-3 text-[11px] text-[var(--muted-foreground)]">
                Nothing ignored here yet.
              </p>
            ) : (
              ignored.map((d) => (
                <div
                  key={`${d.key}\u0000${d.rule}`}
                  className="border-b border-[var(--border)] px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[12px] text-[var(--foreground)]">{d.key}</span>
                    <span className="mono ml-auto shrink-0 text-[10px] text-[var(--muted-foreground)]">
                      {d.title || d.rule}
                    </span>
                  </div>
                  {/* The reason is the point of the drawer. A row without one still says so,
                      rather than looking like a row whose reason failed to load. */}
                  <p className="pt-0.5 text-[11px] text-[var(--muted-foreground)]">
                    {d.reason || 'no reason given'}
                  </p>
                  <div className="flex items-baseline gap-2 pt-0.5">
                    {/* **What was decided, not just that something was.** Three verdicts land
                        in one store and two of them hide a finding; a row that did not say
                        which would leave somebody unable to tell a commitment from a
                        dismissal. */}
                    <span
                      className="rounded px-1.5 py-[1px] text-[9px] uppercase"
                      style={{
                        letterSpacing: '0.1em',
                        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
                        color: 'var(--muted-foreground)',
                      }}
                    >
                      {d.verdict === 'flagged'
                        ? 'flagged'
                        : d.verdict === 'fine-always'
                          ? 'always fine'
                          : 'fine as it stood'}
                    </span>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {d.by ? `${d.by} · ` : ''}
                      {d.when.slice(0, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUndecide(d.key, d.rule)}
                      className="ml-auto text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      undo
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div /* **16px, the same inset the detail pane uses (`px-4`).** The two panes sit side by
               side on one window, and a list that framed itself differently would read as a
               different piece of software. The gap between tiles matches it rather than
               being smaller: the margin around the list and the air between its rows are the
               same measurement, so nothing is closer to its neighbour than to the edge. */
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            {items.length === 0 && (
              <p className="py-1 text-[11px] text-[var(--muted-foreground)]">
                {setAside > 0
                  ? `Nothing standing. ${setAside.toLocaleString()} ignored.`
                  : 'Nothing in this repo matches the rules.'}
              </p>
            )}
            {items.map(({ finding, rules, says, flagged }) => {
              const at = finding.key
              const lenses = [...new Set(rules.flatMap((r) => r.lenses))]
              return (
                <div
                  key={at}
                  className="relative mb-4 overflow-hidden rounded-xl border border-[var(--border)] last:mb-0"
                  style={{ background: 'color-mix(in oklch, var(--foreground) 3%, transparent)' }}
                >
                  {/* **Ruled off.** With nothing under it the address read as the first line of
                      the prose rather than as the tile's title — the size and weight said
                      heading and the layout said paragraph. */}
                  <div className="flex items-start gap-2 px-4 pb-2.5 pl-4 pt-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {/* **The address, not a name and an icon.** `src/lib/history.ts` for a
                          file and `src/lib/history.ts#frameTree` for a function — one format,
                          which says what kind of thing it is by having a `#` or not, and which
                          is the string somebody would type to go there. The glyphs it replaces
                          said the same thing in a symbol nobody had been taught.

                          The directory is muted so the eye lands on the file and the function;
                          it is truncated from the LEFT, because the end of a path is the half
                          that identifies it. */}
                      <button
                        type="button"
                        onClick={() => choose(finding.hit)}
                        title={address(finding.hit)}
                        className="mono flex w-full min-w-0 items-baseline text-left"
                      >
                        {/* **Right-aligned and clipped, never `dir="rtl"`.** The bidi trick
                            for left-truncating a path reorders it: a directory ending in `/`
                            has that slash resolved as a neutral character and moved to the
                            front, so `src-tauri/src/` rendered as `/src-tauri/src` and ran
                            straight into the filename beside it. Aligning an overflowing line
                            to the right spills it off the left edge instead — the same result,
                            with nothing telling the text it is RTL.

                            Shrinks but never GROWS: with `flex-1` a short directory was pushed
                            to the far side of its own box, leaving a gap between `/web/src/`
                            and the file it belongs to. Content-sized until the row runs out of
                            room is the behaviour wanted, and it is the flex default.

                            Clipped rather than ellipsised, and silently: an ellipsis costs a
                            character from the half worth reading, and a fade would draw on
                            every short path too, since CSS cannot tell whether it overflowed.
                            The whole address is on the row's `title`. */}
                        {/* **One size, three weights.** The directory was set smaller to keep
                            it out of the way, which it did by making the address look like two
                            things joined. Now the rule underneath does the separating and the
                            heading can be one line of type: the tiers are carried by weight and
                            value, which is enough when nothing else is competing. */}
                        <span className="min-w-0 overflow-hidden whitespace-nowrap text-right text-[15px] text-[var(--muted-foreground)]">
                          {dirOf(finding.hit.path)}
                        </span>
                        {/* The file is still where-it-IS: same size as the name so they read
                            as one heading, lighter so the name is the thing being named. On a
                            file finding there is no name and this carries the full weight. */}
                        <span
                          className="shrink-0 text-[15px]"
                          style={{
                            fontWeight: finding.hit.kind === 'func' ? 400 : 600,
                            color:
                              finding.hit.kind === 'func'
                                ? 'color-mix(in oklch, var(--foreground) 72%, transparent)'
                                : 'var(--foreground)',
                          }}
                        >
                          {fileOf(finding.hit)}
                        </span>
                        <span
                          className="shrink-0 text-[15px] font-semibold"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {nameOf(finding.hit)}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* **The rule is the lenses, turned.** A grey hairline did the job and said
                      nothing; the same colours the rail carries, laid across the head of the
                      tile, tie the two together at the corner and make the heading's underline
                      the tile's own marking rather than a borrowed border.

                      This is where the horizontal striping belongs. Down the rail it was four
                      threads under seven pixels wide and read as a barcode; across a whole
                      tile each lens gets a real span. Same gradient, same hard stops, the one
                      dimension that has room for them. */}
                  {/* Inset to the text column. Edge to edge was tried: full-bleed it reads as a
                      band strapped across the tile rather than as the heading's own rule, and
                      the clipped corners make it look like something that overflowed. */}
                  <div className="mx-4 h-[3px]" style={{ background: lensRule(lenses) }} />

                  {/* **Each rule says its piece under its own name.**
                      One joined paragraph made a reader hold three claims and then map them
                      onto three tags at the bottom, in order, from memory. Paired, the tag is
                      the sentence's attribution and the reading is local: this is what Surprising
                      and changing found, and this is what Tangled found.

                      `rules` and `says` are pushed in lockstep when the tile is merged, so
                      index `i` is the same rule in both. */}
                  <div className="flex flex-col gap-3 py-3 pl-4 pr-4">
                    {rules.map((r, i) => (
                      <div key={r.title}>
                        {/* **A heading, not a tag.** As a pill it read as metadata attached to
                            the paragraph — a thing to classify by rather than a thing to read
                            — and three of them stacked made the tile look filed rather than
                            written. As a heading it is what the sentence under it is about,
                            which is what it always was.

                            The lens colour is carried by the rail and the chips at the foot;
                            spending it here too would put three more colours in the reading
                            column, and the words are already distinct. */}
                        <h4
                          title={r.expr}
                          className="text-[12px] font-semibold"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {r.title}
                        </h4>
                        <p
                          className="pt-1 text-[12.5px] text-[var(--muted-foreground)]"
                          style={{ lineHeight: 1.6, textWrap: 'pretty' }}
                        >
                          {(says[i] ?? []).map((run, j) =>
                            run.filled ? (
                              // The measurements, at the panel's own text colour and weight.
                              // Weight rather than a colour: every colour in this panel already
                              // means a lens.
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
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* **The lenses at the foot, and the verdicts beside them.** The lenses were
                      under the address, where they read as part of the heading and had to be
                      crossed before the first sentence; down here they are what the tile was
                      found BY — a summary of the rails on its edge, after the claims.

                      **Icons, on the row the lens tags already occupy.** Three words spelled
                      out sat under every tile repeating themselves down the list; as marks
                      they read once and are recognised after that. The words survive as the
                      tooltip and the accessible name, which is where a word belongs when the
                      thing it names is a picture.

                      Snooze is the honest metaphor for the middle one and it is the user's:
                      fine as it stands is a clock, because the finding comes back when the code
                      moves; always fine is the same clock struck through. Flag is not a
                      snooze at all and does not look like one. */}
                  <div className="flex items-center gap-1.5 px-4 pb-3 pl-4">
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {lenses.map((id) => (
                        <span
                          key={id}
                          className="flex items-center gap-1.5 rounded-[5px] px-2 py-[3px]"
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--muted-foreground)',
                            background: `color-mix(in oklch, ${lensColor(id)} 12%, transparent)`,
                            border: `1px solid color-mix(in oklch, ${lensColor(id)} 24%, transparent)`,
                          }}
                        >
                          <i
                            className="block h-[5px] w-[5px] rounded-full"
                            style={{ background: lensColor(id) }}
                          />
                          {lensName(id)}
                        </span>
                      ))}
                    </div>
                    {(
                      [
                        ['flagged', 'Flag for action', 'Stays in the list, at the top'],
                        ['fine-for-now', 'Fine as it stands', 'Hidden until this code changes'],
                        ['fine-always', 'Always fine', 'Hidden whatever this code does'],
                      ] as [Verdict, string, string][]
                    ).map(([verdict, label, hint]) => {
                      const on = saying?.at === at && saying.verdict === verdict
                      return (
                        <button
                          key={verdict}
                          type="button"
                          aria-label={label}
                          title={`${label} — ${hint}`}
                          onClick={() => {
                            // **A flag files on one click, and clicking again takes it back.**
                            // Committing to a piece of work should cost one gesture; a reason
                            // box in front of it turns "yes, that one" into a small essay, and
                            // an empty one filed anyway is a field that taught nobody anything.
                            // The snoozes still ask, because WHY something is fine is the part
                            // worth keeping — and it is the part somebody will want back.
                            if (verdict === 'flagged') {
                              // Every rule, both ways: flagging wrote one decision per rule
                              // that raised the tile, so unflagging that took back only the
                              // first would leave the rest standing and the tile flagged.
                              for (const r of rules) {
                                if (flagged) onUndecide(finding.key, r.id)
                                else onDecide(finding.key, r.id, verdict, '')
                              }
                              setSaying(null)
                              return
                            }
                            setSaying(on ? null : { at, verdict })
                            setReason('')
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--secondary)]"
                          /* **The mark IS the state.** A separate `FLAGGED` chip said the same
                             thing twice and put a second thing in the header, which is the one
                             row that has to stay a heading. A filled flag is the convention and
                             it is already the control you press to change it. */
                          style={{
                            color:
                              verdict === 'flagged' && flagged
                                ? 'var(--accent)'
                                : on
                                  ? 'var(--foreground)'
                                  : 'var(--muted-foreground)',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                            {verdict === 'flagged' ? (
                              <>
                                <path
                                  d="M3.5 1.5V12.5"
                                  stroke="currentColor"
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                />
                                {/* Filled once it is flagged, hollow until then — the same
                                    shape either way, so the row does not move. */}
                                <path
                                  d="M3.5 2.4h6.6l-1.5 2.4 1.5 2.4H3.5z"
                                  fill={flagged ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="1.1"
                                  strokeLinejoin="round"
                                />
                              </>
                            ) : (
                              <>
                                <circle
                                  cx="7"
                                  cy="7.4"
                                  r="4.8"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                />
                                <path
                                  d="M7 4.6v3l1.9 1.2"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                {/* Struck through: the same clock, and never again. */}
                                {verdict === 'fine-always' && (
                                  <path
                                    d="M2.4 12.4L11.9 2.2"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinecap="round"
                                  />
                                )}
                              </>
                            )}
                          </svg>
                        </button>
                      )
                    })}
                  </div>

                  {saying?.at === at && (
                    <div className="pb-3 pl-4 pr-4">
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
                            // being decided about. The store stays per-rule underneath, so a
                            // rule that flags this LATER brings it back — which is the
                            // behaviour you want and could not get from one coarse record.
                            for (const r of rules) {
                              onDecide(finding.key, r.id, saying.verdict, reason.trim())
                            }
                            setSaying(null)
                          }
                        }}
                        placeholder={
                          saying.verdict === 'flagged'
                            ? 'what needs doing? (⏎ to file, blank is allowed)'
                            : 'why is this fine? (⏎ to file, blank is allowed)'
                        }
                        spellCheck={false}
                        className="w-full rounded border border-[var(--border)] bg-transparent px-2 py-1 text-[11.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
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
              <div className="mt-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--muted-foreground)]">
                {setAside > 0 && <p>{setAside.toLocaleString()} ignored.</p>}
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
