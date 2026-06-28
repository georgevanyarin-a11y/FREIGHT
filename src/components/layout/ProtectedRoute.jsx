import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

/**
 * Защищённый маршрут: пока проверяется сессия — спиннер,
 * без сессии — редирект на /login.
 */
export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-100">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-300 border-t-brand-600" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
