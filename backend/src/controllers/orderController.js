const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const { restaurant_id } = req.query;
    let query = 'SELECT o.*, u.name as waiter_name FROM orders o LEFT JOIN users u ON o.waiter_id = u.id';
    const params = [];
    if (restaurant_id) {
      query += ' WHERE o.restaurant_id = $1';
      params.push(restaurant_id);
    }
    query += ' ORDER BY o.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const itemsResult = await db.query(
      'SELECT oi.*, mi.name as item_name FROM order_items oi LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id WHERE oi.order_id = $1',
      [req.params.id]
    );

    res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { restaurant_id, table_number, items } = req.body;
    const waiter_id = req.user.id;

    const orderResult = await db.query(
      'INSERT INTO orders (restaurant_id, waiter_id, table_number, status) VALUES ($1, $2, $3, $4) RETURNING *',
      [restaurant_id, waiter_id, table_number, 'pending']
    );
    const order = orderResult.rows[0];

    if (items && items.length > 0) {
      for (const item of items) {
        await db.query(
          'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [order.id, item.menu_item_id, item.quantity, item.unit_price]
        );
      }
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'in_progress', 'ready', 'delivered', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM orders WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, updateStatus, remove };
