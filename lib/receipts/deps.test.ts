/**
 * quarterOf tests — the only pure logic in deps.ts (the rest is I/O wiring).
 * Run: node --experimental-strip-types --test lib/receipts/deps.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { quarterOf } from "./quarter.ts";

test("quarterOf maps months to quarters (UTC)", () => {
  assert.equal(quarterOf(new Date("2026-01-15T00:00:00Z")), "2026-Q1");
  assert.equal(quarterOf(new Date("2026-03-31T23:59:59Z")), "2026-Q1");
  assert.equal(quarterOf(new Date("2026-04-01T00:00:00Z")), "2026-Q2");
  assert.equal(quarterOf(new Date("2026-08-19T12:00:00Z")), "2026-Q3");
  assert.equal(quarterOf(new Date("2026-12-31T00:00:00Z")), "2026-Q4");
});
