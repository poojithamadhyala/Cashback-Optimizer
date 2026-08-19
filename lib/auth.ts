/**
 * Auth barrel — Section 4.4. Re-exports the implemented, unit-tested auth core.
 *
 * The auth logic is now REAL and tested (not stubs):
 *  - password hashing:  ./auth/password.ts        (scrypt via node:crypto)
 *  - session tokens:    ./auth/session.ts          (HMAC-SHA256, expiry)
 *  - authorization:     ./auth/authz.ts            (ownership guards -> 403/404)
 *  - user service:      ./auth/user-service.ts     (signup/login rules)
 *  - request bridge:    ./auth/current-user.ts     (cookie + clock; Next runtime)
 *
 * See lib/auth/*.test.ts for the executed unit tests.
 */

export { hashPassword, verifyPassword } from "./auth/password.ts";
export { encodeSession, verifySession } from "./auth/session.ts";
export type { SessionPayload, VerifyResult } from "./auth/session.ts";
export { requirePrincipal, assertOwner } from "./auth/authz.ts";
export type { Principal } from "./auth/authz.ts";
export { signup, login } from "./auth/user-service.ts";
export type { UserRepository, UserRecord, PublicUser } from "./auth/user-service.ts";
export {
  startSession,
  endSession,
  getCurrentPrincipal,
} from "./auth/current-user.ts";
