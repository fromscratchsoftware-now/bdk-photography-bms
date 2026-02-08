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
  users: Array<{ id: string; fullName: string; role: string; shopId?: string }>;
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
  sellingPrice: number;
}

export interface InventoryRow {
  shopId: string;
  productId: string;
  quantity: number;
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
): Promise<void> {
  return request<void>("api/sales", {
    method: "POST",
    body: JSON.stringify(payload)
  }, userId);
}
