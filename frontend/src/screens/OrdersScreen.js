import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getOrders, updateOrderStatus } from '../services/api';

const STATUS_COLORS = {
  pending: '#FF9800',
  in_progress: '#2196F3',
  ready: '#4CAF50',
  delivered: '#9C27B0',
  closed: '#9E9E9E',
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const response = await getOrders();
      setOrders(response.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      fetchOrders();
    } catch (err) {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const renderOrder = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderTitle}>Order #{item.id} - Table {item.table_number}</Text>
        <Text style={[styles.status, { backgroundColor: STATUS_COLORS[item.status] || '#999' }]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.waiter}>Waiter: {item.waiter_name || 'N/A'}</Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderOrder}
        contentContainerStyle={styles.list}
        onRefresh={fetchOrders}
        refreshing={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  status: { color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: '600' },
  waiter: { color: '#666', fontSize: 14 },
  date: { color: '#aaa', fontSize: 12, marginTop: 4 },
});
