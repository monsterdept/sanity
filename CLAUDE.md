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

**Do not go back to generating a rival body and diffing it.** That was tried three ways
and the noise floor sits above the signal — a model never reproduces real code token for
token whether or not the code was predictable.

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
- **Never let a reader see `.sanity/` before it predicts.** Being told what the last
  reader found is recall, not prediction — the same contamination `cold` exists to
  expose. The MCP descriptions say so; keep them saying it.
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
- **Three functions per reader. The flaw was never warmth, it was RAMPED warmth.** The
  protocol asked each subagent for ten, and `cold` only ever asked "had you read this
  FILE?" — so it saw nothing of the idioms, naming, domain vocabulary and author style a
  reader absorbs as it works. By its eighth prediction that reader is better than it was
  at its first, and the map cannot tell that apart from code that is genuinely easier to
  predict; readings inside one run were not comparable to each other.
  **`default_n` is the knee of a measured curve, not a preference.** It was briefly 1, on
  the belief that isolation was also cheaper. It is not: `just tokens` plus a 1/2/3/5/8
  sweep puts a reader at ~22,100 fixed + ~1,010/turn at two turns per function, fitting
  every point within 1% — so `22,100/n + 2,020` per function, falling monotonically with
  no optimum. 1→3 captures 61% of every token batching can save; past 5 the saving is a
  few hundred tokens and what it buys is a scale that widens inside each run. **Re-run
  `just tokens` and the sweep before moving it.**
  The validity half is still unsettled: `later` graded 36% `full` against 29% for `first`
  — right direction, not significant on 54 readings, and confounded because the
  unbatched readers ran first and took the top of a proxy-ranked queue. Settling it needs
  n=1 and n=k interleaved in one wave. `position` is on every reading so that experiment
  moves this constant and nothing else.
- **Three readings per reader, fetched ONE at a time. Those are two different knobs and
  they got conflated.** The saving is the shared *context*, not the shared *handout*: a
  wave that fetched three times inside one context cost 30,125 per reader against 30,495
  for a true batch of three — the same — and is colder, because a reader handed three
  tasks has read three signatures, owners and peer lists before predicting the first. One
  sweep reader said so unprompted and downgraded its own second and third readings for it.
  So `default_n` is 1 and the protocol asks for three calls. Equal cost, better reading.
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
  was always position eight or nine. Per position, any run at any batch size adds a point
  to the same curve for free, and a knee at six shows up as a knee.
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
- **Errors must say what to do.** A reader that hit the old flat "Sanity is not running"
  invented a prerequisite, another ran the tools as shell commands, another read
  `.sanity/` to compensate — contaminating itself. `UNREACHABLE` (transient, retry) is
  separate from `NOT_RUNNING` (never started) for that reason. Models fill silence with
  invention.

## Conventions

- Stack: Tauri 2 · React 19 · Vite 7 · Tailwind v4 · tree-sitter · rayon.
- Frontend ↔ Rust is Tauri **`invoke`** (`src-tauri/src/commands.rs`) — no server, no
  sidecar. Same as tally.
- `just check` (Rust + TS type-check), `just test` (the full CI-equivalent, in CI's
  order — web build + `cargo test` + clippy `-D warnings`; passing ⟹ CI passes).
  `just scan <path>` is the headless scorer and the fastest way to test a change to the
  metric.
- **Never launch the app yourself** — `just dev` opens a window; that's the human's to
  run. Verify with check/test/scan.
- `web/src/lib/mascot.js` is a committed placeholder. `just mascot` replaces it with the
  real bundle from the private lapbar/neo-mascots repo; the placeholder exists so a
  fresh checkout and CI both build without SSH access to that org. Don't delete it.
- New language = a `Lang` variant, a grammar in Cargo.toml, an entry in
  `parse::func_kinds`, and a test in `parse.rs`. The kind names are matched literally,
  so a grammar bump that renames a node goes red rather than silently returning nothing.

## Commits

Never commit without being explicitly asked — every time. Never add co-author credit.
