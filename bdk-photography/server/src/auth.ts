import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import type { Prisma } from "@prisma/client";
import { env } from "./env.js";
import { prisma } from "./db.js";

export type AuthJwtPayload = {
  sub: string;
  iat: number;
  exp: number;
};

export type AuthUser = Prisma.UserGetPayload<{
  include: {
    role: true;
    assignments: {
      include: {
        shop: true;
      };
    };
  };
}>;

export function normalizePhone(input: string): string {
  return input.trim().replace(/\D+/g, "");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

export function verifyToken(token: string): AuthJwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (!decoded || typeof decoded !== "object" || typeof (decoded as any).sub !== "string") {
    throw new Error("Invalid token");
  }
  return decoded as AuthJwtPayload;
}

async function getAuthUser(userId: string): Promise<AuthUser | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      assignments: {
        where: { unassignedAt: null },
        include: { shop: true }
      }
    }
  });
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.header("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      res.status(401).json({ error: "HttpError", message: "Missing Authorization bearer token" });
      return;
    }

    const payload = verifyToken(token);
    const user = await getAuthUser(payload.sub);
    if (!user || !user.isActive) {
      res.status(401).json({ error: "HttpError", message: "Invalid user" });
      return;
    }

    req.authUser = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "HttpError", message: "Invalid token" });
  }
};

export function toPublicUser(user: AuthUser) {
  const { passwordHash: _secret, ...rest } = user;
  return rest;
}
