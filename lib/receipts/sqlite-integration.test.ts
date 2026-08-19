/**
 * DB-BACKED INTEGRATION TESTS — real SQL persistence via node:sqlite.
 *
 * These drive the actual receipt/dashboard services through SQLite-backed
 * repositories against a real on-disk database file (not in-memory fakes).
 *
 * ⚠️ This is SQLite, not Postgres. It proves the service CONTRACTS against a
 * genuine SQL engine that runs offline in this sandbox. The equivalent
 * Postgres/Prisma integration tests are in integration/pg/ and run in CI.
 *
 * Run: node --experimental-sqlite --experimental-strip-types \
 *        --test lib/receipts/sqlite-integration.test.ts
 *
 * Covers the two paths explicitly requested, hitting the real DB:
 *  (1) needs_review receipt -> NO calc row -> excluded from dashboard totals
 *  (2) confirm -> calc persisted -> UPDATE the rule's rate in the DB ->
 *      re-query the stored calc -> assert UNCHANGED (snapshot immutability)
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSchema,
  makeSqliteReceiptRepository,
  makeSqliteCalculationRepository,
} from "./sqlite-repository.ts";
import { uploadReceipt, confirmReceipt, type ReceiptServiceDeps } from "./service.ts";
import { getSummary } from "../dashboard/service.ts";
import { MockOcrProvider } from "../ocr/mock-provider.ts";
import type { UserCardRulesProvider, SnapshotCard } from "./types.ts";

const alice = { userId: "alice", email: "alice@x.com" };
const IMG = new Uint8Array([1, 2, 3]);

let dir: string;
let dbPath: string;
let db: DatabaseSync;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pgless-int-"));
  dbPath = join(dir, "test.db");
  db = new DatabaseSync(dbPath);
  createSchema(db);
});

afterEach(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

/**
 * A card-rules provider backed by the REAL card_reward_rules table. It reads the
 * current rows from SQL every call — so if a test UPDATEs a rule's rate, this
 * provider will return the new rate. The service is responsible for snapshotting
 * by value at confirm time; this test proves that snapshot survives a later
 * UPDATE to the underlying row.
 */
function dbCardRulesProvider(database: DatabaseSync): UserCardRulesProvider {
  return {
    async getEvaluableCards(_userId: string): Promise<SnapshotCard[]> {
      const rules = database.prepare(`SELECT * FROM card_reward_rules`).all() as Record<string, unknown>[];
      // Group by card_catalog_id into a single evaluable card per catalog id.
      const byCard = new Map<string, SnapshotCard>();
      for (const r of rules) {
        const catId = r.card_catalog_id as string;
        if (!byCard.has(catId)) {
          byCard.set(catId, {
            cardId: `uc-${catId}`,
            cardCatalogId: catId,
            label: catId,
            rules: [],
          });
        }
        byCard.get(catId)!.rules.push({
          id: r.id as string,
          category: r.category as string,
          rate: Number(r.rate),
          unit: r.unit as "cashback_pct" | "points_per_dollar",
          pointValueCents: r.point_value_cents == null ? undefined : Number(r.point_value_cents),
          capAmount: r.cap_amount == null ? null : Number(r.cap_amount),
          isRotating: Boolean(r.is_rotating),
          quarter: (r.quarter as string) ?? null,
          effectiveFrom: (r.effective_from as string) ?? null,
          effectiveTo: (r.effective_to as string) ?? null,
        });
      }
      return [...byCard.values()];
    },
  };
}

function seedAmexRule(database: DatabaseSync, rate: number): void {
  // One catalog card "bce" with a supermarket rule at `rate`% + 1% baseline.
  database.prepare(
    `INSERT INTO card_reward_rules (id,card_catalog_id,category,rate,unit,is_rotating) VALUES (?,?,?,?,?,0)`
  ).run("bce-supermarkets", "bce", "us_supermarkets", rate, "cashback_pct");
  database.prepare(
    `INSERT INTO card_reward_rules (id,card_catalog_id,category,rate,unit,is_rotating) VALUES (?,?,?,?,?,0)`
  ).run("bce-baseline", "bce", "*", 1, "cashback_pct");
}

function deps(overrides: { ocr?: Partial<import("../ocr/types.ts").OcrResult>; threshold?: number } = {}): ReceiptServiceDeps {
  return {
    receipts: makeSqliteReceiptRepository(db),
    calcs: makeSqliteCalculationRepository(db),
    cardRules: dbCardRulesProvider(db),
    ocr: new MockOcrProvider(overrides.ocr),
    confidenceThreshold: overrides.threshold ?? 0.8,
    now: () => new Date("2026-08-19T12:00:00Z"),
    currentQuarter: "2026-Q3",
    activatedRuleIds: [],
  };
}

