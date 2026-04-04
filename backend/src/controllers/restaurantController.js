const db = require('../../config/database');

const getAll = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM restaurants ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM restaurants WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, address, phone, email } = req.body;
    const result = await db.query(
      'INSERT INTO restaurants (name, address, phone, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, address, phone, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, address, phone, email } = req.body;
    const result = await db.query(
      'UPDATE restaurants SET name=$1, address=$2, phone=$3, email=$4, updated_at=NOW() WHERE id=$5 RETURNING *',
      [name, address, phone, email, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const result = await db.query('DELETE FROM restaurants WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Restaurant not found' });
    res.json({ message: 'Restaurant deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
