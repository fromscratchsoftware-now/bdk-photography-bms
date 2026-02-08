import { FormEvent, useEffect, useMemo, useState } from "react";
import { type AuthUser, type Shop, getMe, listShops, listUsers, login } from "./lib/api";

type AuthState = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "bdk.auth.phase1.v1";

function readStoredAuth(): AuthState | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    if (typeof parsed.token !== "string" || !parsed.token) {
      return null;
    }
    if (!parsed.user || typeof parsed.user !== "object") {
      return null;
    }
    if (typeof parsed.user.id !== "string" || !parsed.user.id) {
      return null;
    }
    if (parsed.user.role !== "ADMIN" && parsed.user.role !== "MANAGER" && parsed.user.role !== "SALES") {
      return null;
    }
    return parsed as AuthState;
  } catch {
    return null;
  }
}

function writeStoredAuth(auth: AuthState | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!auth) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
}

export default function App(): JSX.Element {
  const [auth, setAuth] = useState<AuthState | null>(() => readStoredAuth());
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ mobileNumber: "", password: "" });

  const authUser = auth?.user ?? null;

  const canViewUsers = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";

  const shopCodesForUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of users) {
      map.set(
        user.id,
        (user.shops ?? [])
          .map((s) => s.code)
          .filter(Boolean)
          .join(", ")
      );
    }
    return map;
  }, [users]);

  function clearSession(message?: string): void {
    setAuth(null);
    writeStoredAuth(null);
    setShops([]);
    setUsers([]);
    setSuccess(null);
    setError(message ?? null);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBooting(true);
      setError(null);

      const stored = readStoredAuth();
      if (!stored) {
        if (!cancelled) {
          setBooting(false);
        }
        return;
      }

      try {
        const me = await getMe(stored.token);
        if (cancelled) {
          return;
        }
        const nextAuth = { token: stored.token, user: me };
        setAuth(nextAuth);
        writeStoredAuth(nextAuth);
      } catch {
        if (!cancelled) {
          clearSession("Session expired. Please login again.");
        }
      } finally {
        if (!cancelled) {
          setBooting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!auth) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [shopData, userData] = await Promise.all([
          listShops(auth.token),
          canViewUsers ? listUsers(auth.token) : Promise.resolve([])
        ]);

        if (cancelled) {
          return;
        }

        setShops(shopData);
        setUsers(userData);
      } catch (caught: unknown) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth?.token, canViewUsers]);

  async function submitLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await login(loginForm);
      const nextAuth: AuthState = { token: response.token, user: response.user };
      setAuth(nextAuth);
      writeStoredAuth(nextAuth);
      setLoginForm({ mobileNumber: "", password: "" });
      setSuccess("Logged in successfully.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return <div className="page loading">Loading...</div>;
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">BDK Photography</p>
        <h1>Business Management System</h1>
        <p className="subtitle">
          Phase 1 foundation: authentication (JWT), role-based access, and shop visibility.
        </p>

        <div className="divider" style={{ background: "rgba(255,255,255,0.22)" }} />

        {authUser ? (
          <div className="meta" style={{ color: "rgba(248,250,252,0.95)" }}>
            <div>
              <strong>{authUser.fullName}</strong>
              <div className="hint" style={{ color: "rgba(248,250,252,0.8)" }}>
                {authUser.role} • {authUser.mobileNumber}
              </div>
            </div>
            <div className="hint" style={{ color: "rgba(248,250,252,0.8)" }}>
              Signed in
            </div>
            <button data-variant="ghost" onClick={() => clearSession("Logged out.")}>
              Logout
            </button>
          </div>
        ) : (
          <div className="note" style={{ background: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.25)", color: "rgba(248,250,252,0.9)" }}>
            Login is required before accessing the portal.
          </div>
        )}
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {success ? <div className="banner success">{success}</div> : null}

      <div className="grid">
        {!authUser ? (
          <>
            <section className="card">
              <h2>Login</h2>
              <form className="form" onSubmit={submitLogin}>
                <label>
                  Mobile number
                  <input
                    value={loginForm.mobileNumber}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                    placeholder="0700 000 000"
                    autoComplete="username"
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </label>
                <button type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </button>
              </form>
              <p className="hint">
                If you don’t have credentials yet, ask an admin to create your account.
              </p>
            </section>

            <section className="card">
              <h2>What’s Ready</h2>
              <ul className="stack">
                <li>MySQL foundation tables (users, shops, roles, audit logs, reconciliation locks)</li>
                <li>JWT login and `/me`</li>
                <li>RBAC for shops and users listing</li>
              </ul>
              <div className="note">
                Next phases will add inventory, sales, invoicing, credit/installments, cash workflows, expenses, and reporting.
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="card">
              <h2>Profile</h2>
              <ul className="stack">
                <li>
                  <strong>Name:</strong> {authUser.fullName}
                </li>
                <li>
                  <strong>Role:</strong> {authUser.role}
                </li>
                <li>
                  <strong>Phone:</strong> {authUser.mobileNumber}
                </li>
              </ul>
              {loading ? <p className="hint">Refreshing data...</p> : null}
            </section>

            <section className="card">
              <h2>Shops</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shops.length ? (
                      shops.map((shop) => (
                        <tr key={shop.id}>
                          <td>{shop.code}</td>
                          <td>{shop.name}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2}>No shops available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {canViewUsers ? (
              <section className="card">
                <h2>Users</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Shops</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.length ? (
                        users.map((user) => (
                          <tr key={user.id}>
                            <td>{user.fullName}</td>
                            <td>{user.role}</td>
                            <td>{user.mobileNumber}</td>
                            <td>{shopCodesForUser.get(user.id) || "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>No users available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="card">
                <h2>Users</h2>
                <div className="note">You don’t have permission to view other users.</div>
              </section>
            )}

            <section className="card">
              <h2>Next Modules</h2>
              <ul className="stack">
                <li>Workshop (full sheets, cutting, yield, waste)</li>
                <li>Inventory and transfers (workshop → shops)</li>
                <li>Sales, invoices, credit & installments</li>
                <li>Cash tracking with approvals, banking</li>
                <li>Expenses with payment-source logic</li>
                <li>Capital dashboard + exports</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

