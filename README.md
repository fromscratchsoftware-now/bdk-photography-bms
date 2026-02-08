# BDK Photography BMS

Mobile-first web system for workshop, shop inventory, sales, invoicing, credit/installments, and controlled cash workflows.

## Repository Structure

```txt
bdk-photography-bms/
  apps/
    api/        # Express + TypeScript API
    web/        # React + Vite frontend
  packages/
    shared/     # Shared types + validators
  docs/
    BDK-Photography-SRD-v1.1.md
```

## Implemented in This Initial Scaffold

- Product setup and listing (boards and non-board items)
- Inventory receiving and stock-on-hand listing
- Sales with line items and stock deduction
- Negative stock prevention
- Cash tracking formula (derived cash-at-hand, no manual adjustments)
- Expense payment source logic:
  - `SALESPERSON_CASH` reduces user cash at hand
  - `ADMIN_BANK` reduces bank cash
- Cash transfer lifecycle:
  - Pending -> Approved/Rejected
- Banking lifecycle:
  - Pending -> Approved/Rejected
- Capital summary:
  - cash at hand + bank cash + inventory value
- Customers, invoices, installment payments, overdue list

## Setup

Prerequisite: `Node.js 20+` and `npm 10+`.

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

- Auth: all `/api/*` endpoints require an `x-user-id` header, except `GET /api/meta/seed` and `GET /api/health`.

- `GET /api/meta/seed`
- `GET /api/health`
- `GET /api/products`
- `POST /api/products`
- `GET /api/products/inventory`
- `POST /api/products/inventory/receive`
- `GET /api/sales`
- `POST /api/sales`
- `POST /api/cash/expenses`
- `POST /api/cash/transfers`
- `PATCH /api/cash/transfers/:transferId/decision`
- `POST /api/cash/bank-actions`
- `PATCH /api/cash/bank-actions/:actionId/decision`
- `GET /api/cash/dashboard/sales/:userId`
- `GET /api/cash/dashboard/admin`
- `GET /api/cash/capital/summary`
- `POST /api/invoices/customers`
- `POST /api/invoices`
- `POST /api/invoices/:invoiceId/payments`
- `GET /api/invoices/overdue`

## Next Build Targets

1. Persist data using PostgreSQL + Prisma migrations.
2. Replace the current `x-user-id` header auth with real authentication (sessions/JWT) and secure password storage.
3. Implement workshop batch module and transfer states (`Draft -> Shipped -> Received`).
4. Add audit log table and write hooks for every mutating action.
5. Add messaging providers (SMS/WhatsApp/Email) with template management and send logs.
