// POST /auth/signup — Section 5, governed by Section 2 (Auth & Accounts).
// TODO: validate email/password (zod), ensure unique email, hashPassword,
// create User, issueSession, set httpOnly cookie. Never store/log plaintext.
import { notImplemented } from "@/lib/http";

export async function POST(): Promise<Response> {
  return notImplemented(
    "Section 2 (Auth), Section 4.4 (Auth service)",
    "Validate input, hash password (bcrypt), create user, issue expiring session cookie."
  );
}
