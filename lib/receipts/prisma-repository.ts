/**
 * Prisma-backed ReceiptRepository + CalculationRepository — real implementations
 * of the ports in ./types.ts. The service business logic is unit-tested with
 * in-memory fakes; these adapters map to Prisma.
 *
 * NOTE: requires a generated Prisma client + live DB. NOT runnable offline, but
 * this is real mapping code, not a stub. Prisma Decimal <-> number conversions
 * are done explicitly; amounts are dollars.
 *
 * IMPORTANT (Section 3 versioning): CalculationRepository.listByUser joins calcs
 * to their (confirmed) receipts filtered by userId, so needs_review receipts —
 * which never get a calc row — are structurally excluded from dashboard totals.
 */

import { prisma } from "../db.ts";
import type {
  ReceiptRepository,
  CalculationRepository,
  ReceiptRecord,
  ReceiptStatus,
  RewardCalculationRecord,
  RuleVersionSnapshot,
} from "./types.ts";

function toReceiptRecord(r: {
  id: string;
  userId: string;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  category: string | null;
  date: Date | null;
  totalAmount: unknown; // Prisma.Decimal | null
  ocrConfidence: number | null;
  status: string;
  userCardId: string | null;
  imageUrl: string | null;
  ocrRawText: string | null;
  createdAt: Date;
}): ReceiptRecord {
  return {
    id: r.id,
    userId: r.userId,
    merchantRaw: r.merchantRaw,
    merchantNormalized: r.merchantNormalized,
    category: r.category,
    date: r.date ? r.date.toISOString().slice(0, 10) : null,
    totalAmount: r.totalAmount == null ? null : Number(r.totalAmount),
    ocrConfidence: r.ocrConfidence,
    status: r.status as ReceiptStatus,
    userCardId: r.userCardId,
    imageUrl: r.imageUrl,
    ocrRawText: r.ocrRawText,
    createdAt: r.createdAt,
  };
}

export const prismaReceiptRepository: ReceiptRepository = {
  async create(input): Promise<ReceiptRecord> {
    const r = await prisma.receipt.create({
      data: {
        userId: input.userId,
        merchantRaw: input.merchantRaw,
        merchantNormalized: input.merchantNormalized,
        category: input.category,
        date: input.date ? new Date(input.date) : null,
        totalAmount: input.totalAmount,
        ocrConfidence: input.ocrConfidence,
        status: input.status,
        userCardId: input.userCardId,
        imageUrl: input.imageUrl,
        ocrRawText: input.ocrRawText,
      },
    });
    return toReceiptRecord(r);
  },

  async get(id): Promise<ReceiptRecord | null> {
    const r = await prisma.receipt.findUnique({ where: { id } });
    return r ? toReceiptRecord(r) : null;
  },

  async listByUser(userId, status?: ReceiptStatus): Promise<ReceiptRecord[]> {
    const rows = await prisma.receipt.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toReceiptRecord);
  },

  async update(id, patch): Promise<ReceiptRecord> {
    const r = await prisma.receipt.update({
      where: { id },
      data: {
        merchantNormalized: patch.merchantNormalized,
        category: patch.category,
        date: patch.date ? new Date(patch.date) : patch.date === null ? null : undefined,
        totalAmount: patch.totalAmount,
        userCardId: patch.userCardId,
        status: patch.status,
      },
    });
    return toReceiptRecord(r);
  },

  async delete(id): Promise<void> {
    await prisma.receipt.delete({ where: { id } });
  },
};

function toCalcRecord(r: {
  id: string;
  receiptId: string;
  actualRate: unknown;
  actualCashback: unknown;
  optimalUserCardId: string | null;
  optimalRate: unknown;
  optimalCashback: unknown;
  missedAmount: unknown;
  ruleVersionSnapshot: unknown;
  calculatedAt: Date;
}): RewardCalculationRecord {
  return {
    id: r.id,
    receiptId: r.receiptId,
    actualRate: Number(r.actualRate),
    actualCashback: Number(r.actualCashback),
    optimalUserCardId: r.optimalUserCardId,
    optimalRate: Number(r.optimalRate),
    optimalCashback: Number(r.optimalCashback),
    missedAmount: Number(r.missedAmount),
    ruleVersionSnapshot: r.ruleVersionSnapshot as RuleVersionSnapshot,
    calculatedAt: r.calculatedAt,
  };
}

export const prismaCalculationRepository: CalculationRepository = {
  async upsertForReceipt(input): Promise<RewardCalculationRecord> {
    const data = {
      actualRate: input.actualRate,
      actualCashback: input.actualCashback,
      optimalUserCardId: input.optimalUserCardId,
      optimalRate: input.optimalRate,
      optimalCashback: input.optimalCashback,
      missedAmount: input.missedAmount,
      // Stored as JSON; a frozen copy of the rules used (Section 3 anti-drift).
      ruleVersionSnapshot: input.ruleVersionSnapshot as unknown as object,
    };
    const r = await prisma.rewardCalculation.upsert({
      where: { receiptId: input.receiptId },
      update: data,
      create: { receiptId: input.receiptId, ...data },
    });
    return toCalcRecord(r);
  },

  async getByReceipt(receiptId): Promise<RewardCalculationRecord | null> {
    const r = await prisma.rewardCalculation.findUnique({ where: { receiptId } });
    return r ? toCalcRecord(r) : null;
  },

  async listByUser(userId): Promise<RewardCalculationRecord[]> {
    // Join to confirmed receipts owned by the user. needs_review receipts have
    // no calc row, so they are excluded from dashboard totals by construction.
    const rows = await prisma.rewardCalculation.findMany({
      where: { receipt: { userId, status: "confirmed" } },
      orderBy: { calculatedAt: "desc" },
    });
    return rows.map(toCalcRecord);
  },
};
