/**
 * Authorization tests — Section 6: "test that user A cannot access user B's
 * records." Verifies assertOwner throws Forbidden(403) for cross-user access
 * and NotFound(404) for missing resources.
 * Run: node --experimental-strip-types --test lib/auth/authz.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { requirePrincipal, assertOwner } from "./authz.ts";
import { AppError } from "../errors.ts";

const alice = { userId: "alice", email: "alice@x.com" };

test("requirePrincipal returns principal when present", () => {
  assert.equal(requirePrincipal(alice).userId, "alice");
});

test("requirePrincipal throws unauthorized(401) when null", () => {
  assert.throws(
    () => requirePrincipal(null),
    (e: unknown) => e instanceof AppError && e.kind === "unauthorized"
  );
});

test("assertOwner returns resource when the principal owns it", () => {
  const res = { userId: "alice", id: "card-1" };
  assert.equal(assertOwner(alice, res).id, "card-1");
});

test("assertOwner throws forbidden(403) for another user's resource", () => {
  const bobsCard = { userId: "bob", id: "card-2" };
  assert.throws(
    () => assertOwner(alice, bobsCard),
    (e: unknown) => e instanceof AppError && e.kind === "forbidden"
  );
});

test("assertOwner throws not_found(404) when resource is missing", () => {
  assert.throws(
    () => assertOwner(alice, null),
    (e: unknown) => e instanceof AppError && e.kind === "not_found"
  );
});
