// GET /dashboard/best-card-cheatsheet — Section 5, governed by Section 2 (Dashboard).
// "Best card per category" based on the user's SAVED cards.
// TODO: requireUser; for each canonical category, run the rewards engine over
// the user's saved-card rules (lib/rewards-engine.ts) with a normalized $1 (or
// nominal) amount and report the top card per category. Deterministic + tested.
import { notImplemented } from "@/lib/http";

export async function GET(): Promise<Response> {
  return notImplemented(
    "Section 2 (Dashboard), Section 4.3 (engine)",
    "Auth-gate; compute best saved card per category via evaluatePurchase()."
  );
}
