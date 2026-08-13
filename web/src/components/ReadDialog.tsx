import { useEffect, useState } from 'react'
import { Gauge } from './Dials'
import { Overlay } from './Overlay'
import {
  harnesses,
  readCurve,
  readable,
  setReader,
  startCheck,
  type HarnessInfo,
  type ProjectSummary,
} from '../lib/api'

/** What a run costs, in tokens, measured rather than guessed.
 *
 *  Two constants and not one, because the blend depends on a choice the dialog now offers.
 *  Entering a reader costs ~23,110 whatever it then does, and each function it reads costs
 *  ~3,030 — so a reading is `23,110/n + 3,030` for a batch of n: about 5,300 at ten per
 *  reader and 26,100 at one. A single averaged constant could not move with the second
 *  slider, which would leave the Tokens dial flat while the thing it measures quadrupled.
 *
 *  Stated as approximate everywhere it is shown, and never multiplied out to a price —
 *  what a token costs depends on a plan this app cannot see. */
const ENTER_TOKENS = 23_110
const PER_FUNCTION_TOKENS = 3_030

/** Tokens for `functions` read in batches of `batch`. */
function tokensFor(functions: number, batch: number): number {
  return Math.ceil(functions / batch) * ENTER_TOKENS + functions * PER_FUNCTION_TOKENS
}

/** How many functions one reader takes. Not a control, and that is deliberate.
 *
 *  **A slider for this was built and removed.** It is a real trade — `23,110/n + 3,030`
 *  per reading, so one function per reader is five times the cost of ten and finishes in
 *  a fifth of the time — and it looked like exactly the sort of choice the person paying
 *  should make. Two reasons it is not offered. The curve is a hyperbola with **no knee**,
 *  so there is no principled place on it for somebody to aim at; and the batch is a
 *  READING CONDITION, recorded per reading as `position`, so varying it across one repo
 *  makes its corpus a mixture the same way two models do — a thing the map cannot show.
 *
 *  Ten is where the measurement stops rather than a measured optimum: warming was looked
 *  for twice, at three and at ten, and never found. Fifteen might be fine. Moving it is a
 *  decision about the instrument, taken in `agentapi::BATCH` with the corpus in mind — not
 *  a thing to hand somebody mid-dialog.
 *
 *  It is also the granularity of the extent slider: work goes out a reader at a time, so
 *  asking for 43 gets you 50. */
const BATCH = 10

/** The ladder detents are drawn from, filtered to what fits between the step and the total.
 *
 *  A 1-2.5-5 sequence rather than powers of ten: on a repo with 843 functions left, decades
 *  alone would offer 10 and 100 and then nothing until "all", which is three choices across
 *  two orders of magnitude. */
const DETENTS = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 25_000]

/** How many models can be buttons before they should be a search box. */
const CHIP_LIMIT = 8

/** One id per agent, purely as an example of the SHAPE a full version takes there.
 *
 *  Not a recommendation and not a list — the chips and the completion come from the agent.
 *  This exists because "e.g. claude-sonnet-5" under Codex's chips is an instruction to type
 *  something Codex cannot accept. */
const EXAMPLE: Record<string, string> = {
  claude: 'claude-sonnet-5',
  codex: 'gpt-5.6-terra',
  agy: 'gemini-3.6-flash-medium',
}

/**
 * A range input wearing a track we drew.
 *
 * **The native input stays underneath, invisible.** It keeps dragging, clicking, arrow
 * keys, focus and the accessible role — none of which is worth reimplementing to change how
 * a groove looks. Only the paint is ours.
 *
 * Extracted while there were briefly two of these. Kept as a component after the second was
 * removed, because pulling it out fixed a real bug: the fill and thumb were
 * positioned as `value / max` while the detents used `(value - min) / (max - min)`, so at
 * the bottom of the range the thumb sat a couple of percent past the notch it was on.
 */
