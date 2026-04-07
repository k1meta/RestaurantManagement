const express = require('express');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/waiter-stats
router.get('/waiter-stats', async (req, res) => {
  try {
    const waiterResult = await pool.query(
      `SELECT COUNT(*) as my_orders, 
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
              SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_count,
              COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 ELSE 0 END), 0) as today_orders
       FROM orders 
       WHERE waiter_id = $1 AND closed_at IS NULL`,
      [req.user.id]
    );

    const ticketsResult = await pool.query(
      `SELECT o.id, o.table_number, COUNT(oi.id) as items, o.status, o.created_at
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.waiter_id = $1 AND o.closed_at IS NULL
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(s.total_price), 0) as today_total
       FROM sales s
       WHERE DATE(s.sold_at) = CURRENT_DATE`,
      []
    );

    res.json({
      myOrders: parseInt(waiterResult.rows[0]?.my_orders || 0),
      pendingCount: parseInt(waiterResult.rows[0]?.pending_count || 0),
      readyCount: parseInt(waiterResult.rows[0]?.ready_count || 0),
      todayTotal: parseFloat(revenueResult.rows[0]?.today_total || 0),
      activeOrders: ticketsResult.rows
    });
  } catch (err) {
    console.error('Waiter stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/kitchen-stats
router.get('/kitchen-stats', async (req, res) => {
  try {
    const statsResult = await pool.query(
      `SELECT COUNT(*) as total_count,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
              SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as cooking_count,
              SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_count
       FROM orders
       WHERE location_id = $1 AND closed_at IS NULL`,
      [req.user.location_id]
    );

    const ticketsResult = await pool.query(
      `SELECT o.id, o.table_number, o.status, o.notes, o.created_at,
              json_agg(json_build_object('name', mi.name, 'quantity', oi.quantity)) as items
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE o.location_id = $1 AND (o.status = 'pending' OR o.status = 'preparing')
       GROUP BY o.id
       ORDER BY o.created_at ASC`,
      [req.user.location_id]
    );

    res.json({
      totalCount: parseInt(statsResult.rows[0]?.total_count || 0),
      pendingCount: parseInt(statsResult.rows[0]?.pending_count || 0),
      cookingCount: parseInt(statsResult.rows[0]?.cooking_count || 0),
      readyCount: parseInt(statsResult.rows[0]?.ready_count || 0),
      pendingOrders: ticketsResult.rows.filter(o => o.items[0] !== null)
    });
  } catch (err) {
    console.error('Kitchen stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/manager-stats
router.get('/manager-stats', async (req, res) => {
  try {
    const statsResult = await pool.query(
      `SELECT COALESCE(SUM(s.total_price), 0) as daily_revenue,
              COUNT(*) as total_orders,
              SUM(CASE WHEN o.status = 'pending' THEN 1 ELSE 0 END) as pending_orders
       FROM sales s
       FULL JOIN orders o ON s.order_id = o.id
       WHERE DATE(s.sold_at) = CURRENT_DATE OR (o.location_id = $1 AND DATE(o.created_at) = CURRENT_DATE)`,
      [req.user.location_id]
    );

    const staffResult = await pool.query(
      `SELECT COUNT(*) as staff_count FROM users WHERE location_id = $1 AND role IN ('waiter', 'kitchen')`,
      [req.user.location_id]
    );

    const ordersResult = await pool.query(
      `SELECT o.id, o.table_number, COUNT(oi.id) as items, o.status, o.created_at
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.location_id = $1 AND o.closed_at IS NULL AND (o.status = 'pending' OR o.status = 'preparing')
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.location_id]
    );

    res.json({
      dailyRevenue: parseFloat(statsResult.rows[0]?.daily_revenue || 0),
      totalOrders: parseInt(statsResult.rows[0]?.total_orders || 0),
      pendingOrders: parseInt(statsResult.rows[0]?.pending_orders || 0),
      staffCount: parseInt(staffResult.rows[0]?.staff_count || 0),
      activeOrders: ordersResult.rows
    });
  } catch (err) {
    console.error('Manager stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/owner-analytics
router.get('/owner-analytics', async (req, res) => {
  try {
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(total_price), 0) as total_revenue
       FROM sales
       WHERE sold_at >= NOW() - INTERVAL '30 days'`
    );

    const locationResult = await pool.query(
      `SELECT l.id, l.name as location_name, 
              COALESCE(SUM(s.total_price), 0) as revenue
       FROM locations l
       LEFT JOIN sales s ON l.id = s.location_id AND s.sold_at >= NOW() - INTERVAL '30 days'
       GROUP BY l.id, l.name
       ORDER BY revenue DESC`
    );

    const dailyResult = await pool.query(
      `SELECT DATE(sold_at) as date, SUM(total_price) as daily_revenue
       FROM sales
       WHERE sold_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(sold_at)
       ORDER BY date ASC`
    );

    const statsResult = await pool.query(
      `SELECT COUNT(DISTINCT waiter_id) as active_staff,
              (SELECT COUNT(*) FROM locations) as locations,
              COUNT(DISTINCT CASE WHEN DATE(created_at) = CURRENT_DATE THEN id END) as today_orders
       FROM orders`
    );

    const ordersResult = await pool.query(
      `SELECT o.id, l.name as location, o.status, o.created_at, 
              COALESCE(SUM(s.total_price), 0) as total
       FROM orders o
       LEFT JOIN locations l ON o.location_id = l.id
       LEFT JOIN sales s ON o.id = s.order_id
       GROUP BY o.id, l.name
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    res.json({
      totalRevenue: parseFloat(revenueResult.rows[0]?.total_revenue || 0),
      byLocation: locationResult.rows,
      dailyRevenue: dailyResult.rows,
      todayOrders: parseInt(statsResult.rows[0]?.today_orders || 0),
      activeStaff: parseInt(statsResult.rows[0]?.active_staff || 0),
      locations: parseInt(statsResult.rows[0]?.locations || 0),
      recentOrders: ordersResult.rows
    });
  } catch (err) {
    console.error('Owner analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/menu
router.get('/menu', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, category, price, active FROM menu_items ORDER BY category, name`
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Menu error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
