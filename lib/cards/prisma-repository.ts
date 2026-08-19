/**
 * Prisma-backed CardRepository — the real implementation of the port defined in
 * ./service.ts. The service's business rules are unit-tested with an in-memory
 * fake; this adapter just maps to Prisma queries.
 *
 * NOTE: requires a generated Prisma client + a live DB. NOT runnable in the
 * offline sandbox, but the mapping is real code, not a stub.
 */

import { prisma } from "../db.ts";
import type {
  CardRepository,
  CatalogCardRecord,
  UserCardRecord,
} from "./service.ts";

export const prismaCardRepository: CardRepository = {
  async searchCatalog(search?: string): Promise<CatalogCardRecord[]> {
    const rows = await prisma.cardCatalog.findMany({
      where: search
        ? {
            OR: [
              { issuer: { contains: search, mode: "insensitive" } },
              { productName: { contains: search, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: [{ issuer: "asc" }, { productName: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      issuer: r.issuer,
      productName: r.productName,
      network: r.network,
    }));
  },

  async getCatalogCard(id: string): Promise<CatalogCardRecord | null> {
    const r = await prisma.cardCatalog.findUnique({ where: { id } });
    return r
      ? { id: r.id, issuer: r.issuer, productName: r.productName, network: r.network }
      : null;
  },

  async listUserCards(userId: string): Promise<UserCardRecord[]> {
    const rows = await prisma.userCard.findMany({
      where: { userId },
      orderBy: { addedAt: "desc" },
    });
    return rows.map(toUserCardRecord);
  },

  async getUserCard(id: string): Promise<UserCardRecord | null> {
    const r = await prisma.userCard.findUnique({ where: { id } });
    return r ? toUserCardRecord(r) : null;
  },

  async createUserCard(input): Promise<UserCardRecord> {
    const r = await prisma.userCard.create({
      data: {
        userId: input.userId,
        cardCatalogId: input.cardCatalogId,
        nickname: input.nickname,
      },
    });
    return toUserCardRecord(r);
  },

  async deleteUserCard(id: string): Promise<void> {
    await prisma.userCard.delete({ where: { id } });
  },
};

function toUserCardRecord(r: {
  id: string;
  userId: string;
  cardCatalogId: string;
  nickname: string | null;
  addedAt: Date;
}): UserCardRecord {
  return {
    id: r.id,
    userId: r.userId,
    cardCatalogId: r.cardCatalogId,
    nickname: r.nickname,
    addedAt: r.addedAt,
  };
}
