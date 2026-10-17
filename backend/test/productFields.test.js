import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Product from '../src/models/Product.js';
import { serializeProduct, productSearchConditions } from '../src/utils/productLegacy.js';
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
