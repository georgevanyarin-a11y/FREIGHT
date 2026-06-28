// Распознавание заявки/договора через GigaChat.
// Цифровой PDF (есть текстовый слой) → отправляем текст (точно, бесплатно).
// Скан (текста нет) → рендерим страницы в картинки → отправляем их (зрение, Pro).

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const TEXT_MIN_CHARS = 200
const TEXT_MAX_PAGES = 8
const IMG_MAX_PAGES = 3
const IMG_SCALE = 2.6
const IMG_JPEG_QUALITY = 0.9

export async function analyzeContractPdf(file) {
  // 1. Открываем PDF
  let pdf
  try {
    const buffer = await file.arrayBuffer()
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  } catch (e) {
    throw new Error('Не удалось открыть PDF: ' + msg(e))
  }

  // 2. Пытаемся достать текстовый слой
  let text = ''
  try {
    text = await pdfToText(pdf)
  } catch {
    text = '' // нет текста — пойдём через картинки
  }
  const hasText = text.replace(/\s/g, '').length > TEXT_MIN_CHARS

  // 3. Готовим тело запроса
  let body
  let clientDebug
  if (hasText) {
    body = { text }
    clientDebug = { inputMode: 'text', textChars: text.length, textPreview: text.slice(0, 2000) }
  } else {
    let images
    try {
      images = await pdfToImages(pdf)
    } catch (e) {
      throw new Error('Не удалось подготовить изображения страниц: ' + msg(e))
    }
    if (!images.length) throw new Error('Не удалось прочитать страницы PDF.')
    body = { images }
    clientDebug = { inputMode: 'vision', pages: images.length }
  }

  // 4. Отправляем на сервер
  let res
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch (e) {
    throw new Error('Не удалось связаться с сервисом распознавания: ' + msg(e))
  }

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

async function pdfToText(pdf) {
  const pages = Math.min(pdf.numPages, TEXT_MAX_PAGES)
  let out = ''
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const line = content.items.map((it) => (it && it.str != null ? it.str : '')).join(' ')
    out += line + '\n'
  }
  return out.trim()
}

async function pdfToImages(pdf) {
  const pages = Math.min(pdf.numPages, IMG_MAX_PAGES)
  const images = []
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: IMG_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')
    // canvas — для pdfjs-dist v5, canvasContext — для v4. Передаём оба для совместимости.
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', IMG_JPEG_QUALITY).split(',')[1])
  }
  return images
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