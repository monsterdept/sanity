# Conventions

## Conventions

- Stack: Tauri 2 · React 19 · Vite 7 · Tailwind v4 · tree-sitter · rayon.
- Frontend ↔ Rust is Tauri **`invoke`** (`src-tauri/src/commands.rs`) — no server, no
  sidecar. Same as tally.
- `just check` (Rust + TS type-check), `just test` (the full CI-equivalent, in CI's
  order — web build + `cargo test` + clippy `-D warnings`; passing ⟹ CI passes).
- **Some rules cannot be regression-tested with threads. Pin the arithmetic instead.** The
  standing rule is that a regression test must fail without its fix; two written this way did
  not, and the reason generalises. A scheduling rule's discriminating moment — an incumbent one
  slot short of the pool with somebody parked — cannot be staged, because a project only ever
  WAITS when the pool is full, so the freed slot is a race and either outcome is legal with or
  without the fix. The first attempt passed regardless; the second passed for the wrong reason
  (the "incumbent is blocked" assertion held because the pool was simply full). So the rule
  lives in `admits`/`contenders`, the same functions the running code calls, with two assertions
  apiece — and the threaded test is kept, honestly labelled as covering only the plumbing
  (registration, wakeup, drop-from-another-thread, clean unwind). **Break each half separately
  and watch it go red**; if nothing does, the test is describing the fix rather than testing it.
- **A proxy is not a measurement, and two cost a wrong conclusion each here.** Python's `json`
  stood in for `serde_json` and put a 142MB parse at 1.5–2.0s where serde does it in 0.23s — off
  by tenfold, in the direction that justified the change being considered. And `ps | grep "git
  blame"` finds nothing while nine of them run, because the command is `git -C <path> blame`;
  that one produced a confident "nothing is running" about a pass that was running flat out.
  **Sample the process** (`sample <pid>`) rather than inferring from its children, and measure
  the real implementation on the real file before deciding it is the bottleneck.
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
  PATH** — `sanity-history`, `sanity-sample` and `sanity-tokens` live there
  too — and never an alias, which no script can see.
- **The app draws no creature.** It had one in the middle of the map, behind a picker that
  also offered a balance wheel and an eye; the question settled on the circles, so the picker,
  the other two and the creature's bundle are gone from `web/`. `just mascot` still builds the
  monsters lib for the WEBSITE's masthead (`website/assets/mascot.js`), and needs SSH access to
  the private repo — nothing in the app or CI depends on it.
