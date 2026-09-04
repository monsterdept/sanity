import { useEffect, useState } from 'react'
import { Overlay } from './Overlay'
import { CopyButton } from './Prose'
import { FAMILY } from '../lib/labelStyle'
import { tokenizeAll } from '../lib/tokens'

/**
 * A piece of source, small enough to sit in the panel and openable when it isn't.
 *
 * **The panel's lists named functions it could not show you.** A row reading `score_dir ·
 * src/scan.rs` is an instruction to go and look somewhere else, and the whole reason the
 * neighbour lists exist is that going to look somewhere else is what a `14×` already made you
 * do. So each row carries its body: bounded, scrolled inside its own box, and one click from
 * filling the window.
 *
 * Two sizes and no third. The inline box is a glance — is this the caller I meant — and is
 * deliberately short enough that four of them still read as a list rather than as a file. The
 * modal is for reading, and it is a modal rather than a taller box because a panel that grows
 * to fit its longest member has stopped being a panel.
 *
 * Highlighting is the code view's own tokenizer, from `lib/tokens` — approximate, stateless
 * across lines, and scenery. A second approximate tokenizer would drift from that one in
 * exactly the places approximation shows.
 */
/**
 * Take the shared left margin off, so a snippet starts where the panel does.
 *
 * **A method body is indented by its impl block, and the panel is 260 characters wide.**
 * Every line of `Links::len` arrived four spaces in, which is four characters of a very
 * narrow box spent on a relationship to code that is not on screen — the enclosing block is
 * not in the snippet, so the indentation it explains is not information here. What IS
 * information is the shape INSIDE the function, and that survives: the common prefix is
 * removed, never per-line whitespace.
 *
 * The literal shortest common prefix, not a count: a file that mixes tabs and spaces has no
 * meaningful "number of levels", and turning one into the other would reflow somebody's code
 * on the way past. Blank lines are skipped when measuring — a file that ends a function with
 * an empty line would otherwise dedent by nothing.
 */
function dedent(code: string): string {
  const lines = code.split('\n')
  let prefix: string | null = null
  for (const line of lines) {
    if (!line.trim()) continue
    const lead = line.slice(0, line.length - line.trimStart().length)
    if (prefix === null) {
      prefix = lead
      continue
    }
    let i = 0
    while (i < prefix.length && i < lead.length && prefix[i] === lead[i]) i++
    prefix = prefix.slice(0, i)
    if (!prefix) break
  }
  if (!prefix) return code
  const cut = prefix.length
  return lines.map((l) => (l.startsWith(prefix) ? l.slice(cut) : l)).join('\n')
}

