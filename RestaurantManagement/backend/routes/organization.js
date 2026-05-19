const express = require('express');
const bcryptjs = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const { db, nextSequence } = require('../config/db');
const { byNameAsc, listCollection, getById } = require('../utils/firestoreStore');

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
  const location = await getById('locations', locationId);
  return Boolean(location);
}

async function findUserByEmail(email, excludeId = null) {
  const normalized = String(email).trim().toLowerCase();
  const snap = await db.collection('users').where('email_lc', '==', normalized).get();
  const users = snap.docs.map((doc) => doc.data());
  if (excludeId == null) {
    return users[0] || null;
  }
  return users.find((entry) => Number(entry.id) !== Number(excludeId)) || null;
}

// GET /api/locations
router.get('/locations', async (req, res) => {
  try {
    if (req.user.role === 'owner') {
      const locations = (await listCollection('locations')).sort(byNameAsc);
      return res.json({ locations });
    }

    const location = await getById('locations', req.user.location_id);
    return res.json({ locations: location ? [location] : [] });
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
    const id = await nextSequence('locations');
    const location = {
      id,
      name,
      address: address || null,
      created_at: new Date().toISOString(),
    };
    await db.collection('locations').doc(String(id)).set(location);
    return res.status(201).json({ location });
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

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Location name cannot be empty' });
    }
    updates.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'address')) {
    const address = req.body.address ? String(req.body.address).trim() : null;
    updates.address = address || null;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const ref = db.collection('locations').doc(String(locationId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await ref.set(updates, { merge: true });
    const updated = (await ref.get()).data();
    return res.json({ location: updated });
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
    const [users, inventory, orders, sales] = await Promise.all([
      listCollection('users'),
      listCollection('inventory'),
      listCollection('orders'),
      listCollection('sales'),
    ]);

    const stats = {
      users_count: users.filter((u) => Number(u.location_id) === locationId).length,
      inventory_count: inventory.filter((i) => Number(i.location_id) === locationId).length,
      orders_count: orders.filter((o) => Number(o.location_id) === locationId).length,
      sales_count: sales.filter((s) => Number(s.location_id) === locationId).length,
    };

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

    const deleted = await db.collection('locations').doc(String(locationId)).get();
    if (!deleted.exists) {
      return res.status(404).json({ error: 'Location not found' });
    }

    await db.collection('locations').doc(String(locationId)).delete();
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete location error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users?location_id=<id>
router.get('/users', authorize('manager', 'owner'), async (req, res) => {
  try {
    let users = await listCollection('users');
    const locations = await listCollection('locations');
    const locationNameById = new Map(locations.map((l) => [Number(l.id), l.name]));

    if (req.user.role === 'manager') {
      users = users.filter((u) => Number(u.location_id) === Number(req.user.location_id));
    } else if (req.query.location_id) {
      const locationId = parsePositiveInteger(req.query.location_id);
      if (!locationId) {
        return res.status(400).json({ error: 'location_id must be a positive integer' });
      }
      users = users.filter((u) => Number(u.location_id) === locationId);
    }

    users.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

    return res.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        location_id: u.location_id ?? null,
        created_at: u.created_at || null,
        location_name: u.location_id ? locationNameById.get(Number(u.location_id)) || null : null,
      })),
    });
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

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = await nextSequence('users');
    const passwordHash = await bcryptjs.hash(password, 10);
    const user = {
      id,
      name,
      email: email.toLowerCase(),
      email_lc: email.toLowerCase(),
      password_hash: passwordHash,
      role,
      location_id: role === 'owner' ? null : locationId,
      created_at: new Date().toISOString(),
    };

    await db.collection('users').doc(String(id)).set(user);

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        location_id: user.location_id,
        created_at: user.created_at,
      },
    });
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
    const target = await getById('users', userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    let nextLocation = target.location_id ?? null;
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

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'name')) {
      const nextName = String(req.body.name || '').trim();
      if (!nextName) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      updates.name = nextName;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      const nextEmail = String(req.body.email || '').trim().toLowerCase();
      if (!nextEmail) {
        return res.status(400).json({ error: 'email cannot be empty' });
      }
      const emailCheck = await findUserByEmail(nextEmail, userId);
      if (emailCheck) {
        return res.status(409).json({ error: 'Email already in use by another user' });
      }
      updates.email = nextEmail;
      updates.email_lc = nextEmail;
    }

    if (nextRole !== target.role) {
      updates.role = nextRole;
    }
    if (nextLocation !== target.location_id) {
      updates.location_id = nextLocation;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'password')) {
      const nextPassword = String(req.body.password || '');
      if (nextPassword.length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
      }
      updates.password_hash = await bcryptjs.hash(nextPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No changes submitted' });
    }

    const ref = db.collection('users').doc(String(userId));
    await ref.set(updates, { merge: true });
    const updated = (await ref.get()).data();

    return res.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        location_id: updated.location_id ?? null,
        created_at: updated.created_at || null,
      },
    });
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
    const target = await getById('users', userId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user.role === 'manager') {
      if (Number(target.location_id) !== Number(req.user.location_id)) {
        return res.status(403).json({ error: 'Managers can only delete users in their own location' });
      }
      if (!MANAGER_ASSIGNABLE_ROLES.includes(target.role)) {
        return res.status(403).json({ error: `Managers can only delete: ${MANAGER_ASSIGNABLE_ROLES.join(', ')}` });
      }
    }

    if (target.role === 'owner') {
      const users = await listCollection('users');
      const ownerCount = users.filter((u) => u.role === 'owner').length;
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last owner account' });
      }
    }

    const orders = await listCollection('orders');
    if (orders.some((o) => Number(o.waiter_id) === userId)) {
      return res.status(409).json({
        error: 'User cannot be deleted because they are referenced by existing orders',
      });
    }

    await db.collection('users').doc(String(userId)).delete();
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
