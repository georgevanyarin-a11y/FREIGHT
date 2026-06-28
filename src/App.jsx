import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import ProtectedRoute from './components/layout/ProtectedRoute'
import Layout from './components/layout/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import OrderList from './pages/Orders/OrderList'
import Documents from './pages/Documents'
import Counterparties from './pages/Counterparties'
import Finance from './pages/Finance'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'

export default function App() {
  const { session } = useAuth()

  return (
    <Routes>
      {/* Публичные маршруты. Если уже вошли — уводим на /orders */}
      <Route path="/login" element={session ? <Navigate to="/orders" replace /> : <Login />} />
      <Route path="/register" element={session ? <Navigate to="/orders" replace /> : <Register />} />

      {/* Защищённая зона с общим макетом */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/orders" element={<OrderList />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/counterparties" element={<Counterparties />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Корень и всё остальное → заявки */}
      <Route path="/" element={<Navigate to="/orders" replace />} />
      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}
