export function applyCustomerPrices(cart, customerId, prices) {
  let changed = false;
  const next = cart.map(item => {
    const previous = prices[item.productId];
    if (!previous || item.priceCustomerId === customerId) return item;
    changed = true;
    return { ...item, price: previous.price, retailPrice: previous.retailPrice,
      priceCustomerId: customerId, priceSource: previous.hasHistory ? 'customer' : 'retail' };
  });
  return changed ? next : cart;
}
