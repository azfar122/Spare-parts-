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
  const context = vm.createContext({});
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
  const context = vm.createContext({});
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
