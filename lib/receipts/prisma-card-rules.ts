/**
 * Prisma-backed UserCardRulesProvider — supplies a user's saved cards with their
 * CURRENT catalog rules, mapped to the rewards engine's RewardRule shape.
 *
 * The receipt service snapshots these by value before storing a calculation, so
 * the fact that this returns live/current rules is exactly what the versioning
 * test guards against leaking into stored history.
 *
 * NOTE: requires a generated Prisma client + live DB; not runnable offline.
 */

import { prisma } from "../db.ts";
import type { UserCardRulesProvider, SnapshotCard } from "./types.ts";
import type { RewardRule, RewardUnit } from "../rewards-engine.ts";

export const prismaUserCardRulesProvider: UserCardRulesProvider = {
  async getEvaluableCards(userId: string): Promise<SnapshotCard[]> {
    const userCards = await prisma.userCard.findMany({
      where: { userId },
      include: {
        cardCatalog: { include: { rewardRules: true } },
      },
    });

    return userCards.map((uc) => {
      const rules: RewardRule[] = uc.cardCatalog.rewardRules.map((rr) => ({
        id: rr.id,
        category: rr.category,
        rate: Number(rr.rate),
        unit: rr.unit as RewardUnit,
        pointValueCents: rr.pointValueCents ?? undefined,
        capAmount: rr.capAmount == null ? null : Number(rr.capAmount),
        isRotating: rr.isRotating,
        quarter: rr.quarter ?? null,
        effectiveFrom: rr.effectiveFrom ? rr.effectiveFrom.toISOString().slice(0, 10) : null,
        effectiveTo: rr.effectiveTo ? rr.effectiveTo.toISOString().slice(0, 10) : null,
      }));

      return {
        cardId: uc.id, // user_card_id is what results reference
        cardCatalogId: uc.cardCatalogId,
        label: uc.nickname ?? `${uc.cardCatalog.issuer} ${uc.cardCatalog.productName}`,
        rules,
      };
    });
  },
};
