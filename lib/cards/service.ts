/**
 * Card management service — Section 2 (Card Management) + Section 5 endpoints
 * (/cards/catalog, /users/me/cards, DELETE /users/me/cards/:id).
 *
 * Business rules live here as PURE functions over an injected repository
 * interface, so they can be unit-tested with an in-memory fake (no Postgres).
 * The Prisma-backed implementation of CardRepository lives in the route/adapter
 * layer.
 *
 * Enforced rules:
 *  - A user adds a card only by referencing an existing catalog entry
 *    (Section 2: never types their own reward rates). Unknown catalog id => 404.
 *  - Listing/removing is scoped to the owning user; acting on another user's
 *    card id => 403 (Section 2 authorization criterion), missing => 404.
 */

import type { Principal } from "../auth/authz.ts";
import { assertOwner } from "../auth/authz.ts";
import { NotFound } from "../errors.ts";

export interface CatalogCardRecord {
  id: string;
  issuer: string;
  productName: string;
  network: string;
}

export interface UserCardRecord {
  id: string;
  userId: string;
  cardCatalogId: string;
  nickname: string | null;
  addedAt: Date;
}

/**
 * Persistence port. The service depends only on this interface; the real
 * implementation wraps Prisma, the test implementation is in-memory.
 */
export interface CardRepository {
  searchCatalog(search?: string): Promise<CatalogCardRecord[]>;
  getCatalogCard(id: string): Promise<CatalogCardRecord | null>;
  listUserCards(userId: string): Promise<UserCardRecord[]>;
  getUserCard(id: string): Promise<UserCardRecord | null>;
  createUserCard(input: {
    userId: string;
    cardCatalogId: string;
    nickname: string | null;
  }): Promise<UserCardRecord>;
  deleteUserCard(id: string): Promise<void>;
}

export function browseCatalog(
  repo: CardRepository,
  search?: string
): Promise<CatalogCardRecord[]> {
  return repo.searchCatalog(search);
}

export function listMyCards(
  repo: CardRepository,
  principal: Principal
): Promise<UserCardRecord[]> {
  return repo.listUserCards(principal.userId);
}

export async function addMyCard(
  repo: CardRepository,
  principal: Principal,
  input: { cardCatalogId: string; nickname?: string }
): Promise<UserCardRecord> {
  // Card must come from the researched catalog (Section 2).
  const catalog = await repo.getCatalogCard(input.cardCatalogId);
  if (!catalog) throw NotFound("catalog card not found");

  return repo.createUserCard({
    userId: principal.userId,
    cardCatalogId: input.cardCatalogId,
    nickname: input.nickname ?? null,
  });
}

/**
 * Remove one of the principal's cards. Ownership is enforced: another user's
 * card id => 403, missing => 404 (assertOwner). Removing a card must NOT cascade
 * into receipts/history — that is guaranteed at the schema level
 * (userCardId onDelete: SetNull, reward_calculations keep their snapshot).
 */
export async function removeMyCard(
  repo: CardRepository,
  principal: Principal,
  userCardId: string
): Promise<void> {
  const card = await repo.getUserCard(userCardId);
  assertOwner(principal, card); // throws NotFound(404) / Forbidden(403)
  await repo.deleteUserCard(userCardId);
}
