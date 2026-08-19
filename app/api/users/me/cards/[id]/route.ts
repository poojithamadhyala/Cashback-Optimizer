// DELETE /users/me/cards/:id — Section 5, governed by Section 2 (Card Management).
// Removing a card MUST NOT retroactively recalculate history: receipts persist
// (userCardId onDelete: SetNull) and reward_calculations keep their
// ruleVersionSnapshot (Section 2 / Section 3 versioning decision).
// TODO: requireUser; load user_card by id; assertOwnership(session, card.userId)
// -> 403 if mismatch (Section 2: no cross-user access by guessing IDs); delete.
import { notImplemented } from "@/lib/http";

export async function DELETE(
  _req: Request,
  _ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  return notImplemented(
    "Section 2 (Card Management), Section 3 (versioning)",
    "Auth-gate; ownership check (403 on mismatch); delete user_card; DO NOT touch history."
  );
}
