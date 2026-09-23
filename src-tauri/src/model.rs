//! The shared vocabulary: what a wedge is, and what a score means.
//!
//! One rule governs everything downstream — **the ring's SIZE is lines, the ring's
//! COLOR is surprise, and they are independent measurements.** Size is the
//! boring axis (you already know your parser is long); color is the product. Anything
//! that blurs the two, like folding LOC into the score, throws away the only interesting
//! thing the picture says.
//!
//! Color is read from two different fields depending on the ring, and this is
//! deliberate: a function wedge shows [`Score::temperature`] (how hot *this* code is),
//! while a file or directory wedge shows [`Score::hot_share`] (how much of what's inside
//! is hot). Averaging temperature upward would flatten every inner ring to the repo mean
//! — see the field docs.

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Languages we can actually parse into functions. A file in any other language still
/// appears in the sunburst as a file-sized wedge — it just has no inner ring and no
/// score, which is honest: we didn't read it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    Rust,
    TypeScript,
    Tsx,
    JavaScript,
    Python,
    Go,
    Swift,
    C,
    Cpp,
    Java,
    Kotlin,
    CSharp,
    Ruby,
    Php,
    Lua,
    Elixir,
    Scala,
    Dart,
    Zig,
    ObjC,
    Shell,
    Sql,
    GdScript,
    GdShader,
    Haskell,
    Nix,
    PowerShell,
    Solidity,
    R,
    OCaml,
    OCamlLex,
    Cmake,
    Julia,
    Erlang,
    Pascal,
    Clojure,
    FSharp,
    Groovy,
    Elm,
    Fortran,
    Starlark,
    Verilog,
    SystemVerilog,
    Gleam,
    Odin,
    Perl,
    VisualBasic,
    Elisp,
    Qml,
    Scheme,
    Racket,
    CommonLisp,
    Cfml,
    Glsl,
    Hlsl,
    Slang,
    Ada,
    D,
    Vhdl,
    Zsh,
    Luau,
    Prolog,
    Jq,
}

/// A node's language on the wire, spelled the way a person reads it.
///
/// **One vocabulary, because two of them silently recoloured the map.** `Lang`'s derived
/// serialization is `rename_all = "lowercase"`, so a scan told the window `cpp`; the replay's
/// tables name the same language through [`Lang::label`], so a frame told it `C++`. Every
/// colour a lens gives out is keyed on that string, and nothing joins two spellings — so on
/// ceph the twelve live languages held slots 0..11 and every language in the replay was read
/// as one the map had never seen, taking a colour from the tail of the palette. Turning
/// History on recoloured the whole map, and the last frame of a story disagreed with the same
/// repo standing still.
///
/// The label wins because it is the half a person reads: `C++`, `JavaScript`, `PowerShell`
/// rather than `cpp`, `javascript`, `powershell`, which are a serde attribute leaking into a
/// legend. Nothing in the window ever compared against the lowercase form — every use of
/// `lang` is a swatch, a caption or a key — so the join was the only thing it was doing.
///
/// **Scoped to this field on purpose.** `Lang` is stored in `scancache::Entry` too, and that
/// cache memoises `git blame`: changing the enum's own representation would move its slot and
/// buy a repo the size of ceph an hours-long re-blame to fix the spelling of a caption. Here
/// it costs a tree cache, which is a rescan the parse cache already makes cheap.
///
/// An unreadable name deserializes to `None` rather than failing the record: a tree written
/// by a build that knew a language this one does not is still a map, and one wedge saying
/// nothing about its language is a smaller loss than the whole repo saying nothing at all.
mod lang_label {
    use super::Lang;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(lang: &Option<Lang>, s: S) -> Result<S::Ok, S::Error> {
        lang.map(|l| l.label()).serialize(s)
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Option<Lang>, D::Error> {
        Ok(Option::<String>::deserialize(d)?.and_then(|s| Lang::from_label(&s)))
    }
}

/// Every language this parser reads, and the extensions each answers to.
///
/// **One table, both directions.** `from_extension` reads it and so does `Lang::extensions`,
/// which is what lets the app SAY what it can read — see the languages sheet in the window.
/// Two matches would be two tables, and the one nobody calls is the one that goes wrong.
///
/// Order is the order they were added and nothing reads it: the sheet sorts by name. One row
/// per language, pinned by a test — two rows would make `extensions` return whichever came
/// first, which is how `.h` alone came back as everything C++ answers to.
pub const LANGS: &[(Lang, &[&str])] = &[
    (Lang::Rust, &["rs"]),
    (Lang::TypeScript, &["ts", "mts", "cts"]),
    (Lang::Tsx, &["tsx"]),
    (Lang::JavaScript, &["js", "mjs", "cjs", "jsx"]),
    (Lang::Python, &["py", "pyi"]),
    (Lang::Go, &["go"]),
    (Lang::Swift, &["swift"]),
    (Lang::C, &["c"]),
    // `.h` rides with C++ rather than C, and the reason is asymmetry rather than a claim:
    // a C header parses under the C++ grammar and yields the same functions, where the C
    // grammar on real C++ headers INVENTS them. `conventions.md` has the measurement.
    (Lang::Cpp, &["cc", "cpp", "cxx", "hpp", "hh", "hxx", "h"]),
    (Lang::Java, &["java"]),
    (Lang::Kotlin, &["kt", "kts"]),
    (Lang::CSharp, &["cs"]),
    (Lang::Ruby, &["rb"]),
    (Lang::Php, &["php"]),
    (Lang::Lua, &["lua"]),
    (Lang::Elixir, &["ex", "exs"]),
    (Lang::Scala, &["scala", "sc"]),
    (Lang::Dart, &["dart"]),
    (Lang::Zig, &["zig"]),
    (Lang::ObjC, &["m", "mm"]),
    (Lang::Shell, &["sh", "bash"]),
    (Lang::Zsh, &["zsh"]),
    (Lang::Sql, &["sql"]),
    (Lang::GdScript, &["gd"]),
    (Lang::GdShader, &["gdshader"]),
    (Lang::Haskell, &["hs", "lhs"]),
    (Lang::Nix, &["nix"]),
    (Lang::PowerShell, &["ps1", "psm1", "psd1"]),
    (Lang::Solidity, &["sol"]),
    (Lang::R, &["r", "R"]),
    (Lang::OCaml, &["ml", "mli"]),
    (Lang::OCamlLex, &["mll"]),
    (Lang::Cmake, &["cmake"]),
    (Lang::Julia, &["jl"]),
    (Lang::Erlang, &["erl", "hrl"]),
    (Lang::Pascal, &["pas", "pp"]),
    (Lang::Clojure, &["clj", "cljs", "cljc"]),
    (Lang::FSharp, &["fs", "fsi", "fsx"]),
    (Lang::Groovy, &["groovy", "gradle"]),
    (Lang::Elm, &["elm"]),
    (Lang::Fortran, &["f90", "f95", "f03", "f08"]),
    (Lang::Starlark, &["bzl", "star"]),
    (Lang::Verilog, &["v", "vh"]),
    (Lang::SystemVerilog, &["sv", "svh"]),
    (Lang::Gleam, &["gleam"]),
    (Lang::Odin, &["odin"]),
    (Lang::Perl, &["pl", "pm"]),
    (Lang::Prolog, &["pro", "prolog"]),
    (Lang::VisualBasic, &["vb"]),
    (Lang::Elisp, &["el"]),
    (Lang::Qml, &["qml"]),
    (Lang::Scheme, &["scm", "ss"]),
    (Lang::Racket, &["rkt"]),
    (Lang::CommonLisp, &["lisp", "lsp"]),
    (Lang::Cfml, &["cfc", "cfm"]),
    (Lang::Glsl, &["glsl", "vert", "frag", "geom", "comp"]),
    (Lang::Hlsl, &["hlsl", "hlsli"]),
    (Lang::Slang, &["slang"]),
    (Lang::Ada, &["adb", "ads"]),
    (Lang::D, &["d"]),
    (Lang::Vhdl, &["vhd", "vhdl"]),
    (Lang::Luau, &["luau"]),
    (Lang::Jq, &["jq"]),
];

impl Lang {
    /// Every language, once.
    ///
    /// **Only here so a name can be read back into a variant.** `label` is the one place a
    /// language is NAMED, and an inverse written as a second match would be a second list of
    /// those names — the drift this codebase has paid for twice. Searching this instead means
    /// there is still exactly one spelling of "C++" in the program.
    ///
    /// A linear scan over sixty-three entries, run once per file when a cached tree is read.
    /// Measured against ceph's 6,142 files it is not on any profile; a map would be a second
    /// structure to keep in step for no gain anyone can measure.
    pub const ALL: &'static [Lang] = &[
        Lang::Rust, Lang::TypeScript, Lang::Tsx, Lang::JavaScript, Lang::Python, Lang::Go,
        Lang::Swift, Lang::C, Lang::Cpp, Lang::Java, Lang::Kotlin, Lang::CSharp, Lang::Ruby,
        Lang::Php, Lang::Lua, Lang::Elixir, Lang::Scala, Lang::Dart, Lang::Zig, Lang::ObjC,
        Lang::Shell, Lang::Sql, Lang::GdScript, Lang::GdShader, Lang::Haskell, Lang::Nix,
        Lang::PowerShell, Lang::Solidity, Lang::R, Lang::OCaml, Lang::OCamlLex, Lang::Cmake,
        Lang::Julia, Lang::Erlang, Lang::Pascal, Lang::Clojure, Lang::FSharp, Lang::Groovy,
        Lang::Elm, Lang::Fortran, Lang::Starlark, Lang::Verilog, Lang::SystemVerilog,
        Lang::Gleam, Lang::Odin, Lang::Perl, Lang::VisualBasic, Lang::Elisp, Lang::Qml,
        Lang::Scheme, Lang::Racket, Lang::CommonLisp, Lang::Cfml, Lang::Glsl, Lang::Hlsl,
        Lang::Slang, Lang::Ada, Lang::D, Lang::Vhdl, Lang::Zsh, Lang::Luau, Lang::Prolog,
        Lang::Jq,
    ];

