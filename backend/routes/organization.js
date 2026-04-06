const express = require('express');
const bcryptjs = require('bcryptjs');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const ALL_ROLES = ['owner', 'manager', 'waiter', 'kitchen'];
const MANAGER_ASSIGNABLE_ROLES = ['waiter', 'kitchen'];

router.use(authenticate);

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function locationExists(locationId) {
  const result = await pool.query('SELECT id FROM locations WHERE id = $1', [locationId]);
  return result.rows.length > 0;
}

// GET /api/locations
router.get('/locations', async (req, res) => {
  try {
    if (req.user.role === 'owner') {
      const result = await pool.query('SELECT * FROM locations ORDER BY name');
      return res.json({ locations: result.rows });
    }

    const result = await pool.query('SELECT * FROM locations WHERE id = $1', [req.user.location_id]);
    return res.json({ locations: result.rows });
  } catch (err) {
    console.error('Get locations error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/locations  — owner only
router.post('/locations', authorize('owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const address = req.body.address ? String(req.body.address).trim() : null;

  if (!name) {
    return res.status(400).json({ error: 'Location name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO locations (name, address) VALUES ($1, $2) RETURNING *',
      [name, address || null]
    );

    return res.status(201).json({ location: result.rows[0] });
  } catch (err) {
    console.error('Create location error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/locations/:id  — owner only
router.patch('/locations/:id', authorize('owner'), async (req, res) => {
  const locationId = parsePositiveInteger(req.params.id);
  if (!locationId) {
    return res.status(400).json({ error: 'Invalid location id' });
  }

  const updates = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Location name cannot be empty' });
    }
    params.push(name);
    updates.push(`name = $${params.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'address')) {
    const address = req.body.address ? String(req.body.address).trim() : null;
    params.push(address || null);
    updates.push(`address = $${params.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(locationId);

  try {
    const result = await pool.query(
      `UPDATE locations
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.json({ location: result.rows[0] });
  } catch (err) {
    console.error('Update location error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/locations/:id  — owner only
router.delete('/locations/:id', authorize('owner'), async (req, res) => {
  const locationId = parsePositiveInteger(req.params.id);
  if (!locationId) {
    return res.status(400).json({ error: 'Invalid location id' });
  }

  try {
    const usage = await pool.query(
      `SELECT
          (SELECT COUNT(*)::int FROM users WHERE location_id = $1) AS users_count,
          (SELECT COUNT(*)::int FROM inventory WHERE location_id = $1) AS inventory_count,
          (SELECT COUNT(*)::int FROM orders WHERE location_id = $1) AS orders_count,
          (SELECT COUNT(*)::int FROM sales WHERE location_id = $1) AS sales_count`,
      [locationId]
    );

    const stats = usage.rows[0];
    const inUse =
      Number(stats.users_count) > 0 ||
      Number(stats.inventory_count) > 0 ||
      Number(stats.orders_count) > 0 ||
      Number(stats.sales_count) > 0;

    if (inUse) {
      return res.status(409).json({
        error: 'Location cannot be deleted because it is referenced by users or historical data',
        usage: stats,
      });
    }

    const result = await pool.query('DELETE FROM locations WHERE id = $1 RETURNING id', [locationId]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Location not found' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('Delete location error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users?location_id=<id>
// manager: can only see users in their own location
// owner: can see all, or filter by location
router.get('/users', authorize('manager', 'owner'), async (req, res) => {
  try {
    const params = [];
    let whereClause = '';

    if (req.user.role === 'manager') {
      params.push(req.user.location_id);
      whereClause = `WHERE u.location_id = $${params.length}`;
    } else if (req.query.location_id) {
      const locationId = parsePositiveInteger(req.query.location_id);
      if (!locationId) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
      }

      params.push(locationId);
      whereClause = `WHERE u.location_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.location_id, u.created_at,
              l.name AS location_name
       FROM users u
       LEFT JOIN locations l ON u.location_id = l.id
       ${whereClause}
       ORDER BY u.name`,
      params
    );

    return res.json({ users: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users  — manager/owner
router.post('/users', authorize('manager', 'owner'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim();
  const password = String(req.body.password || '');
  const role = String(req.body.role || 'waiter').trim().toLowerCase();

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${ALL_ROLES.join(', ')}` });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  let locationId = null;

  if (req.user.role === 'manager') {
    if (!MANAGER_ASSIGNABLE_ROLES.includes(role)) {
      return res.status(403).json({ error: `Managers can only create: ${MANAGER_ASSIGNABLE_ROLES.join(', ')}` });
    }
    locationId = req.user.location_id;
  } else if (role !== 'owner') {
    locationId = parsePositiveInteger(req.body.location_id);
    if (!locationId) {
      return res.status(400).json({ error: 'location_id is required for non-owner users' });
    }
  }

  try {
    if (locationId && !(await locationExists(locationId))) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcryptjs.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, location_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, location_id, created_at`,
      [name, email, passwordHash, role, locationId]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id  — manager/owner
router.patch('/users/:id', authorize('manager', 'owner'), async (req, res) => {
  const userId = parsePositiveInteger(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  try {
    const found = await pool.query(
      'SELECT id, name, email, role, location_id FROM users WHERE id = $1',
      [userId]
    );

    if (!found.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const target = found.rows[0];

    if (req.user.role === 'manager') {
      if (target.role === 'owner') {
        return res.status(403).json({ error: 'Managers cannot modify owners' });
      }

      if (Number(target.location_id) !== Number(req.user.location_id)) {
        return res.status(403).json({ error: 'Managers can only modify users in their own location' });
      }

      if (target.role === 'manager' && Number(target.id) !== Number(req.user.id)) {
        return res.status(403).json({ error: 'Managers cannot modify other managers' });
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'location_id')) {
        return res.status(403).json({ error: 'Managers cannot change user location' });
      }

      if (
        Object.prototype.hasOwnProperty.call(req.body, 'role') &&
        !MANAGER_ASSIGNABLE_ROLES.includes(String(req.body.role || '').toLowerCase())
      ) {
        return res.status(403).json({ error: `Managers can only assign: ${MANAGER_ASSIGNABLE_ROLES.join(', ')}` });
      }
    }

    let nextRole = target.role;
    if (Object.prototype.hasOwnProperty.call(req.body, 'role')) {
      const requestedRole = String(req.body.role || '').trim().toLowerCase();
      if (!ALL_ROLES.includes(requestedRole)) {
        return res.status(400).json({ error: `role must be one of: ${ALL_ROLES.join(', ')}` });
      }
      nextRole = requestedRole;
    }

    let nextLocation = target.location_id;
    if (Object.prototype.hasOwnProperty.call(req.body, 'location_id')) {
      if (req.body.location_id === null || req.body.location_id === '') {
        nextLocation = null;
      } else {
        const parsedLocationId = parsePositiveInteger(req.body.location_id);
        if (!parsedLocationId) {
          return res.status(400).json({ error: 'location_id must be a positive integer or null' });
        }
        nextLocation = parsedLocationId;
      }
    }

    if (req.user.role === 'manager') {
      nextLocation = req.user.location_id;
    }

    if (nextRole === 'owner') {
      nextLocation = null;
    } else if (!nextLocation) {
      return res.status(400).json({ error: 'location_id is required for non-owner users' });
    }

    if (nextLocation && !(await locationExists(nextLocation))) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const updates = [];
    const params = [];

    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const nextName = String(req.body.name || '').trim();
      if (!nextName) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      params.push(nextName);
      updates.push(`name = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      const nextEmail = String(req.body.email || '').trim();
      if (!nextEmail) {
        return res.status(400).json({ error: 'email cannot be empty' });
      }

      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
        [nextEmail, userId]
      );
      if (emailCheck.rows.length) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }

      params.push(nextEmail);
      updates.push(`email = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'role') && nextRole !== target.role) {
      params.push(nextRole);
      updates.push(`role = $${params.length}`);
    }

    if (nextLocation !== target.location_id) {
      params.push(nextLocation);
      updates.push(`location_id = $${params.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
      const nextPassword = String(req.body.password || '');
      if (nextPassword.length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
      }
      const nextHash = await bcryptjs.hash(nextPassword, 10);
      params.push(nextHash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ error: 'No changes submitted' });
    }

    params.push(userId);

    const result = await pool.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, name, email, role, location_id, created_at`,
      params
    );

    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id  — manager/owner
router.delete('/users/:id', authorize('manager', 'owner'), async (req, res) => {
  const userId = parsePositiveInteger(req.params.id);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid user id' });
  }

  if (Number(userId) === Number(req.user.id)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const found = await pool.query('SELECT id, role, location_id FROM users WHERE id = $1', [userId]);
    if (!found.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const target = found.rows[0];

    if (req.user.role === 'manager') {
      if (Number(target.location_id) !== Number(req.user.location_id)) {
        return res.status(403).json({ error: 'Managers can only delete users in their own location' });
      }

      if (!MANAGER_ASSIGNABLE_ROLES.includes(target.role)) {
        return res.status(403).json({ error: `Managers can only delete: ${MANAGER_ASSIGNABLE_ROLES.join(', ')}` });
      }
    }

    if (target.role === 'owner') {
      const ownerCount = await pool.query('SELECT COUNT(*)::int AS count FROM users WHERE role = $1', ['owner']);
      if (Number(ownerCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last owner account' });
      }
    }

    const waiterOrders = await pool.query('SELECT COUNT(*)::int AS count FROM orders WHERE waiter_id = $1', [userId]);
    if (Number(waiterOrders.rows[0].count) > 0) {
      return res.status(409).json({
        error: 'User cannot be deleted because they are referenced by existing orders',
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
