import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getSalesSummary, getSales } from '../services/api';

const PERIODS = ['weekly', 'monthly', 'yearly'];

export default function SalesScreen() {
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('monthly');

  const fetchSales = async (selectedPeriod) => {
    setLoading(true);
    try {
      const res = await getSales(selectedPeriod);
      setSummary(res.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(period);
  }, [period]);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.itemName}>{item.item_name}</Text>
      <Text style={styles.restaurant}>{item.restaurant_name}</Text>
      <View style={styles.row}>
        <Text style={styles.stat}>Sold: {item.quantity_sold}</Text>
        <Text style={styles.revenue}>${parseFloat(item.total_revenue || 0).toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.periodSelector}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodButton, period === p && styles.periodButtonActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />
      ) : (
        <FlatList
          data={summary}
          keyExtractor={(item, index) => `${item.item_name}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center' },
  periodSelector: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  periodButton: { flex: 1, padding: 8, alignItems: 'center', borderRadius: 6 },
  periodButtonActive: { backgroundColor: '#2196F3' },
  periodText: { fontSize: 14, color: '#555', fontWeight: '600' },
  periodTextActive: { color: '#fff' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, elevation: 2 },
  itemName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  restaurant: { fontSize: 12, color: '#888', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontSize: 14, color: '#555' },
  revenue: { fontSize: 16, fontWeight: 'bold', color: '#4CAF50' },
});
