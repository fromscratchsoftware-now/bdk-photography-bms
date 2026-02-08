import { Router } from "express";
import { requireAuth } from "../auth.js";
import { requireRoles, requireShopAccessFromParam } from "../rbac.js";

export const cashRouter = Router();

cashRouter.use(requireAuth);

cashRouter.get("/me", (req, res) => {
  const user = req.authUser!;
  res.json({
    data: {
      userId: user.id,
      role: user.role.name,
      shops: user.assignments.map((a) => ({
        shopId: a.shopId,
        name: a.shop.name,
        code: a.shop.code,
        isPrimary: a.isPrimary
      }))
    }
  });
});

cashRouter.get("/admin/summary", requireRoles(["ADMIN"]), (_req, res) => {
  res.json({ data: { ok: true } });
});

cashRouter.get("/shops/:shopId/summary", requireShopAccessFromParam("shopId"), (req, res) => {
  res.json({ data: { shopId: req.params.shopId, ok: true } });
});
