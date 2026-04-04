import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { getMenuItems } from '../services/api';

export default function MenuScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMenuItems()
      .then((res) => setItems(res.data))
      .catch(() => Alert.alert('Error', 'Failed to load menu'))
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.price}>${parseFloat(item.price).toFixed(2)}</Text>
      </View>
      <Text style={styles.category}>{item.category}</Text>
      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
      <Text style={[styles.available, { color: item.is_available ? '#4CAF50' : '#e53935' }]}>
        {item.is_available ? 'Available' : 'Unavailable'}
      </Text>
    </View>
  );

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
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  price: { fontSize: 16, fontWeight: 'bold', color: '#2196F3' },
  category: { fontSize: 12, color: '#888', textTransform: 'uppercase', marginBottom: 4 },
  description: { fontSize: 14, color: '#666', marginBottom: 4 },
  available: { fontSize: 12, fontWeight: '600' },
});
