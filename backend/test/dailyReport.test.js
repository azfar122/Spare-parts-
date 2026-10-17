import test from 'node:test';
import assert from 'node:assert/strict';
import { pakistanDay } from '../src/utils/dailyStock.js';
import { summarizeDaily } from '../src/utils/dailyReport.js';

test('daily boundaries follow Pakistan midnight rather than UTC midnight', () => {
  const before = pakistanDay(new Date('2026-10-17T18:59:59Z'));
  const after = pakistanDay(new Date('2026-10-17T19:00:00Z'));
  assert.equal(before.date, '2026-10-17');
  assert.equal(before.start.toISOString(), '2026-10-16T19:00:00.000Z');
  assert.equal(after.date, '2026-10-18');
  assert.equal(after.start.toISOString(), '2026-10-17T19:00:00.000Z');
});
const sales = [{ subtotal: 4400, discountTotal: 100, grandTotal: 4300, paidAmount: 2000, dueAmount: 2300, paymentStatus: 'partial', items: [{ product: 'p1', partName: 'Brake', qty: 2, price: 2200, lineTotal: 4300, costTotal: 4000 }] }];
test('daily report totals partial payments, product quantities and actual profit', () => {
  const { summary, products } = summarizeDaily(sales, []);
  assert.equal(summary.revenue, 4300);
  assert.equal(summary.profit, 300);
  assert.equal(summary.receivedAtSale, 2000);
  assert.equal(summary.dueAtSale, 2300);
  assert.equal(products[0].sold, 2);
  assert.equal(products[0].profit, 300);
});
test('returns processed today reduce revenue and reverse recorded cost, including older bills', () => {
  const { summary, products } = summarizeDaily(sales, [{ product: 'p1', qty: 1, amountRefunded: 2150, costReturned: 2000, costKnown: true }]);
  assert.equal(summary.revenue, 2150);
  assert.equal(summary.profit, 150);
  assert.equal(products[0].returned, 1);
});
test('historical missing costs do not fabricate profit', () => {
  const { summary } = summarizeDaily([{ grandTotal: 100, paymentStatus: 'paid', items: [{ product: 'old', qty: 1, lineTotal: 100 }] }], []);
  assert.equal(summary.revenue, 100);
  assert.equal(summary.receivedAtSale, 100);
  assert.equal(summary.profit, 0);
  assert.equal(summary.missingCostItems, 1);
});
test('empty day produces zero revenue and no product rows', () => {
  const { summary, products } = summarizeDaily([], []);
  assert.equal(summary.bills, 0); assert.equal(summary.profit, 0); assert.deepEqual(products, []);
});
