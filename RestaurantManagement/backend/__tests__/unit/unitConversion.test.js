const {
  toCanonical,
  fromCanonical,
  convertUsageForDeduction,
  roundQty,
} = require('../../constants/unitConversion');

describe('unitConversion', () => {
  describe('toCanonical', () => {
    test('UC-01 converts grams', () => {
      expect(toCanonical(500, 'g')).toEqual({ dimension: 'mass', value: 500 });
    });

    test('UC-02 converts Kg to grams', () => {
      expect(toCanonical(2, 'Kg')).toEqual({ dimension: 'mass', value: 2000 });
    });

    test('UC-03 converts L to ml', () => {
      expect(toCanonical(1, 'L')).toEqual({ dimension: 'volume', value: 1000 });
    });

    test('UC-04 converts pieces', () => {
      expect(toCanonical(3, 'pieces')).toEqual({ dimension: 'count', value: 3 });
    });

    test('UC-05 rejects invalid unit', () => {
      expect(toCanonical(1, 'oz')).toBeNull();
    });

    test('UC-06 rejects invalid quantity', () => {
      expect(toCanonical('abc', 'g')).toBeNull();
    });
  });

  describe('fromCanonical', () => {
    test('UC-07 round-trips Kg and g', () => {
      expect(fromCanonical(2000, 'Kg')).toBe(2);
      expect(fromCanonical(500, 'g')).toBe(500);
      expect(fromCanonical(1000, 'L')).toBe(1);
      expect(fromCanonical(500, 'ml')).toBe(500);
    });
  });

  describe('convertUsageForDeduction', () => {
    test('UC-08 deducts within same dimension (g from Kg stock)', () => {
      const result = convertUsageForDeduction(500, 'g', 2, 'Kg');
      expect(result).toEqual({ ok: true, nextQty: 1.5 });
    });

    test('UC-09 rejects cross-dimension units', () => {
      const result = convertUsageForDeduction(1, 'L', 100, 'g');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('incompatible_units');
    });

    test('UC-10 rejects insufficient stock', () => {
      const result = convertUsageForDeduction(5, 'Kg', 2, 'Kg');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('insufficient_stock');
    });

    test('UC-11 rejects missing unit', () => {
      const result = convertUsageForDeduction(1, null, 2, 'Kg');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('missing_unit');
    });
  });

  describe('roundQty', () => {
    test('UC-12 rounds to four decimal places', () => {
      expect(roundQty(1.23456789)).toBe(1.2346);
      expect(roundQty(0.1 + 0.2, 4)).toBe(0.3);
    });
  });
});
