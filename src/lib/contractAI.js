// Распознавание из PDF через GigaChat. Браузер кодирует PDF и шлёт на /api/analyze.

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3 МБ (ограничение тела запроса Vercel)

export async function analyzeContractPdf(file) {
  return callAnalyze(file, 'order', normalizeOrder)
}

export async function analyzeCounterpartyPdf(file) {
  return callAnalyze(file, 'counterparty', normalizeCounterparty)
}

async function callAnalyze(file, mode, normalizer) {
  if (file.size > MAX_FILE_SIZE) throw new Error('Файл слишком большой (максимум 3 МБ).')
  const base64 = await fileToBase64(file)

  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64, filename: file.name, mode })
    })
  } catch (e) {
    throw new Error('Не удалось связаться с сервисом распознавания: ' + msg(e))
  }

  let json = null
  try { json = await res.json() } catch { json = null }

  if (!res.ok) {
    let message = `Сервис распознавания недоступен (${res.status}).`
    if (res.status === 404) {
      message = 'Сервис распознавания не найден. Работает только на опубликованном сайте Vercel.'
    } else if (json && json.error) {
      message = json.error
    }
    const err = new Error(message)
    if (json && json.debug) err.debug = json.debug
    throw err
  }

  const debug = (json && json.debug) || null
  if (!json || !json.result) {
    const err = new Error((debug && debug.parseError) || 'ИИ не вернул данные. Откройте «Технические данные».')
    err.debug = debug
    throw err
  }

  return { fields: normalizer(json.result), debug: { ...debug, parsed: json.result } }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'))
    reader.readAsDataURL(file)
  })
}

function msg(e) {
  return (e && (e.message || e.toString())) || 'неизвестная ошибка'
}

const str = (v) => (v == null ? '' : String(v).trim())
const numStr = (v) => (v === null || v === undefined || v === '' ? '' : String(v))
const digits = (v) => String(v == null ? '' : v).replace(/\D/g, '')

function normalizeOrder(obj) {
  const rawPoints = Array.isArray(obj.points) ? obj.points : []
  const points = rawPoints.map((p) => ({
    kind: p.kind === 'unloading' ? 'unloading' : 'loading',
    address: str(p.address),
    date: str(p.date),
    time: str(p.time),
    contact_name: str(p.contact_name),
    contact_phone: str(p.contact_phone)
  }))
  return {
    customer_number: str(obj.customer_number),
    order_date: str(obj.order_date),
    rate: numStr(obj.rate),
    vat_included: obj.vat_included === true,
    cargo: str(obj.cargo),
    weight: numStr(obj.weight),
    volume: numStr(obj.volume),
    driver_name: str(obj.driver_name),
    driver_phone: str(obj.driver_phone),
    vehicle_info: str(obj.vehicle_info),
    note: str(obj.note),
    points
  }
}

function normalizeCounterparty(obj) {
  return {
    name: str(obj.name),
    inn: digits(obj.inn),
    kpp: str(obj.kpp),
    ogrn: str(obj.ogrn),
    address: str(obj.address),
    email: str(obj.email),
    contact_name: str(obj.contact_name),
    phone: str(obj.phone)
  }
}
