import { FiMapPin, FiCheckSquare, FiSquare, FiEdit2 } from 'react-icons/fi'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { stageView } from './orderStages'

export default function OrderView({ open, order, onClose, onEdit }) {
  if (!order) return null
  const sv = stageView(order.stage)
  const points = Array.isArray(order.points) ? order.points : []
  const checklist = Array.isArray(order.checklist) ? order.checklist : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Заявка № ${order.internal_number ?? '—'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          {onEdit && <Button onClick={() => onEdit(order)}><FiEdit2 size={15} />Редактировать</Button>}
        </>
      }
    >
      <div className="space-y-5">
        {/* Шапка */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${sv.cls}`}>{sv.label}</span>
          {order.vat_included ? <Tag>с НДС</Tag> : <Tag>без НДС</Tag>}
          {order.rate != null && <Tag>{formatMoney(order.rate)}</Tag>}
        </div>

        <Card title="Основное">
          <Row label="Заказчик" value={order.counterparty?.name} />
          <Row label="Номер заказчика" value={order.order_number} />
          <Row label="Дата подачи" value={formatDate(order.order_date)} />
        </Card>

        <Card title="Маршрут">
          {points.length === 0 ? (
            <div className="text-sm text-ink-400">Точки не указаны</div>
          ) : (
            <ul className="space-y-2.5">
              {points.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <FiMapPin size={15} className={`mt-0.5 shrink-0 ${p.kind === 'unloading' ? 'text-emerald-600' : 'text-brand-600'}`} />
                  <div className="text-sm">
                    <div className="font-medium text-ink-800">
                      {p.kind === 'unloading' ? 'Выгрузка' : 'Погрузка'}: {p.address || '—'}
                    </div>
                    <div className="text-xs text-ink-400">
                      {[formatDate(p.date), p.time, p.contact_name, p.contact_phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Груз и транспорт">
          <Row label="Груз" value={order.cargo} />
          <Row label="Вес" value={order.weight ? `${order.weight} т` : ''} />
          <Row label="Объём" value={order.volume ? `${order.volume} м³` : ''} />
          <Row label="Водитель" value={order.driver_name} />
          <Row label="Телефон водителя" value={order.driver_phone} />
          <Row label="Транспорт" value={order.vehicle_info} />
        </Card>

        {checklist.length > 0 && (
          <Card title="Чек-лист по рейсу">
            <ul className="space-y-1.5">
              {checklist.map((item, i) => (
                <li key={item.key || i} className="flex items-center gap-2 text-sm">
                  {item.done
                    ? <FiCheckSquare size={16} className="shrink-0 text-emerald-600" />
                    : <FiSquare size={16} className="shrink-0 text-ink-300" />}
                  <span className={item.done ? 'text-ink-400 line-through' : 'text-ink-700'}>{item.label}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {order.note && (
          <Card title="Примечание">
            <div className="whitespace-pre-wrap text-sm text-ink-700">{order.note}</div>
          </Card>
        )}
      </div>
    </Modal>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-ink-200 p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-700">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-500">{label}</span>
      <span className="text-right font-medium text-ink-900">{value}</span>
    </div>
  )
}

function Tag({ children }) {
  return <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">{children}</span>
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatMoney(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'
}
