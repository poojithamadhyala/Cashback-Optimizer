/**
 * Rewards Engine — the deterministic calculation core.
 *
 * Spec references:
 *  - Section 4.3: "Rewards engine — pure function(s):
 *      (category, amount, card_rules[]) -> {actual, optimal, missed}.
 *      No I/O, no AI, fully unit-testable."
 *  - Section 2 (Rewards Calculation): calculation MUST be deterministic code,
 *      not an LLM call. Same inputs -> same output, always.
 *  - Section 9 (Design implication): rules carry a `unit`
 *      ('cashback_pct' | 'points_per_dollar') and point-based rules carry a
 *      `pointValueCents`, rather than assuming everything is a flat percentage.
 *      CSP is points-based (~2c/pt effective); the other two are true cashback.
 *  - Section 10: Citi Double Cash modeled as flat 2% in v1 (known simplification).
 *
 * DESIGN NOTES
 * ------------
 * This module is pure: no imports of I/O, no Date.now() side effects except a
 * caller-supplied `context`. Determinism is enforced by requiring the caller to
 * pass everything time-dependent (evaluation date, per-card year-to-date spend
 * used for caps, and which rotating categories are activated) explicitly.
 *
 * All monetary math is done in integer CENTS to avoid float drift, then a
 * rounding step converts to a final cents value. Inputs are accepted as
 * dollars (numbers) for ergonomics but converted to cents immediately.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How a rule's `rate` should be interpreted. */
export type RewardUnit = "cashback_pct" | "points_per_dollar";

/**
 * A single reward rule. Mirrors `card_reward_rules` (Section 3) closely so the
 * same shape can be snapshotted into `reward_calculations.rule_version_snapshot`.
 */
export interface RewardRule {
  /** Stable id of the rule row (used for snapshotting / tie-break determinism). */
  id: string;
  /** Spending category this rule applies to, or "*" for the card's baseline. */
  category: string;
  /**
   * The reward rate.
   *  - When unit === "cashback_pct": a percentage, e.g. 3 means 3%.
   *  - When unit === "points_per_dollar": points earned per $1, e.g. 5 means 5x.
   */
  rate: number;
  unit: RewardUnit;
  /**
   * Cents-per-point conversion. REQUIRED when unit === "points_per_dollar".
   * e.g. 2 means each point is worth 2 cents (CSP ~2c/pt via transfer partners).
   * Ignored for cashback_pct rules.
   */
  pointValueCents?: number;
  /**
   * Annual spend cap in dollars for the bonus rate. When cumulative spend in
   * this category (see EvaluationContext.yearToDateSpendByRuleId) exceeds the
   * cap, spend above the cap earns the card's baseline rate instead.
   * null / undefined => no cap.
   */
  capAmount?: number | null;
  /** True if this bonus requires quarterly activation (e.g. rotating 5% cards). */
  isRotating?: boolean;
  /**
   * Quarter this rotating rule applies to, e.g. "2026-Q3". Only meaningful when
   * isRotating is true.
   */
  quarter?: string | null;
  /** ISO date (YYYY-MM-DD) the rule becomes effective (inclusive). */
  effectiveFrom?: string | null;
  /** ISO date (YYYY-MM-DD) the rule stops being effective (inclusive). null => open-ended. */
  effectiveTo?: string | null;
}

/** A card as seen by the engine: an identity plus its rules. */
export interface CardForEval {
  /**
   * Identifier used to reference the card in results. In the app this is the
   * user_card_id; in fixtures/tests it can be any stable string.
   */
  cardId: string;
  /** Human label, used only for readability in results. */
  label?: string;
  rules: RewardRule[];
}

/**
 * Everything time- and state-dependent the engine needs, supplied by the caller
 * so the function stays pure and deterministic.
 */
