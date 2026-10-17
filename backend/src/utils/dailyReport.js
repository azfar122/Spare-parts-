export function summarizeDaily(sales, returns) {
  const summary = { bills: sales.length, grossSales: 0, discounts: 0, revenue: 0, receivedAtSale: 0, dueAtSale: 0, refunds: 0, profit: 0, missingCostItems: 0 };
  const products = new Map();
  const getProduct = (id, name, code) => {
    const key = String(id);
    if (!products.has(key)) products.set(key, { product: key, partName: name, partCode: code, sold: 0, returned: 0, revenue: 0, profit: 0, missingCost: false });
    return products.get(key);
  };
  for (const sale of sales) {
    summary.grossSales += Number(sale.subtotal || 0);
    summary.discounts += Number(sale.discountTotal || 0);
    summary.revenue += Number(sale.grandTotal || 0);
    summary.receivedAtSale += Number(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.grandTotal : 0) ?? 0);
    summary.dueAtSale += Number(sale.dueAmount || 0);
    for (const item of sale.items || []) {
      const product = getProduct(item.product, item.partName, item.partCode);
      product.sold += Number(item.qty || 0);
      product.revenue += Number(item.lineTotal || 0);
      if (item.costTotal == null) { summary.missingCostItems++; product.missingCost = true; }
      else { const profit = Number(item.lineTotal || 0) - item.costTotal; summary.profit += profit; product.profit += profit; }
    }
  }
  for (const row of returns) {
    const product = getProduct(row.product, row.partName, row.partCode);
    const refunded = Number(row.amountRefunded || 0);
    product.returned += Number(row.qty || 0);
    product.revenue -= refunded;
    summary.refunds += refunded;
    summary.revenue -= refunded;
    // Reverse only recorded sale costs. Never invent historical profit.
    if (row.costKnown) {
      const adjustment = Number(row.costReturned || 0) - refunded;
      summary.profit += adjustment; product.profit += adjustment;
    } else { summary.missingCostItems++; product.missingCost = true; }
  }
  return { summary, products: [...products.values()] };
}
