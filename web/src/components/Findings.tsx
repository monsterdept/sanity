import { useEffect, useRef, useState } from 'react'
import type {
  Decision,
  FieldView,
  Grammar,
  Hit,
  FindingGroup,
  RuleEdit,
  RuleView,
  Spread,
  Verdict,
} from '../lib/api'
import { MODE_LABEL, modeToken, type ColorMode } from '../lib/colorMode'
import {
  blockedByNeed,
  introductions,
  mergeFindings,
  rowsCapped,
  setAsideCount,
} from '../lib/findings'
import { middleTruncate, monoAdvance } from '../lib/label'
import { BalanceSheet } from './BalanceSheet'
import { Tabs } from './Tabs'

/** The colour of one lens, for a swatch beside the finding it helped raise.
 *
 *  **`modeToken` and nothing else**, so a swatch is the same hue as the wedges that lens
 *  paints — a private table here would be a second vocabulary for one set of colours, which
 *  is how the legend and the map came to disagree about a language's name. `size` is the one
 *  id that is not a lens: width is how the map draws lines, and it gets the neutral. */
/** A threshold as a person reads it: whole where it is whole, two places where it is not.
 *
 *  A grade's bar is `0.7` and a line count's is `339`, and the same formatter has to carry
 *  both without printing `339.00` or rounding a grade to `1`. */
function trim(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2)
}

/** One count as a share of another, at the precision the number deserves.
 *
 *  **Never `0%`.** A rule with two hits out of four thousand is at 0.05%, and rounding that to
 *  a whole number prints a share of nothing over a count of two — two numbers on one row
 *  contradicting each other. Under a tenth it says `<0.1%` instead, which is the honest
 *  version of a number too small to write.
 *
 *  No decimals above ten, where they are noise: `40%` is the fact and `39.7%` is a claim
 *  about a precision this does not have, since which functions count as subjects is itself a
 *  judgement (see `not_ours`). */
