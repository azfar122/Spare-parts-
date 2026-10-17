import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../api/client.js';

export default function SaleCustomerPicker({ mode, onModeChange, search, onSearchChange, selected, onSelect }) {
  const id = useId();
  const searchRef = useRef(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'existing' || selected) return;
    let active = true;
    setLoading(true); setError(''); setCustomers([]);
    const timer = setTimeout(async () => {
      try {
        const r = await api.get('/customers', { params: { q: search, limit: 20 } });
        if (active) setCustomers(r.data.items || []);
      } catch { if (active) setError('Could not load customers. Change the search to retry.'); }
      finally { if (active) setLoading(false); }
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, search, selected]);
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
      {!selected && <div id={`${id}-options`} role="listbox" aria-label="Customers" aria-busy={loading} className="mt-2 max-h-44 overflow-y-auto rounded-xl border bg-white">
        {loading && <p className="p-3 text-sm text-slate-500">Searching customers…</p>}
        {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
        {!loading && !error && customers.map(customer => <button key={customer._id} type="button" role="option" aria-selected={selected?._id === customer._id} onClick={() => { onSearchChange(customer.name); onSelect(customer); }} className={`w-full border-b p-3 text-left text-sm last:border-b-0 hover:bg-slate-50 ${selected?._id === customer._id ? 'bg-red-50' : ''}`}>
          <span className="font-semibold">{customer.name}</span><span className="ml-2 text-slate-500">{customer.phone || 'No phone'}</span>
        </button>)}
        {!loading && !error && customers.length === 0 && <p className="p-3 text-sm text-slate-500">No customers found.</p>}
      </div>}
      <p className="mt-2 text-xs text-slate-500">This customer applies to every item on the current bill.</p>
    </div>}
  </div>;
}
