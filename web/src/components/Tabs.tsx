/** A segmented control: two or three references, one of which is on screen.
 *
 * **The control IS the title.** It was written for the lens sheet, where an `h2` reading
 * `Lenses` sat above a tab reading `Lenses` — the same word twice, which left the second one
 * looking like a heading rather than a thing to press. Naming the references once, in the
 * control that switches them, says both what this is and that there is another one.
 *
 * **In a recessed track, with a lit pill on the selected one and nothing on the others.** The
 * first version set a background on the selected tab alone, so the unselected one was bare
 * text on a panel: it read as a label, and the sheet behind it went unfound for a while. The
 * track is what says "these are one control, and it has another position".
 *
 * Centred by the caller, or not — but centred is usually right. A control at the left margin
 * reads as a caption for whatever sits under it, which is how that second sheet got missed.
 */
export function Tabs<K extends string>({
  tabs,
  at,
  onPick,
  className = '',
}: {
  /** The positions, in the order they are shown, each with the word on it. A count belongs in
   *  the word — `Findings (54)` is one thing being named, where a title and a figure at
   *  opposite ends of a row are two pieces of chrome to read. */
  tabs: ReadonlyArray<{ k: K; word: string }>
  at: K
  onPick: (k: K) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={`flex w-fit items-center gap-0.5 rounded-full p-[3px] ${className}`}
      style={{
        background: 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        boxShadow: 'inset 0 1px 2px color-mix(in oklch, var(--foreground) 12%, transparent)',
      }}
    >
      {tabs.map(({ k, word }) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={at === k}
          onClick={() => onPick(k)}
          className="rounded-full px-3 py-[3px] text-[12px] leading-none transition-colors"
          style={
            at === k
              ? { background: 'var(--accent)', color: 'var(--accent-foreground)', fontWeight: 600 }
              : { color: 'var(--muted-foreground)', fontWeight: 600 }
          }
        >
          {word}
        </button>
      ))}
    </div>
  )
}
