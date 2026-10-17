import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfitSummary } from '../src/utils/profitSummary.js';
const sales = [{ receiptNo: 'R-1', items: [
  { partCode: 'A', qty: 5, netQty: 4, netLineTotal: 8800, netCost: 8200, netProfit: 600, costEstimated: true },
  { partCode: 'B', qty: 1, netLineTotal: 500, netCost: null, netProfit: null }
]}, { receiptNo: 'R-2', items: [{ partCode: 'A', qty: 1, netLineTotal: 180, netCost: 200, netProfit: -20 }] }];
test('separate revenue includes missing-cost sales while profit excludes them', () => {
  const summary = buildProfitSummary(sales);
  assert.equal(summary.revenue, 9480);
  assert.equal(summary.profit, 580);
  assert.equal(summary.cost, 8400);
  assert.equal(summary.missingCostItems, 1);
  assert.equal(summary.estimated, true);
  assert.equal(summary.rows.reduce((sum, row) => sum + (row.profit ?? 0), 0), summary.profit);
});
test('product filter applies equally to tiles and detailed sales', () => {
  const summary = buildProfitSummary(sales, item => item.partCode === 'A');
  assert.equal(summary.revenue, 8980);
  assert.equal(summary.profit, 580);
  assert.equal(summary.missingCostItems, 0);
  assert.equal(summary.rows.length, 2);
  assert.equal(summary.rows[0].receiptNo, 'R-1');
  assert.equal(summary.rows[0].qty, 4);
});
test('empty date results produce empty details and zero totals', () => {
  assert.deepEqual(buildProfitSummary([]), { revenue: 0, profit: 0, cost: 0, missingCostItems: 0, estimated: false, rows: [] });
});
