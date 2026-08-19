/**
 * UI formatter tests. Run: node --experimental-strip-types --test lib/ui/format.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatMissed,
  formatPct,
  confidenceLevel,
  statusLabel,
  categoryLabel,
} from "./format.ts";

test("formatCurrency", () => {
  assert.equal(formatCurrency(3), "$3.00");
  assert.equal(formatCurrency(3.5), "$3.50");
  assert.equal(formatCurrency(0), "$0.00");
  assert.equal(formatCurrency(-0), "$0.00"); // no "-$0.00"
  assert.equal(formatCurrency(12.345), "$12.35");
  assert.equal(formatCurrency(NaN), "$0.00");
});

test("formatMissed", () => {
  assert.equal(formatMissed(0), "Optimal card used");
  assert.equal(formatMissed(-1), "Optimal card used");
  assert.equal(formatMissed(1.5), "Missed $1.50");
});

test("formatPct trims trailing zeros", () => {
  assert.equal(formatPct(3), "3%");
  assert.equal(formatPct(2.5), "2.5%");
  assert.equal(formatPct(2.0), "2%");
  assert.equal(formatPct(6), "6%");
});

test("confidenceLevel buckets", () => {
  assert.equal(confidenceLevel(0.95), "high");
  assert.equal(confidenceLevel(0.8), "high");
  assert.equal(confidenceLevel(0.6), "medium");
  assert.equal(confidenceLevel(0.49), "low");
  assert.equal(confidenceLevel(null), "low");
});

test("statusLabel", () => {
  assert.equal(statusLabel("confirmed"), "Confirmed");
  assert.equal(statusLabel("needs_review"), "Needs review");
});

test("categoryLabel", () => {
  assert.equal(categoryLabel("us_supermarkets"), "US supermarkets");
  assert.equal(categoryLabel("dining"), "Dining");
  assert.equal(categoryLabel(null), "Uncategorized");
  assert.equal(categoryLabel("some_new_key"), "Some New Key");
});
