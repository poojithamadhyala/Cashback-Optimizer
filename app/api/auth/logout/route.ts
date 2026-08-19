// POST /auth/logout — Section 5, governed by Section 2 (Auth & Accounts).
// TODO: clear the session cookie.
import { notImplemented } from "@/lib/http";

export async function POST(): Promise<Response> {
  return notImplemented(
    "Section 2 (Auth)",
    "Clear session cookie / invalidate session."
  );
}
