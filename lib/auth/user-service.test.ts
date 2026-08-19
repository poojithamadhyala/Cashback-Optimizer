/**
 * User auth service tests — signup uniqueness + login credential rules
 * (Section 2). In-memory UserRepository fake; real password hashing.
 * Run: node --experimental-strip-types --test lib/auth/user-service.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signup,
  login,
  type UserRepository,
  type UserRecord,
} from "./user-service.ts";
import { AppError } from "../errors.ts";

function makeRepo(): UserRepository & { _rows: UserRecord[] } {
  const rows: UserRecord[] = [];
  let seq = 0;
  return {
    _rows: rows,
    async findByEmail(email) {
      return rows.find((r) => r.email === email) ?? null;
    },
    async create(input) {
      const rec: UserRecord = { id: `u-${++seq}`, email: input.email, passwordHash: input.passwordHash };
      rows.push(rec);
      return rec;
    },
  };
}

test("signup creates a user and does NOT store plaintext password", async () => {
  const repo = makeRepo();
  const user = await signup(repo, { email: "a@b.com", password: "longenough1" });
  assert.equal(user.email, "a@b.com");
  assert.ok(user.id);
  // stored hash is not the plaintext
  assert.ok(!repo._rows[0].passwordHash.includes("longenough1"));
  assert.ok(repo._rows[0].passwordHash.startsWith("scrypt$"));
});

test("signup with duplicate email => conflict(409)", async () => {
  const repo = makeRepo();
  await signup(repo, { email: "a@b.com", password: "longenough1" });
  await assert.rejects(
    () => signup(repo, { email: "a@b.com", password: "another-one-9" }),
    (e: unknown) => e instanceof AppError && e.kind === "conflict"
  );
});

test("login with correct credentials returns the user", async () => {
  const repo = makeRepo();
  await signup(repo, { email: "a@b.com", password: "longenough1" });
  const user = await login(repo, { email: "a@b.com", password: "longenough1" });
  assert.equal(user.email, "a@b.com");
});

test("login with wrong password => unauthorized(401)", async () => {
  const repo = makeRepo();
  await signup(repo, { email: "a@b.com", password: "longenough1" });
  await assert.rejects(
    () => login(repo, { email: "a@b.com", password: "WRONGpassword1" }),
    (e: unknown) => e instanceof AppError && e.kind === "unauthorized"
  );
});

test("login with unknown email => unauthorized(401), same as wrong password", async () => {
  const repo = makeRepo();
  await assert.rejects(
    () => login(repo, { email: "nobody@nowhere.com", password: "whatever12" }),
    (e: unknown) => e instanceof AppError && e.kind === "unauthorized"
  );
});