    /// A name back into a language. The exact inverse of [`Lang::label`], by construction.
    pub fn from_label(name: &str) -> Option<Lang> {
        Lang::ALL.iter().copied().find(|l| l.label() == name)
    }

    /// Extension → language. Deliberately conservative: an unrecognized extension is
    /// `None`, never a guess, because mis-parsing a file invents functions that aren't
    /// there and those go straight into the score.
    /// The language a file extension names, or `None` where this parser has no grammar for it.
    ///
    /// **A lookup over [`LANGS`], not a match of its own.** The reverse direction — which
    /// extensions a language answers to — is wanted by the window, which has to be able to say
    /// what it can read; two matches would be two tables and the second one would drift. One
    /// linear scan of 64 entries per file is nothing beside parsing the file.
    pub fn from_extension(ext: &str) -> Option<Lang> {
        LANGS.iter().find(|(_, exts)| exts.contains(&ext)).map(|(lang, _)| *lang)
    }

    /// The extensions this language answers to — the other direction of [`LANGS`].
    pub fn extensions(self) -> &'static [&'static str] {
        LANGS.iter().find(|(l, _)| *l == self).map(|(_, e)| *e).unwrap_or(&[])
    }

    pub fn label(&self) -> &'static str {
        match self {
            Lang::Rust => "Rust",
            Lang::TypeScript => "TypeScript",
            Lang::Tsx => "TSX",
            Lang::JavaScript => "JavaScript",
            Lang::Python => "Python",
            Lang::Go => "Go",
            Lang::Swift => "Swift",
            Lang::C => "C",
            Lang::Cpp => "C++",
            Lang::Java => "Java",
            Lang::Kotlin => "Kotlin",
            Lang::CSharp => "C#",
            Lang::Ruby => "Ruby",
            Lang::Php => "PHP",
            Lang::Lua => "Lua",
            Lang::Elixir => "Elixir",
            Lang::Scala => "Scala",
            Lang::Dart => "Dart",
            Lang::Zig => "Zig",
            Lang::ObjC => "Objective-C",
            Lang::Shell => "Shell",
            Lang::Sql => "SQL",
            Lang::GdScript => "GDScript",
            Lang::GdShader => "Godot Shader",
            Lang::Haskell => "Haskell",
            Lang::Nix => "Nix",
            Lang::PowerShell => "PowerShell",
            Lang::Solidity => "Solidity",
            Lang::R => "R",
            Lang::OCaml => "OCaml",
            Lang::OCamlLex => "OCamllex",
            Lang::Cmake => "CMake",
            Lang::Julia => "Julia",
            Lang::Erlang => "Erlang",
            Lang::Pascal => "Pascal",
            Lang::Clojure => "Clojure",
            Lang::FSharp => "F#",
            Lang::Groovy => "Groovy",
            Lang::Elm => "Elm",
            Lang::Fortran => "Fortran",
            Lang::Starlark => "Starlark",
            Lang::Verilog => "Verilog",
            Lang::SystemVerilog => "SystemVerilog",
            Lang::Gleam => "Gleam",
            Lang::Odin => "Odin",
            Lang::Perl => "Perl",
            Lang::VisualBasic => "Visual Basic",
            Lang::Elisp => "Emacs Lisp",
            Lang::Qml => "QML",
            Lang::Scheme => "Scheme",
            Lang::Racket => "Racket",
            Lang::CommonLisp => "Common Lisp",
            Lang::Cfml => "CFML",
            Lang::Glsl => "GLSL",
            Lang::Hlsl => "HLSL",
            Lang::Slang => "Slang",
            Lang::Ada => "Ada",
            Lang::D => "D",
            Lang::Vhdl => "VHDL",
            Lang::Zsh => "Zsh",
            Lang::Luau => "Luau",
            Lang::Prolog => "Prolog",
            Lang::Jq => "jq",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NodeKind {
    Dir,
    File,
    Func,
}

/// How we came to believe a body is test code, weakest claim last.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Tested {
    /// The toolchain says so, and being wrong would break the build. `#[cfg(test)]` is
    /// excluded from the binary by the compiler; `_test.go` is a rule of the `go` tool.
    /// A contract answers BOTH ways — "this is test code" and "this is not" are equally
    /// certain, which is what lets a reader be spared the question.
    Contract,
    /// The layout says so. `tests/`, `__tests__/`, `test_*.py` — a runner's published glob or
    /// a directory somebody named. Usually right, and nothing enforces it: `tests` is a domain
    /// noun in plenty of repos, vendored trees carry their own, and a fixture living under one
    /// is a grey area by definition rather than by detection failure.
    Convention,
    /// A reader read the body and said so. Asked only where no contract exists — see
    /// `Report::test` — because it is the only source that can see a fixture living in a
    /// production file, which is the case no path and no attribute reaches.
    Reader,
    /// **We parsed it and nothing marked it otherwise**, which is how [`Kind::Code`] is known
    /// and is not a weaker version of the three above.
    ///
    /// It was labelled `Convention` for a while, which read as `code (convention)` on the
    /// wedge and named a convention that does not exist. There is no habit being leaned on
    /// here: the file went through a real grammar, functions somebody wrote came out, and no
    /// banner, attribute, path or reader claimed it. That is a positive statement about a
    /// file — the most confident one this lens makes — and calling it the leftovers was a
    /// description of the order the checks run in rather than of what is known.
    Parsed,
}

/// What is known about whether a body is test code, and on what evidence.
///
/// **Three levels rather than a boolean, for the reason `Provenance` is four rather than
/// two.** A number computed from this would otherwise be an estimate whose accuracy is a
/// function of how many conventions we happened to encode — our diligence, smuggled in as if
/// it were a property of the code. Stated, it is a claim a reader of the finding can weigh.
///
/// **`None` is "nobody has said", never "not a test."** A contract that answers `Some(false)`
/// is a different fact entirely: the compiler has told us this ships.
///
/// Contract beats Reader beats Convention. A contract is a fact about what ships; a reader
/// actually read the body; a convention only ever saw the path.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Testness {
    pub is_test: bool,
    pub how: Tested,
}

/// What a body IS, which is a different question from what it does or who wrote it last.
///
/// **The four things a repo is made of.** A scan draws every line at the same weight, so a
/// vendored tree and a protobuf dump arrive looking exactly like code somebody sat down and
/// wrote — and on a large repo that is most of the picture. This is the question the map
/// could never answer: how much of this is yours to maintain?
///
/// It is deliberately not a judgement. Generated code is not worse code; it is code nobody is
/// going to split up, which is why `findings::not_ours` already refuses to raise findings
/// about it. That classification existed and was thrown away after deciding where to point —
/// this draws the same answer instead of computing it a second time somewhere else.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    /// Somebody here wrote it and it ships — parsed as source, with nothing marking it as
    /// anything else. See [`Tested::Parsed`]: that is an assertion, not a leftover.
    ///
    /// It was briefly conditional on test-ness being KNOWN false, which sounded careful and
    /// made the lens useless: C++ has no marker for a test, so nothing was ever code and
    /// ceph reported 1,363,232 of its 1.5M lines as unplaceable. Being unable to tell a test
    /// from an implementation does not make a `.cc` file unplaceable — it makes it code that
    /// might be a test, and the first half of that is worth drawing.
    Code,
    /// It declares rather than implements — `.h`, `.hpp`, `.d.ts`, `.pyi`.
    ///
    /// A header is not a smaller kind of code, it is a different job: five hundred lines of
    /// declarations is not five hundred lines of logic, and on a C++ repo they are a serious
    /// share of everything. `.d.ts` is the strongest case — the TypeScript compiler treats it
    /// as declarations and emits nothing — and `.h` is the universal one.
    Header,
    /// It exists to check the code — see [`Testness`], which is where this one is decided.
    Test,
    /// A tool wrote it. `// Code generated by … DO NOT EDIT` is a contract in the strongest
    /// sense available: the machine that made it says editing is pointless.
    Generated,
    /// Somebody else wrote it and it lives here. `vendor/`, `node_modules/`, and whatever
    /// `.gitattributes` marks `linguist-vendored`.
    Vendored,
}

/// What a body is, and on what evidence — the same three tiers [`Testness`] uses.
///
/// The tiers carry across unchanged, which is the argument for one classification rather than
/// four: a `linguist-generated` line in `.gitattributes` is the repo's author writing down
/// what a file is, exactly as a `jest` key is. A path is a convention. A reader is a reader.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Kinded {
    pub kind: Kind,
    pub how: Tested,
}

