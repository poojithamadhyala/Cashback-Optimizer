// POST /auth/login — Section 5, governed by Section 2 (Auth & Accounts).
// TODO: verify credentials (verifyPassword), issue expiring session cookie.
import { notImplemented } from "@/lib/http";

export async function POST(): Promise<Response> {
  return notImplemented(
    "Section 2 (Auth), Section 4.4 (Auth service)",
    "Look up user by email, verifyPassword, issueSession, set httpOnly cookie."
  );
}
