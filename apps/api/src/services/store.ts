import type {
  BankAction,
  CashTransfer,
  Expense,
  InvoiceStatus,
  Product,
  Role,
  Sale,
  SaleLine,
  Shop
} from "@bdk/shared";

interface User {
  id: string;
  fullName: string;
  role: Role;
  shopId?: string;
}

interface InventoryRow {
  shopId: string;
  productId: string;
  quantity: number;
}

interface Customer {
  id: string;
  mobileNumber: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface InvoiceLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: number;
  method: "CASH" | "MOBILE_MONEY" | "CARD";
  notes?: string;
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  shopId: string;
  customerId: string;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  totalAmount: number;
  paidAmount: number;
  balance: number;
  dueDate?: string;
  notes?: string;
  createdByUserId: string;
  createdAt: string;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resetArray<T>(target: T[], seed: T[]): void {
  target.splice(0, target.length, ...deepClone(seed));
}

const seedShops: Shop[] = [
  { id: "shop-kampala-main", name: "Kampala Main", code: "KLA" },
  { id: "shop-wandegeya", name: "Wandegeya", code: "WDG" }
];

const seedUsers: User[] = [
  { id: "user-admin-1", fullName: "System Admin", role: "ADMIN" },
  { id: "user-manager-1", fullName: "Shop Manager", role: "MANAGER" },
  { id: "user-sales-1", fullName: "Sales One", role: "SALES", shopId: "shop-kampala-main" },
  { id: "user-sales-2", fullName: "Sales Two", role: "SALES", shopId: "shop-wandegeya" }
];

const seedProducts: Product[] = [
  {
    id: "prod-board-a4c",
    skuCode: "A4C-BOARD",
    name: "A4C Board",
    category: "Boards",
    productType: "BOARD",
    unitOfMeasure: "piece",
    costPrice: 1200,
    sellingPrice: 2500,
    active: true
  },
  {
    id: "prod-board-a3c",
    skuCode: "A3C-BOARD",
    name: "A3C Board",
    category: "Boards",
    productType: "BOARD",
    unitOfMeasure: "piece",
    costPrice: 2400,
    sellingPrice: 4200,
    active: true
  },
  {
    id: "prod-frame-basic",
    skuCode: "FRAME-BASIC",
    name: "Basic Frame",
    category: "Frames",
    productType: "NON_BOARD",
    unitOfMeasure: "piece",
    costPrice: 6000,
    sellingPrice: 10000,
    active: true
  }
];

const seedInventoryRows: InventoryRow[] = [
  { shopId: "shop-kampala-main", productId: "prod-board-a4c", quantity: 200 },
  { shopId: "shop-kampala-main", productId: "prod-board-a3c", quantity: 80 },
  { shopId: "shop-kampala-main", productId: "prod-frame-basic", quantity: 25 },
  { shopId: "shop-wandegeya", productId: "prod-board-a4c", quantity: 150 },
  { shopId: "shop-wandegeya", productId: "prod-board-a3c", quantity: 60 },
  { shopId: "shop-wandegeya", productId: "prod-frame-basic", quantity: 30 }
];

const shops: Shop[] = deepClone(seedShops);
const users: User[] = deepClone(seedUsers);
const products: Product[] = deepClone(seedProducts);
const inventoryRows: InventoryRow[] = deepClone(seedInventoryRows);

const sales: Sale[] = [];
const expenses: Expense[] = [];
const transfers: CashTransfer[] = [];
const bankActions: BankAction[] = [];
const customers: Customer[] = [];
const invoices: Invoice[] = [];
const invoicePayments: InvoicePayment[] = [];

let shopInvoiceCounters: Record<string, number> = {};
let bankCash = 0;

export function __resetForTests(): void {
  resetArray(shops, seedShops);
  resetArray(users, seedUsers);
  resetArray(products, seedProducts);
  resetArray(inventoryRows, seedInventoryRows);

  sales.splice(0, sales.length);
  expenses.splice(0, expenses.length);
  transfers.splice(0, transfers.length);
  bankActions.splice(0, bankActions.length);
  customers.splice(0, customers.length);
  invoices.splice(0, invoices.length);
  invoicePayments.splice(0, invoicePayments.length);

  shopInvoiceCounters = {};
  bankCash = 0;
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function requireShop(shopId: string): Shop {
  const shop = shops.find((item) => item.id === shopId);
  if (!shop) {
    throw new Error(`Shop not found: ${shopId}`);
  }
  return shop;
}

function requireUser(userId: string): User {
  const user = users.find((item) => item.id === userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  return user;
}

export type AuthUser = User;

export function getAuthUser(userId: string): AuthUser {
  return requireUser(userId);
}

function requireProduct(productId: string): Product {
  const product = products.find((item) => item.id === productId);
  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }
  return product;
}

function getInventoryRow(shopId: string, productId: string): InventoryRow {
  const row = inventoryRows.find((item) => item.shopId === shopId && item.productId === productId);
  if (!row) {
    const created: InventoryRow = { shopId, productId, quantity: 0 };
    inventoryRows.push(created);
    return created;
  }
  return row;
}

function getCashSalesCollected(userId: string): number {
  return sales
    .filter((item) => item.userId === userId && item.paymentMethod === "CASH")
    .reduce((sum, item) => sum + item.subtotal, 0);
}

function getCashExpensesPaidByUser(userId: string): number {
  return expenses
    .filter((item) => item.recordedByUserId === userId && item.paidBy === "SALESPERSON_CASH")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getApprovedTransfersSent(userId: string): number {
  return transfers
    .filter((item) => item.senderUserId === userId && item.status === "APPROVED")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getApprovedTransfersReceived(userId: string): number {
  return transfers
    .filter((item) => item.receiverUserId === userId && item.status === "APPROVED")
    .reduce((sum, item) => sum + item.amount, 0);
}

function getApprovedBanking(userId: string): number {
  return bankActions
    .filter((item) => item.userId === userId && item.status === "APPROVED")
    .reduce((sum, item) => sum + item.amount, 0);
}

export function getUserCashAtHand(userId: string): number {
  requireUser(userId);
  return (
    getCashSalesCollected(userId) -
    getCashExpensesPaidByUser(userId) -
    getApprovedTransfersSent(userId) +
    getApprovedTransfersReceived(userId) -
    getApprovedBanking(userId)
  );
}

function ensureCashAvailable(userId: string, amount: number): void {
  const currentCash = getUserCashAtHand(userId);
  if (currentCash < amount) {
    throw new Error(
      `Insufficient cash at hand for user ${userId}. Available: ${currentCash}, required: ${amount}`
    );
  }
}

function ensureBankCashAvailable(amount: number): void {
  if (bankCash < amount) {
    throw new Error(`Insufficient bank cash. Available: ${bankCash}, required: ${amount}`);
  }
}

function materializeSaleLines(lines: Array<{ productId: string; quantity: number; unitPrice: number }>): SaleLine[] {
  return lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.quantity * line.unitPrice
  }));
}

export function listSeedData(): { shops: Shop[]; users: User[] } {
  return { shops, users };
}

export function listProducts(): Product[] {
  return products;
}

export function listInventory(): InventoryRow[] {
  return inventoryRows;
}

export function createProduct(input: Omit<Product, "id">): Product {
  if (products.some((item) => item.skuCode.toLowerCase() === input.skuCode.toLowerCase())) {
    throw new Error(`Duplicate SKU code: ${input.skuCode}`);
  }

  const product: Product = {
    id: createId("prod"),
    ...input
  };
  products.push(product);
  return product;
}

export function receiveStock(input: { shopId: string; productId: string; quantity: number }): InventoryRow {
  requireShop(input.shopId);
  requireProduct(input.productId);

  const row = getInventoryRow(input.shopId, input.productId);
  row.quantity += input.quantity;
  return row;
}

export function createSale(input: {
  shopId: string;
  userId: string;
  paymentMethod: "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
}): Sale {
  requireShop(input.shopId);
  const user = requireUser(input.userId);
  if (user.role !== "SALES") {
    throw new Error(`Only sales users can create sales. User ${user.id} has role ${user.role}`);
  }
  if (user.shopId && user.shopId !== input.shopId) {
    throw new Error(`User ${user.id} is assigned to shop ${user.shopId}, not ${input.shopId}`);
  }

  for (const line of input.lines) {
    requireProduct(line.productId);
    const inventoryRow = getInventoryRow(input.shopId, line.productId);
    if (inventoryRow.quantity < line.quantity) {
      throw new Error(
        `Insufficient stock for product ${line.productId}. Available: ${inventoryRow.quantity}, required: ${line.quantity}`
      );
    }
  }

  for (const line of input.lines) {
    const inventoryRow = getInventoryRow(input.shopId, line.productId);
    inventoryRow.quantity -= line.quantity;
  }

  const lines = materializeSaleLines(input.lines);
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const sale: Sale = {
    id: createId("sale"),
    shopId: input.shopId,
    userId: input.userId,
    lines,
    subtotal,
    paymentMethod: input.paymentMethod,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };

  sales.push(sale);
  return sale;
}

export function listSales(): Sale[] {
  return sales;
}

export function createExpense(input: Omit<Expense, "id" | "createdAt">): Expense {
  requireUser(input.recordedByUserId);

  if (input.paidBy === "SALESPERSON_CASH") {
    ensureCashAvailable(input.recordedByUserId, input.amount);
  }

  if (input.paidBy === "ADMIN_BANK") {
    ensureBankCashAvailable(input.amount);
    bankCash -= input.amount;
  }

  const expense: Expense = {
    id: createId("exp"),
    ...input,
    createdAt: new Date().toISOString()
  };
  expenses.push(expense);
  return expense;
}

export function createCashTransfer(input: {
  senderUserId: string;
  receiverUserId: string;
  amount: number;
}): CashTransfer {
  const sender = requireUser(input.senderUserId);
  requireUser(input.receiverUserId);

  if (sender.role !== "SALES") {
    throw new Error(`Only sales users can initiate transfers. User ${sender.id} has role ${sender.role}`);
  }

  if (input.senderUserId === input.receiverUserId) {
    throw new Error("Sender and receiver cannot be the same user");
  }

  const transfer: CashTransfer = {
    id: createId("transfer"),
    senderUserId: input.senderUserId,
    receiverUserId: input.receiverUserId,
    amount: input.amount,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };
  transfers.push(transfer);
  return transfer;
}

export function decideCashTransfer(
  transferId: string,
  decision: "APPROVED" | "REJECTED"
): CashTransfer {
  const transfer = transfers.find((item) => item.id === transferId);
  if (!transfer) {
    throw new Error(`Transfer not found: ${transferId}`);
  }
  if (transfer.status !== "PENDING") {
    throw new Error(`Transfer already finalized with status ${transfer.status}`);
  }

  if (decision === "APPROVED") {
    ensureCashAvailable(transfer.senderUserId, transfer.amount);
  }

  transfer.status = decision;
  return transfer;
}

export function createBankAction(input: { userId: string; amount: number }): BankAction {
  const user = requireUser(input.userId);
  if (user.role !== "SALES") {
    throw new Error(`Only sales users can initiate banking. User ${user.id} has role ${user.role}`);
  }
  const bankAction: BankAction = {
    id: createId("bank"),
    userId: input.userId,
    amount: input.amount,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };
  bankActions.push(bankAction);
  return bankAction;
}

export function decideBankAction(actionId: string, decision: "APPROVED" | "REJECTED"): BankAction {
  const action = bankActions.find((item) => item.id === actionId);
  if (!action) {
    throw new Error(`Bank action not found: ${actionId}`);
  }
  if (action.status !== "PENDING") {
    throw new Error(`Bank action already finalized with status ${action.status}`);
  }

  if (decision === "APPROVED") {
    ensureCashAvailable(action.userId, action.amount);
    bankCash += action.amount;
  }

  action.status = decision;
  return action;
}

export function listCashActions(): { transfers: CashTransfer[]; bankActions: BankAction[]; expenses: Expense[] } {
  return { transfers, bankActions, expenses };
}

export function getSalesCashDashboard(userId: string): {
  userId: string;
  cashAtHand: number;
  pendingTransfers: CashTransfer[];
  pendingBankActions: BankAction[];
} {
  requireUser(userId);
  return {
    userId,
    cashAtHand: getUserCashAtHand(userId),
    pendingTransfers: transfers.filter(
      (item) =>
        item.status === "PENDING" && (item.senderUserId === userId || item.receiverUserId === userId)
    ),
    pendingBankActions: bankActions.filter((item) => item.status === "PENDING" && item.userId === userId)
  };
}

export function getAdminCashDashboard(): {
  users: Array<{ userId: string; fullName: string; role: Role; cashAtHand: number }>;
  bankCash: number;
  totalCashAtHand: number;
  pendingTransfers: number;
  pendingBankActions: number;
} {
  const userBalances = users.map((user) => ({
    userId: user.id,
    fullName: user.fullName,
    role: user.role,
    cashAtHand: getUserCashAtHand(user.id)
  }));

  return {
    users: userBalances,
    bankCash,
    totalCashAtHand: userBalances.reduce((sum, entry) => sum + entry.cashAtHand, 0),
    pendingTransfers: transfers.filter((item) => item.status === "PENDING").length,
    pendingBankActions: bankActions.filter((item) => item.status === "PENDING").length
  };
}

function getInventoryValueSummary(): { totalInventoryValue: number; warnings: string[] } {
  const warnings: string[] = [];
  let totalInventoryValue = 0;

  for (const product of products) {
    const totalQty = inventoryRows
      .filter((row) => row.productId === product.id)
      .reduce((sum, row) => sum + row.quantity, 0);

    if (product.productType === "NON_BOARD") {
      totalInventoryValue += totalQty * (product.costPrice ?? 0);
      continue;
    }

    if (typeof product.costPrice === "number") {
      totalInventoryValue += totalQty * product.costPrice;
    } else {
      warnings.push(`Board SKU ${product.skuCode} has no cost configured. Value treated as 0.`);
    }
  }

  return { totalInventoryValue, warnings };
}

export function getCapitalSummary(): {
  totalCashAtHand: number;
  bankCash: number;
  totalInventoryValue: number;
  businessCapital: number;
  warnings: string[];
} {
  const totalCashAtHand = users.reduce((sum, user) => sum + getUserCashAtHand(user.id), 0);
  const inventorySummary = getInventoryValueSummary();
  return {
    totalCashAtHand,
    bankCash,
    totalInventoryValue: inventorySummary.totalInventoryValue,
    businessCapital: totalCashAtHand + bankCash + inventorySummary.totalInventoryValue,
    warnings: inventorySummary.warnings
  };
}

export function createCustomer(input: Omit<Customer, "id">): Customer {
  if (customers.some((item) => item.mobileNumber === input.mobileNumber)) {
    throw new Error(`Customer already exists with mobile number ${input.mobileNumber}`);
  }
  const customer: Customer = { id: createId("cust"), ...input };
  customers.push(customer);
  return customer;
}

export function listCustomers(): Customer[] {
  return customers;
}

function nextInvoiceNumber(shopId: string): string {
  const shop = requireShop(shopId);
  const current = shopInvoiceCounters[shopId] ?? 0;
  const next = current + 1;
  shopInvoiceCounters[shopId] = next;
  return `${shop.code}-${String(next).padStart(6, "0")}`;
}

export function createInvoice(input: {
  shopId: string;
  customerId: string;
  createdByUserId: string;
  status: "DRAFT" | "ISSUED";
  lines: Array<{ productId: string; quantity: number; unitPrice: number }>;
  dueDate?: string;
  notes?: string;
}): Invoice {
  requireShop(input.shopId);
  requireUser(input.createdByUserId);

  const customerExists = customers.some((item) => item.id === input.customerId);
  if (!customerExists) {
    throw new Error(`Customer not found: ${input.customerId}`);
  }

  for (const line of input.lines) {
    requireProduct(line.productId);
  }

  const lines: InvoiceLine[] = input.lines.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.quantity * line.unitPrice
  }));
  const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const invoice: Invoice = {
    id: createId("inv"),
    invoiceNumber: nextInvoiceNumber(input.shopId),
    shopId: input.shopId,
    customerId: input.customerId,
    status: input.status,
    lines,
    totalAmount,
    paidAmount: 0,
    balance: totalAmount,
    dueDate: input.dueDate,
    notes: input.notes,
    createdByUserId: input.createdByUserId,
    createdAt: new Date().toISOString()
  };

  invoices.push(invoice);
  return invoice;
}

