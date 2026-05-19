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

if (!runtimeApiUrl && typeof console !== 'undefined') {
  console.warn(
    '[api] No EXPO_PUBLIC_API_URL/REACT_APP_API_URL set; using local default base URL:',
    BASE_URL
  );
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
});

let inMemoryToken = null;

export async function setAuthToken(token) {
  inMemoryToken = token || null;

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

api.interceptors.request.use(async (config) => {
  const token = inMemoryToken;

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
export const getLoginProfiles = () => api.get('/api/auth/login-profiles');

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
export const deleteMenuItem = (id) => api.delete(`/api/menu/${id}`);
export const updateMenuPrice = (id, price) => api.patch(`/api/menu/${id}/price`, { price });
export const updateMenuAvailability = (id, active) => api.patch(`/api/menu/${id}/active`, { active });

// ─── Inventory ───────────────────────────────────────────────────────────────
export const getInventory = () => api.get('/api/inventory');
export const upsertInventoryItem = (payload) => api.post('/api/inventory', payload);
export const patchInventoryItem = (id, payload) => api.patch(`/api/inventory/${id}`, payload);
export const deleteInventoryItem = (id) => api.delete(`/api/inventory/${id}`);
export const getIngredients = () => api.get('/api/inventory/ingredients');
export const createIngredient = (payload) => api.post('/api/inventory/ingredients', payload);
export const deleteIngredient = (id) => api.delete(`/api/inventory/ingredients/${id}`);

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
