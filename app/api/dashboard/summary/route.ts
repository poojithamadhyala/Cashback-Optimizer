// GET /dashboard/summary — Section 5, governed by Section 2 (Dashboard).
// Totals: total missed rewards over time + per-category breakdown.
// IMPORTANT: only CONFIRMED receipts count; needs_review receipts are excluded
// from totals until the user confirms them (Section 2 acceptance criterion).
// TODO: requireUser; aggregate reward_calculations joined to confirmed receipts
// for the session user only.
import { notImplemented } from "@/lib/http";

export async function GET(): Promise<Response> {
  return notImplemented(
    "Section 2 (Dashboard)",
    "Auth-gate; aggregate missed + per-category over CONFIRMED receipts for session user."
  );
}
