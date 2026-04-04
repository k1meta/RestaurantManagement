import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️  Change this to your machine's local IP when testing on a physical device
// On Android emulator use: http://10.0.2.2:3000
// On iOS simulator or web:  http://localhost:3000
export const BASE_URL = 'http://localhost:3000';

const api = axios.create({ baseURL: BASE_URL });

// Attach the stored JWT token to every outgoing request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = (email, password) =>
  api.post('/api/auth/login', { email, password });

export const getMe = () =>
  api.get('/api/auth/me');

// ─── Orders ──────────────────────────────────────────────────────────────────
export const getOrders = () =>
  api.get('/api/orders');

export const getOrder = (id) =>
  api.get(`/api/orders/${id}`);

export const createOrder = (payload) =>
  api.post('/api/orders', payload);

export const updateOrderStatus = (id, status) =>
  api.patch(`/api/orders/${id}/status`, { status });

// ─── Menu ────────────────────────────────────────────────────────────────────
export const getMenu = () =>
  api.get('/api/menu');

export const updateMenuPrice = (id, price) =>
  api.patch(`/api/menu/${id}/price`, { price });

// ─── Inventory ───────────────────────────────────────────────────────────────
export const getInventory = () =>
  api.get('/api/inventory');

export const upsertInventoryItem = (payload) =>
  api.post('/api/inventory', payload);

export const deleteInventoryItem = (id) =>
  api.delete(`/api/inventory/${id}`);

// ─── Sales ───────────────────────────────────────────────────────────────────
export const getSales = (period = 'monthly') =>
  api.get(`/api/sales?period=${period}`);

export default api;
