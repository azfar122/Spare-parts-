import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import mongoose from 'mongoose';
import { ClientSession, MongoServerError } from 'mongodb';
import { createHash } from 'node:crypto';
import { planSaleCosts } from '../src/utils/saleStockCosts.js';
import { heldSaleId } from '../src/utils/heldBills.js';
import { productLabel, productPrice, productStock, productStockSet, serializeProduct } from '../src/utils/productLegacy.js';

const clone = value => JSON.parse(JSON.stringify(value));
function transient(code = 24) {
  return new MongoServerError({ message: 'Temporary lock conflict', code, errorLabels: ['TransientTransactionError'] });
}
function setup({ failure, size = 1, warehouse = false, customer = false, held = false } = {}) {
  const ids = Array.from({ length: size }, (_, index) => (index + 1).toString(16).padStart(24, '0'));
  const warehouseId = 'ffffffffffffffffffffffff';
  let db = { products: ids.map(_id => ({ _id, partName: 'Part', partCode: _id, quantity: warehouse ? 1 : 20, mrp: 100 })),
    warehouses: warehouse ? [{ _id: 'warehouse-stock', product: ids[0], warehouse: { _id: warehouseId, name: 'Warehouse' }, quantity: 10 }] : [],
    balance: 0, ledger: [], sales: [], held: held ? [{ _id: 'eeeeeeeeeeeeeeeeeeeeeeee', owner: 'user' }] : [] };
  let staged;
  let fail = failure;
  let attempts = 0;
  let writes = 0;
  let reads = 0;
  let committed = false;
  let handler;
  let options;
  let effects = 0;
  const session = {
    clientOptions: { serverSelectionTimeoutMS: 8000, socketTimeoutMS: 0 },
    transaction: { state: 'NO_TRANSACTION' },
    startTransaction() { attempts++; committed = false; staged = clone(db); this.transaction.state = 'TRANSACTION_IN_PROGRESS'; },
    async abortTransaction() { staged = null; this.transaction.state = 'TRANSACTION_ABORTED'; },
    async commitTransaction() {
      if (fail === 'before-commit') { fail = null; throw transient(251); }
      if (!committed) { db = staged; committed = true; }
      if (fail === 'commit') {
        fail = null;
        throw new MongoServerError({ message: 'Lost commit response', errorLabels: ['UnknownTransactionCommitResult'] });
      }
      this.transaction.state = 'TRANSACTION_COMMITTED';
    },
    async endSession() {},
    async withTransaction(callback, suppliedOptions) {
      options = suppliedOptions;
      return ClientSession.prototype.withTransaction.call(this, callback, suppliedOptions);
    }
  };
  const query = getter => ({
    session() { return this; }, lean: async () => { reads++; return clone(getter()); },
    populate() { return this; }, sort() { return this; },
    then(resolve, reject) { reads++; return Promise.resolve(getter()).then(resolve, reject); }
  });
  const Sale = {
    findOne(filter) { return query(() => {
      const row = (staged || db).sales.find(sale => String(sale._id) === String(filter._id));
      return row ? { ...row, toObject: () => clone(row) } : null;
    }); },
    async create([document]) {
      const row = clone(document);
      staged.sales.push(row);
      if (fail === 'after-create') { fail = null; throw transient(251); }
      return [{ toObject: () => row }];
    }
  };
  const context = vm.createContext({
    console: { error() {} }, express: { Router: () => ({ use() {}, get() {}, post(path, auth, callback) { handler = callback; } }) },
    mongoose: { isValidObjectId: mongoose.isValidObjectId, Types: mongoose.Types, startSession: async () => session },
    requireAuth() {}, requireRole: () => () => {}, createHash,
    ensureStockTracking: async () => ({}), captureSaleOpenings: async () => {},
    planSaleCosts: batches => { const costs = planSaleCosts(batches); costs.flush = async () => {}; return costs; },
    Customer: { findById: () => query(() => ({ _id: 'customer', name: 'Ali' })) },
    addLedgerEntry: async values => { staged.balance += values.debit - values.credit; staged.ledger.push({ debit: values.debit, credit: values.credit }); },
    productLabel, productPrice, productStock, productStockSet, serializeProduct, Sale,
    heldSaleId,
    HeldBill: {
      findOne(filter) { return query(() => staged.held.find(row => row._id === filter._id && row.owner === filter.owner)); },
      async deleteOne(filter, options) {
        assert.equal(options.session, session);
        const count = staged.held.length;
        staged.held = staged.held.filter(row => row._id !== filter._id || row.owner !== filter.owner);
        return { deletedCount: count - staged.held.length };
      }
    },
    WarehouseStock: { find: () => query(() => staged.warehouses), bulkWrite: async operations => {
      for (const op of operations) Object.assign(staged.warehouses.find(row => row._id === op.updateOne.filter._id), op.updateOne.update.$set);
    } },
    StockBatch: { find: () => query(() => ids.map(product => ({ _id: `batch-${product}`, product, warehouse: null, remaining: 20, unitCost: 50 }))) },
    Product: {
      find: () => query(() => staged.products),
      collection: { async bulkWrite(operations) {
        writes++;
        for (const op of operations) Object.assign(staged.products.find(row => row._id === String(op.updateOne.filter._id)), op.updateOne.update.$set || {});
        if (fail === 'lock') { fail = null; throw transient(); }
        if (fail === 'validation') throw new Error('Insufficient stock');
      } }
    }
  });
  const source = fs.readFileSync(new URL('../src/routes/saleRoutes.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default router;', ''), context);
  async function request() {
    let status = 200;
    let data;
    await handler({ user: { _id: 'user', name: 'Sales' }, body: { requestId: 'same-bill-request-123', ...(held ? { heldBillId: 'eeeeeeeeeeeeeeeeeeeeeeee' } : {}), ...(customer ? { customerId: 'customer', paymentStatus: 'partial', paidAmount: 50 } : {}), items: ids.map(productId => ({ productId, qty: 2, price: 100, ...(warehouse ? { warehouseAllocations: [{ warehouseId, qty: 1 }] } : {}) })) }, app: { get: () => ({ emit() { effects++; } }) } }, {
      status(code) { status = code; return this; }, json(body) { data = body; return this; }
    });
    return { status, data };
  }
  return { request, db: () => db, stats: () => ({ attempts, writes, reads, effects, options }) };
}

