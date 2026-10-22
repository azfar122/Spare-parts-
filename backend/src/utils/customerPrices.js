export function customerPricePipeline(customer, productIds) {
  return [
    { $match: { customer, 'items.product': { $in: productIds } } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $in: productIds }, 'items.price': { $gte: 0 } } },
    { $group: { _id: '$items.product', price: { $first: '$items.price' }, soldAt: { $first: '$createdAt' }, receiptNo: { $first: '$receiptNo' } } }
  ];
}

export function productHistoryPipeline(customer, query, page, limit) {
  const pattern = new RegExp(String(query || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return [
    { $match: { customer } },
    { $unwind: { path: '$items', includeArrayIndex: 'itemIndex' } },
    ...(query ? [{ $match: { $or: [{ 'items.partName': pattern }, { 'items.partCode': pattern }] } }] : []),
    { $sort: { createdAt: -1, _id: -1, itemIndex: 1 } },
    { $facet: {
      items: [
        { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { _id: 0, saleId: '$_id', itemIndex: 1, date: '$createdAt', receiptNo: 1,
          productId: '$items.product', partName: '$items.partName', partCode: '$items.partCode',
          qty: '$items.qty', price: '$items.price', discount: '$items.discount', lineTotal: '$items.lineTotal' } }
      ],
      count: [{ $count: 'total' }]
    } }
  ];
}
