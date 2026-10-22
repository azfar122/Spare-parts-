import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillRequestId } from '../../frontend/src/utils/billRequestId.js';

test('bill request IDs work with UUID, random bytes, or no browser crypto', () => {
  assert.equal(createBillRequestId({ randomUUID: () => 'browser-generated-uuid' }), 'browser-generated-uuid');
  const bytes = createBillRequestId({ getRandomValues: values => values.fill(15) });
  assert.equal(bytes, '0f'.repeat(16));
  for (const crypto of [null, {}, { randomUUID() { throw new Error('Unavailable'); } }]) {
    const first = createBillRequestId(crypto);
    assert.match(first, /^[a-zA-Z0-9-]{16,80}$/);
    assert.notEqual(first, createBillRequestId(crypto));
  }
});