/// Where an explanation came from. This is not decoration — it is the thing that keeps
/// the map honest.
///
/// A model-written comment must not cool a wedge as much as a human-written one. If the
/// model could produce the explanation from the code alone, the explanation was already
/// latent in the code and the wedge was never really hot; letting it cool is circular,
/// and it opens the degenerate path where someone runs an LLM over the repo, everything
/// turns green, and the map is a liar. Only information the model did NOT have —
/// a human's answer, a commit message, a linked issue — is real explanation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provenance {
    /// Nothing explains this code.
    None,
    /// A doc comment already in the source, author unknown. The common case on a first
    /// scan, and the reason `documented` is graded by a reader rather than counted.
    Source,
    /// Recovered from git history / an issue — information outside the code.
    History,
    /// The human answered "why is this like this?". The only fully-weighted cooling.
    Human,
}

impl Provenance {
    /// How much of a measured explanation this provenance is allowed to bank. See the
    /// type docs: model-authored text cools nothing, and `Source` is discounted because
    /// we cannot tell who wrote it — increasingly, an agent did.
    pub fn weight(&self) -> f32 {
        match self {
            Provenance::None => 0.0,
            Provenance::Source => 0.6,
            Provenance::History => 0.85,
            Provenance::Human => 1.0,
        }
    }
}


/// Which instrument produced a leaf's score.
///
/// The map must never paint a wedge with a number the user didn't ask for. When a model
/// is enabled, everything it hasn't reached yet stays uncolored rather than borrowing
/// the offline proxy's guess. Gray means "not looked at", which is information; a
/// plausible color that turns out to be the proxy is worse than no color at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Proxy,
    Model,
    /// An agent read it and reported back. Distinct from `Model` on purpose: this is a
    /// judgement made with the whole repo in view, not a probability over tokens, and the
    /// UI should never present the two as if they were the same measurement.
    Agent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Score {
    /// 0..1 — how unpredictable the body is given its name, signature and neighbors.
    /// The whole product rests on this number being meaningful.
    pub surprise: f32,
    /// 0..1 — how well the attached documentation covers what the code actually does.
    ///
    /// A REPORT, not a discount. It used to multiply into `temperature`, which
    /// double-counted the moment documentation reached the instrument that measures
    /// surprise: a doc that explains the body makes the body predictable, so the
    /// surprise term already fell. Worse, the old lexical version could only reward
    /// vocabulary OVERLAP, so a confidently wrong comment that happened to share words
    /// with the code raised it and COOLED the wedge — precisely backwards, since stale
    /// documentation is the common failure and ought to read hot.
    ///
    /// Now the reader with the docs in hand grades them, and the grade is shown rather
    /// than folded into the color.
    pub documented: f32,
    /// 0..1 — how fast this code is changing, one value per window in
    /// [`crate::scan::Stats::churn_windows`].
    ///
    /// **Four, because the window is the reader's choice and the answer cannot be re-derived
    /// from one of them.** A file's rate at thirty days does not follow from its rate at
    /// ninety, and a DIRECTORY's is a line-weighted mean of its children's — so a window
    /// switched in the browser would need the whole tree re-aggregated in Rust and sent back.
    /// Four floats a node is 16 bytes, which on the largest repo tried is under 4MB; the round
    /// trip is a redraw of everything.
    ///
    /// All four are zero where the timeline has not been walked. That is not "settled" and
    /// nothing may draw it as such — see `Stats::churned`, which is where the repo says whether
    /// this was measured at all. A per-node absence would be that answer repeated on every
    /// segment, which is the thing `CLAUDE.md` names.
    pub churn: [f32; 4],
    /// Days since the code first appeared. `None` when there is no git history.
    pub age_days: Option<f32>,
    /// The raw count behind `churn`. Shown to the user instead of the normalized figure,
    /// because a number of commits is a fact and a percentage of a saturation constant is
    /// not.
    ///
    /// **It counted a different thing on a function than on a file, and no longer does.** A
    /// file's was commits in the ninety-day window and a function's was how many distinct
    /// commits its current lines traced back to — one ramp over two quantities, which the UI
    /// had to caption its way out of. Both are now the same question at both resolutions:
    /// commits that CHANGED this, inside the window, counted off the timeline. See `edits.rs`
    /// for why blame could never answer it and `docs/notes/time.md` for how it came to.
    ///
    /// One entry per window in [`crate::scan::Stats::churn_windows`], and zeroes where the
    /// timeline has not been walked — see `churn` above for why the absence is stated once,
    /// on the repo, rather than on every node.
    pub commits: [u32; 4],
    /// Every commit that has ever touched this path, or `None` where git has never seen it.
    ///
    /// The figure a header wants: `commits` is a RATE over a window and this is a SIZE. A
    /// function has none — its lifetime count is `git log -L`, a process apiece — and `None`
    /// there means "not this kind of question", the same way it means "no history" on a file.
    /// Both absences print nothing rather than a zero.
    pub all_commits: Option<u32>,
    /// Days since the most recent commit. `None` without history.
    pub last_touched_days: Option<f32>,
    /// How tangled this is, on the 0..1 scale the ramp paints — `[weighted, raw]`.
    ///
    /// Two, because which one is being looked at is a live choice in the window and
    /// re-deriving a whole tree behind a two-position switch would be a round trip per press.
    /// Weighted asks whether this is more complicated than its LENGTH suggests, which is the
    /// finding; raw is the count itself, for triage against an absolute bar. See
    /// `tangle::Bands::ramp`.
    ///
    /// **`None` is "this grammar has no branch table", never "no branches".** It propagates
    /// from `parse::branch_kinds` through `FuncDef::cognitive`, and the lens paints grey on it
    /// exactly as Callers does on a language whose calls nobody taught it to follow. A zero
    /// would report untaught as simple.
    pub tangle: Option<[f32; 2]>,
    /// The raw cognitive score behind `tangle` — every fork costing one, plus one for each
    /// fork it nests inside.
    ///
    /// A function's own count; a container's is the SUM of everything under it, which is the
    /// figure a header wants. Shown rather than the normalized value, for the reason
    /// `commits` is: a count of decisions is a fact and a percentage of a saturation constant
    /// is not.
    pub cognitive: Option<u32>,
    pub provenance: Provenance,
    /// The fraction of this node's lines that sit in code which is hot.
    ///
    /// **This, not `temperature`, is what colors a directory or file wedge.** Averaging
    /// temperature up the tree destroys the signal: a mean over four hundred functions
    /// converges on the repo's mean by construction, so every inner ring comes out the
    /// same lukewarm color and the biggest wedges on screen — the ones the eye reads
    /// first — say nothing. Thresholding at the leaf and averaging the 0/1 indicator
    /// keeps the spread, because you are no longer averaging a bell.
    ///
    /// It is also the more useful sentence. "A fifth of this directory is surprising"
    /// is actionable; "this directory's mean temperature is 0.41" is not.
    pub hot_share: f32,
    pub source: Source,
    /// Share of this node's lines whose score came from the model. 0 on a wedge nothing
    /// has analyzed, 1 when the model reached everything underneath.
    pub analyzed_share: f32,
}

/// Temperature at which a function counts as hot for [`Score::hot_share`].
pub const HOT: f32 = 0.5;

impl Score {
    /// What the wedge is colored by.
    ///
    /// Now simply the surprise, because documentation reaches the measurement itself:
    /// the model is given the comment stack a reader would have, and an agent reads the
    /// docs before it predicts. Explain a function well and the next reading of it is
    /// genuinely less surprising — the map still drains as you document, but through
    /// the instrument rather than through a multiplier bolted on afterwards.
    ///
    /// Kept as a named method rather than inlined: this is the one number the color
    /// means, and it has changed definition once already.
    pub fn temperature(&self) -> f32 {
        self.surprise.clamp(0.0, 1.0)
    }

}

