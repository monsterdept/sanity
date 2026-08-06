//! Source → functions, via tree-sitter.
//!
//! We walk the tree with a cursor and match node *kinds* rather than running a
//! tree-sitter query per language. Queries are the idiomatic route, but their syntax
//! and the grammars' capture names drift between grammar releases, and a query that
//! silently matches nothing produces a repo with no inner ring and no error — the worst
//! possible failure for this app, because an empty result looks like a clean codebase.
//! Kind matching fails loudly instead: if a grammar renames a node, its tests go red.

use crate::model::Lang;
use tree_sitter::{Node as TsNode, Parser};

/// One function, with everything the scorer needs and nothing it doesn't.
#[derive(Debug, Clone)]
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
    }
}

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
    }
}

/// `const Foo = () => {…}` is a function; `const n = 4` is not. Only accept a
/// declarator whose initialiser is itself a function.
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
/// The adjacency check is the whole trick: a licence header at the top of the file is a
/// comment immediately preceding the first function in token order, and counting it as
/// that function's documentation would cool the file's first wedge on every scan.
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
    let mut cur = node;
    while let Some(parent) = cur.parent() {
        if OWNER_KINDS.contains(&parent.kind()) {
            // `impl Foo` and `impl Trait for Foo` both name the owner through `type`; a
            // class or trait names it through `name`. Asking for the wrong one first
            // costs nothing and means neither language needs a branch here.
            let named = parent
                .child_by_field_name("name")
                .or_else(|| parent.child_by_field_name("type"))?;
            return Some(text(named, src).trim().to_string());
        }
        cur = parent;
    }
    None
}

/// Python attaches its documentation *inside* the body, as the first statement.
fn python_docstring(body: TsNode, src: &str) -> Option<String> {
    let first = body.named_child(0)?;
    let expr = if first.kind() == "expression_statement" {
        first.named_child(0)?
    } else {
        first
    };
    (expr.kind() == "string").then(|| {
        text(expr, src)
            .trim_matches(|c| c == '"' || c == '\'')
            .trim()
            .to_string()
    })
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

fn collect(node: TsNode, lang: Lang, kinds: &[&str], src: &str, out: &mut Vec<FuncDef>) {
    if accepts(node, lang, kinds, src) {
        let is_decl = node.kind() == "variable_declarator";
        if !is_decl || declarator_is_function(node) {
            if let Some(f) = extract(node, lang, src) {
                out.push(f);
                // Don't descend: a closure defined inside a function is part of that
                // function's body, not a sibling wedge. Counting both would double the
                // enclosing function's lines and dilute its score with its own guts.
                return;
            }
        }
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect(child, lang, kinds, src, out);
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
    if lang == Lang::Elixir {
        return node
            .child_by_field_name("target")
            .map(|t| matches!(text(t, src), "def" | "defp" | "defmacro" | "defmacrop"))
            .unwrap_or(false);
    }
    true
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
        Lang::C | Lang::Cpp => {
            let mut n = node.child_by_field_name("declarator")?;
            while let Some(inner) = n.child_by_field_name("declarator") {
                n = inner;
            }
            Some(n)
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
            let args = node
                .children(&mut node.walk())
                .find(|c| c.kind() == "arguments")?;
            let first = args.named_child(0)?;
            first.child_by_field_name("target").or(Some(first))
        }
        _ => node.child_by_field_name("name"),
    }
}

/// The node holding the chunk's body.
fn body_node<'a>(node: TsNode<'a>, lang: Lang) -> Option<TsNode<'a>> {
    if let Some(b) = node.child_by_field_name("body") {
        return Some(b);
    }
    let kind = match lang {
        // Kotlin names its function but leaves the body an unnamed child.
        Lang::Kotlin => "function_body",
        Lang::ObjC => "compound_statement",
        Lang::Sql => "function_body",
        Lang::Elixir => "do_block",
        // `const Foo = () => {}` hangs the body off the initialiser, not the declarator.
        _ => {
            return node
                .child_by_field_name("value")
                .and_then(|v| v.child_by_field_name("body"))
        }
    };
    node.children(&mut node.walk()).find(|c| c.kind() == kind)
}

fn extract(node: TsNode, lang: Lang, src: &str) -> Option<FuncDef> {
    let name = text(name_node(node, lang)?, src).to_string();
    let body = body_node(node, lang)?;

    let sig_end = body.start_byte().min(src.len());
    let signature = src.get(node.start_byte()..sig_end)?.trim().to_string();

    let doc = match lang {
        Lang::Python => python_docstring(body, src).or_else(|| leading_doc(node, src)),
        // A `const Foo = …` declarator carries no comment of its own: the doc sits above
        // the enclosing `lexical_declaration`, and above *that* again when the
        // declaration is exported. Walk out through those wrappers — stopping at the
        // first one that has a comment — or every exported arrow-function component in
        // a React codebase reads as undocumented.
        _ => leading_doc(node, src).or_else(|| wrapper_doc(node, src)),
    };

    Some(FuncDef {
        name,
        signature,
        body: text(body, src).to_string(),
        doc,
        owner: owner_of(node, lang, src),
        start_line: node.start_position().row as u32 + 1,
        end_line: node.end_position().row as u32 + 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(lang: Lang, src: &str) -> Vec<String> {
        parse_functions(lang, src)
            .into_iter()
            .map(|f| f.name)
            .collect()
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
        // Otherwise every file's licence header documents its first function.
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

        let panel = parse_functions(Lang::Tsx, src)
            .into_iter()
            .find(|f| f.name == "Panel")
            .unwrap();
        assert_eq!(panel.doc.as_deref(), Some("The component."));
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
        assert_eq!(
            owner(Lang::Go, "func (s *S) Load() error { return nil }\n"),
            Some("S".into())
        );
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

    #[test]
    fn unparseable_input_yields_nothing_rather_than_panicking() {
        assert!(parse_functions(Lang::Rust, "fn (((").is_empty());
        assert!(parse_functions(Lang::Go, "").is_empty());
    }

    /// Swift, added because a scan of an iOS/macOS project reported eight functions —
    /// all of them in two Python dev scripts — and read as a tidy repo. An unparsed
    /// language is not a gap in the picture, it is a picture of the wrong thing.
    /// A nested type's undocumented member must NOT inherit the enclosing type's doc.
    ///
    /// The doc walk used to climb three parents and take the first comment it found, so
    /// `Context.init` was handed the `SentenceSuggester` class docstring. The reader was
    /// then asked to predict an initialiser from a paragraph about filter enforcement,
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
        assert_eq!(
            by("untouched").doc,
            None,
            "nor does an undocumented method one level down"
        );
        // The ones that really are documented still are.
        assert!(by("next").doc.unwrap().contains("next suggestion"));
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
        ];
        for (lang, src, want) in cases {
            let got: Vec<String> = parse_functions(lang, src).into_iter().map(|f| f.name).collect();
            assert_eq!(got, want, "{} parsed the wrong chunks", lang.label());
        }
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
