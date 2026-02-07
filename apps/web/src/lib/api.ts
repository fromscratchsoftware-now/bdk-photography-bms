const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json"
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
  return request<SeedMeta>("/api/meta/seed");
}

export function getProducts(): Promise<Product[]> {
  return request<Product[]>("/api/products");
}

export function getInventory(): Promise<InventoryRow[]> {
  return request<InventoryRow[]>("/api/products/inventory");
}

export function getAdminDashboard(): Promise<AdminDashboard> {
  return request<AdminDashboard>("/api/cash/dashboard/admin");
}

export function getCapitalSummary(): Promise<CapitalSummary> {
  return request<CapitalSummary>("/api/cash/capital/summary");
}

export function createSale(payload: {
  shopId: string;
  userId: string;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  notes?: string;
}): Promise<void> {
  return request<void>("/api/sales", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

