import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  TextInput, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { getMenu, createOrder } from '../api/client';

export default function NewOrderScreen({ navigation }) {
  const [menu,        setMenu]        = useState([]);
  const [cart,        setCart]        = useState({}); // { menu_item_id: quantity }
  const [tableNumber, setTableNumber] = useState('');
  const [notes,       setNotes]       = useState('');
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    getMenu()
      .then(res => setMenu(res.data.menu))
      .catch(() => Alert.alert('Error', 'Could not load menu'))
      .finally(() => setLoading(false));
  }, []);

  function changeQty(id, delta) {
    setCart(prev => {
      const current = prev[id] || 0;
      const next    = Math.max(0, current + delta);
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  }

  async function submitOrder() {
    const items = Object.entries(cart).map(([menu_item_id, quantity]) => ({
      menu_item_id: parseInt(menu_item_id),
      quantity,
    }));

    if (items.length === 0) {
      Alert.alert('Empty order', 'Add at least one item to the order.');
      return;
    }

    setSubmitting(true);
    try {
      await createOrder({ table_number: tableNumber, notes, items });
      Alert.alert('Order created!', 'The kitchen has been notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#e94560" size="large" />;

  const categories = [...new Set(menu.map(i => i.category))];
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <Text style={styles.title}>New Order</Text>

        <TextInput
          style={styles.input}
          placeholder="Table number (e.g. A3)"
          placeholderTextColor="#666"
          value={tableNumber}
          onChangeText={setTableNumber}
        />
        <TextInput
          style={[styles.input, { height: 70 }]}
          placeholder="Special notes or allergies..."
          placeholderTextColor="#666"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        {categories.map(cat => (
          <View key={cat}>
            <Text style={styles.category}>{cat.toUpperCase()}</Text>
            {menu.filter(i => i.category === cat).map(item => (
              <View key={item.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>${parseFloat(item.price).toFixed(2)}</Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item.id, -1)}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qty}>{cart[item.id] || 0}</Text>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => changeQty(item.id, +1)}>
                    <Text style={styles.qtyBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {/* Sticky submit bar */}
      <View style={styles.submitBar}>
        <Text style={styles.cartCount}>{totalItems} item{totalItems !== 1 ? 's' : ''} selected</Text>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
          onPress={submitOrder}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.submitBtnText}>Send to Kitchen →</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#1a1a2e' },
  title:        { color: '#fff', fontSize: 22, fontWeight: 'bold', margin: 16, marginTop: 48 },
  input:        { backgroundColor: '#16213e', color: '#fff', borderRadius: 10, padding: 12, marginHorizontal: 16, marginBottom: 10, fontSize: 14, borderWidth: 1, borderColor: '#0f3460' },
  category:     { color: '#e94560', fontSize: 12, fontWeight: 'bold', marginLeft: 16, marginTop: 16, marginBottom: 6 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 12 },
  itemName:     { color: '#fff', fontSize: 15 },
  itemPrice:    { color: '#aaa', fontSize: 13, marginTop: 2 },
  qtyControl:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn:       { backgroundColor: '#0f3460', borderRadius: 6, width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:   { color: '#fff', fontSize: 18, lineHeight: 20 },
  qty:          { color: '#fff', minWidth: 20, textAlign: 'center', fontSize: 15 },
  submitBar:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#16213e', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#0f3460' },
  cartCount:    { color: '#aaa', fontSize: 14 },
  submitBtn:    { backgroundColor: '#e94560', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  submitBtnText:{ color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
