import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createMenuItem,
  createIngredient,
  createUser,
  deleteInventoryItem,
  deleteMenuItem,
  deleteUser,
  getIngredients,
  getInventory,
  getMenu,
  getOrders,
  getUsers,
  patchInventoryItem,
  updateMenuItem,
  updateUser,
  upsertInventoryItem,
} from '../api/client';
import { ALLOWED_UNITS, isAllowedUnit } from '../constants/units';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ToastContainer from '../components/ToastContainer';
import useToast from '../hooks/useToast';

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
    const rawFull = item.full_stock_target;
    const fullTarget =
      rawFull != null && rawFull !== '' && Number.isFinite(Number(rawFull))
        ? Number(rawFull)
        : Math.max(50, Math.round(quantity * 2) || 50);
    const percent = Math.min(100, Math.round((quantity / fullTarget) * 100));

    const rawLow = item.low_stock_threshold;
    let status = 'stable';
    if (rawLow != null && rawLow !== '' && Number.isFinite(Number(rawLow))) {
      const lowThresh = Number(rawLow);
      if (quantity < lowThresh) {
        status = quantity < lowThresh * 0.5 ? 'critical' : 'warning';
      }
    } else {
      if (percent < 35) status = 'critical';
      else if (percent < 60) status = 'warning';
    }

    return {
      ...item,
      quantity,
      target: fullTarget,
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
    ingredients: (item.ingredients || []).map((entry) => ({
      ingredient_id: String(entry.ingredient_id),
      quantity_required: String(entry.quantity_required),
      unit: entry.unit || '',
    })),
  };
}

function normalizeIngredientDrafts(raw) {
  return (raw || [])
    .map((entry) => ({
      ingredient_id: String(entry.ingredient_id || '').trim(),
      quantity_required: String(entry.quantity_required || '').trim(),
      unit: String(entry.unit || '').trim(),
    }))
    .filter((entry) => entry.ingredient_id || entry.quantity_required || entry.unit);
}

function hasMenuDraftChanges(item, draft) {
  const baseIngredients = JSON.stringify(
    normalizeIngredientDrafts((item.ingredients || []).map((entry) => ({
      ingredient_id: entry.ingredient_id,
      quantity_required: entry.quantity_required,
      unit: entry.unit || '',
    })))
  );
  const draftIngredients = JSON.stringify(normalizeIngredientDrafts(draft.ingredients || []));

  return (
    String(draft.name || '').trim() !== String(item.name || '').trim() ||
    String(draft.category || '').trim() !== String(item.category || '').trim() ||
    Number(draft.price) !== Number(item.price) ||
    Boolean(draft.active) !== Boolean(item.active) ||
    baseIngredients !== draftIngredients
  );
}

