// GET /dashboard/summary — Section 5, governed by Section 2 (Dashboard).
// Totals: total missed + per-category breakdown, over CONFIRMED receipts only
// (needs_review receipts have no calc row and are excluded structurally).
import { errorResponse, json } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { getSummary } from "@/lib/dashboard/service";
import { prismaCalculationRepository } from "@/lib/receipts/prisma-repository";

export async function GET(): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const summary = await getSummary(prismaCalculationRepository, principal);
    return json({ summary });
  } catch (err) {
    return errorResponse(err);
  }
}
