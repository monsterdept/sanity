/** The rule form, and the draft it edits.
 *
 *  A draft is a rule before it is a rule — strings where the rule has numbers, so a box can
 *  be typed through `0.` — and `useRuleDraft` is the one place it becomes one, on its way to
 *  `apply_edit`. Everything the form refuses is refused there and not here; see `RuleForm`. */
import { useState } from 'react'
import type { FieldView, Grammar, RuleEdit, RuleView, Spread } from '../../lib/api'
import { fieldColor, trim } from './format'

/** How many clauses the form offers — `findings::MAX_CLAUSES`, which the catalog's widest
 *  shipped rules already reach. */
const MAX_CLAUSES = 4

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

export function draftOf(r: RuleView): Draft {
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
export function blankDraft(): Draft {
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

/** The form's text box and its section label, shared by every control in it. */
const INPUT =
  'rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-[3px] text-[11px] text-[var(--foreground)]'

const LABEL = 'text-[10px] uppercase tracking-wider text-[var(--muted-foreground)]'

/** The rule form.
 *
 *  **It refuses nothing itself.** Every rule about what a rule may be — the clause count, a
 *  threshold true of everything, a field that says nothing about this population, a `{{token}}`
 *  the rule cannot fill — is enforced by `apply_edit`, which answers with a sentence. A second
 *  copy of those rules here would be a second grammar, and the day they disagreed the form
 *  would be refusing rules the backend accepts. What this does is offer only what is
 *  offerable, and show what comes back.
 */
export function RuleForm({
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <span className={LABEL}>title</span>
        <input
          className={`${INPUT} font-semibold`}
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
        <span className={LABEL}>finds a</span>
        <PopulationSelect draft={draft} set={set} grammar={grammar} busy={busy} />
        <div className="flex flex-col gap-1.5 pt-0.5">
          {draft.clauses.map((_, i) => (
            <ClauseRow
              key={i}
              draft={draft}
              set={set}
              at={i}
              fields={fields}
              ops={ops}
              busy={busy}
            />
          ))}
        </div>
        <AddClause draft={draft} set={set} fields={fields} busy={busy} />
      </div>

      <div className="flex flex-col gap-1">
        <span className={LABEL}>impact</span>
        <input
          className={INPUT}
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
        <span className={LABEL}>report text (optional)</span>
        <textarea
          className={`${INPUT} h-[52px] resize-none leading-snug`}
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

      <FormActions
        draft={draft}
        busy={busy}
        onSave={onSave}
        onCancel={onCancel}
        onDelete={onDelete}
        onReset={onReset}
      />
    </div>
  )
}

/** Which population the rule is about: functions or files. */
function PopulationSelect({
  draft,
  set,
  grammar,
  busy,
}: {
  draft: Draft
  set: (d: Draft) => void
  grammar: Grammar | null
  busy: boolean
}) {
  return (
    /* **The population is its own line, above the clauses.** It shared the first clause's
        row, which pushed that clause right by the width of the word "function" and left
        the three fields in a staircase — three questions of the same shape that did not
        look like it. It is also not a clause: it says what the rule is ABOUT, and the
        clauses say what it asks. */
    <select
      className={`${INPUT} mono w-[124px]`}
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
  )
}

/** One clause of the form — field, operator, number — with what normal is for it here. */
function ClauseRow({
  draft,
  set,
  at: i,
  fields,
  ops,
  busy,
}: {
  draft: Draft
  set: (d: Draft) => void
  at: number
  fields: FieldView[]
  ops: string[]
  busy: boolean
}) {
  const c = draft.clauses[i]
  const meta = fields.find((f) => f.name === c.field)
  const sp = spreadFor(meta, draft.pop)
  /** This clause with one part replaced, written back into the draft. */
  const put = (part: Partial<Draft['clauses'][number]>) => {
    const next = [...draft.clauses]
    next[i] = { ...c, ...part }
    set({ ...draft, clauses: next })
  }
  return (
    <div className="flex flex-col gap-[3px]">
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
          className={`${INPUT} w-[124px]`}
          style={{ color: fieldColor(meta?.lens ?? null) }}
          value={c.field}
          disabled={busy}
          onChange={(e) => put({ field: e.target.value })}
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
          className={`${INPUT} w-[54px]`}
          value={c.op}
          disabled={busy}
          onChange={(e) => put({ op: e.target.value })}
        >
          {ops.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          className={`${INPUT} w-[72px]`}
          inputMode="decimal"
          value={c.value}
          disabled={busy}
          onChange={(e) => put({ value: e.target.value })}
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
}

/** The way to a further clause, or the sentence that says there is no further one. */
function AddClause({
  draft,
  set,
  fields,
  busy,
}: {
  draft: Draft
  set: (d: Draft) => void
  fields: FieldView[]
  busy: boolean
}) {
  /* **The cap says so, rather than the control disappearing.** A button that is there
      one clause and gone the next reads as a bug, and the first person to reach the cap
      asked where it went. It says it is a choice because it is one: the note
      retracts the precedence argument that used to justify it — conjunction is
      associative and needs no precedence at any width — and what is left is a judgement
      about a tile staying readable.

      A new clause opens on its field's median rather than on zero: `>= 0` is true of
      everything, which `apply_edit` refuses, so starting there would open every added
      clause in a state the backend will not take. */
  return draft.clauses.length < MAX_CLAUSES ? (
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
      four is as many clauses as a rule takes
    </span>
  )
}

/** Save and cancel, and on a rule that already exists, the way to put it back or take it out. */
function FormActions({
  draft,
  busy,
  onSave,
  onCancel,
  onDelete,
  onReset,
}: {
  draft: Draft
  busy: boolean
  onSave: () => void
  onCancel: () => void
  onDelete: () => void
  onReset: () => void
}) {
  return (
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
  )
}

/** The rule being edited, and the round trip that saves, deletes or resets it.
 *
 *  **One at a time**: two open forms is two drafts of a file that holds one, and the second
 *  save would be written against a rule set the first had already moved. Every call rejects
 *  with the backend's own sentence, so a refused save leaves the form open with that sentence
 *  under it. */
export function useRuleDraft(
  onSaveRule: (rule: RuleEdit) => Promise<void>,
  onDeleteRule: (id: string) => Promise<void>,
  onResetRule: (id: string) => Promise<void>,
) {
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The backend's refusal, shown verbatim. It is written to be read. */
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** Open a draft, or put the form down, with whatever the last refusal said cleared. */
  const edit = (d: Draft | null) => {
    setDraft(d)
    setError(null)
  }

  /** Close the form once the backend has taken it; keep it open on a refusal. */
  const settle = (sent: Promise<void>) => {
    void sent
      .then(() => edit(null))
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setBusy(false))
  }

  /** Send a draft, and keep the form open if it comes back refused.
   *
   *  **The parse happens here and nowhere else.** Values are strings while they are being
   *  typed, so this is the one place a half-typed number exists — and a `NaN` sent as a
   *  threshold is a rule that matches nothing, silently, which is the failure this whole
   *  surface is written against. */
  const save = () => {
    if (!draft) return
    const bad = draft.clauses.find(
      (c) => !Number.isFinite(Number(c.value)) || c.value.trim() === '',
    )
    if (bad) {
      setError(`\`${bad.value}\` is not a number`)
      return
    }
    setBusy(true)
    setError(null)
    settle(
      onSaveRule({
        id: draft.id,
        title: draft.title,
        soWhat: draft.soWhat,
        says: draft.says,
        pop: draft.pop,
        clauses: draft.clauses.map((c) => ({ field: c.field, op: c.op, value: Number(c.value) })),
        calibrated: draft.calibrated,
        on: draft.on,
      }),
    )
  }

  const remove = () => {
    if (!draft?.id) return
    setBusy(true)
    settle(onDeleteRule(draft.id))
  }

  const reset = () => {
    if (!draft?.id) return
    setBusy(true)
    settle(onResetRule(draft.id))
  }

  return { draft, setDraft, edit, error, busy, save, remove, reset }
}

export type RuleDraft = ReturnType<typeof useRuleDraft>
