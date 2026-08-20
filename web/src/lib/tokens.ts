// Shared by the code view and by the panel's snippets, so the two colour the same source
// the same way. It was defined inside `CodeView`, which made a second copy the price of
// showing code anywhere else — and a second approximate tokenizer would drift from this one
// in exactly the places approximation shows.

/**
 * Rough syntax highlighting for the six languages the scanner parses.
 *
 * Deliberately a small tokenizer and not a highlighting library. What this view is for
 * is READING HEAT — the color that matters is the heat gutter, and syntax is scenery
 * that stops the page looking like a log file. A real highlighter would be a dependency,
 * a bundle, and a second grammar to keep in step with the tree-sitter ones that already
 * decide what a function is.
 *
 * It is approximate and says so: it does not track state across lines, so a multi-line
 * string containing `//` will mis-color. That is an acceptable failure for scenery and
 * would not be for the metric.
 */
export const KEYWORDS =
  /^(?:fn|let|const|var|mut|pub|use|mod|impl|struct|enum|trait|match|if|else|for|while|loop|return|break|continue|async|await|move|where|type|dyn|ref|self|Self|crate|super|as|in|function|class|extends|interface|export|import|from|default|new|this|typeof|instanceof|void|null|undefined|true|false|def|elif|lambda|pass|raise|try|except|finally|with|yield|global|nonlocal|None|True|False|and|or|not|is|package|func|go|defer|chan|range|select|switch|case|map|nil|var)$/

export type Tok = { text: string; cls: string }

export function tokenize(line: string): Tok[] {
  const out: Tok[] = []
  // One pass, longest-match-first: comments and strings have to win over everything
  // else, or a `//` inside a string ends the line.
  const re =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\w.]*\b)|([A-Za-z_$][\w$]*)|(\s+)|([^\s\w])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const [text, comment, str, num, word, space] = m
    if (comment) out.push({ text, cls: 'tok-comment' })
    else if (str) out.push({ text, cls: 'tok-string' })
    else if (num) out.push({ text, cls: 'tok-num' })
    else if (word) out.push({ text, cls: KEYWORDS.test(word) ? 'tok-key' : 'tok-plain' })
    else if (space) out.push({ text, cls: 'tok-plain' })
    else out.push({ text, cls: 'tok-punct' })
  }
  return out
}
