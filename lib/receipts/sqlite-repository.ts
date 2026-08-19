/**
 * SQLite-backed repositories for INTEGRATION TESTS — real SQL persistence.
 *
 * ⚠️ SCOPE: This exists to prove the service contracts (needs_review exclusion,
 * rule-snapshot immutability) against a GENUINE database that runs offline in
 * this sandbox. It uses Node's built-in `node:sqlite` (Node >= 22.5,
 * --experimental-sqlite), zero npm deps.
 *
 * This is SQLite, NOT Postgres. The production app uses Postgres via Prisma
 * (lib/receipts/prisma-repository.ts). The equivalent Postgres/Prisma
 * integration tests live in integration/pg/ and run in CI against a real
 * Postgres service container. The schema below mirrors prisma/schema.prisma.
 *
 * The rule_version_snapshot is stored as a TEXT (JSON) column, exactly like the
 * Prisma Json column — so the immutability guarantee (snapshot is data, not a
 * live join) is exercised the same way it will be in Postgres.
 */

import { DatabaseSync } from "node:sqlite";
import type {
  ReceiptRepository,
  CalculationRepository,
  ReceiptRecord,
  ReceiptStatus,
  RewardCalculationRecord,
  RuleVersionSnapshot,
} from "./types.ts";

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS card_reward_rules (
      id TEXT PRIMARY KEY,
      card_catalog_id TEXT NOT NULL,
      category TEXT NOT NULL,
      rate REAL NOT NULL,
      unit TEXT NOT NULL,
      point_value_cents INTEGER,
      cap_amount REAL,
      is_rotating INTEGER NOT NULL DEFAULT 0,
      quarter TEXT,
      effective_from TEXT,
      effective_to TEXT
    );
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      merchant_raw TEXT,
      merchant_normalized TEXT,
      category TEXT,
      date TEXT,
      total_amount REAL,
      ocr_confidence REAL,
      status TEXT NOT NULL,
      user_card_id TEXT,
      image_url TEXT,
      ocr_raw_text TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reward_calculations (
      id TEXT PRIMARY KEY,
      receipt_id TEXT UNIQUE NOT NULL,
      actual_rate REAL NOT NULL,
      actual_cashback REAL NOT NULL,
      optimal_user_card_id TEXT,
      optimal_rate REAL NOT NULL,
      optimal_cashback REAL NOT NULL,
      missed_amount REAL NOT NULL,
      rule_version_snapshot TEXT NOT NULL,
      calculated_at TEXT NOT NULL
    );
  `);
}

let idSeq = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${++idSeq}`;
}

function rowToReceipt(r: Record<string, unknown>): ReceiptRecord {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    merchantRaw: (r.merchant_raw as string) ?? null,
    merchantNormalized: (r.merchant_normalized as string) ?? null,
    category: (r.category as string) ?? null,
    date: (r.date as string) ?? null,
    totalAmount: r.total_amount == null ? null : Number(r.total_amount),
    ocrConfidence: r.ocr_confidence == null ? null : Number(r.ocr_confidence),
    status: r.status as ReceiptStatus,
    userCardId: (r.user_card_id as string) ?? null,
    imageUrl: (r.image_url as string) ?? null,
    ocrRawText: (r.ocr_raw_text as string) ?? null,
    createdAt: new Date(r.created_at as string),
  };
}

