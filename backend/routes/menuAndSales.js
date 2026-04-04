const express = require('express');
const pool    = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── MENU ───────────────────────────────────────────────────────────────────

// GET /api/menu  — all active menu items (any logged-in user)
router.get('/menu', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM menu_items WHERE active = TRUE ORDER BY category, name'
    );
    res.json({ menu: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/menu/:id/price  — update price (manager / owner only)
router.patch('/menu/:id/price', authorize('manager', 'owner'), async (req, res) => {
  const { price } = req.body;
  if (!price || isNaN(price)) {
    return res.status(400).json({ error: 'Valid price is required' });
  }
  try {
    const result = await pool.query(
      'UPDATE menu_items SET price = $1 WHERE id = $2 RETURNING *',
      [price, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── SALES ──────────────────────────────────────────────────────────────────

// GET /api/sales?period=weekly|monthly|yearly
// Owner sees all locations; manager sees their location
router.get('/sales', authorize('manager', 'owner'), async (req, res) => {
  const { period = 'monthly' } = req.query;

  const intervals = { weekly: '7 days', monthly: '30 days', yearly: '365 days' };
  const interval  = intervals[period] || '30 days';

  try {
    let query, params;
    if (req.user.role === 'owner') {
      query = `
        SELECT m.name AS item_name, m.category,
               l.name AS location_name,
               SUM(s.quantity)    AS total_sold,
               SUM(s.total_price) AS total_revenue
        FROM sales s
        JOIN menu_items m ON s.menu_item_id = m.id
        JOIN locations  l ON s.location_id  = l.id
        WHERE s.sold_at >= NOW() - INTERVAL '${interval}'
        GROUP BY m.name, m.category, l.name
        ORDER BY total_revenue DESC`;
      params = [];
    } else {
      query = `
        SELECT m.name AS item_name, m.category,
               SUM(s.quantity)    AS total_sold,
               SUM(s.total_price) AS total_revenue
        FROM sales s
        JOIN menu_items m ON s.menu_item_id = m.id
        WHERE s.location_id = $1
          AND s.sold_at >= NOW() - INTERVAL '${interval}'
        GROUP BY m.name, m.category
        ORDER BY total_revenue DESC`;
      params = [req.user.location_id];
    }

    const result = await pool.query(query, params);
    res.json({ period, sales: result.rows });
  } catch (err) {
    console.error('Sales error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
