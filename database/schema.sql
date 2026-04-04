-- Restaurant Management System - PostgreSQL Schema
-- CS308 Project | Team: Tarik Topalovic, Omer Becic, Emin Cenanovic

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Restaurants Table
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurants (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    phone       VARCHAR(50),
    email       VARCHAR(255),
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Users Table (role-based: owner, manager, waiter)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'waiter')),
    restaurant_id   INTEGER REFERENCES restaurants(id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Menu Items Table
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    price           NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    category        VARCHAR(100),
    is_available    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Orders Table
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    waiter_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
    table_number    INTEGER,
    status          VARCHAR(50) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'ready', 'delivered', 'closed')),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Order Items Table
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Inventory Table
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    quantity        NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit            VARCHAR(50),
    min_threshold   NUMERIC(10, 2) DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Inventory Logs Table (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_logs (
    id              SERIAL PRIMARY KEY,
    inventory_id    INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    changed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    change_amount   NUMERIC(10, 2) NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Sales Table
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
    id              SERIAL PRIMARY KEY,
    restaurant_id   INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_item_id    INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    quantity_sold   INTEGER NOT NULL CHECK (quantity_sold > 0),
    total_revenue   NUMERIC(10, 2) NOT NULL,
    sale_date       TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_restaurant ON users(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_restaurant ON inventory(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_inventory ON inventory_logs(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sales_restaurant ON sales(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
