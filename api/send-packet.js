// Серверная функция Vercel: отправка пакета документов заказчику через Resend.
// Путь: POST /api/send-packet
// Тело: { to, subject, html, attachments: [{ filename, url }] }
//   url — временная ссылка на файл в Supabase Storage (сервер сам скачает и приложит).
//
// Переменные окружения в Vercel:
//   RESEND_API_KEY (обязательно)
//   RESEND_FROM    (необязательно; по умолчанию onboarding@resend.dev — тестовый режим)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM || 'onboarding@resend.dev'
  if (!apiKey) {
    return res.status(500).json({ error: 'Не задан RESEND_API_KEY в переменных окружения Vercel.' })
  }

  const { to, subject, html, attachments } = req.body || {}
  if (!to || !/.+@.+\..+/.test(String(to))) {
    return res.status(400).json({ error: 'Укажите корректный email получателя.' })
  }

  try {
    // Сервер сам скачивает вложения по временным ссылкам и кодирует их
    const files = []
    for (const a of attachments || []) {
      if (!a || !a.url) continue
      const r = await fetch(a.url)
      if (!r.ok) throw new Error('Не удалось получить файл вложения: ' + (a.filename || ''))
      const buf = Buffer.from(await r.arrayBuffer())
      files.push({ filename: a.filename || 'document', content: buf.toString('base64') })
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: subject || 'Документы перевозчика',
        html: html || '',
        attachments: files
      })
    })

    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      // Resend в тестовом режиме вернёт пояснение, если to — не ваша почта
      return res.status(502).json({ error: data?.message || `Resend: ошибка ${resp.status}` })
    }
    return res.status(200).json({ ok: true, id: data?.id })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Не удалось отправить письмо.' })
  }
}
