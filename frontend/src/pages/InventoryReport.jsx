import { useEffect, useRef, useState } from 'react';
import { Download, Printer, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import AppNotice from '../components/AppNotice.jsx';
import { LoadingState } from '../components/Loader.jsx';
import { api } from '../api/client.js';
import { printDailyReport } from '../utils/dailyReportExport.js';
import { downloadInventoryReport, inventoryHeaders, inventoryRows, inventoryTimestamp } from '../utils/inventoryReportExport.js';

export default function InventoryReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState(null);
  const content = useRef(null);

  async function fetchInventory() {
    setLoading(true);
    setNotice(null);
    setReport(null);
    try {
      const { data } = await api.get('/products', { params: { all: 'true', includeWarehouseStock: 'true' } });
      setReport({ products: data.items, generatedAt: new Date() });
    } catch (err) {
      setNotice({ type: 'error', title: 'Inventory Failed', message: err.response?.data?.message || err.message });
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchInventory(); }, []);

  async function download() {
    setDownloading(true);
    try { await downloadInventoryReport(report.products, report.generatedAt); }
    catch (err) { setNotice({ type: 'error', title: 'Download Failed', message: err.message }); }
    finally { setDownloading(false); }
  }

  function print() {
    try { printDailyReport(content.current, 'Asif Auto Traders - Inventory List'); }
    catch (err) { setNotice({ type: 'error', title: 'Print Failed', message: err.message }); }
  }

  const buttonClass = 'inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 font-semibold disabled:opacity-50';
  return <Layout title="Fetch Inventory List" subtitle="Full saved inventory with retail, wholesale and booking prices. Print on A4 landscape or download a PDF." wide>
    <AppNotice notice={notice} onClose={() => setNotice(null)} />
    <div className="no-print mb-5 flex flex-wrap gap-3">
      <button type="button" onClick={fetchInventory} disabled={loading || downloading} className={buttonClass}><RefreshCw size={18} />{loading ? 'Fetching...' : 'Fetch Latest Inventory'}</button>
      <button type="button" onClick={print} disabled={!report || loading} className={buttonClass}><Printer size={18} />Print Inventory List</button>
      <button type="button" onClick={download} disabled={!report || loading || downloading} className={buttonClass}><Download size={18} />{downloading ? 'Downloading...' : 'Download PDF'}</button>
    </div>
    {loading && <LoadingState label="Fetching full inventory..." />}
    {report && <div ref={content}>
      <p className="mb-4 text-sm text-slate-600">Fetched: {inventoryTimestamp(report.generatedAt)} (Pakistan time) · {report.products.length} products · Prices in PKR</p>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr>{inventoryHeaders.map(label => <th key={label} scope="col" className="p-3 text-left">{label}</th>)}</tr></thead>
          <tbody>{inventoryRows(report.products).map((row, index) => <tr key={report.products[index]._id} className="border-t">{row.map((value, column) => <td key={column} className="p-3">{value}</td>)}</tr>)}</tbody>
        </table>
        {!report.products.length && <p className="p-6 text-center text-slate-500">No products in inventory.</p>}
      </div>
    </div>}
  </Layout>;
}
