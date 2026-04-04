import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getInventory } from '../services/api';

export default function InventoryScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInventory()
      .then((res) => setItems(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load inventory'))
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => {
    const isLow = item.quantity <= item.min_threshold;
    return (
      <View style={[styles.card, isLow && styles.lowStock]}>
        <View style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={[styles.qty, { color: isLow ? '#e53935' : '#333' }]}>
            {item.quantity} {item.unit}
          </Text>
        </View>
        {isLow && <Text style={styles.warning}>⚠ Low stock (min: {item.min_threshold} {item.unit})</Text>}
      </View>
    );
  };

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#2196F3" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
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
  lowStock: { borderLeftWidth: 4, borderLeftColor: '#e53935' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  qty: { fontSize: 16, fontWeight: '600' },
  warning: { fontSize: 12, color: '#e53935', marginTop: 6 },
});
