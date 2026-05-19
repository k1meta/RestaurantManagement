-- ============================================================
-- CS308 Restaurant Management App — Database Schema
-- Run this file once to set up the database:
--   psql -U postgres -d restaurant_db -f schema.sql
-- ============================================================

-- Roles: owner | manager | waiter | kitchen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('owner', 'manager', 'waiter', 'kitchen');
  END IF;
END $$;

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

-- Canonical ingredient catalog
CREATE TABLE IF NOT EXISTS ingredients (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) UNIQUE NOT NULL,
  default_unit VARCHAR(30),
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

-- Backward-compatible migration path for normalized ingredient linkage
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS ingredient_id INT REFERENCES ingredients(id);

-- Ensure legacy free-text inventory rows are linked to ingredient catalog
INSERT INTO ingredients (name, default_unit)
SELECT DISTINCT TRIM(i.ingredient), NULLIF(TRIM(i.unit), '')
FROM inventory i
WHERE TRIM(i.ingredient) <> ''
ON CONFLICT (name) DO NOTHING;

UPDATE inventory i
SET ingredient_id = ing.id
FROM ingredients ing
WHERE i.ingredient_id IS NULL
  AND LOWER(TRIM(i.ingredient)) = LOWER(ing.name);

-- New uniqueness model for normalized inventory
CREATE UNIQUE INDEX IF NOT EXISTS inventory_location_ingredient_id_unique
ON inventory (location_id, ingredient_id)
WHERE ingredient_id IS NOT NULL;

-- Stock thresholds (manager-defined; optional until set via UI or backfill)
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS full_stock_target NUMERIC(10, 2);

UPDATE inventory
SET full_stock_target = COALESCE(
  full_stock_target,
  GREATEST(50::numeric, ROUND(quantity * 2)::numeric)
);

UPDATE inventory
SET low_stock_threshold = COALESCE(
  low_stock_threshold,
  ROUND(full_stock_target * 0.35)::numeric
);

-- Menu item ingredient requirements (mandatory for manager menu creation/update)
CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id                SERIAL PRIMARY KEY,
  menu_item_id      INT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  ingredient_id     INT NOT NULL REFERENCES ingredients(id),
  quantity_required NUMERIC(10, 2) NOT NULL CHECK (quantity_required > 0),
  unit              VARCHAR(30),
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE (menu_item_id, ingredient_id)
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
