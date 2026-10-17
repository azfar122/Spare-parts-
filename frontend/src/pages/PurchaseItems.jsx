import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { api } from '../api/client.js';

const empty = { qty: '1', unitCost: '', destination: 'shop', warehouseId: '', partName: '', partCode: '', brand: '', mrp: '', wholesalePrice: '' };
const money = value => `Rs ${Number(value || 0).toLocaleString()}`;
export default function PurchaseItems() {
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState(null);
  const [creating, setCreating] = useState(false);
  const [options, setOptions] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const change = e => setForm(current => ({ ...current, [e.target.name]: e.target.value }));
  async function load(pageNumber = 1) {
    const [purchases, stores] = await Promise.all([api.get('/purchases', { params: { page: pageNumber } }), api.get('/warehouses')]);
    setHistory(purchases.data.items); setTotal(purchases.data.total); setPage(pageNumber); setWarehouses(stores.data);
  }
  useEffect(() => { load().catch(err => setError(err.response?.data?.message || 'Could not load purchases.')); }, []);
  useEffect(() => {
    let active = true;
    if (product || creating) { setOptions([]); setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await api.get('/products', { params: { q: search, limit: 20 } });
        if (active) setOptions(r.data.items || []);
      } catch { if (active) setError('Could not search products.'); }
      finally { if (active) setSearching(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, product, creating]);
  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!creating && !product) return setError('Select a product or add a new item.');
    setBusy(true);
    try {
      await api.post('/purchases', {
        productId: creating ? undefined : product._id,
        newProduct: creating ? { partName: form.partName, partCode: form.partCode, brand: form.brand, mrp: form.mrp, wholesalePrice: form.wholesalePrice || 0 } : undefined,
        qty: form.qty, unitCost: form.unitCost, destination: form.destination,
        warehouseId: form.destination === 'warehouse' ? form.warehouseId : undefined
      });
      setForm(empty); setProduct(null); setSearch(''); setCreating(false);
      setSuccess('Purchase recorded and stock added. Existing prices were preserved.');
      try { await load(1); } catch { setError('Purchase saved, but history could not refresh. Reload this page.'); }
    } catch (err) { setError(err.response?.data?.message || 'Could not record purchase.'); }
    finally { setBusy(false); }
  }
  const input = 'mt-1 w-full rounded-xl border p-3';
  return <Layout title="Purchase Items" subtitle="Record received stock and its purchase cost. Choose the main store or a warehouse.">
    {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-emerald-800">{success}</p>}
    <form onSubmit={submit} className="rounded-2xl border bg-white p-5 shadow-soft">
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label>Quantity purchased<input className={input} name="qty" type="number" min="1" step="1" required value={form.qty} onChange={change}/></label>
        <div className="sm:col-span-2">
          <label htmlFor="purchase-product">Product</label>
          <input id="purchase-product" className={input} placeholder="Search product name or part number" value={search} disabled={creating} onChange={e => { setSearch(e.target.value); setProduct(null); }}/>
          {!product && !creating && <div role="listbox" aria-label="Products" className="mt-1 max-h-48 overflow-y-auto rounded-xl border">
            {searching && <p className="p-3 text-sm text-slate-500">Searching…</p>}
            {!searching && options.length === 0 && <p className="p-3 text-sm text-slate-500">No matching products.</p>}
            {options.map(item => <button type="button" role="option" aria-selected="false" key={item._id} className="block w-full border-b p-3 text-left hover:bg-slate-50" onClick={() => { setProduct(item); setSearch(`${item.partName} — ${item.partCode}`); setForm(current => ({ ...current, unitCost: String(item.bookingPrice || 0) })); }}>{item.partName} · {item.partCode}</button>)}
          </div>}
          <button type="button" className="mt-2 text-sm font-semibold text-brand-red" onClick={() => { setCreating(!creating); setProduct(null); setSearch(''); }}>{creating ? 'Choose existing product' : '+ Add new item'}</button>
        </div>
        {creating && <>{[['partName', 'Product name'], ['partCode', 'Part number'], ['brand', 'Brand'], ['mrp', 'Retail price'], ['wholesalePrice', 'Wholesale price']].map(([name, label]) => <label key={name}>{label}<input className={input} name={name} required={['partName', 'partCode', 'mrp'].includes(name)} type={['mrp', 'wholesalePrice'].includes(name) ? 'number' : 'text'} min="0" step="0.01" value={form[name]} onChange={change}/></label>)}</>}
        <label>Purchase price per unit<input className={input} name="unitCost" type="number" min="0" step="1" required value={form.unitCost} onChange={change}/></label>
        <label>Store in warehouse?<select className={input} name="destination" value={form.destination} onChange={change}><option value="shop">No — Main store</option><option value="warehouse">Yes — Select warehouse</option></select></label>
        {form.destination === 'warehouse' && <label>Warehouse<select className={input} name="warehouseId" value={form.warehouseId} onChange={change} required><option value="">Select warehouse</option>{warehouses.map(store => <option key={store._id} value={store._id}>{store.name}</option>)}</select></label>}
        <div className="flex items-end justify-between gap-4 sm:col-span-2 lg:col-span-3"><p className="text-sm text-slate-500">Purchase total: <strong className="text-slate-900">{money(Number(form.qty) * Number(form.unitCost))}</strong></p><button disabled={busy} className="rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Record purchase'}</button></div>
      </fieldset>
    </form>
    <h3 className="mb-3 mt-8 text-xl font-bold">Purchase history</h3>
    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full whitespace-nowrap text-sm"><thead className="bg-slate-50"><tr>{['Date', 'Product', 'Quantity purchased', 'Purchase price', 'Total cost', 'Stored in', 'Recorded by'].map(label => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{history.map(row => <tr key={row._id} className="border-t"><td className="p-3">{new Date(row.createdAt).toLocaleString()}</td><td className="p-3">{row.product?.partName || 'Deleted product'} · {row.product?.partCode}</td><td className="p-3">{row.quantity}</td><td className="p-3">{money(row.unitCost)}</td><td className="p-3">{money(row.quantity * row.unitCost)}</td><td className="p-3">{row.warehouse?.name || 'Main store'}</td><td className="p-3">{row.createdBy?.name || row.createdBy?.username || '—'}</td></tr>)}{history.length === 0 && <tr><td colSpan="7" className="p-6 text-center text-slate-500">No purchases recorded yet.</td></tr>}</tbody></table></div>
    <div className="mt-3 flex justify-end gap-3"><button disabled={page <= 1} onClick={() => load(page - 1).catch(() => setError('Could not load history.'))} className="rounded-lg border p-2 disabled:opacity-40">Previous</button><span className="p-2">Page {page} of {Math.max(1, Math.ceil(total / 50))}</span><button disabled={page * 50 >= total} onClick={() => load(page + 1).catch(() => setError('Could not load history.'))} className="rounded-lg border p-2 disabled:opacity-40">Next</button></div>
  </Layout>;
}
