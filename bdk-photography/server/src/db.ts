import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __bdkPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__bdkPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__bdkPrisma = prisma;
}
