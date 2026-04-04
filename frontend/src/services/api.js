import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await AsyncStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (data) => api.post('/auth/register', data);

// Restaurants
export const getRestaurants = () => api.get('/restaurants');
export const getRestaurantById = (id) => api.get(`/restaurants/${id}`);

// Orders
export const getOrders = (restaurantId) => api.get('/orders', { params: { restaurant_id: restaurantId } });
export const getOrderById = (id) => api.get(`/orders/${id}`);
export const createOrder = (data) => api.post('/orders', data);
export const updateOrderStatus = (id, status) => api.put(`/orders/${id}/status`, { status });

// Menu
export const getMenuItems = (restaurantId) => api.get('/menu', { params: { restaurant_id: restaurantId } });
export const createMenuItem = (data) => api.post('/menu', data);
export const updateMenuItem = (id, data) => api.put(`/menu/${id}`, data);
export const deleteMenuItem = (id) => api.delete(`/menu/${id}`);

// Inventory
export const getInventory = (restaurantId) => api.get('/inventory', { params: { restaurant_id: restaurantId } });
export const createInventoryItem = (data) => api.post('/inventory', data);
export const updateInventoryItem = (id, data) => api.put(`/inventory/${id}`, data);
export const getInventoryLogs = (restaurantId) => api.get(`/inventory/logs/${restaurantId}`);

// Sales
export const getSales = (period) => api.get('/sales', { params: { period } });
export const getSalesByRestaurant = (restaurantId, period) => api.get(`/sales/restaurant/${restaurantId}`, { params: { period } });
export const getSalesSummary = () => api.get('/sales/summary');

export default api;
