import { Router } from "express";

interface ExpenseItem {
  id: string;
  shopId: string;
  shopCode: string;
  shopName: string;
  categoryId: string;
  categoryName: string;
  amountUGX: number;
  expenseDate: string;
  notes?: string | null;
  paymentSource: "SALESPERSON_CASH" | "ADMIN_BANK";
  paidByUserId?: string | null;
  paidByFullName?: string | null;
  recordedByUserId?: string | null;
  recordedByFullName?: string | null;
  isVoid: boolean;
  createdAt: string;
  updatedAt: string;
}

const expenses: ExpenseItem[] = [];

export const expensesRouter = Router();

expensesRouter.get("/", (req, res) => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
  const shopId = typeof req.query.shopId === "string" ? req.query.shopId : undefined;

  const filtered = expenses.filter((e) => {
    if (shopId && e.shopId !== shopId) return false;
    if (dateFrom && e.expenseDate < dateFrom) return false;
    if (dateTo && e.expenseDate > dateTo) return false;
    return true;
  });

  res.json({ data: filtered });
});
