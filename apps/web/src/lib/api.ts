function computeBaseUrl(): string {
  if (typeof window === "undefined") {
    return "/";
  }

  // When deployed under a subdirectory like `/test/`, we want API calls relative to that base.
  // Examples:
  // - `/test/` => base `/test/`
  // - `/test/inventory` => base `/test/`
  const path = window.location.pathname || "/";
  const idx = path.lastIndexOf("/");
  const base = idx >= 0 ? path.slice(0, idx + 1) : "/";
  return base.endsWith("/") ? base : `${base}/`;
}

const API_BASE = computeBaseUrl();

function buildUrl(path: string): string {
  const normalized = path.replace(/^\//, "");
  return `${API_BASE}${normalized}`;
}

function addCacheBust(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_ts=${Date.now()}`;
}

function withQuery(path: string, query?: Record<string, string | null | undefined>): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim() !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const url = method === "GET" ? addCacheBust(buildUrl(path)) : buildUrl(path);

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    cache: "no-store",
    ...init
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  return body.data as T;
}

async function downloadFile(path: string, token: string): Promise<{ blob: Blob; filename: string }> {
  const url = addCacheBust(buildUrl(path));
  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = (await response.json()) as { message?: string; error?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore non-JSON response bodies
      try {
        const text = await response.text();
        if (text.trim()) {
          message = text.trim();
        }
      } catch {
        // ignore
      }
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filenameMatch = disposition.match(/filename=\"?([^\";]+)\"?/i);
  const filename = filenameMatch?.[1] ? filenameMatch[1] : "download";
  return { blob, filename };
}

export type Role = "ADMIN" | "MANAGER" | "SALES";

export interface UserShop {
  shopId: string;
  code: string;
  name: string;
  isPrimary: boolean;
}

export interface AuthUser {
  id: string;
  fullName: string;
  mobileNumber: string;
  role: Role;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  shops: UserShop[];
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Shop {
  id: string;
  name: string;
  code: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ExpensePaymentSource = "SALESPERSON_CASH" | "ADMIN_BANK";

export interface Expense {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  categoryId: string;
  categoryName: string;
  amountUGX: number;
  expenseDate: string;
  notes?: string | null;
  paymentSource: ExpensePaymentSource;
  paidByUserId?: string | null;
  paidByFullName?: string | null;
  recordedByUserId?: string | null;
  recordedByFullName?: string | null;
  isVoid: boolean;
  voidedAt?: string | null;
  voidedByUserId?: string | null;
  voidedByFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductType = "BOARD" | "NON_BOARD";

export type BoardSizeCode = "A4C" | "A3C" | "A2C";

export interface Product {
  id: string;
  skuCode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  productType: ProductType;
  unitOfMeasure: string;
  costPrice?: number | null;
  sellingPrice: number;
  isActive: boolean;
  boardSizeCode?: BoardSizeCode | null;
  yieldPerSheet?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  sequenceNumber: number;
  customerId: string;
  customerMobileNumber: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail?: string | null;
  status: InvoiceStatus;
  issuedAt?: string | null;
  dueDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  sortOrder: number;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  lines: InvoiceLine[];
}

export type PaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD";

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationLock {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  lockDate: string;
  lockedByUserId?: string | null;
  lockedByFullName?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SalePaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";

export interface Sale {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  userId: string;
  userFullName: string;
  customerId?: string | null;
  customerMobileNumber?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  saleDate: string;
  paymentMethod: SalePaymentMethod;
  totalAmount: number;
  notes?: string | null;
  isVoid: boolean;
  voidedAt?: string | null;
  voidedByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleLine {
  id: string;
  saleId: string;
  sortOrder: number;
  productId: string;
  skuCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleDetail {
  sale: Sale;
  lines: SaleLine[];
}

export interface CashSummary {
  userId: string;
  computedAt: string;
  cashAtHand: number;
  cashSales: number;
  cashInvoicePayments: number;
  cashExpenses: number;
  transfersSent: number;
  transfersReceived: number;
  banked: number;
}

export interface CashRecipient {
  id: string;
  fullName: string;
  role: Role;
}

export type CashTransferStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CashTransfer {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  senderUserId: string;
  senderFullName: string;
  receiverUserId: string;
  receiverFullName: string;
  amountUGX: number;
  status: CashTransferStatus;
  requestNotes?: string | null;
  decisionNotes?: string | null;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BankingRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BankingRequest {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  userId: string;
  userFullName: string;
  amountUGX: number;
  status: BankingRequestStatus;
  requestNotes?: string | null;
  decisionNotes?: string | null;
  decidedAt?: string | null;
  decidedByUserId?: string | null;
  decidedByFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCashOverviewItem {
  userId: string;
  fullName: string;
  shopId: string | null;
  shopCode: string | null;
  shopName: string | null;
  cashAtHand: number;
  bankedTotal: number;
}

export interface AdminCashOverview {
  items: AdminCashOverviewItem[];
  totals: {
    cashAtHand: number;
    bankedTotal: number;
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  meta?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export function login(payload: { mobileNumber: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getMe(token: string): Promise<AuthUser> {
  return request<AuthUser>("api/auth/me", undefined, token);
}

export function listShops(token: string): Promise<Shop[]> {
  return request<Shop[]>("api/shops", undefined, token);
}

export function listUsers(token: string): Promise<AuthUser[]> {
  return request<AuthUser[]>("api/users", undefined, token);
}

export function listCustomers(token: string): Promise<Customer[]> {
  return request<Customer[]>("api/customers", undefined, token);
}

export function listExpenses(
  token: string,
  params?: {
    shopId?: string;
    expenseDate?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<Expense[]> {
  return request<Expense[]>(
    withQuery("api/expenses", {
      shopId: params?.shopId,
      expenseDate: params?.expenseDate,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo
    }),
    undefined,
    token
  );
}

export function createExpense(
  token: string,
  payload: {
    shopId?: string;
    categoryId: string;
    amountUGX: number;
    date?: string;
    notes?: string | null;
    paymentSource: ExpensePaymentSource;
    paidByUserId?: string;
  }
): Promise<Expense> {
  return request<Expense>(
    "api/expenses",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function voidExpense(token: string, expenseId: string): Promise<Expense> {
  return request<Expense>(
    `api/expenses/${expenseId}`,
    {
      method: "DELETE"
    },
    token
  );
}

export function createCustomer(
  token: string,
  payload: {
    mobileNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
): Promise<Customer> {
  return request<Customer>(
    "api/customers",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateCustomer(
  token: string,
  id: string,
  payload: Partial<{
    mobileNumber: string;
    firstName: string;
    lastName: string;
    email: string | null;
    notes: string | null;
    isActive: boolean;
  }>
): Promise<Customer> {
  return request<Customer>(
    `api/customers/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listExpenseCategories(token: string): Promise<ExpenseCategory[]> {
  return request<ExpenseCategory[]>("api/expense-categories", undefined, token);
}

export function createExpenseCategory(
  token: string,
  payload: { name: string; notes?: string; isActive?: boolean }
): Promise<ExpenseCategory> {
  return request<ExpenseCategory>(
    "api/expense-categories",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateExpenseCategory(
  token: string,
  id: string,
  payload: { name?: string; notes?: string | null; isActive?: boolean }
): Promise<ExpenseCategory> {
  return request<ExpenseCategory>(
    `api/expense-categories/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listProductCategories(token: string): Promise<ProductCategory[]> {
  return request<ProductCategory[]>("api/product-categories", undefined, token);
}

export function createProductCategory(
  token: string,
  payload: { name: string; notes?: string; isActive?: boolean }
): Promise<ProductCategory> {
  return request<ProductCategory>(
    "api/product-categories",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateProductCategory(
  token: string,
  id: string,
  payload: { name?: string; notes?: string | null; isActive?: boolean }
): Promise<ProductCategory> {
  return request<ProductCategory>(
    `api/product-categories/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listProducts(token: string): Promise<Product[]> {
  return request<Product[]>("api/products", undefined, token);
}

export function createProduct(
  token: string,
  payload: {
    skuCode: string;
    name: string;
    categoryId: string;
    productType: ProductType;
    unitOfMeasure: string;
    costPrice?: number | null;
    sellingPrice: number;
    isActive?: boolean;
    boardSizeCode?: BoardSizeCode | null;
    notes?: string | null;
  }
): Promise<Product> {
  return request<Product>(
    "api/products",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateProduct(
  token: string,
  id: string,
  payload: Partial<{
    skuCode: string;
    name: string;
    categoryId: string;
    productType: ProductType;
    unitOfMeasure: string;
    costPrice: number | null;
    sellingPrice: number;
    isActive: boolean;
    boardSizeCode: BoardSizeCode | null;
    notes: string | null;
  }>
): Promise<Product> {
  return request<Product>(
    `api/products/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listInvoices(token: string): Promise<Invoice[]> {
  return request<Invoice[]>("api/invoices", undefined, token);
}

export function getInvoice(token: string, id: string): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`api/invoices/${id}`, undefined, token);
}

export function createInvoice(
  token: string,
  payload: {
    shopId?: string;
    customerId: string;
    status?: "DRAFT" | "ISSUED";
    dueDate?: string | null;
    notes?: string | null;
    lines: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      notes?: string | null;
    }>;
  }
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(
    "api/invoices",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateInvoice(
  token: string,
  id: string,
  payload: Partial<{
    status: "ISSUED" | "VOID";
    customerId: string;
    dueDate: string | null;
    notes: string | null;
    lines: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      notes?: string | null;
    }>;
  }>
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(
    `api/invoices/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listInvoicePayments(token: string, invoiceId: string): Promise<InvoicePayment[]> {
  return request<InvoicePayment[]>(`api/invoices/${invoiceId}/payments`, undefined, token);
}

export function createInvoicePayment(
  token: string,
  invoiceId: string,
  payload: { amount: number; method: PaymentMethod; notes?: string | null }
): Promise<{ payment: InvoicePayment }> {
  return request<{ payment: InvoicePayment }>(
    `api/invoices/${invoiceId}/payments`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listReconciliationLocks(
  token: string,
  params?: {
    shopId?: string;
    lockDate?: string;
  }
): Promise<ReconciliationLock[]> {
  return request<ReconciliationLock[]>(
    withQuery("api/reconciliation-locks", {
      shopId: params?.shopId,
      lockDate: params?.lockDate
    }),
    undefined,
    token
  );
}

export function createReconciliationLock(
  token: string,
  payload: {
    shopId: string;
    lockDate: string;
    notes?: string | null;
  }
): Promise<ReconciliationLock> {
  return request<ReconciliationLock>(
    "api/reconciliation-locks",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listSales(
  token: string,
  params?: {
    shopId?: string;
    saleDate?: string;
  }
): Promise<Sale[]> {
  return request<Sale[]>(
    withQuery("api/sales", {
      shopId: params?.shopId,
      saleDate: params?.saleDate
    }),
    undefined,
    token
  );
}

export function getSale(token: string, saleId: string): Promise<SaleDetail> {
  return request<SaleDetail>(`api/sales/${saleId}`, undefined, token);
}

export function createSale(
  token: string,
  payload: {
    shopId?: string;
    saleDate?: string;
    paymentMethod: SalePaymentMethod;
    customerId?: string;
    notes?: string | null;
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      notes?: string | null;
    }>;
  }
): Promise<SaleDetail> {
  return request<SaleDetail>(
    "api/sales",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function updateSale(
  token: string,
  saleId: string,
  payload: Partial<{
    notes: string | null;
    lines: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      notes?: string | null;
    }>;
  }>
): Promise<SaleDetail> {
  return request<SaleDetail>(
    `api/sales/${saleId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function voidSale(token: string, saleId: string): Promise<{ sale: Sale }> {
  return request<{ sale: Sale }>(
    `api/sales/${saleId}`,
    {
      method: "DELETE"
    },
    token
  );
}

export function getCashMe(token: string): Promise<CashSummary> {
  return request<CashSummary>("api/cash/me", undefined, token);
}

export function listCashRecipients(token: string, params?: { shopId?: string }): Promise<CashRecipient[]> {
  return request<CashRecipient[]>(
    withQuery("api/cash/recipients", {
      shopId: params?.shopId
    }),
    undefined,
    token
  );
}

export function listCashTransfers(
  token: string,
  params?: {
    status?: CashTransferStatus;
    shopId?: string;
  }
): Promise<CashTransfer[]> {
  return request<CashTransfer[]>(
    withQuery("api/cash/transfers", {
      status: params?.status,
      shopId: params?.shopId
    }),
    undefined,
    token
  );
}

export function createCashTransfer(
  token: string,
  payload: { receiverUserId: string; amountUGX: number; notes?: string | null; shopId?: string }
): Promise<CashTransfer> {
  return request<CashTransfer>(
    "api/cash/transfers",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function decideCashTransfer(
  token: string,
  transferId: string,
  payload: { decision: "APPROVE" | "REJECT"; notes?: string | null }
): Promise<CashTransfer> {
  return request<CashTransfer>(
    `api/cash/transfers/${transferId}/decision`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function listBankingRequests(
  token: string,
  params?: {
    status?: BankingRequestStatus;
    shopId?: string;
  }
): Promise<BankingRequest[]> {
  return request<BankingRequest[]>(
    withQuery("api/cash/bankings", {
      status: params?.status,
      shopId: params?.shopId
    }),
    undefined,
    token
  );
}

export function createBankingRequest(token: string, payload: { amountUGX: number; notes?: string | null }): Promise<BankingRequest> {
  return request<BankingRequest>(
    "api/cash/bankings",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function decideBankingRequest(
  token: string,
  bankingRequestId: string,
  payload: { decision: "APPROVE" | "REJECT"; notes?: string | null }
): Promise<BankingRequest> {
  return request<BankingRequest>(
    `api/cash/bankings/${bankingRequestId}/decision`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    token
  );
}

export function getAdminCashOverview(
  token: string,
  params?: {
    shopId?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<AdminCashOverview> {
  return request<AdminCashOverview>(
    withQuery("api/cash/admin/overview", {
      shopId: params?.shopId,
      dateFrom: params?.dateFrom,
      dateTo: params?.dateTo
    }),
    undefined,
    token
  );
}

export function listMyNotifications(token: string): Promise<NotificationItem[]> {
  return request<NotificationItem[]>("api/notifications/me", undefined, token);
}

export function markNotificationRead(token: string, notifId: string): Promise<NotificationItem> {
  return request<NotificationItem>(
    `api/notifications/${notifId}/read`,
    {
      method: "PATCH",
      body: JSON.stringify({})
    },
    token
  );
}

export type SalesReportPeriod = "daily" | "weekly" | "monthly" | "quarterly";

export interface SalesReportRow {
  periodStart: string;
  periodEnd: string;
  saleCount: number;
  totalAmount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
  cardAmount: number;
  creditAmount: number;
}

export interface SalesReport {
  period: SalesReportPeriod;
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  periods: SalesReportRow[];
  totals: Omit<SalesReportRow, "periodStart" | "periodEnd">;
}

export type InvoiceReportStatus = "ALL" | "PAID" | "UNPAID" | "OVERDUE";

export interface InvoiceReportItem {
  id: string;
  invoiceNumber: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  status: InvoiceStatus;
  invoiceDate: string;
  issuedAt?: string | null;
  dueDate?: string | null;
  customerMobileNumber: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  isOverdue: boolean;
  notes?: string | null;
}

export interface InvoiceReportSummary {
  count: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  overdueCount: number;
  overdueBalance: number;
}

export interface InvoiceReport {
  status: InvoiceReportStatus;
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  items: InvoiceReportItem[];
  summary: InvoiceReportSummary;
}

export interface ExpenseReportItem {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  categoryId: string;
  categoryName: string;
  amountUGX: number;
  expenseDate: string;
  paymentSource: ExpensePaymentSource;
  paidByFullName?: string | null;
  recordedByFullName?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ExpenseReportCategoryRow {
  categoryId: string;
  categoryName: string;
  expenseCount: number;
  totalAmount: number;
}

export interface ExpenseReportSummary {
  count: number;
  totalAmount: number;
  salespersonCashAmount: number;
  adminBankAmount: number;
}

export interface ExpenseReport {
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  items: ExpenseReportItem[];
  byCategory: ExpenseReportCategoryRow[];
  summary: ExpenseReportSummary;
}

export interface CashReportItem {
  userId: string;
  fullName: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  cashAtHandAsOf: number;
  bankedInRange: number;
}

export interface CashReport {
  asOf: string;
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  items: CashReportItem[];
  totals: {
    cashAtHand: number;
    bankedInRange: number;
  };
}

export interface PlBreakdownRow {
  label: string;
  totalAmount: number;
}

export interface PlReport {
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  revenue: number;
  saleCount: number;
  expenses: number;
  expenseCount: number;
  profit: number;
  revenueByPaymentMethod: Array<{ paymentMethod: SalePaymentMethod; totalAmount: number }>;
  expensesByPaymentSource: Array<{ paymentSource: ExpensePaymentSource; totalAmount: number }>;
}

export function getSalesReport(
  token: string,
  params: { period?: SalesReportPeriod; shopId?: string; dateFrom?: string; dateTo?: string }
): Promise<SalesReport> {
  return request<SalesReport>(
    withQuery("api/reports/sales", {
      period: params.period ?? "daily",
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    }),
    undefined,
    token
  );
}

export function getInvoiceReport(
  token: string,
  params: { status?: InvoiceReportStatus; shopId?: string; dateFrom?: string; dateTo?: string }
): Promise<InvoiceReport> {
  return request<InvoiceReport>(
    withQuery("api/reports/invoices", {
      status: params.status ?? "ALL",
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    }),
    undefined,
    token
  );
}

export function getExpenseReport(token: string, params: { shopId?: string; dateFrom?: string; dateTo?: string }): Promise<ExpenseReport> {
  return request<ExpenseReport>(
    withQuery("api/reports/expenses", {
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    }),
    undefined,
    token
  );
}

export function getCashReport(
  token: string,
  params: { shopId?: string; asOf?: string; dateFrom?: string; dateTo?: string }
): Promise<CashReport> {
  return request<CashReport>(
    withQuery("api/reports/cash", {
      shopId: params.shopId,
      asOf: params.asOf,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    }),
    undefined,
    token
  );
}

export function getPlReport(token: string, params: { shopId?: string; dateFrom?: string; dateTo?: string }): Promise<PlReport> {
  return request<PlReport>(
    withQuery("api/reports/pl", {
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo
    }),
    undefined,
    token
  );
}

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export function exportSalesReport(
  token: string,
  params: { period?: SalesReportPeriod; shopId?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/sales", {
      period: params.period ?? "daily",
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format
    }),
    token
  );
}

export function exportInvoiceReport(
  token: string,
  params: { status?: InvoiceReportStatus; shopId?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/invoices", {
      status: params.status ?? "ALL",
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format
    }),
    token
  );
}

export function exportExpenseReport(
  token: string,
  params: { shopId?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/expenses", {
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format
    }),
    token
  );
}

export function exportCashReport(
  token: string,
  params: { shopId?: string; asOf?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/cash", {
      shopId: params.shopId,
      asOf: params.asOf,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format
    }),
    token
  );
}

export function exportPlReport(
  token: string,
  params: { shopId?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/pl", {
      shopId: params.shopId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      format
    }),
    token
  );
}
