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

impl Lang {
    /// Extension → language. Deliberately conservative: an unrecognized extension is
    /// `None`, never a guess, because mis-parsing a file invents functions that aren't
    /// there and those go straight into the score.
    pub fn from_extension(ext: &str) -> Option<Lang> {
        Some(match ext {
            "rs" => Lang::Rust,
            "ts" | "mts" | "cts" => Lang::TypeScript,
            "tsx" => Lang::Tsx,
            "js" | "mjs" | "cjs" | "jsx" => Lang::JavaScript,
            "py" | "pyi" => Lang::Python,
            "go" => Lang::Go,
            "swift" => Lang::Swift,
            // `.h` is C++, and this is the one shared extension that is not a coin-flip.
            // The two grammars fail asymmetrically: C++ is very nearly a superset, so a C
            // header parses under it and yields the same functions, while the C grammar on
            // a C++ header invents them. Measured on a real repo's headers — `namespace
            // godot { … }` came out as a 131-line function called `godot`, `T v{};` as a
            // function called `v`, a class as a 197-line function whose span ran to the end
            // of four unrelated siblings, and another class truncated to its first inline
            // member so the reader could not see what it was asked to grade. Twelve
            // "functions" from 583 lines, none of them real. The reverse direction cost
            // nothing: htop, 151 files of C, parses to the same 1,426 functions either way.
            // Same reasoning as `.zsh` taking the zsh grammar over bash.
            //
            // `.m` is Objective-C rather than MATLAB for a different reason — that tie has
            // no superset to break it, so it goes to the language this tool's repos use.
            "c" => Lang::C,
            "h" => Lang::Cpp,
            "cc" | "cpp" | "cxx" | "hpp" | "hh" | "hxx" => Lang::Cpp,
            "java" => Lang::Java,
            "kt" | "kts" => Lang::Kotlin,
            "cs" => Lang::CSharp,
            "rb" => Lang::Ruby,
            "php" => Lang::Php,
            "lua" => Lang::Lua,
            "ex" | "exs" => Lang::Elixir,
            "scala" | "sc" => Lang::Scala,
            "dart" => Lang::Dart,
            "zig" => Lang::Zig,
            "m" | "mm" => Lang::ObjC,
            "sh" | "bash" => Lang::Shell,
            // `.zsh` used to parse as bash. Zsh's own grammar is a superset, so this only
            // ever finds more — but it is a behavior change on repos that already scan.
            "zsh" => Lang::Zsh,
            "sql" => Lang::Sql,
            "gd" => Lang::GdScript,
            "gdshader" => Lang::GdShader,
            "hs" | "lhs" => Lang::Haskell,
            "nix" => Lang::Nix,
            "ps1" | "psm1" | "psd1" => Lang::PowerShell,
            "sol" => Lang::Solidity,
            // Both cases: `from_extension` is handed the extension verbatim, and `.R` is
            // as conventional as `.r` in that community.
            "r" | "R" => Lang::R,
            "ml" | "mli" => Lang::OCaml,
            "mll" => Lang::OCamlLex,
            "cmake" => Lang::Cmake,
            "jl" => Lang::Julia,
            "erl" | "hrl" => Lang::Erlang,
            "pas" | "pp" => Lang::Pascal,
            "clj" | "cljs" | "cljc" => Lang::Clojure,
            "fs" | "fsi" | "fsx" => Lang::FSharp,
            "groovy" | "gradle" => Lang::Groovy,
            "elm" => Lang::Elm,
            "f90" | "f95" | "f03" | "f08" => Lang::Fortran,
            "bzl" | "star" => Lang::Starlark,
            // `.v` is Verilog rather than the V language, and `.sv` is SystemVerilog.
            // Verilog is the overwhelmingly more common owner of the extension, and a
            // guess between them would invent functions in whichever repo lost — so V is
            // deliberately absent rather than fighting over `.v`.
            "v" | "vh" => Lang::Verilog,
            "sv" | "svh" => Lang::SystemVerilog,
            "gleam" => Lang::Gleam,
            "odin" => Lang::Odin,
            // `.pl` is Perl, not Prolog, for the same reason `.v` is Verilog. Prolog keeps
            // its unambiguous spellings.
            "pl" | "pm" => Lang::Perl,
            "pro" | "prolog" => Lang::Prolog,
            "vb" => Lang::VisualBasic,
            "el" => Lang::Elisp,
            "qml" => Lang::Qml,
            "scm" | "ss" => Lang::Scheme,
            "rkt" => Lang::Racket,
            "lisp" | "lsp" => Lang::CommonLisp,
            "cfc" | "cfm" => Lang::Cfml,
            "glsl" | "vert" | "frag" | "geom" | "comp" => Lang::Glsl,
            "hlsl" | "hlsli" => Lang::Hlsl,
            "slang" => Lang::Slang,
            "adb" | "ads" => Lang::Ada,
            "d" => Lang::D,
            "vhd" | "vhdl" => Lang::Vhdl,
            "luau" => Lang::Luau,
            "jq" => Lang::Jq,
            _ => return None,
        })
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

/// The four corners of surprise × stability. Surprise alone can't tell a subtle
/// algorithm from an incomprehensible mess — both are unpredictable. Age and churn
/// separate them, and the pair is what makes the metric actionable instead of merely
/// interesting.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Quadrant {
    /// High surprise, old and stable. Load-bearing decisions. Document, don't touch.
    CrownJewel,
    /// High surprise, churning. The mess.
    Trouble,
    /// Low surprise, lots of it. Scaffolding that could be generated or collapsed.
    Bloat,
    /// Low surprise, small. Fine. Gray it out and never mention it again.
    Quiet,
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
    /// 0..1 — commits touching this code in the churn window, normalized across the repo.
    pub churn: f32,
    /// Days since the code first appeared. `None` when there is no git history.
    pub age_days: Option<f32>,
    /// The raw count behind `churn`. Shown to the user instead of the normalized figure,
    /// because a number of commits is a fact and a percentage of a saturation constant is
    /// not.
    ///
    /// **It counts a different thing on a function than on a file, and every consumer has to
    /// say which.** A file's is commits in the 90-day window; a function's is how many
    /// distinct commits its current lines trace back to, because a window per function needs
    /// `git log -L` — see `blame.rs`, which states the difference and asks the UI not to
    /// present the two as one number. The UI can tell them apart from `kind` and nothing
    /// else, which is why this stayed one field: two fields, one of them always zero, is an
    /// invitation to add them up.
    pub commits: u32,
    /// Every commit that has ever touched this path, or `None` where git has never seen it.
    ///
    /// The figure a header wants: `commits` is a RATE over a window and this is a SIZE. A
    /// function has none — its lifetime count is `git log -L`, a process apiece — and `None`
    /// there means "not this kind of question", the same way it means "no history" on a file.
    /// Both absences print nothing rather than a zero.
    pub all_commits: Option<u32>,
    /// Days since the most recent commit. `None` without history.
    pub last_touched_days: Option<f32>,
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

    /// Old and unchanged reads as settled; young or busy reads as in-flight. The
    /// threshold is deliberately generous — a quarter without a change is a long time
    /// in a repo being actively vibe-coded, which is the audience.
    pub fn is_stable(&self) -> bool {
        self.churn < 0.25 && self.age_days.is_some_and(|d| d > 90.0)
    }

    pub fn quadrant(&self, loc: u32) -> Quadrant {
        // "Bloat" is the only quadrant that consults size, because it is the only claim
        // that is *about* size: predictable code is only a problem when there's a lot.
        const BULKY: u32 = 40;
        match (self.surprise >= HOT, self.is_stable()) {
            (true, true) => Quadrant::CrownJewel,
            (true, false) => Quadrant::Trouble,
            (false, _) if loc >= BULKY => Quadrant::Bloat,
            (false, _) => Quadrant::Quiet,
        }
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
    pub lang: Option<Lang>,
    /// Who last committed to this file.
    ///
    /// On the node rather than in `Score`, because it is metadata about the code like
    /// `path` and `lang` — not a component of the reading. It also keeps `Score` `Copy`,
    /// which the whole aggregation path relies on.
    #[serde(default)]
    pub last_author: Option<String>,
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
}

impl Node {
    pub fn dir(path: &str, name: &str) -> Node {
        Node {
            id: path.to_string(),
            name: name.to_string(),
            kind: NodeKind::Dir,
            excluded: false,
            path: path.to_string(),
            loc: 0,
            line: None,
            lang: None,
            last_author: None,
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
        }
    }

    /// Roll child LOC and scores up the tree. Aggregation is **LOC-weighted**: a
    /// directory's temperature is the temperature of its lines, not the average of its
    /// functions. Otherwise one hot three-line helper makes a 4,000-line directory look
    /// like it's on fire, and the map stops meaning anything at the outer rings.
    pub fn aggregate(&mut self) {
        if self.children.is_empty() {
            return;
        }
        for c in &mut self.children {
            c.aggregate();
        }

        if self.kind != NodeKind::Func {
            self.loc = self.children.iter().map(|c| c.loc).sum();
        }

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
        let (mut surprise, mut documented, mut churn) = (0.0f32, 0.0f32, 0.0f32);
        let mut hot = 0.0f32;
        let mut analyzed = 0.0f32;
        let mut age: Option<f32> = None;
        let mut touched: Option<f32> = None;
        for c in &self.children {
            let Some(s) = c.score else { continue };
            let cw = c.loc.max(1) as f32;
            w += cw;
            surprise += s.surprise * cw;
            documented += s.documented * cw;
            churn += s.churn * cw;
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
                churn: churn / w,
                age_days: age,
                // Distinct commits touching anything inside — filled in from the git
                // history after the tree is built, because a commit that touches twelve
                // files in one directory is ONE commit for that directory and only the
                // log pass still knows that. Summing the children would report twelve.
                commits: 0,
                // Same story, same filler: `apply_dir_history` sets both from the log pass.
                all_commits: None,
                last_touched_days: touched,
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
            id: self.id.clone(),
            name: self.name.clone(),
            kind: self.kind,
            path: self.path.clone(),
            loc: self.loc,
            line: self.line,
            end_line: self.end_line,
            // Survives slimming. A FILE carries its own extent and a file task is served
            // whole, so this is exactly the node whose reading the ceiling most often
            // refuses — the largest in the corpus so far is 856KB — and the wedge has to be
            // able to say so before anybody asks for its ring.
            bytes: self.bytes,
            lang: self.lang,
            last_author: self.last_author.clone(),
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
            churn,
            age_days: Some(age),
            commits: 0,
            all_commits: None,
            last_touched_days: None,
            provenance: Provenance::Source,
            hot_share: 0.0,
            source: Source::Model,
            analyzed_share: 1.0,
        }
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
    fn quadrants_split_on_surprise_and_stability() {
        assert_eq!(score(0.9, 0.0, 0.0, 400.0).quadrant(10), Quadrant::CrownJewel);
        assert_eq!(score(0.9, 0.0, 0.9, 400.0).quadrant(10), Quadrant::Trouble);
        // Young code can't be a crown jewel however surprising — nobody has survived it yet.
        assert_eq!(score(0.9, 0.0, 0.0, 3.0).quadrant(10), Quadrant::Trouble);
        assert_eq!(score(0.1, 0.0, 0.0, 400.0).quadrant(500), Quadrant::Bloat);
        assert_eq!(score(0.1, 0.0, 0.0, 400.0).quadrant(4), Quadrant::Quiet);
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
