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

export interface PaymentsReportItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  customerMobileNumber: string;
  customerName: string;
  method: PaymentMethod;
  amount: number;
  notes?: string | null;
  createdByFullName?: string | null;
  createdAt: string;
}

export interface PaymentsReportSummary {
  count: number;
  totalAmount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
  cardAmount: number;
}

export interface PaymentsReport {
  method?: PaymentMethod | null;
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  items: PaymentsReportItem[];
  summary: PaymentsReportSummary;
}

export interface CommissionsReportItem {
  userId: string;
  fullName: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  saleCount: number;
  totalAmount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
  cardAmount: number;
  creditAmount: number;
}

export interface CommissionsReportTotals {
  saleCount: number;
  totalAmount: number;
  cashAmount: number;
  mobileMoneyAmount: number;
  cardAmount: number;
  creditAmount: number;
}

export interface CommissionsReport {
  dateFrom: string;
  dateTo: string;
  shopId?: string | null;
  items: CommissionsReportItem[];
  totals: CommissionsReportTotals;
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

export interface CapitalInventoryItem {
  productId: string;
  skuCode: string;
  name: string;
  productType: ProductType;
  shopQty: number;
  workshopQty: number;
  transitQty: number;
  quantity: number;
  unitCostUGX: number | null;
  valueUGX: number;
  costSource: string;
}

export interface CapitalReport {
  asOf: string;
  shopId?: string | null;
  shopCode?: string | null;
  shopName?: string | null;
  sheetCostPerFullSheet?: number | null;
  bank: {
    bankedApproved: number;
    adminBankExpenses: number;
    cashInBank: number;
  };
  totals: {
    cashAtHand: number;
    cashInBank: number;
    inventoryValue: number;
    businessCapital: number;
  };
  inventory: CapitalInventoryItem[];
  warnings: string[];
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

export function getCommissionsReport(
  token: string,
  params: { shopId?: string; dateFrom?: string; dateTo?: string }
): Promise<CommissionsReport> {
  return request<CommissionsReport>(
    withQuery("api/reports/commissions", {
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

export function getPaymentsReport(
  token: string,
  params: { shopId?: string; method?: PaymentMethod; dateFrom?: string; dateTo?: string }
): Promise<PaymentsReport> {
  return request<PaymentsReport>(
    withQuery("api/reports/payments", {
      shopId: params.shopId,
      method: params.method,
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

export function getCapitalReport(token: string, params: { shopId?: string; asOf?: string }): Promise<CapitalReport> {
  return request<CapitalReport>(
    withQuery("api/reports/capital", {
      shopId: params.shopId,
      asOf: params.asOf
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

export function exportCommissionsReport(
  token: string,
  params: { shopId?: string; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/commissions", {
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

export function exportPaymentsReport(
  token: string,
  params: { shopId?: string; method?: PaymentMethod; dateFrom?: string; dateTo?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/payments", {
      shopId: params.shopId,
      method: params.method,
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

export function exportCapitalReport(
  token: string,
  params: { shopId?: string; asOf?: string },
  format: ReportExportFormat
): Promise<{ blob: Blob; filename: string }> {
  return downloadFile(
    withQuery("api/reports/capital", {
      shopId: params.shopId,
      asOf: params.asOf,
      format
    }),
    token
  );
}

// Phase 8 — Workshop + Inventory
export interface WorkshopSheetSummary {
  availableSheets: number;
  totalReceivedSheets: number;
  totalUsedSheets: number;
  updatedAt?: string | null;
}

export interface WorkshopSheetReceipt {
  id: string;
  receiptDate: string;
  quantitySheets: number;
  supplier?: string | null;
  costPerSheet?: number | null;
  notes?: string | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopStockRow {
  productId: string;
  skuCode: string;
  productName: string;
  productType: ProductType;
  boardSizeCode?: BoardSizeCode | null;
  yieldPerSheet?: number | null;
  quantity: number;
  updatedAt: string;
}

export interface WorkshopBatchLine {
  id: string;
  batchId: string;
  sortOrder: number;
  productId: string;
  skuCode: string;
  productName: string;
  yieldPerSheet: number;
  sheetsUsed: number;
  expectedOutput: number;
  actualGood: number;
  actualDamaged: number;
  actualWaste: number;
  variance: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkshopBatch {
  id: string;
  batchDate: string;
  totalSheetsUsed: number;
  notes?: string | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines: WorkshopBatchLine[];
}

export interface InventoryStockRow {
  shopId: string;
  shopCode: string;
  shopName: string;
  productId: string;
  skuCode: string;
  productName: string;
  productType: ProductType;
  boardSizeCode?: BoardSizeCode | null;
  yieldPerSheet?: number | null;
  quantity: number;
  updatedAt: string;
}

export interface StockReceipt {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  productId: string;
  skuCode: string;
  productName: string;
  receiptDate: string;
  quantity: number;
  notes?: string | null;
  recordedByUserId?: string | null;
  inventoryAdjustment: { beforeQty: number; afterQty: number; delta: number };
}

export interface ShopDamageEvent {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  productId: string;
  skuCode: string;
  productName: string;
  damageDate: string;
  quantity: number;
  reason?: string | null;
  notes?: string | null;
  recordedByUserId?: string | null;
  recordedByFullName?: string | null;
  inventoryAdjustment?: { beforeQty: number; afterQty: number; delta: number };
  createdAt: string;
  updatedAt: string;
}

export type InventoryTransferStatus = "DRAFT" | "SHIPPED" | "RECEIVED";

export interface InventoryTransferLine {
  id: string;
  transferId: string;
  sortOrder: number;
  productId: string;
  skuCode: string;
  productName: string;
  quantityShipped: number;
  quantityDamaged: number;
  quantityReceivedGood: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryTransfer {
  id: string;
  toShopId: string;
  toShopCode: string;
  toShopName: string;
  status: InventoryTransferStatus;
  notes?: string | null;
  receiveNotes?: string | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  shippedAt?: string | null;
  shippedByUserId?: string | null;
  shippedByFullName?: string | null;
  receivedAt?: string | null;
  receivedByUserId?: string | null;
  receivedByFullName?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lines: InventoryTransferLine[];
}

// Phase 9 — Messaging (templates + queue + logs)
export type MessagingChannel = "SMS" | "WHATSAPP" | "EMAIL";

export interface MessagingTemplate {
  id: string;
  templateKey: string;
  channel: MessagingChannel;
  subject?: string | null;
  body: string;
  isActive: boolean;
  notes?: string | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  updatedByUserId?: string | null;
  updatedByFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MessagingQueueStatus = "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
export type MessagingRecipientType = "CUSTOMER" | "USER" | "RAW";

export interface MessagingQueueItem {
  id: string;
  templateId?: string | null;
  templateKey: string;
  channel: MessagingChannel;
  recipientType: MessagingRecipientType;
  recipientCustomerId?: string | null;
  recipientUserId?: string | null;
  toAddress: string;
  renderedSubject?: string | null;
  renderedBody: string;
  payload?: Record<string, unknown> | null;
  status: MessagingQueueStatus;
  dedupeKey?: string | null;
  errorMessage?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  customerMobileNumber?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerEmail?: string | null;
  recipientUserFullName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingLogEvent {
  id: string;
  queueId: string;
  status: MessagingQueueStatus;
  message?: string | null;
  meta?: Record<string, unknown> | null;
  createdByUserId?: string | null;
  createdByFullName?: string | null;
  createdAt: string;
}

export interface OverdueRemindersRunResult {
  templateKey: "OVERDUE_INVOICE_REMINDER";
  asOfDate: string;
  createdCount: number;
  skippedCount: number;
  byChannel: Record<MessagingChannel, { created: number; skipped: number }>;
  missingTemplates: Array<{ templateKey: string; channel: MessagingChannel }>;
}

export interface AdminDailySummaryRunResult {
  templateKey: "ADMIN_DAILY_SUMMARY";
  date: string;
  createdCount: number;
  skippedCount: number;
  byChannel: Record<"WHATSAPP" | "EMAIL", { created: number; skipped: number }>;
  missingTemplates: Array<{ templateKey: string; channel: MessagingChannel }>;
  emailRecipients: string[];
}

export function getWorkshopSheetSummary(token: string): Promise<WorkshopSheetSummary> {
  return request<WorkshopSheetSummary>("api/workshop/sheets/summary", undefined, token);
}

export function listWorkshopSheetReceipts(
  token: string,
  params: { dateFrom?: string; dateTo?: string }
): Promise<{ items: WorkshopSheetReceipt[]; dateFrom: string; dateTo: string }> {
  return request<{ items: WorkshopSheetReceipt[]; dateFrom: string; dateTo: string }>(
    withQuery("api/workshop/sheets/receipts", { dateFrom: params.dateFrom, dateTo: params.dateTo }),
    undefined,
    token
  );
}

export function createWorkshopSheetReceipt(
  token: string,
  input: { receiptDate?: string; quantitySheets: number; supplier?: string | null; costPerSheet?: number | null; notes?: string | null }
): Promise<{ receipt: WorkshopSheetReceipt; sheetBalance: { availableSheets: number } }> {
  return request<{ receipt: WorkshopSheetReceipt; sheetBalance: { availableSheets: number } }>(
    "api/workshop/sheets/receipts",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function listWorkshopStock(token: string): Promise<WorkshopStockRow[]> {
  return request<WorkshopStockRow[]>("api/workshop/stock", undefined, token);
}

export function listWorkshopBatches(
  token: string,
  params: { dateFrom?: string; dateTo?: string }
): Promise<{ items: WorkshopBatch[]; dateFrom: string; dateTo: string }> {
  return request<{ items: WorkshopBatch[]; dateFrom: string; dateTo: string }>(
    withQuery("api/workshop/batches", { dateFrom: params.dateFrom, dateTo: params.dateTo }),
    undefined,
    token
  );
}

export function createWorkshopBatch(
  token: string,
  input: {
    batchDate?: string;
    notes?: string | null;
    lines: Array<{
      productId: string;
      sheetsUsed: number;
      actualGood: number;
      actualDamaged: number;
      actualWaste: number;
      notes?: string | null;
    }>;
  }
): Promise<{ batch: WorkshopBatch; sheetBalance: { availableSheets: number } }> {
  return request<{ batch: WorkshopBatch; sheetBalance: { availableSheets: number } }>(
    "api/workshop/batches",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function listInventoryStock(token: string, params: { shopId?: string }): Promise<InventoryStockRow[]> {
  return request<InventoryStockRow[]>(withQuery("api/inventory/stock", { shopId: params.shopId }), undefined, token);
}

export function createStockReceipt(
  token: string,
  input: { shopId: string; productId: string; receiptDate?: string; quantity: number; notes?: string | null }
): Promise<StockReceipt> {
  return request<StockReceipt>("api/inventory/receipts", { method: "POST", body: JSON.stringify(input) }, token);
}

export function listDamageEvents(
  token: string,
  params: { shopId?: string; dateFrom?: string; dateTo?: string }
): Promise<{ items: ShopDamageEvent[]; dateFrom: string; dateTo: string }> {
  return request<{ items: ShopDamageEvent[]; dateFrom: string; dateTo: string }>(
    withQuery("api/inventory/damages", { shopId: params.shopId, dateFrom: params.dateFrom, dateTo: params.dateTo }),
    undefined,
    token
  );
}

export function createDamageEvent(
  token: string,
  input: { shopId?: string; productId: string; damageDate?: string; quantity: number; reason?: string | null; notes?: string | null }
): Promise<ShopDamageEvent> {
  return request<ShopDamageEvent>("api/inventory/damages", { method: "POST", body: JSON.stringify(input) }, token);
}

export function listInventoryTransfers(
  token: string,
  params: { shopId?: string; status?: InventoryTransferStatus }
): Promise<InventoryTransfer[]> {
  return request<InventoryTransfer[]>(
    withQuery("api/inventory/transfers", { shopId: params.shopId, status: params.status }),
    undefined,
    token
  );
}

export function createInventoryTransfer(
  token: string,
  input: { toShopId: string; notes?: string | null; lines: Array<{ productId: string; quantity: number }> }
): Promise<InventoryTransfer> {
  return request<InventoryTransfer>("api/inventory/transfers", { method: "POST", body: JSON.stringify(input) }, token);
}

export function shipInventoryTransfer(token: string, transferId: string): Promise<{ id: string; status: "SHIPPED" }> {
  return request<{ id: string; status: "SHIPPED" }>(
    `api/inventory/transfers/${transferId}/ship`,
    { method: "PATCH", body: JSON.stringify({}) },
    token
  );
}

export function receiveInventoryTransfer(
  token: string,
  transferId: string,
  input: { receiveNotes?: string | null; lines: Array<{ lineId: string; quantityDamaged: number }> }
): Promise<{ id: string; status: "RECEIVED" }> {
  return request<{ id: string; status: "RECEIVED" }>(
    `api/inventory/transfers/${transferId}/receive`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listMessagingTemplates(token: string): Promise<MessagingTemplate[]> {
  return request<MessagingTemplate[]>("api/messaging/templates", undefined, token);
}

export function createMessagingTemplate(
  token: string,
  input: { templateKey: string; channel: MessagingChannel; subject?: string | null; body: string; isActive?: boolean; notes?: string | null }
): Promise<MessagingTemplate> {
  return request<MessagingTemplate>("api/messaging/templates", { method: "POST", body: JSON.stringify(input) }, token);
}

export function updateMessagingTemplate(
  token: string,
  templateId: string,
  input: { subject?: string | null; body?: string; isActive?: boolean; notes?: string | null }
): Promise<MessagingTemplate> {
  return request<MessagingTemplate>(`api/messaging/templates/${templateId}`, { method: "PATCH", body: JSON.stringify(input) }, token);
}

export function listMessagingQueue(
  token: string,
  params: { status?: MessagingQueueStatus; channel?: MessagingChannel; dateFrom?: string; dateTo?: string }
): Promise<{ items: MessagingQueueItem[]; dateFrom: string; dateTo: string }> {
  return request<{ items: MessagingQueueItem[]; dateFrom: string; dateTo: string }>(
    withQuery("api/messaging/queue", { status: params.status, channel: params.channel, dateFrom: params.dateFrom, dateTo: params.dateTo }),
    undefined,
    token
  );
}

export function updateMessagingQueueStatus(
  token: string,
  queueId: string,
  input: { status: Exclude<MessagingQueueStatus, "QUEUED">; message?: string | null; errorMessage?: string | null }
): Promise<MessagingQueueItem> {
  return request<MessagingQueueItem>(
    `api/messaging/queue/${queueId}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
    token
  );
}

export function listMessagingLogs(
  token: string,
  params: { queueId?: string; dateFrom?: string; dateTo?: string }
): Promise<{ items: MessagingLogEvent[]; dateFrom: string; dateTo: string }> {
  return request<{ items: MessagingLogEvent[]; dateFrom: string; dateTo: string }>(
    withQuery("api/messaging/logs", { queueId: params.queueId, dateFrom: params.dateFrom, dateTo: params.dateTo }),
    undefined,
    token
  );
}

export function runOverdueReminders(token: string, input: { asOfDate?: string; notes?: string | null }): Promise<OverdueRemindersRunResult> {
  return request<OverdueRemindersRunResult>(
    "api/messaging/jobs/run-overdue-reminders",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}

export function runAdminDailySummary(token: string, input: { date?: string; notes?: string | null }): Promise<AdminDailySummaryRunResult> {
  return request<AdminDailySummaryRunResult>(
    "api/messaging/jobs/run-admin-daily-summary",
    { method: "POST", body: JSON.stringify(input) },
    token
  );
}
