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
