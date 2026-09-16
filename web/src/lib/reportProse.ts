import type { ColorMode } from './colorMode'

/**
 * The words a report prints: its methodology and an essay per lens.
 *
 * **Written for somebody who has never seen the app**, which is why this is not the lens
 * reference (`LensHelp`). The reference is a lookup for somebody already standing on the map; a
 * report is a research document and has to stand on its own, so each lens is defined, its
 * results in this repository stated, its figure explained, and its limits set out the way a
 * paper sets them out. The two will say different things at different lengths, and that is the
 * point of having two.
 *
 * **Each essay has the same sections, in the same order**: Definition, then Results (read off
 * the data at export — `lensStory`), Reading the map, Interpretation and Limitations. How the
 * lens is measured goes to the appendix (`Essay.method`). **A caveat that holds for every lens is
 * said once, in the methodology**: that colours do not compare across repositories, that readings
 * by different models are not on one scale, and how much of the repository has been read.
 *
 * **Checked against the code when written, and the code is the authority.** Change a
 * measurement and the sentence describing it here is now a claim nothing checks, so read the
 * essay for that lens in the same edit.
 *
 * Markup is deliberately small: a paragraph per string, `- ` for a bullet, `1. ` for a numbered
 * item, `*italic*`, `**bold**` and `` `code` ``. `{slots}` are filled at export from the
 * repository being described — see `methodVars` and `lensVars` in `report.ts`.
 *
 * `{?surprise text}` prints `text` only when the report has a Predictability page, and `{!surprise text}`
 * only when it has none; `readings` stands for any of the four lenses a reading paints. **A
 * sentence that leans on another lens is gated on that lens's page.** grype's report, with no
 * readings, spent its abstract on the reader and told the Complexity page to compare against a
 * Legibility map it did not have.
 */

export interface Prose {
  heading: string
  body: string[]
}

export interface Essay {
  /** A deck's two lines, written for a slide: each stands alone, because a slide is spoken to.
   *  The first sentence of each section was tried and made teasers — "Three states are drawn." */
  deck: { definition: string; reading: string }
  sections: Prose[]
  /** How the lens is measured, in full, set in the report's appendix rather than on its page.
   *  **The page is for what the measurement means.** An Instrument section between Definition
   *  and Reading the map had the reader through FNV-1a and a 2,048-call limit before learning
   *  what a bright wedge is. */
  method?: string[]
}

/** The heading the observations about this repository go under, after a lens's definition — see
 *  `lensStory` in `reportTables.ts`. **Results, because this is a research report**: the section
 *  states what was measured here, in the register of the rest, and draws no story from it. */
export const STORY_HEADING = 'Results'

/** The report's appendix: each lens's instrument in full, for somebody checking the method
 *  against the code. */
export const APPENDIX = {
  title: 'How each lens is measured',
  intro:
    'Each lens page states what its measurement means and what it shows in this repository. This appendix describes how each measurement is taken, in enough detail to check it against the code.',
}