function Slider({
  min,
  max,
  step,
  value,
  detents,
  label,
  valueText,
  onChange,
}: {
  min: number
  max: number
  step: number
  value: number
  /** Notches in the groove. Values in the slider's own units. */
  detents: number[]
  label: string
  valueText: string
  onChange: (v: number) => void
}) {
  const span = max - min
  const at = (v: number) => `${(span > 0 ? (v - min) / span : 0) * 100}%`
  const pos = at(value)
  return (
    <div className="relative h-5">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--secondary)]">
        <div
          className="h-full rounded-full"
          style={{ width: pos, background: 'var(--accent)', transition: 'width 80ms linear' }}
        />
      </div>
      {/* Drawn over both track and fill, so a notch stays visible on the part already
          selected — a scale that disappears as you use it is not a scale. Painted in the
          dialog's own background rather than a color: a notch crosses two very different
          fills, and any single ink is invisible against one of them, while a GAP reads as a
          gap on both. A blend mode was the other candidate and lands differently in every
          theme, which is not a thing to discover on somebody else's screen. */}
      {detents.map((d) => (
        <span
          key={d}
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-2 w-0.5 -translate-y-1/2"
          style={{ left: at(d), background: 'var(--card)' }}
        />
      ))}
      <div
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--card)]"
        style={{ left: pos, background: 'var(--accent)', transition: 'left 80ms linear' }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        aria-valuetext={valueText}
        className="absolute inset-0 w-full cursor-pointer opacity-0"
      />
    </div>
  )
}

/**
 * Pull a dragged value onto a nearby detent.
 *
 * **This is what makes them detents rather than decoration.** Marks you can see but not
 * land on are worse than no marks: they show you a round number and then hand you 490. The
 * catch window is a share of the whole range rather than a number of functions, so it feels
 * the same on a 200-function repo and a 10,000-function one — at four figures a pixel is
 * several readers, which is exactly when a physical detent earns its keep.
 *
 * Deliberately not sticky: one more pixel of drag leaves the notch. Somebody who wants 512
 * gets 512.
 */
function snap(v: number, detents: number[], left: number, step: number): number {
  const window = Math.max(step, (left - step) * 0.02)
  const near = detents.find((d) => Math.abs(d - v) <= window)
  return near ?? v
}

