import express from 'express';
import Sale from '../models/Sale.js';
import Return from '../models/Return.js';
import Product from '../models/Product.js';
import WarehouseStock from '../models/WarehouseStock.js';
import LedgerEntry from '../models/LedgerEntry.js';
import DailyStock from '../models/DailyStock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { pakistanDay, ensureStockTracking } from '../utils/dailyStock.js';
import { summarizeDaily } from '../utils/dailyReport.js';
import { serializeProduct } from '../utils/productLegacy.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'sales'));
router.get('/daily', async (req, res) => {
  try {
    const now = new Date();
    const { date, start } = pakistanDay(now);
    const tracking = await ensureStockTracking();
    const own = req.user.role === 'sales';
    const range = { $gte: start, $lte: now };
    const sales = await Sale.find({ createdAt: range, ...(own ? { soldBy: req.user._id } : {}) })
      .sort({ createdAt: -1 }).populate('customer', 'name phone currentBalance').populate('soldBy', 'name username').lean();
    let returns = await Return.find({ createdAt: range }).populate('sale', 'soldBy items').lean();
    if (own) returns = returns.filter(row => String(row.sale?.soldBy) === String(req.user._id));
    returns = returns.map(row => ({ ...row, costKnown: row.sale?.items?.find(item => String(item.product) === String(row.product))?.costTotal != null, sale: row.sale?._id }));
    const report = summarizeDaily(sales, returns);
    const ids = report.products.map(row => row.product);
    const [products, warehouseRows, snapshots, payments] = await Promise.all([
      Product.find({ _id: { $in: ids } }).lean(),
      WarehouseStock.find({ product: { $in: ids } }).lean(),
      DailyStock.find({ day: date, product: { $in: ids } }).lean(),
      LedgerEntry.find({ type: 'payment', createdAt: range, ...(own ? { createdBy: req.user._id } : {}) }).populate('customer', 'name phone currentBalance').lean()
    ]);
    const stockById = new Map(products.map(product => [String(product._id), serializeProduct(product)]));
    const openingById = new Map(snapshots.map(row => [String(row.product), row]));
    report.products = report.products.map(row => {
      const product = stockById.get(row.product);
      const warehouseQuantity = warehouseRows.filter(stock => String(stock.product) === row.product).reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
      const closing = product ? Number(product.quantity || 0) + warehouseQuantity : null;
      const snapshot = openingById.get(row.product);
      const opening = snapshot ? (snapshot.reliable ? snapshot.opening : null) : (tracking.startedAt <= start ? closing : null);
      return { ...row, opening, closing };
    });
    res.json({ ...report, date, generatedAt: now, timezone: 'Asia/Karachi', scope: own ? 'Your sales' : 'All shop sales', sales, returns, payments,
      khataCollections: payments.reduce((sum, entry) => sum + Number(entry.credit || 0), 0),
      openingStockAvailable: tracking.startedAt <= start
    });
  } catch (error) {
    console.error('Daily report failed:', error.name);
    res.status(500).json({ message: 'Could not generate the daily report. Please try again.' });
  }
});
export default router;
