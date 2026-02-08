import { Router } from "express";
import { requireAuth, toPublicUser } from "../auth.js";
import { prisma } from "../db.js";
import { requireRoles } from "../rbac.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Admin: list all users.
// Manager: list sales users in the manager's assigned shops.
usersRouter.get("/", requireRoles(["ADMIN", "MANAGER"]), async (req, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role.name === "ADMIN") {
      const users = await prisma.user.findMany({
        include: {
          role: true,
          assignments: { where: { unassignedAt: null }, include: { shop: true } }
        },
        orderBy: { createdAt: "desc" }
      });
      res.json({ data: users.map((u) => toPublicUser(u)) });
      return;
    }

    const allowedShopIds = new Set(user.assignments.map((a) => a.shopId));
    const salesUsers = await prisma.user.findMany({
      where: {
        role: { name: "SALES" },
        assignments: { some: { shopId: { in: [...allowedShopIds] }, unassignedAt: null } }
      },
      include: {
        role: true,
        assignments: { where: { unassignedAt: null }, include: { shop: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ data: salesUsers.map((u) => toPublicUser(u)) });
  } catch (error) {
    next(error);
  }
});
