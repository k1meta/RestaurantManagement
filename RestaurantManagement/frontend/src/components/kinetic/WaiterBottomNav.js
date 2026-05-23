import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, fonts, radius } from '../../theme/kinetic';

const TABS = [
  { id: 'orders', label: 'Orders', icon: 'receipt-long' },
  { id: 'tables', label: 'Table Map', icon: 'grid-view' },
  { id: 'alerts', label: 'Alerts', icon: 'notifications' },
  { id: 'menu', label: 'Menu', icon: 'restaurant-menu' },
];

export default function WaiterBottomNav({ active = 'orders', onNewOrder }) {
  function handleTab(tab) {
    if (tab.id === 'orders') return;
    if (tab.id === 'menu' && onNewOrder) {
      onNewOrder();
      return;
    }
    Alert.alert('Coming soon', `${tab.label} will be available in a future update.`);
  }

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => handleTab(tab)}
            activeOpacity={0.85}
          >
            <MaterialIcons
              name={tab.icon}
              size={22}
              color={isActive ? colors.onPrimary : colors.onSurfaceVariant}
            />
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 8,
    minHeight: 72,
    borderTopWidth: 1,
    borderTopColor: 'rgba(28, 27, 27, 0.06)',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    opacity: 0.7,
  },
  tabActive: {
    backgroundColor: colors.primary,
    opacity: 1,
    borderRadius: radius.lg,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  tabLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    color: colors.onSurfaceVariant,
  },
  tabLabelActive: {
    color: colors.onPrimary,
    fontWeight: '700',
  },
});