export function CodeBlock({
  code: raw,
  title,
  subtitle,
  onOpen,
  startLine,
  highlight = true,
  caveat,
  flush = false,
  height = 'max-h-[9.5rem]',
  maxHeight,
  marks,
}: {
  code: string
  /** What this is, in the modal's header. */
  title: string
  /** Where it came from — a path, usually. */
  subtitle?: string
  /** Where "open this in full" goes.
   *
   *  **A modal was the wrong destination once there was a code view.** This box shows a body
   *  out of context — a signature, a doc, the forks — and the button on it means *show me
   *  this properly*. It opened a second copy of the same snippet at a larger size, which
   *  answers a smaller question than the one being asked: the file around it, scrolled to
   *  this function, with its neighbours and its gutter, is what "properly" means now.
   *
   *  Optional, and the modal is the fallback: a block whose caller has no node to open —
   *  a fragment of a diff, a snippet with no file behind it — still has somewhere to go. */
  onOpen?: () => void
  /** The file line the first line of `code` is, so the gutter says where you are rather than
   *  counting from one. Omitted for text that has no position in a file, like a doc comment. */
  startLine?: number
  /** Prose gets no syntax colouring. A doc comment tokenizes as one long comment — italic,
   *  muted, and harder to read the more of it there is — and it is the one thing on this pane
   *  somebody is meant to read every word of. */
  highlight?: boolean
  /** Something wrong with these lines, said above them. */
  caveat?: string
  /** Square top and no border of its own, for a block that is the bottom half of a tile whose
   *  header supplies both. Two rounded boxes stacked with a hairline between them read as two
   *  things about one function; the tile is one thing. */
  flush?: boolean
  height?: string
  /** A cap in PIXELS, measured rather than chosen — for a box that has to end exactly where
   *  the pane does. See `useFitToPane`: a class can only carry a constant, and the space left
   *  under a section depends on how many lines the paragraph below it wrapped to.
   *
   *  Wins over `height` when set, which is why that keeps its default: the fit is measured in
   *  a layout effect, so the first paint has no number yet and falls back to the class. */
  maxHeight?: number
  /** Lines worth pointing at, by FILE line — a short label and why, shown in a column of
   *  their own with the line itself lifted out of the muted default.
   *
   *  **Added so Complexity could stop drawing its own code box.** It had one: a gutter, a
   *  body and a mark per line, three-quarters of this component reimplemented next to it and
   *  looking like it. Three panes showing a body three different ways is the shape of every
   *  "why does this look different here" question, and the modal, the copy button, the
   *  dedent and the tokenizer were all missing from the copy. */
  marks?: Map<number, { label: string; why: string }>
}) {
  // Dedented once, and what is COPIED is the dedented text too: the reason to copy a snippet
  // is to paste it somewhere that has its own margin, and pasting somebody's impl-block
  // indentation into a chat window is the same nuisance one level down.
  const code = dedent(raw)
  const [open, setOpen] = useState(false)
  // Escape closes, because a modal that only closes by clicking a target is a modal you have
  // to aim at. `Overlay` already closes on the backdrop; this is the other half of the pair
  // every dialog in this app is expected to have.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const body = <Lines code={code} startLine={startLine} highlight={highlight} marks={marks} />

  return (
    <>
      {caveat && <p className="mb-1 text-[10px] leading-snug text-[var(--warning)]">{caveat}</p>}
      {/* The button sits ON the box rather than beside it: the box is the whole width of the
          pane and a control in the row above would be a second row of chrome per snippet.
          Quiet, never absent — it came up to full on hover from nothing at all, which is an
          affordance you have to already know about to find. Same weight `CopyButton` sits at,
          for the same reason. */}
      <div className="group relative">
        {/* `--code`, never `--secondary`: source goes to the page's own extreme — white on
            Paper, Ink in the dark — so a tile is a thing sitting ON the panel rather than a
            slightly darker patch of it. See index.css. */}
        {/* **Scrolls, and does NOT contain its overscroll.** `overscroll-behavior: contain` is
            right for a pane and wrong for a box inside one: it stops the wheel chaining out
            when the block reaches its end, so a pane holding a dozen tiles could only be
            scrolled in the gaps between them, and past a certain density there are none. The
            default chains, which is what a code box in a sidebar is expected to do. */}
        <div
          className={`overflow-auto bg-[var(--code)] ${maxHeight === undefined ? height : ''} ${
            flush ? '' : 'rounded-[var(--radius-sm)] border border-[var(--border)]'
          }`}
          style={maxHeight === undefined ? undefined : { maxHeight }}
        >
          {body}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (onOpen) onOpen()
            else setOpen(true)
          }}
          title={onOpen ? 'Open in the code view' : 'Open this in full'}
          aria-label={`Open ${title} in full`}
          className="absolute right-1 top-1 rounded-[4px] border border-[var(--border)] bg-[var(--card)] p-[3px] opacity-70 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M7.2 1.4h3.4v3.4M4.8 10.6H1.4V7.2M10.6 1.4 7 5M1.4 10.6 5 7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <Overlay onClose={() => setOpen(false)}>
          {/* Capped at the window and otherwise sized to the content. Held at full height it
              was a 12-line function in an 800px box, which reads as something that failed to
              load — the modal is here because the content did not FIT, not because everything
              deserves the whole screen. */}
          <div
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-baseline gap-2 border-b border-[var(--border)] px-4 py-2.5">
              <span className="mono truncate text-[13px] font-semibold">{title}</span>
              {subtitle && (
                <span
                  className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted-foreground)]"
                  style={{ fontFamily: FAMILY }}
                >
                  {subtitle}
                </span>
              )}
              <CopyButton text={code} title="Copy this source" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-[3px] px-1 text-[13px] leading-none text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {caveat && (
              <p className="shrink-0 border-b border-[var(--border)] px-4 py-1.5 text-[11px] text-[var(--warning)]">
                {caveat}
              </p>
            )}
            {/* The whole thing, and the only place it scrolls. A modal is a reading
                surface and trapping the wheel inside one is what it is for. */}
            <div className="min-h-0 flex-1 overflow-auto bg-[var(--code)] px-2 py-2">{body}</div>
          </div>
        </Overlay>
      )}
    </>
  )
}

