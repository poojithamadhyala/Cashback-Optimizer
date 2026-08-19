/**
 * Receipt service — Section 2 (Receipt Upload & OCR, Rewards Calculation),
 * Section 4 (service boundaries). Pure over repository ports.
 *
 * Flow:
 *  - uploadReceipt: run OCR (injected provider) -> routeReceipt decides
 *    needs_review vs confirmed -> persist. Also run the categorizer to
 *    pre-fill category (null => Uncategorized, never a silent guess).
 *  - getReceipt / listReceipts: ownership-scoped reads.
 *  - confirmReceipt: apply user edits, require the fields the money-math needs,
 *    snapshot the user's current card rules (DEEP COPY), run the tested rewards
 *    engine, persist a reward_calculation WITH the snapshot, flip status to
 *    confirmed. This is what makes it count toward the dashboard.
 *  - deleteReceipt: ownership-scoped delete.
 *
 * The rule snapshot is the anti-drift guarantee (Section 3): editing/removing a
 * card's rules later must NOT change an already-stored calculation. We enforce
 * that by copying rule data by value into the snapshot, never by reference.
 */

import type {
  OcrProvider,
  ReceiptStatus as OcrReceiptStatus,
} from "../ocr/index.ts";
import { routeReceipt } from "../ocr/route-receipt.ts";
import { categorize } from "../categorizer/categorizer.ts";
import { evaluatePurchase, type CardForEval } from "../rewards-engine.ts";
import { assertOwner, requirePrincipal, type Principal } from "../auth/authz.ts";
import { Validation } from "../errors.ts";
import type {
  ReceiptRepository,
  CalculationRepository,
  UserCardRulesProvider,
  ReceiptRecord,
  RewardCalculationRecord,
  RuleVersionSnapshot,
  SnapshotCard,
} from "./types.ts";

export interface ReceiptServiceDeps {
  receipts: ReceiptRepository;
  calcs: CalculationRepository;
  cardRules: UserCardRulesProvider;
  ocr: OcrProvider;
  confidenceThreshold: number;
  /** Injected clock for determinism; defaults to real time in adapters. */
  now: () => Date;
  /** Current quarter string, e.g. "2026-Q3" (injected for determinism). */
  currentQuarter: string;
  /** Rule ids the user has activated (rotating categories). */
  activatedRuleIds?: string[];
}

/** Upload: OCR -> route -> persist. Returns the created receipt. */
export async function uploadReceipt(
  deps: ReceiptServiceDeps,
  principal: Principal,
  image: Uint8Array,
  mimeType: string,
  imageUrl: string | null
): Promise<ReceiptRecord> {
  requirePrincipal(principal);

  const ocr = await deps.ocr.analyze(image, mimeType);
  const decision = routeReceipt(ocr, deps.confidenceThreshold);
  const status: OcrReceiptStatus = decision.status;

  // Pre-categorize when we have a merchant; null category => Uncategorized.
  let merchantNormalized: string | null = null;
  let category: string | null = null;
  if (ocr.merchantRaw) {
    const c = categorize(ocr.merchantRaw);
    merchantNormalized = c.merchantNormalized;
    category = c.category; // null when unresolved (no silent guess)
  }

  return deps.receipts.create({
    userId: principal.userId,
    merchantRaw: ocr.merchantRaw,
    merchantNormalized,
    category,
    date: ocr.date,
    totalAmount: ocr.total,
    ocrConfidence: ocr.confidence,
    status,
    userCardId: null,
    imageUrl,
    ocrRawText: ocr.rawText,
  });
}

export async function getReceipt(
  deps: ReceiptServiceDeps,
  principal: Principal,
  id: string
): Promise<ReceiptRecord> {
  requirePrincipal(principal);
  const receipt = await deps.receipts.get(id);
  return assertOwner(principal, receipt); // 404 missing / 403 not owner
}

export function listReceipts(
  deps: ReceiptServiceDeps,
  principal: Principal,
  status?: ReceiptStatus
): Promise<ReceiptRecord[]> {
  requirePrincipal(principal);
  return deps.receipts.listByUser(principal.userId, status);
}

export interface ConfirmInput {
  merchantNormalized?: string;
  category?: string;
  date?: string;
  totalAmount?: number;
  userCardId?: string;
}

