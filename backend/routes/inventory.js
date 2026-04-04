const express = require('express');
const pool    = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// GET /api/inventory  — manager sees their location; owner sees all
router.get('/', async (req, res) => {
  try {
    let result;
    if (req.user.role === 'owner') {
      result = await pool.query(
        `SELECT i.*, l.name AS location_name
         FROM inventory i
         JOIN locations l ON i.location_id = l.id
         ORDER BY l.name, i.ingredient`
      );
    } else {
      result = await pool.query(
        `SELECT i.*, l.name AS location_name
         FROM inventory i
         JOIN locations l ON i.location_id = l.id
         WHERE i.location_id = $1
         ORDER BY i.ingredient`,
        [req.user.location_id]
      );
    }
    res.json({ inventory: result.rows });
  } catch (err) {
    console.error('Get inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/inventory  — add or update an ingredient (manager / owner only)
// Body: { ingredient, quantity, unit }
router.post('/', authorize('manager', 'owner'), async (req, res) => {
  const { ingredient, quantity, unit, location_id } = req.body;

  // Owner can specify a location; manager defaults to their own
  const targetLocation = req.user.role === 'owner' && location_id
    ? location_id
    : req.user.location_id;

  if (!ingredient || quantity == null) {
    return res.status(400).json({ error: 'ingredient and quantity are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventory (location_id, ingredient, quantity, unit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (location_id, ingredient)
       DO UPDATE SET quantity = $3, unit = $4, updated_at = NOW()
       RETURNING *`,
      [targetLocation, ingredient, quantity, unit]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    console.error('Upsert inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/inventory/:id  — manager / owner only
router.delete('/:id', authorize('manager', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory WHERE id = $1', [req.params.id]);
    res.json({ message: 'Item removed' });
  } catch (err) {
    console.error('Delete inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
