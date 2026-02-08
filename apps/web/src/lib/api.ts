const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.BASE_URL;
const API_BASE = rawApiBase.endsWith("/") ? rawApiBase : `${rawApiBase}/`;

function buildUrl(path: string): string {
  const normalized = path.replace(/^\//, "");
  return `${API_BASE}${normalized}`;
}

async function request<T>(path: string, init?: RequestInit, userId?: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": userId } : {})
    },
    ...init
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  return body.data as T;
}

export interface SeedMeta {
  shops: Array<{ id: string; name: string; code: string }>;
  users: Array<{ id: string; fullName: string; role: string; shopId?: string; mobileNumber?: string; createdAt?: string }>;
}

export interface AuthUser {
  id: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "SALES";
  shopId?: string;
  mobileNumber?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Product {
  id: string;
  skuCode: string;
  name: string;
  productType: "BOARD" | "NON_BOARD";
  category?: string;
  unitOfMeasure?: string;
  costPrice?: number;
  sellingPrice: number;
  active?: boolean;
}

export interface InventoryRow {
  shopId: string;
  productId: string;
  quantity: number;
}

export interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  shopId: string;
  userId: string;
  lines: SaleLine[];
  subtotal: number;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";
  notes?: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  users: Array<{ userId: string; fullName: string; role: string; cashAtHand: number }>;
  bankCash: number;
  totalCashAtHand: number;
  pendingTransfers: number;
  pendingBankActions: number;
}

export interface CapitalSummary {
  totalCashAtHand: number;
  bankCash: number;
  totalInventoryValue: number;
  businessCapital: number;
  warnings: string[];
}

export function getSeedMeta(): Promise<SeedMeta> {
  return request<SeedMeta>("api/meta/seed");
}

export function signup(payload: {
  fullName: string;
  mobileNumber: string;
  password: string;
  shopId: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function login(payload: { mobileNumber: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMe(userId: string): Promise<AuthUser> {
  return request<AuthUser>("api/auth/me", undefined, userId);
}

export function getProducts(userId: string): Promise<Product[]> {
  return request<Product[]>("api/products", undefined, userId);
}

export function getInventory(userId: string): Promise<InventoryRow[]> {
  return request<InventoryRow[]>("api/products/inventory", undefined, userId);
}

export function getAdminDashboard(userId: string): Promise<AdminDashboard> {
  return request<AdminDashboard>("api/cash/dashboard/admin", undefined, userId);
}

export function getCapitalSummary(userId: string): Promise<CapitalSummary> {
  return request<CapitalSummary>("api/cash/capital/summary", undefined, userId);
}

export interface SalesDashboard {
  userId: string;
  cashAtHand: number;
  pendingTransfers: Array<{
    id: string;
    senderUserId: string;
    receiverUserId: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
  pendingBankActions: Array<{
    id: string;
    userId: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
}

export function getSalesDashboard(userId: string): Promise<SalesDashboard> {
  return request<SalesDashboard>(`api/cash/dashboard/sales/${userId}`, undefined, userId);
}

export function createSale(
  userId: string,
  payload: {
  paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
  }
): Promise<Sale> {
  return request<Sale>("api/sales", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function listSales(userId: string): Promise<Sale[]> {
  return request<Sale[]>("api/sales", undefined, userId);
}

export function receiveStock(userId: string, payload: { shopId: string; productId: string; quantity: number }): Promise<InventoryRow> {
  return request<InventoryRow>("api/products/inventory/receive", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function createProduct(
  userId: string,
  payload: {
    skuCode: string;
    name: string;
    category: string;
    productType: "BOARD" | "NON_BOARD";
    unitOfMeasure: string;
    costPrice?: number;
    sellingPrice: number;
    active: boolean;
  }
): Promise<Product> {
  return request<Product>("api/products", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date: string;
  notes?: string | null;
  paidBy: "SALESPERSON_CASH" | "ADMIN_BANK";
  recordedByUserId: string;
  createdAt: string;
}

export interface CashTransfer {
  id: string;
  senderUserId: string;
  receiverUserId: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt?: string;
}

export interface BankAction {
  id: string;
  userId: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  decidedAt?: string;
}

export interface CashActions {
  expenses: Expense[];
  transfers: CashTransfer[];
  bankActions: BankAction[];
  bankCash: number;
}

export function getCashActions(userId: string): Promise<CashActions> {
  return request<CashActions>("api/cash/actions", undefined, userId);
}

export function createExpense(
  userId: string,
  payload: { amount: number; category: string; date?: string; notes?: string; paidBy: "SALESPERSON_CASH" | "ADMIN_BANK" }
): Promise<Expense> {
  return request<Expense>("api/cash/expenses", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function createTransfer(userId: string, payload: { receiverUserId: string; amount: number }): Promise<CashTransfer> {
  return request<CashTransfer>("api/cash/transfers", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function decideTransfer(
  userId: string,
  transferId: string,
  payload: { status: "APPROVED" | "REJECTED" }
): Promise<CashTransfer> {
  return request<CashTransfer>(`api/cash/transfers/${transferId}/decision`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }, userId);
}

export function createBankAction(userId: string, payload: { amount: number }): Promise<BankAction> {
  return request<BankAction>("api/cash/bank-actions", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function decideBankAction(
  userId: string,
  actionId: string,
  payload: { status: "APPROVED" | "REJECTED" }
): Promise<BankAction> {
  return request<BankAction>(`api/cash/bank-actions/${actionId}/decision`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }, userId);
}

export interface Customer {
  id: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export function listCustomers(userId: string): Promise<Customer[]> {
  return request<Customer[]>("api/invoices/customers", undefined, userId);
}

export function createCustomer(
  userId: string,
  payload: { mobileNumber: string; firstName: string; lastName: string; email?: string }
): Promise<Customer> {
  return request<Customer>("api/invoices/customers", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export interface InvoiceLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  shopId: string;
  customerId: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate?: string | null;
  notes?: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: "CASH" | "MOBILE_MONEY" | "CARD";
  notes?: string | null;
  createdAt: string;
}

export function listInvoices(userId: string): Promise<Invoice[]> {
  return request<Invoice[]>("api/invoices", undefined, userId);
}

export function listOverdueInvoices(userId: string): Promise<Invoice[]> {
  return request<Invoice[]>("api/invoices/overdue", undefined, userId);
}

export function createInvoice(
  userId: string,
  payload: {
    customerId: string;
    status?: "DRAFT" | "ISSUED";
    lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
    dueDate?: string;
    notes?: string;
  }
): Promise<Invoice> {
  return request<Invoice>("api/invoices", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}

export function setInvoiceStatus(userId: string, invoiceId: string, payload: { status: InvoiceStatus }): Promise<Invoice> {
  return request<Invoice>(`api/invoices/${invoiceId}/status`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  }, userId);
}

export function listInvoicePayments(userId: string, invoiceId: string): Promise<InvoicePayment[]> {
  return request<InvoicePayment[]>(`api/invoices/${invoiceId}/payments`, undefined, userId);
}

export function addInvoicePayment(
  userId: string,
  invoiceId: string,
  payload: { amount: number; method: "CASH" | "MOBILE_MONEY" | "CARD"; notes?: string }
): Promise<{ invoice: Invoice; payment: InvoicePayment }> {
  return request<{ invoice: Invoice; payment: InvoicePayment }>(`api/invoices/${invoiceId}/payments`, {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}
