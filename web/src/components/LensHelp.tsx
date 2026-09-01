import { Fragment, useEffect, type ReactNode } from 'react'
import { Overlay } from './Overlay'
import { MODE_LABEL, type ColorMode } from '../lib/colorMode'

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
        {children && <div className="mt-1.5">{children}</div>}
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
      Every clone draws the same color regardless of how many copies exist. The size of the group
      appears in the label as <code>1 of N clones</code> and in the sidebar breakdown, not in the
      color.
      <br />A near-copy differing by one statement is not detected. Bodies below the token floor are
      never compared and are reported separately from finding no clone.
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
      measures="the author of the most recently changed line."
    >
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
      The legend orders by commits over the whole repo and the panel by lines in what you have open,
      so on a big repo they name the same people in a different order.
      <br />
      Uncommitted lines and untracked files are shown as themselves.
    </Lens>
  ),
  language: (
    <Lens
      name="Language"
      needs="Scan"
      swatch={<Steps fills={['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']} />}
      measures="the file's language, by extension."
    >
      Useful for locating language boundaries, which often do not follow directory names.
      <br />
      <code>.h</code> is mapped to C++ unconditionally, so C headers report as C++.
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
      values="as expected · slightly above · above normal · far above normal"
      ramp="as expected (dim) → far above normal (bright)"
    >
      Three sequential <code>if</code>s cost three; three nested cost six. A forty-case switch costs
      one — it is long and utterly predictable, which is the reading that separates this from a
      branch count.
      <br />
      Weighted against the other bodies its size in this repo, because a longer function is
      naturally more complicated and the useful question is whether it is more complicated than
      that. The other setting is the raw count, against 15. Needs no reader and no git, so it paints
      the moment a scan lands — and it is independent of Surprise, which is the point: what is
      knotty and what is unpredictable are different findings.
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

  return (
    <Overlay onClose={onClose}>
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-4">
          <h2 className="text-sm font-semibold">Lenses</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            The map is a project's structure: directories, files, functions. A wedge's width is its
            share of the <B>lines of code</B>. The lens sets color and nothing else, and non-code is
            not drawn.
          </p>
        </header>

        {/* Inline `code` is scoped here rather than styled globally: this is the only surface
            that sets a value in running prose, and a global rule would reach the code view,
            which has its own type. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [overscroll-behavior:contain] [&_code]:rounded-[2px] [&_code]:bg-[var(--secondary)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[9px] [&_code]:text-[var(--foreground)]">
          {LENS_ORDER.map((m) => (
            <Fragment key={m}>{ENTRIES[m]}</Fragment>
          ))}
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
