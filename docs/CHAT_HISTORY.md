# BDK Photography BMS - Chat History (Redacted)

Generated: 2026-02-09

This file is a handoff record from the Codex desktop chat. It includes the user-provided requirements and the most important implementation/deployment decisions.

Security:
- All secrets (GitHub tokens, passwords, private keys) are redacted or omitted. Revoke any tokens that were ever pasted into chat.

## Project Links

- Repo root (local): `/Users/paul/Documents/GitHub/bdk-photography-bms`
- SRD v1.1 (in repo): `/Users/paul/Documents/GitHub/bdk-photography-bms/docs/BDK-Photography-SRD-v1.1.md`
- Master prompt PDF (user-provided): `/Users/paul/Desktop/UNIVERSAL MASTER PROMPT v2.4.pdf`
- SiteGround test URL: `https://bdk.fromscratchsoftware.net/test/`
- SiteGround API health: `https://bdk.fromscratchsoftware.net/test/api/health`
- SiteGround deployed repo path: `/home/customer/www/bdk.fromscratchsoftware.net/public_html/test`

## Requirements Dump (From Chat)

### SRD v1.1 (Authoritative)

The user provided SRD v1.1 in chat. The same content is committed at:
- `/Users/paul/Documents/GitHub/bdk-photography-bms/docs/BDK-Photography-SRD-v1.1.md`

Key non-negotiables called out in the SRD:
- UGX only; store amounts as integer UGX.
- No hard-coded labels for categories/templates.
- Notes supported on all entries.
- Audit log for edits/approvals.
- Negative stock/cash blocked unless admin override.
- Cash is derived (no manual adjustments).

### Phase 2 - Master Data (No Hard Coding)

5) Expense Categories (Dynamic)
- Admin-only CRUD:
  - Create/edit/deactivate expense categories
- No hardcoded labels in code
- Deliverable: API endpoints + simple UI screen.

6) Product Categories + Products (Boards + Non-Boards)
- Admin-only CRUD:
  - Categories: dynamic
  - Products:
    - `type`: `BOARD` or `NON_BOARD`
    - Boards must store yield per sheet:
      - A4C=48, A3C=24, A2C=12
    - Non-board items: SKU-based, simple
    - cost price optional, selling price default
- Deliverable: API endpoints + UI forms.

### Phase 3 - Customers + Invoicing + Payments (Credit & Installments)

7) Customers
- Fields:
  - mobile (required)
  - first + last name (required)
  - email optional
- Deliverable: Customer CRUD endpoints + UI.

8) Invoices
- Implement:
  - Create invoice from scratch (and later optionally from sale)
  - Invoice number generation:
    - Shop-prefixed sequential numbering
  - Status lifecycle:
    - Draft, Issued, Partially Paid, Paid, Void (admin only)
  - Line items, totals (UGX integer)
  - Notes field
- Deliverable: Invoice endpoints + UI invoice creation page + printable view.

9) Payments (Installments)
- Payments attach to invoice
- Support multiple payments (cash/mobile money/card)
- Auto update invoice status after each payment
- Notes field on payment
- Deliverable: Payment endpoint + UI to record payment + outstanding balance shown.

### Phase 4 - Sales (POS) + Edit Rules + Reconciliation Locks

10) Sales (POS)
- Sales can include board and non-board items
- Payment methods: Cash, Mobile Money, Card, Credit
- Notes field
- Sales assigned to logged-in user and their shop
- For credit: link invoice/customer (either auto-create invoice or require invoice creation workflow)
- Deliverable: POS endpoint + UI sales screen.

11) Edit/Delete Rules
- Sales role:
  - can edit/delete own sales only for current day AND only if not reconciled
- Admin:
  - can edit historical with audit log
- Deliverable: Enforcement in API + audit logging.

12) Daily Reconciliation (Admin)
- Admin can reconcile a date per shop
- Once reconciled:
  - Sales can no longer edit records for that shop/date
- Show “locked” status in UI
- Deliverable: Reconciliation endpoints + UI + lock enforcement.

### Phase 5 - Expenses With Payment Source (Cash vs Bank)

13) Expenses
- Expense record must include:
  - category
  - amountUGX
  - date
  - notes
  - payment source:
    - Paid by salesperson cash
    - Paid by admin/bank
- Rules:
  - If paid by salesperson cash -> must link to user
  - If paid by admin/bank -> no user cash reduction
- Deliverable: Expense endpoints + UI with payment source logic.

### Phase 6 - Cash Tracking (Approvals + Dashboards)

14) Cash Computation Engine (No manual adjustments)
- Implement derived cash at hand per user:
  - Cash at hand =
    - cash sales collected by user
    - - expenses paid by salesperson cash (linked to that user)
    - - approved transfers sent
    - + approved transfers received
    - - approved bankings
