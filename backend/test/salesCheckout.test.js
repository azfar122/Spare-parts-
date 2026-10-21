import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup(post, overrides = {}) {
  const state = { cart: [{ productId: 'p1', qty: 1, price: 100, stock: 5, discount: 0 }], loading: false, receipt: null, notice: null };
  let requests = 0;
  const context = vm.createContext({
    cart: state.cart, customerMode: 'walk-in', selectedCustomer: null,
    paymentStatus: 'paid', paidAmount: '', billTotal: 100,
    page: 1, load: async () => {}, warehouseAllocationTotal: () => 0,
    checkoutRequestRef: { current: false },
    setNotice: value => { state.notice = value; },
    setCheckoutLoading: value => { state.loading = value; },
    setReceipt: value => { state.receipt = value; },
    setCart: value => { state.cart = value; },
    setCustomerMode() {}, setSelectedCustomer() {}, setCustomerSearch() {}, setPaymentStatus() {}, setPaidAmount() {},
    api: { post: async (...args) => { requests++; return post(...args); } },
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
  const { state, checkout } = setup(async () => { throw new Error('Network Error'); });
  await checkout();
  assert.match(state.notice.message, /Check Sales/);
  assert.equal(state.cart.length, 1);
  assert.equal(state.loading, false);
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
