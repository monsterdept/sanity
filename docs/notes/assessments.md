# Assessments

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
  writing another one.** It matched legacy entries by node id; node ids then embedded
  `@line`; the lines had moved. So it wrote almost nothing, that write returned `Ok`, and the code
  deleted the source because `Ok` looked like proof. Two rules fall out: never key
  anything durable on a node id (that is what `key_of` is for), and never gate a
  destructive step on a write returning `Ok` — read the result back and check it.
- **`.sanity/` has one file at the top and three directories under it.** `README.md` is the
  index; `readings/` holds the shards, `rules/` the finding rules, `findings/` the decisions
  made about them. The shards were loose in `.sanity/` and could not stay: a shard is named
  after a top-level directory of the REPO, so a project with a `rules/` folder produced a
  `.sanity/rules.md` full of readings and wrote it over a different store — and `read_all`
  parsed every `.md` up there as a shard, so the other stores were being read as readings
  already. Nothing a source tree can be called reaches a subdirectory.
  **A shard name is a path, not a segment.** `shard_file` maps `src-tauri` to
  `readings/src-tauri.md` and would map `src-tauri/src` to `readings/src-tauri/src.md`; every
  segment is sanitised on its own, and a segment of nothing but dots is flattened to dashes
  (`..` becomes `--`) because `..` is a direction rather than a name and the link list is fed
  to `remove_file`. `src-tauri.md` is 1.3MB on this repo, so a bigger one will want finer shards: when it does, `shard_of`
  returns a deeper prefix and nothing else moves.
  **The move itself was `git mv`, not the app.** Reading the old flat layout and writing the
  new one is what the no-migrator rule prescribes and it is what the code does — but done
  that way the shard is deleted and re-added in the same commit that rewrites its contents,
  similarity detection has nothing to hold onto, and every reading's history stops at the
  move. `git mv` first, with the bytes untouched, records a 100% rename and `git log --follow`
  crosses it. The code path stays for repos nobody moved by hand.
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
  breakdown, the panel and the spread cannot disagree.
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

- **Keys are `key_of(path, name, ord)`, never a line.** Node ids used to carry `@line`,
  which would orphan every reading the moment somebody adds an import; a function's node id
  is now `key_of` itself. `path#name` alone is
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
  expose. The MCP descriptions say so; keep them saying it. A reader Sanity launched is
  never told where the repo is and runs from a directory outside it, which is the point of
  launching them; a Claude reader is also held to the sanity tools by `--allowedTools`,
  while Codex, opencode and Antigravity readers are isolated by where they run rather than
  by what they may touch. The rule stays written down, because a hand-driven session still can and the descriptions are the only
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
  (`--setting-sources user` on Claude, a private `CODEX_HOME` and `-C` on Codex), so the
  brief cannot reach a reader's context at all. The remedy used to be a launch flag a human
  had to know about; now it is how readers are started.
  **The warning survives in `/open` only**, and its audience has narrowed to one: an
  orchestrator driving readings from a session it built rather than through `sanity check`.
  That is the last way a reading gets taken that Sanity did not launch. It went from `sanity
  study` with the verb; it is not shown to readers at all — a `SANITY_ROLE=reader` shim
  refuses `sanity_open` — because a reader's context is built before it can call anything, so telling it costs
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
- **A stale reading must not colour its wedge.** `readInto` (behind `applyAgentReports`) drops its score and
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

