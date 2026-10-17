import test from 'node:test';
import assert from 'node:assert/strict';
import { planFifo, returnedCosts } from '../src/utils/stockCost.js';
import Sale from '../src/models/Sale.js';
import StockBatch from '../src/models/StockBatch.js';

const batches = [
  { _id: 'old', remaining: 3, unitCost: 2000, estimated: false },
  { _id: 'new', remaining: 10, unitCost: 2100, estimated: false }
];
test('FIFO keeps both purchase costs and splits a sale across batches', () => {
  const allocations = planFifo(batches, 5);
  assert.deepEqual(allocations.map(a => [a.batch, a.qty, a.unitCost]), [['old', 3, 2000], ['new', 2, 2100]]);
  const cost = allocations.reduce((sum, a) => sum + a.qty * a.unitCost, 0);
  assert.equal(5 * 2200 - cost, 800);
  assert.equal(batches[0].remaining, 3); // planning cannot mutate purchase records
});
test('changing selling price changes profit without changing purchase costs', () => {
  const allocations = planFifo(batches, 5);
  assert.equal(5 * 2150 - allocations.reduce((sum, a) => sum + a.qty * a.unitCost, 0), 550);
  assert.equal(batches[0].unitCost, 2000);
  assert.equal(batches[1].unitCost, 2100);
});
test('subsequent sales use the next remaining batch', () => {
  const allocations = planFifo([{ ...batches[0], remaining: 0 }, batches[1]], 10);
  assert.equal(allocations.length, 1);
  assert.equal(10 * 2200 - allocations[0].qty * allocations[0].unitCost, 1000);
});
test('partial returns reverse original costs across purchase boundaries', () => {
  const allocations = planFifo(batches, 5);
  const restored = returnedCosts(allocations, 2, 2);
  assert.deepEqual(restored.map(a => [a.qty, a.unitCost]), [[1, 2000], [1, 2100]]);
  assert.equal(restored.reduce((sum, a) => sum + a.qty * a.unitCost, 0), 4100);
  assert.throws(() => returnedCosts(allocations, 4, 2));
});
test('FIFO rejects overselling and invalid quantities', () => {
  for (const qty of [14, -1, 1.5, NaN]) assert.throws(() => planFifo(batches, qty));
  assert.deepEqual(planFifo(batches, 0), []);
});
test('opening cost estimates propagate into sale allocations', () => {
  assert.equal(planFifo([{ ...batches[0], estimated: true }], 1)[0].estimated, true);
});
test('sale snapshots persist costs without changing product records', async () => {
  const sale = new Sale({ receiptNo: 'TEST', items: [{ product: '000000000000000000000001', qty: 1, price: 2200, lineTotal: 2200, costTotal: 2100, costEstimated: false, costAllocations: [{ batch: '000000000000000000000002', qty: 1, unitCost: 2100, estimated: false }] }] });
  await sale.validate();
  assert.equal(sale.toObject().items[0].costAllocations[0].unitCost, 2100);
  assert.equal(sale.toObject().items[0].costTotal, 2100);
});
test('batch schema rejects negative costs and keeps storage locations distinct', async () => {
  const batch = new StockBatch({ product: '000000000000000000000001', quantity: 10, remaining: 10, unitCost: -1, source: 'purchase' });
  await assert.rejects(batch.validate());
  batch.unitCost = 2100;
  await batch.validate();
  assert.equal(batch.warehouse, null);
  batch.warehouse = '000000000000000000000003';
  assert.equal(String(batch.warehouse), '000000000000000000000003');
});

test('FIFO consumption reconciles existing stock before consuming and persists decrements', async t => {
  const { consumeFifo } = await import('../src/utils/stockCost.js');
  const originals = { find: StockBatch.find, findOne: StockBatch.findOne, create: StockBatch.create, updateOne: StockBatch.updateOne };
  t.after(() => Object.assign(StockBatch, originals));
  const records = [{ _id: 'new', quantity: 10, remaining: 10, unitCost: 2100, estimated: false }];
  const writes = [];
  StockBatch.find = () => ({ sort: () => ({ session: () => Object.assign(Promise.resolve([...records]), { lean: async () => [...records] }) }) });
  StockBatch.findOne = () => ({ session: async () => records[0] });
  StockBatch.create = async rows => { const row = { ...rows[0], _id: 'opening' }; records.unshift(row); return [row]; };
  StockBatch.updateOne = async (filter, update) => { writes.push([filter._id, update.$inc.remaining]); return { modifiedCount: 1 }; };
  const result = await consumeFifo({ _id: 'product', bookingPrice: 2000 }, null, 13, 5, {});
  assert.deepEqual(result.map(a => [a.qty, a.unitCost]), [[3, 2000], [2, 2100]]);
  assert.deepEqual(writes, [['opening', -3], ['new', -2]]);
  assert.equal(records[0].estimated, true);
});
test('FIFO aborts when concurrent stock update prevents a decrement', async t => {
  const { consumeFifo } = await import('../src/utils/stockCost.js');
  const originals = { find: StockBatch.find, updateOne: StockBatch.updateOne };
  t.after(() => Object.assign(StockBatch, originals));
  StockBatch.find = () => ({ sort: () => ({ session: () => Object.assign(Promise.resolve(batches), { lean: async () => batches }) }) });
  StockBatch.updateOne = async () => ({ modifiedCount: 0 });
  await assert.rejects(consumeFifo({ _id: 'product' }, null, 13, 1, {}), /Stock changed/);
});
