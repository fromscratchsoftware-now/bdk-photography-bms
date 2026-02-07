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

export const cashRouter = Router();

cashRouter.get("/actions", (_req, res) => {
  res.json({ data: listCashActions() });
});

cashRouter.get("/dashboard/sales/:userId", (req, res, next) => {
  try {
    const dashboard = getSalesCashDashboard(req.params.userId);
    res.json({ data: dashboard });
  } catch (error) {
    next(error);
  }
});

cashRouter.get("/dashboard/admin", (_req, res) => {
  res.json({ data: getAdminCashDashboard() });
});

cashRouter.post("/expenses", (req, res, next) => {
  try {
    const payload = addExpenseSchema.parse(req.body);
    const expense = createExpense(payload);
    res.status(201).json({ data: expense });
  } catch (error) {
    next(error);
  }
});

cashRouter.post("/transfers", (req, res, next) => {
  try {
    const payload = createTransferSchema.parse(req.body);
    const transfer = createCashTransfer(payload);
    res.status(201).json({ data: transfer });
  } catch (error) {
    next(error);
  }
});

cashRouter.patch("/transfers/:transferId/decision", (req, res, next) => {
  try {
    const payload = decideTransferSchema.parse(req.body);
    const transfer = decideCashTransfer(req.params.transferId, payload.status);
    res.json({ data: transfer });
  } catch (error) {
    next(error);
  }
});

cashRouter.post("/bank-actions", (req, res, next) => {
  try {
    const payload = createBankActionSchema.parse(req.body);
    const bankAction = createBankAction(payload);
    res.status(201).json({ data: bankAction });
  } catch (error) {
    next(error);
  }
});

cashRouter.patch("/bank-actions/:actionId/decision", (req, res, next) => {
  try {
    const payload = decideBankActionSchema.parse(req.body);
    const bankAction = decideBankAction(req.params.actionId, payload.status);
    res.json({ data: bankAction });
  } catch (error) {
    next(error);
  }
});

cashRouter.get("/capital/summary", (_req, res) => {
  res.json({ data: getCapitalSummary() });
});

