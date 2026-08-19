// GET    /receipts/:id  — fetch one receipt (owner only)
// PATCH  /receipts/:id  — confirm/edit needs_review data (merchant, date, total,
//                         category, userCardId). On confirm, run the rewards
//                         engine and persist a reward_calculation snapshot.
// DELETE /receipts/:id  — delete a receipt (owner only)
// Section 5, governed by Section 2 (Receipt Upload & OCR + data isolation).
//
// EVERY handler MUST: requireUser, then assertOwnership(session, receipt.userId)
// -> 403 on mismatch (Section 2: user A cannot access user B's receipt by ID).
//
// PATCH confirm flow (Section 2 Rewards Calculation, Section 3 versioning):
//   - build card rules for the user's saved cards
//   - call evaluatePurchase() from lib/rewards-engine.ts (deterministic, tested)
//   - persist reward_calculation WITH ruleVersionSnapshot (frozen copy of rules)
//   - flip status to "confirmed" so it counts toward dashboard totals
import { notImplemented } from "@/lib/http";

export async function GET(
  _req: Request,
  _ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  return notImplemented(
    "Section 2 (Receipt Upload & OCR, data isolation)",
    "Auth-gate; load receipt; ownership check (403 on mismatch); return it."
  );
}

export async function PATCH(
  _req: Request,
  _ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  return notImplemented(
    "Section 2 (Rewards Calculation), Section 3 (versioning), Section 4.3 (engine)",
    "Auth-gate; ownership check; on confirm run evaluatePurchase() and store reward_calculation with ruleVersionSnapshot."
  );
}

export async function DELETE(
  _req: Request,
  _ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  return notImplemented(
    "Section 2 (data isolation)",
    "Auth-gate; ownership check (403 on mismatch); delete receipt."
  );
}
