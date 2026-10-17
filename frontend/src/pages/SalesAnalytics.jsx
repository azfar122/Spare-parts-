import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import ShopReceipt from '../components/ShopReceipt.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

export default function SalesAnalytics() {
  const [showProfitDetails, setShowProfitDetails] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [openingReceipt, setOpeningReceipt] = useState(false);
  const [profitSummary, setProfitSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productCode, setProductCode] = useState('');
  const [productName, setProductName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [receiptNo, setReceiptNo] = useState('');
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
      customerName,
      receiptNo,
      ...overrides
    };
  }

  function hasSearchFilters(filters) {
    return Boolean(filters.startDate || filters.endDate || filters.productCode?.trim() || filters.productName?.trim() || filters.customerName?.trim() || filters.receiptNo?.trim());
  }

  function localDateBoundary(dateValue, endOfDay = false) {
    if (!dateValue) return '';
    const [year, month, day] = dateValue.split('-').map(Number);
    if (!year || !month || !day) return '';
    const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    return date.toISOString();
  }

  async function load(pageNum = 1, overrides = {}) {
    try {
      setLoading(true);
      setSearchPrompt('');
      const filters = buildFilters(overrides);
      const trimmedProductCode = filters.productCode.trim();
      const trimmedProductName = filters.productName.trim();
      const trimmedCustomerName = filters.customerName.trim();
      const trimmedReceiptNo = filters.receiptNo.trim();

      const params = { page: pageNum, limit };
      if (filters.startDate) params.startDate = localDateBoundary(filters.startDate);
      if (filters.endDate || filters.startDate) params.endDate = localDateBoundary(filters.endDate || filters.startDate, true);
      if (trimmedProductCode) params.productCode = trimmedProductCode;
      if (trimmedProductName) params.productName = trimmedProductName;
      if (trimmedCustomerName) params.customerName = trimmedCustomerName;
      if (trimmedReceiptNo) params.receiptNo = trimmedReceiptNo;

      const r = await api.get('/sales', { params });
      setSales(r.data.items);
      setProfitSummary(r.data.profitSummary || null);
      setTotal(r.data.total || 0);
      setPage(pageNum);
      setProductSearchActive(Boolean(trimmedProductCode || trimmedProductName));
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
    setCustomerName('');
    setReceiptNo('');
    load(1, { startDate: '', endDate: '', productCode: '', productName: '', customerName: '', receiptNo: '' });
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

  return <Layout wide title="Sales Analytics" subtitle="View and search all sales transactions by date and product.">
    <div className="rounded-3xl bg-white p-4 shadow-soft border mb-6 sm:p-6">
      <h3 className="font-bold text-lg mb-4">Filters</h3>
      <form onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
            <label className="text-sm font-medium text-slate-600">Bill No</label>
            <input type="text" value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="Search by bill no" className="mt-1 w-full rounded-xl border p-3" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Customer Name</label>
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Search by customer" className="mt-1 w-full rounded-xl border p-3" />
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
                  <span className="text-xs text-slate-500">{[product.partNo || product.partCode, product.brand].filter(Boolean).join(' · ') || 'No part details'}</span>
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
        <p className="mt-3 text-sm text-slate-500">Bill Subtotal is before discount. Bill Total is after discount. Gross profit uses FIFO purchase costs and accounts for returns. Existing stock uses saved booking costs; older bills without recorded costs show “Not recorded”. Profit columns cover the whole bill.</p>
      </form>
    </div>

    {profitSummary && <div className="mb-5 grid gap-4 md:grid-cols-2" aria-busy={loading}>
      <div className="rounded-2xl border bg-white p-5 shadow-soft">
        <p className="text-sm text-slate-500">Revenue</p>
        <p className="mt-2 text-3xl font-bold">Rs {Number(profitSummary.revenue).toLocaleString()}</p>
        <p className="mt-2 text-sm text-slate-500">All matching sales after discounts and returns, across every page.</p>
      </div>
      <div className="rounded-2xl border bg-white p-5 shadow-soft">
        <p className="text-sm text-slate-500">Gross Profit</p>
        <p className="mt-2 text-3xl font-bold">Rs {Number(profitSummary.profit).toLocaleString()}</p>
        <p className="mt-1 text-sm text-slate-500">Cost of sold stock: Rs {Number(profitSummary.cost).toLocaleString()}</p>
        {profitSummary.missingCostItems > 0 && <p className="mt-2 text-sm text-amber-700">Excludes {profitSummary.missingCostItems} older sale item(s) without recorded costs. Revenue includes these sales.</p>}
        <button type="button" disabled={loading} onClick={() => { setDetailError(''); setShowProfitDetails(true); }} className="mt-4 rounded-xl border px-4 py-2 font-semibold hover:bg-slate-50 disabled:opacity-50">View sales behind this profit</button>
      </div>
    </div>}
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

    <div className="max-w-full overflow-hidden rounded-3xl bg-white shadow-soft border">
      {loading ? <LoadingState label="Loading sales..." /> : <div className="max-w-full overflow-x-auto"><table className="w-full text-xs xl:text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-3 text-left">Receipt #</th>
            <th className="px-2 py-3 text-left">Date</th>
            <th className="px-2 py-3 text-left">Customer</th>
            <th className="px-2 py-3 text-left">Sold By</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Items</th>
            {productSearchActive && <th className="px-2 py-3 text-left">Product Name</th>}
            {productSearchActive && <th className="px-2 py-3 text-right whitespace-nowrap">Net Qty</th>}
            {productSearchActive && <th className="px-2 py-3 text-right whitespace-nowrap">Net Amount</th>}
            <th className="px-2 py-3 text-left">Return Status</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Bill Subtotal</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Discount</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Returned</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Bill Total</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Net Total</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Cost of sold stock</th>
            <th className="px-2 py-3 text-right whitespace-nowrap">Gross profit</th>
            <th className="px-2 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale._id} className="border-t hover:bg-slate-50/70">
              <td className="px-2 py-3 font-semibold text-brand-red whitespace-nowrap">{sale.receiptNo}</td>
              <td className="px-2 py-3">{new Date(sale.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-2 py-3">{sale.customerName}</td>
              <td className="px-2 py-3 font-semibold">{sale.soldBy?.name || sale.soldBy?.username || '-'}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap">{sale.items.length}</td>
              {productSearchActive && <td className="px-2 py-3 font-semibold">{matchedProductNames(sale)}</td>}
              {productSearchActive && <td className="px-2 py-3 text-right whitespace-nowrap font-semibold">{Number(sale.matchedQty || 0).toLocaleString()}</td>}
              {productSearchActive && <td className="px-2 py-3 text-right whitespace-nowrap font-semibold">Rs {Number(sale.matchedAmount || 0).toLocaleString()}</td>}
              <td className="px-2 py-3">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${returnStatusClass(sale.returnStatus)}`}>
                  {returnStatusLabel(sale.returnStatus)}
                </span>
              </td>
              <td className="px-2 py-3 text-right whitespace-nowrap">Rs {Number(sale.subtotal).toLocaleString()}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap">Rs {Number(sale.discountTotal).toLocaleString()}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap text-red-600">Rs {Number(sale.returnedAmount || 0).toLocaleString()}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap font-bold">Rs {Number(sale.grandTotal).toLocaleString()}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap font-bold text-brand-red">Rs {Number(sale.netTotal ?? sale.grandTotal ?? 0).toLocaleString()}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap">{sale.netCost == null ? 'Not recorded' : `Rs ${Number(sale.netCost).toLocaleString()}`}</td>
              <td className="px-2 py-3 text-right whitespace-nowrap font-semibold">{sale.netProfit == null ? 'Not recorded' : `Rs ${Number(sale.netProfit).toLocaleString()}`}</td>
              <td className="px-2 py-3 text-center"><button onClick={() => setSelectedSale(sale)} className="rounded-lg px-3 py-1 border hover:bg-slate-100">View</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>}
      {!loading && sales.length === 0 && !searchPrompt && <div className="text-center py-8 text-slate-500">No sales found</div>}
    </div>

    {totalPages > 1 && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
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

    {showProfitDetails && profitSummary && <Modal title="Sales behind this profit" onClose={() => setShowProfitDetails(false)}>
      <p className="mb-4 text-sm text-slate-500">All sales matching the applied filters. Amounts are after discounts and returns. Open a receipt to see purchase-cost batches.</p>
      {detailError && <p role="alert" className="mb-3 text-red-700">{detailError}</p>}
      <div className="max-h-[60vh] overflow-auto"><table className="w-full whitespace-nowrap text-sm"><thead><tr>{['Receipt', 'Product', 'Net qty', 'Revenue', 'Cost', 'Profit'].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>
        {(profitSummary.rows || []).map((row, index) => <tr key={`${row.receiptNo}-${index}`} className="border-t">
          <td className="p-2"><button type="button" disabled={openingReceipt} className="text-brand-red underline disabled:opacity-50" onClick={async () => {
            setOpeningReceipt(true); setDetailError('');
            try { const r = await api.get(`/sales/by-receipt/${encodeURIComponent(row.receiptNo)}`); setShowProfitDetails(false); setSelectedSale(r.data); }
            catch { setDetailError('Could not open the receipt. Please try again.'); }
            finally { setOpeningReceipt(false); }
          }}>{row.receiptNo}</button></td>
          <td className="p-2">{row.partName}<span className="block text-xs text-slate-500">{row.partCode}</span></td>
          <td className="p-2">{row.qty}</td><td className="p-2">Rs {Number(row.revenue).toLocaleString()}</td>
          <td className="p-2">{row.cost == null ? 'Not recorded' : `Rs ${Number(row.cost).toLocaleString()}`}</td>
          <td className="p-2">{row.profit == null ? 'Excluded' : `Rs ${Number(row.profit).toLocaleString()}`}</td>
        </tr>)}
        {!profitSummary.rows?.length && <tr><td colSpan="6" className="p-4 text-center">No matching sales.</td></tr>}
      </tbody></table></div>
      <p className="mt-4 font-semibold">Gross profit: Rs {Number(profitSummary.profit).toLocaleString()}</p>
    </Modal>}

    {selectedSale && <Modal title={`Receipt ${selectedSale.receiptNo}`} onClose={() => setSelectedSale(null)}>
      <div className="receipt-screen-content space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><p className="text-slate-500">Date</p><p className="font-semibold">{new Date(selectedSale.createdAt).toLocaleString('en-IN')}</p></div>
          <div><p className="text-slate-500">Customer</p><p className="font-semibold">{selectedSale.customerName}</p></div>
          <div><p className="text-slate-500">Sold By</p><p className="font-semibold">{selectedSale.soldBy?.name || selectedSale.soldBy?.username || '-'}</p></div>
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
                <div className="flex flex-col gap-1 min-[380px]:flex-row min-[380px]:justify-between"><span className="font-semibold">{item.partName}</span><span>Net {Number(item.netQty ?? item.qty).toLocaleString()}x</span></div>
                <div className="text-xs text-slate-500">{item.partCode}</div>
                <div className="mt-2 grid gap-2 rounded-lg bg-white p-2 text-xs text-slate-600 sm:grid-cols-3">
                  <span>Sold: <b>{Number(item.qty || 0).toLocaleString()}</b></span>
                  <span>Returned: <b>{Number(item.returnedQty || 0).toLocaleString()}</b></span>
                  <span>Refunded: <b>Rs {Number(item.refunded || 0).toLocaleString()}</b></span>
                </div>
                <div className="mt-2 grid gap-2 rounded-lg bg-white p-2 text-xs text-slate-600 sm:grid-cols-3">
                  <span>Main used: <b>{Number(item.inventoryQtyUsed ?? item.qty)}</b></span>
                  <span>Warehouse used: <b>{Number(item.warehouseQtyUsed || 0)}</b></span>
                  <span>Warehouse: <b>{item.warehouseName || '-'}</b></span>
                </div>
                {item.costTotal != null && <div className="mt-2 text-xs text-slate-600"><p>Net cost: Rs {Number(item.netCost).toLocaleString()} · Gross profit: Rs {Number(item.netProfit).toLocaleString()}</p>{item.costAllocations?.map((allocation, index) => <p key={index}>{allocation.qty} unit(s) purchased at Rs {Number(allocation.unitCost).toLocaleString()}</p>)}</div>}
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
          <div className="flex justify-between"><span>Gross profit</span><span>{selectedSale.netProfit == null ? 'Not recorded' : `Rs ${Number(selectedSale.netProfit).toLocaleString()}`}</span></div>
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
