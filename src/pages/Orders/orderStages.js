// Единый источник правды по этапам заявки и шаблону чек-листа.
// Используется и в форме заявки, и в списке.

export const STAGES = [
  { value: 'new',            label: 'Новая',                cls: 'bg-ink-100 text-ink-600' },
  { value: 'signed',         label: 'Договор подписан',     cls: 'bg-brand-100 text-brand-700' },
  { value: 'in_transit',     label: 'В рейсе',              cls: 'bg-brand-100 text-brand-700' },
  { value: 'delivered',      label: 'Выгружен',             cls: 'bg-amber-100 text-amber-700' },
  { value: 'ttn_sent',       label: 'ТТН на проверке',      cls: 'bg-amber-100 text-amber-700' },
  { value: 'billed',         label: 'Счёт и акт выставлены',cls: 'bg-amber-100 text-amber-700' },
  { value: 'originals_sent', label: 'Оригиналы отправлены', cls: 'bg-amber-100 text-amber-700' },
  { value: 'paid',           label: 'Оплачено',             cls: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled',      label: 'Отменена',             cls: 'bg-red-100 text-red-700' }
]

export const STAGE_OPTIONS = STAGES.map((s) => ({ value: s.value, label: s.label }))

export function stageView(value) {
  return STAGES.find((s) => s.value === value) || STAGES[0]
}

// Шаблон чек-листа для новой заявки
export function defaultChecklist() {
  return [
    { key: 'contract',  label: 'Получить и подписать договор-заявку', done: false },
    { key: 'packet',    label: 'Отправить пакет документов заказчику', done: false },
    { key: 'load',      label: 'Загрузиться',                          done: false },
    { key: 'unload',    label: 'Выгрузиться',                          done: false },
    { key: 'ttn',       label: 'Снять и отправить ТТН на проверку',    done: false },
    { key: 'invoice',   label: 'Выставить счёт и акт',                 done: false },
    { key: 'originals', label: 'Отправить оригиналы почтой',           done: false },
    { key: 'payment',   label: 'Получить оплату',                      done: false }
  ]
}

// Сводка прогресса по чек-листу
export function checklistProgress(checklist) {
  const list = Array.isArray(checklist) ? checklist : []
  const done = list.filter((i) => i && i.done).length
  return { done, total: list.length }
}
