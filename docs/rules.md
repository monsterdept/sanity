# Rules

A **rule** is a short condition over measurements. Every function or file that meets all of a
rule's conditions is a **finding**. Sanity ships about two dozen rules; a repo can change
their numbers, turn them off, and add its own.

## What a rule looks like

```
func: loc >= 200 and illegible >= 0.6
```

- **A population**: `func:` (each function) or `file:` (each file).
- **One to four clauses**, joined by `and`. Each clause is a field, an operator and a number.
- **Four operators**: `>=`, `>`, `<=`, `<`. There is no `==`, no `or` and no parentheses.
  For "equals zero" write `< 1`; for "not zero" write `>= 1`. Two rules cover what `or` would.
- **No names, paths or globs.** A rule is about what was measured, not what something is
  called. To leave code out entirely, list it in `.sanityignore`.

Rules that ask about a reading (`surprise`, `doc_relevant`, `illegible`, `trap`) find nothing
until readings exist, and `commits` finds nothing until the repo's history has been traced.
The rules view in the app says which rules are waiting and why.

## Fields

Grades are on a 0–1 scale where higher means more of the named quality: a reader's `full`
is 0.08 on `surprise` and `illegible`, and 0.95 on `doc_relevant`; `none` is 0.92 and 0.0.

| Field | For | What it is |
|---|---|---|
| `loc` | func, file | Lines. |
| `ncloc` | func, file | Lines holding code: not blank, not only a comment, not the docstring. |
| `funcs` | file | How many functions the file holds. |
| `callers` | func, file | Call sites elsewhere in this repo, tests included. |
| `dependents` | func, file | Callers that aren't this repo's own tests. Absent where tests can't be told apart. |
| `calls` | func, file | How many functions defined in this repo the body calls. |
| `under_test` | func, file | 1 if a test calls it directly, 0 if none does. Not coverage: nothing is run. |
| `clone_count` | func, file | How many bodies are in its clone group. |
| `cognitive` | func, file | The raw complexity count: each fork costs one, plus one per fork it's nested in. |
| `tangle` | func, file | Complexity for its size, 0–1, as the Complexity lens paints it. |
| `age` | func, file | Days since the code first appeared. |
| `touched` | func, file | Days since anyone changed it. |
| `commits` | func, file | Commits that changed it in the narrowest churn window. |
| `headcount` | func, file | How many people's lines are standing in it. |
| `doc_present` | func, file | 1 if there is a doc comment at all, 0 if not. |
| `header` | func, file | 1 if it's a declaration rather than an implementation. |
| `read` | func, file | 1 if it has a current reading, 0 if not. |
| `surprise` | func, file | How far the reader's prediction missed, 0–1. Needs a reading. |
| `doc_relevant` | func, file | How well the documentation explains the code, 0–1. Needs a reading. |
| `illegible` | func | How hard the reader found it to follow, 0–1. Needs a reading. |
| `trap` | func | 1 if a reader flagged a trap. Needs a reading. |
| `file_loc`, `file_funcs` | func | Lines and functions in the file this function is in. |
| `file_headcount` | func | How many people have lines standing in that file. |
| `repo_headcount` | func, file | How many people have lines standing anywhere in the repo. |
| `repo_age` | func, file | How many days the repo has existed. |

`repo_headcount` and `repo_age` are the same for everything in a repo, so they decide whether a
rule applies to the repo at all. `fossil` uses `repo_age >= 1095` so that it only runs on
repos old enough for "untouched for five years" to be possible.

## Where rules live

- **The shipped rules** are built into Sanity.
- **`.sanity/rules/README.md`** lists every rule that ran on the last scan: its name, what it
  asks and what it says. It is regenerated on every scan, so editing it does nothing.
- **`.sanity/rules/catalog.md`** holds what this repo has changed, and nothing else. It
  doesn't exist until you change something. Everything not listed in it runs as shipped.

Both are committed with the repo, so everyone working in it gets the same rules.

## Changing a rule

Each line of `catalog.md` starts with the rule's id, then segments separated by `; `.

**Change a number.** Write the rule's expression with your number:

```markdown
- `giant-illegible`; func: loc >= 333 and illegible >= 0.6; was: func: loc >= 200 and illegible >= 0.6
```

The app and `sanity findings balance --apply` add the `was:` segment, which records the shipped
rule you tuned. If a later release changes which fields that rule asks about, your number no
longer answers the same question, so it is dropped and the new shipped rule runs.

**Turn a rule off:**

```markdown
- `crowded-file`; off
```

**Go back to the shipped rule:** delete its line. Delete the whole file to reset every rule.

## Writing your own rule

A rule Sanity doesn't ship needs an id, an expression, a title and a "so what" line:

```markdown
- `hot-paths`; func: dependents >= 20 and commits >= 4 and ncloc >= 10; title: Hot paths; so what: Widely depended on, and changing often.
```

- **The id** is yours to choose. If it matches a shipped rule's id, the line is read as a
  change to that rule instead. Decisions are filed under the id, so keep it once you've made
  it; the title can change freely.
- **The title** is the heading on the finding. **So what** is one sentence saying why it
  matters.
- **`says:`** is optional: a longer sentence with values filled in, such as
  `says: {{dependents}} functions depend on this, and it changed in {{commits}} commits in the last {{window}} days.`
  A `{{token}}` can name `name`, `path`, `loc`, `ncloc`, `funcs`, `median`, `threshold`, or a
  field the rule's own clauses use. `age_years`, `touched_years` and `window` count as `age`,
  `touched` and `commits`.
- **Add a size clause** such as `ncloc >= 10`. Below about ten lines, most of what can be said
  about a body is said by its signature. Most of the shipped function rules have one.

A line Sanity can't read is ignored. For a shipped rule that means the shipped version runs;
a rule of yours that can't be read, or has no title, doesn't run at all. The rules editor in
the app writes the same lines, checks them as you go, and refuses a clause that every subject
would pass.

## What an edit does to your decisions

A decision (fix, snooze, accept, wrong) is recorded against the finding's measured values,
not against the rule's numbers.

- **Changing a number** changes which findings exist. Decisions stay as they were.
- **Changing which fields a rule asks about** brings back findings you snoozed or marked
  wrong, because the rule is now asking a different question.
- **Accepting a finding permanently** survives any edit.
- **Turning a rule off or deleting it** keeps its decisions. They apply again if a rule with
  that id comes back.

## Tuning the whole set

If the list is too long or too short to be useful:

```sh
sanity findings balance --target 20          # propose thresholds that give about 20 findings
sanity findings balance --target 20 --apply  # save them to catalog.md
```

Balance only tightens a rule, and only the one clause each rule is tuned on; it never loosens
a shipped threshold or changes a reader's grade. The rules view in the app has the same
**Balance** control, and shows for each rule how many findings it produces and what share of
the repo they cover.
