/**
 * Auth service scaffold — Section 4.4 / Section 2 (Auth & Accounts).
 *
 * Isolated from business logic. Responsibilities when implemented:
 *  - hash passwords with bcrypt/argon2 (NEVER plaintext, never logged)
 *  - issue + verify expiring session JWTs (jose), read from an httpOnly cookie
 *  - requireUser(): resolve the authenticated user or 401
 *  - authorization helpers: assertOwnership(userId, resource.userId) -> 403
 *    (Section 2: user A must not read/edit user B's records by guessing IDs)
 *
 * NOT IMPLEMENTED in this scaffold — signatures + contracts only.
 */

export interface SessionUser {
  id: string;
  email: string;
}

/** Hash a plaintext password. TODO: bcrypt.hash(password, 12). */
export async function hashPassword(_password: string): Promise<string> {
  throw new Error("not implemented: hashPassword (Section 2 — use bcrypt/argon2)");
}

/** Verify a plaintext password against a stored hash. TODO: bcrypt.compare. */
export async function verifyPassword(
  _password: string,
  _hash: string
): Promise<boolean> {
  throw new Error("not implemented: verifyPassword");
}

/** Issue a signed, expiring session token. TODO: jose SignJWT with AUTH_SESSION_TTL_SECONDS. */
export async function issueSession(_user: SessionUser): Promise<string> {
  throw new Error("not implemented: issueSession (Section 2 — sessions expire)");
}

/**
 * Resolve the current authenticated user from the request cookie, or null.
 * Every data-bearing route MUST call this (Section 2: auth required everywhere).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  throw new Error("not implemented: getSessionUser");
}

/**
 * Authorization guard. Ensures the accessing user owns the resource.
 * Section 2 acceptance: authorization check, not just authentication.
 */
export function assertOwnership(currentUserId: string, resourceOwnerId: string): void {
  if (currentUserId !== resourceOwnerId) {
    // Route handlers translate this into a 403 (see lib/http.ts forbidden()).
    throw new Error("forbidden: resource belongs to another user");
  }
}
