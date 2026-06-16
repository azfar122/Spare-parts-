import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  LogOut,
  ShieldCheck,
  Store,
  BarChart3,
  Package,
  PackagePlus,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api/client.js";
import logo from "../assets/atlas-honda-logo.png";

export default function Layout({ title, subtitle, children, wide = false }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  async function loadNotifications() {
    if (!user) return;
    try {
      setLoadingNotifications(true);
      const r = await api.get("/products/low-stock");
      setLowStockItems(r.data.items || []);
    } catch (err) {
      setLowStockItems([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || "http://localhost:5001",
    );
    socket.on("inventory:update", loadNotifications);
    socket.on("inventory:bulk-update", loadNotifications);
    return () => socket.disconnect();
  }, [user]);

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="w-full bg-brand-dark text-white">
        <div className="mx-auto flex max-w-[calc(100vw-3rem)] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Asif Auto Traders"
              className="h-14 w-20 rounded-xl bg-white object-contain p-1.5 shadow-soft"
            />
            <div>
              <h1 className="text-xl font-bold">Asif Auto Traders</h1>
              <p className="text-sm text-slate-300">
                Inventory, sales receipts and returns
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {user?.role === "admin" && (
              <div className="flex gap-2">
                <Link
                  to="/admin"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/admin" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Store size={16} />
                  Inventory
                </Link>
                <Link
                  to="/admin/sales"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/admin/sales" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <BarChart3 size={16} />
                  Sales
                </Link>
                <Link
                  to="/admin/customers"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/admin/customers" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <BookOpen size={16} />
                  Khata
                </Link>
                <Link
                  to="/admin/warehouses"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/admin/warehouses" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Building2 size={16} />
                  Warehouse
                </Link>
                <Link
                  to="/admin/purchase-orders"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/admin/purchase-orders" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Package size={16} />
                  Orders
                </Link>
              </div>
            )}
            {user?.role === "sales" && (
              <div className="flex gap-2">
                <Link
                  to="/sales"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/sales" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Store size={16} />
                  Counter
                </Link>
                <Link
                  to="/sales/purchase-orders"
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${location.pathname === "/sales/purchase-orders" ? "bg-white/20" : "hover:bg-white/10"}`}
                >
                  <Package size={16} />
                  Orders
                </Link>
              </div>
            )}
            {user && (
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen(true);
                  loadNotifications();
                }}
                className="no-print relative rounded-xl bg-white/10 p-2.5 hover:bg-white/20"
                title="Stock notifications"
              >
                <Bell size={18} />
                {lowStockItems.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-red px-1 text-[11px] font-bold text-white">
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            )}
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm">
              <ShieldCheck size={16} />
              {user?.role}
            </span>
            <button
              type="button"
              onClick={logout}
              className="no-print flex gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      {notificationOpen && (
        <div className="no-print fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setNotificationOpen(false)}
            aria-label="Close notifications"
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(420px,100vw)] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-brand-red">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Notifications
                  </h3>
                  <p className="text-sm text-slate-500">
                    {lowStockItems.length} Low Stock Alert
                    {lowStockItems.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNotificationOpen(false)}
                className="rounded-xl border p-2 text-slate-500 hover:bg-slate-50"
                title="Close notifications"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingNotifications && (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                  Loading notifications...
                </div>
              )}
              {!loadingNotifications && lowStockItems.length === 0 && (
                <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed p-8 text-center">
                  <div>
                    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                      <Package size={22} />
                    </div>
                    <p className="font-semibold text-slate-900">
                      No Low Stock Alerts
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Products with a minimum quantity will appear here when
                      total stock reaches that limit.
                    </p>
                  </div>
                </div>
              )}
              {!loadingNotifications && lowStockItems.length > 0 && (
                <div className="space-y-3">
                  {lowStockItems.map((item) => (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-red-100 bg-red-50/70 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-red">
                          <AlertTriangle size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900">
                            {item.productName || item.partName}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {item.partNo || item.partCode || "No part no"}
                            {item.brand ? ` · ${item.brand}` : ""}
                          </p>
                          <p className="mt-3 text-sm text-slate-700">
                            This Product has reached minimum quantity. Please
                            order this part.
                          </p>
                          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                            <div className="rounded-xl bg-white p-2">
                              <p className="text-slate-500">Shop</p>
                              <p className="font-bold">
                                {Number(
                                  item.shopQuantity || 0,
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-2">
                              <p className="text-slate-500">Warehouse</p>
                              <p className="font-bold">
                                {Number(
                                  item.warehouseQuantity || 0,
                                ).toLocaleString()}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-2">
                              <p className="text-slate-500">Minimum</p>
                              <p className="font-bold text-brand-red">
                                {Number(
                                  item.minimumQuantity || 0,
                                ).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl bg-white p-3 text-xs">
                            <p className="font-semibold text-slate-700">
                              Warehouse stock
                            </p>
                            {item.warehouseStocks?.length ? (
                              <div className="mt-2 space-y-2">
                                {item.warehouseStocks.map((stock) => (
                                  <div
                                    key={`${item._id}-${stock.warehouseId}`}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold text-slate-900">
                                        {stock.warehouseName || "Warehouse"}
                                      </p>
                                      {stock.warehouseLocation && (
                                        <p className="truncate text-slate-500">
                                          {stock.warehouseLocation}
                                        </p>
                                      )}
                                    </div>
                                    <p className="shrink-0 font-bold text-slate-900">
                                      {Number(
                                        stock.quantity || 0,
                                      ).toLocaleString()}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-slate-500">
                                No warehouse stock available.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {user && (
              <div className="border-t p-4">
                <Link
                  to={
                    user.role === "admin"
                      ? "/admin/purchase-orders"
                      : "/sales/purchase-orders"
                  }
                  onClick={() => setNotificationOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-3 font-semibold text-white"
                >
                  <PackagePlus size={18} />
                  Open Orders
                </Link>
              </div>
            )}
          </aside>
        </div>
      )}

      <main
        className={`mx-auto px-6 py-8 ${wide ? "max-w-[calc(100vw-3rem)]" : "max-w-7xl"}`}
      >
        <div className="mb-7">
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-slate-500">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
