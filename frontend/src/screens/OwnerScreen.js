import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { getSales, getOrders } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function OwnerScreen() {
  const { user, logout } = useAuth();
  const [sales,   setSales]   = useState([]);
  const [orders,  setOrders]  = useState([]);
  const [period,  setPeriod]  = useState('monthly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getSales(period), getOrders()])
      .then(([salesRes, ordersRes]) => {
        setSales(salesRes.data.sales);
        setOrders(ordersRes.data.orders);
      })
      .catch(() => Alert.alert('Error', 'Could not load data'))
      .finally(() => setLoading(false));
  }, [period]);

  const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total_revenue || 0), 0);
  const activeOrders = orders.filter(o => o.status !== 'closed').length;

  // Group sales by location for the owner overview
  const byLocation = sales.reduce((acc, s) => {
    const loc = s.location_name || 'Unknown';
    if (!acc[loc]) acc[loc] = { revenue: 0, items: [] };
    acc[loc].revenue += parseFloat(s.total_revenue || 0);
    acc[loc].items.push(s);
    return acc;
  }, {});

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#e94560" size="large" />;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Owner Dashboard 📊</Text>
          <Text style={styles.role}>{user.name}</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Logout</Text></TouchableOpacity>
      </View>

      {/* KPI cards */}
      <View style={styles.kpiRow}>
        <View style={styles.kpi}>
          <Text style={styles.kpiValue}>${totalRevenue.toFixed(0)}</Text>
          <Text style={styles.kpiLabel}>Revenue ({period})</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiValue}>{activeOrders}</Text>
          <Text style={styles.kpiLabel}>Active Orders</Text>
        </View>
        <View style={styles.kpi}>
          <Text style={styles.kpiValue}>{Object.keys(byLocation).length}</Text>
          <Text style={styles.kpiLabel}>Locations</Text>
        </View>
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {['weekly', 'monthly', 'yearly'].map(p => (
          <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
            <Text style={[styles.periodText, period === p && { color: '#fff' }]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sales by location */}
      {Object.entries(byLocation).map(([loc, data]) => (
        <View key={loc} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{loc}</Text>
            <Text style={styles.sectionRevenue}>${data.revenue.toFixed(2)}</Text>
          </View>
          {data.items.slice(0, 5).map((s, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowItem}>{s.item_name}</Text>
              <Text style={styles.rowData}>{s.total_sold} sold  ·  ${parseFloat(s.total_revenue).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ))}

      {sales.length === 0 && (
        <Text style={styles.empty}>No sales recorded for this period yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#1a1a2e' },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  greeting:      { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  role:          { color: '#e94560', fontSize: 13 },
  logout:        { color: '#aaa', fontSize: 14 },
  kpiRow:        { flexDirection: 'row', marginHorizontal: 16, gap: 10, marginBottom: 20 },
  kpi:           { flex: 1, backgroundColor: '#16213e', borderRadius: 12, padding: 14, alignItems: 'center' },
  kpiValue:      { color: '#e94560', fontSize: 22, fontWeight: 'bold' },
  kpiLabel:      { color: '#aaa', fontSize: 11, marginTop: 4, textAlign: 'center' },
  periodRow:     { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 },
  periodBtn:     { backgroundColor: '#16213e', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  periodActive:  { backgroundColor: '#e94560' },
  periodText:    { color: '#aaa', fontSize: 13 },
  section:       { backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: '#0f3460' },
  sectionTitle:  { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sectionRevenue:{ color: '#4caf50', fontWeight: 'bold', fontSize: 15 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  rowItem:       { color: '#fff', fontSize: 14 },
  rowData:       { color: '#aaa', fontSize: 13 },
  empty:         { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
