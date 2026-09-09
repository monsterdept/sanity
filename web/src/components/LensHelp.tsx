import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Tabs } from './Tabs'
import { Overlay } from './Overlay'
import { MODE_LABEL, type ColorMode } from '../lib/colorMode'
import { languages, type LangSupport } from '../lib/api'

/**
 * The lens reference: one row per lens, each with its own key beside it, in the menu's order.
 *
 * **There is nothing upstream of this file.** The prose and the swatches live together here, so
 * a sentence is edited here and a claim here is the claim the reader gets. This header used to
 * name a Markdown source that overrode it on any sentence they both carried; there is no such
 * document, and a reference implementation that is not in the repo is a place for the two to
 * disagree unobserved.
 *
 * **In the switcher's order, which is the order somebody will look them up in.** It was grouped
 * by kind once — every scale, then every count, then the marks — which reads well as a document
 * and badly as a lookup: you arrive knowing the name you saw in the pulldown, and
 * hunting for it in a different sequence is the one thing a reference must not make you do. The
 * kinds still cluster, because the switcher is itself ordered by kind.
 *
 * **Only the lenses, and no section furniture.** The drawing, the passes, the controls and the
 * status readouts all want explaining too, and carrying them here made the panel long enough
 * that the entry somebody opened it for was below the fold. What is left is a lookup. The kinds
 * are not labelled because the swatch says which — a ramp, four steps, or a set of chips — and a
 * heading that repeats what the picture already shows is a row of nothing between the reader and
 * the next entry.
 *
 * Every swatch references the map's own custom properties rather than copying their values, so a
 * ramp edited in `index.css` changes here in the same commit.
 */

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-[var(--foreground)]">{children}</b>
}

function Ramp({ from, to }: { from: string; to: string }) {
  return (
    <div
      className="h-4 w-full rounded-[2px]"
      style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
    />
  )
}

/** A row of flat colors — four bands, three mark states, or the head of a categorical palette.
 *
 *  **The notable end goes LAST, which is the direction every other row in this panel reads.**
 *  Surprise runs mundane to obscure, Docs covered to undocumented, Callers none to 6+, Age old
 *  to recent — dim first, loud last, in the swatch and in the `values` line beside it. The two
 *  mark lenses were built the other way round and were the only rows that were, so a reader
 *  comparing Traps with the row above it had to notice that one of them had turned around.
 *  Reverse a swatch here and reverse its `values` in the same edit: the words sit next to the
 *  colors and are read against them.
 *
 *  **The mark lenses use this too, and label nothing.** They carried a legend, a swatch and a
 *  word per state, and were the only rows in the panel that did: every ramp shows two hundred
 *  colors and names none of them, so the two that named three read as a different kind of entry
 *  rather than a different kind of lens. The words are still on the `values` line, which is
 *  where every other row keeps them. */
function Steps({ fills }: { fills: string[] }) {
  return (
    <div className="flex w-full gap-[3px]">
      {fills.map((f) => (
        <span key={f} className="h-4 flex-1 rounded-[2px]" style={{ background: f }} />
      ))}
    </div>
  )
}

