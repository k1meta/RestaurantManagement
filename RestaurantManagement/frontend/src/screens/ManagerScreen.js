import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ALLOWED_UNITS, isAllowedUnit } from '../constants/units';
import {
  getOrders,
  getInventory,
  upsertInventoryItem,
  deleteInventoryItem,
  getSales,
  getIngredients,
  createIngredient,
} from '../api/client';
import { useAuth } from '../context/AuthContext';
import KineticHeader from '../components/kinetic/KineticHeader';
import KineticTabBar from '../components/kinetic/KineticTabBar';
import KineticSectionTitle from '../components/kinetic/KineticSectionTitle';
import { colors, fonts, radius, statusDisplay } from '../theme/kinetic';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'sales', label: 'Sales' },
];

function normalizeInventory(inventory) {
  return inventory.map((item) => {
    const quantity = Number(item.quantity || 0);
    const rawFull = item.full_stock_target;
    const fullTarget =
      rawFull != null && rawFull !== '' && Number.isFinite(Number(rawFull))
        ? Number(rawFull)
        : Math.max(50, Math.round(quantity * 2) || 50);
    const percent = Math.min(100, Math.round((quantity / fullTarget) * 100));

    const rawLow = item.low_stock_threshold;
    let status = 'stable';
    if (rawLow != null && rawLow !== '' && Number.isFinite(Number(rawLow))) {
      const lowThresh = Number(rawLow);
      if (quantity < lowThresh) {
        status = quantity < lowThresh * 0.5 ? 'critical' : 'warning';
      }
    } else if (percent < 35) {
      status = 'critical';
    } else if (percent < 60) {
      status = 'warning';
    }

    return { ...item, quantity, target: fullTarget, percent, status };
  });
}

function InventoryCard({ item, onDelete }) {
  const barColor =
    item.status === 'critical'
      ? colors.error
      : item.status === 'warning'
        ? colors.onTertiaryContainer
        : colors.secondary;

  return (
    <View style={styles.invCard}>
      <View style={styles.invCardTop}>
        <Text style={styles.invName}>{item.ingredient}</Text>
        <View style={styles.invTopRight}>
          <Text style={[styles.invPct, item.status === 'critical' && { color: colors.error }]}>
            {item.percent}%
          </Text>
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${item.percent}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.invQty}>
        {item.quantity} {item.unit || 'units'} remaining
      </Text>
    </View>
  );
}

