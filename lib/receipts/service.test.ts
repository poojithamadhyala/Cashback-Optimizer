/**
 * Receipt service tests — Section 2 (Receipt Upload & OCR, Rewards Calculation),
 * Section 4.3 (engine wiring), Section 6 (data versioning + OCR threshold).
 *
 * Run: node --experimental-strip-types --test lib/receipts/service.test.ts
 *
 * Includes the two tests explicitly required for this layer:
 *  (A) low OCR confidence -> needs_review -> excluded from dashboard totals
 *  (B) ADVERSARIAL versioning: confirm a receipt, then mutate the card rule's
 *      rate, and assert the previously-stored calculation is UNCHANGED.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  uploadReceipt,
  confirmReceipt,
  getReceipt,
  deleteReceipt,
  type ReceiptServiceDeps,
} from "./service.ts";
import { getSummary } from "../dashboard/service.ts";
import {
  makeReceiptRepo,
  makeCalcRepo,
  MutableCardRulesProvider,
} from "./test-fakes.ts";
import { MockOcrProvider } from "../ocr/mock-provider.ts";
import type { OcrResult } from "../ocr/types.ts";
import type { SnapshotCard } from "./types.ts";
import { AppError } from "../errors.ts";

const alice = { userId: "alice", email: "alice@x.com" };
const bob = { userId: "bob", email: "bob@x.com" };
const FIXED_NOW = () => new Date("2026-08-19T12:00:00Z");
const IMG = new Uint8Array([1, 2, 3]);

// Two saved cards for Alice: a 3% supermarket card and a flat 2% card.
function aliceCards(): SnapshotCard[] {
  return [
    {
      cardId: "uc-amex",
      cardCatalogId: "bce",
      label: "Amex Blue Cash Everyday",
      rules: [
        { id: "bce-supermarkets", category: "us_supermarkets", rate: 3, unit: "cashback_pct", capAmount: 6000 },
        { id: "bce-baseline", category: "*", rate: 1, unit: "cashback_pct" },
      ],
    },
    {
      cardId: "uc-citi",
      cardCatalogId: "cdc",
      label: "Citi Double Cash",
      rules: [{ id: "cdc-baseline", category: "*", rate: 2, unit: "cashback_pct" }],
    },
  ];
}

function makeDeps(overrides: {
  ocr?: OcrResult;
  threshold?: number;
  cards?: MutableCardRulesProvider;
} = {}): ReceiptServiceDeps & { _cards: MutableCardRulesProvider } {
  const cards = overrides.cards ?? new MutableCardRulesProvider({ alice: aliceCards() });
  return {
    receipts: makeReceiptRepo(),
    calcs: makeCalcRepo(),
    cardRules: cards,
    ocr: new MockOcrProvider(overrides.ocr),
    confidenceThreshold: overrides.threshold ?? 0.8,
    now: FIXED_NOW,
    currentQuarter: "2026-Q3",
    activatedRuleIds: [],
    _cards: cards,
  };
}

// ---------------------------------------------------------------------------
// Upload / routing
// ---------------------------------------------------------------------------

test("upload with high confidence + all fields => confirmed status, category pre-filled", async () => {
  const deps = makeDeps({
    ocr: {
      merchantRaw: "TRADER JOE'S #55",
      date: "2026-08-10",
      total: 40,
      confidence: 0.97,
      rawText: "...",
    },
  });
  const r = await uploadReceipt(deps, alice, IMG, "image/jpeg", "s3://img");
  assert.equal(r.status, "confirmed");
  assert.equal(r.category, "us_supermarkets"); // categorizer resolved it
  assert.equal(r.ocrConfidence, 0.97);
});

test("(A) low OCR confidence => needs_review, and is EXCLUDED from dashboard totals", async () => {
  const deps = makeDeps({
    threshold: 0.8,
    ocr: {
      merchantRaw: "TRADER JOE'S #55",
      date: "2026-08-10",
      total: 40,
      confidence: 0.42, // below threshold
      rawText: "...",
    },
  });
  const r = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  assert.equal(r.status, "needs_review");

  // No calculation should exist for a needs_review receipt.
  assert.equal(await deps.calcs.getByReceipt(r.id), null);

  // Dashboard totals must NOT include it (structurally: no calc row).
  const summary = await getSummary(deps.calcs, alice);
  assert.equal(summary.receiptCount, 0);
  assert.equal(summary.totalMissed, 0);
  assert.equal(summary.totalActualCashback, 0);
});

test("upload with unknown merchant => category null (Uncategorized, no guess)", async () => {
  const deps = makeDeps({
    ocr: {
      merchantRaw: "OBSCURE CORNER STORE",
      date: "2026-08-10",
      total: 12,
      confidence: 0.99,
      rawText: "...",
    },
  });
  const r = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  assert.equal(r.category, null);
});

// ---------------------------------------------------------------------------
// Confirm / engine wiring
// ---------------------------------------------------------------------------

test("confirm runs the engine correctly: $100 supermarkets, used Citi(2%) -> missed $1 vs Amex(3%)", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.99, rawText: "" },
  });
  const uploaded = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);

  const { receipt, calculation } = await confirmReceipt(deps, alice, uploaded.id, {
    userCardId: "uc-citi", // user used the 2% card
  });

  assert.equal(receipt.status, "confirmed");
  // Amex 3% of $100 = $3 optimal; Citi 2% = $2 actual; missed $1.
  assert.equal(calculation.optimalUserCardId, "uc-amex");
  assert.equal(calculation.optimalCashback, 3);
  assert.equal(calculation.actualCashback, 2);
  assert.equal(calculation.missedAmount, 1);

  // Now it DOES count toward the dashboard.
  const summary = await getSummary(deps.calcs, alice);
  assert.equal(summary.receiptCount, 1);
  assert.equal(summary.totalMissed, 1);
  assert.equal(summary.byCategory[0].category, "us_supermarkets");
});

test("confirm requires fields for money math: uncategorized receipt cannot be confirmed", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "OBSCURE STORE", date: "2026-08-10", total: 30, confidence: 0.99, rawText: "" },
  });
  const uploaded = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  // category is null and no userCardId provided -> validation error
  await assert.rejects(
    () => confirmReceipt(deps, alice, uploaded.id, {}),
    (e: unknown) => e instanceof AppError && e.kind === "validation"
  );
});

test("confirm requires the user to say which card was used", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 50, confidence: 0.99, rawText: "" },
  });
  const uploaded = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  await assert.rejects(
    () => confirmReceipt(deps, alice, uploaded.id, { category: "us_supermarkets" }),
    (e: unknown) => e instanceof AppError && e.kind === "validation"
  );
});

// ---------------------------------------------------------------------------
// (B) ADVERSARIAL rule-versioning test — the important one (Section 6)
// ---------------------------------------------------------------------------

test("(B) editing a card rule AFTER confirmation does NOT change the stored calculation", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 100, confidence: 0.99, rawText: "" },
  });
  const uploaded = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);

  // Confirm: Amex supermarket rule is 3% at this moment.
  const { calculation: original } = await confirmReceipt(deps, alice, uploaded.id, {
    userCardId: "uc-amex",
  });
  assert.equal(original.actualCashback, 3); // 3% of $100
  assert.equal(original.optimalCashback, 3);
  assert.equal(original.missedAmount, 0);

  // Capture a full snapshot of the stored calc BEFORE mutation.
  const before = await deps.calcs.getByReceipt(uploaded.id);
  const beforeJson = JSON.stringify(before);

  // ADVERSARIAL MUTATION: change the live Amex supermarket rate from 3% -> 5%.
  deps._cards.mutateRuleRate("alice", "bce-supermarkets", 5);

  // Sanity: the live rules really did change.
  const liveNow = await deps._cards.getEvaluableCards("alice");
  const liveRate = liveNow[0].rules.find((r) => r.id === "bce-supermarkets")?.rate;
  assert.equal(liveRate, 5);

  // Re-fetch the ORIGINAL stored calculation. It must be byte-for-byte identical.
  const after = await deps.calcs.getByReceipt(uploaded.id);
  assert.equal(JSON.stringify(after), beforeJson);

  // Explicit field-level assertions (not just "snapshot exists"):
  assert.equal(after?.actualCashback, 3); // still 3%, NOT recomputed to 5%
  assert.equal(after?.optimalCashback, 3);
  assert.equal(after?.missedAmount, 0);
  // The snapshot preserved the OLD rate of 3, independent of the live 5.
  const snapRate = after?.ruleVersionSnapshot.cards
    .find((c) => c.cardId === "uc-amex")
    ?.rules.find((r) => r.id === "bce-supermarkets")?.rate;
  assert.equal(snapRate, 3);

  // And the dashboard, which reads calcs, still reflects the original numbers.
  const summary = await getSummary(deps.calcs, alice);
  assert.equal(summary.totalActualCashback, 3);
  assert.equal(summary.totalMissed, 0);
});

// ---------------------------------------------------------------------------
// Ownership / isolation
// ---------------------------------------------------------------------------

test("cross-user access: Bob cannot GET Alice's receipt (403)", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 10, confidence: 0.99, rawText: "" },
  });
  const alices = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  await assert.rejects(
    () => getReceipt(deps, bob, alices.id),
    (e: unknown) => e instanceof AppError && e.kind === "forbidden"
  );
});

test("cross-user access: Bob cannot confirm or delete Alice's receipt (403)", async () => {
  const deps = makeDeps({
    ocr: { merchantRaw: "TRADER JOE'S", date: "2026-08-10", total: 10, confidence: 0.99, rawText: "" },
  });
  const alices = await uploadReceipt(deps, alice, IMG, "image/jpeg", null);
  await assert.rejects(
    () => confirmReceipt(deps, bob, alices.id, { userCardId: "uc-amex" }),
    (e: unknown) => e instanceof AppError && e.kind === "forbidden"
  );
  await assert.rejects(
    () => deleteReceipt(deps, bob, alices.id),
    (e: unknown) => e instanceof AppError && e.kind === "forbidden"
  );
});

test("get nonexistent receipt => 404", async () => {
  const deps = makeDeps();
  await assert.rejects(
    () => getReceipt(deps, alice, "r-does-not-exist"),
    (e: unknown) => e instanceof AppError && e.kind === "not_found"
  );
});
