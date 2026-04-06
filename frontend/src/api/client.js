import axios from 'axios';

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

const runtimeApiUrl =
  (typeof process !== 'undefined' && process?.env?.EXPO_PUBLIC_API_URL) ||
  (typeof process !== 'undefined' && process?.env?.REACT_APP_API_URL) ||
  '';

function getDefaultBaseUrl() {
  if (runtimeApiUrl) return runtimeApiUrl;
  // Android emulator loopback for mobile local development.
  if (isReactNative) return 'http://10.0.2.2:3000';
  return 'http://localhost:3000';
}

export const BASE_URL = getDefaultBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

let inMemoryToken = null;
let asyncStorageModulePromise = null;

async function getAsyncStorage() {
  if (!isReactNative) return null;

  if (!asyncStorageModulePromise) {
    asyncStorageModulePromise = import('@react-native-async-storage/async-storage')
      .then((module) => module.default)
      .catch(() => null);
  }

  return asyncStorageModulePromise;
}

async function readStoredToken() {
  if (inMemoryToken) return inMemoryToken;

  if (!isReactNative && typeof localStorage !== 'undefined') {
    return localStorage.getItem('token');
  }

  const storage = await getAsyncStorage();
  if (!storage) return null;
  return storage.getItem('token');
}

async function persistToken(token) {
  if (!isReactNative && typeof localStorage !== 'undefined') {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    return;
  }

  const storage = await getAsyncStorage();
  if (!storage) return;

  if (token) {
    await storage.setItem('token', token);
  } else {
    await storage.removeItem('token');
  }
}

export async function setAuthToken(token) {
  inMemoryToken = token || null;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }

  await persistToken(inMemoryToken);
}

api.interceptors.request.use(async (config) => {
  const token = inMemoryToken || (await readStoredToken());

  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const shouldRetryNetworkError =
      !error.response &&
      error.config &&
      !error.config.__networkRetried;

    if (shouldRetryNetworkError) {
      error.config.__networkRetried = true;
      await new Promise((resolve) => setTimeout(resolve, 350));
      return api(error.config);
    }

    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = (email, password) => api.post('/api/auth/login', { email, password });
export const getMe = () => api.get('/api/auth/me');

// ─── Orders ──────────────────────────────────────────────────────────────────
export const getOrders = (params = {}) => api.get('/api/orders', { params });
export const getOrder = (id) => api.get(`/api/orders/${id}`);
export const createOrder = (payload) => api.post('/api/orders', payload);
export const updateOrderStatus = (id, status) => api.patch(`/api/orders/${id}/status`, { status });

// ─── Menu ────────────────────────────────────────────────────────────────────
export const getMenu = (params = {}) => api.get('/api/menu', { params });
export const createMenuItem = (payload) => api.post('/api/menu', payload);
export const updateMenuItem = (id, payload) => api.patch(`/api/menu/${id}`, payload);
export const deactivateMenuItem = (id) => api.delete(`/api/menu/${id}`);
export const updateMenuPrice = (id, price) => api.patch(`/api/menu/${id}/price`, { price });
export const updateMenuAvailability = (id, active) => api.patch(`/api/menu/${id}/active`, { active });
export const applyGlobalPriceAdjustment = (payload) => api.post('/api/menu/global-price-adjustment', payload);

// ─── Inventory ───────────────────────────────────────────────────────────────
export const getInventory = () => api.get('/api/inventory');
export const upsertInventoryItem = (payload) => api.post('/api/inventory', payload);
export const deleteInventoryItem = (id) => api.delete(`/api/inventory/${id}`);

// ─── Sales ───────────────────────────────────────────────────────────────────
export const getSales = (period = 'monthly', params = {}) =>
  api.get('/api/sales', { params: { period, ...params } });

// ─── Organization ────────────────────────────────────────────────────────────
export const getLocations = () => api.get('/api/locations');
export const createLocation = (payload) => api.post('/api/locations', payload);
export const updateLocation = (id, payload) => api.patch(`/api/locations/${id}`, payload);
export const deleteLocation = (id) => api.delete(`/api/locations/${id}`);
export const getUsers = (params = {}) => api.get('/api/users', { params });
export const createUser = (payload) => api.post('/api/users', payload);
export const updateUser = (id, payload) => api.patch(`/api/users/${id}`, payload);
export const deleteUser = (id) => api.delete(`/api/users/${id}`);

export default api;
