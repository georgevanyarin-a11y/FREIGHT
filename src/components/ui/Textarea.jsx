import { forwardRef } from 'react'

const Textarea = forwardRef(function Textarea(
  { label, error, className = '', id, rows = 3, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        ref={ref}
        rows={rows}
        className={`w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-ink-900
          placeholder:text-ink-400 transition-colors
          focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-brand-400
          ${error ? 'border-red-400' : 'border-ink-200'}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Textarea
