const {
  toNumber,
  byNameAsc,
  byCreatedAtDesc,
  roleRank,
  getById,
} = require('../../utils/firestoreStore');
const { seedMockDb, resetMockDb } = require('../helpers/mockFirestore');

describe('firestoreStore helpers', () => {
  beforeEach(() => {
    resetMockDb();
    seedMockDb({
      locations: [
        { id: 1, name: 'Alpha', created_at: '2026-01-02T00:00:00.000Z' },
        { id: 2, name: 'Beta', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
  });

  test('FS-01 toNumber parses valid integer string', () => {
    expect(toNumber('42')).toBe(42);
  });

  test('FS-02 toNumber returns null for invalid input', () => {
    expect(toNumber('abc')).toBeNull();
  });

  test('FS-03 getById returns null for invalid ids', async () => {
    expect(await getById('locations', 0)).toBeNull();
    expect(await getById('locations', -1)).toBeNull();
    expect(await getById('locations', 'x')).toBeNull();
  });

  test('FS-04 roleRank orders roles correctly', () => {
    expect(roleRank('owner')).toBeLessThan(roleRank('manager'));
    expect(roleRank('manager')).toBeLessThan(roleRank('waiter'));
    expect(roleRank('waiter')).toBeLessThan(roleRank('kitchen'));
  });

  test('FS-05 sort helpers order correctly', () => {
    const items = [
      { name: 'Zeta', created_at: '2026-01-01T00:00:00.000Z' },
      { name: 'Alpha', created_at: '2026-01-03T00:00:00.000Z' },
    ];
    expect([...items].sort(byNameAsc).map((i) => i.name)).toEqual(['Alpha', 'Zeta']);
    expect([...items].sort(byCreatedAtDesc).map((i) => i.created_at)).toEqual([
      '2026-01-03T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
    ]);
  });

  test('FS-06 getById returns document when present', async () => {
    const doc = await getById('locations', 1);
    expect(doc).toMatchObject({ id: 1, name: 'Alpha' });
  });
});