export function makeSqliteReceiptRepository(db: DatabaseSync): ReceiptRepository {
  return {
    async create(input) {
      const id = nextId("r");
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO receipts (id,user_id,merchant_raw,merchant_normalized,category,date,total_amount,ocr_confidence,status,user_card_id,image_url,ocr_raw_text,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        id,
        input.userId,
        input.merchantRaw,
        input.merchantNormalized,
        input.category,
        input.date,
        input.totalAmount,
        input.ocrConfidence,
        input.status,
        input.userCardId,
        input.imageUrl,
        input.ocrRawText,
        createdAt
      );
      return rowToReceipt(db.prepare(`SELECT * FROM receipts WHERE id=?`).get(id) as Record<string, unknown>);
    },
    async get(id) {
      const row = db.prepare(`SELECT * FROM receipts WHERE id=?`).get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToReceipt(row) : null;
    },
    async listByUser(userId, status) {
      const rows = (status
        ? db.prepare(`SELECT * FROM receipts WHERE user_id=? AND status=? ORDER BY created_at DESC`).all(userId, status)
        : db.prepare(`SELECT * FROM receipts WHERE user_id=? ORDER BY created_at DESC`).all(userId)) as Record<string, unknown>[];
      return rows.map(rowToReceipt);
    },
    async update(id, patch) {
      const current = db.prepare(`SELECT * FROM receipts WHERE id=?`).get(id) as Record<string, unknown> | undefined;
      if (!current) throw new Error("receipt not found");
      const merged = rowToReceipt(current);
      const next: ReceiptRecord = {
        ...merged,
        merchantNormalized: patch.merchantNormalized ?? merged.merchantNormalized,
        category: patch.category ?? merged.category,
        date: patch.date ?? merged.date,
        totalAmount: patch.totalAmount ?? merged.totalAmount,
        userCardId: patch.userCardId ?? merged.userCardId,
        status: patch.status ?? merged.status,
      };
      db.prepare(
        `UPDATE receipts SET merchant_normalized=?,category=?,date=?,total_amount=?,user_card_id=?,status=? WHERE id=?`
      ).run(next.merchantNormalized, next.category, next.date, next.totalAmount, next.userCardId, next.status, id);
      return next;
    },
    async delete(id) {
      db.prepare(`DELETE FROM receipts WHERE id=?`).run(id);
    },
  };
}

function rowToCalc(r: Record<string, unknown>): RewardCalculationRecord {
  return {
    id: r.id as string,
    receiptId: r.receipt_id as string,
    actualRate: Number(r.actual_rate),
    actualCashback: Number(r.actual_cashback),
    optimalUserCardId: (r.optimal_user_card_id as string) ?? null,
    optimalRate: Number(r.optimal_rate),
    optimalCashback: Number(r.optimal_cashback),
    missedAmount: Number(r.missed_amount),
    ruleVersionSnapshot: JSON.parse(r.rule_version_snapshot as string) as RuleVersionSnapshot,
    calculatedAt: new Date(r.calculated_at as string),
  };
}

export function makeSqliteCalculationRepository(db: DatabaseSync): CalculationRepository {
  return {
    async upsertForReceipt(input) {
      const existing = db.prepare(`SELECT id FROM reward_calculations WHERE receipt_id=?`).get(input.receiptId) as
        | { id: string }
        | undefined;
      const snapshotJson = JSON.stringify(input.ruleVersionSnapshot);
      if (existing) {
        db.prepare(
          `UPDATE reward_calculations SET actual_rate=?,actual_cashback=?,optimal_user_card_id=?,optimal_rate=?,optimal_cashback=?,missed_amount=?,rule_version_snapshot=? WHERE receipt_id=?`
        ).run(
          input.actualRate, input.actualCashback, input.optimalUserCardId, input.optimalRate,
          input.optimalCashback, input.missedAmount, snapshotJson, input.receiptId
        );
      } else {
        db.prepare(
          `INSERT INTO reward_calculations (id,receipt_id,actual_rate,actual_cashback,optimal_user_card_id,optimal_rate,optimal_cashback,missed_amount,rule_version_snapshot,calculated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        ).run(
          nextId("calc"), input.receiptId, input.actualRate, input.actualCashback, input.optimalUserCardId,
          input.optimalRate, input.optimalCashback, input.missedAmount, snapshotJson, new Date().toISOString()
        );
      }
      return rowToCalc(db.prepare(`SELECT * FROM reward_calculations WHERE receipt_id=?`).get(input.receiptId) as Record<string, unknown>);
    },
    async getByReceipt(receiptId) {
      const row = db.prepare(`SELECT * FROM reward_calculations WHERE receipt_id=?`).get(receiptId) as
        | Record<string, unknown>
        | undefined;
      return row ? rowToCalc(row) : null;
    },
    async listByUser(userId) {
      // JOIN to confirmed receipts owned by the user. needs_review receipts have
      // no calc row, so they cannot appear here — the exclusion is enforced by
      // real SQL, exactly as the Postgres/Prisma adapter does.
      const rows = db
        .prepare(
          `SELECT rc.* FROM reward_calculations rc
           JOIN receipts r ON r.id = rc.receipt_id
           WHERE r.user_id=? AND r.status='confirmed'
           ORDER BY rc.calculated_at DESC`
        )
        .all(userId) as Record<string, unknown>[];
      return rows.map(rowToCalc);
    },
  };
}
