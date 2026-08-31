import { useEffect, type ReactNode } from 'react'
import { Overlay } from './Overlay'

/**
 * The lens reference, in the panel.
 *
 * **Its source is `docs/lenses.md` and the two are kept in step by hand.** The prose is edited
 * there because it is prose; this file is what puts swatches next to it, and a swatch is the
 * half that cannot live in Markdown. If they drift, the Markdown is the one that is right.
 *
 * Every swatch references the map's own custom properties rather than copying their values, so
 * a ramp edited in `index.css` changes here in the same commit. A key that can disagree with
 * the picture it explains is worse than no key.
 */

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function Group({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="flex items-baseline gap-2 border-b border-[var(--border)] pb-1">
        <span className="mono text-[10px] text-[var(--muted-foreground)]">{n}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wider">{title}</span>
      </h3>
      {children}
    </section>
  )
}

/** A two-column rule table — the shape most of this document is. */
function Rules({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 border-collapse text-[10px] leading-relaxed">
      {rows.map(([k, v]) => (
        <div key={k} className="col-span-2 grid grid-cols-subgrid border-t border-[var(--border)] py-1.5 first:border-t-0">
          <dt className="font-semibold text-[var(--foreground)]">{k}</dt>
          <dd className="text-[var(--muted-foreground)]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[10px] leading-relaxed text-[var(--muted-foreground)]">{children}</p>
}

function B({ children }: { children: ReactNode }) {
  return <b className="font-semibold text-[var(--foreground)]">{children}</b>
}

function Ramp({ from, to }: { from: string; to: string }) {
  return (
    <div className="h-4 w-full rounded-[2px]" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
  )
}

function Steps({ fills }: { fills: string[] }) {
  return (
    <div className="flex w-full gap-[3px]">
      {fills.map((f) => (
        <span key={f} className="h-4 flex-1 rounded-[2px]" style={{ background: f }} />
      ))}
    </div>
  )
}

function Chip({ fill, label }: { fill: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-3 w-3 shrink-0 rounded-[2px]" style={{ background: fill }} />
      <span className="mono text-[9px] text-[var(--muted-foreground)]">{label}</span>
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
            <span className="not-italic text-[var(--foreground)]">values </span>
            {values}
          </p>
        )}
        {ramp && (
          <p className="mono text-[9px]">
            <span className="text-[var(--foreground)]">ramp </span>
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
        className="flex max-h-[86vh] w-full max-w-3xl flex-col rounded-xl border border-[var(--border)] bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-[var(--border)] px-5 pb-3 pt-4">
          <h2 className="text-sm font-semibold">Lenses</h2>
        </header>

        {/* Inline `code` is scoped here rather than styled globally: this is the only surface
            that sets a value in running prose, and a global rule would reach the code view,
            which has its own type. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 [overscroll-behavior:contain] [&_code]:rounded-[2px] [&_code]:bg-[var(--secondary)] [&_code]:px-1 [&_code]:py-px [&_code]:font-mono [&_code]:text-[9px] [&_code]:text-[var(--foreground)]">
          <Group n={1} title="The drawing">
            <Note>
              The map is a sunburst of the repository. The center is the project root; each ring
              out is one level deeper in the directory tree. A wedge is a directory, a file, or a
              function.
            </Note>
            <Rules
              rows={[
                ['Width', 'Lines of code. Identical in every lens.'],
                ['Color', 'Set by the lens. Nothing else changes when you switch lenses.'],
                ['Gray', 'Not measured. Not zero.'],
                [
                  'Directories',
                  "No value of their own. A directory's band shows the distribution of values inside it, so a directory holding both old and new code shows both rather than an average.",
                ],
                [
                  'Ramps',
                  'Run dim to bright. The sidebar breakdown runs the other way, loudest first, so the two orders are deliberately opposite.',
                ],
                ['Totals', 'In lines.'],
                [
                  'Sidebar asides',
                  <>
                    Lens-dependent. Churn shows <code>N commits</code>, Callers{' '}
                    <code>N callers</code> (or <code>calls N</code> where it has none), Reach the
                    mirror of that, Clones <code>1 of N</code> or <code>unique</code>. Every other
                    lens shows <code>N lines</code>.
                  </>,
                ],
              ]}
            />
            <Note>
              <B>Stale readings.</B> Surprise, Legibility, Docs and Traps come from a reader
              looking at a specific body of code. When that body changes, the reading is discarded
              and the wedge shows as unmeasured rather than carrying a grade forward onto changed
              code.
            </Note>
            <Note>
              A function's hash covers its own documentation, its body, and the file header.
              Editing the module header expires every reading in that file. Changing a sibling
              function does not. Whitespace is split out before hashing, so reformatting the
              repository does not expire anything.
            </Note>
          </Group>

          <Group n={2} title="Passes">
            <Note>
              Three passes produce the data. A lens with no data behind it is locked and names the
              pass that would fill it.
            </Note>
            <Rules
              rows={[
                [
                  'Scan',
                  <>
                    Parses the repository into files and functions. Runs when a project is opened.
                    Unlocks <B>Language</B> and <B>Clones</B>.
                  </>,
                ],
                [
                  'Trace',
                  <>
                    Reads the commit log, plus per-line history where a lens needs it. Unlocks{' '}
                    <B>Blame</B>, <B>Churn</B> and <B>Age</B>.
                  </>,
                ],
                [
                  'Read',
                  <>
                    Agents read each function and file a report. Unlocks <B>Surprise</B>,{' '}
                    <B>Legibility</B>, <B>Docs</B> and <B>Traps</B>.
                  </>,
                ],
              ]}
            />
            <Note>
              <B>Callers</B> and <B>Reach</B> are not unlocked by a pass. They need the language's
              call syntax, which is implemented for most grammars but not all. Where it is
              missing, the lens says so rather than reporting zero.
            </Note>
            <Note>
              <B>Files without an extension are not scanned at all.</B> <code>Makefile</code>,{' '}
              <code>justfile</code> and <code>Dockerfile</code> are absent from the map rather than
              drawn uncolored, and they are not in any total. There is no shebang detection.
            </Note>
          </Group>

          <Group n={3} title="Lenses at a glance">
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="text-left text-[var(--muted-foreground)]">
                    {['Lens', 'Kind', 'Measures', 'Needs'].map((h) => (
                      <th key={h} className="border-b border-[var(--border)] pb-1 pr-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-[var(--muted-foreground)]">
                  {(
                    [
                      ['Surprise', 'Scale', 'Predictability', 'Read'],
                      ['Legibility', 'Scale', 'Reading difficulty', 'Read'],
                      ['Docs', 'Scale', 'Documentation coverage', 'Read'],
                      ['Churn', 'Scale', 'Commits behind the code', 'Trace'],
                      ['Age', 'Scale', 'Time since last change', 'Trace'],
                      ['Callers', 'Count', 'Incoming calls', 'Call syntax'],
                      ['Reach', 'Count', 'Outgoing calls', 'Call syntax'],
                      ['Traps', 'Mark', 'Reported hazards', 'Read'],
                      ['Clones', 'Mark', 'Duplicated bodies', 'Scan'],
                      ['Blame', 'Category', 'Last committer', 'Trace'],
                      ['Language', 'Category', 'Source language', 'Scan'],
                    ] as const
                  ).map(([lens, kind, measures, needs]) => (
                    <tr key={lens} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-1 pr-3 font-semibold text-[var(--foreground)]">{lens}</td>
                      <td className="py-1 pr-3">{kind}</td>
                      <td className="py-1 pr-3">{measures}</td>
                      <td className="py-1">{needs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Note>
              <B>Scales</B> place a value along a ramp. <B>Counts</B> use four steps. <B>Marks</B>{' '}
              are present or absent. <B>Categories</B> are names with no order; colors are assigned
              by size, largest first.
            </Note>
          </Group>

          <Group n={4} title="Scales">
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
          </Group>

          <Group n={5} title="Counts">
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
          </Group>

          <Group n={6} title="Marks">
            <Note>
              A mark is present or absent — there is no partial value and no ramp. Containers are
              never tinted under a mark lens. A mark inside a directory is drawn as a dot on that
              directory's ring.
            </Note>
            <Lens
              name="Traps"
              needs="Read"
              swatch={
                <div className="flex flex-col gap-1">
                  <Chip fill="var(--trap)" label="trap" />
                  <Chip fill="var(--structure)" label="none found" />
                  <Chip fill="var(--unanalyzed)" label="not read" />
                </div>
              }
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
              swatch={
                <div className="flex flex-col gap-1">
                  <Chip fill="var(--clone)" label="a clone" />
                  <Chip fill="var(--structure)" label="no clone" />
                  <Chip fill="var(--unanalyzed)" label="too small" />
                </div>
              }
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
          </Group>

          <Group n={7} title="Categories">
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
          </Group>

          <Group n={8} title="Controls">
            <Rules
              rows={[
                [
                  'Lens',
                  'Picks the measurement that sets color. Locked lenses name the pass that would unlock them.',
                ],
                [
                  'Colors',
                  'Blame and Language only. Sets how many categories get their own color before the rest are grouped.',
                ],
                ['Rings', 'How many levels deep the sunburst draws from the current root.'],
                [
                  'Band',
                  'How much of each directory wedge is given over to the distribution band showing the values inside it. At 0% the band is at its minimum width, a few pixels; it is never off.',
                ],
                ['Up', 'Moves the root one level toward the repository root.'],
                ['Search', 'Finds a file or function by name.'],
              ]}
            />
            <h4 className="mt-4 text-[11px] font-semibold">History</h4>
            <Note>Replays the repository's commits in order, redrawing the map at each step.</Note>
            <Note>
              <B>Age and Churn become relative to the playhead</B> rather than to today, so a
              function committed the day before the frame you are looking at reads as recent.
            </Note>
            <Note>
              The speed control sets how long the whole visible story takes in wall-clock seconds,
              not how fast individual commits pass:
            </Note>
            <div className="mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--muted-foreground)]">
              {[
                ['0.3x', '100s'],
                ['1x', '30s'],
                ['3x', '10s'],
                ['5x', '6s'],
                ['10x', '3s'],
              ].map(([label, wall]) => (
                <span key={label}>
                  <span className="text-[var(--foreground)]">{label}</span> {wall}
                </span>
              ))}
            </div>
            <Note>
              The story is the commits <B>in the current scope</B>. Drill into a directory and 1x
              is still 30 seconds, now spent on that directory's history alone.
            </Note>
            <Note>
              The <B>bolt</B> toggles whether the commit under the playhead flashes what it
              touched. The <B>camera</B> exports the replay as a movie.
            </Note>
          </Group>

          <Group n={9} title="Status readouts">
            <Rules
              rows={[
                [
                  'too thin',
                  'Wedges narrower than one pixel at their own ring’s radius, so they are culled. Moves with both window size and ring count. They are still in every total.',
                ],
                ['stale', 'Readings discarded because their code changed. See 1.'],
                ['unread', 'Functions or files no reader has looked at yet.'],
              ]}
            />
            <Note>
              A breakdown header reading <code>N of M</code> means the bucket holds M, of which
              M − N cannot be listed because the window has not fetched the file ring they live in.
            </Note>
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