- No manual “add cash” feature.
- Deliverable: `/cash/me` endpoint + tested calculations.

15) Cash Transfers (User -> User, receiver approval)
- Flow:
  - Sender creates transfer request (Pending)
  - Receiver approves or rejects
  - Cash does not move until receiver approves
- Statuses: Pending / Approved / Rejected
- Notes supported
- Deliverable: Transfer endpoints + UI screens for send + approve queue.

16) Banking Requests (User -> Bank, admin approval)
- Flow:
  - User creates banking request (Pending)
  - Admin approves/rejects
  - Cash does not leave user until admin approves
  - Notify user on approval (in-app notification now; WhatsApp/email later)
- Notes supported
- Deliverable: Banking endpoints + admin approval UI + user notifications list.

17) Admin Cash Overview Dashboard
- Admin can see:
  - each salesperson name
  - cash at hand
  - banked cash totals
  - filter by date range and shop
- Deliverable: Admin dashboard page.

### Phase 7 - Reports + Exports (PDF/CSV/Excel)

18) Core Reports
- Implement report endpoints with filters:
  - Sales report (daily/weekly/monthly/quarterly)
  - Invoice report (paid/unpaid/overdue)
  - Cash report (cash at hand per user + banked)
  - Expense report
  - P&L (Revenue - Expenses) for selected date range (v1 simple)
- Deliverable: Report pages with filters (date range, shop) + totals.

19) Export Formats
- Every report must export:
  - CSV
  - Excel (XLSX)
  - PDF
- Exports must respect filters.
- Deliverable: Export buttons on each report + generated files.

### Phase 8 - Inventory + Boards Lifecycle (Optional In This Iteration)

20) Workshop Batch Tracking (Boards)
- Full sheet receiving
- Cutting plan by size
- Expected output auto-calculated
- Actual output: good/damaged/waste
- Notes
- Deliverable: Workshop batch module.

21) Transfers Workshop -> Shops + Receiving
- Shipments with status
- Receiving updates shop inventory
- Damages in transit recorded
- Deliverable: Transfers module + inventory updates.

22) Shop Stock + Damages
- Stock on hand by shop, SKU
- Damage events reduce inventory
- Deliverable: Inventory dashboard.

### Phase 9 - Notifications Scaffolding (SMS/WhatsApp/Email)

23) Notification Template + Queue + Log (Build now, integrate later)
- Implement:
  - templates editable by admin
  - notification queue
  - notification log with delivery status
- Deliverable: Notification module (internal only).

24) Overdue Credit Reminders
- Identify overdue invoices (due date passed, balance > 0)
- Create reminders into queue (SMS/WhatsApp/Email)
- Deliverable: Scheduled job or manual “Run reminders” action.

25) Admin Daily Summary
- Generate daily rollup and queue for email/WhatsApp
- Deliverable: Daily report job + admin notification.

### Cross-Cutting Requirements (Apply to All Steps)

26) Notes Everywhere
- Every create/update form must support optional notes:
  - Sales, invoices, payments, expenses, cash actions, transfers, batches, etc.

27) Audit Logging Everywhere
- For:
  - edits
  - approvals
  - voids
  - reconciliations

28) Currency & Formatting
- Store amounts as integer UGX
- Display as `UGX 1,234,567`

29) Mobile-First UI
- minimal clicks
- large buttons
- clear locked/reconciled indicators

### Final Deliverable Checklist (From Chat)

At the end provide:
- Admin login credentials (or instructions to create)
- Working URLs for:
  - login
  - sales
  - invoices + payments
  - expenses
  - cash tracking
  - reports + exports
- DB migration status
- `.env.example`
- Short README for SiteGround deployment

### UI Refresh Requirements (From Chat)

Goal: modern, finance-grade UI refresh across dashboard/front-end, reorganize screens where it improves usability.

UI requirements:
- Modern component styling: consistent spacing, alignment, typography hierarchy, responsive layout.
- Upgrade forms: clear labels, grouped sections, inline validation, helper text, proper input states (hover/focus/error/disabled), consistent button styles.
- Upgrade navigation/menus: modern sidebar/top-nav pattern with clear active states, icons (if available), logical grouping.
- Improve information architecture: reorganize pages/sections to reduce clicks and surface key actions (Projects, Invoices, Payments, Commissions, Reports) more clearly.
- Financial color palette: neutrals with finance-style accent colors (deep blues/greens) + consistent status colors.

Consistency:
- Design system approach (shared reusable components).
- Tables/filters/dropdowns follow the same styling + interaction patterns.
- Accessibility: contrast, readable font sizes, keyboard navigation.

