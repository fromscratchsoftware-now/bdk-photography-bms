import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CapitalSummary,
  Product,
  SalesDashboard,
  type AdminDashboard,
  type AuthUser,
  createSale,
  getAdminDashboard,
  getCapitalSummary,
  getInventory,
  getMe,
  getProducts,
  getSalesDashboard,
  getSeedMeta,
  login,
  signup,
  type InventoryRow,
  type SeedMeta
} from "./lib/api";

function currency(value: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(value);
}

type AuthState = {
  token: string;
  user: AuthUser;
};

const AUTH_STORAGE_KEY = "bdk.auth.v1";

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
    if (typeof parsed.user.fullName !== "string" || !parsed.user.fullName) {
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
  const [shops, setShops] = useState<SeedMeta["shops"]>([]);
  const [auth, setAuth] = useState<AuthState | null>(() => readStoredAuth());

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [salesDashboard, setSalesDashboard] = useState<SalesDashboard | null>(null);
  const [capitalSummary, setCapitalSummary] = useState<CapitalSummary | null>(null);

  const [booting, setBooting] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ mobileNumber: "", password: "" });
  const [signupForm, setSignupForm] = useState({ fullName: "", mobileNumber: "", password: "", shopId: "" });

  const [saleForm, setSaleForm] = useState({
    productId: "",
    quantity: 1,
    unitPrice: 0
  });

  const authUser = auth?.user ?? null;

  const shopLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const shop of shops) {
      map.set(shop.id, shop.name);
    }
    return map;
  }, [shops]);

  const productLookup = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of products) {
      map.set(item.id, item);
    }
    return map;
  }, [products]);

  async function refreshDataForAuth(nextAuth: AuthState): Promise<void> {
    const userId = nextAuth.token;

    const [productData, inventoryData] = await Promise.all([getProducts(userId), getInventory(userId)]);
    setProducts(productData);
    setInventory(inventoryData);

    if (!saleForm.productId && productData.length > 0) {
      setSaleForm((previous) => ({
        ...previous,
        productId: productData[0].id,
        unitPrice: productData[0].sellingPrice
      }));
    }

    if (nextAuth.user.role === "ADMIN") {
      const [adminData, capitalData] = await Promise.all([getAdminDashboard(userId), getCapitalSummary(userId)]);
      setAdminDashboard(adminData);
      setCapitalSummary(capitalData);
      setSalesDashboard(null);
      return;
    }

    if (nextAuth.user.role === "SALES") {
      const salesData = await getSalesDashboard(userId);
      setSalesDashboard(salesData);
      setAdminDashboard(null);
      setCapitalSummary(null);
      return;
    }

    setSalesDashboard(null);
    setAdminDashboard(null);
    setCapitalSummary(null);
  }

  function clearSession(message?: string): void {
    setAuth(null);
    writeStoredAuth(null);
    setProducts([]);
    setInventory([]);
    setAdminDashboard(null);
    setSalesDashboard(null);
    setCapitalSummary(null);
    setSaleForm({ productId: "", quantity: 1, unitPrice: 0 });
    setSuccess(null);
    if (message) {
      setError(message);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBooting(true);
      setError(null);

      try {
        const seed = await getSeedMeta();
        if (cancelled) {
          return;
        }
        setShops(seed.shops);
        setSignupForm((previous) => ({
          ...previous,
          shopId: previous.shopId || seed.shops[0]?.id || ""
        }));
      } catch (caught: unknown) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load shops");
        }
      }

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
        setLoadingData(true);
        await refreshDataForAuth(nextAuth);
      } catch {
        if (!cancelled) {
          clearSession("Session expired. Please login again.");
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
          setBooting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingData(true);

    try {
      const response = await login(loginForm);
      const nextAuth: AuthState = { token: response.token, user: response.user };
      setAuth(nextAuth);
      writeStoredAuth(nextAuth);
      await refreshDataForAuth(nextAuth);
      setSuccess("Logged in successfully.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingData(true);

    try {
      const response = await signup(signupForm);
      const nextAuth: AuthState = { token: response.token, user: response.user };
      setAuth(nextAuth);
      writeStoredAuth(nextAuth);
      await refreshDataForAuth(nextAuth);
      setSuccess("Account created successfully.");
      setSignupForm((previous) => ({ ...previous, password: "" }));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Signup failed");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitSale(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "SALES") {
        throw new Error("Only sales users can record sales");
      }

      await createSale(auth.token, {
        paymentMethod: "CASH",
        lines: [
          {
            productId: saleForm.productId,
            quantity: saleForm.quantity,
            unitPrice: saleForm.unitPrice
          }
        ]
      });

      setSuccess("Sale recorded successfully");
      setLoadingData(true);
      await refreshDataForAuth(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to record sale");
    } finally {
      setLoadingData(false);
    }
  }

  if (booting) {
    return <div className="page loading">Loading BDK dashboard...</div>;
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">BDK Photography</p>
        <h1>Business Management System</h1>
        <p className="subtitle">Operations starter for workshop, shops, sales, invoicing, and cash approvals.</p>
      </header>

      {error ? <div className="banner error">{error}</div> : null}
      {success ? <div className="banner success">{success}</div> : null}

      {!auth ? (
        <section className="grid">
          <article className="card">
            <h2>Login</h2>
            <div className="note">
              Demo credentials (seeded):
              <br />
              Admin: <strong>0700000000</strong> / <strong>bdk1234</strong>
            </div>
            <form className="form" onSubmit={submitLogin}>
              <label>
                Mobile Number
                <input
                  value={loginForm.mobileNumber}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                  autoComplete="tel"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="current-password"
                  required
                />
              </label>
              <button type="submit" disabled={loadingData}>
                {loadingData ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </article>

          <article className="card">
            <h2>Sign Up (Sales)</h2>
            <form className="form" onSubmit={submitSignup}>
              <label>
                Full Name
                <input
                  value={signupForm.fullName}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  autoComplete="name"
                  required
                />
              </label>
              <label>
                Mobile Number
                <input
                  value={signupForm.mobileNumber}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                  autoComplete="tel"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={signupForm.password}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Shop
                <select
                  value={signupForm.shopId}
                  onChange={(event) => setSignupForm((prev) => ({ ...prev, shopId: event.target.value }))}
                  required
                >
                  <option value="" disabled>
                    Select a shop
                  </option>
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={loadingData}>
                {loadingData ? "Creating..." : "Create Account"}
              </button>
            </form>
          </article>
        </section>
      ) : (
        <>
          <section className="card">
            <h2>Signed In</h2>
            <div className="meta">
              <div>
                <strong>User:</strong> {authUser?.fullName} ({authUser?.role})
              </div>
              <div>
                <strong>Shop:</strong>{" "}
                {authUser?.shopId ? shopLookup.get(authUser.shopId) ?? authUser.shopId : "N/A"}
              </div>
              <button type="button" data-variant="ghost" onClick={() => clearSession()}>
                Log out
              </button>
            </div>
          </section>

          <section className="grid">
            {authUser?.role === "ADMIN" ? (
              <>
                <article className="card">
                  <h2>Capital Snapshot</h2>
                  <p className="metric">{currency(capitalSummary?.businessCapital ?? 0)}</p>
                  <ul className="stack">
                    <li>Total cash at hand: {currency(capitalSummary?.totalCashAtHand ?? 0)}</li>
                    <li>Cash in bank: {currency(capitalSummary?.bankCash ?? 0)}</li>
                    <li>Inventory value: {currency(capitalSummary?.totalInventoryValue ?? 0)}</li>
                  </ul>
                  {(capitalSummary?.warnings.length ?? 0) > 0 ? (
                    <div className="note">{capitalSummary?.warnings.join(" ")}</div>
                  ) : null}
                </article>

                <article className="card">
                  <h2>Cash Dashboard</h2>
                  <p className="metric">{currency(adminDashboard?.totalCashAtHand ?? 0)}</p>
                  <ul className="stack">
                    <li>Banked cash total: {currency(adminDashboard?.bankCash ?? 0)}</li>
                    <li>Pending transfers: {adminDashboard?.pendingTransfers ?? 0}</li>
                    <li>Pending banking approvals: {adminDashboard?.pendingBankActions ?? 0}</li>
                  </ul>
                </article>
              </>
            ) : null}

            {authUser?.role === "SALES" ? (
              <article className="card">
                <h2>My Cash</h2>
                <p className="metric">{currency(salesDashboard?.cashAtHand ?? 0)}</p>
                <ul className="stack">
                  <li>Pending transfers: {salesDashboard?.pendingTransfers.length ?? 0}</li>
                  <li>Pending banking: {salesDashboard?.pendingBankActions.length ?? 0}</li>
                </ul>
              </article>
            ) : null}
          </section>

          {authUser?.role === "SALES" ? (
            <section className="card">
              <h2>Record Cash Sale</h2>
              <form className="form form--three" onSubmit={submitSale}>
                <label>
                  Product
                  <select
                    value={saleForm.productId}
                    onChange={(event) => {
                      const selected = productLookup.get(event.target.value);
                      setSaleForm((previous) => ({
                        ...previous,
                        productId: event.target.value,
                        unitPrice: selected?.sellingPrice ?? previous.unitPrice
                      }));
                    }}
                    required
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.skuCode} - {product.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={saleForm.quantity}
                    onChange={(event) => setSaleForm((previous) => ({ ...previous, quantity: Number(event.target.value) }))}
                    required
                  />
                </label>
                <label>
                  Unit Price (UGX)
                  <input
                    type="number"
                    min={1}
                    value={saleForm.unitPrice}
                    onChange={(event) => setSaleForm((previous) => ({ ...previous, unitPrice: Number(event.target.value) }))}
                    required
                  />
                </label>
                <button type="submit" disabled={loadingData}>
                  {loadingData ? "Saving..." : "Save Sale"}
                </button>
              </form>
            </section>
          ) : null}

          {authUser?.role === "ADMIN" ? (
            <section className="card">
              <h2>Sales User Cash at Hand</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Cash at Hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(adminDashboard?.users ?? []).map((row) => (
                      <tr key={row.userId}>
                        <td>{row.fullName}</td>
                        <td>{row.role}</td>
                        <td>{currency(row.cashAtHand)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="card">
            <h2>Inventory by Shop and SKU</h2>
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Shop</th>
                    <th>SKU</th>
                    <th>Stock On Hand</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => {
                    const shopName = shopLookup.get(row.shopId) ?? row.shopId;
                    const sku = productLookup.get(row.productId)?.skuCode ?? row.productId;
                    return (
                      <tr key={`${row.shopId}-${row.productId}`}>
                        <td>{shopName}</td>
                        <td>{sku}</td>
                        <td>{row.quantity}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