- New language = a `Lang` variant, a grammar in Cargo.toml, an entry in
  `parse::func_kinds`, an entry in `parse::call_sites` if its calls can be read off the
  grammar, and a test in `parse.rs`. The kind names are matched literally,
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
- **A call shape is read off the grammar or it is absent, and there is no partial credit.**
  57 of 63 languages resolve calls; the rest paint Callers and Reach grey, which is a stated
  absence rather than a zero, and a test keeps one of them unwired so the two cannot quietly
  become one thing. Wiring thirty-nine in a sitting produced four rules. **A wrong edge is
  worse than a missing one** — PowerShell's `invokation_expression` names its member without
  a field, so reaching for one records `[T]::d()` as a call to `T`; the arm was left out
  rather than guessed at, and the same judgement keeps jq and VHDL absent, where only some
  call forms are distinguishable and the rest would read as honest zeros. **The definition is
  not a call it makes**, which is not pedantry in Elixir and the lisps, where the definition
  IS a call node and matches the very table used to find calls inside it: `walk_calls` refuses
  to match the node it was handed, `skip_fields` covers the three grammars that parse a
  signature or a parameter list as one, and a function's own name never enters its own list —
  Scheme writes a signature as `(a)`, which no grammar can tell from a call. **And a call name
  has to be spellable the way the definition was** — the resolver matches strings, so the
  `[A-Za-z0-9_]` gate every name passed through dropped every edge that used any other
  character, silently: PowerShell is all `Verb-Noun`, the lisps hyphenate everything, Ruby
  and Elixir end names in `?` and `!`, R has `as.data.frame`. Nine PowerShell functions in
  ceph's Windows suite, every line of them a `Write-Output`, reported one call between them.
  `name_chars` is per language for the same reason `skip_fields` is. **What is left
  unwired is a decision, not a queue**: SQL, jq, VHDL, Verilog and SystemVerilog either have
  no call worth the name, or expose only some of their call forms, or wire themselves through
  a different graph entirely — module instantiation is not a call — and a table
  written on hope matches nothing while reading as though it were covered.
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
  TEXT — twice: literally, and again with layout normalised away, so a formatter that only
  rewraps a watched function is REPORTED (`reflowed: parse.rs::file_doc`) and does not fail
  the release, which is the same argument one step further in. String and char literals are
  held out of that normalisation and compared exactly, because whitespace inside a literal is
  content and can reach a reader through `file_doc`. It compares the function rather than whether its file changed — `parse.rs` and `assessment.rs` move constantly
  for unrelated reasons, and a gate that cries wolf every release is one people learn to
  skip. It was checked against the change that made it necessary: `just expiry 16b3bba~1
  16b3bba` fails.
  **A cache format is a THIRD thing to declare, and it costs a recompute rather than a
  reading.** `BANK_FORMAT`, `treecache::VERSION`, `scancache::FORMAT_VERSION` and
  `history::CACHE_VERSION` are watched too, and a move prints `recomputes:` and reaches the tag
  body — never a failure, because rebuilding derived data is what a bump is FOR. It is here
  because v0.18.0 went to bincode and charged every user a whole `git log` on their next
  launch, while a gate watching only reading inputs correctly said "expires nothing" and the
  note said nothing at all. Same property this file exists for, one size down: the user finds
  out from a launch that got slower, and by then it has happened. `PARSE_VERSION` is not in the
  cache list — it is already declared, and its cache consequence is what the output-neutral
  verdict says. `cache.rs::FORMAT_VERSION` is not either: only `Cache::ephemeral` is reachable,
  so bumping it costs nobody anything and a gate that fires over a dead cache gets skipped.
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
  hour-old cache, with nothing on screen saying which number was live. (The uncached
  headless scorer that caught it is gone; `just history --files` is the surviving uncached
  check.) History is the worse half: a timeline is
  EXTENDED, so mismatched frames would be appended to matched ones and produce a story that
  never happened. The constant lives in `parse.rs`, next to the things that break it, and it
  covers a new `Lang` or extension mapping, `func_kinds`, `call_sites`, `name_node`,
  `body_span`, `header_end`, `leading_doc`, and a grammar dependency bump. A needless bump
  costs one re-parse; a missed one is silently wrong for as long as the files sit still.
- **A machine-local cache is named for what its reader refuses on, or two builds fight over
  one slot.** `trees/` and `scans/` were one file per repo, so an installed app and a dev
  build one `PARSE_VERSION` apart each found the other's cache, correctly refused it, and
  wrote its own over the top — every switch cost ceph a full parse and a full blame pass, in
  both directions, indefinitely. `reports::cache_slot` puts the version in the NAME (`p4v8`
  for a tree, `f6` for a scan log), so a refusal costs a lookup instead of the file, and
  `prune_slots` sweeps a slot only once nothing has touched it for a month — **by AGE and
  never by tag**, because the slot that is not this build's is the one the tags exist to
  protect. Timelines take the same treatment, with the window kept in front of the versions
  (`all-p4v5`), so a `--limit` experiment's leftovers age out like anything else.
  **A read has to count as a use, or the sweep eats live caches.** Every one of these has a
  path where a hit writes nothing — a tree whose signature still matches, a timeline with no
  new commits — so a repo that has stopped CHANGING stops touching its files while being
  opened daily, and to the neighbouring build that looks abandoned. `reports::mark_used` is
  one `utimes` on the way in. A build never needs it for its own slot, which `prune_slots`
  spares unconditionally; it needs it for the neighbour's sweep.
- **A parse bump costs the parse, not the blame.** `scancache` used to carry the parser's
  version on the log HEADER and drop the whole store on a mismatch — throwing away a `git
  blame` per file, which is the longest phase of a large scan, to fix the shorter one. No
  parser produces blame and none can invalidate it. The version is per ENTRY now, `look`
  refuses the functions while `cached_blame` goes on answering, and `put_parse` carries the
  blame across because the bytes it was taken against have not moved. What a tag holds and
  what an entry holds follow from the same rule: name it for what makes the whole file
  unreadable, store per-record what makes one half of it meaningless.

## Commits

Never commit without being explicitly asked — every time. Never add co-author credit.
