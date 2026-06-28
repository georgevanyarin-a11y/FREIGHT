import { forwardRef } from 'react'

/**
 * Выпадающий список. options: [{ value, label }]
 */
const Select = forwardRef(function Select(
  { label, error, className = '', id, options = [], ...props },
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
      <select
        id={inputId}
        ref={ref}
        className={`h-10 w-full rounded-lg border bg-white px-3 text-sm text-ink-900
          transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400
          focus:border-brand-400 ${error ? 'border-red-400' : 'border-ink-200'}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})

export default Select
