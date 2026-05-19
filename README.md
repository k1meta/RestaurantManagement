# Restaurant Management

Setup and run guide for project.

## 1) Prerequisites

- Node.js 18+ (LTS recommended)
- npm (comes with Node.js)
- Firebase project + service account credentials

## 2) Project structure

```text
RestaurantManagement/
  backend/
  frontend/
```

All commands below run from repository root (`RestaurantManagment`).

## 3) Setup

1. Create backend env file.

```powershell
Copy-Item .\RestaurantManagement\backend\.env.example .\RestaurantManagement\backend\.env
```

2. Edit `RestaurantManagement/backend/.env` and set:
- `FIREBASE_PROJECT_ID`
- `JWT_SECRET`
- one credential option:
  - `FIREBASE_SERVICE_ACCOUNT_JSON`
  - or `FIREBASE_SERVICE_ACCOUNT_PATH`
  - or `GOOGLE_APPLICATION_CREDENTIALS`

For Render web deploys, set `REACT_APP_API_URL` (or `EXPO_PUBLIC_API_URL`) so the frontend points at the hosted backend.

3. Install backend dependencies.

```powershell
npm --prefix .\RestaurantManagement\backend install
```

4. Install frontend dependencies.

```powershell
npm --prefix .\RestaurantManagement\frontend install
```

5. (Optional first run) seed demo data.

```powershell
npm --prefix .\RestaurantManagement\backend run db:seed
```

## 4) Run project

### Option A (Windows quick start)

```powershell
.\RestaurantManagement\START.bat
```

This opens two terminals:
- Backend: `http://localhost:3000`
- Frontend: `http://localhost:3001`

### Option B (manual, two terminals)

Terminal 1 (backend):

```powershell
cd .\RestaurantManagement\backend
npm start
```

Terminal 2 (frontend):

```powershell
cd .\RestaurantManagement\frontend
npm run start
```

## 5) Run on phone (Expo)

1. Create frontend env file (API points to live backend by default):

```powershell
Copy-Item .\RestaurantManagement\frontend\.env.example .\RestaurantManagement\frontend\.env
```

2. Start app in Expo Go:

```powershell
cd .\RestaurantManagement\frontend
npm run start:mobile
```

3. Build installable Android APK (EAS cloud build):

```powershell
cd .\RestaurantManagement\frontend
npm run build:android:apk
```

## 6) Useful backend commands

```powershell
npm --prefix .\RestaurantManagement\backend run db:seed   # seed baseline data
npm --prefix .\RestaurantManagement\backend run db:reset  # reset Firestore collections (destructive)
```
