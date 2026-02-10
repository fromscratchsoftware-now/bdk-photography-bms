import { addSaleSchema } from "@bdk/shared";
import { Router } from "express";
import { createSale, listSales } from "../services/store.js";

export const salesRouter = Router();

salesRouter.get("/", (req, res) => {
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;

  const filtered = listSales().filter((sale) => {
    const ymd = sale.createdAt.slice(0, 10);
    if (dateFrom && ymd < dateFrom) return false;
    if (dateTo && ymd > dateTo) return false;
    return true;
  });

  res.json({ data: filtered });
});

salesRouter.post("/", (req, res, next) => {
  try {
    const payload = addSaleSchema.parse(req.body);
    const user = req.authUser;
    if (!user) {
      throw new Error("Unauthenticated");
    }
    if (!user.shopId) {
      throw new Error("User is not assigned to a shop");
    }

    const sale = createSale({
      shopId: user.shopId,
      userId: user.id,
      ...payload
    });
    res.status(201).json({ data: sale });
  } catch (error) {
    next(error);
  }
});
