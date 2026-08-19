// GET /cards/catalog?search= — Section 5, governed by Section 2 (Card Management).
// Browse the researched, shared card catalog. Users add cards FROM this catalog;
// they never type their own reward rates (Section 2).
// TODO: requireUser; query CardCatalog (+ optional search filter); return
// issuer/product/network + rules. See seed data in prisma/seed.ts (Section 9).
import { notImplemented } from "@/lib/http";

export async function GET(): Promise<Response> {
  return notImplemented(
    "Section 2 (Card Management), Section 9 (Seed Catalog)",
    "Auth-gate, query card_catalog with optional ?search=, return catalog + rules."
  );
}
