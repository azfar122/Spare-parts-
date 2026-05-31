import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import ProductTable from '../components/ProductTable.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../api/client.js';

export default function SalesDashboard() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [returnForm, setReturnForm] = useState(false);
  const [returnSearch, setReturnSearch] = useState('');
  const [returnSelectedProduct, setReturnSelectedProduct] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [hasExactMatch, setHasExactMatch] = useState(true);

  async function load(pageNum = 1) {
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
  }

  useEffect(() => { load(1); }, [q]);
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
    const r = await api.post('/sales', { customerName: 'Walk-in Customer', items: cart });
    setReceipt(r.data); setCart([]); await load(page);
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
      await api.post('/returns', body);
      setReturnForm(false);
      setReturnSearch('');
      setReturnSelectedProduct(null);
      await load(page);
      alert('Return saved and stock updated');
    } catch (err) {
      alert('Error: ' + err.response?.data?.message || err.message);
    }
  }

  const totalPages = Math.ceil(total / limit);

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
        {q && !hasExactMatch && products.length > 0 && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">No exact match for "{q}", showing relevant results:</div>}
        {q && products.length === 0 && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">No products found matching "{q}". Try a different search term.</div>}
        <ProductTable products={products} salesMode onAddSale={addSale} onDetail={()=>{}} />
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
            <div className="flex justify-between text-lg"><span>Total</span><b>Rs {(totals.sub-totals.dis).toLocaleString()}</b></div>
          </div>
          <button onClick={checkout} className="w-full rounded-xl bg-brand-red text-white py-3 font-bold">Create Receipt</button>
        </div>}
      </aside>
    </div>
    
    {receipt && <Modal title="Receipt" onClose={()=>setReceipt(null)}>
      <div id="receipt-print" className="p-3">
        <h2 className="text-2xl font-black">PartsPro Receipt</h2>
        <p>Receipt: {receipt.receiptNo}</p>
        <p>Date: {new Date(receipt.createdAt).toLocaleString()}</p>
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
        <button type="submit" className="rounded-xl bg-brand-red text-white py-3 font-bold">Save Return</button>
      </form>
    </Modal>}
  </Layout>;
}
