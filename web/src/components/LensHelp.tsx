import { useEffect, type ReactNode } from 'react'
import { Overlay } from './Overlay'

/**
 * The lens reference: eleven rows, each with its own key beside it.
 *
 * **`docs/lenses.md` is the source and this is the lens half of it.** The prose is edited there
 * because it is prose; this file is what puts swatches next to it, and a swatch is the half that
 * cannot live in Markdown. Where both carry a sentence, the Markdown is right.
 *
 * **In the switcher's order, which is the order somebody will look them up in.** It was the
 * source document's grouping — every scale, then every count, then the marks — which reads well
 * as a document and badly as a lookup: you arrive knowing the name you saw in the pulldown, and
 * hunting for it in a different sequence is the one thing a reference must not make you do. The
 * kinds still cluster, because the switcher is itself ordered by kind.
 *
 * **Only the lenses, and no section furniture.** The document also covers the drawing, the
 * passes, the controls and the status readouts; carrying those here made the panel long enough
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
    <div className="h-4 w-full rounded-[2px]" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
  )
}

/** A row of flat colors — four bands, three mark states, or the head of a categorical palette.
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
        {values && (
          <p className="mono mt-1 text-[9px]">
            <span className="not-italic text-[var(--foreground)]">Values </span>
            {values}
          </p>
        )}
        {ramp && (
          <p className="mono text-[9px]">
            <span className="text-[var(--foreground)]">Ramp </span>
            {ramp}
          </p>
        )}
        {children && <div className="mt-1.5">{children}</div>}
      </div>
    </div>
  )
}

/* ── The panel ───────────────────────────────────────────────────────────── */

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
            What each lens measures, the values it prints, and what has to have run before it can
            answer. Width is always lines of code; the lens sets color and nothing else.
          </p>
        </header>

        {/* Inline `code` is scoped here rather than styled globally: this is the only surface
            that sets a value in running prose, and a global rule would reach the code view,
            which has its own type. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [overscroll-behavior:contain] [&_code]:rounded-[2px] [&_code]:bg-[var(--secondary)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[9px] [&_code]:text-[var(--foreground)]">
          <Lens
            name="Surprise"
            needs="Read"
            swatch={<Ramp from="var(--heat-0)" to="var(--heat-4)" />}
            measures="how much of a function's body the reader failed to predict from its surroundings, before being allowed to read the body itself."
            values="mundane · typical · quirky · obscure"
            ramp="mundane (dim) → obscure (bright)"
          >
            The reader sees the documentation before it predicts. A comment that genuinely
            explains the code lowers the score. A comment a model could reproduce from the body
            alone does not.
          </Lens>
          <Lens
            name="Legibility"
            needs="Read"
            swatch={<Ramp from="var(--legible-0)" to="var(--legible-4)" />}
            measures="the reader's assessment of the body after reading it."
            values="clean · nuanced · tangled · unclear"
            ramp="clean (dim) → unclear (bright)"
          >
            Independent of Surprise. Code can be unpredictable and clearly written.
          </Lens>
          <Lens
            name="Docs"
            needs="Read"
            swatch={<Ramp from="var(--docs-0)" to="var(--docs-4)" />}
            measures="how much of the body the documentation covers, displayed as the gap."
            values="full · decent · some · none"
            ramp="covered (dim) → undocumented (bright)"
          >
            Documentation a model could reproduce from the body alone is graded{' '}
            <code>none</code>.
          </Lens>
          <Lens
            name="Traps"
            needs="Read"
            swatch={<Steps fills={['var(--trap)', 'var(--structure)', 'var(--unanalyzed)']} />}
            measures="whether a reader flagged something likely to catch out the next person editing this code."
            values="trap · no trap reported · not read yet"
          >
            <code>no trap reported</code> means a reader looked and found nothing.{' '}
            <code>not read yet</code> means no reader has looked. The two are different neutrals
            and can be told apart on the map. A clean wedge is not proof that no trap exists.
          </Lens>
          <Lens
            name="Clones"
            needs="Scan"
            swatch={<Steps fills={['var(--clone)', 'var(--structure)', 'var(--unanalyzed)']} />}
            measures="functions whose bodies are identical once identifiers and literals are flattened and comments dropped."
            values="a clone · no clone in this repo · too small to compare"
          >
            Every clone draws the same color regardless of how many copies exist. The size of the
            group appears in the label as <code>1 of N clones</code> and in the sidebar
            breakdown, not in the color.
            <br />
            A near-copy differing by one statement is not detected. Bodies below the token floor
            are never compared and are reported separately from finding no clone.
          </Lens>
          <Lens
            name="Callers"
            needs="call syntax"
            swatch={
              <Steps
                fills={[
                  'var(--callers-0)',
                  'var(--callers-1)',
                  'var(--callers-2)',
                  'var(--callers-4)',
                ]}
              />
            }
            measures="call sites within this repository."
            values="no in-repo caller · 1 · 2–5 · 6+"
          >
            Calls from outside the repository are not counted. Entry points and public APIs
            appear uncalled.
          </Lens>
          <Lens
            name="Reach"
            needs="call syntax"
            swatch={
              <Steps
                fills={['var(--reach-0)', 'var(--reach-1)', 'var(--reach-2)', 'var(--reach-4)']}
              />
            }
            measures="in-repo functions this one calls."
            values="none · 1 · 2–5 · 6+"
          />
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
            This is last modification, not authorship. A formatting change across many files
            makes its author the recorded value for all of them.
            <br />
            How many authors get their own color is set by the <B>colors</B> control. The legend
            names the top 16. Below that there are two different remainders:
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>
                <code>N more · shades repeat</code> — authors who still have a color, recycled
                from the unnamed part of the palette. Counted without a swatch because there is
                no single color to show.
              </li>
              <li>
                <code>other (N)</code> — authors with no rank at all, either past the color cap
                or unranked. Drawn in the structural neutral.
              </li>
            </ul>
            Uncommitted lines and untracked files are shown as themselves.
          </Lens>
          <Lens
            name="Language"
            needs="Scan"
            swatch={
              <Steps fills={['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']} />
            }
            measures="the file's language, by extension."
          >
            Useful for locating language boundaries, which often do not follow directory names.
            <br />
            <code>.h</code> is mapped to C++ unconditionally, so C headers report as C++.
          </Lens>
          <Lens
            name="Churn"
            needs="Trace"
            swatch={<Ramp from="var(--churn-0)" to="var(--churn-4)" />}
            measures="for a function, the number of distinct commits its current lines come from. For a file, the number of commits in the last 90 days."
            values="no commits found · 1–2 · 3–9 · 10+"
            ramp="settled (dim) → churning (bright)"
          >
            Functions and files are measuring different quantities. The tooltip states which one
            applies.
          </Lens>
          <Lens
            name="Age"
            needs="Trace"
            swatch={<Ramp from="var(--age-0)" to="var(--age-4)" />}
            measures="days since the most recent commit to touch the code."
            values="older · this quarter · this month · this week · today"
            ramp="old (dim) → recent (bright)"
          />
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
