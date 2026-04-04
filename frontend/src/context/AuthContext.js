import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as apiLogin } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // checking stored token on boot

  // On app launch: restore session if a token exists
  useEffect(() => {
    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (_) {
        // token was invalid or missing — stay logged out
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const response = await apiLogin(email, password);
    const { token, user: userData } = response.data;

    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user',  JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  async function logout() {
    await AsyncStorage.multiRemove(['token', 'user']);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook — use this anywhere: const { user, login, logout } = useAuth();
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
