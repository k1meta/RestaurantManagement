/** Kinetic Editorial design tokens (from Google Stitch / DESIGN.md) */
export const colors = {
  primary: '#000000',
  onPrimary: '#ffffff',
  primaryContainer: '#1c1b1b',
  secondary: '#1b6d24',
  onSecondary: '#ffffff',
  secondaryContainer: '#a0f399',
  onSecondaryContainer: '#217128',
  tertiaryFixed: '#ffdbca',
  onTertiaryContainer: '#d76100',
  tertiaryContainer: '#331200',
  surface: '#fcf9f8',
  onSurface: '#1c1b1b',
  onSurfaceVariant: '#444748',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainerHigh: '#ebe7e7',
  surfaceContainerHighest: '#e5e2e1',
  surfaceContainerLowest: '#ffffff',
  surfaceTint: '#5f5e5e',
  outline: '#747878',
  outlineVariant: '#c4c7c7',
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',
  tertiaryFixedDim: '#ffb68f',
  onTertiaryFixedVariant: '#773200',
  onSecondaryFixedVariant: '#005312',
};

export const TARGET_PREP_MINUTES = 15;

export const radius = {
  sm: 2,
  md: 4,
  lg: 8,
};

export const fonts = {
  headline: 'SpaceGrotesk_700Bold',
  headlineBlack: 'SpaceGrotesk_700Bold',
  body: 'WorkSans_400Regular',
  label: 'WorkSans_600SemiBold',
};

export const statusAccent = {
  pending: colors.tertiaryFixed,
  preparing: colors.primary,
  ready: colors.secondary,
  closed: colors.outlineVariant,
};

export function minutesSince(timestamp) {
  const started = new Date(timestamp).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.round((Date.now() - started) / 60000));
}

export function tableLabel(tableNumber, orderId) {
  const t = String(tableNumber || '').trim();
  if (t) return t.length <= 4 ? `T-${t}` : t;
  return `#${orderId}`;
}

export function statusDisplay(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'pending') return { label: 'PENDING KITCHEN', accent: statusAccent.pending };
  if (s === 'preparing') return { label: 'PREPARING', accent: statusAccent.preparing };
  if (s === 'ready') return { label: 'READY', accent: statusAccent.ready };
  return { label: s.toUpperCase(), accent: statusAccent.closed };
}
