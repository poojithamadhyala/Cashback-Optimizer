// GET /cards/catalog?search= — Section 5, governed by Section 2 (Card Management).
// Auth-gated browse of the researched, shared catalog. Users add cards FROM
// this catalog (Section 2: they never type their own reward rates).
import { errorResponse, json } from "@/lib/http";
import { requirePrincipal } from "@/lib/auth/authz";
import { getCurrentPrincipal } from "@/lib/auth/current-user";
import { browseCatalog } from "@/lib/cards/service";
import { prismaCardRepository } from "@/lib/cards/prisma-repository";

export async function GET(req: Request): Promise<Response> {
  try {
    requirePrincipal(await getCurrentPrincipal()); // auth required (Section 2)
    const search = new URL(req.url).searchParams.get("search") ?? undefined;
    const cards = await browseCatalog(prismaCardRepository, search);
    return json({ cards });
  } catch (err) {
    return errorResponse(err);
  }
}