/** One lens: its key on the left, its definition on the right. */
function Lens({
  name,
  swatch,
  measures,
  values,
  ramp,
  needs,
  children,
}: {
  name: string
  swatch: ReactNode
  measures: ReactNode
  values?: string
  ramp?: string
  needs: string
  children?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-x-4 gap-y-2 border-t border-[var(--border)] py-3 first:border-t-0">
      <div className="flex flex-col gap-1.5 pt-[3px]">
        {swatch}
        <span className="text-[12px] font-semibold leading-none">{name}</span>
        <span className="mono text-[9px] text-[var(--muted-foreground)]">needs {needs}</span>
      </div>
      <div className="text-[10px] leading-relaxed text-[var(--muted-foreground)]">
        <p>
          <B>Measures</B> {measures}
        </p>
        {/* **A colon, and the label carries the weight `Measures` does.** These two were
            separated from their content by brightness alone, in the same mono face at the same
            size — so "Values" read as the first item of its own list, and the row above it was
            the only one whose label looked like one.

            Not pills, and `Ramp` is why. Whatever marks a label here has to work for both
            rows, and `Ramp` is a sentence — "mundane (dim) → obscure (bright)" — not a set. A
            treatment that chips the values would make two rows of the same kind look like two
            different kinds, which is the mistake `Steps` records the mark lenses making with
            their own legend. A colon is the one mark that reads the same over a list and over
            a sentence. */}
        {values && (
          <p className="mono mt-1 text-[9px]">
            <span className="font-semibold not-italic text-[var(--foreground)]">Values:</span>{' '}
            {values}
          </p>
        )}
        {ramp && (
          <p className="mono text-[9px]">
            <span className="font-semibold text-[var(--foreground)]">Ramp:</span> {ramp}
          </p>
        )}
        {/* **A gap between paragraphs, because `<br />` was doing the splitting.** A line
            break is not a paragraph break: the second thought started hard against the bottom
            of the first and the two read as one run-on. The rule is here rather than on each
            entry so a note written later cannot forget it. */}
        {children && <div className="mt-1.5 [&>*+*]:mt-1.5">{children}</div>}
      </div>
    </div>
  )
}

/* ── The panel ───────────────────────────────────────────────────────────── */

/** Every lens, keyed by the mode it explains.
 *
 *  **A record rather than a run of JSX, because the order is not this file's to hold.** These
 *  were written out in sequence and the sequence drifted twice — once when Complexity was added
 *  to the end of the list and the top of the menu, and again when Churn and Age traded rows.
 *  Both times the help opened on a different order from the switcher it explains, and nothing
 *  could catch it: a list of paragraphs in the wrong order is a list of paragraphs.
 *
 *  Rendered in `MODE_LABEL`'s order, which is the menu's, so the two cannot disagree. A lens
 *  added without an entry here is a hole `Record<ColorMode, …>` refuses to compile. */