function share(n: number, of: number): string {
  const pct = (n / of) * 100
  if (n > 0 && pct < 0.1) return '<0.1%'
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`
}

/** What a lens is called, in the words the lens switcher uses.
 *
 *  `MODE_LABEL` rather than a table here, for the same reason `lensColor` defers to
 *  `modeToken`: one name per lens, in one place. */
export function lensName(id: string): string {
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
export function dirOf(path: string): string {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? '' : path.slice(0, cut + 1)
}

/** The directory, shortened from the middle only when a line of its own cannot hold it.
 *
 *  **Two cases, because the address takes one line or two.** If the whole of it fits, nothing
 *  is cut. If it does not, the file and its function wrap to a second line — so the directory
 *  is then alone on the first, with the WHOLE line to spend, and is cut only if it overruns
 *  that.
 *
 *  Subtracting the file and the function from the budget in every case was the first version
 *  and it is wrong in exactly the case that matters: `qa/standalone/scrub/` came out as
 *  `qa/st…rub/` on a line with four fifths of it empty, because the arithmetic was still
 *  reserving room for a file that had already moved to the line below. The layout decides
 *  which line things are on; this has to ask the same question the layout asks.
 *
 *  Where even a full line leaves too little to be worth reading, `middleTruncate` returns
 *  nothing rather than a stub — `x…e/` narrows nothing and still costs a line.
 *
 *  Falls back to the untouched path before the column has been measured: one frame of an
 *  overlong address beats a frame of nothing.
 */
function dirFor(hit: Hit, colW: number): string {
  const dir = dirOf(hit.path)
  if (colW <= 0) return dir
  // The tile's own padding, which the measured element sits outside of.
  const fits = Math.floor((colW - 32) / (ADDRESS_PX * monoAdvance()))
  // One line for all three: nothing is cut.
  if (dir.length + fileOf(hit).length + nameOf(hit).length <= fits) return dir
  // Two lines, and this one is the directory's alone.
  return dir.length <= fits ? dir : middleTruncate(dir, fits)
}

/** The size the address is set at, which the character count has to agree with. */
const ADDRESS_PX = 15

/** The file, with its `#` where a function follows. Never truncated.
 *
 *  Separate from the function name so the two can carry different weight: on a function finding
 *  the file is still where-it-is, and the NAME is what the tile is about. Three tiers in all —
 *  directory, file, name — each a step nearer the subject. */
export function fileOf(hit: Hit): string {
  const cut = hit.path.lastIndexOf('/')
  const base = cut === -1 ? hit.path : hit.path.slice(cut + 1)
  return hit.kind === 'func' ? `${base}#` : base
}

/** The function, where there is one. Empty on a file finding, whose title is its filename. */
export function nameOf(hit: Hit): string {
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
/** The colour a field's pill wears in an expression.
 *
 *  **Coloured means a lens; neutral means not one, and there is only one neutral.** `size` and
 *  `read` are both non-lenses — width is how the map draws lines rather than a colour, and an
 *  absence of readings is not a lens either — but they reached the pill by two code paths and
 *  came out slightly different shades. A difference that small reads as a distinction the
 *  reader then goes looking for, and there is none to find.
 *
 *  `--structure` was tried for `read`, on the argument that it is what every reading lens
 *  paints on an unread wedge. It is a pale warm grey meant to be a large quiet area on a map,
 *  and at pill size tinted to 16% it vanished. */
function fieldColor(id: string | null): string {
  return id === null ? 'var(--muted-foreground)' : lensColor(id)
}

export function lensColor(id: string): string {
  // **Membership checked, not assumed.** `modeToken` walks a `Record<ColorMode, …>`, so an id
  // the frontend has never heard of comes back as `--undefined-3` — a var that resolves to
  // nothing, drawing an invisible swatch rather than failing. That is the quiet-wrong-colour
  // failure this whole app is written against, and the guard costs one lookup.
  if (id !== 'size' && id in MODE_LABEL) return `var(${modeToken(id as ColorMode)})`
  return 'var(--muted-foreground)'
}

/** A rule being written, before it is a rule.
 *
 *  **Values are strings, and stay strings until save.** A number input bound to a `number`
 *  cannot hold "0." or an empty box, so a field typed through zero either snaps back or
 *  becomes `NaN` — and `NaN` sent as a threshold is a rule that matches nothing, silently.
 *  The parse happens once, at the edge, where a bad number can still be refused out loud. */
interface Draft {
  /** Empty for a rule being created — the backend mints the id from the title, once. */
  id: string
  title: string
  soWhat: string
  says: string
  pop: 'func' | 'file'
  clauses: { field: string; op: string; value: string }[]
  calibrated: number
  on: boolean
  builtIn: boolean
  /** The fields it was opened with. **The pin is built from the clause FIELDS**, so a rule
   *  that gains, loses or swaps one writes pins of a different shape and every `fine-for-now`
   *  filed under it stops matching. Kept so the form can say so before the save rather than
   *  letting it be discovered as findings quietly reappearing. */
  wasFields: string[]
}

function draftOf(r: RuleView): Draft {
  return {
    id: r.id,
    title: r.title,
    soWhat: r.soWhat,
    says: r.says,
    pop: r.pop,
    clauses: r.clauses.map((c) => ({ field: c.field, op: c.op, value: String(c.value) })),
    calibrated: r.calibrated,
    on: r.on,
    builtIn: r.builtIn,
    wasFields: r.clauses.map((c) => c.field),
  }
}

/** What a new rule starts as.
 *
 *  `loc >= 100` on functions, because it is the one clause every repo can answer and it puts
 *  a number on screen that the spread line underneath immediately argues with — which is the
 *  whole way this form is meant to be used. */
function blankDraft(): Draft {
  return {
    id: '',
    title: '',
    soWhat: '',
    says: '',
    pop: 'func',
    clauses: [{ field: 'loc', op: '>=', value: '100' }],
    calibrated: 0,
    on: true,
    builtIn: false,
    wasFields: [],
  }
}

/** Which fields can be asked of this population.
 *
 *  A field with a `pop` says nothing about the other one — `funcs` is how many functions a
 *  file holds, and there is no such number for a function. Filtered rather than disabled: an
 *  option that cannot be chosen is a question about why, and the answer is uninteresting. */
function fieldsFor(g: Grammar, pop: 'func' | 'file'): FieldView[] {
  return g.fields.filter((f) => f.pop === null || f.pop === pop)
}

/** The picker's sections: what this body is, and what the repo around it is.
 *
 *  **Two kinds of choice, and a flat list of sixteen names said they were one.** `loc` and
 *  `callers` narrow a list; `repo_headcount` decides whether the rule applies to this repo at
 *  all. Grouping them is not tidiness — it is the difference showing up where the choice is
 *  made, so nobody reaches for a gate expecting a filter. */
function sections(fields: FieldView[], pop: 'func' | 'file') {
  const at = (scope: string) => fields.filter((f) => f.scope === scope)
  return [
    { label: pop === 'file' ? 'this file' : 'this function', fields: at('subject') },
    // Only on a function rule: on a file rule these ARE the subject, and `loc` and `funcs`
    // already say them.
    { label: 'this file', fields: at('file') },
    { label: 'this repo', fields: at('repo') },
  ].filter((g) => g.fields.length > 0)
}

function spreadFor(f: FieldView | undefined, pop: 'func' | 'file'): Spread | null {
  return !f ? null : pop === 'file' ? f.file : f.func
}

/** The rule form.
 *
 *  **It refuses nothing itself.** Every rule about what a rule may be — the clause count, a
 *  threshold true of everything, a field that says nothing about this population, a `{{token}}`
 *  the rule cannot fill — is enforced by `apply_edit`, which answers with a sentence. A second
 *  copy of those rules here would be a second grammar, and the day they disagreed the form
 *  would be refusing rules the backend accepts. What this does is offer only what is
 *  offerable, and show what comes back.
 */
function RuleForm({
  draft,
  set,
  grammar,
  pinned,
  error,
  busy,
  onSave,
  onCancel,
  onDelete,
  onReset,
}: {
  draft: Draft
  set: (d: Draft) => void
  grammar: Grammar | null
  /** How many `fine-for-now` decisions are filed under this rule — the ones a changed clause
   *  brings back. */
  pinned: number
  error: string | null
  busy: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onReset: () => void
}) {
  const fields = grammar ? fieldsFor(grammar, draft.pop) : []
  const ops = grammar?.ops ?? ['>=', '>', '<=', '<']
  const changedFields =
    draft.wasFields.length > 0 &&
    (draft.clauses.length !== draft.wasFields.length ||
      draft.clauses.some((c, i) => c.field !== draft.wasFields[i]))

  const input =
    'rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-[3px] text-[11px] text-[var(--foreground)]'
  const label = 'text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className={label}>title</span>
        <input
          className={`${input} font-semibold`}
          value={draft.title}
          autoFocus
          placeholder="What this finds"
          onChange={(e) => set({ ...draft, title: e.target.value })}
        />
      </div>

      {/* **The expression, in the shape it is read in.** `func:` then clauses, left to right,
          so the control layout and the `func: loc >= 257` the row shows when closed are the
          same sentence — a form that stacked three labelled boxes per clause would be a
          different language for the same thing. */}
      <div className="flex flex-col gap-1">
        <span className={label}>finds a</span>
        {/* **The population is its own line, above the clauses.** It shared the first clause's
            row, which pushed that clause right by the width of the word "function" and left
            the three fields in a staircase — three questions of the same shape that did not
            look like it. It is also not a clause: it says what the rule is ABOUT, and the
            clauses say what it asks. */}
        <select
          className={`${input} mono w-[124px]`}
          value={draft.pop}
          disabled={busy}
          onChange={(e) => {
            const pop = e.target.value as 'func' | 'file'
            // **Clauses the new population cannot answer are dropped, not carried.**
            // `funcs >= 40` on a function rule is a clause the backend refuses, and keeping
            // it would make the population switch look broken rather than the clause. One
            // always survives, so the rule stays a rule.
            const kept = grammar
              ? draft.clauses.filter((k) => fieldsFor(grammar, pop).some((f) => f.name === k.field))
              : draft.clauses
            set({
              ...draft,
              pop,
              clauses: kept.length ? kept : [{ field: 'loc', op: '>=', value: '100' }],
            })
          }}
        >
          <option value="func">function</option>
          <option value="file">file</option>
        </select>
        <div className="flex flex-col gap-1.5 pt-0.5">
          {draft.clauses.map((c, i) => {
            const meta = fields.find((f) => f.name === c.field)
            const sp = spreadFor(meta, draft.pop)
            return (
              <div key={i} className="flex flex-col gap-[3px]">
                <div className="mono flex items-center gap-1 text-[11px]">
                  {/* **The gutter says the sentence, rather than indenting for one.** It was
                      blank on the first clause and `and` on the rest, which read as a list
                      that happened to be joined; `where … and …` is the expression spoken,
                      and it is the same sentence `func: loc >= 339 and cognitive >= 10`
                      renders when the row is closed. Fixed width, right-aligned, so the three
                      fields still start in one column. */}
                  <span className="w-[40px] shrink-0 text-right text-[var(--muted-foreground)]">
                    {i > 0 ? 'and' : 'where'}
                  </span>
                  <select
                    className={`${input} w-[124px]`}
                    style={{ color: fieldColor(meta?.lens ?? null) }}
                    value={c.field}
                    disabled={busy}
                    onChange={(e) => {
                      const next = [...draft.clauses]
                      next[i] = { ...c, field: e.target.value }
                      set({ ...draft, clauses: next })
                    }}
                  >
                    {sections(fields, draft.pop).map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.fields.map((f) => (
                          <option key={f.name} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <select
                    className={`${input} w-[54px]`}
                    value={c.op}
                    disabled={busy}
                    onChange={(e) => {
                      const next = [...draft.clauses]
                      next[i] = { ...c, op: e.target.value }
                      set({ ...draft, clauses: next })
                    }}
                  >
                    {ops.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${input} w-[72px]`}
                    inputMode="decimal"
                    value={c.value}
                    disabled={busy}
                    onChange={(e) => {
                      const next = [...draft.clauses]
                      next[i] = { ...c, value: e.target.value }
                      set({ ...draft, clauses: next })
                    }}
                  />
                  {/* One clause is the floor: a rule with none asks nothing. */}
                  {draft.clauses.length > 1 && (
                    <button
                      className="px-1 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                      disabled={busy}
                      title="drop this clause"
                      onClick={() =>
                        set({
                          ...draft,
                          clauses: draft.clauses.filter((_, k) => k !== i),
                          calibrated: draft.calibrated > i ? draft.calibrated - 1 : draft.calibrated,
                        })
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
                {/* **What normal is, under the number being typed.** A threshold means nothing
                    without the distribution it sits in — 257 lines is an outlier in one repo
                    and the median in another, which is the measurement that made calibration
                    per-repo in the first place. Where a field has no values here it says so:
                    a bar typed against nothing is a guess, and a silent empty hint would let
                    somebody make one without noticing. */}
                <div className="pl-[44px] text-[10px] text-[var(--muted-foreground)]">
                  {sp ? (
                    <>
                      median <span className="mono">{trim(sp.median)}</span> · 95th{' '}
                      <span className="mono">{trim(sp.p95)}</span> · most{' '}
                      <span className="mono">{trim(sp.max)}</span> ·{' '}
                      <span className="mono">{sp.n.toLocaleString()}</span>{' '}
                      {draft.pop === 'file' ? 'files' : 'functions'}
                    </>
                  ) : meta?.needsReading ? (
                    'nothing here has been read, so this asks nothing yet'
                  ) : (
                    'nothing in this repo has a value for this'
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {/* **The cap says so, rather than the control disappearing.** A button that is there
            at two clauses and gone at three reads as a bug, and the first person to reach
            three asked where it went. It says it is a choice because it is one: the note
            retracts the precedence argument that used to justify it — conjunction is
            associative and needs no precedence at any width — and what is left is a judgement
            about a tile staying readable.

            A new clause opens on its field's median rather than on zero: `>= 0` is true of
            everything, which `apply_edit` refuses, so starting there would open every added
            clause in a state the backend will not take. */}
        {draft.clauses.length < 3 ? (
          <button
            className="self-start pl-[44px] text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            disabled={busy}
            onClick={() => {
              const f = fields[0]
              const start = spreadFor(f, draft.pop)?.median
              set({
                ...draft,
                clauses: [
                  ...draft.clauses,
                  { field: f?.name ?? 'loc', op: '>=', value: start === undefined ? '1' : trim(start) },
                ],
              })
            }}
          >
            + and…
          </button>
        ) : (
          <span className="self-start pl-[44px] text-[10px] text-[var(--muted-foreground)]">
            three is as many clauses as this form offers — a choice, not a limit of the grammar
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className={label}>impact</span>
        <input
          className={input}
          value={draft.soWhat}
          placeholder="Why this is worth a look"
          disabled={busy}
          onChange={(e) => set({ ...draft, soWhat: e.target.value })}
        />
      </div>

      {/* **Optional, and refused rather than ignored when it is wrong.** `render` falls back
          to the so-what when it cannot fill a token, which is right at draw time and wrong
          here: it would mean writing a sentence that never appears and never being told. */}
      <div className="flex flex-col gap-1">
        <span className={label}>report text (optional)</span>
        <textarea
          className={`${input} h-[52px] resize-none leading-snug`}
          value={draft.says}
          placeholder="A sentence about each one. {{name}} {{median}}, the fields this rule measures, and {{window}} beside commits."
          disabled={busy}
          onChange={(e) => set({ ...draft, says: e.target.value })}
        />
      </div>

      {/* **Said before the save, not discovered afterwards.** A changed threshold touches no
          decision — the pin records the SUBJECT's values, not the rule's bar — but a changed
          clause field writes pins of a different shape and every `fine-for-now` under this
          rule stops matching. Everybody assumes the opposite of both. */}
      {changedFields && pinned > 0 && (
        <p className="text-[11px] text-[var(--accent)]">
          This changes what the rule measures, so the{' '}
          <span className="mono">{pinned.toLocaleString()}</span> finding
          {pinned === 1 ? '' : 's'} set aside under it come back.
        </p>
      )}

      {error && <p className="text-[11px] text-[var(--accent)]">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          className="rounded px-2 py-[3px] text-[11px] text-[var(--foreground)]"
          style={{ background: 'color-mix(in oklch, var(--accent) 22%, transparent)' }}
          disabled={busy}
          onClick={onSave}
        >
          save
        </button>
        <button
          className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          disabled={busy}
          onClick={onCancel}
        >
          cancel
        </button>
        <span className="ml-auto flex items-center gap-3">
          {/* **A built-in is put back, never removed.** A later release ships it again, and
              somebody who deleted it would find it returned with no record of their having
              said otherwise — so the catalog's own rules silence, and only a rule of your own
              can actually go. */}
          {draft.builtIn && draft.id && (
            <button
              className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              disabled={busy}
              title="back to the way sanity ships it, and re-suggest its threshold"
              onClick={onReset}
            >
              reset
            </button>
          )}
          {draft.id && (
            <button
              className="text-[11px] text-[var(--muted-foreground)] hover:text-[var(--accent)]"
              disabled={busy}
              title={
                draft.builtIn
                  ? 'stop asking this here — decisions filed under it are kept'
                  : 'delete this rule — decisions filed under it are kept'
              }
              onClick={onDelete}
            >
              {draft.builtIn ? 'turn off' : 'delete'}
            </button>
          )}
        </span>
      </div>
    </div>
  )
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
  rules,
  grammar,
  onSaveRule,
  onDeleteRule,
  onResetRule,
  onApplyBalance,
  onStock,
  onClose,
  onPick,
  onDecide,
  onUndecide,
  ask,
}: {
  open: boolean
  projectKey: string | null
  groups: FindingGroup[] | null
  replaying: boolean
  archive: Decision[] | null
  /** Every rule this repo runs, or `null` while it is being fetched. */
  rules: RuleView[] | null
  /** Every field and operator a clause may name, with this repo's distributions. */
  grammar: Grammar | null
  /** All three reject with the backend's own sentence rather than resolving quietly — the
   *  form shows what comes back, and stays open on a save that did not happen. */
  onSaveRule: (rule: RuleEdit) => Promise<void>
  onDeleteRule: (id: string) => Promise<void>
  onResetRule: (id: string) => Promise<void>
  /** Save the thresholds ticked in a balance, as `[rule id, value]`. */
  onApplyBalance: (thresholds: [string, number][]) => Promise<void>
  /** Remove this repo's rule changes. */
  onStock: () => Promise<void>
  onClose: () => void
  onPick: (hit: Hit) => void
  onDecide: (key: string, rule: string, verdict: Verdict, reason: string) => void
  onUndecide: (key: string, rule: string) => void
  /** The tab somebody asked the panel to open on — the dial's halves. A new object is a new
   *  ask, so it switches even to the tab it was last asked for. */
  ask?: { view: 'findings' | 'rules'; n: number } | null
}) {
  /** Which of the three the panel is showing.
   *
   *  **One switch, not two booleans.** Findings, what has been ignored, and the rules that
   *  found them are three views of one thing; a pair of flags would have a fourth state that
   *  means nothing and would eventually reach it. */
  const [view, setView] = useState<'findings' | 'ignored' | 'rules'>('findings')
  useEffect(() => {
    if (ask) setView(ask.view)
  }, [ask])
  /** Which row has its reason field open, and under which verdict.
   *
   *  **A reason is asked for, and not required.** The reasons people type are the most
   *  interesting thing this feature produces, so the field opens by default — but a blank one
   *  still files, because a dismissal somebody could not be bothered to justify is better
   *  recorded than not made. */
  const [saying, setSaying] = useState<{ at: string; verdict: Verdict } | null>(null)
  const [reason, setReason] = useState('')
  /** The rule being edited, or null. **One at a time**: two open forms is two drafts of a
   *  file that holds one, and the second save would be written against a rule set the first
   *  had already moved. */
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The balance sheet is open at the top of the rules view. */
  const [balancing, setBalancing] = useState(false)
  /** The backend's refusal, shown verbatim. It is written to be read. */
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** How wide a tile's text column is, in pixels, or 0 before it has been measured.
   *
   *  **Measured once for the panel, not once per tile.** Every tile is the same width — the
   *  panel is a fixed column — so an observer apiece would be fifty observers answering one
   *  question. It feeds the middle-truncation of the directory, which CSS cannot do: `…` in
   *  the MIDDLE means knowing how many characters fit, and only the layout knows that. */
  const [colW, setColW] = useState(0)
  const column = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = column.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setColW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, view])

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

  /** Send a draft, and keep the form open if it comes back refused.
   *
   *  **The parse happens here and nowhere else.** Values are strings while they are being
   *  typed, so this is the one place a half-typed number exists — and a `NaN` sent as a
   *  threshold is a rule that matches nothing, silently, which is the failure this whole
   *  surface is written against. */
  const saveDraft = () => {
    if (!draft) return
    const bad = draft.clauses.find((c) => !Number.isFinite(Number(c.value)) || c.value.trim() === '')
    if (bad) {
      setFormError(`\`${bad.value}\` is not a number`)
      return
    }
    setBusy(true)
    setFormError(null)
    void onSaveRule({
      id: draft.id,
      title: draft.title,
      soWhat: draft.soWhat,
      says: draft.says,
      pop: draft.pop,
      clauses: draft.clauses.map((c) => ({ field: c.field, op: c.op, value: Number(c.value) })),
      calibrated: draft.calibrated,
      on: draft.on,
    })
      .then(() => {
        setDraft(null)
        setFormError(null)
      })
      .catch((e: unknown) => setFormError(String(e)))
      .finally(() => setBusy(false))
  }

  const removeDraft = () => {
    if (!draft?.id) return
    setBusy(true)
    void onDeleteRule(draft.id)
      .then(() => {
        setDraft(null)
        setFormError(null)
      })
      .catch((e: unknown) => setFormError(String(e)))
      .finally(() => setBusy(false))
  }

  const resetDraft = () => {
    if (!draft?.id) return
    setBusy(true)
    void onResetRule(draft.id)
      .then(() => {
        setDraft(null)
        setFormError(null)
      })
      .catch((e: unknown) => setFormError(String(e)))
      .finally(() => setBusy(false))
  }

  const choose = (hit: Hit) => {
    onPick(hit)
    onClose()
  }

  /** One tile per SUBJECT, not per finding — see `mergeFindings`, which the report numbers
   *  its list from too. */
  const items = mergeFindings(groups)

  /** The tile each rule says its background under — see `introductions`. */
  const introduces = introductions(items)

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

  /** What could not be asked, one line per REASON rather than one per rule — see
   *  `blockedByNeed`. */
  const blocked = blockedByNeed(groups)
  const setAside = setAsideCount(groups)
  /** Rows the wire did not carry — see `rowsCapped`. */
  const capped = rowsCapped(groups)

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
        {/* **The control IS the title**, the way it is on the lens sheet — see `Tabs`. A
            heading on the left and a link on the right was two pieces of chrome saying one
            thing, and the link read as an action rather than as the other half of a switch:
            `rules` looked like something that would happen to the list.

            The count rides in the word. `Findings (54)` is one thing being named, and it names
            what is ON SCREEN — it used to read `Findings (120+)` over a list of rules, which is
            a count of something you are not looking at, with a `+` reporting that the row cap
            had bitten in the view underneath. */}
        <div className="flex items-center border-b border-[var(--border)] px-4 py-2.5">
          <Tabs
            className="mx-auto"
            at={view === 'ignored' ? 'findings' : view}
            onPick={setView}
            tabs={
              // The ignored drawer is not a third position: it is a place you arrive at from
              // the findings list and go back to. A tab for it would be a room that is empty
              // on most repos, sitting in the control forever.
              [
                {
                  k: 'findings' as const,
                  word: `Findings${groups && !replaying ? ` (${items.length}${capped ? '+' : ''})` : ''}`,
                },
                { k: 'rules' as const, word: `Rules${rules ? ` (${rules.length})` : ''}` },
              ]
            }
          />
        </div>
        {/* **A section header per view: what you are looking at, and what you can do to it.**
            The tabs above say which of the three is showing and carry the counts; this says it
            again at the head of the list, which is the line the eye lands on after pressing a
            tab — and it gives the view's one ACTION somewhere to be. `add rule` floated at the
            top of the rules list with nothing to sit against, and the way into the ignored
            drawer had a bar of its own.

            Absent while there is nothing to head: a title over an empty pane is furniture. */}
        {groups && !replaying && (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
            <span className="text-[12px] font-medium text-[var(--foreground)]">
              {view === 'rules' ? 'Rules' : view === 'ignored' ? 'Ignored' : 'Findings'}
            </span>
            {view === 'rules' ? (
              // Only when the form is not already open — the open form IS the new rule, and a
              // button that makes another one while one is being written would throw the first
              // away without saying so.
              (!draft || draft.id !== '') && (
                <div className="flex items-center gap-1.5">
                  {!balancing && projectKey && (
                    <button
                      type="button"
                      onClick={() => setBalancing(true)}
                      className="rounded border border-[var(--border)] px-2 py-[3px] text-[11px] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      Balance
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!grammar}
                    onClick={() => {
                      setDraft(blankDraft())
                      setFormError(null)
                    }}
                    className="rounded border border-[var(--border)] px-2 py-[3px] text-[11px] text-[var(--muted-foreground)] hover:border-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-40"
                  >
                    Add Rule
                  </button>
                </div>
              )
            ) : ignored.length > 0 ? (
              // The way into the drawer, and out of it, said as the sentence it is. Absent when
              // there is nothing in there: a link to an empty room is a thing to wonder about.
              <button
                type="button"
                onClick={() => setView(view === 'ignored' ? 'findings' : 'ignored')}
                className="text-[11px] text-[var(--muted-foreground)] underline decoration-[var(--border)] underline-offset-2 hover:text-[var(--foreground)] hover:decoration-current"
              >
                {view === 'ignored' ? 'back to findings' : `${ignored.length} ignored`}
              </button>
            ) : null}
          </div>
        )}

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
        ) : view === 'rules' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {/* **The catalog, and what each rule is worth HERE.** `hits` is what it finds and
                `only` is how much of that nothing else found — and the second is the number to
                judge a rule by. "Long and undocumented" scored 3,455 on kibana and was
                worthless, because 18 of its top 20 were already in "Giant function"; a grid
                showing hit counts alone would have kept it.

                Read-only for now: every number here is already computable, and it is worth
                looking at before anything is editable. */}
            {/* **A new rule opens at the top, under the button that made it.** A form that
                opened at the bottom of a catalog of sixteen would open off screen, and the
                first thing it did would be to scroll away from the thing just pressed. */}
            {balancing && projectKey && (
              <BalanceSheet
                projectKey={projectKey}
                onApply={(thresholds) => onApplyBalance(thresholds).then(() => setBalancing(false))}
                onStock={() => onStock().then(() => setBalancing(false))}
                onClose={() => setBalancing(false)}
              />
            )}
            {draft && draft.id === '' && (
              <div className="mb-3 rounded-md border border-[var(--border)] px-3 py-2.5">
                <RuleForm
                  draft={draft}
                  set={setDraft}
                  grammar={grammar}
                  pinned={0}
                  error={formError}
                  busy={busy}
                  onSave={saveDraft}
                  onCancel={() => {
                    setDraft(null)
                    setFormError(null)
                  }}
                  onDelete={removeDraft}
                  onReset={resetDraft}
                />
              </div>
            )}
            {!rules ? (
              <p className="text-[11px] text-[var(--muted-foreground)]">Looking…</p>
            ) : (
              rules.map((r) =>
                draft && draft.id === r.id ? (
                  <div
                    key={r.id}
                    className="mb-3 rounded-md border border-[var(--border)] px-3 py-2.5 last:mb-0"
                  >
                    <RuleForm
                      draft={draft}
                      set={setDraft}
                      grammar={grammar}
                      /* Only `fine-for-now` is pinned. `fine-always` is a statement about the
                         subject rather than about a version of it, and never expires. */
                      pinned={
                        archive?.filter((d) => d.rule === r.id && d.verdict === 'fine-for-now')
                          .length ?? 0
                      }
                      error={formError}
                      busy={busy}
                      onSave={saveDraft}
                      onCancel={() => {
                        setDraft(null)
                        setFormError(null)
                      }}
                      onDelete={removeDraft}
                      onReset={resetDraft}
                    />
                  </div>
                ) : (
                <div
                  key={r.id}
                  /* **The row is the way in.** A pencil in the corner of every row is twelve
                     small targets for one action, and the whole card already reads as the
                     rule — clicking the thing you want to change is the shorter sentence.
                     Cancel costs nothing, so a misclick costs nothing. */
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setDraft(draftOf(r))
                    setFormError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDraft(draftOf(r))
                      setFormError(null)
                    }
                  }}
                  className="group mb-3 cursor-pointer rounded-md border border-[var(--border)] px-3 py-2.5 last:mb-0 hover:border-[var(--muted-foreground)]"
                  style={{
                    background: 'color-mix(in oklch, var(--foreground) 3%, transparent)',
                    // A silenced rule is listed and obviously not running, rather than absent:
                    // one somebody has to go and find again is one they will not turn back on.
                    opacity: r.on ? 1 : 0.45,
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-semibold text-[var(--foreground)]">
                      {r.title}
                    </span>
                    {!r.builtIn && (
                      <span
                        className="rounded px-1.5 py-[1px] text-[9px] uppercase"
                        style={{
                          letterSpacing: '0.1em',
                          background: 'color-mix(in oklch, var(--accent) 20%, transparent)',
                          color: 'var(--foreground)',
                        }}
                      >
                        yours
                      </span>
                    )}
                    {!r.on && (
                      <span className="text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]">
                        off
                      </span>
                    )}
                    {/* **The count, and what share of the repo it is.**
                        
                        A count alone is half a fact: 1,600 findings is a rule working on
                        kibana and a rule that has stopped discriminating on a repo with four
                        thousand functions, and the number is the same both times. The share is
                        the half that tells them apart — a rule firing on 40% of your files is
                        not narrowing anything, whatever its threshold, and no threshold fixes
                        it either. What fixes it is turning the rule off, which is one click
                        away on this row.

                        On EVERY row, not only the loud ones. "Show it when it is above N" is
                        an invented threshold doing the reader's judging for them, which is the
                        thing this grid exists to hand over; every row carrying it singles out
                        nothing and lets 40% be compared against 0.7% by eye.

                        A second figure was here once and is gone — how many of these no other
                        rule also finds. It answers whether a rule earns its place in the
                        CATALOG, which is asked once ever and was sitting on every row forever.
                        This one is about THIS repo and changes with every project opened,
                        which is the difference. Still computed; `just findings` prints it. */}
                    <span className="ml-auto shrink-0 text-right text-[11px] text-[var(--muted-foreground)]">
                      <span className="block">
                        {/* Named only on hover: it is true of every row, and sixteen copies of
                            the word is a column of noise beside the numbers that differ. */}
                        <span className="pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                          edit
                        </span>
                        <span className="mono text-[var(--foreground)]">
                          {r.hits.toLocaleString()}
                        </span>{' '}
                        finding{r.hits === 1 ? '' : 's'}
                      </span>
                      {r.population > 0 && (
                        <em className="block text-[10px] not-italic opacity-70">
                          {share(r.hits, r.population)} of {r.pop === 'file' ? 'files' : 'functions'}
                        </em>
                      )}
                    </span>
                  </div>

                  {/* **The expression IS the legend.** A chip row beside it named the same
                      lenses a second time, in a second vocabulary, and left the reader to map
                      `callers` onto CALLERS by position. Colouring the field where it is
                      written says which lens each clause asks about at the place the question
                      is asked — and a field with no lens, like `read`, stays plain, which is
                      the honest answer rather than a hue invented for it.

                      Built from the clauses rather than from `expr`: the string is for showing
                      whole, and splitting it back up here would be parsing our own output. */}
                  <div className="mono flex flex-wrap items-baseline gap-x-1.5 pt-1.5 text-[11px] text-[var(--muted-foreground)]">
                    <span>{r.pop}:</span>
                    {r.clauses.map((c, i) => (
                      <span key={`${c.field}-${i}`}>
                        {i > 0 && <span> and </span>}
                        {/* **A pill, so the field is a thing and not a word.** Coloured text
                            alone left `callers` looking like the rest of the expression with
                            a tint on it; the operator and the number are punctuation around a
                            named quantity, and the pill says which part is which. Tinted from
                            its own lens, so the colour still carries the meaning.

                            A field with no lens — `read` — gets the neutral rather than a hue
                            invented for it, and is still a pill: it is the same kind of thing,
                            it simply is not a lens. */}
                        <span
                          className="rounded px-1 py-[1px]"
                          style={{
                            color: fieldColor(c.lens),
                            background: `color-mix(in oklch, ${fieldColor(c.lens)} 16%, transparent)`,
                          }}
                          /* **Everything about this field, where the field is written.** The
                             lens it belongs to, what normal looks like for it here, and — on
                             the calibrated clause — the bar this repo would suggest instead.
                             Every clause carries its own, which is why they sit on
                             `ClauseView` rather than on the rule: the numbers are facts about
                             a FIELD, and describing one of them in prose beside the expression
                             left "median here is 1" with no way to say of what. */
                          title={[
                            c.lens ? lensName(c.lens) : 'not a lens',
                            c.median !== null &&
                              `median ${trim(c.median)} per ${
                                r.pop === 'file' ? 'file' : 'function'
                              } in this repo`,
                            c.suggestion !== null &&
                              `this repo would suggest ${trim(c.suggestion)}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        >
                          {c.field}
                        </span>{' '}
                        {c.op} {trim(c.value)}
                      </span>
                    ))}
                    {/* **Said, not named.** `floor 10` is a word from a doc comment put on
                        screen untranslated: it means nothing to somebody who has not read
                        `Rule::floor`, and the first person to see it asked what it was.

                        Not written as a clause either, though `loc >= 10` is what it does —
                        the rule is capped at two clauses and a third clause-shaped thing
                        beside them would make that cap look broken. It is a guard, so it
                        reads as one. */}
                  </div>

                  <p className="pt-1 text-[11px] text-[var(--muted-foreground)]">
                    {/* **The sentence, and the numbers on the pills that own them.** The
                        median and the suggested bar were described here in prose — "Median
                        here is 1", of what, and why that field rather than the other one. They
                        are facts about a FIELD, so they hover on the field: every clause
                        carries its own now, not just the calibrated one.

                        Blocked replaces the sentence rather than joining it: a rule that
                        cannot be asked has no so-what worth reading. */}
                    {r.blocked ?? r.soWhat}
                  </p>
                  </div>
                ),
              )
            )}
          </div>
        ) : view === 'ignored' ? (
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
                          : d.verdict === 'false-positive'
                            ? 'not true'
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
            {/* The one measured element: `p-4` inside, and a tile's own `px-4` inside that. */}
            <div ref={column} className="h-0" />
            {items.length === 0 && (
              <p className="py-1 text-[11px] text-[var(--muted-foreground)]">
                {setAside > 0
                  ? `Nothing standing. ${setAside.toLocaleString()} matches ignored.`
                  : 'Nothing in this repo matches the rules.'}
              </p>
            )}
            {items.map(({ finding, rules, says, stale, flagged }) => {
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

                          The directory is muted so the eye lands on the file and the function,
                          and it is shortened from the MIDDLE — see `dirFor`. */}
                      <button
                        type="button"
                        onClick={() => choose(finding.hit)}
                        title={address(finding.hit)}
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
                          {dirFor(finding.hit, colW)}
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
                            className="shrink-0 whitespace-nowrap font-semibold"
                            style={{ color: 'var(--foreground)' }}
                          >
                            {nameOf(finding.hit)}
                          </span>
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
                          {/* **The lesson, once, and in the same breath.** It is the tail of
                              one paragraph and not a second one: the sentences were written to
                              be read together, and giving the background its own block — its
                              own face, its own dimming — turned a paragraph into a finding
                              with a footnote. Every later tile this rule raises just stops
                              after the measurement, which is what a paragraph does anyway.

                              A leading space rather than a joined string, so the two halves
                              stay two nodes and nothing has to decide what punctuation goes
                              between them. */}
                          {introduces.get(r.id) === finding.key && <span> {r.background}</span>}
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
                        ['flagged', 'Flag for action', 'Stays in the list, marked'],
                        ['fine-for-now', 'Fine as it stands', 'Hidden until this code changes'],
                        ['fine-always', 'Always fine', 'Hidden whatever this code does'],
                        // **Two ways to hide something forever, because two different things
                        // are wrong.** `Always fine` is about the code — this file has 116
                        // functions and nobody minds. This is about the RULE, and it is the
                        // one verdict that says the tool made a claim that was not true. It
                        // comes back the moment the rule asks a different question.
                        ['false-positive', 'Not true', 'The finding is wrong. Back if the rule changes'],
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
                {/* Matches, not findings: counted once per rule, where the list above merges a
                    subject's rules into one tile — and not the drawer's count either, which
                    holds every decision, including ones that no longer match anything. */}
                {setAside > 0 && <p>{setAside.toLocaleString()} matches ignored.</p>}
                {blocked.map((b) => (
                  <p key={b.need} title={`${b.whys.join('; ')}\n\n${b.rules.join('\n')}`}>
                    {b.rules.length} of {groups?.length ?? 0} rules inactive ({b.need})
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
