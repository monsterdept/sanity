import type { ColorMode } from './colorMode'

/**
 * The words a report prints: its methodology and an essay per lens.
 *
 * **Written for somebody who has never seen the app**, which is why this is not the lens
 * reference (`LensHelp`). The reference is a lookup for somebody already standing on the map; a
 * report has to stand on its own as a document, so each lens here is defined, its instrument
 * described, and its limits stated the way a methods section would state them. The two will say
 * different things at different lengths, and that is the point of having two.
 *
 * **Checked against the code when written, and the code is the authority.** Every sentence was
 * traced to the implementation, not to a note or a comment — several notes were found to be
 * behind the code in the process. Change a measurement and the sentence describing it here is
 * now a claim nothing checks, so read the essay for that lens in the same edit.
 *
 * Markup is deliberately small: a paragraph per string, `- ` for a bullet, `1. ` for a numbered
 * item, `*italic*`, `**bold**` and `` `code` ``. `{slots}` in the methodology are filled at export
 * from the repository being described — see `methodVars` in `report.ts`.
 */

export interface Prose {
  heading: string
  body: string[]
}

export interface Essay {
  sections: Prose[]
}

export const METHODOLOGY: { abstract: string; sections: Prose[] } = {
  abstract:
    "This {formNoun} describes one software repository, {repoSlug}, {commitClause}. The unit of analysis is the function: {functions} functions in {files} files, extracted by parsing and totalling {lines} lines. Every measurement is drawn on one radial diagram whose angular width is lines of code. The main instrument rests on a working definition: boilerplate is code a model can predict from its context. A model reader sees a function's name, signature, neighbours and documentation, predicts the body, and only then reads it. Where the prediction fails is where the decisions are. Parse, call-graph and git measurements go alongside the readings, and rules combine them into findings.",
  sections: [
    {
      heading: '1. Unit of analysis and representation',
      body: [
        'Files are parsed with tree-sitter ({grammarClause}). A function is a syntax node whose kind appears in a per-language table. Inline callbacks and class bodies are not units. Files no parser could read ({unparsed}) are counted but not drawn.',
        "The repository is a tree of directories, files and functions, with one ring per level. Angle is proportional to lines, and a file's width is the sum of its functions' lines, so text outside any function adds no width. Each figure colours the map by a single measurement, called a lens, and lenses are never blended. A directory's rim does not show a mean, which over large subtrees drifts to mid-scale. It shows the line-weighted distribution of the whole subtree. Bands too narrow to draw merge only with each other, and a merged band of categories is labelled “other” with a count.",
      ],
    },
    {
      heading: '2. Instruments',
      body: [
        'The thirteen lenses form four families, grouped by the evidence each needs.',
        '*Code shape* needs only the parse. Complexity counts branch points, weighted by nesting, against the median for bodies of similar length in this repository. Composition classifies code as code, header, test, generated or vendored, preferring declared evidence to path conventions. Language names the grammar. Clones groups functions whose token sequences are identical once identifiers and literals are replaced. Bodies under 40 tokens are not compared, and near-copies are not detected.',
        '*Interconnectivity* counts the distinct in-repository functions that call a function (Callers) and that it calls (Reach). There is no type checker. Calls are matched by name within one language family, trying the same file, then the same directory, then the repository; at repository level a name must be defined exactly once. A call through a value the repository cannot identify, such as `xs.collect()`, cannot match a free function. Plausible multiple targets are all credited, and library calls match nothing. The counts are therefore approximate: “no in-repo caller” is not dead code.',
        "*Activity* reads git at three depths: a log walk gives per-file facts, per-line blame gives per-function facts, and a timeline detects which functions each commit changed, by body hash. Blame names whoever last changed a function's lines. Age shows the newest or oldest surviving line on a logarithmic scale spanning the repository's life; the oldest line is only a lower bound on when the code first appeared. Churn counts the commits that changed a function within a {churnWindow}-day window.",
        '*Assessment* relies on model readers: coding agents run as separate processes, started outside the repository and without its instruction files. A reader receives one function (occasionally a whole file): its name, owning type, signature, up to 20 neighbouring names, documentation and file header, but never its body. Its prediction is recorded before the source is served and cannot be revised. The reader then grades how much of the body the prediction covered (full, most, some or none), how well the documentation covers the code, whether that documentation was derivable from the code alone, and how legible the body was. It also describes any trap waiting for the next editor. Surprise comes from the prediction grade, and Legibility, Docs and Traps from the rest. Derivable documentation counts as absent in every score, so text a model could have written cannot make code look explained.',
        'Readings are committed as Markdown under `.sanity/`, each stamped with a whitespace-insensitive hash of body, documentation and file header. When the hash stops matching, the reading is stale: it stops colouring and is queued again first. The application runs no model. A heuristic only orders the reading queue.',
      ],
    },
    {
      heading: '3. Findings',
      body: [
        "A rule names a population (functions or files) and one to three threshold clauses that must all hold. A clause that cannot be evaluated does not match. Thresholds are calibrated once against this repository's distribution, aiming at about eight findings, and saved as fixed numbers. Calibration may tighten a threshold but never loosen it. A finding marks a place worth inspecting; it does not say the code is defective. Generated, vendored and test code raise none. Decisions are recorded in `.sanity/findings/decisions.md` as flagged, fine for now, fine always, or false positive. Fine for now lapses when the code changes, and false positive when the rule changes. This report lists {findings} findings, grouped by where in the repository they occur, each group drawn on a map zoomed to its region.",
      ],
    },
    {
      heading: '4. What the instrument declines to claim',
      body: [
        'Absence is reported as absence. Unread functions, untaught languages, bodies below the clone floor and untraced history are drawn grey, never as zero. A lens with no evidence here is locked and gets no page ({lockedClause}). The ordering heuristic returns an undecided 0.5 when it runs out of evidence. Colours are calibrated per repository and cannot be compared across repositories. “Under test” means a test calls the function, not that its lines were executed. A reading judges explanatory fit, not correctness.',
      ],
    },
    {
      heading: '5. Reproducibility',
      body: [
        'The report is stamped {repoSlug} {commitClause}. Readings expire when code changes, so every claim can be checked against that commit. Each reading records its commit, the model the reader reported (and the model requested, if different), the harness, whether the reader was new to the file, and whether the repository\'s instruction file was in its context. The reader is the scale: readings by different models are not comparable. {readerClause} {assessed} of {readable} functions and files have current readings, and {stale} are stale.',
      ],
    },
  ],
}