export type ReceiptStatus = OcrReceiptStatus;

/**
 * Confirm (or re-confirm) a receipt: apply edits, validate required fields, run
 * the rewards engine over a DEEP-COPIED snapshot of the user's current card
 * rules, and persist the calculation + snapshot. Sets status = confirmed.
 */
export async function confirmReceipt(
  deps: ReceiptServiceDeps,
  principal: Principal,
  id: string,
  edits: ConfirmInput
): Promise<{ receipt: ReceiptRecord; calculation: RewardCalculationRecord }> {
  requirePrincipal(principal);
  const existing = await deps.receipts.get(id);
  const receipt = assertOwner(principal, existing);

  // Merge edits over existing values.
  const merchantNormalized = edits.merchantNormalized ?? receipt.merchantNormalized;
  const category = edits.category ?? receipt.category;
  const date = edits.date ?? receipt.date;
  const totalAmount = edits.totalAmount ?? receipt.totalAmount;
  const userCardId = edits.userCardId ?? receipt.userCardId;

  // Required-field validation for money math (Section 2: never guess).
  const errors: Record<string, string> = {};
  if (!category) errors.category = "required (receipt is Uncategorized)";
  if (date === null || date === undefined) errors.date = "required";
  if (totalAmount === null || totalAmount === undefined) {
    errors.totalAmount = "required";
  } else if (!(totalAmount > 0)) {
    errors.totalAmount = "must be greater than 0";
  }
  if (!userCardId) errors.userCardId = "required (which card did you use?)";
  if (Object.keys(errors).length > 0) throw Validation("cannot confirm receipt", errors);

  // Snapshot the user's current card rules BY VALUE (anti-drift, Section 3).
  const liveCards = await deps.cardRules.getEvaluableCards(principal.userId);
  const snapshotCards: SnapshotCard[] = deepCopyCards(liveCards);

  const cardsForEval: CardForEval[] = snapshotCards.map((c) => ({
    cardId: c.cardId,
    label: c.label,
    rules: c.rules,
  }));

  const evalDate = date as string;
  const evaluation = evaluatePurchase({
    category: category as string,
    amount: totalAmount as number,
    cards: cardsForEval,
    actualCardId: userCardId as string,
    context: {
      evaluationDate: evalDate,
      currentQuarter: deps.currentQuarter,
      activatedRuleIds: deps.activatedRuleIds ?? [],
    },
  });

  const snapshot: RuleVersionSnapshot = {
    takenAt: deps.now().toISOString(),
    category: category as string,
    amount: totalAmount as number,
    evaluationDate: evalDate,
    currentQuarter: deps.currentQuarter,
    activatedRuleIds: [...(deps.activatedRuleIds ?? [])],
    cards: snapshotCards,
  };

  const actualCashback = centsToDollars(evaluation.actual?.cashbackCents ?? 0);
  const optimalCashback = centsToDollars(evaluation.optimal?.cashbackCents ?? 0);

  const calculation = await deps.calcs.upsertForReceipt({
    receiptId: receipt.id,
    actualRate: evaluation.actual?.effectiveRatePct ?? 0,
    actualCashback,
    optimalUserCardId: evaluation.optimal?.cardId ?? null,
    optimalRate: evaluation.optimal?.effectiveRatePct ?? 0,
    optimalCashback,
    missedAmount: centsToDollars(evaluation.missedCents),
    ruleVersionSnapshot: snapshot,
  });

  const updated = await deps.receipts.update(receipt.id, {
    merchantNormalized,
    category,
    date,
    totalAmount,
    userCardId,
    status: "confirmed",
  });

  return { receipt: updated, calculation };
}

export async function deleteReceipt(
  deps: ReceiptServiceDeps,
  principal: Principal,
  id: string
): Promise<void> {
  requirePrincipal(principal);
  const existing = await deps.receipts.get(id);
  assertOwner(principal, existing);
  await deps.receipts.delete(id);
}

// --- helpers ----------------------------------------------------------------

function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Deep copy card + rule data so the stored snapshot cannot be mutated through a
 * shared reference to live objects. structuredClone is available in Node >= 17.
 */
function deepCopyCards(cards: SnapshotCard[]): SnapshotCard[] {
  return structuredClone(cards);
}
