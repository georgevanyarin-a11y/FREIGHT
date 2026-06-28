import { useState } from 'react'
import { FiLogOut, FiMenu, FiUser } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import Button from '../ui/Button'

export default function Header({ onMenuClick }) {
  const { user, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const handleSignOut = async () => {
    setBusy(true)
    await signOut()
    // Редирект произойдёт автоматически: ProtectedRoute увидит отсутствие сессии
    setBusy(false)
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Кнопка-гамбургер для мобильных */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 lg:hidden"
          aria-label="Открыть меню"
        >
          <FiMenu size={20} />
        </button>
        <span className="hidden text-sm font-semibold text-ink-900 sm:block">
          Перевозчик CRM
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-1.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-white">
            <FiUser size={13} />
          </span>
          <span className="max-w-[180px] truncate text-sm font-medium text-ink-700">
            {user?.email || 'Пользователь'}
          </span>
        </div>

        <Button variant="secondary" size="sm" onClick={handleSignOut} disabled={busy}>
          <FiLogOut size={15} />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      </div>
    </header>
  )
}
