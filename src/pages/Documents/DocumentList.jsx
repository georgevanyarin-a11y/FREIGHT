import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FiPlus,
  FiTrash2,
  FiExternalLink,
  FiInbox,
  FiFileText,
  FiUploadCloud
} from 'react-icons/fi'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const BUCKET = 'documents'
const MAX_SIZE = 50 * 1024 * 1024 // 50 МБ — клиентский лимит на файл

export default function DocumentList() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setLoadError('Не удалось загрузить список документов: ' + error.message)
      setDocs([])
    } else {
      setDocs(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  // Открыть файл: бакет приватный, поэтому делаем временную подписанную ссылку
  const openDoc = async (doc) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.file_path, 60)
    if (error) {
      setLoadError('Не удалось открыть файл: ' + error.message)
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    // Сначала удаляем файл из хранилища, затем запись из таблицы
    const { error: storageErr } = await supabase.storage
      .from(BUCKET)
      .remove([deleting.file_path])

    if (storageErr) {
      setDeleteBusy(false)
      setLoadError('Не удалось удалить файл: ' + storageErr.message)
      return
    }

    const { error: rowErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', deleting.id)

    setDeleteBusy(false)
    if (rowErr) {
      setLoadError('Файл удалён, но запись не убралась: ' + rowErr.message)
    }
    setDeleting(null)
    fetchDocs()
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Документы</h1>
          <p className="mt-0.5 text-sm text-ink-500">
            PDF-файлы по заявкам и контрагентам. Доступны только вам.
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <FiPlus size={16} />
          Загрузить документ
        </Button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-3 font-semibold">Документ</th>
                <th className="px-4 py-3 font-semibold">Файл</th>
                <th className="px-4 py-3 text-right font-semibold">Размер</th>
                <th className="px-4 py-3 font-semibold">Добавлен</th>
                <th className="px-4 py-3 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading ? (
                <SkeletonRows />
              ) : docs.length === 0 ? (
                <EmptyRow onUpload={() => setUploadOpen(true)} />
              ) : (
                docs.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-ink-50">
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <FiFileText size={16} />
                        </span>
                        <span className="font-medium text-ink-900">
                          {d.title || d.file_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-ink-600">{d.file_name}</td>
                    <td className="px-4 py-3 align-middle text-right text-ink-700">
                      {formatSize(d.file_size)}
                    </td>
                    <td className="px-4 py-3 align-middle text-ink-700">
                      {formatDate(d.created_at)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDoc(d)}
                          className="rounded-lg p-2 text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700"
                          aria-label="Открыть"
                          title="Открыть"
                        >
                          <FiExternalLink size={15} />
                        </button>
                        <button
                          onClick={() => setDeleting(d)}
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
      </div>

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          setUploadOpen(false)
          fetchDocs()
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteBusy}
        title="Удалить документ"
        message={
          deleting
            ? `Файл «${deleting.title || deleting.file_name}» будет удалён безвозвратно. Продолжить?`
            : ''
        }
      />
    </div>
  )
}

/* ───────────────────────── Модальное окно загрузки ───────────────────────── */

function UploadModal({ open, onClose, onUploaded }) {
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setTitle('')
    setFile(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null
    setError('')
    if (!f) {
      setFile(null)
      return
    }
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Можно загружать только PDF-файлы.')
      setFile(null)
      return
    }
    if (f.size > MAX_SIZE) {
      setError('Файл слишком большой (максимум 50 МБ).')
      setFile(null)
      return
    }
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ''))
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите PDF-файл.')
      return
    }
    setBusy(true)
    setError('')

    // Путь: {user_id}/таймстамп-безопасное_имя — первая папка проверяется политикой
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${user.id}/${Date.now()}-${safeName}`

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: 'application/pdf', upsert: false })

    if (upErr) {
      setBusy(false)
      setError('Ошибка загрузки файла: ' + upErr.message)
      return
    }

    const { error: rowErr } = await supabase.from('documents').insert({
      user_id: user.id,
      title: title.trim() || file.name,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: 'application/pdf'
    })

    setBusy(false)

    if (rowErr) {
      // Откатываем загруженный файл, чтобы не остался «осиротевшим»
      await supabase.storage.from(BUCKET).remove([path])
      setError('Не удалось сохранить документ: ' + rowErr.message)
      return
    }

    reset()
    onUploaded()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Загрузить документ"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={handleUpload} disabled={busy || !file}>
            {busy ? 'Загрузка…' : 'Загрузить'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Название (необязательно)"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Договор-заявка № 2024-014"
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-700">PDF-файл</span>
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl
              border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-8 text-center
              transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            <FiUploadCloud size={26} className="text-ink-400" />
            <span className="mt-2 text-sm font-medium text-ink-700">
              {file ? file.name : 'Нажмите, чтобы выбрать файл'}
            </span>
            <span className="mt-0.5 text-xs text-ink-400">
              {file ? formatSize(file.size) : 'Только PDF, до 50 МБ'}
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={pickFile}
            />
          </label>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </div>
    </Modal>
  )
}

/* ─────────────────────── вспомогательные элементы ─────────────────────── */

function SkeletonRows() {
  return Array.from({ length: 4 }).map((_, i) => (
    <tr key={i}>
      {Array.from({ length: 5 }).map((__, j) => (
        <td key={j} className="px-4 py-4">
          <div className="h-3.5 w-full max-w-[140px] animate-pulse rounded bg-ink-100" />
        </td>
      ))}
    </tr>
  ))
}

function EmptyRow({ onUpload }) {
  return (
    <tr>
      <td colSpan={5} className="px-4 py-16">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-ink-400">
            <FiInbox size={22} />
          </span>
          <p className="mt-3 text-sm font-medium text-ink-700">Пока нет документов</p>
          <p className="mt-1 text-sm text-ink-500">
            Загрузите первый PDF, чтобы он хранился здесь.
          </p>
          <Button className="mt-4" size="sm" onClick={onUpload}>
            <FiPlus size={15} />
            Загрузить документ
          </Button>
        </div>
      </td>
    </tr>
  )
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes < 1024) return bytes + ' Б'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ'
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
