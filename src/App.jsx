import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

import ProtectedRoute from './components/layout/ProtectedRoute'
import Layout from './components/layout/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import OrderList from './pages/Orders/OrderList'
import DocumentList from './pages/Documents/DocumentList'
import Finance from './pages/Finance/Finance'
import Reminders from './pages/Reminders'
import Settings from './pages/Settings'
import ContractImport from './pages/ContractImport/ContractImport'
import CarrierProfile from './pages/Profile/CarrierProfile'
import CounterpartyList from './pages/Counterparties/CounterpartyList'


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
        <Route path="/documents" element={<DocumentList />} />
        <Route path="/contract-import" element={<ContractImport />} />
        <Route path="/counterparties" element={<CounterpartyList />} />
        <Route path="/profile" element={<CarrierProfile />} />
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