export const METHODOLOGY: { abstract: string; sections: Prose[] } = {
  abstract:
    "This {formNoun} describes one software repository, {repoSlug}, {commitClause}. The unit of analysis is the function: {functions} functions in {files} files, extracted by parsing and totaling {lines} lines. Every measurement is drawn on one radial diagram whose angular width is lines of code. {?readings The main instrument rests on a working definition: boilerplate is code a model can predict from its context. A model reader sees a function's name, signature, neighbors and documentation, predicts the body, and only then reads it. Where the prediction fails is where the decisions are. Parse, call-graph and git measurements go alongside the readings, and rules combine them into findings.}{!readings Parse, call-graph and git measurements describe it, and rules combine them into findings. The method is built around a further instrument, a model reader that predicts each function's body before reading it; this repository has no current readings, so this {formNoun} leaves it out.}",
  sections: [
    {
      heading: '1. Unit of analysis and representation',
      body: [
        'Files are parsed with tree-sitter ({grammarClause}). A function is a syntax node whose kind appears in a per-language table. Inline callbacks and class bodies are not units. Files no parser could read ({unparsed}) are counted but not drawn.',
        "The repository is a tree of directories, files and functions, with one ring per level. Angle is proportional to lines, and a file's width is the sum of its functions' lines, so text outside any function adds no width. Each figure colors the map by a single measurement, called a lens, and lenses are never blended. A directory's rim does not show a mean, which over large subtrees drifts to mid-scale. It shows the line-weighted distribution of the whole subtree. Bands too narrow to draw merge only with each other, and a merged band of categories is labeled “other” with a count.",
      ],
    },
    {
      heading: '2. Instruments',
      body: [
        'The thirteen lenses form four families, grouped by the evidence each needs. Each lens page gives the definition of its measurement, the results in this repository and how to read its figure{?appendix , how it may be interpreted and its limitations; how each measurement is taken is described in the appendix}.',
        '*Code shape* needs only the parse. Complexity counts branch points, weighted by nesting, against the median for bodies of similar length in this repository. Composition classifies code as code, header, test, generated or vendored, preferring declared evidence to path conventions. Language names the grammar. Clones groups functions whose token sequences are identical once identifiers and literals are replaced. Bodies under 40 tokens are not compared, and near-copies are not detected.',
        '*Interconnectivity* counts the distinct in-repository functions that call a function (Callers) and that it calls (Reach). There is no type checker. Calls are matched by name within one language family, trying the same file, then the same directory, then the repository; at repository level a name must be defined exactly once. A call through a value the repository cannot identify, such as `xs.collect()`, cannot match a free function. Plausible multiple targets are all credited, and library calls match nothing. The counts are therefore approximate: “no in-repo caller” is not dead code.',
        "*Activity* reads git at three depths: a log walk gives per-file facts, per-line blame gives per-function facts, and a timeline detects which functions each commit changed, by body hash. Blame names whoever last changed a function's lines. Age shows the newest or oldest surviving line on a logarithmic scale spanning the repository's life; the oldest line is only a lower bound on when the code first appeared. Churn counts the commits that changed a function within a {churnWindow}-day window.",
        '{?readings *Assessment* relies on model readers: coding agents run as separate processes, started outside the repository and without its instruction files. A reader receives one function (occasionally a whole file): its name, owning type, signature, up to 20 neighboring names, documentation and file header, but never its body. Its prediction is recorded before the source is served and cannot be revised. The reader then grades how much of the body the prediction covered (full, most, some or none), how well the documentation covers the code, whether that documentation was derivable from the code alone, and how legible the body was. It also describes any trap waiting for the next editor. Predictability is the prediction grade, and Legibility, Docs and Traps from the rest. Derivable documentation counts as absent in every score, so text a model could have written cannot make code look explained.}{!readings *Assessment*, the fourth family, is graded by model readers that predict a function\'s body from its context before reading it. This repository has no current readings, so none of its lenses is in this {formNoun}.}',
        '{?readings Readings are committed as Markdown under `.sanity/`, each stamped with a whitespace-insensitive hash of body, documentation and file header. When the hash stops matching, the reading is stale: it stops coloring and is queued again first. The application runs no model. A heuristic only orders the reading queue.}',
      ],
    },
    {
      heading: '3. Findings',
      body: [
        "A rule names a population (functions or files) and one to three threshold clauses that must all hold. A clause that cannot be evaluated does not match. Thresholds are calibrated once against this repository's distribution, aiming at about eight findings, and saved as fixed numbers. Calibration may tighten a threshold but never loosen it. A finding marks a place worth inspecting; it does not say the code is defective. Generated, vendored and test code raise none. Decisions are recorded in `.sanity/findings/decisions.md` as flagged, fine for now, fine always or false positive. A flagged finding stays in the list, marked *flagged*. The other three hide it, and the findings overview counts the matches hidden this way as ignored, once for each rule a subject matches. Fine for now lapses when the code changes, and false positive when the rule changes. This {formNoun} lists {findings} findings, grouped by where in the repository they occur{?groupMaps , each group drawn on a map zoomed to its region}.",
      ],
    },
    {
      heading: '4. What the instrument declines to claim',
      body: [
        'Absence is reported as absence. {?readings Unread functions, untaught}{!readings Untaught} languages, bodies below the clone floor and untraced history are drawn gray, never as zero. A lens with no evidence here is locked and gets no page ({lockedClause}). {?readings The ordering heuristic returns an undecided 0.5 when it runs out of evidence.} Colors are calibrated per repository and cannot be compared across repositories. “Under test” means a test calls the function, not that its lines were executed. {namedClause} {?readings A reading judges explanatory fit, not correctness.}',
      ],
    },
    {
      heading: '5. Reproducibility',
      body: [
        'The report is stamped {repoSlug} {commitClause}. {?readings Readings expire when code changes, so every claim can be checked against that commit. Each reading records its commit, the model the reader reported (and the model requested, if different), the harness, whether the reader was new to the file, and whether the repository\'s instruction file was in its context. The reader is the scale: readings by different models are not comparable. {readerClause} {assessed} of {readable} functions and files have current readings, and {stale} are stale.}{!readings Every measurement in it can be checked against that commit.}',
      ],
    },
  ],
}

