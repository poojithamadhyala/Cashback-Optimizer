/**
 * User auth service — Section 2/4.4. Business logic over a UserRepository port,
 * so signup/login rules are testable independently of Prisma.
 *
 * Rules:
 *  - signup: email must be unique (Conflict/409 otherwise); password is hashed
 *    (never stored/logged plaintext).
 *  - login: unknown email OR wrong password both return the SAME Unauthorized
 *    error (do not reveal which emails are registered).
 */

import { hashPassword, verifyPassword } from "./password.ts";
import { Conflict, Unauthorized } from "../errors.ts";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string }): Promise<UserRecord>;
}

export interface PublicUser {
  id: string;
  email: string;
}

export async function signup(
  repo: UserRepository,
  input: { email: string; password: string }
): Promise<PublicUser> {
  const existing = await repo.findByEmail(input.email);
  if (existing) throw Conflict("email already registered");

  const passwordHash = await hashPassword(input.password);
  const user = await repo.create({ email: input.email, passwordHash });
  return { id: user.id, email: user.email };
}

export async function login(
  repo: UserRepository,
  input: { email: string; password: string }
): Promise<PublicUser> {
  const user = await repo.findByEmail(input.email);
  // Same error for "no such user" and "wrong password" to avoid user enumeration.
  if (!user) {
    // Still spend time verifying against a dummy hash to reduce timing signal.
    await verifyPassword(input.password, "scrypt$32768$8$1$AA==$AA==").catch(() => false);
    throw Unauthorized("invalid credentials");
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw Unauthorized("invalid credentials");
  return { id: user.id, email: user.email };
}
