/** Canonical inventory/menu ingredient units (match frontend). */
const ALLOWED_UNITS = Object.freeze(['Kg', 'g', 'pieces', 'L', 'ml']);

const ALLOWED_SET = new Set(ALLOWED_UNITS);

/**
 * @param {*} value raw unit from client
 * @returns {{ ok: true, value: string|null } | { ok: false, error: string }}
 */
function parseAllowedUnit(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null };
  }
  const s = String(value).trim();
  if (!s) {
    return { ok: true, value: null };
  }
  if (!ALLOWED_SET.has(s)) {
    return {
      ok: false,
      error: `unit must be one of: ${ALLOWED_UNITS.join(', ')}`,
    };
  }
  return { ok: true, value: s };
}

module.exports = {
  ALLOWED_UNITS,
  parseAllowedUnit,
};
