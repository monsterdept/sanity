import { useEffect, useState } from 'react'

/**
 * The small slice of markdown an agent actually writes.
 *
 * `code`, **bold**, *italic*, and paragraph breaks — nothing else. Agents write prose
 * with backticked identifiers in it, and rendering that literally put stray backticks
 * through every report; rendering it with a full markdown library would pull in a parser
 * and a sanitiser for a paragraph of text this panel already controls the source of.
 *
 * Split on the code spans FIRST so a `*` inside an identifier can't be read as emphasis.
 */
export function Markdown({ text }: { text: string }) {
  const inline = (t: string, key: string) => {
    const out: React.ReactNode[] = []
    // Code first — everything inside a span is literal.
    t.split(/(`[^`]+`)/g).forEach((chunk, i) => {
      if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 1) {
        out.push(
          <code
            key={`${key}-c${i}`}
            // A wash of whatever ink this paragraph is set in, not a fixed gray. The
            // trap note is a solid pink box with its own inherited color, and a
            // `--secondary` chip on it is a swatch of the panel's chrome sitting in the
            // middle of a sentence. Derived from `currentColor`, it is right on every
            // ground this renderer is used on without any of them being told about it.
            className="mono rounded px-1 py-px text-[0.92em]"
            style={{ background: 'color-mix(in oklch, currentColor 15%, transparent)' }}
          >
            {chunk.slice(1, -1)}
          </code>,
        )
        return
      }
      chunk.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).forEach((bit, j) => {
        const k = `${key}-${i}-${j}`
        if (bit.startsWith('**') && bit.endsWith('**') && bit.length > 3) {
          out.push(<strong key={k}>{bit.slice(2, -2)}</strong>)
        } else if (bit.startsWith('*') && bit.endsWith('*') && bit.length > 2) {
          out.push(<em key={k}>{bit.slice(1, -1)}</em>)
        } else if (bit) {
          out.push(<span key={k}>{bit}</span>)
        }
      })
    })
    return out
  }

  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((para, i) => (
          <p key={i} className={i > 0 ? 'mt-1.5' : undefined}>
            {inline(para.trim(), String(i))}
          </p>
        ))}
    </>
  )
}

/**
 * Take this paragraph somewhere else.
 *
 * A reading is written to be acted on — pasted into an issue, a commit message, a prompt —
 * and until now the only way to get one out of the panel was to select prose that has
 * `<code>` spans in it and hope the selection came out clean. What goes on the clipboard is
 * the agent's own MARKDOWN, backticks and all, not the rendered text: the destination is
 * usually another markdown box, and the round trip is lossless only if nothing renders it
 * on the way.
 *
 * **"Copied" is only said when the write resolves.** The clipboard can refuse — no secure
 * context, no permission — and a button that flashes success either way is the same lie as
 * a save that reports `Ok` without reading itself back.
 */
export function CopyButton({ text, title }: { text: string; title: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1200)
    return () => clearTimeout(t)
  }, [done])
  return (
    <button
      type="button"
      title={done ? 'Copied' : title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(text).then(
          () => setDone(true),
          () => setDone(false),
        )
      }}
      // Quiet until wanted: it sits in the corner of a box whose whole job is to be read,
      // so it takes the muted ink and comes up to full on hover. It inherits `color` on the
      // trap tab, where the ground is pink and the panel's own foreground would disappear.
      className="ml-auto shrink-0 rounded-[3px] p-0.5 opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path
            d="M2.5 6.4 4.8 8.8 9.5 3.4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
          <rect
            x="1.2"
            y="1.2"
            width="6.6"
            height="6.6"
            rx="1.2"
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <path
            d="M4.2 10.8h5.4a1.2 1.2 0 0 0 1.2-1.2V4.2"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  )
}
