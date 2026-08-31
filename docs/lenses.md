# Lenses

*Source text for the in-app help panel (`web/src/components/LensHelp.tsx`). Edit here; keep the
component in step with it.*

---

## 1. The drawing

The map is a sunburst of the repository. The center is the project root; each ring out is one
level deeper in the directory tree. A wedge is a directory, a file, or a function.

| Rule | Detail |
|---|---|
| Width | Lines of code. Identical in every lens. |
| Color | Set by the lens. Nothing else changes when you switch lenses. |
| Gray | Not measured. Not zero. |
| Directories | No value of their own. A directory's band shows the distribution of values inside it, so a directory holding both old and new code shows both rather than an average. |
| Ramps | Run dim to bright. The sidebar breakdown runs the other way, loudest first, so the two orders are deliberately opposite. |
| Totals | In lines. |
| Sidebar asides | Lens-dependent. Churn shows `N commits`, Callers `N callers` (or `calls N` where it has none), Reach the mirror of that, Clones `1 of N` or `unique`. Every other lens shows `N lines`. |

**Stale readings.** Surprise, Legibility, Docs and Traps come from a reader looking at a
specific body of code. When that body changes, the reading is discarded and the wedge shows as
unmeasured rather than carrying a grade forward onto changed code.

A function's hash covers its own documentation, its body, and the file header. Editing the
module header expires every reading in that file. Changing a sibling function does not.
Whitespace is split out before hashing, so reformatting the repository does not expire anything.

---

## 2. Passes

Three passes produce the data. A lens with no data behind it is locked and names the pass that
would fill it.

| Pass | What it does | Unlocks |
|---|---|---|
| **Scan** | Parses the repository into files and functions. Runs when a project is opened. | Language, Clones |
| **Trace** | Reads the commit log, plus per-line history where a lens needs it. | Blame, Churn, Age |
| **Read** | Agents read each function and file a report. | Surprise, Legibility, Docs, Traps |

**Callers** and **Reach** are not unlocked by a pass. They need the language's call syntax,
which is implemented for most grammars but not all. Where it is missing, the lens says so rather
than reporting zero.

**Files without an extension are not scanned at all.** `Makefile`, `justfile` and `Dockerfile`
are absent from the map rather than drawn uncolored, and they are not in any total. There is no
shebang detection.

---

## 3. Lenses at a glance

| Lens | Kind | Measures | Needs |
|---|---|---|---|
| Surprise | Scale | Predictability | Read |
| Legibility | Scale | Reading difficulty | Read |
| Docs | Scale | Documentation coverage | Read |
| Churn | Scale | Commits behind the code | Trace |
| Age | Scale | Time since last change | Trace |
| Callers | Count | Incoming calls | Call syntax |
| Reach | Count | Outgoing calls | Call syntax |
| Traps | Mark | Reported hazards | Read |
| Clones | Mark | Duplicated bodies | Scan |
| Blame | Category | Last committer | Trace |
| Language | Category | Source language | Scan |

**Scales** place a value along a ramp. **Counts** use four steps. **Marks** are present or
absent. **Categories** are names with no order; colors are assigned by size, largest first.

---

## 4. Scales

### Surprise
**Measures:** how much of a function's body the reader failed to predict from its surroundings,
before being allowed to read the body itself.
**Values:** mundane · typical · quirky · obscure
**Ramp:** mundane (dim) → obscure (bright)
**Needs:** Read

The reader sees the documentation before it predicts. A comment that genuinely explains the code
lowers the score. A comment a model could reproduce from the body alone does not.

### Legibility
**Measures:** the reader's assessment of the body after reading it.
**Values:** clean · nuanced · tangled · unclear
**Ramp:** clean (dim) → unclear (bright)
**Needs:** Read

Independent of Surprise. Code can be unpredictable and clearly written.

### Docs
**Measures:** how much of the body the documentation covers, displayed as the gap.
**Values:** full · decent · some · none
**Ramp:** covered (dim) → undocumented (bright)
**Needs:** Read

Documentation a model could reproduce from the body alone is graded `none`.

### Churn
**Measures:** for a function, the number of distinct commits its current lines come from. For a
file, the number of commits in the last 90 days.
**Values:** no commits found · 1–2 · 3–9 · 10+
**Ramp:** settled (dim) → churning (bright)
**Needs:** Trace

