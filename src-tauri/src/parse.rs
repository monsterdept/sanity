//! Source → functions, via tree-sitter.
//!
//! We walk the tree with a cursor and match node *kinds* rather than running a
//! tree-sitter query per language. Queries are the idiomatic route, but their syntax
//! and the grammars' capture names drift between grammar releases, and a query that
//! silently matches nothing produces a repo with no inner ring and no error — the worst
//! possible failure for this app, because an empty result looks like a clean codebase.
//! Kind matching fails loudly instead: if a grammar renames a node, its tests go red.

use crate::model::Lang;
use serde::{Deserialize, Serialize};
use tree_sitter::{Node as TsNode, Parser};

/// One function, with everything the scorer needs and nothing it doesn't.
///
/// Serialisable because `scancache` memoises the parse: re-deriving this for a file nobody
/// touched is the same work producing the same answer, and on a large C++ tree it was most
/// of a minute per open.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuncDef {
    pub name: String,
    /// Everything before the body — `fn foo(a: u32) -> bool`. This is the context the
    /// surprise measurement is allowed to condition on: the question is always "given
    /// that this is called `foo` and takes these arguments, how predictable is what's
    /// inside?"
    pub signature: String,
    pub body: String,
    /// The doc comment attached above (or, in Python, the docstring inside). The only
    /// thing that can cool the wedge.
    pub doc: Option<String>,
    /// The type, trait or class this function is defined inside, if any.
    ///
    /// A bare name is not an identity. One file holds a dozen `parse`s — one per
    /// descriptor type — and a reader handed `udf.rs#parse` with `parse` also in its
    /// sibling list cannot tell which one it is being asked to predict. It then grades
    /// its own prediction against a function it may not have been given, and reports the
    /// docs as belonging to something else, which reads as a doc bug in the repo. That is
    /// the instrument manufacturing a finding, the same class of error as inheriting an
    /// enclosing type's docstring.
    ///
    /// Kept beside `name` rather than folded into it: `key_of(path, name, ord)` keys every
    /// committed reading, so changing `name` would expire an entire repo's assessment the
    /// moment this shipped.
    pub owner: Option<String>,
    pub start_line: u32,
    pub end_line: u32,
    /// The names this body calls, deduplicated and in file order of first appearance.
    ///
    /// Names, not targets: resolving one to a definition needs every other file in the
    /// repo, which is [`crate::edges`]'s job. What the parse can honestly say is "this
    /// body contains a call whose callee is spelled `foo`", and the receiver is
    /// deliberately dropped — `a.render()`, `b.render()` and `render()` all arrive as
    /// `render`, because tree-sitter cannot tell which `render` without a type checker
    /// and pretending otherwise would invent edges.
    ///
    /// **Empty when the language is not in [`call_sites`], which is not the same as a
    /// function that calls nothing.** `Lang::resolves_calls` is what tells those apart,
    /// and every consumer has to ask it — a zero standing in for "we did not look" is
    /// how a map reports dead code in a language it never read.
    ///
    /// Collected over the whole function node, closures included, which is the same
    /// extent `body` covers. A nested named function is its own `FuncDef` AND its calls
    /// are counted against the enclosing one; that is the price of keeping this
    /// consistent with the body text a reader is handed, and it is confined to the
    /// languages where a named definition can nest inside another.
    #[serde(default)]
    pub calls: Vec<String>,
    /// A structural fingerprint of the body, for finding copies of it — see [`shape_of`].
    ///
    /// `None` means "too small to say anything", never "unique": below the token floor
    /// almost every function in a codebase collides with almost every other, and a lens
    /// that reported four thousand three-line accessors as clones of one another would be
    /// measuring the language's grammar rather than the repo.
    #[serde(default)]
    pub shape: Option<u64>,
    /// Cognitive complexity — every fork costs one, plus one for each fork it nests inside.
    ///
    /// **`None` means this grammar has no branch table, never "no branches".** See
    /// `branch_kinds`: a zero here would report a language nobody taught as a language whose
    /// code never forks, which is the shape of every bug the literal kind matching exists to
    /// make loud. The lens paints grey on `None`, as Callers does on an unresolved language.
    #[serde(default)]
    pub cognitive: Option<u32>,
}

impl FuncDef {
    pub fn loc(&self) -> u32 {
        self.end_line.saturating_sub(self.start_line) + 1
    }
}

fn language(lang: Lang) -> tree_sitter::Language {
    match lang {
        Lang::Rust => tree_sitter_rust::LANGUAGE.into(),
        Lang::TypeScript => tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into(),
        Lang::Tsx => tree_sitter_typescript::LANGUAGE_TSX.into(),
        Lang::JavaScript => tree_sitter_javascript::LANGUAGE.into(),
        Lang::Python => tree_sitter_python::LANGUAGE.into(),
        Lang::Go => tree_sitter_go::LANGUAGE.into(),
        Lang::Swift => tree_sitter_swift::LANGUAGE.into(),
        Lang::C => tree_sitter_c::LANGUAGE.into(),
        Lang::Cpp => tree_sitter_cpp::LANGUAGE.into(),
        Lang::Java => tree_sitter_java::LANGUAGE.into(),
        Lang::Kotlin => tree_sitter_kotlin_ng::LANGUAGE.into(),
        Lang::CSharp => tree_sitter_c_sharp::LANGUAGE.into(),
        Lang::Ruby => tree_sitter_ruby::LANGUAGE.into(),
        Lang::Php => tree_sitter_php::LANGUAGE_PHP.into(),
        Lang::Lua => tree_sitter_lua::LANGUAGE.into(),
        Lang::Elixir => tree_sitter_elixir::LANGUAGE.into(),
        Lang::Scala => tree_sitter_scala::LANGUAGE.into(),
        Lang::Dart => tree_sitter_dart::LANGUAGE.into(),
        Lang::Zig => tree_sitter_zig::LANGUAGE.into(),
        Lang::ObjC => tree_sitter_objc::LANGUAGE.into(),
        Lang::Shell => tree_sitter_bash::LANGUAGE.into(),
        Lang::Sql => tree_sitter_sequel::LANGUAGE.into(),
        Lang::GdScript => tree_sitter_gdscript::LANGUAGE.into(),
        Lang::GdShader => tree_sitter_gdshader::LANGUAGE.into(),
        Lang::Haskell => tree_sitter_haskell::LANGUAGE.into(),
        Lang::Nix => tree_sitter_nix::LANGUAGE.into(),
        Lang::PowerShell => tree_sitter_powershell::LANGUAGE.into(),
        Lang::Solidity => tree_sitter_solidity::LANGUAGE.into(),
        Lang::R => tree_sitter_r::LANGUAGE.into(),
        Lang::OCaml => tree_sitter_ocaml::LANGUAGE_OCAML.into(),
        Lang::OCamlLex => tree_sitter_ocamllex::LANGUAGE.into(),
        Lang::Cmake => tree_sitter_cmake::LANGUAGE.into(),
        Lang::Julia => tree_sitter_julia::LANGUAGE.into(),
        Lang::Erlang => tree_sitter_erlang::LANGUAGE.into(),
        Lang::Pascal => tree_sitter_pascal::LANGUAGE.into(),
        Lang::Clojure => tree_sitter_clojure_orchard::LANGUAGE.into(),
        Lang::FSharp => tree_sitter_fsharp::LANGUAGE_FSHARP.into(),
        Lang::Groovy => tree_sitter_groovy::LANGUAGE.into(),
        Lang::Elm => tree_sitter_elm::LANGUAGE.into(),
        Lang::Fortran => tree_sitter_fortran::LANGUAGE.into(),
        Lang::Starlark => tree_sitter_starlark::LANGUAGE.into(),
        Lang::Verilog => tree_sitter_verilog::LANGUAGE.into(),
        Lang::SystemVerilog => tree_sitter_systemverilog::LANGUAGE.into(),
        Lang::Gleam => tree_sitter_gleam::LANGUAGE.into(),
        Lang::Odin => tree_sitter_odin::LANGUAGE.into(),
        Lang::Perl => tree_sitter_perl::LANGUAGE.into(),
        Lang::VisualBasic => tree_sitter_vb_dotnet::LANGUAGE.into(),
        Lang::Elisp => tree_sitter_elisp::LANGUAGE.into(),
        Lang::Qml => tree_sitter_qmljs::LANGUAGE.into(),
        Lang::Scheme => tree_sitter_scheme::LANGUAGE.into(),
        Lang::Racket => tree_sitter_racket::LANGUAGE.into(),
        Lang::CommonLisp => tree_sitter_commonlisp::LANGUAGE_COMMONLISP.into(),
        Lang::Cfml => tree_sitter_cfml::LANGUAGE_CFSCRIPT.into(),
        Lang::Glsl => tree_sitter_glsl::LANGUAGE_GLSL.into(),
        Lang::Hlsl => tree_sitter_hlsl::LANGUAGE_HLSL.into(),
        Lang::Slang => tree_sitter_slang::LANGUAGE_SLANG.into(),
        Lang::Ada => tree_sitter_ada::LANGUAGE.into(),
        Lang::D => tree_sitter_d::LANGUAGE.into(),
        Lang::Vhdl => tree_sitter_vhdl::LANGUAGE.into(),
        Lang::Zsh => tree_sitter_zsh::LANGUAGE.into(),
        Lang::Luau => tree_sitter_luau::LANGUAGE.into(),
        Lang::Prolog => tree_sitter_prolog::LANGUAGE.into(),
        Lang::Jq => tree_sitter_jq::LANGUAGE.into(),
    }
}

/// What a parse MEANS, versioned — bump this when the same bytes would come out different.
///
/// **The caches gate on shape, and a parser change is not a shape change.** `scancache`
/// stores a `Vec<FuncDef>` per file behind a `(mtime, len)` gate and a content hash, all of
/// which say "these bytes are unchanged" — true, and beside the point when it is the parser
/// that moved. `history` caches whole timelines built from the same pass. So a repo scanned
/// before a grammar or mapping change keeps serving the old answer until somebody edits the
/// file, and nothing anywhere says so.
///
/// It is not hypothetical and it is not cosmetic. Mapping `.h` to C++ moved one real repo
/// from 1,682 functions to 1,724 — twelve fabricated entries out, fifty-four real ones in —
/// and the app went on reporting 1,682 from a cache written an hour earlier, while `just
/// scan`, which runs uncached by design, reported the truth. Two numbers for one repo, and
/// the wrong one was the one an orchestrator was sizing a 176-subagent run from.
/// `scancache`'s own doc comment already names the consequence exactly — "a half-understood
/// parse entry would put functions at lines they are not at, and every reading taken against
/// those lines would be a reading about nothing" — it simply had no way to detect this
/// cause of it.
///
/// **Bump it for anything that changes what comes out of this module**: a new `Lang` or
/// extension mapping, an edit to `func_kinds`, `name_node`, `body_span`, `header_end` or
/// `leading_doc`, and a grammar dependency bump — a grammar that renames a node changes
/// every parse that used it. It lives here, next to those, rather than beside the cache
/// format it protects: the person who breaks this is editing this file, and a reminder in
/// the file you are not looking at is not a reminder.
///
/// Cheap to be wrong in the safe direction. A needless bump costs one re-parse per repo —
/// seconds — while a missed one is silently wrong for as long as the files sit still.
/// 4 because a formatter ran over this file. `header_end` came out with a match arm wrapped in
/// braces — `=> end_of(x)` became `=> { end_of(x) }`, which is inert — and the point of this
/// number is that nobody has to take that on faith: the parse is declared to have moved, every
/// cache re-reads, and the answer either matches or the gate was right to insist. Re-parsing is
/// seconds; being asked to trust a diff is forever. **No reading expires** — the bodies are
/// untouched and `reading_hash` collapses whitespace, so identical bytes hash identically.
/// 3 because thirty-nine more languages had their call shape read off their grammars,
/// and a cached `FuncDef` from before it holds the empty list they used to yield. Same reasoning
/// as the bump to 2, which introduced [`FuncDef::calls`] in the first place: the stale
/// answer is not wrong-looking, it is a confident zero under the Reach lens, and the only
/// thing that can tell the caches it moved is this number. No reading expires — a body's
/// text is untouched, so `reading_hash` does not move.
pub const PARSE_VERSION: u32 = 5;

/// The oldest [`PARSE_VERSION`] whose parse OUTPUT is identical to this one's.
///
/// **A bump means "drop the caches", which is not the same as "re-read the repo", and only a
/// person can tell the two apart.** Dropping a cache costs a re-parse — seconds. Expiring a
/// reading costs somebody an afternoon of readers, and it happens only when the TEXT handed to
/// a reader moves: `reading_hash` collapses whitespace, so identical bytes through an identical
/// parser hash identically no matter what this number says. `just expiry` cannot decide it,
/// deliberately — a gate that could reason its way to "inert" would be a compiler — so the
/// claim is made here, in the diff, by whoever made the change, and the release note is worded
/// from it.
///
/// Read as: parse output has not changed since version N. The release compares it against the
/// version at the PREVIOUS TAG, so a run of output-neutral bumps composes without anyone having
/// to restate it, and a real parse change is declared by leaving this where it is.
///
/// **Silence is the pessimistic answer.** Absent or newer than the released-from version, the
/// note says readings may be stale — the wrong direction to be wrong in is telling somebody
/// their corpus is fine when it is not.
///
/// 3 because 3 → 4 was `cargo fmt` wrapping one match arm of `header_end` in braces.
pub const PARSE_OUTPUT_STABLE_SINCE: u32 = 3;

/// Node kinds that count as "a function with a body someone wrote".
///
/// Bare `arrow_function` / `function_expression` are deliberately absent for the JS
/// family: they'd match every inline callback, and a two-line `.map()` lambda is not a
/// unit anyone reasons about. They still contribute to their enclosing function's body
/// text, which is where they belong. `variable_declarator` picks up the one case that
/// does matter — `const Foo = () => {...}`, which is how most React components and half
/// of modern TS is written, and skipping it would blank out entire frontends.
fn func_kinds(lang: Lang) -> &'static [&'static str] {
    match lang {
        Lang::Rust => &["function_item"],
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => &[
            "function_declaration",
            "generator_function_declaration",
            "method_definition",
            "variable_declarator",
        ],
        Lang::Python => &["function_definition"],
        Lang::Go => &["function_declaration", "method_declaration"],
        // `function_declaration` covers free functions, methods and statics alike;
        // `init_declaration` exposes `init` as its own name.
        //
        // Subscripts and deinits are deliberately absent, and not by oversight. On
        // `subscript_declaration` the `name` field is the RETURN TYPE — a subscript
        // returning Int would be recorded as a function called "Int" — and it has no
        // `body` field at all, so `extract` drops it either way. `deinit_declaration`
        // has no name. Listing them would add kinds that silently yield nothing while
        // reading as though they were covered.
        Lang::Swift => &["function_declaration", "init_declaration"],
        // The C family names its function through a `declarator` chain, not a `name`
        // field — see `name_node`. Class and struct bodies are NOT listed: they would
        // swallow every method inside them into a single wedge.
        Lang::C | Lang::Cpp => &["function_definition"],
        Lang::Java | Lang::CSharp => &["method_declaration", "constructor_declaration"],
        Lang::Kotlin => &["function_declaration"],
        Lang::Ruby => &["method", "singleton_method"],
        Lang::Php => &["function_definition", "method_declaration"],
        Lang::Lua => &["function_declaration"],
        // Elixir has no function node: `def` is a macro call like any other, so the kind
        // alone cannot identify one — `accepts` carries the extra test.
        Lang::Elixir => &["call"],
        Lang::Scala => &["function_definition"],
        Lang::Dart => &["function_declaration", "method_signature"],
        Lang::Zig => &["function_declaration"],
        Lang::ObjC => &["method_definition"],
        Lang::Shell => &["function_definition"],
        Lang::Sql => &["create_function"],
        // Godot has no separate constructor node — `_init` is an ordinary
        // `function_definition`, and so are the `_ready`/`_process` engine callbacks that
        // make up most of a game's code. One kind covers the language.
        Lang::GdScript => &["function_definition"],
        // The C-family shader languages parse exactly like C, declarator chain and all.
        Lang::Glsl | Lang::Hlsl | Lang::Slang | Lang::GdShader => &["function_definition"],
        Lang::Solidity => &["function_definition", "constructor_definition", "modifier_definition"],
        Lang::Starlark | Lang::Julia | Lang::Perl | Lang::Zsh | Lang::Jq | Lang::Groovy => {
            &["function_definition"]
        }
        Lang::PowerShell => &["function_statement"],
        Lang::Cfml | Lang::Qml | Lang::Luau => &["function_declaration"],
        Lang::Gleam => &["function"],
        Lang::Haskell => &["function"],
        Lang::D => &["function_declaration"],
        Lang::Odin => &["procedure_declaration"],
        Lang::VisualBasic => &["method_declaration"],
        Lang::Elisp => &["function_definition"],
        Lang::CommonLisp => &["defun"],
        // Erlang's unit is the CLAUSE, not the declaration: `fun_decl` holds one
        // `function_clause` per head, and only the clause carries a name and a body.
        // A multi-clause function therefore yields one wedge per clause — which is
        // right, since each clause is separately readable, and `key_of`'s `#2`/`#3`
        // ordinals already keep same-named twins apart.
        Lang::Erlang => &["function_clause"],
        Lang::Pascal => &["defProc"],
        Lang::Elm => &["value_declaration"],
        Lang::Fortran => &["function", "subroutine"],
        Lang::Cmake => &["function_def", "macro_def"],
        Lang::Ada => &["subprogram_body"],
        Lang::Vhdl => &["subprogram_definition"],
        Lang::OCamlLex => &["lexer_entry"],
        Lang::Verilog | Lang::SystemVerilog => {
            &["function_body_declaration", "task_body_declaration"]
        }
        // `let` binds values and functions with one node in both languages, so the kind
        // cannot decide it — `accepts` looks for a parameter.
        Lang::OCaml => &["let_binding"],
        Lang::FSharp => &["function_or_value_defn"],
        // Assignment-shaped, like JS's `const f = () => {}`: the name is on the left and
        // the function on the right, so `accepts` has to look at what is being bound.
        Lang::R => &["binary_operator"],
        Lang::Nix => &["binding"],
        // The lisps have no function node at all — `defun` is a list whose first element
        // happens to be a symbol. Same shape as Elixir, and `accepts` carries the test.
        Lang::Clojure => &["list_lit"],
        Lang::Scheme | Lang::Racket => &["list"],
        Lang::Prolog => &["clause"],
    }
}

