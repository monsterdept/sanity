import { useEffect } from 'react'
import { Overlay } from './Overlay'

/**
 * Reference for the eleven lenses: what each one measures, and the values it prints.
 *
 * **Its job is definition, not persuasion.** Every lens has a vocabulary that cannot be
 * inferred from the map — `mundane / typical / quirky / obscure` is not the same scale as
 * `clean / nuanced / tangled / unclear`, `traces to 4 commits` is a different quantity from
 * `27 commits in 90d`, and "too small to compare" is deliberately distinct from "no clone in
 * this repo". Those distinctions are what makes a reading trustworthy, and they were only
 * discoverable by hovering.
 *
 * **Ordered by what a reader needs first.** Which passes unlock which lenses comes before the
 * lenses themselves: on a repository that has only been scanned, seven of the eleven are
 * locked, and knowing why is more useful than knowing what the locked ones would have shown.
 *
 * Swatches reference the map's own custom properties rather than copying their values, so a
 * ramp edited in `index.css` changes here in the same commit.
 */

/** One lens's key, drawn the way that lens draws itself. */
function Ramp({ from, to, ends }: { from: string; to: string; ends: [string, string] }) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="h-4 rounded-[2px]"
        style={{ background: `linear-gradient(90deg, ${from}, ${to})` }}
      />
      <div className="mono flex justify-between text-[9px] text-[var(--muted-foreground)]">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}

function Swatches({ fills, ends }: { fills: string[]; ends: [string, string] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-[3px]">
        {fills.map((f) => (
          <span key={f} className="h-4 flex-1 rounded-[2px]" style={{ background: f }} />
        ))}
      </div>
      <div className="mono flex justify-between text-[9px] text-[var(--muted-foreground)]">
        <span>{ends[0]}</span>
        <span>{ends[1]}</span>
      </div>
    </div>
  )
}

function Lens({
  name,
  hint,
  children,
  words,
}: {
  name: string
  hint: string
  /** The key — a ramp, a row of bands, or a mark. */
  children: React.ReactNode
  /** The exact words this lens prints, which is what somebody came here for. */
  words: string
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-x-3 gap-y-1 py-2">
      <div className="pt-[2px]">{children}</div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold">{name}</span>
          <span className="mono text-[10px] text-[var(--muted-foreground)]">{hint}</span>
        </div>
        <p className="mono mt-0.5 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
          {words}
        </p>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h3 className="border-b border-[var(--border)] pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
        {title}
      </h3>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </section>
  )
}

