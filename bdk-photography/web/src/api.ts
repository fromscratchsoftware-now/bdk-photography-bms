const rawApiBase = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE = rawApiBase.endsWith("/") || rawApiBase === "" ? rawApiBase : `${rawApiBase}/`;

function buildUrl(path: string): string {
  const normalized = path.replace(/^\//, "");
  if (!API_BASE) {
    // Dev default: rely on Vite proxy ("/api/*").
    return `/${normalized}`;
  }
  return `${API_BASE}${normalized}`;
}

export type AuthResponse = {
  token: string;
  user: {
    id: string;
    fullName: string;
    phone: string;
    isActive: boolean;
    role: { id: string; name: "ADMIN" | "MANAGER" | "SALES"; description?: string | null; notes?: string | null; createdAt: string; updatedAt: string };
    assignments: Array<{
      id: string;
      shopId: string;
      isPrimary: boolean;
      assignedAt: string;
      unassignedAt?: string | null;
      shop: { id: string; name: string; code: string; notes?: string | null; createdAt: string; updatedAt: string };
    }>;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

export type MeResponse = AuthResponse["user"];

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(buildUrl(path), {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...init
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  return body.data as T;
}

export function login(payload: { phone: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>("api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function me(token: string): Promise<MeResponse> {
  return request<MeResponse>("api/auth/me", undefined, token);
}

export type CashMe = {
  userId: string;
  role: "ADMIN" | "MANAGER" | "SALES";
  shops: Array<{ shopId: string; name: string; code: string; isPrimary: boolean }>;
};

export function getCashMe(token: string): Promise<CashMe> {
  return request<CashMe>("api/cash/me", undefined, token);
}
