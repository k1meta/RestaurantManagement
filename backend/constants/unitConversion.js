const ALLOWED_SET = new Set(['Kg', 'g', 'pieces', 'L', 'ml']);

/** @type {Record<string, 'mass'|'volume'|'count'>} */
const DIMENSION = {
  Kg: 'mass',
  g: 'mass',
  L: 'volume',
  ml: 'volume',
  pieces: 'count',
};

/**
 * @param {number} qty
 * @param {string|null|undefined} unit
 * @returns {{ dimension: string, value: number } | null}
 */
function toCanonical(qty, unit) {
  const u = unit == null || unit === '' ? null : String(unit).trim();
  if (!u || !ALLOWED_SET.has(u)) return null;
  const q = Number(qty);
  if (!Number.isFinite(q)) return null;

  switch (u) {
    case 'g':
      return { dimension: DIMENSION[u], value: q };
    case 'Kg':
      return { dimension: 'mass', value: q * 1000 };
    case 'ml':
      return { dimension: 'volume', value: q };
    case 'L':
      return { dimension: 'volume', value: q * 1000 };
    case 'pieces':
      return { dimension: 'count', value: q };
    default:
      return null;
  }
}

/**
 * @param {number} canonicalValue grams, ml, or piece count
 * @param {string} unit
 */
function fromCanonical(canonicalValue, unit) {
  const u = String(unit).trim();
  switch (u) {
    case 'g':
      return canonicalValue;
    case 'Kg':
      return canonicalValue / 1000;
    case 'ml':
      return canonicalValue;
    case 'L':
      return canonicalValue / 1000;
    case 'pieces':
      return canonicalValue;
    default:
      throw new Error(`fromCanonical: unsupported unit ${unit}`);
  }
}

function roundQty(q, decimals = 4) {
  const f = 10 ** decimals;
  return Math.round(q * f) / f;
}

/**
 * Subtract recipe usage from inventory when units may differ within the same dimension (L/ml, Kg/g).
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

  const usageCanon = toCanonical(usageQty, usageUnit);
  const invCanon = toCanonical(inventoryQty, inventoryUnit);
  if (!usageCanon || !invCanon) {
    return {
      ok: false,
      code: 'invalid_quantity',
      error: 'Invalid numeric quantity for stock deduction.',
    };
  }

  if (usageCanon.dimension !== invCanon.dimension) {
    return {
      ok: false,
      code: 'incompatible_units',
      error: `Cannot deduct: recipe uses "${usageUnit}" but inventory stock is tracked in "${inventoryUnit}". Use compatible units (Kg/g, L/ml, or pieces).`,
    };
  }

  const nextCanon = invCanon.value - usageCanon.value;
  const EPS = 1e-9;
  if (nextCanon < -EPS) {
    return {
      ok: false,
      code: 'insufficient_stock',
      error: `Insufficient stock for ingredient (needed ${usageQty} ${usageUnit}, have ${inventoryQty} ${inventoryUnit}).`,
    };
  }

  try {
    const nextQty = Math.max(0, fromCanonical(nextCanon, inventoryUnit));
    return { ok: true, nextQty: roundQty(nextQty, 4) };
  } catch (_e) {
    return {
      ok: false,
      code: 'conversion_failed',
      error: 'Could not convert stock units for deduction.',
    };
  }
}

module.exports = {
  toCanonical,
  fromCanonical,
  convertUsageForDeduction,
  roundQty,
};
