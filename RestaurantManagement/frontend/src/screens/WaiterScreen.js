import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getOrders, updateOrderStatus } from '../api/client';
import { useAuth } from '../context/AuthContext';
import WaiterBottomNav from '../components/kinetic/WaiterBottomNav';
import KineticHeader from '../components/kinetic/KineticHeader';
import MetricTile from '../components/kinetic/MetricTile';
import KineticSectionTitle from '../components/kinetic/KineticSectionTitle';
import {
  colors,
  fonts,
  radius,
  minutesSince,
  tableLabel,
  statusDisplay,
} from '../theme/kinetic';

function ReadyPickupCard({ order, onServe }) {
  const items = order.items || [];
  return (
    <View style={styles.pickupCard}>
      <View style={styles.pickupHeader}>
        <View>
          <Text style={styles.pickupTable}>{tableLabel(order.table_number, order.id)}</Text>
          <Text style={styles.pickupMeta}>Order #{order.id}</Text>
        </View>
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>READY</Text>
        </View>
      </View>
      <View style={styles.pickupItems}>
        {items.slice(0, 5).map((line) => (
          <Text key={line.id} style={styles.pickupItemLine}>
            {line.quantity}x {line.item_name || 'Item'}
          </Text>
        ))}
        {items.length > 5 ? (
          <Text style={styles.pickupItemLine}>+{items.length - 5} more</Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.serveBtn} onPress={() => onServe(order.id)} activeOpacity={0.9}>
        <Text style={styles.serveBtnText}>SERVE</Text>
      </TouchableOpacity>
    </View>
  );
}

function FloorTableCard({ order, onPress }) {
  const { label, accent } = statusDisplay(order.status);
  const mins = minutesSince(order.created_at);
  const itemCount = (order.items || []).reduce((s, i) => s + Number(i.quantity), 0);
  const total = order.total_amount != null ? Number(order.total_amount).toFixed(0) : '—';

  return (
    <TouchableOpacity
      style={[styles.floorCard, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.floorCardTop}>
        <Text style={styles.floorTableNum}>
          {String(order.table_number || order.id).slice(0, 4)}
        </Text>
        <Text style={[styles.floorMins, order.status === 'pending' && styles.floorMinsAlert]}>
          {mins}m
        </Text>
      </View>
      <View style={styles.floorCardBottom}>
        <Text style={styles.floorStatusLabel}>Status</Text>
        <Text
          style={[
            styles.floorStatus,
            order.status === 'pending' && { color: colors.onTertiaryContainer },
          ]}
        >
          {label}
        </Text>
        <Text style={styles.floorMeta}>
          {itemCount} Items • ${total}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function NewTableCard({ onPress }) {
  return (
    <TouchableOpacity style={styles.newTableCard} onPress={onPress} activeOpacity={0.85}>
      <MaterialIcons name="add" size={28} color={colors.outline} />
      <Text style={styles.newTableLabel}>New Order</Text>
    </TouchableOpacity>
  );
}

export default function WaiterScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getOrders({ include_items: true, include_closed: false });
      setOrders(res.data.orders || []);
    } catch (_err) {
      Alert.alert('Error', 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'closed'),
    [orders]
  );
  const readyOrders = useMemo(
    () => activeOrders.filter((o) => o.status === 'ready'),
    [activeOrders]
  );
  const floorOrders = useMemo(
    () => activeOrders.filter((o) => o.status !== 'ready'),
    [activeOrders]
  );

  const metrics = useMemo(() => {
    const pending = activeOrders.filter((o) => o.status === 'pending').length;
    const waits = activeOrders.map((o) => minutesSince(o.created_at));
    const avgWait = waits.length
      ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length)
      : 0;
    return {
      active: activeOrders.length,
      ready: readyOrders.length,
      avgWait,
      pending,
    };
  }, [activeOrders, readyOrders]);

  async function serveOrder(id) {
    try {
      await updateOrderStatus(id, 'closed');
      fetchOrders();
    } catch (_err) {
      Alert.alert('Error', 'Could not mark order as served');
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KineticHeader
        brand="KINETIC"
        subtitle={user?.name || 'Waiter'}
        userName={user?.name}
        onLogout={logout}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchOrders();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.shiftHeader}>
          <Text style={styles.shiftTitle}>Active Shift</Text>
          <Text style={styles.shiftSub}>
            {user?.location_name || 'Floor'} • Waiter
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile label="Active Tickets" value={String(metrics.active).padStart(2, '0')} />
          <MetricTile label="Ready to Serve" value={String(metrics.ready).padStart(2, '0')} variant="ready" />
        </View>
        <View style={styles.metricsRow}>
          <MetricTile label="Avg Wait Time" value={`${metrics.avgWait}m`} />
          <MetricTile label="Pending" value={String(metrics.pending).padStart(2, '0')} variant="alert" />
        </View>

        {readyOrders.length > 0 ? (
          <View style={styles.section}>
            <KineticSectionTitle title="Priority Pickups" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pickupList}
            >
              {readyOrders.map((item) => (
                <ReadyPickupCard key={item.id} order={item} onServe={serveOrder} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <KineticSectionTitle title="Floor Map Overview" hint="By wait time" />
          <View style={styles.floorGrid}>
            {floorOrders.map((order) => (
              <FloorTableCard
                key={order.id}
                order={order}
                onPress={() => {
                  if (order.status === 'ready') serveOrder(order.id);
                }}
              />
            ))}
            <NewTableCard onPress={() => navigation.navigate('NewOrder')} />
          </View>
          {activeOrders.length === 0 ? (
            <Text style={styles.empty}>No active orders — tap + to start a new ticket.</Text>
          ) : null}
        </View>
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewOrder')}
        activeOpacity={0.92}
      >
        <MaterialIcons name="add" size={32} color={colors.onPrimary} />
      </TouchableOpacity>

      <WaiterBottomNav active="orders" onNewOrder={() => navigation.navigate('NewOrder')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: { flex: 1, justifyContent: 'center', backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },
  shiftHeader: { marginTop: 8, marginBottom: 16 },
  shiftTitle: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  shiftSub: {
    fontFamily: fonts.label,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  section: { marginTop: 20 },
  pickupList: { gap: 12, paddingRight: 8 },
  pickupCard: {
    width: 280,
    backgroundColor: colors.surfaceContainerHighest,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.secondary,
    borderRadius: radius.sm,
  },
  pickupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pickupTable: {
    fontFamily: fonts.headlineBlack,
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
  },
  pickupMeta: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  readyBadge: {
    backgroundColor: colors.secondaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  readyBadgeText: {
    fontFamily: fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSecondaryContainer,
    textTransform: 'uppercase',
  },
  pickupItems: { marginBottom: 14, gap: 4 },
  pickupItemLine: { fontFamily: fonts.body, fontSize: 13, color: colors.onSurface },
  serveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  serveBtnText: {
    fontFamily: fonts.label,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  floorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  floorCard: {
    width: '47%',
    minHeight: 140,
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    justifyContent: 'space-between',
  },
  floorCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  floorTableNum: {
    fontFamily: fonts.headlineBlack,
    fontSize: 36,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 36,
  },
  floorMins: {
    fontFamily: fonts.label,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  floorMinsAlert: { color: colors.onTertiaryContainer },
  floorCardBottom: {},
  floorStatusLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  floorStatus: {
    fontFamily: fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  floorMeta: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 6,
  },
  newTableCard: {
    width: '47%',
    minHeight: 140,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(196, 199, 199, 0.3)',
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newTableLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.outline,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 88,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
});
