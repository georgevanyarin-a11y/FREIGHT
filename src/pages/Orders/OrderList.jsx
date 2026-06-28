import { useCallback, useEffect, useState } from 'react'
import {
  FiPlus, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight, FiSearch, FiInbox, FiEye
} from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import OrderForm from './OrderForm'
import OrderView from './OrderView'
import { STAGE_OPTIONS, stageView, checklistProgress } from './orderStages'

const PAGE_SIZE = 10

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [viewing, setViewing] = useState(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const fetchOrders = useCallback(async () => {
    setLoading(true); setLoadError('')
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('orders')
      .select('*, counterparty:counterparties(name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    const term = search.trim()
    if (term) query = query.or(`order_number.ilike.%${term}%,cargo.ilike.%${term}%,driver_name.ilike.%${term}%`)
    if (stageFilter) query = query.eq('stage', stageFilter)

    const { data, error, count } = await query
    if (error) { setLoadError('Не удалось загрузить заявки: ' + error.message); setOrders([]); setTotal(0) }
    else { setOrders(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [page, search, stageFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])
  useEffect(() => { setPage(1) }, [search, stageFilter])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (order) => { setEditing(order); setFormOpen(true) }
  const handleSaved = () => { setFormOpen(false); setEditing(null); fetchOrders() }

  const changeStage = async (order, stage) => {
    // оптимистично обновляем на экране
    setOrders((list) => list.map((o) => (o.id === order.id ? { ...o, stage } : o)))
    const { error } = await supabase
      .from('orders')
      .update({ stage, status: stage === 'paid' ? 'done' : 'active', stage_changed_at: new Date().toISOString() })
      .eq('id', order.id)
    if (error) { setLoadError('Не удалось сменить этап: ' + error.message); fetchOrders() }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const { error } = await supabase.from('orders').delete().eq('id', deleting.id)
    setDeleteBusy(false)
    if (error) { setLoadError('Не удалось удалить заявку: ' + error.message); return }
    setDeleting(null)
    if (orders.length === 1 && page > 1) setPage((p) => p - 1)
    else fetchOrders()
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Заявки</h1>
          <p className="mt-0.5 text-sm text-ink-500">Всего: <span className="font-medium text-ink-700">{total}</span></p>
        </div>
        <Button onClick={openCreate}><FiPlus size={16} />Новая заявка</Button>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по номеру, грузу, водителю" className="[&_input]:pl-9" />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-700"
        >
          <option value="">Все этапы</option>
          {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loadError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</div>}

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">№ / Заказчик</th>
                <th className="px-4 py-3 font-semibold">Маршрут</th>
                <th className="px-4 py-3 font-semibold">Груз</th>
                <th className="px-4 py-3 text-right font-semibold">Ставка</th>
                <th className="px-4 py-3 font-semibold">Этап</th>
                <th className="px-4 py-3 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <SkeletonRows />
              ) : orders.length === 0 ? (
                <EmptyRow hasFilter={Boolean(search.trim() || stageFilter)} onCreate={openCreate} />
              ) : (
                orders.map((o) => {
                  const route = routeOf(o)
                  const sv = stageView(o.stage)
                  const prog = checklistProgress(o.checklist)
                  return (
                    <tr key={o.id} className="transition-colors hover:bg-ink-50">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-ink-900">№ {o.internal_number ?? '—'}</div>
                        <div className="text-xs text-ink-500">{o.counterparty?.name || o.order_number || '—'}</div>
                        <div className="text-xs text-ink-400">{formatDate(o.order_date)}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="text-ink-800"><span className="text-ink-400">Из:</span> {route.from}</div>
                        <div className="text-ink-800"><span className="text-ink-400">В:</span> {route.to}</div>
                        {route.extra > 0 && <div className="mt-0.5 text-xs text-ink-400">+ ещё {route.extra} точек</div>}
                      </td>
                      <td className="px-4 py-3 align-top text-ink-700">
                        <div>{o.cargo || '—'}</div>
                        {(o.weight || o.volume) && (
                          <div className="text-xs text-ink-400">
                            {o.weight ? `${o.weight} т` : ''}{o.weight && o.volume ? ' · ' : ''}{o.volume ? `${o.volume} м³` : ''}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <div className="font-medium text-ink-900">{formatMoney(o.rate)}</div>
                        <div className="text-xs text-ink-400">{o.vat_included ? 'с НДС' : 'без НДС'}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${sv.cls}`}>{sv.label}</span>
                        <select
                          value={o.stage || 'new'}
                          onChange={(e) => changeStage(o, e.target.value)}
                          className="mt-1.5 block w-full rounded-md border border-ink-200 bg-white px-2 py-1 text-xs text-ink-600"
                        >
                          {STAGE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        {prog.total > 0 && (
                          <div className="mt-1 text-[11px] text-ink-400">чек-лист {prog.done}/{prog.total}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewing(o)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700" title="Просмотр"><FiEye size={15} /></button>
                          <button onClick={() => openEdit(o)} className="rounded-lg p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" title="Редактировать"><FiEdit2 size={15} /></button>
                          <button onClick={() => setDeleting(o)} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600" title="Удалить"><FiTrash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
          <span className="text-xs text-ink-500">Страница {page} из {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading}><FiChevronLeft size={16} />Назад</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}>Вперёд<FiChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      {formOpen && (
        <OrderForm open order={editing} onClose={() => setFormOpen(false)} onSaved={handleSaved} />
      )}

      {viewing && (
        <OrderView
          open
          order={viewing}
          onClose={() => setViewing(null)}
          onEdit={(o) => { setViewing(null); openEdit(o) }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteBusy}
        title="Удалить заявку"
        message={deleting ? `Заявка № ${deleting.internal_number ?? '—'} будет удалена безвозвратно. Продолжить?` : ''}
      />
    </div>
  )
}

function routeOf(o) {
  const points = Array.isArray(o.points) ? o.points : []
  const loads = points.filter((p) => p.kind === 'loading')
  const unloads = points.filter((p) => p.kind === 'unloading')
  const from = loads[0]?.address || o.loading_address || '—'
  const to = unloads[unloads.length - 1]?.address || o.unloading_address || '—'
  const extra = Math.max(0, points.length - 2)
  return { from, to, extra }
}

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 6 }).map((__, j) => (
        <td key={j} className="px-4 py-4"><div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-ink-100" /></td>
      ))}
    </tr>
  ))
}

function EmptyRow({ hasFilter, onCreate }) {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400"><FiInbox size={22} /></span>
          <p className="mt-3 text-sm font-medium text-ink-700">{hasFilter ? 'Ничего не найдено' : 'Пока нет ни одной заявки'}</p>
          <p className="mt-1 text-sm text-ink-500">{hasFilter ? 'Измените запрос или фильтр.' : 'Создайте первую заявку или загрузите договор.'}</p>
          {!hasFilter && <Button className="mt-4" size="sm" onClick={onCreate}><FiPlus size={15} />Новая заявка</Button>}
        </div>
      </td>
    </tr>
  )
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return '—'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
}
