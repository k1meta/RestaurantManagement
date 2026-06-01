const { api, setupTestDb, asUser } = require('../helpers/testApp');

describe('server health', () => {
  beforeEach(() => {
    setupTestDb();
  });

  test('SV-01 health endpoint', async () => {
    const res = await api().get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('SV-02 unknown route returns 404', async () => {
    const res = await api().get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/);
  });
});
