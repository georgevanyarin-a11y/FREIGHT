import { useEffect, useState } from 'react'
import { FiSend, FiFile, FiCheckSquare, FiSquare } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Button from '../../components/ui/Button'

export default function SendPacketModal({ open, counterparty, onClose }) {
  const [profile, setProfile] = useState(null)
  const [docs, setDocs] = useState([])
  const [selected, setSelected] = useState({})
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true); setError(''); setSuccess('')
      const [{ data: prof }, { data: documents }] = await Promise.all([
        supabase.from('carrier_profile').select('*').maybeSingle(),
        supabase.from('carrier_documents').select('*').order('created_at', { ascending: false })
      ])
      if (!active) return
      setProfile(prof || null)
      setDocs(documents || [])
      setSelected(Object.fromEntries((documents || []).map((d) => [d.id, true])))
      setTo(counterparty?.email || '')
      setSubject(`Документы перевозчика${prof?.full_name ? ' — ' + prof.full_name : ''}`)
      setBody(defaultBody(prof))
      setLoading(false)
    })()
    return () => { active = false }
  }, [counterparty])

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))

  const send = async () => {
    setError(''); setSuccess('')
    if (!to) { setError('Укажите email получателя.'); return }
    setSending(true)
    try {
      const chosen = docs.filter((d) => selected[d.id])
      const attachments = []
      for (const d of chosen) {
        const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 600)
        if (error) throw new Error('Не удалось подготовить файл: ' + (d.file_name || ''))
        attachments.push({ filename: d.file_name || 'document', url: data.signedUrl })
      }

      const res = await fetch('/api/send-packet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html: toHtml(body), attachments })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Ошибка отправки.')
      setSuccess('Письмо отправлено.')
    } catch (e) {
      setError(e.message || 'Не удалось отправить.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Пакет документов${counterparty?.name ? ' — ' + counterparty.name : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>Закрыть</Button>
          <Button onClick={send} disabled={sending || loading}><FiSend size={15} />{sending ? 'Отправка…' : 'Отправить'}</Button>
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-ink-500">Загрузка…</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Resend в тестовом режиме отправляет письма только на ваш собственный email (на который зарегистрирован Resend).
            Для отправки заказчикам подтвердите домен в Resend.
          </div>

          <Input label="Кому (email)" value={to} onChange={(e) => setTo(e.target.value)} placeholder="client@example.ru" />
          <Input label="Тема" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea label="Текст письма" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />

          <div>
            <div className="mb-1.5 text-sm font-medium text-ink-700">Вложения (документы перевозчика)</div>
            {docs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-xs text-ink-500">
                В профиле нет загруженных документов. Добавьте их в разделе «Профиль перевозчика».
              </div>
            ) : (
              <ul className="space-y-1">
                {docs.map((d) => (
                  <li key={d.id}>
                    <button type="button" onClick={() => toggle(d.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-ink-50">
                      {selected[d.id] ? <FiCheckSquare size={16} className="shrink-0 text-emerald-600" /> : <FiSquare size={16} className="shrink-0 text-ink-300" />}
                      <FiFile size={14} className="shrink-0 text-ink-400" />
                      <span className="truncate text-ink-700">{d.title || d.file_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
        </div>
      )}
    </Modal>
  )
}

function defaultBody(p) {
  if (!p) return 'Здравствуйте!\n\nНаправляю документы перевозчика. Реквизиты заполните в профиле.'
  const vehicle = [p.vehicle_make, p.vehicle_plate].filter(Boolean).join(' ')
  const trailer = p.trailer_plate ? ` + прицеп ${p.trailer_plate}` : ''
  const lines = [
    'Здравствуйте!',
    '',
    'Направляю реквизиты и документы перевозчика для оформления договора-заявки.',
    '',
    `Перевозчик: ${p.full_name || ''}`,
    p.inn ? `ИНН: ${p.inn}` : '',
    p.ogrnip ? `ОГРНИП: ${p.ogrnip}` : '',
    p.phone ? `Телефон: ${p.phone}` : '',
    (vehicle || p.body_type || p.capacity_t)
      ? `Транспорт: ${vehicle}${trailer}${p.body_type ? ', ' + p.body_type : ''}${p.capacity_t ? ', г/п ' + p.capacity_t + ' т' : ''}`
      : '',
    '',
    'Банковские реквизиты:',
    p.bank_name ? `Банк: ${p.bank_name}` : '',
    p.bank_account ? `Р/с: ${p.bank_account}` : '',
    p.bank_bik ? `БИК: ${p.bank_bik}` : '',
    p.bank_corr_account ? `К/с: ${p.bank_corr_account}` : '',
    '',
    'Документы — во вложении.',
    '',
    `С уважением, ${p.full_name || ''}`,
    p.phone || ''
  ]
  return lines.filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n')
}

function toHtml(text) {
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<div style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${esc.replace(/\n/g, '<br>')}</div>`
}
