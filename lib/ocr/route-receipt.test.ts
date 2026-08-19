/**
 * OCR routing tests — Section 6 (OCR pipeline): "test the confidence-threshold
 * branching logic with mocked OCR responses ... low-confidence output correctly
 * routes to needs_review". We do NOT test the OCR model itself.
 *
 * Run:  node --experimental-strip-types --test lib/ocr/route-receipt.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { routeReceipt } from "./route-receipt.ts";
import type { OcrResult } from "./types.ts";

const THRESHOLD = 0.8;

function ocr(overrides: Partial<OcrResult> = {}): OcrResult {
  return {
    merchantRaw: "TRADER JOE'S #123",
    date: "2026-08-19",
    total: 42.5,
    confidence: 0.95,
    rawText: "raw",
    ...overrides,
  };
}

test("high confidence + all fields present => confirmed", () => {
  const d = routeReceipt(ocr(), THRESHOLD);
  assert.equal(d.status, "confirmed");
  assert.deepEqual(d.reasons, []);
});

test("low confidence => needs_review", () => {
  const d = routeReceipt(ocr({ confidence: 0.5 }), THRESHOLD);
  assert.equal(d.status, "needs_review");
  assert.ok(d.reasons.some((r) => r.includes("low confidence")));
});

test("confidence exactly at threshold => confirmed (>= passes)", () => {
  const d = routeReceipt(ocr({ confidence: 0.8 }), THRESHOLD);
  assert.equal(d.status, "confirmed");
});

test("missing merchant => needs_review", () => {
  const d = routeReceipt(ocr({ merchantRaw: null }), THRESHOLD);
  assert.equal(d.status, "needs_review");
  assert.ok(d.reasons.includes("missing merchant"));
});

test("empty/whitespace merchant => needs_review", () => {
  const d = routeReceipt(ocr({ merchantRaw: "   " }), THRESHOLD);
  assert.equal(d.status, "needs_review");
  assert.ok(d.reasons.includes("missing merchant"));
});

test("missing total => needs_review even with high confidence", () => {
  const d = routeReceipt(ocr({ total: null }), THRESHOLD);
  assert.equal(d.status, "needs_review");
  assert.ok(d.reasons.includes("missing total"));
});

test("missing date => needs_review", () => {
  const d = routeReceipt(ocr({ date: null }), THRESHOLD);
  assert.equal(d.status, "needs_review");
  assert.ok(d.reasons.includes("missing date"));
});

test("multiple problems accumulate all reasons", () => {
  const d = routeReceipt(
    ocr({ merchantRaw: null, total: null, confidence: 0.1 }),
    THRESHOLD
  );
  assert.equal(d.status, "needs_review");
  assert.equal(d.reasons.length, 3);
});

test("mock provider default (all null, 0 confidence) => needs_review", () => {
  const d = routeReceipt(
    { merchantRaw: null, date: null, total: null, confidence: 0, rawText: "" },
    THRESHOLD
  );
  assert.equal(d.status, "needs_review");
});
