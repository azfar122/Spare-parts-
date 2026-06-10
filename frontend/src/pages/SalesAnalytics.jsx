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
  const [productSearchActive, setProductSearchActive] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchPrompt, setSearchPrompt] = useState('');
  const [matchedSummary, setMatchedSummary] = useState(null);
  const limit = 50;

  function buildFilters(overrides = {}) {
    return {
      startDate,
      endDate,
      productCode,
      productName,
      ...overrides
    };
  }

  function hasSearchFilters(filters) {
    return Boolean(filters.startDate || filters.endDate || filters.productCode?.trim() || filters.productName?.trim());
  }

  async function load(pageNum = 1, overrides = {}) {
    try {
      setLoading(true);
      setSearchPrompt('');
      const filters = buildFilters(overrides);

      const params = { page: pageNum, limit };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.productCode) params.productCode = filters.productCode;
      if (filters.productName) params.productName = filters.productName;

      const r = await api.get('/sales', { params });
      setSales(r.data.items);
      setTotal(r.data.total || 0);
      setPage(pageNum);
      setProductSearchActive(Boolean(filters.productCode?.trim() || filters.productName?.trim()));
      setMatchedSummary(r.data.matchedSummary || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, []);

  useEffect(() => {
    const search = productName.trim();
    if (search.length < 2) {
      setProductSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const r = await api.get('/products', { params: { q: search, limit: 8 } });
        setProductSuggestions(r.data.items || []);
      } catch (err) {
        setProductSuggestions([]);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [productName]);

  async function handleSearch(e) {
    e.preventDefault();
    const emptySearch = !hasSearchFilters(buildFilters());
    await load(1);
    if (emptySearch) {
      setSearchPrompt('Enter at least one filter to search sales.');
    }
  }

  function clearFilters() {
    setProductSuggestions([]);
    setStartDate('');
    setEndDate('');
    setProductCode('');
    setProductName('');
    load(1, { startDate: '', endDate: '', productCode: '', productName: '' });
  }

  function matchedProductNames(sale) {
    const names = (sale.matchedItems || []).map(item => item.partName).filter(Boolean);
    return [...new Set(names)].join(', ') || '-';
  }

  function summaryProductNames() {
    return matchedSummary?.productNames?.length ? matchedSummary.productNames.join(', ') : productName || productCode || '-';
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

  return <Layout title="Sales Analytics" subtitle="View and search all sales transactions by date and product.">
    <div className="rounded-3xl bg-white p-6 shadow-soft border mb-6">
      <h3 className="font-bold text-lg mb-4">Filters</h3>
      <form onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <div className="relative">
            <label className="text-sm font-medium text-slate-600">Product Name</label>
            <input type="text" value={productName} onFocus={() => setShowSuggestions(true)} onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)} onChange={e => { setProductName(e.target.value); setShowSuggestions(true); }} placeholder="Search by product name" className="mt-1 w-full rounded-xl border p-3" />
            {showSuggestions && productSuggestions.length > 0 && <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border bg-white shadow-soft">
              {productSuggestions.map(product => (
                <button
                  key={product._id}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setProductName(product.productName || product.partName || '');
                    setProductCode(product.partNo || product.partCode || '');
                    setShowSuggestions(false);
                  }}
                  className="w-full border-b p-3 text-left last:border-b-0 hover:bg-slate-50"
                >
                  <span className="block font-semibold">{product.productName || product.partName}</span>
                  <span className="text-xs text-slate-500">{[product.partNo || product.partCode, product.brand, product.category].filter(Boolean).join(' · ') || 'No part details'}</span>
                </button>
              ))}
            </div>}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <button type="submit" disabled={loading} className="w-full md:w-auto rounded-xl bg-brand-dark text-white px-6 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-70 inline-flex items-center justify-center gap-2">
            {loading && <ButtonSpinner />}
            {loading ? 'Searching...' : 'Search'}
          </button>
          <button type="button" onClick={clearFilters} className="w-full md:w-auto rounded-xl border px-6 py-3 font-medium">Clear Filters</button>
        </div>
        <p className="mt-3 text-sm text-slate-500">Bill Subtotal is before discount. Bill Total is after discount.</p>
      </form>
    </div>

    {searchPrompt && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{searchPrompt}</div>}

    {productSearchActive && matchedSummary && <div className="mb-5 grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border bg-white p-5 shadow-soft">
        <p className="text-sm font-medium text-slate-500">Product</p>
        <p className="mt-2 text-lg font-bold text-slate-900">{summaryProductNames()}</p>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-soft">
        <p className="text-sm font-medium text-slate-500">Net Sold Qty</p>
        <p className="mt-2 text-3xl font-bold text-brand-red">{Number(matchedSummary.qty || 0).toLocaleString()}</p>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-soft">
        <p className="text-sm font-medium text-slate-500">Net Product Amount</p>
        <p className="mt-2 text-3xl font-bold text-slate-900">Rs {Number(matchedSummary.amount || 0).toLocaleString()}</p>
        <p className="mt-1 text-xs text-slate-500">Across {Number(matchedSummary.bills || 0).toLocaleString()} bill(s)</p>
      </div>
    </div>}

    <div className="rounded-3xl bg-white shadow-soft border overflow-hidden">
      {loading ? <LoadingState label="Loading sales..." /> : <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="p-4 text-left">Receipt #</th>
            <th className="p-4 text-left">Date</th>
            <th className="p-4 text-left">Customer</th>
            <th className="p-4 text-right">Items</th>
            {productSearchActive && <th className="p-4 text-left">Product Name</th>}
            {productSearchActive && <th className="p-4 text-right">Net Qty</th>}
            {productSearchActive && <th className="p-4 text-right">Net Amount</th>}
            <th className="p-4 text-left">Return Status</th>
            <th className="p-4 text-right">Bill Subtotal</th>
            <th className="p-4 text-right">Discount</th>
            <th className="p-4 text-right">Returned</th>
            <th className="p-4 text-right">Bill Total</th>
            <th className="p-4 text-right">Net Total</th>
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
              {productSearchActive && <td className="p-4 font-semibold">{matchedProductNames(sale)}</td>}
              {productSearchActive && <td className="p-4 text-right font-semibold">{Number(sale.matchedQty || 0).toLocaleString()}</td>}
              {productSearchActive && <td className="p-4 text-right font-semibold">Rs {Number(sale.matchedAmount || 0).toLocaleString()}</td>}
              <td className="p-4">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${returnStatusClass(sale.returnStatus)}`}>
                  {returnStatusLabel(sale.returnStatus)}
                </span>
              </td>
              <td className="p-4 text-right">Rs {Number(sale.subtotal).toLocaleString()}</td>
              <td className="p-4 text-right">Rs {Number(sale.discountTotal).toLocaleString()}</td>
              <td className="p-4 text-right text-red-600">Rs {Number(sale.returnedAmount || 0).toLocaleString()}</td>
              <td className="p-4 text-right font-bold">Rs {Number(sale.grandTotal).toLocaleString()}</td>
              <td className="p-4 text-right font-bold text-brand-red">Rs {Number(sale.netTotal ?? sale.grandTotal ?? 0).toLocaleString()}</td>
              <td className="p-4 text-center"><button onClick={() => setSelectedSale(sale)} className="rounded-lg px-3 py-1 border hover:bg-slate-100">View</button></td>
            </tr>
          ))}
        </tbody>
      </table>}
      {!loading && sales.length === 0 && !searchPrompt && <div className="text-center py-8 text-slate-500">No sales found</div>}
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
          <div>
            <p className="text-slate-500">Return Status</p>
            <p><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${returnStatusClass(selectedSale.returnStatus)}`}>{returnStatusLabel(selectedSale.returnStatus)}</span></p>
          </div>
          <div><p className="text-slate-500">Returned Amount</p><p className="font-semibold text-red-600">Rs {Number(selectedSale.returnedAmount || 0).toLocaleString()}</p></div>
        </div>
        <div className="border-t pt-4">
          <p className="font-semibold mb-2">Items Sold</p>
          <div className="space-y-2">
            {selectedSale.items.map((item, idx) => (
              <div key={idx} className={`p-3 rounded-lg ${selectedSale.matchedItems?.some(matched => String(matched.product) === String(item.product)) ? 'bg-red-50 ring-1 ring-brand-red/20' : 'bg-slate-50'}`}>
                <div className="flex justify-between"><span className="font-semibold">{item.partName}</span><span>Net {Number(item.netQty ?? item.qty).toLocaleString()}x</span></div>
                <div className="text-xs text-slate-500">{item.partCode} · {item.model}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-xs text-slate-600">
                  <span>Sold: <b>{Number(item.qty || 0).toLocaleString()}</b></span>
                  <span>Returned: <b>{Number(item.returnedQty || 0).toLocaleString()}</b></span>
                  <span>Refunded: <b>Rs {Number(item.refunded || 0).toLocaleString()}</b></span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-xs text-slate-600">
                  <span>Main used: <b>{Number(item.inventoryQtyUsed ?? item.qty)}</b></span>
                  <span>Warehouse used: <b>{Number(item.warehouseQtyUsed || 0)}</b></span>
                  <span>Warehouse: <b>{item.warehouseName || '-'}</b></span>
                </div>
                <div className="flex justify-between text-xs mt-2"><span>Rs {Number(item.price).toLocaleString()}</span><span className="font-semibold">Net Rs {Number(item.netLineTotal ?? item.lineTotal ?? 0).toLocaleString()}</span></div>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-4 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>Rs {Number(selectedSale.subtotal).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-Rs {Number(selectedSale.discountTotal).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Returned</span><span className="text-red-600">-Rs {Number(selectedSale.returnedAmount || 0).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Original Total</span><span>Rs {Number(selectedSale.grandTotal).toLocaleString()}</span></div>
          <div className="flex justify-between text-lg font-bold text-brand-red"><span>Net Total</span><span>Rs {Number(selectedSale.netTotal ?? selectedSale.grandTotal ?? 0).toLocaleString()}</span></div>
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
