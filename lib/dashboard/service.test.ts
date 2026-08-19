/**
 * Dashboard tests — Section 2 (Dashboard). Best-card cheatsheet uses the
 * rewards engine; summary aggregates confirmed-receipt calcs only.
 * Run: node --experimental-strip-types --test lib/dashboard/service.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getBestCardCheatsheet } from "./service.ts";
import { MutableCardRulesProvider } from "../receipts/test-fakes.ts";
import type { SnapshotCard } from "../receipts/types.ts";

const alice = { userId: "alice", email: "alice@x.com" };

function cards(): SnapshotCard[] {
  return [
    {
      cardId: "uc-amex",
      cardCatalogId: "bce",
      label: "Amex BCE",
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

test("cheatsheet: supermarkets -> Amex (3%); dining -> Citi (2% baseline beats Amex 1%)", async () => {
  const provider = new MutableCardRulesProvider({ alice: cards() });
  const rows = await getBestCardCheatsheet(
    provider,
    alice,
    ["us_supermarkets", "dining"],
    { evaluationDate: "2026-08-19", currentQuarter: "2026-Q3" }
  );

  const sup = rows.find((r) => r.category === "us_supermarkets");
  assert.equal(sup?.bestCardId, "uc-amex");
  assert.equal(sup?.effectiveRatePct, 3);

  const dining = rows.find((r) => r.category === "dining");
  // Amex has only 1% baseline for dining; Citi 2% baseline wins.
  assert.equal(dining?.bestCardId, "uc-citi");
  assert.equal(dining?.effectiveRatePct, 2);
});

test("cheatsheet: user with no cards -> null best card", async () => {
  const provider = new MutableCardRulesProvider({ alice: [] });
  const rows = await getBestCardCheatsheet(provider, alice, ["dining"], {
    evaluationDate: "2026-08-19",
    currentQuarter: "2026-Q3",
  });
  assert.equal(rows[0].bestCardId, null);
  assert.equal(rows[0].effectiveRatePct, 0);
});
