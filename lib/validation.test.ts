/**
 * Validation tests. Run: node --experimental-strip-types --test lib/validation.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSignup, validateLogin, validateAddCard } from "./validation.ts";

test("signup: valid input normalizes email to lowercase/trim", () => {
  const r = validateSignup({ email: "  User@Example.COM ", password: "longenough1" });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.email, "user@example.com");
});

test("signup: bad email rejected", () => {
  const r = validateSignup({ email: "not-an-email", password: "longenough1" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.email);
});

test("signup: short password rejected", () => {
  const r = validateSignup({ email: "a@b.com", password: "short" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.password);
});

test("signup: non-object body rejected", () => {
  const r = validateSignup("nope");
  assert.equal(r.ok, false);
});

test("login: requires both fields", () => {
  const r = validateLogin({ email: "", password: "" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.errors.email);
    assert.ok(r.errors.password);
  }
});

test("addCard: requires cardCatalogId", () => {
  const r = validateAddCard({ nickname: "travel" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.cardCatalogId);
});

test("addCard: valid with optional nickname trimmed", () => {
  const r = validateAddCard({ cardCatalogId: " csp ", nickname: "  Travel  " });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.cardCatalogId, "csp");
    assert.equal(r.value.nickname, "Travel");
  }
});

test("addCard: over-long nickname rejected", () => {
  const r = validateAddCard({ cardCatalogId: "csp", nickname: "x".repeat(61) });
  assert.equal(r.ok, false);
});
