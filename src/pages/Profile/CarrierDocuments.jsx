import { useCallback, useEffect, useRef, useState } from 'react'
import { FiUploadCloud, FiFile, FiTrash2, FiDownload, FiAlertTriangle } from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const DOC_TYPES = [
  { value: 'passport', label: 'Паспорт' },
  { value: 'inn', label: 'Свидетельство ИНН' },
  { value: 'ogrnip', label: 'Лист ОГРНИП' },
  { value: 'sts', label: 'СТС (на ТС)' },
  { value: 'license', label: 'Водительское удостоверение' },
  { value: 'osago', label: 'Страховка ОСАГО' },
  { value: 'contract', label: 'Договор на ТС / аренды' },
  { value: 'partner_card', label: 'Карточка партнёра / реквизиты' },
  { value: 'other', label: 'Другое' }
]
const typeLabel = (v) => DOC_TYPES.find((t) => t.value === v)?.label || 'Документ'
const BUCKET = 'documents'

export default function CarrierDocuments() {
  const { user } = useAuth()
  const fileRef = useRef(null)

  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [file, setFile] = useState(null)
  const [docType, setDocType] = useState('passport')
  const [title, setTitle] = useState('')
  const [expires, setExpires] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [delBusy, setDelBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('carrier_documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) setError('Не удалось загрузить документы: ' + error.message)
    else setDocs(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  const upload = async () => {
    if (!file) { setError('Выберите файл.'); return }
    setUploading(true); setError('')
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${user.id}/carrier/${Date.now()}_${safeName}`

    const up = await supabase.storage.from(BUCKET).upload(path, file)
    if (up.error) { setUploading(false); setError('Ошибка загрузки файла: ' + up.error.message); return }

    const ins = await supabase.from('carrier_documents').insert({
      user_id: user.id,
      doc_type: docType,
      title: title || typeLabel(docType),
      file_path: path,
      file_name: file.name,
      expires_on: expires || null
    })
    setUploading(false)
    if (ins.error) { setError('Ошибка сохранения записи: ' + ins.error.message); return }

    setFile(null); setTitle(''); setExpires(''); setDocType('passport')
    if (fileRef.current) fileRef.current.value = ''
    load()
  }

  const download = async (doc) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60)
    if (error) { setError('Не удалось открыть файл: ' + error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  const remove = async () => {
    if (!deleting) return
    setDelBusy(true)
    await supabase.storage.from(BUCKET).remove([deleting.file_path])
    const { error } = await supabase.from('carrier_documents').delete().eq('id', deleting.id)
    setDelBusy(false)
    if (error) { setError('Не удалось удалить: ' + error.message); return }
    setDeleting(null)
    load()
  }

  const isExpiringSoon = (d) => {
    if (!d) return false
    const days = (new Date(d) - new Date()) / 86400000
    return days <= 30
  }

  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-card">
      <h2 className="mb-1 text-sm font-semibold text-ink-900">Документы перевозчика</h2>
      <p className="mb-4 text-xs text-ink-500">
        Загрузите сканы (паспорт, СТС, ВУ, ОСАГО, реквизиты) — отсюда они пойдут в пакет для заказчика.
      </p>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Форма загрузки */}
      <div className="mb-5 rounded-xl border border-ink-200 bg-ink-50 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label="Тип документа" value={docType} onChange={(e) => setDocType(e.target.value)} options={DOC_TYPES} />
          <Input label="Название (необязательно)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={typeLabel(docType)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-700">Файл</label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:text-brand-700"
            />
          </div>
          <Input label="Срок действия (если есть)" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={upload} disabled={uploading || !file}>
            <FiUploadCloud size={15} />{uploading ? 'Загрузка…' : 'Загрузить'}
          </Button>
        </div>
      </div>

      {/* Список */}
      {loading ? (
        <div className="text-sm text-ink-500">Загрузка…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500">
          Пока нет загруженных документов.
        </div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                <FiFile size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-900">{d.title || typeLabel(d.doc_type)}</div>
                <div className="truncate text-xs text-ink-400">{typeLabel(d.doc_type)} · {d.file_name}</div>
                {d.expires_on && (
                  <div className={`mt-0.5 flex items-center gap-1 text-xs ${isExpiringSoon(d.expires_on) ? 'text-amber-600' : 'text-ink-400'}`}>
                    {isExpiringSoon(d.expires_on) && <FiAlertTriangle size={12} />}
                    действует до {formatDate(d.expires_on)}
                  </div>
                )}
              </div>
              <button onClick={() => download(d)} className="rounded-lg p-2 text-ink-500 hover:bg-brand-50 hover:text-brand-700" title="Открыть">
                <FiDownload size={15} />
              </button>
              <button onClick={() => setDeleting(d)} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600" title="Удалить">
                <FiTrash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={delBusy}
        title="Удалить документ"
        message={deleting ? `Удалить «${deleting.title || deleting.file_name}»? Файл будет удалён безвозвратно.` : ''}
      />
    </div>
  )
}

function formatDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
