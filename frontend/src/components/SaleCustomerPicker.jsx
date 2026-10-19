import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client.js';
import Modal from './Modal.jsx';
import { ButtonSpinner } from './Loader.jsx';

export default function SaleCustomerPicker({ mode, onModeChange, search, onSearchChange, selected, onSelect }) {
  const id = useId();
  const searchRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultSearch, setResultSearch] = useState(null);
  const [newCustomer, setNewCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectionMessage, setSelectionMessage] = useState('');
  const savingRef = useRef(false);
  useEffect(() => {
    if (mode !== 'existing' || selected) return;
    let active = true;
    setLoading(true); setError(''); setCustomers([]);
    const timer = setTimeout(async () => {
      try {
        const r = await api.get('/customers', { params: { q: search, limit: 20 } });
        if (active) { setCustomers(r.data.items || []); setResultSearch(search); }
      } catch { if (active) setError('Could not load customers. Change the search to retry.'); }
      finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, search, selected]);
  async function createCustomer(event) {
    event.preventDefault();
    if (savingRef.current || !newCustomer?.name.trim()) return;
    savingRef.current = true;
    setSaving(true); setCreateError('');
    try {
      const response = await api.post('/customers/quick-create', { name: newCustomer.name.trim(), phone: newCustomer.phone.trim() });
      onSearchChange(response.data.name);
      onSelect(response.data);
      setSelectionMessage(response.status === 201 ? 'Customer created and selected.' : 'Existing customer selected to avoid a duplicate.');
      setNewCustomer(null);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Could not save customer. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return <div className="space-y-3">
    <p className="text-sm font-semibold text-slate-700">Customer</p>
    <div className="grid grid-cols-2 gap-2">
      <button type="button" aria-pressed={mode === 'walk-in'} onClick={() => onModeChange('walk-in')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${mode === 'walk-in' ? 'bg-brand-dark text-white' : 'hover:bg-slate-50'}`}>Walk-in</button>
      <button type="button" aria-pressed={mode === 'existing'} onClick={() => onModeChange('existing')} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${mode === 'existing' ? 'bg-brand-dark text-white' : 'hover:bg-slate-50'}`}>Customer name</button>
    </div>
    {mode === 'existing' && <div>
      <label htmlFor={id} className="sr-only">Search customer by name or phone</label>
      <div className="relative">
      <input ref={searchRef} id={id} value={selected ? selected.name : search} readOnly={Boolean(selected)} aria-controls={selected ? undefined : `${id}-options`} onChange={e => { onSearchChange(e.target.value); onSelect(null); }} placeholder="Search customer name or phone" className="w-full rounded-xl border p-3 pr-11 text-sm" />
      {selected && <button type="button" aria-label="Clear selected customer" title="Choose another customer" onClick={() => { onSelect(null); onSearchChange(''); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X size={18} /></button>}
      </div>
      {selected && selectionMessage && <p role="status" className="mt-2 text-xs text-emerald-700">{selectionMessage}</p>}
      {!selected && <div id={`${id}-options`} role="listbox" aria-label="Customers" aria-busy={loading} className="mt-2 max-h-44 overflow-y-auto rounded-xl border bg-white">
        {loading && <p className="p-3 text-sm text-slate-500">Searching customers…</p>}
        {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && customers.map(customer => <button key={customer._id} type="button" role="option" aria-selected={selected?._id === customer._id} onClick={() => { onSearchChange(customer.name); onSelect(customer); }} className={`w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-slate-50 ${selected?._id === customer._id ? 'bg-red-50' : ''}`}>
          <span className="font-semibold">{customer.name}</span><span className="ml-2 text-slate-500">{customer.phone || 'No phone'}</span>
        </button>)}
        {!loading && !error && customers.length === 0 && <p className="p-3 text-sm text-slate-500">No customers found.</p>}
      </div>}
      {!selected && !loading && !error && resultSearch === search && customers.length === 0 && search.trim() && <button type="button"
        onClick={() => {
          const term = search.trim();
          const isPhone = /^[+\d\s().-]+$/.test(term) && /\d/.test(term);
          setCreateError(''); setSelectionMessage('');
          setNewCustomer({ name: isPhone ? '' : term, phone: isPhone ? term : '' });
        }} className="mt-2 w-full rounded-xl border border-brand-red p-3 text-left text-sm font-semibold text-brand-red hover:bg-red-50">
        Add new customer: {search.trim()}
      </button>}
      <p className="mt-2 text-xs text-slate-500">This customer applies to every item on the current bill.</p>
    </div>}
    {newCustomer && <Modal title="Add New Customer" onClose={() => { if (!savingRef.current) setNewCustomer(null); }}>
      <form onSubmit={createCustomer} className="space-y-4">
        <label className="block text-sm font-medium">Name <span className="text-brand-red">*</span>
          <input autoFocus required value={newCustomer.name} disabled={saving} onChange={event => setNewCustomer(current => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" />
        </label>
        <label className="block text-sm font-medium">Phone (optional)
          <input type="tel" value={newCustomer.phone} disabled={saving} onChange={event => setNewCustomer(current => ({ ...current, phone: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" />
        </label>
        {createError && <p role="alert" className="text-sm text-red-700">{createError}</p>}
        <div className="flex gap-3">
          <button type="button" disabled={saving} onClick={() => setNewCustomer(null)} className="flex-1 rounded-xl border p-3 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={saving || !newCustomer.name.trim()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-red p-3 font-semibold text-white disabled:opacity-50">
            {saving && <ButtonSpinner />}{saving ? 'Saving...' : 'Save & Select'}
          </button>
        </div>
      </form>
    </Modal>}
  </div>;
}
