# Backend Testing Documentation

Restaurant Management API — test suite for CS308 requirements (≥70% unit coverage + ~10 E2E tests).

## How to Run

```bash
cd RestaurantManagement/backend
npm test                 # all tests + coverage report
npm run test:unit        # unit tests only
npm run test:integration # integration tests only
npm run test:e2e         # E2E workflow tests only
```

**Latest run:** 106 tests passed | **71.74% line coverage** (threshold: 70%)

---

## 1. Testing Tools and Frameworks

| Tool | Purpose | Why selected |
|------|---------|--------------|
| **Jest 29** | Test runner, assertions, coverage | Industry standard for Node.js; built-in `--coverage` enforces the 70% threshold via `jest.config.js` |
| **Supertest 7** | HTTP integration/E2E | Sends requests to Express without starting a server; natural fit for REST API testing |
| **In-memory Firestore mock** | Database isolation | No Firebase credentials or emulator required; full control over seed data and side-effect assertions |

### Standards followed

- **AAA pattern** (Arrange / Act / Assert) in every test
- **Shared fixtures** (`__tests__/helpers/fixtures.js`) — users per role, locations, menu, inventory
- **Reusable helpers** — `setupTestDb()`, `asUser(role)`, `api()` (Supertest wrapper)
- **Proper assertions** — HTTP status, response body shape, and mock DB state after mutations
- **Positive and negative cases** for validation, authentication, and RBAC
- **Serial execution** (`maxWorkers: 1`) — shared in-memory DB mock requires sequential test files

Page Object Model (POM) is not applicable — this is a backend API, not a browser UI.

---

## 2. Test Implementation Structure

```
backend/
├── app.js                          # Express app (exported for tests)
├── server.js                       # Production entry (seed + listen)
├── jest.config.js
├── jest.setup.js                   # Mocks config/db → in-memory Firestore
├── __tests__/
│   ├── helpers/
│   │   ├── mockFirestore.js        # In-memory Firestore + nextSequence
│   │   ├── fixtures.js             # Default seed data + auth helpers
│   │   └── testApp.js              # Supertest + setupTestDb()
│   ├── unit/                       # Pure logic (4 files, 24 tests)
│   ├── integration/                # Route tests (6 files, 69 tests)
│   └── e2e/
│       └── apiWorkflows.test.js    # 10 multi-step workflows
└── TESTING.md
```

### Mock strategy

`jest.setup.js` replaces `config/db` with `mockFirestore.js`. Routes use the same `db` interface (`collection`, `doc`, `get`, `set`, `where`, `runTransaction`). Tests seed data via `setupTestDb()` before each test. Default seed includes owner, manager, waiter, kitchen users (password: `password123`), two active locations, menu items with BOM, inventory, and sample orders.

---

## 3. Test Cases

### Unit tests — `constants/unitConversion.js`

| ID | Functionality | Type | Expected | Actual |
|----|---------------|------|----------|--------|
| UC-01 | `toCanonical` grams | Positive | `{ dimension: 'mass', value: 500 }` | Pass |
| UC-02 | `toCanonical` Kg→grams | Positive | `{ dimension: 'mass', value: 2000 }` | Pass |
| UC-03 | `toCanonical` L→ml | Positive | `{ dimension: 'volume', value: 1000 }` | Pass |
| UC-04 | `toCanonical` pieces | Positive | `{ dimension: 'count', value: 3 }` | Pass |
| UC-05 | Invalid unit | Negative | `null` | Pass |
| UC-06 | Invalid quantity | Negative | `null` | Pass |
| UC-07 | `fromCanonical` round-trip | Positive | Correct inverse values | Pass |
| UC-08 | Same-dimension deduction | Positive | `{ ok: true, nextQty: 1.5 }` | Pass |
| UC-09 | Cross-dimension units | Negative | `incompatible_units` | Pass |
| UC-10 | Insufficient stock | Negative | `insufficient_stock` | Pass |
| UC-11 | Missing unit | Negative | `missing_unit` | Pass |
| UC-12 | `roundQty` precision | Positive | 4-decimal rounding | Pass |

### Unit tests — `constants/units.js`

| ID | Functionality | Type | Expected | Actual |
|----|---------------|------|----------|--------|
| UU-01 | Valid unit `Kg` | Positive | `{ ok: true, value: 'Kg' }` | Pass |
| UU-02 | Empty/null unit | Positive | `{ ok: true, value: null }` | Pass |
| UU-03 | Invalid unit `lbs` | Negative | `{ ok: false, error: ... }` | Pass |

### Unit tests — `middleware/auth.js`

| ID | Functionality | Type | Expected | Actual |
|----|---------------|------|----------|--------|
| MW-01 | Valid Bearer token | Positive | `next()` called, `req.user` set | Pass |
| MW-02 | Missing Authorization | Negative | 401 | Pass |
| MW-03 | Malformed scheme | Negative | 401 | Pass |
| MW-04 | Invalid JWT | Negative | 403 | Pass |
| MW-05 | `authorize('owner')` with owner | Positive | `next()` | Pass |
| MW-06 | `authorize('owner')` with waiter | Negative | 403 | Pass |