export const ESSAYS: Record<ColorMode, Essay> = {
  tangle: {
    deck: {
      definition: 'Complexity counts the decision points in each function body, charging more for those nested inside others.',
      reading:
        '{!rawTangle Bright wedges branch far more than bodies of their length usually do here; dim ones branch no more than usual.}{?rawTangle Bright wedges have the most decision points, saturating at 15; dim ones have none.}',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Complexity measures the control flow a reader must follow within a function. Each conditional, loop, switch or match, catch clause and conditional expression in the body counts as one decision point, plus one for each decision point enclosing it; a run of logical operators such as `&&` counts as one. {!rawTangle The figure does not show this count directly. Each function is compared with bodies of similar length in the same repository, so that length alone does not raise its position.}{?rawTangle The figure shows this count directly, against a fixed bar of 15.}',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright wedges branch substantially more than bodies of similar length in this repository; dim wedges branch no more than the median. The four bands are *low*, *moderate*, *high* and *very high*. Relative to length, they begin at 1.15, 2.2 and 3.25 times the median for bodies of that length; as a raw count, at 1, 6 and 12 decision points. Functions in languages without a branch table are drawn in gray and labeled *language not counted*, which records a gap in the parser rather than a simple function. A file or directory takes the line-weighted mean of its counted functions, and the outer rim of a directory shows how its lines are distributed across the four bands.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Complexity measures the control flow a reader must hold in mind; it is evidence neither of defects nor of difficulty in reading. The raw count increases with length and therefore largely restates what angular width already encodes. Measured relative to bodies of similar length, it reflects density, which width does not. {?legible Read against Legibility, a function bright here but graded *full* there contains extensive control flow written conventionally, while one dim here but graded *none* there is difficult for reasons other than branching.}",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Bodies at and below the median share the lowest band, so a function simpler than its length would predict is indistinguishable from a typical one. The constructs counted as branches differ by language{?rust  (Rust's `?` is not counted)}{?nix  (Nix counts only `if`)}, yet the medians pool all counted languages, tests and generated code, so a multilingual repository is compared against a blended norm. Callbacks written inline are counted toward the enclosing function. The scoring is specific to this instrument and is not interchangeable with other cognitive-complexity measures.",
        ],
      },
    ],
    method: [
      "The count is read from the parser's syntax tree. Each language has a fixed table of the node kinds that count as branches: conditionals, loops, switch or match constructs, catch clauses and conditional expressions. A branch costs one plus the number of branches enclosing it. A switch is charged once, however many arms it has, and `else if` and its equivalents cost one without nesting. A run of one logical operator costs one, and each change of operator one more, never nested. A plain `else`, recursion and labeled jumps cost nothing. Closures add no nesting, and their branches count toward the enclosing body. A language with no table receives no score.",
      "The raw count is placed against a fixed bar of 15 and saturates there. The length-adjusted count compares each body with bodies of similar length. Size bands end at 14, 24, 49, 99, 199, 399, 799 and 1,599 lines, with an open top band. The median count is taken per band over every counted function, and a band holding fewer than 30 bodies merges into the nearest populated band below. A body's position is (count ÷ median − 1) ÷ 3, clamped to 0–1, with the median floored at one: a body at or below its band's median sits at 0, and one at four times the median saturates. A body whose band is empty takes its raw position. {tangleMedians}",
    ],
  },

  composition: {
    deck: {
      definition:
        'Composition sorts every function body into code, header, test, generated or vendored, preferring what the repository declares over what its paths suggest.',
      reading: 'Each kind has one fixed color in every repository, and the neutral is a body nothing could place.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Composition classifies each function body as one of five kinds: *code*, written in this repository and marked as nothing else; *header*, declarations; *test*, test code; *generated*, the output of a tool; and *vendored*, third-party code kept in the repository. Each classification records the evidence it rests on: a declaration made by the repository or its toolchain (*contract*), a path or naming habit (*convention*), or the absence of either (*parsed*). Files and directories are described by how their function lines divide among the kinds.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          'Each kind has one fixed color in every repository, and the key lists only the kinds present. Only function wedges are colored; file and directory wedges are neutral, and the outer rim of a directory shows how its lines divide among the kinds. A function with no classification is labeled *unplaced*, which a complete scan should leave rare.',
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Composition estimates the share of a repository that its maintainers write and edit by hand. Where generated or vendored code is a large share, angular width overstates the maintained surface, and findings raised there concern code that is not edited in this repository. The share of test code indicates investment in tests by line count only; it is not a measure of coverage.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Test detection depends on language: {?cFamily C and C++ have neither a contract nor a convention in this instrument, so their tests are classified as code, and }languages whose calls are not resolved never reach the test rule. Path conventions can misfire, since `tests` may be a domain noun and `vendor` may hold first-party code. Generator banners are matched anywhere in the first 400 characters of a file, so a comment that merely mentions one is sufficient, and a banner placed later is missed. The first four rules apply per file, so a file mixing generated and hand-written sections is classified uniformly{?cFamily , and a C++ header with inline implementations counts as a header in full}. *Code* is a residual category: it records that nothing marked the body as anything else, not that authorship in this repository was established.',
        ],
      },
    ],
    method: [
      'Classification applies an ordered list of rules, and the first match wins.',
      '1. **Repository declarations.** A path matching a `linguist-generated` or `linguist-vendored` pattern in the root `.gitattributes` is generated or vendored (contract). Only the root file is read, with a simplified pattern matcher.',
      '2. **Generator banners.** A file whose first 400 characters contain, ignoring case, “do not edit”, “@generated”, “code generated by”, “autogenerated” or “automatically generated” is generated (contract).',
      '3. **Headers.** `.d.ts` is a header by contract. `.h`, `.hpp`, `.hh`, `.hxx`, `.pyi` and `.idl` are headers by convention.',
      '4. **Path conventions.** A path segment named `vendor`, `node_modules`, `third_party` or `Godeps` marks vendored code. A segment named `generated`, `__generated__` or `antlr`, or a filename containing `.gen.`, `.pb.`, `_pb2.` or `.min.`, marks generated code.',
      "5. **Test status**, decided per function and only in languages whose calls the parser resolves. Contracts are Rust's `#[cfg(test)]` or a `tests/` directory, and Go's `_test.go`. Conventions are runner filename patterns and test directory names for Python, JavaScript/TypeScript, Ruby and the JVM languages, plus `TEST_` or `test_` function prefixes in shell. A JavaScript or Python project that configures no test runner and holds no test-shaped files is inferred to have no tests (convention).",
      '6. Everything else is **code** (parsed).',
      "{?readings Readers' later judgments about whether a body is a test update the call graph, but they do not reclassify Composition.}",
    ],
  },

  language: {
    deck: {
      definition: 'Language names the grammar each file was parsed with, and every function takes its file’s language.',
      reading: 'Each color is a language, ranked by lines; the colors carry no order and differ between repositories.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Language assigns each file the programming language its extension names, and each function inherits the language of its file. The categories are the languages the parser has grammars for; closely related dialects, such as TypeScript and TSX, are distinct categories. As on every lens, width counts the lines of function bodies.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Each color is a language, ranked by lines across the repository. The colors carry no order, and because they follow rank, a language may have different colors in different repositories. {?manyLanguages The key names the sixteen largest categories and counts the rest, some of which share shades the key does not identify.} Function and file wedges take their language's color; a directory has no language, so its wedge is neutral and its outer rim shows how its lines divide among languages.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Language shows where a repository's language boundaries lie, which often differ from its directory structure. It also qualifies the structural lenses, whose coverage is set per language: Callers and Reach resolve calls only within a language family and only where a call table exists, Complexity requires a branch table, and Clones compares bodies only within a family. A gray region under one of those lenses can therefore be attributed to parser coverage by locating it here, and a boundary between two language regions is also where call edges cease to be visible.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'An extension is a claim about content rather than a measurement of it{?cFamily : `.h` is mapped to C++ unconditionally, so C headers are reported as C++}. Embedded languages, such as SQL in strings or inline scripts, are counted as the host language. Because width counts only function lines, languages dominated by declarations, configuration or top-level statements are under-represented relative to their size on disk, and files in languages without a grammar are absent. Generated and vendored code is included.',
        ],
      },
    ],
    method: [
      "A single table maps extensions to languages, and each extension belongs to exactly one language. A file with an unrecognized extension is not parsed and does not appear on the map. File content is never examined to settle the language. Where two languages claim an extension, the table decides: `.h` is C++, `.m` is Objective-C and `.v` is Verilog. A function's length runs from its first line to its last, inclusive, and a file's length is the sum of its functions' lengths. Lines outside any function (imports, top-level declarations, file comments) therefore add no width, and a file with no functions has none.",
      'Categories are ranked by total lines across the repository, largest first, and each rank takes a slot in a 64-color categorical palette chosen to stay distinguishable under the common forms of color-vision deficiency. Beyond the 64th rank, colors recycle from the unnamed part of the palette. The number of categories given their own color can be capped, and categories past the cap fold into a neutral *other*.',
    ],
  },

  clones: {
    deck: {
      definition:
        'A clone is a function whose body matches another’s token for token once names and literals are set aside.',
      reading:
        'A colored wedge belongs to a clone group; the two neutrals separate a body compared and found unique from one too small to compare.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'A function is a clone when at least one other function in the same language family has an identical body once identifiers and literals are disregarded. Each function is in one of three states: a member of a clone group of two or more, compared without a match, or too small to compare.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Members of a clone group share one mark color, whatever the size of the group. Functions compared without a match are drawn in the neutral labeled *unique*, and functions below the size floor in the neutral labeled *too small*; the first records a comparison that found nothing, the second that no comparison was made. Files and directories are not tinted. Instead, a directory's outer rim carries a mark at the angle of each drawn file containing a clone, which shows where clones lie rather than what share of the directory they make up.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Duplication is a property of a set of functions and is invisible to lenses that measure one function at a time{?readings ; a reader, for instance, rates a copy as predictable}. The groups found include copy-paste with renaming, repeated interface or trait implementations, table-driven tests and generated code, and Composition separates the last two from duplication in hand-written code. In hand-written code, a group of *n* members means a change to its logic must be made *n* times, and duplicated helpers divide what would be one function's caller count across several copies.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Matching is exact after normalization, so near-copies are missed: bodies differing by one statement, an added guard or reordered lines are not reported. The normalization is also coarse in the other direction: because every identifier collapses to one placeholder, bodies of the same structure that call different functions or read different fields are grouped together, and such groups may be semantically unrelated. Tokens are classified by substrings of grammar kind names, which can misplace a token in some grammars. In codebases made of small functions, most bodies may fall below the comparison floor, so an absence of marks there is not evidence that code is not duplicated. The unit is the whole body, so a duplicated block within two otherwise different functions is not detected, and copies across language families or repositories are out of scope.',
        ],
      },
    ],
    method: [
      'The instrument walks the leaf tokens of the syntax tree inside the function body; the signature is excluded. Comments are dropped. A token whose grammar kind contains “ident” becomes an identifier placeholder. A token whose kind contains “literal”, “string”, “content”, “number”, “integer”, “float” or “char” becomes a literal placeholder. Keywords, punctuation and operators keep their own kind. The resulting sequence is hashed with 64-bit FNV-1a. A body of fewer than 40 tokens receives no shape and is never compared.',
      'Functions are grouped by the pair of language family and hash. C and C++ form one family, as do JavaScript, TypeScript and TSX, and every other language is its own family. Matching is exact: there is no similarity threshold and no edit distance. Two functions whose bodies differ only in the names and literals they use therefore match, even if their parameter lists differ.',
    ],
  },

  callers: {
    deck: {
      definition:
        'Callers counts the distinct functions in this repository that call each function, matched by name without a type checker.',
      reading: 'Bright is called from six or more places and dim from none that resolve here, which is not proof of dead code.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Callers is, for each function, the number of distinct functions in the same repository whose bodies contain at least one call resolving to it. Repeated calls from one caller count once, recursion is excluded, and tests count as callers.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Counts fall into four bands, from dim to bright: *none*, *1*, *2–5* and *6+*. Functions in languages whose calls are not resolved are labeled *calls not resolved here* and are distinguished from *none* by lightness. A file or directory is colored by the share of its call-resolving functions that have at least one caller in the repository, and a directory's outer rim shows how its lines divide across the bands.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Callers measures fan-in: how much code in this repository depends on a function, and so how far a change to it may travel. Callers and Reach use the same bands and read opposite ends of the same edges. A function bright on both is a hub, one bright on Callers alone a primitive, and one bright on Reach alone an orchestrator. Functions in the *none* band include entry points, handlers and possibly unused code.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Resolution by name without types errs in both directions. Unrelated functions sharing a name within a tier are credited with each other's calls, and every local definition of an ambiguous name is credited, which overcounts. Calls through variables whose types are defined elsewhere, such as `project.scan()` from another file, are refused, so real callers go uncounted. Many callers are invisible to the instrument: calls from other languages, calls by string or reflection, callbacks passed as values, external consumers of a public API, and invocation by a framework, runtime or test harness. A count of *none* is therefore not evidence of dead code. A test that calls a function is a caller but not a dependent; the instrument records the non-test count separately, while the figure shows all callers.",
        ],
      },
    ],
    method: [
      'The call graph is built from the parse, without a type checker. Each language has a table of syntax nodes that are calls, including constructor calls and, for JavaScript and TypeScript, JSX elements. Each call is recorded by its name and by how it was spelled: bare (`f()`), through a value (`x.f()`), or through a path (`A::f()`). A single body records at most 2,048 distinct calls. A call is resolved against every definition of that name in the same language family, as follows.',
      "- If the qualifier names a type or module that owns a definition of that name, those owned definitions are the candidates. `self`, `this` and `Self` name the caller's own enclosing owner.",
      '- A bare name, or a qualifier naming a module or file stem in the repository, is searched in tiers: the same file, then the same directory, then the whole repository, where it resolves only if the name has exactly one definition.',
      '- Any other receiver can reach only methods, and only in the file where the call was written.',
      'Every candidate in the winning tier receives an edge. A call from outside a Rust `#[cfg(test)]` module to a function defined inside one is refused. Unresolved calls, such as those into the standard library, are dropped. A language without a call table receives no value.',
    ],
  },

  reach: {
    deck: {
      definition: 'Reach counts the distinct functions defined in this repository that each body calls.',
      reading:
        'Bright calls six or more and dim calls nothing that resolves here; beside Callers, the pair separates hubs, primitives and orchestrators.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Reach is, for each function, the number of distinct functions defined in the same repository that its body calls. Recursion is excluded, and calls made inside nested functions or closures count toward the enclosing body.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "The bands match those of Callers: *calls nothing in this repo* (dim), *1*, *2–5* and *6+* (bright), so the two figures can be compared band for band. Functions in languages whose calls are not resolved are neutral. A file or directory is colored by the share of its call-resolving functions that call at least one function in the repository, and a directory's outer rim shows how its lines divide across the bands.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "Reach measures a body's direct coupling to the rest of the repository: the number of other functions defined here that a reader must know to follow it. Functions in the dim band are leaves, including primitives, pure computations and thin wrappers over external libraries; bright functions coordinate, as controllers, dispatchers and entry points do. Read against Callers, high Reach with low Callers suggests an entry point or orchestrator, low Reach with high Callers a primitive, and both high a hub. High Reach combined with high Complexity indicates integration code whose behavior depends on many parts at once.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Reach counts dependence only on code defined in this repository, so a body built on standard-library or framework calls reads as a leaf. Method calls through variables whose types are defined in other files are refused, so code that calls collaborators through fields or parameters is undercounted, often heavily, while ambiguous local names overcount. The measure is direct: a function calling one wrapper that reaches most of the system reads as *1*. It counts distinct functions rather than call volume, closures raise the Reach of the body containing them, and calls across language families are not seen.',
        ],
      },
    ],
    method: [
      "Reach reads the outgoing side of the call graph described under Callers: the same call tables, the same record of how each call was spelled, the same limit of 2,048 distinct calls per body, and the same resolution rules. A call counts toward Reach only if it resolves to a definition in this repository within the caller's language family, so calls into the standard library, dependencies, other languages or dynamic targets add nothing. A call that resolves to several candidates in its winning tier adds each of them, so one written call can raise Reach by more than one. A language without a call table receives no value.",
    ],
  },

  blame: {
    deck: {
      definition: 'Blame colors each function by the person git attributes its lines to, reduced to one name per body.',
      reading:
        'Each color is one person, the same everywhere on the map; the neutrals are uncommitted lines and code git holds no attribution for.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Blame assigns each function the name of a person, taken from git's line-by-line attribution of the code as it currently stands. It has two readings, both reductions of one list, the author of the commit that last changed each line of the body. The *newest line* reading takes the author of the most recently committed line; the *most lines* reading takes the author holding the largest number of the body's lines. A file carries a name of its own under each reading, while a directory is described by the distribution of its lines across authors.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Each function wedge is filled with its author's color under the stated reading, and each person keeps one color throughout the figure. Three states are drawn in neutral tones rather than as people: *uncommitted lines*, which exist in the working tree but in no commit; *not in git*, where git holds no attribution for the file; and *other (N)*, which collects authors beyond the color cap. A directory's outer rim shows the share of its lines held by each author, and bands too narrow to draw are merged and labeled *other* with their count rather than under any one member's name.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'The *newest line* reading is a timestamp with a name attached: it identifies who most recently committed within a body. The *most lines* reading identifies whose text the body mostly consists of. The two often disagree, and the disagreement is informative: a one-line correction to a long function makes its author the newest contributor while holding a negligible share. Lines concentrated in one author indicate where knowledge of the code may be concentrated{?surprise ; read against Predictability, this locates unpredictable code whose explanation plausibly depends on few people}.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Neither reading measures authorship. Blame records the last change to each line, so a wholesale rewrite or reformatting commit reassigns every affected line to its committer, and earlier contributors disappear rather than diminish; the *most lines* reading resists single-line corrections but not reformatting. Blame is run without move or copy detection, so code moved between files is attributed to the commit that moved it. Authors are ranked by commits over the whole history rather than by lines in view, so the order of names in the key need not match the widths on the figure, and beyond the named authors a color does not uniquely identify a person.',
        ],
      },
    ],
    method: [
      "Attribution comes from git at increasing depth. The first depth is a single walk of the commit log, which yields, for each file, its most recent commit and that commit's author. The second runs `git blame --line-porcelain` once per file and records, for every line, the commit, the author and the author time. A function's two names are computed over its own line range. Where only the log walk has run, every function inherits its file's last author and has no *most lines* name. A file's *newest line* name is taken from the log walk at every depth; its *most lines* name requires blame.",
      'Colors are assigned by rank, computed once over the whole commit history by commit count, so a person has one color throughout the map and within any subtree. The palette holds 64 colors; ranks beyond 64 reuse colors from the part of the palette the key does not name, and the key names at most sixteen authors. A color cap, where set, places every lower-ranked author in the single category *other*.',
    ],
  },

  age: {
    deck: {
      definition:
        'Age is how many days ago a body’s {?oldestAge oldest surviving}{!oldestAge newest} line was committed.',
      reading: 'Bright is recent and dim is old, on a logarithmic scale stretched over this repository’s own lifetime.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Age is the number of days since a date in a body's line history. Under the *newest line* reading it is the days since the most recent commit among the lines currently in the body; under the *oldest line* reading, the days since its oldest surviving line was committed. A container's newest-line age is the minimum of its children's and its oldest-line age the maximum. For description the value is divided into five bands: *today* (under one day), *this week* (under 7 days), *this month* (under 30), *this quarter* (under 90) and *older*.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is recent and dim is old, on a logarithmic scale spanning this repository's own life, so its oldest code always reaches the dim end. Under the *newest line* reading, bright marks where commits have landed lately and dim marks bodies no commit has touched in a long time. Under the *oldest line* reading, bright marks bodies none of whose lines predate recent work and dim marks bodies that still contain lines from early in the project, whatever has happened to them since. Wedges with no dates are labeled *history not read*, which states only that the figure holds no history for those lines. A directory's outer rim shows the distribution of its lines across the five bands.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'The *newest line* reading locates code nobody has been near for a long time: its dim end is where no commit has changed any line of a body within the period. The *oldest line* reading measures persistence instead, and a heavily edited body can be dim under it because it still contains old lines.',
          'Age alone is weak evidence: how long code has gone unchanged says nothing by itself about whether it is sound. {?surprise Its value is as a second axis to Predictability, which cannot by itself distinguish a subtle algorithm from a disordered one. Long-standing unpredicted code is a candidate for careful documentation rather than change, while unpredicted code that is also changing is a candidate for trouble. These crossings are not computed; they are formed by comparing lens pages.}',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'The oldest surviving line is a lower bound on when code was written, since a rewrite or reformat resets it, and code moved between files dates from the move. Where only the log walk has run, function dates are file dates. The logarithmic scale compresses distinctions among very old code.',
        ],
      },
    ],
    method: [
      "Dates come from the same git depths as Blame. The log walk records, for each file, the author time of the oldest and newest commits that touched it. Per-line blame records an author time for every line, and a function's two ages are the newest and oldest of those times within its range. Where only the log walk has run, every function carries its file's dates.",
      "The color ramp is logarithmic in days and normalized to the repository's span, defined as the oldest-line age of the repository root. A body of age *d* in a repository of span *s* is placed at 1 − log₁₀(*d*+1) / log₁₀(*s*+1), so the oldest code reaches the dim end and code from today the bright end. There is no minimum span; if the span is under one day, every wedge is placed at the bright end.",
    ],
  },

  churn: {
    deck: {
      definition: 'Churn counts the commits that changed each function body within a trailing window of days.',
      reading: 'Bright bodies keep changing and dim ones have settled.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Churn is the number of commits that changed a body within a trailing window of days. For a function, a commit counts if it altered that function's body; for a file or directory, it is the number of distinct commits that touched anything within the path, so a commit touching twelve files in one directory counts once for that directory. Counts are grouped into four bands: *10+ commits*, *3–9 commits*, *1–2 commits* and *no commits found*.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright is churning and dim is settled. A function is colored by its own rate of change, and a file or directory by the line-weighted mean of its children's rates, while the count reported for it is the distinct commits on its path. A directory's outer rim shows the distribution of its lines across the four bands. Two neutral states are distinct: *timeline not walked* means the repository has history that has not been counted, and *history not read* means the figure holds no history for those lines.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Churn locates hotspots: code that changes frequently, and places where concurrent edits are likely. {?surprise Read against Predictability, unpredictable code that is also changing frequently is a candidate for confusion or instability, while unpredictable code that has settled is more plausibly subtle but stable.} Churn measures frequency and Age measures recency, so a body can be recent without churning after a single edit.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'A commit count carries no information about the size of each change, and a mechanical commit touching many functions, such as a reformat or rename, counts once for each function it alters. Changes that enter only through merge commits are not counted. Contention, the number of distinct authors changing a body, is not measured. Above the saturation point, differences remain visible in the bands but not in the color.',
        ],
      },
    ],
    method: [
      'Churn requires the deepest trace, a walk of the commit timeline. At each commit the walk re-parses every changed file version and compares functions by a hash of their bodies, so it counts a rewrite that leaves the line count unchanged. Merge commits are skipped. Edits are stored as tallies per UTC day, and a window of *N* days is the *N* day-buckets ending with the current day.',
      'Per-line blame is not used because it keeps one commit per line: a body rewritten in place many times reports only the commits whose lines survive, so a body rewritten twelve times counts 12 on the timeline and 2 under blame. Until the timeline has been walked every count is zero, and the lens paints nothing rather than drawing unmeasured code as settled.',
      "In a repository at least 180 days old, the windows are 30, 60, 90 and 180 days, and the default is 90. A younger repository receives the same proportions scaled to its lifespan, with the widest window equal to its whole life; no window exceeds 180 days. The saturation point is eight commits per 90 days, scaled linearly with the window and never below one, and a body's color position is min(1, count ÷ saturation), so widening the window cools a short burst of edits and leaves steady change at the same color.",
    ],
  },

  surprise: {
    deck: {
      definition:
        'Predictability is how much of a function’s body a model reader predicted from its name, signature, neighbors and documentation, before reading it.',
      reading:
        'Bright is a body the reader could not predict and dim one it described in full; uncolored wedges are unread and hatched ones are stale.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Predictability records how much of a function's body a model reader predicted from the context it was given before reading it. The grade is one of four: *full* (the prediction described the body, nothing missed), *most* (broadly right, with one detail that was not obvious), *some* (recognizable, but the body does real work the prediction did not cover) and *none* (the prediction did not describe the code). A file or directory is described by the share of its read lines graded *some* or *none*.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright wedges are bodies whose prediction was graded *none* and dim wedges *full*. Unread wedges are uncolored, and stale readings are hatched and uncolored. A file or directory is colored by the share of its read lines graded *some* or *none*, reaching full brightness when that share is a quarter, and its outer rim divides its lines among the four grades, *unread* and *stale*.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          "High predictability is evidence of scaffolding: code whose content follows from its context. Low predictability marks where decisions were made that the surroundings do not imply. Documentation enters through the reader's context rather than as a correction, so a comment that explains the body raises predictability, while a comment describing code that is no longer there misleads the prediction and lowers it. Predictability alone does not distinguish a subtle algorithm from a disordered one; Churn and Age provide a second axis, and Legibility an independent third.",
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'Predictability measures explanatory fit, not correctness: predictable code can be wrong. The reader is the scale. A smaller model predicts less, and a different harness is a different instrument, so a repository read with more than one model yields one figure on two scales. Four grades are coarse, several provenance fields rest on the reader\'s own report, and containers describe only what has been read.',
        ],
      },
    ],
    method: [
      "Each reading is taken by a separate reader process launched outside the repository and without the project's agent settings; where the agent supports it, its tools are restricted to those the reading needs. The reader receives one function at a time: its path and line range, name, owning type, signature, the names of up to twenty nearest sibling functions, the function's own documentation and the file's header. It writes a prediction of two or three sentences. Requesting the source records that prediction first and irrevocably; the reader then reads the body and grades against what it wrote.",
      "Readings are committed to the repository under `.sanity/`, keyed by path, function name and ordinal among same-named functions, never by line number. Each records a hash of the body, the function's documentation and the file header, with whitespace collapsed. When any of those change, the reading becomes stale, stops coloring its wedge and is queued ahead of unread work. A reading also records a specification number identifying the version of the questions asked.",
      "The server stamps the provenance that must be checkable: the hash, git identity, commit, time, specification, requested model and agent harness. The reader declares its model, whether it was new to the file, its position in its run, and whether the repository's instruction file was in its context. Readings by a reader already familiar with the file are recorded but not discounted.",
      'An unread function has no value. An offline heuristic orders the reading queue; its terms return 0.5, *undecided*, when out of evidence, and it is never drawn. The four grades are placed on the color ramp at 0.08, 0.30, 0.62 and 0.92, spaced unevenly to separate the two informative grades, and a container\'s share is mapped through min(1, share ÷ 0.25)^0.7, which preserves order and saturates at one quarter.',
    ],
  },

  legible: {
    deck: {
      definition:
        'Legibility is a reader’s account of what reading an opened body took: straight through, going back, or still unsure at the end.',
      reading: 'Bright was unclear to the reader and dim read cleanly; uncolored wedges have no current grade.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Legibility is a reader's report of what reading an opened body was like, judged by what the reader did rather than by an impression formed afterwards. The four grades are *full*, read once from top to bottom without going back; *most*, went back over one part once; *some*, went back more than once or had to hold several things in mind at the same time; and *none*, finished the body and still could not say with confidence what it does. A file or directory is described by the share of its read lines graded *some* or *none*.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Bright wedges are bodies graded *none* and dim wedges *full*. Uncolored wedges are unread or have no current grade, and stale readings are hatched. A file or directory is colored by the share of its read lines graded *some* or *none*, on the same scale as Predictability. That share is of lines read, not of all lines: a directory in which one function of forty has been read, and was graded *none*, is drawn at the bright end as far as it has been read. Its outer rim divides its lines among the four grades and the lines not yet graded.",
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Legibility is independent of Predictability by construction. Predictability asks whether the intent was reachable without the body; Legibility asks how the body read once open. Inline comments therefore count toward Legibility but not toward Predictability, since they sit inside the text being predicted. The pairing separates situations Predictability alone merges: unpredicted but legible code is unguessable from outside and plain once opened, which points toward better names or documentation; unpredicted and illegible code is difficult at every level; and predictable but hard-to-follow code does an expected job in a confusing way. {?traps Read against Traps, a legible body that carries a reported trap is the most hazardous combination, because it reads as safe.}',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          'The grade is a model\'s report of its own behavior and varies between models. Reader-reported distributions have tended to crowd toward the top grade; the question was reworded to give readers observable criteria, and the lowest grade remains rare. Clarity is judged without surrounding context, so a body that is clear only once its types are known may be graded harshly. The scale is ordinal and coarse, and containers describe only their read lines.',
        ],
      },
    ],
    method: [
      'Legibility is graded in the same reading as Predictability, after the prediction has been recorded and the body read, so its procedure, storage, expiry and provenance are those described for Predictability. Readings of whole files do not grade legibility, because it is a judgment about one body.',
      'The reader receives only the extent being graded and cannot open callers, types or the rest of the file, and the grades are worded in terms of what a reader can observe about its own pass within that extent. Because the wording of this question has changed, a grade is valid only if the reading was taken under the current question. Grades made under an earlier question are kept as history but do not color a wedge or count toward a share, and they are replaced only by a complete new reading, since a grade given immediately after a prediction is part of a different measurement from one asked alone. The grades share Predictability\'s positions on the color ramp.',
    ],
  },

  docs: {
    deck: {
      definition:
        'Docs grades how much of a body its documentation covers, and documentation a model could derive from the code counts as none.',
      reading: 'Bright is undocumented and dim is covered; a file is colored by its header, not by its functions.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          'Docs measures how little of a body its documentation covers, as graded by the reader that read both. The reader grades coverage as *full*, *most*, *some* or *none*, and the figure shows the gap, so bright means undocumented. Documentation the reader judges derivable from the code alone counts as *none* in every derived number. Three units are graded: a function on its own documentation comment, a file on its header, and a directory by the share of graded files and functions beneath it whose documentation is *some* or *none*, each counted once.',
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          "Dim is covered and bright is undocumented. A function is colored by its own grade, and a file by its header's grade rather than by its functions, remaining uncolored until its header has been read. A directory is colored by its share of undescribed items. Uncolored wedges are unread or ungraded, and stale readings are hatched.",
          'Derivable documentation has two readings. Under the default it is drawn as *none*, on the view that it explains nothing a newcomer could not already infer; under the alternative it is drawn as *full*, on the view that a complete description is documentation however obvious. The choice changes color only, and the figure caption states which reading is shown.',
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'Docs describes how much written explanation is available to someone arriving at the code. It is distinct from Predictability: an unpredicted and undocumented body and an unpredicted but well-covered body are different situations, and only the first lacks a written explanation. The two lenses also check each other, since documentation that no longer describes its body should draw a low coverage grade and mislead the prediction, lowering Predictability. The derivable reading separates restatement from explanation, which a count of comment lines cannot do.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "Coverage is not accuracy: a reader grades how well the text covers the body it read, and a subtle inaccuracy can pass. Derivability depends on the reader's competence, since a stronger model finds more documentation derivable. Documentation attached to an enclosing type rather than the function is graded *none* for the function. The directory share counts items rather than lines, so a short function weighs as much as a long file, and unread items are excluded from it.",
        ],
      },
    ],
    method: [
      "The reader receives the documentation before predicting and, after reading the body, answers two questions about it. The first, *documented*, grades how well it covers what the code actually does, and is *none* when there is none. The second, *derivable*, asks whether the documentation says nothing that could not have been worked out from the code alone. A derivable document counts as *none* in every derived number, so that text a model could regenerate from the body adds no explanation, and a pass of generated comments cannot make a repository's figure uniformly well documented.",
      'Files are read as separate tasks: the reader predicts what the file is for from its name, header and declarations, then grades whether the header describes the contents and whether it is derivable. Because documentation is part of the reading hash, editing a comment expires the readings made against it. Documentation grades are reported beside Predictability and never subtracted from it. The grades are placed on the color ramp at 0.05, 0.30, 0.65 and 1.0.',
    ],
  },

  traps: {
    deck: {
      definition:
        'A trap is a hazard a reader found in a body that will catch out its next editor, and that nothing in the code warns about.',
      reading:
        'The trap color marks a reported trap; the two neutrals separate a body read and cleared from one not yet read under the current question.',
    },
    sections: [
      {
        heading: 'Definition',
        body: [
          "Traps records whether a reader identified something in a function's body that will catch out the next person to edit it, and that nothing in the code warns about. It is a mark, not a scale: a read function is either marked *trap* or *no trap reported*, and an unread function has no answer. Files and directories carry no value of their own.",
        ],
      },
      {
        heading: 'Reading the map',
        body: [
          'Functions marked *trap* take the trap color. Functions a reader examined without reporting a trap take the neutral labeled *no trap reported*, and functions no reader has examined under the current question, including *yes* answers given under an earlier, broader question, take the neutral labeled *unread*; stale readings fall with the unread. The two neutrals are kept distinct because confusing *nobody has looked* with *somebody looked and found nothing* would read as an all-clear. Containers are not colored and carry no rim distribution, because a share of contained traps is not what the question asks.',
        ],
      },
      {
        heading: 'Interpretation',
        body: [
          'A trap mark is evidence that a reader, having read the body, identified a concrete editing hazard and could state it in a sentence. Its value depends on its being rare enough to work through one by one. {?legible Traps is independent of Legibility, and the combination matters most where they disagree: a clean, readable body with a trap reads as safe and is not.} Read against Churn, a trap in frequently changed code is a hazard likely to be met soon; read against Age, a trap in long-untouched code is one that current contributors may never have encountered.',
        ],
      },
      {
        heading: 'Limitations',
        body: [
          "A clean wedge is not proof that no trap exists. Each reading is one model's pass over one bounded body, without callers, types or the rest of the file, so hazards arising across function boundaries are largely invisible. Sensitivity varies between models, the rates of false positives and false negatives have not been measured, and the mark carries no severity. By design, hazards the code already warns about are excluded, so a documented hazard does not appear however serious.",
        ],
      },
    ],
    method: [
      "The answer is given in the same reading as the other assessment grades, after the prediction and after the body has been read. The reader is asked to report a trap only when the code itself will bite whoever edits it next and nothing in it warns them. The illustrative categories are an ordering assumption nothing enforces, a silent failure, an unguarded index, a resource leaked on one path, and a cache key that omits something the cached value depends on. A hazard a comment already calls out, a documentation problem (which Docs grades) and the reader's own surprise are excluded. A trap cannot be reported without a note stating what breaks and when, and a report omitting the note is refused. The default answer is no, and readings of whole files do not answer the question.",
      'The question was narrowed in the current reading specification. An earlier *yes* may answer a broader question and is treated as dated. An earlier *no* is kept, because narrowing a question cannot turn a *no* into a *yes*. Readings are stored, keyed and expired as described for Predictability.',
    ],
  },
}
