import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createBankingRequest,
  createCustomer,
  createCashTransfer,
  createExpenseCategory,
  createExpense,
  createDamageEvent,
  createInvoice,
  createInvoicePayment,
  createInventoryTransfer,
  createMessagingTemplate,
  createReconciliationLock,
  createSale,
  createStockReceipt,
  createProduct,
  createProductCategory,
  createWorkshopBatch,
  createWorkshopSheetReceipt,
  decideBankingRequest,
  decideCashTransfer,
  exportCapitalReport,
  exportCommissionsReport,
  exportCashReport,
  exportExpenseReport,
  exportInvoiceReport,
  exportPaymentsReport,
  exportPlReport,
  exportSalesReport,
  getAdminCashOverview,
  getCapitalReport,
  getCashMe,
  getCashReport,
  getCommissionsReport,
  getExpenseReport,
  getInvoiceReport,
  getPaymentsReport,
  getSale,
  getInvoice,
  getMe,
  getPlReport,
  getSalesReport,
  getWorkshopSheetSummary,
  listBankingRequests,
  listCashRecipients,
  listCashTransfers,
  listCustomers,
  listDamageEvents,
  listExpenses,
  listExpenseCategories,
  listInventoryStock,
  listInventoryTransfers,
  listInvoicePayments,
  listInvoices,
  listMessagingLogs,
  listMessagingQueue,
  listMessagingTemplates,
  listMyNotifications,
  listReconciliationLocks,
  listSales,
  listProductCategories,
  listProducts,
  listShops,
  listUsers,
  listWorkshopBatches,
  listWorkshopSheetReceipts,
  listWorkshopStock,
  login,
  markNotificationRead,
  receiveInventoryTransfer,
  runAdminDailySummary,
  runOverdueReminders,
  shipInventoryTransfer,
  updateMessagingQueueStatus,
  updateMessagingTemplate,
  updateSale,
  updateCustomer,
  updateInvoice,
  updateExpenseCategory,
  updateProduct,
  updateProductCategory,
  voidSale,
  voidExpense,
  type AdminCashOverview,
  type AuthUser,
  type BankingRequest,
  type CapitalReport,
  type CashRecipient,
  type CashSummary,
  type CashTransfer,
  type CashReport,
  type CommissionsReport,
  type Customer,
  type Expense,
  type ExpenseCategory,
  type ExpenseReport,
  type Invoice,
  type InvoiceDetail,
  type InvoicePayment,
  type InvoiceReport,
  type InvoiceReportStatus,
  type InventoryStockRow,
  type InventoryTransfer,
  type InventoryTransferStatus,
  type MessagingChannel,
  type MessagingLogEvent,
  type MessagingQueueItem,
  type MessagingQueueStatus,
  type MessagingTemplate,
  type NotificationItem,
  type OverdueRemindersRunResult,
  type AdminDailySummaryRunResult,
  type PaymentMethod,
  type PaymentsReport,
  type PlReport,
  type Product,
  type ProductCategory,
  type ReportExportFormat,
  type ReconciliationLock,
  type Sale,
  type SaleDetail,
  type SalePaymentMethod,
  type ShopDamageEvent,
  type StockReceipt,
  type SalesReport,
  type SalesReportPeriod,
  type Shop,
  type WorkshopBatch,
  type WorkshopSheetReceipt,
  type WorkshopSheetSummary,
  type WorkshopStockRow
} from "./lib/api";
import { cx } from "./ui/cx";
import { Button, IconButton } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { ToastStack, type Toast, type ToastTone } from "./ui/ToastStack";
import { ComboboxField, SelectField, TextAreaField, TextField } from "./ui/Field";
import { Table } from "./ui/Table";
import {
  IconCash,
  IconClose,
  IconCommissions,
  IconCustomers,
  IconDashboard,
  IconExpenses,
  IconInvoices,
  IconLogout,
  IconMasterData,
  IconMenu,
  IconMessaging,
  IconPayments,
  IconProjects,
  IconReports,
  IconSales
} from "./ui/icons";

type AuthState = {
  token: string;
  user: AuthUser;
};

type ActiveView = "overview" | "customers" | "invoices" | "inventory" | "sales" | "expenses" | "cash" | "reports" | "messaging" | "master-data";
type MasterSection = "expense-categories" | "product-categories" | "products";
type ReportSection = "sales" | "commissions" | "invoices" | "payments" | "cash" | "expenses" | "pl" | "capital";
type InventorySection = "stock" | "transfers" | "workshop";
type MessagingSection = "templates" | "queue" | "logs" | "jobs";

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