/// `const Foo = () => {…}` is a function; `const n = 4` is not. Only accept a
/// declarator whose initializer is itself a function.
fn declarator_is_function(node: TsNode) -> bool {
    node.child_by_field_name("value").is_some_and(|v| {
        matches!(
            v.kind(),
            "arrow_function" | "function_expression" | "function" | "generator_function"
        )
    })
}

fn text<'a>(node: TsNode, src: &'a str) -> &'a str {
    node.utf8_text(src.as_bytes()).unwrap_or("")
}

/// Comment lines sitting directly above the definition, with no blank line between.
///
/// The adjacency check is most of the trick: a license header at the top of the file is a
/// comment immediately preceding the first function in token order, and counting it as
/// that function's documentation would cool the file's first wedge on every scan.
///
/// The rest of it is stepping over attributes and decorators, which sit *between* the
/// comment and the definition — a strict adjacency rule would sever every doc comment
/// above a `#[derive(...)]` or an `@override` and report those functions undocumented.
/// This paragraph exists because a cold reader predicted the blank-line rule from the
/// sentence above, read the body, and found a second rule it had not been told about.
fn leading_doc(node: TsNode, src: &str) -> Option<String> {
    let mut lines: Vec<String> = Vec::new();
    let mut cur = node;
    // Attributes and decorators sit between the doc and the definition; step over them
    // so `#[derive(...)]` or `@override` doesn't sever the comment from its function.
    while let Some(prev) = cur.prev_sibling() {
        let k = prev.kind();
        if k == "attribute_item" || k == "decorator" {
            cur = prev;
            continue;
        }
        if !k.contains("comment") {
            break;
        }
        // An INNER doc comment is the module talking about itself, never about whatever
        // happens to follow it. Rust's `//!` is the only form of this, and without the rule
        // a file that opens with module docs and then declares a function hands those docs
        // to that one function — arbitrarily, since a `use` line above it would have severed
        // them. Worse now that `file_doc` also collects them: the same paragraph would reach
        // a reader twice in one payload, which reads as emphasis rather than as duplication.
        //
        // The blank-line rule below does not catch it, and cannot: tree-sitter-rust gives an
        // inner doc comment a trailing newline that a `//` comment does not have, so its end
        // row is already one past its text and the gap looks closed.
        let raw = text(prev, src);
        if raw.starts_with("//!") || raw.starts_with("/*!") {
            break;
        }
        if prev.end_position().row + 1 < cur.start_position().row {
            break; // blank line — not attached to this definition
        }
        lines.push(strip_comment_markers(text(prev, src)));
        cur = prev;
    }
    if lines.is_empty() {
        return None;
    }
    lines.reverse();
    let joined = lines.join("\n").trim().to_string();
    (!joined.is_empty()).then_some(joined)
}

/// Nodes a function can be wrapped in without the wrapper being a different thing.
///
/// `const Foo = () => {}` carries no comment on the arrow function itself — the doc sits
/// above the declaration, and above the `export` again when it is exported. Those are all
/// the same declaration of the same function, so a comment above any of them documents it.
///
/// Matched literally, like `func_kinds`: a grammar bump that renames one of these goes
/// red in the tests rather than silently returning nothing.
const DOC_WRAPPERS: &[&str] = &[
    "variable_declarator",
    "lexical_declaration",
    "variable_declaration",
    "export_statement",
    "expression_statement",
    "assignment",
    "public_field_definition",
];

/// A doc comment on the declaration a function is wrapped in — and *only* that.
///
/// This used to be a blind three-step walk up the parents, taking the first comment it
/// found. That is right for a wrapped arrow function and badly wrong everywhere else: a
/// nested type's `init` has no doc of its own, so the walk climbed out of the struct and
/// into the enclosing class and handed back the **class's** docstring. The reader was then
/// asked to predict `SentenceSuggester.Context.init` from a paragraph about how
/// `SentenceSuggester` enforces filtering, guessed wrong, and the wedge went hot.
///
/// Those manufactured surprises are indistinguishable from real ones in the output, which
/// makes this worse than a missing feature — the instrument was inventing findings. So the
/// walk now stops at the first parent that is not a wrapper: an enclosing type or function
/// is a different thing, and its documentation is not this function's.
fn wrapper_doc(node: TsNode, src: &str) -> Option<String> {
    let mut cur = node;
    for _ in 0..3 {
        let parent = cur.parent()?;
        if !DOC_WRAPPERS.contains(&parent.kind()) {
            return None;
        }
        if let Some(doc) = leading_doc(parent, src) {
            return Some(doc);
        }
        cur = parent;
    }
    None
}

/// Nodes that own the functions inside them — a type, a class, a trait, a protocol.
///
/// Matched literally like [`func_kinds`], but with a softer failure: a grammar that
/// renames one of these yields an unqualified name rather than nothing, so the tests below
/// carry the languages this actually claims to handle. A kind absent from this list is not
/// an owner, which is the right default — a Rust `mod` or a JS block encloses a function
/// without the function belonging to it.
const OWNER_KINDS: &[&str] = &[
    // Rust. `impl_item` names itself through `type`, not `name` — see below.
    "impl_item",
    "trait_item",
    // Swift (class, struct, enum and extension all parse to `class_declaration`), and the
    // JS/TS, Java, C#, Kotlin and PHP families.
    "class_declaration",
    "abstract_class_declaration",
    "protocol_declaration",
    "interface_declaration",
    "enum_declaration",
    "record_declaration",
    "struct_declaration",
    "class",
    "module",
    // Python, Dart, Scala.
    "class_definition",
    "object_definition",
    "trait_definition",
    // C++.
    "class_specifier",
    "struct_specifier",
];

/// The type a function hangs off, if it hangs off one.
///
/// Go is the exception and not a small one: its receiver sits on the function itself
/// (`func (p *Parser) parse()`), so there is no ancestor to find and the ancestor walk
/// would return the enclosing file. The receiver's text is reduced to an identifier rather
/// than matched structurally, because `*Parser` and `Parser` are two spellings of one
/// answer.
///
/// Generic parameters are cut off first, and that is not tidiness. The comment here used
/// to claim `Parser[T]` reduced to `Parser` too; it did not — taking the LAST identifier
/// run returned `T`, so every method on a generic type was attributed to its type
/// parameter. A cold reader caught it by predicting the doc and then reading the body,
/// which is the entire point of the instrument, so it would be a poor joke to leave it.
fn owner_of(node: TsNode, lang: Lang, src: &str) -> Option<String> {
    if lang == Lang::Go {
        let raw = text(node.child_by_field_name("receiver")?, src);
        return raw
            .split_once('[')
            .map_or(raw, |(before, _)| before)
            .rsplit(|c: char| !(c.is_alphanumeric() || c == '_'))
            .find(|s| !s.is_empty())
            .map(str::to_string);
    }
    // The WHOLE chain, not the nearest one. Stopping at the first enclosing type is right
    // until the innermost type is a generic wrapper, and then it is useless: ComfyUI's API
    // is built as `class Boolean: class Input: def as_dict`, repeated per data type, so
    // thirty `as_dict` methods all reported `owner: Input` and a reader could not tell
    // which of them it had been handed. That is the exact failure `owner` was added to fix,
    // reappearing one level up. `Boolean.Input` is the answer; `Input` is a shrug.
    //
    // A reader found this by being handed one of the thirty and saying so.
    let mut chain: Vec<String> = Vec::new();
    let mut cur = node;
    while let Some(parent) = cur.parent() {
        if OWNER_KINDS.contains(&parent.kind()) {
            // `impl Foo` and `impl Trait for Foo` both name the owner through `type`; a
            // class or trait names it through `name`. Asking for the wrong one first
            // costs nothing and means neither language needs a branch here.
            if let Some(named) =
                parent.child_by_field_name("name").or_else(|| parent.child_by_field_name("type"))
            {
                chain.push(text(named, src).trim().to_string());
            }
        }
        cur = parent;
    }
    // Innermost last, and capped: three levels name a thing, and a fourth is a path nobody
    // reads. Dotted regardless of language — this is a chain of type names, and the
    // language's own separator between the owner and the FUNCTION is `qualify`'s job.
    chain.truncate(3);
    chain.reverse();
    (!chain.is_empty()).then(|| chain.join("."))
}

/// Python attaches its documentation *inside* the body, as the first statement.
fn python_docstring(body: TsNode, src: &str) -> Option<String> {
    // The first named child that is not a COMMENT. Comments are named nodes in this
    // grammar, so a module opening `#!/usr/bin/env python3` put a comment in slot zero and
    // the docstring under it went unseen — every Python file with a shebang read as
    // undocumented at file level, which is most scripts. Harmless for a function body,
    // where a comment before the docstring is rare and skipping it is still right.
    let mut i = 0;
    let first = loop {
        let n = body.named_child(i)?;
        if !n.kind().contains("comment") {
            break n;
        }
        i += 1;
    };
    let expr = if first.kind() == "expression_statement" { first.named_child(0)? } else { first };
    (expr.kind() == "string")
        .then(|| text(expr, src).trim_matches(|c| c == '"' || c == '\'').trim().to_string())
}

fn strip_comment_markers(raw: &str) -> String {
    raw.lines()
        .map(|l| {
            l.trim()
                .trim_start_matches("///")
                .trim_start_matches("//!")
                .trim_start_matches("/**")
                .trim_start_matches("//")
                .trim_start_matches("/*")
                .trim_start_matches('#')
                .trim_end_matches("*/")
                .trim_start_matches('*')
                .trim()
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

/// How much of a module header a reader is handed, in characters.
///
/// Headers are unbounded — this repo's own run to several thousand characters — and the
/// text is priced per READING: it reaches every function in the file, on every turn of
/// every reader. So the cap is not a tidiness rule, it is the whole cost of the feature,
/// and it was measured with `just tokens` rather than picked:
///
/// | cap  | median payload | median docs | repo payloads |
/// |------|----------------|-------------|---------------|
/// | none | 873 ch         | 158 ch      | 144.5k tok    |
/// | 450  | 1251 ch        | 477 ch      | 195.7k tok    |
/// | 600  | 1354 ch        | 606 ch      | 210.1k tok    |
/// | 900  | 1551 ch        | 907 ch      | 235.2k tok    |
///
/// 600 buys the opening paragraph — which is where a module header states what it is, every
/// time — for 45% of what the payload cost before, against 63% for 900. Past the first
/// paragraph a header is arguing with itself about design decisions, which is worth reading
/// and is not what a reader needs in order to predict one function. The cap is binding on
/// nearly every file in THIS repo and on almost none in a normal one; re-run `just tokens`
/// against both kinds before moving it.
///
/// Truncation is marked, because a header cut off mid-sentence that looks complete is a
/// reader predicting confidently from half a description.
const FILE_DOC_MAX: usize = 600;

/// Markers that say a header is a license rather than an explanation.
///
/// A license block is the single most common thing at the top of a file and it explains
/// nothing about the code — feeding it to a reader would spend the payload on boilerplate
/// and, worse, dress every file in the repo in identical prose, which is exactly the kind
/// of text that makes unrelated functions look like they share context.
const LICENSE_MARKERS: &[&str] = &[
    "copyright",
    "spdx-license-identifier",
    "licensed under",
    "all rights reserved",
    "permission is hereby granted",
    "without warranties",
    "gnu general public",
    "apache license",
];

/// The banner at the top of a file — what the module says about itself.
///
/// The comment stack a reader is handed was one deep: the chunk's own doc and nothing
/// else. That is wrong wherever a codebase explains a module once at the top and leaves its
/// functions bare, which is the normal Rust idiom (`//!`), the normal Python idiom (a module
/// docstring) and common everywhere else. The reader graded those functions as undocumented
/// and unpredictable, and both were artefacts of the instrument: a person opening that file
/// has read the header before they reach the function.
///
/// **Rust and Python are read from the grammar's own header forms; everything else is the
/// leading comment run.** `//!` and a module docstring cannot be anything but a file-level
/// doc, so they are taken outright. A leading `//` run is more ambiguous — it may be the
/// first item's own doc comment — so it is taken only when a blank line separates it from
/// whatever follows, which is the same adjacency rule [`leading_doc`] uses from the other
/// side. Between them the two rules cannot both claim one comment, which matters because
/// the same text arriving twice in `docs` would read to a reader as emphasis.
pub fn file_doc(lang: Lang, src: &str) -> Option<String> {
    let mut parser = Parser::new();
    if parser.set_language(&language(lang)).is_err() {
        return None;
    }
    let tree = parser.parse(src, None)?;
    let root = tree.root_node();

    let raw = match lang {
        // A module docstring, by the same rule a function's is found — the root node IS the
        // body here, so the existing helper applies unchanged.
        Lang::Python => python_docstring(root, src),
        _ => {
            // Past the imports first. This is the whole of what was wrong: the loop stopped
            // at the first non-comment child, and in TypeScript, Go, Java and most of C the
            // first thing in a file is an import — so the module header, which conventionally
            // sits UNDER them, was never reached. Every `.tsx` file in this repo read as
            // having no header, and a wave of readers reported it from the far end: they were
            // asked to predict a file from a header they had been handed as empty.
            //
            // Comments before the imports still count. A file may put its banner above them
            // (C does) or below (TypeScript does), and both are the same claim about the same
            // file; what a header cannot be is attached to a declaration, which is the rule
            // below and the one `leading_doc` applies from the other side.
            let mut cursor = root.walk();
            let mut runs: Vec<(Vec<String>, usize)> = Vec::new();
            let mut open_run: Vec<String> = Vec::new();
            let mut last_end = 0usize;
            let mut attached_last = false;
            for child in root.children(&mut cursor) {
                let k = child.kind();
                if k.contains("comment") {
                    // A blank line ends a run. Without this a license, a banner and the
                    // first item's own doc comment all merge into one block, and the
                    // adjacency rule below then throws away the banner along with the doc.
                    if !open_run.is_empty() && child.start_position().row > last_end + 1 {
                        runs.push((std::mem::take(&mut open_run), last_end));
                    }
                    let t = text(child, src);
                    // Rust says which comments are the module's own: `//!` and `/*!`. A `///`
                    // run belongs to whatever follows, wherever it sits.
                    if lang == Lang::Rust && !(t.starts_with("//!") || t.starts_with("/*!")) {
                        last_end = child.end_position().row;
                        continue;
                    }
                    open_run.push(strip_comment_markers(t));
                    last_end = child.end_position().row;
                    continue;
                }
                // An import is not a declaration a comment can document, so a run that ends
                // at one is still a candidate header — and the scan carries on past it.
                let importish = k.contains("import")
                    || k.contains("include")
                    || k == "use_declaration"
                    || k == "package_clause"
                    || k == "package_declaration";
                if !open_run.is_empty() {
                    runs.push((std::mem::take(&mut open_run), last_end));
                }
                if importish {
                    continue;
                }
                // The first real declaration. A comment run touching it is ITS doc — see
                // `leading_doc` — and must not also be handed over as the file's.
                attached_last =
                    runs.last().is_some_and(|(_, end)| end + 1 >= child.start_position().row);
                break;
            }
            if !open_run.is_empty() {
                runs.push((open_run, last_end));
            }
            // Rust's `//!` is unambiguous, so adjacency cannot disqualify it.
            if attached_last && lang != Lang::Rust {
                runs.pop();
            }
            let joined = runs
                .into_iter()
                .map(|(lines, _)| lines.join("\n"))
                .collect::<Vec<_>>()
                .join("\n\n")
                .trim()
                .to_string();
            (!joined.is_empty()).then_some(joined)
        }
    }?;

    let doc = raw.trim();
    // A license is not an explanation. Checked over the whole header rather than line by
    // line: stripping the matching lines leaves fragments — "This file is part of Foo", a
    // lone asterisk — that read as a description and are not one.
    let lower = doc.to_lowercase();
    if LICENSE_MARKERS.iter().any(|m| lower.contains(m)) {
        return None;
    }
    if doc.is_empty() {
        return None;
    }
    Some(if doc.chars().count() > FILE_DOC_MAX {
        let cut: String = doc.chars().take(FILE_DOC_MAX).collect();
        // On a word boundary, so the last thing a reader sees is not half an identifier.
        let cut = cut.rsplit_once(char::is_whitespace).map_or(cut.clone(), |(h, _)| h.to_string());
        format!("{cut} …")
    } else {
        doc.to_string()
    })
}

/// Extract every top-level-ish function in `src`.
///
/// Returns an empty vec rather than erroring on a file tree-sitter can't parse:
/// generated code and half-written files are normal in a repo being scanned, and one
/// unparseable file must not abort a scan of ten thousand.
pub fn parse_functions(lang: Lang, src: &str) -> Vec<FuncDef> {
    let mut parser = Parser::new();
    if parser.set_language(&language(lang)).is_err() {
        return Vec::new();
    }
    let Some(tree) = parser.parse(src, None) else {
        return Vec::new();
    };

    let kinds = func_kinds(lang);
    let mut out = Vec::new();
    collect(tree.root_node(), lang, kinds, src, &mut out);
    out
}

/// Pre-order over the syntax tree, on a cursor rather than on the call stack.
///
/// **Syntax depth is an input, and this used to recurse on it.** It read as bounded — code
/// people write does not nest deeply, and the deepest BRACKET nesting anywhere in linux is
/// 103 — but a tree's depth is not its source's indentation. Grammars nest what the text
/// lays out flat: tree-sitter-c builds a left-nested `binary_expression` per operator, so
/// one generated table with 2,609 `|`s in a statement is a chain 2,609 deep, and `#elif`
/// chains, `else if` chains and ERROR recovery all do the same thing. Deep enough, and one
/// frame per node overruns a rayon worker's 2 MiB stack — a quarter of what the main thread
/// gets, which is why this could not be found by scanning anything by hand.
///
/// It aborts the PROCESS rather than failing the file: a stack overflow is not a panic, so
/// there is no unwinding, no `Result`, and nothing rayon can catch. One file in a hundred
/// thousand took the whole app down mid-scan, and what reached the window was a progress
/// bar stopped on the phase before. A cursor walk is O(1) stack, so the depth stops being
/// something the repo gets to decide.
/// Pre-order over the syntax tree, on a cursor rather than on the call stack.
///
/// **Syntax depth is an input, and this used to recurse on it.** It read as bounded — code
/// people write does not nest deeply, and the deepest BRACKET nesting anywhere in linux is
/// 103 — but a tree's depth is not its source's indentation. Grammars nest what the text
/// lays out flat: tree-sitter-c builds a left-nested `binary_expression` per operator, so
/// one generated table with 2,609 `|`s in a statement is a chain 2,609 deep, and `#elif`
/// chains, `else if` chains and ERROR recovery all do the same thing. Deep enough, and one
/// frame per node overruns a rayon worker's 2 MiB stack — a quarter of what the main thread
/// gets, which is why this could not be found by scanning anything by hand.
///
/// It aborts the PROCESS rather than failing the file: a stack overflow is not a panic, so
/// there is no unwinding, no `Result`, and nothing rayon can catch. One file in a hundred
/// thousand took the whole app down mid-scan, and what reached the window was a progress
/// bar stopped on the phase before. A cursor walk is O(1) stack, so the depth stops being
/// something the repo gets to decide.
fn collect(root: TsNode, lang: Lang, kinds: &[&str], src: &str, out: &mut Vec<FuncDef>) {
    let mut cursor = root.walk();
    loop {
        let node = cursor.node();
        // Descend unless this node WAS a function: a closure defined inside one is part of
        // that function's body, not a sibling wedge. Counting both would double the
        // enclosing function's lines and dilute its score with its own guts.
        let mut descend = true;
        if accepts(node, lang, kinds, src) {
            let is_decl = node.kind() == "variable_declarator";
            if !is_decl || declarator_is_function(node) {
                if let Some(f) = extract(node, lang, src) {
                    out.push(f);
                    descend = false;
                }
            }
        }
        if descend && cursor.goto_first_child() {
            continue;
        }
        // Climb until there is a sibling to move to. The cursor was made from `root`, so it
        // cannot ascend past it — `goto_parent` returning false at the top is the walk
        // finishing, and is the only exit.
        loop {
            if cursor.goto_next_sibling() {
                break;
            }
            if !cursor.goto_parent() {
                return;
            }
        }
    }
}

/// Is this node one of the language's function-like chunks?
///
/// Kind alone answers it everywhere except Elixir, where `def` is an ordinary macro call
/// and every function, module and `import` parses to the same `call` node. Matching on
/// the kind there would make a wedge of every line in the file.
fn accepts(node: TsNode, lang: Lang, kinds: &[&str], src: &str) -> bool {
    if !kinds.contains(&node.kind()) {
        return false;
    }
    match lang {
        Lang::Elixir => node
            .child_by_field_name("target")
            .map(|t| matches!(text(t, src), "def" | "defp" | "defmacro" | "defmacrop"))
            .unwrap_or(false),
        // `let add a = a + 1` is a function; `let x = 5` is a value with the same node.
        // The parameter is the only structural difference.
        Lang::OCaml => node.children(&mut node.walk()).any(|c| c.kind() == "parameter"),
        // Same distinction in F#, spelled as two different left-hand sides.
        Lang::FSharp => first_of_kind(node, "function_declaration_left").is_some(),
        // `add <- function(a) {}` — accept the assignment only when what is bound is a
        // function, exactly as `declarator_is_function` does for `const f = () => {}`.
        Lang::R => {
            node.child_by_field_name("rhs").is_some_and(|v| v.kind() == "function_definition")
        }
        Lang::Nix => node
            .child_by_field_name("expression")
            .is_some_and(|v| v.kind() == "function_expression"),
        // A lisp `defun` is an ordinary list whose head is a symbol, so the head is the
        // only thing that separates a definition from a function CALL. Without this every
        // list in the file — every `(+ a 1)` — would become a wedge.
        Lang::Clojure => lisp_head(node, src)
            .is_some_and(|h| matches!(h, "defn" | "defn-" | "defmacro" | "definline")),
        Lang::Scheme | Lang::Racket => {
            if !matches!(lisp_head(node, src), Some("define" | "define-syntax")) {
                return false;
            }
            // `(define (add a) ...)` defines a function; `(define x 5)` defines a value.
            // The parenthesised head is the difference.
            node.named_child(1).is_some_and(|c| c.kind() == "list")
        }
        // A Prolog `clause` is a rule (`head :- body`) or a bare fact. A fact has no body
        // to measure, so only rules are chunks.
        Lang::Prolog => {
            node.child_by_field_name("term").is_some_and(|t| t.kind() == "binary_operation")
        }
        _ => true,
    }
}

/// The first named child of `kind`, searched one level down only.
fn first_of_kind<'a>(node: TsNode<'a>, kind: &str) -> Option<TsNode<'a>> {
    node.children(&mut node.walk()).find(|c| c.kind() == kind)
}

/// The leading symbol of a lisp list — `defn` in `(defn add [a] ...)`.
///
/// The grammars disagree about how deep a symbol sits: Clojure wraps it in `sym_lit`
/// around a `sym_name`, Scheme and Racket use a bare `symbol`. Taking the text of the
/// first named child covers both, because in either case the text IS the symbol.
fn lisp_head<'a>(node: TsNode, src: &'a str) -> Option<&'a str> {
    Some(text(node.named_child(0)?, src).trim())
}

