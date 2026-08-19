/**
 * Dashboard aggregation — Section 2 (Dashboard) + Section 5 endpoints.
 *
 * summary: total missed rewards + per-category breakdown.
 * bestCardCheatsheet: best saved card per category, using the rewards engine.
 *
 * EXCLUSION GUARANTEE (Section 2 acceptance): only CONFIRMED receipts count.
 * This is enforced structurally — a reward_calculation only exists once a
 * receipt is confirmed (see receipts/service.confirmReceipt), and the summary
 * aggregates over reward_calculations. A needs_review receipt has no calc row
 * and therefore cannot contribute to totals.
 */

import { requirePrincipal, type Principal } from "../auth/authz.ts";
import { evaluatePurchase, type CardForEval } from "../rewards-engine.ts";
import type { CalculationRepository, UserCardRulesProvider } from "../receipts/types.ts";

export interface CategoryBreakdown {
  category: string;
  missedAmount: number;
  actualCashback: number;
  optimalCashback: number;
  count: number;
}

export interface DashboardSummary {
  totalMissed: number;
  totalActualCashback: number;
  totalOptimalCashback: number;
  receiptCount: number;
  byCategory: CategoryBreakdown[];
}

export async function getSummary(
  calcs: CalculationRepository,
  principal: Principal
): Promise<DashboardSummary> {
  requirePrincipal(principal);
  const rows = await calcs.listByUser(principal.userId);

  let totalMissed = 0;
  let totalActual = 0;
  let totalOptimal = 0;
  const byCat = new Map<string, CategoryBreakdown>();

  for (const r of rows) {
    totalMissed = round2(totalMissed + r.missedAmount);
    totalActual = round2(totalActual + r.actualCashback);
    totalOptimal = round2(totalOptimal + r.optimalCashback);

    // The category is captured in the snapshot (immune to later edits).
    const category = r.ruleVersionSnapshot.category;
    const entry =
      byCat.get(category) ??
      { category, missedAmount: 0, actualCashback: 0, optimalCashback: 0, count: 0 };
    entry.missedAmount = round2(entry.missedAmount + r.missedAmount);
    entry.actualCashback = round2(entry.actualCashback + r.actualCashback);
    entry.optimalCashback = round2(entry.optimalCashback + r.optimalCashback);
    entry.count += 1;
    byCat.set(category, entry);
  }

  const byCategory = [...byCat.values()].sort((a, b) => {
    if (b.missedAmount !== a.missedAmount) return b.missedAmount - a.missedAmount;
    return a.category < b.category ? -1 : a.category > b.category ? 1 : 0;
  });

  return {
    totalMissed,
    totalActualCashback: totalActual,
    totalOptimalCashback: totalOptimal,
    receiptCount: rows.length,
    byCategory,
  };
}

export interface CheatsheetRow {
  category: string;
  bestCardId: string | null;
  bestCardLabel: string | null;
  effectiveRatePct: number;
}

/**
 * Best card per category among the user's SAVED cards. Uses the rewards engine
 * on a nominal $100 purchase to rank cards deterministically. Categories are the
 * canonical set the engine rules key on.
 */
export async function getBestCardCheatsheet(
  cardRules: UserCardRulesProvider,
  principal: Principal,
  categories: string[],
  context: { evaluationDate: string; currentQuarter: string; activatedRuleIds?: string[] }
): Promise<CheatsheetRow[]> {
  requirePrincipal(principal);
  const cards = await cardRules.getEvaluableCards(principal.userId);
  const cardsForEval: CardForEval[] = cards.map((c) => ({
    cardId: c.cardId,
    label: c.label,
    rules: c.rules,
  }));

  const NOMINAL = 100;
  return categories.map((category) => {
    const evalResult = evaluatePurchase({
      category,
      amount: NOMINAL,
      cards: cardsForEval,
      context: {
        evaluationDate: context.evaluationDate,
        currentQuarter: context.currentQuarter,
        activatedRuleIds: context.activatedRuleIds ?? [],
      },
    });
    const best = evalResult.optimal;
    return {
      category,
      bestCardId: best?.cardId ?? null,
      bestCardLabel: best?.label ?? null,
      effectiveRatePct: best?.effectiveRatePct ?? 0,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
