import { BookOpen, Building2, LogOut, ShieldCheck, Store, BarChart3, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useLocation } from 'react-router-dom';

export default function Layout({ title, subtitle, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return <div className="min-h-screen">
    <div className="bg-brand-dark text-white">
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-brand-red grid place-items-center shadow-soft"><Store /></div>
          <div><h1 className="text-xl font-bold">Bike Spare Parts SaaS</h1><p className="text-sm text-slate-300">Inventory, sales receipts and returns</p></div>
        </div>
        <div className="flex items-center gap-4">
          {user?.role === 'admin' && (
            <div className="flex gap-2">
              <Link to="/admin" className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${location.pathname === '/admin' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <Store size={16}/>Inventory
              </Link>
              <Link to="/admin/sales" className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${location.pathname === '/admin/sales' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <BarChart3 size={16}/>Sales
              </Link>
              <Link to="/admin/customers" className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${location.pathname === '/admin/customers' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <BookOpen size={16}/>Khata
              </Link>
              <Link to="/admin/warehouses" className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${location.pathname === '/admin/warehouses' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <Building2 size={16}/>Warehouse
              </Link>
              <Link to="/admin/purchase-orders" className={`rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition ${location.pathname === '/admin/purchase-orders' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <Package size={16}/>Orders
              </Link>
            </div>
          )}
          <span className="text-sm bg-white/10 px-3 py-2 rounded-full flex items-center gap-2"><ShieldCheck size={16}/>{user?.role}</span>
          <button onClick={logout} className="no-print rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm flex gap-2"><LogOut size={16}/>Logout</button>
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-7"><h2 className="text-3xl font-bold tracking-tight">{title}</h2><p className="text-slate-500 mt-1">{subtitle}</p></div>
      {children}
    </main>
  </div>;
}
