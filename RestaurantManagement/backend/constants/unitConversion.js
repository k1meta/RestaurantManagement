const { ALLOWED_UNITS } = require('./units');

const ALLOWED_SET = new Set(ALLOWED_UNITS);

function roundQty(q, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(q * f) / f;
}

/**
 * Subtract recipe usage from inventory (count units only; units must match exactly).
 * @returns {{ ok: true, nextQty: number } | { ok: false, code: string, error: string }}
 */
function convertUsageForDeduction(usageQty, usageUnitRaw, inventoryQty, inventoryUnitRaw) {
  const usageUnit =
    usageUnitRaw == null || usageUnitRaw === '' ? null : String(usageUnitRaw).trim();
  const inventoryUnit =
    inventoryUnitRaw == null || inventoryUnitRaw === ''
      ? null
      : String(inventoryUnitRaw).trim();

  if (!usageUnit || !inventoryUnit) {
    return {
      ok: false,
      code: 'missing_unit',
      error:
        'Recipe or inventory unit is missing; set units on menu ingredients and inventory so stock can be deducted.',
    };
  }

  if (!ALLOWED_SET.has(usageUnit) || !ALLOWED_SET.has(inventoryUnit)) {
    return {
      ok: false,
      code: 'unknown_unit',
      error: `Unsupported unit for deduction (recipe: "${usageUnit}", inventory: "${inventoryUnit}").`,
    };
  }

  const usage = Number(usageQty);
  const stock = Number(inventoryQty);
  if (!Number.isFinite(usage) || !Number.isFinite(stock)) {
    return {
      ok: false,
      code: 'invalid_quantity',
      error: 'Invalid numeric quantity for stock deduction.',
    };
  }

  if (usageUnit !== inventoryUnit) {
    return {
      ok: false,
      code: 'incompatible_units',
      error: `Cannot deduct: recipe uses "${usageUnit}" but inventory stock is tracked in "${inventoryUnit}". Use the same unit.`,
    };
  }

  const nextQty = stock - usage;
  const EPS = 1e-9;
  if (nextQty < -EPS) {
    return {
      ok: false,
      code: 'insufficient_stock',
      error: `Insufficient stock for ingredient (needed ${usageQty} ${usageUnit}, have ${inventoryQty} ${inventoryUnit}).`,
    };
  }

  return { ok: true, nextQty: roundQty(Math.max(0, nextQty), 4) };
}

module.exports = {
  convertUsageForDeduction,
  roundQty,
};