/// The node holding the chunk's name.
///
/// Most grammars expose a `name` field and this is one line. The exceptions are not
/// oversights in those grammars — they are how the languages are actually shaped — and
/// each one yields NOTHING if you assume the common case, which looks exactly like a
/// language that contains no functions.
fn name_node<'a>(node: TsNode<'a>, lang: Lang) -> Option<TsNode<'a>> {
    match lang {
        // `int add(int)` is a declarator wrapping a declarator wrapping an identifier,
        // and pointer or array returns add more layers — so walk down rather than
        // reaching for a fixed depth.
        //
        // Two C++ forms break the chain, and both surfaced the day `.h` started parsing
        // as C++ rather than C. `T &operator=(T x)` wraps in a `reference_declarator`,
        // which unlike `pointer_declarator` exposes its child POSITIONALLY rather than as
        // a `declarator` field — so the walk stopped one node too high and the function
        // was named `&operator=(T x)`. And `operator int() const` hangs an ABSTRACT
        // declarator off an `operator_cast`: there is no name below it to walk down to,
        // only parameters, so the walk landed on `() const`. Neither failed loudly; each
        // just handed a reader a name that is not one.
        Lang::C | Lang::Cpp => {
            let mut n = node.child_by_field_name("declarator")?;
            loop {
                if n.kind() == "operator_cast" {
                    // The conversion operator IS its own name — `operator int` — and the
                    // node is the smallest thing that spells it.
                    return Some(n);
                }
                let inner = n
                    .child_by_field_name("declarator")
                    .or_else(|| (n.kind() == "reference_declarator").then(|| n.named_child(0))?);
                match inner {
                    Some(i) => n = i,
                    None => return Some(n),
                }
            }
        }
        // Dart hangs the name off a signature node, with the body beside it.
        Lang::Dart => node
            .child_by_field_name("name")
            .or_else(|| node.child_by_field_name("signature")?.child_by_field_name("name")),
        // Objective-C method definitions carry no fields at all; the selector is simply
        // the first identifier in the node.
        Lang::ObjC => node.children(&mut node.walk()).find(|c| c.kind() == "identifier"),
        // `CREATE FUNCTION x(...)` names itself through an object_reference.
        Lang::Sql => node
            .children(&mut node.walk())
            .find(|c| c.kind() == "object_reference")
            .and_then(|r| r.child_by_field_name("name")),
        // `def add(a) do` — the name is the target of the call inside the arguments.
        // `arguments` is a node KIND here, not a field: `call` exposes only `target`, so
        // asking for it by field name returns nothing and every Elixir file parses as
        // empty.
        Lang::Elixir => {
            let args = node.children(&mut node.walk()).find(|c| c.kind() == "arguments")?;
            let first = args.named_child(0)?;
            first.child_by_field_name("target").or(Some(first))
        }
        // The C-family shader languages name themselves through the same declarator chain
        // as C — except GDShader, which puts a bare identifier there.
        Lang::Glsl | Lang::Hlsl | Lang::Slang => {
            let mut n = node.child_by_field_name("declarator")?;
            while let Some(inner) = n.child_by_field_name("declarator") {
                n = inner;
            }
            Some(n)
        }
        Lang::GdShader => node.child_by_field_name("declarator"),
        // Bound on the left of an assignment, like a JS `const`.
        Lang::R => node.child_by_field_name("lhs"),
        Lang::Nix => node.child_by_field_name("attrpath"),
        Lang::OCaml => node.child_by_field_name("pattern"),
        Lang::FSharp => first_of_kind(node, "function_declaration_left")?.named_child(0),
        // `(defn add [a] ...)` — the name is the symbol after the head.
        Lang::Clojure => node.named_child(1),
        // `(define (add a) ...)` — the name is the head of the inner list.
        Lang::Scheme | Lang::Racket => node.named_child(1)?.named_child(0),
        Lang::CommonLisp => {
            first_of_kind(node, "defun_header")?.child_by_field_name("function_name")
        }
        // Julia hangs the call — and so the name — off a signature node.
        Lang::Julia => {
            let sig = first_of_kind(node, "signature")?;
            first_of_kind(sig, "call_expression")?.named_child(0)
        }
        // Fortran and Ada both name themselves on their opening statement rather than on
        // the enclosing node.
        Lang::Fortran => first_of_kind(node, "function_statement")
            .or_else(|| first_of_kind(node, "subroutine_statement"))?
            .child_by_field_name("name"),
        Lang::Ada => first_of_kind(node, "procedure_specification")
            .or_else(|| first_of_kind(node, "function_specification"))?
            .child_by_field_name("name"),
        Lang::Vhdl => {
            first_of_kind(node, "function_specification")?.child_by_field_name("function")
        }
        Lang::Pascal => first_of_kind(node, "declProc")?.child_by_field_name("name"),
        Lang::Elm => first_of_kind(node, "function_declaration_left")?.named_child(0),
        // `function(add a)` — CMake's name is simply the first argument.
        Lang::Cmake => {
            let cmd = node.named_child(0)?;
            first_of_kind(cmd, "argument_list")?.named_child(0)
        }
        // Verilog wraps the identifier in another node of the same kind; SystemVerilog
        // exposes a plain `name` field. Both are handled by falling through to `name`
        // when the wrapper is absent.
        Lang::Verilog => {
            let id = first_of_kind(node, "function_identifier")
                .or_else(|| first_of_kind(node, "task_identifier"))?;
            Some(first_of_kind(id, id.kind()).unwrap_or(id))
        }
        // A Prolog rule names itself through the functor of its head.
        Lang::Prolog => {
            let term = node.child_by_field_name("term")?;
            term.child_by_field_name("left")?.child_by_field_name("functor")
        }
        Lang::PowerShell => first_of_kind(node, "function_name"),
        // Odin and D lead with a bare identifier and no field at all.
        Lang::Odin | Lang::D => first_of_kind(node, "identifier"),
        _ => node.child_by_field_name("name"),
    }
}

/// The node holding the chunk's body.
fn body_node<'a>(node: TsNode<'a>, lang: Lang) -> Option<TsNode<'a>> {
    match lang {
        // These bind the function one level down — the name is on the node, the body is
        // inside whatever the name was bound TO.
        Lang::R => return node.child_by_field_name("rhs")?.child_by_field_name("body"),
        Lang::Nix => return node.child_by_field_name("expression")?.child_by_field_name("body"),
        Lang::Odin => return first_of_kind(first_of_kind(node, "procedure")?, "block"),
        // A Prolog rule is `head :- body`; the body is the right operand.
        Lang::Prolog => return node.child_by_field_name("term")?.child_by_field_name("right"),
        // Godot's shader grammar spells the field `block` where C spells it `body`.
        Lang::GdShader => return node.child_by_field_name("block"),
        _ => {}
    }
    if let Some(b) = node.child_by_field_name("body") {
        return Some(b);
    }
    let kind = match lang {
        // Kotlin names its function but leaves the body an unnamed child.
        Lang::Kotlin => "function_body",
        Lang::ObjC => "compound_statement",
        Lang::Sql => "function_body",
        Lang::Elixir => "do_block",
        // Haskell's body is the right-hand side of the equation.
        Lang::Haskell => "match",
        Lang::D => "function_body",
        Lang::Vhdl => "sequential_block",
        Lang::PowerShell => "script_block",
        Lang::Ada => "handled_sequence_of_statements",
        // CMake calls it `body` too, but as a node kind rather than a field — so the
        // field lookup above misses it and it has to be matched by name.
        Lang::Cmake => "body",
        // `const Foo = () => {}` hangs the body off the initializer, not the declarator.
        _ => return node.child_by_field_name("value").and_then(|v| v.child_by_field_name("body")),
    };
    node.children(&mut node.walk()).find(|c| c.kind() == kind)
}

/// Where the chunk's body starts and ends, in bytes.
///
/// Most grammars wrap the body in a node and this is just that node's extent. A handful
/// do not — Julia, Fortran, the lisps and Visual Basic hang the statements directly off
/// the definition, so there is no single node to point at and the body is "everything
/// after the header". Returning a SPAN rather than a node is what lets those languages be
/// measured at all; for every language that has a body node the bytes are identical to
/// what the node would have given, which is why this refactor changes no existing score.
fn body_span(node: TsNode, lang: Lang) -> Option<(usize, usize)> {
    if let Some(b) = body_node(node, lang) {
        return Some((b.start_byte(), b.end_byte()));
    }
    let start = header_end(node, lang)?;
    let end = node.end_byte();
    (start < end).then_some((start, end))
}

/// The byte the header stops at, for the languages whose body is unwrapped.
///
/// Each of these is read off the grammar's own fields rather than by counting children:
/// a definition with an optional piece — Visual Basic's return type, Emacs Lisp's
/// docstring — would shift every positional index the moment it appeared, and the body
/// would silently start in the middle of the signature.
fn header_end(node: TsNode, lang: Lang) -> Option<usize> {
    let end_of = |n: Option<TsNode>| n.map(|n| n.end_byte());
    match lang {
        Lang::Julia => end_of(first_of_kind(node, "signature")),
        Lang::Fortran => end_of(
            first_of_kind(node, "function_statement")
                .or_else(|| first_of_kind(node, "subroutine_statement")),
        ),
        // The docstring is documentation, not body — start after it when it is there.
        Lang::Elisp => end_of(
            node.child_by_field_name("docstring")
                .or_else(|| node.child_by_field_name("parameters")),
        ),
        Lang::CommonLisp => end_of(first_of_kind(node, "defun_header")),
        Lang::VisualBasic => end_of(
            node.child_by_field_name("return_type")
                .or_else(|| node.child_by_field_name("parameters"))
                .or_else(|| node.child_by_field_name("name")),
        ),
        Lang::Verilog | Lang::SystemVerilog => {
            end_of(first_of_kind(node, "tf_port_list").or_else(|| name_node(node, lang)))
        }
        Lang::OCamlLex => end_of(node.child_by_field_name("name")),
        // `(define (add a) body...)` — the header is the name-and-parameters list.
        Lang::Scheme | Lang::Racket => end_of(node.named_child(1)),
        // `(defn add [a] body...)` — the header runs through the argument vector.
        Lang::Clojure => end_of(first_of_kind(node, "vec_lit").or_else(|| node.named_child(1))),
        _ => None,
    }
}

/// The node kinds that FORK control flow, per grammar.
///
/// **`None` is "this grammar was never taught", and it is not the same as a body with no
/// branches in it.** The Complexity lens paints grey where this returns `None`, exactly as
/// Callers does where `resolves_calls` is false — a zero standing in for "we did not look" is
/// how a map reports a repo as simple when nobody read it. That is why this returns an option
/// and not an empty slice.
///
/// **Read off a real parse, never off memory**, and pinned by `branch_kinds_are_real` below: a
/// kind that does not exist matches nothing and looks exactly like a language whose functions
/// never branch, which is the failure the literal matching exists to make loud.
///
/// # What is counted, and what is deliberately not
///
/// Cognitive complexity, not cyclomatic — every fork costs one, plus one for each fork it is
/// nested inside. The two were measured against each other on three repos and order functions
/// identically (Spearman 0.988–0.999), so only one of them is worth a lens; this is the one
/// whose weighting matches what a reader feels.
///
/// - **`else` is absent.** It is the other arm of a fork already counted, and charging for it
///   would make `if/else` cost twice what `if` does for the same one decision.
/// - **Case arms are absent, and the `switch` is counted once.** That IS the formula's whole
///   argument with cyclomatic complexity: a forty-case dispatch table is long and utterly
///   predictable, and counting each arm would put it at the top of the map.
/// - **`&&` and `||` are absent, for now, and the cost of that is measured.** Counting them
///   needs the operator text of a `binary_expression`, which every grammar spells differently
///   — the node itself covers `a + b` just as much as `a && b`. Leaving them out moved the
///   residual's independence from length by 0.16 → 0.22 on kibana and not at all on two other
///   repos, both well inside the 0.38 the flagship lens scores. A refinement, then, with a
///   number on it rather than a guess.
fn branch_kinds(lang: Lang) -> Option<&'static [&'static str]> {
    Some(match lang {
        Lang::Rust => &[
            "if_expression",
            "for_expression",
            "while_expression",
            "loop_expression",
            "match_expression",
        ],
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => &[
            "if_statement",
            "for_statement",
            "for_in_statement",
            "while_statement",
            "do_statement",
            "switch_statement",
            "catch_clause",
            "ternary_expression",
        ],
        // `elif_clause` is its own node rather than a nested `if`, so without it a chain of
        // four `elif`s costs the same as one `if`. `if_clause` is the filter in a
        // comprehension, which is a real branch written small.
        Lang::Python => &[
            "if_statement",
            "elif_clause",
            "for_statement",
            "while_statement",
            "except_clause",
            "conditional_expression",
            "if_clause",
        ],
        Lang::Go => &[
            "if_statement",
            "for_statement",
            "expression_switch_statement",
            "type_switch_statement",
            "select_statement",
        ],
        Lang::C | Lang::Cpp => &[
            "if_statement",
            "for_statement",
            "for_range_loop",
            "while_statement",
            "do_statement",
            "switch_statement",
            "catch_clause",
            "conditional_expression",
        ],
        Lang::Java => &[
            "if_statement",
            "for_statement",
            "enhanced_for_statement",
            "while_statement",
            "do_statement",
            "switch_expression",
            "catch_clause",
            "ternary_expression",
        ],
        Lang::CSharp => &[
            "if_statement",
            "for_statement",
            "foreach_statement",
            "while_statement",
            "do_statement",
            "switch_statement",
            "catch_clause",
            "conditional_expression",
        ],
        // Ruby names its control flow with bare words: `if`, `while`, `case` are the node
        // kinds themselves. `when` is a case arm and is left out with every other language's.
        Lang::Ruby => &["if", "elsif", "unless", "while", "until", "for", "case", "rescue"],
        _ => return None,
    })
}

