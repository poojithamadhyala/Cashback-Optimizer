/**
 * Prisma client singleton. Avoids exhausting connections during Next.js dev
 * hot-reload. NOT connected in this sandbox (no Postgres / no network).
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