/// One wedge. Directories contain files contain functions; the sunburst renders this
/// tree directly, one ring per depth.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    /// Stable across scans: repo-relative path for dirs/files, `path#name@line` for
    /// functions. The UI keys selection and the drill-in stack off this.
    pub id: String,
    pub name: String,
    pub kind: NodeKind,
    /// Repo-relative, forward-slashed on every platform so ids don't change shape
    /// between a Windows scan and a Mac one.
    pub path: String,
    /// Lines. For a function, its own extent; for a file or directory, the sum of its
    /// children — so a wedge is always exactly as wide as what it contains.
    pub loc: u32,
    /// Lines holding code — see [`crate::parse::FuncDef::ncloc`]. Summed like `loc` on a
    /// container. What Complexity is judged against; `loc` stays the width.
    #[serde(default)]
    pub ncloc: u32,
    /// 1-indexed first line, for functions.
    pub line: Option<u32>,
    /// 1-indexed last line, for functions. Paired with `line` so the code view can map a
    /// source line back to the chunk that owns it — a start alone can't say where a
    /// function stops, and guessing from the next function's start is wrong the moment
    /// anything sits between them.
    #[serde(default)]
    pub end_line: Option<u32>,
    /// How many BYTES a reader would be handed for this node, if it were revealed.
    ///
    /// Lines are what a wedge is drawn from; bytes are what a tool result has to carry, and
    /// the two part company badly on exactly the code this matters for. Every cap a reader
    /// meets — its harness's MCP output limit, its own context — is counted in tokens, and
    /// the only thing the server can cheaply convert to tokens is bytes.
    ///
    /// **It is a property of the reader, never of the repo**, which is why the thresholds it
    /// is compared against ([`crate::agentapi::PART_BYTES`], [`crate::agentapi::READ_CEILING`])
    /// are derived from harness caps and context windows rather than measured on a corpus.
    /// Sizing them to the code we happen to have would set a constant that is wrong the first
    /// time somebody reads with a different agent.
    ///
    /// For a function, its signature plus its body — what `reveal` slices out of the file.
    /// For a file, the file's own length, because a file task is revealed whole. `None` on a
    /// directory, which is never handed to a reader.
    ///
    /// Free to carry: the signature and body are already in `scancache`, and a file's length
    /// is `Ident::len`, which the cache gates on either way. Adding it moved
    /// [`crate::treecache::VERSION`] — a tree cached by the old version has no extent on any
    /// node, and a missing extent must not read as a small one.
    #[serde(default)]
    pub bytes: Option<u32>,
    #[serde(with = "lang_label")]
    pub lang: Option<Lang>,
    /// Who last committed to this file.
    ///
    /// On the node rather than in `Score`, because it is metadata about the code like
    /// `path` and `lang` — not a component of the reading. It also keeps `Score` `Copy`,
    /// which the whole aggregation path relies on.
    #[serde(default)]
    pub last_author: Option<String>,
    /// Whose lines most of this body IS, where blame could read it.
    ///
    /// **A different question from `last_author` and often a different answer**: a typo fix in
    /// a four-hundred-line function makes somebody its last toucher while they hold one line.
    /// Not `owner` and not `author` — blame reports who touched each line LAST, so a body
    /// rewritten wholesale reads as new and everyone whose lines were replaced is gone rather
    /// than diminished. This says who holds what is STANDING. See `docs/plans/open/blame-ownership.md`.
    ///
    /// Beside `last_author` for the same reason: metadata about the code, kept out of `Score`
    /// so that stays `Copy`.
    #[serde(default)]
    pub main_author: Option<String>,
    /// How many people's lines are standing in this body.
    ///
    /// **The count the findings grammar wants, because a rule may not name a person.** That
    /// would be a rule about what a thing is CALLED, which the grammar refuses; a rule can
    /// count them instead. `None` where blame has not read this range — never zero, which
    /// would be a claim that nobody wrote it.
    #[serde(default)]
    pub headcount: Option<u32>,
    /// The comment attached to this chunk, if any.
    ///
    /// Carried on the node rather than left in the parse because two readers need it
    /// after the tree exists: the model, whose prompt includes the comment stack, and an
    /// agent, which is handed the docs before it predicts. Metadata about the code, like
    /// `path` — not a component of the reading, and kept out of `Score` so that stays
    /// `Copy`.
    #[serde(default)]
    pub doc: Option<String>,
    /// The declaration line — everything up to the body.
    ///
    /// Carried so the queue can hand it to a reader. The metric has always been "predict
    /// the body from its name, signature and neighbors", but the signature was never
    /// actually sent: readers got a bare name, which makes an overloaded pair literally
    /// unresolvable. On a real repo an encoder/decoder sharing a name appeared in the
    /// sibling list twice, the reader guessed the wrong direction, and was scored as
    /// having failed to predict code it had been given no way to identify.
    #[serde(default)]
    pub signature: Option<String>,
    /// The type, trait or class this function hangs off, for functions that hang off one.
    ///
    /// Carried for the same reason as `signature`, and for a failure one step worse than
    /// the one that earned it: a file with a dozen same-named methods gives the reader a
    /// name that identifies nothing, so it predicts one twin and is graded against
    /// another. Beside `name` and never folded into it — `key_of` keys every committed
    /// reading on the name, and renaming would expire a repo's assessment wholesale.
    #[serde(default)]
    pub owner: Option<String>,
    /// Set on a FILE node that `.sanityignore` matched. Its functions are still parsed,
    /// still drawn, and still counted — as excluded, separately and out loud. What they
    /// are not is queued, or in the denominator that "43% assessed" divides by.
    ///
    /// Kept rather than dropped so the number can be reported. An exclusion nobody can
    /// count is how a map ends up claiming completeness over a subset somebody chose
    /// months ago and forgot.
    #[serde(default)]
    pub excluded: bool,
    /// A short hash of this function's body, for functions.
    ///
    /// The only way a committed assessment can know it has gone stale. An entry in
    /// `.sanity` records the hash it was written against; when the body moves out from
    /// under it, the two disagree and the reading goes back in the queue. Whitespace is
    /// collapsed before hashing so `cargo fmt` doesn't invalidate a repo's worth of
    /// honest readings — a reformat changes no reader's expectation.
    #[serde(default)]
    pub body: Option<String>,
    pub score: Option<Score>,
    /// Places the model did not see coming, with what it expected instead. Empty unless
    /// a model analyzed this function — this is the evidence behind the number, and the
    /// only part of a reading a reader can act on directly.
    #[serde(default)]
    pub hotspots: Vec<crate::surprise::Hotspot>,
    /// This function's wiring: who calls it, what it calls, and how far those neighbours
    /// live from it.
    ///
    /// From the parse, not from a reading — available the moment a repo is opened, with no
    /// tokens spent and no git history needed, which on a repo a model generated an hour ago
    /// is the only evidence there is. See [`crate::edges`].
    ///
    /// **`None` means the language's call shape has never been parsed**, never "nothing calls
    /// this". Those are opposite facts and the map paints them differently: an absence is
    /// gray, a genuine zero is the brightest thing on the Reach lens. Kept on the node beside
    /// `lang` and `path` rather than in `Score`, because it is a property of the code rather
    /// than a component of a reading — and because `Score` is `Copy`, which the aggregation
    /// path relies on.
    #[serde(default)]
    pub callers: Option<u32>,
    /// Does a test call this, and `None` where test code cannot be told apart here.
    ///
    /// **"A test calls this", not "this is covered"** — see [`crate::edges::Wire::under_test`].
    #[serde(default)]
    pub under_test: Option<bool>,
    /// What this body IS — code, a test, generated, or vendored — and on what evidence.
    ///
    /// Named `code_kind` because `kind` is taken by [`NodeKind`], which answers whether this
    /// is a directory, a file or a function. Two different questions and the shorter name was
    /// already spent.
    #[serde(default)]
    pub code_kind: Option<Kinded>,
    /// Is this body itself test code, and on what evidence — see [`Testness`].
    ///
    /// Carried so the map can draw where a repo's tests are, which is a question nothing else
    /// on the node answers: `under_test` says what a test reaches, and this says what a test
    /// IS. `None` on a container, and on any body nothing could tell either way.
    #[serde(default)]
    pub tested: Option<Testness>,
    /// Callers that are not this repo's own test code — see [`crate::edges::Wire::dependents`].
    ///
    /// `None` where the language offers no reliable way to tell test code apart, which is a
    /// third state and not a zero: C++ has no test contract at all.
    #[serde(default)]
    pub dependents: Option<u32>,
    #[serde(default)]
    pub calls: Option<u32>,
    /// Distinct neighbours — callers and callees together, a mutual pair counted once — and
    /// how many of them live outside this function's own directory.
    ///
    /// The COUNTS travel rather than the ratio they make, and that is the whole reason there
    /// are two fields here instead of one `locality: f32`. A container's locality is
    /// `sum(away) / sum(incident)` over everything underneath it; from ratios alone the
    /// browser could only average, which weights a function with one edge the same as one
    /// with thirty and turns the inner rings into a count of small functions. One formula,
    /// applied at two scopes, needs the numerator and the denominator.
    #[serde(default)]
    pub incident: Option<u32>,
    #[serde(default)]
    pub away: Option<u32>,
    /// Functions underneath whose language resolves calls, and how many of those nothing in
    /// this repo calls. On a function itself, `1` and `0`-or-`1`.
    ///
    /// **Rolled up here rather than walked in the browser, and `slim` is why.** A window is
    /// handed a tree with no function nodes in it — see [`Node::slim`] — so a share computed
    /// by walking down to the leaves finds nothing on exactly the repos big enough to need
    /// the lens. This is the same reason `hot_share` is computed in `aggregate` and not in
    /// the frontend, and the first draft of these lenses got it wrong in the way that rule
    /// exists to prevent: both went gray above the file ring on anything large.
    ///
    /// Defined identically at every level so one formula serves both — `orphans / resolvable`
    /// is a function's own state at the leaf and a directory's unreferenced share above it,
    /// exactly as `away / incident` is.
    #[serde(default)]
    pub resolvable: Option<u32>,
    #[serde(default)]
    pub orphans: Option<u32>,
    /// Of those, how many call nothing in this repo. The outbound twin of `orphans`, and the
    /// container's whole reading under the Reach lens: at the leaf fan-out is a count, above
    /// it there are no counts to average, only a share of functions that reach out at all.
    ///
    /// Rolled up here for the reason `orphans` is — see above, and [`Node::slim`].
    #[serde(default)]
    pub sinks: Option<u32>,
    /// This function's copies: which group of identical bodies it belongs to, and how big
    /// that group is — see [`crate::clones`]. `None` on a function with no twin AND on one
    /// too small to compare; `comparable` is what tells those apart.
    #[serde(default)]
    pub clone_group: Option<u32>,
    #[serde(default)]
    pub clone_size: Option<u32>,
    /// Whether this function was big enough to compare, and whether it turned out to have a
    /// twin: `1` and `0`-or-`1`, or `None` below the token floor.
    ///
    /// **Deliberately NOT rolled up, where every other pair here is.** `resolvable`/`orphans`
    /// climb the tree because a share of them is a real reading about a directory; a clone is
    /// a flashpoint — one body, findable and checkable — and "this directory is 12% clones"
    /// is a quantity the lens does not measure and cannot act on. Containers stay `None` and
    /// paint nothing, the same as they do under Traps.
    #[serde(default)]
    pub comparable: Option<u32>,
    #[serde(default)]
    pub copied: Option<u32>,
    #[serde(default)]
    pub children: Vec<Node>,
    /// How many functions a FILE holds, for a tree sent without them — see [`Node::slim`].
    /// Zero everywhere else, and zero on a full tree, where the children are the answer.
    ///
    /// **Written even when zero, like every other field here.** The absent fields were
    /// skipped on the wire for a while — a hundred thousand `"children":[]` is megabytes of
    /// nothing — and that is incompatible with a format that is not self-describing: the
    /// tree cache encodes fields positionally, so an omitted one makes the decoder read the
    /// next field's bytes into the wrong slot. It cost 10% of a payload that is now 3.3MB.
    #[serde(default)]
    pub funcs: u32,
    /// The bucketable numbers of this FILE's functions, as columns — see [`Cols`].
    #[serde(default)]
    pub cols: Option<Cols>,
    /// Files in THIS directory the walk could not parse — see [`crate::scan::Unscanned`].
    ///
    /// Its own field so that [`Node::aggregate`] is idempotent. That function rebuilds every
    /// container from its children and is called more than once — the trace lands and calls
    /// it again — so a single field holding "mine plus everyone below me" would double on the
    /// second pass or be erased on it, depending which way it was written. This one is set at
    /// build and never touched again; [`Self::unparsed`] is the derived one.
    #[serde(default)]
    pub unparsed_here: u32,
    /// Files under this node the walk could not parse, this directory's own included.
    ///
    /// **The number the corner chip reads, and it has to scope the way its neighbours do.**
    /// That chip already reports wedges too thin to draw, which is computed per VIEW: drill
    /// into `src/` and it describes `src/`. A repo-wide count sitting beside it would be
    /// right at the root and quietly wrong at every depth below, next to two numbers that
    /// updated — a band claiming something it cannot know. Rolled up here so it is a property
    /// of the node like `loc`, correct wherever the reader is standing.
    ///
    /// A file dropped from a directory that holds no parseable file at all has no node to be
    /// counted on. It lands on the nearest ancestor that does exist, which is the root at
    /// worst — see `scan::stamp_unparsed`. So the total is always whole; only its depth is
    /// approximate, and it errs toward the root rather than inventing a wedge.
    #[serde(default)]
    pub unparsed: u32,
}

