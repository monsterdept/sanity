import { useEffect } from 'react'
import { Overlay } from './Overlay'

/**
 * What the colors mean, in the app's own words.
 *
 * **Every lens here has a vocabulary that cannot be guessed.** `mundane / typical / quirky /
 * obscure` is not `clean / nuanced / tangled / unclear`, `traces to 4 commits` is a different
 * quantity from `27 commits in 90d`, and "too small to compare" is deliberately not "no clone
 * in this repo". Those distinctions are the whole reason to trust the map, and until now the
 * only way to learn them was to hover everything.
 *
 * The swatches are the map's own custom properties rather than copies of their values, so a
 * ramp that moves in `index.css` moves here in the same commit — a key that can disagree with
 * the picture is worse than no key.
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
          <h2 className="text-sm font-semibold">What the colors mean</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted-foreground)]">
            One drawing, eleven questions. The shape never changes — every wedge is as wide as
            the code it holds — so switching lenses asks a different question of the same
            picture, and a wedge you noticed under one is in the same place under the next.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [overscroll-behavior:contain]">
          {/* The three facts that hold whatever lens is on. */}
          <div className="mb-4 grid gap-2 rounded-md bg-[var(--secondary)] p-3 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
            <p>
              <b className="text-[var(--foreground)]">Width is always lines.</b> No lens moves a
              wedge, in any view.
            </p>
            <p>
              <b className="text-[var(--foreground)]">Gray is not zero.</b> It means nobody has
              measured this. Every reading here says “undecided” when it runs out of evidence
              rather than filling the gap with a number.
            </p>
            <p>
              <b className="text-[var(--foreground)]">A folder has no reading of its own.</b> Its
              band is the distribution of what is inside it, so a directory that is half ancient
              and half rewritten last week reads as two colors rather than as neither.
            </p>
            <p>
              <b className="text-[var(--foreground)]">Counts are in lines; totals are in
              whatever unit exists.</b> A breakdown row is weighted in lines, because that is
              what a wedge’s width means. Alongside it you will see functions where the code has
              been read into functions, and files where it has not — the same population,
              counted in the finest unit available.
            </p>
          </div>

          <Group title="Five scales — a wedge sits somewhere along a ramp">
            <Lens
              name="Surprise"
              hint="what a reader didn’t see coming"
              words="mundane · typical · quirky · obscure — how much of the body a reader failed to predict before it was allowed to look. Absence: not measured yet."
            >
              <Ramp from="var(--heat-0)" to="var(--heat-4)" ends={['mundane', 'obscure']} />
            </Lens>
            <Lens
              name="Legibility"
              hint="what reading it was actually like"
              words="clean · nuanced · tangled · unclear — graded after the body was read. Obscure but clean is a new idea well expressed; obscure and unclear is where to start."
            >
              <Ramp from="var(--legible-0)" to="var(--legible-4)" ends={['clean', 'unclear']} />
            </Lens>
            <Lens
              name="Docs"
              hint="what nobody has explained"
              words="full · decent · some · none — shown as the GAP, so bright is unexplained. A doc a model could regenerate from the body counts as none, and a doc whose code moved on reads hot."
            >
              <Ramp from="var(--docs-0)" to="var(--docs-4)" ends={['covered', 'undocumented']} />
            </Lens>
            <Lens
              name="Churn"
              hint="how much it has changed lately"
              words="10+ commits · 3–9 · 1–2 · no commits found. On a function this is the commits its surviving lines trace back to; on a file it is commits in the last 90 days. The tooltip says which."
            >
              <Ramp from="var(--churn-0)" to="var(--churn-4)" ends={['settled', 'churning']} />
            </Lens>
            <Lens
              name="Age"
              hint="how long since anyone touched it"
              words="today · this week · this month · this quarter · older. Bright is recent. Absence: history not read."
            >
              <Ramp from="var(--age-0)" to="var(--age-4)" ends={['old', 'recent']} />
            </Lens>
          </Group>

          <Group title="Two counts — the same edge, read from both ends">
            <Lens
              name="Callers"
              hint="how many things call it"
              words="6+ callers · 2–5 · 1 · no in-repo caller. In-repo only: an entry point or something called from outside reads as uncalled, which is not a claim it is dead."
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
              hint="how much it calls out to"
              words="calls 6+ · 2–5 · 1 · none. High reach is orchestration, low reach is a leaf. Absence: calls not resolved here — this language’s call shape is not read."
            >
              <Swatches
                fills={['var(--reach-0)', 'var(--reach-1)', 'var(--reach-2)', 'var(--reach-4)']}
                ends={['none', '6+']}
              />
            </Lens>
          </Group>

          <Group title="Two marks — a thing is either there or it is not">
            <Lens
              name="Traps"
              hint="what will bite whoever edits it next"
              words="A dot, not a shade: there is no such thing as a partial trap. Everything else is “no trap reported”, which is not the same as “safe”."
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: 'var(--trap)' }}
                />
                <span className="mono text-[9px] text-[var(--muted-foreground)]">a trap</span>
              </div>
            </Lens>
            <Lens
              name="Clones"
              hint="what is a clone of something else"
              words="6+ clones · 3–5 · 2 · no clone in this repo · too small to compare. The last is its own answer: a four-line body was never compared, and calling it unique would be a claim nobody checked."
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

          <Group title="Two names — a category, with no order to imply">
            <Lens
              name="Blame"
              hint="who committed to it last"
              words="A color per person, biggest first, and the count is yours to set — a few plus a gray “other” is the major contributors; all of them is confetti, which is the right answer to “how crowded is this”. LAST committer, not owner: a formatting sweep makes its author the last toucher of everything it brushed."
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
              hint="what it is written in"
              words="The same palette over a different question. Good for finding where a repo’s language boundaries actually fall, which is often not where the directory names suggest."
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

          <Group title="Before a lens can answer">
            <div className="grid gap-1.5 py-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">
              <p>
                <b className="text-[var(--foreground)]">Surprise · Legibility · Docs · Traps</b> —
                need a reading. Press Read on the project.
              </p>
              <p>
                <b className="text-[var(--foreground)]">Blame · Churn · Age</b> — need the
                repository’s history read. Press Trace.
              </p>
              <p>
                <b className="text-[var(--foreground)]">Callers · Reach</b> — need this language’s
                call shape, which exists for some grammars and not others.
              </p>
              <p>
                <b className="text-[var(--foreground)]">Language · Clones</b> — need nothing
                beyond the scan.
              </p>
              <p className="mt-1">
                A lens with nothing in it is locked and says what would open it, rather than
                drawing an empty map — showing unread code as blank is the one thing this
                instrument is built not to do.
              </p>
            </div>
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
