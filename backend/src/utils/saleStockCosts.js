import mongoose from 'mongoose';
import StockBatch from '../models/StockBatch.js';
import { planFifo } from './stockCost.js';
import { serializeProduct } from './productLegacy.js';

// Plan all item costs from one read and persist all layers in one write.
// A new instance is built on every transaction retry; nothing leaks from an abort.
export function planSaleCosts(existingBatches, makeId = () => new mongoose.Types.ObjectId()) {
  const groups = new Map();
  const originals = new Map();
  const inserted = new Set();
  const keyFor = (product, warehouse) => `${product}:${warehouse || 'shop'}`;
  for (const row of existingBatches) {
    const batch = { ...row };
    const key = keyFor(batch.product, batch.warehouse);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(batch);
    originals.set(String(batch._id), batch.remaining);
  }
  return {
    consume(product, warehouse, stock, qty) {
      const key = keyFor(product._id, warehouse);
      const batches = groups.get(key) || [];
      groups.set(key, batches);
      const tracked = batches.reduce((sum, batch) => sum + batch.remaining, 0);
      if (stock > tracked) {
        const unitCost = Number(serializeProduct(product).bookingPrice || 0);
        if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error('Set a valid booking price for existing stock');
        const batch = { _id: makeId(), product: product._id, warehouse: warehouse || null,
          quantity: stock - tracked, remaining: stock - tracked, unitCost, source: 'opening', estimated: true,
          purchasedAt: batches.length ? new Date() : new Date(0) };
        batches.push(batch);
        inserted.add(String(batch._id));
      } else if (tracked > stock) {
        let excess = tracked - stock;
        for (const batch of [...batches].reverse()) {
          const removed = Math.min(excess, batch.remaining);
          batch.remaining -= removed;
          excess -= removed;
          if (!excess) break;
        }
      }
      const allocations = planFifo(batches, qty);
      for (const allocation of allocations) {
        const batch = batches.find(row => String(row._id) === String(allocation.batch));
        batch.remaining -= allocation.qty;
      }
      return allocations;
    },
    operations() {
      return [...groups.values()].flat().flatMap(batch => {
        if (inserted.has(String(batch._id))) return [{ insertOne: { document: batch } }];
        const original = originals.get(String(batch._id));
        if (batch.remaining === original) return [];
        return [{ updateOne: { filter: { _id: batch._id, remaining: original }, update: { $set: { remaining: batch.remaining } } } }];
      });
    },
    async flush(session) {
      const operations = this.operations();
      if (!operations.length) return;
      const result = await StockBatch.bulkWrite(operations, { session, ordered: true });
      const updates = operations.filter(operation => operation.updateOne).length;
      if (result.modifiedCount !== updates) throw new Error('Stock changed. Please retry this sale.');
    }
  };
}
