const privateFields = new Set(['profit', 'costTotal', 'costEstimated', 'costAllocations', 'costReturned', 'costKnown', 'missingCostItems', 'missingCost']);
export function dailyReportForRole(report, role) {
  if (role === 'admin') return { ...report, canViewProfit: true };
  function redact(value) {
    if (Array.isArray(value)) return value.map(redact);
    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).filter(([key]) => !privateFields.has(key)).map(([key, entry]) => [key, redact(entry)]));
    }
    return value;
  }
  return { ...redact(report), canViewProfit: false };
}