/// Cognitive complexity for one body: every fork costs one, plus one for each fork it sits
/// inside. `None` where this grammar has no table — see [`branch_kinds`].
///
/// The nesting term is what separates this from a branch count, and it is the whole reason the
/// lens is worth drawing: three sequential `if`s cost three, three nested ones cost six, and
/// the second is the one that is hard to read.
fn cognitive_of(root: TsNode, lang: Lang) -> Option<u32> {
    let kinds = branch_kinds(lang)?;
    let mut cur = root.walk();
    let (mut total, mut nesting) = (0u32, 0u32);
    // Whether the node the cursor is on nests what follows it: a fork does, and a CONTINUATION
    // of a fork does not — see `chains`.
    let nests = |n: TsNode| kinds.contains(&n.kind()) && !chains(n);
    let charge = |n: TsNode, nesting: u32| -> u32 {
        if !kinds.contains(&n.kind()) {
            0
        } else if chains(n) {
            1
        } else {
            1 + nesting
        }
    };
    loop {
        if cur.goto_first_child() {
            total += charge(cur.node(), nesting);
            nesting += u32::from(nests(cur.node()));
            continue;
        }
        loop {
            let left = u32::from(nests(cur.node()));
            if cur.goto_next_sibling() {
                nesting -= left;
                total += charge(cur.node(), nesting);
                nesting += u32::from(nests(cur.node()));
                break;
            }
            if !cur.goto_parent() {
                return Some(total);
            }
            nesting -= left;
            if cur.node().id() == root.id() {
                return Some(total);
            }
        }
    }
}

/// Is this fork a CONTINUATION of the one before it rather than a fork inside it?
///
/// **`else if` is one decision written twice, not a decision inside a decision.** Charged as a
/// nest, a four-way `if/elif/elif/elif` costs 1+2+2+2 = 7 and reads as deeply tangled when it
/// is a flat list of alternatives — the same mistake, in the other direction, that counting
/// every `case` of a `switch` makes. The published formula charges these +1 flat, and this is
/// where it does.
///
/// Two spellings, because grammars split on this. Python and Ruby give the continuation its own
/// kind; the C family nests a whole `if` inside an `else`, so the tell is the parent.
fn chains(n: TsNode) -> bool {
    matches!(n.kind(), "elif_clause" | "elsif")
        || n.parent().is_some_and(|p| matches!(p.kind(), "else_clause" | "else"))
}

fn extract(node: TsNode, lang: Lang, src: &str) -> Option<FuncDef> {
    let name = text(name_node(node, lang)?, src).to_string();
    let (body_start, body_end) = body_span(node, lang)?;

    let sig_end = body_start.min(src.len());
    let signature = src.get(node.start_byte()..sig_end)?.trim().to_string();
    let body_text = src.get(body_start..body_end)?.to_string();

    let doc = match lang {
        Lang::Python => body_node(node, lang)
            .and_then(|b| python_docstring(b, src))
            .or_else(|| leading_doc(node, src)),
        // Emacs Lisp puts its docstring inside the definition, like Python, but exposes it
        // as a field rather than as the first statement.
        Lang::Elisp => node
            .child_by_field_name("docstring")
            .map(|d| text(d, src).trim_matches('"').trim().to_string())
            .or_else(|| leading_doc(node, src)),
        // A `const Foo = …` declarator carries no comment of its own: the doc sits above
        // the enclosing `lexical_declaration`, and above *that* again when the
        // declaration is exported. Walk out through those wrappers — stopping at the
        // first one that has a comment — or every exported arrow-function component in
        // a React codebase reads as undocumented.
        _ => leading_doc(node, src).or_else(|| wrapper_doc(node, src)),
    };

    let calls = calls_in(node, lang, &name, src);
    Some(FuncDef {
        name,
        signature,
        body: body_text,
        doc,
        owner: owner_of(node, lang, src),
        start_line: node.start_position().row as u32 + 1,
        end_line: node.end_position().row as u32 + 1,
        calls,
        shape: shape_of(node, body_start, body_end),
        cognitive: cognitive_of(node, lang),
    })
}

/// How many tokens a body must hold before its shape is worth comparing.
///
/// **The whole difference between a clone finding and noise.** Normalising identifiers away
/// is what lets a copy-paste-and-rename be recognised, and it is also what makes every short
/// body identical to every other: `{ return self.x }` and `{ return other.name }` are one
/// shape. The floor is where "these are the same function" stops being a statement about the
/// repo and becomes one about the grammar.
///
/// Forty is the low end of what the clone-detection literature uses for token-level
/// comparison, chosen here because a function is already a bounded unit — we are not sliding
/// a window over a file hoping to find a repeated fragment, so the usual reason to demand a
/// long match does not apply. `just scan` prints the group-size histogram; read it before
/// moving this.
pub const MIN_SHAPE_TOKENS: u32 = 40;

/// A hash of the body's token SHAPE: keywords and punctuation as they are, every identifier
/// and every literal flattened to one placeholder.
///
/// **What it is for.** Two functions with the same shape are the same code wearing different
/// names — the copy-paste-and-rename that no other lens here can see. Surprise cannot: a
/// clone is highly predictable and reads cold, correctly, because it IS predictable. That is
/// precisely why it is worth marking separately — predictable code that should not exist is
/// a different finding from predictable code that should.
///
/// **What it refuses to claim.** Only the body, so two functions with different signatures
/// and identical bodies still match, which is the case worth catching. Comments are skipped:
/// a copy someone commented differently is still a copy. It is exact-after-normalisation and
/// nothing else — no edit distance, no near-miss, no threshold to tune. A pair one statement
/// apart is not reported, and that is the honest trade: everything this marks is genuinely
/// the same shape, and nothing it marks needs a judgement call to believe.
///
/// Language is NOT mixed in here — [`crate::clones`] groups within a family, the same rule
/// [`crate::edges`] follows, and for the same reason: a Python `main` and a Go `main` are
/// not the same function.
fn shape_of(node: TsNode, body_start: usize, body_end: usize) -> Option<u64> {
    // FNV-1a. A hash, not a signature: the map is drawn from it, nothing is trusted to it,
    // and a collision costs one wrongly-paired wedge out of 64 bits of space.
    const OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
    const PRIME: u64 = 0x0000_0100_0000_01b3;
    let mut hash = OFFSET;
    let mut tokens = 0u32;
    let mut eat = |bytes: &[u8]| {
        for b in bytes {
            hash ^= u64::from(*b);
            hash = hash.wrapping_mul(PRIME);
        }
    };

    let mut cursor = node.walk();
    let mut down = true;
    loop {
        if down && cursor.node().child_count() == 0 {
            let leaf = cursor.node();
            if leaf.start_byte() >= body_start && leaf.end_byte() <= body_end {
                let kind = leaf.kind();
                // Substrings rather than a per-grammar table, deliberately: 45 grammars name
                // these differently — `identifier`, `type_identifier`, `simple_identifier`,
                // `field_identifier`, `string_content`, `integer_literal`, `number` — and a
                // table would be 45 more chances to silently match nothing. A kind this
                // misreads costs one token's worth of precision; a table with a hole in it
                // costs a language.
                if kind.contains("comment") {
                    // Skipped, so a copy somebody commented differently is still a copy.
                } else {
                    let token: &[u8] = if kind.contains("ident") {
                        b"#"
                    } else if kind.contains("literal")
                        || kind.contains("string")
                        || kind.contains("content")
                        || kind.contains("number")
                        || kind.contains("integer")
                        || kind.contains("float")
                        || kind.contains("char")
                    {
                        b"$"
                    } else {
                        kind.as_bytes()
                    };
                    eat(token);
                    eat(b"\x1f");
                    tokens += 1;
                }
            }
        }
        if down && cursor.goto_first_child() {
            continue;
        }
        if cursor.goto_next_sibling() {
            down = true;
            continue;
        }
        if !cursor.goto_parent() || cursor.node().id() == node.id() {
            break;
        }
        down = false;
    }

    (tokens >= MIN_SHAPE_TOKENS).then_some(hash)
}

/// Can a call site in this language be found at all?
///
/// **The one thing standing between an honest map and a confident wrong one.** The Reach and
/// Locality lenses are built on call edges, and a language absent from [`call_sites`] yields
/// none — which is indistinguishable, downstream, from a language whose functions really are
/// unreferenced. So the absence is stated here and carried all the way to the wedge as a
/// `None`, which paints gray, rather than as a zero, which paints "nothing calls this" over
/// code somebody wrote last week.
///
/// Derived from the table rather than written out as a second list of languages. The second
/// list was drafted, in `model.rs`, next to the language enum where it reads more naturally —
/// and it is the shape of every drift this codebase has already paid for: two copies of one
/// decision, kept in step by a test that has to be remembered. Here there is nothing to keep
/// in step. Adding a language to `call_sites` turns its lenses on, and that is the only way
/// to turn them on.
pub fn resolves_calls(lang: Lang) -> bool {
    !call_sites(lang).is_empty()
}

/// Node kinds that are a call, and the field holding what is being called.
///
/// The same discipline `func_kinds` runs on, for the same reason: every pair here was
/// read off a real parse of a real snippet, never off memory. A kind that does not exist
/// matches nothing, and a language whose calls all silently fail to match looks exactly
/// like a language whose functions genuinely call nothing — which under the Reach lens
/// reads as an all-clear over dead code. There is a test per language; keep them passing.
///
/// `None` for the field means "the callee is the first named child". Swift and Kotlin
/// spell a call as an anonymous juxtaposition — `(call_expression (simple_identifier)
/// (call_suffix …))` — so there is no field to name, and reaching for one yields nothing.
///
/// **A language absent from this list resolves no calls at all**, which is a stated
/// absence rather than a zero — see [`crate::model::Lang::resolves_calls`], and keep the
/// two in step. The list is short on purpose: it is the set whose call shape has actually
/// been parsed and asserted, and adding to it is the same job as adding a language.
///
/// Constructors count. `new Thing()` and `Thing()` are the same edge as far as this map is
/// concerned — one piece of code depending on another — and in Java, C# and TypeScript a
/// great deal of the real wiring is spelled that way.
fn call_sites(lang: Lang) -> &'static [(&'static str, Option<&'static str>)] {
    match lang {
        Lang::Rust => &[("call_expression", Some("function"))],
        // JSX elements are calls, and leaving them out was the single biggest hole this
        // table had. A React component is invoked as `<Sidebar />`, never as `Sidebar()`, so
        // without these two kinds every component in every frontend reports zero callers —
        // and zero callers is the Reach lens's headline finding. A repo of the exact kind
        // this app is aimed at would have opened with its entire UI painted as dead code.
        //
        // `jsx_closing_element` is deliberately absent: `</Sidebar>` names the same component
        // its opening tag does, and while the dedup would swallow it anyway, a table that
        // lists a kind it does not need reads as though it needed it.
        //
        // No case filter on the name. `<div>` yields `div`, which resolves to nothing because
        // no function in the repo is called `div` — so the resolver already refuses it, and a
        // capital-letter rule here would be a second, weaker copy of that judgement.
        Lang::TypeScript | Lang::Tsx | Lang::JavaScript => &[
            ("call_expression", Some("function")),
            ("new_expression", Some("constructor")),
            ("jsx_opening_element", Some("name")),
            ("jsx_self_closing_element", Some("name")),
        ],
        Lang::Python => &[("call", Some("function"))],
        Lang::Go => &[("call_expression", Some("function"))],
        // `field_expression` (`s->c()`) and `qualified_identifier` (`std::make_unique<T>()`)
        // are both reached by following fields — see `callee_name`.
        Lang::C | Lang::Cpp => &[("call_expression", Some("function"))],
        Lang::Java => {
            &[("method_invocation", Some("name")), ("object_creation_expression", Some("type"))]
        }
        Lang::CSharp => &[
            ("invocation_expression", Some("function")),
            ("object_creation_expression", Some("type")),
        ],
        Lang::Ruby => &[("call", Some("method"))],
        Lang::Swift | Lang::Kotlin => &[("call_expression", None)],
        Lang::Lua => &[("function_call", Some("name"))],
        Lang::Php => &[
            ("function_call_expression", Some("function")),
            ("member_call_expression", Some("name")),
            ("scoped_call_expression", Some("name")),
        ],
        Lang::Scala => &[("call_expression", Some("function"))],
        Lang::Dart => &[("call_expression", Some("function"))],
        Lang::Zig => &[("call_expression", Some("function"))],
        // Godot spells a bare call and a call through a receiver as two different kinds,
        // and `attribute_call` is the one that carries `_ready`-style engine work through
        // a node reference. Neither names its callee with a field.
        Lang::GdScript => &[("call", None), ("attribute_call", None)],
        // The C-family shader languages parse as C here too, exactly as `func_kinds` says.
        Lang::Glsl | Lang::Hlsl | Lang::Slang | Lang::GdShader => {
            &[("call_expression", Some("function"))]
        }
        // QML's grammar is JavaScript's below the object layer, so a call is a call.
        Lang::Qml => {
            &[("call_expression", Some("function")), ("new_expression", Some("constructor"))]
        }
        Lang::Cfml => &[("call_expression", Some("function"))],
        Lang::Luau => &[("function_call", Some("name"))],
        // A shell script cannot tell calling a function it defines from running `grep`, and
        // neither can this: every command is recorded and the resolver keeps the ones that
        // name something in the repo. That is the same filter every language leans on.
        Lang::Shell | Lang::Zsh => &[("command", Some("name"))],
        // Elixir has no call node of its own because `def` is itself a call — which is why
        // `walk_calls` refuses to match the function node it was handed.
        Lang::Elixir => &[("call", Some("target"))],
        // A keyword message repeats `method` once per selector part, so `[x c:1 d:2]` is
        // recorded against `c`. The first part is what a reader would name it by.
        Lang::ObjC => {
            &[("call_expression", Some("function")), ("message_expression", Some("method"))]
        }
        Lang::Haskell => &[("apply", Some("function"))],
        Lang::Elm => &[("function_call_expr", Some("target"))],
        Lang::R => &[("call", Some("function"))],
        // Julia writes a signature as a call, which would make every function call itself —
        // see `skip_fields`.
        Lang::Julia => &[("call_expression", None)],
        Lang::Erlang => &[("call", Some("expr"))],
        Lang::Groovy => {
            &[("method_invocation", Some("name")), ("object_creation_expression", Some("type"))]
        }
        Lang::Gleam => &[("function_call", Some("function"))],
        Lang::Odin => &[("call_expression", Some("function"))],
        // Perl distinguishes `b()`, `b 1` and `&b()` at the top and shares one bareword node
        // underneath, which is the node worth matching.
        Lang::Perl => &[
            ("call_expression_with_bareword", Some("function_name")),
            ("method_invocation", Some("function_name")),
        ],
        Lang::D => &[("call_expression", None)],
        Lang::Solidity => &[("call_expression", Some("function"))],
        Lang::FSharp => &[("application_expression", None)],
        Lang::OCaml => &[("application_expression", Some("function"))],
        Lang::VisualBasic => &[("invocation", Some("target"))],
        // Only `command`. PowerShell's own functions are invoked as commands; the
        // `invokation_expression` beside it is .NET method and static calls, and it names
        // its member without a field — reaching for one yields the TYPE, so `[T]::d()`
        // would be recorded as a call to `T`. A wrong edge is worse than a missing one.
        Lang::PowerShell => &[("command", Some("command_name"))],
        Lang::Pascal => &[("exprCall", Some("entity"))],
        Lang::Ada => &[("procedure_call_statement", Some("name")), ("function_call", Some("name"))],
        Lang::Starlark => &[("call", Some("function"))],
        Lang::Nix => &[("apply_expression", Some("function"))],
        // `c(1)` is a call or an array read and Fortran's grammar cannot tell either; the
        // resolver's own filter decides it, and an array sharing a name with a function in
        // the same repo is the residue.
        Lang::Fortran => &[("subroutine_call", Some("subroutine")), ("call_expression", None)],
        // Every command, because CMake cannot tell one it defined from `message` — the same
        // filter the shells lean on.
        Lang::Cmake => &[("normal_command", None)],
        // A goal and a data term are one shape in Prolog, so a compound term inside an
        // argument is recorded too. Loose in the same way the lisps are, and held up by the
        // same thing: only a name some predicate in the repo actually has survives the
        // resolver. The clause HEAD is a compound term as well — that one is the function's
        // own name, which never enters its list.
        Lang::Prolog => &[("compound_term", Some("functor"))],
        // **The lisps are the loosest table here and the doc comment is the warning.** A
        // call is a list whose head is a symbol, and so is `let`, `when` and every macro
        // form — the grammar draws no line, so neither can this. What holds it up is that
        // the resolver only keeps a name some function in the repo actually has, so a
        // binding form contributes an edge only when somebody bound a name that is also a
        // function here. Narrower would mean a list of special forms per dialect, which is
        // a claim about the language rather than a reading of its grammar.
        Lang::Clojure | Lang::CommonLisp => &[("list_lit", None)],
        Lang::Scheme | Lang::Racket | Lang::Elisp => &[("list", None)],
        _ => &[],
    }
}

