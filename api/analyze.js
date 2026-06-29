// Серверная функция Vercel: распознавание из PDF через GigaChat.
// Путь: POST /api/analyze, тело { pdf: base64, filename, mode }
//   mode = 'order' (по умолчанию) — данные заявки
//   mode = 'counterparty'         — реквизиты заказчика
//
// Защита от галлюцинаций: нет текстового слоя (скан) → ошибка, не выдумываем.

import crypto from 'node:crypto'
import pdfParse from 'pdf-parse'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const API_BASE = 'https://gigachat.devices.sberbank.ru/api/v1'
const TEXT_MIN_CHARS = 200

// ── Режим «Заявка» ──
const ORDER_SCHEMA = `Верни СТРОГО один JSON-объект без markdown:
{
  "customer_number": "номер заявки/договора заказчика",
  "order_date": "дата подачи в формате ГГГГ-ММ-ДД",
  "rate": ставка числом без валюты (или null),
  "vat_included": true если С НДС, иначе false,
  "cargo": "наименование груза",
  "weight": вес в тоннах числом (или null),
  "volume": объём в куб.м числом (или null),
  "driver_name": "ФИО водителя",
  "driver_phone": "телефон водителя",
  "vehicle_info": "марка и гос. номер ТС",
  "note": "прочие важные условия",
  "points": [
    { "kind": "loading или unloading", "address": "полный адрес",
      "date": "ГГГГ-ММ-ДД", "time": "интервал", "contact_name": "имя", "contact_phone": "телефон" }
  ]
}
ПРАВИЛА: одно место = один объект; loading — откуда забирают, unloading — куда везут; не объединяй адреса.
Бери ТОЛЬКО из текста, ничего не выдумывай. Нет поля — "" (числа null).
Если данных заявки нет — верни {"error":"no_data"}.`
const ORDER_INTRO = 'Ты ассистент логиста. Ниже ТЕКСТ заявки/договора на грузоперевозку. Извлеки данные строго по тексту.'

// ── Режим «Контрагент» ──
const CP_SCHEMA = `Верни СТРОГО один JSON-объект без markdown:
{
  "name": "наименование организации ЗАКАЗЧИКА",
  "inn": "ИНН заказчика (только цифры)",
  "kpp": "КПП заказчика",
  "ogrn": "ОГРН или ОГРНИП заказчика",
  "address": "адрес заказчика",
  "email": "email заказчика для документов",
  "contact_name": "контактное лицо со стороны заказчика",
  "phone": "телефон заказчика"
}
ВАЖНО: ЗАКАЗЧИК — сторона, которая ЗАКАЗЫВАЕТ перевозку (Заказчик / Клиент / Экспедитор-плательщик).
НЕ бери данные Перевозчика / Исполнителя / Водителя — это другая сторона.
Бери ТОЛЬКО из текста, ничего не выдумывай. Нет поля — "".
Если реквизитов заказчика в тексте нет — верни {"error":"no_data"}.`
const CP_INTRO = 'Ты ассистент логиста. Ниже ТЕКСТ договора-заявки на грузоперевозку. Извлеки реквизиты ЗАКАЗЧИКА (того, кто заказывает перевозку), а не перевозчика.'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const authKey = process.env.GIGACHAT_AUTH_KEY
  const scope = process.env.GIGACHAT_SCOPE || 'GIGACHAT_API_PERS'
  if (!authKey) return res.status(500).json({ error: 'Не задан GIGACHAT_AUTH_KEY в переменных окружения Vercel.' })

  const pdfB64 = req.body?.pdf
  const mode = req.body?.mode === 'counterparty' ? 'counterparty' : 'order'
  if (!pdfB64) return res.status(400).json({ error: 'Файл не передан.' })

  let buffer
  try { buffer = Buffer.from(pdfB64, 'base64') }
  catch { return res.status(400).json({ error: 'Не удалось декодировать файл.' }) }

  // 1. Текст из PDF
  let text = ''
  try {
    const parsed = await pdfParse(buffer)
    text = (parsed.text || '').trim()
  } catch { text = '' }

  // 2. Скан без текста → ошибка
  if (text.replace(/\s/g, '').length <= TEXT_MIN_CHARS) {
    return res.status(422).json({
      error: 'Не удалось прочитать текст из файла — похоже, это скан без текстового слоя. ' +
        'Загрузите PDF, в котором текст выделяется мышью, либо заполните вручную.',
      debug: { inputMode: 'text', textChars: text.length, textPreview: '(текстовый слой не найден)', prompt: '(к ИИ не обращались)', raw: '', parseError: null }
    })
  }

  // 3. Запрос в GigaChat
  try {
    const token = await getToken(authKey, scope)
    const model = process.env.GIGACHAT_TEXT_MODEL || 'GigaChat-2'
    const intro = mode === 'counterparty' ? CP_INTRO : ORDER_INTRO
    const schema = mode === 'counterparty' ? CP_SCHEMA : ORDER_SCHEMA
    const prompt = `${intro}\n\n${schema}`
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
    let parsed = null, parseError = null
    try { parsed = parseJson(content) } catch (e) { parseError = e.message }

    const debug = { model, inputMode: 'text', textChars: text.length, textPreview: text.slice(0, 2000), prompt, raw: content, parseError }

    if (parsed && parsed.error === 'no_data') {
      const msg = mode === 'counterparty'
        ? 'В документе не найдено реквизитов заказчика. Проверьте файл или заполните вручную.'
        : 'В документе не найдено данных заявки. Проверьте файл или заполните вручную.'
      return res.status(422).json({ error: msg, debug })
    }

    const ok = mode === 'counterparty' ? cpMeaningful(parsed) : orderMeaningful(parsed)
    if (!ok) {
      const msg = mode === 'counterparty'
        ? 'Не удалось уверенно распознать реквизиты заказчика (нет ИНН/названия). Контрагент не создан.'
        : 'Не удалось уверенно распознать заявку (нет адресов). Заявка не создана.'
      return res.status(422).json({ error: msg, debug })
    }

    return res.status(200).json({ result: parsed, debug })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Внутренняя ошибка распознавания.' })
  }
}

function orderMeaningful(p) {
  if (!p || typeof p !== 'object') return false
  const points = Array.isArray(p.points) ? p.points : []
  return points.some((x) => x && typeof x.address === 'string' && x.address.trim().length > 3)
}
function cpMeaningful(p) {
  if (!p || typeof p !== 'object') return false
  const inn = String(p.inn || '').replace(/\D/g, '')
  const name = String(p.name || '').trim()
  return inn.length === 10 || inn.length === 12 || name.length > 2
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
  try { return JSON.parse(clean) }
  catch {
    const m = clean.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
    throw new Error('Не удалось разобрать ответ ИИ как JSON.')
  }
}
