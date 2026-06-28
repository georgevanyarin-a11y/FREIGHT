import { useCallback, useEffect, useState } from 'react'
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiInbox
} from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import OrderForm from './OrderForm'

const PAGE_SIZE = 10

export default function OrderList() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Состояния модалок
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null) // объект заявки или null (создание)
  const [deleting, setDeleting] = useState(null) // заявка для удаления
  const [deleteBusy, setDeleteBusy] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Загрузка страницы заявок. RLS сам ограничивает выборку текущим пользователем.
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    const term = search.trim()
    if (term) {
      // Поиск по номеру и адресам
      query = query.or(
        `order_number.ilike.%${term}%,loading_address.ilike.%${term}%,unloading_address.ilike.%${term}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      setLoadError('Не удалось загрузить заявки: ' + error.message)
      setOrders([])
      setTotal(0)
    } else {
      setOrders(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }, [page, search])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Сброс на первую страницу при изменении поиска
  useEffect(() => {
    setPage(1)
  }, [search])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (order) => {
    setEditing(order)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditing(null)
    fetchOrders()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    const { error } = await supabase.from('orders').delete().eq('id', deleting.id)
    setDeleteBusy(false)
    if (error) {
      setLoadError('Не удалось удалить заявку: ' + error.message)
      return
    }
    setDeleting(null)
    // Если удалили последнюю запись на странице — шагнём назад
    if (orders.length === 1 && page > 1) {
      setPage((p) => p - 1)
    } else {
      fetchOrders()
    }
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Шапка раздела */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Заявки</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            Всего заявок: <span className="font-medium text-ink-700">{total}</span>
          </p>
        </div>
        <Button onClick={openCreate}>
          <FiPlus size={16} />
          Новая заявка
        </Button>
      </div>

      {/* Панель поиска */}
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <FiSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <Input
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру или адресу"
            className="[&_input]:pl-9"
          />
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Таблица */}
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">№ / Дата</th>
                <th className="px-4 py-3 font-semibold">Маршрут</th>
                <th className="px-4 py-3 font-semibold">Контакты</th>
                <th className="px-4 py-3 font-semibold">Срок</th>
                <th className="px-4 py-3 text-right font-semibold">Ставка</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <SkeletonRows />
              ) : orders.length === 0 ? (
                <EmptyRow hasSearch={Boolean(search.trim())} onCreate={openCreate} />
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="transition-colors hover:bg-ink-50">
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-ink-900">№ {o.order_number || '—'}</div>
                      <div className="text-xs text-ink-400">{formatDate(o.order_date)}</div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-ink-800">
                        <span className="text-ink-400">Из:</span> {o.loading_address || '—'}
                      </div>
                      <div className="text-ink-800">
                        <span className="text-ink-400">В:</span> {o.unloading_address || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-ink-600">
                      <div>{contact(o.loading_contact_name, o.loading_contact_phone)}</div>
                      <div>{contact(o.unloading_contact_name, o.unloading_contact_phone)}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-ink-700">
                      {formatDate(o.delivery_deadline)}
                    </td>
                    <td className="px-4 py-3 align-top text-right font-medium text-ink-900">
                      {formatMoney(o.rate)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {o.status === 'done' ? (
                        <Badge tone="done">Завершена</Badge>
                      ) : (
                        <Badge tone="active">Активна</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(o)}
                          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Редактировать"
                          title="Редактировать"
                        >
                          <FiEdit2 size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(o)}
                          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label="Удалить"
                          title="Удалить"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        <div className="flex items-center justify-between border-t border-ink-200 px-4 py-3">
          <span className="text-xs text-ink-500">
            Страница {page} из {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              <FiChevronLeft size={16} />
              Назад
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Вперёд
              <FiChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Модалки */}
      <OrderForm
        open={formOpen}
        order={editing}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteBusy}
        title="Удалить заявку"
        message={
          deleting
            ? `Заявка № ${deleting.order_number || '—'} будет удалена безвозвратно. Продолжить?`
            : ''
        }
      />
    </div>
  )
}

/* ───────── вспомогательные компоненты и форматтеры ───────── */

function SkeletonRows() {
  return Array.from({ length: 5 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 7 }).map((__, j) => (
        <td key={j} className="px-4 py-4">
          <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-ink-100" />
        </td>
      ))}
    </tr>
  ))
}

function EmptyRow({ hasSearch, onCreate }) {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
            <FiInbox size={22} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-700">
            {hasSearch ? 'Ничего не найдено' : 'Пока нет ни одной заявки'}
          </p>
          <p className="mt-1 text-sm text-ink-500">
            {hasSearch
              ? 'Попробуйте изменить запрос.'
              : 'Создайте первую заявку, чтобы начать работу.'}
          </p>
          {!hasSearch && (
            <Button className="mt-4" size="sm" onClick={onCreate}>
              <FiPlus size={15} />
              Новая заявка
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}

function contact(name, phone) {
  if (!name && !phone) return '—'
  return [name, phone].filter(Boolean).join(', ')
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
