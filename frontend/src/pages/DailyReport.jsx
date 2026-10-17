import { downloadDailyReport, printDailyReport } from '../utils/dailyReportExport.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../api/client.js';
const money = value => `Rs ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const time = value => new Date(value).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' });
const tableClass = 'w-full whitespace-nowrap text-sm [&_th]:px-3 [&_th]:py-3 [&_th]:text-left [&_td]:px-3 [&_td]:py-3';
export default function DailyReport() {
  const location = useLocation();
  const reportRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setReport(null);
    api.get('/reports/daily').then(r => { if (active) setReport(r.data); }).catch(err => { if (active) setError(err.response?.data?.message || 'Could not load daily report.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [location.key, refresh]);
  // Roll over to the new Pakistan day even when this page is left open overnight.
  useEffect(() => {
    const now = Date.now();
    const day = new Date(now + 18000000).toISOString().slice(0, 10);
    const next = new Date(`${day}T00:00:00+05:00`).getTime() + 86400000;
    const timer = setTimeout(() => setRefresh(value => value + 1), next - now + 100);
    return () => clearTimeout(timer);
  }, [refresh, location.key]);
  return <Layout wide title="Daily Report" subtitle="Today's activity so far · Pakistan time" headerAction={<div className="no-print flex flex-wrap gap-2">
      <button onClick={() => setRefresh(value => value + 1)} disabled={loading || exporting} className="rounded-xl border bg-white px-4 py-3 font-semibold disabled:opacity-40">{loading ? 'Refreshing…' : 'Refresh report'}</button>
      <button disabled={!report || loading || exporting} onClick={() => { setExportError(''); try { printDailyReport(reportRef.current); } catch (err) { setExportError(err.message); } }} className="rounded-xl border bg-white px-4 py-3 font-semibold disabled:opacity-40">Print</button>
      <button disabled={!report || loading || exporting} onClick={async () => { setExporting(true); setExportError(''); try { await downloadDailyReport(report); } catch { setExportError('Could not download PDF. Please try again.'); } finally { setExporting(false); } }} className="rounded-xl bg-brand-dark px-4 py-3 font-semibold text-white disabled:opacity-40">{exporting ? 'Creating PDF…' : 'Download PDF'}</button>
    </div>}>
    {exportError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-red-700">{exportError}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {loading && <p role="status" className="p-4">Generating today's report…</p>}
    {report && <div ref={reportRef}>
      <p className="mb-5 text-sm text-slate-600"><b>{new Date(`${report.date}T12:00:00+05:00`).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' })}</b> · {report.scope} · As of {time(report.generatedAt)}</p>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Net sales revenue', money(report.summary.revenue)], ...(report.canViewProfit ? [['Gross profit', money(report.summary.profit)]] : []),
        ['Received on today’s bills', money(report.summary.receivedAtSale)], ['Due on bills at checkout', money(report.summary.dueAtSale)],
        ['Bills', report.summary.bills], ['Discounts', money(report.summary.discounts)],
        ['Returns / refunds today', money(report.summary.refunds)], ['Khata collections today', money(report.khataCollections)]
      ].map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-5 shadow-soft"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div>
      {report.canViewProfit && report.summary.missingCostItems > 0 && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Profit excludes {report.summary.missingCostItems} sale/return item(s) without recorded purchase costs. Revenue includes them.</p>}
      <h3 className="mb-2 text-xl font-bold">Products sold and stock</h3>
      <p className="mb-3 text-sm text-slate-500">Opening and current closing stock include the main store and all warehouses. Purchases, receipts, returns, and stock changes are reflected in current closing stock. Sales quantities follow this report's scope.</p>
      {!report.openingStockAvailable && <p className="mb-3 text-sm text-amber-800">Opening stock tracking was enabled during today. Earlier opening quantities cannot be verified and show “Not recorded”; full-day tracking begins tomorrow.</p>}
      <div className="mb-7 overflow-x-auto rounded-2xl border bg-white"><table className={tableClass}><thead className="bg-slate-50"><tr>{['Product', 'Part no.', 'Opening qty', 'Sold qty', 'Returned qty', 'Closing qty (now)', 'Net sales', ...(report.canViewProfit ? ['Gross profit'] : [])].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{report.products.map(row => <tr key={row.product} className="border-t"><td>{row.partName}</td><td>{row.partCode}</td><td>{row.opening ?? 'Not recorded'}</td><td>{row.sold}</td><td>{row.returned}</td><td>{row.closing ?? 'Not recorded'}</td><td>{money(row.revenue)}</td>{report.canViewProfit && <td>{row.missingCost ? `${money(row.profit)} (recorded costs only)` : money(row.profit)}</td>}</tr>)}{!report.products.length && <tr><td colSpan={report.canViewProfit ? 8 : 7} className="text-center">No products sold or returned today.</td></tr>}</tbody></table></div>
      <h3 className="mb-2 text-xl font-bold">Sales, customers and payments</h3>
      <p className="mb-3 text-sm text-slate-500">Payments and bill dues show the amounts at checkout. Pending khata is the customer's current total balance across all bills; it repeats when the same customer has multiple receipts. Khata payments collected separately are listed below.</p>
      <div className="mb-7 overflow-x-auto rounded-2xl border bg-white"><table className={tableClass}><thead className="bg-slate-50"><tr>{['Receipt / time', 'Customer', 'Sold by', 'Products / quantities / selling price', 'Bill total', 'Payment', 'Paid at checkout', 'Bill due at checkout', 'Current pending khata'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{report.sales.map(sale => <tr key={sale._id} className="border-t align-top"><td>{sale.receiptNo}<span className="block text-xs text-slate-500">{time(sale.createdAt)}</span></td><td>{sale.customer?.name || sale.customerName || 'Walk-in Customer'}{sale.customer?.phone && <span className="block text-xs text-slate-500">{sale.customer.phone}</span>}</td><td>{sale.soldBy?.name || sale.soldBy?.username || '—'}</td><td>{sale.items.map((item, index) => <div key={index} className="mb-2"><b>{item.partName}</b><span className="block text-xs text-slate-600">{item.partCode} · {item.qty} × {money(item.price)} · Discount {money(item.discount)} · Total {money(item.lineTotal)}</span></div>)}</td><td>{money(sale.grandTotal)}</td><td>{sale.paymentStatus === 'partial' ? 'Partially paid' : sale.paymentStatus === 'unpaid' ? 'Unpaid' : 'Fully paid'}</td><td>{money(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.grandTotal : 0))}</td><td>{money(sale.dueAmount)}</td><td>{sale.customer ? money(sale.customer.currentBalance) : '—'}</td></tr>)}{!report.sales.length && <tr><td colSpan="9" className="text-center">No sales today.</td></tr>}</tbody></table></div>
      <h3 className="mb-3 text-xl font-bold">Khata payments collected today</h3>
      <div className="mb-7 overflow-x-auto rounded-2xl border bg-white"><table className={tableClass}><thead className="bg-slate-50"><tr><th>Time</th><th>Customer</th><th>Received</th><th>Current pending khata</th></tr></thead><tbody>{report.payments.map(payment => <tr key={payment._id} className="border-t"><td>{time(payment.createdAt)}</td><td>{payment.customer?.name || 'Deleted customer'}</td><td>{money(payment.credit)}</td><td>{payment.customer ? money(payment.customer.currentBalance) : '—'}</td></tr>)}{!report.payments.length && <tr><td colSpan="4" className="text-center">No separate khata payments collected today.</td></tr>}</tbody></table></div>
      <h3 className="mb-3 text-xl font-bold">Returns processed today</h3>
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className={tableClass}><thead className="bg-slate-50"><tr><th>Receipt</th><th>Product</th><th>Customer</th><th>Quantity</th><th>Refund / credit</th></tr></thead><tbody>{report.returns.map(row => <tr key={row._id} className="border-t"><td>{row.receiptNo}</td><td>{row.partName}</td><td>{row.customerName || 'Walk-in Customer'}</td><td>{row.qty}</td><td>{money(row.amountRefunded)}</td></tr>)}{!report.returns.length && <tr><td colSpan="5" className="text-center">No returns today.</td></tr>}</tbody></table></div>
    </div>}
  </Layout>;
}
