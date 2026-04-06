const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

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

// ─── MENU ───────────────────────────────────────────────────────────────────

// GET /api/menu  — all active menu items (any logged-in user)
router.get('/menu', async (req, res) => {
  try {
    const includeInactive =
      parseBoolean(req.query.include_inactive, false) &&
      ['manager', 'owner'].includes(req.user.role);

    const query = includeInactive
      ? 'SELECT * FROM menu_items ORDER BY category, name'
      : 'SELECT * FROM menu_items WHERE active = TRUE ORDER BY category, name';

    const result = await pool.query(query);
    res.json({ menu: result.rows });
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

  try {
    const result = await pool.query(
      `INSERT INTO menu_items (name, category, price, active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, category || null, price, active]
    );

    return res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('Create menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
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

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(itemId);

  try {
    const result = await pool.query(
      `UPDATE menu_items
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Update menu item error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/menu/:id  — soft-delete by deactivating item (manager / owner only)
router.delete('/menu/:id', authorize('manager', 'owner'), async (req, res) => {
  const itemId = parsePositiveInteger(req.params.id);
  if (!itemId) {
    return res.status(400).json({ error: 'Invalid menu item id' });
  }

  try {
    const result = await pool.query(
      'UPDATE menu_items SET active = FALSE WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ item: result.rows[0] });
  } catch (err) {
    console.error('Deactivate menu item error:', err);
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

