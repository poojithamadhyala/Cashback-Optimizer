// GET  /users/me/cards — list the current user's saved cards (scoped to them)
// POST /users/me/cards — add a card FROM the catalog (cardCatalogId + nickname)
// Section 5, governed by Section 2 (Card Management + data isolation).
import { errorResponse, json, parseJson } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { listMyCards, addMyCard } from "@/lib/cards/service";
import { prismaCardRepository } from "@/lib/cards/prisma-repository";
import { validateAddCard, orThrow } from "@/lib/validation";

export async function GET(): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const cards = await listMyCards(prismaCardRepository, principal);
    return json({ cards });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const input = orThrow(validateAddCard(await parseJson(req)));
    const card = await addMyCard(prismaCardRepository, principal, input);
    return json({ card }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
