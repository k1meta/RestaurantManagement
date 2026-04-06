import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMenuItem,
  createUser,
  deleteUser,
  getInventory,
  getMenu,
  getOrders,
  getSales,
  getUsers,
  updateMenuItem,
  updateUser,
  upsertInventoryItem,
} from '../api/client';

function initials(name) {
  return String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function normalizeInventory(inventory) {
  return inventory.map((item) => {
    const quantity = Number(item.quantity || 0);
    const target = Math.max(50, Math.round(quantity * 2) || 50);
    const percent = Math.min(100, Math.round((quantity / target) * 100));

    let status = 'stable';
    if (percent < 35) status = 'critical';
    else if (percent < 60) status = 'warning';

    return {
      ...item,
      quantity,
      target,
      percent,
      status,
    };
  });
}

function defaultMenuDraftFromItem(item) {
  return {
    name: item.name,
    category: item.category || '',
    price: Number(item.price),
    active: Boolean(item.active),
  };
}

function hasMenuDraftChanges(item, draft) {
  return (
    String(draft.name || '').trim() !== String(item.name || '').trim() ||
    String(draft.category || '').trim() !== String(item.category || '').trim() ||
    Number(draft.price) !== Number(item.price) ||
    Boolean(draft.active) !== Boolean(item.active)
  );
}

function AvailabilitySwitch({ checked, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      className={`inline-flex h-8 w-14 items-center rounded-full p-1 transition-colors ${
        checked ? 'bg-secondary' : 'bg-surface-container-highest'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function ManagerDashboard({ user, onLogout }) {
  const [inventory, setInventory] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [orders, setOrders] = useState([]);
  const [salesSummary, setSalesSummary] = useState({ total_revenue: 0, total_orders: 0, total_items_sold: 0 });

  const [menuDrafts, setMenuDrafts] = useState({});
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [creatingMenuItem, setCreatingMenuItem] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuActive, setNewMenuActive] = useState(true);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('waiter');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffRoleDrafts, setStaffRoleDrafts] = useState({});
  const [updatingStaffId, setUpdatingStaffId] = useState(null);
  const [deletingStaffId, setDeletingStaffId] = useState(null);

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [ingredient, setIngredient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [savingInventory, setSavingInventory] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publishingAll, setPublishingAll] = useState(false);
  const [mobileTab, setMobileTab] = useState('inventory');

  const staffSectionRef = useRef(null);
  const inventorySectionRef = useRef(null);
  const menuSectionRef = useRef(null);

  function scrollToSection(ref, tabName) {
    setMobileTab(tabName);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function loadDashboard(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const [inventoryRes, menuRes, usersRes, ordersRes, salesRes] = await Promise.all([
        getInventory(),
        getMenu({ include_inactive: true }),
        getUsers(),
        getOrders({ include_closed: false }),
        getSales('monthly'),
      ]);

      const nextInventory = inventoryRes.data.inventory || [];
      const nextMenu = menuRes.data.menu || [];

      setInventory(nextInventory);
      setMenuItems(nextMenu);
      const nextStaff = usersRes.data.users || [];
      setStaff(nextStaff);
      setOrders(ordersRes.data.orders || []);
      setSalesSummary(salesRes.data.summary || { total_revenue: 0, total_orders: 0, total_items_sold: 0 });

      setMenuDrafts(() => {
        const next = {};
        for (const item of nextMenu) {
          next[item.id] = defaultMenuDraftFromItem(item);
        }
        return next;
      });

      setStaffRoleDrafts(() => {
        const next = {};
        for (const member of nextStaff) {
          next[member.id] = member.role;
        }
        return next;
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load manager dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard(true);
  }, []);

  const inventoryView = useMemo(() => normalizeInventory(inventory), [inventory]);
  const lowStock = useMemo(
    () => inventoryView.filter((item) => item.status !== 'stable').sort((a, b) => a.percent - b.percent),
    [inventoryView]
  );

  const topMenu = useMemo(() => menuItems, [menuItems]);
  const menuRows = useMemo(
    () =>
      topMenu.map((item) => {
        const draft = menuDrafts[item.id] || defaultMenuDraftFromItem(item);
        return {
          item,
          draft,
          hasChanges: hasMenuDraftChanges(item, draft),
        };
      }),
    [topMenu, menuDrafts]
  );

  function isMenuChanged(item) {
    const draft = menuDrafts[item.id] || defaultMenuDraftFromItem(item);
    return hasMenuDraftChanges(item, draft);
  }

  async function handleCreateMenuItem() {
    const parsedPrice = Number(newMenuPrice);
    if (!newMenuName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('New menu item requires a name and valid price');
      return;
    }

    setCreatingMenuItem(true);
    setError('');
    setNotice('');

    try {
      await createMenuItem({
        name: newMenuName.trim(),
        category: newMenuCategory.trim() || null,
        price: parsedPrice,
        active: Boolean(newMenuActive),
      });

      setNewMenuName('');
      setNewMenuCategory('');
      setNewMenuPrice('');
      setNewMenuActive(true);
      setNotice('New menu item created successfully.');
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create menu item');
    } finally {
      setCreatingMenuItem(false);
    }
  }

  async function handleCreateStaffUser() {
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword.trim()) {
      setError('Name, email, and password are required to create a user');
      return;
    }

    setCreatingStaff(true);
    setError('');
    setNotice('');

    try {
      await createUser({
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        role: newStaffRole,
      });

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setNewStaffRole('waiter');
      setNotice('New staff user created successfully.');
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user');
    } finally {
      setCreatingStaff(false);
    }
  }

  async function applyStaffRole(member) {
    const nextRole = staffRoleDrafts[member.id];
    if (!nextRole || nextRole === member.role) {
      return;
    }

    setUpdatingStaffId(member.id);
    setError('');
    setNotice('');

    try {
      await updateUser(member.id, { role: nextRole });
      setNotice(`Updated role for ${member.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update user role');
    } finally {
      setUpdatingStaffId(null);
    }
  }

  async function removeStaffUser(member) {
    if (!window.confirm(`Delete user ${member.name}?`)) {
      return;
    }

    setDeletingStaffId(member.id);
    setError('');
    setNotice('');

    try {
      await deleteUser(member.id);
      setNotice(`Deleted user ${member.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete user');
    } finally {
      setDeletingStaffId(null);
    }
  }

  async function handleInventorySave() {
    const parsedQuantity = Number(quantity);
    if (!ingredient.trim() || !Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      setError('Ingredient and a valid quantity are required');
      return;
    }

    setSavingInventory(true);
    setError('');
    setNotice('');

    try {
      await upsertInventoryItem({
        ingredient: ingredient.trim(),
        quantity: parsedQuantity,
        unit: unit.trim() || null,
      });

      setIngredient('');
      setQuantity('');
      setUnit('');
      setShowInventoryModal(false);
      setNotice('Inventory count saved successfully.');
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save inventory item');
    } finally {
      setSavingInventory(false);
    }
  }

  function setMenuDraft(itemId, patch) {
    setMenuDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...patch,
      },
    }));
  }

  async function saveMenuItem(item) {
    const draft = menuDrafts[item.id] || {
      name: item.name,
      category: item.category || '',
      price: Number(item.price),
      active: Boolean(item.active),
    };
    const nextPrice = Number(draft.price);
    const nextName = String(draft.name || '').trim();
    const nextCategory = String(draft.category || '').trim();

    if (!nextName || !Number.isFinite(nextPrice) || nextPrice <= 0) {
      setError('Menu item requires a name and positive price');
      return;
    }

    setSavingMenuId(item.id);
    setError('');
    setNotice('');

    try {
      await updateMenuItem(item.id, {
        name: nextName,
        category: nextCategory || null,
        price: nextPrice,
        active: Boolean(draft.active),
      });
      setNotice(`Saved changes for ${item.name}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update menu item');
    } finally {
      setSavingMenuId(null);
    }
  }

  async function restockItem(item) {
    try {
      await upsertInventoryItem({
        ingredient: item.ingredient,
        quantity: item.target,
        unit: item.unit,
      });
      setNotice(`${item.ingredient} restocked to ${item.target} ${item.unit || 'units'}.`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not restock item');
    }
  }

  async function publishAllMenuChanges() {
    const changedItems = topMenu.filter((item) => isMenuChanged(item));

    setError('');
    setNotice('');

    if (!changedItems.length) {
      setNotice('No pending menu changes to publish.');
      return;
    }

    setPublishingAll(true);
    try {
      await Promise.all(
        changedItems.map(async (item) => {
          const draft = menuDrafts[item.id];
          await updateMenuItem(item.id, {
            name: String(draft.name || '').trim() || item.name,
            category: String(draft.category || '').trim() || null,
            price: Number(draft.price),
            active: Boolean(draft.active),
          });
        })
      );

      setNotice(`Published ${changedItems.length} menu change(s).`);
      await loadDashboard(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not publish all menu changes');
    } finally {
      setPublishingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            Loading Manager Hub
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface pb-20">
      <header className="bg-[#fcf9f8] dark:bg-[#121212] flex justify-between items-center px-6 py-4 w-full sticky top-0 z-40 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border border-outline-variant/15">
            <span className="font-black">{initials(user.name)}</span>
          </div>
          <h1 className="font-['Space_Grotesk'] font-black text-2xl tracking-tight text-[#000000] dark:text-white uppercase tracking-tighter">
            The Kinetic Editorial
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => loadDashboard(false)}
            className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors"
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {error ? (
          <div className="lg:col-span-12 bg-error-container border border-error/30 text-on-error-container p-4 text-sm font-bold">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="lg:col-span-12 bg-secondary-container border border-secondary/30 text-on-secondary-container p-4 text-sm font-bold">
            {notice}
          </div>
        ) : null}

        <div className="lg:col-span-4 flex flex-col gap-6">
          <section className="bg-[#ffdad6] p-6 rounded-lg relative overflow-hidden border-2 border-error ring-4 ring-error/10">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2 bg-error text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                  priority_high
                </span>
                Critical
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-error-container">Immediate Attention</span>
            </div>
            <h3 className="font-headline text-2xl font-black text-on-error-container leading-none mb-3 uppercase tracking-tighter">
              {lowStock.length ? 'Refill Low Inventory' : 'Service Momentum Stable'}
            </h3>
            <p className="text-sm text-on-error-container/80 mb-6 leading-relaxed">
              {lowStock.length
                ? `${lowStock.length} ingredient(s) are below healthy stock level. Prioritize refills before dinner rush.`
                : 'No critical stock issues detected in this location.'}
            </p>
            <button
              onClick={() => lowStock[0] && restockItem(lowStock[0])}
              disabled={!lowStock.length}
              className="w-full bg-error text-white py-4 font-headline font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-error/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {lowStock.length ? `Refill ${lowStock[0].ingredient}` : 'All Good'}
            </button>
          </section>

          <section ref={staffSectionRef} className="bg-surface-container-low p-6 rounded-lg">
            <div className="flex justify-between items-center mb-6 border-b border-outline-variant/20 pb-2">
              <h2 className="font-headline text-xs font-bold uppercase tracking-[0.2em]">Live: On Shift</h2>
              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {staff.length} active
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {staff.map((member) => {
                const roleDraft = staffRoleDrafts[member.id] || member.role;
                const isSelf = Number(member.id) === Number(user.id);
                const canManage = !isSelf && member.role !== 'manager';

                return (
                  <div
                    key={member.id}
                    className="p-3 bg-surface-container-lowest border border-outline-variant/10 rounded-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-sm bg-secondary-container flex items-center justify-center text-xs font-bold text-on-secondary-container">
                            {initials(member.name)}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-secondary border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                          <p className="text-sm font-bold">{member.name}</p>
                          <p className="text-[10px] text-on-surface-variant">{member.email}</p>
                        </div>
                      </div>
                      <span className="text-[9px] bg-primary/5 text-primary-fixed-variant px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-widest">
                        {member.role}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={roleDraft}
                        onChange={(e) =>
                          setStaffRoleDrafts((prev) => ({
                            ...prev,
                            [member.id]: e.target.value,
                          }))
                        }
                        disabled={!canManage || updatingStaffId === member.id}
                        className="px-2 py-1 bg-surface-container-high border border-outline-variant/30 text-xs font-bold uppercase"
                      >
                        {roleDraft !== 'waiter' && roleDraft !== 'kitchen' ? (
                          <option value={roleDraft}>{roleDraft}</option>
                        ) : null}
                        <option value="waiter">Waiter</option>
                        <option value="kitchen">Kitchen</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => applyStaffRole(member)}
                        disabled={!canManage || roleDraft === member.role || updatingStaffId === member.id}
                        className="px-3 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white disabled:opacity-50"
                      >
                        {updatingStaffId === member.id ? 'Saving...' : 'Authorize'}
                      </button>

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => removeStaffUser(member)}
                          disabled={deletingStaffId === member.id}
                          className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-error text-error disabled:opacity-50"
                        >
                          {deletingStaffId === member.id ? 'Removing...' : 'Remove'}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {isSelf ? 'Current Session' : 'Protected'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-outline-variant/20 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Add Staff User</h3>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <input
                  type="password"
                  placeholder="Temporary password"
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <div className="flex gap-2">
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-outline-variant/30"
                  >
                    <option value="waiter">Waiter</option>
                    <option value="kitchen">Kitchen</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateStaffUser}
                    disabled={creatingStaff}
                    className="px-4 py-2 bg-primary text-on-primary text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {creatingStaff ? 'Creating...' : 'Add User'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 w-full py-2 text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant border border-outline-variant/20 bg-white flex justify-between px-4">
              <span>Open tickets</span>
              <span>{orders.length}</span>
            </div>
            <div className="mt-2 w-full py-2 text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant border border-outline-variant/20 bg-white flex justify-between px-4">
              <span>Monthly revenue</span>
              <span>${Number(salesSummary.total_revenue || 0).toFixed(2)}</span>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <section ref={inventorySectionRef} className="bg-surface-container-low p-6 md:p-8 rounded-lg">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
              <div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Supply Chain
                </span>
                <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">Kitchen Inventory</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadDashboard(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest hover:bg-outline-variant/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">filter_list</span>
                  <span className="text-xs font-bold uppercase">Refresh</span>
                </button>
                <button
                  onClick={() => setShowInventoryModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:opacity-90 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="text-xs font-bold uppercase">Manual Count</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventoryView.length ? (
                inventoryView.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-surface-container-lowest p-5 flex flex-col gap-4 border-l-4 shadow-sm ${
                      item.status === 'critical'
                        ? 'border-error'
                        : item.status === 'warning'
                          ? 'border-[#d76100]'
                          : 'border-secondary'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-headline text-lg font-bold">{item.ingredient}</h4>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {item.unit || 'units'}
                        </p>
                      </div>
                      <span
                        className={`font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded ${
                          item.status === 'critical'
                            ? 'text-error bg-error/10'
                            : item.status === 'warning'
                              ? 'text-[#773200] bg-[#ffdbca]'
                              : 'text-secondary'
                        }`}
                      >
                        {item.status === 'critical' ? 'Refill Needed' : item.status === 'warning' ? 'Low' : 'Stable'}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                        <span>{item.quantity} {item.unit || 'units'} Current</span>
                        <span>{item.target} Target</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            item.status === 'critical'
                              ? 'bg-error'
                              : item.status === 'warning'
                                ? 'bg-[#d76100]'
                                : 'bg-secondary'
                          }`}
                          style={{ width: `${item.percent}%` }}
                        ></div>
                      </div>
                    </div>

                    {item.status !== 'stable' ? (
                      <button
                        onClick={() => restockItem(item)}
                        className="w-full bg-error-container text-on-error-container py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-error hover:text-white transition-colors"
                      >
                        Refill To {item.target}
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 bg-surface-container-lowest p-8 border border-outline-variant/20 text-center">
                  <p className="font-headline text-2xl font-black uppercase">No Inventory Data</p>
                  <p className="text-sm text-on-surface-variant mt-2">Use Manual Count to add your first item.</p>
                </div>
              )}
            </div>
          </section>

          <section ref={menuSectionRef} className="bg-surface-container-low p-6 md:p-8 rounded-lg">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
              <div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Global Availability
                </span>
                <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">Menu Hub</h2>
              </div>
              <button
                onClick={publishAllMenuChanges}
                disabled={publishingAll}
                className="bg-primary text-on-primary px-8 py-3 font-headline font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-95 transition-all text-xs shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishingAll ? 'Publishing...' : 'Publish Changes'}
              </button>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 md:p-5 mb-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">Create New Menu Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-outline-variant/30"
                    placeholder="Example: Truffle Pasta"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-outline-variant/30"
                    placeholder="food"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-outline-variant/30"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    Availability
                  </label>
                  <div className="h-10 px-3 bg-white border border-outline-variant/30 flex items-center justify-between">
                    <AvailabilitySwitch
                      checked={newMenuActive}
                      onToggle={setNewMenuActive}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${newMenuActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {newMenuActive ? 'Active' : 'Sold Out'}
                    </span>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleCreateMenuItem}
                    disabled={creatingMenuItem}
                    className="w-full h-10 px-4 bg-black text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {creatingMenuItem ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {menuRows.map(({ item, draft, hasChanges }) => {
                return (
                  <div
                    key={item.id}
                    className="bg-surface-container-lowest p-6 border border-outline-variant/10 shadow-sm grid grid-cols-1 xl:grid-cols-2 gap-6"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-20 h-20 bg-surface-container-high rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-3xl">restaurant</span>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                          Name
                        </label>
                        <input
                          type="text"
                          value={draft.name}
                          onChange={(e) => setMenuDraft(item.id, { name: e.target.value })}
                          className="px-2 py-1 bg-surface-container-high border border-outline-variant/20 font-headline font-bold text-sm w-52"
                        />
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-2 mb-1 block">
                          Category
                        </label>
                        <input
                          type="text"
                          value={draft.category}
                          onChange={(e) => setMenuDraft(item.id, { category: e.target.value })}
                          className="px-2 py-1 bg-surface-container-high border border-outline-variant/20 text-sm w-40"
                        />
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold mt-2">#{item.id}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xl:content-start">
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                          Price ($)
                        </label>
                        <div className="flex items-center bg-surface-container-high border border-outline-variant/20 px-2">
                          <span className="text-lg font-bold mr-1">$</span>
                          <input
                            className="bg-transparent border-none font-headline font-black text-xl w-24 focus:ring-2 focus:ring-primary p-2 text-center"
                            type="number"
                            step="0.01"
                            value={draft.price}
                            onChange={(e) => setMenuDraft(item.id, { price: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                          Availability
                        </label>
                        <div className="bg-surface-container-high border border-outline-variant/20 px-3 py-2 flex items-center justify-between">
                          <AvailabilitySwitch
                            checked={Boolean(draft.active)}
                            onToggle={(nextValue) => setMenuDraft(item.id, { active: nextValue })}
                          />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${draft.active ? 'text-secondary' : 'text-on-surface-variant'}`}>
                            {draft.active ? 'Active' : 'Sold Out'}
                          </span>
                        </div>
                      </div>

                      <div className="sm:col-span-2 pt-2 border-t border-outline-variant/20 flex items-center justify-between gap-4">
                        <button
                          onClick={() => saveMenuItem(item)}
                          disabled={savingMenuId === item.id}
                          className="bg-primary text-on-primary px-5 py-3 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-50"
                        >
                          {savingMenuId === item.id ? 'Saving...' : 'Save'}
                        </button>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${hasChanges ? 'text-[#d76100]' : 'text-secondary'}`}>
                          {hasChanges ? 'Unsaved changes' : 'Synced'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {showInventoryModal ? (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-outline-variant/20 shadow-2xl">
            <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-headline text-2xl font-black uppercase">Manual Inventory Count</h3>
              <button
                type="button"
                onClick={() => setShowInventoryModal(false)}
                className="material-symbols-outlined p-2 hover:bg-surface-container-low"
              >
                close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                  Ingredient
                </label>
                <input
                  type="text"
                  value={ingredient}
                  onChange={(e) => setIngredient(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                  placeholder="Tomato Sauce"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder="kg / litre / pcs"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex gap-3">
              <button
                type="button"
                onClick={() => setShowInventoryModal(false)}
                className="flex-1 py-3 border border-outline-variant/30 font-black uppercase tracking-widest text-xs hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInventorySave}
                disabled={savingInventory}
                className="flex-1 py-3 bg-primary text-on-primary font-black uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {savingInventory ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-stretch overflow-hidden bg-[#000000] dark:bg-[#000000] h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
        <button
          type="button"
          onClick={() => scrollToSection(staffSectionRef, 'team')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${
            mobileTab === 'team' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">group</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">Team</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(inventorySectionRef, 'inventory')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${
            mobileTab === 'inventory' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">inventory_2</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">Inventory</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(menuSectionRef, 'menu')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${
            mobileTab === 'menu' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">restaurant_menu</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">Menu</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab('count');
            setShowInventoryModal(true);
          }}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${
            mobileTab === 'count' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
          }`}
        >
          <span className="material-symbols-outlined mb-1">add_box</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">Count</span>
        </button>
      </nav>
    </div>
  );
}
