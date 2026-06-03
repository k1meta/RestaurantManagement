const { api, setupTestDb, asUser } = require('../helpers/testApp');
const { getMockStore } = require('../helpers/mockFirestore');
const { NOW } = require('../helpers/fixtures');

describe('menu and sales routes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('MS-01 waiter sees active menu only', async () => {
    const res = await api().get('/api/menu').set(asUser('waiter').headers);
    expect(res.status).toBe(200);
    expect(res.body.menu.every((item) => item.active !== false)).toBe(true);
  });

  test('MS-02 manager can include inactive items', async () => {
    const res = await api()
      .get('/api/menu?include_inactive=true')
      .set(asUser('manager').headers);

    expect(res.status).toBe(200);
    expect(res.body.menu.some((item) => item.active === false)).toBe(true);
  });

  test('MS-03 waiter cannot include inactive items', async () => {
    const res = await api()
      .get('/api/menu?include_inactive=true')
      .set(asUser('waiter').headers);

    expect(res.status).toBe(200);
    expect(res.body.menu.every((item) => item.active !== false)).toBe(true);
  });

  test('MS-04 create menu item with BOM', async () => {
    const res = await api()
      .post('/api/menu')
      .set(asUser('manager').headers)
      .send({
        name: 'Caprese Salad',
        category: 'Salad',
        price: 9.5,
        active: true,
        ingredients: [
          { ingredient_id: 1, quantity_required: 2, unit: 'cans' },
          { ingredient_id: 2, quantity_required: 3, unit: 'pieces' },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.item.ingredients).toHaveLength(2);
  });

  test('MS-05 missing ingredients rejected', async () => {
    const res = await api()
      .post('/api/menu')
      .set(asUser('manager').headers)
      .send({ name: 'Empty Dish', price: 5 });

    expect(res.status).toBe(400);
  });

  test('MS-06 conflicting units for same ingredient rejected', async () => {
    const res = await api()
      .post('/api/menu')
      .set(asUser('manager').headers)
      .send({
        name: 'Bad BOM',
        price: 5,
        ingredients: [
          { ingredient_id: 1, quantity_required: 2, unit: 'cans' },
          { ingredient_id: 1, quantity_required: 3, unit: 'pieces' },
        ],
      });

    expect(res.status).toBe(400);
  });

  test('MS-07 patch price valid and invalid', async () => {
    const ok = await api()
      .patch('/api/menu/1/price')
      .set(asUser('manager').headers)
      .send({ price: 14.99 });

    expect(ok.status).toBe(200);
    expect(Number(ok.body.item.price)).toBe(14.99);

    const bad = await api()
      .patch('/api/menu/1/price')
      .set(asUser('manager').headers)
      .send({ price: -1 });
    expect(bad.status).toBe(400);
  });

  test('MS-08 toggle active state', async () => {
    const res = await api()
      .patch('/api/menu/2/active')
      .set(asUser('manager').headers)
      .send({ active: true });

    expect(res.status).toBe(200);
    expect(res.body.item.active).toBe(true);
  });

  test('MS-09 cannot delete menu item referenced by orders', async () => {
    const res = await api()
      .delete('/api/menu/1')
      .set(asUser('manager').headers);

    expect(res.status).toBe(409);
  });

  test('MS-10 manager sales summary', async () => {
    const store = getMockStore();
    store.seedCollection('sales', [
      {
        id: 1,
        location_id: 1,
        menu_item_id: 1,
        order_id: 10,
        quantity: 2,
        total_price: 25.98,
        sold_at: new Date().toISOString(),
      },
    ]);

    const res = await api()
      .get('/api/sales?period=weekly')
      .set(asUser('manager').headers);

    expect(res.status).toBe(200);
    expect(res.body.summary.total_revenue).toBe(25.98);
    expect(res.body.summary.total_items_sold).toBe(2);
  });

  test('MS-11 waiter cannot access sales', async () => {
    const res = await api().get('/api/sales').set(asUser('waiter').headers);
    expect(res.status).toBe(403);
  });

  test('MS-12 owner filters sales by location', async () => {
    const store = getMockStore();
    const recent = new Date().toISOString();
    store.seedCollection('sales', [
      {
        id: 1,
        location_id: 1,
        menu_item_id: 1,
        order_id: 10,
        quantity: 1,
        total_price: 12.99,
        sold_at: recent,
      },
      {
        id: 2,
        location_id: 2,
        menu_item_id: 1,
        order_id: 11,
        quantity: 1,
        total_price: 12.99,
        sold_at: recent,
      },
    ]);

    const res = await api()
      .get('/api/sales?period=monthly&location_id=2')
      .set(asUser('owner').headers);

    expect(res.status).toBe(200);
    expect(res.body.sales.every((row) => row.location_id === 2)).toBe(true);
  });
});
