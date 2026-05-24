import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LoginPage from './pages/LoginPage';
import WaiterDashboard from './pages/WaiterDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import { getMe, login, setAuthToken } from './api/client';

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    async function restoreSession() {
      const savedToken = localStorage.getItem('token');
      const savedUserRaw = localStorage.getItem('user');

      if (!savedToken) {
        setLoading(false);
        return;
      }

      await setAuthToken(savedToken);

      if (savedUserRaw) {
        try {
          setUser(JSON.parse(savedUserRaw));
        } catch (_) {
          localStorage.removeItem('user');
        }
      }

      try {
        const response = await getMe();
        const me = response.data.user;
        localStorage.setItem('user', JSON.stringify(me));
        setUser(me);
        if (me.preferred_language && me.preferred_language !== i18n.language) {
          i18n.changeLanguage(me.preferred_language);
        }
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        await setAuthToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();
  }, [i18n]);

  const handleLogin = async (email, password) => {
    try {
      const response = await login(email, password);

      const { token, user: userData } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      await setAuthToken(token);

      setUser(userData);
      if (userData.preferred_language && userData.preferred_language !== i18n.language) {
        i18n.changeLanguage(userData.preferred_language);
      }
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Login failed'
      };
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    await setAuthToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline">{t('loading')}</p>
        </div>
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
