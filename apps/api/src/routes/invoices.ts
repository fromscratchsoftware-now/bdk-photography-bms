import { Router } from "express";
import { z } from "zod";
import {
  addInvoicePayment,
  createCustomer,
  createInvoice,
  listCustomers,
  listInvoicePayments,
  listInvoices,
  listOverdueInvoices,
  setInvoiceStatus
} from "../services/store.js";

const createCustomerSchema = z.object({
  mobileNumber: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional()
});

const invoiceLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive()
});

const createInvoiceSchema = z.object({
  shopId: z.string().min(1),
  customerId: z.string().min(1),
  createdByUserId: z.string().min(1),
  status: z.enum(["DRAFT", "ISSUED"]).default("ISSUED"),
  lines: z.array(invoiceLineSchema).min(1),
  dueDate: z.string().date().optional(),
  notes: z.string().optional()
});

const setInvoiceStatusSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"])
});

const createPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "MOBILE_MONEY", "CARD"]),
  notes: z.string().optional()
});

export const invoicesRouter = Router();

invoicesRouter.get("/customers", (_req, res) => {
  res.json({ data: listCustomers() });
});

invoicesRouter.post("/customers", (req, res, next) => {
  try {
    const payload = createCustomerSchema.parse(req.body);
    const customer = createCustomer(payload);
    res.status(201).json({ data: customer });
  } catch (error) {
    next(error);
  }
});

invoicesRouter.get("/", (_req, res) => {
  res.json({ data: listInvoices() });
});

invoicesRouter.get("/overdue", (_req, res) => {
  res.json({ data: listOverdueInvoices() });
});

invoicesRouter.post("/", (req, res, next) => {
  try {
    const payload = createInvoiceSchema.parse(req.body);
    const invoice = createInvoice(payload);
    res.status(201).json({ data: invoice });
  } catch (error) {
    next(error);
  }
});

invoicesRouter.patch("/:invoiceId/status", (req, res, next) => {
  try {
    const payload = setInvoiceStatusSchema.parse(req.body);
    const invoice = setInvoiceStatus(req.params.invoiceId, payload.status);
    res.json({ data: invoice });
  } catch (error) {
    next(error);
  }
});

invoicesRouter.get("/:invoiceId/payments", (req, res) => {
  res.json({ data: listInvoicePayments(req.params.invoiceId) });
});

invoicesRouter.post("/:invoiceId/payments", (req, res, next) => {
  try {
    const payload = createPaymentSchema.parse(req.body);
    const result = addInvoicePayment({
      invoiceId: req.params.invoiceId,
      ...payload
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

