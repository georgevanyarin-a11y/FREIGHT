// Серверная функция Vercel: распознаёт заявку/договор через GigaChat (Сбер).
// Путь: POST /api/analyze, тело { pdf: base64, filename }
//
// Защита от галлюцинаций:
//  - если в PDF нет текстового слоя (скан) — возвращаем ошибку, НЕ выдумываем;
//  - проверяем, что ИИ вернул осмысленный результат (есть адреса), иначе ошибка.

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
- Перечисли КАЖДОЕ место отдельным объектом, по порядку. Несколько мест погрузки — несколько объектов.
- kind="loading" — ОТКУДА забирают груз. kind="unloading" — КУДА везут и сдают груз.
- Один объект = один адрес. НЕ объединяй разные адреса через дефис или запятую.
- Контакты, дату и время бери из того же блока, что и адрес. Не путай погрузку и выгрузку.

ОЧЕНЬ ВАЖНО: бери данные ТОЛЬКО из текста документа. Категорически ничего не выдумывай и не угадывай.
Если поля нет в тексте — оставь пустую строку "" (для чисел null).
Если в тексте вообще нет данных заявки на грузоперевозку (адресов, маршрута) — верни {"error": "no_data"} и больше ничего.`

const TEXT_INTRO = 'Ты ассистент логиста. Ниже ТЕКСТ заявки/договора на грузоперевозку. Извлеки данные строго по тексту.'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  if (!authKey) {
    return res.status(500).json({ error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.' })
  }

  const pdfB64 = req.body?.pdf
  if (!pdfB64) return res.status(400).json({ error: 'Файл не передан.' })

  let buffer
  try {
    buffer = Buffer.from(pdfB64, 'base64')
  } catch {
    return res.status(400).json({ error: 'Не удалось декодировать файл.' })
  }

  // 1. Достаём текст из PDF
  let text = ''
  try {
    const parsed = await pdfParse(buffer)
    text = (parsed.text || '').trim()
  } catch {
    text = ''
  }

  // 2. Нет текстового слоя → это скан. НЕ выдумываем — отдаём понятную ошибку.
  if (text.replace(/\s/g, '').length <= TEXT_MIN_CHARS) {
    return res.status(422).json({
      error:
        'Не удалось прочитать текст из файла — похоже, это скан или фотография без текстового слоя. ' +
        'Загрузите PDF, в котором текст выделяется мышью (например, выгрузку из 1С/АТИ), ' +
        'либо заполните заявку вручную.',
      debug: {
        inputMode: 'text',
        textChars: text.length,
        textPreview: '(текстовый слой не найден или его слишком мало)',
        prompt: '(запрос к ИИ не отправлялся — нет текста)',
        raw: '',
        parseError: null
      }
    })
  }

  // 3. Текст есть → отправляем в GigaChat
  try {
    const token = await getToken(authKey, scope)
    const model = process.env.GIGACHAT_TEXT_MODEL || 'GigaChat-2'
    const prompt = `${TEXT_INTRO}\n\n${SCHEMA}`
    const messages = [{ role: 'user', content: `${prompt}\n\n===== ТЕКСТ ДОКУМЕНТА =====\n${text}` }]

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

    const debug = {
      model,
      inputMode: 'text',
      textChars: text.length,
      textPreview: text.slice(0, 2000),
      prompt,
      raw: content,
      parseError
    }

    // 4. Модель сама сообщила, что данных нет
    if (parsed && parsed.error === 'no_data') {
      return res.status(422).json({
        error: 'В документе не найдено данных заявки на грузоперевозку. Проверьте файл или заполните вручную.',
        debug
      })
    }

    // 5. Проверка осмысленности: должен быть хотя бы один адрес в маршруте
    if (!isMeaningful(parsed)) {
      return res.status(422).json({
        error:
          'Не удалось уверенно распознать заявку (не найдены адреса маршрута). ' +
          'Чтобы не подставить неверные данные, заявка не создана. Проверьте файл или заполните вручную.',
        debug
      })
    }

    return res.status(200).json({ result: parsed, debug })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Внутренняя ошибка распознавания.' })
  }
}

// Результат считаем осмысленным, если есть хотя бы одна точка с непустым адресом
function isMeaningful(parsed) {
  if (!parsed || typeof parsed !== 'object') return false
  const points = Array.isArray(parsed.points) ? parsed.points : []
  const hasAddress = points.some((p) => p && typeof p.address === 'string' && p.address.trim().length > 3)
  return hasAddress
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