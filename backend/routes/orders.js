const express = require('express');
const pool    = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate); // All order routes require login

// ─── GET /api/orders ────────────────────────────────────────────────────────
// Waiters/kitchen see their location's orders; owner sees all
router.get('/', async (req, res) => {
  try {
    let query, params;

    if (req.user.role === 'owner') {
      query  = `SELECT o.*, u.name AS waiter_name, l.name AS location_name
                FROM orders o
                JOIN users u ON o.waiter_id = u.id
                JOIN locations l ON o.location_id = l.id
                ORDER BY o.created_at DESC`;
      params = [];
    } else {
      query  = `SELECT o.*, u.name AS waiter_name, l.name AS location_name
                FROM orders o
                JOIN users u ON o.waiter_id = u.id
                JOIN locations l ON o.location_id = l.id
                WHERE o.location_id = $1
                ORDER BY o.created_at DESC`;
      params = [req.user.location_id];
    }

    const result = await pool.query(query, params);
    res.json({ orders: result.rows });
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

    const itemsResult = await pool.query(
      `SELECT oi.*, m.name AS item_name, m.category
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );

    res.json({
      order: orderResult.rows[0],
      items: itemsResult.rows,
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
  const { table_number, notes, items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create the order
    const orderResult = await client.query(
      `INSERT INTO orders (location_id, waiter_id, table_number, notes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [req.user.location_id, req.user.id, table_number, notes]
    );
    const order = orderResult.rows[0];

    // Insert each item (snapshot current price)
    for (const item of items) {
      const menuItem = await client.query(
        'SELECT price FROM menu_items WHERE id = $1 AND active = TRUE',
        [item.menu_item_id]
      );

      if (menuItem.rows.length === 0) {
        throw new Error(`Menu item ${item.menu_item_id} not found or inactive`);
      }

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, menuItem.rows[0].price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ order });
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
  const { status } = req.body;
  const validStatuses = ['pending', 'preparing', 'ready', 'closed'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE orders
       SET status    = $1,
           closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = updateResult.rows[0];

    // When an order is closed → record sales
    if (status === 'closed') {
      const items = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      );

      for (const item of items.rows) {
        await client.query(
          `INSERT INTO sales (location_id, menu_item_id, order_id, quantity, total_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            order.location_id,
            item.menu_item_id,
            order.id,
            item.quantity,
            item.quantity * item.unit_price,
          ]
        );
      }
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
