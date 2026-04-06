import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyGlobalPriceAdjustment,
  createLocation,
  createUser,
  deleteLocation,
  deleteUser,
  getLocations,
  getMenu,
  getOrders,
  getSales,
  getUsers,
  updateLocation,
  updateUser,
} from '../api/client';

const PERIODS = ['weekly', 'monthly', 'yearly'];
const TARGET_MINUTES = 15;

function minutesSince(timestamp) {
  return Math.max(1, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
}

function groupByLocation(locations, salesRows, orders) {
  return locations.map((location) => {
    const salesForLocation = salesRows.filter((row) => Number(row.location_id) === Number(location.id));
    const ordersForLocation = orders.filter((order) => Number(order.location_id) === Number(location.id));
    const revenue = salesForLocation.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0);
    const delayed = ordersForLocation.filter(
      (order) => order.status !== 'closed' && order.status !== 'ready' && minutesSince(order.created_at) > TARGET_MINUTES
    ).length;

    return {
      ...location,
      revenue,
      activeOrders: ordersForLocation.filter((order) => order.status !== 'closed').length,
      delayed,
      health: delayed > 2 ? 'alert' : delayed > 0 ? 'watch' : 'nominal',
    };
  });
}

export default function OwnerDashboard({ user, onLogout }) {
  const [period, setPeriod] = useState('monthly');
  const [locations, setLocations] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesRows, setSalesRows] = useState([]);
  const [salesSummary, setSalesSummary] = useState({ total_revenue: 0, total_orders: 0, total_items_sold: 0 });
  const [menuItems, setMenuItems] = useState([]);
  const [users, setUsers] = useState([]);

  const [locationDrafts, setLocationDrafts] = useState({});
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [savingLocationId, setSavingLocationId] = useState(null);
  const [deletingLocationId, setDeletingLocationId] = useState(null);

  const [userDrafts, setUserDrafts] = useState({});
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('manager');
  const [newUserLocationId, setNewUserLocationId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [deletingUserId, setDeletingUserId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [globalAdjustment, setGlobalAdjustment] = useState('5');
  const [adjusting, setAdjusting] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [emergencyMode, setEmergencyMode] = useState(false);

  const analyticsSectionRef = useRef(null);
  const locationsSectionRef = useRef(null);
  const syncSectionRef = useRef(null);

  function scrollToSection(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const loadDashboard = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const [locationsRes, ordersRes, salesRes, menuRes, usersRes] = await Promise.all([
        getLocations(),
        getOrders({ include_items: false }),
        getSales(period),
        getMenu({ include_inactive: true }),
        getUsers(),
      ]);

      const nextLocations = locationsRes.data.locations || [];
      const nextUsers = usersRes.data.users || [];

      setLocations(nextLocations);
      setOrders(ordersRes.data.orders || []);
      setSalesRows(salesRes.data.sales || []);
      setSalesSummary(salesRes.data.summary || { total_revenue: 0, total_orders: 0, total_items_sold: 0 });
      setMenuItems(menuRes.data.menu || []);
      setUsers(nextUsers);

      setLocationDrafts(() => {
        const next = {};
        for (const location of nextLocations) {
          next[location.id] = {
            name: location.name || '',
            address: location.address || '',
          };
        }
        return next;
      });

      setUserDrafts(() => {
        const next = {};
        for (const member of nextUsers) {
          next[member.id] = {
            name: member.name || '',
            email: member.email || '',
            role: member.role || 'waiter',
            location_id: member.location_id ? String(member.location_id) : '',
            password: '',
          };
        }
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load owner dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  const locationPerformance = useMemo(
    () => groupByLocation(locations, salesRows, orders).sort((a, b) => b.revenue - a.revenue),
    [locations, salesRows, orders]
  );

  const filteredSalesRows = useMemo(() => {
    if (!selectedLocationId) return salesRows;
    return salesRows.filter((row) => Number(row.location_id) === Number(selectedLocationId));
  }, [salesRows, selectedLocationId]);

  const filteredOrders = useMemo(() => {
    if (!selectedLocationId) return orders;
    return orders.filter((order) => Number(order.location_id) === Number(selectedLocationId));
  }, [orders, selectedLocationId]);

  const filteredRevenue = useMemo(
    () => filteredSalesRows.reduce((sum, row) => sum + Number(row.total_revenue || 0), 0),
    [filteredSalesRows]
  );

  const filteredOrderCount = useMemo(() => filteredOrders.length, [filteredOrders]);

  const fleetHealth = useMemo(() => {
    if (!locationPerformance.length) return 'UNKNOWN';
    const alertCount = locationPerformance.filter((loc) => loc.health === 'alert').length;
    if (alertCount > 0) return 'ALERT';

    const watchCount = locationPerformance.filter((loc) => loc.health === 'watch').length;
    if (watchCount > 0) return 'WATCH';

    return 'NOMINAL';
  }, [locationPerformance]);

  const topSellers = useMemo(() => {
    const grouped = new Map();

    for (const row of filteredSalesRows) {
      const key = Number(row.menu_item_id);
      const current = grouped.get(key) || {
        menu_item_id: key,
        item_name: row.item_name,
        category: row.category,
        total_sold: 0,
        total_revenue: 0,
      };

      current.total_sold += Number(row.total_sold || 0);
      current.total_revenue += Number(row.total_revenue || 0);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 3);
  }, [filteredSalesRows]);

  const orderTrend = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = [0, 0, 0, 0, 0, 0, 0];

    for (const order of filteredOrders) {
      const day = new Date(order.created_at).getDay();
      const index = day === 0 ? 6 : day - 1;
      values[index] += 1;
    }

    const max = Math.max(1, ...values);
    return labels.map((label, idx) => ({
      label,
      value: values[idx],
      pct: Math.round((values[idx] / max) * 100),
    }));
  }, [filteredOrders]);

  const selectedLocationName = useMemo(() => {
    if (!selectedLocationId) return 'All Locations';
    return locations.find((location) => Number(location.id) === Number(selectedLocationId))?.name || 'Filtered Location';
  }, [locations, selectedLocationId]);

  function focusLocation(locationId) {
    setSelectedLocationId((current) => {
      if (Number(current) === Number(locationId)) {
        setNotice('Location filter cleared.');
        return null;
      }

      const locationName = locations.find((location) => Number(location.id) === Number(locationId))?.name;
      setNotice(`Focused analytics on ${locationName || 'selected location'}.`);
      return locationId;
    });
  }

  async function runDiagnostics() {
    setError('');
    setNotice('Running diagnostics...');
    await loadDashboard(false);
    setNotice('Diagnostics complete. Data feed is synchronized.');
  }

  function isLocationChanged(location) {
    const draft = locationDrafts[location.id] || { name: location.name || '', address: location.address || '' };
    return (
      String(draft.name || '').trim() !== String(location.name || '').trim() ||
      String(draft.address || '').trim() !== String(location.address || '').trim()
    );
  }

  async function handleCreateLocation() {
    if (!newLocationName.trim()) {
      setError('Location name is required');
      return;
    }

    setCreatingLocation(true);
    setError('');
    setNotice('');

    try {
      await createLocation({
        name: newLocationName.trim(),
        address: newLocationAddress.trim() || null,
      });

      setNewLocationName('');
      setNewLocationAddress('');
      setNotice('Location created successfully.');
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create location');
    } finally {
      setCreatingLocation(false);
    }
  }

  async function saveLocationDraft(location) {
    const draft = locationDrafts[location.id] || { name: location.name || '', address: location.address || '' };
    const nextName = String(draft.name || '').trim();
    if (!nextName) {
      setError('Location name cannot be empty');
      return;
    }

    setSavingLocationId(location.id);
    setError('');
    setNotice('');

    try {
      await updateLocation(location.id, {
        name: nextName,
        address: String(draft.address || '').trim() || null,
      });
      setNotice(`Saved location ${location.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update location');
    } finally {
      setSavingLocationId(null);
    }
  }

  async function removeLocation(location) {
    if (!window.confirm(`Delete location ${location.name}?`)) {
      return;
    }

    setDeletingLocationId(location.id);
    setError('');
    setNotice('');

    try {
      await deleteLocation(location.id);
      setNotice(`Deleted location ${location.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete location');
    } finally {
      setDeletingLocationId(null);
    }
  }

  function isUserChanged(member) {
    const draft = userDrafts[member.id] || {
      name: member.name || '',
      email: member.email || '',
      role: member.role || 'waiter',
      location_id: member.location_id ? String(member.location_id) : '',
      password: '',
    };

    const draftLocation = draft.role === 'owner' ? null : Number(draft.location_id);
    const currentLocation = member.role === 'owner' ? null : Number(member.location_id);

    return (
      String(draft.name || '').trim() !== String(member.name || '').trim() ||
      String(draft.email || '').trim().toLowerCase() !== String(member.email || '').trim().toLowerCase() ||
      draft.role !== member.role ||
      draftLocation !== currentLocation ||
      Boolean(String(draft.password || '').trim())
    );
  }

  async function saveUserDraft(member) {
    const draft = userDrafts[member.id] || {};
    const payload = {
      name: String(draft.name || '').trim(),
      email: String(draft.email || '').trim(),
      role: draft.role,
    };

    if (!payload.name || !payload.email || !payload.role) {
      setError('User name, email and role are required');
      return;
    }

    if (payload.role === 'owner') {
      payload.location_id = null;
    } else {
      const parsedLocation = Number(draft.location_id);
      if (!Number.isInteger(parsedLocation) || parsedLocation <= 0) {
        setError('Non-owner users require a valid location');
        return;
      }
      payload.location_id = parsedLocation;
    }

    const password = String(draft.password || '').trim();
    if (password) {
      payload.password = password;
    }

    setSavingUserId(member.id);
    setError('');
    setNotice('');

    try {
      await updateUser(member.id, payload);
      setNotice(`Saved user ${member.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update user');
    } finally {
      setSavingUserId(null);
    }
  }

  async function removeUserAccount(member) {
    if (!window.confirm(`Delete user ${member.name}?`)) {
      return;
    }

    setDeletingUserId(member.id);
    setError('');
    setNotice('');

    try {
      await deleteUser(member.id);
      setNotice(`Deleted user ${member.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete user');
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleCreateUserAccount() {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setError('Name, email and password are required');
      return;
    }

    const payload = {
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      password: newUserPassword,
      role: newUserRole,
    };

    if (newUserRole !== 'owner') {
      const parsedLocation = Number(newUserLocationId);
      if (!Number.isInteger(parsedLocation) || parsedLocation <= 0) {
        setError('Select a valid location for non-owner users');
        return;
      }
      payload.location_id = parsedLocation;
    }

    setCreatingUser(true);
    setError('');
    setNotice('');

    try {
      await createUser(payload);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('manager');
      setNewUserLocationId('');
      setNotice('User created successfully.');
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user');
    } finally {
      setCreatingUser(false);
    }
  }

  function activateEmergencyMode() {
    const mostAtRisk = locationPerformance.find((location) => location.health === 'alert');
    setEmergencyMode(true);
    setPeriod('weekly');

    if (mostAtRisk) {
      setSelectedLocationId(mostAtRisk.id);
      setNotice(`Emergency mode active: focusing on ${mostAtRisk.name}.`);
    } else {
      setSelectedLocationId(null);
      setNotice('Emergency mode active: no critical locations detected, monitoring all nodes.');
    }

    scrollToSection(locationsSectionRef);
  }

  async function runGlobalAdjustment() {
    const percentage = Number(globalAdjustment);
    if (!Number.isFinite(percentage) || percentage <= -100 || percentage > 500) {
      setError('Global adjustment must be between -100 and 500');
      return;
    }

    setAdjusting(true);
    setError('');
    setNotice('');

    try {
      const response = await applyGlobalPriceAdjustment({
        percentage,
        include_inactive: false,
      });

      const updatedCount = response.data.updated_count || 0;
      setNotice(`Global sync complete. Updated ${updatedCount} active menu item(s).`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not run global adjustment');
    } finally {
      setAdjusting(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            Loading Owner Command
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-24">
      <header className="bg-[#fcf9f8] dark:bg-[#121212] border-none flex justify-between items-center px-6 py-4 w-full docked full-width top-0 sticky z-50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="material-symbols-outlined text-black dark:text-white transition-colors hover:bg-[#e5e2e1] dark:hover:bg-[#2c2c2c] p-2 rounded-sm"
          >
            restaurant_menu
          </button>
          <h1 className="text-[#000000] dark:text-white font-['Space_Grotesk'] font-black text-2xl tracking-tight uppercase">
            The Kinetic Editorial
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-8">
            <button
              type="button"
              onClick={() => scrollToSection(analyticsSectionRef)}
              className="text-black dark:text-white font-black underline underline-offset-8 decoration-4 font-['Space_Grotesk'] uppercase tracking-tighter"
            >
              Analytics
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(locationsSectionRef)}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              Locations
            </button>
            <button
              onClick={() => loadDashboard(false)}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={onLogout}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              Logout
            </button>
          </nav>
          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center overflow-hidden border border-outline-variant/20 active:scale-[0.97] transition-transform cursor-pointer">
            <span className="font-bold text-lg">{String(user.name || 'O')[0].toUpperCase()}</span>
          </div>
        </div>
        <div className="bg-[#f6f3f2] dark:bg-[#1c1b1b] h-[2px] w-full absolute bottom-0 left-0"></div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        {error ? (
          <div className="bg-error-container border border-error/30 text-on-error-container p-4 text-sm font-bold">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="bg-secondary-container border border-secondary/30 text-on-secondary-container p-4 text-sm font-bold">
            {notice}
          </div>
        ) : null}
        {selectedLocationId ? (
          <div className="bg-surface-container-low border border-outline-variant/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
            <span>Location Filter: {selectedLocationName}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedLocationId(null);
                setEmergencyMode(false);
                setNotice('Location filter cleared.');
              }}
              className="px-3 py-1 bg-black text-white hover:opacity-90"
            >
              Clear Filter
            </button>
          </div>
        ) : null}

        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-secondary rounded-full animate-pulse"></span>
              <p className="text-secondary font-black text-xs tracking-[0.3em] uppercase font-label">
                Global Command Active
              </p>
            </div>
            <h2 className="text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] border-l-8 border-black pl-6">
              Owner
              <br />
              Dashboard
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
            <div className="bg-surface-container-low px-5 py-4 flex flex-col items-start border border-outline-variant/20">
              <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-[0.2em] mb-1">
                Nodes Online
              </span>
              <span className="text-3xl font-black font-headline">
                {locations.length} <span className="text-on-surface-variant/30">/ {locations.length || 0}</span>
              </span>
            </div>
            <div className="bg-primary px-5 py-4 flex flex-col items-start text-on-primary border border-primary">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1">Fleet Health</span>
              <span className="text-3xl font-black font-headline flex items-center gap-3">
                {fleetHealth}
                <span className="material-symbols-outlined text-secondary text-2xl">verified_user</span>
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 bg-surface-container-low border border-outline-variant/10 p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10 space-y-12">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant mb-4">
                    Total Aggregate Revenue
                  </h3>
                  <span className="text-7xl md:text-9xl font-black font-headline tracking-tighter block leading-none">
                      ${Number(selectedLocationId ? filteredRevenue : salesSummary.total_revenue || 0).toFixed(2)}
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant mt-3">
                    {selectedLocationName} • {selectedLocationId ? filteredOrderCount : Number(salesSummary.total_orders || 0)} orders
                  </p>
                </div>
                <div className="bg-secondary text-white px-4 py-2 font-black text-sm tracking-tighter flex items-center gap-2">
                  <span className="material-symbols-outlined font-bold">trending_up</span>
                  {period}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b-2 border-black pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest">Order Velocity</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Live Feed</p>
                </div>
                <div className="h-32 flex items-end gap-1">
                  {orderTrend.map((bucket) => (
                    <div
                      key={bucket.label}
                      className={`flex-1 ${bucket.value ? 'bg-surface-container-highest hover:bg-black transition-colors' : 'bg-surface-container-highest/50'} ${
                        bucket.pct >= 90 ? 'bg-black' : ''
                      }`}
                      style={{ height: `${Math.max(8, bucket.pct)}%` }}
                      title={`${bucket.label}: ${bucket.value} orders`}
                    ></div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {orderTrend.map((bucket) => (
                    <span key={`${bucket.label}-label`}>{bucket.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-tertiary text-on-primary p-8 flex flex-col justify-between border border-tertiary relative">
            <div className="space-y-8">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-60">System Health Node</h3>
              <div className="space-y-6">
                {locationPerformance.map((location) => (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => focusLocation(location.id)}
                    className={`w-full text-left flex justify-between items-center group cursor-pointer p-1 border ${
                      Number(selectedLocationId) === Number(location.id) ? 'border-secondary' : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          location.health === 'alert'
                            ? 'bg-error animate-pulse'
                            : location.health === 'watch'
                              ? 'bg-[#ffb68f]'
                              : 'bg-secondary'
                        }`}
                      ></span>
                      <span className="font-headline font-bold text-sm uppercase">{location.name}</span>
                    </div>
                    <span className={`text-[10px] font-black ${location.health === 'alert' ? 'text-error' : 'opacity-60'}`}>
                      ${location.revenue.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={runDiagnostics}
              className="mt-8 w-full py-4 border border-on-primary/20 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-on-primary hover:text-primary transition-all active:scale-[0.98]"
            >
              Diagnostics
            </button>
          </div>
        </section>

        <section ref={locationsSectionRef} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {locationPerformance.map((location) => (
            <button
              key={`perf-${location.id}`}
              type="button"
              onClick={() => focusLocation(location.id)}
              className={`text-left bg-surface-container-low p-8 border-l-4 border-black space-y-6 ${
                Number(selectedLocationId) === Number(location.id) ? 'ring-2 ring-secondary/50' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <h4 className="text-xl font-black uppercase tracking-tighter">{location.name}</h4>
                <span className="material-symbols-outlined text-secondary">
                  {location.health === 'alert' ? 'trending_down' : location.health === 'watch' ? 'trending_flat' : 'trending_up'}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-4xl font-black font-headline tracking-tighter">${location.revenue.toFixed(2)}</p>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Revenue ({period})</p>
              </div>
              <div className="h-1 bg-surface-container-highest">
                <div
                  className={`h-full ${location.health === 'alert' ? 'bg-error' : location.health === 'watch' ? 'bg-[#d76100]' : 'bg-secondary'}`}
                  style={{ width: `${Math.min(100, Math.max(10, location.activeOrders * 12))}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span>Active Orders</span>
                <span>{location.activeOrders}</span>
              </div>
            </button>
          ))}
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-surface-container-low border border-outline-variant/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tighter">Location Studio</h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Create And Edit
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Location name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="text"
                placeholder="Address"
                value={newLocationAddress}
                onChange={(e) => setNewLocationAddress(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <button
                type="button"
                onClick={handleCreateLocation}
                disabled={creatingLocation}
                className="md:col-span-1 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {creatingLocation ? 'Creating...' : 'Add Location'}
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {locations.map((location) => {
                const draft = locationDrafts[location.id] || { name: location.name || '', address: location.address || '' };
                return (
                  <div key={`loc-manage-${location.id}`} className="p-3 bg-white border border-outline-variant/20 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [location.id]: {
                              ...prev[location.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      />
                      <input
                        type="text"
                        value={draft.address}
                        onChange={(e) =>
                          setLocationDrafts((prev) => ({
                            ...prev,
                            [location.id]: {
                              ...prev[location.id],
                              address: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveLocationDraft(location)}
                        disabled={!isLocationChanged(location) || savingLocationId === location.id}
                        className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {savingLocationId === location.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLocation(location)}
                        disabled={deletingLocationId === location.id}
                        className="px-3 py-1 border border-error text-error text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {deletingLocationId === location.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tighter">Access Control</h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Authorize Users
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
              <input
                type="text"
                placeholder="Name"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="password"
                placeholder="Password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <select
                value={newUserRole}
                onChange={(e) => {
                  const role = e.target.value;
                  setNewUserRole(role);
                  if (role === 'owner') {
                    setNewUserLocationId('');
                  }
                }}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              >
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="waiter">Waiter</option>
                <option value="kitchen">Kitchen</option>
              </select>
              <div className="md:col-span-1 flex gap-2">
                <select
                  value={newUserLocationId}
                  onChange={(e) => setNewUserLocationId(e.target.value)}
                  disabled={newUserRole === 'owner'}
                  className="flex-1 px-2 py-2 bg-white border border-outline-variant/30 disabled:opacity-50"
                >
                  <option value="">Location</option>
                  {locations.map((location) => (
                    <option key={`new-user-location-${location.id}`} value={String(location.id)}>
                      {location.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleCreateUserAccount}
                  disabled={creatingUser}
                  className="px-3 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {creatingUser ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
              {users.map((member) => {
                const draft = userDrafts[member.id] || {
                  name: member.name || '',
                  email: member.email || '',
                  role: member.role || 'waiter',
                  location_id: member.location_id ? String(member.location_id) : '',
                  password: '',
                };
                const isSelf = Number(member.id) === Number(user.id);

                return (
                  <div key={`user-manage-${member.id}`} className="p-3 bg-white border border-outline-variant/20 space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) =>
                          setUserDrafts((prev) => ({
                            ...prev,
                            [member.id]: {
                              ...prev[member.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      />
                      <input
                        type="email"
                        value={draft.email}
                        onChange={(e) =>
                          setUserDrafts((prev) => ({
                            ...prev,
                            [member.id]: {
                              ...prev[member.id],
                              email: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <select
                        value={draft.role}
                        onChange={(e) =>
                          setUserDrafts((prev) => ({
                            ...prev,
                            [member.id]: {
                              ...prev[member.id],
                              role: e.target.value,
                              location_id:
                                e.target.value === 'owner'
                                  ? ''
                                  : prev[member.id]?.location_id || (member.location_id ? String(member.location_id) : ''),
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      >
                        <option value="owner">Owner</option>
                        <option value="manager">Manager</option>
                        <option value="waiter">Waiter</option>
                        <option value="kitchen">Kitchen</option>
                      </select>

                      <select
                        value={draft.location_id || ''}
                        onChange={(e) =>
                          setUserDrafts((prev) => ({
                            ...prev,
                            [member.id]: {
                              ...prev[member.id],
                              location_id: e.target.value,
                            },
                          }))
                        }
                        disabled={draft.role === 'owner'}
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30 disabled:opacity-50"
                      >
                        <option value="">Location</option>
                        {locations.map((location) => (
                          <option key={`member-location-${member.id}-${location.id}`} value={String(location.id)}>
                            {location.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="password"
                        placeholder="New password (optional)"
                        value={draft.password}
                        onChange={(e) =>
                          setUserDrafts((prev) => ({
                            ...prev,
                            [member.id]: {
                              ...prev[member.id],
                              password: e.target.value,
                            },
                          }))
                        }
                        className="px-3 py-2 bg-surface-container-low border border-outline-variant/30"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveUserDraft(member)}
                        disabled={!isUserChanged(member) || savingUserId === member.id}
                        className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {savingUserId === member.id ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUserAccount(member)}
                        disabled={isSelf || deletingUserId === member.id}
                        className="px-3 py-1 border border-error text-error text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {deletingUserId === member.id ? 'Deleting...' : isSelf ? 'Current User' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section ref={analyticsSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-8">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
              <h3 className="text-3xl font-black tracking-tighter uppercase font-headline">Sales Performance</h3>
              <div className="flex bg-surface-container-low p-1 gap-1">
                {PERIODS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${
                      period === value
                        ? 'bg-black text-white'
                        : 'hover:bg-surface-container-highest transition-colors'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-outline-variant/20 p-8">
              <div className="h-80 relative flex items-end justify-between px-4 pb-12">
                {topSellers.map((item) => {
                  const highest = topSellers[0]?.total_revenue || 1;
                  const pct = Math.round((item.total_revenue / highest) * 100);
                  return (
                    <div key={item.menu_item_id} className="w-20 group relative flex flex-col justify-end items-center h-full">
                      <div className={`w-full ${pct >= 90 ? 'bg-secondary' : 'bg-primary-fixed hover:bg-black transition-all'}`} style={{ height: `${Math.max(15, pct)}%` }}></div>
                      <span className="absolute -bottom-6 text-[10px] font-black uppercase tracking-tighter">
                        {item.item_name.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-surface-container-low border border-outline-variant/20 flex flex-col h-full">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Global Top Sellers</h3>
              <span className="text-[10px] font-black bg-black text-white px-2 py-1">{period}</span>
            </div>
            <div className="flex-1 p-6 space-y-8">
              {topSellers.map((item) => (
                <div key={`top-${item.menu_item_id}`} className="flex items-center gap-5">
                  <div className="w-20 h-20 bg-surface-container-highest overflow-hidden border border-outline-variant/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">restaurant</span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-black font-headline uppercase tracking-tight text-lg">{item.item_name}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">{item.total_sold} units</span>
                      <span className="text-xs font-black text-secondary">${item.total_revenue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {!topSellers.length ? (
                <p className="text-sm text-on-surface-variant">No sales yet for this period.</p>
              ) : null}
            </div>
            <div className="p-6 bg-black">
              <p className="text-[10px] font-black uppercase text-white text-center tracking-[0.3em]">
                {menuItems.length} menu items in catalog
              </p>
            </div>
          </div>
        </section>

        <section ref={syncSectionRef} className="bg-tertiary text-on-primary p-12 border-t-[12px] border-secondary flex flex-col md:flex-row gap-16 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
          <div className="max-w-xl space-y-8 relative z-10">
            <div className="inline-flex items-center gap-4 bg-secondary/20 px-4 py-2 border border-secondary/30">
              <span className="material-symbols-outlined text-secondary">hub</span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">Multi-Node Command Center</span>
            </div>
            <h3 className="text-6xl font-black tracking-tighter uppercase font-headline leading-none">
              Global Sync Command
            </h3>
            <p className="text-on-primary/60 font-medium leading-relaxed text-lg italic border-l-2 border-on-primary/20 pl-6">
              Deploy price adjustments across the full fleet in one action.
            </p>
            {emergencyMode ? (
              <p className="text-[10px] font-black uppercase tracking-[0.3em] bg-error/20 border border-error/40 p-3 inline-block">
                Emergency mode enabled
              </p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={globalAdjustment}
                onChange={(e) => setGlobalAdjustment(e.target.value)}
                className="bg-white/10 border border-white/20 text-white px-4 py-4 font-black text-xl w-full sm:w-40 focus:outline-none focus:border-secondary"
              />
              <button
                onClick={runGlobalAdjustment}
                disabled={adjusting}
                className="group w-full md:w-auto bg-secondary hover:bg-secondary-fixed text-white px-10 py-6 flex items-center justify-between gap-8 transition-all active:scale-95 shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Execute Protocol</span>
                  <span className="text-2xl font-black uppercase tracking-tighter">
                    {adjusting ? 'Syncing...' : 'Push Global Price Update'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-4xl group-hover:translate-x-2 transition-transform">bolt</span>
              </button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            <button
              type="button"
              onClick={() => {
                setGlobalAdjustment('5');
                setNotice('Menu revision preset loaded (+5%).');
              }}
              className="text-left bg-white/5 backdrop-blur-md p-8 border border-white/10 flex flex-col justify-between"
            >
              <span className="material-symbols-outlined text-3xl opacity-70">menu_book</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Sync Protocol</p>
                <p className="text-2xl font-black font-headline uppercase">Menu Revisions</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setGlobalAdjustment('-10');
                setNotice('Flash promotion preset loaded (-10%).');
              }}
              className="text-left bg-white/5 backdrop-blur-md p-8 border border-white/10 flex flex-col justify-between"
            >
              <span className="material-symbols-outlined text-3xl opacity-70">campaign</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Broadcast</p>
                <p className="text-2xl font-black font-headline uppercase">Flash Promotions</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => runDiagnostics()}
              className="text-left bg-white/5 backdrop-blur-md p-8 border border-white/10 flex flex-col justify-between"
            >
              <span className="material-symbols-outlined text-3xl opacity-70">inventory</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-2">Replenish</p>
                <p className="text-2xl font-black font-headline uppercase">Bulk Order Auto-Sync</p>
              </div>
            </button>
            <button
              type="button"
              onClick={activateEmergencyMode}
              className="bg-error/20 hover:bg-error/30 text-error p-8 border border-error/30 flex flex-col justify-center items-center text-center gap-4 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-4xl animate-pulse">dangerous</span>
              <p className="text-sm font-black uppercase tracking-[0.3em]">Emergency Lockdown</p>
            </button>
          </div>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-stretch overflow-hidden bg-[#000000] h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
        <button
          type="button"
          onClick={() => scrollToSection(analyticsSectionRef)}
          className="flex flex-col items-center justify-center bg-[#1c1b1b] text-white rounded-none border-t-4 border-[#1b6d24] h-full w-full active:bg-[#1b6d24] transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Analytics</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(locationsSectionRef)}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">location_on</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Locations</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(syncSectionRef)}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">restaurant</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Global Menu</span>
        </button>
        <button onClick={onLogout} className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">Logout</span>
        </button>
      </nav>
    </div>
  );
}
