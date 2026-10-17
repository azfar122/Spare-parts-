import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyReportPdf, dailyReportTables } from '../../frontend/src/utils/dailyReportExport.js';
const report = {
 date: '2026-10-17', generatedAt: '2026-10-17T17:00:00Z', scope: 'All shop sales', openingStockAvailable: false,
 summary: { revenue: 180, profit: 20, bills: 1, receivedAtSale: 100, dueAtSale: 80, discounts: 0, refunds: 0, missingCostItems: 0 },
 khataCollections: 50, products: [{ partName: 'Brake', partCode: 'P1', opening: null, sold: 1, returned: 0, closing: 99, revenue: 180, profit: 20 }],
 sales: [{ receiptNo: 'R-1', createdAt: '2026-10-17T17:00:00Z', customer: { name: 'Customer A', phone: '03000000000', currentBalance: 500 }, soldBy: { name: 'Counter' }, grandTotal: 180, paymentStatus: 'partial', paidAmount: 100, dueAmount: 80, items: [{ partName: 'Brake', partCode: 'P1', qty: 1, price: 180, discount: 0, lineTotal: 180 }] }], payments: [], returns: []
};
test('PDF tables include products, customer, partial payment, khata and unknown opening', () => {
 const tables = dailyReportTables(report);
 assert.equal(tables.length, 5);
 assert.equal(tables[1].body[0][2], 'Not recorded');
 assert.equal(tables[2].body[0][5], 'Partially paid');
 assert.equal(tables[2].body[0][6], 'Rs 100');
 assert.equal(tables[2].body[0][7], 'Rs 80');
 assert.equal(tables[2].body[0][8], 'Rs 500');
 assert.match(tables[2].body[0][1], /Customer A/);
});
test('PDF generation paginates a long daily report with all receipt rows', async () => {
 const longReport = { ...report, sales: Array.from({ length: 70 }, (_, i) => ({ ...report.sales[0], receiptNo: `R-TEST-${i}` })) };
 const pdf = await createDailyReportPdf(longReport);
 assert.ok(pdf.getNumberOfPages() > 1);
 const data = pdf.output();
 assert.ok(data.startsWith('%PDF'));
 assert.match(data, /R-TEST-69/);
 assert.match(data, /Daily Report/);
});
