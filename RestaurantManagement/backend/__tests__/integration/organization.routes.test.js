const { api, setupTestDb, asUser } = require('../helpers/testApp');

describe('organization routes', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('OR-01 locations scoped by role', async () => {
    const ownerRes = await api().get('/api/locations').set(asUser('owner').headers);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.locations.length).toBe(3);

    const waiterRes = await api().get('/api/locations').set(asUser('waiter').headers);
    expect(waiterRes.status).toBe(200);
    expect(waiterRes.body.locations).toHaveLength(1);
    expect(waiterRes.body.locations[0].id).toBe(1);
  });

  test('OR-02 owner creates location', async () => {
    const res = await api()
      .post('/api/locations')
      .set(asUser('owner').headers)
      .send({ name: 'New Branch', address: '99 Test St' });

    expect(res.status).toBe(201);
    expect(res.body.location.name).toBe('New Branch');
  });

  test('OR-03 manager cannot create location', async () => {
    const res = await api()
      .post('/api/locations')
      .set(asUser('manager').headers)
      .send({ name: 'Blocked' });

    expect(res.status).toBe(403);
  });

  test('OR-04 empty location name rejected', async () => {
    const res = await api()
      .post('/api/locations')
      .set(asUser('owner').headers)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  test('OR-05 patch location update and validation', async () => {
    const ok = await api()
      .patch('/api/locations/1')
      .set(asUser('owner').headers)
      .send({ name: 'Renamed Downtown' });

    expect(ok.status).toBe(200);
    expect(ok.body.location.name).toBe('Renamed Downtown');

    const empty = await api()
      .patch('/api/locations/1')
      .set(asUser('owner').headers)
      .send({ name: '' });
    expect(empty.status).toBe(400);

    const missing = await api()
      .patch('/api/locations/999')
      .set(asUser('owner').headers)
      .send({ name: 'Nope' });
    expect(missing.status).toBe(404);
  });

  test('OR-06 cannot delete location in use', async () => {
    const res = await api().delete('/api/locations/1').set(asUser('owner').headers);
    expect(res.status).toBe(409);
    expect(res.body.usage).toBeDefined();
  });

  test('OR-07 delete unused location', async () => {
    const res = await api().delete('/api/locations/3').set(asUser('owner').headers);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('OR-08 owner filters users by location', async () => {
    const res = await api()
      .get('/api/users?location_id=2')
      .set(asUser('owner').headers);

    expect(res.status).toBe(200);
    expect(res.body.users.every((u) => u.location_id === 2)).toBe(true);
  });

  test('OR-09 waiter cannot list users', async () => {
    const res = await api().get('/api/users').set(asUser('waiter').headers);
    expect(res.status).toBe(403);
  });

  test('OR-10 manager creates waiter at own location', async () => {
    const res = await api()
      .post('/api/users')
      .set(asUser('manager').headers)
      .send({
        name: 'Staff New',
        email: 'staffnew@test.com',
        password: 'password123',
        role: 'waiter',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.location_id).toBe(1);
  });

  test('OR-11 manager cannot create manager role', async () => {
    const res = await api()
      .post('/api/users')
      .set(asUser('manager').headers)
      .send({
        name: 'Bad Manager',
        email: 'badmgr@test.com',
        password: 'password123',
        role: 'manager',
      });

    expect(res.status).toBe(403);
  });

  test('OR-12 short password rejected', async () => {
    const res = await api()
      .post('/api/users')
      .set(asUser('owner').headers)
      .send({
        name: 'Short Pass',
        email: 'short@test.com',
        password: '123',
        role: 'waiter',
        location_id: 1,
      });

    expect(res.status).toBe(400);
  });

  test('OR-13 manager cannot modify another manager', async () => {
    const res = await api()
      .patch('/api/users/6')
      .set(asUser('manager').headers)
      .send({ name: 'Blocked Edit' });

    expect(res.status).toBe(403);
  });

  test('OR-14 manager cannot modify owner', async () => {
    const res = await api()
      .patch('/api/users/1')
      .set(asUser('manager').headers)
      .send({ name: 'Blocked Owner' });

    expect(res.status).toBe(403);
  });

  test('OR-15 delete user success and self-delete blocked', async () => {
    const create = await api()
      .post('/api/users')
      .set(asUser('manager').headers)
      .send({
        name: 'Temp Waiter',
        email: 'tempwaiter@test.com',
        password: 'password123',
        role: 'waiter',
      });
    expect(create.status).toBe(201);
    const newId = create.body.user.id;

    const selfDelete = await api()
      .delete(`/api/users/${asUser('manager').user.id}`)
      .set(asUser('manager').headers);
    expect(selfDelete.status).toBe(400);

    const deleted = await api()
      .delete(`/api/users/${newId}`)
      .set(asUser('manager').headers);
    expect(deleted.status).toBe(200);
  });
});
