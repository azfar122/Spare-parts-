import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/index.css';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import SalesDashboard from './pages/SalesDashboard.jsx';
import SalesAnalytics from './pages/SalesAnalytics.jsx';
import PurchaseOrders from './pages/PurchaseOrders.jsx';
import CustomerLedger from './pages/CustomerLedger.jsx';
import WarehouseStock from './pages/WarehouseStock.jsx';
import { LoadingState } from './components/Loader.jsx';

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState fullScreen label="Checking session..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/sales'} replace />;
  return children;
}

function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
    <Route path="/admin/sales" element={<Protected role="admin"><SalesAnalytics /></Protected>} />
    <Route path="/admin/customers" element={<Protected role="admin"><CustomerLedger /></Protected>} />
    <Route path="/admin/warehouses" element={<Protected role="admin"><WarehouseStock /></Protected>} />
    <Route path="/admin/purchase-orders" element={<Protected role="admin"><PurchaseOrders /></Protected>} />
    <Route path="/sales" element={<Protected role="sales"><SalesDashboard /></Protected>} />
    <Route path="/sales/purchase-orders" element={<Protected role="sales"><PurchaseOrders canReceive={false} title="Orders" subtitle="Create manufacturer purchase orders and track their status." /></Protected>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<App />);
