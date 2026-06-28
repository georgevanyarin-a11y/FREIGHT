import Modal from './Modal'
import Button from './Button'

/**
 * Диалог подтверждения опасного действия (например, удаления).
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  message = 'Вы уверены?',
  confirmText = 'Удалить',
  loading = false
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Удаление…' : confirmText}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-600">{message}</p>
    </Modal>
  )
}
