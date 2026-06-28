import { useCallback, useEffect, useState } from 'react'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiUsers, FiPhone, FiMail, FiEye } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import CounterpartyForm from './CounterpartyForm'
import CounterpartyView from './CounterpartyView'

const RELIABILITY_VIEW = {
  good: { label: 'Надёжный', tone: 'done' },
  watch: { label: 'С осторожностью', tone: 'active' },
  bad: { label: 'Проблемный', tone: 'active' },
  unknown: { label: 'Не оценён', tone: 'active' }
}

export default function CounterpartyList() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [delBusy, setDelBusy] = useState(false)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    let query = supabase.from('counterparties').select('*').order('name', { ascending: true })
    const term = search.trim()
    if (term) query = query.or(`name.ilike.%${term}%,inn.ilike.%${term}%,contact_name.ilike.%${term}%`)
    const { data, error } = await query
    if (error) setError('Не удалось загрузить: ' + error.message)
    else setItems(data || [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (c) => { setEditing(c); setFormOpen(true) }
  const onSaved = () => { setFormOpen(false); setEditing(null); load() }

  const remove = async () => {
    if (!deleting) return
    setDelBusy(true)
    const { error } = await supabase.from('counterparties').delete().eq('id', deleting.id)
    setDelBusy(false)
    if (error) { setError('Не удалось удалить: ' + error.message); return }
    setDeleting(null); load()
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Контрагенты</h1>
          <p className="mt-0.5 text-sm text-ink-500">Заказчики: реквизиты, контакты, надёжность</p>
        </div>
        <Button onClick={openCreate}><FiPlus size={16} />Новый заказчик</Button>
      </div>

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <FiSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию, ИНН, контакту" className="[&_input]:pl-9" />
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-sm text-ink-500">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white px-4 py-16 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400"><FiUsers size={22} /></span>
          <p className="mt-3 text-sm font-medium text-ink-700">{search ? 'Ничего не найдено' : 'Пока нет заказчиков'}</p>
          {!search && <Button className="mt-4" size="sm" onClick={openCreate}><FiPlus size={15} />Добавить заказчика</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const rel = RELIABILITY_VIEW[c.reliability] || RELIABILITY_VIEW.unknown
            return (
              <div key={c.id} className="rounded-2xl border border-ink-200 bg-white p-4 shadow-card">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink-900">{c.name}</div>
                    {c.inn && <div className="text-xs text-ink-400">ИНН {c.inn}</div>}
                  </div>
                  <Badge tone={rel.tone}>{rel.label}</Badge>
                </div>
                <div className="space-y-1 text-sm text-ink-600">
                  {c.contact_name && <div className="truncate">{c.contact_name}</div>}
                  {c.phone && <div className="flex items-center gap-1.5 text-ink-500"><FiPhone size={13} />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-1.5 truncate text-ink-500"><FiMail size={13} />{c.email}</div>}
                </div>
                <div className="mt-3 flex justify-end gap-1 border-t border-ink-100 pt-2">
                  <button onClick={() => setViewing(c)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-ink-700" title="Просмотр"><FiEye size={15} /></button>
                  <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" title="Редактировать"><FiEdit2 size={15} /></button>
                  <button onClick={() => setDeleting(c)} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600" title="Удалить"><FiTrash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {formOpen && (
        <CounterpartyForm open counterparty={editing} onClose={() => setFormOpen(false)} onSaved={onSaved} />
      )}

      {viewing && (
        <CounterpartyView
          open
          counterparty={viewing}
          onClose={() => setViewing(null)}
          onEdit={(c) => { setViewing(null); openEdit(c) }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={delBusy}
        title="Удалить заказчика"
        message={deleting ? `Удалить «${deleting.name}»? Это не затронет уже созданные заявки.` : ''}
      />
    </div>
  )
}
