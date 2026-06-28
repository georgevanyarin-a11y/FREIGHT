// Серверная функция Vercel: распознаёт заявку/договор через GigaChat (Сбер).
// Путь: POST /api/analyze, тело { pdf: base64, filename }
// Сервер сам достаёт текст из PDF (pdf-parse). Есть текст → точный текстовый путь
// (бесплатная модель). Текста нет (скан) → отправляет PDF файлом в GigaChat (Pro).

import crypto from 'node:crypto'
import pdfParse from 'pdf-parse'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const API_BASE = 'https://gigachat.devices.sberbank.ru/api/v1'

const TEXT_MIN_CHARS = 200

const SCHEMA = `Верни СТРОГО один JSON-объект без markdown и без пояснений, такой структуры:
{
  "customer_number": "номер заявки/договора заказчика",
  "order_date": "дата подачи заявки в формате ГГГГ-ММ-ДД",
  "rate": ставка перевозчику числом без валюты и пробелов (или null),
  "vat_included": true если ставка С НДС, false если без НДС или не указано,
  "cargo": "наименование груза",
  "weight": вес в тоннах числом (или null),
  "volume": объём в куб.м числом (или null),
  "driver_name": "ФИО водителя",
  "driver_phone": "телефон водителя",
  "vehicle_info": "марка и гос. номер транспортного средства",
  "note": "прочие важные условия (например, способ погрузки/разгрузки)",
  "points": [
    { "kind": "loading или unloading", "address": "полный адрес как в документе",
      "date": "ГГГГ-ММ-ДД", "time": "интервал времени, например 08:00–16:00",
      "contact_name": "имя контактного лица", "contact_phone": "телефон контактного лица" }
  ]
}

ПРАВИЛА для "points":
- Перечисли КАЖДОЕ место отдельным объектом, по порядку. Несколько мест погрузки (Место 1, Место 2, ...) — несколько объектов.
- kind="loading" — ОТКУДА забирают груз (Погрузка, Загрузка, Грузоотправитель).
- kind="unloading" — КУДА везут и сдают груз (Выгрузка, Разгрузка, Грузополучатель).
- Один объект = один адрес. НЕ объединяй разные адреса через дефис или запятую.
- Контакты, дату и время бери из того же блока, что и адрес. Не путай погрузку и выгрузку.

Бери данные ТОЛЬКО из документа. Ничего не выдумывай: нет поля — пустая строка "" (для чисел null). Не угадывай адреса.`

const TEXT_INTRO = 'Ты ассистент логиста. Ниже ТЕКСТ заявки/договора на грузоперевозку. Извлеки данные строго по тексту.'
const FILE_INTRO = 'Ты ассистент логиста. В приложенном файле — заявка/договор на грузоперевозку. Извлеки данные.'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  if (!authKey) {
    return res.status(500).json({ error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.' })
  }

  const pdfB64 = req.body?.pdf
  const filename = req.body?.filename || 'document.pdf'
  if (!pdfB64) {
    return res.status(400).json({ error: 'Файл не передан.' })
  }

  let buffer
  try {
    buffer = Buffer.from(pdfB64, 'base64')
  } catch {
    return res.status(400).json({ error: 'Не удалось декодировать файл.' })
  }

  // 1. Пытаемся достать текст из PDF на сервере
  let text = ''
  try {
    const parsed = await pdfParse(buffer)
    text = (parsed.text || '').trim()
  } catch {
    text = ''
  }
  const hasText = text.replace(/\s/g, '').length > TEXT_MIN_CHARS

  try {
    const token = await getToken(authKey, scope)

    let model
    let messages
    let mode

    if (hasText) {
      mode = 'text'
      model = process.env.GIGACHAT_TEXT_MODEL || 'GigaChat-2'
      messages = [{ role: 'user', content: `${TEXT_INTRO}\n\n${SCHEMA}\n\n===== ТЕКСТ ДОКУМЕНТА =====\n${text}` }]
    } else {
      // Скан без текстового слоя — отправляем PDF файлом
      mode = 'file'
      model = process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro'
      const fileId = await uploadPdf(token, buffer, filename)
      messages = [
        { role: 'user', content: `${FILE_INTRO}\n\n${SCHEMA}`, attachments: [fileId] }
      ]
    }

    const completion = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0 })
    })

    if (!completion.ok) {
      const t = await completion.text()
      return res.status(502).json({ error: `GigaChat: ошибка генерации ${completion.status}. ${t.slice(0, 300)}` })
    }

    const data = await completion.json()
    const content = data?.choices?.[0]?.message?.content || ''

    let parsed = null
    let parseError = null
    try {
      parsed = parseJson(content)
    } catch (e) {
      parseError = e.message
    }

    return res.status(200).json({
      result: parsed,
      debug: {
        model,
        inputMode: mode === 'text' ? 'text' : 'vision',
        textChars: text.length,
        textPreview: hasText ? text.slice(0, 2000) : '(текстовый слой не найден — скан)',
        prompt: hasText ? `${TEXT_INTRO}\n\n${SCHEMA}` : `${FILE_INTRO}\n\n${SCHEMA}`,
        raw: content,
        parseError
      }
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Внутренняя ошибка распознавания.' })
  }
}

async function getToken(authKey, scope) {
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authKey}`,
      RqUID: crypto.randomUUID(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: `scope=${scope}`
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Авторизация GigaChat не удалась (${res.status}). ${t.slice(0, 200)}`)
  }
  return (await res.json()).access_token
}

async function uploadPdf(token, buffer, filename) {
  const form = new FormData()
  form.append('purpose', 'general')
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename)
  const res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Загрузка файла не удалась (${res.status}). ${t.slice(0, 200)}`)
  }
  return (await res.json()).id
}

function parseJson(text) {
  const clean = String(text).replace(/```json/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('Не удалось разобрать ответ ИИ как JSON.')
  }
}