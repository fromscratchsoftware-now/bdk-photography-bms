import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CapitalSummary,
  Product,
  SalesDashboard,
  SeedMeta,
  createSale,
  getAdminDashboard,
  getCapitalSummary,
  getInventory,
  getProducts,
  getSalesDashboard,
  getSeedMeta,
  type AdminDashboard,
  type InventoryRow
} from "./lib/api";

function currency(value: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0
  }).format(value);
}

export default function App(): JSX.Element {
  const [seed, setSeed] = useState<SeedMeta | null>(null);
  const [actingUserId, setActingUserId] = useState<string>("");
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [salesDashboard, setSalesDashboard] = useState<SalesDashboard | null>(null);
  const [capitalSummary, setCapitalSummary] = useState<CapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    productId: "",
    quantity: 1,
    unitPrice: 0
  });

  const actingUser = useMemo(
    () => seed?.users.find((user) => user.id === actingUserId) ?? null,
    [seed, actingUserId]
  );
  const productLookup = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of products) {
      map.set(item.id, item);
    }
    return map;
  }, [products]);

  async function refreshDataForUser(userId: string, seedData: SeedMeta): Promise<void> {
    const selected = seedData.users.find((user) => user.id === userId);
    if (!selected) {
      throw new Error("Selected user not found");
    }

    const [productData, inventoryData] = await Promise.all([getProducts(userId), getInventory(userId)]);
    setProducts(productData);
    setInventory(inventoryData);

    if (selected.role === "ADMIN") {
      const [adminData, capitalData] = await Promise.all([getAdminDashboard(userId), getCapitalSummary(userId)]);
      setAdminDashboard(adminData);
      setCapitalSummary(capitalData);
      setSalesDashboard(null);
    } else if (selected.role === "SALES") {
      const salesData = await getSalesDashboard(userId);
      setSalesDashboard(salesData);
      setAdminDashboard(null);
      setCapitalSummary(null);
    } else {
      setAdminDashboard(null);
      setCapitalSummary(null);
      setSalesDashboard(null);
    }

    if (!form.productId && productData.length > 0) {
      setForm((previous) => ({
        ...previous,
        productId: productData[0].id,
        unitPrice: productData[0].sellingPrice
      }));
    }
  }

  useEffect(() => {
    setLoading(true);
    getSeedMeta()
      .then(async (seedData) => {
        setSeed(seedData);
        const preferred = seedData.users.find((user) => user.role === "SALES") ?? seedData.users[0];
        if (!preferred) {
          throw new Error("No users configured");
        }
        setActingUserId(preferred.id);
        await refreshDataForUser(preferred.id, seedData);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!seed || !actingUserId) {
      return;
    }
    setError(null);
    setSuccess(null);
    refreshDataForUser(actingUserId, seed).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Failed to refresh data");
    });
  }, [actingUserId]);

  async function submitSale(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!actingUser) {
        throw new Error("Select a user");
      }
      if (actingUser.role !== "SALES") {
        throw new Error("Only sales users can record sales");
      }

      await createSale(actingUser.id, {
        paymentMethod: "CASH",
        lines: [
          {
            productId: form.productId,
            quantity: form.quantity,
            unitPrice: form.unitPrice
          }
        ]
      });
      setSuccess("Sale recorded successfully");
      await refreshDataForUser(actingUser.id, seed!);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to record sale");
    }
  }

  if (loading) {
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

      <section className="card">
        <h2>Acting User</h2>
        <div className="form">
          <label>
            User
            <select value={actingUserId} onChange={(event) => setActingUserId(event.target.value)} required>
              {(seed?.users ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName} ({user.role})
                </option>
              ))}
            </select>
          </label>
          <div>
            <div>
              <strong>Shop:</strong> {actingUser?.shopId ?? "N/A"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid">
        {actingUser?.role === "ADMIN" ? (
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

        {actingUser?.role === "SALES" ? (
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

      {actingUser?.role === "SALES" ? (
        <section className="card">
          <h2>Record Cash Sale</h2>
          <form className="form" onSubmit={submitSale}>
            <label>
              Product
              <select
                value={form.productId}
                onChange={(event) => {
                  const selected = productLookup.get(event.target.value);
                  setForm((previous) => ({
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
                value={form.quantity}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, quantity: Number(event.target.value) }))
                }
                required
              />
            </label>
            <label>
              Unit Price (UGX)
              <input
                type="number"
                min={1}
                value={form.unitPrice}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, unitPrice: Number(event.target.value) }))
                }
                required
              />
            </label>
            <button type="submit">Save Sale</button>
          </form>
        </section>
      ) : null}

      {actingUser?.role === "ADMIN" ? (
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
                const shopName = seed?.shops.find((shop) => shop.id === row.shopId)?.name ?? row.shopId;
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
    </main>
  );
}
