import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme/kinetic';

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function KineticHeader({
  brand = 'KINETIC',
  subtitle,
  userName,
  onMenuPress,
  onLogout,
  showAvatar = true,
  rightElement,
}) {
  function openMenu() {
    if (onMenuPress) {
      onMenuPress();
      return;
    }
    if (!onLogout) return;
    Alert.alert('Account', undefined, [
      { text: 'Log out', style: 'destructive', onPress: onLogout },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <TouchableOpacity onPress={openMenu} style={styles.menuBtn} hitSlop={12}>
          <MaterialIcons name="menu" size={24} color={colors.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.brand}>{brand}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightElement || (showAvatar ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(userName || subtitle)}</Text>
        </View>
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(28, 27, 27, 0.06)',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  menuBtn: { padding: 4 },
  brand: {
    fontFamily: fonts.headlineBlack,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  avatarText: {
    fontFamily: fonts.label,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
});
