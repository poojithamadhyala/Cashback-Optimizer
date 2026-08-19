/**
 * Card service tests — Section 2 (Card Management) + Section 6 (authorization).
 * Uses an in-memory CardRepository fake so business rules are tested without a DB.
 * Run: node --experimental-strip-types --test lib/cards/service.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  browseCatalog,
  listMyCards,
  addMyCard,
  removeMyCard,
  type CardRepository,
  type CatalogCardRecord,
  type UserCardRecord,
} from "./service.ts";
import { AppError } from "../errors.ts";

function makeRepo(): CardRepository & { _userCards: UserCardRecord[] } {
  const catalog: CatalogCardRecord[] = [
    { id: "csp", issuer: "Chase", productName: "Sapphire Preferred", network: "Visa" },
    { id: "bce", issuer: "Amex", productName: "Blue Cash Everyday", network: "Amex" },
  ];
  const userCards: UserCardRecord[] = [];
  let seq = 0;

  return {
    _userCards: userCards,
    async searchCatalog(search?: string) {
      if (!search) return catalog;
      const s = search.toLowerCase();
      return catalog.filter(
        (c) =>
          c.issuer.toLowerCase().includes(s) ||
          c.productName.toLowerCase().includes(s)
      );
    },
    async getCatalogCard(id: string) {
      return catalog.find((c) => c.id === id) ?? null;
    },
    async listUserCards(userId: string) {
      return userCards.filter((c) => c.userId === userId);
    },
    async getUserCard(id: string) {
      return userCards.find((c) => c.id === id) ?? null;
    },
    async createUserCard(input) {
      const rec: UserCardRecord = {
        id: `uc-${++seq}`,
        userId: input.userId,
        cardCatalogId: input.cardCatalogId,
        nickname: input.nickname,
        addedAt: new Date("2026-08-19T00:00:00Z"),
      };
      userCards.push(rec);
      return rec;
    },
    async deleteUserCard(id: string) {
      const i = userCards.findIndex((c) => c.id === id);
      if (i >= 0) userCards.splice(i, 1);
    },
  };
}

const alice = { userId: "alice", email: "alice@x.com" };
const bob = { userId: "bob", email: "bob@x.com" };

test("browseCatalog returns all, and filters by search", async () => {
  const repo = makeRepo();
  assert.equal((await browseCatalog(repo)).length, 2);
  const chase = await browseCatalog(repo, "chase");
  assert.equal(chase.length, 1);
  assert.equal(chase[0].id, "csp");
});

test("addMyCard adds a catalog card scoped to the user", async () => {
  const repo = makeRepo();
  const card = await addMyCard(repo, alice, { cardCatalogId: "csp", nickname: "Travel" });
  assert.equal(card.userId, "alice");
  assert.equal(card.cardCatalogId, "csp");
  assert.equal(card.nickname, "Travel");
  const mine = await listMyCards(repo, alice);
  assert.equal(mine.length, 1);
});

test("addMyCard with unknown catalog id => not_found(404)", async () => {
  const repo = makeRepo();
  await assert.rejects(
    () => addMyCard(repo, alice, { cardCatalogId: "does-not-exist" }),
    (e: unknown) => e instanceof AppError && e.kind === "not_found"
  );
});

test("listMyCards is isolated per user (data isolation, Section 2)", async () => {
  const repo = makeRepo();
  await addMyCard(repo, alice, { cardCatalogId: "csp" });
  await addMyCard(repo, bob, { cardCatalogId: "bce" });
  const aliceCards = await listMyCards(repo, alice);
  const bobCards = await listMyCards(repo, bob);
  assert.equal(aliceCards.length, 1);
  assert.equal(aliceCards[0].cardCatalogId, "csp");
  assert.equal(bobCards.length, 1);
  assert.equal(bobCards[0].cardCatalogId, "bce");
});

test("removeMyCard: owner can remove own card", async () => {
  const repo = makeRepo();
  const card = await addMyCard(repo, alice, { cardCatalogId: "csp" });
  await removeMyCard(repo, alice, card.id);
  assert.equal((await listMyCards(repo, alice)).length, 0);
});

test("removeMyCard: user B removing user A's card => forbidden(403)", async () => {
  const repo = makeRepo();
  const alicesCard = await addMyCard(repo, alice, { cardCatalogId: "csp" });
  await assert.rejects(
    () => removeMyCard(repo, bob, alicesCard.id),
    (e: unknown) => e instanceof AppError && e.kind === "forbidden"
  );
  // Alice's card is untouched
  assert.equal((await listMyCards(repo, alice)).length, 1);
});

test("removeMyCard: nonexistent card id => not_found(404)", async () => {
  const repo = makeRepo();
  await assert.rejects(
    () => removeMyCard(repo, alice, "uc-999"),
    (e: unknown) => e instanceof AppError && e.kind === "not_found"
  );
});
