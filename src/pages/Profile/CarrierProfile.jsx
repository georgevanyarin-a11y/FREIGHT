import { useEffect, useState } from 'react'
import { FiSave, FiTruck, FiUser, FiCreditCard } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import CarrierDocuments from './CarrierDocuments'

const EMPTY = {
  full_name: '', inn: '', ogrnip: '',
  bank_name: '', bank_account: '', bank_bik: '', bank_corr_account: '',
  phone: '', email: '', address: '',
  vehicle_make: '', vehicle_plate: '', trailer_plate: '',
  body_type: '', capacity_t: '', volume_m3: ''
}

export default function CarrierProfile() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('carrier_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) setError('Не удалось загрузить профиль: ' + error.message)
      if (data) {
        const filled = { ...EMPTY }
        for (const k of Object.keys(EMPTY)) filled[k] = data[k] == null ? '' : String(data[k])
        setForm(filled)
      }
      setLoading(false)
    })()
    return () => { active = false }
  }, [user.id])

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const save = async () => {
    setSaving(true); setError(''); setMsg('')
    const num = (v) => (v === '' ? null : Number(v))
    const payload = {
      user_id: user.id,
      ...form,
      capacity_t: num(form.capacity_t),
      volume_m3: num(form.volume_m3),
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('carrier_profile').upsert(payload)
    setSaving(false)
    if (error) { setError('Не удалось сохранить: ' + error.message); return }
    setMsg('Профиль сохранён')
    setTimeout(() => setMsg(''), 2000)
  }

  if (loading) {
    return <div className="p-6 text-sm text-ink-500">Загрузка профиля…</div>
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Профиль перевозчика</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Заполните один раз — эти данные пойдут в счета, акты и в пакет документов для заказчика.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{msg}</div>}

      <div className="max-w-3xl space-y-5">
        {/* Данные ИП */}
        <Section icon={<FiUser size={15} />} title="Данные ИП">
          <Input label="ФИО / наименование ИП" value={form.full_name} onChange={set('full_name')} placeholder="ИП Иванов Иван Иванович" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="ИНН" value={form.inn} onChange={set('inn')} />
            <Input label="ОГРНИП" value={form.ogrnip} onChange={set('ogrnip')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Телефон" value={form.phone} onChange={set('phone')} />
            <Input label="Email" value={form.email} onChange={set('email')} />
          </div>
          <Input label="Адрес (юридический/почтовый)" value={form.address} onChange={set('address')} />
        </Section>

        {/* Банк */}
        <Section icon={<FiCreditCard size={15} />} title="Банковские реквизиты">
          <Input label="Банк" value={form.bank_name} onChange={set('bank_name')} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Расчётный счёт" value={form.bank_account} onChange={set('bank_account')} />
            <Input label="БИК" value={form.bank_bik} onChange={set('bank_bik')} />
          </div>
          <Input label="Корр. счёт" value={form.bank_corr_account} onChange={set('bank_corr_account')} />
        </Section>

        {/* Транспорт */}
        <Section icon={<FiTruck size={15} />} title="Транспорт">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Марка ТС" value={form.vehicle_make} onChange={set('vehicle_make')} placeholder="КамАЗ 5490" />
            <Input label="Тип кузова" value={form.body_type} onChange={set('body_type')} placeholder="тент / рефрижератор" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Госномер тягача" value={form.vehicle_plate} onChange={set('vehicle_plate')} />
            <Input label="Госномер прицепа" value={form.trailer_plate} onChange={set('trailer_plate')} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Грузоподъёмность, т" type="number" min="0" step="0.1" value={form.capacity_t} onChange={set('capacity_t')} />
            <Input label="Объём, м³" type="number" min="0" step="0.1" value={form.volume_m3} onChange={set('volume_m3')} />
          </div>
        </Section>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <FiSave size={16} />{saving ? 'Сохранение…' : 'Сохранить профиль'}
          </Button>
        </div>

        {/* Документы перевозчика */}
        <CarrierDocuments />
      </div>
    </div>
  )
}

function Section({ icon, title, children }) {
  return (
    <fieldset className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
      <legend className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
        {icon}{title}
      </legend>
      <div className="space-y-4">{children}</div>
    </fieldset>
  )
}
