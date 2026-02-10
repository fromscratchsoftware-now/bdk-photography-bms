import { Router } from "express";
import { randomUUID } from "node:crypto";
import { HttpError } from "../services/http-error.js";
import { listSeedData } from "../services/store.js";

interface ShopConfig {
  id: string;
  name: string;
  code: string;
  commissionRatePercent?: number | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const seededShops = (): ShopConfig[] =>
  listSeedData().shops.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    commissionRatePercent: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

const shops: ShopConfig[] = seededShops();

export const shopsRouter = Router();

shopsRouter.get("/", (_req, res) => {
  res.json({ data: shops });
});

shopsRouter.post("/", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user || user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can create shops");
    }
    const name = String(req.body?.name ?? "").trim();
    const code = String(req.body?.code ?? "").trim().toUpperCase();
    if (!name || !code) {
      throw new HttpError(400, "name and code are required");
    }
    if (shops.some((s) => s.code === code)) {
      throw new HttpError(400, "Shop code already exists");
    }
    const now = new Date().toISOString();
    const created: ShopConfig = {
      id: randomUUID(),
      name,
      code,
      notes: req.body?.notes ?? null,
      commissionRatePercent: req.body?.commissionRatePercent ?? null,
      createdAt: now,
      updatedAt: now
    };
    shops.push(created);
    res.status(201).json({ data: created });
  } catch (error) {
    next(error);
  }
});

shopsRouter.patch("/:shopId", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user || user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can update shops");
    }
    const idx = shops.findIndex((s) => s.id === req.params.shopId);
    if (idx < 0) {
      throw new HttpError(404, "Shop not found");
    }

    const current = shops[idx];
    const nextShop: ShopConfig = {
      ...current,
      name: req.body?.name != null ? String(req.body.name).trim() : current.name,
      code: req.body?.code != null ? String(req.body.code).trim().toUpperCase() : current.code,
      notes: req.body?.notes !== undefined ? req.body.notes : current.notes,
      commissionRatePercent:
        req.body?.commissionRatePercent !== undefined ? req.body.commissionRatePercent : current.commissionRatePercent,
      updatedAt: new Date().toISOString()
    };
    shops[idx] = nextShop;
    res.json({ data: nextShop });
  } catch (error) {
    next(error);
  }
});
