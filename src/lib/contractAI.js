// Распознавание заявки/договора через GigaChat.
// PDF → картинки (в браузере) → /api/analyze → структура с маршрутом.
// Серверная функция работает только на сайте Vercel (или `vercel dev`), не при `npm run dev`.

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MAX_PAGES = 3
const SCALE = 2.2
const JPEG_QUALITY = 0.85

export async function analyzeContractPdf(file) {
  const images = await pdfToImages(file)
  if (images.length === 0) throw new Error('Не удалось прочитать страницы PDF.')

  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images })
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

  return normalize(await res.json())
}

async function pdfToImages(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages = Math.min(pdf.numPages, MAX_PAGES)
  const images = []
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1])
  }
  return images
}

// Приводим ответ ИИ к форме, которую использует OrderForm
function normalize(obj) {
  const str = (v) => (v == null ? '' : String(v).trim())
  const numStr = (v) => (v === null || v === undefined || v === '' ? '' : String(v))

  const points = Array.isArray(obj.points)
    ? obj.points.map((p) => ({
        kind: p.kind === 'unloading' ? 'unloading' : 'loading',
        address: str(p.address),
        date: str(p.date),
        time: str(p.time),
        contact_name: str(p.contact_name),
        contact_phone: str(p.contact_phone)
      }))
    : []

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