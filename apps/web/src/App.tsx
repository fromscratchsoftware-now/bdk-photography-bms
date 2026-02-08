import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  type AdminDashboard,
  type AuthUser,
  type BankAction,
  type CapitalSummary,
  type CashActions,
  type CashTransfer,
  type Customer,
  type Expense,
  type InventoryRow,
  type Invoice,
  type InvoicePayment,
  type Product,
  type Sale,
  type SalesDashboard,
  type SeedMeta,
  addInvoicePayment,
  createBankAction,
  createCustomer,
  createExpense,
  createInvoice,
  createProduct,
  createUser,
  createSale,
  createTransfer,
  decideBankAction,
  decideTransfer,
  getAdminDashboard,
  getCapitalSummary,
  getCashActions,
  getInventory,
  getMe,
  getProducts,
  getSalesDashboard,
  getSeedMeta,
  listCustomers,
  listInvoicePayments,
  listInvoices,
  listOverdueInvoices,
  listSales,
  login,
  receiveStock,
  setInvoiceStatus
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

type View = "dashboard" | "sales" | "invoices" | "cash" | "inventory" | "admin";

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
  const [seedUsers, setSeedUsers] = useState<SeedMeta["users"]>([]);
  const [auth, setAuth] = useState<AuthState | null>(() => readStoredAuth());
  const [view, setView] = useState<View>("dashboard");

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [adminDashboard, setAdminDashboard] = useState<AdminDashboard | null>(null);
  const [salesDashboard, setSalesDashboard] = useState<SalesDashboard | null>(null);
  const [capitalSummary, setCapitalSummary] = useState<CapitalSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [cashActions, setCashActions] = useState<CashActions | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([]);

  const [booting, setBooting] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({ mobileNumber: "", password: "" });
  const [newUserDraft, setNewUserDraft] = useState<{
    fullName: string;
    role: "ADMIN" | "MANAGER" | "SALES";
    shopId: string;
    mobileNumber: string;
    password: string;
  }>({
    fullName: "",
    role: "SALES",
    shopId: "",
    mobileNumber: "",
    password: ""
  });

  const [saleDraft, setSaleDraft] = useState<{
    paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";
    notes: string;
    lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }>({
    paymentMethod: "CASH",
    notes: "",
    lines: [{ productId: "", quantity: 1, unitPrice: 0 }]
  });

  const [expenseDraft, setExpenseDraft] = useState<{
    amount: number;
    category: string;
    date: string;
    notes: string;
    paidBy: "SALESPERSON_CASH" | "ADMIN_BANK";
  }>({
    amount: 0,
    category: "",
    date: "",
    notes: "",
    paidBy: "SALESPERSON_CASH"
  });

  const [transferDraft, setTransferDraft] = useState<{ receiverUserId: string; amount: number }>({
    receiverUserId: "",
    amount: 0
  });

  const [bankDraft, setBankDraft] = useState<{ amount: number }>({ amount: 0 });

  const [receiveDraft, setReceiveDraft] = useState<{ shopId: string; productId: string; quantity: number }>({
    shopId: "",
    productId: "",
    quantity: 1
  });

  const [productDraft, setProductDraft] = useState<{
    skuCode: string;
    name: string;
    category: string;
    productType: "BOARD" | "NON_BOARD";
    unitOfMeasure: string;
    costPrice: string;
    sellingPrice: string;
    active: boolean;
  }>({
    skuCode: "",
    name: "",
    category: "",
    productType: "BOARD",
    unitOfMeasure: "piece",
    costPrice: "",
    sellingPrice: "",
    active: true
  });

  const [customerDraft, setCustomerDraft] = useState<{ mobileNumber: string; firstName: string; lastName: string; email: string }>({
    mobileNumber: "",
    firstName: "",
    lastName: "",
    email: ""
  });

  const [invoiceDraft, setInvoiceDraft] = useState<{
    customerId: string;
    status: "DRAFT" | "ISSUED";
    dueDate: string;
    notes: string;
    lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  }>({
    customerId: "",
    status: "ISSUED",
    dueDate: "",
    notes: "",
    lines: [{ productId: "", quantity: 1, unitPrice: 0 }]
  });

  const [paymentDraft, setPaymentDraft] = useState<{ amount: number; method: "CASH" | "MOBILE_MONEY" | "CARD"; notes: string }>({
    amount: 0,
    method: "CASH",
    notes: ""
  });

  const authUser = auth?.user ?? null;

  useEffect(() => {
    if (!authUser) {
      return;
    }
    if (view === "admin" && authUser.role !== "ADMIN") {
      setView("dashboard");
      return;
    }
    if (view === "sales" && authUser.role !== "ADMIN" && authUser.role !== "SALES") {
      setView("dashboard");
      return;
    }
    if (view === "cash" && authUser.role !== "ADMIN" && authUser.role !== "SALES") {
      setView("dashboard");
      return;
    }
  }, [authUser, view]);

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

  const customerLookup = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const item of customers) {
      map.set(item.id, item);
    }
    return map;
  }, [customers]);

  const userLookup = useMemo(() => {
    const map = new Map<string, SeedMeta["users"][number]>();
    for (const item of seedUsers) {
      map.set(item.id, item);
    }
    return map;
  }, [seedUsers]);

  async function refreshCoreForAuth(nextAuth: AuthState): Promise<void> {
    const userId = nextAuth.token;

    const [productData, inventoryData] = await Promise.all([getProducts(userId), getInventory(userId)]);
    setProducts(productData);
    setInventory(inventoryData);

    setExpenseDraft((previous) => ({
      ...previous,
      paidBy: nextAuth.user.role === "ADMIN" ? "ADMIN_BANK" : "SALESPERSON_CASH"
    }));

    if (productData.length > 0) {
      setSaleDraft((previous) => {
        if (previous.lines.length === 0) {
          return {
            ...previous,
            lines: [{ productId: productData[0].id, quantity: 1, unitPrice: productData[0].sellingPrice }]
          };
        }
        const first = previous.lines[0];
        if (first && !first.productId) {
          const nextLines = [...previous.lines];
          nextLines[0] = {
            ...first,
            productId: productData[0].id,
            unitPrice: productData[0].sellingPrice || first.unitPrice
          };
          return { ...previous, lines: nextLines };
        }
        return previous;
      });

      setInvoiceDraft((previous) => {
        if (previous.lines.length === 0) {
          return {
            ...previous,
            lines: [{ productId: productData[0].id, quantity: 1, unitPrice: productData[0].sellingPrice }]
          };
        }
        const first = previous.lines[0];
        if (first && !first.productId) {
          const nextLines = [...previous.lines];
          nextLines[0] = {
            ...first,
            productId: productData[0].id,
            unitPrice: productData[0].sellingPrice || first.unitPrice
          };
          return { ...previous, lines: nextLines };
        }
        return previous;
      });

      setReceiveDraft((previous) => ({
        ...previous,
        productId: previous.productId || productData[0].id
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

  async function refreshOperationalData(nextAuth: AuthState): Promise<void> {
    const userId = nextAuth.token;

    const tasks: Array<Promise<unknown>> = [];

    // Keep shops/users fresh (used for shop lookups and transfer targets).
    tasks.push(
      getSeedMeta(userId)
        .then((seed) => {
          setShops(seed.shops);
          setSeedUsers(seed.users);
          setNewUserDraft((previous) => ({
            ...previous,
            shopId: previous.shopId || seed.shops[0]?.id || ""
          }));
          setReceiveDraft((previous) => ({
            ...previous,
            shopId: previous.shopId || seed.shops[0]?.id || ""
          }));
        })
        .catch(() => undefined)
    );

    // These endpoints are safe for all authenticated roles.
    tasks.push(
      listCustomers(userId).then((data) => setCustomers(data)).catch(() => setCustomers([]))
    );
    tasks.push(
      listInvoices(userId).then((data) => setInvoices(data)).catch(() => setInvoices([]))
    );
    tasks.push(
      getCashActions(userId).then((data) => setCashActions(data)).catch(() => setCashActions(null))
    );

    if (nextAuth.user.role === "ADMIN" || nextAuth.user.role === "SALES") {
      tasks.push(
        listSales(userId).then((data) => setSales(data)).catch(() => setSales([]))
      );
    } else {
      setSales([]);
    }

    if (nextAuth.user.role === "ADMIN" || nextAuth.user.role === "MANAGER") {
      tasks.push(
        listOverdueInvoices(userId).then((data) => setOverdueInvoices(data)).catch(() => setOverdueInvoices([]))
      );
    } else {
      setOverdueInvoices([]);
    }

    await Promise.all(tasks);
  }

  function clearSession(message?: string): void {
    setAuth(null);
    writeStoredAuth(null);
    setView("dashboard");
    setShops([]);
    setSeedUsers([]);
    setProducts([]);
    setInventory([]);
    setAdminDashboard(null);
    setSalesDashboard(null);
    setCapitalSummary(null);
    setSales([]);
    setCashActions(null);
    setCustomers([]);
    setInvoices([]);
    setOverdueInvoices([]);
    setSelectedInvoiceId("");
    setInvoicePayments([]);
    setSaleDraft({ paymentMethod: "CASH", notes: "", lines: [{ productId: "", quantity: 1, unitPrice: 0 }] });
    setNewUserDraft({ fullName: "", role: "SALES", shopId: "", mobileNumber: "", password: "" });
    setReceiveDraft({ shopId: "", productId: "", quantity: 1 });
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
        await refreshCoreForAuth(nextAuth);
        await refreshOperationalData(nextAuth);
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
      await refreshCoreForAuth(nextAuth);
      await refreshOperationalData(nextAuth);
      setSuccess("Logged in successfully.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitCreateUser(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoadingData(true);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "ADMIN") {
        throw new Error("Only admins can create users");
      }

      const payload = {
        fullName: newUserDraft.fullName.trim(),
        role: newUserDraft.role,
        mobileNumber: newUserDraft.mobileNumber.trim(),
        password: newUserDraft.password
      } as {
        fullName: string;
        role: "ADMIN" | "MANAGER" | "SALES";
        shopId?: string;
        mobileNumber: string;
        password: string;
      };

      if (!payload.fullName || !payload.mobileNumber || !payload.password) {
        throw new Error("Full name, mobile number, and password are required");
      }
      if (payload.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      if (payload.role === "SALES") {
        if (!newUserDraft.shopId) {
          throw new Error("Select a shop for the sales user");
        }
        payload.shopId = newUserDraft.shopId;
      }

      const created = await createUser(auth.token, payload);
      setSuccess(`User created: ${created.fullName}`);
      setNewUserDraft((previous) => ({
        ...previous,
        fullName: "",
        mobileNumber: "",
        password: ""
      }));
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create user");
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

      const lines = saleDraft.lines.filter((line) => line.productId && line.quantity > 0 && line.unitPrice > 0);
      if (lines.length < 1) {
        throw new Error("Add at least one sale line");
      }

      await createSale(auth.token, {
        paymentMethod: saleDraft.paymentMethod,
        notes: saleDraft.notes.trim() ? saleDraft.notes.trim() : undefined,
        lines
      });

      setSuccess("Sale recorded successfully");
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to record sale");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      const payload = {
        amount: Number(expenseDraft.amount),
        category: expenseDraft.category.trim(),
        paidBy: expenseDraft.paidBy,
        date: expenseDraft.date.trim() ? expenseDraft.date.trim() : undefined,
        notes: expenseDraft.notes.trim() ? expenseDraft.notes.trim() : undefined
      } as const;

      await createExpense(auth.token, payload);
      setSuccess("Expense saved.");
      setExpenseDraft((prev) => ({ ...prev, amount: 0, category: "", notes: "" }));
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to save expense");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "SALES") {
        throw new Error("Only sales users can transfer cash");
      }
      await createTransfer(auth.token, {
        receiverUserId: transferDraft.receiverUserId,
        amount: Number(transferDraft.amount)
      });
      setSuccess("Transfer created (pending approval).");
      setTransferDraft({ receiverUserId: "", amount: 0 });
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create transfer");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitBanking(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "SALES") {
        throw new Error("Only sales users can bank cash");
      }
      await createBankAction(auth.token, { amount: Number(bankDraft.amount) });
      setSuccess("Banking request submitted (pending admin approval).");
      setBankDraft({ amount: 0 });
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to submit banking");
    } finally {
      setLoadingData(false);
    }
  }

  async function decideTransferAction(transfer: CashTransfer, status: "APPROVED" | "REJECTED"): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      if (!auth) {
        throw new Error("Please login first");
      }
      await decideTransfer(auth.token, transfer.id, { status });
      setSuccess(`Transfer ${status.toLowerCase()}.`);
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to decide transfer");
    } finally {
      setLoadingData(false);
    }
  }

  async function decideBankingAction(action: BankAction, status: "APPROVED" | "REJECTED"): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      if (!auth) {
        throw new Error("Please login first");
      }
      await decideBankAction(auth.token, action.id, { status });
      setSuccess(`Banking ${status.toLowerCase()}.`);
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to decide banking");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitReceiveStock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "ADMIN") {
        throw new Error("Only admins can receive stock");
      }
      await receiveStock(auth.token, {
        shopId: receiveDraft.shopId,
        productId: receiveDraft.productId,
        quantity: Number(receiveDraft.quantity)
      });
      setSuccess("Stock received.");
      setReceiveDraft((prev) => ({ ...prev, quantity: 1 }));
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to receive stock");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitCreateProduct(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "ADMIN") {
        throw new Error("Only admins can create products");
      }

      const sellingPrice = Number(productDraft.sellingPrice);
      if (!sellingPrice || sellingPrice <= 0) {
        throw new Error("Selling price must be > 0");
      }

      const costPrice = productDraft.costPrice.trim() ? Number(productDraft.costPrice) : undefined;
      if (costPrice !== undefined && Number.isNaN(costPrice)) {
        throw new Error("Cost price must be a number");
      }

      await createProduct(auth.token, {
        skuCode: productDraft.skuCode.trim(),
        name: productDraft.name.trim(),
        category: productDraft.category.trim(),
        productType: productDraft.productType,
        unitOfMeasure: productDraft.unitOfMeasure.trim(),
        costPrice,
        sellingPrice,
        active: productDraft.active
      });

      setSuccess("Product created.");
      setProductDraft((prev) => ({ ...prev, skuCode: "", name: "", category: "", costPrice: "", sellingPrice: "" }));
      setLoadingData(true);
      await refreshCoreForAuth(auth);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create product");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitCreateCustomer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth) {
        throw new Error("Please login first");
      }
      await createCustomer(auth.token, {
        mobileNumber: customerDraft.mobileNumber,
        firstName: customerDraft.firstName.trim(),
        lastName: customerDraft.lastName.trim(),
        email: customerDraft.email.trim() ? customerDraft.email.trim() : undefined
      });
      setSuccess("Customer created.");
      setCustomerDraft({ mobileNumber: "", firstName: "", lastName: "", email: "" });
      setLoadingData(true);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create customer");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitCreateInvoice(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "SALES") {
        throw new Error("Only sales users can create invoices");
      }
      const lines = invoiceDraft.lines.filter((line) => line.productId && line.quantity > 0 && line.unitPrice > 0);
      if (!invoiceDraft.customerId) {
        throw new Error("Select a customer");
      }
      if (lines.length < 1) {
        throw new Error("Add at least one invoice line");
      }

      await createInvoice(auth.token, {
        customerId: invoiceDraft.customerId,
        status: invoiceDraft.status,
        dueDate: invoiceDraft.dueDate.trim() ? invoiceDraft.dueDate.trim() : undefined,
        notes: invoiceDraft.notes.trim() ? invoiceDraft.notes.trim() : undefined,
        lines
      });

      setSuccess("Invoice created.");
      setInvoiceDraft((prev) => ({ ...prev, notes: "", dueDate: "" }));
      setLoadingData(true);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create invoice");
    } finally {
      setLoadingData(false);
    }
  }

  async function selectInvoice(invoiceId: string): Promise<void> {
    setSelectedInvoiceId(invoiceId);
    setInvoicePayments([]);
    setError(null);
    setSuccess(null);
    if (!auth || !invoiceId) {
      return;
    }
    try {
      setLoadingData(true);
      const payments = await listInvoicePayments(auth.token, invoiceId);
      setInvoicePayments(payments);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load invoice payments");
    } finally {
      setLoadingData(false);
    }
  }

  async function submitInvoicePayment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (!auth || !selectedInvoiceId) {
        throw new Error("Select an invoice first");
      }
      await addInvoicePayment(auth.token, selectedInvoiceId, {
        amount: Number(paymentDraft.amount),
        method: paymentDraft.method,
        notes: paymentDraft.notes.trim() ? paymentDraft.notes.trim() : undefined
      });
      setSuccess("Payment added.");
      setPaymentDraft((prev) => ({ ...prev, amount: 0, notes: "" }));
      setLoadingData(true);
      await refreshOperationalData(auth);
      const payments = await listInvoicePayments(auth.token, selectedInvoiceId);
      setInvoicePayments(payments);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to add payment");
    } finally {
      setLoadingData(false);
    }
  }

  async function voidInvoice(invoiceId: string): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      if (!auth || !authUser) {
        throw new Error("Please login first");
      }
      if (authUser.role !== "ADMIN") {
        throw new Error("Only admins can void invoices");
      }
      await setInvoiceStatus(auth.token, invoiceId, { status: "VOID" });
      setSuccess("Invoice updated.");
      setLoadingData(true);
      await refreshOperationalData(auth);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to update invoice");
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
            <p className="hint">New users are created by an Admin after logging in.</p>
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

          <nav className="tabs" aria-label="Primary">
            <button type="button" className={view === "dashboard" ? "tab isActive" : "tab"} onClick={() => setView("dashboard")}>
              Dashboard
            </button>
            {(authUser?.role === "SALES" || authUser?.role === "ADMIN") ? (
              <button type="button" className={view === "sales" ? "tab isActive" : "tab"} onClick={() => setView("sales")}>
                Sales
              </button>
            ) : null}
            <button type="button" className={view === "invoices" ? "tab isActive" : "tab"} onClick={() => setView("invoices")}>
              Invoices
            </button>
            {(authUser?.role === "SALES" || authUser?.role === "ADMIN") ? (
              <button type="button" className={view === "cash" ? "tab isActive" : "tab"} onClick={() => setView("cash")}>
                Cash
              </button>
            ) : null}
            <button type="button" className={view === "inventory" ? "tab isActive" : "tab"} onClick={() => setView("inventory")}>
              Inventory
            </button>
            {authUser?.role === "ADMIN" ? (
              <button type="button" className={view === "admin" ? "tab isActive" : "tab"} onClick={() => setView("admin")}>
                Admin
              </button>
            ) : null}
          </nav>

          {view === "dashboard" ? (
            <>
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
                        <li>Bank cash: {currency(adminDashboard?.bankCash ?? 0)}</li>
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

                {(authUser?.role === "ADMIN" || authUser?.role === "MANAGER") ? (
                  <article className="card">
                    <h2>Overdue Invoices</h2>
                    <p className="metric">{overdueInvoices.length}</p>
                    <p className="hint">Customers with outstanding balances past the due date.</p>
                  </article>
                ) : null}
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
          ) : null}

          {view === "sales" ? (
            <>
              {authUser?.role === "SALES" ? (
                <section className="card">
                  <h2>Record Sale</h2>
                  <form className="form" onSubmit={submitSale}>
                    <label>
                      Payment Method
                      <select
                        value={saleDraft.paymentMethod}
                        onChange={(event) =>
                          setSaleDraft((prev) => ({ ...prev, paymentMethod: event.target.value as Sale["paymentMethod"] }))
                        }
                        required
                      >
                        <option value="CASH">Cash</option>
                        <option value="MOBILE_MONEY">Mobile Money</option>
                        <option value="CARD">Card</option>
                        <option value="CREDIT">Credit</option>
                      </select>
                    </label>
                    <label>
                      Notes (optional)
                      <input value={saleDraft.notes} onChange={(event) => setSaleDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                    </label>
                    <div className="lines">
                      <div className="linesHead">Items</div>
                      {saleDraft.lines.map((line, idx) => {
                        const product = productLookup.get(line.productId);
                        return (
                          <div key={idx} className="lineRow">
                            <select
                              value={line.productId}
                              onChange={(event) => {
                                const selected = productLookup.get(event.target.value);
                                setSaleDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = {
                                    ...next[idx],
                                    productId: event.target.value,
                                    unitPrice: selected?.sellingPrice ?? next[idx].unitPrice
                                  };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                            >
                              <option value="" disabled>
                                Select product
                              </option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.skuCode} - {p.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) => {
                                const qty = Number(event.target.value);
                                setSaleDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = { ...next[idx], quantity: qty };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                              aria-label="Quantity"
                            />
                            <input
                              type="number"
                              min={1}
                              value={line.unitPrice}
                              onChange={(event) => {
                                const unitPrice = Number(event.target.value);
                                setSaleDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = { ...next[idx], unitPrice };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                              aria-label="Unit price"
                            />
                            <div className="lineTotal">{currency(line.quantity * line.unitPrice)}</div>
                            <button
                              type="button"
                              data-variant="ghost"
                              onClick={() =>
                                setSaleDraft((prev) => ({
                                  ...prev,
                                  lines: prev.lines.length > 1 ? prev.lines.filter((_l, i) => i !== idx) : prev.lines
                                }))
                              }
                              disabled={saleDraft.lines.length <= 1}
                            >
                              Remove
                            </button>
                            {idx === 0 && product ? <div className="lineHint">Default: {currency(product.sellingPrice)}</div> : null}
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        data-variant="ghost"
                        onClick={() =>
                          setSaleDraft((prev) => ({
                            ...prev,
                            lines: [
                              ...prev.lines,
                              { productId: products[0]?.id ?? "", quantity: 1, unitPrice: products[0]?.sellingPrice ?? 0 }
                            ]
                          }))
                        }
                      >
                        Add item
                      </button>
                    </div>
                    <button type="submit" disabled={loadingData}>
                      {loadingData ? "Saving..." : "Save Sale"}
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="card">
                <h2>Sales List</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shop</th>
                        <th>By</th>
                        <th>Method</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.slice().reverse().slice(0, 25).map((sale) => (
                        <tr key={sale.id}>
                          <td>{new Date(sale.createdAt).toLocaleString()}</td>
                          <td>{shopLookup.get(sale.shopId) ?? sale.shopId}</td>
                          <td>{userLookup.get(sale.userId)?.fullName ?? sale.userId}</td>
                          <td>{sale.paymentMethod}</td>
                          <td>{currency(sale.subtotal)}</td>
                        </tr>
                      ))}
                      {sales.length === 0 ? (
                        <tr>
                          <td colSpan={5}>No sales found.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {view === "cash" ? (
            <>
              <section className="grid">
                <article className="card">
                  <h2>Balances</h2>
                  {authUser?.role === "SALES" ? (
                    <p className="metric">{currency(salesDashboard?.cashAtHand ?? 0)}</p>
                  ) : (
                    <p className="metric">{currency(adminDashboard?.bankCash ?? cashActions?.bankCash ?? 0)}</p>
                  )}
                  <ul className="stack">
                    <li>Bank cash: {currency(adminDashboard?.bankCash ?? cashActions?.bankCash ?? 0)}</li>
                    {authUser?.role === "SALES" ? <li>My cash at hand: {currency(salesDashboard?.cashAtHand ?? 0)}</li> : null}
                  </ul>
                </article>

                {authUser?.role === "ADMIN" ? (
                  <article className="card">
                    <h2>Banking Approvals</h2>
                    <p className="metric">
                      {(cashActions?.bankActions ?? []).filter((a) => a.status === "PENDING").length}
                    </p>
                    <p className="hint">Approve or reject pending banking deposits.</p>
                  </article>
                ) : null}
              </section>

              <section className="grid">
                <article className="card">
                  <h2>Record Expense</h2>
                  <form className="form" onSubmit={submitExpense}>
                    <label>
                      Payment Source
                      <select
                        value={expenseDraft.paidBy}
                        onChange={(event) =>
                          setExpenseDraft((prev) => ({ ...prev, paidBy: event.target.value as Expense["paidBy"] }))
                        }
                        required
                      >
                        {authUser?.role === "SALES" ? <option value="SALESPERSON_CASH">Salesperson Cash</option> : null}
                        {authUser?.role === "ADMIN" ? <option value="ADMIN_BANK">Admin/Bank</option> : null}
                      </select>
                    </label>
                    <label>
                      Amount (UGX)
                      <input
                        type="number"
                        min={1}
                        value={expenseDraft.amount || ""}
                        onChange={(event) => setExpenseDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                        required
                      />
                    </label>
                    <label>
                      Category
                      <input value={expenseDraft.category} onChange={(event) => setExpenseDraft((prev) => ({ ...prev, category: event.target.value }))} required />
                    </label>
                    <label>
                      Date (optional, YYYY-MM-DD)
                      <input value={expenseDraft.date} onChange={(event) => setExpenseDraft((prev) => ({ ...prev, date: event.target.value }))} />
                    </label>
                    <label>
                      Notes (optional)
                      <input value={expenseDraft.notes} onChange={(event) => setExpenseDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={loadingData}>
                      {loadingData ? "Saving..." : "Save Expense"}
                    </button>
                  </form>
                </article>

                {authUser?.role === "SALES" ? (
                  <article className="card">
                    <h2>Transfer Cash</h2>
                    <form className="form" onSubmit={submitTransfer}>
                      <label>
                        To (Sales User)
                        <select
                          value={transferDraft.receiverUserId}
                          onChange={(event) => setTransferDraft((prev) => ({ ...prev, receiverUserId: event.target.value }))}
                          required
                        >
                          <option value="" disabled>
                            Select receiver
                          </option>
                          {seedUsers
                            .filter((u) => u.role === "SALES" && u.id !== auth.token)
                            .map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.fullName} ({shopLookup.get(u.shopId ?? "") ?? u.shopId ?? "No shop"})
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Amount (UGX)
                        <input
                          type="number"
                          min={1}
                          value={transferDraft.amount || ""}
                          onChange={(event) => setTransferDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                          required
                        />
                      </label>
                      <button type="submit" disabled={loadingData}>
                        {loadingData ? "Submitting..." : "Create Transfer"}
                      </button>
                    </form>

                    <div className="divider" />

                    <h3 className="subhead">Pending Incoming Transfers</h3>
                    {(cashActions?.transfers ?? [])
                      .filter((t) => t.status === "PENDING" && t.receiverUserId === auth.token)
                      .map((t) => (
                        <div key={t.id} className="approvalRow">
                          <div>
                            From: <strong>{userLookup.get(t.senderUserId)?.fullName ?? t.senderUserId}</strong>
                            <br />
                            Amount: <strong>{currency(t.amount)}</strong>
                          </div>
                          <div className="approvalActions">
                            <button type="button" onClick={() => decideTransferAction(t, "APPROVED")} disabled={loadingData}>
                              Approve
                            </button>
                            <button type="button" data-variant="ghost" onClick={() => decideTransferAction(t, "REJECTED")} disabled={loadingData}>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    {(cashActions?.transfers ?? []).filter((t) => t.status === "PENDING" && t.receiverUserId === auth.token).length === 0 ? (
                      <p className="hint">No pending transfers for you.</p>
                    ) : null}
                  </article>
                ) : null}

                {authUser?.role === "SALES" ? (
                  <article className="card">
                    <h2>Bank Cash</h2>
                    <form className="form" onSubmit={submitBanking}>
                      <label>
                        Amount (UGX)
                        <input
                          type="number"
                          min={1}
                          value={bankDraft.amount || ""}
                          onChange={(event) => setBankDraft({ amount: Number(event.target.value) })}
                          required
                        />
                      </label>
                      <button type="submit" disabled={loadingData}>
                        {loadingData ? "Submitting..." : "Submit for Approval"}
                      </button>
                    </form>
                  </article>
                ) : null}

                {authUser?.role === "ADMIN" ? (
                  <article className="card">
                    <h2>Approve Banking</h2>
                    {(cashActions?.bankActions ?? [])
                      .filter((a) => a.status === "PENDING")
                      .slice()
                      .reverse()
                      .map((a) => (
                        <div key={a.id} className="approvalRow">
                          <div>
                            User: <strong>{userLookup.get(a.userId)?.fullName ?? a.userId}</strong>
                            <br />
                            Amount: <strong>{currency(a.amount)}</strong>
                          </div>
                          <div className="approvalActions">
                            <button type="button" onClick={() => decideBankingAction(a, "APPROVED")} disabled={loadingData}>
                              Approve
                            </button>
                            <button type="button" data-variant="ghost" onClick={() => decideBankingAction(a, "REJECTED")} disabled={loadingData}>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    {(cashActions?.bankActions ?? []).filter((a) => a.status === "PENDING").length === 0 ? (
                      <p className="hint">No pending banking approvals.</p>
                    ) : null}
                  </article>
                ) : null}
              </section>

              <section className="card">
                <h2>Recent Cash Actions</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Info</th>
                        <th>Status</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(cashActions?.expenses ?? []).slice().reverse().slice(0, 10).map((e) => (
                        <tr key={e.id}>
                          <td>Expense</td>
                          <td>
                            {e.category} ({e.paidBy})
                          </td>
                          <td>Saved</td>
                          <td>{currency(e.amount)}</td>
                        </tr>
                      ))}
                      {(cashActions?.transfers ?? []).slice().reverse().slice(0, 10).map((t) => (
                        <tr key={t.id}>
                          <td>Transfer</td>
                          <td>
                            {userLookup.get(t.senderUserId)?.fullName ?? t.senderUserId} → {userLookup.get(t.receiverUserId)?.fullName ?? t.receiverUserId}
                          </td>
                          <td>{t.status}</td>
                          <td>{currency(t.amount)}</td>
                        </tr>
                      ))}
                      {(cashActions?.bankActions ?? []).slice().reverse().slice(0, 10).map((a) => (
                        <tr key={a.id}>
                          <td>Banking</td>
                          <td>{userLookup.get(a.userId)?.fullName ?? a.userId}</td>
                          <td>{a.status}</td>
                          <td>{currency(a.amount)}</td>
                        </tr>
                      ))}
                      {!cashActions ? (
                        <tr>
                          <td colSpan={4}>No actions yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}

          {view === "invoices" ? (
            <>
              <section className="grid">
                <article className="card">
                  <h2>Customers</h2>
                  {(authUser?.role === "SALES" || authUser?.role === "ADMIN") ? (
                    <form className="form" onSubmit={submitCreateCustomer}>
                      <label>
                        Mobile Number
                        <input
                          value={customerDraft.mobileNumber}
                          onChange={(event) => setCustomerDraft((prev) => ({ ...prev, mobileNumber: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        First Name
                        <input
                          value={customerDraft.firstName}
                          onChange={(event) => setCustomerDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Last Name
                        <input
                          value={customerDraft.lastName}
                          onChange={(event) => setCustomerDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Email (optional)
                        <input
                          value={customerDraft.email}
                          onChange={(event) => setCustomerDraft((prev) => ({ ...prev, email: event.target.value }))}
                        />
                      </label>
                      <button type="submit" disabled={loadingData}>
                        {loadingData ? "Saving..." : "Create Customer"}
                      </button>
                    </form>
                  ) : (
                    <p className="hint">Only sales and admin users can create customers.</p>
                  )}

                  <div className="divider" />

                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Mobile</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.slice().reverse().slice(0, 12).map((c) => (
                          <tr key={c.id}>
                            <td>
                              {c.firstName} {c.lastName}
                            </td>
                            <td>{c.mobileNumber}</td>
                            <td>{c.email ?? "-"}</td>
                          </tr>
                        ))}
                        {customers.length === 0 ? (
                          <tr>
                            <td colSpan={3}>No customers yet.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </article>

                {authUser?.role === "SALES" ? (
                  <article className="card">
                    <h2>Create Invoice</h2>
                    <form className="form" onSubmit={submitCreateInvoice}>
                      <label>
                        Customer
                        <select
                          value={invoiceDraft.customerId}
                          onChange={(event) => setInvoiceDraft((prev) => ({ ...prev, customerId: event.target.value }))}
                          required
                        >
                          <option value="" disabled>
                            Select customer
                          </option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.firstName} {c.lastName} ({c.mobileNumber})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Status
                        <select
                          value={invoiceDraft.status}
                          onChange={(event) => setInvoiceDraft((prev) => ({ ...prev, status: event.target.value as "DRAFT" | "ISSUED" }))}
                          required
                        >
                          <option value="ISSUED">Issued</option>
                          <option value="DRAFT">Draft</option>
                        </select>
                      </label>
                      <label>
                        Due Date (optional, YYYY-MM-DD)
                        <input value={invoiceDraft.dueDate} onChange={(event) => setInvoiceDraft((prev) => ({ ...prev, dueDate: event.target.value }))} />
                      </label>
                      <label>
                        Notes (optional)
                        <input value={invoiceDraft.notes} onChange={(event) => setInvoiceDraft((prev) => ({ ...prev, notes: event.target.value }))} />
                      </label>
                      <div className="lines">
                        <div className="linesHead">Lines</div>
                        {invoiceDraft.lines.map((line, idx) => (
                          <div key={idx} className="lineRow">
                            <select
                              value={line.productId}
                              onChange={(event) => {
                                const selected = productLookup.get(event.target.value);
                                setInvoiceDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = {
                                    ...next[idx],
                                    productId: event.target.value,
                                    unitPrice: selected?.sellingPrice ?? next[idx].unitPrice
                                  };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                            >
                              <option value="" disabled>
                                Select product
                              </option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.skuCode} - {p.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) => {
                                const quantity = Number(event.target.value);
                                setInvoiceDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = { ...next[idx], quantity };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                              aria-label="Quantity"
                            />
                            <input
                              type="number"
                              min={1}
                              value={line.unitPrice}
                              onChange={(event) => {
                                const unitPrice = Number(event.target.value);
                                setInvoiceDraft((prev) => {
                                  const next = [...prev.lines];
                                  next[idx] = { ...next[idx], unitPrice };
                                  return { ...prev, lines: next };
                                });
                              }}
                              required
                              aria-label="Unit price"
                            />
                            <div className="lineTotal">{currency(line.quantity * line.unitPrice)}</div>
                            <button
                              type="button"
                              data-variant="ghost"
                              onClick={() =>
                                setInvoiceDraft((prev) => ({
                                  ...prev,
                                  lines: prev.lines.length > 1 ? prev.lines.filter((_l, i) => i !== idx) : prev.lines
                                }))
                              }
                              disabled={invoiceDraft.lines.length <= 1}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          data-variant="ghost"
                          onClick={() =>
                            setInvoiceDraft((prev) => ({
                              ...prev,
                              lines: [
                                ...prev.lines,
                                { productId: products[0]?.id ?? "", quantity: 1, unitPrice: products[0]?.sellingPrice ?? 0 }
                              ]
                            }))
                          }
                        >
                          Add line
                        </button>
                      </div>
                      <button type="submit" disabled={loadingData}>
                        {loadingData ? "Saving..." : "Create Invoice"}
                      </button>
                    </form>
                  </article>
                ) : null}
              </section>

              <section className="card">
                <h2>Invoices</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th>Due</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.slice().reverse().slice(0, 30).map((inv) => {
                        const cust = customerLookup.get(inv.customerId);
                        return (
                          <tr key={inv.id} className={inv.id === selectedInvoiceId ? "isSelected" : ""}>
                            <td>{inv.invoiceNumber}</td>
                            <td>{cust ? `${cust.firstName} ${cust.lastName}` : inv.customerId}</td>
                            <td>{inv.status}</td>
                            <td>{currency(inv.balance)}</td>
                            <td>{inv.dueDate ?? "-"}</td>
                            <td>
                              <button type="button" data-variant="ghost" onClick={() => selectInvoice(inv.id)}>
                                View
                              </button>
                              {authUser?.role === "ADMIN" && inv.status !== "VOID" ? (
                                <button type="button" data-variant="ghost" onClick={() => voidInvoice(inv.id)}>
                                  Void
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={6}>No invoices yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              {selectedInvoiceId ? (
                <section className="grid">
                  <article className="card">
                    <h2>Invoice Payments</h2>
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Method</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicePayments.slice().reverse().map((p) => (
                            <tr key={p.id}>
                              <td>{new Date(p.createdAt).toLocaleString()}</td>
                              <td>{p.method}</td>
                              <td>{currency(p.amount)}</td>
                            </tr>
                          ))}
                          {invoicePayments.length === 0 ? (
                            <tr>
                              <td colSpan={3}>No payments yet.</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  {(authUser?.role === "SALES" || authUser?.role === "ADMIN") ? (
                    <article className="card">
                      <h2>Add Payment</h2>
                      <form className="form" onSubmit={submitInvoicePayment}>
                        <label>
                          Amount (UGX)
                          <input
                            type="number"
                            min={1}
                            value={paymentDraft.amount || ""}
                            onChange={(event) => setPaymentDraft((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                            required
                          />
                        </label>
                        <label>
                          Method
                          <select
                            value={paymentDraft.method}
                            onChange={(event) =>
                              setPaymentDraft((prev) => ({ ...prev, method: event.target.value as InvoicePayment["method"] }))
                            }
                            required
                          >
                            <option value="CASH">Cash</option>
                            <option value="MOBILE_MONEY">Mobile Money</option>
                            <option value="CARD">Card</option>
                          </select>
                        </label>
                        <label>
                          Notes (optional)
                          <input
                            value={paymentDraft.notes}
                            onChange={(event) => setPaymentDraft((prev) => ({ ...prev, notes: event.target.value }))}
                          />
                        </label>
                        <button type="submit" disabled={loadingData}>
                          {loadingData ? "Saving..." : "Add Payment"}
                        </button>
                      </form>
                    </article>
                  ) : null}
                </section>
              ) : null}

              {(authUser?.role === "ADMIN" || authUser?.role === "MANAGER") ? (
                <section className="card">
                  <h2>Overdue</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Balance</th>
                          <th>Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overdueInvoices.map((inv) => {
                          const cust = customerLookup.get(inv.customerId);
                          return (
                            <tr key={inv.id}>
                              <td>{inv.invoiceNumber}</td>
                              <td>{cust ? `${cust.firstName} ${cust.lastName}` : inv.customerId}</td>
                              <td>{currency(inv.balance)}</td>
                              <td>{inv.dueDate ?? "-"}</td>
                            </tr>
                          );
                        })}
                        {overdueInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={4}>No overdue invoices.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {view === "inventory" ? (
            <>
              {authUser?.role === "ADMIN" ? (
                <section className="card">
                  <h2>Receive Stock</h2>
                  <form className="form" onSubmit={submitReceiveStock}>
                    <label>
                      Shop
                      <select
                        value={receiveDraft.shopId}
                        onChange={(event) => setReceiveDraft((prev) => ({ ...prev, shopId: event.target.value }))}
                        required
                      >
                        <option value="" disabled>
                          Select shop
                        </option>
                        {shops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Product
                      <select
                        value={receiveDraft.productId}
                        onChange={(event) => setReceiveDraft((prev) => ({ ...prev, productId: event.target.value }))}
                        required
                      >
                        <option value="" disabled>
                          Select product
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.skuCode} - {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity
                      <input
                        type="number"
                        min={1}
                        value={receiveDraft.quantity}
                        onChange={(event) => setReceiveDraft((prev) => ({ ...prev, quantity: Number(event.target.value) }))}
                        required
                      />
                    </label>
                    <button type="submit" disabled={loadingData}>
                      {loadingData ? "Saving..." : "Receive"}
                    </button>
                  </form>
                </section>
              ) : null}

              <section className="card">
                <h2>Inventory</h2>
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
          ) : null}

          {view === "admin" && authUser?.role === "ADMIN" ? (
            <>
              <section className="grid">
                <article className="card">
                  <h2>Create User</h2>
                  <form className="form" onSubmit={submitCreateUser}>
                    <label>
                      Full Name
                      <input value={newUserDraft.fullName} onChange={(event) => setNewUserDraft((prev) => ({ ...prev, fullName: event.target.value }))} autoComplete="name" required />
                    </label>
                    <label>
                      Role
                      <select
                        value={newUserDraft.role}
                        onChange={(event) =>
                          setNewUserDraft((prev) => {
                            const role = event.target.value as "ADMIN" | "MANAGER" | "SALES";
                            return {
                              ...prev,
                              role,
                              shopId: role === "SALES" ? prev.shopId || shops[0]?.id || "" : ""
                            };
                          })
                        }
                      >
                        <option value="SALES">Sales</option>
                        <option value="MANAGER">Manager</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </label>
                    <label>
                      Mobile Number
                      <input value={newUserDraft.mobileNumber} onChange={(event) => setNewUserDraft((prev) => ({ ...prev, mobileNumber: event.target.value }))} autoComplete="tel" required />
                    </label>
                    <label>
                      Password
                      <input type="password" value={newUserDraft.password} onChange={(event) => setNewUserDraft((prev) => ({ ...prev, password: event.target.value }))} autoComplete="new-password" required />
                    </label>
                    {newUserDraft.role === "SALES" ? (
                      <label>
                        Shop
                        <select
                          value={newUserDraft.shopId}
                          onChange={(event) => setNewUserDraft((prev) => ({ ...prev, shopId: event.target.value }))}
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
                    ) : null}
                    <button type="submit" disabled={loadingData}>
                      {loadingData ? "Creating..." : "Create User"}
                    </button>
                  </form>
                  <p className="hint">The user can log in immediately with the mobile number + password.</p>
                </article>

                <article className="card">
                  <h2>Create Product</h2>
                  <form className="form" onSubmit={submitCreateProduct}>
                    <label>
                      SKU Code
                      <input value={productDraft.skuCode} onChange={(event) => setProductDraft((prev) => ({ ...prev, skuCode: event.target.value }))} required />
                    </label>
                    <label>
                      Name
                      <input value={productDraft.name} onChange={(event) => setProductDraft((prev) => ({ ...prev, name: event.target.value }))} required />
                    </label>
                    <label>
                      Category
                      <input value={productDraft.category} onChange={(event) => setProductDraft((prev) => ({ ...prev, category: event.target.value }))} required />
                    </label>
                    <label>
                      Type
                      <select value={productDraft.productType} onChange={(event) => setProductDraft((prev) => ({ ...prev, productType: event.target.value as "BOARD" | "NON_BOARD" }))}>
                        <option value="BOARD">Board</option>
                        <option value="NON_BOARD">Non-board</option>
                      </select>
                    </label>
                    <label>
                      Unit
                      <input value={productDraft.unitOfMeasure} onChange={(event) => setProductDraft((prev) => ({ ...prev, unitOfMeasure: event.target.value }))} required />
                    </label>
                    <label>
                      Cost Price (optional)
                      <input value={productDraft.costPrice} onChange={(event) => setProductDraft((prev) => ({ ...prev, costPrice: event.target.value }))} />
                    </label>
                    <label>
                      Selling Price
                      <input value={productDraft.sellingPrice} onChange={(event) => setProductDraft((prev) => ({ ...prev, sellingPrice: event.target.value }))} required />
                    </label>
                    <label className="checkbox">
                      <input type="checkbox" checked={productDraft.active} onChange={(event) => setProductDraft((prev) => ({ ...prev, active: event.target.checked }))} />
                      Active
                    </label>
                    <button type="submit" disabled={loadingData}>
                      {loadingData ? "Saving..." : "Create"}
                    </button>
                  </form>
                </article>

                <article className="card">
                  <h2>Users</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Shop</th>
                          <th>Mobile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seedUsers.map((u) => (
                          <tr key={u.id}>
                            <td>{u.fullName}</td>
                            <td>{u.role}</td>
                            <td>{u.shopId ? shopLookup.get(u.shopId) ?? u.shopId : "-"}</td>
                            <td>{u.mobileNumber ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </section>

              <section className="card">
                <h2>Products</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Price</th>
                        <th>Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>{p.skuCode}</td>
                          <td>{p.name}</td>
                          <td>{p.productType}</td>
                          <td>{currency(p.sellingPrice)}</td>
                          <td>{String(p.active ?? true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
