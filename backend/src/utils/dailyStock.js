import DailyStock, { StockTracking } from '../models/DailyStock.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { productStock } from './productLegacy.js';

export function pakistanDay(now = new Date()) {
  const date = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { date, start: new Date(`${date}T00:00:00+05:00`), end: now };
}
export async function ensureStockTracking() {
  return StockTracking.findOneAndUpdate({ _id: 'daily-stock' }, { $setOnInsert: { startedAt: new Date() } }, { upsert: true, new: true });
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
