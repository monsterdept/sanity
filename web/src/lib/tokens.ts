// Shared by the code view and by the panel's snippets, so the two colour the same source
// the same way. It was defined inside `CodeView`, which made a second copy the price of
// showing code anywhere else — and a second approximate tokenizer would drift from this one
// in exactly the places approximation shows.

/**
 * Rough syntax highlighting for the six languages the scanner parses.
 *
 * Deliberately a small tokenizer and not a highlighting library. A real highlighter would be
 * a dependency, a bundle, and a second grammar to keep in step with the tree-sitter ones that
 * already decide what a function is. What this buys instead is a page that reads like code
 * rather than like a log file, for about forty lines and one regex.
 *
 * **It tracks one thing across lines and only one: whether a block comment is open.** That is
 * not a refinement, it is the difference between working and not. A doc comment's body lines
 * start with `*` and are otherwise ordinary prose, so a stateless pass tokenized them as code
 * — `as`, `with`, `in` and `is` came out as keywords inside English sentences, which is the
 * most visible wrongness this file could produce and it was on screen in every doc comment in
 * the repo. Everything else stays stateless and approximate: a `//` inside a multi-line
 * string still mis-colours, which is an acceptable failure for scenery and would not be for
 * the metric.
 */
export const KEYWORDS =
  /^(?:fn|let|const|var|mut|pub|use|mod|impl|struct|enum|trait|match|if|else|for|while|loop|return|break|continue|async|await|move|where|type|dyn|ref|self|Self|crate|super|as|in|function|class|extends|interface|export|import|from|default|new|this|typeof|instanceof|void|null|undefined|true|false|def|elif|lambda|pass|raise|try|except|finally|with|yield|global|nonlocal|None|True|False|and|or|not|is|package|func|go|defer|chan|range|select|switch|case|map|nil|var)$/

export type Tok = { text: string; cls: string }

/** One pass, longest-match-first: comments and strings have to win over everything else, or
 *  a `//` inside a string ends the line. */
const RE =
  /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w])/g

/**
 * A whole file, with block-comment state carried between lines.
 *
 * **The only stateful thing here, and the reason it exists is in the module doc.** A line
 * inside an open block comment is not tokenized at all: it is one comment token, whatever it
 * contains, which is what makes a doc comment read as the prose it is.
 */
export function tokenizeAll(lines: string[]): Tok[][] {
  let open = false
  return lines.map((line) => {
    if (open) {
      const end = line.indexOf('*/')
      if (end === -1) return [{ text: line, cls: 'tok-comment' }]
      open = false
      return [
        { text: line.slice(0, end + 2), cls: 'tok-comment' },
        ...tokenize(line.slice(end + 2)),
      ]
    }
    // A `/*` with no `*/` after it opens one. Checked on the raw line rather than on the
    // tokens, because an unterminated block comment is exactly what the regex cannot match.
    const start = line.lastIndexOf('/*')
    if (start !== -1 && line.indexOf('*/', start) === -1) {
      open = true
      return [...tokenize(line.slice(0, start)), { text: line.slice(start), cls: 'tok-comment' }]
    }
    return tokenize(line)
  })
}

export function tokenize(line: string): Tok[] {
  const out: Tok[] = []
  let m: RegExpExecArray | null
  RE.lastIndex = 0
  while ((m = RE.exec(line))) {
    const [text, comment, str, num, word, space] = m
    if (comment) out.push({ text, cls: 'tok-comment' })
    else if (str) out.push({ text, cls: 'tok-string' })
    else if (num) out.push({ text, cls: 'tok-num' })
    else if (word) out.push({ text, cls: KEYWORDS.test(word) ? 'tok-key' : 'tok-plain' })
    else if (space) out.push({ text, cls: 'tok-plain' })
    else out.push({ text, cls: 'tok-punct' })
  }
  return name(out)
}

/**
 * Two classes a regex cannot give you, from the token AFTER the one being named.
 *
 * **A call and a type are the two things a reader scans for**, and both are plain identifiers
 * to the pass above — so a file came out with only keywords coloured and every name in it the
 * same. `foo(` is a call and `Foo` is a type is the whole heuristic; it is wrong on a Rust
 * tuple struct used as a value and on a Python class called as a constructor, and being wrong
 * there costs a colour rather than a claim.
 */
function name(toks: Tok[]): Tok[] {
  for (let i = 0; i < toks.length; i++) {
    if (toks[i].cls !== 'tok-plain' || !/^[A-Za-z_$]/.test(toks[i].text)) continue
    // The next thing that is not whitespace.
    let j = i + 1
    while (j < toks.length && toks[j].text.trim() === '') j++
    if (toks[j]?.text === '(') toks[i].cls = 'tok-fn'
    else if (/^[A-Z]/.test(toks[i].text)) toks[i].cls = 'tok-type'
  }
  return toks
}
