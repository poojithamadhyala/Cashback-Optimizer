/**
 * Session tokens — Section 2 (Auth): "Sessions expire".
 *
 * A compact, signed, self-verifying token (JWT-like: header.payload.signature,
 * base64url, HMAC-SHA256) built on Node's `crypto` so it runs with ZERO npm
 * dependencies. Deterministic and fully unit-testable: the caller supplies
 * `now` and the secret, so there are no hidden clock/env reads.
 *
 * SWAP NOTE: the spec mentions `jose`. To use it instead, reimplement
 * encodeSession/verifySession with the same signatures; callers are unaffected.
 * This HMAC implementation is a legitimate stateless-session approach on its own.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionPayload {
  /** user id */
  sub: string;
  email: string;
  /** issued-at (unix seconds) */
  iat: number;
  /** expiry (unix seconds) */
  exp: number;
}

export type VerifyResult =
  | { ok: true; payload: SessionPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

const HEADER = { alg: "HS256", typ: "JWT" } as const;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlToBuf(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(data: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(data).digest());
}

/**
 * Create a signed session token.
 * @param ttlSeconds session lifetime (spec: sessions expire)
 * @param nowSeconds current unix time in seconds (injected for determinism)
 */
export function encodeSession(
  input: { sub: string; email: string },
  secret: string,
  ttlSeconds: number,
  nowSeconds: number
): string {
  if (!secret) throw new Error("encodeSession: secret required");
  const payload: SessionPayload = {
    sub: input.sub,
    email: input.email,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const head = b64url(JSON.stringify(HEADER));
  const body = b64url(JSON.stringify(payload));
  const sig = sign(`${head}.${body}`, secret);
  return `${head}.${body}.${sig}`;
}

/**
 * Verify a token: checks structure, signature (constant-time), and expiry.
 * `nowSeconds` is injected so expiry checks are deterministic in tests.
 */
export function verifySession(
  token: string,
  secret: string,
  nowSeconds: number
): VerifyResult {
  if (typeof token !== "string") return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };

  const [head, body, sig] = parts;
  const expectedSig = sign(`${head}.${body}`, secret);

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlToBuf(body).toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof payload?.sub !== "string" ||
    typeof payload?.exp !== "number" ||
    typeof payload?.iat !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (nowSeconds >= payload.exp) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