/// Subtrees that are the definition's own header rather than anything it calls, per language.
///
/// A definition's own parameter list is not a call, and in three languages here it parses as
/// one: Julia writes a signature AS a call expression, Emacs Lisp's `parameters` and Common
/// Lisp's `lambda_list` are ordinary lists whose head is a symbol. Left alone, every Julia
/// function calls itself and every lisp function calls its own first argument — an invented
/// edge that looks exactly like a real one.
///
/// **Per language rather than a global list**, because the same name means something else
/// elsewhere: Python and TypeScript put default values in `parameters`, and `def f(x = g())`
/// really does call `g`.
///
/// A name is matched against the FIELD a node arrives under and against its KIND, because the
/// three grammars spell it two ways — Julia hangs an unnamed `signature` node off the
/// definition, while the two lisps name a field over a list kind they use everywhere else.
fn skip_fields(lang: Lang) -> &'static [&'static str] {
    match lang {
        Lang::Julia => &["signature"],
        Lang::Elisp => &["parameters"],
        Lang::CommonLisp => &["lambda_list"],
        _ => &[],
    }
}

/// The fields that lead from a callee expression to the name at the end of it.
///
/// Followed rather than descended blindly, and the difference is not cosmetic. Taking the
/// last identifier under `std::make_unique<T>()` yields `T` — the template ARGUMENT — so a
/// C++ repo would have every smart-pointer construction recorded as a call to whatever type
/// it holds. Following `name` through `qualified_identifier` and then through
/// `template_function` yields `make_unique`, which is the thing being called.
const CALLEE_FIELDS: &[&str] =
    &["name", "field", "property", "method", "attribute", "member", "suffix"];

/// How many wrappers deep to chase a callee before giving up. A generous ceiling on a
/// structure that is three or four deep in the worst real case; it exists so a pathological
/// tree cannot turn one call site into unbounded recursion.
const CALLEE_DEPTH: u32 = 12;

/// The bare name at the end of a callee expression, or `None` if it does not end in one.
///
/// `a.b.c()` and `T::c()` and `c()` all yield `c`. The receiver is discarded deliberately —
/// see [`FuncDef::calls`].
fn callee_name(node: TsNode, lang: Lang, src: &str, depth: u32) -> Option<String> {
    if depth > CALLEE_DEPTH {
        return None;
    }
    for field in CALLEE_FIELDS {
        if let Some(child) = node.child_by_field_name(field) {
            return callee_name(child, lang, src, depth + 1);
        }
    }
    let mut cursor = node.walk();
    let named: Vec<TsNode> = node.children(&mut cursor).filter(|c| c.is_named()).collect();
    if let Some(last) = named.last() {
        // Kotlin's `navigation_expression` and the lisp-shaped wrappers carry no fields at
        // all, so the tail is the name. Anything that reached here with children and no
        // recognised field is that shape.
        return callee_name(*last, lang, src, depth + 1);
    }
    let t = text(node, src).trim();
    is_identifier(lang, t).then(|| t.to_string())
}

/// Does this text look like a name a definition could carry **in this language**?
///
/// The gate on everything that reaches `calls`. Without it a callee that resolves to a
/// literal, an operator or a whole expression enters the symbol table as a name, and the
/// resolver — which matches on strings — would happily join two functions through it.
///
/// **It has to admit exactly what the DEFINITION side admits, and `[A-Za-z0-9_]` does not.**
/// The resolver matches a call name against a parsed function name, so a character allowed
/// in one and refused in the other silently drops every edge that uses it — and that is not
/// an edge case in four of these languages: PowerShell's entire convention is `Verb-Noun`,
/// the lisps hyphenate everything, Ruby and Elixir end a predicate in `?` and a bang method
/// in `!`, and R's own standard library is full of `as.data.frame`. Measured before it was
/// fixed: nine PowerShell functions in ceph's Windows suite, one of which reported calling
/// anything, in files whose every line is a `Write-Output`.
///
/// The FIRST character stays alphabetic in every language. That is what keeps `--force`, a
/// negative number and a bare operator out, and it costs only the lisp names that are
/// entirely punctuation — `+` is a function there, but it is not one anybody's repo defines.
fn is_identifier(lang: Lang, t: &str) -> bool {
    let extra = name_chars(lang);
    !t.is_empty()
        && t.chars().next().is_some_and(|c| c.is_alphabetic() || c == '_')
        && t.chars().all(|c| c.is_alphanumeric() || c == '_' || extra.contains(c))
}

/// What a name may hold beyond `[A-Za-z0-9_]`, per language — see [`is_identifier`].
///
/// Read off what each language's own definitions are named, not off what its grammar will
/// tolerate in an expression: the list is here to make the call side agree with the name a
/// `FuncDef` already carries.
fn name_chars(lang: Lang) -> &'static str {
    match lang {
        // `save!`, `valid?` — the convention, not the exception.
        Lang::Ruby | Lang::Elixir | Lang::Julia => "!?",
        // `as.data.frame`. R's dot is a name character and nothing else.
        Lang::R => ".",
        // `Verb-Noun`, and a shell command is regularly `docker-compose`.
        Lang::PowerShell | Lang::Shell | Lang::Zsh => "-",
        // Hyphens everywhere, `empty?` and `swap!` in Clojure, `set-car!` in Scheme,
        // `with-output-to-string` in all of them. Wide, because a lisp name is wide — but
        // still alphabetic FIRST, so `*ns*` and `->thing` are the names this does not reach.
        Lang::Clojure | Lang::Scheme | Lang::Racket | Lang::CommonLisp | Lang::Elisp => {
            "-?!*/+<>=."
        }
        _ => "",
    }
}

/// At most this many distinct callee names per function.
///
/// A ceiling on what a cached parse costs, not a claim about code. These names ride inside
/// `scancache`'s `FuncDef`, so an unbounded list on a 2,000-line generated dispatcher is
/// paid on every open of every repo forever. Truncation loses edges from the one function
/// that is already the least readable thing in the file, which is the cheapest place to
/// lose them.
pub(crate) const MAX_CALLS: usize = 64;

/// Every distinct name this function calls, in order of first appearance.
///
/// Deduplicated because the question downstream is "does this function depend on that one",
/// asked once — a body that calls `push` forty times has one edge to `push`, and counting
/// forty would let a loop outvote a subsystem.
fn calls_in(node: TsNode, lang: Lang, name: &str, src: &str) -> Vec<String> {
    let sites = call_sites(lang);
    if sites.is_empty() {
        return Vec::new();
    }
    let mut out: Vec<String> = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    // A function's own name never enters its list. Recursion is not two pieces of code
    // depending on each other and [`crate::edges::wire`] drops it anyway — but a Scheme
    // definition writes its signature as `(a)`, a list indistinguishable from a call, so
    // without this the artifact would sit in the list looking exactly like an edge.
    seen.insert(name.to_string());
    walk_calls(node, lang, sites, skip_fields(lang), src, &mut out, &mut seen);
    out
}

/// Depth-first in document order, so the list is the order a reader would meet the calls.
///
/// A CURSOR walk rather than recursion, for the reason `collect` is one: a tree-sitter tree is
/// as deep as the source nests, and a real file can nest far enough to exhaust the stack — a
/// long C initializer chain does it, and there is a test named for it. This function walks the
/// same trees `collect` does, so it had the same hazard; being newer is not being safer.
///
/// Order has to be deterministic whatever the mechanism: the list is cached, and one that
/// reshuffled between two parses of identical bytes would rewrite the cache on every open and
/// make `PARSE_VERSION` meaningless. Document order is the one order anybody can predict.
///
/// Unlike `collect` this descends into everything, nested definitions included, because the
/// extent it reports on is the extent `body` covers — see [`FuncDef::calls`].
fn walk_calls(
    root: TsNode,
    lang: Lang,
    sites: &[(&str, Option<&str>)],
    skip: &[&str],
    src: &str,
    out: &mut Vec<String>,
    seen: &mut std::collections::HashSet<String>,
) {
    let mut cursor = root.walk();
    loop {
        let node = cursor.node();
        // A definition is not a call it makes, and in Elixir and the lisps the definition IS
        // a call node — `def a do … end` and `(defn a [] …)` match the very table used to
        // find calls inside them. Every function would report calling `def`.
        let is_root = node.id() == root.id();
        let skipped = !is_root
            && (cursor.field_name().is_some_and(|f| skip.contains(&f))
                || skip.contains(&node.kind()));
        if !is_root && !skipped {
            if let Some((_, field)) = sites.iter().find(|(k, _)| *k == node.kind()) {
                let callee = match field {
                    Some(f) => node.child_by_field_name(f),
                    None => node.named_child(0),
                };
                if let Some(name) = callee.and_then(|c| callee_name(c, lang, src, 0)) {
                    if out.len() < MAX_CALLS && seen.insert(name.clone()) {
                        out.push(name);
                    }
                }
            }
        }
        if !skipped && cursor.goto_first_child() {
            continue;
        }
        // Climb until there is a sibling to move to. The cursor was made from `root`, so it
        // cannot ascend past it — `goto_parent` returning false at the top is the walk
        // finishing, and is the only exit.
        loop {
            if cursor.goto_next_sibling() {
                break;
            }
            if !cursor.goto_parent() {
                return;
            }
        }
    }
}

/// Is COMPLEXITY a lens, or is it line count wearing a hat?
///
/// **The question this exists to answer honestly, after the first attempt got it wrong.**
/// Nesting depth was measured across five repos and came back at 0.67–0.88 rank correlation
/// with line count, against a bar of 0.38 — what the real Surprise grades score against the
/// same. Depth is mostly a restatement of the width the map already draws, and it was
/// rejected. The mistake was concluding from that that BRANCHES would fail the same way.
///
/// They are not the same quantity. Depth measures how much code sits inside blocks, which is
/// volume; a two-hundred-line linear pipeline is deep and simple. Branch DENSITY measures how
/// often control forks per line, and that same pipeline scores near zero on it. One is
/// extensive and one is intensive, and only the first has an arithmetic reason to track size.
///
/// **Approximated from the body text on purpose.** Counting branches properly needs a node
/// kind table per grammar, like `func_kinds` and `call_sites` — real work, and work this test
/// exists to decide whether to pay for. A keyword scan is cruder: it sees `if` inside a string
/// and misses a language whose keyword is not on the list. That is the right trade for a
/// question of the form "is the correlation 0.3 or 0.8", where the noise would have to be
/// enormous to move the answer between them.
///
/// `cargo test --release --lib parse::complexity -- --ignored --nocapture`, `CX_REPO=<path>`.
/// Prints the real node kinds each grammar emits for control flow, because `CLAUDE.md` says
/// to read them off a parse and never off memory: a kind that does not exist matches nothing
/// and looks exactly like a language with no branches in it.
///
/// `cargo test --lib parse::kinds -- --ignored --nocapture`
#[cfg(test)]
mod kinds {
    use super::*;

    /// **Every kind in `branch_kinds` has to exist in the grammar it is listed under.**
    ///
    /// This is the same guard `func_kinds` has and it exists for the same reason: a kind that
    /// does not exist matches nothing, and a language whose branches are never counted looks
    /// exactly like a language whose functions never branch. Nothing errors, the map just goes
    /// quietly and confidently wrong — and a grammar bump that renames a node does it silently
    /// months later.
    ///
    /// The snippet per language has to contain one of everything the table claims. Where it
    /// does not, the failure is this test's rather than the table's, which is the right way
    /// round: it is a test that gets fixed by writing more code, not by deleting a kind.
    #[test]
    fn branch_kinds_are_real() {
        let cases: &[(Lang, &str)] = &[
            (
                Lang::Rust,
                "fn f(){ if a {} for x in y {} while c {} loop {} match m { _ => {} } }",
            ),
            (
                Lang::TypeScript,
                "function f(){ if(a){} for(;;){} for(const x of y){} while(c){} do{}while(d); \
                 switch(e){case 1:break;} try{}catch(g){} const h = a ? b : c; }",
            ),
            (
                Lang::Python,
                "def f():\n  if a:\n    pass\n  elif b:\n    pass\n  for x in y:\n    pass\n  \
                 while c:\n    pass\n  try:\n    pass\n  except E:\n    pass\n  \
                 q = [z for z in r if z]\n  w = a if b else c\n",
            ),
            (
                Lang::Go,
                "func f(){\n if a {\n }\n for i := 0; ; {\n }\n switch c {\n case 1:\n }\n \
                 switch v := x.(type) {\n case int:\n }\n select {\n }\n}\n",
            ),
            (
                Lang::Cpp,
                "void f(){ if(a){} for(;;){} for(auto x : y){} while(c){} do{}while(d); \
                 switch(e){case 1:break;} try{}catch(...){} int g = a ? b : c; }",
            ),
            (
                Lang::Java,
                "class K{ void f(){ if(a){} for(;;){} for(String s : y){} while(c){} do{}while(d); \
                 int r = switch(e){ default -> 1; }; try{}catch(Exception x){} int g = a ? b : c; } }",
            ),
            (
                Lang::CSharp,
                "class K{ void f(){ if(a){} for(;;){} foreach(var x in y){} while(c){} \
                 do{}while(d); switch(e){case 1:break;} try{}catch{} var g = a ? b : c; } }",
            ),
            (
                Lang::Ruby,
                "def f\n if a\n elsif b\n end\n unless u\n end\n while c\n end\n \
                 until v\n end\n for i in list\n end\n case d\n when 1\n end\n \
                 begin\n rescue\n end\nend\n",
            ),
        ];
        for (lang, src) in cases {
            let tree = sexp(*lang, src);
            let Some(kinds) = branch_kinds(*lang) else {
                panic!("{lang:?} is in this test but has no branch table")
            };
            for k in kinds {
                assert!(
                    tree.contains(&format!("({k}")),
                    "{lang:?}: `{k}` is not a kind this grammar emits — read it off the parse:\n{tree}"
                );
            }
        }
    }

    fn sexp(lang: Lang, src: &str) -> String {
        let mut p = tree_sitter::Parser::new();
        p.set_language(&language(lang)).expect("grammar loads");
        let t = p.parse(src, None).expect("parses");
        t.root_node().to_sexp()
    }

    fn cog(src: &str, lang: Lang) -> u32 {
        parse_functions(lang, src)
            .into_iter()
            .next()
            .expect("one function")
            .cognitive
            .expect("a language with a branch table")
    }

    /// **The formula, as the sentence that explains it: every fork costs one, plus one for
    /// each fork it is nested inside.** Three sequential ifs are three; three nested are six.
    /// That difference is the entire reason this is worth a lens rather than a branch count —
    /// the two order functions identically otherwise (0.988–0.999 measured).
    #[test]
    fn nesting_costs_more_than_sequence() {
        let flat = cog("fn f(){ if a {} if b {} if c {} }", Lang::Rust);
        let deep = cog("fn f(){ if a { if b { if c {} } } }", Lang::Rust);
        assert_eq!(flat, 3, "one each, none of them inside another");
        assert_eq!(deep, 6, "1 + 2 + 3");
    }

    /// **A dispatch table is not complex, and this is the claim that separates cognitive
    /// complexity from cyclomatic.** Forty cases is one decision written out forty times; a
    /// per-arm count would put every switch at the top of the map, which is precisely the
    /// reading people learned to ignore in the tools that do it.
    #[test]
    fn a_flat_switch_costs_one() {
        let many = cog(
            "function f(){ switch(e){ case 1: case 2: case 3: case 4: case 5: break; } }",
            Lang::TypeScript,
        );
        assert_eq!(many, 1, "one switch, whatever it dispatches on");
        let nested = cog(
            "function f(){ if (a) { switch(e){ case 1: break; } } }",
            Lang::TypeScript,
        );
        assert_eq!(nested, 3, "the if is 1, the switch inside it is 1 + 1");
    }

    /// `else` is the other arm of a fork already counted, so `if/else` costs what `if` does.
    /// An `elif` chain is not: each one is a new question.
    #[test]
    fn else_is_free_and_elif_is_not() {
        assert_eq!(cog("fn f(){ if a {} else {} }", Lang::Rust), 1);
        let chain = cog(
            "def f():\n  if a:\n    pass\n  elif b:\n    pass\n  elif c:\n    pass\n",
            Lang::Python,
        );
        assert_eq!(chain, 3, "three questions asked in a row");
    }

    /// A language nobody has written branch kinds for reports NOTHING, never zero — see
    /// `branch_kinds`. Zero would draw it as code that never forks.
    #[test]
    fn a_language_without_a_table_says_so() {
        assert!(branch_kinds(Lang::Rust).is_some());
        let untaught = parse_functions(Lang::Lua, "function f()\n if a then end\nend\n");
        if let Some(f) = untaught.into_iter().next() {
            assert_eq!(f.cognitive, None, "no table means no claim, not a claim of zero");
        }
    }

    #[test]
    #[ignore = "diagnostic"]
    fn print_control_flow_kinds() {
        let cases: &[(Lang, &str)] = &[
            (Lang::Rust, "fn f(){ if a {} else if b {} for x in y {} while c {} loop {} match m { _ => {} } let _ = a && b || c; }"),
            (Lang::TypeScript, "function f(){ if(a){}else if(b){} for(;;){} for(const x of y){} while(c){} do{}while(d); switch(e){case 1:break;} try{}catch(f){} const g = a && b || c ? d : e; }"),
            (Lang::Python, "def f():\n  if a:\n    pass\n  elif b:\n    pass\n  for x in y:\n    pass\n  while c:\n    pass\n  try:\n    pass\n  except E:\n    pass\n  z = [q for q in r if q]\n  w = a if b else c\n"),
            (Lang::Go, "func f(){ if a {} else if b {} for i:=0;;{} switch c {case 1:} select{} }"),
            (Lang::Cpp, "void f(){ if(a){}else if(b){} for(;;){} while(c){} do{}while(d); switch(e){case 1:break;} try{}catch(...){} int g = a && b || c ? d : e; }"),
            (Lang::Java, "class K{ void f(){ if(a){}else if(b){} for(;;){} while(c){} switch(e){case 1:break;} try{}catch(Exception x){} int g = a && b || c ? d : e; } }"),
            (Lang::Ruby, "def f\n if a\n elsif b\n end\n while c\n end\n case d\n when 1\n end\n begin\n rescue\n end\n x = a && b || c\nend\n"),
            (Lang::CSharp, "class K{ void f(){ if(a){}else if(b){} for(;;){} foreach(var x in y){} while(c){} switch(e){case 1:break;} try{}catch{} var g = a && b || c ? d : e; } }"),
        ];
        for (lang, src) in cases {
            println!("\n===== {lang:?}\n{}", sexp(*lang, src));
        }
    }
}

