/**
 * Serializer tests — proves toCalculationDTO strips the internal
 * ruleVersionSnapshot and matches RewardCalculationDTO exactly.
 * Run: node --experimental-strip-types --test lib/api/serializers.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCalculationDTO } from "./serializers.ts";
import type { RewardCalculationRecord } from "../receipts/types.ts";

const record: RewardCalculationRecord = {
  id: "calc-1",
  receiptId: "r-1",
  actualRate: 2,
  actualCashback: 2,
  optimalUserCardId: "uc-amex",
  optimalRate: 3,
  optimalCashback: 3,
  missedAmount: 1,
  calculatedAt: new Date("2026-08-19T12:00:00Z"),
  ruleVersionSnapshot: {
    takenAt: "2026-08-19T12:00:00.000Z",
    category: "us_supermarkets",
    amount: 100,
    evaluationDate: "2026-08-10",
    currentQuarter: "2026-Q3",
    activatedRuleIds: [],
    cards: [
      { cardId: "uc-amex", cardCatalogId: "bce", label: "Amex BCE", rules: [] },
    ],
  },
};

test("toCalculationDTO omits ruleVersionSnapshot (no internal audit leak)", () => {
  const dto = toCalculationDTO(record);
  assert.equal("ruleVersionSnapshot" in dto, false);
});

test("toCalculationDTO serializes calculatedAt to an ISO string", () => {
  const dto = toCalculationDTO(record);
  assert.equal(typeof dto.calculatedAt, "string");
  assert.equal(dto.calculatedAt, "2026-08-19T12:00:00.000Z");
});

test("toCalculationDTO carries all declared DTO fields with correct values", () => {
  const dto = toCalculationDTO(record);
  assert.deepEqual(dto, {
    id: "calc-1",
    receiptId: "r-1",
    actualRate: 2,
    actualCashback: 2,
    optimalUserCardId: "uc-amex",
    optimalRate: 3,
    optimalCashback: 3,
    missedAmount: 1,
    calculatedAt: "2026-08-19T12:00:00.000Z",
  });
});

test("DTO key set exactly matches the RewardCalculationDTO contract", () => {
  const dto = toCalculationDTO(record);
  assert.deepEqual(
    Object.keys(dto).sort(),
    [
      "actualCashback",
      "actualRate",
      "calculatedAt",
      "id",
      "missedAmount",
      "optimalCashback",
      "optimalRate",
      "optimalUserCardId",
      "receiptId",
    ]
  );
});
