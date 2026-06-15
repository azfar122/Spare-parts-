import { useEffect, useState } from 'react';
import { BookOpen, Edit, Plus, RefreshCw, Search, Trash2, Wallet } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

const emptyForm = { name: '', phone: '', address: '', notes: '', openingBalance: '' };
const money = value => `Rs ${Number(value || 0).toLocaleString()}`;
const entryBalance = entry => Number(entry.debit || 0) - Number(entry.credit || 0);
const entryTypeLabel = entry => {
  if (entry.type === 'sale' && entry.sale?.paymentStatus === 'partial') return 'Partial';
  if (entry.type === 'sale' && entry.sale?.paymentStatus === 'unpaid') return 'Not Received';
  return entry.type;
};

export default function CustomerLedger() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [entryMode, setEntryMode] = useState(null);
  const [entryForm, setEntryForm] = useState({ amount: '', direction: 'increase', description: '' });
  const [deletingCustomerId, setDeletingCustomerId] = useState('');
  const [deleteCustomerTarget, setDeleteCustomerTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const r = await api.get('/customers', { params: { q, limit: 100 } });
      setCustomers(r.data.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(customer) {
    const r = await api.get(`/customers/${customer._id}`);
    setSelected(r.data.customer);
    setDetail(r.data);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(customer) {
    setEditing(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      openingBalance: customer.openingBalance || ''
    });
    setFormOpen(true);
  }

  async function saveCustomer(e) {
    e.preventDefault();
    try {
      setSaving(true);
      if (editing) {
        await api.put(`/customers/${editing._id}`, form);
      } else {
        await api.post('/customers', { ...form, openingBalance: Number(form.openingBalance || 0) });
      }
      setFormOpen(false);
      await load();
      if (selected) await loadDetail(selected);
      setNotice({ type: 'success', title: editing ? 'Customer Updated' : 'Customer Added', message: editing ? 'Customer details updated successfully.' : 'Customer added successfully.' });
    } catch (err) {
      setNotice({ type: 'error', title: 'Customer Save Failed', message: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  }

  async function saveEntry(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const path = entryMode === 'payment' ? 'payment' : 'adjustment';
      await api.post(`/customers/${selected._id}/${path}`, { ...entryForm, amount: Number(entryForm.amount || 0) });
      setEntryMode(null);
      setEntryForm({ amount: '', direction: 'increase', description: '' });
      await load();
      await loadDetail(selected);
      setNotice({ type: 'success', title: entryMode === 'payment' ? 'Payment Recorded' : 'Adjustment Saved', message: entryMode === 'payment' ? 'Customer payment recorded successfully.' : 'Customer balance adjustment saved successfully.' });
    } catch (err) {
      setNotice({ type: 'error', title: 'Ledger Entry Failed', message: err.response?.data?.message || err.message });
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteCustomer(customer) {
    setDeleteCustomerTarget(customer);
  }

  async function confirmDeleteCustomer() {
    if (!deleteCustomerTarget) return;
    const customer = deleteCustomerTarget;
    try {
      setDeletingCustomerId(customer._id);
      await api.delete(`/customers/${customer._id}`);
      setSelected(null);
      setDetail(null);
      setDeleteCustomerTarget(null);
      await load();
      setNotice({ type: 'success', title: 'Customer Deleted', message: `${customer.name} was removed from Khata.` });
    } catch (err) {
      setNotice({ type: 'error', title: 'Delete Failed', message: err.response?.data?.message || err.message });
    } finally {
      setDeletingCustomerId('');
    }
  }

  const totalBalance = customers.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0);

  return <Layout title="Khata / Customer Ledger" subtitle="Manage customer balances, payments, bills, and manual adjustments.">
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="grid lg:grid-cols-[360px_1fr] gap-6">
      <aside className="rounded-3xl bg-white border shadow-soft overflow-hidden">
        <div className="p-5 border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Outstanding</p>
              <p className="text-2xl font-bold text-brand-red">{money(totalBalance)}</p>
            </div>
            <button onClick={openCreate} className="rounded-xl bg-brand-dark text-white px-4 py-3 inline-flex items-center gap-2"><Plus size={18}/>Add</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); load(); }} className="mt-4 flex gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or phone" className="w-full rounded-xl border py-3 pl-9 pr-3" />
            </div>
            <button className="rounded-xl border px-4" title="Search"><RefreshCw size={18}/></button>
          </form>
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {loading ? <LoadingState label="Loading customers..." /> : customers.map(customer => (
            <button key={customer._id} onClick={() => loadDetail(customer)} className={`w-full text-left p-4 border-b hover:bg-slate-50 ${selected?._id === customer._id ? 'bg-slate-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{customer.name}</p>
                  <p className="text-sm text-slate-500">{customer.phone || 'No phone'}</p>
                </div>
                <p className={`text-sm font-bold ${Number(customer.currentBalance || 0) > 0 ? 'text-brand-red' : 'text-emerald-700'}`}>{money(customer.currentBalance)}</p>
              </div>
            </button>
          ))}
          {!loading && customers.length === 0 && <div className="p-6 text-center text-slate-500">No customers found.</div>}
        </div>
      </aside>

      <section className="rounded-3xl bg-white border shadow-soft overflow-hidden">
        {!detail ? <div className="min-h-[520px] grid place-items-center text-center p-8">
          <div>
            <BookOpen size={42} className="mx-auto text-slate-400" />
            <h3 className="mt-4 text-xl font-bold">Select a customer ledger</h3>
            <p className="text-slate-500 mt-1">Open a customer to view bills, payments, adjustments, and balance history.</p>
          </div>
        </div> : <>
          <div className="p-6 border-b flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl font-bold">{detail.customer.name}</h3>
              <p className="text-slate-500">{detail.customer.phone || 'No phone'}{detail.customer.address ? ` · ${detail.customer.address}` : ''}</p>
              {detail.customer.notes && <p className="text-sm text-slate-500 mt-2">{detail.customer.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => openEdit(detail.customer)} className="rounded-xl border px-4 py-2 inline-flex items-center gap-2"><Edit size={16}/>Edit</button>
              <button onClick={() => setEntryMode('payment')} className="rounded-xl bg-emerald-600 text-white px-4 py-2 inline-flex items-center gap-2"><Wallet size={16}/>Payment</button>
              <button onClick={() => setEntryMode('adjustment')} className="rounded-xl bg-brand-dark text-white px-4 py-2">Adjustment</button>
              <button onClick={() => requestDeleteCustomer(detail.customer)} disabled={deletingCustomerId === detail.customer._id} className="rounded-xl border border-red-200 px-4 py-2 text-red-600 inline-flex items-center gap-2 hover:bg-red-50 disabled:opacity-60"><Trash2 size={16}/>{deletingCustomerId === detail.customer._id ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-4 p-6 border-b">
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Current Balance</p><p className="text-xl font-bold text-brand-red">{money(detail.customer.currentBalance)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Bills</p><p className="text-xl font-bold">{detail.sales.length}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Opening</p><p className="text-xl font-bold">{money(detail.customer.openingBalance)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Entries</p><p className="text-xl font-bold">{detail.ledger.length}</p></div>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr><th className="p-4 text-left">Date</th><th className="p-4 text-left">Type</th><th className="p-4 text-left">Description</th><th className="p-4 text-right">Debit</th><th className="p-4 text-right">Credit</th><th className="p-4 text-right">Balance</th></tr>
              </thead>
              <tbody>
                {detail.ledger.map(entry => {
                  const rowBalance = entryBalance(entry);
                  return <tr key={entry._id} className="border-t">
                    <td className="p-4">{new Date(entry.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td className="p-4 capitalize">{entryTypeLabel(entry)}</td>
                    <td className="p-4">{entry.description}</td>
                    <td className="p-4 text-right">{entry.debit ? money(entry.debit) : '-'}</td>
                    <td className="p-4 text-right">{entry.credit ? money(entry.credit) : '-'}</td>
                    <td className={`p-4 text-right font-bold ${rowBalance < 0 ? 'text-emerald-700' : ''}`}>{rowBalance < 0 ? `-${money(Math.abs(rowBalance))}` : money(rowBalance)}</td>
                  </tr>;
                })}
              </tbody>
            </table>
            {detail.ledger.length === 0 && <div className="p-8 text-center text-slate-500">No ledger entries yet.</div>}
          </div>
        </>}
      </section>
    </div>

    {formOpen && <Modal title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setFormOpen(false)}>
      <form onSubmit={saveCustomer} className="grid gap-4">
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Customer name" className="rounded-xl border p-3" />
        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="rounded-xl border p-3" />
        <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Address" className="rounded-xl border p-3" />
        {!editing && <input type="number" min="0" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} placeholder="Opening balance" className="rounded-xl border p-3" />}
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="rounded-xl border p-3" />
        <button disabled={saving} className="rounded-xl bg-brand-red text-white py-3 font-bold disabled:opacity-70 inline-flex items-center justify-center gap-2">{saving && <ButtonSpinner />}{saving ? 'Saving...' : 'Save Customer'}</button>
      </form>
    </Modal>}

    {entryMode && <Modal title={entryMode === 'payment' ? 'Record Payment' : 'Manual Adjustment'} onClose={() => setEntryMode(null)}>
      <form onSubmit={saveEntry} className="grid gap-4">
        {entryMode === 'adjustment' && <select value={entryForm.direction} onChange={e => setEntryForm({ ...entryForm, direction: e.target.value })} className="rounded-xl border p-3">
          <option value="increase">Increase customer balance</option>
          <option value="decrease">Decrease customer balance</option>
        </select>}
        <input required type="number" min="1" value={entryForm.amount} onChange={e => setEntryForm({ ...entryForm, amount: e.target.value })} placeholder="Amount" className="rounded-xl border p-3" />
        <textarea value={entryForm.description} onChange={e => setEntryForm({ ...entryForm, description: e.target.value })} placeholder="Description" className="rounded-xl border p-3" />
        <button disabled={saving} className="rounded-xl bg-brand-red text-white py-3 font-bold disabled:opacity-70 inline-flex items-center justify-center gap-2">{saving && <ButtonSpinner />}{saving ? 'Saving...' : 'Save Entry'}</button>
      </form>
    </Modal>}
    {deleteCustomerTarget && <ConfirmModal
      title="Delete Customer"
      message={`Delete ${deleteCustomerTarget.name} from Khata? Existing bills and ledger history will remain in reports.`}
      confirmLabel="Delete"
      destructive
      busy={deletingCustomerId === deleteCustomerTarget._id}
      onCancel={() => setDeleteCustomerTarget(null)}
      onConfirm={confirmDeleteCustomer}
    />}
  </Layout>;
}
