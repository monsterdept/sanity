/** The findings list: one tile per thing to look at, and what can be done about each.
 *
 *  A tile is an address, a sentence per rule that raised it, the lenses that found it and
 *  the four verdicts. The footer under the list says what the list cannot: what was set
 *  aside, and what could not be asked. */
import type { RefObject } from 'react'
import type { Hit, Verdict } from '../../lib/api'
import type { FindingItem, blockedByNeed } from '../../lib/findings'
import { address, dirFor, fileOf, lensColor, lensName, lensRule, nameOf } from './format'

/** Which row has its reason field open, and under which verdict — see `saying` in `Findings`. */
export type Saying = { at: string; verdict: Verdict } | null

/** What a tile's reason field and verdict marks need from the panel: which one is open, and
 *  the two ways a decision leaves it. */
interface Deciding {
  saying: Saying
  setSaying: (s: Saying) => void
  reason: string
  setReason: (r: string) => void
  onDecide: (key: string, rule: string, verdict: Verdict, reason: string) => void
  onUndecide: (key: string, rule: string) => void
}

/** The findings view: one tile per subject, and the footer that says what the list cannot. */
export function FindingsList({
  items,
  column,
  colW,
  introduces,
  choose,
  setAside,
  blocked,
  ruleCount,
  ...deciding
}: Deciding & {
  items: FindingItem[]
  column: RefObject<HTMLDivElement | null>
  colW: number
  introduces: Map<string, string>
  choose: (hit: Hit) => void
  setAside: number
  blocked: ReturnType<typeof blockedByNeed>
  /** How many rules the catalog answered with, for the footer's `N of M`. */
  ruleCount: number
}) {
  return (
    <>
      {/* The one measured element: `p-4` inside, and a tile's own `px-4` inside that. */}
      <div ref={column} className="h-0" />
      {items.length === 0 && (
        <p className="py-1 text-[11px] text-[var(--muted-foreground)]">
          {setAside > 0
            ? `Nothing standing. ${setAside.toLocaleString()} matches ignored.`
            : 'Nothing in this repo matches the rules.'}
        </p>
      )}
      {items.map((item) => (
        <FindingTile
          key={item.finding.key}
          item={item}
          colW={colW}
          introduces={introduces}
          choose={choose}
          {...deciding}
        />
      ))}
      {/* The footer says what the list cannot: what was dealt with, and what could not
          be asked at all. Never omitted when non-empty — a short list with a silent
          reason reads as a clean bill. */}
      {(setAside > 0 || blocked.length > 0) && (
        <div className="mt-2 border-t border-[var(--border)] pt-3 text-[10px] text-[var(--muted-foreground)]">
          {/* Matches, not findings: counted once per rule, where the list above merges a
              subject's rules into one tile — and not the drawer's count either, which
              holds every decision, including ones that no longer match anything. */}
          {setAside > 0 && <p>{setAside.toLocaleString()} matches ignored.</p>}
          {blocked.map((b) => (
            <p key={b.need} title={`${b.whys.join('; ')}\n\n${b.rules.join('\n')}`}>
              {b.rules.length} of {ruleCount} rules inactive ({b.need})
            </p>
          ))}
        </div>
      )}
    </>
  )
}

/** One thing to look at: its address, what each rule says about it, and what to do with it. */
function FindingTile({
  item: { finding, rules, says, stale, flagged },
  colW,
  introduces,
  choose,
  ...deciding
}: Deciding & {
  item: FindingItem
  colW: number
  introduces: Map<string, string>
  choose: (hit: Hit) => void
}) {
  const at = finding.key
  const lenses = [...new Set(rules.flatMap((r) => r.lenses))]
  return (
    <div
      className="relative mb-4 overflow-hidden rounded-xl border border-[var(--border)] last:mb-0"
      style={{ background: 'color-mix(in oklch, var(--foreground) 3%, transparent)' }}
    >
      {/* **Ruled off.** With nothing under it the address read as the first line of
          the prose rather than as the tile's title — the size and weight said
          heading and the layout said paragraph. */}
      <div className="flex items-start gap-2 px-4 pb-2.5 pl-4 pt-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TileAddress hit={finding.hit} colW={colW} onChoose={choose} />
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

      <TileSays at={at} rules={rules} says={says} stale={stale} introduces={introduces} />

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
        <LensChips lenses={lenses} />
        {VERDICTS.map(([verdict, label, hint]) => (
          <VerdictButton
            key={verdict}
            at={at}
            rules={rules}
            flagged={flagged}
            verdict={verdict}
            label={label}
            hint={hint}
            {...deciding}
          />
        ))}
      </div>

      {deciding.saying?.at === at && <ReasonField at={at} rules={rules} {...deciding} />}
    </div>
  )
}

