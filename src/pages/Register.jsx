import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { AuthShell } from './Login'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (password.length < 6) {
      setError('Пароль должен содержать не менее 6 символов.')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают.')
      return
    }

    setLoading(true)
    const { data, error } = await signUp(email.trim(), password)
    setLoading(false)

    if (error) {
      setError(error.message || 'Не удалось зарегистрироваться. Попробуйте ещё раз.')
      return
    }

    // Если в проекте включено подтверждение email — сессии сразу не будет.
    if (data.session) {
      navigate('/orders', { replace: true })
    } else {
      setInfo('Аккаунт создан. Проверьте почту для подтверждения, затем войдите.')
    }
  }

  return (
    <AuthShell title="Регистрация" subtitle="Создайте аккаунт для работы с CRM">
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
          autoComplete="new-password"
          placeholder="Минимум 6 символов"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Input
          label="Повторите пароль"
          name="password2"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          required
        />

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {info && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {info}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Создание…' : 'Зарегистрироваться'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
          Войти
        </Link>
      </p>
    </AuthShell>
  )
}
