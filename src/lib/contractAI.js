// Распознавание заявки/договора через GigaChat.
// Если в PDF есть текстовый слой (цифровой документ) — извлекаем ТЕКСT и
// отправляем его (точно и бесплатно). Если текста нет (скан) — рендерим
// страницы в картинки и отправляем их (зрение, модель Pro).

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const TEXT_MIN_CHARS = 200 // если осмысленного текста больше — считаем PDF цифровым
const TEXT_MAX_PAGES = 8
const IMG_MAX_PAGES = 3
const IMG_SCALE = 2.6
const IMG_JPEG_QUALITY = 0.9

export async function analyzeContractPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

  const text = await pdfToText(pdf)
  const hasText = text.replace(/\s/g, '').length > TEXT_MIN_CHARS

  let body
  let clientDebug
  if (hasText) {
    body = { text }
    clientDebug = { inputMode: 'text', textChars: text.length, textPreview: text.slice(0, 2000) }
  } else {
    const images = await pdfToImages(pdf)
    if (images.length === 0) throw new Error('Не удалось прочитать страницы PDF.')
    body = { images }
    clientDebug = { inputMode: 'vision', pages: images.length }
  }

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    let message = `Сервис распознавания недоступен (${res.status}).`
    if (res.status === 404) {
      message =
        'Сервис распознавания не найден. Распознавание работает только на опубликованном ' +
        'сайте Vercel, а не при локальном запуске.'
    }
    try {
      const j = await res.json()
      if (j?.error) message = j.error
    } catch {
      /* not json */
    }
    throw new Error(message)
  }

  const json = await res.json()
  const debug = { ...(json.debug || {}), ...clientDebug }

  if (!json.result) {
    const err = new Error(
      debug.parseError || 'ИИ не вернул структурированные данные. Откройте «Технические данные» и пришлите их.'
    )
    err.debug = debug
    throw err
  }

  return { fields: normalize(json.result), debug: { ...debug, parsed: json.result } }
}

// Извлечение текстового слоя PDF
async function pdfToText(pdf) {
  const pages = Math.min(pdf.numPages, TEXT_MAX_PAGES)
  let out = ''
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items.map((it) => (it.str != null ? it.str : '')).join(' ')
    out += line + '\n'
  }
  return out.trim()
}

// Рендер страниц в JPEG (для сканов)
async function pdfToImages(pdf) {
  const pages = Math.min(pdf.numPages, IMG_MAX_PAGES)
  const images = []
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: IMG_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', IMG_JPEG_QUALITY).split(',')[1])
  }
  return images
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