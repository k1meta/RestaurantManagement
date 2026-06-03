const { api, setupTestDb, asUser } = require('../helpers/testApp');
const { getMockStore } = require('../helpers/mockFirestore');

describe('inventory routes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('IN-01 manager sees location-scoped inventory', async () => {
    const res = await api().get('/api/inventory').set(asUser('manager').headers);
    expect(res.status).toBe(200);
    expect(res.body.inventory.length).toBeGreaterThan(0);
    expect(res.body.inventory.every((row) => row.location_id === 1)).toBe(true);
    expect(res.body.inventory[0].ingredient).toBeDefined();
  });

  test('IN-02 create inventory with ingredient_id', async () => {
    const res = await api()
      .post('/api/inventory')
      .set(asUser('manager').headers)
      .send({
        ingredient_id: 1,
        quantity: 5,
        unit: 'cans',
        low_stock_threshold: 1,
        full_stock_target: 10,
      });

    expect(res.status).toBe(201);
    expect(res.body.item.quantity).toBe(5);
  });

  test('IN-03 create inventory by ingredient name', async () => {
    const res = await api()
      .post('/api/inventory')
      .set(asUser('manager').headers)
      .send({
        ingredient: 'Fresh Basil',
        quantity: 2,
        unit: 'buns',
      });

    expect(res.status).toBe(201);
    expect(res.body.item.ingredient).toBe('Fresh Basil');
  });

  test('IN-04 low threshold greater than full rejected', async () => {
    const res = await api()
      .post('/api/inventory')
      .set(asUser('manager').headers)
      .send({
        ingredient_id: 2,
        quantity: 1,
        unit: 'pieces',
        low_stock_threshold: 10,
        full_stock_target: 5,
      });

    expect(res.status).toBe(400);
  });

  test('IN-05 invalid unit rejected', async () => {
    const res = await api()
      .post('/api/inventory')
      .set(asUser('manager').headers)
      .send({
        ingredient_id: 1,
        quantity: 1,
        unit: 'oz',
      });

    expect(res.status).toBe(400);
  });

  test('IN-06 waiter cannot create inventory', async () => {
    const res = await api()
      .post('/api/inventory')
      .set(asUser('waiter').headers)
      .send({ ingredient_id: 1, quantity: 1, unit: 'cans' });

    expect(res.status).toBe(403);
  });

  test('IN-07 patch inventory quantity and 404', async () => {
    const ok = await api()
      .patch('/api/inventory/1')
      .set(asUser('manager').headers)
      .send({ quantity: 8 });

    expect(ok.status).toBe(200);
    expect(ok.body.item.quantity).toBe(8);

    const missing = await api()
      .patch('/api/inventory/999')
      .set(asUser('manager').headers)
      .send({ quantity: 1 });
    expect(missing.status).toBe(404);
  });

  test('IN-08 delete inventory row', async () => {
    const res = await api()
      .delete('/api/inventory/2')
      .set(asUser('manager').headers);

    expect(res.status).toBe(200);
  });

  test('IN-09 create ingredient and duplicate name upserts', async () => {
    const created = await api()
      .post('/api/inventory/ingredients')
      .set(asUser('manager').headers)
      .send({ name: 'Basil', default_unit: 'cans' });

    expect(created.status).toBe(201);

    const duplicate = await api()
      .post('/api/inventory/ingredients')
      .set(asUser('manager').headers)
      .send({ name: 'Basil', default_unit: 'patties' });

    expect(duplicate.status).toBe(201);
    expect(duplicate.body.ingredient.name).toBe('Basil');
  });

  test('IN-10 cannot delete ingredient with inventory', async () => {
    const res = await api()
      .delete('/api/inventory/ingredients/1')
      .set(asUser('manager').headers);

    expect(res.status).toBe(409);
  });
});
