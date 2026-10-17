import DailyReport from './pages/DailyReport.jsx';
import useKeyboardNavigation from './hooks/useKeyboardNavigation.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/index.css';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AdminSettings from './pages/AdminSettings.jsx';
import PurchaseItems from './pages/PurchaseItems.jsx';
import Login from './pages/Login.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import SalesDashboard from './pages/SalesDashboard.jsx';
import SalesBills from './pages/SalesBills.jsx';
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
  useKeyboardNavigation();
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/admin/daily-report" element={<Protected role="admin"><DailyReport /></Protected>} />
    <Route path="/sales/daily-report" element={<Protected role="sales"><DailyReport /></Protected>} />
    <Route path="/login" element={<Login />} />
    <Route path="/admin/settings" element={<Protected role="admin"><AdminSettings /></Protected>} />
    <Route path="/admin/purchases" element={<Protected role="admin"><PurchaseItems /></Protected>} />
    <Route path="/sales/purchases" element={<Protected role="sales"><PurchaseItems /></Protected>} />
    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
    <Route path="/admin/sales" element={<Protected role="admin"><SalesAnalytics /></Protected>} />
    <Route path="/admin/customers" element={<Protected role="admin"><CustomerLedger /></Protected>} />
    <Route path="/admin/warehouses" element={<Protected role="admin"><WarehouseStock /></Protected>} />
    <Route path="/admin/purchase-orders" element={<Protected role="admin"><PurchaseOrders /></Protected>} />
    <Route path="/sales" element={<Protected role="sales"><SalesDashboard /></Protected>} />
    <Route path="/sales/bills" element={<Protected role="sales"><SalesBills /></Protected>} />
    <Route path="/sales/purchase-orders" element={<Protected role="sales"><PurchaseOrders canReceive={false} title="Orders" subtitle="Create manufacturer purchase orders and track their status." /></Protected>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<App />);
