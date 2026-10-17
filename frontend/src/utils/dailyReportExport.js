const money = value => `Rs ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const time = value => new Date(value).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' });
export function dailyReportTables(report) {
  return [
    { title: 'Daily totals', head: ['Revenue', ...(report.canViewProfit ? ['Gross profit'] : []), 'Bills', 'Paid at checkout', 'Due at checkout', 'Discounts', 'Refunds / credits', 'Khata collected'], body: [[money(report.summary.revenue), ...(report.canViewProfit ? [money(report.summary.profit)] : []), report.summary.bills, money(report.summary.receivedAtSale), money(report.summary.dueAtSale), money(report.summary.discounts), money(report.summary.refunds), money(report.khataCollections)]] },
    { title: 'Products sold and stock', head: ['Product', 'Part no.', 'Opening', 'Sold', 'Returned', 'Closing (now)', 'Net sales', ...(report.canViewProfit ? ['Gross profit'] : [])], body: report.products.map(row => [row.partName, row.partCode, row.opening ?? 'Not recorded', row.sold, row.returned, row.closing ?? 'Not recorded', money(row.revenue), ...(report.canViewProfit ? [money(row.profit) + (row.missingCost ? ' (recorded costs only)' : '')] : [])]) },
    { title: 'Sales, customers and payments', head: ['Receipt / time', 'Customer', 'Sold by', 'Products / qty / price / discount / total', 'Bill total', 'Payment', 'Paid', 'Bill due', 'Current khata'], body: report.sales.map(sale => [
      `${sale.receiptNo}\n${time(sale.createdAt)}`, `${sale.customer?.name || sale.customerName || 'Walk-in Customer'}${sale.customer?.phone ? `\n${sale.customer.phone}` : ''}`, sale.soldBy?.name || sale.soldBy?.username || '-',
      sale.items.map(item => `${item.partName} (${item.partCode || '-'})\n${item.qty} x ${money(item.price)} | Discount ${money(item.discount)} | Total ${money(item.lineTotal)}`).join('\n\n'), money(sale.grandTotal), sale.paymentStatus === 'partial' ? 'Partially paid' : sale.paymentStatus === 'unpaid' ? 'Unpaid' : 'Fully paid', money(sale.paidAmount ?? (sale.paymentStatus === 'paid' ? sale.grandTotal : 0)), money(sale.dueAmount), sale.customer ? money(sale.customer.currentBalance) : '-'
    ]) },
    { title: 'Khata payments collected today', head: ['Time', 'Customer', 'Received', 'Current khata'], body: report.payments.map(row => [time(row.createdAt), row.customer?.name || 'Deleted customer', money(row.credit), row.customer ? money(row.customer.currentBalance) : '-']) },
    { title: 'Returns processed today', head: ['Receipt', 'Product', 'Customer', 'Quantity', 'Refund / credit'], body: report.returns.map(row => [row.receiptNo, row.partName, row.customerName || 'Walk-in Customer', row.qty, money(row.amountRefunded)]) }
  ];
}

export async function createDailyReportPdf(report) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(17); pdf.text('Asif Auto Traders - Daily Report', 12, 15);
  pdf.setFontSize(10); pdf.text(`${report.date} | ${report.scope} | As of ${time(report.generatedAt)} | Pakistan time`, 12, 23);
  let y = 30;
  const notes = [
    report.canViewProfit ? 'Revenue and profit account for returns processed today. Gross profit excludes operating expenses.' : 'Revenue accounts for returns processed today.',
    'Stock combines main store and warehouses. Closing stock is current; sales quantities follow the report scope.',
    'Payments and bill dues are at checkout. Khata is the current customer balance: do not sum repeated balances.'
  ];
  if (!report.openingStockAvailable) notes.push('Opening quantities without verified tracking show Not recorded.');
  if (report.canViewProfit && report.summary.missingCostItems) notes.push(`Profit excludes ${report.summary.missingCostItems} sale/return items without recorded costs; revenue includes them.`);
  for (const note of notes) {
    const lines = pdf.splitTextToSize(note, 273); pdf.setFontSize(8); pdf.text(lines, 12, y); y += lines.length * 4 + 1;
  }
  for (const section of dailyReportTables(report)) {
    if (y > 175) { pdf.addPage(); y = 15; }
    pdf.setFontSize(11); pdf.text(section.title, 12, y);
    autoTable(pdf, { startY: y + 3, head: [section.head], body: section.body.length ? section.body : [['No activity today.']],
      margin: { left: 12, right: 12, top: 15, bottom: 15 }, styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' }, headStyles: { fillColor: [30, 41, 59] }, rowPageBreak: 'avoid' });
    y = pdf.lastAutoTable.finalY + 10;
  }
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) { pdf.setPage(page); pdf.setFontSize(8); pdf.text(`Daily Report ${report.date} - ${page} / ${pages}`, 12, 203); }
  return pdf;
}

export async function downloadDailyReport(report) {
  const pdf = await createDailyReportPdf(report);
  pdf.save(`daily-report-${report.date}-${report.scope === 'Your sales' ? 'my-sales' : 'shop'}.pdf`);
}

export function printDailyReport(element) {
  const preview = window.open('', '_blank', 'width=1200,height=850');
  if (!preview) throw new Error('Allow popups to open the print preview.');
  preview.document.open();
  preview.document.write(`<!doctype html><html><head><title>Asif Auto Traders - Daily Report</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 10pt; }
    h1 { font-size: 18pt; } h3 { font-size: 12pt; margin: 18px 0 8px; break-after: avoid; }
    table { border-collapse: collapse; width: 100%; font-size: 8pt; margin-bottom: 18px; table-layout: auto; }
    th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; white-space: normal !important; overflow-wrap: anywhere; }
    th { background: #f1f5f9; } thead { display: table-header-group; } tr { break-inside: avoid; }
    div { overflow: visible !important; max-height: none !important; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .grid > div { border: 1px solid #cbd5e1; padding: 8px; }
    p { margin: 5px 0; } .block { display: block; } .text-xs { font-size: 7pt; } .no-print { display: none; }
  </style></head><body><h1>Asif Auto Traders - Daily Report</h1></body></html>`);
  preview.document.body.appendChild(preview.document.importNode(element, true));
  preview.document.close();
  preview.onafterprint = () => preview.close();
  preview.focus();
  preview.document.fonts.ready.then(() => { if (!preview.closed) preview.print(); });
}
