const express = require('express');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/auth');
const { db } = require('../config/db');
const { roleRank, getById } = require('../utils/firestoreStore');

const router = express.Router();

function userPayload(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    location_id: user.location_id ?? null,
    preferred_language: user.preferred_language || 'en',
  };
}

function issueToken(user) {
  return jwt.sign(userPayload(user), JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// GET /api/auth/login-profiles — demo only when ENABLE_LOGIN_PROFILES=true
router.get('/login-profiles', async (_req, res) => {
  if (process.env.ENABLE_LOGIN_PROFILES !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }

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

// POST /api/auth/register — removed; staff creation uses POST /api/users (manager/owner)
router.post('/register', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
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

// PATCH /api/auth/language
router.patch('/language', authenticate, async (req, res) => {
  try {
    const { language } = req.body;
    if (!language || typeof language !== 'string') {
      return res.status(400).json({ error: 'Valid language is required' });
    }

    await db.collection('users').doc(String(req.user.id)).update({
      preferred_language: language
    });

    const user = await getById('users', req.user.id);
    return res.json({ user: userPayload(user) });
  } catch (err) {
    console.error('Update language error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