/// A file's functions, reduced to the numbers a distribution is built from.
///
/// **A directory's rim draws what is underneath it, and "underneath" cannot mean "whatever
/// the window happened to fetch".** The map colours a container by a roll-up — a hot share,
/// a mean age — and every one of those survives [`Node::slim`] because it is folded here,
/// over every function, once. A DISTRIBUTION had no such path: the window builds it by
/// walking the function nodes it holds, and it holds a file's ring only after asking for
/// one. On kibana that is a handful of files out of 59,008, so the histogram was either
/// missing or, worse, a confident picture of a biased sample — three files with rings, all
/// touched last week, and the directory holding four thousand drawn as entirely fresh.
///
/// **Columns rather than bands, because the browser owns what a band MEANS.** Bucketing
/// here would put `CALLER_BANDS` and `AGE_BANDS` in two languages, and the copy nobody is
/// looking at is the one that goes wrong — the same argument that keeps one MCP schema.
/// What ships is the raw per-function numbers; the window buckets them with the same code
/// it uses on real function nodes, so a file with its ring fetched and a file without one
/// go down one path and cannot disagree.
///
/// **Cheap because it is only numbers.** `slim` exists because ceph's full tree is 75MB of
/// JSON — names, signatures, docs and bodies. Five numeric columns are about 3.7MB across
/// kibana's 148,000 functions, and they replace nothing: a ring fetched later is still the
/// authority, because it carries everything.
///
/// Absences are `-1` rather than `null`, so a column is a flat array of numbers on the wire
/// and in the positional tree cache. Each is documented where it is filled.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct Cols {
    /// Lines per function, which is what every bucket is weighted by.
    pub loc: Vec<u32>,
    /// `Score::commits`, one entry per window — see `crate::scan::ScanStats::churn_windows`.
    ///
    /// `[-1; 4]` where the repo has no history, which every lens draws as an absence rather
    /// than as a zero. **All four rather than the rung in use**, because the rung is a live
    /// choice in the window and a file banded from its columns must not report one horizon's
    /// count while the map around it is painted at another.
    pub commits: Vec<[i32; 4]>,
    /// `Score::last_touched_days`, rounded. `-1` where the repo has no history.
    pub touched: Vec<i32>,
    /// In-repo callers, `-1` where this language's calls were never parsed — the absence
    /// the Callers lens draws grey rather than as a zero.
    pub callers: Vec<i32>,
    /// What the Composition lens paints, per function: `0` code, `1` test, `2` generated,
    /// `3` vendored, `-1` nothing could place it.
    ///
    /// **Here for the same reason `tangle` is: so a FILE can stand in for functions the
    /// window has not been sent.** Rings are fetched only for files wide enough to draw an
    /// inside, so at the root of any real repo most files have no function nodes — and a
    /// histogram built from the ones that happen to have arrived is a confident picture of a
    /// biased sample, which `histogramsFor` opens by naming as the worse failure. One entry
    /// per function rather than a share, so the distribution a directory draws is its
    /// functions' own.
    pub kind: Vec<i8>,
    /// In-repo calls made, with the same `-1`.
    pub calls: Vec<i32>,
    /// Size of this function's clone group, `0` for none and `-1` for a body under the
    /// token floor, which is "never compared" rather than "unique".
    pub clones: Vec<i32>,
    /// `Score::tangle`, as `[weighted, raw]` in thousandths — see `tangle::Bands::ramp`.
    ///
    /// **Integers because this is a wire format**, and `-1` for a body whose language has no
    /// branch table, which is the absence every other column here encodes the same way. A zero
    /// would report an untaught grammar as code that never forks.
    ///
    /// Carried at all because a file whose ring never arrived has to be able to answer the
    /// Complexity question for its own functions. Without it the rim over such a file draws a
    /// distribution that silently omits it — which on a large repo is most of the tree, and is
    /// the exact failure `histogramsFor` opens by naming.
    pub tangle: Vec<[i32; 2]>,
}

impl Cols {
    /// One file's functions, columnised. Non-function children are skipped: a file holds
    /// only functions, and a defensive filter here is cheaper than a surprise later.
    fn of(funcs: &[Node]) -> Cols {
        let mut c = Cols::default();
        for f in funcs.iter().filter(|f| f.kind == NodeKind::Func) {
            c.loc.push(f.loc);
            // `-1` is "no history", which the lens draws as an absence. A repo with no git
            // gives every function the same -1 and the map says so once, rather than
            // drawing a ring of confident zeros.
            //
            // **All four windows, and carrying only the default one was tried and was wrong.**
            // The argument for one was size: a column is a fallback for a file whose ring never
            // arrived, and four counts per function quadruples the widest structure the app
            // sends. The argument against is that it is not a fallback, it is a WRONG ANSWER —
            // a file banded from its columns would report its ninety-day count while the map
            // around it was painted at thirty, and nothing on screen would say so. Measured, the
            // cost is about 1.4MB on the largest repo tried, which is the price of the band
            // being the band it claims to be.
            let (commits, touched) = match f.score {
                Some(s) if s.age_days.is_some() => (
                    s.commits.map(|n| n as i32),
                    s.last_touched_days.map(|d| d.round() as i32).unwrap_or(-1),
                ),
                _ => ([-1; 4], -1),
            };
            c.commits.push(commits);
            c.touched.push(touched);
            c.callers.push(f.callers.map(|v| v as i32).unwrap_or(-1));
            c.kind.push(match f.code_kind.map(|k| k.kind) {
                Some(Kind::Code) => 0,
                Some(Kind::Test) => 1,
                Some(Kind::Generated) => 2,
                Some(Kind::Vendored) => 3,
                Some(Kind::Header) => 4,
                // **Absent is its own value and never `code`.** A file nothing could place is
                // not "probably yours" — that is the shrug this lens exists to draw apart
                // from a classification.
                None => -1,
            });
            c.calls.push(f.calls.map(|v| v as i32).unwrap_or(-1));
            // Three states, and the middle one is the point: `0` is "compared, no twin",
            // `-1` is "never compared". Collapsing them would let the map say a function is
            // unique when nobody looked — see `comparable`.
            c.tangle.push(match f.score.as_ref().and_then(|s| s.tangle) {
                Some(t) => [(t[0] * 1000.0) as i32, (t[1] * 1000.0) as i32],
                None => [-1, -1],
            });
            c.clones.push(match (f.comparable, f.clone_size) {
                (None, _) => -1,
                (Some(_), Some(n)) => n as i32,
                (Some(_), None) => 0,
            });
        }
        c
    }
}

