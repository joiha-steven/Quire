// Shared on/off switch primitives for the settings forms.

type SwitchProps = { checked: boolean; onChange: (v: boolean) => void }

// The bare toggle.
export function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all dark:bg-neutral-900 ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

// One row inside a bordered list: title (+ optional code badge) + description, switch on the right.
export function ToggleRow({
  label,
  desc,
  badge,
  checked,
  onChange,
}: SwitchProps & { label: string; desc?: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
          {label}
          {badge && <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">{badge}</code>}
        </div>
        {desc && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{desc}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

// Inline labeled field: label left, switch right.
export function ToggleField({ label, checked, onChange }: SwitchProps & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}
