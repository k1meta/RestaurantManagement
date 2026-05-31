import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ToastContainer from '../components/ToastContainer';
import useToast from '../hooks/useToast';

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
  const { t } = useTranslation(['owner', 'common']);
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
  const { toasts, addToast, removeToast } = useToast();

  const [selectedLocationId, setSelectedLocationId] = useState(null);

  const analyticsSectionRef = useRef(null);
  const locationsSectionRef = useRef(null);

  function scrollToSection(ref) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const loadDashboard = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

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
      addToast(err.response?.data?.error || 'Could not load owner dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period, addToast]);

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
        addToast('Location filter cleared.', 'success');
        return null;
      }

      const locationName = locations.find((location) => Number(location.id) === Number(locationId))?.name;
      addToast(`Focused analytics on ${locationName || 'selected location'}.`, 'success');
      return locationId;
    });
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
      addToast('Location name is required', 'error');
      return;
    }

    setCreatingLocation(true);

    try {
      await createLocation({
        name: newLocationName.trim(),
        address: newLocationAddress.trim() || null,
      });

      setNewLocationName('');
      setNewLocationAddress('');
      addToast('Location created successfully.', 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not create location', 'error');
    } finally {
      setCreatingLocation(false);
    }
  }

  async function saveLocationDraft(location) {
    const draft = locationDrafts[location.id] || { name: location.name || '', address: location.address || '' };
    const nextName = String(draft.name || '').trim();
    if (!nextName) {
      addToast('Location name cannot be empty', 'error');
      return;
    }

    setSavingLocationId(location.id);

    try {
      await updateLocation(location.id, {
        name: nextName,
        address: String(draft.address || '').trim() || null,
      });
      addToast(`Saved location ${location.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update location', 'error');
    } finally {
      setSavingLocationId(null);
    }
  }

  async function removeLocation(location) {
    if (!window.confirm(`Delete location ${location.name}?`)) {
      return;
    }

    setDeletingLocationId(location.id);

    try {
      await deleteLocation(location.id);
      addToast(`Deleted location ${location.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not delete location', 'error');
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
      addToast('User name, email and role are required', 'error');
      return;
    }

    if (payload.role === 'owner') {
      payload.location_id = null;
    } else {
      const parsedLocation = Number(draft.location_id);
      if (!Number.isInteger(parsedLocation) || parsedLocation <= 0) {
        addToast('Non-owner users require a valid location', 'error');
        return;
      }
      payload.location_id = parsedLocation;
    }

    const password = String(draft.password || '').trim();
    if (password) {
      payload.password = password;
    }

    setSavingUserId(member.id);

    try {
      await updateUser(member.id, payload);
      addToast(`Saved user ${member.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update user', 'error');
    } finally {
      setSavingUserId(null);
    }
  }

  async function removeUserAccount(member) {
    if (!window.confirm(`Delete user ${member.name}?`)) {
      return;
    }

    setDeletingUserId(member.id);

    try {
      await deleteUser(member.id);
      addToast(`Deleted user ${member.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not delete user', 'error');
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleCreateUserAccount() {
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      addToast('Name, email and password are required', 'error');
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
        addToast('Select a valid location for non-owner users', 'error');
        return;
      }
      payload.location_id = parsedLocation;
    }

    setCreatingUser(true);

    try {
      await createUser(payload);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('manager');
      setNewUserLocationId('');
      addToast('User created successfully.', 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            {t('loadingCommand')}
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
            {t('common:brandName')}
          </h1>
        </div>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-8">
            <button
              type="button"
              onClick={() => scrollToSection(analyticsSectionRef)}
              className="text-black dark:text-white font-black underline underline-offset-8 decoration-4 font-['Space_Grotesk'] uppercase tracking-tighter"
            >
              {t('analytics')}
            </button>
            <button
              type="button"
              onClick={() => scrollToSection(locationsSectionRef)}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              {t('locations')}
            </button>
            <button
              onClick={() => loadDashboard(false)}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              {refreshing ? t('common:refreshing') : t('common:refresh')}
            </button>
            <button
              onClick={onLogout}
              className="text-[#1c1b1b]/60 dark:text-[#e5e2e1]/60 font-medium font-['Space_Grotesk'] uppercase tracking-tighter hover:text-black transition-colors"
            >
              {t('common:logout')}
            </button>
            <LanguageSwitcher />
          </nav>
          <div className="w-10 h-10 bg-surface-container-highest rounded-full flex items-center justify-center overflow-hidden border border-outline-variant/20 active:scale-[0.97] transition-transform cursor-pointer">
            <span className="font-bold text-lg">{String(user.name || 'O')[0].toUpperCase()}</span>
          </div>
        </div>
        <div className="bg-[#f6f3f2] dark:bg-[#1c1b1b] h-[2px] w-full absolute bottom-0 left-0"></div>
      </header>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main className="max-w-7xl mx-auto px-6 pt-12 space-y-12">
        {selectedLocationId ? (
          <div className="bg-surface-container-low border border-outline-variant/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
            <span>{t('locationFilter', { name: selectedLocationName })}</span>
            <button
              type="button"
              onClick={() => {
                setSelectedLocationId(null);
                addToast('Location filter cleared.', 'success');
              }}
              className="px-3 py-1 bg-black text-white hover:opacity-90"
            >
              {t('clearFilter')}
            </button>
          </div>
        ) : null}

        <section>
          <div className="space-y-2">
            <h2 className="text-6xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9] border-l-8 border-black pl-6">
              {t('ownerDashboard').split('\n').map((line, i) => (
                <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
              ))}
            </h2>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 lg:row-start-1 lg:row-end-3 bg-surface-container-low border border-outline-variant/10 p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10 space-y-12">
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-on-surface-variant mb-4">
                  {t('totalAggregateRevenue')}
                </h3>
                <span className="text-7xl md:text-9xl font-black font-headline tracking-tighter block leading-none">
                  ${Number(selectedLocationId ? filteredRevenue : salesSummary.total_revenue || 0).toFixed(2)}
                </span>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-on-surface-variant mt-3">
                  {t('ordersLabel', { location: selectedLocationName, count: selectedLocationId ? filteredOrderCount : Number(salesSummary.total_orders || 0) })}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b-2 border-black pb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest">{t('orderVelocity')}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">{t('liveFeed')}</p>
                </div>
                <div className="h-32 flex items-end gap-1">
                  {orderTrend.map((bucket) => (
                    <div
                      key={bucket.label}
                      className={`flex-1 ${bucket.value ? 'bg-surface-container-highest hover:bg-black transition-colors' : 'bg-surface-container-highest/50'} ${bucket.pct >= 90 ? 'bg-black' : ''
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

          <div className="lg:col-span-1 lg:row-start-2 lg:row-end-4 flex flex-col gap-4">
            <div className="bg-surface-container-low px-5 py-4 flex flex-col items-start border border-outline-variant/20">
              <span className="text-[10px] font-bold uppercase text-on-surface-variant tracking-[0.2em] mb-1">
                {t('nodesOnline')}
              </span>
              <span className="text-3xl font-black font-headline">
                {locations.length} <span className="text-on-surface-variant/30">/ {locations.length || 0}</span>
              </span>
            </div>

            <div className="bg-tertiary text-on-primary p-8 flex flex-col flex-1 border border-tertiary relative min-h-[280px]">
              <div className="space-y-8">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-60">{t('systemHealthNode')}</h3>
                <div className="space-y-6">
                  {locationPerformance.map((location) => (
                    <button
                      key={location.id}
                      type="button"
                      onClick={() => focusLocation(location.id)}
                      className={`w-full text-left flex justify-between items-center group cursor-pointer p-1 border ${Number(selectedLocationId) === Number(location.id) ? 'border-secondary' : 'border-transparent'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-2 h-2 rounded-full ${location.health === 'alert'
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
            </div>
          </div>

          <div ref={locationsSectionRef} className="lg:col-span-3 lg:row-start-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            {locationPerformance.map((location) => (
              <button
                key={`perf-${location.id}`}
                type="button"
                onClick={() => focusLocation(location.id)}
                className={`text-left bg-surface-container-low p-8 border-l-4 border-black space-y-6 ${Number(selectedLocationId) === Number(location.id) ? 'ring-2 ring-secondary/50' : ''
                  }`}
              >
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tighter">{location.name}</h4>
                </div>
                <div className="space-y-1">
                  <p className="text-4xl font-black font-headline tracking-tighter">${location.revenue.toFixed(2)}</p>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{t('revenuePeriod', { period: t(period) })}</p>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span>{t('activeOrders')}</span>
                  <span>{location.activeOrders}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-surface-container-low border border-outline-variant/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tighter">{t('locationStudio')}</h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t('createAndEdit')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder={t('locationNamePlaceholder')}
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="text"
                placeholder={t('addressPlaceholder')}
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
                {creatingLocation ? t('common:creating') : t('addLocation')}
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
                        {savingLocationId === location.id ? t('common:saving') : t('common:save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLocation(location)}
                        disabled={deletingLocationId === location.id}
                        className="px-3 py-1 border border-error text-error text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {deletingLocationId === location.id ? t('common:deleting') : t('common:delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/20 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black uppercase tracking-tighter">{t('accessControl')}</h3>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t('authorizeUsers')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
              <input
                type="text"
                placeholder={t('namePlaceholder')}
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="email"
                placeholder={t('emailPlaceholder')}
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                className="md:col-span-1 px-3 py-2 bg-white border border-outline-variant/30"
              />
              <input
                type="password"
                placeholder={t('passwordPlaceholder')}
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
                className="md:col-span-1 px-3 py-2 pr-8 bg-white border border-outline-variant/30"
              >
                <option value="owner">{t('common:owner')}</option>
                <option value="manager">{t('common:manager')}</option>
                <option value="waiter">{t('common:waiter')}</option>
                <option value="kitchen">{t('common:kitchen')}</option>
              </select>
              <div className="md:col-span-2 flex gap-2">
                <select
                  value={newUserLocationId}
                  onChange={(e) => setNewUserLocationId(e.target.value)}
                  disabled={newUserRole === 'owner'}
                  className="flex-1 px-2 py-2 pr-8 bg-white border border-outline-variant/30 disabled:opacity-50"
                >
                  <option value="">{t('location')}</option>
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
                  {creatingUser ? t('common:adding') : t('common:add')}
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
                        className="px-3 py-2 pr-8 bg-surface-container-low border border-outline-variant/30"
                      >
                        <option value="owner">{t('common:owner')}</option>
                        <option value="manager">{t('common:manager')}</option>
                        <option value="waiter">{t('common:waiter')}</option>
                        <option value="kitchen">{t('common:kitchen')}</option>
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
                        className="px-3 py-2 pr-8 bg-surface-container-low border border-outline-variant/30 disabled:opacity-50"
                      >
                        <option value="">{t('location')}</option>
                        {locations.map((location) => (
                          <option key={`member-location-${member.id}-${location.id}`} value={String(location.id)}>
                            {location.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="password"
                        placeholder={t('newPasswordPlaceholder')}
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
                        {savingUserId === member.id ? t('common:saving') : t('common:save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUserAccount(member)}
                        disabled={isSelf || deletingUserId === member.id}
                        className="px-3 py-1 border border-error text-error text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                      >
                        {deletingUserId === member.id ? t('common:deleting') : isSelf ? t('currentUser') : t('common:delete')}
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
              <h3 className="text-3xl font-black tracking-tighter uppercase font-headline">{t('salesPerformance')}</h3>
              <div className="flex bg-surface-container-low p-1 gap-1">
                {PERIODS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setPeriod(value)}
                    className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest ${period === value
                        ? 'bg-black text-white'
                        : 'hover:bg-surface-container-highest transition-colors'
                      }`}
                  >
                    {t(value)}
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
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">{t('globalTopSellers')}</h3>
              <span className="text-[10px] font-black bg-black text-white px-2 py-1">{t(period)}</span>
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
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase">{t('units', { count: item.total_sold })}</span>
                      <span className="text-xs font-black text-secondary">${item.total_revenue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {!topSellers.length ? (
                <p className="text-sm text-on-surface-variant">{t('noSalesYet')}</p>
              ) : null}
            </div>
            <div className="p-6 bg-black">
              <p className="text-[10px] font-black uppercase text-white text-center tracking-[0.3em]">
                {t('menuItemsInCatalog', { count: menuItems.length })}
              </p>
            </div>
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
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">{t('analytics')}</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(locationsSectionRef)}
          className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all"
        >
          <span className="material-symbols-outlined">location_on</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">{t('locations')}</span>
        </button>
        <LanguageSwitcher compact />
        <button onClick={onLogout} className="flex flex-col items-center justify-center text-[#e5e2e1]/70 h-full w-full hover:bg-[#1c1b1b] active:bg-[#1b6d24] transition-all">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest mt-1">{t('common:logout')}</span>
        </button>
      </nav>
    </div>
  );
}
