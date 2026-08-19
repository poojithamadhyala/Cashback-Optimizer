/**
 * Prisma-backed UserRepository — real implementation of the port in
 * ./user-service.ts. Requires a generated Prisma client + live DB; NOT runnable
 * offline, but real mapping code.
 */
import { prisma } from "../db.ts";
import type { UserRepository, UserRecord } from "./user-service.ts";

export const prismaUserRepository: UserRepository = {
  async findByEmail(email: string): Promise<UserRecord | null> {
    const r = await prisma.user.findUnique({ where: { email } });
    return r ? { id: r.id, email: r.email, passwordHash: r.passwordHash } : null;
  },
  async create(input: { email: string; passwordHash: string }): Promise<UserRecord> {
    const r = await prisma.user.create({
      data: { email: input.email, passwordHash: input.passwordHash },
    });
    return { id: r.id, email: r.email, passwordHash: r.passwordHash };
  },
};
