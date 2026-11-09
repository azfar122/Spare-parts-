const number = value => Number(value ?? 0).toLocaleString('en-PK', { maximumFractionDigits: 2 });
const money = value => `Rs ${number(value)}`;

export const inventoryHeaders = ['Part No', 'Product Name', 'Brand', 'Retail Price', 'Wholesale Price', 'Booking Price', 'Shop Qty', 'Warehouse Qty', 'Total Qty'];

export function inventoryRows(products) {
  return products.map(product => [product.partCode || '-', product.partName || '-', product.brand || '-',
    money(product.mrp), money(product.wholesalePrice), money(product.bookingPrice), number(product.quantity),
    number(product.warehouseQuantity), number(Number(product.quantity || 0) + Number(product.warehouseQuantity || 0))]);
}

export function inventoryTimestamp(date) {
  return date.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
}

export async function downloadInventoryReport(products, generatedAt) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.setFontSize(17);
  pdf.text('Asif Auto Traders - Inventory List', 12, 15);
  pdf.setFontSize(9);
  pdf.text(`Fetched: ${inventoryTimestamp(generatedAt)} (Pakistan time) | ${products.length} products | Prices in PKR`, 12, 23);
  autoTable(pdf, {
    startY: 30, head: [inventoryHeaders], body: inventoryRows(products),
    margin: { top: 15, bottom: 15, left: 12, right: 12 },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59] }, rowPageBreak: 'avoid',
    columnStyles: { 1: { cellWidth: 48 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
  });
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page); pdf.setFontSize(8);
    pdf.text(`Inventory List - ${page} / ${pages}`, 12, 203);
  }
  pdf.save(`inventory-list-${generatedAt.toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })}.pdf`);
}
