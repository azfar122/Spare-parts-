import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { LoadingState } from './Loader.jsx';

const money = value => `Rs ${Number(value || 0).toLocaleString()}`;

export default function CustomerProductHistory({ customerId }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState({ items: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => {
      api.get(`/customers/${customerId}/product-history`, { params: { q, page, limit: 50 }, signal: controller.signal, timeout: 20000 })
        .then(({ data }) => { if (!controller.signal.aborted) setHistory(data); })
        .catch(err => { if (!controller.signal.aborted) setError(err.response?.data?.message || 'Could not load product history.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [customerId, q, page, retry]);

  return <div className="p-4">
    <label className="block text-sm font-semibold">Search this customer's products
      <input type="search" value={q} onChange={event => { setQ(event.target.value); setPage(1); }} placeholder="e.g. filter or part number" className="mt-2 w-full rounded-xl border p-3 font-normal" />
    </label>
    <p className="mt-2 text-xs text-slate-500">Completed sales across all dates and salespeople. Rates shown are the recorded unit selling prices.</p>
    {loading ? <LoadingState label="Loading product price history..." /> : error ?
      <p role="alert" className="mt-4 text-sm text-red-700">{error} <button type="button" onClick={() => setRetry(value => value + 1)} className="underline">Retry</button></p> : <>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[850px] text-sm">
          <thead className="bg-slate-50 text-left"><tr>{['Date', 'Bill', 'Product', 'Part No', 'Qty', 'Unit Rate', 'Discount', 'Line Total'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
          <tbody>{history.items.map(item => <tr key={`${item.saleId}-${item.itemIndex}`} className="border-t">
            <td className="whitespace-nowrap p-3">{new Date(item.date).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</td>
            <td className="p-3">{item.receiptNo}</td><td className="p-3">{item.partName}</td><td className="p-3">{item.partCode}</td>
            <td className="p-3">{item.qty}</td><td className="whitespace-nowrap p-3 font-semibold">{money(item.price)}</td><td className="p-3">{money(item.discount)}</td><td className="p-3">{money(item.lineTotal)}</td>
          </tr>)}</tbody>
        </table></div>
        {!history.items.length && <p className="p-6 text-center text-slate-500">No matching product sales for this customer.</p>}
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>{history.total} matching sale item{history.total === 1 ? '' : 's'}</span>
          {history.pages > 1 && <div className="flex items-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
            <span>{page} / {history.pages}</span>
            <button type="button" disabled={page >= history.pages} onClick={() => setPage(value => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
          </div>}
        </div>
      </>}
  </div>;
}
