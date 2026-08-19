// POST /auth/logout — Section 5, governed by Section 2 (Auth & Accounts).
import { errorResponse, json } from "@/lib/http";
import { endSession } from "@/lib/auth/current-user";

export async function POST(): Promise<Response> {
  try {
    await endSession();
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
