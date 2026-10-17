export function buildProfitSummary(sales, matches = () => true) {
  const rows = sales.flatMap(sale => (sale.items || []).filter(matches).map(item => ({
    receiptNo: sale.receiptNo, date: sale.createdAt, product: item.product,
    partName: item.partName, partCode: item.partCode,
    qty: Number(item.netQty ?? item.qty ?? 0),
    revenue: Number(item.netLineTotal ?? item.lineTotal ?? 0),
    cost: item.netCost ?? null, profit: item.netProfit ?? null,
    estimated: Boolean(item.costEstimated)
  })));
  const known = rows.filter(row => row.profit != null);
  return {
    revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    profit: known.reduce((sum, row) => sum + row.profit, 0),
    cost: known.reduce((sum, row) => sum + row.cost, 0),
    missingCostItems: rows.length - known.length,
    estimated: known.some(row => row.estimated),
    rows
  };
}
