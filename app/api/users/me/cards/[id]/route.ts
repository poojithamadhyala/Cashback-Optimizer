// DELETE /users/me/cards/:id — Section 5, governed by Section 2 (Card Management).
// Ownership enforced by removeMyCard: another user's id => 403, missing => 404.
// Removing a card does NOT recalculate history (schema: userCardId SetNull;
// reward_calculations keep their ruleVersionSnapshot).
import { errorResponse, json } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { removeMyCard } from "@/lib/cards/service";
import { prismaCardRepository } from "@/lib/cards/prisma-repository";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const principal = requirePrincipal(await getCurrentPrincipal());
    const { id } = await ctx.params;
    await removeMyCard(prismaCardRepository, principal, id);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
