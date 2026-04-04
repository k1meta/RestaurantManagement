import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { getOrders, getOrder, updateOrderStatus } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function KitchenScreen() {
  const { user, logout } = useAuth();
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getOrders();
      // Kitchen only cares about non-closed orders
      setOrders(res.data.orders.filter(o => o.status !== 'closed'));
    } catch {
      Alert.alert('Error', 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 15 seconds
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  async function advanceStatus(order) {
    const next = order.status === 'pending' ? 'preparing' : 'ready';
    try {
      await updateOrderStatus(order.id, next);
      fetchOrders();
    } catch {
      Alert.alert('Error', 'Could not update order status');
    }
  }

  function renderOrder({ item }) {
    const isPending   = item.status === 'pending';
    const isPreparing = item.status === 'preparing';

    return (
      <View style={[styles.card, isPreparing && styles.cardPreparing]}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNum}>Order #{item.id}  ·  Table {item.table_number || '—'}</Text>
          <Text style={styles.time}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {item.notes ? <Text style={styles.notes}>📝 {item.notes}</Text> : null}

        {(isPending || isPreparing) && (
          <TouchableOpacity
            style={[styles.actionBtn, isPreparing ? styles.readyBtn : styles.preparingBtn]}
            onPress={() => advanceStatus(item)}
          >
            <Text style={styles.actionBtnText}>
              {isPending ? '▶ Start Preparing' : '✓ Mark as Ready'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#e94560" size="large" />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Kitchen Dashboard 🍳</Text>
          <Text style={styles.role}>Hi, {user.name}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>
        {orders.filter(o => o.status === 'pending').length} pending  ·  {orders.filter(o => o.status === 'preparing').length} preparing
      </Text>

      <FlatList
        data={orders}
        keyExtractor={o => String(o.id)}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No orders waiting 🎉</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#1a1a2e' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  greeting:       { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  role:           { color: '#aaa', fontSize: 13 },
  logout:         { color: '#aaa', fontSize: 14 },
  count:          { color: '#f0a500', textAlign: 'center', marginBottom: 12, fontSize: 13 },
  card:           { backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16, borderLeftWidth: 4, borderLeftColor: '#f0a500' },
  cardPreparing:  { borderLeftColor: '#0f3460' },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  orderNum:       { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  time:           { color: '#aaa', fontSize: 13 },
  notes:          { color: '#f0a500', fontSize: 13, marginBottom: 8 },
  actionBtn:      { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 8 },
  preparingBtn:   { backgroundColor: '#0f3460' },
  readyBtn:       { backgroundColor: '#4caf50' },
  actionBtnText:  { color: '#fff', fontWeight: 'bold' },
  empty:          { color: '#555', textAlign: 'center', marginTop: 60, fontSize: 16 },
});