#[cfg(test)]
mod complexity {
    use super::*;

    /// Every source file under `root`, skipping what a scan skips: build outputs and vendored
    /// trees, which this walk reaches because it has no `.gitignore` reader of its own. An
    /// earlier version of this harness measured `web/dist` and reported 4,785 JavaScript
    /// functions against a repo that has 293 — every one a minified bundle on a single line.
    fn walk(root: &std::path::Path) -> Vec<std::path::PathBuf> {
        const SKIP: &[&str] = &[
            "node_modules", "target", "dist", "build", "out", "vendor", "vendored",
            "third_party", "thirdparty", "venv", "site-packages", "__pycache__",
        ];
        let mut out = Vec::new();
        let mut stack = vec![root.to_path_buf()];
        while let Some(dir) = stack.pop() {
            let Ok(rd) = std::fs::read_dir(&dir) else { continue };
            for e in rd.flatten() {
                let name = e.file_name();
                let name = name.to_string_lossy();
                if name.starts_with('.') || SKIP.contains(&name.as_ref()) {
                    continue;
                }
                let p = e.path();
                if p.is_dir() { stack.push(p) } else { out.push(p) }
            }
        }
        out
    }

    /// Spearman's rank correlation. **Rank rather than Pearson**, because the question is not
    /// whether two measures agree on a number — they are on different scales and cannot — but
    /// whether they ORDER functions the same way. A lens is a ramp, and a ramp is an ordering.
    fn spearman(xs: &[u32], ys: &[u32]) -> f64 {
        fn ranks(v: &[u32]) -> Vec<f64> {
            let mut idx: Vec<usize> = (0..v.len()).collect();
            idx.sort_by_key(|&i| v[i]);
            let mut out = vec![0.0; v.len()];
            let mut i = 0;
            while i < idx.len() {
                let mut j = i;
                while j + 1 < idx.len() && v[idx[j + 1]] == v[idx[i]] {
                    j += 1;
                }
                // Ties share the average of the ranks they span, which matters here: half a
                // repo is tied at zero branches.
                let r = (i + j) as f64 / 2.0 + 1.0;
                for &k in &idx[i..=j] {
                    out[k] = r;
                }
                i = j + 1;
            }
            out
        }
        let (rx, ry) = (ranks(xs), ranks(ys));
        let n = xs.len() as f64;
        let mx = rx.iter().sum::<f64>() / n;
        let my = ry.iter().sum::<f64>() / n;
        let (mut num, mut dx, mut dy) = (0.0, 0.0, 0.0);
        for i in 0..xs.len() {
            let (a, b) = (rx[i] - mx, ry[i] - my);
            num += a * b;
            dx += a * a;
            dy += b * b;
        }
        if dx == 0.0 || dy == 0.0 { 0.0 } else { num / (dx * dy).sqrt() }
    }

    fn pct(v: &[u32], p: f64) -> u32 {
        if v.is_empty() {
            return 0;
        }
        let mut s = v.to_vec();
        s.sort_unstable();
        s[(((s.len() - 1) as f64) * p).round() as usize]
    }

    /// Every fork in control flow that most languages spell the same way.
    ///
    /// Words are matched on boundaries so `iffy` and `format` do not count; operators are
    /// matched literally. `else` is deliberately absent — it is the other arm of a fork already
    /// counted, and cognitive complexity charges nothing for it.
    const BRANCH_WORDS: &[&str] = &[
        "if", "elif", "elsif", "for", "while", "case", "when", "catch", "except", "rescue",
        "unless", "match", "switch", "guard", "loop", "until", "foreach",
    ];
    const BRANCH_OPS: &[&str] = &["&&", "||"];

    /// A line's branches and its indent level, or `None` where the line is a comment.
    fn forks(line: &str) -> usize {
        let t = line.trim();
        if t.starts_with("//") || t.starts_with('#') || t.starts_with('*') || t.starts_with("--") {
            return 0;
        }
        let mut n = 0;
        for w in BRANCH_WORDS {
            let mut rest = t;
            while let Some(at) = rest.find(w) {
                let before = rest[..at].chars().next_back();
                let after = rest[at + w.len()..].chars().next();
                let bounded = before.is_none_or(|c| !c.is_alphanumeric() && c != '_')
                    && after.is_none_or(|c| !c.is_alphanumeric() && c != '_');
                if bounded {
                    n += 1;
                }
                rest = &rest[at + w.len()..];
            }
        }
        for op in BRANCH_OPS {
            n += t.matches(op).count();
        }
        n
    }

    /// The three readings, for one body.
    ///
    /// `cognitive` is the published formula, approximated: every fork costs one, plus one for
    /// each level it is nested inside. `density` is that over the body's own length, which is
    /// the intensive form and the one the whole question turns on.
    fn measure(body: &str) -> (u32, u32, u32) {
        let mut leads: Vec<(u32, usize)> = Vec::new();
        for line in body.lines() {
            let t = line.trim();
            if t.is_empty() || t.chars().all(|c| "{}()[]<>,;:".contains(c)) {
                continue;
            }
            let ws = line.len() - line.trim_start().len();
            leads.push((ws as u32, forks(line)));
        }
        let Some(&(base, _)) = leads.first() else { return (0, 0, 0) };
        let steps: Vec<u32> = leads.iter().map(|(w, _)| w.saturating_sub(base)).collect();
        let unit = steps.iter().copied().filter(|d| *d > 0).fold(0u32, |a, b| {
            fn gcd(a: u32, b: u32) -> u32 {
                if b == 0 { a } else { gcd(b, a % b) }
            }
            gcd(a, b)
        });
        let unit = unit.max(1);
        let branches: u32 = leads.iter().map(|(_, f)| *f as u32).sum();
        let cognitive: u32 = leads
            .iter()
            .zip(&steps)
            .map(|((_, f), step)| *f as u32 * (1 + step / unit))
            .sum();
        let lines = leads.len().max(1) as u32;
        (branches, cognitive, (cognitive * 100) / lines)
    }

