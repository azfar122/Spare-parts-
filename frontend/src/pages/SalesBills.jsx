import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import ShopReceipt from '../components/ShopReceipt.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

export default function SalesBills() {
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [receiptNo, setReceiptNo] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 50;

  async function load(pageNum = 1, search = receiptNo) {
    try {
      setLoading(true);
      setError('');
      const trimmedReceiptNo = search.trim();
      const r = await api.get('/sales', {
        params: {
          page: pageNum,
          limit,
          ...(trimmedReceiptNo ? { receiptNo: trimmedReceiptNo } : {})
        }
      });
      setSales(r.data.items || []);
      setTotal(r.data.total || 0);
      setPage(pageNum);
    } catch (err) {
      setSales([]);
      setTotal(0);
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1, ''); }, []);

  async function handleSearch(e) {
    e.preventDefault();
    await load(1);
  }

  function clearSearch() {
    setReceiptNo('');
    load(1, '');
  }

  function returnStatusLabel(status) {
    if (status === 'returned') return 'Returned';
    if (status === 'partial') return 'Partially Returned';
    return 'No Return';
  }

  function returnStatusClass(status) {
    if (status === 'returned') return 'border-red-200 bg-red-50 text-red-700';
    if (status === 'partial') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }

  const totalPages = Math.ceil(total / limit);

  return <Layout title="Sales" subtitle="View previous bills and print receipts again.">
    <div className="mb-5 rounded-2xl border bg-white p-4 shadow-soft sm:p-5">
      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={receiptNo}
            onChange={e => setReceiptNo(e.target.value)}
            placeholder="Search by bill number"
            className="w-full rounded-xl border py-3 pl-10 pr-10"
          />
          {receiptNo && <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18}/></button>}
        </div>
        <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 rounded-xl bg-brand-dark px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">
          {loading && <ButtonSpinner />}
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>
    </div>

    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    <div className="overflow-hidden rounded-3xl border bg-white shadow-soft">
      {loading ? <LoadingState label="Loading sales..." /> : <table className="w-full table-fixed text-xs sm:text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="w-[15%] px-3 py-4 text-left">Bill</th>
            <th className="w-[20%] px-3 py-4 text-left">Date</th>
            <th className="w-[24%] px-3 py-4 text-left">Customer</th>
            <th className="w-[9%] px-3 py-4 text-right">Items</th>
            <th className="w-[15%] px-3 py-4 text-right">Total</th>
            <th className="w-[11%] px-3 py-4 text-left">Return</th>
            <th className="w-[6%] px-3 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale._id} className="border-t hover:bg-slate-50/70">
              <td className="break-words px-3 py-4 font-bold text-brand-red">{sale.receiptNo}</td>
              <td className="px-3 py-4">{new Date(sale.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              <td className="break-words px-3 py-4">{sale.customerName}</td>
              <td className="px-3 py-4 text-right">{sale.items?.length || 0}</td>
              <td className="px-3 py-4 text-right font-semibold">Rs {Number(sale.netTotal ?? sale.grandTotal ?? 0).toLocaleString()}</td>
              <td className="px-3 py-4">
                <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${returnStatusClass(sale.returnStatus)}`}>
                  {returnStatusLabel(sale.returnStatus)}
                </span>
              </td>
              <td className="px-3 py-4 text-right">
                <button type="button" onClick={() => setSelectedSale(sale)} className="rounded-lg border px-3 py-1 font-semibold hover:bg-slate-100">View</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>}
      {!loading && sales.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No sales found.</div>}
    </div>

    {totalPages > 1 && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
      <button onClick={() => load(page - 1)} disabled={page === 1} className="flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16}/>Previous</button>
      <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
      <button onClick={() => load(page + 1)} disabled={page === totalPages} className="flex items-center gap-1 rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight size={16}/></button>
    </div>}

    {selectedSale && <Modal title="Receipt" onClose={() => setSelectedSale(null)} fillViewport>
      <div className="receipt-screen-content">
        <ShopReceipt receipt={selectedSale} />
        <button onClick={() => window.print()} className="no-print mt-4 w-full rounded-xl bg-brand-dark py-3 text-white">Print Receipt</button>
      </div>
      <div className="receipt-print-only" aria-hidden="true">
        <ShopReceipt receipt={selectedSale} />
      </div>
    </Modal>}
  </Layout>;
}
