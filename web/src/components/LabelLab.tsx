import { DEFAULT_STYLE, setLabelStyle, useLabelStyle, type Contrast } from '../lib/labelStyle'

/**
 * The label workbench.
 *
 * A floating panel for the questions `label.ts` cannot answer. That module decides where a
 * name goes and how big it can be, and every one of those decisions is arithmetic against a
 * measurement. How the name should LOOK once it is there is not, and the only honest way to
 * settle one of those is to look at it on real data.
 *
 * **It shrinks as questions get answered.** Face, weight, tracking and the size floor were
 * all here; they were decided by looking and are constants in `labelStyle` now. What is
 * left is the one that is still open — how a name is lifted off a wedge whose colour is the
 * reading — and the two numbers that make that judgeable.
 *
 * A workbench, not a settings screen: behind a button, keeping nothing between sessions,
 * and finished the moment the last answer is written back into the source. A chart that
 * ships a control for how its own type looks has handed the decision to a reader with less
 * to go on than we have.
 */
export function LabelLab({ onClose }: { onClose: () => void }) {
  const style = useLabelStyle()

  return (
    <div className="absolute right-2 top-2 z-30 w-64 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-3 text-[11px] shadow-lg">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          Labels
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
        >
          ✕
        </button>
      </div>

      {/* The one this panel was built for. */}
      <Field label="Lift off the wedge">
        <div className="grid grid-cols-4 gap-1">
          {(['none', 'halo', 'shadow', 'plate'] as Contrast[]).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setLabelStyle({ contrast: c })}
              className={`rounded-[var(--radius-sm)] border px-1 py-0.5 capitalize ${
                style.contrast === c
                  ? 'border-[var(--foreground)] text-[var(--foreground)]'
                  : 'border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      {style.contrast !== 'none' && (
        <Slider
          label="Strength"
          value={style.strength}
          min={0.04}
          max={0.4}
          step={0.01}
          onChange={(strength) => setLabelStyle({ strength })}
        />
      )}
      <Slider
        label="Opacity"
        value={style.opacity}
        min={0.3}
        max={1}
        step={0.02}
        onChange={(opacity) => setLabelStyle({ opacity })}
      />
      <button
        type="button"
        onClick={() => setLabelStyle(DEFAULT_STYLE)}
        className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-0.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)]"
      >
        Reset
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="mb-1 text-[10px] text-[var(--muted-foreground)]">{label}</p>
      {children}
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (n: number) => void
}) {
  return (
    <div className="mb-2">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] text-[var(--muted-foreground)]">{label}</p>
        {/* The number, always. A slider whose value you cannot read is a control you can
            only reproduce by feel, and the point of this panel is to arrive at constants
            somebody then types into the source. */}
        <p className="mono text-[10px] tabular-nums text-[var(--muted-foreground)]">
          {value}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]"
      />
    </div>
  )
}
