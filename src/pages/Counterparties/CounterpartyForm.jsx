import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'

const RELIABILITY = [
  { value: 'unknown', label: 'Не оценён' },
  { value: 'good', label: 'Надёжный' },
  { value: 'watch', label: 'С осторожностью' },
  { value: 'bad', label: 'Проблемный' }
]

const EMPTY = {
  name: '', inn: '', kpp: '', ogrn: '', address: '',
  contact_name: '', phone: '', email: '',
  bank_name: '', bank_account: '', bank_bik: '',
  reliability: 'unknown', note: ''
}

function fromRow(row) {
  const f = { ...EMPTY }
  for (const k of Object.keys(EMPTY)) f[k] = row[k] == null ? '' : String(row[k])
  if (!f.reliability) f.reliability = 'unknown'
  return f
}

export default function CounterpartyForm({ open, counterparty, onClose, onSaved }) {
  const { user } = useAuth()
  const isEdit = Boolean(counterparty?.id)
  const [form, setForm] = useState(() => (counterparty ? fromRow(counterparty) : { ...EMPTY }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Укажите наименование заказчика.'); return }
    setSaving(true); setError('')
    const payload = { ...form, user_id: user.id }
    const result = isEdit
      ? await supabase.from('counterparties').update(payload).eq('id', counterparty.id).select().single()
      : await supabase.from('counterparties').insert(payload).select().single()
    setSaving(false)
    if (result.error) { setError('Не удалось сохранить: ' + result.error.message); return }
    onSaved?.(result.data)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? 'Редактирование заказчика' : 'Новый заказчик'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Отмена</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Наименование" value={form.name} onChange={set('name')} placeholder="ООО «Грузовик»" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="ИНН" value={form.inn} onChange={set('inn')} />
          <Input label="КПП" value={form.kpp} onChange={set('kpp')} />
          <Input label="ОГРН" value={form.ogrn} onChange={set('ogrn')} />
        </div>
        <Input label="Адрес" value={form.address} onChange={set('address')} />

        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Контакты</legend>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Контактное лицо" value={form.contact_name} onChange={set('contact_name')} />
              <Input label="Телефон" value={form.phone} onChange={set('phone')} />
              <Input label="Email" value={form.email} onChange={set('email')} />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-ink-200 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Банк (для счетов)</legend>
          <div className="space-y-4">
            <Input label="Банк" value={form.bank_name} onChange={set('bank_name')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Расчётный счёт" value={form.bank_account} onChange={set('bank_account')} />
              <Input label="БИК" value={form.bank_bik} onChange={set('bank_bik')} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Надёжность" value={form.reliability} onChange={set('reliability')} options={RELIABILITY} />
        </div>
        <Textarea label="Заметка" rows={2} value={form.note} onChange={set('note')} />

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>
    </Modal>
  )
}
