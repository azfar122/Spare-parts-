import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import ProductTable from '../components/ProductTable.jsx';
import Modal from '../components/Modal.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

export default function SalesDashboard() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMode, setCustomerMode] = useState('walk-in');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paidAmount, setPaidAmount] = useState('');
  const [returnForm, setReturnForm] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [returnSelectedProduct, setReturnSelectedProduct] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [hasExactMatch, setHasExactMatch] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);

  async function load(pageNum = 1) {
    try {
      setLoadingProducts(true);
      const r = await api.get('/products', { params: { q, limit, page: pageNum } });
      setProducts(r.data.items);
      setTotal(r.data.total || 0);
      setPage(pageNum);
      
      if (q) {
        const hasExact = r.data.items?.some(p => 
          p.partName?.toUpperCase() === q.toUpperCase() || 
          p.partCode?.toUpperCase() === q.toUpperCase()
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

  async function loadCustomers(search = customerSearch) {
    const r = await api.get('/customers', { params: { q: search, limit: 20 } });
    setCustomers(r.data.items || []);
  }

  useEffect(() => { load(1); }, [q]);
  useEffect(() => { loadCustomers(''); }, []);
  useEffect(() => {
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001');
    s.on('inventory:update', () => load(page));
    s.on('inventory:bulk-update', () => load(page));
    return () => s.disconnect();
  }, [page]);

  function addSale(p) { setCart(c => c.some(i=>i.productId===p._id) ? c : [...c, { productId: p._id, partName: p.partName, partCode: p.partCode, qty: 1, price: p.mrp, discount: 0, stock: p.quantity }]); }
  function update(i, key, val) { setCart(c => c.map((x, idx) => idx === i ? { ...x, [key]: Number(val) || 0 } : x)); }
  const totals = useMemo(() => cart.reduce((a, i) => { a.sub += i.qty * i.price; a.dis += i.discount; return a; }, { sub: 0, dis: 0 }), [cart]);

  async function checkout() {
    try {
      if (customerMode === 'existing' && !selectedCustomer) return alert('Select a customer for this bill');
      if (customerMode === 'walk-in' && paymentStatus !== 'paid') return alert('Unpaid or partial bills must be linked to an existing customer');
      setCheckoutLoading(true);
      const r = await api.post('/sales', {
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerId: customerMode === 'existing' ? selectedCustomer?._id : undefined,
        paymentStatus,
        paidAmount: paymentStatus === 'partial' ? Number(paidAmount || 0) : undefined,
        items: cart
      });
      setReceipt(r.data);
      setCart([]);
      setCustomerMode('walk-in');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setPaymentStatus('paid');
      setPaidAmount('');
      await load(page);
    } finally {
      setCheckoutLoading(false);
    }
  }
  
  async function doReturn(e) {
    e.preventDefault();
    if (!returnSelectedProduct && !returnSearch) return alert('Please select or enter a product');
    const body = {
      partCode: returnSelectedProduct?.partCode || '',
      partName: returnSelectedProduct?.partName || returnSearch,
      qty: Number(e.target.qty?.value || 0),
      amountRefunded: Number(e.target.amountRefunded?.value || 0),
      reason: e.target.reason?.value || ''
    };
    if (body.qty <= 0) return alert('Enter quantity');
    try {
      setReturnSaving(true);
      await api.post('/returns', body);
      setReturnForm(false);
      setReturnSearch('');
      setReturnSelectedProduct(null);
      await load(page);
      alert('Return saved and stock updated');
    } catch (err) {
      alert('Error: ' + err.response?.data?.message || err.message);
    } finally {
      setReturnSaving(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const billTotal = totals.sub - totals.dis;
  const duePreview = paymentStatus === 'paid' ? 0 : paymentStatus === 'partial' ? Math.max(0, billTotal - Number(paidAmount || 0)) : billTotal;

  return <Layout title="Sales Counter" subtitle="Search products, sell items, apply discounts, print receipts and process returns.">
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      <div>
        <div className="mb-5 flex gap-3">
          <div className="flex-1 relative">
            <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load(1)} placeholder="Search product by part name or code" className="w-full rounded-2xl border p-4" />
            {q && <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={20}/></button>}
          </div>
          <button onClick={()=>load(1)} className="rounded-2xl bg-brand-dark text-white px-6">Search</button>
          <button onClick={()=>setReturnForm(true)} className="rounded-2xl border px-6">Return</button>
        </div>
        {!loadingProducts && q && !hasExactMatch && products.length > 0 && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">No exact match for "{q}", showing relevant results:</div>}
        {!loadingProducts && q && products.length === 0 && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">No products found matching "{q}". Try a different search term.</div>}
        {loadingProducts ? <LoadingState label="Loading products..." /> : <ProductTable products={products} salesMode onAddSale={addSale} onDetail={()=>{}} />}
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
      </div>
      <aside className="rounded-3xl bg-white p-5 shadow-soft border h-fit sticky top-5">
        <h3 className="text-xl font-bold mb-4">Current Bill</h3>
        {cart.length===0 ? <p className="text-slate-500">No items added.</p> : <div className="space-y-3">
          {cart.map((i,idx)=><div key={i.productId} className="rounded-2xl bg-slate-50 p-3">
            <div className="font-semibold">{i.partName}</div>
            <div className="text-xs text-slate-500">{i.partCode} · Stock {i.stock}</div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div><label className="text-xs text-slate-600">Qty</label><input min="1" max={i.stock} value={i.qty} onChange={e=>update(idx,'qty',e.target.value)} className="mt-1 w-full rounded-xl border p-2" /></div>
              <div><label className="text-xs text-slate-600">Price</label><input value={i.price} onChange={e=>update(idx,'price',e.target.value)} className="mt-1 w-full rounded-xl border p-2" /></div>
              <div><label className="text-xs text-slate-600">Discount</label><input value={i.discount} onChange={e=>update(idx,'discount',e.target.value)} className="mt-1 w-full rounded-xl border p-2" /></div>
            </div>
          </div>)}
          <div className="border-t pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><b>Rs {totals.sub.toLocaleString()}</b></div>
            <div className="flex justify-between"><span>Discount</span><b>Rs {totals.dis.toLocaleString()}</b></div>
            <div className="flex justify-between text-lg"><span>Total</span><b>Rs {billTotal.toLocaleString()}</b></div>
          </div>
          <div className="border-t pt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600">Customer</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setCustomerMode('walk-in'); setSelectedCustomer(null); setPaymentStatus('paid'); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${customerMode === 'walk-in' ? 'bg-brand-dark text-white' : 'hover:bg-slate-50'}`}>Walk-in</button>
                <button type="button" onClick={() => { setCustomerMode('existing'); loadCustomers(''); }} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${customerMode === 'existing' ? 'bg-brand-dark text-white' : 'hover:bg-slate-50'}`}>Existing</button>
              </div>
            </div>
            {customerMode === 'existing' && <div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); loadCustomers(e.target.value); }} placeholder="Search customer name or phone" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm" />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border bg-white">
                {customers.map(customer => (
                  <button key={customer._id} type="button" onClick={() => setSelectedCustomer(customer)} className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-slate-50 ${selectedCustomer?._id === customer._id ? 'bg-slate-50' : ''}`}>
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold text-sm">{customer.name}</span>
                      <span className="text-xs font-semibold text-brand-red">Rs {Number(customer.currentBalance || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-500">{customer.phone || 'No phone'}</p>
                  </button>
                ))}
                {customers.length === 0 && <p className="p-3 text-sm text-slate-500">No customers found.</p>}
              </div>
              {selectedCustomer && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Selected: <b>{selectedCustomer.name}</b> · Current balance Rs {Number(selectedCustomer.currentBalance || 0).toLocaleString()}</p>}
            </div>}
            <div>
              <label className="text-xs font-semibold text-slate-600">Payment</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {[
                  ['paid', 'Received'],
                  ['unpaid', 'Not Received'],
                  ['partial', 'Partial']
                ].map(([value, label]) => (
                  <button key={value} type="button" disabled={customerMode === 'walk-in' && value !== 'paid'} onClick={() => setPaymentStatus(value)} className={`rounded-xl border px-2 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${paymentStatus === value ? 'bg-brand-red text-white' : 'hover:bg-slate-50'}`}>{label}</button>
                ))}
              </div>
            </div>
            {paymentStatus === 'partial' && <input type="number" min="1" max={billTotal - 1} value={paidAmount} onChange={e => setPaidAmount(e.target.value)} placeholder="Paid amount" className="w-full rounded-xl border p-2 text-sm" />}
            {customerMode === 'existing' && paymentStatus !== 'paid' && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Due added to khata: <b>Rs {duePreview.toLocaleString()}</b>
            </div>}
          </div>
          <button onClick={checkout} disabled={checkoutLoading} className="w-full rounded-xl bg-brand-red text-white py-3 font-bold disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
            {checkoutLoading && <ButtonSpinner />}
            {checkoutLoading ? 'Creating receipt...' : 'Create Receipt'}
          </button>
        </div>}
      </aside>
    </div>
    
    {receipt && <Modal title="Receipt" onClose={()=>setReceipt(null)}>
      <div id="receipt-print" className="p-3">
        <h2 className="text-2xl font-black">PartsPro Receipt</h2>
        <p>Receipt: {receipt.receiptNo}</p>
        <p>Date: {new Date(receipt.createdAt).toLocaleString()}</p>
        <p>Customer: {receipt.customerName}</p>
        <p>Payment: {receipt.paymentStatus} · Paid Rs {Number(receipt.paidAmount || 0).toLocaleString()} · Due Rs {Number(receipt.dueAmount || 0).toLocaleString()}</p>
        <table className="w-full mt-4 text-sm">
          <tbody>
            {receipt.items.map((i,idx)=><tr key={idx} className="border-t"><td className="py-2">{i.partName}<br/><span className="text-xs">{i.partCode}</span></td><td>{i.qty}</td><td>Rs {i.price}</td><td>Rs {i.lineTotal}</td></tr>)}
          </tbody>
        </table>
        <h3 className="text-right text-xl font-bold mt-4">Total: Rs {receipt.grandTotal}</h3>
      </div>
      <button onClick={()=>window.print()} className="no-print mt-4 w-full rounded-xl bg-brand-dark text-white py-3">Print Receipt</button>
    </Modal>}
    
    {returnForm && <Modal title="Process Return" onClose={()=>{setReturnForm(false); setReturnSearch(''); setReturnSelectedProduct(null);}}>
      <form onSubmit={doReturn} className="grid gap-4">
        <div className="relative">
          <label className="text-sm font-medium">Search Product</label>
          <div className="relative mt-1">
            <input value={returnSearch} onChange={e=>setReturnSearch(e.target.value)} placeholder="Type part code or name..." className="w-full rounded-xl border p-3" />
            {returnSearch && <button type="button" onClick={() => setReturnSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18}/></button>}
          </div>
          {returnSearch && (
            <div className="absolute top-14 left-0 right-0 bg-white border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
              <div className="p-2">
                {products.filter(p=>p.partCode.includes(returnSearch.toUpperCase()) || p.partName.toLowerCase().includes(returnSearch.toLowerCase())).slice(0, 5).map(p=>(
                  <div key={p._id} onClick={()=>{setReturnSelectedProduct(p); setReturnSearch('');}} className="p-2 hover:bg-slate-100 cursor-pointer text-sm border-b">
                    <span className="font-medium">{p.partName}</span> <span className="text-xs text-slate-500">({p.partCode})</span>
                  </div>
                ))}
                {products.filter(p=>p.partCode.includes(returnSearch.toUpperCase()) || p.partName.toLowerCase().includes(returnSearch.toLowerCase())).length === 0 && (
                  <div className="p-2 text-sm text-slate-500">No products found</div>
                )}
              </div>
            </div>
          )}
        </div>
        {returnSelectedProduct && (
          <div className="p-3 bg-slate-100 rounded-lg">
            <p className="font-semibold">{returnSelectedProduct.partName}</p>
            <p className="text-sm text-slate-600">{returnSelectedProduct.partCode}</p>
          </div>
        )}
        <input name="qty" placeholder="Return quantity" type="number" min="1" className="rounded-xl border p-3" required />
        <input name="amountRefunded" placeholder="Amount refunded" type="number" className="rounded-xl border p-3" />
        <textarea name="reason" placeholder="Reason" className="rounded-xl border p-3" />
        <button type="submit" disabled={returnSaving} className="rounded-xl bg-brand-red text-white py-3 font-bold disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
          {returnSaving && <ButtonSpinner />}
          {returnSaving ? 'Saving return...' : 'Save Return'}
        </button>
      </form>
    </Modal>}
  </Layout>;
}
