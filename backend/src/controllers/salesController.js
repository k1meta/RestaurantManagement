const db = require('../../config/database');

const PERIOD_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

const getPeriodDays = (period) => PERIOD_DAYS[period] || PERIOD_DAYS.monthly;

const getAll = async (req, res, next) => {
  try {
    const days = getPeriodDays(req.query.period);
    const result = await db.query(
      `SELECT s.*, mi.name as item_name, r.name as restaurant_name
       FROM sales s
       LEFT JOIN menu_items mi ON s.menu_item_id = mi.id
       LEFT JOIN restaurants r ON s.restaurant_id = r.id
       WHERE s.sale_date >= NOW() - ($1 || ' days')::INTERVAL
       ORDER BY s.sale_date DESC`,
      [days]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getByRestaurant = async (req, res, next) => {
  try {
    const days = getPeriodDays(req.query.period);
    const result = await db.query(
      `SELECT s.*, mi.name as item_name
       FROM sales s
       LEFT JOIN menu_items mi ON s.menu_item_id = mi.id
       WHERE s.restaurant_id = $1 AND s.sale_date >= NOW() - ($2 || ' days')::INTERVAL
       ORDER BY s.sale_date DESC`,
      [req.params.restaurantId, days]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT r.name as restaurant_name, mi.name as item_name,
              SUM(s.quantity_sold) as total_sold, SUM(s.total_revenue) as total_revenue
       FROM sales s
       LEFT JOIN menu_items mi ON s.menu_item_id = mi.id
       LEFT JOIN restaurants r ON s.restaurant_id = r.id
       GROUP BY r.name, mi.name
       ORDER BY total_revenue DESC`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getByRestaurant, getSummary };
