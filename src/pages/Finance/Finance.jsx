import { useCallback, useEffect, useMemo, useState } from 'react'
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiAlertCircle, FiCheck } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'

export default function Finance() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('month') // month | all

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('orders')
      .select('id, internal_number, order_number, order_date, rate, expense_fuel, expense_road, expense_per_diem, expense_other, paid, paid_at, payment_due_date, stage, counterparty:counterparties(name)')
      .order('order_date', { ascending: false })
    if (error) setError('Не удалось загрузить данные: ' + error.message)
    else setOrders(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markPaid = async (order) => {
    const today = new Date().toISOString().slice(0, 10)
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, paid: true, paid_at: today } : o)))
    const { error } = await supabase.from('orders').update({ paid: true, paid_at: today }).eq('id', order.id)
    if (error) { setError('Не удалось отметить оплату: ' + error.message); load() }
  }

  const { summary, debtors } = useMemo(() => computeFinance(orders, period), [orders, period])

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Финансы</h1>
          <p className="mt-0.5 text-sm text-ink-500">Доходы, расходы и контроль оплат</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
          <PeriodBtn active={period === 'month'} onClick={() => setPeriod('month')}>Текущий месяц</PeriodBtn>
          <PeriodBtn active={period === 'all'} onClick={() => setPeriod('all')}>Всё время</PeriodBtn>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-ink-500">Загрузка…</div>
      ) : (
        <>
          {/* Сводка */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={<FiDollarSign size={18} />} label="Ожидаемый доход" value={money(summary.income)} tone="brand" />
            <StatCard icon={<FiTrendingDown size={18} />} label="Расходы" value={money(summary.expenses)} tone="ink" />
            <StatCard icon={<FiTrendingUp size={18} />} label="Прибыль" value={money(summary.profit)} tone={summary.profit < 0 ? 'red' : 'green'} />
            <StatCard icon={<FiCheck size={18} />} label="Получено" value={money(summary.received)} tone="green" />
          </div>

          {/* Дебиторка */}
          <div className="rounded-2xl border border-ink-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">Кто должен (дебиторка)</h2>
              <span className="text-sm font-medium text-ink-700">{money(debtors.total)}</span>
            </div>

            {debtors.list.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-ink-500">Нет неоплаченных заявок — все рассчитались.</div>
            ) : (
              <ul className="divide-y divide-ink-100">
                {debtors.list.map((o) => (
                  <li key={o.id} className={`flex items-center gap-3 px-4 py-3 ${o.overdue ? 'bg-red-50/50' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink-900">№ {o.internal_number ?? '—'}</span>
                        <span className="truncate text-sm text-ink-500">{o.counterparty?.name || o.order_number || '—'}</span>
                      </div>
                      <div className={`text-xs ${o.overdue ? 'font-medium text-red-600' : 'text-ink-400'}`}>
                        {o.overdue && <FiAlertCircle size={11} className="mr-1 inline" />}
                        {o.payment_due_date ? `срок оплаты ${dt(o.payment_due_date)}${o.overdue ? ' — просрочено' : ''}` : 'срок оплаты не указан'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-ink-900">{money(o.rate)}</div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => markPaid(o)}>
                      <FiCheck size={14} />Оплачено
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function computeFinance(orders, period) {
  const now = new Date()
  const inPeriod = (o) => {
    if (period === 'all') return true
    const d = o.order_date ? new Date(o.order_date) : null
    if (!d || Number.isNaN(d.getTime())) return false
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }
  const n = (v) => (v == null || v === '' ? 0 : Number(v) || 0)
  const exp = (o) => n(o.expense_fuel) + n(o.expense_road) + n(o.expense_per_diem) + n(o.expense_other)

  let income = 0, expenses = 0, received = 0
  for (const o of orders) {
    if (o.stage === 'cancelled') continue
    if (!inPeriod(o)) continue
    income += n(o.rate)
    expenses += exp(o)
    if (o.paid) received += n(o.rate)
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const list = orders
    .filter((o) => o.stage !== 'cancelled' && !o.paid && n(o.rate) > 0)
    .map((o) => {
      const due = o.payment_due_date ? new Date(o.payment_due_date) : null
      const overdue = due && !Number.isNaN(due.getTime()) && due < today
      return { ...o, overdue }
    })
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return (a.payment_due_date || '').localeCompare(b.payment_due_date || '')
    })
  const total = list.reduce((s, o) => s + n(o.rate), 0)

  return {
    summary: { income, expenses, profit: income - expenses, received },
    debtors: { list, total }
  }
}

function PeriodBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-brand-100 text-brand-700' : 'text-ink-500 hover:text-ink-700'}`}
    >
      {children}
    </button>
  )
}

function StatCard({ icon, label, value, tone }) {
  const toneCls = {
    brand: 'text-brand-700 bg-brand-50',
    green: 'text-emerald-700 bg-emerald-50',
    red: 'text-red-700 bg-red-50',
    ink: 'text-ink-600 bg-ink-100'
  }[tone] || 'text-ink-600 bg-ink-100'
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
      <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${toneCls}`}>{icon}</span>
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-ink-900">{value}</div>
    </div>
  )
}

function money(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return '0 ₽'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
}

function dt(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
