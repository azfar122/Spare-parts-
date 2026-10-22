import { createHash } from 'node:crypto';

export function heldBillId(owner, clientId) {
  return createHash('sha256').update(`hold:${owner}:${clientId}`).digest('hex').slice(0, 24);
}

export function heldSaleId(owner, id) {
  return createHash('sha256').update(`held-sale:${owner}:${id}`).digest('hex').slice(0, 24);
}

export function normalizeHeldBill(body) {
  if (!Array.isArray(body.cart) || !body.cart.length) throw new Error('Add at least one item before holding a bill');
  const cart = body.cart.map(item => {
    if (!/^[a-f\d]{24}$/i.test(String(item.productId || ''))) throw new Error('Invalid held product');
    const qty = Number(item.qty);
    const price = Number(item.price);
    const discount = Number(item.discount || 0);
    if (!Number.isInteger(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > qty * price) throw new Error('Check held bill quantities, prices and discounts');
    const allowed = ['productId', 'partName', 'partCode', 'stock', 'warehouseQuantity', 'warehouseStocks', 'warehouseId', 'warehouseAllocations', 'retailPrice', 'priceCustomerId', 'priceSource'];
    return { ...Object.fromEntries(allowed.filter(key => Object.hasOwn(item, key)).map(key => [key, item[key]])), qty, price, discount };
  });
  const totals = cart.reduce((sum, item) => ({ sub: sum.sub + item.qty * item.price, dis: sum.dis + item.discount }), { sub: 0, dis: 0 });
  totals.total = totals.sub - totals.dis;
  return {
    cart, totals,
    customerMode: body.customerMode === 'existing' ? 'existing' : 'walk-in',
    selectedCustomer: body.selectedCustomer?._id ? { _id: body.selectedCustomer._id, name: String(body.selectedCustomer.name || ''), phone: String(body.selectedCustomer.phone || '') } : null,
    customerSearch: String(body.customerSearch || ''),
    paymentStatus: ['paid', 'partial', 'unpaid'].includes(body.paymentStatus) ? body.paymentStatus : 'paid',
    paidAmount: String(body.paidAmount || ''),
    requestIdentity: body.requestIdentity && typeof body.requestIdentity.id === 'string'
      ? { id: body.requestIdentity.id, signature: String(body.requestIdentity.signature || '') } : null
  };
}

export function serializeHeldBill(bill) {
  const row = typeof bill.toObject === 'function' ? bill.toObject() : bill;
  return { ...row.snapshot, id: String(row._id), createdAt: row.createdAt, updatedAt: row.updatedAt };
}
