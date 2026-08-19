// GET  /users/me/cards        — list the current user's saved cards
// POST /users/me/cards        — add a card FROM the catalog (cardCatalogId + nickname)
// Section 5, governed by Section 2 (Card Management).
// TODO: requireUser on both; scope all queries to the authenticated user's id
// (Section 2: data isolation). POST references card_catalog, not free-typed rates.
import { notImplemented } from "@/lib/http";

export async function GET(): Promise<Response> {
  return notImplemented(
    "Section 2 (Card Management)",
    "Auth-gate; return user_cards WHERE userId = session user."
  );
}

export async function POST(): Promise<Response> {
  return notImplemented(
    "Section 2 (Card Management)",
    "Auth-gate; validate cardCatalogId exists; create user_card for session user."
  );
}
