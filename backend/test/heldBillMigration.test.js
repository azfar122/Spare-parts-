import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateHeldBills } from '../../frontend/src/utils/migrateHeldBills.js';
import { heldBillId, heldSaleId, normalizeHeldBill } from '../src/utils/heldBills.js';

function storage(bills) {
  let value = JSON.stringify(bills);
  return { getItem: () => value, setItem(key, next) { value = next; }, bills: () => JSON.parse(value) };
}
const snapshot = id => ({ id, cart: [{ productId: '000000000000000000000001', qty: 1, price: 339195, discount: 0 }] });

test('the Rs 339,195 browser bill is removed locally only after upload confirmation', async () => {
  const local = storage([snapshot('legacy-123')]);
  const remote = [];
  await migrateHeldBills(local, async bill => {
    assert.equal(local.bills().length, 1);
    remote.push(normalizeHeldBill(bill));
  });
  assert.equal(remote[0].totals.total, 339195);
  assert.equal(local.bills().length, 0);
});
test('failed imports retain their entire browser copy', async () => {
  const bill = snapshot('legacy-123');
  const local = storage([bill]);
  const result = await migrateHeldBills(local, async () => { throw new Error('Offline'); });
  assert.equal(result.failed, 1);
  assert.deepEqual(local.bills(), [bill]);
});
test('partial migration and another tab adding a bill do not lose unimported bills', async () => {
  const local = storage([snapshot('saved-123'), snapshot('failed-123')]);
  await migrateHeldBills(local, async bill => {
    if (bill.id === 'failed-123') throw new Error('Offline');
    local.setItem('', JSON.stringify([...local.bills(), snapshot('new-tab-123')]));
  });
  assert.deepEqual(local.bills().map(bill => bill.id), ['failed-123', 'new-tab-123']);
});
test('corrupt local storage is retained and cannot be silently discarded', async () => {
  let writes = 0;
  await assert.rejects(migrateHeldBills({ getItem: () => '{broken', setItem() { writes++; } }, async () => {}));
  assert.equal(writes, 0);
});
test('stable held identifiers are scoped to a salesperson and reuse the same sale identity', () => {
  const id = heldBillId('sales-1', 'legacy-123');
  assert.equal(heldBillId('sales-1', 'legacy-123'), id);
  assert.notEqual(heldBillId('sales-2', 'legacy-123'), id);
  assert.equal(heldSaleId('sales-1', id), heldSaleId('sales-1', id));
  assert.notEqual(heldSaleId('sales-2', id), heldSaleId('sales-1', id));
});
test('held totals are computed from items and cannot be supplied by the browser', () => {
  const held = normalizeHeldBill({ ...snapshot('legacy-123'), totals: { total: 1 }, owner: 'other-user' });
  assert.equal(held.totals.total, 339195);
  assert.equal(Object.hasOwn(held, 'owner'), false);
  assert.throws(() => normalizeHeldBill({ cart: [] }), /at least one item/);
});