export default function ManagerScreen() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [ingredientsCatalog, setIngredientsCatalog] = useState([]);
  const [sales, setSales] = useState([]);
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [ingredientId, setIngredientId] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [fullStockTarget, setFullStockTarget] = useState('');

  useEffect(() => {
    if (tab === 'orders') fetchOrders();
    if (tab === 'inventory') fetchInventory();
    if (tab === 'sales') fetchSales();
  }, [tab, period]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const r = await getOrders({ include_closed: false });
      setOrders(r.data.orders || []);
    } catch {
      Alert.alert('Error', 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInventory() {
    setLoading(true);
    try {
      const [inventoryRes, ingredientsRes] = await Promise.all([getInventory(), getIngredients()]);
      setInventory(normalizeInventory(inventoryRes.data.inventory || []));
      setIngredientsCatalog(ingredientsRes.data.ingredients || []);
    } catch {
      Alert.alert('Error', 'Could not load inventory');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSales() {
    setLoading(true);
    try {
      const r = await getSales(period);
      setSales(r.data.sales || []);
    } catch {
      Alert.alert('Error', 'Could not load sales');
    } finally {
      setLoading(false);
    }
  }

  const lowStockItems = useMemo(
    () => inventory.filter((i) => i.status === 'critical' || i.status === 'warning'),
    [inventory]
  );

  async function addOrUpdateItem() {
    if (!quantity) {
      Alert.alert('Error', 'Quantity is required');
      return;
    }
    if (!ingredientId && !newIngredientName.trim()) {
      Alert.alert('Error', 'Select an ingredient or provide a new ingredient name');
      return;
    }

    const parseOpt = (raw) => {
      const t = String(raw ?? '').trim();
      if (!t) return undefined;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) return NaN;
      return n;
    };
    const lowN = parseOpt(lowStockThreshold);
    const fullN = parseOpt(fullStockTarget);
    if (Number.isNaN(lowN) || Number.isNaN(fullN)) {
      Alert.alert('Error', 'Thresholds must be empty or non-negative numbers');
      return;
    }
    if (lowN != null && fullN != null && lowN > fullN) {
      Alert.alert('Error', 'Low stock threshold cannot exceed full stock target');
      return;
    }

    const invUnit = String(unit || '').trim();
    if (!isAllowedUnit(invUnit)) {
      Alert.alert('Error', 'Select a stock unit (Kg, g, pieces, L, ml)');
      return;
    }

    try {
      let selectedIngredientId = ingredientId ? Number(ingredientId) : null;
      const defUnit = String(newIngredientUnit || '').trim();
      if (!selectedIngredientId) {
        if (!isAllowedUnit(defUnit)) {
          Alert.alert('Error', 'Select a default unit for the new ingredient');
          return;
        }
        const createRes = await createIngredient({
          name: newIngredientName.trim(),
          default_unit: defUnit,
        });
        selectedIngredientId = createRes.data.ingredient.id;
      }

      const payload = {
        ingredient_id: selectedIngredientId,
        quantity: parseFloat(quantity),
        unit: invUnit,
      };
      if (lowN !== undefined) payload.low_stock_threshold = lowN;
      if (fullN !== undefined) payload.full_stock_target = fullN;

      await upsertInventoryItem(payload);
      setModalVisible(false);
      setIngredientId('');
      setNewIngredientName('');
      setNewIngredientUnit('');
      setQuantity('');
      setUnit('');
      setLowStockThreshold('');
      setFullStockTarget('');
      fetchInventory();
    } catch {
      Alert.alert('Error', 'Could not save item');
    }
  }

  async function removeItem(id) {
    Alert.alert('Delete', 'Remove this ingredient?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInventoryItem(id);
            fetchInventory();
          } catch {
            Alert.alert('Error', 'Could not delete item');
          }
        },
      },
    ]);
  }

  function renderOrders() {
    return (
      <FlatList
        data={orders}
        keyExtractor={(o) => String(o.id)}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={
          <KineticSectionTitle title="Live Orders" hint={`${orders.length} open`} />
        }
        renderItem={({ item }) => {
          const { label, accent } = statusDisplay(item.status);
          return (
            <View style={[styles.orderCard, { borderLeftColor: accent }]}>
              <View style={styles.orderCardTop}>
                <Text style={styles.orderId}>#{item.id}</Text>
                <Text style={styles.orderStatus}>{label}</Text>
              </View>
              <Text style={styles.orderMeta}>
                Table {item.table_number || '—'} • {item.waiter_name || 'Staff'}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No open orders</Text>}
      />
    );
  }

  function renderInventory() {
    return (
      <FlatList
        data={inventory}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.listPad}
        ListHeaderComponent={
          <>
            {lowStockItems.length > 0 ? (
              <View style={styles.alertBox}>
                <View style={styles.alertTop}>
                  <MaterialIcons name="warning" size={20} color={colors.onTertiaryFixedVariant} />
                  <Text style={styles.alertTitle}>Low Inventory</Text>
                </View>
                <Text style={styles.alertBody}>
                  {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below threshold.
                  Review counts before service.
                </Text>
              </View>
            ) : null}
            <KineticSectionTitle title="Inventory Count" />
            <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
              <MaterialIcons name="add" size={20} color={colors.onPrimary} />
              <Text style={styles.addBtnText}>Add / Update Ingredient</Text>
            </TouchableOpacity>
          </>
        }
        renderItem={({ item }) => (
          <InventoryCard item={item} onDelete={() => removeItem(item.id)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No inventory items</Text>}
      />
    );
  }

  function renderSales() {
    const totalRevenue = sales.reduce((s, row) => s + parseFloat(row.total_revenue || 0), 0);
    return (
      <ScrollView contentContainerStyle={styles.listPad}>
        <KineticSectionTitle title="Sales Report" />
        <View style={styles.periodRow}>
          {['weekly', 'monthly', 'yearly'].map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.revenueHero}>
          <Text style={styles.revenueLabel}>Total Revenue</Text>
          <Text style={styles.revenueValue}>${totalRevenue.toFixed(0)}</Text>
        </View>
        {sales.map((s, i) => (
          <View key={i} style={styles.salesRow}>
            <Text style={styles.salesName}>{s.item_name}</Text>
            <Text style={styles.salesMeta}>
              {s.total_sold} sold • ${parseFloat(s.total_revenue).toFixed(2)}
            </Text>
          </View>
        ))}
        {sales.length === 0 ? <Text style={styles.empty}>No sales for this period</Text> : null}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KineticHeader
        brand="MISE EN PLACE"
        subtitle={`Location #${user?.location_id || '—'}`}
        userName={user?.name}
        onLogout={logout}
      />

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Manager Hub</Text>
        <Text style={styles.heroSub}>{user?.name}</Text>
      </View>

      <KineticTabBar tabs={TABS} active={tab} onChange={setTab} />

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : tab === 'orders' ? (
          renderOrders()
        ) : tab === 'inventory' ? (
          renderInventory()
        ) : (
          renderSales()
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Add / Update Ingredient</Text>
              <Text style={styles.fieldHint}>Catalog: {ingredientsCatalog.length} ingredients</Text>

              <Text style={styles.fieldLabel}>Existing ingredient id</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 1"
                placeholderTextColor={colors.onSurfaceVariant}
                value={ingredientId}
                onChangeText={setIngredientId}
              />

              <Text style={styles.fieldLabel}>Or new ingredient name</Text>
              <TextInput
                style={styles.input}
                placeholder="Ingredient name"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newIngredientName}
                onChangeText={setNewIngredientName}
              />

              <Text style={styles.fieldLabel}>New ingredient default unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {ALLOWED_UNITS.map((u) => (
                  <TouchableOpacity
                    key={`newdef-${u}`}
                    style={[styles.chip, newIngredientUnit === u && styles.chipActive]}
                    onPress={() => setNewIngredientUnit(u)}
                  >
                    <Text style={[styles.chipText, newIngredientUnit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Quantity</Text>
              <TextInput
                style={styles.input}
                placeholder="Quantity"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="numeric"
                value={quantity}
                onChangeText={setQuantity}
              />

              <Text style={styles.fieldLabel}>Stock unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {ALLOWED_UNITS.map((u) => (
                  <TouchableOpacity
                    key={`inv-${u}`}
                    style={[styles.chip, unit === u && styles.chipActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Low stock threshold (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Below = low stock"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={lowStockThreshold}
                onChangeText={setLowStockThreshold}
              />

              <Text style={styles.fieldLabel}>Full stock target (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Refill-to level"
                placeholderTextColor={colors.onSurfaceVariant}
                keyboardType="decimal-pad"
                value={fullStockTarget}
                onChangeText={setFullStockTarget}
              />

              <TouchableOpacity style={styles.saveBtn} onPress={addOrUpdateItem}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setLowStockThreshold('');
                  setFullStockTarget('');
                  setUnit('');
                  setNewIngredientUnit('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1 },
  hero: { paddingHorizontal: 16, marginBottom: 8 },
  heroTitle: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  listPad: { paddingHorizontal: 16, paddingBottom: 32 },
  orderCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
  },
  orderCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderId: { fontFamily: fonts.headline, fontSize: 18, fontWeight: '700', color: colors.primary },
  orderStatus: { fontFamily: fonts.label, fontSize: 10, color: colors.onSurfaceVariant, textTransform: 'uppercase' },
  orderMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.onSurfaceVariant },
  alertBox: {
    backgroundColor: colors.tertiaryFixed,
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  alertTitle: {
    fontFamily: fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: colors.onTertiaryFixedVariant,
    textTransform: 'uppercase',
  },
  alertBody: { fontFamily: fonts.body, fontSize: 13, color: colors.onTertiaryFixedVariant },
  invCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    marginBottom: 10,
    borderRadius: radius.sm,
  },
  invCardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  invName: { fontFamily: fonts.headline, fontSize: 15, fontWeight: '600', color: colors.primary, flex: 1 },
  invTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invPct: { fontFamily: fonts.label, fontSize: 13, fontWeight: '700', color: colors.secondary },
  progressTrack: {
    height: 8,
    backgroundColor: colors.surfaceContainerHighest,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  invQty: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 6,
    textAlign: 'right',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  addBtnText: {
    fontFamily: fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radius.sm,
  },
  periodActive: { backgroundColor: colors.primary },
  periodText: {
    fontFamily: fonts.label,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  periodTextActive: { color: colors.onPrimary },
  revenueHero: {
    backgroundColor: colors.primary,
    padding: 20,
    borderRadius: radius.sm,
    marginBottom: 16,
  },
  revenueLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onPrimary,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  revenueValue: {
    fontFamily: fonts.headlineBlack,
    fontSize: 36,
    fontWeight: '900',
    color: colors.onPrimary,
    marginTop: 4,
  },
  salesRow: {
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    marginBottom: 8,
    borderRadius: radius.sm,
  },
  salesName: { fontFamily: fonts.headline, fontSize: 15, fontWeight: '700', color: colors.primary },
  salesMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.onSurfaceVariant, marginTop: 4 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 32,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalScroll: { maxHeight: '90%' },
  modal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontFamily: fonts.headline,
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldHint: { fontFamily: fonts.body, fontSize: 12, color: colors.onSurfaceVariant, marginBottom: 12 },
  fieldLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surfaceContainerHigh,
    color: colors.onSurface,
    fontFamily: fonts.body,
    fontSize: 15,
    padding: 12,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  chipRow: { flexGrow: 0, marginBottom: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceContainerLow,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.label, fontSize: 12, color: colors.onSurfaceVariant },
  chipTextActive: { color: colors.onPrimary },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: {
    fontFamily: fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cancelText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 14,
  },
});
