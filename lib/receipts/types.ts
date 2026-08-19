/**
 * Receipt domain types + repository ports — Section 3 (data model), Section 2
 * (Receipt Upload & OCR, Rewards Calculation), Section 4.3 (engine wiring).
 *
 * The receipt service is pure over these ports so the OCR/needs_review flow,
 * the reward calculation, and the rule-versioning guarantee can all be tested
 * with in-memory fakes (no Postgres).
 */

import type { RewardRule } from "../rewards-engine.ts";

export type ReceiptStatus = "needs_review" | "confirmed";

/** Mirrors the `receipts` table (Section 3). Amounts in dollars. */
export interface ReceiptRecord {
  id: string;
  userId: string;
  merchantRaw: string | null;
  merchantNormalized: string | null;
  /** null => Uncategorized: requires user input before it can be confirmed. */
  category: string | null;
  date: string | null; // ISO YYYY-MM-DD
  totalAmount: number | null;
  ocrConfidence: number | null;
  status: ReceiptStatus;
  userCardId: string | null;
  imageUrl: string | null;
  ocrRawText: string | null;
  createdAt: Date;
}

/**
 * A frozen copy of ONE card's rules at calculation time. This is the anti-drift
 * mechanism (Section 3 key design decision): the calculation stores exactly the
 * rules it used, so later edits to card_reward_rules cannot change history.
 */
export interface SnapshotCard {
  cardId: string; // the user_card_id evaluated
  cardCatalogId: string;
  label: string;
  rules: RewardRule[]; // deep-frozen copy, not a reference to live rows
}

/** The full snapshot stored in reward_calculations.rule_version_snapshot (JSON). */
export interface RuleVersionSnapshot {
  /** ISO datetime the snapshot was taken. */
  takenAt: string;
  /** Evaluation inputs, so the calc is fully reproducible from the snapshot. */
  category: string;
  amount: number;
  evaluationDate: string;
  currentQuarter: string;
  activatedRuleIds: string[];
  /** Every candidate card + its rules exactly as used. */
  cards: SnapshotCard[];
}

/** Mirrors `reward_calculations` (Section 3). Amounts in dollars. */
export interface RewardCalculationRecord {
  id: string;
  receiptId: string;
  actualRate: number;
  actualCashback: number;
  optimalUserCardId: string | null;
  optimalRate: number;
  optimalCashback: number;
  missedAmount: number;
  ruleVersionSnapshot: RuleVersionSnapshot;
  calculatedAt: Date;
}

// --- Ports ------------------------------------------------------------------

export interface ReceiptRepository {
  create(input: Omit<ReceiptRecord, "id" | "createdAt">): Promise<ReceiptRecord>;
  get(id: string): Promise<ReceiptRecord | null>;
  listByUser(userId: string, status?: ReceiptStatus): Promise<ReceiptRecord[]>;
  update(id: string, patch: Partial<ReceiptRecord>): Promise<ReceiptRecord>;
  delete(id: string): Promise<void>;
}

export interface CalculationRepository {
  upsertForReceipt(
    input: Omit<RewardCalculationRecord, "id" | "calculatedAt">
  ): Promise<RewardCalculationRecord>;
  getByReceipt(receiptId: string): Promise<RewardCalculationRecord | null>;
  /** Confirmed-receipt calcs for a user, for dashboard aggregation. */
  listByUser(userId: string): Promise<RewardCalculationRecord[]>;
}

/**
 * Supplies the user's saved cards + their CURRENT rules for evaluation. The
 * service snapshots these before storing a calc, so the live source can change
 * afterward without affecting stored history.
 */
export interface UserCardRulesProvider {
  getEvaluableCards(userId: string): Promise<SnapshotCard[]>;
}