function approx(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`
  return String(n)
}

/**
 * Choose who reads, and how far, then start.
 *
 * **This dialog is where the asking went.** The protocol used to tell the ORCHESTRATOR to
 * ask: propose a model and say why, and on a large repo say what a full pass costs and get
 * the human's number before spawning anything. That was load-bearing — it is the whole
 * difference between a tool and a surprise bill — and the moment the app grew a button
 * that spends tokens, nothing was left asking. So the button asks.
 *
 * Three decisions, in one place, because they are one decision: which agent, which model,
 * how much. Agent and model are remembered per project and merely confirmed here; extent
 * is per run, because it is the one that depends on what you are willing to spend today.
 */
export function ReadDialog({
  project,
  onStarted,
  onClose,
}: {
  project: ProjectSummary
  /** Pull the project list immediately. The poll is 1.5s and the run exists the moment
   *  this returns, so without it the panel behind this dialog sits silent for a second
   *  after you press Read — which reads as the button having done nothing. */
  onStarted: () => void
  onClose: () => void
}) {
  const [installed, setInstalled] = useState<HarnessInfo[]>([])
  // **The corpus outranks the setting, for both.** A repo that has been read already has an
  // instrument, and the honest default is the one it is on — so a project read anywhere, by
  // anyone, opens this dialog with its own agent and model filled in, and pressing Read
  // continues the existing measurement rather than starting a second scale. The index is
  // the fallback because it is one laptop's preference: right for a repo with no readings
  // yet, wrong the moment the repo can answer for itself. Both are null when the readings
  // disagree, which is exactly when nothing should be chosen for you.
  const [harness, setHarness] = useState(project.banked_harness ?? project.harness ?? '')
  // Three sources, most authoritative first. The one model the corpus agrees on; failing
  // that — a repo already read on several scales — the one used most RECENTLY, which is
  // what somebody carrying on means; failing that, this laptop's preference.
  const [model, setModel] = useState(
    project.banked_model ?? project.recent_model ?? project.model ?? '',
  )
  /** How many functions this run should read. `null` until the extent is known, because
   *  it is derived from a count that arrives with the project rather than from a default
   *  worth writing down. */
  const [amount, setAmount] = useState<number | null>(null)
  /** The picker is hidden behind a click when the repo already has a model.
   *
   *  Not `model !== banked`, which cannot tell "has not chosen yet" from "chose the same
   *  thing": this is whether the person asked to see the list. */
  const [overriding, setOverriding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /** Cumulative lines at each batch boundary — see `readCurve`. Empty until it lands, and
   *  the dial falls back to apportioning by count until then, which is a good enough shape
   *  for the one frame before it arrives. */
  const [curve, setCurve] = useState<number[]>([])

  useEffect(() => {
    void readCurve(project.key).then(setCurve)
  }, [project.key])

  useEffect(() => {
    void harnesses().then((h) => {
      setInstalled(h)
      // Chosen for you only when there is nothing to choose: exactly one agent installed
      // and none recorded. Picking a winner out of two would be the app deciding something
      // it has no basis for.
      const found = h.filter((x) => x.installed)
      // Functional, and the `prev ||` is load-bearing: this lands after the first paint, so
      // testing the PROP would let a lone installed agent overwrite one the repo's own
      // readings had already named. A machine with only Claude on it must not quietly
      // retarget a repo that has been read with Codex — that is a change of instrument
      // performed by an autofill.
      if (found.length === 1) setHarness((prev) => prev || found[0].id)
    })
  }, [])

  // **The agent's default model, when nothing has already decided.** `prev ||` is the whole
  // condition: the state is initialized from the corpus and then the stored preference, so
  // a repo with readings to continue never reaches this and a default can never quietly
  // change the scale a project is already on. What it fixes is the other case — a fresh
  // repo opening on a list of ids with nothing ticked and a button that cannot be pressed.
  //
  // Keyed on the fetched list rather than on `models`, which is a fresh array every render
  // and would make this an effect that re-runs forever.
  useEffect(() => {
    const list = installed.find((h) => h.id === harness)?.models ?? []
    const fallback = list.find((m) => m.default)
    if (fallback) setModel((prev) => prev || fallback.id)
  }, [installed, harness])

  const left = readable(project) - project.assessed
  // **The slider starts at everything, and that is not the app inventing a budget.**
  // "Read all" was already what the button did with nothing filled in, so a full slider is
  // the same default made visible — and a slider that started at zero would open on a
  // disabled button and three empty dials, which reads as broken rather than a question.
  const want = Math.min(amount ?? left, left)
  const step = Math.min(BATCH, left)
  const fraction = left > 0 ? want / left : 0
  // **Looked up, not apportioned.** The queue decides which functions a partial run reads
  // and in what order — stale first, then unread, round-robined across files — so the lines
  // it covers are the lines those particular functions have. Multiplying the total by the
  // fraction would make this a restatement of the function count, and the Lines dial would
  // do nothing the Tokens dial beside it was not already doing.
  //
  // Indexed by batch, because that is what the slider steps in. The fallback is the
  // apportioned figure, used for the frame before the curve arrives and for a repo the
  // backend could not answer for.
  const totalLines = curve.length > 0 ? curve[curve.length - 1] : project.unread_lines
  const lines =
    curve.length > 0
      ? (curve[Math.min(Math.ceil(want / BATCH), curve.length) - 1] ?? totalLines)
      : Math.round(project.unread_lines * fraction)
  // One reader per handout. Total launched over the run, not how many are alive at once —
  // the wave keeps a few in flight and starts more as they finish, so "five at a time" is a
  // fact about pacing while this is the size of the job.
  const readers = Math.ceil(want / BATCH)
  const maxReaders = Math.ceil(left / BATCH)
  const tokens = tokensFor(want, BATCH)
  // Round numbers, and always "all". They bunch toward the left on a big repo because the
  // axis is linear and the ladder is not — which is honest: the interesting decisions on a
  // ten-thousand-function repo really are all down at the cheap end, and a log axis would
  // make the slider itself lie about what half way costs. Capped at five so the row stays
  // readable, taking the largest that fit, because the ones nearest the top are the ones
  // worth a click.
  const detents = [
    ...DETENTS.filter((d) => d > step && d < left).slice(-5),
    ...(left > step ? [left] : []),
  ]
  // Whatever the agent said about itself — see `Harness::models`. Never a list of ours.
  const chosen = installed.find((h) => h.id === harness)
  const models = chosen?.models ?? []
  // Aliases need somewhere to type a full version; a real catalog does not — see
  // `Harness::enumerates`. Defaults to true so the field does not flash into existence
  // during the moment before `harnesses()` answers.
  const enumerated = chosen?.enumerated ?? true
  // Only a change AWAY from a corpus that already has a model is a warning. A repo with no
  // readings has no scale to break yet.
  const switching = !!project.banked_model && !!model && model !== project.banked_model
  /** What to present instead of a picker, and it is a ladder rather than one field.
   *
   *  The last read comes FIRST, even for a corpus that agrees, and that ordering is a bug
   *  fix rather than a preference. `banked_model` is what readers said they were —
   *  `claude-sonnet-4.5` — and that is a model's name for itself, not necessarily a string
   *  its CLI will take. `recent_model` is what the last run ASKED for, which is a string
   *  known to have worked, because readings came back from it. Putting the self-report in
   *  a field that becomes `--model` killed a whole wave.
   *
   *  Both are answers, so both get stated with a way to override — the difference is the
   *  caption, because "what all of this was read by" and "what the last run asked for" are
   *  different claims and only one of them is about the corpus. */
  const suggested = project.recent_model ?? project.banked_model
  const none = installed.length > 0 && installed.every((h) => !h.installed)

  async function go(limit: number | null) {
    setBusy(true)
    setError('')
    try {
      await setReader(project.key, harness || null, model || null)
      const out = await startCheck(project.key, { model: model || null, limit })
      if (!out.ok) {
        setError([out.error, out.hint].filter(Boolean).join(' '))
        return
      }
      onStarted()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-[15px] font-semibold">Sanity check</div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            The Sanity backend orchestrates readers, each in its own process with no
            repository access.
          </p>
        </div>

        {none ? (
          // A prerequisite, stated. It replaces "configure an MCP server", and unlike that
          // one it can be checked rather than explained.
          <p className="text-xs leading-relaxed text-[var(--destructive)]">
            No supported agent is installed. Sanity reads with <code>claude</code> or{' '}
            <code>codex</code> — install one and it will appear here.
          </p>
        ) : (
          <>
            <Field label="Agent">
              <div className="flex gap-2">
                {installed.map((h) => (
                  <Choice
                    key={h.id}
                    on={harness === h.id}
                    disabled={!h.installed}
                    onClick={() => {
                      setHarness(h.id)
                      // A model name from the other harness fails at spawn time as an
                      // unreadable error minutes later — or, on Codex, not until the API
                      // rejects it, since Codex validates nothing.
                      const theirs = installed.find((x) => x.id === h.id)?.models ?? []
                      if (!theirs.some((m) => m.id === model)) setModel('')
                    }}
                    label={h.id}
                    note={h.installed ? undefined : 'not installed'}
                  />
                ))}
              </div>
            </Field>

            {/* **Absent until an agent is picked, not present and disabled.** The field
                cannot be filled in before then — the completions come from the agent, and
                so does what counts as a valid id — so what it offered was a grayed box
                reading "choose an agent first", which is a control whose whole content is
                an instruction to use the control above it. The chips above are the step;
                this appears when it has something to say. */}
            {harness && (
            <Field label="Model">
              {/* **A repo that has been read already has a model, so this states it rather
                  than asking again.** The picker was always on, so a project with a pinned
                  `claude-sonnet-5` opened showing four alias chips with none selected and
                  `sonnet` marked "(default)" — an interface inviting somebody to pick the
                  one option that would quietly break the corpus, since an alias is not a
                  version and this repo's own readings are the proof: 708 `claude-sonnet-5`
                  against 66 `claude-sonnet-4.5` under one name.

                  Changing it is one click away and warned about when taken. What is gone is
                  the suggestion that a choice is outstanding when it is not. */}
              {suggested && !overriding ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1">
                  <span className="mono min-w-0 truncate text-xs">{suggested}</span>
                  <button
                    onClick={() => setOverriding(true)}
                    className="shrink-0 text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    Change
                  </button>
                </div>
              ) : (
              <>
              {/* Chips only while they fit. **What each agent knows about itself differs by
                  two orders of magnitude**: Claude names four aliases, Codex four models,
                  Antigravity eleven, and opencode enumerates every model of every provider
                  it has ever heard of — 341 on this machine, which rendered as a wall of
                  buttons taller than the window. A list that long is not a set of choices,
                  it is a search problem, so past a handful it becomes completion on the
                  field below instead. */}
              {models.length > 0 && models.length <= CHIP_LIMIT && (
                <div className="flex flex-wrap gap-2">
                  {models.map((m) => (
                    <Choice
                      key={m.id}
                      on={model === m.id}
                      onClick={() => setModel(m.id)}
                      label={m.label}
                      note={m.default ? 'default' : undefined}
                    />
                  ))}
                </div>
              )}
              {/* A select once there are too many for buttons. opencode enumerates every
                  model of every provider it can reach — 358 here, 349 of them OpenRouter's,
                  because OpenRouter is itself an aggregator — so filtering by credentials
                  barely dents it and never will. That is a list you scroll, not a row you
                  scan. */}
              {models.length > CHIP_LIMIT && (
                <select
                  value={models.some((m) => m.id === model) ? model : ''}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-xs"
                >
                  <option value="">{models.length.toLocaleString()} models — choose one</option>
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                      {m.default ? '  (default)' : ''}
                    </option>
                  ))}
                </select>
              )}
              {/* **Only where the list is not the agent's own, which is Claude alone.**
                  It used to be on every harness, reasoning that pinning a full version is
                  the only way to be sure which reader you got — an alias mixed this repo's
                  corpus, 708 `claude-sonnet-5` against 66 `claude-sonnet-4.5` under one
                  name. That argument holds exactly where the entries ARE aliases. Codex,
                  opencode and Antigravity report real versioned ids, so beside those a text
                  box only offers somebody the chance to type one that does not exist, and
                  find out minutes later when a reader fails to spawn.

                  A datalist rather than a select: it completes against the four aliases
                  while still accepting a full version they do not name, which is the same
                  "suggestions, not a gate" rule the chips follow. */}
              {!enumerated && (
                <>
                  <datalist id="sanity-models">
                    {models.map((m) => (
                      <option key={m.id} value={m.id} />
                    ))}
                  </datalist>
                  <input
                    list="sanity-models"
                    value={model}
                    onChange={(e) => setModel(e.target.value.trim())}
                    placeholder={
                      models.length > 0
                        ? `or a full version, e.g. ${EXAMPLE[harness] ?? models[0].id}`
                        : 'model name'
                    }
                    className="mt-2 w-full rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1 text-xs"
                  />
                </>
              )}
              {/* The rule, stated where it can still be acted on. `model` is recorded on
                  every reading, so a mixture stays answerable afterwards — what it does not
                  stay is readable, and nothing on the map says which wedge is on which
                  scale. */}
              {/* One sentence. The other two explained that a smaller model is surprised by
                  more and that the map ends up on two scales — the reasoning behind the
                  rule, which belongs in CLAUDE.md and in the doc comments where it costs
                  nothing, not in a warning somebody reads while deciding. The fact is the
                  warning; the argument is why the fact matters, and anybody who needs it
                  has already been told once. */}
              {switching && (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--warning)]">
                  This repo's {project.assessed.toLocaleString()}{' '}
                  {project.assessed === 1 ? 'reading was' : 'readings were'} taken by{' '}
                  <strong>{project.banked_model}</strong>.
                </p>
              )}
              {!switching && project.banked_model && (
                <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                  Matching the {project.assessed} readings already banked.
                </p>
              )}
              </>
              )}
              {suggested && !overriding && (
                <p className="mt-1.5 text-[11px] text-[var(--muted-foreground)]">
                  {project.recent_model
                    ? // A fact about one run, which is what this string came from.
                      'The last model used in a read.'
                    : // Nothing dated, so the corpus itself is the only source — and it
                      // agrees, or `suggested` would be empty and this a picker.
                      `What this repo's ${project.assessed.toLocaleString()} ${
                        project.assessed === 1 ? 'reading was' : 'readings were'
                      } taken by.`}
                </p>
              )}
            </Field>

            )}

            <Field label="Coverage">
              {/* **Dials rather than bars, and it is the same argument `Dials` already
                  makes one file over.** These three measure different things on different
                  scales, so setting them as lengths in a column invites the eye to compare
                  them — and a comparison between lines and tokens is not a reading anybody
                  should take. A dial reads as its own instrument. It is also the app's
                  existing vocabulary for "one figure, at a glance, with the number spelled
                  out", so this row is the same object as the one in the detail panel rather
                  than a lookalike.

                  Four, because that is what a run costs: how many functions it covers, how
                  many agents get launched to do it, how much code they actually look at,
                  and what it spends. Functions is a dial like the rest rather than a
                  caption under the slider — the slider is the control, and a control that
                  is also the only readout for one of four figures makes that figure the odd
                  one out. The slider keeps the rule it obeys and nothing else. */}
              <div className="mb-2 grid grid-cols-4 gap-3">
                <Gauge
                  label="Functions"
                  value={fraction}
                  word={approx(want)}
                  hint={`${want.toLocaleString()} of ${left.toLocaleString()} functions still outstanding.`}
                />
                <Gauge
                  label="Readers"
                  value={maxReaders > 0 ? readers / maxReaders : 0}
                  word={String(readers)}
                  hint={`${readers} reader${readers === 1 ? '' : 's'}, ${BATCH} functions each. Each is a separate process with its own empty context — which is what makes a reading a prediction rather than a recollection.`}
                />
                <Gauge
                  label="Lines"
                  /* Its own total, because these three fill together at "all" and a shared
                     absolute scale would leave lines invisible beside millions of tokens. */
                  value={totalLines > 0 ? lines / totalLines : 0}
                  word={approx(lines)}
                  hint={`About ${lines.toLocaleString()} lines of code, out of ${totalLines.toLocaleString()} outstanding. Looked up along the order the queue hands work out in, not apportioned — so this tracks the function count only as closely as those functions are the same size.`}
                />
                <Gauge
                  label="Tokens"
                  /* Against the cheapest way to read the same functions, so the dial fills
                     as the second slider spends — at one per reader it is five times what
                     the same work costs at ten, and that is the number worth seeing before
                     pressing the button. */
                  value={tokens / tokensFor(left, BATCH)}
                  word={approx(tokens)}
                  hint={`Roughly ${approx(tokens)} tokens: about ${approx(ENTER_TOKENS)} to start each of ${readers} reader${readers === 1 ? '' : 's'}, plus ${approx(PER_FUNCTION_TOKENS)} a function. Measured averages — a repo of long functions will beat them.`}
                />
              </div>

              {left > step ? (
                <>
                  <Slider
                    min={step}
                    max={left}
                    step={step}
                    value={want}
                    detents={detents}
                    label="How many functions to read"
                    valueText={`${want} of ${left} functions`}
                    onChange={(v) => setAmount(snap(v, detents, left, step))}
                  />
                </>
              ) : (
                /* Fewer left than one handout: there is nothing to choose, and a slider
                   with one position is a control that lies about offering a choice. */
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {left.toLocaleString()} left — one reader covers that in a single pass.
                </p>
              )}
            </Field>
          </>
        )}

        {error && <p className="text-[11px] leading-relaxed text-[var(--destructive)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs text-[var(--muted-foreground)] hover:opacity-80"
          >
            Cancel
          </button>
          <button
            disabled={busy || !harness || !!none || left === 0}
            /* `null` rather than the number when the slider is at the top: "all" is a
               different instruction from "exactly this many", and it stays true if a
               reading lands between opening this dialog and pressing the button. */
            onClick={() => void go(want >= left ? null : want)}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Starting…' : want >= left ? 'Read all' : `Read ${want.toLocaleString()}`}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      {children}
    </div>
  )
}

function Choice({
  on,
  onClick,
  label,
  note,
  disabled,
}: {
  on: boolean
  onClick: () => void
  label: string
  note?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border px-2.5 py-1 text-xs disabled:opacity-40"
      style={{
        borderColor: on ? 'var(--accent)' : 'var(--border)',
        background: on ? 'var(--accent)' : 'transparent',
        color: on ? 'var(--accent-foreground)' : 'inherit',
      }}
    >
      {label}
      {note && <span className="ml-1.5 opacity-70">({note})</span>}
    </button>
  )
}
