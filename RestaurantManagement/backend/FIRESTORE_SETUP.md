# Firebase Firestore Setup

> Formerly `NEON_SETUP.md` — this project uses Firestore, not PostgreSQL/Neon.

Backend now uses **Firebase Firestore** through the Firebase Admin SDK.

## 1) One-time setup

1. Create `backend/.env` from `backend/.env.example`.
2. Set:
   - `FIREBASE_PROJECT_ID=...`
   - `JWT_SECRET=...` (required — server will not start without it)
   - `ENABLE_LOGIN_PROFILES=true` for local demo login UI only; omit or set `false` on Render/production
3. Provide admin credentials using one option:
   - `FIREBASE_SERVICE_ACCOUNT_JSON=...`
   - `FIREBASE_SERVICE_ACCOUNT_JSON_B64=...` (recommended on Render)
   - or `FIREBASE_SERVICE_ACCOUNT_PATH=...`
   - or `GOOGLE_APPLICATION_CREDENTIALS=...`
4. Seed demo records:

```bash
npm run db:seed
```

## 2) Daily commands

- Seed baseline records when starting fresh:

```bash
npm run db:seed
```

- Reset Firestore collections (destructive):

```bash
npm run db:reset
npm run db:seed
```

## 3) Safety notes

- Never commit `backend/.env` or service account credentials.
- `db:reset` permanently deletes all app collections listed in `scripts/resetFirestore.js`.
