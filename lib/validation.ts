/**
 * Input validation — pure, dependency-free (spec lists zod, but zod needs npm;
 * these validators have the same contract and can be swapped for zod later).
 *
 * Each validator returns a discriminated result rather than throwing, so route
 * handlers can decide how to surface errors. A helper `orThrow` converts to an
 * AppError('validation') when that's more convenient.
 */

import { Validation } from "./errors.ts";

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

export interface SignupInput {
  email: string;
  password: string;
}
export interface LoginInput {
  email: string;
  password: string;
}
export interface AddCardInput {
  cardCatalogId: string;
  nickname?: string;
}

// Deliberately simple, well-understood email shape check. Not RFC-complete on
// purpose (full RFC 5322 is a footgun); this rejects obvious garbage.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200; // guard against DoS via huge scrypt inputs
const MAX_NICKNAME = 60;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function validateSignup(body: unknown): ValidationResult<SignupInput> {
  const errors: Record<string, string> = {};
  if (!isObj(body)) return { ok: false, errors: { body: "expected an object" } };

  const email = body.email;
  const password = body.password;

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    errors.email = "must be a valid email address";
  }
  if (typeof password !== "string") {
    errors.password = "required";
  } else if (password.length < MIN_PASSWORD) {
    errors.password = `must be at least ${MIN_PASSWORD} characters`;
  } else if (password.length > MAX_PASSWORD) {
    errors.password = `must be at most ${MAX_PASSWORD} characters`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { email: (email as string).trim().toLowerCase(), password: password as string },
  };
}

export function validateLogin(body: unknown): ValidationResult<LoginInput> {
  const errors: Record<string, string> = {};
  if (!isObj(body)) return { ok: false, errors: { body: "expected an object" } };

  const email = body.email;
  const password = body.password;
  if (typeof email !== "string" || email.trim() === "") errors.email = "required";
  if (typeof password !== "string" || password === "") errors.password = "required";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { email: (email as string).trim().toLowerCase(), password: password as string },
  };
}

export function validateAddCard(body: unknown): ValidationResult<AddCardInput> {
  const errors: Record<string, string> = {};
  if (!isObj(body)) return { ok: false, errors: { body: "expected an object" } };

  const cardCatalogId = body.cardCatalogId;
  const nickname = body.nickname;

  if (typeof cardCatalogId !== "string" || cardCatalogId.trim() === "") {
    errors.cardCatalogId = "required";
  }
  if (nickname !== undefined) {
    if (typeof nickname !== "string") {
      errors.nickname = "must be a string";
    } else if (nickname.length > MAX_NICKNAME) {
      errors.nickname = `must be at most ${MAX_NICKNAME} characters`;
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const value: AddCardInput = { cardCatalogId: (cardCatalogId as string).trim() };
  if (typeof nickname === "string") value.nickname = nickname.trim();
  return { ok: true, value };
}

/** Convert a ValidationResult into a value or throw AppError('validation'). */
export function orThrow<T>(r: ValidationResult<T>): T {
  if (r.ok) return r.value;
  throw Validation("invalid input", r.errors);
}
