import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import ProductTable from '../components/ProductTable.jsx';
import Modal from '../components/Modal.jsx';
import ShopReceipt from '../components/ShopReceipt.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { ButtonSpinner, LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';

const cartFieldOrder = ['qty', 'price', 'discount'];

export default function SalesDashboard() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedProductIndex, setSelectedProductIndex] = useState(-1);
  const [selectedCart, setSelectedCart] = useState({ row: -1, field: 'qty' });
  const [receipt, setReceipt] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerMode, setCustomerMode] = useState('walk-in');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [paidAmount, setPaidAmount] = useState('');
  const [returnForm, setReturnForm] = useState(false);
  const [returnBillNo, setReturnBillNo] = useState('');
  const [returnBill, setReturnBill] = useState(null);
  const [returnItems, setReturnItems] = useState({});
  const [returnReason, setReturnReason] = useState('');
  const [returnLookupLoading, setReturnLookupLoading] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;
  const [hasExactMatch, setHasExactMatch] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showBookingPrice, setShowBookingPrice] = useState(false);
  const [saleModalProduct, setSaleModalProduct] = useState(null);
  const [saleDraft, setSaleDraft] = useState({ qty: '1', price: '', discount: '0' });
  const cartFieldRefs = useRef({});
  const productSearchRef = useRef(null);
  const saleQtyRef = useRef(null);

  async function load(pageNum = 1) {
    try {
      setLoadingProducts(true);
      const r = await api.get('/products', { params: { q, limit, page: pageNum, includeWarehouseStock: 'true' } });
      setProducts(r.data.items);
      setSelectedProductIndex(r.data.items?.length ? 0 : -1);
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

  async function loadWarehouses() {
    const r = await api.get('/warehouses');
    setWarehouses(r.data || []);
  }

  useEffect(() => { load(1); }, [q]);
  useEffect(() => { loadCustomers(''); }, []);
  useEffect(() => { loadWarehouses(); }, []);
  useEffect(() => {
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001');
    s.on('inventory:update', () => load(page));
    s.on('inventory:bulk-update', () => {
      load(page);
      loadWarehouses();
    });
    return () => s.disconnect();
  }, [page]);
  useEffect(() => {
    function isTypingTarget(target) {
      return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
    }

    function handleGlobalKeyDown(e) {
      if (loadingProducts || receipt || returnForm || saleModalProduct || isTypingTarget(e.target)) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveProductSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveProductSelection(-1);
      } else if (e.key === 'Enter') {
        const product = products[selectedProductIndex];
        if (product && Number(product.quantity || 0) + Number(product.warehouseQuantity || 0) > 0) {
          e.preventDefault();
          openSaleModal(product);
        }
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [loadingProducts, receipt, returnForm, saleModalProduct, products, selectedProductIndex]);
  useEffect(() => {
    if (!saleModalProduct) return;
    window.requestAnimationFrame(() => saleQtyRef.current?.select());
  }, [saleModalProduct]);
  useEffect(() => {
    setSelectedCart(current => {
      if (!cart.length) return { row: -1, field: 'qty' };
      if (current.row >= cart.length) return { row: cart.length - 1, field: current.field };
      return current;
    });
  }, [cart.length]);

  async function loadWarehouseOptions(productId) {
    if (warehouseOptions[productId]) return;
    const r = await api.get(`/warehouses/product/${productId}/stock`);
    setWarehouseOptions(options => ({ ...options, [productId]: r.data || [] }));
  }

  function openSaleModal(product) {
    if (!product || Number(product.quantity || 0) + Number(product.warehouseQuantity || 0) <= 0) return;
    setSaleModalProduct(product);
    setSaleDraft({
      qty: '1',
      price: String(Number(product.mrp || 0)),
      discount: '0'
    });
  }

  function closeSaleModal() {
    setSaleModalProduct(null);
    setSaleDraft({ qty: '1', price: '', discount: '0' });
  }

  function scrollToProductSearch() {
    window.setTimeout(() => {
      productSearchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function addSale(p, values = {}) {
    const qty = Math.max(1, Number(values.qty ?? 1) || 1);
    const price = Number(values.price ?? p.mrp ?? 0) || 0;
    const discount = Number(values.discount ?? 0) || 0;
    const existingIndex = cart.findIndex(i => i.productId === p._id);
    if (existingIndex >= 0) {
      setSelectedCart({ row: existingIndex, field: 'qty' });
      setCart(c => c.map((item, idx) => idx === existingIndex ? {
        ...item,
        qty: Number(item.qty || 0) + qty,
        price,
        discount: Number(item.discount || 0) + discount,
        warehouseId: Number(item.qty || 0) + qty <= Number(item.stock || 0) ? '' : item.warehouseId
      } : item));
    } else {
      setSelectedCart({ row: cart.length, field: 'qty' });
      setCart(c => [...c, {
        productId: p._id,
        partName: p.partName,
        partCode: p.partCode,
        qty,
        price,
        discount,
        stock: p.quantity,
        warehouseQuantity: p.warehouseQuantity || 0,
        warehouseStocks: p.warehouseStocks || [],
        warehouseId: ''
      }]);
    }
    if (qty > Number(p.quantity || 0) && Number(p.warehouseQuantity || 0) > 0) loadWarehouseOptions(p._id);
  }

  function submitSaleModal(e) {
    e.preventDefault();
    if (!saleModalProduct) return;
    const qty = Number(saleDraft.qty || 0);
    const availableQty = Number(saleModalProduct.quantity || 0) + Number(saleModalProduct.warehouseQuantity || 0);
    if (qty <= 0) return setNotice({ type: 'error', title: 'Invalid Quantity', message: 'Enter a quantity greater than zero.' });
    if (qty > availableQty) return setNotice({ type: 'error', title: 'Not Enough Stock', message: `Only ${availableQty.toLocaleString()} pieces are available.` });
    addSale(saleModalProduct, saleDraft);
    closeSaleModal();
    scrollToProductSearch();
  }

  function update(i, key, val) { setCart(c => c.map((x, idx) => idx === i ? { ...x, [key]: Number(val) || 0 } : x)); }
  function updateCartQty(index, value, item) {
    const qty = Number(value) || 0;
    setCart(c => c.map((x, idx) => idx === index ? { ...x, qty, warehouseId: qty <= Number(x.stock || 0) ? '' : x.warehouseId } : x));
    if (qty > Number(item.stock || 0)) loadWarehouseOptions(item.productId);
  }
  function updateCartWarehouse(index, warehouseId) {
    setCart(c => c.map((x, idx) => idx === index ? { ...x, warehouseId } : x));
  }

  function removeCartItem(index) {
    setCart(c => c.filter((_, idx) => idx !== index));
    setSelectedCart(current => {
      if (current.row === index) return { row: -1, field: 'qty' };
      if (current.row > index) return { ...current, row: current.row - 1 };
      return current;
    });
  }

  const totals = useMemo(() => cart.reduce((a, i) => { a.sub += i.qty * i.price; a.dis += i.discount; return a; }, { sub: 0, dis: 0 }), [cart]);

  function clearCurrentBill() {
    setCart([]);
    setSelectedCart({ row: -1, field: 'qty' });
    setCustomerMode('walk-in');
    setSelectedCustomer(null);
    setCustomerSearch('');
    setPaymentStatus('paid');
    setPaidAmount('');
  }

  function moveProductSelection(delta) {
    setSelectedProductIndex(current => {
      if (!products.length) return -1;
      const next = Math.min(products.length - 1, Math.max(0, (current < 0 ? 0 : current) + delta));
      return next;
    });
  }

  function addSelectedProduct() {
    const product = products[selectedProductIndex];
    if (product && Number(product.quantity || 0) + Number(product.warehouseQuantity || 0) > 0) openSaleModal(product);
  }

  function activateProductAction(product) {
    if (product && Number(product.quantity || 0) + Number(product.warehouseQuantity || 0) > 0) openSaleModal(product);
  }

  function warehouseSummary(item) {
    const stocks = warehouses
      .map(warehouse => ({
        name: warehouse.name,
        quantity: Number(item.warehouseStocks?.find(stock => String(stock.warehouseId) === String(warehouse._id))?.quantity || 0)
      }))
      .filter(stock => stock.quantity > 0);
    if (!stocks.length) return 'Warehouse 0';
    return stocks.map(stock => `${stock.name} ${stock.quantity}`).join(' · ');
  }

  function focusCartField(row, field) {
    const safeRow = Math.min(cart.length - 1, Math.max(0, row));
    if (safeRow < 0) return;
    setSelectedCart({ row: safeRow, field });
    window.requestAnimationFrame(() => cartFieldRefs.current[`${safeRow}-${field}`]?.focus());
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveProductSelection(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveProductSelection(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      addSelectedProduct();
    }
  }

  function handleCartKeyDown(e, row, field) {
    const fieldIndex = cartFieldOrder.indexOf(field);
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusCartField(row, cartFieldOrder[Math.max(0, fieldIndex - 1)]);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusCartField(row, cartFieldOrder[Math.min(cartFieldOrder.length - 1, fieldIndex + 1)]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCartField(row - 1, field);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCartField(row + 1, field);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (fieldIndex < cartFieldOrder.length - 1) focusCartField(row, cartFieldOrder[fieldIndex + 1]);
      else if (row < cart.length - 1) focusCartField(row + 1, cartFieldOrder[0]);
    }
  }

  async function checkout() {
    try {
      if (customerMode === 'existing' && !selectedCustomer) return setNotice({ type: 'error', title: 'Customer Required', message: 'Select a customer for this bill.' });
      if (customerMode === 'walk-in' && paymentStatus !== 'paid') return setNotice({ type: 'error', title: 'Customer Required', message: 'Unpaid or partial bills must be linked to an existing customer.' });
      const itemMissingWarehouse = cart.find(item => Number(item.qty || 0) > Number(item.stock || 0) && !item.warehouseId);
      if (itemMissingWarehouse) return setNotice({ type: 'error', title: 'Warehouse Required', message: `Select a warehouse for ${itemMissingWarehouse.partCode}.` });
      setCheckoutLoading(true);
      const r = await api.post('/sales', {
        customerName: selectedCustomer?.name || 'Walk-in Customer',
        customerId: customerMode === 'existing' ? selectedCustomer?._id : undefined,
        paymentStatus,
        paidAmount: paymentStatus === 'partial' ? Number(paidAmount || 0) : undefined,
        items: cart.map(item => ({ ...item, warehouseId: item.warehouseId || undefined }))
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

  function resetReturnState() {
    setReturnForm(false);
    setReturnBillNo('');
    setReturnBill(null);
    setReturnItems({});
    setReturnReason('');
    setReturnError('');
  }

  function calculateReturnRefund(item, qty) {
    const returnQtyValue = Number(qty || 0);
    const perUnitRefund = Number(item?.lineTotal || 0) / Number(item?.qty || 1);
    return Math.round(perUnitRefund * returnQtyValue);
  }

  function toggleReturnItem(item) {
    if (item.returnableQty <= 0) return;
    setReturnItems(current => {
      if (current[item.product]) {
        const next = { ...current };
        delete next[item.product];
        return next;
      }
      return {
        ...current,
        [item.product]: {
          productId: item.product,
          qty: '1',
          amountRefunded: String(calculateReturnRefund(item, 1))
        }
      };
    });
  }

  function updateReturnItem(productId, key, value) {
    setReturnItems(current => {
      const nextItem = { ...current[productId], [key]: value };
      if (key === 'qty') {
        const billItem = returnBill?.items?.find(item => item.product === productId);
        if (billItem) nextItem.amountRefunded = value ? String(calculateReturnRefund(billItem, value)) : '';
      }
      return { ...current, [productId]: nextItem };
    });
  }

  async function lookupReturnBill(e) {
    e?.preventDefault();
    if (!returnBillNo.trim()) return setReturnError('Enter a bill number');
    try {
      setReturnLookupLoading(true);
      setReturnError('');
      setReturnBill(null);
      setReturnItems({});
      const r = await api.get(`/sales/by-receipt/${encodeURIComponent(returnBillNo.trim())}`);
      setReturnBill(r.data);
      if (!r.data.items?.some(item => item.returnableQty > 0)) setReturnError('All items in this bill have already been returned');
    } catch (err) {
      setReturnError(err.response?.data?.message || err.message);
    } finally {
      setReturnLookupLoading(false);
    }
  }
  
  async function doReturn(e) {
    e.preventDefault();
    if (!returnBill) return setReturnError('Search and select a bill first');
    const selectedReturns = Object.values(returnItems);
    if (!selectedReturns.length) return setReturnError('Select at least one item from the bill');
    const items = selectedReturns.map(item => {
      const billItem = returnBill.items?.find(row => row.product === item.productId);
      return {
        productId: item.productId,
        qty: Number(item.qty || 0),
        amountRefunded: Number(item.amountRefunded || 0),
        returnableQty: Number(billItem?.returnableQty || 0),
        partName: billItem?.partName || 'item'
      };
    });
    const body = {
      receiptNo: returnBill.receiptNo,
      items: items.map(({ productId, qty, amountRefunded }) => ({ productId, qty, amountRefunded })),
      reason: returnReason
    };
    const invalidItem = items.find(item => item.qty <= 0 || item.qty > item.returnableQty);
    if (invalidItem) return setReturnError(`Enter a valid return quantity for ${invalidItem.partName}`);
    try {
      setReturnSaving(true);
      await api.post('/returns', body);
      resetReturnState();
      await load(page);
      setNotice({ type: 'success', title: 'Return Saved', message: 'Return saved and stock updated.' });
    } catch (err) {
      setReturnError(err.response?.data?.message || err.message);
    } finally {
      setReturnSaving(false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const billTotal = totals.sub - totals.dis;
  const duePreview = paymentStatus === 'paid' ? 0 : paymentStatus === 'partial' ? Math.max(0, billTotal - Number(paidAmount || 0)) : billTotal;

  return <Layout title="Sales Counter" subtitle="Search products, sell items, apply discounts, print receipts and process returns." wide>
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div ref={productSearchRef} className="mb-5 flex min-w-0 scroll-mt-5 flex-col gap-3 sm:flex-row xl:flex-nowrap">
          <div className="flex-1 relative">
            <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={handleSearchKeyDown} placeholder="Search product by part name or code" className="w-full rounded-2xl border p-4" />
            {q && <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={20}/></button>}
          </div>
          <button onClick={()=>load(1)} className="rounded-2xl bg-brand-dark px-6 py-3 text-white sm:py-0">Search</button>
          <button onClick={()=>setReturnForm(true)} className="rounded-2xl border px-6 py-3 sm:py-0">Return</button>
        </div>
        {!loadingProducts && q && !hasExactMatch && products.length > 0 && <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">No exact match for "{q}", showing relevant results:</div>}
        {!loadingProducts && q && products.length === 0 && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">No products found matching "{q}". Try a different search term.</div>}
        {loadingProducts ? <LoadingState label="Loading products..." /> : <ProductTable
          products={products}
          salesMode
          selectedIndex={selectedProductIndex}
          selectedActionIndex={0}
          onSelectIndex={setSelectedProductIndex}
          onMoveSelection={moveProductSelection}
          onMoveAction={() => {}}
          onActivateAction={activateProductAction}
          onAddSale={openSaleModal}
          onDetail={()=>{}}
          startIndex={(page - 1) * limit}
          warehouseColumns={warehouses}
          showBookingPrice={showBookingPrice}
          onToggleBookingPrice={() => setShowBookingPrice(value => !value)}
        />}
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
      </div>
      <aside className="w-full rounded-3xl bg-white p-4 shadow-soft border h-fit lg:sticky lg:top-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-xl font-bold">Current Bill</h3>
          {cart.length > 0 && <button type="button" onClick={clearCurrentBill} className="rounded-xl border p-2 text-slate-500 hover:bg-slate-50 hover:text-brand-red" title="Clear current bill" aria-label="Clear current bill"><X size={18}/></button>}
        </div>
        {cart.length===0 ? <p className="text-slate-500">No items added.</p> : <div className="space-y-3">
          {cart.map((i,idx)=>{
            const shortageQty = Math.max(0, Number(i.qty || 0) - Number(i.stock || 0));
            const availableWarehouseOptions = warehouseOptions[i.productId] || [];
            return <div key={i.productId} onClick={() => setSelectedCart({ row: idx, field: selectedCart.field || 'qty' })} className={`relative cursor-pointer rounded-2xl p-3 pr-11 ${selectedCart.row === idx ? 'bg-red-50 ring-2 ring-brand-red/30' : 'bg-slate-50'}`}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeCartItem(idx);
              }}
              className="absolute right-3 top-3 rounded-lg border border-slate-200 bg-white p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-brand-red"
              title={`Remove ${i.partName} from bill`}
              aria-label={`Remove ${i.partName} from bill`}
            >
              <X size={16} />
            </button>
            <div className="font-semibold break-words">{i.partName}</div>
            <div className="text-xs text-slate-500">{i.partCode} · Main {i.stock} · {warehouseSummary(i)}</div>
            <div className="grid grid-cols-1 gap-2 mt-3 min-[380px]:grid-cols-3">
              <div><label className="text-xs text-slate-600">Qty</label><input ref={node => { cartFieldRefs.current[`${idx}-qty`] = node; }} min="1" max={Number(i.stock || 0) + Number(i.warehouseQuantity || 0)} value={i.qty} onFocus={() => setSelectedCart({ row: idx, field: 'qty' })} onKeyDown={e => handleCartKeyDown(e, idx, 'qty')} onChange={e=>updateCartQty(idx,e.target.value,i)} className="mt-1 w-full rounded-xl border p-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20" /></div>
              <div><label className="text-xs text-slate-600">Price</label><input ref={node => { cartFieldRefs.current[`${idx}-price`] = node; }} value={i.price} onFocus={() => setSelectedCart({ row: idx, field: 'price' })} onKeyDown={e => handleCartKeyDown(e, idx, 'price')} onChange={e=>update(idx,'price',e.target.value)} className="mt-1 w-full rounded-xl border p-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20" /></div>
              <div><label className="text-xs text-slate-600">Discount</label><input ref={node => { cartFieldRefs.current[`${idx}-discount`] = node; }} value={i.discount} onFocus={() => setSelectedCart({ row: idx, field: 'discount' })} onKeyDown={e => handleCartKeyDown(e, idx, 'discount')} onChange={e=>update(idx,'discount',e.target.value)} className="mt-1 w-full rounded-xl border p-2 focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20" /></div>
            </div>
            {shortageQty > 0 && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <label className="text-xs font-semibold text-amber-800">Main stock short by {shortageQty}. Select warehouse source.</label>
              <select value={i.warehouseId || ''} onChange={e => updateCartWarehouse(idx, e.target.value)} className="mt-2 w-full rounded-xl border bg-white p-2 text-sm">
                <option value="">Choose warehouse</option>
                {availableWarehouseOptions.map(stock => (
                  <option key={stock.warehouse._id} value={stock.warehouse._id}>{stock.warehouse.name} · available {stock.quantity}</option>
                ))}
              </select>
              {availableWarehouseOptions.length === 0 && <p className="mt-2 text-xs text-amber-800">No warehouse stock available for this product.</p>}
            </div>}
          </div>;
          })}
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
              <div className="mt-2 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
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

    {saleModalProduct && <Modal title="Sell Product" onClose={closeSaleModal}>
      <form onSubmit={submitSaleModal} className="grid gap-5">
        <div className="rounded-2xl border bg-slate-50 p-4">
          <p className="break-words text-lg font-bold text-slate-900">{saleModalProduct.partName}</p>
          <p className="mt-1 text-sm text-slate-500">
            {saleModalProduct.partCode || '-'} · Main {Number(saleModalProduct.quantity || 0).toLocaleString()} · {warehouseSummary(saleModalProduct)}
          </p>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Retail Price</p>
              <p className="font-bold text-slate-900">Rs {Number(saleModalProduct.mrp || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Main Stock</p>
              <p className="font-bold text-slate-900">{Number(saleModalProduct.quantity || 0).toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">Total Stock</p>
              <p className="font-bold text-slate-900">{(Number(saleModalProduct.quantity || 0) + Number(saleModalProduct.warehouseQuantity || 0)).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-semibold text-slate-700">Qty</label>
            <input
              ref={saleQtyRef}
              type="number"
              min="1"
              max={Number(saleModalProduct.quantity || 0) + Number(saleModalProduct.warehouseQuantity || 0)}
              value={saleDraft.qty}
              onChange={e => setSaleDraft(current => ({ ...current, qty: e.target.value }))}
              className="mt-1 w-full rounded-xl border p-3 text-lg font-semibold focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Price</label>
            <input
              type="number"
              min="0"
              value={saleDraft.price}
              onChange={e => setSaleDraft(current => ({ ...current, price: e.target.value }))}
              className="mt-1 w-full rounded-xl border p-3 text-lg font-semibold focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Discount</label>
            <input
              type="number"
              min="0"
              value={saleDraft.discount}
              onChange={e => setSaleDraft(current => ({ ...current, discount: e.target.value }))}
              className="mt-1 w-full rounded-xl border p-3 text-lg font-semibold focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-2xl bg-brand-dark p-4 text-white min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between">
          <span className="font-semibold">Line Total</span>
          <span className="text-2xl font-bold">
            Rs {Math.max(0, Number(saleDraft.qty || 0) * Number(saleDraft.price || 0) - Number(saleDraft.discount || 0)).toLocaleString()}
          </span>
        </div>

        {Number(saleDraft.qty || 0) > Number(saleModalProduct.quantity || 0) && Number(saleModalProduct.warehouseQuantity || 0) > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Main stock is short by {(Number(saleDraft.qty || 0) - Number(saleModalProduct.quantity || 0)).toLocaleString()}. Select the warehouse source from the bill item after adding it.
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className="flex-1 rounded-xl bg-brand-red py-3 font-bold text-white">
            Add to Bill
          </button>
          <button type="button" onClick={closeSaleModal} className="rounded-xl border px-5 py-3 font-bold">
            Cancel
          </button>
        </div>
      </form>
    </Modal>}
    
    {receipt && <Modal title="Receipt" onClose={()=>setReceipt(null)} fillViewport>
      <div className="receipt-screen-content">
        <ShopReceipt receipt={receipt} />
        <button onClick={()=>window.print()} className="no-print mt-4 w-full rounded-xl bg-brand-dark text-white py-3">Print Receipt</button>
      </div>
      <div className="receipt-print-only" aria-hidden="true">
        <ShopReceipt receipt={receipt} />
      </div>
    </Modal>}
    
    {returnForm && <Modal title="Process Return" onClose={resetReturnState}>
      <div className="grid gap-4">
        <form onSubmit={lookupReturnBill} className="grid gap-3">
          <label className="text-sm font-medium">Bill Number</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <input value={returnBillNo} onChange={e=>setReturnBillNo(e.target.value)} placeholder="Enter bill number..." className="w-full rounded-xl border p-3 pr-10" />
              {returnBillNo && <button type="button" onClick={() => { setReturnBillNo(''); setReturnBill(null); setReturnItems({}); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={18}/></button>}
            </div>
            <button type="submit" disabled={returnLookupLoading} className="flex items-center justify-center gap-2 rounded-xl bg-brand-dark px-5 py-3 text-white font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:py-0">
              {returnLookupLoading && <ButtonSpinner />}
              {returnLookupLoading ? 'Fetching...' : 'Fetch Bill'}
            </button>
          </div>
        </form>

        {returnError && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{returnError}</div>}

        {returnBill && (
          <form onSubmit={doReturn} className="grid gap-4">
            <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 text-sm md:grid-cols-4">
              <div><p className="text-slate-500">Bill</p><p className="font-bold">{returnBill.receiptNo}</p></div>
              <div>
                <p className="text-slate-500">Customer</p>
                <p className="font-bold">{returnBill.customer?.name || returnBill.customerName || 'Walk-in Customer'}</p>
                {returnBill.customer?.phone && <p className="text-xs text-slate-500">{returnBill.customer.phone}</p>}
              </div>
              <div><p className="text-slate-500">Date</p><p className="font-bold">{new Date(returnBill.createdAt).toLocaleDateString()}</p></div>
              <div><p className="text-slate-500">Total</p><p className="font-bold">Rs {Number(returnBill.grandTotal || 0).toLocaleString()}</p></div>
            </div>

            <div className="max-w-full overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="p-3 font-semibold">Return</th>
                    <th className="p-3 font-semibold">Item</th>
                    <th className="p-3 text-right font-semibold">Sold</th>
                    <th className="p-3 text-right font-semibold">Returned</th>
                    <th className="p-3 text-right font-semibold">Available</th>
                    <th className="p-3 text-right font-semibold">Return Qty</th>
                    <th className="p-3 text-right font-semibold">Refund</th>
                    <th className="p-3 text-right font-semibold">Price</th>
                    <th className="p-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {returnBill.items?.map(item => {
                    const selectedReturnItem = returnItems[item.product];
                    return (
                    <tr key={item.product} className={`border-t ${selectedReturnItem ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-3">
                        <input type="checkbox" disabled={item.returnableQty <= 0} checked={Boolean(selectedReturnItem)} onChange={() => toggleReturnItem(item)} />
                      </td>
                      <td className="p-3">
                        <p className="font-semibold">{item.partName}</p>
                        <p className="text-xs text-slate-500">{item.partCode}</p>
                      </td>
                      <td className="p-3 text-right">{item.qty}</td>
                      <td className="p-3 text-right">{item.returnedQty}</td>
                      <td className="p-3 text-right font-semibold">{item.returnableQty}</td>
                      <td className="p-3 text-right">
                        {selectedReturnItem ? <input value={selectedReturnItem.qty} onChange={e=>updateReturnItem(item.product, 'qty', e.target.value)} type="number" min="1" max={item.returnableQty} className="w-20 rounded-lg border p-2 text-right" required /> : '-'}
                      </td>
                      <td className="p-3 text-right">
                        {selectedReturnItem ? <input value={selectedReturnItem.amountRefunded} onChange={e=>updateReturnItem(item.product, 'amountRefunded', e.target.value)} type="number" min="0" className="w-24 rounded-lg border p-2 text-right" /> : '-'}
                      </td>
                      <td className="p-3 text-right">Rs {Number(item.price || 0).toLocaleString()}</td>
                      <td className="p-3 text-right font-semibold">Rs {Number(item.lineTotal || 0).toLocaleString()}</td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>

            <textarea value={returnReason} onChange={e=>setReturnReason(e.target.value)} placeholder="Reason" className="rounded-xl border p-3" />
            <button type="submit" disabled={returnSaving || Object.keys(returnItems).length === 0} className="rounded-xl bg-brand-red text-white py-3 font-bold disabled:cursor-not-allowed disabled:opacity-70 flex items-center justify-center gap-2">
              {returnSaving && <ButtonSpinner />}
              {returnSaving ? 'Saving return...' : 'Save Return'}
            </button>
          </form>
        )}
      </div>
    </Modal>}
  </Layout>;
}
