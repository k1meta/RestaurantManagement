import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { getOrders, updateOrderStatus } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = {
  pending:   '#f0a500',
  preparing: '#0f3460',
  ready:     '#4caf50',
  closed:    '#555',
};

export default function WaiterScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [orders,     setOrders]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await getOrders();
      setOrders(res.data.orders);
    } catch (err) {
      Alert.alert('Error', 'Could not load orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function closeOrder(id) {
    try {
      await updateOrderStatus(id, 'closed');
      fetchOrders();
    } catch (err) {
      Alert.alert('Error', 'Could not close order');
    }
  }

  function renderOrder({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderNum}>Order #{item.id}</Text>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] || '#555' }]}>
            <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.meta}>Table: {item.table_number || '—'}</Text>
        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.status === 'ready' && (
          <TouchableOpacity style={styles.closeBtn} onPress={() => closeOrder(item.id)}>
            <Text style={styles.closeBtnText}>✓ Mark as Served & Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#e94560" size="large" />;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user.name} 👋</Text>
          <Text style={styles.role}>Waiter</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* New Order Button */}
      <TouchableOpacity
        style={styles.newOrderBtn}
        onPress={() => navigation.navigate('NewOrder')}
      >
        <Text style={styles.newOrderBtnText}>＋ New Order</Text>
      </TouchableOpacity>

      {/* Orders List */}
      <Text style={styles.sectionTitle}>Active Orders</Text>
      <FlatList
        data={orders.filter(o => o.status !== 'closed')}
        keyExtractor={o => String(o.id)}
        renderItem={renderOrder}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOrders(); }} />}
        ListEmptyComponent={<Text style={styles.empty}>No active orders</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#1a1a2e' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  greeting:       { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  role:           { color: '#e94560', fontSize: 13 },
  logout:         { color: '#aaa', fontSize: 14 },
  newOrderBtn:    { backgroundColor: '#e94560', margin: 16, borderRadius: 10, padding: 16, alignItems: 'center' },
  newOrderBtnText:{ color: '#fff', fontWeight: 'bold', fontSize: 15 },
  sectionTitle:   { color: '#aaa', fontSize: 13, marginLeft: 16, marginBottom: 8 },
  card:           { backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16 },
  cardHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  orderNum:       { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  badge:          { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, justifyContent: 'center' },
  badgeText:      { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  meta:           { color: '#aaa', fontSize: 13, marginBottom: 2 },
  closeBtn:       { backgroundColor: '#4caf50', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  closeBtnText:   { color: '#fff', fontWeight: 'bold' },
  empty:          { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
