/**
 * Serializers mapping internal service records to API DTOs.
 *
 * These exist to keep the wire payload EXACTLY matching lib/api/types.ts — no
 * accidental extra fields. In particular, RewardCalculationRecord carries the
 * full `ruleVersionSnapshot` (a potentially large internal audit blob); the API
 * must NOT ship that to the browser on every confirm. toCalculationDTO strips
 * it so the RewardCalculationDTO is truthful and the response stays lean.
 *
 * Pure functions — unit-tested in serializers.test.ts.
 */

import type { RewardCalculationRecord } from "../receipts/types.ts";
import type { RewardCalculationDTO } from "./types.ts";

export function toCalculationDTO(calc: RewardCalculationRecord): RewardCalculationDTO {
  return {
    id: calc.id,
    receiptId: calc.receiptId,
    actualRate: calc.actualRate,
    actualCashback: calc.actualCashback,
    optimalUserCardId: calc.optimalUserCardId,
    optimalRate: calc.optimalRate,
    optimalCashback: calc.optimalCashback,
    missedAmount: calc.missedAmount,
    // calculatedAt is a Date on the record; NextResponse.json() serializes it to
    // an ISO string, matching RewardCalculationDTO.calculatedAt: string.
    calculatedAt: calc.calculatedAt.toISOString(),
    // NOTE: ruleVersionSnapshot is intentionally omitted (internal audit data).
  };
}
