import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { FiTruck } from 'react-icons/fi'
import { useAuth } from '../hooks/useAuth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/orders'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email.trim(), password)
    setLoading(false)
    if (error) {
      setError('Неверный email или пароль. Проверьте данные и попробуйте снова.')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthShell title="Вход в систему" subtitle="Войдите, чтобы продолжить работу с заявками">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Пароль"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Вход…' : 'Войти'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Нет аккаунта?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Зарегистрироваться
        </Link>
      </p>
    </AuthShell>
  )
}

/** Общая оболочка для страниц входа/регистрации */
export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-700 text-white">
            <FiTruck size={24} />
          </span>
          <h1 className="text-xl font-semibold text-white">Перевозчик CRM</h1>
          <p className="mt-1 text-sm text-ink-400">Система учёта грузоперевозок</p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-panel">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
