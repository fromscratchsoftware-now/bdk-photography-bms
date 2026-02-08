import type { RequestHandler } from "express";
import type { AuthUser } from "./auth.js";

export type RoleName = "ADMIN" | "MANAGER" | "SALES";

function getRole(user: AuthUser): RoleName {
  return user.role.name;
}

export function requireRoles(allowed: RoleName[]): RequestHandler {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "HttpError", message: "Unauthenticated" });
      return;
    }
    if (!allowed.includes(getRole(user))) {
      res.status(403).json({ error: "HttpError", message: "Forbidden" });
      return;
    }
    next();
  };
}

export function assertShopAccess(user: AuthUser, shopId: string): void {
  const role = getRole(user);
  if (role === "ADMIN") {
    return;
  }
  const hasAssignment = user.assignments.some((assignment) => assignment.shopId === shopId && assignment.unassignedAt === null);
  if (!hasAssignment) {
    throw new Error("Forbidden");
  }
}

export function requireShopAccessFromParam(paramName: string): RequestHandler {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "HttpError", message: "Unauthenticated" });
      return;
    }
    const shopId = String(req.params[paramName] || "");
    if (!shopId) {
      res.status(400).json({ error: "ValidationError", message: `${paramName} is required` });
      return;
    }
    try {
      assertShopAccess(user, shopId);
      next();
    } catch {
      res.status(403).json({ error: "HttpError", message: "Forbidden" });
    }
  };
}
