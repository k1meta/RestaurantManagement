import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, login as apiLogin, setAuthToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // checking stored token on boot

  // On app launch: restore session if a token exists
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');

        if (!storedToken) {
          if (storedUser) {
            await AsyncStorage.removeItem('user');
          }
          if (active) setUser(null);
          return;
        }

        await setAuthToken(storedToken);

        if (storedUser && active) {
          setUser(JSON.parse(storedUser));
        }

        const meResponse = await getMe();
        const freshUser = meResponse.data.user;
        await AsyncStorage.setItem('user', JSON.stringify(freshUser));

        if (active) setUser(freshUser);
      } catch (_) {
        await setAuthToken(null);
        await AsyncStorage.multiRemove(['token', 'user']);
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function login(email, password) {
    const response = await apiLogin(email, password);
    const { token, user: userData } = response.data;

    await setAuthToken(token);
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user',  JSON.stringify(userData));
    setUser(userData);
    return userData;
  }

  async function logout() {
    await setAuthToken(null);
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
