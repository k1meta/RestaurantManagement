const { parseAllowedUnit } = require('../../constants/units');

describe('units', () => {
  test('UU-01 accepts valid unit Kg', () => {
    expect(parseAllowedUnit('Kg')).toEqual({ ok: true, value: 'Kg' });
  });

  test('UU-02 treats empty/null as null value', () => {
    expect(parseAllowedUnit(null)).toEqual({ ok: true, value: null });
    expect(parseAllowedUnit('')).toEqual({ ok: true, value: null });
    expect(parseAllowedUnit(undefined)).toEqual({ ok: true, value: null });
  });

  test('UU-03 rejects invalid unit', () => {
    const result = parseAllowedUnit('lbs');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/unit must be one of/);
  });
});
