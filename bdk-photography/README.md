# BDK Photography (Rewrite)

This folder contains the rewritten system (Node.js + Prisma + MySQL backend, React + Vite + Tailwind frontend).

## Phase 1 (Foundation)

### 1) MySQL Schema

You can apply the schema in either of these ways:

- Prisma migrations (preferred): `prisma migrate deploy` (requires a database + `DATABASE_URL`)
- Raw SQL: run `server/prisma/migrations/001_init.sql`

### 2) Server (Auth + RBAC)

Server lives in `server/`.

- Login: `POST /api/auth/login` with `{ phone, password }` -> `{ token, user }` (JWT)
- Me: `GET /api/auth/me` with `Authorization: Bearer <token>`
- Middleware: `requireAuth` (JWT) + `requireRoles` / `requireShopAccess...`

### 3) Seed Minimum Data

Seed script is idempotent and creates:

- Roles: `ADMIN`, `MANAGER`, `SALES`
- Shops: `KLA` (Kampala Main), `WDG` (Wandegeya)
- Admin user (from env):
  - `SEED_ADMIN_PHONE`
  - `SEED_ADMIN_PASSWORD`

Run: `npm run seed` inside `server/`.

## Local Development

1. Start MySQL (Docker):

```bash
docker compose up -d
```

2. Configure server env:

```bash
cp server/.env.example server/.env
```

3. Install + migrate + seed:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run seed
```

4. Start server:

```bash
npm run dev
```

## SiteGround Database Setup (Needed For Production)

Create the database + user in SiteGround Site Tools and set `DATABASE_URL` for the server.
Then apply the schema (Prisma deploy or run the SQL script).
