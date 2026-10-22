export function createBillRequestId(cryptoSource = globalThis.crypto) {
  try {
    if (typeof cryptoSource?.randomUUID === 'function') return cryptoSource.randomUUID();
    if (typeof cryptoSource?.getRandomValues === 'function') {
      const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* Some browsers expose crypto APIs but disallow them in this context. */ }
  return `bill-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
