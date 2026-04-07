import React, { useState, useEffect } from 'react';
import axios from 'axios';
import LoginPage from './pages/LoginPage';
import WaiterDashboard from './pages/WaiterDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';

const API_URL = 'http://localhost:3000/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    console.log('App.js useEffect running...');
    try {
      const savedToken = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      console.log('localStorage token:', !!savedToken, 'user:', !!savedUser);
      if (savedToken && savedUser) {
        const userData = typeof savedUser === 'string' ? JSON.parse(savedUser) : savedUser;
        setUser(userData);
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        console.log('User restored from localStorage:', userData);
      } else {
        console.log('No saved user in localStorage');
      }
    } catch (err) {
      console.error('Error loading user from storage:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    console.log('Setting loading to false');
    setLoading(false);
  }, []);

  const handleLogin = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email,
        password,
      });

      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      setUser(userData);
      return { success: true };
    } catch (err) {
      return { 
        success: false, 
        error: err.response?.data?.error || 'Login failed' 
      };
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: '48px', height: '48px', border: '4px solid #e0e0e0', borderTop: '4px solid #2196F3', borderRadius: '50%' }}></div>
          <p style={{ marginTop: '16px', color: '#555', fontWeight: '600' }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Route based on user role
  switch (user.role) {
    case 'waiter':
      return <WaiterDashboard user={user} onLogout={handleLogout} />;
    case 'kitchen':
      return <KitchenDashboard user={user} onLogout={handleLogout} />;
    case 'manager':
      return <ManagerDashboard user={user} onLogout={handleLogout} />;
    case 'owner':
      return <OwnerDashboard user={user} onLogout={handleLogout} />;
    default:
      return <LoginPage onLogin={handleLogin} />;
  }
}
