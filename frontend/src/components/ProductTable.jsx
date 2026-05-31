import { Eye, Pencil } from 'lucide-react';

export default function ProductTable({ products, onDetail, onEdit, salesMode, onAddSale }) {
  return <div className="overflow-hidden rounded-3xl bg-white shadow-soft border border-slate-100">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-slate-500">
        <tr><th className="p-4 text-left">Part Name</th><th className="p-4 text-left">Code</th><th className="p-4">Model</th><th className="p-4 text-right">MRP</th><th className="p-4 text-right">Qty</th><th className="p-4 text-right">Action</th></tr>
      </thead>
      <tbody>
        {products.map(p => <tr key={p._id} className="border-t hover:bg-slate-50/70">
          <td className="p-4 font-semibold">{p.partName}</td><td className="p-4 text-slate-500">{p.partCode}</td><td className="p-4 text-center">{p.model}</td><td className="p-4 text-right">Rs {Number(p.mrp).toLocaleString()}</td><td className="p-4 text-right"><span className={p.quantity <= 5 ? 'text-red-600 font-bold' : ''}>{p.quantity}</span></td>
          <td className="p-4"><div className="flex justify-end gap-2">
            {!salesMode && <button className="rounded-xl border px-3 py-2 hover:bg-slate-100 title='View details'" onClick={() => onDetail(p)}><Eye size={16}/></button>}
            {onEdit && <button className="rounded-xl border px-3 py-2 hover:bg-slate-100" onClick={() => onEdit(p)}><Pencil size={16}/></button>}
            {salesMode && <button disabled={p.quantity <= 0} className="rounded-xl bg-brand-red px-4 py-2 text-white disabled:opacity-40" onClick={() => onAddSale(p)}>Sell</button>}
          </div></td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
