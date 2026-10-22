import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function useCustomerProductPrices(customerId, productIds) {
  const ids = [...new Set(productIds)].filter(Boolean).sort().join(',');
  const key = `${customerId || 'walk-in'}:${ids}`;
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ key: '', items: {}, loading: false, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    if (!ids) { setState({ key, items: {}, loading: false, error: '' }); return () => controller.abort(); }
    setState({ key, items: {}, loading: true, error: '' });
    api.post('/customers/product-prices', { customerId: customerId || undefined, productIds: ids.split(',') }, { signal: controller.signal, timeout: 20000 })
      .then(({ data }) => {
        if (!controller.signal.aborted) setState({ key, items: Object.fromEntries(data.items.map(item => [item.productId, item])), loading: false, error: '' });
      }).catch(err => {
        if (!controller.signal.aborted) setState({ key, items: {}, loading: false, error: err.response?.data?.message || 'Could not load customer prices. Retry or enter the selling prices manually.' });
      });
    return () => controller.abort();
  }, [key, retry]);
  return { items: state.key === key ? state.items : {}, loading: Boolean(ids) && (state.key !== key || state.loading),
    error: state.key === key ? state.error : '', retry: () => setRetry(value => value + 1) };
}
