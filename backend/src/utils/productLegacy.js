export function serializeProduct(product) {
  const item = typeof product?.toObject === 'function' ? product.toObject() : product;
  const productName = item?.productName || item?.partName || item?.['Product Name'] || item?.['Product name'] || '';
  const partNo = item?.partNo || item?.partCode || item?.PartNo || item?.['Part No'] || item?.['Part No.'] || '';
  const brand = item?.brand || item?.Brand || '';
  const category = item?.category || item?.Category || '';
  const type = item?.type || item?.Type || item?.model || '';
  const legacyPrice = item?.bookingPrice ?? item?.['Customer price (cc)'] ?? item?.CCP ?? item?.CP ?? 0;
  const retailPrice = item?.mrp ?? item?.['Retail Price(RP)'] ?? item?.RP ?? 0;
  const mrp = Number(retailPrice || 0) > 0 ? retailPrice : legacyPrice;
  const bookingPrice = mrp;
  const quantity = item?.quantity ?? item?.['Stock Qty'] ?? 0;

  return {
    ...item,
    partName: productName,
    partCode: partNo,
    brand,
    category,
    type,
    bookingPrice,
    mrp,
    quantity,
    productName,
    partNo
  };
}

export function productLabel(product) {
  const item = serializeProduct(product);
  return item.partNo || item.partName || 'selected product';
}

export function productStock(product) {
  return Number(serializeProduct(product).quantity || 0);
}

export function productPrice(product) {
  return Number(serializeProduct(product).mrp || 0);
}

export function productSearchConditions(q) {
  const pattern = new RegExp(q, 'i');
  return [
    { partName: pattern },
    { 'Product Name': pattern },
    { partCode: pattern },
    { PartNo: pattern },
    { 'Part No': pattern },
    { model: pattern },
    { brand: pattern },
    { Brand: pattern },
    { category: pattern },
    { Category: pattern },
    { type: pattern },
    { Type: pattern }
  ];
}

export function productStockSet(quantity) {
  return {
    quantity,
    'Stock Qty': quantity
  };
}
