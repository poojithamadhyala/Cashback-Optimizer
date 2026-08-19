/**
 * OCR provider factory (Section 4.1 swappable interface).
 * Selects implementation from OCR_PROVIDER env var. Defaults to the offline-safe
 * mock so nothing is ever silently saved with guessed data.
 */

import type { OcrProvider } from "./types.ts";
import { MockOcrProvider } from "./mock-provider.ts";
import { TextractOcrProvider } from "./textract-provider.ts";

export * from "./types.ts";
export { routeReceipt } from "./route-receipt.ts";
export type { RoutingDecision, ReceiptStatus } from "./route-receipt.ts";

export function getOcrProvider(): OcrProvider {
  const which = (process.env.OCR_PROVIDER ?? "mock").toLowerCase();
  switch (which) {
    case "textract":
      return new TextractOcrProvider();
    case "mock":
    default:
      return new MockOcrProvider();
  }
}

export function getConfidenceThreshold(): number {
  const raw = process.env.OCR_CONFIDENCE_THRESHOLD;
  const n = raw ? Number.parseFloat(raw) : 0.8;
  return Number.isFinite(n) ? n : 0.8;
}
