# sanity — notes for Claude

A Tauri app that draws a repo as a DaisyDisk-style sunburst. **Width is lines. Colour is
surprise.** Part of the monster dept (`sanity.monster`).

**Get up to speed:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — the metric and what
it refuses to claim are the whole design.

## The metric is the product

The sunburst is not the product; anyone can draw a treemap of LOC and several people
have. What makes this worth building is the second encoding: **boilerplate is code a
model can predict from its context.** Everything below defends that.

- **Temperature IS surprise.** It used to be `surprise × (1 − explained)`, and that
  double-counted: documentation now reaches the *instrument* — the comment stack is in
  the model's prompt, and an agent is handed the docs before it predicts — so a doc that
  explains the body already lowers the surprise. Discounting it again afterwards was
  charging for the same thing twice. The map still drains as you document; it drains
  because the next reading is genuinely less surprising.
- **Documentation is graded, never counted — and it is a report, not a discount.**
  The old lexical `explained` could only reward vocabulary OVERLAP, so a confidently
  wrong comment sharing words with the code *cooled* the wedge. Exactly backwards:
  stale docs are the common failure and must read hot. Through the prompt they do —
  the model predicts what the comment describes, the body doesn't match, surprise
  rises. `heuristic::documented` survives as the offline fallback and still subtracts
  the signature's vocabulary from both sides, so a comment restating the function name
  covers nothing. There is a test named for it — keep it passing.
- **Model-authored text must not cool a wedge.** If a model could write the explanation
  from the code alone, the explanation was already latent in the code and the wedge was
  never hot. The degenerate failure this prevents: run an LLM over the repo, everything
  turns green, the map is a liar. There is deliberately no `Provenance` variant with
  weight for model-written docs — and the agent path asks the question outright, as
  `derivable`, which is the one form of it a lexical score could never evaluate.
- **Surprise alone can't tell brilliance from mess.** Both are unpredictable. Age and
  churn (`churn.rs`) are the second axis; the four quadrants come from the pair. A repo
  with no git history gets a visible warning, never a confident-looking half-verdict.
- **Never let a term claim confidence it hasn't got.** Every measurement returns
  `UNDECIDED` (0.5) when it's out of evidence. They all degrade in the same direction on
  short input, so untreated they compound — the first real scan ranked `fn main()` as
  tally's most surprising code. Equally, don't "fix" that with a global length penalty:
  that just makes the map say "long means hot", which is measuring length again.

## The real metric arrives from readers, not from a scorer

The app scores with the offline proxy and takes its actual measurement from agents over
MCP. **There is no model path in the app** — `OllamaModel` was removed, endpoint and all,
because configuring a model is configuration rather than revelation. `local.rs` keeps a
no-server scorer behind `--features local-metal` for `just scan`; that is where metric
work belongs.

Forced decoding was real and was measured — on krapow it scored **6/15** against a raw
`wc -l` sort where the proxy scores 9/15, and the cobra boilerplate four earlier designs
ranked at 96-98° dropped off entirely. `surprise.rs` and ARCHITECTURE.md carry the full
table of what failed first, in the past tense. Read it before rebuilding anything here.

**Which model reads is part of the measurement, so ask before the first wave — Sonnet
unless the user says otherwise, and don't ask if they already named one.** Surprise is
what *a competent reader* could predict, so the reader IS the scale: a smaller model is
surprised by more, and its readings are not comparable with what is already banked.
Never mix models within one repo to save money — that produces one map on two scales with
nothing on screen saying which wedge is which. `model` is on every reading so the question
stays answerable later; a mixture is merely unreadable. This is reasoning and not yet a
measurement — an interleaved wave of two models over the same functions would settle it,
and `model` is recorded for exactly that, the way `position` is.

**Do not go back to generating a rival body and diffing it.** That was tried three ways
and the noise floor sits above the signal — a model never reproduces real code token for
token whether or not the code was predictable.

## Sanity runs the readers, and that is a reversal with a reason

`sanity check` spawns the readers itself, as processes, one per reader (`harness.rs`,
`agentapi::run_wave`). Three things this file used to say are no longer true, and each was
right when it was written:

- **"`study` prints the sentence rather than running an agent."** The objection was owning
  model choice, auth, concurrency and resumption — the configuration `OllamaModel` was
  deleted to avoid. That was a fair price while a reader had to be a subagent of somebody's
  session. It stopped being one when the reader became a plain MCP client: no filesystem, no
  cwd, no repo, three tools. Spawning one is now shelling out to a CLI the user has already
  installed and authenticated, and there is still **no model path in the app** — Sanity runs
  an agent, it does not run inference.
  **`study` is now deleted, and the role split is what killed it.** It survived the first
  round of this as "the verb for driving by hand", which stopped being a thing anybody can
  do: a session with no `SANITY_ROLE` gets the human tools — open, check, status, summary —
  so the sentence it printed asked an agent to take readings with no tool that takes one.
  Registering a repo is `init`; `--show` moved there. Deleting it also retired three
  paragraphs of priming warning that guarded a door the role split had already bricked up,
  and that had to be re-checked against every change to how readers are launched.
- **"A project arrives exactly one way: an agent calls `sanity_open` in the repo it is
  already working in."** Inverted. A reader cannot name a repo — it has no working directory
  — so a person does, with the sidebar's `+` or `sanity init`. `sanity_open` called bare
  answers with what the human added; a path it has never been given is refused.
  **`add_project` takes any directory now, and the `.git` requirement it dropped was doing
  two jobs.** Its own was the old hazard — a picker once handed a directory of many repos
  and set thirty minutes of CPU on fire. The borrowed one was standing in for a macOS bug:
  in the open panel's LIST view a double-click on a folder is eaten by the disclosure
  toggle, the selection clears, and a directories-only panel with no selection confirms the
  folder you are BROWSING — so the guard fired constantly at people who had pointed at a
  repo. Nothing about scanning needs git; churn and blame degrade to "no history", which
  the app already says out loud. The CPU hazard is now unguarded and wants a size warning
  rather than a rule that refuses folders somebody meant to pick. `docs/bugs/` holds the
  repro: list view fails, icon and column do not.
- **"Do not read `.sanity/`" and "read only the lines you were given."** Both were rules
  addressed to a model, and readers improvised around them three times. They are now absent
  capabilities: source arrives from `sanity_reveal`, and a Claude reader is launched with
  `--allowedTools` naming the three sanity tools and nothing else.

**What Sanity buys with the spawn is isolation it can guarantee instead of ask for.**
Readers run outside the repo (`cwd`), without project settings (`--setting-sources user`,
`--ignore-user-config`), and with only their own tool surface. That last one is why
`SANITY_ROLE` exists: the process creating the connection knows what it is for, so a reader
is offered `next`/`reveal`/`report` and never loads the orchestrator's tools. Measured, that
took the per-reader fixed prefix from 2,752 tokens to 2,208.

**The prediction is stamped before the body is served.** `sanity_reveal(id, expected)`
records `expected` and only then returns the source; a second call serves the same bytes and
cannot revise it. `Report.expected` is filled server-side from that, beside `body`, `by` and
`at`, for their reason — it used to arrive in the same call as `found`, from a reader that
had by then read the code.

**A harness that cannot express those is absent rather than half-present**, on the same rule
`.m` and `.v` follow: anything that would leak the repo into its readers produces warm
readings indistinguishable from cold ones.

**The admission test is per-invocation MCP config, and only one of the four takes a flag.**
Claude has `--mcp-config`; the rest read a directory, so the scratch directory that already
exists for isolation becomes the config directory and the config is as per-invocation as a
flag would be — opencode `opencode.json`, Codex a private `CODEX_HOME`, Antigravity
`.agents/mcp_config.json`. **Writing a harness's GLOBAL config is not an acceptable
substitute**: two runs would fight over one file, and a crash would leave the user's own
sessions pointed at a backend that is gone.

- **Antigravity (`agy`) replaces the Gemini CLI, which deprecated itself.** `gemini` is not
  aliased to it — the two are different instruments, and silently redirecting a project's
  configured harness would change what its readings mean without saying so. A stored
  `harness: gemini` fails to parse, reads as "no agent configured", and asks the human.
- **`--add-dir` is load-bearing and its absence is silent.** agy discovers `.agents/` from
  the *workspace*, and being `cwd` does not make a directory the workspace: without the flag
  it loads no MCP at all and a reader runs with only builtin tools. Its own `mcp_servers.md`
  documents only the global and plugin scopes; the workspace scope is one file over, in
  `agy-customizations/SKILL.md`.
- **Probe a harness by asking it to LIST its tools, never whether it can call one by name.**
  agy exposes MCP through a generic `call_mcp_tool` dispatcher rather than as named tools, so
  "can you call `sanity_next`?" is answered *no* whether the server loaded or not. That one
  wrong question cost a day and produced a confident, wrong conclusion that agy could not be
  configured per run at all. The tells are `call_mcp_tool`, `list_resources` and
  `read_resource` appearing in the list.
- **A private `HOME` is Codex's isolation trick and does not generalise.** For agy the route
  is properly closed: symlinking every entry of `~/.gemini`, then the whole directory, still
  leaves it unauthenticated, so the credential lives somewhere `HOME` also moves. There is no
  config-path override in the binary to reach past it.

## Calibration is evidence, not taste

`heuristic::calibrate` maps the raw mix onto the reported scale. It is monotonic — it
changes no ordering — but the band and exponent are a standing claim about real code,
measured on tally, slooth and krapow. **`just scan <repo>` prints a histogram; read it
before and after touching those constants.** A flat or saturated spread means the metric
is measuring nothing and the rankings are decoration.

## Assessments are committed, and they expire

Agent readings live in **`.sanity/`** in the scanned repo (`assessment.rs`) and nowhere
else. **The Markdown is the store**, parsed back on open; don't add a JSON file beside
it, because the readable copy is the one that would end up wrong. It is not slow — 5,000
readings (1.4 MB) parse in 30ms, once, on open.

- **One home, no fallback, no migration.** `reports.rs` used to keep a permanent second
  copy, which made deleting `.sanity/` appear to do nothing — the map came back from a
  file the user could not see, holding an *older* set of readings. Don't reintroduce a
  mirror "for safety": a user who cannot tell which copy they are looking at is worse off
  than one who lost a file.
