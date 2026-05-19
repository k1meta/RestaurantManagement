const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
const { db, nextSequence } = require('../config/db');
const { roleRank, getById } = require('../utils/firestoreStore');

const router = express.Router();
const REGISTERABLE_ROLES = ['manager', 'waiter', 'kitchen'];

function userPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    location_id: user.location_id ?? null,
  };
}

function issueToken(user) {
  return jwt.sign(userPayload(user), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// GET /api/auth/login-profiles
router.get('/login-profiles', async (_req, res) => {
  try {
    const snap = await db.collection('users').get();
    const profiles = snap.docs
      .map((doc) => doc.data())
      .map((user) => userPayload(user))
      .sort((a, b) => {
        const rankDiff = roleRank(a.role) - roleRank(b.role);
        if (rankDiff !== 0) return rankDiff;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });

    res.json({ profiles });
  } catch (err) {
    console.error('Get login profiles error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const match = await db
      .collection('users')
      .where('email_lc', '==', normalizedEmail)
      .limit(1)
      .get();

    if (match.empty) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = match.docs[0].data();
    const validPassword = await bcryptjs.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);
    return res.json({
      token,
      user: userPayload(user),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'waiter', location_id = 1 } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!REGISTERABLE_ROLES.includes(role)) {
    return res.status(400).json({
      error: `Role must be one of: ${REGISTERABLE_ROLES.join(', ')}`,
    });
  }

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();
    const parsedLocation = Number(location_id);
    if (!Number.isInteger(parsedLocation) || parsedLocation <= 0) {
      return res.status(400).json({ error: 'location_id must be a positive integer' });
    }

    const locationSnap = await db.collection('locations').doc(String(parsedLocation)).get();
    if (!locationSnap.exists) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const existing = await db
      .collection('users')
      .where('email_lc', '==', normalizedEmail)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = await nextSequence('users');
    const hashedPassword = await bcryptjs.hash(password, 10);
    const createdAt = new Date().toISOString();
    const user = {
      id,
      name: normalizedName,
      email: normalizedEmail,
      email_lc: normalizedEmail,
      password_hash: hashedPassword,
      role,
      location_id: parsedLocation,
      created_at: createdAt,
    };

    await db.collection('users').doc(String(id)).set(user);

    const token = issueToken(user);
    return res.status(201).json({
      token,
      user: userPayload(user),
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getById('users', req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user: userPayload(user) });
  } catch (err) {
    console.error('Get me error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
