import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { getOrders, getInventory, upsertInventoryItem, deleteInventoryItem, getSales } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function ManagerScreen() {
  const { user, logout } = useAuth();
  const [tab,       setTab]       = useState('orders');   // 'orders' | 'inventory' | 'sales'
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [sales,     setSales]     = useState([]);
  const [period,    setPeriod]    = useState('monthly');
  const [loading,   setLoading]   = useState(false);

  // Add inventory modal state
  const [modalVisible, setModalVisible]   = useState(false);
  const [ingredient,   setIngredient]     = useState('');
  const [quantity,     setQuantity]       = useState('');
  const [unit,         setUnit]           = useState('');

  useEffect(() => {
    if (tab === 'orders')    fetchOrders();
    if (tab === 'inventory') fetchInventory();
    if (tab === 'sales')     fetchSales();
  }, [tab, period]);

  async function fetchOrders() {
    setLoading(true);
    try { const r = await getOrders(); setOrders(r.data.orders); }
    catch { Alert.alert('Error', 'Could not load orders'); }
    finally { setLoading(false); }
  }

  async function fetchInventory() {
    setLoading(true);
    try { const r = await getInventory(); setInventory(r.data.inventory); }
    catch { Alert.alert('Error', 'Could not load inventory'); }
    finally { setLoading(false); }
  }

  async function fetchSales() {
    setLoading(true);
    try { const r = await getSales(period); setSales(r.data.sales); }
    catch { Alert.alert('Error', 'Could not load sales'); }
    finally { setLoading(false); }
  }

  async function addOrUpdateItem() {
    if (!ingredient || !quantity) {
      Alert.alert('Error', 'Ingredient and quantity are required');
      return;
    }
    try {
      await upsertInventoryItem({ ingredient, quantity: parseFloat(quantity), unit });
      setModalVisible(false);
      setIngredient(''); setQuantity(''); setUnit('');
      fetchInventory();
    } catch { Alert.alert('Error', 'Could not save item'); }
  }

  async function removeItem(id) {
    Alert.alert('Delete', 'Remove this ingredient?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteInventoryItem(id); fetchInventory(); }
        catch { Alert.alert('Error', 'Could not delete item'); }
      }},
    ]);
  }

  const tabs = ['orders', 'inventory', 'sales'];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Manager — {user.name}</Text>
          <Text style={styles.role}>Location #{user.location_id}</Text>
        </View>
        <TouchableOpacity onPress={logout}><Text style={styles.logout}>Logout</Text></TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator color="#e94560" style={{ marginTop: 40 }} />
        : tab === 'orders'
          ? <FlatList
              data={orders}
              keyExtractor={o => String(o.id)}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Order #{item.id}  ·  {item.status}</Text>
                  <Text style={styles.cardSub}>Table {item.table_number || '—'}  ·  Waiter: {item.waiter_name}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No orders</Text>}
            />
          : tab === 'inventory'
            ? <>
                <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
                  <Text style={styles.addBtnText}>＋ Add / Update Ingredient</Text>
                </TouchableOpacity>
                <FlatList
                  data={inventory}
                  keyExtractor={i => String(i.id)}
                  renderItem={({ item }) => (
                    <View style={styles.card}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.cardTitle}>{item.ingredient}</Text>
                        <TouchableOpacity onPress={() => removeItem(item.id)}>
                          <Text style={{ color: '#e94560' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cardSub}>{item.quantity} {item.unit || 'units'}</Text>
                    </View>
                  )}
                  ListEmptyComponent={<Text style={styles.empty}>No inventory items</Text>}
                />
              </>
            : /* Sales tab */
              <ScrollView>
                <View style={styles.periodRow}>
                  {['weekly', 'monthly', 'yearly'].map(p => (
                    <TouchableOpacity key={p} style={[styles.periodBtn, period === p && styles.periodActive]} onPress={() => setPeriod(p)}>
                      <Text style={[styles.periodText, period === p && { color: '#fff' }]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {sales.map((s, i) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.cardTitle}>{s.item_name}</Text>
                    <Text style={styles.cardSub}>Sold: {s.total_sold}  ·  Revenue: ${parseFloat(s.total_revenue).toFixed(2)}</Text>
                  </View>
                ))}
                {sales.length === 0 && <Text style={styles.empty}>No sales data for this period</Text>}
              </ScrollView>
      }

      {/* Add Ingredient Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add / Update Ingredient</Text>
            <TextInput style={styles.input} placeholder="Ingredient name" placeholderTextColor="#666" value={ingredient} onChangeText={setIngredient} />
            <TextInput style={styles.input} placeholder="Quantity" placeholderTextColor="#666" keyboardType="numeric" value={quantity} onChangeText={setQuantity} />
            <TextInput style={styles.input} placeholder="Unit (kg, litre, pcs...)" placeholderTextColor="#666" value={unit} onChangeText={setUnit} />
            <TouchableOpacity style={styles.saveBtn} onPress={addOrUpdateItem}><Text style={styles.saveBtnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#1a1a2e' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 48 },
  greeting:    { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  role:        { color: '#e94560', fontSize: 13 },
  logout:      { color: '#aaa', fontSize: 14 },
  tabBar:      { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 },
  tabBtn:      { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#16213e' },
  tabActive:   { backgroundColor: '#e94560' },
  tabText:     { color: '#aaa', fontSize: 13 },
  tabTextActive:{ color: '#fff', fontWeight: 'bold' },
  card:        { backgroundColor: '#16213e', marginHorizontal: 16, marginBottom: 8, borderRadius: 10, padding: 14 },
  cardTitle:   { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cardSub:     { color: '#aaa', fontSize: 13, marginTop: 4 },
  empty:       { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  addBtn:      { backgroundColor: '#0f3460', margin: 16, borderRadius: 10, padding: 14, alignItems: 'center' },
  addBtnText:  { color: '#fff', fontWeight: 'bold' },
  periodRow:   { flexDirection: 'row', justifyContent: 'center', gap: 10, margin: 16 },
  periodBtn:   { backgroundColor: '#16213e', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  periodActive:{ backgroundColor: '#e94560' },
  periodText:  { color: '#aaa', fontSize: 13 },
  modalOverlay:{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal:       { backgroundColor: '#16213e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:  { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  input:       { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 14, borderWidth: 1, borderColor: '#0f3460' },
  saveBtn:     { backgroundColor: '#e94560', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  cancelText:  { color: '#aaa', textAlign: 'center', marginTop: 12, fontSize: 14 },
});
