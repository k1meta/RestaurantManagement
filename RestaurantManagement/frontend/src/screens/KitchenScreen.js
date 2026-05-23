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
import KineticHeader from '../components/kinetic/KineticHeader';
import MetricTile from '../components/kinetic/MetricTile';
import KineticSectionTitle from '../components/kinetic/KineticSectionTitle';
import {
  colors,
  fonts,
  radius,
  minutesSince,
  TARGET_PREP_MINUTES,
} from '../theme/kinetic';

function toClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function KitchenTicket({ order, onBump, onReady }) {
  const mins = minutesSince(order.created_at);
  const isReady = order.status === 'ready';
  const isPending = order.status === 'pending';
  const isDelayed = !isReady && mins > TARGET_PREP_MINUTES;
  const items = order.items || [];

  const borderColor = isReady
    ? colors.secondary
    : isDelayed
      ? colors.tertiaryFixedDim
      : colors.primary;

  return (
    <View style={[styles.ticket, { borderLeftColor: borderColor }, isReady && styles.ticketReady]}>
      {!isReady ? (
        <View style={[styles.ticketBanner, isDelayed ? styles.bannerUrgent : styles.bannerNormal]}>
          <Text style={[styles.bannerLabel, isDelayed && styles.bannerLabelUrgent]}>
            {isDelayed ? `Urgent — ${mins - TARGET_PREP_MINUTES}m over target` : isPending ? 'Pending' : 'Preparing'}
          </Text>
          <Text style={[styles.bannerTime, isDelayed && styles.bannerLabelUrgent]}>
            {toClock(order.created_at)} ({mins}m)
          </Text>
        </View>
      ) : null}

      <View style={styles.ticketBody}>
        <View style={styles.ticketTop}>
          <Text style={[styles.ticketId, isReady && styles.ticketIdReady]}>#{order.id}</Text>
          <View style={styles.tableChip}>
            <Text style={styles.tableChipText}>
              {order.table_number ? `Table ${order.table_number}` : 'Walk-in'}
            </Text>
          </View>
        </View>

        {isReady ? (
          <View style={styles.readyRow}>
            <Text style={styles.readyTitle}>Ready — waiting for runner</Text>
            <MaterialIcons name="check-circle" size={22} color={colors.secondary} />
          </View>
        ) : (
          <>
            <View style={styles.items}>
              {items.length === 0 ? (
                <Text style={styles.itemNote}>No line items loaded</Text>
              ) : (
                items.map((line) => (
                  <View key={line.id} style={styles.itemRow}>
                    <View style={styles.qtyBox}>
                      <Text style={styles.qtyText}>{line.quantity}</Text>
                    </View>
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemName}>{line.item_name || 'Item'}</Text>
                      {line.notes ? (
                        <Text style={styles.itemNote}>{line.notes}</Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
            {order.notes ? (
              <Text style={styles.orderNotes}>{order.notes}</Text>
            ) : null}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.bumpBtn, isPending && styles.bumpBtnDisabled]}
                onPress={() => onBump(order)}
                disabled={!isPending}
                activeOpacity={0.9}
              >
                <Text style={styles.bumpBtnText}>Bump</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.readyBtn}
                onPress={() => onReady(order)}
                activeOpacity={0.9}
              >
                <Text style={styles.readyBtnText}>Mark Ready</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default function KitchenScreen() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getOrders({
        include_items: true,
        status: 'pending,preparing,ready',
      });
      setOrders(res.data.orders || []);
    } catch {
      Alert.alert('Error', 'Could not load kitchen queue');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const queue = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aDelay = a.status !== 'ready' && minutesSince(a.created_at) > TARGET_PREP_MINUTES ? 1 : 0;
      const bDelay = b.status !== 'ready' && minutesSince(b.created_at) > TARGET_PREP_MINUTES ? 1 : 0;
      if (aDelay !== bDelay) return bDelay - aDelay;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders]);

  const stats = useMemo(() => {
    const active = queue.filter((o) => o.status !== 'ready').length;
    const delayed = queue.filter(
      (o) => o.status !== 'ready' && minutesSince(o.created_at) > TARGET_PREP_MINUTES
    ).length;
    const ready = queue.filter((o) => o.status === 'ready').length;
    const prepTimes = queue.filter((o) => o.status !== 'ready').map((o) => minutesSince(o.created_at));
    const avgPrep = prepTimes.length
      ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
      : 0;
    return { active, delayed, ready, avgPrep };
  }, [queue]);

  const clock = useMemo(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [orders]
  );

  async function bumpOrder(order) {
    if (order.status !== 'pending') return;
    try {
      await updateOrderStatus(order.id, 'preparing');
      fetchOrders();
    } catch {
      Alert.alert('Error', 'Could not update order');
    }
  }

  async function markReady(order) {
    if (order.status === 'ready') return;
    try {
      await updateOrderStatus(order.id, 'ready');
      fetchOrders();
    } catch {
      Alert.alert('Error', 'Could not mark order as ready');
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
        subtitle="Kitchen line"
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
        <View style={styles.heroRow}>
          <View>
            <Text style={styles.heroTitle}>Kitchen</Text>
            <Text style={styles.heroSub}>
              {user?.location_name || 'Main line'} • {user?.name}
            </Text>
          </View>
          <Text style={styles.clock}>{clock}</Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile label="Active Tickets" value={String(stats.active).padStart(2, '0')} />
          <MetricTile
            label="Avg Prep Time"
            value={`${stats.avgPrep}m`}
            badge={`Target ${TARGET_PREP_MINUTES}m`}
          />
        </View>
        <View style={styles.metricsRow}>
          <MetricTile label="Delayed" value={String(stats.delayed).padStart(2, '0')} variant="alert" />
          <MetricTile label="Ready to Run" value={String(stats.ready).padStart(2, '0')} variant="ready" />
        </View>

        <KineticSectionTitle title="Active Queue" />
        {queue.length === 0 ? (
          <Text style={styles.empty}>No tickets in queue</Text>
        ) : (
          queue.map((order) => (
            <KitchenTicket
              key={order.id}
              order={order}
              onBump={bumpOrder}
              onReady={markReady}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: { flex: 1, justifyContent: 'center', backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 16,
  },
  heroTitle: {
    fontFamily: fonts.headlineBlack,
    fontSize: 32,
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
  clock: {
    fontFamily: fonts.headlineBlack,
    fontSize: 22,
    fontWeight: '900',
    color: colors.primary,
  },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 24,
  },
  ticket: {
    backgroundColor: colors.surfaceContainerLowest,
    borderLeftWidth: 6,
    borderRadius: radius.sm,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  ticketReady: { opacity: 0.88, backgroundColor: colors.secondaryContainer },
  ticketBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bannerNormal: { backgroundColor: colors.surfaceContainerHigh },
  bannerUrgent: { backgroundColor: colors.tertiaryFixed },
  bannerLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bannerLabelUrgent: { color: colors.onTertiaryFixedVariant },
  bannerTime: {
    fontFamily: fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  ticketBody: { padding: 16 },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ticketId: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  ticketIdReady: { fontSize: 18, color: colors.onSecondaryContainer },
  tableChip: {
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  tableChipText: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  items: { gap: 12, marginBottom: 12 },
  itemRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  qtyBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontFamily: fonts.headlineBlack,
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
  },
  itemCopy: { flex: 1 },
  itemName: {
    fontFamily: fonts.headline,
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
  },
  itemNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    backgroundColor: colors.surfaceContainerLow,
    padding: 6,
    borderRadius: radius.sm,
  },
  orderNotes: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.onTertiaryContainer,
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', gap: 10 },
  bumpBtn: {
    flex: 1,
    backgroundColor: colors.surfaceContainerHighest,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  bumpBtnDisabled: { opacity: 0.5 },
  bumpBtnText: {
    fontFamily: fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readyBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  readyBtnText: {
    fontFamily: fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  readyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readyTitle: {
    fontFamily: fonts.label,
    fontSize: 13,
    color: colors.onSurfaceVariant,
  },
});
