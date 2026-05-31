export default function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 bg-slate-900/50 grid place-items-center p-4 z-50">
    <div className="bg-white rounded-3xl shadow-soft max-w-2xl w-full p-6">
      <div className="flex items-center justify-between mb-5"><h3 className="text-xl font-bold">{title}</h3><button onClick={onClose} className="rounded-xl px-3 py-1 bg-slate-100">Close</button></div>
      {children}
    </div>
  </div>;
}
