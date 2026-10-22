import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('a delayed previous customer lookup cannot overwrite the newly selected customer prices', async () => {
  const states = [];
  const requests = [];
  let index;
  let previousDeps;
  let cleanup;
  const context = vm.createContext({
    AbortController,
    useState(initial) {
      const slot = index++;
      if (!(slot in states)) states[slot] = initial;
      return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    },
    useEffect(effect, deps) {
      if (!previousDeps || deps.some((value, i) => value !== previousDeps[i])) {
        cleanup?.(); previousDeps = deps; cleanup = effect();
      }
    },
    api: { post(path, body, options) {
      return new Promise(resolve => requests.push({ body, options, resolve }));
    } }
  });
  const source = fs.readFileSync(new URL('../../frontend/src/hooks/useCustomerProductPrices.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export default function', 'function'), context);
  function render(customer) { index = 0; return context.useCustomerProductPrices(customer, ['product']); }
  render('malik');
  render('other');
  assert.equal(requests[0].options.signal.aborted, true);
  requests[1].resolve({ data: { items: [{ productId: 'product', price: 90 }] } });
  await new Promise(resolve => setImmediate(resolve));
  requests[0].resolve({ data: { items: [{ productId: 'product', price: 110 }] } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(render('other').items.product.price, 90);
  assert.equal(render('other').loading, false);
  assert.equal(requests.length, 2);
});
