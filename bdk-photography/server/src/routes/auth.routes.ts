import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { normalizePhone, requireAuth, signToken, toPublicUser, verifyPassword } from "../auth.js";
import { asyncHandler } from "../http.js";

export const authRouter = Router();

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1)
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const phone = normalizePhone(input.phone);
  if (!phone) {
    res.status(400).json({ error: "ValidationError", message: "Invalid phone" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: {
      role: true,
      assignments: {
        where: { unassignedAt: null },
        include: { shop: true }
      }
    }
  });

  if (!user || !user.isActive) {
    res.status(401).json({ error: "HttpError", message: "Invalid credentials" });
    return;
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "HttpError", message: "Invalid credentials" });
    return;
  }

  const token = signToken(user.id);
  res.json({ data: { token, user: toPublicUser(user) } });
  })
);

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ data: toPublicUser(req.authUser!) });
});
