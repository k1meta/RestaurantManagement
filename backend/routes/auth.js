const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Demo users (until database is connected)
const DEMO_USERS = {
  'owner@restaurant.com': {
    id: 1,
    name: 'Owner Ali',
    email: 'owner@restaurant.com',
    password: 'password123',
    role: 'owner',
    location_id: 1
  },
  'manager@restaurant.com': {
    id: 2,
    name: 'Manager Sara',
    email: 'manager@restaurant.com',
    password: 'password123',
    role: 'manager',
    location_id: 1
  },
  'waiter@restaurant.com': {
    id: 3,
    name: 'Waiter Tom',
    email: 'waiter@restaurant.com',
    password: 'password123',
    role: 'waiter',
    location_id: 1
  },
  'kitchen@restaurant.com': {
    id: 4,
    name: 'Chef Marco',
    email: 'kitchen@restaurant.com',
    password: 'password123',
    role: 'kitchen',
    location_id: 1
  }
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = DEMO_USERS[email];

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, location_id: user.location_id },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, role = 'waiter', location_id = 1 } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  try {
    // Check if user already exists
    if (DEMO_USERS[email]) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // For demo purposes, just create user in memory
    const newUser = {
      id: Object.keys(DEMO_USERS).length + 1,
      name,
      email,
      password,
      role,
      location_id
    };

    DEMO_USERS[email] = newUser;

    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, location_id: newUser.location_id },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
