import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Check } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../api/client.js';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiveForm, setReceiveForm] = useState(null);
  const limit = 50;

  const [formData, setFormData] = useState({
    orderNumber: '',
    totalPrice: '',
    items: [{ partCode: '', partName: '', model: '', qty: 1, productId: null, price: '' }],
    notes: ''
  });
  const [searchQueries, setSearchQueries] = useState({});

  async function loadOrders(pageNum = 1) {
    const r = await api.get('/purchase-orders', { params: { page: pageNum, limit } });
    setOrders(r.data.items);
    setTotal(r.data.total || 0);
    setPage(pageNum);
  }

  async function loadProducts() {
    const r = await api.get('/products', { params: { limit: 1000 } });
    setProducts(r.data.items || []);
  }

  useEffect(() => {
    loadOrders(1);
    loadProducts();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await api.post('/purchase-orders', {
        orderNumber: formData.orderNumber,
        totalPrice: Number(formData.totalPrice),
        items: formData.items.map(item => ({
          product: item.productId || undefined,
          partCode: item.partCode,
          partName: item.partName,          model: item.model || 'COMMON',          qty: Number(item.qty),
          price: item.price ? Number(item.price) : undefined
        })),
        notes: formData.notes
      });
      setFormData({ orderNumber: '', totalPrice: '', items: [{ partCode: '', partName: '', model: '', qty: 1, productId: null, price: '' }], notes: '' });
      setShowForm(false);
      loadOrders(1);
    } catch (err) {
      alert('Error creating order: ' + err.message);
    }
  }

  async function handleReceive(e) {
    e.preventDefault();
    try {
      const order = selectedOrder;
      const itemIdx = receiveForm.itemIndex;
      const receivedQty = Number(receiveForm.receivedQty);
      
      const updated = await api.put(`/purchase-orders/${order._id}/receive`, {
        itemIndex: itemIdx,
        receivedQty
      });
      
      setSelectedOrder(updated.data);
      setReceiveForm(null);
      loadOrders(page);
    } catch (err) {
      alert('Error receiving: ' + err.message);
    }
  }

  const totalPages = Math.ceil(total / limit);

  const getStatusBadge = (status) => {
    const colors = { pending: 'bg-yellow-100 text-yellow-700', partial: 'bg-blue-100 text-blue-700', received: 'bg-green-100 text-green-700' };
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status]}`}>{status.toUpperCase()}</span>;
  };

  return <Layout title="Purchase Orders" subtitle="Manage orders from manufacturers and track inventory receipts.">
    <button onClick={() => setShowForm(true)} className="mb-6 rounded-xl bg-brand-red text-white px-6 py-3 font-bold flex items-center gap-2"><Plus size={20}/>New Order</button>

    {orders.length > 0 && <div className="rounded-3xl bg-white shadow-soft border overflow-x-auto mb-6">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="p-4 text-left">Order #</th><th className="p-4 text-left">Date</th><th className="p-4 text-right">Total Price</th><th className="p-4 text-right">Items</th><th className="p-4 text-left">Status</th><th className="p-4 text-center">Action</th></tr></thead>
        <tbody>
          {orders.map(o => <tr key={o._id} className="border-t hover:bg-slate-50"><td className="p-4 font-semibold">{o.orderNumber}</td><td className="p-4 text-sm">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td><td className="p-4 text-right">Rs {Number(o.totalPrice).toLocaleString()}</td><td className="p-4 text-right">{o.items.length}</td><td className="p-4">{getStatusBadge(o.status)}</td><td className="p-4 text-center"><button onClick={() => setSelectedOrder(o)} className="rounded-lg px-3 py-1 border hover:bg-slate-100">View</button></td></tr>)}
        </tbody>
      </table>
    </div>}

    {totalPages > 1 && <div className="mt-6 flex items-center justify-center gap-3">
      <button onClick={() => loadOrders(page - 1)} disabled={page === 1} className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={16}/>Prev</button>
      <span className="text-sm">Page {page} of {totalPages}</span>
      <button onClick={() => loadOrders(page + 1)} disabled={page === totalPages} className="rounded-xl border px-3 py-2 hover:bg-slate-100 disabled:opacity-40">Next<ChevronRight size={16}/></button>
    </div>}

    {showForm && <Modal title="Create Purchase Order" onClose={() => setShowForm(false)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div><label className="text-sm font-medium">Order Number</label><input required value={formData.orderNumber} onChange={e => setFormData({...formData, orderNumber: e.target.value})} className="mt-1 w-full rounded-xl border p-3" /></div>
          <div><label className="text-sm font-medium">Total Price (Rs)</label><input required type="number" value={formData.totalPrice} onChange={e => setFormData({...formData, totalPrice: e.target.value})} className="mt-1 w-full rounded-xl border p-3" /></div>
        </div>
        
        <div><label className="text-sm font-medium">Items</label>
          {formData.items.map((item, idx) => {
            const sq = searchQueries[idx] || '';
            const filteredProducts = products.filter(p => 
              p.partName.toLowerCase().includes(sq.toLowerCase()) || 
              p.partCode.toLowerCase().includes(sq.toLowerCase())
            );
            const hasExactMatch = filteredProducts.some(p => 
              p.partName.toUpperCase() === sq.toUpperCase() || 
              p.partCode.toUpperCase() === sq.toUpperCase()
            );
            
            const handlePriceUpdate = async (newPrice) => {
              const newItems = [...formData.items];
              newItems[idx].price = newPrice;
              setFormData({...formData, items: newItems});
              
              if (item.productId) {
                try {
                  await api.put(`/products/${item.productId}`, { mrp: Number(newPrice) });
                } catch (err) {
                  console.error('Failed to update product MRP:', err);
                }
              }
            };
            
            return <div key={idx} className="mt-3 p-4 bg-slate-50 rounded-xl space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Product Search</label>
                <div className="relative mt-2">
                  <input 
                    type="text"
                    placeholder="Type name or code..." 
                    value={sq} 
                    onChange={e => { setSearchQueries({...searchQueries, [idx]: e.target.value}); }}
                    className="w-full rounded-lg border border-slate-300 p-3 text-sm"
                  />
                  {sq && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                      {sq && !hasExactMatch && filteredProducts.length > 0 && (
                        <div className="p-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">No exact match, showing similar results:</div>
                      )}
                      {filteredProducts.length > 0 ? (
                        filteredProducts.map(p => (
                          <div 
                            key={p._id}
                            onClick={() => {
                              const newItems = [...formData.items];
                              newItems[idx] = { ...item, productId: p._id, partCode: p.partCode, partName: p.partName, model: p.model, price: p.mrp };
                              setFormData({...formData, items: newItems});
                              setSearchQueries({...searchQueries, [idx]: ''});
                            }}
                            className="p-3 hover:bg-slate-100 cursor-pointer text-sm border-b last:border-b-0"
                          >
                            <p className="font-medium">{p.partName}</p>
                            <p className="text-xs text-slate-500">{p.partCode}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-sm text-slate-500">No products found - enter manually</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Code</label>
                  <input value={item.partCode} onChange={e => { const newItems = [...formData.items]; newItems[idx].partCode = e.target.value; setFormData({...formData, items: newItems}); }} placeholder="ABC-123" className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Name</label>
                  <input value={item.partName} onChange={e => { const newItems = [...formData.items]; newItems[idx].partName = e.target.value; setFormData({...formData, items: newItems}); }} placeholder="Part name" className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Model</label>
                  <input value={item.model} onChange={e => { const newItems = [...formData.items]; newItems[idx].model = e.target.value; setFormData({...formData, items: newItems}); }} placeholder="Hero, TVS" className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Qty</label>
                  <input type="number" min="1" value={item.qty} onChange={e => { const newItems = [...formData.items]; newItems[idx].qty = Number(e.target.value); setFormData({...formData, items: newItems}); }} placeholder="10" className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Price (Rs)</label>
                  <input type="number" min="0" value={item.price} onChange={e => handlePriceUpdate(e.target.value)} placeholder="500" className="mt-2 w-full rounded-lg border border-slate-300 p-2 text-sm" />
                </div>
                <div className="flex items-end">
                  {formData.items.length > 1 && <button type="button" onClick={() => setFormData({...formData, items: formData.items.filter((_, i) => i !== idx)})} className="w-full rounded-lg bg-red-100 hover:bg-red-200 text-red-700 px-2 py-2 text-sm font-bold h-10"><Trash2 size={16}/></button>}
                </div>
              </div>
            </div>;
          })}
          <button type="button" onClick={() => setFormData({...formData, items: [...formData.items, {partCode: '', partName: '', model: '', qty: 1, productId: null, price: ''}]})} className="mt-3 text-sm rounded-lg border px-3 py-2 hover:bg-slate-100">+ Add Item</button>
        </div>

        <div><label className="text-sm font-medium">Notes</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Order notes" className="mt-1 w-full rounded-xl border p-3" /></div>
        <button type="submit" className="w-full rounded-xl bg-brand-red text-white py-3 font-bold">Create Order</button>
      </form>
    </Modal>}

    {selectedOrder && <Modal title={`Order ${selectedOrder.orderNumber}`} onClose={() => setSelectedOrder(null)}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div><p className="text-slate-500">Date</p><p className="font-semibold">{new Date(selectedOrder.createdAt).toLocaleDateString('en-IN')}</p></div>
          <div><p className="text-slate-500">Total Price</p><p className="font-semibold">Rs {Number(selectedOrder.totalPrice).toLocaleString()}</p></div>
          <div><p className="text-slate-500">Status</p><p>{getStatusBadge(selectedOrder.status)}</p></div>
        </div>

        <div className="border-t pt-4"><p className="font-bold mb-3">Items</p>
          {selectedOrder.items.map((item, idx) => (
            <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-lg text-sm">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold">{item.partName}</p>
                  <p className="text-xs text-slate-500">{item.partCode} • {item.model}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'received' ? 'bg-green-100 text-green-700' : item.status === 'partial' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.status}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Ordered: {item.qty}</span>
                <span>Received: {item.received}</span>
              </div>
              {item.price && <div className="mb-2 text-slate-600"><span>Price: Rs {Number(item.price).toLocaleString()}</span></div>}
              {item.status !== 'received' && <button onClick={() => setReceiveForm({itemIndex: idx, receivedQty: item.qty})} className="w-full rounded-lg bg-green-600 text-white px-3 py-2 text-xs font-bold flex items-center justify-center gap-1"><Check size={14}/>Mark as Received</button>}
            </div>
          ))}
        </div>
      </div>
    </Modal>}

    {receiveForm && <Modal title="Receive Items" onClose={() => setReceiveForm(null)}>
      <form onSubmit={handleReceive} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Quantity Received</label>
          <input type="number" min="0" value={receiveForm.receivedQty} onChange={e => setReceiveForm({...receiveForm, receivedQty: e.target.value})} className="mt-2 w-full rounded-xl border p-3" />
        </div>
        <button type="submit" className="w-full rounded-xl bg-green-600 text-white py-3 font-bold">Confirm Receipt</button>
      </form>
    </Modal>}
  </Layout>;
}
