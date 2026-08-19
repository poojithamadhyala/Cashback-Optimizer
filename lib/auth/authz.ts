/**
 * Authorization guards — Section 2 acceptance criterion:
 * "an authenticated user cannot fetch/edit another user's receipt or card by
 *  guessing an ID (authorization check, not just auth)."
 *
 * These are pure functions that THROW typed AppErrors. The service layer calls
 * them after loading a resource; route handlers translate the error to a status.
 */

import { Unauthorized, Forbidden, NotFound } from "../errors.ts";

export interface Principal {
  userId: string;
  email: string;
}

/** Require an authenticated principal or throw 401. */
export function requirePrincipal(principal: Principal | null | undefined): Principal {
  if (!principal || !principal.userId) throw Unauthorized();
  return principal;
}

/**
 * Ensure the principal owns the resource. `resource` may be null to represent
 * "not found in DB" — we treat a missing resource as NotFound (404), and a
 * resource owned by someone else as Forbidden (403).
 *
 * SECURITY NOTE: we intentionally distinguish 404 vs 403 only AFTER confirming
 * the row exists. Callers must scope their DB reads so they cannot leak the
 * existence of other users' rows through timing/shape if that matters; here the
 * simple, explicit behavior is: exists + owned => ok; exists + not owned => 403;
 * absent => 404.
 */
export function assertOwner<T extends { userId: string }>(
  principal: Principal,
  resource: T | null | undefined
): T {
  if (!resource) throw NotFound();
  if (resource.userId !== principal.userId) throw Forbidden();
  return resource;
}