/** A tile's heading: the address of what it found, which is also the way to go there. */
function TileAddress({
  hit,
  colW,
  onChoose,
}: {
  hit: Hit
  colW: number
  onChoose: (hit: Hit) => void
}) {
  /* **The address, not a name and an icon.** `src/lib/history.ts` for a
      file and `src/lib/history.ts#frameTree` for a function — one format,
      which says what kind of thing it is by having a `#` or not, and which
      is the string somebody would type to go there. The glyphs it replaces
      said the same thing in a symbol nobody had been taught.

      The directory is muted so the eye lands on the file and the function,
      and it is shortened from the MIDDLE — see `dirFor`. */
  return (
    <button
      type="button"
      onClick={() => onChoose(hit)}
      title={address(hit)}
      className="mono flex w-full min-w-0 flex-wrap items-baseline text-left"
    >
      {/* **One line, shortened from the MIDDLE, and CSS cannot do it.**
          Both ends of a path carry something: the head says which corner of
          the repo this is, the tail says which of the forty `src/` folders.
          `text-overflow` only ever eats one end, and the two attempts before
          this both ate the wrong one — `dir="rtl"` reordered the slashes so
          `src-tauri/src/` rendered as `/src-tauri/src`, and `text-align:
          right` did nothing at all, because a nowrap line that outgrows its
          box overflows to the RIGHT whatever its alignment. That one carried
          a comment claiming it clipped from the left for months, while every
          screenshot of it showed the head surviving and the filename gone.

          An ellipsis in the MIDDLE means counting characters, and only the
          layout knows how many fit — hence the measured column and the
          monospace advance. Monospace is what makes it a division rather
          than a search: every glyph is the same width.

          Shrink-0, so the line WRAPS before the path is cut: flex shrinks an
          item before it wraps, and a shrinkable directory would be shortened
          to keep the file beside it rather than giving the file its own
          roomy line. Everything on one line whenever everything fits. */}
      <span className="shrink-0 whitespace-nowrap text-[15px] text-[var(--muted-foreground)]">
        {dirFor(hit, colW)}
      </span>
      {/* The file is still where-it-IS: same size as the name so they read
          as one heading, lighter so the name is the thing being named. On a
          file finding there is no name and this carries the full weight. */}
      {/* **The file and the function are one item, and the FILE is what gives
          way inside it.** They were two items, and two items can be split:
          `run_cli.ts#` at the end of a line with `runHeapSnapshotAnalyzerCli`
          alone on the next puts a break through the middle of one identity.
          One item cannot be split, so the pair travels to the second line
          together.

          When even that line is too narrow, the file clips and the function
          does not — `shrink-0` on the name, `min-w-0` and hidden overflow on
          the file. A function is the most specific thing the address names
          and the last thing worth losing; the file it sits in is recoverable
          from the directory above it, and the whole address is on `title`. */}
      <span className="flex min-w-0 max-w-full items-baseline text-[15px]">
        <span
          className="min-w-0 overflow-hidden whitespace-nowrap"
          style={{
            fontWeight: hit.kind === 'func' ? 400 : 600,
            color:
              hit.kind === 'func'
                ? 'color-mix(in oklch, var(--foreground) 72%, transparent)'
                : 'var(--foreground)',
          }}
        >
          {fileOf(hit)}
        </span>
        <span
          className="shrink-0 whitespace-nowrap font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          {nameOf(hit)}
        </span>
      </span>
    </button>
  )
}

