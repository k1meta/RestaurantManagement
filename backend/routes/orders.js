const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // All order routes require login

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'closed'];
const KITCHEN_UPDATE_ROLES = ['kitchen', 'manager', 'owner'];
const CLOSING_ROLES = ['waiter', 'manager', 'owner'];

function parseBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
}

function parseStatusFilter(statusValue) {
  if (!statusValue) return [];

  const parsed = String(statusValue)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return parsed.filter((s) => ORDER_STATUSES.includes(s));
}

async function attachItemsToOrders(orders, client = pool) {
  if (!orders.length) return orders;

  const orderIds = orders.map((order) => order.id);
  const itemsResult = await client.query(
    `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.unit_price,
            m.name AS item_name, m.category
     FROM order_items oi
     JOIN menu_items m ON oi.menu_item_id = m.id
     WHERE oi.order_id = ANY($1::int[])
     ORDER BY oi.order_id, oi.id`,
    [orderIds]
  );

  const itemsByOrder = new Map();
  for (const row of itemsResult.rows) {
    if (!itemsByOrder.has(row.order_id)) {
      itemsByOrder.set(row.order_id, []);
    }
    itemsByOrder.get(row.order_id).push({
      ...row,
      unit_price: Number(row.unit_price),
    });
  }

  return orders.map((order) => {
    const items = itemsByOrder.get(order.id) || [];
    const total_amount = items.reduce(
      (sum, item) => sum + Number(item.unit_price) * Number(item.quantity),
      0
    );

    return {
      ...order,
      items,
      total_amount,
    };
  });
}

