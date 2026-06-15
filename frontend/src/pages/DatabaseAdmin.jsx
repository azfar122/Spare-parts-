import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import { LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { Users, Package, ShoppingCart } from 'lucide-react';

export default function DatabaseAdmin() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({ users: 0, products: 0, sales: 0, totalRevenue: 0 });
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const [usersRes, productsRes, salesRes] = await Promise.all([
        api.get('/users'),
        api.get('/products', { params: { limit: 1000 } }),
        api.get('/sales', { params: { limit: 1000 } })
      ]);

      setUsers(usersRes.data);
      setProducts(productsRes.data.items);
      setSales(salesRes.data.items);

      const totalRevenue = (salesRes.data.items || []).reduce((sum, s) => sum + (s.grandTotal || 0), 0);
      setStats({
        users: usersRes.data.length,
        products: productsRes.data.total,
        sales: salesRes.data.total,
        totalRevenue
      });
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  if (loading) return <Layout title="Database Admin" subtitle="View all database tables"><LoadingState label="Loading database..." /></Layout>;

  return <Layout title="Database Admin" subtitle="View all database tables and statistics">
    <div className="grid md:grid-cols-4 gap-4 mb-8">
      <div className="rounded-2xl bg-white p-6 shadow-soft border flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-blue-100 grid place-items-center"><Users size={24} className="text-blue-600" /></div>
        <div><p className="text-slate-500 text-sm">Users</p><p className="text-2xl font-bold">{stats.users}</p></div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-soft border flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-green-100 grid place-items-center"><Package size={24} className="text-green-600" /></div>
        <div><p className="text-slate-500 text-sm">Products</p><p className="text-2xl font-bold">{stats.products}</p></div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-soft border flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-purple-100 grid place-items-center"><ShoppingCart size={24} className="text-purple-600" /></div>
        <div><p className="text-slate-500 text-sm">Sales</p><p className="text-2xl font-bold">{stats.sales}</p></div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-soft border flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-red-100 grid place-items-center"><span className="text-red-600 font-bold">₹</span></div>
        <div><p className="text-slate-500 text-sm">Total Revenue</p><p className="text-2xl font-bold">Rs {Number(stats.totalRevenue).toLocaleString()}</p></div>
      </div>
    </div>

    <div className="flex gap-2 mb-6 border-b">
      {[{ id: 'users', label: 'Users' }, { id: 'products', label: 'Products' }, { id: 'sales', label: 'Sales' }].map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === tab.id ? 'border-brand-red text-brand-red' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>{tab.label}</button>
      ))}
    </div>

    {activeTab === 'users' && <div className="rounded-3xl bg-white shadow-soft border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="p-4 text-left">Username</th><th className="p-4 text-left">Name</th><th className="p-4 text-left">Email</th><th className="p-4 text-left">Role</th><th className="p-4 text-left">Status</th></tr></thead>
        <tbody>
          {users.map(u => <tr key={u._id} className="border-t hover:bg-slate-50"><td className="p-4 font-semibold">{u.username}</td><td className="p-4">{u.name}</td><td className="p-4 text-slate-500">{u.email}</td><td className="p-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td><td className="p-4"><span className={`font-medium ${u.active ? 'text-green-600' : 'text-amber-600'}`}>{u.active ? 'Approved' : 'Pending Approval'}</span></td></tr>)}
        </tbody>
      </table>
    </div>}

    {activeTab === 'products' && <div className="rounded-3xl bg-white shadow-soft border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="p-4 text-left">Part No</th><th className="p-4 text-left">Product Name</th><th className="p-4 text-left">Brand</th><th className="p-4 text-left">Category</th><th className="p-4 text-left">Type</th><th className="p-4 text-right">Booking Price</th><th className="p-4 text-right">Retail Price(RP)</th><th className="p-4 text-right">Stock Qty</th></tr></thead>
        <tbody>
          {products.slice(0, 100).map(p => <tr key={p._id} className="border-t hover:bg-slate-50"><td className="p-4 font-semibold text-brand-red">{p.partNo || p.partCode || '-'}</td><td className="p-4">{p.productName || p.partName || '-'}</td><td className="p-4 text-slate-500">{p.brand || '-'}</td><td className="p-4 text-slate-500">{p.category || '-'}</td><td className="p-4 text-slate-500">{p.type || p.model || '-'}</td><td className="p-4 text-right">Rs {Number(p.bookingPrice || 0).toLocaleString()}</td><td className="p-4 text-right">Rs {Number(p.mrp || 0).toLocaleString()}</td><td className="p-4 text-right"><span className={p.quantity <= 5 ? 'text-red-600 font-bold' : ''}>{p.quantity}</span></td></tr>)}
        </tbody>
      </table>
      {products.length > 100 && <div className="p-4 text-slate-500 text-sm border-t">Showing first 100 of {products.length} products</div>}
    </div>}

    {activeTab === 'sales' && <div className="rounded-3xl bg-white shadow-soft border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50"><tr><th className="p-4 text-left">Receipt #</th><th className="p-4 text-left">Date</th><th className="p-4 text-left">Customer</th><th className="p-4 text-left">Sold By</th><th className="p-4 text-right">Items</th><th className="p-4 text-right">Subtotal</th><th className="p-4 text-right">Discount</th><th className="p-4 text-right">Total</th></tr></thead>
        <tbody>
          {sales.slice(0, 100).map(s => <tr key={s._id} className="border-t hover:bg-slate-50"><td className="p-4 font-semibold text-brand-red">{s.receiptNo}</td><td className="p-4 text-sm">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td><td className="p-4">{s.customerName}</td><td className="p-4 font-semibold">{s.soldBy?.name || s.soldBy?.username || '-'}</td><td className="p-4 text-right">{s.items.length}</td><td className="p-4 text-right">Rs {Number(s.subtotal).toLocaleString()}</td><td className="p-4 text-right">Rs {Number(s.discountTotal).toLocaleString()}</td><td className="p-4 text-right font-bold">Rs {Number(s.grandTotal).toLocaleString()}</td></tr>)}
        </tbody>
      </table>
      {sales.length > 100 && <div className="p-4 text-slate-500 text-sm border-t">Showing first 100 of {sales.length} sales</div>}
    </div>}
  </Layout>;
}