/** What each rule that raised a tile says about it, each under its own name. */
function TileSays({
  at,
  rules,
  says,
  stale,
  introduces,
}: {
  at: string
  rules: FindingItem['rules']
  says: FindingItem['says']
  stale: FindingItem['stale']
  introduces: Map<string, string>
}) {
  /* **Each rule says its piece under its own name.**
      One joined paragraph made a reader hold three claims and then map them
      onto three tags at the bottom, in order, from memory. Paired, the tag is
      the sentence's attribution and the reading is local: this is what Surprising
      and changing found, and this is what Tangled found.

      `rules` and `says` are pushed in lockstep when the tile is merged, so
      index `i` is the same rule in both. */
  return (
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
            {stale[i] && (
              <span
                title="The reading this rests on is of code that has changed since. Read it again to bring it current."
                className="ml-2 rounded px-1.5 py-[1px] align-[1px] text-[9px] font-normal uppercase"
                style={{
                  letterSpacing: '0.1em',
                  background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
                  color: 'var(--muted-foreground)',
                }}
              >
                stale
              </span>
            )}
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
                <strong key={j} className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  {run.text}
                </strong>
              ) : (
                <span key={j}>{run.text}</span>
              ),
            )}
            {/* **The lesson, once, and in the same breath.** It is the tail of
                one paragraph and not a second one: the sentences were written to
                be read together, and giving the background its own block — its
                own face, its own dimming — turned a paragraph into a finding
                with a footnote. Every later tile this rule raises just stops
                after the measurement, which is what a paragraph does anyway.

                A leading space rather than a joined string, so the two halves
                stay two nodes and nothing has to decide what punctuation goes
                between them. */}
            {introduces.get(r.id) === at && <span> {r.background}</span>}
          </p>
        </div>
      ))}
    </div>
  )
}

/** The lenses that found a tile, as chips in their own colours. */
function LensChips({ lenses }: { lenses: string[] }) {
  return (
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
          <i className="block h-[5px] w-[5px] rounded-full" style={{ background: lensColor(id) }} />
          {lensName(id)}
        </span>
      ))}
    </div>
  )
}

/** The four verdicts a tile offers, as `[verdict, label, hint]`, in the order they sit. */
const VERDICTS: [Verdict, string, string][] = [
  ['flagged', 'Flag for action', 'Stays in the list, marked'],
  ['fine-for-now', 'Fine as it stands', 'Hidden until this code changes'],
  ['fine-always', 'Always fine', 'Hidden whatever this code does'],
  // **Two ways to hide something forever, because two different things
  // are wrong.** `Always fine` is about the code — this file has 116
  // functions and nobody minds. This is about the RULE, and it is the
  // one verdict that says the tool made a claim that was not true. It
  // comes back the moment the rule asks a different question.
  ['false-positive', 'Not true', 'The finding is wrong. Back if the rule changes'],
]

/** One verdict mark on a tile: a flag that files at once, or a snooze that asks why. */
function VerdictButton({
  at,
  rules,
  flagged,
  verdict,
  label,
  hint,
  saying,
  setSaying,
  setReason,
  onDecide,
  onUndecide,
}: Deciding & {
  at: string
  rules: FindingItem['rules']
  flagged: boolean
  verdict: Verdict
  label: string
  hint: string
}) {
  const on = saying?.at === at && saying.verdict === verdict
  return (
    <button
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
            if (flagged) onUndecide(at, r.id)
            else onDecide(at, r.id, verdict, '')
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
      <VerdictIcon verdict={verdict} flagged={flagged} />
    </button>
  )
}

/** A verdict's mark: a flag, a clock, or the same clock struck through. */
function VerdictIcon({ verdict, flagged }: { verdict: Verdict; flagged: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {verdict === 'flagged' ? (
        <>
          <path d="M3.5 1.5V12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
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
          <circle cx="7" cy="7.4" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.3" />
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
  )
}

/** The reason box under a tile, open while a verdict is waiting to be filed. */
function ReasonField({
  at,
  rules,
  saying,
  setSaying,
  reason,
  setReason,
  onDecide,
}: Deciding & { at: string; rules: FindingItem['rules'] }) {
  if (!saying) return null
  return (
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
              onDecide(at, r.id, saying.verdict, reason.trim())
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
  )
}