function UnitSelect({ value, onChange, className }) {
  const safe = isAllowedUnit(value) ? String(value).trim() : '';
  return (
    <select
      value={safe}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ||
        'w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary'
      }
    >
      <option value="">Select unit</option>
      {ALLOWED_UNITS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
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
      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors ${checked ? 'bg-secondary' : 'bg-surface-container-highest'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'
          }`}
      />
    </button>
  );
}

export default function ManagerDashboard({ user, onLogout }) {
  const { t } = useTranslation(['manager', 'common']);
  const [inventory, setInventory] = useState([]);
  const [ingredientsCatalog, setIngredientsCatalog] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [staff, setStaff] = useState([]);
  const [orders, setOrders] = useState([]);

  const [menuDrafts, setMenuDrafts] = useState({});
  const [savingMenuId, setSavingMenuId] = useState(null);
  const [creatingMenuItem, setCreatingMenuItem] = useState(false);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('');
  const [newMenuPrice, setNewMenuPrice] = useState('');
  const [newMenuActive, setNewMenuActive] = useState(true);
  const [newMenuIngredients, setNewMenuIngredients] = useState([
    { ingredient_id: '', quantity_required: '', unit: '' },
  ]);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('waiter');
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [staffRoleDrafts, setStaffRoleDrafts] = useState({});
  const [updatingStaffId, setUpdatingStaffId] = useState(null);
  const [deletingStaffId, setDeletingStaffId] = useState(null);

  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [editingInventoryId, setEditingInventoryId] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [inventoryIngredientId, setInventoryIngredientId] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [fullStockTarget, setFullStockTarget] = useState('');
  const [editingIngredientLabel, setEditingIngredientLabel] = useState('');
  const [savingInventory, setSavingInventory] = useState(false);
  const [refillingAll, setRefillingAll] = useState(false);
  const [removingMenuId, setRemovingMenuId] = useState(null);
  const [qtyAdjustDraft, setQtyAdjustDraft] = useState({});
  const [patchingQtyId, setPatchingQtyId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const [publishingAll, setPublishingAll] = useState(false);
  const [mobileTab, setMobileTab] = useState('inventory');

  const staffSectionRef = useRef(null);
  const inventorySectionRef = useRef(null);
  const menuSectionRef = useRef(null);

  function scrollToSection(ref, tabName) {
    setMobileTab(tabName);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetInventoryModalForm() {
    setEditingInventoryId(null);
    setQuantity('');
    setUnit('');
    setInventoryIngredientId('');
    setNewIngredientName('');
    setNewIngredientUnit('');
    setLowStockThreshold('');
    setFullStockTarget('');
    setEditingIngredientLabel('');
  }

  function openInventoryModalNew() {
    resetInventoryModalForm();
    setShowInventoryModal(true);
  }

  function openInventoryModalEdit(item) {
    setEditingInventoryId(item.id);
    setEditingIngredientLabel(String(item.ingredient || ''));
    setQuantity(String(item.quantity ?? ''));
    setUnit(item.unit || '');
    setInventoryIngredientId(item.ingredient_id ? String(item.ingredient_id) : '');
    setNewIngredientName('');
    setNewIngredientUnit('');
    setLowStockThreshold(
      item.low_stock_threshold != null && item.low_stock_threshold !== ''
        ? String(item.low_stock_threshold)
        : ''
    );
    setFullStockTarget(
      item.full_stock_target != null && item.full_stock_target !== ''
        ? String(item.full_stock_target)
        : ''
    );
    setShowInventoryModal(true);
  }

  function closeInventoryModal() {
    setShowInventoryModal(false);
    resetInventoryModalForm();
  }

  const loadDashboard = useCallback(async (showSpinner = true) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [inventoryRes, menuRes, usersRes, ordersRes, ingredientsRes] = await Promise.all([
        getInventory(),
        getMenu({ include_inactive: true }),
        getUsers(),
        getOrders({ include_closed: false }),
        getIngredients(),
      ]);

      const nextInventory = inventoryRes.data.inventory || [];
      const nextMenu = menuRes.data.menu || [];

      setInventory(nextInventory);
      setMenuItems(nextMenu);
      setIngredientsCatalog(ingredientsRes.data.ingredients || []);
      const nextStaff = usersRes.data.users || [];
      setStaff(nextStaff);
      setOrders(ordersRes.data.orders || []);

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
      addToast(err.response?.data?.error || 'Could not load manager dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

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
    const parsedIngredients = normalizeIngredientDrafts(newMenuIngredients).map((entry) => ({
      ingredient_id: Number(entry.ingredient_id),
      quantity_required: Number(entry.quantity_required),
      unit: String(entry.unit || '').trim() || null,
    }));
    if (!newMenuName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      addToast('New menu item requires a name and valid price', 'error');
      return;
    }
    if (!parsedIngredients.length || parsedIngredients.some((entry) => !entry.ingredient_id || !Number.isFinite(entry.quantity_required) || entry.quantity_required <= 0)) {
      addToast('Each menu item must include at least one valid ingredient requirement', 'error');
      return;
    }
    if (parsedIngredients.some((entry) => !isAllowedUnit(entry.unit))) {
      addToast('Each ingredient must have a unit selected (Kg, g, pieces, L, ml)', 'error');
      return;
    }

    setCreatingMenuItem(true);

    try {
      await createMenuItem({
        name: newMenuName.trim(),
        category: newMenuCategory.trim() || null,
        price: parsedPrice,
        active: Boolean(newMenuActive),
        ingredients: parsedIngredients,
      });

      setNewMenuName('');
      setNewMenuCategory('');
      setNewMenuPrice('');
      setNewMenuActive(true);
      setNewMenuIngredients([{ ingredient_id: '', quantity_required: '', unit: '' }]);
      addToast('New menu item created successfully.', 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not create menu item', 'error');
    } finally {
      setCreatingMenuItem(false);
    }
  }

  async function handleCreateStaffUser() {
    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword.trim()) {
      addToast('Name, email, and password are required to create a user', 'error');
      return;
    }

    setCreatingStaff(true);

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
      addToast('New staff user created successfully.', 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not create user', 'error');
    } finally {
      setCreatingStaff(false);
    }
  }

  async function applyStaffRole(member, roleOverride) {
    const nextRole = roleOverride ?? staffRoleDrafts[member.id];
    if (!nextRole || nextRole === member.role) {
      return;
    }

    setUpdatingStaffId(member.id);

    try {
      await updateUser(member.id, { role: nextRole });
      addToast(`Updated role for ${member.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update user role', 'error');
    } finally {
      setUpdatingStaffId(null);
    }
  }

  async function removeStaffUser(member) {
    if (!window.confirm(`Delete user ${member.name}?`)) {
      return;
    }

    setDeletingStaffId(member.id);

    try {
      await deleteUser(member.id);
      addToast(`Deleted user ${member.name}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not delete user', 'error');
    } finally {
      setDeletingStaffId(null);
    }
  }

  async function handleInventorySave() {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
      addToast('A valid quantity is required', 'error');
      return;
    }

    const parseOptionalThresholdInput = (raw, label) => {
      const t = String(raw ?? '').trim();
      if (!t) return undefined;
      const n = Number(t);
      if (!Number.isFinite(n) || n < 0) {
        addToast(`${label} must be empty or a non-negative number`, 'error');
        return null;
      }
      return n;
    };

    const lowN = parseOptionalThresholdInput(lowStockThreshold, 'Low stock threshold');
    if (lowN === null) return;
    const fullN = parseOptionalThresholdInput(fullStockTarget, 'Full stock target');
    if (fullN === null) return;
    if (lowN != null && fullN != null && lowN > fullN) {
      addToast('Low stock threshold cannot exceed full stock target', 'error');
      return;
    }

    const inventoryUnit = String(unit || '').trim();
    if (!isAllowedUnit(inventoryUnit)) {
      addToast('Select a unit (Kg, g, pieces, L, or ml)', 'error');
      return;
    }

    setSavingInventory(true);

    try {
      if (editingInventoryId) {
        const payload = {
          quantity: parsedQuantity,
          unit: inventoryUnit,
        };
        if (lowN !== undefined) payload.low_stock_threshold = lowN;
        if (fullN !== undefined) payload.full_stock_target = fullN;
        await patchInventoryItem(editingInventoryId, payload);
        closeInventoryModal();
        addToast('Inventory updated successfully.', 'success');
      } else {
        if (!inventoryIngredientId && !newIngredientName.trim()) {
          addToast('Select an ingredient or create a new one', 'error');
          setSavingInventory(false);
          return;
        }

        let selectedIngredientId = inventoryIngredientId ? Number(inventoryIngredientId) : null;
        const catalogDefaultUnit = String(newIngredientUnit || '').trim();
        if (!selectedIngredientId && newIngredientName.trim()) {
          if (!isAllowedUnit(catalogDefaultUnit)) {
            addToast('Select a default unit for the new ingredient', 'error');
            setSavingInventory(false);
            return;
          }
          const created = await createIngredient({
            name: newIngredientName.trim(),
            default_unit: catalogDefaultUnit,
          });
          selectedIngredientId = Number(created.data.ingredient.id);
        }

        const payload = {
          ingredient_id: selectedIngredientId || undefined,
          ingredient: selectedIngredientId ? undefined : newIngredientName.trim(),
          quantity: parsedQuantity,
          unit: inventoryUnit,
        };
        if (lowN !== undefined) payload.low_stock_threshold = lowN;
        if (fullN !== undefined) payload.full_stock_target = fullN;

        await upsertInventoryItem(payload);
        closeInventoryModal();
        addToast('Inventory count saved successfully.', 'success');
      }
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not save inventory item', 'error');
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

    const parsedIngredients = normalizeIngredientDrafts(draft.ingredients).map((entry) => ({
      ingredient_id: Number(entry.ingredient_id),
      quantity_required: Number(entry.quantity_required),
      unit: String(entry.unit || '').trim() || null,
    }));

    if (!nextName || !Number.isFinite(nextPrice) || nextPrice <= 0) {
      addToast('Menu item requires a name and positive price', 'error');
      return;
    }
    if (!parsedIngredients.length || parsedIngredients.some((entry) => !entry.ingredient_id || !Number.isFinite(entry.quantity_required) || entry.quantity_required <= 0)) {
      addToast('Menu item must include at least one valid ingredient requirement', 'error');
      return;
    }
    if (parsedIngredients.some((entry) => !isAllowedUnit(entry.unit))) {
      addToast('Each ingredient must have a unit selected (Kg, g, pieces, L, ml)', 'error');
      return;
    }

    setSavingMenuId(item.id);

    try {
      await updateMenuItem(item.id, {
        name: nextName,
        category: nextCategory || null,
        price: nextPrice,
        active: Boolean(draft.active),
        ingredients: parsedIngredients,
      });
      addToast(`Saved changes for ${nextName}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update menu item', 'error');
    } finally {
      setSavingMenuId(null);
    }
  }

  async function restockItem(item) {
    try {
      await upsertInventoryItem({
        ingredient_id: item.ingredient_id || undefined,
        ingredient: item.ingredient_id ? undefined : item.ingredient,
        quantity: item.target,
        unit: item.unit,
      });
      addToast(`${item.ingredient} restocked to ${item.target} ${item.unit || 'units'}.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not restock item', 'error');
    }
  }

  async function refillAllLow() {
    if (!lowStock.length) return;
    setRefillingAll(true);
    const targets = [...lowStock];
    try {
      const results = await Promise.allSettled(
        targets.map((item) =>
          upsertInventoryItem({
            ingredient_id: item.ingredient_id || undefined,
            ingredient: item.ingredient_id ? undefined : item.ingredient,
            quantity: item.target,
            unit: item.unit,
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === targets.length) {
        addToast('Could not refill low stock items', 'error');
      } else if (failed.length > 0) {
        addToast(`Refilled ${targets.length - failed.length} of ${targets.length} ingredient(s); some failed.`, 'success');
      } else {
        addToast(`Refilled ${targets.length} low-stock ingredient(s) to target levels.`, 'success');
      }
      await loadDashboard(false);
    } finally {
      setRefillingAll(false);
    }
  }

  async function removeMenuItemPermanently(item) {
    if (
      !window.confirm(
        `Permanently remove "${item.name}" from the menu? You can still mark items inactive instead if they were sold before.`
      )
    ) {
      return;
    }
    setRemovingMenuId(item.id);
    try {
      await deleteMenuItem(item.id);
      const removedId = item.id;
      const removedName = item.name;
      setMenuItems((prev) => prev.filter((row) => Number(row.id) !== Number(removedId)));
      setMenuDrafts((prev) => {
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      addToast(`Removed "${removedName}" from the menu.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not remove menu item';
      const status = err.response?.status;
      addToast(msg, 'error');

      if (status === 409) {
        if (
          window.confirm(
            'This item cannot be deleted because it appears on past orders or sales. Deactivate it instead (hide from ordering)?'
          )
        ) {
          try {
            await updateMenuItem(item.id, { active: false });
            addToast(`"${item.name}" is now inactive (sold out).`, 'success');
            await loadDashboard(false);
          } catch (e2) {
            const msg2 = e2.response?.data?.error || 'Could not deactivate menu item';
            addToast(msg2, 'error');
          }
        }
      }
    } finally {
      setRemovingMenuId(null);
    }
  }

  async function publishAllMenuChanges() {
    const changedItems = topMenu.filter((item) => isMenuChanged(item));

    if (!changedItems.length) {
      addToast('No pending menu changes to publish.', 'success');
      return;
    }

    for (const item of changedItems) {
      const draft = menuDrafts[item.id];
      const parsedIngredients = normalizeIngredientDrafts(draft.ingredients).map((entry) => ({
        ingredient_id: Number(entry.ingredient_id),
        quantity_required: Number(entry.quantity_required),
        unit: String(entry.unit || '').trim() || null,
      }));
      if (
        !parsedIngredients.length ||
        parsedIngredients.some(
          (entry) =>
            !entry.ingredient_id ||
            !Number.isFinite(entry.quantity_required) ||
            entry.quantity_required <= 0
        )
      ) {
        addToast(`"${item.name}": fix ingredient rows before publishing`, 'error');
        return;
      }
      if (parsedIngredients.some((entry) => !isAllowedUnit(entry.unit))) {
        addToast(`"${item.name}": each ingredient needs a unit (Kg, g, pieces, L, ml)`, 'error');
        return;
      }
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
            ingredients: normalizeIngredientDrafts(draft.ingredients).map((entry) => ({
              ingredient_id: Number(entry.ingredient_id),
              quantity_required: Number(entry.quantity_required),
              unit: String(entry.unit || '').trim() || null,
            })),
          });
        })
      );

      addToast(`Published ${changedItems.length} menu change(s).`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not publish all menu changes', 'error');
    } finally {
      setPublishingAll(false);
    }
  }

  function addMenuIngredientRow(itemId = null) {
    if (!itemId) {
      setNewMenuIngredients((prev) => [...prev, { ingredient_id: '', quantity_required: '', unit: '' }]);
      return;
    }
    setMenuDraft(itemId, {
      ingredients: [...(menuDrafts[itemId]?.ingredients || []), { ingredient_id: '', quantity_required: '', unit: '' }],
    });
  }

  function updateMenuIngredientRow(itemId, index, patch) {
    if (!itemId) {
      setNewMenuIngredients((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
      return;
    }

    const current = menuDrafts[itemId]?.ingredients || [];
    setMenuDraft(itemId, {
      ingredients: current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  }

  function removeMenuIngredientRow(itemId, index) {
    if (!itemId) {
      setNewMenuIngredients((prev) => {
        const next = prev.filter((_, i) => i !== index);
        return next.length ? next : [{ ingredient_id: '', quantity_required: '', unit: '' }];
      });
      return;
    }

    const current = menuDrafts[itemId]?.ingredients || [];
    const next = current.filter((_, i) => i !== index);
    setMenuDraft(itemId, {
      ingredients: next.length ? next : [{ ingredient_id: '', quantity_required: '', unit: '' }],
    });
  }

  async function removeInventoryItem(item) {
    if (!window.confirm(`Delete inventory item ${item.ingredient}?`)) {
      return;
    }

    try {
      await deleteInventoryItem(item.id);
      addToast(`Removed ${item.ingredient} from inventory.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not delete inventory item', 'error');
    }
  }

  async function saveQtyAdjust(item) {
    const raw = qtyAdjustDraft[item.id];
    const parsed = raw !== undefined && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0) {
      addToast('Enter a valid quantity to save', 'error');
      return;
    }
    setPatchingQtyId(item.id);
    try {
      await patchInventoryItem(item.id, { quantity: parsed });
      setQtyAdjustDraft((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      addToast(`Updated ${item.ingredient} quantity.`, 'success');
      await loadDashboard(false);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not update quantity', 'error');
    } finally {
      setPatchingQtyId(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-on-surface font-headline uppercase text-sm tracking-widest">
            {t('loadingHub')}
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
            {t('common:brandName')}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <button
            onClick={() => loadDashboard(false)}
            className="text-xs font-black uppercase tracking-widest hover:text-primary transition-colors"
            disabled={refreshing}
          >
            {refreshing ? t('common:refreshing') : t('common:refresh')}
          </button>
          <button
            onClick={onLogout}
            className="text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors"
          >
            {t('common:logout')}
          </button>
        </div>
      </header>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        <div className="lg:col-span-4 flex flex-col gap-6">
          <section
            className={
              lowStock.length
                ? 'bg-[#ffdad6] p-6 rounded-lg relative overflow-hidden border-2 border-error ring-4 ring-error/10'
                : 'bg-surface-container-low p-6 rounded-lg relative overflow-hidden border border-outline-variant/20'
            }
          >
            <div className="flex justify-between items-center mb-4">
              <div
                className={
                  lowStock.length
                    ? 'flex items-center gap-2 bg-error text-white px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest'
                    : 'flex items-center gap-2 bg-secondary/10 text-secondary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest'
                }
              >
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {lowStock.length ? 'priority_high' : 'check_circle'}
                </span>
                {lowStock.length ? t('critical') : t('stable')}
              </div>
              <span
                className={
                  lowStock.length
                    ? 'text-[10px] font-bold uppercase tracking-widest text-on-error-container'
                    : 'text-[10px] font-bold uppercase tracking-widest text-on-surface-variant'
                }
              >
                {lowStock.length ? t('immediateAttention') : t('stockLevelsOk')}
              </span>
            </div>
            <h3
              className={
                lowStock.length
                  ? 'font-headline text-2xl font-black text-on-error-container leading-none mb-3 uppercase tracking-tighter'
                  : 'font-headline text-2xl font-black text-on-surface leading-none mb-3 uppercase tracking-tighter'
              }
            >
              {lowStock.length ? t('refillLowInventory') : t('serviceMomentumStable')}
            </h3>
            <p
              className={
                lowStock.length
                  ? 'text-sm text-on-error-container/80 mb-6 leading-relaxed'
                  : 'text-sm text-on-surface-variant mb-6 leading-relaxed'
              }
            >
              {lowStock.length
                ? t('lowStockWarning', { count: lowStock.length })
                : t('noStockIssues')}
            </p>
            <button
              type="button"
              onClick={refillAllLow}
              disabled={!lowStock.length || refillingAll}
              className={
                lowStock.length
                  ? 'w-full bg-error text-white py-4 font-headline font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-error/20 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'w-full bg-surface-container-highest text-on-surface py-4 font-headline font-black uppercase tracking-[0.2em] border border-outline-variant/30 disabled:opacity-60 disabled:cursor-not-allowed'
              }
            >
              {refillingAll
                ? t('refillingAll')
                : lowStock.length
                  ? t('refillAllLow', { count: lowStock.length })
                  : t('allGood')}
            </button>
          </section>

          <section ref={staffSectionRef} className="bg-surface-container-low p-6 rounded-lg">
            <div className="flex justify-between items-center mb-6 border-b border-outline-variant/20 pb-2">
              <h2 className="font-headline text-xs font-bold uppercase tracking-[0.2em]">{t('liveOnShift')}</h2>
              <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">
                {t('activeCount', { count: staff.length })}
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
                        onChange={(e) => {
                          const nextRole = e.target.value;
                          setStaffRoleDrafts((prev) => ({
                            ...prev,
                            [member.id]: nextRole,
                          }));
                          if (canManage && nextRole !== member.role) {
                            applyStaffRole(member, nextRole);
                          }
                        }}
                        disabled={!canManage || updatingStaffId === member.id}
                        className="px-2 py-1 pr-6 bg-surface-container-high border border-outline-variant/30 text-xs font-bold uppercase"
                      >
                        {roleDraft !== 'waiter' && roleDraft !== 'kitchen' ? (
                          <option value={roleDraft}>{roleDraft}</option>
                        ) : null}
                        <option value="waiter">{t('common:waiter')}</option>
                        <option value="kitchen">{t('common:kitchen')}</option>
                      </select>

                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => removeStaffUser(member)}
                          disabled={deletingStaffId === member.id}
                          className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-error text-error disabled:opacity-50"
                        >
                          {deletingStaffId === member.id ? t('common:removing') : t('common:remove')}
                        </button>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {isSelf ? t('currentSession') : t('protected')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-outline-variant/20 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">{t('addStaffUser')}</h3>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  placeholder={t('fullNamePlaceholder')}
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <input
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <input
                  type="password"
                  placeholder={t('temporaryPasswordPlaceholder')}
                  value={newStaffPassword}
                  onChange={(e) => setNewStaffPassword(e.target.value)}
                  className="px-3 py-2 text-sm bg-white border border-outline-variant/30"
                />
                <div className="flex gap-2">
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="flex-1 px-3 py-2 pr-8 text-sm bg-white border border-outline-variant/30"
                  >
                    <option value="waiter">{t('common:waiter')}</option>
                    <option value="kitchen">{t('common:kitchen')}</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleCreateStaffUser}
                    disabled={creatingStaff}
                    className="px-4 py-2 bg-primary text-on-primary text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {creatingStaff ? t('common:creating') : t('addUser')}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 w-full py-2 text-xs font-headline font-bold uppercase tracking-widest text-on-surface-variant border border-outline-variant/20 bg-white flex justify-between px-4">
              <span>{t('openTickets')}</span>
              <span>{orders.length}</span>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6">
          <section ref={inventorySectionRef} className="bg-surface-container-low p-6 md:p-8 rounded-lg">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
              <div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('supplyChain')}
                </span>
                <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">{t('kitchenInventory')}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => loadDashboard(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-container-highest hover:bg-outline-variant/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">filter_list</span>
                  <span className="text-xs font-bold uppercase">{t('common:refresh')}</span>
                </button>
                <button
                  type="button"
                  onClick={openInventoryModalNew}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary hover:opacity-90 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span className="text-xs font-bold uppercase">{t('manualCount')}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventoryView.length ? (
                inventoryView.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-surface-container-lowest p-5 flex flex-col gap-4 border-l-4 shadow-sm ${item.status === 'critical'
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
                        className={`font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded ${item.status === 'critical'
                          ? 'text-error bg-error/10'
                          : item.status === 'warning'
                            ? 'text-[#773200] bg-[#ffdbca]'
                            : 'text-secondary'
                          }`}
                      >
                        {item.status === 'critical' ? t('refillNeeded') : item.status === 'warning' ? t('low') : t('stable')}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                        <span>{t('currentStock', { qty: item.quantity, unit: item.unit || 'units' })}</span>
                        <span>{t('fullTarget', { qty: item.target })}</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.status === 'critical'
                            ? 'bg-error'
                            : item.status === 'warning'
                              ? 'bg-[#d76100]'
                              : 'bg-secondary'
                            }`}
                          style={{ width: `${item.percent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 flex-wrap">
                        {item.status !== 'stable' ? (
                          <button
                            type="button"
                            onClick={() => restockItem(item)}
                            className="flex-1 min-w-[120px] bg-error-container text-on-error-container py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-error hover:text-white transition-colors"
                          >
                            {t('refillTo', { target: item.target })}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openInventoryModalEdit(item)}
                          className="flex-1 min-w-[120px] px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-outline-variant/40 bg-surface-container-high"
                        >
                          {t('editThresholds')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeInventoryItem(item)}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-error text-error"
                        >
                          {t('common:delete')}
                        </button>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={t('onHandPlaceholder', { qty: item.quantity })}
                          value={qtyAdjustDraft[item.id] ?? ''}
                          onChange={(e) =>
                            setQtyAdjustDraft((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="flex-1 min-w-0 px-2 py-2 text-xs bg-surface-container-high border border-outline-variant/30"
                        />
                        <button
                          type="button"
                          onClick={() => saveQtyAdjust(item)}
                          disabled={patchingQtyId === item.id}
                          className="px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-black text-white disabled:opacity-50 whitespace-nowrap"
                        >
                          {patchingQtyId === item.id ? t('common:saving') : t('saveQty')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="md:col-span-2 bg-surface-container-lowest p-8 border border-outline-variant/20 text-center">
                  <p className="font-headline text-2xl font-black uppercase">{t('noInventoryData')}</p>
                  <p className="text-sm text-on-surface-variant mt-2">{t('noInventoryDataHint')}</p>
                </div>
              )}
            </div>
          </section>

          <section ref={menuSectionRef} className="bg-surface-container-low p-6 md:p-8 rounded-lg">
            <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-8 gap-4">
              <div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  {t('globalAvailability')}
                </span>
                <h2 className="font-headline text-3xl font-black uppercase tracking-tighter">{t('menuHub')}</h2>
              </div>
              <button
                onClick={publishAllMenuChanges}
                disabled={publishingAll}
                className="bg-primary text-on-primary px-8 py-3 font-headline font-black uppercase tracking-[0.2em] hover:opacity-90 active:scale-95 transition-all text-xs shadow-lg shadow-black/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publishingAll ? t('publishing') : t('publishChanges')}
              </button>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant/20 p-4 md:p-5 mb-6 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-[0.2em]">{t('createNewMenuItem')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    {t('common:name')}
                  </label>
                  <input
                    type="text"
                    value={newMenuName}
                    onChange={(e) => setNewMenuName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-outline-variant/30"
                    placeholder={t('exampleNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    {t('common:category')}
                  </label>
                  <input
                    type="text"
                    value={newMenuCategory}
                    onChange={(e) => setNewMenuCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-outline-variant/30"
                    placeholder={t('foodPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    {t('common:price')}
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
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                    {t('availability')}
                  </label>
                  <div className="h-10 px-3 bg-white border border-outline-variant/30 flex items-center gap-3">
                    <AvailabilitySwitch
                      checked={newMenuActive}
                      onToggle={setNewMenuActive}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${newMenuActive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {newMenuActive ? t('common:available') : t('common:soldOut')}
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
                    {creatingMenuItem ? t('common:creating') : t('common:create')}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant block">
                    {t('requiredIngredients')}
                  </label>
                  <button
                    type="button"
                    onClick={() => addMenuIngredientRow(null)}
                    className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-outline-variant/30"
                  >
                    {t('addIngredient')}
                  </button>
                </div>
                {newMenuIngredients.map((entry, index) => (
                  <div key={`new-ing-${index}`} className="grid grid-cols-1 md:grid-cols-12 gap-2">
                    <select
                      value={entry.ingredient_id}
                      onChange={(e) => updateMenuIngredientRow(null, index, { ingredient_id: e.target.value })}
                      className="px-3 py-2 bg-white border border-outline-variant/30 md:col-span-5"
                    >
                      <option value="">{t('common:selectIngredient')}</option>
                      {ingredientsCatalog.map((ingredientOption) => (
                        <option key={ingredientOption.id} value={ingredientOption.id}>
                          {ingredientOption.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={entry.quantity_required}
                      onChange={(e) => updateMenuIngredientRow(null, index, { quantity_required: e.target.value })}
                      className="px-3 py-2 bg-white border border-outline-variant/30 md:col-span-3"
                      placeholder="Qty"
                    />
                    <div className="flex gap-2 md:col-span-4">
                      <UnitSelect
                        value={entry.unit}
                        onChange={(v) => updateMenuIngredientRow(null, index, { unit: v })}
                        className="flex-1 px-3 py-2 pr-8 bg-white border border-outline-variant/30 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMenuIngredientRow(null, index)}
                        className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border border-error text-error"
                      >
                        {t('common:remove')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="lg:col-span-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {menuRows.map(({ item, draft, hasChanges }) => {
              return (
                <div
                  key={item.id}
                  className="bg-surface-container-lowest p-6 border border-outline-variant/10 shadow-sm grid grid-cols-1 gap-6"
                >
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 bg-surface-container-high rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-3xl">restaurant</span>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1 block">
                        {t('common:name')}
                      </label>
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setMenuDraft(item.id, { name: e.target.value })}
                        className="px-2 py-1 bg-surface-container-high border border-outline-variant/20 font-headline font-bold text-sm w-52"
                      />
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mt-2 mb-1 block">
                        {t('common:category')}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                        {t('priceDollar')}
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
                        {t('availability')}
                      </label>
                      <div className="bg-surface-container-high border border-outline-variant/20 px-3 py-2 flex items-center justify-between gap-2 overflow-hidden h-10">
                        <AvailabilitySwitch
                          checked={Boolean(draft.active)}
                          onToggle={(nextValue) => setMenuDraft(item.id, { active: nextValue })}
                        />
                        <span className={`text-[10px] font-black uppercase tracking-widest truncate ${draft.active ? 'text-secondary' : 'text-on-surface-variant'}`}>
                          {draft.active ? t('common:available') : t('common:soldOut')}
                        </span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-outline-variant/20 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => saveMenuItem(item)}
                          disabled={savingMenuId === item.id}
                          className="bg-primary text-on-primary px-5 py-3 font-headline font-black uppercase text-xs tracking-widest disabled:opacity-50"
                        >
                          {savingMenuId === item.id ? t('common:saving') : t('common:save')}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMenuItemPermanently(item)}
                          disabled={removingMenuId === item.id}
                          className="px-5 py-3 font-headline font-black uppercase text-xs tracking-widest border-2 border-error text-error hover:bg-error-container disabled:opacity-50 whitespace-nowrap"
                        >
                          {removingMenuId === item.id ? t('common:removing') : t('removeFromMenu')}
                        </button>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest text-right ml-auto leading-tight ${hasChanges ? 'text-[#d76100]' : 'text-secondary'}`}>
                        {hasChanges ? <span className="whitespace-pre-line">{t('unsavedChanges')}</span> : t('synced')}
                      </span>
                    </div>
                    <div className="sm:col-span-2 border-t border-outline-variant/20 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                          {t('ingredientsRequired')}
                        </p>
                        <button
                          type="button"
                          onClick={() => addMenuIngredientRow(item.id)}
                          className="text-[10px] font-black uppercase tracking-widest px-2 py-1 border border-outline-variant/30"
                        >
                          {t('common:add')}
                        </button>
                      </div>
                      {(draft.ingredients || []).map((entry, idx) => (
                        <div key={`${item.id}-ingredient-${idx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <select
                            value={entry.ingredient_id}
                            onChange={(e) => updateMenuIngredientRow(item.id, idx, { ingredient_id: e.target.value })}
                            className="sm:col-span-5 px-2 py-2 bg-surface-container-high border border-outline-variant/20 text-xs"
                          >
                            <option value="">{t('common:selectIngredient')}</option>
                            {ingredientsCatalog.map((ingredientOption) => (
                              <option key={ingredientOption.id} value={ingredientOption.id}>
                                {ingredientOption.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            value={entry.quantity_required}
                            onChange={(e) => updateMenuIngredientRow(item.id, idx, { quantity_required: e.target.value })}
                            className="sm:col-span-3 px-2 py-2 bg-surface-container-high border border-outline-variant/20 text-xs"
                            placeholder="Qty"
                          />
                          <div className="flex gap-2 sm:col-span-4">
                            <UnitSelect
                              value={entry.unit}
                              onChange={(v) => updateMenuIngredientRow(item.id, idx, { unit: v })}
                              className="flex-1 px-2 py-2 pr-8 bg-surface-container-high border border-outline-variant/20 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => removeMenuIngredientRow(item.id, idx)}
                              className="px-2 py-2 text-[10px] font-black uppercase tracking-widest border border-error text-error"
                            >
                              X
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {showInventoryModal ? (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-outline-variant/20 shadow-2xl">
            <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-headline text-2xl font-black uppercase">
                {editingInventoryId ? t('editInventory') : t('manualInventoryCount')}
              </h3>
              <button
                type="button"
                onClick={closeInventoryModal}
                className="material-symbols-outlined p-2 hover:bg-surface-container-low"
              >
                close
              </button>
            </div>

            <div className="p-6 space-y-4">
              {editingInventoryId ? (
                <div className="p-4 bg-surface-container-low border border-outline-variant/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                    Ingredient
                  </p>
                  <p className="font-headline font-bold text-lg">{editingIngredientLabel || '—'}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                      {t('existingIngredient')}
                    </label>
                    <select
                      value={inventoryIngredientId}
                      onChange={(e) => setInventoryIngredientId(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    >
                      <option value="">{t('common:selectIngredient')}</option>
                      {ingredientsCatalog.map((ingredientOption) => (
                        <option key={ingredientOption.id} value={ingredientOption.id}>
                          {ingredientOption.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                        {t('orNewIngredient')}
                      </label>
                      <input
                        type="text"
                        value={newIngredientName}
                        onChange={(e) => setNewIngredientName(e.target.value)}
                        className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                        placeholder={t('newIngredientPlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                        {t('newIngredientUnit')}
                      </label>
                      <UnitSelect value={newIngredientUnit} onChange={setNewIngredientUnit} />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    {t('quantity')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder="50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    {t('unit')}
                  </label>
                  <UnitSelect value={unit} onChange={setUnit} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    {t('lowStockThreshold')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder={t('common:optional')}
                  />
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {t('lowStockHint')}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest mb-2 text-on-surface-variant">
                    {t('fullStockTarget')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fullStockTarget}
                    onChange={(e) => setFullStockTarget(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:border-primary"
                    placeholder={t('common:optional')}
                  />
                  <p className="text-[10px] text-on-surface-variant mt-1">
                    {t('fullStockHint')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-outline-variant/20 flex gap-3">
              <button
                type="button"
                onClick={closeInventoryModal}
                className="flex-1 py-3 border border-outline-variant/30 font-black uppercase tracking-widest text-xs hover:bg-surface-container-low"
              >
                {t('common:cancel')}
              </button>
              <button
                type="button"
                onClick={handleInventorySave}
                disabled={savingInventory}
                className="flex-1 py-3 bg-primary text-on-primary font-black uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {savingInventory ? t('common:saving') : editingInventoryId ? t('common:update') : t('common:save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-stretch overflow-hidden bg-[#000000] dark:bg-[#000000] h-20 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:hidden">
        <button
          type="button"
          onClick={() => scrollToSection(staffSectionRef, 'team')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${mobileTab === 'team' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
            }`}
        >
          <span className="material-symbols-outlined mb-1">group</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">{t('team')}</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(inventorySectionRef, 'inventory')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${mobileTab === 'inventory' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
            }`}
        >
          <span className="material-symbols-outlined mb-1">inventory_2</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">{t('inventory')}</span>
        </button>
        <button
          type="button"
          onClick={() => scrollToSection(menuSectionRef, 'menu')}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${mobileTab === 'menu' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
            }`}
        >
          <span className="material-symbols-outlined mb-1">restaurant_menu</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">{t('menu')}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMobileTab('count');
            openInventoryModalNew();
          }}
          className={`flex flex-col items-center justify-center h-full w-full transition-all active:bg-[#1b6d24] ${mobileTab === 'count' ? 'bg-[#1c1b1b] text-white border-t-4 border-[#1b6d24]' : 'text-[#e5e2e1]/70 hover:bg-[#1c1b1b]'
            }`}
        >
          <span className="material-symbols-outlined mb-1">add_box</span>
          <span className="font-['Work_Sans'] font-bold text-[11px] uppercase tracking-widest">{t('count')}</span>
        </button>
        <LanguageSwitcher compact />
      </nav>
    </div>
  );
}
