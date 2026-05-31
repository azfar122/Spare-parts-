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

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/sales'} replace />;
  return children;
}

function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
    <Route path="/admin/sales" element={<Protected role="admin"><SalesAnalytics /></Protected>} />
    <Route path="/admin/purchase-orders" element={<Protected role="admin"><PurchaseOrders /></Protected>} />
    <Route path="/sales" element={<Protected role="sales"><SalesDashboard /></Protected>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}

createRoot(document.getElementById('root')).render(<App />);
