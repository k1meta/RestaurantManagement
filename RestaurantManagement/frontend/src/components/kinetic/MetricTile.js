import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../../theme/kinetic';

export default function MetricTile({ label, value, variant = 'default', badge }) {
  const isReady = variant === 'ready';
  const isAlert = variant === 'alert';
  const isPrimary = variant === 'primary';

  return (
    <View
      style={[
        styles.tile,
        isReady && styles.ready,
        isAlert && styles.alert,
        isPrimary && styles.primary,
      ]}
    >
      <Text
        style={[
          styles.label,
          (isReady || isAlert || isPrimary) && styles.labelOnDark,
          isAlert && styles.labelAlert,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          isReady && styles.valueOnDark,
          isAlert && styles.valueAlert,
          isPrimary && styles.valueOnDark,
        ]}
      >
        {value}
      </Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    padding: 16,
    borderRadius: radius.sm,
    gap: 6,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  ready: { backgroundColor: colors.secondaryContainer },
  alert: { backgroundColor: colors.tertiaryFixed, borderLeftWidth: 4, borderLeftColor: colors.onTertiaryContainer },
  primary: { backgroundColor: colors.primary },
  label: {
    fontFamily: fonts.label,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: colors.onSurfaceVariant,
  },
  labelOnDark: { color: colors.onSecondary, opacity: 0.85 },
  labelAlert: { color: colors.onTertiaryFixedVariant, fontWeight: '700' },
  value: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  valueOnDark: { color: colors.onPrimary },
  valueAlert: { color: colors.onTertiaryFixedVariant },
  badge: {
    fontFamily: fonts.label,
    fontSize: 9,
    color: colors.onSecondaryContainer,
    textTransform: 'uppercase',
    marginTop: 4,
  },
});