impl Node {
    pub fn dir(path: &str, name: &str) -> Node {
        Node {
            // Stamped after the tree exists — see `scan::stamp_unparsed`.
            unparsed_here: 0,
            unparsed: 0,
            id: path.to_string(),
            name: name.to_string(),
            kind: NodeKind::Dir,
            excluded: false,
            path: path.to_string(),
            loc: 0,
            ncloc: 0,
            line: None,
            lang: None,
            last_author: None,
            main_author: None,
            headcount: None,
            doc: None,
            signature: None,
            owner: None,
            body: None,
            end_line: None,
            // A directory is never handed to a reader, so it has no extent to serve. `None`
            // is the honest answer rather than the sum of what is under it — that number
            // would be real and would mean nothing, since no reading is ever taken of it.
            bytes: None,
            score: None,
            hotspots: Vec::new(),
            callers: None,
            dependents: None,
            under_test: None,
            tested: None,
            code_kind: None,
            calls: None,
            incident: None,
            away: None,
            resolvable: None,
            orphans: None,
            sinks: None,
            clone_group: None,
            clone_size: None,
            comparable: None,
            copied: None,
            children: Vec::new(),
            funcs: 0,
            cols: None,
        }
    }

    /// Roll child LOC and scores up the tree. Aggregation is **LOC-weighted**: a
    /// directory's temperature is the temperature of its lines, not the average of its
    /// functions. Otherwise one hot three-line helper makes a 4,000-line directory look
    /// like it's on fire, and the map stops meaning anything at the outer rings.
    pub fn aggregate(&mut self) {
        if self.children.is_empty() {
            // A leaf still answers for itself: a directory whose every file was unreadable
            // has no children to sum and is exactly the case worth reporting.
            self.unparsed = self.unparsed_here;
            return;
        }
        for c in &mut self.children {
            c.aggregate();
        }

        if self.kind != NodeKind::Func {
            self.loc = self.children.iter().map(|c| c.loc).sum();
            self.ncloc = self.children.iter().map(|c| c.ncloc).sum();
        }
        // Mine plus everyone below me, from the field that is never rewritten — see
        // `unparsed_here`, which is why running this twice lands on the same number.
        self.unparsed =
            self.unparsed_here + self.children.iter().map(|c| c.unparsed).sum::<u32>();

        // The wiring counts, summed rather than averaged. A directory's locality is
        // `sum(away) / sum(incident)` over everything underneath it, not the mean of its
        // children's ratios — a mean weights a helper with one edge the same as a hub with
        // thirty, so an inner ring would report how many small functions a directory holds.
        // `None` unless something underneath resolves calls at all, so a tree of a language
        // nobody has read stays an absence all the way up instead of becoming a confident
        // zero at the first container.
        let mut wired: Option<(u32, u32, u32, u32, u32)> = None;
        for c in &self.children {
            let (Some(i), Some(a), Some(r), Some(o), Some(s)) =
                (c.incident, c.away, c.resolvable, c.orphans, c.sinks)
            else {
                continue;
            };
            let t = wired.get_or_insert((0, 0, 0, 0, 0));
            t.0 += i;
            t.1 += a;
            t.2 += r;
            t.3 += o;
            t.4 += s;
        }
        if self.kind != NodeKind::Func {
            if let Some((i, a, r, o, s)) = wired {
                self.incident = Some(i);
                self.away = Some(a);
                self.resolvable = Some(r);
                self.orphans = Some(o);
                self.sinks = Some(s);
            }
        }

        let mut w = 0.0f32;
        let (mut surprise, mut documented) = (0.0f32, 0.0f32);
        let mut churn = [0.0f32; 4];
        let mut hot = 0.0f32;
        let mut analyzed = 0.0f32;
        let mut age: Option<f32> = None;
        let mut touched: Option<f32> = None;
        // **Weighted by lines like every other roll-up, and only over the children that HAVE
        // an answer.** A file holding one Rust function and one in a language with no branch
        // table is half-measured, and averaging the untaught half in as zero would report it
        // as half as tangled as it is. `tw` is the weight of what could be counted, which is
        // not `w`.
        let mut tangle = [0.0f32; 2];
        let mut tw = 0.0f32;
        let mut cognitive: Option<u32> = None;
        for c in &self.children {
            let Some(s) = c.score else { continue };
            let cw = c.loc.max(1) as f32;
            w += cw;
            surprise += s.surprise * cw;
            documented += s.documented * cw;
            for (into, from) in churn.iter_mut().zip(s.churn.iter()) {
                *into += from * cw;
            }
            // A leaf contributes all of its lines or none of them; a parent contributes
            // whatever share its own subtree worked out. Either way this is a weighted
            // mean of a 0..1 share, so it composes to any depth.
            // Hot share is computed over ANALYZED lines only — "of what we have actually
            // looked at here, how much is hot". Including unanalyzed lines in the
            // denominator would make every directory look cold early in a scan and then
            // heat up as work arrived, which reads as the code changing rather than our
            // knowledge of it changing.
            if c.kind == NodeKind::Func {
                // Anything that is not the PROXY is a real measurement. Named as an
                // exclusion rather than as `== Model`, which is what it was: nothing in Rust
                // sets `Source::Agent` today — readings are folded in the browser — so the
                // omission was latent rather than live, but `reaggregate` in `api.ts` is the
                // hand-maintained twin of this function and it already counts both. Two
                // implementations of one answer, disagreeing, with only the unwatched one
                // wrong. A reader found it from the far end.
                if s.source != Source::Proxy {
                    analyzed += cw;
                    if s.temperature() > HOT {
                        hot += cw;
                    }
                }
            } else {
                let ca = s.analyzed_share * cw;
                analyzed += ca;
                hot += s.hot_share * ca;
            }
            if let Some(t) = s.tangle {
                tw += cw;
                for (into, from) in tangle.iter_mut().zip(t.iter()) {
                    *into += from * cw;
                }
            }
            // Summed, not averaged: a container's cognitive score is how many decisions are
            // inside it, and a mean would report a directory of two hundred simple functions
            // as simple in a way that hides how much there is to read.
            if let Some(c) = s.cognitive {
                cognitive = Some(cognitive.unwrap_or(0) + c);
            }
            // A directory is as old as its oldest surviving code — the age of the
            // decision, not of the last file someone added next to it.
            if let Some(d) = s.age_days {
                age = Some(age.map_or(d, |a: f32| a.max(d)));
            }
            // ...and was last touched when the most recent thing in it was. This used to
            // be hardcoded `None`, which made every directory read as having no history
            // at all — "untouched in 90d" over a subtree that was visibly churning.
            if let Some(d) = s.last_touched_days {
                touched = Some(touched.map_or(d, |t: f32| t.min(d)));
            }
        }
        if w > 0.0 {
            self.score = Some(Score {
                surprise: surprise / w,
                documented: documented / w,
                churn: churn.map(|c| c / w),
                age_days: age,
                // Distinct commits touching anything inside — filled in from the git
                // history after the tree is built, because a commit that touches twelve
                // files in one directory is ONE commit for that directory and only the
                // log pass still knows that. Summing the children would report twelve.
                commits: [0; 4],
                // Same story, same filler: `apply_dir_history` sets both from the log pass.
                all_commits: None,
                last_touched_days: touched,
                tangle: (tw > 0.0).then(|| tangle.map(|t| t / tw)),
                cognitive,
                // Provenance doesn't average — a directory containing one
                // human-documented function is not 1/12th documented by a human. The
                // aggregate carries the measurement; provenance stays a leaf property.
                provenance: Provenance::Source,
                hot_share: if analyzed > 0.0 { hot / analyzed } else { 0.0 },
                source: Source::Proxy,
                analyzed_share: analyzed / w,
            });
        }
    }

    /// Too large for a reading to be taken over it at all — see
    /// [`crate::agentapi::READ_CEILING`].
    ///
    /// **One definition, because three places have to agree.** The queue skips these, the
    /// map says so on the wedge, and `reveal` refuses them; if any two of those disagreed
    /// the map would offer work that cannot be done, or state a gap while the queue quietly
    /// kept serving it. It is a method rather than a stored flag on the same rule that keeps
    /// `resolvable` derived — a second field that is always implied by the first is an
    /// invitation for the two to drift.
    ///
    /// An unknown extent is READABLE. A tree cached before `bytes` existed reports `None` on
    /// every node, and defaulting that to "too large" would empty the queue of a whole repo
    /// and call it a finding. [`crate::treecache::VERSION`] moved so it does not arise, and
    /// this is which way to fail if it ever does.
    pub fn unreadable(&self) -> bool {
        self.bytes.is_some_and(|b| b as usize > crate::agentapi::READ_CEILING)
    }

    /// Depth-first walk, parents before children.
    /// The same walk, with the nodes mutable — for the passes that re-derive a field from
    /// evidence that arrived after the scan. See [`crate::links::retest`].
    pub fn visit_mut(&mut self, f: &mut impl FnMut(&mut Node)) {
        f(self);
        for c in &mut self.children {
            c.visit_mut(f);
        }
    }

    pub fn visit<'a>(&'a self, f: &mut impl FnMut(&'a Node)) {
        f(self);
        for c in &self.children {
            c.visit(f);
        }
    }

