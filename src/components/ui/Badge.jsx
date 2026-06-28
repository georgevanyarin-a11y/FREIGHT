/**
 * Цветной бейдж статуса.
 * tone: 'active' | 'done' | 'neutral'
 */
const TONES = {
  active: 'bg-brand-50 text-brand-700 ring-brand-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200'
}

export default function Badge({ tone = 'neutral', children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium
        ring-1 ring-inset ${TONES[tone] || TONES.neutral}`}
    >
      {children}
    </span>
  )
}
