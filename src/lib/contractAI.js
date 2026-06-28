// Распознавание заявки/договора через GigaChat.
// Браузер только кодирует PDF и отправляет на сервер — разбор делает /api/analyze.

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3 МБ (ограничение тела запроса Vercel)

export async function analyzeContractPdf(file) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Файл слишком большой (максимум 3 МБ).')
  }

  const base64 = await fileToBase64(file)

  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64, filename: file.name })
    })
  } catch (e) {
    throw new Error('Не удалось связаться с сервисом распознавания: ' + msg(e))
  }

  // Пытаемся прочитать тело как JSON (там может быть и error, и debug)
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }

  if (!res.ok) {
    let message = `Сервис распознавания недоступен (${res.status}).`
    if (res.status === 404) {
      message =
        'Сервис распознавания не найден. Распознавание работает только на опубликованном ' +
        'сайте Vercel, а не при локальном запуске.'
    } else if (json && json.error) {
      message = json.error
    }
    const err = new Error(message)
    if (json && json.debug) err.debug = json.debug // покажем диагностику даже при ошибке
    throw err
  }

  const debug = (json && json.debug) || null

  if (!json || !json.result) {
    const err = new Error(
      (debug && debug.parseError) ||
        'ИИ не вернул структурированные данные. Откройте «Технические данные» и пришлите их.'
    )
    err.debug = debug
    throw err
  }

  return { fields: normalize(json.result), debug: { ...debug, parsed: json.result } }
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

function normalize(obj) {
  const str = (v) => (v == null ? '' : String(v).trim())
  const numStr = (v) => (v === null || v === undefined || v === '' ? '' : String(v))

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