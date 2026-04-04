import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Navigation handled automatically by App.js (user state changes)
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>🍽️ RestaurantMS</Text>
      <Text style={styles.subtitle}>Staff Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Login</Text>
        }
      </TouchableOpacity>

      {/* Quick-fill demo accounts */}
      <Text style={styles.demoTitle}>Demo accounts (password: password123)</Text>
      {[
        { label: 'Owner',   email: 'owner@restaurant.com'   },
        { label: 'Manager', email: 'manager@restaurant.com' },
        { label: 'Waiter',  email: 'waiter@restaurant.com'  },
        { label: 'Kitchen', email: 'kitchen@restaurant.com' },
      ].map(({ label, email: e }) => (
        <TouchableOpacity key={label} onPress={() => { setEmail(e); setPassword('password123'); }}>
          <Text style={styles.demoLink}>Fill as {label}</Text>
        </TouchableOpacity>
      ))}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  title:         { fontSize: 32, fontWeight: 'bold', color: '#e94560', textAlign: 'center', marginBottom: 4 },
  subtitle:      { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 40 },
  input:         { backgroundColor: '#16213e', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460' },
  button:        { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled:{ opacity: 0.6 },
  buttonText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  demoTitle:     { color: '#666', textAlign: 'center', marginTop: 32, marginBottom: 8, fontSize: 12 },
  demoLink:      { color: '#e94560', textAlign: 'center', marginVertical: 2, fontSize: 13 },
});
