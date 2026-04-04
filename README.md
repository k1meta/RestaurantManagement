# Restaurant Management App

**CS308 Project** — A full-stack restaurant management system supporting multi-location operations, role-based access, order tracking, inventory management, and sales analytics.

## Team Members

| Name | Student ID |
|------|-----------|
| Tarik Topalović | 230302248 |
| Omer Bećić | 220302287 |
| Emin Ćenanović | 230302206 |

---

## Project Overview

The Restaurant Management App helps manage multiple restaurant locations simultaneously by tracking staff, inventory, and orders. It provides role-based access for Owners, Managers, and Waiters — each with appropriate permissions — and gives the restaurant owner a centralized view of sales across all locations.

### Key Features

- **Multi-location support** — manage all restaurant branches from one system
- **Role-based access** — Owner, Manager, Waiter roles with scoped permissions
- **Order lifecycle** — create, track, and close orders in real time (<2s sync target)
- **Inventory management** — track ingredients, receive low-stock alerts, log changes
- **Sales analytics** — weekly/monthly/yearly sales overview per item and location
- **Menu management** — update prices and availability across locations

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Auth | JSON Web Tokens (JWT) |
| Containerization | Docker Compose |

---

## Project Structure

```
RestaurantManagement/
├── backend/                    # Node.js/Express API server
│   ├── config/
│   │   └── database.js         # PostgreSQL connection pool
│   ├── src/
│   │   ├── controllers/        # Business logic
│   │   ├── middleware/         # Auth, error handling
│   │   ├── models/             # Data access layer
│   │   ├── routes/             # API route definitions
│   │   └── services/          # Shared service utilities
│   ├── .env.example            # Environment variable template
│   ├── package.json
│   └── server.js               # Express app entry point
├── frontend/                   # React Native mobile app
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── screens/            # Screen components
│   │   ├── services/
│   │   │   └── api.js          # Axios API client
│   │   ├── styles/             # Shared styles
│   │   └── utils/              # Helper utilities
│   ├── App.js                  # Root navigation component
│   └── package.json
├── database/
│   └── schema.sql              # PostgreSQL schema definition
├── docker-compose.yml          # Local PostgreSQL setup
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9
- Docker & Docker Compose (for local database)
- React Native development environment ([guide](https://reactnative.dev/docs/environment-setup))

### 1. Start the Database

```bash
docker-compose up -d
```

This starts a PostgreSQL container on port `5432` and automatically runs `database/schema.sql` to create all tables.

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your settings
npm install
npm run dev
```

The API server starts at `http://localhost:3000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start          # Start Metro bundler
npm run android    # Run on Android
npm run ios        # Run on iOS
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `restaurant_management` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database password | — |
| `JWT_SECRET` | JWT signing secret | — |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Login and receive JWT | No |

### Restaurants

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/restaurants` | List all restaurants | All |
| GET | `/api/restaurants/:id` | Get restaurant by ID | All |
| POST | `/api/restaurants` | Create restaurant | Owner |
| PUT | `/api/restaurants/:id` | Update restaurant | Owner, Manager |
| DELETE | `/api/restaurants/:id` | Delete restaurant | Owner |

### Orders

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/orders` | List orders | All |
| GET | `/api/orders/:id` | Get order with items | All |
| POST | `/api/orders` | Create order | All |
| PUT | `/api/orders/:id/status` | Update order status | All |
| DELETE | `/api/orders/:id` | Delete order | Owner, Manager |

### Menu

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/menu` | List menu items | All |
| GET | `/api/menu/:id` | Get menu item | All |
| POST | `/api/menu` | Add menu item | Owner, Manager |
| PUT | `/api/menu/:id` | Update menu item | Owner, Manager |
| DELETE | `/api/menu/:id` | Delete menu item | Owner, Manager |

### Inventory

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/inventory` | List inventory items | All |
| GET | `/api/inventory/:id` | Get item | All |
| POST | `/api/inventory` | Add inventory item | Owner, Manager |
| PUT | `/api/inventory/:id` | Update quantity | Owner, Manager |
| GET | `/api/inventory/logs/:restaurantId` | Audit log | Owner, Manager |

### Sales

| Method | Endpoint | Description | Roles |
|--------|----------|-------------|-------|
| GET | `/api/sales` | All sales (period filter) | Owner, Manager |
| GET | `/api/sales/restaurant/:id` | Sales by restaurant | Owner, Manager |
| GET | `/api/sales/summary` | Aggregated summary | Owner, Manager |

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `restaurants` | Restaurant locations |
| `users` | Staff accounts with role (`owner`, `manager`, `waiter`) |
| `menu_items` | Menu per restaurant |
| `orders` | Order tickets with status lifecycle |
| `order_items` | Line items per order |
| `inventory` | Ingredient stock levels |
| `inventory_logs` | Audit trail for inventory changes |
| `sales` | Sales records per menu item |

### Order Status Flow

```
pending → in_progress → ready → delivered → closed
```

---

## User Roles & Permissions

| Permission | Waiter | Manager | Owner |
|-----------|--------|---------|-------|
| Create/view orders | ✅ | ✅ | ✅ |
| Update order status | ✅ | ✅ | ✅ |
| View menu | ✅ | ✅ | ✅ |
| Edit menu / prices | ❌ | ✅ | ✅ |
| View inventory | ❌ | ✅ | ✅ |
| Update inventory | ❌ | ✅ | ✅ |
| View sales reports | ❌ | ✅ (own location) | ✅ (all locations) |
| Manage restaurants | ❌ | ❌ | ✅ |