    /// The tree without its functions: directories and files, and how many functions each
    /// file holds.
    ///
    /// **What a window is handed when a project comes on screen.** Measured on ceph, the
    /// whole tree is 75MB of JSON for 113,322 functions — serialised in Rust, passed as a
    /// string, parsed in the webview, five seconds before anything is drawn. Almost none of
    /// it can be seen: the map is directories and files at that size, and the layout says so
    /// itself, rolling 3,627 files up as too thin to draw before it reaches their insides.
    ///
    /// A file keeps everything it needs to be a wedge — its size, its score, its language —
    /// because those are rolled up from its functions during the scan and do not need them
    /// again. What it loses is the ring inside it, which arrives when somebody asks for it:
    /// see `file_functions`.
    pub fn slim(&self) -> Node {
        // **Every field written out, and `..self.clone()` is why.** The struct-update form
        // reads as "this node, with two fields changed" and means "clone this node ENTIRELY,
        // then change two fields" — and a node owns its children, so cloning one at the root
        // copies all 113,322 of ceph's, at every level of the recursion, to build a tree that
        // holds none of them. It made switching projects cost more than the scan it was
        // avoiding. Verbose beats quadratic.
        Node {
            // Carried, never recomputed: `slim` drops the functions under a file, and the
            // files the walk could not read were never among them. Zeroing here would make a
            // slim tree — which is what a cache hands back — report a repo with no gaps.
            unparsed_here: self.unparsed_here,
            unparsed: self.unparsed,
            id: self.id.clone(),
            name: self.name.clone(),
            kind: self.kind,
            path: self.path.clone(),
            loc: self.loc,
            ncloc: self.ncloc,
            line: self.line,
            end_line: self.end_line,
            // Survives slimming. A FILE carries its own extent and a file task is served
            // whole, so this is exactly the node whose reading the ceiling most often
            // refuses — the largest in the corpus so far is 856KB — and the wedge has to be
            // able to say so before anybody asks for its ring.
            bytes: self.bytes,
            lang: self.lang,
            last_author: self.last_author.clone(),
            main_author: self.main_author.clone(),
            headcount: self.headcount,
            doc: self.doc.clone(),
            signature: self.signature.clone(),
            owner: self.owner.clone(),
            excluded: self.excluded,
            body: self.body.clone(),
            score: self.score,
            hotspots: self.hotspots.clone(),
            // The wiring roll-ups survive slimming, which is the whole point of computing
            // them in `aggregate`: a file keeps its share of unreferenced code and its share
            // of calls that leave home after its functions are gone, exactly as it keeps
            // `hot_share`. `callers` and `calls` do NOT — they are one function's own counts,
            // and a file has neither.
            callers: self.callers,
            dependents: self.dependents,
            under_test: self.under_test,
            tested: self.tested,
            code_kind: self.code_kind,
            calls: self.calls,
            incident: self.incident,
            away: self.away,
            resolvable: self.resolvable,
            orphans: self.orphans,
            sinks: self.sinks,
            // The group id and its size are one function's own, so they go the way `callers`
            // does; the share survives `slim` the way `orphans` does.
            clone_group: self.clone_group,
            clone_size: self.clone_size,
            comparable: self.comparable,
            copied: self.copied,
            funcs: if self.kind == NodeKind::File { self.children.len() as u32 } else { 0 },
            // Built here rather than in `aggregate`, because this is the one place that has
            // the functions in hand and is about to drop them.
            //
            // **Idempotent, because slimming a slim tree is now a thing that happens.** The
            // drawable half is written twice — once by the scan, once again when the trace
            // lands (see `treecache::redraw`) — and a second `slim()` over a tree whose files
            // have already given up their children handed `Cols::of` an empty slice and got
            // back empty columns. Not `-1`s, which the lenses draw as an absence: NOTHING, so
            // a rim would silently omit every line in the file and re-proportion itself around
            // the ones left. Keep what we already hold when there is nothing to rebuild from.
            cols: match self.kind {
                NodeKind::File if self.children.is_empty() => self.cols.clone(),
                NodeKind::File => Some(Cols::of(&self.children)),
                _ => None,
            },
            children: if self.kind == NodeKind::File {
                Vec::new()
            } else {
                self.children.iter().map(|c| c.slim()).collect()
            },
        }
    }

