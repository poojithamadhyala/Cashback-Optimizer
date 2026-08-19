/**
 * Request-scoped auth helpers that bridge the pure session module to Next.js.
 *
 * The pure logic (encode/verify) lives in ./session.ts and is unit-tested. This
 * file handles the impure bits: reading env, reading/writing the httpOnly
 * cookie, and reading the clock. It is intentionally thin.
 *
 * NOTE: uses next/headers `cookies()` — only runnable inside the Next.js server
 * runtime, so it is NOT exercised by the offline unit tests (the tested part is
 * session.ts). Behavior here is a straightforward wrapper.
 */

import { cookies } from "next/headers";
import { encodeSession, verifySession } from "./session.ts";
import type { Principal } from "./authz.ts";

const COOKIE_NAME = "session";

function secret(): string {
  const s = process.env.AUTH_JWT_SECRET;
  if (!s) throw new Error("AUTH_JWT_SECRET is not set");
  return s;
}

function ttlSeconds(): number {
  const n = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? "604800");
  return Number.isFinite(n) && n > 0 ? n : 604800;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Issue a session and set it as an httpOnly, secure, sameSite cookie. */
export async function startSession(user: { id: string; email: string }): Promise<void> {
  const token = encodeSession(
    { sub: user.id, email: user.email },
    secret(),
    ttlSeconds(),
    nowSeconds()
  );
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttlSeconds(),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Resolve the current principal from the session cookie, or null. */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const result = verifySession(token, secret(), nowSeconds());
  if (!result.ok) return null;
  return { userId: result.payload.sub, email: result.payload.email };
}
