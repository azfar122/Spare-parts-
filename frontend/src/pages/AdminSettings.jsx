import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { api } from '../api/client.js';

export default function AdminSettings() {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  async function clearHistory() {
    setBusy(true); setError(''); setResult(null);
    try {
      const r = await api.delete('/admin/settings/sales-history', { data: { confirmation, password } });
      setResult(r.data); setPassword(''); setConfirmation('');
    } catch (err) { setError(err.response?.data?.message || 'Could not confirm deletion. Reload sales history before retrying.'); }
    finally { setBusy(false); setConfirming(false); }
  }
  return <Layout title="Settings" subtitle="Manage sales history.">
    <section className="max-w-2xl rounded-2xl border border-red-200 bg-white p-6 shadow-soft">
      <h3 className="text-xl font-bold">Clear sales and receipt history</h3>
      <p className="mt-3 text-sm text-slate-600">Permanently deletes all sales, bills, receipts, and their return history from MongoDB, across all dates and salespeople. Revenue and profit reports will start fresh.</p>
      <p className="mt-3 text-sm text-slate-600">Inventory quantities, purchase costs and history, orders, warehouses, accounts, customers, and customer balances stay as they are. Sales will not be reversed or stock restored. Customer ledger amounts remain, with their old receipt links removed.</p>
      <p className="mt-3 text-sm font-semibold text-red-700">This cannot be undone. Clear history when staff are not recording sales or returns.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {result && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-emerald-800">Cleared {result.salesDeleted} sale(s) and {result.returnsDeleted} return record(s).</p>}
      <form className="mt-5 space-y-4" onSubmit={e => { e.preventDefault(); setConfirming(true); }}>
        <label className="block text-sm font-semibold">Admin password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="block text-sm font-semibold">Type DELETE ALL SALES<input required value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-xl border p-3" /></label>
        <button disabled={busy || confirmation !== 'DELETE ALL SALES' || !password} className="rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-40">Clear all sales history</button>
      </form>
    </section>
    {confirming && <ConfirmModal title="Permanently delete all sales?" message="Every sales receipt and return record will be deleted from MongoDB. Inventory and customer balances will remain unchanged." destructive confirmLabel="Delete all sales" busy={busy} onConfirm={clearHistory} onCancel={() => setConfirming(false)} />}
  </Layout>;
}
