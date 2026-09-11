# The report

File → Export Report as PDF… (⇧⌘E) writes the project's analysis as a PDF built to stand on its
own, like a paper. It opens with a cover (wordmark, abstract, methodology), then a contents page,
one section per lens the repo can paint, and the findings: an overview, then each group of
findings on a map zoomed to where they are. `web/src/lib/report.ts` lays it out and draws it,
`lib/reportProse.ts` holds the words, `lib/pdf.ts` writes the file, and `ReportDialog` asks for it.

- **The prose is its own, and not the lens reference.** `LensHelp` is a lookup for somebody
  already on the map. A report is read by somebody who has never seen the app, so each lens gets
  an essay (Definition, Instrument, Reading the map, Interpretation, Limitations) and the cover
  gets a methods section. **Every sentence was checked against the code, not the notes**, and
  several notes turned out to be behind it. Change a measurement and the essay describing it is
  now an unchecked claim: read it in the same edit. The markup is small on purpose: `- `,
  `1. `, `*italic*`, `**bold**`, `` `code` ``, and `{slots}` that `methodVars` fills from the repo.
  **Essays carry facts too.** `lensVars` fills each with this repo's numbers:
  - Complexity's band medians;
  - the share of calls resolved;
  - authors and commits;
  - the age span;
  - the churn windows;
  - reading coverage.
  Every token is a whole sentence or nothing: a fact the repo cannot supply fills as empty and
  its sentence goes with it, so no essay prints a zero standing in for a number it lacks.
- **Every page is a picture drawn on a canvas, and the text is pixels.** Three shapes were
  weighed before any was built. pdf-lib with an embedded face gives real text, but the only
  face the app ships is a Latin subset, so a CJK author prints as empty boxes. HTML through the
  webview's print sheet paginates through a WebKit path nothing here exercises and that cannot
  be checked without a window. A canvas falls back to system fonts for any script and
  rasterizes the map through the path the movie already proves. The text can't be selected or
  searched, and that is stated, not hidden. It prints at 240 dpi, JPEG 0.85, always on white
  paper, with `--background` overridden in the map's copy too. There is no dark option: a report
  is a document, and the window's warm light ground prints as a grey wash.
- **Everything is laid out before anything is drawn.** Footers read `n / total` and the contents
  page names pages, so text is set and poured into columns (`flow`, `pour`), findings are grouped
  and paginated, and every page is numbered first. Only then is each figure staged and drawn.
  Nothing in a layout depends on what a staged map turned out to hold. That is why the
  "marked on what holds it" notes go in figure captions, which have a fixed height, rather than
  under each entry, where they would change heights after the count.
- **A lens page is two thirds figure, one third text, and no page head has a subtitle.** Both
  ends were tried. A column-wide figure made the essay the page and the map its illustration; a
  full-width map took the page and left the essay one paragraph under it. So the figure (map,
  numbered caption naming the reading from `settingOf`, key) takes the top 66% of the body, and the
  essay starts at that line on every lens page, in two columns, continuing onto the next page at
  9pt, never clipped. Every lens map is one square, sized for the tallest caption and key, so the
  maps compare page to page. Findings maps stay full width. The one-line hints under titles were
  the switcher's tooltip set in type and are gone; what a figure is drawn at goes in its caption.
- **Each lens ends in tables, set full width after the essay.** `reportTables.ts` decides what is
  in them; `report.ts` sets and draws them, running onto further pages with the header repeated
  and never splitting a row.
  - **Table 1 is the breakdown:** lines and functions per band, with a share bar in the band's
    colour (Language adds files). It replaced a sentence that was a table written as prose. It is
    complete on any repo, because it is `bucketsFor`, which a file answers for when its functions
    were never sent.
  - **Table 2 names examples:** the most complex for their size, the most called, the longest
    untouched, every trap with the reader's own note. It can only name functions the window holds,
    so where it holds fewer than the repo has, the table says how many it could name rather than
    passing a sample off as the top. Blame and Language have no Table 2; the breakdown is already
    the list.
  - **No lens section runs past two pages**, its figure page and one more. When a section would,
    the report gives way in a fixed order and keeps the first layout that fits:
    1. Table 2 down to five rows.
    2. The essay's type down to 8.5pt, then 8pt.
    3. Table 2 down to three rows.
    4. A cast's named rows down to four. Its count row keeps the total whole.
    5. Table 2 left out.
    6. Table 1 left out.
    The essay is never cut, because it explains the figure. Traps start from forty rows and still
    say how many they leave out.
  - **The essay's last page is balanced into even columns first.** A table goes under both
    columns, and an unbalanced last page is one full column beside a few lines, so the table
    started below the full one and the short one's half page stayed empty, which is the space the
    tables were added to use.
