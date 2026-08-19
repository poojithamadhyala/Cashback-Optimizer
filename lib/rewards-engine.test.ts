/**
 * Rewards engine unit tests — Section 6 (non-negotiable).
 *
 * Table-driven, covering: points-vs-cashback conversion, cap boundaries,
 * rotating category not activated vs. activated, ties, and missing rules.
 *
 * Run with:  node --experimental-strip-types --test lib/rewards-engine.test.ts
 *
 * All expected cashback values are computed by hand in the comments so these
 * are genuine known input/output pairs, not snapshots of whatever the code did.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePurchase,
  type CardForEval,
  type EvaluationContext,
} from "./rewards-engine.ts";
import {
  chaseSapphirePreferred,
  amexBlueCashEveryday,
  citiDoubleCash,
  toCardForEval,
} from "./fixtures/cards.ts";

const CSP = toCardForEval(chaseSapphirePreferred);
const BCE = toCardForEval(amexBlueCashEveryday);
const CDC = toCardForEval(citiDoubleCash);

function ctx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    evaluationDate: "2026-08-19",
    currentQuarter: "2026-Q3",
    activatedRuleIds: [],
    yearToDateSpendByRuleId: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Points conversion: CSP dining 3x @ 2c/pt on $100 => 300 pts * 2c = 600c
// ---------------------------------------------------------------------------
test("points conversion: CSP dining 3x @ 2c/pt on $100 = 600c (6% effective)", () => {
  const r = evaluatePurchase({
    category: "dining",
    amount: 100,
    cards: [CSP],
    actualCardId: CSP.cardId,
    context: ctx(),
  });
  assert.equal(r.actual?.cashbackCents, 600);
  assert.equal(r.actual?.effectiveRatePct, 6);
  assert.equal(r.optimal?.cardId, CSP.cardId);
  assert.equal(r.missedCents, 0);
});

// ---------------------------------------------------------------------------
// 2. Cashback flat: Citi Double Cash 2% baseline on $50 => 100c
// ---------------------------------------------------------------------------
test("cashback flat: Citi Double Cash 2% on $50 uncategorized = 100c", () => {
  const r = evaluatePurchase({
    category: "some_unknown_category",
    amount: 50,
    cards: [CDC],
    actualCardId: CDC.cardId,
    context: ctx(),
  });
  assert.equal(r.actual?.appliedRuleId, "cdc-baseline");
  assert.equal(r.actual?.cashbackCents, 100);
});

// ---------------------------------------------------------------------------
// 3. Optimal vs actual + missed: dining $100 across all 3 cards.
//    CSP dining: 3x*2c = 600c. BCE: baseline 1% = 100c. CDC: baseline 2% = 200c.
//    Optimal = CSP 600c. If user used CDC (200c), missed = 400c.
// ---------------------------------------------------------------------------
test("optimal selection + missed delta: dining $100, user used Citi, missed 400c", () => {
  const r = evaluatePurchase({
    category: "dining",
    amount: 100,
    cards: [CSP, BCE, CDC],
    actualCardId: CDC.cardId,
    context: ctx(),
  });
  assert.equal(r.optimal?.cardId, CSP.cardId);
  assert.equal(r.optimal?.cashbackCents, 600);
  assert.equal(r.actual?.cardId, CDC.cardId);
  assert.equal(r.actual?.cashbackCents, 200);
  assert.equal(r.missedCents, 400);
  // perCard sorted best-first
  assert.deepEqual(
    r.perCard.map((c) => c.cardId),
    [CSP.cardId, CDC.cardId, BCE.cardId]
  );
});

// ---------------------------------------------------------------------------
// 4. Cap NOT yet hit: BCE supermarkets 3% on $100, $0 YTD => 300c
// ---------------------------------------------------------------------------
test("cap not hit: BCE supermarkets 3% on $100 = 300c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [BCE],
    actualCardId: BCE.cardId,
    context: ctx({ yearToDateSpendByRuleId: { "bce-supermarkets": 0 } }),
  });
  assert.equal(r.actual?.cashbackCents, 300);
});

// ---------------------------------------------------------------------------
// 5. Cap boundary spanning: BCE supermarkets, $5,900 YTD, $200 purchase.
//    Remaining cap = $100 at 3% = 300c; overflow $100 at baseline 1% = 100c.
//    Total = 400c.  (This is the exact edge case the spec calls out.)
// ---------------------------------------------------------------------------
test("cap boundary: BCE supermarkets, $5900 YTD + $200 => 300c bonus + 100c baseline = 400c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 200,
    cards: [BCE],
    actualCardId: BCE.cardId,
    context: ctx({ yearToDateSpendByRuleId: { "bce-supermarkets": 5900 } }),
  });
  assert.equal(r.actual?.cashbackCents, 400);
});

// ---------------------------------------------------------------------------
// 6. Cap fully exhausted: BCE supermarkets, $6,000 YTD, $100 purchase.
//    Remaining cap = $0; entire $100 at baseline 1% = 100c.
// ---------------------------------------------------------------------------
test("cap exhausted: BCE supermarkets, $6000 YTD + $100 => all baseline 100c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [BCE],
    actualCardId: BCE.cardId,
    context: ctx({ yearToDateSpendByRuleId: { "bce-supermarkets": 6000 } }),
  });
  assert.equal(r.actual?.cashbackCents, 100);
  assert.equal(r.actual?.appliedRuleId, "bce-baseline");
});

// ---------------------------------------------------------------------------
// 7. Rotating NOT activated: a synthetic rotating 5% grocery rule not in
//    activatedRuleIds must fall back to the card's baseline, NOT the bonus.
// ---------------------------------------------------------------------------
const rotatingCard: CardForEval = {
  cardId: "rotating-test-card",
  label: "Rotating 5% (test)",
  rules: [
    {
      id: "rot-grocery-q3",
      category: "us_supermarkets",
      rate: 5,
      unit: "cashback_pct",
      isRotating: true,
      quarter: "2026-Q3",
    },
    { id: "rot-baseline", category: "*", rate: 1, unit: "cashback_pct" },
  ],
};

test("rotating not activated: 5% grocery rule ignored -> baseline 1% on $100 = 100c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [rotatingCard],
    actualCardId: rotatingCard.cardId,
    context: ctx({ activatedRuleIds: [] }),
  });
  assert.equal(r.actual?.appliedRuleId, "rot-baseline");
  assert.equal(r.actual?.cashbackCents, 100);
});

test("rotating activated: same rule now applies -> 5% on $100 = 500c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [rotatingCard],
    actualCardId: rotatingCard.cardId,
    context: ctx({ activatedRuleIds: ["rot-grocery-q3"] }),
  });
  assert.equal(r.actual?.appliedRuleId, "rot-grocery-q3");
  assert.equal(r.actual?.cashbackCents, 500);
});

test("rotating activated but wrong quarter: rule ignored -> baseline", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [rotatingCard],
    actualCardId: rotatingCard.cardId,
    context: ctx({ activatedRuleIds: ["rot-grocery-q3"], currentQuarter: "2026-Q4" }),
  });
  assert.equal(r.actual?.appliedRuleId, "rot-baseline");
  assert.equal(r.actual?.cashbackCents, 100);
});

// ---------------------------------------------------------------------------
// 8. Ties: two cards yield identical cashback. Optimal must be deterministic
//    (tie-broken by cardId ascending) and missed must be 0 if user used either.
//    Build two cards both giving 2% on $100 => 200c each.
// ---------------------------------------------------------------------------
const tieCardA: CardForEval = {
  cardId: "aaa-tie-card",
  rules: [{ id: "a-base", category: "*", rate: 2, unit: "cashback_pct" }],
};
const tieCardB: CardForEval = {
  cardId: "bbb-tie-card",
  rules: [{ id: "b-base", category: "*", rate: 2, unit: "cashback_pct" }],
};

test("tie: two 2% cards on $100 both 200c; optimal deterministic by cardId; missed 0", () => {
  const r = evaluatePurchase({
    category: "whatever",
    amount: 100,
    cards: [tieCardB, tieCardA], // deliberately reversed input order
    actualCardId: tieCardB.cardId,
    context: ctx(),
  });
  assert.equal(r.perCard[0].cashbackCents, 200);
  assert.equal(r.perCard[1].cashbackCents, 200);
  // deterministic tie-break: "aaa-tie-card" < "bbb-tie-card"
  assert.equal(r.optimal?.cardId, "aaa-tie-card");
  // user used the (tied) other card, so nothing was actually missed
  assert.equal(r.missedCents, 0);
});

// ---------------------------------------------------------------------------
// 9. Missing rules: a card with NO applicable rule (no baseline, category miss)
//    yields no result and is excluded from perCard.
// ---------------------------------------------------------------------------
const noBaselineCard: CardForEval = {
  cardId: "no-baseline-card",
  rules: [{ id: "nb-dining", category: "dining", rate: 4, unit: "cashback_pct" }],
};

test("missing rules: card with no applicable rule is excluded from results", () => {
  const r = evaluatePurchase({
    category: "gas_ev_charging", // no matching rule, no baseline
    amount: 100,
    cards: [noBaselineCard],
    actualCardId: noBaselineCard.cardId,
    context: ctx(),
  });
  assert.equal(r.perCard.length, 0);
  assert.equal(r.actual, undefined);
  assert.equal(r.optimal, undefined);
  assert.equal(r.missedCents, 0);
});

// ---------------------------------------------------------------------------
// 10. Effective window fallback: CSP Lyft promo has effectiveTo 2027-09-30.
//     Evaluated AFTER expiry, the 5x Lyft bonus must NOT apply; CSP falls back
//     to its 1x baseline (2c effective). This is the exact bug-class the summary
//     mentioned: outside a bonus window the engine falls back to baseline, it
//     does not return "no rule".
//     Lyft $100 after expiry: baseline 1x*2c = 200c (2%).
// ---------------------------------------------------------------------------
test("effective window: expired CSP Lyft promo falls back to baseline (not no-rule)", () => {
  const r = evaluatePurchase({
    category: "rideshare_lyft",
    amount: 100,
    cards: [CSP],
    actualCardId: CSP.cardId,
    context: ctx({ evaluationDate: "2027-10-01" }), // day after promo ends
  });
  assert.equal(r.actual?.appliedRuleId, "csp-baseline");
  assert.equal(r.actual?.cashbackCents, 200);
});

test("effective window: during CSP Lyft promo, 5x applies -> $100 = 1000c", () => {
  const r = evaluatePurchase({
    category: "rideshare_lyft",
    amount: 100,
    cards: [CSP],
    actualCardId: CSP.cardId,
    context: ctx({ evaluationDate: "2026-08-19" }),
  });
  assert.equal(r.actual?.appliedRuleId, "csp-lyft");
  assert.equal(r.actual?.cashbackCents, 1000);
});

// ---------------------------------------------------------------------------
// 11. Full three-card optimal on supermarkets:
//     CSP: no supermarket rule -> baseline 1x*2c = 200c.
//     BCE: 3% = 300c. CDC: baseline 2% = 200c. Optimal = BCE 300c.
// ---------------------------------------------------------------------------
test("three-card supermarkets $100: optimal is Amex BCE at 300c", () => {
  const r = evaluatePurchase({
    category: "us_supermarkets",
    amount: 100,
    cards: [CSP, BCE, CDC],
    actualCardId: CSP.cardId,
    context: ctx(),
  });
  assert.equal(r.optimal?.cardId, BCE.cardId);
  assert.equal(r.optimal?.cashbackCents, 300);
  assert.equal(r.actual?.cardId, CSP.cardId);
  assert.equal(r.actual?.cashbackCents, 200);
  assert.equal(r.missedCents, 100);
});

// ---------------------------------------------------------------------------
// 12. Rounding determinism: $33.33 at CDC 2% = 3333c * 2% = 66.66c -> 67c.
// ---------------------------------------------------------------------------
test("rounding: $33.33 at 2% -> 67c (deterministic half-up via Math.round)", () => {
  const r = evaluatePurchase({
    category: "x",
    amount: 33.33,
    cards: [CDC],
    actualCardId: CDC.cardId,
    context: ctx(),
  });
  assert.equal(r.actual?.cashbackCents, 67);
});