### Unit tests — `utils/firestoreStore.js`

| ID | Functionality | Type | Expected | Actual |
|----|---------------|------|----------|--------|
| FS-01 | `toNumber('42')` | Positive | `42` | Pass |
| FS-02 | `toNumber('abc')` | Negative | `null` | Pass |
| FS-03 | `getById` invalid id | Negative | `null` | Pass |
| FS-04 | `roleRank` ordering | Positive | owner < manager < waiter < kitchen | Pass |
| FS-05 | Sort helpers | Positive | Correct order | Pass |
| FS-06 | `getById` existing doc | Positive | Document data | Pass |

### Integration — Auth (`/api/auth`)

| ID | Endpoint | Type | Expected | Actual |
|----|----------|------|----------|--------|
| AU-01 | POST `/login` | Positive | 200 + token | Pass |
| AU-02 | POST `/login` | Negative | 401 wrong password | Pass |
| AU-03 | POST `/login` | Negative | 400 missing fields | Pass |
| AU-04 | POST `/api/users` (manager) | Positive | 201 new waiter | Pass |
| AU-05 | POST `/api/users` | Negative | 409 duplicate email | Pass |
| AU-06 | POST `/api/users` | Negative | 403 manager→owner | Pass |
| AU-07 | POST `/api/users` (owner) | Negative | 404 bad location | Pass |
| AU-08 | GET `/me` | Positive | 200 user payload | Pass |
| AU-09 | GET `/me` | Negative | 401 no token | Pass |
| AU-10 | PATCH `/language` | Positive/Negative | 200 / 400 | Pass |
| AU-11 | GET `/login-profiles` (enabled) | Positive | 200 sorted by role | Pass |
| AU-12 | GET `/login-profiles` (disabled) | Negative | 404 not found | Pass |
| AU-13 | POST `/api/users` | Negative | 401 no token | Pass |
| AU-14 | POST `/auth/register` | Negative | 404 route removed | Pass |

### Integration — Organization (`/api/locations`, `/api/users`)

| ID | Endpoint | Type | Expected | Actual |
|----|----------|------|----------|--------|
| OR-01 | GET `/locations` | Positive | Owner all / waiter scoped | Pass |
| OR-02 | POST `/locations` | Positive | 201 | Pass |
| OR-03 | POST `/locations` | Negative | 403 manager | Pass |
| OR-04 | POST `/locations` | Negative | 400 empty name | Pass |
| OR-05 | PATCH `/locations/:id` | Positive/Negative | 200 / 400 / 404 | Pass |
| OR-06 | DELETE `/locations/:id` | Negative | 409 in use | Pass |
| OR-07 | DELETE `/locations/:id` | Positive | 200 success | Pass |
| OR-08 | GET `/users` | Positive | Filtered by location | Pass |
| OR-09 | GET `/users` | Negative | 403 waiter | Pass |
| OR-10 | POST `/users` | Positive | 201 manager creates waiter | Pass |
| OR-11 | POST `/users` | Negative | 403 manager→manager | Pass |
| OR-12 | POST `/users` | Negative | 400 short password | Pass |
| OR-13 | PATCH `/users/:id` | Negative | 403 cross-manager | Pass |
| OR-14 | PATCH `/users/:id` | Negative | 403 modify owner | Pass |
| OR-15 | DELETE `/users/:id` | Positive/Negative | 200 delete / 400 self-delete | Pass |

### Integration — Inventory (`/api/inventory`)

| ID | Endpoint | Type | Expected | Actual |
|----|----------|------|----------|--------|
| IN-01 | GET `/` | Positive | Location-scoped rows | Pass |
| IN-02 | POST `/` | Positive | 201 with ingredient_id | Pass |
| IN-03 | POST `/` | Positive | 201 auto-create ingredient | Pass |
| IN-04 | POST `/` | Negative | 400 threshold pair | Pass |
| IN-05 | POST `/` | Negative | 400 invalid unit | Pass |
| IN-06 | POST `/` | Negative | 403 waiter | Pass |
| IN-07 | PATCH `/:id` | Positive/Negative | 200 / 404 | Pass |
| IN-08 | DELETE `/:id` | Positive | 200 | Pass |
| IN-09 | POST `/ingredients` | Positive | 201 / upsert duplicate | Pass |
| IN-10 | DELETE `/ingredients/:id` | Negative | 409 referenced | Pass |

### Integration — Menu & Sales (`/api/menu`, `/api/sales`)

