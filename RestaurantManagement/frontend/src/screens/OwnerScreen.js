import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { getSales, getOrders } from '../api/client';
import { useAuth } from '../context/AuthContext';
import KineticHeader from '../components/kinetic/KineticHeader';
import KineticSectionTitle from '../components/kinetic/KineticSectionTitle';
import MetricTile from '../components/kinetic/MetricTile';
import { colors, fonts, radius } from '../theme/kinetic';

function groupByLocation(sales, orders) {
  const map = {};
  for (const s of sales) {
    const loc = s.location_name || 'Unknown';
    if (!map[loc]) {
      map[loc] = { revenue: 0, items: [], activeOrders: 0, locationId: s.location_id };
    }
    map[loc].revenue += parseFloat(s.total_revenue || 0);
    map[loc].items.push(s);
  }
  for (const o of orders) {
    if (o.status === 'closed') continue;
    const loc = o.location_name || 'Unknown';
    if (!map[loc]) map[loc] = { revenue: 0, items: [], activeOrders: 0 };
    map[loc].activeOrders += 1;
  }
  return Object.entries(map).sort((a, b) => b[1].revenue - a[1].revenue);
}

export default function OwnerScreen() {
  const { user, logout } = useAuth();
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ total_revenue: 0, total_orders: 0 });
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const [salesRes, ordersRes] = await Promise.all([getSales(period), getOrders()]);
      setSales(salesRes.data.sales || []);
      setSummary(salesRes.data.summary || { total_revenue: 0, total_orders: 0 });
      setOrders(ordersRes.data.orders || []);
    } catch {
      Alert.alert('Error', 'Could not load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const locationRows = useMemo(() => groupByLocation(sales, orders), [sales, orders]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'closed').length,
    [orders]
  );

  const topSellers = useMemo(() => {
    return [...sales]
      .sort((a, b) => parseFloat(b.total_revenue || 0) - parseFloat(a.total_revenue || 0))
      .slice(0, 6);
  }, [sales]);

  const maxRevenue = useMemo(() => {
    if (locationRows.length === 0) return 1;
    return Math.max(...locationRows.map(([, d]) => d.revenue), 1);
  }, [locationRows]);

  const totalRevenue = parseFloat(summary.total_revenue || 0) || sales.reduce(
    (sum, s) => sum + parseFloat(s.total_revenue || 0),
    0
  );

  const locationCount = locationRows.length;

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
        brand="METRIC_OS"
        subtitle="Global command"
        userName={user?.name}
        onLogout={logout}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(false)}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.heroBlock}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>Global command active</Text>
          </View>
          <View style={styles.heroTitleWrap}>
            <View style={styles.heroBar} />
            <Text style={styles.heroTitle}>
              Owner{'\n'}Dashboard
            </Text>
          </View>
        </View>

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
          <Text style={styles.revenueLabel}>Total aggregate revenue</Text>
          <Text style={styles.revenueValue}>${totalRevenue.toFixed(0)}</Text>
          <Text style={styles.revenueSub}>
            {period} • {summary.total_orders || 0} orders
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricTile
            label="Nodes online"
            value={`${locationCount || 1}`}
          />
          <MetricTile
            label="Active orders"
            value={String(activeOrders).padStart(2, '0')}
            variant="ready"
          />
        </View>

        <KineticSectionTitle title="Location Performance" />
        {locationRows.length === 0 ? (
          <Text style={styles.empty}>No location data for this period</Text>
        ) : (
          locationRows.map(([loc, data]) => {
            const pct = Math.round((data.revenue / maxRevenue) * 100);
            const isWatch = data.activeOrders > 5;
            return (
              <View
                key={loc}
                style={[styles.locCard, isWatch && styles.locCardWatch]}
              >
                <View style={styles.locTop}>
                  <Text style={styles.locName}>{loc}</Text>
                  <MaterialIcons
                    name={pct > 50 ? 'trending-up' : 'trending-flat'}
                    size={22}
                    color={isWatch ? colors.onTertiaryContainer : colors.secondary}
                  />
                </View>
                <Text style={styles.locRevenue}>${data.revenue.toFixed(0)}</Text>
                <Text style={styles.locRevenueLabel}>Revenue ({period})</Text>
                <View style={styles.locProgress}>
                  <View style={[styles.locProgressFill, { width: `${pct}%` }]} />
                </View>
                <View style={styles.locFooter}>
                  <Text style={styles.locFooterLabel}>Active orders</Text>
                  <Text style={styles.locFooterValue}>{data.activeOrders}</Text>
                </View>
              </View>
            );
          })
        )}

        <KineticSectionTitle title="Top Sellers" hint="By revenue" />
        {topSellers.map((s, i) => (
          <View key={`${s.item_name}-${i}`} style={styles.sellerRow}>
            <View style={styles.sellerIcon}>
              <MaterialIcons name="restaurant" size={24} color={colors.onSurfaceVariant} />
            </View>
            <View style={styles.sellerCopy}>
              <Text style={styles.sellerName}>{s.item_name}</Text>
              <View style={styles.sellerMeta}>
                <Text style={styles.sellerSold}>{s.total_sold} units</Text>
                <Text style={styles.sellerRev}>
                  ${parseFloat(s.total_revenue).toFixed(0)}
                </Text>
              </View>
            </View>
          </View>
        ))}
        {topSellers.length === 0 ? (
          <Text style={styles.empty}>No sales recorded for this period</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  loadingWrap: { flex: 1, justifyContent: 'center', backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  heroBlock: { marginTop: 8, marginBottom: 16 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.secondary,
  },
  liveLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    fontWeight: '700',
    color: colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  heroTitleWrap: { flexDirection: 'row', gap: 12 },
  heroBar: { width: 6, backgroundColor: colors.primary },
  heroTitle: {
    fontFamily: fonts.headlineBlack,
    fontSize: 40,
    fontWeight: '900',
    lineHeight: 38,
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -1,
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
    marginBottom: 12,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  revenueLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onPrimary,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  revenueValue: {
    fontFamily: fonts.headlineBlack,
    fontSize: 44,
    fontWeight: '900',
    color: colors.onPrimary,
    letterSpacing: -1,
    marginTop: 4,
  },
  revenueSub: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onPrimary,
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 8,
  },
  metricsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  locCard: {
    backgroundColor: colors.surfaceContainerLow,
    padding: 18,
    marginBottom: 12,
    borderRadius: radius.sm,
  },
  locCardWatch: { borderLeftWidth: 4, borderLeftColor: colors.tertiaryFixedDim },
  locTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locName: {
    fontFamily: fonts.headlineBlack,
    fontSize: 18,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  locRevenue: {
    fontFamily: fonts.headlineBlack,
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
    marginTop: 8,
  },
  locRevenueLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  locProgress: {
    height: 8,
    backgroundColor: colors.surfaceContainerHighest,
    marginTop: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  locProgressFill: { height: '100%', backgroundColor: colors.secondary },
  locFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  locFooterLabel: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locFooterValue: {
    fontFamily: fonts.headline,
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surfaceContainerLow,
    padding: 14,
    marginBottom: 10,
    borderRadius: radius.sm,
  },
  sellerIcon: {
    width: 56,
    height: 56,
    backgroundColor: colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerCopy: { flex: 1 },
  sellerName: {
    fontFamily: fonts.headline,
    fontSize: 16,
    fontWeight: '900',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: -0.2,
  },
  sellerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  sellerSold: {
    fontFamily: fonts.label,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  sellerRev: {
    fontFamily: fonts.headline,
    fontSize: 14,
    fontWeight: '900',
    color: colors.secondary,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginVertical: 20,
  },
});
