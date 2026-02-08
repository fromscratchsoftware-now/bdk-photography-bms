import type { RequestHandler } from "express";
import { HttpError } from "../services/http-error.js";
import { getAuthUser, type AuthUser } from "../services/store.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = req.header("x-user-id");
  if (!userId) {
    next(new HttpError(401, "Missing x-user-id header"));
    return;
  }

  try {
    req.authUser = getAuthUser(userId);
    next();
  } catch (error) {
    next(new HttpError(401, "Invalid user"));
  }
};

export function requireRole(allowedRoles: AuthUser["role"][]): RequestHandler {
  return (req, _res, next) => {
    const user = req.authUser;
    if (!user) {
      next(new HttpError(401, "Unauthenticated"));
      return;
    }
    if (!allowedRoles.includes(user.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }
    next();
  };
}

