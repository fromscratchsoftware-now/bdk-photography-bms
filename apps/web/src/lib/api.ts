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
