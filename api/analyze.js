// Серверная функция Vercel: распознаёт заявку/договор через GigaChat (Сбер).
// Путь: POST /api/analyze
// Переменные окружения: GIGACHAT_AUTH_KEY (обязательно),
//   GIGACHAT_SCOPE (по умолчанию GIGACHAT_API_PERS), GIGACHAT_MODEL (по умолчанию GigaChat-2)

import crypto from 'node:crypto'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const API_BASE = 'https://gigachat.devices.sberbank.ru/api/v1'

const PROMPT = `Ты ассистент логиста. На изображениях — заявка или договор на грузоперевозку.
Распознай важные для перевозчика данные: номер заявки, дату подачи, ставку, ВСЕ места погрузки и выгрузки (с адресами, контактами, датами и временем), сведения о грузе, водителе и транспортном средстве.

Верни СТРОГО один JSON-объект без markdown и без пояснений, такой структуры:
{
  "customer_number": "номер заявки/договора заказчика",
  "order_date": "дата подачи заявки в формате ГГГГ-ММ-ДД",
  "rate": ставка перевозчику числом без валюты и пробелов (или null),
  "vat_included": true если ставка указана С НДС, false если без НДС или не указано,
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

ПРАВИЛА для "points" — это самое важное:
- Перечисли КАЖДОЕ место отдельным объектом, по порядку. Если мест погрузки несколько (Место 1, Место 2, ...) — добавь по объекту на каждое.
- kind="loading" — место, ОТКУДА забирают груз (Погрузка, Загрузка, Грузоотправитель).
- kind="unloading" — место, КУДА везут и сдают груз (Выгрузка, Разгрузка, Грузополучатель).
- Не путай погрузку и выгрузку местами. Контакты и время бери из того же блока, что и адрес.

Адреса переписывай полностью, как в документе (город, улица, дом, организация/склад).
Если поля нет — пустая строка "" (для чисел — null). Ничего не выдумывай: не уверен — оставь пустым.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  const model = process.env.GIGACHAT_MODEL || 'GigaChat-2'

  if (!authKey) {
    return res.status(500).json({ error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.' })
  }

  const images = req.body?.images
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Нет изображений для распознавания.' })
  }

  try {
    const token = await getToken(authKey, scope)

    const fileIds = []
    for (let i = 0; i < images.length; i++) {
      fileIds.push(await uploadImage(token, images[i], i + 1))
    }

    const messages = fileIds.map((id, i) => ({
      role: 'user',
      content: `Изображение страницы ${i + 1} документа.`,
      attachments: [id]
    }))
    messages.push({ role: 'user', content: PROMPT })

    const completion = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0 })
    })

    if (!completion.ok) {
      const text = await completion.text()
      return res.status(502).json({ error: `GigaChat: ошибка генерации ${completion.status}. ${text.slice(0, 300)}` })
    }

    const data = await completion.json()
    const content = data?.choices?.[0]?.message?.content || ''
    return res.status(200).json(parseJson(content))
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
    const text = await res.text()
    throw new Error(`Авторизация GigaChat не удалась (${res.status}). ${text.slice(0, 200)}`)
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
    const text = await res.text()
    throw new Error(`Загрузка изображения не удалась (${res.status}). ${text.slice(0, 200)}`)
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
    throw new Error('Не удалось разобрать ответ ИИ. Попробуйте другой файл.')
  }
}