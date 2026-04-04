const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const { restaurant_id } = req.query;
    let query = 'SELECT * FROM inventory';
    const params = [];
    if (restaurant_id) {
      query += ' WHERE restaurant_id = $1';
      params.push(restaurant_id);
    }
    query += ' ORDER BY name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM inventory WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Inventory item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { restaurant_id, name, quantity, unit, min_threshold } = req.body;
    const result = await db.query(
      'INSERT INTO inventory (restaurant_id, name, quantity, unit, min_threshold) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [restaurant_id, name, quantity, unit, min_threshold || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, quantity, unit, min_threshold } = req.body;
    const current = await db.query('SELECT quantity FROM inventory WHERE id = $1', [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Inventory item not found' });

    const result = await db.query(
      'UPDATE inventory SET name=$1, quantity=$2, unit=$3, min_threshold=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, quantity, unit, min_threshold, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Inventory item not found' });

    const change = quantity - current.rows[0].quantity;
    await db.query(
      'INSERT INTO inventory_logs (inventory_id, changed_by, change_amount, reason) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user.id, change, req.body.reason || 'manual update']
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const getLogs = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT il.*, i.name as item_name, u.name as changed_by_name
       FROM inventory_logs il
       LEFT JOIN inventory i ON il.inventory_id = i.id
       LEFT JOIN users u ON il.changed_by = u.id
       WHERE i.restaurant_id = $1
       ORDER BY il.created_at DESC`,
      [req.params.restaurantId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, getLogs };
