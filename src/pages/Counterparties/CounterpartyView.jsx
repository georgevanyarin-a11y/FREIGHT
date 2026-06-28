import { FiEdit2 } from 'react-icons/fi'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

const RELIABILITY_LABEL = {
  good: 'Надёжный',
  watch: 'С осторожностью',
  bad: 'Проблемный',
  unknown: 'Не оценён'
}

export default function CounterpartyView({ open, counterparty, onClose, onEdit }) {
  if (!counterparty) return null
  const c = counterparty

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={c.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Закрыть</Button>
          {onEdit && <Button onClick={() => onEdit(c)}><FiEdit2 size={15} />Редактировать</Button>}
        </>
      }
    >
      <div className="space-y-5">
        <Card title="Реквизиты">
          <Row label="Наименование" value={c.name} />
          <Row label="ИНН" value={c.inn} />
          <Row label="КПП" value={c.kpp} />
          <Row label="ОГРН" value={c.ogrn} />
          <Row label="Адрес" value={c.address} />
        </Card>

        <Card title="Контакты">
          <Row label="Контактное лицо" value={c.contact_name} />
          <Row label="Телефон" value={c.phone} />
          <Row label="Email" value={c.email} />
        </Card>

        <Card title="Банк">
          <Row label="Банк" value={c.bank_name} />
          <Row label="Расчётный счёт" value={c.bank_account} />
          <Row label="БИК" value={c.bank_bik} />
        </Card>

        <Card title="Прочее">
          <Row label="Надёжность" value={RELIABILITY_LABEL[c.reliability] || RELIABILITY_LABEL.unknown} />
          <Row label="Заметка" value={c.note} />
        </Card>
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
