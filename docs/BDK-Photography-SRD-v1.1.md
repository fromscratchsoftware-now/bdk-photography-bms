# BDK Photography

## Software Requirements Document (SRD) - Version 1.1

## 1. Document Control

- System Name: BDK Photography Business Management System
- Version: 1.1
- Currency: Uganda Shillings (UGX)
- Primary Product: Boards
- Secondary Products: Other photographic items
- Target Platform: Web (mobile-first, responsive)

## 2. Purpose and Objectives

The purpose of this system is to provide end-to-end visibility and control over:

- Board production from full sheets to final sale
- Inventory movement across workshop and multiple shops
- Sales, invoicing, credit, and installment payments
- Cash accountability per user with approval workflows
- Business capital tracking
- Reporting and compliance

The system must be simple, auditable, mobile-friendly, and scalable.

## 3. Scope

### In Scope

- Workshop production tracking (cutting, yield, waste)
- Inventory management (boards and non-board items)
- Multi-shop sales operations
- Invoicing and receipts
- Credit sales with installments
- Cash tracking and banking
- Expense tracking
- Capital dashboard
- Reports with exports
- Notifications (SMS, WhatsApp, Email)

### Out of Scope (v1)

- Full accounting ledger (GL, depreciation)
- Payroll taxes
- Multi-currency
- External payment gateway automation

## 4. Business Rules (Global)

- No hard-coded labels (expense categories, product categories, templates)
- All monetary values stored in UGX
- All data entries must allow optional notes
- No manual cash adjustments - cash is system-derived
- Audit log required for all edits and approvals
- Negative stock and negative cash are blocked unless admin override

## 5. Product Model

### 5.1 Product Types

#### A. Board Products (Primary)

- Produced internally
- Sizes and yields:
  - A4C -> 48 pcs per full sheet
  - A3C -> 24 pcs per full sheet
  - A2C -> 12 pcs per full sheet
- Tracked through:
  - Full sheets -> cutting -> yield -> transfer -> shop -> sale

#### B. Non-Board Products (Secondary)

- Purchased finished
- Simple SKU-based inventory
- Do not go through workshop

### 5.2 Admin Product Configuration

Admin can:

- Create product categories
- Create/edit SKUs:
  - SKU code
  - Name
  - Category
  - Unit of measure
  - Cost price (optional)
  - Selling price (default)
  - Active/inactive

## 6. User Roles and Permissions

### 6.1 Roles

#### Admin

- Full system access
- Configure shops, users, products, categories
- Approve banking
- Reconcile days
- Edit historical records
- View consolidated reports
- Receive daily summaries

#### Manager

- View only:
  - Assigned shop(s)
  - Supervised sales staff
- No edits after reconciliation

#### Sales

- Assigned to exactly one shop
- Create sales, invoices, customers
- Edit/delete own same-day records only
- Initiate cash transfers and banking

## 7. Workshop Module

### 7.1 Full Sheet Receiving

- Date
- Quantity received
- Optional supplier
- Optional cost per sheet

### 7.2 Cutting / Batch Production

Each batch records:

- Cutting plan (sheets per size)
- Expected output (auto-calculated)
- Actual output per size:
  - Good
  - Damaged
  - Waste
- Variance shown
- Notes

### 7.3 Workshop Expenses

- Worker wages (daily)
- Rent
- Consumables (admin-defined categories)
- Payment source (required):
  - Paid by salesperson cash
  - Paid by admin/bank

## 8. Inventory and Transfers

### 8.1 Transfers (Workshop -> Shop)

- Draft -> Shipped -> Received
- Record transit damage
- Inventory updates on receive

### 8.2 Shop Inventory

- Stock on hand by SKU
- Damage records with reason

## 9. Sales, Customers and Invoicing

### 9.1 Customers

Required:

- Mobile number
- First name
- Last name

Optional:

- Email

### 9.2 Sales

- Multi-item (boards and non-boards)
- Payment methods:
  - Cash
  - Mobile Money
  - Card
  - Credit
- Stock deducted on save
- Notes supported

### 9.3 Invoicing

- Invoice from sale or direct
- Unique invoice number (shop-prefixed)
- Status:
  - Draft
  - Issued
  - Partially Paid
  - Paid
  - Void (admin)
- Printable invoice and receipt

### 9.4 Credit and Installments

- Multiple payments per invoice
- Balance auto-updates
- Due dates supported
- Overdue flagging

## 10. Cash Tracking Module

### 10.1 Definitions

Cash at Hand (per user) =

- Cash sales collected
- minus cash expenses paid by user
- minus approved transfers sent
- plus approved transfers received
- minus approved banking

### 10.2 Cash Actions

- Transfer Cash
  - Sender initiates
  - Receiver approves/rejects
  - Status:
    - Pending
    - Approved
    - Rejected
- Bank Cash
  - User initiates
  - Admin approves/rejects
  - Cash moves only on approval

### 10.3 Dashboards

#### Sales

- Cash at hand
- Pending approvals
- Action history

#### Admin

- All users' cash at hand
- Banked cash totals
- Approval queue

## 11. Expenses (Payment Source Logic)

Each expense must record:

- Amount
- Category
- Date
- Notes
- Payment Source (mandatory):
  - Salesperson Cash -> reduces user cash at hand
  - Admin/Bank -> reduces bank cash

## 12. Business Capital Dashboard (Admin)

### 12.1 Capital Formula

Business Capital =

- Total cash at hand (all users)
- plus cash in bank
- plus inventory value

### 12.2 Inventory Valuation (v1)

- Non-board items:
  - Quantity x last purchase cost
- Board items:
  - If full sheet cost exists -> calculated
  - Else value = 0 with warning

### 12.3 Filters

- Date range
- Shop / consolidated

## 13. Messaging and Notifications

### 13.1 Credit Customer Reminders

- Channels:
  - SMS
  - WhatsApp
  - Email
- Trigger:
  - Overdue invoices
- Admin-editable templates
- Full send log

### 13.2 Admin Daily Summary

Sent via:

- Email
- WhatsApp

Includes:

- Sales totals
- Cash at hand
- Banked cash
- Credit outstanding
- Key alerts

## 14. Reports and Exports

### Reports

- Sales (daily, weekly, monthly, quarterly)
- Inventory
- Workshop yield
- Cash movement
- Credit aging
- Profit and Loss
- Business capital

### Export Formats

- PDF
- CSV
- Excel (XLSX)

## 15. Audit and Security

- Full audit log:
  - User
  - Action
  - Before/after values
  - Timestamp
- Reconciliation locks prevent edits
- Role-based access enforced at API and UI

## 16. Core Data Entities (Summary)

- Users, Roles, Shops
- Products, Categories
- WorkshopBatches, BatchOutputs
- Inventory
- Transfers
- Sales, SaleLines
- Customers
- Invoices, InvoiceLines
- Payments
- Expenses
- CashActions
- BankLedger
- Notifications
- ReconciliationLocks
- AuditLog

## 17. Design Principles (Non-Negotiable)

- Mobile-first
- Few clicks
- Clear status indicators
- No silent data changes
- Simple before powerful
