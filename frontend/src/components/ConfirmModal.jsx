import { AlertTriangle } from 'lucide-react';
import { ButtonSpinner } from './Loader.jsx';

export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel
}) {
  const confirmClass = destructive
    ? 'bg-brand-red text-white hover:bg-red-700'
    : 'bg-brand-dark text-white hover:bg-slate-800';

  return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/50 p-4">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${destructive ? 'bg-red-50 text-brand-red' : 'bg-slate-100 text-slate-700'}`}>
          <AlertTriangle size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-xl border px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={`inline-flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}
        >
          {busy && <ButtonSpinner />}
          {busy ? 'Working...' : confirmLabel}
        </button>
      </div>
    </div>
  </div>;
}
