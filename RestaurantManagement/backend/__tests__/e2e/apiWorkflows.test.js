const { api, setupTestDb, asUser } = require('../helpers/testApp');
const { getMockStore } = require('../helpers/mockFirestore');
const { DEFAULT_PASSWORD, NOW } = require('../helpers/fixtures');

describe('API E2E workflows', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('E2E-01 staff onboarding: login, create location, create manager', async () => {
    const login = await api()
      .post('/api/auth/login')
      .send({ email: 'owner@restaurant.com', password: DEFAULT_PASSWORD });
    expect(login.status).toBe(200);
    const ownerHeaders = { Authorization: `Bearer ${login.body.token}` };

    const location = await api()
      .post('/api/locations')
      .set(ownerHeaders)
      .send({ name: 'Harbor Branch', address: '1 Pier' });
    expect(location.status).toBe(201);

    const manager = await api()
      .post('/api/users')
      .set(ownerHeaders)
      .send({
        name: 'Harbor Manager',
        email: 'harbor.manager@test.com',
        password: DEFAULT_PASSWORD,
        role: 'manager',
        location_id: location.body.location.id,
      });
    expect(manager.status).toBe(201);
    expect(manager.body.user.role).toBe('manager');
  });

  test('E2E-02 menu setup: ingredients, inventory, menu BOM', async () => {
    const { headers } = asUser('manager');

    const ingredient = await api()
      .post('/api/inventory/ingredients')
      .set(headers)
      .send({ name: 'Mozzarella', default_unit: 'pieces' });
    expect(ingredient.status).toBe(201);

    const inventory = await api()
      .post('/api/inventory')
      .set(headers)
      .send({
        ingredient_id: ingredient.body.ingredient.id,
        quantity: 200,
        unit: 'pieces',
      });
    expect(inventory.status).toBe(201);

    const menu = await api()
      .post('/api/menu')
      .set(headers)
      .send({
        name: 'Cheese Plate',
        category: 'Starter',
        price: 8.5,
        ingredients: [
          {
            ingredient_id: ingredient.body.ingredient.id,
            quantity_required: 10,
            unit: 'pieces',
          },
        ],
      });
    expect(menu.status).toBe(201);
    expect(menu.body.item.ingredients[0].ingredient_name).toBe('Mozzarella');
  });

  test('E2E-03 full order lifecycle: create → preparing → ready → closed', async () => {
    const create = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({ table_number: '10', items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(create.status).toBe(201);
    const orderId = create.body.order.id;

    const preparing = await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('kitchen').headers)
      .send({ status: 'preparing' });
    expect(preparing.status).toBe(200);

    const ready = await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('kitchen').headers)
      .send({ status: 'ready' });
    expect(ready.status).toBe(200);

    const closed = await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });
    expect(closed.status).toBe(200);
    expect(closed.body.order.status).toBe('closed');
  });

  test('E2E-04 inventory deduction on order close', async () => {
    const store = getMockStore();
    const beforeTomato = store.getDoc('inventory', 1).quantity;

    await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    const afterTomato = store.getDoc('inventory', 1).quantity;
    expect(afterTomato).toBeLessThan(beforeTomato);
  });

  test('E2E-05 sales reporting after closing orders', async () => {
    const create = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({ items: [{ menu_item_id: 1, quantity: 1 }] });
    const orderId = create.body.order.id;

    await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('kitchen').headers)
      .send({ status: 'preparing' });
    await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('kitchen').headers)
      .send({ status: 'ready' });
    await api()
      .patch(`/api/orders/${orderId}/status`)
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    const sales = await api()
      .get('/api/sales?period=weekly')
      .set(asUser('manager').headers);

    expect(sales.status).toBe(200);
    expect(sales.body.summary.total_revenue).toBeGreaterThan(0);
    expect(sales.body.summary.total_orders).toBeGreaterThanOrEqual(1);
  });

  test('E2E-06 RBAC: waiter blocked from admin endpoints', async () => {
    const { headers } = asUser('waiter');

    const loc = await api().post('/api/locations').set(headers).send({ name: 'X' });
    const user = await api()
      .post('/api/users')
      .set(headers)
      .send({ name: 'X', email: 'x@test.com', password: DEFAULT_PASSWORD, role: 'waiter' });
    const sales = await api().get('/api/sales').set(headers);

    expect(loc.status).toBe(403);
    expect(user.status).toBe(403);
    expect(sales.status).toBe(403);
  });

  test('E2E-07 manager user management CRUD', async () => {
    const { headers } = asUser('manager');

    const created = await api()
      .post('/api/users')
      .set(headers)
      .send({
        name: 'Floor Staff',
        email: 'floor@test.com',
        password: DEFAULT_PASSWORD,
        role: 'waiter',
      });
    expect(created.status).toBe(201);
    const userId = created.body.user.id;

    const updated = await api()
      .patch(`/api/users/${userId}`)
      .set(headers)
      .send({ name: 'Floor Staff Updated' });
    expect(updated.status).toBe(200);

    const deleted = await api().delete(`/api/users/${userId}`).set(headers);
    expect(deleted.status).toBe(200);
  });

  test('E2E-08 cross-location order isolation', async () => {
    const res = await api().get('/api/orders/2').set(asUser('waiter', 1).headers);
    expect(res.status).toBe(403);
  });

  test('E2E-09 location delete guard when location in use', async () => {
    const res = await api().delete('/api/locations/1').set(asUser('owner').headers);
    expect(res.status).toBe(409);
    expect(res.body.usage.users_count).toBeGreaterThan(0);
  });

  test('E2E-10 order merges duplicate menu_item_id lines', async () => {
    const res = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({
        items: [
          { menu_item_id: 1, quantity: 2 },
          { menu_item_id: 1, quantity: 3 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0].quantity).toBe(5);
  });
});
