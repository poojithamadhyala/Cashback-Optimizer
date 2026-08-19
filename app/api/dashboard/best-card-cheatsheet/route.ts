// GET /dashboard/best-card-cheatsheet — Section 5, governed by Section 2 (Dashboard).
// "Best card per category" based on the user's SAVED cards, computed with the
// tested rewards engine. Deterministic.
import { errorResponse, json } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { getBestCardCheatsheet } from "@/lib/dashboard/service";
import { prismaUserCardRulesProvider } from "@/lib/receipts/prisma-card-rules";
import { ALL_CATEGORIES } from "@/lib/categorizer/categorizer";
import { quarterOf } from "@/lib/receipts/quarter";

export async function GET(): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const now = new Date();
    const rows = await getBestCardCheatsheet(
      prismaUserCardRulesProvider,
      principal,
      ALL_CATEGORIES,
      {
        evaluationDate: now.toISOString().slice(0, 10),
        currentQuarter: quarterOf(now),
        activatedRuleIds: [],
      }
    );
    return json({ cheatsheet: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
