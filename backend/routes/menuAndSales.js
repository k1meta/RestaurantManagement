const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { parseAllowedUnit } = require('../constants/units');
const { db, nextSequence } = require('../config/db');
const { listCollection, getById } = require('../utils/firestoreStore');

const router = express.Router();
router.use(authenticate);

const PERIOD_DAYS = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeIngredientRequirements(rawIngredients) {
  if (!Array.isArray(rawIngredients) || rawIngredients.length === 0) {
    return { error: 'ingredients must include at least one item' };
  }

  const byIngredientId = new Map();

  for (const entry of rawIngredients) {
    const ingredient_id = parsePositiveInteger(entry?.ingredient_id);
    const quantity_required = Number(entry?.quantity_required);
    const unitRes = parseAllowedUnit(entry?.unit);
    if (!unitRes.ok) return { error: unitRes.error };
    const unitVal = unitRes.value;

    if (!ingredient_id) return { error: 'Each ingredient requires a valid ingredient_id' };
    if (!Number.isFinite(quantity_required) || quantity_required <= 0) {
      return { error: 'Each ingredient requires quantity_required > 0' };
    }
    if (!unitVal) return { error: 'Each ingredient requires a unit (Kg, g, pieces, L, or ml)' };

    let current = byIngredientId.get(ingredient_id);
    if (!current) {
      current = { ingredient_id, quantity_required: 0, unit: unitVal };
      byIngredientId.set(ingredient_id, current);
    }

    if (current.unit !== unitVal) {
      return { error: 'Conflicting units for the same ingredient in requirements' };
    }

    current.quantity_required += quantity_required;
  }

  return { requirements: Array.from(byIngredientId.values()) };
}

async function fetchMenuWithIngredients(includeInactive) {
  const [menuItems, ingredientLinks, ingredients] = await Promise.all([
    listCollection('menu_items'),
    listCollection('menu_item_ingredients'),
    listCollection('ingredients'),
  ]);

  const ingredientNameById = new Map(ingredients.map((ing) => [Number(ing.id), ing]));
  const byMenuId = new Map();
  for (const row of ingredientLinks) {
    if (!byMenuId.has(Number(row.menu_item_id))) byMenuId.set(Number(row.menu_item_id), []);
    const ing = ingredientNameById.get(Number(row.ingredient_id));
    byMenuId.get(Number(row.menu_item_id)).push({
      ingredient_id: row.ingredient_id,
      ingredient_name: ing?.name || null,
      quantity_required: Number(row.quantity_required),
      unit: row.unit || ing?.default_unit || null,
    });
  }

  return menuItems
    .filter((item) => (includeInactive ? true : item.active !== false))
    .sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name || '').localeCompare(String(b.name || '')))
    .map((item) => ({
      ...item,
      ingredients: byMenuId.get(Number(item.id)) || [],
    }));
}

