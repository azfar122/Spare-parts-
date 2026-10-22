import DailyStock, { StockTracking } from '../models/DailyStock.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { productStock } from './productLegacy.js';

export function pakistanDay(now = new Date()) {
  const date = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { date, start: new Date(`${date}T00:00:00+05:00`), end: now };
}
export async function ensureStockTracking() {
  const existing = await StockTracking.findById('daily-stock');
  if (existing) return existing;
  return StockTracking.findOneAndUpdate({ _id: 'daily-stock' }, { $setOnInsert: { startedAt: new Date() } }, { upsert: true, returnDocument: 'after' });
}
// Capture only missing openings, using the same stock snapshot as the sale.
export async function captureSaleOpenings(products, warehouseRows, tracking, session) {
  const { date, start } = pakistanDay();
  const existing = await DailyStock.find({ day: date, product: { $in: products.map(product => product._id) } }).select('product').session(session).lean();
  const captured = new Set(existing.map(row => String(row.product)));
  const warehouseTotals = new Map();
  for (const row of warehouseRows) warehouseTotals.set(String(row.product), (warehouseTotals.get(String(row.product)) || 0) + Number(row.quantity || 0));
  const operations = products.filter(product => !captured.has(String(product._id))).map(product => {
    const createdDuringTracking = product.createdAt >= start && product.createdAt >= tracking.startedAt;
    return { updateOne: {
      filter: { day: date, product: product._id },
      update: { $setOnInsert: {
        opening: createdDuringTracking ? 0 : productStock(product) + (warehouseTotals.get(String(product._id)) || 0),
        reliable: tracking.startedAt <= start || createdDuringTracking
      } }, upsert: true
    } };
  });
  if (operations.length) await DailyStock.bulkWrite(operations, { session, ordered: true });
}
export async function captureDailyOpening(product, session = null, isNew = false) {
  const { date, start } = pakistanDay();
  const tracking = await ensureStockTracking();
  const warehouseRows = await WarehouseStock.find({ product: product._id }).session(session).lean();
  const createdDuringTracking = product.createdAt >= start && product.createdAt >= tracking.startedAt;
  const opening = isNew || createdDuringTracking ? 0 : productStock(product) + warehouseRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  await DailyStock.updateOne({ day: date, product: product._id }, { $setOnInsert: {
    opening, reliable: isNew || tracking.startedAt <= start || createdDuringTracking
  } }, { upsert: true, session });
}
