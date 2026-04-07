(function () {
  const API_BASE = '/api';

  function safeUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (_) {
      return null;
    }
  }

  function token() {
    return localStorage.getItem('token');
  }

  function authHeaders(extra) {
    const t = token();
    return Object.assign(
      {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      extra || {}
    );
  }

  function redirectToLogin() {
    window.location.href = '/';
  }

  function requireAuth(allowedRoles) {
    const user = safeUser();
    const t = token();
    if (!user || !t) {
      redirectToLogin();
      return null;
    }

    if (allowedRoles && allowedRoles.length && !allowedRoles.includes(user.role)) {
      const roleMap = {
        owner: '/owner.html',
        manager: '/manager.html',
        waiter: '/waiter.html',
        kitchen: '/kitchen.html',
      };
      window.location.href = roleMap[user.role] || '/';
      return null;
    }
    return user;
  }

  async function api(path, options) {
    const res = await fetch(`${API_BASE}${path}`, Object.assign({ headers: authHeaders() }, options || {}));
    if (res.status === 401 || res.status === 403) {
      localStorage.clear();
      redirectToLogin();
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function formatMoney(value) {
    const num = Number(value || 0);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  }

  function elapsedMinutes(iso) {
    if (!iso) return 0;
    const then = new Date(iso).getTime();
    return Math.max(0, Math.round((Date.now() - then) / 60000));
  }

  function statusLabel(s) {
    return String(s || '').replace(/_/g, ' ').toUpperCase();
  }

  function logout() {
    localStorage.clear();
    redirectToLogin();
  }

  function wireNavigation() {
    const map = {
      orders: '/waiter.html',
      kitchen: '/kitchen.html',
      inventory: '/manager.html',
      analytics: '/owner.html',
      locations: '/owner.html',
      settings: '/manager.html',
      'global menu': '/manager.html',
    };

    document.querySelectorAll('a').forEach((a) => {
      const label = (a.textContent || '').trim().toLowerCase();
      if (map[label]) {
        a.setAttribute('href', map[label]);
      }
    });

    document.querySelectorAll('header img').forEach((img) => {
      img.style.cursor = 'pointer';
      img.title = 'Click to logout';
      img.addEventListener('click', () => {
        if (window.confirm('Logout now?')) {
          logout();
        }
      });
    });
  }

  window.DashboardApp = {
    requireAuth,
    authHeaders,
    api,
    formatMoney,
    elapsedMinutes,
    statusLabel,
    logout,
    safeUser,
    wireNavigation,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireNavigation);
  } else {
    wireNavigation();
  }
})();
