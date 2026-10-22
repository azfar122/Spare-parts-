import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import mongoose from 'mongoose';
import { heldBillId, heldSaleId, normalizeHeldBill, serializeHeldBill } from '../src/utils/heldBills.js';

function setup() {
  const rows = new Map();
  const completed = new Set();
  const routes = {};
  const router = { use() {}, ...Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (path, callback) => { routes[`${method} ${path}`] = callback; }])) };
  const query = getter => ({ session() { return this; }, lean: async () => getter(), sort() { return this; }, then(resolve, reject) { return Promise.resolve(getter()).then(resolve, reject); } });
  const own = filter => { const row = rows.get(String(filter._id)); return row?.owner === filter.owner ? row : null; };
  const context = vm.createContext({
    express: { Router: () => router }, requireAuth() {}, requireRole() {},
    mongoose: { isValidObjectId: mongoose.isValidObjectId, startSession: async () => ({ withTransaction: async callback => callback(), endSession: async () => {} }) },
    heldBillId, heldSaleId, normalizeHeldBill, serializeHeldBill,
    Sale: { exists: filter => query(() => completed.has(`${filter.soldBy}:${filter._id}`)) },
    HeldBill: {
      find: filter => query(() => [...rows.values()].filter(row => row.owner === filter.owner)),
      findOne: filter => query(() => own(filter)),
      async findOneAndUpdate(filter, update, options) {
        const previous = own(filter);
        if (!previous && !options.upsert) return null;
        const row = previous || { _id: filter._id, createdAt: new Date(), ...update.$setOnInsert };
        Object.assign(row, update.$set || {});
        rows.set(String(row._id), row);
        return row;
      },
      async deleteOne(filter) { if (own(filter)) rows.delete(String(filter._id)); }
    }
  });
  const source = fs.readFileSync(new URL('../src/routes/heldBillRoutes.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default router;', ''), context);
  async function request(method, path, body = {}, owner = 'sales-1', id) {
    let status = 200;
    let data;
    await routes[`${method} ${path}`]({ body, user: { _id: owner }, params: { id } }, { status(code) { status = code; return this; }, json(value) { data = value; return this; } });
    return { status, data };
  }
  return { rows, completed, request };
}
const snapshot = price => ({ id: 'browser-held-id-123', cart: [{ productId: '000000000000000000000001', qty: 1, price }] });

test('held bills are persisted and retries reuse the same database record', async () => {
  const app = setup();
  const first = await app.request('post', '/', snapshot(339195));
  assert.equal(first.data.bill.totals.total, 339195);
  const second = await app.request('post', '/', snapshot(339200));
  assert.equal(first.data.bill.id, second.data.bill.id);
  assert.equal(second.data.bill.totals.total, 339200);
  assert.equal(app.rows.size, 1);
  const listed = await app.request('get', '/');
  assert.equal(listed.data.items.length, 1);
});
test('legacy migration cannot overwrite a newer database snapshot', async () => {
  const app = setup();
  const first = await app.request('post', '/', snapshot(339195));
  await app.request('put', '/:id', snapshot(340000), 'sales-1', first.data.bill.id);
  const migrated = await app.request('post', '/', { ...snapshot(339195), importLegacy: true });
  assert.equal(migrated.data.bill.totals.total, 340000);
  assert.equal(app.rows.size, 1);
});
test('a different salesperson cannot see, update or delete another held bill', async () => {
  const app = setup();
  const { data } = await app.request('post', '/', snapshot(339195));
  const id = data.bill.id;
  assert.equal((await app.request('get', '/', {}, 'sales-2')).data.items.length, 0);
  assert.equal((await app.request('get', '/:id', {}, 'sales-2', id)).status, 404);
  assert.equal((await app.request('put', '/:id', snapshot(1), 'sales-2', id)).status, 404);
  await app.request('delete', '/:id', {}, 'sales-2', id);
  assert.equal(app.rows.size, 1);
});
test('a delayed save or migration cannot recreate a hold whose receipt is committed', async () => {
  const app = setup();
  const first = await app.request('post', '/', snapshot(339195));
  const id = first.data.bill.id;
  app.completed.add(`sales-1:${heldSaleId('sales-1', id)}`);
  app.rows.delete(id);
  const migrated = await app.request('post', '/', { ...snapshot(339195), importLegacy: true });
  assert.equal(migrated.data.completed, true);
  assert.equal((await app.request('put', '/:id', snapshot(339195), 'sales-1', id)).data.completed, true);
  assert.equal(app.rows.size, 0);
});