    /// The functions of several files, by path. A path this tree does not hold is absent.
    ///
    /// **One walk for the whole request, and that is the entire point of taking a set.** It
    /// took a single path and walked the tree to find it — the whole tree, with no early
    /// exit, comparing a string at every node. Drilling into a directory asks for every file
    /// wide enough to show an inside, so one click on `drivers/net/ethernet/mellanox/mlx5`
    /// walked all of linux once per file: a fixed two seconds, dominated by the size of the
    /// repo rather than of the directory, which is why it was the same two seconds wherever
    /// you went. Sixty walks became one.
    ///
    /// The lock is held for the duration by the caller, so the cost is not only the caller's
    /// — a walk per file is also a walk per file that nothing else can take the state during.
    pub fn functions_of(&self, paths: &HashSet<String>) -> HashMap<String, Vec<Node>> {
        let mut out = HashMap::new();
        if paths.is_empty() {
            return out;
        }
        self.visit(&mut |n| {
            if n.kind == NodeKind::File && paths.contains(&n.path) {
                out.insert(n.path.clone(), n.children.clone());
            }
        });
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn score(surprise: f32, documented: f32, churn: f32, age: f32) -> Score {
        Score {
            surprise,
            documented,
            churn: [churn; 4],
            age_days: Some(age),
            tangle: None,
            cognitive: None,
            commits: [0; 4],
            all_commits: None,
            last_touched_days: None,
            provenance: Provenance::Source,
            hot_share: 0.0,
            source: Source::Model,
            analyzed_share: 1.0,
        }
    }

    /// Slimming a slim tree keeps its columns instead of emptying them.
    ///
    /// **The drawable half is written twice now** — once by the scan, again when the trace
    /// lands — so a tree that has already given up its function children can be handed back
    /// to `slim`. `Cols::of` over an empty slice returns EMPTY columns, not absent ones, and
    /// a file with empty columns contributes nothing at all to a distribution: the rim would
    /// silently drop every line in it and re-proportion itself around what was left. Nothing
    /// fails, nothing logs, and the picture is wrong.
    #[test]
    fn slimming_twice_keeps_the_columns() {
        let mut func = Node::dir("f.rs#go", "go");
        func.kind = NodeKind::Func;
        func.loc = 10;
        func.score = Some(score(0.0, 0.0, 0.0, 100.0));
        let mut file = Node::dir("f.rs", "f.rs");
        file.kind = NodeKind::File;
        file.children = vec![func];

        let once = file.slim();
        let cols = once.cols.as_ref().expect("a slim file carries columns");
        assert_eq!(cols.loc, vec![10], "one function, one column entry");

        let twice = once.slim();
        assert_eq!(
            twice.cols.as_ref().map(|c| c.loc.clone()),
            Some(vec![10]),
            "and slimming it again is the identity, not an erasure"
        );
    }

    /// The scan and the replay name a language the same way.
    ///
    /// **This is the split brain, pinned.** A frame's language comes from `Lang::label`
    /// (`history.rs`), a scanned node's from serializing `Node::lang`, and every colour the
    /// Language lens gives out is keyed on that string. While the two disagreed — `C++`
    /// against `cpp` — no language in a replay could be matched to the one on the live map,
    /// so all of them took colours from the tail of the palette and the picture recoloured the
    /// moment History opened.
    #[test]
    fn a_language_has_one_name() {
        for lang in Lang::ALL {
            let mut node = Node::dir("f", "f");
            node.kind = NodeKind::File;
            node.lang = Some(*lang);
            let json = serde_json::to_value(&node).expect("a node serializes");
            assert_eq!(
                json["lang"].as_str(),
                Some(lang.label()),
                "the window is told a language by the name the replay uses for it"
            );
            // And back, or a cached tree loses the language it was written with.
            let back: Node = serde_json::from_value(json).expect("and reads back");
            assert_eq!(back.lang, Some(*lang), "round trip");
        }
    }

    /// `from_label` searches `ALL`, so a language missing from it cannot be read back.
    ///
    /// The match is what makes this worth having: it does not compile until every variant is
    /// accounted for, so adding a language and forgetting `ALL` fails here rather than in a
    /// cached tree six months later, silently, as one grey wedge.
    #[test]
    fn every_language_is_in_all() {
        for lang in Lang::ALL {
            #[deny(unreachable_patterns)]
            let known = match lang {
                Lang::Rust | Lang::TypeScript | Lang::Tsx | Lang::JavaScript | Lang::Python => true,
                Lang::Go | Lang::Swift | Lang::C | Lang::Cpp | Lang::Java | Lang::Kotlin => true,
                Lang::CSharp | Lang::Ruby | Lang::Php | Lang::Lua | Lang::Elixir => true,
                Lang::Scala | Lang::Dart | Lang::Zig | Lang::ObjC | Lang::Shell | Lang::Sql => true,
                Lang::GdScript | Lang::GdShader | Lang::Haskell | Lang::Nix => true,
                Lang::PowerShell | Lang::Solidity | Lang::R | Lang::OCaml | Lang::OCamlLex => true,
                Lang::Cmake | Lang::Julia | Lang::Erlang | Lang::Pascal | Lang::Clojure => true,
                Lang::FSharp | Lang::Groovy | Lang::Elm | Lang::Fortran | Lang::Starlark => true,
                Lang::Verilog | Lang::SystemVerilog | Lang::Gleam | Lang::Odin | Lang::Perl => true,
                Lang::VisualBasic | Lang::Elisp | Lang::Qml | Lang::Scheme | Lang::Racket => true,
                Lang::CommonLisp | Lang::Cfml | Lang::Glsl | Lang::Hlsl | Lang::Slang => true,
                Lang::Ada | Lang::D | Lang::Vhdl | Lang::Zsh | Lang::Luau => true,
                Lang::Prolog | Lang::Jq => true,
            };
            assert!(known);
            assert_eq!(Lang::from_label(lang.label()), Some(*lang), "{}", lang.label());
        }
        assert_eq!(Lang::ALL.len(), 63, "every variant, once — see the match above");
    }

    /// A function node with the wiring counts a scan would give it.
    fn wired(name: &str, loc: u32, callers: u32, incident: u32, away: u32) -> Node {
        let mut n = Node::dir(name, name);
        n.kind = NodeKind::Func;
        n.loc = loc;
        n.callers = Some(callers);
        n.calls = Some(0);
        n.incident = Some(incident);
        n.away = Some(away);
        n.resolvable = Some(1);
        n.orphans = Some(u32::from(callers == 0));
        n.sinks = Some(0);
        n
    }

    /// The wiring counts roll up as SUMS, so a container's ratio is over its edges rather
    /// than over its children.
    ///
    /// The distinction is the whole reason `Node` carries four counts instead of two ratios.
    /// Here the hub has nine neighbours and three leave; the helper has one and it stays. A
    /// mean of the two ratios is 17%, which describes a directory holding one small function;
    /// the sum is 3 of 10, which describes the directory.
    #[test]
    fn wiring_rolls_up_by_edges_not_by_children() {
        let mut dir = Node::dir("src", "src");
        dir.children = vec![wired("hub", 100, 4, 9, 3), wired("helper", 4, 1, 1, 0)];
        dir.aggregate();
        assert_eq!((dir.away, dir.incident), (Some(3), Some(10)), "summed, not averaged");
        assert_eq!((dir.orphans, dir.resolvable), (Some(0), Some(2)));
        // A container answers for its subtree, never for itself: it is not called and does
        // not call, so the two per-function counts stay absent all the way up.
        assert_eq!((dir.callers, dir.calls), (None, None));
    }

    /// A subtree in a language whose calls were never parsed stays an absence, and does not
    /// become a confident zero at the first container above it.
    ///
    /// Zero would paint "nothing here is called" over code nobody looked at, which is the one
    /// claim both wiring lenses exist to avoid making.
    #[test]
    fn an_unreadable_subtree_rolls_up_as_absent_rather_than_as_zero() {
        let mut unread = Node::dir("vendor", "vendor");
        let mut f = Node::dir("thing", "thing");
        f.kind = NodeKind::Func;
        f.loc = 10;
        unread.children = vec![f];
        unread.aggregate();
        assert_eq!((unread.resolvable, unread.orphans), (None, None));
        assert_eq!((unread.incident, unread.away), (None, None));

        // And a directory holding both counts only the half it can see, rather than diluting
        // the measured share with functions nobody measured.
        let mut mixed = Node::dir("", "repo");
        let mut read = Node::dir("src", "src");
        read.children = vec![wired("orphan", 5, 0, 0, 0), wired("used", 5, 2, 2, 1)];
        mixed.children = vec![read, unread];
        mixed.aggregate();
        assert_eq!(mixed.resolvable, Some(2), "the unreadable half is not in the denominator");
        assert_eq!(mixed.orphans, Some(1));
    }

    #[test]
    fn temperature_is_surprise_and_documentation_does_not_discount_it() {
        // Documentation reaches the instrument now, not the arithmetic. A well-documented
        // function is cold because the reader with the docs in hand was not surprised —
        // not because a multiplier discounted a surprise it still reported.
        assert_eq!(score(1.0, 0.0, 0.0, 0.0).temperature(), 1.0);
        assert_eq!(score(1.0, 1.0, 0.0, 0.0).temperature(), 1.0);
        assert!((score(0.8, 0.5, 0.0, 0.0).temperature() - 0.8).abs() < 1e-6);
    }


    #[test]
    fn a_directory_reports_the_share_of_it_that_is_hot_not_the_mean() {
        // The failure this exists to prevent: a directory that is a quarter on fire and
        // three quarters cold renders identically to one that is uniformly tepid, and
        // the biggest wedges on screen — the ones read first — stop meaning anything.
        let mut d = Node::dir("src", "src");
        let mut hot = Node::dir("src/a.rs", "a.rs");
        hot.kind = NodeKind::Func;
        hot.loc = 100;
        hot.score = Some(score(1.0, 0.0, 0.0, 10.0));
        let mut cold = Node::dir("src/b.rs", "b.rs");
        cold.kind = NodeKind::Func;
        cold.loc = 300;
        cold.score = Some(score(0.0, 0.0, 0.0, 10.0));
        d.children = vec![hot, cold];
        d.aggregate();

        let s = d.score.unwrap();
        assert!((s.hot_share - 0.25).abs() < 1e-6, "hot_share was {}", s.hot_share);
        // The mean is still available and still says "lukewarm" — which is exactly why
        // it is not what the wedge is colored by.
        assert!(s.surprise < 0.3);
    }

    #[test]
    fn unanalyzed_lines_are_left_out_of_hot_share_entirely() {
        // Hot share answers "of what we have LOOKED AT here, how much is hot". Counting
        // unanalyzed lines in the denominator would make every directory read cold early
        // in a scan and warm up as results arrived, which looks like the code changing
        // rather than our knowledge of it changing.
        let mut d = Node::dir("src", "src");
        let mut looked = Node::dir("src/a.rs", "a.rs");
        looked.kind = NodeKind::Func;
        looked.loc = 100;
        looked.score = Some(score(1.0, 0.0, 0.0, 10.0)); // Source::Model
        let mut unlooked = Node::dir("src/b.rs", "b.rs");
        unlooked.kind = NodeKind::Func;
        unlooked.loc = 300;
        let mut s2 = score(0.0, 0.0, 0.0, 10.0);
        s2.source = Source::Proxy;
        s2.analyzed_share = 0.0;
        unlooked.score = Some(s2);
        d.children = vec![looked, unlooked];
        d.aggregate();

        let s = d.score.unwrap();
        assert_eq!(s.hot_share, 1.0, "all analyzed lines here are hot");
        assert!((s.analyzed_share - 0.25).abs() < 1e-6, "got {}", s.analyzed_share);
    }

    #[test]
    fn a_wedge_nothing_has_analyzed_reports_no_heat_at_all() {
        // The frontend keys "render this gray" off analyzed_share, so a fully unanalyzed
        // directory must not emit a hot_share the map could paint with.
        let mut d = Node::dir("src", "src");
        let mut f = Node::dir("src/a.rs", "a.rs");
        f.kind = NodeKind::Func;
        f.loc = 50;
        let mut s2 = score(0.9, 0.0, 0.0, 10.0);
        s2.source = Source::Proxy;
        s2.analyzed_share = 0.0;
        f.score = Some(s2);
        d.children = vec![f];
        d.aggregate();

        let s = d.score.unwrap();
        assert_eq!(s.analyzed_share, 0.0);
        assert_eq!(s.hot_share, 0.0);
    }

    #[test]
    fn hot_share_composes_through_nested_directories() {
        let mut root = Node::dir("", "root");
        let mut mid = Node::dir("src", "src");
        let mut hot = Node::dir("src/a.rs", "a.rs");
        hot.kind = NodeKind::Func;
        hot.loc = 50;
        hot.score = Some(score(1.0, 0.0, 0.0, 10.0));
        let mut cold = Node::dir("src/b.rs", "b.rs");
        cold.kind = NodeKind::Func;
        cold.loc = 50;
        cold.score = Some(score(0.0, 0.0, 0.0, 10.0));
        mid.children = vec![hot, cold];
        root.children = vec![mid];
        root.aggregate();
        assert!((root.score.unwrap().hot_share - 0.5).abs() < 1e-6);
    }

    #[test]
    fn aggregation_is_loc_weighted_not_per_function() {
        // One tiny scorching helper next to a large cold file must not set the
        // directory alight. Averaging per-function would give 0.5; weighting by lines
        // gives ~0.02, which is the truth about where the repo's attention is owed.
        let mut d = Node::dir("src", "src");
        let mut hot = Node::dir("src/a.rs", "a.rs");
        hot.kind = NodeKind::Func;
        hot.loc = 3;
        hot.score = Some(score(1.0, 0.0, 0.0, 10.0));
        let mut cold = Node::dir("src/b.rs", "b.rs");
        cold.kind = NodeKind::Func;
        cold.loc = 300;
        cold.score = Some(score(0.0, 0.0, 0.0, 10.0));
        d.children = vec![hot, cold];
        d.aggregate();

        assert_eq!(d.loc, 303);
        let s = d.score.unwrap();
        assert!(s.surprise < 0.05, "expected ~0.01, got {}", s.surprise);
    }

    #[test]
    fn model_authored_text_cannot_cool_a_wedge() {
        // The degenerate failure this guards: run an LLM over the repo, everything
        // turns green, the map lies. There is deliberately no Provenance variant with
        // weight for model-authored text.
        assert_eq!(Provenance::None.weight(), 0.0);
        assert!(Provenance::Source.weight() < Provenance::Human.weight());
    }
}