export function LensHelp({ onClose }: { onClose: () => void }) {
  // Escape closes, the same as the finder's. Handled here rather than in `lib/keys.ts`
  // because that decides what a key means for the MAP; a modal owns its own keyboard while
  // it is up, which is the rule `Find` already follows on its field.
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
        className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-4">
          <h2 className="text-sm font-semibold">Lenses</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            One drawing, eleven measurements. A wedge is always as wide as the code it holds;
            the lens sets its color and nothing else.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [overscroll-behavior:contain]">
          <Group title="What unlocks each lens">
            <div className="grid gap-2 py-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              <p>
                Three passes produce everything the map can show. A lens with no data behind it
                is locked and names the pass that would fill it.
              </p>
              <dl className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1.5">
                <dt className="text-[var(--foreground)]">Scan</dt>
                <dd>
                  Parses the repository into files and functions. Runs when a project is
                  opened. Unlocks <b className="font-semibold">Language</b> and{' '}
                  <b className="font-semibold">Clones</b>.
                </dd>
                <dt className="text-[var(--foreground)]">Trace</dt>
                <dd>
                  Reads the commit log, and per-line history where asked for it. Unlocks{' '}
                  <b className="font-semibold">Blame</b>, <b className="font-semibold">Churn</b>{' '}
                  and <b className="font-semibold">Age</b>.
                </dd>
                <dt className="text-[var(--foreground)]">Read</dt>
                <dd>
                  Agents read each function and file a report. Unlocks{' '}
                  <b className="font-semibold">Surprise</b>,{' '}
                  <b className="font-semibold">Legibility</b>,{' '}
                  <b className="font-semibold">Docs</b> and <b className="font-semibold">Traps</b>.
                </dd>
                <dt className="text-[var(--foreground)]">—</dt>
                <dd>
                  <b className="font-semibold">Callers</b> and{' '}
                  <b className="font-semibold">Reach</b> require the language&rsquo;s call
                  syntax, which is implemented for some grammars and not others. No pass
                  unlocks them.
                </dd>
              </dl>
            </div>
          </Group>

          <Group title="Reading the map">
            <div className="grid gap-1.5 py-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              <p>
                <b className="text-[var(--foreground)]">Width is lines of code, in every
                lens.</b>{' '}
                Switching lens changes color only, so a wedge stays in the same place at the
                same size.
              </p>
              <p>
                <b className="text-[var(--foreground)]">Gray means not measured</b>, never
                zero. Each measurement returns no value rather than a default when it has
                insufficient evidence.
              </p>
              <p>
                <b className="text-[var(--foreground)]">A directory has no value of its own.</b>{' '}
                Its band shows the distribution of the values inside it, so a directory
                containing both old and new code shows both rather than an average.
              </p>
              <p>
                <b className="text-[var(--foreground)]">Totals are in lines; counts are in the
                finest unit available</b>{' '}
                — functions where the code has been parsed into functions, files where it has
                not.
              </p>
              <p>
                <b className="text-[var(--foreground)]">A reading expires when its code
                changes.</b>{' '}
                Surprise, Legibility, Docs and Traps show a stale wedge as unmeasured rather
                than keeping a grade taken against a body that has since moved.
              </p>
            </div>
          </Group>

          <Group title="Scales — a value along a ramp">
            <Lens
              name="Surprise"
              hint="predictability"
              words="How much of a function's body a reader failed to predict from its surroundings, before being allowed to read it. Values: mundane · typical · quirky · obscure. Documentation reaches the reader before it predicts, so an explanation that helps lowers the score; one a model could reproduce from the body does not."
            >
              <Ramp from="var(--heat-0)" to="var(--heat-4)" ends={['mundane', 'obscure']} />
            </Lens>
            <Lens
              name="Legibility"
              hint="reading difficulty"
              words="The reader's assessment of the body after reading it. Values: clean · nuanced · tangled · unclear. Independent of Surprise: code can be unpredictable and clearly written."
            >
              <Ramp from="var(--legible-0)" to="var(--legible-4)" ends={['clean', 'unclear']} />
            </Lens>
            <Lens
              name="Docs"
              hint="documentation coverage"
              words="How much of the body the documentation covers, displayed as the gap — bright is undocumented. Values: full · decent · some · none. Documentation a model could reproduce from the body alone is graded none."
            >
              <Ramp from="var(--docs-0)" to="var(--docs-4)" ends={['covered', 'undocumented']} />
            </Lens>
            <Lens
              name="Churn"
              hint="commits behind the code"
              words="For a function, the number of distinct commits its current lines come from. For a file, commits in the last 90 days. These are different quantities and the tooltip states which. Values: 10+ commits · 3–9 · 1–2 · no commits found."
            >
              <Ramp from="var(--churn-0)" to="var(--churn-4)" ends={['settled', 'churning']} />
            </Lens>
            <Lens
              name="Age"
              hint="time since last change"
              words="Days since the most recent commit to touch the code. Values: today · this week · this month · this quarter · older. Brightest is most recent."
            >
              <Ramp from="var(--age-0)" to="var(--age-4)" ends={['old', 'recent']} />
            </Lens>
          </Group>

          <Group title="Counts — four steps, one edge from each end">
            <Lens
              name="Callers"
              hint="incoming calls"
              words="Call sites within this repository. Values: no in-repo caller · 1 · 2–5 · 6+. Calls from outside the repository are not counted, so entry points and public APIs appear uncalled."
            >
              <Swatches
                fills={[
                  'var(--callers-0)',
                  'var(--callers-1)',
                  'var(--callers-2)',
                  'var(--callers-4)',
                ]}
                ends={['none', '6+']}
              />
            </Lens>
            <Lens
              name="Reach"
              hint="outgoing calls"
              words="In-repo functions this one calls, in the same four steps. Where the language's call syntax is not implemented, the lens reports that rather than reporting zero."
            >
              <Swatches
                fills={['var(--reach-0)', 'var(--reach-1)', 'var(--reach-2)', 'var(--reach-4)']}
                ends={['none', '6+']}
              />
            </Lens>
          </Group>

          <Group title="Marks — present or absent, not graded">
            <Lens
              name="Traps"
              hint="reported hazards"
              words="A reader flagged something likely to catch out the next person editing this code. Marked rather than graded: there is no partial value. An unmarked wedge means no trap was reported, which is not the same as none existing."
            >
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ background: 'var(--trap)' }} />
                <span className="mono text-[9px] text-[var(--muted-foreground)]">a trap</span>
              </div>
            </Lens>
            <Lens
              name="Clones"
              hint="duplicated bodies"
              words="Functions whose bodies are identical once identifiers and literals are flattened and comments dropped. Values: 2 clones · 3–5 · 6+ · no clone in this repo · too small to compare. A near-copy differing by one statement is not detected. Bodies below the token floor are never compared, reported separately from finding no clone."
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[2px]" style={{ background: 'var(--clone)' }} />
                  <span className="mono text-[9px] text-[var(--muted-foreground)]">a clone</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-[2px]"
                    style={{ background: 'var(--unanalyzed)' }}
                  />
                  <span className="mono text-[9px] text-[var(--muted-foreground)]">too small</span>
                </div>
              </div>
            </Lens>
          </Group>

          <Group title="Categories — a name, with no order implied">
            <Lens
              name="Blame"
              hint="last committer"
              words="The author of the most recently changed line. This is last modification, not authorship: a formatting change across many files makes its author the recorded value for all of them. Colors are assigned by size, largest first; how many get one is set by the colors control and the remainder are grouped as “other”. Uncommitted lines and untracked files are shown as themselves."
            >
              <div className="flex gap-[3px]">
                {['--cat-1', '--cat-2', '--cat-3', '--cat-4', '--cat-5'].map((c) => (
                  <span
                    key={c}
                    className="h-4 flex-1 rounded-[2px]"
                    style={{ background: `var(${c})` }}
                  />
                ))}
              </div>
            </Lens>
            <Lens
              name="Language"
              hint="source language"
              words="The file's language, determined by extension. Colors assigned the same way as Blame. Useful for locating language boundaries, which often do not follow directory names."
            >
              <div className="flex gap-[3px]">
                {['--cat-1', '--cat-2', '--cat-3', '--cat-4'].map((c) => (
                  <span
                    key={c}
                    className="h-4 flex-1 rounded-[2px]"
                    style={{ background: `var(${c})` }}
                  />
                ))}
              </div>
            </Lens>
          </Group>
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
 * Next to the switcher rather than off in the corner with the window chrome, because what it
 * explains is the switcher: eleven questions whose vocabularies are the reason to trust any
 * of them. A help button parked away from the thing it is about is a help button nobody
 * presses at the moment they need it.
 */
export function HelpButton({ on, onOpen }: { on: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="What the colors mean"
      title="What the colors mean"
      className="flex items-center rounded-full px-2 py-[3px] transition-colors"
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {/* Drawn, not a glyph, and sized to the pills' line box — the argument `FindButton`
          makes at length, and the reason this row's controls all stand the same height. */}
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
