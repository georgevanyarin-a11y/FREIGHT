import { FiTool } from 'react-icons/fi'

/**
 * Универсальная заглушка для модулей «в разработке».
 * Используется страницами Documents/Counterparties/Finance/Reminders/Settings.
 */
export default function Placeholder({ title, description }) {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white py-16 text-center shadow-card">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
          <FiTool size={22} />
        </span>
        <h2 className="mt-4 text-base font-medium text-ink-800">{title} — в разработке</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          {description || 'Этот модуль появится в одном из следующих обновлений.'}
        </p>
      </div>
    </div>
  )
}
