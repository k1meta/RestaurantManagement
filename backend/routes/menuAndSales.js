const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { parseAllowedUnit } = require('../constants/units');

const router = express.Router();
router.use(authenticate);

const PERIOD_INTERVALS = {
  weekly: '7 days',
  monthly: '30 days',
  yearly: '365 days',
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
    if (!unitRes.ok) {
      return { error: unitRes.error };
    }
    const unitVal = unitRes.value;

    if (!ingredient_id) {
      return { error: 'Each ingredient requires a valid ingredient_id' };
    }

    if (!Number.isFinite(quantity_required) || quantity_required <= 0) {
      return { error: 'Each ingredient requires quantity_required > 0' };
    }

    if (!unitVal) {
      return { error: 'Each ingredient requires a unit (Kg, g, pieces, L, or ml)' };
    }

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

async function fetchMenuWithIngredients(client, includeInactive) {
  const menuQuery = includeInactive
    ? 'SELECT * FROM menu_items ORDER BY category, name'
    : 'SELECT * FROM menu_items WHERE active = TRUE ORDER BY category, name';
  const menuResult = await client.query(menuQuery);
  const menu = menuResult.rows;

  if (!menu.length) return [];

  const ids = menu.map((item) => item.id);
  const ingredientResult = await client.query(
    `SELECT mi.menu_item_id,
            mi.ingredient_id,
            mi.quantity_required,
            COALESCE(mi.unit, ing.default_unit) AS unit,
            ing.name AS ingredient_name
     FROM menu_item_ingredients mi
     JOIN ingredients ing ON ing.id = mi.ingredient_id
     WHERE mi.menu_item_id = ANY($1::int[])
     ORDER BY mi.menu_item_id, ing.name`,
    [ids]
  );

  const byMenuId = new Map();
  for (const row of ingredientResult.rows) {
    if (!byMenuId.has(row.menu_item_id)) byMenuId.set(row.menu_item_id, []);
    byMenuId.get(row.menu_item_id).push({
      ingredient_id: row.ingredient_id,
      ingredient_name: row.ingredient_name,
      quantity_required: Number(row.quantity_required),
      unit: row.unit || null,
    });
  }

  return menu.map((item) => ({
    ...item,
    ingredients: byMenuId.get(item.id) || [],
  }));
}

// ─── MENU ───────────────────────────────────────────────────────────────────

// GET /api/menu  — all active menu items (any logged-in user)
router.get('/menu', async (req, res) => {
  try {
    const includeInactive =
      parseBoolean(req.query.include_inactive, false) &&
      ['manager', 'owner'].includes(req.user.role);
    const menu = await fetchMenuWithIngredients(pool, includeInactive);
    res.json({ menu });
  } catch (err) {
    console.error('Get menu error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/menu  — create a new menu item (manager / owner only)
router.post('/menu', authorize('manager', 'owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const category = req.body.category ? String(req.body.category).trim() : null;
  const price = Number(req.body.price);
  const active = req.body.active === undefined ? true : req.body.active;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ingredientIds = requirements.map((entry) => entry.ingredient_id);
    const knownIngredients = await client.query(
      'SELECT id FROM ingredients WHERE id = ANY($1::int[])',
      [ingredientIds]
    );

    if (knownIngredients.rows.length !== ingredientIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'One or more ingredient_id values are invalid' });
    }

    const result = await client.query(
      `INSERT INTO menu_items (name, category, price, active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, category || null, price, active]
    );

    const createdItem = result.rows[0];

    for (const ingredient of requirements) {
      await client.query(
        `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required, unit)
         VALUES ($1, $2, $3, $4)`,
        [createdItem.id, ingredient.ingredient_id, ingredient.quantity_required, ingredient.unit || null]
      );
    }

    const fullItem = (await fetchMenuWithIngredients(client, true)).find(
      (item) => item.id === createdItem.id
    );

    await client.query('COMMIT');
    return res.status(201).json({ item: fullItem || createdItem });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// PATCH /api/menu/:id  — update a menu item (manager / owner only)
router.patch('/menu/:id', authorize('manager', 'owner'), async (req, res) => {
  const itemId = parsePositiveInteger(req.params.id);
  if (!itemId) {
    return res.status(400).json({ error: 'Invalid menu item id' });
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'name cannot be empty' });
    }
    params.push(name);
    updates.push(`name = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
    const category = req.body.category ? String(req.body.category).trim() : null;
    params.push(category || null);
    updates.push(`category = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'price')) {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ error: 'price must be a positive number' });
    }
    params.push(price);
    updates.push(`price = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'active')) {
    if (typeof req.body.active !== 'boolean') {
      return res.status(400).json({ error: 'active must be a boolean' });
    }
    params.push(req.body.active);
    updates.push(`active = $${params.length}`);
  }

  const wantsIngredientUpdate = Object.prototype.hasOwnProperty.call(req.body, 'ingredients');

  if (!updates.length && !wantsIngredientUpdate) {
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT id FROM menu_items WHERE id = $1 FOR UPDATE', [itemId]);
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Item not found' });
    }

    let updatedItem = null;
    if (updates.length) {
      params.push(itemId);
      const result = await client.query(
        `UPDATE menu_items
         SET ${updates.join(', ')}
         WHERE id = $${params.length}
         RETURNING *`,
        params
      );
      updatedItem = result.rows[0] || null;
    }

    if (requirements) {
      const ingredientIds = requirements.map((entry) => entry.ingredient_id);
      const knownIngredients = await client.query(
        'SELECT id FROM ingredients WHERE id = ANY($1::int[])',
        [ingredientIds]
      );
      if (knownIngredients.rows.length !== ingredientIds.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One or more ingredient_id values are invalid' });
      }

      await client.query('DELETE FROM menu_item_ingredients WHERE menu_item_id = $1', [itemId]);
      for (const ingredient of requirements) {
        await client.query(
          `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required, unit)
           VALUES ($1, $2, $3, $4)`,
          [itemId, ingredient.ingredient_id, ingredient.quantity_required, ingredient.unit || null]
        );
      }
    }

    const fullItem = (await fetchMenuWithIngredients(client, true)).find((item) => item.id === itemId);
    await client.query('COMMIT');
    return res.json({ item: fullItem || updatedItem });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/menu/:id  — permanently remove menu item when not referenced by orders/sales (manager / owner only)
router.delete('/menu/:id', authorize('manager', 'owner'), async (req, res) => {
  const itemId = parsePositiveInteger(req.params.id);
  if (!itemId) {
    return res.status(400).json({ error: 'Invalid menu item id' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM menu_items WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ item: result.rows[0], deleted: true });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error:
          'This menu item cannot be removed because it appears on existing orders or sales. Set availability to inactive instead.',
      });
    }
    console.error('Delete menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id/price  — update price (manager / owner only)
router.patch('/menu/:id/price', authorize('manager', 'owner'), async (req, res) => {
  const parsedPrice = Number(req.body.price);

  if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
    return res.status(400).json({ error: 'Valid price is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE menu_items SET price = $1 WHERE id = $2 RETURNING *',
      [parsedPrice, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Update menu price error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id/active  — toggle availability (manager / owner only)
router.patch('/menu/:id/active', authorize('manager', 'owner'), async (req, res) => {
  const { active } = req.body;

  if (typeof active !== 'boolean') {
    return res.status(400).json({ error: 'active must be a boolean' });
  }

  try {
    const result = await pool.query(
      'UPDATE menu_items SET active = $1 WHERE id = $2 RETURNING *',
      [active, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Update menu active state error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/menu/global-price-adjustment — owner only
// Body: { percentage, category?, include_inactive? }
router.post('/menu/global-price-adjustment', authorize('owner'), async (req, res) => {
  const percentage = Number(req.body.percentage);
  const category = req.body.category ? String(req.body.category).trim() : null;
  const includeInactive = parseBoolean(req.body.include_inactive, false);

  if (!Number.isFinite(percentage) || percentage <= -100 || percentage > 500) {
    return res.status(400).json({ error: 'percentage must be a number between -100 and 500' });
  }

  try {
    const params = [percentage];
    const conditions = [];

    if (!includeInactive) {
      conditions.push('active = TRUE');
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `UPDATE menu_items
       SET price = ROUND((price * (1 + ($1 / 100.0)))::numeric, 2)
       ${whereClause}
       RETURNING id, name, category, price, active`,
      params
    );

    res.json({
      updated_count: result.rows.length,
      items: result.rows,
    });
  } catch (err) {
    console.error('Global price adjustment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SALES ──────────────────────────────────────────────────────────────────

// GET /api/sales?period=weekly|monthly|yearly
// Owner sees all locations; manager sees their location
router.get('/sales', authorize('manager', 'owner'), async (req, res) => {
  const period = String(req.query.period || 'monthly').toLowerCase();
  const interval = PERIOD_INTERVALS[period] || PERIOD_INTERVALS.monthly;

  try {
    const conditions = [`s.sold_at >= NOW() - INTERVAL '${interval}'`];
    const params = [];

    if (req.user.role === 'owner') {
      if (req.query.location_id) {
        const locationId = Number(req.query.location_id);
        if (!Number.isInteger(locationId) || locationId <= 0) {
          return res.status(400).json({ error: 'location_id must be a positive integer' });
        }
        params.push(locationId);
        conditions.push(`s.location_id = $${params.length}`);
      }
    } else {
      params.push(req.user.location_id);
      conditions.push(`s.location_id = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const summaryResult = await pool.query(
      `SELECT COALESCE(SUM(s.quantity), 0)::int AS total_items_sold,
              COALESCE(SUM(s.total_price), 0)::float AS total_revenue,
              COUNT(DISTINCT s.order_id)::int AS total_orders
       FROM sales s
       ${whereClause}`,
      params
    );

    const detailQuery = req.user.role === 'owner'
      ? `SELECT m.id AS menu_item_id,
                m.name AS item_name,
                m.category,
                l.id AS location_id,
                l.name AS location_name,
                SUM(s.quantity)::int AS total_sold,
                SUM(s.total_price)::float AS total_revenue
         FROM sales s
         JOIN menu_items m ON s.menu_item_id = m.id
         JOIN locations l ON s.location_id = l.id
         ${whereClause}
         GROUP BY m.id, m.name, m.category, l.id, l.name
         ORDER BY total_revenue DESC`
      : `SELECT m.id AS menu_item_id,
                m.name AS item_name,
                m.category,
                SUM(s.quantity)::int AS total_sold,
                SUM(s.total_price)::float AS total_revenue
         FROM sales s
         JOIN menu_items m ON s.menu_item_id = m.id
         ${whereClause}
         GROUP BY m.id, m.name, m.category
         ORDER BY total_revenue DESC`;

    const detailResult = await pool.query(detailQuery, params);

    res.json({
      period,
      summary: summaryResult.rows[0],
      sales: detailResult.rows,
    });
  } catch (err) {
    console.error('Sales error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

