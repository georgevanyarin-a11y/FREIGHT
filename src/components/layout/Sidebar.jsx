import { NavLink } from 'react-router-dom'
import {
  FiClipboard,
  FiFileText,
  FiUsers,
  FiDollarSign,
  FiBell,
  FiSettings,
  FiTruck,
  FiUser,
  FiCpu
} from 'react-icons/fi'

// Пункты навигации. Чтобы добавить новый модуль — добавьте строку сюда
// и соответствующий <Route> в App.jsx.
export const NAV_ITEMS = [
  { to: '/orders', label: 'Заявки', icon: FiClipboard },
  { to: '/documents', label: 'Документы', icon: FiFileText },
  { to: '/counterparties', label: 'Контрагенты', icon: FiUsers },
  { to: '/finance', label: 'Финансы', icon: FiDollarSign },
  { to: '/reminders', label: 'Напоминания', icon: FiBell },
  { to: '/settings', label: 'Настройки', icon: FiSettings },
  { to: '/profile', label: 'Профиль перевозчика', icon: FiUser },
  { to: '/contract-import', label: 'Анализ договора', icon: FiCpu }
  
]

export default function Sidebar({ onNavigate }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-ink-200 bg-ink-950">
      {/* Логотип */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-700 text-white">
          <FiTruck size={18} />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Перевозчик</div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
            CRM
          </div>
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
              ${
                isActive
                  ? 'bg-brand-700 text-white'
                  : 'text-ink-300 hover:bg-ink-900 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-900 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-ink-500">
          Ядро CRM v0.1
          <br />
          Модули добавляются в&nbsp;Sidebar и&nbsp;App.jsx
        </p>
      </div>
    </aside>
  )
}
