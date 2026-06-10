import { PrismaClient } from "@prisma/client";

// Singleton guarded against duplication under `tsx watch` hot-reloads.
const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  g.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
