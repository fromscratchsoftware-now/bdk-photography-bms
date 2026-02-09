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