Deliverables:
- Updated UI layout for main dashboard pages (Projects, Invoices, Commissions, Reports).
- Refactored components: buttons, inputs, dropdowns (searchable), tables, modals, alerts/toasts.
- Brief before/after mapping for reorganized nav + key screens.

### Help / Documentation Requirements (From Chat)

Add a Help / Documentation section (or guided walkthrough) accessible from the dashboard.
Content must reflect actual system behavior and permissions and be role-aware (Client, Staff, Manager, Admin).

Topics:
1) How to Create Users
   - Who can create users (Manager/Admin only).
   - Step-by-step in dashboard, required fields, role assignment, how to link user to client record (if applicable).
   - How to create new user group/role (if supported) and assign permissions.
2) How to Change or Reset Password
   - User changes own password (profile/settings).
   - Admin/Manager initiates reset for a user (if supported).
   - Forgot password from login (email reset link).
   - Security rules: password requirements, reset token expiry, what happens after reset.
3) How Invoicing Relates to a Sale
   - Define relationship: Sale vs Invoice vs Payment.
   - When invoice is created (manual vs from sale), how links work, and status flow.
   - Include examples + simple diagram.

Deliverables:
- Help page/screens for the three topics above.
- Role-aware content.
- Contextual links from Users/Profile/Invoices/Sales to matching help sections.

## Engineering / Deployment Notes (From Chat)

### Repo + Deployment

- Frontend is built and committed as static assets:
  - `/Users/paul/Documents/GitHub/bdk-photography-bms/index.html`
  - `/Users/paul/Documents/GitHub/bdk-photography-bms/assets/app.js`
  - `/Users/paul/Documents/GitHub/bdk-photography-bms/assets/app.css`
- SiteGround deploy is via `git push` to the `siteground` remote (server uses `receive.denyCurrentBranch=updateInstead`).

### Blank Page Issue

User reported blank page + `Minified React error #310`. Fixes applied previously included:
- Ensuring hooks ordering in `apps/web/src/App.tsx` (avoid calling hooks conditionally/after early returns).
- Build target set to ES2017 to support older environments.
- `index.html` includes basic `<noscript>` and `nomodule` fallback message.

### GitHub Push (token hygiene)

User provided multiple PATs in chat. All should be revoked; tokens should never be pasted into chat.
Final push succeeded after forcing:
- `git -c http.version=HTTP/1.1 -c http.postBuffer=524288000 push origin main`

### SiteGround Verification (as of 2026-02-09)

Verified over SSH:
- Branch: `main`
- `HEAD`: `3722290` (matches local and GitHub)
- `receive.denyCurrentBranch`: `updateInstead`
- Working tree has untracked runtime files:
  - `api/php_errorlog`
  - `data/state.json`

### Current State (Snapshot)

- Local `HEAD`: `3722290`
- GitHub `origin/main`: `3722290`
- SiteGround `main`: `3722290`
- SiteGround test URL serves the same `index.html`, `assets/app.js`, and `assets/app.css` as local (hashes matched at time of check).

## Handoff Prompt (For Codex Web)

If you need a single short prompt to paste into another Codex environment, use:

```text
Project: BDK Photography BMS

Repo: /Users/paul/Documents/GitHub/bdk-photography-bms
Deployed test URL: https://bdk.fromscratchsoftware.net/test/
Deployed API health: https://bdk.fromscratchsoftware.net/test/api/health
SiteGround repo path: /home/customer/www/bdk.fromscratchsoftware.net/public_html/test
SRD: /Users/paul/Documents/GitHub/bdk-photography-bms/docs/BDK-Photography-SRD-v1.1.md
Master prompt PDF: /Users/paul/Desktop/UNIVERSAL MASTER PROMPT v2.4.pdf

Current: local HEAD = origin/main = SiteGround main = 3722290. SiteGround has untracked runtime files api/php_errorlog and data/state.json.

Next work:
1) Walk phases 2–9 and verify each deliverable in UI with short click-path scripts; output PASS/FAIL list + exact breakpoints.
2) Finance-grade UI refresh + design system (buttons/inputs/dropdowns/tables/modals/toasts) + nav reorg (Projects, Invoices, Payments, Commissions, Reports).
3) Add role-aware Help/Docs section covering user creation, password change/reset/forgot, and Sale vs Invoice vs Payment relationship.
4) Fix any remaining blank-page/runtime errors; rebuild and deploy.

Constraints: UGX int amounts; no hard-coded categories/templates; notes everywhere; audit logging; derived cash (no manual adjustments); block negative stock/cash unless admin override.
```