Functions and files are measuring different quantities. The tooltip states which one applies.

### Age
**Measures:** days since the most recent commit to touch the code.
**Values:** older · this quarter · this month · this week · today
**Ramp:** old (dim) → recent (bright)
**Needs:** Trace

---

## 5. Counts

### Callers
**Measures:** call sites within this repository.
**Values:** no in-repo caller · 1 · 2–5 · 6+
**Needs:** call syntax for the language

Calls from outside the repository are not counted. Entry points and public APIs appear uncalled.

### Reach
**Measures:** in-repo functions this one calls.
**Values:** none · 1 · 2–5 · 6+
**Needs:** call syntax for the language

---

## 6. Marks

A mark is present or absent — there is no partial value and no ramp. Containers are never tinted
under a mark lens. A mark inside a directory is drawn as a dot on that directory's ring.

### Traps
**Measures:** whether a reader flagged something likely to catch out the next person editing
this code.
**Values:** trap · no trap reported · not read yet
**Needs:** Read

`no trap reported` means a reader looked and found nothing. `not read yet` means no reader has
looked. The two are different neutrals and can be told apart on the map. A clean wedge is not
proof that no trap exists.

### Clones
**Measures:** functions whose bodies are identical once identifiers and literals are flattened
and comments dropped.
**Values:** a clone · no clone in this repo · too small to compare
**Needs:** Scan

Every clone draws the same color regardless of how many copies exist. The size of the group
appears in the label as `1 of N clones` and in the sidebar breakdown, not in the color.

A near-copy differing by one statement is not detected. Bodies below the token floor are never
compared and are reported separately from finding no clone.

---

## 7. Categories

### Blame
**Measures:** the author of the most recently changed line.
**Palette:** categorical, assigned by size, largest first
**Needs:** Trace

This is last modification, not authorship. A formatting change across many files makes its
author the recorded value for all of them.

How many authors get their own color is set by the **colors** control. The legend names the top
16. Below that there are two different remainders:

- **`N more · shades repeat`** — authors who still have a color, recycled from the unnamed part
  of the palette. They are counted without a swatch because there is no single color to show.
- **`other (N)`** — authors with no rank at all, either past the color cap or unranked. Drawn in
  the structural neutral.

Uncommitted lines and untracked files are shown as themselves.

### Language
**Measures:** the file's language, by extension.
**Palette:** categorical, assigned by size, largest first
**Needs:** Scan

Useful for locating language boundaries, which often do not follow directory names.

`.h` is mapped to C++ unconditionally, so C headers report as C++.

---

## 8. Controls

| Control | Effect |
|---|---|
| **Lens** | Picks the measurement that sets color. Locked lenses name the pass that would unlock them. |
| **Colors** | Blame and Language only. Sets how many categories get their own color before the rest are grouped. |
| **Rings** | How many levels deep the sunburst draws from the current root. |
| **Band** | How much of each directory wedge is given over to the distribution band showing the values inside it. At 0% the band is at its minimum width, a few pixels; it is never off. |
| **Up** | Moves the root one level toward the repository root. |
| **Search** | Finds a file or function by name. |

### History

Replays the repository's commits in order, redrawing the map at each step.

**Age and Churn become relative to the playhead** rather than to today, so a function committed
the day before the frame you are looking at reads as recent.

The speed control sets how long the whole visible story takes in wall-clock seconds, not how
fast individual commits pass:

| Label | Wall clock |
|---|---|
| 0.3x | 100s |
| 1x | 30s |
| 3x | 10s |
| 5x | 6s |
| 10x | 3s |

The story is the commits **in the current scope**. Drill into a directory and 1x is still 30
seconds, now spent on that directory's history alone.

The **bolt** toggles whether the commit under the playhead flashes what it touched. The
**camera** exports the replay as a movie.

---

## 9. Status readouts

| Readout | Meaning |
|---|---|
| **N files too thin · N dirs too thin** | Wedges narrower than one pixel at their own ring's radius, so they are culled. Moves with both window size and ring count. They are still in every total. |
| **N stale** | Readings discarded because their code changed. See §1. |
| **N unread** | Functions or files no reader has looked at yet. |

A breakdown header reading **`N of M`** means the bucket holds M, of which M − N cannot be
listed because the window has not fetched the file ring they live in.