export function setInvoiceStatus(invoiceId: string, status: InvoiceStatus): Invoice {
  const invoice = invoices.find((item) => item.id === invoiceId);
  if (!invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`);
  }
  invoice.status = status;
  return invoice;
}

export function addInvoicePayment(input: {
  invoiceId: string;
  amount: number;
  method: "CASH" | "MOBILE_MONEY" | "CARD";
  notes?: string;
}): { invoice: Invoice; payment: InvoicePayment } {
  const invoice = invoices.find((item) => item.id === input.invoiceId);
  if (!invoice) {
    throw new Error(`Invoice not found: ${input.invoiceId}`);
  }
  if (invoice.status === "VOID") {
    throw new Error("Cannot accept payment for a void invoice");
  }
  if (input.amount > invoice.balance) {
    throw new Error(`Payment amount ${input.amount} exceeds invoice balance ${invoice.balance}`);
  }

  const payment: InvoicePayment = {
    id: createId("pay"),
    invoiceId: input.invoiceId,
    amount: input.amount,
    method: input.method,
    notes: input.notes,
    createdAt: new Date().toISOString()
  };

  invoicePayments.push(payment);
  invoice.paidAmount += input.amount;
  invoice.balance = Number((invoice.totalAmount - invoice.paidAmount).toFixed(2));

  if (invoice.balance === 0) {
    invoice.status = "PAID";
  } else if (invoice.paidAmount > 0) {
    invoice.status = "PARTIALLY_PAID";
  }

  return { invoice, payment };
}

export function listInvoices(): Invoice[] {
  return invoices;
}

export function listInvoicePayments(invoiceId?: string): InvoicePayment[] {
  if (!invoiceId) {
    return invoicePayments;
  }
  return invoicePayments.filter((item) => item.invoiceId === invoiceId);
}

export function listOverdueInvoices(referenceDate = new Date()): Invoice[] {
  const today = referenceDate.toISOString().slice(0, 10);
  return invoices.filter((invoice) => {
    if (!invoice.dueDate) {
      return false;
    }
    return invoice.balance > 0 && invoice.dueDate < today && invoice.status !== "VOID";
  });
}
