import { useState } from 'react'
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

// Пустая заявка для режима создания
const emptyOrder = {
  order_number: '',
  order_date: new Date().toISOString().slice(0, 10),
  loading_address: '',
  unloading_address: '',
  loading_contact_name: '',
  loading_contact_phone: '',
  unloading_contact_name: '',
  unloading_contact_phone: '',
  delivery_deadline: '',
  rate: '',
  status: 'active',
  note: ''
}

/**
 * Форма заявки в модальном окне.
 * Если передан order — режим редактирования, иначе создание.
 * onSaved(order) вызывается после успешного сохранения.
 */
export default function OrderForm({ open, order, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(order?.id)

  const [form, setForm] = useState(() =>
    order ? { ...emptyOrder, ...sanitize(order) } : { ...emptyOrder }
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!form.order_number.trim()) {
      setError('Укажите номер заявки.')
      return
    }

    setSaving(true)

    // Готовим полезную нагрузку: пустые даты → null, ставка → число
    const payload = {
      ...form,
      order_date: form.order_date || null,
      delivery_deadline: form.delivery_deadline || null,
      rate: form.rate === '' ? null : Number(form.rate),
      user_id: user.id
    }

    let result
    if (isEdit) {
      result = await supabase
        .from('orders')
        .update(payload)
        .eq('id', order.id)
        .select()
        .single()
    } else {
      result = await supabase.from('orders').insert(payload).select().single()
    }

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
      title={isEdit ? `Редактирование заявки № ${order.order_number}` : 'Новая заявка'}
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
          <Input label="Номер заявки" name="order_number" value={form.order_number} onChange={set('order_number')} placeholder="2024-014" />
          <Input label="Дата" name="order_date" type="date" value={form.order_date || ''} onChange={set('order_date')} />
          <Select label="Статус" name="status" value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        </div>

        {/* Погрузка */}
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Погрузка
          </legend>
          <div className="space-y-4">
            <Input label="Адрес погрузки" name="loading_address" value={form.loading_address} onChange={set('loading_address')} placeholder="г. Москва, ул. Складская, 1" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Контакт (имя)" name="loading_contact_name" value={form.loading_contact_name} onChange={set('loading_contact_name')} placeholder="Иван" />
              <Input label="Телефон" name="loading_contact_phone" type="tel" value={form.loading_contact_phone} onChange={set('loading_contact_phone')} placeholder="+7 900 000-00-00" />
            </div>
          </div>
        </fieldset>

        {/* Выгрузка */}
        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Выгрузка
          </legend>
          <div className="space-y-4">
            <Input label="Адрес выгрузки" name="unloading_address" value={form.unloading_address} onChange={set('unloading_address')} placeholder="г. Казань, ул. Промышленная, 5" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Контакт (имя)" name="unloading_contact_name" value={form.unloading_contact_name} onChange={set('unloading_contact_name')} placeholder="Пётр" />
              <Input label="Телефон" name="unloading_contact_phone" type="tel" value={form.unloading_contact_phone} onChange={set('unloading_contact_phone')} placeholder="+7 900 000-00-00" />
            </div>
          </div>
        </fieldset>

        {/* Условия */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Срок доставки" name="delivery_deadline" type="date" value={form.delivery_deadline || ''} onChange={set('delivery_deadline')} />
          <Input label="Ставка, ₽" name="rate" type="number" inputMode="decimal" min="0" step="0.01" value={form.rate} onChange={set('rate')} placeholder="45000" />
        </div>

        <Textarea label="Примечание" name="note" rows={3} value={form.note} onChange={set('note')} placeholder="Особые условия, тип груза, требования к ТС…" />

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </form>
    </Modal>
  )
}

// Оставляем в форме только известные поля (из БД могут прийти лишние: id, created_at и т.п.)
function sanitize(order) {
  const out = {}
  for (const key of Object.keys(emptyOrder)) {
    if (order[key] !== null && order[key] !== undefined) out[key] = order[key]
  }
  return out
}
