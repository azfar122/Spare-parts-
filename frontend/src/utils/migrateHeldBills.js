export async function migrateHeldBills(storage, save) {
  const key = 'salesCounterHeldBills';
  const legacy = JSON.parse(storage.getItem(key) || '[]');
  if (!Array.isArray(legacy)) throw new Error('Saved browser bills could not be read');
  const imported = new Set();
  let failed = 0;
  for (const bill of legacy) {
    try {
      await save(bill);
      imported.add(bill.id);
    } catch {
      failed++;
    }
  }
  if (imported.size) {
    // Keep failed imports and any new browser bills written by another tab.
    const current = JSON.parse(storage.getItem(key) || '[]');
    storage.setItem(key, JSON.stringify(current.filter(bill => !imported.has(bill.id))));
  }
  return { imported: imported.size, failed };
}