// GET /api/menu
router.get('/menu', async (req, res) => {
  try {
    const includeInactive =
      parseBoolean(req.query.include_inactive, false) &&
      ['manager', 'owner'].includes(req.user.role);
    const menu = await fetchMenuWithIngredients(includeInactive);
    return res.json({ menu });
  } catch (err) {
    console.error('Get menu error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/menu
router.post('/menu', authorize('manager', 'owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const category = req.body.category ? String(req.body.category).trim() : null;
  const price = Number(req.body.price);
  const active = req.body.active === undefined ? true : req.body.active;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: 'price must be a positive number' });
  }
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean when provided' });
  }

  const normalizedRequirements = normalizeIngredientRequirements(req.body.ingredients);
  if (normalizedRequirements.error) {
    return res.status(400).json({ error: normalizedRequirements.error });
  }
  const requirements = normalizedRequirements.requirements;

  try {
    const ingredients = await listCollection('ingredients');
    const ingredientSet = new Set(ingredients.map((ing) => Number(ing.id)));
    const invalid = requirements.some((entry) => !ingredientSet.has(Number(entry.ingredient_id)));
    if (invalid) {
      return res.status(400).json({ error: 'One or more ingredient_id values are invalid' });
    }

    const itemId = await nextSequence('menu_items');
    const createdItem = {
      id: itemId,
      name,
      category: category || null,
      price,
      active,
      created_at: new Date().toISOString(),
    };

    await db.collection('menu_items').doc(String(itemId)).set(createdItem);

    for (const ingredient of requirements) {
      const linkId = await nextSequence('menu_item_ingredients');
      await db.collection('menu_item_ingredients').doc(String(linkId)).set({
        id: linkId,
        menu_item_id: itemId,
        ingredient_id: ingredient.ingredient_id,
        quantity_required: ingredient.quantity_required,
        unit: ingredient.unit || null,
        created_at: new Date().toISOString(),
      });
    }

    const fullItem = (await fetchMenuWithIngredients(true)).find((item) => Number(item.id) === itemId);
    return res.status(201).json({ item: fullItem || createdItem });
  } catch (err) {
    console.error('Create menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id
router.patch('/menu/:id', authorize('manager', 'owner'), async (req, res) => {
  const itemId = parsePositiveInteger(req.params.id);
  if (!itemId) return res.status(400).json({ error: 'Invalid menu item id' });

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name cannot be empty' });
    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
    const category = req.body.category ? String(req.body.category).trim() : null;
    updates.category = category || null;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'price')) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
    updates.price = price;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'active')) {
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }
    updates.active = req.body.active;
  }

  const wantsIngredientUpdate = Object.prototype.hasOwnProperty.call(req.body, 'ingredients');
  if (!Object.keys(updates).length && !wantsIngredientUpdate) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  let requirements = null;
  if (wantsIngredientUpdate) {
    const normalizedRequirements = normalizeIngredientRequirements(req.body.ingredients);
    if (normalizedRequirements.error) {
      return res.status(400).json({ error: normalizedRequirements.error });
    }
    requirements = normalizedRequirements.requirements;
  }

  try {
    const existing = await getById('menu_items', itemId);
    if (!existing) return res.status(404).json({ error: 'Item not found' });

    if (Object.keys(updates).length) {
      await db.collection('menu_items').doc(String(itemId)).set(updates, { merge: true });
    }

    if (requirements) {
      const ingredients = await listCollection('ingredients');
      const ingredientSet = new Set(ingredients.map((ing) => Number(ing.id)));
      const invalid = requirements.some((entry) => !ingredientSet.has(Number(entry.ingredient_id)));
      if (invalid) return res.status(400).json({ error: 'One or more ingredient_id values are invalid' });

      const allLinks = await listCollection('menu_item_ingredients');
      const targetLinks = allLinks.filter((link) => Number(link.menu_item_id) === itemId);
      await Promise.all(targetLinks.map((link) => db.collection('menu_item_ingredients').doc(String(link.id)).delete()));

      for (const ingredient of requirements) {
        const linkId = await nextSequence('menu_item_ingredients');
        await db.collection('menu_item_ingredients').doc(String(linkId)).set({
          id: linkId,
          menu_item_id: itemId,
          ingredient_id: ingredient.ingredient_id,
          quantity_required: ingredient.quantity_required,
          unit: ingredient.unit || null,
          created_at: new Date().toISOString(),
        });
      }
    }

    const fullItem = (await fetchMenuWithIngredients(true)).find((item) => Number(item.id) === itemId);
    return res.json({ item: fullItem || existing });
  } catch (err) {
    console.error('Update menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/menu/:id
router.delete('/menu/:id', authorize('manager', 'owner'), async (req, res) => {
  const itemId = parsePositiveInteger(req.params.id);
  if (!itemId) return res.status(400).json({ error: 'Invalid menu item id' });

  try {
    const item = await getById('menu_items', itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const [orderItems, sales] = await Promise.all([
      listCollection('order_items'),
      listCollection('sales'),
    ]);
    const inUse =
      orderItems.some((row) => Number(row.menu_item_id) === itemId) ||
      sales.some((row) => Number(row.menu_item_id) === itemId);

    if (inUse) {
      return res.status(409).json({
        error:
          'This menu item cannot be removed because it appears on existing orders or sales. Set availability to inactive instead.',
      });
    }

    await db.collection('menu_items').doc(String(itemId)).delete();
    const links = await listCollection('menu_item_ingredients');
    const targetLinks = links.filter((link) => Number(link.menu_item_id) === itemId);
    await Promise.all(targetLinks.map((link) => db.collection('menu_item_ingredients').doc(String(link.id)).delete()));

    return res.json({ item, deleted: true });
  } catch (err) {
    console.error('Delete menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id/price
router.patch('/menu/:id/price', authorize('manager', 'owner'), async (req, res) => {
  const parsedPrice = Number(req.body.price);
  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Valid price is required' });
  }

  try {
    const itemId = parsePositiveInteger(req.params.id);
    if (!itemId) return res.status(400).json({ error: 'Invalid menu item id' });
    const item = await getById('menu_items', itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await db.collection('menu_items').doc(String(itemId)).set({ price: parsedPrice }, { merge: true });
    return res.json({ item: await getById('menu_items', itemId) });
  } catch (err) {
    console.error('Update menu price error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id/active
router.patch('/menu/:id/active', authorize('manager', 'owner'), async (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }

  try {
    const itemId = parsePositiveInteger(req.params.id);
    if (!itemId) return res.status(400).json({ error: 'Invalid menu item id' });
    const item = await getById('menu_items', itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    await db.collection('menu_items').doc(String(itemId)).set({ active }, { merge: true });
    return res.json({ item: await getById('menu_items', itemId) });
  } catch (err) {
    console.error('Update menu active state error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/sales?period=weekly|monthly|yearly
router.get('/sales', authorize('manager', 'owner'), async (req, res) => {
  const period = String(req.query.period || 'monthly').toLowerCase();
  const days = PERIOD_DAYS[period] || PERIOD_DAYS.monthly;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    let sales = await listCollection('sales');
    sales = sales.filter((entry) => String(entry.sold_at || '') >= cutoff);

    if (req.user.role === 'owner') {
      if (req.query.location_id) {
        const locationId = Number(req.query.location_id);
        if (!Number.isInteger(locationId) || locationId <= 0) {
          return res.status(400).json({ error: 'location_id must be a positive integer' });
        }
        sales = sales.filter((entry) => Number(entry.location_id) === locationId);
      }
    } else {
      sales = sales.filter((entry) => Number(entry.location_id) === Number(req.user.location_id));
    }

    const total_items_sold = sales.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const total_revenue = sales.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const total_orders = new Set(sales.map((row) => Number(row.order_id))).size;

    const menuItems = await listCollection('menu_items');
    const locations = await listCollection('locations');
    const menuById = new Map(menuItems.map((item) => [Number(item.id), item]));
    const locationById = new Map(locations.map((loc) => [Number(loc.id), loc]));

    const grouped = new Map();
    for (const row of sales) {
      const menu = menuById.get(Number(row.menu_item_id));
      const location = locationById.get(Number(row.location_id));
      const key = req.user.role === 'owner'
        ? `${row.menu_item_id}:${row.location_id}`
        : `${row.menu_item_id}`;
      const prev = grouped.get(key) || {
        menu_item_id: row.menu_item_id,
        item_name: menu?.name || null,
        category: menu?.category || null,
        total_sold: 0,
        total_revenue: 0,
      };
      prev.total_sold += Number(row.quantity || 0);
      prev.total_revenue += Number(row.total_price || 0);
      if (req.user.role === 'owner') {
        prev.location_id = row.location_id;
        prev.location_name = location?.name || null;
      }
      grouped.set(key, prev);
    }

    const detail = Array.from(grouped.values()).sort((a, b) => b.total_revenue - a.total_revenue);

    return res.json({
      period,
      summary: {
        total_items_sold,
        total_revenue,
        total_orders,
      },
      sales: detail,
    });
  } catch (err) {
    console.error('Sales error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
