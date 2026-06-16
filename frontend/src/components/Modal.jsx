export default function Modal({ title, children, onClose, fillViewport = false }) {
  const panelHeight = fillViewport ? 'h-[calc(100dvh-2rem)]' : 'max-h-[calc(100dvh-2rem)]';

  return <div className="fixed inset-0 bg-slate-900/50 grid place-items-center overflow-hidden p-4 z-50">
    <div className={`flex ${panelHeight} w-full max-w-2xl flex-col rounded-3xl bg-white shadow-soft`}>
      <div className="shrink-0 flex items-center justify-between gap-4 border-b p-6">
        <h3 className="text-xl font-bold">{title}</h3>
        <button onClick={onClose} className="rounded-xl px-3 py-1 bg-slate-100">Close</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
        {children}
      </div>
    </div>
  </div>;
}
