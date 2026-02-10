import { z } from "zod";

export const createProductSchema = z.object({
  productNameId: z.string().min(1),
  categoryId: z.string().min(1),
  productType: z.enum(["BOARD", "NON_BOARD"]),
  unitOfMeasureId: z.string().min(1),
  costPrice: z.number().nonnegative().nullable().optional(),
  sellingPrice: z.number().nonnegative(),
  isActive: z.boolean().default(true),
  boardSizeCodeId: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

export const addSaleSchema = z.object({
  paymentMethod: z.enum(["CASH", "MOBILE_MONEY", "CARD", "CREDIT"]),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive()
      })
    )
    .min(1)
});

export const addExpenseSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(2),
  notes: z.string().optional(),
  paidBy: z.enum(["SALESPERSON_CASH", "ADMIN_BANK"])
});

export const createTransferSchema = z.object({
  receiverUserId: z.string().min(1),
  amount: z.number().positive()
});

export const decideTransferSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"])
});

export const createBankActionSchema = z.object({
  amount: z.number().positive()
});

export const decideBankActionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"])
});
