import { Router } from "express";
import { randomUUID } from "node:crypto";
import { HttpError } from "../services/http-error.js";
import { listPublicUsers, listSeedData } from "../services/store.js";

interface CommissionRate {
  id: string;
  shopId?: string | null;
  shopCode?: string | null;
  shopName?: string | null;
  userId?: string | null;
  userFullName?: string | null;
  ratePercent: number;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

const rates: CommissionRate[] = [];

function enrich(rate: CommissionRate): CommissionRate {
  const shop = listSeedData().shops.find((s) => s.id === rate.shopId);
  const user = listPublicUsers().find((u) => u.id === rate.userId);
  return {
    ...rate,
    shopCode: shop?.code ?? null,
    shopName: shop?.name ?? null,
    userFullName: user?.fullName ?? null
  };
}

export const commissionRatesRouter = Router();

commissionRatesRouter.get("/", (_req, res) => {
  res.json({ data: rates.map(enrich) });
});

commissionRatesRouter.post("/", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user || user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can create commission rates");
    }
    const ratePercent = Number(req.body?.ratePercent);
    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      throw new HttpError(400, "ratePercent must be >= 0");
    }
    const now = new Date().toISOString();
    const created: CommissionRate = {
      id: randomUUID(),
      shopId: req.body?.shopId ?? null,
      userId: req.body?.userId ?? null,
      ratePercent,
      isActive: req.body?.isActive !== false,
      notes: req.body?.notes ?? null,
      createdAt: now,
      updatedAt: now
    };
    rates.push(created);
    res.status(201).json({ data: enrich(created) });
  } catch (error) {
    next(error);
  }
});

commissionRatesRouter.patch("/:rateId", (req, res, next) => {
  try {
    const user = req.authUser;
    if (!user || user.role !== "ADMIN") {
      throw new HttpError(403, "Only admins can update commission rates");
    }
    const idx = rates.findIndex((r) => r.id === req.params.rateId);
    if (idx < 0) {
      throw new HttpError(404, "Commission rate not found");
    }
    const current = rates[idx];
    const nextRate: CommissionRate = {
      ...current,
      shopId: req.body?.shopId !== undefined ? req.body.shopId : current.shopId,
      userId: req.body?.userId !== undefined ? req.body.userId : current.userId,
      ratePercent: req.body?.ratePercent !== undefined ? Number(req.body.ratePercent) : current.ratePercent,
      isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : current.isActive,
      notes: req.body?.notes !== undefined ? req.body.notes : current.notes,
      updatedAt: new Date().toISOString()
    };
    rates[idx] = nextRate;
    res.json({ data: enrich(nextRate) });
  } catch (error) {
    next(error);
  }
});
