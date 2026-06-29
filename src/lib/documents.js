// Генерация счёта на оплату и акта об оказании услуг в PDF.
// Использует pdfmake (встроенный шрифт Roboto поддерживает кириллицу).
//
// Установка библиотеки: npm install pdfmake

import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'

// Подключаем встроенные шрифты (учитываем разные версии pdfmake)
const vfs =
  (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) ||
  (pdfFonts && pdfFonts.vfs) ||
  (pdfFonts && pdfFonts.default && pdfFonts.default.pdfMake && pdfFonts.default.pdfMake.vfs)
if (vfs) pdfMake.vfs = vfs

// ───────────────────────── Публичные функции ─────────────────────────

export function downloadInvoice(order, counterparty, profile) {
  const def = invoiceDef(order, counterparty, profile)
  pdfMake.createPdf(def).download(`Счёт_${order.internal_number || ''}.pdf`)
}

export function downloadAct(order, counterparty, profile) {
  const def = actDef(order, counterparty, profile)
  pdfMake.createPdf(def).download(`Акт_${order.internal_number || ''}.pdf`)
}

// ───────────────────────── Счёт на оплату ─────────────────────────

function invoiceDef(order, cp, profile) {
  const total = num(order.rate)
  const nds = order.vat_included ? round2((total / 120) * 20) : 0
  const route = routeText(order)
  const service = `Транспортные услуги по перевозке груза${route ? ' по маршруту ' + route : ''}`

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 10, lineHeight: 1.15 },
    content: [
      { text: `Счёт на оплату № ${order.internal_number || ''} от ${dt(order.order_date)}`, bold: true, fontSize: 14, margin: [0, 0, 0, 12] },

      requisitesTable('Исполнитель (Поставщик)', supplierLines(profile)),
      { text: ' ', margin: [0, 4, 0, 0] },
      requisitesTable('Заказчик (Покупатель)', buyerLines(cp)),

      { text: 'Назначение платежа', bold: true, margin: [0, 14, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: [18, '*', 40, 70, 70],
          body: [
            [th('№'), th('Наименование'), th('Кол-во'), th('Цена'), th('Сумма')],
            [td('1'), td(service), td('1'), td(money(total)), td(money(total))]
          ]
        },
        layout: lightLayout
      },

      {
        margin: [0, 10, 0, 0],
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              body: [
                [tdR('Итого:'), tdR(money(total), true)],
                [tdR(order.vat_included ? 'В том числе НДС 20%:' : 'НДС:'), tdR(order.vat_included ? money(nds) : 'Без НДС', true)],
                [tdR('Всего к оплате:'), tdR(money(total), true)]
              ]
            },
            layout: 'noBorders'
          }
        ]
      },

      { text: `Всего к оплате: ${rublesToWords(total)}.`, bold: true, margin: [0, 10, 0, 0] },

      { text: ' ', margin: [0, 16, 0, 0] },
      {
        columns: [
          { width: '*', text: [{ text: 'Исполнитель ', bold: true }, '_______________ / ', profileName(profile), ' /'] }
        ]
      }
    ],
    footer: (page) => ({ text: `стр. ${page}`, alignment: 'center', fontSize: 8, margin: [0, 10, 0, 0], color: '#888' })
  }
}

// ───────────────────────── Акт ─────────────────────────

function actDef(order, cp, profile) {
  const total = num(order.rate)
  const nds = order.vat_included ? round2((total / 120) * 20) : 0
  const route = routeText(order)
  const service = `Транспортные услуги по перевозке груза${route ? ' по маршруту ' + route : ''}`

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { fontSize: 10, lineHeight: 1.15 },
    content: [
      { text: `Акт № ${order.internal_number || ''} от ${dt(order.order_date)}`, bold: true, fontSize: 14, margin: [0, 0, 0, 4] },
      { text: 'об оказании услуг', fontSize: 11, margin: [0, 0, 0, 12] },

      requisitesTable('Исполнитель', supplierLines(profile)),
      { text: ' ', margin: [0, 4, 0, 0] },
      requisitesTable('Заказчик', buyerLines(cp)),

      {
        table: {
          headerRows: 1,
          widths: [18, '*', 40, 70, 70],
          body: [
            [th('№'), th('Наименование работы, услуги'), th('Кол-во'), th('Цена'), th('Сумма')],
            [td('1'), td(service), td('1'), td(money(total)), td(money(total))]
          ]
        },
        layout: lightLayout,
        margin: [0, 10, 0, 0]
      },

      {
        margin: [0, 10, 0, 0],
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            table: {
              body: [
                [tdR('Итого:'), tdR(money(total), true)],
                [tdR(order.vat_included ? 'В том числе НДС 20%:' : 'НДС:'), tdR(order.vat_included ? money(nds) : 'Без НДС', true)],
                [tdR('Всего оказано услуг на сумму:'), tdR(money(total), true)]
              ]
            },
            layout: 'noBorders'
          }
        ]
      },

      { text: `Всего оказано услуг на сумму: ${rublesToWords(total)}.`, bold: true, margin: [0, 10, 0, 6] },
      { text: 'Вышеперечисленные услуги выполнены полностью и в срок. Заказчик претензий по объёму, качеству и срокам оказания услуг не имеет.', margin: [0, 0, 0, 16] },

      {
        columns: [
          { width: '*', text: [{ text: 'Исполнитель ', bold: true }, '_____________ / ', profileName(profile), ' /'] },
          { width: '*', text: [{ text: 'Заказчик ', bold: true }, '_____________ / ', (cp && cp.name) || '', ' /'] }
        ]
      }
    ],
    footer: (page) => ({ text: `стр. ${page}`, alignment: 'center', fontSize: 8, margin: [0, 10, 0, 0], color: '#888' })
  }
}

