import StockBatch from '../models/StockBatch.js';
import { serializeProduct } from './productLegacy.js';

// Plan separately so FIFO accounting can be verified without a live database.
export function planFifo(batches, qty) {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Invalid stock quantity');
  let remaining = qty;
  const allocations = [];
  for (const batch of batches) {
    const used = Math.min(remaining, batch.remaining);
    if (used > 0) allocations.push({ batch: batch._id, qty: used, unitCost: batch.unitCost, estimated: batch.estimated });
    remaining -= used;
    if (!remaining) break;
  }
  if (remaining) throw new Error('Insufficient costed stock');
  return allocations;
}

export async function reconcileBatches(product, warehouse, stock, session) {
  const filter = { product: product._id, warehouse: warehouse || null, remaining: { $gt: 0 } };
  const batches = await StockBatch.find(filter).sort({ purchasedAt: 1, _id: 1 }).session(session);
  const tracked = batches.reduce((sum, batch) => sum + batch.remaining, 0);
  if (stock > tracked) {
    const unitCost = Number(serializeProduct(product).bookingPrice || 0);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Set a valid booking price for existing stock');
    const previousBatch = await StockBatch.findOne({ product: product._id, warehouse: warehouse || null }).session(session);
    await StockBatch.create([{
      product: product._id, warehouse: warehouse || null, quantity: stock - tracked,
      remaining: stock - tracked, unitCost, source: 'opening', estimated: true,
      purchasedAt: previousBatch ? new Date() : new Date(0)
    }], { session });
  } else if (tracked > stock) {
    // Manual stock reductions remove newest layers; do not rewrite historical sales.
    let excess = tracked - stock;
    for (const batch of [...batches].reverse()) {
      const removed = Math.min(excess, batch.remaining);
      batch.remaining -= removed;
      await batch.save({ session });
      excess -= removed;
      if (!excess) break;
    }
  }
}

export async function consumeFifo(product, warehouse, stock, qty, session) {
  await reconcileBatches(product, warehouse, stock, session);
  const batches = await StockBatch.find({ product: product._id, warehouse: warehouse || null, remaining: { $gt: 0 } })
    .sort({ purchasedAt: 1, _id: 1 }).session(session).lean();
  const allocations = planFifo(batches, qty);
  for (const allocation of allocations) {
    const result = await StockBatch.updateOne({ _id: allocation.batch, remaining: { $gte: allocation.qty } }, { $inc: { remaining: -allocation.qty } }, { session });
    if (result.modifiedCount !== 1) throw new Error('Stock changed. Please retry this sale.');
  }
  return allocations;
}

export function returnedCosts(allocations, previousQty, qty) {
  let skip = previousQty;
  let left = qty;
  const result = [];
  for (const allocation of allocations) {
    const skipped = Math.min(skip, allocation.qty);
    skip -= skipped;
    const used = Math.min(left, allocation.qty - skipped);
    if (used > 0) result.push({ qty: used, unitCost: allocation.unitCost, estimated: allocation.estimated });
    left -= used;
    if (!left) break;
  }
  if (left) throw new Error('Return exceeds recorded cost allocations');
  return result;
}
