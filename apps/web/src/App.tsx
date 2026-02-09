import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createExpenseCategory,
  createProduct,
  createProductCategory,
  getMe,
  listExpenseCategories,
  listProductCategories,
  listProducts,
  listShops,
  listUsers,
  login,
  updateExpenseCategory,
  updateProduct,
  updateProductCategory,
  type AuthUser,
  type ExpenseCategory,
  type Product,
  type ProductCategory,
  type Shop
} from "./lib/api";

type AuthState = {
  token: string;
  user: AuthUser;
};

type ActiveView = "overview" | "master-data";
type MasterSection = "expense-categories" | "product-categories" | "products";

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

  const [activeView, setActiveView] = useState<ActiveView>("overview");
  const [masterSection, setMasterSection] = useState<MasterSection>("expense-categories");

  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [masterBusy, setMasterBusy] = useState(false);
  const [editingExpenseCategoryId, setEditingExpenseCategoryId] = useState<string | null>(null);
  const [editingExpenseCategoryForm, setEditingExpenseCategoryForm] = useState<{
    name: string;
    notes: string;
    isActive: boolean;
  } | null>(null);
  const [newExpenseCategoryForm, setNewExpenseCategoryForm] = useState({ name: "", notes: "" });

  const [editingProductCategoryId, setEditingProductCategoryId] = useState<string | null>(null);
  const [editingProductCategoryForm, setEditingProductCategoryForm] = useState<{
    name: string;
    notes: string;
    isActive: boolean;
  } | null>(null);
  const [newProductCategoryForm, setNewProductCategoryForm] = useState({ name: "", notes: "" });

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductForm, setEditingProductForm] = useState<{
    skuCode: string;
    name: string;
    categoryId: string;
    productType: "BOARD" | "NON_BOARD";
    unitOfMeasure: string;
    costPrice: string;
    sellingPrice: string;
    isActive: boolean;
    boardSizeCode: "A4C" | "A3C" | "A2C";
    notes: string;
  } | null>(null);
  const [newProductForm, setNewProductForm] = useState<{
    skuCode: string;
    name: string;
    categoryId: string;
    productType: "BOARD" | "NON_BOARD";
    unitOfMeasure: string;
    costPrice: string;
    sellingPrice: string;
    isActive: boolean;
    boardSizeCode: "A4C" | "A3C" | "A2C";
    notes: string;
  }>({
    skuCode: "",
    name: "",
    categoryId: "",
    productType: "BOARD",
    unitOfMeasure: "piece",
    costPrice: "",
    sellingPrice: "",
    isActive: true,
    boardSizeCode: "A4C",
    notes: ""
  });

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ mobileNumber: "", password: "" });

  const authUser = auth?.user ?? null;

  const canViewUsers = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const canManageMasterData = authUser?.role === "ADMIN";

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
    setActiveView("overview");
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

  async function refreshMasterData(): Promise<void> {
    if (!auth || !canManageMasterData) {
      return;
    }
    setMasterBusy(true);
    setError(null);
    try {
      const [expenseData, categoryData, productData] = await Promise.all([
        listExpenseCategories(auth.token),
        listProductCategories(auth.token),
        listProducts(auth.token)
      ]);
      setExpenseCategories(expenseData);
      setProductCategories(categoryData);
      setProducts(productData);

      if (!newProductForm.categoryId && categoryData.length) {
        setNewProductForm((prev) => ({ ...prev, categoryId: categoryData[0].id }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load master data");
    } finally {
      setMasterBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canManageMasterData) {
      return;
    }
    if (activeView !== "master-data") {
      return;
    }
    void refreshMasterData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token, canManageMasterData]);

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

  const yieldPerSheet =
    newProductForm.productType === "BOARD"
      ? newProductForm.boardSizeCode === "A4C"
        ? 48
        : newProductForm.boardSizeCode === "A3C"
          ? 24
          : 12
      : null;

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

      {authUser ? (
        <div className="tabs">
          <button
            className={`tab ${activeView === "overview" ? "isActive" : ""}`}
            type="button"
            onClick={() => setActiveView("overview")}
          >
            Overview
          </button>
          {canManageMasterData ? (
            <button
              className={`tab ${activeView === "master-data" ? "isActive" : ""}`}
              type="button"
              onClick={() => setActiveView("master-data")}
            >
              Master Data
            </button>
          ) : null}
        </div>
      ) : null}

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
        ) : activeView === "overview" ? (
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
        ) : (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Phase 2: Master Data</h2>
              <p className="hint">
                Admin-only setup for dynamic expense categories, product categories, and products (boards and non-boards).
              </p>

              <div className="tabs" style={{ marginTop: "0.9rem" }}>
                <button
                  className={`tab ${masterSection === "expense-categories" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMasterSection("expense-categories")}
                >
                  Expense Categories
                </button>
                <button
                  className={`tab ${masterSection === "product-categories" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMasterSection("product-categories")}
                >
                  Product Categories
                </button>
                <button
                  className={`tab ${masterSection === "products" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMasterSection("products")}
                >
                  Products
                </button>
              </div>
            </section>

            {masterSection === "expense-categories" ? (
              <>
                <section className="card">
                  <h2>Create Expense Category</h2>
                  <form
                    className="form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setMasterBusy(true);
                      try {
                        await createExpenseCategory(auth.token, {
                          name: newExpenseCategoryForm.name,
                          notes: newExpenseCategoryForm.notes || undefined
                        });
                        setNewExpenseCategoryForm({ name: "", notes: "" });
                        setSuccess("Expense category created.");
                        await refreshMasterData();
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to create expense category");
                      } finally {
                        setMasterBusy(false);
                      }
                    }}
                  >
                    <label>
                      Name
                      <input
                        value={newExpenseCategoryForm.name}
                        onChange={(event) =>
                          setNewExpenseCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input
                        value={newExpenseCategoryForm.notes}
                        onChange={(event) =>
                          setNewExpenseCategoryForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </label>
                    <button type="submit" disabled={masterBusy}>
                      {masterBusy ? "Saving..." : "Create"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Expense Categories</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Active</th>
                          <th>Notes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseCategories.length ? (
                          expenseCategories.map((cat) => (
                            <tr key={cat.id} className={editingExpenseCategoryId === cat.id ? "isSelected" : ""}>
                              <td>{cat.name}</td>
                              <td>{cat.isActive ? "Yes" : "No"}</td>
                              <td>{cat.notes ?? "-"}</td>
                              <td>
                                <div className="approvalActions">
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      setEditingExpenseCategoryId(cat.id);
                                      setEditingExpenseCategoryForm({
                                        name: cat.name,
                                        notes: cat.notes ?? "",
                                        isActive: cat.isActive
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={async () => {
                                      if (!auth) {
                                        return;
                                      }
                                      setError(null);
                                      setSuccess(null);
                                      setMasterBusy(true);
                                      try {
                                        await updateExpenseCategory(auth.token, cat.id, { isActive: !cat.isActive });
                                        setSuccess("Expense category updated.");
                                        await refreshMasterData();
                                      } catch (caught: unknown) {
                                        setError(caught instanceof Error ? caught.message : "Failed to update category");
                                      } finally {
                                        setMasterBusy(false);
                                      }
                                    }}
                                  >
                                    {cat.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No expense categories yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editingExpenseCategoryId && editingExpenseCategoryForm ? (
                    <div className="approvalRow">
                      <div>
                        <p className="subhead">Edit Expense Category</p>
                        <form
                          className="form"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!auth) {
                              return;
                            }
                            setError(null);
                            setSuccess(null);
                            setMasterBusy(true);
                            try {
                              await updateExpenseCategory(auth.token, editingExpenseCategoryId, {
                                name: editingExpenseCategoryForm.name,
                                notes: editingExpenseCategoryForm.notes || null,
                                isActive: editingExpenseCategoryForm.isActive
                              });
                              setEditingExpenseCategoryId(null);
                              setEditingExpenseCategoryForm(null);
                              setSuccess("Expense category saved.");
                              await refreshMasterData();
                            } catch (caught: unknown) {
                              setError(caught instanceof Error ? caught.message : "Failed to save category");
                            } finally {
                              setMasterBusy(false);
                            }
                          }}
                        >
                          <label>
                            Name
                            <input
                              value={editingExpenseCategoryForm.name}
                              onChange={(event) =>
                                setEditingExpenseCategoryForm((prev) =>
                                  prev ? { ...prev, name: event.target.value } : prev
                                )
                              }
                              required
                            />
                          </label>
                          <label>
                            Notes
                            <input
                              value={editingExpenseCategoryForm.notes}
                              onChange={(event) =>
                                setEditingExpenseCategoryForm((prev) =>
                                  prev ? { ...prev, notes: event.target.value } : prev
                                )
                              }
                            />
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={editingExpenseCategoryForm.isActive}
                              onChange={(event) =>
                                setEditingExpenseCategoryForm((prev) =>
                                  prev ? { ...prev, isActive: event.target.checked } : prev
                                )
                              }
                            />
                            Active
                          </label>
                          <button type="submit" disabled={masterBusy}>
                            {masterBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            data-variant="ghost"
                            type="button"
                            onClick={() => {
                              setEditingExpenseCategoryId(null);
                              setEditingExpenseCategoryForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {masterSection === "product-categories" ? (
              <>
                <section className="card">
                  <h2>Create Product Category</h2>
                  <form
                    className="form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setMasterBusy(true);
                      try {
                        await createProductCategory(auth.token, {
                          name: newProductCategoryForm.name,
                          notes: newProductCategoryForm.notes || undefined
                        });
                        setNewProductCategoryForm({ name: "", notes: "" });
                        setSuccess("Product category created.");
                        await refreshMasterData();
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to create product category");
                      } finally {
                        setMasterBusy(false);
                      }
                    }}
                  >
                    <label>
                      Name
                      <input
                        value={newProductCategoryForm.name}
                        onChange={(event) =>
                          setNewProductCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input
                        value={newProductCategoryForm.notes}
                        onChange={(event) =>
                          setNewProductCategoryForm((prev) => ({ ...prev, notes: event.target.value }))
                        }
                      />
                    </label>
                    <button type="submit" disabled={masterBusy}>
                      {masterBusy ? "Saving..." : "Create"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Product Categories</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Active</th>
                          <th>Notes</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productCategories.length ? (
                          productCategories.map((cat) => (
                            <tr key={cat.id} className={editingProductCategoryId === cat.id ? "isSelected" : ""}>
                              <td>{cat.name}</td>
                              <td>{cat.isActive ? "Yes" : "No"}</td>
                              <td>{cat.notes ?? "-"}</td>
                              <td>
                                <div className="approvalActions">
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      setEditingProductCategoryId(cat.id);
                                      setEditingProductCategoryForm({
                                        name: cat.name,
                                        notes: cat.notes ?? "",
                                        isActive: cat.isActive
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={async () => {
                                      if (!auth) {
                                        return;
                                      }
                                      setError(null);
                                      setSuccess(null);
                                      setMasterBusy(true);
                                      try {
                                        await updateProductCategory(auth.token, cat.id, { isActive: !cat.isActive });
                                        setSuccess("Product category updated.");
                                        await refreshMasterData();
                                      } catch (caught: unknown) {
                                        setError(caught instanceof Error ? caught.message : "Failed to update category");
                                      } finally {
                                        setMasterBusy(false);
                                      }
                                    }}
                                  >
                                    {cat.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No product categories yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editingProductCategoryId && editingProductCategoryForm ? (
                    <div className="approvalRow">
                      <div>
                        <p className="subhead">Edit Product Category</p>
                        <form
                          className="form"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!auth) {
                              return;
                            }
                            setError(null);
                            setSuccess(null);
                            setMasterBusy(true);
                            try {
                              await updateProductCategory(auth.token, editingProductCategoryId, {
                                name: editingProductCategoryForm.name,
                                notes: editingProductCategoryForm.notes || null,
                                isActive: editingProductCategoryForm.isActive
                              });
                              setEditingProductCategoryId(null);
                              setEditingProductCategoryForm(null);
                              setSuccess("Product category saved.");
                              await refreshMasterData();
                            } catch (caught: unknown) {
                              setError(caught instanceof Error ? caught.message : "Failed to save category");
                            } finally {
                              setMasterBusy(false);
                            }
                          }}
                        >
                          <label>
                            Name
                            <input
                              value={editingProductCategoryForm.name}
                              onChange={(event) =>
                                setEditingProductCategoryForm((prev) =>
                                  prev ? { ...prev, name: event.target.value } : prev
                                )
                              }
                              required
                            />
                          </label>
                          <label>
                            Notes
                            <input
                              value={editingProductCategoryForm.notes}
                              onChange={(event) =>
                                setEditingProductCategoryForm((prev) =>
                                  prev ? { ...prev, notes: event.target.value } : prev
                                )
                              }
                            />
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={editingProductCategoryForm.isActive}
                              onChange={(event) =>
                                setEditingProductCategoryForm((prev) =>
                                  prev ? { ...prev, isActive: event.target.checked } : prev
                                )
                              }
                            />
                            Active
                          </label>
                          <button type="submit" disabled={masterBusy}>
                            {masterBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            data-variant="ghost"
                            type="button"
                            onClick={() => {
                              setEditingProductCategoryId(null);
                              setEditingProductCategoryForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}

            {masterSection === "products" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Create Product</h2>
                  {productCategories.length ? (
                    <form
                      className="form form--three"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!auth) {
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setMasterBusy(true);
                        try {
                          await createProduct(auth.token, {
                            skuCode: newProductForm.skuCode,
                            name: newProductForm.name,
                            categoryId: newProductForm.categoryId,
                            productType: newProductForm.productType,
                            unitOfMeasure: newProductForm.unitOfMeasure,
                            costPrice: newProductForm.costPrice ? Number(newProductForm.costPrice) : null,
                            sellingPrice: Number(newProductForm.sellingPrice),
                            isActive: newProductForm.isActive,
                            boardSizeCode: newProductForm.productType === "BOARD" ? newProductForm.boardSizeCode : null,
                            notes: newProductForm.notes || null
                          });
                          setNewProductForm((prev) => ({
                            ...prev,
                            skuCode: "",
                            name: "",
                            costPrice: "",
                            sellingPrice: "",
                            notes: ""
                          }));
                          setSuccess("Product created.");
                          await refreshMasterData();
                        } catch (caught: unknown) {
                          setError(caught instanceof Error ? caught.message : "Failed to create product");
                        } finally {
                          setMasterBusy(false);
                        }
                      }}
                    >
                      <label>
                        Category
                        <select
                          value={newProductForm.categoryId}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({ ...prev, categoryId: event.target.value }))
                          }
                          required
                        >
                          {productCategories
                            .filter((c) => c.isActive)
                            .map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Type
                        <select
                          value={newProductForm.productType}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({
                              ...prev,
                              productType: event.target.value === "NON_BOARD" ? "NON_BOARD" : "BOARD"
                            }))
                          }
                        >
                          <option value="BOARD">BOARD</option>
                          <option value="NON_BOARD">NON_BOARD</option>
                        </select>
                      </label>
                      {newProductForm.productType === "BOARD" ? (
                        <label>
                          Board Size Code
                          <select
                            value={newProductForm.boardSizeCode}
                            onChange={(event) =>
                              setNewProductForm((prev) => ({
                                ...prev,
                                boardSizeCode: (event.target.value as "A4C" | "A3C" | "A2C") || "A4C"
                              }))
                            }
                          >
                            <option value="A4C">A4C (48/sheet)</option>
                            <option value="A3C">A3C (24/sheet)</option>
                            <option value="A2C">A2C (12/sheet)</option>
                          </select>
                        </label>
                      ) : null}
                      <label>
                        SKU Code
                        <input
                          value={newProductForm.skuCode}
                          onChange={(event) => setNewProductForm((prev) => ({ ...prev, skuCode: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Name
                        <input
                          value={newProductForm.name}
                          onChange={(event) => setNewProductForm((prev) => ({ ...prev, name: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Unit of Measure
                        <input
                          value={newProductForm.unitOfMeasure}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({ ...prev, unitOfMeasure: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Cost Price (optional)
                        <input
                          type="number"
                          min={0}
                          value={newProductForm.costPrice}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({ ...prev, costPrice: event.target.value }))
                          }
                        />
                      </label>
                      <label>
                        Selling Price
                        <input
                          type="number"
                          min={1}
                          value={newProductForm.sellingPrice}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({ ...prev, sellingPrice: event.target.value }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Notes (optional)
                        <input
                          value={newProductForm.notes}
                          onChange={(event) => setNewProductForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={newProductForm.isActive}
                          onChange={(event) =>
                            setNewProductForm((prev) => ({ ...prev, isActive: event.target.checked }))
                          }
                        />
                        Active
                      </label>
                      <button type="submit" disabled={masterBusy}>
                        {masterBusy ? "Saving..." : "Create Product"}
                      </button>
                    </form>
                  ) : (
                    <div className="note">Create a product category first.</div>
                  )}

                  {newProductForm.productType === "BOARD" ? (
                    <p className="hint">Yield per full sheet: {yieldPerSheet} pcs</p>
                  ) : null}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Products</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Sell</th>
                          <th>Active</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {products.length ? (
                          products.map((p) => (
                            <tr key={p.id} className={editingProductId === p.id ? "isSelected" : ""}>
                              <td>{p.skuCode}</td>
                              <td>{p.name}</td>
                              <td>
                                {p.productType}
                                {p.productType === "BOARD" && p.boardSizeCode ? (
                                  <span className="hint"> ({p.boardSizeCode}, {p.yieldPerSheet}/sheet)</span>
                                ) : null}
                              </td>
                              <td>{p.categoryName}</td>
                              <td>{p.sellingPrice}</td>
                              <td>{p.isActive ? "Yes" : "No"}</td>
                              <td>
                                <div className="approvalActions">
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      setEditingProductId(p.id);
                                      setEditingProductForm({
                                        skuCode: p.skuCode,
                                        name: p.name,
                                        categoryId: p.categoryId,
                                        productType: p.productType,
                                        unitOfMeasure: p.unitOfMeasure,
                                        costPrice: p.costPrice != null ? String(p.costPrice) : "",
                                        sellingPrice: String(p.sellingPrice),
                                        isActive: p.isActive,
                                        boardSizeCode: p.boardSizeCode ?? "A4C",
                                        notes: p.notes ?? ""
                                      });
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={async () => {
                                      if (!auth) {
                                        return;
                                      }
                                      setError(null);
                                      setSuccess(null);
                                      setMasterBusy(true);
                                      try {
                                        await updateProduct(auth.token, p.id, { isActive: !p.isActive });
                                        setSuccess("Product updated.");
                                        await refreshMasterData();
                                      } catch (caught: unknown) {
                                        setError(caught instanceof Error ? caught.message : "Failed to update product");
                                      } finally {
                                        setMasterBusy(false);
                                      }
                                    }}
                                  >
                                    {p.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No products yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editingProductId && editingProductForm ? (
                    <div className="approvalRow">
                      <div>
                        <p className="subhead">Edit Product</p>
                        <form
                          className="form form--three"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!auth) {
                              return;
                            }
                            setError(null);
                            setSuccess(null);
                            setMasterBusy(true);
                            try {
                              await updateProduct(auth.token, editingProductId, {
                                skuCode: editingProductForm.skuCode,
                                name: editingProductForm.name,
                                categoryId: editingProductForm.categoryId,
                                productType: editingProductForm.productType,
                                unitOfMeasure: editingProductForm.unitOfMeasure,
                                costPrice: editingProductForm.costPrice ? Number(editingProductForm.costPrice) : null,
                                sellingPrice: Number(editingProductForm.sellingPrice),
                                isActive: editingProductForm.isActive,
                                boardSizeCode:
                                  editingProductForm.productType === "BOARD"
                                    ? editingProductForm.boardSizeCode
                                    : null,
                                notes: editingProductForm.notes || null
                              });
                              setEditingProductId(null);
                              setEditingProductForm(null);
                              setSuccess("Product saved.");
                              await refreshMasterData();
                            } catch (caught: unknown) {
                              setError(caught instanceof Error ? caught.message : "Failed to save product");
                            } finally {
                              setMasterBusy(false);
                            }
                          }}
                        >
                          <label>
                            Category
                            <select
                              value={editingProductForm.categoryId}
                              onChange={(event) =>
                                setEditingProductForm((prev) => (prev ? { ...prev, categoryId: event.target.value } : prev))
                              }
                              required
                            >
                              {productCategories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Type
                            <select
                              value={editingProductForm.productType}
                              onChange={(event) =>
                                setEditingProductForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        productType: event.target.value === "NON_BOARD" ? "NON_BOARD" : "BOARD"
                                      }
                                    : prev
                                )
                              }
                            >
                              <option value="BOARD">BOARD</option>
                              <option value="NON_BOARD">NON_BOARD</option>
                            </select>
                          </label>
                          {editingProductForm.productType === "BOARD" ? (
                            <label>
                              Board Size Code
                              <select
                                value={editingProductForm.boardSizeCode}
                                onChange={(event) =>
                                  setEditingProductForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          boardSizeCode: (event.target.value as "A4C" | "A3C" | "A2C") || "A4C"
                                        }
                                      : prev
                                  )
                                }
                              >
                                <option value="A4C">A4C (48/sheet)</option>
                                <option value="A3C">A3C (24/sheet)</option>
                                <option value="A2C">A2C (12/sheet)</option>
                              </select>
                            </label>
                          ) : null}
                          <label>
                            SKU Code
                            <input
                              value={editingProductForm.skuCode}
                              onChange={(event) =>
                                setEditingProductForm((prev) => (prev ? { ...prev, skuCode: event.target.value } : prev))
                              }
                              required
                            />
                          </label>
                          <label>
                            Name
                            <input
                              value={editingProductForm.name}
                              onChange={(event) =>
                                setEditingProductForm((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                              }
                              required
                            />
                          </label>
                          <label>
                            Unit of Measure
                            <input
                              value={editingProductForm.unitOfMeasure}
                              onChange={(event) =>
                                setEditingProductForm((prev) =>
                                  prev ? { ...prev, unitOfMeasure: event.target.value } : prev
                                )
                              }
                              required
                            />
                          </label>
                          <label>
                            Cost Price (optional)
                            <input
                              type="number"
                              min={0}
                              value={editingProductForm.costPrice}
                              onChange={(event) =>
                                setEditingProductForm((prev) =>
                                  prev ? { ...prev, costPrice: event.target.value } : prev
                                )
                              }
                            />
                          </label>
                          <label>
                            Selling Price
                            <input
                              type="number"
                              min={1}
                              value={editingProductForm.sellingPrice}
                              onChange={(event) =>
                                setEditingProductForm((prev) =>
                                  prev ? { ...prev, sellingPrice: event.target.value } : prev
                                )
                              }
                              required
                            />
                          </label>
                          <label className="checkbox">
                            <input
                              type="checkbox"
                              checked={editingProductForm.isActive}
                              onChange={(event) =>
                                setEditingProductForm((prev) =>
                                  prev ? { ...prev, isActive: event.target.checked } : prev
                                )
                              }
                            />
                            Active
                          </label>
                          <label>
                            Notes
                            <input
                              value={editingProductForm.notes}
                              onChange={(event) =>
                                setEditingProductForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                              }
                            />
                          </label>
                          <button type="submit" disabled={masterBusy}>
                            {masterBusy ? "Saving..." : "Save"}
                          </button>
                          <button
                            data-variant="ghost"
                            type="button"
                            onClick={() => {
                              setEditingProductId(null);
                              setEditingProductForm(null);
                            }}
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
