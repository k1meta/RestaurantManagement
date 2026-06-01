const { api, setupTestDb, asUser } = require('../helpers/testApp');
const { getMockStore } = require('../helpers/mockFirestore');
const { buildDefaultSeed } = require('../helpers/fixtures');

describe('orders routes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('OD-01 waiter creates order with items', async () => {
    const res = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({
        table_number: '7',
        items: [
          { menu_item_id: 1, quantity: 1 },
          { menu_item_id: 1, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('pending');
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.order.items[0].quantity).toBe(2);
  });

  test('OD-02 empty items rejected', async () => {
    const res = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test('OD-03 inactive menu item rejected', async () => {
    const res = await api()
      .post('/api/orders')
      .set(asUser('waiter').headers)
      .send({ items: [{ menu_item_id: 2, quantity: 1 }] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('OD-04 kitchen cannot create orders', async () => {
    const res = await api()
      .post('/api/orders')
      .set(asUser('kitchen').headers)
      .send({ items: [{ menu_item_id: 1, quantity: 1 }] });

    expect(res.status).toBe(403);
  });

  test('OD-05 list orders with status filter', async () => {
    const res = await api()
      .get('/api/orders?status=ready&include_closed=false')
      .set(asUser('manager').headers);

    expect(res.status).toBe(200);
    expect(res.body.orders.every((o) => o.status === 'ready')).toBe(true);
  });

  test('OD-06 cross-location order access denied', async () => {
    const res = await api().get('/api/orders/2').set(asUser('waiter').headers);
    expect(res.status).toBe(403);
  });

  test('OD-07 kitchen sets order to preparing', async () => {
    const store = getMockStore();
    store.seedCollection('orders', [
      {
        id: 3,
        location_id: 1,
        waiter_id: 3,
        table_number: '1',
        status: 'pending',
        created_at: '2026-01-01T12:00:00.000Z',
        closed_at: null,
      },
    ]);

    const res = await api()
      .patch('/api/orders/3/status')
      .set(asUser('kitchen').headers)
      .send({ status: 'preparing' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('preparing');
  });

  test('OD-08 waiter cannot set preparing', async () => {
    const res = await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'preparing' });

    expect(res.status).toBe(403);
  });

  test('OD-09 kitchen sets order to ready', async () => {
    const store = getMockStore();
    store.seedCollection('orders', [
      {
        id: 4,
        location_id: 1,
        waiter_id: 3,
        status: 'preparing',
        created_at: '2026-01-01T12:00:00.000Z',
        closed_at: null,
      },
    ]);

    const res = await api()
      .patch('/api/orders/4/status')
      .set(asUser('kitchen').headers)
      .send({ status: 'ready' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ready');
  });

  test('OD-10 waiter cannot close non-ready order', async () => {
    const store = getMockStore();
    store.seedCollection('orders', [
      {
        id: 5,
        location_id: 1,
        waiter_id: 3,
        status: 'preparing',
        created_at: '2026-01-01T12:00:00.000Z',
        closed_at: null,
      },
    ]);

    const res = await api()
      .patch('/api/orders/5/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    expect(res.status).toBe(409);
  });

  test('OD-11 waiter closes ready order', async () => {
    const res = await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('closed');
    expect(res.body.order.closed_at).toBeTruthy();
  });

  test('OD-12 closing order deducts inventory', async () => {
    const store = getMockStore();
    const seed = buildDefaultSeed();
    store.reset();
    const { seedMockDb } = require('../helpers/mockFirestore');
    seedMockDb(seed);

    const before = store.getDoc('inventory', 1).quantity;

    await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    const after = store.getDoc('inventory', 1).quantity;
    expect(after).toBeLessThan(before);
  });

  test('OD-13 closing order creates sales rows', async () => {
    const store = getMockStore();
    const seed = buildDefaultSeed();
    store.reset();
    const { seedMockDb } = require('../helpers/mockFirestore');
    seedMockDb(seed);

    await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    const sales = store.getCollectionData('sales');
    expect(sales.length).toBeGreaterThan(0);
    expect(sales[0].order_id).toBe(1);
  });

  test('OD-14 insufficient inventory blocks close', async () => {
    const store = getMockStore();
    store.seedCollection('inventory', [
      {
        id: 1,
        location_id: 1,
        ingredient_id: 1,
        ingredient: 'Tomato',
        quantity: 0.01,
        unit: 'Kg',
      },
      {
        id: 2,
        location_id: 1,
        ingredient_id: 2,
        ingredient: 'Cheese',
        quantity: 1,
        unit: 'g',
      },
    ]);

    const res = await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'closed' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Insufficient stock|Missing inventory/i);
  });

  test('OD-15 waiter cannot rollback to pending', async () => {
    const res = await api()
      .patch('/api/orders/1/status')
      .set(asUser('waiter').headers)
      .send({ status: 'pending' });

    expect(res.status).toBe(403);
  });

  test('OD-16 invalid status rejected', async () => {
    const res = await api()
      .patch('/api/orders/1/status')
      .set(asUser('manager').headers)
      .send({ status: 'shipped' });

    expect(res.status).toBe(400);
  });
});