// ---------------------------------------------------------------------------
// (1) needs_review -> no calc row -> excluded from dashboard totals (REAL DB)
// ---------------------------------------------------------------------------
test("[sqlite] low-confidence receipt is needs_review and excluded from dashboard totals", async () => {
  seedAmexRule(db, 3);
  const d = deps({
    threshold: 0.8,
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.3, rawText: "x" },
  });

  const r = await uploadReceipt(d, alice, IMG, "image/jpeg", "local://img.jpg");
  assert.equal(r.status, "needs_review");

  // Assert directly against the DB: the receipt row exists...
  const receiptRows = db.prepare(`SELECT COUNT(*) AS n FROM receipts WHERE status='needs_review'`).get() as { n: number };
  assert.equal(receiptRows.n, 1);
  // ...but there is NO reward_calculations row for it.
  const calcRows = db.prepare(`SELECT COUNT(*) AS n FROM reward_calculations`).get() as { n: number };
  assert.equal(calcRows.n, 0);

  // And the dashboard summary (real SQL JOIN, confirmed-only) shows zero.
  const summary = await getSummary(d.calcs, alice);
  assert.equal(summary.receiptCount, 0);
  assert.equal(summary.totalMissed, 0);
});

// ---------------------------------------------------------------------------
// (2) ADVERSARIAL snapshot immutability against a REAL DB UPDATE
// ---------------------------------------------------------------------------
test("[sqlite] editing the rule row in the DB after confirm does NOT change the stored calc", async () => {
  seedAmexRule(db, 3); // Amex supermarket rule starts at 3%
  const d = deps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.99, rawText: "x" },
  });

  const uploaded = await uploadReceipt(d, alice, IMG, "image/jpeg", "local://img.jpg");
  const { calculation } = await confirmReceipt(d, alice, uploaded.id, { userCardId: "uc-bce" });

  // At 3%, $100 supermarket => $3 actual/optimal, $0 missed.
  assert.equal(calculation.actualCashback, 3);
  assert.equal(calculation.missedAmount, 0);

  // Snapshot the stored calc row (as JSON) straight from the DB, before mutation.
  const beforeRow = db.prepare(`SELECT * FROM reward_calculations WHERE receipt_id=?`).get(uploaded.id) as Record<string, unknown>;
  const beforeJson = JSON.stringify(beforeRow);

  // ADVERSARIAL: mutate the underlying rule row in the DB, 3% -> 5%.
  db.prepare(`UPDATE card_reward_rules SET rate=5 WHERE id='bce-supermarkets'`).run();
  // Confirm the live table really changed.
  const liveRate = (db.prepare(`SELECT rate FROM card_reward_rules WHERE id='bce-supermarkets'`).get() as { rate: number }).rate;
  assert.equal(liveRate, 5);

  // Re-query the SAME stored calc row. It must be byte-for-byte unchanged.
  const afterRow = db.prepare(`SELECT * FROM reward_calculations WHERE receipt_id=?`).get(uploaded.id) as Record<string, unknown>;
  assert.equal(JSON.stringify(afterRow), beforeJson);

  // Field-level: stored cashback still reflects 3%, NOT the new 5%.
  const afterCalc = await d.calcs.getByReceipt(uploaded.id);
  assert.equal(afterCalc?.actualCashback, 3);
  assert.equal(afterCalc?.optimalCashback, 3);
  // The JSON snapshot column preserved the OLD rate of 3.
  const snapRate = afterCalc?.ruleVersionSnapshot.cards
    .find((c) => c.cardId === "uc-bce")
    ?.rules.find((rule) => rule.id === "bce-supermarkets")?.rate;
  assert.equal(snapRate, 3);

  // Dashboard, reading calcs via real SQL JOIN, still reports the original $3 / $0 missed.
  const summary = await getSummary(d.calcs, alice);
  assert.equal(summary.totalActualCashback, 3);
  assert.equal(summary.totalMissed, 0);
});

// A confirmed receipt DOES show up (sanity that exclusion is about status, not a bug).
test("[sqlite] confirmed receipt contributes to dashboard totals", async () => {
  seedAmexRule(db, 3);
  const d = deps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.99, rawText: "x" },
  });
  const up = await uploadReceipt(d, alice, IMG, "image/jpeg", "local://i.jpg");
  await confirmReceipt(d, alice, up.id, { userCardId: "uc-bce" });
  const summary = await getSummary(d.calcs, alice);
  assert.equal(summary.receiptCount, 1);
  assert.equal(summary.byCategory[0].category, "us_supermarkets");
});
