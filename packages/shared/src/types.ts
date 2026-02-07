export type Role = "ADMIN" | "MANAGER" | "SALES";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export type PaymentMethod = "CASH" | "MOBILE_MONEY" | "CARD" | "CREDIT";

export type TransferStatus = "PENDING" | "APPROVED" | "REJECTED";

export type BankingStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ProductType = "BOARD" | "NON_BOARD";

export type BoardSizeCode = "A4C" | "A3C" | "A2C";

export interface Shop {
  id: string;
  name: string;
  code: string;
}

export interface Product {
  id: string;
  skuCode: string;
  name: string;
  category: string;
  productType: ProductType;
  unitOfMeasure: string;
  costPrice?: number;
  sellingPrice: number;
  active: boolean;
}

export interface CashTransfer {
  id: string;
  senderUserId: string;
  receiverUserId: string;
  amount: number;
  status: TransferStatus;
  createdAt: string;
}

export interface BankAction {
  id: string;
  userId: string;
  amount: number;
  status: BankingStatus;
  createdAt: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  notes?: string;
  paidBy: "SALESPERSON_CASH" | "ADMIN_BANK";
  recordedByUserId: string;
  createdAt: string;
}

export interface Sale {
  id: string;
  shopId: string;
  userId: string;
  lines: SaleLine[];
  subtotal: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
}

export interface SaleLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
