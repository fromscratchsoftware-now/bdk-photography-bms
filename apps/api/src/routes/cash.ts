import {
  addExpenseSchema,
  createBankActionSchema,
  createTransferSchema,
  decideBankActionSchema,
  decideTransferSchema
} from "@bdk/shared";
import { Router } from "express";
import {
  createBankAction,
  createCashTransfer,
  createExpense,
  decideBankAction,
  decideCashTransfer,
  getAdminCashDashboard,
  getCapitalSummary,
  getSalesCashDashboard,
  listCashActions
} from "../services/store.js";
import { HttpError } from "../services/http-error.js";

export const cashRouter = Router();

cashRouter.get("/actions", (_req, res) => {
  res.json({ data: listCashActions() });
});

cashRouter.get("/dashboard/sales/:userId", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    if (user.role === "SALES" && user.id !== req.params.userId) {
      throw new HttpError(403, "Forbidden");
    }
    const dashboard = getSalesCashDashboard(req.params.userId);
    res.json({ data: dashboard });
  } catch (error) {
    next(error);
  }
});

cashRouter.get("/dashboard/admin", (_req, res) => {
  const user = _req.authUser;
  if (!user) {
    throw new HttpError(401, "Unauthenticated");
  }
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  res.json({ data: getAdminCashDashboard() });
});

cashRouter.post("/expenses", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    const payload = addExpenseSchema.parse(req.body);
    if (payload.paidBy === "SALESPERSON_CASH" && user.role !== "SALES") {
      throw new HttpError(403, "Only sales users can record salesperson-cash expenses");
    }
    if (payload.paidBy === "ADMIN_BANK" && user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can record admin/bank expenses");
    }

    const expense = createExpense({
      ...payload,
      recordedByUserId: user.id
    });
    res.status(201).json({ data: expense });
  } catch (error) {
    next(error);
  }
});

cashRouter.post("/transfers", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    if (user.role !== "SALES") {
      throw new HttpError(403, "Only sales users can initiate transfers");
    }
    const payload = createTransferSchema.parse(req.body);
    const transfer = createCashTransfer({
      senderUserId: user.id,
      ...payload
    });
    res.status(201).json({ data: transfer });
  } catch (error) {
    next(error);
  }
});

cashRouter.patch("/transfers/:transferId/decision", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    if (user.role !== "SALES") {
      throw new HttpError(403, "Only sales users can approve/reject transfers");
    }

    const existing = listCashActions().transfers.find((item) => item.id === req.params.transferId);
    if (!existing) {
      throw new HttpError(404, `Transfer not found: ${req.params.transferId}`);
    }
    if (existing.receiverUserId !== user.id) {
      throw new HttpError(403, "Only the receiver can approve/reject this transfer");
    }

    const payload = decideTransferSchema.parse(req.body);
    const transfer = decideCashTransfer(req.params.transferId, payload.status);
    res.json({ data: transfer });
  } catch (error) {
    next(error);
  }
});

cashRouter.post("/bank-actions", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    if (user.role !== "SALES") {
      throw new HttpError(403, "Only sales users can initiate banking");
    }
    const payload = createBankActionSchema.parse(req.body);
    const bankAction = createBankAction({ userId: user.id, ...payload });
    res.status(201).json({ data: bankAction });
  } catch (error) {
    next(error);
  }
});

cashRouter.patch("/bank-actions/:actionId/decision", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user) {
      throw new HttpError(401, "Unauthenticated");
    }
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can approve/reject banking");
    }

    const existing = listCashActions().bankActions.find((item) => item.id === req.params.actionId);
    if (!existing) {
      throw new HttpError(404, `Bank action not found: ${req.params.actionId}`);
    }

    const payload = decideBankActionSchema.parse(req.body);
    const bankAction = decideBankAction(req.params.actionId, payload.status);
    res.json({ data: bankAction });
  } catch (error) {
    next(error);
  }
});

cashRouter.get("/capital/summary", (_req, res) => {
  const user = _req.authUser;
  if (!user) {
    throw new HttpError(401, "Unauthenticated");
  }
  if (user.role !== "ADMIN") {
    throw new HttpError(403, "Forbidden");
  }
  res.json({ data: getCapitalSummary() });
});
