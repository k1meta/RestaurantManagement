# Neon Setup and Team Workflow

This backend supports two Postgres connection modes:

- Preferred: `DATABASE_URL` (Neon)
- Fallback: local `DB_*` variables

## 1) One-time setup (each developer)

1. Create a Neon project and copy your connection string.
2. Create `backend/.env` from `backend/.env.example`.
3. Set:
   - `DATABASE_URL=...` (Neon pooled connection string)
   - `JWT_SECRET=...`
4. Apply schema and seed data:

```bash
npm run db:setup
```

## 2) Shared branch model (two-developer setup)

- Shared integration branch: `main`
- Personal branches: `dev-alice`, `dev-bob`

Recommended flow:

1. Both developers point local backend to their personal Neon DB branch.
2. Test schema/data changes in personal branch first.
3. When validated, apply the same SQL change to shared `main` branch.
4. Teammate pulls changes and runs:

```bash
npm run db:schema:apply
```

## 3) Daily commands

- Apply schema/seed to current DB:

```bash
npm run db:schema:apply
```

- Reset DB (dangerous) then re-apply:

```bash
npm run db:schema:reset
npm run db:schema:apply
```

## 4) Safety notes

- Never commit `backend/.env`.
- Keep `DB_SSLMODE` unset for Neon. Use `DB_SSLMODE=disable` only for local non-SSL Postgres.
- Treat `db:schema:reset` as destructive; only run on personal branches unless coordinated.
