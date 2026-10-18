import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Product from '../src/models/Product.js';
import { serializeProduct, productSearchConditions, productPrice } from '../src/utils/productLegacy.js';
const removed = ['category', 'Category', 'type', 'Type', 'model', 'Model', 'description', 'Description'];
test('legacy products omit removed fields without changing prices or stock', () => {
  const product = serializeProduct({ partName: 'Brake', partCode: 'P1', brand: 'AHL', bookingPrice: 160, mrp: 180, wholesalePrice: 170, quantity: 10, ...Object.fromEntries(removed.map(key => [key, 'legacy'])) });
  for (const key of removed) assert.equal(Object.hasOwn(product, key), false);
  assert.equal(product.bookingPrice, 160);
  assert.equal(product.quantity, 10);
  for (const condition of productSearchConditions('brake')) assert.equal(removed.includes(Object.keys(condition)[0]), false);
});
test('product writes and duplicate checks ignore removed attributes', () => {
  const source = fs.readFileSync(new URL('../src/routes/productRoutes.js', import.meta.url), 'utf8');
  const context = vm.createContext({ serializeProduct });
  vm.runInContext(source.slice(source.indexOf('function normalizeProductPayload'), source.indexOf('function duplicateProductMessage')), context);
  const body = { partName: 'Brake', partCode: 'P1', brand: 'AHL', mrp: 180, bookingPrice: 160, ...Object.fromEntries(removed.map(key => [key, 'legacy'])) };
  for (const payload of [context.normalizeProductPayload(body), context.normalizeProductUpdate(body, body), context.duplicateProductQuery(body)]) {
    for (const key of removed) assert.equal(Object.hasOwn(payload, key), false);
  }
});
test('product schema no longer stores removed product fields', () => {
  for (const key of removed) assert.equal(Product.schema.path(key), undefined);
});
test('selling rate is separate from retail and falls back for older products', () => {
  assert.equal(productPrice({ mrp: 180 }), 180);
  const product = serializeProduct({ mrp: 180, sellingPrice: 150, bookingPrice: 100, wholesalePrice: 130 });
  assert.equal(productPrice(product), 150);
  assert.equal(product.mrp, 180);
  assert.equal(product.bookingPrice, 100);
  assert.equal(product.wholesalePrice, 130);
  assert.equal(productPrice({ mrp: 180, sellingPrice: 0 }), 0);
});
test('inventory edits can clear brand, rename legacy products and preserve zero prices', () => {
  const source = fs.readFileSync(new URL('../src/routes/productRoutes.js', import.meta.url), 'utf8');
  const context = vm.createContext({ serializeProduct });
  vm.runInContext(source.slice(source.indexOf('function normalizeProductPayload'), source.indexOf('function duplicateProductMessage')), context);
  const existing = { partName: 'Old', productName: 'Old', partCode: 'P1', partNo: 'P1', brand: 'Honda', mrp: 180, bookingPrice: 160, quantity: 12 };
  const update = context.normalizeProductUpdate({ partName: 'New', partCode: 'P2', brand: '', bookingPrice: 0 }, existing);
  const product = serializeProduct({ ...existing, ...update });
  assert.equal(product.partName, 'New');
  assert.equal(product.partCode, 'P2');
  assert.equal(product.brand, '');
  assert.equal(product.bookingPrice, 0);
  assert.equal(product.quantity, 12);
  assert.equal(serializeProduct({ bookingPrice: 100, mrp: 0 }).mrp, 0);
  assert.throws(() => context.normalizeProductUpdate({ partName: '' }, existing), /name is required/);
  assert.throws(() => context.normalizeProductUpdate({ partCode: '' }, existing), /code is required/);
  assert.throws(() => context.normalizeProductUpdate({ minOrderQty: 0 }, existing), /at least 1/);
});
test('editing one field does not create unrelated fields or new legacy aliases', () => {
  const source = fs.readFileSync(new URL('../src/routes/productRoutes.js', import.meta.url), 'utf8');
  const context = vm.createContext({ serializeProduct });
  vm.runInContext(source.slice(source.indexOf('function normalizeProductPayload'), source.indexOf('function duplicateProductMessage')), context);
  const existing = { partName: 'Brake', partCode: 'P1', bookingPrice: 100, mrp: 180, quantity: 10 };
  const update = context.normalizeProductUpdate({ bookingPrice: 120 }, existing);
  assert.deepEqual(JSON.parse(JSON.stringify(update)), { bookingPrice: 120 });
  const legacyUpdate = context.normalizeProductUpdate({ bookingPrice: 120 }, { ...existing, CCP: 100 });
  assert.deepEqual(JSON.parse(JSON.stringify(legacyUpdate)), { bookingPrice: 120, CCP: 120 });
  assert.equal(Object.hasOwn(legacyUpdate, 'CP'), false);
});
test('price-only edits accept legacy product names without requiring a new name', () => {
  const source = fs.readFileSync(new URL('../src/routes/productRoutes.js', import.meta.url), 'utf8');
  const context = vm.createContext({ serializeProduct });
  vm.runInContext(source.slice(source.indexOf('function normalizeProductPayload'), source.indexOf('function duplicateProductMessage')), context);
  for (const nameField of ['partName', 'productName', 'Product Name', 'Product name']) {
    const existing = { [nameField]: 'Brake', 'Part No.': 'P1', RP: 180 };
    const update = context.normalizeProductUpdate({ mrp: 200 }, existing);
    assert.deepEqual(JSON.parse(JSON.stringify(update)), { mrp: 200, RP: 200 });
    assert.equal(serializeProduct({ ...existing, ...update }).partName, 'Brake');
  }
  assert.doesNotThrow(() => context.normalizeProductUpdate({ mrp: 200 }, { partCode: 'P1', mrp: 180 }));
});
test('saving an inventory edit updates the same record without inserting a row', async () => {
  const source = fs.readFileSync(new URL('../src/routes/productRoutes.js', import.meta.url), 'utf8');
  const rows = [{ _id: 'existing-product', 'Product name': 'Brake', 'Part No.': 'P1', RP: 180, quantity: 10 }];
  let handler;
  let writes = 0;
  const router = {
    use() {}, get() {}, post() {}, delete() {},
    put(path, middleware, callback) { handler = callback; }
  };
  const context = vm.createContext({
    express: { Router: () => router },
    requireAuth() {}, requireRole: () => () => {},
    serializeProduct, captureDailyOpening: async () => {},
    Product: {
      findById(id) { return { lean: async () => rows.find(row => row._id === id) }; },
      findOne() { return { lean: async () => null }; },
      collection: {
        async updateOne(filter, update, options) {
          assert.equal(options?.upsert, undefined);
          const row = rows.find(item => item._id === filter._id);
          assert.ok(row);
          Object.assign(row, update.$set);
          writes += 1;
        }
      }
    }
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default router;', ''), context);
  let response;
  const res = { json(value) { response = value; }, status(code) { assert.fail(`Unexpected HTTP ${code}`); } };
  for (const mrp of [200, 220]) {
    await handler({ params: { id: 'existing-product' }, body: { mrp }, app: { get: () => ({ emit() {} }) } }, res);
    assert.equal(rows.length, 1);
    assert.equal(response._id, 'existing-product');
    assert.equal(response.partName, 'Brake');
    assert.equal(response.mrp, mrp);
  }
  assert.equal(writes, 2);
});
