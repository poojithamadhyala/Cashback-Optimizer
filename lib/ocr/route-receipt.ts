/**
 * Receipt routing logic — Section 2 (Receipt Upload & OCR) + Section 6.
 *
 * Pure decision function: given an OCR result and a confidence threshold,
 * decide whether the receipt is `confirmed` or must go to `needs_review`.
 *
 * Rule (Section 2): a receipt goes to needs_review if confidence is below
 * threshold OR any required field (merchant, date, total) is missing.
 * Never silently save guessed data.
 *
 * This is intentionally separate from any OCR backend so it can be unit-tested
 * with mocked OCR responses (Section 6: OCR pipeline).
 */

import type { OcrResult } from "./types.ts";

export type ReceiptStatus = "needs_review" | "confirmed";

export interface RoutingDecision {
  status: ReceiptStatus;
  /** Human-readable reasons the receipt needs review (empty if confirmed). */
  reasons: string[];
}

export function routeReceipt(
  ocr: OcrResult,
  confidenceThreshold: number
): RoutingDecision {
  const reasons: string[] = [];

  if (ocr.merchantRaw === null || ocr.merchantRaw.trim() === "") {
    reasons.push("missing merchant");
  }
  if (ocr.date === null) {
    reasons.push("missing date");
  }
  if (ocr.total === null) {
    reasons.push("missing total");
  }
  if (ocr.confidence < confidenceThreshold) {
    reasons.push(
      `low confidence (${ocr.confidence.toFixed(2)} < ${confidenceThreshold.toFixed(2)})`
    );
  }

  return {
    status: reasons.length === 0 ? "confirmed" : "needs_review",
    reasons,
  };
}
