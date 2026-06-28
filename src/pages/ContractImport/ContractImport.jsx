import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiUploadCloud, FiCpu, FiCheckCircle, FiArrowRight, FiCopy, FiTerminal } from 'react-icons/fi'
import { analyzeContractPdf } from '../../lib/contractAI'
import OrderForm from '../Orders/OrderForm'
import Button from '../../components/ui/Button'

export default function ContractImport() {
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [initialData, setInitialData] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [created, setCreated] = useState(null)
  const [debug, setDebug] = useState(null)
  const [copied, setCopied] = useState(false)

  const pickFile = (e) => {
    const f = e.target.files?.[0] || null
    setError('')
    if (!f) return setFile(null)
    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) { setError('Можно загружать только PDF-файлы.'); return setFile(null) }
    setFile(f)
  }

  const handleAnalyze = async () => {
    if (!file) return setError('Выберите PDF договора.')
    setAnalyzing(true)
    setError('')
    setDebug(null)
    try {
      const { fields, debug } = await analyzeContractPdf(file)
      setDebug(debug)
      setInitialData(fields)
      setFormOpen(true)
    } catch (err) {
      setError(err.message || 'Не удалось распознать договор.')
      if (err.debug) setDebug(err.debug)
    } finally {
      setAnalyzing(false)
    }
  }

  const restart = () => {
    setCreated(null)
    setFile(null)
    setInitialData(null)
    setDebug(null)
  }

  const logText = debug ? buildLog(debug) : ''

  const copyLog = async () => {
    try {
      await navigator.clipboard.writeText(logText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* пользователь может выделить текст вручную */
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-900">Анализ договора</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Загрузите PDF договора — ИИ распознает данные и подготовит заявку. Перед сохранением вы всё проверите.
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {!created ? (
        <div className="max-w-xl rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 bg-ink-50 px-4 py-10 text-center transition-colors hover:border-brand-300 hover:bg-brand-50">
            <FiUploadCloud size={30} className="text-ink-400" />
            <span className="mt-2 text-sm font-medium text-ink-700">
              {file ? file.name : 'Нажмите, чтобы выбрать PDF договора'}
            </span>
            <span className="mt-0.5 text-xs text-ink-400">Только PDF</span>
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={pickFile} />
          </label>

          <Button className="mt-5 w-full" onClick={handleAnalyze} disabled={analyzing || !file}>
            {analyzing ? (
              <><FiCpu size={16} className="animate-pulse" />Распознаю договор…</>
            ) : (
              <><FiCpu size={16} />Распознать договор</>
            )}
          </Button>

          <p className="mt-3 text-xs text-ink-400">
            Содержимое файла отправляется в сервис ИИ для распознавания. Не загружайте документы с
            особо чувствительными данными.
          </p>
        </div>
      ) : (
        <div className="max-w-xl rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-card">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FiCheckCircle size={24} />
          </span>
          <h2 className="mt-4 text-base font-semibold text-ink-900">Заявка создана</h2>
          <div className="mx-auto mt-3 flex max-w-xs flex-col gap-1.5 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-ink-500">Внутренний номер</span>
              <span className="font-semibold text-ink-900">{created.internal_number}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
              <span className="text-ink-500">Номер заказчика</span>
              <span className="font-semibold text-ink-900">{created.order_number || '—'}</span>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="secondary" onClick={restart}>Загрузить ещё</Button>
            <Button onClick={() => navigate('/orders')}>К заявкам<FiArrowRight size={15} /></Button>
          </div>
        </div>
      )}

      {/* Панель диагностики: появляется после распознавания */}
      {debug && (
        <div className="mt-6 max-w-3xl rounded-2xl border border-ink-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-ink-700">
              <FiTerminal size={15} className="text-ink-400" />
              Технические данные (для диагностики)
            </div>
            <Button size="sm" variant="secondary" onClick={copyLog}>
              <FiCopy size={14} />
              {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
          </div>
          <div className="px-4 py-3">
            <p className="mb-2 text-xs text-ink-500">
              Если распозналось неверно — нажмите «Скопировать» и пришлите этот текст.
            </p>
            <textarea
              readOnly
              value={logText}
              onClick={(e) => e.target.select()}
              className="h-64 w-full resize-y rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs text-ink-700"
            />
          </div>
        </div>
      )}

      {/* Форма открывается только когда готовы данные — поэтому подхватывает их корректно */}
      {formOpen && (
        <OrderForm
          open
          initialData={initialData}
          onClose={() => setFormOpen(false)}
          onSaved={(o) => { setFormOpen(false); setCreated(o) }}
        />
      )}
    </div>
  )
}

// Формируем читаемый лог для отправки
function buildLog(debug) {
  const parts = []
  parts.push('=== РЕЖИМ ВВОДА ===')
  parts.push(debug.inputMode === 'vision' ? 'картинки (скан)' : 'текст из PDF')
  parts.push('')
  parts.push('=== МОДЕЛЬ ===')
  parts.push(String(debug.model || '—'))
  parts.push('')
  if (debug.inputMode === 'text') {
    parts.push('=== ИЗВЛЕЧЁННЫЙ ТЕКСТ (превью) ===')
    parts.push('символов всего: ' + (debug.textChars ?? '—'))
    parts.push(String(debug.textPreview || '(пусто)'))
    parts.push('')
  } else {
    parts.push('=== СТРАНИЦ ОТПРАВЛЕНО ===')
    parts.push(String(debug.pages ?? '—'))
    parts.push('')
  }
  if (debug.parseError) {
    parts.push('=== ОШИБКА РАЗБОРА ОТВЕТА ===')
    parts.push(String(debug.parseError))
    parts.push('')
  }
  parts.push('=== СЫРОЙ ОТВЕТ GIGACHAT ===')
  parts.push(String(debug.raw || '(пусто)'))
  parts.push('')
  if (debug.parsed) {
    parts.push('=== РАЗОБРАНО (JSON) ===')
    try {
      parts.push(JSON.stringify(debug.parsed, null, 2))
    } catch {
      parts.push('(не удалось показать)')
    }
    parts.push('')
  }
  parts.push('=== ПРОМПТ ===')
  parts.push(String(debug.prompt || '—'))
  return parts.join('\n')
}
