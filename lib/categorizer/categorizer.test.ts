/**
 * Categorizer tests — Section 4.2 / Section 2: unknown merchants must fall back
 * to Uncategorized (category null, resolved false), never a silent guess.
 *
 * Run:  node --experimental-strip-types --test lib/categorizer/categorizer.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { categorize, normalizeMerchant } from "./categorizer.ts";

test("normalizes merchant: strips store number, collapses whitespace, uppercases", () => {
  assert.equal(normalizeMerchant("Trader Joe's  #123"), "TRADER JOE'S");
});

test("known merchant resolves to canonical category", () => {
  const r = categorize("TRADER JOE'S #452");
  assert.equal(r.resolved, true);
  assert.equal(r.category, "us_supermarkets");
});

test("Lyft resolves to rideshare_lyft (matches engine rule key)", () => {
  const r = categorize("LYFT   *RIDE THU");
  assert.equal(r.category, "rideshare_lyft");
});

test("unknown merchant => Uncategorized, category null, resolved false (no guess)", () => {
  const r = categorize("SOME OBSCURE LOCAL SHOP LLC");
  assert.equal(r.resolved, false);
  assert.equal(r.category, null);
  // still returns a normalized name for display / manual mapping
  assert.equal(r.merchantNormalized, "SOME OBSCURE LOCAL SHOP LLC");
});
