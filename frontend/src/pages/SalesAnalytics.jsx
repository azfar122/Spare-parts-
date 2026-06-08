import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import ShopReceipt from '../components/ShopReceipt.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

export default function SalesAnalytics() {
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const limit = 50;

  async function load(pageNum = 1) {
    try {
      setLoading(true);
      const params = { page: pageNum, limit };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (productCode) params.productCode = productCode;
      if (productName) params.productName = productName;

      const r = await api.get('/sales', { params });
      setSales(r.data.items);
      setTotal(r.data.total || 0);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  function handleSearch(e) {
    e.preventDefault();
    load(1);
  }

  const totalPages = Math.ceil(total / limit);

  return <Layout title="Sales Analytics" subtitle="View and search all sales transactions by date and product.">
    <div className="rounded-3xl bg-white p-6 shadow-soft border mb-6">
      <h3 className="font-bold text-lg mb-4">Filters</h3>
      <form onSubmit={handleSearch} className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="text-sm font-medium text-slate-600">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Part Code</label>
          <input type="text" value={productCode} onChange={e => setProductCode(e.target.value)} placeholder="Search by part code" className="mt-1 w-full rounded-xl border p-3" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-600">Part Name</label>
          <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Search by part name" className="mt-1 w-full rounded-xl border p-3" />
        </div>
      </form>
      <button onClick={handleSearch} disabled={loading} className="w-full md:w-auto rounded-xl bg-brand-dark text-white px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-70 inline-flex items-center justify-center gap-2">
        {loading && <ButtonSpinner />}
        {loading ? 'Searching...' : 'Search'}
      </button>
      <button onClick={() => { setStartDate(''); setEndDate(''); setProductCode(''); setProductName(''); load(1); }} className="w-full md:w-auto ml-2 rounded-xl border px-6 py-3 font-medium">Clear Filters</button>
    </div>

    <div className="rounded-3xl bg-white shadow-soft border overflow-hidden">
      {loading ? <LoadingState label="Loading sales..." /> : <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="p-4 text-left">Receipt #</th>
            <th className="p-4 text-left">Date</th>
            <th className="p-4 text-left">Customer</th>
            <th className="p-4 text-right">Items</th>
            <th className="p-4 text-right">Subtotal</th>
            <th className="p-4 text-right">Discount</th>
            <th className="p-4 text-right">Total</th>
            <th className="p-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale._id} className="border-t hover:bg-slate-50/70">
              <td className="p-4 font-semibold text-brand-red">{sale.receiptNo}</td>
              <td className="p-4">{new Date(sale.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="p-4">{sale.customerName}</td>
              <td className="p-4 text-right">{sale.items.length}</td>
              <td className="p-4 text-right">Rs {Number(sale.subtotal).toLocaleString()}</td>
              <td className="p-4 text-right">Rs {Number(sale.discountTotal).toLocaleString()}</td>
              <td className="p-4 text-right font-bold">Rs {Number(sale.grandTotal).toLocaleString()}</td>
              <td className="p-4 text-center"><button onClick={() => setSelectedSale(sale)} className="rounded-lg px-3 py-1 border hover:bg-slate-100">View</button></td>
            </tr>
          ))}
        </tbody>
      </table>}
      {!loading && sales.length === 0 && <div className="text-center py-8 text-slate-500">No sales found</div>}
    </div>

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

    {selectedSale && <Modal title={`Receipt ${selectedSale.receiptNo}`} onClose={() => setSelectedSale(null)}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-slate-500">Date</p><p className="font-semibold">{new Date(selectedSale.createdAt).toLocaleString('en-IN')}</p></div>
          <div><p className="text-slate-500">Customer</p><p className="font-semibold">{selectedSale.customerName}</p></div>
        </div>
        <div className="border-t pt-4">
          <p className="font-semibold mb-2">Items Sold</p>
          <div className="space-y-2">
            {selectedSale.items.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-lg">
                <div className="flex justify-between"><span className="font-semibold">{item.partName}</span><span>{item.qty}x</span></div>
                <div className="text-xs text-slate-500">{item.partCode} · {item.model}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-xs text-slate-600">
                  <span>Main used: <b>{Number(item.inventoryQtyUsed ?? item.qty)}</b></span>
                  <span>Warehouse used: <b>{Number(item.warehouseQtyUsed || 0)}</b></span>
                  <span>Warehouse: <b>{item.warehouseName || '-'}</b></span>
                </div>
                <div className="flex justify-between text-xs mt-2"><span>Rs {Number(item.price).toLocaleString()}</span><span className="font-semibold">Rs {Number(item.lineTotal).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-4 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>Rs {Number(selectedSale.subtotal).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-Rs {Number(selectedSale.discountTotal).toLocaleString()}</span></div>
          <div className="flex justify-between text-lg font-bold text-brand-red"><span>Total</span><span>Rs {Number(selectedSale.grandTotal).toLocaleString()}</span></div>
        </div>
        <button type="button" onClick={() => window.print()} className="no-print w-full rounded-xl bg-brand-dark text-white py-3 font-semibold inline-flex items-center justify-center gap-2">
          <Printer size={18} />
          Print Receipt
        </button>
      </div>
      <div className="receipt-print-only" aria-hidden="true">
        <ShopReceipt receipt={selectedSale} />
      </div>
    </Modal>}
  </Layout>;
}
