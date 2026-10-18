import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const columns = [
  { key: 'partName', label: 'Product Name', required: true },
  { key: 'partCode', label: 'Part No', required: true },
  { key: 'brand', label: 'Brand' },
  { key: 'bookingPrice', label: 'Booking Price', type: 'number', step: '0.01' },
  { key: 'wholesalePrice', label: 'Wholesale Price', type: 'number', step: '0.01' },
  { key: 'sellingPrice', label: 'Selling Price', type: 'number', step: '0.01' },
  { key: 'mrp', label: 'Retail Price (RP)', type: 'number', step: '0.01' },
  { key: 'quantity', label: 'Shop Stock Qty', type: 'number' },
  { key: 'minOrderQty', label: 'Min Order Qty', type: 'number', min: 1 },
  { key: 'minimumQuantity', label: 'Minimum Qty', type: 'number' }
];

function editableValues(product) {
  return Object.fromEntries(columns.map(({ key, type }) => [key,
    type === 'number' ? String(product[key] ?? (key === 'minOrderQty' ? 1 : 0)) : product[key] ?? ''
  ]));
}

export default function InventoryList() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';
  const [products, setProducts] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const dirtyCount = Object.keys(drafts).length;

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const { data } = await api.get('/products', { params: { all: 'true' } });
      setProducts(data.items);
    } catch (err) {
      setLoadFailed(true);
      setNotice({ type: 'error', title: 'Inventory Failed', message: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!dirtyCount) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyCount]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter(product => {
      const values = drafts[product._id] || editableValues(product);
      return !term || [values.partName, values.partCode, values.brand].some(value => value.toLowerCase().includes(term));
    });
  }, [products, drafts, query]);

  function edit(product, key, value) {
    setDrafts(current => {
      const original = editableValues(product);
      const next = { ...(current[product._id] || original), [key]: value };
      const updated = { ...current };
      if (columns.every(column => next[column.key] === original[column.key])) delete updated[product._id];
      else updated[product._id] = next;
      return updated;
    });
  }

  async function save(event) {
    event.preventDefault();
    if (!canEdit || saving) return;
    const changes = Object.entries(drafts);
    // Validate hidden search results as well as the visible inputs.
    for (const [id, values] of changes) {
      const baseline = editableValues(products.find(product => product._id === id));
      for (const column of columns) {
        if (values[column.key] === baseline[column.key]) continue;
        const value = values[column.key];
        const number = Number(value);
        if ((column.required && !value.trim()) || (column.type === 'number' &&
          (!value.trim() || !Number.isFinite(number) || number < (column.min ?? 0) || (!column.step && !Number.isInteger(number))))) {
          setNotice({ type: 'error', title: 'Check Inventory', message: `${values.partCode || values.partName || 'Product'}: enter a valid ${column.label}.` });
          return;
        }
      }
    }
    setSaving(true);
    setNotice(null);
    let saved = 0;
    const failures = [];
    try {
      for (const [id, values] of changes) {
        const original = products.find(product => product._id === id);
        const baseline = editableValues(original);
        const body = Object.fromEntries(columns.filter(column => values[column.key] !== baseline[column.key])
          .map(column => [column.key, column.type === 'number' ? Number(values[column.key]) : values[column.key].trim()]));
        try {
          const { data } = await api.put(`/products/${id}`, body);
          setProducts(current => current.map(product => product._id === id ? data : product));
          setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
          saved += 1;
        } catch (err) {
          failures.push(`${values.partCode}: ${err.response?.data?.message || err.message}`);
        }
      }
      setNotice(failures.length
        ? { type: 'error', title: `${saved} saved, ${failures.length} failed`, message: `${failures.join(' • ')}. Unsaved edits are kept so you can correct them and save again.` }
        : { type: 'success', title: 'Inventory Saved', message: `${saved} product${saved === 1 ? '' : 's'} updated successfully.` });
    } finally {
      setSaving(false);
    }
  }

  return <Layout title="Inventory List" subtitle={canEdit ? 'Edit product details, prices and shop stock directly in the full inventory list.' : 'View all product details, prices and shop stock in one list.'} wide>
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    {loading ? <LoadingState label="Loading full inventory..." /> : loadFailed ?
      <button onClick={load} className="rounded-xl border px-5 py-3">Retry loading inventory</button> :
      <form onSubmit={save} noValidate>
        <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <input type="search" aria-label="Search inventory" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search product name, part no or brand" className="min-w-0 flex-1 rounded-xl border p-3" />
          <span className="text-sm text-slate-500">{visibleProducts.length} of {products.length} products{canEdit && ` · ${dirtyCount} unsaved`}</span>
          {canEdit && <button type="submit" disabled={saving || !dirtyCount} className="flex items-center gap-2 rounded-xl bg-brand-red px-5 py-3 font-semibold text-white disabled:opacity-50">
            {saving && <ButtonSpinner />}{saving ? 'Saving...' : 'Save Changes'}
          </button>}
        </div>
        <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>{columns.map(column => <th key={column.key} scope="col" className="whitespace-nowrap px-3 py-4 text-left font-semibold">{column.label}</th>)}</tr></thead>
            <tbody>{visibleProducts.map(product => {
              const values = drafts[product._id] || editableValues(product);
              return <tr key={product._id} className={`border-t ${drafts[product._id] ? 'bg-amber-50' : ''}`}>
                {columns.map(column => <td key={column.key} className="p-2">
                  {canEdit ? <input aria-label={`${column.label} for ${product.partCode || product.partName}`} type={column.type || 'text'}
                    value={values[column.key]} onChange={event => edit(product, column.key, event.target.value)}
                    disabled={saving} required={column.required || column.type === 'number'}
                    min={column.type === 'number' ? column.min ?? 0 : undefined} step={column.type === 'number' ? column.step || '1' : undefined}
                    className={`w-full rounded-lg border border-slate-200 bg-white p-2 focus:border-brand-red focus:outline-none disabled:opacity-60 ${column.key === 'partName' ? 'min-w-[240px]' : 'min-w-[140px]'}`} /> :
                    <span className="block min-w-[120px] whitespace-nowrap p-2">{values[column.key] || '—'}</span>}
                </td>)}
              </tr>;
            })}</tbody>
          </table>
          {!visibleProducts.length && <p className="p-8 text-center text-slate-500">{products.length ? 'No products match your search.' : 'No products in inventory.'}</p>}
        </div>
      </form>}
  </Layout>;
}
