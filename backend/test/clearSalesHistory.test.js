import test from 'node:test';
import assert from 'node:assert/strict';
import { clearSalesHistory } from '../src/utils/clearSalesHistory.js';
test('clear history deletes receipts and returns in one session and preserves ledger amounts', async () => {
  const session = {};
  const calls = [];
  const models = {
    Sale: { deleteMany: async (filter, options) => { assert.deepEqual(filter, {}); assert.equal(options.session, session); calls.push('sales'); return { deletedCount: 4 }; } },
    Return: { deleteMany: async (filter, options) => { assert.deepEqual(filter, {}); assert.equal(options.session, session); calls.push('returns'); return { deletedCount: 2 }; } },
    LedgerEntry: { updateMany: async (filter, update, options) => { assert.equal(options.session, session); assert.deepEqual(update.$unset, { sale: '' }); assert.deepEqual(Object.keys(update.$set), ['description']); calls.push('ledger'); } }
  };
  assert.deepEqual(await clearSalesHistory(models, session), { salesDeleted: 4, returnsDeleted: 2 });
  assert.deepEqual(calls, ['sales', 'returns', 'ledger']);
});
test('failed deletion propagates so transaction can roll back', async () => {
  let ledgerTouched = false;
  await assert.rejects(clearSalesHistory({
    Sale: { deleteMany: async () => ({ deletedCount: 4 }) },
    Return: { deleteMany: async () => { throw new Error('database failure'); } },
    LedgerEntry: { updateMany: async () => { ledgerTouched = true; } }
  }, {}), /database failure/);
  assert.equal(ledgerTouched, false);
});
