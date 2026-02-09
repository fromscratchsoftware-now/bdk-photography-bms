# BDK Photography BMS

Mobile-first web system for workshop, shop inventory, sales, invoicing, credit/installments, and controlled cash workflows.

## Repository Structure

```txt
bdk-photography-bms/
  api/          # PHP API for SiteGround (/api/*)
  apps/
    api/        # Express + TypeScript API (local dev scaffold)
    web/        # React frontend (built into /assets for SiteGround)
  packages/
    shared/     # Shared types + validators
  scripts/      # MySQL migrations + seed scripts (Phase 1+)
  docs/
    BDK-Photography-SRD-v1.1.md
```

## Implemented (Phases 1-9)

- Auth (JWT) + roles (Admin/Manager/Sales)
- Master data: expense categories, product categories, products (BOARD/NON_BOARD, yields per sheet)
- Customers + invoices + installment payments
- Sales POS + reconciliation locks + edit/void rules
- Expenses with payment source logic
- Cash tracking (derived cash-at-hand, transfers approvals, banking approvals, in-app notifications)
- Reports + exports (CSV/XLSX/PDF)
- Workshop + inventory lifecycle:
  - full sheet receiving, batches (yield/waste), workshop stock
  - transfers workshop → shop (Draft → Shipped → Received)
  - shop stock, non-board stock receipts, damages
- Messaging scaffolding (Phase 9):
  - messaging templates (admin editable)
  - messaging queue + delivery logs
  - jobs: overdue invoice reminders + admin daily summary (queue only; provider integration later)

## Setup

Prerequisite: `Node.js 20+` and `npm 10+`.

### SiteGround Deployment (PHP + MySQL)

The production deployment uses the PHP API in `api/index.php` and MySQL (Phase 1 relational schema).

1. Create `.env` in the repo root on SiteGround (it is gitignored and blocked from web access via `.htaccess`).
2. Run migrations from SSH (inside the repo folder):
   - `php scripts/seed_phase1_foundation.php` (first time only)
   - `php scripts/seed_demo_users.php` (optional demo users)
   - `php scripts/migrate_phase2_master_data.php`
   - `php scripts/migrate_phase3_customers_invoices.php`
   - `php scripts/migrate_phase4_sales_pos.php`
   - `php scripts/migrate_phase5_expenses.php`
   - `php scripts/migrate_phase6_cash_tracking.php`
   - `php scripts/migrate_phase8_inventory_workshop.php`
   - `php scripts/migrate_phase9_messaging_notifications.php`

### Demo Logins (Seeded)

All seeded accounts share the same password: `bdk1234`.

- Admin: `0700000000`
- Manager: `0700000001`
- Sales One: `0700000002`
- Sales Two: `0700000003`

### 1) Install dependencies

```bash
npm install
```

### 2) Start API

```bash
npm run dev:api
```

API runs on `http://localhost:4000`.

### 3) Start Web

```bash
npm run dev:web
```

Web runs on `http://localhost:5173`.

### 4) Run both in one command

```bash
npm run dev
```

## Core API Endpoints

- Auth:
  - `POST /api/auth/login` (returns `{ token, user }`)
  - `GET /api/auth/me` (requires `Authorization: Bearer <token>`)

- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- Workshop + inventory:
  - `GET /api/workshop/sheets/summary`
  - `POST /api/workshop/sheets/receipts`
  - `POST /api/workshop/batches`
  - `GET /api/inventory/stock`
  - `POST /api/inventory/receipts` (non-board receive)
  - `POST /api/inventory/damages`
  - `POST /api/inventory/transfers`
  - `PATCH /api/inventory/transfers/:id/ship`
  - `PATCH /api/inventory/transfers/:id/receive`
- `GET /api/sales`
- `POST /api/sales`
- Expenses:
  - `GET /api/expenses`
  - `POST /api/expenses`
- Cash:
  - `GET /api/cash/me`
  - `POST /api/cash/transfers`
  - `PATCH /api/cash/transfers/:id/decision`
  - `POST /api/cash/bankings`
  - `PATCH /api/cash/bankings/:id/decision`
  - `GET /api/cash/admin/overview`
- `POST /api/invoices`
- `POST /api/invoices/:invoiceId/payments`
- In-app notifications:
  - `GET /api/notifications/me`
  - `PATCH /api/notifications/:id/read`
- Messaging scaffolding (admin-only):
  - `GET /api/messaging/templates`
  - `POST /api/messaging/templates`
  - `PATCH /api/messaging/templates/:id`
  - `GET /api/messaging/queue`
  - `PATCH /api/messaging/queue/:id/status`
  - `GET /api/messaging/logs`
  - `POST /api/messaging/jobs/run-overdue-reminders`
  - `POST /api/messaging/jobs/run-admin-daily-summary`

## Next Build Targets

1. Integrate actual delivery providers (SMS/WhatsApp/Email), worker/cron, retries.
2. Add audit log viewer UI.
3. Add messaging templates management for more business events.
4. Add report coverage for inventory movement + workshop yields/waste.
