import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getLoginProfiles } from '../api/client';

const LAST_LOGIN_EMAIL_KEY = 'lastLoginEmail';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [profilesError, setProfilesError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const savedEmail = await AsyncStorage.getItem(LAST_LOGIN_EMAIL_KEY);
        if (active && savedEmail) {
          setEmail(savedEmail);
        }

        const response = await getLoginProfiles();
        if (active) {
          setProfiles(response.data?.profiles || []);
        }
      } catch (_err) {
        if (active) {
          setProfilesError('Could not load quick-fill profiles. Manual login still works.');
        }
      } finally {
        if (active) setProfilesLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      await AsyncStorage.setItem(LAST_LOGIN_EMAIL_KEY, email.trim());
      // Navigation handled automatically by App.js (user state changes)
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
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

        <Text style={styles.demoTitle}>Staff quick-fill (email only)</Text>
        {profilesError ? <Text style={styles.errorText}>{profilesError}</Text> : null}
        {profilesLoading ? (
          <Text style={styles.loadingProfiles}>Loading profiles...</Text>
        ) : (
          profiles.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              onPress={() => {
                setEmail(profile.email);
                setPassword('');
              }}
            >
              <Text style={styles.demoLink}>
                Fill as {profile.name} ({profile.role})
              </Text>
            </TouchableOpacity>
          ))
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#1a1a2e' },
  content:       { flex: 1, justifyContent: 'center', padding: 24 },
  title:         { fontSize: 32, fontWeight: 'bold', color: '#e94560', textAlign: 'center', marginBottom: 4 },
  subtitle:      { fontSize: 16, color: '#aaa', textAlign: 'center', marginBottom: 40 },
  input:         { backgroundColor: '#16213e', color: '#fff', borderRadius: 10, padding: 14, marginBottom: 14, fontSize: 15, borderWidth: 1, borderColor: '#0f3460' },
  button:        { backgroundColor: '#e94560', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled:{ opacity: 0.6 },
  buttonText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  demoTitle:     { color: '#666', textAlign: 'center', marginTop: 32, marginBottom: 8, fontSize: 12 },
  demoLink:      { color: '#e94560', textAlign: 'center', marginVertical: 2, fontSize: 13 },
  loadingProfiles: { color: '#888', textAlign: 'center', marginVertical: 4, fontSize: 12 },
  errorText:     { color: '#ff7f7f', textAlign: 'center', marginVertical: 4, fontSize: 12 },
});
