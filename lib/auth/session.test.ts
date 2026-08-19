/**
 * Session token tests — Section 2 (Auth): sessions expire; tokens must be
 * tamper-evident. Deterministic via injected `now`.
 * Run: node --experimental-strip-types --test lib/auth/session.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeSession, verifySession } from "./session.ts";

const SECRET = "test-secret-please-change";
const T0 = 1_700_000_000; // fixed unix time
const TTL = 3600; // 1 hour

test("roundtrip: encode then verify within TTL => ok with payload", () => {
  const tok = encodeSession({ sub: "user-1", email: "a@b.com" }, SECRET, TTL, T0);
  const r = verifySession(tok, SECRET, T0 + 10);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.payload.sub, "user-1");
    assert.equal(r.payload.email, "a@b.com");
    assert.equal(r.payload.exp, T0 + TTL);
  }
});

test("expired token => { ok:false, reason:'expired' }", () => {
  const tok = encodeSession({ sub: "user-1", email: "a@b.com" }, SECRET, TTL, T0);
  const r = verifySession(tok, SECRET, T0 + TTL + 1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "expired");
});

test("exactly at exp => expired (now >= exp)", () => {
  const tok = encodeSession({ sub: "u", email: "e" }, SECRET, TTL, T0);
  const r = verifySession(tok, SECRET, T0 + TTL);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "expired");
});

test("tampered payload => bad_signature", () => {
  const tok = encodeSession({ sub: "user-1", email: "a@b.com" }, SECRET, TTL, T0);
  const [h, _b, s] = tok.split(".");
  // swap in a forged payload claiming to be user-2
  const forged = Buffer.from(JSON.stringify({ sub: "user-2", email: "x", iat: T0, exp: T0 + TTL }))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const r = verifySession(`${h}.${forged}.${s}`, SECRET, T0 + 10);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "bad_signature");
});

test("wrong secret => bad_signature", () => {
  const tok = encodeSession({ sub: "u", email: "e" }, SECRET, TTL, T0);
  const r = verifySession(tok, "different-secret", T0 + 10);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "bad_signature");
});

test("malformed token => malformed", () => {
  assert.equal(verifySession("nonsense", SECRET, T0).ok, false);
  assert.equal(verifySession("a.b", SECRET, T0).ok, false);
  const r = verifySession("a.b.c.d", SECRET, T0);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "malformed");
});