const ENTRIES: Record<ColorMode, ReactNode> = {
  surprise: (
    <Lens
      name="Surprise"
      needs="Read"
      swatch={<Ramp from="var(--heat-0)" to="var(--heat-4)" />}
      measures="how much of a function's body the reader failed to predict from its surroundings, before being allowed to read the body itself."
      values="mundane · typical · quirky · obscure"
      ramp="mundane (dim) → obscure (bright)"
    >
      The reader sees the documentation before it predicts. A comment that genuinely explains the
      code lowers the score. A comment a model could reproduce from the body alone does not.
    </Lens>
  ),
  legible: (
    <Lens
      name="Legibility"
      needs="Read"
      swatch={<Ramp from="var(--legible-0)" to="var(--legible-4)" />}
      measures="what reading the body was like, by what the reader actually did: understood it in one pass, required several passes, or never got it at all."
      values="clean · nuanced · tangled · unclear"
      ramp="clean (dim) → unclear (bright)"
    >
      Independent of Surprise. Code can be unpredictable and clearly written.
    </Lens>
  ),
  docs: (
    <Lens
      name="Docs"
      needs="Read"
      swatch={<Ramp from="var(--docs-0)" to="var(--docs-4)" />}
      measures="how little of the body its documentation covers."
      values="full · decent · some · none"
      ramp="covered (dim) → undocumented (bright)"
    >
      Documentation a model could reproduce from the body alone is graded <code>none</code>.
    </Lens>
  ),
  composition: (
    <Lens
      name="Composition"
      needs="Scan"
      swatch={
        <Steps
          fills={[
            'var(--unanalyzed)',
            'var(--cat-3)',
            'var(--cat-6)',
            'var(--cat-1)',
            'var(--cat-2)',
            'var(--cat-5)',
          ]}
        />
      }
      measures="what this repo is made of: code somebody here wrote, headers, tests, generated code, and vendored code."
      values="code · header · test · generated · vendored"
    >
      Code has a colour of its own — grey here means only that nothing could place a file,
      the way it does on every other lens. What stands out against code is what you are not on
      the hook for.
      A generator's own <code>DO NOT EDIT</code> banner and a <code>linguist-vendored</code>
      line in <code>.gitattributes</code> are declarations and are read as such; a path like{' '}
      <code>vendor/</code> is a convention, and the wedge says which it leaned on.{' '}
      <code>code</code> is what is left when none of the others claimed it — so a language
      with no way to tell a test apart still reads as code, which it is, rather than as
      nothing.
    </Lens>
  ),
  traps: (
    <Lens
      name="Traps"
      needs="Read"
      swatch={<Steps fills={['var(--unanalyzed)', 'var(--structure)', 'var(--trap)']} />}
      measures="whether a reader flagged something likely to catch out the next person editing this code."
      values="not read yet · no trap reported · trap"
    >
      A wedge marked <code>no trap reported</code> means a reader looked and found nothing, where{' '}
      <code>not read yet</code> means no reader has looked. The two are different neutrals and can
      be told apart on the map. A clean wedge is not proof that no trap exists.
    </Lens>
  ),
  clones: (
    <Lens
      name="Clones"
      needs="Scan"
      swatch={<Steps fills={['var(--unanalyzed)', 'var(--structure)', 'var(--clone)']} />}
      measures="functions whose bodies are identical once identifiers and literals are flattened and comments dropped."
      values="too small to compare · no clone in this repo · a clone"
    >
      <p>
        Every clone draws the same color regardless of how many copies exist. The size of the group
        appears in the label as <code>1 of N clones</code> and in the sidebar breakdown, not in the
        color.
      </p>
      <p>
        A near-copy differing by one statement is not detected. Bodies below the token floor are
        never compared and are reported separately from finding no clone.
      </p>
    </Lens>
  ),
  callers: (
    <Lens
      name="Callers"
      needs="call syntax"
      swatch={
        <Steps
          fills={['var(--callers-0)', 'var(--callers-1)', 'var(--callers-2)', 'var(--callers-4)']}
        />
      }
      measures="call sites within this repository: the number of locations elsewhere in the repo where the body is called."
      values="no in-repo caller · 1 · 2–5 · 6+"
    >
      Calls from outside the repository are not counted. Entry points and public APIs appear
      uncalled.
    </Lens>
  ),
  reach: (
    <Lens
      name="Reach"
      needs="call syntax"
      swatch={
        <Steps fills={['var(--reach-0)', 'var(--reach-1)', 'var(--reach-2)', 'var(--reach-4)']} />
      }
      measures="in-repo functions this one calls: the number of functions defined elsewhere in the repo that are called by the body."
      values="none · 1 · 2–5 · 6+"
    />
  ),
  blame: (
    <Lens
      name="Blame"
      needs="Trace"
      swatch={
        <Steps
          fills={['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)', 'var(--cat-5)']}
        />
      }
      measures="who a wedge belongs to, in one of two ways — see the reading below."
      values="newest line · most lines"
    >
      <p>
        <B>Neither reading is authorship, and the lens is not called Author for that reason.</B>{' '}
        Blame records who touched each line <em>last</em>, so a body rewritten wholesale reads as
        new and everyone whose lines were replaced is gone — not diminished, gone. Both readings
        come from one list: every line, with the name of whoever last touched it.
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>
          <code>newest line</code> — the newest line's name. A timestamp with a name on it, and
          what this lens has always painted.
        </li>
        <li>
          <code>most lines</code> — whose lines most of the body <em>is</em>. A different question
          and often a different answer: a typo fix in a 400-line function makes somebody its last
          toucher while they hold one line of it.
        </li>
      </ul>
      <p>
        There is a third reduction of the same list — how many people's lines are standing — and it
        is not here, because it is a count and this lens paints names. It is a findings rule field
        instead, <code>headcount</code>.
      </p>
      How many authors get their own color is set by the <B>colors</B> control. The legend names the
      top 16. Below that there are two different remainders:
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>
          <code>N more · shades repeat</code> — authors who still have a color, recycled from the
          unnamed part of the palette. Counted without a swatch because there is no single color to
          show.
        </li>
        <li>
          <code>other (N)</code> — authors with no rank at all, either past the color cap or
          unranked. Drawn in the structural neutral.
        </li>
      </ul>
      <p>
        The legend orders by commits over the whole repo and the panel by lines in what you have
        open, so on a big repo they name the same people in a different order.
      </p>
      <p>Uncommitted lines and untracked files are shown as themselves.</p>
    </Lens>
  ),
  language: (
    <Lens
      name="Language"
      needs="Scan"
      swatch={<Steps fills={['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']} />}
      measures="the file's language, by extension."
    >
      <p>Useful for locating language boundaries, which often do not follow directory names.</p>
      <p>
        <code>.h</code> is mapped to C++ unconditionally, so C headers report as C++.
      </p>
    </Lens>
  ),
  churn: (
    <Lens
      name="Churn"
      needs="Trace"
      swatch={<Ramp from="var(--churn-0)" to="var(--churn-4)" />}
      measures="for a function, the number of distinct commits its current lines come from. For a file, the number of commits in the last 90 days."
      values="no commits found · 1–2 · 3–9 · 10+"
      ramp="settled (dim) → churning (bright)"
    >
      Functions and files are measuring different quantities. The tooltip states which one applies.
    </Lens>
  ),
  tangle: (
    <Lens
      name="Complexity"
      needs="Scan"
      swatch={<Ramp from="var(--tangle-0)" to="var(--tangle-4)" />}
      measures="how tangled a body is: every fork costs one, plus one for each fork it is nested inside."
      values="low · moderate · high · very high"
      ramp="low (dim) → very high (bright)"
    >
      <p>
        Three sequential <code>if</code>s cost three; three nested cost six. A forty-case switch
        costs one — long and utterly predictable, which is what separates this from a branch
        count.
      </p>
      <p>
        Weighted against the other bodies its size in this repo, because a longer function is
        naturally more complicated and the useful question is whether it is more so than that.
      </p>
    </Lens>
  ),
  age: (
    <Lens
      name="Age"
      needs="Trace"
      swatch={<Ramp from="var(--age-0)" to="var(--age-4)" />}
      measures="days since the newest line here was written — or, on the other setting, since the oldest line here was."
      values="older · this quarter · this month · this week · today"
      ramp="old (dim) → recent (bright)"
    >
      Two dates, one ramp, and the switch beside the lens says which. The newest line is where work
      has been happening; the oldest is what has been standing here a long while. On code rewritten
      last week out of lines from 2014 they disagree by a decade, and the second is the one that
      finds what nobody has been near. Lines, not code: a wholesale rewrite leaves nothing behind
      saying when the code was first written.
    </Lens>
  ),
}

