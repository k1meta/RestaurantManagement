/** Keep in sync with RestaurantManagement/backend/constants/units.js */
export const ALLOWED_UNITS = Object.freeze(['Kg', 'g', 'pieces', 'L', 'ml']);

export function isAllowedUnit(value) {
  const s = String(value ?? '').trim();
  return ALLOWED_UNITS.includes(s);
}
