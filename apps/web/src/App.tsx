import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CapitalSummary,
  Product,
  SeedMeta,
  createSale,
  getAdminDashboard,
  getCapitalSummary,
  getInventory,
  getProducts,
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
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [capitalSummary, setCapitalSummary] = useState<CapitalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    shopId: "",
    userId: "",
    productId: "",
    quantity: 1,
    unitPrice: 0
  });

  const salesUsers = useMemo(() => seed?.users.filter((user) => user.role === "SALES") ?? [], [seed]);
  const productLookup = useMemo(() => {
    const map = new Map<string, Product>();
    for (const item of products) {
      map.set(item.id, item);
    }
    return map;
  }, [products]);

  async function refreshData(): Promise<void> {
    const [seedData, productData, inventoryData, adminData, capitalData] = await Promise.all([
      getSeedMeta(),
      getProducts(),
      getInventory(),
      getAdminDashboard(),
      getCapitalSummary()
    ]);

    setSeed(seedData);
    setProducts(productData);
    setInventory(inventoryData);
    setAdminDashboard(adminData);
    setCapitalSummary(capitalData);

    if (!form.shopId && seedData.shops.length > 0) {
      setForm((previous) => ({ ...previous, shopId: seedData.shops[0].id }));
    }
    if (!form.userId && seedData.users.length > 0) {
      const firstSales = seedData.users.find((user) => user.role === "SALES");
      if (firstSales) {
        setForm((previous) => ({ ...previous, userId: firstSales.id }));
      }
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
    refreshData()
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Failed to load data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function submitSale(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await createSale({
        shopId: form.shopId,
        userId: form.userId,
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
      await refreshData();
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

      <section className="grid">
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
      </section>

      <section className="card">
        <h2>Record Cash Sale</h2>
        <form className="form" onSubmit={submitSale}>
          <label>
            Shop
            <select
              value={form.shopId}
              onChange={(event) => setForm((previous) => ({ ...previous, shopId: event.target.value }))}
              required
            >
              {(seed?.shops ?? []).map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sales User
            <select
              value={form.userId}
              onChange={(event) => setForm((previous) => ({ ...previous, userId: event.target.value }))}
              required
            >
              {salesUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          </label>
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