/** The lines themselves, in a table so the gutter cannot drift out of alignment with them.
 *
 *  Numbers are the FILE's, not the snippet's: a caller is somewhere real and `1` would be a
 *  position in a box nobody can navigate to. */
function Lines({
  code,
  startLine,
  highlight,
  marks,
}: {
  code: string
  startLine?: number
  highlight: boolean
  marks?: Map<number, { label: string; why: string }>
}) {
  const lines = code.split('\n')
  // **Tokenized as a FILE, not a line at a time.** A block comment's body lines are ordinary
  // prose that a per-line pass reads as code — `as`, `with` and `in` came out as keywords
  // inside English sentences, in every doc comment in the repo. See `tokenizeAll`.
  const toks = tokenizeAll(lines)
  return (
    <table className="mono w-full border-collapse text-[10.5px] leading-[1.45]">
      <tbody>
        {lines.map((line, i) => {
          // Marks are keyed by FILE line for the same reason the gutter counts from
          // `startLine`: a position in a box nobody can navigate to is not a position.
          const mark = startLine === undefined ? undefined : marks?.get(startLine + i)
          return (
          <tr key={i}>
            {startLine !== undefined && (
              <td className="select-none whitespace-pre px-2 text-right align-top text-[var(--muted-foreground)] opacity-60">
                {startLine + i}
              </td>
            )}
            {/* Code scrolls sideways; prose WRAPS. Wrapping a line of code moves it under
                its own indentation and invents a structure the file does not have, which is
                the one thing a snippet must not do. A doc comment has no structure to lose
                and every character of it is meant to be read, so a sentence that runs off
                the right edge of a 260px panel is a sentence nobody reads. */}
            <td
              className={`w-full px-2 align-top ${
                highlight ? 'whitespace-pre' : 'whitespace-pre-wrap break-words'
              } ${startLine === undefined ? '' : 'pl-0'} ${
                // Marked lines come forward rather than the rest going back: an unmarked line
                // is still code somebody is reading, and dimming three-quarters of a body to
                // point at the other quarter makes the body unreadable to make a point about
                // it. `marks` present at all is what shifts the baseline down.
                marks === undefined ? '' : mark ? 'font-semibold' : 'opacity-70'
              }`}
            >
              {highlight ? (
                toks[i].map((t, j) => (
                  <span key={j} className={t.cls}>
                    {t.text}
                  </span>
                ))
              ) : (
                // A doc comment keeps its own line breaks and nothing else. ` ` for an
                // empty line so the row has a height — a blank `<td>` collapses, and a
                // paragraph break in a comment stack would silently disappear.
                <span>{line || ' '}</span>
              )}
            </td>
            {marks !== undefined && (
              <td
                className="select-none whitespace-pre px-2 text-right align-top tabular-nums"
                title={mark?.why}
              >
                {mark?.label ?? ''}
              </td>
            )}
          </tr>
          )
        })}
      </tbody>
    </table>
  )
}