- **The migration that replaced it destroyed a project's readings. Read this before
  writing another one.** It matched legacy entries by node id; node ids embed `@line`;
  the lines had moved. So it wrote almost nothing, that write returned `Ok`, and the code
  deleted the source because `Ok` looked like proof. Two rules fall out: never key
  anything durable on a node id (that is what `key_of` is for), and never gate a
  destructive step on a write returning `Ok` — read the result back and check it.
- **A format change is not a data change, and there is never a migrator. `sanity refresh
  <repo>` is the whole mechanism.** The store is Markdown that is parsed back, so a shard
  written by an older renderer reads fine and comes out in today's format: `parse_shard`
  takes a heading as everything before the em-dash and recomputes what follows it on write.
  Rewriting is therefore reading and writing, which is exactly what a translator is not —
  and a translator is the thing that destroyed a project's readings above. **When the format
  changes, run `refresh` over the corpus and read the diff.** Headings and prose moving is
  the change working; a changed BULLET is a reading that did not survive, and one entry
  vanishing should be a function that no longer exists.
  It runs **in-process, never through the backend**, and that is the point of it existing at
  all: the daemon answering may be an app somebody started this morning from a binary that
  renders the format you are leaving, and `serve` is idempotent, so a newer binary politely
  declines to replace it. A verb whose job is "apply THIS build's format" cannot be a
  formatter over a server of unknown vintage.
  The one durable constraint this rests on: a shard must still PARSE under the old reader
  long enough to be re-rendered by the new one. Adding a bullet, or moving decoration after
  the em-dash, is free. Changing what a key is made of is not — that is the same class of
  change as the migration that failed.
  **Adding a graded INPUT is a different thing and does cost readings.** `reading_hash` now
  covers the file header, so the first refresh after that landed expired every function in a
  file that has one — 24 of 24 in one shard of a real user's repo, 0 of 1,654 in another
  where the sources carry no headers. That is the staleness rules working: a reader saw a
  different prompt from the one the reading was made against. Expect it, say so out loud
  before handing the diff to somebody, and never confuse it with the format rewrite it
  arrives beside.
- **What a grade MEANS is an input, and `reading_hash` cannot see it. That is what `spec`
  is for.** The hash covers the file header, the doc and the body — every input except the
  question the reader was asked — so rewording an ask expires nothing and the old grades
  read as current while answering a question that no longer exists. It is not theoretical:
  `legible` described its top rung only, and across three repos and 6,900 readings the
  bottom rung was used **zero** times while 84–92% sat at the top.
  **One number for the whole reading, and the store never says what it meant.** A reading
  records `spec N` on its provenance line; `SPEC`, `LEGIBLE_SINCE` and their siblings in
  `assessment.rs` record which bump changed which axis. The store holds the fact, the code
  holds the judgement — and a judgement belongs in a diff somebody can review, not in a
  number an agent wrote into a file we then have to trust. Per-axis stamps were drafted and
  rendered as `predicted 1 · documented 1 · legible 2`, three integers in the same visual
  slot as four grades: a provenance line that reads as a score sheet.
  It is stamped **server-side**, beside `body`, `by` and `at`, for their reason — a reader
  asked to declare which question it answered could name the one that makes its grade look
  current, which is the claim the field exists to test. Absence is `0`, meaning "question
  unknown", never "the current one".
  **An expiry a person cannot work off is worse than no expiry.** A superseded answer used
  to be unreachable: the reading still described the body, so `collect_tasks` returned early
  and the grey stayed until somebody happened to edit that function. It re-queues now,
  ranked below both — stale means the reading describes code that is gone, unread means
  there is no reading at all, dated means a good reading with one answer greyed — and the
  bands do not overlap, so a run works them in that order. It re-queues for an ORDINARY
  reading, never for the missing answer alone; that distinction is the next paragraph but
  one. `dated_axis` is the single definition, because the shard counter, the queue, the map
  and the panel all have to agree about it.
  **A bump expires an AXIS, not the reading.** `predicted` is the expensive half — it can
  only be answered once cold — and discarding 6,900 cold predictions to fix a legibility ask
  would be the worst trade available. A dated grade is kept and shown as history; what it
  does not do is colour, count or bucket. `legibleOf` is the single accessor so the lens, the
  breakdown, the dial and the spread cannot disagree.
  **There is no single-axis re-read pass, and the reason is not cost.** Backfilling one
  expired axis by asking readers only that question is the obvious move — `legible` is
  graded after the body is open, so it looks like the cheap half of a reading. It is not the
  same measurement. A reader grades legibility having just predicted this function and been
  caught out or not, and that context is part of the answer; one that only ever opens the
  body is a different instrument. Its grades would land in the same column, under the
  current spec, looking comparable — which is the exact failure `spec` exists to make
  visible, reintroduced one layer down. A bumped axis refills by ordinary re-reading, and
  otherwise stays honestly grey.
  **It degrades in both directions on purpose**: `>=`. A reading from an older build carries
  no spec and is not trusted; one from a NEWER build is, because a later spec refines the
  question and greying out a colleague's fresh work would punish them for updating first. An
  older app never heard of the bullet and ignores it — `parse_shard` drops segments it does
  not know, which is the property that makes adding a field free, and there is a test for it.
  **Spec 2 is `legible`, and it was validated before it was spent.** A reader can no longer
  navigate — source comes bounded from `sanity_reveal` — so "you had to jump around" asked
  about something no reader can do. Spec 1 had also simply not worked: it gave the scale a
  bottom and the bottom stayed empty, 79.5% at the top rung and 1.6% at `some` across this
  repo's 689 graded readings. The rungs now describe what a reader can observe about its own
  pass. Measured on a copy of this repo's own `web/src` before the bump shipped: 65% / 20% /
  **15%** / 0%, so `some` gained nine-fold on the same code. `none` is still unobserved —
  the scale is improved, not proven. **Read the distribution before spending a corpus on a
  reworded ask; that is what the bump costs.**
  **Spec 3 is `trap`, and it came out of reading the store rather than the code.** Across
  this repo's 894 readings the field had drifted into three jobs. Eighteen of thirty-nine
  were what it is for — an ordering assumption nothing enforces, a leak on one path, a
  field order that is load-bearing. Ten restated a hazard **the code already warns about
  in a comment**, which is not news and is the population that teaches somebody to stop
  opening the lens; worse, it scores a documented footgun and an unknown one the same.
  Nine were about the reader — "I underestimated", "a different mechanism than I guessed" —
  which the description already forbade, so the wording was not carrying its weight. Two
  were `true` with no note at all. So the question narrowed on both counts, and the note is
  now **required** with a trap, enforced in the `report` handler because a JSON schema
  cannot say "required when another field is true" (`trap_without_note`, refused rather
  than downgraded to `false`: clearing a reader's judgement to tidy the store is not ours
  to do).
  **A narrowing only expires the YESES.** Every change this question has taken away has
  removed things from it, and a narrowing cannot turn a no into a yes — so a reader that
  looked under spec 2 and found nothing has still found nothing. `trap_dated` is therefore
  `trap && !current`, which cost this repo 39 expired answers instead of 894. The same
  argument does not extend to a graded scale: a reworded `legible` moves grades in both
  directions, which is why that one expires whole.
  **The bump was affordable for a reason worth keeping straight.** `trap` is answered
  *after* the body is open, so it refills on any ordinary re-read; `predicted` can only be
  answered once, cold. Expiring the trap axis costs a grey lens until repos are read again.
  The same reasoning applied to `predicted` would cost six thousand cold predictions and
  should be refused on those grounds alone.
  **A dated axis must not read as an all-clear.** `legible` going grey says "not graded",
  which is honest on its own. A dated `trap` read as `no trap reported` would be the map
  stating a clean bill of health from a question nobody asked — so `trapOf` returns false
  and the lens buckets it with the unread. Two flags (`legibleDated`, `trapDated`) and not
  one, because the axes moved at different specs and a spec-2 reading is current on one and
  superseded on the other.
- **A failed write is reported, never absorbed.** `save_reports` returns an error and the
  `report` handler puts it in `ok`/`error`/`hint` so the agent stops. Silently diverting
  to a hidden file is how a reading looks saved and isn't.

- **Keys are `key_of(path, name, ord)`, never the node id.** Node ids carry `@line` and
  would orphan every reading the moment somebody adds an import. `path#name` alone is
  NOT unique — Swift files hold a dozen `init`s, Rust files hold same-named methods in
  different `impl` blocks — so the second twin takes `#2`, the third `#3`, by position in
  the file. Assuming uniqueness cost 91 functions and two false expiries on one real
  Swift repo; `same_named_functions_in_one_file_stay_apart` is the test, keep it passing.
- **`save` iterates live functions, not reports.** Walking the reports means resolving
  each back to a function by name, which is where twins got confused. From the function
  side each looks up its own reading and compares against its own body.
- **Staleness replaces an update mode.** Each entry records `body_hash` of the body it
  was read against; a mismatch marks it STALE and `collect_tasks` queues it ahead of
  anything unread. So "update my sanity assessment" needs no new verb. The hash collapses
  whitespace on purpose — a reformat must not expire a repo's honest work.
- **Provenance is stamped server-side.** `body`, `by` and `at` are filled in the `report`
  handler from the scan and from git, never taken from the agent. The one field whose job
  is to be checkable later cannot be self-certified.
  **`model` is the exception that proves it, so it is stamped in a pair.** What a reader
  says it is remains self-declared — nothing else can see inside the process — but Sanity
  now spawns the readers, so what was ASKED for is a fact it holds and `asked` records it
  beside the answer. It renders only on disagreement (`asked for sonnet` next to `read by
  haiku`), because agreement is the self-report saying the same thing twice; the case worth
  a human's eye is a run that is not on the scale somebody chose.
  **`harness` rides with it and always renders (`via agy`)**, because the agent is part of
  the instrument rather than packaging around it: one model id is reachable through more
  than one of them, and a system prompt and tool surface are not nothing. It is also what
  makes the Read dialog able to preselect — `banked_harness` and `banked_model` come from
  the corpus, which travels with the repo, rather than from the machine-local index, which
  is one laptop's preference and has never heard of a repo somebody else read. Both are
  `None` when the readings disagree, which is the case where choosing would be wrong.
  Neither is a graded input: out of `reading_hash`, no `SPEC` movement, nothing expires.