export interface EvaluationContext {
  /** ISO date (YYYY-MM-DD) the purchase is evaluated against (for effective windows). */
  evaluationDate: string;
  /** The current quarter string, e.g. "2026-Q3" (for rotating rules). */
  currentQuarter: string;
  /**
   * Set of rule ids the user has ACTIVATED (for rotating categories). A rotating
   * rule only applies if its id is present here. Non-rotating rules ignore this.
   */
  activatedRuleIds?: ReadonlyArray<string>;
  /**
   * Year-to-date spend (in dollars) already applied against each capped rule,
   * keyed by rule id. Used to determine how much of THIS purchase still earns
   * the bonus rate before the cap forces a fallback to baseline.
   * Missing key => 0 spent so far.
   */
  yearToDateSpendByRuleId?: Readonly<Record<string, number>>;
}

/** The winning rule + resulting cashback for one card on one purchase. */
export interface CardResult {
  cardId: string;
  label?: string;
  /** The rule id that was applied for the bonus portion (or baseline id). */
  appliedRuleId: string;
  /**
   * Effective cashback rate as a percentage of the purchase amount, for display
   * ("earned 3%"). For point rules this is the points-derived effective %.
   * Rounded to 4 decimal places to keep it stable/deterministic.
   */
  effectiveRatePct: number;
  /** Cashback value in whole cents (integer). */
  cashbackCents: number;
}

/** Result of evaluating a single purchase across a set of cards. */
export interface RewardEvaluation {
  /** The card the user actually used (may be undefined if not supplied). */
  actual?: CardResult;
  /** The best available card among those evaluated. */
  optimal?: CardResult;
  /**
   * Missed value in whole cents = optimal.cashbackCents - actual.cashbackCents,
   * floored at 0. 0 when the user already used the optimal card (or a tie).
   */
  missedCents: number;
  /** All per-card results, sorted best-first (highest cashbackCents). */
  perCard: CardResult[];
}

export interface EvaluateInput {
  category: string;
  /** Purchase total in dollars. */
  amount: number;
  cards: CardForEval[];
  /** cardId of the card the user actually used. */
  actualCardId?: string;
  context: EvaluationContext;
}

// ---------------------------------------------------------------------------
// Internal helpers (pure)
// ---------------------------------------------------------------------------

const BASELINE_CATEGORY = "*";

function toCents(dollars: number): number {
  // Round to nearest cent to absorb float representation error.
  return Math.round(dollars * 100);
}

/** ISO date compare: is `date` within [from, to]? null bounds are open. */
function isWithinWindow(
  date: string,
  from?: string | null,
  to?: string | null
): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/**
 * Is this rule usable at all for this purchase, given category + time + rotation?
 * Baseline ("*") rules are always candidates regardless of category.
 */
function ruleIsEligible(
  rule: RewardRule,
  category: string,
  ctx: EvaluationContext
): boolean {
  // Effective window check applies to every rule.
  if (!isWithinWindow(ctx.evaluationDate, rule.effectiveFrom, rule.effectiveTo)) {
    return false;
  }

  const matchesCategory =
    rule.category === category || rule.category === BASELINE_CATEGORY;
  if (!matchesCategory) return false;

  // Rotating bonus rules only apply for the current quarter AND when activated.
  if (rule.isRotating && rule.category !== BASELINE_CATEGORY) {
    if (rule.quarter && rule.quarter !== ctx.currentQuarter) return false;
    const activated = ctx.activatedRuleIds ?? [];
    if (!activated.includes(rule.id)) return false;
  }

  return true;
}

/** Value in cents earned for `spendCents` at a given rule's rate. */
function ruleValueCents(rule: RewardRule, spendCents: number): number {
  if (rule.unit === "cashback_pct") {
    // rate is a percentage: cents * (rate/100).
    return Math.round((spendCents * rule.rate) / 100);
  }
  // points_per_dollar: points = dollars * rate; value = points * pointValueCents.
  // dollars = spendCents / 100. Combine to stay in cents:
  //   valueCents = (spendCents/100) * rate * pointValueCents
  const pvc = rule.pointValueCents ?? 0;
  return Math.round((spendCents * rule.rate * pvc) / 100);
}

