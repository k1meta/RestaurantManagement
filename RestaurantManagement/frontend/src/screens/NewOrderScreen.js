import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getMenu, createOrder } from '../api/client';
import { colors, fonts, radius } from '../theme/kinetic';

export default function NewOrderScreen({ navigation }) {
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState({});
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMenu()
      .then((res) => setMenu(res.data.menu || []))
      .catch(() => Alert.alert('Error', 'Could not load menu'))
      .finally(() => setLoading(false));
  }, []);

  function changeQty(id, delta) {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  async function submitOrder() {
    const items = Object.entries(cart).map(([menu_item_id, quantity]) => ({
      menu_item_id: parseInt(menu_item_id, 10),
      quantity,
    }));

    if (items.length === 0) {
      Alert.alert('Empty order', 'Add at least one item to the order.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({ table_number: tableNumber, notes, items });
      Alert.alert('Order created', 'The kitchen has been notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  const categories = useMemo(() => [...new Set(menu.map((i) => i.category))], [menu]);
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = useMemo(() => {
    return menu.reduce((sum, item) => {
      const qty = cart[item.id] || 0;
      return sum + qty * parseFloat(item.price || 0);
    }, 0);
  }, [menu, cart]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageLabel}>New ticket</Text>
        <Text style={styles.title}>Build Order</Text>

        <Text style={styles.fieldLabel}>Table</Text>
        <TextInput
          style={styles.input}
          placeholder="Table number (e.g. 12, B2)"
          placeholderTextColor={colors.onSurfaceVariant}
          value={tableNumber}
          onChangeText={setTableNumber}
        />

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Allergies, modifiers, guest requests…"
          placeholderTextColor={colors.onSurfaceVariant}
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {categories.map((cat) => (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={styles.categoryTitle}>{String(cat).toUpperCase()}</Text>
            {menu
              .filter((i) => i.category === cat)
              .map((item) => (
                <View key={item.id} style={styles.menuRow}>
                  <View style={styles.menuInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>
                      ${parseFloat(item.price).toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => changeQty(item.id, -1)}
                    >
                      <Text style={styles.qtyBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.qty}>{cart[item.id] || 0}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => changeQty(item.id, 1)}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.submitBar}>
        <View>
          <Text style={styles.cartCount}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.cartTotal}>${cartTotal.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submitOrder}
          disabled={submitting}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Send to Kitchen</Text>
              <MaterialIcons name="arrow-forward" size={18} color={colors.onPrimary} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: { flex: 1, justifyContent: 'center', backgroundColor: colors.surface },
  scroll: { padding: 16, paddingBottom: 120 },
  pageLabel: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  title: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 15,
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 14,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  categoryBlock: { marginTop: 8 },
  categoryTitle: {
    fontFamily: fonts.label,
    fontSize: 11,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    letterSpacing: 1.5,
    marginTop: 12,
    marginBottom: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    padding: 12,
    marginBottom: 8,
    borderRadius: radius.sm,
  },
  menuInfo: { flex: 1 },
  itemName: {
    fontFamily: fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: colors.onSurface,
  },
  itemPrice: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    backgroundColor: colors.surfaceContainerHighest,
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontFamily: fonts.headline,
    fontSize: 18,
    color: colors.primary,
    lineHeight: 20,
  },
  qty: {
    fontFamily: fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
    color: colors.onSurface,
  },
  submitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: 24,
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196, 199, 199, 0.2)',
  },
  cartCount: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cartTotal: {
    fontFamily: fonts.headlineBlack,
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 2,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radius.sm,
  },
  submitBtnText: {
    fontFamily: fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