- **An open refreshes the assessment's own files; it never creates them.** `save` rewrites
  them on every report, so a repo mid-assessment repairs itself the moment a reading lands
  — but a FINISHED repo never saves again, so it keeps whatever it was written with: prose
  naming a command that has stopped existing, and a table claiming a coverage that expired
  the next time somebody wrote a function. This repo's index said "391 of 391 read, 0
  stale" against a tree holding 453 functions and 27 expired readings. `assessment::refresh`
  runs on `sanity_open`, and `/open` returns `index` so a failed rewrite is reported rather
  than absorbed. **The index and the shards move together** — refreshing only `README.md`
  is worse than refreshing nothing, because the table would say 27 stale while the file it
  links to said 0, so both come out of one `compile` and cannot disagree. **Nothing is
  created**: no `.sanity/` in a repo that has none, no shard that was never written, and no
  write at all unless the bytes differ. An open is a look, and a look that leaves a
  directory behind is a surprise where people run `git status`.
- **Never let a reader see `.sanity/` before it predicts.** Being told what the last
  reader found is recall, not prediction — the same contamination `cold` exists to
  expose. The MCP descriptions say so; keep them saying it. A reader Sanity launched
  cannot reach it at all, which is the point of launching them — but the rule stays
  written down, because a hand-driven session still can and the descriptions are the only
  thing standing there.
- **The repo's own brief is the contamination `cold` cannot see, and it is recorded in two
  halves.** A host that injects `CLAUDE.md` into every subagent hands each reader a
  description of the architecture it is about to predict; the reading comes back honestly
  `cold` — it never opened the file — while being substantially recall. A full pass of a
  real repo shipped with a caveats document reconstructing this from readers who happened
  to mention it in chat, because nothing asked them and nothing warned the human.
  So: `assessment::agent_docs` stamps **what the repo held** server-side, beside `body` and
  `at`, and `primed` asks the reader **what was in its context**. Neither is worth anything
  alone — a reader declaring itself unprimed in a repo with no brief has said nothing,
  while the same report in a repo that has one is the evidence a run was launched clean.
  One provenance segment carries the pair, and renders nothing when the repo has no brief,
  on the same rule as every other absence here.
  **`sanity check` fixes this rather than warning about it**, and that is the one part of
  the priming problem that got solved instead of measured. Sanity launches each reader
  itself, from a directory outside the repo and with the project's own settings excluded
  (`--setting-sources user` on Claude, `--ignore-user-config` and `-C` on Codex), so the
  brief cannot reach a reader's context at all. The remedy used to be a launch flag a human
  had to know about; now it is how readers are started.
  **The warning survives in `/open` only**, and its audience has narrowed to one: somebody
  who has deliberately set `SANITY_ROLE=reader` in their own MCP config and is driving
  readings from a session they built. That is the last way a reading gets taken that Sanity
  did not launch. It went from `sanity study` with the verb; it is not shown to readers at
  all, because a reader's context is built before it can call anything, so telling it costs
  tokens and changes nothing. It is a warning and never a refusal — whether the priming
  matters is a judgement about a specific repo. `primed` is still asked either way, because
  a reader is the only party that can see its own context.
  **The warning ASKS. Asserting made it worse than silence, and that is the lesson worth
  keeping.** All the server can see is that the file exists on disk; whether a session
  LOADED it is invisible to it, exactly as `primed` being reader-declared already says. The
  first version papered over the gap — "each reader arrives already holding a description",
  flat — and the orchestrator that received it was running in a session launched clean an
  hour before, had the evidence to contradict it, and relayed it anyway. Nobody scans for
  what is absent, and a tool that has just stated a fact about the repo is a credible
  source; so a correct belief was overwritten by a wrong one, and reached the human as
  "CLAUDE.md WILL be injected" — stronger than it was written, because the hedge is the
  first thing lost in a relay. **A response that asserts arrives at the person stronger than
  it left, so a tool states what it knows, names what it cannot see, and hands the rest to
  the party that can.** Asked plainly, an orchestrator answers correctly in both directions.
  It is **not** a graded input, so it is out of `reading_hash` and did not move `SPEC`.
  Expiring 6,900 cold predictions to record a condition none of them can now answer would
  be the worst trade available; a corpus taken before the field existed reads as unknown,
  which is the honest shape.
- Nothing is user-scoped. `by:` is provenance to read, not ownership; anyone with the
  repo extends anyone's assessment.
- **A stale reading must not colour its wedge.** `applyAgentReports` drops its score and
  the wedge falls back to the proxy; a hatch (`#stale-hatch`) marks it, and the reading
  stays in the panel as history. Keeping the old colour would be the same sin as a term
  claiming confidence it hasn't got. `node.proxyScore` exists only so this is reversible
  — reports fold into the already-folded tree, so the number being restored has to have
  been kept. Don't drop it because "a rescan supplies a fresh tree anyway"; that is
  ordering luck, not a guarantee.
- **`assessed` excludes stale, everywhere.** `collect_tasks`, `ProjectSummary` and the
  sidebar all agree, so nothing can read as finished while holding expired work. `/status`
  did not — it reported `reports.len()` raw — so the sidebar and the agent driving the
  assessment disagreed about how far along it was, and the agent's copy was the optimistic
  one. `assessed()` is the one definition now; use it rather than the length.

## The tool contract is part of the metric

`mcp.rs`'s `inputSchema` is not documentation — it is what the reader is allowed to say.
**There is exactly one MCP server**, `sanity mcp`, hosted by the app binary; the Node
script that used to sit beside it in `mcp/` is deleted. Do not add a second — two copies
of one contract drift, and this one did: the Rust schema gained the grades, the Node copy
did not, and `.mcp.json` pointed at the Node copy, so every reading taken in this repo
dropped them.

The drift ate four fields: the protocol asked for `predicted`, `documented`, `derivable`
and `model`, Rust could store all four, and the schema declared none of them. Careful readers printed the grades into chat, where they were lost, and
`predicted` was collapsed into the `surprised` boolean. **`derivable` is the defence
against generated docs counting as documentation — it was being collected and discarded.**
When a field is added to `Report`, add it to the schema in the same commit.

- **The descriptions are priced per reading. `just tokens` before and after touching
  them.** At one function per reader, `tools/list` is loaded once per FUNCTION, so an
  `inputSchema` description stopped being editorial and became a per-reading charge.
  Measured on this repo it was 86% of a reader's input floor against 8% for the code it
  exists to read — and 800 of those tokens described three tools a reader never calls.
  Two rules fall out. **The wire carries the rule; the source carries the reason** — the
  arguments behind the rules live in doc comments and here, where they cost nothing per
  reading, and what ships is what a reader must DO plus the one clause that makes it
  stick. **Guidance for the orchestrator goes in the RESPONSE, not the description** —
  `protocol`, `next_step` and `note` reach the one session that asked, at the moment it
  matters, instead of every reader that never will. That is the argument `PROTOCOL` was
  already written down for; it just was not being applied to its neighbours.
- **`PROTOCOL` and `READER_PROMPT` are two constants because they are priced
  differently.** One goes to an orchestrator once; the other is multiplied by the function
  count. `just tokens` first located the boundary by searching for a heading, the heading
  was reworded an hour later, and it silently billed every reader for both halves. A
  boundary worth measuring is worth making structural.
