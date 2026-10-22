import test from 'node:test';
import assert from 'node:assert/strict';
import DailyStock from '../src/models/DailyStock.js';
import { captureSaleOpenings } from '../src/utils/dailyStock.js';

test('daily openings batch missing products and leave existing openings unchanged', async t => {
  const originals = { find: DailyStock.find, bulkWrite: DailyStock.bulkWrite };
  t.after(() => Object.assign(DailyStock, originals));
  const session = {};
  let writes = 0;
  let readSession;
  DailyStock.find = () => ({ select() { return this; }, session(value) { readSession = value; return this; }, lean: async () => [{ product: 'existing' }] });
  DailyStock.bulkWrite = async (operations, options) => {
    writes++;
    assert.equal(options.session, session);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].updateOne.filter.product, 'new');
    assert.equal(operations[0].updateOne.update.$setOnInsert.opening, 15);
    assert.equal(operations[0].updateOne.update.$setOnInsert.reliable, true);
  };
  const products = [{ _id: 'existing', quantity: 99 }, { _id: 'new', quantity: 10, createdAt: new Date(0) }];
  await captureSaleOpenings(products, [{ product: 'new', quantity: 5 }], { startedAt: new Date(0) }, session);
  assert.equal(writes, 1);
  assert.equal(readSession, session);
  await captureSaleOpenings([products[0]], [], { startedAt: new Date(0) }, session);
  assert.equal(writes, 1);
});
