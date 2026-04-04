import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardScreen({ navigation }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((data) => {
      if (data) setUser(JSON.parse(data));
    });
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    navigation.replace('Login');
  };

  const menuItems = [
    { label: 'Orders', screen: 'Orders', roles: ['owner', 'manager', 'waiter'] },
    { label: 'Menu', screen: 'Menu', roles: ['owner', 'manager', 'waiter'] },
    { label: 'Inventory', screen: 'Inventory', roles: ['owner', 'manager'] },
    { label: 'Sales', screen: 'Sales', roles: ['owner', 'manager'] },
  ];

  const visibleItems = menuItems.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>Welcome, {user?.name || 'User'}</Text>
        <Text style={styles.role}>{user?.role?.toUpperCase()}</Text>
      </View>
      <View style={styles.grid}>
        {visibleItems.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.card}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.cardText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 24, backgroundColor: '#2196F3' },
  welcome: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  role: { fontSize: 14, color: '#e3f2fd', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 16 },
  card: {
    width: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardText: { fontSize: 18, fontWeight: '600', color: '#333' },
  logoutButton: { margin: 24, padding: 14, backgroundColor: '#e53935', borderRadius: 8, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