- **The map is copied from the screen, as the movie's is** (see [history.md](history.md)).
  `Staged.whole` roots `focus` at the repo, or at `Staged.root` for a group, clears the selection
  veil, stops the reading pulse (a CSS animation a copy has no stylesheet for, so it would print as
  solid wedges), and turns on `tagNodes` in `Sunburst` and `FileZoom`. `whole` applies to
  `focus` and not only to the map's root, because the ranking, the key and the counts all read
  `focus`. The creature is held on the movie's clock, so every figure shows the same face.
  Labels that would print under 4.5pt are dropped from the copy (`pruneLabels`).
- **Two things move after staging, and a figure copied during either is wrong.** A change of root
  is a level change, which animates, and function patches are not drawn while it runs. A denser
  layout also asks for function rings, which arrive in batches. `rest` waits until the rings
  group has pointer events back AND `settled()` (App's `asked` and `landed` both empty) has held
  for 400ms, and copies whatever is drawn after 30s.
- **A lens with nothing to show gets no page.** A grey map would read as a finding. The contents
  page names each skipped lens with `locks[m].why`, the sentence the switcher uses.
- **The key is `lensKey`'s, and so is the window's and the movie's.** The movie's own copy knew
  ramps and ranked casts and nothing else, so Callers, Reach, Clones and Traps had an empty key
  and Composition was coloured by rank. Blame's key names uncommitted lines when the picture has
  any (`holdsUncommitted`); they are a state, never a slot, so they stay out of `legendFor`, which
  `rankCategories` numbers.
- **Findings are grouped by place, not by rule and not by rank.** Rule answers "what kind of
  trouble", which is one page of insight, and the overview's grid of findings against rules
  carries it. Rank answers nothing: a batch of "the next eight" means nothing. A directory is
  what somebody owns, and a map zoomed to it gives each wedge the room a whole-repo map could
  not. `groupFindings` works top-down:
  - a directory with at most 8 findings is one group, zoomed as tightly as they allow (to the
    file, when they are all functions in one file);
  - a bigger directory splits into its subdirectories and files;
  - parts with fewer than 3 are pooled at that level;
  - **nothing else splits, and no two groups share a place.** A file, or a pool, past 8 stays
    whole. The first version cut an oversized pool into runs, and styx's report had
    `internal (8)` and `internal (5)`: the same map twice, split by rank.
  `just group-check` pins it: every finding lands in exactly one group, no place appears twice, a
  group past the cap had nothing under it to split into, and every root holds its findings.
- **One merge, the panel's.** `mergeFindings` keeps one entry per subject with every rule's
  sentence under it. Findings are numbered in the order printed, group by group.
- **A mark points at the drawn path, never at a recomputed layout.**
  - **Match by `finding.key`, not `hit.id`.** A function node's id is `key_of(path, name, ord)`,
    while `hit.id` is spelled `path#name@line`. Asking by `hit.id` matched no function at all.
  - **Colour is the mark.** Each findings map is greyed, and only the wedges holding its findings
    keep their colour. This is done by compositing, not `getImageData`, which WebKit can refuse
    on an SVG-tainted canvas.
  - **A place holds one label.** Marks within a label's width share it (`4 · 8 · 11`), kept
    inside the map's square. On the overview, letters mark each group's region, dashed.
  - **Too small falls back to its container.** Something the map cannot draw falls back up its
    path to the deepest drawn container and is outlined dashed, as `selCoarse` is.
- **An entry breaks at its rules**, so a page break can fall between two rules of one finding,
  and the continuation repeats the number and address.
- **The report is stamped with its commit** (`repo_head`: the short sha, and whether the tree is
  dirty) on the cover, every page head and the PDF title. Readings expire when code moves, so a
  report read next month has to be checkable against the repo. A dirty flag git would not give is
  not reported as clean. The methodology also states which model read the corpus
  (`banked_model`), or that it mixes models and so is not on one scale.
- **The writer is by hand, because a page of pixels needs almost none of PDF**: a JPEG XObject
  (`/DCTDecode` carries the canvas's bytes as they are), a content stream to paint it, and a
  cross-reference table. The table is the part that is easy to get wrong, because a reader seeks
  by offset. `just pdf-check` follows `startxref` and every entry the way a reader would, asks
  poppler's `pdfinfo` too where it is installed, and fails on a one-byte-short entry.
- `save_pdf` sits next to `save_movie`, and both go through `write_export`, which refuses a
  path whose extension is not the kind being written.
