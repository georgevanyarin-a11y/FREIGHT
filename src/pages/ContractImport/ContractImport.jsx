import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiUploadCloud,
  FiCpu,
  FiCheckCircle,
  FiArrowRight,
  FiRefreshCw
} from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import { analyzeContractPdf } from '../../lib/contractAI'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'

const MAX_SIZE = 50 * 1024 * 1024

const emptyForm = {
  customer_number: '',
  loading_address: '',
  unloading_address: '',
  loading_contact_name: '',
  loading_contact_phone: '',
  unloading_contact_name: '',
  unloading_contact_phone: '',
  delivery_deadline: '',
  rate: '',
  note: ''
}

// Этапы: 'upload' → 'review' → 'done'
export default function ContractImport() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stage, setStage] = useState('upload')
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState(emptyForm)
  const [internalNumber, setInternalNumber] = useState(null)
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null
    setError('')
    if (!f) return setFile(null)
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Можно загружать только PDF-файлы.')
      return setFile(null)
    }
    if (f.size > MAX_SIZE) {
      setError('Файл слишком большой (максимум 50 МБ).')
      return setFile(null)
    }
    setFile(f)
  }

  const handleAnalyze = async () => {
    if (!file) return setError('Выберите PDF-файл договора.')
    setAnalyzing(true)
    setError('')
    try {
      const extracted = await analyzeContractPdf(file)
      // Параллельно узнаём следующий внутренний номер
      const { data: nextNum, error: numErr } = await supabase.rpc('next_internal_number')
      if (numErr) throw new Error('Не удалось получить номер заявки: ' + numErr.message)

      setForm({ ...emptyForm, ...extracted })
      setInternalNumber(nextNum)
      setStage('review')
    } catch (err) {
      setError(err.message || 'Не удалось распознать договор.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      internal_number: internalNumber,
      order_number: form.customer_number || null, // номер заказчика
      order_date: new Date().toISOString().slice(0, 10),
      loading_address: form.loading_address,
      unloading_address: form.unloading_address,
      loading_contact_name: form.loading_contact_name,
      loading_contact_phone: form.loading_contact_phone,
      unloading_contact_name: form.unloading_contact_name,
      unloading_contact_phone: form.unloading_contact_phone,
      delivery_deadline: form.delivery_deadline || null,
      rate: form.rate === '' ? null : Number(form.rate),
      status: 'active',
      note: form.note
    }

    const { data, error: insErr } = await supabase
      .from('orders')
      .insert(payload)
      .select()
      .single()

    setSaving(false)
    if (insErr) {
      setError('Не удалось создать заявку: ' + insErr.message)
      return
    }
    setCreated(data)
    setStage('done')
  }

  const restart = () => {
    setStage('upload')
    setFile(null)
    setForm(emptyForm)
    setInternalNumber(null)
    setCreated(null)
    setError('')
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Анализ договора</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Загрузите PDF договора — ИИ распознает данные и подготовит заявку.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* ЭТАП 1 — загрузка */}
      {stage === 'upload' && (
        <div className="max-w-xl rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl
              border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-10 text-center
              transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <FiUploadCloud size={30} className="text-ink-400" />
            <span className="mt-2 text-sm font-medium text-ink-700">
              {file ? file.name : 'Нажмите, чтобы выбрать PDF договора'}
            </span>
            <span className="mt-0.5 text-xs text-ink-400">Только PDF, до 50 МБ</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={pickFile} />
          </label>

          <Button className="mt-5 w-full" onClick={handleAnalyze} disabled={analyzing || !file}>
            {analyzing ? (
              <>
                <FiCpu size={16} className="animate-pulse" />
                Распознаю договор…
              </>
            ) : (
              <>
                <FiCpu size={16} />
                Распознать договор
              </>
            )}
          </Button>

          <p className="mt-3 text-xs text-ink-400">
            Содержимое файла отправляется в сервис ИИ для распознавания. Не загружайте
            документы с особо чувствительными данными.
          </p>
        </div>
      )}

      {/* ЭТАП 2 — проверка и правка */}
      {stage === 'review' && (
        <div className="max-w-3xl space-y-5">
          <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
            Данные распознаны. Проверьте и при необходимости поправьте — затем создайте заявку.
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Внутренний номер (присвоен автоматически)" value={internalNumber ?? ''} readOnly className="[&_input]:bg-ink-50" />
              <Input label="Номер заказчика" name="customer_number" value={form.customer_number} onChange={set('customer_number')} placeholder="из договора" />
            </div>

            <fieldset className="mt-4 rounded-xl border border-ink-200 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Погрузка</legend>
              <div className="space-y-4">
                <Input label="Адрес погрузки" name="loading_address" value={form.loading_address} onChange={set('loading_address')} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Контакт (имя)" name="loading_contact_name" value={form.loading_contact_name} onChange={set('loading_contact_name')} />
                  <Input label="Телефон" name="loading_contact_phone" value={form.loading_contact_phone} onChange={set('loading_contact_phone')} />
                </div>
              </div>
            </fieldset>

            <fieldset className="mt-4 rounded-xl border border-ink-200 p-4">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Выгрузка</legend>
              <div className="space-y-4">
                <Input label="Адрес выгрузки" name="unloading_address" value={form.unloading_address} onChange={set('unloading_address')} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Контакт (имя)" name="unloading_contact_name" value={form.unloading_contact_name} onChange={set('unloading_contact_name')} />
                  <Input label="Телефон" name="unloading_contact_phone" value={form.unloading_contact_phone} onChange={set('unloading_contact_phone')} />
                </div>
              </div>
            </fieldset>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Срок доставки" name="delivery_deadline" type="date" value={form.delivery_deadline} onChange={set('delivery_deadline')} />
              <Input label="Ставка, ₽" name="rate" type="number" min="0" step="0.01" value={form.rate} onChange={set('rate')} />
            </div>

            <Textarea className="mt-4" label="Примечание" name="note" rows={3} value={form.note} onChange={set('note')} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={restart} disabled={saving}>
              <FiRefreshCw size={15} />
              Другой файл
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Создание…' : 'Создать заявку'}
            </Button>
          </div>
        </div>
      )}

      {/* ЭТАП 3 — успех */}
      {stage === 'done' && created && (
        <div className="max-w-xl rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FiCheckCircle size={24} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink-900">Заявка создана</h2>
          <div className="mx-auto mt-3 flex max-w-xs flex-col gap-1.5 text-sm">
            <Row label="Внутренний номер" value={created.internal_number} />
            <Row label="Номер заказчика" value={created.order_number || '—'} />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={restart}>
              Загрузить ещё
            </Button>
            <Button onClick={() => navigate('/orders')}>
              К заявкам
              <FiArrowRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
      <span className="text-ink-500">{label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  )
}
