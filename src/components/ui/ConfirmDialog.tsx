'use client'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export default function ConfirmDialog({ title, message, confirmLabel = 'Επιβεβαίωση', cancelLabel = 'Ακύρωση', onConfirm, onCancel, danger }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button className={danger ? 'btn-danger btn-sm' : 'btn-primary btn-sm'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
