import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { requireRole } from '../src/middleware/auth.js';

function setup(initial = []) {
  const rows = initial.map(row => ({ active: true, ...row }));
  const routes = {};
  const router = {
    use() {}, get() {}, put() {}, delete() {},
    post(path, authorize, handler) { routes[path] = { authorize, handler }; }
  };
  const context = vm.createContext({
    express: { Router: () => router }, requireAuth() {}, requireRole,
    Customer: {
      async findOne(filter) {
        return rows.find(row => filter.phone !== undefined ? row.phone === filter.phone : row.active !== false && filter.name.test(row.name));
      },
      async create(values) {
        const row = { _id: `customer-${rows.length + 1}`, active: true, ...values };
        rows.push(row);
        return row;
      }
    }
  });
  const source = fs.readFileSync(new URL('../src/routes/customerRoutes.js', import.meta.url), 'utf8');
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace('export { addLedgerEntry };', '').replace('export default router;', ''), context);
  async function request(body, role = 'sales') {
    let status = 200;
    let data;
    let allowed = false;
    const req = { body, user: { _id: 'sales-user', role } };
    const res = { status(code) { status = code; return this; }, json(value) { data = value; return this; } };
    routes['/quick-create'].authorize(req, res, () => { allowed = true; });
    if (allowed) await routes['/quick-create'].handler(req, res);
    return { status, data };
  }
  return { rows, routes, request };
}

test('sales can create a customer with an optional phone and no financial balance', async () => {
  const { rows, request } = setup();
  const { status, data } = await request({ name: '  Ali  ', openingBalance: 500, currentBalance: 500, active: false });
  assert.equal(status, 201);
  assert.equal(data.name, 'Ali');
  assert.equal(data.phone, '');
  assert.equal(data.openingBalance, 0);
  assert.equal(data.currentBalance, 0);
  assert.equal(data.active, true);
  assert.equal(data.createdBy, 'sales-user');
  assert.equal(rows.length, 1);
});
test('an existing phone selects the saved customer instead of creating a duplicate', async () => {
  const { rows, request } = setup([{ _id: 'saved', name: 'Ali', phone: '03001234567' }]);
  const { status, data } = await request({ name: 'Another Name', phone: ' 03001234567 ' });
  assert.equal(status, 200);
  assert.equal(data._id, 'saved');
  assert.equal(data.name, 'Ali');
  assert.equal(rows.length, 1);
});
test('retrying a name-only creation selects the same customer and escapes search characters', async () => {
  const { rows, request } = setup();
  const first = await request({ name: 'Ali (Shop)' });
  const second = await request({ name: 'ali (shop)' });
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.data._id, second.data._id);
  assert.equal(rows.length, 1);
});
test('blank names and inactive duplicate phones do not create customers', async () => {
  const { rows, request } = setup([{ _id: 'inactive', name: 'Ali', phone: '123', active: false }]);
  assert.equal((await request({ name: ' ' })).status, 400);
  assert.equal((await request({ name: {}, phone: '123' })).status, 400);
  assert.equal((await request({ name: 'Ali', phone: '123' })).status, 409);
  assert.equal(rows.length, 1);
});
test('admin can quick-create, other roles cannot, and sales financial permissions remain restricted', async () => {
  const { request, routes } = setup();
  assert.equal((await request({ name: 'Ali' }, 'admin')).status, 201);
  assert.equal((await request({ name: 'Ali' }, 'guest')).status, 403);
  for (const path of ['/', '/:id/payment', '/:id/adjustment']) {
    let status;
    routes[path].authorize({ user: { role: 'sales' } }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('Sales financial access must remain restricted'));
    assert.equal(status, 403);
  }
});
