// Серверная функция Vercel: поиск организации по ИНН через DaData.
// Путь: POST /api/dadata, тело { inn }
// Переменная окружения в Vercel: DADATA_API_KEY (токен Suggestions API)

const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' })

  const key = process.env.DADATA_API_KEY
  if (!key) return res.status(500).json({ error: 'Не задан DADATA_API_KEY в переменных окружения Vercel.' })

  const inn = String(req.body?.inn || '').replace(/\D/g, '')
  if (inn.length !== 10 && inn.length !== 12) {
    return res.status(400).json({ error: 'ИНН должен содержать 10 или 12 цифр.' })
  }

  try {
    const r = await fetch(DADATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${key}`
      },
      body: JSON.stringify({ query: inn })
    })
    if (!r.ok) {
      const t = await r.text()
      return res.status(502).json({ error: `DaData: ошибка ${r.status}. ${t.slice(0, 200)}` })
    }
    const data = await r.json()
    const s = data?.suggestions?.[0]
    if (!s) return res.status(200).json({ found: false })

    const d = s.data || {}
    return res.status(200).json({
      found: true,
      name: d.name?.short_with_opf || d.name?.full_with_opf || s.value || '',
      inn: d.inn || inn,
      kpp: d.kpp || '',
      ogrn: d.ogrn || '',
      address: d.address?.value || '',
      contact_name: d.management?.name || ''
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Ошибка запроса к DaData.' })
  }
}
