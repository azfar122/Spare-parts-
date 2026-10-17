import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReportForRole } from '../src/utils/dailyReportAccess.js';
const report = { summary: { revenue: 180, profit: 20, missingCostItems: 1 }, products: [{ profit: 20, sold: 1, missingCost: false }], sales: [{ items: [{ price: 180, costTotal: 160, costAllocations: [{ unitCost: 160 }] }] }], returns: [{ costReturned: 160, costKnown: true, amountRefunded: 180 }] };
test('sales report removes profit and underlying cost data at every level', () => {
 const result = dailyReportForRole(report, 'sales');
 assert.equal(result.canViewProfit, false);
 assert.equal(result.summary.revenue, 180);
 assert.doesNotMatch(JSON.stringify(result), /"(?:profit|costTotal|costAllocations|unitCost|costReturned|costKnown|missingCostItems|missingCost)"/);
 assert.equal(report.summary.profit, 20);
});
test('admin report keeps profit and cost data', () => {
 const result = dailyReportForRole(report, 'admin');
 assert.equal(result.canViewProfit, true);
 assert.equal(result.summary.profit, 20);
 assert.equal(result.sales[0].items[0].costTotal, 160);
});