export const ESSAYS: Record<ColorMode, Essay> = {
  tangle: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Complexity is a cognitive-complexity score per function body: a count of decision points, where a decision point that nests later code costs one plus the number of decision points enclosing it, and a continuation or logical operator costs one. Files and directories aggregate their functions, as described below. The map encodes a position between 0 and 1, derived from the count in one of two ways.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "The count is read from the parser's syntax tree. Each language has a fixed table of node kinds that count as forks: conditionals, loops, switch or match constructs, catch clauses and conditional expressions. A switch is charged once, however many arms it has. `else if` and its equivalents are charged one without nesting. A run of one logical operator costs one and each change of operator one more, never nested. A plain `else`, recursion and labelled jumps are not charged; closures add no nesting, and their forks count toward the enclosing body. A language with no table receives no score.",
          "The **raw** reading divides the count by a fixed bar of 15, saturating there. The **weighted** reading compares each body with similar-length bodies in the repository. Fixed size bands end at 14, 24, 49, 99, 199, 399, 799 and 1,599 lines, with an open top band; the median count is taken per band over every counted function, and a band holding fewer than 30 bodies merges into the nearest populated band below. The position is (count ÷ median − 1) ÷ 3, clamped to 0–1, with the median floored at one: a body at or below its band median sits at 0, and one at four times the median saturates. A body whose band is empty takes its raw position. Band edges are fixed; medians are calibrated per repository. {tangleMedians}",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "The ramp runs from *low* (dim) to *very high* (bright), with ranges starting at positions 0, 0.05, 0.4 and 0.75: under the raw reading, 0, 1–5, 6–11 and 12 or more decision points; under the weighted reading, roughly below 1.15×, from 1.15×, from 2.2× and from 3.25× the band median. A function in a language without a table is drawn in the unanalysed neutral, *language not counted*: a parser gap, not a simple body. File and directory wedges take the line-weighted mean position of their counted functions, excluding uncounted functions rather than counting them as zero; a directory's rim shows its lines across the four ranges. The page names its reading: *for its size* (weighted) or *raw count*.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'The weighted reading asks whether a body branches more than bodies of its length usually do here. The design notes report rank correlations with line count of 0.48–0.68 for the raw count and −0.03 to 0.25 for the weighted reading, so the weighted map adds what width does not carry; the raw reading serves triage against a fixed bar. Both describe the control flow a reader must hold, not whether a reader understood it: a body bright under Complexity but clean under Legibility has extensive yet conventional control flow, and the reverse indicates difficulty not caused by branching.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Weighted positions are relative to one repository and not comparable across repositories. Normal and below-normal share one colour, so a body simpler than its size suggests is invisible. Fork tables differ by language (Rust's `?` is not charged; Nix counts only `if`), yet medians pool every counted language, tests and generated code, so a mixed repository is judged against a blended norm. The tables are this instrument's own, so scores are not interchangeable with other cognitive-complexity tools, and inline callbacks inflate the enclosing body's count.",
        ],
      },
    ],
  },

  composition: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Composition classifies each function body as one of five kinds. **Code** is written in this repository and marked as nothing else. **Header** is declarations. **Test** is test code. **Generated** is output of a tool. **Vendored** is third-party code kept in the repository. Each classification records its evidence tier: *contract*, a declaration made by the repository or its toolchain; *convention*, a path or naming habit; or *parsed*, the residual classification as code. The unit is the function. Files and directories are described by how their function lines divide among the kinds.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'Classification applies an ordered list of rules, and the first match wins.',
          '1. **Repository declarations.** A path matching a `linguist-generated` or `linguist-vendored` pattern in the root `.gitattributes` is generated or vendored (contract). Only the root file is read, with a simplified pattern matcher.',
          '2. **Generator banners.** A file whose first 400 characters contain, ignoring case, “do not edit”, “@generated”, “code generated by”, “autogenerated” or “automatically generated” is generated (contract).',
          '3. **Headers.** `.d.ts` is a header by contract. `.h`, `.hpp`, `.hh`, `.hxx`, `.pyi` and `.idl` are headers by convention.',
          '4. **Path conventions.** A path segment named `vendor`, `node_modules`, `third_party` or `Godeps` marks vendored code. A segment named `generated`, `__generated__` or `antlr`, or a filename containing `.gen.`, `.pb.`, `_pb2.` or `.min.`, marks generated code.',
          "5. **Test status**, decided per function and only in languages whose calls the parser resolves. Contracts are Rust's `#[cfg(test)]` or a `tests/` directory, and Go's `_test.go`. Conventions are runner filename patterns and test directory names for Python, JavaScript/TypeScript, Ruby and the JVM languages, plus `TEST_` or `test_` function prefixes in shell. A JavaScript or Python project that configures no test runner and holds no test-shaped files is inferred to have no tests (convention).",
          '6. Everything else is **code** (parsed).',
          "Readers' later judgements about whether a body is a test update the call graph, but they do not reclassify Composition.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Each kind has a fixed colour, the same in every repository. The key lists only the kinds present. Code has a colour of its own and is not drawn in grey. The unanalysed neutral, *unplaced*, marks a function with no classification; a fresh scan classifies every parsed function, so this state should be rare. Only function wedges are coloured. File and directory wedges are drawn in the neutral, and a directory's rim shows its lines divided by kind.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "The lens estimates how much of a repository its maintainers are responsible for writing and editing by hand. Where vendored or generated code is a large share, width in lines overstates the maintained surface, and other lenses' findings there describe code nobody edits here. The share of test code indicates investment in tests by line count only, not coverage.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Detecting tests depends on language. C and C++ have neither a contract nor a convention in this instrument, so their tests are drawn as code. Languages whose calls are not resolved never reach the test rule. Conventions can misfire: `tests` can be a domain noun, and `vendor` can hold first-party code. The banner search matches its phrases anywhere in the first 400 characters, so a comment that merely mentions “do not edit” is enough, and a banner placed later in the file is missed. The first four rules are per file, so a file mixing generated and hand-written sections is classified uniformly. A C++ header containing inline implementations counts as a header in full. *Code* is a residual category: it means nothing marked the body as anything else, not that authorship here was established.',
        ],
      },
    ],
  },

  language: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'The Language lens assigns each file the programming language its extension names, and each function inherits the language of its file. The categories are the languages the parser has grammars for. Closely related dialects can be separate categories: TypeScript and TSX, for example, are distinct. Like every lens, the map weights by lines, and here the lines are those of function bodies. {languageCount}',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "A single table maps extensions to languages, and each extension belongs to exactly one language. A file with an unrecognised extension is not parsed and does not appear on the map. File content is never examined to settle the language. Where two languages claim an extension, the table decides: `.h` is C++, `.m` is Objective-C and `.v` is Verilog. A function's length runs from its first line to its last, inclusive, and a file's length is the sum of its functions' lengths. Lines outside any function (imports, top-level declarations, file comments) therefore add no width, and a file with no functions has none.",
          'Categories are ranked by total lines across the repository, largest first, and each rank takes a slot in a 64-colour categorical palette. The palette was chosen to stay distinguishable under the common forms of colour-vision deficiency. Beyond the 64th rank, colours recycle from the unnamed part of the palette. The number of categories given their own colour can also be capped; categories past the cap fold into a neutral *other*.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "The categories have no order, and no colour is brighter or dimmer in meaning. Colour follows rank, so the same language can have different colours in different repositories. The key names the sixteen largest categories and counts the rest, some of which share shades that the key does not identify. Function and file wedges wear their language's colour. A directory has no language, so its wedge is drawn in the neutral, and its rim shows how its lines divide among languages.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "The lens shows where a repository's language boundaries lie, and those boundaries often do not follow directory names. It is also the key to interpreting the other structural lenses, because their coverage is set per language. Callers and Reach resolve calls only within a language family and only for languages with call tables. Complexity requires a fork table, and Clones compares bodies only within a family. A grey region under one of those lenses can be located on the Language map and attributed to the parser's coverage rather than to the code. A seam between two language regions is also where call edges stop being visible.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'An extension is a claim about content, not a measurement of it. C headers are reported as C++ because `.h` is mapped to C++ unconditionally. The unit is the file, so embedded languages (SQL inside strings, templates, inline scripts) are counted as the host language. Because width counts only function lines, languages dominated by declarations, configuration or top-level statements are under-represented compared with their size on disk. Files in languages without a grammar are absent, so the distribution covers the languages the parser supports, not the whole repository. Generated and vendored code is included, and colours cannot be compared across repositories.',
        ],
      },
    ],
  },

  clones: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'A function is a **clone** when at least one other function in the same language family has a body with an identical token shape after normalisation. Each function is in one of three states: a member of a clone group (a group has two or more members), compared with no match, or too small to compare. Group size is recorded as a separate number.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'The instrument walks the leaf tokens of the syntax tree inside the function body; the signature is excluded. Comments are dropped. A token whose grammar kind contains “ident” becomes an identifier placeholder. A token whose kind contains “literal”, “string”, “content”, “number”, “integer”, “float” or “char” becomes a literal placeholder. Keywords, punctuation and operators keep their own kind. The resulting sequence is hashed with 64-bit FNV-1a. A body of fewer than 40 tokens receives no shape and is never compared.',
          'Functions are grouped by the pair of language family and hash. C and C++ form one family, as do JavaScript, TypeScript and TSX, and every other language is its own family. Matching is exact: there is no similarity threshold and no edit distance. Two functions whose bodies differ only in the names and literals they use therefore match, even if their parameter lists differ.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Three states are drawn. Every member of a clone group wears a single mark colour, whatever the size of its group. A function that was compared and matched nothing is drawn in the structural neutral (*unique*). A function under the token floor is drawn in the unanalysed neutral (*too small*). The two neutrals are different claims: the first reports a comparison that found nothing, the second reports that no comparison was made. Group size is not encoded in colour. Files and directories are not tinted, and no histogram is drawn. Instead, a directory's rim carries point marks at the angles of the drawn files that contain clones. A mark shows *where* a clone lies, not *how much* of the directory is cloned.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Duplication is a property of a set of functions. No lens that measures one function at a time can see it, and the reading lenses rate a copy as predictable. The groups found include copy-paste-and-rename, repeated interface or trait implementations, table-driven tests and generated code. Read with Composition, generated and test clones can be separated from duplication in hand-written code. In hand-written code, a group of size *n* means a change to the logic has to be made *n* times. Duplicated helpers also split what would otherwise be one function's Callers count across several copies.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Matching is exact after normalisation, so near-copies are missed: two bodies that differ by one statement, one added guard or reordered lines are not reported. The normalisation is also coarse in the other direction. Because every identifier collapses to one placeholder, bodies with the same structure that call different functions or read different fields are grouped together, and such groups may be semantically unrelated. Classifying tokens by substrings of grammar kind names is an approximation and can misplace a token in some grammars. Bodies under 40 tokens are never compared; in codebases made of small functions this can be most of them, so the absence of marks there is not evidence that code is not duplicated. The unit is the whole body, so a duplicated block inside two larger, otherwise different functions is not detected. Copies across language families, such as a port from Python to Go, and copies across repositories are also out of scope.',
        ],
      },
    ],
  },

  callers: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Callers is, for each function, the number of distinct functions in the same repository whose bodies contain at least one call that resolves to it. A caller that calls the function many times counts once. Recursion is excluded. Test functions count as callers.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'The call graph is built from the parse, without a type checker. Each language has a table of syntax nodes that are calls, and the table includes constructor calls and, for JavaScript and TypeScript, JSX elements. Each call is recorded by its name and by how it was spelled: bare (`f()`), through a value (`x.f()`), or through a path (`A::f()`). A single body records at most 2,048 distinct calls. A call is resolved against every definition of that name in the same language family, as follows.',
          "- If the qualifier names a type or module that owns a definition of that name, those owned definitions are the candidates. `self`, `this` and `Self` name the caller's own enclosing owner.",
          '- A bare name, or a qualifier naming a module or file stem in the repository, is searched in tiers: the same file, then the same directory, then the whole repository, where it resolves only if the name has exactly one definition.',
          '- Any other receiver can reach only methods, and only in the file where the call was written.',
          'Every candidate in the winning tier receives an edge. A call from outside a Rust `#[cfg(test)]` module to a function defined inside one is refused. Unresolved calls, such as those into the standard library, are dropped. A language without a call table receives no value. {callsResolved}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Counts fall into four bands, evenly spaced on the ramp from dim to bright: *none*, *1*, *2–5* and *6+*. A function in a language whose calls are not read is drawn in the unanalysed neutral (*calls not resolved here*). It is separated from the dim *none* band by lightness. A file or directory wedge is coloured by the share of its functions, among those in call-resolving languages, that have at least one in-repository caller. A directory's rim shows its lines divided across the four bands, plus the neutral.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Callers measures fan-in, which is evidence of how much code in this repository depends on a function and so how widely a change to it may travel. Callers and Reach use the same bands and read the two ends of the same edge. A function bright under both is a hub. One bright under Callers alone is a primitive, and one bright under Reach alone is an orchestrator. Clusters in the *none* band hold entry points, handlers and possibly unused code.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Matching by name without types produces errors in both directions. Unrelated functions that share a name within a tier are credited with each other's calls. Calls through variables whose types are defined elsewhere, such as `project.scan()` from another file, are refused, so real callers go uncounted. When a name has several local definitions, each one is credited, which overcounts. Many callers are invisible: calls from other languages, calls by string or reflection, callbacks passed as values rather than called, external consumers of a public API, and invocation by a framework, runtime or test harness. *None* is therefore not proof of dead code. A test caller is not a dependent: changing a function together with its own tests is a single edit. The instrument keeps a separate non-test count, but the map paints callers.",
        ],
      },
    ],
  },

  reach: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Reach is, for each function, the number of distinct functions defined in the same repository that its body calls. It counts resolved outgoing edges. Recursion is excluded, and calls made inside nested functions or closures count toward the enclosing body.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "Reach reads the outgoing side of the call graph described under Callers: the same call tables, the same record of how each call was spelled, the same per-body limit of 2,048 distinct calls, and the same resolution rules. A call counts toward Reach only if it resolves to a definition in this repository within the caller's language family. Calls into the standard library, dependencies, other languages or dynamic targets add nothing. A call that resolves to several candidates in its winning tier adds each candidate, so one written call can raise Reach by more than one. A language without a call table receives no value. {callsResolved}",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "The bands are the same as for Callers: *calls nothing in this repo* (dim), *1*, *2–5* and *6+* (bright). The unanalysed neutral marks languages whose calls are not read. A file or directory wedge is coloured by the share of its call-resolving functions that call at least one function in the repository, and a directory's rim shows its lines divided across the bands. Because the boundaries match Callers exactly, the two maps can be compared band for band.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Reach measures a body's direct coupling to the rest of the repository: how many other in-repository functions a reader has to know to follow it. Functions in the dim band are leaves. They include primitives, pure computations and thin wrappers over external libraries. Bright functions coordinate: controllers, command dispatchers, `main`. Reach is informative when read against Callers. High Reach with low Callers suggests an entry point or orchestrator, low Reach with high Callers suggests a primitive, and both high marks a hub. A function low on both is isolated. High Reach combined with high Complexity marks integration code whose behaviour depends on many parts at once, which is hard to test in isolation.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Reach counts dependence only on code defined in this repository. A body built almost entirely on standard-library or framework calls reads as a leaf. Method calls through variables whose types are defined in other files are refused, so object-oriented code that calls collaborators through fields or parameters is undercounted, often heavily. Ambiguous local names overcount. The measure is direct only: a function that calls one wrapper which in turn reaches most of the system reads as *1*. It counts distinct functions, not call volume. Closures defined inside a body raise that body's Reach. Languages without a call table and calls that cross language families are invisible.",
        ],
      },
    ],
  },

  blame: {
    sections: [
      {
        heading: 'Definition',
        body: [
          "Blame assigns a wedge the name of a person, taken from git's line-by-line attribution of the code as it currently stands. It is a categorical lens with two readings, both reductions of one list: for every line in a body, the author of the commit that last changed that line. The *newest line* reading takes the author attached to the most recently committed line. The *most lines* reading takes the author attached to the largest number of the body's lines. The unit of measurement is the function. A file carries its own name under each reading. A directory carries no single name; it is described by the distribution of its lines across authors.",
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "Attribution comes from git at increasing depth. The first depth is a single walk of the commit log, which yields, for each file, its most recent commit and that commit's author. The second depth runs `git blame --line-porcelain` once per file and records, for every line, the commit, the author and the author time. A function's two names are computed over its own line range. Where only the log walk has run, every function inherits its file's last author and has no *most lines* name. A file's *newest line* name is taken from the log walk at every depth; its *most lines* name requires blame.",
          'Colours are assigned by rank, and the ranking is computed once over the whole commit history, ordering authors by commit count. A person therefore has one colour throughout the map, including within any subtree. The palette holds 64 colours; ranks beyond 64 reuse colours from the part of the palette that the key does not name, and the key names at most sixteen authors. A colour cap, where set, places every lower-ranked author in the single category `other`. {authorsCommits}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Each function wedge is filled with its author's colour under the stated reading. Three states are drawn in neutral tones rather than as people: `uncommitted lines`, where the attributed line exists in the working tree but in no commit; `not in git`, where git holds no attribution for the file at all; and `other (N)`, which collects authors without a rank. A directory's rim shows the share of its lines held by each author. Segments narrower than a pixel are merged only with one another, and a merged categorical segment is drawn as `other` with its count rather than under any member's name.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'The *newest line* reading is a timestamp with a name attached: it identifies who most recently committed within a body. The *most lines* reading identifies whose text the body mostly consists of. The two often disagree, and the disagreement is informative: a one-line correction to a long function makes its author the newest contributor while holding a negligible share. Lines concentrated in one author indicate where knowledge of the code may be concentrated; crossed with Surprise, this locates unpredictable code whose explanation plausibly depends on few people.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Neither reading measures authorship. Blame records the last change to each line, so a wholesale rewrite or a reformatting commit reassigns every affected line to its committer, and earlier contributors disappear rather than diminish. The *most lines* reading resists single-line sweeps but not reformatting. Blame is run without move or copy detection, so code moved between files is attributed to the commit that moved it. The ranking is by commits over the whole history, not by lines in view, so the order of names in the key need not match the widths of bands on the map. Past the named authors, colour does not uniquely identify a person.',
        ],
      },
    ],
  },

  age: {
    sections: [
      {
        heading: 'Definition',
        body: [
          "Age is the number of days since a date in a body's line history. It has two readings. The *newest line* reading is days since the most recent commit time among the lines currently in the body. The *oldest line* reading is days since the oldest surviving line was committed. The unit is the function. Roll-ups preserve each reading's sense: a container's newest-line age is the minimum of its children's, and its oldest-line age is the maximum. The value is continuous; for description it is divided into five bands: `today` (under one day), `this week` (under 7 days), `this month` (under 30), `this quarter` (under 90) and `older`.",
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "Dates come from the same git depths as Blame. The log walk records, for each file, the author time of the oldest and newest commits that touched it. Per-line blame records an author time for every line, and a function's two ages are the newest and oldest of those times within its range. Where only the log walk has run, every function carries its file's dates.",
          "The colour ramp is logarithmic in days and normalised to the repository's own span, defined as the oldest-line age of the repository root. A body of age *d* in a repository of span *s* is placed at 1 − log₁₀(*d*+1) / log₁₀(*s*+1), so the oldest code in the repository always reaches the dim end and code from today the bright end. There is no minimum span. If the span is under one day, every wedge is placed at the bright end. {ageSpan}",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is recent and dim is old. Under the *newest line* reading, the ends are *old* and *recent*: bright marks where commits have landed lately, and dim marks bodies no commit has touched in a long time. Under the *oldest line* reading, the ends are *long-standing* and *new*: bright marks code none of whose lines predate recent work, and dim marks bodies that still contain lines from early in the project, whatever has happened to them since. Wedges with no dates are filed as `history not read`, which states only that the map holds no history for those lines, not whether the repository lacks git or is untraced. A directory's rim shows the distribution of its lines across the five bands under the stated reading.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'The design intent is to locate dusty code, meaning code nobody has been near for a long time. The dim end of the *newest line* reading measures that directly: no commit has changed any line in the body within the period. The *oldest line* reading measures persistence instead. A heavily edited body can be dim under it, because it still contains old lines.',
          'Age alone is weak evidence, since most code in a mature repository is old. Its value is as a second axis to Surprise, which cannot distinguish a subtle algorithm from a mess. Long-standing surprising code is a candidate for careful documentation rather than change. Surprising code that is also changing is a candidate for trouble. Old code that is also surprising, heavily called or undocumented marks three different risks. These crossings are not computed; they are formed by comparing lens pages.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "The oldest surviving line is a lower bound on when code was written, not its origin: a rewrite or reformat resets it. Code moved between files dates from the move. At log-walk resolution, function dates are file dates. Normalisation to the repository's span means an identical colour in two repositories denotes different ages, so the lens supports no comparison between repositories. The logarithmic scale compresses distinctions among very old code.",
        ],
      },
    ],
  },

  churn: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Churn is the number of commits that changed a body within a trailing window of days. For a function, a commit counts if it altered that function\'s body. For a file or directory, it is the number of distinct commits that touched anything within the path during the window; a commit touching twelve files in one directory counts once for that directory. Each repository offers four windows. The colour encodes a rate, the count relative to a saturation anchor that scales with the window. Counts are also grouped into four bands: `10+ commits`, `3–9 commits`, `1–2 commits` and `no commits found`.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'Churn requires the deepest trace, a walk of the commit timeline. At each commit the walk re-parses every changed file version and compares functions by a hash of their bodies. It therefore counts a rewrite that leaves the line count unchanged. Merge commits are skipped. Edits are stored as tallies per UTC day, and a window of *N* days is the *N* day-buckets ending with the current day.',
          "Per-line blame is not used, for a measured reason. Blame keeps one commit per line, so a body rewritten in place many times reports only the commits whose lines survive. In the repository's own test, a body rewritten twelve times counts 12 on the timeline and 2 under blame. Until the timeline has been walked, every count is zero, and the lens paints nothing rather than drawing unmeasured code as settled.",
          'In a repository at least 180 days old, the windows are 30, 60, 90 and 180 days, and the default is 90. A younger repository receives the same proportions scaled to its lifespan, with the widest window equal to the whole life of the project. No window exceeds 180 days, because churn describes recent activity. The saturation anchor is eight commits per 90 days, scaled linearly with the window and never below one. A body\'s colour position is min(1, count ÷ anchor), so widening the window cools a short burst of edits and leaves steady change at the same colour. {churnWindows}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is churning and dim is settled. A function is coloured by its own rate. A file or directory is coloured by the line-weighted mean of its children's rates, while the count reported for it is the distinct commits on the path. A container's rim shows the distribution of lines across the four count bands. Two neutral states are distinct: `timeline not walked` means the repository has history that has not been counted, and `history not read` means the map holds no history for those lines. The page states which window its map shows.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Churn is intended to locate hotspots: code that changes frequently, and places where concurrent edits are likely. With Surprise, it forms the second axis. Unpredictable code that is also changing frequently is a candidate for confusion or instability. Unpredictable code that is settled is more plausibly subtle but stable. Churn measures frequency and Age measures recency; a body can be recent and not churning after a single edit.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'A count of commits carries no information about the size of each change. A mechanical commit that touches many functions, such as a reformat or rename sweep, counts once for each function it alters. Changes that enter only through merge commits are not counted. Windows scale to each repository, so counts in different repositories are not comparable. Contention, the number of distinct authors changing a body, is not measured. Above the saturation anchor, differences are visible in the bands but not in the colour.',
        ],
      },
    ],
  },

  surprise: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Surprise is the degree to which a model reader failed to predict a function\'s body from the context it was given before reading that body. It is recorded as a four-step ordinal: `full` (the prediction described the body, nothing missed), `most` (broadly right, with one detail that was not obvious), `some` (recognisable, but the body does real work the prediction did not cover) and `none` (the prediction did not describe the code). These are named `mundane`, `typical`, `quirky` and `obscure`, and placed on the colour ramp at 0.08, 0.30, 0.62 and 0.92. The spacing is deliberately uneven, to separate the two informative grades. The unit is the function. A file or directory is described by the share of its *read* lines graded `quirky` or `obscure`.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "Each reading is taken by a separate reader process launched outside the repository and without the project's agent settings; where the agent supports it, its tools are restricted to those the reading needs. The reader receives one function at a time: its path and line range, name, owning type, signature, the names of up to twenty nearest sibling functions, the function's own documentation and the file's header as context. It writes a prediction of two or three sentences. Requesting the source records that prediction first and irrevocably; the reader then reads the body and grades against what it wrote.",
          "Readings are committed to the repository under `.sanity/`, keyed by path, function name and ordinal among same-named functions, never by line number. Each records a hash of the body, the function's documentation and the file header, with whitespace collapsed. When any of those change, the reading becomes stale, stops colouring its wedge and is queued ahead of unread work. A reading also records a spec number identifying the version of the questions asked.",
          'The server stamps the provenance that must be checkable: the hash, git identity, commit, time, spec, requested model and agent harness. The reader declares its model, whether it was *cold* (new to the file), its position in its run, and whether the repository\'s instructions file was in its context. Warm readings are recorded but not discounted in colour.',
          'An unread function has no value. An offline heuristic only orders the reading queue; its terms return 0.5, *undecided*, when out of evidence, and it is never drawn. {readingState}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is `obscure` and dim is `mundane`. Uncoloured wedges are unread. Stale readings are hatched and uncoloured. Files and directories show the share of read lines that are surprising, mapped through min(1, share ÷ 0.25)^0.7, which preserves order and saturates at one quarter. A container's rim divides its lines among the four grades, `unread` and `expired`.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Low surprise is evidence of scaffolding, code whose content follows from its context. High surprise marks where decisions were made that the surroundings do not imply. Documentation enters through the reader's context rather than as a correction. A comment that explains the body lowers surprise, and a comment describing code that is no longer there leads the prediction astray, so the reading rises. On its own, surprise does not distinguish a subtle algorithm from a mess. Churn and Age provide the second axis, and Legibility provides an independent third.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Surprise measures explanatory fit, not correctness: predictable code can be wrong. The reader is the scale. A smaller model is surprised by more, and a different harness is a different instrument, so a repository must not be read with more than one model; a mixture yields one map on two scales. Four grades are coarse, and several provenance fields rest on self-report. Containers describe only what has been read.',
        ],
      },
    ],
  },

  legible: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Legibility is a reader\'s report of what reading an opened body was like, judged by what the reader did rather than by an impression formed afterwards. The four grades are: `full`, read once from top to bottom without going back; `most`, went back over one part once; `some`, went back more than once or had to hold several things in mind at the same time; and `none`, finished the body and still could not say with confidence what it does. They are named `clean`, `nuanced`, `tangled` and `unclear`, and placed on the lens\'s ramp at the same positions Surprise uses (0.08, 0.30, 0.62, 0.92). The unit is the function. A file or directory is described by the share of its read lines graded `tangled` or `unclear`.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'Legibility is graded in the same reading as Surprise, after the prediction has been recorded and the body read. The procedure, storage, expiry and provenance are therefore identical: readings are committed under `.sanity/`, keyed by path, name and ordinal, and expire when the body, its documentation or the file header changes. Readings of whole files do not grade legibility, because it is a judgement about one body.',
          'The reader receives only the extent being graded and cannot open callers, types or the rest of the file. The grades are worded in terms of what a reader can observe about its own pass within that extent. Because the wording of this question has changed, each grade is valid only if the reading was taken under the current question. Grades made under an earlier question are kept as history, but they do not colour a wedge or count toward a share. They are not refilled by asking the legibility question alone, because a grade given immediately after a prediction is part of a different measurement. They are replaced only by a complete new reading. {readingState}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is `unclear` and dim is `clean`. Uncoloured wedges are unread or have no current grade. Stale readings are hatched. A container's value is the share of its read lines graded `tangled` or `unclear`, mapped through the same curve Surprise uses. Its denominator is lines that have been read, not all lines. A directory where one function of forty has been read, and was unclear, is reported as unclear as far as anyone has looked. Its rim divides lines among the four grades and the lines not yet graded.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Legibility is independent of Surprise by construction. Surprise asks whether the intent was reachable without the body; Legibility asks how the body read once open. Inline comments therefore count toward Legibility but not toward Surprise, since they sit inside the text being predicted. The pairing separates situations that Surprise alone merges. Surprising but clean code is unguessable from outside and plain once opened, which points toward better names or documentation. Surprising and unclear code is difficult at every level. Mundane but tangled code does an expected job in a confusing way. Crossed with Traps, a clean body that carries a reported trap is the most hazardous combination, because it reads as safe.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "The grade is a model's report of its own behaviour and varies between models; the prohibition on mixing models applies. Reader-reported distributions have historically crowded toward the top grade. The question was reworded to give readers observable criteria, and the lowest grade remains rare. Clarity is judged without surrounding context, so a body that is clear only once its types are known may be graded harshly. The scale is ordinal and coarse. Containers describe only their read lines.",
        ],
      },
    ],
  },

  docs: {
    sections: [
      {
        heading: 'Definition',
        body: [
          'Docs measures how little of a body its documentation covers, as graded by the reader that read both. The reader\'s scale is `full`, `most` (shown as `decent`), `some` and `none`. The lens paints the gap, so it runs in the opposite direction to the grade: positions are 0.05, 0.30, 0.65 and 1.0, and bright means undocumented. Three units are graded. A function is judged on its own documentation comment. A file is judged on its header, meaning the comment at the top of the file. A directory is described by the share of graded files and functions beneath it whose documentation is `some` or `none`, counting each graded item once.',
        ],
      },
      {
        heading: 'Instrument',
        body: [
          'The reader receives the documentation before predicting. After reading the body it answers two questions about that documentation. The first is `documented`: how well it covers what the code actually does, graded `none` when there is none. The second is `derivable`: whether the documentation says nothing that could not have been worked out from the code alone. A derivable document is counted as `none` in every derived number. This enforces the provenance rule that text a model could regenerate from the body adds no explanation. Without it, a pass of generated comments could turn a repository\'s map uniformly well documented. The provenance scheme has no weighted category for model-authored explanation.',
          'Files are read as separate tasks. The reader predicts what the file is for from its name, header and declarations, then grades whether the header describes the contents and whether it is derivable. Because documentation is part of the reading hash, editing a comment expires the readings made against it. Documentation grades are reported beside Surprise, never subtracted from it. {readingState}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Dim is covered and bright is undocumented. A function is coloured by its own grade. A file is coloured by its header's grade, not by an average of its functions, and it is uncoloured until its header has been read. A directory is coloured linearly by its share of undescribed items. Uncoloured wedges are unread or ungraded, and stale readings are hatched.",
          'The lens has two readings for derivable documentation. Under the default, a derivable document is painted as `none`, on the view that it explains nothing a newcomer could not already infer. Under the alternative, it is painted as `full`, on the view that a complete description is documentation however obvious. The choice changes colour only; scores are unaffected. The page states which reading its map shows.',
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Docs describes how much explanation is available to someone arriving at the code. It is distinct from Surprise. A surprising and undocumented body and a surprising but well-covered body are different situations, and only the first lacks a written explanation. The two lenses also check each other. Documentation that no longer describes its body should draw a low coverage grade and mislead the prediction, raising Surprise. The derivable reading separates restatement from explanation, which a count of comment lines cannot do.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Coverage is not accuracy. A reader grades how well the text covers the body it read, and a subtle inaccuracy can pass. Derivability is a judgement that depends on the reader's competence, since a stronger model will find more documentation derivable. That is a further reason not to mix models within one repository. Documentation attached to an enclosing type rather than the function is graded `none` for the function. The directory share counts items rather than lines, so a short function weighs as much as a long file. Unread items are excluded from the share.",
        ],
      },
    ],
  },

  traps: {
    sections: [
      {
        heading: 'Definition',
        body: [
          "Traps records whether a reader flagged something in a function's body that will catch out the next person to edit it, and that nothing in the code warns about. It is a mark, not a scale. A read function is either marked `trap` or `no trap reported`; an unread function has no answer. The unit is the function only. Files and directories carry no value of their own.",
        ],
      },
      {
        heading: 'Instrument',
        body: [
          "The answer is given in the same reading as the other assessment grades, after the prediction and after the body has been read. The reader is asked to report a trap only when the code itself will bite whoever edits it next and nothing in it warns them. The illustrative categories are an ordering assumption nothing enforces, a silent failure, an unguarded index, a resource leaked on one path, and a cache key that omits something the cached value depends on. Several things are excluded: a hazard that a comment already calls out, a documentation problem (which Docs grades), and the reader's own surprise, which is a fact about the reader. A trap cannot be reported without a note stating what breaks and when; a report that omits the note is refused. The default answer is no. Readings of whole files do not answer this question.",
          'The question was narrowed in the current reading specification. An earlier *yes* may answer a broader question and is treated as dated. An earlier *no* is kept, because narrowing a question cannot turn a *no* into a *yes*. Readings are stored, keyed and expired as for the other assessment lenses. {readingState}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          'Three states are drawn. Functions marked `trap` take the trap colour. Functions a reader examined without reporting a trap take the structural neutral. Functions no reader has examined under the current question take the unanalysed neutral, and this includes dated *yes* answers. Stale readings are hatched and fall with the unread. The two neutrals are distinct on purpose: confusing *nobody has looked* with *somebody looked and found nothing* would read as an all-clear. Containers are not coloured by this lens and carry no rim distribution, because a share of contained traps is not what the question asks.',
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'A trap mark is evidence that a competent reader, having read the body, identified a concrete editing hazard and could state it in a sentence. Its value comes from being rare enough to work through one by one. Traps is independent of Legibility, and the combination matters most where they disagree. A clean, readable body with a trap reads as safe and is not. Crossed with Churn, a trap in frequently changed code is a hazard likely to be met soon. Crossed with Age, a trap in long-untouched code is one that current contributors may never have encountered.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "A clean wedge is not proof that no trap exists. Each reading is one model's pass over one bounded body, without callers, types or the rest of the file, so hazards arising across function boundaries are largely invisible. Sensitivity varies between models, and the rule against mixing models applies. The rate of false positives and false negatives has not been measured. The mark carries no severity. By design, hazards the code already warns about are excluded, so a documented hazard does not appear however serious.",
        ],
      },
    ],
  },
}
