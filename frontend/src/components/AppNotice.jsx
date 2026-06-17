import { AlertCircle, CheckCircle, X } from 'lucide-react';

export default function AppNotice({ notice, onClose }) {
  if (!notice) return null;

  const isSuccess = notice.type === 'success';
  return <div className="fixed right-3 top-3 z-[70] w-[min(420px,calc(100vw-1.5rem))] rounded-2xl border bg-white p-4 shadow-soft sm:right-6 sm:top-6 sm:w-[min(420px,calc(100vw-3rem))]">
    <div className="flex items-start gap-3">
      <div className={`mt-0.5 ${isSuccess ? 'text-emerald-600' : 'text-red-600'}`}>
        {isSuccess ? <CheckCircle size={22} /> : <AlertCircle size={22} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold">{notice.title || (isSuccess ? 'Success' : 'Error')}</p>
        <p className="mt-1 text-sm text-slate-600">{notice.message}</p>
      </div>
      <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <X size={18} />
      </button>
    </div>
  </div>;
}
