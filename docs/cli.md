# The CLI

Every command takes a repo path and defaults to the current directory. `sanity <command>
--help` lists its options.

## Taking readings

```sh
sanity init --harness claude --model sonnet   # pick the agent and model for this repo
sanity check                                  # read until done, showing progress
sanity check --readers 8                      # run 8 readers at once
sanity check --limit 50                       # stop after 50 readings
sanity check --detach                         # start in the background and return
sanity status                                 # what the readers are doing, and how much is read
```

`--harness` takes `claude`, `codex`, `opencode` or `agy`. `--model` takes any model the agent
can use. If you stop a pass, you lose only the readings in progress. Finished readings are
saved as they come in, and the next `check` continues where it left off.

## Seeing results

```
$ sanity summary
Project: sanity
  2,455 segments (2,280 functions + 175 file headers)
  2,455 read (100.0%)
  0 unread (0.0%)
  0 stale (0.0%)

                 full   most   some   none
  PREDICTED       696  1,131    412     41
  DOCUMENTED      377    704    302    897
  LEGIBLE       1,905    269     91      0

  24 traps identified
  623 unhelpful doc strings found
```

Some findings depend on git history. `--edits` and `--blame` read that history first so those
findings can appear. On a large repo this takes a few minutes. `sanity trace` reads the same
history ahead of time.

## Deciding on findings

```sh
sanity findings snooze web/src/App.tsx#App --reason "rewrite planned for Q4"   # hide until this code changes
sanity findings allow  src/gen.rs#table                   # this is fine; don't show it again
sanity findings wrong  src/lib.rs#parse --rule giant-illegible   # the finding is wrong; hide until the rule changes
sanity findings flag   src/lib.rs#parse                   # this needs work; keep it listed
sanity findings clear  src/lib.rs#parse                   # undo a decision
sanity findings balance --target 20                       # suggest thresholds that give about 20 findings
sanity findings balance --target 20 --apply               # save them to .sanity/rules/catalog.md
```

## Checking, looking things up and exporting

```
$ sanity verify
  pass  complete        every unit has a reading
  pass  current         every reading describes the code as it stands
  pass  one instrument  claude-sonnet-5 via claude
```

```sh
sanity verify --model claude-sonnet-5         # require this specific model
sanity callers src/edges.rs#resolve           # what calls a function, matched by name
sanity trace --blame                          # per-line blame, so Age works per function
sanity export-data --out report.json          # all the data behind the report, as JSON
sanity refresh                                # rewrite .sanity/ in the current format
```

`sanity` with no arguments opens the app. `sanity mcp` runs an MCP server over stdio, so a
chat agent can open a project and read its status and summary. That agent can't take
readings: it has already seen the repo, so its predictions wouldn't mean anything.
