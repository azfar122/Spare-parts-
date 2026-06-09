import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight, Filter, Plus, X } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import ProductTable from '../components/ProductTable.jsx';
import Modal from '../components/Modal.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [tab, setTab] = useState('inventory');
  const [returns, setReturns] = useState([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [hasExactMatch, setHasExactMatch] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState('');
  const [notice, setNotice] = useState(null);

  async function load(pageNum = 1) {
    try {
      setLoadingProducts(true);
      const r = await api.get('/products', { params: { q, limit, page: pageNum, inStock: inStockOnly ? 'true' : undefined } });
      setProducts(r.data.items);
      setTotal(r.data.total || 0);
      setPage(pageNum);
      
      if (q) {
        const hasExact = r.data.items?.some(p => 
          p.partName?.toUpperCase() === q.toUpperCase() || 
          p.partCode?.toUpperCase() === q.toUpperCase() ||
          p.model?.toUpperCase() === q.toUpperCase() ||
          p.brand?.toUpperCase() === q.toUpperCase() ||
          p.category?.toUpperCase() === q.toUpperCase() ||
          p.type?.toUpperCase() === q.toUpperCase()
        );
        setHasExactMatch(hasExact);
      } else {
        setHasExactMatch(true);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadReturns() {
    try {
      setLoadingReturns(true);
      const r = await api.get('/returns');
      setReturns(r.data || []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoadingReturns(false);
    }
  }

  async function handleAddProduct(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.model = body.type || body.model || 'COMMON';
    body.mrp = Number(body.mrp);
    body.quantity = Number(body.quantity);
    body.bookingPrice = body.mrp;
    body.minOrderQty = Number(body.minOrderQty || 1);
    try {
      setAddingProduct(true);
      await api.post('/products', body);
      setShowAddProduct(false);
      e.currentTarget.reset();
      await load(1);
      setNotice({ type: 'success', title: 'Product Added', message: 'Product stock added successfully.' });
    } catch (err) {
      setNotice({ type: 'error', title: 'Add Product Failed', message: err.response?.data?.message || err.message });
    } finally {
      setAddingProduct(false);
    }
  }

  useEffect(() => { load(1); }, [q, inStockOnly]);
  useEffect(() => {
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001');
    s.on('inventory:update', () => load(page));
    s.on('inventory:bulk-update', () => load(page));
    return () => s.disconnect();
  }, [page]);
  useEffect(() => {
    if (tab === 'returns') {
      loadReturns();
    }
  }, [tab]);

  async function saveEdit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    body.model = body.type || body.model || 'COMMON';
    body.mrp = Number(body.mrp); body.bookingPrice = body.mrp; body.quantity = Number(body.quantity); body.minOrderQty = Number(body.minOrderQty);
    try {
      setSavingEdit(true);
      await api.put(`/products/${editing._id}`, body);
      setEditing(null); await load(page);
      setNotice({ type: 'success', title: 'Product Updated', message: 'Product details updated successfully.' });
    } catch (err) {
      setNotice({ type: 'error', title: 'Update Failed', message: err.response?.data?.message || err.message });
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteProduct(product) {
    const name = product.productName || product.partName || 'this product';
    if (!window.confirm(`Delete ${name} from inventory? Sales history will remain available.`)) return;
    try {
      setDeletingProductId(product._id);
      await api.delete(`/products/${product._id}`);
      if (selected?._id === product._id) setSelected(null);
      if (editing?._id === product._id) setEditing(null);
      await load(page);
      setNotice({ type: 'success', title: 'Product Deleted', message: `${name} was removed from inventory.` });
    } catch (err) {
      setNotice({ type: 'error', title: 'Delete Failed', message: err.response?.data?.message || err.message });
    } finally {
      setDeletingProductId('');
    }
  }

  const totalPages = Math.ceil(total / limit);

  return <Layout title="Admin Inventory" subtitle="Manage products, prices, quantity and product details.">
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="mb-5 flex gap-3 border-b">
      <button onClick={() => setTab('inventory')} className={`px-4 py-2 font-medium border-b-2 transition ${tab === 'inventory' ? 'border-brand-red text-brand-red' : 'border-transparent text-slate-600'}`}>Inventory</button>
      <button onClick={() => setTab('returns')} className={`px-4 py-2 font-medium border-b-2 transition ${tab === 'returns' ? 'border-brand-red text-brand-red' : 'border-transparent text-slate-600'}`}>Returns</button>
    </div>

    {tab === 'inventory' && <>
      <div className="mb-5 flex gap-3">
        <div className="flex-1 relative">
          <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load(1)} placeholder="Search by product name, part no, brand, category or type" className="w-full rounded-2xl border p-4 shadow-sm" />
          {q && <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={20}/></button>}
        </div>
        <button onClick={()=>load(1)} className="rounded-2xl bg-brand-dark text-white px-6">Search</button>
        <button onClick={() => setInStockOnly(value => !value)} className={`rounded-2xl border px-5 flex items-center gap-2 font-medium ${inStockOnly ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'hover:bg-slate-50'}`}>
          <Filter size={18}/>{inStockOnly ? 'In Stock' : 'All Stock'}
        </button>
        <button onClick={() => setShowAddProduct(true)} className="rounded-2xl bg-brand-red text-white px-6 flex items-center gap-2"><Plus size={18}/>Add Product</button>
      </div>
      {inStockOnly && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Showing products with quantity greater than 0.</div>}
      {!loadingProducts && q && !hasExactMatch && products.length > 0 && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">No exact match found for "{q}", but showing relevant results:</div>}
      {!loadingProducts && q && products.length === 0 && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">No products found matching "{q}". Try a different search term.</div>}
      {loadingProducts ? <LoadingState label={deletingProductId ? 'Deleting product...' : 'Loading products...'} /> : <ProductTable products={products} onDetail={setSelected} onEdit={setEditing} onDelete={deleteProduct} startIndex={(page - 1) * limit} />}
      
      {totalPages > 1 && <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => load(page - 1)} disabled={page === 1} className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"><ChevronLeft size={16}/>Previous</button>
        <div className="flex items-center gap-2">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = page <= 3 ? i + 1 : page - 2 + i;
            return pageNum > 0 && pageNum <= totalPages ? (
              <button key={pageNum} onClick={() => load(pageNum)} className={`rounded-lg px-3 py-2 font-medium ${page === pageNum ? 'bg-brand-dark text-white' : 'border hover:bg-slate-100'}`}>{pageNum}</button>
            ) : null;
          })}
          {totalPages > 5 && <span className="text-slate-500">...</span>}
        </div>
        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
        <button onClick={() => load(page + 1)} disabled={page === totalPages} className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1">Next<ChevronRight size={16}/></button>
      </div>}
    </>}

    {tab === 'returns' && <>
      <div className="rounded-3xl bg-white shadow-soft overflow-hidden">
        {loadingReturns ? (
          <LoadingState label="Loading returns..." />
        ) : returns.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No returns found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Bill</th>
                <th className="px-4 py-3 text-left font-semibold">Customer</th>
                <th className="px-4 py-3 text-left font-semibold">Part Name</th>
                <th className="px-4 py-3 text-left font-semibold">Part Code</th>
                <th className="px-4 py-3 text-right font-semibold">Qty Returned</th>
                <th className="px-4 py-3 text-right font-semibold">Amount Refunded</th>
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((ret) => (
                <tr key={ret._id} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3">{new Date(ret.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-brand-red">{ret.receiptNo || ret.sale?.receiptNo || '-'}</td>
                  <td className="px-4 py-3">{ret.customer?.name || ret.customerName || '-'}</td>
                  <td className="px-4 py-3 font-medium">{ret.partName}</td>
                  <td className="px-4 py-3 text-slate-600">{ret.partCode}</td>
                  <td className="px-4 py-3 text-right">{ret.qty}</td>
                  <td className="px-4 py-3 text-right font-medium">Rs {ret.amountRefunded?.toLocaleString() || '0'}</td>
                  <td className="px-4 py-3 text-slate-600">{ret.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>}

    {selected && <Modal title="Product Details" onClose={()=>setSelected(null)}><div className="grid grid-cols-2 gap-4 text-sm">{Object.entries(selected).filter(([k])=> ((!k.startsWith('_') || k==='_id') && !['bookingPrice', 'CCP', 'CP', 'Customer price (cc)', 'Customer Price'].includes(k))).map(([k,v])=><div key={k} className="rounded-xl bg-slate-50 p-3"><p className="text-slate-500">{k}</p><p className="font-semibold break-all">{String(v)}</p></div>)}</div></Modal>}
    {editing && <Modal title="Edit Product" onClose={()=>setEditing(null)}><form onSubmit={saveEdit} className="grid grid-cols-2 gap-4">
      <label className="text-sm font-medium">Product name<input name="partName" defaultValue={editing.partName} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Part No<input name="partCode" defaultValue={editing.partCode} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Brand<input name="brand" defaultValue={editing.brand || ''} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Category<input name="category" defaultValue={editing.category || ''} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Type<input name="type" defaultValue={editing.type || editing.model || ''} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Retail Price(RP)<input name="mrp" type="number" min="0" step="0.01" defaultValue={editing.mrp} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Stock Qty<input name="quantity" type="number" min="0" defaultValue={editing.quantity} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="text-sm font-medium">Min Order Qty<input name="minOrderQty" type="number" min="1" defaultValue={editing.minOrderQty} className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="col-span-2 text-sm font-medium">description<textarea name="description" defaultValue={editing.description} className="mt-1 w-full rounded-xl border p-3" /></label>
      <button disabled={savingEdit} className="col-span-2 rounded-xl bg-brand-red text-white py-3 font-bold disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
        {savingEdit && <ButtonSpinner />}
        {savingEdit ? 'Saving...' : 'Save Changes'}
      </button>
    </form></Modal>}
    {showAddProduct && <Modal title="Add New Product" onClose={()=>setShowAddProduct(false)}><form onSubmit={handleAddProduct} className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="text-sm font-medium col-span-2">Product name <span className="text-red-500">*</span><input name="partName" placeholder="e.g., Engine Oil" className="mt-1 w-full rounded-xl border p-3" required /></label>
        <label className="text-sm font-medium">Part No <span className="text-red-500">*</span><input name="partCode" placeholder="e.g., OIL-001" className="mt-1 w-full rounded-xl border p-3" required /></label>
        <label className="text-sm font-medium">Brand<input name="brand" placeholder="e.g., Honda" className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Category<input name="category" placeholder="e.g., Engine" className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Type<input name="type" placeholder="e.g., COMMON" className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="text-sm font-medium">Retail Price(RP) <span className="text-red-500">*</span><input name="mrp" type="number" placeholder="e.g., 500" className="mt-1 w-full rounded-xl border p-3" min="0" step="0.01" required /></label>
        <label className="text-sm font-medium">Stock Qty <span className="text-red-500">*</span><input name="quantity" type="number" placeholder="e.g., 100" className="mt-1 w-full rounded-xl border p-3" min="1" required /></label>
        <label className="text-sm font-medium">Min Order Qty <span className="text-slate-400">(optional)</span><input name="minOrderQty" type="number" placeholder="e.g., 1" className="mt-1 w-full rounded-xl border p-3" min="1" /></label>
      </div>
      <label className="text-sm font-medium">Description<textarea name="description" placeholder="Product description..." className="mt-1 w-full rounded-xl border p-3" rows="3" /></label>
      <div className="flex gap-3">
        <button type="submit" disabled={addingProduct} className="flex-1 rounded-xl bg-brand-red text-white py-3 font-bold disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
          {addingProduct && <ButtonSpinner />}
          {addingProduct ? 'Adding...' : 'Add Product'}
        </button>
        <button type="button" disabled={addingProduct} onClick={()=>setShowAddProduct(false)} className="flex-1 rounded-xl border py-3 font-bold disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
      </div>
    </form></Modal>}
  </Layout>;
}