    #[test]
    #[ignore = "walks a real repo; set CX_REPO"]
    fn is_complexity_line_count_wearing_a_hat() {
        let Ok(root) = std::env::var("CX_REPO") else { return };
        let root = std::path::Path::new(&root);
        let (mut br, mut cog, mut den, mut locs) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new());
        let (mut nbr, mut nden, mut nlocs, mut ncog) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new());
        let stored = crate::assessment::read_all(&crate::assessment::dir(root));
        let (mut grade, mut gbr, mut gcog, mut gden, mut glocs) =
            (Vec::new(), Vec::new(), Vec::new(), Vec::new(), Vec::new());

        for entry in walk(root) {
            let Some(lang) = crate::model::Lang::from_extension(
                entry.extension().and_then(|e| e.to_str()).unwrap_or(""),
            ) else {
                continue;
            };
            let Ok(src) = std::fs::read_to_string(&entry) else { continue };
            if src.lines().any(|l| l.len() > 2_000) || src.len() > 1_000_000 {
                continue;
            }
            let rel = entry.strip_prefix(root).unwrap_or(&entry).display().to_string();
            let mut seen: std::collections::HashMap<String, usize> = Default::default();
            for f in parse_functions(lang, &src) {
                // **The real count now, off the grammar** — the keyword scan decided whether
                // this was worth building and has no business deciding whether it works. A
                // language with no branch table is skipped rather than counted as zero.
                let Some(c) = f.cognitive else { continue };
                let (b, _, _) = measure(&f.body);
                let lines = f.body.lines().filter(|l| !l.trim().is_empty()).count().max(1) as u32;
                let d = (c * 100) / lines;
                // **Above the accessor floor, separately.** More than half of a C++ repo is
                // one-line getters, which are short AND branchless by construction — so they
                // manufacture a correlation between density and length that says nothing about
                // whether the lens works on code anybody has to read. Ten lines is where a
                // body stops being a field access; the split is reported both ways rather than
                // chosen, because excluding them silently would be picking the flattering
                // half.
                if f.loc() >= 10 {
                    nbr.push(b);
                    nden.push(d);
                    ncog.push(c);
                    nlocs.push(f.loc());
                }
                br.push(b);
                cog.push(c);
                den.push(d);
                locs.push(f.loc());
                let n = seen.entry(f.name.clone()).or_insert(0);
                let ord = *n;
                *n += 1;
                if let Some(r) = stored.get(&crate::assessment::key_of(&rel, &f.name, ord)) {
                    let (predicted, _) = r.grades();
                    grade.push(match predicted {
                        crate::agentapi::Grade::None => 3,
                        crate::agentapi::Grade::Some => 2,
                        crate::agentapi::Grade::Most => 1,
                        crate::agentapi::Grade::Full => 0,
                    });
                    gbr.push(b);
                    gcog.push(c);
                    gden.push(d);
                    glocs.push(f.loc());
                }
            }
        }
        // Which languages have a branch table and which do not, weighted by how much code is
        // actually in them — the number that decides whether the lens says anything on a real
        // repo. A lens that greys three quarters of a project is a lens nobody can use.
        {
            let mut by: std::collections::HashMap<String, (usize, usize)> = Default::default();
            for entry in walk(root) {
                let Some(lang) = crate::model::Lang::from_extension(
                    entry.extension().and_then(|e| e.to_str()).unwrap_or(""),
                ) else {
                    continue;
                };
                let Ok(src) = std::fs::read_to_string(&entry) else { continue };
                if src.lines().any(|l| l.len() > 2_000) || src.len() > 1_000_000 {
                    continue;
                }
                for f in parse_functions(lang, &src) {
                    let e = by.entry(format!("{lang:?}")).or_default();
                    e.0 += 1;
                    if f.cognitive.is_none() {
                        e.1 += 1;
                    }
                }
            }
            let total: usize = by.values().map(|v| v.0).sum();
            let missing: usize = by.values().map(|v| v.1).sum();
            let mut rows: Vec<_> = by.into_iter().filter(|(_, v)| v.1 > 0).collect();
            rows.sort_by_key(|(_, v)| std::cmp::Reverse(v.1));
            println!(
                "\nCOVERAGE {}: {missing} of {total} functions uncounted ({:.0}%)",
                root.display(),
                100.0 * missing as f64 / total.max(1) as f64
            );
            for (name, (n, miss)) in rows.into_iter().take(8) {
                println!("   {name:<12} {miss:>7} uncounted of {n}");
            }
        }
        if locs.is_empty() {
            println!("no functions under {}", root.display());
            return;
        }
        let sp = spearman;
        println!("\n{} — {} functions", root.display(), locs.len());
        println!("             p50  p90  p99   max");
        for (n, v) in [("branches ", &br), ("cognitive", &cog), ("cog/100ln", &den)] {
            println!(
                "  {n}  {:>4} {:>4} {:>4} {:>5}",
                pct(v, 0.5),
                pct(v, 0.9),
                pct(v, 0.99),
                v.iter().copied().max().unwrap_or(0)
            );
        }
        println!(
            "  vs lines:  branches {:.2}   cognitive {:.2}   DENSITY {:.2}",
            sp(&br, &locs),
            sp(&cog, &locs),
            sp(&den, &locs)
        );
        // **Do cognitive and cyclomatic draw two pictures or one?** If they order functions
        // the same way, offering both is two controls producing one map — an inert choice,
        // which this bar refuses on the same grounds it refuses an inert lens.
        println!("  branches vs cognitive = {:.3}", sp(&br, &cog));
        let flat = |v: &[u32]| 100.0 * v.iter().filter(|d| **d == 0).count() as f64 / v.len() as f64;
        println!("  at zero:   branches {:.0}%   density {:.0}%", flat(&br), flat(&den));
        // **"Is it more complicated than its length suggests?" — the residual, not the rate.**
        // Density divides by length, which assumes complexity scales linearly with it. Real
        // code does not: a two-hundred-line body is not ten times as branchy as a twenty-line
        // one, so a flat division still flatters the long and punishes the short — which is
        // exactly the 0.19–0.28 of trend left in the density column.
        //
        // Compared against OTHER FUNCTIONS ITS SIZE, in this repo. Same doctrine as the age
        // ramp and the churn ladder: calibrate to the codebase in front of you rather than to
        // somebody else's. Buckets rather than a fitted curve because a bucket median is
        // explainable in a sentence and a regression is not, and because the median does not
        // care that a handful of generated files have four hundred branches.
        if !nlocs.is_empty() {
            let bucket = |loc: u32| match loc {
                0..=14 => 0usize,
                15..=24 => 1,
                25..=49 => 2,
                50..=99 => 3,
                100..=199 => 4,
                _ => 5,
            };
            let mut by: Vec<Vec<u32>> = vec![Vec::new(); 6];
            for (c, l) in ncog.iter().zip(&nlocs) {
                by[bucket(*l)].push(*c);
            }
            let med: Vec<u32> = by.iter().map(|v| if v.is_empty() { 1 } else { pct(v, 0.5).max(1) }).collect();
            let resid: Vec<u32> = ncog
                .iter()
                .zip(&nlocs)
                .map(|(c, l)| (c * 100) / med[bucket(*l)])
                .collect();
            println!(
                "  RESIDUAL (vs median of its size band): vs lines {:.2}   p50 {}  p90 {}  p99 {}",
                sp(&resid, &nlocs),
                pct(&resid, 0.5),
                pct(&resid, 0.9),
                pct(&resid, 0.99)
            );
            println!("    band medians (cognitive): {med:?}");
            if !grade.is_empty() {
                let mut gres = Vec::new();
                let mut gg = Vec::new();
                for (i, l) in glocs.iter().enumerate() {
                    if *l >= 10 {
                        gres.push((gcog[i] * 100) / med[bucket(*l)]);
                        gg.push(grade[i]);
                    }
                }
                if !gres.is_empty() {
                    println!("    surprise vs RESIDUAL {:.2}  ({} read fns >=10 lines)",
                        sp(&gg, &gres), gres.len());
                }
            }
        }
        if !nlocs.is_empty() {
            println!(
                "  >=10 lines ({} fns, {:.0}% of all):  branches vs lines {:.2}   DENSITY vs lines {:.2}   at zero {:.0}%",
                nlocs.len(),
                100.0 * nlocs.len() as f64 / locs.len() as f64,
                sp(&nbr, &nlocs),
                sp(&nden, &nlocs),
                flat(&nbr),
            );
        }
        if !grade.is_empty() {
            println!(
                "  CONTROL ({} read): surprise vs lines {:.2} | vs branches {:.2} | vs cognitive {:.2} | vs DENSITY {:.2}",
                grade.len(),
                sp(&grade, &glocs),
                sp(&grade, &gbr),
                sp(&grade, &gcog),
                sp(&grade, &gden)
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The calls found in the file's single function, in the order they appear.
    fn calls(lang: Lang, src: &str) -> Vec<String> {
        let fns = parse_functions(lang, src);
        assert_eq!(fns.len(), 1, "the call fixtures hold exactly one function: {lang:?}");
        fns[0].calls.clone()
    }

    /// One fixture per language whose call shape has been read off its grammar.
    ///
    /// **The point of this test is that it goes RED rather than quiet.** `call_sites` matches
    /// node kinds literally, so a grammar bump that renames `call_expression` makes every call
    /// in that language vanish — and a language with no edges is drawn exactly like a language
    /// whose functions nothing calls, which is a finding rather than a blank. Every fixture
    /// exercises the three shapes that broke during development: a bare call, a call through a
    /// receiver (the receiver must be dropped), and whatever that language does with a
    /// qualified or constructed name.
    #[test]
    fn every_resolving_language_finds_its_calls() {
        assert_eq!(calls(Lang::Rust, "fn a(){ b(); self.c(); T::d(); }"), ["b", "c", "d"]);
        assert_eq!(
            calls(Lang::TypeScript, "function a(){ b(); x.y.c(); new D(); }"),
            ["b", "c", "D"]
        );
        assert_eq!(calls(Lang::Tsx, "function a(){ b(); x.c(); }"), ["b", "c"]);
        // A component is invoked by being written, not by being called.
        assert_eq!(
            calls(Lang::Tsx, "function a(){ return <Outer x={f()}><Inner/></Outer>; }"),
            ["Outer", "f", "Inner"]
        );
        assert_eq!(calls(Lang::JavaScript, "function a(){ b(); new C(); }"), ["b", "C"]);
        assert_eq!(calls(Lang::Python, "def a():\n  b()\n  x.y.c()\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Go, "func a(){ b(); x.C() }"), ["b", "C"]);
        assert_eq!(calls(Lang::C, "int a(){ b(); s->c(); return 0; }"), ["b", "c"]);
        // `std::make_unique<T>()` is the reason `callee_name` follows fields instead of
        // taking the last identifier: the last identifier here is the template ARGUMENT.
        assert_eq!(
            calls(Lang::Cpp, "int a(){ b(); std::make_unique<Widget>(); }"),
            ["b", "make_unique"]
        );
        assert_eq!(
            calls(Lang::Java, "class K { void a(){ b(); x.c(); new D(); } }"),
            ["b", "c", "D"]
        );
        assert_eq!(
            calls(Lang::CSharp, "class K { void a(){ b(); x.c(); new D(); } }"),
            ["b", "c", "D"]
        );
        assert_eq!(calls(Lang::Ruby, "def a\n b()\n x.c\nend\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Swift, "func a(){ b(); x.c() }"), ["b", "c"]);
        assert_eq!(calls(Lang::Kotlin, "fun a(){ b(); x.c() }"), ["b", "c"]);
        assert_eq!(calls(Lang::Lua, "function a() b() x.c() y:d() end"), ["b", "c", "d"]);
        assert_eq!(
            calls(Lang::Php, "<?php function a(){ b(); $x->c(); D::e(); }"),
            ["b", "c", "e"]
        );
        assert_eq!(calls(Lang::Scala, "def a() = { b(); x.c() }"), ["b", "c"]);
        assert_eq!(calls(Lang::Dart, "void a(){ b(); x.c(); }"), ["b", "c"]);
        assert_eq!(calls(Lang::Zig, "fn a() void { b(); x.c(); }"), ["b", "c"]);

        assert_eq!(
            calls(Lang::GdScript, "func a():\n\tb()\n\tx.c()\n\tD.new()\n"),
            ["b", "c", "new"]
        );
        assert_eq!(calls(Lang::GdShader, "void a(){ b(); }"), ["b"]);
        assert_eq!(calls(Lang::Glsl, "void a(){ b(); }"), ["b"]);
        assert_eq!(calls(Lang::Hlsl, "void a(){ b(); }"), ["b"]);
        assert_eq!(calls(Lang::Slang, "void a(){ b(); }"), ["b"]);
        assert_eq!(
            calls(Lang::Qml, "Item {\n  function a(){ b(); x.c(); new D(); }\n}\n"),
            ["b", "c", "D"]
        );
        assert_eq!(calls(Lang::Cfml, "function a(){ b(); x.c(); }"), ["b", "c"]);
        assert_eq!(calls(Lang::Luau, "function a() b() x.c() y:d() end"), ["b", "c", "d"]);
        assert_eq!(calls(Lang::Shell, "a() {\n  b\n  c arg\n}\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Zsh, "a() {\n  b\n  c arg\n}\n"), ["b", "c"]);
        // `def` itself is a call, and the function node is the one place it must not count.
        assert_eq!(calls(Lang::Elixir, "def a do\n  b()\n  X.c()\nend\n"), ["b", "c"]);
        assert_eq!(
            calls(Lang::ObjC, "@implementation K\n- (void)a { b(); [x c:1 d:2]; }\n@end\n"),
            ["b", "c"]
        );
        assert_eq!(calls(Lang::Haskell, "a x = b (M.c x)\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Elm, "a = b (c 1)\n"), ["b", "c"]);
        assert_eq!(calls(Lang::R, "a <- function() { b(); x$c() }\n"), ["b", "c"]);
        // The signature is a call expression, so `a` must not appear in its own list.
        assert_eq!(calls(Lang::Julia, "function a(x)\n  b()\n  X.c()\nend\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Erlang, "a() -> b(), x:c().\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Groovy, "def a() { b(); x.c(); new D() }\n"), ["b", "c", "D"]);
        assert_eq!(calls(Lang::Gleam, "fn a() { b() c.d() }\n"), ["b", "d"]);
        assert_eq!(calls(Lang::Odin, "a :: proc() { b(); x.c() }\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Perl, "sub a { b(); c 1; $x->d(); &e(); }\n"), ["b", "c", "d", "e"]);
        assert_eq!(calls(Lang::D, "void a(){ b(); x.c(); }\n"), ["b", "c"]);
        assert_eq!(
            calls(Lang::Solidity, "contract K { function a() public { b(); x.c(); } }\n"),
            ["b", "c"]
        );
        assert_eq!(calls(Lang::FSharp, "let a () =\n    b ()\n    x.c ()\n"), ["b", "c"]);
        assert_eq!(calls(Lang::OCaml, "let a x = b (M.c x)\n"), ["b", "c"]);
        assert_eq!(
            calls(Lang::VisualBasic, "Class K\n Sub A()\n  B()\n  x.C()\n End Sub\nEnd Class\n"),
            ["B", "C"]
        );
        assert_eq!(calls(Lang::PowerShell, "function a {\n  b\n  c 1\n}\n"), ["b", "c"]);
        assert_eq!(
            calls(Lang::Pascal, "procedure a;\nbegin\n  b();\n  x.c();\nend;\n"),
            ["b", "c"]
        );
        assert_eq!(
            calls(Lang::Ada, "procedure A is\nbegin\n  B;\n  X := C (1);\nend A;\n"),
            ["B", "C"]
        );
        assert_eq!(calls(Lang::Starlark, "def a():\n  b()\n  x.c()\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Nix, "{ a = x: b (c x); }\n"), ["b", "c"]);
        assert_eq!(
            calls(Lang::Fortran, "subroutine a()\n  call b()\n  x = c(1)\nend subroutine\n"),
            ["b", "c"]
        );
        // The lisps: the definition form is the function node and cannot count as a call,
        // and the parameter list must not be read as one either.
        assert_eq!(calls(Lang::Clojure, "(defn a [] (b) (x/c))\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Scheme, "(define (a) (b) (c 1))\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Racket, "(define (a) (b) (c 1))\n"), ["b", "c"]);
        assert_eq!(calls(Lang::CommonLisp, "(defun a (x)\n  (b)\n  (c 1))\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Elisp, "(defun a (x y)\n  (b)\n  (c 1))\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Cmake, "function(a)\n  b()\n  c(1)\nendfunction()\n"), ["b", "c"]);
        assert_eq!(calls(Lang::Prolog, "a(X) :- b(X), c(X, 1).\n"), ["b", "c"]);
    }

    /// A call name is only useful if it can be spelled the way the definition was.
    ///
    /// The resolver matches strings, so a character the parse admits on one side and refuses
    /// on the other drops the edge without a trace — see [`is_identifier`], which was
    /// `[A-Za-z0-9_]` for every language until a PowerShell suite came back reporting one
    /// call across nine functions of `Write-Output`.
    #[test]
    fn a_name_may_hold_what_that_language_lets_a_name_hold() {
        assert_eq!(
            calls(Lang::PowerShell, "function Install-All {\n  Install-Tool\n}\n"),
            ["Install-Tool"]
        );
        assert_eq!(calls(Lang::Shell, "a() {\n  docker-compose up\n}\n"), ["docker-compose"]);
        assert_eq!(calls(Lang::Ruby, "def a\n  save!\n  valid?\nend\n"), ["save!", "valid?"]);
        assert_eq!(calls(Lang::R, "a <- function() as.data.frame(1)\n"), ["as.data.frame"]);
        assert_eq!(
            calls(Lang::Clojure, "(defn a [] (do-thing) (empty? x))\n"),
            ["do-thing", "empty?"]
        );
        // The first character stays alphabetic in every language, which is what keeps a
        // flag, a negative number and a bare operator out of the symbol table.
        assert_eq!(calls(Lang::Shell, "a() {\n  ls --color\n}\n"), ["ls"]);
        assert_eq!(calls(Lang::Clojure, "(defn a [] (+ 1 2) (b))\n"), ["b"]);
    }

    /// A language nobody has read the call shape of reports nothing, and says which it is.
    ///
    /// The two states this asserts are the whole honesty of the Reach lens: SQL parses
    /// perfectly well and yields no calls, and the ONLY thing separating that from a SQL
    /// repo where nothing calls anything is `resolves_calls` saying so out loud.
    ///
    /// The fixture was Fortran until Fortran was wired. What is left unwired is deliberate
    /// rather than pending: a stored procedure calling another is not the dependency this
    /// lens is about, and Verilog's real wiring is module instantiation, which is a
    /// different graph from a call. Read the fixture as "some language will always be
    /// here", not as a queue.
    #[test]
    fn a_language_with_no_call_shape_says_so_rather_than_reporting_zero() {
        assert!(!resolves_calls(Lang::Sql));
        assert!(resolves_calls(Lang::Rust));
        let f = parse_functions(
            Lang::Sql,
            "CREATE FUNCTION a() RETURNS int AS $$ SELECT b(); $$ LANGUAGE sql;\n",
        );
        assert!(f.first().is_none_or(|f| f.calls.is_empty()));
    }

    /// One edge per callee, however many times the body says it.
    #[test]
    fn a_call_made_forty_times_is_one_dependency() {
        let src = "fn a(){ push(1); push(2); push(3); pop(); }";
        assert_eq!(calls(Lang::Rust, src), ["push", "pop"]);
    }

    /// Nothing that is not a name may enter the symbol table.
    ///
    /// The resolver matches on strings, so an operator or a literal arriving as a "call name"
    /// is a token two unrelated functions could be joined through.
    #[test]
    fn only_identifiers_become_call_names() {
        let found = calls(Lang::Rust, "fn a(){ (|x| x)(1); b(); }");
        assert!(found.iter().all(|n| is_identifier(Lang::Rust, n)), "{found:?}");
        assert!(found.contains(&"b".to_string()));
    }

    /// The list rides in `scancache`, so it cannot be unbounded.
    #[test]
    fn the_call_list_is_capped() {
        let body: String = (0..MAX_CALLS + 40).map(|i| format!("f{i}(); ")).collect();
        assert_eq!(calls(Lang::Rust, &format!("fn a(){{ {body} }}")).len(), MAX_CALLS);
    }

    /// A tree deep enough to exhaust the stack is walked, not recursed.
    ///
    /// The twin of `a_deeply_nested_file_does_not_overflow_the_stack`, which covers `collect`.
    /// Both walk the same trees, so a fix to one that is not applied to the other leaves the
    /// crash exactly where it was — reachable from any real file that nests this far.
    #[test]
    fn a_deeply_nested_body_does_not_overflow_the_call_walk() {
        let chain = "1 + ".repeat(40_000);
        let src = format!("fn deep() {{ let x = {chain}1; helper(); }}");
        assert_eq!(calls(Lang::Rust, &src), ["helper"]);
    }

    /// Identical bytes must yield an identical list, or the cache rewrites itself on every
    /// open and `PARSE_VERSION` stops meaning anything.
    #[test]
    fn the_call_list_is_deterministic_and_in_document_order() {
        let src = "fn a(){ first(); { second(); } third(); }";
        assert_eq!(calls(Lang::Rust, src), ["first", "second", "third"]);
        assert_eq!(calls(Lang::Rust, src), calls(Lang::Rust, src));
    }

    fn names(lang: Lang, src: &str) -> Vec<String> {
        parse_functions(lang, src).into_iter().map(|f| f.name).collect()
    }

    #[test]
    fn rust_functions_and_doc_comments() {
        let src = r#"
/// Adds two numbers.
/// Second line.
#[inline]
fn add(a: u32, b: u32) -> u32 {
    a + b
}

fn undocumented() {
    let f = || 1;
}
"#;
        let fns = parse_functions(Lang::Rust, src);
        assert_eq!(fns.len(), 2, "closures must not become their own wedges");
        assert_eq!(fns[0].name, "add");
        assert_eq!(fns[0].doc.as_deref(), Some("Adds two numbers.\nSecond line."));
        assert_eq!(fns[0].signature, "fn add(a: u32, b: u32) -> u32");
        assert!(fns[1].doc.is_none());
    }

    #[test]
    fn a_blank_line_severs_a_comment_from_the_function() {
        // Otherwise every file's license header documents its first function.
        let src = "// SPDX-License-Identifier: MIT\n\nfn thing() { }\n";
        assert!(parse_functions(Lang::Rust, src)[0].doc.is_none());
    }

    #[test]
    fn typescript_arrow_consts_and_methods() {
        let src = r#"
/** The component. */
export const Panel = ({ x }: Props) => {
  return <div>{x}</div>
}

const NOT_A_FUNCTION = 42

class Store {
  load() { return 1 }
}
"#;
        let got = names(Lang::Tsx, src);
        assert!(got.contains(&"Panel".to_string()), "got {got:?}");
        assert!(got.contains(&"load".to_string()), "got {got:?}");
        assert!(!got.contains(&"NOT_A_FUNCTION".to_string()), "got {got:?}");

        let panel =
            parse_functions(Lang::Tsx, src).into_iter().find(|f| f.name == "Panel").unwrap();
        assert_eq!(panel.doc.as_deref(), Some("The component."));
    }

    /// Rust says which comments are the module's own, so nothing has to be guessed.

    #[test]
    fn rust_module_docs_are_the_file_doc() {
        let src =
            "//! The gate module.\n//! Opens and closes.\n\n/// Opens it.\npub fn open() {}\n";
        assert_eq!(
            file_doc(Lang::Rust, src).as_deref(),
            Some("The gate module.\nOpens and closes.")
        );
        // And the function keeps its own, undisturbed: the two docs are different fields
        // of the payload and the same sentence must never arrive in both.
        assert_eq!(parse_functions(Lang::Rust, src)[0].doc.as_deref(), Some("Opens it."));
    }

    /// A `///` run above the first item belongs to that item, wherever it sits in the file.
    #[test]
    fn rust_item_docs_are_not_the_file_doc() {
        let src = "/// Opens it.\npub fn open() {}\n";
        assert_eq!(file_doc(Lang::Rust, src), None);
    }

    /// The one comment every file has, and the one that explains nothing.
    ///
    /// A license at the top of a file would otherwise become the module header of most of
    /// the open-source world — priced per reading, identical across every file in the repo,
    /// and describing none of them.
    #[test]
    fn a_license_header_is_not_documentation() {
        let src =
            "// Copyright 2019 Someone\n// Licensed under the Apache License.\n\nfunc go() {}\n";
        assert_eq!(file_doc(Lang::Go, src), None);
    }

    /// The adjacency rule, from the other side of `leading_doc`.
    ///
    /// A comment run with no blank line under it is the first item's doc comment, and
    /// `leading_doc` is about to hand it over as exactly that. Taken here as well, the same
    /// sentence would reach the reader twice in one payload, which reads as emphasis.
    #[test]
    fn a_comment_attached_to_the_first_item_is_not_the_file_doc() {
        let attached = "// Goes.\nfunc go() {}\n";
        assert_eq!(file_doc(Lang::Go, attached), None);
        let detached = "// The gate package.\n\n// Goes.\nfunc go() {}\n";
        assert_eq!(file_doc(Lang::Go, detached).as_deref(), Some("The gate package."));
    }

    /// The header sits UNDER the imports in most of the world, and that is where it was
    /// being missed.
    ///
    /// Found from the far end by a wave of readers: every `.tsx` file in this repo was
    /// handed over with an empty header, so file readings were being asked to predict from
    /// the one input the task tells them to use and grading `documented: none` against text
    /// they could only see after opening. Four readers reported it independently.
    #[test]
    fn a_header_below_the_imports_is_still_the_file_doc() {
        let src = "import { a } from './a'\nimport { b } from './b'\n\n\
                   /** Opening one file's wedge into a fan. */\n\n\
                   /** A wedge as a rectangle. */\nexport interface Sector { a0: number }\n";
        assert_eq!(
            file_doc(Lang::TypeScript, src).as_deref(),
            Some("Opening one file's wedge into a fan."),
            "the run under the imports is the header; the one touching the declaration is its doc"
        );
    }

    /// A shebang must not eat the module docstring beneath it.
    ///
    /// Comments are NAMED nodes in tree-sitter-python, so `named_child(0)` was the `#!`
    /// line and every script with one read as undocumented at file level.
    #[test]
    fn a_shebang_does_not_hide_a_python_module_docstring() {
        let src = "#!/usr/bin/env python3\n\"\"\"Generate the placeholder app icon.\"\"\"\n\n\
                   def go(n):\n    return n\n";
        assert_eq!(
            file_doc(Lang::Python, src).as_deref(),
            Some("Generate the placeholder app icon.")
        );
    }

    /// Python's module header is a docstring, by the same rule a function's is.
    #[test]
    fn python_module_docstrings_are_the_file_doc() {
        let src = "\"\"\"The gate module.\"\"\"\n\n\ndef go(n):\n    return n\n";
        assert_eq!(file_doc(Lang::Python, src).as_deref(), Some("The gate module."));
    }

    /// Truncation is MARKED. A header cut off mid-sentence that looks complete is a reader
    /// predicting confidently from half a description — see `FILE_DOC_MAX`.
    #[test]
    fn a_long_header_is_cut_and_says_so() {
        let long = "word ".repeat(400);
        let src = format!("//! {long}\n\npub fn go() {{}}\n");
        let doc = file_doc(Lang::Rust, &src).unwrap();
        assert!(doc.chars().count() <= FILE_DOC_MAX + 2, "bounded: {}", doc.chars().count());
        assert!(doc.ends_with('…'), "a truncated header says it was truncated");
    }

    #[test]
    fn python_docstrings_are_the_doc() {
        let src = "def go(n):\n    \"\"\"Runs the thing.\"\"\"\n    return n + 1\n";
        let fns = parse_functions(Lang::Python, src);
        assert_eq!(fns[0].name, "go");
        assert_eq!(fns[0].doc.as_deref(), Some("Runs the thing."));
    }

    #[test]
    fn go_methods_and_functions() {
        let src = "func Add(a int) int { return a }\nfunc (s *S) Load() error { return nil }\n";
        let got = names(Lang::Go, src);
        assert_eq!(got, vec!["Add", "Load"]);
    }

    /// A name is not an identity, and the twins are the reason.
    ///
    /// A real UDF parser holds one `parse` per descriptor type in a single file. A reader
    /// handed `udf.rs#parse`, with `parse` in the sibling list too, cannot tell which one
    /// it has — so it predicts one function, reads another, and reports the docs as
    /// belonging to something else. That is a finding the instrument invented.
    #[test]
    fn a_method_is_qualified_by_the_type_it_hangs_off() {
        let src = r#"
struct Tag;
impl Tag {
    fn parse(b: &[u8]) -> Tag { Tag }
}
impl LogicalVolumeDescriptor {
    fn parse(b: &[u8]) -> Self { todo!() }
}
impl Read for Tag {
    fn read(&self) -> u8 { 0 }
}
trait Descriptor {
    fn tag(&self) -> u16 { 0 }
}
fn free_standing() -> u8 { 0 }
"#;
        let fns = parse_functions(Lang::Rust, src);
        let owners: Vec<Option<&str>> = fns.iter().map(|f| f.owner.as_deref()).collect();
        assert_eq!(
            owners,
            vec![
                Some("Tag"),
                Some("LogicalVolumeDescriptor"),
                // `impl Trait for Type` belongs to the type, not the trait.
                Some("Tag"),
                Some("Descriptor"),
                None,
            ]
        );
    }

    #[test]
    fn owners_across_the_languages_that_claim_one() {
        let owner = |lang, src| parse_functions(lang, src)[0].owner.clone();
        assert_eq!(
            owner(Lang::Python, "class Suggester:\n    def next(self):\n        return 1\n"),
            Some("Suggester".into())
        );
        assert_eq!(
            owner(Lang::Swift, "struct Context {\n    func next() -> Int { 0 }\n}\n"),
            Some("Context".into())
        );
        assert_eq!(
            owner(Lang::TypeScript, "class Store {\n  load(): void {}\n}\n"),
            Some("Store".into())
        );
        // Go hangs its receiver off the function itself, and `*S` is the same answer as `S`.
        assert_eq!(owner(Lang::Go, "func (s *S) Load() error { return nil }\n"), Some("S".into()));
        // A generic receiver names the type, never its type parameter. Taking the last
        // identifier run returned `T` here, so every method on a generic type was
        // attributed to `T` — and the doc comment claimed otherwise, which is how it was
        // caught: a reader predicted the doc, read the body, and found the gap.
        assert_eq!(
            owner(Lang::Go, "func (p *Parser[T]) Load() error { return nil }\n"),
            Some("Parser".into())
        );
        // A free function has no owner, and must not borrow the file's.
        assert_eq!(owner(Lang::Rust, "fn free() {}\n"), None);
    }

    /// A nested type names its whole path, because the innermost name may say nothing.
    ///
    /// ComfyUI declares its entire API as `class Boolean: class Input: def as_dict`, once
    /// per data type — so stopping at the nearest enclosing class reported `Input` for
    /// thirty different methods in one file and a reader could not tell which it held.
    /// That is precisely the ambiguity `owner` exists to remove, one level further out.
    #[test]
    fn a_nested_owner_names_its_whole_path() {
        let src = "class Boolean:\n    class Input:\n        def as_dict(self):\n            return 1\n\nclass Image:\n    class Input:\n        def as_dict(self):\n            return 2\n";
        let fns = parse_functions(Lang::Python, src);
        let owners: Vec<Option<&str>> = fns.iter().map(|f| f.owner.as_deref()).collect();
        assert_eq!(
            owners,
            vec![Some("Boolean.Input"), Some("Image.Input")],
            "two same-named methods on two same-named inner classes must stay apart"
        );

        // One level is still one level — no trailing path where there is no nesting.
        assert_eq!(
            parse_functions(
                Lang::Python,
                "class Suggester:\n    def next(self):\n        return 1\n"
            )[0]
            .owner
            .as_deref(),
            Some("Suggester")
        );
    }

    #[test]
    fn unparseable_input_yields_nothing_rather_than_panicking() {
        assert!(parse_functions(Lang::Rust, "fn (((").is_empty());
        assert!(parse_functions(Lang::Go, "").is_empty());
    }

    /// A file deep enough to overflow a worker's stack yields functions instead of killing
    /// the process.
    ///
    /// `collect` recursed on syntax depth, which reads as bounded and is not: tree-sitter-c
    /// left-nests a `binary_expression` per operator, so a generated table with a couple of
    /// thousand `|`s in one statement is a chain that many deep, and `#elif` and `else if`
    /// chains and ERROR recovery all nest the same way. Scanning linux aborted the whole app
    /// from a rayon worker, whose 2 MiB stack is a quarter of the main thread's — a stack
    /// overflow is not a panic, so nothing unwound, no file was blamed and the window was
    /// left showing the phase before.
    ///
    /// **Run on a thread with a stack SMALLER than the workers', on purpose.** The condition
    /// under test is depth against a fixed stack, and a test inheriting whatever
    /// `RUST_MIN_STACK` happens to be would pass or fail by environment. 512 KiB holds a few
    /// thousand of the old frames; 50,000 terms is an order of magnitude past that and
    /// nothing at all to a cursor walk.
    #[test]
    fn a_deeply_nested_file_does_not_overflow_the_stack() {
        let deep = std::thread::Builder::new()
            .stack_size(512 * 1024)
            .spawn(|| {
                // OUTSIDE a function, which is the only place depth can bite: `collect`
                // stops descending the moment it accepts one, so a chain in a body is
                // never walked and a test that put it there passed against the recursion
                // it was written to catch.
                let chain = vec!["1"; 50_000].join(" | ");
                let src = format!(
                    "static const int table[] = {{ {chain} }};\nint after(void) {{ return 0; }}\n"
                );
                parse_functions(Lang::C, &src)
            })
            .unwrap()
            .join()
            .unwrap();
        assert_eq!(deep.len(), 1, "the function past the deep node is still found");
        assert_eq!(deep[0].name, "after");
    }

    /// Swift, added because a scan of an iOS/macOS project reported eight functions —
    /// all of them in two Python dev scripts — and read as a tidy repo. An unparsed
    /// language is not a gap in the picture, it is a picture of the wrong thing.
    /// A nested type's undocumented member must NOT inherit the enclosing type's doc.
    ///
    /// The doc walk used to climb three parents and take the first comment it found, so
    /// `Context.init` was handed the `SentenceSuggester` class docstring. The reader was
    /// then asked to predict an initializer from a paragraph about filter enforcement,
    /// guessed wrong, and the wedge read hot — a surprise the instrument invented, and
    /// indistinguishable in the output from one it measured.
    #[test]
    fn a_nested_type_does_not_inherit_the_enclosing_docstring() {
        let src = r#"
/// Suggests sentences, and enforces the filtering rules while it does.
class SentenceSuggester {
    struct Context {
        let limit: Int

        init(limit: Int) {
            self.limit = limit
        }
    }

    /// Returns the next suggestion.
    func next() -> String { "x" }

    func untouched() -> Int { 0 }
}
"#;
        let fns = parse_functions(Lang::Swift, src);
        let by = |n: &str| fns.iter().find(|f| f.name == n).expect(n).clone();

        assert_eq!(by("init").doc, None, "an undocumented init has no docs, not its owner's");
        assert_eq!(by("untouched").doc, None, "nor does an undocumented method one level down");
        // The ones that really are documented still are.
        assert!(by("next").doc.unwrap().contains("next suggestion"));
    }

    /// A `.h` holding C++ yields its methods, not its namespace and not its fields.
    ///
    /// `.h` used to map to `Lang::C`, and the C grammar does not fail quietly on C++ —
    /// it invents. Every assertion below is one thing a real repo's headers produced:
    /// a 131-line "function" named after the enclosing namespace, a "function" named
    /// after the field `T v{};`, a class whose span ran to the end of four unrelated
    /// siblings, and another truncated to its first inline member, so the reader could
    /// not see the class it had been asked to grade. Twelve entries from 583 lines,
    /// none of them a function. The mapping lives in `Lang::from_extension`, so this
    /// goes through it rather than naming `Lang::Cpp` — the bug was never in the parse.
    #[test]
    fn a_cpp_header_yields_its_methods_not_its_namespace() {
        let src = r#"
namespace demo {

template <typename T> struct Val {
    T v{};
    Val(T x) : v(x) {}
    void store(T x) { v = x; }
    operator T() const { return v; }
    Val &operator=(T x) {
        v = x;
        return *this;
    }
};

class Lfsr {
public:
    void setWhite(bool w) { white = w; }
    int step() {
        state = (state >> 1);
        return state;
    }
private:
    bool white = false;
    int state = 1;
};

class Other {
public:
    void reset() { n = 0; }
private:
    int n = 0;
};

}
"#;
        let lang = Lang::from_extension("h").expect("`.h` is a language");
        let fns = parse_functions(lang, src);
        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["Val", "store", "operator T() const", "operator=", "setWhite", "step", "reset"]
        );

        // Not the namespace, and not a data member. The constructor `Val(T x) : v(x) {}`
        // used to arrive named after the member its init-list touches.
        assert!(!names.contains(&"demo"), "a namespace is not a function");
        assert!(!names.contains(&"v"), "a field is not a function");

        // The owner is what disambiguates two `reset`s in one header, so it has to be
        // the class rather than the namespace everything shares.
        let by = |n: &str| fns.iter().find(|f| f.name == n).expect(n).clone();
        assert_eq!(by("step").owner.as_deref(), Some("Lfsr"));
        assert_eq!(by("reset").owner.as_deref(), Some("Other"));

        // And a span stops where its function does: `step` must not run on into `Other`,
        // which is the failure that had a reader grading a class it could not see.
        assert!(by("step").end_line < by("reset").start_line);
        assert_eq!(by("step").loc(), 4);
    }

    #[test]
    fn swift_functions_methods_and_inits() {
        let src = r#"
/// Adds two numbers.
func add(a: Int, b: Int) -> Int {
    return a + b
}

struct Thing {
    var name: String

    /// Greets by name.
    func greet() -> String {
        return "hi \(name)"
    }

    init(name: String) {
        self.name = name
    }

    static func make() -> Thing { Thing(name: "x") }
}

extension Thing {
    func extra() {}
}
"#;
        let fns = parse_functions(Lang::Swift, src);
        let names: Vec<&str> = fns.iter().map(|f| f.name.as_str()).collect();
        assert_eq!(names, vec!["add", "greet", "init", "make", "extra"]);

        // Docs and signatures come through the same path as every other language.
        assert_eq!(fns[0].doc.as_deref(), Some("Adds two numbers."));
        assert_eq!(fns[0].signature, "func add(a: Int, b: Int) -> Int");
        assert_eq!(fns[1].doc.as_deref(), Some("Greets by name."));

        // A method in an extension is still that method, not a wedge of the extension.
        assert!(fns.iter().all(|f| !f.name.contains("extension")));
    }

    /// One case per language, asserting NAMES.
    ///
    /// The failure this exists to catch is silent: a grammar whose node kinds or field
    /// names differ from the guess returns an empty list, and an empty list is
    /// indistinguishable from a file with no functions in it. A language that scores
    /// nothing does not look broken on the map — it looks clean. Every one of these was
    /// derived by probing the grammar, and three of them were wrong on first guess.
    #[test]
    fn every_language_finds_its_functions() {
        let cases: Vec<(Lang, &str, Vec<&str>)> = vec![
            (Lang::C, "int add(int a) { return a; }\nstatic void go(void) { }\n", vec!["add", "go"]),
            (
                Lang::Cpp,
                "int add(int a){return a;}\nclass K { public: void m() { } };\n",
                vec!["add", "m"],
            ),
            (Lang::Shell, "greet() {\n  echo hi\n}\n", vec!["greet"]),
            (
                Lang::Sql,
                "CREATE FUNCTION add(a int) RETURNS int AS $$ SELECT a $$ LANGUAGE sql;",
                vec!["add"],
            ),
            (Lang::Java, "class A { int add(int a){ return a; } A(){} }", vec!["add", "A"]),
            (Lang::Kotlin, "fun add(a: Int): Int { return a }", vec!["add"]),
            (Lang::CSharp, "class A { int Add(int a) { return a; } public A() {} }", vec!["Add", "A"]),
            (Lang::Ruby, "def add(a)\n  a\nend\n", vec!["add"]),
            (Lang::Php, "<?php\nfunction add($a) { return $a; }\n", vec!["add"]),
            (Lang::Lua, "function add(a)\n  return a\nend\n", vec!["add"]),
            (Lang::Elixir, "defmodule M do\n  def add(a) do\n    a\n  end\nend\n", vec!["add"]),
            (Lang::Scala, "object O { def add(a: Int): Int = { a } }", vec!["add"]),
            (Lang::Dart, "int add(int a) { return a; }", vec!["add"]),
            (Lang::Zig, "fn add(a: i32) i32 { return a; }", vec!["add"]),
            (
                Lang::ObjC,
                "@implementation A\n- (int)add:(int)a { return a; }\n@end\n",
                vec!["add"],
            ),
            (
                Lang::GdScript,
                "extends Node\n\nfunc _ready() -> void:\n\tpass\n\nfunc add(a: int) -> int:\n\treturn a\n",
                vec!["_ready", "add"],
            ),
            (Lang::GdShader, "void fragment() {\n  COLOR = vec4(1.0);\n}\n", vec!["fragment"]),
            (Lang::Glsl, "int add(int a) {\n  return a;\n}\n", vec!["add"]),
            (Lang::Hlsl, "int add(int a) {\n  return a;\n}\n", vec!["add"]),
            (Lang::Slang, "int add(int a) {\n  return a;\n}\n", vec!["add"]),
            (Lang::Haskell, "add :: Int -> Int\nadd a = a + 1\n", vec!["add"]),
            (Lang::Nix, "{ add = a: a + 1; }\n", vec!["add"]),
            (
                Lang::PowerShell,
                "function Add-Thing {\n  param($a)\n  return $a\n}\n",
                vec!["Add-Thing"],
            ),
            (
                Lang::Solidity,
                "contract C {\n  function add(uint a) public returns (uint) { return a; }\n}\n",
                vec!["add"],
            ),
            (Lang::R, "add <- function(a) {\n  a + 1\n}\n", vec!["add"]),
            (Lang::OCaml, "let add a = a + 1\nlet x = 5\n", vec!["add"]),
            (Lang::OCamlLex, "rule token = parse\n  | \"a\" { A }\n", vec!["token"]),
            (
                Lang::Cmake,
                "function(add a)\n  message(${a})\nendfunction()\n",
                vec!["add"],
            ),
            (Lang::Julia, "function add(a)\n  a + 1\nend\n", vec!["add"]),
            (Lang::Erlang, "-module(m).\nadd(A) -> A + 1.\n", vec!["add"]),
            (
                Lang::Pascal,
                "function Add(a: Integer): Integer;\nbegin\n  Add := a;\nend;\n",
                vec!["Add"],
            ),
            (Lang::Clojure, "(defn add [a] (+ a 1))\n", vec!["add"]),
            (Lang::FSharp, "let add a =\n  a + 1\n", vec!["add"]),
            (Lang::Groovy, "def add(a) {\n  return a\n}\n", vec!["add"]),
            (Lang::Elm, "add : Int -> Int\nadd a =\n  a + 1\n", vec!["add"]),
            (
                Lang::Fortran,
                "function add(a)\n  integer :: a\n  add = a\nend function add\n",
                vec!["add"],
            ),
            (Lang::Starlark, "def add(a):\n    return a\n", vec!["add"]),
            (
                Lang::Verilog,
                "module m;\nfunction integer add(input integer a);\nbegin add = a; end\nendfunction\nendmodule\n",
                vec!["add"],
            ),
            (
                Lang::SystemVerilog,
                "module m;\nfunction int add(input int a);\n  return a;\nendfunction\nendmodule\n",
                vec!["add"],
            ),
            (Lang::Gleam, "pub fn add(a: Int) -> Int {\n  a + 1\n}\n", vec!["add"]),
            (Lang::Odin, "add :: proc(a: int) -> int {\n  return a\n}\n", vec!["add"]),
            (Lang::Perl, "sub add {\n  return 1;\n}\n", vec!["add"]),
            (
                Lang::VisualBasic,
                "Module M\n  Function Add(a As Integer) As Integer\n    Return a\n  End Function\nEnd Module\n",
                vec!["Add"],
            ),
            (Lang::Elisp, "(defun add (a)\n  \"Docs.\"\n  (+ a 1))\n", vec!["add"]),
            (
                Lang::Qml,
                "Item {\n  function add(a) { return a }\n}\n",
                vec!["add"],
            ),
            (Lang::Scheme, "(define (add a) (+ a 1))\n(define x 5)\n", vec!["add"]),
            (Lang::Racket, "(define (add a) (+ a 1))\n(define x 5)\n", vec!["add"]),
            (Lang::CommonLisp, "(defun add (a) (+ a 1))\n", vec!["add"]),
            (Lang::Cfml, "function add(a) {\n  return a;\n}\n", vec!["add"]),
            (
                Lang::Ada,
                "function Add(A : Integer) return Integer is\nbegin\n  return A;\nend Add;\n",
                vec!["Add"],
            ),
            (Lang::D, "int add(int a) {\n  return a;\n}\n", vec!["add"]),
            (
                Lang::Vhdl,
                "architecture a of e is\n  function add(x: integer) return integer is\n  begin\n    return x;\n  end function;\nbegin\nend architecture;\n",
                vec!["add"],
            ),
            (Lang::Zsh, "add() {\n  echo 1\n}\n", vec!["add"]),
            (Lang::Luau, "function add(a)\n  return a\nend\n", vec!["add"]),
            (Lang::Prolog, "add(A, B) :- B is A + 1.\nfact(x).\n", vec!["add"]),
            (Lang::Jq, "def add(a): a + 1;\n", vec!["add"]),
        ];
        // Every language is checked before anything fails. Asserting per case stops at the
        // first one, and with this many grammars that turns "which languages are broken?"
        // into one bisect per language.
        let mut broken = Vec::new();
        for (lang, src, want) in cases {
            let got: Vec<String> = parse_functions(lang, src).into_iter().map(|f| f.name).collect();
            if got != want {
                broken.push(format!("{}: wanted {:?}, got {:?}", lang.label(), want, got));
            }
        }
        assert!(broken.is_empty(), "grammars parsed the wrong chunks:\n{}", broken.join("\n"));
    }

    /// A container must never become a wedge. Listing `class_declaration` alongside the
    /// method kinds parses, and quietly makes one chunk out of the entire class — every
    /// method's lines counted twice and the class's own score an average of its parts.
    #[test]
    fn classes_are_not_chunks() {
        let fns = parse_functions(Lang::Java, "class Big { void a(){} void b(){} }");
        assert_eq!(fns.len(), 2, "the class itself must not be a chunk");
        // With a body — an EMPTY Ruby method has no body node at all, so it is dropped
        // for having nothing to measure, which is correct and not what this is testing.
        let fns = parse_functions(Lang::Ruby, "class C\n  def a\n    1\n  end\nend\n");
        assert_eq!(fns.len(), 1);
    }
}
