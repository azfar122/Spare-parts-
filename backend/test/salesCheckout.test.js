import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { createBillRequestId } from '../../frontend/src/utils/billRequestId.js';
import { applyCustomerPrices } from '../../frontend/src/utils/customerPricing.js';

function setup(post, overrides = {}) {
  const state = { cart: [{ productId: 'p1', qty: 1, price: 100, stock: 5, discount: 0 }], loading: false, receipt: null, notice: null };
  let requests = 0;
  const context = vm.createContext({
    cart: state.cart, customerMode: 'walk-in', selectedCustomer: null,
    paymentStatus: 'paid', paidAmount: '', billTotal: 100,
    page: 1, load: async () => {}, warehouseAllocationTotal: () => 0,
    checkoutRequestRef: { current: false },
    heldActionRef: { current: false }, resumeRequestRef: { current: false }, heldLoading: false, activeHeldBillId: null,
    setActiveHeldBillId() {}, setHeldBills() {},
    billRequestRef: { current: null }, crypto: webcrypto,
    holdRequestRef: { current: null },
    customerRates: { loading: false, error: '', items: {} }, pricingCustomerId: null,
    applyCustomerPrices, calculateBillTotals: items => ({ total: items.reduce((sum, item) => sum + Number(item.qty) * Number(item.price) - Number(item.discount || 0), 0) }),
    createBillRequestId,
    setNotice: value => { state.notice = value; },
    setCheckoutLoading: value => { state.loading = value; },
    setReceipt: value => { state.receipt = value; },
    setCart: value => { state.cart = value; },
    setCustomerMode() {}, setSelectedCustomer() {}, setCustomerSearch() {}, setPaymentStatus() {}, setPaidAmount() {},
    api: { post: async (...args) => { if (args[0] !== '/sales') return { status: 204 }; requests++; return post(...args); } },
    ...overrides
  });
  const source = fs.readFileSync(new URL('../../frontend/src/pages/SalesDashboard.jsx', import.meta.url), 'utf8');
  vm.runInContext(source.slice(source.indexOf('  async function checkout()'), source.indexOf('  function resetReturnState()')), context);
  return { state, checkout: context.checkout, requests: () => requests };
}

test('rejected bill displays the server reason, stops loading and preserves the bill', async () => {
  const { state, checkout } = setup(async () => { throw { response: { status: 400, data: { message: 'Selected warehouse does not have enough stock' } } }; });
  await checkout();
  assert.equal(state.notice.type, 'error');
  assert.match(state.notice.message, /not have enough stock/);
  assert.equal(state.loading, false);
  assert.equal(state.cart.length, 1);
  assert.equal(state.receipt, null);
});
test('interrupted response advises checking Sales before retrying and keeps items', async () => {
  const { state, checkout } = setup(async () => { throw Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }); });
  await checkout();
  assert.match(state.notice.message, /Check Sales/);
  assert.equal(state.cart.length, 1);
  assert.equal(state.loading, false);
});
test('a browser exception is shown accurately instead of being called a network interruption', async () => {
  const { state, checkout, requests } = setup(async () => assert.fail('No sales request should be sent'), {
    createBillRequestId() { throw new TypeError('Browser preparation failed'); }
  });
  await checkout();
  assert.match(state.notice.message, /Browser preparation failed/);
  assert.doesNotMatch(state.notice.message, /response was interrupted/);
  assert.equal(requests(), 0);
  assert.equal(state.cart.length, 1);
});
test('checkout proceeds in a browser without crypto.randomUUID', async () => {
  const { state, checkout, requests } = setup(async () => ({ data: { receiptNo: 'R-123' } }), {
    createBillRequestId: () => createBillRequestId(null)
  });
  await checkout();
  assert.equal(requests(), 1);
  assert.equal(state.receipt.receiptNo, 'R-123');
});
test('a successful bill opens the receipt and clears the cart', async () => {
  const receipt = { _id: 'bill', receiptNo: 'R-123' };
  const { state, checkout } = setup(async () => ({ data: receipt }));
  await checkout();
  assert.equal(state.receipt, receipt);
  assert.equal(state.cart.length, 0);
  assert.equal(state.loading, false);
});
test('rapid repeated clicks submit only one sale', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const { checkout, requests } = setup(() => pending);
  const first = checkout();
  await checkout();
  assert.equal(requests(), 1);
  finish({ data: { receiptNo: 'R-123' } });
  await first;
});
test('retrying after a lost response reuses the bill request identity', async () => {
  const ids = [];
  const { checkout, state } = setup(async (url, body) => {
    ids.push(body.requestId);
    if (ids.length === 1) throw new Error('Lost response');
    return { data: { receiptNo: 'R-123' } };
  });
  await checkout();
  assert.equal(state.cart.length, 1);
  await checkout();
  assert.equal(ids.length, 2);
  assert.equal(ids[0], ids[1]);
  assert.equal(state.receipt.receiptNo, 'R-123');
});
test('invalid quantities, discounts and partial payments fail before sending a request', async () => {
  const variants = [
    { cart: [{ qty: 1.5, price: 100, stock: 5 }] },
    { cart: [{ qty: 1, price: 100, stock: 5, discount: 101 }] },
    { customerMode: 'existing', selectedCustomer: { _id: 'c1' }, paymentStatus: 'partial', paidAmount: '0' },
    { customerMode: 'existing', selectedCustomer: { _id: 'c1' }, paymentStatus: 'partial', paidAmount: '100' }
  ];
  for (const values of variants) {
    const { state, checkout, requests } = setup(async () => assert.fail('Invalid bill should not be submitted'), values);
    await checkout();
    assert.equal(requests(), 0);
    assert.equal(state.notice.type, 'error');
    assert.equal(state.loading, false);
  }
});
test('checkout uses the selected customer price even before the cart display refreshes', async () => {
  let submitted;
  const { checkout } = setup(async (path, body) => { submitted = body; return { data: { receiptNo: 'R-123' } }; }, {
    customerMode: 'existing', selectedCustomer: { _id: 'malik', name: 'Malik' }, pricingCustomerId: 'malik',
    cart: [{ productId: 'filter', qty: 1, price: 90, stock: 5, priceCustomerId: 'other' }],
    customerRates: { loading: false, error: '', items: { filter: { price: 110, retailPrice: 115, hasHistory: true } } }
  });
  await checkout();
  assert.equal(submitted.items[0].price, 110);
  assert.equal(submitted.customerId, 'malik');
});
