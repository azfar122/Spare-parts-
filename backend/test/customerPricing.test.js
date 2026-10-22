import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import mongoose from 'mongoose';
import { requireRole } from '../src/middleware/auth.js';
import { customerPricePipeline, productHistoryPipeline } from '../src/utils/customerPrices.js';
import { serializeProduct } from '../src/utils/productLegacy.js';
import { applyCustomerPrices } from '../../frontend/src/utils/customerPricing.js';

const malik = '000000000000000000000001';
const other = '000000000000000000000002';
const filterId = '000000000000000000000003';
const oilId = '000000000000000000000004';

function setup() {
  const sales = [{ customer: malik, date: 1, product: filterId, price: 110 }, { customer: other, date: 2, product: filterId, price: 90 }];
  const routes = {};
  const router = { use() {}, ...Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (path, authorize, handler) => { routes[`${method} ${path}`] = { authorize, handler }; }])) };
  let historyQuery;
  const context = vm.createContext({
    express: { Router: () => router }, mongoose, requireAuth() {}, requireRole, serializeProduct,
    customerPricePipeline, productHistoryPipeline,
    Customer: { exists: async () => true, findOne: () => ({ select: async () => ({ _id: new mongoose.Types.ObjectId(malik) }) }) },
    Product: { find: () => ({ lean: async () => [{ _id: filterId, mrp: 115 }, { _id: oilId, mrp: 200 }] }) },
    Sale: { aggregate: async pipeline => {
      const customer = String(pipeline[0].$match.customer);
      if (pipeline.some(stage => stage.$facet)) {
        historyQuery = pipeline;
        return [{ items: [{ saleId: 'sale', itemIndex: 0, date: '2026-01-01', price: 110 }], count: [{ total: 1 }] }];
      }
      const products = pipeline[0].$match['items.product'].$in.map(String);
      const matching = sales.filter(sale => sale.customer === customer && products.includes(sale.product)).sort((a, b) => b.date - a.date);
      const found = new Map();
      for (const sale of matching) if (!found.has(sale.product)) found.set(sale.product, { _id: sale.product, price: sale.price, soldAt: new Date(sale.date), receiptNo: `R-${sale.date}` });
      return [...found.values()];
    } }
  });
  const source = fs.readFileSync(new URL('../src/routes/customerRoutes.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export { addLedgerEntry };', '').replace('export default router;', ''), context);
  async function request(method, path, body = {}, role = 'sales', query = {}) {
    let status = 200;
    let data;
    let allowed = false;
    const req = { body, query, params: { id: malik }, user: { _id: 'sales-user', role } };
    const res = { status(value) { status = value; return this; }, json(value) { data = value; return this; } };
    routes[`${method} ${path}`].authorize(req, res, () => { allowed = true; });
    if (allowed) await routes[`${method} ${path}`].handler(req, res);
    return { status, data };
  }
  return { request, sales, historyQuery: () => historyQuery };
}

test('Malik defaults to 110, then 115 after his next completed sale; other customers stay separate', async () => {
  const { request, sales } = setup();
  const lookup = customerId => request('post', '/product-prices', { customerId, productIds: [filterId, oilId] });
  const first = await lookup(malik);
  assert.equal(first.data.items[0].price, 110);
  assert.equal(first.data.items[0].retailPrice, 115);
  assert.equal(first.data.items[1].price, 200);
  assert.equal(first.data.items[1].hasHistory, false);
  assert.equal((await lookup(other)).data.items[0].price, 90);
  sales.push({ customer: malik, date: 3, product: filterId, price: 115 });
  assert.equal((await lookup(malik)).data.items[0].price, 115);
  assert.equal((await lookup(other)).data.items[0].price, 90);
  sales.push({ customer: malik, date: 4, product: filterId, price: 0 });
  assert.equal((await lookup(malik)).data.items[0].price, 0);
  assert.equal((await lookup(undefined)).data.items[0].price, 115);
});

