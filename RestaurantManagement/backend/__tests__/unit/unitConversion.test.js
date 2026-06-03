const { convertUsageForDeduction, roundQty } = require('../../constants/unitConversion');

describe('unitConversion', () => {
  describe('convertUsageForDeduction', () => {
    test('UC-01 deducts when recipe and inventory use the same unit (cans)', () => {
      const result = convertUsageForDeduction(2, 'cans', 10, 'cans');
      expect(result).toEqual({ ok: true, nextQty: 8 });
    });

    test('UC-02 deducts pieces from pieces stock', () => {
      const result = convertUsageForDeduction(3, 'pieces', 50, 'pieces');
      expect(result).toEqual({ ok: true, nextQty: 47 });
    });

    test('UC-03 rejects different count units (buns vs pieces)', () => {
      const result = convertUsageForDeduction(2, 'buns', 10, 'pieces');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('incompatible_units');
    });

    test('UC-04 rejects legacy mass unit Kg', () => {
      const result = convertUsageForDeduction(1, 'Kg', 10, 'Kg');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('unknown_unit');
    });

    test('UC-05 rejects invalid quantity', () => {
      const result = convertUsageForDeduction('abc', 'cans', 10, 'cans');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('invalid_quantity');
    });

    test('UC-06 rejects insufficient stock', () => {
      const result = convertUsageForDeduction(5, 'patties', 2, 'patties');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('insufficient_stock');
    });

    test('UC-07 rejects missing unit', () => {
      const result = convertUsageForDeduction(1, null, 2, 'cans');
      expect(result.ok).toBe(false);
      expect(result.code).toBe('missing_unit');
    });
  });

  describe('roundQty', () => {
    test('UC-08 rounds to four decimal places', () => {
      expect(roundQty(1.23456789)).toBe(1.2346);
      expect(roundQty(0.1 + 0.2, 4)).toBe(0.3);
    });
  });
});