/** Pick the card's baseline ("*") rule, if any, that is currently effective. */
function findBaselineRule(
  card: CardForEval,
  ctx: EvaluationContext
): RewardRule | undefined {
  return card.rules.find(
    (r) =>
      r.category === BASELINE_CATEGORY &&
      isWithinWindow(ctx.evaluationDate, r.effectiveFrom, r.effectiveTo)
  );
}

/**
 * Compute the best cashback (in cents) a single card yields for this purchase,
 * accounting for caps: spend up to the remaining cap earns the bonus rate, the
 * remainder earns the card's baseline rate.
 */
function evaluateCard(
  card: CardForEval,
  category: string,
  amountCents: number,
  ctx: EvaluationContext
): CardResult | undefined {
  const baseline = findBaselineRule(card, ctx);

  // Candidate NON-baseline bonus rules that are eligible for this category.
  const bonusCandidates = card.rules.filter(
    (r) =>
      r.category !== BASELINE_CATEGORY &&
      ruleIsEligible(r, category, ctx)
  );

  // Evaluate each bonus candidate WITH cap handling, plus the pure-baseline option.
  const options: Array<{ rule: RewardRule; cents: number }> = [];

  for (const bonus of bonusCandidates) {
    const cents = valueWithCap(bonus, baseline, amountCents, ctx);
    options.push({ rule: bonus, cents });
  }

  if (baseline) {
    options.push({ rule: baseline, cents: ruleValueCents(baseline, amountCents) });
  }

  if (options.length === 0) return undefined; // no applicable rule at all

  // Best option for THIS card: highest cents. Deterministic tie-break by ruleId.
  options.sort((a, b) => {
    if (b.cents !== a.cents) return b.cents - a.cents;
    return a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0;
  });
  const best = options[0];

  return {
    cardId: card.cardId,
    label: card.label,
    appliedRuleId: best.rule.id,
    effectiveRatePct: round4((best.cents / amountCents) * 100),
    cashbackCents: best.cents,
  };
}

/**
 * Value for a capped bonus rule: the portion of this purchase within the
 * remaining cap earns the bonus; the portion above earns baseline (or nothing
 * if there is no baseline rule).
 */
function valueWithCap(
  bonus: RewardRule,
  baseline: RewardRule | undefined,
  amountCents: number,
  ctx: EvaluationContext
): number {
  const cap = bonus.capAmount;
  if (cap === null || cap === undefined) {
    return ruleValueCents(bonus, amountCents);
  }

  const capCents = toCents(cap);
  const alreadySpentCents = toCents(
    ctx.yearToDateSpendByRuleId?.[bonus.id] ?? 0
  );
  const remainingCapCents = Math.max(0, capCents - alreadySpentCents);

  const bonusPortion = Math.min(amountCents, remainingCapCents);
  const overflowPortion = amountCents - bonusPortion;

  const bonusValue = ruleValueCents(bonus, bonusPortion);
  const overflowValue = baseline
    ? ruleValueCents(baseline, overflowPortion)
    : 0;

  return bonusValue + overflowValue;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a purchase across a set of cards.
 *
 * Returns what the actual card earned, what the optimal card would have earned,
 * and the missed delta (in cents). Pure & deterministic: same inputs always
 * produce the same output.
 */
export function evaluatePurchase(input: EvaluateInput): RewardEvaluation {
  const { category, amount, cards, actualCardId, context } = input;
  const amountCents = toCents(amount);

  const perCard: CardResult[] = [];
  for (const card of cards) {
    const result = evaluateCard(card, category, amountCents, context);
    if (result) perCard.push(result);
  }

  // Sort best-first for display; deterministic tie-break by cardId.
  perCard.sort((a, b) => {
    if (b.cashbackCents !== a.cashbackCents) {
      return b.cashbackCents - a.cashbackCents;
    }
    return a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0;
  });

  const optimal = perCard[0];
  const actual =
    actualCardId !== undefined
      ? perCard.find((c) => c.cardId === actualCardId)
      : undefined;

  let missedCents = 0;
  if (optimal && actual) {
    missedCents = Math.max(0, optimal.cashbackCents - actual.cashbackCents);
  }

  return { actual, optimal, missedCents, perCard };
}