// ───────────────────────── Блоки реквизитов ─────────────────────────

function requisitesTable(title, lines) {
  return {
    table: {
      widths: ['*'],
      body: [
        [{ text: title, bold: true, fillColor: '#f1f3f5', margin: [6, 4, 6, 4] }],
        [{ text: lines.filter(Boolean).join('\n'), margin: [6, 4, 6, 4] }]
      ]
    },
    layout: lightLayout
  }
}

function supplierLines(p) {
  if (!p) return ['(заполните профиль перевозчика)']
  return [
    p.full_name,
    p.inn ? `ИНН ${p.inn}` : '',
    p.ogrnip ? `ОГРНИП ${p.ogrnip}` : '',
    p.address,
    bankLine(p),
    p.phone ? `тел. ${p.phone}` : ''
  ]
}

function buyerLines(cp) {
  if (!cp) return ['(заказчик не выбран)']
  return [
    cp.name,
    [cp.inn ? `ИНН ${cp.inn}` : '', cp.kpp ? `КПП ${cp.kpp}` : ''].filter(Boolean).join('  '),
    cp.address,
    bankLine(cp)
  ]
}

function bankLine(x) {
  const parts = []
  if (x.bank_name) parts.push(`Банк: ${x.bank_name}`)
  if (x.bank_account) parts.push(`р/с ${x.bank_account}`)
  if (x.bank_bik) parts.push(`БИК ${x.bank_bik}`)
  if (x.bank_corr_account) parts.push(`к/с ${x.bank_corr_account}`)
  return parts.join(', ')
}

function profileName(p) {
  return (p && p.full_name) || ''
}

// ───────────────────────── Оформление таблиц ─────────────────────────

const lightLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#cccccc',
  vLineColor: () => '#cccccc'
}
const th = (t) => ({ text: t, bold: true, fillColor: '#f1f3f5', fontSize: 9, margin: [4, 3, 4, 3] })
const td = (t) => ({ text: t, fontSize: 9, margin: [4, 3, 4, 3] })
const tdR = (t, bold) => ({ text: t, bold: !!bold, alignment: 'right', margin: [6, 1, 0, 1] })

// ───────────────────────── Утилиты ─────────────────────────

function num(v) { return v == null || v === '' ? 0 : Number(v) || 0 }
function round2(v) { return Math.round(v * 100) / 100 }

function money(v) {
  return num(v).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽'
}

function dt(value) {
  if (!value) return '__.__.____'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function routeText(order) {
  const points = Array.isArray(order.points) ? order.points : []
  const loads = points.filter((p) => p.kind === 'loading')
  const unloads = points.filter((p) => p.kind === 'unloading')
  const from = loads[0]?.address || order.loading_address || ''
  const to = unloads[unloads.length - 1]?.address || order.unloading_address || ''
  if (from && to) return `${shortAddr(from)} — ${shortAddr(to)}`
  return ''
}
function shortAddr(a) {
  return String(a).split(',')[0].trim()
}

// Сумма прописью (рубли и копейки)
function rublesToWords(amount) {
  const a = round2(num(amount))
  const rub = Math.floor(a)
  const kop = Math.round((a - rub) * 100)
  const words = intToWords(rub) || 'ноль'
  const rubForm = plural(rub, 'рубль', 'рубля', 'рублей')
  const kopForm = plural(kop, 'копейка', 'копейки', 'копеек')
  const cap = words.charAt(0).toUpperCase() + words.slice(1)
  return `${cap} ${rubForm} ${String(kop).padStart(2, '0')} ${kopForm}`
}

const ONES = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const ONES_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']

function tripletToWords(n, feminine) {
  const ones = feminine ? ONES_F : ONES
  const out = []
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const u = n % 10
  if (h) out.push(HUNDREDS[h])
  if (t >= 2) { out.push(TENS[t]); if (u) out.push(ones[u]) }
  else { const tu = t * 10 + u; if (tu) out.push(ones[tu]) }
  return out.join(' ')
}

function plural(n, one, few, many) {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few
  return many
}

function intToWords(num) {
  if (num === 0) return ''
  const scales = [
    { div: 1000000000, one: 'миллиард', few: 'миллиарда', many: 'миллиардов', fem: false },
    { div: 1000000, one: 'миллион', few: 'миллиона', many: 'миллионов', fem: false },
    { div: 1000, one: 'тысяча', few: 'тысячи', many: 'тысяч', fem: true }
  ]
  const res = []
  let rest = num
  for (const sc of scales) {
    const cnt = Math.floor(rest / sc.div)
    rest = rest % sc.div
    if (cnt > 0) {
      res.push(tripletToWords(cnt, sc.fem))
      res.push(plural(cnt, sc.one, sc.few, sc.many))
    }
  }
  if (rest > 0) res.push(tripletToWords(rest, false))
  return res.join(' ').replace(/\s+/g, ' ').trim()
}
