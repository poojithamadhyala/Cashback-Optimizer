/**
 * POSTGRES/PRISMA INTEGRATION TESTS — the real production adapters.
 *
 * ⚠️ NOT RUN IN THE BUILD SANDBOX. This sandbox has no Postgres, no npm to
 * install @prisma/client, and no container registry access to pull a postgres
 * image (all verified). These tests are written to run in a NETWORKED
 * environment (locally via docker-compose, or in CI — see
 * .github/workflows/integration.yml). They mirror the SQLite integration tests
 * in lib/receipts/sqlite-integration.test.ts, but exercise the ACTUAL Prisma
 * adapters (lib/receipts/prisma-repository.ts + prisma-card-rules.ts) against a
 * real Postgres, which is the production data path.
 *
 * Prerequisites (handled by scripts/run-integration.sh and the CI workflow):
 *   1. A Postgres reachable at $DATABASE_URL
 *   2. `prisma generate` + `prisma migrate deploy` (or `db push`) applied
 *   3. `npm install` so @prisma/client + @types/node exist
 *
 * Run: node --experimental-strip-types --test integration/pg/receipts.pgtest.ts
 * (typically via `npm run test:integration`)
 */

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import {
  prismaReceiptRepository,
  prismaCalculationRepository,
} from "../../lib/receipts/prisma-repository.ts";
import { prismaUserCardRulesProvider } from "../../lib/receipts/prisma-card-rules.ts";
import { uploadReceipt, confirmReceipt, type ReceiptServiceDeps } from "../../lib/receipts/service.ts";
import { getSummary } from "../../lib/dashboard/service.ts";
import { MockOcrProvider } from "../../lib/ocr/mock-provider.ts";

const prisma = new PrismaClient();
const IMG = new Uint8Array([1, 2, 3]);

let userId: string;
let userCardId: string;
let alice: { userId: string; email: string };

before(async () => {
  await prisma.$connect();
});

after(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean slate each test. Order respects FKs.
  await prisma.rewardCalculation.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.userCard.deleteMany();
  await prisma.cardRewardRule.deleteMany();
  await prisma.cardCatalog.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: `alice+${Date.now()}@x.com`, passwordHash: "scrypt$placeholder" },
  });
  userId = user.id;
  alice = { userId, email: user.email };

  // Seed one catalog card "Amex BCE" with a 3% supermarket rule + 1% baseline.
  const catalog = await prisma.cardCatalog.create({
    data: {
      issuer: "American Express",
      productName: "Blue Cash Everyday",
      network: "Amex",
      sourceUrl: "https://example.test",
      lastVerifiedAt: new Date("2026-08-19"),
      rewardRules: {
        create: [
          { id: "bce-supermarkets", category: "us_supermarkets", rate: 3, unit: "cashback_pct" },
          { id: "bce-baseline", category: "*", rate: 1, unit: "cashback_pct" },
        ],
      },
    },
  });

  const uc = await prisma.userCard.create({
    data: { userId, cardCatalogId: catalog.id, nickname: "Groceries" },
  });
  userCardId = uc.id;
});

function deps(ocr?: Partial<import("../../lib/ocr/types.ts").OcrResult>, threshold = 0.8): ReceiptServiceDeps {
  return {
    receipts: prismaReceiptRepository,
    calcs: prismaCalculationRepository,
    cardRules: prismaUserCardRulesProvider,
    ocr: new MockOcrProvider(ocr),
    confidenceThreshold: threshold,
    now: () => new Date("2026-08-19T12:00:00Z"),
    currentQuarter: "2026-Q3",
    activatedRuleIds: [],
  };
}

// (1) needs_review -> no calc row -> excluded from dashboard totals (real PG).
test("[pg] low-confidence receipt is needs_review and excluded from dashboard totals", async () => {
  const d = deps({ merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.3, rawText: "x" });
  const r = await uploadReceipt(d, alice, IMG, "image/jpeg", "local://img.jpg");
  assert.equal(r.status, "needs_review");

  const calcCount = await prisma.rewardCalculation.count();
  assert.equal(calcCount, 0);

  const summary = await getSummary(prismaCalculationRepository, alice);
  assert.equal(summary.receiptCount, 0);
  assert.equal(summary.totalMissed, 0);
});

// (2) ADVERSARIAL snapshot immutability vs a real Postgres UPDATE.
test("[pg] editing the rule row after confirm does NOT change the stored calc", async () => {
  const d = deps({ merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.99, rawText: "x" });
  const uploaded = await uploadReceipt(d, alice, IMG, "image/jpeg", "local://img.jpg");
  const { calculation } = await confirmReceipt(d, alice, uploaded.id, { userCardId });

  assert.equal(Number(calculation.actualCashback), 3);
  assert.equal(Number(calculation.missedAmount), 0);

  const before = await prisma.rewardCalculation.findUniqueOrThrow({ where: { receiptId: uploaded.id } });
  const beforeJson = JSON.stringify(before.ruleVersionSnapshot);

  // ADVERSARIAL: mutate the underlying catalog rule 3% -> 5% in Postgres.
  await prisma.cardRewardRule.update({ where: { id: "bce-supermarkets" }, data: { rate: 5 } });
  const live = await prisma.cardRewardRule.findUniqueOrThrow({ where: { id: "bce-supermarkets" } });
  assert.equal(Number(live.rate), 5);

  // Re-fetch the stored calc: snapshot + numbers must be unchanged.
  const after = await prisma.rewardCalculation.findUniqueOrThrow({ where: { receiptId: uploaded.id } });
  assert.equal(JSON.stringify(after.ruleVersionSnapshot), beforeJson);
  assert.equal(Number(after.actualCashback), 3);
  assert.equal(Number(after.optimalCashback), 3);

  const summary = await getSummary(prismaCalculationRepository, alice);
  assert.equal(summary.totalActualCashback, 3);
  assert.equal(summary.totalMissed, 0);
});
