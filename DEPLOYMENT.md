# Deployment Guide

Reproducible steps for **local development**, **production backend (Render)**, and **mobile (Expo EAS)**.

**Primary submission client:** Expo mobile app (native + optional Expo web). CRA web (`npm start` on port 3001) is an alternate desktop UI.

---

## Environment matrix

| Mode | Backend | Frontend env |
|------|---------|--------------|
| Local full stack | `http://localhost:3000` | `EXPO_PUBLIC_API_URL` and `REACT_APP_API_URL` = `http://localhost:3000` |
| Local UI → hosted API | Render URL | Both vars = your Render service URL |
| Production mobile | Render URL | Set in `eas.json` build profiles or EAS env vars |
| Production web (CRA) | Render URL | `REACT_APP_API_URL` at **build time** on your static host |

Copy env templates:

```powershell
Copy-Item .\RestaurantManagement\backend\.env.example .\RestaurantManagement\backend\.env
Copy-Item .\RestaurantManagement\frontend\.env.example .\RestaurantManagement\frontend\.env
```

---

## Production checklist (Render backend)

Set these in the Render service **Environment** tab:

| Variable | Required | Production value |
|----------|----------|------------------|
| `JWT_SECRET` | Yes | Long random string (unique per environment) |
| `FIREBASE_PROJECT_ID` | Yes | Your Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT_JSON` or `_B64` | Yes | Service account credentials |
| `ENABLE_LOGIN_PROFILES` | No | **Omit** or `false` (demo quick-login UI) |
| `CORS_ORIGINS` | Recommended | Comma-separated frontend origins, e.g. `http://localhost:8081,https://your-expo-web.host` |
| `NODE_ENV` | Optional | `production` |

Health check: `GET https://<your-service>.onrender.com/health`

Firestore setup details: [`RestaurantManagement/backend/FIRESTORE_SETUP.md`](RestaurantManagement/backend/FIRESTORE_SETUP.md)

---

## Backend — Render

1. Connect GitHub repo `k1meta/RestaurantManagement`.
2. **Root directory:** leave as repo root; **Start command** (adjust to your layout):

   ```bash
   cd RestaurantManagement/backend && npm install && npm start
   ```

3. Set production env vars from the table above.
4. After deploy, seed Firestore once (from your machine with credentials):

   ```powershell
   npm --prefix .\RestaurantManagement\backend run db:seed
   ```

**Demo logins after seed:** `owner@restaurant.com`, `manager@restaurant.com`, `waiter@restaurant.com`, `kitchen@restaurant.com` — password `password123`

---

## Mobile — Expo EAS

1. Install EAS CLI and log in: `npm i -g eas-cli && eas login`
2. Configure project ID in `frontend/app.json` if prompted by `eas init`.
3. API URL for cloud builds is in `frontend/eas.json` under each profile’s `env.EXPO_PUBLIC_API_URL`. Update when your Render URL changes, or override via [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).
4. Build APK (preview):

   ```powershell
   cd .\RestaurantManagement\frontend
   npm run build:android:apk
   ```

5. Local Expo Go against **local** API: set `frontend/.env` to `http://<your-LAN-IP>:3000` (phones cannot use `localhost`).

---

## Web — Create React App (optional)

1. Set `REACT_APP_API_URL` in `frontend/.env` to your API base URL.
2. Build and deploy static files:

   ```powershell
   cd .\RestaurantManagement\frontend
   npm run build
   ```

3. Host the `build/` folder (Netlify, Vercel, Render static site, etc.). Rebuild when the API URL changes.

**Expo web (Playwright E2E target):** port `8081` — `npm run start:mobile:web`. E2E credentials match seed data; requires backend running with seeded users.

---

## CI (GitHub Actions)

Workflow: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

- Backend: `npm test` with coverage threshold (70%)
- Frontend: unit tests only (`e2e/` excluded from Jest)

Run locally before push:

```powershell
npm --prefix .\RestaurantManagement\backend test
npm --prefix .\RestaurantManagement\frontend test -- --watchAll=false
```

Playwright (optional, manual):

```powershell
# Terminal 1: backend
npm --prefix .\RestaurantManagement\backend start

# Terminal 2: Expo web + tests
cd .\RestaurantManagement\frontend
npm run test:e2e
```

---

## CORS behavior

- **Development:** If `CORS_ORIGINS` is unset, all origins are allowed (easier local testing).
- **Production:** Set `CORS_ORIGINS` to every origin that serves your web UI (CRA port 3001, Expo web 8081, deployed hostnames).

Mobile native requests often send no `Origin` header and are still accepted when using an allowlist.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| CORS error in browser | Add your frontend URL to `CORS_ORIGINS` on Render |
| `JWT_SECRET` error on start | Set `JWT_SECRET` in backend `.env` or Render |
| Mobile cannot reach API | Use LAN IP, not `localhost`, in `EXPO_PUBLIC_API_URL` |
| Playwright login fails | Run `db:seed`; use seed emails/password above |
| Frontend tests fail in CI | Run `npm test -- --watchAll=false` in `RestaurantManagement/frontend` |
