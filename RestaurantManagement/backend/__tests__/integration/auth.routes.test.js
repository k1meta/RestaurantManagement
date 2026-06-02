const { api, setupTestDb, asUser } = require('../helpers/testApp');
const { DEFAULT_PASSWORD } = require('../helpers/fixtures');

describe('auth routes', () => {
  beforeEach(() => {
    process.env.ENABLE_LOGIN_PROFILES = 'true';
    setupTestDb();
  });

  test('AU-01 login with valid credentials', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'waiter@restaurant.com', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('waiter');
  });

  test('AU-02 login with wrong password', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'waiter@restaurant.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid credentials/);
  });

  test('AU-03 login missing fields', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'waiter@restaurant.com' });
    expect(res.status).toBe(400);
  });

  test('AU-04 manager creates waiter via POST /api/users', async () => {
    const { headers } = asUser('manager');
    const res = await api()
      .post('/api/users')
      .set(headers)
      .send({
        name: 'New Waiter',
        email: 'newwaiter@test.com',
        password: 'password123',
        role: 'waiter',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('newwaiter@test.com');
    expect(res.body.user.role).toBe('waiter');
  });

  test('AU-05 create user duplicate email', async () => {
    const { headers } = asUser('manager');
    const res = await api()
      .post('/api/users')
      .set(headers)
      .send({
        name: 'Duplicate',
        email: 'waiter@restaurant.com',
        password: 'password123',
        role: 'waiter',
      });

    expect(res.status).toBe(409);
  });

  test('AU-06 manager cannot create owner', async () => {
    const { headers } = asUser('manager');
    const res = await api()
      .post('/api/users')
      .set(headers)
      .send({
        name: 'Bad Role',
        email: 'badrole@test.com',
        password: 'password123',
        role: 'owner',
      });

    expect(res.status).toBe(403);
  });

  test('AU-07 owner create user with non-existent location', async () => {
    const { headers } = asUser('owner');
    const res = await api()
      .post('/api/users')
      .set(headers)
      .send({
        name: 'No Loc',
        email: 'noloc@test.com',
        password: 'password123',
        role: 'waiter',
        location_id: 999,
      });

    expect(res.status).toBe(404);
  });

  test('AU-08 get me when authenticated', async () => {
    const { headers } = asUser('manager');
    const res = await api().get('/api/auth/me').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('manager');
  });

  test('AU-09 get me without token', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('AU-10 patch language success and failure', async () => {
    const { headers } = asUser('waiter');

    const ok = await api().patch('/api/auth/language').set(headers).send({ language: 'tr' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.preferred_language).toBe('tr');

    const bad = await api().patch('/api/auth/language').set(headers).send({ language: 123 });
    expect(bad.status).toBe(400);
  });

  test('AU-11 login profiles sorted by role when enabled', async () => {
    const res = await api().get('/api/auth/login-profiles');
    expect(res.status).toBe(200);
    expect(res.body.profiles.length).toBeGreaterThan(0);
    expect(res.body.profiles[0].role).toBe('owner');
  });

  test('AU-12 login profiles disabled when flag off', async () => {
    process.env.ENABLE_LOGIN_PROFILES = 'false';
    const res = await api().get('/api/auth/login-profiles');
    expect(res.status).toBe(404);
  });

  test('AU-13 unauthenticated POST /api/users rejected', async () => {
    const res = await api()
      .post('/api/users')
      .send({
        name: 'No Auth',
        email: 'noauth@test.com',
        password: 'password123',
        role: 'waiter',
      });

    expect(res.status).toBe(401);
  });

  test('AU-14 removed public register route returns 404', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({
        name: 'Public Register',
        email: 'public@test.com',
        password: 'password123',
        role: 'waiter',
        location_id: 1,
      });

    expect(res.status).toBe(404);
  });
});