- **A scan is a photograph; the repo is not standing still. Re-cut before handing out.**
  Line numbers come from the scan, while `read_source` and every reader's bounded read go
  to the file as it is NOW — so one edit puts every function below it at the wrong lines.
  The code view highlights the wrong extent, and a reader predicts one function, reads
  whatever now sits at those lines, and grades the two against each other. That is not a
  weak reading, it is a reading about nothing, and nothing in it says so. A reader found
  it from the far end, reporting that the range it was handed held unrelated constants.
  `resync_changed` runs at the top of `queue` — mtime AND length, because two writes in
  one second can share an mtime. It refreshes positions, signature, docs and body hash;
  it does **not** touch node ids (they embed `@line`, they would all move, and re-keying
  the reports map is the shape of the migration that once destroyed a project's readings),
  and it does **not** add functions written since the scan, because those need scoring
  against every peer in the file. Those arrive on the next `sanity_open`.
- **Never report coverage off a lease-filtered list.** `done`/`remaining` did, so 34
  functions out with readers read as finished under "every function has an up-to-date
  reading". `work_left` returns `(remaining, in_flight)`: remaining ignores leases and
  only falls when a reading lands. An instrument that overstates its own coverage is worse
  than one that measures nothing.
- **Coldness is the queue's job, not the reader's.** `interleave_by_file` round-robins
  across files, because scores cluster by file (distinctiveness is file-local) and a
  reader handed 25 from one file is recalling after the first. `cold` is self-reported and
  should be a check, not the mechanism.
- **Ten functions per reader, and the number is the edge of what was measured.** It was
  three, on the belief that a reader ramps: it absorbs idioms, naming, domain vocabulary
  and author style as it works, so its eighth prediction is made by a better reader than
  its first and the map cannot tell that apart from code that is genuinely easier to
  predict. **Two experiments went looking for that and neither found it.** A full pass of
  this repo at three: `full` 39.5% at position 1 against 38.4% later, flat. Forty readers
  at ten on a 10,828-function repo, buckets forty deep: positions 2-10 scattered between
  35% and 55%, slope ≈ 0. 784 readings, two codebases, no warming — so the mechanism that
  argued for a short batch is not in evidence, and assuming it anyway costs 2.5x.
  Cost is the settled half: ~23,110 to enter a reader plus ~3,030 per function, so
  `23,110/n + 3,030` — a hyperbola with no knee, which makes any choice a judgement about
  what saving is worth having. 26,100 tokens per function at one, 10,700 at three, 5,300
  at ten. **Ten is where the measurement stops, not where the curve does. Fifteen might be
  fine and nobody has run it.**
  The one position effect that did show up argues the same way: on the ten-batch repo,
  position 1 graded `full` 27.5% against 41.9% for everything after — first readings
  HARSHER, which looks like a reader hedging before it has used the scale rather than
  anything about the code (z ≈ 1.9, did not replicate, treat as unresolved). If it is
  real, a bigger batch dilutes it. **What would move this number:** down, warming found at
  positions 8-10 with buckets deeper than forty; up, a clean run at 15-25 finding nothing.
  `position` is on every reading and `by_position` buckets per position, so any run adds a
  point to that curve for free — read it before touching the constant.
  **It is not a user-facing control, and a slider for it was built and removed.** The trade
  is real and tempting — one function per reader is five times the cost and about five times
  the speed, which is the honest answer to "why is a ten-function run slow" — but the curve
  has no knee to aim at, so the control offers a choice with nothing to base it on. Worse,
  the batch is a reading CONDITION: it is recorded per reading as `position`, and varying it
  across one repo makes that corpus a mixture in exactly the way two models do, with nothing
  on the map saying which wedge was read under which arrangement. Same rule as `model`. The
  number lives in `agentapi::BATCH`, which `reader_prompt` formats into the ask and the wave
  is sized by, so the two cannot drift.
  The one repo-shaped limit: the queue rests a file after drawing from it, so on a small
  repo a reader deep into a batch gets handed a file it already opened. That bit a
  43-file repo at three and not a 731-file one at ten. **The binding constraint on batch
  size is file supply, not warming**, and `cold` records it honestly when it bites.
- **Ten readings per reader, fetched ONE at a time. Those are two different knobs and
  they got conflated.** The saving is the shared *context*, not the shared *handout*: a
  wave that fetched three times inside one context cost 30,125 per reader against 30,495
  for a true batch of three — the same — and is colder, because a reader handed a batch
  has read every signature, owner and peer list in it before predicting the first. One
  sweep reader said so unprompted and downgraded its own later readings for it. So
  `default_n` is the size of one HANDOUT — 1 — and the protocol asks for ten calls. Equal
  cost, better reading.
- **The batch size is decided in `default_n` and nowhere else.** `mcp.rs` used to carry
  its own `unwrap_or(1)` and send `n` on every call, so when the constant, its doc,
  CLAUDE.md and the protocol text all moved to 3, readers still got one — the only line
  that decided was in the shim. A cold reader found it in the first wave. The shim now
  omits `n` unless the caller asked, and serde fills it.
- **Staleness covers the docs, not just the body.** `documented` and `derivable` grade the
  comment, and `predicted` is made *from* it — the comment stack reaches the reader before
  it opens anything, which is why documenting a repo drains the map. Hashing only the body
  left a documentation grade reading as current when the text it graded was gone.
  `reading_hash(doc, body)` is what `node.body` holds now; it collapses whitespace across
  both, so a reflow expires nothing.
- **`.sanityignore` scopes the repo, and the tool must never decide what goes in it.**
  Whether `tests-unit/` is noise or the most interesting thing here is a judgement about a
  specific codebase, and the tool provider cannot know it. **So there are no defaults —
  especially not tests.** A full pass of this repo found seven tests whose names promised
  properties their bodies never exercised, including the one named for the product's whole
  claim; a shipped default excluding tests would have deleted the best result of the run.
  What the tool does instead is make the decision cheap: `sanity_open` returns `shape`
  (functions per top-level directory) so an agent that has read the repo can put a
  proposal in front of the human *with numbers*, and the human writes the file. Mechanism
  here, judgement from the reader, decision with the person.
  **Every exclusion is counted out loud.** `functions` and `excluded` appear together
  everywhere either does. An exclusion that vanishes from the totals is how a map claims
  completeness over a subset somebody narrowed months ago — the same failure as `done`
  counting leased work. Excluded functions are still parsed and still drawn; what they
  are not is queued, or in the denominator.
- **`by_position` is one bucket per position, and reading it as a curve is the point.**
  It used to collapse to first-versus-later, which answered the wrong question and hid
  that it had: a full pass of this repo at a batch of three found the two buckets flat,
  which reads as "no warming" and actually means "no warming *within three*". The concern
  was always position eight or nine — and per position, forty readers at a batch of ten
  answered it, scattering between 35% and 55% with no slope. That measurement did not need
  a new experiment; any run at any batch size adds a point to the same curve for free, and
  a knee at six would show up as a knee.
- **`peers` is the nearest twenty in FILE ORDER, and the remainder is reported.** It was
  every function in the file, which nobody noticed while the only repo being scanned had
  small ones. Measured: this repo's median task payload was 920 characters with 438 of
  siblings; tonepoet's was **5,213 with 4,759** — 91% — and 30,512 at p90. A full pass
  there would have spent ~20M tokens on lists of function names, twice the entire tool
  contract, which makes it by a distance the biggest thing we control. File order rather
  than alphabetical because the value was never a census: the findings this field earns —
  a test named for a property its neighbours show it lacks — come from adjacency.
  `peers_omitted` exists so a window is never mistaken for a whole file. **Run `just
  tokens` against a repo with big files before trusting any claim about payload size.**
- **The orchestrator must be able to read its own result.** It is the party that has to
  report and the one party forbidden `.sanity/`, and nothing returned a grade — so a real
  run ended with the driving session describing its own measurement from what subagents
  said in chat. `sanity_summary` closes that: **repo-wide aggregates only, never a
  per-file or per-function breakdown.** "38% graded most" tells a future reader nothing;
  "udf.rs averages some" is `.sanity/` with the serial numbers filed off, and one server
  answers both readers and orchestrators.
- **A bare name is not an identity — hand over the `owner`.** One file holds a dozen
  `parse`s, one per descriptor type, and `peers` deduped bare names so the twins collapsed
  to a single entry. Readers predicted one twin, read another, and reported the docs as
  belonging to something else — an invented copy-paste bug in the repo, the same class of
  error as inheriting an enclosing type's docstring. `owner` rides beside `name` and is
  never folded into it: `key_of(path, name, ord)` keys every committed reading, so a
  rename would expire a repo's assessment wholesale.
- **Every endpoint routes by the session's key, and says which repo it answered about.**
  The shim holds the project this client opened (`PROJECT` in `mcp.rs`) and passes it on
  every call, so a human clicking another project in the app cannot retarget a headless run
  mid-flight and two sessions can assess two repos at once. `/status` was the last one
  still resolving through `active` — an orchestrator polled its own run, got another repo's
  `assessed` and `remaining`, and reported a conclusion from them; `queue` and `report`
  meanwhile served its real repo, so one server described two subjects in one run. It was
  caught only because the number happened to be absurd. `active_project()` is gone with it:
  a shortcut past `for_client` is an invitation to reopen the hole in the next endpoint.
  The window's project remains the fallback for a caller that supplies no key, and every
  response names what it answered about (`project`, `repo`) so a mismatch is visible
  anyway. **The key is never in the tool schema** — a model cannot forget, garble or
  compact away what it never carries, and the schema is priced per reading.
- **The backend is per machine, and the window is not a prerequisite for it.** `cli.rs`
  hosts `sanity serve` — the same binary, the same `agentapi`, no window — because the
  state lived in the app's process only from the accident of the app being written first.
  There is one endpoint file, one process and a map of projects, so `sanity check` in a
  second repo is another client, never a second server. Three rules keep it from becoming
  a lifecycle problem. **`serve` is idempotent, not exclusive** — something already
  answering means it prints the port and exits 0, which is the whole of "must not conflict
  with a running UI": the second one never starts. **The daemon stands down when the
  endpoint file stops naming its pid**, so a human opening the app beats a background
  process rather than stranding two servers with one address. **It holds nothing
  precious** — the scan recomputes, the readings are in `.sanity/`, an expired lease
  re-queues — which is why it can idle out on a timer, why there is no `sanity stop`, and
  why `agentapi::lock` recovers from a poisoned mutex instead of honouring it. Poisoning
  protects nothing here and cost everything: one panic under the lock and every handler
  answered empty forever, while `/health` (which touches no state, deliberately) kept
  vouching for the process — so the idle check could not tell how idle it was and never
  stood down. **The idle check must fail closed**; it had an `ok()` that read "I cannot
  tell" as "not idle".
  **`sanity_open` starts one if nothing answers, and any call may heal one that died.** MCP
  being configured used to get an agent as far as talking to a backend and no further —
  somebody still had to open a window, which is the UI requirement wearing a hat. `open`
  is where a cold start belongs because it means "I am starting work": once per session,
  before any reader exists. It was for a while the *only* tool allowed to, which was a lock
  written as a rule about callers — and it failed as both. It never excluded anything (two
  sessions opening two repos are two permitted callers), and it made recovery impossible,
  because the calls that notice a dead backend were exactly the ones forbidden to restart
  it: quit the app mid-wave and every reader failed until a human intervened. **Exclusion
  belongs at the spawn, where it can be enforced.** `take_spawn_lock` is an `O_EXCL` create
  — one atomic syscall, no check-then-claim window, no dependency — and losers wait for the
  winner's backend rather than queueing to start their own. Because `O_EXCL` leaves nothing
  to clean up after a crash, an abandoned lock is stolen by AGE, which is only sound because
  the region it guards is bounded by `START_WAIT`. With that in place `with_retry` heals any
  call, once, gated on a probe — and healing **reopens the shim's own `PROJECT`**, because a
  fresh backend restores in the background and a reader retried into that window gets
  `NO_PROJECT`, which is Fatal by design and loses the reading anyway. The spawn's stdio is
  null because the shim speaks JSON-RPC on stdout, and `SANITY_BACKEND` suppresses it: a
  shim pointed at one server must not quietly start another.
  **A backend that exits retracts its claim** (`release_endpoint`), and only if the file
  still names its own pid — the superseded path is a daemon standing down *because* the app
  wrote its port over the top, and deleting there would take the live backend's address with
  it. Nothing retracted before, so a file always existed, so `mcp.rs` chose its error text by
  file existence and told readers a quit app was "usually TRANSIENT, retry five times". The
  discriminator is a probe now. Errors must say what to do, and that one said the opposite.
  The CLI's read verbs are formatters over `/status` and `/summary` and compute nothing;
  anything they needed that an endpoint lacks belongs in the endpoint, or it is two
  implementations of one answer and the unwatched one goes wrong.
- **Opening a repo is not a claim on the window.** `touch` (history) and `focus` (the
  view) were one call, so any open retargeted the pane — including a headless run in
  another repo, and including the second of two agents working two repos at once, which is
  the hazard `for_client` is written up against. `focus(key, asked)` moves the view only
  when a caller asked outright (`sanity init --show`, the window's own Open command) or
  when nothing holds it — a fresh launch, a headless daemon, an `active` naming a project
  that is not loaded. Nothing is hidden by declining: the project is in the sidebar with
  its own progress, and `/open` returns `showing` so a caller never tells the human to go
  and look at a pane that is still on something else. **`for_client(None)` follows the last
  repo OPENED, never `active`.** Those were the same value only while opening also moved the
  window; once they came apart, a caller with no key — a reader shim that never handled
  `sanity_open` — resolved to whatever somebody was LOOKING at, and `report` takes that same
  path, so the reading would land in another repo's `.sanity/`, attributed and hashed and
  looking entirely genuine. `touched` is the right fallback because every open bumps it and
  no view moves it.
- **Errors must say what to do.** A reader that hit the old flat "Sanity is not running"
  invented a prerequisite, another ran the tools as shell commands, another read
  `.sanity/` to compensate — contaminating itself. `UNREACHABLE` (transient, retry) is
  separate from `NOT_RUNNING` (never started) for that reason. Models fill silence with
  invention.

## The panel answers the lens, not the tab it was born under

The detail pane had one subject whatever tab was pressed. Expected and Found are the
SURPRISE reading, and they were printed under Callers, under Blame, under Clones — so
switching lens changed every wedge on screen and nothing at all in the pane beside them.
`LensPane` is the one section that follows the tabs; everything above it — name, path,
dials, ranks, the provenance footer — qualifies every lens and never moves.

- **An absent measurement is stated, never hidden, and each lens states its own.** The
  scroller used to be gated on `analyzed`, so clicking a grey wedge under Blame answered
  "this has not yet been analyzed" — true about a reading nobody had asked for, and beside
  the point under a lens that reads git. Each section now says what ITS absence is, and the
  two absences that must never merge are the map's own: `wired: false` (this language's call
  shape was never parsed) against an empty list (nothing in this repo calls this, which is
  the finding the lens exists to make).
- **A container gets a section only where it has something of its own to say.** Its pane is
  `Summary`, which already breaks the subtree down under every lens — so a legibility
  section printed LEGIBILITY twice a hundred pixels apart, and a wiring roll-up said "1 of 4
  are called by nothing" directly above the bucket list saying it again with names attached.
  A file keeps four: its own reading, its own header, its own trap, its own lines.
- **Docs is the one section that shows the SUBJECT rather than a measurement of it.**
  `Node::doc` and `Node::signature` were on the wire all along and the browser dropped both.
  The old argument — a file's banner is one click away in its own syntax, and this pane
  shows what was MEASURED — holds under ten lenses and is exactly backwards under the
  eleventh, because Docs grades the header against the body and a grade without the text
  being graded is half of what the reader was handed. It is rendered as PRE, never as
  markdown: a `*` down the left margin of a C comment is a comment marker, not emphasis.
- **Legibility shows `found` and never `expected`, and that division is the section.**
  Surprise is the pair, graded before the body is open; legibility is graded after, at the
  same moment `found` is written. A prose field per axis would be a per-reading token charge
  on every reader forever — `just tokens` before anyone proposes one — and the grade plus
  the pass it describes is what the axis measures.
- **The rung ladder lives here and not in the dial row.** Three of them side by side read as
  a phrase rather than as three readings, which is why `Dials` prints `2/4`; a lens section
  has one grade and all the room, and the rung wording is the reader's own, lifted from
  `mcp.rs`'s schema. A ladder that paraphrased the ask would be the panel quietly asking
  something else.
- **`links.rs` is a lookup table, stored, not a query.** `edges::wire` folded its edge list
  away and `clones::find` kept membership pointing the wrong way, so `14×` under Callers
  raised a question — *which fourteen* — that the app could not answer anywhere. Resolving
  one call needs a repo-wide index of definitions, which means the whole parse, which is the
  one thing a launch off `treecache` never reads (300MB on ceph, 1.3GB on linux). Rebuilding
  it on the click would charge that read to somebody who clicked a wedge. So it is written
  beside the cached tree under the same signature, in its own file, read only when something
  asks. `Scan.links` is `#[serde(skip)]` for the same reason it is a separate file: the
  window is sent a `Scan` on every open and the slim tree cache exists to be small.
  **Adding it moved `treecache::VERSION`** — a tree cached by the old version has no
  `links.bin` beside it, so every warm repo would have shown an empty Callers list, right
  about the file it read and wrong about the code. Same failure as `file_doc` in
  `scancache`, arriving through a sibling file instead of a defaulted field.
- **A row that only NAMES a function is an instruction to go and look somewhere else**, which
  is the thing the count already made you do. Each row carries its body — bounded, scrolled in
  its own box, one click from filling the window (`CodeBlock`). Two sizes and no third: the
  inline box is a glance, and a panel that grows to fit its longest member has stopped being a
  panel. The doc under Docs takes the same box, because a module header is regularly longer
  than the pane is tall. Code scrolls sideways and prose WRAPS — wrapping a line of code moves
  it under its own indentation and invents structure the file has not got.
  **A tile is ONE thing: header on chrome, source on `--code`.** The head was on the pane's own
  ground, which made it indistinguishable from the panel behind it and from the section heading
  a few pixels above — so a row read as a second heading with a code block loose underneath.
  And `--code` is deliberately not one of the chrome's four greys: source goes to the page's
  own EXTREME, white on Paper and Ink in the dark, one step further out than the chrome ever
  goes. In both themes it is the surface furthest from the panel, which is what makes a tile
  something sitting ON the panel rather than a patch of it.
  **A tile scrolls and does NOT contain its overscroll.** `overscroll-behavior: contain` is
  right for a pane and wrong for a box inside one: it stops the wheel chaining out when the
  block reaches its end, so a pane holding a dozen tiles could only be scrolled in the gaps
  between them — and past a certain density there are none. The default chains, which is what
  a code box in a sidebar is expected to do. Clipping the block to N lines fixes the same
  symptom and was tried; it is the wrong fix, because a snippet you cannot scroll is a snippet
  the modal has to be opened for every time.
  **No line count on the row.** It was the one number there and it answered a question nobody
  asked — how long another function is, in a list about which functions these are, with that
  function's source printed underneath where its length is visible. The gutter's line numbers
  are the size cue that earns its place.
  **`SNIPPETS` is a cap and it is counted out loud.** `new` in this repo has 205 callers, and
  fetching every body would read a hundred files to fill a pane nobody scrolls to the end of.
  Past the batch a row says *Show code* and asks for its own — nothing is out of reach, and
  the note says where the batch stopped. Same rule the coverage numbers follow.
  **A span whose name is not at the top of it is reported, never corrected.** A scan is a
  photograph: one edit above a function puts every function below it at the wrong lines, and
  code shown under the wrong name is worse than no code because it looks exactly as
  authoritative. `Snippet::moved` is that check, and the fix for a stale scan is a scan.
  `function_sources` takes a SET of spans and reads each file once — a row per call is a round
  trip apiece and re-reads whatever file the rows share.
- **Every graded section runs grade, then scale, then the thing itself.** Legibility and Docs
  had it opposite ways round — one put the ladder under its word, the other buried the ladder
  below the doc it was grading — which is two shapes for one kind of reading in one pane. The
  grade is the answer, the ladder is what it is out of, and the text is the evidence you go to
  if you doubt it.
- **The provenance line belongs to a READING, and the pinned slot belongs to the lens.**
  `Read by claude-sonnet-5 …` under Blame is true and irrelevant — it names the instrument
  behind numbers that came from git — and `Not read yet` under Age is worse: an absence
  reported at the foot of a section full of measurements. It shows on the four reading lenses;
  otherwise a section may fill the slot itself (`onFooter`), which is where Age's summary
  lives. That sentence is the answer the timeline is evidence for, so inside the scroller it
  sat below the fold on any function with ten commits, and scrolling to it scrolled the
  timeline away.
- **Every row that names a commit opens it.** A sha, an author and a truncated subject is what
  fits beside a timeline or under a wedge, and every one of those rows was a dead end: the next
  question is always *what did that commit actually do*, and the answer was in a terminal in
  another window. `CommitCard` is one `git show` on a click — message and file list, never a
  patch, because the question is what it touched and a two-thousand-line diff in a modal is not
  an answer to it. The sha is validated as hex in Rust before it reaches a shell: the shas
  arriving here come from blame and from the replay's log, and a revision expression built out
  of a string is a place to be careful.
  **It is an ICON, not a click target on the row.** The row was the button for a while, with
  nothing on it saying so — an affordance you have to try in order to find, and a piece of
  information that opens a dialog when you brush it. Same glyph and weight as the code tiles'
  expand, because in this app one mark means "open this in full". In the replay's log it has to
  be a `span` with a role: the row is already a button (it jumps the playhead) and a button
  inside a button is not something the platform renders.
- **A bare number beside a date is a riddle.** The commit rows printed `4` — how many of the
  function's current lines that commit still accounts for, the same figure the author bars
  divide up — and unlabelled it read as a file position, a commit count, anything. The unit is
  spelled out and dimmed, so a column of them still scans as numbers.
- **A number in a section has to be about the rows in that section.** The wiring lists printed
  `localityOf`, which is the share of ALL a function's neighbours living elsewhere — callers
  and callees together — under a heading naming one of them. It counts the rows on screen now:
  *6 of 18 callers are outside src-tauri/src*. A number that is not about what is in front of
  you is worse than no number.
- **Jargon is not honesty.** "15 commits are still alive in these 1,876 lines" is a sentence
  about the mechanism — *alive* means blame still attributes a line to that commit — and it
  asks the reader to know how the instrument works before they can read its output. Say what
  was counted: *these 1,876 lines came from 15 different commits*. The instrument's own caveat
  moved to the section heading's `title`, where it can be found and does not have to be
  scrolled past twice a pane.
- **Under Language, say only what is MISSING.** It listed three facts that all said yes on a
  Rust function — calls resolved, long enough to compare, under git history — which is a list
  of things that are fine in a panel whose job is to point at what is not, and it read as
  noise nobody could place. Gaps only; when there are none, one line saying so.
- **Traps get links and the sentence, never the body.** Every other list carries source because
  seeing the code IS the answer there. A trap is not in its body — it is what a reader wrote
  about what the body does not say — and eleven lines of the function it hides in is the least
  informative eleven lines available.
- **A snippet is dedented to its own left margin.** A method body arrives indented by its impl
  block, and that is four characters of a 260px box spent on a relationship to code that is not
  on screen. The literal shortest common prefix, never a count of levels: a file that mixes
  tabs and spaces has no levels, and normalising one into the other reflows somebody's code on
  the way past. What is copied is the dedented text, for the same reason.
- **"Not measured yet" is a fact about a READING, and most lenses are not readings.** `WedgeTip`
  asked `isAnalyzed` whatever tab was on, so an unread function under Clones — a parse-derived
  lens, whose wedge was on screen in the colour for its answer — hovered as unmeasured. The
  map and its own tooltip disagreed about one wedge and the tooltip was wrong. It asks
  `paintsFromReadings` now, the same gate the stale hatch takes.
- **Clones is two SECTIONS — This function, then Clones — and no paragraph explaining them.**
  A clone list is a comparison; one section holding both sides with sub-headings inside it read
  as a single list whose first row happened to be you. Two headings say the same thing
  structurally, which is the only place it does not have to be read to work. The prose that
  stood above them — same body, names normalised away, a group is a fact not a verdict — is the
  definition of the LENS rather than a fact about the function you clicked, and printed there
  it was re-read on every clone anybody opened. It rides on the headings.
- **A list is exactly as honest as the number above it and never more.** These are the same
  resolved edges: a name is not a target, `new` in one file resolves to that file's own
  `new`, and the panel says so rather than presenting a list as a call graph. Exposing the
  lists makes the instrument's own limits inspectable, which is the argument for showing
  them rather than against.
- **Three time lenses, three pictures, and the shape is the answer in each.** They were one
  dataset in three orders — same two lists, different headline, different order — which is
  decoration standing in for a difference. On the MAP they are genuinely three questions with
  three ramps; the pane now answers each in the shape it wants. **Blame is a list of people.**
  **Churn is a rate, so it is a calendar** — `11 in 90d` is ambiguous between a file somebody
  works on every week and one rewritten twice in a fortnight and left alone, which are opposite
  findings and the pair the second axis exists to separate. **Age is a span, so it is a
  timeline**: "newest line 9 months ago; oldest 9 months ago" is two facts needing arithmetic
  to become the one thing the lens is for, and on a function written in a sitting it reads as a
  bug.
  **`Lifespan`, and the two ENDS are pinned while the run between them scrolls.** It was one
  time-positioned column — spaced by log of how long ago, declumped — and both properties were
  wrong. Spacing by date leaves holes: a function with a burst last week and a tail from 2022
  drew most of its height as blank pane, which reads as something failing to load. And the fact
  the lens exists to give you — when the newest line was written and when the oldest was — was
  two rows separated by however many commits happened to fall between them, so a function with
  thirty put the two halves of one sentence a scroll apart. Both ends now stay on screen at any
  length of history, each tagged as the end it is, because two dates in a column are two dates
  and nobody should have to know the sort order to read them. The name moved with the shape:
  `Age` is a number, and what is drawn is the span.
  **These are FUNCTION views.** A file can be blamed whole, which is true and is not the point:
  the timeline and the calendar are about one body's history, and `Summary` already breaks a
  container down under both lenses — by band, with its members listed — so a file was getting a
  picture of itself directly above a better breakdown of its parts. A container keeps Blame's
  last commit and nothing else, and under Traps it shows a trap or nothing: the absence
  sentences are worth printing about a function, where unread, dated and looked-and-found-
  nothing are three states of one question a reader was asked, and on a file they spend a
  section saying there is nothing here.
  **It scrolls only when it has to, and the cap is MEASURED rather than guessed.** A fixed cap
  clipped ten commits into a 220px box with half the pane empty beneath it — a scrollbar
  offered instead of the space that was already there. `calc(100vh - 360px)` replaced it and
  was the same mistake one level up: 360 is a guess at the name, path, dials and ranks above,
  and the path wraps to two lines on a deep directory while the dials vanish on an unread
  function, so it is wrong by a row either way and Oldest lands mid-pane with a scrollbar. The
  element is asked for its own top instead, against the window's bottom, less the row that has
  to stay under it. And the summary sentence that was pinned at the foot went
  with it: the two ends are already on screen and dated, which is the same fact in the place
  you were looking. `onFooter` and the slot it filled are gone rather than kept for later; an
  unused mechanism is a thing the next person has to work out the purpose of.
  **The caveat rides on the heading, not under every function.** "A floor on its age, not a
  birthday — blame reports the last commit to touch each line, so a rewrite resets it" is the
  reason this lens cannot promise a birthday, and printed in the pane it is a lecture under
  everything anybody looks at. The pinned line is for the ANSWER; the reason is a `title` away.
  **Its bottom is a FLOOR, not a birthday, and the ceiling is a different number.** Blame can
  only see the oldest surviving line, which a rewrite resets. `churn::age_of` — already on the
  file's node, free with the scan — is the honest upper bound, and it is shown ONLY when it
  actually bounds: that function does not follow renames and stops at `MAX_COMMITS`, so a moved
  file can report an age younger than the lines in it, and printing "the ceiling" under a
  larger floor is the panel contradicting itself.
  **On a FILE, Blame is the last commit and nothing else.** `Summary` already breaks a
  container down by author, with each author's functions listed under them, so the per-line
  sections printed a second coarser copy directly above the real one and the pane said AUTHORS
  twice. Per-line provenance stays on the function, where there is no breakdown to duplicate
  and the lines being attributed are the ones on screen.
  **Each week of the calendar carries its own count.** The column beside the grid held the
  90-day bracket and its total — the number already in the heading — so the only annotation
  restated the header while the rows, which are the thing being read, said nothing. A count
  per week turns "a dark cell" into "four commits that week", and blank weeks stay blank,
  which is what makes a busy one visible.
  **The calendar is by FILE and says so.** That is what the map's churn ramp already measures;
  a function's own would mean following its line range through every diff in the history, the
  same trade `blame.rs` refuses for churn. It draws the 90-day window on itself rather than
  describing it, because the dial above is measured over exactly that and nothing else on
  screen said where it ended.
- **Blame answers all three time lenses from one fetch, and says what it is not.** Blame
  reports the commit that last touched each LINE, so this is the provenance of the code as
  it stands, never a list of everyone who has touched the function — a body rewritten
  wholesale reads as new and whoever it replaced is invisible. A true history of a moving
  range is `git log -L`, the same trade `blame.rs` refuses for churn. What changes per lens
  is which half leads and what the headline counts; the measurement is one.
  `blame::range_detail` is its own `git blame -L` rather than a slice of the cached
  `FileBlame`, because that record packs a line down to a commit PREFIX and an author index
  — everything needed to colour a wedge and nothing a person can read. `end` of zero is the
  whole file, so a file and a function ask one question at two scopes rather than two
  endpoints drifting apart.
- **A `→` cannot be a single call, because the thing being jumped to may not exist yet.**
  The window holds a tree with no functions in it and fetches each file's ring when the map
  has somewhere to draw it, so a caller two directories away is a name and a line. `jumpTo`
  holds a REQUEST and an effect resolves it as rings land — through the same `asked`/`landed`
  pair the map's own fetch uses, so nothing is asked for twice and there is no second
  grafting path beside `filled`. It resolves by LINE: a name is not unique in a file, and
  picking the first match is how a jump lands on the wrong twin.

## History is replayed, never re-measured

`history.rs` grows the same rings one commit at a time. It is a second *view*, not a
second metric, and the line between those is the whole design.

- **Surprise is not replayed, and the lens switcher is disabled to say so.** A
  temperature is a reading taken against the code as it is NOW; stamping it onto the same
  function's 2019 body would be the map claiming a measurement nobody took — the same sin
  as a stale reading keeping its colour. What a frame is coloured by is recency, *as of
  that frame's own date*, which is a fact about the commit stream and the only thing this
  module reads. Greyed rather than hidden: remove the switcher and the rings are recoloured
  with nothing on screen saying by what.
- **Nothing before the window makes a claim about its own age.** Functions folded into the
  opening frame have no touch date, so they draw uncoloured. Dating them to the edge of the
  window would open every truncated repo with the entire codebase flaring as though someone
  had just written it.
- **Only changed files are re-parsed.** The obvious implementation checks out each commit
  and scans — a full scan per frame, minutes for a repo the live map draws in a second.
  The walk carries parse state forward and re-parses exactly what each commit touched, so
  the cost is file *versions* in the window, not commits × files. tonepoet: 984 commits,
  17k functions, 57s cold.
- **It must refuse what the scan refuses.** History has no `.gitignore` walker to lean on,
  and the first version drew a committed 161-function mascot bundle the scan skips as
  minified — 769 functions at HEAD against the map's 472, with the largest wedge in the
  story a file the map does not show. `MINIFIED_LINE_BYTES` and `VENDORED` are duplicated
  here on purpose and have to move together. A refused blob yields an EMPTY state, never
  no state, or a file that turns into a bundle keeps its old wedges forever.
- **The cap is a backstop, not a window.** It was 400, chosen against the scrub bar, and it
  cost the feature its point: tonepoet opened with 584 commits already folded in, so the
  directory structure existed on day one and the story started in the middle. Addressing a
  commit is the log's job and the log addresses all of them. 5000, matching `churn`.
- **The cache is machine-local, and that is the same rule `.sanity/` follows from the other
  side.** The repo holds what cannot be recomputed; a timeline is derivable from the repo's
  own object database in full, is megabytes, and changes on every commit — in-repo it would
  be a conflicting blob on every branch and a dirty `git status` after merely looking.
  A failed cache write is silent for the same reason a failed *reading* write must not be:
  nothing is lost that git cannot produce again.
- **A cached timeline is EXTENDED, not rebuilt.** A commit's diff is immutable, so the
  frames cannot go stale the way a score can; a working day's commits are appended and the
  overflow folded into the opening state. `Replayer::resume` derives its parse state by
  folding the frames rather than storing a second copy — a stored copy could disagree with
  the frames, and the disagreement would be invisible, with new commits diffing against a
  state nobody can see. `extending_a_cached_timeline_matches_replaying_it_whole` and its
  fold twin are what keep a warm machine and a cold one telling the same story; keep them
  passing. A rewritten history (`merge-base --is-ancestor` says no) is replayed, never
  appended to — appending would produce a timeline that never happened.
- **The transport sets a DURATION, not a rate.** It was 1×–8× commits per second, and a
  rate cannot be right for two repos at once: eight a second is six seconds of this repo
  and two minutes of tonepoet, so one button meant "a glance" on one project and "go and
  make coffee" on the next. Nobody is choosing commits per second; they are choosing how
  long they will watch. Past `MAX_FPS` the clock SKIPS commits rather than falling behind
  — every frame is computed from its index, so a step of forty is as correct as forty
  steps of one, and the label stays true on a slow machine. The clock must never depend on
  `index`: an effect rebuilt per frame re-reads its own start time, and the replay
  silently overruns the duration it promised.
- **The frontend replay is forward-incremental; the fold is not.** A from-scratch fold is
  linear in how far along you are — 1.3ms at tonepoet's commit 98 and **26ms at 983** — so
  the map got slower exactly as the story got interesting and the top speed was set by the
  tail. `advance` mutates a memoised frame forward; scrubbing BACKWARDS rebuilds, because
  undoing a commit needs the state it replaced, which is the whole timeline stored twice
  and free to drift. Churn therefore keeps touch STAMPS, not a count: the 90-day window
  moves with the playhead, so a count could only be recomputed from the start.
- **Drilling narrows the timeline, and that is a VIEW, not a second fold.** A directory's
  transport and log list only the commits that touched it — otherwise the scrub bar spends
  most of its length on commits that change nothing on screen. But the rings are still
  built at the REAL commit: a commit outside a subtree cannot change what is inside it, so
  the narrowed list is complete for what is drawn, while folding only the scoped commits
  would give the frame the wrong DATE, and the date is what the colour means here.
  `histIndex` therefore stays a real index and the transport speaks positions in the scoped
  list — which is also what makes drilling in and popping back out land on the same commit
  rather than somewhere proportional. The prefix test is segment-wise, or `web/src` takes
  in `web/src-old`.
- **A replay is a periodic-stutter detector for the whole window.** Every timer in the app
  became visible the moment something ran at thirty frames a second, and each one was a
  hitch on a fixed period: the 2s reading poll fetched all 16,925 of tonepoet's readings
  and folded them into a tree that is not on screen during history; the 1.5s project poll
  replaced an unchanged list, which rebuilt the frame tree (`activeProject` is a fresh
  object every poll — depend on its NAME) and re-rendered several thousand arcs. Poll
  results are now compared before they are stored. **If the replay stutters on a period,
  look for a timer, not for the renderer.**
- **Function nodes are pooled; containers are not.** A frame of tonepoet is seventeen
  thousand functions with a `Score` apiece, and building them fresh thirty times a second
  hands a million objects a second to the collector. They are mutated in place instead —
  but dirs and files must stay freshly allocated, because the sunburst recomputes its
  layout when the node it is rooted at changes identity, and a pooled root would freeze the
  map while the data underneath it moved. 700 allocations against 17,000, with none of the
  hazard. A full sequential playback of tonepoet costs 1.1ms a frame.
- **`warm` tops up a timeline; it cannot create one.** Prefetching on open would charge
  every open of every project a minute of parsing for a mode most opens never enter. Once
  a repo has one, keeping it current costs the commits since — so History opens in 0.2s on
  the repo you are actually working in. Ask for it once; never be charged for it unasked.
- **The functions page in beside the deltas that name them.** `tables` used to carry every
  function every version of every file ever had — on ceph 19.8MB of a 20.1MB response, sent
  before a single frame could be drawn. A PREFIX is a complete answer, which is what makes
  it pageable: `intern` appends a function the first time the walk meets it and the walk runs
  oldest-first, so a fold of commits `0..=n` can only name functions from the front of the
  list. `Deltas.ensure` takes the highest index a block mentions and tops `Funcs` up **before**
  the block joins `have()`, because the fold is synchronous and a frame drawn against a hole
  is worse than a frame that waits. The watermark is computed on the window's side: those
  numbers are already being parsed there, and a round trip to be told the maximum of
  something already in hand buys nothing. Measured on ceph: `tables` 20.9MB → 1.0MB, first
  view 22.3MB → 6.9MB. It is not 20× because ceph's opening block is an SVN import that lands
  62,804 functions in its first 2,000 commits — that 4.5MB is genuinely needed to draw the
  frame, and the honest next win is a compact encoding, not a later fetch.
- **The roll-up cut is a share of the CIRCLE, and when you drill the circle is the subtree.**
  `minLoc` is `frame.lines / 4000` — right at the root, and far too coarse anywhere else,
  because the lines it divides were the whole repo's while the wedges being drawn belong to
  one directory. Standing in ceph's `src/mon`, 44,160 lines of a repo hundreds of times
  larger, that meant five functions drawn and everything else rolled into `206+`, on a ring
  with room for hundreds — drilling is the gesture that asks for detail and it could not
  deliver any. The live map never had this: its cull is per-wedge ANGLE, and an angle grows
  when you drill. `frameTree` takes a `scope`, and inside it the cut is that subtree's own
  lines; outside it stays coarse, so the fold is not paying to build nodes nobody will draw.
  The extra pass is the one the incremental `frame.lines` exists to avoid, so it is paid only
  when drilled — at the root there is no scope, no pass, and the arithmetic is what it was.
  The scope comes from the drill STACK, never from `focus`: focus is resolved against the
  tree this builds, so asking it there is a cycle.
- **Two roll-ups, two id namespaces, and the ghosts came from forgetting that.** The replay
  folds a per-file stand-in for everything too thin to draw, and `tileFunctions` mints its
  own for the members a wedge cannot hold — both were `${path}#rest`, and in a replay the
  second rolls up the first, so the pair arrived as siblings in one file's patch array.
  React's answer to a duplicate key is that children "may be duplicated and/or omitted": it
  duplicated one, lost track of the copy, and never rendered it again. That orphan is the
  ghost — a wedge frozen where it was born, sitting outside the rings while the map moves
  under it, cleared only by a remount. The fold's is `#folded` now.
  **What made this findable was the wrong theory dying on one observation**: "they stay in
  place as I move the timeline". Legitimate wedges are rebuilt every frame, so anything that
  holds still is stale by definition, and the deep-narrow-branch story — which is real, and
  does explain the labelled islands like `src/tools/rbd` — cannot explain a mark that never
  moves. Diffing two frames of an exported replay put it beyond argument: the region was
  pixel-identical across 23 seconds while labels 100px away had moved. **A screenshot shows
  what is on screen; a diff of two shows what is not being redrawn.**
- **Dressing the window for a replay waits for the FRAME, not for the request.** `historyOn`
  is a request; on a large repo it is true for a few hundred milliseconds while the map is
  still drawing today. The lens, the sort order, the legend and `morph` were keyed on it, so
  pressing History repainted the live map in Age's greens and then repainted it again as the
  replay's first frame. `replaying` (the request AND a frame to show) is the key for all of
  them, so it happens once.
- **Morphing starts from the picture on screen.** `geo` seeds a wedge the chase has never
  heard of at zero angular width so it OPENS rather than appearing — right for a file that
  shows up mid-replay, and catastrophic for the frame morphing is switched on, when the chase
  has heard of nothing and every wedge on screen is therefore new. The whole map collapsed to
  the hub for a frame and bloomed back out. `soft` is primed from `target` on the first
  morphing render, and primed during RENDER rather than in an effect: `geo` runs first, so an
  effect would prime a map that had already been seeded at zero and the blank frame would
  paint anyway.
- `just history <repo>` is the headless check, and it is UNCACHED by default: a run that
  answers from a file is not a run of the thing being checked. `--files` reconciles its
  totals against `just scan`, which is how the mascot bundle was found.
- **The export records the map on screen; it does not draw a second one.** `movie.ts` copies
  the live `svg[data-sunburst]` per frame and rasterizes it — a Canvas2D renderer of the same
  rings would be a picture nobody has checked against the one being replayed, and the two
  would part company the first time a wedge changed. What the copy has to carry with it is
  everything the document was supplying: the custom properties (resolved from computed style,
  named from the stylesheets — one knows which theme is on, the other knows what to ask for)
  and the label face, inlined as woff2, or the export is set in a typeface the map is not.
  **It is not a realtime capture, and that is the same argument the transport's duration
  rests on from the other side.** On screen a duration is held by SKIPPING commits, which is
  right for something being watched; a file made that way would be as good as the machine
  that happened to make it. The output's clock is the file's — frame `f` is at `f / FPS` —
  so the movie is the length that was asked for and every commit lands. The map is
  re-rasterized only when the commit under the playhead CHANGES: a minute of a forty-commit
  repo is 1,800 frames of forty pictures.
  **The timeline is fetched per frame and awaited, never in one go up front.** The first
  version pulled every delta before drawing anything, on the argument that a block landing
  mid-export would stall the playhead into the file. Awaiting the one commit about to be
  drawn buys exactly that guarantee and never holds more of the story than the export has
  reached — the version that pre-fetched materialised 123,000 ceph commits before the first
  frame, and the export was then reported as hung.
  **An export names its STAGE, because a frame counter cannot tell working from stopped.**
  One frame of a long repo is hundreds of commits of folding, so `Frame 7 of 300` sits still
  long enough to read as a hang, and did. `Tick` carries fetch/fold/raster/encode with a mean
  cost apiece, which is also the only way to find out which of the four is worth attacking.
  **A bigger file is a bigger CANVAS, not a bigger picture of the same map.** Every threshold
  that decides whether something is worth drawing is a pixel size converted through
  `unitsPerPx`, so density is a property of how large the map is being drawn and nothing
  else — an export that reasons about the pane it was staged from is the same picture
  upscaled. `Sunburst` takes a `density` and the export sets it to the file's own width, so a
  4000px movie lays out for 4000px and shows the files a 1000px one culls. The map on screen
  changes for the duration, which is the price of the export recording what is on screen
  rather than drawing a second map; it is behind the dialog, and it goes back.
  **The fold has a threshold too, and it is SQUARED where the ring's is linear.** `minLoc`
  rolls a function up before a node is ever built, so the layout can only draw what the fold
  supplied. A wedge's share of the ring is an angle and falls in proportion to the width;
  a function is not on the ring — `tileFunctions` packs it inside its file's band against an
  AREA, which `unitsPerPx²` already scales quadratically. Scaled linearly, the fold became
  the binding constraint: measured on a synthetic repo of 3,200 files, a 4000px frame drew
  every file and not one more function than a 1000px one. At `density²` the same frame draws
  all 25,600.
  **The codec ladder is H.264 then H.265, and the size is why.** VideoToolbox's H.264
  encoder stops around 8.9 million luma samples — fine for the 16:9 shapes that number was
  written for, brutal for a square, where it lands at about 2985 a side. So 2160² passes,
  3072² would not, and 4000² is sixteen million samples and never had a chance; no bitrate
  or profile negotiates that down. `preflight` tries each codec in turn and returns the one
  that actually encoded ten frames. The fallback is STATED in the dialog rather than silent:
  an `.mp4` that turns out to be H.265 is a different thing to hand somebody.
  **A refusal is the app's own sentence, never the encoder's.** What reached the person when
  4000² failed was WebCodecs' own words — a paragraph about "this browser", naming a profile
  string and a bitrate, in an app that is not a browser and that had another codec and four
  smaller sizes it could have offered instead.
  **The ground is offered as light or dark and never as `system`.** On screen that means
  "follow the machine", which is a live relationship; a file cannot follow anything, so
  offering it would be a coin flip decided by whoever renders.
  Both awaits in the frame loop carry a deadline, and one of them earned it: `decode()` on
  an SVG image is not reliably a promise that settles, and neither is the encoder accepting
  a frame. A wait nothing can interrupt is not one the Stop button can reach either.
  **The encoder stalls at frame seven, and the wait it stalls in has no error path.**
  `CanvasSource` blocks once four frames are outstanding and waits for a `dequeue` event, so
  an encoder that stops dequeuing hangs a promise nothing can catch — there is no exception,
  no rejected promise and no event, only a clock we hold ourselves. Two things are aimed at
  it. `latencyMode: 'realtime'`, which is not about latency here: the default mode lets the
  encoder reorder and look ahead, so it may swallow a run of frames before emitting any,
  which is a deadlock between two components that are each behaving correctly. And a
  **preflight that asks the encoder rather than about it** — ten blank frames at the chosen
  size before the recording starts, because `canEncodeVideo` is `isConfigSupported`
  underneath and it answered yes for a configuration this machine then produced not one
  packet from. Same rule as probing a harness by asking it to LIST its tools.
  Giving it an explicit bitrate (`preferBitrate`, rather than a bare quality level, which
  prefers quantizer-based rate control) was tried first on the same evidence and did NOT fix
  it. It is kept because the quantizer path is the newer and thinner one, but it is not the
  cause. The stage display is what turned "it froze" into a line naming the encoder.
  The MP4 is the one thing this app writes. `save_movie` takes a path from a native save
  dialog, refuses anything that is not `.mp4`, and the bytes cross the IPC base64 because the
  alternative shape for a byte array is a JSON array of numbers.

## Conventions

- Stack: Tauri 2 · React 19 · Vite 7 · Tailwind v4 · tree-sitter · rayon.
- Frontend ↔ Rust is Tauri **`invoke`** (`src-tauri/src/commands.rs`) — no server, no
  sidecar. Same as tally.
- `just check` (Rust + TS type-check), `just test` (the full CI-equivalent, in CI's
  order — web build + `cargo test` + clippy `-D warnings`; passing ⟹ CI passes).
  `just scan <path>` is the headless scorer and the fastest way to test a change to the
  metric.
- **Never launch the app yourself** — `just dev` opens a window; that's the human's to
  run. Verify with check/test/scan. `just cli <verb> <path>` is the headless half, and
  since `sanity check` is how a run starts it is now the more useful one.
- **A GUI app does not inherit your shell's PATH, so never resolve a tool by bare name.**
  Launched from Finder an app gets about `/usr/bin:/bin:/usr/sbin:/sbin`, and coding agents
  install nowhere near it — `claude` in `~/.local/bin`, `codex` in `/opt/homebrew/bin`. So
  `Command::new("claude")` works in every terminal and fails for every user who installed
  the app normally: the Read button would report no agent on a machine holding two. It
  cannot reproduce in development, where everything is started from a shell.
  `Harness::resolve` asks the inherited PATH, then the user's LOGIN shell (`$SHELL -lc
  'command -v …'`, which reads the profile that put the tool there), then a short fixed
  list — and readers are spawned by the ABSOLUTE path it returns, so a run means the same
  thing however Sanity itself was started.
- **The app and the CLI are one binary, and that is what makes shipping the CLI a PATH
  problem rather than a build one.** `sanity` with no arguments opens the window; with a
  verb it is the CLI. `just publish` GENERATES the cask (into `monsterdept/homebrew-tap`),
  so the `binary` stanza that puts `sanity` on PATH is in the justfile beside the rest of
  the release, not in the tap — the tap holds no hand-written file to keep in step. A
  direct download gets the app's own "Install `sanity` command" instead, which symlinks
  into `/usr/local/bin` or `~/.local/bin`. **Never tell anyone to put `Contents/MacOS` on their
  PATH** — `sanity-scan`, `sanity-history`, `sanity-sample` and `sanity-tokens` live there
  too — and never an alias, which no script can see.
- `web/src/lib/mascot.js` is a committed placeholder. `just mascot` replaces it with the
  real bundle from the private lapbar/neo-mascots repo; the placeholder exists so a
  fresh checkout and CI both build without SSH access to that org. Don't delete it.
- New language = a `Lang` variant, a grammar in Cargo.toml, an entry in
  `parse::func_kinds`, and a test in `parse.rs`. The kind names are matched literally,
  so a grammar bump that renames a node goes red rather than silently returning nothing.
  **Read the kinds off the grammar, never off memory** — a kind that doesn't exist matches
  nothing and looks exactly like a language with no functions in it, which is the failure
  the literal matching exists to make loud. Parse a snippet, print the sexp, then write the
  arm. Three constraints decide whether a grammar can ship at all, and all three were hit
  in one sitting:
  - **A grammar that depends on `tree-sitter` as a normal dependency cannot be used.**
    `tree-sitter` carries `links = "tree-sitter"`, so two versions cannot coexist in one
    binary at any price — the resolver refuses rather than miscompiling, which is the good
    case. Grammars that depend only on `tree-sitter-language` are fine at any version.
    `tree-sitter-clojure` fell to this and its `-orchard` fork did not; `tree-sitter-just`
    had no fork and is simply absent.
  - **Extension collisions are decided, not guessed.** `.m` is Objective-C and `.v` is
    Verilog, so MATLAB and V ship nowhere — the loser of a shared extension would have
    functions invented in every one of its repos, and `from_extension` returning `None` is
    the documented default for exactly this. Sniffing the content to break the tie is a
    guess wearing a hat. Prolog took `.pro` because Perl has the stronger claim on `.pl`.
    **`.h` is the exception, and it is decided by ASYMMETRY rather than by claim.** C++ is
    very nearly a superset, so a C header parses under the C++ grammar and yields the same
    functions — htop, 151 files of C, gives 1,426 either way, and the two that differ are
    the C grammar naming functions after an attribute macro and swallowing three into one
    span. The reverse invents: on a real repo's C++ headers the C grammar produced twelve
    "functions" from 583 lines and not one was real — a namespace as a 131-line function,
    a field as a function, a class whose span ran to the end of four siblings, another
    truncated to its first inline member so the reader could not see what it was grading.
    When one direction is lossless and the other fabricates, that is not a tie.
  - **A language with no function unit is not a language here.** HCL blocks, Make targets
    and Nickel's term chain parse fine and mean nothing on a sunburst.
  Grammars are cheap in time and expensive in bytes: 45 of them compile in 16s, and they
  took the release binary from 44MB to 150MB, over a third of it Verilog and SystemVerilog
  alone. Measure the linked binary before adding a big one — the `.o` totals overstate it.
- **`body_span` returns bytes, not a node, because some languages have no body node.**
  Julia, Fortran, the lisps and Visual Basic hang their statements straight off the
  definition, so there is nothing to point at and the body is "everything after the
  header". `header_end` finds that boundary through the grammar's own FIELDS rather than by
  counting children: an optional piece — Visual Basic's return type, Emacs Lisp's docstring
  — shifts every positional index the moment it appears, and the body would silently start
  in the middle of the signature. For every language that does have a body node the bytes
  are identical, which is what makes the span safe to have introduced under the existing
  scores.
- **Adding a language moves `.sanity/` denominators.** A repo holding the new extension
  gains functions it never had, so a finished assessment stops reading as finished. That is
  the staleness rules working, not breaking — but add languages in deliberate batches, or
  the coverage shift cannot be attributed to anything.
- **"Does this release expire readings?" is decided from the diff, by `just expiry`, and
  `just release` gates on it.** Most releases cost nothing — a UI change, an endpoint, a
  reworded warning; the store does not notice. What costs a re-read is a `reading_hash`
  input moving (`file_doc`, `leading_doc`, `body_span`, `header_end`, `file_surface`, the
  hash itself), a parse change, or a `SPEC` bump — and a version bump on its own does NOT:
  re-parsing identical bytes with an identical parser yields identical hashes, so a cache
  drop expires nothing unless the cache was serving something wrong. The gate fails on one
  case only, **UNDECLARED** — a watched function changed and neither `PARSE_VERSION` nor
  `SPEC` moved, so every cache and every stored reading still reports itself as current
  while being hashed against something else. A declared expiry prints what it costs and
  proceeds, because improving the metric is the job; what it must not do is arrive at a
  user as a coverage number that dropped. It compares each watched function's own SOURCE
  TEXT rather than whether its file changed — `parse.rs` and `assessment.rs` move constantly
  for unrelated reasons, and a gate that cries wolf every release is one people learn to
  skip. It was checked against the change that made it necessary: `just expiry 16b3bba~1
  16b3bba` fails.
- **A `#[serde(default)]` field on a cached record IS a format change.** It is the exact
  annotation that lets a stale record load as though it were current, so adding one without
  bumping `FORMAT_VERSION` is not a small omission — it is the whole failure. `file_doc` went
  into `scancache::Entry` that way, so every entry cached before it went on loading as
  `file_doc: None`: in any repo with a warm cache the readers were handed **no file header
  at all** while everything downstream believed they had one, and their `reading_hash` values
  were computed without it. Nothing was visibly wrong for months. It surfaced as an
  unexplained mass expiry across every repo at once — flox lost 78 readings in a session
  nobody had pointed at it — the moment an unrelated version bump finally dropped those
  caches. **The expiry was the honest part**; the silent months before it were the bug.
  `a_new_cached_field_cannot_be_added_silently` pins the field set so the next one costs a
  deliberate look.
- **A parser change is not a file change, and every cache gates on file changes. Bump
  `parse::PARSE_VERSION`.** `scancache` keys on `(mtime, len)` and a content hash, `history`
  extends a stored timeline; all of it correctly answers "have these bytes changed" and none
  of it can see that the parser moved. So a repo scanned before the change keeps serving the
  old answer until somebody edits the files, and nothing says so. Mapping `.h` to C++ took
  one repo from 1,682 functions to 1,724 while the app went on reporting 1,682 from an
  hour-old cache — and `just scan`, which is uncached by design, reported the truth, so the
  two disagreed with no way to tell which was live. History is the worse half: a timeline is
  EXTENDED, so mismatched frames would be appended to matched ones and produce a story that
  never happened. The constant lives in `parse.rs`, next to the things that break it, and it
  covers a new `Lang` or extension mapping, `func_kinds`, `name_node`, `body_span`,
  `header_end`, `leading_doc`, and a grammar dependency bump. A needless bump costs one
  re-parse; a missed one is silently wrong for as long as the files sit still.

## Commits

Never commit without being explicitly asked — every time. Never add co-author credit.
