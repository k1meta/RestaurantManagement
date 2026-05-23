import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../../theme/kinetic';

export default function KineticSectionTitle({ title, hint, actionLabel, onAction }) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.underline} />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },
  titleWrap: { flex: 1 },
  title: {
    fontFamily: fonts.headline,
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  underline: {
    height: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
    width: '100%',
    maxWidth: 200,
  },
  hint: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  action: {
    fontFamily: fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
