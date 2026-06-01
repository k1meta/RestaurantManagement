const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');

/** bcrypt hash for "password123" (matches production seed). */
const PASSWORD_HASH =
  '$2a$10$hpll80mRzZrQW/1uxaj1dudQ3ONS6P4qDLvr0/17lWb3.HI4iljYS';

const DEFAULT_PASSWORD = 'password123';

const NOW = '2026-01-01T12:00:00.000Z';

function buildDefaultSeed() {
  const locations = [
    { id: 1, name: 'Downtown Branch', address: '123 Main St', created_at: NOW },
    { id: 2, name: 'Uptown Branch', address: '456 Hill Ave', created_at: NOW },
    { id: 3, name: 'Unused Branch', address: '789 Empty Rd', created_at: NOW },
  ];

  const users = [
    {
      id: 1,
      name: 'Owner Ali',
      email: 'owner@restaurant.com',
      email_lc: 'owner@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'owner',
      location_id: null,
      preferred_language: 'en',
      created_at: NOW,
    },
    {
      id: 2,
      name: 'Manager Sara',
      email: 'manager@restaurant.com',
      email_lc: 'manager@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'manager',
      location_id: 1,
      preferred_language: 'en',
      created_at: NOW,
    },
    {
      id: 3,
      name: 'Waiter Tom',
      email: 'waiter@restaurant.com',
      email_lc: 'waiter@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'waiter',
      location_id: 1,
      preferred_language: 'en',
      created_at: NOW,
    },
    {
      id: 4,
      name: 'Chef Marco',
      email: 'kitchen@restaurant.com',
      email_lc: 'kitchen@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'kitchen',
      location_id: 1,
      preferred_language: 'en',
      created_at: NOW,
    },
    {
      id: 5,
      name: 'Waiter Bob',
      email: 'waiter2@restaurant.com',
      email_lc: 'waiter2@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'waiter',
      location_id: 2,
      preferred_language: 'en',
      created_at: NOW,
    },
    {
      id: 6,
      name: 'Manager Two',
      email: 'manager2@restaurant.com',
      email_lc: 'manager2@restaurant.com',
      password_hash: PASSWORD_HASH,
      role: 'manager',
      location_id: 2,
      preferred_language: 'en',
      created_at: NOW,
    },
  ];

  const ingredients = [
    { id: 1, name: 'Tomato', default_unit: 'Kg', created_at: NOW },
    { id: 2, name: 'Cheese', default_unit: 'g', created_at: NOW },
    { id: 3, name: 'Olive Oil', default_unit: 'L', created_at: NOW },
  ];

  const inventory = [
    {
      id: 1,
      location_id: 1,
      ingredient_id: 1,
      ingredient: 'Tomato',
      quantity: 10,
      unit: 'Kg',
      low_stock_threshold: 2,
      full_stock_target: 20,
      updated_at: NOW,
    },
    {
      id: 2,
      location_id: 1,
      ingredient_id: 2,
      ingredient: 'Cheese',
      quantity: 5000,
      unit: 'g',
      updated_at: NOW,
    },
    {
      id: 3,
      location_id: 1,
      ingredient_id: 3,
      ingredient: 'Olive Oil',
      quantity: 5,
      unit: 'L',
      updated_at: NOW,
    },
  ];

  const menu_items = [
    {
      id: 1,
      name: 'Margherita Pizza',
      category: 'Pizza',
      price: 12.99,
      active: true,
      created_at: NOW,
    },
    {
      id: 2,
      name: 'Seasonal Special',
      category: 'Special',
      price: 15.99,
      active: false,
      created_at: NOW,
    },
  ];

  const menu_item_ingredients = [
    {
      id: 1,
      menu_item_id: 1,
      ingredient_id: 1,
      quantity_required: 0.2,
      unit: 'Kg',
      created_at: NOW,
    },
    {
      id: 2,
      menu_item_id: 1,
      ingredient_id: 2,
      quantity_required: 150,
      unit: 'g',
      created_at: NOW,
    },
  ];

  const orders = [
    {
      id: 1,
      location_id: 1,
      waiter_id: 3,
      table_number: '5',
      status: 'ready',
      notes: null,
      created_at: NOW,
      closed_at: null,
    },
    {
      id: 2,
      location_id: 2,
      waiter_id: 5,
      table_number: '2',
      status: 'pending',
      notes: null,
      created_at: NOW,
      closed_at: null,
    },
  ];

  const order_items = [
    {
      id: 1,
      order_id: 1,
      menu_item_id: 1,
      quantity: 2,
      unit_price: 12.99,
    },
  ];

  const counters = [
    { id: 'locations', value: 3 },
    { id: 'users', value: 6 },
    { id: 'menu_items', value: 2 },
    { id: 'ingredients', value: 3 },
    { id: 'inventory', value: 3 },
    { id: 'orders', value: 2 },
    { id: 'order_items', value: 1 },
    { id: 'sales', value: 0 },
    { id: 'menu_item_ingredients', value: 2 },
  ].map(({ id, value }) => ({ id, value }));

  return {
    locations,
    users,
    ingredients,
    inventory,
    menu_items,
    menu_item_ingredients,
    orders,
    order_items,
    sales: [],
    counters,
  };
}

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

function tokenFor(user) {
  return jwt.sign(userPayload(user), JWT_SECRET, { expiresIn: '24h' });
}

function authHeader(user) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

function getUserByRole(seed, role, locationId = 1) {
  if (role === 'owner') {
    return seed.users.find((u) => u.role === 'owner');
  }
  return seed.users.find((u) => u.role === role && Number(u.location_id) === Number(locationId));
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

module.exports = {
  PASSWORD_HASH,
  DEFAULT_PASSWORD,
  NOW,
  buildDefaultSeed,
  userPayload,
  tokenFor,
  authHeader,
  getUserByRole,
  hashPassword,
};
