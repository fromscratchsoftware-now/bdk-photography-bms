import { addSaleSchema } from "@bdk/shared";
import { Router } from "express";
import { createSale, listSales } from "../services/store.js";

export const salesRouter = Router();

salesRouter.get("/", (_req, res) => {
  res.json({ data: listSales() });
});

salesRouter.post("/", (req, res, next) => {
  try {
    const payload = addSaleSchema.parse(req.body);
    const sale = createSale(payload);
    res.status(201).json({ data: sale });
  } catch (error) {
    next(error);
  }
});

