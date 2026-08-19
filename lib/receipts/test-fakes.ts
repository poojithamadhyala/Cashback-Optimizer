/**
 * In-memory fakes for receipt/dashboard tests. These let us exercise the full
 * service flow (upload -> confirm -> calc -> dashboard) and, critically, the
 * rule-versioning guarantee, without a database.
 *
 * The `MutableCardRulesProvider` deliberately exposes its LIVE rule objects so a
 * test can mutate a rule's rate AFTER a calculation is stored, then assert the
 * stored calculation is unchanged. This is what makes the versioning test
 * adversarial rather than trivial.
 */

import type {
  ReceiptRepository,
  CalculationRepository,
  UserCardRulesProvider,
  ReceiptRecord,
  RewardCalculationRecord,
  SnapshotCard,
} from "./types.ts";

export function makeReceiptRepo(): ReceiptRepository & { _rows: ReceiptRecord[] } {
  const rows: ReceiptRecord[] = [];
  let seq = 0;
  return {
    _rows: rows,
    async create(input) {
      const rec: ReceiptRecord = { ...input, id: `r-${++seq}`, createdAt: new Date("2026-08-19T00:00:00Z") };
      rows.push(rec);
      return { ...rec };
    },
    async get(id) {
      const r = rows.find((x) => x.id === id);
      return r ? { ...r } : null;
    },
    async listByUser(userId, status) {
      return rows
        .filter((r) => r.userId === userId && (status ? r.status === status : true))
        .map((r) => ({ ...r }));
    },
    async update(id, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r) throw new Error("receipt not found");
      Object.assign(r, patch);
      return { ...r };
    },
    async delete(id) {
      const i = rows.findIndex((x) => x.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
  };
}

export function makeCalcRepo(): CalculationRepository & { _rows: RewardCalculationRecord[] } {
  const rows: RewardCalculationRecord[] = [];
  let seq = 0;
  return {
    _rows: rows,
    async upsertForReceipt(input) {
      const existing = rows.find((x) => x.receiptId === input.receiptId);
      if (existing) {
        Object.assign(existing, input);
        // Return a deep copy so callers can't mutate stored state via the return.
        return structuredClone(existing);
      }
      const rec: RewardCalculationRecord = {
        ...structuredClone(input),
        id: `calc-${++seq}`,
        calculatedAt: new Date("2026-08-19T00:00:00Z"),
      };
      rows.push(rec);
      return structuredClone(rec);
    },
    async getByReceipt(receiptId) {
      const r = rows.find((x) => x.receiptId === receiptId);
      return r ? structuredClone(r) : null;
    },
    async listByUser(userId) {
      // Join to receipts is not modeled here; tests pass calcs whose snapshots
      // belong to the user. For dashboard tests we filter by a userId tag we
      // store on the snapshot-less record via receiptId prefixing is avoided;
      // instead the dashboard test constructs calcs directly. Return all.
      void userId;
      return rows.map((r) => structuredClone(r));
    },
  };
}

/**
 * Card rules provider whose underlying rule objects are mutable and shared, so a
 * test can change a rate after the fact. getEvaluableCards returns the LIVE
 * objects (not copies) on purpose — the SERVICE is responsible for snapshotting
 * by value, and that responsibility is exactly what we are testing.
 */
export class MutableCardRulesProvider implements UserCardRulesProvider {
  private readonly cardsByUser: Record<string, SnapshotCard[]>;

  constructor(cardsByUser: Record<string, SnapshotCard[]>) {
    this.cardsByUser = cardsByUser;
  }

  async getEvaluableCards(userId: string): Promise<SnapshotCard[]> {
    return this.cardsByUser[userId] ?? [];
  }

  /** Test helper: mutate a rule's rate in place on the live objects. */
  mutateRuleRate(userId: string, ruleId: string, newRate: number): void {
    for (const card of this.cardsByUser[userId] ?? []) {
      for (const rule of card.rules) {
        if (rule.id === ruleId) rule.rate = newRate;
      }
    }
  }
}
