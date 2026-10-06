/** The rules view: every rule this repo runs, what each finds here, and the way into its form.
 *
 *  A row is the rule as it reads closed — its title, its expression with each field in its
 *  lens's colour, and its count as a share of the repo. Clicking it opens `RuleForm` in its
 *  place. */
import type { Decision, Grammar, RuleView } from '../../lib/api'
import { BalanceSheet } from '../BalanceSheet'
import { fieldColor, lensName, share, trim } from './format'
import { draftOf, RuleForm, type RuleDraft } from './RuleForm'

/** The rules view: the balance sheet, a new rule's form, and every rule this repo runs. */
export function RulesView({
  projectKey,
  rules,
  archive,
  grammar,
  balancing,
  setBalancing,
  onApplyBalance,
  onStock,
  rd,
}: {
  projectKey: string | null
  rules: RuleView[] | null
  archive: Decision[] | null
  grammar: Grammar | null
  balancing: boolean
  setBalancing: (b: boolean) => void
  onApplyBalance: (thresholds: [string, number][]) => Promise<void>
  onStock: () => Promise<void>
  rd: RuleDraft
}) {
  return (
    <>
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
      {rd.draft && rd.draft.id === '' && (
        <div className="mb-3 rounded-md border border-[var(--border)] px-3 py-2.5">
          <RuleForm
            draft={rd.draft}
            set={rd.setDraft}
            grammar={grammar}
            pinned={0}
            error={rd.error}
            busy={rd.busy}
            onSave={rd.save}
            onCancel={() => rd.edit(null)}
            onDelete={rd.remove}
            onReset={rd.reset}
          />
        </div>
      )}
      {!rules ? (
        <p className="text-[11px] text-[var(--muted-foreground)]">Looking…</p>
      ) : (
        rules.map((r) => <RuleCard key={r.id} r={r} archive={archive} grammar={grammar} rd={rd} />)
      )}
    </>
  )
}

/** One rule in the grid: its form while it is being edited, its row the rest of the time.
 *
 *  Both arms are a `div` at the root, so opening a row into its form keeps the element. */
function RuleCard({
  r,
  archive,
  grammar,
  rd,
}: {
  r: RuleView
  archive: Decision[] | null
  grammar: Grammar | null
  rd: RuleDraft
}) {
  if (rd.draft && rd.draft.id === r.id) {
    return (
      <div className="mb-3 rounded-md border border-[var(--border)] px-3 py-2.5 last:mb-0">
        <RuleForm
          draft={rd.draft}
          set={rd.setDraft}
          grammar={grammar}
          /* Only `fine-for-now` is pinned. `fine-always` is a statement about the
             subject rather than about a version of it, and never expires. */
          pinned={
            archive?.filter((d) => d.rule === r.id && d.verdict === 'fine-for-now').length ?? 0
          }
          error={rd.error}
          busy={rd.busy}
          onSave={rd.save}
          onCancel={() => rd.edit(null)}
          onDelete={rd.remove}
          onReset={rd.reset}
        />
      </div>
    )
  }
  return (
    <div
      /* **The row is the way in.** A pencil in the corner of every row is twelve
         small targets for one action, and the whole card already reads as the
         rule — clicking the thing you want to change is the shorter sentence.
         Cancel costs nothing, so a misclick costs nothing. */
      role="button"
      tabIndex={0}
      onClick={() => rd.edit(draftOf(r))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          rd.edit(draftOf(r))
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
      <RuleHead r={r} />
      <RuleExpression r={r} />
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
  )
}

/** A rule row's first line: its title, whether it is yours or off, and what it finds here. */
function RuleHead({ r }: { r: RuleView }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[12px] font-semibold text-[var(--foreground)]">{r.title}</span>
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
          <span className="pr-2 opacity-0 transition-opacity group-hover:opacity-100">edit</span>
          <span className="mono text-[var(--foreground)]">{r.hits.toLocaleString()}</span> finding
          {r.hits === 1 ? '' : 's'}
        </span>
        {r.population > 0 && (
          <em className="block text-[10px] not-italic opacity-70">
            {share(r.hits, r.population)} of {r.pop === 'file' ? 'files' : 'functions'}
          </em>
        )}
      </span>
    </div>
  )
}

/** A rule's expression as the row shows it closed, each field a pill in its lens's colour. */
function RuleExpression({ r }: { r: RuleView }) {
  /* **The expression IS the legend.** A chip row beside it named the same
      lenses a second time, in a second vocabulary, and left the reader to map
      `callers` onto CALLERS by position. Colouring the field where it is
      written says which lens each clause asks about at the place the question
      is asked — and a field with no lens, like `read`, stays plain, which is
      the honest answer rather than a hue invented for it.

      Built from the clauses rather than from `expr`: the string is for showing
      whole, and splitting it back up here would be parsing our own output. */
  return (
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
                `median ${trim(c.median)} per ${r.pop === 'file' ? 'file' : 'function'} in this repo`,
              c.suggestion !== null && `this repo would suggest ${trim(c.suggestion)}`,
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
          a clause-shaped thing beside the rule's own clauses would read as one
          more of them. It is a guard, so it reads as one. */}
    </div>
  )
}
