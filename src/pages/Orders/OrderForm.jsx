import { useState } from 'react'
import { FiPlus, FiTrash2, FiMapPin } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Активна' },
  { value: 'done', label: 'Завершена' }
]
const KIND_OPTIONS = [
  { value: 'loading', label: 'Погрузка' },
  { value: 'unloading', label: 'Выгрузка' }
]

const emptyPoint = (kind = 'loading') => ({
  kind,
  address: '',
  date: '',
  time: '',
  contact_name: '',
  contact_phone: ''
})

const emptyForm = () => ({
  customer_number: '',
  order_date: new Date().toISOString().slice(0, 10),
  status: 'active',
  rate: '',
  vat_included: false,
  cargo: '',
  weight: '',
  volume: '',
  driver_name: '',
  driver_phone: '',
  vehicle_info: '',
  note: '',
  points: [emptyPoint('loading'), emptyPoint('unloading')]
})

// Преобразование строки заявки из БД в форму
function fromOrder(order) {
  const points =
    Array.isArray(order.points) && order.points.length
      ? order.points.map((p) => ({ ...emptyPoint(), ...p, kind: p.kind === 'unloading' ? 'unloading' : 'loading' }))
      : [emptyPoint('loading'), emptyPoint('unloading')]
  return {
    customer_number: order.order_number || '',
    order_date: order.order_date || '',
    status: order.status || 'active',
    rate: order.rate == null ? '' : String(order.rate),
    vat_included: !!order.vat_included,
    cargo: order.cargo || '',
    weight: order.weight == null ? '' : String(order.weight),
    volume: order.volume == null ? '' : String(order.volume),
    driver_name: order.driver_name || '',
    driver_phone: order.driver_phone || '',
    vehicle_info: order.vehicle_info || '',
    note: order.note || '',
    points
  }
}

/**
 * Форма заявки. Режимы:
 *  - order передан  → редактирование
 *  - initialData    → создание с предзаполнением (из анализа договора)
 *  - ничего         → пустое создание
 */
export default function OrderForm({ open, order, initialData, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(order?.id)

  const [form, setForm] = useState(() => {
    if (order) return fromOrder(order)
    if (initialData) {
      const base = emptyForm()
      const points =
        Array.isArray(initialData.points) && initialData.points.length
          ? initialData.points
          : base.points
      return { ...base, ...initialData, points }
    }
    return emptyForm()
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) =>
    setForm((f) => ({ ...f, [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const setPoint = (i, field) => (e) =>
    setForm((f) => {
      const points = [...f.points]
      points[i] = { ...points[i], [field]: e.target.value }
      return { ...f, points }
    })

  const addPoint = (kind) => setForm((f) => ({ ...f, points: [...f.points, emptyPoint(kind)] }))
  const removePoint = (i) => setForm((f) => ({ ...f, points: f.points.filter((_, idx) => idx !== i) }))

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setError('')
    setSaving(true)

    let internal = order?.internal_number ?? null
    if (!isEdit) {
      const { data: nextNum, error: numErr } = await supabase.rpc('next_internal_number')
      if (numErr) {
        setSaving(false)
        setError('Не удалось получить внутренний номер: ' + numErr.message)
        return
      }
      internal = nextNum
    }

    const num = (v) => (v === '' || v == null ? null : Number(v))
    const payload = {
      user_id: user.id,
      internal_number: internal,
      order_number: form.customer_number || null,
      order_date: form.order_date || null,
      status: form.status,
      rate: num(form.rate),
      vat_included: !!form.vat_included,
      cargo: form.cargo,
      weight: num(form.weight),
      volume: num(form.volume),
      driver_name: form.driver_name,
      driver_phone: form.driver_phone,
      vehicle_info: form.vehicle_info,
      note: form.note,
      points: form.points
    }

    const result = isEdit
      ? await supabase.from('orders').update(payload).eq('id', order.id).select().single()
      : await supabase.from('orders').insert(payload).select().single()

    setSaving(false)
    if (result.error) {
      setError('Не удалось сохранить заявку: ' + result.error.message)
      return
    }
    onSaved?.(result.data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Редактирование заявки № ${order.internal_number ?? ''}` : 'Новая заявка'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать заявку'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Основное */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Номер заказчика" name="customer_number" value={form.customer_number} onChange={set('customer_number')} placeholder="П №ТЛ1956" />
          <Input label="Дата подачи" name="order_date" type="date" value={form.order_date || ''} onChange={set('order_date')} />
          <Select label="Статус" name="status" value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <Input label="Ставка, ₽" name="rate" type="number" min="0" step="0.01" value={form.rate} onChange={set('rate')} placeholder="45000" className="w-40" />
          <label className="flex items-center gap-2 pb-2.5 text-sm text-ink-700">
            <input type="checkbox" checked={form.vat_included} onChange={set('vat_included')} className="h-4 w-4 rounded border-ink-300 text-brand-700" />
            Ставка с НДС
          </label>
        </div>

        {/* Маршрут */}
        <div className="rounded-xl border border-ink-200 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-700">Маршрут</span>
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="secondary" onClick={() => addPoint('loading')}>
                <FiPlus size={14} />Погрузка
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => addPoint('unloading')}>
                <FiPlus size={14} />Выгрузка
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {form.points.map((p, i) => (
              <div key={i} className="rounded-lg border border-ink-200 bg-ink-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiMapPin size={14} className={p.kind === 'unloading' ? 'text-emerald-600' : 'text-brand-600'} />
                    <select
                      value={p.kind}
                      onChange={setPoint(i, 'kind')}
                      className="h-8 rounded-md border border-ink-200 bg-white px-2 text-sm"
                    >
                      {KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {form.points.length > 1 && (
                    <button type="button" onClick={() => removePoint(i)} className="rounded p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Удалить точку">
                      <FiTrash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-2.5">
                  <Input label="Адрес" value={p.address} onChange={setPoint(i, 'address')} placeholder="Москва, Рябиновая улица, 28А, строение 3" />
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input label="Дата" type="date" value={p.date || ''} onChange={setPoint(i, 'date')} />
                    <Input label="Время" value={p.time} onChange={setPoint(i, 'time')} placeholder="08:00–16:00" />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input label="Контакт (имя)" value={p.contact_name} onChange={setPoint(i, 'contact_name')} />
                    <Input label="Телефон" value={p.contact_phone} onChange={setPoint(i, 'contact_phone')} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Груз и транспорт */}
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Груз и транспорт</legend>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Груз" name="cargo" value={form.cargo} onChange={set('cargo')} placeholder="текстиль" />
              <Input label="Вес, т" name="weight" type="number" min="0" step="0.01" value={form.weight} onChange={set('weight')} placeholder="3.5" />
              <Input label="Объём, м³" name="volume" type="number" min="0" step="0.01" value={form.volume} onChange={set('volume')} placeholder="15" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Водитель (ФИО)" name="driver_name" value={form.driver_name} onChange={set('driver_name')} />
              <Input label="Телефон водителя" name="driver_phone" value={form.driver_phone} onChange={set('driver_phone')} />
              <Input label="Транспорт (марка, гос. номер)" name="vehicle_info" value={form.vehicle_info} onChange={set('vehicle_info')} placeholder="ГАЗ, М321ЕР 21" />
            </div>
          </div>
        </fieldset>

        <Textarea label="Примечание" name="note" rows={2} value={form.note} onChange={set('note')} placeholder="Способ погрузки/разгрузки и прочие условия" />

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </form>
    </Modal>
  )
}
