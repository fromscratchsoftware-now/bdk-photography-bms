import { Router } from "express";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";
import { requireShopAccessFromParam } from "../rbac.js";

export const shopsRouter = Router();

shopsRouter.use(requireAuth);

shopsRouter.get("/", async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role.name === "ADMIN") {
      const shops = await prisma.shop.findMany({ orderBy: { name: "asc" } });
      res.json({ data: shops });
      return;
    }

    const shops = user.assignments.map((a) => a.shop);
    res.json({ data: shops });
  } catch (error) {
    next(error);
  }
});

shopsRouter.get("/:shopId", requireShopAccessFromParam("shopId"), async (req, res, next) => {
  try {
    const shopId = req.params.shopId;
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      res.status(404).json({ error: "NotFound", message: "Shop not found" });
      return;
    }
    res.json({ data: shop });
  } catch (error) {
    next(error);
  }
});

