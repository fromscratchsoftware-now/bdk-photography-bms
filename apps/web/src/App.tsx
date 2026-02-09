import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  createExpenseCategory,
  createExpense,
  createInvoice,
  createInvoicePayment,
  createReconciliationLock,
  createSale,
  createProduct,
  createProductCategory,
  getSale,
  getInvoice,
  getMe,
  listCustomers,
  listExpenses,
  listExpenseCategories,
  listInvoicePayments,
  listInvoices,
  listReconciliationLocks,
  listSales,
  listProductCategories,
  listProducts,
  listShops,
  listUsers,
  login,
  updateSale,
  updateCustomer,
  updateInvoice,
  updateExpenseCategory,
  updateProduct,
  updateProductCategory,
  voidSale,
  voidExpense,
  type AuthUser,
  type Customer,
  type Expense,
  type ExpenseCategory,
  type Invoice,
  type InvoiceDetail,
  type InvoicePayment,
  type Product,
  type ProductCategory,
  type ReconciliationLock,
  type Sale,
  type SaleDetail,
  type SalePaymentMethod,
  type Shop
} from "./lib/api";

type AuthState = {
  token: string;
  user: AuthUser;
};

type ActiveView = "overview" | "customers" | "invoices" | "sales" | "expenses" | "master-data";
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