test('switching customers replaces the old customer rate, while manual and held prices for the same customer stay intact', () => {
  const prices = { [filterId]: { price: 110, retailPrice: 115, hasHistory: true } };
  const switched = applyCustomerPrices([{ productId: filterId, price: 90, priceCustomerId: other }], malik, prices);
  assert.equal(switched[0].price, 110);
  for (const priceSource of ['manual', 'held']) {
    const cart = [{ productId: filterId, price: 112, priceCustomerId: malik, priceSource }];
    assert.equal(applyCustomerPrices(cart, malik, prices), cart);
  }
  assert.equal(applyCustomerPrices(switched, null, { [filterId]: { price: 115, retailPrice: 115, hasHistory: false } })[0].price, 115);
});

test('sales staff can read product history but cannot edit customers or financial ledger entries', async () => {
  const { request, historyQuery } = setup();
  const result = await request('get', '/:id/product-history', {}, 'sales', { q: '[filter]', page: 2, limit: 50 });
  assert.equal(result.status, 200);
  assert.equal(result.data.items[0].price, 110);
  const pipeline = historyQuery();
  assert.equal(String(pipeline[0].$match.customer), malik);
  assert.ok(pipeline.find(stage => stage.$match?.$or).$match.$or[0]['items.partName'].test('[filter]'));
  const projection = pipeline.find(stage => stage.$facet).$facet.items.find(stage => stage.$project).$project;
  assert.equal(Object.keys(projection).some(key => /cost|profit/i.test(key)), false);
  for (const [method, path] of [['post', '/'], ['put', '/:id'], ['delete', '/:id'], ['post', '/:id/payment'], ['post', '/:id/adjustment']]) {
    assert.equal((await request(method, path)).status, 403);
  }
  assert.equal((await request('get', '/:id/product-history', {}, 'guest')).status, 403);
});

test('price lookup rejects invalid customer and product IDs', async () => {
  const { request } = setup();
  assert.equal((await request('post', '/product-prices', { customerId: 'bad', productIds: [filterId] })).status, 400);
  assert.equal((await request('post', '/product-prices', { customerId: malik, productIds: ['bad'] })).status, 400);
});
test('a late modal price lookup does not replace a manually entered rate', () => {
  const source = fs.readFileSync(new URL('../../frontend/src/pages/SalesDashboard.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  useEffect(() => {\n    if (!saleModalProduct || customerRates.loading');
  const end = source.indexOf('\n  async function load(', start);
  let price = '115';
  const manual = { current: true };
  const context = vm.createContext({
    saleModalProduct: { _id: filterId, mrp: 105 }, pricingCustomerId: malik,
    customerRates: { loading: false, error: '', items: { [filterId]: { price: 110 } } },
    modalPriceEditedRef: manual, cart: [], useEffect: callback => callback(),
    setSaleDraft: updater => { price = updater({ price }).price; }
  });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(price, '115');
  manual.current = false;
  vm.runInContext(source.slice(start, end), context);
  assert.equal(price, '110');
});
test('holding a bill after switching customers stores the new customer rate and total', () => {
  const source = fs.readFileSync(new URL('../../frontend/src/pages/SalesDashboard.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('  function createHeldBillSnapshot()');
  const end = source.indexOf('  function customerLabelForBill', start);
  const context = vm.createContext({
    cart: [{ productId: filterId, qty: 2, price: 90, priceCustomerId: other }], pricingCustomerId: malik,
    customerRates: { items: { [filterId]: { price: 110, retailPrice: 115, hasHistory: true } } },
    applyCustomerPrices, calculateBillTotals: items => ({ total: items.reduce((sum, item) => sum + item.qty * item.price, 0) }),
    holdRequestRef: { current: null }, createHeldBillId: () => 'held-id-123456', billRequestRef: { current: null },
    customerMode: 'existing', selectedCustomer: { _id: malik }, customerSearch: 'Malik', paymentStatus: 'paid', paidAmount: ''
  });
  vm.runInContext(source.slice(start, end), context);
  const snapshot = context.createHeldBillSnapshot();
  assert.equal(snapshot.cart[0].price, 110);
  assert.equal(snapshot.totals.total, 220);
});