function daysAgoLocalYmd(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [masterSection, setMasterSection] = useState<MasterSection>("expense-categories");
  const [reportSection, setReportSection] = useState<ReportSection>("sales");

  const [toasts, setToasts] = useState<Toast[]>([]);

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
  const [invoiceCreateOpen, setInvoiceCreateOpen] = useState(false);
  const [invoicePaymentOpen, setInvoicePaymentOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
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

  const [cashBusy, setCashBusy] = useState(false);
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null);
  const [cashRecipients, setCashRecipients] = useState<CashRecipient[]>([]);
  const [cashTransfers, setCashTransfers] = useState<CashTransfer[]>([]);
  const [bankingRequests, setBankingRequests] = useState<BankingRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [adminCashOverview, setAdminCashOverview] = useState<AdminCashOverview | null>(null);

  const [adminCashFilters, setAdminCashFilters] = useState<{ shopId: string; dateFrom: string; dateTo: string }>({
    shopId: "",
    dateFrom: "",
    dateTo: ""
  });

  const [newTransferForm, setNewTransferForm] = useState<{ shopId: string; receiverUserId: string; amountUGX: string; notes: string }>({
    shopId: "",
    receiverUserId: "",
    amountUGX: "",
    notes: ""
  });

  const [newBankingForm, setNewBankingForm] = useState<{ amountUGX: string; notes: string }>({
    amountUGX: "",
    notes: ""
  });

  const [reportsBusy, setReportsBusy] = useState(false);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [commissionsReport, setCommissionsReport] = useState<CommissionsReport | null>(null);
  const [invoiceReport, setInvoiceReport] = useState<InvoiceReport | null>(null);
  const [paymentsReport, setPaymentsReport] = useState<PaymentsReport | null>(null);
  const [cashReport, setCashReport] = useState<CashReport | null>(null);
  const [expenseReport, setExpenseReport] = useState<ExpenseReport | null>(null);
  const [plReport, setPlReport] = useState<PlReport | null>(null);
  const [capitalReport, setCapitalReport] = useState<CapitalReport | null>(null);

  const [salesReportFilters, setSalesReportFilters] = useState<{
    shopId: string;
    period: SalesReportPeriod;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    period: "daily",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [commissionsReportFilters, setCommissionsReportFilters] = useState<{
    shopId: string;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [invoiceReportFilters, setInvoiceReportFilters] = useState<{
    shopId: string;
    status: InvoiceReportStatus;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    status: "ALL",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [paymentsReportFilters, setPaymentsReportFilters] = useState<{
    shopId: string;
    method: PaymentMethod | "";
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    method: "",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [cashReportFilters, setCashReportFilters] = useState<{
    shopId: string;
    asOf: string;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    asOf: todayLocalYmd(),
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [expenseReportFilters, setExpenseReportFilters] = useState<{
    shopId: string;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [plReportFilters, setPlReportFilters] = useState<{
    shopId: string;
    dateFrom: string;
    dateTo: string;
  }>({
    shopId: "",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [capitalReportFilters, setCapitalReportFilters] = useState<{
    shopId: string;
    asOf: string;
  }>({
    shopId: "",
    asOf: todayLocalYmd()
  });

  const [inventorySection, setInventorySection] = useState<InventorySection>("stock");
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [inventoryFilters, setInventoryFilters] = useState<{ shopId: string; transferStatus: InventoryTransferStatus | "" }>({
    shopId: "",
    transferStatus: ""
  });
  const [inventoryDateRange, setInventoryDateRange] = useState<{ dateFrom: string; dateTo: string }>({
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd()
  });

  const [shopStockRows, setShopStockRows] = useState<InventoryStockRow[]>([]);
  const [damageEvents, setDamageEvents] = useState<ShopDamageEvent[]>([]);
  const [inventoryTransfers, setInventoryTransfers] = useState<InventoryTransfer[]>([]);
  const [transferReceiveDrafts, setTransferReceiveDrafts] = useState<Record<string, Record<string, string>>>({});
  const [transferReceiveNotesDrafts, setTransferReceiveNotesDrafts] = useState<Record<string, string>>({});

  const [workshopSheetSummary, setWorkshopSheetSummary] = useState<WorkshopSheetSummary | null>(null);
  const [workshopSheetReceipts, setWorkshopSheetReceipts] = useState<WorkshopSheetReceipt[]>([]);
  const [workshopStockRows, setWorkshopStockRows] = useState<WorkshopStockRow[]>([]);
  const [workshopBatches, setWorkshopBatches] = useState<WorkshopBatch[]>([]);

  const [newStockReceiptForm, setNewStockReceiptForm] = useState<{
    shopId: string;
    productId: string;
    receiptDate: string;
    quantity: string;
    notes: string;
  }>({
    shopId: "",
    productId: "",
    receiptDate: todayLocalYmd(),
    quantity: "",
    notes: ""
  });

  const [newDamageForm, setNewDamageForm] = useState<{
    shopId: string;
    productId: string;
    damageDate: string;
    quantity: string;
    reason: string;
    notes: string;
  }>({
    shopId: "",
    productId: "",
    damageDate: todayLocalYmd(),
    quantity: "",
    reason: "",
    notes: ""
  });

  const [newSheetReceiptForm, setNewSheetReceiptForm] = useState<{
    receiptDate: string;
    quantitySheets: string;
    supplier: string;
    costPerSheet: string;
    notes: string;
  }>({
    receiptDate: todayLocalYmd(),
    quantitySheets: "",
    supplier: "",
    costPerSheet: "",
    notes: ""
  });

  const [newWorkshopBatchForm, setNewWorkshopBatchForm] = useState<{
    batchDate: string;
    notes: string;
    lines: Array<{
      productId: string;
      sheetsUsed: string;
      actualGood: string;
      actualDamaged: string;
      actualWaste: string;
      notes: string;
    }>;
  }>({
    batchDate: todayLocalYmd(),
    notes: "",
    lines: [{ productId: "", sheetsUsed: "1", actualGood: "", actualDamaged: "0", actualWaste: "0", notes: "" }]
  });

  const [newInvTransferForm, setNewInvTransferForm] = useState<{
    toShopId: string;
    notes: string;
    lines: Array<{ productId: string; quantity: string }>;
  }>({
    toShopId: "",
    notes: "",
    lines: [{ productId: "", quantity: "1" }]
  });

  const [messagingSection, setMessagingSection] = useState<MessagingSection>("templates");
  const [messagingBusy, setMessagingBusy] = useState(false);
  const [messagingTemplates, setMessagingTemplates] = useState<MessagingTemplate[]>([]);
  const [messagingQueue, setMessagingQueue] = useState<MessagingQueueItem[]>([]);
  const [messagingLogs, setMessagingLogs] = useState<MessagingLogEvent[]>([]);
  const [messagingQueueFilters, setMessagingQueueFilters] = useState<{
    status: MessagingQueueStatus | "";
    channel: MessagingChannel | "";
    dateFrom: string;
    dateTo: string;
    queueId: string;
  }>({
    status: "",
    channel: "",
    dateFrom: daysAgoLocalYmd(29),
    dateTo: todayLocalYmd(),
    queueId: ""
  });

  const [newMessagingTemplateForm, setNewMessagingTemplateForm] = useState<{
    templateKey: string;
    channel: MessagingChannel;
    subject: string;
    body: string;
    notes: string;
    isActive: boolean;
  }>({
    templateKey: "OVERDUE_INVOICE_REMINDER",
    channel: "WHATSAPP",
    subject: "",
    body: "",
    notes: "",
    isActive: true
  });

  const [editingMessagingTemplateId, setEditingMessagingTemplateId] = useState<string | null>(null);
  const [editingMessagingTemplateForm, setEditingMessagingTemplateForm] = useState<{
    subject: string;
    body: string;
    notes: string;
    isActive: boolean;
  } | null>(null);

  const [runOverdueRemindersForm, setRunOverdueRemindersForm] = useState<{ asOfDate: string; notes: string }>({
    asOfDate: todayLocalYmd(),
    notes: ""
  });
  const [runDailySummaryForm, setRunDailySummaryForm] = useState<{ date: string; notes: string }>({
    date: todayLocalYmd(),
    notes: ""
  });
  const [lastOverdueRunResult, setLastOverdueRunResult] = useState<OverdueRemindersRunResult | null>(null);
  const [lastDailySummaryResult, setLastDailySummaryResult] = useState<AdminDailySummaryRunResult | null>(null);

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

  function dismissToast(id: string): void {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function pushToast(tone: ToastTone, message: string, title?: string): void {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, tone, message, title };
    setToasts((prev) => [...prev, toast].slice(-4));
    window.setTimeout(() => dismissToast(id), 5200);
  }

  useEffect(() => {
    if (!error) {
      return;
    }
    pushToast("error", error);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (!success) {
      return;
    }
    pushToast("success", success);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

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
  const canViewCash = authUser?.role === "ADMIN" || authUser?.role === "MANAGER" || authUser?.role === "SALES";
  const canApproveBanking = authUser?.role === "ADMIN";
  const canViewReports = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const canViewCapitalReport = authUser?.role === "ADMIN";
  const canViewInventory = authUser?.role === "ADMIN" || authUser?.role === "MANAGER" || authUser?.role === "SALES";
  const canManageWorkshop = authUser?.role === "ADMIN";
  const canManageInventoryTransfers = authUser?.role === "ADMIN";
  const canReceiveInventoryTransfers = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canReceiveStock = authUser?.role === "ADMIN";
  const canRecordDamages = authUser?.role === "ADMIN" || authUser?.role === "SALES";
  const canViewWorkshop = authUser?.role === "ADMIN" || authUser?.role === "MANAGER";
  const canManageMessaging = authUser?.role === "ADMIN";

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
    setSidebarOpen(false);
    setInvoiceCreateOpen(false);
    setInvoicePaymentOpen(false);
    setInvoiceSearch("");
    setActiveView("overview");
    setReportSection("sales");
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
    setCashSummary(null);
    setCashRecipients([]);
    setCashTransfers([]);
    setBankingRequests([]);
    setNotifications([]);
    setAdminCashOverview(null);
    setSalesReport(null);
    setCommissionsReport(null);
    setInvoiceReport(null);
    setPaymentsReport(null);
    setCashReport(null);
    setExpenseReport(null);
    setPlReport(null);
    setCapitalReport(null);
    setInventorySection("stock");
    setInventoryFilters({ shopId: "", transferStatus: "" });
    setInventoryDateRange({ dateFrom: daysAgoLocalYmd(29), dateTo: todayLocalYmd() });
    setShopStockRows([]);
    setDamageEvents([]);
    setInventoryTransfers([]);
    setTransferReceiveDrafts({});
    setTransferReceiveNotesDrafts({});
    setWorkshopSheetSummary(null);
    setWorkshopSheetReceipts([]);
    setWorkshopStockRows([]);
    setWorkshopBatches([]);
    setNewStockReceiptForm({ shopId: "", productId: "", receiptDate: todayLocalYmd(), quantity: "", notes: "" });
    setNewDamageForm({ shopId: "", productId: "", damageDate: todayLocalYmd(), quantity: "", reason: "", notes: "" });
    setNewSheetReceiptForm({ receiptDate: todayLocalYmd(), quantitySheets: "", supplier: "", costPerSheet: "", notes: "" });
    setNewWorkshopBatchForm({
      batchDate: todayLocalYmd(),
      notes: "",
      lines: [{ productId: "", sheetsUsed: "1", actualGood: "", actualDamaged: "0", actualWaste: "0", notes: "" }]
    });
    setNewInvTransferForm({ toShopId: "", notes: "", lines: [{ productId: "", quantity: "1" }] });
    setMessagingSection("templates");
    setMessagingTemplates([]);
    setMessagingQueue([]);
    setMessagingLogs([]);
    setMessagingQueueFilters({ status: "", channel: "", dateFrom: daysAgoLocalYmd(29), dateTo: todayLocalYmd(), queueId: "" });
    setNewMessagingTemplateForm({
      templateKey: "OVERDUE_INVOICE_REMINDER",
      channel: "WHATSAPP",
      subject: "",
      body: "",
      notes: "",
      isActive: true
    });
    setEditingMessagingTemplateId(null);
    setEditingMessagingTemplateForm(null);
    setRunOverdueRemindersForm({ asOfDate: todayLocalYmd(), notes: "" });
    setRunDailySummaryForm({ date: todayLocalYmd(), notes: "" });
    setLastOverdueRunResult(null);
    setLastDailySummaryResult(null);
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
        setAdminCashFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setNewTransferForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setSalesReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setCommissionsReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setInvoiceReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setPaymentsReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setCashReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setExpenseReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setPlReportFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setInventoryFilters((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setNewStockReceiptForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setNewDamageForm((prev) => (prev.shopId || !shopData.length ? prev : { ...prev, shopId: shopData[0].id }));
        setNewInvTransferForm((prev) => (prev.toShopId || !shopData.length ? prev : { ...prev, toShopId: shopData[0].id }));
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

  async function refreshCashData(): Promise<void> {
    if (!auth || !canViewCash) {
      return;
    }

    setCashBusy(true);
    setError(null);

    try {
      const recipientsPromise =
        authUser?.role === "ADMIN" && newTransferForm.shopId
          ? listCashRecipients(auth.token, { shopId: newTransferForm.shopId })
          : listCashRecipients(auth.token);

      const bankingsPromise =
        authUser?.role === "ADMIN"
          ? listBankingRequests(auth.token, { status: "PENDING" })
          : listBankingRequests(auth.token);

      const overviewPromise =
        authUser?.role === "ADMIN"
          ? getAdminCashOverview(auth.token, {
              shopId: adminCashFilters.shopId || undefined,
              dateFrom: adminCashFilters.dateFrom || undefined,
              dateTo: adminCashFilters.dateTo || undefined
            })
          : Promise.resolve(null);

      const [summary, recipients, transfers, bankings, notifs, overview] = await Promise.all([
        getCashMe(auth.token),
        recipientsPromise,
        listCashTransfers(auth.token),
        bankingsPromise,
        listMyNotifications(auth.token),
        overviewPromise
      ]);

      setCashSummary(summary);
      setCashRecipients(recipients);
      setCashTransfers(transfers);
      setBankingRequests(bankings);
      setNotifications(notifs);
      setAdminCashOverview(overview);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load cash data");
    } finally {
      setCashBusy(false);
    }
  }

  async function submitCashTransfer(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setCashBusy(true);

    try {
      const amount = Number.parseInt(newTransferForm.amountUGX, 10);
      if (!newTransferForm.receiverUserId) {
        throw new Error("Receiver is required.");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than 0.");
      }
      if (authUser?.role === "ADMIN" && !newTransferForm.shopId) {
        throw new Error("Shop is required.");
      }

      const trimmedNotes = newTransferForm.notes.trim();

      await createCashTransfer(auth.token, {
        ...(authUser?.role === "ADMIN" ? { shopId: newTransferForm.shopId } : {}),
        receiverUserId: newTransferForm.receiverUserId,
        amountUGX: amount,
        notes: trimmedNotes ? trimmedNotes : null
      });

      setSuccess("Transfer request sent.");
      setNewTransferForm((prev) => ({ ...prev, receiverUserId: "", amountUGX: "", notes: "" }));
      await refreshCashData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create transfer");
    } finally {
      setCashBusy(false);
    }
  }

  async function decideTransfer(transferId: string, decision: "APPROVE" | "REJECT"): Promise<void> {
    if (!auth) {
      return;
    }
    setError(null);
    setSuccess(null);
    setCashBusy(true);
    try {
      await decideCashTransfer(auth.token, transferId, { decision });
      setSuccess(decision === "APPROVE" ? "Transfer approved." : "Transfer rejected.");
      await refreshCashData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to update transfer");
    } finally {
      setCashBusy(false);
    }
  }

  async function submitBanking(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!auth || authUser?.role !== "SALES") {
      return;
    }
    setError(null);
    setSuccess(null);
    setCashBusy(true);
    try {
      const amount = Number.parseInt(newBankingForm.amountUGX, 10);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than 0.");
      }
      const trimmedNotes = newBankingForm.notes.trim();
      await createBankingRequest(auth.token, {
        amountUGX: amount,
        notes: trimmedNotes ? trimmedNotes : null
      });
      setSuccess("Banking request submitted.");
      setNewBankingForm({ amountUGX: "", notes: "" });
      await refreshCashData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to create banking request");
    } finally {
      setCashBusy(false);
    }
  }

  async function decideBanking(bankingId: string, decision: "APPROVE" | "REJECT"): Promise<void> {
    if (!auth || !canApproveBanking) {
      return;
    }
    setError(null);
    setSuccess(null);
    setCashBusy(true);
    try {
      await decideBankingRequest(auth.token, bankingId, { decision });
      setSuccess(decision === "APPROVE" ? "Banking approved." : "Banking rejected.");
      await refreshCashData();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to update banking request");
    } finally {
      setCashBusy(false);
    }
  }

  async function handleMarkNotificationRead(notifId: string): Promise<void> {
    if (!auth) {
      return;
    }
    setError(null);
    setCashBusy(true);
    try {
      await markNotificationRead(auth.token, notifId);
      const next = await listMyNotifications(auth.token);
      setNotifications(next);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to mark notification read");
    } finally {
      setCashBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewCash) {
      return;
    }
    if (activeView !== "cash") {
      return;
    }
    void refreshCashData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, auth?.token, canViewCash, authUser?.role, newTransferForm.shopId]);

  function triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function refreshReportsData(): Promise<void> {
    if (!auth || !canViewReports) {
      return;
    }
    setReportsBusy(true);
    setError(null);
    try {
      if (reportSection === "sales") {
        const report = await getSalesReport(auth.token, {
          period: salesReportFilters.period,
          shopId: salesReportFilters.shopId || undefined,
          dateFrom: salesReportFilters.dateFrom || undefined,
          dateTo: salesReportFilters.dateTo || undefined
        });
        setSalesReport(report);
      } else if (reportSection === "commissions") {
        const report = await getCommissionsReport(auth.token, {
          shopId: commissionsReportFilters.shopId || undefined,
          dateFrom: commissionsReportFilters.dateFrom || undefined,
          dateTo: commissionsReportFilters.dateTo || undefined
        });
        setCommissionsReport(report);
      } else if (reportSection === "invoices") {
        const report = await getInvoiceReport(auth.token, {
          status: invoiceReportFilters.status,
          shopId: invoiceReportFilters.shopId || undefined,
          dateFrom: invoiceReportFilters.dateFrom || undefined,
          dateTo: invoiceReportFilters.dateTo || undefined
        });
        setInvoiceReport(report);
      } else if (reportSection === "payments") {
        const report = await getPaymentsReport(auth.token, {
          shopId: paymentsReportFilters.shopId || undefined,
          method: paymentsReportFilters.method || undefined,
          dateFrom: paymentsReportFilters.dateFrom || undefined,
          dateTo: paymentsReportFilters.dateTo || undefined
        });
        setPaymentsReport(report);
      } else if (reportSection === "cash") {
        const report = await getCashReport(auth.token, {
          shopId: cashReportFilters.shopId || undefined,
          asOf: cashReportFilters.asOf || undefined,
          dateFrom: cashReportFilters.dateFrom || undefined,
          dateTo: cashReportFilters.dateTo || undefined
        });
        setCashReport(report);
      } else if (reportSection === "expenses") {
        const report = await getExpenseReport(auth.token, {
          shopId: expenseReportFilters.shopId || undefined,
          dateFrom: expenseReportFilters.dateFrom || undefined,
          dateTo: expenseReportFilters.dateTo || undefined
        });
        setExpenseReport(report);
      } else if (reportSection === "pl") {
        const report = await getPlReport(auth.token, {
          shopId: plReportFilters.shopId || undefined,
          dateFrom: plReportFilters.dateFrom || undefined,
          dateTo: plReportFilters.dateTo || undefined
        });
        setPlReport(report);
      } else if (reportSection === "capital") {
        const report = await getCapitalReport(auth.token, {
          shopId: capitalReportFilters.shopId || undefined,
          asOf: capitalReportFilters.asOf || undefined
        });
        setCapitalReport(report);
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load report");
    } finally {
      setReportsBusy(false);
    }
  }

  async function exportCurrentReport(format: ReportExportFormat): Promise<void> {
    if (!auth || !canViewReports) {
      return;
    }
    setReportsBusy(true);
    setError(null);
    try {
      if (reportSection === "sales") {
        const file = await exportSalesReport(
          auth.token,
          {
            period: salesReportFilters.period,
            shopId: salesReportFilters.shopId || undefined,
            dateFrom: salesReportFilters.dateFrom || undefined,
            dateTo: salesReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "commissions") {
        const file = await exportCommissionsReport(
          auth.token,
          {
            shopId: commissionsReportFilters.shopId || undefined,
            dateFrom: commissionsReportFilters.dateFrom || undefined,
            dateTo: commissionsReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "invoices") {
        const file = await exportInvoiceReport(
          auth.token,
          {
            status: invoiceReportFilters.status,
            shopId: invoiceReportFilters.shopId || undefined,
            dateFrom: invoiceReportFilters.dateFrom || undefined,
            dateTo: invoiceReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "payments") {
        const file = await exportPaymentsReport(
          auth.token,
          {
            shopId: paymentsReportFilters.shopId || undefined,
            method: paymentsReportFilters.method || undefined,
            dateFrom: paymentsReportFilters.dateFrom || undefined,
            dateTo: paymentsReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "cash") {
        const file = await exportCashReport(
          auth.token,
          {
            shopId: cashReportFilters.shopId || undefined,
            asOf: cashReportFilters.asOf || undefined,
            dateFrom: cashReportFilters.dateFrom || undefined,
            dateTo: cashReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "expenses") {
        const file = await exportExpenseReport(
          auth.token,
          {
            shopId: expenseReportFilters.shopId || undefined,
            dateFrom: expenseReportFilters.dateFrom || undefined,
            dateTo: expenseReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "pl") {
        const file = await exportPlReport(
          auth.token,
          {
            shopId: plReportFilters.shopId || undefined,
            dateFrom: plReportFilters.dateFrom || undefined,
            dateTo: plReportFilters.dateTo || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      } else if (reportSection === "capital") {
        const file = await exportCapitalReport(
          auth.token,
          {
            shopId: capitalReportFilters.shopId || undefined,
            asOf: capitalReportFilters.asOf || undefined
          },
          format
        );
        triggerBrowserDownload(file.blob, file.filename);
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to export report");
    } finally {
      setReportsBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewReports) {
      return;
    }
    if (activeView !== "reports") {
      return;
    }
    void refreshReportsData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeView,
    auth?.token,
    canViewReports,
    reportSection,
    salesReportFilters.shopId,
    salesReportFilters.period,
    salesReportFilters.dateFrom,
    salesReportFilters.dateTo,
    commissionsReportFilters.shopId,
    commissionsReportFilters.dateFrom,
    commissionsReportFilters.dateTo,
    invoiceReportFilters.shopId,
    invoiceReportFilters.status,
    invoiceReportFilters.dateFrom,
    invoiceReportFilters.dateTo,
    paymentsReportFilters.shopId,
    paymentsReportFilters.method,
    paymentsReportFilters.dateFrom,
    paymentsReportFilters.dateTo,
    cashReportFilters.shopId,
    cashReportFilters.asOf,
    cashReportFilters.dateFrom,
    cashReportFilters.dateTo,
    expenseReportFilters.shopId,
    expenseReportFilters.dateFrom,
    expenseReportFilters.dateTo,
    plReportFilters.shopId,
    plReportFilters.dateFrom,
    plReportFilters.dateTo,
    capitalReportFilters.shopId,
    capitalReportFilters.asOf
  ]);

  async function refreshInventoryStockData(): Promise<void> {
    if (!auth || !canViewInventory) {
      return;
    }
    setInventoryBusy(true);
    setError(null);
    try {
      const [productData, stockData, damageData] = await Promise.all([
        listProducts(auth.token),
        listInventoryStock(auth.token, { shopId: inventoryFilters.shopId || undefined }),
        listDamageEvents(auth.token, {
          shopId: inventoryFilters.shopId || undefined,
          dateFrom: inventoryDateRange.dateFrom || undefined,
          dateTo: inventoryDateRange.dateTo || undefined
        })
      ]);
      setProducts(productData);
      setShopStockRows(stockData);
      setDamageEvents(damageData.items);

      const firstActiveProduct = productData.find((p) => p.isActive) ?? productData[0] ?? null;
      const firstActiveNonBoard =
        productData.find((p) => p.isActive && p.productType === "NON_BOARD") ??
        productData.find((p) => p.productType === "NON_BOARD") ??
        null;

      if (firstActiveNonBoard) {
        setNewStockReceiptForm((prev) => (prev.productId ? prev : { ...prev, productId: firstActiveNonBoard.id }));
      } else if (firstActiveProduct) {
        setNewStockReceiptForm((prev) => (prev.productId ? prev : { ...prev, productId: firstActiveProduct.id }));
      }

      if (firstActiveProduct) {
        setNewDamageForm((prev) => (prev.productId ? prev : { ...prev, productId: firstActiveProduct.id }));
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load inventory");
    } finally {
      setInventoryBusy(false);
    }
  }

  async function refreshInventoryTransfersData(): Promise<void> {
    if (!auth || !canViewInventory) {
      return;
    }
    setInventoryBusy(true);
    setError(null);
    try {
      const [productData, transfersData] = await Promise.all([
        listProducts(auth.token),
        listInventoryTransfers(auth.token, {
          shopId: inventoryFilters.shopId || undefined,
          status: inventoryFilters.transferStatus || undefined
        })
      ]);
      setProducts(productData);
      setInventoryTransfers(transfersData);

      const firstBoard =
        productData.find((p) => p.isActive && p.productType === "BOARD") ?? productData.find((p) => p.productType === "BOARD") ?? null;
      if (firstBoard) {
        setNewInvTransferForm((prev) => {
          const lines = prev.lines.length ? prev.lines : [{ productId: "", quantity: "1" }];
          if (lines[0].productId) {
            return prev;
          }
          const nextLines = [...lines];
          nextLines[0] = { ...nextLines[0], productId: firstBoard.id };
          return { ...prev, lines: nextLines };
        });
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load transfers");
    } finally {
      setInventoryBusy(false);
    }
  }

  async function refreshWorkshopData(): Promise<void> {
    if (!auth || !canViewWorkshop) {
      return;
    }
    setInventoryBusy(true);
    setError(null);
    try {
      const [productData, summary, receiptsData, batchesData, stockData] = await Promise.all([
        listProducts(auth.token),
        getWorkshopSheetSummary(auth.token),
        listWorkshopSheetReceipts(auth.token, { dateFrom: inventoryDateRange.dateFrom, dateTo: inventoryDateRange.dateTo }),
        listWorkshopBatches(auth.token, { dateFrom: inventoryDateRange.dateFrom, dateTo: inventoryDateRange.dateTo }),
        listWorkshopStock(auth.token)
      ]);

      setProducts(productData);
      setWorkshopSheetSummary(summary);
      setWorkshopSheetReceipts(receiptsData.items);
      setWorkshopBatches(batchesData.items);
      setWorkshopStockRows(stockData);

      const firstBoard = productData.find((p) => p.isActive && p.productType === "BOARD") ?? null;
      if (firstBoard) {
        setNewWorkshopBatchForm((prev) => {
          const lines = prev.lines.length ? prev.lines : [{ productId: "", sheetsUsed: "1", actualGood: "", actualDamaged: "0", actualWaste: "0", notes: "" }];
          if (lines[0].productId) {
            return prev;
          }
          const nextLines = [...lines];
          nextLines[0] = { ...nextLines[0], productId: firstBoard.id };
          return { ...prev, lines: nextLines };
        });
        setNewInvTransferForm((prev) => {
          const lines = prev.lines.length ? prev.lines : [{ productId: "", quantity: "1" }];
          if (lines[0].productId) {
            return prev;
          }
          const nextLines = [...lines];
          nextLines[0] = { ...nextLines[0], productId: firstBoard.id };
          return { ...prev, lines: nextLines };
        });
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load workshop data");
    } finally {
      setInventoryBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canViewInventory) {
      return;
    }
    if (activeView !== "inventory") {
      return;
    }
    if (inventorySection === "stock") {
      void refreshInventoryStockData();
      return;
    }
    if (inventorySection === "transfers") {
      void refreshInventoryTransfersData();
      return;
    }
    if (inventorySection === "workshop") {
      void refreshWorkshopData();
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeView,
    auth?.token,
    canViewInventory,
    canViewWorkshop,
    inventorySection,
    inventoryFilters.shopId,
    inventoryFilters.transferStatus,
    inventoryDateRange.dateFrom,
    inventoryDateRange.dateTo
  ]);

  async function refreshMessagingTemplatesData(): Promise<void> {
    if (!auth || !canManageMessaging) {
      return;
    }
    setMessagingBusy(true);
    setError(null);
    try {
      const templates = await listMessagingTemplates(auth.token);
      setMessagingTemplates(templates);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load templates");
    } finally {
      setMessagingBusy(false);
    }
  }

  async function refreshMessagingQueueData(): Promise<void> {
    if (!auth || !canManageMessaging) {
      return;
    }
    setMessagingBusy(true);
    setError(null);
    try {
      const data = await listMessagingQueue(auth.token, {
        status: messagingQueueFilters.status || undefined,
        channel: messagingQueueFilters.channel || undefined,
        dateFrom: messagingQueueFilters.dateFrom || undefined,
        dateTo: messagingQueueFilters.dateTo || undefined
      });
      setMessagingQueue(data.items);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load queue");
    } finally {
      setMessagingBusy(false);
    }
  }

  async function refreshMessagingLogsData(): Promise<void> {
    if (!auth || !canManageMessaging) {
      return;
    }
    setMessagingBusy(true);
    setError(null);
    try {
      const data = await listMessagingLogs(auth.token, {
        queueId: messagingQueueFilters.queueId ? messagingQueueFilters.queueId : undefined,
        dateFrom: messagingQueueFilters.dateFrom || undefined,
        dateTo: messagingQueueFilters.dateTo || undefined
      });
      setMessagingLogs(data.items);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Failed to load logs");
    } finally {
      setMessagingBusy(false);
    }
  }

  useEffect(() => {
    if (!auth || !canManageMessaging) {
      return;
    }
    if (activeView !== "messaging") {
      return;
    }
    if (messagingSection === "templates") {
      void refreshMessagingTemplatesData();
      return;
    }
    if (messagingSection === "queue") {
      void refreshMessagingQueueData();
      return;
    }
    if (messagingSection === "logs") {
      void refreshMessagingLogsData();
      return;
    }
    // jobs: no auto refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeView,
    auth?.token,
    canManageMessaging,
    messagingSection,
    messagingQueueFilters.status,
    messagingQueueFilters.channel,
    messagingQueueFilters.dateFrom,
    messagingQueueFilters.dateTo,
    messagingQueueFilters.queueId
  ]);

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

  function formatUGX(amount: number): string {
    const safe = Number.isFinite(amount) ? Math.trunc(amount) : 0;
    return `UGX ${safe.toLocaleString("en-US")}`;
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
  <td style="text-align:right;">${formatUGX(l.unitPrice)}</td>
  <td style="text-align:right;">${formatUGX(l.lineTotal)}</td>
</tr>`
      )
      .join("");

    const paymentRows = payments
      .map(
        (p) => `<tr>
  <td>${escapeHtml(p.createdAt)}</td>
  <td>${escapeHtml(p.method)}</td>
  <td style="text-align:right;">${formatUGX(p.amount)}</td>
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
          <td class="right"><strong>${formatUGX(invoice.totalAmount)}</strong></td>
        </tr>
        <tr class="totals">
          <td colspan="3" class="right"><strong>Paid</strong></td>
          <td class="right"><strong>${formatUGX(invoice.paidAmount)}</strong></td>
        </tr>
        <tr class="totals">
          <td colspan="3" class="right"><strong>Balance</strong></td>
          <td class="right"><strong>${formatUGX(invoice.balance)}</strong></td>
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

  const reportTitle =
    reportSection === "sales"
      ? "Sales"
      : reportSection === "commissions"
        ? "Commissions"
        : reportSection === "invoices"
          ? "Invoices"
          : reportSection === "payments"
            ? "Payments"
            : reportSection === "cash"
              ? "Cash"
              : reportSection === "expenses"
                ? "Expenses"
                : reportSection === "capital"
                  ? "Capital"
                  : "P&L";

  const topbarTitle = !authUser
    ? "BDK Photography BMS"
    : activeView === "overview"
      ? "Dashboard"
      : activeView === "inventory"
        ? "Projects"
        : activeView === "sales"
          ? "Sales (POS)"
          : activeView === "invoices"
            ? "Invoices"
            : activeView === "customers"
              ? "Customers"
              : activeView === "expenses"
                ? "Expenses"
                : activeView === "cash"
                  ? "Cash"
                  : activeView === "reports"
                    ? `Reports · ${reportTitle}`
                    : activeView === "messaging"
                      ? "Messaging"
                      : "Master Data";

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    if (!q) {
      return invoices;
    }
    return invoices.filter((inv) => {
      const haystack = [
        inv.invoiceNumber,
        inv.shopCode,
        inv.customerFirstName,
        inv.customerLastName,
        inv.customerMobileNumber ?? "",
        inv.status
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [invoices, invoiceSearch]);

  const activeCustomerOptions = useMemo(
    () =>
      customers
        .filter((c) => c.isActive)
        .map((c) => ({
          value: c.id,
          label: `${c.firstName} ${c.lastName} • ${c.mobileNumber}`,
          keywords: `${c.mobileNumber} ${c.firstName} ${c.lastName} ${c.email ?? ""}`
        })),
    [customers]
  );

  return (
    <div className={cx("appShell", !authUser && "appShell--loggedOut")}>
      {authUser ? (
        <>
          {sidebarOpen ? <div className="sidebarOverlay" onClick={() => setSidebarOpen(false)} /> : null}
          <aside className={cx("sidebar", sidebarOpen && "isOpen")}>
            <div className="sidebarBrand" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
              <div className="sidebarBrand">
                <p className="sidebarBrand__title">BDK Photography</p>
                <p className="sidebarBrand__sub">Business Management</p>
              </div>
              <IconButton className="topbar__menu" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
                <IconClose width={18} height={18} />
              </IconButton>
            </div>

            <nav aria-label="Primary">
              <div className="navGroup">
                <div className="navGroup__title">Core</div>
                <button
                  className={cx("navItem", activeView === "overview" && "isActive")}
                  type="button"
                  onClick={() => {
                    setActiveView("overview");
                    setSidebarOpen(false);
                  }}
                >
                  <IconDashboard />
                  Dashboard
                </button>
                <button
                  className={cx("navItem", activeView === "inventory" && "isActive")}
                  type="button"
                  onClick={() => {
                    setActiveView("inventory");
                    setSidebarOpen(false);
                  }}
                >
                  <IconProjects />
                  Projects
                </button>
                {canViewSales ? (
                  <button
                    className={cx("navItem", activeView === "sales" && "isActive")}
                    type="button"
                    onClick={() => {
                      setActiveView("sales");
                      setSidebarOpen(false);
                    }}
                  >
                    <IconSales />
                    Sales (POS)
                  </button>
                ) : null}
                <button
                  className={cx("navItem", activeView === "invoices" && "isActive")}
                  type="button"
                  onClick={() => {
                    setActiveView("invoices");
                    setSidebarOpen(false);
                  }}
                >
                  <IconInvoices />
                  Invoices
                </button>
                <button
                  className={cx("navItem", activeView === "customers" && "isActive")}
                  type="button"
                  onClick={() => {
                    setActiveView("customers");
                    setSidebarOpen(false);
                  }}
                >
                  <IconCustomers />
                  Customers
                </button>
              </div>

              <div className="navGroup">
                <div className="navGroup__title">Finance</div>
                {canViewCash ? (
                  <button
                    className={cx("navItem", activeView === "cash" && "isActive")}
                    type="button"
                    onClick={() => {
                      setActiveView("cash");
                      setSidebarOpen(false);
                    }}
                  >
                    <IconCash />
                    Cash
                  </button>
                ) : null}
                {canViewExpenses ? (
                  <button
                    className={cx("navItem", activeView === "expenses" && "isActive")}
                    type="button"
                    onClick={() => {
                      setActiveView("expenses");
                      setSidebarOpen(false);
                    }}
                  >
                    <IconExpenses />
                    Expenses
                  </button>
                ) : null}
                {canViewReports ? (
                  <>
                    <button
                      className={cx("navItem", activeView === "reports" && reportSection === "sales" && "isActive")}
                      type="button"
                      onClick={() => {
                        setActiveView("reports");
                        setReportSection("sales");
                        setSidebarOpen(false);
                      }}
                    >
                      <IconReports />
                      Reports
                    </button>
                    <button
                      className={cx("navItem", activeView === "reports" && reportSection === "payments" && "isActive")}
                      type="button"
                      onClick={() => {
                        setActiveView("reports");
                        setReportSection("payments");
                        setSidebarOpen(false);
                      }}
                    >
                      <IconPayments />
                      Payments
                    </button>
                    <button
                      className={cx("navItem", activeView === "reports" && reportSection === "commissions" && "isActive")}
                      type="button"
                      onClick={() => {
                        setActiveView("reports");
                        setReportSection("commissions");
                        setSidebarOpen(false);
                      }}
                    >
                      <IconCommissions />
                      Commissions
                    </button>
                  </>
                ) : null}
              </div>

              {canManageMasterData || canManageMessaging ? (
                <div className="navGroup">
                  <div className="navGroup__title">Admin</div>
                  {canManageMasterData ? (
                    <button
                      className={cx("navItem", activeView === "master-data" && "isActive")}
                      type="button"
                      onClick={() => {
                        setActiveView("master-data");
                        setSidebarOpen(false);
                      }}
                    >
                      <IconMasterData />
                      Master Data
                    </button>
                  ) : null}
                  {canManageMessaging ? (
                    <button
                      className={cx("navItem", activeView === "messaging" && "isActive")}
                      type="button"
                      onClick={() => {
                        setActiveView("messaging");
                        setSidebarOpen(false);
                      }}
                    >
                      <IconMessaging />
                      Messaging
                    </button>
                  ) : null}
                </div>
              ) : null}
            </nav>

            <div className="sidebarFooter">
              <div className="sidebarUser">
                <div className="sidebarUser__name">{authUser.fullName}</div>
                <div className="sidebarUser__meta">
                  {authUser.role} • {authUser.mobileNumber}
                </div>
              </div>
              <Button
                variant="ghost"
                icon={<IconLogout width={18} height={18} />}
                onClick={() => clearSession("Logged out.")}
              >
                Logout
              </Button>
            </div>
          </aside>
        </>
      ) : null}

      <div className="appMain">
        <header className="topbar">
          {authUser ? (
            <IconButton className="topbar__menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <IconMenu width={20} height={20} />
            </IconButton>
          ) : null}
          <h1 className="topbar__title">{topbarTitle}</h1>
          <div className="topbar__spacer" />
          {!authUser ? null : (
            <Button variant="secondary" size="sm" icon={<IconLogout width={18} height={18} />} onClick={() => clearSession("Logged out.")}>
              Logout
            </Button>
          )}
        </header>

        <main className="content">
          <div className="container">
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
                <li>Phase 6: Cash tracking (cash at hand, transfers, banking approvals, notifications)</li>
                <li>Phase 7: Reports + exports (CSV / Excel / PDF)</li>
                <li>Phase 8: Workshop + inventory lifecycle (boards, transfers, damages)</li>
                <li>Phase 9: Messaging scaffolding (templates, queue, logs, jobs)</li>
                <li>Business capital report (cash + bank + inventory valuation)</li>
              </ul>
              <div className="note">
                Next: messaging provider integration (SMS/WhatsApp/Email) + audit log viewer UI.
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
                <li>Messaging provider integration (SMS / WhatsApp / Email) + retries/cron</li>
                <li>Audit log viewer UI</li>
                <li>Inventory movement reports + exports</li>
                <li>Workshop yield + waste reports + exports</li>
                <li>Capital dashboard trend (historical snapshots)</li>
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
              <div className="meta" style={{ gridTemplateColumns: "1fr auto", alignItems: "start" }}>
                <div>
                  <h2 style={{ marginBottom: 0 }}>Invoices</h2>
                  <p className="hint">Create invoices, print them, and record installment payments (cash/mobile money/card).</p>
                </div>
                <div className="approvalActions">
                  {canManageInvoices ? (
                    <Button
                      icon={<IconInvoices width={18} height={18} />}
                      onClick={() => {
                        const firstCustomerId = activeCustomerOptions[0]?.value ?? "";
                        if (firstCustomerId) {
                          setNewInvoiceForm((prev) => (prev.customerId ? prev : { ...prev, customerId: firstCustomerId }));
                        }
                        setInvoiceCreateOpen(true);
                      }}
                    >
                      New invoice
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            {!canManageInvoices ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="note">You don’t have permission to create invoices.</div>
              </section>
            ) : null}

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Invoice List</h2>
              {invoicesBusy ? <p className="hint">Loading...</p> : null}
              <div style={{ maxWidth: 520, marginTop: "0.75rem" }}>
                <TextField
                  label="Search"
                  value={invoiceSearch}
                  onChange={(event) => setInvoiceSearch(event.target.value)}
                  placeholder="Invoice #, customer, phone, status..."
                />
              </div>

              <div className="divider" />

              <Table>
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
                  {filteredInvoices.length ? (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className={selectedInvoice?.invoice.id === inv.id ? "isSelected" : ""}>
                        <td>{inv.invoiceNumber}</td>
                        <td>{inv.shopCode}</td>
                        <td>
                          {inv.customerFirstName} {inv.customerLastName}
                        </td>
                        <td>{inv.status}</td>
                        <td>{formatUGX(inv.totalAmount)}</td>
                        <td>{formatUGX(inv.balance)}</td>
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
                      <td colSpan={7}>{invoiceSearch.trim() ? "No invoices match your search." : "No invoices yet."}</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </section>

            {selectedInvoice ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <div className="meta" style={{ alignItems: "flex-start" }}>
                  <div>
                    <p className="hint" style={{ marginBottom: 0 }}>
                      {selectedInvoice.invoice.shopCode} • {selectedInvoice.invoice.shopName}
                    </p>
                    <h2 style={{ marginTop: "0.2rem" }}>{selectedInvoice.invoice.invoiceNumber}</h2>
                    <div className="hint">
                      Customer: {selectedInvoice.invoice.customerFirstName} {selectedInvoice.invoice.customerLastName} •{" "}
                      {selectedInvoice.invoice.customerMobileNumber}
                    </div>
                  </div>
                  <div className="approvalActions">
                    <Button
                      variant="ghost"
                      onClick={() => openInvoicePrint(selectedInvoice, selectedInvoicePayments)}
                    >
                      Print
                    </Button>
                    {canManageInvoices && selectedInvoice.invoice.status === "DRAFT" ? (
                      <Button
                        variant="secondary"
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
                      </Button>
                    ) : null}
                    {canVoidInvoices && selectedInvoice.invoice.status !== "VOID" ? (
                      <Button
                        variant="danger"
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
                      </Button>
                    ) : null}
                    {canManageInvoices && selectedInvoice.invoice.status !== "VOID" && selectedInvoice.invoice.balance > 0 ? (
                      <Button
                        onClick={() => {
                          setInvoicePaymentOpen(true);
                        }}
                      >
                        Record payment
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="divider" />

                <Table>
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
                        <td>{formatUGX(l.unitPrice)}</td>
                        <td>{formatUGX(l.lineTotal)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={3}>
                        <strong>Total</strong>
                      </td>
                      <td>
                        <strong>{formatUGX(selectedInvoice.invoice.totalAmount)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <strong>Paid</strong>
                      </td>
                      <td>
                        <strong>{formatUGX(selectedInvoice.invoice.paidAmount)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3}>
                        <strong>Balance</strong>
                      </td>
                      <td>
                        <strong>{formatUGX(selectedInvoice.invoice.balance)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </Table>

                <div className="divider" />

                <h3 style={{ marginTop: 0 }}>Payments</h3>
                <Table>
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
                          <td>{formatUGX(p.amount)}</td>
                          <td>{p.notes ?? "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>No payments yet.</td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </section>
            ) : null}
          </>
        ) : activeView === "inventory" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Projects</h2>
              <p className="hint">Boards lifecycle: workshop output, transfers (Draft → Shipped → Received), and shop stock.</p>

              <div className="tabs" style={{ marginTop: "0.85rem" }}>
                <button
                  className={`tab ${inventorySection === "stock" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setInventorySection("stock")}
                >
                  Stock
                </button>
                <button
                  className={`tab ${inventorySection === "transfers" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setInventorySection("transfers")}
                >
                  Transfers
                </button>
                {canViewWorkshop ? (
                  <button
                    className={`tab ${inventorySection === "workshop" ? "isActive" : ""}`}
                    type="button"
                    onClick={() => setInventorySection("workshop")}
                  >
                    Workshop
                  </button>
                ) : null}
              </div>
            </section>

            {inventorySection === "stock" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Stock Filters</h2>
                  <form
                    className="form form--three"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshInventoryStockData();
                    }}
                  >
                    <label>
                      Shop
                      <select
                        value={inventoryFilters.shopId}
                        onChange={(event) => {
                          const shopId = event.target.value;
                          setInventoryFilters((prev) => ({ ...prev, shopId }));
                          setNewStockReceiptForm((prev) => ({ ...prev, shopId }));
                          setNewDamageForm((prev) => ({ ...prev, shopId }));
                        }}
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
                      Damages from
                      <input
                        type="date"
                        value={inventoryDateRange.dateFrom}
                        onChange={(event) => setInventoryDateRange((prev) => ({ ...prev, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Damages to
                      <input
                        type="date"
                        value={inventoryDateRange.dateTo}
                        onChange={(event) => setInventoryDateRange((prev) => ({ ...prev, dateTo: event.target.value }))}
                      />
                    </label>
                    <button type="submit" disabled={inventoryBusy}>
                      {inventoryBusy ? "Loading..." : "Refresh"}
                    </button>
                  </form>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Stock On Hand</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Shop</th>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shopStockRows.length ? (
                          shopStockRows.map((row) => (
                            <tr key={`${row.shopId}-${row.productId}`}>
                              <td>
                                {row.shopCode} — {row.shopName}
                              </td>
                              <td>{row.skuCode}</td>
                              <td>{row.productName}</td>
                              <td>{row.productType}</td>
                              <td>{row.quantity}</td>
                              <td>{row.updatedAt}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>No stock records.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {canReceiveStock ? (
                  <section className="card">
                    <h2>Receive Stock (Non-Boards)</h2>
                    <p className="hint">Use this for purchased items. Boards should arrive via Transfers.</p>

                    {products.some((p) => p.isActive && p.productType === "NON_BOARD") ? (
                      <form
                        className="form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!auth) {
                            return;
                          }
                          setError(null);
                          setSuccess(null);
                          setInventoryBusy(true);
                          try {
                            const qty = Number(newStockReceiptForm.quantity);
                            if (!Number.isFinite(qty) || qty <= 0) {
                              throw new Error("Quantity must be greater than 0");
                            }

                            const picked = products.find((p) => p.id === newStockReceiptForm.productId) ?? null;
                            if (!picked || picked.productType !== "NON_BOARD") {
                              throw new Error("Please choose a non-board product");
                            }

                            await createStockReceipt(auth.token, {
                              shopId: newStockReceiptForm.shopId || inventoryFilters.shopId,
                              productId: newStockReceiptForm.productId,
                              receiptDate: newStockReceiptForm.receiptDate ? newStockReceiptForm.receiptDate : undefined,
                              quantity: qty,
                              notes: newStockReceiptForm.notes ? newStockReceiptForm.notes : null
                            });

                            setNewStockReceiptForm((prev) => ({ ...prev, quantity: "", notes: "" }));
                            setSuccess("Stock received.");
                            await refreshInventoryStockData();
                          } catch (caught: unknown) {
                            setError(caught instanceof Error ? caught.message : "Failed to receive stock");
                          } finally {
                            setInventoryBusy(false);
                          }
                        }}
                      >
                        <label>
                          Shop
                          <select
                            value={newStockReceiptForm.shopId || inventoryFilters.shopId}
                            onChange={(event) => setNewStockReceiptForm((prev) => ({ ...prev, shopId: event.target.value }))}
                          >
                            {shops.map((shop) => (
                              <option key={shop.id} value={shop.id}>
                                {shop.code} — {shop.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Product
                          <select
                            value={newStockReceiptForm.productId}
                            onChange={(event) => setNewStockReceiptForm((prev) => ({ ...prev, productId: event.target.value }))}
                            required
                          >
                            {products
                              .filter((p) => p.isActive && p.productType === "NON_BOARD")
                              .map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.skuCode} — {product.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          Quantity
                          <input
                            type="number"
                            min={1}
                            value={newStockReceiptForm.quantity}
                            onChange={(event) => setNewStockReceiptForm((prev) => ({ ...prev, quantity: event.target.value }))}
                            required
                          />
                        </label>
                        <label>
                          Date
                          <input
                            type="date"
                            value={newStockReceiptForm.receiptDate}
                            onChange={(event) => setNewStockReceiptForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
                          />
                        </label>
                        <label>
                          Notes (optional)
                          <input
                            value={newStockReceiptForm.notes}
                            onChange={(event) => setNewStockReceiptForm((prev) => ({ ...prev, notes: event.target.value }))}
                          />
                        </label>
                        <button type="submit" disabled={inventoryBusy}>
                          {inventoryBusy ? "Saving..." : "Receive"}
                        </button>
                      </form>
                    ) : (
                      <div className="note">No active non-board products found. Create products in Master Data first.</div>
                    )}
                  </section>
                ) : (
                  <section className="card">
                    <h2>Receive Stock</h2>
                    <div className="note">You don’t have permission to receive stock.</div>
                  </section>
                )}

                {canRecordDamages ? (
                  <section className="card">
                    <h2>Record Damage</h2>
                    <form
                      className="form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!auth) {
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setInventoryBusy(true);
                        try {
                          const qty = Number(newDamageForm.quantity);
                          if (!Number.isFinite(qty) || qty <= 0) {
                            throw new Error("Quantity must be greater than 0");
                          }

                          await createDamageEvent(auth.token, {
                            shopId: newDamageForm.shopId ? newDamageForm.shopId : undefined,
                            productId: newDamageForm.productId,
                            damageDate: newDamageForm.damageDate ? newDamageForm.damageDate : undefined,
                            quantity: qty,
                            reason: newDamageForm.reason ? newDamageForm.reason : null,
                            notes: newDamageForm.notes ? newDamageForm.notes : null
                          });

                          setNewDamageForm((prev) => ({ ...prev, quantity: "", reason: "", notes: "" }));
                          setSuccess("Damage recorded.");
                          await refreshInventoryStockData();
                        } catch (caught: unknown) {
                          setError(caught instanceof Error ? caught.message : "Failed to record damage");
                        } finally {
                          setInventoryBusy(false);
                        }
                      }}
                    >
                      <label>
                        Shop
                        <select
                          value={newDamageForm.shopId || inventoryFilters.shopId}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, shopId: event.target.value }))}
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
                        Product
                        <select
                          value={newDamageForm.productId}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, productId: event.target.value }))}
                          required
                        >
                          {products
                            .filter((p) => p.isActive)
                            .map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.skuCode} — {product.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          min={1}
                          value={newDamageForm.quantity}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, quantity: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Date
                        <input
                          type="date"
                          value={newDamageForm.damageDate}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, damageDate: event.target.value }))}
                        />
                      </label>
                      <label>
                        Reason (optional)
                        <input
                          value={newDamageForm.reason}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, reason: event.target.value }))}
                        />
                      </label>
                      <label>
                        Notes (optional)
                        <input
                          value={newDamageForm.notes}
                          onChange={(event) => setNewDamageForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                      </label>
                      <button type="submit" disabled={inventoryBusy}>
                        {inventoryBusy ? "Saving..." : "Record Damage"}
                      </button>
                    </form>
                  </section>
                ) : (
                  <section className="card">
                    <h2>Record Damage</h2>
                    <div className="note">You don’t have permission to record damages.</div>
                  </section>
                )}

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Damage Events</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Shop</th>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Reason</th>
                          <th>Notes</th>
                          <th>Recorded by</th>
                        </tr>
                      </thead>
                      <tbody>
                        {damageEvents.length ? (
                          damageEvents.map((d) => (
                            <tr key={d.id}>
                              <td>{d.damageDate}</td>
                              <td>
                                {d.shopCode} — {d.shopName}
                              </td>
                              <td>{d.skuCode}</td>
                              <td>{d.productName}</td>
                              <td>{d.quantity}</td>
                              <td>{d.reason ?? "-"}</td>
                              <td>{d.notes ?? "-"}</td>
                              <td>{d.recordedByFullName ?? d.recordedByUserId ?? "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8}>No damage events for this range.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : inventorySection === "transfers" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Transfer Filters</h2>
                  <form
                    className="form form--three"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshInventoryTransfersData();
                    }}
                  >
                    <label>
                      Shop
                      <select
                        value={inventoryFilters.shopId}
                        onChange={(event) => {
                          const shopId = event.target.value;
                          setInventoryFilters((prev) => ({ ...prev, shopId }));
                          setNewInvTransferForm((prev) => ({ ...prev, toShopId: shopId }));
                        }}
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
                      Status
                      <select
                        value={inventoryFilters.transferStatus}
                        onChange={(event) =>
                          setInventoryFilters((prev) => ({
                            ...prev,
                            transferStatus:
                              event.target.value === "DRAFT"
                                ? "DRAFT"
                                : event.target.value === "SHIPPED"
                                  ? "SHIPPED"
                                  : event.target.value === "RECEIVED"
                                    ? "RECEIVED"
                                    : ""
                          }))
                        }
                      >
                        <option value="">All</option>
                        <option value="DRAFT">Draft</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="RECEIVED">Received</option>
                      </select>
                    </label>
                    <button type="submit" disabled={inventoryBusy}>
                      {inventoryBusy ? "Loading..." : "Refresh"}
                    </button>
                  </form>
                </section>

                {canManageInventoryTransfers ? (
                  <section className="card">
                    <h2>Create Transfer (Workshop → Shop)</h2>
                    <p className="hint">Boards only. Create in Draft, then Ship, then Receive at the shop.</p>

                    {products.some((p) => p.isActive && p.productType === "BOARD") ? (
                      <form
                        className="form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!auth) {
                            return;
                          }
                          setError(null);
                          setSuccess(null);
                          setInventoryBusy(true);
                          try {
                            const lines = newInvTransferForm.lines
                              .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }))
                              .filter((l) => l.productId && Number.isFinite(l.quantity) && l.quantity > 0);

                            if (!newInvTransferForm.toShopId) {
                              throw new Error("Please select a shop");
                            }
                            if (!lines.length) {
                              throw new Error("Add at least one line item");
                            }

                            await createInventoryTransfer(auth.token, {
                              toShopId: newInvTransferForm.toShopId,
                              notes: newInvTransferForm.notes ? newInvTransferForm.notes : null,
                              lines
                            });

                            const firstBoard = products.find((p) => p.isActive && p.productType === "BOARD") ?? null;
                            setNewInvTransferForm((prev) => ({
                              ...prev,
                              notes: "",
                              lines: [{ productId: firstBoard?.id ?? "", quantity: "1" }]
                            }));
                            setSuccess("Transfer created.");
                            await refreshInventoryTransfersData();
                          } catch (caught: unknown) {
                            setError(caught instanceof Error ? caught.message : "Failed to create transfer");
                          } finally {
                            setInventoryBusy(false);
                          }
                        }}
                      >
                        <label>
                          To shop
                          <select
                            value={newInvTransferForm.toShopId}
                            onChange={(event) => setNewInvTransferForm((prev) => ({ ...prev, toShopId: event.target.value }))}
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
                          Notes (optional)
                          <input
                            value={newInvTransferForm.notes}
                            onChange={(event) => setNewInvTransferForm((prev) => ({ ...prev, notes: event.target.value }))}
                          />
                        </label>

                        <div className="divider" />
                        <p className="subhead">Lines</p>

                        {newInvTransferForm.lines.map((line, idx) => (
                          <div key={idx} className="lineRow">
                            <select
                              value={line.productId}
                              onChange={(event) => {
                                const value = event.target.value;
                                setNewInvTransferForm((prev) => {
                                  const nextLines = [...prev.lines];
                                  nextLines[idx] = { ...nextLines[idx], productId: value };
                                  return { ...prev, lines: nextLines };
                                });
                              }}
                              required
                            >
                              {products
                                .filter((p) => p.isActive && p.productType === "BOARD")
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.skuCode} — {p.name}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(event) => {
                                const value = event.target.value;
                                setNewInvTransferForm((prev) => {
                                  const nextLines = [...prev.lines];
                                  nextLines[idx] = { ...nextLines[idx], quantity: value };
                                  return { ...prev, lines: nextLines };
                                });
                              }}
                              required
                            />
                            <button
                              data-variant="ghost"
                              type="button"
                              onClick={() => {
                                setNewInvTransferForm((prev) => {
                                  if (prev.lines.length <= 1) {
                                    return prev;
                                  }
                                  const nextLines = prev.lines.filter((_, i) => i !== idx);
                                  return { ...prev, lines: nextLines };
                                });
                              }}
                              disabled={newInvTransferForm.lines.length <= 1}
                              title="Remove line"
                            >
                              Remove
                            </button>
                          </div>
                        ))}

                        <div className="approvalActions" style={{ marginTop: "0.8rem" }}>
                          <button
                            data-variant="ghost"
                            type="button"
                            onClick={() => {
                              const firstBoard = products.find((p) => p.isActive && p.productType === "BOARD") ?? null;
                              setNewInvTransferForm((prev) => ({
                                ...prev,
                                lines: [...prev.lines, { productId: firstBoard?.id ?? "", quantity: "1" }]
                              }));
                            }}
                          >
                            + Add line
                          </button>
                          <button type="submit" disabled={inventoryBusy}>
                            {inventoryBusy ? "Saving..." : "Create Transfer"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="note">No active board products found. Create board products in Master Data first.</div>
                    )}
                  </section>
                ) : (
                  <section className="card">
                    <h2>Create Transfer</h2>
                    <div className="note">You don’t have permission to create transfers.</div>
                  </section>
                )}

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Transfers</h2>
                  {inventoryTransfers.length ? (
                    inventoryTransfers.map((t, idx) => (
                      <div key={t.id} style={{ marginTop: idx === 0 ? 0 : "1.2rem" }}>
                        <div className="note" style={{ marginBottom: "0.75rem" }}>
                          <div>
                            <strong>
                              {t.toShopCode} — {t.toShopName}
                            </strong>
                          </div>
                          <div className="hint">
                            Status: {t.status} • Created: {t.createdAt ?? "-"} • Shipped: {t.shippedAt ?? "-"} • Received: {t.receivedAt ?? "-"}
                          </div>
                          {t.notes ? <div className="hint">Notes: {t.notes}</div> : null}
                        </div>

                        <div className="tableWrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Shipped</th>
                                <th>Damaged</th>
                                <th>Good received</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.lines.map((line) => {
                                const draftDamagedRaw = transferReceiveDrafts[t.id]?.[line.id];
                                const draftDamaged = draftDamagedRaw ? Number(draftDamagedRaw) : line.quantityDamaged ?? 0;
                                const safeDamaged = Number.isFinite(draftDamaged) ? draftDamaged : 0;
                                const good = Math.max(0, (line.quantityShipped ?? 0) - safeDamaged);
                                return (
                                  <tr key={line.id}>
                                    <td>
                                      {line.skuCode} — {line.productName}
                                    </td>
                                    <td>{line.quantityShipped}</td>
                                    <td>
                                      {t.status === "SHIPPED" && canReceiveInventoryTransfers ? (
                                        <input
                                          type="number"
                                          min={0}
                                          max={line.quantityShipped}
                                          value={draftDamagedRaw ?? String(line.quantityDamaged ?? 0)}
                                          onChange={(event) => {
                                            const value = event.target.value;
                                            setTransferReceiveDrafts((prev) => ({
                                              ...prev,
                                              [t.id]: { ...(prev[t.id] ?? {}), [line.id]: value }
                                            }));
                                          }}
                                        />
                                      ) : (
                                        line.quantityDamaged
                                      )}
                                    </td>
                                    <td>{t.status === "RECEIVED" ? line.quantityReceivedGood : good}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="approvalActions" style={{ marginTop: "0.8rem" }}>
                          {t.status === "DRAFT" && canManageInventoryTransfers ? (
                            <button
                              data-variant="ghost"
                              type="button"
                              disabled={inventoryBusy}
                              onClick={async () => {
                                if (!auth) {
                                  return;
                                }
                                const ok = window.confirm("Ship this transfer? This will deduct stock from the workshop.");
                                if (!ok) {
                                  return;
                                }
                                setError(null);
                                setSuccess(null);
                                setInventoryBusy(true);
                                try {
                                  await shipInventoryTransfer(auth.token, t.id);
                                  setSuccess("Transfer shipped.");
                                  await refreshInventoryTransfersData();
                                } catch (caught: unknown) {
                                  setError(caught instanceof Error ? caught.message : "Failed to ship transfer");
                                } finally {
                                  setInventoryBusy(false);
                                }
                              }}
                            >
                              Ship
                            </button>
                          ) : null}

                          {t.status === "SHIPPED" && canReceiveInventoryTransfers ? (
                            <>
                              <input
                                placeholder="Receive notes (optional)"
                                value={transferReceiveNotesDrafts[t.id] ?? ""}
                                onChange={(event) =>
                                  setTransferReceiveNotesDrafts((prev) => ({ ...prev, [t.id]: event.target.value }))
                                }
                              />
                              <button
                                type="button"
                                disabled={inventoryBusy}
                                onClick={async () => {
                                  if (!auth) {
                                    return;
                                  }
                                  setError(null);
                                  setSuccess(null);
                                  setInventoryBusy(true);
                                  try {
                                    const lineDrafts = transferReceiveDrafts[t.id] ?? {};
                                    const lines = t.lines.map((line) => {
                                      const raw = lineDrafts[line.id];
                                      const parsed = raw === undefined || raw === "" ? 0 : Number(raw);
                                      const safe = Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, line.quantityShipped)) : 0;
                                      return { lineId: line.id, quantityDamaged: safe };
                                    });

                                    await receiveInventoryTransfer(auth.token, t.id, {
                                      receiveNotes: transferReceiveNotesDrafts[t.id] ? transferReceiveNotesDrafts[t.id] : null,
                                      lines
                                    });

                                    setTransferReceiveDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[t.id];
                                      return next;
                                    });
                                    setTransferReceiveNotesDrafts((prev) => {
                                      const next = { ...prev };
                                      delete next[t.id];
                                      return next;
                                    });
                                    setSuccess("Transfer received.");
                                    await Promise.all([refreshInventoryTransfersData(), refreshInventoryStockData()]);
                                  } catch (caught: unknown) {
                                    setError(caught instanceof Error ? caught.message : "Failed to receive transfer");
                                  } finally {
                                    setInventoryBusy(false);
                                  }
                                }}
                              >
                                Receive
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="note">No transfers found.</div>
                  )}
                </section>
              </>
            ) : inventorySection === "workshop" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Workshop Filters</h2>
                  <form
                    className="form form--three"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshWorkshopData();
                    }}
                  >
                    <label>
                      Date from
                      <input
                        type="date"
                        value={inventoryDateRange.dateFrom}
                        onChange={(event) => setInventoryDateRange((prev) => ({ ...prev, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Date to
                      <input
                        type="date"
                        value={inventoryDateRange.dateTo}
                        onChange={(event) => setInventoryDateRange((prev) => ({ ...prev, dateTo: event.target.value }))}
                      />
                    </label>
                    <button type="submit" disabled={inventoryBusy}>
                      {inventoryBusy ? "Loading..." : "Refresh"}
                    </button>
                  </form>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Full Sheets Summary</h2>
                  {workshopSheetSummary ? (
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Available</th>
                            <th>Total received</th>
                            <th>Total used</th>
                            <th>Updated</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>{workshopSheetSummary.availableSheets}</td>
                            <td>{workshopSheetSummary.totalReceivedSheets}</td>
                            <td>{workshopSheetSummary.totalUsedSheets}</td>
                            <td>{workshopSheetSummary.updatedAt ?? "-"}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="note">No workshop summary loaded.</div>
                  )}
                </section>

                {canManageWorkshop ? (
                  <section className="card">
                    <h2>Receive Full Sheets</h2>
                    <form
                      className="form"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        if (!auth) {
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setInventoryBusy(true);
                        try {
                          const qtySheets = Number(newSheetReceiptForm.quantitySheets);
                          if (!Number.isFinite(qtySheets) || qtySheets <= 0) {
                            throw new Error("Quantity must be greater than 0");
                          }
                          const cost = newSheetReceiptForm.costPerSheet ? Number(newSheetReceiptForm.costPerSheet) : null;
                          if (newSheetReceiptForm.costPerSheet && (!Number.isFinite(cost) || (cost ?? 0) < 0)) {
                            throw new Error("Cost per sheet must be 0 or greater");
                          }

                          await createWorkshopSheetReceipt(auth.token, {
                            receiptDate: newSheetReceiptForm.receiptDate ? newSheetReceiptForm.receiptDate : undefined,
                            quantitySheets: qtySheets,
                            supplier: newSheetReceiptForm.supplier ? newSheetReceiptForm.supplier : null,
                            costPerSheet: cost === null ? null : cost,
                            notes: newSheetReceiptForm.notes ? newSheetReceiptForm.notes : null
                          });

                          setNewSheetReceiptForm({ receiptDate: todayLocalYmd(), quantitySheets: "", supplier: "", costPerSheet: "", notes: "" });
                          setSuccess("Sheet receipt recorded.");
                          await refreshWorkshopData();
                        } catch (caught: unknown) {
                          setError(caught instanceof Error ? caught.message : "Failed to record sheet receipt");
                        } finally {
                          setInventoryBusy(false);
                        }
                      }}
                    >
                      <label>
                        Date
                        <input
                          type="date"
                          value={newSheetReceiptForm.receiptDate}
                          onChange={(event) => setNewSheetReceiptForm((prev) => ({ ...prev, receiptDate: event.target.value }))}
                        />
                      </label>
                      <label>
                        Quantity (sheets)
                        <input
                          type="number"
                          min={1}
                          value={newSheetReceiptForm.quantitySheets}
                          onChange={(event) => setNewSheetReceiptForm((prev) => ({ ...prev, quantitySheets: event.target.value }))}
                          required
                        />
                      </label>
                      <label>
                        Supplier (optional)
                        <input
                          value={newSheetReceiptForm.supplier}
                          onChange={(event) => setNewSheetReceiptForm((prev) => ({ ...prev, supplier: event.target.value }))}
                        />
                      </label>
                      <label>
                        Cost per sheet (optional)
                        <input
                          type="number"
                          min={0}
                          value={newSheetReceiptForm.costPerSheet}
                          onChange={(event) => setNewSheetReceiptForm((prev) => ({ ...prev, costPerSheet: event.target.value }))}
                        />
                      </label>
                      <label>
                        Notes (optional)
                        <input
                          value={newSheetReceiptForm.notes}
                          onChange={(event) => setNewSheetReceiptForm((prev) => ({ ...prev, notes: event.target.value }))}
                        />
                      </label>
                      <button type="submit" disabled={inventoryBusy}>
                        {inventoryBusy ? "Saving..." : "Receive Sheets"}
                      </button>
                    </form>
                  </section>
                ) : (
                  <section className="card">
                    <h2>Receive Full Sheets</h2>
                    <div className="note">You don’t have permission to manage workshop receipts.</div>
                  </section>
                )}

                {canManageWorkshop ? (
                  <section className="card">
                    <h2>Create Production Batch</h2>
                    <p className="hint">Consumes full sheets and adds good output into workshop stock.</p>
                    {products.some((p) => p.isActive && p.productType === "BOARD") ? (
                      <form
                        className="form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          if (!auth) {
                            return;
                          }
                          setError(null);
                          setSuccess(null);
                          setInventoryBusy(true);
                          try {
                            const lines = newWorkshopBatchForm.lines
                              .map((l) => ({
                                productId: l.productId,
                                sheetsUsed: Number(l.sheetsUsed),
                                actualGood: Number(l.actualGood),
                                actualDamaged: Number(l.actualDamaged),
                                actualWaste: Number(l.actualWaste),
                                notes: l.notes ? l.notes : null
                              }))
                              .filter((l) => l.productId);

                            if (!lines.length) {
                              throw new Error("Add at least one batch line");
                            }

                            for (const line of lines) {
                              if (!Number.isFinite(line.sheetsUsed) || line.sheetsUsed <= 0) {
                                throw new Error("Sheets used must be greater than 0");
                              }
                              if (!Number.isFinite(line.actualGood) || line.actualGood < 0) {
                                throw new Error("Actual good must be 0 or greater");
                              }
                              if (!Number.isFinite(line.actualDamaged) || line.actualDamaged < 0) {
                                throw new Error("Actual damaged must be 0 or greater");
                              }
                              if (!Number.isFinite(line.actualWaste) || line.actualWaste < 0) {
                                throw new Error("Actual waste must be 0 or greater");
                              }
                            }

                            await createWorkshopBatch(auth.token, {
                              batchDate: newWorkshopBatchForm.batchDate ? newWorkshopBatchForm.batchDate : undefined,
                              notes: newWorkshopBatchForm.notes ? newWorkshopBatchForm.notes : null,
                              lines
                            });

                            const firstBoard = products.find((p) => p.isActive && p.productType === "BOARD") ?? null;
                            setNewWorkshopBatchForm({
                              batchDate: todayLocalYmd(),
                              notes: "",
                              lines: [{ productId: firstBoard?.id ?? "", sheetsUsed: "1", actualGood: "", actualDamaged: "0", actualWaste: "0", notes: "" }]
                            });
                            setSuccess("Batch created.");
                            await refreshWorkshopData();
                          } catch (caught: unknown) {
                            setError(caught instanceof Error ? caught.message : "Failed to create batch");
                          } finally {
                            setInventoryBusy(false);
                          }
                        }}
                      >
                        <label>
                          Batch date
                          <input
                            type="date"
                            value={newWorkshopBatchForm.batchDate}
                            onChange={(event) => setNewWorkshopBatchForm((prev) => ({ ...prev, batchDate: event.target.value }))}
                          />
                        </label>
                        <label>
                          Notes (optional)
                          <input
                            value={newWorkshopBatchForm.notes}
                            onChange={(event) => setNewWorkshopBatchForm((prev) => ({ ...prev, notes: event.target.value }))}
                          />
                        </label>

                        <div className="divider" />
                        <p className="subhead">Lines</p>

                        {newWorkshopBatchForm.lines.map((line, idx) => {
                          const picked = products.find((p) => p.id === line.productId) ?? null;
                          const sheetsUsed = Number(line.sheetsUsed);
                          const expected = picked?.yieldPerSheet && Number.isFinite(sheetsUsed) ? picked.yieldPerSheet * Math.max(0, sheetsUsed) : null;
                          const actualTotal =
                            (Number(line.actualGood) || 0) + (Number(line.actualDamaged) || 0) + (Number(line.actualWaste) || 0);
                          const variance = expected === null ? null : actualTotal - expected;

                          return (
                            <div key={idx} className="lineRow">
                              <select
                                value={line.productId}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setNewWorkshopBatchForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], productId: value };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                required
                              >
                                {products
                                  .filter((p) => p.isActive && p.productType === "BOARD")
                                  .map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.skuCode} — {p.name} ({p.yieldPerSheet ?? "?"}/sheet)
                                    </option>
                                  ))}
                              </select>
                              <input
                                type="number"
                                min={1}
                                value={line.sheetsUsed}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setNewWorkshopBatchForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], sheetsUsed: value };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                title="Sheets used"
                                required
                              />
                              <input
                                type="number"
                                min={0}
                                value={line.actualGood}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setNewWorkshopBatchForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], actualGood: value };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                title="Actual good"
                                required
                              />
                              <input
                                type="number"
                                min={0}
                                value={line.actualDamaged}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setNewWorkshopBatchForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], actualDamaged: value };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                title="Actual damaged"
                                required
                              />
                              <input
                                type="number"
                                min={0}
                                value={line.actualWaste}
                                onChange={(event) => {
                                  const value = event.target.value;
                                  setNewWorkshopBatchForm((prev) => {
                                    const nextLines = [...prev.lines];
                                    nextLines[idx] = { ...nextLines[idx], actualWaste: value };
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                title="Actual waste"
                                required
                              />
                              <span className="hint" style={{ alignSelf: "center" }}>
                                Expected: {expected ?? "-"} • Var: {variance ?? "-"}
                              </span>
                              <button
                                data-variant="ghost"
                                type="button"
                                onClick={() => {
                                  setNewWorkshopBatchForm((prev) => {
                                    if (prev.lines.length <= 1) {
                                      return prev;
                                    }
                                    const nextLines = prev.lines.filter((_, i) => i !== idx);
                                    return { ...prev, lines: nextLines };
                                  });
                                }}
                                disabled={newWorkshopBatchForm.lines.length <= 1}
                                title="Remove line"
                              >
                                Remove
                              </button>
                            </div>
                          );
                        })}

                        <div className="approvalActions" style={{ marginTop: "0.8rem" }}>
                          <button
                            data-variant="ghost"
                            type="button"
                            onClick={() => {
                              const firstBoard = products.find((p) => p.isActive && p.productType === "BOARD") ?? null;
                              setNewWorkshopBatchForm((prev) => ({
                                ...prev,
                                lines: [
                                  ...prev.lines,
                                  { productId: firstBoard?.id ?? "", sheetsUsed: "1", actualGood: "", actualDamaged: "0", actualWaste: "0", notes: "" }
                                ]
                              }));
                            }}
                          >
                            + Add line
                          </button>
                          <button type="submit" disabled={inventoryBusy}>
                            {inventoryBusy ? "Saving..." : "Create Batch"}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="note">No active board products found. Create board products in Master Data first.</div>
                    )}
                  </section>
                ) : (
                  <section className="card">
                    <h2>Create Production Batch</h2>
                    <div className="note">You don’t have permission to create batches.</div>
                  </section>
                )}

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Workshop Stock</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Qty</th>
                          <th>Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workshopStockRows.length ? (
                          workshopStockRows.map((row) => (
                            <tr key={row.productId}>
                              <td>{row.skuCode}</td>
                              <td>{row.productName}</td>
                              <td>{row.quantity}</td>
                              <td>{row.updatedAt}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No workshop stock yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Sheet Receipts</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Qty</th>
                          <th>Supplier</th>
                          <th>Cost/sheet</th>
                          <th>Notes</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workshopSheetReceipts.length ? (
                          workshopSheetReceipts.map((r) => (
                            <tr key={r.id}>
                              <td>{r.receiptDate}</td>
                              <td>{r.quantitySheets}</td>
                              <td>{r.supplier ?? "-"}</td>
                              <td>{r.costPerSheet ?? "-"}</td>
                              <td>{r.notes ?? "-"}</td>
                              <td>{r.createdByFullName ?? r.createdByUserId ?? "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6}>No sheet receipts in this range.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Batches</h2>
                  {workshopBatches.length ? (
                    workshopBatches.map((b, idx) => (
                      <div key={b.id} style={{ marginTop: idx === 0 ? 0 : "1.2rem" }}>
                        <div className="note" style={{ marginBottom: "0.75rem" }}>
                          <div>
                            <strong>{b.batchDate}</strong>
                          </div>
                          <div className="hint">
                            Sheets used: {b.totalSheetsUsed} • Created: {b.createdAt ?? "-"} • By: {b.createdByFullName ?? b.createdByUserId ?? "-"}
                          </div>
                          {b.notes ? <div className="hint">Notes: {b.notes}</div> : null}
                        </div>

                        <div className="tableWrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Yield/sheet</th>
                                <th>Sheets used</th>
                                <th>Expected</th>
                                <th>Good</th>
                                <th>Damaged</th>
                                <th>Waste</th>
                                <th>Variance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {b.lines.map((l) => (
                                <tr key={l.id}>
                                  <td>
                                    {l.skuCode} — {l.productName}
                                  </td>
                                  <td>{l.yieldPerSheet}</td>
                                  <td>{l.sheetsUsed}</td>
                                  <td>{l.expectedOutput}</td>
                                  <td>{l.actualGood}</td>
                                  <td>{l.actualDamaged}</td>
                                  <td>{l.actualWaste}</td>
                                  <td>{l.variance}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="note">No batches in this range.</div>
                  )}
                </section>
              </>
            ) : (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Projects</h2>
                <div className="note">Select a section above.</div>
              </section>
            )}
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

                  <div className="lineHint">Total: {formatUGX(saleDraftTotal)}</div>

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
                          <div className="lineTotal">Line total: {formatUGX(lineTotal)}</div>
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
                            <td className="right">{formatUGX(sale.totalAmount)}</td>
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
                    {selectedSale.sale.paymentMethod} • {formatUGX(selectedSale.sale.totalAmount)} •{" "}
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
                          <td className="right">{formatUGX(line.unitPrice)}</td>
                          <td className="right">{formatUGX(line.lineTotal)}</td>
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
                          <td className="right">{formatUGX(expense.amountUGX)}</td>
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
        ) : activeView === "cash" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Phase 6: Cash Tracking</h2>
              <p className="hint">
                Cash at hand is derived from cash sales, cash installment payments, salesperson-cash expenses, approved transfers, and approved bankings.
              </p>
              <button type="button" data-variant="ghost" onClick={() => void refreshCashData()} disabled={cashBusy}>
                {cashBusy ? "Refreshing..." : "Refresh"}
              </button>
            </section>

            <section className="card">
              <h2>My Cash</h2>
              {cashSummary ? (
                <>
                  <p className="hint" style={{ marginTop: 0 }}>
                    <strong>Cash at hand:</strong> {formatUGX(cashSummary.cashAtHand)}
                  </p>
                  <ul className="stack">
                    <li>
                      <strong>Cash sales:</strong> {formatUGX(cashSummary.cashSales)}
                    </li>
                    <li>
                      <strong>Cash invoice payments:</strong> {formatUGX(cashSummary.cashInvoicePayments)}
                    </li>
                    <li>
                      <strong>Cash expenses:</strong> {formatUGX(cashSummary.cashExpenses)}
                    </li>
                    <li>
                      <strong>Transfers sent:</strong> {formatUGX(cashSummary.transfersSent)}
                    </li>
                    <li>
                      <strong>Transfers received:</strong> {formatUGX(cashSummary.transfersReceived)}
                    </li>
                    <li>
                      <strong>Banked:</strong> {formatUGX(cashSummary.banked)}
                    </li>
                  </ul>
                  <p className="hint">Computed at {cashSummary.computedAt}</p>
                </>
              ) : (
                <p className="hint">No cash summary loaded yet.</p>
              )}
            </section>

            <section className="card">
              <h2>Transfer Cash</h2>
              <form className="form" onSubmit={submitCashTransfer}>
                {authUser.role === "ADMIN" ? (
                  <label>
                    Shop
                    <select
                      value={newTransferForm.shopId}
                      onChange={(event) => setNewTransferForm((prev) => ({ ...prev, shopId: event.target.value }))}
                      required
                    >
                      <option value="">Select shop...</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  Receiver
                  <select
                    value={newTransferForm.receiverUserId}
                    onChange={(event) => setNewTransferForm((prev) => ({ ...prev, receiverUserId: event.target.value }))}
                    required
                  >
                    <option value="">Select recipient...</option>
                    {cashRecipients.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.fullName} ({r.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Amount (UGX)
                  <input
                    value={newTransferForm.amountUGX}
                    onChange={(event) => setNewTransferForm((prev) => ({ ...prev, amountUGX: event.target.value }))}
                    inputMode="numeric"
                    placeholder="50000"
                    required
                  />
                </label>
                <label>
                  Notes (optional)
                  <input value={newTransferForm.notes} onChange={(event) => setNewTransferForm((prev) => ({ ...prev, notes: event.target.value }))} />
                </label>
                <button type="submit" disabled={cashBusy}>
                  {cashBusy ? "Sending..." : "Send Transfer"}
                </button>
              </form>
              <p className="hint">Transfers do not affect cash until the receiver approves.</p>
            </section>

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Pending Transfer Approvals</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Shop</th>
                      <th>From</th>
                      <th className="right">Amount</th>
                      <th>Notes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashTransfers.filter((t) => t.status === "PENDING" && t.receiverUserId === authUser.id).length ? (
                      cashTransfers
                        .filter((t) => t.status === "PENDING" && t.receiverUserId === authUser.id)
                        .map((transfer) => (
                          <tr key={transfer.id}>
                            <td>{transfer.createdAt.slice(0, 10)}</td>
                            <td>{transfer.shopCode}</td>
                            <td>{transfer.senderFullName}</td>
                            <td className="right">{formatUGX(transfer.amountUGX)}</td>
                            <td>{transfer.requestNotes ?? "-"}</td>
                            <td>
                              <button
                                type="button"
                                data-variant="ghost"
                                onClick={() => void decideTransfer(transfer.id, "APPROVE")}
                                disabled={cashBusy}
                              >
                                Approve
                              </button>{" "}
                              <button
                                type="button"
                                data-variant="ghost"
                                onClick={() => void decideTransfer(transfer.id, "REJECT")}
                                disabled={cashBusy}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={6}>No pending approvals.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {authUser.role === "SALES" ? (
              <section className="card">
                <h2>Bank Cash</h2>
                <form className="form" onSubmit={submitBanking}>
                  <label>
                    Amount (UGX)
                    <input
                      value={newBankingForm.amountUGX}
                      onChange={(event) => setNewBankingForm((prev) => ({ ...prev, amountUGX: event.target.value }))}
                      inputMode="numeric"
                      placeholder="100000"
                      required
                    />
                  </label>
                  <label>
                    Notes (optional)
                    <input value={newBankingForm.notes} onChange={(event) => setNewBankingForm((prev) => ({ ...prev, notes: event.target.value }))} />
                  </label>
                  <button type="submit" disabled={cashBusy}>
                    {cashBusy ? "Submitting..." : "Submit Banking Request"}
                  </button>
                </form>
                <p className="hint">Banking does not reduce cash at hand until admin approval.</p>
              </section>
            ) : null}

            {authUser.role === "ADMIN" ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Pending Banking Approvals</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shop</th>
                        <th>User</th>
                        <th className="right">Amount</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankingRequests.length ? (
                        bankingRequests.map((req) => (
                          <tr key={req.id}>
                            <td>{req.createdAt.slice(0, 10)}</td>
                            <td>{req.shopCode}</td>
                            <td>{req.userFullName}</td>
                            <td className="right">{formatUGX(req.amountUGX)}</td>
                            <td>{req.requestNotes ?? "-"}</td>
                            <td>
                              <button
                                type="button"
                                data-variant="ghost"
                                onClick={() => void decideBanking(req.id, "APPROVE")}
                                disabled={cashBusy}
                              >
                                Approve
                              </button>{" "}
                              <button
                                type="button"
                                data-variant="ghost"
                                onClick={() => void decideBanking(req.id, "REJECT")}
                                disabled={cashBusy}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6}>No pending banking requests.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>{authUser.role === "SALES" ? "My Banking Requests" : "Banking Requests"}</h2>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Shop</th>
                        {authUser.role !== "SALES" ? <th>User</th> : null}
                        <th className="right">Amount</th>
                        <th>Status</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankingRequests.length ? (
                        bankingRequests.map((req) => (
                          <tr key={req.id}>
                            <td>{req.createdAt.slice(0, 10)}</td>
                            <td>{req.shopCode}</td>
                            {authUser.role !== "SALES" ? <td>{req.userFullName}</td> : null}
                            <td className="right">{formatUGX(req.amountUGX)}</td>
                            <td>{req.status}</td>
                            <td>{req.requestNotes ?? "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={authUser.role !== "SALES" ? 6 : 5}>No banking requests found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {authUser.role === "ADMIN" ? (
              <section className="card" style={{ gridColumn: "1 / -1" }}>
                <h2>Admin Cash Overview</h2>
                <form
                  className="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void refreshCashData();
                  }}
                >
                  <label>
                    Shop filter
                    <select
                      value={adminCashFilters.shopId}
                      onChange={(event) => setAdminCashFilters((prev) => ({ ...prev, shopId: event.target.value }))}
                    >
                      <option value="">All shops</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Date from (optional)
                    <input
                      type="date"
                      value={adminCashFilters.dateFrom}
                      onChange={(event) => setAdminCashFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                    />
                  </label>
                  <label>
                    Date to (optional)
                    <input
                      type="date"
                      value={adminCashFilters.dateTo}
                      onChange={(event) => setAdminCashFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                    />
                  </label>
                  <button type="submit" disabled={cashBusy}>
                    {cashBusy ? "Refreshing..." : "Refresh Overview"}
                  </button>
                </form>

                <div className="tableWrap" style={{ marginTop: "1rem" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Shop</th>
                        <th className="right">Cash at hand</th>
                        <th className="right">Banked (range)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminCashOverview?.items?.length ? (
                        adminCashOverview.items.map((item) => (
                          <tr key={item.userId}>
                            <td>{item.fullName}</td>
                            <td>{item.shopCode ?? "-"}</td>
                            <td className="right">{formatUGX(item.cashAtHand)}</td>
                            <td className="right">{formatUGX(item.bankedTotal)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>No sales users found.</td>
                        </tr>
                      )}
                    </tbody>
                    {adminCashOverview?.totals ? (
                      <tfoot>
                        <tr>
                          <th colSpan={2} style={{ textAlign: "right" }}>
                            Totals
                          </th>
                          <th className="right">{formatUGX(adminCashOverview.totals.cashAtHand)}</th>
                          <th className="right">{formatUGX(adminCashOverview.totals.bankedTotal)}</th>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </section>
            ) : null}

            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Notifications</h2>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.length ? (
                      notifications.map((n) => (
                        <tr key={n.id} style={{ opacity: n.isRead ? 0.65 : 1 }}>
                          <td>{n.createdAt.slice(0, 10)}</td>
                          <td>{n.title}</td>
                          <td>{n.message}</td>
                          <td>{n.isRead ? "Read" : "Unread"}</td>
                          <td>
                            {!n.isRead ? (
                              <button type="button" data-variant="ghost" onClick={() => void handleMarkNotificationRead(n.id)} disabled={cashBusy}>
                                Mark read
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>No notifications.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : activeView === "reports" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="meta" style={{ gridTemplateColumns: "1fr auto", alignItems: "start" }}>
                <div>
                  <h2 style={{ marginBottom: 0 }}>Reports</h2>
                  <p className="hint">Finance and operations reporting with exports to CSV, Excel (XLSX), and PDF.</p>
                </div>
                <div className="approvalActions">
                  <Button variant="ghost" onClick={() => void refreshReportsData()} disabled={reportsBusy}>
                    {reportsBusy ? "Refreshing..." : "Refresh"}
                  </Button>
                  <Button variant="secondary" onClick={() => void exportCurrentReport("csv")} disabled={reportsBusy}>
                    CSV
                  </Button>
                  <Button variant="secondary" onClick={() => void exportCurrentReport("xlsx")} disabled={reportsBusy}>
                    Excel
                  </Button>
                  <Button variant="secondary" onClick={() => void exportCurrentReport("pdf")} disabled={reportsBusy}>
                    PDF
                  </Button>
                </div>
              </div>

              <div className="divider" />

              <div className="tabs" style={{ marginTop: "0.9rem" }}>
                <button className={`tab ${reportSection === "sales" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("sales")}>
                  Sales
                </button>
                <button className={`tab ${reportSection === "commissions" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("commissions")}>
                  Commissions
                </button>
                <button className={`tab ${reportSection === "invoices" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("invoices")}>
                  Invoices
                </button>
                <button className={`tab ${reportSection === "payments" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("payments")}>
                  Payments
                </button>
                <button className={`tab ${reportSection === "cash" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("cash")}>
                  Cash
                </button>
                <button className={`tab ${reportSection === "expenses" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("expenses")}>
                  Expenses
                </button>
                <button className={`tab ${reportSection === "pl" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("pl")}>
                  P&amp;L
                </button>
                {canViewCapitalReport ? (
                  <button className={`tab ${reportSection === "capital" ? "isActive" : ""}`} type="button" onClick={() => setReportSection("capital")}>
                    Capital
                  </button>
                ) : null}
              </div>
            </section>

            {reportSection === "sales" ? (
              <>
                <section className="card">
                  <h2>Sales Report</h2>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={salesReportFilters.shopId} onChange={(event) => setSalesReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Period
                      <select
                        value={salesReportFilters.period}
                        onChange={(event) => setSalesReportFilters((prev) => ({ ...prev, period: event.target.value as SalesReportPeriod }))}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </label>
                    <label>
                      Date from
                      <input type="date" value={salesReportFilters.dateFrom} onChange={(event) => setSalesReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </label>
                    <label>
                      Date to
                      <input type="date" value={salesReportFilters.dateTo} onChange={(event) => setSalesReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {salesReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Sales:</strong> {salesReport.totals.saleCount}
                      </li>
                      <li>
                        <strong>Total revenue:</strong> {formatUGX(salesReport.totals.totalAmount)}
                      </li>
                      <li>
                        <strong>Cash:</strong> {formatUGX(salesReport.totals.cashAmount)}
                      </li>
                      <li>
                        <strong>Mobile Money:</strong> {formatUGX(salesReport.totals.mobileMoneyAmount)}
                      </li>
                      <li>
                        <strong>Card:</strong> {formatUGX(salesReport.totals.cardAmount)}
                      </li>
                      <li>
                        <strong>Credit:</strong> {formatUGX(salesReport.totals.creditAmount)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Results</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Start</th>
                          <th>End</th>
                          <th className="right">Sales</th>
                          <th className="right">Total</th>
                          <th className="right">Cash</th>
                          <th className="right">MM</th>
                          <th className="right">Card</th>
                          <th className="right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesReport?.periods?.length ? (
                          salesReport.periods.map((row) => (
                            <tr key={`${row.periodStart}-${row.periodEnd}`}>
                              <td>{row.periodStart}</td>
                              <td>{row.periodEnd}</td>
                              <td className="right">{row.saleCount}</td>
                              <td className="right">{formatUGX(row.totalAmount)}</td>
                              <td className="right">{formatUGX(row.cashAmount)}</td>
                              <td className="right">{formatUGX(row.mobileMoneyAmount)}</td>
                              <td className="right">{formatUGX(row.cardAmount)}</td>
                              <td className="right">{formatUGX(row.creditAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : reportSection === "commissions" ? (
              <>
                <section className="card">
                  <h2>Commissions (Sales Totals)</h2>
                  <p className="hint">Sales grouped by salesperson for the selected date range. Commission rates are not configured in v1.</p>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <SelectField
                      label="Shop"
                      value={commissionsReportFilters.shopId}
                      onChange={(event) => setCommissionsReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}
                    >
                      <option value="">All shops</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      label="Date from"
                      type="date"
                      value={commissionsReportFilters.dateFrom}
                      onChange={(event) => setCommissionsReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                    />
                    <TextField
                      label="Date to"
                      type="date"
                      value={commissionsReportFilters.dateTo}
                      onChange={(event) => setCommissionsReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                    />
                    <Button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </Button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {commissionsReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Sales:</strong> {commissionsReport.totals.saleCount}
                      </li>
                      <li>
                        <strong>Total revenue:</strong> {formatUGX(commissionsReport.totals.totalAmount)}
                      </li>
                      <li>
                        <strong>Cash:</strong> {formatUGX(commissionsReport.totals.cashAmount)}
                      </li>
                      <li>
                        <strong>Mobile Money:</strong> {formatUGX(commissionsReport.totals.mobileMoneyAmount)}
                      </li>
                      <li>
                        <strong>Card:</strong> {formatUGX(commissionsReport.totals.cardAmount)}
                      </li>
                      <li>
                        <strong>Credit:</strong> {formatUGX(commissionsReport.totals.creditAmount)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Results</h2>
                  <Table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Shop</th>
                        <th className="right">Sales</th>
                        <th className="right">Total</th>
                        <th className="right">Cash</th>
                        <th className="right">MM</th>
                        <th className="right">Card</th>
                        <th className="right">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionsReport?.items?.length ? (
                        commissionsReport.items.map((row) => (
                          <tr key={`${row.userId}-${row.shopId}`}>
                            <td>{row.fullName}</td>
                            <td>{row.shopCode}</td>
                            <td className="right">{row.saleCount}</td>
                            <td className="right">{formatUGX(row.totalAmount)}</td>
                            <td className="right">{formatUGX(row.cashAmount)}</td>
                            <td className="right">{formatUGX(row.mobileMoneyAmount)}</td>
                            <td className="right">{formatUGX(row.cardAmount)}</td>
                            <td className="right">{formatUGX(row.creditAmount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>No results.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </section>
              </>
            ) : reportSection === "invoices" ? (
              <>
                <section className="card">
                  <h2>Invoice Report</h2>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={invoiceReportFilters.shopId} onChange={(event) => setInvoiceReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={invoiceReportFilters.status}
                        onChange={(event) => setInvoiceReportFilters((prev) => ({ ...prev, status: event.target.value as InvoiceReportStatus }))}
                      >
                        <option value="ALL">All</option>
                        <option value="PAID">Paid</option>
                        <option value="UNPAID">Unpaid</option>
                        <option value="OVERDUE">Overdue</option>
                      </select>
                    </label>
                    <label>
                      Date from
                      <input type="date" value={invoiceReportFilters.dateFrom} onChange={(event) => setInvoiceReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </label>
                    <label>
                      Date to
                      <input type="date" value={invoiceReportFilters.dateTo} onChange={(event) => setInvoiceReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {invoiceReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Invoices:</strong> {invoiceReport.summary.count}
                      </li>
                      <li>
                        <strong>Total:</strong> {formatUGX(invoiceReport.summary.totalAmount)}
                      </li>
                      <li>
                        <strong>Paid:</strong> {formatUGX(invoiceReport.summary.paidAmount)}
                      </li>
                      <li>
                        <strong>Balance:</strong> {formatUGX(invoiceReport.summary.balance)}
                      </li>
                      <li>
                        <strong>Overdue:</strong> {invoiceReport.summary.overdueCount} ({formatUGX(invoiceReport.summary.overdueBalance)})
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Results</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Shop</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Invoice date</th>
                          <th>Due</th>
                          <th className="right">Total</th>
                          <th className="right">Paid</th>
                          <th className="right">Balance</th>
                          <th>Overdue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceReport?.items?.length ? (
                          invoiceReport.items.map((inv) => (
                            <tr key={inv.id} style={{ opacity: inv.isOverdue ? 1 : 0.95 }}>
                              <td>{inv.invoiceNumber}</td>
                              <td>{inv.shopCode}</td>
                              <td>{inv.customerName}</td>
                              <td>{inv.status}</td>
                              <td>{inv.invoiceDate}</td>
                              <td>{inv.dueDate ?? "-"}</td>
                              <td className="right">{formatUGX(inv.totalAmount)}</td>
                              <td className="right">{formatUGX(inv.paidAmount)}</td>
                              <td className="right">{formatUGX(inv.balance)}</td>
                              <td>{inv.isOverdue ? "YES" : "NO"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : reportSection === "payments" ? (
              <>
                <section className="card">
                  <h2>Payments Report</h2>
                  <p className="hint">Installment payments recorded against invoices.</p>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <SelectField
                      label="Shop"
                      value={paymentsReportFilters.shopId}
                      onChange={(event) => setPaymentsReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}
                    >
                      <option value="">All shops</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      label="Method"
                      value={paymentsReportFilters.method}
                      onChange={(event) =>
                        setPaymentsReportFilters((prev) => ({
                          ...prev,
                          method:
                            event.target.value === "CASH"
                              ? "CASH"
                              : event.target.value === "MOBILE_MONEY"
                                ? "MOBILE_MONEY"
                                : event.target.value === "CARD"
                                  ? "CARD"
                                  : ""
                        }))
                      }
                    >
                      <option value="">All methods</option>
                      <option value="CASH">Cash</option>
                      <option value="MOBILE_MONEY">Mobile Money</option>
                      <option value="CARD">Card</option>
                    </SelectField>
                    <TextField
                      label="Date from"
                      type="date"
                      value={paymentsReportFilters.dateFrom}
                      onChange={(event) => setPaymentsReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                    />
                    <TextField
                      label="Date to"
                      type="date"
                      value={paymentsReportFilters.dateTo}
                      onChange={(event) => setPaymentsReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                    />
                    <Button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </Button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {paymentsReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Payments:</strong> {paymentsReport.summary.count}
                      </li>
                      <li>
                        <strong>Total:</strong> {formatUGX(paymentsReport.summary.totalAmount)}
                      </li>
                      <li>
                        <strong>Cash:</strong> {formatUGX(paymentsReport.summary.cashAmount)}
                      </li>
                      <li>
                        <strong>Mobile Money:</strong> {formatUGX(paymentsReport.summary.mobileMoneyAmount)}
                      </li>
                      <li>
                        <strong>Card:</strong> {formatUGX(paymentsReport.summary.cardAmount)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Results</h2>
                  <Table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice</th>
                        <th>Shop</th>
                        <th>Customer</th>
                        <th>Method</th>
                        <th className="right">Amount</th>
                        <th>Recorded by</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsReport?.items?.length ? (
                        paymentsReport.items.map((p) => (
                          <tr key={p.id}>
                            <td>{p.createdAt}</td>
                            <td>{p.invoiceNumber}</td>
                            <td>{p.shopCode}</td>
                            <td>{p.customerName}</td>
                            <td>{p.method}</td>
                            <td className="right">{formatUGX(p.amount)}</td>
                            <td>{p.createdByFullName ?? "-"}</td>
                            <td>{p.notes ?? "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8}>No results.</td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </section>
              </>
            ) : reportSection === "cash" ? (
              <>
                <section className="card">
                  <h2>Cash Report</h2>
                  <p className="hint">Cash at hand is computed as of the selected date; banked totals respect the date range.</p>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={cashReportFilters.shopId} onChange={(event) => setCashReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      As of
                      <input type="date" value={cashReportFilters.asOf} onChange={(event) => setCashReportFilters((prev) => ({ ...prev, asOf: event.target.value }))} />
                    </label>
                    <label>
                      Date from
                      <input type="date" value={cashReportFilters.dateFrom} onChange={(event) => setCashReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </label>
                    <label>
                      Date to
                      <input type="date" value={cashReportFilters.dateTo} onChange={(event) => setCashReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {cashReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Cash at hand (as of):</strong> {formatUGX(cashReport.totals.cashAtHand)}
                      </li>
                      <li>
                        <strong>Banked (range):</strong> {formatUGX(cashReport.totals.bankedInRange)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Results</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Shop</th>
                          <th className="right">Cash at hand</th>
                          <th className="right">Banked (range)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashReport?.items?.length ? (
                          cashReport.items.map((item) => (
                            <tr key={item.userId}>
                              <td>{item.fullName}</td>
                              <td>{item.shopCode}</td>
                              <td className="right">{formatUGX(item.cashAtHandAsOf)}</td>
                              <td className="right">{formatUGX(item.bankedInRange)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : reportSection === "expenses" ? (
              <>
                <section className="card">
                  <h2>Expense Report</h2>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={expenseReportFilters.shopId} onChange={(event) => setExpenseReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date from
                      <input type="date" value={expenseReportFilters.dateFrom} onChange={(event) => setExpenseReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </label>
                    <label>
                      Date to
                      <input type="date" value={expenseReportFilters.dateTo} onChange={(event) => setExpenseReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {expenseReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Expenses:</strong> {expenseReport.summary.count}
                      </li>
                      <li>
                        <strong>Total:</strong> {formatUGX(expenseReport.summary.totalAmount)}
                      </li>
                      <li>
                        <strong>Salesperson cash:</strong> {formatUGX(expenseReport.summary.salespersonCashAmount)}
                      </li>
                      <li>
                        <strong>Admin/bank:</strong> {formatUGX(expenseReport.summary.adminBankAmount)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>By Category</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th className="right">Count</th>
                          <th className="right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseReport?.byCategory?.length ? (
                          expenseReport.byCategory.map((row) => (
                            <tr key={row.categoryId}>
                              <td>{row.categoryName}</td>
                              <td className="right">{row.expenseCount}</td>
                              <td className="right">{formatUGX(row.totalAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Items</h2>
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
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenseReport?.items?.length ? (
                          expenseReport.items.map((exp) => (
                            <tr key={exp.id}>
                              <td>{exp.expenseDate}</td>
                              <td>{exp.shopCode}</td>
                              <td>{exp.categoryName}</td>
                              <td className="right">{formatUGX(exp.amountUGX)}</td>
                              <td>{exp.paymentSource}</td>
                              <td>{exp.paymentSource === "SALESPERSON_CASH" ? exp.paidByFullName ?? "-" : "-"}</td>
                              <td>{exp.notes ?? "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : reportSection === "capital" ? (
              <>
                <section className="card">
                  <h2>Business Capital</h2>
                  <p className="hint">Business Capital = cash at hand (all users) + cash in bank + inventory value.</p>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={capitalReportFilters.shopId} onChange={(event) => setCapitalReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops (consolidated)</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      As of
                      <input type="date" value={capitalReportFilters.asOf} onChange={(event) => setCapitalReportFilters((prev) => ({ ...prev, asOf: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                  {capitalReport?.sheetCostPerFullSheet != null ? (
                    <p className="hint">Sheet cost (as of): {formatUGX(capitalReport.sheetCostPerFullSheet)} per full sheet.</p>
                  ) : null}
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {capitalReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Business capital:</strong> {formatUGX(capitalReport.totals.businessCapital)}
                      </li>
                      <li>
                        <strong>Cash at hand:</strong> {formatUGX(capitalReport.totals.cashAtHand)}
                      </li>
                      <li>
                        <strong>Cash in bank:</strong> {formatUGX(capitalReport.totals.cashInBank)}
                      </li>
                      <li>
                        <strong>Inventory value:</strong> {formatUGX(capitalReport.totals.inventoryValue)}
                      </li>
                      <li>
                        <strong>Banked (approved):</strong> {formatUGX(capitalReport.bank.bankedApproved)}
                      </li>
                      <li>
                        <strong>Admin/bank expenses:</strong> {formatUGX(capitalReport.bank.adminBankExpenses)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                {capitalReport?.warnings?.length ? (
                  <section className="card" style={{ gridColumn: "1 / -1" }}>
                    <h2>Warnings</h2>
                    <div className="note">
                      <ul className="stack">
                        {capitalReport.warnings.map((w, idx) => (
                          <li key={`${idx}-${w.slice(0, 12)}`}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </section>
                ) : null}

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Inventory Valuation</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Product</th>
                          <th>Type</th>
                          <th className="right">Qty</th>
                          <th className="right">Unit cost</th>
                          <th className="right">Value</th>
                          <th>Cost source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {capitalReport?.inventory?.length ? (
                          capitalReport.inventory.map((row) => (
                            <tr key={row.productId}>
                              <td>{row.skuCode}</td>
                              <td>{row.name}</td>
                              <td>{row.productType}</td>
                              <td className="right">
                                {row.quantity}
                                <div className="hint">
                                  {row.shopQty} shop • {row.workshopQty} workshop • {row.transitQty} transit
                                </div>
                              </td>
                              <td className="right">{row.unitCostUGX != null ? formatUGX(row.unitCostUGX) : "-"}</td>
                              <td className="right">{formatUGX(row.valueUGX)}</td>
                              <td>{row.costSource}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7}>No inventory value rows.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="card">
                  <h2>P&amp;L (v1 simple)</h2>
                  <p className="hint">Revenue (sales) − expenses for the selected date range.</p>
                  <form
                    className="form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshReportsData();
                    }}
                  >
                    <label>
                      Shop
                      <select value={plReportFilters.shopId} onChange={(event) => setPlReportFilters((prev) => ({ ...prev, shopId: event.target.value }))}>
                        <option value="">All shops</option>
                        {shops.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date from
                      <input type="date" value={plReportFilters.dateFrom} onChange={(event) => setPlReportFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </label>
                    <label>
                      Date to
                      <input type="date" value={plReportFilters.dateTo} onChange={(event) => setPlReportFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={reportsBusy}>
                      {reportsBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2>Totals</h2>
                  {plReport ? (
                    <ul className="stack">
                      <li>
                        <strong>Revenue:</strong> {formatUGX(plReport.revenue)} ({plReport.saleCount} sales)
                      </li>
                      <li>
                        <strong>Expenses:</strong> {formatUGX(plReport.expenses)} ({plReport.expenseCount} expenses)
                      </li>
                      <li>
                        <strong>Profit:</strong> {formatUGX(plReport.profit)}
                      </li>
                    </ul>
                  ) : (
                    <p className="hint">Run the report to see totals.</p>
                  )}
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Revenue Breakdown</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Payment method</th>
                          <th className="right">Total (UGX)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plReport?.revenueByPaymentMethod?.length ? (
                          plReport.revenueByPaymentMethod.map((row) => (
                            <tr key={row.paymentMethod}>
                              <td>{row.paymentMethod}</td>
                              <td className="right">{formatUGX(row.totalAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Expense Breakdown</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Payment source</th>
                          <th className="right">Total (UGX)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plReport?.expensesByPaymentSource?.length ? (
                          plReport.expensesByPaymentSource.map((row) => (
                            <tr key={row.paymentSource}>
                              <td>{row.paymentSource}</td>
                              <td className="right">{formatUGX(row.totalAmount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={2}>No results.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        ) : activeView === "messaging" ? (
          <>
            <section className="card" style={{ gridColumn: "1 / -1" }}>
              <h2>Phase 9: Messaging (Scaffolding)</h2>
              <p className="hint">
                Admin-only templates + queue + delivery logs for SMS / WhatsApp / Email. Sending is not integrated yet; queue items can be marked as sent/failed manually.
              </p>

              <div className="tabs" style={{ marginTop: "0.9rem" }}>
                <button
                  className={`tab ${messagingSection === "templates" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMessagingSection("templates")}
                >
                  Templates
                </button>
                <button
                  className={`tab ${messagingSection === "queue" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMessagingSection("queue")}
                >
                  Queue
                </button>
                <button
                  className={`tab ${messagingSection === "logs" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMessagingSection("logs")}
                >
                  Logs
                </button>
                <button
                  className={`tab ${messagingSection === "jobs" ? "isActive" : ""}`}
                  type="button"
                  onClick={() => setMessagingSection("jobs")}
                >
                  Jobs
                </button>
              </div>

              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button
                  type="button"
                  data-variant="ghost"
                  onClick={() => {
                    if (messagingSection === "templates") {
                      void refreshMessagingTemplatesData();
                      return;
                    }
                    if (messagingSection === "queue") {
                      void refreshMessagingQueueData();
                      return;
                    }
                    if (messagingSection === "logs") {
                      void refreshMessagingLogsData();
                      return;
                    }
                  }}
                  disabled={messagingBusy}
                >
                  {messagingBusy ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </section>

            {messagingSection === "templates" ? (
              <>
                <section className="card">
                  <h2>Create Template</h2>
                  <form
                    className="form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setMessagingBusy(true);
                      try {
                        await createMessagingTemplate(auth.token, {
                          templateKey: newMessagingTemplateForm.templateKey,
                          channel: newMessagingTemplateForm.channel,
                          subject: newMessagingTemplateForm.subject ? newMessagingTemplateForm.subject : null,
                          body: newMessagingTemplateForm.body,
                          isActive: newMessagingTemplateForm.isActive,
                          notes: newMessagingTemplateForm.notes ? newMessagingTemplateForm.notes : null
                        });
                        setNewMessagingTemplateForm((prev) => ({ ...prev, subject: "", body: "", notes: "", isActive: true }));
                        setSuccess("Template created.");
                        await refreshMessagingTemplatesData();
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to create template");
                      } finally {
                        setMessagingBusy(false);
                      }
                    }}
                  >
                    <label>
                      Template key
                      <input
                        value={newMessagingTemplateForm.templateKey}
                        onChange={(event) => setNewMessagingTemplateForm((prev) => ({ ...prev, templateKey: event.target.value.toUpperCase() }))}
                        placeholder="OVERDUE_INVOICE_REMINDER"
                        required
                      />
                    </label>
                    <label>
                      Channel
                      <select
                        value={newMessagingTemplateForm.channel}
                        onChange={(event) =>
                          setNewMessagingTemplateForm((prev) => ({
                            ...prev,
                            channel: event.target.value === "SMS" ? "SMS" : event.target.value === "EMAIL" ? "EMAIL" : "WHATSAPP"
                          }))
                        }
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                        <option value="EMAIL">Email</option>
                      </select>
                    </label>
                    <label>
                      Subject (email only, optional)
                      <input
                        value={newMessagingTemplateForm.subject}
                        onChange={(event) => setNewMessagingTemplateForm((prev) => ({ ...prev, subject: event.target.value }))}
                        placeholder="BDK Daily Summary ({{date}})"
                      />
                    </label>
                    <label>
                      Body
                      <textarea
                        value={newMessagingTemplateForm.body}
                        onChange={(event) => setNewMessagingTemplateForm((prev) => ({ ...prev, body: event.target.value }))}
                        rows={6}
                        required
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input
                        value={newMessagingTemplateForm.notes}
                        onChange={(event) => setNewMessagingTemplateForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>
                    <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={newMessagingTemplateForm.isActive}
                        onChange={(event) => setNewMessagingTemplateForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                      />
                      Active
                    </label>
                    <button type="submit" disabled={messagingBusy}>
                      {messagingBusy ? "Saving..." : "Create"}
                    </button>
                  </form>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Templates</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Channel</th>
                          <th>Active</th>
                          <th>Updated</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {messagingTemplates.length ? (
                          messagingTemplates.map((tpl) => (
                            <tr key={tpl.id} className={editingMessagingTemplateId === tpl.id ? "isSelected" : ""}>
                              <td>{tpl.templateKey}</td>
                              <td>{tpl.channel}</td>
                              <td>{tpl.isActive ? "Yes" : "No"}</td>
                              <td>{tpl.updatedAt.slice(0, 19).replace("T", " ")}</td>
                              <td>
                                <div className="approvalActions">
                                  <button
                                    data-variant="ghost"
                                    type="button"
                                    onClick={() => {
                                      setEditingMessagingTemplateId(tpl.id);
                                      setEditingMessagingTemplateForm({
                                        subject: tpl.subject ?? "",
                                        body: tpl.body,
                                        notes: tpl.notes ?? "",
                                        isActive: tpl.isActive
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
                                      setMessagingBusy(true);
                                      try {
                                        await updateMessagingTemplate(auth.token, tpl.id, { isActive: !tpl.isActive });
                                        setSuccess("Template updated.");
                                        await refreshMessagingTemplatesData();
                                      } catch (caught: unknown) {
                                        setError(caught instanceof Error ? caught.message : "Failed to update template");
                                      } finally {
                                        setMessagingBusy(false);
                                      }
                                    }}
                                  >
                                    {tpl.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>No templates found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {editingMessagingTemplateId && editingMessagingTemplateForm ? (
                    <div className="approvalRow">
                      <div>
                        <p className="subhead">Edit Template</p>
                        <form
                          className="form"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!auth) {
                              return;
                            }
                            setError(null);
                            setSuccess(null);
                            setMessagingBusy(true);
                            try {
                              await updateMessagingTemplate(auth.token, editingMessagingTemplateId, {
                                subject: editingMessagingTemplateForm.subject ? editingMessagingTemplateForm.subject : null,
                                body: editingMessagingTemplateForm.body,
                                notes: editingMessagingTemplateForm.notes ? editingMessagingTemplateForm.notes : null,
                                isActive: editingMessagingTemplateForm.isActive
                              });
                              setSuccess("Template saved.");
                              setEditingMessagingTemplateId(null);
                              setEditingMessagingTemplateForm(null);
                              await refreshMessagingTemplatesData();
                            } catch (caught: unknown) {
                              setError(caught instanceof Error ? caught.message : "Failed to save template");
                            } finally {
                              setMessagingBusy(false);
                            }
                          }}
                        >
                          <label>
                            Subject (optional)
                            <input
                              value={editingMessagingTemplateForm.subject}
                              onChange={(event) => setEditingMessagingTemplateForm((prev) => (prev ? { ...prev, subject: event.target.value } : prev))}
                            />
                          </label>
                          <label>
                            Body
                            <textarea
                              value={editingMessagingTemplateForm.body}
                              onChange={(event) => setEditingMessagingTemplateForm((prev) => (prev ? { ...prev, body: event.target.value } : prev))}
                              rows={8}
                              required
                            />
                          </label>
                          <label>
                            Notes (optional)
                            <input
                              value={editingMessagingTemplateForm.notes}
                              onChange={(event) => setEditingMessagingTemplateForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
                            />
                          </label>
                          <label style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={editingMessagingTemplateForm.isActive}
                              onChange={(event) =>
                                setEditingMessagingTemplateForm((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))
                              }
                            />
                            Active
                          </label>
                          <div className="approvalActions">
                            <button type="submit" disabled={messagingBusy}>
                              {messagingBusy ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              data-variant="ghost"
                              onClick={() => {
                                setEditingMessagingTemplateId(null);
                                setEditingMessagingTemplateForm(null);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : messagingSection === "queue" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Queue Filters</h2>
                  <form
                    className="form form--three"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshMessagingQueueData();
                    }}
                  >
                    <label>
                      Status
                      <select
                        value={messagingQueueFilters.status}
                        onChange={(event) =>
                          setMessagingQueueFilters((prev) => ({
                            ...prev,
                            status:
                              event.target.value === "QUEUED"
                                ? "QUEUED"
                                : event.target.value === "SENT"
                                  ? "SENT"
                                  : event.target.value === "FAILED"
                                    ? "FAILED"
                                    : event.target.value === "CANCELLED"
                                      ? "CANCELLED"
                                      : ""
                          }))
                        }
                      >
                        <option value="">All</option>
                        <option value="QUEUED">Queued</option>
                        <option value="SENT">Sent</option>
                        <option value="FAILED">Failed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </label>
                    <label>
                      Channel
                      <select
                        value={messagingQueueFilters.channel}
                        onChange={(event) =>
                          setMessagingQueueFilters((prev) => ({
                            ...prev,
                            channel:
                              event.target.value === "SMS" ? "SMS" : event.target.value === "EMAIL" ? "EMAIL" : event.target.value === "WHATSAPP" ? "WHATSAPP" : ""
                          }))
                        }
                      >
                        <option value="">All</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                        <option value="EMAIL">Email</option>
                      </select>
                    </label>
                    <label>
                      Date from
                      <input
                        type="date"
                        value={messagingQueueFilters.dateFrom}
                        onChange={(event) => setMessagingQueueFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Date to
                      <input
                        type="date"
                        value={messagingQueueFilters.dateTo}
                        onChange={(event) => setMessagingQueueFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                      />
                    </label>
                    <button type="submit" disabled={messagingBusy}>
                      {messagingBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Queue Items</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Key</th>
                          <th>Channel</th>
                          <th>To</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {messagingQueue.length ? (
                          messagingQueue.map((item) => (
                            <tr key={item.id} style={{ opacity: item.status === "QUEUED" ? 1 : 0.85 }}>
                              <td>{item.createdAt.slice(0, 10)}</td>
                              <td>{item.templateKey}</td>
                              <td>{item.channel}</td>
                              <td>{item.toAddress}</td>
                              <td>{item.status}</td>
                              <td>
                                {item.status === "QUEUED" ? (
                                  <div className="approvalActions">
                                    <button
                                      type="button"
                                      data-variant="ghost"
                                      disabled={messagingBusy}
                                      onClick={async () => {
                                        if (!auth) {
                                          return;
                                        }
                                        const ok = window.confirm("Mark as SENT?");
                                        if (!ok) {
                                          return;
                                        }
                                        setError(null);
                                        setSuccess(null);
                                        setMessagingBusy(true);
                                        try {
                                          await updateMessagingQueueStatus(auth.token, item.id, { status: "SENT", message: "Marked sent manually" });
                                          setSuccess("Queue item updated.");
                                          await refreshMessagingQueueData();
                                        } catch (caught: unknown) {
                                          setError(caught instanceof Error ? caught.message : "Failed to update queue item");
                                        } finally {
                                          setMessagingBusy(false);
                                        }
                                      }}
                                    >
                                      Sent
                                    </button>
                                    <button
                                      type="button"
                                      data-variant="ghost"
                                      disabled={messagingBusy}
                                      onClick={async () => {
                                        if (!auth) {
                                          return;
                                        }
                                        const reason = window.prompt("Mark FAILED. Optional reason:");
                                        setError(null);
                                        setSuccess(null);
                                        setMessagingBusy(true);
                                        try {
                                          await updateMessagingQueueStatus(auth.token, item.id, {
                                            status: "FAILED",
                                            message: "Marked failed manually",
                                            errorMessage: reason ? reason : "Failed"
                                          });
                                          setSuccess("Queue item updated.");
                                          await refreshMessagingQueueData();
                                        } catch (caught: unknown) {
                                          setError(caught instanceof Error ? caught.message : "Failed to update queue item");
                                        } finally {
                                          setMessagingBusy(false);
                                        }
                                      }}
                                    >
                                      Failed
                                    </button>
                                    <button
                                      type="button"
                                      data-variant="ghost"
                                      disabled={messagingBusy}
                                      onClick={async () => {
                                        if (!auth) {
                                          return;
                                        }
                                        const ok = window.confirm("Cancel this queued item?");
                                        if (!ok) {
                                          return;
                                        }
                                        setError(null);
                                        setSuccess(null);
                                        setMessagingBusy(true);
                                        try {
                                          await updateMessagingQueueStatus(auth.token, item.id, { status: "CANCELLED", message: "Cancelled by admin" });
                                          setSuccess("Queue item cancelled.");
                                          await refreshMessagingQueueData();
                                        } catch (caught: unknown) {
                                          setError(caught instanceof Error ? caught.message : "Failed to cancel queue item");
                                        } finally {
                                          setMessagingBusy(false);
                                        }
                                      }}
                                    >
                                      Cancel
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
                            <td colSpan={6}>No queue items.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {messagingQueue.length ? (
                    <details style={{ marginTop: "0.9rem" }}>
                      <summary className="hint">Show message bodies</summary>
                      <div style={{ display: "grid", gap: "0.85rem", marginTop: "0.85rem" }}>
                        {messagingQueue.slice(0, 12).map((item) => (
                          <div key={`body-${item.id}`} className="note">
                            <div className="hint">
                              {item.templateKey} • {item.channel} • {item.toAddress} • {item.status}
                            </div>
                            {item.renderedSubject ? <div style={{ marginTop: "0.4rem" }}><strong>Subject:</strong> {item.renderedSubject}</div> : null}
                            <pre style={{ whiteSpace: "pre-wrap", marginTop: "0.4rem" }}>{item.renderedBody}</pre>
                            {item.errorMessage ? <div className="hint">Error: {item.errorMessage}</div> : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </section>
              </>
            ) : messagingSection === "logs" ? (
              <>
                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Logs Filters</h2>
                  <form
                    className="form form--three"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void refreshMessagingLogsData();
                    }}
                  >
                    <label>
                      Queue ID (optional)
                      <input
                        value={messagingQueueFilters.queueId}
                        onChange={(event) => setMessagingQueueFilters((prev) => ({ ...prev, queueId: event.target.value }))}
                        placeholder="msgq_..."
                      />
                    </label>
                    <label>
                      Date from
                      <input
                        type="date"
                        value={messagingQueueFilters.dateFrom}
                        onChange={(event) => setMessagingQueueFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
                      />
                    </label>
                    <label>
                      Date to
                      <input
                        type="date"
                        value={messagingQueueFilters.dateTo}
                        onChange={(event) => setMessagingQueueFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
                      />
                    </label>
                    <button type="submit" disabled={messagingBusy}>
                      {messagingBusy ? "Loading..." : "Run"}
                    </button>
                  </form>
                </section>

                <section className="card" style={{ gridColumn: "1 / -1" }}>
                  <h2>Logs</h2>
                  <div className="tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Queue</th>
                          <th>Status</th>
                          <th>Message</th>
                          <th>By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {messagingLogs.length ? (
                          messagingLogs.map((log) => (
                            <tr key={log.id}>
                              <td>{log.createdAt.slice(0, 19).replace("T", " ")}</td>
                              <td>{log.queueId}</td>
                              <td>{log.status}</td>
                              <td>{log.message ?? "-"}</td>
                              <td>{log.createdByFullName ?? log.createdByUserId ?? "-"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5}>No logs.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="card">
                  <h2>Overdue Credit Reminders</h2>
                  <p className="hint">Find overdue invoices (due date passed, balance &gt; 0) and enqueue reminders using templates.</p>
                  <form
                    className="form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setMessagingBusy(true);
                      try {
                        const result = await runOverdueReminders(auth.token, {
                          asOfDate: runOverdueRemindersForm.asOfDate ? runOverdueRemindersForm.asOfDate : undefined,
                          notes: runOverdueRemindersForm.notes ? runOverdueRemindersForm.notes : null
                        });
                        setLastOverdueRunResult(result);
                        setSuccess(`Queued reminders: ${result.createdCount} (skipped: ${result.skippedCount}).`);
                        await refreshMessagingQueueData();
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to run reminders");
                      } finally {
                        setMessagingBusy(false);
                      }
                    }}
                  >
                    <label>
                      As of date
                      <input
                        type="date"
                        value={runOverdueRemindersForm.asOfDate}
                        onChange={(event) => setRunOverdueRemindersForm((prev) => ({ ...prev, asOfDate: event.target.value }))}
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input
                        value={runOverdueRemindersForm.notes}
                        onChange={(event) => setRunOverdueRemindersForm((prev) => ({ ...prev, notes: event.target.value }))}
                      />
                    </label>
                    <button type="submit" disabled={messagingBusy}>
                      {messagingBusy ? "Running..." : "Run reminders"}
                    </button>
                  </form>

                  {lastOverdueRunResult ? (
                    <div className="note" style={{ marginTop: "0.85rem" }}>
                      <div>
                        <strong>As of:</strong> {lastOverdueRunResult.asOfDate}
                      </div>
                      <div>
                        <strong>Created:</strong> {lastOverdueRunResult.createdCount} • <strong>Skipped:</strong> {lastOverdueRunResult.skippedCount}
                      </div>
                      {lastOverdueRunResult.missingTemplates.length ? (
                        <div className="hint">Missing templates: {lastOverdueRunResult.missingTemplates.map((t) => `${t.templateKey}/${t.channel}`).join(", ")}</div>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                <section className="card">
                  <h2>Admin Daily Summary</h2>
                  <p className="hint">Generate a daily rollup and enqueue to WhatsApp (admins) and Email (configured recipients).</p>
                  <form
                    className="form"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!auth) {
                        return;
                      }
                      setError(null);
                      setSuccess(null);
                      setMessagingBusy(true);
                      try {
                        const result = await runAdminDailySummary(auth.token, {
                          date: runDailySummaryForm.date ? runDailySummaryForm.date : undefined,
                          notes: runDailySummaryForm.notes ? runDailySummaryForm.notes : null
                        });
                        setLastDailySummaryResult(result);
                        setSuccess(`Queued daily summaries: ${result.createdCount} (skipped: ${result.skippedCount}).`);
                        await refreshMessagingQueueData();
                      } catch (caught: unknown) {
                        setError(caught instanceof Error ? caught.message : "Failed to run daily summary");
                      } finally {
                        setMessagingBusy(false);
                      }
                    }}
                  >
                    <label>
                      Date
                      <input
                        type="date"
                        value={runDailySummaryForm.date}
                        onChange={(event) => setRunDailySummaryForm((prev) => ({ ...prev, date: event.target.value }))}
                      />
                    </label>
                    <label>
                      Notes (optional)
                      <input value={runDailySummaryForm.notes} onChange={(event) => setRunDailySummaryForm((prev) => ({ ...prev, notes: event.target.value }))} />
                    </label>
                    <button type="submit" disabled={messagingBusy}>
                      {messagingBusy ? "Running..." : "Generate + queue summary"}
                    </button>
                  </form>

                  {lastDailySummaryResult ? (
                    <div className="note" style={{ marginTop: "0.85rem" }}>
                      <div>
                        <strong>Date:</strong> {lastDailySummaryResult.date}
                      </div>
                      <div>
                        <strong>Created:</strong> {lastDailySummaryResult.createdCount} • <strong>Skipped:</strong> {lastDailySummaryResult.skippedCount}
                      </div>
                      {lastDailySummaryResult.emailRecipients.length ? (
                        <div className="hint">Email recipients: {lastDailySummaryResult.emailRecipients.join(", ")}</div>
                      ) : (
                        <div className="hint">Email recipients: none configured (set BDK_ADMIN_DAILY_EMAILS)</div>
                      )}
                      {lastDailySummaryResult.missingTemplates.length ? (
                        <div className="hint">
                          Missing templates: {lastDailySummaryResult.missingTemplates.map((t) => `${t.templateKey}/${t.channel}`).join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              </>
            )}
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
                              <td>{formatUGX(p.sellingPrice)}</td>
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
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Phase 3: invoice creation and payments are the most common actions; keep them in fast modals. */}
      {authUser ? (
        <>
          <Modal
            open={invoiceCreateOpen}
            title="New Invoice"
            onClose={() => setInvoiceCreateOpen(false)}
            size="lg"
            footer={
              <div className="approvalActions" style={{ justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setInvoiceCreateOpen(false)}>
                  Cancel
                </Button>
                <Button form="create-invoice-form" type="submit" disabled={invoicesBusy || !activeCustomerOptions.length}>
                  {invoicesBusy ? "Saving..." : "Create invoice"}
                </Button>
              </div>
            }
          >
            {activeCustomerOptions.length ? (
              <form
                id="create-invoice-form"
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
                    if (!newInvoiceForm.customerId) {
                      throw new Error("Select a customer");
                    }
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
                    setInvoiceCreateOpen(false);

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
                <SelectField
                  label="Shop"
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
                </SelectField>

                <ComboboxField
                  label="Customer"
                  value={newInvoiceForm.customerId}
                  options={activeCustomerOptions}
                  onChange={(next) => setNewInvoiceForm((prev) => ({ ...prev, customerId: next }))}
                  placeholder="Search customer..."
                  required
                />

                <SelectField
                  label="Status"
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
                </SelectField>

                <TextField
                  label="Due date (optional)"
                  type="date"
                  value={newInvoiceForm.dueDate}
                  onChange={(event) => setNewInvoiceForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                />

                <TextAreaField
                  label="Notes (optional)"
                  value={newInvoiceForm.notes}
                  onChange={(event) => setNewInvoiceForm((prev) => ({ ...prev, notes: event.target.value }))}
                />

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
                                    prev.lines.length <= 1 ? prev.lines : prev.lines.filter((_, lineIdx) => lineIdx !== idx)
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
              </form>
            ) : (
              <div className="note">
                Create a customer first.
                <div className="approvalActions" style={{ marginTop: "0.75rem" }}>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setInvoiceCreateOpen(false);
                      setActiveView("customers");
                    }}
                  >
                    Go to customers
                  </Button>
                </div>
              </div>
            )}
          </Modal>

          <Modal
            open={invoicePaymentOpen}
            title="Record Payment"
            onClose={() => setInvoicePaymentOpen(false)}
            size="sm"
            footer={
              <div className="approvalActions" style={{ justifyContent: "flex-end" }}>
                <Button variant="ghost" onClick={() => setInvoicePaymentOpen(false)}>
                  Cancel
                </Button>
                <Button form="record-payment-form" type="submit" disabled={invoicesBusy || !selectedInvoice}>
                  {invoicesBusy ? "Saving..." : "Record payment"}
                </Button>
              </div>
            }
          >
            {selectedInvoice ? (
              <form
                id="record-payment-form"
                className="form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!auth) {
                    return;
                  }
                  setError(null);
                  setSuccess(null);
                  setInvoicesBusy(true);
                  try {
                    const amount = Number(newPaymentForm.amount);
                    if (!Number.isFinite(amount) || amount <= 0) {
                      throw new Error("Amount must be greater than 0");
                    }
                    if (amount > selectedInvoice.invoice.balance) {
                      throw new Error("Amount cannot exceed invoice balance");
                    }
                    await createInvoicePayment(auth.token, selectedInvoice.invoice.id, {
                      amount,
                      method: newPaymentForm.method,
                      notes: newPaymentForm.notes ? newPaymentForm.notes : null
                    });
                    setNewPaymentForm({ amount: "", method: "CASH", notes: "" });
                    setSuccess("Payment recorded.");
                    setInvoicePaymentOpen(false);
                    await Promise.all([refreshInvoices(), loadInvoiceDetail(selectedInvoice.invoice.id)]);
                  } catch (caught: unknown) {
                    setError(caught instanceof Error ? caught.message : "Failed to record payment");
                  } finally {
                    setInvoicesBusy(false);
                  }
                }}
              >
                <div className="note">
                  <strong>{selectedInvoice.invoice.invoiceNumber}</strong> • Balance: {formatUGX(selectedInvoice.invoice.balance)}
                </div>

                <TextField
                  label="Amount (UGX)"
                  type="number"
                  min={1}
                  max={selectedInvoice.invoice.balance}
                  value={newPaymentForm.amount}
                  onChange={(event) => setNewPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
                  required
                />

                <SelectField
                  label="Method"
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
                </SelectField>

                <TextAreaField
                  label="Notes (optional)"
                  value={newPaymentForm.notes}
                  onChange={(event) => setNewPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </form>
            ) : (
              <div className="note">Select an invoice first on the Invoices screen.</div>
            )}
          </Modal>
        </>
      ) : null}
    </div>
  );
}
