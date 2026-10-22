import test from 'node:test';
import assert from 'node:assert/strict';
import { planSaleCosts } from '../src/utils/saleStockCosts.js';
import StockBatch from '../src/models/StockBatch.js';

const product = { _id: 'p1', bookingPrice: 40 };
const batch = (_id, remaining, unitCost, warehouse = null) => ({ _id, product: 'p1', warehouse, remaining, unitCost, estimated: false });

test('batched sale costs preserve FIFO allocations and keep input snapshots unchanged', () => {
  const original = [batch('a', 3, 10), batch('b', 10, 20)];
  const costs = planSaleCosts(original);
  const result = costs.consume(product, null, 13, 5);
  assert.deepEqual(result.map(row => [row.qty, row.unitCost]), [[3, 10], [2, 20]]);
  assert.deepEqual(original.map(row => row.remaining), [3, 10]);
  assert.deepEqual(costs.operations().map(row => row.updateOne.update.$set.remaining), [0, 8]);
});
test('manual stock increases create an estimated opening layer after existing FIFO stock', () => {
  const costs = planSaleCosts([batch('a', 3, 10)], () => 'new');
  const result = costs.consume(product, null, 5, 4);
  assert.deepEqual(result.map(row => [row.qty, row.unitCost]), [[3, 10], [1, 40]]);
  const inserted = costs.operations().find(row => row.insertOne).insertOne.document;
  assert.equal(inserted.quantity, 2);
  assert.equal(inserted.remaining, 1);
  assert.equal(inserted.estimated, true);
});
test('manual reductions remove newest costs, warehouse layers stay separate', () => {
  const costs = planSaleCosts([batch('a', 3, 10), batch('b', 10, 20), batch('w', 5, 30, 'warehouse')]);
  assert.deepEqual(costs.consume(product, null, 5, 4).map(row => [row.qty, row.unitCost]), [[3, 10], [1, 20]]);
  assert.deepEqual(costs.consume(product, 'warehouse', 5, 2).map(row => [row.qty, row.unitCost]), [[2, 30]]);
  assert.deepEqual(costs.operations().map(row => row.updateOne.update.$set.remaining), [0, 1, 3]);
});
test('new stock is estimated and a failed attempt cannot contaminate a retry', () => {
  const initial = [batch('a', 5, 10)];
  const first = planSaleCosts(initial);
  first.consume(product, null, 5, 4);
  const retry = planSaleCosts(initial);
  assert.equal(retry.consume(product, null, 5, 4)[0].qty, 4);
  const opening = planSaleCosts([], () => 'opening');
  assert.equal(opening.consume(product, null, 10, 3)[0].estimated, true);
  assert.equal(opening.operations()[0].insertOne.document.remaining, 7);
});
test('all changed FIFO layers flush in one transactional bulk write', async t => {
  const original = StockBatch.bulkWrite;
  t.after(() => { StockBatch.bulkWrite = original; });
  let writes = 0;
  const session = {};
  StockBatch.bulkWrite = async (operations, options) => {
    writes++;
    assert.equal(options.session, session);
    assert.equal(operations.length, 2);
    return { modifiedCount: 2 };
  };
  const costs = planSaleCosts([batch('a', 3, 10), batch('b', 10, 20)]);
  costs.consume(product, null, 13, 5);
  await costs.flush(session);
  assert.equal(writes, 1);
  StockBatch.bulkWrite = async () => ({ modifiedCount: 0 });
  await assert.rejects(costs.flush(session), /Stock changed/);
});
