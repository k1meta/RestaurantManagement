const { parseAllowedUnit } = require('../../constants/units');

describe('units', () => {
  test('UU-01 accepts valid unit cans', () => {
    expect(parseAllowedUnit('cans')).toEqual({ ok: true, value: 'cans' });
  });

  test('UU-02 treats empty/null as null value', () => {
    expect(parseAllowedUnit(null)).toEqual({ ok: true, value: null });
    expect(parseAllowedUnit('')).toEqual({ ok: true, value: null });
    expect(parseAllowedUnit(undefined)).toEqual({ ok: true, value: null });
  });

  test('UU-03 rejects invalid unit', () => {
    expect(parseAllowedUnit('Kg').ok).toBe(false);
    expect(parseAllowedUnit('lbs').ok).toBe(false);
    expect(parseAllowedUnit('Kg').error).toMatch(/unit must be one of/);
  });
});
