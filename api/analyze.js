// Серверная функция Vercel: распознаёт заявку/договор через GigaChat (Сбер).
// Путь: POST /api/analyze
// Тело запроса:
//   { text: "..." }    — текст из цифрового PDF (точный путь, бесплатная модель)
//   { images: [...] }  — картинки страниц (зрение, для сканов; модель Pro)
// Возвращает { result, debug }.

import crypto from 'node:crypto'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const API_BASE = 'https://gigachat.devices.sberbank.ru/api/v1'

// Общая часть запроса: что извлекать и в каком формате
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
    {
      "kind": "loading или unloading",
      "address": "полный адрес как в документе",
      "date": "ГГГГ-ММ-ДД",
      "time": "интервал времени, например 08:00–16:00",
      "contact_name": "имя контактного лица",
      "contact_phone": "телефон контактного лица"
    }
  ]
}

ПРАВИЛА для "points":
- Перечисли КАЖДОЕ место отдельным объектом, по порядку. Несколько мест погрузки (Место 1, Место 2, ...) — несколько объектов.
- kind="loading" — ОТКУДА забирают груз (Погрузка, Загрузка, Грузоотправитель).
- kind="unloading" — КУДА везут и сдают груз (Выгрузка, Разгрузка, Грузополучатель).
- Один объект = один адрес. НЕ объединяй разные адреса через дефис или запятую в один пункт.
- Контакты, дату и время бери из того же блока, что и адрес. Не путай погрузку и выгрузку.

Бери данные ТОЛЬКО из документа. Ничего не выдумывай: если поля нет — пустая строка "" (для чисел null). Не угадывай адреса.`

const PROMPT_TEXT_INTRO =
  'Ты ассистент логиста. Ниже приведён ТЕКСТ заявки/договора на грузоперевозку. Извлеки важные для перевозчика данные строго по тексту.'
const PROMPT_VISION_INTRO =
  'Ты ассистент логиста. На изображениях — заявка/договор на грузоперевозку. Извлеки важные для перевозчика данные.'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  if (!authKey) {
    return res.status(500).json({ error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.' })
  }

  const text = req.body?.text
  const images = req.body?.images
  const hasText = typeof text === 'string' && text.trim().length > 0
  const hasImages = Array.isArray(images) && images.length > 0

  if (!hasText && !hasImages) {
    return res.status(400).json({ error: 'Нет данных для распознавания (ни текста, ни изображений).' })
  }

  try {
    const token = await getToken(authKey, scope)

    let model
    let messages
    let promptForDebug

    if (hasText) {
      // ТОЧНЫЙ ПУТЬ: цифровой PDF — отправляем текст, бесплатная модель
      model = process.env.GIGACHAT_TEXT_MODEL || 'GigaChat-2'
      const prompt = `${PROMPT_TEXT_INTRO}\n\n${SCHEMA}\n\n===== ТЕКСТ ДОКУМЕНТА =====\n${text}`
      messages = [{ role: 'user', content: prompt }]
      promptForDebug = `${PROMPT_TEXT_INTRO}\n\n${SCHEMA}`
    } else {
      // ЗАПАСНОЙ ПУТЬ: скан — отправляем картинки, модель со зрением (Pro/Max)
      model = process.env.GIGACHAT_MODEL || 'GigaChat-2-Pro'
      const fileIds = []
      for (let i = 0; i < images.length; i++) {
        fileIds.push(await uploadImage(token, images[i], i + 1))
      }
      messages = fileIds.map((id, i) => ({
        role: 'user',
        content: `Изображение страницы ${i + 1} документа.`,
        attachments: [id]
      }))
      messages.push({ role: 'user', content: `${PROMPT_VISION_INTRO}\n\n${SCHEMA}` })
      promptForDebug = `${PROMPT_VISION_INTRO}\n\n${SCHEMA}`
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
        mode: hasText ? 'text' : 'vision',
        prompt: promptForDebug,
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

async function uploadImage(token, base64, index) {
  const bytes = Buffer.from(base64, 'base64')
  const form = new FormData()
  form.append('purpose', 'general')
  form.append('file', new Blob([bytes], { type: 'image/jpeg' }), `page-${index}.jpg`)
  const res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Загрузка изображения не удалась (${res.status}). ${t.slice(0, 200)}`)
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