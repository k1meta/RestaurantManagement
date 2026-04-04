const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const { restaurant_id } = req.query;
    let query = 'SELECT * FROM menu_items';
    const params = [];
    if (restaurant_id) {
      query += ' WHERE restaurant_id = $1';
      params.push(restaurant_id);
    }
    query += ' ORDER BY category, name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { restaurant_id, name, description, price, category, is_available } = req.body;
    const result = await db.query(
      'INSERT INTO menu_items (restaurant_id, name, description, price, category, is_available) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [restaurant_id, name, description, price, category, is_available !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, description, price, category, is_available } = req.body;
    const result = await db.query(
      'UPDATE menu_items SET name=$1, description=$2, price=$3, category=$4, is_available=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, description, price, category, is_available, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM menu_items WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Menu item not found' });
    res.json({ message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
