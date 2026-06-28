// Распознавание договора через GigaChat.
// В браузере страницы PDF превращаются в изображения (чтобы читались и сканы),
// затем отправляются на серверную функцию /api/analyze.
// Функция работает только на сайте Vercel (или при `vercel dev`), не при `npm run dev`.

import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const MAX_PAGES = 4
const SCALE = 1.6
const JPEG_QUALITY = 0.7

export async function analyzeContractPdf(file) {
  const images = await pdfToImages(file)
  if (images.length === 0) {
    throw new Error('Не удалось прочитать страницы PDF.')
  }

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
      /* тело не JSON */
    }
    throw new Error(message)
  }

  const data = await res.json()
  return normalize(data)
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
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    images.push(dataUrl.split(',')[1])
  }

  return images
}

function normalize(obj) {
  const str = (v) => (v == null ? '' : String(v).trim())
  return {
    customer_number: str(obj.customer_number),
    loading_address: str(obj.loading_address),
    unloading_address: str(obj.unloading_address),
    loading_contact_name: str(obj.loading_contact_name),
    loading_contact_phone: str(obj.loading_contact_phone),
    unloading_contact_name: str(obj.unloading_contact_name),
    unloading_contact_phone: str(obj.unloading_contact_phone),
    delivery_deadline: str(obj.delivery_deadline),
    rate:
      obj.rate === null || obj.rate === undefined || obj.rate === ''
        ? ''
        : String(obj.rate),
    note: str(obj.note)
  }
}