for (const failure of ['lock', 'after-create', 'commit']) {
  test(`checkout safely recovers from ${failure} without double stock deductions or bills`, async () => {
    const app = setup({ failure });
    const response = await app.request();
    assert.equal(response.status, 201);
    assert.equal(app.db().products[0].quantity, 18);
    assert.equal(app.db().sales.length, 1);
    assert.equal(app.stats().attempts, failure === 'commit' ? 1 : 2);
    assert.equal(app.stats().effects, 1);
    assert.equal(app.stats().options.timeoutMS, 45000);
  });
}
test('repeating the same bill request returns the existing receipt', async () => {
  const app = setup();
  const first = await app.request();
  const second = await app.request();
  assert.equal(first.data._id, second.data._id);
  assert.equal(app.db().sales.length, 1);
  assert.equal(app.db().products[0].quantity, 18);
  assert.equal(app.stats().writes, 1);
});
test('a 100-item bill batches inventory reads and stock updates', async () => {
  const app = setup({ size: 100 });
  assert.equal((await app.request()).status, 201);
  assert.equal(app.stats().writes, 1);
  assert.equal(app.stats().reads, 4);
  assert.ok(app.db().products.every(product => product.quantity === 18));
  assert.equal(app.db().sales[0].items.length, 100);
});
test('non-transient failures roll back stock and are not retried', async () => {
  const app = setup({ failure: 'validation' });
  assert.equal((await app.request()).status, 400);
  assert.equal(app.db().products[0].quantity, 20);
  assert.equal(app.db().sales.length, 0);
  assert.equal(app.stats().attempts, 1);
});
test('warehouse stock and partial customer balances are deducted only once after an abort', async () => {
  const app = setup({ warehouse: true, customer: true, failure: 'after-create' });
  assert.equal((await app.request()).status, 201);
  assert.equal(app.db().products[0].quantity, 0);
  assert.equal(app.db().warehouses[0].quantity, 9);
  assert.equal(app.db().sales[0].items[0].warehouseQtyUsed, 1);
  assert.equal(app.db().balance, 150);
  assert.equal(app.db().ledger.length, 1);
  await app.request();
  assert.equal(app.db().balance, 150);
  assert.equal(app.db().ledger.length, 1);
  assert.equal(app.db().warehouses[0].quantity, 9);
});
test('a held bill is deleted atomically with the receipt and remains on failure', async () => {
  const failed = setup({ held: true, failure: 'validation' });
  assert.equal((await failed.request()).status, 400);
  assert.equal(failed.db().held.length, 1);
  assert.equal(failed.db().sales.length, 0);
  const success = setup({ held: true, failure: 'before-commit' });
  const first = await success.request();
  assert.equal(first.status, 201);
  assert.equal(success.stats().attempts, 2);
  assert.equal(success.db().held.length, 0);
  assert.equal(success.db().sales.length, 1);
  const retry = await success.request();
  assert.equal(retry.data._id, first.data._id);
  assert.equal(success.db().sales.length, 1);
  assert.equal(success.db().products[0].quantity, 18);
});
