import { createProductSchema } from "@bdk/shared";
import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../services/http-error.js";
import { createProduct, listInventory, listProducts, receiveStock } from "../services/store.js";

const receiveStockSchema = z.object({
  shopId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.number().int().positive()
});

export const productsRouter = Router();

productsRouter.get("/", (_req, res) => {
  res.json({ data: listProducts() });
});

productsRouter.post("/", (req, res, next) => {
  try {
    const payload = createProductSchema.parse(req.body);
    const product = createProduct(payload);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
});

productsRouter.get("/inventory", (_req, res) => {
  res.json({ data: listInventory() });
});

productsRouter.post("/inventory/receive", (req, res, next) => {
  try {
    const payload = receiveStockSchema.parse(req.body);
    const row = receiveStock(payload);
    res.status(201).json({ data: row });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Product not found")) {
      next(new HttpError(404, error.message));
      return;
    }
    next(error);
  }
});

