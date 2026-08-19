/**
 * Seed script — populates card_catalog + card_reward_rules from Section 9.
 *
 * Uses the SAME researched data as lib/fixtures/cards.ts (single source of
 * truth for the reward data), so the seeded DB and the unit-tested fixtures
 * cannot drift apart.
 *
 * Each rule carries the card's source_url + last_verified_at (Section 2/3
 * versioning requirement; lastVerifiedAt = 2026-08-19).
 *
 * Run (in a networked env with Postgres + prisma generated):
 *   npm run db:seed
 *
 * NOTE: NOT executed in this sandbox (no DB / no network). Written to match the
 * Prisma schema; verify against your generated client after `prisma generate`.
 */

import { PrismaClient } from "@prisma/client";
import { catalog } from "../lib/fixtures/cards.ts";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  for (const card of catalog) {
    const created = await prisma.cardCatalog.upsert({
      where: { id: card.cardId },
      update: {
        issuer: card.issuer,
        productName: card.productName,
        network: card.network,
        sourceUrl: card.sourceUrl,
        lastVerifiedAt: new Date(card.lastVerifiedAt),
      },
      create: {
        id: card.cardId,
        issuer: card.issuer,
        productName: card.productName,
        network: card.network,
        sourceUrl: card.sourceUrl,
        lastVerifiedAt: new Date(card.lastVerifiedAt),
      },
    });

    // Replace this card's rules so re-seeding is idempotent.
    await prisma.cardRewardRule.deleteMany({ where: { cardCatalogId: created.id } });

    for (const rule of card.rules) {
      await prisma.cardRewardRule.create({
        data: {
          id: rule.id,
          cardCatalogId: created.id,
          category: rule.category,
          rate: rule.rate,
          unit: rule.unit,
          pointValueCents: rule.pointValueCents ?? null,
          capAmount: rule.capAmount ?? null,
          isRotating: rule.isRotating ?? false,
          quarter: rule.quarter ?? null,
          effectiveFrom: rule.effectiveFrom ? new Date(rule.effectiveFrom) : null,
          effectiveTo: rule.effectiveTo ? new Date(rule.effectiveTo) : null,
        },
      });
    }

    console.log(`Seeded ${card.issuer} ${card.productName} (${card.rules.length} rules)`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