/** The menu's order, which is the only order this modal may use. */
const LENS_ORDER = Object.keys(MODE_LABEL) as ColorMode[]

/** What this build can read, as a sheet.
 *
 *  **Three lenses go grey for three different reasons and the map cannot tell them apart.** A
 *  wedge with no callers looks exactly like a language whose calls were never parsed; a body
 *  that never branches looks exactly like one whose branch kinds nobody has written. The
 *  literal node-kind matching exists to make those loud in a TEST — `conventions.md` says so —
 *  and it was silent in the window, so the only way to know which absence you were looking at
 *  was to read `parse.rs`.
 *
 *  Asked once and kept: it is a fact about the build, not about the repo that is open.
 *
 *  The columns are three claims and not one at three strengths, which is why they are three
 *  columns and not a rating. Reading a language means finding its functions, which is what the
 *  map is drawn from and what every language here can do; the other two are what the lenses
 *  built on them need. */
function Languages() {
  const [langs, setLangs] = useState<LangSupport[] | null>(null)
  useEffect(() => {
    let live = true
    void languages()
      .then((l) => live && setLangs(l))
      // A sheet that cannot load says so rather than staying blank forever: an empty list here
      // would read as "this build reads nothing", which is a claim.
      .catch(() => live && setLangs([]))
    return () => {
      live = false
    }
  }, [])

  if (langs === null) return <p className="px-5 py-3 text-[11px] text-[var(--muted-foreground)]">reading the grammar list…</p>
  if (langs.length === 0) {
    return (
      <p className="px-5 py-3 text-[11px] text-[var(--muted-foreground)]">
        The grammar list could not be read. That is this window failing, not a repo — nothing
        about what the parser supports has changed.
      </p>
    )
  }
  const calls = langs.filter((l) => l.calls).length
  const branches = langs.filter((l) => l.branches).length
  const tick = (on: boolean) => (
    <span
      aria-label={on ? 'yes' : 'no'}
      style={{ color: on ? 'var(--foreground)' : 'var(--muted-foreground)' }}
    >
      {on ? '\u2713' : '\u2014'}
    </span>
  )
  return (
    <div className="px-5 py-3">
      <p className="mb-3 text-[11px] leading-[1.5] text-[var(--muted-foreground)]">
        {langs.length} languages, of which {calls} have their calls followed off the grammar and{' '}
        {branches} have their branches counted. Where a column is blank the lens built on it
        paints grey and says so — that is a gap in this parser, not a finding about your code.
      </p>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
            <th className="border-b border-[var(--border)] pb-1 font-semibold">Language</th>
            <th className="border-b border-[var(--border)] pb-1 font-semibold">Extensions</th>
            {/* Named for the LENS each column decides, because that is the question somebody
                arrives with — "why is Callers grey here" — rather than for the machinery. */}
            <th className="border-b border-[var(--border)] pb-1 text-center font-semibold">
              Callers · Reach
            </th>
            <th className="border-b border-[var(--border)] pb-1 text-center font-semibold">
              Complexity
            </th>
          </tr>
        </thead>
        <tbody>
          {langs.map((l) => (
            <tr key={l.name} className="align-top">
              <td className="whitespace-nowrap py-[3px] pr-3">{l.name}</td>
              <td className="mono py-[3px] pr-3 text-[10px] text-[var(--muted-foreground)]">
                {l.extensions.map((e) => `.${e}`).join(' ')}
              </td>
              <td className="py-[3px] text-center">{tick(l.calls)}</td>
              <td className="py-[3px] text-center">{tick(l.branches)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LensHelp({ onClose }: { onClose: () => void }) {
  // Escape closes. Handled here rather than in `lib/keys.ts` because that decides what a key
  // means for the MAP; a modal owns its own keyboard while it is up, the rule `Find` follows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const [tab, setTab] = useState<'lenses' | 'languages'>('lenses')

  return (
    <Overlay onClose={onClose}>
      <div
        className="flex max-h-[74vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-4">
          {/* One control, shared with the findings panel — see `Tabs`, which carries the
              argument for the track and for centring it. */}
          <Tabs
            className="mx-auto"
            at={tab}
            onPick={setTab}
            tabs={[
              { k: 'lenses', word: 'Lenses' },
              { k: 'languages', word: 'Languages' },
            ]}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            {tab === 'lenses' ? (
              <>
                The map is a project's structure: directories, files, functions. A wedge's width
                is its share of the <B>lines of code</B>. The lens sets color and nothing else,
                and non-code is not drawn.
              </>
            ) : (
              <>
                Every language this build has a grammar for, and what it can do with each. A lens
                paints grey where its column is blank — that is this parser's limit, and it is
                not a finding about the code.
              </>
            )}
          </p>
        </header>

        {/* Inline `code` is scoped here rather than styled globally: this is the only surface
            that sets a value in running prose, and a global rule would reach the code view,
            which has its own type. */}
        <div className="min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] [&_code]:rounded-[2px] [&_code]:bg-[var(--secondary)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[9px] [&_code]:text-[var(--foreground)]">
          {tab === 'lenses' ? (
            <div className="px-5 py-3">
              {LENS_ORDER.map((m) => (
                <Fragment key={m}>{ENTRIES[m]}</Fragment>
              ))}
            </div>
          ) : (
            <Languages />
          )}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90"
          >
            Done
          </button>
        </footer>
      </div>
    </Overlay>
  )
}

/**
 * The way in, beside the lens switcher.
 *
 * Next to the switcher rather than off with the window chrome, because what it explains is the
 * switcher. A help button parked in a corner is one nobody presses at the moment they need it.
 */
export function HelpButton({ on, onOpen }: { on: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Lens reference"
      title="Lens reference"
      className="flex items-center rounded-full px-2 py-[3px] transition-colors"
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {/* Drawn, not a glyph, and sized to the pills' line box — see `FindButton`. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M6.1 6.1a1.95 1.95 0 1 1 2.3 2.5v1"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8.4" cy="11.6" r="0.85" fill="currentColor" />
      </svg>
    </button>
  )
}
