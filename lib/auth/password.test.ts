/**
 * Password hashing tests — Section 2 (Auth): hashed, never plaintext.
 * Run: node --experimental-strip-types --test lib/auth/password.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./password.ts";

test("hash then verify with the correct password => true", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("verify with the wrong password => false", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("Correct Horse Battery Staple", hash), false);
});

test("hash is not plaintext and is self-describing (scrypt$...)", async () => {
  const hash = await hashPassword("s3cret-password");
  assert.ok(!hash.includes("s3cret-password"));
  assert.ok(hash.startsWith("scrypt$"));
  assert.equal(hash.split("$").length, 6);
});

test("two hashes of the same password differ (random salt)", async () => {
  const a = await hashPassword("same-password-123");
  const b = await hashPassword("same-password-123");
  assert.notEqual(a, b);
  // ...but both verify
  assert.equal(await verifyPassword("same-password-123", a), true);
  assert.equal(await verifyPassword("same-password-123", b), true);
});

test("malformed stored hash => false, never throws", async () => {
  assert.equal(await verifyPassword("whatever", "not-a-valid-hash"), false);
  assert.equal(await verifyPassword("whatever", ""), false);
  assert.equal(await verifyPassword("whatever", "scrypt$bad"), false);
});

test("empty password rejected at hash time", async () => {
  await assert.rejects(() => hashPassword(""), /non-empty/);
});
