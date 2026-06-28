// Серверная функция Vercel: распознаёт договор через GigaChat (Сбер).
// Путь запроса в приложении: POST /api/analyze
//
// Принимает: { images: [base64Jpeg, ...] } — страницы PDF, превращённые в картинки.
// Отдаёт: JSON с извлечёнными полями договора.
//
// Переменные окружения (задаются в Vercel → Settings → Environment Variables):
//   GIGACHAT_AUTH_KEY  — ключ авторизации (Authorization key) из личного кабинета Сбера
//   GIGACHAT_SCOPE     — необязательно, по умолчанию GIGACHAT_API_PERS (для физлиц)
//   GIGACHAT_MODEL     — необязательно, по умолчанию GigaChat-2

import crypto from 'node:crypto'

// GigaChat использует российский корневой сертификат, которого нет в доверенном
// списке Node по умолчанию. Для простоты отключаем проверку TLS только в этой
// функции (она ходит только к серверам Сбера). Для усиления можно установить
// корневой сертификат Минцифры и убрать эту строку.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const API_BASE = 'https://gigachat.devices.sberbank.ru/api/v1'

const PROMPT = `Ты ассистент логиста. На изображениях — страницы договора или заявки на грузоперевозку.
Извлеки данные и верни СТРОГО один JSON-объект без пояснений и без markdown, со следующими ключами:
"customer_number" — номер заявки/договора заказчика (строка, если нет — "")
"loading_address" — полный адрес погрузки
"unloading_address" — полный адрес выгрузки
"loading_contact_name" — имя контакта на погрузке
"loading_contact_phone" — телефон на погрузке (как в документе)
"unloading_contact_name" — имя контакта на выгрузке
"unloading_contact_phone" — телефон на выгрузке
"delivery_deadline" — срок доставки в формате ГГГГ-ММ-ДД (если нет — "")
"rate" — ставка перевозчику числом без валюты (если нет — null)
"note" — кратко особые условия, тип груза, требования к ТС (если нет — "")
Если поля в документе нет — поставь пустую строку "". Не выдумывай данные.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Метод не поддерживается' })
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  const model = process.env.GIGACHAT_MODEL || 'GigaChat-2'

  if (!authKey) {
    return res.status(500).json({
      error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.'
    })
  }

  const images = req.body?.images
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Нет изображений для распознавания.' })
  }

  try {
    const token = await getToken(authKey, scope)

    // Загружаем каждую страницу-картинку в хранилище GigaChat
    const fileIds = []
    for (let i = 0; i < images.length; i++) {
      fileIds.push(await uploadImage(token, images[i], i + 1))
    }

    // В одном сообщении — одна картинка; финальное сообщение содержит задание
    const messages = fileIds.map((id, i) => ({
      role: 'user',
      content: `Изображение страницы ${i + 1} договора.`,
      attachments: [id]
    }))
    messages.push({ role: 'user', content: PROMPT })

    const completion = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages, temperature: 0.1 })
    })

    if (!completion.ok) {
      const text = await completion.text()
      return res
        .status(502)
        .json({ error: `GigaChat: ошибка генерации ${completion.status}. ${text.slice(0, 300)}` })
    }

    const data = await completion.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const parsed = parseJson(content)

    return res.status(200).json(parsed)
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
  const json = await res.json()
  return json.access_token
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
  const json = await res.json()
  return json.id
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