/**
 * Password hashing — Section 2 (Auth): passwords hashed, NEVER plaintext,
 * never logged.
 *
 * Implemented with Node's built-in `crypto.scrypt` so it runs with ZERO npm
 * dependencies (this sandbox has no npm access). scrypt is a memory-hard KDF
 * and a legitimate production choice.
 *
 * Storage format (single self-describing string, like PHC):
 *   scrypt$N$r$p$<saltB64>$<hashB64>
 * Parameters are embedded so cost can be raised over time without breaking
 * existing hashes.
 *
 * SWAP NOTE: to use bcrypt/argon2 instead (spec lists bcrypt/argon2 as
 * acceptable), install the dependency and reimplement hashPassword/verifyPassword
 * with the same signatures — nothing else in the codebase needs to change.
 */

import {
  scrypt as scryptCb,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

// scrypt cost parameters. N must be a power of 2. These are reasonable 2024+
// defaults (N=2^15) balancing security and latency.
const N = 32768;
const r = 8;
const p = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

const PREFIX = "scrypt";

/**
 * OpenSSL enforces a default `maxmem` of 32 MB for scrypt; the memory scrypt
 * actually needs is roughly 128 * N * r bytes. With N=32768, r=8 that is ~32 MB,
 * which trips the default limit and throws ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
 * We compute an explicit maxmem with headroom so the derivation succeeds and so
 * the same params supplied in a stored hash can always be re-derived on verify.
 */
function maxmemFor(nParam: number, rParam: number): number {
  const needed = 128 * nParam * rParam;
  return needed * 2; // 2x headroom
}

export async function hashPassword(password: string): Promise<string> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("hashPassword: password must be a non-empty string");
  }
  const salt = randomBytes(SALT_LEN);
  const derived = (await scrypt(password, salt, KEY_LEN, {
    N,
    r,
    p,
    maxmem: maxmemFor(N, r),
  })) as Buffer;
  return [
    PREFIX,
    N,
    r,
    p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a plaintext password against a stored hash string.
 * Returns false (never throws) on malformed input, so callers can treat a bad
 * record the same as a wrong password. Uses a constant-time comparison.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (typeof password !== "string" || typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const nParam = Number(parts[1]);
  const rParam = Number(parts[2]);
  const pParam = Number(parts[3]);
  if (!Number.isInteger(nParam) || !Number.isInteger(rParam) || !Number.isInteger(pParam)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = (await scrypt(password, salt, expected.length, {
      N: nParam,
      r: rParam,
      p: pParam,
      maxmem: maxmemFor(nParam, rParam),
    })) as Buffer;
  } catch {
    return false;
  }

  // Lengths are equal by construction (we derived expected.length bytes), but
  // guard anyway before the constant-time compare.
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
