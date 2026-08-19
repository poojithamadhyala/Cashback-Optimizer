/**
 * Builds the ReceiptServiceDeps for the Next.js runtime from the Prisma adapters
 * + OCR factory + real clock. Kept out of service.ts so the service stays pure
 * and testable with injected fakes.
 */

import { getOcrProvider, getConfidenceThreshold } from "../ocr/index.ts";
import { prismaReceiptRepository, prismaCalculationRepository } from "./prisma-repository.ts";
import { prismaUserCardRulesProvider } from "./prisma-card-rules.ts";
import { quarterOf } from "./quarter.ts";
import type { ReceiptServiceDeps } from "./service.ts";

export { quarterOf };

export function buildReceiptDeps(): ReceiptServiceDeps {
  const now = () => new Date();
  return {
    receipts: prismaReceiptRepository,
    calcs: prismaCalculationRepository,
    cardRules: prismaUserCardRulesProvider,
    ocr: getOcrProvider(),
    confidenceThreshold: getConfidenceThreshold(),
    now,
    currentQuarter: quarterOf(now()),
    activatedRuleIds: [], // TODO: source from user's rotating-activation state (v2)
  };
}