| ID | Endpoint | Type | Expected | Actual |
|----|----------|------|----------|--------|
| MS-01 | GET `/menu` | Positive | Active items only (waiter) | Pass |
| MS-02 | GET `/menu?include_inactive` | Positive | Manager sees inactive | Pass |
| MS-03 | GET `/menu?include_inactive` | Negative | Waiter still filtered | Pass |
| MS-04 | POST `/menu` | Positive | 201 with BOM | Pass |
| MS-05 | POST `/menu` | Negative | 400 missing ingredients | Pass |
| MS-06 | POST `/menu` | Negative | 400 conflicting units | Pass |
| MS-07 | PATCH `/menu/:id/price` | Positive/Negative | 200 / 400 | Pass |
| MS-08 | PATCH `/menu/:id/active` | Positive | 200 toggle | Pass |
| MS-09 | DELETE `/menu/:id` | Negative | 409 in use | Pass |
| MS-10 | GET `/sales` | Positive | Correct revenue totals | Pass |
| MS-11 | GET `/sales` | Negative | 403 waiter | Pass |
| MS-12 | GET `/sales?location_id` | Positive | Owner location filter | Pass |

### Integration — Orders (`/api/orders`)

| ID | Endpoint | Type | Expected | Actual |
|----|----------|------|----------|--------|
| OD-01 | POST `/` | Positive | 201 pending order | Pass |
| OD-02 | POST `/` | Negative | 400 empty items | Pass |
| OD-03 | POST `/` | Negative | Inactive menu item error | Pass |
| OD-04 | POST `/` | Negative | 403 kitchen | Pass |
| OD-05 | GET `/` | Positive | Status filter works | Pass |
| OD-06 | GET `/:id` | Negative | 403 cross-location | Pass |
| OD-07 | PATCH `/:id/status` | Positive | Kitchen → preparing | Pass |
| OD-08 | PATCH `/:id/status` | Negative | 403 waiter → preparing | Pass |
| OD-09 | PATCH `/:id/status` | Positive | Kitchen → ready | Pass |
| OD-10 | PATCH `/:id/status` | Negative | 409 waiter closes non-ready | Pass |
| OD-11 | PATCH `/:id/status` | Positive | Waiter closes ready order | Pass |
| OD-12 | PATCH `/:id/status` | Positive | Inventory deducted on close | Pass |
| OD-13 | PATCH `/:id/status` | Positive | Sales rows created | Pass |
| OD-14 | PATCH `/:id/status` | Negative | 409 insufficient stock | Pass |
| OD-15 | PATCH `/:id/status` | Negative | 403 waiter rollback | Pass |
| OD-16 | PATCH `/:id/status` | Negative | 400 invalid status | Pass |

### Integration — Server health

| ID | Functionality | Type | Expected | Actual |
|----|---------------|------|----------|--------|
| SV-01 | GET `/health` | Positive | 200 `{ status: 'ok' }` | Pass |
| SV-02 | Unknown route | Negative | 404 JSON error | Pass |

### E2E workflows (`__tests__/e2e/apiWorkflows.test.js`)

| ID | Workflow | Steps | Expected | Actual |
|----|----------|-------|----------|--------|
| E2E-01 | Staff onboarding | Login → create location → create manager | Full chain succeeds | Pass |
| E2E-02 | Menu setup | Ingredient → inventory → menu BOM | Linked records created | Pass |
| E2E-03 | Order lifecycle | Create → preparing → ready → closed | Status machine end-to-end | Pass |
| E2E-04 | Inventory deduction | Close order → verify stock reduced | Quantity decreased | Pass |
| E2E-05 | Sales reporting | Close order → GET `/sales` | Revenue > 0 | Pass |
| E2E-06 | RBAC enforcement | Waiter tries admin endpoints | All 403 | Pass |
| E2E-07 | Manager user CRUD | Create → update → delete waiter | Manager-scoped success | Pass |
| E2E-08 | Cross-location isolation | Waiter A reads Waiter B order | 403 | Pass |
| E2E-09 | Location delete guard | Delete location with users | 409 + usage stats | Pass |
| E2E-10 | Duplicate line merge | Order with duplicate menu_item_id | Quantities merged | Pass |

---

## 4. Coverage Summary

| Layer | Line coverage (approx.) |
|-------|-------------------------|
| `middleware/auth.js` | 100% |
| `constants/` | ~85% |
| `routes/orders.js` | ~89% |
| `routes/auth.js` | ~84% |
| `routes/inventory.js` | ~77% |
| `routes/organization.js` | ~69% |
| `routes/menuAndSales.js` | ~67% |
| `utils/firestoreStore.js` | ~69% |
| **Global** | **71.81%** |

Excluded from coverage: `scripts/`, `functions/`, real `config/db.js` Firebase init (mocked in tests).

---

## 5. Test credentials (fixtures)

| Role | Email | Password |
|------|-------|----------|
| Owner | owner@restaurant.com | password123 |
| Manager | manager@restaurant.com | password123 |
| Waiter | waiter@restaurant.com | password123 |
| Kitchen | kitchen@restaurant.com | password123 |
