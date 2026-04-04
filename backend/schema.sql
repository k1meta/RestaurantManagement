-- ============================================================
-- CS308 Restaurant Management App — Database Schema
-- Run this file once to set up the database:
--   psql -U postgres -d restaurant_db -f schema.sql
-- ============================================================

-- Roles: owner | manager | waiter | kitchen
CREATE TYPE user_role AS ENUM ('owner', 'manager', 'waiter', 'kitchen');

-- Restaurant locations
CREATE TABLE IF NOT EXISTS locations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  address     VARCHAR(255),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Staff accounts
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          user_role NOT NULL DEFAULT 'waiter',
  location_id   INT REFERENCES locations(id),   -- NULL for owner (all locations)
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Menu items (shared across all locations)
CREATE TABLE IF NOT EXISTS menu_items (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  category    VARCHAR(100),                     -- e.g. 'food', 'drink', 'bakery'
  price       NUMERIC(8, 2) NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Inventory ingredients per location
CREATE TABLE IF NOT EXISTS inventory (
  id            SERIAL PRIMARY KEY,
  location_id   INT NOT NULL REFERENCES locations(id),
  ingredient    VARCHAR(150) NOT NULL,
  quantity      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unit          VARCHAR(30),                    -- e.g. 'kg', 'litre', 'pcs'
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (location_id, ingredient)
);

-- Customer orders
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  location_id   INT NOT NULL REFERENCES locations(id),
  waiter_id     INT NOT NULL REFERENCES users(id),
  table_number  VARCHAR(20),
  status        VARCHAR(30) DEFAULT 'pending',  -- pending | preparing | ready | closed
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW(),
  closed_at     TIMESTAMP
);

-- Individual items inside an order
CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id  INT NOT NULL REFERENCES menu_items(id),
  quantity      INT NOT NULL DEFAULT 1,
  unit_price    NUMERIC(8, 2) NOT NULL          -- snapshot of price at order time
);

-- Sales log (auto-updated when an order is closed)
CREATE TABLE IF NOT EXISTS sales (
  id            SERIAL PRIMARY KEY,
  location_id   INT NOT NULL REFERENCES locations(id),
  menu_item_id  INT NOT NULL REFERENCES menu_items(id),
  order_id      INT NOT NULL REFERENCES orders(id),
  quantity      INT NOT NULL,
  total_price   NUMERIC(10, 2) NOT NULL,
  sold_at       TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Seed: one demo location + one user per role
-- Passwords are all "password123" (bcrypt hash below)
-- ============================================================
INSERT INTO locations (name, address) VALUES
  ('Downtown Branch', '123 Main St'),
  ('Uptown Branch',   '456 Hill Ave')
ON CONFLICT DO NOTHING;

-- bcrypt hash of "password123" with saltRounds=10
INSERT INTO users (name, email, password_hash, role, location_id) VALUES
  ('Owner Ali',    'owner@restaurant.com',   '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'owner',   NULL),
  ('Manager Sara', 'manager@restaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'manager', 1),
  ('Waiter Tom',   'waiter@restaurant.com',  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'waiter',  1),
  ('Chef Marco',   'kitchen@restaurant.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'kitchen', 1)
ON CONFLICT DO NOTHING;

INSERT INTO menu_items (name, category, price) VALUES
  ('Margherita Pizza', 'food',    12.50),
  ('Caesar Salad',     'food',     8.00),
  ('Croissant',        'bakery',   3.50),
  ('Espresso',         'drink',    2.50),
  ('Orange Juice',     'drink',    4.00)
ON CONFLICT DO NOTHING;