function todayLocalYmd(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersBusy, setCustomersBusy] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    mobileNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    notes: "",
    isActive: true
  });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerForm, setEditingCustomerForm] = useState<{
    mobileNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    notes: string;
    isActive: boolean;
  } | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesBusy, setInvoicesBusy] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [selectedInvoicePayments, setSelectedInvoicePayments] = useState<InvoicePayment[]>([]);
  const [newInvoiceForm, setNewInvoiceForm] = useState<{
    shopId: string;
    customerId: string;
    status: "DRAFT" | "ISSUED";
    dueDate: string;
    notes: string;
    lines: Array<{ description: string; quantity: string; unitPrice: string; notes: string }>;
  }>({
    shopId: "",
    customerId: "",
    status: "DRAFT",
    dueDate: "",
    notes: "",
    lines: [{ description: "", quantity: "1", unitPrice: "", notes: "" }]
  });
  const [newPaymentForm, setNewPaymentForm] = useState<{ amount: string; method: "CASH" | "MOBILE_MONEY" | "CARD"; notes: string }>({
    amount: "",
    method: "CASH",
    notes: ""
  });

  const [sales, setSales] = useState<Sale[]>([]);
  const [salesBusy, setSalesBusy] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [salesFilters, setSalesFilters] = useState<{ shopId: string; saleDate: string }>({
    shopId: "",
    saleDate: todayLocalYmd()
  });
  const [salesDayLock, setSalesDayLock] = useState<ReconciliationLock | null>(null);
  const [salesLockBusy, setSalesLockBusy] = useState(false);
  const [saleDraftId, setSaleDraftId] = useState<string | null>(null);
  const [saleDraftForm, setSaleDraftForm] = useState<{
    shopId: string;
    saleDate: string;
    paymentMethod: SalePaymentMethod;
    customerId: string;
    notes: string;
    lines: Array<{ productId: string; quantity: string; unitPrice: string; notes: string }>;
  }>({
    shopId: "",
    saleDate: todayLocalYmd(),
    paymentMethod: "CASH",
    customerId: "",
    notes: "",
    lines: [{ productId: "", quantity: "1", unitPrice: "", notes: "" }]
  });
  const [reconcileForm, setReconcileForm] = useState<{ shopId: string; lockDate: string; notes: string }>({
    shopId: "",
    lockDate: todayLocalYmd(),
    notes: ""
  });
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconciliationLocks, setReconciliationLocks] = useState<ReconciliationLock[]>([]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesBusy, setExpensesBusy] = useState(false);
  const [expenseFilters, setExpenseFilters] = useState<{ shopId: string; expenseDate: string }>({
    shopId: "",
    expenseDate: todayLocalYmd()
  });
  const [newExpenseForm, setNewExpenseForm] = useState<{
    shopId: string;
    paymentSource: "SALESPERSON_CASH" | "ADMIN_BANK";
    paidByUserId: string;
    categoryId: string;
    amountUGX: string;
    date: string;
    notes: string;
  }>({
    shopId: "",
    paymentSource: "SALESPERSON_CASH",
    paidByUserId: "",
    categoryId: "",
    amountUGX: "",
    date: todayLocalYmd(),
    notes: ""
  });

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
  const canManageCustomers = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canManageInvoices = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canVoidInvoices = authUser?.role === "ADMIN";
  const canViewSales = authUser?.role === "ADMIN" || authUser?.role === "MANAGER" || authUser?.role === "SALES";
  const canCreateSales = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canReconcile = authUser?.role === "ADMIN";
  const canViewExpenses = authUser?.role === "ADMIN" || authUser?.role === "MANAGER" || authUser?.role === "SALES";
  const canCreateExpenses = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canVoidExpenses = authUser?.role === "ADMIN";

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
    setCustomers([]);
    setInvoices([]);
    setSelectedInvoice(null);
    setSelectedInvoicePayments([]);
    setSales([]);
    setSelectedSale(null);
    setSalesDayLock(null);
    setReconciliationLocks([]);
    setSaleDraftId(null);
    setExpenses([]);
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

        setNewInvoiceForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setSalesFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setSaleDraftForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setReconcileForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setExpenseFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setNewExpenseForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
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

  async function refreshCustomers(): Promise<void> {
    if (!auth) {
      return;
    }
    setCustomersBusy(true);
    setError(null);
    try {
      const data = await listCustomers(auth.token);
      setCustomers(data);

      const firstActive = data.find((c) => c.isActive) ?? data[0];
      if (firstActive) {
        setNewInvoiceForm((prev) => (prev.customerId ? prev : { ...prev, customerId: firstActive.id }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load customers");
    } finally {
      setCustomersBusy(false);
    }
  }

  async function refreshInvoices(): Promise<void> {
    if (!auth) {
      return;
    }
    setInvoicesBusy(true);
    setError(null);
    try {
      const data = await listInvoices(auth.token);
      setInvoices(data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load invoices");
    } finally {
      setInvoicesBusy(false);
    }
  }

  async function loadInvoiceDetail(invoiceId: string): Promise<void> {
    if (!auth) {
      return;
    }
    setInvoicesBusy(true);
    setError(null);
    try {
      const [detail, payments] = await Promise.all([
        getInvoice(auth.token, invoiceId),
        listInvoicePayments(auth.token, invoiceId)
      ]);
      setSelectedInvoice(detail);
      setSelectedInvoicePayments(payments);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load invoice");
    } finally {
      setInvoicesBusy(false);
    }
  }

  useEffect(() => {
    if (!auth) {
      return;
    }
    if (activeView !== "customers") {
      return;
    }
    void refreshCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token]);

  useEffect(() => {
    if (!auth) {
      return;
    }
    if (activeView !== "invoices") {
      return;
    }
    void (async () => {
      await Promise.all([refreshInvoices(), refreshCustomers()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token]);

  async function refreshSalesData(): Promise<void> {
    if (!auth) {
      return;
    }
    setSalesBusy(true);
    setSalesLockBusy(true);
    setError(null);
    try {
      const [productData, customerData, saleData, lockData] = await Promise.all([
        listProducts(auth.token),
        listCustomers(auth.token),
        listSales(auth.token, { shopId: salesFilters.shopId, saleDate: salesFilters.saleDate }),
        salesFilters.shopId && salesFilters.saleDate
          ? listReconciliationLocks(auth.token, { shopId: salesFilters.shopId, lockDate: salesFilters.saleDate })
          : Promise.resolve([])
      ]);
      setProducts(productData);
      setCustomers(customerData);
      setSales(saleData);
      setSalesDayLock(lockData[0] ?? null);

      const firstActiveCustomer = customerData.find((c) => c.isActive) ?? customerData[0];
      if (firstActiveCustomer) {
        setSaleDraftForm((prev) => (prev.customerId ? prev : { ...prev, customerId: firstActiveCustomer.id }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load sales");
    } finally {
      setSalesBusy(false);
      setSalesLockBusy(false);
    }
  }

  async function refreshReconciliationLocks(): Promise<void> {
    if (!auth || !canReconcile) {
      return;
    }
    setReconcileBusy(true);
    setError(null);
    try {
      const locks = await listReconciliationLocks(auth.token, { shopId: reconcileForm.shopId });
      setReconciliationLocks(locks);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load reconciliation locks");
    } finally {
      setReconcileBusy(false);
    }
  }

  async function loadSaleDetail(saleId: string): Promise<void> {
    if (!auth) {
      return;
    }
    setSalesBusy(true);
    setError(null);
    try {
      const detail = await getSale(auth.token, saleId);
      setSelectedSale(detail);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load sale");
    } finally {
      setSalesBusy(false);
    }
  }

  function resetSaleDraft(): void {
    setSaleDraftId(null);
    setSaleDraftForm((prev) => ({
      ...prev,
      paymentMethod: "CASH",
      customerId: prev.customerId,
      notes: "",
      lines: [{ productId: "", quantity: "1", unitPrice: "", notes: "" }]
    }));
  }

  async function submitSale(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setSalesBusy(true);

    const trimmedNotes = saleDraftForm.notes.trim();
    const payloadLines = saleDraftForm.lines.map((line) => ({
      productId: line.productId,
      quantity: Number.parseInt(line.quantity, 10),
      unitPrice: Number.parseInt(line.unitPrice, 10),
      notes: line.notes.trim() ? line.notes.trim() : null
    }));

    try {
      if (!payloadLines.length) {
        throw new Error("Add at least one line item.");
      }
      for (const line of payloadLines) {
        if (!line.productId) {
          throw new Error("Each line must have a product.");
        }
        if (!Number.isFinite(line.quantity) || line.quantity < 1) {
          throw new Error("Each line quantity must be at least 1.");
        }
        if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
          throw new Error("Each line unit price must be 0 or higher.");
        }
      }
      if (saleDraftForm.paymentMethod === "CREDIT" && !saleDraftForm.customerId) {
        throw new Error("Customer is required for CREDIT sales.");
      }

      if (saleDraftId) {
        await updateSale(auth.token, saleDraftId, {
          notes: trimmedNotes ? trimmedNotes : null,
          lines: payloadLines.map((l) => ({ ...l, notes: l.notes ?? null }))
        });
        setSuccess("Sale updated.");
      } else {
        await createSale(auth.token, {
          ...(authUser?.role === "ADMIN"
            ? { shopId: saleDraftForm.shopId, saleDate: saleDraftForm.saleDate }
            : {}),
          paymentMethod: saleDraftForm.paymentMethod,
          customerId: saleDraftForm.paymentMethod === "CREDIT" ? saleDraftForm.customerId : undefined,
          notes: trimmedNotes ? trimmedNotes : null,
          lines: payloadLines.map((l) => ({ ...l, notes: l.notes ?? null }))
        });
        setSuccess("Sale recorded.");
      }

      resetSaleDraft();
      setSelectedSale(null);
      await Promise.all([refreshSalesData(), refreshReconciliationLocks()]);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to save sale");
    } finally {
      setSalesBusy(false);
    }
  }

  async function startEditSale(detail: SaleDetail): Promise<void> {
    const sale = detail.sale;
    if (sale.paymentMethod === "CREDIT") {
      setError("Credit sales line items cannot be edited (manage via invoices).");
      return;
    }
    setSaleDraftId(sale.id);
    setSaleDraftForm((prev) => ({
      ...prev,
      shopId: sale.shopId,
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod,
      customerId: sale.customerId ?? prev.customerId,
      notes: sale.notes ?? "",
      lines: detail.lines.map((l) => ({
        productId: l.productId,
        quantity: String(l.quantity),
        unitPrice: String(l.unitPrice),
        notes: l.notes ?? ""
      }))
    }));
  }

  async function handleVoidSale(saleId: string): Promise<void> {
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setSalesBusy(true);
    try {
      await voidSale(auth.token, saleId);
      setSuccess("Sale voided.");
      setSelectedSale(null);
      await refreshSalesData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to void sale");
    } finally {
      setSalesBusy(false);
    }
  }

  async function submitReconcile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth || !canReconcile) {
      return;
    }
    setError(null);
    setSuccess(null);
    setReconcileBusy(true);

    try {
      const trimmedNotes = reconcileForm.notes.trim();
      await createReconciliationLock(auth.token, {
        shopId: reconcileForm.shopId,
        lockDate: reconcileForm.lockDate,
        notes: trimmedNotes ? trimmedNotes : null
      });
      setSuccess("Day reconciled (locked).");
      setReconcileForm((prev) => ({ ...prev, notes: "" }));
      await Promise.all([refreshSalesData(), refreshReconciliationLocks()]);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to reconcile day");
    } finally {
      setReconcileBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewSales) {
      return;
    }
    if (activeView !== "sales") {
      return;
    }
    void (async () => {
      await refreshSalesData();
      await refreshReconciliationLocks();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token, canViewSales, salesFilters.shopId, salesFilters.saleDate, reconcileForm.shopId]);

  useEffect(() => {
    if (activeView !== "sales") {
      return;
    }
    if (saleDraftId) {
      return;
    }
    setSaleDraftForm((prev) => ({
      ...prev,
      shopId: salesFilters.shopId || prev.shopId,
      saleDate: salesFilters.saleDate || prev.saleDate
    }));
  }, [activeView, salesFilters.shopId, salesFilters.saleDate, saleDraftId]);

  async function refreshExpensesData(): Promise<void> {
    if (!auth) {
      return;
    }
    setExpensesBusy(true);
    setError(null);
    try {
      const [categoryData, expenseData] = await Promise.all([
        listExpenseCategories(auth.token),
        listExpenses(auth.token, { shopId: expenseFilters.shopId, expenseDate: expenseFilters.expenseDate })
      ]);
      setExpenseCategories(categoryData);
      setExpenses(expenseData);

      const firstActiveCategory = categoryData.find((c) => c.isActive) ?? categoryData[0];
      if (firstActiveCategory) {
        setNewExpenseForm((prev) => (prev.categoryId ? prev : { ...prev, categoryId: firstActiveCategory.id }));
      }

      if (authUser?.role === "ADMIN") {
        const salesUsers = users.filter((u) => u.role === "SALES");
        if (salesUsers.length) {
          setNewExpenseForm((prev) =>
            prev.paymentSource === "SALESPERSON_CASH" && !prev.paidByUserId ? { ...prev, paidByUserId: salesUsers[0].id } : prev
          );
        }
      } else {
        setNewExpenseForm((prev) => (prev.paymentSource === "SALESPERSON_CASH" ? prev : { ...prev, paymentSource: "SALESPERSON_CASH" }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load expenses");
    } finally {
      setExpensesBusy(false);
    }
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setExpensesBusy(true);

    try {
      const amount = Number.parseInt(newExpenseForm.amountUGX, 10);
      if (!newExpenseForm.categoryId) {
        throw new Error("Category is required.");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than 0.");
      }

      const trimmedNotes = newExpenseForm.notes.trim();

      await createExpense(auth.token, {
        ...(authUser?.role === "ADMIN" ? { shopId: newExpenseForm.shopId } : {}),
        categoryId: newExpenseForm.categoryId,
        amountUGX: amount,
        date: newExpenseForm.date,
        notes: trimmedNotes ? trimmedNotes : null,
        paymentSource: authUser?.role === "ADMIN" ? newExpenseForm.paymentSource : "SALESPERSON_CASH",
        paidByUserId: authUser?.role === "ADMIN" && newExpenseForm.paymentSource === "SALESPERSON_CASH" ? newExpenseForm.paidByUserId : undefined
      });

      setSuccess("Expense recorded.");
      setNewExpenseForm((prev) => ({ ...prev, amountUGX: "", notes: "" }));
      await refreshExpensesData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to record expense");
    } finally {
      setExpensesBusy(false);
    }
  }

  async function handleVoidExpense(expenseId: string): Promise<void> {
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setExpensesBusy(true);
    try {
      await voidExpense(auth.token, expenseId);
      setSuccess("Expense voided.");
      await refreshExpensesData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to void expense");
    } finally {
      setExpensesBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewExpenses) {
      return;
    }
    if (activeView !== "expenses") {
      return;
    }
    void refreshExpensesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token, canViewExpenses, expenseFilters.shopId, expenseFilters.expenseDate]);

  useEffect(() => {
    if (activeView !== "expenses") {
      return;
    }
    if (authUser?.role === "ADMIN") {
      return;
    }
    setNewExpenseForm((prev) => ({
      ...prev,
      shopId: expenseFilters.shopId || prev.shopId,
      date: expenseFilters.expenseDate || prev.date,
      paymentSource: "SALESPERSON_CASH"
    }));
  }, [activeView, authUser?.role, expenseFilters.shopId, expenseFilters.expenseDate]);

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

  function escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function openInvoicePrint(detail: InvoiceDetail, payments: InvoicePayment[]): void {
    const invoice = detail.invoice;

    const lineRows = detail.lines
      .map(
        (l) => `<tr>
  <td>${escapeHtml(l.description)}</td>
  <td style="text-align:right;">${l.quantity}</td>
  <td style="text-align:right;">${l.unitPrice}</td>
  <td style="text-align:right;">${l.lineTotal}</td>
</tr>`
      )
      .join("");

    const paymentRows = payments
      .map(
        (p) => `<tr>
  <td>${escapeHtml(p.createdAt)}</td>
  <td>${escapeHtml(p.method)}</td>
  <td style="text-align:right;">${p.amount}</td>
  <td>${escapeHtml(p.notes ?? "")}</td>
</tr>`
      )
      .join("");

    const issuedAtHtml = invoice.issuedAt
      ? `<div class="muted" style="margin-top: 8px;">Issued at</div><div>${escapeHtml(invoice.issuedAt)}</div>`
      : "";
    const dueDateHtml = invoice.dueDate
      ? `<div class="muted" style="margin-top: 8px;">Due date</div><div>${escapeHtml(invoice.dueDate)}</div>`
      : "";
    const emailHtml = invoice.customerEmail
      ? `<div class="muted" style="margin-top: 6px;">Email</div><div>${escapeHtml(invoice.customerEmail)}</div>`
      : "";
    const notesHtml = invoice.notes
      ? `<div class="muted" style="margin-top: 14px;">Notes</div><div>${escapeHtml(invoice.notes)}</div>`
      : "";

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(invoice.invoiceNumber)} - BDK Photography</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 28px; color: #0f172a; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      h2 { font-size: 14px; margin: 16px 0 8px; }
      .muted { color: #475569; font-size: 12px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-top: 10px; }
      .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px 6px; font-size: 12px; vertical-align: top; }
      th { text-align: left; background: #f8fafc; }
      .totals td { border-bottom: 0; }
      .right { text-align: right; }
      @media print {
        body { margin: 0; }
        .no-print { display: none !important; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="display:flex; justify-content:flex-end; margin-bottom: 12px;">
      <button onclick="window.print()" style="padding:8px 12px; border:1px solid #cbd5e1; background:#fff; border-radius:8px; cursor:pointer;">Print</button>
    </div>

    <h1>BDK Photography</h1>
    <div class="muted">Invoice: <strong>${escapeHtml(invoice.invoiceNumber)}</strong></div>

    <div class="grid">
      <div class="box">
        <div class="muted">Shop</div>
        <div><strong>${escapeHtml(invoice.shopCode)}</strong> ${escapeHtml(invoice.shopName)}</div>
        <div class="muted" style="margin-top: 8px;">Status</div>
        <div><strong>${escapeHtml(invoice.status)}</strong></div>
        ${issuedAtHtml}
        ${dueDateHtml}
      </div>
      <div class="box">
        <div class="muted">Customer</div>
        <div><strong>${escapeHtml(invoice.customerFirstName)} ${escapeHtml(invoice.customerLastName)}</strong></div>
        <div class="muted" style="margin-top: 6px;">Mobile</div>
        <div>${escapeHtml(invoice.customerMobileNumber)}</div>
        ${emailHtml}
      </div>
    </div>

    <h2>Line Items</h2>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Qty</th>
          <th class="right">Unit</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows || '<tr><td colspan="4">No lines</td></tr>'}
        <tr class="totals">
          <td colspan="3" class="right"><strong>Total</strong></td>
          <td class="right"><strong>${invoice.totalAmount}</strong></td>
        </tr>
        <tr class="totals">
          <td colspan="3" class="right"><strong>Paid</strong></td>
          <td class="right"><strong>${invoice.paidAmount}</strong></td>
        </tr>
        <tr class="totals">
          <td colspan="3" class="right"><strong>Balance</strong></td>
          <td class="right"><strong>${invoice.balance}</strong></td>
        </tr>
      </tbody>
    </table>

    <h2>Payments</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Method</th>
          <th class="right">Amount</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows || '<tr><td colspan="4">No payments</td></tr>'}
      </tbody>
    </table>

    ${notesHtml}
  </body>
</html>`;

    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      setError("Popup blocked. Allow popups to print.");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  }

  const saleDraftTotal = saleDraftForm.lines.reduce((sum, line) => {
    const qty = Number.parseInt(line.quantity, 10);
    const unitPrice = Number.parseInt(line.unitPrice, 10);
    const safeQty = Number.isFinite(qty) ? qty : 0;
    const safePrice = Number.isFinite(unitPrice) ? unitPrice : 0;
    return sum + safeQty * safePrice;
  }, 0);

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
          Phases 1-5: authentication (JWT), master data, customers, invoices/payments, sales POS, reconciliation locks, and expenses.
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
          <button
            className={`tab ${activeView === "customers" ? "isActive" : ""}`}
            type="button"
            onClick={() => setActiveView("customers")}
          >
            Customers
          </button>
          <button
            className={`tab ${activeView === "invoices" ? "isActive" : ""}`}
            type="button"
            onClick={() => setActiveView("invoices")}
          >
            Invoices
          </button>
          {canViewSales ? (
            <button
              className={`tab ${activeView === "sales" ? "isActive" : ""}`}
              type="button"
              onClick={() => setActiveView("sales")}
            >
              Sales (POS)
            </button>
          ) : null}
          {canViewExpenses ? (
            <button
              className={`tab ${activeView === "expenses" ? "isActive" : ""}`}
              type="button"
              onClick={() => setActiveView("expenses")}
            >
              Expenses
            </button>
          ) : null}
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
                <li>JWT login and RBAC (admins, managers, sales)</li>
                <li>Phase 2: Master data (expense categories, product categories, products)</li>
                <li>Phase 3: Customers, invoices, and installment payments</li>
                <li>Phase 4: Sales (POS) + daily reconciliation locks</li>
                <li>Phase 5: Expenses (payment source: salesperson cash vs admin/bank)</li>
              </ul>
              <div className="note">
                Next phases will add workshop production, inventory/transfers, cash workflows, messaging, and reporting.
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
                <li>Cash tracking with approvals, banking</li>
                <li>Messaging (SMS / WhatsApp / Email)</li>
                <li>Capital dashboard + exports</li>
                <li>Reports (sales, inventory, cash movement, credit aging)</li>
              </ul>
            </section>
          </>
        ) : activeView === "customers" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Customers</h2>
              <p className="hint">Create and manage customers for invoicing, credit, and reminders.</p>
            </section>

            {canManageCustomers ? (
              <section className="card">
                <h2>Create Customer</h2>
                <form
                  className="form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!auth) {
                      return;
                    }
                    setError(null);
                    setSuccess(null);
                    setCustomersBusy(true);
                    try {
                      await createCustomer(auth.token, {
                        mobileNumber: newCustomerForm.mobileNumber,
                        firstName: newCustomerForm.firstName,
                        lastName: newCustomerForm.lastName,
                        email: newCustomerForm.email ? newCustomerForm.email : null,
                        notes: newCustomerForm.notes ? newCustomerForm.notes : null,
                        isActive: newCustomerForm.isActive
                      });
                      setNewCustomerForm({
                        mobileNumber: "",
                        firstName: "",
                        lastName: "",
                        email: "",
                        notes: "",
                        isActive: true
                      });
                      setSuccess("Customer created.");
                      await refreshCustomers();
                    } catch (caught: unknown) {
                      setError(caught instanceof Error ? caught.message : "Failed to create customer");
                    } finally {
                      setCustomersBusy(false);
                    }
                  }}
                >
                  <label>
                    Mobile number
                    <input
                      value={newCustomerForm.mobileNumber}
                      onChange={(event) =>
                        setNewCustomerForm((prev) => ({ ...prev, mobileNumber: event.target.value }))
                      }
                      placeholder="0700 000 000"
                      required
                    />
                  </label>
                  <label>
                    First name
                    <input
                      value={newCustomerForm.firstName}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, firstName: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      value={newCustomerForm.lastName}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, lastName: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Email (optional)
                    <input
                      value={newCustomerForm.email}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
                      placeholder="name@example.com"
                    />
                  </label>
                  <label>
                    Notes (optional)
                    <input
                      value={newCustomerForm.notes}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={newCustomerForm.isActive}
                      onChange={(event) => setNewCustomerForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    />
                    Active
                  </label>
                  <button type="submit" disabled={customersBusy}>
                    {customersBusy ? "Saving..." : "Create"}
                  </button>
                </form>
              </section>
            ) : (
              <section className="card">
                <h2>Create Customer</h2>
                <div className="note">You don’t have permission to create or edit customers.</div>
              </section>
            )}

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Customer List</h2>
              {customersBusy ? <p className="hint">Loading...</p> : null}
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mobile</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Active</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.length ? (
                      customers.map((c) => (
                        <tr key={c.id} className={editingCustomerId === c.id ? "isSelected" : ""}>
                          <td>{c.mobileNumber}</td>
                          <td>
                            {c.firstName} {c.lastName}
                          </td>
                          <td>{c.email ?? "-"}</td>
                          <td>{c.isActive ? "Yes" : "No"}</td>
                          <td>{c.notes ?? "-"}</td>
                          <td>
                            {canManageCustomers ? (
                              <div className="approvalActions">
                                <button
                                  data-variant="ghost"
                                  type="button"
                                  onClick={() => {
                                    setEditingCustomerId(c.id);
                                    setEditingCustomerForm({
                                      mobileNumber: c.mobileNumber,
                                      firstName: c.firstName,
                                      lastName: c.lastName,
                                      email: c.email ?? "",
                                      notes: c.notes ?? "",
                                      isActive: c.isActive
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
                                    setCustomersBusy(true);
                                    try {
                                      await updateCustomer(auth.token, c.id, { isActive: !c.isActive });
                                      setSuccess("Customer updated.");
                                      await refreshCustomers();
                                    } catch (caught: unknown) {
                                      setError(caught instanceof Error ? caught.message : "Failed to update customer");
                                    } finally {
                                      setCustomersBusy(false);
                                    }
                                  }}
                                >
                                  {c.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No customers yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {editingCustomerId && editingCustomerForm ? (
                <div className="approvalRow">
                  <div>
                    <p className="subhead">Edit Customer</p>
                    <form
                      className="form form--three"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!auth) {
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setCustomersBusy(true);
                        try {
                          await updateCustomer(auth.token, editingCustomerId, {
                            mobileNumber: editingCustomerForm.mobileNumber,
                            firstName: editingCustomerForm.firstName,
                            lastName: editingCustomerForm.lastName,
                            email: editingCustomerForm.email ? editingCustomerForm.email : null,
                            notes: editingCustomerForm.notes ? editingCustomerForm.notes : null,
                            isActive: editingCustomerForm.isActive
                          });
                          setEditingCustomerId(null);
                          setEditingCustomerForm(null);
                          setSuccess("Customer saved.");
                          await refreshCustomers();
                        } catch (caught: unknown) {
                          setError(caught instanceof Error ? caught.message : "Failed to save customer");
                        } finally {
                          setCustomersBusy(false);
                        }
                      }}
                    >
                      <label>
                        Mobile number
                        <input
                          value={editingCustomerForm.mobileNumber}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) =>
                              prev ? { ...prev, mobileNumber: event.target.value } : prev
                            )
                          }
                          required
                        />
                      </label>
                      <label>
                        First name
                        <input
                          value={editingCustomerForm.firstName}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      <label>
                        Last name
                        <input
                          value={editingCustomerForm.lastName}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))
                          }
                          required
                        />
                      </label>
                      <label>
                        Email
                        <input
                          value={editingCustomerForm.email}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label>
                        Notes
                        <input
                          value={editingCustomerForm.notes}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))
                          }
                        />
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={editingCustomerForm.isActive}
                          onChange={(event) =>
                            setEditingCustomerForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                          }
                        />
                        Active
                      </label>
                      <button type="submit" disabled={customersBusy}>
                        {customersBusy ? "Saving..." : "Save"}
                      </button>
                      <button
                        data-variant="ghost"
                        type="button"
                        onClick={() => {
                          setEditingCustomerId(null);
                          setEditingCustomerForm(null);
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
        ) : activeView === "invoices" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Invoices</h2>
              <p className="hint">Create invoices, print them, and record installment payments (cash/mobile money/card).</p>
            </section>

            {canManageInvoices ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Create Invoice</h2>
                {customers.length ? (
                  <form
                    className="form form--three"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setInvoicesBusy(true);
                      try {
                        const lines = newInvoiceForm.lines.map((l) => ({
                          description: l.description,
                          quantity: Number(l.quantity),
                          unitPrice: Number(l.unitPrice),
                          notes: l.notes ? l.notes : null
                        }));

                        const created = await createInvoice(auth.token, {
                          shopId: newInvoiceForm.shopId || undefined,
                          customerId: newInvoiceForm.customerId,
                          status: newInvoiceForm.status,
                          dueDate: newInvoiceForm.dueDate ? newInvoiceForm.dueDate : null,
                          notes: newInvoiceForm.notes ? newInvoiceForm.notes : null,
                          lines
                        });

                        setSelectedInvoice(created);
                        setSelectedInvoicePayments([]);
                        setSuccess("Invoice created.");

                        await refreshInvoices();

                        setNewInvoiceForm((prev) => ({
                          ...prev,
                          status: "DRAFT",
                          dueDate: "",
                          notes: "",
                          lines: [{ description: "", quantity: "1", unitPrice: "", notes: "" }]
                        }));
                        setNewPaymentForm({ amount: "", method: "CASH", notes: "" });
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to create invoice");
                      } finally {
                        setInvoicesBusy(false);
                      }
                    }}
                  >
                    <label>
                      Shop
                      <select
                        value={newInvoiceForm.shopId}
                        onChange={(event) => setNewInvoiceForm((prev) => ({ ...prev, shopId: event.target.value }))}
                        disabled={authUser?.role !== "ADMIN"}
                        required={authUser?.role === "ADMIN"}
                      >
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} • {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Customer
                      <select
                        value={newInvoiceForm.customerId}
                        onChange={(event) =>
                          setNewInvoiceForm((prev) => ({ ...prev, customerId: event.target.value }))
                        }
                        required
                      >
                        {customers
                          .filter((c) => c.isActive)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.firstName} {c.lastName} • {c.mobileNumber}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={newInvoiceForm.status}
                        onChange={(event) =>
                          setNewInvoiceForm((prev) => ({
                            ...prev,
                            status: event.target.value === "ISSUED" ? "ISSUED" : "DRAFT"
                          }))
                        }
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="ISSUED">Issued</option>
                      </select>
                    </label>
                    <label>
                      Due date (optional)
                      <input
                        type="date"
                        value={newInvoiceForm.dueDate}
                        onChange={(event) => setNewInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input
                        value={newInvoiceForm.notes}
                        onChange={(event) => setNewInvoiceForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <p className="subhead">Line Items</p>
                      <div className="stack">
                        {newInvoiceForm.lines.map((line, idx) => (
                          <div key={idx} className="note" style={{ borderStyle: "dashed" }}>
                            <div className="form form--three" style={{ marginTop: 0 }}>
                              <label>
                                Description
                                <input
                                  value={line.description}
                                  onChange={(event) =>
                                    setNewInvoiceForm((prev) => {
                                      const nextLines = [...prev.lines];
                                      nextLines[idx] = { ...nextLines[idx], description: event.target.value };
                                      return { ...prev, lines: nextLines };
                                    })
                                  }
                                  required
                                />
                              </label>
                              <label>
                                Qty
                                <input
                                  type="number"
                                  min={1}
                                  value={line.quantity}
                                  onChange={(event) =>
                                    setNewInvoiceForm((prev) => {
                                      const nextLines = [...prev.lines];
                                      nextLines[idx] = { ...nextLines[idx], quantity: event.target.value };
                                      return { ...prev, lines: nextLines };
                                    })
                                  }
                                  required
                                />
                              </label>
                              <label>
                                Unit Price (UGX)
                                <input
                                  type="number"
                                  min={0}
                                  value={line.unitPrice}
                                  onChange={(event) =>
                                    setNewInvoiceForm((prev) => {
                                      const nextLines = [...prev.lines];
                                      nextLines[idx] = { ...nextLines[idx], unitPrice: event.target.value };
                                      return { ...prev, lines: nextLines };
                                    })
                                  }
                                  required
                                />
                              </label>
                              <label style={{ gridColumn: "1 / -1" }}>
                                Notes (optional)
                                <input
                                  value={line.notes}
                                  onChange={(event) =>
                                    setNewInvoiceForm((prev) => {
                                      const nextLines = [...prev.lines];
                                      nextLines[idx] = { ...nextLines[idx], notes: event.target.value };
                                      return { ...prev, lines: nextLines };
                                    })
                                  }
                                />
                              </label>
                              <div className="approvalActions" style={{ gridColumn: "1 / -1" }}>
                                <button
                                  data-variant="ghost"
                                  type="button"
                                  onClick={() =>
                                    setNewInvoiceForm((prev) => ({
                                      ...prev,
                                      lines:
                                        prev.lines.length <= 1
                                          ? prev.lines
                                          : prev.lines.filter((_, lineIdx) => lineIdx !== idx)
                                    }))
                                  }
                                  disabled={newInvoiceForm.lines.length <= 1}
                                >
                                  Remove Line
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="approvalActions" style={{ marginTop: "0.8rem" }}>
                        <button
                          data-variant="ghost"
                          type="button"
                          onClick={() =>
                            setNewInvoiceForm((prev) => ({
                              ...prev,
                              lines: [...prev.lines, { description: "", quantity: "1", unitPrice: "", notes: "" }]
                            }))
                          }
                        >
                          Add Line
                        </button>
                      </div>
                    </div>

                    <button type="submit" disabled={invoicesBusy}>
                      {invoicesBusy ? "Saving..." : "Create Invoice"}
                    </button>
                  </form>
                ) : (
                  <div className="note">Create a customer first.</div>
                )}
              </section>
            ) : (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Create Invoice</h2>
                <div className="note">You don’t have permission to create invoices.</div>
              </section>
            )}

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Invoice List</h2>
              {invoicesBusy ? <p className="hint">Loading...</p> : null}
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Shop</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length ? (
                      invoices.map((inv) => (
                        <tr key={inv.id} className={selectedInvoice?.invoice.id === inv.id ? "isSelected" : ""}>
                          <td>{inv.invoiceNumber}</td>
                          <td>{inv.shopCode}</td>
                          <td>
                            {inv.customerFirstName} {inv.customerLastName}
                          </td>
                          <td>{inv.status}</td>
                          <td>{inv.totalAmount}</td>
                          <td>{inv.balance}</td>
                          <td>
                            <div className="approvalActions">
                              <button
                                data-variant="ghost"
                                type="button"
                                onClick={async () => {
                                  await loadInvoiceDetail(inv.id);
                                }}
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7}>No invoices yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedInvoice ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="meta" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p className="eyebrow" style={{ marginBottom: 0 }}>
                      BDK Photography
                    </p>
                    <h2 style={{ marginTop: "0.2rem" }}>{selectedInvoice.invoice.invoiceNumber}</h2>
                    <div className="hint">
                      {selectedInvoice.invoice.shopCode} • {selectedInvoice.invoice.shopName}
                    </div>
                    <div className="hint">
                      Customer: {selectedInvoice.invoice.customerFirstName} {selectedInvoice.invoice.customerLastName} •{" "}
                      {selectedInvoice.invoice.customerMobileNumber}
                    </div>
                  </div>
                  <div className="approvalActions">
                    <button
                      data-variant="ghost"
                      type="button"
                      onClick={() => openInvoicePrint(selectedInvoice, selectedInvoicePayments)}
                    >
                      Print
                    </button>
                    {canManageInvoices && selectedInvoice.invoice.status === "DRAFT" ? (
                      <button
                        data-variant="ghost"
                        type="button"
                        onClick={async () => {
                          if (!auth) {
                            return;
                          }
                          setError(null);
                          setSuccess(null);
                          setInvoicesBusy(true);
                          try {
                            const updated = await updateInvoice(auth.token, selectedInvoice.invoice.id, { status: "ISSUED" });
                            setSelectedInvoice(updated);
                            setSuccess("Invoice issued.");
                            await refreshInvoices();
                          } catch (caught: unknown) {
                            setError(caught instanceof Error ? caught.message : "Failed to issue invoice");
                          } finally {
                            setInvoicesBusy(false);
                          }
                        }}
                      >
                        Issue
                      </button>
                    ) : null}
                    {canVoidInvoices && selectedInvoice.invoice.status !== "VOID" ? (
                      <button
                        data-variant="ghost"
                        type="button"
                        onClick={async () => {
                          if (!auth) {
                            return;
                          }
                          const ok = window.confirm("Void this invoice? This cannot be undone.");
                          if (!ok) {
                            return;
                          }
                          setError(null);
                          setSuccess(null);
                          setInvoicesBusy(true);
                          try {
                            const updated = await updateInvoice(auth.token, selectedInvoice.invoice.id, { status: "VOID" });
                            setSelectedInvoice(updated);
                            setSuccess("Invoice voided.");
                            await refreshInvoices();
                          } catch (caught: unknown) {
                            setError(caught instanceof Error ? caught.message : "Failed to void invoice");
                          } finally {
                            setInvoicesBusy(false);
                          }
                        }}
                      >
                        Void
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="divider" />

                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.lines.map((l) => (
                        <tr key={l.id}>
                          <td>{l.description}</td>
                          <td>{l.quantity}</td>
                          <td>{l.unitPrice}</td>
                          <td>{l.lineTotal}</td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={3}>
                          <strong>Total</strong>
                        </td>
                        <td>
                          <strong>{selectedInvoice.invoice.totalAmount}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3}>
                          <strong>Paid</strong>
                        </td>
                        <td>
                          <strong>{selectedInvoice.invoice.paidAmount}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3}>
                          <strong>Balance</strong>
                        </td>
                        <td>
                          <strong>{selectedInvoice.invoice.balance}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="divider" />

                <h3>Payments</h3>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoicePayments.length ? (
                        selectedInvoicePayments.map((p) => (
                          <tr key={p.id}>
                            <td>{p.createdAt}</td>
                            <td>{p.method}</td>
                            <td>{p.amount}</td>
                            <td>{p.notes ?? "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>No payments yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {canManageInvoices && selectedInvoice.invoice.status !== "VOID" && selectedInvoice.invoice.balance > 0 ? (
                  <div style={{ marginTop: "1rem" }}>
                    <p className="subhead">Record Payment</p>
                    <form
                      className="form form--three"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!auth) {
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setInvoicesBusy(true);
                        try {
                          await createInvoicePayment(auth.token, selectedInvoice.invoice.id, {
                            amount: Number(newPaymentForm.amount),
                            method: newPaymentForm.method,
                            notes: newPaymentForm.notes ? newPaymentForm.notes : null
                          });
                          setNewPaymentForm({ amount: "", method: "CASH", notes: "" });
                          setSuccess("Payment recorded.");
                          await Promise.all([refreshInvoices(), loadInvoiceDetail(selectedInvoice.invoice.id)]);
                        } catch (caught: unknown) {
                          setError(caught instanceof Error ? caught.message : "Failed to record payment");
                        } finally {
                          setInvoicesBusy(false);
                        }
                      }}
                    >
                      <label>
                        Amount (UGX)
                        <input
                          type="number"
                          min={1}
                          value={newPaymentForm.amount}
                          onChange={(event) => setNewPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Method
                        <select
                          value={newPaymentForm.method}
                          onChange={(event) =>
                            setNewPaymentForm((prev) => ({
                              ...prev,
                              method:
                                event.target.value === "MOBILE_MONEY"
                                  ? "MOBILE_MONEY"
                                  : event.target.value === "CARD"
                                    ? "CARD"
                                    : "CASH"
                            }))
                          }
                        >
                          <option value="CASH">Cash</option>
                          <option value="MOBILE_MONEY">Mobile Money</option>
                          <option value="CARD">Card</option>
                        </select>
                      </label>
                      <label>
                        Notes (optional)
                        <input
                          value={newPaymentForm.notes}
                          onChange={(event) => setNewPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                      </label>
                      <button type="submit" disabled={invoicesBusy}>
                        {invoicesBusy ? "Saving..." : "Record Payment"}
                      </button>
                    </form>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        ) : activeView === "sales" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Sales (POS)</h2>
              <p className="hint">
                Record sales (cash/mobile money/card/credit). Credit sales auto-create an ISSUED invoice.
              </p>

              <form
                className="form form--three"
                onSubmit={(event) => {
                  event.preventDefault();
                  void refreshSalesData();
                }}
              >
                <label>
                  Shop
                  <select
                    value={salesFilters.shopId}
                    onChange={(event) => setSalesFilters((prev) => ({ ...prev, shopId: event.target.value }))}
                    disabled={authUser?.role === "SALES"}
                  >
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.code} — {shop.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={salesFilters.saleDate}
                    onChange={(event) => setSalesFilters((prev) => ({ ...prev, saleDate: event.target.value }))}
                  />
                </label>
                <button type="submit" disabled={salesBusy}>
                  {salesBusy ? "Loading..." : "Refresh"}
                </button>
              </form>

              {salesLockBusy ? (
                <div className="note" style={{ marginTop: "0.85rem" }}>
                  Checking reconciliation lock...
                </div>
              ) : salesDayLock ? (
                <div className="note" style={{ marginTop: "0.85rem" }}>
                  <strong>Locked:</strong> {salesDayLock.lockDate} • {salesDayLock.shopCode} •{" "}
                  {salesDayLock.lockedByFullName ?? salesDayLock.lockedByUserId ?? "Unknown"}
                </div>
              ) : (
                <div className="note" style={{ marginTop: "0.85rem" }}>
                  <strong>Not locked:</strong> {salesFilters.saleDate}
                </div>
              )}
            </section>

            {canCreateSales ? (
              <section className="card">
                <h2>{saleDraftId ? "Edit Sale" : "Record Sale"}</h2>

                {salesDayLock && authUser?.role !== "ADMIN" ? (
                  <div className="note">This day is reconciled (locked). Sales cannot create or edit sales.</div>
                ) : null}

                <form className="form" onSubmit={submitSale}>
                  {authUser?.role === "ADMIN" ? (
                    <>
                      <label>
                        Shop
                        <select
                          value={saleDraftForm.shopId}
                          onChange={(event) => setSaleDraftForm((prev) => ({ ...prev, shopId: event.target.value }))}
                          required
                        >
                          {shops.map((shop) => (
                            <option key={shop.id} value={shop.id}>
                              {shop.code} — {shop.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Sale date
                        <input
                          type="date"
                          value={saleDraftForm.saleDate}
                          onChange={(event) => setSaleDraftForm((prev) => ({ ...prev, saleDate: event.target.value }))}
                          required
                        />
                      </label>
                    </>
                  ) : (
                    <p className="lineHint">
                      Shop: {shops.find((s) => s.id === salesFilters.shopId)?.name ?? "-"} • Date: {salesFilters.saleDate}
                    </p>
                  )}

                  <label>
                    Payment method
                    <select
                      value={saleDraftForm.paymentMethod}
                      onChange={(event) =>
                        setSaleDraftForm((prev) => ({
                          ...prev,
                          paymentMethod:
                            event.target.value === "MOBILE_MONEY"
                              ? "MOBILE_MONEY"
                              : event.target.value === "CARD"
                                ? "CARD"
                                : event.target.value === "CREDIT"
                                  ? "CREDIT"
                                  : "CASH"
                        }))
                      }
                    >
                      <option value="CASH">Cash</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="CARD">Card</option>
                      <option value="CREDIT">Credit</option>
                    </select>
                  </label>

                  {saleDraftForm.paymentMethod === "CREDIT" ? (
                    <label>
                      Customer
                      <select
                        value={saleDraftForm.customerId}
                        onChange={(event) => setSaleDraftForm((prev) => ({ ...prev, customerId: event.target.value }))}
                        required
                      >
                        <option value="">Select customer...</option>
                        {customers
                          .filter((c) => c.isActive)
                          .map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.mobileNumber} — {customer.firstName} {customer.lastName}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}

                  <label>
                    Notes (optional)
                    <input
                      value={saleDraftForm.notes}
                      onChange={(event) => setSaleDraftForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional notes"
                    />
                  </label>

                  <div className="lineHint">Total (UGX): {saleDraftTotal}</div>

                  <div className="lines" style={{ gridColumn: "1 / -1" }}>
                    <div className="linesHead">Line items</div>
                    {saleDraftForm.lines.map((line, idx) => {
                      const qty = Number.parseInt(line.quantity, 10);
                      const unitPrice = Number.parseInt(line.unitPrice, 10);
                      const safeQty = Number.isFinite(qty) ? qty : 0;
                      const safeUnit = Number.isFinite(unitPrice) ? unitPrice : 0;
                      const lineTotal = safeQty * safeUnit;

                      return (
                        <div className="lineRow" key={`${idx}-${line.productId}`}>
                          <label>
                            Product
                            <select
                              value={line.productId}
                              onChange={(event) => {
                                const nextProductId = event.target.value;
                                const picked = products.find((p) => p.id === nextProductId);
                                setSaleDraftForm((prev) => ({
                                  ...prev,
                                  lines: prev.lines.map((prevLine, i) =>
                                    i !== idx
                                      ? prevLine
                                      : {
                                          ...prevLine,
                                          productId: nextProductId,
                                          unitPrice:
                                            prevLine.unitPrice || !picked ? prevLine.unitPrice : String(picked.sellingPrice)
                                        }
                                  )
                                }));
                              }}
                              required
                            >
                              <option value="">Select product...</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.skuCode} — {product.name} {product.isActive ? "" : "(inactive)"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Quantity
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) =>
                                setSaleDraftForm((prev) => ({
                                  ...prev,
                                  lines: prev.lines.map((prevLine, i) =>
                                    i !== idx ? prevLine : { ...prevLine, quantity: event.target.value }
                                  )
                                }))
                              }
                              required
                            />
                          </label>
                          <label>
                            Unit price (UGX)
                            <input
                              type="number"
                              min={0}
                              value={line.unitPrice}
                              onChange={(event) =>
                                setSaleDraftForm((prev) => ({
                                  ...prev,
                                  lines: prev.lines.map((prevLine, i) =>
                                    i !== idx ? prevLine : { ...prevLine, unitPrice: event.target.value }
                                  )
                                }))
                              }
                              required
                            />
                          </label>
                          <label>
                            Notes
                            <input
                              value={line.notes}
                              onChange={(event) =>
                                setSaleDraftForm((prev) => ({
                                  ...prev,
                                  lines: prev.lines.map((prevLine, i) =>
                                    i !== idx ? prevLine : { ...prevLine, notes: event.target.value }
                                  )
                                }))
                              }
                              placeholder="Optional"
                            />
                          </label>
                          <div className="lineTotal">Line total: {lineTotal}</div>
                          <div className="approvalActions">
                            <button
                              data-variant="ghost"
                              type="button"
                              onClick={() =>
                                setSaleDraftForm((prev) => ({
                                  ...prev,
                                  lines: prev.lines.length > 1 ? prev.lines.filter((_, i) => i !== idx) : prev.lines
                                }))
                              }
                              disabled={saleDraftForm.lines.length < 2}
                            >
                              Remove line
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      data-variant="ghost"
                      type="button"
                      onClick={() =>
                        setSaleDraftForm((prev) => ({
                          ...prev,
                          lines: [...prev.lines, { productId: "", quantity: "1", unitPrice: "", notes: "" }]
                        }))
                      }
                    >
                      Add line
                    </button>
                  </div>

                  <button type="submit" disabled={salesBusy || (!!salesDayLock && authUser?.role !== "ADMIN")}>
                    {salesBusy ? "Saving..." : saleDraftId ? "Save changes" : "Record sale"}
                  </button>

                  {saleDraftId ? (
                    <button data-variant="ghost" type="button" onClick={resetSaleDraft}>
                      Cancel edit
                    </button>
                  ) : null}
                </form>

                {saleDraftForm.paymentMethod === "CREDIT" ? (
                  <p className="hint" style={{ marginTop: "0.75rem" }}>
                    CREDIT auto-creates an invoice. Voiding credit sales requires admin (invoice void).
                  </p>
                ) : null}
              </section>
            ) : (
              <section className="card">
                <h2>Record Sale</h2>
                <div className="note">You don’t have permission to record sales.</div>
              </section>
            )}

            <section className="card">
              <h2>Sales List</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      {authUser?.role === "SALES" ? null : <th>User</th>}
                      <th>Method</th>
                      <th className="right">Total (UGX)</th>
                      <th>Invoice</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.length ? (
                      sales.map((sale) => {
                        const isSalesUser = authUser?.role === "SALES";
                        const canEdit =
                          !sale.isVoid &&
                          sale.paymentMethod !== "CREDIT" &&
                          (authUser?.role === "ADMIN" ||
                            (isSalesUser && sale.userId === authUser?.id && sale.saleDate === todayLocalYmd() && !salesDayLock));
                        const canVoid =
                          !sale.isVoid &&
                          (authUser?.role === "ADMIN" ||
                            (isSalesUser &&
                              sale.userId === authUser?.id &&
                              sale.saleDate === todayLocalYmd() &&
                              sale.paymentMethod !== "CREDIT" &&
                              !salesDayLock));

                        return (
                          <tr key={sale.id} style={{ opacity: sale.isVoid ? 0.6 : 1 }}>
                            <td>{sale.saleDate}</td>
                            {isSalesUser ? null : <td>{sale.userFullName}</td>}
                            <td>{sale.paymentMethod}</td>
                            <td className="right">{sale.totalAmount}</td>
                            <td>{sale.invoiceNumber ?? "-"}</td>
                            <td>{sale.isVoid ? "VOID" : "ACTIVE"}</td>
                            <td>
                              <div className="approvalActions">
                                <button data-variant="ghost" type="button" onClick={() => void loadSaleDetail(sale.id)}>
                                  View
                                </button>
                                {canEdit ? (
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      if (!auth) {
                                        return;
                                      }
                                      void (async () => {
                                        const detail = await getSale(auth.token, sale.id);
                                        setSelectedSale(detail);
                                        await startEditSale(detail);
                                      })();
                                    }}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                                {canVoid ? (
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm("Void this sale? This cannot be undone.")) {
                                        return;
                                      }
                                      void handleVoidSale(sale.id);
                                    }}
                                  >
                                    Void
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={authUser?.role === "SALES" ? 6 : 7}>No sales found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {selectedSale ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Sale Detail</h2>
                <div className="meta">
                  <div>
                    <strong>{selectedSale.sale.shopCode}</strong>
                    <div className="hint">
                      {selectedSale.sale.shopName} • {selectedSale.sale.saleDate}
                    </div>
                  </div>
                  <div className="hint">
                    {selectedSale.sale.paymentMethod} • UGX {selectedSale.sale.totalAmount} •{" "}
                    {selectedSale.sale.isVoid ? "VOID" : "ACTIVE"}
                  </div>
                </div>

                <div className="divider" />

                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th className="right">Qty</th>
                        <th className="right">Unit</th>
                        <th className="right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{line.skuCode}</td>
                          <td>{line.productName}</td>
                          <td className="right">{line.quantity}</td>
                          <td className="right">{line.unitPrice}</td>
                          <td className="right">{line.lineTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {canReconcile ? (
              <section className="card">
                <h2>Daily Reconciliation</h2>
                <p className="hint">Lock a shop’s date to prevent sales edits for that day.</p>
                <form className="form form--three" onSubmit={submitReconcile}>
                  <label>
                    Shop
                    <select
                      value={reconcileForm.shopId}
                      onChange={(event) => setReconcileForm((prev) => ({ ...prev, shopId: event.target.value }))}
                      required
                    >
                      {shops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.code} — {shop.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date
                    <input
                      type="date"
                      value={reconcileForm.lockDate}
                      onChange={(event) => setReconcileForm((prev) => ({ ...prev, lockDate: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Notes
                    <input
                      value={reconcileForm.notes}
                      onChange={(event) => setReconcileForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
                  <button type="submit" disabled={reconcileBusy}>
                    {reconcileBusy ? "Locking..." : "Reconcile (Lock)"}
                  </button>
                </form>

                <div style={{ marginTop: "1rem" }}>
                  <p className="subhead">Recent Locks</p>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Shop</th>
                          <th>Date</th>
                          <th>Locked by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliationLocks.length ? (
                          reconciliationLocks.slice(0, 15).map((lock) => (
                            <tr key={lock.id}>
                              <td>{lock.shopCode}</td>
                              <td>{lock.lockDate}</td>
                              <td>{lock.lockedByFullName ?? lock.lockedByUserId ?? "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>No reconciliation locks.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : activeView === "expenses" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Expenses</h2>
              <p className="hint">
                Record expenses with a payment source. Salesperson cash expenses reduce that salesperson’s cash at hand.
              </p>

              <form
                className="form form--three"
                onSubmit={(event) => {
                  event.preventDefault();
                  void refreshExpensesData();
                }}
              >
                <label>
                  Shop
                  <select
                    value={expenseFilters.shopId}
                    onChange={(event) => setExpenseFilters((prev) => ({ ...prev, shopId: event.target.value }))}
                    disabled={authUser?.role === "SALES"}
                  >
                    {shops.map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.code} — {shop.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={expenseFilters.expenseDate}
                    onChange={(event) => setExpenseFilters((prev) => ({ ...prev, expenseDate: event.target.value }))}
                  />
                </label>
                <button type="submit" disabled={expensesBusy}>
                  {expensesBusy ? "Loading..." : "Refresh"}
                </button>
              </form>
            </section>

            {canCreateExpenses ? (
              <section className="card">
                <h2>Record Expense</h2>

                {authUser?.role !== "ADMIN" ? (
                  <div className="note">Payment source is fixed to Salesperson Cash for sales users.</div>
                ) : null}

                <form className="form form--three" onSubmit={submitExpense}>
                  {authUser?.role === "ADMIN" ? (
                    <label>
                      Shop
                      <select
                        value={newExpenseForm.shopId}
                        onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, shopId: event.target.value }))}
                        required
                      >
                        {shops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.code} — {shop.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label>
                    Payment source
                    <select
                      value={authUser?.role === "ADMIN" ? newExpenseForm.paymentSource : "SALESPERSON_CASH"}
                      onChange={(event) =>
                        setNewExpenseForm((prev) => ({
                          ...prev,
                          paymentSource: event.target.value === "ADMIN_BANK" ? "ADMIN_BANK" : "SALESPERSON_CASH"
                        }))
                      }
                      disabled={authUser?.role !== "ADMIN"}
                    >
                      <option value="SALESPERSON_CASH">Paid by salesperson cash</option>
                      <option value="ADMIN_BANK">Paid by admin/bank</option>
                    </select>
                  </label>

                  {authUser?.role === "ADMIN" && newExpenseForm.paymentSource === "SALESPERSON_CASH" ? (
                    <label>
                      Paid by (Salesperson)
                      <select
                        value={newExpenseForm.paidByUserId}
                        onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, paidByUserId: event.target.value }))}
                        required
                      >
                        <option value="">Select salesperson...</option>
                        {users
                          .filter((u) => u.role === "SALES")
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.fullName} • {u.mobileNumber}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}

                  <label>
                    Category
                    <select
                      value={newExpenseForm.categoryId}
                      onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, categoryId: event.target.value }))}
                      required
                    >
                      <option value="">Select category...</option>
                      {expenseCategories
                        .filter((c) => c.isActive)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label>
                    Amount (UGX)
                    <input
                      type="number"
                      min={1}
                      value={newExpenseForm.amountUGX}
                      onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, amountUGX: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    Date
                    <input
                      type="date"
                      value={newExpenseForm.date}
                      onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, date: event.target.value }))}
                      required
                    />
                  </label>

                  <label>
                    Notes (optional)
                    <input
                      value={newExpenseForm.notes}
                      onChange={(event) => setNewExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>

                  <button type="submit" disabled={expensesBusy}>
                    {expensesBusy ? "Saving..." : "Record expense"}
                  </button>
                </form>
              </section>
            ) : (
              <section className="card">
                <h2>Record Expense</h2>
                <div className="note">You don’t have permission to record expenses.</div>
              </section>
            )}

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Expense List</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shop</th>
                      <th>Category</th>
                      <th className="right">Amount</th>
                      <th>Source</th>
                      <th>Paid by</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length ? (
                      expenses.map((expense) => (
                        <tr key={expense.id} style={{ opacity: expense.isVoid ? 0.6 : 1 }}>
                          <td>{expense.expenseDate}</td>
                          <td>{expense.shopCode}</td>
                          <td>{expense.categoryName}</td>
                          <td className="right">{expense.amountUGX}</td>
                          <td>{expense.paymentSource}</td>
                          <td>{expense.paymentSource === "SALESPERSON_CASH" ? expense.paidByFullName ?? "-" : "-"}</td>
                          <td>{expense.isVoid ? "VOID" : "ACTIVE"}</td>
                          <td>
                            {canVoidExpenses && !expense.isVoid ? (
                              <button
                                data-variant="ghost"
                                type="button"
                                onClick={() => {
                                  if (!window.confirm("Void this expense? This cannot be undone.")) {
                                    return;
                                  }
                                  void handleVoidExpense(expense.id);
                                }}
                              >
                                Void
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8}>No expenses found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
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