// ─── GET /api/orders ────────────────────────────────────────────────────────
// Waiters/kitchen see their location's orders; owner sees all
router.get('/', async (req, res) => {
  try {
    const statusFilter = parseStatusFilter(req.query.status);
    const includeItems = parseBoolean(req.query.include_items, false);
    const includeClosed = parseBoolean(req.query.include_closed, true);

    const conditions = [];
    const params = [];

    if (req.user.role !== 'owner') {
      params.push(req.user.location_id);
      conditions.push(`o.location_id = $${params.length}`);
    }

    if (statusFilter.length) {
      params.push(statusFilter);
      conditions.push(`o.status = ANY($${params.length}::text[])`);
    } else if (!includeClosed) {
      conditions.push(`o.status <> 'closed'`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT o.*, u.name AS waiter_name, l.name AS location_name
       FROM orders o
       JOIN users u ON o.waiter_id = u.id
       JOIN locations l ON o.location_id = l.id
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );

    const orders = includeItems
      ? await attachItemsToOrders(result.rows)
      : result.rows;

    res.json({ orders });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/orders/:id ────────────────────────────────────────────────────
// Get a single order with its items
router.get('/:id', async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT o.*, u.name AS waiter_name, l.name AS location_name
       FROM orders o
       JOIN users u ON o.waiter_id = u.id
       JOIN locations l ON o.location_id = l.id
       WHERE o.id = $1`,
      [req.params.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    if (req.user.role !== 'owner' && Number(order.location_id) !== Number(req.user.location_id)) {
      return res.status(403).json({ error: 'Access denied for this order' });
    }

    const itemsResult = await pool.query(
      `SELECT oi.*, m.name AS item_name, m.category
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );

    const items = itemsResult.rows.map((item) => ({
      ...item,
      unit_price: Number(item.unit_price),
    }));
    const total_amount = items.reduce(
      (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
      0
    );

    res.json({
      order: {
        ...order,
        items,
        total_amount,
      },
      items,
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/orders ───────────────────────────────────────────────────────
// Waiter creates a new order ticket
// Body: { table_number, notes, items: [{ menu_item_id, quantity }] }
router.post('/', authorize('waiter', 'manager', 'owner'), async (req, res) => {
  const { table_number, notes, items, location_id } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const normalizedByMenuId = new Map();
  for (const item of items) {
    const menu_item_id = Number(item.menu_item_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(menu_item_id) || menu_item_id <= 0) {
      return res.status(400).json({ error: 'Each item needs a valid menu_item_id' });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Each item needs a positive integer quantity' });
    }

    const existing = normalizedByMenuId.get(menu_item_id) || 0;
    normalizedByMenuId.set(menu_item_id, existing + quantity);
  }

  const normalizedItems = Array.from(normalizedByMenuId.entries()).map(([menu_item_id, quantity]) => ({
    menu_item_id,
    quantity,
  }));

  const targetLocation = req.user.role === 'owner'
    ? Number(location_id || req.user.location_id)
    : Number(req.user.location_id);

  if (!Number.isInteger(targetLocation) || targetLocation <= 0) {
    return res.status(400).json({ error: 'A valid location_id is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const locationCheck = await client.query(
      'SELECT id FROM locations WHERE id = $1',
      [targetLocation]
    );

    if (!locationCheck.rows.length) {
      throw new Error(`Location ${targetLocation} does not exist`);
    }

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (location_id, waiter_id, table_number, notes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [targetLocation, req.user.id, table_number ? String(table_number).trim() : null, notes || null]
    );
    const order = orderResult.rows[0];

    const menuIds = normalizedItems.map((item) => item.menu_item_id);
    const menuResult = await client.query(
      'SELECT id, price FROM menu_items WHERE id = ANY($1::int[]) AND active = TRUE',
      [menuIds]
    );

    const menuById = new Map(menuResult.rows.map((row) => [Number(row.id), Number(row.price)]));

    if (menuById.size !== menuIds.length) {
      const missing = menuIds.filter((id) => !menuById.has(id));
      throw new Error(`Menu item(s) not found or inactive: ${missing.join(', ')}`);
    }

    // Insert each item (snapshot current price)
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, menuById.get(item.menu_item_id)]
      );
    }

    const orderWithItems = await attachItemsToOrders([order], client);

    await client.query('COMMIT');
    res.status(201).json({ order: orderWithItems[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create order error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/orders/:id/status ───────────────────────────────────────────
// Update order status: pending → preparing → ready → closed
// Kitchen updates to 'preparing' / 'ready'; waiter closes
router.patch('/:id/status', async (req, res) => {
  const status = String(req.body.status || '').toLowerCase();

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const currentOrderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );

    if (!currentOrderResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const currentOrder = currentOrderResult.rows[0];
    const previousStatus = currentOrder.status;

    if (req.user.role !== 'owner' && Number(currentOrder.location_id) !== Number(req.user.location_id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied for this order' });
    }

    if (['preparing', 'ready'].includes(status) && !KITCHEN_UPDATE_ROLES.includes(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only kitchen, manager, or owner can set preparing/ready' });
    }

    if (status === 'closed' && !CLOSING_ROLES.includes(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only waiter, manager, or owner can close orders' });
    }

    if (status === 'closed' && req.user.role === 'waiter' && previousStatus !== 'ready') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Waiter can only close orders that are ready' });
    }

    if (status === 'pending' && !['manager', 'owner'].includes(req.user.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only manager or owner can move an order back to pending' });
    }

    const updateResult = await client.query(
      `UPDATE orders
       SET status    = $1::varchar,
           closed_at = CASE
             WHEN $1::varchar = 'closed' THEN COALESCE(closed_at, NOW())
             ELSE closed_at
           END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    const order = updateResult.rows[0];

    // When an order is closed → record sales
    if (status === 'closed' && previousStatus !== 'closed') {
      await client.query(
        `INSERT INTO sales (location_id, menu_item_id, order_id, quantity, total_price)
         SELECT o.location_id,
                oi.menu_item_id,
                o.id,
                SUM(oi.quantity) AS quantity,
                SUM(oi.quantity * oi.unit_price) AS total_price
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.id = $1
           AND NOT EXISTS (
             SELECT 1
             FROM sales s
             WHERE s.order_id = o.id
               AND s.menu_item_id = oi.menu_item_id
           )
         GROUP BY o.location_id, o.id, oi.menu_item_id`,
        [order.id]
      );
    }

    await client.query('COMMIT');
    res.json({ order });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;

