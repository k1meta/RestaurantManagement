import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getSalesSummary, getSales } from '../services/api';

export default function SalesScreen() {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await getSalesSummary();
      setSummary(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [period]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.itemName}>{item.item_name}</Text>
      <Text style={styles.restaurant}>{item.restaurant_name}</Text>
      <View style={styles.row}>
        <Text style={styles.stat}>Sold: {item.total_sold}</Text>
        <Text style={styles.revenue}>${parseFloat(item.total_revenue || 0).toFixed(2)}</Text>
      </View>
    </View>
  );

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={summary}
        keyExtractor={(item, index) => `${item.item_name}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  restaurant: { fontSize: 12, color: '#888', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontSize: 14, color: '#555' },
  revenue: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
});
