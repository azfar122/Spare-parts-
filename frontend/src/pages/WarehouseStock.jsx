import { useEffect, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Plus, RefreshCw, Search } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

function errorMessage(error, fallback) {
  if (error.response?.status === 403) return 'Only an admin user can perform this warehouse action. Please log in again with an admin account.';
  return error.response?.data?.message || error.message || fallback;
}

export default function WarehouseStock() {
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [stockRows, setStockRows] = useState([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [loadingStock, setLoadingStock] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stockSavingId, setStockSavingId] = useState('');
  const [showWarehouseForm, setShowWarehouseForm] = useState(false);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ name: '', location: '', notes: '' });
  const limit = 50;

  async function loadWarehouses() {
    try {
      setLoadingWarehouses(true);
      const r = await api.get('/warehouses');
      setWarehouses(r.data || []);
      if (!selectedWarehouse && r.data?.length) setSelectedWarehouse(r.data[0]);
    } catch (err) {
      setNotice({ type: 'error', title: 'Warehouse Load Failed', message: errorMessage(err, 'Unable to load warehouses.') });
    } finally {
      setLoadingWarehouses(false);
    }
  }

  async function loadStock(pageNum = 1) {
    if (!selectedWarehouse) return;
    try {
      setLoadingStock(true);
      const r = await api.get('/warehouses/stock', { params: { warehouseId: selectedWarehouse._id, q, page: pageNum, limit } });
      setStockRows(r.data.items || []);
      setTotal(r.data.total || 0);
      setPage(r.data.page || pageNum);
    } catch (err) {
      setNotice({ type: 'error', title: 'Stock Load Failed', message: errorMessage(err, 'Unable to load warehouse stock.') });
    } finally {
      setLoadingStock(false);
    }
  }

  useEffect(() => { loadWarehouses(); }, []);
  useEffect(() => { loadStock(1); }, [selectedWarehouse, q]);

  async function saveWarehouse(e) {
    e.preventDefault();
    try {
      setSaving(true);
      const r = await api.post('/warehouses', form);
      setShowWarehouseForm(false);
      setForm({ name: '', location: '', notes: '' });
      await loadWarehouses();
      setSelectedWarehouse(r.data);
      setNotice({ type: 'success', title: 'Warehouse Added', message: 'Warehouse added successfully.' });
    } catch (err) {
      setNotice({ type: 'error', title: 'Warehouse Failed', message: errorMessage(err, 'Unable to save warehouse.') });
    } finally {
      setSaving(false);
    }
  }

  async function updateStock(row, value) {
    try {
      setStockSavingId(row.product._id);
      const quantity = Number(value || 0);
      await api.put(`/warehouses/${selectedWarehouse._id}/stock/${row.product._id}`, { quantity });
      setStockRows(rows => rows.map(item => item.product._id === row.product._id ? { ...item, warehouseStock: quantity } : item));
      setNotice({ type: 'success', title: 'Stock Updated', message: `${row.product.partName} warehouse stock updated.` });
    } catch (err) {
      setNotice({ type: 'error', title: 'Stock Update Failed', message: errorMessage(err, 'Unable to update warehouse stock.') });
    } finally {
      setStockSavingId('');
    }
  }

  const totalPages = Math.ceil(total / limit);
  const productName = product => product.productName || product.partName || '-';
  const partNo = product => product.partNo || product.partCode || '-';

  return <Layout title="Warehouse Stock" subtitle="Manage backup stock separately from main inventory." wide>
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-3xl border bg-white shadow-soft">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <p className="text-sm text-slate-500">Warehouses</p>
            <p className="text-2xl font-bold">{warehouses.length}</p>
          </div>
          <button onClick={() => setShowWarehouseForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand-dark px-4 py-3 text-white"><Plus size={18}/>Add</button>
        </div>
        {loadingWarehouses ? <LoadingState label="Loading warehouses..." /> : <div className="max-h-[640px] overflow-y-auto">
          {warehouses.map(warehouse => (
            <button key={warehouse._id} onClick={() => setSelectedWarehouse(warehouse)} className={`w-full border-b p-4 text-left hover:bg-slate-50 ${selectedWarehouse?._id === warehouse._id ? 'bg-slate-50' : ''}`}>
              <div className="flex gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><Building2 size={18}/></div>
                <div>
                  <p className="font-bold">{warehouse.name}</p>
                  <p className="text-sm text-slate-500">{warehouse.location || 'No location'}</p>
                </div>
              </div>
            </button>
          ))}
          {warehouses.length === 0 && <div className="p-6 text-center text-slate-500">No warehouses added yet.</div>}
        </div>}
      </aside>

      <section className="min-w-0 rounded-3xl border bg-white shadow-soft">
        {!selectedWarehouse ? <div className="grid min-h-[520px] place-items-center p-8 text-center text-slate-500">Add or select a warehouse to manage stock.</div> : <>
          <div className="border-b p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold">{selectedWarehouse.name}</h3>
                <p className="text-slate-500">{selectedWarehouse.location || 'No location'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Total Products</p>
                <p className="text-xl font-bold text-brand-red">{total.toLocaleString()}</p>
              </div>
            </div>
            <form onSubmit={e => { e.preventDefault(); loadStock(1); }} className="mt-5 flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product name, part no, brand, category or type" className="w-full rounded-xl border py-3 pl-9 pr-3" />
              </div>
              <button className="rounded-xl border px-4"><RefreshCw size={18}/></button>
            </form>
          </div>
          <div className="max-h-[640px] max-w-full overflow-auto">
            {loadingStock ? <LoadingState label="Loading warehouse stock..." /> : <table className="w-full min-w-[1300px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4 text-left">Sr No.</th>
                  <th className="p-4 text-left">Product Name</th>
                  <th className="p-4 text-left">Part No</th>
                  <th className="p-4 text-left">Brand</th>
                  <th className="p-4 text-left">Category</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-right">Retail Price(RP)</th>
                  <th className="p-4 text-right">Main Qty</th>
                  <th className="p-4 text-right">Warehouse Qty</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {stockRows.map((row, index) => (
                  <tr key={row.product._id} className="border-t">
                    <td className="p-4 font-semibold text-slate-500">{(page - 1) * limit + index + 1}</td>
                    <td className="p-4 font-semibold">{productName(row.product)}</td>
                    <td className="p-4 text-slate-500">{partNo(row.product)}</td>
                    <td className="p-4 text-slate-500">{row.product.brand || '-'}</td>
                    <td className="p-4 text-slate-500">{row.product.category || '-'}</td>
                    <td className="p-4 text-slate-500">{row.product.type || row.product.model || '-'}</td>
                    <td className="p-4 text-right">Rs {Number(row.product.mrp || 0).toLocaleString()}</td>
                    <td className="p-4 text-right">{row.product.quantity}</td>
                    <td className="p-4 text-right"><input id={`warehouse-stock-${row.product._id}`} type="number" min="0" defaultValue={row.warehouseStock} className="w-28 rounded-xl border p-2 text-right" /></td>
                    <td className="p-4 text-right">
                      <button onClick={() => updateStock(row, document.getElementById(`warehouse-stock-${row.product._id}`).value)} disabled={stockSavingId === row.product._id} className="rounded-xl bg-brand-red px-4 py-2 font-semibold text-white disabled:opacity-70">
                        {stockSavingId === row.product._id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
            {!loadingStock && stockRows.length === 0 && <div className="p-8 text-center text-slate-500">No products found.</div>}
          </div>
          {totalPages > 1 && <div className="flex flex-wrap items-center justify-center gap-3 border-t p-5">
            <button onClick={() => loadStock(page - 1)} disabled={page === 1 || loadingStock} className="flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16}/>Previous</button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = page <= 3 ? i + 1 : page - 2 + i;
                return pageNum > 0 && pageNum <= totalPages ? (
                  <button key={pageNum} onClick={() => loadStock(pageNum)} disabled={loadingStock} className={`rounded-lg px-3 py-2 font-medium disabled:opacity-60 ${page === pageNum ? 'bg-brand-dark text-white' : 'border hover:bg-slate-100'}`}>{pageNum}</button>
                ) : null;
              })}
              {totalPages > 5 && <span className="text-slate-500">...</span>}
            </div>
            <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
            <button onClick={() => loadStock(page + 1)} disabled={page === totalPages || loadingStock} className="flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={16}/></button>
          </div>}
        </>}
      </section>
    </div>

    {showWarehouseForm && <Modal title="Add Warehouse" onClose={() => setShowWarehouseForm(false)}>
      <form onSubmit={saveWarehouse} className="grid gap-4">
        <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Warehouse name" className="rounded-xl border p-3" />
        <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Location" className="rounded-xl border p-3" />
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes" className="rounded-xl border p-3" />
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red py-3 font-bold text-white disabled:opacity-70">
          {saving && <ButtonSpinner />}
          {saving ? 'Saving...' : 'Save Warehouse'}
        </button>
      </form>
    </Modal>}
  </Layout>;
}
